import React from 'react';
import { Link } from 'react-router-dom';
import { SpeedLinesDivider } from '../components/SpeedLinesDivider';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-16 sm:py-24 text-center space-y-5">
      <div className="flex justify-center">
        <SpeedLinesDivider />
      </div>
      <p className="font-display text-4xl sm:text-5xl font-extrabold text-[#FF8A00] tabular-nums">
        404
      </p>
      <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
        Página não encontrada
      </h1>
      <p className="mx-auto max-w-md text-sm sm:text-base text-[#8A8A8A]">
        O endereço que procuras não existe ou foi alterado. Podes regressar ao início ou explorar o nosso catálogo.
      </p>
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
        <Link
          to="/"
          className="inline-flex min-h-[48px] w-full sm:w-auto items-center justify-center rounded-xl bg-bercali-gradient px-6 py-3 font-display text-sm font-extrabold uppercase text-[#0A0A0A]"
        >
          Ir para o início
        </Link>
        <Link
          to="/catalogo"
          className="inline-flex min-h-[48px] w-full sm:w-auto items-center justify-center rounded-xl border border-[#FF8A00] px-6 py-3 font-display text-sm font-bold uppercase text-white hover:text-[#FF8A00] transition-colors"
        >
          Ver catálogo
        </Link>
      </div>
    </div>
  );
};
