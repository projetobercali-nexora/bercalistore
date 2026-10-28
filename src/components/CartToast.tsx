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
        isProductDetail ? 'bottom-[132px] md:bottom-20' : 'bottom-20 md:bottom-6'
      } right-4 left-4 sm:left-auto sm:w-96 z-40 rounded-xl bg-[#1A1A1A] border border-[#22C55E]/50 p-3.5 shadow-2xl`}
    >
      <div className="flex items-start gap-3">
        <CheckCircle2 className="h-5 w-5 shrink-0 text-[#22C55E] mt-0.5" aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <p className="font-display text-xs font-bold uppercase tracking-wide text-[#22C55E]">
            Adicionado ao carrinho
          </p>
          <p className="mt-0.5 text-sm text-white truncate">{feedback.productName}</p>
          <div className="mt-2 flex items-center gap-3">
            <Link
              to="/carrinho"
              onClick={dismissFeedback}
              className="font-display text-xs font-bold uppercase text-[#FF8A00] hover:underline"
            >
              Ver carrinho
            </Link>
            <Link
              to="/finalizar"
              onClick={dismissFeedback}
              className="font-display text-xs font-bold uppercase text-white/80 hover:text-white"
            >
              Finalizar pedido
            </Link>
          </div>
        </div>
        <button
          type="button"
          onClick={dismissFeedback}
          aria-label="Fechar aviso do carrinho"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#8A8A8A] hover:text-white cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
