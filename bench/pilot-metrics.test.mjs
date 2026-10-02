import assert from 'node:assert/strict';
import test from 'node:test';
import { summarizeEvents } from './pilot-metrics.mjs';

test('separates observable command time and output from provider token usage', () => {
  const events = [
    { atMs: 0, event: { type: 'turn.started' } },
    { atMs: 10, event: { type: 'item.started', item: { id: 'a', type: 'command_execution' } } },
    { atMs: 30, event: { type: 'item.completed', item: { id: 'a', type: 'command_execution', command: 'npx playwright-scout context coupon', aggregated_output: 'hello', exit_code: 0 } } },
    { atMs: 40, event: { type: 'item.started', item: { id: 'b', type: 'command_execution' } } },
    { atMs: 70, event: { type: 'item.completed', item: { id: 'b', type: 'command_execution', command: 'npx playwright test --grep coupon', aggregated_output: 'failed!', exit_code: 1 } } },
    { atMs: 90, event: { type: 'turn.completed', usage: { input_tokens: 100, cached_input_tokens: 20, output_tokens: 15 } } },
  ];
  const result = summarizeEvents(events, 100);
  assert.deepEqual(result.usage, { input_tokens: 100, output_tokens: 15, cached_input_tokens: 20,
    completed_turns: 1, measured: true, command_count: 2, scout_command_count: 1,
    command_output_chars: 12, command_outputs_missing: 0 });
  assert.deepEqual(result.wall, { agent_elapsed_ms: 100, scout_commands_ms: 20, other_commands_ms: 30,
    model_or_unattributed_ms: 50, turn_span_ms: 90, command_durations_missing: 0 });
  assert.deepEqual(result.commands.map((item) => item.name), ['scout context', 'test_or_check']);
  assert.equal(JSON.stringify(result).includes('coupon'), false);
});

test('marks missing event intervals and telemetry instead of inventing durations', () => {
  const result = summarizeEvents([{ atMs: 8, event: { type: 'item.completed', item: {
    type: 'command_execution', command: 'npm test' } } }], 10);
  assert.equal(result.usage.measured, false);
  assert.equal(result.wall.command_durations_missing, 1);
  assert.equal(result.usage.command_outputs_missing, 1);
  assert.equal(result.commands[0].elapsed_ms, null);
});
