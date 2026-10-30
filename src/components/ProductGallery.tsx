import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronLeft,
  ChevronRight,
  Film,
  ImageOff,
  Images,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type { Product } from '../types/store';

interface ProductGalleryProps {
  product: Product;
}

export const ProductGallery: React.FC<ProductGalleryProps> = ({ product }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [mediaMode, setMediaMode] = useState<'photos' | 'video'>('photos');
  const [zoomOpen, setZoomOpen] = useState(false);
  const [brokenIndices, setBrokenIndices] = useState<Record<number, boolean>>({});
  const [zoomScale, setZoomScale] = useState(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const carouselRef = useRef<HTMLDivElement | null>(null);
  const thumbsContainerRef = useRef<HTMLDivElement | null>(null);
  const thumbButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const gestureRef = useRef<{
    mode: 'none' | 'swipe_or_pan' | 'pinch';
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    panStartX: number;
    panStartY: number;
    startPinchDist: number;
    startScale: number;
    lastTapAt: number;
    moved: boolean;
  }>({
    mode: 'none',
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    panStartX: 0,
    panStartY: 0,
    startPinchDist: 0,
    startScale: 1,
    lastTapAt: 0,
    moved: false,
  });

  const scrollCarouselTo = useCallback((index: number, behavior: ScrollBehavior = 'smooth') => {
    const el = carouselRef.current;
    if (!el || el.clientWidth <= 0) return;
    el.scrollTo({ left: index * el.clientWidth, behavior });
  }, []);

  const selectSlide = useCallback(
    (nextIndex: number, behavior: ScrollBehavior = 'smooth') => {
      if (product.images.length === 0) return;
      const normalized =
        ((nextIndex % product.images.length) + product.images.length) % product.images.length;
      setActiveIndex(normalized);
      setZoomScale(1);
      setPanOffset({ x: 0, y: 0 });
      scrollCarouselTo(normalized, behavior);
    },
    [product.images.length, scrollCarouselTo]
  );

  useEffect(() => {
    setActiveIndex(0);
    setMediaMode('photos');
    setZoomOpen(false);
    setBrokenIndices({});
    setZoomScale(1);
    setPanOffset({ x: 0, y: 0 });
    if (carouselRef.current) {
      carouselRef.current.scrollTo({ left: 0, behavior: 'auto' });
    }
  }, [product.id]);

  // Centrar miniatura ativa horizontalmente sem fazer scroll vertical na página
  useEffect(() => {
    const container = thumbsContainerRef.current;
    const activeBtn = thumbButtonRefs.current[activeIndex];
    if (!container || !activeBtn) return;
    const targetLeft =
      activeBtn.offsetLeft - container.clientWidth / 2 + activeBtn.clientWidth / 2;
    container.scrollTo({ left: Math.max(0, targetLeft), behavior: 'smooth' });
  }, [activeIndex]);

  // Bloquear scroll da página por trás quando o visualizador em ecrã inteiro está aberto
  useEffect(() => {
    if (!zoomOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [zoomOpen]);

  const goPrev = useCallback(() => {
    if (product.images.length <= 1) return;
    selectSlide(activeIndex - 1, zoomOpen ? 'auto' : 'smooth');
  }, [activeIndex, product.images.length, selectSlide, zoomOpen]);

  const goNext = useCallback(() => {
    if (product.images.length <= 1) return;
    selectSlide(activeIndex + 1, zoomOpen ? 'auto' : 'smooth');
  }, [activeIndex, product.images.length, selectSlide, zoomOpen]);

  useEffect(() => {
    if (!zoomOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setZoomOpen(false);
        setZoomScale(1);
        setPanOffset({ x: 0, y: 0 });
      } else if (e.key === 'ArrowRight' && product.images.length > 1) {
        goNext();
      } else if (e.key === 'ArrowLeft' && product.images.length > 1) {
        goPrev();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [zoomOpen, product.images.length, goNext, goPrev]);

  const hasPhotos = product.images.length > 0;
  const hasVideo = Boolean(product.video && (product.video.webm || product.video.mp4));
  const currentImage =
    hasPhotos && !brokenIndices[activeIndex] ? product.images[activeIndex] : null;

  const handleCarouselScroll = () => {
    const el = carouselRef.current;
    if (!el || el.clientWidth <= 0 || product.images.length <= 1) return;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    const clamped = Math.max(0, Math.min(product.images.length - 1, idx));
    if (clamped !== activeIndex) {
      setActiveIndex(clamped);
    }
  };

  const openFullscreen = (index: number) => {
    setActiveIndex(index);
    setZoomScale(1);
    setPanOffset({ x: 0, y: 0 });
    setZoomOpen(true);
  };

  const closeFullscreen = () => {
    setZoomOpen(false);
    setZoomScale(1);
    setPanOffset({ x: 0, y: 0 });
  };

  const toggleZoom = () => {
    if (zoomScale > 1.05) {
      setZoomScale(1);
      setPanOffset({ x: 0, y: 0 });
    } else {
      setZoomScale(2.2);
      setPanOffset({ x: 0, y: 0 });
    }
  };

  const handleViewerTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      gestureRef.current.mode = 'pinch';
      gestureRef.current.startPinchDist = Math.hypot(dx, dy) || 1;
      gestureRef.current.startScale = zoomScale;
      gestureRef.current.moved = true;
      return;
    }

    if (e.touches.length === 1) {
      const touch = e.touches[0];
      gestureRef.current.mode = 'swipe_or_pan';
      gestureRef.current.startX = touch.clientX;
      gestureRef.current.startY = touch.clientY;
      gestureRef.current.lastX = touch.clientX;
      gestureRef.current.lastY = touch.clientY;
      gestureRef.current.panStartX = panOffset.x;
      gestureRef.current.panStartY = panOffset.y;
      gestureRef.current.moved = false;
    }
  };

  const handleViewerTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (gestureRef.current.mode === 'pinch' && e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy) || 1;
      const nextScale = Math.min(
        3,
        Math.max(1, gestureRef.current.startScale * (dist / gestureRef.current.startPinchDist))
      );
      setZoomScale(nextScale);
      if (nextScale <= 1.05) {
        setPanOffset({ x: 0, y: 0 });
      }
      return;
    }

    if (gestureRef.current.mode === 'swipe_or_pan' && e.touches.length === 1) {
      const touch = e.touches[0];
      const dx = touch.clientX - gestureRef.current.startX;
      const dy = touch.clientY - gestureRef.current.startY;
      gestureRef.current.lastX = touch.clientX;
      gestureRef.current.lastY = touch.clientY;

      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
        gestureRef.current.moved = true;
      }

      if (zoomScale > 1.05) {
        const maxPan = 180 * (zoomScale - 1);
        setPanOffset({
          x: Math.max(-maxPan, Math.min(maxPan, gestureRef.current.panStartX + dx)),
          y: Math.max(-maxPan, Math.min(maxPan, gestureRef.current.panStartY + dy)),
        });
      }
    }
  };

  const handleViewerTouchEnd = () => {
    const g = gestureRef.current;

    if (g.mode === 'pinch') {
      if (zoomScale <= 1.08) {
        setZoomScale(1);
        setPanOffset({ x: 0, y: 0 });
      }
      g.mode = 'none';
      return;
    }

    if (g.mode === 'swipe_or_pan') {
      const dx = g.lastX - g.startX;
      const dy = g.lastY - g.startY;

      if (!g.moved) {
        const now = Date.now();
        if (now - g.lastTapAt < 280) {
          toggleZoom();
          g.lastTapAt = 0;
        } else {
          g.lastTapAt = now;
        }
      } else if (zoomScale <= 1.05 && Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.2) {
        if (dx < 0) {
          goNext();
        } else {
          goPrev();
        }
      }

      g.mode = 'none';
    }
  };

  return (
    <div className="flex flex-col">
      {/* Alternador Fotografias / Vídeo demonstrativo (mantido quando existir vídeo) */}
      {hasVideo && (
        <div className="px-3.5 sm:px-6 lg:px-0 pb-2.5">
          <div
            role="tablist"
            aria-label="Selecionar tipo de multimédia"
            className="inline-flex rounded-lg bg-[#1A1A1A] border border-white/10 p-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mediaMode === 'photos'}
              onClick={() => setMediaMode('photos')}
              className={`inline-flex min-h-[38px] items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
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
              className={`inline-flex min-h-[38px] items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                mediaMode === 'video'
                  ? 'bg-[#FF8A00] font-display font-bold text-[#0A0A0A]'
                  : 'text-white/80 hover:text-white'
              }`}
            >
              <Film className="h-4 w-4" />
              <span>Vídeo demonstrativo</span>
            </button>
          </div>
        </div>
      )}

      {/* Área principal da galeria — largura total no telemóvel, foto inteira sem cortes */}
      {mediaMode === 'video' && product.video ? (
        <div className="w-full overflow-hidden bg-[#141414] lg:rounded-2xl">
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
          <div className="relative w-full overflow-hidden bg-[#161618] lg:rounded-2xl">
            {hasPhotos ? (
              <>
                <div
                  ref={carouselRef}
                  onScroll={handleCarouselScroll}
                  className="flex w-full overflow-x-auto snap-x snap-mandatory scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                >
                  {product.images.map((imgSrc, idx) => {
                    const isBroken = Boolean(brokenIndices[idx]);
                    return (
                      <div
                        key={`${product.id}-slide-${idx}`}
                        className="flex h-[310px] sm:h-[400px] lg:h-[460px] w-full shrink-0 snap-center items-center justify-center bg-[#161618]"
                      >
                        {!isBroken ? (
                          <button
                            type="button"
                            onClick={() => openFullscreen(idx)}
                            aria-label={`Ampliar fotografia ${idx + 1} de ${product.images.length} de ${product.name}`}
                            className="flex h-full w-full items-center justify-center cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#FF8A00]"
                          >
                            <img
                              src={imgSrc}
                              alt={`${product.name} — fotografia ${idx + 1} de ${product.images.length}`}
                              width={900}
                              height={900}
                              loading={idx === 0 ? 'eager' : 'lazy'}
                              fetchPriority={idx === 0 ? 'high' : 'auto'}
                              decoding="async"
                              referrerPolicy="no-referrer"
                              onError={() =>
                                setBrokenIndices((prev) => ({ ...prev, [idx]: true }))
                              }
                              className="h-full w-full object-contain select-none"
                            />
                          </button>
                        ) : (
                          <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-6 text-center">
                            <ImageOff className="h-10 w-10 text-[#8A8A8A]" aria-hidden="true" />
                            <p className="font-display text-sm font-bold text-white">
                              Fotografia indisponível
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Setas laterais opcionais */}
                {product.images.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => selectSlide(activeIndex - 1)}
                      aria-label="Fotografia anterior"
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/65 border border-white/15 text-white hover:bg-black/85 hover:border-[#FF8A00] hover:text-[#FF8A00] transition-colors cursor-pointer"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => selectSlide(activeIndex + 1)}
                      aria-label="Fotografia seguinte"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/65 border border-white/15 text-white hover:bg-black/85 hover:border-[#FF8A00] hover:text-[#FF8A00] transition-colors cursor-pointer"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </>
                )}

                {/* Contador estilo Alibaba sobre a imagem */}
                <div className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-black/75 backdrop-blur-sm px-3 py-1 text-xs font-medium text-white tabular-nums">
                  Fotos {activeIndex + 1}/{product.images.length}
                </div>
              </>
            ) : (
              <div className="flex h-[280px] sm:h-[360px] w-full flex-col items-center justify-center gap-2.5 p-6 text-center bg-[#161618]">
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

          {/* Miniaturas clicáveis por baixo com destaque laranja */}
          {product.images.length > 1 && (
            <div
              ref={thumbsContainerRef}
              className="flex items-center gap-2 overflow-x-auto px-3.5 sm:px-6 lg:px-0 pt-2.5 pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
            >
              {product.images.map((imgSrc, idx) => {
                const isSelected = idx === activeIndex;
                return (
                  <button
                    key={`${product.id}-thumb-${idx}`}
                    ref={(el) => {
                      thumbButtonRefs.current[idx] = el;
                    }}
                    type="button"
                    onClick={() => selectSlide(idx)}
                    aria-label={`Ver fotografia ${idx + 1} de ${product.images.length}`}
                    aria-current={isSelected ? 'true' : undefined}
                    className={`relative h-16 w-16 sm:h-[68px] sm:w-[68px] shrink-0 overflow-hidden rounded-xl bg-[#161618] p-1 transition-all cursor-pointer ${
                      isSelected
                        ? 'border-2 border-[#FF8A00] ring-2 ring-[#FF8A00]/30 opacity-100'
                        : 'border border-white/15 opacity-65 hover:opacity-100 hover:border-white/35'
                    }`}
                  >
                    <img
                      src={imgSrc}
                      alt=""
                      width={136}
                      height={136}
                      loading="lazy"
                      decoding="async"
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-contain"
                    />
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Visualizador em Ecrã Inteiro — fundo 100% preto opaco via Portal */}
      {zoomOpen &&
        currentImage &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Fotografia ampliada de ${product.name}`}
            className="fixed inset-0 z-[100] flex flex-col bg-[#000000] text-white select-none"
          >
            {/* Topo dedicado: contador "1 de N" e botão "Fechar" sempre visíveis sem tapar a foto */}
            <div className="shrink-0 flex h-14 items-center justify-between border-b border-white/10 bg-[#000000] px-4">
              <span className="font-display text-sm font-semibold text-white tabular-nums">
                {activeIndex + 1} de {product.images.length}
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleZoom}
                  aria-label={zoomScale > 1.05 ? 'Reduzir zoom' : 'Ampliar zoom'}
                  className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg bg-[#1A1A1A] border border-white/15 text-white hover:border-[#FF8A00] hover:text-[#FF8A00] transition-colors cursor-pointer"
                >
                  {zoomScale > 1.05 ? (
                    <ZoomOut className="h-4 w-4" />
                  ) : (
                    <ZoomIn className="h-4 w-4" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={closeFullscreen}
                  aria-label="Fechar imagem ampliada"
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-[#1A1A1A] border border-white/20 px-3.5 py-2 text-xs font-semibold text-white hover:border-[#FF8A00] transition-colors cursor-pointer"
                >
                  <X className="h-4 w-4 text-[#FF8A00]" />
                  <span>Fechar</span>
                </button>
              </div>
            </div>

            {/* Palco central 100% preto opaco com foto inteira centrada, swipe e zoom */}
            <div className="relative flex flex-1 min-h-0 w-full bg-[#000000]">
              <div
                onTouchStart={handleViewerTouchStart}
                onTouchMove={handleViewerTouchMove}
                onTouchEnd={handleViewerTouchEnd}
                onDoubleClick={toggleZoom}
                className={`flex h-full w-full items-center justify-center bg-[#000000] ${
                  zoomScale > 1.05 ? 'overflow-auto p-4' : 'overflow-hidden px-2 py-2 touch-none'
                }`}
              >
                <img
                  src={currentImage}
                  alt={`${product.name} — fotografia ${activeIndex + 1} de ${product.images.length}`}
                  width={1400}
                  height={1400}
                  decoding="async"
                  referrerPolicy="no-referrer"
                  draggable={false}
                  className={
                    zoomScale > 1.05
                      ? 'max-h-none max-w-none w-[190%] sm:w-[150%] h-auto object-contain select-none transition-all duration-200 cursor-zoom-out'
                      : 'max-h-full max-w-full object-contain select-none transition-all duration-200 cursor-zoom-in'
                  }
                />
              </div>

              {product.images.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={goPrev}
                    aria-label="Fotografia anterior na vista ampliada"
                    className="absolute left-3 top-1/2 -translate-y-1/2 inline-flex h-11 w-11 items-center justify-center rounded-full bg-black/80 border border-white/20 text-white hover:border-[#FF8A00] hover:text-[#FF8A00] transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={goNext}
                    aria-label="Fotografia seguinte na vista ampliada"
                    className="absolute right-3 top-1/2 -translate-y-1/2 inline-flex h-11 w-11 items-center justify-center rounded-full bg-black/80 border border-white/20 text-white hover:border-[#FF8A00] hover:text-[#FF8A00] transition-colors cursor-pointer"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </>
              )}
            </div>

            {/* Indicador inferior discreto quando há várias fotos */}
            {product.images.length > 1 && (
              <div className="shrink-0 flex items-center justify-center gap-2 bg-[#000000] py-3 px-4">
                {product.images.map((_, idx) => (
                  <button
                    key={`${product.id}-fs-dot-${idx}`}
                    type="button"
                    onClick={() => selectSlide(idx, 'auto')}
                    aria-label={`Ir para fotografia ${idx + 1}`}
                    className={`h-2 rounded-full transition-all cursor-pointer ${
                      idx === activeIndex ? 'w-6 bg-[#FF8A00]' : 'w-2 bg-white/30 hover:bg-white/60'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>,
          document.body
        )}
    </div>
  );
};
