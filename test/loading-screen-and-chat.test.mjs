import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ARENA_CHAT_PARTITION, ARENA_CHAT_URL, isArenaChatUrlAllowed } from '../desktop/arena-chat.mjs';

const desktopUi = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const desktopTheme = await readFile(new URL('../public/desktop-theme.css', import.meta.url), 'utf8');
const desktopAppJs = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
const desktopMain = await readFile(new URL('../desktop/main.mjs', import.meta.url), 'utf8');
const desktopPreload = await readFile(new URL('../desktop/preload.cjs', import.meta.url), 'utf8');
const agentGuide = (await readFile(new URL('../site/agents.md', import.meta.url), 'utf8')).replace(/\r\n/g, '\n');

test('embedded chat permits only HTTPS Arena and sign-in provider URLs', () => {
  assert.equal(ARENA_CHAT_URL, 'https://arena.ai/');
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
  ]) {
    assert.equal(isArenaChatUrlAllowed(url), false, `${url} should be blocked.`);
  }
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

test('embedded arena.ai chat is click-to-load, securely isolated, and retryable after errors', () => {
  assert.ok(desktopUi.includes('id="chat"'), 'Desktop UI should expose a chat section.');
  assert.ok(desktopUi.includes('id="loadArenaChatBtn"'), 'Chat panel should start behind an explicit load action.');
  assert.ok(desktopUi.includes('id="retryArenaChatBtn"'), 'A failed chat load should expose a retry action.');
  assert.ok(desktopUi.includes('id="toggleChatFocusBtn"'), 'Chat should have a control to expand it beyond the side panels.');
  assert.match(desktopAppJs, /function setChatFocusMode\(focused\)/);
  assert.match(desktopAppJs, /setChatFocusMode\(target === '#chat'\)/);
  assert.match(desktopAppJs, /toggleChatFocusBtn\?\.addEventListener\('click'/);
  assert.match(desktopTheme, /\.desktop-shell\.chat-focus-mode \.content-grid\s*\{\s*grid-template-columns:\s*minmax\(0,\s*1fr\);\s*\}/);
  assert.match(desktopTheme, /\.desktop-shell\.chat-focus-mode \.inspector\s*\{\s*display:\s*none;\s*\}/);
  assert.match(desktopTheme, /height:\s*clamp\(500px,\s*72vh,\s*900px\)/);
  assert.match(desktopAppJs, /document\.createElement\('webview'\)/);
  assert.match(desktopAppJs, /persist:arena-chat/);
  assert.match(desktopAppJs, /https:\/\/arena\.ai\//);
  assert.match(desktopAppJs, /function loadArenaChat\(/);
  assert.match(desktopAppJs, /function reloadArenaChat\(/);
  assert.match(desktopAppJs, /function failArenaChat\(/);
  assert.match(desktopAppJs, /retryArenaChatBtn\?\.addEventListener\('click', \(\) => reloadArenaChat\(\)\)/);
  assert.doesNotMatch(desktopAppJs, /function observeChatVisibility\(/, 'Chat must not start downloading just because it scrolled into view.');
  assert.match(desktopAppJs, /setAttribute\('allowpopups', ''\)/);
  assert.ok(desktopUi.includes('id="chatFallback"'), 'Chat panel should degrade gracefully when arena.ai cannot load.');
  assert.ok(desktopUi.includes('frame-src https://arena.ai'), 'Local CSP must allow the dedicated Arena chat guest.');
  assert.match(desktopPreload, /openArenaChat: invoke\('arena:open-arena-chat'\)/);
  assert.match(desktopPreload, /resetArenaChat: invoke\('arena:reset-arena-chat'\)/);
  assert.match(desktopMain, /webviewTag: true/);
  assert.match(desktopMain, /arena:open-arena-chat/);
  assert.match(desktopMain, /arena:reset-arena-chat/);
  assert.match(desktopMain, /will-attach-webview/);
  assert.match(desktopMain, /will-navigate/);
  assert.match(desktopMain, /will-redirect/);
  assert.match(desktopMain, /did-create-window/);
  assert.match(desktopMain, /isArenaChatUrlAllowed/);
});

test('agent instructions require explaining intended changes and listing touched files', () => {
  assert.match(desktopMain, /HOW YOU MUST TALK WHILE YOU WORK/);
  assert.match(desktopMain, /files you intend to touch/);
  assert.match(desktopMain, /Never make silent changes/);
  assert.ok(agentGuide.includes('## Explain before you touch — REQUIRED on every task'));
  assert.ok(agentGuide.includes('Never make a silent change'));
  assert.ok(agentGuide.includes('exact files you intend to touch'));
});
