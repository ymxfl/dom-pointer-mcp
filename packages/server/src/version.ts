declare const DOM_POINTER_MCP_VERSION: string;

const serverVersion = typeof DOM_POINTER_MCP_VERSION === 'string'
  ? DOM_POINTER_MCP_VERSION
  : '0.0.0-dev';

export default serverVersion;
