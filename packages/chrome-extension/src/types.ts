import type { ComponentInfo, ElementPosition, CSSProperties } from './element-utils';

export enum OverlayType {
  SELECTION = 'selection',
  HOVER = 'hover',
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
}
