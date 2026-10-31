import React, { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, ChevronRight, FolderOpen, RefreshCw } from 'lucide-react';
import { ProductGrid } from '../components/ProductGrid';
import { SpeedLinesDivider } from '../components/SpeedLinesDivider';
import { useCatalog } from '../context/CatalogContext';
import { filterProducts } from '../utils/catalog';
import { PUBLIC_MESSAGES } from '../utils/publicMessages';

export const CategoriesPage: React.FC = () => {
  const { categorySlug } = useParams<{ categorySlug?: string }>();
  const { products, categories, loading, error, refreshCatalog } = useCatalog();

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
            className="inline-flex min-h-[44px] items-center gap-2 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--brand-orange-text)] transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Todas as categorias</span>
          </Link>
        </div>

        <div>
          <SpeedLinesDivider className="mb-2.5" />
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)]">
            {loading
              ? 'A carregar categoria...'
              : activeCategory
              ? activeCategory.name
              : error
              ? 'Categorias'
              : 'Categoria não encontrada'}
          </h1>
          {!loading && activeCategory && (
            <p className="mt-1 text-sm text-[var(--text-secondary)] tabular-nums">
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
          error={error}
          emptyTitle="Sem produtos nesta categoria"
          emptyDescription={PUBLIC_MESSAGES.emptyCategory}
          onRefresh={() => void refreshCatalog()}
          onRetry={() => void refreshCatalog()}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-6">
      <div>
        <SpeedLinesDivider className="mb-2.5" />
        <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)]">
          Categorias
        </h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Explora os produtos organizados dinamicamente conforme o catálogo atual da Bercali Store.
        </p>
      </div>

      {error && !loading && categories.length > 0 && (
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

      {loading ? (
        <div
          role="status"
          aria-label="A carregar categorias"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {[0, 1, 2].map((idx) => (
            <div
              key={`cat-skeleton-${idx}`}
              className="flex min-h-[88px] items-center justify-between gap-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-[var(--shadow-card)] p-5 animate-pulse"
            >
              <div className="flex items-center gap-3.5">
                <div className="h-11 w-11 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)]" />
                <div className="space-y-2">
                  <div className="h-4 w-32 rounded bg-[#E7E5E0]" />
                  <div className="h-3 w-24 rounded bg-[var(--bg-subtle)]" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : error && categories.length === 0 ? (
        <div
          role="alert"
          className="rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-[var(--shadow-card)] p-8 sm:p-12 text-center"
        >
          <AlertCircle className="mx-auto h-10 w-10 text-[var(--brand-orange-text)]" aria-hidden="true" />
          <h2 className="mt-4 font-display text-lg font-bold text-[var(--text-primary)]">
            Não foi possível carregar as categorias
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-[var(--text-secondary)] leading-relaxed">{error}</p>
          <button
            type="button"
            onClick={() => void refreshCatalog()}
            className="mt-5 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-bercali-gradient px-6 py-2.5 font-display text-xs font-extrabold uppercase text-[var(--text-on-accent)] shadow-md transition-transform active:scale-[0.99] cursor-pointer"
          >
            <RefreshCw className="h-4 w-4 shrink-0" />
            <span>Tentar novamente</span>
          </button>
        </div>
      ) : categories.length === 0 ? (
        <div className="rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-[var(--shadow-card)] p-8 sm:p-12 text-center">
          <FolderOpen className="mx-auto h-10 w-10 text-[var(--brand-orange-text)]" aria-hidden="true" />
          <h2 className="mt-4 font-display text-lg font-bold text-[var(--text-primary)]">
            Sem categorias disponíveis de momento
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-[var(--text-secondary)] leading-relaxed">
            {PUBLIC_MESSAGES.emptyCategoriesList}
          </p>
          <button
            type="button"
            onClick={() => void refreshCatalog()}
            className="mt-5 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-[var(--border-input)] bg-[var(--bg-subtle)] px-5 py-2.5 font-display text-xs font-bold uppercase text-[var(--text-primary)] hover:border-[var(--brand-orange)] hover:text-[var(--brand-orange-text)] transition-colors cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5 text-[var(--brand-orange-text)]" />
            <span>Atualizar categorias</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((cat) => (
            <Link
              key={cat.slug}
              to={`/categoria/${cat.slug}`}
              className="group flex min-h-[88px] items-center justify-between gap-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-[var(--shadow-card)] p-5 hover:border-[var(--brand-orange)] transition-colors"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--brand-orange-text)]">
                  <FolderOpen className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="font-display text-base font-bold text-[var(--text-primary)] group-hover:text-[var(--brand-orange-text)] transition-colors truncate">
                    {cat.name}
                  </h2>
                  <p className="mt-0.5 text-xs text-[var(--text-secondary)] tabular-nums">
                    {cat.count} {cat.count === 1 ? 'artigo' : 'artigos'} · {cat.availableCount}{' '}
                    {cat.availableCount === 1 ? 'disponível' : 'disponíveis'}
                  </p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-[var(--text-secondary)] group-hover:text-[var(--brand-orange-text)] transition-colors" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};
