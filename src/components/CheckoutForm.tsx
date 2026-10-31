import React from 'react';
import type {
  CheckoutValidationErrors,
  CustomerCheckoutData,
  DeliveryFeeRule,
} from '../types/store';
import {
  findMatchingDeliveryZone,
  getDeliveryRuleLabel,
  getMunicipalityPlaceholder,
  NO_ACTIVE_DELIVERY_ZONES_MESSAGE,
} from '../utils/checkout';
import { formatKz } from '../utils/format';

interface CheckoutFormProps {
  values: CustomerCheckoutData;
  errors: CheckoutValidationErrors;
  onChange: (field: keyof CustomerCheckoutData, value: string) => void;
  deliveryZones?: readonly DeliveryFeeRule[];
  onSelectDeliveryZone?: (zoneLabel: string, matchedRule?: DeliveryFeeRule) => void;
  loadingZones?: boolean;
  disabled?: boolean;
}

export const CheckoutForm: React.FC<CheckoutFormProps> = ({
  values,
  errors,
  onChange,
  deliveryZones = [],
  onSelectDeliveryZone,
  loadingZones = false,
  disabled = false,
}) => {
  const inputBase =
    'w-full min-h-[48px] rounded-xl bg-[var(--bg-surface)] border px-4 py-3 text-base text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none transition-colors disabled:bg-[var(--bg-subtle)] disabled:opacity-65 disabled:cursor-not-allowed';

  const borderClass = (hasError: boolean) =>
    hasError
      ? 'border-[var(--status-error)] focus:border-[var(--status-error)] focus:ring-2 focus:ring-[#B91C1C]/15'
      : 'border-[var(--border-input)] focus:border-[var(--brand-orange)] focus:ring-2 focus:ring-[#FF8A00]/20';

  const hasConfiguredZones = deliveryZones.length > 0;
  const selectedRule = findMatchingDeliveryZone(deliveryZones, {
    deliveryZoneId: values.deliveryZoneId,
    deliveryZone: values.deliveryZone,
    province: values.province,
  });
  const selectedProvinceOption = selectedRule ? getDeliveryRuleLabel(selectedRule) : '';
  const provinceError = errors.province ?? errors.deliveryZone;
  const municipalityPlaceholder = getMunicipalityPlaceholder(values.province);

  return (
    <div className="rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-[var(--shadow-card)] p-5 sm:p-6">
      <div className="mb-5">
        <h2 className="font-display text-lg sm:text-xl font-bold text-[var(--text-primary)]">
          Dados para entrega
        </h2>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Indica o teu nome, telefone e província de entrega para registarmos a tua encomenda. Os
          campos com <span className="text-[var(--brand-orange-text)] font-semibold">*</span> são
          obrigatórios.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Nome completo */}
        <div className="sm:col-span-2">
          <label
            htmlFor="checkout-fullName"
            className="block text-sm font-medium text-[var(--text-primary)] mb-1.5"
          >
            Nome completo <span className="text-[var(--brand-orange-text)]">*</span>
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
            <p
              id="error-fullName"
              role="alert"
              className="mt-1.5 text-xs font-medium text-[var(--status-error)]"
            >
              {errors.fullName}
            </p>
          )}
        </div>

        {/* Telefone */}
        <div>
          <label
            htmlFor="checkout-phone"
            className="block text-sm font-medium text-[var(--text-primary)] mb-1.5"
          >
            Número de telefone <span className="text-[var(--brand-orange-text)]">*</span>
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
            <p
              id="error-phone"
              role="alert"
              className="mt-1.5 text-xs font-medium text-[var(--status-error)]"
            >
              {errors.phone}
            </p>
          )}
        </div>

        {/* E-mail opcional */}
        <div>
          <label
            htmlFor="checkout-email"
            className="block text-sm font-medium text-[var(--text-primary)] mb-1.5"
          >
            E-mail <span className="text-xs font-normal text-[var(--text-secondary)]">(opcional)</span>
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
            <p
              id="error-email"
              role="alert"
              className="mt-1.5 text-xs font-medium text-[var(--status-error)]"
            >
              {errors.email}
            </p>
          )}
        </div>

        {/* Província de entrega * (apenas zonas ativas da base de dados) */}
        <div>
          <label
            htmlFor="checkout-province"
            className="block text-sm font-medium text-[var(--text-primary)] mb-1.5"
          >
            Província de entrega <span className="text-[var(--brand-orange-text)]">*</span>
          </label>
          <select
            id="checkout-province"
            name="province"
            disabled={disabled || loadingZones || !hasConfiguredZones}
            value={selectedProvinceOption}
            onChange={(e) => {
              const chosen = e.target.value;
              if (!chosen) {
                if (onSelectDeliveryZone) {
                  onSelectDeliveryZone('', undefined);
                } else {
                  onChange('province', '');
                }
                return;
              }
              const matched = deliveryZones.find(
                (rule) => getDeliveryRuleLabel(rule) === chosen
              );
              if (onSelectDeliveryZone) {
                onSelectDeliveryZone(chosen, matched);
              } else {
                onChange('province', matched?.province || chosen);
              }
            }}
            aria-required="true"
            aria-invalid={Boolean(provinceError) || (!loadingZones && !hasConfiguredZones)}
            aria-describedby={
              provinceError || (!loadingZones && !hasConfiguredZones)
                ? 'error-province'
                : undefined
            }
            className={`${inputBase} ${borderClass(
              Boolean(provinceError) || (!loadingZones && !hasConfiguredZones)
            )}`}
          >
            <option value="" className="bg-white text-[#171717]">
              {loadingZones
                ? 'A carregar províncias...'
                : hasConfiguredZones
                ? 'Seleciona a província de entrega'
                : NO_ACTIVE_DELIVERY_ZONES_MESSAGE}
            </option>
            {deliveryZones.map((rule, idx) => {
              const label = getDeliveryRuleLabel(rule);
              const feeText = rule.feeKz === 0 ? 'Grátis' : formatKz(rule.feeKz);
              const etaText = rule.estimatedTime ? ` (${rule.estimatedTime})` : '';
              return (
                <option
                  key={`prov-opt-${rule.id ?? idx}-${label}`}
                  value={label}
                  className="bg-white text-[#171717]"
                >
                  {label} — {feeText}
                  {etaText}
                </option>
              );
            })}
          </select>
          {(provinceError || (!loadingZones && !hasConfiguredZones)) && (
            <p
              id="error-province"
              role="alert"
              className="mt-1.5 text-xs font-medium text-[var(--status-error)]"
            >
              {provinceError ?? NO_ACTIVE_DELIVERY_ZONES_MESSAGE}
            </p>
          )}
        </div>

        {/* Município (opcional) */}
        <div>
          <label
            htmlFor="checkout-municipality"
            className="block text-sm font-medium text-[var(--text-primary)] mb-1.5"
          >
            Município{' '}
            <span className="text-xs font-normal text-[var(--text-secondary)]">(opcional)</span>
          </label>
          <input
            id="checkout-municipality"
            name="municipality"
            type="text"
            disabled={disabled}
            value={values.municipality}
            onChange={(e) => onChange('municipality', e.target.value)}
            placeholder={municipalityPlaceholder}
            aria-invalid={Boolean(errors.municipality)}
            aria-describedby={errors.municipality ? 'error-municipality' : undefined}
            className={`${inputBase} ${borderClass(Boolean(errors.municipality))}`}
          />
          {errors.municipality && (
            <p
              id="error-municipality"
              role="alert"
              className="mt-1.5 text-xs font-medium text-[var(--status-error)]"
            >
              {errors.municipality}
            </p>
          )}
        </div>

        {/* Bairro (opcional) */}
        <div className="sm:col-span-2">
          <label
            htmlFor="checkout-neighborhood"
            className="block text-sm font-medium text-[var(--text-primary)] mb-1.5"
          >
            Bairro{' '}
            <span className="text-xs font-normal text-[var(--text-secondary)]">(opcional)</span>
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
            <p
              id="error-neighborhood"
              role="alert"
              className="mt-1.5 text-xs font-medium text-[var(--status-error)]"
            >
              {errors.neighborhood}
            </p>
          )}
        </div>

        {/* Endereço ou referência (opcional) */}
        <div className="sm:col-span-2">
          <label
            htmlFor="checkout-addressReference"
            className="block text-sm font-medium text-[var(--text-primary)] mb-1.5"
          >
            Endereço ou referência de entrega{' '}
            <span className="text-xs font-normal text-[var(--text-secondary)]">(opcional)</span>
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
              className="mt-1.5 text-xs font-medium text-[var(--status-error)]"
            >
              {errors.addressReference}
            </p>
          )}
        </div>

        {/* Observações opcionais */}
        <div className="sm:col-span-2">
          <label
            htmlFor="checkout-notes"
            className="block text-sm font-medium text-[var(--text-primary)] mb-1.5"
          >
            Observações{' '}
            <span className="text-xs font-normal text-[var(--text-secondary)]">(opcional)</span>
          </label>
          <textarea
            id="checkout-notes"
            name="notes"
            rows={3}
            disabled={disabled}
            value={values.notes}
            onChange={(e) => onChange('notes', e.target.value)}
            placeholder="Horário preferencial de entrega ou outras indicações úteis..."
            className="w-full rounded-xl bg-[var(--bg-surface)] border border-[var(--border-input)] px-4 py-3 text-base text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:border-[var(--brand-orange)] focus:ring-2 focus:ring-[#FF8A00]/20 focus:outline-none transition-colors resize-y disabled:bg-[var(--bg-subtle)] disabled:opacity-65 disabled:cursor-not-allowed"
          />
        </div>
      </div>
    </div>
  );
};
