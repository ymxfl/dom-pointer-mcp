import type { ComponentInfo } from '@mcp-pointer/shared/types';

export const EXTRACT_REQUEST_EVENT = 'mcp-pointer:extract-request';
export const EXTRACT_RESPONSE_EVENT = 'mcp-pointer:extract-response';
export const EXTRACT_ID_ATTR = 'data-mcp-pointer-extract-id';
export const DEFAULT_TIMEOUT_MS = 100;

export interface ExtractRequestDetail {
  requestId: string;
}

export interface ExtractResponseDetail {
  requestId: string;
  componentInfo?: ComponentInfo;
}
