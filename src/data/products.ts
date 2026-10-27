import type { Product } from '../types/store';

/**
 * Os produtos de demonstração foram removidos.
 * O catálogo real é agora obtido diretamente do Supabase através de `CatalogContext` e `src/services/storefrontApi.ts`,
 * partilhando a base de dados oficial do Painel Administrativo da Bercali Store.
 */
export const PRODUCTS: Product[] = [];
