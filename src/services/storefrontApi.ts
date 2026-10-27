import { supabase, SUPABASE_CONFIG_STATUS, SUPABASE_PUBLIC_URL } from '../lib/supabase';
import type {
  CartItem,
  CustomerCheckoutData,
  DeliveryFeeRule,
  OrderSubmissionResult,
  OrderSummaryCalculation,
  Product,
  PublicStoreSettings,
  StoreCategory,
} from '../types/store';
import { hasValidationErrors, validateCheckoutForm } from '../utils/checkout';
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
      whatsappNumber: defaultSettings.whatsappNumber,
      deliveryFeeRules: defaultSettings.deliveryFeeRules,
      error: classified.userMessage,
      errorKind: classified.kind,
      accessNotice: null,
    };
  }

  try {
    let [categoriesRes, productsRes, mediaRes, settingsRes] = await Promise.all([
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
      supabase.from('store_settings').select('setting_key, setting_value'),
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

    const rawSettings =
      !settingsRes.error && Array.isArray(settingsRes.data)
        ? (settingsRes.data as unknown as SupabaseStoreSettingRow[])
        : [];
    const storeSettings = extractPublicStoreSettings(rawSettings, SUPABASE_PUBLIC_URL);

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
    customer.province.trim().toLowerCase(),
    customer.municipality.trim().toLowerCase(),
    customer.neighborhood.trim().toLowerCase(),
    itemsSignature,
  ].join('::');
}

/**
 * Grava a encomenda no mesmo projeto Supabase do Painel Administrativo com segurança reforçada:
 * 1. Bloqueia duplicações por cliques repetidos (idempotência em voo e concluída).
 * 2. Revalida em tempo real o estado ativo/inativo da loja em `store_settings` antes de aceitar o registo.
 * 3. Recalcula preços unitários, stock, disponibilidade e taxas de entrega diretamente a partir dos dados
 *    oficiais atuais do Supabase, sem confiar nos preços enviados pelo navegador.
 * 4. Executa preferencialmente a função transacional `create_storefront_order` (que valida novamente na BD)
 *    com fallback seguro para inserção direta (`return=minimal`), nunca expondo encomendas ou dados de terceiros.
 */
export async function submitOrderToSupabase(
  customer: CustomerCheckoutData,
  summary: OrderSummaryCalculation,
  pregeneratedOrderNumber?: string
): Promise<OrderSubmissionResult> {
  const orderNumber = pregeneratedOrderNumber?.trim() || generateOrderNumber();

  const validationErrors = validateCheckoutForm(customer);
  if (hasValidationErrors(validationErrors) || summary.lines.length === 0) {
    return {
      ok: false,
      status: 'error',
      orderNumber,
      errorMessage: 'Verifica os dados obrigatórios do cliente e os artigos do carrinho.',
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

      // 1. Revalidação autoritativa do estado da loja, stock e preços reais no Supabase
      let [liveProductsRes, liveSettingsRes] = await Promise.all([
        supabase.from('products').select(PRODUCTS_COLUMNS).in('id', productIds),
        supabase.from('store_settings').select('setting_key, setting_value'),
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
      const liveSettings = liveSettingsRes.error
        ? []
        : ((liveSettingsRes.data ?? []) as unknown as SupabaseStoreSettingRow[]);

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

      // 2. Tentativa transacional atómica via RPC `create_storefront_order`
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
        p_items: orderItemRows.map((item) => ({
          product_id: item.product_id,
          product_name: item.product_name,
          product_sku: item.product_sku,
          quantity: item.quantity,
          unit_price: item.unit_price,
          line_total: item.line_total,
        })),
      };

      let rpcRes = await supabase.rpc('create_storefront_order', {
        ...baseRpcArgs,
        p_email: customerRow.email,
      });

      // Compatibilidade caso a função RPC existente tenha sido criada sem o parâmetro opcional `p_email`
      if (rpcRes.error && isMissingRpcError(rpcRes.error)) {
        rpcRes = await supabase.rpc('create_storefront_order', baseRpcArgs);
      }

      if (!rpcRes.error) {
        const rpcData = rpcRes.data;
        const returnedOrderId =
          typeof rpcData === 'string' && rpcData.trim()
            ? rpcData.trim()
            : typeof rpcData === 'object' &&
              rpcData !== null &&
              typeof (rpcData as Record<string, unknown>).order_id === 'string'
            ? ((rpcData as Record<string, unknown>).order_id as string)
            : orderId;

        const successResult: OrderSubmissionResult = {
          ok: true,
          status: 'saved',
          orderNumber,
          orderId: returnedOrderId,
          verifiedSummary,
        };
        completedOrderSubmissions.set(idempotencyKey, successResult);
        return successResult;
      }

      if (!isMissingRpcError(rpcRes.error)) {
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
      }

      // 3. Fallback de inserção direta nas tabelas reais (sem .select() para respeitar privacidade de clientes/encomendas)
      let effectiveCustomerId: string | null = customerId;
      let customerInsert = await supabase.from('customers').insert(customerRow);

      if (customerInsert.error?.code === '23514' || customerInsert.error?.code === '42703') {
        customerInsert = await supabase.from('customers').insert({
          id: customerRow.id,
          full_name: customerRow.full_name,
          phone: customerRow.phone,
          city: customerRow.city,
          notes: customerRow.notes,
        });
      }

      if (customerInsert.error) {
        if (customerInsert.error.code === '42501') {
          if (typeof console !== 'undefined') {
            console.error(
              '[Bercali Store · Diagnóstico Encomenda] Permissão pendente ao inserir em customers:',
              customerInsert.error
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
        if (customerInsert.error.code === '23505') {
          effectiveCustomerId = null;
        } else {
          if (typeof console !== 'undefined') {
            console.error(
              '[Bercali Store · Diagnóstico Encomenda] Erro ao inserir em customers:',
              customerInsert.error
            );
          }
          return {
            ok: false,
            status: 'error',
            orderNumber,
            errorCode: customerInsert.error.code,
            errorMessage: PUBLIC_MESSAGES.orderRegistrationTemporaryError,
          };
        }
      }

      const orderPayloadWithCustomer = {
        ...orderRow,
        customer_id: effectiveCustomerId,
      };

      let orderInsert = await supabase.from('orders').insert(orderPayloadWithCustomer);

      if (orderInsert.error?.code === '23514') {
        orderInsert = await supabase.from('orders').insert({
          id: orderRow.id,
          order_number: orderRow.order_number,
          customer_id: effectiveCustomerId,
          delivery_address: orderRow.delivery_address,
          internal_notes: orderRow.internal_notes,
          subtotal: orderRow.subtotal,
          delivery_fee: orderRow.delivery_fee,
          discount_amount: orderRow.discount_amount,
          total_amount: orderRow.total_amount,
        });
      }

      if (orderInsert.error) {
        if (orderInsert.error.code === '42501') {
          if (typeof console !== 'undefined') {
            console.error(
              '[Bercali Store · Diagnóstico Encomenda] Permissão pendente ao inserir em orders:',
              orderInsert.error
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
        if (orderInsert.error.code === '23505') {
          const dedupResult: OrderSubmissionResult = {
            ok: true,
            status: 'saved',
            orderNumber,
            orderId,
            verifiedSummary,
          };
          completedOrderSubmissions.set(idempotencyKey, dedupResult);
          return dedupResult;
        }
        if (typeof console !== 'undefined') {
          console.error(
            '[Bercali Store · Diagnóstico Encomenda] Erro ao inserir em orders:',
            orderInsert.error
          );
        }
        return {
          ok: false,
          status: 'error',
          orderNumber,
          errorCode: orderInsert.error.code,
          errorMessage: PUBLIC_MESSAGES.orderRegistrationTemporaryError,
        };
      }

      const itemsInsert = await supabase.from('order_items').insert(orderItemRows);

      if (itemsInsert.error) {
        if (itemsInsert.error.code === '42501') {
          if (typeof console !== 'undefined') {
            console.error(
              '[Bercali Store · Diagnóstico Encomenda] Permissão pendente ao inserir em order_items:',
              itemsInsert.error
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
          console.error(
            '[Bercali Store · Diagnóstico Encomenda] Erro ao inserir em order_items:',
            itemsInsert.error
          );
        }
        return {
          ok: false,
          status: 'error',
          orderNumber,
          errorCode: itemsInsert.error.code,
          errorMessage: PUBLIC_MESSAGES.orderRegistrationTemporaryError,
        };
      }

      const savedResult: OrderSubmissionResult = {
        ok: true,
        status: 'saved',
        orderNumber,
        orderId,
        verifiedSummary,
      };
      completedOrderSubmissions.set(idempotencyKey, savedResult);
      return savedResult;
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
