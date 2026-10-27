import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Lock, X } from 'lucide-react';
import { useCatalog } from '../context/CatalogContext';

export const StoreStatusBanner: React.FC = () => {
  const { isStoreActive, storeSettings } = useCatalog();
  const [dismissedPromoText, setDismissedPromoText] = useState<string | null>(null);

  useEffect(() => {
    setDismissedPromoText(null);
  }, [storeSettings.promoBanner?.text]);

  if (!isStoreActive) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="w-full border-b border-[#FFC400]/40 bg-[#1A1A1A] px-4 py-3"
      >
        <div className="mx-auto flex max-w-7xl flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs sm:text-sm">
          <div className="flex items-start sm:items-center gap-2.5">
            <Lock className="mt-0.5 sm:mt-0 h-4 w-4 shrink-0 text-[#FFC400]" aria-hidden="true" />
            <p className="text-white/95 leading-snug">
              <strong className="font-display font-bold uppercase text-[#FFC400]">
                Loja temporariamente encerrada:
              </strong>{' '}
              {storeSettings.closedMessage}
            </p>
          </div>
          <span className="text-xs text-[#8A8A8A] shrink-0">
            Novas encomendas temporariamente suspensas
          </span>
        </div>
      </div>
    );
  }

  const promo = storeSettings.promoBanner;
  if (!promo || !promo.text.trim() || dismissedPromoText === promo.text) {
    return null;
  }

  const isInternalLink = Boolean(promo.linkUrl && promo.linkUrl.startsWith('/'));

  return (
    <div className="w-full border-b border-[#FF8A00]/30 bg-[#141414] px-4">
      <div className="mx-auto flex min-h-[38px] max-w-7xl items-center justify-between gap-3 py-1.5 text-xs text-white/90">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 min-w-0">
          <span className="truncate">{promo.text}</span>
          {promo.linkUrl &&
            (isInternalLink ? (
              <Link
                to={promo.linkUrl}
                className="font-display font-bold uppercase text-[#FF8A00] hover:underline whitespace-nowrap shrink-0"
              >
                {promo.linkLabel || 'Ver mais'}
              </Link>
            ) : (
              <a
                href={promo.linkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-display font-bold uppercase text-[#FF8A00] hover:underline whitespace-nowrap shrink-0"
              >
                {promo.linkLabel || 'Ver mais'}
              </a>
            ))}
        </div>
        <button
          type="button"
          onClick={() => setDismissedPromoText(promo.text)}
          aria-label="Fechar aviso promocional"
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[#8A8A8A] hover:text-white cursor-pointer"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};
