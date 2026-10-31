import React from 'react';
import { AlertCircle, PackageSearch, RefreshCw } from 'lucide-react';
import type { Product } from '../types/store';
import { ProductCard } from './ProductCard';

interface ProductGridProps {
  products: readonly Product[];
  loading?: boolean;
  error?: string | null;
  emptyTitle?: string;
  emptyDescription?: string;
  onResetFilters?: () => void;
  onRefresh?: () => void;
  onRetry?: () => void;
}

export const ProductGrid: React.FC<ProductGridProps> = ({
  products,
  loading = false,
  error = null,
  emptyTitle = 'Nenhum produto encontrado',
  emptyDescription = 'Não encontrámos produtos para esta pesquisa. Tenta usar outras palavras ou limpa os filtros.',
  onResetFilters,
  onRefresh,
  onRetry,
}) => {
  if (loading) {
    return (
      <div
        role="status"
        aria-label="A carregar catálogo de produtos"
        className="grid grid-cols-1 min-[360px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 sm:gap-5 lg:gap-6"
      >
        {[0, 1, 2, 3].map((idx) => (
          <div
            key={`skeleton-${idx}`}
            className="flex flex-col overflow-hidden rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-[var(--shadow-card)] animate-pulse"
          >
            <div className="aspect-[4/3] w-full bg-[var(--bg-subtle)]" />
            <div className="flex flex-1 flex-col p-3.5 sm:p-4 space-y-3">
              <div className="h-3 w-28 rounded bg-[var(--bg-subtle)]" />
              <div className="h-4 w-4/5 rounded bg-[#E7E5E0]" />
              <div className="h-5 w-24 rounded bg-[#E7E5E0] mt-2" />
              <div className="mt-2 space-y-2">
                <div className="h-11 w-full rounded-lg bg-[#FF8A00]/20" />
                <div className="h-10 w-full rounded-lg bg-[var(--bg-subtle)]" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error && products.length === 0) {
    const retryAction = onRetry ?? onRefresh;
    return (
      <div
        role="alert"
        className="rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-[var(--shadow-card)] p-8 sm:p-12 text-center"
      >
        <AlertCircle className="mx-auto h-10 w-10 text-[var(--brand-orange-text)]" aria-hidden="true" />
        <h3 className="mt-4 font-display text-lg font-bold text-[var(--text-primary)]">
          Não foi possível carregar os produtos
        </h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-[var(--text-secondary)] leading-relaxed">
          {error}
        </p>
        {retryAction && (
          <div className="mt-5 flex justify-center">
            <button
              type="button"
              onClick={retryAction}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-bercali-gradient px-6 py-2.5 font-display text-xs font-extrabold uppercase text-[var(--text-on-accent)] shadow-sm transition-transform active:scale-[0.99] cursor-pointer"
            >
              <RefreshCw className="h-4 w-4 shrink-0" />
              <span>Tentar novamente</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-[var(--shadow-card)] p-8 sm:p-12 text-center">
        <PackageSearch className="mx-auto h-10 w-10 text-[var(--brand-orange-text)]" aria-hidden="true" />
        <h3 className="mt-4 font-display text-lg font-bold text-[var(--text-primary)]">
          {emptyTitle}
        </h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-[var(--text-secondary)] leading-relaxed">
          {emptyDescription}
        </p>
        {(onResetFilters || onRefresh) && (
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            {onResetFilters && (
              <button
                type="button"
                onClick={onResetFilters}
                className="inline-flex min-h-[44px] items-center justify-center rounded-lg border-2 border-[var(--brand-orange)] bg-[var(--bg-surface)] px-5 py-2.5 font-display text-xs font-bold uppercase text-[var(--text-primary)] hover:bg-[var(--brand-orange)] hover:text-[var(--text-on-accent)] transition-colors cursor-pointer"
              >
                Limpar pesquisa e filtros
              </button>
            )}
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-[var(--border-input)] bg-[var(--bg-subtle)] px-5 py-2.5 font-display text-xs font-bold uppercase text-[var(--text-primary)] hover:border-[var(--brand-orange)] hover:text-[var(--brand-orange-text)] transition-colors cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5 text-[var(--brand-orange-text)]" />
                <span>Atualizar catálogo</span>
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 min-[360px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 sm:gap-5 lg:gap-6">
      {products.map((product, idx) => (
        <ProductCard key={product.id} product={product} priority={idx === 0} />
      ))}
    </div>
  );
};
