import React, { useEffect, useState } from 'react';
import { BRAND_LOGO_PATH, STORE_CONFIG } from '../config/store';
import { useCatalog } from '../context/CatalogContext';

interface BrandLogoProps {
  size?: 'compact' | 'header' | 'hero' | 'footer';
  className?: string;
}

const SIZE_CLASSES: Record<
  NonNullable<BrandLogoProps['size']>,
  { box: string; px: number; pad: string; radius: string }
> = {
  compact: {
    box: 'h-9 w-9',
    px: 36,
    pad: 'p-1.5',
    radius: 'rounded-xl',
  },
  header: {
    box: 'h-9 w-9 md:h-12 md:w-12',
    px: 48,
    pad: 'p-1 md:p-1.5',
    radius: 'rounded-xl',
  },
  hero: {
    box: 'h-24 w-24 sm:h-32 sm:w-32',
    px: 128,
    pad: 'p-3',
    radius: 'rounded-2xl',
  },
  footer: {
    box: 'h-20 w-20 sm:h-24 sm:w-24',
    px: 96,
    pad: 'p-2.5',
    radius: 'rounded-2xl',
  },
};

/**
 * Preserva o ficheiro oficial original do logótipo da Bercali Store por predefinição,
 * colocando-o numa caixa preta arredondada (#0A0A0A) para garantir leitura nítida
 * das letras brancas sobre o tema claro, sem alterar a imagem original.
 */
export const BrandLogo: React.FC<BrandLogoProps> = ({ size = 'header', className = '' }) => {
  const { storeSettings } = useCatalog();
  const [customLogoFailed, setCustomLogoFailed] = useState(false);

  useEffect(() => {
    setCustomLogoFailed(false);
  }, [storeSettings.logoUrl]);

  const spec = SIZE_CLASSES[size];
  const effectiveLogoSrc =
    storeSettings.logoUrl && !customLogoFailed ? storeSettings.logoUrl : BRAND_LOGO_PATH;
  const brandName = storeSettings.brandName || STORE_CONFIG.brandName;
  const slogan = storeSettings.slogan || STORE_CONFIG.slogan;

  return (
    <span
      className={`inline-flex w-fit items-center justify-center shrink-0 bg-[var(--bg-logo-box)] shadow-xs ${spec.radius} ${spec.pad} ${className}`}
    >
      <img
        src={effectiveLogoSrc}
        alt={`${brandName} — ${slogan}`}
        width={spec.px}
        height={spec.px}
        referrerPolicy="no-referrer"
        onError={() => {
          if (effectiveLogoSrc !== BRAND_LOGO_PATH) {
            setCustomLogoFailed(true);
          }
        }}
        className={`${spec.box} aspect-square object-contain select-none`}
      />
    </span>
  );
};
