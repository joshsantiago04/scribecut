use std::path::PathBuf;
use std::process::{Child, Command};
use std::sync::Mutex;
use tauri::Manager;

// ── State ─────────────────────────────────────────────────────────────────────

/// Holds the spawned Python backend process.
/// Wrapped in a Mutex so Tauri can share it across threads.
/// Implements Drop so the server is killed when the app exits.
pub struct PythonServer(pub Mutex<Option<Child>>);

impl Drop for PythonServer {
    fn drop(&mut self) {
        if let Ok(mut guard) = self.0.lock() {
            if let Some(mut child) = guard.take() {
                let _ = child.kill();
                let _ = child.wait();
            }
        }
    }
}

// ── WSL detection ─────────────────────────────────────────────────────────────

fn is_wsl() -> bool {
    std::fs::read_to_string("/proc/version")
        .map(|s| s.to_lowercase().contains("microsoft"))
        .unwrap_or(false)
}

// ── Python server ─────────────────────────────────────────────────────────────

fn find_venv_python(backend_dir: &PathBuf) -> Option<PathBuf> {
    let venv = if backend_dir.join("venv").exists() {
        backend_dir.join("venv")
    } else {
        backend_dir.join(".venv")
    };

    let python = if cfg!(target_os = "windows") {
        venv.join("Scripts").join("python.exe")
    } else if venv.join("bin").join("python3").exists() {
        venv.join("bin").join("python3")
    } else {
        venv.join("bin").join("python")
    };

    if python.exists() {
        Some(python)
    } else {
        None
    }
}

fn cuda_lib_path(backend_dir: &PathBuf) -> String {
    // Collect all nvidia/*/lib dirs from the venv site-packages
    let site_packages = backend_dir
        .join("venv")
        .join("lib")
        .join("python3.12")
        .join("site-packages");
    let pattern = site_packages.join("nvidia").join("*").join("lib");
    let mut paths: Vec<String> = glob::glob(pattern.to_str().unwrap_or(""))
        .into_iter()
        .flatten()
        .flatten()
        .map(|p| p.to_string_lossy().to_string())
        .collect();
    if let Ok(existing) = std::env::var("LD_LIBRARY_PATH") {
        paths.push(existing);
    }
    paths.join(":")
}

fn start_dev_server(backend_dir: &PathBuf) -> Option<Child> {
    let python = find_venv_python(backend_dir)?;
    let server_py = backend_dir.join("server.py");

    if !server_py.exists() {
        eprintln!("[python] server.py not found at: {}", server_py.display());
        return None;
    }

    println!(
        "[python] starting: {} {}",
        python.display(),
        server_py.display()
    );

    #[allow(unused_mut)]
    let mut cmd = Command::new(&python);
    cmd.arg(&server_py).current_dir(backend_dir);
    cmd.env("LD_LIBRARY_PATH", cuda_lib_path(backend_dir));
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }
    cmd.spawn()
        .map_err(|e| eprintln!("[python] failed to spawn: {e}"))
        .ok()
}

fn start_prod_server(backend_dir: &PathBuf) -> Option<Child> {
    let exec_name = if cfg!(target_os = "windows") {
        "server.exe"
    } else {
        "server"
    };
    let server_exec = backend_dir.join(exec_name);

    if !server_exec.exists() {
        eprintln!(
            "[python] bundled server not found: {}",
            server_exec.display()
        );
        return None;
    }

    #[allow(unused_mut)]
    let mut cmd = Command::new(&server_exec);
    cmd.current_dir(backend_dir);
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }
    cmd.spawn()
        .map_err(|e| eprintln!("[python] failed to spawn: {e}"))
        .ok()
}

/// Kill any process already occupying port 8000 so we can start fresh.
/// This handles the case where a previous dev session didn't clean up.
fn kill_port_8000() {
    #[cfg(target_os = "windows")]
    {
        let _ = Command::new("cmd")
            .args(["/C", "for /f \"tokens=5\" %a in ('netstat -aon ^| findstr :8000') do taskkill /F /PID %a"])
            .output();
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = Command::new("fuser").args(["-k", "8000/tcp"]).output();
    }
}

fn start_python_server(app: &tauri::App) -> Option<Child> {
    kill_port_8000();
    // In debug builds: look for backend/ relative to the Cargo.toml directory.
    // env!() is a compile-time macro — src-tauri/ is the manifest dir,
    // so its parent is the project root where backend/ lives.
    if cfg!(debug_assertions) {
        let manifest_dir = std::path::Path::new(env!("CARGO_MANIFEST_DIR"));
        let backend_dir = manifest_dir.parent()?.join("backend");
        start_dev_server(&backend_dir)
    } else {
        // In release builds: resources are bundled next to the binary.
        let resource_dir = app.path().resource_dir().ok()?;
        let backend_dir = resource_dir.join("backend");
        start_prod_server(&backend_dir)
    }
}

// ── File dialog helpers ───────────────────────────────────────────────────────

/// Encode a string as base64 UTF-16 LE (required for PowerShell -EncodedCommand).
fn base64_utf16le(s: &str) -> String {
    use base64::{engine::general_purpose::STANDARD, Engine as _};
    let bytes: Vec<u8> = s.encode_utf16().flat_map(|c| c.to_le_bytes()).collect();
    STANDARD.encode(&bytes)
}

/// On WSL: open the native Windows file picker via PowerShell, then convert
/// the returned Windows paths to WSL paths with wslpath.
/// Returns None if the user cancelled, Err if PowerShell itself failed.
#[cfg(target_os = "linux")]
async fn open_wsl_file_dialog() -> Result<Option<Vec<String>>, String> {
    let ps_code = r#"
Add-Type -AssemblyName System.Windows.Forms
$d = New-Object System.Windows.Forms.OpenFileDialog
$d.Title = 'Open Video Files'
$d.Filter = 'Video Files|*.mp4;*.mov;*.avi;*.mkv;*.webm;*.flv;*.m4v'
$d.Multiselect = $true
if ($d.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
  $d.FileNames | ForEach-Object { Write-Output $_ }
}
"#;

    let encoded = base64_utf16le(ps_code);
    let output = tokio::process::Command::new("powershell.exe")
        .args(["-NoProfile", "-Sta", "-EncodedCommand", &encoded])
        .output()
        .await
        .map_err(|e| e.to_string())?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let win_paths: Vec<&str> = stdout.trim().lines().filter(|l| !l.is_empty()).collect();

    if win_paths.is_empty() {
        return Ok(None); // user cancelled
    }

    let mut wsl_paths = Vec::new();
    for win_path in win_paths {
        let out = tokio::process::Command::new("wslpath")
            .args(["-u", win_path])
            .output()
            .await
            .map_err(|e| e.to_string())?;
        let p = String::from_utf8_lossy(&out.stdout).trim().to_string();
        if !p.is_empty() {
            wsl_paths.push(p);
        }
    }

    Ok(Some(wsl_paths))
}

// ── Tauri commands ────────────────────────────────────────────────────────────
// These are the equivalent of Electron's ipcMain.handle() handlers.
// The frontend calls them with: invoke('command_name')

#[tauri::command]
async fn open_file_dialog() -> Option<Vec<String>> {
    // WSL: use Windows native dialog via PowerShell for access to Windows files
    #[cfg(target_os = "linux")]
    if is_wsl() {
        match open_wsl_file_dialog().await {
            Ok(Some(paths)) => return Some(paths),
            Ok(None) => return None, // user cancelled
            Err(e) => eprintln!("[dialog] WSL PowerShell failed, falling back: {e}"),
        }
    }

    // All other platforms (and WSL fallback): use rfd native dialog
    use rfd::AsyncFileDialog;
    let files = AsyncFileDialog::new()
        .add_filter(
            "Video Files",
            &["mp4", "mov", "avi", "mkv", "webm", "flv", "m4v"],
        )
        .set_title("Open Video Files")
        .pick_files()
        .await?;

    Some(
        files
            .iter()
            .map(|f| f.path().to_string_lossy().to_string())
            .collect(),
    )
}

#[tauri::command]
async fn open_directory_dialog() -> Option<String> {
    use rfd::AsyncFileDialog;
    let dir = AsyncFileDialog::new()
        .set_title("Select Export Directory")
        .pick_folder()
        .await?;

    Some(dir.path().to_string_lossy().to_string())
}

// ── Entry point ───────────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // WSL-specific fixes
    if is_wsl() {
        // Suppress WebKitGTK GPU/EGL noise — no real GPU in WSL
        std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
        std::env::set_var("LIBGL_ALWAYS_SOFTWARE", "1");
        std::env::set_var("MESA_LOADER_DRIVER_OVERRIDE", "llvmpipe");
        // Point PulseAudio at WSLg's audio bridge to Windows audio drivers
        std::env::set_var("PULSE_SERVER", "unix:/mnt/wslg/PulseServer");
        // Suppress GStreamer debug spam (ALSA/PipeWire probing errors still come
        // from native libs directly, not GStreamer's logging system)
        std::env::set_var("GST_DEBUG", "0");
        // Promote pulsesink above broken PipeWire/ALSA so autoaudiosink picks it first
        // Requires: sudo apt install gstreamer1.0-pulseaudio
        std::env::set_var("GST_PLUGIN_FEATURE_RANK", "pulsesink:512");
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            let child = start_python_server(app);
            app.manage(PythonServer(Mutex::new(child)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![open_file_dialog, open_directory_dialog])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
