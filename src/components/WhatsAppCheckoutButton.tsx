import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Loader2,
  Lock,
  MessageCircle,
  RefreshCw,
  Trash2,
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
  isValidWhatsAppNumber,
  validateCheckoutForm,
} from '../utils/checkout';
import { generateOrderNumber } from '../utils/supabaseMapper';

interface WhatsAppCheckoutButtonProps {
  customer: CustomerCheckoutData;
  summary: OrderSummaryCalculation;
  onValidationFail: () => void;
  onConfirmClearCart: (orderNumber?: string) => void;
}

export const WhatsAppCheckoutButton: React.FC<WhatsAppCheckoutButtonProps> = ({
  customer,
  summary,
  onValidationFail,
  onConfirmClearCart,
}) => {
  const { whatsappNumber, storeSettings, isStoreActive, refreshCatalog } = useCatalog();
  const [orderNumber, setOrderNumber] = useState<string>(() => generateOrderNumber());
  const [whatsappStepStarted, setWhatsappStepStarted] = useState(false);
  const [copied, setCopied] = useState(false);
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
      customer.province.trim(),
      customer.municipality.trim(),
      customer.neighborhood.trim(),
      customer.addressReference.trim(),
      customer.notes.trim(),
      itemsKey,
    ].join('::');
  }, [customer, summary.lines]);

  // Se o cliente alterar os dados ou os artigos após já ter gravado uma encomenda, prepara um novo número de pedido
  useEffect(() => {
    setVerifiedSummary(null);
    if (savedSignatureRef.current && savedSignatureRef.current !== payloadSignature) {
      savedSignatureRef.current = null;
      setOrderNumber(generateOrderNumber());
      setPersistenceStatus('idle');
      setPersistenceMessage(null);
    }
  }, [payloadSignature]);

  const brandName = storeSettings.brandName || STORE_CONFIG.brandName;
  const effectiveSummary = verifiedSummary ?? summary;
  const errors = validateCheckoutForm(customer);
  const isFormValid = !hasValidationErrors(errors) && effectiveSummary.lines.length > 0;
  const numberConfigured = isValidWhatsAppNumber(whatsappNumber);

  const preparedMessage = buildWhatsAppOrderMessage(
    customer,
    effectiveSummary,
    orderNumber,
    brandName
  );
  const whatsappUrl = buildWhatsAppUrl(whatsappNumber, preparedMessage);

  const persistOrderIfNeeded = useCallback(async (): Promise<boolean> => {
    if (!isStoreActive) {
      setPersistenceStatus('store_closed');
      setPersistenceMessage(storeSettings.closedMessage);
      return false;
    }

    if (!isFormValid) return false;
    if (savedSignatureRef.current === payloadSignature) return true;
    if (inFlightRef.current) return false;

    inFlightRef.current = true;
    setPersistenceStatus('saving');
    setPersistenceMessage(null);

    const res = await submitOrderToSupabase(customer, summary, orderNumber);
    inFlightRef.current = false;

    if (res.verifiedSummary) {
      setVerifiedSummary(res.verifiedSummary);
    }

    if (res.ok) {
      savedSignatureRef.current = payloadSignature;
      setPersistenceStatus('saved');
      setPersistenceMessage(`Encomenda ${res.orderNumber} registada no sistema da ${brandName}.`);
      return true;
    }

    setPersistenceStatus(res.status);
    setPersistenceMessage(
      res.errorMessage ?? 'Não foi possível guardar automaticamente o pedido na base de dados.'
    );

    if (res.status === 'store_closed' || res.status === 'stock_conflict') {
      void refreshCatalog({ silent: true });
      return false;
    }

    return true;
  }, [
    brandName,
    customer,
    isFormValid,
    isStoreActive,
    orderNumber,
    payloadSignature,
    refreshCatalog,
    storeSettings.closedMessage,
    summary,
  ]);

  const handleCopyMessage = async () => {
    if (!isStoreActive) return;
    const allowed = await persistOrderIfNeeded();
    if (!allowed) return;

    const msgToCopy = buildWhatsAppOrderMessage(
      customer,
      verifiedSummary ?? summary,
      orderNumber,
      brandName
    );

    try {
      await navigator.clipboard.writeText(msgToCopy);
      setCopied(true);
      setWhatsappStepStarted(true);
      window.setTimeout(() => setCopied(false), 2600);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = msgToCopy;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setWhatsappStepStarted(true);
      window.setTimeout(() => setCopied(false), 2600);
    }
  };

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
      {isFormValid && persistenceStatus !== 'saving' ? (
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => {
            if (inFlightRef.current) {
              e.preventDefault();
              return;
            }
            setWhatsappStepStarted(true);
            void persistOrderIfNeeded();
          }}
          className="flex min-h-[52px] w-full items-center justify-center gap-2.5 rounded-xl bg-bercali-gradient px-5 py-3.5 font-display text-sm sm:text-base font-extrabold uppercase tracking-wide text-[#0A0A0A] shadow-lg transition-transform active:scale-[0.99]"
        >
          <MessageCircle className="h-5 w-5 shrink-0" />
          <span>Enviar pedido pelo WhatsApp</span>
          <ExternalLink className="h-4 w-4 shrink-0" />
        </a>
      ) : (
        <button
          type="button"
          disabled={persistenceStatus === 'saving'}
          onClick={() => {
            if (persistenceStatus !== 'saving') {
              onValidationFail();
            }
          }}
          className="flex min-h-[52px] w-full items-center justify-center gap-2.5 rounded-xl bg-bercali-gradient px-5 py-3.5 font-display text-sm sm:text-base font-extrabold uppercase tracking-wide text-[#0A0A0A] shadow-lg transition-transform active:scale-[0.99] cursor-pointer disabled:opacity-60 disabled:cursor-wait"
        >
          {persistenceStatus === 'saving' ? (
            <>
              <Loader2 className="h-5 w-5 shrink-0 animate-spin" />
              <span>A validar e registar pedido...</span>
            </>
          ) : (
            <>
              <MessageCircle className="h-5 w-5 shrink-0" />
              <span>Enviar pedido pelo WhatsApp</span>
            </>
          )}
        </button>
      )}

      {/* Alternativa para copiar a mensagem e registar a encomenda */}
      <div className="flex flex-col sm:flex-row gap-2">
        <button
          type="button"
          disabled={persistenceStatus === 'saving'}
          onClick={() => {
            if (!isFormValid) {
              onValidationFail();
              return;
            }
            void handleCopyMessage();
          }}
          className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border border-white/15 bg-[#0A0A0A] px-4 py-2.5 font-display text-xs font-bold uppercase text-white hover:border-[#FF8A00] hover:text-[#FF8A00] transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {copied ? (
            <>
              <Check className="h-4 w-4 text-[#22C55E]" />
              <span className="text-[#22C55E]">Mensagem copiada</span>
            </>
          ) : (
            <>
              <Copy className="h-4 w-4 text-[#FF8A00]" />
              <span>Copiar mensagem</span>
            </>
          )}
        </button>

        {isFormValid && (
          <button
            type="button"
            onClick={() => setShowMessagePreview((prev) => !prev)}
            aria-expanded={showMessagePreview}
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-white/15 bg-[#0A0A0A] px-4 py-2.5 text-xs font-medium text-[#8A8A8A] hover:text-white transition-colors cursor-pointer"
          >
            {showMessagePreview ? 'Ocultar mensagem' : 'Ver mensagem preparada'}
          </button>
        )}
      </div>

      {/* Estado transparente da gravação no Supabase */}
      {persistenceStatus === 'saving' && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-2.5 rounded-xl bg-[#0A0A0A] border border-white/15 p-3.5 text-xs text-white/90"
        >
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#FF8A00]" />
          <span>A validar preços e registar a encomenda {orderNumber} no sistema...</span>
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

      {(persistenceStatus === 'store_closed' || persistenceStatus === 'stock_conflict') &&
        persistenceMessage && (
          <div
            role="alert"
            className="rounded-xl bg-[#0A0A0A] border border-[#EF4444]/50 p-3.5 space-y-1.5 text-xs text-white/90"
          >
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-[#EF4444] mt-0.5" />
              <p>{persistenceMessage}</p>
            </div>
          </div>
        )}

      {(persistenceStatus === 'rls_blocked' ||
        persistenceStatus === 'error' ||
        persistenceStatus === 'unconfigured') &&
        persistenceMessage && (
          <div
            role="alert"
            className="rounded-xl bg-[#0A0A0A] border border-[#FFC400]/40 p-3.5 space-y-2.5 text-xs text-[#8A8A8A]"
          >
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-[#FFC400] mt-0.5" />
              <div className="space-y-1">
                <p className="text-white/90">{persistenceMessage}</p>
                <p>
                  Podes concluir normalmente o envio da mensagem pelo WhatsApp com o pedido{' '}
                  <strong className="text-white">{orderNumber}</strong>.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void persistOrderIfNeeded()}
              className="inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-[#1A1A1A] px-3.5 py-1.5 font-display text-[11px] font-bold uppercase text-white hover:border-[#FF8A00] hover:text-[#FF8A00] transition-colors cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5 text-[#FF8A00]" />
              <span>Tentar registar novamente</span>
            </button>
          </div>
        )}

      {!numberConfigured && (
        <p className="rounded-lg bg-[#0A0A0A] border border-[#FFC400]/30 p-3 text-xs text-[#8A8A8A] leading-relaxed">
          <strong className="text-[#FFC400]">Nota de contacto:</strong> Assim que o número oficial
          do WhatsApp for definido nas Definições da Loja no Painel Administrativo, este botão
          abrirá diretamente a conversa oficial.
        </p>
      )}

      {showMessagePreview && isFormValid && (
        <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-xl bg-[#0A0A0A] border border-white/10 p-4 font-sans text-xs text-white/90 leading-relaxed">
          {preparedMessage}
        </pre>
      )}

      {/* Confirmação explícita pelo utilizador antes de limpar o carrinho */}
      {whatsappStepStarted &&
        persistenceStatus !== 'store_closed' &&
        persistenceStatus !== 'stock_conflict' && (
          <div className="rounded-xl bg-[#0A0A0A] border border-[#FF8A00]/40 p-4 space-y-3">
            <p className="text-xs text-white/90 leading-relaxed">
              <strong>Importante:</strong> A tua encomenda só é enviada no WhatsApp quando tocares
              em <em>Enviar</em> na conversa, e fica sujeita à confirmação da {brandName}. Não
              existe pagamento online automático neste site.
            </p>
            <button
              type="button"
              onClick={() => onConfirmClearCart(orderNumber)}
              className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg border border-white/20 px-4 py-2 font-display text-xs font-bold uppercase text-white hover:border-[#22C55E] hover:text-[#22C55E] transition-colors cursor-pointer"
            >
              <Trash2 className="h-4 w-4" />
              <span>Já enviei no WhatsApp — Limpar carrinho</span>
            </button>
          </div>
        )}

      <p className="text-xs text-[#8A8A8A] leading-relaxed">{storeSettings.orderDisclaimer}</p>
    </div>
  );
};
