import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAndroidChromeIntentUrl,
  buildCleanShareableStoreUrl,
  CHROME_EDGE_NO_EVENT_INSTALL_INSTRUCTION,
  detectInstallEnvironment,
  FIREFOX_ANDROID_INSTALL_INSTRUCTION,
  formatInstallOutcomeFeedback,
  getAndroidInstallGuide,
  getIOSInstallGuide,
  getManualInstallGuide,
  IN_APP_INSTALL_INSTRUCTION,
  IOS_OTHER_BROWSER_INSTALL_INSTRUCTION,
  IOS_SAFARI_INSTALL_INSTRUCTION,
  isPWADebugQueryEnabled,
  isPWAInviteDismissed,
  isStandaloneDisplayMode,
  PWA_DISMISS_DURATION_MS,
  resolveInstallFallbackInstruction,
  SAMSUNG_INTERNET_INSTALL_INSTRUCTION,
  serializePWADismissTimestamp,
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

test('detectInstallEnvironment identifies WhatsApp, Facebook, Instagram, TikTok, and Messenger in-app browsers', () => {
  const cases: Array<{ ua: string; expectedApp: string }> = [
    {
      ua: 'Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 Chrome/126.0.0.0 Mobile Safari/537.36 WhatsApp/2.24.16.76',
      expectedApp: 'WhatsApp',
    },
    {
      ua: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/475.0.0.0]',
      expectedApp: 'Facebook',
    },
    {
      ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile Instagram 312.0',
      expectedApp: 'Instagram',
    },
    {
      ua: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 BytedanceWebview/d8a21c6 musical_ly_35.1.3',
      expectedApp: 'TikTok',
    },
    {
      ua: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 [FB_IAB/Orca-Android;FBAV/468.0.0.0;Messenger]',
      expectedApp: 'Messenger',
    },
  ];

  for (const item of cases) {
    const env = detectInstallEnvironment({ userAgent: item.ua });
    assert.equal(env.isInAppBrowser, true, `Expected in-app browser for ${item.expectedApp}`);
    assert.equal(env.inAppName, item.expectedApp);
    assert.equal(env.browser, 'in-app');

    const resolved = resolveInstallFallbackInstruction(env, {
      brandName: 'Bercali Store',
      currentUrl: 'https://bercalistore.vercel.app/catalogo?promocoes=1',
    });
    assert.equal(resolved.caseId, 'in-app');
    assert.equal(resolved.primaryInstruction, IN_APP_INSTALL_INSTRUCTION);
    assert.equal(resolved.showCopyLinkButton, true);
    assert.equal(resolved.showOpenInChromeButton, true);
    if (env.isAndroid) {
      assert.equal(
        resolved.openInChromeUrl,
        'intent://bercalistore.vercel.app/catalogo?promocoes=1#Intent;scheme=https;package=com.android.chrome;end'
      );
    }
  }
});

test('buildAndroidChromeIntentUrl formats exact Android Chrome intent:// link and strips debug=pwa', () => {
  assert.equal(
    buildAndroidChromeIntentUrl('https://bercalistore.ao/produto/auscultadores?cor=preto#detalhes'),
    'intent://bercalistore.ao/produto/auscultadores?cor=preto#detalhes#Intent;scheme=https;package=com.android.chrome;end'
  );
  assert.equal(
    buildCleanShareableStoreUrl('https://bercalistore.ao/?debug=pwa'),
    'https://bercalistore.ao/'
  );
  assert.equal(
    buildAndroidChromeIntentUrl('https://bercalistore.ao/?debug=pwa'),
    'intent://bercalistore.ao/#Intent;scheme=https;package=com.android.chrome;end'
  );
});

test('resolveInstallFallbackInstruction handles iPhone/iPad Safari vs other iOS browsers, Samsung Internet, Firefox Android, and Chrome/Edge without event', () => {
  // b1) iPhone Safari
  const iphoneSafari = detectInstallEnvironment({
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  });
  assert.equal(iphoneSafari.isIOS, true);
  assert.equal(iphoneSafari.browser, 'safari');
  const safariInst = resolveInstallFallbackInstruction(iphoneSafari);
  assert.equal(safariInst.caseId, 'ios-safari');
  assert.equal(safariInst.primaryInstruction, IOS_SAFARI_INSTALL_INSTRUCTION);

  // b2) iPhone Chrome (CriOS) and Google App (GSA) -> Abre esta página no Safari
  const iphoneChrome = detectInstallEnvironment({
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/128.0.6613.92 Mobile/15E148 Safari/604.1',
  });
  assert.equal(iphoneChrome.isIOS, true);
  assert.equal(iphoneChrome.browser, 'chrome');
  const iosOtherInst = resolveInstallFallbackInstruction(iphoneChrome);
  assert.equal(iosOtherInst.caseId, 'ios-other');
  assert.equal(iosOtherInst.primaryInstruction, IOS_OTHER_BROWSER_INSTALL_INSTRUCTION);

  const iphoneGoogleApp = detectInstallEnvironment({
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) GSA/328.0.659180829 Mobile/15E148 Safari/604.1',
  });
  assert.equal(iphoneGoogleApp.isIOS, true);
  assert.notEqual(iphoneGoogleApp.browser, 'safari');
  assert.equal(
    resolveInstallFallbackInstruction(iphoneGoogleApp).primaryInstruction,
    IOS_OTHER_BROWSER_INSTALL_INSTRUCTION
  );

  // c) Samsung Internet
  const samsung = detectInstallEnvironment({
    userAgent:
      'Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36',
  });
  assert.equal(samsung.browser, 'samsung');
  assert.equal(
    resolveInstallFallbackInstruction(samsung).primaryInstruction,
    SAMSUNG_INTERNET_INSTALL_INSTRUCTION
  );

  // d) Firefox Android
  const firefoxAndroid = detectInstallEnvironment({
    userAgent: 'Mozilla/5.0 (Android 14; Mobile; rv:129.0) Gecko/129.0 Firefox/129.0',
  });
  assert.equal(firefoxAndroid.isAndroid, true);
  assert.equal(firefoxAndroid.browser, 'firefox');
  assert.equal(
    resolveInstallFallbackInstruction(firefoxAndroid).primaryInstruction,
    FIREFOX_ANDROID_INSTALL_INSTRUCTION
  );

  // e) Chrome/Edge sem evento: instrução + indicação se já instalada ou dispensada recentemente
  const androidChrome = detectInstallEnvironment({
    userAgent:
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36',
  });
  const chromeDismissed = resolveInstallFallbackInstruction(androidChrome, {
    wasRecentlyDismissed: true,
    wasPreviouslyInstalled: false,
  });
  assert.equal(chromeDismissed.caseId, 'chromium-no-event');
  assert.equal(chromeDismissed.primaryInstruction, CHROME_EDGE_NO_EVENT_INSTALL_INSTRUCTION);
  assert.ok(chromeDismissed.statusNote?.includes('dispensado recentemente'));

  const chromeInstalled = resolveInstallFallbackInstruction(androidChrome, {
    wasRecentlyDismissed: false,
    wasPreviouslyInstalled: true,
  });
  assert.ok(chromeInstalled.statusNote?.includes('já parece estar instalada'));
  assert.ok(chromeInstalled.steps.length >= 2);
});

test('resolveInstallFallbackInstruction differentiates iPadOS desktop-mode UA from macOS Safari and Desktop Chrome/Edge/Firefox without mobile-only copy', () => {
  // iPadOS requesting desktop site (MacIntel + touchPoints > 1) -> treated as iOS Safari
  const ipadDesktopUA = detectInstallEnvironment({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
    platform: 'MacIntel',
    maxTouchPoints: 5,
  });
  assert.equal(ipadDesktopUA.isIOS, true);
  assert.equal(ipadDesktopUA.isMobile, true);
  const ipadInst = resolveInstallFallbackInstruction(ipadDesktopUA);
  assert.equal(ipadInst.caseId, 'ios-safari');
  assert.equal(ipadInst.primaryInstruction, IOS_SAFARI_INSTALL_INSTRUCTION);

  // Real Mac Safari (MacIntel + touchPoints 0) -> macOS Add to Dock
  const macSafari = detectInstallEnvironment({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
    platform: 'MacIntel',
    maxTouchPoints: 0,
  });
  assert.equal(macSafari.isIOS, false);
  assert.equal(macSafari.isMobile, false);
  assert.equal(macSafari.os, 'macos');
  assert.equal(macSafari.browser, 'safari');
  const macSafariInst = resolveInstallFallbackInstruction(macSafari);
  assert.equal(macSafariInst.caseId, 'macos-safari');
  assert.ok(macSafariInst.primaryInstruction.includes('Dock'));

  // Windows Chrome -> desktop-chromium (never mentions "telemóvel")
  const winChrome = detectInstallEnvironment({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    platform: 'Win32',
    maxTouchPoints: 0,
  });
  assert.equal(winChrome.isMobile, false);
  const winChromeInst = resolveInstallFallbackInstruction(winChrome, {
    brandName: 'Bercali Store',
  });
  assert.equal(winChromeInst.caseId, 'desktop-chromium');
  assert.ok(!winChromeInst.primaryInstruction.includes('telemóvel'));
  assert.equal(winChromeInst.statusNote ?? '', '');

  // Windows Firefox -> desktop-other with copy link button
  const winFirefox = detectInstallEnvironment({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:129.0) Gecko/20100101 Firefox/129.0',
    platform: 'Win32',
    maxTouchPoints: 0,
  });
  const winFirefoxInst = resolveInstallFallbackInstruction(winFirefox);
  assert.equal(winFirefoxInst.caseId, 'desktop-other');
  assert.equal(winFirefoxInst.showCopyLinkButton, true);
});

test('getManualInstallGuide, getIOSInstallGuide, getAndroidInstallGuide, and formatInstallOutcomeFeedback stay backward-compatible', () => {
  const iosGuide = getIOSInstallGuide('Bercali Store');
  assert.ok(iosGuide.description.includes(IOS_SAFARI_INSTALL_INSTRUCTION));
  assert.ok(iosGuide.steps.length >= 2);

  const androidGuide = getAndroidInstallGuide('Bercali Store');
  assert.ok(androidGuide.description.includes(CHROME_EDGE_NO_EVENT_INSTALL_INSTRUCTION));
  assert.ok(androidGuide.steps.length >= 2);

  const iframeEnv = detectInstallEnvironment({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128.0.0.0 Safari/537.36',
    isSecureContext: true,
    isInIframe: true,
  });
  const iframeGuide = getManualInstallGuide(iframeEnv, 'Bercali Store');
  assert.ok(iframeGuide.contextNotice?.includes('janela incorporada'));

  const accepted = formatInstallOutcomeFeedback('accepted', 'Bercali Store');
  assert.equal(accepted?.tone, 'success');
  const dismissed = formatInstallOutcomeFeedback('dismissed', 'Bercali Store');
  assert.equal(dismissed?.tone, 'neutral');
  assert.equal(formatInstallOutcomeFeedback('unavailable', 'Bercali Store'), null);
});

test('isPWAInviteDismissed and isPWADebugQueryEnabled work deterministically', () => {
  const now = 1_730_000_000_000;
  const saved = serializePWADismissTimestamp(now);
  assert.equal(isPWAInviteDismissed(null, now), false);
  assert.equal(isPWAInviteDismissed(saved, now + 60_000), true);
  assert.equal(isPWAInviteDismissed(saved, now + PWA_DISMISS_DURATION_MS), false);

  assert.equal(isPWADebugQueryEnabled(''), false);
  assert.equal(isPWADebugQueryEnabled('?promocoes=1'), false);
  assert.equal(isPWADebugQueryEnabled('?debug=1'), false);
  assert.equal(isPWADebugQueryEnabled('?debug=pwa'), true);
  assert.equal(isPWADebugQueryEnabled('?cat=roupas&debug=pwa'), true);
});
