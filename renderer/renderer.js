'use strict';

const messagesEl  = document.getElementById('messages');
const inputEl     = document.getElementById('input');
const sendBtn     = document.getElementById('sendBtn');
const statusDot   = document.getElementById('statusDot');
const statusLabel = document.getElementById('statusLabel');
const sessionsEl  = document.getElementById('sessionsList');
const newBtn      = document.getElementById('newBtn');

// ── Session state ─────────────────────────────────────────────────────────────
let currentSession = null;  // { id, createdAt, title, messages: [], history: [] }
let busy = false;

function newSession() {
  currentSession = {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    title: 'Nuova sessione',
    messages: [],
    history: []
  };
  renderMessages();
  renderSessions();
}

async function saveSession() {
  if (!currentSession || currentSession.messages.length === 0) return;
  await window.whycavalry.sessionSave({
    id: currentSession.id,
    createdAt: currentSession.createdAt,
    title: currentSession.title,
    messages: currentSession.messages
  });
}

// ── Render sessions sidebar ───────────────────────────────────────────────────
async function renderSessions() {
  const sessions = await window.whycavalry.sessionsList();
  sessionsEl.innerHTML = '';

  sessions.forEach(s => {
    const item = document.createElement('div');
    item.className = 'session-item' + (currentSession && s.id === currentSession.id ? ' active' : '');

    const date = new Date(s.createdAt);
    const dateStr = date.toLocaleDateString('it-IT', { day:'2-digit', month:'2-digit' }) + ' ' +
                    date.toLocaleTimeString('it-IT', { hour:'2-digit', minute:'2-digit' });

    item.innerHTML = `
      <div class="session-date">${dateStr}</div>
      <div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${s.title}</div>
      <button class="session-del" title="Elimina">×</button>
    `;

    item.addEventListener('click', (e) => {
      if (e.target.classList.contains('session-del')) return;
      loadSession(s);
    });

    item.querySelector('.session-del').addEventListener('click', async (e) => {
      e.stopPropagation();
      await window.whycavalry.sessionDelete(s.id);
      if (currentSession && currentSession.id === s.id) newSession();
      else renderSessions();
    });

    sessionsEl.appendChild(item);
  });
}

// ── Load session ──────────────────────────────────────────────────────────────
function loadSession(s) {
  currentSession = {
    id: s.id,
    createdAt: s.createdAt,
    title: s.title,
    messages: s.messages || [],
    history: []
  };
  // Rebuild in-memory history from messages
  s.messages.forEach(m => {
    if (m.role === 'user') currentSession.history.push({ role: 'user', content: m.content });
    if (m.role === 'ai')   currentSession.history.push({ role: 'assistant', content: m.content });
  });
  renderMessages();
  renderSessions();
}

// ── Render all messages ───────────────────────────────────────────────────────
function renderMessages() {
  messagesEl.innerHTML = '';
  if (!currentSession || currentSession.messages.length === 0) {
    const w = document.createElement('div');
    w.className = 'welcome';
    w.id = 'welcome';
    w.innerHTML = `
      <div class="welcome-glow"></div>
      <div class="welcome-icon">⚡</div>
      <h1>WhyCavalry</h1>
      <p>Descrivi cosa vuoi creare.<br>Penso io al codice.</p>
    `;
    messagesEl.appendChild(w);
    return;
  }
  currentSession.messages.forEach(m => {
    const el = createMsgEl(m.role, m.content);
    if (m.chip) addChipToEl(el, m.chip.ok, m.chip.text);
    messagesEl.appendChild(el);
  });
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function removeWelcome() {
  const w = document.getElementById('welcome');
  if (w) w.remove();
}

function createMsgEl(role, text) {
  const msg = document.createElement('div');
  msg.className = 'msg ' + role;
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.textContent = text;
  msg.appendChild(bubble);
  return msg;
}

function addMessage(role, text) {
  removeWelcome();
  const msg = createMsgEl(role, text);
  messagesEl.appendChild(msg);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return msg;
}

function addChipToEl(el, ok, text) {
  const chip = document.createElement('div');
  chip.className = 'chip ' + (ok ? 'ok' : 'err');
  chip.textContent = (ok ? '✓ ' : '✗ ') + text;
  el.appendChild(chip);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return chip;
}

function addChip(parentEl, ok, text) {
  return addChipToEl(parentEl, ok, text);
}

function showTyping() {
  removeWelcome();
  const el = document.createElement('div');
  el.className = 'typing'; el.id = '_typing';
  el.innerHTML = '<span></span><span></span><span></span>';
  messagesEl.appendChild(el);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function removeTyping() {
  const el = document.getElementById('_typing');
  if (el) el.remove();
}

// ── Status ────────────────────────────────────────────────────────────────────
async function refreshStatus() {
  const ok = await window.whycavalry.cavalryStatus();
  statusDot.className = 'dot ' + (ok ? 'on' : 'off');
  statusLabel.textContent = ok ? 'Cavalry connesso' : 'Cavalry non rilevato';
}
refreshStatus();
setInterval(refreshStatus, 6000);

// ── Input ─────────────────────────────────────────────────────────────────────
inputEl.addEventListener('input', () => {
  inputEl.style.height = 'auto';
  inputEl.style.height = Math.min(inputEl.scrollHeight, 100) + 'px';
  sendBtn.disabled = !inputEl.value.trim() || busy;
});

inputEl.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    if (!sendBtn.disabled) handleSend();
  }
});

sendBtn.addEventListener('click', handleSend);
newBtn.addEventListener('click', () => { newSession(); inputEl.focus(); });

// ── File attachments ──────────────────────────────────────────────────────────
const attachBtn     = document.getElementById('attachBtn');
const attachmentsEl = document.getElementById('attachments');
const dropOverlay   = document.getElementById('dropOverlay');
let attachedFiles   = [];  // { path, name, type, size, dataUrl? }

function getFileType(name) {
  const ext = name.split('.').pop().toLowerCase();
  if (['jpg','jpeg','png','gif','webp','svg'].includes(ext)) return 'image';
  if (['mp3','wav','aac','m4a','ogg','flac'].includes(ext)) return 'audio';
  if (['mp4','mov','avi','webm','mkv'].includes(ext)) return 'video';
  return 'file';
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + 'B';
  if (bytes < 1024*1024) return (bytes/1024).toFixed(0) + 'KB';
  return (bytes/(1024*1024)).toFixed(1) + 'MB';
}

async function addFiles(paths) {
  for (const filePath of paths) {
    if (attachedFiles.find(f => f.path === filePath)) continue;
    const name = filePath.split('/').pop();
    const type = getFileType(name);
    const file = { path: filePath, name, type };
    attachedFiles.push(file);
    renderFileChip(file);
  }
}

function renderFileChip(file) {
  const chip = document.createElement('div');
  chip.className = 'file-chip';
  chip.dataset.path = file.path;

  if (file.type === 'image') {
    const img = document.createElement('img');
    img.className = 'file-chip-thumb';
    img.src = 'file://' + file.path;
    chip.appendChild(img);
  } else {
    const icon = document.createElement('div');
    icon.className = 'file-chip-icon ' + file.type;
    icon.textContent = file.type === 'audio' ? '🎵' : '🎬';
    chip.appendChild(icon);
  }

  const nameEl = document.createElement('div');
  nameEl.className = 'file-chip-name';
  nameEl.textContent = file.name;
  nameEl.title = file.path;
  chip.appendChild(nameEl);

  const removeBtn = document.createElement('button');
  removeBtn.className = 'file-chip-remove';
  removeBtn.textContent = '×';
  removeBtn.addEventListener('click', () => {
    attachedFiles = attachedFiles.filter(f => f.path !== file.path);
    chip.remove();
  });
  chip.appendChild(removeBtn);

  // Right-click → show in Finder
  chip.addEventListener('contextmenu', () => window.whycavalry.showInFinder(file.path));

  attachmentsEl.appendChild(chip);
}

// File picker button
attachBtn.addEventListener('click', async () => {
  const paths = await window.whycavalry.openFilePicker();
  if (paths.length) addFiles(paths);
});

// Drag & drop
document.addEventListener('dragover', e => {
  e.preventDefault();
  dropOverlay.classList.add('active');
});
document.addEventListener('dragleave', e => {
  if (!e.relatedTarget) dropOverlay.classList.remove('active');
});
document.addEventListener('drop', e => {
  e.preventDefault();
  dropOverlay.classList.remove('active');
  const paths = Array.from(e.dataTransfer.files).map(f => f.path);
  if (paths.length) addFiles(paths);
});

// Cmd+O shortcut
document.addEventListener('keydown', async e => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'o') {
    e.preventDefault();
    const paths = await window.whycavalry.openFilePicker();
    if (paths.length) addFiles(paths);
  }
});

function newSession_named(title) {
  currentSession = {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    title: title,
    messages: [],
    history: []
  };
  renderMessages();
  renderSessions();
  inputEl.focus();
}

// ── Send ──────────────────────────────────────────────────────────────────────
async function handleSend() {
  const text = inputEl.value.trim();
  if (!text || busy) return;

  busy = true;
  sendBtn.disabled = true;
  inputEl.value = '';
  inputEl.style.height = 'auto';

  const userMsgEl = addMessage('user', text);
  // Show file chips in user message
  if (attachedFiles.length > 0) {
    const filesDiv = document.createElement('div');
    filesDiv.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;margin-top:6px;';
    attachedFiles.forEach(f => {
      const chip = document.createElement('span');
      chip.style.cssText = 'font-size:10px;background:rgba(255,255,255,0.1);padding:2px 7px;border-radius:10px;color:rgba(255,255,255,0.8);';
      chip.textContent = (f.type === 'image' ? '🖼 ' : f.type === 'audio' ? '🎵 ' : '🎬 ') + f.name;
      filesDiv.appendChild(chip);
    });
    userMsgEl.querySelector('.bubble').appendChild(filesDiv);
  }
  currentSession.messages.push({ role: 'user', content: text });

  if (currentSession.messages.filter(m => m.role === 'user').length === 1) {
    currentSession.title = text.slice(0, 40) + (text.length > 40 ? '...' : '');
  }

  // Create AI bubble immediately (will stream into it)
  removeWelcome();
  const aiMsgEl = document.createElement('div');
  aiMsgEl.className = 'msg ai';
  const bubble = document.createElement('div');
  bubble.className = 'bubble streaming';
  bubble.textContent = '';
  aiMsgEl.appendChild(bubble);
  messagesEl.appendChild(aiMsgEl);
  messagesEl.scrollTop = messagesEl.scrollHeight;

  const msgId = crypto.randomUUID();
  let streamedRaw = '';

  // Show "running" chip placeholder while waiting for code execution
  const runningChip = document.createElement('div');
  runningChip.className = 'chip running';
  runningChip.textContent = '⏳ elaborando...';
  aiMsgEl.appendChild(runningChip);

  window.whycavalry.offChunk();
  window.whycavalry.offDone();
  window.whycavalry.offSteps();

  let activityEl = null;
  let stepEls = [];

  window.whycavalry.onSteps(({ id: sid, steps }) => {
    if (sid !== msgId) return;
    // Create activity log
    activityEl = document.createElement('div');
    activityEl.className = 'activity-log';
    stepEls = steps.map((s, i) => {
      const row = document.createElement('div');
      row.className = 'activity-row pending';
      row.innerHTML = `<span class="activity-icon">○</span><span class="activity-label">${s}</span>`;
      activityEl.appendChild(row);
      return row;
    });
    aiMsgEl.appendChild(activityEl);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  });

  window.whycavalry.onStepStart(({ id: sid, stepIdx }) => {
    if (sid !== msgId || !stepEls[stepIdx]) return;
    stepEls[stepIdx].className = 'activity-row running';
    stepEls[stepIdx].querySelector('.activity-icon').textContent = '⏳';
    messagesEl.scrollTop = messagesEl.scrollHeight;
  });

  window.whycavalry.onStepDone(({ id: sid, stepIdx, ok, error }) => {
    if (sid !== msgId || !stepEls[stepIdx]) return;
    stepEls[stepIdx].className = 'activity-row ' + (ok ? 'done' : 'failed');
    stepEls[stepIdx].querySelector('.activity-icon').textContent = ok ? '✓' : '✗';
    if (error && !ok) {
      const errSpan = document.createElement('span');
      errSpan.className = 'activity-error';
      errSpan.textContent = ' — ' + error;
      stepEls[stepIdx].appendChild(errSpan);
    }
    messagesEl.scrollTop = messagesEl.scrollHeight;
  });

  window.whycavalry.onChunk(({ id, chunk }) => {
    if (id !== msgId) return;
    streamedRaw += chunk;

    // Show only non-code text in real time
    const visible = streamedRaw
      .replace(/<js>[\s\S]*?(<\/js>)?/g, '')
      .replace(/```(?:js|javascript)?[\s\S]*?(```)?/g, '')
      .replace(/<suggest>[\s\S]*?(<\/suggest>)?/g, '')
      .replace(/<new-session>[\s\S]*?(<\/new-session>)?/g, '')
      .trim();

    bubble.textContent = visible || '...';
    messagesEl.scrollTop = messagesEl.scrollHeight;
  });

  window.whycavalry.onDone(async ({ id, explanation, result, suggest, newSession, error }) => {
    if (id !== msgId) return;
    window.whycavalry.offChunk();
    window.whycavalry.offDone();
    window.whycavalry.offSteps();

    runningChip.remove();

    if (error) {
      bubble.textContent = 'Errore.';
      bubble.classList.remove('streaming');
      addChipToEl(aiMsgEl, false, error);
      currentSession.messages.push({ role: 'ai', content: 'Errore.', chip: { ok: false, text: error } });
      window.whycavalry.offSteps();
      busy = false;
      inputEl.focus();
      return;
    }

    // Final clean explanation
    bubble.textContent = explanation || '...';
    bubble.classList.remove('streaming');

    // Update history
    currentSession.history = currentSession.history || [];
    currentSession.history.push({ role: 'user', content: text });
    currentSession.history.push({ role: 'assistant', content: explanation || '' });
    if (currentSession.history.length > 20) currentSession.history.splice(0, 2);

    let chip = null;
    if (result !== null && result !== undefined) {
      const ok = result.success;
      const chipText = ok
        ? (result.value && typeof result.value === 'object'
            ? Object.entries(result.value).map(([k, v]) => `${k}: ${v}`).join('  ')
            : String(result.value ?? 'ok'))
        : (result.error || 'Errore Cavalry');
      addChipToEl(aiMsgEl, ok, chipText);
      chip = { ok, text: chipText };
    }

    if (suggest) {
      const s = document.createElement('div');
      s.className = 'chip suggest';
      s.textContent = '💡 ' + suggest;
      aiMsgEl.appendChild(s);
    }

    if (newSession) {
      const ns = document.createElement('div');
      ns.className = 'chip new-session-prompt';
      ns.innerHTML = `📂 Nuovo progetto: <strong>${newSession}</strong> — <span class="ns-link">Nuova sessione</span>`;
      ns.querySelector('.ns-link').addEventListener('click', () => newSession_named(newSession));
      aiMsgEl.appendChild(ns);
    }

    currentSession.messages.push({ role: 'ai', content: explanation || '...', chip });
    await saveSession();
    renderSessions();

    busy = false;
    inputEl.focus();
    messagesEl.scrollTop = messagesEl.scrollHeight;
  });

  // Fire
  window.whycavalry.sendMessageStream({
    id: msgId,
    text,
    history: currentSession.history || [],
    sessionTitle: currentSession.title,
    files: attachedFiles,
  });

  // Clear attachments after sending
  attachedFiles = [];
  attachmentsEl.innerHTML = '';
}

// ── Init ──────────────────────────────────────────────────────────────────────
newSession();
renderSessions();

// Auto-detect: se Claude CLI non c'è, apri subito il modal
(async () => {
  const claudeOk = await window.whycavalry.claudeAvailable();
  if (!claudeOk) {
    const config = await window.whycavalry.configGet();
    if (!config.geminiKey) {
      // Forza selezione Gemini e apri modal
      await window.whycavalry.configSet({ provider: 'gemini', geminiKey: '' });
      const modalTitle = document.querySelector('.modal-header span');
      if (modalTitle) modalTitle.textContent = 'Inserisci API Key per continuare';
      document.getElementById('providerGemini').checked = true;
      document.getElementById('geminiKeyGroup').style.display = 'flex';
      document.getElementById('providerClaude').closest('.radio-item').style.opacity = '0.4';
      document.getElementById('providerClaude').disabled = true;
      document.getElementById('modalOverlay').classList.add('open');
    }
  }
})();

// ── Settings ──────────────────────────────────────────────────────────────────
const settingsBtn   = document.getElementById('settingsBtn');
const modalOverlay  = document.getElementById('modalOverlay');
const modalClose    = document.getElementById('modalClose');
const saveSettings  = document.getElementById('saveSettings');
const geminiKeyInp  = document.getElementById('geminiKey');
const geminiKeyGrp  = document.getElementById('geminiKeyGroup');

async function openSettings() {
  const config = await window.whycavalry.configGet();
  document.querySelector(`input[name="provider"][value="${config.provider || 'claude'}"]`).checked = true;
  geminiKeyInp.value = config.geminiKey || '';
  geminiKeyGrp.style.display = (config.provider === 'gemini') ? 'flex' : 'none';
  modalOverlay.classList.add('open');
}

async function checkClaudeAvailable() {
  const config = await window.whycavalry.configGet();
  const badge = document.querySelector('.badge');
  if (badge) badge.style.display = config.provider === 'claude' ? 'inline' : 'inline';
}

document.querySelectorAll('input[name="provider"]').forEach(r => {
  r.addEventListener('change', () => {
    geminiKeyGrp.style.display = r.value === 'gemini' ? 'flex' : 'none';
  });
});

settingsBtn.addEventListener('click', openSettings);
modalClose.addEventListener('click', () => modalOverlay.classList.remove('open'));
modalOverlay.addEventListener('click', e => { if (e.target === modalOverlay) modalOverlay.classList.remove('open'); });

saveSettings.addEventListener('click', async () => {
  const provider = document.querySelector('input[name="provider"]:checked').value;
  const geminiKey = geminiKeyInp.value.trim();
  await window.whycavalry.configSet({ provider, geminiKey });
  modalOverlay.classList.remove('open');
  saveSettings.textContent = '✓ Salvato';
  setTimeout(() => { saveSettings.textContent = 'Salva'; }, 1500);
});
