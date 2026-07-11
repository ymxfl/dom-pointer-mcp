import parsePort from '../../utils/port';

describe('parsePort', () => {
  it.each(['7007', 7007, '1', 65535])('accepts valid port %p', (value) => {
    expect(parsePort(value)).toBe(Number(value));
  });

  it.each(['nope', '', '1.5', 0, -1, 65536])('rejects invalid port %p', (value) => {
    expect(() => parsePort(value)).toThrow(/Invalid port/u);
  });
});
