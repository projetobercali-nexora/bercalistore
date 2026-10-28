import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Check,
  CreditCard,
  Flame,
  ImageOff,
  LayoutGrid,
  MessageCircle,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  ShoppingBag,
  Tag,
  Truck,
  X,
} from 'lucide-react';
import { ProductGrid } from '../components/ProductGrid';
import { STORE_CONFIG } from '../config/store';
import { useCart } from '../context/CartContext';
import { useCatalog } from '../context/CatalogContext';
import type { Product } from '../types/store';
import { getMaxAllowedQuantity } from '../utils/cart';
import {
  filterProducts,
  getFeaturedProducts,
  getNewProducts,
  getPromotionalProducts,
} from '../utils/catalog';
import { buildWhatsAppUrl } from '../utils/checkout';
import {
  calculateDiscountPercent,
  formatKz,
  getAvailabilityLabel,
  getProductAvailability,
  isProductPurchasable,
  slugifyCategory,
} from '../utils/format';
import { PUBLIC_MESSAGES } from '../utils/publicMessages';

type CatalogTab = 'all' | 'new' | 'promos';

interface HomeProductCardProps {
  product: Product;
}

const HomeProductCard: React.FC<HomeProductCardProps> = ({ product }) => {
  const { addItem, getQuantityInCart } = useCart();
  const { isStoreActive } = useCatalog();
  const [imageError, setImageError] = useState(false);
  const [justAdded, setJustAdded] = useState(false);

  const status = getProductAvailability(product);
  const statusLabel = getAvailabilityLabel(status);
  const purchasable = isProductPurchasable(product);
  const canAddNow = isStoreActive && purchasable;
  const discountPct = calculateDiscountPercent(product.price, product.oldPrice);
  const qtyInCart = getQuantityInCart(product.id);
  const maxAllowed = getMaxAllowedQuantity(product);
  const stockLimitReached = canAddNow && qtyInCart >= maxAllowed;

  const mainImage = product.images.length > 0 && !imageError ? product.images[0] : null;

  const handleAdd = () => {
    if (!canAddNow || stockLimitReached) return;
    const ok = addItem(product, 1);
    if (ok) {
      setJustAdded(true);
      window.setTimeout(() => setJustAdded(false), 1400);
    }
  };

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl bg-[#161616] border border-white/10 shadow-md shadow-black/40 transition-transform duration-150 hover:-translate-y-0.5 hover:border-white/20">
      <Link
        to={`/produto/${product.slug}`}
        aria-label={`Ver detalhes de ${product.name}`}
        className="relative flex h-44 sm:h-52 w-full shrink-0 items-center justify-center overflow-hidden bg-[#1D1D1F] p-2"
      >
        {mainImage ? (
          <img
            src={mainImage}
            alt={product.name}
            width={640}
            height={480}
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setImageError(true)}
            className="h-full w-full object-contain transition-transform duration-200 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 p-3 text-center">
            <ImageOff className="h-6 w-6 text-[#8A8A8A]" aria-hidden="true" />
            <span className="text-[11px] font-medium text-[#8A8A8A]">Sem fotografia</span>
          </div>
        )}

        {discountPct !== null && (
          <span className="absolute top-2 left-2 rounded-lg bg-[#FFC400] px-2 py-0.5 font-display text-[11px] font-extrabold text-[#0A0A0A] shadow-sm tabular-nums">
            -{discountPct}%
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col justify-between p-2.5 sm:p-3.5">
        <h3 className="font-display text-[13px] sm:text-sm font-semibold leading-snug text-white line-clamp-2 min-h-[2.6em]">
          <Link to={`/produto/${product.slug}`} className="hover:text-[#FF8A00] transition-colors">
            {product.name}
          </Link>
        </h3>

        <div className="mt-2.5 flex items-end justify-between gap-2">
          <div className="min-w-0 flex flex-col">
            {discountPct !== null && typeof product.oldPrice === 'number' && (
              <span className="font-display text-[11px] font-medium text-[#8A8A8A] line-through tabular-nums truncate">
                {formatKz(product.oldPrice)}
              </span>
            )}
            <span className="font-display text-[15px] sm:text-lg font-extrabold text-[#FFC400] leading-tight tabular-nums truncate">
              {formatKz(product.price)}
            </span>
          </div>

          <button
            type="button"
            onClick={handleAdd}
            disabled={!canAddNow || stockLimitReached}
            aria-label={
              !isStoreActive
                ? `${product.name} — Loja temporariamente encerrada para novas encomendas`
                : !purchasable
                ? `${product.name} — ${statusLabel}`
                : stockLimitReached
                ? `Limite de stock atingido no carrinho para ${product.name}`
                : `Adicionar ${product.name} ao carrinho`
            }
            className={`inline-flex h-10 min-w-[44px] shrink-0 items-center justify-center gap-1 rounded-xl px-2.5 sm:px-3 font-display text-[11px] font-extrabold uppercase tracking-wide whitespace-nowrap transition-all ${
              !canAddNow || stockLimitReached
                ? 'bg-white/8 text-[#8A8A8A] cursor-not-allowed'
                : justAdded
                ? 'bg-[#22C55E] text-[#0A0A0A] shadow-sm cursor-pointer'
                : 'bg-bercali-gradient text-[#0A0A0A] shadow-sm shadow-[#FF8A00]/20 hover:brightness-105 active:scale-95 cursor-pointer'
            }`}
          >
            {!isStoreActive ? (
              <span className="text-[10px]">Fechado</span>
            ) : !purchasable ? (
              <span className="text-[10px]">
                {status === 'out_of_stock' ? 'Esgotado' : 'Indisp.'}
              </span>
            ) : stockLimitReached ? (
              <span className="text-[10px]">Máx.</span>
            ) : justAdded ? (
              <>
                <Check className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">Adicionado</span>
              </>
            ) : (
              <>
                <ShoppingBag className="h-4 w-4 shrink-0" />
                <Plus className="h-3.5 w-3.5 -ml-0.5 shrink-0 sm:hidden" />
                <span className="hidden sm:inline">Adicionar</span>
              </>
            )}
          </button>
        </div>
      </div>
    </article>
  );
};

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

  const handleToggleShortcutTab = (targetTab: Exclude<CatalogTab, 'all'>) => {
    setSelectedCategory('all');
    setSearchQuery('');
    setActiveTab((prev) => (prev === targetTab && !isFiltering ? 'all' : targetTab));
  };

  const handleSelectCategoryChip = (categorySlugOrAll: string) => {
    setSelectedCategory(categorySlugOrAll);
    if (categorySlugOrAll === 'all') {
      setActiveTab('all');
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

  const normalizedSelectedCategory =
    selectedCategory === 'all' || !selectedCategory ? 'all' : slugifyCategory(selectedCategory);

  const hasActiveShortcutOrFilter = isFiltering || activeTab !== 'all';

  return (
    <div className="mx-auto max-w-7xl px-3.5 sm:px-6 lg:px-8 pt-3 pb-8 sm:pt-5 sm:pb-12 space-y-3 sm:space-y-4">
      <h1 className="sr-only">{brandName} — Início</h1>

      {/* 2. Barra de pesquisa grande e sempre visível logo abaixo do cabeçalho */}
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          scrollToCatalog();
        }}
        className="relative flex w-full items-center rounded-2xl bg-[#161616] border-2 border-[#FF8A00]/85 focus-within:border-[#FFC400] shadow-md shadow-black/40 transition-colors"
      >
        <label htmlFor="bercali-main-search" className="sr-only">
          Pesquisar produtos na Bercali Store
        </label>
        <div className="pointer-events-none pl-3.5 pr-2 text-[#FF8A00] shrink-0">
          <Search className="h-5 w-5" />
        </div>
        <input
          id="bercali-main-search"
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="O que procuras hoje?"
          autoComplete="off"
          className="min-h-[48px] w-full flex-1 bg-transparent py-2.5 pr-2 text-sm sm:text-base text-white placeholder:text-[#8A8A8A] focus:outline-none"
        />
        {searchQuery.trim().length > 0 && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            aria-label="Limpar pesquisa"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[#8A8A8A] hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        <button
          type="submit"
          className="mr-1.5 inline-flex h-9 shrink-0 items-center justify-center rounded-xl bg-bercali-gradient px-3.5 sm:px-4 font-display text-xs font-extrabold text-[#0A0A0A] whitespace-nowrap transition-transform active:scale-95 cursor-pointer"
        >
          Procurar
        </button>
      </form>

      {/* Banner pequeno e discreto apenas quando existir imagem de campanha configurada no painel */}
      {customHeroBannerUrl && (
        <div className="overflow-hidden rounded-2xl bg-[#141414] border border-white/10 shadow-sm">
          <img
            src={customHeroBannerUrl}
            alt={heroConfig?.title || brandName}
            width={1200}
            height={240}
            referrerPolicy="no-referrer"
            onError={() => setHeroImgFailed(true)}
            className="h-20 sm:h-28 w-full object-cover"
          />
        </div>
      )}

      {/* 3. Atalhos em cartões pequenos numa linha com scroll horizontal */}
      <nav
        aria-label="Atalhos rápidos da loja"
        className="flex items-center gap-2.5 overflow-x-auto pb-0.5 -mx-3.5 px-3.5 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-4 sm:gap-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <Link
          to="/categorias"
          className="flex min-h-[48px] shrink-0 items-center gap-2.5 rounded-2xl bg-[#161616] border border-white/10 px-3.5 py-2 shadow-sm shadow-black/30 hover:border-[#FF8A00]/60 transition-colors whitespace-nowrap"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#FF8A00]/15 text-[#FF8A00]">
            <LayoutGrid className="h-4 w-4" />
          </span>
          <span className="font-display text-xs sm:text-sm font-bold text-white">Categorias</span>
        </Link>

        <button
          type="button"
          onClick={() => handleToggleShortcutTab('promos')}
          aria-pressed={!isFiltering && activeTab === 'promos'}
          className={`flex min-h-[48px] shrink-0 items-center gap-2.5 rounded-2xl border px-3.5 py-2 shadow-sm shadow-black/30 transition-colors whitespace-nowrap cursor-pointer ${
            !isFiltering && activeTab === 'promos'
              ? 'bg-[#FFC400]/15 border-[#FFC400] text-[#FFC400]'
              : 'bg-[#161616] border-white/10 text-white hover:border-[#FFC400]/60'
          }`}
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#FFC400]/15 text-[#FFC400]">
            <Tag className="h-4 w-4" />
          </span>
          <span className="font-display text-xs sm:text-sm font-bold">Promoções</span>
        </button>

        <button
          type="button"
          onClick={() => handleToggleShortcutTab('new')}
          aria-pressed={!isFiltering && activeTab === 'new'}
          className={`flex min-h-[48px] shrink-0 items-center gap-2.5 rounded-2xl border px-3.5 py-2 shadow-sm shadow-black/30 transition-colors whitespace-nowrap cursor-pointer ${
            !isFiltering && activeTab === 'new'
              ? 'bg-[#FF8A00]/15 border-[#FF8A00] text-[#FF8A00]'
              : 'bg-[#161616] border-white/10 text-white hover:border-[#FF8A00]/60'
          }`}
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#FF8A00]/15 text-[#FF8A00]">
            <Flame className="h-4 w-4" />
          </span>
          <span className="font-display text-xs sm:text-sm font-bold">Novidades</span>
        </button>

        <a
          href={whatsappDirectUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-[48px] shrink-0 items-center gap-2.5 rounded-2xl bg-[#161616] border border-white/10 px-3.5 py-2 shadow-sm shadow-black/30 hover:border-[#22C55E]/60 transition-colors whitespace-nowrap"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#22C55E]/15 text-[#22C55E]">
            <MessageCircle className="h-4 w-4" />
          </span>
          <span className="font-display text-xs sm:text-sm font-bold text-white">WhatsApp</span>
        </a>
      </nav>

      {/* 4. Faixa de benefícios compacta */}
      <div
        aria-label="Benefícios Bercali Store"
        className="flex items-center justify-around sm:justify-start sm:gap-6 rounded-xl bg-[#131313] border border-white/8 px-3.5 py-2 text-xs text-white/85 whitespace-nowrap"
      >
        <div className="inline-flex items-center gap-1.5 shrink-0">
          <Truck className="h-3.5 w-3.5 text-[#FF8A00] shrink-0" aria-hidden="true" />
          <span>Entrega rápida</span>
        </div>
        <span aria-hidden="true" className="text-white/20">
          ·
        </span>
        <div className="inline-flex items-center gap-1.5 shrink-0">
          <ShieldCheck className="h-3.5 w-3.5 text-[#FFC400] shrink-0" aria-hidden="true" />
          <span>Pagamento seguro</span>
        </div>
        <span aria-hidden="true" className="hidden sm:inline text-white/20">
          ·
        </span>
        <div className="hidden sm:inline-flex items-center gap-1.5 shrink-0 text-[#8A8A8A]">
          <CreditCard className="h-3.5 w-3.5 text-[#FF8A00] shrink-0" aria-hidden="true" />
          <span>Multicaixa Express e pagamento na entrega</span>
        </div>
      </div>

      {/* 5. Chips de filtro em scroll horizontal (Todas + categorias existentes) */}
      {(categories.length > 0 || (!loading && !error)) && (
        <div
          role="group"
          aria-label="Filtrar por categoria"
          className="flex items-center gap-2 overflow-x-auto pb-0.5 -mx-3.5 px-3.5 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <button
            type="button"
            onClick={() => handleSelectCategoryChip('all')}
            aria-pressed={normalizedSelectedCategory === 'all' && activeTab === 'all'}
            className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-full px-4 py-1.5 text-xs sm:text-sm font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
              normalizedSelectedCategory === 'all' && activeTab === 'all'
                ? 'bg-[#FF8A00] font-display font-bold text-[#0A0A0A] shadow-sm shadow-[#FF8A00]/25'
                : 'bg-[#161616] border border-white/10 text-white/85 hover:border-[#FF8A00]/60 hover:text-white'
            }`}
          >
            <span>Todas</span>
            {!loading && !(error && products.length === 0) && (
              <span
                className={`text-[11px] tabular-nums ${
                  normalizedSelectedCategory === 'all' && activeTab === 'all'
                    ? 'text-[#0A0A0A]/80'
                    : 'text-[#8A8A8A]'
                }`}
              >
                ({products.length})
              </span>
            )}
          </button>

          {categories.map((cat) => {
            const isActive = normalizedSelectedCategory === cat.slug;
            return (
              <button
                key={cat.slug}
                type="button"
                onClick={() => handleSelectCategoryChip(cat.slug)}
                aria-pressed={isActive}
                className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-full px-4 py-1.5 text-xs sm:text-sm font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-[#FF8A00] font-display font-bold text-[#0A0A0A] shadow-sm shadow-[#FF8A00]/25'
                    : 'bg-[#161616] border border-white/10 text-white/85 hover:border-[#FF8A00]/60 hover:text-white'
                }`}
              >
                <span>{cat.name}</span>
                <span
                  className={`text-[11px] tabular-nums ${
                    isActive ? 'text-[#0A0A0A]/80' : 'text-[#8A8A8A]'
                  }`}
                >
                  ({cat.count})
                </span>
              </button>
            );
          })}
        </div>
      )}

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

      {/* 6. Grelha de produtos em 2 colunas logo a seguir */}
      <section
        id="sec-catalogo"
        aria-label={
          isFiltering
            ? 'Resultados da pesquisa'
            : activeTab === 'promos'
            ? 'Produtos em promoção'
            : activeTab === 'new'
            ? 'Novidades'
            : featuredProducts.length > 0
            ? 'Produtos disponíveis'
            : 'Catálogo de produtos'
        }
        className="scroll-mt-20 pt-0.5 space-y-2.5"
      >
        {hasActiveShortcutOrFilter && !loading && !(error && products.length === 0) && (
          <div className="flex items-center justify-between gap-2 px-0.5 text-xs text-[#8A8A8A]">
            <span className="tabular-nums">
              {!isFiltering && activeTab === 'promos'
                ? `Promoções (${displayedCatalogProducts.length})`
                : !isFiltering && activeTab === 'new'
                ? `Novidades (${displayedCatalogProducts.length})`
                : `${displayedCatalogProducts.length} ${
                    displayedCatalogProducts.length === 1
                      ? 'produto encontrado'
                      : 'produtos encontrados'
                  }`}
            </span>
            <button
              type="button"
              onClick={handleResetFilters}
              className="font-display text-xs font-bold text-[#FF8A00] hover:underline whitespace-nowrap cursor-pointer"
            >
              Limpar filtros
            </button>
          </div>
        )}

        {loading ? (
          <div
            role="status"
            aria-label="A carregar catálogo de produtos"
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-5"
          >
            {[0, 1, 2, 3].map((idx) => (
              <div
                key={`home-skeleton-${idx}`}
                className="flex flex-col overflow-hidden rounded-2xl bg-[#161616] border border-white/10 shadow-md animate-pulse"
              >
                <div className="aspect-[4/3] w-full bg-[#101010]" />
                <div className="p-2.5 sm:p-3.5 space-y-2.5">
                  <div className="h-3.5 w-4/5 rounded bg-white/15" />
                  <div className="h-3.5 w-3/5 rounded bg-white/10" />
                  <div className="pt-1 flex items-center justify-between gap-2">
                    <div className="h-5 w-16 rounded bg-[#FFC400]/25" />
                    <div className="h-10 w-11 rounded-xl bg-[#FF8A00]/25" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (error && products.length === 0) || displayedCatalogProducts.length === 0 ? (
          <ProductGrid
            products={[]}
            loading={false}
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
            onResetFilters={hasActiveShortcutOrFilter ? handleResetFilters : undefined}
            onRefresh={!hasActiveShortcutOrFilter ? () => void refreshCatalog() : undefined}
            onRetry={() => void refreshCatalog()}
          />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
            {displayedCatalogProducts.map((product) => (
              <HomeProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
