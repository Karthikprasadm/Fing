using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

namespace CueKeyHook
{
    class Program
    {
        private const int WH_KEYBOARD_LL = 13;
        private const int WM_KEYDOWN = 0x0100;
        private const int WM_KEYUP = 0x0101;
        private const int WM_SYSKEYDOWN = 0x0104;
        private const int WM_SYSKEYUP = 0x0105;

        private const int VK_SHIFT = 0x10;
        private const int VK_CONTROL = 0x11;
        private const int VK_MENU = 0x12; // Alt
        private const int VK_BACK = 0x08;
        private const int VK_TAB = 0x09;
        private const int VK_RETURN = 0x0D;
        private const int VK_ESCAPE = 0x1B;
        private const int VK_SPACE = 0x20;
        private const int VK_LEFT = 0x25;
        private const int VK_UP = 0x26;
        private const int VK_RIGHT = 0x27;
        private const int VK_DOWN = 0x28;
        private const int VK_HOME = 0x24;
        private const int VK_END = 0x23;
        private const int VK_DELETE = 0x2E;

        private delegate IntPtr LowLevelKeyboardProc(int nCode, IntPtr wParam, IntPtr lParam);
        private static LowLevelKeyboardProc _proc = HookCallback;
        private static IntPtr _hookId = IntPtr.Zero;
        private static volatile bool _isActive = false;

        [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        private static extern IntPtr SetWindowsHookEx(int idHook, LowLevelKeyboardProc lpfn, IntPtr hMod, uint dwThreadId);

        [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)]
        private static extern bool UnhookWindowsHookEx(IntPtr hhk);

        [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        private static extern IntPtr CallNextHookEx(IntPtr hhk, int nCode, IntPtr wParam, IntPtr lParam);

        [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        private static extern IntPtr GetModuleHandle(string lpModuleName);

        [DllImport("user32.dll")]
        private static extern bool GetKeyboardState(byte[] lpKeyState);

        [DllImport("user32.dll")]
        private static extern uint MapVirtualKey(uint uCode, uint uMapType);

        [DllImport("user32.dll")]
        private static extern int ToUnicode(uint wVirtKey, uint wScanCode, byte[] lpKeyState,
            [Out, MarshalAs(UnmanagedType.LPWStr, SizeConst = 64)] StringBuilder pwszBuff, int cchBuff, uint wFlags);

        [DllImport("user32.dll")]
        private static extern short GetKeyState(int nVirtKey);

        [DllImport("user32.dll")]
        private static extern short GetAsyncKeyState(int vKey);

        [DllImport("user32.dll")]
        private static extern bool GetMessage(out MSG lpMsg, IntPtr hWnd, uint wMsgFilterMin, uint wMsgFilterMax);

        [DllImport("user32.dll")]
        private static extern bool TranslateMessage([In] ref MSG lpMsg);

        [DllImport("user32.dll")]
        private static extern IntPtr DispatchMessage([In] ref MSG lpMsg);

        [DllImport("user32.dll")]
        private static extern IntPtr GetForegroundWindow();

        [DllImport("user32.dll")]
        private static extern bool SetForegroundWindow(IntPtr hWnd);

        [DllImport("user32.dll")]
        private static extern bool BringWindowToTop(IntPtr hWnd);

        [DllImport("user32.dll")]
        private static extern bool AllowSetForegroundWindow(int dwProcessId);

        [DllImport("user32.dll")]
        private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

        [DllImport("user32.dll")]
        private static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);

        [DllImport("kernel32.dll")]
        private static extern uint GetCurrentThreadId();

        [DllImport("user32.dll", EntryPoint = "GetWindowLong")]
        private static extern int GetWindowLong32(IntPtr hWnd, int nIndex);

        [DllImport("user32.dll", EntryPoint = "GetWindowLongPtr")]
        private static extern IntPtr GetWindowLongPtr64(IntPtr hWnd, int nIndex);

        [DllImport("user32.dll", EntryPoint = "SetWindowLong")]
        private static extern int SetWindowLong32(IntPtr hWnd, int nIndex, int dwNewLong);

        [DllImport("user32.dll", EntryPoint = "SetWindowLongPtr")]
        private static extern IntPtr SetWindowLongPtr64(IntPtr hWnd, int nIndex, IntPtr dwNewLong);

        [DllImport("user32.dll")]
        private static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
        private delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

        private static IntPtr GetWindowLongPtr(IntPtr hWnd, int nIndex)
        {
            if (IntPtr.Size == 8)
                return GetWindowLongPtr64(hWnd, nIndex);
            return new IntPtr(GetWindowLong32(hWnd, nIndex));
        }

        private static IntPtr SetWindowLongPtr(IntPtr hWnd, int nIndex, IntPtr dwNewLong)
        {
            if (IntPtr.Size == 8)
                return SetWindowLongPtr64(hWnd, nIndex, dwNewLong);
            return new IntPtr(SetWindowLong32(hWnd, nIndex, dwNewLong.ToInt32()));
        }

        private const int GWL_EXSTYLE = -20;
        private const long WS_EX_NOACTIVATE = 0x08000000L;
        private const long WS_EX_TOOLWINDOW = 0x00000080L;
        private const long WS_EX_APPWINDOW = 0x00040000L;

        [DllImport("user32.dll")]
        private static extern bool GetCursorPos(out POINT lpPoint);

        [DllImport("user32.dll")]
        private static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

        [DllImport("user32.dll", SetLastError = true)]
        private static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);

        [StructLayout(LayoutKind.Sequential)]
        public struct POINT
        {
            public int X;
            public int Y;
        }

        [StructLayout(LayoutKind.Sequential)]
        public struct RECT
        {
            public int Left;
            public int Top;
            public int Right;
            public int Bottom;
        }

        private const uint SWP_NOSIZE = 0x0001;
        private const uint SWP_NOZORDER = 0x0004;
        private const uint SWP_NOACTIVATE = 0x0010;

        private static volatile bool _isDragging = false;
        private static Thread _dragThread = null;

        private static void StartDragging()
        {
            if (_cueHwnd == IntPtr.Zero) return;
            _isDragging = false;
            if (_dragThread != null && _dragThread.IsAlive)
            {
                try { _dragThread.Abort(); } catch {}
            }

            POINT startPt;
            GetCursorPos(out startPt);
            RECT winRect;
            GetWindowRect(_cueHwnd, out winRect);
            int grabOffsetX = startPt.X - winRect.Left;
            int grabOffsetY = startPt.Y - winRect.Top;

            _isDragging = true;
            _dragThread = new Thread(() =>
            {
                while (_isDragging)
                {
                    // Check if left mouse button is still held down (0x01 = VK_LBUTTON)
                    if ((GetAsyncKeyState(0x01) & 0x8000) == 0)
                    {
                        _isDragging = false;
                        break;
                    }

                    POINT cur;
                    GetCursorPos(out cur);
                    int targetX = cur.X - grabOffsetX;
                    int targetY = cur.Y - grabOffsetY;

                    SetWindowPos(_cueHwnd, IntPtr.Zero, targetX, targetY, 0, 0, SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE);

                    if (_lastBackgroundHwnd != IntPtr.Zero)
                    {
                        IntPtr fg = GetForegroundWindow();
                        if (fg == _cueHwnd)
                        {
                            ForceForeground(_lastBackgroundHwnd);
                        }
                    }

                    Thread.Sleep(2);
                }
            });
            _dragThread.IsBackground = true;
            _dragThread.Priority = ThreadPriority.Highest;
            _dragThread.Start();
        }

        private static void StopDragging()
        {
            _isDragging = false;
            if (_lastBackgroundHwnd != IntPtr.Zero)
            {
                ForceForeground(_lastBackgroundHwnd);
            }
        }

        private static IntPtr _cueHwnd = IntPtr.Zero;
        private static uint _cuePid = 0;
        private static IntPtr _lastBackgroundHwnd = IntPtr.Zero;
        private static bool _allowCueFocus = false;

        private static void ApplyExStyle(IntPtr hWnd, bool enable)
        {
            if (hWnd == IntPtr.Zero) return;
            try
            {
                IntPtr exStyle = GetWindowLongPtr(hWnd, GWL_EXSTYLE);
                long current = exStyle.ToInt64();
                long updated = (current | WS_EX_TOOLWINDOW) & ~WS_EX_APPWINDOW;
                updated = enable ? (updated | WS_EX_NOACTIVATE) : (updated & ~WS_EX_NOACTIVATE);
                if (updated != current)
                {
                    SetWindowLongPtr(hWnd, GWL_EXSTYLE, new IntPtr(updated));
                }
            }
            catch {}
        }

        private static void SetCueNoActivate(bool enable)
        {
            if (_cueHwnd != IntPtr.Zero)
            {
                ApplyExStyle(_cueHwnd, enable);
            }
            if (_cuePid == 0) return;
            try
            {
                EnumWindows(delegate(IntPtr hWnd, IntPtr lParam)
                {
                    uint pid;
                    GetWindowThreadProcessId(hWnd, out pid);
                    if (pid == _cuePid)
                    {
                        ApplyExStyle(hWnd, enable);
                    }
                    return true;
                }, IntPtr.Zero);
            }
            catch {}
        }

        private static void ForceForeground(IntPtr hWnd)
        {
            if (hWnd == IntPtr.Zero) return;
            try
            {
                AllowSetForegroundWindow(-1);
                IntPtr currentFg = GetForegroundWindow();
                if (currentFg == hWnd) return;

                uint dummyPid;
                uint currentThreadId = GetWindowThreadProcessId(currentFg, out dummyPid);
                uint targetThreadId = GetWindowThreadProcessId(hWnd, out dummyPid);
                uint myThreadId = GetCurrentThreadId();

                AttachThreadInput(myThreadId, targetThreadId, true);
                AttachThreadInput(currentThreadId, targetThreadId, true);
                SetForegroundWindow(hWnd);
                BringWindowToTop(hWnd);
                AttachThreadInput(currentThreadId, targetThreadId, false);
                AttachThreadInput(myThreadId, targetThreadId, false);
            }
            catch
            {
                SetForegroundWindow(hWnd);
            }
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct MSG
        {
            public IntPtr hwnd;
            public uint message;
            public IntPtr wParam;
            public IntPtr lParam;
            public uint time;
            public System.Drawing.Point pt;
        }

        static void Main(string[] args)
        {
            try
            {
                Console.OutputEncoding = Encoding.UTF8;
                Console.InputEncoding = Encoding.UTF8;
            }
            catch {}

            _hookId = SetHook(_proc);
            uint myPid = (uint)System.Diagnostics.Process.GetCurrentProcess().Id;

            // Continuous background focus guard: ensures background app NEVER loses focus while Ghost Mode is active
            Thread focusGuardThread = new Thread(() =>
            {
                while (true)
                {
                    try
                    {
                        IntPtr fg = GetForegroundWindow();
                        if (fg != IntPtr.Zero)
                        {
                            uint fgPid;
                            GetWindowThreadProcessId(fg, out fgPid);
                            bool isCueWindow = (fgPid == _cuePid && _cuePid != 0) || fgPid == myPid || fg == _cueHwnd;

                            if (!isCueWindow)
                            {
                                _lastBackgroundHwnd = fg;
                            }
                            else if ((_isActive || !_allowCueFocus) && _lastBackgroundHwnd != IntPtr.Zero)
                            {
                                ForceForeground(_lastBackgroundHwnd);
                            }
                        }
                    }
                    catch {}
                    Thread.Sleep(15);
                }
            });
            focusGuardThread.IsBackground = true;
            focusGuardThread.Start();

            // Background thread to read commands from stdin
            Thread inputThread = new Thread(() =>
            {
                string line;
                while ((line = Console.ReadLine()) != null)
                {
                    line = line.Trim();
                    if (line.StartsWith("HWND "))
                    {
                        long h;
                        if (long.TryParse(line.Substring(5).Trim(), out h))
                        {
                            _cueHwnd = (IntPtr)h;
                            SetCueNoActivate(!_allowCueFocus);
                        }
                    }
                    else if (line.StartsWith("PID "))
                    {
                        uint p;
                        if (uint.TryParse(line.Substring(4).Trim(), out p))
                        {
                            _cuePid = p;
                            SetCueNoActivate(true);
                        }
                    }
                    else if (line.Equals("ALLOW_FOCUS 1", StringComparison.OrdinalIgnoreCase))
                    {
                        _allowCueFocus = true;
                        _isActive = false;
                        SetCueNoActivate(false);
                    }
                    else if (line.Equals("ALLOW_FOCUS 0", StringComparison.OrdinalIgnoreCase))
                    {
                        _allowCueFocus = false;
                        SetCueNoActivate(true);
                        if (_lastBackgroundHwnd != IntPtr.Zero)
                        {
                            ForceForeground(_lastBackgroundHwnd);
                        }
                    }
                    else if (line.Equals("INPUT_FOCUSED 1", StringComparison.OrdinalIgnoreCase) ||
                             line.Equals("INPUT_FOCUSED 0", StringComparison.OrdinalIgnoreCase))
                    {
                        _allowCueFocus = false;
                        SetCueNoActivate(true);
                    }
                    else if (line.Equals("ACTIVE 1", StringComparison.OrdinalIgnoreCase))
                    {
                        _isActive = true;
                        _allowCueFocus = false;
                        SetCueNoActivate(true);
                        IntPtr fg = GetForegroundWindow();
                        if (fg != IntPtr.Zero)
                        {
                            uint fgPid;
                            GetWindowThreadProcessId(fg, out fgPid);
                            if (fgPid != _cuePid && fgPid != myPid && fg != _cueHwnd)
                            {
                                _lastBackgroundHwnd = fg;
                            }
                        }
                        if (_lastBackgroundHwnd != IntPtr.Zero)
                        {
                            ForceForeground(_lastBackgroundHwnd);
                        }
                    }
                    else if (line.Equals("ACTIVE 0", StringComparison.OrdinalIgnoreCase))
                    {
                        _isActive = false;
                        SetCueNoActivate(true);
                    }
                    else if (line.Equals("RESTORE_FG", StringComparison.OrdinalIgnoreCase))
                    {
                        if (_lastBackgroundHwnd != IntPtr.Zero)
                        {
                            ForceForeground(_lastBackgroundHwnd);
                        }
                    }
                    else if (line.Equals("DRAG_START", StringComparison.OrdinalIgnoreCase))
                    {
                        StartDragging();
                    }
                    else if (line.Equals("DRAG_STOP", StringComparison.OrdinalIgnoreCase))
                    {
                        StopDragging();
                    }
                    else if (line.Equals("EXIT", StringComparison.OrdinalIgnoreCase))
                    {
                        Environment.Exit(0);
                    }
                }
            });
            inputThread.IsBackground = true;
            inputThread.Start();

            Console.WriteLine("READY");
            Console.Out.Flush();

            MSG msg;
            while (GetMessage(out msg, IntPtr.Zero, 0, 0))
            {
                TranslateMessage(ref msg);
                DispatchMessage(ref msg);
            }

            UnhookWindowsHookEx(_hookId);
        }

        private static IntPtr SetHook(LowLevelKeyboardProc proc)
        {
            using (Process curProcess = Process.GetCurrentProcess())
            using (ProcessModule curModule = curProcess.MainModule)
            {
                return SetWindowsHookEx(WH_KEYBOARD_LL, proc, GetModuleHandle(curModule.ModuleName), 0);
            }
        }

        private static IntPtr HookCallback(int nCode, IntPtr wParam, IntPtr lParam)
        {
            if (nCode >= 0)
            {
                int msg = wParam.ToInt32();
                bool isKeyDown = (msg == WM_KEYDOWN || msg == WM_SYSKEYDOWN);

                if (isKeyDown && _isActive)
                {
                    int vkCode = Marshal.ReadInt32(lParam);

                    // Allow modifier keys alone to update OS state
                    if (vkCode == VK_SHIFT || vkCode == VK_CONTROL || vkCode == VK_MENU ||
                        vkCode == 0xA0 || vkCode == 0xA1 || // L/R Shift
                        vkCode == 0xA2 || vkCode == 0xA3 || // L/R Ctrl
                        vkCode == 0xA4 || vkCode == 0xA5)   // L/R Alt
                    {
                        return CallNextHookEx(_hookId, nCode, wParam, lParam);
                    }

                    bool shiftPressed = (GetAsyncKeyState(VK_SHIFT) & 0x8000) != 0 ||
                                        (GetAsyncKeyState(0xA0) & 0x8000) != 0 ||
                                        (GetAsyncKeyState(0xA1) & 0x8000) != 0;
                    bool ctrlPressed = (GetAsyncKeyState(VK_CONTROL) & 0x8000) != 0 ||
                                       (GetAsyncKeyState(0xA2) & 0x8000) != 0 ||
                                       (GetAsyncKeyState(0xA3) & 0x8000) != 0;
                    bool altPressed = (GetAsyncKeyState(VK_MENU) & 0x8000) != 0 ||
                                      (GetAsyncKeyState(0xA4) & 0x8000) != 0 ||
                                      (GetAsyncKeyState(0xA5) & 0x8000) != 0;
                    bool capsLock = (GetKeyState(0x14) & 1) != 0;

                    // Escape pauses Ghost capture, allowing background window to receive Esc and all subsequent keys
                    if (vkCode == VK_ESCAPE)
                    {
                        _isActive = false;
                        Console.WriteLine("EVENT:PAUSE");
                        Console.Out.Flush();
                        return CallNextHookEx(_hookId, nCode, wParam, lParam);
                    }

                    // Return / Enter
                    if (vkCode == VK_RETURN)
                    {
                        if (shiftPressed)
                        {
                            Console.WriteLine("EVENT:NEWLINE");
                        }
                        else
                        {
                            Console.WriteLine("EVENT:SUBMIT");
                        }
                        Console.Out.Flush();
                        return (IntPtr)1;
                    }

                    // Ctrl Shortcuts
                    if (ctrlPressed && !altPressed)
                    {
                        if (vkCode == 0x41) // Ctrl+A
                        {
                            Console.WriteLine("EVENT:SELECT_ALL");
                            Console.Out.Flush();
                            return (IntPtr)1;
                        }
                        if (vkCode == 0x43) // Ctrl+C
                        {
                            Console.WriteLine("EVENT:COPY");
                            Console.Out.Flush();
                            return (IntPtr)1;
                        }
                        if (vkCode == 0x58) // Ctrl+X
                        {
                            Console.WriteLine("EVENT:CUT");
                            Console.Out.Flush();
                            return (IntPtr)1;
                        }
                        if (vkCode == 0x56) // Ctrl+V
                        {
                            Console.WriteLine("EVENT:PASTE");
                            Console.Out.Flush();
                            return (IntPtr)1;
                        }
                        if (vkCode == 0x5A) // Ctrl+Z
                        {
                            Console.WriteLine("EVENT:UNDO");
                            Console.Out.Flush();
                            return (IntPtr)1;
                        }
                        if (vkCode == 0x59) // Ctrl+Y
                        {
                            Console.WriteLine("EVENT:REDO");
                            Console.Out.Flush();
                            return (IntPtr)1;
                        }
                        if (vkCode == VK_BACK) // Ctrl+Backspace
                        {
                            Console.WriteLine("EVENT:WORD_BACKSPACE");
                            Console.Out.Flush();
                            return (IntPtr)1;
                        }
                        if (vkCode == VK_DELETE) // Ctrl+Delete
                        {
                            Console.WriteLine("EVENT:WORD_DELETE");
                            Console.Out.Flush();
                            return (IntPtr)1;
                        }
                        if (vkCode == VK_LEFT) // Ctrl+Left
                        {
                            Console.WriteLine("EVENT:WORD_LEFT");
                            Console.Out.Flush();
                            return (IntPtr)1;
                        }
                        if (vkCode == VK_RIGHT) // Ctrl+Right
                        {
                            Console.WriteLine("EVENT:WORD_RIGHT");
                            Console.Out.Flush();
                            return (IntPtr)1;
                        }
                    }

                    // Navigation and Selection with Shift
                    if (vkCode == VK_LEFT)
                    {
                        Console.WriteLine(shiftPressed ? "EVENT:SELECT_LEFT" : "EVENT:ARROW_LEFT");
                        Console.Out.Flush();
                        return (IntPtr)1;
                    }

                    if (vkCode == VK_RIGHT)
                    {
                        Console.WriteLine(shiftPressed ? "EVENT:SELECT_RIGHT" : "EVENT:ARROW_RIGHT");
                        Console.Out.Flush();
                        return (IntPtr)1;
                    }

                    if (vkCode == VK_HOME)
                    {
                        Console.WriteLine(shiftPressed ? "EVENT:SELECT_HOME" : "EVENT:HOME");
                        Console.Out.Flush();
                        return (IntPtr)1;
                    }

                    if (vkCode == VK_END)
                    {
                        Console.WriteLine(shiftPressed ? "EVENT:SELECT_END" : "EVENT:END");
                        Console.Out.Flush();
                        return (IntPtr)1;
                    }

                    if (vkCode == VK_SPACE)
                    {
                        Console.WriteLine("EVENT:SPACE");
                        Console.Out.Flush();
                        return (IntPtr)1;
                    }

                    if (vkCode == VK_BACK)
                    {
                        Console.WriteLine("EVENT:BACKSPACE");
                        Console.Out.Flush();
                        return (IntPtr)1;
                    }

                    if (vkCode == VK_DELETE)
                    {
                        Console.WriteLine("EVENT:DELETE");
                        Console.Out.Flush();
                        return (IntPtr)1;
                    }

                    if (vkCode == VK_TAB)
                    {
                        Console.WriteLine("CHAR:\t");
                        Console.Out.Flush();
                        return (IntPtr)1;
                    }

                    // Character translation with accurate modifier state for Shift / Caps / AltGr
                    byte[] keyState = new byte[256];
                    GetKeyboardState(keyState);

                    if (shiftPressed)
                    {
                        keyState[VK_SHIFT] = 0x80;
                        keyState[0xA0] = 0x80;
                    }
                    else
                    {
                        keyState[VK_SHIFT] = 0;
                        keyState[0xA0] = 0;
                    }

                    if (ctrlPressed)
                    {
                        keyState[VK_CONTROL] = 0x80;
                        keyState[0xA2] = 0x80;
                    }
                    else
                    {
                        keyState[VK_CONTROL] = 0;
                        keyState[0xA2] = 0;
                    }

                    if (altPressed)
                    {
                        keyState[VK_MENU] = 0x80;
                        keyState[0xA4] = 0x80;
                    }
                    else
                    {
                        keyState[VK_MENU] = 0;
                        keyState[0xA4] = 0;
                    }

                    if (capsLock) keyState[0x14] = 0x01;
                    else keyState[0x14] = 0;

                    bool numLock = (GetKeyState(0x90) & 1) != 0;
                    keyState[0x90] = numLock ? (byte)0x01 : (byte)0x00;

                    if (vkCode >= 0 && vkCode < 256)
                    {
                        keyState[vkCode] = 0x80;
                    }

                    uint scanCode = MapVirtualKey((uint)vkCode, 0);
                    StringBuilder sb = new StringBuilder(64);
                    int result = ToUnicode((uint)vkCode, scanCode, keyState, sb, sb.Capacity, 0);

                    if (result > 0)
                    {
                        string text = sb.ToString();
                        foreach (char c in text)
                        {
                            if (!char.IsControl(c) || c == ' ' || c == '\t')
                            {
                                Console.WriteLine("CHAR:" + c);
                            }
                        }
                        Console.Out.Flush();
                        return (IntPtr)1; // Suppress keystroke from background app
                    }
                    else if (result < 0)
                    {
                        // Dead key (accent)
                        return (IntPtr)1;
                    }
                }
            }

            return CallNextHookEx(_hookId, nCode, wParam, lParam);
        }
    }
}
