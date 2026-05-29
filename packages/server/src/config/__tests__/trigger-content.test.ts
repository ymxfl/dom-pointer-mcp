import {
  TRIGGER_NAME,
  COMMAND_DESCRIPTION,
  COMMAND_BODY,
  SKILL_DESCRIPTION,
  SKILL_BODY,
} from '../trigger-content';

describe('trigger content sanity', () => {
  it('TRIGGER_NAME is "pointed"', () => {
    expect(TRIGGER_NAME).toBe('pointed');
  });

  it('COMMAND_BODY calls the MCP tool and explains userNote', () => {
    expect(COMMAND_BODY).toContain('mcp__dom-pointer__get-pointed-element');
    expect(COMMAND_BODY).toContain('userNote');
    expect(COMMAND_BODY).toContain('elements[]');
  });

  it('COMMAND_DESCRIPTION mentions /pointed refinement contract', () => {
    expect(COMMAND_DESCRIPTION).toContain('/pointed');
    expect(COMMAND_DESCRIPTION.toLowerCase()).toContain('refinement');
  });

  it('SKILL_DESCRIPTION lists natural-language triggers and tool name', () => {
    ['Option+Click', 'mcp__dom-pointer__get-pointed-element', 'userNote'].forEach((phrase) => {
      expect(SKILL_DESCRIPTION).toContain(phrase);
    });
  });

  it('SKILL_BODY mirrors the tool call requirement', () => {
    expect(SKILL_BODY).toContain('mcp__dom-pointer__get-pointed-element');
    expect(SKILL_BODY).toContain('userNote');
    expect(SKILL_BODY).toContain('elements[]');
  });

  it('COMMAND_BODY documents the textDetail/cssLevel positional convention', () => {
    expect(COMMAND_BODY).toContain('textDetail');
    expect(COMMAND_BODY).toContain('cssLevel');
    expect(COMMAND_BODY).toContain('0-3');
  });

  it('SKILL_BODY documents the textDetail/cssLevel positional convention', () => {
    expect(SKILL_BODY).toContain('textDetail');
    expect(SKILL_BODY).toContain('cssLevel');
    expect(SKILL_BODY).toContain('0-3');
  });
});
