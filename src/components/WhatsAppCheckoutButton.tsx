import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Lock,
  MessageCircle,
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
  hasValidationErrors,
  validateCheckoutForm,
} from '../utils/checkout';
import { PUBLIC_MESSAGES } from '../utils/publicMessages';
import { generateOrderNumber } from '../utils/supabaseMapper';

export interface ConfirmedOrderResult {
  orderNumber: string;
  whatsappUrl: string;
  whatsappMessage: string;
  summary: OrderSummaryCalculation;
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
    hasWhatsApp,
    deliveryFeeRules,
    storeSettings,
    isStoreActive,
    refreshCatalog,
  } = useCatalog();
  const [orderNumber, setOrderNumber] = useState<string>(() => generateOrderNumber());
  const [showMessagePreview, setShowMessagePreview] = useState(false);
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
  const errors = validateCheckoutForm(customer, {
    mode: 'storefront',
    deliveryZones: deliveryFeeRules,
  });
  const isFormValid = !hasValidationErrors(errors) && effectiveSummary.lines.length > 0;
  const isSubmitting = persistenceStatus === 'saving';

  const preparedMessage = buildWhatsAppOrderMessage(
    customer,
    effectiveSummary,
    orderNumber,
    brandName,
    orderTemplate
  );

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

      const finalOrderNumber = res.orderNumber || orderNumber;
      const finalSummary = res.verifiedSummary ?? summary;
      const finalMessage = buildWhatsAppOrderMessage(
        customer,
        finalSummary,
        finalOrderNumber,
        brandName,
        orderTemplate
      );
      const finalWhatsappUrl = hasWhatsApp ? buildWhatsAppUrl(whatsappNumber, finalMessage) : '';

      savedSignatureRef.current = payloadSignature;
      setOrderNumber(finalOrderNumber);
      setPersistenceStatus('saved');
      setPersistenceMessage(`Encomenda ${finalOrderNumber} registada com sucesso na ${brandName}.`);

      if (onOrderConfirmed) {
        onOrderConfirmed({
          orderNumber: finalOrderNumber,
          whatsappUrl: finalWhatsappUrl,
          whatsappMessage: finalMessage,
          summary: finalSummary,
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
    hasWhatsApp,
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
    storeSettings.closedMessage,
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

  return (
    <div className="space-y-3">
      <button
        type="button"
        disabled={isSubmitting}
        onClick={() => void handleConfirmOrder()}
        className="flex min-h-[52px] w-full items-center justify-center gap-2.5 rounded-xl bg-bercali-gradient px-5 py-3.5 font-display text-sm sm:text-base font-extrabold uppercase tracking-wide text-[#0A0A0A] shadow-lg transition-transform active:scale-[0.99] cursor-pointer disabled:opacity-60 disabled:cursor-wait"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="h-5 w-5 shrink-0 animate-spin" />
            <span>A registar encomenda...</span>
          </>
        ) : hasWhatsApp ? (
          <>
            <MessageCircle className="h-5 w-5 shrink-0" />
            <span>Confirmar pedido pelo WhatsApp</span>
          </>
        ) : (
          <>
            <ShoppingBag className="h-5 w-5 shrink-0" />
            <span>Confirmar pedido</span>
          </>
        )}
      </button>

      {isFormValid && !isSubmitting && (
        <button
          type="button"
          onClick={() => setShowMessagePreview((prev) => !prev)}
          aria-expanded={showMessagePreview}
          className="inline-flex min-h-[42px] w-full items-center justify-center rounded-xl border border-white/15 bg-[#0A0A0A] px-4 py-2 text-xs font-medium text-[#8A8A8A] hover:text-white transition-colors cursor-pointer"
        >
          {showMessagePreview ? 'Ocultar resumo da mensagem' : 'Ver resumo preparado'}
        </button>
      )}

      {isSubmitting && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-2.5 rounded-xl bg-[#0A0A0A] border border-white/15 p-3.5 text-xs text-white/90"
        >
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#FF8A00]" />
          <span>A registar a tua encomenda antes de abrir a confirmação...</span>
        </div>
      )}

      {persistenceStatus === 'saved' && persistenceMessage && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-start gap-2.5 rounded-xl bg-[#0A0A0A] border border-[#22C55E]/40 p-3.5 text-xs text-[#22C55E]"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{persistenceMessage}</span>
        </div>
      )}

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

      {showMessagePreview && isFormValid && (
        <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-xl bg-[#0A0A0A] border border-white/10 p-4 font-sans text-xs text-white/90 leading-relaxed">
          {preparedMessage}
        </pre>
      )}

      <p className="text-xs text-[#8A8A8A] leading-relaxed">{storeSettings.orderDisclaimer}</p>
    </div>
  );
};
