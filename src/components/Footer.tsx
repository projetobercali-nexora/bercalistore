import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Download,
  Globe,
  Loader2,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
} from 'lucide-react';
import { STORE_CONFIG } from '../config/store';
import { useCatalog } from '../context/CatalogContext';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { buildWhatsAppContactMessage, buildWhatsAppUrl } from '../utils/checkout';
import { formatKz } from '../utils/format';
import { trackMetaContact } from '../utils/metaPixel';
import { BrandLogo } from './BrandLogo';
import { PWAInstallModal } from './PWAInstallModal';
import { SpeedLinesDivider } from './SpeedLinesDivider';

export const Footer: React.FC = () => {
  const location = useLocation();
  const { storeSettings, whatsappNumber, hasWhatsApp } = useCatalog();
  const {
    isInstalled,
    isInstallableNatively,
    isPrompting,
    wasRecentlyDismissed,
    wasPreviouslyInstalled,
    environment,
    triggerNativeInstall,
    clearOutcome,
  } = usePWAInstall(location.pathname);
  const [showManualInstallModal, setShowManualInstallModal] = useState(false);

  const brandName = storeSettings.brandName || STORE_CONFIG.brandName;
  const greeting = buildWhatsAppContactMessage(brandName, storeSettings.whatsappMessageTemplate);
  const whatsappHref = hasWhatsApp ? buildWhatsAppUrl(whatsappNumber, greeting) : '';
  const isProductDetail = location.pathname.startsWith('/produto/');

  const socialEntries = [
    { key: 'instagram', label: 'Instagram', url: storeSettings.socialLinks.instagram },
    { key: 'facebook', label: 'Facebook', url: storeSettings.socialLinks.facebook },
    { key: 'tiktok', label: 'TikTok', url: storeSettings.socialLinks.tiktok },
    { key: 'youtube', label: 'YouTube', url: storeSettings.socialLinks.youtube },
    { key: 'linkedin', label: 'LinkedIn', url: storeSettings.socialLinks.linkedin },
    { key: 'website', label: 'Website', url: storeSettings.socialLinks.website },
  ].filter((item): item is { key: string; label: string; url: string } => Boolean(item.url));

  const handleFooterInstall = async () => {
    if (isInstalled || isPrompting) {
      return;
    }

    if (environment.isIOS) {
      setShowManualInstallModal(true);
      return;
    }

    const outcome = await triggerNativeInstall();
    if (outcome === 'unavailable' || outcome === 'failed') {
      clearOutcome();
      setShowManualInstallModal(true);
    }
  };

  const handleNativeInstallFromModal = async () => {
    const outcome = await triggerNativeInstall();
    if (outcome === 'accepted') {
      setShowManualInstallModal(false);
    }
  };

  return (
    <footer
      className={`mt-16 border-t border-white/10 bg-[#0A0A0A] ${
        isProductDetail
          ? 'pb-[calc(140px+env(safe-area-inset-bottom,0px))] md:pb-24'
          : 'pb-[calc(88px+env(safe-area-inset-bottom,0px))] md:pb-12'
      }`}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-12">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 pb-10 border-b border-white/10">
          {/* Identidade da marca, slogan, contactos oficiais e redes sociais reais */}
          <div className="md:col-span-5 flex flex-col items-start">
            <Link to="/" aria-label={`${brandName} — Página inicial`} className="rounded-xl">
              <BrandLogo size="footer" />
            </Link>
            <p className="mt-3 font-display text-base font-bold text-white">
              {storeSettings.slogan}
            </p>
            <p className="mt-2 max-w-sm text-sm text-[#8A8A8A] leading-relaxed">
              {storeSettings.description ??
                'Loja virtual focada numa experiência de compra rápida, simples e próxima para o mercado angolano.'}
            </p>

            {/* Contactos diretos reais quando configurados no Painel Administrativo */}
            {(storeSettings.phone || storeSettings.email || storeSettings.address) && (
              <div className="mt-4 space-y-2 text-xs text-[#8A8A8A]">
                {storeSettings.phone && (
                  <p className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5 shrink-0 text-[#FF8A00]" aria-hidden="true" />
                    <a
                      href={`tel:${storeSettings.phone.replace(/\s+/g, '')}`}
                      className="hover:text-white transition-colors tabular-nums"
                    >
                      {storeSettings.phone}
                    </a>
                  </p>
                )}
                {storeSettings.email && (
                  <p className="flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5 shrink-0 text-[#FF8A00]" aria-hidden="true" />
                    <a
                      href={`mailto:${storeSettings.email}`}
                      className="hover:text-white transition-colors break-all"
                    >
                      {storeSettings.email}
                    </a>
                  </p>
                )}
                {storeSettings.address && (
                  <p className="flex items-start gap-2">
                    <MapPin
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#FF8A00]"
                      aria-hidden="true"
                    />
                    <span>{storeSettings.address}</span>
                  </p>
                )}
              </div>
            )}

            {/* Redes sociais reais (apenas quando definidas no Supabase) */}
            {socialEntries.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center gap-3 text-xs">
                {socialEntries.map((social) => (
                  <a
                    key={social.key}
                    href={social.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-white/85 hover:text-[#FF8A00] transition-colors whitespace-nowrap"
                  >
                    <Globe className="h-3.5 w-3.5 text-[#FF8A00]" aria-hidden="true" />
                    <span>{social.label}</span>
                  </a>
                ))}
              </div>
            )}

            <SpeedLinesDivider className="mt-4" />
          </div>

          {/* Navegação principal e políticas */}
          <div className="md:col-span-3">
            <h2 className="font-display text-sm font-bold uppercase tracking-wider text-white">
              Navegação
            </h2>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li>
                <Link to="/" className="text-[#8A8A8A] hover:text-[#FF8A00] transition-colors">
                  Início
                </Link>
              </li>
              <li>
                <Link
                  to="/catalogo"
                  className="text-[#8A8A8A] hover:text-[#FF8A00] transition-colors"
                >
                  Catálogo de produtos
                </Link>
              </li>
              <li>
                <Link
                  to="/catalogo?promocoes=1"
                  className="text-[#8A8A8A] hover:text-[#FF8A00] transition-colors"
                >
                  Promoções
                </Link>
              </li>
              <li>
                <Link
                  to="/categorias"
                  className="text-[#8A8A8A] hover:text-[#FF8A00] transition-colors"
                >
                  Categorias
                </Link>
              </li>
              <li>
                <Link
                  to="/carrinho"
                  className="text-[#8A8A8A] hover:text-[#FF8A00] transition-colors"
                >
                  Carrinho de compras
                </Link>
              </li>
              <li>
                <Link
                  to="/privacidade"
                  className="text-[#8A8A8A] hover:text-[#FF8A00] transition-colors"
                >
                  Política de privacidade
                </Link>
              </li>
              <li>
                <Link
                  to="/termos"
                  className="text-[#8A8A8A] hover:text-[#FF8A00] transition-colors"
                >
                  Termos de utilização
                </Link>
              </li>
            </ul>
          </div>

          {/* Entrega, Zonas, Pagamento, WhatsApp e App PWA */}
          <div className="md:col-span-4 space-y-4 min-w-0">
            <h2 className="font-display text-sm font-bold uppercase tracking-wider text-white">
              Atendimento e Encomendas
            </h2>
            <p className="text-xs text-[#8A8A8A] leading-relaxed">
              <strong className="text-white">Entrega:</strong> {storeSettings.deliveryInfo}
            </p>

            {storeSettings.freeDeliveryThresholdKz !== null &&
              storeSettings.freeDeliveryThresholdKz > 0 && (
                <p className="text-xs text-[#FFC400] tabular-nums">
                  Entrega gratuita em compras a partir de{' '}
                  <strong>{formatKz(storeSettings.freeDeliveryThresholdKz)}</strong>.
                </p>
              )}

            {storeSettings.deliveryFeeRules.length > 0 && (
              <div className="space-y-1 text-xs text-[#8A8A8A]">
                <p className="font-medium text-white">Taxas de entrega configuradas:</p>
                <ul className="space-y-1">
                  {storeSettings.deliveryFeeRules.slice(0, 5).map((rule, idx) => {
                    const zoneLabel = [rule.province, rule.municipality, rule.neighborhood]
                      .filter(Boolean)
                      .join(' · ');
                    return (
                      <li
                        key={`footer-zone-${idx}`}
                        className="flex items-center justify-between gap-2 tabular-nums"
                      >
                        <span className="truncate">{rule.zoneName || zoneLabel}</span>
                        <span className="text-white shrink-0">
                          {rule.feeKz === 0 ? 'Grátis' : formatKz(rule.feeKz)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            <p className="text-xs text-[#8A8A8A] leading-relaxed">
              <strong className="text-white">Pagamento:</strong> {storeSettings.paymentInfo}
            </p>

            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              {whatsappHref && (
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => {
                    trackMetaContact('Rodapé WhatsApp');
                  }}
                  className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-[#FF8A00] px-4 py-2 font-display text-xs font-bold uppercase text-[#0A0A0A] hover:bg-[#FFC400] transition-colors whitespace-nowrap"
                >
                  <MessageCircle className="h-4 w-4 shrink-0" />
                  <span>Falar no WhatsApp</span>
                </a>
              )}

              {!isInstalled && (
                <button
                  type="button"
                  disabled={isPrompting}
                  onClick={() => void handleFooterInstall()}
                  className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-white/15 bg-[#1A1A1A] px-4 py-2 font-display text-xs font-bold uppercase text-white hover:border-[#FF8A00] hover:text-[#FF8A00] transition-colors whitespace-nowrap cursor-pointer disabled:opacity-60 disabled:cursor-wait"
                >
                  {isPrompting ? (
                    <>
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#FF8A00]" />
                      <span>A aguardar...</span>
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 shrink-0 text-[#FF8A00]" />
                      <span>Instalar App</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Aviso legal de confirmação da loja e direitos */}
        <div className="pt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-[#8A8A8A]">
          <p className="max-w-2xl leading-relaxed">{storeSettings.orderDisclaimer}</p>
          <p className="shrink-0">
            © {new Date().getFullYear()} {brandName}.
          </p>
        </div>
      </div>

      {/* Instruções reais por dispositivo/navegador quando o evento nativo não está disponível */}
      {!isInstalled && (
        <PWAInstallModal
          open={showManualInstallModal}
          brandName={brandName}
          environment={environment}
          isInstallableNatively={isInstallableNatively}
          isPrompting={isPrompting}
          onTriggerNativeInstall={handleNativeInstallFromModal}
          wasRecentlyDismissed={wasRecentlyDismissed}
          wasPreviouslyInstalled={wasPreviouslyInstalled}
          onClose={() => setShowManualInstallModal(false)}
        />
      )}
    </footer>
  );
};
