const { contextBridge, ipcRenderer } = require('electron');
const platform = process.platform;

contextBridge.exposeInMainWorld('cue', {
  platform,
  settingsGet: () => ipcRenderer.invoke('settings:get'),
  settingsSet: (patch) => ipcRenderer.invoke('settings:set', patch),
  whisperModels: () => ipcRenderer.invoke('whisper:models'),
  whisperModelDownload: (modelId) => ipcRenderer.invoke('whisper:model-download', modelId),
  whisperModelCancel: (modelId) => ipcRenderer.invoke('whisper:model-cancel', modelId),
  whisperModelDelete: (modelId) => ipcRenderer.invoke('whisper:model-delete', modelId),
  whisperModelImport: (modelId) => ipcRenderer.invoke('whisper:model-import', modelId),
  platformInfo: () => ipcRenderer.invoke('platform:info'),
  ask: (payload) => ipcRenderer.send('ask', payload),
  captureToggle: () => ipcRenderer.invoke('capture:toggle').catch((err) => {
    console.error('[cue] captureToggle error', err);
    return false;
  }),
  captureState: () => ipcRenderer.invoke('capture:state'),
  micPcm: (arrayBuffer) => ipcRenderer.send('mic:pcm', arrayBuffer),
  systemPcm: (arrayBuffer) => ipcRenderer.send('system:pcm', arrayBuffer),
  setIgnoreMouse: (v) => ipcRenderer.send('mouse:ignore', v),
  setInteractiveRects: (rects) => ipcRenderer.send('window:interactive-rects', rects),
  setFocusable: (v) => ipcRenderer.send('win:focusable', v),
  setInputFocused: (focused) => ipcRenderer.send('input:focused', !!focused),
  restoreForeground: () => ipcRenderer.send('win:restore-fg'),
  dragStart: () => ipcRenderer.send('window:drag-start'),
  dragStop: () => ipcRenderer.send('window:drag-stop'),
  windowMoveTo: (x, y) => ipcRenderer.send('window:move-to', { x, y }),
  windowMoveBy: (dx, dy) => ipcRenderer.send('window:move-by', { dx, dy }),
  setStealth: (v) => ipcRenderer.send('win:stealth', v),
  setKeyhookActive: (active) => ipcRenderer.send('keyhook:active', active),
  clipboardRead: () => ipcRenderer.invoke('clipboard:read'),
  clipboardWrite: (text) => ipcRenderer.send('clipboard:write', text),
  clearTranscript: () => ipcRenderer.invoke('transcript:clear'),
  openPane: (url) => ipcRenderer.send('open-pane', url),
  appLinkState: () => ipcRenderer.invoke('applink:state'),
  appLinkRevoke: (callerId) => ipcRenderer.invoke('applink:revoke', callerId),
  appLinkConsentRespond: (id, allowed) => ipcRenderer.send('applink:consent-response', { id, allowed }),
  pickProfileDocument: () => ipcRenderer.invoke('profile:pickDocument'),
  shortcutsReset: () => ipcRenderer.invoke('shortcuts:reset'),
  quit: () => ipcRenderer.send('app:quit'),
  permissionsCheck: () => ipcRenderer.invoke('permissions:check'),
  permissionsRequest: () => ipcRenderer.invoke('permissions:request'),
  permissionsContinue: () => ipcRenderer.send('permissions:continue'),
  log: (msg) => ipcRenderer.send('log', msg),
  on: (channel, cb) => {
    const allowed = ['capture:state', 'llm:start', 'llm:token', 'llm:done', 'llm:error', 'status', 'transcript', 'stt:interim', 'stt:final', 'stt:status', 'vad:state', 'applink:consent-request', 'hide:toggle', 'whisper:download-progress', 'whisper:models-changed', 'shortcuts:updated', 'keyhook:char', 'keyhook:backspace', 'keyhook:submit', 'keyhook:cancel', 'keyhook:pause', 'keyhook:newline', 'keyhook:paste', 'keyhook:toggle', 'keyhook:arrow-left', 'keyhook:arrow-right', 'keyhook:home', 'keyhook:end', 'keyhook:delete', 'keyhook:select-all', 'keyhook:copy', 'keyhook:cut', 'keyhook:undo', 'keyhook:redo', 'keyhook:word-backspace', 'keyhook:word-delete', 'keyhook:word-left', 'keyhook:word-right', 'keyhook:select-left', 'keyhook:select-right', 'keyhook:select-home', 'keyhook:select-end'];
    if (!allowed.includes(channel)) return;
    ipcRenderer.on(channel, (_e, data) => cb(data));
  }
});
