#!/bin/bash
# WhyCavalry Daemon - watches for commands and triggers Cavalry bridge

CMD_DIR="$HOME/.whycavalry/cmd"
mkdir -p "$CMD_DIR" "$HOME/.whycavalry/res"

trigger_cavalry() {
  osascript << 'APPLESCRIPT' 2>/dev/null
  tell application "System Events"
    if exists process "Cavalry" then
      tell process "Cavalry"
        tell menu "Scripts" of menu bar item "Scripts" of menu bar 1
          click menu item "WhyCavalry-Bridge"
        end tell
      end tell
    end if
  end tell
APPLESCRIPT
}

while true; do
  # Check if there are pending commands
  if ls "$CMD_DIR"/*.json 1>/dev/null 2>&1; then
    trigger_cavalry
    sleep 0.5
  fi
  sleep 0.4
done
