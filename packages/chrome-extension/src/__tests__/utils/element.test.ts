import { dedupeElements, getTextSnapshots } from '../../utils/element';

describe('dedupeElements', () => {
  it('returns same list when no duplicates', () => {
    const a = document.createElement('div');
    const b = document.createElement('span');
    expect(dedupeElements([a, b])).toEqual([a, b]);
  });

  it('removes duplicate references keeping first occurrence order', () => {
    const a = document.createElement('div');
    const b = document.createElement('span');
    expect(dedupeElements([a, b, a])).toEqual([a, b]);
  });

  it('returns a new array (does not mutate input)', () => {
    const a = document.createElement('div');
    const input = [a, a];
    const result = dedupeElements(input);
    expect(result).not.toBe(input);
    expect(result).toEqual([a]);
    expect(input).toEqual([a, a]);
  });

  it('handles empty list', () => {
    expect(dedupeElements([])).toEqual([]);
  });
});

describe('getTextSnapshots', () => {
  it('keeps browser-visible text separate from full text content', () => {
    const element = document.createElement('div');
    element.innerText = 'Visible text';
    element.textContent = 'Visible textHidden text';

    expect(getTextSnapshots(element)).toEqual({
      visible: 'Visible text',
      full: 'Visible textHidden text',
    });
  });
});
