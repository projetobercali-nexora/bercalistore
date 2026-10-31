import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useCatalog } from '../context/CatalogContext';
import {
  readStoredCookieConsent,
  shouldShowCookieConsentBanner,
  syncMetaPixelRuntime,
  trackMetaPageView,
  writeStoredCookieConsent,
  type CookieConsentStatus,
} from '../utils/metaPixel';

export const CookieConsentBanner: React.FC = () => {
  const { marketingSettings } = useCatalog();
  const location = useLocation();
  const [consent, setConsent] = useState<CookieConsentStatus>(() => readStoredCookieConsent());
  const lastTrackedRouteRef = useRef<string | null>(null);

  const routeKey = `${location.pathname}${location.search}`;

  useEffect(() => {
    const pixelReady = syncMetaPixelRuntime(marketingSettings, consent);
    if (!pixelReady) {
      lastTrackedRouteRef.current = null;
      return;
    }

    if (lastTrackedRouteRef.current !== routeKey) {
      if (trackMetaPageView()) {
        lastTrackedRouteRef.current = routeKey;
      }
    }
  }, [marketingSettings, consent, routeKey]);

  const handleChoice = (choice: 'accepted' | 'declined') => {
    writeStoredCookieConsent(choice);
    setConsent(choice);
  };

  if (!shouldShowCookieConsentBanner(marketingSettings, consent)) {
    return null;
  }

  return (
    <section
      role="region"
      aria-label="Preferências de cookies"
      className="fixed inset-x-3 bottom-[calc(68px+env(safe-area-inset-bottom,0px))] md:inset-x-auto md:right-5 md:bottom-5 md:max-w-md z-40 rounded-2xl bg-[var(--bg-surface)]/95 backdrop-blur-md border border-[var(--border-subtle)] p-3.5 sm:p-4 shadow-[var(--shadow-elevated)]"
    >
      <div className="flex flex-col gap-3">
        <p className="text-xs text-[var(--text-primary)] leading-relaxed">
          Usamos cookies de medição para melhorar a tua experiência na loja. Podes aceitar ou
          recusar a qualquer momento.{' '}
          <Link to="/privacidade" className="text-[var(--brand-orange-text)] hover:underline font-medium">
            Saber mais
          </Link>
        </p>

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => handleChoice('declined')}
            className="inline-flex min-h-[38px] items-center justify-center rounded-xl border border-[var(--border-input)] bg-[var(--bg-subtle)] px-3.5 py-1.5 font-display text-xs font-bold text-[var(--text-primary)] hover:border-[var(--brand-orange)] hover:text-[var(--brand-orange-text)] transition-colors cursor-pointer"
          >
            Recusar
          </button>
          <button
            type="button"
            onClick={() => handleChoice('accepted')}
            className="inline-flex min-h-[38px] items-center justify-center rounded-xl bg-bercali-gradient px-4 py-1.5 font-display text-xs font-extrabold text-[var(--text-on-accent)] shadow-sm transition-transform active:scale-95 cursor-pointer"
          >
            Aceitar
          </button>
        </div>
      </div>
    </section>
  );
};
