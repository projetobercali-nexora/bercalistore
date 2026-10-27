import React from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Home, LayoutGrid, MessageCircle, Search, ShoppingBag } from 'lucide-react';
import { STORE_CONFIG } from '../config/store';
import { useCart } from '../context/CartContext';
import { useCatalog } from '../context/CatalogContext';
import { buildWhatsAppUrl } from '../utils/checkout';

export const MobileNavigation: React.FC = () => {
  const { totalItemsCount } = useCart();
  const { whatsappNumber, storeSettings } = useCatalog();
  const location = useLocation();
  const navigate = useNavigate();

  const brandName = storeSettings.brandName || STORE_CONFIG.brandName;
  const whatsappHref = buildWhatsAppUrl(
    whatsappNumber,
    `Olá, ${brandName}! Gostaria de receber informações sobre os vossos produtos.`
  );

  const handleMobileSearch = () => {
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

  const tabClass = ({ isActive }: { isActive: boolean }) =>
    `flex min-h-[48px] flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors ${
      isActive ? 'text-[#FF8A00]' : 'text-[#8A8A8A] hover:text-white'
    }`;

  return (
    <nav
      aria-label="Navegação rápida móvel"
      className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-[#0A0A0A]/95 backdrop-blur-md border-t border-white/10 pb-safe"
    >
      <div className="grid h-[60px] grid-cols-5 items-center px-1">
        <NavLink to="/" end className={tabClass}>
          <Home className="h-5 w-5" />
          <span className="truncate max-w-full">Início</span>
        </NavLink>

        <NavLink to="/categorias" className={tabClass}>
          <LayoutGrid className="h-5 w-5" />
          <span className="truncate max-w-full">Categorias</span>
        </NavLink>

        <button
          type="button"
          onClick={handleMobileSearch}
          aria-label="Ir para a pesquisa"
          className="flex min-h-[48px] flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-[#8A8A8A] hover:text-white transition-colors cursor-pointer"
        >
          <Search className="h-5 w-5" />
          <span className="truncate max-w-full">Pesquisa</span>
        </button>

        <NavLink to="/carrinho" className={tabClass}>
          <span className="relative inline-flex">
            <ShoppingBag className="h-5 w-5" />
            {totalItemsCount > 0 && (
              <span className="absolute -top-1.5 -right-2.5 inline-flex min-w-[18px] h-[18px] items-center justify-center rounded-full bg-[#FF8A00] px-1 font-display text-[10px] font-extrabold text-[#0A0A0A] tabular-nums">
                {totalItemsCount}
              </span>
            )}
          </span>
          <span className="truncate max-w-full">Carrinho</span>
        </NavLink>

        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Contactar Bercali Store pelo WhatsApp"
          className="flex min-h-[48px] flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-[#8A8A8A] hover:text-[#22C55E] transition-colors"
        >
          <MessageCircle className="h-5 w-5" />
          <span className="truncate max-w-full">WhatsApp</span>
        </a>
      </div>
    </nav>
  );
};
