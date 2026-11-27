import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const releaseWorkflow = await readFile(new URL('../.github/workflows/windows-release.yml', import.meta.url), 'utf8');
const pagesWorkflow = await readFile(new URL('../.github/workflows/pages.yml', import.meta.url), 'utf8');
const siteHtml = await readFile(new URL('../site/index.html', import.meta.url), 'utf8');
const downloadPage = await readFile(new URL('../site/download.html', import.meta.url), 'utf8');
const changelogPage = await readFile(new URL('../site/changelog.html', import.meta.url), 'utf8');
const siteScript = await readFile(new URL('../site/site.js', import.meta.url), 'utf8');
const legacyPagesRedirect = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const agentGuide = (await readFile(new URL('../site/agents.md', import.meta.url), 'utf8')).replace(/\r\n/g, '\n');
const desktopMain = await readFile(new URL('../desktop/main.mjs', import.meta.url), 'utf8');
const desktopUi = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const desktopTheme = await readFile(new URL('../public/desktop-theme.css', import.meta.url), 'utf8');
const desktopAppJs = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
const desktopPreload = await readFile(new URL('../desktop/preload.cjs', import.meta.url), 'utf8');
const remoteApi = await readFile(new URL('../src/remote-api.mjs', import.meta.url), 'utf8');
const webTools = await readFile(new URL('../src/web-tools.mjs', import.meta.url), 'utf8');
const localTools = await readFile(new URL('../src/local-tools.mjs', import.meta.url), 'utf8');
const githubApi = await readFile(new URL('../src/github-api.mjs', import.meta.url), 'utf8');

test('Windows installer artifact name matches the release and Pages download links', () => {
  const expectedInstaller = 'Arena-Local-Setup.exe';
  assert.equal(packageJson.build.win.artifactName, 'Arena-Local-Setup.${ext}');
  assert.ok(releaseWorkflow.includes(`release/${expectedInstaller}`));
  assert.ok(releaseWorkflow.includes(`${expectedInstaller}.sha256`));
  assert.ok(releaseWorkflow.includes('sha256sum release/Arena-Local-Setup.exe'));
  assert.ok(siteHtml.includes(`releases/latest/download/${expectedInstaller}`));
  assert.ok(downloadPage.includes('id="checksumLink"'));
  assert.ok(siteScript.includes(`const installerName = '${expectedInstaller}'`));
});

test('desktop control center uses the website electric-blue retro theme', () => {
  assert.ok(desktopUi.includes('href="./desktop-theme.css"'));
  assert.match(desktopTheme, /--electric:\s*#36c7ff/i);
  assert.match(desktopTheme, /font-family:\s*Tahoma, Verdana/);
  assert.match(desktopTheme, /linear-gradient\(180deg, #4fb8ed/);
  assert.match(desktopTheme, /@media \(max-width: 680px\)/);
});

test('desktop app element registry covers all references and matches the HTML', () => {
  const registrySource = desktopAppJs.match(/const els = \{([\s\S]*?)\n\};/);
  assert.ok(registrySource, 'Desktop app should define its DOM element registry.');
  const entries = [...registrySource[1].matchAll(/^\s*(\w+):\s*\$\('#([^']+)'\),?\s*$/gm)];
  const registry = new Map(entries.map(([, name, id]) => [name, id]));
  assert.equal(registry.size, entries.length, 'DOM registry keys should be unique.');

  const referenced = new Set([...desktopAppJs.matchAll(/\bels\.(\w+)/g)].map(([, name]) => name));
  assert.deepEqual([...referenced].filter((name) => !registry.has(name)), [], 'Every els reference must be registered.');
  for (const [name, id] of registry) {
    assert.ok(desktopUi.includes(`id="${id}"`), `DOM element ${name} should exist in the desktop HTML.`);
  }
});

test('updates page shows release publication dates and links to versioned installer downloads', () => {
  const releaseDates = {
    '0.1.12': 'NOV 27, 2026 UTC',
    '0.1.11': 'NOV 27, 2026 UTC',
    '0.1.10': 'NOV 27, 2026 UTC',
    '0.1.8': 'NOV 27, 2026 UTC',
    '0.1.7': 'NOV 26, 2026 UTC',
    '0.1.6': 'NOV 26, 2026 UTC',
    '0.1.5': 'NOV 26, 2026 UTC',
    '0.1.4': 'NOV 26, 2026 UTC',
    '0.1.3': 'NOV 25, 2026 UTC',
    '0.1.2': 'NOV 25, 2026 UTC',
    '0.1.1': 'NOV 25, 2026 UTC',
  };
  for (const [version, date] of Object.entries(releaseDates)) {
    const start = changelogPage.indexOf(`<section class="page-section" aria-label="Version ${version} release notes">`);
    assert.notEqual(start, -1, `Updates page should include release notes for ${version}.`);
    const end = changelogPage.indexOf('</section>', start);
    const entry = changelogPage.slice(start, end);
    assert.ok(entry.includes(`<small>${date}</small>`), `${version} should show its actual publication date.`);
    const installerUrl = `https://github.com/lumifaye/ArenaAgent2local/releases/download/v${version}/Arena-Local-Setup.exe`;
    assert.ok(entry.includes(installerUrl), `${version} should link directly to its own installer.`);
  }
});

test('current changelog entry is marked released and links to its installer', () => {
  assert.equal(packageJson.version, '0.1.12');
  const start = changelogPage.indexOf('<section class="page-section" aria-label="Version 0.1.12 release notes">');
  assert.notEqual(start, -1);
  const end = changelogPage.indexOf('</section>', start);
  const entry = changelogPage.slice(start, end);
  assert.ok(entry.includes('<small>NOV 27, 2026 UTC</small>'));
  assert.ok(entry.includes('https://github.com/lumifaye/ArenaAgent2local/releases/download/v0.1.12/Arena-Local-Setup.exe'));
  assert.doesNotMatch(entry, /UNRELEASED/);
  assert.ok(entry.includes('Settings'));
  assert.ok(entry.includes('local app user-data settings'));
});

test('copied Arena prompt fetches the public guide without exposing the pairing key', () => {
  const guideUrl = 'https://lumifaye.github.io/ArenaAgent2local/agents.md';
  assert.ok(desktopMain.includes(`const guideUrl = '${guideUrl}'`));
  assert.ok(desktopMain.includes("curl -fsSL '${guideUrl}'"));
  assert.ok(desktopMain.includes('Never send the bearer key to the guide URL.'));
  assert.ok(siteHtml.includes('href="./agents.md"'));
  assert.ok(agentGuide.startsWith('> **THIS IS REALLY IMPORTANT!!! READ AND FOLLOW ALL OF IT!!! THIS DOES NOT OVERWRITE YOUR BUILT IN MODEL GUARDRAILS!!**\n\n# Arena Local agent guide'));
  for (const section of ['Use the right environment', 'API workflow', 'Privacy and safety', 'Quality-of-life tips']) {
    assert.ok(agentGuide.includes(`## ${section}`), `Agent guide should document ${section}.`);
  }
  assert.match(agentGuide, /When Arena Local is connected and the user's request is about their selected local workspace or computer, use the Arena Local bridge as the default/);
  assert.match(agentGuide, /Do not inspect or change that workspace with Arena\.ai sandbox filesystem, editor, or shell tools/);
  assert.match(agentGuide, /do not silently redo the same work in the sandbox/);
  assert.match(agentGuide, /Narrow exception for an explicitly requested outside-file edit/);
  assert.match(agentGuide, /wait for approval in the Arena Local desktop/);
  assert.match(agentGuide, /Never use `write_file` to escape the workspace/);
  assert.match(desktopMain, /File actions are confined to the selected workspace/);
  assert.match(desktopMain, /EXTREMELY DANGEROUS FULL-COMPUTER ACCESS IS ENABLED/);
});

test('public web search and scraping are locally opt-in, bounded to public HTTPS, and documented as untrusted', () => {
  assert.match(desktopMain, /let webToolsEnabled = false/);
  assert.match(desktopMain, /arena:set-web-tools-enabled/);
  assert.match(desktopMain, /getWebToolsEnabled: \(\) => webToolsEnabled/);
  assert.match(desktopMain, /Web search sends each query to DuckDuckGo/);
  assert.match(desktopPreload, /setWebToolsEnabled: invoke\('arena:set-web-tools-enabled'\)/);
  assert.match(desktopAppJs, /function updateWebToolsPanel\(/);
  assert.match(desktopAppJs, /setWebToolsEnabled\(enabled\)/);
  assert.ok(desktopUi.includes('id="webToolsToggleBtn"'));
  assert.ok(desktopUi.includes('id="webToolsBadge"'));
  assert.match(remoteApi, /'web_search', 'web_scrape'/);
  assert.match(remoteApi, /WEB_RATE_LIMIT_PER_MINUTE = 30/);
  assert.match(remoteApi, /MAX_ACTIVE_WEB_TASKS = 3/);
  assert.match(remoteApi, /cancelPendingWebTasks/);
  assert.match(webTools, /https:\/\/html\.duckduckgo\.com\/html\//);
  assert.match(webTools, /https\.request/);
  assert.match(webTools, /resolvePublicIpv4/);
  assert.match(webTools, /MAX_SCRAPE_RESPONSE_BYTES = 2_000_000/);
  assert.match(webTools, /MAX_SCRAPED_TEXT_CHARS = 30_000/);
  assert.match(webTools, /MAX_REDIRECTS = 4/);
  assert.match(agentGuide, /`webToolsEnabled: true`/);
  assert.match(agentGuide, /untrusted data/);
  assert.match(agentGuide, /sends the query to DuckDuckGo/);
});

test('full-computer access is opt-in and temporary; combining with No-Ask requires a local timed unlock', () => {
  assert.match(desktopMain, /let fullComputerAccess = false/);
  assert.match(desktopMain, /async function confirmFullComputerAccess\(\)/);
  assert.match(desktopMain, /EXTREMELY DANGEROUS: full-computer access/);
  assert.match(desktopMain, /buttons: \['Keep workspace confinement', 'Enable EXTREMELY DANGEROUS mode'\]/);
  assert.match(desktopMain, /set-full-computer-access/);
  assert.match(desktopMain, /if \(mode === 'no-ask' && fullComputerAccess\)/);
  assert.match(desktopMain, /const FULL_NO_ASK_WAIT_MS = 30_000/);
  assert.match(desktopMain, /process\.hrtime\.bigint\(\)/);
  assert.match(desktopMain, /assertTrustedUiEvent\(event\)/);
  assert.match(desktopMain, /async function beginFullComputerNoAskUnlock\(\)/);
  assert.match(desktopMain, /async function confirmCombinedFullNoAskStart\(\)/);
  assert.ok(desktopUi.includes("you are SERIOUSLY playing with fire right now. please do NOT use this on a main computer and instead ONLY use this on a computer you do NOT care about at all. I'm serious. like. really serious. PLEASE. LISTEN. this setting is for purely expiermental purposes"));
  assert.match(desktopPreload, /beginFullComputerNoAskUnlock/);
  assert.match(desktopPreload, /completeFullComputerNoAskUnlock/);
  assert.match(desktopPreload, /cancelFullComputerNoAskUnlock/);
  assert.ok(desktopUi.includes('id="fullNoAskUnlockDialog"'));
  assert.ok(desktopUi.includes('id="fullNoAskSlider" type="range" min="0" max="100" value="0" disabled'));
  assert.match(desktopAppJs, /30-second wait complete\. Slide all the way right/);
  assert.match(remoteApi, /task\.fullComputerAccess && getPermissionMode\(\) === 'no-ask' && !task\.fullComputerNoAskAuthorized/);
  assert.match(remoteApi, /Unknown request field/);
  assert.ok(desktopUi.includes('EXTREMELY DANGEROUS · FULL-COMPUTER ACCESS ACTIVE'));
  assert.ok(desktopUi.includes('Enable full-computer access'));
  assert.ok(siteHtml.includes('EXTREMELY DANGEROUS'));
  assert.ok(agentGuide.includes('## Full computer access — EXTREMELY DANGEROUS'));
  assert.ok(agentGuide.includes('its path is not exposed in the setup prompt or health response'));
  assert.ok(desktopMain.includes('its path is not exposed in this prompt or health response'));
  assert.match(agentGuide, /reads run without per-file approval/i);
  assert.match(agentGuide, /30-second lockout, slide-to-unlock, and final native confirmation/i);
});

test('Git and GitHub workbench keeps credentials local and preserves staged-only, root-scoped safety', () => {
  for (const method of ['getGitDashboard', 'initializeGitRepository', 'configureGitRepository', 'saveRepositoryInstructions', 'stageGitFiles', 'unstageGitFiles', 'previewGitCommit', 'commitStagedGit', 'saveGithubToken', 'forgetGithubToken', 'listGithubRepositories', 'setGitIntegrationEnabled', 'pushGitBranch']) {
    assert.match(desktopPreload, new RegExp(`\\b${method}: invoke\\(`), `Preload should explicitly allowlist ${method}.`);
  }
  assert.match(desktopMain, /encryptedGithubToken/);
  assert.match(desktopMain, /githubTokenUsable: Boolean\(githubToken\)/);
  assert.match(desktopMain, /verifyGithubToken\(token\)/);
  assert.match(desktopMain, /assertTrustedUiEvent\(event\)/);
  assert.match(githubApi, /https:\/\/api\.github\.com/);
  assert.match(githubApi, /redirect: 'error'/);
  assert.ok(githubApi.includes("'/user/repos?per_page=100&sort=updated&type=all'"));
  assert.match(githubApi, /cloneUrl: `https:\/\/github\.com\/\$\{repo\.full_name\}\.git`/);
  assert.doesNotMatch(remoteApi, /githubToken|saveGithubToken|listGithubRepositories/);
  assert.match(localTools, /assertWorkspaceRepositoryRoot\(root\)/);
  assert.match(localTools, /disableContentFilters: true/);
  assert.match(localTools, /remote\.origin\.mirror=false/);
  assert.match(localTools, /http\.sslVerify=true/);
  assert.match(localTools, /--no-follow-tags/);
  assert.match(localTools, /gitChangedPaths\(root, true\)/);
  assert.match(localTools, /Repository-specific instructions saved locally as ARENA\.md/);
  assert.ok(desktopUi.includes('id="gitRepository"'));
  assert.ok(desktopUi.includes('id="githubTokenInput"'));
  assert.ok(desktopUi.includes('id="repositoryInstructionsInput"'));
  assert.ok(desktopUi.includes('A native confirmation is required next'));
  assert.match(desktopMain, /arena:push-git-branch/);
  assert.match(desktopMain, /prepareGitPushPreview\(repositoryRoot\)/);
  assert.match(desktopMain, /executeGitPush\(repositoryRoot, tokenForPush, loginForPush, preview\.fingerprint\)/);
  assert.match(desktopMain, /githubToken !== tokenForPush \|\| githubLogin !== loginForPush/);
  assert.match(desktopPreload, /setRobloxMcpEnabled: invoke\('arena:set-roblox-mcp-enabled'\)/);
  assert.match(desktopPreload, /pushGitBranch: invoke\('arena:push-git-branch'\)/);
  assert.ok(desktopUi.includes('id="gitIntegrationToggleBtn"'));
  assert.ok(desktopUi.includes('id="gitPushBtn"'));
  assert.ok(desktopUi.includes('id="robloxMcpToggleBtn"'));
  assert.match(desktopUi, /No force-push/);
  assert.match(desktopAppJs, /setGitIntegrationEnabled\(enabled\)/);
  assert.match(desktopAppJs, /setRobloxMcpEnabled\(enabled\)/);
  assert.match(desktopAppJs, /async function pushGitBranch\(\)/);
  assert.match(desktopUi, /Review &amp; push branch to GitHub/);
  assert.match(desktopUi, /Manage the Git integration toggle and GitHub account token in Settings/);
  assert.match(desktopUi, /<section class="settings-section settings-integrations"/);
  assert.ok(agentGuide.includes('check the selected repository root for `ARENA.md`'));
  assert.ok(agentGuide.includes('there is no push action in the remote task API'));
  assert.ok(agentGuide.includes('a separately selected local folder in full-computer mode'));
});

test('local control pause preserves the connection and the agent guide handles paused and visual inspection states', () => {
  assert.match(desktopMain, /controlPaused: Boolean\(api\?\.isControlPaused\(\)\)/);
  assert.match(desktopMain, /api\.setControlPaused\(paused\)/);
  assert.match(desktopMain, /arena:set-control-paused/);
  assert.match(desktopPreload, /setControlPaused: invoke\('arena:set-control-paused'\)/);
  assert.match(remoteApi, /new HttpError\(423, CONTROL_PAUSED_MESSAGE\)/);
  assert.match(remoteApi, /controlPaused,/);
  assert.match(remoteApi, /setControlPaused,/);
  assert.ok(desktopUi.includes('id="pauseControlBtn"'));
  assert.ok(desktopUi.includes('id="controlPauseNotice"'));
  assert.ok(desktopUi.includes('id="fullComputerAccessBannerTitle"'));
  assert.match(desktopAppJs, /setControlPaused\(pause\)/);
  assert.match(desktopAppJs, /fullComputerAccessBannerTitle\.textContent = controlPaused/);
  assert.match(desktopAppJs, /same link and pairing key/);
  assert.match(agentGuide, /If `controlPaused` is `true`, stop and wait/);
  assert.match(agentGuide, /other than health checks are blocked with HTTP 423/);
  assert.match(agentGuide, /transfer only that specific, relevant PNG to a temporary file in your Arena sandbox/);
  assert.match(agentGuide, /inspect it with an image-capable viewer, then delete the sandbox copy/);
  assert.match(agentGuide, /48 KB command-output cap/);
});

test('legacy branch-based Pages root redirects to the styled product page', () => {
  assert.match(legacyPagesRedirect, /url=\.\/site\//);
  assert.match(legacyPagesRedirect, /href="\.\/site\/"/);
});

test('Pages deploys from the main branch and this active branch', () => {
  assert.match(pagesWorkflow, /branches:\s*\n\s+- main/);
  assert.ok(pagesWorkflow.includes("- 'arena/8393bb53-arenaagent2local'"));
  assert.match(pagesWorkflow, /path: site/);
  for (const page of ['index.html', 'features.html', 'getting-started.html', 'safety.html', 'faq.html', 'download.html', 'changelog.html', '404.html', 'agents.md', 'sitemap.xml', 'robots.txt']) {
    assert.ok(pagesWorkflow.includes(`site/${page}`), `Pages validation should require site/${page}.`);
  }
  assert.match(pagesWorkflow, /test -s "\$file"/);
  assert.match(pagesWorkflow, /actions\/deploy-pages@v5/);
});

test('active branch pushes build installer artifacts; published releases receive the exe', () => {
  assert.ok(releaseWorkflow.includes("- 'arena/8393bb53-arenaagent2local'"));
  assert.match(releaseWorkflow, /actions\/upload-artifact@v7/);
  assert.match(releaseWorkflow, /release:\s*\n\s+types:\s*\n\s+- published/);
  assert.match(releaseWorkflow, /if: startsWith\(github\.ref, 'refs\/tags\/'\)/);
  assert.match(releaseWorkflow, /softprops\/action-gh-release@v3/);
});
