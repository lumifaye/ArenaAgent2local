const { contextBridge, ipcRenderer } = require('electron');

const invoke = (channel) => (...args) => ipcRenderer.invoke(channel, ...args);
const send = (channel) => (...args) => ipcRenderer.send(channel, ...args);

contextBridge.exposeInMainWorld('arenaLocal', {
  getState: invoke('arena:get-state'),
  listFiles: invoke('arena:list-files'),
  readFile: invoke('arena:read-file'),
  getGitDashboard: invoke('arena:get-git-dashboard'),
  setGitIntegrationEnabled: invoke('arena:set-git-integration-enabled'),
  initializeGitRepository: invoke('arena:initialize-git-repository'),
  configureGitRepository: invoke('arena:configure-git-repository'),
  saveRepositoryInstructions: invoke('arena:save-repository-instructions'),
  stageGitFiles: invoke('arena:stage-git-files'),
  unstageGitFiles: invoke('arena:unstage-git-files'),
  previewGitCommit: invoke('arena:preview-git-commit'),
  commitStagedGit: invoke('arena:commit-staged-git'),
  pushGitBranch: invoke('arena:push-git-branch'),
  saveGithubToken: invoke('arena:save-github-token'),
  forgetGithubToken: invoke('arena:forget-github-token'),
  listGithubRepositories: invoke('arena:list-github-repositories'),
  chooseWorkspace: invoke('arena:choose-workspace'),
  saveNgrokToken: invoke('arena:save-ngrok-token'),
  forgetNgrokToken: invoke('arena:forget-ngrok-token'),
  startTunnel: invoke('arena:start-tunnel'),
  stopTunnel: invoke('arena:stop-tunnel'),
  setControlPaused: invoke('arena:set-control-paused'),
  connectRobloxMcp: invoke('arena:connect-roblox-mcp'),
  disconnectRobloxMcp: invoke('arena:disconnect-roblox-mcp'),
  setRobloxMcpEnabled: invoke('arena:set-roblox-mcp-enabled'),
  setWebToolsEnabled: invoke('arena:set-web-tools-enabled'),
  rotatePairingToken: invoke('arena:rotate-pairing-token'),
  copyArenaInstructions: invoke('arena:copy-instructions'),
  copyTunnelUrl: invoke('arena:copy-tunnel-url'),
  setPermissionMode: invoke('arena:set-permission-mode'),
  setFullComputerAccess: invoke('arena:set-full-computer-access'),
  beginFullComputerNoAskUnlock: invoke('arena:begin-full-computer-no-ask-unlock'),
  completeFullComputerNoAskUnlock: invoke('arena:complete-full-computer-no-ask-unlock'),
  cancelFullComputerNoAskUnlock: invoke('arena:cancel-full-computer-no-ask-unlock'),
  approveTask: invoke('arena:approve-task'),
  openArenaChat: invoke('arena:open-arena-chat'),
  resetArenaChat: invoke('arena:reset-arena-chat'),
  loadArenaChat: invoke('arena:load-arena-chat'),
  reloadArenaChat: invoke('arena:reload-arena-chat'),
  setArenaChatBounds: send('arena:set-arena-chat-bounds'),
  onArenaChatEvent(callback) {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('arena:chat-event', listener);
    return () => ipcRenderer.removeListener('arena:chat-event', listener);
  },
  onState(callback) {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('arena:state', listener);
    return () => ipcRenderer.removeListener('arena:state', listener);
  },
});
