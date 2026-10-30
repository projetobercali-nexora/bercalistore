import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Check,
  Copy,
  Download,
  ExternalLink,
  Loader2,
  Monitor,
  Smartphone,
  X,
} from 'lucide-react';
import {
  resolveInstallFallbackInstruction,
  type InstallEnvironmentInfo,
} from '../utils/pwa';
import { BrandLogo } from './BrandLogo';

interface PWAInstallModalProps {
  open: boolean;
  brandName: string;
  environment: InstallEnvironmentInfo;
  isInstallableNatively?: boolean;
  isPrompting?: boolean;
  onTriggerNativeInstall?: () => Promise<void> | void;
  wasRecentlyDismissed?: boolean;
  wasPreviouslyInstalled?: boolean;
  onClose: () => void;
}

async function copyTextSafe(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback abaixo para WebViews com permissões restritas
    }
  }

  if (typeof document === 'undefined') {
    return false;
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '-9999px';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

export const PWAInstallModal: React.FC<PWAInstallModalProps> = ({
  open,
  brandName,
  environment,
  isInstallableNatively = false,
  isPrompting = false,
  onTriggerNativeInstall,
  wasRecentlyDismissed = false,
  wasPreviouslyInstalled = false,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) {
      setCopied(false);
      return;
    }
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

  const currentUrl =
    typeof window !== 'undefined' ? window.location.href : 'https://bercalistore.ao/';

  const instruction = resolveInstallFallbackInstruction(environment, {
    brandName,
    currentUrl,
    wasRecentlyDismissed,
    wasPreviouslyInstalled,
  });

  const canUseDirectNativeInstall =
    isInstallableNatively && !environment.isIOS && Boolean(onTriggerNativeInstall);

  const DeviceIcon = environment.isMobile ? Smartphone : Monitor;

  const handleCopyLink = async () => {
    const success = await copyTextSafe(instruction.copyUrl);
    if (success) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pwa-install-modal-title"
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-3 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-[#1A1A1A] border border-white/15 p-4 sm:p-5 shadow-2xl space-y-3.5 max-h-[calc(100dvh-24px)] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <BrandLogo size="compact" />
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wider text-[#FF8A00] truncate">
                {instruction.deviceLabel}
              </p>
              <h3
                id="pwa-install-modal-title"
                className="font-display text-base font-bold text-white leading-snug"
              >
                {instruction.title}
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar painel de instalação"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#8A8A8A] hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {canUseDirectNativeInstall ? (
          <div className="space-y-3">
            <p className="rounded-xl bg-[#0A0A0A] border border-white/10 px-3.5 py-3 text-xs text-white/90 leading-relaxed">
              A instalação direta está disponível neste dispositivo. Toca abaixo para adicionar a{' '}
              <strong className="text-white">{brandName}</strong> ao teu ecrã.
            </p>
            <button
              type="button"
              disabled={isPrompting}
              onClick={() => void onTriggerNativeInstall?.()}
              className="inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-[#FF8A00] px-4 py-2.5 font-display text-xs font-bold uppercase text-[#0A0A0A] hover:bg-[#FFC400] transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-wait"
            >
              {isPrompting ? (
                <>
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                  <span>A aguardar confirmação...</span>
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 shrink-0" />
                  <span>Instalar agora</span>
                </>
              )}
            </button>
          </div>
        ) : (
          <>
            {/* Instrução principal adaptada ao navegador/dispositivo */}
            <div className="rounded-xl bg-[#0A0A0A] border border-[#FF8A00]/40 p-3.5">
              <p className="flex items-start gap-2.5 font-display text-sm font-bold text-white leading-relaxed">
                <DeviceIcon
                  className="mt-0.5 h-4 w-4 shrink-0 text-[#FF8A00]"
                  aria-hidden="true"
                />
                <span>{instruction.primaryInstruction}</span>
              </p>
            </div>

            {/* Passos detalhados apenas quando a instalação nativa não está disponível */}
            {instruction.steps.length > 0 && (
              <ol className="rounded-xl bg-[#0A0A0A] border border-white/10 p-3.5 space-y-2.5 text-xs text-white/90 leading-relaxed">
                {instruction.steps.map((step, index) => (
                  <li key={`pwa-step-${index}`} className="flex items-start gap-2.5">
                    <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[#FF8A00]/15 border border-[#FF8A00]/40 font-display text-[11px] font-bold text-[#FFC400] tabular-nums">
                      {index + 1}
                    </span>
                    <span className="pt-0.5">{step}</span>
                  </li>
                ))}
              </ol>
            )}

            {/* Ações rápidas para navegadores internos (WhatsApp, Facebook, Instagram, TikTok, Messenger) ou outros navegadores */}
            {(instruction.showCopyLinkButton || instruction.showOpenInChromeButton) && (
              <div
                className={`grid gap-2 ${
                  instruction.showCopyLinkButton && instruction.showOpenInChromeButton
                    ? 'grid-cols-2'
                    : 'grid-cols-1'
                }`}
              >
                {instruction.showCopyLinkButton && (
                  <button
                    type="button"
                    onClick={() => void handleCopyLink()}
                    className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-[#0A0A0A] px-3 py-2 font-display text-xs font-bold text-white hover:border-[#FF8A00] hover:text-[#FF8A00] transition-colors cursor-pointer"
                  >
                    {copied ? (
                      <>
                        <Check className="h-4 w-4 shrink-0 text-[#FFC400]" />
                        <span className="text-[#FFC400]">Link copiado</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 shrink-0 text-[#FF8A00]" />
                        <span>Copiar link</span>
                      </>
                    )}
                  </button>
                )}

                {instruction.showOpenInChromeButton && (
                  <a
                    href={instruction.openInChromeUrl}
                    className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-[#FF8A00] px-3 py-2 font-display text-xs font-bold text-[#0A0A0A] hover:bg-[#FFC400] transition-colors text-center"
                  >
                    <ExternalLink className="h-4 w-4 shrink-0" />
                    <span>Abrir no Chrome</span>
                  </a>
                )}
              </div>
            )}

            {/* Indicação quando já instalada ou dispensada recentemente */}
            {instruction.statusNote && (
              <p className="rounded-xl bg-[#0A0A0A] border border-white/10 px-3 py-2.5 text-xs text-white/85 leading-relaxed">
                {instruction.statusNote}
              </p>
            )}

            {instruction.secondaryHelper && (
              <p className="text-xs text-[#8A8A8A] leading-relaxed">
                {instruction.secondaryHelper}
              </p>
            )}

            {instruction.contextNotice && (
              <div className="flex items-start gap-2 rounded-xl bg-[#0A0A0A] border border-[#FFC400]/35 px-3 py-2.5 text-xs text-white/90 leading-relaxed">
                <AlertCircle
                  className="mt-0.5 h-4 w-4 shrink-0 text-[#FFC400]"
                  aria-hidden="true"
                />
                <span>{instruction.contextNotice}</span>
              </div>
            )}
          </>
        )}

        <div className="pt-0.5">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border border-white/15 bg-[#0A0A0A] px-4 py-2.5 font-display text-xs font-bold uppercase text-white hover:border-[#FF8A00] hover:text-[#FF8A00] transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
