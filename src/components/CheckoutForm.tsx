import React from 'react';
import { ANGOLA_PROVINCES } from '../config/store';
import type {
  CheckoutValidationErrors,
  CustomerCheckoutData,
  DeliveryFeeRule,
} from '../types/store';
import { getDeliveryRuleLabel } from '../utils/checkout';
import { formatKz } from '../utils/format';

interface CheckoutFormProps {
  values: CustomerCheckoutData;
  errors: CheckoutValidationErrors;
  onChange: (field: keyof CustomerCheckoutData, value: string) => void;
  deliveryZones?: readonly DeliveryFeeRule[];
  onSelectDeliveryZone?: (zoneLabel: string, matchedRule?: DeliveryFeeRule) => void;
  disabled?: boolean;
}

export const CheckoutForm: React.FC<CheckoutFormProps> = ({
  values,
  errors,
  onChange,
  deliveryZones = [],
  onSelectDeliveryZone,
  disabled = false,
}) => {
  const inputBase =
    'w-full min-h-[48px] rounded-xl bg-[#0A0A0A] border px-4 py-3 text-base text-white placeholder:text-[#8A8A8A] focus:outline-none transition-colors disabled:opacity-60 disabled:cursor-not-allowed';

  const borderClass = (hasError: boolean) =>
    hasError ? 'border-[#EF4444] focus:border-[#EF4444]' : 'border-white/15 focus:border-[#FF8A00]';

  const hasConfiguredZones = deliveryZones.length > 0;

  return (
    <div className="rounded-xl bg-[#1A1A1A] border border-white/10 p-5 sm:p-6">
      <div className="mb-5">
        <h2 className="font-display text-lg sm:text-xl font-bold text-white">
          Dados para entrega
        </h2>
        <p className="mt-1 text-sm text-[#8A8A8A]">
          Indica o teu nome e telefone{hasConfiguredZones ? ' e escolhe a zona de entrega' : ''}{' '}
          para registarmos a tua encomenda. Os campos com{' '}
          <span className="text-[#FF8A00] font-semibold">*</span> são obrigatórios.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Nome completo */}
        <div className="sm:col-span-2">
          <label htmlFor="checkout-fullName" className="block text-sm font-medium text-white mb-1.5">
            Nome completo <span className="text-[#FF8A00]">*</span>
          </label>
          <input
            id="checkout-fullName"
            name="fullName"
            type="text"
            autoComplete="name"
            disabled={disabled}
            value={values.fullName}
            onChange={(e) => onChange('fullName', e.target.value)}
            placeholder="Ex.: João Manuel Baptista"
            aria-required="true"
            aria-invalid={Boolean(errors.fullName)}
            aria-describedby={errors.fullName ? 'error-fullName' : undefined}
            className={`${inputBase} ${borderClass(Boolean(errors.fullName))}`}
          />
          {errors.fullName && (
            <p id="error-fullName" role="alert" className="mt-1.5 text-xs font-medium text-[#EF4444]">
              {errors.fullName}
            </p>
          )}
        </div>

        {/* Telefone */}
        <div>
          <label htmlFor="checkout-phone" className="block text-sm font-medium text-white mb-1.5">
            Número de telefone <span className="text-[#FF8A00]">*</span>
          </label>
          <input
            id="checkout-phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            disabled={disabled}
            value={values.phone}
            onChange={(e) => onChange('phone', e.target.value)}
            placeholder="Ex.: 923 000 000"
            aria-required="true"
            aria-invalid={Boolean(errors.phone)}
            aria-describedby={errors.phone ? 'error-phone' : undefined}
            className={`${inputBase} ${borderClass(Boolean(errors.phone))}`}
          />
          {errors.phone && (
            <p id="error-phone" role="alert" className="mt-1.5 text-xs font-medium text-[#EF4444]">
              {errors.phone}
            </p>
          )}
        </div>

        {/* E-mail opcional */}
        <div>
          <label htmlFor="checkout-email" className="block text-sm font-medium text-white mb-1.5">
            E-mail <span className="text-xs font-normal text-[#8A8A8A]">(opcional)</span>
          </label>
          <input
            id="checkout-email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            disabled={disabled}
            value={values.email ?? ''}
            onChange={(e) => onChange('email', e.target.value)}
            placeholder="Ex.: cliente@exemplo.com"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? 'error-email' : undefined}
            className={`${inputBase} ${borderClass(Boolean(errors.email))}`}
          />
          {errors.email && (
            <p id="error-email" role="alert" className="mt-1.5 text-xs font-medium text-[#EF4444]">
              {errors.email}
            </p>
          )}
        </div>

        {/* Zona de entrega configurada no Painel (quando existirem zonas em store_settings) */}
        {hasConfiguredZones && (
          <div className="sm:col-span-2">
            <label
              htmlFor="checkout-deliveryZone"
              className="block text-sm font-medium text-white mb-1.5"
            >
              Zona de entrega <span className="text-[#FF8A00]">*</span>
            </label>
            <select
              id="checkout-deliveryZone"
              name="deliveryZone"
              disabled={disabled}
              value={values.deliveryZone ?? ''}
              onChange={(e) => {
                const chosen = e.target.value;
                const matched = deliveryZones.find(
                  (rule) => getDeliveryRuleLabel(rule) === chosen
                );
                if (onSelectDeliveryZone) {
                  onSelectDeliveryZone(chosen, matched);
                } else {
                  onChange('deliveryZone', chosen);
                }
              }}
              aria-required="true"
              aria-invalid={Boolean(errors.deliveryZone)}
              aria-describedby={errors.deliveryZone ? 'error-deliveryZone' : undefined}
              className={`${inputBase} ${borderClass(Boolean(errors.deliveryZone))}`}
            >
              <option value="">Seleciona a zona de entrega</option>
              {deliveryZones.map((rule, idx) => {
                const label = getDeliveryRuleLabel(rule);
                const feeText = rule.feeKz === 0 ? 'Grátis' : formatKz(rule.feeKz);
                return (
                  <option
                    key={`zone-opt-${idx}-${label}`}
                    value={label}
                    className="bg-[#0A0A0A] text-white"
                  >
                    {label} — {feeText}
                  </option>
                );
              })}
            </select>
            {errors.deliveryZone && (
              <p
                id="error-deliveryZone"
                role="alert"
                className="mt-1.5 text-xs font-medium text-[#EF4444]"
              >
                {errors.deliveryZone}
              </p>
            )}
          </div>
        )}

        {/* Província (opcional) */}
        <div>
          <label htmlFor="checkout-province" className="block text-sm font-medium text-white mb-1.5">
            Província <span className="text-xs font-normal text-[#8A8A8A]">(opcional)</span>
          </label>
          <select
            id="checkout-province"
            name="province"
            disabled={disabled}
            value={values.province}
            onChange={(e) => onChange('province', e.target.value)}
            aria-invalid={Boolean(errors.province)}
            aria-describedby={errors.province ? 'error-province' : undefined}
            className={`${inputBase} ${borderClass(Boolean(errors.province))}`}
          >
            <option value="">Seleciona a província</option>
            {ANGOLA_PROVINCES.map((prov) => (
              <option key={prov} value={prov} className="bg-[#0A0A0A] text-white">
                {prov}
              </option>
            ))}
          </select>
          {errors.province && (
            <p id="error-province" role="alert" className="mt-1.5 text-xs font-medium text-[#EF4444]">
              {errors.province}
            </p>
          )}
        </div>

        {/* Município (opcional) */}
        <div>
          <label htmlFor="checkout-municipality" className="block text-sm font-medium text-white mb-1.5">
            Município <span className="text-xs font-normal text-[#8A8A8A]">(opcional)</span>
          </label>
          <input
            id="checkout-municipality"
            name="municipality"
            type="text"
            disabled={disabled}
            value={values.municipality}
            onChange={(e) => onChange('municipality', e.target.value)}
            placeholder="Ex.: Belas, Viana, Maianga..."
            aria-invalid={Boolean(errors.municipality)}
            aria-describedby={errors.municipality ? 'error-municipality' : undefined}
            className={`${inputBase} ${borderClass(Boolean(errors.municipality))}`}
          />
          {errors.municipality && (
            <p id="error-municipality" role="alert" className="mt-1.5 text-xs font-medium text-[#EF4444]">
              {errors.municipality}
            </p>
          )}
        </div>

        {/* Bairro (opcional) */}
        <div className="sm:col-span-2">
          <label htmlFor="checkout-neighborhood" className="block text-sm font-medium text-white mb-1.5">
            Bairro <span className="text-xs font-normal text-[#8A8A8A]">(opcional)</span>
          </label>
          <input
            id="checkout-neighborhood"
            name="neighborhood"
            type="text"
            disabled={disabled}
            value={values.neighborhood}
            onChange={(e) => onChange('neighborhood', e.target.value)}
            placeholder="Ex.: Talatona, Alvalade, Benfica..."
            aria-invalid={Boolean(errors.neighborhood)}
            aria-describedby={errors.neighborhood ? 'error-neighborhood' : undefined}
            className={`${inputBase} ${borderClass(Boolean(errors.neighborhood))}`}
          />
          {errors.neighborhood && (
            <p id="error-neighborhood" role="alert" className="mt-1.5 text-xs font-medium text-[#EF4444]">
              {errors.neighborhood}
            </p>
          )}
        </div>

        {/* Endereço ou referência (opcional) */}
        <div className="sm:col-span-2">
          <label htmlFor="checkout-addressReference" className="block text-sm font-medium text-white mb-1.5">
            Endereço ou referência de entrega{' '}
            <span className="text-xs font-normal text-[#8A8A8A]">(opcional)</span>
          </label>
          <input
            id="checkout-addressReference"
            name="addressReference"
            type="text"
            disabled={disabled}
            value={values.addressReference}
            onChange={(e) => onChange('addressReference', e.target.value)}
            placeholder="Ex.: Rua principal, perto da farmácia / bombas de combustível..."
            aria-invalid={Boolean(errors.addressReference)}
            aria-describedby={errors.addressReference ? 'error-addressReference' : undefined}
            className={`${inputBase} ${borderClass(Boolean(errors.addressReference))}`}
          />
          {errors.addressReference && (
            <p
              id="error-addressReference"
              role="alert"
              className="mt-1.5 text-xs font-medium text-[#EF4444]"
            >
              {errors.addressReference}
            </p>
          )}
        </div>

        {/* Observações opcionais */}
        <div className="sm:col-span-2">
          <label htmlFor="checkout-notes" className="block text-sm font-medium text-white mb-1.5">
            Observações <span className="text-xs font-normal text-[#8A8A8A]">(opcional)</span>
          </label>
          <textarea
            id="checkout-notes"
            name="notes"
            rows={3}
            disabled={disabled}
            value={values.notes}
            onChange={(e) => onChange('notes', e.target.value)}
            placeholder="Horário preferencial de entrega ou outras indicações úteis..."
            className="w-full rounded-xl bg-[#0A0A0A] border border-white/15 px-4 py-3 text-base text-white placeholder:text-[#8A8A8A] focus:border-[#FF8A00] focus:outline-none transition-colors resize-y disabled:opacity-60 disabled:cursor-not-allowed"
          />
        </div>
      </div>
    </div>
  );
};
