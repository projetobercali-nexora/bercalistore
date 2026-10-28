import type {
  AllowedMetaPixelEvent,
  MetaPixelEventsConfig,
  OrderSummaryCalculation,
  Product,
  PublicMarketingSettings,
} from '../types/store';

export const COOKIE_CONSENT_STORAGE_KEY = 'bercali_cookie_consent_v1';
export const META_PIXEL_CURRENCY = 'AOA';

export type CookieConsentStatus = 'undecided' | 'accepted' | 'declined';

const ALLOWED_EVENTS: readonly AllowedMetaPixelEvent[] = [
  'PageView',
  'ViewContent',
  'Search',
  'AddToCart',
  'InitiateCheckout',
  'Contact',
];

function createAllEventsConfig(enabled: boolean): MetaPixelEventsConfig {
  return {
    PageView: enabled,
    ViewContent: enabled,
    Search: enabled,
    AddToCart: enabled,
    InitiateCheckout: enabled,
    Contact: enabled,
  };
}

export function createDefaultMarketingSettings(): PublicMarketingSettings {
  return {
    pixelId: null,
    isEnabled: false,
    consentRequired: false,
    events: createAllEventsConfig(false),
  };
}

export function normalizeMetaPixelId(raw: unknown): string | null {
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
    return normalizeMetaPixelId(String(Math.trunc(raw)));
  }
  if (typeof raw !== 'string') return null;
  const cleaned = raw.trim().replace(/\s+/g, '');
  if (!cleaned || /^0+$/.test(cleaned)) {
    return null;
  }
  return /^\d{6,25}$/.test(cleaned) ? cleaned : null;
}

function parseBooleanSetting(raw: unknown): boolean | null {
  if (typeof raw === 'boolean') return raw;
  if (typeof raw === 'number') {
    if (raw === 1) return true;
    if (raw === 0) return false;
  }
  if (typeof raw === 'string') {
    const lower = raw.trim().toLowerCase();
    if (lower === 'true' || lower === '1' || lower === 'yes' || lower === 'sim' || lower === 'active' || lower === 'enabled') {
      return true;
    }
    if (lower === 'false' || lower === '0' || lower === 'no' || lower === 'nao' || lower === 'não' || lower === 'inactive' || lower === 'disabled') {
      return false;
    }
  }
  if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) {
    const rec = raw as Record<string, unknown>;
    return parseBooleanSetting(rec.enabled ?? rec.is_enabled ?? rec.active ?? rec.is_active ?? rec.value);
  }
  return null;
}

function parseMaybeJsonObject(raw: unknown): unknown {
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

function mapCanonicalEventName(rawKey: string): AllowedMetaPixelEvent | 'BLOCKED_PURCHASE' | null {
  const norm = rawKey.trim().toLowerCase().replace(/[\s_-]+/g, '');
  if (!norm) return null;
  if (norm === 'purchase' || norm === 'compra') {
    return 'BLOCKED_PURCHASE';
  }
  switch (norm) {
    case 'pageview':
      return 'PageView';
    case 'viewcontent':
    case 'productview':
      return 'ViewContent';
    case 'search':
    case 'pesquisa':
      return 'Search';
    case 'addtocart':
      return 'AddToCart';
    case 'initiatecheckout':
    case 'begincheckout':
    case 'checkout':
      return 'InitiateCheckout';
    case 'contact':
    case 'whatsapp':
    case 'whatsappclick':
    case 'lead':
      return 'Contact';
    default:
      return null;
  }
}

export function parseMetaEventsConfig(rawConfig: unknown): MetaPixelEventsConfig {
  const parsed = parseMaybeJsonObject(rawConfig);

  if (parsed === null || parsed === undefined) {
    return createAllEventsConfig(true);
  }

  if (Array.isArray(parsed)) {
    const result = createAllEventsConfig(false);
    for (const entry of parsed) {
      if (typeof entry === 'string') {
        const mapped = mapCanonicalEventName(entry);
        if (mapped && mapped !== 'BLOCKED_PURCHASE') {
          result[mapped] = true;
        }
      } else if (typeof entry === 'object' && entry !== null) {
        const rec = entry as Record<string, unknown>;
        const name = typeof rec.name === 'string' ? rec.name : typeof rec.event === 'string' ? rec.event : '';
        const mapped = mapCanonicalEventName(name);
        const flag = parseBooleanSetting(rec.enabled ?? rec.active ?? rec.is_enabled ?? true);
        if (mapped && mapped !== 'BLOCKED_PURCHASE' && flag === true) {
          result[mapped] = true;
        }
      }
    }
    return result;
  }

  if (typeof parsed === 'object') {
    const rec = parsed as Record<string, unknown>;
    const keys = Object.keys(rec);
    if (keys.length === 0) {
      return createAllEventsConfig(false);
    }

    const result = createAllEventsConfig(false);
    for (const [k, v] of Object.entries(rec)) {
      const mapped = mapCanonicalEventName(k);
      if (!mapped || mapped === 'BLOCKED_PURCHASE') {
        continue;
      }
      const flag = parseBooleanSetting(v);
      if (flag === true) {
        result[mapped] = true;
      }
    }
    return result;
  }

  return createAllEventsConfig(false);
}

function isSupportedMetaProvider(providerRaw: unknown): boolean {
  if (typeof providerRaw !== 'string' || !providerRaw.trim()) {
    return true;
  }
  const lower = providerRaw.trim().toLowerCase();
  return (
    lower === 'meta' ||
    lower === 'facebook' ||
    lower === 'meta_pixel' ||
    lower === 'facebook_pixel' ||
    lower === 'fb' ||
    lower === 'fb_pixel'
  );
}

/**
 * Extrai de forma resiliente as configurações de `public.marketing_settings`
 * suportando tanto colunas diretas (`pixel_id`, `is_enabled`, `consent_required`, `events_config`)
 * como aliases (`meta_pixel_id`, `is_active`, `require_consent`) ou pares `setting_key`/`setting_value`.
 */
export function extractMarketingSettings(rows: readonly Record<string, unknown>[]): PublicMarketingSettings {
  if (!Array.isArray(rows) || rows.length === 0) {
    return createDefaultMarketingSettings();
  }

  // Suporte caso a tabela use formato chave/valor (`setting_key` / `setting_value`)
  const looksLikeKeyValue = rows.every(
    (r) => typeof r === 'object' && r !== null && typeof r.setting_key === 'string'
  );

  if (looksLikeKeyValue) {
    const aggregated: Record<string, unknown> = {};
    for (const row of rows) {
      const key = String(row.setting_key ?? '').trim();
      if (!key) continue;
      const val = parseMaybeJsonObject(row.setting_value);
      if (
        (key === 'meta_pixel' || key === 'marketing' || key === 'pixel') &&
        typeof val === 'object' &&
        val !== null &&
        !Array.isArray(val)
      ) {
        Object.assign(aggregated, val as Record<string, unknown>);
      } else {
        aggregated[key] = val;
      }
    }
    return extractMarketingSettings([aggregated]);
  }

  // Selecionar a linha correspondente ao Meta Pixel (preferindo linhas com provider='meta' ou com pixel_id preenchido)
  const metaRows = rows.filter(
    (r) => typeof r === 'object' && r !== null && isSupportedMetaProvider(r.provider)
  );
  if (metaRows.length === 0) {
    return createDefaultMarketingSettings();
  }

  const chosenRow =
    metaRows.find(
      (r) =>
        normalizeMetaPixelId(r.pixel_id ?? r.meta_pixel_id ?? r.facebook_pixel_id ?? r.pixelId) !==
          null &&
        parseBooleanSetting(r.is_enabled ?? r.is_active ?? r.enabled ?? r.active) === true
    ) ??
    metaRows.find(
      (r) =>
        normalizeMetaPixelId(r.pixel_id ?? r.meta_pixel_id ?? r.facebook_pixel_id ?? r.pixelId) !==
        null
    ) ??
    metaRows[0];

  const pixelId = normalizeMetaPixelId(
    chosenRow.pixel_id ??
      chosenRow.meta_pixel_id ??
      chosenRow.facebook_pixel_id ??
      chosenRow.pixelId ??
      chosenRow.metaPixelId
  );

  const rawEnabled = parseBooleanSetting(
    chosenRow.is_enabled ?? chosenRow.is_active ?? chosenRow.enabled ?? chosenRow.active ?? chosenRow.isEnabled
  );
  const isEnabled = Boolean(pixelId) && rawEnabled === true;

  const rawConsent = parseBooleanSetting(
    chosenRow.consent_required ??
      chosenRow.require_consent ??
      chosenRow.requires_consent ??
      chosenRow.cookie_consent_required ??
      chosenRow.consentRequired
  );
  const consentRequired = rawConsent === true;

  const events = isEnabled
    ? parseMetaEventsConfig(chosenRow.events_config ?? chosenRow.events ?? chosenRow.eventsConfig)
    : createAllEventsConfig(false);

  return {
    pixelId,
    isEnabled,
    consentRequired,
    events,
  };
}

export function shouldLoadMetaPixel(
  settings: PublicMarketingSettings,
  consentStatus: CookieConsentStatus
): boolean {
  if (!settings.isEnabled || !normalizeMetaPixelId(settings.pixelId)) {
    return false;
  }
  if (settings.consentRequired && consentStatus !== 'accepted') {
    return false;
  }
  return true;
}

export function shouldShowCookieConsentBanner(
  settings: PublicMarketingSettings,
  consentStatus: CookieConsentStatus
): boolean {
  if (!settings.isEnabled || !normalizeMetaPixelId(settings.pixelId)) {
    return false;
  }
  return settings.consentRequired && consentStatus === 'undecided';
}

export function canFireMetaPixelEvent(
  settings: PublicMarketingSettings,
  consentStatus: CookieConsentStatus,
  eventName: string
): eventName is AllowedMetaPixelEvent {
  // REGRA ABSOLUTA: NUNCA disparar Purchase no navegador
  if (eventName.trim().toLowerCase() === 'purchase') {
    return false;
  }
  if (!shouldLoadMetaPixel(settings, consentStatus)) {
    return false;
  }
  if (!ALLOWED_EVENTS.includes(eventName as AllowedMetaPixelEvent)) {
    return false;
  }
  return settings.events[eventName as AllowedMetaPixelEvent] === true;
}

export function readStoredCookieConsent(storage?: Pick<Storage, 'getItem'> | null): CookieConsentStatus {
  const targetStorage =
    storage !== undefined
      ? storage
      : typeof window !== 'undefined'
      ? window.localStorage
      : null;

  if (!targetStorage) return 'undecided';
  try {
    const raw = targetStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
    if (raw === 'accepted' || raw === 'declined') {
      return raw;
    }
    return 'undecided';
  } catch {
    return 'undecided';
  }
}

export function writeStoredCookieConsent(
  choice: 'accepted' | 'declined',
  storage?: Pick<Storage, 'setItem'> | null
): void {
  const targetStorage =
    storage !== undefined
      ? storage
      : typeof window !== 'undefined'
      ? window.localStorage
      : null;

  if (!targetStorage) return;
  try {
    targetStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, choice);
  } catch {
    // Continua em memória mesmo quando o navegador bloqueia armazenamento local
  }
}

// =============================================================================
// RUNTIME SEGURO NO NAVEGADOR (FBEVENTS.JS)
// =============================================================================

type FbqFunction = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue?: unknown[][];
  loaded?: boolean;
  version?: string;
  push?: (...args: unknown[]) => void;
};

declare global {
  interface Window {
    fbq?: FbqFunction;
    _fbq?: FbqFunction;
  }
}

let activeSettings: PublicMarketingSettings = createDefaultMarketingSettings();
let activeConsent: CookieConsentStatus = 'undecided';
const initializedPixelIds = new Set<string>();
let scriptInjected = false;

function ensureFbqBootstrap(pixelId: string): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  const safeId = normalizeMetaPixelId(pixelId);
  if (!safeId) return;

  if (!window.fbq) {
    const n: FbqFunction = function (...args: unknown[]) {
      if (n.callMethod) {
        n.callMethod(...args);
      } else {
        n.queue?.push(args);
      }
    };
    n.queue = [];
    n.loaded = true;
    n.version = '2.0';
    n.push = (...args: unknown[]) => {
      n.queue?.push(args);
    };
    window.fbq = n;
    if (!window._fbq) {
      window._fbq = n;
    }
  }

  if (!scriptInjected) {
    const existingScript = document.getElementById('bercali-meta-pixel-script');
    if (!existingScript) {
      const script = document.createElement('script');
      script.id = 'bercali-meta-pixel-script';
      script.async = true;
      script.src = 'https://connect.facebook.net/en_US/fbevents.js';
      const firstScript = document.getElementsByTagName('script')[0];
      if (firstScript?.parentNode) {
        firstScript.parentNode.insertBefore(script, firstScript);
      } else {
        document.head.appendChild(script);
      }
    }
    scriptInjected = true;
  }

  if (!initializedPixelIds.has(safeId)) {
    window.fbq('init', safeId);
    initializedPixelIds.add(safeId);
  }
}

export const META_PIXEL_READY_EVENT = 'bercali:meta-pixel-ready';

export function syncMetaPixelRuntime(
  settings: PublicMarketingSettings,
  consentStatus: CookieConsentStatus
): boolean {
  const wasReady = shouldLoadMetaPixel(activeSettings, activeConsent);
  activeSettings = settings;
  activeConsent = consentStatus;

  if (!shouldLoadMetaPixel(settings, consentStatus) || !settings.pixelId) {
    return false;
  }

  ensureFbqBootstrap(settings.pixelId);

  if (!wasReady && typeof window !== 'undefined') {
    window.dispatchEvent(new Event(META_PIXEL_READY_EVENT));
  }

  return true;
}

export function buildViewContentPayload(product: Pick<Product, 'id' | 'sku' | 'name' | 'category' | 'price'>) {
  return {
    content_ids: [product.sku?.trim() || product.id],
    content_name: product.name,
    content_category: product.category,
    content_type: 'product',
    value: Math.max(0, product.price),
    currency: META_PIXEL_CURRENCY,
  };
}

export function buildSearchPayload(query: string) {
  return {
    search_string: query.trim(),
    currency: META_PIXEL_CURRENCY,
  };
}

export function buildAddToCartPayload(
  product: Pick<Product, 'id' | 'sku' | 'name' | 'price'>,
  quantity: number
) {
  const safeQty = Math.max(1, Math.floor(quantity || 1));
  return {
    content_ids: [product.sku?.trim() || product.id],
    content_name: product.name,
    content_type: 'product',
    num_items: safeQty,
    value: Math.max(0, product.price * safeQty),
    currency: META_PIXEL_CURRENCY,
  };
}

export function buildInitiateCheckoutPayload(summary: OrderSummaryCalculation) {
  const totalValue = summary.estimatedTotalKz ?? summary.productsSubtotalKz;
  return {
    content_ids: summary.lines.map((line) => line.product.sku?.trim() || line.product.id),
    num_items: summary.totalItemsCount,
    value: Math.max(0, totalValue),
    currency: META_PIXEL_CURRENCY,
  };
}

export function buildContactPayload(sourceLabel?: string) {
  return {
    content_name: sourceLabel?.trim() || 'WhatsApp',
    currency: META_PIXEL_CURRENCY,
  };
}

export function dispatchMetaPixelEvent(
  eventName: string,
  payload?: Record<string, unknown>
): boolean {
  // Bloqueio incondicional de Purchase no navegador
  if (eventName.trim().toLowerCase() === 'purchase') {
    return false;
  }

  if (!canFireMetaPixelEvent(activeSettings, activeConsent, eventName)) {
    return false;
  }

  if (typeof window === 'undefined' || !activeSettings.pixelId) {
    return false;
  }

  ensureFbqBootstrap(activeSettings.pixelId);
  if (typeof window.fbq !== 'function') {
    return false;
  }

  try {
    if (payload && Object.keys(payload).length > 0) {
      window.fbq('track', eventName, payload);
    } else {
      window.fbq('track', eventName);
    }
    return true;
  } catch {
    return false;
  }
}

export function trackMetaPageView(): boolean {
  return dispatchMetaPixelEvent('PageView');
}

export function trackMetaViewContent(
  product: Pick<Product, 'id' | 'sku' | 'name' | 'category' | 'price'>
): boolean {
  return dispatchMetaPixelEvent('ViewContent', buildViewContentPayload(product));
}

export function trackMetaSearch(query: string): boolean {
  const trimmed = query.trim();
  if (!trimmed) return false;
  return dispatchMetaPixelEvent('Search', buildSearchPayload(trimmed));
}

export function trackMetaAddToCart(
  product: Pick<Product, 'id' | 'sku' | 'name' | 'price'>,
  quantity = 1
): boolean {
  return dispatchMetaPixelEvent('AddToCart', buildAddToCartPayload(product, quantity));
}

export function trackMetaInitiateCheckout(summary: OrderSummaryCalculation): boolean {
  if (summary.lines.length === 0) return false;
  return dispatchMetaPixelEvent('InitiateCheckout', buildInitiateCheckoutPayload(summary));
}

export function trackMetaContact(sourceLabel = 'WhatsApp'): boolean {
  return dispatchMetaPixelEvent('Contact', buildContactPayload(sourceLabel));
}
