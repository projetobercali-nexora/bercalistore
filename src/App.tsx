import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';
import { CartToast } from './components/CartToast';
import { CookieConsentBanner } from './components/CookieConsentBanner';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { InstallPrompt } from './components/InstallPrompt';
import { MobileNavigation } from './components/MobileNavigation';
import { OfflineFallback } from './components/OfflineFallback';
import { PWADiagnosticsPanel } from './components/PWADiagnosticsPanel';
import { StoreStatusBanner } from './components/StoreStatusBanner';
import { CartProvider } from './context/CartContext';
import { CatalogProvider } from './context/CatalogContext';
import { CartPage } from './pages/CartPage';
import { CatalogPage } from './pages/CatalogPage';
import { CategoriesPage } from './pages/CategoriesPage';
import { HomePage } from './pages/HomePage';
import { NotFoundPage } from './pages/NotFoundPage';

const ProductDetailPage = lazy(() =>
  import('./pages/ProductDetailPage').then((m) => ({ default: m.ProductDetailPage }))
);
const CheckoutPage = lazy(() =>
  import('./pages/CheckoutPage').then((m) => ({ default: m.CheckoutPage }))
);
const LegalPage = lazy(() =>
  import('./pages/LegalPage').then((m) => ({ default: m.LegalPage }))
);

const ScrollToTopOnNavigate: React.FC = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
};

const RouteLoadingFallback: React.FC = () => (
  <div
    role="status"
    aria-label="A carregar página"
    className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 min-h-[60dvh] animate-pulse space-y-4"
  >
    <div className="h-7 w-40 rounded-lg bg-[#1A1A1A]" />
    <div className="h-64 w-full rounded-2xl bg-[#161616] border border-white/10" />
  </div>
);

export function App() {
  return (
    <BrowserRouter>
      <CatalogProvider>
        <CartProvider>
          <ScrollToTopOnNavigate />
          <div className="flex min-h-dvh flex-col bg-[#0A0A0A] text-white px-safe">
            <a
              href="#conteudo-principal"
              className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-[#FF8A00] focus:px-4 focus:py-2 focus:font-display focus:text-xs focus:font-bold focus:text-[#0A0A0A]"
            >
              Saltar para o conteúdo principal
            </a>

            <OfflineFallback />
            <Header />
            <StoreStatusBanner />

            <main id="conteudo-principal" className="flex-1">
              <Suspense fallback={<RouteLoadingFallback />}>
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/catalogo" element={<CatalogPage />} />
                  <Route path="/categorias" element={<CategoriesPage />} />
                  <Route path="/categoria/:categorySlug" element={<CategoriesPage />} />
                  <Route path="/produto/:slug" element={<ProductDetailPage />} />
                  <Route path="/carrinho" element={<CartPage />} />
                  <Route path="/finalizar" element={<CheckoutPage />} />
                  <Route path="/privacidade" element={<LegalPage mode="privacy" />} />
                  <Route path="/termos" element={<LegalPage mode="terms" />} />
                  <Route path="*" element={<NotFoundPage />} />
                </Routes>
              </Suspense>
            </main>

            <Footer />
            <CartToast />
            <CookieConsentBanner />
            <InstallPrompt />
            <PWADiagnosticsPanel />
            <MobileNavigation />
          </div>
        </CartProvider>
      </CatalogProvider>
    </BrowserRouter>
  );
}

export default App;
