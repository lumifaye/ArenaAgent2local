import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createRemoteApi } from '../src/remote-api.mjs';
import { resolveWorkspaceRoot } from '../src/workspace.mjs';

const execFileAsync = promisify(execFile);

async function git(cwd, args) {
  return execFileAsync('git', args, { cwd, encoding: 'utf8', windowsHide: true });
}

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve(server.address().port);
    });
  });
}

async function makeFixture(t, initialMode = 'ask') {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'arena-local-remote-test-'));
  const workspacePath = path.join(temporary, 'workspace');
  await fs.mkdir(workspacePath);
  await fs.writeFile(path.join(workspacePath, 'README.md'), '# Local bridge test\n');
  const workspaceRoot = await resolveWorkspaceRoot(workspacePath);
  let gitWorkspaceRoot = workspaceRoot;
  let token = 'A'.repeat(43);
  let mode = initialMode;
  let fullComputerAccess = false;
  let fullComputerNoAskAuthorized = false;
  let remoteWorkspaceRoot = workspaceRoot;
  let gitIntegrationEnabled = true;
  let robloxMcpEnabled = true;
  let webToolsEnabled = true;
  let robloxMcpStatus = 'disconnected';
  let robloxMcpError = '';
  let robloxTools = [];
  const robloxCalls = [];
  const webCalls = [];
  const api = createRemoteApi({
    getWorkspaceRoot: () => remoteWorkspaceRoot,
    getGitWorkspaceRoot: () => gitWorkspaceRoot,
    getGitIntegrationEnabled: () => gitIntegrationEnabled,
    getRobloxMcpEnabled: () => robloxMcpEnabled,
    getWebToolsEnabled: () => webToolsEnabled,
    runWebSearch: async (args, { signal } = {}) => {
      webCalls.push({ action: 'web_search', args });
      if (args.query === 'block-until-aborted') {
        await new Promise((resolve) => {
          if (signal?.aborted) resolve();
          else signal?.addEventListener('abort', resolve, { once: true });
        });
        return { provider: 'test', query: args.query, resultCount: 0, results: [] };
      }
      return { provider: 'test', query: args.query, resultCount: 1, results: [{ title: 'Test result', url: 'https://example.com/', snippet: 'A safe test result.' }] };
    },
    runWebScrape: async (args) => {
      webCalls.push({ action: 'web_scrape', args });
      return { url: args.url, title: 'Test page', charCount: 20, truncated: false, text: 'Scraped test page.' };
    },
    getPairingToken: () => token,
    getPermissionMode: () => mode,
    getFullComputerAccess: () => fullComputerAccess,
    getFullComputerNoAskAuthorized: () => fullComputerNoAskAuthorized,
    getRobloxMcpState: () => ({ status: robloxMcpStatus, error: robloxMcpError, toolCount: robloxTools.length }),
    getRobloxMcpTools: () => robloxTools,
    refreshRobloxMcpTools: async () => robloxTools,
    callRobloxMcpTool: async (name, args) => {
      robloxCalls.push({ name, args });
      return { content: [{ type: 'text', text: `${name}:${JSON.stringify(args)}` }] };
    },
  });
  const port = await listen(api.server);
  const base = `http://127.0.0.1:${port}`;
  const headers = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
  t.after(async () => {
    api.cancelPendingChanges('Test complete.');
    await new Promise((resolve) => api.server.close(resolve));
    await fs.rm(temporary, { recursive: true, force: true });
  });
  return {
    api,
    base,
    headers,
    workspaceRoot,
    setMode: (value) => { mode = value; },
    setFullComputerAccess: (value) => { fullComputerAccess = value; },
    setFullComputerNoAskAuthorized: (value) => { fullComputerNoAskAuthorized = value; },
    setRemoteWorkspaceRoot: (value) => { remoteWorkspaceRoot = value; },
    setGitWorkspaceRoot: (value) => { gitWorkspaceRoot = value; },
    setGitIntegrationEnabled: (value) => {
      gitIntegrationEnabled = value;
      if (!value) api.cancelPendingGitTasks('Local Git integration was disabled in the test fixture.');
    },
    setRobloxMcpEnabled: (value) => {
      robloxMcpEnabled = value;
      if (!value) api.cancelPendingRobloxTasks('Roblox Studio MCP was disabled in the test fixture.');
    },
    setToken: (value) => { token = value; headers.authorization = `Bearer ${value}`; },
    setRobloxMcp: (tools, status = 'connected', error = '') => { robloxTools = tools; robloxMcpStatus = status; robloxMcpError = error; },
    setWebToolsEnabled: (value) => {
      webToolsEnabled = value;
      if (!value) api.cancelPendingWebTasks('Public web tools were disabled locally in the test fixture.');
    },
    robloxCalls,
    webCalls,
  };
}

async function postTask(fixture, body, headers = fixture.headers) {
  return fetch(`${fixture.base}/v1/tasks`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

async function readTask(fixture, taskId, headers = fixture.headers) {
  return fetch(`${fixture.base}/v1/tasks/${taskId}`, { headers: { authorization: headers.authorization } });
}

async function waitForTask(fixture, taskId, predicate, timeoutMs = 4_000) {
  const stopAt = Date.now() + timeoutMs;
  let current;
  while (Date.now() < stopAt) {
    const response = await readTask(fixture, taskId);
    assert.equal(response.status, 200);
    current = await response.json();
    if (predicate(current)) return current;
    await new Promise((resolve) => setTimeout(resolve, 12));
  }
  assert.fail(`Task did not reach the expected status. Last status: ${current?.status}`);
}

test('remote bridge requires its bearer key and supports scoped read requests', async (t) => {
  const fixture = await makeFixture(t);
  const unauthorized = await fetch(`${fixture.base}/v1/health`);
  assert.equal(unauthorized.status, 401);
  const badToken = await fetch(`${fixture.base}/v1/health`, { headers: { authorization: `Bearer ${'B'.repeat(43)}` } });
  assert.equal(badToken.status, 401);

  const request = { requestId: 'readme-task-01', action: 'read_file', args: { path: 'README.md' } };
  const submitted = await postTask(fixture, request);
  assert.equal(submitted.status, 202);
  const queued = await submitted.json();
  assert.equal(submitted.headers.get('location'), `/v1/tasks/${queued.taskId}`);
  assert.equal(submitted.headers.get('retry-after'), '1');
  assert.ok(queued.taskId);
  const completed = await waitForTask(fixture, queued.taskId, (task) => task.status === 'completed');
  assert.equal(completed.result.content, '# Local bridge test\n');
  assert.equal(completed.result.path, 'README.md');

  const retry = await (await postTask(fixture, request)).json();
  assert.equal(retry.taskId, queued.taskId, 'the same requestId must not execute twice');
  const conflict = await postTask(fixture, { ...request, args: { path: '.' } });
  assert.equal(conflict.status, 409);

  const health = await fetch(`${fixture.base}/v1/health`, { headers: { authorization: fixture.headers.authorization } });
  assert.equal(health.status, 200);
  const healthState = await health.json();
  assert.equal(healthState.permissionMode, 'ask');
  assert.equal(healthState.fullComputerAccess, false);
  assert.equal(healthState.controlPaused, false);
});

test('public web search and page scraping are read-only tools behind the local web integration gate', async (t) => {
  const fixture = await makeFixture(t, 'read-only');
  const healthResponse = await fetch(`${fixture.base}/v1/health`, { headers: fixture.headers });
  assert.equal((await healthResponse.json()).webToolsEnabled, true);

  const searchResponse = await postTask(fixture, {
    requestId: 'web-search-test-01',
    action: 'web_search',
    args: { query: 'Arena Local bridge', maxResults: 3 },
  });
  assert.equal(searchResponse.status, 202);
  const searchQueued = await searchResponse.json();
  assert.notEqual(searchQueued.status, 'awaiting_approval', 'read-only web searches should not require local approval');
  assert.equal(searchQueued.autoApproved, false);
  const searchResult = await waitForTask(fixture, searchQueued.taskId, (task) => task.status === 'completed');
  assert.equal(searchResult.result.provider, 'test');
  assert.equal(searchResult.result.query, 'Arena Local bridge');
  assert.equal(fixture.api.getTasks().some((task) => task.taskId === searchQueued.taskId && task.status === 'awaiting_approval'), false);
  assert.equal(fixture.webCalls.filter((call) => call.action === 'web_search').length, 1);
  assert.equal((await (await postTask(fixture, {
    requestId: 'web-search-test-01',
    action: 'web_search',
    args: { query: 'Arena Local bridge', maxResults: 3 },
  })).json()).taskId, searchQueued.taskId, 'retrying an idempotent search does not send another web request');

  const scrapeResponse = await postTask(fixture, {
    requestId: 'web-scrape-test-01',
    action: 'web_scrape',
    args: { url: 'https://example.com/article' },
  });
  assert.equal(scrapeResponse.status, 202);
  const scrapeQueued = await scrapeResponse.json();
  const scrapeResult = await waitForTask(fixture, scrapeQueued.taskId, (task) => task.status === 'completed');
  assert.equal(scrapeResult.result.title, 'Test page');
  assert.equal(fixture.webCalls.filter((call) => call.action === 'web_scrape').length, 1);

  for (const body of [
    { requestId: 'web-search-invalid-01', action: 'web_search', args: { query: 'bad\nquery' } },
    { requestId: 'web-search-invalid-02', action: 'web_search', args: { query: 'test', maxResults: 11 } },
    { requestId: 'web-scrape-invalid-01', action: 'web_scrape', args: { url: 'http://example.com/' } },
    { requestId: 'web-scrape-invalid-02', action: 'web_scrape', args: { url: 'https://127.0.0.1/' } },
    { requestId: 'web-search-invalid-03', action: 'web_search', args: { query: 'test', unexpected: true } },
  ]) assert.equal((await postTask(fixture, body)).status, 400);

  fixture.setWebToolsEnabled(false);
  const disabledHealth = await fetch(`${fixture.base}/v1/health`, { headers: fixture.headers });
  assert.equal((await disabledHealth.json()).webToolsEnabled, false);
  const blocked = await postTask(fixture, {
    requestId: 'web-search-disabled-01',
    action: 'web_search',
    args: { query: 'must not run' },
  });
  assert.equal(blocked.status, 503);
  assert.equal(fixture.webCalls.some((call) => call.args.query === 'must not run'), false);
});

test('disabling public web tools cancels an in-flight search and prevents its result from returning', async (t) => {
  const fixture = await makeFixture(t);
  const response = await postTask(fixture, {
    requestId: 'web-search-cancel-01',
    action: 'web_search',
    args: { query: 'block-until-aborted' },
  });
  const queued = await response.json();
  assert.equal(queued.status, 'running');
  const pendingPoll = await readTask(fixture, queued.taskId);
  assert.equal(pendingPoll.status, 200);
  assert.equal(pendingPoll.headers.get('retry-after'), '1');

  fixture.setWebToolsEnabled(false);
  const cancelled = await waitForTask(fixture, queued.taskId, (task) => task.status === 'cancelled');
  assert.match(cancelled.message, /disabled locally/i);
  assert.equal(cancelled.result, undefined);
});

test('public web actions enforce the active-task and combined per-minute limits', async (t) => {
  const activeFixture = await makeFixture(t);
  const activeTasks = [];
  for (let index = 0; index < 3; index += 1) {
    const response = await postTask(activeFixture, {
      requestId: `web-active-${index}-001`,
      action: 'web_search',
      args: { query: 'block-until-aborted' },
    });
    assert.equal(response.status, 202);
    activeTasks.push(await response.json());
  }
  const overConcurrencyLimit = await postTask(activeFixture, {
    requestId: 'web-active-limit-001',
    action: 'web_scrape',
    args: { url: 'https://example.com/' },
  });
  assert.equal(overConcurrencyLimit.status, 429);
  activeFixture.setWebToolsEnabled(false);
  for (const task of activeTasks) {
    const cancelled = await waitForTask(activeFixture, task.taskId, (current) => current.status === 'cancelled');
    assert.match(cancelled.message, /disabled locally/i);
  }

  const rateFixture = await makeFixture(t);
  for (let index = 0; index < 30; index += 1) {
    const response = await postTask(rateFixture, {
      requestId: `web-rate-${String(index).padStart(3, '0')}`,
      action: 'web_search',
      args: { query: `rate test query ${index}` },
    });
    assert.equal(response.status, 202);
    const task = await response.json();
    if (task.status !== 'completed') {
      await waitForTask(rateFixture, task.taskId, (current) => current.status === 'completed');
    }
  }
  const overRateLimit = await postTask(rateFixture, {
    requestId: 'web-rate-limit-001',
    action: 'web_scrape',
    args: { url: 'https://example.com/' },
  });
  assert.equal(overRateLimit.status, 429);
});

test('local control pause keeps health and the pairing link available, blocks tasks, and cancels pending approvals', async (t) => {
  const fixture = await makeFixture(t);
  const originalBase = fixture.base;
  const originalAuthorization = fixture.headers.authorization;
  const queuedResponse = await postTask(fixture, {
    requestId: 'pause-pending-001',
    action: 'write_file',
    args: { path: 'paused.txt', content: 'must not run while paused' },
  });
  assert.equal(queuedResponse.status, 202);
  const queued = await queuedResponse.json();
  assert.equal(queued.status, 'awaiting_approval');

  fixture.api.setControlPaused(true);
  assert.equal(fixture.api.isControlPaused(), true);
  const healthResponse = await fetch(`${fixture.base}/v1/health`, { headers: fixture.headers });
  assert.equal(healthResponse.status, 200);
  assert.equal((await healthResponse.json()).controlPaused, true);

  const blockedTask = await postTask(fixture, {
    requestId: 'pause-blocked-001',
    action: 'read_file',
    args: { path: 'README.md' },
  });
  assert.equal(blockedTask.status, 423);
  assert.match((await blockedTask.json()).error, /paused on this computer/i);
  const malformedPost = await fetch(`${fixture.base}/v1/tasks`, {
    method: 'POST',
    headers: fixture.headers,
    body: '{not valid json',
  });
  assert.equal(malformedPost.status, 423, 'paused requests are rejected before action-body parsing');
  const blockedUnknownRoute = await fetch(`${fixture.base}/v1/not-an-action`, { headers: fixture.headers });
  assert.equal(blockedUnknownRoute.status, 423, 'all authenticated API routes except health are gated while paused');
  assert.equal((await readTask(fixture, queued.taskId)).status, 423, 'task results must not be readable while paused');
  const blockedToolList = await fetch(`${fixture.base}/v1/roblox/tools`, { headers: fixture.headers });
  assert.equal(blockedToolList.status, 423);

  const cancelled = fixture.api.getTasks().find((task) => task.taskId === queued.taskId);
  assert.equal(cancelled.status, 'cancelled');
  assert.match(cancelled.message, /paused locally/i);
  assert.equal(await fs.access(path.join(fixture.workspaceRoot, 'paused.txt')).then(() => true, () => false), false);
  assert.equal(fixture.base, originalBase, 'pause must not stop or replace the link');
  assert.equal(fixture.headers.authorization, originalAuthorization, 'pause must not rotate the pairing key');

  fixture.api.setControlPaused(false);
  assert.equal(fixture.api.isControlPaused(), false);
  const resumedHealth = await fetch(`${fixture.base}/v1/health`, { headers: fixture.headers });
  assert.equal((await resumedHealth.json()).controlPaused, false);
  assert.equal(fixture.base, originalBase);
  assert.equal(fixture.headers.authorization, originalAuthorization);
  const resumedTask = await postTask(fixture, {
    requestId: 'pause-resume-001',
    action: 'read_file',
    args: { path: 'README.md' },
  });
  assert.equal(resumedTask.status, 202);
  const result = await waitForTask(fixture, (await resumedTask.json()).taskId, (task) => task.status === 'completed');
  assert.equal(result.result.content, '# Local bridge test\n');
});

test('pausing remote control does not interrupt an action that is already running', async (t) => {
  const fixture = await makeFixture(t);
  const submitted = await postTask(fixture, {
    requestId: 'pause-running-001',
    action: 'run_command',
    args: { command: 'node -e "setTimeout(function(){console.log(\'finished-running\')},250)"' },
  });
  const queued = await submitted.json();
  assert.equal(queued.status, 'awaiting_approval');

  const approving = fixture.api.approveTask(queued.taskId, 'approve');
  assert.equal(fixture.api.getTasks().find((task) => task.taskId === queued.taskId).status, 'running');
  fixture.api.setControlPaused(true);
  assert.equal(fixture.api.getTasks().find((task) => task.taskId === queued.taskId).status, 'running');
  await approving;

  const finishedWhilePaused = fixture.api.getTasks().find((task) => task.taskId === queued.taskId);
  assert.equal(finishedWhilePaused.status, 'completed');
  fixture.api.setControlPaused(false);
  const completed = await waitForTask(fixture, queued.taskId, (task) => task.status === 'completed');
  assert.match(completed.result.stdout, /finished-running/i);
});

test('writes are visible in the desktop queue and run only after approval', async (t) => {
  const fixture = await makeFixture(t);
  const request = {
    requestId: 'write-task-0001',
    action: 'write_file',
    args: { path: 'notes.txt', content: 'approved from desktop\n' },
  };
  const submitted = await postTask(fixture, request);
  assert.equal(submitted.status, 202);
  const queued = await submitted.json();
  assert.equal(queued.status, 'awaiting_approval');
  assert.equal(await fs.access(path.join(fixture.workspaceRoot, 'notes.txt')).then(() => true, () => false), false);

  const desktopTask = fixture.api.getTasks().find((task) => task.taskId === queued.taskId);
  assert.equal(desktopTask.preview.after, 'approved from desktop\n');
  assert.deepEqual(desktopTask.args, { path: 'notes.txt' });

  await fixture.api.approveTask(queued.taskId, 'approve');
  const completed = await waitForTask(fixture, queued.taskId, (task) => task.status === 'completed');
  assert.equal(completed.result.written, true);
  assert.equal(await fs.readFile(path.join(fixture.workspaceRoot, 'notes.txt'), 'utf8'), 'approved from desktop\n');
});

test('full-computer access reads absolute paths and still requires Ask approval for outside writes', async (t) => {
  const fixture = await makeFixture(t);
  const outsidePath = path.join(path.dirname(fixture.workspaceRoot), 'outside.txt');
  await fs.writeFile(outsidePath, 'outside before\n');

  const deniedRead = await postTask(fixture, {
    requestId: 'outside-read-off-01',
    action: 'read_file',
    args: { path: outsidePath },
  });
  const deniedReadTask = await waitForTask(fixture, (await deniedRead.json()).taskId, (task) => task.status === 'error');
  assert.match(deniedReadTask.error, /Absolute paths/i);

  fixture.setFullComputerAccess(true);
  fixture.setRemoteWorkspaceRoot(null);
  const health = await fetch(`${fixture.base}/v1/health`, { headers: { authorization: fixture.headers.authorization } });
  const healthState = await health.json();
  assert.equal(healthState.fullComputerAccess, true);
  assert.equal(healthState.workspace, 'none');
  assert.equal(healthState.gitWorkspaceSelected, true, 'Git remains separately scoped to the local repository');
  const implicitRead = await postTask(fixture, {
    requestId: 'outside-read-implicit-01',
    action: 'read_file',
    args: { path: 'README.md' },
  });
  assert.equal(implicitRead.status, 400);
  assert.match((await implicitRead.json()).error, /explicit absolute path/i);
  const implicitList = await postTask(fixture, {
    requestId: 'outside-list-implicit-01',
    action: 'list_files',
    args: {},
  });
  assert.equal(implicitList.status, 400);
  const readResponse = await postTask(fixture, {
    requestId: 'outside-read-on-01',
    action: 'read_file',
    args: { path: outsidePath },
  });
  const readTask = await waitForTask(fixture, (await readResponse.json()).taskId, (task) => task.status === 'completed');
  assert.equal(readTask.result.path, outsidePath);
  assert.equal(readTask.result.content, 'outside before\n');

  const implicitCommand = await postTask(fixture, {
    requestId: 'outside-command-implicit-01',
    action: 'run_command',
    args: { command: 'echo should-not-run' },
  });
  assert.equal(implicitCommand.status, 400);
  const explicitCommand = await postTask(fixture, {
    requestId: 'outside-command-explicit-01',
    action: 'run_command',
    args: { command: 'node -e "console.log(process.cwd())"', cwd: fixture.workspaceRoot },
  });
  assert.equal(explicitCommand.status, 202);
  const commandQueued = await explicitCommand.json();
  assert.equal(commandQueued.status, 'awaiting_approval');
  await fixture.api.approveTask(commandQueued.taskId, 'approve');
  const commandCompleted = await waitForTask(fixture, commandQueued.taskId, (task) => task.status === 'completed');
  assert.equal(commandCompleted.result.stdout.trim(), fixture.workspaceRoot);
  assert.equal(commandCompleted.result.cwd, fixture.workspaceRoot);

  const writeResponse = await postTask(fixture, {
    requestId: 'outside-write-001',
    action: 'write_file',
    args: { path: outsidePath, content: 'outside after approval\n' },
  });
  const queued = await writeResponse.json();
  assert.equal(queued.status, 'awaiting_approval');
  const desktopTask = fixture.api.getTasks().find((task) => task.taskId === queued.taskId);
  assert.equal(desktopTask.preview.outsideWorkspace, true);
  assert.equal(desktopTask.preview.path, outsidePath);
  assert.equal(await fs.readFile(outsidePath, 'utf8'), 'outside before\n');

  await fixture.api.approveTask(queued.taskId, 'approve');
  const completed = await waitForTask(fixture, queued.taskId, (task) => task.status === 'completed');
  assert.equal(completed.fullComputerAccess, true);
  assert.equal(completed.result.path, outsidePath);
  assert.equal(await fs.readFile(outsidePath, 'utf8'), 'outside after approval\n');

  fixture.setMode('no-ask');
  const blockedNoAskReadResponse = await postTask(fixture, {
    requestId: 'outside-noask-read-01',
    action: 'read_file',
    args: { path: outsidePath },
  });
  const blockedNoAskRead = await blockedNoAskReadResponse.json();
  assert.equal(blockedNoAskRead.status, 'denied');
  assert.match(blockedNoAskRead.message, /local 30-second safety unlock/i);

  const blockedAutoWrite = await postTask(fixture, {
    requestId: 'outside-noask-001',
    action: 'write_file',
    args: { path: outsidePath, content: 'must not run' },
  });
  assert.equal((await blockedAutoWrite.json()).status, 'denied');
  assert.equal(await fs.readFile(outsidePath, 'utf8'), 'outside after approval\n');

  fixture.setFullComputerNoAskAuthorized(true);
  const authorizedAutoWrite = await postTask(fixture, {
    requestId: 'outside-noask-002',
    action: 'write_file',
    args: { path: outsidePath, content: 'full computer plus no-ask\n' },
  });
  const autoQueued = await authorizedAutoWrite.json();
  assert.equal(autoQueued.autoApproved, true);
  const autoCompleted = await waitForTask(fixture, autoQueued.taskId, (task) => task.status === 'completed');
  assert.equal(autoCompleted.fullComputerAccess, true);
  assert.equal(autoCompleted.autoApproved, true);
  assert.equal(await fs.readFile(outsidePath, 'utf8'), 'full computer plus no-ask\n');
});

test('shell commands wait for desktop approval in Ask mode', async (t) => {
  const fixture = await makeFixture(t);
  const submitted = await postTask(fixture, {
    requestId: 'ask-command-0001',
    action: 'run_command',
    args: { command: 'echo held-for-approval' },
  });
  const queued = await submitted.json();
  assert.equal(queued.status, 'awaiting_approval');
  assert.equal(queued.autoApproved, false);
  const desktopTask = fixture.api.getTasks().find((task) => task.taskId === queued.taskId);
  assert.equal(desktopTask.args.command, 'echo held-for-approval');

  await fixture.api.approveTask(queued.taskId, 'approve');
  const completed = await waitForTask(fixture, queued.taskId, (task) => task.status === 'completed');
  assert.match(completed.result.stdout, /held-for-approval/i);
});

test('approval is refused if a file changes after the desktop diff was reviewed', async (t) => {
  const fixture = await makeFixture(t);
  const filePath = path.join(fixture.workspaceRoot, 'README.md');
  const submitted = await postTask(fixture, {
    requestId: 'stale-diff-task-01',
    action: 'write_file',
    args: { path: 'README.md', content: '# Agent version\n' },
  });
  const queued = await submitted.json();
  assert.equal(queued.status, 'awaiting_approval');
  await fs.writeFile(filePath, '# Changed by user while approval was pending\n');

  await fixture.api.approveTask(queued.taskId, 'approve');
  const failed = await waitForTask(fixture, queued.taskId, (task) => task.status === 'error');
  assert.match(failed.error, /changed after you reviewed it/i);
  assert.equal(await fs.readFile(filePath, 'utf8'), '# Changed by user while approval was pending\n');
});

test('a session approval does not return after connection approvals are cleared mid-action', async (t) => {
  const fixture = await makeFixture(t);
  const request = {
    requestId: 'session-race-0001',
    action: 'run_command',
    args: { command: 'node -e "setTimeout(function(){},250)"' },
  };
  const submitted = await postTask(fixture, request);
  const queued = await submitted.json();
  assert.equal(queued.status, 'awaiting_approval');

  const approving = fixture.api.approveTask(queued.taskId, 'approve_session');
  assert.equal(fixture.api.getTasks().find((task) => task.taskId === queued.taskId).status, 'running');
  fixture.api.cancelPendingChanges('Connection stopped during the action.');
  await approving;

  const next = await postTask(fixture, {
    ...request,
    requestId: 'session-race-0002',
  });
  assert.equal((await next.json()).status, 'awaiting_approval');
});

test('no-ask mode auto-runs writes and commands and marks them as dangerous', async (t) => {
  const fixture = await makeFixture(t, 'no-ask');
  const writeResponse = await postTask(fixture, {
    requestId: 'noask-write-0001', action: 'write_file', args: { path: 'automatic.txt', content: 'written without a prompt' },
  });
  const writeTask = await writeResponse.json();
  assert.notEqual(writeTask.status, 'awaiting_approval');
  assert.equal(writeTask.autoApproved, true);
  const written = await waitForTask(fixture, writeTask.taskId, (task) => task.status === 'completed');
  assert.equal(written.autoApproved, true);
  assert.equal(await fs.readFile(path.join(fixture.workspaceRoot, 'automatic.txt'), 'utf8'), 'written without a prompt');

  const commandResponse = await postTask(fixture, {
    requestId: 'noask-command-01', action: 'run_command', args: { command: 'echo no-ask-test' },
  });
  const commandTask = await commandResponse.json();
  assert.equal(commandTask.autoApproved, true);
  const commandResult = await waitForTask(fixture, commandTask.taskId, (task) => task.status === 'completed');
  assert.equal(commandResult.autoApproved, true);
  assert.match(commandResult.result.stdout, /no-ask-test/i);
  assert.equal(fixture.api.getTasks().some((task) => task.status === 'awaiting_approval'), false);
});

test('read-only mode blocks mutations; exact-session approval is scoped to the exact action', async (t) => {
  const fixture = await makeFixture(t, 'read-only');
  const blocked = await postTask(fixture, {
    requestId: 'readonly-write-01', action: 'write_file', args: { path: 'blocked.txt', content: 'no' },
  });
  const blockedTask = await blocked.json();
  assert.equal(blockedTask.status, 'denied');
  assert.equal(await fs.access(path.join(fixture.workspaceRoot, 'blocked.txt')).then(() => true, () => false), false);

  const blockedCommandResponse = await postTask(fixture, {
    requestId: 'readonly-command-01', action: 'run_command', args: { command: 'echo must-not-run' },
  });
  const blockedCommand = await blockedCommandResponse.json();
  assert.equal(blockedCommand.status, 'denied');
  assert.equal(blockedCommand.autoApproved, false);

  fixture.setMode('ask');
  const firstResponse = await postTask(fixture, {
    requestId: 'approved-write-01', action: 'write_file', args: { path: 'allowed.txt', content: 'exact action' },
  });
  const first = await firstResponse.json();
  assert.equal(first.status, 'awaiting_approval');
  await fixture.api.approveTask(first.taskId, 'approve_session');
  await waitForTask(fixture, first.taskId, (task) => task.status === 'completed');

  const secondResponse = await postTask(fixture, {
    requestId: 'approved-write-02', action: 'write_file', args: { path: 'allowed.txt', content: 'exact action' },
  });
  const second = await secondResponse.json();
  await waitForTask(fixture, second.taskId, (task) => task.status === 'completed');
  assert.equal(fixture.api.getTasks().some((task) => task.taskId === second.taskId && task.status === 'awaiting_approval'), false);

  await fs.writeFile(path.join(fixture.workspaceRoot, 'allowed.txt'), 'manual edit after approval');
  const staleSameAction = await postTask(fixture, {
    requestId: 'approved-write-03', action: 'write_file', args: { path: 'allowed.txt', content: 'exact action' },
  });
  assert.equal((await staleSameAction.json()).status, 'awaiting_approval', 'a changed file must be reviewed again');

  const different = await postTask(fixture, {
    requestId: 'new-content-task-01', action: 'write_file', args: { path: 'allowed.txt', content: 'different content' },
  });
  assert.equal((await different.json()).status, 'awaiting_approval');
});

test('remote task API cannot enable full-computer or No-Ask modes', async (t) => {
  const fixture = await makeFixture(t);
  const modeSwitch = await postTask(fixture, {
    requestId: 'remote-mode-001',
    action: 'set_permission_mode',
    args: { mode: 'no-ask' },
  });
  assert.equal(modeSwitch.status, 400);

  const injectedScope = await postTask(fixture, {
    requestId: 'remote-mode-002',
    action: 'list_files',
    args: { path: '.', fullComputerAccess: true, fullComputerNoAskAuthorized: true },
  });
  assert.equal(injectedScope.status, 400);

  const injectedMode = await postTask(fixture, {
    requestId: 'remote-mode-003',
    action: 'read_file',
    args: { path: 'README.md' },
    permissionMode: 'no-ask',
    fullComputerAccess: true,
    fullComputerNoAskAuthorized: true,
  });
  assert.equal(injectedMode.status, 400);

  const health = await fetch(`${fixture.base}/v1/health`, { headers: { authorization: fixture.headers.authorization } });
  const healthState = await health.json();
  assert.equal(healthState.fullComputerAccess, false);
  assert.equal(healthState.permissionMode, 'ask');
});

test('invalid actions, traversal, and changed pairing tokens are rejected', async (t) => {
  const fixture = await makeFixture(t);
  const invalid = await postTask(fixture, { requestId: 'invalid-task-01', action: 'shell', args: { command: 'id' } });
  assert.equal(invalid.status, 400);
  const traversalResponse = await postTask(fixture, { requestId: 'traversal-task-01', action: 'read_file', args: { path: '../outside.txt' } });
  assert.equal(traversalResponse.status, 202);
  const traversalTask = await traversalResponse.json();
  const failed = await waitForTask(fixture, traversalTask.taskId, (task) => task.status === 'error');
  assert.match(failed.error, /Parent-directory|outside/i);

  fixture.setToken('C'.repeat(43));
  const oldToken = await fetch(`${fixture.base}/v1/health`, { headers: { authorization: 'Bearer ' + 'A'.repeat(43) } });
  assert.equal(oldToken.status, 401);
  const newToken = await fetch(`${fixture.base}/v1/health`, { headers: { authorization: 'Bearer ' + 'C'.repeat(43) } });
  assert.equal(newToken.status, 200);
});

test('Git and process actions stay workspace-scoped and follow the existing permission modes', async (t) => {
  const fixture = await makeFixture(t);
  await git(fixture.workspaceRoot, ['init', '--quiet']);
  await git(fixture.workspaceRoot, ['config', 'user.name', 'Arena Local Test']);
  await git(fixture.workspaceRoot, ['config', 'user.email', 'arena-local-test@example.invalid']);
  await git(fixture.workspaceRoot, ['add', 'README.md']);
  await git(fixture.workspaceRoot, ['commit', '--quiet', '-m', 'initial commit']);

  const invalidDiffArgs = await postTask(fixture, {
    requestId: 'git-diff-args-bad', action: 'git_diff', args: { staged: false },
  });
  assert.equal(invalidDiffArgs.status, 400);
  const invalidLogLimit = await postTask(fixture, {
    requestId: 'git-limit-invalid', action: 'git_log', args: { limit: 51 },
  });
  assert.equal(invalidLogLimit.status, 400);
  const invalidCommitMessage = await postTask(fixture, {
    requestId: 'git-message-invalid', action: 'git_commit', args: { message: 'two\nlines' },
  });
  assert.equal(invalidCommitMessage.status, 400);

  await fs.writeFile(path.join(fixture.workspaceRoot, 'README.md'), '# Local bridge test\nvisible staged edit\n');
  await git(fixture.workspaceRoot, ['add', 'README.md']);
  const statusRequest = await postTask(fixture, {
    requestId: 'git-status-read-01', action: 'git_status', args: {},
  });
  const statusQueued = await statusRequest.json();
  const statusCompleted = await waitForTask(fixture, statusQueued.taskId, (task) => task.status === 'completed');
  assert.ok(statusCompleted.result.changes.some((change) => change.path === 'README.md'));

  const diffRequest = await postTask(fixture, {
    requestId: 'git-diff-read-01', action: 'git_diff', args: {},
  });
  const diffQueued = await diffRequest.json();
  const diffCompleted = await waitForTask(fixture, diffQueued.taskId, (task) => task.status === 'completed');
  assert.match(diffCompleted.result.diff, /visible staged edit/);

  fixture.setMode('read-only');
  const processRequest = await postTask(fixture, {
    requestId: 'process-list-read', action: 'list_processes', args: {},
  });
  const processQueued = await processRequest.json();
  const processCompleted = await waitForTask(fixture, processQueued.taskId, (task) => task.status === 'completed');
  assert.ok(processCompleted.result.processes.length > 0);
  assert.ok(processCompleted.result.processes.every((entry) => Object.keys(entry).sort().join(',') === 'name,pid'));

  const blockedCommit = await postTask(fixture, {
    requestId: 'git-commit-read-1', action: 'git_commit', args: { message: 'blocked commit' },
  });
  assert.equal((await blockedCommit.json()).status, 'denied');
  assert.equal((await git(fixture.workspaceRoot, ['log', '-1', '--format=%s'])).stdout.trim(), 'initial commit');

  fixture.setMode('ask');
  const askCommit = await postTask(fixture, {
    requestId: 'git-commit-ask-01', action: 'git_commit', args: { message: 'approved commit' },
  });
  const askQueued = await askCommit.json();
  assert.equal(askQueued.status, 'awaiting_approval');
  const approval = fixture.api.getTasks().find((task) => task.taskId === askQueued.taskId);
  assert.equal(approval.preview.message, 'approved commit');
  assert.match(approval.preview.diff, /visible staged edit/);
  await assert.rejects(fixture.api.approveTask(askQueued.taskId, 'approve_session'), /one at a time/i);
  await fixture.api.approveTask(askQueued.taskId, 'approve');
  const askCompleted = await waitForTask(fixture, askQueued.taskId, (task) => task.status === 'completed');
  assert.equal(askCompleted.result.message, 'approved commit');
  assert.equal(askCompleted.result.hooksDisabled, true);

  fixture.setMode('no-ask');
  await fs.writeFile(path.join(fixture.workspaceRoot, 'README.md'), '# Local bridge test\nautomatic staged edit\n');
  await git(fixture.workspaceRoot, ['add', 'README.md']);
  const automaticCommit = await postTask(fixture, {
    requestId: 'git-commit-auto-01', action: 'git_commit', args: { message: 'automatic commit' },
  });
  const automaticQueued = await automaticCommit.json();
  assert.equal(automaticQueued.autoApproved, true);
  const automaticCompleted = await waitForTask(fixture, automaticQueued.taskId, (task) => task.status === 'completed');
  assert.equal(automaticCompleted.result.message, 'automatic commit');
});

test('Git integration can be disabled independently and full-computer mode keeps Git on a separate local workspace', async (t) => {
  const fixture = await makeFixture(t);
  await git(fixture.workspaceRoot, ['init', '--quiet']);
  await git(fixture.workspaceRoot, ['config', 'user.name', 'Arena Local Test']);
  await git(fixture.workspaceRoot, ['config', 'user.email', 'arena-local-test@example.invalid']);
  await git(fixture.workspaceRoot, ['add', 'README.md']);
  await git(fixture.workspaceRoot, ['commit', '--quiet', '-m', 'initial commit']);
  await fs.writeFile(path.join(fixture.workspaceRoot, 'README.md'), '# Local bridge test\nstaged edit\n');
  await git(fixture.workspaceRoot, ['add', 'README.md']);

  const pendingCommit = await postTask(fixture, {
    requestId: 'git-disable-pending-01', action: 'git_commit', args: { message: 'pending commit' },
  });
  const pending = await pendingCommit.json();
  assert.equal(pending.status, 'awaiting_approval');

  fixture.setGitIntegrationEnabled(false);
  assert.equal(fixture.api.getTasks().find((task) => task.taskId === pending.taskId).status, 'cancelled');
  const disabled = await postTask(fixture, {
    requestId: 'git-disabled-001', action: 'git_status', args: {},
  });
  assert.equal(disabled.status, 503);

  fixture.setGitIntegrationEnabled(true);
  fixture.setGitWorkspaceRoot(null);
  const noRepository = await postTask(fixture, {
    requestId: 'git-no-workspace-01', action: 'git_log', args: {},
  });
  assert.equal(noRepository.status, 503);

  fixture.setGitWorkspaceRoot(fixture.workspaceRoot);
  fixture.setFullComputerAccess(true);
  fixture.setRemoteWorkspaceRoot(null);
  const health = await fetch(`${fixture.base}/v1/health`, { headers: fixture.headers });
  const state = await health.json();
  assert.equal(state.workspace, 'none');
  assert.equal(state.gitWorkspaceSelected, true);
  assert.equal(state.gitIntegrationEnabled, true);

  const separateGitRequest = await postTask(fixture, {
    requestId: 'git-separate-local-01', action: 'git_status', args: {},
  });
  assert.equal(separateGitRequest.status, 202);
  const gitTask = await waitForTask(fixture, (await separateGitRequest.json()).taskId, (task) => task.status === 'completed');
  assert.ok(gitTask.result.branch);
});

test('disabled Roblox Studio MCP cancels approvals and blocks local/remote tool calls', async (t) => {
  const fixture = await makeFixture(t);
  fixture.setRobloxMcp([{
    name: 'execute_luau',
    description: 'Run Luau.',
    inputSchema: {
      type: 'object',
      properties: {
        studio_id: { type: 'string' },
        datamodel_type: { type: 'string', enum: ['Edit', 'Client', 'Server'] },
        code: { type: 'string' },
      },
      required: ['studio_id', 'datamodel_type', 'code'],
    },
  }]);
  const pendingRequest = await postTask(fixture, {
    requestId: 'studio-disable-pending-01',
    action: 'roblox_tool',
    args: { name: 'execute_luau', arguments: { studio_id: 'studio-1', datamodel_type: 'Edit', code: 'return game.Name' } },
  });
  const pending = await pendingRequest.json();
  assert.equal(pending.status, 'awaiting_approval');

  fixture.setRobloxMcpEnabled(false);
  assert.equal(fixture.api.getTasks().find((task) => task.taskId === pending.taskId).status, 'cancelled');
  const tools = await fetch(`${fixture.base}/v1/roblox/tools`, { headers: fixture.headers });
  assert.equal(tools.status, 200);
  const toolState = await tools.json();
  assert.equal(toolState.connected, false);
  assert.equal(toolState.status, 'disabled');
  assert.match(toolState.error, /disabled locally/i);
  assert.deepEqual(toolState.tools, []);

  const request = await postTask(fixture, {
    requestId: 'studio-disabled-001',
    action: 'roblox_tool',
    args: { name: 'execute_luau', arguments: { studio_id: 'studio-1', datamodel_type: 'Edit', code: 'return game.Name' } },
  });
  assert.equal(request.status, 503);
  assert.equal((await request.json()).error, 'Local bridge error.');
  assert.equal(fixture.robloxCalls.length, 0);
});

test('Studio targeting and execute_luau requirements hold even when a tool schema omits them', async (t) => {
  const fixture = await makeFixture(t);
  fixture.setRobloxMcp([
    {
      name: 'execute_luau',
      description: 'Run Luau.',
      inputSchema: {
        type: 'object',
        properties: { studio_id: { type: 'string' }, code: { type: 'string' } },
        required: ['studio_id', 'code'],
      },
    },
    {
      name: 'list_roblox_studios',
      description: 'Discover or target Studio instances.',
      inputSchema: { type: 'object', properties: { studio_id: { type: 'string' } }, required: ['studio_id'] },
    },
  ]);

  const missingDatamodelType = await postTask(fixture, {
    requestId: 'studio-schema-01',
    action: 'roblox_tool',
    args: { name: 'execute_luau', arguments: { studio_id: 'studio-1', code: 'print(1)' } },
  });
  assert.equal(missingDatamodelType.status, 400);
  assert.match((await missingDatamodelType.json()).error, /datamodel_type/i);

  const invalidDatamodelType = await postTask(fixture, {
    requestId: 'studio-schema-02',
    action: 'roblox_tool',
    args: { name: 'execute_luau', arguments: { studio_id: 'studio-1', code: 'print(1)', datamodel_type: 'Unknown' } },
  });
  assert.equal(invalidDatamodelType.status, 400);
  assert.match((await invalidDatamodelType.json()).error, /datamodel_type/i);

  const schemaRequiredStudioId = await postTask(fixture, {
    requestId: 'studio-schema-03',
    action: 'roblox_tool',
    args: { name: 'list_roblox_studios', arguments: {} },
  });
  assert.equal(schemaRequiredStudioId.status, 400);
  const emptyDiscoveryStudioId = await postTask(fixture, {
    requestId: 'studio-schema-04',
    action: 'roblox_tool',
    args: { name: 'list_roblox_studios', arguments: { studio_id: '  ' } },
  });
  assert.equal(emptyDiscoveryStudioId.status, 400);

  const targetedDiscovery = await postTask(fixture, {
    requestId: 'studio-schema-05',
    action: 'roblox_tool',
    args: { name: 'list_roblox_studios', arguments: { studio_id: 'studio-1' } },
  });
  assert.equal(targetedDiscovery.status, 202);
  const queued = await targetedDiscovery.json();
  await waitForTask(fixture, queued.taskId, (task) => task.status === 'completed');
});

test('Roblox Studio tools are discovered behind bearer auth and routed through the task API', async (t) => {
  const fixture = await makeFixture(t);
  const unauthorized = await fetch(`${fixture.base}/v1/roblox/tools`);
  assert.equal(unauthorized.status, 401);

  const disconnected = await fetch(`${fixture.base}/v1/roblox/tools`, { headers: fixture.headers });
  assert.equal(disconnected.status, 200);
  assert.equal((await disconnected.json()).connected, false);
  const disconnectedCall = await postTask(fixture, {
    requestId: 'studio-offline-01',
    action: 'roblox_tool',
    args: { name: 'script_read', arguments: { studio_id: 'studio-1', script_path: 'game.ServerScriptService.Main' } },
  });
  assert.equal(disconnectedCall.status, 503);

  fixture.setRobloxMcp([], 'error', 'Roblox Studio MCP was not found at /Users/private/Roblox/mcp.bat.');
  const failedConnection = await fetch(`${fixture.base}/v1/roblox/tools`, { headers: fixture.headers });
  assert.equal(failedConnection.status, 200);
  const failedConnectionState = await failedConnection.json();
  assert.match(failedConnectionState.error, /check the local Arena Local app/i);
  assert.doesNotMatch(JSON.stringify(failedConnectionState), /\/Users\/private/);

  fixture.setRobloxMcp([
    {
      name: 'script_read',
      description: 'Read a script.',
      inputSchema: {
        type: 'object',
        properties: { studio_id: { type: 'string' }, script_path: { type: 'string' } },
        required: ['studio_id', 'script_path'],
      },
      annotations: { readOnlyHint: true },
    },
    {
      name: 'execute_luau',
      description: 'Run Luau in Studio.',
      inputSchema: {
        type: 'object',
        properties: { studio_id: { type: 'string' }, code: { type: 'string' }, datamodel_type: { type: 'string', enum: ['Edit', 'Client', 'Server'] } },
        required: ['studio_id', 'code', 'datamodel_type'],
      },
      annotations: { readOnlyHint: true },
    },
    {
      name: 'list_roblox_studios',
      description: 'List connected Studio instances.',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'new_unknown_tool',
      description: 'Unknown future tool.',
      inputSchema: { type: 'object', properties: { studio_id: { type: 'string' } }, required: ['studio_id'] },
      annotations: { readOnlyHint: true },
    },
  ]);
  const authorized = await fetch(`${fixture.base}/v1/roblox/tools`, { headers: fixture.headers });
  assert.equal(authorized.status, 200);
  const toolList = await authorized.json();
  assert.equal(toolList.connected, true);
  const health = await fetch(`${fixture.base}/v1/health`, { headers: fixture.headers });
  const healthState = await health.json();
  assert.deepEqual(healthState.robloxMcp, { connected: true, status: 'connected', toolCount: 4 });
  assert.equal(toolList.tools.find((tool) => tool.name === 'script_read').permission, 'read-only');
  assert.equal(toolList.tools.find((tool) => tool.name === 'execute_luau').permission, 'approval', 'MCP annotations do not override Arena Local permission policy');
  assert.equal(toolList.tools.find((tool) => tool.name === 'list_roblox_studios').permission, 'read-only');

  const missingStudioId = await postTask(fixture, {
    requestId: 'studio-no-id-0001',
    action: 'roblox_tool',
    args: { name: 'script_read', arguments: { script_path: 'game.ServerScriptService.Main' } },
  });
  assert.equal(missingStudioId.status, 400);
  assert.match((await missingStudioId.json()).error, /studio_id/i);
  const missingSchemaArgument = await postTask(fixture, {
    requestId: 'studio-no-datamodel',
    action: 'roblox_tool',
    args: { name: 'execute_luau', arguments: { studio_id: 'studio-1', code: 'print(1)' } },
  });
  assert.equal(missingSchemaArgument.status, 400);
  assert.match((await missingSchemaArgument.json()).error, /datamodel_type/i);
  const invalidSchemaType = await postTask(fixture, {
    requestId: 'studio-bad-type-01',
    action: 'roblox_tool',
    args: { name: 'execute_luau', arguments: { studio_id: 4, code: 'print(1)', datamodel_type: 'Edit' } },
  });
  assert.equal(invalidSchemaType.status, 400);
  const emptyStudioId = await postTask(fixture, {
    requestId: 'studio-empty-id-01',
    action: 'roblox_tool',
    args: { name: 'execute_luau', arguments: { studio_id: '   ', code: 'print(1)', datamodel_type: 'Edit' } },
  });
  assert.equal(emptyStudioId.status, 400);
  const malformedToolArguments = await postTask(fixture, {
    requestId: 'studio-bad-args-01',
    action: 'roblox_tool',
    args: { name: 'script_read', arguments: [] },
  });
  assert.equal(malformedToolArguments.status, 400);
  const oversizedToolArguments = await postTask(fixture, {
    requestId: 'studio-large-args1',
    action: 'roblox_tool',
    args: { name: 'execute_luau', arguments: { studio_id: 'studio-1', code: 'x'.repeat(256 * 1024) } },
  });
  assert.equal(oversizedToolArguments.status, 413);

  const discovery = await postTask(fixture, {
    requestId: 'studio-discover-01',
    action: 'roblox_tool',
    args: { name: 'list_roblox_studios', arguments: {} },
  });
  assert.equal(discovery.status, 202, 'the discovery tool can be called before an instance ID is known');
  const discoveryTask = await discovery.json();
  await waitForTask(fixture, discoveryTask.taskId, (task) => task.status === 'completed');

  const readRequest = {
    requestId: 'studio-read-0001',
    action: 'roblox_tool',
    args: { name: 'script_read', arguments: { studio_id: 'studio-1', script_path: 'game.ServerScriptService.Main' } },
  };
  const readSubmitted = await postTask(fixture, readRequest);
  assert.equal(readSubmitted.status, 202);
  const readQueued = await readSubmitted.json();
  const readCompleted = await waitForTask(fixture, readQueued.taskId, (task) => task.status === 'completed');
  assert.equal(readCompleted.result.content[0].text, `script_read:${JSON.stringify(readRequest.args.arguments)}`);
  assert.equal(fixture.robloxCalls.length, 2);

  const luauRequest = {
    requestId: 'studio-luau-0001',
    action: 'roblox_tool',
    args: { name: 'execute_luau', arguments: { studio_id: 'studio-1', code: 'print("approved")', datamodel_type: 'Edit' } },
  };
  const luauSubmitted = await postTask(fixture, luauRequest);
  assert.equal(luauSubmitted.status, 202);
  const luauQueued = await luauSubmitted.json();
  assert.equal(luauQueued.status, 'awaiting_approval');
  const approval = fixture.api.getTasks().find((task) => task.taskId === luauQueued.taskId);
  assert.equal(approval.robloxPermission, 'approval');
  assert.equal(approval.robloxToolDescription, 'Run Luau in Studio.');
  assert.deepEqual(approval.args, luauRequest.args);
  await fixture.api.approveTask(luauQueued.taskId, 'approve');
  const luauCompleted = await waitForTask(fixture, luauQueued.taskId, (task) => task.status === 'completed');
  assert.equal(luauCompleted.result.content[0].text, `execute_luau:${JSON.stringify(luauRequest.args.arguments)}`);
  assert.equal(fixture.robloxCalls.length, 3);

  const unknownTool = await postTask(fixture, {
    requestId: 'studio-unknown-001',
    action: 'roblox_tool',
    args: { name: 'new_unknown_tool', arguments: { studio_id: 'studio-1' } },
  });
  assert.equal((await unknownTool.json()).status, 'awaiting_approval', 'unknown tools require approval even if they self-label read-only');
});

test('Read only blocks mutating Studio tools while No-Ask remains an explicit opt-in', async (t) => {
  const fixture = await makeFixture(t);
  fixture.setRobloxMcp([
    {
      name: 'script_read',
      description: 'Read script.',
      inputSchema: { type: 'object', properties: { studio_id: { type: 'string' } }, required: ['studio_id'] },
    },
    {
      name: 'execute_luau',
      description: 'Run Luau.',
      inputSchema: {
        type: 'object',
        properties: { studio_id: { type: 'string' }, code: { type: 'string' }, datamodel_type: { type: 'string' } },
        required: ['studio_id', 'code', 'datamodel_type'],
      },
    },
  ]);

  fixture.setMode('read-only');
  const blocked = await postTask(fixture, {
    requestId: 'studio-readonly-01',
    action: 'roblox_tool',
    args: { name: 'execute_luau', arguments: { studio_id: 'studio-1', code: 'game.Workspace.Name = "changed"', datamodel_type: 'Edit' } },
  });
  assert.equal((await blocked.json()).status, 'denied');
  assert.equal(fixture.robloxCalls.length, 0);

  const allowedRead = await postTask(fixture, {
    requestId: 'studio-readonly-02',
    action: 'roblox_tool',
    args: { name: 'script_read', arguments: { studio_id: 'studio-1', script_path: 'game.ServerScriptService.Main' } },
  });
  const readQueued = await allowedRead.json();
  await waitForTask(fixture, readQueued.taskId, (task) => task.status === 'completed');
  assert.equal(fixture.robloxCalls.length, 1);

  fixture.setMode('no-ask');
  const auto = await postTask(fixture, {
    requestId: 'studio-noask-01',
    action: 'roblox_tool',
    args: { name: 'execute_luau', arguments: { studio_id: 'studio-1', code: 'print("automatic")', datamodel_type: 'Edit' } },
  });
  const autoQueued = await auto.json();
  assert.equal(autoQueued.autoApproved, true);
  const completed = await waitForTask(fixture, autoQueued.taskId, (task) => task.status === 'completed');
  assert.equal(completed.autoApproved, true);
  assert.equal(fixture.robloxCalls.length, 2);
});

test('Roblox Studio disconnection cancels pending approvals and clears exact-session approvals', async (t) => {
  const fixture = await makeFixture(t);
  const tools = [{
    name: 'execute_luau',
    description: 'Run Luau in Studio.',
    inputSchema: {
      type: 'object',
      properties: { studio_id: { type: 'string' }, code: { type: 'string' }, datamodel_type: { type: 'string' } },
      required: ['studio_id', 'code', 'datamodel_type'],
    },
  }];
  fixture.setRobloxMcp(tools);

  const arguments_ = { studio_id: 'studio-1', code: 'print("exact")', datamodel_type: 'Edit' };
  const pendingResponse = await postTask(fixture, {
    requestId: 'studio-disconnect-01',
    action: 'roblox_tool',
    args: { name: 'execute_luau', arguments: arguments_ },
  });
  const pending = await pendingResponse.json();
  assert.equal(pending.status, 'awaiting_approval');
  fixture.api.cancelPendingRobloxTasks('Studio disconnected.');
  assert.equal(fixture.api.getTasks().find((task) => task.taskId === pending.taskId).status, 'cancelled');
  assert.equal(fixture.robloxCalls.length, 0);
  await assert.rejects(fixture.api.approveTask(pending.taskId, 'approve'), /no longer waiting/i);

  const approvedResponse = await postTask(fixture, {
    requestId: 'studio-session-01',
    action: 'roblox_tool',
    args: { name: 'execute_luau', arguments: arguments_ },
  });
  const approved = await approvedResponse.json();
  await fixture.api.approveTask(approved.taskId, 'approve_session');
  assert.equal(fixture.api.getTasks().find((task) => task.taskId === approved.taskId).status, 'completed');

  const reusedResponse = await postTask(fixture, {
    requestId: 'studio-session-02',
    action: 'roblox_tool',
    args: { name: 'execute_luau', arguments: arguments_ },
  });
  const reused = await reusedResponse.json();
  assert.notEqual(reused.status, 'awaiting_approval', 'an exact session approval applies only while the Studio connection is active');
  await waitForTask(fixture, reused.taskId, (task) => task.status === 'completed');
  assert.equal(fixture.robloxCalls.length, 2);

  fixture.api.cancelPendingRobloxTasks('Studio disconnected.');
  fixture.setRobloxMcp(tools, 'disconnected');
  fixture.setRobloxMcp(tools, 'connected');
  const afterReconnect = await postTask(fixture, {
    requestId: 'studio-session-03',
    action: 'roblox_tool',
    args: { name: 'execute_luau', arguments: arguments_ },
  });
  assert.equal((await afterReconnect.json()).status, 'awaiting_approval', 'reconnecting does not restore a previous exact-session approval');
});
