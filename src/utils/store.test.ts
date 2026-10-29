import test from 'node:test';
import assert from 'node:assert/strict';
import { PRODUCTS } from '../data/products';
import type { Product } from '../types/store';
import {
  calculateDiscountPercent,
  formatKz,
  getAvailabilityLabel,
  getProductAvailability,
  isProductPurchasable,
} from './format';
import { filterProducts, getDynamicCategories, getPromotionalProducts } from './catalog';
import {
  addOrIncrementCartItem,
  resolveValidatedCartLines,
  sanitizeStoredCart,
  updateCartItemQuantity,
} from './cart';
import { WHATSAPP_NUMBER } from '../config/store';
import {
  buildWhatsAppContactMessage,
  buildWhatsAppOrderMessage,
  buildWhatsAppProductInquiryMessage,
  buildWhatsAppUrl,
  calculateOrderSummary,
  formatInternationalWhatsApp,
  hasConfiguredWhatsApp,
  hasValidationErrors,
  isValidWhatsAppNumber,
  normalizeWhatsAppNumber,
  validateCheckoutForm,
} from './checkout';
import {
  applyFeaturedSelection,
  attachRelationsToProducts,
  buildCreateStorefrontOrderRpcArgs,
  buildStoreCategories,
  buildSupabaseOrderPayloads,
  classifyCheckoutRpcError,
  extractPublicStoreSettings,
  extractWhatsAppFromSettings,
  isPublishedProductRow,
  mapSupabaseProductToStoreProduct,
  resolveProductMediaUrl,
} from './supabaseMapper';

const TEST_CATALOG: Product[] = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Carregador Portátil Solar 20.000 mAh',
    slug: 'carregador-portatil-solar-20000-mah',
    sku: 'BRC-001',
    description: 'Bateria externa de alta capacidade com USB-C.',
    category: 'Energia e acessórios',
    categorySlug: 'energia-e-acessorios',
    price: 24500,
    oldPrice: 29000,
    images: ['https://example.supabase.co/storage/v1/object/public/product-media/products/brc-001/1.jpg'],
    features: [],
    stock: 8,
    featured: true,
    isNew: true,
    available: true,
    availabilityStatus: 'available',
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    name: 'Auscultadores Bluetooth Dobráveis',
    slug: 'auscultadores-bluetooth-dobraveis',
    sku: 'BRC-002',
    description: 'Auscultadores sem fios com estrutura dobrável.',
    category: 'Eletrónica',
    categorySlug: 'eletronica',
    price: 32000,
    oldPrice: 36500,
    images: [],
    features: [],
    stock: 5,
    featured: true,
    isNew: false,
    available: true,
    availabilityStatus: 'available',
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    name: 'Candeeiro de Secretária LED',
    slug: 'candeeiro-secretaria-led',
    sku: 'BRC-003',
    description: 'Iluminação recarregável por USB-C.',
    category: 'Casa',
    categorySlug: 'casa',
    price: 12500,
    images: [],
    features: [],
    stock: 10,
    featured: false,
    isNew: true,
    available: true,
    availabilityStatus: 'available',
  },
  {
    id: '44444444-4444-4444-8444-444444444444',
    name: 'Suporte Articulado para Portátil',
    slug: 'suporte-articulado-portatil',
    sku: 'BRC-004',
    description: 'Suporte dobrável em liga de alumínio.',
    category: 'Tecnologia',
    categorySlug: 'tecnologia',
    price: 15000,
    images: [],
    features: [],
    stock: 0,
    featured: false,
    isNew: false,
    available: false,
    availabilityStatus: 'out_of_stock',
  },
  {
    id: '55555555-5555-5555-8555-555555555555',
    name: 'Mochila Urbana Impermeável',
    slug: 'mochila-urbana-impermeavel',
    sku: 'BRC-005',
    description: 'Mochila resistente a salpicos de água.',
    category: 'Acessórios',
    categorySlug: 'acessorios',
    price: 19800,
    images: [],
    features: [],
    stock: 4,
    featured: false,
    isNew: false,
    available: false,
    availabilityStatus: 'temporarily_unavailable',
  },
];

test('production data file contains zero hardcoded demo products', () => {
  assert.equal(PRODUCTS.length, 0);
});

test('formatKz formats Angolan Kwanza amounts according to Bercali brand manual', () => {
  assert.equal(formatKz(12500), '12.500 Kz');
  assert.equal(formatKz(24500), '24.500 Kz');
  assert.equal(formatKz(1350000), '1.350.000 Kz');
  assert.equal(formatKz(0), '0 Kz');
  assert.equal(formatKz(-50), '0 Kz');
});

test('calculateDiscountPercent returns real discount only when oldPrice > price', () => {
  assert.equal(calculateDiscountPercent(24500, 29000), 16);
  assert.equal(calculateDiscountPercent(20000, 20000), null);
  assert.equal(calculateDiscountPercent(25000, 20000), null);
  assert.equal(calculateDiscountPercent(25000, undefined), null);
});

test('product availability prevents purchasing out_of_stock and temporarily_unavailable items', () => {
  const availableItem = TEST_CATALOG[0];
  const outOfStockItem = TEST_CATALOG.find((p) => p.availabilityStatus === 'out_of_stock')!;
  const tempUnavailableItem = TEST_CATALOG.find(
    (p) => p.availabilityStatus === 'temporarily_unavailable'
  )!;

  assert.equal(isProductPurchasable(availableItem), true);
  assert.equal(isProductPurchasable(outOfStockItem), false);
  assert.equal(isProductPurchasable(tempUnavailableItem), false);
  assert.equal(getAvailabilityLabel(getProductAvailability(outOfStockItem)), 'Esgotado');
  assert.equal(
    getAvailabilityLabel(getProductAvailability(tempUnavailableItem)),
    'Temporariamente indisponível'
  );
});

test('filterProducts handles accent/case-insensitive search, SKU search, and dynamic categories', () => {
  const categories = getDynamicCategories(TEST_CATALOG);
  assert.equal(categories.length, 5);

  const searchResult = filterProducts(TEST_CATALOG, { query: 'ELETRONICA' });
  assert.equal(searchResult.length, 1);
  assert.equal(searchResult[0].category, 'Eletrónica');

  const skuSearch = filterProducts(TEST_CATALOG, { query: 'brc-003' });
  assert.equal(skuSearch.length, 1);
  assert.equal(skuSearch[0].slug, 'candeeiro-secretaria-led');

  const emptySearch = filterProducts(TEST_CATALOG, { query: 'produto-que-nao-existe-xyz' });
  assert.equal(emptySearch.length, 0);

  const promos = getPromotionalProducts(TEST_CATALOG);
  assert.equal(promos.length, 2);
});

test('cart clamps quantities to stock, blocks unavailable products, and sanitizes localStorage', () => {
  const solar = TEST_CATALOG[0]; // stock: 8
  const soldOut = TEST_CATALOG.find((p) => p.availabilityStatus === 'out_of_stock')!;

  let cart = addOrIncrementCartItem([], solar, 3);
  assert.equal(cart.length, 1);
  assert.equal(cart[0].quantity, 3);

  cart = addOrIncrementCartItem(cart, solar, 20);
  assert.equal(cart[0].quantity, 8);

  cart = updateCartItemQuantity(cart, solar, 0);
  assert.equal(cart[0].quantity, 8);

  cart = addOrIncrementCartItem(cart, soldOut, 1);
  assert.equal(cart.length, 1);

  const tampered = [
    { productId: solar.id, quantity: 999 },
    { productId: soldOut.id, quantity: 2 },
    { productId: 'fake-id', quantity: 1 },
    null,
    'invalid',
  ];
  const sanitized = sanitizeStoredCart(tampered, TEST_CATALOG);
  assert.deepEqual(sanitized, [{ productId: solar.id, quantity: 8 }]);
});

test('checkout validation, delivery fee fallback, order number, and WhatsApp URL encoding work accurately', () => {
  const invalidErrors = validateCheckoutForm({
    fullName: '',
    phone: '123',
    province: '',
    municipality: '',
    neighborhood: '',
    addressReference: '',
    notes: '',
  });
  assert.equal(hasValidationErrors(invalidErrors), true);
  assert.ok(invalidErrors.fullName);
  assert.ok(invalidErrors.phone);
  assert.ok(invalidErrors.province);

  const validCustomer = {
    fullName: 'Mateus Manuel',
    phone: '923 456 789',
    province: 'Luanda',
    municipality: 'Belas',
    neighborhood: 'Talatona',
    addressReference: 'Próximo à rotunda principal, edifício 4',
    notes: 'Ligar antes da entrega',
  };
  assert.equal(hasValidationErrors(validateCheckoutForm(validCustomer)), false);

  const lines = resolveValidatedCartLines(
    [{ productId: TEST_CATALOG[0].id, quantity: 2 }],
    TEST_CATALOG
  );
  const summaryPending = calculateOrderSummary(lines, 'Luanda', 'Belas', []);
  assert.equal(summaryPending.productsSubtotalKz, 49000);
  assert.equal(summaryPending.delivery.label, 'A confirmar pela loja');
  assert.equal(summaryPending.estimatedTotalKz, null);

  const summaryWithRule = calculateOrderSummary(lines, 'Luanda', 'Belas', [
    { province: 'Luanda', municipality: 'Belas', feeKz: 2000 },
  ]);
  assert.equal(summaryWithRule.estimatedTotalKz, 51000);

  const message = buildWhatsAppOrderMessage(validCustomer, summaryPending, 'BRC-20261025-1234');
  assert.ok(message.includes('Olá, Bercali Store! Quero fazer uma encomenda.'));
  assert.ok(message.includes('Pedido nº: BRC-20261025-1234'));
  assert.ok(message.includes('(SKU: BRC-001)'));
  assert.ok(message.includes('Nome: Mateus Manuel'));
  assert.ok(message.includes('Subtotal dos produtos: 49.000 Kz'));
  assert.ok(message.includes('Entrega: A confirmar pela loja'));

  assert.equal(isValidWhatsAppNumber('SUBSTITUIR_PELO_NUMERO_OFICIAL'), false);
  assert.equal(isValidWhatsAppNumber('244923000000'), true);
  assert.equal(isValidWhatsAppNumber('+244 923 000 000'), false);

  const urlWithNumber = buildWhatsAppUrl('244923000000', message);
  assert.ok(urlWithNumber.startsWith('https://wa.me/244923000000?text='));
  assert.equal(decodeURIComponent(urlWithNumber.split('?text=')[1]), message);
});

test('Supabase client validator accepts anon/publishable keys and blocks service_role/secret keys', async () => {
  const { isValidSupabaseUrl, validatePublicSupabaseKey } = await import('../lib/supabase');

  assert.equal(isValidSupabaseUrl('https://abcdefghijklm.supabase.co'), true);
  assert.equal(isValidSupabaseUrl(''), false);
  assert.equal(isValidSupabaseUrl('ftp://invalid.supabase.co'), false);

  const makeJwt = (role: string) => {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ role, iss: 'supabase' })).toString('base64url');
    return `${header}.${payload}.signature`;
  };

  assert.deepEqual(validatePublicSupabaseKey(makeJwt('anon')), { valid: true });
  assert.deepEqual(validatePublicSupabaseKey('sb_publishable_1234567890abcdef'), { valid: true });

  assert.deepEqual(validatePublicSupabaseKey(makeJwt('service_role')), {
    valid: false,
    reason: 'forbidden_secret_key',
  });
  assert.deepEqual(validatePublicSupabaseKey('sb_secret_1234567890abcdef'), {
    valid: false,
    reason: 'forbidden_secret_key',
  });
});

test('supabaseMapper maps published products, media URLs, sale prices, categories, settings, and order payloads', () => {
  const baseUrl = 'https://dyhwbzyiuzrdmiogzwdg.supabase.co';

  // Draft/archived products are strictly excluded from the storefront
  assert.equal(isPublishedProductRow({ status: 'draft' }), false);
  assert.equal(isPublishedProductRow({ status: 'archived' }), false);
  assert.equal(isPublishedProductRow({ status: 'published' }), true);
  assert.equal(isPublishedProductRow({ status: 'active' }), true);

  // Storage path resolution handles relative bucket paths and full URLs
  assert.equal(
    resolveProductMediaUrl(
      { storage_path: 'products/cst-00011/1792903973657-ws4yn.jpg', media_url: null },
      baseUrl
    ),
    'https://dyhwbzyiuzrdmiogzwdg.supabase.co/storage/v1/object/public/product-media/products/cst-00011/1792903973657-ws4yn.jpg'
  );

  const draftMapped = mapSupabaseProductToStoreProduct(
    {
      id: 'prod-draft',
      name: 'Rascunho',
      slug: 'rascunho',
      price: 10000,
      status: 'draft',
      is_available: true,
    },
    baseUrl
  );
  assert.equal(draftMapped, null);

  const publishedMapped = mapSupabaseProductToStoreProduct(
    {
      id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      name: 'Smartwatch Bercali Pro',
      slug: 'smartwatch-bercali-pro',
      sku: 'CST-00011',
      description: 'Relógio inteligente resistente à água.',
      category_id: 'cat-1',
      price: '35000',
      sale_price: '29500',
      stock_quantity: 12,
      status: 'published',
      is_available: true,
      created_at: new Date().toISOString(),
      categories: {
        id: 'cat-1',
        name: 'Relógios e Smartwatches',
        slug: 'relogios-smartwatches',
        is_active: true,
      },
      product_media: [
        {
          id: 'm2',
          product_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
          storage_path: 'products/cst-00011/1792903974924-xwn5e.jpg',
          media_type: 'image/jpeg',
          sort_order: 2,
        },
        {
          id: 'm1',
          product_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
          storage_path: 'products/cst-00011/1792903973657-ws4yn.jpg',
          media_type: 'image/jpeg',
          sort_order: 1,
        },
        {
          id: 'm3',
          product_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
          storage_path: 'products/cst-00011/demo.mp4',
          media_type: 'video/mp4',
          alt_text: 'Demonstração real',
          sort_order: 3,
        },
      ],
    },
    baseUrl
  );

  assert.ok(publishedMapped);
  assert.equal(publishedMapped.price, 29500);
  assert.equal(publishedMapped.oldPrice, 35000);
  assert.equal(publishedMapped.sku, 'CST-00011');
  assert.equal(publishedMapped.category, 'Relógios e Smartwatches');
  assert.equal(publishedMapped.categorySlug, 'relogios-smartwatches');
  assert.equal(publishedMapped.images.length, 2);
  assert.ok(publishedMapped.images[0].endsWith('1792903973657-ws4yn.jpg'));
  assert.ok(publishedMapped.video?.mp4?.endsWith('demo.mp4'));
  assert.equal(publishedMapped.video?.caption, 'Demonstração real');
  assert.equal(publishedMapped.isNew, true);
  assert.equal(publishedMapped.available, true);

  // Categories include active Supabase categories even with 0 products, and exclude inactive ones
  const mergedCategories = buildStoreCategories(
    [
      { id: 'cat-1', name: 'Relógios e Smartwatches', slug: 'relogios-smartwatches', is_active: true },
      { id: 'cat-2', name: 'Áudio', slug: 'audio', is_active: true },
      { id: 'cat-3', name: 'Inativa', slug: 'inativa', is_active: false },
    ],
    [publishedMapped]
  );
  assert.equal(mergedCategories.length, 2);
  assert.equal(mergedCategories[0].count, 1);
  assert.equal(mergedCategories[0].availableCount, 1);
  assert.equal(mergedCategories[1].count, 0);

  // Featured selection avoids duplicate home grids when <= 4 products, and picks up to 4 when > 4
  assert.equal(applyFeaturedSelection([publishedMapped])[0].featured, false);
  const featuredFive = applyFeaturedSelection(TEST_CATALOG);
  assert.equal(featuredFive.filter((p) => p.featured).length, 3); // 3 purchasable items in TEST_CATALOG

  // Store settings WhatsApp extraction normalizes 9-digit Angolan numbers to 244 prefix
  assert.equal(
    extractWhatsAppFromSettings(
      [{ setting_key: 'whatsapp_number', setting_value: '+244 923 111 222' }],
      'SUBSTITUIR_PELO_NUMERO_OFICIAL'
    ),
    '244923111222'
  );
  assert.equal(
    extractWhatsAppFromSettings(
      [{ setting_key: 'general', setting_value: { whatsapp: '924000111' } }],
      'SUBSTITUIR_PELO_NUMERO_OFICIAL'
    ),
    '244924000111'
  );

  // Order payload matches exact customers, orders, and order_items columns
  const lines = resolveValidatedCartLines(
    [{ productId: publishedMapped.id, quantity: 2 }],
    [publishedMapped]
  );
  const summary = calculateOrderSummary(lines, 'Luanda', 'Talatona', []);
  const payloads = buildSupabaseOrderPayloads({
    customerId: 'cust-uuid-1',
    orderId: 'order-uuid-1',
    orderNumber: 'BRC-20261025-9999',
    customer: {
      fullName: 'Ana Paula',
      phone: '923 999 888',
      province: 'Luanda',
      municipality: 'Talatona',
      neighborhood: 'Benfica',
      addressReference: 'Rua 5, Casa 12',
      notes: 'Entregar de tarde',
    },
    summary,
  });

  assert.deepEqual(payloads.customerRow, {
    id: 'cust-uuid-1',
    full_name: 'Ana Paula',
    phone: '923 999 888',
    email: null,
    city: 'Talatona, Luanda',
    notes: 'Entregar de tarde',
    source: 'online_store',
  });
  assert.equal(payloads.orderRow.order_number, 'BRC-20261025-9999');
  assert.equal(payloads.orderRow.customer_id, 'cust-uuid-1');
  assert.equal(payloads.orderRow.status, 'pending');
  assert.equal(payloads.orderRow.payment_status, 'pending');
  assert.equal(payloads.orderRow.source, 'online_store');
  assert.equal(payloads.orderRow.subtotal, 59000);
  assert.equal(payloads.orderRow.total_amount, 59000);
  assert.equal(payloads.orderRow.currency, 'AOA');
  assert.ok(payloads.orderRow.delivery_address.includes('Província: Luanda'));
  assert.equal(payloads.orderItemRows.length, 1);
  assert.deepEqual(payloads.orderItemRows[0], {
    order_id: 'order-uuid-1',
    product_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    product_name: 'Smartwatch Bercali Pro',
    product_sku: 'CST-00011',
    quantity: 2,
    unit_price: 29500,
    line_total: 59000,
  });
});

test('non-draft Admin Panel status variants, decoupled joins, missing categories, and zero-price sale_price never drop valid products', () => {
  const baseUrl = 'https://dyhwbzyiuzrdmiogzwdg.supabase.co';

  for (const visibleStatus of [
    'published',
    'active',
    'available',
    'in_stock',
    'low_stock',
    'out_of_stock',
    'disponivel',
    'disponível',
    'esgotado',
    null,
    '',
  ]) {
    assert.equal(
      isPublishedProductRow({ status: visibleStatus }),
      true,
      `Expected status "${String(visibleStatus)}" to remain visible`
    );
  }

  for (const hiddenStatus of [
    'draft',
    'rascunho',
    'archived',
    'arquivado',
    'inactive',
    'inativo',
    'hidden',
    'oculto',
  ]) {
    assert.equal(
      isPublishedProductRow({ status: hiddenStatus }),
      false,
      `Expected status "${hiddenStatus}" to be hidden`
    );
  }

  // Decoupled flat table join keeps products even when categories or product_media are empty
  const joined = attachRelationsToProducts(
    [
      {
        id: 'prod-1',
        name: 'Artigo CST-00011',
        sku: 'CST-00011',
        category_id: 'missing-cat',
        price: 0,
        sale_price: 18500,
        stock_quantity: 0,
        status: 'out_of_stock',
        is_available: true,
      },
    ],
    [],
    [
      {
        id: 'med-1',
        product_id: 'prod-1',
        storage_path: 'products/cst-00011/1792903973657-ws4yn.jpg',
        media_type: 'image/jpeg',
        sort_order: 1,
      },
    ]
  );

  const mapped = mapSupabaseProductToStoreProduct(joined[0], baseUrl);
  assert.ok(mapped);
  assert.equal(mapped.price, 18500);
  assert.equal(mapped.category, 'Geral');
  assert.equal(mapped.availabilityStatus, 'out_of_stock');
  assert.equal(mapped.available, false);
  assert.equal(mapped.images.length, 1);
});

test('manage_stock=false keeps zero-quantity custom products purchasable while manage_stock=true enforces stock', () => {
  const baseUrl = 'https://dyhwbzyiuzrdmiogzwdg.supabase.co';

  const unmanagedProduct = mapSupabaseProductToStoreProduct(
    {
      id: 'prod-custom-closet',
      name: 'Closet Sob Medida',
      slug: 'closet-sob-medida',
      sku: 'CLS-010',
      price: 150000,
      stock_quantity: 0,
      manage_stock: false,
      status: 'active',
      is_available: true,
    },
    baseUrl
  );

  assert.ok(unmanagedProduct);
  assert.equal(unmanagedProduct.manageStock, false);
  assert.equal(unmanagedProduct.availabilityStatus, 'available');
  assert.equal(isProductPurchasable(unmanagedProduct), true);

  const cartWithCustom = addOrIncrementCartItem([], unmanagedProduct, 3);
  assert.equal(cartWithCustom.length, 1);
  assert.equal(cartWithCustom[0].quantity, 3);
});

test('extractPublicStoreSettings syncs commercial info, contacts, socials, delivery rules, banners, and store status without inventing missing links or exposing secrets', async () => {
  const { extractPublicStoreSettings } = await import('./supabaseMapper');
  const { buildWhatsAppProductInquiryMessage } = await import('./checkout');

  // Empty settings never invent contacts, emails, or social links
  const defaults = extractPublicStoreSettings([]);
  assert.equal(defaults.brandName, 'Bercali Store');
  assert.equal(defaults.isStoreActive, true);
  assert.equal(defaults.email, null);
  assert.equal(defaults.phone, null);
  assert.deepEqual(defaults.socialLinks, {});

  // Rich Admin Panel settings (both grouped JSON and flat rows) + ignored secret/pixel rows
  const synced = extractPublicStoreSettings(
    [
      {
        setting_key: 'general',
        setting_value: {
          store_name: 'Bercali Store Angola',
          slogan: 'Qualidade e rapidez em Luanda',
          whatsapp: '+244 923 555 777',
          phone: '+244 923 555 777',
          email: 'contacto@bercalistore.ao',
          address: 'Talatona, Luanda',
          instagram: '@bercalistore',
          facebook: 'https://facebook.com/bercalistore',
          is_store_active: false,
          closed_message: 'Estamos em inventário até às 14h.',
        },
      },
      {
        setting_key: 'delivery',
        setting_value: {
          free_delivery_threshold: 100000,
          default_delivery_fee: 3500,
          zones: [
            { province: 'Luanda', municipality: 'Belas', feeKz: 2500, estimatedTime: '2h a 4h' },
          ],
        },
      },
      {
        setting_key: 'promo_banner',
        setting_value: { text: 'Entrega grátis acima de 100.000 Kz em Luanda!' },
      },
      {
        setting_key: 'meta_pixel_secret_token',
        setting_value: 'SHOULD_NEVER_BE_READ',
      },
    ],
    'https://dyhwbzyiuzrdmiogzwdg.supabase.co'
  );

  assert.equal(synced.brandName, 'Bercali Store Angola');
  assert.equal(synced.whatsappNumber, '244923555777');
  assert.equal(synced.phone, '+244 923 555 777');
  assert.equal(synced.email, 'contacto@bercalistore.ao');
  assert.equal(synced.address, 'Talatona, Luanda');
  assert.equal(synced.socialLinks.instagram, 'https://instagram.com/bercalistore');
  assert.equal(synced.socialLinks.facebook, 'https://facebook.com/bercalistore');
  assert.equal(synced.socialLinks.tiktok, undefined);
  assert.equal(synced.isStoreActive, false);
  assert.equal(synced.closedMessage, 'Estamos em inventário até às 14h.');
  assert.equal(synced.freeDeliveryThresholdKz, 100000);
  assert.equal(synced.defaultDeliveryFeeKz, 3500);
  assert.equal(synced.deliveryFeeRules.length, 1);
  assert.equal(synced.deliveryFeeRules[0].feeKz, 2500);
  assert.equal(synced.promoBanner?.text, 'Entrega grátis acima de 100.000 Kz em Luanda!');

  // Product inquiry WhatsApp message includes selected product name, SKU, price, and quantity
  const inquiryMsg = buildWhatsAppProductInquiryMessage(
    TEST_CATALOG[0],
    2,
    synced.brandName
  );
  assert.ok(inquiryMsg.includes('Bercali Store Angola'));
  assert.ok(inquiryMsg.includes('Carregador Portátil Solar 20.000 mAh'));
  assert.ok(inquiryMsg.includes('Ref./SKU: BRC-001'));
  assert.ok(inquiryMsg.includes('24.500 Kz'));
  assert.ok(inquiryMsg.includes('Quantidade pretendida: 2'));
});

test('verifyAndRecalculateOrder enforces store closure, stock availability, and live server prices over stale client prices', async () => {
  const { verifyAndRecalculateOrder } = await import('./supabaseMapper');

  const customer = {
    fullName: 'Carlos Neto',
    phone: '923 888 777',
    email: 'carlos@exemplo.ao',
    province: 'Luanda',
    municipality: 'Belas',
    neighborhood: 'Talatona',
    addressReference: 'Rua Direita, Casa 10',
    notes: '',
  };

  // 1. Blocks order registration when store is inactive in store_settings
  const closedCheck = verifyAndRecalculateOrder({
    requestedItems: [{ productId: '6cfa42de-1bf6-4595-9f2e-73d682bfeecf', quantity: 1 }],
    customer,
    liveProductRows: [
      {
        id: '6cfa42de-1bf6-4595-9f2e-73d682bfeecf',
        name: 'Closets',
        slug: 'closets-001',
        sku: '001',
        price: 80,
        sale_price: 65,
        stock_quantity: 80,
        manage_stock: true,
        is_available: true,
        status: 'active',
      },
    ],
    liveSettingsRows: [
      { setting_key: 'is_active', setting_value: false },
      { setting_key: 'closed_message', setting_value: 'Loja encerrada temporariamente.' },
    ],
  });

  assert.equal(closedCheck.ok, false);
  if (!closedCheck.ok) {
    assert.equal(closedCheck.reason, 'store_closed');
    assert.equal(closedCheck.message, 'Loja encerrada temporariamente.');
  }

  // 2. Blocks order registration when requested quantity exceeds live stock
  const stockConflictCheck = verifyAndRecalculateOrder({
    requestedItems: [{ productId: '6cfa42de-1bf6-4595-9f2e-73d682bfeecf', quantity: 5 }],
    customer,
    liveProductRows: [
      {
        id: '6cfa42de-1bf6-4595-9f2e-73d682bfeecf',
        name: 'Closets',
        slug: 'closets-001',
        sku: '001',
        price: 150000,
        sale_price: 130000,
        stock_quantity: 2,
        manage_stock: true,
        is_available: true,
        status: 'active',
      },
    ],
    liveSettingsRows: [{ setting_key: 'is_active', setting_value: true }],
  });

  assert.equal(stockConflictCheck.ok, false);
  if (!stockConflictCheck.ok) {
    assert.equal(stockConflictCheck.reason, 'stock_conflict');
  }

  // 3. Recalculates authoritative prices & delivery fee from live DB rows (ignoring any tampered browser price)
  const validCheck = verifyAndRecalculateOrder({
    requestedItems: [{ productId: '6cfa42de-1bf6-4595-9f2e-73d682bfeecf', quantity: 2 }],
    customer,
    liveProductRows: [
      {
        id: '6cfa42de-1bf6-4595-9f2e-73d682bfeecf',
        name: 'Closets',
        slug: 'closets-001',
        sku: '001',
        price: 150000,
        sale_price: 130000,
        stock_quantity: 10,
        manage_stock: true,
        is_available: true,
        status: 'active',
      },
    ],
    liveSettingsRows: [
      { setting_key: 'is_active', setting_value: true },
      {
        setting_key: 'delivery_fee_rules',
        setting_value: [{ province: 'Luanda', municipality: 'Belas', feeKz: 2500 }],
      },
    ],
  });

  assert.equal(validCheck.ok, true);
  if (validCheck.ok) {
    assert.equal(validCheck.verifiedSummary.productsSubtotalKz, 260000);
    assert.equal(validCheck.verifiedSummary.delivery.amountKz, 2500);
    assert.equal(validCheck.verifiedSummary.estimatedTotalKz, 262500);
  }
});

test('WhatsApp configuration has no hardcoded phone number and normalizes +244 links cleanly', () => {
  assert.equal(WHATSAPP_NUMBER, '');
  assert.equal(hasConfiguredWhatsApp(''), false);
  assert.equal(buildWhatsAppUrl('', 'Olá'), '');
  assert.equal(buildWhatsAppUrl('   ', 'Olá'), '');

  assert.equal(normalizeWhatsAppNumber('+244 923 111 222'), '244923111222');
  assert.equal(normalizeWhatsAppNumber('923 111 222'), '244923111222');
  assert.equal(normalizeWhatsAppNumber('00244923111222'), '244923111222');
  assert.equal(formatInternationalWhatsApp('923111222'), '+244923111222');

  const link = buildWhatsAppUrl('+244 923 111 222', 'Olá Bercali');
  assert.equal(link, 'https://wa.me/244923111222?text=Ol%C3%A1%20Bercali');
});

test('extractPublicStoreSettings reads WhatsApp number and message templates from store_settings', () => {
  const emptySettings = extractPublicStoreSettings([]);
  assert.equal(emptySettings.whatsappNumber, '');
  assert.equal(emptySettings.whatsappMessageTemplate, null);

  const configured = extractPublicStoreSettings([
    { setting_key: 'whatsapp_number', setting_value: '923 444 555' },
    {
      setting_key: 'whatsapp_message_template',
      setting_value: 'Olá equipa {{loja}}, preciso de apoio!',
    },
    {
      setting_key: 'whatsapp_order_template',
      setting_value: 'Novo pedido {{codigo}} para {{loja}}:\n{{itens}}\nTotal: {{total}}',
    },
  ]);

  assert.equal(configured.whatsappNumber, '244923444555');
  assert.equal(
    buildWhatsAppContactMessage('Bercali Store', configured.whatsappMessageTemplate),
    'Olá equipa Bercali Store, preciso de apoio!'
  );

  const productMsg = buildWhatsAppProductInquiryMessage(
    TEST_CATALOG[0],
    1,
    'Bercali Store',
    'Olá {{loja}}, quero encomendar {{produto}} ({{preco}}).'
  );
  assert.ok(productMsg.includes('Carregador Portátil Solar 20.000 mAh'));

  const summary = calculateOrderSummary(
    [{ product: TEST_CATALOG[0], quantity: 2, lineSubtotal: 49000 }],
    '',
    '',
    []
  );
  const orderMsg = buildWhatsAppOrderMessage(
    {
      fullName: 'Ana Silva',
      phone: '923000111',
      province: '',
      municipality: '',
      neighborhood: '',
      addressReference: '',
      notes: '',
    },
    summary,
    'BRC-20261028-9999',
    'Bercali Store',
    configured.whatsappOrderTemplate
  );
  assert.ok(orderMsg.includes('BRC-20261028-9999'));
  assert.ok(orderMsg.includes('Carregador Portátil Solar 20.000 mAh'));
  assert.ok(orderMsg.includes('49.000 Kz'));
});

test('validateCheckoutForm in storefront mode requires name, phone, and zone only when zones exist', () => {
  const baseCustomer = {
    fullName: 'Carlos Mateus',
    phone: '923 123 456',
    deliveryZone: '',
    province: '',
    municipality: '',
    neighborhood: '',
    addressReference: '',
    notes: '',
  };

  // Sem zonas configuradas: apenas nome e telefone são obrigatórios
  const noZonesErrors = validateCheckoutForm(baseCustomer, {
    mode: 'storefront',
    deliveryZones: [],
  });
  assert.equal(hasValidationErrors(noZonesErrors), false);

  // Com zonas configuradas: exige seleção de zona de entrega
  const zones = [{ zoneName: 'Talatona', province: 'Luanda', feeKz: 2000 }];
  const missingZoneErrors = validateCheckoutForm(baseCustomer, {
    mode: 'storefront',
    deliveryZones: zones,
  });
  assert.equal(Boolean(missingZoneErrors.deliveryZone), true);

  const validWithZoneErrors = validateCheckoutForm(
    { ...baseCustomer, deliveryZone: 'Talatona' },
    { mode: 'storefront', deliveryZones: zones }
  );
  assert.equal(hasValidationErrors(validWithZoneErrors), false);
});

test('buildCreateStorefrontOrderRpcArgs builds exact parameter names, UUID productId, integer quantity, and min-3-char address', () => {
  const lines = resolveValidatedCartLines(
    [{ productId: TEST_CATALOG[0].id, quantity: 3 }],
    TEST_CATALOG
  );
  const zones = [
    {
      id: 'zone-uuid-talatona',
      zoneName: 'Talatona',
      province: 'Luanda',
      feeKz: 2500,
    },
  ];
  const summaryWithZone = calculateOrderSummary(lines, 'Luanda', '', zones, {
    deliveryZone: 'Talatona',
  });

  const rpcArgs = buildCreateStorefrontOrderRpcArgs({
    customer: {
      fullName: '  João Baptista  ',
      phone: ' 923 111 222 ',
      email: '  joao@exemplo.ao ',
      deliveryZone: 'Talatona',
      province: 'Luanda',
      municipality: 'Belas',
      neighborhood: 'Talatona',
      addressReference: 'Rua 10, Casa 4',
      notes: '  Entregar de manhã ',
    },
    summary: summaryWithZone,
    idempotencyKey: 'BRC-20261029-1234-uniq1',
    deliveryZones: zones,
  });

  assert.deepEqual(Object.keys(rpcArgs).sort(), [
    'p_customer_city',
    'p_customer_email',
    'p_customer_name',
    'p_customer_notes',
    'p_customer_phone',
    'p_delivery_address',
    'p_delivery_fee',
    'p_delivery_zone_id',
    'p_idempotency_key',
    'p_items',
    'p_source',
  ]);

  assert.equal(rpcArgs.p_customer_name, 'João Baptista');
  assert.equal(rpcArgs.p_customer_phone, '923 111 222');
  assert.equal(rpcArgs.p_customer_email, 'joao@exemplo.ao');
  assert.equal(rpcArgs.p_customer_city, 'Belas, Luanda');
  assert.ok(rpcArgs.p_delivery_address.length >= 3);
  assert.equal(rpcArgs.p_delivery_zone_id, 'zone-uuid-talatona');
  assert.equal(typeof rpcArgs.p_delivery_fee, 'number');
  assert.equal(rpcArgs.p_delivery_fee, 2500);
  assert.equal(rpcArgs.p_customer_notes, 'Entregar de manhã');
  assert.equal(rpcArgs.p_source, 'whatsapp_store');
  assert.equal(rpcArgs.p_idempotency_key, 'BRC-20261029-1234-uniq1');

  assert.equal(rpcArgs.p_items.length, 1);
  assert.deepEqual(Object.keys(rpcArgs.p_items[0]), ['productId', 'quantity']);
  assert.equal(rpcArgs.p_items[0].productId, '11111111-1111-4111-8111-111111111111');
  assert.notEqual(rpcArgs.p_items[0].productId, TEST_CATALOG[0].sku);
  assert.equal(rpcArgs.p_items[0].quantity, 3);
  assert.equal(Number.isInteger(rpcArgs.p_items[0].quantity), true);

  // Sem campos opcionais nem zona: email e zone_id são null, e morada mantém mínimo de 3 caracteres
  const minimalSummary = calculateOrderSummary(lines, '', '', []);
  const minimalArgs = buildCreateStorefrontOrderRpcArgs({
    customer: {
      fullName: 'Maria Silva',
      phone: '924000999',
      email: '',
      deliveryZone: '',
      province: '',
      municipality: '',
      neighborhood: '',
      addressReference: '',
      notes: '',
    },
    summary: minimalSummary,
    idempotencyKey: 'BRC-20261029-5678-uniq2',
    deliveryZones: [],
  });

  assert.equal(minimalArgs.p_customer_email, null);
  assert.equal(minimalArgs.p_delivery_zone_id, null);
  assert.equal(minimalArgs.p_delivery_fee, 0);
  assert.equal(minimalArgs.p_customer_notes, '');
  assert.equal(minimalArgs.p_source, 'whatsapp_store');
  assert.ok(minimalArgs.p_delivery_address.length >= 3);
});

test('classifyCheckoutRpcError surfaces server business-rule messages and hides internal SQL/RLS errors', () => {
  const stockErr = classifyCheckoutRpcError({
    code: 'P0001',
    message: 'Stock insuficiente para Carregador Solar (disponível: 1).',
    details: null,
  });
  assert.equal(stockErr.isBusinessRule, true);
  assert.equal(stockErr.status, 'stock_conflict');
  assert.equal(stockErr.serverMessage, 'Stock insuficiente para Carregador Solar (disponível: 1).');

  const unavailErr = classifyCheckoutRpcError({
    code: 'P0001',
    message: 'PRODUTO_INDISPONIVEL: O artigo selecionado já não está disponível.',
    details: null,
  });
  assert.equal(unavailErr.isBusinessRule, true);
  assert.equal(unavailErr.status, 'stock_conflict');
  assert.equal(unavailErr.serverMessage, 'O artigo selecionado já não está disponível.');

  const closedErr = classifyCheckoutRpcError({
    code: 'P0001',
    message: 'A loja encontra-se encerrada neste momento.',
    details: null,
  });
  assert.equal(closedErr.isBusinessRule, true);
  assert.equal(closedErr.status, 'store_closed');
  assert.equal(closedErr.serverMessage, 'A loja encontra-se encerrada neste momento.');

  const invalidDataErr = classifyCheckoutRpcError({
    code: '22023',
    message: 'O endereço de entrega deve ter pelo menos 3 caracteres.',
    details: null,
  });
  assert.equal(invalidDataErr.isBusinessRule, true);
  assert.equal(invalidDataErr.status, 'error');
  assert.equal(
    invalidDataErr.serverMessage,
    'O endereço de entrega deve ter pelo menos 3 caracteres.'
  );

  // Erros técnicos de esquema ou permissões RLS não expõem detalhes internos no ecrã
  const rlsErr = classifyCheckoutRpcError({
    code: '42501',
    message: 'permission denied for function create_storefront_order',
    details: null,
  });
  assert.equal(rlsErr.isBusinessRule, false);
  assert.equal(rlsErr.status, 'rls_blocked');
  assert.equal(rlsErr.serverMessage, null);

  const missingFnErr = classifyCheckoutRpcError({
    code: 'PGRST202',
    message: 'Could not find the function public.create_storefront_order in the schema cache',
    details: null,
  });
  assert.equal(missingFnErr.isBusinessRule, false);
  assert.equal(missingFnErr.serverMessage, null);
});

test('company_profile in store_settings normalizes +244 WhatsApp link, applies template with all order fields, and stays blank when WhatsApp is empty', () => {
  // 1. Key-value row `company_profile` com número local de 9 dígitos e modelo de mensagem
  const kvCompanyProfile = extractPublicStoreSettings([
    {
      setting_key: 'company_profile',
      setting_value: {
        name: 'Bercali Store Oficial',
        whatsapp: '923 777 888',
        whatsappMessageTemplate: 'Olá {{loja}}! Segue o meu pedido confirmado:',
      },
    },
  ]);
  assert.equal(kvCompanyProfile.brandName, 'Bercali Store Oficial');
  assert.equal(kvCompanyProfile.whatsappNumber, '244923777888');
  assert.equal(
    kvCompanyProfile.whatsappMessageTemplate,
    'Olá Bercali Store Oficial! Segue o meu pedido confirmado:'.replace(
      'Bercali Store Oficial',
      '{{loja}}'
    )
  );

  // 2. Linha colunar com JSONB `company_profile` e campos camelCase
  const columnarCompanyProfile = extractPublicStoreSettings([
    {
      id: 'settings-1',
      company_profile: {
        companyName: 'Bercali Angola',
        whatsappPhone: '+244 924 111 222',
        orderMessageTemplate: 'Encomenda {{codigo}} — Cliente {{nome}} ({{telefone}})',
      },
    },
  ]);
  assert.equal(columnarCompanyProfile.brandName, 'Bercali Angola');
  assert.equal(columnarCompanyProfile.whatsappNumber, '244924111222');

  // 3. Quando WhatsApp está em branco em company_profile (mesmo que exista telefone geral), whatsappNumber fica vazio
  const blankWaProfile = extractPublicStoreSettings([
    {
      setting_key: 'company_profile',
      setting_value: {
        name: 'Bercali Store',
        whatsapp: '   ',
        phone: '+244 222 000 111',
      },
    },
  ]);
  assert.equal(blankWaProfile.whatsappNumber, '');
  assert.equal(buildWhatsAppUrl(blankWaProfile.whatsappNumber, 'Teste'), '');

  // 4. Mensagem final contém obrigatoriamente: código, nome, telefone, zona e referência, produtos com quantidades e Kz, taxa de entrega e total
  const lines = resolveValidatedCartLines(
    [{ productId: TEST_CATALOG[0].id, quantity: 2 }],
    TEST_CATALOG
  );
  const rules = [{ zoneName: 'Talatona', province: 'Luanda', feeKz: 2500 }];
  const summary = calculateOrderSummary(lines, 'Luanda', 'Belas', rules, {
    deliveryZone: 'Talatona',
  });

  const fullMsg = buildWhatsAppOrderMessage(
    {
      fullName: 'João Manuel',
      phone: '923 555 444',
      deliveryZone: 'Talatona',
      province: 'Luanda',
      municipality: 'Belas',
      neighborhood: 'Talatona',
      addressReference: 'Junto ao Belas Shopping',
      notes: 'Ligar à chegada',
    },
    summary,
    'ORD-2026-0099',
    kvCompanyProfile.brandName,
    kvCompanyProfile.whatsappMessageTemplate
  );

  assert.ok(fullMsg.includes('Olá Bercali Store Oficial! Segue o meu pedido confirmado:'));
  assert.ok(fullMsg.includes('ORD-2026-0099'));
  assert.ok(fullMsg.includes('João Manuel'));
  assert.ok(fullMsg.includes('923 555 444'));
  assert.ok(fullMsg.includes('Talatona'));
  assert.ok(fullMsg.includes('Junto ao Belas Shopping'));
  assert.ok(fullMsg.includes('Carregador Portátil Solar 20.000 mAh'));
  assert.ok(fullMsg.includes('Quantidade: 2'));
  assert.ok(fullMsg.includes('24.500 Kz'));
  assert.ok(fullMsg.includes('2.500 Kz'));
  assert.ok(fullMsg.includes('51.500 Kz'));

  const waLink = buildWhatsAppUrl(kvCompanyProfile.whatsappNumber, fullMsg);
  assert.ok(waLink.startsWith('https://wa.me/244923777888?text='));
});





