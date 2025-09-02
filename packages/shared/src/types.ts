// Shared types for MCP Pointer
export interface ElementPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CSSProperties {
  display: string;
  position: string;
  fontSize: string;
  color: string;
  backgroundColor: string;
}

export interface ComponentInfo {
  name?: string;
  sourceFile?: string;
  framework?: 'react' | 'vue' | 'angular' | 'svelte';
}

export interface TargetedElement {
  selector: string;
  tagName: string;
  id?: string;
  classes: string[];
  innerText: string;
  attributes: Record<string, string>;
  position: ElementPosition;
  cssProperties: CSSProperties;
  componentInfo?: ComponentInfo;
  timestamp: number;
  url: string;
  tabId?: number;
}

// WebSocket message types between extension and MCP server
export enum WebSocketMessageType {
  ELEMENT_SELECTED = 'element-selected',
  ELEMENT_CLEARED = 'element-cleared',
  CONNECTION_TEST = 'connection-test',
  SERVER_STATUS = 'server-status',
}

export interface WebSocketMessage {
  type: WebSocketMessageType;
  data?: any;
  timestamp: number;
}

export interface ElementSelectedMessage extends WebSocketMessage {
  type: WebSocketMessageType.ELEMENT_SELECTED;
  data: TargetedElement;
}

export interface ElementClearedMessage extends WebSocketMessage {
  type: WebSocketMessageType.ELEMENT_CLEARED;
}

export interface ConnectionTestMessage extends WebSocketMessage {
  type: WebSocketMessageType.CONNECTION_TEST;
  data: { ping: boolean };
}

export interface ServerStatusMessage extends WebSocketMessage {
  type: WebSocketMessageType.SERVER_STATUS;
  data: {
    connected: boolean;
    elementsInspected: number;
    uptime: number;
  };
}

// MCP Server status
export interface ServerStatus {
  running: boolean;
  port: number;
  connected: boolean;
  elementsInspected: number;
  uptime: number;
}

// Chrome extension message types
export interface ChromeMessage {
  type: 'toggle-targeting' | 'clear-selection' | 'get-status';
  data?: any;
}

export interface ToggleTargetingMessage extends ChromeMessage {
  type: 'toggle-targeting';
}

export interface ClearSelectionMessage extends ChromeMessage {
  type: 'clear-selection';
}

export interface GetStatusMessage extends ChromeMessage {
  type: 'get-status';
}

// Connection status for ElementSenderService
export enum ConnectionStatus {
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  SENDING = 'sending',
  SENT = 'sent',
  ERROR = 'error',
}
