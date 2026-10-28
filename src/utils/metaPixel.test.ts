import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAddToCartPayload,
  buildContactPayload,
  buildInitiateCheckoutPayload,
  buildSearchPayload,
  buildViewContentPayload,
  canFireMetaPixelEvent,
  COOKIE_CONSENT_STORAGE_KEY,
  extractMarketingSettings,
  META_PIXEL_CURRENCY,
  normalizeMetaPixelId,
  readStoredCookieConsent,
  shouldLoadMetaPixel,
  shouldShowCookieConsentBanner,
  writeStoredCookieConsent,
} from './metaPixel';
import { calculateOrderSummary } from './checkout';

test('normalizeMetaPixelId accepts valid numeric IDs and rejects invalid values', () => {
  assert.equal(normalizeMetaPixelId('123456789012345'), '123456789012345');
  assert.equal(normalizeMetaPixelId(' 9876543210 '), '9876543210');
  assert.equal(normalizeMetaPixelId(123456789012), '123456789012');
  assert.equal(normalizeMetaPixelId(''), null);
  assert.equal(normalizeMetaPixelId('00000000'), null);
  assert.equal(normalizeMetaPixelId('abc-invalid-pixel'), null);
  assert.equal(normalizeMetaPixelId(null), null);
});

test('extractMarketingSettings returns safe inactive defaults when empty or invalid', () => {
  const empty = extractMarketingSettings([]);
  assert.equal(empty.pixelId, null);
  assert.equal(empty.isEnabled, false);
  assert.equal(empty.consentRequired, false);
  assert.equal(shouldLoadMetaPixel(empty, 'accepted'), false);
  assert.equal(shouldShowCookieConsentBanner(empty, 'undecided'), false);

  const invalidId = extractMarketingSettings([
    {
      pixel_id: 'PIXEL_TESTE',
      is_enabled: true,
      consent_required: true,
      events_config: { PageView: true },
    },
  ]);
  assert.equal(invalidId.pixelId, null);
  assert.equal(invalidId.isEnabled, false);
  assert.equal(shouldLoadMetaPixel(invalidId, 'accepted'), false);
});

test('extractMarketingSettings parses live marketing_settings columns and respects events_config', () => {
  const settings = extractMarketingSettings([
    {
      id: 'row-1',
      provider: 'meta',
      pixel_id: '155443322110099',
      is_enabled: true,
      consent_required: true,
      events_config: {
        PageView: true,
        ViewContent: true,
        Search: false,
        AddToCart: true,
        InitiateCheckout: true,
        Contact: false,
        Purchase: true, // Deve ser sempre ignorado/bloqueado no navegador
      },
    },
  ]);

  assert.equal(settings.pixelId, '155443322110099');
  assert.equal(settings.isEnabled, true);
  assert.equal(settings.consentRequired, true);
  assert.equal(settings.events.PageView, true);
  assert.equal(settings.events.ViewContent, true);
  assert.equal(settings.events.Search, false);
  assert.equal(settings.events.AddToCart, true);
  assert.equal(settings.events.InitiateCheckout, true);
  assert.equal(settings.events.Contact, false);

  // Antes de aceitar consentimento, não carrega Pixel e mostra banner discreto
  assert.equal(shouldShowCookieConsentBanner(settings, 'undecided'), true);
  assert.equal(shouldLoadMetaPixel(settings, 'undecided'), false);
  assert.equal(canFireMetaPixelEvent(settings, 'undecided', 'PageView'), false);

  // Se recusar, oculta banner e continua sem carregar Pixel
  assert.equal(shouldShowCookieConsentBanner(settings, 'declined'), false);
  assert.equal(shouldLoadMetaPixel(settings, 'declined'), false);

  // Após aceitar, carrega Pixel e dispara apenas eventos ativos em events_config
  assert.equal(shouldShowCookieConsentBanner(settings, 'accepted'), false);
  assert.equal(shouldLoadMetaPixel(settings, 'accepted'), true);
  assert.equal(canFireMetaPixelEvent(settings, 'accepted', 'PageView'), true);
  assert.equal(canFireMetaPixelEvent(settings, 'accepted', 'ViewContent'), true);
  assert.equal(canFireMetaPixelEvent(settings, 'accepted', 'Search'), false);
  assert.equal(canFireMetaPixelEvent(settings, 'accepted', 'Contact'), false);

  // Regra absoluta: NUNCA dispara Purchase no navegador
  assert.equal(canFireMetaPixelEvent(settings, 'accepted', 'Purchase'), false);
  assert.equal(canFireMetaPixelEvent(settings, 'accepted', 'purchase'), false);
});

test('cookie consent choice persists in storage', () => {
  const store = new Map<string, string>();
  const mockStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
  };

  assert.equal(readStoredCookieConsent(mockStorage), 'undecided');
  writeStoredCookieConsent('accepted', mockStorage);
  assert.equal(store.get(COOKIE_CONSENT_STORAGE_KEY), 'accepted');
  assert.equal(readStoredCookieConsent(mockStorage), 'accepted');

  writeStoredCookieConsent('declined', mockStorage);
  assert.equal(readStoredCookieConsent(mockStorage), 'declined');
});

test('Meta Pixel payloads always use AOA currency and include SKU and price in Kz', () => {
  const sampleProduct = {
    id: 'prod-1',
    name: 'Smartwatch Bercali Pro',
    slug: 'smartwatch-bercali-pro',
    sku: 'BRC-SW-01',
    description: 'Relógio inteligente',
    category: 'Eletrónica',
    price: 35000,
    images: [],
    features: [],
    featured: false,
    available: true,
  };

  const viewPayload = buildViewContentPayload(sampleProduct);
  assert.equal(viewPayload.currency, META_PIXEL_CURRENCY);
  assert.equal(viewPayload.currency, 'AOA');
  assert.deepEqual(viewPayload.content_ids, ['BRC-SW-01']);
  assert.equal(viewPayload.value, 35000);

  const cartPayload = buildAddToCartPayload(sampleProduct, 2);
  assert.equal(cartPayload.currency, 'AOA');
  assert.deepEqual(cartPayload.content_ids, ['BRC-SW-01']);
  assert.equal(cartPayload.num_items, 2);
  assert.equal(cartPayload.value, 70000);

  const searchPayload = buildSearchPayload('  auscultadores  ');
  assert.equal(searchPayload.currency, 'AOA');
  assert.equal(searchPayload.search_string, 'auscultadores');

  const contactPayload = buildContactPayload('Rodapé WhatsApp');
  assert.equal(contactPayload.currency, 'AOA');
  assert.equal(contactPayload.content_name, 'Rodapé WhatsApp');

  const summary = calculateOrderSummary(
    [{ product: sampleProduct, quantity: 2, lineSubtotal: 70000 }],
    'Luanda',
    'Belas',
    [{ province: 'Luanda', municipality: 'Belas', feeKz: 2500 }]
  );
  const checkoutPayload = buildInitiateCheckoutPayload(summary);
  assert.equal(checkoutPayload.currency, 'AOA');
  assert.deepEqual(checkoutPayload.content_ids, ['BRC-SW-01']);
  assert.equal(checkoutPayload.num_items, 2);
  assert.equal(checkoutPayload.value, 72500);
});
