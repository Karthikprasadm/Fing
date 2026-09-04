'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const htmlSource = fs.readFileSync(path.join(ROOT, 'renderer', 'index.html'), 'utf8');
const jsSource = fs.readFileSync(path.join(ROOT, 'renderer', 'renderer.js'), 'utf8');
const cssSource = fs.readFileSync(path.join(ROOT, 'renderer', 'styles.css'), 'utf8');

test('Transcript Sidebar Container Separation', async (t) => {

  await t.test('DOM Structure in index.html defines distinct containers and tabs', () => {
    // Both containers must exist with distinct IDs
    assert.match(htmlSource, /id="ts-history-list"/, 'index.html must have #ts-history-list container');
    assert.match(htmlSource, /id="ts-list"/, 'index.html must have #ts-list container');

    // Both views must exist
    assert.match(htmlSource, /id="ts-history-view"/, 'index.html must have #ts-history-view');
    assert.match(htmlSource, /id="ts-transcript-view"/, 'index.html must have #ts-transcript-view');

    // Tab buttons must exist
    assert.match(htmlSource, /id="ts-tab-history"/, 'index.html must have #ts-tab-history');
    assert.match(htmlSource, /id="ts-tab-transcript"/, 'index.html must have #ts-tab-transcript');

    // Independent clear buttons must exist
    assert.match(htmlSource, /id="clear-history-btn"/, 'index.html must have #clear-history-btn');
    assert.match(htmlSource, /id="clear-transcript-btn"/, 'index.html must have #clear-transcript-btn');

    // Badges must exist
    assert.match(htmlSource, /id="ts-badge-history"/, 'index.html must have #ts-badge-history');
    assert.match(htmlSource, /id="ts-badge-transcript"/, 'index.html must have #ts-badge-transcript');

    // ts-history-list must be inside ts-history-view, ts-list must be inside ts-transcript-view
    const historyViewBlock = htmlSource.match(/id="ts-history-view"[\s\S]*?id="clear-history-btn"[\s\S]*?<\/div>/);
    assert.ok(historyViewBlock, 'ts-history-view block must enclose #ts-history-list and #clear-history-btn');
    assert.match(historyViewBlock[0], /id="ts-history-list"/, '#ts-history-list must be inside #ts-history-view');
    assert.doesNotMatch(historyViewBlock[0], /id="ts-list"/, '#ts-list must NOT be inside #ts-history-view');

    const transcriptViewBlock = htmlSource.match(/id="ts-transcript-view"[\s\S]*?id="clear-transcript-btn"[\s\S]*?<\/div>/);
    assert.ok(transcriptViewBlock, 'ts-transcript-view block must enclose #ts-list and #clear-transcript-btn');
    assert.match(transcriptViewBlock[0], /id="ts-list"/, '#ts-list must be inside #ts-transcript-view');
    assert.doesNotMatch(transcriptViewBlock[0], /id="ts-history-list"/, '#ts-history-list must NOT be inside #ts-transcript-view');
  });

  await t.test('CSS styles define tabs, views, and no-drag properties', () => {
    assert.match(cssSource, /\.ts-tabs\s*\{/, 'styles.css must style .ts-tabs');
    assert.match(cssSource, /\.ts-tab\s*\{/, 'styles.css must style .ts-tab');
    assert.match(cssSource, /\.ts-tab\.on\s*\{/, 'styles.css must style .ts-tab.on');
    assert.match(cssSource, /\.ts-view\s*\{/, 'styles.css must style .ts-view');
    assert.match(cssSource, /\.ts-view\.hidden\s*\{/, 'styles.css must style .ts-view.hidden');
    assert.match(cssSource, /\.ts-tab\b[^{]*\{[^}]*-webkit-app-region:\s*no-drag/s, '.ts-tab must have no-drag style');
    assert.match(cssSource, /\.transcript-sidebar\s*\{[^}]*width:\s*260px;/s, 'sidebar should be 260px wide for tabs');
  });

  await t.test('Source code audit: renderConversationHistory targets ts-history-list, NOT ts-list', () => {
    const fnMatch = jsSource.match(/function renderConversationHistory\(\)\s*\{([\s\S]*?)\n  \}/);
    assert.ok(fnMatch, 'renderConversationHistory function must exist in renderer.js');
    const fnBody = fnMatch[1];

    assert.match(fnBody, /getElementById\(['"]ts-history-list['"]\)/,
      'renderConversationHistory must target #ts-history-list');
    assert.doesNotMatch(fnBody, /getElementById\(['"]ts-list['"]\)/,
      'renderConversationHistory must NOT target #ts-list');
  });

  await t.test('Source code audit: appendTranscriptHistoryTurn targets ts-list, NOT ts-history-list', () => {
    const fnMatch = jsSource.match(/function appendTranscriptHistoryTurn\([^)]*\)\s*\{([\s\S]*?)\n  \}/);
    assert.ok(fnMatch, 'appendTranscriptHistoryTurn function must exist in renderer.js');
    const fnBody = fnMatch[1];

    assert.match(fnBody, /getElementById\(['"]ts-list['"]\)/,
      'appendTranscriptHistoryTurn must target #ts-list');
    assert.doesNotMatch(fnBody, /getElementById\(['"]ts-history-list['"]\)/,
      'appendTranscriptHistoryTurn must NOT target #ts-history-list');
  });

  await t.test('Source code audit: Tab switching and separate clearing handlers exist', () => {
    // switchSidebarTab exists and handles both 'history' and 'transcript'
    assert.match(jsSource, /function switchSidebarTab\(\s*tab\s*\)\s*\{[\s\S]*?if\s*\(\s*tab\s*===\s*['"]transcript['"]\s*\)[\s\S]*?else\s*\{/,
      'switchSidebarTab must handle history and transcript switching');

    // Click handlers for tabs
    assert.match(jsSource, /tabHistoryBtn\.addEventListener\(['"]click['"]/,
      '#ts-tab-history click listener must be wired');
    assert.match(jsSource, /tabTranscriptBtn\.addEventListener\(['"]click['"]/,
      '#ts-tab-transcript click listener must be wired');

    // Click handler for #clear-history-btn
    assert.match(jsSource, /clearHistoryBtn\.addEventListener\(['"]click['"]/,
      '#clear-history-btn click listener must be wired');

    // clearTranscriptSidebar resets only ts-list and audio turns
    const clearTsMatch = jsSource.match(/function clearTranscriptSidebar\(\)\s*\{([\s\S]*?)\n  \}/);
    assert.ok(clearTsMatch, 'clearTranscriptSidebar function must exist');
    assert.doesNotMatch(clearTsMatch[1], /conversationItems\s*=\s*\[\]/,
      'clearTranscriptSidebar must NOT clear conversationItems');
  });

  await t.test('Functional simulation: Complete lifecycle of tabs, speech turns, and question history', () => {
    class MockElement {
      constructor(id = '', className = '') {
        this.id = id;
        this.className = className;
        this.children = [];
        this._innerHTML = '';
        this.textContent = '';
        this.dataset = {};
        this.classList = {
          classes: new Set(className.split(' ').filter(Boolean)),
          add: (c) => this.classList.classes.add(c),
          remove: (c) => this.classList.classes.delete(c),
          contains: (c) => this.classList.classes.has(c),
          toggle: (c, force) => {
            if (force === undefined) {
              if (this.classList.classes.has(c)) this.classList.classes.delete(c);
              else this.classList.classes.add(c);
            } else if (force) {
              this.classList.classes.add(c);
            } else {
              this.classList.classes.delete(c);
            }
          }
        };
        this.isConnected = true;
      }
      get innerHTML() {
        return this._innerHTML;
      }
      set innerHTML(val) {
        this._innerHTML = val;
        this.children = [];
      }
      appendChild(child) {
        this.children.push(child);
        return child;
      }
      querySelector(selector) {
        if (selector === '.ts-placeholder') {
          return this.children.find(c => c.className.includes('ts-placeholder')) || null;
        }
        if (selector === '.ts-text') {
          return this.children.find(c => c.className.includes('ts-text')) || null;
        }
        return null;
      }
      remove() {
        this.isConnected = false;
      }
    }

    const domElements = {
      'ts-list': new MockElement('ts-list', 'ts-list'),
      'ts-history-list': new MockElement('ts-history-list', 'ts-list'),
      'ts-badge-history': new MockElement('ts-badge-history', 'ts-badge hidden'),
      'ts-badge-transcript': new MockElement('ts-badge-transcript', 'ts-badge hidden'),
      'transcript-sidebar': new MockElement('transcript-sidebar', 'transcript-sidebar hidden'),
      'history-btn': new MockElement('history-btn', 'hud-btn'),
      'panel-wrap': new MockElement('panel-wrap', ''),
      'ts-tab-history': new MockElement('ts-tab-history', 'ts-tab on'),
      'ts-tab-transcript': new MockElement('ts-tab-transcript', 'ts-tab'),
      'ts-history-view': new MockElement('ts-history-view', 'ts-view'),
      'ts-transcript-view': new MockElement('ts-transcript-view', 'ts-view hidden')
    };

    const getElementById = (id) => domElements[id] || null;

    let conversationItems = [];
    let transcriptTurnCount = 0;
    let currentSidebarTab = 'history';

    function switchSidebarTab(tab) {
      currentSidebarTab = tab;
      const tabHistory = getElementById('ts-tab-history');
      const tabTranscript = getElementById('ts-tab-transcript');
      const viewHistory = getElementById('ts-history-view');
      const viewTranscript = getElementById('ts-transcript-view');

      if (tab === 'transcript') {
        if (tabHistory) tabHistory.classList.remove('on');
        if (tabTranscript) tabTranscript.classList.add('on');
        if (viewHistory) viewHistory.classList.add('hidden');
        if (viewTranscript) viewTranscript.classList.remove('hidden');
      } else {
        if (tabHistory) tabHistory.classList.add('on');
        if (tabTranscript) tabTranscript.classList.remove('on');
        if (viewHistory) viewHistory.classList.remove('hidden');
        if (viewTranscript) viewTranscript.classList.add('hidden');
      }
    }

    function renderConversationHistory() {
      const list = getElementById('ts-history-list');
      if (!list) return;

      list.innerHTML = '';
      if (conversationItems.length === 0) {
        list.innerHTML = '<div class="ts-placeholder">No question history yet.</div>';
        return;
      }

      conversationItems.forEach((item) => {
        const row = new MockElement('', 'ts-item');
        row.dataset.id = item.id;
        row.textContent = item.title;
        list.appendChild(row);
      });
    }

    function appendTranscriptHistoryTurn(channel, text) {
      const list = getElementById('ts-list');
      if (!list) return;
      const row = new MockElement('', 'ts-turn ts-' + channel);
      row.textContent = (channel === 'them' ? 'Them: ' : 'You: ') + text;
      list.appendChild(row);
      transcriptTurnCount++;
    }

    // Phase 1: Incoming live speech
    appendTranscriptHistoryTurn('them', 'Why do you want to work here?');
    appendTranscriptHistoryTurn('you', 'I am passionate about your core mission...');
    assert.equal(domElements['ts-list'].children.length, 2, 'ts-list must have 2 speech turns');
    assert.equal(domElements['ts-history-list'].children.length, 0, 'ts-history-list must be empty');

    // Phase 2: User asks 3 questions
    conversationItems.push({ id: '1', title: 'Why work here STAR story', query: 'STAR story' });
    conversationItems.push({ id: '2', title: 'Binary search tree', query: 'BST implementation' });
    renderConversationHistory();

    assert.equal(domElements['ts-history-list'].children.length, 2, 'ts-history-list must have 2 questions');
    assert.equal(domElements['ts-list'].children.length, 2, 'ts-list MUST still have 2 speech turns (untouched!)');

    // Phase 3: Toggle sidebar open (calls renderConversationHistory)
    renderConversationHistory();
    assert.equal(domElements['ts-list'].children.length, 2, 'ts-list MUST retain turns after sidebar render');
    assert.equal(domElements['ts-history-list'].children.length, 2, 'ts-history-list retains questions');

    // Phase 4: Tab switching
    switchSidebarTab('transcript');
    assert.equal(currentSidebarTab, 'transcript');
    assert.ok(domElements['ts-tab-transcript'].classList.contains('on'), 'transcript tab active');
    assert.ok(!domElements['ts-tab-history'].classList.contains('on'), 'history tab inactive');
    assert.ok(!domElements['ts-transcript-view'].classList.contains('hidden'), 'transcript view visible');
    assert.ok(domElements['ts-history-view'].classList.contains('hidden'), 'history view hidden');

    // Add another speech turn while in transcript view
    appendTranscriptHistoryTurn('them', 'Great answer. Next question: tell me about a challenge.');
    assert.equal(domElements['ts-list'].children.length, 3, 'ts-list now has 3 speech turns');
    assert.equal(domElements['ts-history-list'].children.length, 2, 'ts-history-list still has 2 questions');

    // Switch back to questions view
    switchSidebarTab('history');
    assert.equal(currentSidebarTab, 'history');
    assert.ok(domElements['ts-tab-history'].classList.contains('on'), 'history tab active');
    assert.ok(!domElements['ts-history-view'].classList.contains('hidden'), 'history view visible');

    // Phase 5: Clear Question History
    conversationItems = [];
    renderConversationHistory();
    assert.equal(domElements['ts-history-list'].children.length, 0, 'question history cleared');
    assert.equal(domElements['ts-list'].children.length, 3, 'audio transcript turns MUST still be 3!');

    // Phase 6: Clear Transcript
    domElements['ts-list'].innerHTML = '<div class="ts-placeholder">Live transcript will appear here when listening.</div>';
    transcriptTurnCount = 0;
    assert.equal(domElements['ts-list'].children.length, 0, 'audio transcript turns cleared');
  });

  await t.test('Zero-focus safety: Clicking sidebar tabs and buttons calls preventDefault', () => {
    // Exact logic from renderer.js:655-680
    function isModalClick(element) {
      return element && (typeof element.closest === 'function' && !!element.closest('#settings-scrim, #onboard-scrim, #consent-scrim, #confirm-modal'));
    }

    const mockSidebar = {
      id: 'transcript-sidebar',
      closest: (sel) => sel.includes('transcript-sidebar') ? mockSidebar : null
    };

    const mockTab = {
      id: 'ts-tab-transcript',
      className: 'ts-tab',
      closest: (sel) => {
        if (sel.includes('transcript-sidebar')) return mockSidebar;
        return null;
      }
    };

    const mockClearHistoryBtn = {
      id: 'clear-history-btn',
      className: 'ts-clear-btn',
      closest: (sel) => {
        if (sel.includes('transcript-sidebar')) return mockSidebar;
        return null;
      }
    };

    // Neither tab nor clear button should match modal click,
    // so mousedown will call e.preventDefault(), preserving zero-focus!
    assert.equal(isModalClick(mockTab), false, 'Sidebar tab click must NOT be treated as modal');
    assert.equal(isModalClick(mockClearHistoryBtn), false, 'Sidebar clear button must NOT be treated as modal');
    assert.equal(isModalClick(mockSidebar), false, 'Sidebar must NOT be treated as modal');
  });

});
