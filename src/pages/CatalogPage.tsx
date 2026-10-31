import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { CategoryList } from '../components/CategoryList';
import { ProductGrid } from '../components/ProductGrid';
import { SearchBar } from '../components/SearchBar';
import { SpeedLinesDivider } from '../components/SpeedLinesDivider';
import { useCatalog } from '../context/CatalogContext';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { filterProducts } from '../utils/catalog';
import { trackMetaSearch } from '../utils/metaPixel';
import { PUBLIC_MESSAGES } from '../utils/publicMessages';

export const CatalogPage: React.FC = () => {
  const { products, categories, loading, error, refreshCatalog } = useCatalog();
  const [searchParams, setSearchParams] = useSearchParams();
  const lastTrackedQueryRef = useRef<string>('');

  const urlQuery = searchParams.get('q') ?? '';
  const [searchInput, setSearchInput] = useState(urlQuery);
  const debouncedQuery = useDebouncedValue(searchInput, 300);

  const selectedCategory = searchParams.get('categoria') ?? 'all';
  const onlyAvailable = searchParams.get('disponiveis') === '1';
  const onlyPromos = searchParams.get('promocoes') === '1';
  const shouldFocusSearch = searchParams.get('foco') === 'pesquisa';

  useEffect(() => {
    setSearchInput(urlQuery);
  }, [urlQuery]);

  useEffect(() => {
    if (debouncedQuery === urlQuery) return;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('foco');
        if (!debouncedQuery.trim()) {
          next.delete('q');
        } else {
          next.set('q', debouncedQuery);
        }
        return next;
      },
      { replace: true }
    );
  }, [debouncedQuery, urlQuery, setSearchParams]);

  useEffect(() => {
    const trimmed = debouncedQuery.trim();
    if (trimmed.length < 2) {
      if (!trimmed) {
        lastTrackedQueryRef.current = '';
      }
      return;
    }
    const timer = window.setTimeout(() => {
      if (lastTrackedQueryRef.current !== trimmed) {
        lastTrackedQueryRef.current = trimmed;
        trackMetaSearch(trimmed);
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [debouncedQuery]);

  const filteredProducts = useMemo(
    () =>
      filterProducts(products, {
        query: debouncedQuery,
        category: selectedCategory,
        onlyAvailable,
        onlyPromotions: onlyPromos,
      }),
    [products, debouncedQuery, selectedCategory, onlyAvailable, onlyPromos]
  );

  const updateParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(searchParams);
    next.delete('foco');
    if (!value || value === 'all' || value === '0') {
      next.delete(key);
    } else {
      next.set(key, value);
    }
    setSearchParams(next, { replace: true });
  };

  const resetAllFilters = () => {
    setSearchInput('');
    setSearchParams({}, { replace: true });
  };

  const hasAnyFilter =
    debouncedQuery.trim().length > 0 ||
    selectedCategory !== 'all' ||
    onlyAvailable ||
    onlyPromos;

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-6">
      <div>
        <SpeedLinesDivider className="mb-2.5" />
        <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)]">
          Catálogo de produtos
        </h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Encontra rapidamente o que procuras por nome, categoria ou estado de disponibilidade.
        </p>
      </div>

      {error && !loading && products.length > 0 && (
        <div
          role="alert"
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-[var(--shadow-card)] px-4 py-3 text-xs text-[var(--text-primary)]"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => void refreshCatalog()}
            className="inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-lg border border-[var(--border-input)] bg-[var(--bg-subtle)] px-3.5 py-1.5 font-display text-xs font-bold uppercase text-[var(--text-primary)] hover:border-[var(--brand-orange)] hover:text-[var(--brand-orange-text)] transition-colors cursor-pointer shrink-0"
          >
            <RefreshCw className="h-3.5 w-3.5 text-[var(--brand-orange-text)]" />
            <span>Tentar novamente</span>
          </button>
        </div>
      )}

      <div className="space-y-3.5">
        <SearchBar
          value={searchInput}
          onChange={(val) => {
            setSearchInput(val);
            if (!val.trim()) {
              updateParam('q', null);
            }
          }}
          autoFocus={shouldFocusSearch}
        />

        <CategoryList
          categories={categories}
          selectedCategory={selectedCategory}
          onSelectCategory={(cat) => updateParam('categoria', cat)}
          totalCount={loading || (error && products.length === 0) ? undefined : products.length}
        />

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => updateParam('disponiveis', onlyAvailable ? null : '1')}
              aria-pressed={onlyAvailable}
              className={`inline-flex min-h-[40px] items-center rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                onlyAvailable
                  ? 'bg-[var(--status-available)] font-display font-bold text-white shadow-sm'
                  : 'bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] hover:border-[var(--brand-orange)]'
              }`}
            >
              Apenas disponíveis
            </button>

            <button
              type="button"
              onClick={() => updateParam('promocoes', onlyPromos ? null : '1')}
              aria-pressed={onlyPromos}
              className={`inline-flex min-h-[40px] items-center rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                onlyPromos
                  ? 'bg-[var(--brand-yellow)] font-display font-bold text-[var(--text-on-accent)] shadow-sm'
                  : 'bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] hover:border-[var(--brand-orange)]'
              }`}
            >
              Em promoção
            </button>
          </div>

          {!loading && !(error && products.length === 0) && (
            <div className="flex items-center gap-3 text-xs text-[var(--text-secondary)]">
              <span className="tabular-nums">
                {filteredProducts.length}{' '}
                {filteredProducts.length === 1 ? 'produto' : 'produtos'}
              </span>
              {hasAnyFilter && (
                <button
                  type="button"
                  onClick={resetAllFilters}
                  className="font-display font-bold uppercase text-[var(--brand-orange-text)] hover:underline cursor-pointer"
                >
                  Limpar filtros
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <ProductGrid
        products={filteredProducts}
        loading={loading}
        error={error}
        emptyTitle={
          debouncedQuery.trim().length > 0 || onlyAvailable
            ? 'Nenhum produto encontrado'
            : selectedCategory !== 'all'
            ? 'Sem produtos nesta categoria'
            : onlyPromos
            ? 'Sem promoções de momento'
            : 'Sem produtos disponíveis de momento'
        }
        emptyDescription={
          debouncedQuery.trim().length > 0 || onlyAvailable
            ? PUBLIC_MESSAGES.emptySearch
            : selectedCategory !== 'all'
            ? PUBLIC_MESSAGES.emptyCategory
            : onlyPromos
            ? PUBLIC_MESSAGES.emptyPromotions
            : PUBLIC_MESSAGES.emptyCatalog
        }
        onResetFilters={hasAnyFilter ? resetAllFilters : undefined}
        onRefresh={!hasAnyFilter ? () => void refreshCatalog() : undefined}
        onRetry={() => void refreshCatalog()}
      />
    </div>
  );
};
