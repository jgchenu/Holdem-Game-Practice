mod store;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            store::load_practice_store,
            store::set_practice_value
        ])
        .setup(|app| {
            #[allow(unused_mut)]
            let mut storage_root = app.path().app_local_data_dir()?;
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            #[allow(unused_mut)]
            let mut window =
                tauri::WebviewWindowBuilder::from_config(app, &app.config().app.windows[0])?;
            // Only isolated Windows test processes opt in. Normal packaged launches expose no debugger.
            #[cfg(target_os = "windows")]
            if let Some(port) = std::env::var("WENDAO_TEST_DEBUG_PORT")
                .ok()
                .and_then(|value| value.parse::<u16>().ok())
                .filter(|port| *port >= 1024)
            {
                window = window.additional_browser_args(&format!("--remote-debugging-port={port}"));
                if let Some(directory) = std::env::var_os("WENDAO_TEST_PROFILE") {
                    let directory = std::path::PathBuf::from(directory);
                    storage_root = directory.join("native-state");
                    window = window.data_directory(directory);
                }
            }
            app.manage(store::PracticeStore::new(
                storage_root.join("practice-v1.json"),
            ));
            window.build()?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}
