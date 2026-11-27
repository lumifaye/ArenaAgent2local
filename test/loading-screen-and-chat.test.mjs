import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { clampArenaChatBounds } from '../desktop/arena-chat-bounds.mjs';
import { ARENA_BTW_CHAT_URL, ARENA_CHAT_PARTITION, ARENA_CHAT_URL, isArenaChatPageUrlAllowed, isArenaChatPopupUrlAllowed, isArenaChatUrlAllowed } from '../desktop/arena-chat.mjs';

const desktopUi = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const desktopTheme = await readFile(new URL('../public/desktop-theme.css', import.meta.url), 'utf8');
const desktopAppJs = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
const desktopMain = await readFile(new URL('../desktop/main.mjs', import.meta.url), 'utf8');
const desktopPreload = await readFile(new URL('../desktop/preload.cjs', import.meta.url), 'utf8');
const arenaChatPreload = await readFile(new URL('../desktop/arena-chat-preload.cjs', import.meta.url), 'utf8');
const agentGuide = (await readFile(new URL('../site/agents.md', import.meta.url), 'utf8')).replace(/\r\n/g, '\n');

test('embedded chat permits only HTTPS Arena and sign-in provider URLs', () => {
  assert.equal(ARENA_CHAT_URL, 'https://arena.ai/');
  assert.equal(ARENA_BTW_CHAT_URL, 'https://arena.ai/chat/direct?model_a=claude-sonnet-5-5-high');
  assert.equal(isArenaChatUrlAllowed(ARENA_BTW_CHAT_URL), true);
  assert.equal(isArenaChatPageUrlAllowed(ARENA_BTW_CHAT_URL), true);
  assert.equal(isArenaChatPageUrlAllowed('https://accounts.google.com/o/oauth2/'), false);
  assert.equal(ARENA_CHAT_PARTITION, 'persist:arena-chat');
  for (const url of [
    'https://arena.ai/',
    'https://chat.lmarena.ai/',
    'https://accounts.google.com/o/oauth2/',
    'https://challenges.cloudflare.com/',
  ]) {
    assert.equal(isArenaChatUrlAllowed(url), true, `${url} should be allowed.`);
  }
  for (const url of [
    'http://arena.ai/',
    'https://arena.ai.attacker.example/',
    'https://notarena.ai/',
    'https://user:password@arena.ai/',
    'https://arena.ai:8443/',
    'file:///etc/passwd',
    'javascript:alert(1)',
    'about:blank',
  ]) {
    assert.equal(isArenaChatUrlAllowed(url), false, `${url} should be blocked for navigation.`);
  }
  assert.equal(isArenaChatPopupUrlAllowed('about:blank'), true, 'OAuth may open one empty popup before navigating to an allowlisted provider.');
  assert.equal(isArenaChatPopupUrlAllowed('about:blank#unsafe'), false, 'Only the exact initial empty document should be allowed.');
  assert.equal(isArenaChatPopupUrlAllowed('javascript:alert(1)'), false, 'Blank-popup support must not allow script URLs.');
});

test('/btw consumes the chat composer command and opens a secure direct Arena window', () => {
  assert.match(arenaChatPreload, /event\.key !== 'Enter'/);
  assert.match(arenaChatPreload, /getComposerText\(composer\)\.trim\(\) !== '\/btw'/);
  assert.match(arenaChatPreload, /event\.isTrusted/);
  assert.match(arenaChatPreload, /event\.preventDefault\(\)/);
  assert.match(arenaChatPreload, /event\.stopImmediatePropagation\(\)/);
  assert.match(arenaChatPreload, /clearComposer\(composer\)/);
  assert.match(arenaChatPreload, /ipcRenderer\.send\('arena:open-btw-window'\)/);
  assert.match(desktopMain, /preload: path\.join\(HERE, 'arena-chat-preload\.cjs'\)/);
  assert.match(desktopMain, /ipcMain\.on\('arena:open-btw-window'/);
  assert.match(desktopMain, /isTrustedArenaChatEvent\(event\)/);
  assert.match(desktopMain, /return isArenaChatPageUrlAllowed\(/);
  assert.match(desktopMain, /btwWindow\.loadURL\(ARENA_BTW_CHAT_URL\)/);

  const btwWindowOptions = desktopMain.slice(desktopMain.indexOf('function arenaBtwWindowOptions'), desktopMain.indexOf('function openArenaBtwWindow'));
  assert.match(btwWindowOptions, /parent: mainWindow/);
  assert.match(btwWindowOptions, /partition: ARENA_CHAT_PARTITION/);
  assert.match(btwWindowOptions, /contextIsolation: true/);
  assert.match(btwWindowOptions, /nodeIntegration: false/);
  assert.match(btwWindowOptions, /sandbox: true/);
  assert.match(btwWindowOptions, /webSecurity: true/);
  assert.doesNotMatch(btwWindowOptions, /preload:/, 'The direct-chat window should not gain the embedded chat command bridge.');
});

test('native chat bounds preserve the full DOM rectangle during window-edge scrolling', () => {
  const content = { width: 500, height: 300 };
  assert.deepEqual(
    clampArenaChatBounds({ x: 20, y: 30, width: 400, height: 200, visible: true }, content),
    { x: 20, y: 30, width: 400, height: 200 },
  );
  assert.deepEqual(
    clampArenaChatBounds({ x: -10, y: 5, width: 100, height: 60, visible: true }, content),
    { x: -10, y: 5, width: 100, height: 60 },
    'A partially visible view must retain its full size so Arena does not reflow while the page scrolls.',
  );
  assert.deepEqual(
    clampArenaChatBounds({ x: 480, y: 280, width: 50, height: 40, visible: true }, content),
    { x: 480, y: 280, width: 50, height: 40 },
  );
  assert.equal(clampArenaChatBounds({ x: -520, y: 0, width: 20, height: 10, visible: true }, content), null);
  assert.equal(clampArenaChatBounds({ x: 0, y: 0, width: 10, height: 10, visible: false }, content), null);
  assert.deepEqual(
    clampArenaChatBounds({ x: 0, y: 0, width: 1, height: 1, visible: false }, content, { allowHidden: true }),
    { x: 0, y: 0, width: 1, height: 1 },
  );
  assert.equal(clampArenaChatBounds({ x: Number.NaN, y: 0, width: 10, height: 10, visible: true }, content), null);
  assert.equal(clampArenaChatBounds({ x: 0, y: 0, width: 0, height: 10, visible: true }, content), null);
  assert.equal(clampArenaChatBounds({ x: 0, y: 0, width: 5_000, height: 10, visible: true }, content), null);
});

test('loading screen shows the lowercase "arena local :3" wordmark and live AI ask summary', () => {
  assert.ok(desktopUi.includes('id="splash"'), 'Desktop UI should render a splash overlay.');
  assert.ok(desktopUi.includes('arena local <span class="splash-face">:3</span>'), 'Splash wordmark must read "arena local :3" in lowercase.');
  assert.ok(!/ARENA\s*LOCAL\s*:3<\//.test(desktopUi), 'Splash wordmark must not shout the name back.');
  assert.ok(desktopUi.includes('what the ai is asking to do'), 'Splash should show what the AI is asking to do.');
  assert.ok(desktopUi.includes('files it’s touching'), 'Splash should list the files it is touching.');
  assert.ok(desktopUi.includes('id="splashSkipBtn"'), 'Splash should be skippable.');
  assert.match(desktopAppJs, /function renderSplashActivity\(/);
  assert.match(desktopAppJs, /function startSplashBoot\(/);
  assert.match(desktopAppJs, /function completeSplashBoot\(/);
});

test('control center pins a live "what the ai is asking to do" banner with file chips', () => {
  assert.ok(desktopUi.includes('id="liveAskBanner"'), 'Desktop UI should include the live ask banner.');
  assert.ok(desktopUi.includes('id="liveAskList"'), 'Live ask banner should list the requested actions.');
  assert.ok(desktopUi.includes('id="liveAskFiles"'), 'Live ask banner should list the files in play.');
  assert.match(desktopAppJs, /function renderLiveAsk\(/);
  assert.match(desktopAppJs, /taskFileTargets/);
  assert.match(desktopAppJs, /renderLiveAsk\(state\);/);
});

test('embedded arena.ai chat auto-loads by default with a manual-load preference and smooth viewport bounds', () => {
  assert.ok(desktopUi.includes('id="chat"'), 'Desktop UI should expose a chat section.');
  assert.ok(desktopUi.includes('id="loadArenaChatBtn"'), 'Chat panel should retain a manual load action when auto-load is disabled.');
  assert.ok(desktopUi.includes('id="autoLoadArenaChatToggle"'), 'Settings should allow automatic chat loading to be disabled.');
  assert.ok(desktopUi.includes('id="openSettingsBtn"'), 'Settings should be reachable from the sidebar.');
  assert.ok(desktopUi.includes('id="settingsDialog"'), 'The Settings entry should open an in-app settings screen.');
  assert.ok(desktopUi.includes('id="retryArenaChatBtn"'), 'A failed chat load should expose a retry action.');
  assert.ok(desktopUi.includes('id="toggleChatFocusBtn"'), 'Chat should have a control to expand it beyond the side panels.');
  assert.match(desktopAppJs, /function setChatFocusMode\(focused\)/);
  assert.match(desktopAppJs, /setChatFocusMode\(target === '#chat'\)/);
  assert.match(desktopAppJs, /toggleChatFocusBtn\?\.addEventListener\('click'/);
  assert.match(desktopTheme, /\.desktop-shell\.chat-focus-mode \.content-grid\s*\{\s*grid-template-columns:\s*minmax\(0,\s*1fr\);\s*\}/);
  assert.match(desktopTheme, /\.desktop-shell\.chat-focus-mode \.inspector\s*\{\s*display:\s*none;\s*\}/);
  assert.match(desktopTheme, /height:\s*clamp\(500px,\s*72vh,\s*900px\)/);
  assert.doesNotMatch(desktopAppJs, /document\.createElement\('webview'\)/, 'Use a native WebContentsView instead of the legacy webview element.');
  assert.match(desktopAppJs, /function loadArenaChat\(/);
  assert.match(desktopAppJs, /function reloadArenaChat\(/);
  assert.match(desktopAppJs, /function scheduleArenaChatBoundsUpdate\(/);
  assert.match(desktopAppJs, /window\.arenaLocal\.setArenaChatBounds\(/);
  assert.match(desktopAppJs, /new ResizeObserver\(scheduleArenaChatBoundsUpdate\)/);
  assert.match(desktopAppJs, /window\.arenaLocal\.onArenaChatEvent\(handleArenaChatEvent\)/);
  assert.match(desktopAppJs, /frame\.right > 0 && frame\.bottom > 0/);
  assert.match(desktopAppJs, /frame\.left < window\.innerWidth && frame\.top < window\.innerHeight/);
  assert.match(desktopAppJs, /if \(appState\.arenaChatAutoLoad !== false\) void loadArenaChat\(\)/);
  assert.match(desktopAppJs, /document\.querySelector\('dialog\[open\]'\)/);
  assert.match(desktopAppJs, /function failArenaChat\(/);
  assert.match(desktopAppJs, /retryArenaChatBtn\?\.addEventListener\('click', \(\) => reloadArenaChat\(\)\)/);
  assert.doesNotMatch(desktopAppJs, /function observeChatVisibility\(/, 'Chat must not start downloading just because it scrolled into view.');
  assert.ok(desktopUi.includes('id="chatFallback"'), 'Chat panel should degrade gracefully when arena.ai cannot load.');
  assert.ok(desktopUi.includes("object-src 'none'"), 'Local UI objects remain blocked because Arena is rendered in a native view.');
  for (const id of ['arenaProfileName', 'arenaProfilePronouns', 'arenaProfileAboutMe', 'arenaGlobalInstructions', 'appearanceTheme', 'compactLayoutToggle', 'reduceMotionToggle', 'gitIntegrationToggleBtn', 'webToolsToggleBtn', 'robloxMcpToggleBtn', 'githubTokenInput', 'saveGithubTokenBtn', 'forgetGithubTokenBtn']) {
    assert.ok(desktopUi.includes(`id="${id}"`), `Settings should expose ${id}.`);
  }
  assert.match(desktopAppJs, /window\.arenaLocal\.saveSettings\(/);
  assert.match(desktopMain, /path\.join\(app\.getPath\('userData'\), 'config\.json'\)/);
  assert.match(desktopMain, /arenaPersonalization,/);
  assert.match(desktopMain, /appearancePreferences,/);
  assert.match(desktopMain, /encryptedGithubToken: savedEncryptedGithubToken/);
  assert.match(desktopPreload, /saveSettings: invoke\('arena:save-settings'\)/);
  assert.match(desktopMain, /formatArenaPersonalizationPrompt\(arenaPersonalization\)/);
  assert.match(desktopPreload, /loadArenaChat: invoke\('arena:load-arena-chat'\)/);
  assert.match(desktopPreload, /reloadArenaChat: invoke\('arena:reload-arena-chat'\)/);
  assert.match(desktopPreload, /setArenaChatBounds: send\('arena:set-arena-chat-bounds'\)/);
  assert.match(desktopPreload, /onArenaChatEvent\(callback\)/);
  assert.match(desktopMain, /new WebContentsView\(/);
  assert.match(desktopMain, /partition: ARENA_CHAT_PARTITION/);
  assert.match(desktopMain, /view\.setBounds\(\{ x: 0, y: 0, width: 1, height: 1 \}\)/);
  assert.match(desktopMain, /if \(initialBounds\) setArenaChatContentsBounds\(initialBounds, view, true\)/);
  assert.match(desktopMain, /clampArenaChatBounds\(bounds, mainWindow\.getContentBounds\(\), \{ allowHidden: keepHidden \}\)/);
  assert.match(desktopMain, /targetView\.setVisible\(bounds\.visible === true && !keepHidden\)/);
  assert.match(desktopMain, /view\.getVisible\(\)/);
  assert.doesNotMatch(desktopMain, /\.isVisible\(\)/, 'Use the Electron View API getVisible().');
  const ipcHandlerSection = desktopMain.slice(desktopMain.indexOf('function registerIpcHandlers'), desktopMain.indexOf('function arenaChatPopupOptions'));
  assert.doesNotMatch(ipcHandlerSection, /mainWindow\.on\('resize'/, 'Window events should only be wired after BrowserWindow creation.');
  assert.match(desktopMain, /function createWindow\(\) \{[\s\S]*?mainWindow = new BrowserWindow\([\s\S]*?mainWindow\.on\('resize'/);
  assert.match(desktopMain, /arena:load-arena-chat/);
  assert.match(desktopMain, /arena:reload-arena-chat/);
  assert.match(desktopMain, /arena:set-arena-chat-bounds/);
  assert.match(desktopMain, /arena:chat-event/);
  assert.match(desktopMain, /will-navigate/);
  assert.match(desktopMain, /will-redirect/);
  assert.match(desktopMain, /did-create-window/);
  assert.match(desktopMain, /parent: mainWindow/);
  const popupOptions = desktopMain.slice(desktopMain.indexOf('function arenaChatPopupOptions'), desktopMain.indexOf('function sendArenaChatEvent'));
  assert.match(popupOptions, /partition: ARENA_CHAT_PARTITION/);
  assert.match(popupOptions, /contextIsolation: true/);
  assert.match(popupOptions, /nodeIntegration: false/);
  assert.match(popupOptions, /sandbox: true/);
  assert.match(desktopMain, /if \(!isArenaChatPopupUrlAllowed\(url\)\) return \{ action: 'deny' \}/);
  assert.match(desktopMain, /isArenaChatPopupUrlAllowed/);
  assert.match(desktopMain, /isArenaChatUrlAllowed/);
  assert.match(desktopMain, /webviewTag: false/);
  assert.doesNotMatch(desktopMain, /will-attach-webview/);
  assert.match(desktopMain, /arena:open-arena-chat/);
  assert.match(desktopMain, /arena:reset-arena-chat/);
});

test('agent instructions require explaining intended changes and listing touched files', () => {
  assert.match(desktopMain, /HOW YOU MUST TALK WHILE YOU WORK/);
  assert.match(desktopMain, /files you intend to touch/);
  assert.match(desktopMain, /Never make silent changes/);
  assert.ok(agentGuide.includes('## Explain before you touch — REQUIRED on every task'));
  assert.ok(agentGuide.includes('Never make a silent change'));
  assert.ok(agentGuide.includes('exact files you intend to touch'));
});
