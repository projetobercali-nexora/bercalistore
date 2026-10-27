import React, { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronRight, FolderOpen, RefreshCw } from 'lucide-react';
import { ProductGrid } from '../components/ProductGrid';
import { SpeedLinesDivider } from '../components/SpeedLinesDivider';
import { useCatalog } from '../context/CatalogContext';
import { filterProducts } from '../utils/catalog';

export const CategoriesPage: React.FC = () => {
  const { categorySlug } = useParams<{ categorySlug?: string }>();
  const { products, categories, loading, error, accessNotice, refreshCatalog } = useCatalog();

  const activeCategory = useMemo(
    () => (categorySlug ? categories.find((c) => c.slug === categorySlug) : undefined),
    [categories, categorySlug]
  );

  const categoryProducts = useMemo(
    () => (categorySlug ? filterProducts(products, { category: categorySlug }) : []),
    [categorySlug, products]
  );

  if (categorySlug) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <Link
            to="/categorias"
            className="inline-flex min-h-[44px] items-center gap-2 text-sm font-medium text-[#8A8A8A] hover:text-[#FF8A00] transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Todas as categorias</span>
          </Link>
        </div>

        <div>
          <SpeedLinesDivider className="mb-2.5" />
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
            {loading
              ? 'A carregar categoria...'
              : activeCategory
              ? activeCategory.name
              : 'Categoria não encontrada'}
          </h1>
          {!loading && activeCategory && (
            <p className="mt-1 text-sm text-[#8A8A8A] tabular-nums">
              {categoryProducts.length}{' '}
              {categoryProducts.length === 1
                ? 'produto nesta categoria'
                : 'produtos nesta categoria'}
            </p>
          )}
        </div>

        <ProductGrid
          products={categoryProducts}
          loading={loading}
          emptyTitle="Sem produtos nesta categoria"
          emptyDescription="Consulta as outras categorias disponíveis no catálogo da Bercali Store."
          onRefresh={() => void refreshCatalog()}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-6">
      <div>
        <SpeedLinesDivider className="mb-2.5" />
        <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
          Categorias
        </h1>
        <p className="mt-1 text-sm text-[#8A8A8A]">
          Explora os produtos organizados dinamicamente conforme o catálogo atual da Bercali Store.
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

      {loading ? (
        <div
          role="status"
          aria-label="A carregar categorias"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {[0, 1, 2].map((idx) => (
            <div
              key={`cat-skeleton-${idx}`}
              className="flex min-h-[88px] items-center justify-between gap-4 rounded-xl bg-[#1A1A1A] border border-white/10 p-5 animate-pulse"
            >
              <div className="flex items-center gap-3.5">
                <div className="h-11 w-11 rounded-lg bg-[#0A0A0A] border border-white/10" />
                <div className="space-y-2">
                  <div className="h-4 w-32 rounded bg-white/15" />
                  <div className="h-3 w-24 rounded bg-white/10" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : categories.length === 0 ? (
        <div className="rounded-xl bg-[#1A1A1A] border border-white/10 p-8 sm:p-12 text-center">
          <FolderOpen className="mx-auto h-10 w-10 text-[#FF8A00]" aria-hidden="true" />
          <h2 className="mt-4 font-display text-lg font-bold text-white">
            Nenhuma categoria ativa visível
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-[#8A8A8A]">
            {accessNotice ??
              'As categorias ativas criadas no Painel Administrativo aparecerão aqui automaticamente.'}
          </p>
          <button
            type="button"
            onClick={() => void refreshCatalog()}
            className="mt-5 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-white/15 bg-[#0A0A0A] px-5 py-2.5 font-display text-xs font-bold uppercase text-white hover:border-[#FF8A00] hover:text-[#FF8A00] transition-colors cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5 text-[#FF8A00]" />
            <span>Atualizar categorias</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((cat) => (
            <Link
              key={cat.slug}
              to={`/categoria/${cat.slug}`}
              className="group flex min-h-[88px] items-center justify-between gap-4 rounded-xl bg-[#1A1A1A] border border-white/10 p-5 hover:border-[#FF8A00] transition-colors"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#0A0A0A] border border-white/10 text-[#FF8A00]">
                  <FolderOpen className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="font-display text-base font-bold text-white group-hover:text-[#FF8A00] transition-colors truncate">
                    {cat.name}
                  </h2>
                  <p className="mt-0.5 text-xs text-[#8A8A8A] tabular-nums">
                    {cat.count} {cat.count === 1 ? 'artigo' : 'artigos'} · {cat.availableCount}{' '}
                    {cat.availableCount === 1 ? 'disponível' : 'disponíveis'}
                  </p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-[#8A8A8A] group-hover:text-[#FF8A00] transition-colors" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};
