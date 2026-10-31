import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { CheckCircle2, X } from 'lucide-react';
import { useCart } from '../context/CartContext';

export const CartToast: React.FC = () => {
  const { feedback, dismissFeedback } = useCart();
  const location = useLocation();

  if (!feedback) return null;

  const isProductDetail = location.pathname.startsWith('/produto/');

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed ${
        isProductDetail
          ? 'bottom-[calc(136px+env(safe-area-inset-bottom,0px))] md:bottom-24'
          : 'bottom-[calc(72px+env(safe-area-inset-bottom,0px))] md:bottom-6'
      } right-4 left-4 max-w-sm mx-auto sm:mx-0 sm:left-auto sm:w-96 z-40 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-3.5 shadow-[var(--shadow-elevated)]`}
    >
      <div className="flex items-start gap-3">
        <CheckCircle2 className="h-5 w-5 shrink-0 text-[var(--status-available)] mt-0.5" aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <p className="font-display text-xs font-bold uppercase tracking-wide text-[var(--status-available)]">
            Adicionado ao carrinho
          </p>
          <p className="mt-0.5 text-sm font-medium text-[var(--text-primary)] truncate">{feedback.productName}</p>
          <div className="mt-2 flex items-center gap-3">
            <Link
              to="/carrinho"
              onClick={dismissFeedback}
              className="font-display text-xs font-bold uppercase text-[var(--brand-orange-text)] hover:underline"
            >
              Ver carrinho
            </Link>
            <Link
              to="/finalizar"
              onClick={dismissFeedback}
              className="font-display text-xs font-bold uppercase text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              Finalizar pedido
            </Link>
          </div>
        </div>
        <button
          type="button"
          onClick={dismissFeedback}
          aria-label="Fechar aviso do carrinho"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
