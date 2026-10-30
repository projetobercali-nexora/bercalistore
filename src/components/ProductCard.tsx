import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ImageOff, ShoppingBag } from 'lucide-react';
import { useCartActions, useProductCartQuantity } from '../context/CartContext';
import { useCatalog } from '../context/CatalogContext';
import type { Product } from '../types/store';
import { getMaxAllowedQuantity } from '../utils/cart';
import {
  calculateDiscountPercent,
  formatKz,
  getAvailabilityLabel,
  getProductAvailability,
  isProductPurchasable,
} from '../utils/format';

interface ProductCardProps {
  product: Product;
  priority?: boolean;
}

export const ProductCard: React.FC<ProductCardProps> = React.memo(({ product, priority = false }) => {
  const { addItem } = useCartActions();
  const qtyInCart = useProductCartQuantity(product.id);
  const { isStoreActive } = useCatalog();
  const [imageError, setImageError] = useState(false);
  const [justAdded, setJustAdded] = useState(false);

  const status = getProductAvailability(product);
  const statusLabel = getAvailabilityLabel(status);
  const purchasable = isProductPurchasable(product);
  const canAddNow = isStoreActive && purchasable;
  const discountPct = calculateDiscountPercent(product.price, product.oldPrice);
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
    <article className="group flex flex-col overflow-hidden rounded-xl bg-[#1A1A1A] border border-white/10 transition-transform duration-150 hover:-translate-y-0.5 hover:border-white/20">
      {/* Fotografia principal / espaço reservado discreto */}
      <Link
        to={`/produto/${product.slug}`}
        aria-label={`Ver detalhes de ${product.name}`}
        className="relative block aspect-[4/3] w-full overflow-hidden bg-[#121212]"
      >
        {mainImage ? (
          <img
            src={mainImage}
            alt={product.name}
            width={800}
            height={600}
            loading={priority ? 'eager' : 'lazy'}
            fetchPriority={priority ? 'high' : 'auto'}
            decoding="async"
            referrerPolicy="no-referrer"
            onError={() => setImageError(true)}
            className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center bg-[#121212]">
            <ImageOff className="h-7 w-7 text-[#8A8A8A]" aria-hidden="true" />
            <span className="text-xs font-medium text-[#8A8A8A]">
              Fotografia ainda não adicionada
            </span>
          </div>
        )}

        {discountPct !== null && (
          <span className="absolute top-2.5 left-2.5 rounded-md bg-[#FFC400] px-2 py-0.5 font-display text-[11px] font-extrabold text-[#0A0A0A] tabular-nums">
            -{discountPct}%
          </span>
        )}
      </Link>

      {/* Corpo do cartão */}
      <div className="flex flex-1 flex-col p-3.5 sm:p-4">
        {/* Metadados limpos sem cápsulas estáticas */}
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs">
          <span className="text-[#8A8A8A] truncate max-w-[140px]">{product.category}</span>
          <span aria-hidden="true" className="text-[#8A8A8A]">·</span>
          <span
            className={
              status === 'available'
                ? 'font-medium text-[#22C55E]'
                : status === 'temporarily_unavailable'
                ? 'font-medium text-[#FFC400]'
                : 'font-medium text-[#EF4444]'
            }
          >
            {statusLabel}
          </span>
        </div>

        {/* Nome do produto */}
        <h3 className="mt-1.5 font-display text-sm sm:text-base font-bold leading-snug text-white line-clamp-2">
          <Link to={`/produto/${product.slug}`} className="hover:text-[#FF8A00] transition-colors">
            {product.name}
          </Link>
        </h3>

        {/* Preço em Kz (âmbar conforme Manual de Marca p. 14) */}
        <div className="mt-auto pt-3 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="font-display text-base sm:text-lg font-extrabold text-[#FFC400] tabular-nums">
            {formatKz(product.price)}
          </span>
          {discountPct !== null && typeof product.oldPrice === 'number' && (
            <span className="font-display text-xs font-semibold text-[#8A8A8A] line-through tabular-nums">
              {formatKz(product.oldPrice)}
            </span>
          )}
        </div>

        {/* Ações: Adicionar ao carrinho + Ver detalhes */}
        <div className="mt-3 flex flex-col gap-2">
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
            className={`inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 font-display text-xs font-bold uppercase tracking-wide whitespace-nowrap transition-colors ${
              !canAddNow || stockLimitReached
                ? 'bg-white/8 text-[#8A8A8A] cursor-not-allowed'
                : justAdded
                ? 'bg-[#22C55E] text-[#0A0A0A] cursor-pointer'
                : 'bg-[#FF8A00] text-[#0A0A0A] hover:bg-[#FFC400] cursor-pointer'
            }`}
          >
            {!isStoreActive ? (
              <span>Loja encerrada</span>
            ) : !purchasable ? (
              <span>{status === 'out_of_stock' ? 'Esgotado' : 'Indisponível'}</span>
            ) : stockLimitReached ? (
              <span>Máx. no carrinho</span>
            ) : justAdded ? (
              <>
                <Check className="h-4 w-4 shrink-0" />
                <span>Adicionado</span>
              </>
            ) : (
              <>
                <ShoppingBag className="h-4 w-4 shrink-0" />
                <span>Adicionar</span>
              </>
            )}
          </button>

          <Link
            to={`/produto/${product.slug}`}
            className="inline-flex min-h-[42px] w-full items-center justify-center rounded-lg border border-[#FF8A00]/60 px-3 py-2 font-display text-xs font-bold uppercase tracking-wide text-white hover:border-[#FF8A00] hover:text-[#FF8A00] transition-colors whitespace-nowrap"
          >
            Ver detalhes
          </Link>
        </div>
      </div>
    </article>
  );
});
