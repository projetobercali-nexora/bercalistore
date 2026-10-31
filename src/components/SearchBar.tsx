import React from 'react';
import { Search, X } from 'lucide-react';

interface SearchBarProps {
  value: string;
  onChange: (nextValue: string) => void;
  placeholder?: string;
  inputId?: string;
  autoFocus?: boolean;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChange,
  placeholder = 'Procurar por nome, categoria ou característica...',
  inputId = 'bercali-main-search',
  autoFocus = false,
}) => {
  return (
    <div className="relative w-full">
      <label htmlFor={inputId} className="sr-only">
        Pesquisar produtos na Bercali Store
      </label>
      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-[var(--text-secondary)]">
        <Search className="h-5 w-5" />
      </div>
      <input
        id={inputId}
        type="search"
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full min-h-[48px] rounded-xl bg-[var(--bg-surface)] border border-[var(--border-input)] pl-11 pr-12 py-3 text-base text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:border-[var(--brand-orange)] focus:ring-2 focus:ring-[#FF8A00]/20 focus:outline-none shadow-[var(--shadow-card)] transition-colors"
      />
      {value.trim().length > 0 && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Limpar pesquisa"
          className="absolute inset-y-0 right-1 my-auto inline-flex h-10 w-10 items-center justify-center rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};
