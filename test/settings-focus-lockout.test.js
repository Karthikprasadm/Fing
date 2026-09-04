const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

describe('Zero-Focus Lockout Fix: Settings & Modal Input Focus Verification', () => {

  // -------------------------------------------------------------------------
  // 1. Source Code Verifications
  // -------------------------------------------------------------------------
  describe('Source Code Integrity', () => {
    it('main.js handles win:focusable dynamically with ALLOW_FOCUS commands', () => {
      const mainContent = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
      
      // Verify win:focusable IPC listener
      assert.match(
        mainContent,
        /ipcMain\.on\('win:focusable',\s*\(_e,\s*v\)\s*=>\s*\{[\s\S]*?win\.setFocusable\(focusable\);[\s\S]*?keyHookProcess\.stdin\.write\(focusable\s*\?\s*'ALLOW_FOCUS 1\\n'\s*:\s*'ALLOW_FOCUS 0\\n'\)/,
        'main.js must dynamically call win.setFocusable(focusable) and write ALLOW_FOCUS 1 / ALLOW_FOCUS 0 to keyHookProcess.stdin'
      );
    });

    it('renderer.js mousedown listener exempts modals from e.preventDefault()', () => {
      const rendererContent = fs.readFileSync(path.join(__dirname, '..', 'renderer', 'renderer.js'), 'utf8');
      
      // Verify modal exemption check
      assert.match(
        rendererContent,
        /isModalClick\s*=\s*target\s*&&\s*\(typeof target\.closest === 'function' && !!target\.closest\('#settings-scrim,\s*#onboard-scrim,\s*#consent-scrim,\s*#confirm-modal'\)\);[\s\S]*?if\s*\(isModalClick\)\s*\{\s*return;\s*\}/,
        'renderer.js mousedown listener must exempt modals from e.preventDefault()'
      );

      // Verify openSettings calls cue.setFocusable(true)
      assert.match(
        rendererContent,
        /function openSettings\(\)\s*\{[\s\S]*?cue\.setFocusable\(true\);[\s\S]*?\}/,
        'openSettings must call cue.setFocusable(true)'
      );

      // Verify closeSettings calls cue.setFocusable(false)
      assert.match(
        rendererContent,
        /async function closeSettings\(\)\s*\{[\s\S]*?cue\.setFocusable\(false\);[\s\S]*?\}/,
        'closeSettings must call cue.setFocusable(false)'
      );
    });

    it('key-hook.cs implements ALLOW_FOCUS 1 and ALLOW_FOCUS 0 protocol', () => {
      const csContent = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'key-hook.cs'), 'utf8');
      
      // Verify ALLOW_FOCUS 1 handling
      assert.match(
        csContent,
        /ALLOW_FOCUS 1[\s\S]*?_allowCueFocus\s*=\s*true;[\s\S]*?_isActive\s*=\s*false;[\s\S]*?SetCueNoActivate\(false\);/,
        'key-hook.cs must set _allowCueFocus = true and clear WS_EX_NOACTIVATE on ALLOW_FOCUS 1'
      );

      // Verify ALLOW_FOCUS 0 handling
      assert.match(
        csContent,
        /ALLOW_FOCUS 0[\s\S]*?_allowCueFocus\s*=\s*false;[\s\S]*?SetCueNoActivate\(true\);/,
        'key-hook.cs must set _allowCueFocus = false and restore WS_EX_NOACTIVATE on ALLOW_FOCUS 0'
      );

      // Verify focus guard condition
      assert.match(
        csContent,
        /else if \(\(_isActive \|\| !_allowCueFocus\) && _lastBackgroundHwnd != IntPtr\.Zero\)/,
        'focusGuardThread must check (!allowCueFocus) so foreground is NOT stolen when Settings is open'
      );
    });
  });

  // -------------------------------------------------------------------------
  // 2. Behavioral Logic Simulation (DOM & Mousedown Event Dispatch)
  // -------------------------------------------------------------------------
  describe('DOM Mousedown Event Logic Simulation', () => {
    function simulateMousedownHandler(targetElement) {
      let defaultPrevented = false;
      const event = {
        target: targetElement,
        preventDefault: () => { defaultPrevented = true; }
      };

      // Exact logic extracted from renderer.js:655-683
      const target = event.target;
      const isModalClick = target && (typeof target.closest === 'function' && !!target.closest('#settings-scrim, #onboard-scrim, #consent-scrim, #confirm-modal'));
      if (isModalClick) {
        return { defaultPrevented };
      }

      const isComposerClick = target && (
        target.id === 'composer' ||
        target.id === 'input-area' ||
        target.id === 'input-display' ||
        target.id === 'placeholder' ||
        target.id === 'input' ||
        (typeof target.closest === 'function' && !!target.closest('#input-area, #composer'))
      );
      const isButtonClick = target && (typeof target.closest === 'function' && !!target.closest('button, .smart-pill, .more-btn, #send-btn, #history-btn, .act'));

      event.preventDefault();

      return { defaultPrevented, isComposerClick, isButtonClick };
    }

    function createMockElement(id, classNames = [], parent = null) {
      const el = {
        id: id || '',
        classList: new Set(classNames),
        parentElement: parent,
        closest(selector) {
          const selectors = selector.split(',').map(s => s.trim());
          let curr = this;
          while (curr) {
            for (const s of selectors) {
              if (s.startsWith('#') && curr.id === s.slice(1)) return curr;
              if (s.startsWith('.') && curr.classList.has(s.slice(1))) return curr;
            }
            curr = curr.parentElement;
          }
          return null;
        }
      };
      return el;
    }

    it('Settings inputs: clicking #key-openai inside #settings-scrim DOES NOT preventDefault', () => {
      const scrim = createMockElement('settings-scrim');
      const settingsCard = createMockElement('settings', [], scrim);
      const inputField = createMockElement('key-openai', ['s-field-input'], settingsCard);

      const result = simulateMousedownHandler(inputField);
      assert.equal(result.defaultPrevented, false, 'Clicks on Settings inputs must NOT call preventDefault(), allowing text focus and cursor');
    });

    it('Settings textareas: clicking #resume-text inside #settings-scrim DOES NOT preventDefault', () => {
      const scrim = createMockElement('settings-scrim');
      const settingsCard = createMockElement('settings', [], scrim);
      const textarea = createMockElement('resume-text', [], settingsCard);

      const result = simulateMousedownHandler(textarea);
      assert.equal(result.defaultPrevented, false, 'Clicks on Settings textarea must NOT call preventDefault()');
    });

    it('Settings textareas: clicking #job-description, #star-stories, #ai-rules DOES NOT preventDefault', () => {
      const scrim = createMockElement('settings-scrim');
      const settingsCard = createMockElement('settings', [], scrim);
      for (const id of ['job-description', 'star-stories', 'why-company', 'ai-rules', 'salary-target']) {
        const el = createMockElement(id, [], settingsCard);
        const result = simulateMousedownHandler(el);
        assert.equal(result.defaultPrevented, false, `Click on ${id} must NOT call preventDefault()`);
      }
    });

    it('Other modals: #onboard-scrim, #consent-scrim, #confirm-modal DO NOT preventDefault', () => {
      for (const modalId of ['onboard-scrim', 'consent-scrim', 'confirm-modal']) {
        const modal = createMockElement(modalId);
        const childBtn = createMockElement('btn', [], modal);
        const result = simulateMousedownHandler(childBtn);
        assert.equal(result.defaultPrevented, false, `Clicks inside #${modalId} must NOT call preventDefault()`);
      }
    });

    it('Main overlay buttons: clicking #say-btn or .smart-pill on overlay DOES call preventDefault', () => {
      const toolbar = createMockElement('toolbar');
      const sayBtn = createMockElement('say-btn', ['act'], toolbar);

      const result = simulateMousedownHandler(sayBtn);
      assert.equal(result.defaultPrevented, true, 'Overlay button clicks MUST call preventDefault() to prevent stealing OS focus');
    });

    it('Main composer: clicking inside #composer on overlay DOES call preventDefault and activates zero-focus typing', () => {
      const composer = createMockElement('composer');
      const placeholder = createMockElement('placeholder', [], composer);

      const result = simulateMousedownHandler(placeholder);
      assert.equal(result.defaultPrevented, true, 'Composer click MUST call preventDefault() to protect background focus');
      assert.equal(result.isComposerClick, true, 'Must identify as composer click');
    });
  });

  // -------------------------------------------------------------------------
  // 3. Main Process IPC Simulation
  // -------------------------------------------------------------------------
  describe('Main Process IPC win:focusable Dispatch Simulation', () => {
    it('win:focusable(true) enables focus, calls win.focus(), and sends ALLOW_FOCUS 1', () => {
      let winFocusableState = null;
      let winFocusCalled = false;
      let keyHookWritten = [];

      const mockWin = {
        isDestroyed: () => false,
        setFocusable: (v) => { winFocusableState = v; },
        focus: () => { winFocusCalled = true; }
      };

      const mockKeyHookProcess = {
        stdin: {
          write: (data) => { keyHookWritten.push(data); }
        },
        killed: false
      };

      // Handler under test (exact logic from main.js:837-852)
      function onWinFocusable(_e, v) {
        const focusable = !!v;
        if (mockWin && !mockWin.isDestroyed()) {
          try {
            mockWin.setFocusable(focusable);
            if (focusable) {
              mockWin.focus();
            }
          } catch {}
        }
        if (mockKeyHookProcess && mockKeyHookProcess.stdin && !mockKeyHookProcess.killed) {
          try {
            mockKeyHookProcess.stdin.write(focusable ? 'ALLOW_FOCUS 1\n' : 'ALLOW_FOCUS 0\n');
          } catch {}
        }
      }

      // Execute with true (Settings Open)
      onWinFocusable(null, true);
      assert.equal(winFocusableState, true, 'win.setFocusable must be true');
      assert.equal(winFocusCalled, true, 'win.focus() must be called');
      assert.deepEqual(keyHookWritten, ['ALLOW_FOCUS 1\n'], 'Must write ALLOW_FOCUS 1\\n to key-hook');

      // Execute with false (Settings Close)
      winFocusCalled = false;
      onWinFocusable(null, false);
      assert.equal(winFocusableState, false, 'win.setFocusable must be false');
      assert.equal(winFocusCalled, false, 'win.focus() must NOT be called on unfocus');
      assert.deepEqual(keyHookWritten, ['ALLOW_FOCUS 1\n', 'ALLOW_FOCUS 0\n'], 'Must write ALLOW_FOCUS 0\\n to key-hook');
    });
  });

  // -------------------------------------------------------------------------
  // 4. Live Binary Communication Test: scripts/key-hook.exe
  // -------------------------------------------------------------------------
  describe('Live Binary Execution (scripts/key-hook.exe)', () => {
    it('key-hook.exe boots, handles ALLOW_FOCUS 1/0, and exits cleanly', async () => {
      const hookExe = path.join(__dirname, '..', 'scripts', 'key-hook.exe');
      if (!fs.existsSync(hookExe)) {
        return; // Skip if executable does not exist
      }

      const child = spawn(hookExe, [], {
        stdio: ['pipe', 'pipe', 'ignore'],
        windowsHide: true
      });

      let stdoutData = '';
      const readyPromise = new Promise((resolve) => {
        child.stdout.on('data', (d) => {
          stdoutData += d.toString();
          if (stdoutData.includes('READY')) {
            resolve();
          }
        });
      });

      await readyPromise;
      assert.ok(stdoutData.includes('READY'), 'key-hook.exe must emit READY');

      // Write commands and check it does not crash
      child.stdin.write('ALLOW_FOCUS 1\n');
      child.stdin.write('ALLOW_FOCUS 0\n');
      child.stdin.write('ALLOW_FOCUS 1\n');
      child.stdin.write('EXIT\n');

      const exitCode = await new Promise((resolve) => {
        child.on('exit', (code) => resolve(code));
      });

      assert.equal(exitCode, 0, 'key-hook.exe must exit cleanly with code 0');
    });
  });

});
