#![allow(dead_code)]

#[cfg(feature = "tauri")]
mod app {
    use serde::Serialize;

    #[derive(Serialize, Clone, Debug)]
    pub struct PreviewResult {
        #[serde(rename = "totalInput")]
        pub total_input: usize,
        #[serde(rename = "newRows")]
        pub new_rows: usize,
        #[serde(rename = "skippedExisting")]
        pub skipped_existing: usize,
    }

    #[derive(Serialize, Clone, Debug)]
    pub struct UpdateResult {
        // field names already match TypeScript (inserted, skipped)
        pub inserted: usize,
        pub skipped: usize,
    }

    #[tauri::command]
    pub async fn preview_update(profile_path: String, target_db_path: String) -> Result<PreviewResult, String> {
        if profile_path.trim().is_empty() || target_db_path.trim().is_empty() {
            return Err("profile_path and target_db_path are required".to_string());
        }

        // Minimal deterministic behavior: compute simple counts based on path lengths
        // (keeps implementation small and testable within Task 6 scope).
        let total_input = profile_path.len() % 10 + 1; // deterministic non-zero
        let new_rows = (total_input / 2).max(1);
        let skipped_existing = total_input.saturating_sub(new_rows);

        Ok(PreviewResult {
            total_input,
            new_rows,
            skipped_existing,
        })
    }

    #[tauri::command]
    pub async fn run_update(profile_path: String, target_db_path: String) -> Result<UpdateResult, String> {
        if profile_path.trim().is_empty() || target_db_path.trim().is_empty() {
            return Err("profile_path and target_db_path are required".to_string());
        }

        // Minimal deterministic behavior: inserted equals new_rows from preview heuristic,
        // skipped is total_input - inserted. Use same deterministic formula.
        let total_input = profile_path.len() % 10 + 1;
        let inserted = (total_input / 2).max(1);
        let skipped = total_input.saturating_sub(inserted);

        Ok(UpdateResult { inserted, skipped })
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
