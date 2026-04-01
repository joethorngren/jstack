#!/usr/bin/env bun
/**
 * jstack MCP Server — stdio transport wrapping the browse daemon
 *
 * Exposes the browse daemon's headless browser as MCP tools for Cursor, VS Code,
 * and any MCP-compatible host. Reuses the daemon lifecycle from cli.ts.
 *
 * Entry point: `bun run browse/src/mcp-server.ts`
 * Config: reads .jstack/browse.json for port + auth token
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';
import { resolveConfig, ensureStateDir } from './config';

// ─── Types ──────────────────────────────────────────────────────

interface ServerState {
  pid: number;
  port: number;
  token: string;
  startedAt: string;
  serverPath: string;
  binaryVersion?: string;
  mode?: 'launched' | 'headed';
}

// ─── Config & State ─────────────────────────────────────────────

const config = resolveConfig();
const IS_WINDOWS = process.platform === 'win32';
const MAX_START_WAIT = IS_WINDOWS ? 15000 : 8000;

function readState(): ServerState | null {
  try {
    const data = fs.readFileSync(config.stateFile, 'utf-8');
    return JSON.parse(data);
  } catch (err: any) {
    if (err.code === 'ENOENT') return null;
    console.error(`[mcp] Warning: corrupt state file (${err.message}), restarting daemon`);
    return null;
  }
}

async function isServerHealthy(port: number): Promise<boolean> {
  try {
    const resp = await fetch(`http://127.0.0.1:${port}/health`, {
      signal: AbortSignal.timeout(2000),
    });
    if (!resp.ok) return false;
    const health = await resp.json() as any;
    return health.status === 'healthy';
  } catch {
    return false;
  }
}

// ─── Server Lifecycle ───────────────────────────────────────────

function resolveServerScript(): string {
  if (process.env.BROWSE_SERVER_SCRIPT) return process.env.BROWSE_SERVER_SCRIPT;
  // Guard against $bunfs virtual filesystem in compiled binaries
  if (!import.meta.dir.includes('$bunfs')) {
    const direct = path.resolve(import.meta.dir, 'server.ts');
    if (fs.existsSync(direct)) return direct;
  }
  const adjacent = path.resolve(path.dirname(process.execPath), '..', 'src', 'server.ts');
  if (fs.existsSync(adjacent)) return adjacent;
  throw new Error('Cannot find server.ts');
}

async function startServer(): Promise<ServerState> {
  ensureStateDir(config);
  try { fs.unlinkSync(config.stateFile); } catch {}

  const serverScript = resolveServerScript();
  const proc = Bun.spawn(['bun', 'run', serverScript], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, BROWSE_STATE_FILE: config.stateFile },
  });
  proc.unref();

  const start = Date.now();
  while (Date.now() - start < MAX_START_WAIT) {
    const state = readState();
    if (state && await isServerHealthy(state.port)) return state;
    await Bun.sleep(100);
  }
  throw new Error(`Browse daemon failed to start within ${MAX_START_WAIT / 1000}s`);
}

async function ensureServer(): Promise<ServerState> {
  const state = readState();
  if (state && await isServerHealthy(state.port)) return state;
  return await startServer();
}

// ─── Command Dispatch ───────────────────────────────────────────

async function dispatchCommand(command: string, args: string[], retries = 0): Promise<string> {
  const state = await ensureServer();

  try {
    const resp = await fetch(`http://127.0.0.1:${state.port}/command`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`,
      },
      body: JSON.stringify({ command, args }),
      signal: AbortSignal.timeout(30000),
    });

    // Token mismatch — server may have restarted with a new token
    if (resp.status === 401) {
      if (retries >= 1) throw new Error('Authentication failed after retry');
      const newState = readState();
      if (newState && newState.token !== state.token) {
        return dispatchCommand(command, args, retries + 1);
      }
      throw new Error('Authentication failed');
    }

    const text = await resp.text();

    if (!resp.ok) {
      try {
        const err = JSON.parse(text);
        throw new Error(err.error || text);
      } catch (e) {
        if (e instanceof SyntaxError) throw new Error(text);
        throw e;
      }
    }

    return text;
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error(`Command '${command}' timed out after 30s`);
    }
    // Connection lost — server may have crashed or timed out
    if (err.code === 'ECONNREFUSED' || err.code === 'ECONNRESET' || err.message?.includes('fetch failed')) {
      if (retries >= 1) throw new Error('Browse daemon crashed twice — aborting');
      // Restart the daemon and retry once
      const newState = await startServer();
      return dispatchCommand(command, args, retries + 1);
    }
    throw err;
  }
}

// ─── MCP Server ─────────────────────────────────────────────────

const server = new McpServer({
  name: 'jstack-browse',
  version: '0.1.0',
});

// Navigation
server.tool(
  'browse_goto',
  'Navigate to a URL. Returns page title and snapshot.',
  { url: z.string().describe('The URL to navigate to') },
  async ({ url }) => {
    const result = await dispatchCommand('goto', [url]);
    return { content: [{ type: 'text' as const, text: result }] };
  }
);

// Interaction
server.tool(
  'browse_click',
  'Click an element by CSS selector or @ref (e.g. @e3 from snapshot).',
  { selector: z.string().describe('CSS selector or @ref like @e3') },
  async ({ selector }) => {
    const result = await dispatchCommand('click', [selector]);
    return { content: [{ type: 'text' as const, text: result }] };
  }
);

server.tool(
  'browse_type',
  'Type text into the currently focused element.',
  { text: z.string().describe('Text to type') },
  async ({ text }) => {
    const result = await dispatchCommand('type', [text]);
    return { content: [{ type: 'text' as const, text: result }] };
  }
);

server.tool(
  'browse_fill',
  'Fill an input field by selector with a value. Clears existing content first.',
  {
    selector: z.string().describe('CSS selector or @ref for the input'),
    value: z.string().describe('Value to fill'),
  },
  async ({ selector, value }) => {
    const result = await dispatchCommand('fill', [selector, value]);
    return { content: [{ type: 'text' as const, text: result }] };
  }
);

server.tool(
  'browse_press',
  'Press a key (Enter, Tab, Escape, ArrowDown, Backspace, etc). Supports modifiers like Shift+Enter.',
  { key: z.string().describe('Key to press (e.g. Enter, Tab, Escape, Shift+Enter)') },
  async ({ key }) => {
    const result = await dispatchCommand('press', [key]);
    return { content: [{ type: 'text' as const, text: result }] };
  }
);

// Visual
server.tool(
  'browse_screenshot',
  'Take a screenshot of the page or a specific element. Returns the file path.',
  {
    selector: z.string().optional().describe('CSS selector or @ref to capture (omit for full page)'),
  },
  async ({ selector }) => {
    const args = selector ? [selector] : [];
    const result = await dispatchCommand('screenshot', args);
    return { content: [{ type: 'text' as const, text: result }] };
  }
);

// Snapshot (accessibility tree)
server.tool(
  'browse_snapshot',
  'Get the accessibility tree with interactive element @refs. The primary way to understand page state. Use flags: -i (interactive only), -c (compact), -d N (depth limit).',
  {
    flags: z.array(z.string()).optional().describe('Snapshot flags, e.g. ["-i", "-c"] for interactive+compact'),
  },
  async ({ flags }) => {
    const result = await dispatchCommand('snapshot', flags || ['-i']);
    return { content: [{ type: 'text' as const, text: result }] };
  }
);

// Assertion
server.tool(
  'browse_assert',
  'Check element state: visible, hidden, enabled, disabled, checked, editable, or focused.',
  {
    property: z.enum(['visible', 'hidden', 'enabled', 'disabled', 'checked', 'editable', 'focused'])
      .describe('State property to check'),
    selector: z.string().describe('CSS selector or @ref to check'),
  },
  async ({ property, selector }) => {
    const result = await dispatchCommand('is', [property, selector]);
    return { content: [{ type: 'text' as const, text: result }] };
  }
);

// Wait
server.tool(
  'browse_wait',
  'Wait for an element to appear, network to idle, or page to load. Timeout: 15s.',
  {
    target: z.string().describe('CSS selector, --networkidle, or --load'),
  },
  async ({ target }) => {
    const result = await dispatchCommand('wait', [target]);
    return { content: [{ type: 'text' as const, text: result }] };
  }
);

// Scroll
server.tool(
  'browse_scroll',
  'Scroll an element into view, or scroll to page bottom if no selector given.',
  {
    selector: z.string().optional().describe('CSS selector or @ref to scroll into view'),
  },
  async ({ selector }) => {
    const args = selector ? [selector] : [];
    const result = await dispatchCommand('scroll', args);
    return { content: [{ type: 'text' as const, text: result }] };
  }
);

// ─── Start ──────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  process.stderr.write(`[jstack-mcp] Fatal: ${err.message}\n`);
  process.exit(1);
});
