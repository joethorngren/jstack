import { describe, test, expect } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const ROOT = path.resolve(import.meta.dir, '..');

// ─── 6.1: Cross-component alignment ────────────────────────────
// MCP tool names in mcp-server.ts must match $B replacement mappings in gen-skill-docs.ts

describe('Sprint 4: cross-component alignment', () => {
  test('MCP tool names match $B replacement mappings in gen-skill-docs (gap 6.1)', () => {
    const mcpSource = fs.readFileSync(path.join(ROOT, 'browse/src/mcp-server.ts'), 'utf-8');
    const genSource = fs.readFileSync(path.join(ROOT, 'scripts/gen-skill-docs.ts'), 'utf-8');

    // Extract MCP tool names from server.tool() calls
    const mcpTools = [...mcpSource.matchAll(/server\.tool\(\s*'(browse_\w+)'/g)].map(m => m[1]);
    expect(mcpTools.length).toBeGreaterThanOrEqual(10);

    // Extract $B -> MCP tool mappings from condenseToCursorMdc
    const bMappings = [...genSource.matchAll(/\$B\\s\+(\w+)\\b.*?'(browse_\w+)\s+MCP tool'/g)]
      .map(m => ({ browseCmd: m[1], mcpTool: m[2] }));

    // Every MCP tool that has a $B mapping should match
    for (const mapping of bMappings) {
      expect(mcpTools).toContain(mapping.mcpTool);
    }

    // The special case: browse_assert dispatches to 'is' command
    expect(mcpTools).toContain('browse_assert');
    // And the $B replacement maps 'is' -> 'browse_assert'
    expect(genSource).toContain("$B\\s+is\\b");
    expect(genSource).toContain("browse_assert MCP tool");
  });

  test('MCP tool dispatch commands are valid browse commands', () => {
    const { ALL_COMMANDS } = require('../browse/src/commands');
    const mcpSource = fs.readFileSync(path.join(ROOT, 'browse/src/mcp-server.ts'), 'utf-8');

    // Extract dispatchCommand calls: dispatchCommand('goto', ...)
    const dispatches = [...mcpSource.matchAll(/dispatchCommand\('(\w+)'/g)].map(m => m[1]);
    expect(dispatches.length).toBeGreaterThanOrEqual(10);

    for (const cmd of dispatches) {
      expect(ALL_COMMANDS.has(cmd)).toBe(true);
    }
  });
});

// ─── 1.1-1.2: MCP server handshake ─────────────────────────────

describe('Sprint 4: MCP server', () => {
  test('MCP server responds to initialize + tools/list (gaps 1.1, 1.2)', () => {
    const input = [
      '{"jsonrpc":"2.0","method":"initialize","id":1,"params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}',
      '{"jsonrpc":"2.0","method":"notifications/initialized","params":{}}',
      '{"jsonrpc":"2.0","method":"tools/list","id":2,"params":{}}',
    ].join('\n') + '\n';

    const result = execSync(
      `echo '${input}' | timeout 10 bun run browse/src/mcp-server.ts 2>/dev/null`,
      { cwd: ROOT, encoding: 'utf-8', timeout: 15000 }
    );

    const lines = result.trim().split('\n').filter(Boolean);
    expect(lines.length).toBeGreaterThanOrEqual(2);

    // Parse initialize response
    const initResp = JSON.parse(lines[0]);
    expect(initResp.result.serverInfo.name).toBe('jstack-browse');
    expect(initResp.result.capabilities.tools).toBeDefined();

    // Parse tools/list response
    const toolsResp = JSON.parse(lines[lines.length - 1]);
    const tools = toolsResp.result.tools;
    expect(tools.length).toBe(10);

    // Verify expected tool names
    const toolNames = tools.map((t: any) => t.name).sort();
    expect(toolNames).toEqual([
      'browse_assert',
      'browse_click',
      'browse_fill',
      'browse_goto',
      'browse_press',
      'browse_screenshot',
      'browse_scroll',
      'browse_snapshot',
      'browse_type',
      'browse_wait',
    ]);
  });

  test('MCP tool schemas have required parameters (gap 1.4)', () => {
    const input = [
      '{"jsonrpc":"2.0","method":"initialize","id":1,"params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}',
      '{"jsonrpc":"2.0","method":"notifications/initialized","params":{}}',
      '{"jsonrpc":"2.0","method":"tools/list","id":2,"params":{}}',
    ].join('\n') + '\n';

    const result = execSync(
      `echo '${input}' | timeout 10 bun run browse/src/mcp-server.ts 2>/dev/null`,
      { cwd: ROOT, encoding: 'utf-8', timeout: 15000 }
    );

    const lines = result.trim().split('\n').filter(Boolean);
    const toolsResp = JSON.parse(lines[lines.length - 1]);
    const tools: Record<string, any> = {};
    for (const t of toolsResp.result.tools) {
      tools[t.name] = t.inputSchema;
    }

    // browse_goto requires url
    expect(tools['browse_goto'].required).toContain('url');
    // browse_click requires selector
    expect(tools['browse_click'].required).toContain('selector');
    // browse_fill requires selector AND value
    expect(tools['browse_fill'].required).toContain('selector');
    expect(tools['browse_fill'].required).toContain('value');
    // browse_assert requires property AND selector
    expect(tools['browse_assert'].required).toContain('property');
    expect(tools['browse_assert'].required).toContain('selector');
    // browse_screenshot has NO required params (selector is optional)
    expect(tools['browse_screenshot'].required || []).not.toContain('selector');
  });
});

// ─── 2.1-2.7: Cursor .mdc validation ────────────────────────────

describe('Sprint 4: cursor .mdc generation', () => {
  // Generate cursor output to a temp dir so we don't pollute the repo
  const cursorRulesDir = path.join(ROOT, '.cursor', 'rules');

  test('cursor host generates .mdc files (gap 2.1)', () => {
    // Run gen-skill-docs --host cursor (generates to .cursor/rules/)
    execSync('bun run gen:skill-docs --host cursor 2>/dev/null', {
      cwd: ROOT,
      timeout: 30000,
    });

    expect(fs.existsSync(cursorRulesDir)).toBe(true);
    const mdcFiles = fs.readdirSync(cursorRulesDir).filter(f => f.endsWith('.mdc'));
    expect(mdcFiles.length).toBeGreaterThanOrEqual(30);
  });

  test('.mdc files have valid frontmatter (gap 2.4)', () => {
    const mdcFiles = fs.readdirSync(cursorRulesDir).filter(f => f.endsWith('.mdc'));
    for (const file of mdcFiles) {
      const content = fs.readFileSync(path.join(cursorRulesDir, file), 'utf-8');
      // Must start with ---
      expect(content.startsWith('---\n')).toBe(true);
      // Must have description field
      expect(content).toMatch(/^description: .+/m);
      // Must have alwaysApply field
      expect(content).toMatch(/^alwaysApply: false/m);
      // Must have globs field
      expect(content).toMatch(/^globs:/m);
    }
  });

  test('CURSOR_SKIP_SKILLS are not generated (gap 2.3)', () => {
    const mdcFiles = fs.readdirSync(cursorRulesDir).filter(f => f.endsWith('.mdc'));
    const names = mdcFiles.map(f => f.replace('.mdc', ''));
    expect(names).not.toContain('jstack-codex');
    expect(names).not.toContain('jstack-connect-chrome');
    expect(names).not.toContain('jstack-autoplan');
  });

  test('.mdc files have no residual $B references (gap 2.6)', () => {
    const mdcFiles = fs.readdirSync(cursorRulesDir).filter(f => f.endsWith('.mdc'));
    for (const file of mdcFiles) {
      const content = fs.readFileSync(path.join(cursorRulesDir, file), 'utf-8');
      // $B followed by a known browse command = should have been replaced
      const residual = content.match(/\$B\s+(goto|click|type|fill|screenshot|snapshot|is|wait|scroll|press)\b/g);
      expect(residual).toBeNull();
    }
  });

  test('.mdc files have no Claude Code tool references (gap 2.7)', () => {
    const mdcFiles = fs.readdirSync(cursorRulesDir).filter(f => f.endsWith('.mdc'));
    for (const file of mdcFiles) {
      const content = fs.readFileSync(path.join(cursorRulesDir, file), 'utf-8');
      expect(content).not.toContain('use the Bash tool');
      expect(content).not.toContain('use the Write tool');
      expect(content).not.toContain('use the Read tool');
      expect(content).not.toContain('use the Agent tool');
    }
  });

  test('.mdc files have no preamble bash leakage (gap 2.5)', () => {
    const mdcFiles = fs.readdirSync(cursorRulesDir).filter(f => f.endsWith('.mdc'));
    for (const file of mdcFiles) {
      const content = fs.readFileSync(path.join(cursorRulesDir, file), 'utf-8');
      // Preamble bash setup patterns that should be stripped
      expect(content).not.toContain('_TEL_START=');
      expect(content).not.toContain('_SESSION_ID=');
      expect(content).not.toContain('jstack-learnings-search');
      // Check for preamble bash assignment patterns (not prose references)
      expect(content).not.toMatch(/>>\s*~\/\.jstack\/analytics\/skill-usage\.jsonl/);
    }
  });

  test('.mdc files have no ~/.claude/skills/ paths (gap 2.9)', () => {
    const mdcFiles = fs.readdirSync(cursorRulesDir).filter(f => f.endsWith('.mdc'));
    for (const file of mdcFiles) {
      const content = fs.readFileSync(path.join(cursorRulesDir, file), 'utf-8');
      expect(content).not.toContain('~/.claude/skills/jstack');
    }
  });
});

// ─── 5.2: Rename pattern alignment ──────────────────────────────

describe('Sprint 4: upstream sync', () => {
  test('jstack-upstream-merge covers all critical rename patterns (gap 5.2)', () => {
    const mergeScript = fs.readFileSync(path.join(ROOT, 'bin/jstack-upstream-merge'), 'utf-8');

    // The merge script must handle all gstack→jstack renames documented in UPSTREAM-RENAME-MAP.md
    const criticalPatterns = [
      'garrytan/gstack',    // GitHub repo reference
      'GSTACK_ROOT',        // Env var
      'GSTACK_BIN',         // Env var
      'GSTACK_BROWSE',      // Env var
      'GSTACK_DESIGN',      // Env var
      'gstack-config',      // Bin script
      'gstack-slug',        // Bin script
      'gstack-repo-mode',   // Bin script
      'office-hours',       // Skill rename
      '~/\\.gstack',        // Config directory
    ];

    for (const pattern of criticalPatterns) {
      expect({ pattern, found: mergeScript.includes(pattern) })
        .toEqual({ pattern, found: true });
    }
  });

  test('jstack-upstream-merge is executable', () => {
    const stat = fs.statSync(path.join(ROOT, 'bin/jstack-upstream-merge'));
    // Check execute bit (owner)
    expect(stat.mode & 0o100).toBeTruthy();
  });
});
