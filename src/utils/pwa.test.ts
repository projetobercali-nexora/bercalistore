import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectInstallEnvironment,
  formatInstallOutcomeFeedback,
  getAndroidInstallGuide,
  getIOSInstallGuide,
  getManualInstallGuide,
  isStandaloneDisplayMode,
} from './pwa';

test('isStandaloneDisplayMode detects installed standalone mode across Chromium, iOS Safari, and Android TWA', () => {
  assert.equal(
    isStandaloneDisplayMode({
      standaloneMediaMatches: false,
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

test('detectInstallEnvironment identifies Android Chrome, Samsung Internet, iPhone Safari, iPadOS, and WhatsApp/Instagram WebViews', () => {
  const androidChrome = detectInstallEnvironment({
    userAgent:
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36',
    isSecureContext: true,
    isInIframe: false,
  });
  assert.equal(androidChrome.os, 'android');
  assert.equal(androidChrome.browser, 'chrome');
  assert.equal(androidChrome.isAndroid, true);
  assert.equal(androidChrome.isIOS, false);
  assert.equal(androidChrome.isInAppBrowser, false);

  const samsung = detectInstallEnvironment({
    userAgent:
      'Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36',
  });
  assert.equal(samsung.os, 'android');
  assert.equal(samsung.browser, 'samsung');

  const iphoneSafari = detectInstallEnvironment({
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  });
  assert.equal(iphoneSafari.os, 'ios');
  assert.equal(iphoneSafari.browser, 'safari');
  assert.equal(iphoneSafari.isIOS, true);

  const ipadOS = detectInstallEnvironment({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
    platform: 'MacIntel',
    maxTouchPoints: 5,
  });
  assert.equal(ipadOS.os, 'ios');
  assert.equal(ipadOS.isIOS, true);

  const whatsappAndroid = detectInstallEnvironment({
    userAgent:
      'Mozilla/5.0 (Linux; Android 14; SM-A546E Build/UP1A) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.0.0 Mobile Safari/537.36 WhatsApp/2.24.16.76',
  });
  assert.equal(whatsappAndroid.isInAppBrowser, true);
  assert.equal(whatsappAndroid.inAppName, 'WhatsApp');
  assert.equal(whatsappAndroid.browser, 'in-app');
});

test('getManualInstallGuide provides device-specific instructions for Android, iPhone/Safari, In-App WebViews, and iframe/HTTPS notices without faking installation', () => {
  const iosGuide = getIOSInstallGuide('Bercali Store');
  assert.ok(iosGuide.title.includes('iPhone'));
  assert.ok(iosGuide.steps.some((s) => s.includes('Partilhar')));
  assert.ok(iosGuide.steps.some((s) => s.includes('Adicionar ao ecrã principal')));

  const androidGuide = getAndroidInstallGuide('Bercali Store');
  assert.ok(androidGuide.title.includes('Android'));
  assert.ok(androidGuide.steps.some((s) => s.includes('Instalar aplicação')));

  const inAppEnv = detectInstallEnvironment({
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile Instagram 312.0',
    isSecureContext: true,
    isInIframe: false,
  });
  const inAppGuide = getManualInstallGuide(inAppEnv, 'Bercali Store');
  assert.ok(inAppGuide.title.includes('Safari'));
  assert.ok(inAppGuide.description.includes('Instagram'));

  const iframeEnv = detectInstallEnvironment({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128.0.0.0 Safari/537.36',
    isSecureContext: true,
    isInIframe: true,
  });
  const iframeGuide = getManualInstallGuide(iframeEnv, 'Bercali Store');
  assert.ok(iframeGuide.contextNotice?.includes('janela incorporada'));

  const insecureEnv = detectInstallEnvironment({
    userAgent: 'Mozilla/5.0 (Linux; Android 14) Chrome/128.0.0.0 Mobile Safari/537.36',
    isSecureContext: false,
    isInIframe: false,
  });
  const insecureGuide = getManualInstallGuide(insecureEnv, 'Bercali Store');
  assert.ok(insecureGuide.contextNotice?.includes('HTTPS'));
});

test('formatInstallOutcomeFeedback reports real accepted and dismissed outcomes accurately', () => {
  const accepted = formatInstallOutcomeFeedback('accepted', 'Bercali Store');
  assert.ok(accepted);
  assert.equal(accepted.tone, 'success');
  assert.ok(accepted.message.includes('Instalação aceite'));

  const dismissed = formatInstallOutcomeFeedback('dismissed', 'Bercali Store');
  assert.ok(dismissed);
  assert.equal(dismissed.tone, 'neutral');
  assert.ok(dismissed.message.includes('cancelado'));

  assert.equal(formatInstallOutcomeFeedback('unavailable', 'Bercali Store'), null);
});
