import React from 'react';
import { useLocation } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const InstallPrompt: React.FC = () => {
  const location = useLocation();
  const { updateAvailable, isCheckoutRoute, applyUpdate } = usePWAInstall(location.pathname);

  if (!updateAvailable || isCheckoutRoute) {
    return null;
  }

  const isProductDetail = location.pathname.startsWith('/produto/');
  const floatingBottomClass = isProductDetail
    ? 'bottom-[calc(136px+env(safe-area-inset-bottom,0px))] md:bottom-24'
    : 'bottom-[calc(72px+env(safe-area-inset-bottom,0px))] md:bottom-6';

  return (
    <aside
      role="status"
      aria-live="polite"
      aria-label="Nova versão disponível"
      className={`fixed ${floatingBottomClass} left-4 right-4 max-w-sm mx-auto sm:mx-0 sm:left-6 sm:right-auto z-40 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-4 shadow-[var(--shadow-elevated)]`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-sm font-bold text-[var(--text-primary)]">
            Nova versão disponível
          </p>
          <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
            Atualiza para veres as melhorias mais recentes da loja.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void applyUpdate()}
          className="inline-flex min-h-[40px] shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[var(--brand-orange)] px-3.5 py-2 font-display text-xs font-bold uppercase text-[var(--text-on-accent)] hover:bg-[var(--brand-yellow)] transition-colors cursor-pointer"
        >
          <RefreshCw className="h-3.5 w-3.5 shrink-0" />
          <span>Atualizar</span>
        </button>
      </div>
    </aside>
  );
};
