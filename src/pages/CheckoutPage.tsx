import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  Lock,
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
import {
  calculateOrderSummary,
  clearConfirmedOrderFromSession,
  findMatchingDeliveryZone,
  readConfirmedOrderFromSession,
  saveConfirmedOrderToSession,
  validateCheckoutForm,
  type StoredConfirmedOrderSession,
} from '../utils/checkout';
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
  'province',
  'municipality',
  'neighborhood',
  'addressReference',
];

export const CheckoutPage: React.FC = () => {
  const { items, lines, clearCart } = useCart();
  const {
    deliveryFeeRules,
    storeSettings,
    hasWhatsApp,
    isStoreActive,
    loading: catalogLoading,
  } = useCatalog();
  const [customer, setCustomer] = useState<CustomerCheckoutData>(INITIAL_CUSTOMER);
  const [touchedSubmit, setTouchedSubmit] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState<StoredConfirmedOrderSession | null>(() =>
    items.length === 0 ? readConfirmedOrderFromSession() : null
  );
  const trackedInitiateCheckoutRef = useRef(false);

  const brandName = storeSettings.brandName || STORE_CONFIG.brandName;

  useEffect(() => {
    if (items.length > 0 && !confirmedOrder) {
      clearConfirmedOrderFromSession();
    }
  }, [confirmedOrder, items.length]);

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
          deliveryZoneId: customer.deliveryZoneId,
        }
      ),
    [
      lines,
      customer.province,
      customer.municipality,
      customer.neighborhood,
      customer.deliveryZone,
      customer.deliveryZoneId,
      deliveryFeeRules,
      storeSettings.freeDeliveryThresholdKz,
      storeSettings.defaultDeliveryFeeKz,
    ]
  );

  // Se uma zona for desativada em tempo real no painel enquanto o checkout está aberto, limpa a seleção antiga
  useEffect(() => {
    if (catalogLoading) return;
    if (!customer.province.trim() && !(customer.deliveryZone ?? '').trim()) return;
    const stillActive = findMatchingDeliveryZone(deliveryFeeRules, {
      deliveryZoneId: customer.deliveryZoneId,
      deliveryZone: customer.deliveryZone,
      province: customer.province,
    });
    if (!stillActive) {
      setCustomer((prev) => ({
        ...prev,
        province: '',
        deliveryZone: '',
        deliveryZoneId: null,
      }));
    }
  }, [
    catalogLoading,
    customer.deliveryZone,
    customer.deliveryZoneId,
    customer.province,
    deliveryFeeRules,
  ]);

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
    if (!zoneLabel) {
      setCustomer((prev) => ({
        ...prev,
        deliveryZone: '',
        deliveryZoneId: null,
        province: '',
      }));
      return;
    }
    setCustomer((prev) => ({
      ...prev,
      deliveryZone: zoneLabel,
      deliveryZoneId: matchedRule?.id ?? null,
      province: matchedRule?.province || zoneLabel,
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
    const sessionOrder: StoredConfirmedOrderSession = {
      orderNumber: result.orderNumber,
      whatsappUrl: result.whatsappUrl,
    };

    saveConfirmedOrderToSession(sessionOrder);

    if (result.whatsappUrl) {
      trackMetaContact('Confirmar pedido');
      clearCart();
      setConfirmedOrder(sessionOrder);
      window.location.href = result.whatsappUrl;
      return;
    }

    if (typeof console !== 'undefined') {
      console.error(
        '[Bercali Store · Checkout WhatsApp] Número de WhatsApp vazio ou inválido; redirecionamento cancelado:',
        {
          orderNumber: result.orderNumber,
          reason:
            result.whatsappInvalidReason ||
            'Número de WhatsApp da loja vazio ou inválido nas definições.',
        }
      );
    }

    clearCart();
    setConfirmedOrder(sessionOrder);
    window.scrollTo({ top: 0, behavior: 'auto' });
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

          {confirmedOrder.whatsappUrl ? (
            <p className="pt-1 text-xs text-[#8A8A8A]">
              Não abriu o WhatsApp?{' '}
              <a
                href={confirmedOrder.whatsappUrl}
                onClick={() => {
                  trackMetaContact('Confirmar pedido');
                }}
                className="underline underline-offset-4 text-[#FF8A00] hover:text-[#FFC400] transition-colors"
              >
                Toca aqui
              </a>
            </p>
          ) : (
            <p role="status" className="text-sm text-[#8A8A8A] leading-relaxed">
              Pedido registado. A equipa vai contactar-te no número indicado
            </p>
          )}
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
            loadingZones={catalogLoading}
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
