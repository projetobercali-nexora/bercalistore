import React, { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CategoryList } from '../components/CategoryList';
import { ProductGrid } from '../components/ProductGrid';
import { SearchBar } from '../components/SearchBar';
import { SpeedLinesDivider } from '../components/SpeedLinesDivider';
import { useCatalog } from '../context/CatalogContext';
import { filterProducts } from '../utils/catalog';

export const CatalogPage: React.FC = () => {
  const { products, categories, loading, error, accessNotice, refreshCatalog } = useCatalog();
  const [searchParams, setSearchParams] = useSearchParams();

  const query = searchParams.get('q') ?? '';
  const selectedCategory = searchParams.get('categoria') ?? 'all';
  const onlyAvailable = searchParams.get('disponiveis') === '1';
  const onlyPromos = searchParams.get('promocoes') === '1';
  const shouldFocusSearch = searchParams.get('foco') === 'pesquisa';

  const filteredProducts = useMemo(
    () =>
      filterProducts(products, {
        query,
        category: selectedCategory,
        onlyAvailable,
        onlyPromotions: onlyPromos,
      }),
    [products, query, selectedCategory, onlyAvailable, onlyPromos]
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
    setSearchParams({}, { replace: true });
  };

  const hasAnyFilter =
    query.trim().length > 0 || selectedCategory !== 'all' || onlyAvailable || onlyPromos;

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-6">
      <div>
        <SpeedLinesDivider className="mb-2.5" />
        <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
          Catálogo de produtos
        </h1>
        <p className="mt-1 text-sm text-[#8A8A8A]">
          Encontra rapidamente o que procuras por nome, categoria ou estado de disponibilidade.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl bg-[#1A1A1A] border border-[#FFC400]/40 px-4 py-3 text-xs text-[#8A8A8A]"
        >
          <strong className="text-[#FFC400]">Aviso:</strong> {error}
        </div>
      )}

      <div className="space-y-3.5">
        <SearchBar
          value={query}
          onChange={(val) => updateParam('q', val)}
          autoFocus={shouldFocusSearch}
        />

        <CategoryList
          categories={categories}
          selectedCategory={selectedCategory}
          onSelectCategory={(cat) => updateParam('categoria', cat)}
          totalCount={loading ? undefined : products.length}
        />

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => updateParam('disponiveis', onlyAvailable ? null : '1')}
              aria-pressed={onlyAvailable}
              className={`inline-flex min-h-[40px] items-center rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                onlyAvailable
                  ? 'bg-[#22C55E] font-display font-bold text-[#0A0A0A]'
                  : 'bg-[#1A1A1A] border border-white/10 text-white/85 hover:border-white/30'
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
                  ? 'bg-[#FFC400] font-display font-bold text-[#0A0A0A]'
                  : 'bg-[#1A1A1A] border border-white/10 text-white/85 hover:border-white/30'
              }`}
            >
              Em promoção
            </button>
          </div>

          {!loading && (
            <div className="flex items-center gap-3 text-xs text-[#8A8A8A]">
              <span className="tabular-nums">
                {filteredProducts.length}{' '}
                {filteredProducts.length === 1 ? 'produto' : 'produtos'}
              </span>
              {hasAnyFilter && (
                <button
                  type="button"
                  onClick={resetAllFilters}
                  className="font-display font-bold uppercase text-[#FF8A00] hover:underline cursor-pointer"
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
        emptyTitle={
          hasAnyFilter
            ? 'Nenhum produto encontrado'
            : 'Nenhum produto publicado disponível'
        }
        emptyDescription={
          hasAnyFilter
            ? 'Não encontrámos artigos para esta pesquisa ou filtro. Tenta usar outras palavras ou limpa os filtros.'
            : accessNotice ??
              'Assim que os produtos forem publicados no Painel Administrativo da Bercali Store, ficarão listados neste catálogo.'
        }
        onResetFilters={hasAnyFilter ? resetAllFilters : undefined}
        onRefresh={!hasAnyFilter ? () => void refreshCatalog() : undefined}
      />
    </div>
  );
};
