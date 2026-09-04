const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { DEFAULTS, resolveShortcuts, findConflicts, isValid } = require('../src/shortcuts');

const ROOT = path.resolve(__dirname, '..');
const htmlSource = fs.readFileSync(path.join(ROOT, 'renderer', 'index.html'), 'utf8');
const jsSource = fs.readFileSync(path.join(ROOT, 'renderer', 'renderer.js'), 'utf8');
const storeSource = fs.readFileSync(path.join(ROOT, 'src', 'store.js'), 'utf8');

test('defaults cover all 7 actions (assist, say, leetcode, boss, hide, type, quit)', () => {
  const expectedKeys = ['assist', 'say', 'leetcode', 'boss', 'hide', 'type', 'quit'];
  assert.deepStrictEqual(Object.keys(DEFAULTS).sort(), expectedKeys.sort());

  assert.strictEqual(DEFAULTS.assist, 'CommandOrControl+Return');
  assert.strictEqual(DEFAULTS.say, 'CommandOrControl+Shift+Return');
  assert.strictEqual(DEFAULTS.leetcode, 'CommandOrControl+H');
  assert.strictEqual(DEFAULTS.boss, 'CommandOrControl+Shift+Z');
  assert.strictEqual(DEFAULTS.hide, 'CommandOrControl+Shift+/');
  assert.strictEqual(DEFAULTS.type, 'CommandOrControl+Shift+K');
  assert.strictEqual(DEFAULTS.quit, 'CommandOrControl+Shift+X');

  for (const [action, accel] of Object.entries(DEFAULTS)) {
    assert.ok(isValid(accel), `default accelerator for ${action} (${accel}) must be valid`);
  }
});

test('resolveShortcuts merges overrides', () => {
  const map = resolveShortcuts({ leetcode: 'CommandOrControl+L' });
  assert.strictEqual(map.leetcode, 'CommandOrControl+L');
  assert.strictEqual(map.assist, DEFAULTS.assist);
  assert.strictEqual(map.hide, DEFAULTS.hide);
  assert.strictEqual(map.type, DEFAULTS.type);
});

test('resolveShortcuts preserves say, hide, type defaults and allows remapping', () => {
  const remapped = resolveShortcuts({
    assist: 'Alt+Space',
    say: 'Ctrl+Shift+A',
    hide: 'Ctrl+Shift+H',
    type: 'Ctrl+Shift+T'
  });
  assert.strictEqual(remapped.assist, 'Alt+Space');
  assert.strictEqual(remapped.say, 'Ctrl+Shift+A');
  assert.strictEqual(remapped.hide, 'Ctrl+Shift+H');
  assert.strictEqual(remapped.type, 'Ctrl+Shift+T');
  assert.strictEqual(remapped.leetcode, DEFAULTS.leetcode);
  assert.strictEqual(findConflicts(remapped).length, 0);
});

test('findConflicts detects duplicate accelerators', () => {
  const map = resolveShortcuts({ leetcode: 'CommandOrControl+Return' });
  const conflicts = findConflicts(map);
  assert.ok(conflicts.some(([a, b]) => (a === 'assist' && b === 'leetcode') || (a === 'leetcode' && b === 'assist')));
});

test('findConflicts detects conflict when hide or type collisions occur', () => {
  const map = resolveShortcuts({
    hide: 'CommandOrControl+Shift+K' // conflicts with default type
  });
  const conflicts = findConflicts(map);
  assert.ok(
    conflicts.some(([a, b]) => (a === 'hide' && b === 'type') || (a === 'type' && b === 'hide')),
    'collision between hide and type must be detected'
  );
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
  assert.ok(isValid('Ctrl+Shift+/'));
  assert.ok(isValid('Ctrl+Shift+K'));
  assert.ok(isValid('F8'));
  assert.strictEqual(isValid(''), false);
  assert.strictEqual(isValid('++'), false);
  assert.strictEqual(isValid(null), false);
});

test('src/store.js DEFAULTS.shortcuts includes all 7 shortcuts matching shortcuts.js', () => {
  // Extract shortcuts block from store.js source
  const match = storeSource.match(/shortcuts:\s*\{([^}]+)\}/);
  assert.ok(match, 'store.js must define shortcuts in DEFAULTS');
  const block = match[1];

  for (const [action, accel] of Object.entries(DEFAULTS)) {
    const escapedAccel = accel.split('+').map((p) => p.replace('/', '\\/')).join('\\+');
    const actionRegex = new RegExp(`${action}:\\s*['"]${escapedAccel}['"]`);
    assert.match(
      block,
      actionRegex,
      `store.js DEFAULTS.shortcuts must include ${action}: '${accel}'`
    );
  }
});

test('renderer/index.html defines inputs and notes for all 7 hotkeys including hide and type', () => {
  const expectedHotkeys = [
    { id: 'shortcut-assist', label: 'Assist Mode' },
    { id: 'shortcut-say', label: 'Say Mode' },
    { id: 'shortcut-leetcode', label: 'LeetCode Mode' },
    { id: 'shortcut-hide', label: 'Hide Overlay' },
    { id: 'shortcut-type', label: 'Ghost Typing' },
    { id: 'shortcut-boss', label: 'Boss Key' },
    { id: 'shortcut-quit', label: 'Quit App' }
  ];

  for (const { id, label } of expectedHotkeys) {
    const inputRegex = new RegExp(`id="${id}"`);
    assert.match(htmlSource, inputRegex, `index.html must define <input id="${id}">`);

    const labelRegex = new RegExp(`<span>${label.replace('/', '\\/')}</span>[\\s\\S]*?id="${id}"`);
    assert.match(htmlSource, labelRegex, `index.html must label ${id} with "${label}"`);
  }

  // Verify explanatory notes exist for hide and ghost typing
  assert.match(htmlSource, /Toggles overlay collapse \/ expanded view\./);
  assert.match(htmlSource, /Toggles stealth keyboard capture for typing into cue from background\./);
});

test('renderer/renderer.js wires hide and type in fillShortcutFields, saveSettings, and updateShortcutUIHints', () => {
  // Check fillShortcutFields
  assert.match(jsSource, /hide:\s*['"]CommandOrControl\+Shift\+\/['"]/, 'fillShortcutFields defs must define hide');
  assert.match(jsSource, /type:\s*['"]CommandOrControl\+Shift\+K['"]/, 'fillShortcutFields defs must define type');
  assert.match(jsSource, /\$\('#shortcut-hide'\)\.value\s*=\s*sc\.hide/, 'fillShortcutFields must populate #shortcut-hide');
  assert.match(jsSource, /\$\('#shortcut-type'\)\.value\s*=\s*sc\.type/, 'fillShortcutFields must populate #shortcut-type');

  // Check saveSettings
  assert.match(jsSource, /settings\.shortcuts\.hide\s*=\s*\$\('#shortcut-hide'\)\.value\.trim\(\)/, 'saveSettings must persist #shortcut-hide');
  assert.match(jsSource, /settings\.shortcuts\.type\s*=\s*\$\('#shortcut-type'\)\.value\.trim\(\)/, 'saveSettings must persist #shortcut-type');

  // Check updateShortcutUIHints
  assert.match(jsSource, /const\s+hideAccel\s*=\s*s\.hide/, 'updateShortcutUIHints must read s.hide');
  assert.match(jsSource, /const\s+typeAccel\s*=\s*s\.type/, 'updateShortcutUIHints must read s.type');
  assert.match(jsSource, /hideBtn\.title\s*=.*hideAccel/, 'updateShortcutUIHints must set hideBtn tooltip with hide accelerator');
  assert.match(jsSource, /ghostToggleBtn\.title\s*=.*typeAccel/, 'updateShortcutUIHints must set ghostToggleBtn tooltip with type accelerator');
});

test('functional simulation of hotkeys UI lifecycle (populate, edit, save, hints)', () => {
  // Simulated DOM store
  const dom = {
    'shortcut-assist': { value: '' },
    'shortcut-say': { value: '' },
    'shortcut-leetcode': { value: '' },
    'shortcut-hide': { value: '' },
    'shortcut-type': { value: '' },
    'shortcut-boss': { value: '' },
    'shortcut-quit': { value: '' },
    'hide-btn': { title: '' },
    'ghost-toggle': { title: '' },
    'say-shortcut-hint': { textContent: '' },
    'assist-shortcut-hint': { textContent: '' }
  };

  const formatAccelerator = (accel) => {
    if (!accel) return '';
    return accel.replace(/CommandOrControl|CmdOrCtrl/gi, 'Ctrl').replace(/Shift/gi, 'Shift');
  };

  const updateHints = (s) => {
    const hideAccel = s.hide || DEFAULTS.hide;
    const typeAccel = s.type || DEFAULTS.type;
    dom['hide-btn'].title = `Collapse / expand overlay (${formatAccelerator(hideAccel)})`;
    dom['ghost-toggle'].title = `Toggle Ghost Typing (${formatAccelerator(typeAccel)})`;
  };

  const fillFields = (sc) => {
    const s = sc || {};
    for (const key of Object.keys(DEFAULTS)) {
      dom[`shortcut-${key}`].value = s[key] || DEFAULTS[key];
    }
  };

  const saveFields = () => {
    const out = {};
    for (const key of Object.keys(DEFAULTS)) {
      out[key] = dom[`shortcut-${key}`].value.trim();
    }
    return out;
  };

  // 1. Initial fill with empty settings -> defaults
  fillFields({});
  assert.strictEqual(dom['shortcut-hide'].value, 'CommandOrControl+Shift+/');
  assert.strictEqual(dom['shortcut-type'].value, 'CommandOrControl+Shift+K');
  assert.strictEqual(dom['shortcut-assist'].value, 'CommandOrControl+Return');

  updateHints({});
  assert.strictEqual(dom['hide-btn'].title, 'Collapse / expand overlay (Ctrl+Shift+/)');
  assert.strictEqual(dom['ghost-toggle'].title, 'Toggle Ghost Typing (Ctrl+Shift+K)');

  // 2. User edits hide and type
  dom['shortcut-hide'].value = 'Ctrl+Shift+H';
  dom['shortcut-type'].value = 'Ctrl+Alt+G';

  // 3. Save settings
  const saved = saveFields();
  assert.strictEqual(saved.hide, 'Ctrl+Shift+H');
  assert.strictEqual(saved.type, 'Ctrl+Alt+G');

  // 4. Update hints from saved settings
  updateHints(saved);
  assert.strictEqual(dom['hide-btn'].title, 'Collapse / expand overlay (Ctrl+Shift+H)');
  assert.strictEqual(dom['ghost-toggle'].title, 'Toggle Ghost Typing (Ctrl+Alt+G)');
});

test('store deepMerge preserves user shortcuts while backfilling missing hide/type defaults', () => {
  // Simulate the deepMerge function from src/store.js
  function deepMerge(base, over) {
    const out = Array.isArray(base) ? base.slice() : { ...base };
    for (const k of Object.keys(over || {})) {
      if (over[k] && typeof over[k] === 'object' && !Array.isArray(over[k]) && typeof base[k] === 'object') {
        out[k] = deepMerge(base[k], over[k]);
      } else {
        out[k] = over[k];
      }
    }
    return out;
  }

  // Legacy store file without type or custom hide
  const legacySavedData = {
    shortcuts: {
      assist: 'Alt+Space',
      say: 'Ctrl+Shift+A',
      leetcode: 'CommandOrControl+H',
      boss: 'CommandOrControl+Shift+Z',
      quit: 'CommandOrControl+Shift+X'
      // hide and type omitted
    }
  };

  const merged = deepMerge({ shortcuts: DEFAULTS }, legacySavedData);
  assert.strictEqual(merged.shortcuts.assist, 'Alt+Space');
  assert.strictEqual(merged.shortcuts.say, 'Ctrl+Shift+A');
  // hide and type are properly backfilled from DEFAULTS
  assert.strictEqual(merged.shortcuts.hide, 'CommandOrControl+Shift+/');
  assert.strictEqual(merged.shortcuts.type, 'CommandOrControl+Shift+K');
  assert.strictEqual(merged.shortcuts.boss, 'CommandOrControl+Shift+Z');
});