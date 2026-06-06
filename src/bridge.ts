import fs from "fs";
import path from "path";
import os from "os";
import { randomUUID } from "crypto";
import { execSync } from "child_process";

const BRIDGE_DIR = path.join(os.homedir(), ".whycavalry");
const CMD_DIR = path.join(BRIDGE_DIR, "cmd");
const RES_DIR = path.join(BRIDGE_DIR, "res");

export interface BridgeCommand {
  id: string;
  script: string;
  timestamp: number;
}

export interface BridgeResult {
  id: string;
  success: boolean;
  value?: unknown;
  error?: string;
}

export function ensureBridgeDirs(): void {
  [BRIDGE_DIR, CMD_DIR, RES_DIR].forEach((d) => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  });
}

export function queueCommand(script: string): string {
  ensureBridgeDirs();
  const id = randomUUID();
  const cmd: BridgeCommand = { id, script, timestamp: Date.now() };
  fs.writeFileSync(path.join(CMD_DIR, `${id}.json`), JSON.stringify(cmd));
  return id;
}

export async function waitForResult(
  id: string,
  timeoutMs = 15000
): Promise<BridgeResult> {
  const resultPath = path.join(RES_DIR, `${id}.json`);
  const deadline = Date.now() + timeoutMs;

  return new Promise((resolve, reject) => {
    const poll = () => {
      if (fs.existsSync(resultPath)) {
        try {
          const raw = fs.readFileSync(resultPath, "utf8");
          const result: BridgeResult = JSON.parse(raw);
          fs.unlinkSync(resultPath);
          resolve(result);
        } catch (e) {
          reject(new Error(`Failed to read result: ${e}`));
        }
        return;
      }
      if (Date.now() >= deadline) {
        reject(
          new Error(
            "Timeout: Cavalry did not respond. Make sure Cavalry is open."
          )
        );
        return;
      }
      setTimeout(poll, 300);
    };
    poll();
  });
}

function triggerCavalryBridge(): void {
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
  } catch {
    // Cavalry not open or not responding - result will timeout
  }
}

export async function runInCavalry(script: string): Promise<BridgeResult> {
  const id = queueCommand(script);
  triggerCavalryBridge();
  return waitForResult(id);
}

export function getBridgeDir(): string {
  return BRIDGE_DIR;
}

export function getCmdDir(): string {
  return CMD_DIR;
}

export function listPendingCommands(): string[] {
  ensureBridgeDirs();
  return fs
    .readdirSync(CMD_DIR)
    .filter((f) => f.endsWith(".json"));
}

export function clearPendingCommands(): number {
  ensureBridgeDirs();
  const files = fs.readdirSync(CMD_DIR).filter((f) => f.endsWith(".json"));
  files.forEach((f) => fs.unlinkSync(path.join(CMD_DIR, f)));
  return files.length;
}
