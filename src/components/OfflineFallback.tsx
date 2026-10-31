import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineFallback: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="assertive"
      className="bg-[#FFFBEB] border-b border-[#F59E0B]/35 px-4 py-2.5 text-xs text-[var(--text-primary)]"
    >
      <div className="mx-auto flex max-w-7xl items-center gap-2.5">
        <WifiOff className="h-4 w-4 shrink-0 text-[var(--brand-orange-text)]" aria-hidden="true" />
        <p className="leading-snug">
          <strong className="text-[var(--brand-orange-text)]">Modo sem internet:</strong> Podes consultar o catálogo já carregado e guardar artigos no carrinho deste dispositivo, mas precisas de ligação à internet para enviar a encomenda pelo WhatsApp.
        </p>
      </div>
    </div>
  );
};
