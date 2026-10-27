import type { Product } from '../types/store';
import {
  calculateDiscountPercent,
  isProductPurchasable,
  normalizeSearchText,
  slugifyCategory,
} from './format';

export interface CategorySummary {
  name: string;
  slug: string;
  count: number;
}

export function getDynamicCategories(products: readonly Product[]): CategorySummary[] {
  const map = new Map<string, CategorySummary>();

  for (const product of products) {
    const cleanName = product.category.trim();
    if (!cleanName) continue;
    const slug = product.categorySlug?.trim() || slugifyCategory(cleanName);
    const existing = map.get(slug);
    if (existing) {
      existing.count += 1;
    } else {
      map.set(slug, { name: cleanName, slug, count: 1 });
    }
  }

  return Array.from(map.values());
}

export interface ProductFilterCriteria {
  query?: string;
  category?: string;
  onlyAvailable?: boolean;
  onlyPromotions?: boolean;
}

export function filterProducts(
  products: readonly Product[],
  criteria: ProductFilterCriteria
): Product[] {
  const normalizedQuery = criteria.query ? normalizeSearchText(criteria.query) : '';
  const targetCategorySlug =
    criteria.category && criteria.category !== 'all' ? slugifyCategory(criteria.category) : '';

  return products.filter((product) => {
    const productCatSlug = product.categorySlug?.trim() || slugifyCategory(product.category);
    if (
      targetCategorySlug &&
      productCatSlug !== targetCategorySlug &&
      slugifyCategory(product.category) !== targetCategorySlug
    ) {
      return false;
    }

    if (criteria.onlyAvailable && !isProductPurchasable(product)) {
      return false;
    }

    if (
      criteria.onlyPromotions &&
      calculateDiscountPercent(product.price, product.oldPrice) === null
    ) {
      return false;
    }

    if (normalizedQuery) {
      const searchable = normalizeSearchText(
        `${product.name} ${product.sku ?? ''} ${product.description} ${product.category} ${product.features.join(' ')}`
      );
      if (!searchable.includes(normalizedQuery)) {
        return false;
      }
    }

    return true;
  });
}

export function getProductBySlug(
  products: readonly Product[],
  slug: string
): Product | undefined {
  return products.find((p) => p.slug === slug);
}

export function getFeaturedProducts(products: readonly Product[]): Product[] {
  return products.filter((p) => p.featured);
}

export function getNewProducts(products: readonly Product[]): Product[] {
  return products.filter((p) => Boolean(p.isNew));
}

export function getPromotionalProducts(products: readonly Product[]): Product[] {
  return products.filter((p) => calculateDiscountPercent(p.price, p.oldPrice) !== null);
}

export function getRelatedProducts(
  products: readonly Product[],
  currentProduct: Product,
  limit = 4
): Product[] {
  const currentCatSlug =
    currentProduct.categorySlug?.trim() || slugifyCategory(currentProduct.category);
  const sameCategory = products.filter(
    (p) =>
      p.id !== currentProduct.id &&
      (p.categorySlug?.trim() || slugifyCategory(p.category)) === currentCatSlug
  );
  if (sameCategory.length >= limit) {
    return sameCategory.slice(0, limit);
  }
  const others = products.filter(
    (p) =>
      p.id !== currentProduct.id &&
      (p.categorySlug?.trim() || slugifyCategory(p.category)) !== currentCatSlug &&
      isProductPurchasable(p)
  );
  return [...sameCategory, ...others].slice(0, limit);
}
