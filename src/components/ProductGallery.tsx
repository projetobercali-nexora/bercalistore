import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Expand, Film, ImageOff, Images, X } from 'lucide-react';
import type { Product } from '../types/store';

interface ProductGalleryProps {
  product: Product;
}

export const ProductGallery: React.FC<ProductGalleryProps> = ({ product }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [mediaMode, setMediaMode] = useState<'photos' | 'video'>('photos');
  const [zoomOpen, setZoomOpen] = useState(false);
  const [brokenIndices, setBrokenIndices] = useState<Record<number, boolean>>({});

  useEffect(() => {
    setActiveIndex(0);
    setMediaMode('photos');
    setZoomOpen(false);
    setBrokenIndices({});
  }, [product.id]);

  useEffect(() => {
    if (!zoomOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setZoomOpen(false);
      } else if (e.key === 'ArrowRight' && product.images.length > 1) {
        setActiveIndex((prev) => (prev + 1) % product.images.length);
      } else if (e.key === 'ArrowLeft' && product.images.length > 1) {
        setActiveIndex((prev) => (prev - 1 + product.images.length) % product.images.length);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [zoomOpen, product.images.length]);

  const hasPhotos = product.images.length > 0;
  const hasVideo = Boolean(product.video && (product.video.webm || product.video.mp4));
  const currentImage =
    hasPhotos && !brokenIndices[activeIndex] ? product.images[activeIndex] : null;

  const goPrev = () => {
    if (product.images.length <= 1) return;
    setActiveIndex((prev) => (prev - 1 + product.images.length) % product.images.length);
  };

  const goNext = () => {
    if (product.images.length <= 1) return;
    setActiveIndex((prev) => (prev + 1) % product.images.length);
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Alternador Fotografias / Vídeo demonstrativo (carregamento diferido do vídeo) */}
      {hasVideo && (
        <div
          role="tablist"
          aria-label="Selecionar tipo de multimédia"
          className="inline-flex self-start rounded-lg bg-[#1A1A1A] border border-white/10 p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mediaMode === 'photos'}
            onClick={() => setMediaMode('photos')}
            className={`inline-flex min-h-[40px] items-center gap-2 rounded-md px-3.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
              mediaMode === 'photos'
                ? 'bg-[#FF8A00] font-display font-bold text-[#0A0A0A]'
                : 'text-white/80 hover:text-white'
            }`}
          >
            <Images className="h-4 w-4" />
            <span>Fotografias ({product.images.length})</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={mediaMode === 'video'}
            onClick={() => setMediaMode('video')}
            className={`inline-flex min-h-[40px] items-center gap-2 rounded-md px-3.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
              mediaMode === 'video'
                ? 'bg-[#FF8A00] font-display font-bold text-[#0A0A0A]'
                : 'text-white/80 hover:text-white'
            }`}
          >
            <Film className="h-4 w-4" />
            <span>Vídeo demonstrativo</span>
          </button>
        </div>
      )}

      {/* Área principal da galeria */}
      {mediaMode === 'video' && product.video ? (
        <div className="overflow-hidden rounded-xl bg-[#1A1A1A] border border-white/10">
          <div className="aspect-video w-full bg-[#0A0A0A]">
            <video
              controls
              playsInline
              preload="metadata"
              poster={product.video.poster}
              aria-label={`Vídeo demonstrativo de ${product.name}`}
              className="h-full w-full object-contain"
            >
              {product.video.webm && <source src={product.video.webm} type="video/webm" />}
              {product.video.mp4 && <source src={product.video.mp4} type="video/mp4" />}
              O teu navegador não suporta a reprodução nativa de vídeo.
            </video>
          </div>
          {product.video.caption && (
            <p className="px-4 py-2.5 text-xs text-[#8A8A8A] border-t border-white/10">
              {product.video.caption}
            </p>
          )}
        </div>
      ) : (
        <>
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-[#1A1A1A] border border-white/10">
            {currentImage ? (
              <>
                <button
                  type="button"
                  onClick={() => setZoomOpen(true)}
                  aria-label={`Ampliar fotografia ${activeIndex + 1} de ${product.name}`}
                  className="group block h-full w-full cursor-zoom-in"
                >
                  <img
                    src={currentImage}
                    alt={`${product.name} — fotografia ${activeIndex + 1} de ${product.images.length}`}
                    width={800}
                    height={600}
                    referrerPolicy="no-referrer"
                    onError={() =>
                      setBrokenIndices((prev) => ({ ...prev, [activeIndex]: true }))
                    }
                    className="h-full w-full object-contain bg-[#121212]"
                  />
                  <span className="pointer-events-none absolute top-3 right-3 inline-flex items-center gap-1.5 rounded-lg bg-[#0A0A0A]/85 border border-white/15 px-3 py-1.5 text-xs font-medium text-white">
                    <Expand className="h-3.5 w-3.5 text-[#FF8A00]" />
                    <span>Tocar para ampliar</span>
                  </span>
                </button>

                {product.images.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={goPrev}
                      aria-label="Fotografia anterior"
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#0A0A0A]/85 border border-white/15 text-white hover:border-[#FF8A00] hover:text-[#FF8A00] transition-colors cursor-pointer"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      onClick={goNext}
                      aria-label="Fotografia seguinte"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#0A0A0A]/85 border border-white/15 text-white hover:border-[#FF8A00] hover:text-[#FF8A00] transition-colors cursor-pointer"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </>
                )}
              </>
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-2.5 p-6 text-center bg-[#121212]">
                <ImageOff className="h-10 w-10 text-[#8A8A8A]" aria-hidden="true" />
                <p className="font-display text-sm font-bold text-white">
                  Espaço reservado para fotografia oficial
                </p>
                <p className="max-w-xs text-xs text-[#8A8A8A]">
                  Este artigo ainda não possui fotografias reais associadas no catálogo.
                </p>
              </div>
            )}
          </div>

          {/* Miniaturas das fotografias */}
          {product.images.length > 1 && (
            <div className="flex items-center gap-2.5 overflow-x-auto pb-1">
              {product.images.map((imgSrc, idx) => {
                const isSelected = idx === activeIndex;
                return (
                  <button
                    key={`${product.id}-thumb-${idx}`}
                    type="button"
                    onClick={() => setActiveIndex(idx)}
                    aria-label={`Ver fotografia ${idx + 1} de ${product.images.length}`}
                    aria-current={isSelected ? 'true' : undefined}
                    className={`relative h-16 w-20 shrink-0 overflow-hidden rounded-lg border-2 bg-[#121212] transition-colors cursor-pointer ${
                      isSelected ? 'border-[#FF8A00]' : 'border-white/10 hover:border-white/30'
                    }`}
                  >
                    <img
                      src={imgSrc}
                      alt=""
                      width={160}
                      height={120}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover"
                    />
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Modal de ampliação (Lightbox acessível) */}
      {zoomOpen && currentImage && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Fotografia ampliada de ${product.name}`}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/92 p-4"
          onClick={() => setZoomOpen(false)}
        >
          <div
            className="relative flex w-full max-w-4xl flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex w-full items-center justify-between text-white">
              <span className="text-sm text-[#8A8A8A] tabular-nums">
                Fotografia {activeIndex + 1} de {product.images.length}
              </span>
              <button
                type="button"
                onClick={() => setZoomOpen(false)}
                aria-label="Fechar imagem ampliada"
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-[#1A1A1A] border border-white/15 px-3.5 py-2 text-xs font-medium text-white hover:border-[#FF8A00] cursor-pointer"
              >
                <X className="h-4 w-4 text-[#FF8A00]" />
                <span>Fechar</span>
              </button>
            </div>

            <div className="relative flex w-full items-center justify-center overflow-hidden rounded-xl bg-[#121212] border border-white/15 p-2">
              <img
                src={currentImage}
                alt={`${product.name} ampliado`}
                width={1200}
                height={900}
                referrerPolicy="no-referrer"
                className="max-h-[75dvh] w-auto object-contain"
              />

              {product.images.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={goPrev}
                    aria-label="Fotografia anterior na vista ampliada"
                    className="absolute left-3 top-1/2 -translate-y-1/2 inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#0A0A0A]/85 border border-white/20 text-white hover:border-[#FF8A00] cursor-pointer"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={goNext}
                    aria-label="Fotografia seguinte na vista ampliada"
                    className="absolute right-3 top-1/2 -translate-y-1/2 inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#0A0A0A]/85 border border-white/20 text-white hover:border-[#FF8A00] cursor-pointer"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
