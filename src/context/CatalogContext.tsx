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
  PublicStoreSettings,
  StoreCategory,
} from '../types/store';
import { createDefaultPublicStoreSettings } from '../utils/supabaseMapper';

interface RefreshCatalogOptions {
  silent?: boolean;
}

interface CatalogContextValue {
  products: Product[];
  categories: StoreCategory[];
  storeSettings: PublicStoreSettings;
  isStoreActive: boolean;
  loading: boolean;
  error: string | null;
  accessNotice: string | null;
  configured: boolean;
  whatsappNumber: string;
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
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [accessNotice, setAccessNotice] = useState<string | null>(null);

  const lastFetchAtRef = useRef<number>(0);
  const hasLoadedOnceRef = useRef<boolean>(false);

  const loadCatalog = useCallback(async (options?: RefreshCatalogOptions) => {
    const silent = Boolean(options?.silent && hasLoadedOnceRef.current);
    if (!silent) {
      setLoading(true);
    }

    const result = await fetchStorefrontCatalog();
    lastFetchAtRef.current = Date.now();
    hasLoadedOnceRef.current = true;

    setProducts(result.products);
    setCategories(result.categories);
    setStoreSettings(result.storeSettings);
    setError(result.error);
    setAccessNotice(result.accessNotice);
    setLoading(false);
  }, []);

  // Carregamento inicial
  useEffect(() => {
    let active = true;
    void (async () => {
      const result = await fetchStorefrontCatalog();
      if (!active) return;
      lastFetchAtRef.current = Date.now();
      hasLoadedOnceRef.current = true;
      setProducts(result.products);
      setCategories(result.categories);
      setStoreSettings(result.storeSettings);
      setError(result.error);
      setAccessNotice(result.accessNotice);
      setLoading(false);
    })();
    return () => {
      active = false;
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

  const value = useMemo<CatalogContextValue>(
    () => ({
      products,
      categories,
      storeSettings,
      isStoreActive: storeSettings.isStoreActive,
      loading,
      error,
      accessNotice,
      configured: SUPABASE_CONFIG_STATUS.configured,
      whatsappNumber: storeSettings.whatsappNumber,
      deliveryFeeRules: storeSettings.deliveryFeeRules,
      refreshCatalog: loadCatalog,
    }),
    [products, categories, storeSettings, loading, error, accessNotice, loadCatalog]
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
