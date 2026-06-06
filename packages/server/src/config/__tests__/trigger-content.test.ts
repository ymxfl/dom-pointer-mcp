import {
  TRIGGER_NAME,
  COMMAND_DESCRIPTION,
  COMMAND_BODY,
  SKILL_DESCRIPTION,
  SKILL_BODY,
  COMMAND_BODY_CLAUDE,
  SKILL_BODY_CLAUDE,
  COMMAND_BODY_JOYCODE,
  SKILL_BODY_JOYCODE,
  COMMAND_BODY_CURSOR,
  SKILL_BODY_CURSOR,
  COMMAND_BODY_OPENCODE,
  COMMAND_BODY_CODEX,
} from '../trigger-content';

describe('trigger content sanity', () => {
  it('TRIGGER_NAME is "pointed"', () => {
    expect(TRIGGER_NAME).toBe('pointed');
  });

  it('COMMAND_BODY contains tool name and key payload fields', () => {
    expect(COMMAND_BODY).toContain('get-pointed-element');
    expect(COMMAND_BODY).toContain('list-pointed-selections');
    expect(COMMAND_BODY).toContain('get-pointed-selection');
    expect(COMMAND_BODY).toContain('clear-pointed-selections');
    expect(COMMAND_BODY).toContain('userNote');
    expect(COMMAND_BODY).toContain('selectionId');
    expect(COMMAND_BODY).toContain('screenshot.path');
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

  it('COMMAND_BODY has GET mode with plain-text confirmation gate', () => {
    expect(COMMAND_BODY).toContain('GET mode');
    expect(COMMAND_BODY).toContain('Determine mode BEFORE calling the tool');
    expect(COMMAND_BODY).toContain('Do NOT take ANY other action');
    expect(COMMAND_BODY).toContain('STOP HERE');
    expect(COMMAND_BODY).not.toContain('AskUserQuestion');
  });

  it('COMMAND_BODY has EXECUTE mode that acts immediately when userNote present', () => {
    expect(COMMAND_BODY).toContain('EXECUTE mode');
    expect(COMMAND_BODY).toContain('Do NOT ask for confirmation');
  });

  it('COMMAND_BODY preserves the fast skill-trigger path', () => {
    expect(COMMAND_BODY).toContain('The user intentionally triggered `/pointed`');
    expect(COMMAND_BODY).toContain('The first action after mode parsing MUST be the exact MCP tool call');
    expect(COMMAND_BODY).toContain('call `get-pointed-element` IMMEDIATELY');
  });

  it('COMMAND_BODY_CLAUDE uses AskUserQuestion for GET mode confirmation', () => {
    expect(COMMAND_BODY_CLAUDE).toContain('GET mode');
    expect(COMMAND_BODY_CLAUDE).toContain('AskUserQuestion');
    expect(COMMAND_BODY_CLAUDE).toContain('STOP HERE');
  });

  it('SKILL_BODY_CLAUDE matches COMMAND_BODY_CLAUDE', () => {
    expect(SKILL_BODY_CLAUDE).toBe(COMMAND_BODY_CLAUDE);
  });

  it('Claude body shares EXECUTE mode with generic body', () => {
    expect(COMMAND_BODY_CLAUDE).toContain('EXECUTE mode');
    expect(COMMAND_BODY_CLAUDE).toContain('Do NOT ask for confirmation');
  });

  it('COMMAND_BODY_JOYCODE uses task_ask_question for GET mode confirmation', () => {
    expect(COMMAND_BODY_JOYCODE).toContain('GET mode');
    expect(COMMAND_BODY_JOYCODE).toContain('task_ask_question');
    expect(COMMAND_BODY_JOYCODE).toContain('STOP HERE');
  });

  it('SKILL_BODY_JOYCODE matches COMMAND_BODY_JOYCODE', () => {
    expect(SKILL_BODY_JOYCODE).toBe(COMMAND_BODY_JOYCODE);
  });

  it('JoyCode body shares EXECUTE mode with generic body', () => {
    expect(COMMAND_BODY_JOYCODE).toContain('EXECUTE mode');
    expect(COMMAND_BODY_JOYCODE).toContain('Do NOT ask for confirmation');
  });

  it('COMMAND_BODY_CURSOR uses ask_question for GET mode confirmation', () => {
    expect(COMMAND_BODY_CURSOR).toContain('GET mode');
    expect(COMMAND_BODY_CURSOR).toContain('ask_question');
    expect(COMMAND_BODY_CURSOR).not.toContain('AskUserQuestion');
    expect(COMMAND_BODY_CURSOR).toContain('STOP HERE');
  });

  it('SKILL_BODY_CURSOR matches COMMAND_BODY_CURSOR', () => {
    expect(SKILL_BODY_CURSOR).toBe(COMMAND_BODY_CURSOR);
  });

  it('COMMAND_BODY_OPENCODE uses AskUserQuestion for GET mode confirmation', () => {
    expect(COMMAND_BODY_OPENCODE).toContain('GET mode');
    expect(COMMAND_BODY_OPENCODE).toContain('AskUserQuestion');
    expect(COMMAND_BODY_OPENCODE).toContain('STOP HERE');
  });

  it('COMMAND_BODY_CODEX uses request_user_input for GET mode confirmation', () => {
    expect(COMMAND_BODY_CODEX).toContain('GET mode');
    expect(COMMAND_BODY_CODEX).toContain('request_user_input');
    expect(COMMAND_BODY_CODEX).toContain('STOP HERE');
  });
});
