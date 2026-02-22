const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { exec, execFile, spawn } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

const isDev = !app.isPackaged;

// ── Python backend ────────────────────────────────────────────────────────────

let pyProcess = null;

function startPythonServer() {
  const pythonPath = path.join(__dirname, '..', 'venv', 'bin', 'python3');
  const serverPath = path.join(__dirname, '..', 'backend', 'server.py');

  pyProcess = spawn(pythonPath, [serverPath], {
    cwd: path.join(__dirname, '..', 'backend'),
  });

  pyProcess.stdout.on('data', (data) => console.log('[python]', data.toString().trim()));
  pyProcess.stderr.on('data', (data) => console.error('[python]', data.toString().trim()));
  pyProcess.on('exit', (code) => console.log('[python] exited with code', code));
}

// ── WSL helpers ──────────────────────────────────────────────────────────────

function isWSL() {
  try {
    return fs.readFileSync('/proc/version', 'utf8').toLowerCase().includes('microsoft');
  } catch {
    return false;
  }
}

const _isWSL = isWSL();

function getWindowsHome() {
  const linuxUser = os.userInfo().username;
  const direct = `/mnt/c/Users/${linuxUser}`;
  if (fs.existsSync(direct)) return direct;
  try {
    const system = new Set(['Public', 'Default', 'Default User', 'All Users']);
    const entries = fs.readdirSync('/mnt/c/Users').filter(d => !system.has(d));
    if (entries.length) return `/mnt/c/Users/${entries[0]}`;
  } catch {}
  return fs.existsSync('/mnt/c') ? '/mnt/c' : os.homedir();
}

function addWindowsGtkBookmarks(winHome) {
  const bookmarksFile = path.join(os.homedir(), '.config', 'gtk-3.0', 'bookmarks');
  const toAdd = [
    [`file://${winHome}`, 'Windows Home'],
    [`file://${winHome}/Desktop`, 'Windows Desktop'],
    [`file://${winHome}/Downloads`, 'Windows Downloads'],
    [`file://${winHome}/Videos`, 'Windows Videos'],
  ].filter(([uri]) => fs.existsSync(uri.replace('file://', '')));
  try {
    fs.mkdirSync(path.dirname(bookmarksFile), { recursive: true });
    const existing = fs.existsSync(bookmarksFile)
      ? fs.readFileSync(bookmarksFile, 'utf8') : '';
    const newLines = toAdd
      .filter(([uri]) => !existing.includes(uri))
      .map(([uri, label]) => `${uri} ${label}`)
      .join('\n');
    if (newLines) fs.appendFileSync(bookmarksFile, '\n' + newLines + '\n');
  } catch {}
}

// ── Windows native file dialog via PowerShell ────────────────────────────────

async function openWindowsFileDialog() {
  const psCode = `
Add-Type -AssemblyName System.Windows.Forms
$d = New-Object System.Windows.Forms.OpenFileDialog
$d.Title = 'Open Video Files'
$d.Filter = 'Video Files|*.mp4;*.mov;*.avi;*.mkv;*.webm;*.flv;*.m4v'
$d.Multiselect = $true
if ($d.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
  $d.FileNames | ForEach-Object { Write-Output $_ }
}
`;
  try {
    const encoded = Buffer.from(psCode, 'utf16le').toString('base64');
    const { stdout } = await execAsync(
      `powershell.exe -NoProfile -Sta -EncodedCommand ${encoded}`
    );
    const winPaths = stdout.trim().split(/\r?\n/).filter(Boolean);
    if (!winPaths.length) return []; // user cancelled — dialog worked, just no selection
    const wslPaths = await Promise.all(
      winPaths.map(p =>
        execFileAsync('wslpath', ['-u', p]).then(({ stdout: s }) => s.trim())
      )
    );
    return wslPaths;
  } catch (e) {
    console.error('Windows dialog failed, falling back to GTK:', e.message);
    return null;
  }
}

// ── Suppress WSL GPU noise ───────────────────────────────────────────────────
if (_isWSL) {
  app.commandLine.appendSwitch('in-process-gpu');
  app.commandLine.appendSwitch('disable-gpu-sandbox');
}

// ── Window creation ──────────────────────────────────────────────────────────

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    frame: false,
    backgroundColor: '#1e1e1e',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
    },
  });

  if (isDev) {
    win.loadURL('http://localhost:5173');
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

// ── IPC handlers ─────────────────────────────────────────────────────────────

ipcMain.on('window:minimize', () => BrowserWindow.getFocusedWindow()?.minimize());
ipcMain.on('window:maximize', () => {
  const win = BrowserWindow.getFocusedWindow();
  if (win?.isMaximized()) win.unmaximize();
  else win?.maximize();
});
ipcMain.on('window:close', () => BrowserWindow.getFocusedWindow()?.close());

ipcMain.handle('dialog:open-file', async () => {
  if (_isWSL) {
    const result = await openWindowsFileDialog();
    // null  = PowerShell failed → fall through to GTK
    // []    = user cancelled cleanly → stop here, return null to renderer
    // [...] = files selected → return them
    if (result !== null) return result.length > 0 ? result : null;
  }
  const { filePaths } = await dialog.showOpenDialog({
    defaultPath: _isWSL ? getWindowsHome() : os.homedir(),
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Video Files', extensions: ['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv', 'm4v'] },
    ],
  });
  return filePaths.length > 0 ? filePaths : null;
});

ipcMain.handle('dialog:open-directory', async () => {
  const { filePaths } = await dialog.showOpenDialog({
    defaultPath: os.homedir(),
    properties: ['openDirectory', 'createDirectory'],
  });
  return filePaths.length > 0 ? filePaths[0] : null;
});

// ── App events ───────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  if (_isWSL) addWindowsGtkBookmarks(getWindowsHome());
  startPythonServer();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  pyProcess?.kill();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
