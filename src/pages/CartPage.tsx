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
        <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)]">
          Carrinho de compras
        </h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Revê os artigos e quantidades antes de avançares para os dados de entrega.
        </p>
      </div>

      {!storageAvailable && (
        <div className="rounded-xl bg-[#FFFBEB] border border-[#F59E0B]/40 p-4 text-xs text-[var(--text-primary)]">
          <strong className="text-[var(--brand-orange-text)]">Aviso de armazenamento:</strong> O teu navegador não permite guardar o carrinho entre visitas. Os artigos permanecem ativos durante esta sessão.
        </div>
      )}

      {lines.length === 0 ? (
        <div className="rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-[var(--shadow-card)] p-10 text-center space-y-4">
          <ShoppingBag className="mx-auto h-11 w-11 text-[var(--brand-orange-text)]" aria-hidden="true" />
          <h2 className="font-display text-xl font-bold text-[var(--text-primary)]">
            O teu carrinho está vazio
          </h2>
          <p className="mx-auto max-w-md text-sm text-[var(--text-secondary)]">
            Explora o catálogo da Bercali Store e adiciona os produtos que pretendes encomendar.
          </p>
          <Link
            to="/catalogo"
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-bercali-gradient px-6 py-3 font-display text-sm font-extrabold uppercase text-[var(--text-on-accent)] shadow-sm"
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
                  className="flex flex-col sm:flex-row sm:items-center gap-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-[var(--shadow-card)] p-4"
                >
                  <div className="flex items-start gap-3.5 flex-1 min-w-0">
                    <Link
                      to={`/produto/${line.product.slug}`}
                      className="h-20 w-24 shrink-0 overflow-hidden rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] p-1 flex items-center justify-center"
                    >
                      {thumb ? (
                        <img
                          src={thumb}
                          alt={line.product.name}
                          width={160}
                          height={120}
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <ImageOff className="h-5 w-5 text-[var(--text-secondary)]" />
                      )}
                    </Link>

                    <div className="min-w-0 flex-1">
                      <Link
                        to={`/produto/${line.product.slug}`}
                        className="font-display text-sm sm:text-base font-bold text-[var(--text-primary)] hover:text-[var(--brand-orange-text)] transition-colors line-clamp-2"
                      >
                        {line.product.name}
                      </Link>
                      <p className="mt-1 text-xs text-[var(--text-secondary)] tabular-nums">
                        Preço unitário: <strong className="font-semibold text-[var(--text-primary)]">{formatKz(line.product.price)}</strong>
                      </p>
                      <p className="mt-1 font-display text-sm font-extrabold text-[var(--text-primary)] tabular-nums">
                        Subtotal: {formatKz(line.lineSubtotal)}
                      </p>
                    </div>
                  </div>

                  {/* Controlos de quantidade e remoção */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 border-t sm:border-t-0 border-[var(--border-subtle)] pt-3 sm:pt-0">
                    <div className="inline-flex items-center rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-input)]">
                      <button
                        type="button"
                        onClick={() => setItemQuantity(line.product, line.quantity - 1)}
                        disabled={line.quantity <= 1}
                        aria-label={`Diminuir quantidade de ${line.product.name}`}
                        className="inline-flex h-11 w-11 items-center justify-center text-[var(--text-primary)] disabled:opacity-40 hover:text-[var(--brand-orange-text)] cursor-pointer disabled:cursor-not-allowed"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span
                        aria-live="polite"
                        className="min-w-[38px] text-center font-display text-sm font-bold text-[var(--text-primary)] tabular-nums"
                      >
                        {line.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => setItemQuantity(line.product, line.quantity + 1)}
                        disabled={line.quantity >= maxQty}
                        aria-label={`Aumentar quantidade de ${line.product.name}`}
                        className="inline-flex h-11 w-11 items-center justify-center text-[var(--text-primary)] disabled:opacity-40 hover:text-[var(--brand-orange-text)] cursor-pointer disabled:cursor-not-allowed"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeItem(line.product.id)}
                      aria-label={`Remover ${line.product.name} do carrinho`}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-input)] text-[var(--text-secondary)] hover:border-[var(--status-error)] hover:text-[var(--status-error)] transition-colors cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>

          {/* Resumo lateral do carrinho */}
          <aside className="lg:col-span-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-[var(--shadow-card)] p-5 sm:p-6 space-y-4">
            <h2 className="font-display text-lg font-bold text-[var(--text-primary)]">Resumo do carrinho</h2>

            <dl className="space-y-2.5 text-sm border-t border-[var(--border-subtle)] pt-4">
              <div className="flex items-center justify-between">
                <dt className="text-[var(--text-secondary)]">Total de artigos</dt>
                <dd className="font-display font-bold text-[var(--text-primary)] tabular-nums">
                  {totalItemsCount}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-[var(--text-secondary)]">Entrega</dt>
                <dd className="text-xs text-[var(--text-secondary)] text-right">
                  {storeSettings.freeDeliveryThresholdKz &&
                  subtotalKz >= storeSettings.freeDeliveryThresholdKz
                    ? 'Grátis (atingiu o valor mínimo)'
                    : 'Calculada / confirmada no passo seguinte'}
                </dd>
              </div>
              <div className="flex items-baseline justify-between border-t border-[var(--border-subtle)] pt-3">
                <dt className="font-display text-base font-bold text-[var(--text-primary)]">Subtotal</dt>
                <dd className="font-display text-xl font-extrabold text-[var(--text-primary)] tabular-nums">
                  {formatKz(subtotalKz)}
                </dd>
              </div>
            </dl>

            {!isStoreActive && (
              <div
                role="status"
                className="rounded-xl bg-[#FFFBEB] border border-[#F59E0B]/40 p-3.5 text-xs text-[var(--text-primary)] leading-relaxed"
              >
                <p className="font-display font-bold text-[var(--brand-orange-text)] uppercase tracking-wide mb-1">
                  Loja temporariamente encerrada
                </p>
                <p className="text-[var(--text-secondary)]">{storeSettings.closedMessage}</p>
              </div>
            )}

            <div className="space-y-2.5 pt-2">
              {isStoreActive ? (
                <Link
                  to="/finalizar"
                  className="flex min-h-[50px] w-full items-center justify-center gap-2 rounded-xl bg-bercali-gradient px-5 py-3 font-display text-sm font-extrabold uppercase text-[var(--text-on-accent)] shadow-md"
                >
                  <span>Finalizar pedido</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              ) : (
                <button
                  type="button"
                  disabled
                  className="flex min-h-[50px] w-full items-center justify-center gap-2 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)] px-5 py-3 font-display text-sm font-bold uppercase text-[var(--text-secondary)] cursor-not-allowed"
                >
                  <Lock className="h-4 w-4" />
                  <span>Encomendas temporariamente suspensas</span>
                </button>
              )}

              <Link
                to="/catalogo"
                className="flex min-h-[46px] w-full items-center justify-center rounded-xl border border-[var(--border-input)] bg-[var(--bg-subtle)] px-5 py-2.5 font-display text-xs font-bold uppercase text-[var(--text-primary)] hover:border-[var(--brand-orange)] hover:text-[var(--brand-orange-text)] transition-colors"
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
