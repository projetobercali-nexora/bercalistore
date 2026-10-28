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

  // Número angolano de 9 dígitos (telemóvel 9xx xxx xxx ou fixo 2xx xxx xxx) -> prefixo internacional 244
  if (digits.length === 9 && (digits.startsWith('9') || digits.startsWith('2'))) {
    digits = `244${digits}`;
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
    'A confirmar';

  const trimmedTemplate = customTemplate?.trim() ?? '';
  let introGreeting = `Olá, ${cleanBrand}! Quero fazer uma encomenda.`;

  if (trimmedTemplate) {
    const interpolated = interpolateTemplateTokens(trimmedTemplate, {
      loja: cleanBrand,
      store: cleanBrand,
      store_name: cleanBrand,
      codigo: cleanOrderNumber ?? '',
      order_number: cleanOrderNumber ?? '',
      order_code: cleanOrderNumber ?? '',
      pedido: cleanOrderNumber ?? '',
      cliente: cleanName,
      nome: cleanName,
      customer_name: cleanName,
      telefone: cleanPhone,
      phone: cleanPhone,
      customer_phone: cleanPhone,
      zona: resolvedZoneSummary,
      delivery_zone: resolvedZoneSummary,
      endereco: cleanAddress || resolvedZoneSummary,
      address: cleanAddress || resolvedZoneSummary,
      itens: productBlocks,
      items: productBlocks,
      produtos: productBlocks,
      products: productBlocks,
      subtotal: formatKz(summary.productsSubtotalKz),
      entrega: summary.delivery.label,
      delivery_fee: summary.delivery.label,
      total: totalLine,
      observacoes: cleanNotes,
      notes: cleanNotes,
    });

    const hasItemsToken = /\{\{?\s*(itens|items|produtos|products)\s*\}?\}/i.test(trimmedTemplate);
    const hasTotalToken = /\{\{?\s*total\s*\}?\}/i.test(trimmedTemplate);

    if (hasItemsToken && hasTotalToken) {
      if (cleanOrderNumber && !interpolated.includes(cleanOrderNumber)) {
        return `${interpolated}\n\nPedido nº: ${cleanOrderNumber}`;
      }
      return interpolated;
    }

    if (!hasOrderSpecificTokens(trimmedTemplate)) {
      introGreeting = interpolated;
    }
  }

  const headerLines = [introGreeting];
  if (cleanOrderNumber) {
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
  if (cleanZone && cleanZone !== cleanProvince && cleanZone !== cleanMunicipality) {
    customerLines.push(`Zona de entrega: ${cleanZone}`);
  }
  if (cleanProvince) {
    customerLines.push(`Província: ${cleanProvince}`);
  }
  if (cleanMunicipality) {
    customerLines.push(`Município: ${cleanMunicipality}`);
  }
  if (cleanNeighborhood) {
    customerLines.push(`Bairro: ${cleanNeighborhood}`);
  }
  if (cleanAddress) {
    customerLines.push(`Endereço/referência: ${cleanAddress}`);
  }

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

export function buildWhatsAppUrl(whatsappNumberConfig: string, message: string): string {
  const normalized = normalizeWhatsAppNumber(whatsappNumberConfig);
  if (!normalized) {
    return '';
  }
  const encoded = encodeURIComponent(message);
  return `https://wa.me/${normalized}?text=${encoded}`;
}
