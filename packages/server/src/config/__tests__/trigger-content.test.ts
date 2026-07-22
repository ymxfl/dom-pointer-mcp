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
    expect(COMMAND_BODY).toContain('list-pointed-selections');
    expect(COMMAND_BODY).toContain('get-pointed-selection');
    expect(COMMAND_BODY).toContain('clear-pointed-selections');
    expect(COMMAND_BODY).toContain('check-update');
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

  it('COMMAND_BODY has GET mode with confirmation gate', () => {
    expect(COMMAND_BODY).toContain('GET mode');
    expect(COMMAND_BODY).toContain('Determine mode BEFORE calling the tool');
    expect(COMMAND_BODY).toContain('Do NOT take ANY other action');
    expect(COMMAND_BODY).toContain('STOP HERE');
  });

  it('COMMAND_BODY GET mode lists cross-agent ask-tool mapping', () => {
    expect(COMMAND_BODY).toContain('AskUserQuestion');
    expect(COMMAND_BODY).toContain('request_user_input');
    expect(COMMAND_BODY).toContain('task_ask_question');
    expect(COMMAND_BODY).toContain('ask_question');
    expect(COMMAND_BODY).toContain('Claude Code');
    expect(COMMAND_BODY).toContain('Codex');
    expect(COMMAND_BODY).toContain('JoyCode');
    expect(COMMAND_BODY).toContain('Cursor');
    expect(COMMAND_BODY).toContain('OpenCode');
    expect(COMMAND_BODY).toContain('Any other agent');
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

  it('COMMAND_BODY documents UPDATE mode with check-update parameters', () => {
    expect(COMMAND_BODY).toContain('UPDATE mode');
    expect(COMMAND_BODY).toContain('check-update');
    expect(COMMAND_BODY).toContain('action: "apply"');
    expect(COMMAND_BODY).toContain('action: "check"');
  });
});
