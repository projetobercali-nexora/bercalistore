import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Lock,
  MessageCircle,
  ShoppingBag,
} from 'lucide-react';
import { CheckoutForm } from '../components/CheckoutForm';
import { OrderSummary } from '../components/OrderSummary';
import { SpeedLinesDivider } from '../components/SpeedLinesDivider';
import {
  WhatsAppCheckoutButton,
  type ConfirmedOrderResult,
} from '../components/WhatsAppCheckoutButton';
import { STORE_CONFIG } from '../config/store';
import { useCart } from '../context/CartContext';
import { useCatalog } from '../context/CatalogContext';
import type {
  CheckoutValidationErrors,
  CustomerCheckoutData,
  DeliveryFeeRule,
} from '../types/store';
import { calculateOrderSummary, validateCheckoutForm } from '../utils/checkout';
import {
  META_PIXEL_READY_EVENT,
  trackMetaContact,
  trackMetaInitiateCheckout,
} from '../utils/metaPixel';

const INITIAL_CUSTOMER: CustomerCheckoutData = {
  fullName: '',
  phone: '',
  email: '',
  deliveryZone: '',
  deliveryZoneId: null,
  province: '',
  municipality: '',
  neighborhood: '',
  addressReference: '',
  notes: '',
};

const FIELD_ORDER: (keyof CustomerCheckoutData)[] = [
  'fullName',
  'phone',
  'email',
  'deliveryZone',
  'province',
  'municipality',
  'neighborhood',
  'addressReference',
];

function openExternalLinkInNewTab(url: string): void {
  if (typeof document === 'undefined' || !url) return;
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}

export const CheckoutPage: React.FC = () => {
  const { lines, clearCart } = useCart();
  const { deliveryFeeRules, storeSettings, hasWhatsApp, isStoreActive } = useCatalog();
  const [customer, setCustomer] = useState<CustomerCheckoutData>(INITIAL_CUSTOMER);
  const [touchedSubmit, setTouchedSubmit] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState<ConfirmedOrderResult | null>(null);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const trackedInitiateCheckoutRef = useRef(false);

  const brandName = storeSettings.brandName || STORE_CONFIG.brandName;

  const errors: CheckoutValidationErrors = useMemo(
    () =>
      touchedSubmit
        ? validateCheckoutForm(customer, {
            mode: 'storefront',
            deliveryZones: deliveryFeeRules,
          })
        : {},
    [customer, deliveryFeeRules, touchedSubmit]
  );

  const summary = useMemo(
    () =>
      calculateOrderSummary(
        lines,
        customer.province,
        customer.municipality,
        deliveryFeeRules,
        {
          freeDeliveryThresholdKz: storeSettings.freeDeliveryThresholdKz,
          defaultDeliveryFeeKz: storeSettings.defaultDeliveryFeeKz,
          neighborhood: customer.neighborhood,
          deliveryZone: customer.deliveryZone,
        }
      ),
    [
      lines,
      customer.province,
      customer.municipality,
      customer.neighborhood,
      customer.deliveryZone,
      deliveryFeeRules,
      storeSettings.freeDeliveryThresholdKz,
      storeSettings.defaultDeliveryFeeKz,
    ]
  );

  useEffect(() => {
    if (lines.length === 0 || confirmedOrder) return;
    const tryTrackInitiateCheckout = () => {
      if (!trackedInitiateCheckoutRef.current) {
        if (trackMetaInitiateCheckout(summary)) {
          trackedInitiateCheckoutRef.current = true;
        }
      }
    };
    tryTrackInitiateCheckout();
    window.addEventListener(META_PIXEL_READY_EVENT, tryTrackInitiateCheckout);
    return () => {
      window.removeEventListener(META_PIXEL_READY_EVENT, tryTrackInitiateCheckout);
    };
  }, [confirmedOrder, lines.length, summary]);

  const handleFieldChange = (field: keyof CustomerCheckoutData, value: string) => {
    setCustomer((prev) => ({ ...prev, [field]: value }));
  };

  const handleSelectDeliveryZone = (zoneLabel: string, matchedRule?: DeliveryFeeRule) => {
    setCustomer((prev) => ({
      ...prev,
      deliveryZone: zoneLabel,
      deliveryZoneId: matchedRule?.id ?? null,
      province: matchedRule?.province ? matchedRule.province : prev.province,
      municipality: matchedRule?.municipality ? matchedRule.municipality : prev.municipality,
      neighborhood: matchedRule?.neighborhood ? matchedRule.neighborhood : prev.neighborhood,
    }));
  };

  const handleValidationFail = () => {
    setTouchedSubmit(true);
    const currentErrors = validateCheckoutForm(customer, {
      mode: 'storefront',
      deliveryZones: deliveryFeeRules,
    });
    const firstField = FIELD_ORDER.find((field) => Boolean(currentErrors[field]));
    if (firstField) {
      const el = document.getElementById(`checkout-${firstField}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.focus();
      }
    }
  };

  const handleOrderConfirmed = (result: ConfirmedOrderResult) => {
    setConfirmedOrder(result);
    clearCart();
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (result.whatsappUrl) {
      trackMetaContact('Finalizar Compra WhatsApp');
      openExternalLinkInNewTab(result.whatsappUrl);
    }
  };

  const handleCopyOrderMessage = async () => {
    if (!confirmedOrder) return;
    try {
      await navigator.clipboard.writeText(confirmedOrder.whatsappMessage);
      setCopiedSummary(true);
      window.setTimeout(() => setCopiedSummary(false), 2500);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = confirmedOrder.whatsappMessage;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopiedSummary(true);
      window.setTimeout(() => setCopiedSummary(false), 2500);
    }
  };

  if (confirmedOrder) {
    return (
      <div className="mx-auto max-w-2xl px-4 sm:px-6 py-10 sm:py-16">
        <div className="rounded-2xl bg-[#1A1A1A] border border-white/10 p-6 sm:p-8 text-center space-y-5 shadow-xl shadow-black/50">
          <CheckCircle2 className="mx-auto h-12 w-12 text-[#22C55E]" aria-hidden="true" />
          <div className="space-y-1.5">
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
              Encomenda registada com sucesso
            </h1>
            <p className="text-sm text-[#8A8A8A]">
              Guarda o código abaixo para acompanhares o teu pedido junto da {brandName}.
            </p>
          </div>

          <div className="rounded-xl bg-[#0A0A0A] border border-[#FFC400]/40 px-4 py-3.5">
            <p className="text-[11px] font-medium uppercase tracking-wider text-[#8A8A8A]">
              Código do pedido
            </p>
            <p
              data-testid="confirmed-order-code"
              className="mt-1 font-display text-xl sm:text-2xl font-extrabold text-[#FFC400] tabular-nums"
            >
              {confirmedOrder.orderNumber}
            </p>
          </div>

          <p className="text-sm text-[#8A8A8A] leading-relaxed">
            {confirmedOrder.whatsappUrl
              ? `Abrimos o WhatsApp da ${brandName} com os produtos, quantidades, total em Kz e o código do teu pedido. Caso a janela não tenha aberto automaticamente, toca no botão abaixo.`
              : `A tua encomenda ficou registada na ${brandName}. A nossa equipa entrará em contacto através do número indicado para confirmar a entrega.`}
          </p>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 pt-1">
            {confirmedOrder.whatsappUrl && (
              <a
                href={confirmedOrder.whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  trackMetaContact('Reabrir Pedido WhatsApp');
                }}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-bercali-gradient px-6 py-3 font-display text-xs sm:text-sm font-extrabold uppercase text-[#0A0A0A] shadow-lg transition-transform active:scale-[0.99]"
              >
                <MessageCircle className="h-4 w-4 shrink-0" />
                <span>Enviar no WhatsApp</span>
                <ExternalLink className="h-4 w-4 shrink-0" />
              </a>
            )}

            <button
              type="button"
              onClick={() => void handleCopyOrderMessage()}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-white/15 bg-[#0A0A0A] px-5 py-3 font-display text-xs font-bold uppercase text-white hover:border-[#FF8A00] hover:text-[#FF8A00] transition-colors cursor-pointer"
            >
              {copiedSummary ? (
                <>
                  <Check className="h-4 w-4 text-[#22C55E]" />
                  <span className="text-[#22C55E]">Resumo copiado</span>
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 text-[#FF8A00]" />
                  <span>Copiar resumo do pedido</span>
                </>
              )}
            </button>
          </div>

          <div className="pt-2">
            <Link
              to="/"
              className="inline-flex min-h-[44px] items-center justify-center text-xs sm:text-sm font-medium text-[#8A8A8A] hover:text-white transition-colors"
            >
              Voltar à página inicial
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 sm:px-6 py-12 sm:py-16 text-center space-y-4">
        <ShoppingBag className="mx-auto h-11 w-11 text-[#FF8A00]" aria-hidden="true" />
        <h1 className="font-display text-2xl font-extrabold text-white">
          Não tens artigos para finalizar
        </h1>
        <p className="text-sm text-[#8A8A8A]">
          Adiciona pelo menos um produto disponível ao carrinho antes de preencheres os dados de
          entrega.
        </p>
        <Link
          to="/catalogo"
          className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-bercali-gradient px-6 py-3 font-display text-sm font-extrabold uppercase text-[#0A0A0A]"
        >
          Ir para o catálogo
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <Link
          to="/carrinho"
          className="inline-flex min-h-[44px] items-center gap-2 text-sm font-medium text-[#8A8A8A] hover:text-[#FF8A00] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Voltar ao carrinho</span>
        </Link>
      </div>

      <div>
        <SpeedLinesDivider className="mb-2.5" />
        <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
          {hasWhatsApp ? 'Finalizar encomenda pelo WhatsApp' : 'Finalizar encomenda'}
        </h1>
        <p className="mt-1 text-sm text-[#8A8A8A]">
          {hasWhatsApp
            ? 'Confirma os teus dados e revê o resumo. A encomenda é registada antes de abrir o WhatsApp.'
            : 'Confirma os teus dados e revê o resumo para registares a tua encomenda.'}
        </p>
      </div>

      {!isStoreActive && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl bg-[#1A1A1A] border border-[#FFC400]/50 px-4 py-3.5 text-xs sm:text-sm text-white"
        >
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-[#FFC400]" aria-hidden="true" />
          <div>
            <p className="font-display text-xs font-bold uppercase text-[#FFC400]">
              Loja temporariamente encerrada
            </p>
            <p className="mt-1 text-[#8A8A8A]">{storeSettings.closedMessage}</p>
          </div>
        </div>
      )}

      {isStoreActive && touchedSubmit && Object.keys(errors).length > 0 && (
        <div
          role="alert"
          className="rounded-xl bg-[#1A1A1A] border border-[#EF4444]/60 px-4 py-3 text-xs sm:text-sm text-[#EF4444]"
        >
          Preenche corretamente todos os campos obrigatórios assinalados antes de confirmar o
          pedido.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        <div className="lg:col-span-7">
          <CheckoutForm
            values={customer}
            errors={errors}
            onChange={handleFieldChange}
            deliveryZones={deliveryFeeRules}
            onSelectDeliveryZone={handleSelectDeliveryZone}
            disabled={!isStoreActive || isSubmitting}
          />
        </div>

        <div className="lg:col-span-5 space-y-5">
          <OrderSummary summary={summary} customer={customer} />
          <WhatsAppCheckoutButton
            customer={customer}
            summary={summary}
            onValidationFail={handleValidationFail}
            onOrderConfirmed={handleOrderConfirmed}
            onSubmittingChange={setIsSubmitting}
          />
        </div>
      </div>
    </div>
  );
};
