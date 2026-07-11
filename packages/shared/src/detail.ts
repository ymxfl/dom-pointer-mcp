import { CSSDetailLevel, TextDetailLevel } from './types';

function getEnumNumberValues<T extends Record<string, string | number>>(enumObj: T): number[] {
  return Object.values(enumObj).filter((value): value is number => typeof value === 'number');
}

export const TEXT_DETAIL_OPTIONS: readonly TextDetailLevel[] = Object.freeze(
  getEnumNumberValues(TextDetailLevel) as TextDetailLevel[],
);

export const CSS_DETAIL_OPTIONS: readonly CSSDetailLevel[] = Object.freeze(
  getEnumNumberValues(CSSDetailLevel) as CSSDetailLevel[],
);

export const CSS_LEVEL_1_FIELDS: readonly string[] = [
  'display',
  'position',
  'font-size',
  'color',
  'background-color',
];

const CSS_LEVEL_2_EXTRA_FIELDS = [
  'margin',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'padding',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'line-height',
  'text-align',
  'font-weight',
  'font-family',
  'width',
  'height',
  'min-width',
  'max-width',
  'min-height',
  'max-height',
  'border',
  'border-top',
  'border-right',
  'border-bottom',
  'border-left',
  'border-radius',
  'border-top-left-radius',
  'border-top-right-radius',
  'border-bottom-right-radius',
  'border-bottom-left-radius',
  'box-sizing',
  'flex-direction',
  'justify-content',
  'align-items',
  'gap',
  'overflow',
  'overflow-x',
  'overflow-y',
] as const;

export const CSS_LEVEL_2_FIELDS: readonly string[] = Object.freeze([
  ...CSS_LEVEL_1_FIELDS,
  ...CSS_LEVEL_2_EXTRA_FIELDS,
]);

export const CSS_LEVEL_FIELD_MAP: Record<
Exclude<CSSDetailLevel, CSSDetailLevel.NONE>,
readonly string[]
> = Object.freeze({
  [CSSDetailLevel.BASIC]: CSS_LEVEL_1_FIELDS,
  [CSSDetailLevel.BOX_MODEL]: CSS_LEVEL_2_FIELDS,
  [CSSDetailLevel.FULL]: [],
});

export function isValidTextDetail(detail: unknown): detail is TextDetailLevel {
  return typeof detail === 'number' && (TEXT_DETAIL_OPTIONS as readonly number[]).includes(detail);
}

export function isValidCSSLevel(level: unknown): level is CSSDetailLevel {
  return typeof level === 'number' && (CSS_DETAIL_OPTIONS as readonly number[]).includes(level);
}
