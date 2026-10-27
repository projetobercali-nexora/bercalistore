import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Lock, ShoppingBag } from 'lucide-react';
import { CheckoutForm } from '../components/CheckoutForm';
import { OrderSummary } from '../components/OrderSummary';
import { SpeedLinesDivider } from '../components/SpeedLinesDivider';
import { WhatsAppCheckoutButton } from '../components/WhatsAppCheckoutButton';
import { STORE_CONFIG } from '../config/store';
import { useCart } from '../context/CartContext';
import { useCatalog } from '../context/CatalogContext';
import type { CheckoutValidationErrors, CustomerCheckoutData } from '../types/store';
import { calculateOrderSummary, validateCheckoutForm } from '../utils/checkout';

const INITIAL_CUSTOMER: CustomerCheckoutData = {
  fullName: '',
  phone: '',
  email: '',
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
  const { lines, clearCart } = useCart();
  const { deliveryFeeRules, storeSettings, isStoreActive } = useCatalog();
  const [customer, setCustomer] = useState<CustomerCheckoutData>(INITIAL_CUSTOMER);
  const [touchedSubmit, setTouchedSubmit] = useState(false);
  const [cartClearedByUser, setCartClearedByUser] = useState(false);
  const [lastOrderNumber, setLastOrderNumber] = useState<string | null>(null);

  const brandName = storeSettings.brandName || STORE_CONFIG.brandName;

  const errors: CheckoutValidationErrors = useMemo(
    () => (touchedSubmit ? validateCheckoutForm(customer) : {}),
    [customer, touchedSubmit]
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
        }
      ),
    [
      lines,
      customer.province,
      customer.municipality,
      customer.neighborhood,
      deliveryFeeRules,
      storeSettings.freeDeliveryThresholdKz,
      storeSettings.defaultDeliveryFeeKz,
    ]
  );

  const handleFieldChange = (field: keyof CustomerCheckoutData, value: string) => {
    setCustomer((prev) => ({ ...prev, [field]: value }));
  };

  const handleValidationFail = () => {
    setTouchedSubmit(true);
    const currentErrors = validateCheckoutForm(customer);
    const firstField = FIELD_ORDER.find((field) => Boolean(currentErrors[field]));
    if (firstField) {
      const el = document.getElementById(`checkout-${firstField}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.focus();
      }
    }
  };

  const handleConfirmClearCart = (orderNumber?: string) => {
    if (orderNumber) {
      setLastOrderNumber(orderNumber);
    }
    clearCart();
    setCartClearedByUser(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (cartClearedByUser) {
    return (
      <div className="mx-auto max-w-2xl px-4 sm:px-6 py-12 sm:py-16">
        <div className="rounded-xl bg-[#1A1A1A] border border-white/10 p-6 sm:p-8 text-center space-y-4">
          <CheckCircle2 className="mx-auto h-12 w-12 text-[#22C55E]" aria-hidden="true" />
          <h1 className="font-display text-2xl font-extrabold text-white">
            Carrinho limpo por tua indicação
          </h1>
          {lastOrderNumber && (
            <p className="font-display text-sm font-bold text-[#FFC400] tabular-nums">
              Referência do pedido: {lastOrderNumber}
            </p>
          )}
          <p className="text-sm text-[#8A8A8A] leading-relaxed">
            Lembra-te de concluir o envio da mensagem na conversa do WhatsApp. A equipa da{' '}
            {brandName} responderá para confirmar a disponibilidade dos produtos, o valor final e os
            detalhes da entrega.
          </p>
          <div className="pt-2">
            <Link
              to="/"
              className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-bercali-gradient px-6 py-3 font-display text-sm font-extrabold uppercase text-[#0A0A0A]"
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
          Finalizar encomenda pelo WhatsApp
        </h1>
        <p className="mt-1 text-sm text-[#8A8A8A]">
          Confirma os teus dados de entrega e revê o resumo antes de abrires o WhatsApp.
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
          Preenche corretamente todos os campos obrigatórios assinalados antes de registar a
          encomenda.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        <div className="lg:col-span-7">
          <CheckoutForm
            values={customer}
            errors={errors}
            onChange={handleFieldChange}
            disabled={!isStoreActive}
          />
        </div>

        <div className="lg:col-span-5 space-y-5">
          <OrderSummary summary={summary} customer={customer} />
          <WhatsAppCheckoutButton
            customer={customer}
            summary={summary}
            onValidationFail={handleValidationFail}
            onConfirmClearCart={handleConfirmClearCart}
          />
        </div>
      </div>
    </div>
  );
};
