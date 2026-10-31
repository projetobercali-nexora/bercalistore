import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Lock,
  MessageCircle,
  Minus,
  Plus,
  RefreshCw,
  ShoppingBag,
  Zap,
} from 'lucide-react';
import { ProductGallery } from '../components/ProductGallery';
import { ProductGrid } from '../components/ProductGrid';
import { SpeedLinesDivider } from '../components/SpeedLinesDivider';
import { STORE_CONFIG } from '../config/store';
import { useCart } from '../context/CartContext';
import { useCatalog } from '../context/CatalogContext';
import { clampQuantityForProduct, getMaxAllowedQuantity } from '../utils/cart';
import { getProductBySlug, getRelatedProducts } from '../utils/catalog';
import { buildWhatsAppProductInquiryMessage, buildWhatsAppUrl } from '../utils/checkout';
import {
  calculateDiscountPercent,
  formatKz,
  getAvailabilityLabel,
  getProductAvailability,
  isProductPurchasable,
  slugifyCategory,
} from '../utils/format';
import {
  META_PIXEL_READY_EVENT,
  trackMetaContact,
  trackMetaViewContent,
} from '../utils/metaPixel';
import { PUBLIC_MESSAGES } from '../utils/publicMessages';

export const ProductDetailPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const {
    products,
    loading,
    error,
    isStoreActive,
    storeSettings,
    whatsappNumber,
    hasWhatsApp,
    refreshCatalog,
    loadProductGallery,
  } = useCatalog();
  const { addItem, getQuantityInCart } = useCart();

  const product = useMemo(
    () => (slug ? getProductBySlug(products, slug) : undefined),
    [products, slug]
  );
  const [quantity, setQuantity] = useState(1);
  const [addedFeedback, setAddedFeedback] = useState(false);
  const lastViewedProductIdRef = useRef<string | null>(null);

  useEffect(() => {
    setQuantity(1);
    setAddedFeedback(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [slug]);

  useEffect(() => {
    if (!product) return;
    const tryTrackViewContent = () => {
      if (lastViewedProductIdRef.current !== product.id) {
        if (trackMetaViewContent(product)) {
          lastViewedProductIdRef.current = product.id;
        }
      }
    };
    tryTrackViewContent();
    window.addEventListener(META_PIXEL_READY_EVENT, tryTrackViewContent);
    return () => {
      window.removeEventListener(META_PIXEL_READY_EVENT, tryTrackViewContent);
    };
  }, [product]);

  useEffect(() => {
    if (!product?.id) return;
    void loadProductGallery(product.id, product.sku);
  }, [product?.id, product?.sku, loadProductGallery]);

  const relatedProducts = useMemo(
    () => (product ? getRelatedProducts(products, product, 4) : []),
    [product, products]
  );

  if (loading && !product) {
    return (
      <div
        role="status"
        aria-label="A carregar detalhes do produto"
        className="mx-auto max-w-7xl lg:px-8 lg:py-6 pb-24 animate-pulse"
      >
        <div className="px-3.5 sm:px-6 lg:px-0 py-2">
          <div className="h-7 w-24 rounded-lg bg-[#E7E5E0]" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-10 items-start">
          <div className="lg:col-span-6 h-[310px] sm:h-[400px] lg:h-[460px] w-full bg-[var(--bg-subtle)] lg:rounded-2xl lg:border lg:border-[var(--border-subtle)]" />
          <div className="lg:col-span-6 px-3.5 sm:px-6 lg:p-7 lg:rounded-2xl lg:bg-[var(--bg-surface)] lg:border lg:border-[var(--border-subtle)] lg:shadow-[var(--shadow-card)] space-y-3">
            <div className="h-7 w-3/4 rounded bg-[#E7E5E0]" />
            <div className="h-8 w-36 rounded bg-[#E7E5E0]" />
            <div className="h-4 w-48 rounded bg-[var(--bg-subtle)]" />
            <div className="space-y-2 pt-2">
              <div className="h-4 w-full rounded bg-[var(--bg-subtle)]" />
              <div className="h-4 w-5/6 rounded bg-[var(--bg-subtle)]" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!product && error) {
    return (
      <div className="mx-auto max-w-2xl px-4 sm:px-6 py-16">
        <div
          role="alert"
          className="rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-[var(--shadow-card)] p-8 sm:p-10 text-center space-y-4"
        >
          <AlertCircle className="mx-auto h-10 w-10 text-[var(--brand-orange-text)]" aria-hidden="true" />
          <h1 className="font-display text-2xl font-extrabold text-[var(--text-primary)]">
            Não foi possível carregar este produto
          </h1>
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{error}</p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => void refreshCatalog()}
              className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-xl bg-bercali-gradient px-6 py-2.5 font-display text-xs font-extrabold uppercase text-[var(--text-on-accent)] shadow-md transition-transform active:scale-[0.99] cursor-pointer"
            >
              <RefreshCw className="h-4 w-4 shrink-0" />
              <span>Tentar novamente</span>
            </button>
            <Link
              to="/catalogo"
              className="inline-flex min-h-[46px] items-center justify-center rounded-xl border border-[var(--border-input)] bg-[var(--bg-subtle)] px-5 py-2.5 font-display text-xs font-bold uppercase text-[var(--text-primary)] hover:border-[var(--brand-orange)] hover:text-[var(--brand-orange-text)] transition-colors"
            >
              Voltar ao catálogo
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-16 text-center space-y-4">
        <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)]">
          Produto não encontrado
        </h1>
        <p className="text-sm text-[var(--text-secondary)]">{PUBLIC_MESSAGES.productNotFound}</p>
        <Link
          to="/catalogo"
          className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-bercali-gradient px-6 py-3 font-display text-sm font-bold uppercase text-[var(--text-on-accent)] shadow-sm"
        >
          Voltar ao catálogo
        </Link>
      </div>
    );
  }

  const status = getProductAvailability(product);
  const statusLabel = getAvailabilityLabel(status);
  const purchasable = isProductPurchasable(product);
  const canOrderNow = isStoreActive && purchasable;
  const discountPct = calculateDiscountPercent(product.price, product.oldPrice);
  const qtyInCart = getQuantityInCart(product.id);
  const maxAllowed = getMaxAllowedQuantity(product);
  const remainingAddable = Math.max(0, maxAllowed - qtyInCart);

  const effectiveMaxSelectable = canOrderNow ? Math.max(1, remainingAddable || maxAllowed) : 1;
  const categoryTargetSlug = product.categorySlug?.trim() || slugifyCategory(product.category);

  const brandName = storeSettings.brandName || STORE_CONFIG.brandName;
  const whatsappProductMessage = buildWhatsAppProductInquiryMessage(
    product,
    quantity,
    brandName,
    storeSettings.whatsappMessageTemplate
  );
  const whatsappProductHref = hasWhatsApp
    ? buildWhatsAppUrl(whatsappNumber, whatsappProductMessage)
    : '';

  const isLowStock =
    purchasable &&
    product.manageStock !== false &&
    typeof product.stock === 'number' &&
    typeof product.lowStockThreshold === 'number' &&
    product.stock > 0 &&
    product.stock <= product.lowStockThreshold;

  const handleDecrease = () => {
    setQuantity((prev) => Math.max(1, prev - 1));
  };

  const handleIncrease = () => {
    setQuantity((prev) =>
      clampQuantityForProduct(product, Math.min(effectiveMaxSelectable, prev + 1))
    );
  };

  const handleAddToCart = () => {
    if (!canOrderNow || remainingAddable <= 0) return;
    const toAdd = Math.min(quantity, remainingAddable);
    if (addItem(product, toAdd)) {
      setAddedFeedback(true);
      window.setTimeout(() => setAddedFeedback(false), 1800);
    }
  };

  const handleBuyNow = () => {
    if (!canOrderNow) return;
    if (remainingAddable > 0) {
      addItem(product, Math.min(quantity, remainingAddable));
    }
    navigate('/finalizar');
  };

  return (
    <div className="mx-auto max-w-7xl pb-24 md:pb-24 lg:px-8 lg:pt-5">
      {/* Navegação compacta de retorno colada à galeria */}
      <div className="flex items-center justify-between gap-4 px-3.5 sm:px-6 lg:px-0 py-1.5 lg:pb-3">
        <button
          type="button"
          onClick={() => {
            if (window.history.length > 1) {
              navigate(-1);
            } else {
              navigate('/catalogo');
            }
          }}
          className="inline-flex min-h-[40px] items-center gap-1.5 text-sm font-medium text-[var(--text-primary)] hover:text-[var(--brand-orange-text)] transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Voltar</span>
        </button>

        <Link
          to={`/categoria/${categoryTargetSlug}`}
          className="text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--brand-orange-text)] transition-colors truncate"
        >
          {product.category}
        </Link>
      </div>

      {/* Módulo principal: Galeria largura total + Informação essencial imediata */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 lg:gap-10 items-start">
        <div className="lg:col-span-6">
          <ProductGallery product={product} />
        </div>

        <div className="lg:col-span-6 px-3.5 sm:px-6 lg:p-7 lg:rounded-2xl lg:bg-[var(--bg-surface)] lg:border lg:border-[var(--border-subtle)] lg:shadow-[var(--shadow-card)] space-y-4">
          {/* Bloco essencial imediato logo abaixo da galeria: Nome, Preço, Disponibilidade e Stock */}
          <div className="space-y-1.5">
            <h1 className="font-display text-xl sm:text-2xl lg:text-3xl font-extrabold leading-snug text-[var(--text-primary)]">
              {product.name}
            </h1>

            <div className="flex flex-wrap items-center gap-2.5 pt-0.5">
              <span className="font-display text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)] tabular-nums">
                {formatKz(product.price)}
              </span>
              {discountPct !== null && typeof product.oldPrice === 'number' && (
                <>
                  <span className="font-display text-sm sm:text-base font-semibold text-[var(--text-secondary)] line-through tabular-nums">
                    {formatKz(product.oldPrice)}
                  </span>
                  <span className="rounded-md bg-[var(--brand-yellow)] px-2 py-0.5 font-display text-xs font-extrabold text-[var(--text-on-accent)] tabular-nums">
                    -{discountPct}%
                  </span>
                </>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-0.5 text-xs">
              <span
                className={
                  status === 'available'
                    ? 'font-semibold text-[var(--status-available)]'
                    : status === 'temporarily_unavailable'
                    ? 'font-semibold text-[var(--brand-orange-text)]'
                    : 'font-semibold text-[var(--status-error)]'
                }
              >
                {statusLabel}
              </span>

              {purchasable && product.manageStock !== false && typeof product.stock === 'number' && (
                <>
                  <span aria-hidden="true" className="text-[var(--text-secondary)]">·</span>
                  <span
                    className={`tabular-nums ${
                      isLowStock ? 'font-medium text-[var(--brand-orange-text)]' : 'text-[var(--text-secondary)]'
                    }`}
                  >
                    {isLowStock
                      ? `Últimas ${product.stock} un. em stock`
                      : `Stock disponível: ${product.stock} un.`}
                  </span>
                </>
              )}

              <span aria-hidden="true" className="text-[var(--text-secondary)]">·</span>
              <span className="text-[var(--text-secondary)]">{product.category}</span>

              {product.sku && (
                <>
                  <span aria-hidden="true" className="text-[var(--text-secondary)]">·</span>
                  <span className="text-[var(--text-secondary)] tabular-nums">SKU: {product.sku}</span>
                </>
              )}
            </div>
          </div>

          {/* Descrição */}
          {product.description && (
            <p className="border-t border-[var(--border-subtle)] pt-3.5 text-sm sm:text-base text-[var(--text-primary)] leading-relaxed whitespace-pre-line">
              {product.description}
            </p>
          )}

          {/* Seletor de quantidade + Botões de compra / aviso de loja encerrada */}
          {!isStoreActive ? (
            <div className="space-y-3 border-t border-[var(--border-subtle)] pt-4">
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-xl bg-[#FFFBEB] border border-[#F59E0B]/40 p-4 text-sm text-[var(--text-primary)]"
              >
                <Lock className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand-orange-text)]" aria-hidden="true" />
                <div>
                  <p className="font-display text-xs font-bold uppercase text-[var(--brand-orange-text)]">
                    Loja temporariamente encerrada
                  </p>
                  <p className="mt-1 text-xs sm:text-sm text-[var(--text-secondary)]">
                    {storeSettings.closedMessage}
                  </p>
                </div>
              </div>

              {whatsappProductHref && (
                <a
                  href={whatsappProductHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => {
                    trackMetaContact(product.name);
                  }}
                  className="inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl border border-[var(--border-input)] bg-[var(--bg-surface)] px-4 py-2.5 text-xs sm:text-sm font-medium text-[var(--text-primary)] hover:border-[var(--status-available)] hover:text-[var(--status-available)] transition-colors whitespace-nowrap"
                >
                  <MessageCircle className="h-4 w-4 text-[var(--status-available)]" />
                  <span>Falar no WhatsApp sobre este produto</span>
                </a>
              )}
            </div>
          ) : purchasable ? (
            <div className="space-y-3.5 border-t border-[var(--border-subtle)] pt-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <span className="text-sm font-medium text-[var(--text-primary)]">Quantidade pretendida</span>
                <div className="inline-flex items-center rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-input)]">
                  <button
                    type="button"
                    onClick={handleDecrease}
                    disabled={quantity <= 1}
                    aria-label="Diminuir quantidade"
                    className="inline-flex h-11 w-11 items-center justify-center text-[var(--text-primary)] disabled:opacity-40 hover:text-[var(--brand-orange-text)] cursor-pointer disabled:cursor-not-allowed"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span
                    aria-live="polite"
                    className="min-w-[44px] text-center font-display text-base font-bold text-[var(--text-primary)] tabular-nums"
                  >
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={handleIncrease}
                    disabled={quantity >= effectiveMaxSelectable || remainingAddable <= 0}
                    aria-label="Aumentar quantidade"
                    className="inline-flex h-11 w-11 items-center justify-center text-[var(--text-primary)] disabled:opacity-40 hover:text-[var(--brand-orange-text)] cursor-pointer disabled:cursor-not-allowed"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {qtyInCart > 0 && (
                <p className="text-xs text-[var(--text-secondary)] tabular-nums">
                  Já tens <strong className="font-semibold text-[var(--text-primary)]">{qtyInCart}</strong>{' '}
                  {qtyInCart === 1 ? 'unidade' : 'unidades'} deste artigo no carrinho.
                </p>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={handleAddToCart}
                  disabled={remainingAddable <= 0}
                  className={`group inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border px-4 py-3 font-display text-xs sm:text-sm font-extrabold uppercase tracking-wide whitespace-nowrap transition-colors ${
                    remainingAddable <= 0
                      ? 'border-[var(--border-subtle)] bg-[var(--bg-subtle)] text-[var(--text-secondary)] cursor-not-allowed'
                      : addedFeedback
                      ? 'border-[var(--status-available)] bg-[var(--status-available)] text-white cursor-pointer'
                      : 'border-2 border-[var(--brand-orange)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:bg-[var(--brand-orange)] hover:text-[var(--text-on-accent)] cursor-pointer'
                  }`}
                >
                  {remainingAddable <= 0 ? (
                    <span>Stock máx. no carrinho</span>
                  ) : addedFeedback ? (
                    <>
                      <Check className="h-4 w-4 shrink-0" />
                      <span>ADICIONADO</span>
                    </>
                  ) : (
                    <>
                      <ShoppingBag className="h-4 w-4 shrink-0 text-[var(--brand-orange-text)] group-hover:text-[var(--text-on-accent)] transition-colors" />
                      <span>ADICIONAR AO CARRINHO</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleBuyNow}
                  className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-bercali-gradient px-4 py-3 font-display text-xs sm:text-sm font-extrabold uppercase tracking-wide text-[var(--text-on-accent)] shadow-md transition-transform active:scale-[0.99] cursor-pointer whitespace-nowrap"
                >
                  <Zap className="h-4 w-4 shrink-0" />
                  <span>COMPRAR AGORA</span>
                </button>
              </div>

              {whatsappProductHref && (
                <a
                  href={whatsappProductHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => {
                    trackMetaContact(product.name);
                  }}
                  className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-[var(--border-input)] bg-[var(--bg-surface)] px-4 py-2.5 text-xs sm:text-sm font-medium text-[var(--text-primary)] hover:border-[var(--status-available)] hover:text-[var(--status-available)] transition-colors whitespace-nowrap"
                >
                  <MessageCircle className="h-4 w-4 text-[var(--status-available)]" />
                  <span>Perguntar sobre este produto no WhatsApp</span>
                </a>
              )}
            </div>
          ) : (
            <div className="space-y-3 border-t border-[var(--border-subtle)] pt-4">
              <div className="rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)] p-4 text-sm text-[var(--text-secondary)]">
                Este artigo encontra-se{' '}
                <strong className="font-semibold text-[var(--text-primary)]">{statusLabel.toLowerCase()}</strong> de momento e não
                pode ser adicionado ao carrinho.
              </div>
              {whatsappProductHref && (
                <a
                  href={whatsappProductHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => {
                    trackMetaContact(product.name);
                  }}
                  className="inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl border border-[var(--border-input)] bg-[var(--bg-surface)] px-4 py-2.5 text-xs sm:text-sm font-medium text-[var(--text-primary)] hover:border-[var(--status-available)] hover:text-[var(--status-available)] transition-colors whitespace-nowrap"
                >
                  <MessageCircle className="h-4 w-4 text-[var(--status-available)]" />
                  <span>Pedir informação de reposição no WhatsApp</span>
                </a>
              )}
            </div>
          )}

          {/* Características técnicas (se preenchidas) */}
          {product.features.length > 0 && (
            <div className="border-t border-[var(--border-subtle)] pt-4">
              <h2 className="font-display text-sm font-bold uppercase tracking-wider text-[var(--text-primary)]">
                Características técnicas
              </h2>
              <ul className="mt-3 space-y-2 text-sm text-[var(--text-secondary)]">
                {product.features.map((feat, idx) => (
                  <li key={`${product.id}-feat-${idx}`} className="flex items-start gap-2.5">
                    <span
                      aria-hidden="true"
                      className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--brand-orange)]"
                    />
                    <span>{feat.trim()}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Produtos relacionados */}
      {relatedProducts.length > 0 && (
        <section
          aria-labelledby="heading-related"
          className="mt-8 space-y-5 border-t border-[var(--border-subtle)] px-3.5 sm:px-6 lg:px-0 pt-6"
        >
          <div>
            <SpeedLinesDivider className="mb-2.5" />
            <h2 id="heading-related" className="font-display text-xl sm:text-2xl font-bold text-[var(--text-primary)]">
              Produtos relacionados
            </h2>
          </div>
          <ProductGrid products={relatedProducts} />
        </section>
      )}

      {/* Barra fixa no fundo (acima da navegação inferior no telemóvel) sempre visível ao fazer scroll */}
      <div
        aria-label="Barra rápida de compra"
        className="fixed left-0 right-0 bottom-[calc(60px+env(safe-area-inset-bottom,0px))] md:bottom-0 z-30 border-t border-[var(--border-subtle)] bg-[var(--bg-surface)]/95 backdrop-blur-md shadow-[0_-4px_16px_rgba(23,23,23,0.06)]"
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-3.5 sm:px-6 lg:px-8 py-2.5">
          <div className="min-w-0 flex flex-col">
            {discountPct !== null && typeof product.oldPrice === 'number' ? (
              <span className="font-display text-[11px] font-medium text-[var(--text-secondary)] line-through tabular-nums truncate">
                {formatKz(product.oldPrice)}
              </span>
            ) : (
              <span className="text-[11px] text-[var(--text-secondary)] leading-tight">Preço</span>
            )}
            <span className="font-display text-lg sm:text-xl font-extrabold text-[var(--text-primary)] leading-tight tabular-nums truncate">
              {formatKz(product.price)}
            </span>
          </div>

          <button
            type="button"
            onClick={handleAddToCart}
            disabled={!canOrderNow || remainingAddable <= 0}
            className={`inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-xl px-4 sm:px-6 py-2.5 font-display text-xs sm:text-sm font-extrabold uppercase tracking-wide whitespace-nowrap transition-all ${
              !canOrderNow || remainingAddable <= 0
                ? 'bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-secondary)] cursor-not-allowed'
                : addedFeedback
                ? 'bg-[var(--status-available)] text-white shadow-sm cursor-pointer'
                : 'bg-bercali-gradient text-[var(--text-on-accent)] shadow-sm shadow-[#FF8A00]/20 hover:brightness-105 active:scale-[0.98] cursor-pointer'
            }`}
          >
            {!isStoreActive ? (
              <span>Loja encerrada</span>
            ) : !purchasable ? (
              <span>{status === 'out_of_stock' ? 'Sem stock' : 'Indisponível'}</span>
            ) : remainingAddable <= 0 ? (
              <span>Stock máx. no carrinho</span>
            ) : addedFeedback ? (
              <>
                <Check className="h-4 w-4 shrink-0" />
                <span>Adicionado</span>
              </>
            ) : (
              <>
                <ShoppingBag className="h-4 w-4 shrink-0" />
                <span>Adicionar ao carrinho</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
