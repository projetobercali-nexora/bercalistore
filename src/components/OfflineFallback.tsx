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
      className="bg-[#1A1A1A] border-b border-[#FFC400]/40 px-4 py-2.5 text-xs text-white"
    >
      <div className="mx-auto flex max-w-7xl items-center gap-2.5">
        <WifiOff className="h-4 w-4 shrink-0 text-[#FFC400]" aria-hidden="true" />
        <p className="leading-snug">
          <strong className="text-[#FFC400]">Modo sem internet:</strong> Podes consultar o catálogo já carregado e guardar artigos no carrinho deste dispositivo, mas precisas de ligação à internet para enviar a encomenda pelo WhatsApp.
        </p>
      </div>
    </div>
  );
};
