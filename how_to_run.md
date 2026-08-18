# How to Run cue on Windows

This guide provides step-by-step instructions to set up and run `cue` from source on **Windows 10** or **Windows 11**.

---

## 📋 Prerequisites
*   **Node.js**: Version `22.12.0` or higher. Check your current version by running:
    ```powershell
    node -v
    ```
*   **Git**: To clone the repository (if not downloaded as a zip).

---

## 🚀 Running the App (Step-by-Step)

### 1. Clone & Navigate to Repository
Open your terminal (PowerShell, Command Prompt, or Git Bash) and run:
```bash
git clone https://github.com/Karthikprasadm/Fing.git
cd Fing
```

### 2. Bypass PowerShell Script Policy (Required for PowerShell)
Windows PowerShell blocks script wrappers (like `npm.ps1`) by default. To bypass this policy for your current terminal session (does not require administrator privileges), run:
```powershell
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process
```
*Alternatively, you can bypass this by appending `.cmd` to your npm calls (e.g., `npm.cmd` instead of `npm`).*

### 3. Install Dependencies
Install the required packages:
```powershell
npm install
```
*(If you get a script restriction warning, run `npm.cmd install` instead).*

### 4. Start the Application
Start the Electron desktop overlay:
```powershell
npm start
```
*(Or `npm.cmd start` if the script policy blocks it).*

---

## 🛠️ Troubleshooting

### "Script Execution is Disabled" Error
If you see the following security block:
```text
npm : File C:\Program Files\nodejs\npm.ps1 cannot be loaded because running scripts is disabled on this system.
```
Run this to bypass it for your active command window:
```powershell
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process
```
Or run the commands explicitly utilizing the command-line executor wrappers:
*   `npm.cmd install`
*   `npm.cmd start`

### How to Force Stop the App
Since `cue` runs as an invisible background overlay without a taskbar or dock icon:
*   Press **`Ctrl` + `Shift` + `X`** on your keyboard to trigger the global exit.
*   Or press **`Ctrl` + `C`** in the PowerShell window that started it.
*   Or click the **`✕`** icon in the overlay toolbar (top pill).
