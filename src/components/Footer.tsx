import React from 'react';
import { useLocation } from 'react-router-dom';

export const Footer: React.FC = () => {
  const location = useLocation();
  const isProductDetail = location.pathname.startsWith('/produto/');

  return (
    <footer
      className={`mt-10 border-t border-[var(--border-subtle)] bg-[var(--bg-page)] ${
        isProductDetail
          ? 'pb-[calc(132px+env(safe-area-inset-bottom,0px))] md:pb-20'
          : 'pb-[calc(76px+env(safe-area-inset-bottom,0px))] md:pb-6'
      }`}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-5 text-center sm:text-left">
        <p className="text-xs text-[var(--text-secondary)]">© 2026 Bercali Store.</p>
      </div>
    </footer>
  );
};
