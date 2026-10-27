import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, MessageCircle, RefreshCw } from 'lucide-react';
import { BrandLogo } from '../components/BrandLogo';
import { CategoryList } from '../components/CategoryList';
import { ProductGrid } from '../components/ProductGrid';
import { SearchBar } from '../components/SearchBar';
import { SpeedLinesDivider } from '../components/SpeedLinesDivider';
import { STORE_CONFIG } from '../config/store';
import { useCatalog } from '../context/CatalogContext';
import {
  filterProducts,
  getFeaturedProducts,
  getNewProducts,
  getPromotionalProducts,
} from '../utils/catalog';
import { buildWhatsAppUrl } from '../utils/checkout';
import { PUBLIC_MESSAGES } from '../utils/publicMessages';

type CatalogTab = 'all' | 'new' | 'promos';

export const HomePage: React.FC = () => {
  const {
    products,
    categories,
    storeSettings,
    loading,
    error,
    whatsappNumber,
    refreshCatalog,
  } = useCatalog();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [activeTab, setActiveTab] = useState<CatalogTab>('all');
  const [heroImgFailed, setHeroImgFailed] = useState(false);

  const featuredProducts = useMemo(() => getFeaturedProducts(products), [products]);
  const promotionalProducts = useMemo(() => getPromotionalProducts(products), [products]);
  const newProducts = useMemo(() => getNewProducts(products), [products]);

  const isFiltering = searchQuery.trim().length > 0 || selectedCategory !== 'all';

  const baseTabProducts = useMemo(() => {
    if (isFiltering) {
      return products;
    }
    if (activeTab === 'new') return newProducts;
    if (activeTab === 'promos') return promotionalProducts;
    return products;
  }, [activeTab, isFiltering, newProducts, products, promotionalProducts]);

  const displayedCatalogProducts = useMemo(
    () =>
      filterProducts(baseTabProducts, {
        query: searchQuery,
        category: selectedCategory,
      }),
    [baseTabProducts, searchQuery, selectedCategory]
  );

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedCategory('all');
    setActiveTab('all');
  };

  const scrollToCatalog = () => {
    const el = document.getElementById('sec-catalogo');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const brandName = storeSettings.brandName || STORE_CONFIG.brandName;
  const whatsappDirectUrl = buildWhatsAppUrl(
    whatsappNumber,
    `Olá, ${brandName}! Gostaria de receber informações sobre os vossos produtos.`
  );

  const heroConfig = storeSettings.heroConfig;
  const customHeroBannerUrl =
    heroConfig?.bannerImageUrl && !heroImgFailed ? heroConfig.bannerImageUrl : null;

  return (
    <div className="space-y-8 sm:space-y-12">
      {/* 5.2. Banner Principal (Hero sincronizado com definições comerciais quando configuradas) */}
      <section className="relative overflow-hidden border-b border-white/10 bg-[#0A0A0A]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-7 sm:py-10 lg:py-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 items-center gap-6 lg:gap-10">
            <div className="lg:col-span-7 space-y-4">
              <SpeedLinesDivider />

              {heroConfig?.title ? (
                <h1 className="font-display text-2xl sm:text-4xl lg:text-5xl font-extrabold leading-[1.12] tracking-tight text-white">
                  {heroConfig.title}{' '}
                  {heroConfig.highlight && (
                    <span className="text-[#FF8A00]">{heroConfig.highlight}</span>
                  )}
                </h1>
              ) : (
                <h1 className="font-display text-2xl sm:text-4xl lg:text-5xl font-extrabold leading-[1.12] tracking-tight text-white">
                  O futuro das compras <span className="text-[#FF8A00]">começa aqui.</span>
                </h1>
              )}

              <p className="max-w-xl text-sm sm:text-base lg:text-lg text-[#8A8A8A] leading-relaxed">
                {heroConfig?.subtitle ??
                  storeSettings.description ??
                  'Descobre os produtos que procuras, com uma experiência de compra simples, rápida e cómoda.'}
              </p>

              <div className="flex flex-wrap items-center gap-4 pt-1">
                <button
                  type="button"
                  onClick={scrollToCatalog}
                  className="inline-flex min-h-[48px] w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-bercali-gradient px-6 py-3 font-display text-sm font-extrabold uppercase tracking-wide text-[#0A0A0A] shadow-lg transition-transform active:scale-[0.99] cursor-pointer whitespace-nowrap"
                >
                  <span>{heroConfig?.ctaText || 'EXPLORAR PRODUTOS'}</span>
                  <ArrowRight className="h-4 w-4" />
                </button>

                <a
                  href={whatsappDirectUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[44px] items-center gap-2 text-sm font-medium text-white/85 hover:text-[#FF8A00] transition-colors whitespace-nowrap"
                >
                  <MessageCircle className="h-4 w-4 text-[#FF8A00]" />
                  <span>Falar connosco no WhatsApp</span>
                </a>
              </div>
            </div>

            {/* Destaque da identidade oficial ou banner de campanha em ecrãs largos */}
            <div className="hidden lg:flex lg:col-span-5 justify-end">
              {customHeroBannerUrl ? (
                <div className="w-full max-w-md overflow-hidden rounded-2xl bg-[#121212] border border-white/10">
                  <img
                    src={customHeroBannerUrl}
                    alt={heroConfig?.title || brandName}
                    width={640}
                    height={420}
                    referrerPolicy="no-referrer"
                    onError={() => setHeroImgFailed(true)}
                    className="aspect-[16/10] w-full object-cover"
                  />
                </div>
              ) : (
                <div className="flex w-full max-w-xs flex-col items-center justify-center rounded-2xl bg-[#121212] border border-white/10 p-7 text-center">
                  <BrandLogo size="hero" />
                  <p className="mt-3 text-xs text-[#8A8A8A] leading-relaxed">
                    Preços em Kwanzas (Kz) e atendimento direto pelo WhatsApp em Angola.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-10 sm:space-y-14">
        {error && !loading && products.length > 0 && (
          <div
            role="alert"
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl bg-[#1A1A1A] border border-white/15 px-4 py-3 text-xs text-white/90"
          >
            <span>{error}</span>
            <button
              type="button"
              onClick={() => void refreshCatalog()}
              className="inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-[#0A0A0A] px-3.5 py-1.5 font-display text-xs font-bold uppercase text-white hover:border-[#FF8A00] hover:text-[#FF8A00] transition-colors cursor-pointer shrink-0"
            >
              <RefreshCw className="h-3.5 w-3.5 text-[#FF8A00]" />
              <span>Tentar novamente</span>
            </button>
          </div>
        )}

        {/* Secção Produtos em Destaque (apenas quando não está em pesquisa ativa) */}
        {!loading && !isFiltering && featuredProducts.length > 0 && (
          <section aria-labelledby="heading-featured" className="space-y-5">
            <div className="flex items-end justify-between gap-4">
              <div>
                <SpeedLinesDivider className="mb-2.5" />
                <h2
                  id="heading-featured"
                  className="font-display text-xl sm:text-2xl font-bold text-white"
                >
                  Produtos em destaque
                </h2>
              </div>
              <Link
                to="/catalogo"
                className="font-display text-xs sm:text-sm font-bold uppercase text-[#FF8A00] hover:underline whitespace-nowrap shrink-0"
              >
                Ver tudo
              </Link>
            </div>

            <ProductGrid products={featuredProducts} />
          </section>
        )}

        {/* 5.3, 5.4 & 5.5. Pesquisa, Categorias Dinâmicas, Novidades, Promoções e Catálogo Completo */}
        <section id="sec-catalogo" aria-labelledby="heading-catalog" className="scroll-mt-20 space-y-5">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <SpeedLinesDivider className="mb-2.5" />
              <h2
                id="heading-catalog"
                className="font-display text-xl sm:text-2xl font-bold text-white"
              >
                {isFiltering ? 'Resultados da pesquisa' : 'Explorar catálogo'}
              </h2>
            </div>

            {!isFiltering && !loading && products.length > 0 && (
              <div
                role="tablist"
                aria-label="Secções do catálogo"
                className="flex flex-wrap sm:inline-flex w-full sm:w-auto self-start gap-1 rounded-lg bg-[#1A1A1A] border border-white/10 p-1"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'all'}
                  onClick={() => setActiveTab('all')}
                  className={`min-h-[38px] flex-1 sm:flex-none rounded-md px-2.5 sm:px-3.5 py-1.5 text-[11px] sm:text-xs font-medium whitespace-nowrap text-center transition-colors cursor-pointer ${
                    activeTab === 'all'
                      ? 'bg-[#FF8A00] font-display font-bold text-[#0A0A0A]'
                      : 'text-white/80 hover:text-white'
                  }`}
                >
                  <span className="sm:hidden">Catálogo ({products.length})</span>
                  <span className="hidden sm:inline">Catálogo completo ({products.length})</span>
                </button>

                {newProducts.length > 0 && (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'new'}
                    onClick={() => setActiveTab('new')}
                    className={`min-h-[38px] flex-1 sm:flex-none rounded-md px-2.5 sm:px-3.5 py-1.5 text-[11px] sm:text-xs font-medium whitespace-nowrap text-center transition-colors cursor-pointer ${
                      activeTab === 'new'
                        ? 'bg-[#FF8A00] font-display font-bold text-[#0A0A0A]'
                        : 'text-white/80 hover:text-white'
                    }`}
                  >
                    Novidades ({newProducts.length})
                  </button>
                )}

                {promotionalProducts.length > 0 && (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'promos'}
                    onClick={() => setActiveTab('promos')}
                    className={`min-h-[38px] flex-1 sm:flex-none rounded-md px-2.5 sm:px-3.5 py-1.5 text-[11px] sm:text-xs font-medium whitespace-nowrap text-center transition-colors cursor-pointer ${
                      activeTab === 'promos'
                        ? 'bg-[#FFC400] font-display font-bold text-[#0A0A0A]'
                        : 'text-white/80 hover:text-white'
                    }`}
                  >
                    Promoções ({promotionalProducts.length})
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="space-y-3.5">
            <SearchBar value={searchQuery} onChange={setSearchQuery} />
            {(categories.length > 0 || (!loading && !error)) && (
              <CategoryList
                categories={categories}
                selectedCategory={selectedCategory}
                onSelectCategory={setSelectedCategory}
                totalCount={loading || (error && products.length === 0) ? undefined : products.length}
              />
            )}
          </div>

          {isFiltering && !loading && !(error && products.length === 0) && (
            <div className="flex items-center justify-between gap-2 text-xs text-[#8A8A8A]">
              <span>
                {displayedCatalogProducts.length}{' '}
                {displayedCatalogProducts.length === 1
                  ? 'produto encontrado'
                  : 'produtos encontrados'}
              </span>
              <button
                type="button"
                onClick={handleResetFilters}
                className="font-display font-bold uppercase text-[#FF8A00] hover:underline cursor-pointer"
              >
                Limpar filtros
              </button>
            </div>
          )}

          <ProductGrid
            products={displayedCatalogProducts}
            loading={loading}
            error={error}
            emptyTitle={
              searchQuery.trim().length > 0
                ? 'Nenhum produto encontrado'
                : selectedCategory !== 'all'
                ? 'Sem produtos nesta categoria'
                : activeTab === 'promos'
                ? 'Sem promoções de momento'
                : 'Sem produtos disponíveis de momento'
            }
            emptyDescription={
              searchQuery.trim().length > 0
                ? PUBLIC_MESSAGES.emptySearch
                : selectedCategory !== 'all'
                ? PUBLIC_MESSAGES.emptyCategory
                : activeTab === 'promos'
                ? PUBLIC_MESSAGES.emptyPromotions
                : PUBLIC_MESSAGES.emptyCatalog
            }
            onResetFilters={isFiltering ? handleResetFilters : undefined}
            onRefresh={!isFiltering ? () => void refreshCatalog() : undefined}
            onRetry={() => void refreshCatalog()}
          />
        </section>
      </div>
    </div>
  );
};
