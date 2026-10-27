import type { CartItem, Product, ValidatedCartLine } from '../types/store';
import { isProductPurchasable } from './format';

export const CART_STORAGE_KEY = 'bercali_store_cart_v1';

export function getMaxAllowedQuantity(product: Product): number {
  if (!isProductPurchasable(product)) {
    return 0;
  }
  if (product.manageStock === false) {
    return 99;
  }
  if (typeof product.stock === 'number' && Number.isFinite(product.stock)) {
    return Math.max(0, Math.floor(product.stock));
  }
  return 99;
}

export function clampQuantityForProduct(product: Product, requestedQuantity: number): number {
  const max = getMaxAllowedQuantity(product);
  if (max <= 0) return 0;
  if (!Number.isFinite(requestedQuantity)) return 1;
  return Math.min(max, Math.max(1, Math.floor(requestedQuantity)));
}

/**
 * Valida e higieniza dados recuperados do localStorage sem confiar cegamente no conteúdo guardado.
 */
export function sanitizeStoredCart(
  rawValue: unknown,
  catalog: readonly Product[]
): CartItem[] {
  if (!Array.isArray(rawValue)) {
    return [];
  }

  const productById = new Map<string, Product>(catalog.map((p) => [p.id, p]));
  const merged = new Map<string, number>();

  for (const entry of rawValue) {
    if (typeof entry !== 'object' || entry === null) continue;
    const record = entry as Record<string, unknown>;
    const productId = typeof record.productId === 'string' ? record.productId.trim() : '';
    const quantity = typeof record.quantity === 'number' ? record.quantity : Number.NaN;

    if (!productId || !Number.isFinite(quantity) || quantity < 1) continue;

    const product = productById.get(productId);
    if (!product || !isProductPurchasable(product)) continue;

    const accumulated = (merged.get(productId) ?? 0) + Math.floor(quantity);
    const clamped = clampQuantityForProduct(product, accumulated);
    if (clamped >= 1) {
      merged.set(productId, clamped);
    }
  }

  return Array.from(merged.entries()).map(([productId, quantity]) => ({
    productId,
    quantity,
  }));
}

export function addOrIncrementCartItem(
  items: readonly CartItem[],
  product: Product,
  quantityToAdd = 1
): CartItem[] {
  if (!isProductPurchasable(product) || quantityToAdd < 1) {
    return [...items];
  }

  const existing = items.find((item) => item.productId === product.id);
  const desired = (existing ? existing.quantity : 0) + Math.floor(quantityToAdd);
  const nextQuantity = clampQuantityForProduct(product, desired);

  if (nextQuantity < 1) {
    return [...items];
  }

  if (existing) {
    return items.map((item) =>
      item.productId === product.id ? { ...item, quantity: nextQuantity } : item
    );
  }

  return [...items, { productId: product.id, quantity: nextQuantity }];
}

export function updateCartItemQuantity(
  items: readonly CartItem[],
  product: Product,
  nextQuantity: number
): CartItem[] {
  if (!Number.isFinite(nextQuantity) || nextQuantity < 1) {
    return [...items];
  }
  const clamped = clampQuantityForProduct(product, nextQuantity);
  if (clamped < 1) {
    return items.filter((item) => item.productId !== product.id);
  }
  return items.map((item) =>
    item.productId === product.id ? { ...item, quantity: clamped } : item
  );
}

export function removeCartItemById(items: readonly CartItem[], productId: string): CartItem[] {
  return items.filter((item) => item.productId !== productId);
}

/**
 * Calcula linhas validadas e subtotais sempre a partir do catálogo oficial de produtos.
 */
export function resolveValidatedCartLines(
  items: readonly CartItem[],
  catalog: readonly Product[]
): ValidatedCartLine[] {
  const productById = new Map<string, Product>(catalog.map((p) => [p.id, p]));
  const lines: ValidatedCartLine[] = [];

  for (const item of items) {
    const product = productById.get(item.productId);
    if (!product || !isProductPurchasable(product)) continue;
    const quantity = clampQuantityForProduct(product, item.quantity);
    if (quantity < 1) continue;
    lines.push({
      product,
      quantity,
      lineSubtotal: product.price * quantity,
    });
  }

  return lines;
}
