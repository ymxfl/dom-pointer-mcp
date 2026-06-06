import { formatLocalTimestamp } from '../../utils/time';

describe('formatLocalTimestamp', () => {
  it('formats timestamps with the local timezone offset instead of UTC Z', () => {
    const result = formatLocalTimestamp(1672531200000);

    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}[+-]\d{2}:\d{2}$/);
    expect(result.endsWith('Z')).toBe(false);
  });
});
