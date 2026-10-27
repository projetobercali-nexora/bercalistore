import type { AvailabilityStatus, Product } from '../types/store';

/**
 * Formata um valor numérico em Kwanzas angolanos (Kz) seguindo o manual de marca (ex.: "12.500 Kz").
 */
export function formatKz(value: number): string {
  if (!Number.isFinite(value) || value < 0) {
    return '0 Kz';
  }
  const rounded = Math.round(value);
  const formattedDigits = rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${formattedDigits} Kz`;
}

/**
 * Normaliza texto para pesquisa insensível a maiúsculas/minúsculas e acentuação.
 */
export function normalizeSearchText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Calcula a percentagem real de desconto apenas quando oldPrice > price > 0.
 */
export function calculateDiscountPercent(price: number, oldPrice?: number): number | null {
  if (typeof oldPrice !== 'number' || !Number.isFinite(oldPrice) || oldPrice <= price || price <= 0) {
    return null;
  }
  const pct = Math.round(((oldPrice - price) / oldPrice) * 100);
  return pct > 0 ? pct : null;
}

/**
 * Determina o estado efetivo de disponibilidade de um produto.
 */
export function getProductAvailability(product: Product): AvailabilityStatus {
  const stockExhausted =
    product.manageStock !== false && typeof product.stock === 'number' && product.stock <= 0;

  if (product.availabilityStatus) {
    if (product.availabilityStatus === 'available') {
      if (!product.available || stockExhausted) {
        return 'out_of_stock';
      }
      return 'available';
    }
    return product.availabilityStatus;
  }

  if (!product.available || stockExhausted) {
    return 'out_of_stock';
  }

  return 'available';
}

export function isProductPurchasable(product: Product): boolean {
  return getProductAvailability(product) === 'available';
}

export function getAvailabilityLabel(status: AvailabilityStatus): string {
  switch (status) {
    case 'available':
      return 'Disponível';
    case 'temporarily_unavailable':
      return 'Temporariamente indisponível';
    case 'out_of_stock':
    default:
      return 'Esgotado';
  }
}

export function slugifyCategory(category: string): string {
  return normalizeSearchText(category)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
