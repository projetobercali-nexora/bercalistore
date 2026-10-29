import type {
  CheckoutValidationErrors,
  CustomerCheckoutData,
  DeliveryFeeRule,
  OrderSummaryCalculation,
  Product,
  ResolvedDeliveryFee,
  ValidatedCartLine,
} from '../types/store';
import { formatKz, isProductPurchasable, normalizeSearchText } from './format';

export const DELIVERY_PENDING_LABEL = 'A confirmar pela loja';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidWhatsAppNumber(phoneConfig: string): boolean {
  const trimmed = phoneConfig.trim();
  if (!trimmed || trimmed === 'SUBSTITUIR_PELO_NUMERO_OFICIAL') {
    return false;
  }
  return /^\d{8,15}$/.test(trimmed) && !/^0+$/.test(trimmed);
}

/**
 * Normaliza qualquer número de WhatsApp vindo de `store_settings` para os dígitos internacionais
 * usados em links `https://wa.me/<digitos>` (ex.: "+244 923 000 000" ou "923000000" -> "244923000000").
 * Devolve string vazia ('') se estiver em branco ou for inválido.
 */
export function normalizeWhatsAppNumber(raw: unknown): string {
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
    return normalizeWhatsAppNumber(String(Math.trunc(raw)));
  }
  if (typeof raw !== 'string') {
    return '';
  }
  const trimmed = raw.trim();
  if (!trimmed || trimmed === 'SUBSTITUIR_PELO_NUMERO_OFICIAL') {
    return '';
  }

  let digits = trimmed.replace(/\D/g, '');
  if (!digits || /^0+$/.test(digits)) {
    return '';
  }

  if (digits.startsWith('00')) {
    digits = digits.slice(2);
  }

  // Número angolano de 9 dígitos (9xx... / 2xx...) ou 10 dígitos com zero inicial (09xx...) -> prefixo internacional 244
  if (digits.length === 9 && (digits.startsWith('9') || digits.startsWith('2'))) {
    digits = `244${digits}`;
  } else if (digits.length === 10 && (digits.startsWith('09') || digits.startsWith('02'))) {
    digits = `244${digits.slice(1)}`;
  } else if (digits.length === 13 && digits.startsWith('2440')) {
    digits = `244${digits.slice(4)}`;
  }

  return /^\d{8,15}$/.test(digits) && !/^0+$/.test(digits) ? digits : '';
}

export function formatInternationalWhatsApp(raw: unknown): string {
  const digits = normalizeWhatsAppNumber(raw);
  return digits ? `+${digits}` : '';
}

export function hasConfiguredWhatsApp(raw: unknown): boolean {
  return normalizeWhatsAppNumber(raw).length > 0;
}

export interface OfficialWhatsAppResolution {
  hasOfficialFields: boolean;
  digits: string;
  source: 'officialWhatsAppNormalized' | 'officialWhatsApp' | null;
  invalidReason: string | null;
}

function toRawPhoneString(val: unknown): string {
  if (typeof val === 'string') return val.trim();
  if (typeof val === 'number' && Number.isFinite(val) && val > 0) {
    return String(Math.trunc(val));
  }
  return '';
}

function parseDigitsForOfficialWhatsApp(raw: string): string {
  if (!raw || raw === 'SUBSTITUIR_PELO_NUMERO_OFICIAL') {
    return '';
  }
  let digits = raw.replace(/\D/g, '');
  if (!digits || /^0+$/.test(digits)) {
    return '';
  }
  if (digits.startsWith('00')) {
    digits = digits.slice(2);
  }
  if (digits.length === 9 && digits.startsWith('9')) {
    digits = `244${digits}`;
  }
  return /^\d{8,15}$/.test(digits) && !/^0+$/.test(digits) ? digits : '';
}

/**
 * Lê de `store_settings > company_profile` primeiro `officialWhatsAppNormalized` (ex.: "+244958427080")
 * e, se estiver vazio, usa `officialWhatsApp` (apenas dígitos; se tiver 9 dígitos e começar por 9, junta "244").
 */
export function resolveOfficialWhatsAppFromCompanyProfile(
  companyProfile: Record<string, unknown> | null | undefined
): OfficialWhatsAppResolution {
  if (!companyProfile || typeof companyProfile !== 'object') {
    return {
      hasOfficialFields: false,
      digits: '',
      source: null,
      invalidReason: 'Objeto company_profile ausente em store_settings.',
    };
  }

  const hasNormalizedProp = Object.prototype.hasOwnProperty.call(
    companyProfile,
    'officialWhatsAppNormalized'
  );
  const hasFallbackProp = Object.prototype.hasOwnProperty.call(
    companyProfile,
    'officialWhatsApp'
  );
  const hasOfficialFields = hasNormalizedProp || hasFallbackProp;

  const rawNormalized = toRawPhoneString(companyProfile.officialWhatsAppNormalized);
  if (rawNormalized) {
    const parsedNormalized = parseDigitsForOfficialWhatsApp(rawNormalized);
    if (parsedNormalized) {
      return {
        hasOfficialFields: true,
        digits: parsedNormalized,
        source: 'officialWhatsAppNormalized',
        invalidReason: null,
      };
    }
  }

  const rawFallback = toRawPhoneString(companyProfile.officialWhatsApp);
  if (rawFallback) {
    const parsedFallback = parseDigitsForOfficialWhatsApp(rawFallback);
    if (parsedFallback) {
      return {
        hasOfficialFields: true,
        digits: parsedFallback,
        source: 'officialWhatsApp',
        invalidReason: null,
      };
    }
  }

  let invalidReason =
    'Campos officialWhatsAppNormalized e officialWhatsApp estão vazios em store_settings > company_profile.';
  if (rawNormalized && rawFallback) {
    invalidReason =
      'Campos officialWhatsAppNormalized e officialWhatsApp contêm valores inválidos em store_settings > company_profile.';
  } else if (rawNormalized) {
    invalidReason =
      'Campo officialWhatsAppNormalized contém um número inválido e officialWhatsApp está vazio em store_settings > company_profile.';
  } else if (rawFallback) {
    invalidReason =
      'Campo officialWhatsApp contém um número inválido em store_settings > company_profile.';
  }

  return {
    hasOfficialFields,
    digits: '',
    source: null,
    invalidReason,
  };
}

export function getDeliveryRuleLabel(rule: DeliveryFeeRule): string {
  if (rule.zoneName && rule.zoneName.trim()) {
    return rule.zoneName.trim();
  }
  return [rule.province, rule.municipality, rule.neighborhood]
    .map((p) => (p ?? '').trim())
    .filter(Boolean)
    .join(' · ');
}

export function isValidEmailAddress(rawEmail: string): boolean {
  const trimmed = rawEmail.trim();
  if (!trimmed) return false;
  return EMAIL_PATTERN.test(trimmed);
}

export interface CheckoutValidationOptions {
  mode?: 'legacy' | 'storefront';
  deliveryZones?: readonly DeliveryFeeRule[];
}

export function validateCheckoutForm(
  data: CustomerCheckoutData,
  options?: CheckoutValidationOptions
): CheckoutValidationErrors {
  const errors: CheckoutValidationErrors = {};
  const mode = options?.mode ?? 'legacy';
  const deliveryZones = options?.deliveryZones ?? [];

  const fullName = data.fullName.trim();
  if (!fullName) {
    errors.fullName = 'Indica o teu nome completo.';
  } else if (fullName.length < 3) {
    errors.fullName = 'O nome deve ter pelo menos 3 caracteres.';
  }

  const phoneDigits = data.phone.replace(/\D/g, '');
  if (!data.phone.trim()) {
    errors.phone = 'Indica o teu número de telefone para contacto.';
  } else if (phoneDigits.length < 9 || phoneDigits.length > 15) {
    errors.phone = 'Introduz um número de telefone válido (ex.: 923 000 000).';
  }

  const emailTrimmed = (data.email ?? '').trim();
  if (emailTrimmed && !isValidEmailAddress(emailTrimmed)) {
    errors.email = 'Introduz um endereço de e-mail válido ou deixa em branco.';
  }

  if (mode === 'storefront') {
    if (deliveryZones.length > 0) {
      const selectedZone = (data.deliveryZone ?? '').trim();
      if (!selectedZone && !data.province.trim()) {
        errors.deliveryZone = 'Seleciona a zona de entrega.';
      }
    }
    return errors;
  }

  if (!data.province.trim()) {
    errors.province = 'Seleciona ou indica a província de entrega.';
  }

  if (!data.municipality.trim()) {
    errors.municipality = 'Indica o município de entrega.';
  }

  if (!data.neighborhood.trim()) {
    errors.neighborhood = 'Indica o bairro de entrega.';
  }

  if (!data.addressReference.trim()) {
    errors.addressReference = 'Indica o endereço ou um ponto de referência claro.';
  } else if (data.addressReference.trim().length < 5) {
    errors.addressReference = 'Detalha melhor o endereço ou ponto de referência.';
  }

  return errors;
}

export function hasValidationErrors(errors: CheckoutValidationErrors): boolean {
  return Object.keys(errors).length > 0;
}

export interface DeliveryCalculationOptions {
  freeDeliveryThresholdKz?: number | null;
  defaultDeliveryFeeKz?: number | null;
  neighborhood?: string;
  deliveryZone?: string;
}

export function resolveDeliveryFee(
  province: string,
  municipality: string,
  rules: readonly DeliveryFeeRule[],
  productsSubtotalKz = 0,
  options?: DeliveryCalculationOptions
): ResolvedDeliveryFee {
  const normProvince = normalizeSearchText(province);
  const normMunicipality = normalizeSearchText(municipality);
  const normNeighborhood = normalizeSearchText(options?.neighborhood ?? '');
  const normDeliveryZone = normalizeSearchText(options?.deliveryZone ?? '');

  if (!normProvince && !normDeliveryZone) {
    return {
      known: false,
      amountKz: 0,
      label: DELIVERY_PENDING_LABEL,
    };
  }

  const freeThreshold = options?.freeDeliveryThresholdKz ?? null;
  if (
    typeof freeThreshold === 'number' &&
    Number.isFinite(freeThreshold) &&
    freeThreshold > 0 &&
    productsSubtotalKz >= freeThreshold
  ) {
    return {
      known: true,
      amountKz: 0,
      label: 'Grátis',
    };
  }

  if (rules.length > 0) {
    // 0. Correspondência direta pela zona selecionada
    if (normDeliveryZone) {
      const zoneMatch = rules.find((r) => {
        const labelNorm = normalizeSearchText(getDeliveryRuleLabel(r));
        const zoneNameNorm = normalizeSearchText(r.zoneName ?? '');
        return (
          r.feeKz >= 0 &&
          ((labelNorm && labelNorm === normDeliveryZone) ||
            (zoneNameNorm && zoneNameNorm === normDeliveryZone))
        );
      });
      if (zoneMatch) {
        return {
          known: true,
          amountKz: zoneMatch.feeKz,
          label: zoneMatch.feeKz === 0 ? 'Grátis' : formatKz(zoneMatch.feeKz),
          estimatedTime: zoneMatch.estimatedTime,
        };
      }
    }

    // 1. Correspondência específica por bairro / zona nomeada dentro da província (ou zona global)
    if (normNeighborhood) {
      const neighborhoodMatch = rules.find((r) => {
        const rProv = normalizeSearchText(r.province);
        const rNeigh = normalizeSearchText(r.neighborhood ?? r.zoneName ?? '');
        const provMatches = !rProv || rProv === 'todas' || rProv === normProvince;
        return provMatches && rNeigh && rNeigh === normNeighborhood && r.feeKz >= 0;
      });
      if (neighborhoodMatch) {
        return {
          known: true,
          amountKz: neighborhoodMatch.feeKz,
          label:
            neighborhoodMatch.feeKz === 0 ? 'Grátis' : formatKz(neighborhoodMatch.feeKz),
          estimatedTime: neighborhoodMatch.estimatedTime,
        };
      }
    }

    // 2. Correspondência exata por província + município (ou zoneName igual ao município)
    if (normMunicipality) {
      const municipalityMatch = rules.find((r) => {
        const rProv = normalizeSearchText(r.province);
        const rMun = normalizeSearchText(r.municipality ?? r.zoneName ?? '');
        const provMatches = !rProv || rProv === 'todas' || rProv === normProvince;
        return provMatches && rMun && rMun === normMunicipality && r.feeKz >= 0;
      });

      if (municipalityMatch) {
        return {
          known: true,
          amountKz: municipalityMatch.feeKz,
          label: municipalityMatch.feeKz === 0 ? 'Grátis' : formatKz(municipalityMatch.feeKz),
          estimatedTime: municipalityMatch.estimatedTime,
        };
      }
    }

    // 3. Correspondência geral da província (sem município específico)
    if (normProvince) {
      const provinceFallbackMatch = rules.find(
        (r) =>
          normalizeSearchText(r.province) === normProvince &&
          !r.municipality &&
          !r.neighborhood &&
          r.feeKz >= 0
      );

      if (provinceFallbackMatch) {
        return {
          known: true,
          amountKz: provinceFallbackMatch.feeKz,
          label:
            provinceFallbackMatch.feeKz === 0 ? 'Grátis' : formatKz(provinceFallbackMatch.feeKz),
          estimatedTime: provinceFallbackMatch.estimatedTime,
        };
      }
    }
  }

  const defaultFee = options?.defaultDeliveryFeeKz ?? null;
  if (typeof defaultFee === 'number' && Number.isFinite(defaultFee) && defaultFee >= 0) {
    return {
      known: true,
      amountKz: defaultFee,
      label: defaultFee === 0 ? 'Grátis' : formatKz(defaultFee),
    };
  }

  return {
    known: false,
    amountKz: 0,
    label: DELIVERY_PENDING_LABEL,
  };
}

export function calculateOrderSummary(
  lines: readonly ValidatedCartLine[],
  province: string,
  municipality: string,
  rules: readonly DeliveryFeeRule[],
  options?: DeliveryCalculationOptions
): OrderSummaryCalculation {
  const totalItemsCount = lines.reduce((acc, line) => acc + line.quantity, 0);
  const productsSubtotalKz = lines.reduce((acc, line) => acc + line.lineSubtotal, 0);
  const delivery = resolveDeliveryFee(
    province,
    municipality,
    rules,
    productsSubtotalKz,
    options
  );

  const estimatedTotalKz = delivery.known ? productsSubtotalKz + delivery.amountKz : null;
  const estimatedTotalLabel =
    estimatedTotalKz !== null
      ? formatKz(estimatedTotalKz)
      : `${formatKz(productsSubtotalKz)} + entrega (${DELIVERY_PENDING_LABEL.toLowerCase()})`;

  return {
    lines: [...lines],
    totalItemsCount,
    productsSubtotalKz,
    delivery,
    estimatedTotalKz,
    estimatedTotalLabel,
  };
}

function interpolateTemplateTokens(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{?\s*([a-zA-Z0-9_]+)\s*\}?\}/g, (fullMatch, rawKey: string) => {
    const lowerKey = rawKey.toLowerCase();
    return Object.prototype.hasOwnProperty.call(variables, lowerKey)
      ? variables[lowerKey]
      : fullMatch;
  });
}

function hasOrderSpecificTokens(template: string): boolean {
  return /\{\{?\s*(itens|items|produtos|products|codigo|order_number|order_code|pedido|total)\s*\}?\}/i.test(
    template
  );
}

export function buildWhatsAppContactMessage(
  brandName = 'Bercali Store',
  customTemplate?: string | null
): string {
  const cleanBrand = brandName.trim() || 'Bercali Store';
  const trimmedTemplate = customTemplate?.trim() ?? '';

  if (trimmedTemplate && !hasOrderSpecificTokens(trimmedTemplate)) {
    const hasProductTokens = /\{\{?\s*(produto|product|product_name|preco|price|sku)\s*\}?\}/i.test(
      trimmedTemplate
    );
    if (!hasProductTokens) {
      return interpolateTemplateTokens(trimmedTemplate, {
        loja: cleanBrand,
        store: cleanBrand,
        store_name: cleanBrand,
        brand: cleanBrand,
      });
    }
  }

  return `Olá, ${cleanBrand}! Gostaria de receber informações sobre os vossos produtos.`;
}

export function buildWhatsAppProductInquiryMessage(
  product: Product,
  quantity = 1,
  brandName = 'Bercali Store',
  customTemplate?: string | null
): string {
  const cleanBrand = brandName.trim() || 'Bercali Store';
  const skuPart = product.sku ? ` (Ref./SKU: ${product.sku})` : '';
  const purchasable = isProductPurchasable(product);
  const safeQty = Math.max(1, Math.floor(quantity || 1));

  if (!purchasable) {
    return [
      `Olá, ${cleanBrand}! Gostaria de saber informações sobre a reposição deste produto:`,
      `• Produto: ${product.name}${skuPart}`,
      `• Preço indicado: ${formatKz(product.price)}`,
    ].join('\n');
  }

  const trimmedTemplate = customTemplate?.trim() ?? '';
  if (trimmedTemplate && !hasOrderSpecificTokens(trimmedTemplate)) {
    const interpolated = interpolateTemplateTokens(trimmedTemplate, {
      loja: cleanBrand,
      store: cleanBrand,
      store_name: cleanBrand,
      produto: product.name,
      product: product.name,
      product_name: product.name,
      sku: product.sku ?? '',
      preco: formatKz(product.price),
      price: formatKz(product.price),
      quantidade: String(safeQty),
      quantity: String(safeQty),
    });

    if (/\{\{?\s*(produto|product|product_name)\s*\}?\}/i.test(trimmedTemplate)) {
      return interpolated;
    }

    return [
      interpolated,
      `• Produto: ${product.name}${skuPart}`,
      `• Preço unitário: ${formatKz(product.price)}`,
      `• Quantidade pretendida: ${safeQty}`,
      '',
      'Podem confirmar a disponibilidade e as condições de entrega?',
    ].join('\n');
  }

  return [
    `Olá, ${cleanBrand}! Tenho interesse neste produto:`,
    `• Produto: ${product.name}${skuPart}`,
    `• Preço unitário: ${formatKz(product.price)}`,
    `• Quantidade pretendida: ${safeQty}`,
    '',
    'Podem confirmar a disponibilidade e as condições de entrega?',
  ].join('\n');
}

export function buildWhatsAppOrderMessage(
  customer: CustomerCheckoutData,
  summary: OrderSummaryCalculation,
  orderNumber?: string,
  brandName = 'Bercali Store',
  customTemplate?: string | null
): string {
  const cleanBrand = brandName.trim() || 'Bercali Store';
  const cleanName = customer.fullName.trim();
  const cleanPhone = customer.phone.trim();
  const cleanEmail = (customer.email ?? '').trim();
  const cleanZone = (customer.deliveryZone ?? '').trim();
  const cleanProvince = customer.province.trim();
  const cleanMunicipality = customer.municipality.trim();
  const cleanNeighborhood = customer.neighborhood.trim();
  const cleanAddress = customer.addressReference.trim();
  const cleanNotes = customer.notes.trim() || 'Sem observações adicionais.';
  const cleanOrderNumber = orderNumber?.trim();

  const productBlocks = summary.lines
    .map((line, index) => {
      const skuSuffix = line.product.sku ? ` (SKU: ${line.product.sku})` : '';
      return [
        `${index + 1}. ${line.product.name}${skuSuffix}`,
        `   Quantidade: ${line.quantity}`,
        `   Preço unitário: ${formatKz(line.product.price)}`,
        `   Subtotal: ${formatKz(line.lineSubtotal)}`,
      ].join('\n');
    })
    .join('\n\n');

  const totalLine =
    summary.estimatedTotalKz !== null
      ? formatKz(summary.estimatedTotalKz)
      : `${formatKz(summary.productsSubtotalKz)} (entrega a confirmar)`;

  const resolvedZoneSummary =
    cleanZone ||
    [cleanNeighborhood, cleanMunicipality, cleanProvince].filter(Boolean).join(', ') ||
    DELIVERY_PENDING_LABEL;

  const resolvedReferenceSummary = cleanAddress || 'A confirmar pelo WhatsApp';

  const trimmedTemplate = customTemplate?.trim() ?? '';
  let introGreeting = `Olá, ${cleanBrand}! Quero fazer uma encomenda.`;

  if (trimmedTemplate) {
    const interpolated = interpolateTemplateTokens(trimmedTemplate, {
      loja: cleanBrand,
      store: cleanBrand,
      store_name: cleanBrand,
      brand: cleanBrand,
      codigo: cleanOrderNumber ?? '',
      encomenda: cleanOrderNumber ?? '',
      order_number: cleanOrderNumber ?? '',
      order_code: cleanOrderNumber ?? '',
      pedido: cleanOrderNumber ?? '',
      order_id: cleanOrderNumber ?? '',
      cliente: cleanName,
      nome: cleanName,
      customer_name: cleanName,
      name: cleanName,
      telefone: cleanPhone,
      telemovel: cleanPhone,
      phone: cleanPhone,
      customer_phone: cleanPhone,
      zona: resolvedZoneSummary,
      zona_entrega: resolvedZoneSummary,
      delivery_zone: resolvedZoneSummary,
      zone: resolvedZoneSummary,
      referencia: resolvedReferenceSummary,
      referencia_entrega: resolvedReferenceSummary,
      endereco: cleanAddress || resolvedZoneSummary,
      morada: cleanAddress || resolvedZoneSummary,
      address: cleanAddress || resolvedZoneSummary,
      delivery_address: cleanAddress || resolvedZoneSummary,
      address_reference: resolvedReferenceSummary,
      itens: productBlocks,
      items: productBlocks,
      produtos: productBlocks,
      products: productBlocks,
      lista_produtos: productBlocks,
      subtotal: formatKz(summary.productsSubtotalKz),
      entrega: summary.delivery.label,
      taxa_entrega: summary.delivery.label,
      delivery_fee: summary.delivery.label,
      shipping_fee: summary.delivery.label,
      total: totalLine,
      valor_total: totalLine,
      total_amount: totalLine,
      observacoes: cleanNotes,
      notas: cleanNotes,
      notes: cleanNotes,
      customer_notes: cleanNotes,
    });

    if (hasOrderSpecificTokens(trimmedTemplate)) {
      const missingDetails: string[] = [];
      if (cleanOrderNumber && !interpolated.includes(cleanOrderNumber)) {
        missingDetails.push(`Pedido nº: ${cleanOrderNumber}`);
      }
      if (cleanName && !interpolated.includes(cleanName)) {
        missingDetails.push(`Nome: ${cleanName}`);
      }
      if (cleanPhone && !interpolated.includes(cleanPhone)) {
        missingDetails.push(`Telefone: ${cleanPhone}`);
      }
      if (!/\{\{?\s*(zona|zona_entrega|delivery_zone|zone)\s*\}?\}/i.test(trimmedTemplate)) {
        missingDetails.push(`Zona de entrega: ${resolvedZoneSummary}`);
      }
      if (
        !/\{\{?\s*(referencia|referencia_entrega|endereco|morada|address|delivery_address|address_reference)\s*\}?\}/i.test(
          trimmedTemplate
        )
      ) {
        missingDetails.push(`Referência de entrega: ${resolvedReferenceSummary}`);
      }
      if (!/\{\{?\s*(itens|items|produtos|products|lista_produtos)\s*\}?\}/i.test(trimmedTemplate)) {
        missingDetails.push(`PRODUTOS\n${productBlocks}`);
      }
      if (
        !/\{\{?\s*(entrega|taxa_entrega|delivery_fee|shipping_fee)\s*\}?\}/i.test(trimmedTemplate)
      ) {
        missingDetails.push(`Entrega: ${summary.delivery.label}`);
      }
      if (!/\{\{?\s*(total|valor_total|total_amount)\s*\}?\}/i.test(trimmedTemplate)) {
        missingDetails.push(`Total estimado: ${totalLine}`);
      }

      return missingDetails.length > 0
        ? `${interpolated}\n\n${missingDetails.join('\n')}`
        : interpolated;
    }

    introGreeting = interpolated;
  }

  const headerLines = [introGreeting];
  if (cleanOrderNumber && !introGreeting.includes(cleanOrderNumber)) {
    headerLines.push(`Pedido nº: ${cleanOrderNumber}`);
  }

  const customerLines = [
    'DADOS DO CLIENTE',
    `Nome: ${cleanName}`,
    `Telefone: ${cleanPhone}`,
  ];
  if (cleanEmail) {
    customerLines.push(`E-mail: ${cleanEmail}`);
  }
  customerLines.push(`Zona de entrega: ${resolvedZoneSummary}`);
  if (cleanProvince && cleanProvince !== resolvedZoneSummary) {
    customerLines.push(`Província: ${cleanProvince}`);
  }
  if (cleanMunicipality && cleanMunicipality !== resolvedZoneSummary) {
    customerLines.push(`Município: ${cleanMunicipality}`);
  }
  if (cleanNeighborhood && cleanNeighborhood !== resolvedZoneSummary) {
    customerLines.push(`Bairro: ${cleanNeighborhood}`);
  }
  customerLines.push(`Endereço/referência: ${resolvedReferenceSummary}`);

  return [
    ...headerLines,
    '',
    ...customerLines,
    '',
    'PRODUTOS',
    '',
    productBlocks,
    '',
    'RESUMO',
    `Subtotal dos produtos: ${formatKz(summary.productsSubtotalKz)}`,
    `Entrega: ${summary.delivery.label}`,
    `Total estimado: ${totalLine}`,
    '',
    `Observações: ${cleanNotes}`,
    '',
    'Aguardo a confirmação da disponibilidade, do valor final e da entrega. Obrigado!',
  ].join('\n');
}

export function buildWhatsAppUrl(numero: string, mensagem: string): string {
  if (typeof numero !== 'string') {
    return '';
  }
  const trimmed = numero.trim();
  if (!trimmed || trimmed === 'SUBSTITUIR_PELO_NUMERO_OFICIAL') {
    return '';
  }

  let digitos = trimmed.replace(/\D/g, '');
  if (!digitos || /^0+$/.test(digitos)) {
    return '';
  }
  if (digitos.startsWith('00')) {
    digitos = digitos.slice(2);
  }
  if (digitos.length === 9 && digitos.startsWith('9')) {
    digitos = `244${digitos}`;
  }
  if (!/^\d{8,15}$/.test(digitos) || /^0+$/.test(digitos)) {
    return '';
  }

  return `https://wa.me/${digitos}?text=${encodeURIComponent(mensagem)}`;
}

export const LAST_CONFIRMED_ORDER_SESSION_KEY = 'bercali_last_confirmed_order_v1';

export interface StoredConfirmedOrderSession {
  orderNumber: string;
  whatsappUrl: string;
}

function getDefaultSessionStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function saveConfirmedOrderToSession(
  data: StoredConfirmedOrderSession,
  storage: Storage | null = getDefaultSessionStorage()
): void {
  if (!storage) return;
  const orderNumber = data.orderNumber.trim();
  if (!orderNumber) return;
  try {
    storage.setItem(
      LAST_CONFIRMED_ORDER_SESSION_KEY,
      JSON.stringify({
        orderNumber,
        whatsappUrl: data.whatsappUrl.trim(),
      })
    );
  } catch {
    // Ignorar restrições de escrita em modo privado estrito
  }
}

export function readConfirmedOrderFromSession(
  storage: Storage | null = getDefaultSessionStorage()
): StoredConfirmedOrderSession | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(LAST_CONFIRMED_ORDER_SESSION_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const rec = parsed as Record<string, unknown>;
    const orderNumber = typeof rec.orderNumber === 'string' ? rec.orderNumber.trim() : '';
    const whatsappUrl = typeof rec.whatsappUrl === 'string' ? rec.whatsappUrl.trim() : '';
    if (!orderNumber) return null;
    return { orderNumber, whatsappUrl };
  } catch {
    return null;
  }
}

export function clearConfirmedOrderFromSession(
  storage: Storage | null = getDefaultSessionStorage()
): void {
  if (!storage) return;
  try {
    storage.removeItem(LAST_CONFIRMED_ORDER_SESSION_KEY);
  } catch {
    // Ignorar restrições de armazenamento
  }
}
