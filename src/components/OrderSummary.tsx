import React from 'react';
import { useCatalog } from '../context/CatalogContext';
import type { CustomerCheckoutData, OrderSummaryCalculation } from '../types/store';
import { formatKz } from '../utils/format';

interface OrderSummaryProps {
  summary: OrderSummaryCalculation;
  customer: CustomerCheckoutData;
}

export const OrderSummary: React.FC<OrderSummaryProps> = ({ summary, customer }) => {
  const { storeSettings } = useCatalog();
  const hasDeliveryAddress =
    Boolean(customer.fullName.trim()) ||
    Boolean((customer.deliveryZone ?? '').trim()) ||
    Boolean(customer.province.trim()) ||
    Boolean(customer.municipality.trim());

  const freeThreshold = storeSettings.freeDeliveryThresholdKz;

  return (
    <div className="rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-[var(--shadow-card)] p-5 sm:p-6">
      <h2 className="font-display text-lg sm:text-xl font-bold text-[var(--text-primary)]">
        Resumo da encomenda
      </h2>

      {/* Lista de produtos */}
      <ul className="mt-4 divide-y divide-[var(--border-subtle)]">
        {summary.lines.map((line) => (
          <li key={line.product.id} className="py-3 flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-[var(--text-primary)] leading-snug">
                {line.product.name}
              </p>
              <p className="mt-0.5 text-xs text-[var(--text-secondary)] tabular-nums">
                {line.quantity} × {formatKz(line.product.price)}
              </p>
            </div>
            <span className="font-display text-sm font-bold text-[var(--text-primary)] tabular-nums shrink-0">
              {formatKz(line.lineSubtotal)}
            </span>
          </li>
        ))}
      </ul>

      {/* Totais */}
      <dl className="mt-4 space-y-2.5 border-t border-[var(--border-subtle)] pt-4 text-sm">
        <div className="flex items-center justify-between gap-2">
          <dt className="text-[var(--text-secondary)]">
            Subtotal ({summary.totalItemsCount}{' '}
            {summary.totalItemsCount === 1 ? 'artigo' : 'artigos'})
          </dt>
          <dd className="font-display font-bold text-[var(--text-primary)] tabular-nums">
            {formatKz(summary.productsSubtotalKz)}
          </dd>
        </div>

        <div className="flex items-center justify-between gap-2">
          <dt className="text-[var(--text-secondary)]">Taxa de entrega</dt>
          <dd className="font-medium text-[var(--text-primary)] tabular-nums text-right">
            {summary.delivery.label}
          </dd>
        </div>

        {summary.delivery.estimatedTime && (
          <div className="flex items-center justify-between gap-2">
            <dt className="text-[var(--text-secondary)]">Prazo de entrega</dt>
            <dd className="font-medium text-[var(--text-primary)] text-right">
              {summary.delivery.estimatedTime}
            </dd>
          </div>
        )}

        {freeThreshold !== null &&
          freeThreshold > 0 &&
          summary.productsSubtotalKz < freeThreshold && (
            <p className="text-xs font-medium text-[var(--brand-orange-text)] tabular-nums">
              Faltam {formatKz(freeThreshold - summary.productsSubtotalKz)} para usufruíres de
              entrega gratuita.
            </p>
          )}

        <div className="flex items-baseline justify-between gap-2 border-t border-[var(--border-subtle)] pt-3">
          <dt className="font-display text-base font-bold text-[var(--text-primary)]">
            Total estimado
          </dt>
          <dd className="font-display text-lg font-extrabold text-[var(--text-primary)] tabular-nums text-right">
            {summary.estimatedTotalKz !== null
              ? formatKz(summary.estimatedTotalKz)
              : formatKz(summary.productsSubtotalKz)}
          </dd>
        </div>
        {summary.estimatedTotalKz === null && (
          <p className="text-xs text-[var(--text-secondary)] text-right">
            Acresce taxa de entrega a confirmar pela loja conforme a localização.
          </p>
        )}
      </dl>

      {/* Dados de entrega preenchidos pelo cliente */}
      {hasDeliveryAddress && (
        <div className="mt-5 border-t border-[var(--border-subtle)] pt-4">
          <h3 className="font-display text-xs font-bold uppercase tracking-wider text-[var(--brand-orange-text)]">
            Dados de entrega indicados
          </h3>
          <div className="mt-2 space-y-1 text-xs text-[var(--text-primary)]">
            {customer.fullName.trim() && (
              <p>
                <span className="text-[var(--text-secondary)]">Cliente:</span>{' '}
                {customer.fullName.trim()}
                {customer.phone.trim() ? ` · ${customer.phone.trim()}` : ''}
              </p>
            )}
            {(customer.email ?? '').trim() && (
              <p>
                <span className="text-[var(--text-secondary)]">E-mail:</span>{' '}
                {(customer.email ?? '').trim()}
              </p>
            )}
            {((customer.deliveryZone ?? '').trim() ||
              customer.province.trim() ||
              customer.municipality.trim() ||
              customer.neighborhood.trim()) && (
              <p>
                <span className="text-[var(--text-secondary)]">Zona:</span>{' '}
                {[
                  customer.neighborhood.trim(),
                  customer.municipality.trim(),
                  customer.province.trim() || (customer.deliveryZone ?? '').trim(),
                ]
                  .filter(Boolean)
                  .join(', ')}
              </p>
            )}
            {customer.addressReference.trim() && (
              <p>
                <span className="text-[var(--text-secondary)]">Referência:</span>{' '}
                {customer.addressReference.trim()}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
