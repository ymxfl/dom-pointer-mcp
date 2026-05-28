import {
  TRIGGER_NAME,
  TRIGGER_DESCRIPTION,
  TRIGGER_BODY,
} from '../trigger-content';

describe('trigger content sanity', () => {
  it('contains all required trigger phrases and concepts', () => {
    expect(TRIGGER_NAME).toBe('pointed');
    const phrases = [
      'pointed',
      'Option+Click',
      'mcp__pointer__get-pointed-element',
      'userNote',
    ];
    phrases.forEach((p) => {
      expect(TRIGGER_DESCRIPTION).toContain(p);
    });
    expect(TRIGGER_BODY).toContain('mcp__pointer__get-pointed-element');
    expect(TRIGGER_BODY).toContain('userNote');
    expect(TRIGGER_BODY).toContain('elements[]');
  });
});
