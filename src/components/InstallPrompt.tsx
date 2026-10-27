import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Download, X } from 'lucide-react';
import { STORE_CONFIG } from '../config/store';
import { useCatalog } from '../context/CatalogContext';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { BrandLogo } from './BrandLogo';
import { PWAInstallModal } from './PWAInstallModal';

export const InstallPrompt: React.FC = () => {
  const location = useLocation();
  const { storeSettings } = useCatalog();
  const {
    isInstalled,
    isInstallableNatively,
    isPrompting,
    environment,
    shouldShowTimedInvite,
    triggerNativeInstall,
    dismissPrompt,
  } = usePWAInstall(location.pathname);

  const [showInstructions, setShowInstructions] = useState(false);

  if (isInstalled) {
    return null;
  }

  const brandName = storeSettings.brandName || STORE_CONFIG.brandName;

  const handleInstallAction = async () => {
    if (isPrompting) return;
    if (isInstallableNatively) {
      const outcome = await triggerNativeInstall();
      if (outcome === 'unavailable' || outcome === 'failed') {
        setShowInstructions(true);
      }
      return;
    }
    setShowInstructions(true);
  };

  return (
    <>
      {shouldShowTimedInvite && !showInstructions && (
        <aside
          aria-label={`Convite para instalar a aplicação ${brandName}`}
          className="fixed bottom-20 md:bottom-6 left-4 right-4 sm:left-6 sm:right-auto sm:max-w-sm z-40 rounded-xl bg-[#1A1A1A] border border-white/15 p-4 shadow-2xl"
        >
          <div className="flex items-start gap-3">
            <BrandLogo size="compact" />
            <div className="flex-1 min-w-0">
              <p className="font-display text-sm font-bold text-white">
                Adiciona a {brandName} ao teu ecrã
              </p>
              <p className="mt-1 text-xs text-[#8A8A8A] leading-relaxed">
                Acede mais depressa ao catálogo sempre que precisares, como uma aplicação.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  disabled={isPrompting}
                  onClick={() => void handleInstallAction()}
                  className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg bg-[#FF8A00] px-3.5 py-2 font-display text-xs font-bold uppercase text-[#0A0A0A] hover:bg-[#FFC400] transition-colors cursor-pointer disabled:opacity-60"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Instalar</span>
                </button>
                <button
                  type="button"
                  onClick={dismissPrompt}
                  className="inline-flex min-h-[40px] items-center justify-center rounded-lg px-3 py-2 text-xs font-medium text-[#8A8A8A] hover:text-white transition-colors cursor-pointer"
                >
                  Agora não
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={dismissPrompt}
              aria-label="Dispensar convite de instalação"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#8A8A8A] hover:bg-white/10 hover:text-white cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </aside>
      )}

      <PWAInstallModal
        open={showInstructions}
        brandName={brandName}
        environment={environment}
        onClose={() => {
          setShowInstructions(false);
          dismissPrompt();
        }}
      />
    </>
  );
};
