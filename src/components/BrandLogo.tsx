import React, { useEffect, useState } from 'react';
import { BRAND_LOGO_PATH, STORE_CONFIG } from '../config/store';
import { useCatalog } from '../context/CatalogContext';

interface BrandLogoProps {
  size?: 'compact' | 'header' | 'hero' | 'footer';
  className?: string;
}

const SIZE_CLASSES: Record<
  NonNullable<BrandLogoProps['size']>,
  { box: string; px: number; pad: string }
> = {
  compact: {
    box: 'h-10 w-10',
    px: 40,
    pad: 'p-1',
  },
  header: {
    box: 'h-11 w-11 md:h-16 md:w-16',
    px: 64,
    pad: 'p-1 md:p-1.5',
  },
  hero: {
    box: 'h-28 w-28 sm:h-36 sm:w-36',
    px: 144,
    pad: 'p-3',
  },
  footer: {
    box: 'h-28 w-28 sm:h-32 sm:w-32',
    px: 128,
    pad: 'p-2.5',
  },
};

/**
 * Preserva o ficheiro oficial original do logótipo da Bercali Store por predefinição,
 * permitindo sincronizar o logótipo configurado no Painel Administrativo quando definido
 * em `store_settings`, com fallback automático para o logótipo original.
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
    <span className={`inline-flex items-center justify-center shrink-0 ${spec.pad} ${className}`}>
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
