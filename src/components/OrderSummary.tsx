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
    Boolean(customer.province.trim()) ||
    Boolean(customer.municipality.trim());

  const freeThreshold = storeSettings.freeDeliveryThresholdKz;

  return (
    <div className="rounded-xl bg-[#1A1A1A] border border-white/10 p-5 sm:p-6">
      <h2 className="font-display text-lg sm:text-xl font-bold text-white">
        Resumo da encomenda
      </h2>

      {/* Lista de produtos */}
      <ul className="mt-4 divide-y divide-white/10">
        {summary.lines.map((line) => (
          <li key={line.product.id} className="py-3 flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-white leading-snug">{line.product.name}</p>
              <p className="mt-0.5 text-xs text-[#8A8A8A] tabular-nums">
                {line.quantity} × {formatKz(line.product.price)}
              </p>
            </div>
            <span className="font-display text-sm font-bold text-white tabular-nums shrink-0">
              {formatKz(line.lineSubtotal)}
            </span>
          </li>
        ))}
      </ul>

      {/* Totais */}
      <dl className="mt-4 space-y-2.5 border-t border-white/10 pt-4 text-sm">
        <div className="flex items-center justify-between gap-2">
          <dt className="text-[#8A8A8A]">
            Subtotal ({summary.totalItemsCount}{' '}
            {summary.totalItemsCount === 1 ? 'artigo' : 'artigos'})
          </dt>
          <dd className="font-display font-bold text-white tabular-nums">
            {formatKz(summary.productsSubtotalKz)}
          </dd>
        </div>

        <div className="flex items-center justify-between gap-2">
          <dt className="text-[#8A8A8A]">Taxa de entrega</dt>
          <dd className="font-medium text-white tabular-nums text-right">
            {summary.delivery.label}
            {summary.delivery.estimatedTime ? ` · ${summary.delivery.estimatedTime}` : ''}
          </dd>
        </div>

        {freeThreshold !== null &&
          freeThreshold > 0 &&
          summary.productsSubtotalKz < freeThreshold && (
            <p className="text-xs text-[#FFC400] tabular-nums">
              Faltam {formatKz(freeThreshold - summary.productsSubtotalKz)} para usufruíres de
              entrega gratuita.
            </p>
          )}

        <div className="flex items-baseline justify-between gap-2 border-t border-white/10 pt-3">
          <dt className="font-display text-base font-bold text-white">Total estimado</dt>
          <dd className="font-display text-lg font-extrabold text-[#FFC400] tabular-nums text-right">
            {summary.estimatedTotalKz !== null
              ? formatKz(summary.estimatedTotalKz)
              : formatKz(summary.productsSubtotalKz)}
          </dd>
        </div>
        {summary.estimatedTotalKz === null && (
          <p className="text-xs text-[#8A8A8A] text-right">
            Acresce taxa de entrega a confirmar pela loja conforme a localização.
          </p>
        )}
      </dl>

      {/* Dados de entrega preenchidos pelo cliente */}
      {hasDeliveryAddress && (
        <div className="mt-5 border-t border-white/10 pt-4">
          <h3 className="font-display text-xs font-bold uppercase tracking-wider text-[#FF8A00]">
            Dados de entrega indicados
          </h3>
          <div className="mt-2 space-y-1 text-xs text-white/85">
            {customer.fullName.trim() && (
              <p>
                <span className="text-[#8A8A8A]">Cliente:</span> {customer.fullName.trim()}
                {customer.phone.trim() ? ` · ${customer.phone.trim()}` : ''}
              </p>
            )}
            {(customer.email ?? '').trim() && (
              <p>
                <span className="text-[#8A8A8A]">E-mail:</span> {(customer.email ?? '').trim()}
              </p>
            )}
            {(customer.province.trim() ||
              customer.municipality.trim() ||
              customer.neighborhood.trim()) && (
              <p>
                <span className="text-[#8A8A8A]">Zona:</span>{' '}
                {[
                  customer.neighborhood.trim(),
                  customer.municipality.trim(),
                  customer.province.trim(),
                ]
                  .filter(Boolean)
                  .join(', ')}
              </p>
            )}
            {customer.addressReference.trim() && (
              <p>
                <span className="text-[#8A8A8A]">Referência:</span>{' '}
                {customer.addressReference.trim()}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
