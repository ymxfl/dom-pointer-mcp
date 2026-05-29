import {
  ElementPosition,
  CSSProperties,
  ComponentInfo,
  RawPointedSelection,
} from '@dom-pointer-mcp/shared/types';

// Server-processed data (extracted & enhanced)
export interface ProcessedPointedDOMElement {
  // Extracted from HTML
  tagName: string;
  id?: string;
  classes: string[];
  attributes: Record<string, string>;
  innerText: string;
  selector: string;

  // Context data
  position: ElementPosition;
  url: string;
  timestamp: string; // ISO format

  // Full CSS data for shaping
  cssComputed?: Record<string, string>; // Full computed styles
  componentInfo?: ComponentInfo;

  // Text content (full, including hidden nodes)
  textContent?: string;

  // Processing metadata
  warnings?: string[];
}

export interface SerializedDOMElement {
  selector: string;
  tagName: string;
  id?: string;
  classes: string[];
  attributes: Record<string, string>;
  position: ElementPosition;
  url: string;
  timestamp: string;
  innerText: string;
  textContent?: string;
  cssProperties?: CSSProperties;
  componentInfo?: ComponentInfo;
  warnings?: string[];
}

// Selection batch: multiple elements + shared user note
export interface ProcessedPointedSelection {
  userNote: string;
  url: string;
  timestamp: string;
  elements: ProcessedPointedDOMElement[];
}

export interface SerializedSelection {
  userNote: string;
  url: string;
  timestamp: string;
  elements: SerializedDOMElement[];
}

// State data structure
export interface SharedStateData {
  rawPointedSelection: RawPointedSelection;
  processedPointedSelection: ProcessedPointedSelection;
  metadata: {
    receivedAt: string;
    messageType: string;
  };
}

// Storage format
export interface SharedState {
  data: SharedStateData;
}
