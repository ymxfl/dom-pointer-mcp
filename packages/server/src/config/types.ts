export type Scope = 'user' | 'project';

export type LaunchMode = 'npx' | 'global';

export type ToolId =
  | 'claude' | 'cursor' | 'windsurf'
  | 'codex' | 'opencode' | 'joycode' | 'generic';

export type Status = 'success' | 'degraded' | 'skipped' | 'failed';

export interface OperationResult {
  status: Status;
  scope?: Scope;
  path?: string;
  message: string;
}

export interface ToolAdapter {
  toolId: ToolId;
  displayName: string | (() => string);

  // Install
  registerMcp(scope: Scope, port: number, launchMode?: LaunchMode): Promise<OperationResult>;
  installCommand?(scope: Scope): Promise<OperationResult>;
  installSkill?(scope: Scope): Promise<OperationResult>;

  // Uninstall (symmetric; idempotent — return 'skipped' when nothing to remove)
  unregisterMcp(scope: Scope): Promise<OperationResult>;
  uninstallCommand?(scope: Scope): Promise<OperationResult>;
  uninstallSkill?(scope: Scope): Promise<OperationResult>;
}

export function resolveDisplayName(adapter: ToolAdapter): string {
  return typeof adapter.displayName === 'function' ? adapter.displayName() : adapter.displayName;
}
