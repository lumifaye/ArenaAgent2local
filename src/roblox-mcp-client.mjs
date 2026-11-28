import { access } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

const CONNECT_TIMEOUT_MS = 30_000;
const TOOL_CALL_TIMEOUT_MS = 10 * 60_000;
const MAX_TOOL_DESCRIPTION_LENGTH = 10_000;
const MAX_TOOL_LIST_PAGES = 64;

// Read-only names from Roblox's documented built-in Studio MCP tool set. Only
// these known operations are available in Read only mode; new/unknown tools
// require approval even if their MCP annotations claim to be read-only.
export const ROBLOX_READ_ONLY_TOOLS = new Set([
  'script_read',
  'script_search',
  'script_grep',
  'search_asset',
  'search_game_tree',
  'inspect_instance',
  'get_studio_state',
  'get_console_output',
  'screen_capture',
  'list_roblox_studios',
  'http_get',
  'skill',
]);

export function isRobloxReadOnlyTool(name) {
  return ROBLOX_READ_ONLY_TOOLS.has(name);
}

export function getRobloxMcpLaunchConfig({ platform = process.platform, env = process.env, homeDir = os.homedir() } = {}) {
  if (platform === 'win32') {
    const localAppData = env.LOCALAPPDATA || path.win32.join(homeDir, 'AppData', 'Local');
    const filePath = path.win32.join(localAppData, 'Roblox', 'mcp.bat');
    // Roblox documents cmd.exe /c <LOCALAPPDATA>\\Roblox\\mcp.bat. Launch
    // cmd.exe explicitly because the MCP stdio transport uses shell: false.
    const command = env.ComSpec || env.COMSPEC || env.comspec || 'cmd.exe';
    return { command, args: ['/c', filePath], filePath, platform };
  }

  if (platform === 'darwin') {
    const candidates = [
      '/Applications/RobloxStudio.app/Contents/MacOS/StudioMCP',
      path.join(homeDir, 'Applications', 'RobloxStudio.app', 'Contents', 'MacOS', 'StudioMCP'),
    ];
    const filePath = candidates.find((candidate) => existsSync(candidate)) || candidates[0];
    return { command: filePath, args: [], filePath, platform };
  }

  return null;
}

function withTimeout(promise, timeoutMs, message) {
  let timer;
  return new Promise((resolve, reject) => {
    timer = setTimeout(() => reject(new Error(message)), timeoutMs);
    timer.unref?.();
    Promise.resolve(promise).then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

function normalizeTool(tool) {
  if (!tool || typeof tool.name !== 'string' || !tool.name.trim() || tool.name.length > 128) return null;
  const output = {
    name: tool.name,
    description: typeof tool.description === 'string' ? tool.description.slice(0, MAX_TOOL_DESCRIPTION_LENGTH) : '',
    inputSchema: tool.inputSchema && typeof tool.inputSchema === 'object' && !Array.isArray(tool.inputSchema)
      ? tool.inputSchema
      : { type: 'object', properties: {} },
    permission: isRobloxReadOnlyTool(tool.name) ? 'read-only' : 'approval',
  };
  if (typeof tool.title === 'string') output.title = tool.title.slice(0, 200);
  if (tool.annotations && typeof tool.annotations === 'object' && !Array.isArray(tool.annotations)) {
    output.annotations = tool.annotations;
  }
  return output;
}

function copyTools(tools) {
  return tools.map((tool) => structuredClone(tool));
}

function friendlyConnectionError(error, serverStderr = '') {
  const message = error instanceof Error ? error.message : String(error || 'Connection failed.');
  if (/timed out/i.test(message)) {
    return 'Roblox Studio MCP did not respond in time. Open the latest Roblox Studio, enable Assistant → Manage MCP Servers → Enable Studio as MCP server, then try again.';
  }
  if (/ENOENT|not found|no such file/i.test(message)) {
    return `Roblox Studio MCP was not found. Install or update Roblox Studio, then enable its MCP server. ${message.slice(0, 300)}`;
  }
  const stderr = serverStderr.trim().slice(-600);
  return stderr ? `${message.slice(0, 600)}\n${stderr}` : message.slice(0, 800);
}

export class RobloxMcpClient {
  constructor({
    clientInfo = { name: 'arena-local', version: '0.0.0' },
    onState = () => {},
    launchConfig = getRobloxMcpLaunchConfig(),
    clientFactory = (info) => new Client(info, { versionNegotiation: { mode: 'legacy' }, listMaxPages: MAX_TOOL_LIST_PAGES }),
    transportFactory = (config) => new StdioClientTransport({ ...config, stderr: 'pipe', maxBufferSize: 16 * 1024 * 1024 }),
  } = {}) {
    this.clientInfo = clientInfo;
    this.onState = onState;
    this.launchConfig = launchConfig;
    this.clientFactory = clientFactory;
    this.transportFactory = transportFactory;
    this.status = launchConfig ? 'disconnected' : 'unsupported';
    this.error = launchConfig ? '' : 'Roblox Studio MCP is supported on Windows and macOS.';
    this.tools = [];
    this.client = null;
    this.transport = null;
    this.connectPromise = null;
    this.intentionalClose = false;
    this.serverStderr = '';
  }

  getState() {
    const installed = this.launchConfig?.filePath ? existsSync(this.launchConfig.filePath) : Boolean(this.launchConfig);
    return {
      supported: Boolean(this.launchConfig),
      installed,
      status: this.status,
      error: this.error,
      toolCount: this.tools.length,
      tools: this.tools.map((tool) => ({
        name: tool.name,
        title: tool.title,
        description: tool.description,
        permission: tool.permission,
      })),
    };
  }

  getTools() {
    return copyTools(this.tools);
  }

  getTool(name) {
    const tool = this.tools.find((candidate) => candidate.name === name);
    return tool ? structuredClone(tool) : null;
  }

  publishState() {
    try { this.onState(this.getState()); }
    catch { /* The desktop window may be closing. */ }
  }

  setStatus(status, error = '') {
    this.status = status;
    this.error = error;
    this.publishState();
  }

  async connect() {
    if (this.status === 'connected') return this.getState();
    if (this.connectPromise) return this.connectPromise;
    if (!this.launchConfig) throw new Error('Roblox Studio MCP is supported on Windows and macOS.');

    if (this.launchConfig.filePath) {
      try {
        await access(this.launchConfig.filePath);
      } catch (error) {
        const message = error.code === 'ENOENT'
          ? `Roblox Studio MCP was not found at ${this.launchConfig.filePath}. Install or update Roblox Studio first.`
          : error.message;
        this.setStatus('error', message);
        throw new Error(message);
      }
    }

    this.setStatus('connecting');
    const attempt = (async () => {
      const client = this.clientFactory(this.clientInfo);
      const transport = this.transportFactory(this.launchConfig);
      this.client = client;
      this.transport = transport;
      this.serverStderr = '';
      transport.stderr?.on('data', (chunk) => {
        this.serverStderr = `${this.serverStderr}${String(chunk)}`.slice(-2_000);
      });
      client.onclose = () => {
        if (this.intentionalClose || this.client !== client) return;
        this.client = null;
        this.transport = null;
        this.tools = [];
        this.setStatus('error', 'Roblox Studio MCP disconnected. Open Studio, enable its MCP server, and reconnect.');
      };
      client.onerror = (error) => {
        if (this.client !== client || this.intentionalClose) return;
        this.intentionalClose = true;
        this.tools = [];
        this.setStatus('error', friendlyConnectionError(error, this.serverStderr));
        void client.close().catch(() => {}).finally(() => {
          if (this.client === client) {
            this.client = null;
            this.transport = null;
          }
          this.intentionalClose = false;
        });
      };

      try {
        await withTimeout(
          client.connect(transport),
          CONNECT_TIMEOUT_MS,
          'Roblox Studio MCP connection timed out.',
        );
        const tools = await withTimeout(
          this.refreshTools(),
          CONNECT_TIMEOUT_MS,
          'Roblox Studio MCP tool discovery timed out.',
        );
        if (this.client !== client || this.status === 'error') {
          throw new Error('Roblox Studio MCP disconnected while its tools were being discovered.');
        }
        this.tools = tools;
        this.setStatus('connected');
        return this.getState();
      } catch (error) {
        this.intentionalClose = true;
        await client.close().catch(() => {});
        if (this.client === client) {
          this.client = null;
          this.transport = null;
        }
        this.intentionalClose = false;
        const message = friendlyConnectionError(error, this.serverStderr);
        this.tools = [];
        this.setStatus('error', message);
        throw new Error(message);
      }
    })();

    this.connectPromise = attempt;
    try {
      return await attempt;
    } finally {
      if (this.connectPromise === attempt) this.connectPromise = null;
    }
  }

  async refreshTools() {
    if (!this.client || !['connecting', 'connected'].includes(this.status)) {
      throw new Error('Roblox Studio MCP is not connected.');
    }
    const response = await this.client.listTools(undefined, {
      cacheMode: 'refresh',
      timeout: CONNECT_TIMEOUT_MS,
      maxTotalTimeout: CONNECT_TIMEOUT_MS,
    });
    const seen = new Set();
    this.tools = (response.tools || []).map(normalizeTool).filter((tool) => {
      if (!tool || seen.has(tool.name)) return false;
      seen.add(tool.name);
      return true;
    });
    this.publishState();
    return this.getTools();
  }

  async callTool(name, args = {}) {
    if (this.status !== 'connected' || !this.client) throw new Error('Roblox Studio MCP is not connected. Connect it in Arena Local first.');
    if (!this.getTool(name)) throw new Error(`Roblox Studio MCP tool “${name}” is not available. Refresh the tool list and try again.`);
    if (!args || typeof args !== 'object' || Array.isArray(args)) throw new Error('Roblox Studio tool arguments must be a JSON object.');
    return this.client.callTool({ name, arguments: args }, {
      timeout: TOOL_CALL_TIMEOUT_MS,
      maxTotalTimeout: TOOL_CALL_TIMEOUT_MS,
      resetTimeoutOnProgress: true,
    });
  }

  async disconnect() {
    const client = this.client;
    this.intentionalClose = true;
    this.tools = [];
    if (client) {
      this.setStatus('disconnecting');
      await client.close().catch(() => {});
    }
    this.client = null;
    this.transport = null;
    this.intentionalClose = false;
    this.setStatus(this.launchConfig ? 'disconnected' : 'unsupported', this.launchConfig ? '' : 'Roblox Studio MCP is supported on Windows and macOS.');
    return this.getState();
  }
}
