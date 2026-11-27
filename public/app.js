let appState = null;
let browserPath = '.';
let fileLoadSequence = 0;
let currentFileEntries = [];
let currentFileTruncated = false;
let toastTimer = null;
let lastCompletedWrites = '';
let lastCompletedGitMutations = '';
let combinedUnlockChallengeId = '';
let combinedUnlockReadyAt = 0;
let combinedUnlockExpiresAt = 0;
let combinedUnlockWorkspaceRoot = '';
let combinedUnlockPermissionMode = '';
let combinedUnlockPairingHint = '';
let combinedUnlockTimer = null;
let combinedUnlockSliderUnlocked = false;
let combinedUnlockStarting = false;
let controlPauseBusy = false;
let gitToggleBusy = false;
let robloxToggleBusy = false;
let webToggleBusy = false;
let gitPushBusy = false;
let gitDashboard = null;
let githubRepositories = [];
let selectedGitPaths = new Set();
let gitCommitPreview = null;
let gitLoadSequence = 0;

const $ = (selector) => document.querySelector(selector);
const els = {
  workspaceName: $('#workspaceName'),
  workspacePath: $('#workspacePath'),
  sidebarWorkspaceName: $('#sidebarWorkspaceName'),
  sidebarWorkspacePath: $('#sidebarWorkspacePath'),
  connectionPill: $('#connectionPill'),
  connectionLabel: $('#connectionLabel'),
  navConnectionDot: $('#navConnectionDot'),
  navApprovalCount: $('#navApprovalCount'),
  bridgeStepMark: $('#bridgeStepMark'),
  ngrokSetup: $('#ngrokSetup'),
  liveConnection: $('#liveConnection'),
  connectionLiveTag: $('#connectionLiveTag'),
  pauseControlBtn: $('#pauseControlBtn'),
  pauseControlNotice: $('#controlPauseNotice'),
  ngrokTokenInput: $('#ngrokTokenInput'),
  saveNgrokTokenBtn: $('#saveNgrokTokenBtn'),
  ngrokTokenStatus: $('#ngrokTokenStatus'),
  tokenIndicator: $('#tokenIndicator'),
  forgetNgrokTokenBtn: $('#forgetNgrokTokenBtn'),
  startTunnelBtn: $('#startTunnelBtn'),
  startTunnelLabel: $('#startTunnelLabel'),
  cancelTunnelBtn: $('#cancelTunnelBtn'),
  startNote: $('#startNote'),
  chooseWorkspaceBtn: $('#chooseWorkspaceBtn'),
  workspaceScopeIcon: $('#workspaceScopeIcon'),
  workspaceScopeCopy: $('#workspaceScopeCopy'),
  fullComputerAccessBtn: $('#fullComputerAccessBtn'),
  fullComputerAccessCopy: $('#fullComputerAccessCopy'),
  fullComputerAccessBanner: $('#fullComputerAccessBanner'),
  fullComputerAccessBannerTitle: $('#fullComputerAccessBannerTitle'),
  credentialRule: $('#credentialRule'),
  appVersion: $('#appVersion'),
  tunnelUrl: $('#tunnelUrl'),
  pairingHint: $('#pairingHint'),
  permissionMode: $('#permissionMode'),
  sidebarSecurityCopy: $('#sidebarSecurityCopy'),
  bridgeDisclaimerCopy: $('#bridgeDisclaimerCopy'),
  permissionDescription: $('#permissionDescription'),
  readRule: $('#readRule'),
  changeRule: $('#changeRule'),
  dangerModeBanner: $('#dangerModeBanner'),
  dangerModeTitle: $('#dangerModeTitle'),
  dangerModeCopy: $('#dangerModeCopy'),
  fullComputerAccessBannerCopy: $('#fullComputerAccessBannerCopy'),
  fullNoAskUnlockDialog: $('#fullNoAskUnlockDialog'),
  fullNoAskCountdown: $('#fullNoAskCountdown'),
  fullNoAskProgress: $('#fullNoAskProgress'),
  fullNoAskSlider: $('#fullNoAskSlider'),
  continueFullNoAskUnlock: $('#continueFullNoAskUnlock'),
  cancelFullNoAskUnlock: $('#cancelFullNoAskUnlock'),
  approvalQueue: $('#approvalQueue'),
  approvalCount: $('#approvalCount'),
  activityList: $('#activityList'),
  robloxMcpBadge: $('#robloxMcpBadge'),
  robloxMcpStatus: $('#robloxMcpStatus'),
  robloxMcpStatusText: $('#robloxMcpStatusText'),
  robloxMcpError: $('#robloxMcpError'),
  robloxMcpToolsSummary: $('#robloxMcpToolsSummary'),
  robloxMcpToolsList: $('#robloxMcpToolsList'),
  connectRobloxMcpBtn: $('#connectRobloxMcpBtn'),
  disconnectRobloxMcpBtn: $('#disconnectRobloxMcpBtn'),
  robloxMcpToggleBtn: $('#robloxMcpToggleBtn'),
  webToolsBadge: $('#webToolsBadge'),
  webToolsStatus: $('#webToolsStatus'),
  webToolsToggleBtn: $('#webToolsToggleBtn'),
  gitIntegrationToggleBtn: $('#gitIntegrationToggleBtn'),
  gitPushBtn: $('#gitPushBtn'),
  refreshGitBtn: $('#refreshGitBtn'),
  gitStatusBadge: $('#gitStatusBadge'),
  gitBranchName: $('#gitBranchName'),
  gitSummaryText: $('#gitSummaryText'),
  gitCounts: $('#gitCounts'),
  gitStagedCount: $('#gitStagedCount'),
  gitUnstagedCount: $('#gitUnstagedCount'),
  gitUnavailable: $('#gitUnavailable'),
  gitUnavailableText: $('#gitUnavailableText'),
  initializeGitBtn: $('#initializeGitBtn'),
  gitRepositoryContent: $('#gitRepositoryContent'),
  gitChangeList: $('#gitChangeList'),
  gitSelectionHint: $('#gitSelectionHint'),
  gitStageSelectedBtn: $('#gitStageSelectedBtn'),
  gitUnstageSelectedBtn: $('#gitUnstageSelectedBtn'),
  gitStagedDiff: $('#gitStagedDiff'),
  gitDiffSummary: $('#gitDiffSummary'),
  copyGitDiffBtn: $('#copyGitDiffBtn'),
  gitCommitMessage: $('#gitCommitMessage'),
  gitPreviewCommitBtn: $('#gitPreviewCommitBtn'),
  gitHistory: $('#gitHistory'),
  gitHistorySummary: $('#gitHistorySummary'),
  gitUserName: $('#gitUserName'),
  gitUserEmail: $('#gitUserEmail'),
  saveGitIdentityBtn: $('#saveGitIdentityBtn'),
  gitRemoteName: $('#gitRemoteName'),
  gitRemoteUrl: $('#gitRemoteUrl'),
  saveGitRemoteBtn: $('#saveGitRemoteBtn'),
  gitConfigSummary: $('#gitConfigSummary'),
  githubTokenInput: $('#githubTokenInput'),
  saveGithubTokenBtn: $('#saveGithubTokenBtn'),
  githubTokenStatus: $('#githubTokenStatus'),
  forgetGithubTokenBtn: $('#forgetGithubTokenBtn'),
  githubRepositorySelect: $('#githubRepositorySelect'),
  loadGithubReposBtn: $('#loadGithubReposBtn'),
  setGithubOriginBtn: $('#setGithubOriginBtn'),
  githubRepositoryStatus: $('#githubRepositoryStatus'),
  repositoryInstructionsInput: $('#repositoryInstructionsInput'),
  saveRepositoryInstructionsBtn: $('#saveRepositoryInstructionsBtn'),
  gitInstructionsSummary: $('#gitInstructionsSummary'),
  gitInstructionsNotice: $('#gitInstructionsNotice'),
  gitInstructionsBytes: $('#gitInstructionsBytes'),
  gitCommitPreviewDialog: $('#gitCommitPreviewDialog'),
  gitCommitPreviewMeta: $('#gitCommitPreviewMeta'),
  gitCommitPreviewFiles: $('#gitCommitPreviewFiles'),
  gitCommitPreviewDiff: $('#gitCommitPreviewDiff'),
  confirmGitCommitBtn: $('#confirmGitCommitBtn'),
  cancelGitCommitBtn: $('#cancelGitCommitBtn'),
  closeGitCommitDialogBtn: $('#closeGitCommitDialogBtn'),
  fileBreadcrumbs: $('#fileBreadcrumbs'),
  fileFilter: $('#fileFilter'),
  fileList: $('#fileList'),
  fileFoot: $('#fileFoot'),
  fileDialog: $('#fileDialog'),
  toast: $('#toast'),
  splash: $('#splash'),
  splashStatus: $('#splashStatus'),
  splashAskList: $('#splashAskList'),
  splashFileChips: $('#splashFileChips'),
  splashSkipBtn: $('#splashSkipBtn'),
  liveAskBanner: $('#liveAskBanner'),
  liveAskList: $('#liveAskList'),
  liveAskFiles: $('#liveAskFiles'),
  chatBadge: $('#chatBadge'),
  toggleChatFocusBtn: $('#toggleChatFocusBtn'),
  chatFrameWrap: $('#chatFrameWrap'),
  chatPlaceholder: $('#chatPlaceholder'),
  chatLoading: $('#chatLoading'),
  chatFallback: $('#chatFallback'),
  chatFallbackCopy: $('#chatFallbackCopy'),
  loadArenaChatBtn: $('#loadArenaChatBtn'),
  reloadArenaChatBtn: $('#reloadArenaChatBtn'),
  openArenaChatBrowserBtn: $('#openArenaChatBrowserBtn'),
  resetArenaChatBtn: $('#resetArenaChatBtn'),
  retryArenaChatBtn: $('#retryArenaChatBtn'),
  chatFallbackOpenBtn: $('#chatFallbackOpenBtn'),
};

function showToast(message, isError = false) {
  els.toast.textContent = message;
  els.toast.classList.toggle('error', isError);
  els.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.remove('show'), 3_300);
}

function makeElement(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function displayName(value) {
  if (!value || value === '.') {
    const localRoot = appState?.localWorkspaceRoot || appState?.workspaceRoot || '';
    return appState?.localWorkspaceName || String(localRoot).split(/[\\/]/).filter(Boolean).at(-1) || appState?.workspaceName || 'Workspace';
  }
  return String(value).split(/[\\/]/).filter(Boolean).at(-1) || value;
}

// --- what the ai is asking / which files it is touching ---
const ACTIVE_TASK_STATUSES = ['running', 'preparing', 'awaiting_approval'];

function taskFileTargets(task) {
  const args = task?.args || {};
  const targets = [];
  const push = (value) => {
    const text = String(value ?? '').trim();
    if (text && !targets.includes(text)) targets.push(text);
  };
  push(args.path);
  if (task?.action === 'run_command') push(args.cwd ? `cwd ${args.cwd}` : '');
  if (task?.action === 'git_commit') push('git · staged changes');
  if (task?.action === 'git_status' || task?.action === 'git_diff' || task?.action === 'git_log') push('git · local repository');
  if (task?.action === 'web_search') push('web · duckduckgo');
  if (task?.action === 'web_scrape') { try { push(new URL(args.url).hostname); } catch { push('web · public page'); } }
  if (task?.action === 'roblox_tool') push(`studio · ${args.name || 'mcp tool'}`);
  return targets;
}

function collectAskFiles(tasks) {
  const files = [];
  for (const task of tasks) {
    for (const target of taskFileTargets(task)) {
      if (!files.includes(target)) files.push(target);
    }
  }
  return files;
}

function appendAskLine(container, task) {
  const li = makeElement('li');
  li.append(makeElement('span', '', taskTitle(task)));
  li.append(makeElement('em', '', requestStatusLabel(task.status)));
  container.append(li);
}

function appendFileChips(container, files, chipClass) {
  for (const file of files.slice(0, 8)) {
    const chip = makeElement('span', chipClass, file);
    chip.title = file;
    container.append(chip);
  }
}

function renderSplashActivity(state) {
  if (!els.splashAskList || !els.splashFileChips) return;
  const active = (state?.tasks || []).filter((task) => ACTIVE_TASK_STATUSES.includes(task.status));
  els.splashAskList.replaceChildren();
  if (!active.length) {
    els.splashAskList.append(makeElement('li', 'splash-ask-empty', 'nothing pending — arena hasn’t asked for anything yet :3'));
  } else {
    for (const task of active.slice(0, 6)) appendAskLine(els.splashAskList, task);
  }
  els.splashFileChips.replaceChildren();
  const files = collectAskFiles(active);
  if (!files.length) {
    els.splashFileChips.append(makeElement('span', 'splash-files-empty', '—'));
  } else {
    appendFileChips(els.splashFileChips, files, 'splash-file-chip');
  }
}

function renderLiveAsk(state) {
  if (!els.liveAskBanner || !els.liveAskList || !els.liveAskFiles) return;
  const active = (state?.tasks || []).filter((task) => ACTIVE_TASK_STATUSES.includes(task.status));
  if (!active.length) {
    els.liveAskBanner.hidden = true;
    els.liveAskList.replaceChildren();
    els.liveAskFiles.replaceChildren();
    return;
  }
  els.liveAskBanner.hidden = false;
  els.liveAskList.replaceChildren();
  for (const task of active.slice(0, 4)) appendAskLine(els.liveAskList, task);
  if (active.length > 4) els.liveAskList.append(makeElement('li', '', `+${active.length - 4} more request${active.length - 4 === 1 ? '' : 's'}…`));
  els.liveAskFiles.replaceChildren();
  const files = collectAskFiles(active);
  if (!files.length) {
    els.liveAskFiles.append(makeElement('span', 'splash-files-empty', 'no file paths yet'));
  } else {
    appendFileChips(els.liveAskFiles, files, 'live-ask-file');
  }
}

// --- splash / loading screen controller ---
const SPLASH_BOOT_LINES = [
  'starting the local permission gate…',
  'loading your workspace…',
  'connecting the tunnel controls…',
  'polishing the approval queue…',
  'almost there :3',
];
let splashBootTimer = null;
let splashBootIndex = 0;
let splashFailsafeTimer = null;
let splashShownAt = Date.now();

function setSplashStatus(text) {
  if (els.splashStatus) els.splashStatus.textContent = text;
}

function hideSplash() {
  clearInterval(splashBootTimer);
  clearTimeout(splashFailsafeTimer);
  if (els.splash) {
    els.splash.classList.add('done');
    els.splash.setAttribute('aria-hidden', 'true');
  }
}

function startSplashBoot() {
  splashShownAt = Date.now();
  els.splashSkipBtn?.addEventListener('click', hideSplash);
  setSplashStatus(SPLASH_BOOT_LINES[0]);
  splashBootTimer = setInterval(() => {
    splashBootIndex = (splashBootIndex + 1) % SPLASH_BOOT_LINES.length;
    setSplashStatus(SPLASH_BOOT_LINES[splashBootIndex]);
  }, 1500);
  splashFailsafeTimer = setTimeout(hideSplash, 6_500);
}

function completeSplashBoot() {
  clearInterval(splashBootTimer);
  clearTimeout(splashFailsafeTimer);
  setSplashStatus('ready :3');
  const elapsed = Date.now() - splashShownAt;
  const wait = Math.max(0, 1_150 - elapsed) + 500;
  setTimeout(hideSplash, wait);
}

// --- embedded arena.ai chat ---
const ARENA_CHAT_URL = 'https://arena.ai/';
let arenaChatView = null;
let arenaChatBusy = false;
let arenaChatWatchdog = null;

function setChatBadge(text, live = false) {
  if (!els.chatBadge) return;
  els.chatBadge.textContent = text;
  els.chatBadge.classList.toggle('chat-badge-live', live);
}

function beginArenaChatLoad() {
  arenaChatBusy = true;
  if (els.chatPlaceholder) els.chatPlaceholder.hidden = true;
  if (els.chatFallback) els.chatFallback.hidden = true;
  if (els.chatLoading) els.chatLoading.hidden = false;
  if (els.reloadArenaChatBtn) els.reloadArenaChatBtn.disabled = true;
  setChatBadge('LOADING…');
  clearTimeout(arenaChatWatchdog);
  arenaChatWatchdog = setTimeout(() => {
    failArenaChat('arena.ai is taking too long to respond. Check your connection, then retry the embedded chat or open it in your browser.');
  }, 15_000);
}

function failArenaChat(message) {
  arenaChatBusy = false;
  clearTimeout(arenaChatWatchdog);
  if (els.chatLoading) els.chatLoading.hidden = true;
  if (els.chatFallback) els.chatFallback.hidden = false;
  if (els.chatFallbackCopy) els.chatFallbackCopy.textContent = message;
  if (els.reloadArenaChatBtn) els.reloadArenaChatBtn.disabled = !arenaChatView;
  setChatBadge('OFFLINE');
}

function completeArenaChatLoad(view) {
  if (view !== arenaChatView) return;
  arenaChatBusy = false;
  clearTimeout(arenaChatWatchdog);
  if (els.chatLoading) els.chatLoading.hidden = true;
  if (els.chatFallback) els.chatFallback.hidden = true;
  if (els.reloadArenaChatBtn) els.reloadArenaChatBtn.disabled = false;
  setChatBadge('LIVE', true);
}

function attachArenaChatEvents(view) {
  view.addEventListener('dom-ready', () => completeArenaChatLoad(view));
  view.addEventListener('did-fail-load', (event) => {
    if (view !== arenaChatView || event.isMainFrame === false || event.errorCode === -3) return;
    failArenaChat(`arena.ai could not load (${event.errorDescription || 'network error'}). Check your connection, then retry or open the chat in your browser.`);
  });
  view.addEventListener('render-process-gone', () => {
    if (view === arenaChatView) failArenaChat('The embedded arena.ai window stopped unexpectedly. Retry the chat or open it in your browser.');
  });
}

function loadArenaChat() {
  if (arenaChatBusy) return;
  if (arenaChatView) {
    reloadArenaChat();
    return;
  }
  if (!els.chatFrameWrap) return;
  beginArenaChatLoad();
  let view;
  try {
    view = document.createElement('webview');
    if (typeof view.reload !== 'function') throw new Error('Embedded chat is not supported by this desktop build.');
    view.id = 'arenaChatView';
    view.className = 'arena-chat-view';
    view.setAttribute('partition', 'persist:arena-chat');
    view.setAttribute('webpreferences', 'contextIsolation=yes, sandbox=yes');
    view.setAttribute('allowpopups', '');
    view.setAttribute('src', ARENA_CHAT_URL);
    attachArenaChatEvents(view);
    arenaChatView = view;
    els.chatFrameWrap.append(view);
  } catch (error) {
    if (view === arenaChatView) arenaChatView = null;
    failArenaChat(error.message || 'The embedded chat could not be started.');
  }
}

function reloadArenaChat(force = false) {
  if (!arenaChatView) {
    loadArenaChat();
    return;
  }
  if (arenaChatBusy && !force) return;
  beginArenaChatLoad();
  try {
    arenaChatView.reload();
  } catch (error) {
    failArenaChat(error.message || 'The embedded chat could not be reloaded.');
  }
}

async function openArenaChatInBrowser() {
  try {
    await window.arenaLocal.openArenaChat();
  } catch (error) {
    showToast(error.message || 'Could not open arena.ai in your browser.', true);
  }
}

async function resetArenaChatSession() {
  try {
    await window.arenaLocal.resetArenaChat();
    if (arenaChatView) reloadArenaChat(true);
    showToast('Arena sign-in cleared on this device.');
  } catch (error) {
    showToast(error.message || 'Could not reset the chat session.', true);
  }
}

function applyState(state) {
  if (!state) return;
  const firstRender = !appState;
  const wasLive = Boolean(appState?.tunnelActive);
  const previousWorkspace = appState?.localWorkspaceRoot ?? appState?.workspaceRoot ?? null;
  const localWorkspaceRoot = state.localWorkspaceRoot ?? state.workspaceRoot ?? null;
  const localWorkspaceChanged = previousWorkspace !== localWorkspaceRoot;
  appState = state;
  if (combinedUnlockChallengeId && (
    !state.fullComputerAccess
    || state.permissionMode !== combinedUnlockPermissionMode
    || localWorkspaceRoot !== combinedUnlockWorkspaceRoot
    || state.pairingTokenHint !== combinedUnlockPairingHint
    || state.tunnelActive || state.tunnelStarting || state.tunnelStopping
    || (state.tasks || []).some((task) => ['running', 'preparing', 'awaiting_approval'].includes(task.status))
  )) {
    void cancelCombinedUnlock();
  }
  if (localWorkspaceChanged) {
    browserPath = '.';
    currentFileEntries = [];
    currentFileTruncated = false;
    if (els.fileFilter) els.fileFilter.value = '';
  }
  const name = localWorkspaceRoot
    ? (state.localWorkspaceName || displayName(localWorkspaceRoot))
    : (state.fullComputerAccess ? 'No local workspace selected' : (state.workspaceName || 'Workspace'));
  const root = localWorkspaceRoot || (state.fullComputerAccess ? 'No local preview/Git workspace' : '—');
  els.workspaceName.textContent = name;
  els.workspacePath.textContent = root;
  els.workspacePath.title = root;
  els.sidebarWorkspaceName.textContent = state.fullComputerAccess && localWorkspaceRoot ? `${name} · LOCAL ONLY` : name;
  els.sidebarWorkspacePath.textContent = state.fullComputerAccess ? 'Remote file scope: no workspace' : root;
  if (els.appVersion && state.appVersion) els.appVersion.textContent = `v${state.appVersion}`;
  els.permissionMode.value = state.permissionMode || 'ask';
  updatePermissionCopy();
  updateConnectionPanel();
  updateRobloxMcpPanel();
  updateWebToolsPanel();
  updateGitIntegrationPanel();
  updateGithubAccountPanel();
  updateGitSelectionControls();
  renderApprovals();
  renderActivity();
  renderLiveAsk(state);
  renderSplashActivity(state);
  if (localWorkspaceChanged || firstRender) {
    selectedGitPaths.clear();
    void loadFiles('.');
    void loadGitDashboard();
  }

  const writeSignature = (state.tasks || []).filter((task) => task.action === 'write_file' && task.status === 'completed').map((task) => task.taskId).join('|');
  if (writeSignature !== lastCompletedWrites) {
    lastCompletedWrites = writeSignature;
    if (writeSignature) loadFiles(browserPath);
  }
  const gitMutationSignature = (state.tasks || [])
    .filter((task) => ['write_file', 'git_commit', 'run_command'].includes(task.action) && task.status === 'completed')
    .map((task) => task.taskId).join('|');
  if (gitMutationSignature !== lastCompletedGitMutations) {
    lastCompletedGitMutations = gitMutationSignature;
    if (gitMutationSignature) void loadGitDashboard();
  }
  if (wasLive && !state.tunnelActive) showToast('Remote connection stopped. The public URL is no longer active.');
}

function updateConnectionPanel() {
  const live = Boolean(appState?.tunnelActive && appState?.tunnelUrl);
  const controlPaused = live && Boolean(appState?.controlPaused);
  const starting = Boolean(appState?.tunnelStarting);
  const stopping = Boolean(appState?.tunnelStopping);
  const busy = starting || stopping;
  const configured = Boolean(appState?.ngrokTokenConfigured);
  els.connectionPill.classList.toggle('live', live && !controlPaused);
  els.connectionPill.classList.toggle('paused', controlPaused);
  els.connectionPill.classList.toggle('connecting', busy && !live);
  els.connectionPill.classList.toggle('disconnected', !live && !busy);
  els.connectionLabel.textContent = live ? controlPaused ? 'CONTROL PAUSED · LINK LIVE' : 'REMOTE LINK ACTIVE' : starting ? 'CONNECTING…' : stopping ? 'STOPPING…' : 'REMOTE LINK OFF';
  els.navConnectionDot.classList.toggle('live', live && !controlPaused);
  els.navConnectionDot.classList.toggle('paused', controlPaused);
  els.navConnectionDot.classList.toggle('connecting', busy && !live);
  els.liveConnection.classList.toggle('control-paused', controlPaused);
  els.connectionLiveTag.textContent = controlPaused ? 'PAUSED' : 'LIVE';
  els.connectionLiveTag.classList.toggle('paused', controlPaused);
  els.pauseControlBtn.textContent = controlPaused ? 'Resume control' : 'Pause control';
  els.pauseControlBtn.setAttribute('aria-pressed', String(controlPaused));
  els.pauseControlBtn.setAttribute('aria-label', controlPaused ? 'Resume remote control without changing the link or pairing key' : 'Pause remote control without changing the link or pairing key');
  els.pauseControlBtn.disabled = !live || busy || controlPauseBusy;
  els.pauseControlNotice.hidden = !controlPaused;
  els.bridgeStepMark.textContent = live ? '02 / CONNECTED' : starting ? '02 / CONNECTING' : stopping ? '02 / STOPPING' : configured ? '02 / READY' : '01 / SET UP';
  els.ngrokSetup.hidden = live;
  els.liveConnection.hidden = !live;
  els.startTunnelBtn.disabled = !configured || busy || live;
  els.startTunnelBtn.setAttribute('aria-busy', String(busy));
  els.startTunnelLabel.textContent = starting
    ? 'Opening secure link…'
    : stopping
      ? 'Stopping…'
      : appState?.fullComputerAccess && appState?.permissionMode === 'no-ask'
        ? 'Start FULL PC + NO-ASK link'
        : appState?.fullComputerAccess
          ? 'Start EXTREMELY DANGEROUS link'
          : 'Start remote connection';
  els.startTunnelBtn.classList.toggle('full-access', Boolean(appState?.fullComputerAccess));
  els.cancelTunnelBtn.hidden = !starting || stopping;
  els.startNote.textContent = starting
    ? 'Creating the temporary HTTPS link. You can cancel the attempt.'
    : stopping
      ? 'Closing the temporary link…'
      : appState?.fullComputerAccess && appState?.permissionMode === 'no-ask'
        ? 'EXTREMELY DANGEROUS: final native confirmation required; full file access and writes/commands without approval.'
        : appState?.fullComputerAccess
          ? 'EXTREMELY DANGEROUS: this link can expose all files your OS account can access.'
          : 'The public link is created only when you start it.';
  els.chooseWorkspaceBtn.disabled = live || busy;
  els.chooseWorkspaceBtn.title = live || busy ? 'Stop the remote connection before changing folders.' : 'Choose the local folder Arena may access.';
  els.ngrokTokenInput.disabled = busy;
  els.saveNgrokTokenBtn.disabled = busy;
  els.tunnelUrl.textContent = appState?.tunnelUrl || '—';
  els.tunnelUrl.title = appState?.tunnelUrl || '';
  els.pairingHint.textContent = configured ? (appState?.pairingTokenHint || '••••••') : '••••••';
  els.tokenIndicator.classList.toggle('saved', configured);
  els.ngrokTokenStatus.textContent = !configured
    ? 'No ngrok token saved'
    : appState.ngrokTokenPersistent
      ? 'ngrok token stored with this computer’s secure storage'
      : 'ngrok token available for this session only';
  els.forgetNgrokTokenBtn.hidden = !configured;
  els.ngrokTokenInput.placeholder = configured ? 'Saved token — leave blank to keep' : 'Paste ngrok authtoken';
}

function updateRobloxMcpPanel() {
  const mcp = appState?.robloxMcp || {};
  const enabled = appState?.robloxMcpEnabled !== false && mcp.enabled !== false;
  const status = enabled ? (mcp.status || 'disconnected') : 'disabled';
  const connected = enabled && status === 'connected';
  const busy = status === 'connecting' || status === 'disconnecting';
  const tools = Array.isArray(mcp.tools) ? mcp.tools : [];
  const labels = {
    connected: `Connected · ${mcp.toolCount ?? tools.length} tools available`,
    connecting: 'Starting the local Studio MCP process…',
    disconnecting: 'Disconnecting from Studio…',
    disabled: 'Disabled locally · Studio is disconnected and unavailable to Arena',
    error: 'Roblox Studio MCP connection failed',
    unsupported: 'Roblox Studio MCP is not supported on this operating system',
    disconnected: mcp.installed === false ? 'Roblox Studio MCP launcher not found' : 'Not connected',
  };
  els.robloxMcpStatus.dataset.state = status;
  els.robloxMcpStatusText.textContent = labels[status] || labels.disconnected;
  els.robloxMcpBadge.textContent = status === 'connected' ? 'CONNECTED'
    : status === 'connecting' ? 'CONNECTING…'
      : status === 'disconnecting' ? 'STOPPING…'
        : status === 'disabled' ? 'DISABLED'
          : status === 'error' ? 'ERROR'
            : status === 'unsupported' ? 'UNSUPPORTED'
              : mcp.installed === false ? 'NOT FOUND' : 'OFFLINE';
  const message = enabled ? (mcp.error || (mcp.supported && mcp.installed === false
    ? 'Install or update Roblox Studio, then enable Assistant → Manage MCP Servers → Enable Studio as MCP server.'
    : '')) : '';
  els.robloxMcpError.textContent = message;
  els.robloxMcpError.hidden = !message;
  els.connectRobloxMcpBtn.hidden = connected || !enabled;
  els.connectRobloxMcpBtn.disabled = busy || !enabled || !mcp.supported || mcp.installed === false;
  els.connectRobloxMcpBtn.textContent = status === 'connecting' ? 'Connecting…' : 'Connect Roblox Studio';
  els.disconnectRobloxMcpBtn.hidden = !connected;
  els.disconnectRobloxMcpBtn.disabled = busy;
  els.robloxMcpToggleBtn.textContent = enabled ? 'Disable Studio MCP' : 'Enable Studio MCP';
  els.robloxMcpToggleBtn.setAttribute('aria-pressed', String(enabled));
  els.robloxMcpToggleBtn.disabled = busy || robloxToggleBusy;
  els.robloxMcpToggleBtn.title = enabled
    ? 'Disable local Studio controls and remote MCP access, then disconnect Studio.'
    : 'Enable local Studio controls; connect to Studio separately when ready.';
  els.robloxMcpToolsSummary.textContent = `Available tools · ${connected ? (mcp.toolCount ?? tools.length) : 0}`;
  els.robloxMcpToolsList.replaceChildren();
  if (!connected || !tools.length) {
    els.robloxMcpToolsList.append(makeElement('li', '', !enabled ? 'Studio MCP is disabled locally.' : connected ? 'Studio has not reported any tools.' : 'Connect to Studio to discover its tools.'));
    return;
  }
  for (const tool of tools) {
    const item = document.createElement('li');
    item.append(makeElement('span', '', tool.name));
    const permissionLabel = tool.permission === 'read-only' ? 'READ ONLY' : 'APPROVAL REQUIRED';
    const description = String(tool.description || '').trim();
    item.append(makeElement('small', '', description ? `${permissionLabel} · ${description}` : permissionLabel));
    els.robloxMcpToolsList.append(item);
  }
}

function updateWebToolsPanel() {
  const enabled = appState?.webToolsEnabled === true;
  els.webToolsToggleBtn.textContent = enabled ? 'Disable web tools' : 'Enable web tools';
  els.webToolsToggleBtn.setAttribute('aria-pressed', String(enabled));
  els.webToolsToggleBtn.disabled = webToggleBusy;
  els.webToolsToggleBtn.title = enabled
    ? 'Block web search and scraping requests from Arena.'
    : 'Enable public web search and scraping after native confirmation.';
  els.webToolsBadge.textContent = enabled ? 'ENABLED' : 'DISABLED';
  els.webToolsBadge.dataset.state = enabled ? 'enabled' : 'disabled';
  els.webToolsStatus.dataset.state = enabled ? 'enabled' : 'disabled';
  els.webToolsStatus.textContent = enabled
    ? 'Enabled locally · web_search uses DuckDuckGo, and web_scrape fetches public HTTPS pages. Requests are read-only and bounded.'
    : 'Disabled locally · remote web actions are blocked until you enable this integration here.';
}

function updateGitIntegrationPanel() {
  const enabled = appState?.gitIntegrationEnabled !== false;
  els.gitIntegrationToggleBtn.textContent = enabled ? 'Disable Git' : 'Enable Git';
  els.gitIntegrationToggleBtn.setAttribute('aria-pressed', String(enabled));
  els.gitIntegrationToggleBtn.disabled = gitToggleBusy;
  els.gitIntegrationToggleBtn.title = enabled
    ? 'Disable local Git/GitHub controls and remote Git actions.'
    : 'Enable local Git/GitHub controls and remote Git actions.';
  if (!enabled) {
    gitLoadSequence += 1;
    gitDashboard = null;
    githubRepositories = [];
    selectedGitPaths.clear();
    if (els.githubRepositorySelect) els.githubRepositorySelect.replaceChildren(new Option('Git integration disabled', ''));
    if (els.githubRepositoryStatus) els.githubRepositoryStatus.textContent = 'Enable Git integration to use GitHub repository controls.';
    els.gitStatusBadge.textContent = 'DISABLED';
    els.gitStatusBadge.dataset.state = 'disabled';
    els.gitBranchName.textContent = 'Git integration disabled';
    els.gitSummaryText.textContent = 'Local Git controls and remote Git actions are blocked.';
    els.gitCounts.hidden = true;
    els.gitRepositoryContent.hidden = true;
    els.gitUnavailableText.textContent = 'Git integration is disabled locally. Enable it above to restore the local workbench and remote Git tools.';
    els.initializeGitBtn.hidden = true;
    els.gitUnavailable.hidden = false;
    els.refreshGitBtn.disabled = true;
  }
}

function updateGithubAccountPanel() {
  const integrationEnabled = appState?.gitIntegrationEnabled !== false;
  const configured = Boolean(appState?.githubTokenConfigured);
  const usable = Boolean(appState?.githubTokenUsable);
  if (els.githubTokenStatus) {
    let message = 'No GitHub token saved.';
    let state = '';
    if (configured && usable) {
      message = `Verified as ${appState?.githubLogin || 'GitHub user'}. ${appState?.githubTokenPersistent ? 'Encrypted with OS secure storage.' : 'Session-only; OS secure storage is unavailable.'}`;
      state = 'saved';
    } else if (configured) {
      message = 'A saved token could not be unlocked by OS secure storage. Enter it again to use GitHub features.';
      state = 'error';
    }
    els.githubTokenStatus.textContent = message;
    els.githubTokenStatus.dataset.state = state;
  }
  if (els.forgetGithubTokenBtn) {
    els.forgetGithubTokenBtn.hidden = !configured;
    els.forgetGithubTokenBtn.disabled = !integrationEnabled;
  }
  if (els.loadGithubReposBtn) els.loadGithubReposBtn.disabled = !integrationEnabled || !usable;
  if (els.githubRepositorySelect) els.githubRepositorySelect.disabled = !integrationEnabled || !githubRepositories.length;
  if (els.setGithubOriginBtn) els.setGithubOriginBtn.disabled = !integrationEnabled || !usable || !els.githubRepositorySelect?.value;
  if (els.githubTokenInput) {
    els.githubTokenInput.disabled = !integrationEnabled;
    els.githubTokenInput.placeholder = configured ? 'Enter a new token to replace the saved one' : 'Paste GitHub personal access token';
  }
  if (els.saveGithubTokenBtn) els.saveGithubTokenBtn.disabled = !integrationEnabled;
  if (els.gitPushBtn) els.gitPushBtn.disabled = !integrationEnabled || !usable || !gitDashboard?.available || activeRemoteTaskExists() || gitPushBusy;
}

function isGitChangeStaged(change) {
  return typeof change?.status === 'string' && change.status[0] !== ' ' && change.status[0] !== '?';
}

function isGitChangeUnstaged(change) {
  return change?.status === '??'
    || (typeof change?.status === 'string' && change.status[1] !== ' ' && change.status[1] !== '?');
}

function activeRemoteTaskExists() {
  return (appState?.tasks || []).some((task) => ['running', 'preparing', 'awaiting_approval'].includes(task.status));
}

function selectedGitChanges() {
  return (gitDashboard?.status?.changes || []).filter((change) => selectedGitPaths.has(change.path));
}

function updateGitSelectionControls() {
  const selected = selectedGitChanges();
  const stageable = selected.filter(isGitChangeUnstaged);
  const unstageable = selected.filter(isGitChangeStaged);
  const enabled = appState?.gitIntegrationEnabled !== false;
  const hasLocalWorkspace = Boolean(appState?.localWorkspaceRoot ?? appState?.workspaceRoot);
  const blocked = !enabled || !hasLocalWorkspace;
  const busy = activeRemoteTaskExists();
  els.gitStageSelectedBtn.disabled = blocked || !stageable.length || busy;
  els.gitUnstageSelectedBtn.disabled = blocked || !unstageable.length || busy;
  els.gitSelectionHint.textContent = selected.length
    ? `${selected.length} selected · ${stageable.length} can stage · ${unstageable.length} can unstage`
    : 'Select files to stage or unstage.';
  els.gitPreviewCommitBtn.disabled = blocked || !gitDashboard?.diff?.fileCount || busy;
  els.saveGitIdentityBtn.disabled = blocked || busy;
  els.saveGitRemoteBtn.disabled = blocked || busy;
  els.initializeGitBtn.disabled = blocked || busy;
  els.refreshGitBtn.disabled = blocked || els.gitStatusBadge.dataset.state === 'loading';
  els.gitCommitMessage.disabled = blocked || busy;
  const instructionsBlocked = blocked || Boolean(gitDashboard?.config?.instructionsIssue);
  els.repositoryInstructionsInput.disabled = instructionsBlocked;
  els.saveRepositoryInstructionsBtn.disabled = busy || instructionsBlocked || (new TextEncoder().encode(els.repositoryInstructionsInput.value).length > 24 * 1024);
  if (els.copyGitDiffBtn) els.copyGitDiffBtn.disabled = blocked || !gitDashboard?.diff?.diff;
  if (els.gitPushBtn) els.gitPushBtn.disabled = blocked || !appState?.githubTokenUsable || !gitDashboard?.available || busy || gitPushBusy;
}

function renderGitChanges() {
  const changes = gitDashboard?.status?.changes || [];
  const visible = new Set(changes.map((change) => change.path));
  selectedGitPaths = new Set([...selectedGitPaths].filter((filePath) => visible.has(filePath)));
  els.gitChangeList.replaceChildren();
  if (!changes.length) {
    els.gitChangeList.append(makeElement('div', 'git-empty-row', 'Working tree is clean. No visible staged, unstaged, or untracked changes.'));
  } else {
    for (const change of changes) {
      const row = makeElement('label', 'git-change-row');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = selectedGitPaths.has(change.path);
      checkbox.setAttribute('aria-label', `Select ${change.path}, status ${change.status}`);
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) selectedGitPaths.add(change.path);
        else selectedGitPaths.delete(change.path);
        updateGitSelectionControls();
      });
      const status = makeElement('span', `git-change-status${isGitChangeStaged(change) ? ' staged' : ''}`, change.status || '??');
      const filePath = makeElement('span', 'git-change-path', change.path);
      filePath.title = change.path;
      row.append(checkbox, status, filePath);
      els.gitChangeList.append(row);
    }
  }
  updateGitSelectionControls();
}

function renderGitConfiguration(config) {
  els.gitUserName.value = config.userName || '';
  els.gitUserEmail.value = config.userEmail || '';
  const origin = (config.remotes || []).find((remote) => remote.name === 'origin');
  els.gitRemoteName.value = 'origin';
  els.gitRemoteUrl.value = origin?.fetchUrl || '';
  els.gitRemoteUrl.title = origin?.fetchUrl || '';
  els.gitConfigSummary.textContent = (config.remotes || []).length
    ? `${config.remotes.map((remote) => remote.name).join(', ')} · local only`
    : 'No remotes · local only';
  els.repositoryInstructionsInput.value = config.instructions || '';
  els.repositoryInstructionsInput.disabled = Boolean(config.instructionsIssue);
  els.gitInstructionsNotice.textContent = config.instructionsIssue || '';
  els.gitInstructionsNotice.hidden = !config.instructionsIssue;
  els.gitInstructionsSummary.textContent = config.instructionsIssue ? 'ARENA.md · unavailable'
    : config.instructionsExists ? 'ARENA.md · loaded' : 'ARENA.md · not created';
  updateInstructionsByteCount();
}

function renderGitDashboard(data) {
  if (!data.available) {
    gitDashboard = null;
    const noWorkspace = data.noWorkspace === true;
    els.gitStatusBadge.textContent = noWorkspace ? 'NO WORKSPACE' : 'NO REPO';
    els.gitStatusBadge.dataset.state = noWorkspace ? 'loading' : 'error';
    els.gitBranchName.textContent = noWorkspace ? 'No local Git workspace selected' : 'No Git repository at this workspace root';
    els.gitSummaryText.textContent = noWorkspace
      ? 'Full-computer remote mode has no workspace; choose one separately for local Git and desktop preview.'
      : 'Git commands stay scoped to the separately selected local repository root.';
    els.gitCounts.hidden = true;
    els.gitRepositoryContent.hidden = true;
    els.gitUnavailableText.textContent = data.message || 'Choose the root folder of a Git repository to use repository tools.';
    els.initializeGitBtn.hidden = noWorkspace || data.disabled === true;
    els.gitUnavailable.hidden = false;
    updateGitSelectionControls();
    return;
  }

  gitDashboard = data;
  const status = data.status || { changes: [], branch: 'HEAD', count: 0, omittedProtectedCount: 0 };
  const changes = Array.isArray(status.changes) ? status.changes : [];
  const stagedCount = changes.filter(isGitChangeStaged).length;
  const unstagedCount = changes.filter(isGitChangeUnstaged).length;
  const hiddenCount = Number(status.omittedProtectedCount) || 0;
  const hasChanges = changes.length > 0 || hiddenCount > 0;
  els.gitStatusBadge.textContent = hasChanges ? `${changes.length} CHANGES` : 'CLEAN';
  els.gitStatusBadge.dataset.state = hasChanges ? 'dirty' : 'ready';
  els.gitBranchName.textContent = status.branch || 'HEAD';
  els.gitBranchName.title = status.branch || 'HEAD';
  const summary = [
    `${changes.length} visible change${changes.length === 1 ? '' : 's'}`,
    hiddenCount ? `${hiddenCount} protected path${hiddenCount === 1 ? '' : 's'} hidden` : '',
    status.truncated ? 'status list truncated' : '',
  ].filter(Boolean).join(' · ');
  els.gitSummaryText.textContent = summary;
  els.gitCounts.hidden = false;
  els.gitStagedCount.textContent = String(stagedCount);
  els.gitUnstagedCount.textContent = String(unstagedCount);
  els.gitUnavailable.hidden = true;
  els.gitRepositoryContent.hidden = false;
  renderGitChanges();
  renderGitConfiguration(data.config || {});

  const diff = data.diff || { files: [], diff: '', fileCount: 0, truncated: false };
  els.gitDiffSummary.textContent = `${diff.fileCount || 0} file${diff.fileCount === 1 ? '' : 's'}${diff.truncated ? ' · truncated' : ''}`;
  els.gitStagedDiff.textContent = diff.diff || 'No staged changes. Working-tree changes are intentionally not included in this diff.';
  els.copyGitDiffBtn.disabled = !diff.diff;
  els.gitHistory.textContent = data.log?.output || 'No commit history yet.';
  els.gitHistorySummary.textContent = `${data.log?.count || 0} recent commits${data.log?.truncated ? ' · truncated' : ''}`;
  updateGitSelectionControls();
  updateGithubAccountPanel();
}

async function loadGitDashboard() {
  if (appState?.gitIntegrationEnabled === false) {
    updateGitIntegrationPanel();
    updateGitSelectionControls();
    return;
  }
  const sequence = ++gitLoadSequence;
  gitDashboard = null;
  els.gitRepositoryContent.hidden = true;
  els.gitUnavailable.hidden = true;
  els.gitCounts.hidden = true;
  els.gitStatusBadge.textContent = 'CHECKING';
  els.gitStatusBadge.dataset.state = 'loading';
  els.gitBranchName.textContent = 'Checking repository…';
  els.gitSummaryText.textContent = 'Loading local Git status and repository settings.';
  els.refreshGitBtn.disabled = true;
  try {
    const data = await window.arenaLocal.getGitDashboard();
    if (sequence !== gitLoadSequence) return;
    renderGitDashboard(data);
  } catch (error) {
    if (sequence !== gitLoadSequence) return;
    gitDashboard = null;
    els.gitStatusBadge.textContent = 'ERROR';
    els.gitStatusBadge.dataset.state = 'error';
    els.gitBranchName.textContent = 'Could not read Git repository';
    els.gitSummaryText.textContent = 'Check the selected workspace and local Git installation.';
    els.gitRepositoryContent.hidden = true;
    els.gitUnavailableText.textContent = error.message || 'Could not load repository status.';
    els.initializeGitBtn.hidden = true;
    els.gitUnavailable.hidden = false;
  } finally {
    if (sequence === gitLoadSequence) {
      els.refreshGitBtn.disabled = false;
      updateGitSelectionControls();
    }
  }
}

function updateInstructionsByteCount() {
  const bytes = new TextEncoder().encode(els.repositoryInstructionsInput.value).length;
  const kilobytes = (bytes / 1024).toFixed(bytes && bytes < 1024 ? 2 : 1);
  els.gitInstructionsBytes.textContent = `${kilobytes} / 24 KB`;
  els.gitInstructionsBytes.classList.toggle('over-limit', bytes > 24 * 1024);
  if (gitDashboard?.config) {
    const saved = els.repositoryInstructionsInput.value === (gitDashboard.config.instructions || '');
    els.saveRepositoryInstructionsBtn.textContent = saved ? 'Saved' : 'Save ARENA.md';
  }
  updateGitSelectionControls();
}

async function stageSelectedGitFiles() {
  const selected = selectedGitChanges().filter(isGitChangeUnstaged).map((change) => change.path);
  if (!selected.length) return;
  els.gitStageSelectedBtn.disabled = true;
  try {
    const result = await window.arenaLocal.stageGitFiles(selected);
    selectedGitPaths.clear();
    showToast(`Staged ${result.stagedCount} file${result.stagedCount === 1 ? '' : 's'}. Configured Git filters were disabled.`);
    await loadGitDashboard();
  } catch (error) {
    showToast(error.message || 'Could not stage the selected files.', true);
    await loadGitDashboard();
  }
}

async function unstageSelectedGitFiles() {
  const selected = selectedGitChanges().filter(isGitChangeStaged).map((change) => change.path);
  if (!selected.length) return;
  els.gitUnstageSelectedBtn.disabled = true;
  try {
    const result = await window.arenaLocal.unstageGitFiles(selected);
    selectedGitPaths.clear();
    showToast(`Unstaged ${result.unstagedCount} file${result.unstagedCount === 1 ? '' : 's'}. Working files were not changed.`);
    await loadGitDashboard();
  } catch (error) {
    showToast(error.message || 'Could not unstage the selected files.', true);
    await loadGitDashboard();
  }
}

async function initializeGitRepository() {
  els.initializeGitBtn.disabled = true;
  try {
    const result = await window.arenaLocal.initializeGitRepository();
    if (result.initialized) showToast(`Initialized a local Git repository on ${result.branch}. No remote was added.`);
    await loadGitDashboard();
  } catch (error) {
    showToast(error.message || 'Could not initialize Git at the selected workspace root.', true);
  } finally {
    updateGitSelectionControls();
  }
}

async function saveGitIdentity() {
  els.saveGitIdentityBtn.disabled = true;
  try {
    await window.arenaLocal.configureGitRepository({ userName: els.gitUserName.value, userEmail: els.gitUserEmail.value });
    showToast('Repository-local Git author identity saved. Global Git settings were not changed.');
    await loadGitDashboard();
  } catch (error) {
    showToast(error.message || 'Could not save the repository Git identity.', true);
  } finally {
    updateGitSelectionControls();
  }
}

async function saveGitRemote() {
  els.saveGitRemoteBtn.disabled = true;
  try {
    const result = await window.arenaLocal.configureGitRepository({ remoteName: els.gitRemoteName.value, remoteUrl: els.gitRemoteUrl.value });
    showToast(`${result.configured.remote.updated ? 'Updated' : 'Added'} ${result.configured.remote.name} remote locally. Nothing was pushed.`);
    await loadGitDashboard();
  } catch (error) {
    showToast(error.message || 'Could not configure the repository remote.', true);
  } finally {
    updateGitSelectionControls();
  }
}

async function saveRepositoryInstructions() {
  els.saveRepositoryInstructionsBtn.disabled = true;
  try {
    const result = await window.arenaLocal.saveRepositoryInstructions(els.repositoryInstructionsInput.value);
    if (gitDashboard?.config) {
      gitDashboard.config.instructions = els.repositoryInstructionsInput.value;
      gitDashboard.config.instructionsExists = true;
      gitDashboard.config.instructionsIssue = '';
    }
    els.gitInstructionsNotice.hidden = true;
    els.gitInstructionsSummary.textContent = 'ARENA.md · saved';
    updateInstructionsByteCount();
    showToast(`Saved ${result.path} locally (${result.bytes} bytes).`);
  } catch (error) {
    showToast(error.message || 'Could not save ARENA.md.', true);
  } finally {
    updateGitSelectionControls();
  }
}

async function saveGithubToken() {
  els.saveGithubTokenBtn.disabled = true;
  els.forgetGithubTokenBtn.disabled = true;
  els.githubTokenInput.disabled = true;
  els.githubTokenStatus.textContent = 'Verifying token directly with GitHub…';
  els.githubTokenStatus.dataset.state = '';
  try {
    const result = await window.arenaLocal.saveGithubToken(els.githubTokenInput.value);
    els.githubTokenInput.value = '';
    appState = { ...appState, githubTokenConfigured: true, githubTokenUsable: true, githubTokenPersistent: result.persistent, githubLogin: result.login };
    githubRepositories = [];
    els.githubRepositorySelect.replaceChildren(new Option('Load your repositories', ''));
    els.githubRepositoryStatus.textContent = 'Token verified. Load repositories to select a local HTTPS remote.';
    showToast(`GitHub token verified for ${result.login}.`);
    updateGithubAccountPanel();
  } catch (error) {
    els.githubTokenStatus.textContent = error.message || 'Could not verify the GitHub token.';
    els.githubTokenStatus.dataset.state = 'error';
    showToast(error.message || 'Could not verify the GitHub token.', true);
  } finally {
    els.saveGithubTokenBtn.disabled = false;
    els.githubTokenInput.disabled = false;
    els.forgetGithubTokenBtn.disabled = false;
    updateGithubAccountPanel();
  }
}

async function forgetGithubToken() {
  els.forgetGithubTokenBtn.disabled = true;
  els.saveGithubTokenBtn.disabled = true;
  els.githubTokenInput.disabled = true;
  try {
    await window.arenaLocal.forgetGithubToken();
    appState = { ...appState, githubTokenConfigured: false, githubTokenUsable: false, githubTokenPersistent: false, githubLogin: '' };
    githubRepositories = [];
    els.githubRepositorySelect.replaceChildren(new Option('Load your repositories', ''));
    els.githubRepositoryStatus.textContent = 'GitHub token removed from Arena Local. Existing Git remotes are unchanged.';
    showToast('GitHub token forgotten. Local Git remotes were not changed.');
    updateGithubAccountPanel();
  } catch (error) {
    showToast(error.message || 'Could not remove the GitHub token.', true);
  } finally {
    els.forgetGithubTokenBtn.disabled = false;
    els.saveGithubTokenBtn.disabled = false;
    els.githubTokenInput.disabled = false;
    updateGithubAccountPanel();
  }
}

async function loadGithubRepositories() {
  els.loadGithubReposBtn.disabled = true;
  els.githubRepositoryStatus.textContent = 'Loading up to 100 repositories from GitHub…';
  try {
    const result = await window.arenaLocal.listGithubRepositories();
    if (appState?.gitIntegrationEnabled === false) return;
    githubRepositories = Array.isArray(result.repositories) ? result.repositories : [];
    els.githubRepositorySelect.replaceChildren();
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = githubRepositories.length ? 'Choose a repository…' : 'No repositories returned';
    els.githubRepositorySelect.append(placeholder);
    for (const repository of githubRepositories) {
      const option = document.createElement('option');
      option.value = repository.cloneUrl;
      option.textContent = `${repository.private ? 'Private · ' : ''}${repository.fullName}`;
      option.dataset.webUrl = repository.webUrl;
      els.githubRepositorySelect.append(option);
    }
    els.githubRepositoryStatus.textContent = `${githubRepositories.length} ${githubRepositories.length === 1 ? 'repository' : 'repositories'} loaded. Selecting one only changes this computer’s local remote configuration.${result.truncated ? ' List limited to the 100 most recently updated results.' : ''}`;
    updateGithubAccountPanel();
  } catch (error) {
    els.githubRepositoryStatus.textContent = error.message || 'Could not load repositories from GitHub.';
    showToast(error.message || 'Could not load GitHub repositories.', true);
  } finally {
    els.loadGithubReposBtn.disabled = !appState?.githubTokenUsable;
  }
}

async function setGithubOrigin() {
  const remoteUrl = els.githubRepositorySelect.value;
  const repository = githubRepositories.find((item) => item.cloneUrl === remoteUrl);
  if (!repository) return;
  const existingOrigin = (gitDashboard?.config?.remotes || []).some((remote) => remote.name === 'origin');
  if (existingOrigin && !window.confirm(`Replace the existing origin URL with ${repository.fullName}? This changes local Git configuration only; it will not fetch or push.`)) return;
  els.setGithubOriginBtn.disabled = true;
  try {
    await window.arenaLocal.configureGitRepository({ remoteName: 'origin', remoteUrl: repository.cloneUrl });
    els.gitRemoteName.value = 'origin';
    els.gitRemoteUrl.value = repository.cloneUrl;
    showToast(`Set origin to ${repository.fullName}. No GitHub write or push occurred.`);
    await loadGitDashboard();
  } catch (error) {
    showToast(error.message || 'Could not set the origin remote.', true);
  } finally {
    updateGithubAccountPanel();
    updateGitSelectionControls();
  }
}

async function copyGitDiff() {
  const diff = gitDashboard?.diff?.diff || '';
  if (!diff) return;
  try {
    await navigator.clipboard.writeText(diff);
    showToast('Staged-only Git diff copied to the clipboard.');
  } catch {
    showToast('Could not copy the staged diff. Your system clipboard may be unavailable.', true);
  }
}

async function previewLocalGitCommit() {
  const message = els.gitCommitMessage.value.trim();
  if (!message) {
    showToast('Enter a one-line commit message first.', true);
    els.gitCommitMessage.focus();
    return;
  }
  els.gitPreviewCommitBtn.disabled = true;
  try {
    const preview = await window.arenaLocal.previewGitCommit(message);
    gitCommitPreview = { ...preview, message };
    els.gitCommitPreviewMeta.textContent = `Branch: ${preview.branch} · ${preview.fileCount} staged file${preview.fileCount === 1 ? '' : 's'} · Message: ${message}`;
    els.gitCommitPreviewFiles.textContent = preview.files.join('\n');
    els.gitCommitPreviewDiff.textContent = preview.diff || '(empty staged diff)';
    els.gitCommitPreviewDialog.showModal();
  } catch (error) {
    showToast(error.message || 'Could not prepare a staged commit preview.', true);
  } finally {
    updateGitSelectionControls();
  }
}

async function confirmLocalGitCommit() {
  if (!gitCommitPreview) return;
  els.confirmGitCommitBtn.disabled = true;
  try {
    const result = await window.arenaLocal.commitStagedGit(gitCommitPreview.message, gitCommitPreview.fingerprint);
    if (!result.committed) {
      showToast('Local commit canceled. No files were pushed.');
      return;
    }
    els.gitCommitPreviewDialog.close();
    gitCommitPreview = null;
    els.gitCommitMessage.value = '';
    showToast(`Created local commit ${result.commit}. Nothing was pushed.`);
    await loadGitDashboard();
  } catch (error) {
    els.gitCommitPreviewDialog.close();
    gitCommitPreview = null;
    showToast(error.message || 'Could not create the local commit.', true);
    await loadGitDashboard();
  } finally {
    els.confirmGitCommitBtn.disabled = false;
  }
}

function closeGitCommitPreview() {
  gitCommitPreview = null;
  if (els.gitCommitPreviewDialog.open) els.gitCommitPreviewDialog.close();
}

async function pushGitBranch() {
  if (!appState?.githubTokenUsable) {
    showToast('Save and verify a GitHub PAT before pushing.', true);
    return;
  }
  gitPushBusy = true;
  updateGitSelectionControls();
  updateGithubAccountPanel();
  try {
    const result = await window.arenaLocal.pushGitBranch();
    if (!result?.pushed) {
      showToast('Push cancelled. No remote changes were made.');
      return;
    }
    showToast(`Pushed ${result.commitCount} commit${result.commitCount === 1 ? '' : 's'} to ${result.remoteFullName} (${result.branch}).`);
    await loadGitDashboard();
  } catch (error) {
    showToast(error.message || 'Could not push this branch to GitHub.', true);
  } finally {
    gitPushBusy = false;
    updateGitSelectionControls();
    updateGithubAccountPanel();
  }
}

function updateScopePanel() {
  const fullComputerAccess = Boolean(appState?.fullComputerAccess);
  const localWorkspaceSelected = Boolean(appState?.localWorkspaceRoot ?? appState?.workspaceRoot);
  const live = Boolean(appState?.tunnelActive || appState?.tunnelStarting || appState?.tunnelStopping);
  const controlPaused = Boolean(appState?.controlPaused);
  const noAsk = els.permissionMode.value === 'no-ask';
  const noAskOption = els.permissionMode.querySelector('option[value="no-ask"]');
  noAskOption.disabled = false;
  noAskOption.textContent = fullComputerAccess
    ? 'No approval — EXTREMELY DANGEROUS (local unlock required)'
    : 'No approval — VERY DANGEROUS';
  els.workspaceScopeIcon.textContent = fullComputerAccess ? '!' : '✓';
  els.workspaceScopeIcon.classList.toggle('full-access-scope-icon', fullComputerAccess);
  els.workspaceScopeCopy.textContent = controlPaused
    ? fullComputerAccess
      ? 'Remote control is paused; the no-workspace full-computer scope is retained.'
      : 'Workspace scope is retained, but remote file access is currently paused.'
    : fullComputerAccess
      ? 'No remote workspace is selected. Remote file paths must be absolute; local Git/preview needs a separate folder selection.'
      : 'Remote file actions stay inside this folder.';
  const workspaceButtonText = fullComputerAccess
    ? `${localWorkspaceSelected ? 'Change' : 'Choose'} local preview / Git folder`
    : `${localWorkspaceSelected ? 'Change' : 'Choose'} workspace folder`;
  const workspaceBusy = live || activeRemoteTaskExists();
  if (els.chooseWorkspaceBtn.firstChild) els.chooseWorkspaceBtn.firstChild.textContent = `${workspaceButtonText} `;
  els.chooseWorkspaceBtn.disabled = workspaceBusy;
  els.chooseWorkspaceBtn.title = workspaceBusy
    ? 'Stop the remote connection and wait for active requests before changing the local workspace.'
    : fullComputerAccess
      ? 'Choose a separate local workspace for desktop preview and Git. It will not become the remote file workspace.'
      : 'Choose the folder Arena may access remotely.';
  els.fullComputerAccessBtn.textContent = fullComputerAccess ? 'Disable full-computer access' : 'Enable EXTREMELY DANGEROUS access';
  els.fullComputerAccessBtn.classList.toggle('active', fullComputerAccess);
  els.fullComputerAccessBtn.disabled = live || (!fullComputerAccess && noAsk);
  els.fullComputerAccessBtn.setAttribute('aria-pressed', String(fullComputerAccess));
  els.fullComputerAccessBtn.title = live
    ? 'Stop the remote connection before changing access scope.'
    : noAsk && !fullComputerAccess
      ? 'Switch to Ask or Read only before enabling full-computer access.'
      : fullComputerAccess
        ? 'Disable this temporary mode and rotate the pairing key.'
        : 'EXTREMELY DANGEROUS: requires two local warnings and removes the workspace boundary.';
  els.fullComputerAccessCopy.textContent = fullComputerAccess
    ? controlPaused
      ? 'Remote control is paused. No remote workspace is selected; explicit absolute paths remain required after resuming. A separate local folder is needed for desktop preview and Git.'
      : noAsk
        ? 'EXTREMELY DANGEROUS: every remote file action needs an explicit absolute path; reads may expose private files and credentials. Writes and shell commands run without approval. Git and desktop preview require a separately selected local folder. Stop the link to disable both modes and rotate the key.'
        : 'EXTREMELY DANGEROUS: remote file actions require explicit absolute paths and may expose private files or credentials. Ask mode requires local approval for writes, Git commits, and mutating Studio tools. Git and desktop preview need a separate local folder selection. No-Ask requires the 30-second local slide-to-unlock flow.'
    : noAsk
      ? 'EXTREMELY DANGEROUS. Switch to Ask or Read only before enabling full-computer access.'
      : 'EXTREMELY DANGEROUS. Two native warnings required. Must be enabled while disconnected; resets when the link stops. Full-computer mode selects no remote workspace; choose a separate local folder for preview/Git. Combining with No-Ask requires a separate 30-second local slide-to-unlock and final warning.';
  els.fullComputerAccessBannerTitle.textContent = controlPaused
    ? 'EXTREMELY DANGEROUS · FULL-COMPUTER SCOPE RETAINED · CONTROL PAUSED'
    : 'EXTREMELY DANGEROUS · FULL-COMPUTER ACCESS ACTIVE';
  els.fullComputerAccessBannerCopy.textContent = controlPaused
    ? 'Remote control is paused. Full-computer scope remains configured but no new remote requests are accepted; only health checks work. Actions already running may finish.'
    : noAsk
      ? 'Full-computer access is combined with No-Ask: every remote file request needs an explicit absolute path, and reads can expose private files and credentials to Arena.ai. File writes, Git commits, shell commands, and mutating Studio tools run without per-action approval. Git and preview use a separate local workspace; GitHub push still requires local review and native confirmation. Stop the link to disable this mode and rotate the pairing key.'
      : 'Remote file tools have no selected workspace and require explicit absolute paths; they can reach private and credential files, and requested contents can be sent to Arena.ai. Writes and Studio tools follow the selected permission mode. Git and desktop preview require a separately selected local folder/repository. Stop the remote link to disable full-computer access and rotate the pairing key.';
  els.fullComputerAccessBanner.hidden = !fullComputerAccess;
  els.readRule.textContent = controlPaused ? 'PAUSED' : 'ALLOW';
  els.readRule.classList.toggle('paused-state', controlPaused);
  els.credentialRule.textContent = controlPaused ? 'PAUSED' : fullComputerAccess ? 'ACCESSIBLE' : 'BLOCK';
  els.credentialRule.classList.toggle('full-access-rule', fullComputerAccess && !controlPaused);
  els.credentialRule.classList.toggle('blocked-state', !controlPaused && !fullComputerAccess);
  els.credentialRule.classList.toggle('paused-state', controlPaused);
  els.fileFoot.textContent = fullComputerAccess
    ? localWorkspaceSelected
      ? 'This is a separate local preview folder; remote file requests still require explicit absolute paths and do not inherit this folder.'
      : 'No local preview folder selected. Choose a local folder above; remote file requests still require explicit absolute paths.'
    : 'Arena can only see files in the selected folder.';
}

function updatePermissionCopy() {
  const mode = els.permissionMode.value;
  const readOnly = mode === 'read-only';
  const noAsk = mode === 'no-ask';
  const fullComputerAccess = Boolean(appState?.fullComputerAccess);
  const controlPaused = Boolean(appState?.controlPaused);
  els.sidebarSecurityCopy.textContent = controlPaused
    ? 'Remote control is paused. The link and pairing key remain active, but new remote requests are blocked until you resume locally.'
    : fullComputerAccess
    ? noAsk
      ? 'EXTREMELY DANGEROUS: remote file requests require absolute paths and can read anywhere; writes and commands run without approval. Git needs a separately selected repository.'
      : 'EXTREMELY DANGEROUS: remote file requests require explicit absolute paths and may expose private files. Writes, commits, and Studio changes follow your permission mode; Git needs a separate local repository.'
    : noAsk
      ? 'VERY DANGEROUS: Arena can write files, commit staged Git changes, run shell commands, and change Roblox Studio without approval.'
      : readOnly
        ? 'File reads, Git inspection, process names/PIDs, locally enabled Web tools, and known read-only Studio tools are available. Writes, Git commits, commands, and other Studio tools are blocked.'
        : 'Arena can only request scoped actions. File writes, Git commits, shell commands, and changing Roblox Studio tools wait for you here. Web search and scraping are read-only and require local enablement.';
  els.bridgeDisclaimerCopy.textContent = controlPaused
    ? 'Remote control is paused locally. Only health checks work; pending approvals were cancelled. Actions already running may finish. The link and pairing key are unchanged.'
    : fullComputerAccess
      ? noAsk
        ? 'EXTREMELY DANGEROUS: remote file requests require explicit absolute paths; file writes, Git commits, shell commands, and mutating Studio tools run without approval. Private data may be sent to Arena.ai. Git/preview need a separate local folder; GitHub push remains a separate local confirmation.'
        : 'EXTREMELY DANGEROUS: remote file requests require explicit absolute paths and may read private or credential files; requested contents are sent to Arena.ai. Writes and Studio tools follow your permission mode; Git/preview require a separate local folder.'
      : noAsk
      ? 'VERY DANGEROUS: writes, Git commits, shell commands, and mutating Roblox Studio tools execute immediately without desktop approval. Web search/scrape remain read-only and require the separate local Web tools toggle. Stop the link, rotate the key, or switch to Ask or Read only to disable this mode.'
      : readOnly
        ? 'The bearer key lets Arena read files in this workspace. File writes, Git commits, shell commands, and mutating Roblox Studio tools are blocked in Read only mode. Web tools remain local-toggle-only.'
        : 'The bearer key lets Arena read files in this workspace. Writes, Git commits, commands, and mutating Roblox Studio tools pause for desktop approval unless you enable VERY DANGEROUS no-ask mode. Web queries and scraped text can be sent outside this computer only after locally enabling Web tools.';
  els.permissionDescription.textContent = controlPaused
    ? 'Remote control is paused; only health checks are accepted. Your selected permission mode applies again when you resume.'
    : fullComputerAccess
    ? noAsk
      ? 'EXTREMELY DANGEROUS: remote file requests require explicit absolute paths; writes, Git commits, commands, and mutating Studio tools run without approval. Git and preview require a separate local repository; GitHub push remains local-only and confirmed.'
      : readOnly
        ? 'EXTREMELY DANGEROUS: remote file requests require explicit absolute paths; writes, commits, and mutating Studio tools are blocked.'
        : 'EXTREMELY DANGEROUS: remote file requests require explicit absolute paths. Writes, commits, commands, and mutating Studio tools wait for local approval.'
    : noAsk
      ? 'VERY DANGEROUS: every remote write, Git commit, shell command, and mutating Studio tool runs immediately without approval.'
      : readOnly
        ? 'Arena can inspect files, Git history/diffs, and process names/PIDs and use known read-only Studio tools; writes, Git commits, commands, and other Studio tools are blocked.'
        : 'Reads and local Git/process inspection are available. Writes, Git commits, commands, and mutating Studio calls pause for your desktop approval.';
  els.changeRule.textContent = controlPaused ? 'PAUSED' : noAsk ? 'AUTO' : readOnly ? 'BLOCK' : 'ASK';
  els.changeRule.classList.toggle('blocked-state', !controlPaused && readOnly);
  els.changeRule.classList.toggle('no-ask-state', !controlPaused && noAsk);
  els.changeRule.classList.toggle('paused-state', controlPaused);
  els.dangerModeTitle.textContent = controlPaused
    ? fullComputerAccess
      ? 'EXTREMELY DANGEROUS · FULL COMPUTER + NO-ASK · CONTROL PAUSED'
      : 'VERY DANGEROUS · NO-ASK · CONTROL PAUSED'
    : fullComputerAccess
      ? 'EXTREMELY DANGEROUS · FULL COMPUTER + NO-ASK ACTIVE'
      : 'VERY DANGEROUS · NO-ASK MODE ACTIVE';
  els.dangerModeCopy.textContent = controlPaused
    ? 'Remote control is paused; no new requests are accepted. The configured No-Ask access returns if you resume locally. Pending approvals are cancelled; actions already running may finish.'
    : fullComputerAccess
      ? 'Full-computer remote file requests require explicit absolute paths. Automatic writes and shell commands run without approval; Git requires a separate local repository. Stop the link, rotate the key, or close Arena Local to disable this mode.'
      : 'Arena file writes, Git commits, terminal commands, and mutating Roblox Studio tools execute immediately. Shell commands can reach files outside the selected workspace. Web search and scraping remain read-only and require the separate local toggle. Stop the link, rotate the key, choose a different folder, switch to Ask or Read only, or close Arena Local to disable this mode.';
  els.dangerModeBanner.hidden = !noAsk;
  updateScopePanel();
}

function taskTitle(task) {
  const args = task.args || {};
  switch (task.action) {
    case 'list_files': return `List files · ${args.path || '.'}`;
    case 'read_file': return `Read · ${args.path || 'file'}`;
    case 'search_text': return `Search · “${String(args.query || '').slice(0, 45)}”`;
    case 'write_file': return `Write · ${args.path || 'file'}`;
    case 'run_command': return `Run · ${String(args.command || '').slice(0, 45)}`;
    case 'git_status': return 'Git status';
    case 'git_diff': return 'Git diff · staged changes';
    case 'git_log': return `Git log · ${args.limit || 20} commits`;
    case 'git_commit': return `Git commit · ${String(args.message || '').slice(0, 45)}`;
    case 'list_processes': return 'List running processes';
    case 'web_search': return `Web search · “${String(args.query || '').slice(0, 60)}”`;
    case 'web_scrape': {
      try { return `Scrape page · ${new URL(args.url).hostname}`; }
      catch { return 'Scrape public web page'; }
    }
    case 'roblox_tool': return `Roblox Studio · ${args.name || 'MCP tool'}`;
    default: return task.action || 'Remote request';
  }
}

function requestStatusLabel(status) {
  return ({
    running: 'Running',
    preparing: 'Preparing approval preview',
    awaiting_approval: 'Waiting for you',
    completed: 'Completed',
    denied: 'Denied',
    expired: 'Expired',
    cancelled: 'Cancelled',
    error: 'Failed',
  })[status] || status;
}

function renderApprovals() {
  const pending = (appState?.tasks || []).filter((task) => task.status === 'awaiting_approval');
  els.approvalCount.textContent = String(pending.length);
  els.approvalCount.classList.toggle('pending', pending.length > 0);
  els.navApprovalCount.textContent = String(pending.length);
  els.navApprovalCount.classList.toggle('pending', pending.length > 0);
  els.approvalQueue.replaceChildren();
  if (!pending.length) {
    const empty = makeElement('div', 'empty-state');
    empty.append(makeElement('span', 'empty-orbit', '◇'));
    const copy = makeElement('div');
    copy.append(makeElement('strong', '', 'Nothing needs approval'));
    const emptyMessage = appState?.permissionMode === 'no-ask'
      ? 'No actions pause here. File writes, Git commits, shell commands, and mutating Roblox Studio tools can run without a prompt.'
      : appState?.permissionMode === 'read-only'
        ? 'File writes, Git commits, shell commands, and mutating Roblox Studio tools are blocked in Read only mode.'
        : 'When Arena requests a file write, Git commit, terminal command, or changing Roblox Studio tool, review it here first.';
    copy.append(makeElement('p', '', emptyMessage));
    empty.append(copy);
    els.approvalQueue.append(empty);
    return;
  }
  for (const task of pending) els.approvalQueue.append(renderApprovalCard(task));
}

function appendDiff(pre, preview) {
  const before = String(preview?.before || '').split('\n');
  const after = String(preview?.after || '').split('\n');
  let prefix = 0;
  while (prefix < before.length && prefix < after.length && before[prefix] === after[prefix]) prefix += 1;
  let suffix = 0;
  while (suffix < before.length - prefix && suffix < after.length - prefix && before[before.length - 1 - suffix] === after[after.length - 1 - suffix]) suffix += 1;
  if (preview?.exists && prefix === before.length && prefix === after.length) {
    pre.textContent = 'No visible text changes.';
    return;
  }
  if (preview?.exists && prefix > 2) pre.append(makeElement('span', 'diff-context', `… ${prefix - 2} unchanged line(s) above …\n`));
  if (preview?.exists && prefix > 0) pre.append(makeElement('span', 'diff-context', before.slice(Math.max(0, prefix - 2), prefix).map((line) => `  ${line}`).join('\n') + '\n'));
  if (preview?.exists) {
    const removed = before.slice(prefix, before.length - suffix).map((line) => `− ${line}`).join('\n');
    if (removed) pre.append(makeElement('span', 'diff-removed', removed + '\n'));
  }
  const added = after.slice(preview?.exists ? prefix : 0, preview?.exists ? after.length - suffix : after.length).map((line) => `+ ${line}`).join('\n');
  if (added) pre.append(makeElement('span', 'diff-added', added + '\n'));
  if (preview?.exists && suffix > 0) pre.append(makeElement('span', 'diff-context', after.slice(after.length - suffix, after.length - suffix + 2).map((line) => `  ${line}`).join('\n') + '\n'));
  if (preview?.exists && suffix > 2) pre.append(makeElement('span', 'diff-context', `… ${suffix - 2} unchanged line(s) below …`));
}

function renderApprovalCard(task) {
  const card = makeElement('article', 'remote-approval-card');
  const isRobloxTool = task.action === 'roblox_tool';
  const isGitCommit = task.action === 'git_commit';
  card.dataset.action = task.action;
  const head = makeElement('div', 'remote-approval-head');
  const outsideWorkspace = task.action === 'write_file' && task.preview?.outsideWorkspace === true;
  const icon = task.action === 'run_command' ? '$' : isRobloxTool ? 'R' : isGitCommit ? 'G' : '✎';
  head.append(makeElement('span', 'remote-approval-icon', icon));
  const title = makeElement('div', 'remote-approval-title');
  title.append(makeElement('strong', '', taskTitle(task)));
  title.append(makeElement('small', '', `Arena request · ${task.requestId}`));
  head.append(title, makeElement('span', 'pending-tag', 'NEEDS APPROVAL'));
  card.append(head);
  card.append(makeElement('div', 'remote-approval-description', task.action === 'run_command'
    ? 'This exact shell command will run from your workspace with your OS account permissions. It is not sandboxed.'
    : isRobloxTool
      ? 'This tool runs in your open Roblox Studio session. It may run Luau, access local assets or Roblox services, or change a place. Review the exact tool name and all arguments before approving.'
      : isGitCommit
        ? 'This creates a local commit from the currently staged changes only. It does not push. Arena Local disables Git hooks and commit signing for this action; inspect the complete staged diff and message.'
        : outsideWorkspace
          ? 'EXTREMELY DANGEROUS: this write targets a file outside the selected workspace. Verify the full path and complete diff before approving.'
          : 'Arena is asking to change a file in the selected workspace. Review the complete proposed diff.'));

  if (isRobloxTool && task.robloxToolDescription) {
    const toolDescription = makeElement('details', 'roblox-tool-description');
    toolDescription.append(makeElement('summary', '', 'Show Studio-provided tool description'));
    toolDescription.append(makeElement('p', '', String(task.robloxToolDescription).slice(0, 2_000)));
    card.append(toolDescription);
  }

  if (task.action === 'run_command') {
    const warning = makeElement('div', 'preview-box');
    warning.append(makeElement('div', 'preview-label', 'Exact command'));
    warning.append(makeElement('pre', '', task.args?.command || ''));
    card.append(warning);
    card.append(makeElement('div', 'command-warning', '⚠  Shell can reach files outside this workspace. Only approve commands you understand.'));
  } else if (isRobloxTool) {
    const box = makeElement('div', 'preview-box');
    box.append(makeElement('div', 'preview-label', 'Exact Roblox Studio MCP call'));
    box.append(makeElement('code', 'preview-path', task.args?.name || 'Unknown tool'));
    const args = makeElement('pre', 'roblox-tool-arguments', JSON.stringify(task.args?.arguments ?? {}, null, 2));
    box.append(args);
    card.append(box);
    card.append(makeElement('div', 'command-warning', '⚠  Studio tools can change live place data or execute code. Approval covers only this exact call.'));
  } else if (isGitCommit) {
    const preview = task.preview || {};
    const box = makeElement('div', 'preview-box');
    box.append(makeElement('div', 'preview-label', `Staged diff · ${preview.fileCount ?? 0} file(s)`));
    box.append(makeElement('code', 'preview-path', `Branch: ${preview.branch || 'HEAD'} · Current HEAD: ${preview.head || '(unborn)'}`));
    box.append(makeElement('div', 'preview-label', 'Commit message'));
    box.append(makeElement('pre', 'git-commit-message', preview.message || task.args?.message || ''));
    box.append(makeElement('div', 'preview-label', 'Files'));
    box.append(makeElement('pre', 'git-commit-files', Array.isArray(preview.files) ? preview.files.join(' · ') : ''));
    box.append(makeElement('pre', 'git-commit-diff', preview.diff || 'No textual diff. Review the staged files above.'));
    card.append(box);
    card.append(makeElement('div', 'command-warning', '⚠  Approval applies only to this exact staged state and message. Hooks/signing are disabled; the commit stays local and is not pushed.'));
  } else if (task.preview) {
    const box = makeElement('div', `preview-box${outsideWorkspace ? ' external-write-preview' : ''}`);
    box.append(makeElement('div', 'preview-label', outsideWorkspace
      ? 'EXTREMELY DANGEROUS · OUTSIDE WORKSPACE'
      : task.preview.exists ? 'Proposed diff' : 'New file contents'));
    if (outsideWorkspace) box.append(makeElement('code', 'preview-path', task.preview.path));
    const diff = document.createElement('pre');
    appendDiff(diff, task.preview);
    box.append(diff);
    card.append(box);
    if (outsideWorkspace) card.append(makeElement('div', 'command-warning external-write-warning', '‼  This can overwrite a private or system file your OS account can access. Approval applies only to this exact write.'));
  }

  const controls = makeElement('div', 'approval-buttons');
  controls.append(approvalButton(task, 'Approve once', 'approve', 'approve-once'));
  if (!isGitCommit) controls.append(approvalButton(task, 'Allow exact action for session', 'approve_session', 'approve-session'));
  controls.append(approvalButton(task, 'Deny', 'deny', 'deny-action'));
  card.append(controls);
  return card;
}

function approvalButton(task, label, decision, className) {
  const button = makeElement('button', className, label);
  button.type = 'button';
  button.addEventListener('click', async () => {
    button.disabled = true;
    const siblings = button.parentElement.querySelectorAll('button');
    siblings.forEach((item) => { item.disabled = true; });
    try {
      await window.arenaLocal.approveTask(task.taskId, decision);
      showToast(decision === 'deny' ? 'Request denied.' : decision === 'approve_session' ? 'Exact action approved for this connection.' : 'Action approved.');
    } catch (error) {
      siblings.forEach((item) => { item.disabled = false; });
      showToast(error.message, true);
    }
  });
  return button;
}

function renderActivity() {
  const tasks = [...(appState?.tasks || [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8);
  els.activityList.replaceChildren();
  if (!tasks.length) {
    els.activityList.append(makeElement('div', 'empty-activity', 'No requests yet. Start a connection, then ask Arena.ai to inspect your workspace or use connected Roblox Studio tools.'));
    return;
  }
  for (const task of tasks) {
    const row = makeElement('div', `activity-row${task.autoApproved ? ' auto-approved' : ''}`);
    const isRobloxTool = task.action === 'roblox_tool';
    const change = task.action === 'write_file' || task.action === 'run_command' || task.action === 'git_commit' || (isRobloxTool && task.robloxPermission !== 'read-only');
    const activityIconClass = `activity-action-icon${change ? ' change' : ''}${isRobloxTool ? ' roblox' : ''}`;
    row.append(makeElement('span', activityIconClass, task.action === 'run_command' ? '$' : isRobloxTool ? 'R' : task.action === 'git_commit' ? 'G' : task.action === 'list_processes' ? 'P' : change ? '✎' : '⌕'));
    const main = makeElement('div', 'activity-main');
    main.append(makeElement('strong', '', taskTitle(task)));
    const activitySummary = task.autoApproved
      ? task.status === 'running' ? 'AUTO-APPROVED · running without a prompt' : task.resultSummary || 'AUTO-APPROVED · no prompt was shown'
      : task.resultSummary || requestStatusLabel(task.status);
    main.append(makeElement('small', '', activitySummary));
    row.append(main);
    const isError = ['denied', 'expired', 'cancelled', 'error'].includes(task.status);
    row.append(makeElement('span', `activity-state${task.autoApproved ? ' automatic' : task.status === 'awaiting_approval' || task.status === 'preparing' ? ' waiting' : isError ? ' error' : ''}`));
    els.activityList.append(row);
  }
}

async function runUiAction(action, successMessage) {
  try {
    const result = await action();
    if (result) applyState(result);
    if (successMessage) showToast(successMessage);
    return result;
  } catch (error) {
    showToast(error.message || 'Action failed.', true);
    return null;
  }
}

async function loadFiles(relativePath = browserPath) {
  const targetPath = relativePath || '.';
  const requestSequence = ++fileLoadSequence;
  if (!(appState?.localWorkspaceRoot ?? appState?.workspaceRoot)) {
    currentFileEntries = [];
    currentFileTruncated = false;
    els.fileBreadcrumbs.replaceChildren();
    els.fileList.replaceChildren(makeElement('div', 'empty-files', 'Select a local workspace to use desktop file preview.'));
    els.fileFoot.textContent = appState?.fullComputerAccess
      ? 'Remote file scope has no workspace. Choose a separate local folder for desktop preview and Git.'
      : 'Choose a local folder to enable file preview.';
    return;
  }
  if (targetPath !== browserPath && els.fileFilter) els.fileFilter.value = '';
  browserPath = targetPath;
  currentFileEntries = [];
  currentFileTruncated = false;
  renderBreadcrumbs();
  els.fileList.replaceChildren(makeElement('div', 'loading-row', 'Loading files…'));
  els.fileFoot.textContent = 'Reading this folder on your computer…';
  try {
    const data = await window.arenaLocal.listFiles(targetPath);
    if (requestSequence !== fileLoadSequence) return;
    renderFileList(data);
  } catch (error) {
    if (requestSequence !== fileLoadSequence) return;
    els.fileList.replaceChildren(makeElement('div', 'empty-files', error.message));
    els.fileFoot.textContent = 'This folder could not be loaded. Check the selected workspace and try again.';
  }
}

function renderBreadcrumbs() {
  els.fileBreadcrumbs.replaceChildren();
  const root = makeElement('button', '', displayName('.'));
  root.type = 'button';
  root.addEventListener('click', () => loadFiles('.'));
  els.fileBreadcrumbs.append(root);
  if (browserPath === '.') return;
  let current = '';
  for (const part of browserPath.split('/').filter(Boolean)) {
    els.fileBreadcrumbs.append(makeElement('span', '', '/'));
    current = current ? `${current}/${part}` : part;
    const target = current;
    const button = makeElement('button', '', part);
    button.type = 'button';
    button.addEventListener('click', () => loadFiles(target));
    els.fileBreadcrumbs.append(button);
  }
}

function fileGlyph(name) {
  const ext = name.split('.').at(-1)?.toLowerCase();
  if (['js', 'mjs', 'ts', 'tsx', 'jsx', 'py'].includes(ext)) return '◇';
  if (['md', 'txt', 'rst'].includes(ext)) return '≡';
  if (['json', 'yaml', 'yml', 'toml'].includes(ext)) return '{}';
  if (['css', 'scss', 'html'].includes(ext)) return '◈';
  return '·';
}

function renderFileList(data) {
  currentFileEntries = Array.isArray(data.entries) ? data.entries : [];
  currentFileTruncated = Boolean(data.truncated);
  const filter = els.fileFilter?.value.trim().toLocaleLowerCase() || '';
  const entries = filter
    ? currentFileEntries.filter((entry) => entry.name.toLocaleLowerCase().includes(filter))
    : currentFileEntries;
  els.fileList.replaceChildren();
  if (!entries.length) {
    const message = currentFileEntries.length
      ? 'No visible file names match this filter.'
      : 'This folder has no visible files.';
    els.fileList.append(makeElement('div', 'empty-files', message));
    els.fileFoot.textContent = currentFileTruncated ? 'The folder listing is capped at 300 items.' : currentFileEntries.length ? 'Clear the filter to see the full folder listing.' : 'Try another folder or refresh the listing.';
    return;
  }
  for (const entry of entries) {
    const row = makeElement('button', 'file-row');
    row.type = 'button';
    const directory = entry.type === 'directory';
    row.append(makeElement('span', `file-icon${directory ? ' folder' : ''}`, directory ? '▰' : fileGlyph(entry.name)));
    row.append(makeElement('span', 'file-name', entry.name));
    if (entry.protected) row.append(makeElement('span', 'file-locked', 'LOCKED'));
    else if (directory) row.append(makeElement('span', 'file-chevron', '›'));
    row.disabled = entry.protected || entry.type === 'symlink' || (!directory && entry.type !== 'file');
    row.title = entry.protected ? 'Protected file or symbolic link.' : entry.path;
    if (!row.disabled) row.addEventListener('click', () => directory ? loadFiles(entry.path) : openFile(entry.path));
    els.fileList.append(row);
  }
  if (currentFileTruncated) {
    els.fileFoot.textContent = filter
      ? `Showing ${entries.length} matches in the first 300 listed items.`
      : 'Showing the first 300 items.';
  } else if (filter) {
    els.fileFoot.textContent = `Showing ${entries.length} of ${currentFileEntries.length} items in this folder.`;
  } else {
    els.fileFoot.textContent = 'Arena only receives files it asks to read in this folder.';
  }
}

async function openFile(filePath) {
  try {
    const file = await window.arenaLocal.readFile(filePath);
    $('#fileDialogTitle').textContent = filePath.split('/').at(-1) || filePath;
    $('#filePreviewMeta').textContent = `${filePath} · ${file.bytes.toLocaleString()} bytes`;
    $('#filePreview').textContent = file.content;
    els.fileDialog.showModal();
  } catch (error) {
    showToast(error.message, true);
  }
}

async function saveNgrokToken() {
  const value = els.ngrokTokenInput.value.trim();
  if (!value && appState?.ngrokTokenConfigured) {
    showToast('An ngrok token is already saved. Leave the field blank to keep it.');
    return;
  }
  const button = $('#saveNgrokTokenBtn');
  button.disabled = true;
  try {
    const result = await window.arenaLocal.saveNgrokToken(value);
    els.ngrokTokenInput.value = '';
    const state = await window.arenaLocal.getState();
    applyState(state);
    showToast(result.message || 'ngrok token saved.');
  } catch (error) {
    showToast(error.message, true);
  } finally {
    button.disabled = Boolean(appState?.tunnelStarting || appState?.tunnelStopping || appState?.tunnelActive);
  }
}

async function connectRobloxMcp() {
  try {
    const state = await window.arenaLocal.connectRobloxMcp();
    applyState(state);
    if (state.robloxMcp?.status === 'connected') {
      showToast(`Roblox Studio MCP connected · ${state.robloxMcp.toolCount} tools discovered.`);
    }
  } catch (error) {
    showToast(error.message || 'Could not connect to Roblox Studio MCP.', true);
  }
}

async function disconnectRobloxMcp() {
  if (!window.confirm('Disconnect Roblox Studio MCP? Pending Studio approvals will be cancelled. An in-flight Studio tool may already have changed the place.')) return;
  await runUiAction(() => window.arenaLocal.disconnectRobloxMcp(), 'Roblox Studio MCP disconnected.');
}

async function toggleRobloxMcpIntegration() {
  const enabled = appState?.robloxMcpEnabled === false || appState?.robloxMcp?.enabled === false;
  robloxToggleBusy = true;
  updateRobloxMcpPanel();
  try {
    const state = await window.arenaLocal.setRobloxMcpEnabled(enabled);
    applyState(state);
    const finalEnabled = state.robloxMcpEnabled !== false && state.robloxMcp?.enabled !== false;
    showToast(finalEnabled !== enabled
      ? 'Studio MCP availability was left unchanged.'
      : enabled
        ? 'Roblox Studio MCP enabled locally. Connect to Studio when ready.'
        : 'Roblox Studio MCP disabled locally and disconnected.');
  } catch (error) {
    showToast(error.message || 'Could not change Roblox Studio MCP availability.', true);
  } finally {
    robloxToggleBusy = false;
    updateRobloxMcpPanel();
  }
}

async function toggleWebTools() {
  const enabled = appState?.webToolsEnabled !== true;
  webToggleBusy = true;
  updateWebToolsPanel();
  try {
    const state = await window.arenaLocal.setWebToolsEnabled(enabled);
    applyState(state);
    if (state.webToolsEnabled !== enabled) {
      showToast('Web tools remain disabled; no web requests were enabled.');
    } else if (enabled) {
      showToast('Public web tools enabled. Queries and retrieved page text can be sent outside this computer.');
    } else {
      showToast('Web tools disabled locally; active web requests were cancelled.');
    }
  } catch (error) {
    showToast(error.message || 'Could not change web tools availability.', true);
  } finally {
    webToggleBusy = false;
    updateWebToolsPanel();
  }
}

async function toggleGitIntegration() {
  const enabled = appState?.gitIntegrationEnabled === false;
  gitToggleBusy = true;
  updateGitIntegrationPanel();
  try {
    const state = await window.arenaLocal.setGitIntegrationEnabled(enabled);
    applyState(state);
    if (state.gitIntegrationEnabled !== enabled) {
      showToast('Git integration availability was left unchanged.');
    } else if (state.gitIntegrationEnabled) {
      await loadGitDashboard();
      showToast('Local Git and remote Git tools enabled.');
    } else {
      showToast('Git disabled locally; local and remote Git controls are blocked.');
    }
  } catch (error) {
    showToast(error.message || 'Could not change Git integration availability.', true);
  } finally {
    gitToggleBusy = false;
    updateGitIntegrationPanel();
    updateGitSelectionControls();
  }
}

async function startTunnel() {
  try {
    const state = await window.arenaLocal.startTunnel();
    applyState(state);
    showToast('Remote link is active. Copy the Arena setup prompt.');
  } catch (error) {
    if (!/cancelled/i.test(error.message || '')) showToast(error.message || 'Could not start the remote link.', true);
  }
}

async function cancelTunnelStart() {
  if (!appState?.tunnelStarting) return;
  els.cancelTunnelBtn.disabled = true;
  els.cancelTunnelBtn.textContent = 'Cancelling…';
  try {
    const state = await window.arenaLocal.stopTunnel();
    applyState(state);
    showToast('Connection attempt cancelled.');
  } catch (error) {
    showToast(error.message || 'Could not cancel the connection attempt.', true);
  } finally {
    els.cancelTunnelBtn.disabled = false;
    els.cancelTunnelBtn.textContent = 'Cancel attempt';
  }
}

async function toggleControlPause() {
  if (!appState?.tunnelActive || controlPauseBusy) return;
  const pause = !Boolean(appState.controlPaused);
  controlPauseBusy = true;
  updateConnectionPanel();
  try {
    const state = await window.arenaLocal.setControlPaused(pause);
    applyState(state);
    if (state.controlPaused === pause) {
      showToast(pause
        ? 'Remote control paused. The link and pairing key are unchanged; pending approvals were cancelled.'
        : 'Remote control resumed with the same link and pairing key.');
    } else if (!pause) {
      showToast('Remote control remains paused.');
    }
  } catch (error) {
    showToast(error.message || 'Could not change remote control pause state.', true);
  } finally {
    controlPauseBusy = false;
    updateConnectionPanel();
  }
}

async function stopTunnel() {
  const confirmation = appState?.fullComputerAccess
    ? 'Stop the remote link? This disables EXTREMELY DANGEROUS full-computer access, rotates the pairing key, and denies pending approvals.'
    : 'Stop the remote link and revoke the current Arena connection?';
  if (!window.confirm(confirmation)) return;
  const success = appState?.fullComputerAccess
    ? 'Remote link stopped; full-computer access disabled, pairing key rotated, and pending approvals denied.'
    : 'Remote link stopped and pending approvals denied.';
  await runUiAction(() => window.arenaLocal.stopTunnel(), success);
}

async function rotatePairingKey() {
  const confirmation = appState?.fullComputerAccess
    ? 'Rotate the bearer key? This disables EXTREMELY DANGEROUS full-computer access, revokes current Arena instructions, and denies pending approvals.'
    : 'Rotate the bearer key? This revokes the current Arena instructions and denies any pending approvals.';
  if (!window.confirm(confirmation)) return;
  const hadFullComputerAccess = Boolean(appState?.fullComputerAccess);
  try {
    const result = await window.arenaLocal.rotatePairingToken();
    applyState(await window.arenaLocal.getState());
    showToast(hadFullComputerAccess
      ? `Pairing key rotated; full-computer access disabled. New ending: ${result.hint}`
      : `Pairing key rotated. New ending: ${result.hint}`);
  } catch (error) {
    showToast(error.message, true);
  }
}

async function forgetNgrokToken() {
  if (!window.confirm('Forget the saved ngrok authtoken? The remote connection will stop first.')) return;
  try {
    await window.arenaLocal.forgetNgrokToken();
    applyState(await window.arenaLocal.getState());
    showToast('ngrok token removed.');
  } catch (error) {
    showToast(error.message, true);
  }
}

async function copyArenaInstructions() {
  try {
    await window.arenaLocal.copyArenaInstructions();
    showToast('Arena setup prompt copied. Paste it into your Arena.ai conversation.');
  } catch (error) {
    showToast(error.message, true);
  }
}

async function copyTunnelUrl() {
  try {
    await window.arenaLocal.copyTunnelUrl();
    showToast('Public API URL copied. Keep the bearer key private.');
  } catch (error) {
    showToast(error.message, true);
  }
}

function resetCombinedUnlockDialog() {
  clearInterval(combinedUnlockTimer);
  combinedUnlockTimer = null;
  combinedUnlockChallengeId = '';
  combinedUnlockReadyAt = 0;
  combinedUnlockExpiresAt = 0;
  combinedUnlockWorkspaceRoot = '';
  combinedUnlockPermissionMode = '';
  combinedUnlockPairingHint = '';
  combinedUnlockSliderUnlocked = false;
  if (els.fullNoAskUnlockDialog.open) els.fullNoAskUnlockDialog.close();
  els.fullNoAskSlider.value = '0';
  els.fullNoAskSlider.disabled = true;
  els.continueFullNoAskUnlock.disabled = true;
  els.continueFullNoAskUnlock.textContent = 'Continue to final warning';
  els.fullNoAskProgress.value = 0;
  els.fullNoAskCountdown.textContent = 'Wait 30 seconds before the slider unlocks.';
}

async function cancelCombinedUnlock() {
  const challengeId = combinedUnlockChallengeId;
  resetCombinedUnlockDialog();
  if (!challengeId) return;
  try {
    await window.arenaLocal.cancelFullComputerNoAskUnlock(challengeId);
  } catch (error) {
    showToast(error.message || 'Could not cancel the local safety unlock.', true);
  }
}

function updateCombinedUnlockCountdown() {
  if (!combinedUnlockChallengeId) return;
  const now = performance.now();
  if (now >= combinedUnlockExpiresAt) {
    void cancelCombinedUnlock();
    showToast('Safety unlock expired. No-Ask was not enabled; start the warning sequence again.', true);
    return;
  }
  const remainingMs = Math.max(0, combinedUnlockReadyAt - now);
  const elapsedSeconds = Math.min(30, Math.max(0, (30_000 - remainingMs) / 1_000));
  els.fullNoAskProgress.value = elapsedSeconds;
  if (remainingMs > 0) {
    const remainingSeconds = Math.ceil(remainingMs / 1_000);
    els.fullNoAskCountdown.textContent = `Continue unlocks in ${remainingSeconds} second${remainingSeconds === 1 ? '' : 's'}.`;
    els.fullNoAskSlider.disabled = true;
    els.continueFullNoAskUnlock.disabled = true;
    return;
  }
  els.fullNoAskProgress.value = 30;
  els.fullNoAskCountdown.textContent = combinedUnlockSliderUnlocked
    ? '30-second wait complete. Slider unlocked; Continue is ready.'
    : '30-second wait complete. Slide all the way right to unlock Continue.';
  els.fullNoAskSlider.disabled = false;
  els.continueFullNoAskUnlock.disabled = !combinedUnlockSliderUnlocked;
}

async function beginCombinedUnlock() {
  if (combinedUnlockStarting || combinedUnlockChallengeId) return;
  combinedUnlockStarting = true;
  try {
    const challenge = await window.arenaLocal.beginFullComputerNoAskUnlock();
    if (!challenge) return;
    if (typeof challenge.challengeId !== 'string' || !challenge.challengeId) {
      throw new Error('The local safety challenge was not valid. No-Ask was not enabled.');
    }
    combinedUnlockChallengeId = challenge.challengeId;
    if (challenge.waitMs !== 30_000) throw new Error('The local safety challenge was not valid. No-Ask was not enabled.');
    combinedUnlockWorkspaceRoot = appState?.workspaceRoot || '';
    combinedUnlockPermissionMode = appState?.permissionMode || 'ask';
    combinedUnlockPairingHint = appState?.pairingTokenHint || '';
    const now = performance.now();
    combinedUnlockReadyAt = now + challenge.waitMs;
    combinedUnlockExpiresAt = now + Math.max(challenge.waitMs, (Number(challenge.expiresInMs) || 0) - 1_000);
    combinedUnlockSliderUnlocked = false;
    els.fullNoAskSlider.value = '0';
    els.fullNoAskSlider.disabled = true;
    els.continueFullNoAskUnlock.disabled = true;
    els.continueFullNoAskUnlock.textContent = 'Continue to final warning';
    els.fullNoAskProgress.value = 0;
    els.fullNoAskCountdown.textContent = 'Continue unlocks in 30 seconds.';
    els.fullNoAskUnlockDialog.showModal();
    updateCombinedUnlockCountdown();
    combinedUnlockTimer = setInterval(updateCombinedUnlockCountdown, 200);
  } catch (error) {
    if (combinedUnlockChallengeId) {
      const challengeId = combinedUnlockChallengeId;
      resetCombinedUnlockDialog();
      await window.arenaLocal.cancelFullComputerNoAskUnlock(challengeId).catch(() => {});
    }
    showToast(error.message || 'Could not begin the local safety unlock.', true);
  } finally {
    combinedUnlockStarting = false;
  }
}

function updateCombinedUnlockSlider() {
  if (!combinedUnlockChallengeId || performance.now() < combinedUnlockReadyAt) {
    els.fullNoAskSlider.value = '0';
    combinedUnlockSliderUnlocked = false;
    els.continueFullNoAskUnlock.disabled = true;
    return;
  }
  combinedUnlockSliderUnlocked = Number(els.fullNoAskSlider.value) >= 100;
  els.continueFullNoAskUnlock.disabled = !combinedUnlockSliderUnlocked;
  els.fullNoAskCountdown.textContent = combinedUnlockSliderUnlocked
    ? '30-second wait complete. Slider unlocked; Continue is ready.'
    : '30-second wait complete. Slide all the way right to unlock Continue.';
}

async function completeCombinedUnlock() {
  if (!combinedUnlockChallengeId || !combinedUnlockSliderUnlocked || performance.now() < combinedUnlockReadyAt) return;
  const challengeId = combinedUnlockChallengeId;
  els.fullNoAskSlider.disabled = true;
  els.continueFullNoAskUnlock.disabled = true;
  els.continueFullNoAskUnlock.textContent = 'Waiting for final confirmation…';
  clearInterval(combinedUnlockTimer);
  combinedUnlockTimer = null;
  try {
    const state = await window.arenaLocal.completeFullComputerNoAskUnlock(challengeId);
    resetCombinedUnlockDialog();
    applyState(state);
    if (state.fullComputerAccess && state.permissionMode === 'no-ask') {
      showToast('EXTREMELY DANGEROUS full-computer + No-Ask enabled. The pairing key rotated; the remote link still requires a separate final warning.', true);
    } else {
      showToast('Combined mode was not enabled. Your previous permission mode remains active.');
    }
  } catch (error) {
    resetCombinedUnlockDialog();
    applyState(await window.arenaLocal.getState().catch(() => appState));
    showToast(error.message || 'The combined-mode safety unlock failed.', true);
  }
}

async function changePermission() {
  const mode = els.permissionMode.value;
  if (mode === 'no-ask' && appState?.fullComputerAccess && appState?.permissionMode !== 'no-ask') {
    els.permissionMode.value = appState.permissionMode || 'ask';
    updatePermissionCopy();
    await beginCombinedUnlock();
    return;
  }
  updatePermissionCopy();
  try {
    const state = await window.arenaLocal.setPermissionMode(mode);
    applyState(state);
    if (state.permissionMode !== mode) {
      const currentMode = state.permissionMode === 'read-only' ? 'Read only mode' : 'Ask mode';
      showToast(`No-ask mode was not enabled. ${currentMode} remains active.`);
    } else if (mode === 'no-ask') {
      showToast('VERY DANGEROUS: changes will run without approval until you stop the link, rotate the key, choose another folder, or close the app.', true);
    } else if (mode === 'read-only') {
      showToast('Read only mode enabled; pending changes were denied.');
    } else {
      showToast('Changes now require desktop approval.');
    }
  } catch (error) {
    els.permissionMode.value = appState?.permissionMode || 'ask';
    updatePermissionCopy();
    showToast(error.message, true);
  }
}

async function toggleFullComputerAccess() {
  const enable = !Boolean(appState?.fullComputerAccess);
  els.fullComputerAccessBtn.disabled = true;
  try {
    const state = await window.arenaLocal.setFullComputerAccess(enable);
    applyState(state);
    if (enable && state.fullComputerAccess) {
      showToast('EXTREMELY DANGEROUS full-computer mode enabled with no remote workspace. Use absolute file paths; select a separate local folder for preview/Git.', true);
    } else if (enable) {
      showToast('Full-computer access was not enabled. Workspace confinement remains active.');
    } else {
      showToast('Full-computer access disabled, workspace scope restored, and pairing key rotated.');
    }
  } catch (error) {
    showToast(error.message || 'Could not change file-access scope.', true);
  } finally {
    updateScopePanel();
  }
}

async function chooseWorkspace() {
  const previousRoot = appState?.localWorkspaceRoot ?? appState?.workspaceRoot ?? null;
  const hadFullComputerAccess = Boolean(appState?.fullComputerAccess);
  const result = await runUiAction(() => window.arenaLocal.chooseWorkspace());
  const newRoot = result?.localWorkspaceRoot ?? result?.workspaceRoot ?? null;
  if (result && newRoot !== previousRoot) {
    showToast(hadFullComputerAccess
      ? 'Separate local preview/Git workspace updated. Full-computer remote scope remains active; the pairing key rotated.'
      : 'Workspace folder updated and the pairing key rotated.');
  }
}

$('#saveNgrokTokenBtn').addEventListener('click', saveNgrokToken);
$('#startTunnelBtn').addEventListener('click', startTunnel);
$('#cancelTunnelBtn').addEventListener('click', cancelTunnelStart);
$('#pauseControlBtn').addEventListener('click', toggleControlPause);
$('#stopTunnelBtn').addEventListener('click', stopTunnel);
els.connectRobloxMcpBtn.addEventListener('click', connectRobloxMcp);
els.disconnectRobloxMcpBtn.addEventListener('click', disconnectRobloxMcp);
els.robloxMcpToggleBtn.addEventListener('click', toggleRobloxMcpIntegration);
els.webToolsToggleBtn.addEventListener('click', toggleWebTools);
els.gitIntegrationToggleBtn.addEventListener('click', toggleGitIntegration);
els.gitPushBtn.addEventListener('click', pushGitBranch);
els.refreshGitBtn.addEventListener('click', () => loadGitDashboard());
els.gitStageSelectedBtn.addEventListener('click', stageSelectedGitFiles);
els.gitUnstageSelectedBtn.addEventListener('click', unstageSelectedGitFiles);
els.copyGitDiffBtn.addEventListener('click', copyGitDiff);
els.initializeGitBtn.addEventListener('click', initializeGitRepository);
els.gitPreviewCommitBtn.addEventListener('click', previewLocalGitCommit);
els.confirmGitCommitBtn.addEventListener('click', confirmLocalGitCommit);
els.cancelGitCommitBtn.addEventListener('click', closeGitCommitPreview);
els.closeGitCommitDialogBtn.addEventListener('click', closeGitCommitPreview);
els.gitCommitPreviewDialog.addEventListener('cancel', (event) => {
  event.preventDefault();
  closeGitCommitPreview();
});
els.saveGitIdentityBtn.addEventListener('click', saveGitIdentity);
els.saveGitRemoteBtn.addEventListener('click', saveGitRemote);
els.saveRepositoryInstructionsBtn.addEventListener('click', saveRepositoryInstructions);
els.repositoryInstructionsInput.addEventListener('input', updateInstructionsByteCount);
els.saveGithubTokenBtn.addEventListener('click', saveGithubToken);
els.forgetGithubTokenBtn.addEventListener('click', forgetGithubToken);
els.loadGithubReposBtn.addEventListener('click', loadGithubRepositories);
els.githubRepositorySelect.addEventListener('change', updateGithubAccountPanel);
els.setGithubOriginBtn.addEventListener('click', setGithubOrigin);
$('#copyArenaPromptBtn').addEventListener('click', copyArenaInstructions);
$('#copyUrlBtn').addEventListener('click', copyTunnelUrl);
$('#rotatePairingBtn').addEventListener('click', rotatePairingKey);
$('#rotatePairingTopBtn').addEventListener('click', rotatePairingKey);
$('#forgetNgrokTokenBtn').addEventListener('click', forgetNgrokToken);
$('#chooseWorkspaceBtn').addEventListener('click', chooseWorkspace);
$('#fullComputerAccessBtn').addEventListener('click', toggleFullComputerAccess);
$('#refreshFilesBtn').addEventListener('click', () => loadFiles(browserPath));
els.fileFilter.addEventListener('input', () => renderFileList({ entries: currentFileEntries, truncated: currentFileTruncated }));
$('#permissionMode').addEventListener('change', changePermission);
$('#closeFileBtn').addEventListener('click', () => els.fileDialog.close());
els.cancelFullNoAskUnlock.addEventListener('click', () => { void cancelCombinedUnlock(); });
els.fullNoAskSlider.addEventListener('input', updateCombinedUnlockSlider);
els.fullNoAskSlider.addEventListener('change', updateCombinedUnlockSlider);
els.continueFullNoAskUnlock.addEventListener('click', () => { void completeCombinedUnlock(); });
els.fullNoAskUnlockDialog.addEventListener('cancel', (event) => {
  event.preventDefault();
  void cancelCombinedUnlock();
});

const navigationItems = [...document.querySelectorAll('.nav-item')];
const desktopShell = document.querySelector('.desktop-shell');

function setChatFocusMode(focused) {
  const isFocused = Boolean(focused);
  desktopShell?.classList.toggle('chat-focus-mode', isFocused);
  if (els.toggleChatFocusBtn) {
    els.toggleChatFocusBtn.textContent = isFocused ? 'Restore panels' : 'Expand chat';
    els.toggleChatFocusBtn.setAttribute('aria-pressed', String(isFocused));
  }
}

for (const link of navigationItems) {
  link.addEventListener('click', (event) => {
    event.preventDefault();
    const target = link.getAttribute('href');
    setChatFocusMode(target === '#chat');
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (target) document.querySelector(target)?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
    for (const item of navigationItems) {
      const active = item === link;
      item.classList.toggle('active', active);
      if (active) item.setAttribute('aria-current', 'page');
      else item.removeAttribute('aria-current');
    }
  });
}

function registerChatHandlers() {
  els.loadArenaChatBtn?.addEventListener('click', loadArenaChat);
  els.toggleChatFocusBtn?.addEventListener('click', () => {
    setChatFocusMode(!desktopShell?.classList.contains('chat-focus-mode'));
  });
  els.reloadArenaChatBtn?.addEventListener('click', () => reloadArenaChat());
  els.retryArenaChatBtn?.addEventListener('click', () => reloadArenaChat());
  els.openArenaChatBrowserBtn?.addEventListener('click', () => { void openArenaChatInBrowser(); });
  els.chatFallbackOpenBtn?.addEventListener('click', () => { void openArenaChatInBrowser(); });
  els.resetArenaChatBtn?.addEventListener('click', () => { void resetArenaChatSession(); });
}

async function init() {
  startSplashBoot();
  registerChatHandlers();
  try {
    appState = await window.arenaLocal.getState();
    applyState(appState);
    await loadFiles('.');
    window.arenaLocal.onState(applyState);
    completeSplashBoot();
  } catch (error) {
    setSplashStatus('something went wrong…');
    showToast(error.message || 'Arena Local could not initialize.', true);
    completeSplashBoot();
  }
}

init();
