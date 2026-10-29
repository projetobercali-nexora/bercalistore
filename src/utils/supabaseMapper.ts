import { DELIVERY_FEE_RULES, STORE_CONFIG, WHATSAPP_NUMBER } from '../config/store';
import type {
  AvailabilityStatus,
  CartItem,
  CustomerCheckoutData,
  DeliveryFeeRule,
  OrderSummaryCalculation,
  Product,
  ProductVideo,
  PublicStoreSettings,
  StoreCategory,
  StoreHeroConfig,
  StorePromoBanner,
  StoreSocialLinks,
  ValidatedCartLine,
} from '../types/store';
import {
  calculateOrderSummary,
  isValidEmailAddress,
  isValidWhatsAppNumber,
  normalizeWhatsAppNumber,
} from './checkout';
import { isProductPurchasable, slugifyCategory } from './format';

export const PRODUCT_MEDIA_BUCKET = 'product-media';

export const DEFAULT_CLOSED_STORE_MESSAGE =
  'A loja encontra-se temporariamente encerrada para novas encomendas. Voltaremos em breve.';

/**
 * Interfaces alinhadas exatamente com as tabelas e colunas reais existentes no Supabase:
 * - categories: id, name, slug, description, is_active, created_at, updated_at
 * - products: id, name, slug, sku, description, category_id, price, sale_price,
 *             stock_quantity, low_stock_threshold, manage_stock, is_available, status, visual_preset, created_at, updated_at
 * - product_media: id, product_id, media_url, storage_path, media_type, alt_text, sort_order, created_at
 * - store_settings: id, setting_key, setting_value, updated_by, updated_at
 * - customers: id, full_name, phone, email, city, notes, status, source, created_at, updated_at
 * - orders: id, order_number, customer_id, delivery_address, internal_notes, status,
 *           payment_status, source, subtotal, delivery_fee, discount_amount, total_amount, currency
 * - order_items: id, order_id, product_id, product_name, product_sku, quantity, unit_price, line_total
 */

export interface SupabaseCategoryRow {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  is_active?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface SupabaseProductMediaRow {
  id: string;
  product_id: string;
  media_url?: string | null;
  storage_path?: string | null;
  media_type?: string | null;
  alt_text?: string | null;
  sort_order?: number | null;
  created_at?: string | null;
}

export interface SupabaseProductRow {
  id: string;
  name: string;
  slug?: string | null;
  sku?: string | null;
  description?: string | null;
  category_id?: string | null;
  price: number | string | null;
  sale_price?: number | string | null;
  stock_quantity?: number | null;
  low_stock_threshold?: number | null;
  manage_stock?: boolean | null;
  status?: string | null;
  is_available?: boolean | null;
  visual_preset?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  categories?: SupabaseCategoryRow | SupabaseCategoryRow[] | null;
  product_media?: SupabaseProductMediaRow[] | null;
}

export interface SupabaseStoreSettingRow {
  setting_key?: string;
  setting_value?: unknown;
  [key: string]: unknown;
}

export interface SupabaseCustomerInsert {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  city: string;
  notes: string | null;
  source: string;
}

export interface SupabaseOrderInsert {
  id: string;
  order_number: string;
  customer_id: string | null;
  delivery_address: string;
  internal_notes: string;
  status: string;
  payment_status: string;
  source: string;
  subtotal: number;
  delivery_fee: number;
  discount_amount: number;
  total_amount: number;
  currency: string;
}

export interface SupabaseOrderItemInsert {
  order_id: string;
  product_id: string;
  product_name: string;
  product_sku: string | null;
  quantity: number;
  unit_price: number;
  line_total: number;
}

const UNPUBLISHED_STATUSES = new Set([
  'draft',
  'rascunho',
  'archived',
  'arquivado',
  'inactive',
  'inativo',
  'unpublished',
  'nao_publicado',
  'não_publicado',
  'hidden',
  'oculto',
  'deleted',
  'eliminado',
]);

const OUT_OF_STOCK_STATUSES = new Set([
  'out_of_stock',
  'out-of-stock',
  'esgotado',
  'sem_stock',
  'sem-stock',
]);

const TEMP_UNAVAILABLE_STATUSES = new Set([
  'unavailable',
  'temporarily_unavailable',
  'indisponivel',
  'indisponível',
  'paused',
  'pausado',
]);

const STORE_CLOSED_STATUS_WORDS = new Set([
  'inactive',
  'inativa',
  'inativo',
  'closed',
  'encerrada',
  'encerrado',
  'fechada',
  'fechado',
  'paused',
  'pausada',
  'pausado',
  'maintenance',
  'manutencao',
  'manutenção',
  'offline',
  'disabled',
  'desativada',
  'desativado',
]);

const STORE_OPEN_STATUS_WORDS = new Set([
  'active',
  'ativa',
  'ativo',
  'open',
  'aberta',
  'aberto',
  'online',
  'enabled',
]);

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export function createDefaultPublicStoreSettings(): PublicStoreSettings {
  return {
    brandName: STORE_CONFIG.brandName,
    slogan: STORE_CONFIG.slogan,
    description: null,
    logoUrl: null,
    isStoreActive: true,
    closedMessage: DEFAULT_CLOSED_STORE_MESSAGE,
    whatsappNumber: WHATSAPP_NUMBER,
    whatsappMessageTemplate: null,
    whatsappOrderTemplate: null,
    phone: null,
    email: null,
    address: null,
    socialLinks: {},
    deliveryInfo: STORE_CONFIG.deliveryInfo,
    paymentInfo: STORE_CONFIG.paymentInfo,
    orderDisclaimer: STORE_CONFIG.orderDisclaimer,
    freeDeliveryThresholdKz: null,
    defaultDeliveryFeeKz: null,
    deliveryFeeRules: [...DELIVERY_FEE_RULES],
    promoBanner: null,
    heroConfig: null,
  };
}

export function isPublishedProductRow(row: Pick<SupabaseProductRow, 'status'>): boolean {
  if (typeof row.status !== 'string' || !row.status.trim()) {
    return true;
  }
  const normalized = row.status.trim().toLowerCase();
  return !UNPUBLISHED_STATUSES.has(normalized);
}

export function attachRelationsToProducts(
  productRows: readonly SupabaseProductRow[],
  categoryRows: readonly SupabaseCategoryRow[],
  mediaRows: readonly SupabaseProductMediaRow[]
): SupabaseProductRow[] {
  const categoryById = new Map<string, SupabaseCategoryRow>();
  for (const cat of categoryRows) {
    if (cat.id) {
      categoryById.set(cat.id, cat);
    }
  }

  const mediaByProductId = new Map<string, SupabaseProductMediaRow[]>();
  for (const media of mediaRows) {
    if (!media.product_id) continue;
    const list = mediaByProductId.get(media.product_id);
    if (list) {
      list.push(media);
    } else {
      mediaByProductId.set(media.product_id, [media]);
    }
  }

  return productRows.map((row) => {
    const existingCategory = Array.isArray(row.categories) ? row.categories[0] : row.categories;
    const resolvedCategory =
      existingCategory ?? (row.category_id ? categoryById.get(row.category_id) ?? null : null);

    const existingMedia =
      Array.isArray(row.product_media) && row.product_media.length > 0
        ? row.product_media
        : mediaByProductId.get(row.id) ?? [];

    return {
      ...row,
      categories: resolvedCategory,
      product_media: existingMedia,
    };
  });
}

function toFiniteNumber(raw: unknown): number | null {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? raw : null;
  }
  if (typeof raw === 'string' && raw.trim() !== '') {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toCleanString(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseMaybeJson(raw: unknown): unknown {
  if (typeof raw !== 'string') return raw;
  const trimmed = raw.trim();
  if (
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'))
  ) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return raw;
    }
  }
  return raw;
}

export function resolveProductMediaUrl(
  media: Pick<SupabaseProductMediaRow, 'media_url' | 'storage_path'>,
  supabaseUrl?: string
): string | null {
  const directUrl = typeof media.media_url === 'string' ? media.media_url.trim() : '';
  if (/^https?:\/\//i.test(directUrl) || directUrl.startsWith('/')) {
    return directUrl;
  }

  const rawStoragePath = (media.storage_path ?? directUrl).trim().replace(/^\/+/, '');
  if (!rawStoragePath || !supabaseUrl) {
    return null;
  }

  const cleanBase = supabaseUrl.trim().replace(/\/+$/, '');
  const withoutBucketPrefix = rawStoragePath.startsWith(`${PRODUCT_MEDIA_BUCKET}/`)
    ? rawStoragePath.slice(PRODUCT_MEDIA_BUCKET.length + 1)
    : rawStoragePath;

  if (!withoutBucketPrefix) {
    return null;
  }

  const encodedPath = withoutBucketPrefix
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');

  return `${cleanBase}/storage/v1/object/public/${PRODUCT_MEDIA_BUCKET}/${encodedPath}`;
}

function resolvePublicAssetUrl(raw: unknown, supabaseUrl?: string): string | null {
  const str = toCleanString(raw);
  if (!str) return null;
  if (/^https?:\/\//i.test(str) || str.startsWith('/')) {
    return str;
  }
  return resolveProductMediaUrl({ storage_path: str, media_url: null }, supabaseUrl);
}

function isVideoMedia(media: SupabaseProductMediaRow, resolvedUrl: string): boolean {
  const type = (media.media_type ?? '').trim().toLowerCase();
  if (type.startsWith('video')) {
    return true;
  }
  const cleanPathname = resolvedUrl.split('?')[0].toLowerCase();
  return cleanPathname.endsWith('.mp4') || cleanPathname.endsWith('.webm') || cleanPathname.endsWith('.mov');
}

export function mapSupabaseProductToStoreProduct(
  row: SupabaseProductRow,
  supabaseUrl?: string,
  nowMs = Date.now()
): Product | null {
  if (!row.id || !row.name || !row.name.trim() || !isPublishedProductRow(row)) {
    return null;
  }

  const rawCategory = Array.isArray(row.categories) ? row.categories[0] : row.categories;
  const activeCategory =
    rawCategory && rawCategory.is_active !== false && rawCategory.name?.trim()
      ? rawCategory
      : null;

  const categoryName = activeCategory ? activeCategory.name.trim() : 'Geral';
  const categorySlug = activeCategory?.slug?.trim()
    ? activeCategory.slug.trim()
    : slugifyCategory(categoryName) || 'geral';

  const basePrice = toFiniteNumber(row.price) ?? 0;
  const salePrice = toFiniteNumber(row.sale_price);

  let effectivePrice = Math.max(0, basePrice);
  let oldPrice: number | undefined;

  if (salePrice !== null && salePrice > 0) {
    if (basePrice <= 0) {
      effectivePrice = salePrice;
    } else if (salePrice < basePrice) {
      effectivePrice = salePrice;
      oldPrice = basePrice;
    }
  }

  const sortedMedia = [...(row.product_media ?? [])].sort((a, b) => {
    const orderA = typeof a.sort_order === 'number' ? a.sort_order : 9999;
    const orderB = typeof b.sort_order === 'number' ? b.sort_order : 9999;
    if (orderA !== orderB) return orderA - orderB;
    return (a.created_at ?? '').localeCompare(b.created_at ?? '');
  });

  const images: string[] = [];
  const seenImages = new Set<string>();
  let video: ProductVideo | undefined;

  for (const media of sortedMedia) {
    const url = resolveProductMediaUrl(media, supabaseUrl);
    if (!url) continue;

    if (isVideoMedia(media, url)) {
      if (!video) {
        video = {};
      }
      const lowerPath = url.split('?')[0].toLowerCase();
      if (lowerPath.endsWith('.webm') && !video.webm) {
        video.webm = url;
      } else if (!video.mp4) {
        video.mp4 = url;
      }
      if (!video.caption && media.alt_text?.trim()) {
        video.caption = media.alt_text.trim();
      }
    } else if (!seenImages.has(url)) {
      seenImages.add(url);
      images.push(url);
    }
  }

  if (video && images.length > 0 && !video.poster) {
    video.poster = images[0];
  }

  const manageStock = row.manage_stock !== false;
  const rawStock =
    typeof row.stock_quantity === 'number' && Number.isFinite(row.stock_quantity)
      ? Math.max(0, Math.floor(row.stock_quantity))
      : undefined;
  const stock = manageStock ? rawStock : undefined;

  const lowStockThreshold =
    manageStock &&
    typeof row.low_stock_threshold === 'number' &&
    Number.isFinite(row.low_stock_threshold) &&
    row.low_stock_threshold > 0
      ? Math.floor(row.low_stock_threshold)
      : undefined;

  const normalizedStatus = (row.status ?? '').trim().toLowerCase();
  const isAvailableFlag = row.is_available !== false;
  let availabilityStatus: AvailabilityStatus = 'available';
  let available = true;

  if (OUT_OF_STOCK_STATUSES.has(normalizedStatus)) {
    availabilityStatus = 'out_of_stock';
    available = false;
  } else if (TEMP_UNAVAILABLE_STATUSES.has(normalizedStatus) || !isAvailableFlag) {
    availabilityStatus =
      manageStock && rawStock === 0 ? 'out_of_stock' : 'temporarily_unavailable';
    available = false;
  } else if (manageStock && typeof stock === 'number' && stock <= 0) {
    availabilityStatus = 'out_of_stock';
    available = false;
  }

  let isNew = false;
  if (row.created_at) {
    const createdMs = Date.parse(row.created_at);
    if (Number.isFinite(createdMs) && nowMs - createdMs <= THIRTY_DAYS_MS && nowMs >= createdMs - 60000) {
      isNew = true;
    }
  }

  const cleanSlug = row.slug?.trim() || slugifyCategory(row.name) || row.id;

  return {
    id: row.id,
    name: row.name.trim(),
    slug: cleanSlug,
    sku: row.sku?.trim() || undefined,
    description: row.description?.trim() || 'Artigo disponível na Bercali Store.',
    category: categoryName,
    categoryId: activeCategory?.id ?? row.category_id ?? undefined,
    categorySlug,
    price: effectivePrice,
    oldPrice,
    images,
    video,
    features: [],
    stock,
    manageStock,
    lowStockThreshold,
    featured: false,
    isNew,
    available,
    availabilityStatus,
  };
}

export function applyFeaturedSelection(products: readonly Product[]): Product[] {
  if (products.length <= 4) {
    return products.map((p) => ({ ...p, featured: false }));
  }

  const purchasableCandidates = products.filter(isProductPurchasable);
  const promos = purchasableCandidates.filter((p) => typeof p.oldPrice === 'number' && p.oldPrice > p.price);
  const nonPromos = purchasableCandidates.filter((p) => !(typeof p.oldPrice === 'number' && p.oldPrice > p.price));
  const featuredIds = new Set(
    [...promos, ...nonPromos].slice(0, 4).map((p) => p.id)
  );

  return products.map((p) => ({
    ...p,
    featured: featuredIds.has(p.id),
  }));
}

export function buildStoreCategories(
  categoryRows: readonly SupabaseCategoryRow[],
  products: readonly Product[]
): StoreCategory[] {
  const bySlug = new Map<string, StoreCategory>();

  for (const row of categoryRows) {
    if (row.is_active === false) continue;
    const name = row.name?.trim();
    if (!name) continue;
    const slug = row.slug?.trim() || slugifyCategory(name);
    if (!slug) continue;

    bySlug.set(slug, {
      id: row.id,
      name,
      slug,
      description: row.description?.trim() || undefined,
      count: 0,
      availableCount: 0,
    });
  }

  for (const product of products) {
    const slug = product.categorySlug || slugifyCategory(product.category);
    if (!slug) continue;

    let entry = bySlug.get(slug);
    if (!entry) {
      entry = {
        id: product.categoryId ?? slug,
        name: product.category,
        slug,
        count: 0,
        availableCount: 0,
      };
      bySlug.set(slug, entry);
    }

    entry.count += 1;
    if (isProductPurchasable(product)) {
      entry.availableCount += 1;
    }
  }

  return Array.from(bySlug.values());
}

function normalizePhoneCandidate(raw: unknown): string | null {
  const normalized = normalizeWhatsAppNumber(raw);
  return normalized.length > 0 ? normalized : null;
}

function normalizeDisplayPhone(raw: unknown): string | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return normalizeDisplayPhone(String(Math.trunc(raw)));
  }
  const str = toCleanString(raw);
  if (!str) return null;
  const digits = str.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) return null;
  return str;
}

function normalizeSocialUrl(
  raw: unknown,
  platform: keyof StoreSocialLinks
): string | null {
  const str = toCleanString(raw);
  if (!str || str === '#') return null;

  if (/^https?:\/\//i.test(str)) {
    return str;
  }

  if (str.startsWith('www.')) {
    return `https://${str}`;
  }

  const handle = str.replace(/^@+/, '').replace(/^\/+/, '');
  if (!handle || /\s/.test(handle)) return null;

  if (handle.includes('.')) {
    return `https://${handle}`;
  }

  switch (platform) {
    case 'instagram':
      return `https://instagram.com/${handle}`;
    case 'facebook':
      return `https://facebook.com/${handle}`;
    case 'tiktok':
      return `https://tiktok.com/@${handle}`;
    case 'youtube':
      return `https://youtube.com/@${handle}`;
    case 'linkedin':
      return `https://linkedin.com/company/${handle}`;
    case 'website':
    default:
      return null;
  }
}

function parseBooleanFlag(raw: unknown): boolean | null {
  if (typeof raw === 'boolean') return raw;
  if (typeof raw === 'number') {
    if (raw === 1) return true;
    if (raw === 0) return false;
  }
  if (typeof raw === 'string') {
    const lower = raw.trim().toLowerCase();
    if (lower === 'true' || lower === '1' || lower === 'yes' || lower === 'sim') return true;
    if (lower === 'false' || lower === '0' || lower === 'no' || lower === 'nao' || lower === 'não') {
      return false;
    }
    if (STORE_OPEN_STATUS_WORDS.has(lower)) return true;
    if (STORE_CLOSED_STATUS_WORDS.has(lower)) return false;
  }
  return null;
}

function parseDeliveryRulesArray(rawList: unknown): DeliveryFeeRule[] {
  if (!Array.isArray(rawList)) return [];
  const parsedRules: DeliveryFeeRule[] = [];

  for (const item of rawList) {
    if (typeof item !== 'object' || item === null) continue;
    const rec = item as Record<string, unknown>;
    if (rec.is_active === false || rec.active === false || rec.enabled === false) {
      continue;
    }

    const rawProvince =
      toCleanString(rec.province) ??
      toCleanString(rec.provincia) ??
      toCleanString(rec.region) ??
      '';
    const rawMunicipality =
      toCleanString(rec.municipality) ??
      toCleanString(rec.municipio) ??
      toCleanString(rec.city) ??
      undefined;
    const rawNeighborhood =
      toCleanString(rec.neighborhood) ?? toCleanString(rec.bairro) ?? undefined;
    const rawZoneName =
      toCleanString(rec.zoneName) ??
      toCleanString(rec.zone_name) ??
      toCleanString(rec.zone) ??
      toCleanString(rec.name) ??
      toCleanString(rec.zona) ??
      undefined;
    const estimatedTime =
      toCleanString(rec.estimatedTime) ??
      toCleanString(rec.estimated_time) ??
      toCleanString(rec.eta) ??
      toCleanString(rec.delivery_time) ??
      undefined;

    const fee = toFiniteNumber(
      rec.feeKz ?? rec.fee_kz ?? rec.fee ?? rec.price ?? rec.rate ?? rec.amount ?? rec.cost
    );

    const rawRuleId =
      toCleanString(rec.id) ??
      toCleanString(rec.zone_id) ??
      toCleanString(rec.zoneId) ??
      undefined;

    const effectiveProvince = rawProvince || rawZoneName || '';
    if (effectiveProvince && fee !== null && fee >= 0) {
      parsedRules.push({
        ...(rawRuleId ? { id: rawRuleId } : {}),
        province: effectiveProvince,
        municipality: rawMunicipality,
        neighborhood: rawNeighborhood,
        zoneName: rawZoneName,
        estimatedTime,
        feeKz: fee,
      });
    }
  }

  return parsedRules;
}

export function extractWhatsAppFromSettings(
  rows: readonly SupabaseStoreSettingRow[],
  fallbackNumber: string
): string {
  const settings = extractPublicStoreSettings(rows);
  return isValidWhatsAppNumber(settings.whatsappNumber)
    ? settings.whatsappNumber
    : fallbackNumber;
}

export function extractDeliveryRulesFromSettings(
  rows: readonly SupabaseStoreSettingRow[],
  fallbackRules: readonly DeliveryFeeRule[]
): DeliveryFeeRule[] {
  const settings = extractPublicStoreSettings(rows);
  return settings.deliveryFeeRules.length > 0 ? settings.deliveryFeeRules : [...fallbackRules];
}

/**
 * Extrai de forma segura e tolerante todas as definições públicas da loja guardadas em `store_settings`
 * pelo Painel Administrativo (contactos, estado ativo/inativo, entregas, redes sociais, banners e textos).
 * Nunca inventa contactos nem links quando não existem na base de dados.
 */
export function extractPublicStoreSettings(
  rows: readonly SupabaseStoreSettingRow[],
  supabaseUrl?: string
): PublicStoreSettings {
  const result = createDefaultPublicStoreSettings();
  let explicitWhatsappState: 'unset' | 'set' | 'cleared' = 'unset';

  const applySocialRecord = (obj: Record<string, unknown>) => {
    const ig = normalizeSocialUrl(
      obj.instagram ?? obj.instagram_url ?? obj.instagramUrl,
      'instagram'
    );
    if (ig) result.socialLinks.instagram = ig;

    const fb = normalizeSocialUrl(
      obj.facebook ?? obj.facebook_url ?? obj.facebookUrl,
      'facebook'
    );
    if (fb) result.socialLinks.facebook = fb;

    const tt = normalizeSocialUrl(obj.tiktok ?? obj.tiktok_url ?? obj.tiktokUrl, 'tiktok');
    if (tt) result.socialLinks.tiktok = tt;

    const yt = normalizeSocialUrl(obj.youtube ?? obj.youtube_url ?? obj.youtubeUrl, 'youtube');
    if (yt) result.socialLinks.youtube = yt;

    const li = normalizeSocialUrl(
      obj.linkedin ?? obj.linkedin_url ?? obj.linkedinUrl,
      'linkedin'
    );
    if (li) result.socialLinks.linkedin = li;

    const web = normalizeSocialUrl(obj.website ?? obj.website_url ?? obj.site_url, 'website');
    if (web) result.socialLinks.website = web;
  };

  const applyObjectSettings = (
    obj: Record<string, unknown>,
    groupKey: string,
    depth = 0
  ) => {
    // Suporte para perfis aninhados (ex.: `company_profile`, `whatsapp_settings`, `checkout_settings`)
    if (depth < 2) {
      const nestedGroupEntries: Array<[string, unknown]> = [
        ['company_profile', obj.company_profile ?? obj.companyProfile ?? obj.store_profile ?? obj.storeProfile],
        ['general', obj.general ?? obj.general_settings ?? obj.generalSettings],
        ['whatsapp_settings', obj.whatsapp_settings ?? obj.whatsappSettings],
        ['checkout', obj.checkout_settings ?? obj.checkoutSettings ?? obj.order_settings ?? obj.orderSettings],
        ['delivery_settings', obj.delivery_settings ?? obj.deliverySettings],
      ];
      for (const [nestedKey, nestedRaw] of nestedGroupEntries) {
        const parsedNested = parseMaybeJson(nestedRaw);
        if (
          typeof parsedNested === 'object' &&
          parsedNested !== null &&
          !Array.isArray(parsedNested)
        ) {
          applyObjectSettings(parsedNested as Record<string, unknown>, nestedKey, depth + 1);
        }
      }
    }

    // Identidade comercial e logótipo
    const nameCandidate =
      toCleanString(obj.store_name) ??
      toCleanString(obj.storeName) ??
      toCleanString(obj.company_name) ??
      toCleanString(obj.companyName) ??
      toCleanString(obj.business_name) ??
      toCleanString(obj.businessName) ??
      toCleanString(obj.brand_name) ??
      toCleanString(obj.brandName) ??
      toCleanString(obj.commercial_name) ??
      toCleanString(obj.commercialName) ??
      toCleanString(obj.trade_name) ??
      toCleanString(obj.tradeName) ??
      (groupKey === 'company_profile' ||
      groupKey === 'company' ||
      groupKey === 'general' ||
      groupKey === 'store' ||
      groupKey === 'store_info' ||
      groupKey === 'branding'
        ? toCleanString(obj.name)
        : null);
    if (nameCandidate) {
      result.brandName = nameCandidate;
    }

    const sloganCandidate =
      toCleanString(obj.slogan) ?? toCleanString(obj.tagline) ?? toCleanString(obj.motto);
    if (sloganCandidate) {
      result.slogan = sloganCandidate;
    }

    const descCandidate =
      toCleanString(obj.store_description) ??
      toCleanString(obj.commercial_description) ??
      (groupKey === 'company_profile' ||
      groupKey === 'company' ||
      groupKey === 'general' ||
      groupKey === 'store' ||
      groupKey === 'store_info'
        ? toCleanString(obj.description)
        : null);
    if (descCandidate) {
      result.description = descCandidate;
    }

    const logoCandidate = resolvePublicAssetUrl(
      obj.logo_url ?? obj.logoUrl ?? obj.store_logo ?? obj.storeLogo ?? obj.logo,
      supabaseUrl
    );
    if (logoCandidate) {
      result.logoUrl = logoCandidate;
    }

    // Estado ativo / inativo da loja
    const maintenanceFlag = parseBooleanFlag(
      obj.maintenance_mode ?? obj.maintenanceMode ?? obj.is_maintenance
    );
    if (maintenanceFlag === true) {
      result.isStoreActive = false;
    }

    const activeFlag =
      parseBooleanFlag(obj.is_store_active) ??
      parseBooleanFlag(obj.store_active) ??
      parseBooleanFlag(obj.storeActive) ??
      parseBooleanFlag(obj.is_open) ??
      parseBooleanFlag(obj.store_open) ??
      parseBooleanFlag(obj.store_status) ??
      (groupKey === 'general' ||
      groupKey === 'store' ||
      groupKey === 'store_info' ||
      groupKey === 'store_status' ||
      groupKey === 'status' ||
      groupKey === 'availability'
        ? parseBooleanFlag(obj.is_active ?? obj.active ?? obj.status ?? obj.enabled)
        : null);

    if (activeFlag !== null && maintenanceFlag !== true) {
      result.isStoreActive = activeFlag;
    }

    const closedMsg =
      toCleanString(obj.closed_message) ??
      toCleanString(obj.closedMessage) ??
      toCleanString(obj.inactive_message) ??
      toCleanString(obj.closure_message) ??
      toCleanString(obj.maintenance_message) ??
      (groupKey === 'store_status' ? toCleanString(obj.message ?? obj.reason) : null);
    if (closedMsg) {
      result.closedMessage = closedMsg;
    }

    // Contactos: WhatsApp (incluindo company_profile), Modelo de Mensagem, Telefone, E-mail e Morada
    const nestedWaObj =
      typeof obj.whatsapp === 'object' && obj.whatsapp !== null && !Array.isArray(obj.whatsapp)
        ? (obj.whatsapp as Record<string, unknown>)
        : typeof obj.whatsApp === 'object' && obj.whatsApp !== null && !Array.isArray(obj.whatsApp)
        ? (obj.whatsApp as Record<string, unknown>)
        : null;

    const whatsappFields = [
      nestedWaObj ? nestedWaObj.number ?? nestedWaObj.phone ?? nestedWaObj.value : obj.whatsapp,
      nestedWaObj ? undefined : obj.whatsApp,
      obj.whatsapp_number,
      obj.whatsappNumber,
      obj.whatsAppNumber,
      obj.whatsapp_phone,
      obj.whatsappPhone,
      obj.whatsAppPhone,
      obj.phone_whatsapp,
      obj.phoneWhatsapp,
      obj.store_whatsapp,
      obj.storeWhatsapp,
      obj.support_whatsapp,
      obj.supportWhatsapp,
      obj.contact_whatsapp,
      obj.contactWhatsapp,
      obj.whatsapp_contact,
      obj.whatsappContact,
    ];
    const hasExplicitWaField = whatsappFields.some((v) => v !== undefined);
    let waCandidate: string | null = null;
    for (const candidateVal of whatsappFields) {
      const normalized = normalizePhoneCandidate(candidateVal);
      if (normalized) {
        waCandidate = normalized;
        break;
      }
    }

    if (waCandidate) {
      result.whatsappNumber = waCandidate;
      explicitWhatsappState = 'set';
    } else if (hasExplicitWaField && explicitWhatsappState !== 'set') {
      result.whatsappNumber = '';
      explicitWhatsappState = 'cleared';
    }

    const msgTemplateCandidate =
      toCleanString(obj.whatsapp_message_template) ??
      toCleanString(obj.whatsappMessageTemplate) ??
      toCleanString(obj.whatsAppMessageTemplate) ??
      toCleanString(obj.whatsapp_template) ??
      toCleanString(obj.whatsappTemplate) ??
      toCleanString(obj.whatsAppTemplate) ??
      toCleanString(obj.whatsapp_message) ??
      toCleanString(obj.whatsappMessage) ??
      toCleanString(obj.whatsAppMessage) ??
      toCleanString(obj.default_whatsapp_message) ??
      toCleanString(obj.defaultWhatsappMessage) ??
      toCleanString(obj.whatsapp_greeting) ??
      toCleanString(obj.whatsappGreeting) ??
      toCleanString(obj.message_template) ??
      toCleanString(obj.messageTemplate) ??
      (nestedWaObj ? toCleanString(nestedWaObj.message_template ?? nestedWaObj.messageTemplate ?? nestedWaObj.template ?? nestedWaObj.message) : null) ??
      (groupKey === 'whatsapp' || groupKey === 'whatsapp_settings'
        ? toCleanString(obj.message ?? obj.template ?? obj.greeting)
        : null);
    if (msgTemplateCandidate) {
      result.whatsappMessageTemplate = msgTemplateCandidate;
    }

    const orderTemplateCandidate =
      toCleanString(obj.whatsapp_order_template) ??
      toCleanString(obj.whatsappOrderTemplate) ??
      toCleanString(obj.whatsAppOrderTemplate) ??
      toCleanString(obj.order_whatsapp_template) ??
      toCleanString(obj.orderWhatsappTemplate) ??
      toCleanString(obj.checkout_whatsapp_template) ??
      toCleanString(obj.checkoutWhatsappTemplate) ??
      toCleanString(obj.order_message_template) ??
      toCleanString(obj.orderMessageTemplate) ??
      toCleanString(obj.checkout_message_template) ??
      toCleanString(obj.checkoutMessageTemplate) ??
      toCleanString(obj.whatsapp_checkout_message) ??
      toCleanString(obj.whatsappCheckoutMessage) ??
      (nestedWaObj ? toCleanString(nestedWaObj.order_template ?? nestedWaObj.orderTemplate ?? nestedWaObj.checkout_template ?? nestedWaObj.checkoutTemplate) : null) ??
      (groupKey === 'whatsapp' || groupKey === 'whatsapp_settings' || groupKey === 'checkout'
        ? toCleanString(obj.order_template ?? obj.orderTemplate ?? obj.checkout_template ?? obj.checkoutTemplate)
        : null);
    if (orderTemplateCandidate) {
      result.whatsappOrderTemplate = orderTemplateCandidate;
    }

    const phoneDisplay =
      normalizeDisplayPhone(obj.phone) ??
      normalizeDisplayPhone(obj.phone_number) ??
      normalizeDisplayPhone(obj.phoneNumber) ??
      normalizeDisplayPhone(obj.contact_phone) ??
      normalizeDisplayPhone(obj.contactPhone) ??
      normalizeDisplayPhone(obj.telephone) ??
      normalizeDisplayPhone(obj.store_phone) ??
      normalizeDisplayPhone(obj.storePhone);
    if (phoneDisplay) {
      result.phone = phoneDisplay;
    }

    const emailCandidate =
      toCleanString(obj.email) ??
      toCleanString(obj.contact_email) ??
      toCleanString(obj.contactEmail) ??
      toCleanString(obj.store_email) ??
      toCleanString(obj.storeEmail) ??
      toCleanString(obj.support_email) ??
      toCleanString(obj.supportEmail);
    if (emailCandidate && isValidEmailAddress(emailCandidate)) {
      result.email = emailCandidate;
    }

    const addressCandidate =
      toCleanString(obj.address) ??
      toCleanString(obj.store_address) ??
      toCleanString(obj.storeAddress) ??
      toCleanString(obj.location);
    if (addressCandidate) {
      result.address = addressCandidate;
    }

    // Redes sociais (diretas ou aninhadas em `social` / `social_links`)
    applySocialRecord(obj);
    const nestedSocial = obj.social ?? obj.socials ?? obj.social_links ?? obj.socialLinks;
    if (typeof nestedSocial === 'object' && nestedSocial !== null && !Array.isArray(nestedSocial)) {
      applySocialRecord(nestedSocial as Record<string, unknown>);
    }

    // Entregas, zonas, taxas e condições
    const deliveryText =
      toCleanString(obj.delivery_info) ??
      toCleanString(obj.deliveryInfo) ??
      toCleanString(obj.delivery_conditions) ??
      toCleanString(obj.shipping_info) ??
      (groupKey === 'delivery' || groupKey === 'shipping' || groupKey === 'delivery_settings'
        ? toCleanString(obj.conditions ?? obj.description ?? obj.notes)
        : null);
    if (deliveryText) {
      result.deliveryInfo = deliveryText;
    }

    const freeThreshold = toFiniteNumber(
      obj.free_delivery_threshold ??
        obj.freeDeliveryThreshold ??
        obj.free_shipping_threshold ??
        obj.free_shipping_min
    );
    if (freeThreshold !== null && freeThreshold > 0) {
      result.freeDeliveryThresholdKz = freeThreshold;
    }

    const defaultFee = toFiniteNumber(
      obj.default_delivery_fee ??
        obj.defaultDeliveryFee ??
        obj.base_delivery_fee ??
        (groupKey === 'delivery' || groupKey === 'shipping' ? obj.default_fee ?? obj.base_fee : null)
    );
    if (defaultFee !== null && defaultFee >= 0) {
      result.defaultDeliveryFeeKz = defaultFee;
    }

    const rulesArrayCandidate =
      obj.delivery_fee_rules ??
      obj.delivery_rules ??
      obj.delivery_zones ??
      obj.shipping_zones ??
      (groupKey === 'delivery' || groupKey === 'shipping' || groupKey === 'delivery_settings'
        ? obj.zones ?? obj.rules ?? obj.rates
        : undefined);
    const parsedRules = parseDeliveryRulesArray(parseMaybeJson(rulesArrayCandidate));
    if (parsedRules.length > 0) {
      result.deliveryFeeRules = parsedRules;
    }

    // Textos comerciais, pagamentos, promoções e hero
    const paymentText =
      toCleanString(obj.payment_info) ??
      toCleanString(obj.paymentInfo) ??
      toCleanString(obj.payment_conditions);
    if (paymentText) {
      result.paymentInfo = paymentText;
    }

    const disclaimerText =
      toCleanString(obj.order_disclaimer) ?? toCleanString(obj.orderDisclaimer);
    if (disclaimerText) {
      result.orderDisclaimer = disclaimerText;
    }

    const promoText =
      toCleanString(obj.promo_text) ??
      toCleanString(obj.announcement) ??
      toCleanString(obj.announcement_text) ??
      toCleanString(obj.promo_banner_text) ??
      (groupKey === 'promo_banner' || groupKey === 'announcement' || groupKey === 'promotions'
        ? obj.is_active === false || obj.enabled === false
          ? null
          : toCleanString(obj.text ?? obj.title ?? obj.message)
        : null);
    if (promoText) {
      const promoBanner: StorePromoBanner = {
        text: promoText,
        linkUrl: toCleanString(obj.link_url ?? obj.cta_link ?? obj.url) ?? undefined,
        linkLabel: toCleanString(obj.link_label ?? obj.cta_text) ?? undefined,
      };
      result.promoBanner = promoBanner;
    }

    const heroTitle =
      toCleanString(obj.hero_title) ??
      toCleanString(obj.heroTitle) ??
      (groupKey === 'hero' || groupKey === 'banner' ? toCleanString(obj.title) : null);
    const heroHighlight =
      toCleanString(obj.hero_highlight) ??
      (groupKey === 'hero' || groupKey === 'banner' ? toCleanString(obj.highlight) : null);
    const heroSubtitle =
      toCleanString(obj.hero_subtitle) ??
      toCleanString(obj.heroSubtitle) ??
      (groupKey === 'hero' || groupKey === 'banner' ? toCleanString(obj.subtitle) : null);
    const heroCta =
      toCleanString(obj.hero_cta_text) ??
      (groupKey === 'hero' || groupKey === 'banner' ? toCleanString(obj.cta_text) : null);
    const heroImage = resolvePublicAssetUrl(
      obj.hero_image ??
        obj.hero_banner_url ??
        obj.banner_image_url ??
        (groupKey === 'hero' || groupKey === 'banner' ? obj.image_url ?? obj.image : null),
      supabaseUrl
    );

    if (heroTitle || heroHighlight || heroSubtitle || heroCta || heroImage) {
      const mergedHero: StoreHeroConfig = {
        ...(result.heroConfig ?? {}),
        ...(heroTitle ? { title: heroTitle } : {}),
        ...(heroHighlight ? { highlight: heroHighlight } : {}),
        ...(heroSubtitle ? { subtitle: heroSubtitle } : {}),
        ...(heroCta ? { ctaText: heroCta } : {}),
        ...(heroImage ? { bannerImageUrl: heroImage } : {}),
      };
      result.heroConfig = mergedHero;
    }
  };

  for (const row of rows) {
    if (typeof row !== 'object' || row === null) continue;

    const rawRowKey =
      typeof row.setting_key === 'string'
        ? row.setting_key
        : typeof row.key === 'string'
        ? row.key
        : typeof row.config_key === 'string'
        ? row.config_key
        : null;

    // Suporte para tabelas `store_settings` com colunas diretas (ex.: coluna JSONB `company_profile`)
    if (rawRowKey === null) {
      const sanitizedFlatRow: Record<string, unknown> = {};
      for (const [colKey, colVal] of Object.entries(row)) {
        const lk = colKey.toLowerCase();
        if (lk.includes('pixel') || lk.includes('secret') || lk.includes('token')) {
          continue;
        }
        sanitizedFlatRow[colKey] = colVal;
      }
      applyObjectSettings(sanitizedFlatRow, 'general');
      continue;
    }

    const key = rawRowKey.trim().toLowerCase();
    if (!key) continue;

    // Ignorar explicitamente chaves internas/marketing privadas
    if (key.includes('pixel') || key.includes('secret') || key.includes('token')) {
      continue;
    }

    const rawSettingVal =
      row.setting_value !== undefined
        ? row.setting_value
        : row.value !== undefined
        ? row.value
        : row.config_value;
    const val = parseMaybeJson(rawSettingVal);

    if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
      const obj = val as Record<string, unknown>;

      // Chaves individuais cujo valor vem embrulhado em `{ value: ... }`
      if (
        (key === 'whatsapp' ||
          key === 'whatsapp_number' ||
          key === 'store_whatsapp' ||
          key === 'support_whatsapp' ||
          key === 'contact_whatsapp' ||
          key === 'whatsapp_phone') &&
        (obj.value !== undefined || obj.number !== undefined || obj.phone !== undefined)
      ) {
        const wa =
          normalizePhoneCandidate(obj.number) ??
          normalizePhoneCandidate(obj.whatsapp) ??
          normalizePhoneCandidate(obj.phone) ??
          normalizePhoneCandidate(obj.value);
        if (wa) {
          result.whatsappNumber = wa;
          explicitWhatsappState = 'set';
        } else if (explicitWhatsappState !== 'set') {
          result.whatsappNumber = '';
          explicitWhatsappState = 'cleared';
        }
        if (obj.message !== undefined || obj.template !== undefined) {
          const tpl = toCleanString(obj.template ?? obj.message);
          if (tpl) result.whatsappMessageTemplate = tpl;
        }
        continue;
      }

      if (
        (key === 'whatsapp_message' ||
          key === 'whatsapp_message_template' ||
          key === 'whatsapp_template' ||
          key === 'default_whatsapp_message' ||
          key === 'whatsapp_greeting') &&
        (obj.value !== undefined || obj.template !== undefined || obj.message !== undefined)
      ) {
        const tpl = toCleanString(obj.template ?? obj.message ?? obj.value);
        if (tpl) {
          result.whatsappMessageTemplate = tpl;
        }
        continue;
      }

      if (
        (key === 'whatsapp_order_template' ||
          key === 'order_whatsapp_template' ||
          key === 'checkout_whatsapp_template' ||
          key === 'order_message_template') &&
        (obj.value !== undefined || obj.template !== undefined || obj.message !== undefined)
      ) {
        const tpl = toCleanString(obj.template ?? obj.message ?? obj.value);
        if (tpl) {
          result.whatsappOrderTemplate = tpl;
        }
        continue;
      }

      if ((key === 'email' || key === 'contact_email' || key === 'store_email') && obj.value) {
        const em = toCleanString(obj.value);
        if (em && isValidEmailAddress(em)) {
          result.email = em;
        }
        continue;
      }

      applyObjectSettings(obj, key);
      continue;
    }

    if (Array.isArray(val)) {
      if (
        key === 'delivery_fee_rules' ||
        key === 'delivery_rules' ||
        key === 'delivery_zones' ||
        key === 'shipping_zones'
      ) {
        const parsed = parseDeliveryRulesArray(val);
        if (parsed.length > 0) {
          result.deliveryFeeRules = parsed;
        }
      } else if (key === 'banners' || key === 'hero_banners') {
        const firstActive = val.find(
          (b) =>
            typeof b === 'object' &&
            b !== null &&
            (b as Record<string, unknown>).is_active !== false &&
            (b as Record<string, unknown>).active !== false
        ) as Record<string, unknown> | undefined;
        if (firstActive) {
          applyObjectSettings(firstActive, 'banner');
        }
      }
      continue;
    }

    // Chaves escalares diretas (string, boolean, number)
    switch (key) {
      case 'store_name':
      case 'brand_name':
      case 'commercial_name': {
        const s = toCleanString(val);
        if (s) result.brandName = s;
        break;
      }
      case 'slogan':
      case 'tagline': {
        const s = toCleanString(val);
        if (s) result.slogan = s;
        break;
      }
      case 'store_description':
      case 'commercial_description': {
        const s = toCleanString(val);
        if (s) result.description = s;
        break;
      }
      case 'logo_url':
      case 'store_logo':
      case 'logo': {
        const u = resolvePublicAssetUrl(val, supabaseUrl);
        if (u) result.logoUrl = u;
        break;
      }
      case 'is_active':
      case 'store_active':
      case 'is_store_active':
      case 'is_open':
      case 'store_open':
      case 'store_status': {
        const b = parseBooleanFlag(val);
        if (b !== null) result.isStoreActive = b;
        break;
      }
      case 'maintenance_mode': {
        const b = parseBooleanFlag(val);
        if (b === true) result.isStoreActive = false;
        break;
      }
      case 'closed_message':
      case 'inactive_message':
      case 'closure_message':
      case 'maintenance_message': {
        const s = toCleanString(val);
        if (s) result.closedMessage = s;
        break;
      }
      case 'whatsapp':
      case 'whatsapp_number':
      case 'store_whatsapp':
      case 'support_whatsapp':
      case 'contact_whatsapp':
      case 'whatsapp_phone': {
        const wa = normalizePhoneCandidate(val);
        if (wa) {
          result.whatsappNumber = wa;
          explicitWhatsappState = 'set';
        } else if (explicitWhatsappState !== 'set') {
          result.whatsappNumber = '';
          explicitWhatsappState = 'cleared';
        }
        break;
      }
      case 'whatsapp_message':
      case 'whatsapp_message_template':
      case 'whatsapp_template':
      case 'default_whatsapp_message':
      case 'whatsapp_greeting':
      case 'message_template': {
        const s = toCleanString(val);
        if (s) result.whatsappMessageTemplate = s;
        break;
      }
      case 'whatsapp_order_template':
      case 'order_whatsapp_template':
      case 'checkout_whatsapp_template':
      case 'order_message_template':
      case 'whatsapp_checkout_message': {
        const s = toCleanString(val);
        if (s) result.whatsappOrderTemplate = s;
        break;
      }
      case 'phone':
      case 'contact_phone':
      case 'store_phone': {
        const ph = normalizeDisplayPhone(val);
        if (ph) {
          result.phone = ph;
          if (explicitWhatsappState === 'unset') {
            const wa = normalizePhoneCandidate(ph);
            if (wa) result.whatsappNumber = wa;
          }
        }
        break;
      }
      case 'email':
      case 'contact_email':
      case 'store_email':
      case 'support_email': {
        const em = toCleanString(val);
        if (em && isValidEmailAddress(em)) {
          result.email = em;
        }
        break;
      }
      case 'address':
      case 'store_address':
      case 'location': {
        const addr = toCleanString(val);
        if (addr) result.address = addr;
        break;
      }
      case 'instagram':
      case 'instagram_url': {
        const u = normalizeSocialUrl(val, 'instagram');
        if (u) result.socialLinks.instagram = u;
        break;
      }
      case 'facebook':
      case 'facebook_url': {
        const u = normalizeSocialUrl(val, 'facebook');
        if (u) result.socialLinks.facebook = u;
        break;
      }
      case 'tiktok':
      case 'tiktok_url': {
        const u = normalizeSocialUrl(val, 'tiktok');
        if (u) result.socialLinks.tiktok = u;
        break;
      }
      case 'youtube':
      case 'youtube_url': {
        const u = normalizeSocialUrl(val, 'youtube');
        if (u) result.socialLinks.youtube = u;
        break;
      }
      case 'linkedin':
      case 'linkedin_url': {
        const u = normalizeSocialUrl(val, 'linkedin');
        if (u) result.socialLinks.linkedin = u;
        break;
      }
      case 'website':
      case 'website_url': {
        const u = normalizeSocialUrl(val, 'website');
        if (u) result.socialLinks.website = u;
        break;
      }
      case 'delivery_info':
      case 'delivery_conditions':
      case 'shipping_info': {
        const s = toCleanString(val);
        if (s) result.deliveryInfo = s;
        break;
      }
      case 'free_delivery_threshold':
      case 'free_shipping_threshold': {
        const n = toFiniteNumber(val);
        if (n !== null && n > 0) result.freeDeliveryThresholdKz = n;
        break;
      }
      case 'default_delivery_fee':
      case 'base_delivery_fee': {
        const n = toFiniteNumber(val);
        if (n !== null && n >= 0) result.defaultDeliveryFeeKz = n;
        break;
      }
      case 'payment_info':
      case 'payment_conditions': {
        const s = toCleanString(val);
        if (s) result.paymentInfo = s;
        break;
      }
      case 'order_disclaimer': {
        const s = toCleanString(val);
        if (s) result.orderDisclaimer = s;
        break;
      }
      case 'promo_banner':
      case 'promo_text':
      case 'announcement':
      case 'announcement_bar': {
        const s = toCleanString(val);
        if (s) result.promoBanner = { text: s };
        break;
      }
      default:
        break;
    }
  }

  return result;
}

export type OrderVerificationResult =
  | {
      ok: true;
      storeSettings: PublicStoreSettings;
      verifiedSummary: OrderSummaryCalculation;
    }
  | {
      ok: false;
      reason: 'store_closed' | 'stock_conflict';
      message: string;
      storeSettings: PublicStoreSettings;
    };

/**
 * Revalida o estado real da loja, a disponibilidade, o stock e os preços oficiais diretamente
 * a partir das linhas atuais da base de dados, impedindo encomendas quando a loja está encerrada
 * e recusando preços ou totais manipulados no navegador.
 */
export function verifyAndRecalculateOrder(params: {
  requestedItems: readonly CartItem[];
  customer: CustomerCheckoutData;
  liveProductRows: readonly SupabaseProductRow[];
  liveSettingsRows: readonly SupabaseStoreSettingRow[];
  supabaseUrl?: string;
}): OrderVerificationResult {
  const { requestedItems, customer, liveProductRows, liveSettingsRows, supabaseUrl } = params;
  const storeSettings = extractPublicStoreSettings(liveSettingsRows, supabaseUrl);

  if (!storeSettings.isStoreActive) {
    return {
      ok: false,
      reason: 'store_closed',
      message: storeSettings.closedMessage,
      storeSettings,
    };
  }

  if (requestedItems.length === 0) {
    return {
      ok: false,
      reason: 'stock_conflict',
      message: 'O carrinho não contém artigos válidos para encomendar.',
      storeSettings,
    };
  }

  const liveProductMap = new Map<string, Product>();
  for (const row of liveProductRows) {
    const mapped = mapSupabaseProductToStoreProduct(row, supabaseUrl);
    if (mapped) {
      liveProductMap.set(mapped.id, mapped);
    }
  }

  const verifiedLines: ValidatedCartLine[] = [];

  for (const reqItem of requestedItems) {
    const qty = Math.floor(reqItem.quantity);
    if (!Number.isFinite(qty) || qty < 1) {
      continue;
    }

    const liveProduct = liveProductMap.get(reqItem.productId);
    if (!liveProduct || !isProductPurchasable(liveProduct)) {
      return {
        ok: false,
        reason: 'stock_conflict',
        message: liveProduct
          ? `O artigo "${liveProduct.name}" deixou de estar disponível para encomenda.`
          : 'Um dos artigos do carrinho já não se encontra publicado ou disponível no catálogo.',
        storeSettings,
      };
    }

    if (
      liveProduct.manageStock !== false &&
      typeof liveProduct.stock === 'number' &&
      qty > liveProduct.stock
    ) {
      return {
        ok: false,
        reason: 'stock_conflict',
        message: `Stock insuficiente para "${liveProduct.name}" (disponível: ${liveProduct.stock} un.). Ajusta a quantidade no carrinho.`,
        storeSettings,
      };
    }

    verifiedLines.push({
      product: liveProduct,
      quantity: qty,
      lineSubtotal: liveProduct.price * qty,
    });
  }

  if (verifiedLines.length === 0) {
    return {
      ok: false,
      reason: 'stock_conflict',
      message: 'Nenhum artigo selecionado permanece disponível para encomenda.',
      storeSettings,
    };
  }

  const verifiedSummary = calculateOrderSummary(
    verifiedLines,
    customer.province,
    customer.municipality,
    storeSettings.deliveryFeeRules,
    {
      freeDeliveryThresholdKz: storeSettings.freeDeliveryThresholdKz,
      defaultDeliveryFeeKz: storeSettings.defaultDeliveryFeeKz,
      neighborhood: customer.neighborhood,
      deliveryZone: customer.deliveryZone,
    }
  );

  return {
    ok: true,
    storeSettings,
    verifiedSummary,
  };
}

export function generateUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function generateOrderNumber(now = new Date()): string {
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  const randomSuffix = String(Math.floor(1000 + Math.random() * 9000));
  return `BRC-${yyyy}${mm}${dd}-${randomSuffix}`;
}

export function formatOrderDeliveryAddress(customer: CustomerCheckoutData): string {
  const cleanZone = (customer.deliveryZone ?? '').trim();
  const cleanProv = customer.province.trim();
  const cleanMun = customer.municipality.trim();
  const cleanNeigh = customer.neighborhood.trim();
  const cleanRef = customer.addressReference.trim();

  const parts: string[] = [];
  if (cleanZone && cleanZone !== cleanProv && cleanZone !== cleanMun) {
    parts.push(`Zona: ${cleanZone}`);
  }
  if (cleanProv) {
    parts.push(`Província: ${cleanProv}`);
  }
  if (cleanMun) {
    parts.push(`Município: ${cleanMun}`);
  }
  if (cleanNeigh) {
    parts.push(`Bairro: ${cleanNeigh}`);
  }
  if (cleanRef) {
    parts.push(`Endereço/Referência: ${cleanRef}`);
  }
  return parts.length > 0 ? parts.join(' | ') : 'A confirmar pelo WhatsApp';
}

export function formatOrderInternalNotes(
  customer: CustomerCheckoutData,
  summary: OrderSummaryCalculation
): string {
  const parts = [
    `Cliente: ${customer.fullName.trim()} (${customer.phone.trim()})`,
    `Entrega: ${summary.delivery.label}`,
  ];
  const emailClean = (customer.email ?? '').trim();
  if (emailClean) {
    parts.push(`E-mail: ${emailClean}`);
  }
  if (customer.notes.trim()) {
    parts.push(`Observações do cliente: ${customer.notes.trim()}`);
  }
  return parts.join(' | ');
}

export function buildSupabaseOrderPayloads(params: {
  customerId: string;
  orderId: string;
  orderNumber: string;
  customer: CustomerCheckoutData;
  summary: OrderSummaryCalculation;
}): {
  customerRow: SupabaseCustomerInsert;
  orderRow: SupabaseOrderInsert;
  orderItemRows: SupabaseOrderItemInsert[];
} {
  const { customerId, orderId, orderNumber, customer, summary } = params;
  const cleanEmail = (customer.email ?? '').trim();
  const cityStr =
    [customer.municipality.trim(), customer.province.trim()].filter(Boolean).join(', ') ||
    (customer.deliveryZone ?? '').trim() ||
    'Angola';

  const customerRow: SupabaseCustomerInsert = {
    id: customerId,
    full_name: customer.fullName.trim(),
    phone: customer.phone.trim(),
    email: cleanEmail && isValidEmailAddress(cleanEmail) ? cleanEmail : null,
    city: cityStr,
    notes: customer.notes.trim() ? customer.notes.trim() : null,
    source: 'online_store',
  };

  const deliveryFeeAmount = summary.delivery.known ? summary.delivery.amountKz : 0;
  const totalAmount = summary.estimatedTotalKz ?? summary.productsSubtotalKz;

  const orderRow: SupabaseOrderInsert = {
    id: orderId,
    order_number: orderNumber,
    customer_id: customerId,
    delivery_address: formatOrderDeliveryAddress(customer),
    internal_notes: formatOrderInternalNotes(customer, summary),
    status: 'pending',
    payment_status: 'pending',
    source: 'online_store',
    subtotal: summary.productsSubtotalKz,
    delivery_fee: deliveryFeeAmount,
    discount_amount: 0,
    total_amount: totalAmount,
    currency: 'AOA',
  };

  const orderItemRows: SupabaseOrderItemInsert[] = summary.lines.map((line) => ({
    order_id: orderId,
    product_id: line.product.id,
    product_name: line.product.name,
    product_sku: line.product.sku ?? null,
    quantity: line.quantity,
    unit_price: line.product.price,
    line_total: line.lineSubtotal,
  }));

  return { customerRow, orderRow, orderItemRows };
}

export interface CreateStorefrontOrderRpcItem {
  productId: string;
  quantity: number;
}

export interface CreateStorefrontOrderRpcArgs {
  p_customer_name: string;
  p_customer_phone: string;
  p_customer_email: string | null;
  p_customer_city: string;
  p_delivery_address: string;
  p_delivery_zone_id: string | null;
  p_delivery_fee: number;
  p_customer_notes: string;
  p_source: 'whatsapp_store';
  p_idempotency_key: string;
  p_items: CreateStorefrontOrderRpcItem[];
}

export function resolveCheckoutDeliveryZoneId(
  customer: CustomerCheckoutData,
  deliveryZones: readonly DeliveryFeeRule[] = []
): string | null {
  const directId = toCleanString(customer.deliveryZoneId);
  if (directId) {
    return directId;
  }

  const chosenZone = toCleanString(customer.deliveryZone)?.toLowerCase();
  if (!chosenZone || deliveryZones.length === 0) {
    return null;
  }

  for (const rule of deliveryZones) {
    if (!rule.id) continue;
    const ruleIdClean = toCleanString(rule.id);
    if (!ruleIdClean) continue;

    const zoneNameLower = (rule.zoneName ?? '').trim().toLowerCase();
    const compositeLabelLower = [rule.province, rule.municipality, rule.neighborhood]
      .map((p) => (p ?? '').trim())
      .filter(Boolean)
      .join(' · ')
      .toLowerCase();

    if (chosenZone === zoneNameLower || chosenZone === compositeLabelLower) {
      return ruleIdClean;
    }
  }

  return null;
}

/**
 * Constrói os parâmetros EXATOS esperados pela função RPC `create_storefront_order` no Supabase.
 */
export function buildCreateStorefrontOrderRpcArgs(params: {
  customer: CustomerCheckoutData;
  summary: OrderSummaryCalculation;
  idempotencyKey: string;
  deliveryZones?: readonly DeliveryFeeRule[];
}): CreateStorefrontOrderRpcArgs {
  const { customer, summary, idempotencyKey, deliveryZones = [] } = params;

  const cleanEmail = (customer.email ?? '').trim();
  const resolvedEmail = cleanEmail && isValidEmailAddress(cleanEmail) ? cleanEmail : null;

  const resolvedCity =
    [customer.municipality.trim(), customer.province.trim()].filter(Boolean).join(', ') ||
    (customer.deliveryZone ?? '').trim() ||
    'Angola';

  const formattedAddress = formatOrderDeliveryAddress(customer).trim();
  const resolvedAddress =
    formattedAddress.length >= 3 ? formattedAddress : 'A confirmar pelo WhatsApp';

  const rawDeliveryFee = summary.delivery.known ? summary.delivery.amountKz : 0;
  const resolvedDeliveryFee =
    typeof rawDeliveryFee === 'number' && Number.isFinite(rawDeliveryFee) && rawDeliveryFee >= 0
      ? rawDeliveryFee
      : 0;

  const resolvedZoneId = resolveCheckoutDeliveryZoneId(customer, deliveryZones);
  const resolvedKey = idempotencyKey.trim() || generateUuid();

  const items: CreateStorefrontOrderRpcItem[] = summary.lines.map((line) => ({
    productId: String(line.product.id).trim(),
    quantity: Math.max(1, Math.trunc(line.quantity)),
  }));

  return {
    p_customer_name: customer.fullName.trim(),
    p_customer_phone: customer.phone.trim(),
    p_customer_email: resolvedEmail,
    p_customer_city: resolvedCity,
    p_delivery_address: resolvedAddress,
    p_delivery_zone_id: resolvedZoneId,
    p_delivery_fee: resolvedDeliveryFee,
    p_customer_notes: (customer.notes ?? '').trim(),
    p_source: 'whatsapp_store',
    p_idempotency_key: resolvedKey,
    p_items: items,
  };
}

const INTERNAL_INFRA_ERROR_CODES = new Set([
  '42501',
  '42883',
  '42P01',
  '42703',
  '42601',
  'XX000',
  'PGRST200',
  'PGRST202',
  'PGRST204',
  'PGRST205',
  'PGRST301',
  'PGRST302',
]);

const INTERNAL_INFRA_MESSAGE_PATTERNS: readonly RegExp[] = [
  /\bpermission\s+denied\b/i,
  /\brow-level\s+security\b/i,
  /\bviolates\s+row-level\s+security\b/i,
  /\bcould\s+not\s+find\s+the\s+function\b/i,
  /\bschema\s+cache\b/i,
  /\brelation\s+["']?[\w.]+["']?\s+does\s+not\s+exist\b/i,
  /\bcolumn\s+["']?[\w.]+["']?\s+does\s+not\s+exist\b/i,
  /\bfunction\s+[\w.]+\(.*\)\s+does\s+not\s+exist\b/i,
  /\bsyntax\s+error\s+at\s+or\s+near\b/i,
  /\binvalid\s+input\s+syntax\s+for\s+type\b/i,
  /\bnull\s+value\s+in\s+column\b/i,
  /\bviolates\s+(foreign\s+key|not-null|unique)\s+constraint\b/i,
  /\binvalid\s+api\s+key\b/i,
  /\bjwt\s+expired\b/i,
  /\bservice_role\b/i,
  /\bcreate_storefront_order\b/i,
];

const STORE_CLOSED_PATTERNS: readonly RegExp[] = [
  /^LOJA_ENCERRADA\b/i,
  /^STORE_CLOSED\b/i,
  /\bloja\s+(est[aá]\s+|encontra-se\s+|temporariamente\s+)?(encerrad[oa]|fechad[oa]|inativ[oa]|indispon[ií]vel)\b/i,
  /\bencomendas?\s+(suspensas?|encerradas?|fechadas?|indispon[ií]veis|desativadas?)\b/i,
  /\bstore\s+(is\s+)?(currently\s+|temporarily\s+)?closed\b/i,
];

const STOCK_OR_UNAVAILABLE_PATTERNS: readonly RegExp[] = [
  /^(STOCK_INSUFICIENTE|OUT_OF_STOCK|PRODUTO_INDISPONIVEL|PRODUCT_UNAVAILABLE|PRODUCT_NOT_FOUND)\b/i,
  /\bstock\b/i,
  /\besgotad[oa]s?\b/i,
  /\binsuficientes?\b/i,
  /\bindispon[ií]ve(l|is)\b/i,
  /\b(produto|artigo|item)s?\s+(n[aã]o\s+encontrad[oa]s?|inativ[oa]s?|arquivad[oa]s?|sem\s+stock|ocult[oa]s?)\b/i,
  /\bn[aã]o\s+encontrad[oa]s?\b/i,
  /\bout\s+of\s+stock\b/i,
  /\binsufficient\s+stock\b/i,
  /\bproduct\s+(not\s+found|is\s+unavailable|unavailable|inactive)\b/i,
];

const INVALID_DATA_PATTERNS: readonly RegExp[] = [
  /^(DADOS_INVALIDOS|VALIDATION_ERROR|INVALID_INPUT|ZONA_INVALIDA|INVALID_DATA)\b/i,
  /\binv[aá]lid[oa]s?\b/i,
  /\bobrigat[oó]ri[oa]s?\b/i,
  /\bm[ií]nimo\b/i,
  /\bm[aá]ximo\b/i,
  /\bcaracter(es)?\b/i,
  /\b(preench[ae]|inform[ae]|indic[ae]|selecion[ae]|introduz[ae]?)\b/i,
  /\b(nome|telefone|telem[oó]vel|contacto|e-?mail|endere[cç]o|morada|cidade|zona|entrega|quantidade|itens|carrinho)\b/i,
  /\b(invalid|required|must\s+have|must\s+be|at\s+least|cannot\s+be\s+empty)\b/i,
];

function stripBusinessErrorCodePrefix(rawMessage: string): string {
  return rawMessage.replace(/^[A-Z][A-Z0-9_]{2,}:\s*/, '').trim();
}

export interface ClassifiedCheckoutRpcError {
  status: 'store_closed' | 'stock_conflict' | 'rls_blocked' | 'error';
  isBusinessRule: boolean;
  serverMessage: string | null;
}

/**
 * Classifica erros devolvidos por `create_storefront_order`:
 * - Expõe no ecrã a mensagem do servidor sempre que se tratar de regra de negócio
 *   (stock, produto indisponível, loja encerrada, dados inválidos).
 * - Oculta erros internos de SQL/permissões/esquema para nunca expor detalhes técnicos ao cliente.
 */
export function classifyCheckoutRpcError(
  error: { code?: string | null; message?: string | null; details?: string | null },
  fallbackClosedMessage?: string
): ClassifiedCheckoutRpcError {
  const code = (error.code ?? '').trim().toUpperCase();
  const rawMessage = (error.message ?? '').trim();
  const rawDetails = (error.details ?? '').trim();
  const combinedRaw = [rawMessage, rawDetails].filter(Boolean).join(' ');

  if (
    code === '42501' ||
    /\bpermission\s+denied\b|\brow-level\s+security\b|\bviolates\s+row-level\s+security\b/i.test(
      combinedRaw
    )
  ) {
    return {
      status: 'rls_blocked',
      isBusinessRule: false,
      serverMessage: null,
    };
  }

  if (
    INTERNAL_INFRA_ERROR_CODES.has(code) ||
    INTERNAL_INFRA_MESSAGE_PATTERNS.some((regex) => regex.test(combinedRaw))
  ) {
    return {
      status: 'error',
      isBusinessRule: false,
      serverMessage: null,
    };
  }

  const cleanedMessage = stripBusinessErrorCodePrefix(rawMessage);

  if (STORE_CLOSED_PATTERNS.some((regex) => regex.test(rawMessage))) {
    return {
      status: 'store_closed',
      isBusinessRule: true,
      serverMessage: cleanedMessage || fallbackClosedMessage || 'A loja encontra-se encerrada de momento.',
    };
  }

  if (STOCK_OR_UNAVAILABLE_PATTERNS.some((regex) => regex.test(rawMessage))) {
    return {
      status: 'stock_conflict',
      isBusinessRule: true,
      serverMessage:
        cleanedMessage || 'Um ou mais produtos selecionados não têm stock ou disponibilidade suficiente.',
    };
  }

  const isExplicitBusinessCode =
    code === 'P0001' || code === 'P0002' || code === '22023' || code === '23514';

  if (
    cleanedMessage &&
    (isExplicitBusinessCode || INVALID_DATA_PATTERNS.some((regex) => regex.test(rawMessage)))
  ) {
    return {
      status: 'error',
      isBusinessRule: true,
      serverMessage: cleanedMessage,
    };
  }

  return {
    status: 'error',
    isBusinessRule: false,
    serverMessage: null,
  };
}

