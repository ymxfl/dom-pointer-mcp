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
    expect(COMMAND_BODY).toContain('mcp__pointer__get-pointed-element');
    expect(COMMAND_BODY).toContain('userNote');
    expect(COMMAND_BODY).toContain('elements[]');
  });

  it('COMMAND_DESCRIPTION mentions /pointed refinement contract', () => {
    expect(COMMAND_DESCRIPTION).toContain('/pointed');
    expect(COMMAND_DESCRIPTION.toLowerCase()).toContain('refinement');
  });

  it('SKILL_DESCRIPTION lists natural-language triggers and tool name', () => {
    for (const phrase of ['Option+Click', 'mcp__pointer__get-pointed-element', 'userNote']) {
      expect(SKILL_DESCRIPTION).toContain(phrase);
    }
  });

  it('SKILL_BODY mirrors the tool call requirement', () => {
    expect(SKILL_BODY).toContain('mcp__pointer__get-pointed-element');
    expect(SKILL_BODY).toContain('userNote');
    expect(SKILL_BODY).toContain('elements[]');
  });
});
