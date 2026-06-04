export enum TextDetailLevel {
  NONE = 0,
  VISIBLE = 1,
  FULL = 2,
}

export enum CSSDetailLevel {
  NONE = 0,
  BASIC = 1,
  BOX_MODEL = 2,
  FULL = 3,
}

export const DEFAULT_TEXT_DETAIL: TextDetailLevel = TextDetailLevel.FULL;

export const DEFAULT_CSS_LEVEL: CSSDetailLevel = CSSDetailLevel.BASIC;

export interface TextSnapshots {
  visible: string;
  full: string;
}

export interface ElementPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type CSSProperties = Record<string, string>;

export interface ComponentInfo {
  name?: string;
  sourceFile?: string;
  framework?: 'react' | 'vue' | 'angular' | 'svelte';
  ancestors?: ComponentAncestor[];
}

export interface ComponentAncestor {
  name: string;
  sourceFile?: string;
}

export interface TargetedElement {
  selector: string;
  tagName: string;
  id?: string;
  classes: string[];
  innerText?: string;
  textContent?: string;
  textDetail?: TextDetailLevel;
  textVariants?: TextSnapshots;
  attributes: Record<string, string>;
  position: ElementPosition;
  cssLevel?: CSSDetailLevel;
  cssProperties?: CSSProperties;
  cssComputed?: Record<string, string>;
  componentInfo?: ComponentInfo;
  timestamp: number;
  url: string;
  tabId?: number;
}

// Raw data from browser (minimal, fail-safe)
export interface RawPointedDOMElement {
  // Core data (mandatory)
  outerHTML: string;
  url: string;
  timestamp: number;

  // Position data (optional but highly recommended)
  boundingClientRect?: DOMRect;

  // Optional enhanced data
  computedStyles?: Record<string, string>;
  componentInfo?: ComponentInfo;
}

// Selection batch wire format: multiple elements + shared user note
export interface RawPointedSelection {
  url: string;
  timestamp: number;
  userNote: string;
  elements: RawPointedDOMElement[];
}

// Pointer message types between extension and MCP server
export enum PointerMessageType {
  LEGACY_ELEMENT_SELECTED = 'element-selected',
  DOM_ELEMENT_POINTED = 'dom-element-pointed',
  SELECTION_SENT = 'selection-sent',
}

export interface PointerMessage {
  type: PointerMessageType;
  data?: any;
  timestamp: number;
}

// Connection status for ElementSenderService
export enum ConnectionStatus {
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  SENDING = 'sending',
  SENT = 'sent',
  ERROR = 'error',
}
