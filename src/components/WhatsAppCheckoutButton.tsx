import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Loader2,
  Lock,
  RefreshCw,
  ShoppingBag,
} from 'lucide-react';
import { STORE_CONFIG } from '../config/store';
import { useCatalog } from '../context/CatalogContext';
import { submitOrderToSupabase } from '../services/storefrontApi';
import type {
  CustomerCheckoutData,
  OrderPersistenceStatus,
  OrderSummaryCalculation,
} from '../types/store';
import {
  buildWhatsAppOrderMessage,
  buildWhatsAppUrl,
  findMatchingDeliveryZone,
  hasValidationErrors,
  NO_ACTIVE_DELIVERY_ZONES_MESSAGE,
  validateCheckoutForm,
} from '../utils/checkout';
import { PUBLIC_MESSAGES } from '../utils/publicMessages';
import { generateOrderNumber } from '../utils/supabaseMapper';

export interface ConfirmedOrderResult {
  orderNumber: string;
  whatsappUrl: string;
  whatsappMessage: string;
  summary: OrderSummaryCalculation;
  whatsappInvalidReason?: string | null;
}

interface WhatsAppCheckoutButtonProps {
  customer: CustomerCheckoutData;
  summary: OrderSummaryCalculation;
  onValidationFail: () => void;
  onConfirmClearCart?: (orderNumber?: string) => void;
  onOrderConfirmed?: (result: ConfirmedOrderResult) => void;
  onSubmittingChange?: (submitting: boolean) => void;
}

export const WhatsAppCheckoutButton: React.FC<WhatsAppCheckoutButtonProps> = ({
  customer,
  summary,
  onValidationFail,
  onConfirmClearCart,
  onOrderConfirmed,
  onSubmittingChange,
}) => {
  const {
    whatsappNumber,
    deliveryFeeRules,
    storeSettings,
    isStoreActive,
    loading: catalogLoading,
    refreshCatalog,
  } = useCatalog();
  const [orderNumber, setOrderNumber] = useState<string>(() => generateOrderNumber());
  const [persistenceStatus, setPersistenceStatus] = useState<OrderPersistenceStatus>('idle');
  const [persistenceMessage, setPersistenceMessage] = useState<string | null>(null);
  const [verifiedSummary, setVerifiedSummary] = useState<OrderSummaryCalculation | null>(null);

  const inFlightRef = useRef(false);
  const savedSignatureRef = useRef<string | null>(null);

  const payloadSignature = useMemo(() => {
    const itemsKey = summary.lines
      .map((l) => `${l.product.id}:${l.quantity}:${l.product.price}`)
      .join('|');
    return [
      customer.fullName.trim(),
      customer.phone.trim(),
      (customer.email ?? '').trim(),
      (customer.deliveryZoneId ?? '').trim(),
      (customer.deliveryZone ?? '').trim(),
      customer.province.trim(),
      customer.municipality.trim(),
      customer.neighborhood.trim(),
      customer.addressReference.trim(),
      customer.notes.trim(),
      itemsKey,
    ].join('::');
  }, [customer, summary.lines]);

  // Se o cliente alterar os dados ou os artigos após uma tentativa, limpa o estado anterior
  useEffect(() => {
    setVerifiedSummary(null);
    if (savedSignatureRef.current && savedSignatureRef.current !== payloadSignature) {
      savedSignatureRef.current = null;
      setOrderNumber(generateOrderNumber());
      setPersistenceStatus('idle');
      setPersistenceMessage(null);
    } else if (persistenceStatus !== 'idle' && persistenceStatus !== 'saving') {
      setPersistenceStatus('idle');
      setPersistenceMessage(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payloadSignature]);

  const brandName = storeSettings.brandName || STORE_CONFIG.brandName;
  const orderTemplate =
    storeSettings.whatsappOrderTemplate ?? storeSettings.whatsappMessageTemplate;
  const effectiveSummary = verifiedSummary ?? summary;
  const noActiveZones = !catalogLoading && deliveryFeeRules.length === 0;
  const matchedActiveZone = findMatchingDeliveryZone(deliveryFeeRules, {
    deliveryZoneId: customer.deliveryZoneId,
    deliveryZone: customer.deliveryZone,
    province: customer.province,
  });
  const hasSelectedProvince = Boolean(customer.province.trim()) && Boolean(matchedActiveZone);
  const errors = validateCheckoutForm(customer, {
    mode: 'storefront',
    deliveryZones: deliveryFeeRules,
  });
  const isFormValid = !hasValidationErrors(errors) && effectiveSummary.lines.length > 0;
  const isSubmitting = persistenceStatus === 'saving';

  const handleConfirmOrder = useCallback(async () => {
    if (!isStoreActive) {
      setPersistenceStatus('store_closed');
      setPersistenceMessage(storeSettings.closedMessage);
      return;
    }

    if (!isFormValid) {
      onValidationFail();
      return;
    }

    if (inFlightRef.current || savedSignatureRef.current === payloadSignature) {
      return;
    }

    inFlightRef.current = true;
    setPersistenceStatus('saving');
    setPersistenceMessage(null);
    onSubmittingChange?.(true);

    try {
      const res = await submitOrderToSupabase(customer, summary, orderNumber);

      if (res.verifiedSummary) {
        setVerifiedSummary(res.verifiedSummary);
      }

      if (!res.ok) {
        setPersistenceStatus(res.status);
        setPersistenceMessage(res.errorMessage ?? PUBLIC_MESSAGES.orderRegistrationTemporaryError);

        if (res.status === 'store_closed' || res.status === 'stock_conflict') {
          void refreshCatalog({ silent: true });
        }
        return;
      }

      const activeSettings = res.storeSettings ?? storeSettings;
      const finalBrandName = activeSettings.brandName || brandName;
      const finalOrderTemplate =
        activeSettings.whatsappOrderTemplate ??
        activeSettings.whatsappMessageTemplate ??
        orderTemplate;
      const resolvedWhatsappNumber = res.storeSettings
        ? res.storeSettings.whatsappNumber
        : whatsappNumber;

      const finalOrderNumber = res.orderNumber || orderNumber;
      const finalSummary = res.verifiedSummary ?? summary;
      const finalMessage = buildWhatsAppOrderMessage(
        customer,
        finalSummary,
        finalOrderNumber,
        finalBrandName,
        finalOrderTemplate
      );
      const finalWhatsappUrl = buildWhatsAppUrl(resolvedWhatsappNumber, finalMessage);
      const invalidReason = !finalWhatsappUrl
        ? activeSettings.whatsappInvalidReason ||
          'Número de WhatsApp da loja vazio ou inválido nas definições.'
        : null;

      savedSignatureRef.current = payloadSignature;
      setOrderNumber(finalOrderNumber);
      setPersistenceStatus('saved');

      if (onOrderConfirmed) {
        onOrderConfirmed({
          orderNumber: finalOrderNumber,
          whatsappUrl: finalWhatsappUrl,
          whatsappMessage: finalMessage,
          summary: finalSummary,
          whatsappInvalidReason: invalidReason,
        });
      } else {
        onConfirmClearCart?.(finalOrderNumber);
      }
    } finally {
      inFlightRef.current = false;
      onSubmittingChange?.(false);
    }
  }, [
    brandName,
    customer,
    isFormValid,
    isStoreActive,
    onConfirmClearCart,
    onOrderConfirmed,
    onSubmittingChange,
    onValidationFail,
    orderNumber,
    orderTemplate,
    payloadSignature,
    refreshCatalog,
    storeSettings,
    summary,
    whatsappNumber,
  ]);

  if (!isStoreActive) {
    return (
      <div className="space-y-3">
        <button
          type="button"
          disabled
          className="flex min-h-[52px] w-full items-center justify-center gap-2.5 rounded-xl bg-white/10 px-5 py-3.5 font-display text-sm font-extrabold uppercase tracking-wide text-[#8A8A8A] cursor-not-allowed"
        >
          <Lock className="h-5 w-5 shrink-0" />
          <span>Loja encerrada para encomendas</span>
        </button>
        <p className="text-xs text-[#8A8A8A] leading-relaxed">{storeSettings.closedMessage}</p>
      </div>
    );
  }

  if (noActiveZones) {
    return (
      <div className="space-y-3">
        <button
          type="button"
          disabled
          className="flex min-h-[52px] w-full items-center justify-center gap-2.5 rounded-xl bg-white/10 px-5 py-3.5 font-display text-sm font-extrabold uppercase tracking-wide text-[#8A8A8A] cursor-not-allowed"
        >
          <Lock className="h-5 w-5 shrink-0" />
          <span>Confirmar pedido</span>
        </button>
        <p role="alert" className="text-xs font-medium text-[#EF4444] leading-relaxed">
          {NO_ACTIVE_DELIVERY_ZONES_MESSAGE}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        disabled={isSubmitting || catalogLoading || !hasSelectedProvince}
        onClick={() => void handleConfirmOrder()}
        className={`flex min-h-[52px] w-full items-center justify-center gap-2.5 rounded-xl bg-bercali-gradient px-5 py-3.5 font-display text-sm sm:text-base font-extrabold uppercase tracking-wide text-[#0A0A0A] shadow-lg transition-transform active:scale-[0.99] cursor-pointer disabled:opacity-55 ${
          isSubmitting ? 'disabled:cursor-wait' : 'disabled:cursor-not-allowed'
        }`}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="h-5 w-5 shrink-0 animate-spin" />
            <span>A registar encomenda...</span>
          </>
        ) : (
          <>
            <ShoppingBag className="h-5 w-5 shrink-0" />
            <span>Confirmar pedido</span>
          </>
        )}
      </button>

      {(persistenceStatus === 'store_closed' ||
        persistenceStatus === 'stock_conflict' ||
        persistenceStatus === 'rls_blocked' ||
        persistenceStatus === 'error' ||
        persistenceStatus === 'unconfigured') &&
        persistenceMessage && (
          <div
            role="alert"
            className="rounded-xl bg-[#0A0A0A] border border-[#EF4444]/60 p-4 space-y-3 text-xs text-white/90"
          >
            <div className="flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 shrink-0 text-[#EF4444] mt-0.5" />
              <div className="space-y-1">
                <p className="font-display text-xs font-bold uppercase text-[#EF4444]">
                  Não foi possível confirmar o pedido
                </p>
                <p className="leading-relaxed">{persistenceMessage}</p>
              </div>
            </div>
            {persistenceStatus !== 'store_closed' && persistenceStatus !== 'stock_conflict' && (
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => void handleConfirmOrder()}
                className="inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-[#1A1A1A] px-3.5 py-1.5 font-display text-[11px] font-bold uppercase text-white hover:border-[#FF8A00] hover:text-[#FF8A00] transition-colors cursor-pointer disabled:opacity-60"
              >
                <RefreshCw className="h-3.5 w-3.5 text-[#FF8A00]" />
                <span>Tentar novamente</span>
              </button>
            )}
          </div>
        )}

      <p className="text-xs text-[#8A8A8A] leading-relaxed">{storeSettings.orderDisclaimer}</p>
    </div>
  );
};
