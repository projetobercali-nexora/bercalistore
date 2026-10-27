import React, { useEffect, useState } from 'react';
import { AlertCircle, MoreVertical, Share, Smartphone, X } from 'lucide-react';
import {
  getAndroidInstallGuide,
  getIOSInstallGuide,
  getManualInstallGuide,
  type InstallEnvironmentInfo,
  type ManualInstallGuide,
} from '../utils/pwa';
import { BrandLogo } from './BrandLogo';

interface PWAInstallModalProps {
  open: boolean;
  brandName: string;
  environment: InstallEnvironmentInfo;
  onClose: () => void;
}

type GuideTabKey = 'current' | 'android' | 'ios';

export const PWAInstallModal: React.FC<PWAInstallModalProps> = ({
  open,
  brandName,
  environment,
  onClose,
}) => {
  const defaultTab: GuideTabKey = environment.isInAppBrowser
    ? 'current'
    : environment.isIOS
    ? 'ios'
    : environment.isAndroid
    ? 'android'
    : 'current';

  const [selectedTab, setSelectedTab] = useState<GuideTabKey>(defaultTab);

  useEffect(() => {
    if (open) {
      setSelectedTab(defaultTab);
    }
  }, [open, defaultTab]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  const currentGuide = getManualInstallGuide(environment, brandName);
  const androidGuide = getAndroidInstallGuide(brandName, environment);
  const iosGuide = getIOSInstallGuide(brandName, environment);

  const activeGuide: ManualInstallGuide =
    selectedTab === 'android'
      ? androidGuide
      : selectedTab === 'ios'
      ? iosGuide
      : currentGuide;

  const showCurrentTab = !environment.isAndroid && !environment.isIOS
    ? true
    : environment.isInAppBrowser;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pwa-install-modal-title"
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-3 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-[#1A1A1A] border border-white/15 p-5 sm:p-6 shadow-2xl space-y-4 my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <BrandLogo size="compact" />
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wider text-[#FF8A00]">
                {activeGuide.deviceLabel}
              </p>
              <h3
                id="pwa-install-modal-title"
                className="font-display text-base sm:text-lg font-bold text-white leading-snug"
              >
                {activeGuide.title}
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar instruções de instalação"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[#8A8A8A] hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Seletor de instruções por sistema para Android e iPhone/Safari */}
        <div
          role="tablist"
          aria-label="Escolher tipo de dispositivo"
          className="flex flex-wrap gap-1.5 rounded-xl bg-[#0A0A0A] border border-white/10 p-1"
        >
          {showCurrentTab && (
            <button
              type="button"
              role="tab"
              aria-selected={selectedTab === 'current'}
              onClick={() => setSelectedTab('current')}
              className={`min-h-[38px] flex-1 rounded-lg px-2.5 py-1.5 text-xs cursor-pointer ${
                selectedTab === 'current'
                  ? 'bg-[#FF8A00] font-display font-bold text-[#0A0A0A] shadow-sm'
                  : 'bg-transparent font-medium text-[#8A8A8A] hover:text-white'
              }`}
            >
              Este dispositivo
            </button>
          )}
          <button
            type="button"
            role="tab"
            aria-selected={selectedTab === 'android'}
            onClick={() => setSelectedTab('android')}
            className={`min-h-[38px] flex-1 rounded-lg px-2.5 py-1.5 text-xs cursor-pointer ${
              selectedTab === 'android'
                ? 'bg-[#FF8A00] font-display font-bold text-[#0A0A0A] shadow-sm'
                : 'bg-transparent font-medium text-[#8A8A8A] hover:text-white'
            }`}
          >
            Android
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={selectedTab === 'ios'}
            onClick={() => setSelectedTab('ios')}
            className={`min-h-[38px] flex-1 rounded-lg px-2.5 py-1.5 text-xs cursor-pointer ${
              selectedTab === 'ios'
                ? 'bg-[#FF8A00] font-display font-bold text-[#0A0A0A] shadow-sm'
                : 'bg-transparent font-medium text-[#8A8A8A] hover:text-white'
            }`}
          >
            iPhone / Safari
          </button>
        </div>

        {activeGuide.contextNotice && (
          <div className="flex items-start gap-2.5 rounded-xl bg-[#0A0A0A] border border-[#FFC400]/35 p-3 text-xs text-white/90 leading-relaxed">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#FFC400]" aria-hidden="true" />
            <span>{activeGuide.contextNotice}</span>
          </div>
        )}

        <p className="text-sm text-[#8A8A8A] leading-relaxed">{activeGuide.description}</p>

        <ol className="space-y-2.5">
          {activeGuide.steps.map((step, index) => (
            <li
              key={`install-step-${selectedTab}-${index}`}
              className="flex items-start gap-3 rounded-xl bg-[#0A0A0A] border border-white/10 p-3 text-xs sm:text-sm text-white/90 leading-relaxed"
            >
              <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#FF8A00]/20 border border-[#FF8A00]/40 font-display text-xs font-bold text-[#FF8A00]">
                {index + 1}
              </span>
              <span className="flex-1 min-w-0">{step}</span>
            </li>
          ))}
        </ol>

        {selectedTab === 'ios' && (
          <div className="flex items-center gap-2 text-xs text-[#8A8A8A]">
            <Share className="h-3.5 w-3.5 shrink-0 text-[#FF8A00]" aria-hidden="true" />
            <span>Ícone Partilhar na barra do Safari e depois «Adicionar ao ecrã principal».</span>
          </div>
        )}

        {selectedTab === 'android' && (
          <div className="flex items-center gap-2 text-xs text-[#8A8A8A]">
            <MoreVertical className="h-3.5 w-3.5 shrink-0 text-[#FF8A00]" aria-hidden="true" />
            <span>Menu de três pontos no navegador e depois «Instalar aplicação».</span>
          </div>
        )}

        {activeGuide.secondaryTip && (
          <p className="flex items-start gap-2 text-xs text-[#8A8A8A] leading-relaxed">
            <Smartphone className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#FF8A00]" aria-hidden="true" />
            <span>{activeGuide.secondaryTip}</span>
          </p>
        )}

        <div className="pt-1">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-[#FF8A00] px-4 py-2.5 font-display text-xs font-bold uppercase text-[#0A0A0A] hover:bg-[#FFC400] transition-colors cursor-pointer"
          >
            Entendi
          </button>
        </div>
      </div>
    </div>
  );
};
