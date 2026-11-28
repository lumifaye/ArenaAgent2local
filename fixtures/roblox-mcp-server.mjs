let input = '';

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function handle(message) {
  if (!message || typeof message !== 'object' || message.id === undefined) return;
  if (message.method === 'initialize') {
    send({
      jsonrpc: '2.0',
      id: message.id,
      result: {
        protocolVersion: message.params?.protocolVersion || '2025-11-25',
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'Roblox Studio MCP test fixture', version: '1.0.0' },
      },
    });
    return;
  }
  if (message.method === 'tools/list') {
    const pageCount = Number.parseInt(process.env.ROBLOX_MCP_TOOL_PAGES || '1', 10);
    const pageIndex = message.params?.cursor === undefined ? 0 : Number(message.params.cursor);
    const tools = pageIndex === 0 ? [
      {
        name: 'script_read',
        description: 'Read a script in an open Studio place.',
        inputSchema: {
          type: 'object',
          properties: { studio_id: { type: 'string' }, script_path: { type: 'string' } },
          required: ['studio_id', 'script_path'],
        },
        annotations: { readOnlyHint: true },
      },
      {
        name: 'execute_luau',
        description: 'Run Luau in an open Studio place.',
        inputSchema: {
          type: 'object',
          properties: {
            studio_id: { type: 'string' },
            code: { type: 'string' },
            datamodel_type: { type: 'string', enum: ['Edit', 'Client', 'Server'] },
          },
          required: ['studio_id', 'code', 'datamodel_type'],
        },
        annotations: { readOnlyHint: true },
      },
    ] : [];
    if (process.env.ROBLOX_MCP_TOOL_PAGES) {
      tools.push({
        name: `fixture_paged_tool_${pageIndex}`,
        description: `Fixture tool on page ${pageIndex}.`,
        inputSchema: { type: 'object', properties: {} },
      });
    }
    const result = { tools };
    if (Number.isInteger(pageIndex) && pageIndex + 1 < pageCount) result.nextCursor = String(pageIndex + 1);
    send({ jsonrpc: '2.0', id: message.id, result });
    return;
  }
  if (message.method === 'tools/call') {
    if (process.env.ROBLOX_MCP_EXIT_ON_TOOL_CALL === '1') process.exit(0);
    const resultText = message.params?.name === 'execute_luau'
      ? `Executed: ${message.params?.arguments?.code || ''}`
      : `Read: ${message.params?.arguments?.script_path || ''}`;
    send({
      jsonrpc: '2.0',
      id: message.id,
      result: { content: [{ type: 'text', text: resultText }] },
    });
    return;
  }
  if (message.method === 'ping') {
    send({ jsonrpc: '2.0', id: message.id, result: {} });
    return;
  }
  send({ jsonrpc: '2.0', id: message.id, error: { code: -32601, message: 'Method not found' } });
}

process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  input += chunk;
  while (true) {
    const newline = input.indexOf('\n');
    if (newline < 0) break;
    const line = input.slice(0, newline).trim();
    input = input.slice(newline + 1);
    if (!line) continue;
    try { handle(JSON.parse(line)); }
    catch (error) { process.stderr.write(`${error.message}\n`); }
  }
});
