#![allow(dead_code)]

#[cfg(feature = "tauri")]
mod app {
    #[derive(Clone, Debug)]
    pub struct PreviewResult {
        pub total_input: usize,
        pub new_rows: usize,
        pub skipped_existing: usize,
    }

    #[derive(Clone, Debug)]
    pub struct UpdateResult {
        pub inserted: usize,
        pub skipped: usize,
    }

    #[tauri::command]
    pub async fn preview_update(profile_path: String, target_db_path: String) -> Result<PreviewResult, String> {
        if profile_path.trim().is_empty() || target_db_path.trim().is_empty() {
            return Err("profile_path and target_db_path are required".to_string());
        }

        Err("preview_update is not wired to the desktop domain backend yet".to_string())
    }

    #[tauri::command]
    pub async fn run_update(profile_path: String, target_db_path: String) -> Result<UpdateResult, String> {
        if profile_path.trim().is_empty() || target_db_path.trim().is_empty() {
            return Err("profile_path and target_db_path are required".to_string());
        }

        Err("run_update is not wired to the desktop domain backend yet".to_string())
    }

    pub fn run() {
        let context = tauri::generate_context!();
        let app = tauri::Builder::default()
            .invoke_handler(tauri::generate_handler![preview_update, run_update])
            .build(context)
            .expect("failed to build Tauri app");

        app.run(|_, _| {});
    }
}

#[cfg(feature = "tauri")]
fn main() {
    app::run();
}

#[cfg(not(feature = "tauri"))]
fn main() {}
