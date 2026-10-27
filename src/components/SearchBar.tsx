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
      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-[#8A8A8A]">
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
        className="w-full min-h-[48px] rounded-xl bg-[#1A1A1A] border border-white/15 pl-11 pr-12 py-3 text-base text-white placeholder:text-[#8A8A8A] focus:border-[#FF8A00] focus:outline-none transition-colors"
      />
      {value.trim().length > 0 && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Limpar pesquisa"
          className="absolute inset-y-0 right-1 my-auto inline-flex h-10 w-10 items-center justify-center rounded-lg text-[#8A8A8A] hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};
