import type { DeliveryFeeRule } from '../types/store';

/**
 * CONFIGURAÇÃO CENTRAL DO WHATSAPP — BERCALI STORE
 *
 * O número oficial e o modelo de mensagem do WhatsApp são lidos dinamicamente de `store_settings`
 * no Supabase (Painel Administrativo). Nunca colocar números fixos no código.
 */
export const WHATSAPP_NUMBER = '';

/**
 * Caminho estático do logotipo oficial original da Bercali Store.
 * REGRA ABSOLUTA: Nunca alterar, recortar, filtrar ou substituir este ficheiro.
 */
export const BRAND_LOGO_PATH = '/assets/aistudio/file_00000000d4ac8243a4a41ff6e2cc5b63_b707e5fc.png';

export const STORE_CONFIG = {
  brandName: 'Bercali Store',
  shortName: 'Bercali',
  slogan: 'O futuro das compras começa aqui.',
  currencySymbol: 'Kz',
  defaultWhatsappGreeting: 'Olá, Bercali Store! Gostaria de receber informações sobre os vossos produtos.',
  deliveryInfo:
    'A disponibilidade, o prazo e a taxa de entrega são confirmados diretamente pela equipa da Bercali Store no WhatsApp, de acordo com a tua localização.',
  paymentInfo:
    'As opções de pagamento disponíveis são informadas e combinadas diretamente com a loja no momento da confirmação da encomenda pelo WhatsApp.',
  orderDisclaimer:
    'Todas as encomendas enviadas pelo site ficam sujeitas à confirmação de disponibilidade, valor final e condições de entrega por parte da Bercali Store.',
} as const;

/**
 * Regras opcionais de taxa de entrega por província / município (em Kz).
 * Mantido vazio por predefinição para apresentar "A confirmar pela loja" quando não há valor fixado.
 * Exemplo de configuração futura:
 *   { province: 'Luanda', municipality: 'Talatona', feeKz: 2000 }
 */
export const DELIVERY_FEE_RULES: DeliveryFeeRule[] = [];

export const ANGOLA_PROVINCES: readonly string[] = [
  'Bengo',
  'Benguela',
  'Bié',
  'Cabinda',
  'Cuando',
  'Cubango',
  'Cuanza Norte',
  'Cuanza Sul',
  'Cunene',
  'Huambo',
  'Huíla',
  'Icolo e Bengo',
  'Luanda',
  'Lunda Norte',
  'Lunda Sul',
  'Malanje',
  'Moxico',
  'Moxico Leste',
  'Namibe',
  'Uíge',
  'Zaire',
];
