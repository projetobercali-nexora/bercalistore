import { supabase, SUPABASE_CONFIG_STATUS, SUPABASE_PUBLIC_URL } from '../lib/supabase';
import type {
  CartItem,
  CustomerCheckoutData,
  DeliveryFeeRule,
  OrderSubmissionResult,
  OrderSummaryCalculation,
  Product,
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
  buildStoreCategories,
  buildSupabaseOrderPayloads,
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

const PRODUCTS_COLUMNS =
  'id, name, slug, sku, description, category_id, price, sale_price, stock_quantity, low_stock_threshold, manage_stock, status, is_available, visual_preset, created_at, updated_at';

const CATEGORIES_COLUMNS =
  'id, name, slug, description, is_active, created_at, updated_at';

const PRODUCT_MEDIA_COLUMNS =
  'id, product_id, media_url, storage_path, media_type, alt_text, sort_order, created_at';

// Controlos em memória contra cliques repetidos / submissões concorrentes da mesma encomenda
const inFlightOrderSubmissions = new Map<string, Promise<OrderSubmissionResult>>();
const completedOrderSubmissions = new Map<string, OrderSubmissionResult>();

async function recoverStorageMediaForProduct(sku: string): Promise<string[]> {
  if (!supabase || !SUPABASE_PUBLIC_URL || !sku.trim()) {
    return [];
  }

  const candidateFolders = Array.from(
    new Set([`products/${sku.trim().toLowerCase()}`, `products/${sku.trim()}`])
  );

  for (const folder of candidateFolders) {
    const listRes = await supabase.storage
      .from(PRODUCT_MEDIA_BUCKET)
      .list(folder, { limit: 10, sortBy: { column: 'name', order: 'asc' } });

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
        }
      }
    }

    if (urls.length > 0) {
      return urls;
    }
  }

  return [];
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
        .select(CATEGORIES_COLUMNS)
        .order('name', { ascending: true }),
      supabase
        .from('products')
        .select(PRODUCTS_COLUMNS)
        .order('created_at', { ascending: false }),
      supabase
        .from('product_media')
        .select(PRODUCT_MEDIA_COLUMNS)
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

    const hydratedRows = attachRelationsToProducts(rawProducts, rawCategories, rawMedia);

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
        const recoveredImages = await recoverStorageMediaForProduct(product.sku);
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

function isMissingRpcError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === 'PGRST202' || error.code === '42883') return true;
  const msg = (error.message ?? '').toLowerCase();
  return msg.includes('could not find the function') || msg.includes('does not exist');
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
    (customer.deliveryZone ?? '').trim().toLowerCase(),
    customer.province.trim().toLowerCase(),
    customer.municipality.trim().toLowerCase(),
    customer.neighborhood.trim().toLowerCase(),
    itemsSignature,
  ].join('::');
}

function extractRpcResultDetails(
  rpcData: unknown,
  fallbackOrderNumber: string,
  fallbackOrderId: string
): { orderNumber: string; orderId: string } {
  if (typeof rpcData === 'string' && rpcData.trim()) {
    const trimmed = rpcData.trim();
    // Se a função devolver um código legível (ex.: BRC-... ou ORD-...), usa-o como orderNumber
    if (/^[A-Z]{2,5}-/i.test(trimmed)) {
      return { orderNumber: trimmed, orderId: fallbackOrderId };
    }
    return { orderNumber: fallbackOrderNumber, orderId: trimmed };
  }

  const candidateObj = Array.isArray(rpcData) && rpcData.length > 0 ? rpcData[0] : rpcData;
  if (typeof candidateObj === 'object' && candidateObj !== null) {
    const rec = candidateObj as Record<string, unknown>;
    const returnedCode =
      typeof rec.order_number === 'string' && rec.order_number.trim()
        ? rec.order_number.trim()
        : typeof rec.order_code === 'string' && rec.order_code.trim()
        ? rec.order_code.trim()
        : typeof rec.code === 'string' && rec.code.trim()
        ? rec.code.trim()
        : fallbackOrderNumber;
    const returnedId =
      typeof rec.order_id === 'string' && rec.order_id.trim()
        ? rec.order_id.trim()
        : typeof rec.id === 'string' && rec.id.trim()
        ? rec.id.trim()
        : fallbackOrderId;
    return { orderNumber: returnedCode, orderId: returnedId };
  }

  return { orderNumber: fallbackOrderNumber, orderId: fallbackOrderId };
}

/**
 * Grava a encomenda na base de dados usando a função RPC `create_storefront_order`:
 * 1. Bloqueia duplicações por cliques repetidos (idempotência em voo e concluída).
 * 2. Revalida em tempo real o estado ativo/inativo da loja em `store_settings` e o stock/preço oficial.
 * 3. Executa a função RPC `create_storefront_order` com a chave pública `anon` e só confirma sucesso
 *    quando a gravação na base de dados terminar sem erro.
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

  const idempotencyKey = buildSubmissionIdempotencyKey(orderNumber, customer, requestedItems);

  const alreadySaved = completedOrderSubmissions.get(idempotencyKey);
  if (alreadySaved) {
    return alreadySaved;
  }

  const existingInFlight = inFlightOrderSubmissions.get(idempotencyKey);
  if (existingInFlight) {
    return existingInFlight;
  }

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

      // 1. Revalidação autoritativa do estado da loja, stock e preços reais no Supabase
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

      if (liveProductsRes.error) {
        if (typeof console !== 'undefined') {
          console.error(
            '[Bercali Store · Diagnóstico Encomenda]',
            buildCatalogTechnicalDiagnostic({
              configured: true,
              table: 'public.products',
              supabaseHost: SUPABASE_CONFIG_STATUS.urlHost,
              postgrestError: toPostgrestLikeError(liveProductsRes.error, liveProductsRes.status),
            })
          );
        }
        return {
          ok: false,
          status: 'error',
          orderNumber,
          errorCode: liveProductsRes.error.code,
          errorMessage: PUBLIC_MESSAGES.orderRegistrationTemporaryError,
        };
      }

      const liveProducts = (liveProductsRes.data ?? []) as unknown as SupabaseProductRow[];
      const liveSettings =
        !liveSettingsRes.error && Array.isArray(liveSettingsRes.data)
          ? (liveSettingsRes.data as unknown as SupabaseStoreSettingRow[])
          : [];

      const verification = verifyAndRecalculateOrder({
        requestedItems,
        customer,
        liveProductRows: liveProducts,
        liveSettingsRows: liveSettings,
        supabaseUrl: SUPABASE_PUBLIC_URL,
      });

      if (!verification.ok) {
        return {
          ok: false,
          status: verification.reason,
          orderNumber,
          errorMessage: verification.message,
        };
      }

      const zoneErrors = validateCheckoutForm(customer, {
        mode: 'storefront',
        deliveryZones: verification.storeSettings.deliveryFeeRules,
      });
      if (hasValidationErrors(zoneErrors)) {
        return {
          ok: false,
          status: 'error',
          orderNumber,
          errorMessage: zoneErrors.deliveryZone ?? 'Seleciona a zona de entrega antes de confirmar.',
        };
      }

      const verifiedSummary = verification.verifiedSummary;
      const customerId = generateUuid();
      const orderId = generateUuid();
      const { customerRow, orderRow, orderItemRows } = buildSupabaseOrderPayloads({
        customerId,
        orderId,
        orderNumber,
        customer,
        summary: verifiedSummary,
      });

      const rpcItems = orderItemRows.map((item) => ({
        product_id: item.product_id,
        product_name: item.product_name,
        product_sku: item.product_sku,
        quantity: item.quantity,
        unit_price: item.unit_price,
        line_total: item.line_total,
      }));

      // 2. Gravação transacional atómica via RPC `create_storefront_order`
      const baseRpcArgs = {
        p_order_number: orderRow.order_number,
        p_full_name: customerRow.full_name,
        p_phone: customerRow.phone,
        p_city: customerRow.city,
        p_customer_notes: customerRow.notes,
        p_delivery_address: orderRow.delivery_address,
        p_internal_notes: orderRow.internal_notes,
        p_subtotal: orderRow.subtotal,
        p_delivery_fee: orderRow.delivery_fee,
        p_discount_amount: orderRow.discount_amount,
        p_total_amount: orderRow.total_amount,
        p_currency: orderRow.currency,
        p_items: rpcItems,
      };

      let rpcRes = await supabase.rpc('create_storefront_order', {
        ...baseRpcArgs,
        p_email: customerRow.email,
      });

      // Compatibilidade caso a função RPC tenha sido criada sem `p_email` ou com assinatura compacta do painel
      if (rpcRes.error && isMissingRpcError(rpcRes.error)) {
        rpcRes = await supabase.rpc('create_storefront_order', baseRpcArgs);
      }

      if (rpcRes.error && isMissingRpcError(rpcRes.error)) {
        const zoneText = (customer.deliveryZone ?? '').trim() || customerRow.city || null;
        rpcRes = await supabase.rpc('create_storefront_order', {
          p_customer_name: customerRow.full_name,
          p_customer_phone: customerRow.phone,
          p_delivery_zone: zoneText,
          p_delivery_address: orderRow.delivery_address,
          p_notes: customerRow.notes,
          p_delivery_fee: orderRow.delivery_fee,
          p_items: rpcItems,
        });
      }

      if (!rpcRes.error) {
        const resolved = extractRpcResultDetails(rpcRes.data, orderNumber, orderId);

        const successResult: OrderSubmissionResult = {
          ok: true,
          status: 'saved',
          orderNumber: resolved.orderNumber,
          orderId: resolved.orderId,
          verifiedSummary,
        };
        completedOrderSubmissions.set(idempotencyKey, successResult);
        return successResult;
      }

      const errMsg = rpcRes.error.message ?? '';
      if (errMsg.includes('LOJA_ENCERRADA')) {
        return {
          ok: false,
          status: 'store_closed',
          orderNumber,
          errorCode: rpcRes.error.code,
          errorMessage:
            errMsg.replace(/^LOJA_ENCERRADA:\s*/i, '').trim() ||
            verification.storeSettings.closedMessage,
        };
      }
      if (errMsg.includes('STOCK_INSUFICIENTE') || errMsg.includes('PRODUTO_INDISPONIVEL')) {
        return {
          ok: false,
          status: 'stock_conflict',
          orderNumber,
          errorCode: rpcRes.error.code,
          errorMessage: errMsg
            .replace(/^(STOCK_INSUFICIENTE|PRODUTO_INDISPONIVEL):\s*/i, '')
            .trim(),
        };
      }
      if (rpcRes.error.code === '42501') {
        if (typeof console !== 'undefined') {
          console.error(
            '[Bercali Store · Diagnóstico Encomenda] Permissão pendente na função create_storefront_order:',
            rpcRes.error
          );
        }
        return {
          ok: false,
          status: 'rls_blocked',
          orderNumber,
          errorCode: '42501',
          errorMessage: PUBLIC_MESSAGES.orderRegistrationTemporaryError,
        };
      }

      if (typeof console !== 'undefined') {
        console.error('[Bercali Store · Diagnóstico Encomenda] Erro RPC:', rpcRes.error);
      }
      return {
        ok: false,
        status: 'error',
        orderNumber,
        errorCode: rpcRes.error.code,
        errorMessage: PUBLIC_MESSAGES.orderRegistrationTemporaryError,
      };
    } catch (thrownError) {
      if (typeof console !== 'undefined') {
        console.error(
          '[Bercali Store · Diagnóstico Encomenda] Falha de rede ao submeter encomenda:',
          thrownError
        );
      }
      return {
        ok: false,
        status: 'error',
        orderNumber,
        errorMessage: PUBLIC_MESSAGES.orderRegistrationNetworkError,
      };
    } finally {
      inFlightOrderSubmissions.delete(idempotencyKey);
    }
  })();

  inFlightOrderSubmissions.set(idempotencyKey, executionPromise);
  return executionPromise;
}
