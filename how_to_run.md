# How to Run `cue` on Windows

This guide provides step-by-step instructions to set up, launch, and troubleshoot the `cue` copilot overlay on **Windows 10** and **Windows 11**.

---

## 📋 Prerequisites

1. **Node.js**: Version `22.12.0` or higher.
   Verify your version:
   ```powershell
   node -v
   ```
2. **Git**: Required if cloning the repository directly.
3. **Display**: Windows 10 (build 19041+) or Windows 11 recommended for full window transparency and screen-share capture protection (`WDA_EXCLUDEFROMCAPTURE`).

---

## ⚡ Quick Start (One-Click)

The repository includes a dedicated launcher script: [`run.bat`](file:///d:/cue/run.bat).

1. Open Windows File Explorer to the project folder (`D:\cue`).
2. **Double-click `run.bat`**.
3. The floating overlay will launch and appear at the top-center of your screen.

---

## 💻 Running from Terminal (Step-by-Step)

If you prefer running via PowerShell or Command Prompt:

### 1. Open Your Terminal in the Project Directory
```powershell
cd D:\cue
```

### 2. Install Dependencies
```powershell
npm.cmd install
```
> [!NOTE]
> Always use `npm.cmd` on Windows rather than `npm` to bypass PowerShell's default script execution restrictions without needing administrator access.

### 3. Start the Application
```powershell
npm.cmd start
```
*(Alternatively, run `.\run.bat` directly from the terminal).*

---

## 🎮 Interacting with the Overlay

Once launched, `cue` displays as a frosted-glass HUD anchored at the top of your primary monitor.

### Global Hotkeys

| Function | Shortcut | Action |
| :--- | :--- | :--- |
| **Assist Mode** | `Ctrl` + `Enter` | Analyzes screen content & conversation and suggests what to say |
| **Say Mode** | `Ctrl` + `Shift` + `Enter` | Generates a quick, natural spoken response |
| **LeetCode Mode** | `Ctrl` + `H` | Solves technical/coding questions with approach and time/space complexity |
| **Boss Key (Toggle)** | `Ctrl` + `Shift` + `Z` | Instantly toggles hide / show of the overlay |
| **Toggle HUD** | `Ctrl` + `Shift` + `/` | Collapses or expands the transcript/response panel |
| **Force Quit** | `Ctrl` + `Shift` + `X` | Cleanly exits the application |

---

## 🕵️ Stealth Architecture & Complete Invisibility

- **No Taskbar Icon**: The app is completely hidden from the Windows Taskbar (`skipTaskbar: true` and `WS_EX_TOOLWINDOW`).
- **Hidden from Alt + Tab**: The app does not appear when cycling through open windows with `Alt` + `Tab`.
- **Screen Share Protection**: Content protection (`WDA_EXCLUDEFROMCAPTURE`) is enabled so the overlay remains invisible in Zoom, Teams, and Google Meet screen shares.
- **Disguised Process**: In Windows Task Manager, the process is disguised as **`MicrosoftEdgeUpdate.exe`**.

---

## 🛠️ Troubleshooting

### 1. "File npm.ps1 cannot be loaded because running scripts is disabled"
Windows PowerShell blocks script wrappers by default. To resolve:
- Run commands with `.cmd`: `npm.cmd install` and `npm.cmd start`
- Or use the one-click launcher: `.\run.bat`
- Or temporarily bypass the policy in your current session:
  ```powershell
  Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process
  ```

### 2. "The app is running but I can't see it"
- Check the top-middle of your screen: look for the frosted glass bar with the **Drag** pill and icons.
- Press **`Ctrl` + `Shift` + `Z`** (the Boss Key) to toggle visibility and force the window to the front.
- If you have multiple monitors, `cue` anchors to the primary display. You can click and hold the **`Drag`** handle to move it anywhere.

### 3. How to Force Close / Stop the App
- Press **`Ctrl` + `Shift` + `X`** on your keyboard.
- Click the **`✕`** icon on the far right of the top toolbar pill.
- In PowerShell / Command Prompt, terminate with:
  ```powershell
  Stop-Process -Name "MicrosoftEdgeUpdate" -Force
  ```
