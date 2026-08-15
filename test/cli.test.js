import test from 'node:test';
import assert from 'node:assert/strict';
import { parseArgs, validateName } from '../src/cli.js';

test('parseArgs parses command, positional args, and options', () => {
  const result = parseArgs(['logs', 'claire', '--follow']);
  assert.equal(result.command, 'logs');
  assert.deepEqual(result.positionals, ['claire']);
  assert.equal(result.options.follow, true);
});

test('parseArgs parses option values', () => {
  const result = parseArgs(['add', 'client-b', '--token-file', '/tmp/token']);
  assert.equal(result.command, 'add');
  assert.deepEqual(result.positionals, ['client-b']);
  assert.equal(result.options['token-file'], '/tmp/token');
});

test('validateName accepts safe profile names', () => {
  assert.equal(validateName('company-a.dev_1'), 'company-a.dev_1');
});

test('validateName rejects unsafe path-like names', () => {
  assert.throws(() => validateName('../company-a'));
  assert.throws(() => validateName('company/a'));
  assert.throws(() => validateName(''));
});
