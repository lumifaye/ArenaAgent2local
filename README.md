# Arena Local

**Arena Local is a desktop companion for prompting Arena.ai and letting Arena Bash request scoped actions on your computer.** The desktop app runs a small authenticated task API on loopback, and can expose only that API through an ngrok HTTPS tunnel. Arena's Bash tool calls the tunnel with `curl`; this app shows file writes, Git commits, shell commands, and changing or unknown Roblox Studio MCP tools in a local approval queue before running them. Optional read-only web search and page scraping can be enabled locally; those tools use public HTTPS only and return bounded text to Arena. Arena Local can also act as an MCP client for Roblox Studio's built-in local `stdio` server; it does not expose Arena Local as an MCP server.

Arena Local embeds the real arena.ai chat in an in-app panel and loads it automatically by default; you can turn automatic loading off in Settings and start it manually instead. Your prompts and sign-in stay between you and Arena. This app never sees your Arena credentials; what comes back here are the authenticated tool requests, which you approve locally like any other.

The bottom-left **Settings** screen manages your profile, pronouns, About Me, global Arena instructions, chat auto-load, appearance, GitHub token, and local integration toggles. Profile details and custom instructions are stored in the app’s user-data settings—not in this repository—and are included in the generated Arena setup prompt only when you copy it. The GitHub token remains on its separate OS-secure-storage path and is never added to the prompt.

- **Loading screen:** the launch splash shows **arena local :3**, the current boot stage, and a live "what the ai is asking to do" list with the files it's touching.
- **Live ask banner:** the same "what the ai is asking to do / files it's touching" summary stays pinned at the top of the control center whenever Arena has work in flight or waiting on you.
- **Required narration:** the copied Arena setup prompt and the public agent guide both require the agent, before every change, to explain what it's trying to do and list the exact files it intends to touch — and to summarize the files it actually touched when done.
- **Chat without leaving:** the arena.ai agent is embedded in the **Chat with Arena** panel after you paste the setup prompt, so you can keep talking to the bot without opening a browser. Type `/btw` and press Enter in its composer to open a separate direct Arena chat window for Claude Sonnet 5.5 High; the command is cleared instead of being sent as a message.


**Download page:** [lumifaye.github.io/ArenaAgent2local](https://lumifaye.github.io/ArenaAgent2local/) · **Agent guide:** [agents.md](https://lumifaye.github.io/ArenaAgent2local/agents.md) · **Latest releases:** [GitHub Releases](https://github.com/lumifaye/ArenaAgent2local/releases)

## Run the desktop app

Requirements: Node.js **22.12 or newer** and npm.

```bash
npm install
npm start
```

In Arena Local:

1. Choose the project folder Arena is allowed to work in. It also backs local desktop preview and Git. Enabling full-computer mode removes it from remote file scope; reselect a separate local folder if you still want desktop preview or Git.
2. Paste your ngrok authtoken and save it. It is encrypted with Electron `safeStorage` when the OS provides secure storage; otherwise it remains in memory until the app closes.
3. Start the remote connection. The app creates a temporary HTTPS ngrok URL.
4. Click **Copy Arena setup prompt** and paste it into an Arena.ai conversation — either the embedded **Chat with Arena** panel in this app or a window on arena.ai. That prompt contains the tunnel URL and an ephemeral bearer key.
5. Ask Arena to inspect or change the selected workspace. Reads are returned to Arena; writes, staged Git commits, and terminal commands show up in **Waiting for your approval** in this desktop app.
6. **Optional Roblox Studio integration:** install the latest Roblox Studio, then enable **Assistant → … → Manage MCP Servers → Enable Studio as MCP server** in Studio. In Arena Local, choose **Connect Roblox Studio** and accept the native warning. Arena Local launches Studio's built-in MCP server over local `stdio`; the copied Arena prompt then lets Arena discover and call those tools through the authenticated task API. Calls are scoped to an explicit `studio_id`; mutating and unknown tools require local approval in Ask mode, are blocked in Read only mode, and can run without per-action approval in No-Ask mode. The **Disable Studio MCP** toggle in Settings disconnects Studio and blocks both local and remote tool controls.
7. **Optional, EXTREMELY DANGEROUS:** with the remote link stopped, use **Enable full-computer access** and accept two native warnings. Remote file actions then have no selected workspace and require explicit absolute paths; shell requests also require an explicit absolute `cwd`. Select a separate local folder for desktop preview and Git; it never becomes the remote file scope. The pairing key rotates; copy a fresh prompt after reconnecting. Full-computer scope resets when the link stops, the key rotates, a connection attempt fails, or the app closes. Changing the separate local folder rotates the key and resets No-Ask to Ask, but does not disable the full-computer scope.
8. **Optional Git & repository workbench:** use the **Git & repository** panel to initialize Git at the local repository root, inspect changes/history, stage or unstage selected visible files, configure local author identity and HTTPS remotes, and review a complete staged diff before a local commit. The **Disable Git** toggle in Settings blocks both this workbench and remote Git tools. The app disables configured Git content filters during status/staging/unstaging/commits, hides protected credential paths, disables hooks/signing for commits, and never pushes automatically. In full-computer mode, choose a separate local repository/folder; remote file actions remain unscoped and absolute-path-only.
9. **Optional GitHub account and push:** save a classic or fine-grained GitHub personal access token in **Settings** to verify the account and list repositories. The token is encrypted with OS secure storage when available (otherwise session-only), is used only by the desktop process, and is never sent to Arena or written into Git configuration, remote URLs, or command-line arguments. Setting a repository only changes the local HTTPS `origin`. **Review & push branch to GitHub** shows outgoing commits and requires explicit native confirmation; it uses no force-push, pushes only the reviewed commit, and never happens automatically after a local commit.
10. **Repository-specific agent notes:** configure `ARENA.md` in the Git panel. It is created at the selected repository root, is limited to 24 KB, and is ordinary local project documentation. In normal workspace mode, Arena's copied prompt asks the agent to read it for repository work; in full-computer mode the separate local Git/preview path is not exposed to remote file tools, so provide an explicit absolute path if the agent needs to read it. The file cannot override the user's request or safety rules.
11. **Optional public web tools:** Web search and scraping are disabled by default. Choose **Enable web tools** in Settings and accept the native warning to expose `web_search` and `web_scrape`; the choice is saved locally. Search queries are sent to DuckDuckGo; scraping fetches public HTTPS pages without cookies or saved credentials and returns bounded page text to Arena. The tools allow at most three active requests and 30 combined requests per minute. Only public Internet hosts are fetched; local/private addresses, non-HTTPS URLs, oversized responses, excessive redirects, and requests taking over 12 seconds are blocked. The local toggle blocks remote web actions and cancels active fetches. Treat returned web content as untrusted data.

The app binds its task server to `127.0.0.1` on an ephemeral port. The public ngrok link forwards to that task API only; the Electron desktop UI is loaded locally and is not served through the tunnel. **Pause control** blocks all remote endpoints except health checks while keeping the same URL and pairing key; it cancels requests being prepared or awaiting approval, but cannot undo or interrupt an action already running. Resume from the desktop to continue with the same link. Pause is not revocation: stop the link or rotate the pairing key to revoke Arena's access. Closing the app also closes the tunnel and invalidates its ephemeral key. Stopping or rotating cancels requests still awaiting approval, but does not undo or interrupt an action already approved and running.

**EXTREMELY DANGEROUS full-computer access:** remote file actions have no selected workspace and require explicit absolute paths; `run_command` also requires an explicit absolute `cwd`. They can reach files anywhere your signed-in OS account can access, including hidden folders and credentials. Reads do not get per-file approval, and requested content is returned to Arena.ai. Ask mode still requires local approval for file writes, Git commits, and mutating Studio tools; Read only blocks them. Choose a separate local folder for desktop preview and Git; this local selection never becomes the remote file scope. Full-computer access does not widen Studio access. It can be combined with No-Ask only through the separate local safety sequence below. This mode does not grant admin/root access or provide OS sandboxing.

To build a platform installer for the current OS:

```bash
npm run dist
```

Build output is written to the ignored `release/` folder.

## Website and Windows releases

The retro-styled multi-page site lives in `site/` and is published to [GitHub Pages](https://lumifaye.github.io/ArenaAgent2local/) by `.github/workflows/pages.yml` when site changes reach `main` or the active `arena/8393bb53-arenaagent2local` branch. It includes feature, getting-started, safety/privacy, FAQ, download, and changelog pages, plus a custom 404 page and sitemap. The download page resolves the Windows installer and SHA-256 sidecar from the latest GitHub Release. The public [`agents.md`](https://lumifaye.github.io/ArenaAgent2local/agents.md) guide covers the bridge, privacy, and safe usage; the copied Arena setup prompt tells Bash to fetch it before making bridge requests.

`.github/workflows/windows-release.yml` builds a Windows x64 NSIS installer and runs the test suite on pushes to the active branch, uploading the installer as a 14-day Actions artifact. Publishing a GitHub Release with a `v*` tag triggers the same workflow to build the installer and attach it to that release. The tag must exactly match the version in `package.json` (currently `0.1.14`, published as `v0.1.14`). The workflow uses the repository's `GITHUB_TOKEN`; no release secret is needed. Published releases include `Arena-Local-Setup.exe` and a SHA-256 checksum sidecar. The installer is not code-signed, so Windows may show an unrecognized-publisher SmartScreen notice. GitHub Pages should use **Settings → Pages → Build and deployment → GitHub Actions**.

## Arena Bash bridge API

The copied Arena setup prompt includes the current URL and bearer key. Bash requests are JSON and must include `Authorization: Bearer <pairing-key>`.

Submit a task:

```bash
curl -sS -X POST "$ARENA_LOCAL_URL/v1/tasks" \
  -H "Authorization: Bearer $ARENA_LOCAL_TOKEN" \
  -H 'Content-Type: application/json' \
  --data '{"requestId":"readme-demo-01","action":"read_file","args":{"path":"README.md"}}'
```

A valid task submission returns HTTP `202 Accepted` by design; this is not a failure or a completion signal. The JSON body includes a `taskId` and current `status`; the response also provides a `Location` task URL and `Retry-After` polling hint. Poll the same task until it reaches a terminal status:

```bash
curl -sS "$ARENA_LOCAL_URL/v1/tasks/$TASK_ID" \
  -H "Authorization: Bearer $ARENA_LOCAL_TOKEN"
```

`requestId` is an idempotency key: reuse it only to retry the exact same action. Do not resubmit a task because POST returned HTTP 202 or while it is pending; poll its `taskId` instead. A request body is `{ "requestId": "...", "action": "...", "args": { ... } }`.

Supported actions:

- `list_files` — `args.path` optional, defaults to `.`
- `read_file` — `args.path`
- `search_text` — `args.query`, optional `args.path`
- `write_file` — `args.path`, `args.content`
- `run_command` — `args.command`; in full-computer mode it also requires an explicit absolute `args.cwd`
- `git_status` — selected local repository branch and safe changed-path summary; health reports `gitWorkspaceSelected` separately from the remote `workspace`
- `git_diff` — no arguments; returns a capped diff of staged changes only, omitting protected paths. Working-tree diffs are intentionally unavailable so the inspection never runs repository-configured clean filters.
- `git_log` — optional `args.limit` from 1–50, defaults to 20; returns recent commit subjects only
- `git_commit` — `args.message`; commits staged changes only after local review, disables hooks/signing and configured content filters during the commit, and never pushes
- `list_processes` — no arguments; returns up to 500 process names and PIDs only, never command-line arguments
- `web_search` — `args.query` (up to 500 characters) and optional `args.maxResults` (1–10, default 5); searches DuckDuckGo's public HTML results. The local Web tools setting must be enabled; query responses are capped at 1.5 MB.
- `web_scrape` — `args.url`; fetches one public HTTPS page without cookies or saved credentials and returns available title/description metadata for HTML pages plus up to 30,000 characters of readable text. Page responses are capped at 2 MB. HTML, Markdown (`text/markdown` and `text/x-markdown`), and `text/plain` are supported; binary and other content types, IP literals, local/private hosts, nonstandard ports, and redirects to non-HTTPS/private addresses are rejected. Both web actions share a limit of three active requests and 30 requests per minute, with a 12-second timeout and up to four redirects.
- `roblox_tool` — `args.name` and an `args.arguments` JSON object matching that tool's `inputSchema` from authenticated `GET /v1/roblox/tools`. Discover Studio instances with the `list_roblox_studios` tool, then include a non-empty `studio_id` for Studio-targeted calls. `execute_luau` also requires `datamodel_type` (`Edit`, `Client`, or `Server`) and `code`.

File reads run automatically within the chosen workspace. With full-computer access, the remote API has no selected workspace: every file action needs an explicit absolute path and `run_command` also needs an absolute `cwd`; the local preview/Git folder is not inherited. Git status/diff/log and process-name/PID listing are also read-only tools; Git uses the separately selected local repository in full-computer mode, hides protected paths from status/diffs, and is independently gated by the local Git integration toggle. Locally enabled web search/scraping are read-only and run in Ask or Read only mode, but can send queries and page text to Arena and DuckDuckGo. `git_status`, desktop staging/unstaging, and `git_commit` disable configured clean/process filters so a repository cannot run filter commands during these operations; files that rely on normalization by such a filter may consequently appear modified in status. `git_diff` returns staged changes only. These results are returned to Arena. Known read-only Roblox tools also run in Ask or Read only mode. Mutating and unknown Roblox tools, `write_file`, `run_command`, and `git_commit` return `awaiting_approval` until the desktop user approves or denies them in Ask mode; Read only blocks them, and No-Ask runs them immediately after the local safety flow. The Git commit approval card shows the current branch, staged files, complete staged diff, and message; approval is one-time because staged changes can change. Git commit disables hooks/signing, commits only staged changes, and does not push. GitHub push is a separate local-only control-center action that previews the outgoing commits and requires explicit native confirmation. Studio tools can inspect or change any place open in the connected Studio instance; some may access local asset paths or Roblox services. The selected file workspace does not confine Studio actions. Tasks expire; the API rejects arbitrary action names, extra arguments, oversized requests, unauthenticated calls, and excessive request rates. Outside absolute file paths are rejected unless full-computer access is active.

## Permission and privacy model

- **Ask before changes** is the default. The desktop UI shows the complete proposed file diff, exact shell command, exact Roblox Studio tool name and arguments, or staged Git diff and commit message. You can approve once, allow an eligible exact action for the current connection, or deny it. Git commits are one-time approvals: immediately before committing, Arena Local verifies that the staged diff and branch still match the preview. Before an approved file write is applied, the app checks that the file has not changed since the diff was shown; if it has, it refuses the stale approval and requires a fresh review.
- **Read only** blocks file writes, Git commits, terminal commands, and mutating or unknown Roblox Studio tools. Git inspection and process-name/PID listing remain available. A conservative built-in name allowlist permits only known read-only Studio tools; MCP annotations alone cannot grant access. Switching modes denies pending requests and clears session approvals.
- **No approval — VERY DANGEROUS** is available behind two native warning confirmations. It auto-runs remote file writes, staged Git commits, shell commands, and mutating or unknown Roblox Studio tools. Shell commands have the signed-in user's OS permissions and can reach outside the workspace; Studio tools can change open places or run Luau. The mode is not persisted and resets when you stop the tunnel, rotate the pairing key, change the selected local folder, or close the app. The desktop UI keeps a prominent danger banner and labels these actions as auto-approved.
- **Full-computer access — EXTREMELY DANGEROUS** is a separate, off-by-default file scope setting. It requires two native warning confirmations while disconnected, rotates the pairing key, is never persisted, and resets when the connection stops, the key rotates, a connection attempt fails, or the app closes. It leaves the remote API with no selected workspace and requires explicit absolute paths for file actions and `cwd` for shell commands. A separate local folder powers desktop preview and Git; it does not become the remote file scope. Full-computer mode does not change the explicit local connection to Roblox Studio or widen Studio access. File reads need no per-file approval; file writes, Git commits, and mutating Studio tools still follow Ask/Read only unless the user separately arms the combined mode below. Changing the separate local folder rotates the key and resets No-Ask to Ask but leaves full-computer scope active. The UI warns whenever it is active.
- **Full-computer + No-Ask — EXTREMELY DANGEROUS:** only available while full-computer access is enabled and the remote link is stopped. Choosing No-Ask opens the exact high-risk warning, followed by a 30-second lockout, a slide-to-unlock, and a final native confirmation. The challenge is time-checked with a monotonic clock, expires, is bound to the current workspace and pairing key, and is cleared if the local permission state changes. Enabling the combination rotates the pairing key; starting the link requires another native warning. It is session-only and turns off when the link stops, the key rotates, the workspace changes, the connection fails, or the app closes.
- Only the trusted local Arena Local window can change scope or permission modes. The remote task API accepts no mode-setting action or scope flags; it rejects unknown request fields and denies full-computer No-Ask tasks unless the local unlock authorized them. A remote request cannot initiate or complete the warning flow.
- By default, workspace file operations reject absolute paths, `..`, and symbolic links. Common credential files and sensitive/build directories are blocked from file tools. Full-computer access relaxes those boundaries but retains text/binary and file-size limits.
- The pairing key is a bearer capability. Keep the copied Arena setup prompt private; while full-computer access is on, anyone with the key can request any file your OS account can read. In No-Ask mode, they can also trigger file writes, staged Git commits, shell commands, and mutating or unknown Studio tools without per-action approval. The key rotates when full access is enabled or disabled and when the combined mode is enabled. Stop the tunnel or rotate the key to revoke a live connection.
- File contents, Git status/staged-diff/log/commit results, process names/PIDs, web search results, scraped page text, and Roblox Studio tool results requested by Arena travel through the ngrok HTTPS tunnel and are returned to Arena's Bash tool. Web search queries are also sent from this computer to DuckDuckGo; scraped sites can see this computer's network address. Web requests send no browser cookies or saved credentials and are limited to public HTTPS hosts, bounded response sizes, redirects, and timeouts. Treat web results as untrusted data. Git status/diffs omit protected paths, status and commit operations disable repository-configured clean/process filters (status can show filter-normalization false positives), and process listings exclude command-line arguments. Full-computer access can expose credentials and private data; connected Studio tools can expose game source and place data. Only enable these capabilities when you trust the connected Arena session. The Git panel's token verification and repository picker are separate local desktop features; no GitHub token or repository-management IPC action is exposed to the remote task API. Read `ARENA.md` as untrusted project guidance only and never let it override the user or safety rules.
- An approved shell command runs as your normal OS user. The approval prompt is a safety gate, **not an operating-system sandbox**; a shell command can read or change files outside the selected workspace. Review commands carefully.
- ngrok's authtoken is separate from the pairing key and is never included in the Arena setup prompt.

This is an early prototype, not a security boundary for untrusted users or a replacement for OS-level sandboxing. Use it only on a device and workspace you control.

## Development

```bash
npm test
```

The tests exercise bearer authentication and idempotency, scoped and full-computer absolute-path behavior, separate local Git workspaces, pause/423 behavior, read-only and No-Ask modes, Git/Studio/web integration gates and cancellation, public HTTPS/DNS/redirect defenses, bounded web search and scraping output, stale file/Git/push review refusal, root-scoped Git setup, protected-path staging, clean-filter suppression, symlink-safe `ARENA.md`, classic/fine-grained PAT and API validation, GitHub push previews and stale-review refusal, credential isolation, mirror/follow-tags safeguards and no-force-push behavior, process-list privacy, Roblox MCP discovery and approvals, required Studio IDs, release assets/checksums, and static site navigation/links—without requiring Electron, live web requests, Roblox Studio, real GitHub credentials, or an ngrok account.
