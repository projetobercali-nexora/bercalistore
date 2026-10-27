import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { SpeedLinesDivider } from '../components/SpeedLinesDivider';
import { STORE_CONFIG } from '../config/store';
import { useCatalog } from '../context/CatalogContext';

interface LegalPageProps {
  mode: 'privacy' | 'terms';
}

export const LegalPage: React.FC<LegalPageProps> = ({ mode }) => {
  const { storeSettings } = useCatalog();
  const brandName = storeSettings.brandName || STORE_CONFIG.brandName;

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-6">
      <Link
        to="/"
        className="inline-flex min-h-[44px] items-center gap-2 text-sm font-medium text-[#8A8A8A] hover:text-[#FF8A00] transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Voltar ao início</span>
      </Link>

      <div>
        <SpeedLinesDivider className="mb-2.5" />
        <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
          {mode === 'privacy' ? 'Política de Privacidade' : 'Termos de Utilização'}
        </h1>
      </div>

      {mode === 'privacy' ? (
        <div className="rounded-xl bg-[#1A1A1A] border border-white/10 p-6 sm:p-8 space-y-4 text-sm text-[#8A8A8A] leading-relaxed">
          <p>
            A <strong className="text-white">{brandName}</strong> respeita a tua privacidade e
            recolhe apenas os dados estritamente necessários para processar, preparar e entregar a
            tua encomenda.
          </p>
          <h2 className="font-display text-base font-bold text-white pt-2">
            1. Carrinho de compras local
          </h2>
          <p>
            Os artigos selecionados antes da finalização são guardados no armazenamento local (
            <code className="text-white">localStorage</code>) do teu próprio dispositivo para tua
            comodidade e podem ser removidos a qualquer momento limpando o carrinho ou os dados do
            navegador.
          </p>
          <h2 className="font-display text-base font-bold text-white pt-2">
            2. Registo e proteção dos dados de encomenda
          </h2>
          <p>
            Quando submetes uma encomenda, o teu nome, contacto, morada de entrega e artigos
            selecionados são registados de forma segura no sistema de gestão de encomendas da{' '}
            <strong className="text-white">{brandName}</strong> exclusivamente para processamento e
            entrega do pedido, além de formatarem a mensagem de confirmação pelo WhatsApp. As
            encomendas e os dados pessoais nunca ficam acessíveis a outros visitantes da loja.
          </p>
          <h2 className="font-display text-base font-bold text-white pt-2">
            3. Segurança e informações sensíveis
          </h2>
          <p>
            Nunca solicitamos palavras-passe bancárias nem dados de cartões de crédito através deste
            site.
          </p>
          {(storeSettings.email || storeSettings.phone) && (
            <p className="pt-2 border-t border-white/10 text-xs">
              Contacto oficial:{' '}
              {storeSettings.email && (
                <a
                  href={`mailto:${storeSettings.email}`}
                  className="text-white hover:text-[#FF8A00] transition-colors"
                >
                  {storeSettings.email}
                </a>
              )}
              {storeSettings.email && storeSettings.phone ? ' · ' : ''}
              {storeSettings.phone && <span className="text-white">{storeSettings.phone}</span>}
            </p>
          )}
        </div>
      ) : (
        <div className="rounded-xl bg-[#1A1A1A] border border-white/10 p-6 sm:p-8 space-y-4 text-sm text-[#8A8A8A] leading-relaxed">
          <p>
            Ao navegares e realizares encomendas na loja virtual da{' '}
            <strong className="text-white">{brandName}</strong>, concordas com os seguintes termos
            transparentes de funcionamento:
          </p>
          <h2 className="font-display text-base font-bold text-white pt-2">
            1. Confirmação das encomendas
          </h2>
          <p>{storeSettings.orderDisclaimer}</p>
          <h2 className="font-display text-base font-bold text-white pt-2">
            2. Preços em Kwanzas (Kz), stock e entrega
          </h2>
          <p>
            Os preços apresentados encontram-se expressos em Kwanzas angolanos (Kz) e são validados
            no momento do registo da encomenda de acordo com o catálogo oficial em vigor.{' '}
            {storeSettings.deliveryInfo}
          </p>
          <h2 className="font-display text-base font-bold text-white pt-2">
            3. Modalidades de pagamento
          </h2>
          <p>{storeSettings.paymentInfo}</p>
        </div>
      )}
    </div>
  );
};
