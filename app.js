#!/usr/bin/env node
// WhyCavalry — standalone AI chat per Cavalry
// Usa claude CLI (già autenticato) + bridge automatico verso Cavalry

import readline from "readline";
import fs from "fs";
import path from "path";
import os from "os";
import { randomUUID } from "crypto";
import { execSync, spawn } from "child_process";

// ── bridge ───────────────────────────────────────────────────────────────────

const BRIDGE_DIR = path.join(os.homedir(), ".whycavalry");
const CMD_DIR   = path.join(BRIDGE_DIR, "cmd");
const RES_DIR   = path.join(BRIDGE_DIR, "res");

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
    ).toString().trim() === "true";
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
          const result = JSON.parse(fs.readFileSync(resultPath, "utf8"));
          fs.unlinkSync(resultPath);
          resolve(result);
        } catch (e) { reject(e); }
        return;
      }
      if (Date.now() >= deadline) {
        reject(new Error("Cavalry non ha risposto. Assicurati che sia aperto."));
        return;
      }
      setTimeout(poll, 300);
    };
    poll();
  });
}

// ── claude CLI ───────────────────────────────────────────────────────────────

const SYSTEM = `Sei WhyCavalry, assistente AI per creare motion graphics in Cavalry.
Converti le richieste dell'utente in codice JavaScript eseguibile in Cavalry.

REGOLE IMPORTANTI:
- Metti sempre il codice JS tra <js> e </js>
- Fuori dai tag puoi spiegare brevemente in italiano (max 1-2 righe)
- Il codice ha accesso all'oggetto "api" di Cavalry
- Termina SEMPRE il codice con: JSON.stringify({...risultato...})
- Usa api.getActiveComp() per la comp corrente

API principali:
  api.createComp(name) → crea composizione, ritorna id
  api.setActiveComp(id) → imposta comp attiva
  api.set(id, {attrs}) → imposta attributi (width, height, fillColor, position, scale, opacity, text, fontSize...)
  api.create(type, name) → crea layer ("rectangle","ellipse","text","null","duplicator","javascript","polygon")
  api.keyframe(id, attr, frame, value) → aggiunge keyframe
  api.magicEasing(id, attr, startFrame, endFrame) → aggiunge easing fluido
  api.getActiveComp() → id comp attiva
  api.getCompLayers(compId) → array layer ids
  api.getNiceName(id) → nome del layer
  api.deleteLayer(id) → elimina layer
  api.parent(childId, parentId) → imposta genitore
  api.connect(fromId, toId, attr) → connette layer

Colori: usa hex "#ff0000". Position: [x, y]. Scale: [x, y].
frameRate default: 30. Duration in frames (150 = 5 secondi a 30fps).

Esempio risposta corretta:
Creo un cerchio rosso animato.
<js>
var comp = api.getActiveComp();
var circle = api.create("ellipse", "Cerchio");
api.set(circle, { width: 200, height: 200, fillColor: "#ff4444" });
api.keyframe(circle, "scale", 0, [0, 0]);
api.keyframe(circle, "scale", 20, [1.1, 1.1]);
api.keyframe(circle, "scale", 25, [1, 1]);
api.magicEasing(circle, "scale", 0, 25);
JSON.stringify({ layerId: circle, name: "Cerchio" })
</js>`;

function askClaude(userMessage, history) {
  return new Promise((resolve, reject) => {
    // Build conversation context as a single prompt
    const context = history.length > 0
      ? history.map(m => `${m.role === "user" ? "Utente" : "Assistant"}: ${m.content}`).join("\n") + "\n"
      : "";

    const fullPrompt = context + "Utente: " + userMessage;

    const claude = spawn("claude", ["--print", "-p", SYSTEM], {
      stdio: ["pipe", "pipe", "pipe"]
    });

    let output = "";
    let errOutput = "";

    claude.stdout.on("data", d => { output += d.toString(); });
    claude.stderr.on("data", d => { errOutput += d.toString(); });

    claude.on("close", code => {
      if (code !== 0 && !output) {
        reject(new Error("claude CLI error: " + errOutput.slice(0, 200)));
      } else {
        resolve(output.trim());
      }
    });

    claude.stdin.write(fullPrompt);
    claude.stdin.end();
  });
}

function extractScript(text) {
  // Try custom tags first, then markdown code blocks
  const tagMatch = text.match(/<js>([\s\S]*?)<\/js>/);
  if (tagMatch) return tagMatch[1].trim();
  const mdMatch = text.match(/```(?:js|javascript)?\n?([\s\S]*?)```/);
  if (mdMatch) return mdMatch[1].trim();
  return null;
}

function extractExplanation(text) {
  return text
    .replace(/<js>[\s\S]*?<\/js>/g, "")
    .replace(/```(?:js|javascript)?[\s\S]*?```/g, "")
    .trim();
}

// ── terminal UI ───────────────────────────────────────────────────────────────

const C = {
  reset:   "\x1b[0m",
  bold:    "\x1b[1m",
  dim:     "\x1b[2m",
  red:     "\x1b[31m",
  green:   "\x1b[32m",
  yellow:  "\x1b[33m",
  cyan:    "\x1b[36m",
  magenta: "\x1b[35m",
  white:   "\x1b[37m",
};

const p = (color, text) => console.log(color + text + C.reset);

async function main() {
  console.clear();

  p(C.bold + C.cyan,    "╔══════════════════════════════════════╗");
  p(C.bold + C.cyan,    "║   WhyCavalry  ⚡  Chat Standalone    ║");
  p(C.bold + C.cyan,    "╚══════════════════════════════════════╝");
  console.log();

  if (isCavalryOpen()) {
    p(C.green, "● Cavalry aperto e connesso");
  } else {
    p(C.yellow, "⚠  Cavalry non rilevato — aprilo per eseguire comandi");
  }

  console.log();
  p(C.dim, "Scrivi in italiano cosa vuoi creare. Comandi: /js <codice>  /status  /quit");
  console.log();

  const history = [];

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: C.bold + C.magenta + "Tu › " + C.reset,
  });

  rl.prompt();

  rl.on("line", async (line) => {
    const input = line.trim();
    if (!input) { rl.prompt(); return; }

    if (input === "/quit" || input === "/exit") {
      p(C.cyan, "Ciao!"); process.exit(0);
    }

    if (input === "/status") {
      p(isCavalryOpen() ? C.green : C.yellow,
        isCavalryOpen() ? "● Cavalry aperto" : "○ Cavalry chiuso");
      rl.prompt(); return;
    }

    if (input.startsWith("/js ")) {
      const script = input.slice(4).trim();
      process.stdout.write(C.dim + "Eseguendo..." + C.reset + " ");
      try {
        const res = await runInCavalry(script);
        process.stdout.write("\r" + " ".repeat(30) + "\r");
        p(res.success ? C.green : C.red,
          res.success ? "✓ " + JSON.stringify(res.value) : "✗ " + res.error);
      } catch(e) {
        process.stdout.write("\r" + " ".repeat(30) + "\r");
        p(C.red, "✗ " + e.message);
      }
      rl.prompt(); return;
    }

    // Natural language via claude CLI
    process.stdout.write(C.dim + "⏳ Elaborando..." + C.reset);

    try {
      const aiResponse = await askClaude(input, history);
      process.stdout.write("\r" + " ".repeat(30) + "\r");

      history.push({ role: "user", content: input });
      history.push({ role: "assistant", content: aiResponse });
      if (history.length > 20) history.splice(0, 2); // keep last 10 turns

      const explanation = extractExplanation(aiResponse);
      const script = extractScript(aiResponse);

      if (explanation) p(C.cyan, "● " + explanation);

      if (script) {
        process.stdout.write(C.dim + "→ Eseguendo in Cavalry..." + C.reset);
        try {
          const res = await runInCavalry(script);
          process.stdout.write("\r" + " ".repeat(40) + "\r");

          if (res.success) {
            const val = res.value;
            const summary = val && typeof val === "object"
              ? Object.entries(val).map(([k,v]) => `${k}: ${v}`).join("  ")
              : String(val ?? "ok");
            p(C.green, "✓ " + summary);
          } else {
            p(C.red, "✗ Errore Cavalry: " + res.error);
          }
        } catch(e) {
          process.stdout.write("\r" + " ".repeat(40) + "\r");
          p(C.red, "✗ " + e.message);
        }
      } else {
        // Solo risposta testuale, niente script
      }

    } catch(e) {
      process.stdout.write("\r" + " ".repeat(30) + "\r");
      p(C.red, "✗ Errore: " + e.message);
    }

    console.log();
    rl.prompt();
  });

  rl.on("close", () => { console.log(); process.exit(0); });
}

main().catch(e => {
  p("\x1b[31m", "Errore: " + e.message);
  process.exit(1);
});
