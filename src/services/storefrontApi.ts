import { supabase, SUPABASE_CONFIG_STATUS, SUPABASE_PUBLIC_URL } from '../lib/supabase';
import type {
  CartItem,
  CustomerCheckoutData,
  DeliveryFeeRule,
  OrderSubmissionResult,
  OrderSummaryCalculation,
  Product,
  ProductVideo,
  PublicMarketingSettings,
  PublicStoreSettings,
  StoreCategory,
} from '../types/store';
import { hasValidationErrors, validateCheckoutForm } from '../utils/checkout';
import {
  createDefaultMarketingSettings,
  extractMarketingSettings,
} from '../utils/metaPixel';
import {
  buildCatalogTechnicalDiagnostic,
  classifyCatalogError,
  isMissingColumnOrSchemaCacheError,
  PUBLIC_MESSAGES,
  type CatalogErrorKind,
  type PostgrestLikeError,
} from '../utils/publicMessages';
import {
  applyFeaturedSelection,
  attachRelationsToProducts,
  buildCreateStorefrontOrderRpcArgs,
  buildStoreCategories,
  classifyCheckoutRpcError,
  createDefaultPublicStoreSettings,
  extractPublicStoreSettings,
  generateOrderNumber,
  generateUuid,
  mapSupabaseProductToStoreProduct,
  PRODUCT_MEDIA_BUCKET,
  resolveProductMediaUrl,
  verifyAndRecalculateOrder,
  type SupabaseCategoryRow,
  type SupabaseProductMediaRow,
  type SupabaseProductRow,
  type SupabaseStoreSettingRow,
} from '../utils/supabaseMapper';

export interface StorefrontCatalogResponse {
  products: Product[];
  categories: StoreCategory[];
  storeSettings: PublicStoreSettings;
  marketingSettings: PublicMarketingSettings;
  whatsappNumber: string;
  deliveryFeeRules: DeliveryFeeRule[];
  error: string | null;
  errorKind: CatalogErrorKind;
  accessNotice: string | null;
}

const PRODUCTS_GRID_COLUMNS =
  'id, name, slug, sku, description, category_id, price, sale_price, stock_quantity, low_stock_threshold, manage_stock, status, is_available, created_at';

const PRODUCTS_COLUMNS =
  'id, name, slug, sku, description, category_id, price, sale_price, stock_quantity, low_stock_threshold, manage_stock, status, is_available, visual_preset, created_at, updated_at';

const CATEGORIES_GRID_COLUMNS = 'id, name, slug, description, is_active';

const PRODUCT_MEDIA_GRID_COLUMNS =
  'id, product_id, media_url, storage_path, media_type, sort_order';

const PRODUCT_MEDIA_COLUMNS =
  'id, product_id, media_url, storage_path, media_type, alt_text, sort_order, created_at';

// Controlos em memória contra cliques repetidos / submissões concorrentes da mesma encomenda
const inFlightOrderSubmissions = new Map<string, Promise<OrderSubmissionResult>>();
const completedOrderSubmissions = new Map<string, OrderSubmissionResult>();
const activeOrderIdempotencyKeys = new Map<string, string>();

async function recoverStorageMediaForProduct(sku: string, maxFiles = 1): Promise<string[]> {
  if (!supabase || !SUPABASE_PUBLIC_URL || !sku.trim()) {
    return [];
  }

  const candidateFolders = Array.from(
    new Set([`products/${sku.trim().toLowerCase()}`, `products/${sku.trim()}`])
  );

  for (const folder of candidateFolders) {
    const listRes = await supabase.storage
      .from(PRODUCT_MEDIA_BUCKET)
      .list(folder, { limit: maxFiles, sortBy: { column: 'name', order: 'asc' } });

    if (listRes.error || !listRes.data || listRes.data.length === 0) {
      continue;
    }

    const urls: string[] = [];
    for (const file of listRes.data) {
      if (!file.name || file.name.startsWith('.')) continue;
      const lower = file.name.toLowerCase();
      if (
        lower.endsWith('.jpg') ||
        lower.endsWith('.jpeg') ||
        lower.endsWith('.png') ||
        lower.endsWith('.webp') ||
        lower.endsWith('.avif')
      ) {
        const resolved = resolveProductMediaUrl(
          { storage_path: `${folder}/${file.name}`, media_url: null },
          SUPABASE_PUBLIC_URL
        );
        if (resolved) {
          urls.push(resolved);
          if (urls.length >= maxFiles) {
            break;
          }
        }
      }
    }

    if (urls.length > 0) {
      return urls;
    }
  }

  return [];
}

export interface ProductMediaGalleryResult {
  images: string[];
  video?: ProductVideo;
}

export async function fetchProductMediaGallery(
  productId: string,
  sku?: string
): Promise<ProductMediaGalleryResult | null> {
  const cleanId = productId.trim();
  if (!cleanId || !supabase || !SUPABASE_CONFIG_STATUS.configured) {
    return null;
  }

  try {
    let mediaRes = await supabase
      .from('product_media')
      .select(PRODUCT_MEDIA_COLUMNS)
      .eq('product_id', cleanId)
      .order('sort_order', { ascending: true });

    if (mediaRes.error && isMissingColumnOrSchemaCacheError(mediaRes.error)) {
      const fallbackMedia = await supabase
        .from('product_media')
        .select('*')
        .eq('product_id', cleanId);
      mediaRes = fallbackMedia as typeof mediaRes;
    }

    if (mediaRes.error) {
      return null;
    }

    const rawMedia = Array.isArray(mediaRes.data)
      ? (mediaRes.data as unknown as SupabaseProductMediaRow[])
      : [];

    const mapped = mapSupabaseProductToStoreProduct(
      {
        id: cleanId,
        name: 'Galeria',
        price: 0,
        status: 'active',
        is_available: true,
        product_media: rawMedia,
      },
      SUPABASE_PUBLIC_URL
    );

    let images = mapped?.images ?? [];
    const video = mapped?.video;

    if (images.length === 0 && sku?.trim()) {
      images = await recoverStorageMediaForProduct(sku, 10);
    }

    return { images, video };
  } catch {
    return null;
  }
}

function toPostgrestLikeError(
  error: { code?: string; message?: string; details?: string | null; hint?: string | null } | null,
  status?: number
): PostgrestLikeError | null {
  if (!error) return null;
  return {
    code: error.code,
    message: error.message,
    details: error.details,
    hint: error.hint,
    status,
  };
}

export async function fetchStorefrontCatalog(): Promise<StorefrontCatalogResponse> {
  const defaultSettings = createDefaultPublicStoreSettings();
  const defaultMarketingSettings = createDefaultMarketingSettings();
  const browserOffline = typeof navigator !== 'undefined' && navigator.onLine === false;

  if (!supabase || !SUPABASE_CONFIG_STATUS.configured) {
    if (typeof console !== 'undefined') {
      console.error(
        '[Bercali Store · Diagnóstico Catálogo]',
        buildCatalogTechnicalDiagnostic({
          configured: false,
          isOffline: browserOffline,
          table: 'public.products',
          supabaseHost: SUPABASE_CONFIG_STATUS.urlHost,
          urlSource: SUPABASE_CONFIG_STATUS.urlSource,
          keySource: SUPABASE_CONFIG_STATUS.keySource,
          keyKind: SUPABASE_CONFIG_STATUS.keyKind,
          keyLength: SUPABASE_CONFIG_STATUS.keyLength,
        })
      );
    }
    const classified = classifyCatalogError({
      configured: false,
      isOffline: browserOffline,
    });
    return {
      products: [],
      categories: [],
      storeSettings: defaultSettings,
      marketingSettings: defaultMarketingSettings,
      whatsappNumber: defaultSettings.whatsappNumber,
      deliveryFeeRules: defaultSettings.deliveryFeeRules,
      error: classified.userMessage,
      errorKind: classified.kind,
      accessNotice: null,
    };
  }

  try {
    const safeSettingsQuery = Promise.resolve(
      supabase.from('store_settings').select('*')
    ).catch(() => ({
      data: null,
      error: { code: 'SETTINGS_FETCH_FAILED', message: 'Falha ao ler store_settings' },
      status: 0,
    }));

    const safeMarketingQuery = Promise.resolve(
      supabase.from('marketing_settings').select('*')
    ).catch(() => ({
      data: null,
      error: { code: 'MARKETING_FETCH_FAILED', message: 'Falha ao ler marketing_settings' },
      status: 0,
    }));

    let [categoriesRes, productsRes, mediaRes, settingsRes, marketingRes] = await Promise.all([
      supabase
        .from('categories')
        .select(CATEGORIES_GRID_COLUMNS)
        .order('name', { ascending: true }),
      supabase
        .from('products')
        .select(PRODUCTS_GRID_COLUMNS)
        .order('created_at', { ascending: false }),
      supabase
        .from('product_media')
        .select(PRODUCT_MEDIA_GRID_COLUMNS)
        .order('sort_order', { ascending: true }),
      safeSettingsQuery,
      safeMarketingQuery,
    ]);

    // Fallback resiliente: se alguma coluna opcional não existir no esquema atual, repete com select('*')
    if (productsRes.error && isMissingColumnOrSchemaCacheError(productsRes.error)) {
      if (typeof console !== 'undefined') {
        console.warn('[Bercali Store · Diagnóstico Catálogo]', {
          category: 'SQL_QUERY_SCHEMA',
          table: 'public.products',
          supabaseHost: SUPABASE_CONFIG_STATUS.urlHost,
          code: productsRes.error.code,
          message: productsRes.error.message,
          fallback: 'A repetir consulta a public.products com select("*") por diferença de colunas.',
        });
      }
      const fallbackProducts = await supabase.from('products').select('*');
      productsRes = fallbackProducts as typeof productsRes;
    }

    if (categoriesRes.error && isMissingColumnOrSchemaCacheError(categoriesRes.error)) {
      const fallbackCategories = await supabase.from('categories').select('*');
      categoriesRes = fallbackCategories as typeof categoriesRes;
    }

    if (mediaRes.error && isMissingColumnOrSchemaCacheError(mediaRes.error)) {
      const fallbackMedia = await supabase.from('product_media').select('*');
      mediaRes = fallbackMedia as typeof mediaRes;
    }

    if (categoriesRes.error && typeof console !== 'undefined') {
      console.warn(
        '[Bercali Store · Diagnóstico Catálogo]',
        buildCatalogTechnicalDiagnostic({
          configured: true,
          table: 'public.categories',
          supabaseHost: SUPABASE_CONFIG_STATUS.urlHost,
          postgrestError: toPostgrestLikeError(categoriesRes.error, categoriesRes.status),
        })
      );
    }
    if (mediaRes.error && typeof console !== 'undefined') {
      console.warn(
        '[Bercali Store · Diagnóstico Catálogo]',
        buildCatalogTechnicalDiagnostic({
          configured: true,
          table: 'public.product_media',
          supabaseHost: SUPABASE_CONFIG_STATUS.urlHost,
          postgrestError: toPostgrestLikeError(mediaRes.error, mediaRes.status),
        })
      );
    }
    if (settingsRes.error && typeof console !== 'undefined') {
      console.warn(
        '[Bercali Store · Diagnóstico Catálogo]',
        buildCatalogTechnicalDiagnostic({
          configured: true,
          table: 'public.store_settings',
          supabaseHost: SUPABASE_CONFIG_STATUS.urlHost,
          postgrestError: toPostgrestLikeError(settingsRes.error, settingsRes.status),
        })
      );
    }
    if (marketingRes.error && typeof console !== 'undefined') {
      console.warn(
        '[Bercali Store · Diagnóstico Catálogo]',
        buildCatalogTechnicalDiagnostic({
          configured: true,
          table: 'public.marketing_settings',
          supabaseHost: SUPABASE_CONFIG_STATUS.urlHost,
          postgrestError: toPostgrestLikeError(marketingRes.error, marketingRes.status),
        })
      );
    }

    let storeSettings = defaultSettings;
    try {
      const rawSettings =
        !settingsRes.error && Array.isArray(settingsRes.data)
          ? (settingsRes.data as unknown as SupabaseStoreSettingRow[])
          : [];
      storeSettings = extractPublicStoreSettings(rawSettings, SUPABASE_PUBLIC_URL);
    } catch {
      storeSettings = defaultSettings;
    }

    let marketingSettings = defaultMarketingSettings;
    try {
      const rawMarketing =
        !marketingRes.error && Array.isArray(marketingRes.data)
          ? (marketingRes.data as unknown as Record<string, unknown>[])
          : [];
      marketingSettings = extractMarketingSettings(rawMarketing);
    } catch {
      marketingSettings = defaultMarketingSettings;
    }

    if (productsRes.error) {
      const pgError = toPostgrestLikeError(productsRes.error, productsRes.status);
      if (typeof console !== 'undefined') {
        console.error(
          '[Bercali Store · Diagnóstico Catálogo]',
          buildCatalogTechnicalDiagnostic({
            configured: true,
            isOffline: browserOffline,
            table: 'public.products',
            supabaseHost: SUPABASE_CONFIG_STATUS.urlHost,
            postgrestError: pgError,
          })
        );
      }
      const classified = classifyCatalogError({
        configured: true,
        isOffline: browserOffline,
        postgrestError: pgError,
      });
      return {
        products: [],
        categories: [],
        storeSettings,
        marketingSettings,
        whatsappNumber: storeSettings.whatsappNumber,
        deliveryFeeRules: storeSettings.deliveryFeeRules,
        error: classified.userMessage,
        errorKind: classified.kind,
        accessNotice: null,
      };
    }

    if (productsRes.data !== null && !Array.isArray(productsRes.data)) {
      const issue = `Resposta de public.products não é uma lista (tipo recebido: ${typeof productsRes.data}).`;
      if (typeof console !== 'undefined') {
        console.error(
          '[Bercali Store · Diagnóstico Catálogo]',
          buildCatalogTechnicalDiagnostic({
            configured: true,
            table: 'public.products',
            supabaseHost: SUPABASE_CONFIG_STATUS.urlHost,
            dataStructureIssue: issue,
          })
        );
      }
      return {
        products: [],
        categories: [],
        storeSettings,
        marketingSettings,
        whatsappNumber: storeSettings.whatsappNumber,
        deliveryFeeRules: storeSettings.deliveryFeeRules,
        error: PUBLIC_MESSAGES.catalogTemporaryError,
        errorKind: 'unavailable',
        accessNotice: null,
      };
    }

    const rawProducts = (productsRes.data ?? []) as unknown as SupabaseProductRow[];
    const rawCategories =
      !categoriesRes.error && Array.isArray(categoriesRes.data)
        ? (categoriesRes.data as unknown as SupabaseCategoryRow[])
        : [];
    const rawMedia =
      !mediaRes.error && Array.isArray(mediaRes.data)
        ? (mediaRes.data as unknown as SupabaseProductMediaRow[])
        : [];

    // Para a grelha inicial, hidrata apenas a imagem principal de capa de cada produto;
    // a galeria completa e eventual vídeo carregam sob pedido ao abrir a página do produto.
    const seenCoverProductIds = new Set<string>();
    const gridCoverMedia: SupabaseProductMediaRow[] = [];
    for (const media of rawMedia) {
      if (!media.product_id || seenCoverProductIds.has(media.product_id)) continue;
      const mType = (media.media_type ?? '').trim().toLowerCase();
      if (mType.startsWith('video')) continue;
      const resolvedUrl = resolveProductMediaUrl(media, SUPABASE_PUBLIC_URL);
      if (!resolvedUrl) continue;
      const cleanPath = resolvedUrl.split('?')[0].toLowerCase();
      if (cleanPath.endsWith('.mp4') || cleanPath.endsWith('.webm') || cleanPath.endsWith('.mov')) {
        continue;
      }
      seenCoverProductIds.add(media.product_id);
      gridCoverMedia.push(media);
    }

    const hydratedRows = attachRelationsToProducts(rawProducts, rawCategories, gridCoverMedia);

    const mappedProducts: Product[] = [];
    let malformedRowsCount = 0;

    for (const row of hydratedRows) {
      try {
        if (!row || typeof row !== 'object' || !row.id || !row.name) {
          malformedRowsCount += 1;
          continue;
        }
        const mapped = mapSupabaseProductToStoreProduct(row, SUPABASE_PUBLIC_URL);
        if (mapped) {
          mappedProducts.push(mapped);
        }
      } catch (rowError) {
        malformedRowsCount += 1;
        if (typeof console !== 'undefined') {
          console.warn(
            '[Bercali Store · Diagnóstico Catálogo]',
            buildCatalogTechnicalDiagnostic({
              configured: true,
              table: 'public.products',
              supabaseHost: SUPABASE_CONFIG_STATUS.urlHost,
              dataStructureIssue:
                rowError instanceof Error
                  ? rowError.message
                  : 'Erro ao converter registo individual de produto.',
            })
          );
        }
      }
    }

    if (malformedRowsCount > 0 && typeof console !== 'undefined') {
      console.warn(
        '[Bercali Store · Diagnóstico Catálogo]',
        buildCatalogTechnicalDiagnostic({
          configured: true,
          table: 'public.products',
          supabaseHost: SUPABASE_CONFIG_STATUS.urlHost,
          dataStructureIssue: `${malformedRowsCount} registo(s) ignorado(s) por campos obrigatórios em falta (id ou name).`,
        })
      );
    }

    const productsWithMedia = await Promise.all(
      mappedProducts.map(async (product) => {
        if (product.images.length > 0 || !product.sku) {
          return product;
        }
        const recoveredImages = await recoverStorageMediaForProduct(product.sku, 1);
        if (recoveredImages.length === 0) {
          return product;
        }
        return {
          ...product,
          images: recoveredImages,
        };
      })
    );

    const finalProducts = applyFeaturedSelection(productsWithMedia);
    const finalCategories = buildStoreCategories(rawCategories, finalProducts);

    if (rawProducts.length === 0) {
      const storageProbe = await supabase.storage
        .from(PRODUCT_MEDIA_BUCKET)
        .list('products', { limit: 1 });
      const hasUploadedProductAssets =
        !storageProbe.error && Array.isArray(storageProbe.data) && storageProbe.data.length > 0;

      if (typeof console !== 'undefined') {
        console.warn('[Bercali Store · Diagnóstico Catálogo]', {
          category: hasUploadedProductAssets ? 'RLS_PERMISSION' : 'SQL_QUERY_SCHEMA',
          supabaseHost: SUPABASE_CONFIG_STATUS.urlHost,
          rawProductsCount: 0,
          hasUploadedProductAssets,
          summary: hasUploadedProductAssets
            ? 'A consulta pública a public.products devolveu 0 linhas apesar de existirem imagens no bucket product-media. Verifica políticas SELECT RLS para o papel anon ou se os produtos estão publicados.'
            : 'A consulta pública a public.products devolveu 0 linhas neste projeto Supabase. Confirma se VITE_SUPABASE_URL aponta para o mesmo projeto do Painel Administrativo e se existem produtos ativos.',
        });
      }
    } else if (finalProducts.length === 0 && rawProducts.length > 0 && typeof console !== 'undefined') {
      console.info('[Bercali Store · Diagnóstico Catálogo]', {
        category: 'DATA_STRUCTURE',
        supabaseHost: SUPABASE_CONFIG_STATUS.urlHost,
        rawProductsCount: rawProducts.length,
        publishedProductsCount: 0,
        summary:
          'Foram lidos registos em public.products, mas todos se encontram não publicados (ex.: rascunho, inativo ou arquivado).',
      });
    }

    return {
      products: finalProducts,
      categories: finalCategories,
      storeSettings,
      marketingSettings,
      whatsappNumber: storeSettings.whatsappNumber,
      deliveryFeeRules: storeSettings.deliveryFeeRules,
      error: null,
      errorKind: 'none',
      accessNotice: null,
    };
  } catch (thrownError) {
    const offlineNow = typeof navigator !== 'undefined' && navigator.onLine === false;
    if (typeof console !== 'undefined') {
      console.error(
        '[Bercali Store · Diagnóstico Catálogo]',
        buildCatalogTechnicalDiagnostic({
          configured: true,
          isOffline: offlineNow,
          table: 'public.products',
          supabaseHost: SUPABASE_CONFIG_STATUS.urlHost,
          thrownError,
        })
      );
    }
    const classified = classifyCatalogError({
      configured: true,
      isOffline: offlineNow,
      thrownError,
    });
    return {
      products: [],
      categories: [],
      storeSettings: defaultSettings,
      marketingSettings: defaultMarketingSettings,
      whatsappNumber: defaultSettings.whatsappNumber,
      deliveryFeeRules: defaultSettings.deliveryFeeRules,
      error: classified.userMessage,
      errorKind: classified.kind,
      accessNotice: null,
    };
  }
}

function buildSubmissionIdempotencyKey(
  orderNumber: string,
  customer: CustomerCheckoutData,
  requestedItems: readonly CartItem[]
): string {
  const itemsSignature = requestedItems
    .map((item) => `${item.productId}:${Math.floor(item.quantity)}`)
    .sort()
    .join('|');
  return [
    orderNumber.trim(),
    customer.fullName.trim().toLowerCase(),
    customer.phone.replace(/\D/g, ''),
    (customer.deliveryZoneId ?? '').trim(),
    (customer.deliveryZone ?? '').trim().toLowerCase(),
    customer.province.trim().toLowerCase(),
    customer.municipality.trim().toLowerCase(),
    customer.neighborhood.trim().toLowerCase(),
    customer.addressReference.trim().toLowerCase(),
    itemsSignature,
  ].join('::');
}

function getOrCreateRpcIdempotencyKey(submissionSignature: string, orderNumber: string): string {
  const existing = activeOrderIdempotencyKeys.get(submissionSignature);
  if (existing) {
    return existing;
  }
  const uniqueKey = `${orderNumber.trim()}-${generateUuid()}`;
  activeOrderIdempotencyKeys.set(submissionSignature, uniqueKey);
  return uniqueKey;
}

function extractRpcResultDetails(
  rpcData: unknown,
  fallbackOrderNumber: string,
  fallbackOrderId: string
): { orderNumber: string; orderId: string } {
  if (typeof rpcData === 'string' && rpcData.trim()) {
    const trimmed = rpcData.trim();
    if (/^[A-Z]{2,5}-/i.test(trimmed)) {
      return { orderNumber: trimmed, orderId: fallbackOrderId };
    }
    return { orderNumber: fallbackOrderNumber, orderId: trimmed };
  }

  const topCandidate = Array.isArray(rpcData) && rpcData.length > 0 ? rpcData[0] : rpcData;
  if (typeof topCandidate === 'object' && topCandidate !== null) {
    const outer = topCandidate as Record<string, unknown>;
    const nested =
      typeof outer.order === 'object' && outer.order !== null
        ? (outer.order as Record<string, unknown>)
        : typeof outer.data === 'object' && outer.data !== null
        ? (outer.data as Record<string, unknown>)
        : null;
    const rec = nested ?? outer;

    const codeCandidates = [
      rec.order_number,
      rec.orderNumber,
      rec.order_code,
      rec.orderCode,
      rec.code,
      rec.number,
      outer.order_number,
      outer.orderNumber,
      outer.code,
    ];
    let returnedCode = fallbackOrderNumber;
    for (const c of codeCandidates) {
      if (typeof c === 'string' && c.trim()) {
        returnedCode = c.trim();
        break;
      }
    }

    const idCandidates = [
      rec.order_id,
      rec.orderId,
      rec.id,
      outer.order_id,
      outer.orderId,
      outer.id,
    ];
    let returnedId = fallbackOrderId;
    for (const idVal of idCandidates) {
      if (typeof idVal === 'string' && idVal.trim()) {
        returnedId = idVal.trim();
        break;
      }
    }

    return { orderNumber: returnedCode, orderId: returnedId };
  }

  return { orderNumber: fallbackOrderNumber, orderId: fallbackOrderId };
}

/**
 * Grava a encomenda na base de dados usando a função RPC `create_storefront_order`:
 * 1. Bloqueia duplicações por cliques repetidos (idempotência em voo e concluída).
 * 2. Revalida em tempo real o estado ativo/inativo da loja em `store_settings` e o stock/preço oficial.
 * 3. Executa `supabase.rpc('create_storefront_order', {...})` com os nomes e formatos exatos da função.
 */
export async function submitOrderToSupabase(
  customer: CustomerCheckoutData,
  summary: OrderSummaryCalculation,
  pregeneratedOrderNumber?: string
): Promise<OrderSubmissionResult> {
  const orderNumber = pregeneratedOrderNumber?.trim() || generateOrderNumber();

  const initialValidationErrors = validateCheckoutForm(customer, { mode: 'storefront' });
  if (hasValidationErrors(initialValidationErrors) || summary.lines.length === 0) {
    return {
      ok: false,
      status: 'error',
      orderNumber,
      errorMessage: 'Verifica o teu nome, número de telefone e os artigos do carrinho.',
    };
  }

  if (!supabase || !SUPABASE_CONFIG_STATUS.configured) {
    if (typeof console !== 'undefined') {
      console.error(
        '[Bercali Store · Diagnóstico Encomenda] Cliente público não inicializado ao submeter encomenda.'
      );
    }
    return {
      ok: false,
      status: 'unconfigured',
      orderNumber,
      errorMessage: PUBLIC_MESSAGES.orderRegistrationTemporaryError,
    };
  }

  const requestedItems: CartItem[] = summary.lines.map((line) => ({
    productId: line.product.id,
    quantity: line.quantity,
  }));

  const submissionSignature = buildSubmissionIdempotencyKey(orderNumber, customer, requestedItems);

  const alreadySaved = completedOrderSubmissions.get(submissionSignature);
  if (alreadySaved) {
    return alreadySaved;
  }

  const existingInFlight = inFlightOrderSubmissions.get(submissionSignature);
  if (existingInFlight) {
    return existingInFlight;
  }

  const rpcIdempotencyKey = getOrCreateRpcIdempotencyKey(submissionSignature, orderNumber);

  const executionPromise = (async (): Promise<OrderSubmissionResult> => {
    try {
      const productIds = Array.from(new Set(requestedItems.map((i) => i.productId)));

      const safeSettingsQuery = Promise.resolve(
        supabase.from('store_settings').select('*')
      ).catch(() => ({
        data: null,
        error: { code: 'SETTINGS_FETCH_FAILED', message: 'Falha ao ler store_settings' },
        status: 0,
      }));

      // 1. Revalidação do estado da loja, stock e preços reais no Supabase quando acessível
      let [liveProductsRes, liveSettingsRes] = await Promise.all([
        supabase.from('products').select(PRODUCTS_COLUMNS).in('id', productIds),
        safeSettingsQuery,
      ]);

      if (liveProductsRes.error && isMissingColumnOrSchemaCacheError(liveProductsRes.error)) {
        const fallbackLiveProducts = await supabase
          .from('products')
          .select('*')
          .in('id', productIds);
        liveProductsRes = fallbackLiveProducts as typeof liveProductsRes;
      }

      const liveSettingsRows =
        !liveSettingsRes.error && Array.isArray(liveSettingsRes.data)
          ? (liveSettingsRes.data as unknown as SupabaseStoreSettingRow[])
          : [];

      let effectiveSummary = summary;
      let effectiveStoreSettings = extractPublicStoreSettings(
        liveSettingsRows,
        SUPABASE_PUBLIC_URL
      );

      if (liveProductsRes.error) {
        if (typeof console !== 'undefined') {
          console.warn(
            '[Bercali Store · Diagnóstico Encomenda] Aviso na pré-verificação de produtos (a prosseguir para create_storefront_order):',
            {
              code: liveProductsRes.error.code ?? null,
              message: liveProductsRes.error.message ?? null,
              details: liveProductsRes.error.details ?? null,
            }
          );
        }
      } else {
        const liveProducts = (liveProductsRes.data ?? []) as unknown as SupabaseProductRow[];
        const verification = verifyAndRecalculateOrder({
          requestedItems,
          customer,
          liveProductRows: liveProducts,
          liveSettingsRows,
          supabaseUrl: SUPABASE_PUBLIC_URL,
        });

        effectiveStoreSettings = verification.storeSettings;

        if (!verification.ok) {
          activeOrderIdempotencyKeys.delete(submissionSignature);
          return {
            ok: false,
            status: verification.reason,
            orderNumber,
            errorMessage: verification.message,
          };
        }

        effectiveSummary = verification.verifiedSummary;
      }

      const zoneErrors = validateCheckoutForm(customer, {
        mode: 'storefront',
        deliveryZones: effectiveStoreSettings.deliveryFeeRules,
      });
      if (hasValidationErrors(zoneErrors)) {
        activeOrderIdempotencyKeys.delete(submissionSignature);
        return {
          ok: false,
          status: 'error',
          orderNumber,
          errorMessage:
            zoneErrors.province ??
            zoneErrors.deliveryZone ??
            'Seleciona a província de entrega antes de confirmar.',
        };
      }

      const fallbackOrderId = generateUuid();
      const rpcArgs = buildCreateStorefrontOrderRpcArgs({
        customer,
        summary: effectiveSummary,
        idempotencyKey: rpcIdempotencyKey,
        deliveryZones: effectiveStoreSettings.deliveryFeeRules,
      });

      // 2. Chamada RPC exata a `create_storefront_order`
      const rpcRes = await supabase.rpc('create_storefront_order', rpcArgs);

      if (rpcRes.error) {
        activeOrderIdempotencyKeys.delete(submissionSignature);

        if (typeof console !== 'undefined') {
          console.error('[Bercali Store · Checkout RPC Error]', {
            code: rpcRes.error.code ?? null,
            message: rpcRes.error.message ?? null,
            details: rpcRes.error.details ?? null,
          });
        }

        const classified = classifyCheckoutRpcError(
          rpcRes.error,
          effectiveStoreSettings.closedMessage
        );

        return {
          ok: false,
          status: classified.status,
          orderNumber,
          errorCode: rpcRes.error.code,
          errorMessage:
            classified.isBusinessRule && classified.serverMessage
              ? classified.serverMessage
              : PUBLIC_MESSAGES.orderRegistrationTemporaryError,
          verifiedSummary: effectiveSummary,
        };
      }

      // Caso a função devolva erro de negócio estruturado em JSON com HTTP 200
      if (
        typeof rpcRes.data === 'object' &&
        rpcRes.data !== null &&
        !Array.isArray(rpcRes.data) &&
        ((rpcRes.data as Record<string, unknown>).ok === false ||
          (rpcRes.data as Record<string, unknown>).success === false)
      ) {
        activeOrderIdempotencyKeys.delete(submissionSignature);
        const errPayload = rpcRes.data as Record<string, unknown>;
        const payloadCode =
          typeof errPayload.code === 'string' ? errPayload.code : 'BUSINESS_RULE_ERROR';
        const payloadMsg =
          typeof errPayload.message === 'string'
            ? errPayload.message
            : typeof errPayload.error === 'string'
            ? errPayload.error
            : '';
        const payloadDetails =
          typeof errPayload.details === 'string' ? errPayload.details : null;

        if (typeof console !== 'undefined') {
          console.error('[Bercali Store · Checkout RPC Error]', {
            code: payloadCode,
            message: payloadMsg || null,
            details: payloadDetails,
          });
        }

        const classified = classifyCheckoutRpcError(
          { code: payloadCode, message: payloadMsg, details: payloadDetails },
          effectiveStoreSettings.closedMessage
        );

        return {
          ok: false,
          status: classified.status,
          orderNumber,
          errorCode: payloadCode,
          errorMessage:
            classified.isBusinessRule && classified.serverMessage
              ? classified.serverMessage
              : PUBLIC_MESSAGES.orderRegistrationTemporaryError,
          verifiedSummary: effectiveSummary,
        };
      }

      const resolved = extractRpcResultDetails(rpcRes.data, orderNumber, fallbackOrderId);

      const successResult: OrderSubmissionResult = {
        ok: true,
        status: 'saved',
        orderNumber: resolved.orderNumber,
        orderId: resolved.orderId,
        verifiedSummary: effectiveSummary,
        storeSettings:
          !liveSettingsRes.error && Array.isArray(liveSettingsRes.data)
            ? effectiveStoreSettings
            : undefined,
      };
      completedOrderSubmissions.set(submissionSignature, successResult);
      return successResult;
    } catch (thrownError) {
      const thrownMessage =
        thrownError instanceof Error
          ? thrownError.message
          : typeof thrownError === 'string'
          ? thrownError
          : 'Erro de ligação desconhecido';
      if (typeof console !== 'undefined') {
        console.error('[Bercali Store · Checkout RPC Error]', {
          code: 'NETWORK_ERROR',
          message: thrownMessage,
          details: null,
        });
      }
      return {
        ok: false,
        status: 'error',
        orderNumber,
        errorMessage: PUBLIC_MESSAGES.orderRegistrationNetworkError,
      };
    } finally {
      inFlightOrderSubmissions.delete(submissionSignature);
    }
  })();

  inFlightOrderSubmissions.set(submissionSignature, executionPromise);
  return executionPromise;
}

