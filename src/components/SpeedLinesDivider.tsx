import React from 'react';

interface SpeedLinesDividerProps {
  className?: string;
}

/**
 * Elemento gráfico oficial (Manual de Marca, secção 05):
 * Três linhas de velocidade horizontais em laranja/âmbar com pontas arredondadas.
 */
export const SpeedLinesDivider: React.FC<SpeedLinesDividerProps> = ({ className = '' }) => {
  return (
    <div aria-hidden="true" className={`flex items-center gap-1.5 ${className}`}>
      <span className="h-1 w-10 rounded-full bg-[#FF8A00]" />
      <span className="h-1 w-5 rounded-full bg-[#FFC400]" />
      <span className="h-1 w-2.5 rounded-full bg-[#FF8A00]/80" />
    </div>
  );
};
