const scoutCommand =
  /\b(?:npx\s+)?(?:playwright-scout|scout)\s+(map|context|find|show|impact|plan|init|doctor|review)\b/;
const checkCommand =
  /\b(?:playwright\s+test|vitest|tsc|npm\s+(?:run\s+check|test|run\s+typecheck))\b/;

export function summarizeEvents(timedEvents, agentElapsedMs) {
  const usage = { input_tokens: 0, output_tokens: 0, cached_input_tokens: 0 };
  const commandStarts = new Map();
  const turnStarts = [];
  const commands = [];
  let completedTurns = 0;
  let turnSpanMs = 0;
  for (const { atMs, event } of timedEvents) {
    if (event.type === 'turn.started') turnStarts.push(atMs);
    if (
      event.type === 'item.started' &&
      event.item?.type === 'command_execution' &&
      event.item.id != null
    ) {
      commandStarts.set(event.item.id, atMs);
    }
    if (event.type === 'item.completed' && event.item?.type === 'command_execution') {
      const item = event.item;
      const text = typeof item.command === 'string' ? item.command : '';
      const scout = text.match(scoutCommand);
      const kind = scout ? 'scout' : checkCommand.test(text) ? 'test_or_check' : 'other';
      const started = commandStarts.get(item.id);
      const elapsedMs = typeof started === 'number' ? Math.max(0, atMs - started) : null;
      commandStarts.delete(item.id);
      commands.push({
        kind,
        name: scout ? `scout ${scout[1]}` : kind,
        elapsed_ms: elapsedMs,
        output_chars:
          typeof item.aggregated_output === 'string' ? item.aggregated_output.length : null,
        exit_code: typeof item.exit_code === 'number' ? item.exit_code : null,
      });
    }
    if (event.type !== 'turn.completed' || !event.usage) continue;
    completedTurns++;
    const turnStart = turnStarts.shift();
    if (typeof turnStart === 'number') turnSpanMs += Math.max(0, atMs - turnStart);
    for (const key of Object.keys(usage)) {
      const value = event.usage[key];
      if (typeof value === 'number' && Number.isFinite(value)) usage[key] += value;
    }
  }
  const duration = (kind) =>
    commands
      .filter((item) => item.kind === kind && item.elapsed_ms != null)
      .reduce((sum, item) => sum + item.elapsed_ms, 0);
  const scoutMs = duration('scout');
  const otherCommandMs = duration('test_or_check') + duration('other');
  return {
    usage: {
      ...usage,
      completed_turns: completedTurns,
      measured: completedTurns > 0,
      command_count: commands.length,
      scout_command_count: commands.filter((item) => item.kind === 'scout').length,
      command_output_chars: commands.reduce((sum, item) => sum + (item.output_chars ?? 0), 0),
      command_outputs_missing: commands.filter((item) => item.output_chars == null).length,
    },
    wall: {
      agent_elapsed_ms: agentElapsedMs,
      scout_commands_ms: scoutMs,
      other_commands_ms: otherCommandMs,
      model_or_unattributed_ms: Math.max(0, agentElapsedMs - scoutMs - otherCommandMs),
      turn_span_ms: turnSpanMs,
      command_durations_missing: commands.filter((item) => item.elapsed_ms == null).length,
    },
    commands,
  };
}
