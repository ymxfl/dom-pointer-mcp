import path from 'path';
import os from 'os';

// Fixed base directory for all shared runtime files (state + screenshots).
// Anchored to the user home directory rather than os.tmpdir() so every
// server process resolves the same path regardless of the TMPDIR env var,
// which can differ between processes and split reads from writes.
// mac/Linux: ~/.dom-pointer-mcp
// Windows:   C:\Users\<user>\.dom-pointer-mcp
export const BASE_DIR = path.join(os.homedir(), '.dom-pointer-mcp');
