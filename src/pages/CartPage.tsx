import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ImageOff, Lock, Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { SpeedLinesDivider } from '../components/SpeedLinesDivider';
import { useCart } from '../context/CartContext';
import { useCatalog } from '../context/CatalogContext';
import { getMaxAllowedQuantity } from '../utils/cart';
import { formatKz } from '../utils/format';

export const CartPage: React.FC = () => {
  const {
    lines,
    totalItemsCount,
    subtotalKz,
    storageAvailable,
    setItemQuantity,
    removeItem,
  } = useCart();
  const { isStoreActive, storeSettings } = useCatalog();

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-6">
      <div>
        <SpeedLinesDivider className="mb-2.5" />
        <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
          Carrinho de compras
        </h1>
        <p className="mt-1 text-sm text-[#8A8A8A]">
          Revê os artigos e quantidades antes de avançares para os dados de entrega.
        </p>
      </div>

      {!storageAvailable && (
        <div className="rounded-xl bg-[#1A1A1A] border border-[#FFC400]/40 p-4 text-xs text-[#8A8A8A]">
          <strong className="text-[#FFC400]">Aviso de armazenamento:</strong> O teu navegador não permite guardar o carrinho entre visitas. Os artigos permanecem ativos durante esta sessão.
        </div>
      )}

      {lines.length === 0 ? (
        <div className="rounded-xl bg-[#1A1A1A] border border-white/10 p-10 text-center space-y-4">
          <ShoppingBag className="mx-auto h-11 w-11 text-[#FF8A00]" aria-hidden="true" />
          <h2 className="font-display text-xl font-bold text-white">
            O teu carrinho está vazio
          </h2>
          <p className="mx-auto max-w-md text-sm text-[#8A8A8A]">
            Explora o catálogo da Bercali Store e adiciona os produtos que pretendes encomendar.
          </p>
          <Link
            to="/catalogo"
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-bercali-gradient px-6 py-3 font-display text-sm font-extrabold uppercase text-[#0A0A0A]"
          >
            <span>Explorar produtos</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Lista de artigos no carrinho */}
          <div className="lg:col-span-8 space-y-3.5">
            {lines.map((line) => {
              const maxQty = getMaxAllowedQuantity(line.product);
              const thumb = line.product.images[0] ?? null;

              return (
                <article
                  key={line.product.id}
                  className="flex flex-col sm:flex-row sm:items-center gap-4 rounded-xl bg-[#1A1A1A] border border-white/10 p-4"
                >
                  <div className="flex items-start gap-3.5 flex-1 min-w-0">
                    <Link
                      to={`/produto/${line.product.slug}`}
                      className="h-20 w-24 shrink-0 overflow-hidden rounded-lg bg-[#121212] border border-white/10 flex items-center justify-center"
                    >
                      {thumb ? (
                        <img
                          src={thumb}
                          alt={line.product.name}
                          width={160}
                          height={120}
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <ImageOff className="h-5 w-5 text-[#8A8A8A]" />
                      )}
                    </Link>

                    <div className="min-w-0 flex-1">
                      <Link
                        to={`/produto/${line.product.slug}`}
                        className="font-display text-sm sm:text-base font-bold text-white hover:text-[#FF8A00] transition-colors line-clamp-2"
                      >
                        {line.product.name}
                      </Link>
                      <p className="mt-1 text-xs text-[#8A8A8A] tabular-nums">
                        Preço unitário: <strong className="text-white">{formatKz(line.product.price)}</strong>
                      </p>
                      <p className="mt-1 font-display text-sm font-extrabold text-[#FFC400] tabular-nums">
                        Subtotal: {formatKz(line.lineSubtotal)}
                      </p>
                    </div>
                  </div>

                  {/* Controlos de quantidade e remoção */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 border-t sm:border-t-0 border-white/10 pt-3 sm:pt-0">
                    <div className="inline-flex items-center rounded-xl bg-[#0A0A0A] border border-white/15">
                      <button
                        type="button"
                        onClick={() => setItemQuantity(line.product, line.quantity - 1)}
                        disabled={line.quantity <= 1}
                        aria-label={`Diminuir quantidade de ${line.product.name}`}
                        className="inline-flex h-11 w-11 items-center justify-center text-white disabled:opacity-40 hover:text-[#FF8A00] cursor-pointer disabled:cursor-not-allowed"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span
                        aria-live="polite"
                        className="min-w-[38px] text-center font-display text-sm font-bold text-white tabular-nums"
                      >
                        {line.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => setItemQuantity(line.product, line.quantity + 1)}
                        disabled={line.quantity >= maxQty}
                        aria-label={`Aumentar quantidade de ${line.product.name}`}
                        className="inline-flex h-11 w-11 items-center justify-center text-white disabled:opacity-40 hover:text-[#FF8A00] cursor-pointer disabled:cursor-not-allowed"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeItem(line.product.id)}
                      aria-label={`Remover ${line.product.name} do carrinho`}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#0A0A0A] border border-white/15 text-[#8A8A8A] hover:border-[#EF4444] hover:text-[#EF4444] transition-colors cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>

          {/* Resumo lateral do carrinho */}
          <aside className="lg:col-span-4 rounded-xl bg-[#1A1A1A] border border-white/10 p-5 sm:p-6 space-y-4">
            <h2 className="font-display text-lg font-bold text-white">Resumo do carrinho</h2>

            <dl className="space-y-2.5 text-sm border-t border-white/10 pt-4">
              <div className="flex items-center justify-between">
                <dt className="text-[#8A8A8A]">Total de artigos</dt>
                <dd className="font-display font-bold text-white tabular-nums">
                  {totalItemsCount}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-[#8A8A8A]">Entrega</dt>
                <dd className="text-xs text-[#8A8A8A] text-right">
                  {storeSettings.freeDeliveryThresholdKz &&
                  subtotalKz >= storeSettings.freeDeliveryThresholdKz
                    ? 'Grátis (atingiu o valor mínimo)'
                    : 'Calculada / confirmada no passo seguinte'}
                </dd>
              </div>
              <div className="flex items-baseline justify-between border-t border-white/10 pt-3">
                <dt className="font-display text-base font-bold text-white">Subtotal</dt>
                <dd className="font-display text-xl font-extrabold text-[#FFC400] tabular-nums">
                  {formatKz(subtotalKz)}
                </dd>
              </div>
            </dl>

            {!isStoreActive && (
              <div
                role="status"
                className="rounded-xl bg-[#FFC400]/10 border border-[#FFC400]/35 p-3.5 text-xs text-white/90 leading-relaxed"
              >
                <p className="font-display font-bold text-[#FFC400] uppercase tracking-wide mb-1">
                  Loja temporariamente encerrada
                </p>
                <p>{storeSettings.closedMessage}</p>
              </div>
            )}

            <div className="space-y-2.5 pt-2">
              {isStoreActive ? (
                <Link
                  to="/finalizar"
                  className="flex min-h-[50px] w-full items-center justify-center gap-2 rounded-xl bg-bercali-gradient px-5 py-3 font-display text-sm font-extrabold uppercase text-[#0A0A0A] shadow-lg"
                >
                  <span>Finalizar pedido</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              ) : (
                <button
                  type="button"
                  disabled
                  className="flex min-h-[50px] w-full items-center justify-center gap-2 rounded-xl bg-white/10 border border-white/15 px-5 py-3 font-display text-sm font-bold uppercase text-[#8A8A8A] cursor-not-allowed"
                >
                  <Lock className="h-4 w-4" />
                  <span>Encomendas temporariamente suspensas</span>
                </button>
              )}

              <Link
                to="/catalogo"
                className="flex min-h-[46px] w-full items-center justify-center rounded-xl border border-[#FF8A00]/60 px-5 py-2.5 font-display text-xs font-bold uppercase text-white hover:border-[#FF8A00] hover:text-[#FF8A00] transition-colors"
              >
                Continuar a comprar
              </Link>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
};
