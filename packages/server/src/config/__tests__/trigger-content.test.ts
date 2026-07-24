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

  it('COMMAND_BODY dispatches every mode to its tool', () => {
    expect(COMMAND_BODY).toContain('get-pointed-element');
    expect(COMMAND_BODY).toContain('list-pointed-selections');
    expect(COMMAND_BODY).toContain('get-pointed-selection');
    expect(COMMAND_BODY).toContain('clear-pointed-selections');
    expect(COMMAND_BODY).toContain('check-update');
    expect(COMMAND_BODY).toContain('EXECUTE mode');
    expect(COMMAND_BODY).toContain('GET mode');
    expect(COMMAND_BODY).toContain('userNote');
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

  it('COMMAND_BODY lists the cross-agent ask-tool mapping in one place', () => {
    expect(COMMAND_BODY).toContain('AskUserQuestion');
    expect(COMMAND_BODY).toContain('request_user_input');
    expect(COMMAND_BODY).toContain('task_ask_question');
    expect(COMMAND_BODY).toContain('ask_question');
    expect(COMMAND_BODY).toContain('Claude Code');
    expect(COMMAND_BODY).toContain('Codex');
    expect(COMMAND_BODY).toContain('JoyCode');
    expect(COMMAND_BODY).toContain('Cursor');
    expect(COMMAND_BODY).toContain('OpenCode');
  });

  it('COMMAND_BODY preserves the fast skill-trigger path', () => {
    expect(COMMAND_BODY).toContain('The user intentionally triggered `/pointed`');
    expect(COMMAND_BODY).toContain('The first action after mode parsing MUST be the exact MCP tool call');
    expect(COMMAND_BODY).toContain('IMMEDIATELY');
  });

  it('COMMAND_BODY dispatches UPDATE mode with check-update parameters', () => {
    expect(COMMAND_BODY).toContain('check-update');
    expect(COMMAND_BODY).toContain('action: "apply"');
    expect(COMMAND_BODY).toContain('action: "check"');
  });

  it('COMMAND_BODY stays lean by delegating per-mode detail to tool descriptions', () => {
    // Guard against the body re-accreting the verbose per-mode instructions
    // that now live in the MCP tool descriptions.
    expect(COMMAND_BODY.length).toBeLessThan(2200);
    expect(COMMAND_BODY).toContain("Each tool's description defines how to act");
  });
});
