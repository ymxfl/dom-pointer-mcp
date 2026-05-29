import readline from 'readline';
import type { Scope } from './types';

function promptScope(): Promise<Scope> {
  const rl = readline.createInterface({
    input: process.stdin, output: process.stdout,
  });
  return new Promise((resolve, reject) => {
    rl.question(
      'Install scope:\n  1) user — global, all projects\n  2) project — current directory only\nChoice [1-2]: ',
      (answer) => {
        rl.close();
        const trimmed = answer.trim().toLowerCase();
        if (trimmed === '1' || trimmed === 'user') resolve('user');
        else if (trimmed === '2' || trimmed === 'project') resolve('project');
        else reject(new Error(`Invalid choice: ${answer}`));
      },
    );
  });
}

export async function resolveScope(scopeArg?: string): Promise<Scope> {
  if (scopeArg) {
    if (scopeArg === 'user' || scopeArg === 'project') return scopeArg;
    throw new Error(`Invalid --scope: ${scopeArg}. Use 'user' or 'project'.`);
  }
  if (!process.stdin.isTTY) {
    throw new Error(
      'No --scope provided and no TTY for interactive prompt.\n'
      + 'Please pass --scope user or --scope project.',
    );
  }
  return promptScope();
}
