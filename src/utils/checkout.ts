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
  return /^\d{8,15}$/.test(trimmed);
}

export function isValidEmailAddress(rawEmail: string): boolean {
  const trimmed = rawEmail.trim();
  if (!trimmed) return false;
  return EMAIL_PATTERN.test(trimmed);
}

export function validateCheckoutForm(data: CustomerCheckoutData): CheckoutValidationErrors {
  const errors: CheckoutValidationErrors = {};

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

  if (!normProvince) {
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

export function buildWhatsAppProductInquiryMessage(
  product: Product,
  quantity = 1,
  brandName = 'Bercali Store'
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
  brandName = 'Bercali Store'
): string {
  const cleanBrand = brandName.trim() || 'Bercali Store';
  const cleanName = customer.fullName.trim();
  const cleanPhone = customer.phone.trim();
  const cleanEmail = (customer.email ?? '').trim();
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

  const headerLines = [`Olá, ${cleanBrand}! Quero fazer uma encomenda.`];
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
  customerLines.push(
    `Província: ${cleanProvince}`,
    `Município: ${cleanMunicipality}`,
    `Bairro: ${cleanNeighborhood}`,
    `Endereço/referência: ${cleanAddress}`
  );

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
  const encoded = encodeURIComponent(message);
  if (isValidWhatsAppNumber(whatsappNumberConfig)) {
    return `https://wa.me/${whatsappNumberConfig.trim()}?text=${encoded}`;
  }
  return `https://wa.me/?text=${encoded}`;
}
