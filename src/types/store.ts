export type AvailabilityStatus = 'available' | 'out_of_stock' | 'temporarily_unavailable';

export interface ProductVideo {
  webm?: string;
  mp4?: string;
  poster?: string;
  caption?: string;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  sku?: string;
  description: string;
  category: string;
  categoryId?: string;
  categorySlug?: string;
  price: number;
  oldPrice?: number;
  images: string[];
  video?: ProductVideo;
  features: string[];
  stock?: number;
  manageStock?: boolean;
  lowStockThreshold?: number;
  featured: boolean;
  isNew?: boolean;
  available: boolean;
  availabilityStatus?: AvailabilityStatus;
  isDemo?: boolean;
}

export interface StoreCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  count: number;
  availableCount: number;
}

export interface CartItem {
  productId: string;
  quantity: number;
}

export interface ValidatedCartLine {
  product: Product;
  quantity: number;
  lineSubtotal: number;
}

export interface CustomerCheckoutData {
  fullName: string;
  phone: string;
  email?: string;
  deliveryZone?: string;
  province: string;
  municipality: string;
  neighborhood: string;
  addressReference: string;
  notes: string;
}

export type CheckoutValidationErrors = Partial<Record<keyof CustomerCheckoutData, string>>;

export interface DeliveryFeeRule {
  province: string;
  municipality?: string;
  neighborhood?: string;
  zoneName?: string;
  estimatedTime?: string;
  feeKz: number;
}

export interface ResolvedDeliveryFee {
  known: boolean;
  amountKz: number;
  label: string;
  estimatedTime?: string;
}

export interface OrderSummaryCalculation {
  lines: ValidatedCartLine[];
  totalItemsCount: number;
  productsSubtotalKz: number;
  delivery: ResolvedDeliveryFee;
  estimatedTotalKz: number | null;
  estimatedTotalLabel: string;
}

export interface StoreSocialLinks {
  instagram?: string;
  facebook?: string;
  tiktok?: string;
  youtube?: string;
  linkedin?: string;
  website?: string;
}

export interface StorePromoBanner {
  text: string;
  linkUrl?: string;
  linkLabel?: string;
}

export interface StoreHeroConfig {
  title?: string;
  highlight?: string;
  subtitle?: string;
  ctaText?: string;
  bannerImageUrl?: string;
}

export interface PublicStoreSettings {
  brandName: string;
  slogan: string;
  description: string | null;
  logoUrl: string | null;
  isStoreActive: boolean;
  closedMessage: string;
  whatsappNumber: string;
  whatsappMessageTemplate: string | null;
  whatsappOrderTemplate: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  socialLinks: StoreSocialLinks;
  deliveryInfo: string;
  paymentInfo: string;
  orderDisclaimer: string;
  freeDeliveryThresholdKz: number | null;
  defaultDeliveryFeeKz: number | null;
  deliveryFeeRules: DeliveryFeeRule[];
  promoBanner: StorePromoBanner | null;
  heroConfig: StoreHeroConfig | null;
}

export type AllowedMetaPixelEvent =
  | 'PageView'
  | 'ViewContent'
  | 'Search'
  | 'AddToCart'
  | 'InitiateCheckout'
  | 'Contact';

export type MetaPixelEventsConfig = Record<AllowedMetaPixelEvent, boolean>;

export interface PublicMarketingSettings {
  pixelId: string | null;
  isEnabled: boolean;
  consentRequired: boolean;
  events: MetaPixelEventsConfig;
}

export type OrderPersistenceStatus =
  | 'idle'
  | 'saving'
  | 'saved'
  | 'store_closed'
  | 'stock_conflict'
  | 'rls_blocked'
  | 'unconfigured'
  | 'error';

export interface OrderSubmissionResult {
  ok: boolean;
  status: Exclude<OrderPersistenceStatus, 'idle' | 'saving'>;
  orderNumber: string;
  orderId?: string;
  errorMessage?: string;
  errorCode?: string;
  verifiedSummary?: OrderSummaryCalculation;
}
