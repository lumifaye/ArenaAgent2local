import test from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchPublicPageForTest,
  isPublicIpv4ForTest,
  parseDuckDuckGoResultsForTest,
  scrapeWeb,
  searchWeb,
  validatePublicHttpsUrl,
} from '../src/web-tools.mjs';

const PUBLIC_IP = '93.184.216.34';

function fakeResponse(body, headers = { 'content-type': 'text/html; charset=utf-8' }, status = 200) {
  return { status, headers, body: Buffer.from(body, 'utf8') };
}

test('public web URL validation requires credential-free standard-port HTTPS and a public domain', () => {
  assert.equal(validatePublicHttpsUrl('https://example.com/path?q=hello').href, 'https://example.com/path?q=hello');
  assert.equal(validatePublicHttpsUrl('https://example.com:443/').href, 'https://example.com/');
  for (const url of [
    'http://example.com/',
    'https://user:secret@example.com/',
    'https://example.com:8443/',
    'https://example.com/path#fragment',
    'https://localhost/',
    'https://printer.local/',
    'https://host.internal/',
    'https://127.0.0.1/',
    'https://[::1]/',
    'https://192.0.2.4/',
    'https://example.com/path with spaces',
  ]) {
    assert.throws(() => validatePublicHttpsUrl(url), undefined, url);
  }
});

test('public IPv4 classifier excludes private, loopback, link-local, documentation, and reserved ranges', () => {
  for (const address of ['8.8.8.8', '93.184.216.34', '1.1.1.1']) assert.equal(isPublicIpv4ForTest(address), true, address);
  for (const address of [
    '0.1.2.3', '10.0.0.2', '100.64.0.1', '127.0.0.1', '169.254.169.254', '172.16.0.1',
    '192.0.0.1', '192.0.2.1', '192.88.99.1', '192.168.1.1', '198.18.0.1', '198.51.100.1',
    '203.0.113.1', '224.0.0.1', '240.0.0.1', '::1', 'not-an-ip',
  ]) assert.equal(isPublicIpv4ForTest(address), false, address);
});

test('public page fetch pins each request to a validated IPv4 and follows only bounded HTTPS redirects', async () => {
  const resolved = [];
  const requests = [];
  const result = await fetchPublicPageForTest('https://example.com/start', {
    resolver: async (hostname, options) => {
      resolved.push({ hostname, options });
      return [{ address: PUBLIC_IP, family: 4 }];
    },
    requester: async (url, options) => {
      requests.push({ url: url.href, ...options });
      if (url.pathname === '/start') return { status: 302, headers: { location: '/article' }, body: Buffer.alloc(0) };
      return fakeResponse('<h1>Article</h1><p>Text</p>');
    },
  });
  assert.equal(result.url, 'https://example.com/article');
  assert.equal(result.mimeType, 'text/html');
  assert.equal(result.body.toString('utf8'), '<h1>Article</h1><p>Text</p>');
  assert.equal(resolved.length, 2);
  assert.equal(resolved[0].options.all, true);
  assert.equal(requests.length, 2);
  assert.ok(requests.every((request) => request.address === PUBLIC_IP));
  assert.ok(requests.every((request) => request.signal instanceof AbortSignal));
});

test('DNS results and redirects cannot route web tools to private or non-HTTPS hosts', async () => {
  let requestCount = 0;
  const privateResolver = async () => [{ address: '127.0.0.1', family: 4 }];
  await assert.rejects(fetchPublicPageForTest('https://example.com/', {
    resolver: privateResolver,
    requester: async () => { requestCount += 1; return fakeResponse(''); },
  }), /non-public/i);
  assert.equal(requestCount, 0);

  const mixedResolver = async () => [
    { address: PUBLIC_IP, family: 4 },
    { address: '10.0.0.2', family: 4 },
  ];
  await assert.rejects(fetchPublicPageForTest('https://example.com/', { resolver: mixedResolver, requester: async () => fakeResponse('') }), /non-public/i);

  requestCount = 0;
  await assert.rejects(fetchPublicPageForTest('https://example.com/', {
    resolver: async () => [{ address: PUBLIC_IP, family: 4 }],
    requester: async () => {
      requestCount += 1;
      return { status: 302, headers: { location: 'http://example.com/insecure' }, body: Buffer.alloc(0) };
    },
  }), /HTTPS/i);
  assert.equal(requestCount, 1);

  requestCount = 0;
  await assert.rejects(fetchPublicPageForTest('https://example.com/', {
    resolver: async (hostname) => [{ address: hostname === 'example.com' ? PUBLIC_IP : '10.0.0.2', family: 4 }],
    requester: async () => {
      requestCount += 1;
      return { status: 302, headers: { location: 'https://private.example.net/' }, body: Buffer.alloc(0) };
    },
  }), /non-public/i);
  assert.equal(requestCount, 1);
});

test('DuckDuckGo result parser extracts bounded HTTPS titles and snippets, decoding entities', () => {
  const html = [
    '<a class="result__a" href="https://example.org/page">Example &amp; One</a>',
    '<a class="result__snippet">A &lt;useful&gt; summary.</a>',
    '<a class="result__a" href="http://insecure.example/page">Skip insecure</a>',
    '<a class="result__a" href="https://example.net/two">Second result</a>',
    '<a class="result__snippet">Second summary.</a>',
  ].join('\n');
  const results = parseDuckDuckGoResultsForTest(html, 5);
  assert.deepEqual(results, [
    { title: 'Example & One', url: 'https://example.org/page', snippet: 'A <useful> summary.' },
    { title: 'Second result', url: 'https://example.net/two', snippet: 'Second summary.' },
  ]);
});

test('web search uses DuckDuckGo HTML and returns only extracted, bounded results', async () => {
  let requestedUrl;
  const html = '<a class="result__a" href="https://example.org/result">Example result</a><a class="result__snippet">A short description.</a>';
  const result = await searchWeb({ query: '  test topic  ', maxResults: 3 }, {
    resolver: async (hostname) => {
      assert.equal(hostname, 'html.duckduckgo.com');
      return [{ address: PUBLIC_IP, family: 4 }];
    },
    requester: async (url) => {
      requestedUrl = url;
      return fakeResponse(html);
    },
  });
  assert.equal(requestedUrl.searchParams.get('q'), 'test topic');
  assert.equal(result.provider, 'DuckDuckGo');
  assert.equal(result.query, 'test topic');
  assert.equal(result.resultCount, 1);
  assert.equal(result.results[0].url, 'https://example.org/result');
  assert.match(result.note, /untrusted/i);
});

test('public page response bodies remain bounded even when an injected requester exceeds its allowance', async () => {
  await assert.rejects(fetchPublicPageForTest('https://example.com/', {
    maxBytes: 8,
    resolver: async () => [{ address: PUBLIC_IP, family: 4 }],
    requester: async () => fakeResponse('body larger than eight bytes'),
  }), /size limit/i);
});

test('web scraper strips active markup and returns bounded readable text and metadata', async () => {
  const html = [
    '<html><head><title>Page &amp; Title</title>',
    '<meta name="description" content="A &amp; useful page">',
    '<script>ignore this secret code</script><style>.hidden { display:none }</style></head>',
    '<body><nav>Navigation noise</nav><main><h1>Welcome</h1><p>Hello &amp; world.</p>',
    '<ul><li>First point</li><li>Second point</li></ul></main><footer>Footer noise</footer></body></html>',
  ].join('');
  const result = await scrapeWeb({ url: 'https://example.com/article' }, {
    resolver: async () => [{ address: PUBLIC_IP, family: 4 }],
    requester: async () => fakeResponse(html),
  });
  assert.equal(result.title, 'Page & Title');
  assert.equal(result.description, 'A & useful page');
  assert.match(result.text, /Welcome/);
  assert.match(result.text, /Hello & world/);
  assert.match(result.text, /First point/);
  assert.doesNotMatch(result.text, /secret code|hidden \{|Navigation noise|Footer noise|<script/i);
  assert.equal(result.url, 'https://example.com/article');
  assert.equal(result.truncated, false);
  assert.match(result.note, /untrusted/i);
});

test('plain-text pages preserve markup-like characters and report bounded character counts', async () => {
  const source = `  Code: <Widget> & data\r\n\r\n  second line.\n${'x'.repeat(30_100)}`;
  const result = await scrapeWeb({ url: 'https://example.com/plain.txt' }, {
    resolver: async () => [{ address: PUBLIC_IP, family: 4 }],
    requester: async () => fakeResponse(source, { 'content-type': 'text/plain; charset=utf-8' }),
  });
  assert.ok(result.text.startsWith('Code: <Widget> & data\n\nsecond line.\n'));
  assert.equal(result.charCount, 30_000);
  assert.equal(result.text.length, 30_000);
  assert.equal(result.truncated, true);
});

test('Markdown content types are treated as bounded plain text', async () => {
  const source = '# Creator Hub API\n\nUse `StudioService` in Edit mode.\n\n- Read scripts\n- Inspect instances';
  for (const mimeType of ['text/markdown', 'text/x-markdown']) {
    const result = await scrapeWeb({ url: 'https://example.com/reference.md' }, {
      resolver: async () => [{ address: PUBLIC_IP, family: 4 }],
      requester: async () => fakeResponse(source, { 'content-type': `${mimeType}; charset=utf-8` }),
    });
    assert.equal(result.contentType, `${mimeType}; charset=utf-8`);
    assert.equal(result.title, '');
    assert.equal(result.description, '');
    assert.equal(result.text, source);
    assert.equal(result.charCount, source.length);
    assert.equal(result.truncated, false);
    assert.match(result.note, /untrusted/i);
  }
});

test('web scraper still rejects binary responses and reports their content type', async () => {
  await assert.rejects(scrapeWeb({ url: 'https://example.com/reference.md' }, {
    resolver: async () => [{ address: PUBLIC_IP, family: 4 }],
    requester: async () => fakeResponse('not treated as markdown', { 'content-type': 'application/octet-stream' }),
  }), /unsupported content type.*application\/octet-stream/i);
});

test('malformed oversized HTML is scanned without leaking script text or hanging on repeated tags', async () => {
  const hostileHtml = `${'<script>'.repeat(30_000)}untrusted script content`;
  const result = await scrapeWeb({ url: 'https://example.com/malformed' }, {
    resolver: async () => [{ address: PUBLIC_IP, family: 4 }],
    requester: async () => fakeResponse(hostileHtml),
  });
  assert.equal(result.text, '');
  assert.deepEqual(parseDuckDuckGoResultsForTest('<a'.repeat(30_000)), []);
});
