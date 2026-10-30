import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { useCatalog } from './CatalogContext';
import type { CartItem, Product, ValidatedCartLine } from '../types/store';
import {
  addOrIncrementCartItem,
  CART_STORAGE_KEY,
  removeCartItemById,
  resolveValidatedCartLines,
  sanitizeStoredCart,
  updateCartItemQuantity,
} from '../utils/cart';
import { trackMetaAddToCart } from '../utils/metaPixel';

interface CartFeedback {
  productName: string;
  quantityAdded: number;
  timestamp: number;
}

interface CartContextValue {
  items: CartItem[];
  lines: ValidatedCartLine[];
  totalItemsCount: number;
  subtotalKz: number;
  storageAvailable: boolean;
  feedback: CartFeedback | null;
  dismissFeedback: () => void;
  addItem: (product: Product, quantity?: number) => boolean;
  setItemQuantity: (product: Product, nextQuantity: number) => void;
  removeItem: (productId: string) => void;
  clearCart: () => void;
  getQuantityInCart: (productId: string) => number;
}

interface CartActionsValue {
  dismissFeedback: () => void;
  addItem: (product: Product, quantity?: number) => boolean;
  setItemQuantity: (product: Product, nextQuantity: number) => void;
  removeItem: (productId: string) => void;
  clearCart: () => void;
}

interface CartExternalStore {
  subscribe: (listener: () => void) => () => void;
  getItemQuantity: (productId: string) => number;
  getTotalItemsCount: () => number;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);
const CartActionsContext = createContext<CartActionsValue | undefined>(undefined);
const CartExternalStoreContext = createContext<CartExternalStore | undefined>(undefined);

/**
 * Lê o formato base do carrinho no arranque antes de o catálogo assíncrono do Supabase terminar,
 * descartando automaticamente eventuais itens antigos de demonstração (`demo-*`).
 */
function parseStoredCartShape(rawValue: unknown): CartItem[] {
  if (!Array.isArray(rawValue)) {
    return [];
  }
  const merged = new Map<string, number>();
  for (const entry of rawValue) {
    if (typeof entry !== 'object' || entry === null) continue;
    const record = entry as Record<string, unknown>;
    const productId = typeof record.productId === 'string' ? record.productId.trim() : '';
    const quantity = typeof record.quantity === 'number' ? record.quantity : Number.NaN;
    if (!productId || productId.startsWith('demo-') || !Number.isFinite(quantity) || quantity < 1) {
      continue;
    }
    const accumulated = (merged.get(productId) ?? 0) + Math.floor(quantity);
    merged.set(productId, Math.min(99, accumulated));
  }
  return Array.from(merged.entries()).map(([productId, quantity]) => ({
    productId,
    quantity,
  }));
}

function readInitialCart(): { items: CartItem[]; storageAvailable: boolean } {
  if (typeof window === 'undefined') {
    return { items: [], storageAvailable: true };
  }
  try {
    const testKey = '__bercali_storage_check__';
    window.localStorage.setItem(testKey, '1');
    window.localStorage.removeItem(testKey);

    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) {
      return { items: [], storageAvailable: true };
    }
    const parsed: unknown = JSON.parse(raw);
    return {
      items: parseStoredCartShape(parsed),
      storageAvailable: true,
    };
  } catch {
    return { items: [], storageAvailable: false };
  }
}

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { products, isStoreActive, loading: catalogLoading, error: catalogError } = useCatalog();
  const initialState = useMemo(() => readInitialCart(), []);
  const [items, setItems] = useState<CartItem[]>(initialState.items);
  const [storageAvailable, setStorageAvailable] = useState<boolean>(initialState.storageAvailable);
  const [feedback, setFeedback] = useState<CartFeedback | null>(null);
  const timerRef = useRef<number | null>(null);

  const listenersRef = useRef<Set<() => void>>(new Set());
  const qtyByProductIdRef = useRef<Map<string, number>>(
    new Map(initialState.items.map((item) => [item.productId, item.quantity]))
  );
  const totalCountRef = useRef<number>(
    initialState.items.reduce((sum, item) => sum + item.quantity, 0)
  );

  // Sincroniza e higieniza o carrinho com os produtos reais e stocks do Supabase assim que o catálogo carrega sem erro
  useEffect(() => {
    if (catalogLoading || catalogError) return;
    setItems((prev) => {
      if (prev.length === 0) return prev;
      const sanitized = sanitizeStoredCart(prev, products);
      if (
        sanitized.length === prev.length &&
        sanitized.every(
          (item, idx) =>
            item.productId === prev[idx].productId && item.quantity === prev[idx].quantity
        )
      ) {
        return prev;
      }
      return sanitized;
    });
  }, [catalogLoading, catalogError, products]);

  useEffect(() => {
    if (!storageAvailable) return;
    try {
      window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    } catch {
      setStorageAvailable(false);
    }
  }, [items, storageAvailable]);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  const dismissFeedback = useCallback(() => {
    setFeedback(null);
  }, []);

  const persistItemsSync = useCallback(
    (next: CartItem[]) => {
      if (!storageAvailable) return;
      try {
        window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(next));
      } catch {
        setStorageAvailable(false);
      }
    },
    [storageAvailable]
  );

  const addItem = useCallback(
    (product: Product, quantity = 1): boolean => {
      if (!isStoreActive) {
        return false;
      }
      let added = false;
      let addedQty = 0;
      setItems((prev) => {
        const prevQty = prev.find((i) => i.productId === product.id)?.quantity ?? 0;
        const next = addOrIncrementCartItem(prev, product, quantity);
        const nextQty = next.find((i) => i.productId === product.id)?.quantity ?? 0;
        if (nextQty > prevQty) {
          added = true;
          addedQty = nextQty - prevQty;
          persistItemsSync(next);
        }
        return next;
      });

      if (added) {
        trackMetaAddToCart(product, addedQty || quantity);
        setFeedback({
          productName: product.name,
          quantityAdded: addedQty || quantity,
          timestamp: Date.now(),
        });
        if (timerRef.current !== null) {
          window.clearTimeout(timerRef.current);
        }
        timerRef.current = window.setTimeout(() => {
          setFeedback(null);
        }, 2800);
      }
      return added;
    },
    [isStoreActive, persistItemsSync]
  );

  const setItemQuantity = useCallback(
    (product: Product, nextQuantity: number) => {
      setItems((prev) => {
        const next = updateCartItemQuantity(prev, product, nextQuantity);
        persistItemsSync(next);
        return next;
      });
    },
    [persistItemsSync]
  );

  const removeItem = useCallback(
    (productId: string) => {
      setItems((prev) => {
        const next = removeCartItemById(prev, productId);
        persistItemsSync(next);
        return next;
      });
    },
    [persistItemsSync]
  );

  const clearCart = useCallback(() => {
    setItems([]);
    persistItemsSync([]);
  }, [persistItemsSync]);

  const getQuantityInCart = useCallback(
    (productId: string): number => {
      return items.find((i) => i.productId === productId)?.quantity ?? 0;
    },
    [items]
  );

  const lines = useMemo(() => resolveValidatedCartLines(items, products), [items, products]);
  const totalItemsCount = useMemo(
    () => lines.reduce((sum, line) => sum + line.quantity, 0),
    [lines]
  );
  const subtotalKz = useMemo(
    () => lines.reduce((sum, line) => sum + line.lineSubtotal, 0),
    [lines]
  );

  // Atualiza store externa para seletores granulares (evita re-renders nos cartões de outros produtos)
  useEffect(() => {
    qtyByProductIdRef.current = new Map(items.map((item) => [item.productId, item.quantity]));
    totalCountRef.current = totalItemsCount;
    for (const listener of listenersRef.current) {
      listener();
    }
  }, [items, totalItemsCount]);

  const externalStore = useMemo<CartExternalStore>(
    () => ({
      subscribe: (listener) => {
        listenersRef.current.add(listener);
        return () => {
          listenersRef.current.delete(listener);
        };
      },
      getItemQuantity: (productId) => qtyByProductIdRef.current.get(productId) ?? 0,
      getTotalItemsCount: () => totalCountRef.current,
    }),
    []
  );

  const actionsValue = useMemo<CartActionsValue>(
    () => ({
      dismissFeedback,
      addItem,
      setItemQuantity,
      removeItem,
      clearCart,
    }),
    [dismissFeedback, addItem, setItemQuantity, removeItem, clearCart]
  );

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      lines,
      totalItemsCount,
      subtotalKz,
      storageAvailable,
      feedback,
      dismissFeedback,
      addItem,
      setItemQuantity,
      removeItem,
      clearCart,
      getQuantityInCart,
    }),
    [
      items,
      lines,
      totalItemsCount,
      subtotalKz,
      storageAvailable,
      feedback,
      dismissFeedback,
      addItem,
      setItemQuantity,
      removeItem,
      clearCart,
      getQuantityInCart,
    ]
  );

  return (
    <CartExternalStoreContext.Provider value={externalStore}>
      <CartActionsContext.Provider value={actionsValue}>
        <CartContext.Provider value={value}>{children}</CartContext.Provider>
      </CartActionsContext.Provider>
    </CartExternalStoreContext.Provider>
  );
};

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error('useCart deve ser usado dentro de CartProvider');
  }
  return ctx;
}

export function useCartActions(): CartActionsValue {
  const ctx = useContext(CartActionsContext);
  if (!ctx) {
    throw new Error('useCartActions deve ser usado dentro de CartProvider');
  }
  return ctx;
}

export function useProductCartQuantity(productId: string): number {
  const store = useContext(CartExternalStoreContext);
  if (!store) {
    throw new Error('useProductCartQuantity deve ser usado dentro de CartProvider');
  }
  const getQty = useCallback(() => store.getItemQuantity(productId), [store, productId]);
  return useSyncExternalStore(store.subscribe, getQty, getQty);
}

export function useCartCount(): number {
  const store = useContext(CartExternalStoreContext);
  if (!store) {
    throw new Error('useCartCount deve ser usado dentro de CartProvider');
  }
  return useSyncExternalStore(
    store.subscribe,
    store.getTotalItemsCount,
    store.getTotalItemsCount
  );
}
