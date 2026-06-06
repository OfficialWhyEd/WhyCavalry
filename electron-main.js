'use strict';
const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const { randomUUID } = require('crypto');

// Find claude binary — Electron doesn't inherit shell PATH
function findClaude() {
  const candidates = [
    '/Users/whyed/.nvm/versions/node/v24.15.0/bin/claude',
    path.join(os.homedir(), '.nvm/versions/node/v24.15.0/bin/claude'),
    '/usr/local/bin/claude',
    '/opt/homebrew/bin/claude',
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  // fallback: try resolving via shell
  try {
    return execSync('which claude', { env: { ...process.env, PATH: process.env.PATH + ':/usr/local/bin:/opt/homebrew/bin' } }).toString().trim();
  } catch { return 'claude'; }
}
const CLAUDE_BIN = findClaude();
const CLAUDE_AVAILABLE = fs.existsSync(CLAUDE_BIN);

// ── Config ────────────────────────────────────────────────────────────────────
const CONFIG_FILE = path.join(os.homedir(), '.whycavalry', 'config.json');

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch {}
  return { provider: 'claude', geminiKey: '' };
}

function saveConfig(config) {
  fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

// ── Bridge ────────────────────────────────────────────────────────────────────
const BRIDGE_DIR = path.join(os.homedir(), '.whycavalry');
const CMD_DIR = path.join(BRIDGE_DIR, 'cmd');
const RES_DIR = path.join(BRIDGE_DIR, 'res');

function ensureDirs() {
  [BRIDGE_DIR, CMD_DIR, RES_DIR].forEach(d => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  });
}

function triggerCavalry() {
  try {
    execSync(`osascript -e '
      tell application "System Events"
        if exists process "Cavalry" then
          tell process "Cavalry"
            tell menu "Scripts" of menu bar item "Scripts" of menu bar 1
              click menu item "WhyCavalry-Bridge"
            end tell
          end tell
        end if
      end tell
    '`, { timeout: 5000 });
  } catch {}
}

function isCavalryOpen() {
  try {
    return execSync(
      `osascript -e 'tell application "System Events" to return exists process "Cavalry"'`,
      { timeout: 3000 }
    ).toString().trim() === 'true';
  } catch { return false; }
}

async function runInCavalry(script, timeoutMs = 15000) {
  ensureDirs();
  const id = randomUUID();
  fs.writeFileSync(
    path.join(CMD_DIR, `${id}.json`),
    JSON.stringify({ id, script, timestamp: Date.now() })
  );
  triggerCavalry();

  const resultPath = path.join(RES_DIR, `${id}.json`);
  const deadline = Date.now() + timeoutMs;

  return new Promise((resolve, reject) => {
    const poll = () => {
      if (fs.existsSync(resultPath)) {
        try {
          const result = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
          fs.unlinkSync(resultPath);
          resolve(result);
        } catch (e) { reject(e); }
        return;
      }
      if (Date.now() >= deadline) {
        reject(new Error('Cavalry non ha risposto. Aprilo e riprova.'));
        return;
      }
      setTimeout(poll, 300);
    };
    poll();
  });
}

// ── System prompt ─────────────────────────────────────────────────────────────
function buildSystem(sessionTitle, files) {
  return `Sei WhyCavalry — telecomando AI per Cavalry motion graphics. Rispondi SEMPRE in italiano.

COMPORTAMENTO OBBLIGATORIO:
- Ogni richiesta che riguarda Cavalry = codice JS immediato, nessuna esitazione
- MAI dire "non posso" o "non so" — usa sempre l'API più vicina alla richiesta
- Esegui prima, suggerisci dopo (mai il contrario)
- Sii conciso: max 1 riga di testo fuori dal codice
- Se la richiesta è vaga, interpreta nel modo più utile e agisci

FORMATO RISPOSTA (rispetta l'ordine):
1. [opzionale] Una sola riga di spiegazione
2. <js> ... codice Cavalry ... </js>
3. [opzionale] <suggest>Un suggerimento contestuale utile al progetto corrente</suggest>
4. [opzionale] <new-session>nome progetto</new-session> — SOLO se l'utente parla chiaramente di un progetto DIVERSO da "${sessionTitle}"

PROGETTO CORRENTE: "${sessionTitle}"
Se l'utente inizia a parlare di qualcosa di completamente diverso (altro brand, altro video, altro cliente), aggiungi il tag <new-session> con il nome del nuovo progetto.

CODICE JS — regole:
- Accesso all'oggetto globale "api"
- Termina SEMPRE con: JSON.stringify({ ...risultati })
- Usa var, non const/let (compatibilità Cavalry)
- api.getActiveComp() per la comp attiva

API CAVALRY COMPLETA:
  api.getActiveComp()                    → id comp attiva
  api.createComp(name)                   → crea comp, ritorna id
  api.setActiveComp(id)                  → imposta comp attiva
  api.create(type, name)                 → crea layer (rectangle, ellipse, text, null, duplicator, javascript, polygon, group)
  api.set(id, { attr: value })           → imposta attributi:
      width, height, fillColor, strokeColor, strokeWidth,
      position:[x,y], scale:[x,y], rotation, opacity,
      text, fontSize, fontFamily, textAlign,
      startFrame, duration
  api.get(id, attr)                      → legge attributo
  api.keyframe(id, attr, frame, value)   → aggiunge keyframe
  api.magicEasing(id, attr, f0, f1)      → easing fluido tra frame f0 e f1
  api.getCompLayers(compId)              → array di id layer
  api.getNiceName(id)                    → nome layer
  api.deleteLayer(id)                    → elimina layer
  api.parent(childId, parentId)          → genitore
  api.connect(fromId, toId, attr)        → connette attributi

Colori: hex "#ff0000". Position/Scale: [x, y]. Frames: interi (30fps default).
Animazione base: keyframe a frame 0 e frame finale + magicEasing.

ESECUZIONE A STEP — IMPORTANTE:
Separa ogni azione logica con // STEP: descrizione breve in italiano
Ogni step deve essere AUTOSUFFICIENTE: usa solo variabili definite in quello stesso step o già note.
Passa i risultati tra step tramite JSON.stringify intermedi — NON fare affidamento su variabili da step precedenti.

Esempio corretto:
// STEP: Creo composizione
var comp = api.getActiveComp();
// STEP: Aggiungo rettangolo rosso
var rect = api.create("rectangle", "Sfondo");
api.set(rect, { width: 1920, height: 1080, fillColor: "#ff0000" });
// STEP: Animo posizione
api.keyframe(rect, "position", 0, [-960, 0]);
api.keyframe(rect, "position", 30, [0, 0]);
api.magicEasing(rect, "position", 0, 30);
JSON.stringify({ rect: rect, nome: "Sfondo" })
${files && files.length > 0 ? `
FILE ALLEGATI DALL'UTENTE:
${files.map(f => `- ${f.name} (${f.type}) → percorso: "${f.path}"${f.duration ? ` durata: ${f.duration}s` : ''}${f.width ? ` dimensioni: ${f.width}x${f.height}` : ''}`).join('\n')}

Usa i percorsi file nelle API Cavalry dove appropriato:
- Immagini: api.set(layer, { source: "${files[0]?.path}" }) per texture/background
- Audio: api.set(layer, { source: "..." }) per layer audio-reattivi
- Video: usa il percorso come sorgente per layer video` : ''}`;
}

// ── Claude CLI ────────────────────────────────────────────────────────────────
const { GoogleGenerativeAI } = require('@google/generative-ai');

function askClaude(userMessage, history, sessionTitle) {
  return new Promise((resolve, reject) => {
    const context = history.length > 0
      ? history.map(m => `${m.role === 'user' ? 'Utente' : 'Assistant'}: ${m.content}`).join('\n') + '\n'
      : '';
    const fullPrompt = context + 'Utente: ' + userMessage;

    const claude = spawn(CLAUDE_BIN, ['--print', '-p', buildSystem(sessionTitle)], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let output = '';
    let errOutput = '';
    claude.stdout.on('data', d => { output += d.toString(); });
    claude.stderr.on('data', d => { errOutput += d.toString(); });
    claude.on('close', code => {
      if (code !== 0 && !output) reject(new Error('claude error: ' + errOutput.slice(0, 200)));
      else resolve(output.trim());
    });
    claude.stdin.write(fullPrompt);
    claude.stdin.end();
  });
}

async function askGemini(userMessage, history, sessionTitle) {
  const config = loadConfig();
  if (!config.geminiKey) throw new Error('API key Google AI Studio non configurata. Vai nelle impostazioni ⚙');

  const genAI = new GoogleGenerativeAI(config.geminiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    systemInstruction: buildSystem(sessionTitle),
  });

  const chatHistory = history.map(m => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.content }],
  }));

  const chat = model.startChat({ history: chatHistory });
  const result = await chat.sendMessage(userMessage);
  return result.response.text();
}

async function askAI(userMessage, history, sessionTitle) {
  const config = loadConfig();
  if (config.provider === 'gemini') return askGemini(userMessage, history, sessionTitle);
  return askClaude(userMessage, history, sessionTitle);
}

function extractScript(text) {
  const tagMatch = text.match(/<js>([\s\S]*?)<\/js>/);
  if (tagMatch) return tagMatch[1].trim();
  const mdMatch = text.match(/```(?:js|javascript)?\n?([\s\S]*?)```/);
  if (mdMatch) return mdMatch[1].trim();
  return null;
}

function extractExplanation(text) {
  return text
    .replace(/<js>[\s\S]*?<\/js>/g, '')
    .replace(/```(?:js|javascript)?[\s\S]*?```/g, '')
    .trim();
}

// ── Electron Window ───────────────────────────────────────────────────────────
let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 620,
    height: 720,
    minWidth: 500,
    minHeight: 500,
    titleBarStyle: 'hiddenInset',
    vibrancy: 'under-window',
    visualEffectState: 'active',
    backgroundColor: '#0c0c14',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ── IPC Handlers ─────────────────────────────────────────────────────────────
ipcMain.handle('cavalry-status', () => isCavalryOpen());

ipcMain.on('send-message-start', async (event, { id, text, history, sessionTitle, files }) => {
  const system = buildSystem(sessionTitle || 'Nuova sessione', files || []);
  const config = loadConfig();
  let fullOutput = '';

  try {
    if (config.provider === 'gemini') {
      // Gemini streaming
      if (!config.geminiKey) throw new Error('API key Google AI Studio non configurata. Apri ⚙ impostazioni.');
      const genAI = new GoogleGenerativeAI(config.geminiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash', systemInstruction: system });

      const chatHistory = (history || []).map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }],
      }));

      const chat = model.startChat({ history: chatHistory });
      const imageFiles = (files || []).filter(f => f.type === 'image');
      let messageContent;
      if (imageFiles.length > 0) {
        const parts = [{ text }];
        for (const img of imageFiles) {
          try {
            const data = fs.readFileSync(img.path).toString('base64');
            const ext = path.extname(img.path).slice(1).toLowerCase();
            const mimeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`;
            parts.push({ inlineData: { mimeType, data } });
          } catch {}
        }
        messageContent = parts;
      } else {
        messageContent = text;
      }
      const streamResult = await chat.sendMessageStream(messageContent);

      for await (const chunk of streamResult.stream) {
        const chunkText = chunk.text();
        fullOutput += chunkText;
        event.sender.send('ai-chunk', { id, chunk: chunkText });
      }

    } else {
      // Claude CLI streaming — stdout comes in naturally as chunks
      const context = (history || []).length > 0
        ? history.map(m => `${m.role === 'user' ? 'Utente' : 'Assistant'}: ${m.content}`).join('\n') + '\n'
        : '';
      const fullPrompt = context + 'Utente: ' + text;

      await new Promise((resolve, reject) => {
        const claude = spawn(CLAUDE_BIN, ['--print', '-p', system], {
          stdio: ['pipe', 'pipe', 'pipe']
        });

        claude.stdout.on('data', d => {
          const chunk = d.toString();
          fullOutput += chunk;
          event.sender.send('ai-chunk', { id, chunk });
        });

        let errOutput = '';
        claude.stderr.on('data', d => { errOutput += d.toString(); });

        claude.on('close', code => {
          if (code !== 0 && !fullOutput) reject(new Error('Claude CLI error: ' + errOutput.slice(0, 300)));
          else resolve();
        });

        claude.stdin.write(fullPrompt);
        claude.stdin.end();
      });
    }

    // Process complete response
    const explanation = fullOutput
      .replace(/<js>[\s\S]*?<\/js>/g, '')
      .replace(/```(?:js|javascript)?[\s\S]*?```/g, '')
      .replace(/<suggest>[\s\S]*?(<\/suggest>)?/g, '')
      .replace(/<new-session>[\s\S]*?(<\/new-session>)?/g, '')
      .trim();

    const tagMatch = fullOutput.match(/<js>([\s\S]*?)<\/js>/);
    const mdMatch  = fullOutput.match(/```(?:js|javascript)?\n?([\s\S]*?)```/);
    const script   = tagMatch ? tagMatch[1].trim() : mdMatch ? mdMatch[1].trim() : null;
    const suggest  = (fullOutput.match(/<suggest>([\s\S]*?)<\/suggest>/) || [])[1]?.trim() || null;
    const newSess  = (fullOutput.match(/<new-session>([\s\S]*?)<\/new-session>/) || [])[1]?.trim() || null;

    let result = null;
    if (script) {
      // Parse steps from script
      const stepLines = [];
      const stepRe = /\/\/ STEP:\s*(.+)/g;
      let m;
      while ((m = stepRe.exec(script)) !== null) stepLines.push(m[1].trim());

      if (stepLines.length > 0) {
        // Send steps list first
        event.sender.send('ai-steps', { id, steps: stepLines });

        // Execute each step's code block separately
        const blocks = script.split(/\/\/ STEP:[^\n]*\n/);
        const codeBlocks = blocks.filter(b => b.trim().length > 0);

        // If we can split meaningfully, execute step by step
        // Otherwise fall back to single execution
        if (codeBlocks.length > 1 && codeBlocks.length === stepLines.length) {
          let stepIdx = 0;
          for (const block of codeBlocks) {
            const blockWithReturn = block.trim().endsWith('JSON.stringify')
              ? block
              : block.trim().endsWith('})')
                ? block
                : block + '\nJSON.stringify({ step: ' + JSON.stringify(stepLines[stepIdx] || 'ok') + ' })';

            event.sender.send('ai-step-start', { id, stepIdx, stepName: stepLines[stepIdx] });
            try {
              const stepResult = await runInCavalry(block.trim() + (block.trim().includes('JSON.stringify') ? '' : '\nJSON.stringify({ ok: true })'));
              event.sender.send('ai-step-done', { id, stepIdx, ok: stepResult.success, error: stepResult.error });
              result = stepResult; // keep last result
            } catch(e) {
              event.sender.send('ai-step-done', { id, stepIdx, ok: false, error: e.message });
            }
            stepIdx++;
          }
        } else {
          // Single execution with step animation
          event.sender.send('ai-step-start', { id, stepIdx: 0, stepName: stepLines[0] });
          result = await runInCavalry(script);
          // Animate through remaining steps visually
          for (let i = 0; i < stepLines.length; i++) {
            event.sender.send('ai-step-done', { id, stepIdx: i, ok: result.success });
            if (i < stepLines.length - 1) await new Promise(r => setTimeout(r, 200));
            if (i < stepLines.length - 1) event.sender.send('ai-step-start', { id, stepIdx: i + 1, stepName: stepLines[i + 1] });
          }
        }
      } else {
        // No steps — single execution
        event.sender.send('ai-steps', { id, steps: ['Eseguendo in Cavalry'] });
        event.sender.send('ai-step-start', { id, stepIdx: 0, stepName: 'Eseguendo in Cavalry' });
        result = await runInCavalry(script);
        event.sender.send('ai-step-done', { id, stepIdx: 0, ok: result.success, error: result.error });
      }
    }

    event.sender.send('ai-done', { id, explanation, result, suggest, newSession: newSess });

  } catch (e) {
    event.sender.send('ai-done', { id, explanation: null, result: null, suggest: null, newSession: null, error: e.message });
  }
});

const SESSIONS_DIR = path.join(BRIDGE_DIR, 'sessions');

ipcMain.handle('sessions-list', () => {
  if (!fs.existsSync(SESSIONS_DIR)) return [];
  return fs.readdirSync(SESSIONS_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      try { return JSON.parse(fs.readFileSync(path.join(SESSIONS_DIR, f), 'utf8')); }
      catch { return null; }
    })
    .filter(Boolean)
    .sort((a, b) => b.createdAt - a.createdAt);
});

ipcMain.handle('session-save', (_event, session) => {
  if (!fs.existsSync(SESSIONS_DIR)) fs.mkdirSync(SESSIONS_DIR, { recursive: true });
  fs.writeFileSync(path.join(SESSIONS_DIR, `${session.id}.json`), JSON.stringify(session));
});

ipcMain.handle('session-delete', (_event, id) => {
  const f = path.join(SESSIONS_DIR, `${id}.json`);
  if (fs.existsSync(f)) fs.unlinkSync(f);
});

ipcMain.handle('config-get', () => loadConfig());
ipcMain.handle('config-set', (_event, config) => { saveConfig(config); return true; });
ipcMain.handle('claude-available', () => CLAUDE_AVAILABLE);

ipcMain.handle('open-file-picker', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Media', extensions: ['jpg','jpeg','png','gif','webp','mp3','wav','aac','m4a','mp4','mov','avi','webm'] },
      { name: 'Immagini', extensions: ['jpg','jpeg','png','gif','webp','svg'] },
      { name: 'Audio', extensions: ['mp3','wav','aac','m4a','ogg','flac'] },
      { name: 'Video', extensions: ['mp4','mov','avi','webm','mkv'] },
    ]
  });
  return result.canceled ? [] : result.filePaths;
});

ipcMain.handle('show-in-finder', (_e, filePath) => shell.showItemInFinder(filePath));

ipcMain.handle('run-script', async (_event, script) => runInCavalry(script));
