const test = require('node:test');
const assert = require('node:assert');
const { DEFAULTS, resolveShortcuts, findConflicts, isValid } = require('../src/shortcuts');

test('defaults cover the core actions', () => {
  assert.strictEqual(DEFAULTS.assist, 'CommandOrControl+Return');
  assert.ok(DEFAULTS.leetcode);
  assert.ok(DEFAULTS.quit);
});

test('resolveShortcuts merges overrides', () => {
  const map = resolveShortcuts({ leetcode: 'CommandOrControl+L' });
  assert.strictEqual(map.leetcode, 'CommandOrControl+L');
  assert.strictEqual(map.assist, DEFAULTS.assist);
});

test('findConflicts detects duplicate accelerators', () => {
  const map = resolveShortcuts({ leetcode: 'CommandOrControl+Return' });
  const conflicts = findConflicts(map);
  assert.ok(conflicts.some(([a, b]) => (a === 'assist' && b === 'leetcode') || (a === 'leetcode' && b === 'assist')));
});

test('no conflicts in the default set', () => {
  assert.strictEqual(findConflicts(resolveShortcuts()).length, 0);
});

test('isValid accepts good accelerators and rejects junk', () => {
  assert.ok(isValid('CommandOrControl+Return'));
  assert.ok(isValid('Shift+Q'));
  assert.ok(isValid('F1'));
  assert.ok(isValid('Alt+Space'));
  assert.ok(isValid('Ctrl+Shift+A'));
  assert.ok(isValid('F8'));
  assert.strictEqual(isValid(''), false);
  assert.strictEqual(isValid('++'), false);
  assert.strictEqual(isValid(null), false);
});

test('resolveShortcuts preserves say default and allows remapping', () => {
  assert.strictEqual(DEFAULTS.say, 'CommandOrControl+Shift+Return');
  const remapped = resolveShortcuts({
    assist: 'Alt+Space',
    say: 'Ctrl+Shift+A'
  });
  assert.strictEqual(remapped.assist, 'Alt+Space');
  assert.strictEqual(remapped.say, 'Ctrl+Shift+A');
  assert.strictEqual(remapped.leetcode, DEFAULTS.leetcode);
  assert.strictEqual(findConflicts(remapped).length, 0);
});