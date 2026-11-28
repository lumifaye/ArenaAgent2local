import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getRobloxMcpLaunchConfig,
  isRobloxReadOnlyTool,
  RobloxMcpClient,
} from '../src/roblox-mcp-client.mjs';

const FIXTURE = fileURLToPath(new URL('../fixtures/roblox-mcp-server.mjs', import.meta.url));

test('Roblox Studio launch config matches the documented Windows and macOS stdio commands', () => {
  const windows = getRobloxMcpLaunchConfig({
    platform: 'win32',
    env: { LOCALAPPDATA: 'C:\\Users\\Roblox User\\AppData\\Local' },
    homeDir: 'C:\\Users\\Roblox User',
  });
  assert.equal(windows.filePath, path.win32.join('C:\\Users\\Roblox User\\AppData\\Local', 'Roblox', 'mcp.bat'));
  assert.equal(windows.command, 'cmd.exe');
  assert.deepEqual(windows.args, ['/c', windows.filePath]);

  const mac = getRobloxMcpLaunchConfig({ platform: 'darwin', env: {}, homeDir: '/Users/roblox' });
  assert.equal(mac.command, '/Applications/RobloxStudio.app/Contents/MacOS/StudioMCP');
  assert.deepEqual(mac.args, []);
  assert.equal(getRobloxMcpLaunchConfig({ platform: 'linux', env: {} }), null);
});

test('only known safe Roblox Studio tools are classified read-only', () => {
  assert.equal(isRobloxReadOnlyTool('script_read'), true);
  assert.equal(isRobloxReadOnlyTool('list_roblox_studios'), true);
  assert.equal(isRobloxReadOnlyTool('screen_capture'), true);
  assert.equal(isRobloxReadOnlyTool('execute_luau'), false);
  assert.equal(isRobloxReadOnlyTool('multi_edit'), false);
  assert.equal(isRobloxReadOnlyTool('unrecognized_tool'), false);
});

test('Roblox MCP client connects over stdio, discovers tools, calls them, and disconnects cleanly', async (t) => {
  const client = new RobloxMcpClient({
    clientInfo: { name: 'arena-local-test', version: '1.0.0' },
    launchConfig: { command: process.execPath, args: [FIXTURE] },
  });
  t.after(async () => client.disconnect());

  const state = await client.connect();
  assert.equal(state.status, 'connected');
  assert.equal(state.toolCount, 2);
  assert.equal(state.tools.find((tool) => tool.name === 'script_read').permission, 'read-only');
  assert.equal(state.tools.find((tool) => tool.name === 'execute_luau').permission, 'approval');

  const tools = await client.getTools();
  assert.ok(tools[0].inputSchema.properties.studio_id);
  assert.ok(tools[1].inputSchema.required.includes('datamodel_type'));
  assert.equal(tools[1].annotations.readOnlyHint, true);

  const result = await client.callTool('execute_luau', {
    studio_id: 'studio-test-1',
    code: 'print("hello")',
    datamodel_type: 'Edit',
  });
  assert.equal(result.content[0].text, 'Executed: print("hello")');

  await assert.rejects(client.callTool('not-a-tool', {}), /not available/i);
  await client.disconnect();
  assert.equal(client.getState().status, 'disconnected');
  assert.equal(client.getState().toolCount, 0);
});

test('Roblox MCP client discovers all tools across more than 16 paginated pages', async (t) => {
  const client = new RobloxMcpClient({
    clientInfo: { name: 'arena-local-pagination-test', version: '1.0.0' },
    launchConfig: {
      command: process.execPath,
      args: [FIXTURE],
      env: { ROBLOX_MCP_TOOL_PAGES: '20' },
    },
  });
  t.after(async () => client.disconnect());

  const state = await client.connect();
  assert.equal(state.status, 'connected');
  assert.equal(state.toolCount, 22);
  const tools = client.getTools();
  const names = new Set(tools.map((tool) => tool.name));
  assert.ok(names.has('script_read'));
  assert.ok(names.has('execute_luau'));
  assert.ok(names.has('fixture_paged_tool_0'));
  assert.ok(names.has('fixture_paged_tool_19'));
  assert.equal([...names].filter((name) => name.startsWith('fixture_paged_tool_')).length, 20);
});

test('an unexpected Studio process exit clears tools and publishes a disconnected error', async (t) => {
  const client = new RobloxMcpClient({
    clientInfo: { name: 'arena-local-disconnect-test', version: '1.0.0' },
    launchConfig: {
      command: process.execPath,
      args: [FIXTURE],
      env: { ROBLOX_MCP_EXIT_ON_TOOL_CALL: '1' },
    },
  });
  t.after(async () => client.disconnect());
  await client.connect();

  let resolveDisconnected;
  const disconnected = new Promise((resolve) => { resolveDisconnected = resolve; });
  client.onState = (state) => {
    if (state.status === 'error') resolveDisconnected(state);
  };
  await assert.rejects(client.callTool('execute_luau', {
    studio_id: 'studio-test-1',
    code: 'print("disconnect")',
    datamodel_type: 'Edit',
  }));
  let disconnectTimer;
  const state = await Promise.race([
    disconnected,
    new Promise((_, reject) => { disconnectTimer = setTimeout(() => reject(new Error('Expected a disconnect state update.')), 2_000); }),
  ]);
  clearTimeout(disconnectTimer);
  assert.equal(state.status, 'error');
  assert.equal(state.toolCount, 0);
});
