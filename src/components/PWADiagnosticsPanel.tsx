import React, { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { RefreshCw, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { isPWADebugQueryEnabled } from '../utils/pwa';

interface ServiceWorkerDiagnosticState {
  supported: boolean;
  registered: boolean;
  stateLabel: string;
  scriptUrl: string | null;
  scope: string | null;
  controllingPage: boolean;
}

interface ManifestDiagnosticState {
  linkPresentInDom: boolean;
  linkHref: string | null;
  loaded: boolean;
  httpStatus: number | null;
  contentType: string | null;
  name: string | null;
  shortName: string | null;
  lang: string | null;
  display: string | null;
  iconsSummary: string | null;
  error: string | null;
}

export const PWADiagnosticsPanel: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const isDebugActive = isPWADebugQueryEnabled(location.search);

  const {
    isInstalled,
    isInstallableNatively,
    promptEverReceived,
    promptReceivedAt,
    wasRecentlyDismissed,
    wasPreviouslyInstalled,
    environment,
  } = usePWAInstall(location.pathname);

  const [dismissedLocally, setDismissedLocally] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [swDiag, setSwDiag] = useState<ServiceWorkerDiagnosticState>({
    supported: typeof navigator !== 'undefined' && 'serviceWorker' in navigator,
    registered: false,
    stateLabel: 'A verificar...',
    scriptUrl: null,
    scope: null,
    controllingPage: false,
  });
  const [manifestDiag, setManifestDiag] = useState<ManifestDiagnosticState>({
    linkPresentInDom: false,
    linkHref: null,
    loaded: false,
    httpStatus: null,
    contentType: null,
    name: null,
    shortName: null,
    lang: null,
    display: null,
    iconsSummary: null,
    error: null,
  });

  useEffect(() => {
    if (isDebugActive) {
      setDismissedLocally(false);
    }
  }, [isDebugActive, location.search]);

  const runDiagnostics = useCallback(async () => {
    if (typeof window === 'undefined') return;
    setRefreshing(true);

    // 1. Verificar Service Worker
    if (!('serviceWorker' in navigator)) {
      setSwDiag({
        supported: false,
        registered: false,
        stateLabel: 'Não suportado neste navegador',
        scriptUrl: null,
        scope: null,
        controllingPage: false,
      });
    } else {
      try {
        const reg = await navigator.serviceWorker.getRegistration('/');
        const worker = reg?.active || reg?.waiting || reg?.installing || null;
        let stateLabel = 'Não registado';
        if (reg) {
          if (reg.active) stateLabel = `Ativo (${reg.active.state})`;
          else if (reg.waiting) stateLabel = `Em espera (${reg.waiting.state})`;
          else if (reg.installing) stateLabel = `A instalar (${reg.installing.state})`;
          else stateLabel = 'Registado';
        } else if (!import.meta.env.PROD) {
          stateLabel = 'Não registado (modo desenvolvimento; ativo em produção)';
        }
        setSwDiag({
          supported: true,
          registered: Boolean(reg),
          stateLabel,
          scriptUrl: worker?.scriptURL ?? null,
          scope: reg?.scope ?? null,
          controllingPage: Boolean(navigator.serviceWorker.controller),
        });
      } catch (err) {
        setSwDiag({
          supported: true,
          registered: false,
          stateLabel: `Erro ao consultar (${err instanceof Error ? err.message : 'desconhecido'})`,
          scriptUrl: null,
          scope: null,
          controllingPage: false,
        });
      }
    }

    // 2. Verificar Manifest no DOM e via rede
    const linkEl = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    const linkHref = linkEl?.getAttribute('href') || null;
    const fetchTarget = linkHref || '/manifest.webmanifest';

    try {
      const response = await fetch(fetchTarget, { cache: 'no-store' });
      const contentType = response.headers.get('content-type');
      if (!response.ok) {
        setManifestDiag({
          linkPresentInDom: Boolean(linkEl),
          linkHref,
          loaded: false,
          httpStatus: response.status,
          contentType,
          name: null,
          shortName: null,
          lang: null,
          display: null,
          iconsSummary: null,
          error: `HTTP ${response.status}`,
        });
      } else {
        const data = (await response.json()) as Record<string, unknown>;
        const icons = Array.isArray(data.icons) ? data.icons : [];
        const iconsSummary = icons
          .map((icon) => {
            if (!icon || typeof icon !== 'object') return '';
            const rec = icon as Record<string, unknown>;
            return `${String(rec.sizes || '?')} (${String(rec.purpose || 'any')})`;
          })
          .filter(Boolean)
          .join(', ');

        setManifestDiag({
          linkPresentInDom: Boolean(linkEl),
          linkHref,
          loaded: true,
          httpStatus: response.status,
          contentType,
          name: typeof data.name === 'string' ? data.name : null,
          shortName: typeof data.short_name === 'string' ? data.short_name : null,
          lang: typeof data.lang === 'string' ? data.lang : null,
          display: typeof data.display === 'string' ? data.display : null,
          iconsSummary: iconsSummary || `${icons.length} ícones`,
          error: null,
        });
      }
    } catch (err) {
      setManifestDiag({
        linkPresentInDom: Boolean(linkEl),
        linkHref,
        loaded: false,
        httpStatus: null,
        contentType: null,
        name: null,
        shortName: null,
        lang: null,
        display: null,
        iconsSummary: null,
        error: err instanceof Error ? err.message : 'Falha ao carregar manifest',
      });
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!isDebugActive || dismissedLocally) return;
    void runDiagnostics();
  }, [isDebugActive, dismissedLocally, runDiagnostics]);

  if (!isDebugActive || dismissedLocally) {
    return null;
  }

  const handleClose = () => {
    setDismissedLocally(true);
    try {
      const params = new URLSearchParams(location.search);
      params.delete('debug');
      const nextSearch = params.toString();
      navigate(
        {
          pathname: location.pathname,
          search: nextSearch ? `?${nextSearch}` : '',
          hash: location.hash,
        },
        { replace: true }
      );
    } catch {
      // Mantém oculto pelo estado local
    }
  };

  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const protocol = typeof window !== 'undefined' ? window.location.protocol : '';
  const promptTimeFormatted = promptReceivedAt
    ? new Date(promptReceivedAt).toLocaleTimeString('pt-AO')
    : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pwa-diagnostics-title"
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/55 p-3 sm:p-4"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-4 sm:p-5 shadow-[var(--shadow-elevated)] space-y-3 max-h-[calc(100dvh-24px)] overflow-y-auto text-xs text-[var(--text-primary)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 pb-2 border-b border-[var(--border-subtle)]">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--brand-orange-text)]">
              Diagnóstico Técnico
            </p>
            <h2 id="pwa-diagnostics-title" className="font-display text-sm sm:text-base font-bold text-[var(--text-primary)]">
              Estado de Instalação PWA
            </h2>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => void runDiagnostics()}
              aria-label="Atualizar diagnóstico PWA"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border-input)] bg-[var(--bg-subtle)] text-[var(--text-primary)] hover:border-[var(--brand-orange)] hover:text-[var(--brand-orange-text)] cursor-pointer"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={handleClose}
              aria-label="Fechar diagnóstico PWA"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <dl className="space-y-2">
          <div className="rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)] p-2.5 flex items-center justify-between gap-3">
            <dt className="text-[var(--text-secondary)] font-medium">Contexto seguro (HTTPS)</dt>
            <dd className={environment.isSecureContext ? 'font-bold text-[var(--status-available)]' : 'font-bold text-[var(--status-error)]'}>
              {environment.isSecureContext ? `Sim (${protocol})` : `Não (${protocol})`}
            </dd>
          </div>

          <div className="rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)] p-2.5 space-y-1">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[var(--text-secondary)] font-medium">Service Worker registado</dt>
              <dd className={swDiag.registered ? 'font-bold text-[var(--status-available)]' : 'font-bold text-[var(--brand-orange-text)]'}>
                {swDiag.registered ? 'Sim' : 'Não'}
              </dd>
            </div>
            <p className="text-[11px] text-[var(--text-primary)]">
              Estado: {swDiag.stateLabel}
              {swDiag.controllingPage ? ' · A controlar página' : ''}
            </p>
            {swDiag.scriptUrl && (
              <p className="text-[11px] text-[var(--text-secondary)] break-all">Script: {swDiag.scriptUrl}</p>
            )}
          </div>

          <div className="rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)] p-2.5 space-y-1">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[var(--text-secondary)] font-medium">Manifest carregado</dt>
              <dd className={manifestDiag.loaded ? 'font-bold text-[var(--status-available)]' : 'font-bold text-[var(--status-error)]'}>
                {manifestDiag.loaded ? `Sim (HTTP ${manifestDiag.httpStatus})` : `Não (${manifestDiag.error || 'erro'})`}
              </dd>
            </div>
            <p className="text-[11px] text-[var(--text-primary)]">
              Link HTML: {manifestDiag.linkPresentInDom ? manifestDiag.linkHref : 'Em falta'} · Content-Type:{' '}
              {manifestDiag.contentType || 'n/d'}
            </p>
            {manifestDiag.loaded && (
              <p className="text-[11px] text-[var(--text-secondary)]">
                {manifestDiag.name} ({manifestDiag.shortName}) · lang={manifestDiag.lang} ·{' '}
                {manifestDiag.display} · Ícones: {manifestDiag.iconsSummary}
              </p>
            )}
          </div>

          <div className="rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)] p-2.5 space-y-1">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[var(--text-secondary)] font-medium">Evento beforeinstallprompt</dt>
              <dd
                className={
                  isInstallableNatively
                    ? 'font-bold text-[var(--status-available)]'
                    : promptEverReceived
                    ? 'font-bold text-[var(--brand-orange-text)]'
                    : 'font-bold text-[var(--text-primary)]'
                }
              >
                {isInstallableNatively
                  ? 'Recebido (pronto)'
                  : promptEverReceived
                  ? 'Recebido (já utilizado)'
                  : 'Não recebido'}
              </dd>
            </div>
            <p className="text-[11px] text-[var(--text-secondary)]">
              {promptTimeFormatted ? `Capturado às ${promptTimeFormatted} · ` : ''}
              Dispensada recentemente: {wasRecentlyDismissed ? 'Sim' : 'Não'} · Já instalada antes:{' '}
              {wasPreviouslyInstalled ? 'Sim' : 'Não'}
            </p>
          </div>

          <div className="rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)] p-2.5 flex items-center justify-between gap-3">
            <dt className="text-[var(--text-secondary)] font-medium">Modo atual</dt>
            <dd className={isInstalled ? 'font-bold text-[var(--status-available)]' : 'font-bold text-[var(--text-primary)]'}>
              {isInstalled ? 'Instalada (standalone)' : 'Navegador'}
            </dd>
          </div>

          <div className="rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)] p-2.5 space-y-1">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[var(--text-secondary)] font-medium">Navegador interno</dt>
              <dd className={environment.isInAppBrowser ? 'font-bold text-[var(--brand-orange-text)]' : 'font-bold text-[var(--status-available)]'}>
                {environment.isInAppBrowser
                  ? `Sim (${environment.inAppName || 'WebView'})`
                  : 'Não'}
              </dd>
            </div>
            <p className="text-[11px] text-[var(--text-secondary)]">
              Detetado: SO={environment.os} · Navegador={environment.browser}
              {environment.isInIframe ? ' · Em iframe' : ''}
            </p>
          </div>

          <div className="rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)] p-2.5 space-y-1">
            <dt className="text-[var(--text-secondary)] font-medium">User-Agent</dt>
            <dd className="text-[11px] text-[var(--text-primary)] break-all font-mono leading-relaxed">
              {userAgent}
            </dd>
          </div>
        </dl>

        <button
          type="button"
          onClick={handleClose}
          className="inline-flex min-h-[42px] w-full items-center justify-center rounded-xl bg-[var(--brand-orange)] px-4 py-2 font-display text-xs font-bold uppercase text-[var(--text-on-accent)] hover:bg-[var(--brand-yellow)] transition-colors cursor-pointer"
        >
          Fechar
        </button>
      </div>
    </div>
  );
};
