'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('whycavalry', {
  // Streaming message (fire and forget — responses come via onChunk/onDone)
  sendMessageStream: (params) => ipcRenderer.send('send-message-start', params),
  onChunk: (cb) => ipcRenderer.on('ai-chunk', (_e, data) => cb(data)),
  onDone:  (cb) => ipcRenderer.on('ai-done',  (_e, data) => cb(data)),
  offChunk: () => ipcRenderer.removeAllListeners('ai-chunk'),
  offDone:  () => ipcRenderer.removeAllListeners('ai-done'),

  cavalryStatus:   ()    => ipcRenderer.invoke('cavalry-status'),
  runScript:       (s)   => ipcRenderer.invoke('run-script', s),
  sessionsList:    ()    => ipcRenderer.invoke('sessions-list'),
  sessionSave:     (s)   => ipcRenderer.invoke('session-save', s),
  sessionDelete:   (id)  => ipcRenderer.invoke('session-delete', id),
  configGet:       ()    => ipcRenderer.invoke('config-get'),
  configSet:       (c)   => ipcRenderer.invoke('config-set', c),
  claudeAvailable: ()    => ipcRenderer.invoke('claude-available'),
  openFilePicker:  ()         => ipcRenderer.invoke('open-file-picker'),
  showInFinder:    (p)        => ipcRenderer.invoke('show-in-finder', p),
  onSteps:     (cb) => ipcRenderer.on('ai-steps',      (_e, d) => cb(d)),
  onStepStart: (cb) => ipcRenderer.on('ai-step-start', (_e, d) => cb(d)),
  onStepDone:  (cb) => ipcRenderer.on('ai-step-done',  (_e, d) => cb(d)),
  offSteps:    ()   => { ipcRenderer.removeAllListeners('ai-steps'); ipcRenderer.removeAllListeners('ai-step-start'); ipcRenderer.removeAllListeners('ai-step-done'); },
});
