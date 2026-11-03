import React, { useEffect, useRef, useState } from 'react';
import { Check, Download, Loader2 } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { getUnavailableInstallMessage } from '../utils/pwa';

interface PWAInstallActionProps {
  pathname: string;
  variant?: 'page' | 'drawer';
}

export const PWAInstallAction: React.FC<PWAInstallActionProps> = ({
  pathname,
  variant = 'page',
}) => {
  const {
    isInstalled,
    isInstallableNatively,
    isPrompting,
    environment,
    lastOutcome,
    triggerNativeInstall,
  } = usePWAInstall(pathname);

  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const statusRef = useRef<HTMLParagraphElement | null>(null);

  useEffect(() => {
    setStatusMessage(null);
  }, [pathname]);

  useEffect(() => {
    if (isInstallableNatively || isInstalled) {
      setStatusMessage(null);
    }
  }, [isInstallableNatively, isInstalled]);

  useEffect(() => {
    if (!statusMessage || variant !== 'page' || typeof window === 'undefined') {
      return;
    }
    const el = statusRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const safeVisibleBottom = window.innerHeight - 76;
    if (rect.bottom > safeVisibleBottom) {
      window.scrollBy({
        top: rect.bottom - safeVisibleBottom + 12,
        behavior: 'smooth',
      });
    }
  }, [statusMessage, variant]);

  // Quando a aplicação já está instalada, não apresenta convites de instalação.
  // Apenas se acabou de ser instalada nesta sessão mostra confirmação discreta e proporcional.
  if (isInstalled) {
    if (lastOutcome === 'accepted') {
      return (
        <p
          role="status"
          aria-live="polite"
          className={`inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3.5 py-2 text-xs font-medium text-[var(--text-secondary)] ${
            variant === 'drawer' ? 'w-full justify-center' : ''
          }`}
        >
          <Check className="h-4 w-4 shrink-0 text-[var(--text-primary)]" aria-hidden="true" />
          <span>Aplicação instalada neste dispositivo.</span>
        </p>
      );
    }
    return null;
  }

  const isUnavailableConfirmed = !isInstallableNatively && Boolean(statusMessage);
  const isButtonDisabled = isPrompting || isUnavailableConfirmed;

  const handleClick = async () => {
    if (isButtonDisabled) {
      return;
    }

    if (environment.isIOS || !isInstallableNatively) {
      setStatusMessage(getUnavailableInstallMessage(environment));
      return;
    }

    setStatusMessage(null);
    const outcome = await triggerNativeInstall();

    if (outcome === 'unavailable' || outcome === 'failed') {
      setStatusMessage(getUnavailableInstallMessage(environment));
    }
  };

  const baseSizeClass =
    variant === 'drawer'
      ? 'flex min-h-[46px] w-full items-center justify-center gap-2 rounded-lg px-4 font-display text-xs font-bold uppercase'
      : 'inline-flex min-h-[46px] items-center justify-center gap-2 rounded-xl px-4 py-2.5 font-display text-xs sm:text-sm font-bold uppercase whitespace-nowrap';

  const interactiveStateClass = isPrompting
    ? 'border border-[var(--border-input)] bg-[var(--bg-subtle)] text-[var(--text-primary)] opacity-70 cursor-wait'
    : isUnavailableConfirmed
    ? 'border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/60 text-[var(--text-secondary)] opacity-60 cursor-not-allowed'
    : isInstallableNatively
    ? 'border border-[var(--border-input)] bg-[var(--bg-subtle)] text-[var(--text-primary)] hover:border-[var(--brand-orange)] hover:text-[var(--brand-orange-text)] transition-colors cursor-pointer'
    : 'border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/80 text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] transition-colors cursor-pointer';

  return (
    <div className={variant === 'drawer' ? 'w-full space-y-2' : 'inline-flex flex-col items-start gap-2'}>
      <button
        type="button"
        disabled={isButtonDisabled}
        onClick={() => void handleClick()}
        className={`${baseSizeClass} ${interactiveStateClass}`}
      >
        {isPrompting ? (
          <>
            <Loader2
              className="h-4 w-4 shrink-0 animate-spin text-[var(--brand-orange-text)]"
              aria-hidden="true"
            />
            <span>A instalar...</span>
          </>
        ) : (
          <>
            <Download
              className={`h-4 w-4 shrink-0 ${
                isInstallableNatively
                  ? 'text-[var(--brand-orange-text)]'
                  : 'text-[var(--text-secondary)]'
              }`}
              aria-hidden="true"
            />
            <span>Instalar App</span>
          </>
        )}
      </button>

      {statusMessage && (
        <p
          ref={statusRef}
          role="status"
          aria-live="polite"
          className={`text-xs text-[var(--text-secondary)] leading-relaxed ${
            variant === 'drawer' ? 'text-center px-1' : 'max-w-sm'
          }`}
        >
          {statusMessage}
        </p>
      )}
    </div>
  );
};
