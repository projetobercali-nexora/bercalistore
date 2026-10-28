import React, { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Menu, MessageCircle, Search, ShoppingBag, X } from 'lucide-react';
import { STORE_CONFIG } from '../config/store';
import { useCart } from '../context/CartContext';
import { useCatalog } from '../context/CatalogContext';
import { buildWhatsAppContactMessage, buildWhatsAppUrl } from '../utils/checkout';
import { trackMetaContact } from '../utils/metaPixel';
import { BrandLogo } from './BrandLogo';

export const Header: React.FC = () => {
  const { totalItemsCount } = useCart();
  const { whatsappNumber, hasWhatsApp, storeSettings } = useCatalog();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname, location.search]);

  const brandName = storeSettings.brandName || STORE_CONFIG.brandName;
  const directWhatsappHref = hasWhatsApp
    ? buildWhatsAppUrl(
        whatsappNumber,
        buildWhatsAppContactMessage(brandName, storeSettings.whatsappMessageTemplate)
      )
    : '';

  const handleSearchAction = () => {
    if (location.pathname === '/' || location.pathname === '/catalogo') {
      const input = document.getElementById('bercali-main-search');
      if (input) {
        input.scrollIntoView({ behavior: 'smooth', block: 'center' });
        (input as HTMLInputElement).focus();
        return;
      }
    }
    navigate('/catalogo?foco=pesquisa');
  };

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `whitespace-nowrap shrink-0 text-sm font-medium transition-colors py-1 border-b-2 ${
      isActive
        ? 'text-[#FF8A00] border-[#FF8A00]'
        : 'text-white/85 border-transparent hover:text-white hover:border-white/40'
    }`;

  return (
    <>
      <header className="sticky top-0 z-40 w-full bg-[#0A0A0A]/95 backdrop-blur-md border-b border-white/10 pt-safe">
        <div className="mx-auto flex h-[60px] md:h-20 max-w-7xl items-center justify-between gap-4 md:gap-8 px-4 sm:px-6 lg:px-8">
          {/* Zona 1: Logotipo original protegido (sem texto substituto/duplicado) */}
          <Link
            to="/"
            aria-label="Bercali Store — Ir para a página inicial"
            className="inline-flex items-center shrink-0 rounded-lg"
          >
            <BrandLogo size="header" />
          </Link>

          {/* Zona 2: Navegação horizontal limpa (Tablet & Desktop) */}
          <nav
            aria-label="Navegação principal"
            className="hidden md:flex items-center gap-7"
          >
            <NavLink to="/" end className={navLinkClass}>
              Início
            </NavLink>
            <NavLink to="/catalogo" className={navLinkClass}>
              Catálogo
            </NavLink>
            <NavLink to="/categorias" className={navLinkClass}>
              Categorias
            </NavLink>
            {directWhatsappHref && (
              <a
                href={directWhatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  trackMetaContact('Cabeçalho WhatsApp');
                }}
                className="whitespace-nowrap shrink-0 text-sm font-medium text-white/85 hover:text-[#FF8A00] transition-colors py-1"
              >
                WhatsApp
              </a>
            )}
          </nav>

          {/* Zona 3: Ações rápidas (Pesquisa nas páginas internas, Carrinho e Menu móvel) */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {location.pathname !== '/' && (
              <button
                type="button"
                onClick={handleSearchAction}
                aria-label="Pesquisar produtos"
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-white/90 hover:bg-[#1A1A1A] hover:text-[#FF8A00] transition-colors cursor-pointer"
              >
                <Search className="h-5 w-5" />
              </button>
            )}

            <Link
              to="/carrinho"
              aria-label={`Ver carrinho de compras (${totalItemsCount} ${
                totalItemsCount === 1 ? 'artigo' : 'artigos'
              })`}
              className="relative inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-[#1A1A1A] border border-white/15 px-3 md:px-4 py-2 font-display text-xs md:text-sm font-bold text-white hover:border-[#FF8A00] transition-colors whitespace-nowrap shrink-0"
            >
              <ShoppingBag className="h-5 w-5 text-[#FF8A00]" />
              <span className="hidden sm:inline">Carrinho</span>
              <span
                aria-live="polite"
                className="inline-flex min-w-[22px] h-[22px] items-center justify-center rounded-md bg-[#FF8A00] px-1.5 font-display text-xs font-extrabold text-[#0A0A0A] tabular-nums"
              >
                {totalItemsCount}
              </span>
            </Link>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-expanded={mobileMenuOpen}
              aria-controls="bercali-mobile-drawer"
              aria-label={mobileMenuOpen ? 'Fechar menu de navegação' : 'Abrir menu de navegação'}
              className="inline-flex md:hidden min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-white hover:bg-[#1A1A1A] transition-colors cursor-pointer"
            >
              {mobileMenuOpen ? <X className="h-6 w-6 text-[#FF8A00]" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </header>

      {/* Menu móvel intuitivo com abertura e fecho funcionais */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 md:hidden bg-black/75 backdrop-blur-xs"
          onClick={() => setMobileMenuOpen(false)}
        >
          <aside
            id="bercali-mobile-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Menu de navegação móvel"
            className="ml-auto flex h-full w-full max-w-xs flex-col bg-[#0A0A0A] border-l border-white/10 p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <BrandLogo size="compact" />
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Fechar menu"
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-white hover:bg-[#1A1A1A] cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav aria-label="Links do menu móvel" className="mt-5 flex flex-col gap-1.5">
              <Link
                to="/"
                className="flex min-h-[48px] items-center rounded-lg px-3.5 text-base font-medium text-white hover:bg-[#1A1A1A]"
              >
                Início
              </Link>
              <Link
                to="/catalogo"
                className="flex min-h-[48px] items-center rounded-lg px-3.5 text-base font-medium text-white hover:bg-[#1A1A1A]"
              >
                Catálogo completo
              </Link>
              <Link
                to="/categorias"
                className="flex min-h-[48px] items-center rounded-lg px-3.5 text-base font-medium text-white hover:bg-[#1A1A1A]"
              >
                Categorias
              </Link>
              <Link
                to="/carrinho"
                className="flex min-h-[48px] items-center justify-between rounded-lg px-3.5 text-base font-medium text-white hover:bg-[#1A1A1A]"
              >
                <span>Carrinho de compras</span>
                <span className="font-display text-sm font-bold text-[#FFC400] tabular-nums">
                  {totalItemsCount} {totalItemsCount === 1 ? 'item' : 'itens'}
                </span>
              </Link>
              <Link
                to="/privacidade"
                className="flex min-h-[48px] items-center rounded-lg px-3.5 text-sm text-[#8A8A8A] hover:bg-[#1A1A1A] hover:text-white"
              >
                Política de privacidade
              </Link>
              <Link
                to="/termos"
                className="flex min-h-[48px] items-center rounded-lg px-3.5 text-sm text-[#8A8A8A] hover:bg-[#1A1A1A] hover:text-white"
              >
                Termos de utilização
              </Link>
            </nav>

            <div className="mt-auto pt-5 border-t border-white/10">
              {directWhatsappHref && (
                <a
                  href={directWhatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => {
                    trackMetaContact('Menu Móvel WhatsApp');
                  }}
                  className="mb-3 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-lg bg-bercali-gradient px-4 font-display text-sm font-bold uppercase text-[#0A0A0A]"
                >
                  <MessageCircle className="h-5 w-5" />
                  Falar no WhatsApp
                </a>
              )}
              <p className="text-center text-xs text-[#8A8A8A]">
                {storeSettings.slogan || STORE_CONFIG.slogan}
              </p>
            </div>
          </aside>
        </div>
      )}
    </>
  );
};
