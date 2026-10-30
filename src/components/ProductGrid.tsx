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
            className="flex flex-col overflow-hidden rounded-xl bg-[#1A1A1A] border border-white/10 animate-pulse"
          >
            <div className="aspect-[4/3] w-full bg-[#121212]" />
            <div className="flex flex-1 flex-col p-3.5 sm:p-4 space-y-3">
              <div className="h-3 w-28 rounded bg-white/10" />
              <div className="h-4 w-4/5 rounded bg-white/15" />
              <div className="h-5 w-24 rounded bg-[#FFC400]/25 mt-2" />
              <div className="mt-2 space-y-2">
                <div className="h-11 w-full rounded-lg bg-[#FF8A00]/20" />
                <div className="h-10 w-full rounded-lg bg-white/5" />
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
        className="rounded-xl bg-[#1A1A1A] border border-white/15 p-8 sm:p-12 text-center"
      >
        <AlertCircle className="mx-auto h-10 w-10 text-[#FFC400]" aria-hidden="true" />
        <h3 className="mt-4 font-display text-lg font-bold text-white">
          Não foi possível carregar os produtos
        </h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-[#8A8A8A] leading-relaxed">{error}</p>
        {retryAction && (
          <div className="mt-5 flex justify-center">
            <button
              type="button"
              onClick={retryAction}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-bercali-gradient px-6 py-2.5 font-display text-xs font-extrabold uppercase text-[#0A0A0A] shadow-lg transition-transform active:scale-[0.99] cursor-pointer"
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
      <div className="rounded-xl bg-[#1A1A1A] border border-white/10 p-8 sm:p-12 text-center">
        <PackageSearch className="mx-auto h-10 w-10 text-[#FF8A00]" aria-hidden="true" />
        <h3 className="mt-4 font-display text-lg font-bold text-white">{emptyTitle}</h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-[#8A8A8A] leading-relaxed">
          {emptyDescription}
        </p>
        {(onResetFilters || onRefresh) && (
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            {onResetFilters && (
              <button
                type="button"
                onClick={onResetFilters}
                className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-[#FF8A00] px-5 py-2.5 font-display text-xs font-bold uppercase text-[#FF8A00] hover:bg-[#FF8A00] hover:text-[#0A0A0A] transition-colors cursor-pointer"
              >
                Limpar pesquisa e filtros
              </button>
            )}
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-white/15 bg-[#0A0A0A] px-5 py-2.5 font-display text-xs font-bold uppercase text-white hover:border-[#FF8A00] hover:text-[#FF8A00] transition-colors cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5 text-[#FF8A00]" />
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
