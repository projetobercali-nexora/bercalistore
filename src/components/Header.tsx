import React, { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Info, Menu, MessageCircle, Search, ShoppingBag, X } from 'lucide-react';
import { STORE_CONFIG } from '../config/store';
import { useCartCount } from '../context/CartContext';
import { useCatalog } from '../context/CatalogContext';
import { buildWhatsAppContactMessage, buildWhatsAppUrl } from '../utils/checkout';
import { trackMetaContact } from '../utils/metaPixel';
import { BrandLogo } from './BrandLogo';
import { PWAInstallAction } from './PWAInstallAction';

export const Header: React.FC = () => {
  const totalItemsCount = useCartCount();
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
        ? 'text-[var(--brand-orange-text)] border-[var(--brand-orange)] font-semibold'
        : 'text-[var(--text-primary)] border-transparent hover:text-[var(--brand-orange-text)] hover:border-[var(--border-input)]'
    }`;

  return (
    <>
      <header className="sticky top-0 z-40 w-full bg-[var(--bg-surface)]/95 backdrop-blur-md border-b border-[var(--border-subtle)] pt-safe">
        <div className="mx-auto flex h-[60px] md:h-20 max-w-7xl items-center justify-between gap-4 md:gap-8 px-4 sm:px-6 lg:px-8">
          {/* Zona 1: Logotipo original protegido em caixa preta arredondada */}
          <Link
            to="/"
            aria-label="Bercali Store — Ir para a página inicial"
            className="inline-flex items-center shrink-0 rounded-xl"
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
            <NavLink to="/informacoes" className={navLinkClass}>
              Informações
            </NavLink>
            {directWhatsappHref && (
              <a
                href={directWhatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  trackMetaContact('Cabeçalho WhatsApp');
                }}
                className="whitespace-nowrap shrink-0 text-sm font-medium text-[var(--text-primary)] hover:text-[var(--brand-orange-text)] transition-colors py-1"
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
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--brand-orange-text)] transition-colors cursor-pointer"
              >
                <Search className="h-5 w-5" />
              </button>
            )}

            <Link
              to="/carrinho"
              aria-label={`Ver carrinho de compras (${totalItemsCount} ${
                totalItemsCount === 1 ? 'artigo' : 'artigos'
              })`}
              className="relative inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] px-3 md:px-4 py-2 font-display text-xs md:text-sm font-bold text-[var(--text-primary)] hover:border-[var(--brand-orange)] transition-colors whitespace-nowrap shrink-0"
            >
              <ShoppingBag className="h-5 w-5 text-[var(--text-primary)]" />
              <span className="hidden sm:inline">Carrinho</span>
              <span
                aria-live="polite"
                className="inline-flex min-w-[22px] h-[22px] items-center justify-center rounded-md bg-[var(--brand-orange)] px-1.5 font-display text-xs font-extrabold text-[var(--text-on-accent)] tabular-nums"
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
              className="inline-flex md:hidden min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] transition-colors cursor-pointer"
            >
              {mobileMenuOpen ? <X className="h-6 w-6 text-[var(--text-primary)]" /> : <Menu className="h-6 w-6 text-[var(--text-primary)]" />}
            </button>
          </div>
        </div>
      </header>

      {/* Menu móvel intuitivo com abertura e fecho funcionais */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 md:hidden bg-black/45 backdrop-blur-xs"
          onClick={() => setMobileMenuOpen(false)}
        >
          <aside
            id="bercali-mobile-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Menu de navegação móvel"
            className="ml-auto flex h-full w-full max-w-xs flex-col bg-[var(--bg-surface)] border-l border-[var(--border-subtle)] p-5 shadow-2xl overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 border-b border-[var(--border-subtle)]">
              <BrandLogo size="compact" />
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Fechar menu"
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav aria-label="Links do menu móvel" className="mt-5 flex flex-col gap-1">
              <Link
                to="/"
                className="flex min-h-[46px] items-center rounded-lg px-3.5 text-base font-medium text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]"
              >
                Início
              </Link>
              <Link
                to="/catalogo"
                className="flex min-h-[46px] items-center rounded-lg px-3.5 text-base font-medium text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]"
              >
                Catálogo completo
              </Link>
              <Link
                to="/categorias"
                className="flex min-h-[46px] items-center rounded-lg px-3.5 text-base font-medium text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]"
              >
                Categorias
              </Link>
              <Link
                to="/carrinho"
                className="flex min-h-[46px] items-center justify-between rounded-lg px-3.5 text-base font-medium text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]"
              >
                <span>Carrinho de compras</span>
                <span className="font-display text-sm font-bold text-[var(--brand-orange-text)] tabular-nums">
                  {totalItemsCount} {totalItemsCount === 1 ? 'item' : 'itens'}
                </span>
              </Link>
              <Link
                to="/informacoes"
                className="flex min-h-[46px] items-center gap-2.5 rounded-lg px-3.5 text-base font-medium text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]"
              >
                <Info className="h-5 w-5 shrink-0 text-[var(--brand-orange-text)]" aria-hidden="true" />
                <span>Informações da loja</span>
              </Link>
              <Link
                to="/privacidade"
                className="flex min-h-[44px] items-center rounded-lg px-3.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
              >
                Política de privacidade
              </Link>
              <Link
                to="/termos"
                className="flex min-h-[44px] items-center rounded-lg px-3.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
              >
                Termos de utilização
              </Link>
            </nav>

            <div className="mt-auto pt-5 border-t border-[var(--border-subtle)] space-y-2.5">
              <PWAInstallAction pathname={location.pathname} variant="drawer" />

              {directWhatsappHref && (
                <a
                  href={directWhatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => {
                    trackMetaContact('Menu Móvel WhatsApp');
                  }}
                  className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-lg bg-bercali-gradient px-4 font-display text-sm font-bold uppercase text-[var(--text-on-accent)]"
                >
                  <MessageCircle className="h-5 w-5" />
                  Falar no WhatsApp
                </a>
              )}
              <p className="pt-0.5 text-center text-xs text-[var(--text-secondary)]">
                {storeSettings.slogan || STORE_CONFIG.slogan}
              </p>
            </div>
          </aside>
        </div>
      )}
    </>
  );
};
