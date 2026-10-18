use serde::{Deserialize, Serialize};
use std::{
    collections::BTreeMap,
    fs::{self, File, OpenOptions},
    io::{ErrorKind, Read, Write},
    path::PathBuf,
    sync::{Arc, Mutex},
};
use tauri::State;

const KEYS: [&str; 5] = [
    "wendao:preferences:v1",
    "wendao:practice:v1",
    "wendao:learning:v1",
    "wendao:trials:v1",
    "wendao:onboarding:v1",
];
const MAX_VALUE: usize = 512 * 1024;
const MAX_FILE: u64 = 8 * 1024 * 1024;

#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Snapshot {
    version: u8,
    values: BTreeMap<String, String>,
}

#[derive(Clone)]
pub struct PracticeStore {
    path: PathBuf,
    gate: Arc<Mutex<()>>,
}
impl PracticeStore {
    pub fn new(path: PathBuf) -> Self {
        Self {
            path,
            gate: Arc::new(Mutex::new(())),
        }
    }

    fn locked<T>(&self, action: impl FnOnce() -> Result<T, String>) -> Result<T, String> {
        let _gate = self.gate.lock().map_err(|_| "Practice store lock failed")?;
        let parent = self
            .path
            .parent()
            .ok_or("Practice store path is unavailable")?;
        fs::create_dir_all(parent).map_err(|_| "Practice store directory is unavailable")?;
        let lock = OpenOptions::new()
            .create(true)
            .truncate(false)
            .read(true)
            .write(true)
            .open(self.path.with_extension("lock"))
            .map_err(|_| "Practice store lock is unavailable")?;
        lock.lock()
            .map_err(|_| "Practice store could not be locked")?;
        // Both process-local and OS locks are held through read + atomic replacement.
        action()
    }
    fn read_unlocked(&self) -> Result<BTreeMap<String, String>, String> {
        let file = match File::open(&self.path) {
            Ok(file) => file,
            Err(error) if error.kind() == ErrorKind::NotFound => return Ok(BTreeMap::new()),
            Err(_) => return Err("Practice store could not be read".into()),
        };
        let mut data = Vec::new();
        file.take(MAX_FILE + 1)
            .read_to_end(&mut data)
            .map_err(|_| "Practice store read failed")?;
        if data.len() as u64 > MAX_FILE {
            return Err("Practice store exceeds its size limit".into());
        }
        let snapshot: Snapshot =
            serde_json::from_slice(&data).map_err(|_| "Practice store is damaged")?;
        if snapshot.version != 1
            || snapshot
                .values
                .iter()
                .any(|(key, value)| !KEYS.contains(&key.as_str()) || value.len() > MAX_VALUE)
        {
            return Err("Practice store format is unsupported".into());
        }
        Ok(snapshot.values)
    }
    pub fn load(&self) -> Result<BTreeMap<String, String>, String> {
        self.locked(|| self.read_unlocked())
    }
    pub fn set(&self, key: String, value: String) -> Result<(), String> {
        if !KEYS.contains(&key.as_str()) || value.len() > MAX_VALUE {
            return Err("Practice store key or value is not allowed".into());
        }
        self.locked(|| {
            let mut values = self.read_unlocked()?;
            values.insert(key, value);
            let data = serde_json::to_vec(&Snapshot { version: 1, values })
                .map_err(|_| "Practice store encoding failed")?;
            let temporary = self.path.with_extension("tmp");
            let mut file = OpenOptions::new()
                .create(true)
                .truncate(true)
                .write(true)
                .open(&temporary)
                .map_err(|_| "Practice checkpoint could not be created")?;
            file.write_all(&data)
                .map_err(|_| "Practice checkpoint write failed")?;
            file.sync_all()
                .map_err(|_| "Practice checkpoint could not be synchronized")?;
            drop(file);
            fs::rename(temporary, &self.path)
                .map_err(|_| "Practice checkpoint could not replace the previous snapshot")?;
            Ok(())
        })
    }
}

#[tauri::command]
pub async fn load_practice_store(
    store: State<'_, PracticeStore>,
) -> Result<BTreeMap<String, String>, String> {
    let store = store.inner().clone();
    tauri::async_runtime::spawn_blocking(move || store.load())
        .await
        .map_err(|_| "Practice store task failed")?
}
#[tauri::command]
pub async fn set_practice_value(
    store: State<'_, PracticeStore>,
    key: String,
    value: String,
) -> Result<(), String> {
    let store = store.inner().clone();
    tauri::async_runtime::spawn_blocking(move || store.set(key, value))
        .await
        .map_err(|_| "Practice store task failed")?
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU64, Ordering};
    use std::time::{SystemTime, UNIX_EPOCH};
    static FIXTURE_ID: AtomicU64 = AtomicU64::new(0);
    struct Fixture(PathBuf);
    impl Fixture {
        fn new() -> Self {
            let path = std::env::temp_dir().join(format!(
                "wendao-store-{}-{}-{}",
                std::process::id(),
                SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .unwrap()
                    .as_nanos(),
                FIXTURE_ID.fetch_add(1, Ordering::Relaxed)
            ));
            fs::create_dir(&path).unwrap();
            Self(path)
        }
        fn store(&self) -> PracticeStore {
            PracticeStore::new(self.0.join("practice.json"))
        }
    }
    impl Drop for Fixture {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    #[test]
    fn disk_roundtrip_and_interrupted_temporary_write() {
        let fixture = Fixture::new();
        let store = fixture.store();
        assert!(store.load().unwrap().is_empty());
        store.set(KEYS[1].into(), "first hand".into()).unwrap();
        fs::write(store.path.with_extension("tmp"), b"interrupted write").unwrap();
        assert_eq!(fixture.store().load().unwrap()[KEYS[1]], "first hand");
        store.set(KEYS[1].into(), "next hand".into()).unwrap();
        assert_eq!(fixture.store().load().unwrap()[KEYS[1]], "next hand");
    }
    #[test]
    fn invalid_writes_preserve_previous_snapshot() {
        let fixture = Fixture::new();
        let store = fixture.store();
        store.set(KEYS[1].into(), "saved".into()).unwrap();
        let before = fs::read(&store.path).unwrap();
        assert!(store.set("../../outside".into(), "bad".into()).is_err());
        assert!(
            store
                .set(KEYS[1].into(), "x".repeat(MAX_VALUE + 1))
                .is_err()
        );
        assert_eq!(fs::read(&store.path).unwrap(), before);
    }
    #[test]
    fn damaged_snapshot_is_not_silently_overwritten() {
        let fixture = Fixture::new();
        let store = fixture.store();
        fs::write(&store.path, b"damaged checkpoint").unwrap();
        assert!(store.load().is_err());
        assert!(store.set(KEYS[1].into(), "replacement".into()).is_err());
        assert_eq!(fs::read(&store.path).unwrap(), b"damaged checkpoint");
    }
    #[test]
    fn concurrent_keys_are_merged_under_the_file_lock() {
        let fixture = Fixture::new();
        let store = fixture.store();
        let handles: Vec<_> = KEYS
            .iter()
            .enumerate()
            .map(|(i, key)| {
                let store = store.clone();
                let key = key.to_string();
                std::thread::spawn(move || store.set(key, format!("value-{i}")).unwrap())
            })
            .collect();
        for handle in handles {
            handle.join().unwrap();
        }
        let loaded = fixture.store().load().unwrap();
        for (i, key) in KEYS.iter().enumerate() {
            assert_eq!(loaded[*key], format!("value-{i}"));
        }
    }
}
