import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const ROOT = path.resolve(import.meta.dir, '..');
const BIN = path.join(ROOT, 'bin');

let tmpDir: string;
let skillsDir: string;
let installDir: string;

function run(cmd: string, env: Record<string, string> = {}, expectFail = false): string {
  try {
    return execSync(cmd, {
      cwd: ROOT,
      env: { ...process.env, JSTACK_STATE_DIR: tmpDir, ...env },
      encoding: 'utf-8',
      timeout: 10000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch (e: any) {
    if (expectFail) return (e.stderr || e.stdout || '').toString().trim();
    throw e;
  }
}

// Create a mock jstack install directory with skill subdirs
function setupMockInstall(skills: string[]): void {
  installDir = path.join(tmpDir, 'jstack-install');
  skillsDir = path.join(tmpDir, 'skills');
  fs.mkdirSync(installDir, { recursive: true });
  fs.mkdirSync(skillsDir, { recursive: true });

  // Copy the real jstack-config and jstack-relink to the mock install
  const mockBin = path.join(installDir, 'bin');
  fs.mkdirSync(mockBin, { recursive: true });
  fs.copyFileSync(path.join(BIN, 'jstack-config'), path.join(mockBin, 'jstack-config'));
  fs.chmodSync(path.join(mockBin, 'jstack-config'), 0o755);
  if (fs.existsSync(path.join(BIN, 'jstack-relink'))) {
    fs.copyFileSync(path.join(BIN, 'jstack-relink'), path.join(mockBin, 'jstack-relink'));
    fs.chmodSync(path.join(mockBin, 'jstack-relink'), 0o755);
  }
  if (fs.existsSync(path.join(BIN, 'jstack-patch-names'))) {
    fs.copyFileSync(path.join(BIN, 'jstack-patch-names'), path.join(mockBin, 'jstack-patch-names'));
    fs.chmodSync(path.join(mockBin, 'jstack-patch-names'), 0o755);
  }

  // Create mock skill directories with proper frontmatter
  for (const skill of skills) {
    fs.mkdirSync(path.join(installDir, skill), { recursive: true });
    fs.writeFileSync(
      path.join(installDir, skill, 'SKILL.md'),
      `---\nname: ${skill}\ndescription: test\n---\n# ${skill}`
    );
  }
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jstack-relink-test-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('jstack-relink (#578)', () => {
  // Test 11: prefixed symlinks when skill_prefix=true
  test('creates jstack-* symlinks when skill_prefix=true', () => {
    setupMockInstall(['qa', 'ship', 'review']);
    // Set config to prefix mode
    run(`${path.join(installDir, 'bin', 'jstack-config')} set skill_prefix true`);
    // Run relink with env pointing to the mock install
    const output = run(`${path.join(installDir, 'bin', 'jstack-relink')}`, {
      JSTACK_INSTALL_DIR: installDir,
      JSTACK_SKILLS_DIR: skillsDir,
    });
    // Verify jstack-* symlinks exist
    expect(fs.existsSync(path.join(skillsDir, 'jstack-qa'))).toBe(true);
    expect(fs.existsSync(path.join(skillsDir, 'jstack-ship'))).toBe(true);
    expect(fs.existsSync(path.join(skillsDir, 'jstack-review'))).toBe(true);
    expect(output).toContain('jstack-');
  });

  // Test 12: flat symlinks when skill_prefix=false
  test('creates flat symlinks when skill_prefix=false', () => {
    setupMockInstall(['qa', 'ship', 'review']);
    run(`${path.join(installDir, 'bin', 'jstack-config')} set skill_prefix false`);
    const output = run(`${path.join(installDir, 'bin', 'jstack-relink')}`, {
      JSTACK_INSTALL_DIR: installDir,
      JSTACK_SKILLS_DIR: skillsDir,
    });
    expect(fs.existsSync(path.join(skillsDir, 'qa'))).toBe(true);
    expect(fs.existsSync(path.join(skillsDir, 'ship'))).toBe(true);
    expect(fs.existsSync(path.join(skillsDir, 'review'))).toBe(true);
    expect(output).toContain('flat');
  });

  // Test 13: cleans stale symlinks from opposite mode
  test('cleans up stale symlinks from opposite mode', () => {
    setupMockInstall(['qa', 'ship']);
    // Create prefixed symlinks first
    run(`${path.join(installDir, 'bin', 'jstack-config')} set skill_prefix true`);
    run(`${path.join(installDir, 'bin', 'jstack-relink')}`, {
      JSTACK_INSTALL_DIR: installDir,
      JSTACK_SKILLS_DIR: skillsDir,
    });
    expect(fs.existsSync(path.join(skillsDir, 'jstack-qa'))).toBe(true);

    // Switch to flat mode
    run(`${path.join(installDir, 'bin', 'jstack-config')} set skill_prefix false`);
    run(`${path.join(installDir, 'bin', 'jstack-relink')}`, {
      JSTACK_INSTALL_DIR: installDir,
      JSTACK_SKILLS_DIR: skillsDir,
    });

    // Flat symlinks should exist, prefixed should be gone
    expect(fs.existsSync(path.join(skillsDir, 'qa'))).toBe(true);
    expect(fs.existsSync(path.join(skillsDir, 'jstack-qa'))).toBe(false);
  });

  // Test 14: error when install dir missing
  test('prints error when install dir missing', () => {
    const output = run(`${BIN}/jstack-relink`, {
      JSTACK_INSTALL_DIR: '/nonexistent/path/jstack',
      JSTACK_SKILLS_DIR: '/nonexistent/path/skills',
    }, true);
    expect(output).toContain('setup');
  });

  // Test: jstack-upgrade does NOT get double-prefixed
  test('does not double-prefix jstack-upgrade directory', () => {
    setupMockInstall(['qa', 'ship', 'jstack-upgrade']);
    run(`${path.join(installDir, 'bin', 'jstack-config')} set skill_prefix true`);
    run(`${path.join(installDir, 'bin', 'jstack-relink')}`, {
      JSTACK_INSTALL_DIR: installDir,
      JSTACK_SKILLS_DIR: skillsDir,
    });
    // jstack-upgrade should keep its name, NOT become jstack-jstack-upgrade
    expect(fs.existsSync(path.join(skillsDir, 'jstack-upgrade'))).toBe(true);
    expect(fs.existsSync(path.join(skillsDir, 'jstack-jstack-upgrade'))).toBe(false);
    // Regular skills still get prefixed
    expect(fs.existsSync(path.join(skillsDir, 'jstack-qa'))).toBe(true);
  });

  // Test 15: jstack-config set skill_prefix triggers relink
  test('jstack-config set skill_prefix triggers relink', () => {
    setupMockInstall(['qa', 'ship']);
    // Run jstack-config set which should auto-trigger relink
    run(`${path.join(installDir, 'bin', 'jstack-config')} set skill_prefix true`, {
      JSTACK_INSTALL_DIR: installDir,
      JSTACK_SKILLS_DIR: skillsDir,
    });
    // If relink was triggered, symlinks should exist
    expect(fs.existsSync(path.join(skillsDir, 'jstack-qa'))).toBe(true);
    expect(fs.existsSync(path.join(skillsDir, 'jstack-ship'))).toBe(true);
  });
});

describe('jstack-patch-names (#620/#578)', () => {
  // Helper to read name: from SKILL.md frontmatter
  function readSkillName(skillDir: string): string | null {
    const content = fs.readFileSync(path.join(skillDir, 'SKILL.md'), 'utf-8');
    const match = content.match(/^name:\s*(.+)$/m);
    return match ? match[1].trim() : null;
  }

  test('prefix=true patches name: field in SKILL.md', () => {
    setupMockInstall(['qa', 'ship', 'review']);
    run(`${path.join(installDir, 'bin', 'jstack-config')} set skill_prefix true`);
    run(`${path.join(installDir, 'bin', 'jstack-relink')}`, {
      JSTACK_INSTALL_DIR: installDir,
      JSTACK_SKILLS_DIR: skillsDir,
    });
    // Verify name: field is patched with jstack- prefix
    expect(readSkillName(path.join(installDir, 'qa'))).toBe('jstack-qa');
    expect(readSkillName(path.join(installDir, 'ship'))).toBe('jstack-ship');
    expect(readSkillName(path.join(installDir, 'review'))).toBe('jstack-review');
  });

  test('prefix=false restores name: field in SKILL.md', () => {
    setupMockInstall(['qa', 'ship']);
    // First, prefix them
    run(`${path.join(installDir, 'bin', 'jstack-config')} set skill_prefix true`);
    run(`${path.join(installDir, 'bin', 'jstack-relink')}`, {
      JSTACK_INSTALL_DIR: installDir,
      JSTACK_SKILLS_DIR: skillsDir,
    });
    expect(readSkillName(path.join(installDir, 'qa'))).toBe('jstack-qa');
    // Now switch to flat mode
    run(`${path.join(installDir, 'bin', 'jstack-config')} set skill_prefix false`);
    run(`${path.join(installDir, 'bin', 'jstack-relink')}`, {
      JSTACK_INSTALL_DIR: installDir,
      JSTACK_SKILLS_DIR: skillsDir,
    });
    // Verify name: field is restored to unprefixed
    expect(readSkillName(path.join(installDir, 'qa'))).toBe('qa');
    expect(readSkillName(path.join(installDir, 'ship'))).toBe('ship');
  });

  test('jstack-upgrade name: not double-prefixed', () => {
    setupMockInstall(['qa', 'jstack-upgrade']);
    run(`${path.join(installDir, 'bin', 'jstack-config')} set skill_prefix true`);
    run(`${path.join(installDir, 'bin', 'jstack-relink')}`, {
      JSTACK_INSTALL_DIR: installDir,
      JSTACK_SKILLS_DIR: skillsDir,
    });
    // jstack-upgrade should keep its name, NOT become jstack-jstack-upgrade
    expect(readSkillName(path.join(installDir, 'jstack-upgrade'))).toBe('jstack-upgrade');
    // Regular skill should be prefixed
    expect(readSkillName(path.join(installDir, 'qa'))).toBe('jstack-qa');
  });

  test('SKILL.md without frontmatter is a no-op', () => {
    setupMockInstall(['qa']);
    // Overwrite qa SKILL.md with no frontmatter
    fs.writeFileSync(path.join(installDir, 'qa', 'SKILL.md'), '# qa\nSome content.');
    run(`${path.join(installDir, 'bin', 'jstack-config')} set skill_prefix true`);
    // Should not crash
    run(`${path.join(installDir, 'bin', 'jstack-relink')}`, {
      JSTACK_INSTALL_DIR: installDir,
      JSTACK_SKILLS_DIR: skillsDir,
    });
    // Content should be unchanged (no name: to patch)
    const content = fs.readFileSync(path.join(installDir, 'qa', 'SKILL.md'), 'utf-8');
    expect(content).toBe('# qa\nSome content.');
  });
});
