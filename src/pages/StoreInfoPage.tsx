import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ChevronRight,
  CreditCard,
  ExternalLink,
  Globe,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  ShieldCheck,
  Truck,
} from 'lucide-react';
import { BrandLogo } from '../components/BrandLogo';
import { PWAInstallAction } from '../components/PWAInstallAction';
import { SpeedLinesDivider } from '../components/SpeedLinesDivider';
import { STORE_CONFIG } from '../config/store';
import { useCatalog } from '../context/CatalogContext';
import {
  buildWhatsAppContactMessage,
  buildWhatsAppUrl,
  getDeliveryRuleLabel,
} from '../utils/checkout';
import { formatKz } from '../utils/format';
import { trackMetaContact } from '../utils/metaPixel';

export const StoreInfoPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { storeSettings, whatsappNumber, hasWhatsApp, loading } = useCatalog();

  const brandName = storeSettings.brandName || STORE_CONFIG.brandName;
  const slogan = storeSettings.slogan || STORE_CONFIG.slogan;
  const description =
    storeSettings.description ??
    'Loja virtual focada numa experiência de compra rápida, simples e próxima para o mercado angolano.';

  const deliveryInfoText = /luanda\s+e\s+bengo/i.test(storeSettings.deliveryInfo)
    ? storeSettings.deliveryInfo
    : `Entregamos em Luanda e Bengo. ${storeSettings.deliveryInfo}`;

  const greeting = buildWhatsAppContactMessage(brandName, storeSettings.whatsappMessageTemplate);
  const whatsappHref = hasWhatsApp ? buildWhatsAppUrl(whatsappNumber, greeting) : '';

  const socialEntries = [
    { key: 'facebook', label: 'Facebook', url: storeSettings.socialLinks.facebook },
    { key: 'instagram', label: 'Instagram', url: storeSettings.socialLinks.instagram },
    { key: 'tiktok', label: 'TikTok', url: storeSettings.socialLinks.tiktok },
    { key: 'youtube', label: 'YouTube', url: storeSettings.socialLinks.youtube },
    { key: 'linkedin', label: 'LinkedIn', url: storeSettings.socialLinks.linkedin },
    { key: 'website', label: 'Website', url: storeSettings.socialLinks.website },
  ].filter((item): item is { key: string; label: string; url: string } => Boolean(item.url));

  const storeLinks = [
    { to: '/', label: 'Início' },
    { to: '/catalogo', label: 'Catálogo' },
    { to: '/catalogo?promocoes=1', label: 'Promoções' },
    { to: '/categorias', label: 'Categorias' },
    { to: '/carrinho', label: 'Carrinho' },
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-6">
      {/* Botão Voltar no topo */}
      <div>
        <button
          type="button"
          onClick={() => {
            if (window.history.length > 1) {
              navigate(-1);
            } else {
              navigate('/');
            }
          }}
          className="inline-flex min-h-[44px] items-center gap-2 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--brand-orange-text)] transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Voltar</span>
        </button>
      </div>

      {/* Cabeçalho da página */}
      <div>
        <SpeedLinesDivider className="mb-2.5" />
        <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)]">
          Informações da loja
        </h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Conhece a {brandName}, consulta as zonas e taxas de entrega em vigor, métodos de pagamento
          e canais oficiais de atendimento.
        </p>
      </div>

      {/* Identidade da marca, contactos e redes sociais */}
      <section
        aria-labelledby="store-info-identity"
        className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-[var(--shadow-card)] p-5 sm:p-7 space-y-5"
      >
        <div className="flex flex-col items-start sm:flex-row sm:items-center gap-4 sm:gap-5">
          <BrandLogo size="footer" />
          <div className="space-y-1.5 min-w-0">
            <h2
              id="store-info-identity"
              className="font-display text-lg sm:text-xl font-extrabold text-[var(--text-primary)]"
            >
              {brandName}
            </h2>
            <p className="font-display text-sm sm:text-base font-bold text-[var(--brand-orange-text)]">
              {slogan}
            </p>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{description}</p>
          </div>
        </div>

        {(storeSettings.phone || storeSettings.email || storeSettings.address) && (
          <div className="pt-4 border-t border-[var(--border-subtle)] grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-[var(--text-secondary)]">
            {storeSettings.phone && (
              <p className="flex items-center gap-2.5">
                <Phone
                  className="h-4 w-4 shrink-0 text-[var(--brand-orange-text)]"
                  aria-hidden="true"
                />
                <a
                  href={`tel:${storeSettings.phone.replace(/\s+/g, '')}`}
                  className="text-[var(--text-primary)] hover:text-[var(--brand-orange-text)] transition-colors tabular-nums font-medium"
                >
                  {storeSettings.phone}
                </a>
              </p>
            )}
            {storeSettings.email && (
              <p className="flex items-center gap-2.5">
                <Mail
                  className="h-4 w-4 shrink-0 text-[var(--brand-orange-text)]"
                  aria-hidden="true"
                />
                <a
                  href={`mailto:${storeSettings.email}`}
                  className="text-[var(--text-primary)] hover:text-[var(--brand-orange-text)] transition-colors break-all font-medium"
                >
                  {storeSettings.email}
                </a>
              </p>
            )}
            {storeSettings.address && (
              <p className="sm:col-span-2 flex items-start gap-2.5">
                <MapPin
                  className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand-orange-text)]"
                  aria-hidden="true"
                />
                <span>{storeSettings.address}</span>
              </p>
            )}
          </div>
        )}

        {socialEntries.length > 0 && (
          <div className="pt-4 border-t border-[var(--border-subtle)] space-y-2.5">
            <h3 className="font-display text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
              Redes sociais e canais oficiais
            </h3>
            <div className="flex flex-wrap items-center gap-2.5">
              {socialEntries.map((social) => (
                <a
                  key={social.key}
                  href={social.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[42px] items-center gap-2 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)] px-3.5 py-2 text-xs sm:text-sm font-semibold text-[var(--text-primary)] hover:border-[var(--brand-orange)] hover:text-[var(--brand-orange-text)] transition-colors whitespace-nowrap"
                >
                  <Globe className="h-4 w-4 text-[var(--brand-orange-text)]" aria-hidden="true" />
                  <span>{social.label}</span>
                  <ExternalLink className="h-3.5 w-3.5 text-[var(--text-secondary)]" aria-hidden="true" />
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Botões principais: WhatsApp e Instalar App */}
        <div className="pt-4 border-t border-[var(--border-subtle)] flex flex-wrap items-start gap-3">
          {whatsappHref && (
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                trackMetaContact('Informações da Loja WhatsApp');
              }}
              className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-xl bg-[var(--brand-orange)] px-4 py-2.5 font-display text-xs sm:text-sm font-extrabold uppercase text-[var(--text-on-accent)] hover:bg-[var(--brand-yellow)] transition-colors whitespace-nowrap"
            >
              <MessageCircle className="h-4 w-4 shrink-0" />
              <span>Falar no WhatsApp</span>
            </a>
          )}

          <PWAInstallAction pathname={location.pathname} variant="page" />
        </div>
      </section>

      {/* Atendimento e encomendas: Entrega em Luanda e Bengo + TODAS as zonas ativas + Pagamento */}
      <section
        aria-labelledby="store-info-delivery"
        className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-[var(--shadow-card)] p-5 sm:p-7 space-y-5"
      >
        <div>
          <h2
            id="store-info-delivery"
            className="font-display text-lg sm:text-xl font-extrabold text-[var(--text-primary)]"
          >
            Atendimento e encomendas
          </h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Condições de entrega, taxas por zona ativa e modalidades de pagamento.
          </p>
        </div>

        <div className="space-y-2.5">
          <div className="flex items-start gap-2.5">
            <Truck
              className="mt-0.5 h-5 w-5 shrink-0 text-[var(--brand-orange-text)]"
              aria-hidden="true"
            />
            <div className="space-y-1.5 text-sm leading-relaxed">
              <p className="text-[var(--text-secondary)]">
                <strong className="font-semibold text-[var(--text-primary)]">Entrega:</strong>{' '}
                {deliveryInfoText}
              </p>
              {storeSettings.freeDeliveryThresholdKz !== null &&
                storeSettings.freeDeliveryThresholdKz > 0 && (
                  <p className="font-medium text-[var(--brand-orange-text)] tabular-nums">
                    Entrega gratuita em compras a partir de{' '}
                    <strong>{formatKz(storeSettings.freeDeliveryThresholdKz)}</strong>.
                  </p>
                )}
            </div>
          </div>
        </div>

        {/* Lista de taxas de TODAS as zonas ativas lidas de store_settings > delivery_zones */}
        <div className="pt-4 border-t border-[var(--border-subtle)] space-y-3">
          <h3 className="font-display text-sm font-bold text-[var(--text-primary)]">
            Taxas de entrega por zona ativa
          </h3>

          {loading && storeSettings.deliveryFeeRules.length === 0 ? (
            <p className="text-sm text-[var(--text-secondary)]">
              A carregar zonas de entrega configuradas...
            </p>
          ) : storeSettings.deliveryFeeRules.length > 0 ? (
            <ul className="divide-y divide-[var(--border-subtle)] rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)] px-4">
              {storeSettings.deliveryFeeRules.map((rule, idx) => {
                const label = getDeliveryRuleLabel(rule);
                return (
                  <li
                    key={`info-zone-${rule.id ?? idx}-${label}`}
                    className="flex items-center justify-between gap-3 py-3 text-sm tabular-nums"
                  >
                    <div className="min-w-0">
                      <span className="font-medium text-[var(--text-primary)]">{label}</span>
                      {rule.estimatedTime && (
                        <span className="ml-2 text-xs text-[var(--text-secondary)]">
                          · {rule.estimatedTime}
                        </span>
                      )}
                    </div>
                    <span className="font-display font-bold text-[var(--text-primary)] shrink-0">
                      {rule.feeKz === 0 ? 'Grátis' : formatKz(rule.feeKz)}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-[var(--text-secondary)]">
              As taxas de entrega são confirmadas diretamente pela equipa da loja no momento do
              pedido.
            </p>
          )}
        </div>

        {/* Formas de pagamento */}
        <div className="pt-4 border-t border-[var(--border-subtle)] flex items-start gap-2.5 text-sm leading-relaxed">
          <CreditCard
            className="mt-0.5 h-5 w-5 shrink-0 text-[var(--brand-orange-text)]"
            aria-hidden="true"
          />
          <p className="text-[var(--text-secondary)]">
            <strong className="font-semibold text-[var(--text-primary)]">
              Formas de pagamento:
            </strong>{' '}
            {storeSettings.paymentInfo}
          </p>
        </div>
      </section>

      {/* Navegação rápida e Políticas legais */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <section
          aria-labelledby="store-info-navigation"
          className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-[var(--shadow-card)] p-5 sm:p-6 space-y-3.5"
        >
          <h2
            id="store-info-navigation"
            className="font-display text-base font-extrabold text-[var(--text-primary)]"
          >
            Navegação da loja
          </h2>
          <ul className="divide-y divide-[var(--border-subtle)]">
            {storeLinks.map((item) => (
              <li key={item.to}>
                <Link
                  to={item.to}
                  className="flex min-h-[44px] items-center justify-between gap-2 py-2 text-sm font-medium text-[var(--text-primary)] hover:text-[var(--brand-orange-text)] transition-colors"
                >
                  <span>{item.label}</span>
                  <ChevronRight className="h-4 w-4 text-[var(--text-secondary)]" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section
          aria-labelledby="store-info-legal"
          className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-[var(--shadow-card)] p-5 sm:p-6 flex flex-col justify-between space-y-4"
        >
          <div className="space-y-3.5">
            <h2
              id="store-info-legal"
              className="font-display text-base font-extrabold text-[var(--text-primary)]"
            >
              Políticas e termos
            </h2>
            <ul className="divide-y divide-[var(--border-subtle)]">
              <li>
                <Link
                  to="/privacidade"
                  className="flex min-h-[44px] items-center justify-between gap-2 py-2 text-sm font-medium text-[var(--text-primary)] hover:text-[var(--brand-orange-text)] transition-colors"
                >
                  <span>Política de privacidade</span>
                  <ChevronRight className="h-4 w-4 text-[var(--text-secondary)]" aria-hidden="true" />
                </Link>
              </li>
              <li>
                <Link
                  to="/termos"
                  className="flex min-h-[44px] items-center justify-between gap-2 py-2 text-sm font-medium text-[var(--text-primary)] hover:text-[var(--brand-orange-text)] transition-colors"
                >
                  <span>Termos de utilização</span>
                  <ChevronRight className="h-4 w-4 text-[var(--text-secondary)]" aria-hidden="true" />
                </Link>
              </li>
            </ul>
          </div>

          <div className="rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)] p-4 flex items-start gap-2.5 text-xs text-[var(--text-secondary)] leading-relaxed">
            <ShieldCheck
              className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand-orange-text)]"
              aria-hidden="true"
            />
            <p>{storeSettings.orderDisclaimer || STORE_CONFIG.orderDisclaimer}</p>
          </div>
        </section>
      </div>
    </div>
  );
};
