import React from 'react';
import type { CategorySummary } from '../utils/catalog';
import { slugifyCategory } from '../utils/format';

interface CategoryListProps {
  categories: readonly CategorySummary[];
  selectedCategory: string;
  onSelectCategory: (categorySlugOrAll: string) => void;
  totalCount?: number;
}

export const CategoryList: React.FC<CategoryListProps> = ({
  categories,
  selectedCategory,
  onSelectCategory,
  totalCount,
}) => {
  const normalizedSelected =
    selectedCategory === 'all' || !selectedCategory ? 'all' : slugifyCategory(selectedCategory);

  return (
    <div
      role="group"
      aria-label="Filtrar por categoria"
      className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1"
    >
      <button
        type="button"
        onClick={() => onSelectCategory('all')}
        aria-pressed={normalizedSelected === 'all'}
        className={`inline-flex min-h-[44px] items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
          normalizedSelected === 'all'
            ? 'bg-[var(--brand-orange)] font-display font-bold text-[var(--text-on-accent)]'
            : 'bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] hover:border-[var(--brand-orange)] hover:text-[var(--brand-orange-text)]'
        }`}
      >
        <span>Todas</span>
        {typeof totalCount === 'number' && (
          <span
            className={`text-xs tabular-nums ${
              normalizedSelected === 'all'
                ? 'text-[var(--text-on-accent)]/80'
                : 'text-[var(--text-secondary)]'
            }`}
          >
            ({totalCount})
          </span>
        )}
      </button>

      {categories.map((cat) => {
        const isActive = normalizedSelected === cat.slug;
        return (
          <button
            key={cat.slug}
            type="button"
            onClick={() => onSelectCategory(cat.slug)}
            aria-pressed={isActive}
            className={`inline-flex min-h-[44px] items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
              isActive
                ? 'bg-[var(--brand-orange)] font-display font-bold text-[var(--text-on-accent)]'
                : 'bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] hover:border-[var(--brand-orange)] hover:text-[var(--brand-orange-text)]'
            }`}
          >
            <span>{cat.name}</span>
            <span
              className={`text-xs tabular-nums ${
                isActive ? 'text-[var(--text-on-accent)]/80' : 'text-[var(--text-secondary)]'
              }`}
            >
              ({cat.count})
            </span>
          </button>
        );
      })}
    </div>
  );
};
