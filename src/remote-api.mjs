import http from 'node:http';
import crypto from 'node:crypto';
import path from 'node:path';
import {
  actionFingerprint,
  CHANGE_TOOLS,
  executeMutationTool,
  executeReadTool,
  previewWorkspaceWrite,
} from './workspace.mjs';
import { isRobloxReadOnlyTool } from './roblox-mcp-client.mjs';
import { searchWeb, scrapeWeb, validatePublicHttpsUrl } from './web-tools.mjs';
import {
  executeGitCommit,
  executeLocalReadTool,
  LOCAL_MUTATION_TOOLS,
  LOCAL_READ_TOOLS,
  prepareGitCommitPreview,
} from './local-tools.mjs';

const MAX_BODY_BYTES = 300_000;
const MAX_ACTIVE_TASKS = 20;
const MAX_RETAINED_TASKS = 120;
const TASK_TTL_MS = 30 * 60 * 1_000;
const APPROVAL_TTL_MS = 10 * 60 * 1_000;
const RATE_LIMIT_PER_MINUTE = 240;
const WEB_RATE_LIMIT_PER_MINUTE = 30;
const MAX_ACTIVE_WEB_TASKS = 3;
const MAX_ROBLOX_ARGS_BYTES = 256 * 1024;
const MAX_ROBLOX_STUDIO_ID_LENGTH = 512;
const ROBLOX_STUDIO_DISCOVERY_TOOL = 'list_roblox_studios';
const CONTROL_PAUSED_MESSAGE = 'Remote control is paused on this computer. The link and pairing key are unchanged; only health checks are available until the user resumes control locally.';
const ACTIONS = new Set([
  'list_files', 'read_file', 'search_text', 'write_file', 'run_command', 'roblox_tool',
  'git_status', 'git_diff', 'git_log', 'git_commit', 'list_processes', 'web_search', 'web_scrape',
]);
const GIT_ACTIONS = new Set(['git_status', 'git_diff', 'git_log', 'git_commit']);
const WEB_ACTIONS = new Set(['web_search', 'web_scrape']);
const REQUEST_ID_PATTERN = /^[a-zA-Z0-9._:-]{8,100}$/;

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function sendJson(res, status, payload, additionalHeaders = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    ...additionalHeaders,
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store, no-cache, must-revalidate',
    pragma: 'no-cache',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
  });
  res.end(body);
}

async function readJson(req) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > MAX_BODY_BYTES) throw new HttpError(413, 'Request body is too large.');
    chunks.push(chunk);
  }
  let value;
  try { value = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new HttpError(400, 'Request body must be valid JSON.'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new HttpError(400, 'Request body must be a JSON object.');
  return value;
}

function constantTimeEqual(received, expected) {
  if (typeof received !== 'string' || typeof expected !== 'string') return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && a.length > 0 && crypto.timingSafeEqual(a, b);
}

function authorize(req, getPairingToken) {
  const header = req.headers.authorization || '';
  const match = /^Bearer ([A-Za-z0-9_-]{32,200})$/.exec(header);
  const expected = getPairingToken();
  if (!match || !constantTimeEqual(match[1], expected)) throw new HttpError(401, 'Unauthorized. Check the desktop app pairing token.');
}

function boundedString(value, name, maxLength, { optional = false } = {}) {
  if (optional && value === undefined) return undefined;
  if (typeof value !== 'string' || !value.trim() || value.length > maxLength) {
    throw new HttpError(400, `${name} must be a non-empty string of at most ${maxLength} characters.`);
  }
  return value;
}

function validateTaskBody(body) {
  const extra = Object.keys(body).filter((key) => !['requestId', 'action', 'args'].includes(key));
  if (extra.length) throw new HttpError(400, `Unknown request field: ${extra[0]}`);
  const requestId = boundedString(body.requestId, 'requestId', 100);
  if (!REQUEST_ID_PATTERN.test(requestId)) throw new HttpError(400, 'requestId must use letters, numbers, dots, underscores, colons, or hyphens.');
  if (!ACTIONS.has(body.action)) throw new HttpError(400, `Unsupported action. Allowed actions: ${[...ACTIONS].join(', ')}.`);
  const input = body.args === undefined ? {} : body.args;
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new HttpError(400, 'args must be a JSON object.');
  let args;
  let allowedKeys;
  switch (body.action) {
    case 'list_files':
      allowedKeys = ['path'];
      args = { path: boundedString(input.path ?? '.', 'path', 1_000) };
      break;
    case 'read_file':
      allowedKeys = ['path'];
      args = { path: boundedString(input.path, 'path', 1_000) };
      break;
    case 'search_text':
      allowedKeys = ['query', 'path'];
      args = {
        query: boundedString(input.query, 'query', 300),
        path: boundedString(input.path ?? '.', 'path', 1_000),
      };
      break;
    case 'write_file':
      allowedKeys = ['path', 'content'];
      args = {
        path: boundedString(input.path, 'path', 1_000),
        content: typeof input.content === 'string' ? input.content : null,
      };
      if (args.content === null) throw new HttpError(400, 'content must be a string.');
      if (Buffer.byteLength(args.content, 'utf8') > 256 * 1024) throw new HttpError(413, 'File content is limited to 256 KB.');
      break;
    case 'run_command':
      allowedKeys = ['command', 'cwd'];
      args = { command: boundedString(input.command, 'command', 2_000) };
      if (input.cwd !== undefined) args.cwd = boundedString(input.cwd, 'cwd', 1_000);
      if (args.command.includes('\0')) throw new HttpError(400, 'command cannot contain null characters.');
      break;
    case 'git_status':
    case 'list_processes':
      allowedKeys = [];
      args = {};
      break;
    case 'git_diff':
      allowedKeys = [];
      args = {};
      break;
    case 'git_log':
      allowedKeys = ['limit'];
      if (input.limit !== undefined && (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 50)) {
        throw new HttpError(400, 'limit must be an integer from 1 to 50.');
      }
      args = { limit: input.limit ?? 20 };
      break;
    case 'web_search': {
      allowedKeys = ['query', 'maxResults'];
      const query = boundedString(input.query, 'query', 500).trim();
      if (/[\u0000-\u001f\u007f]/.test(query)) throw new HttpError(400, 'query cannot contain control characters.');
      if (input.maxResults !== undefined && (!Number.isInteger(input.maxResults) || input.maxResults < 1 || input.maxResults > 10)) {
        throw new HttpError(400, 'maxResults must be an integer from 1 to 10.');
      }
      args = { query, maxResults: input.maxResults ?? 5 };
      break;
    }
    case 'web_scrape': {
      allowedKeys = ['url'];
      const rawUrl = boundedString(input.url, 'url', 2_048);
      try { args = { url: validatePublicHttpsUrl(rawUrl).href }; }
      catch (error) { throw new HttpError(400, error.message || 'url must be a public HTTPS URL.'); }
      break;
    }
    case 'git_commit': {
      allowedKeys = ['message'];
      const message = boundedString(input.message, 'message', 500).trim();
      if ([...message].some((character) => character.charCodeAt(0) < 32)) throw new HttpError(400, 'Git commit messages must fit on one line and cannot contain control characters.');
      args = { message };
      break;
    }
    case 'roblox_tool': {
      allowedKeys = ['name', 'arguments'];
      const name = boundedString(input.name, 'name', 128);
      const toolArguments = input.arguments === undefined ? {} : input.arguments;
      if (!toolArguments || typeof toolArguments !== 'object' || Array.isArray(toolArguments)) {
        throw new HttpError(400, 'arguments must be a JSON object.');
      }
      if (Buffer.byteLength(JSON.stringify(toolArguments), 'utf8') > MAX_ROBLOX_ARGS_BYTES) {
        throw new HttpError(413, 'Roblox Studio tool arguments are limited to 256 KB.');
      }
      args = { name, arguments: toolArguments };
      break;
    }
    default:
      throw new HttpError(400, 'Unsupported action.');
  }
  const unknownArg = Object.keys(input).find((key) => !allowedKeys.includes(key));
  if (unknownArg) throw new HttpError(400, `Unknown argument for ${body.action}: ${unknownArg}`);
  return { requestId, action: body.action, args };
}

function safeDesktopTask(task) {
  const args = task.action === 'write_file' ? { path: task.args.path } : task.args;
  return {
    taskId: task.taskId,
    requestId: task.requestId,
    action: task.action,
    args,
    robloxPermission: task.robloxPermission || null,
    robloxToolDescription: task.robloxToolDescription || null,
    fullComputerAccess: task.fullComputerAccess === true,
    preview: task.status === 'awaiting_approval' ? task.preview : null,
    status: task.status,
    message: task.message,
    resultSummary: task.resultSummary,
    error: task.error,
    autoApproved: task.autoApproved === true,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}

function summarizeResult(action, result) {
  if (!result) return '';
  if (result.error) return result.error;
  if (result.denied) return result.message || 'Denied.';
  if (action === 'list_files') return `${result.entries?.length ?? 0} entries${result.truncated ? ' (truncated)' : ''}`;
  if (action === 'read_file') return `Read ${result.bytes ?? 0} bytes from ${result.path}.`;
  if (action === 'search_text') return `${result.matches?.length ?? 0} matches across ${result.filesScanned ?? 0} files.`;
  if (action === 'write_file') return `Wrote ${result.bytes ?? 0} bytes to ${result.path}.`;
  if (action === 'run_command') return `Command exited with ${result.exitCode ?? 'an error'}${result.timedOut ? ' (timed out)' : ''}.`;
  if (action === 'git_status') return `${result.count ?? 0} safe change(s) on ${result.branch || 'the current branch'}${result.omittedProtectedCount ? ` · ${result.omittedProtectedCount} protected path(s) hidden` : ''}.`;
  if (action === 'git_diff') return `${result.fileCount ?? 0} changed file(s) in the staged diff${result.omittedProtectedCount ? ` · ${result.omittedProtectedCount} protected path(s) hidden` : ''}${result.truncated ? ' · output truncated' : ''}.`;
  if (action === 'git_log') return `${result.count ?? 0} recent commit(s).`;
  if (action === 'git_commit') return `Created local commit ${result.commit || ''} from ${result.fileCount ?? 0} staged file(s).`;
  if (action === 'list_processes') return `${result.processes?.length ?? 0} process(es) listed${result.truncated ? ' (truncated)' : ''}.`;
  if (action === 'web_search') return `${result.resultCount ?? result.results?.length ?? 0} web search result(s) from ${result.provider || 'the web'}${result.truncated ? ' · output may be truncated' : ''}.`;
  if (action === 'web_scrape') return `Scraped ${result.charCount ?? 0} characters from ${String(result.title || 'the public page').slice(0, 120)}${result.truncated ? ' · text truncated' : ''}.`;
  if (action === 'roblox_tool') return result.isError ? 'Roblox Studio MCP tool reported an error.' : 'Roblox Studio MCP tool completed.';
  return 'Complete.';
}

function arenaTaskResponse(task) {
  const result = {
    taskId: task.taskId,
    requestId: task.requestId,
    action: task.action,
    fullComputerAccess: task.fullComputerAccess === true,
    status: task.status,
    autoApproved: task.autoApproved === true,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
  if (task.status === 'preparing') result.message = 'Preparing a local approval preview.';
  if (task.status === 'awaiting_approval') result.message = 'Waiting for approval in the Arena Local desktop app.';
  if (task.status === 'denied' || task.status === 'expired' || task.status === 'cancelled') result.message = task.message || 'The request was not run.';
  if (task.status === 'error') result.error = task.error || 'The local action failed.';
  if (task.status === 'completed') result.result = task.result;
  return result;
}

function sortNewest(tasks) {
  return [...tasks].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function publicRobloxTool(tool) {
  const normalized = {
    name: tool.name,
    description: tool.description || '',
    inputSchema: tool.inputSchema || { type: 'object', properties: {} },
    permission: isRobloxReadOnlyTool(tool.name) ? 'read-only' : 'approval',
  };
  if (tool.title) normalized.title = tool.title;
  if (tool.annotations) normalized.annotations = tool.annotations;
  return normalized;
}

function validateRobloxToolSchema(tool, args) {
  const schema = tool.inputSchema;
  if (Array.isArray(schema?.required)) {
    for (const key of schema.required) {
      if (typeof key === 'string' && !Object.prototype.hasOwnProperty.call(args, key)) {
        throw new HttpError(400, `Roblox Studio tool “${tool.name}” requires arguments.${key} according to its input schema.`);
      }
    }
  }
  const properties = schema?.properties;
  if (properties && typeof properties === 'object' && !Array.isArray(properties)) {
    for (const [key, definition] of Object.entries(properties)) {
      if (!Object.prototype.hasOwnProperty.call(args, key) || !definition || typeof definition !== 'object') continue;
      const value = args[key];
      const expectedTypes = Array.isArray(definition.type) ? definition.type : [definition.type];
      const typeMatches = (type) => {
        switch (type) {
          case 'string': return typeof value === 'string';
          case 'number': return typeof value === 'number' && Number.isFinite(value);
          case 'integer': return typeof value === 'number' && Number.isInteger(value);
          case 'boolean': return typeof value === 'boolean';
          case 'array': return Array.isArray(value);
          case 'object': return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
          case 'null': return value === null;
          default: return true;
        }
      };
      if (expectedTypes.some((type) => typeof type === 'string') && !expectedTypes.some(typeMatches)) {
        throw new HttpError(400, `arguments.${key} must match the ${tool.name} input schema.`);
      }
      if (Array.isArray(definition.enum) && !definition.enum.some((candidate) => Object.is(candidate, value))) {
        throw new HttpError(400, `arguments.${key} must be one of the values allowed by the ${tool.name} input schema.`);
      }
    }
  }
}

function taskNeedsApproval(task) {
  if (CHANGE_TOOLS.has(task.action) || LOCAL_MUTATION_TOOLS.has(task.action)) return true;
  return task.action === 'roblox_tool' && task.robloxPermission !== 'read-only';
}

export function createRemoteApi({
  getWorkspaceRoot,
  getGitWorkspaceRoot = getWorkspaceRoot,
  getGitIntegrationEnabled = () => true,
  getRobloxMcpEnabled = () => true,
  getWebToolsEnabled = () => false,
  runWebSearch = searchWeb,
  runWebScrape = scrapeWeb,
  getPairingToken,
  getPermissionMode,
  getFullComputerAccess = () => false,
  getFullComputerNoAskAuthorized = () => false,
  getRobloxMcpState = () => ({ status: 'disconnected', supported: false, toolCount: 0 }),
  getRobloxMcpTools = () => [],
  refreshRobloxMcpTools = async () => [],
  callRobloxMcpTool = async () => { throw new Error('Roblox Studio MCP is not connected.'); },
  onUpdate = () => {},
}) {
  const tasks = new Map();
  const requestIndex = new Map();
  const approvedActions = new Map();
  const approvedActionNames = new Map();
  let approvalEpoch = 0;
  let controlPaused = false;
  let controlEpoch = 0;
  let rateWindowStart = Date.now();
  let rateCount = 0;
  let webRateWindowStart = Date.now();
  let webRateCount = 0;

  function changed() {
    try { onUpdate(); } catch { /* UI may not be ready during startup/shutdown. */ }
  }

  function assertControlActive(expectedEpoch = controlEpoch) {
    if (controlPaused || expectedEpoch !== controlEpoch) throw new HttpError(423, CONTROL_PAUSED_MESSAGE);
  }

  function setControlPaused(paused) {
    if (typeof paused !== 'boolean') throw new Error('Remote control pause state must be a boolean.');
    if (paused === controlPaused) return controlPaused;
    controlPaused = paused;
    controlEpoch += 1;
    if (controlPaused) cancelPendingChanges('Remote control was paused locally. Pending approvals were cancelled; actions already running may finish.');
    else changed();
    return controlPaused;
  }

  function currentRobloxMcpState() {
    if (!getRobloxMcpEnabled()) return { status: 'disabled', error: 'Roblox Studio MCP is disabled locally in Arena Local.', toolCount: 0 };
    try { return getRobloxMcpState() || { status: 'disconnected' }; }
    catch { return { status: 'error', error: 'Could not read Roblox Studio MCP status.' }; }
  }

  function currentRobloxTools() {
    try {
      const tools = getRobloxMcpTools();
      return Array.isArray(tools) ? tools : [];
    } catch {
      return [];
    }
  }

  async function refreshRobloxTools() {
    if (!getRobloxMcpEnabled()) throw new HttpError(503, 'Roblox Studio MCP is disabled locally in Arena Local.');
    try { await refreshRobloxMcpTools(); }
    catch (error) { throw new HttpError(503, `Could not refresh Roblox Studio tools: ${error.message || 'MCP connection failed.'}`); }
    const state = currentRobloxMcpState();
    if (state.status !== 'connected') {
      throw new HttpError(503, state.error || 'Roblox Studio MCP is not connected. Connect it in the Arena Local desktop app first.');
    }
    return currentRobloxTools();
  }

  function trimTasks() {
    const now = Date.now();
    for (const [id, task] of tasks) {
      if (now - Date.parse(task.createdAt) > TASK_TTL_MS && !['running', 'preparing', 'awaiting_approval'].includes(task.status)) {
        tasks.delete(id);
        requestIndex.delete(task.requestId);
      }
    }
    const finished = sortNewest([...tasks.values()].filter((task) => !['running', 'preparing', 'awaiting_approval'].includes(task.status)));
    for (const task of finished.slice(MAX_RETAINED_TASKS)) {
      tasks.delete(task.taskId);
      requestIndex.delete(task.requestId);
    }
  }

  function consumeRateLimit() {
    const now = Date.now();
    if (now - rateWindowStart >= 60_000) {
      rateWindowStart = now;
      rateCount = 0;
    }
    rateCount += 1;
    if (rateCount > RATE_LIMIT_PER_MINUTE) throw new HttpError(429, 'Rate limit reached. Wait a minute and retry.');
  }

  function consumeWebRateLimit() {
    const now = Date.now();
    if (now - webRateWindowStart >= 60_000) {
      webRateWindowStart = now;
      webRateCount = 0;
    }
    webRateCount += 1;
    if (webRateCount > WEB_RATE_LIMIT_PER_MINUTE) throw new HttpError(429, 'Web tools are limited to 30 requests per minute. Wait before searching or scraping again.');
  }

  function setStatus(task, status, fields = {}) {
    task.status = status;
    task.updatedAt = new Date().toISOString();
    Object.assign(task, fields);
    changed();
  }

  async function executeTask(task, expectedWriteState = null, expectedGitCommitFingerprint = null) {
    try {
      let result;
      if (task.action === 'roblox_tool') {
        if (!getRobloxMcpEnabled()) throw new Error('Roblox Studio MCP was disabled locally before this action could run.');
        result = await callRobloxMcpTool(task.args.name, task.args.arguments);
      } else if (WEB_ACTIONS.has(task.action)) {
        if (!getWebToolsEnabled()) throw new Error('Web tools were disabled locally before this action could run.');
        const signal = task.abortController?.signal;
        result = task.action === 'web_search'
          ? await runWebSearch(task.args, { signal })
          : await runWebScrape(task.args, { signal });
        if (task.status === 'cancelled') return;
        if (!getWebToolsEnabled()) {
          denyTask(task, 'Web tools were disabled locally before this result could be returned.', 'cancelled');
          return;
        }
      } else if (GIT_ACTIONS.has(task.action)) {
        if (!getGitIntegrationEnabled()) throw new Error('Local Git integration was disabled before this action could run.');
        const gitRoot = getGitWorkspaceRoot();
        if (!gitRoot) throw new Error('No local Git workspace is selected. Choose a repository in Arena Local before requesting Git actions.');
        result = task.action === 'git_commit'
          ? await executeGitCommit(gitRoot, task.args.message, expectedGitCommitFingerprint)
          : await executeLocalReadTool(gitRoot, task.action, task.args);
      } else if (LOCAL_READ_TOOLS.has(task.action)) {
        result = await executeLocalReadTool(getWorkspaceRoot(), task.action, task.args);
      } else {
        const root = getWorkspaceRoot();
        result = CHANGE_TOOLS.has(task.action)
          ? await executeMutationTool(root, task.action, task.args, {
            expectedWriteState,
            fullComputerAccess: task.fullComputerAccess,
            cwd: task.args.cwd,
          })
          : await executeReadTool(root, task.action, task.args, { fullComputerAccess: task.fullComputerAccess });
      }
      const summary = summarizeResult(task.action, result);
      setStatus(task, 'completed', {
        result,
        resultSummary: task.autoApproved ? `AUTO-APPROVED · ${summary}` : summary,
        message: undefined,
        error: undefined,
      });
    } catch (error) {
      if (task.status === 'cancelled') return;
      const message = error.message || 'Local action failed.';
      setStatus(task, 'error', { error: message, resultSummary: task.autoApproved ? `AUTO-APPROVED · ${message}` : message });
    } finally {
      task.abortController = null;
    }
  }

  function clearApprovedActions() {
    approvalEpoch += 1;
    approvedActions.clear();
    approvedActionNames.clear();
  }

  function clearApprovedRobloxActions() {
    let cleared = false;
    for (const [fingerprint, action] of approvedActionNames) {
      if (action !== 'roblox_tool') continue;
      approvedActions.delete(fingerprint);
      approvedActionNames.delete(fingerprint);
      cleared = true;
    }
    if (cleared) approvalEpoch += 1;
  }

  function clearApprovedGitActions() {
    let cleared = false;
    for (const [fingerprint, action] of approvedActionNames) {
      if (!GIT_ACTIONS.has(action)) continue;
      approvedActions.delete(fingerprint);
      approvedActionNames.delete(fingerprint);
      cleared = true;
    }
    if (cleared) approvalEpoch += 1;
  }

  function clearApprovalTimeout(task) {
    if (task.approvalTimeout) clearTimeout(task.approvalTimeout);
    task.approvalTimeout = null;
  }

  function denyTask(task, message, status = 'denied') {
    clearApprovalTimeout(task);
    task.preview = null;
    setStatus(task, status, { message, resultSummary: message });
  }

  async function approveTask(taskId, decision) {
    if (controlPaused) throw new Error(CONTROL_PAUSED_MESSAGE);
    const task = tasks.get(taskId);
    if (!task || task.status !== 'awaiting_approval') throw new Error('This request is no longer waiting for approval.');
    if (GIT_ACTIONS.has(task.action) && !getGitIntegrationEnabled()) {
      denyTask(task, 'Local Git integration was disabled in Arena Local.', 'cancelled');
      return safeDesktopTask(task);
    }
    if (task.action === 'roblox_tool' && !getRobloxMcpEnabled()) {
      denyTask(task, 'Roblox Studio MCP was disabled in Arena Local.', 'cancelled');
      return safeDesktopTask(task);
    }
    if (!['approve', 'approve_session', 'deny'].includes(decision)) throw new Error('Choose approve, allow exact action for this session, or deny.');
    if (task.action === 'git_commit' && decision === 'approve_session') {
      throw new Error('Git commits must be approved one at a time because staged changes can change between requests.');
    }
    clearApprovalTimeout(task);
    if (decision === 'deny') {
      denyTask(task, 'Denied by the user on this computer.');
      return safeDesktopTask(task);
    }
    if (getPermissionMode() === 'read-only') {
      denyTask(task, 'Blocked because Read only mode is enabled.');
      return safeDesktopTask(task);
    }
    const rememberForSession = decision === 'approve_session';
    const approvalEpochAtStart = approvalEpoch;
    const expectedWriteState = task.action === 'write_file' && task.preview
      ? { exists: task.preview.exists, before: task.preview.before }
      : null;
    const expectedGitCommitFingerprint = task.action === 'git_commit' ? task.preview?.fingerprint || null : null;
    task.preview = null;
    setStatus(task, 'running', { message: undefined });
    await executeTask(task, expectedWriteState, expectedGitCommitFingerprint);
    if (rememberForSession && task.status === 'completed' && approvalEpoch === approvalEpochAtStart && getPermissionMode() === 'ask') {
      const trustedState = task.action === 'write_file' ? { exists: true, before: task.args.content } : null;
      approvedActions.set(task.fingerprint, trustedState);
      approvedActionNames.set(task.fingerprint, task.action);
    }
    return safeDesktopTask(task);
  }

  async function createTask(request, expectedControlEpoch = controlEpoch) {
    assertControlActive(expectedControlEpoch);
    if (GIT_ACTIONS.has(request.action)) {
      if (!getGitIntegrationEnabled()) throw new HttpError(503, 'Local Git integration is disabled in Arena Local.');
      if (!getGitWorkspaceRoot()) throw new HttpError(503, 'No local Git workspace is selected. Choose a repository in Arena Local before requesting Git actions.');
    }
    if (WEB_ACTIONS.has(request.action) && !getWebToolsEnabled()) {
      throw new HttpError(503, 'Public web tools are disabled locally in Arena Local.');
    }
    const remoteWorkspaceRoot = getWorkspaceRoot();
    if (getFullComputerAccess() && !remoteWorkspaceRoot && ['list_files', 'read_file', 'search_text', 'write_file'].includes(request.action)
      && !path.isAbsolute(request.args.path || '')) {
      throw new HttpError(400, 'Full-computer mode has no selected workspace; file actions require an explicit absolute path.');
    }
    if (request.action === 'run_command') {
      if (!remoteWorkspaceRoot && getFullComputerAccess() && !path.isAbsolute(request.args.cwd || '')) {
        throw new HttpError(400, 'Full-computer mode has no selected workspace; run_command requires an explicit absolute cwd.');
      }
      if (request.args.cwd !== undefined && (remoteWorkspaceRoot || !getFullComputerAccess())) {
        throw new HttpError(400, 'cwd is only accepted as an explicit absolute path in full-computer mode without a workspace.');
      }
    }
    if (request.action === 'roblox_tool' && !getRobloxMcpEnabled()) {
      throw new HttpError(503, 'Roblox Studio MCP is disabled locally in Arena Local.');
    }
    trimTasks();
    const requestFingerprint = crypto.createHash('sha256').update(JSON.stringify({ action: request.action, args: request.args })).digest('hex');
    const existingId = requestIndex.get(request.requestId);
    if (existingId) {
      const existing = tasks.get(existingId);
      if (existing && existing.requestFingerprint !== requestFingerprint) throw new HttpError(409, 'requestId was already used for a different action.');
      if (existing) return existing;
    }
    if (WEB_ACTIONS.has(request.action)) {
      const activeWebCount = [...tasks.values()].filter((task) => WEB_ACTIONS.has(task.action)
        && ['running', 'preparing', 'awaiting_approval'].includes(task.status)).length;
      if (activeWebCount >= MAX_ACTIVE_WEB_TASKS) throw new HttpError(429, 'Too many web requests are already running. Wait for them to finish before starting another.');
      consumeWebRateLimit();
    }

    let robloxPermission = null;
    let robloxToolDescription = null;
    if (request.action === 'roblox_tool') {
      await refreshRobloxTools();
      assertControlActive(expectedControlEpoch);
      const mcpState = currentRobloxMcpState();
      if (mcpState.status !== 'connected') {
        throw new HttpError(503, mcpState.error || 'Roblox Studio MCP is not connected. Connect it in the Arena Local desktop app first.');
      }
      const tool = currentRobloxTools().find((candidate) => candidate.name === request.args.name);
      if (!tool) throw new HttpError(400, `Roblox Studio MCP tool “${request.args.name}” is not available. Check GET /v1/roblox/tools.`);
      validateRobloxToolSchema(tool, request.args.arguments);
      const schemaRequiresStudioId = Array.isArray(tool.inputSchema?.required)
        && tool.inputSchema.required.includes('studio_id');
      const hasStudioId = Object.prototype.hasOwnProperty.call(request.args.arguments, 'studio_id');
      const requiresStudioId = tool.name !== ROBLOX_STUDIO_DISCOVERY_TOOL || schemaRequiresStudioId;
      if (requiresStudioId || hasStudioId) {
        boundedString(request.args.arguments.studio_id, 'arguments.studio_id', MAX_ROBLOX_STUDIO_ID_LENGTH);
      }
      if (tool.name === 'execute_luau') {
        const datamodelType = boundedString(request.args.arguments.datamodel_type, 'arguments.datamodel_type', 32);
        if (!['Edit', 'Client', 'Server'].includes(datamodelType)) {
          throw new HttpError(400, 'arguments.datamodel_type must be Edit, Client, or Server for execute_luau.');
        }
      }
      robloxPermission = isRobloxReadOnlyTool(tool.name) ? 'read-only' : 'approval';
      robloxToolDescription = typeof tool.description === 'string' ? tool.description.slice(0, 10_000) : '';
    }
    const activeCount = [...tasks.values()].filter((task) => ['running', 'preparing', 'awaiting_approval'].includes(task.status)).length;
    if (activeCount >= MAX_ACTIVE_TASKS) throw new HttpError(429, 'Too many active requests are waiting on this desktop.');

    const task = {
      taskId: crypto.randomUUID(),
      requestId: request.requestId,
      requestFingerprint,
      fingerprint: actionFingerprint(request.action, request.args),
      action: request.action,
      args: request.args,
      robloxPermission,
      robloxToolDescription,
      fullComputerAccess: Boolean(getFullComputerAccess()),
      fullComputerNoAskAuthorized: Boolean(getFullComputerNoAskAuthorized()),
      status: taskNeedsApproval({ action: request.action, robloxPermission }) ? 'preparing' : 'running',
      result: null,
      resultSummary: '',
      autoApproved: false,
      error: undefined,
      message: undefined,
      preview: null,
      abortController: WEB_ACTIONS.has(request.action) ? new AbortController() : null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      approvalTimeout: null,
    };
    tasks.set(task.taskId, task);
    requestIndex.set(task.requestId, task.taskId);
    changed();

    if (task.fullComputerAccess && getPermissionMode() === 'no-ask' && !task.fullComputerNoAskAuthorized) {
      denyTask(task, 'Full-computer No-Ask mode requires the local 30-second safety unlock.');
      return task;
    }

    if (!taskNeedsApproval(task)) {
      void executeTask(task);
      return task;
    }

    if (getPermissionMode() === 'read-only') {
      denyTask(task, 'Blocked by Read only mode.');
      return task;
    }

    if (getPermissionMode() === 'no-ask') {
      task.autoApproved = true;
      setStatus(task, 'running', { message: 'Auto-approved without a prompt in Very dangerous no-ask mode.' });
      void executeTask(task);
      return task;
    }

    const wasApprovedForSession = approvedActions.has(task.fingerprint);
    const approvedState = approvedActions.get(task.fingerprint);
    if (wasApprovedForSession && !['write_file', 'git_commit'].includes(task.action)) {
      setStatus(task, 'running', { message: undefined });
      void executeTask(task);
      return task;
    }

    if (task.action === 'write_file') {
      try {
        const preview = await previewWorkspaceWrite(getWorkspaceRoot(), task.args.path, task.args.content, {
          fullComputerAccess: task.fullComputerAccess,
        });
        if (task.status !== 'preparing') return task;
        if (wasApprovedForSession && approvedState && preview.exists === approvedState.exists && preview.before === approvedState.before) {
          setStatus(task, 'running', { message: undefined });
          void executeTask(task, { exists: preview.exists, before: preview.before });
          return task;
        }
        task.preview = preview;
      } catch (error) {
        if (task.status !== 'preparing') return task;
        setStatus(task, 'error', { error: error.message || 'Could not prepare a safe file preview.', resultSummary: error.message || 'Could not prepare a safe file preview.' });
        return task;
      }
    }
    if (task.action === 'git_commit') {
      try {
        const preview = await prepareGitCommitPreview(getWorkspaceRoot(), task.args.message);
        if (task.status !== 'preparing') return task;
        task.preview = preview;
      } catch (error) {
        if (task.status !== 'preparing') return task;
        setStatus(task, 'error', { error: error.message || 'Could not prepare a safe Git commit preview.', resultSummary: error.message || 'Could not prepare a safe Git commit preview.' });
        return task;
      }
    }
    if (task.status !== 'preparing') return task;
    setStatus(task, 'awaiting_approval', { message: 'Waiting for approval in the Arena Local desktop app.' });
    task.approvalTimeout = setTimeout(() => {
      if (task.status === 'awaiting_approval') denyTask(task, 'Approval expired after 10 minutes.', 'expired');
    }, APPROVAL_TTL_MS);
    task.approvalTimeout.unref?.();
    changed();
    return task;
  }

  function cancelPendingChanges(reason = 'Remote connection stopped.') {
    for (const task of tasks.values()) {
      if (task.status === 'awaiting_approval' || task.status === 'preparing') denyTask(task, reason, 'cancelled');
    }
    clearApprovedActions();
    changed();
  }

  function cancelPendingRobloxTasks(reason = 'Roblox Studio MCP disconnected.') {
    for (const task of tasks.values()) {
      if (task.action === 'roblox_tool' && (task.status === 'awaiting_approval' || task.status === 'preparing')) {
        denyTask(task, reason, 'cancelled');
      }
    }
    clearApprovedRobloxActions();
    changed();
  }

  function cancelPendingGitTasks(reason = 'Local Git integration was disabled.') {
    for (const task of tasks.values()) {
      if (GIT_ACTIONS.has(task.action) && (task.status === 'awaiting_approval' || task.status === 'preparing')) {
        denyTask(task, reason, 'cancelled');
      }
    }
    clearApprovedGitActions();
    changed();
  }

  function cancelPendingWebTasks(reason = 'Public web tools were disabled locally.') {
    for (const task of tasks.values()) {
      if (WEB_ACTIONS.has(task.action) && ['running', 'preparing', 'awaiting_approval'].includes(task.status)) {
        task.abortController?.abort();
        denyTask(task, reason, 'cancelled');
      }
    }
    changed();
  }

  function getDesktopTasks() {
    trimTasks();
    return sortNewest([...tasks.values()]).slice(0, 30).map(safeDesktopTask);
  }

  async function handleRequest(req, res) {
    const url = new URL(req.url || '/', 'http://127.0.0.1');
    if (!url.pathname.startsWith('/v1/')) throw new HttpError(404, 'Not found.');
    authorize(req, getPairingToken);
    consumeRateLimit();

    const healthRequest = req.method === 'GET' && url.pathname === '/v1/health';
    const requestControlEpoch = controlEpoch;
    if (controlPaused && !healthRequest) {
      req.resume();
      throw new HttpError(423, CONTROL_PAUSED_MESSAGE);
    }
    if (!healthRequest) assertControlActive(requestControlEpoch);

    if (healthRequest) {
      const robloxState = currentRobloxMcpState();
      return sendJson(res, 200, {
        ok: true,
        workspace: getWorkspaceRoot() ? 'selected' : 'none',
        gitWorkspaceSelected: Boolean(getGitWorkspaceRoot()),
        gitIntegrationEnabled: Boolean(getGitIntegrationEnabled()),
        webToolsEnabled: Boolean(getWebToolsEnabled()),
        permissionMode: getPermissionMode(),
        fullComputerAccess: Boolean(getFullComputerAccess()),
        controlPaused,
        robloxMcp: {
          connected: robloxState.status === 'connected',
          status: robloxState.status,
          toolCount: robloxState.toolCount || 0,
        },
      });
    }
    if (req.method === 'GET' && url.pathname === '/v1/roblox/tools') {
      assertControlActive(requestControlEpoch);
      let state = currentRobloxMcpState();
      if (state.status === 'connected') {
        try { await refreshRobloxMcpTools(); }
        catch {
          assertControlActive(requestControlEpoch);
          state = currentRobloxMcpState();
          return sendJson(res, 503, {
            connected: false,
            status: state.status,
            error: 'Could not refresh Roblox Studio tools. Check the local Arena Local app for connection details.',
            tools: [],
          });
        }
        assertControlActive(requestControlEpoch);
        state = currentRobloxMcpState();
      }
      const tools = state.status === 'connected' ? currentRobloxTools().map(publicRobloxTool) : [];
      return sendJson(res, 200, {
        connected: state.status === 'connected',
        status: state.status,
        error: state.status === 'connected' ? undefined : state.status === 'disabled'
          ? 'Roblox Studio MCP is disabled locally in Arena Local.'
          : 'Roblox Studio MCP is not connected. Check the local Arena Local app for connection details.',
        tools,
      });
    }
    if (req.method === 'POST' && url.pathname === '/v1/tasks') {
      const request = validateTaskBody(await readJson(req));
      assertControlActive(requestControlEpoch);
      const task = await createTask(request, requestControlEpoch);
      return sendJson(res, 202, arenaTaskResponse(task), {
        location: `/v1/tasks/${task.taskId}`,
        'retry-after': '1',
      });
    }
    const match = /^\/v1\/tasks\/([a-f0-9-]{36})$/i.exec(url.pathname);
    if (req.method === 'GET' && match) {
      const task = tasks.get(match[1]);
      if (!task) throw new HttpError(404, 'Task not found or expired.');
      const retryHeaders = ['completed', 'denied', 'expired', 'cancelled', 'error'].includes(task.status)
        ? {}
        : { 'retry-after': '1' };
      return sendJson(res, 200, arenaTaskResponse(task), retryHeaders);
    }
    throw new HttpError(404, 'Not found.');
  }

  const server = http.createServer((req, res) => {
    handleRequest(req, res).catch((error) => {
      if (res.headersSent) return res.destroy();
      const status = Number.isInteger(error.status) ? error.status : 500;
      sendJson(res, status, { error: status >= 500 ? 'Local bridge error.' : error.message });
    });
  });

  return {
    server,
    getTasks: getDesktopTasks,
    approveTask,
    cancelPendingChanges,
    cancelPendingRobloxTasks,
    cancelPendingGitTasks,
    cancelPendingWebTasks,
    clearApprovedActions,
    setControlPaused,
    isControlPaused: () => controlPaused,
  };
}
