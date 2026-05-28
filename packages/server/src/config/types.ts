export type Scope = 'user' | 'project';

export type ToolId =
  | 'claude' | 'cursor' | 'windsurf'
  | 'codex' | 'opencode' | 'joycode';

export type Status = 'success' | 'degraded' | 'skipped' | 'failed';

export interface OperationResult {
  status: Status;
  scope?: Scope;
  path?: string;
  message: string;
}

export interface ToolAdapter {
  toolId: ToolId;
  displayName: string;
  registerMcp(scope: Scope, port: number): Promise<OperationResult>;
  installCommand(scope: Scope): Promise<OperationResult>;
  installSkill?(scope: Scope): Promise<OperationResult>;
}
