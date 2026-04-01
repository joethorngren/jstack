export type Host = 'claude' | 'codex' | 'factory';

export interface HostPaths {
  skillRoot: string;
  localSkillRoot: string;
  binDir: string;
  browseDir: string;
  designDir: string;
}

export const HOST_PATHS: Record<Host, HostPaths> = {
  claude: {
    skillRoot: '~/.claude/skills/jstack',
    localSkillRoot: '.claude/skills/jstack',
    binDir: '~/.claude/skills/jstack/bin',
    browseDir: '~/.claude/skills/jstack/browse/dist',
    designDir: '~/.claude/skills/jstack/design/dist',
  },
  codex: {
    skillRoot: '$JSTACK_ROOT',
    localSkillRoot: '.agents/skills/jstack',
    binDir: '$JSTACK_BIN',
    browseDir: '$JSTACK_BROWSE',
    designDir: '$JSTACK_DESIGN',
  },
  factory: {
    skillRoot: '$JSTACK_ROOT',
    localSkillRoot: '.factory/skills/jstack',
    binDir: '$JSTACK_BIN',
    browseDir: '$JSTACK_BROWSE',
    designDir: '$JSTACK_DESIGN',
  },
};

export interface TemplateContext {
  skillName: string;
  tmplPath: string;
  benefitsFrom?: string[];
  host: Host;
  paths: HostPaths;
  preambleTier?: number;  // 1-4, controls which preamble sections are included
}

/** Resolver function signature. args is populated for parameterized placeholders like {{INVOKE_SKILL:name}}. */
export type ResolverFn = (ctx: TemplateContext, args?: string[]) => string;
