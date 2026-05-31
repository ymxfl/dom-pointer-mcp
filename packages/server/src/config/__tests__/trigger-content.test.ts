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

  it('COMMAND_BODY contains tool name and key payload fields', () => {
    expect(COMMAND_BODY).toContain('get-pointed-element');
    expect(COMMAND_BODY).toContain('userNote');
    expect(COMMAND_BODY).toContain('elements[]');
  });

  it('COMMAND_DESCRIPTION mentions pointed elements', () => {
    expect(COMMAND_DESCRIPTION).toContain('pointed elements');
  });

  it('SKILL_DESCRIPTION matches COMMAND_DESCRIPTION (unified content)', () => {
    expect(SKILL_DESCRIPTION).toBe(COMMAND_DESCRIPTION);
  });

  it('SKILL_BODY matches COMMAND_BODY (unified content)', () => {
    expect(SKILL_BODY).toBe(COMMAND_BODY);
  });

  it('COMMAND_BODY documents the textDetail/cssLevel positional convention', () => {
    expect(COMMAND_BODY).toContain('textDetail');
    expect(COMMAND_BODY).toContain('cssLevel');
    expect(COMMAND_BODY).toContain('0-3');
  });

  it('COMMAND_BODY has GET mode with confirmation gate', () => {
    expect(COMMAND_BODY).toContain('GET mode');
    expect(COMMAND_BODY).toContain('Do NOT modify any file until user explicitly says yes');
  });

  it('COMMAND_BODY has EXECUTE mode that acts immediately when userNote present', () => {
    expect(COMMAND_BODY).toContain('EXECUTE mode');
    expect(COMMAND_BODY).toContain('Do NOT ask for confirmation');
  });
});
