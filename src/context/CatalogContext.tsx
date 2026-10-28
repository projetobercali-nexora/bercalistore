import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { supabase, SUPABASE_CONFIG_STATUS } from '../lib/supabase';
import { fetchStorefrontCatalog } from '../services/storefrontApi';
import type {
  DeliveryFeeRule,
  Product,
  PublicMarketingSettings,
  PublicStoreSettings,
  StoreCategory,
} from '../types/store';
import { hasConfiguredWhatsApp } from '../utils/checkout';
import {
  createDefaultMarketingSettings,
  readStoredCookieConsent,
  syncMetaPixelRuntime,
} from '../utils/metaPixel';
import {
  resolveCatalogLoadStatus,
  type CatalogErrorKind,
  type CatalogLoadStatus,
} from '../utils/publicMessages';
import { createDefaultPublicStoreSettings } from '../utils/supabaseMapper';

interface RefreshCatalogOptions {
  silent?: boolean;
}

interface CatalogContextValue {
  products: Product[];
  categories: StoreCategory[];
  storeSettings: PublicStoreSettings;
  marketingSettings: PublicMarketingSettings;
  isStoreActive: boolean;
  loading: boolean;
  loadStatus: CatalogLoadStatus;
  error: string | null;
  errorKind: CatalogErrorKind;
  accessNotice: string | null;
  configured: boolean;
  whatsappNumber: string;
  hasWhatsApp: boolean;
  deliveryFeeRules: DeliveryFeeRule[];
  refreshCatalog: (options?: RefreshCatalogOptions) => Promise<void>;
}

const CatalogContext = createContext<CatalogContextValue | undefined>(undefined);

const AUTO_REFRESH_THROTTLE_MS = 4000;

export const CatalogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<StoreCategory[]>([]);
  const [storeSettings, setStoreSettings] = useState<PublicStoreSettings>(() =>
    createDefaultPublicStoreSettings()
  );
  const [marketingSettings, setMarketingSettings] = useState<PublicMarketingSettings>(() =>
    createDefaultMarketingSettings()
  );
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<CatalogErrorKind>('none');
  const [accessNotice, setAccessNotice] = useState<string | null>(null);

  const lastFetchAtRef = useRef<number>(0);
  const hasLoadedOnceRef = useRef<boolean>(false);
  const hasProductsRef = useRef<boolean>(false);
  const isFetchingRef = useRef<boolean>(false);

  const loadCatalog = useCallback(async (options?: RefreshCatalogOptions) => {
    const requestedSilent = Boolean(options?.silent);
    if (requestedSilent && isFetchingRef.current) {
      return;
    }

    const silent = Boolean(requestedSilent && hasLoadedOnceRef.current);
    if (!silent) {
      setLoading(true);
      setError(null);
      setErrorKind('none');
    }

    isFetchingRef.current = true;
    try {
      const result = await fetchStorefrontCatalog();
      lastFetchAtRef.current = Date.now();
      hasLoadedOnceRef.current = true;

      // Se uma atualização silenciosa em segundo plano falhar mas já existirem produtos carregados,
      // preserva o catálogo visível ao cliente para não interromper a compra em curso.
      if (silent && result.error && hasProductsRef.current) {
        setLoading(false);
        return;
      }

      hasProductsRef.current = result.products.length > 0;
      syncMetaPixelRuntime(result.marketingSettings, readStoredCookieConsent());
      setProducts(result.products);
      setCategories(result.categories);
      setStoreSettings(result.storeSettings);
      setMarketingSettings(result.marketingSettings);
      setError(result.error);
      setErrorKind(result.errorKind);
      setAccessNotice(result.accessNotice);
      setLoading(false);
    } finally {
      isFetchingRef.current = false;
    }
  }, []);

  // Carregamento inicial
  useEffect(() => {
    let active = true;
    isFetchingRef.current = true;
    void (async () => {
      try {
        const result = await fetchStorefrontCatalog();
        if (!active) return;
        lastFetchAtRef.current = Date.now();
        hasLoadedOnceRef.current = true;
        hasProductsRef.current = result.products.length > 0;
        syncMetaPixelRuntime(result.marketingSettings, readStoredCookieConsent());
        setProducts(result.products);
        setCategories(result.categories);
        setStoreSettings(result.storeSettings);
        setMarketingSettings(result.marketingSettings);
        setError(result.error);
        setErrorKind(result.errorKind);
        setAccessNotice(result.accessNotice);
        setLoading(false);
      } finally {
        if (active) {
          isFetchingRef.current = false;
        }
      }
    })();
    return () => {
      active = false;
      isFetchingRef.current = false;
    };
  }, []);

  // Sincroniza título do documento com o nome comercial e slogan reais configurados no painel
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const title = storeSettings.slogan
      ? `${storeSettings.brandName} — ${storeSettings.slogan}`
      : storeSettings.brandName;
    if (title.trim()) {
      document.title = title;
    }
  }, [storeSettings.brandName, storeSettings.slogan]);

  // Revalidação silenciosa ao regressar ao separador + subscrição Realtime do Supabase
  useEffect(() => {
    const triggerThrottledSilentRefresh = () => {
      if (Date.now() - lastFetchAtRef.current < AUTO_REFRESH_THROTTLE_MS) {
        return;
      }
      void loadCatalog({ silent: true });
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        triggerThrottledSilentRefresh();
      }
    };

    window.addEventListener('focus', triggerThrottledSilentRefresh);
    document.addEventListener('visibilitychange', onVisibilityChange);

    let debounceTimer: number | null = null;
    const scheduleRealtimeRefresh = () => {
      if (debounceTimer !== null) {
        window.clearTimeout(debounceTimer);
      }
      debounceTimer = window.setTimeout(() => {
        void loadCatalog({ silent: true });
      }, 350);
    };

    const channel = supabase
      ? supabase
          .channel('bercali-storefront-live-sync')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, scheduleRealtimeRefresh)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, scheduleRealtimeRefresh)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'product_media' }, scheduleRealtimeRefresh)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'store_settings' }, scheduleRealtimeRefresh)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'marketing_settings' }, scheduleRealtimeRefresh)
          .subscribe()
      : null;

    return () => {
      window.removeEventListener('focus', triggerThrottledSilentRefresh);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (debounceTimer !== null) {
        window.clearTimeout(debounceTimer);
      }
      if (channel && supabase) {
        void supabase.removeChannel(channel);
      }
    };
  }, [loadCatalog]);

  const loadStatus = useMemo(
    () =>
      resolveCatalogLoadStatus({
        loading,
        errorKind,
        productCount: products.length,
      }),
    [loading, errorKind, products.length]
  );

  const hasWhatsApp = useMemo(
    () => hasConfiguredWhatsApp(storeSettings.whatsappNumber),
    [storeSettings.whatsappNumber]
  );

  const value = useMemo<CatalogContextValue>(
    () => ({
      products,
      categories,
      storeSettings,
      marketingSettings,
      isStoreActive: storeSettings.isStoreActive,
      loading,
      loadStatus,
      error,
      errorKind,
      accessNotice,
      configured: SUPABASE_CONFIG_STATUS.configured,
      whatsappNumber: storeSettings.whatsappNumber,
      hasWhatsApp,
      deliveryFeeRules: storeSettings.deliveryFeeRules,
      refreshCatalog: loadCatalog,
    }),
    [
      products,
      categories,
      storeSettings,
      marketingSettings,
      loading,
      loadStatus,
      error,
      errorKind,
      accessNotice,
      hasWhatsApp,
      loadCatalog,
    ]
  );

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
};

export function useCatalog(): CatalogContextValue {
  const ctx = useContext(CatalogContext);
  if (!ctx) {
    throw new Error('useCatalog deve ser usado dentro de CatalogProvider');
  }
  return ctx;
}
