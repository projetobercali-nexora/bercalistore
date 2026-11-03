import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectInstallEnvironment,
  formatInstallOutcomeFeedback,
  getUnavailableInstallMessage,
  IOS_UNAVAILABLE_INSTALL_MESSAGE,
  isPWADebugQueryEnabled,
  isStandaloneDisplayMode,
  UNAVAILABLE_INSTALL_MESSAGE,
} from './pwa';

test('isStandaloneDisplayMode detects installed standalone mode without false positives on minimal-ui', () => {
  assert.equal(
    isStandaloneDisplayMode({
      standaloneMediaMatches: false,
      minimalUiMediaMatches: true,
      navigatorStandalone: false,
      referrer: 'https://google.com',
    }),
    false
  );

  assert.equal(
    isStandaloneDisplayMode({
      standaloneMediaMatches: true,
      navigatorStandalone: false,
    }),
    true
  );

  assert.equal(
    isStandaloneDisplayMode({
      standaloneMediaMatches: false,
      windowControlsOverlayMediaMatches: true,
      navigatorStandalone: false,
    }),
    true
  );

  assert.equal(
    isStandaloneDisplayMode({
      standaloneMediaMatches: false,
      navigatorStandalone: true,
    }),
    true
  );

  assert.equal(
    isStandaloneDisplayMode({
      standaloneMediaMatches: false,
      referrer: 'android-app://ao.bercalistore.app',
    }),
    true
  );
});

test('detectInstallEnvironment accurately detects iPhone, iPad, iPadOS desktop-mode, Android, and desktop browsers', () => {
  const iphoneSafari = detectInstallEnvironment({
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  });
  assert.equal(iphoneSafari.isIOS, true);
  assert.equal(iphoneSafari.os, 'ios');
  assert.equal(iphoneSafari.browser, 'safari');

  const ipadClassic = detectInstallEnvironment({
    userAgent:
      'Mozilla/5.0 (iPad; CPU OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
  });
  assert.equal(ipadClassic.isIOS, true);
  assert.equal(ipadClassic.os, 'ios');

  const ipadDesktopUA = detectInstallEnvironment({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
    platform: 'MacIntel',
    maxTouchPoints: 5,
  });
  assert.equal(ipadDesktopUA.isIOS, true);
  assert.equal(ipadDesktopUA.isMobile, true);
  assert.equal(ipadDesktopUA.os, 'ios');

  const macSafari = detectInstallEnvironment({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
    platform: 'MacIntel',
    maxTouchPoints: 0,
  });
  assert.equal(macSafari.isIOS, false);
  assert.equal(macSafari.isMobile, false);
  assert.equal(macSafari.os, 'macos');

  const androidChrome = detectInstallEnvironment({
    userAgent:
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36',
  });
  assert.equal(androidChrome.isAndroid, true);
  assert.equal(androidChrome.isIOS, false);
  assert.equal(androidChrome.browser, 'chrome');

  const winEdge = detectInstallEnvironment({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 Edg/128.0.0.0',
    platform: 'Win32',
    maxTouchPoints: 0,
  });
  assert.equal(winEdge.isMobile, false);
  assert.equal(winEdge.os, 'windows');
  assert.equal(winEdge.browser, 'edge');
});

test('getUnavailableInstallMessage returns exact discrete messages without browser menu instructions', () => {
  const iosEnv = detectInstallEnvironment({
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1',
  });
  assert.equal(
    getUnavailableInstallMessage(iosEnv),
    'A instalação direta não está disponível neste dispositivo.'
  );
  assert.equal(getUnavailableInstallMessage(iosEnv), IOS_UNAVAILABLE_INSTALL_MESSAGE);

  const androidEnv = detectInstallEnvironment({
    userAgent:
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/128.0.0.0 Mobile Safari/537.36',
  });
  assert.equal(
    getUnavailableInstallMessage(androidEnv),
    'Neste momento, a instalação não está disponível neste dispositivo.'
  );
  assert.equal(getUnavailableInstallMessage(androidEnv), UNAVAILABLE_INSTALL_MESSAGE);

  const desktopEnv = detectInstallEnvironment({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:129.0) Gecko/20100101 Firefox/129.0',
  });
  assert.equal(
    getUnavailableInstallMessage(desktopEnv),
    'Neste momento, a instalação não está disponível neste dispositivo.'
  );

  // Garante ausência total de instruções manuais de menu do navegador
  for (const msg of [IOS_UNAVAILABLE_INSTALL_MESSAGE, UNAVAILABLE_INSTALL_MESSAGE]) {
    assert.ok(!/menu|chrome|partilhar|ecrã inicial|ferramentas|opções/i.test(msg));
  }
});

test('formatInstallOutcomeFeedback handles accepted, dismissed, failed, and unavailable states cleanly', () => {
  const accepted = formatInstallOutcomeFeedback('accepted', { isIOS: false });
  assert.equal(accepted?.tone, 'success');
  assert.equal(accepted?.message, 'Aplicação instalada neste dispositivo.');

  assert.equal(formatInstallOutcomeFeedback('dismissed', { isIOS: false }), null);

  const failedAndroid = formatInstallOutcomeFeedback('failed', { isIOS: false });
  assert.equal(failedAndroid?.message, UNAVAILABLE_INSTALL_MESSAGE);

  const unavailableIOS = formatInstallOutcomeFeedback('unavailable', { isIOS: true });
  assert.equal(unavailableIOS?.message, IOS_UNAVAILABLE_INSTALL_MESSAGE);
});

test('isPWADebugQueryEnabled works deterministically', () => {
  assert.equal(isPWADebugQueryEnabled(''), false);
  assert.equal(isPWADebugQueryEnabled('?promocoes=1'), false);
  assert.equal(isPWADebugQueryEnabled('?debug=1'), false);
  assert.equal(isPWADebugQueryEnabled('?debug=pwa'), true);
  assert.equal(isPWADebugQueryEnabled('?cat=roupas&debug=pwa'), true);
});
