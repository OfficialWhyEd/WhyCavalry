<p align="center">
  <img src="assets/banner.png" alt="WhyCavalry" width="100%"/>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Electron-Node.js-47848F?style=flat-square&logo=electron&logoColor=white" />
  <img src="https://img.shields.io/badge/Claude-Code_CLI-D97706?style=flat-square" />
  <img src="https://img.shields.io/badge/Cavalry-Bridge-00B4CC?style=flat-square" />
  <img src="https://img.shields.io/badge/macOS-only-000000?style=flat-square&logo=apple&logoColor=white" />
  <img src="https://img.shields.io/badge/status-active-brightgreen?style=flat-square" />
</p>

<br/>

> AI chat per Cavalry. Descrivi l'animazione in italiano — WhyCavalry genera il codice JavaScript e lo esegue direttamente nella scena aperta.

---

## Come funziona

```
Chat UI → Claude Code CLI → bridge file → Cavalry (Scripts menu)
                ↑
         contesto scena corrente
```

| Layer | Descrizione |
|-------|-------------|
| **UI** | Chat Electron, dark, sidebar conversazioni |
| **AI** | Claude Code CLI — conosce le API Cavalry JS |
| **Bridge** | File bridge `~/.whycavalry/` + osascript trigger |
| **Cavalry** | Esegue lo script generato via menu Scripts |

---

<p align="center">
  <img src="assets/screenshot.png" alt="WhyCavalry UI" width="100%"/>
</p>

---

## Features

- **Chat naturale** — descrivi l'animazione in italiano, ottieni codice JS pronto
- **Bridge automatico** — nessun copia-incolla: lo script arriva direttamente in Cavalry
- **Sidebar conversazioni** — storico delle sessioni, puoi riprendere da dove eri
- **Zero API key** — usa Claude Code CLI (Claude Pro), nessun costo extra
- **Dark UI** — interfaccia minimalista, Electron nativo macOS

---

## Stack

- **App**: Electron + Node.js
- **UI**: HTML/CSS/JS nativo (renderer)
- **AI**: Claude Code CLI (`claude --print`)
- **Bridge**: File system + AppleScript → Cavalry Scripts menu
- **Prerequisito**: Cavalry installato + Claude Code autenticato

---

## Setup

```bash
git clone https://github.com/OfficialWhyEd/WhyCavalry
cd WhyCavalry

npm install
npm start

# oppure
open /Applications/WhyCavalry.app
```

Cavalry deve essere aperto con una scena attiva.

---

## Struttura

```
WhyCavalry/
├── electron-main.js   # Electron main process
├── preload.js         # Bridge sicuro renderer ↔ main
├── renderer/          # Chat UI
├── app.js             # AI pipeline + file bridge
└── cavalry-scripts/   # Script Cavalry predefiniti
```

---

<p align="center">Built by <a href="https://github.com/OfficialWhyEd">@whyed</a> · macOS · Cavalry + Claude · MIT License</p>
