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
            ? 'bg-[#FF8A00] font-display font-bold text-[#0A0A0A]'
            : 'bg-[#1A1A1A] border border-white/10 text-white/85 hover:border-[#FF8A00]/60 hover:text-white'
        }`}
      >
        <span>Todas</span>
        {typeof totalCount === 'number' && (
          <span
            className={`text-xs tabular-nums ${
              normalizedSelected === 'all' ? 'text-[#0A0A0A]/80' : 'text-[#8A8A8A]'
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
                ? 'bg-[#FF8A00] font-display font-bold text-[#0A0A0A]'
                : 'bg-[#1A1A1A] border border-white/10 text-white/85 hover:border-[#FF8A00]/60 hover:text-white'
            }`}
          >
            <span>{cat.name}</span>
            <span
              className={`text-xs tabular-nums ${
                isActive ? 'text-[#0A0A0A]/80' : 'text-[#8A8A8A]'
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
