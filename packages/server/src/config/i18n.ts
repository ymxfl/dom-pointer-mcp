export type Lang = 'zh' | 'en';

let currentLang: Lang = 'zh';

export function setLang(lang: Lang): void {
  currentLang = lang;
}

export function getLang(): Lang {
  return currentLang;
}

const texts = {
  selectAction: {
    zh: '你想做什么？',
    en: 'What do you want to do?',
  },
  actionInstall: {
    zh: '安装 — 为一个或多个 Agent 配置 DOM Pointer MCP',
    en: 'Install — set up DOM Pointer MCP for one or more agents',
  },
  actionUninstall: {
    zh: '卸载 — 从一个或多个 Agent 移除 DOM Pointer MCP',
    en: 'Uninstall — remove DOM Pointer MCP from one or more agents',
  },
  selectAgents: {
    zh: '选择 Agent（空格切换，回车确认）：',
    en: 'Select agents (space to toggle, enter to confirm):',
  },
  selectAgentsUninstall: {
    zh: '选择要卸载的 Agent（用户级）：',
    en: 'Select agents to uninstall (user scope):',
  },
  agentValidation: {
    zh: '至少选择一个 Agent（空格切换）。',
    en: 'Select at least one agent (space to toggle).',
  },
  selectScope: {
    zh: '安装范围：',
    en: 'Install scope:',
  },
  scopeUser: {
    zh: '用户级 — 全局，所有项目',
    en: 'user — global, all projects',
  },
  scopeProject: {
    zh: '项目级 — 仅当前目录',
    en: 'project — current directory only',
  },
  confirmSlash: {
    zh: '是否同时安装斜杠命令？',
    en: 'Install the slash command?',
  },
  slashYes: {
    zh: '是 — 同时安装斜杠命令',
    en: 'Yes — install the slash command',
  },
  slashNo: {
    zh: '否 — 仅安装 MCP 和 Skill',
    en: 'No — MCP and skill only',
  },
  confirmUninstall: {
    zh: (agents: string) => `将移除以下 Agent 的用户级 MCP 配置、技能和斜杠命令：${agents}。\n`
      + '  项目级安装需要手动移除。\n'
      + '  确认继续？',
    en: (agents: string) => `This will remove user-scope MCP entries, skills, and slash commands for: ${agents}.\n`
      + '  Project-scope installs must be removed manually.\n'
      + '  Continue?',
  },
  selectLaunchMode: {
    zh: '启动方式：',
    en: 'Launch mode:',
  },
  launchModeNpx: {
    zh: 'npx — 每次从 registry 获取最新版本',
    en: 'npx — always fetch latest from registry',
  },
  launchModeGlobal: {
    zh: 'global — 使用本地已安装的 dom-pointer-mcp 命令（离线可用，版本锁定）',
    en: 'global — use installed dom-pointer-mcp binary (offline, version-locked)',
  },
  noTTY: {
    zh: '交互模式需要 TTY。请显式传入工具名和 --scope 参数'
      + '（例如 `dom-pointer-mcp config claude --scope user`）。',
    en: 'Interactive mode requires a TTY. Pass a tool name and --scope explicitly '
      + '(e.g. `dom-pointer-mcp config claude --scope user`).',
  },
} as const;

type TextKey = keyof typeof texts;

type TextValue<K extends TextKey> = (typeof texts)[K]['zh'];

export function t<K extends TextKey>(
  key: K,
): TextValue<K> {
  return texts[key][currentLang] as TextValue<K>;
}
