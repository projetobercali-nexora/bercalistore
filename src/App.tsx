import React, { useEffect } from 'react';
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';
import { CartToast } from './components/CartToast';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { InstallPrompt } from './components/InstallPrompt';
import { MobileNavigation } from './components/MobileNavigation';
import { OfflineFallback } from './components/OfflineFallback';
import { StoreStatusBanner } from './components/StoreStatusBanner';
import { CartProvider } from './context/CartContext';
import { CatalogProvider } from './context/CatalogContext';
import { CartPage } from './pages/CartPage';
import { CatalogPage } from './pages/CatalogPage';
import { CategoriesPage } from './pages/CategoriesPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { HomePage } from './pages/HomePage';
import { LegalPage } from './pages/LegalPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { ProductDetailPage } from './pages/ProductDetailPage';

const ScrollToTopOnNavigate: React.FC = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
};

export function App() {
  return (
    <BrowserRouter>
      <CatalogProvider>
        <CartProvider>
          <ScrollToTopOnNavigate />
          <div className="flex min-h-dvh flex-col bg-[#0A0A0A] text-white">
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
            </main>

            <Footer />
            <CartToast />
            <InstallPrompt />
            <MobileNavigation />
          </div>
        </CartProvider>
      </CatalogProvider>
    </BrowserRouter>
  );
}

export default App;
