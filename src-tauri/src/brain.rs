use std::fs;
use std::path::Path;
use serde::{Serialize, Deserialize};
use chrono::{DateTime, Utc};

use crate::paths::{get_brain_dir, get_conversations_dir, get_browser_recordings_dir, get_html_artifacts_dir};
use crate::conversations::extract_title_and_summary;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct BrainFolderInfo {
    pub id: String,
    pub title: String,
    pub file_count: usize,
    pub total_size_bytes: u64,
    pub has_conversation_db: bool,
    pub last_modified: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct BrainFileInfo {
    pub name: String,
    pub relative_path: String,
    pub absolute_path: String,
    pub size_bytes: u64,
    pub last_modified: String,
    pub file_type: String, // "log", "scratch", "artifact", "recording", "html_artifact", "other"
}

// Recursively scans a directory for total file count, total size, and latest modified time
fn scan_dir_recursive(path: &Path) -> (usize, u64, std::time::SystemTime) {
    let mut count = 0;
    let mut size = 0;
    let mut latest_mod = std::time::SystemTime::UNIX_EPOCH;

    if path.is_file() {
        if let Ok(meta) = path.metadata() {
            count = 1;
            size = meta.len();
            if let Ok(modified) = meta.modified() {
                latest_mod = modified;
            }
        }
        return (count, size, latest_mod);
    }

    if let Ok(entries) = fs::read_dir(path) {
        for entry in entries.flatten() {
            let (c, s, m) = scan_dir_recursive(&entry.path());
            count += c;
            size += s;
            if m > latest_mod {
                latest_mod = m;
            }
        }
    }

    (count, size, latest_mod)
}

// Safely checks if a path is inside the brain, browser_recordings, or html_artifacts directories
fn is_path_safe(target_path: &Path) -> Result<bool, String> {
    let brain_dir = get_brain_dir()?;
    let rec_dir = get_browser_recordings_dir()?;
    let art_dir = get_html_artifacts_dir()?;

    // If the file doesn't exist, we can't canonicalize it directly, so canonicalize its parent
    let canonical_target = if target_path.exists() {
        fs::canonicalize(target_path)
            .map_err(|e| format!("Failed to canonicalize target path: {}", e))?
    } else if let Some(parent) = target_path.parent() {
        if parent.exists() {
            fs::canonicalize(parent)
                .map_err(|e| format!("Failed to canonicalize target parent: {}", e))?
                .join(target_path.file_name().unwrap_or_default())
        } else {
            return Err("Target parent directory does not exist".to_string());
        }
    } else {
        return Err("Target path has no parent".to_string());
    };

    if let Ok(c_brain) = fs::canonicalize(&brain_dir) {
        if canonical_target.starts_with(c_brain) {
            return Ok(true);
        }
    }
    if let Ok(c_rec) = fs::canonicalize(&rec_dir) {
        if canonical_target.starts_with(c_rec) {
            return Ok(true);
        }
    }
    if let Ok(c_art) = fs::canonicalize(&art_dir) {
        if canonical_target.starts_with(c_art) {
            return Ok(true);
        }
    }

    Ok(false)
}

#[tauri::command]
pub fn get_brains() -> Result<Vec<BrainFolderInfo>, String> {
    let brain_dir = get_brain_dir()?;
    let conv_dir = get_conversations_dir()?;
    let rec_dir = get_browser_recordings_dir()?;
    let art_dir = get_html_artifacts_dir()?;
    
    if !brain_dir.exists() {
        return Ok(Vec::new());
    }

    let mut list = Vec::new();
    let entries = fs::read_dir(&brain_dir).map_err(|e| e.to_string())?;

    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            let id = path.file_name()
                .and_then(|s| s.to_str())
                .unwrap_or("")
                .to_string();
            
            if id.is_empty() {
                continue;
            }

            // Check if corresponding DB or PB file exists
            let db_exists = conv_dir.join(format!("{}.db", id)).exists();
            let pb_exists = conv_dir.join(format!("{}.pb", id)).exists();
            let has_conversation_db = db_exists || pb_exists;

            // Recurse scan directories
            let mut file_count = 0;
            let mut total_size_bytes = 0;
            let mut last_mod_time = std::time::SystemTime::UNIX_EPOCH;

            // 1. Scan brain folder
            let (fc1, s1, m1) = scan_dir_recursive(&path);
            file_count += fc1;
            total_size_bytes += s1;
            if m1 > last_mod_time {
                last_mod_time = m1;
            }

            // 2. Scan recordings folder
            let rec_path = rec_dir.join(&id);
            if rec_path.exists() {
                let (fc2, s2, m2) = scan_dir_recursive(&rec_path);
                file_count += fc2;
                total_size_bytes += s2;
                if m2 > last_mod_time {
                    last_mod_time = m2;
                }
            }

            // 3. Scan HTML artifacts folder
            let art_path = art_dir.join(&id);
            if art_path.exists() {
                let (fc3, s3, m3) = scan_dir_recursive(&art_path);
                file_count += fc3;
                total_size_bytes += s3;
                if m3 > last_mod_time {
                    last_mod_time = m3;
                }
            }
            
            let last_mod_datetime: DateTime<Utc> = last_mod_time.into();
            let last_modified = last_mod_datetime.to_rfc3339();

            // Try to extract title from transcript log
            let mut title = format!("Session Brain ({})", id.chars().take(8).collect::<String>());
            let log_path = path.join(".system_generated").join("logs").join("transcript.jsonl");
            if log_path.exists() {
                if let Ok(log_content) = fs::read_to_string(&log_path) {
                    if let Some(first_line) = log_content.lines().next() {
                        if let Ok(val) = serde_json::from_str::<serde_json::Value>(first_line) {
                            if let Some(content) = val.get("content").and_then(|c| c.as_str()) {
                                let (t, _) = extract_title_and_summary(content);
                                title = t;
                            }
                        }
                    }
                }
            } else if db_exists {
                title = "Active Conversation".to_string();
            } else if pb_exists {
                title = "Archived Conversation".to_string();
            } else {
                title = format!("Orphaned Brain ({})", id.chars().take(8).collect::<String>());
            }

            list.push(BrainFolderInfo {
                id,
                title,
                file_count,
                total_size_bytes,
                has_conversation_db,
                last_modified,
            });
        }
    }

    // Sort by last modified descending
    list.sort_by(|a, b| b.last_modified.cmp(&a.last_modified));
    Ok(list)
}

#[tauri::command]
pub fn delete_brain(id: String) -> Result<(), String> {
    let brain_dir = get_brain_dir()?;
    let rec_dir = get_browser_recordings_dir()?;
    let art_dir = get_html_artifacts_dir()?;
    
    // 1. Delete brain folder
    let path = brain_dir.join(&id);
    if path.exists() && path.is_dir() {
        if is_path_safe(&path)? {
            fs::remove_dir_all(path).map_err(|e| e.to_string())?;
        } else {
            return Err("Unsafe delete path detected".to_string());
        }
    }

    // 2. Delete recordings folder
    let rec_path = rec_dir.join(&id);
    if rec_path.exists() && rec_path.is_dir() {
        if is_path_safe(&rec_path)? {
            let _ = fs::remove_dir_all(rec_path);
        }
    }

    // 3. Delete HTML artifacts folder
    let art_path = art_dir.join(&id);
    if art_path.exists() && art_path.is_dir() {
        if is_path_safe(&art_path)? {
            let _ = fs::remove_dir_all(art_path);
        }
    }
    
    Ok(())
}

#[tauri::command]
pub fn clean_orphaned_brains() -> Result<(), String> {
    let brain_dir = get_brain_dir()?;
    let conv_dir = get_conversations_dir()?;
    let rec_dir = get_browser_recordings_dir()?;
    let art_dir = get_html_artifacts_dir()?;
    
    if !brain_dir.exists() {
        return Ok(());
    }

    // Scan brain folders
    let entries = fs::read_dir(&brain_dir).map_err(|e| e.to_string())?;
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            let id = path.file_name()
                .and_then(|s| s.to_str())
                .unwrap_or("")
                .to_string();
            
            if id.is_empty() {
                continue;
            }

            let db_exists = conv_dir.join(format!("{}.db", id)).exists();
            let pb_exists = conv_dir.join(format!("{}.pb", id)).exists();
            
            if !db_exists && !pb_exists {
                // Delete orphaned folder in brain
                if is_path_safe(&path)? {
                    let _ = fs::remove_dir_all(&path);
                }
                
                // Delete orphaned folder in recordings
                let rec_path = rec_dir.join(&id);
                if rec_path.exists() && is_path_safe(&rec_path)? {
                    let _ = fs::remove_dir_all(rec_path);
                }

                // Delete orphaned folder in HTML artifacts
                let art_path = art_dir.join(&id);
                if art_path.exists() && is_path_safe(&art_path)? {
                    let _ = fs::remove_dir_all(art_path);
                }
            }
        }
    }

    // Also scan recordings folder for subdirectories that don't have DB/PB (if any linger)
    if rec_dir.exists() {
        if let Ok(entries) = fs::read_dir(&rec_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    let id = path.file_name().and_then(|s| s.to_str()).unwrap_or("").to_string();
                    if !id.is_empty() {
                        let db_exists = conv_dir.join(format!("{}.db", id)).exists();
                        let pb_exists = conv_dir.join(format!("{}.pb", id)).exists();
                        if !db_exists && !pb_exists && is_path_safe(&path)? {
                            let _ = fs::remove_dir_all(path);
                        }
                    }
                }
            }
        }
    }

    // Also scan HTML artifacts folder
    if art_dir.exists() {
        if let Ok(entries) = fs::read_dir(&art_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    let id = path.file_name().and_then(|s| s.to_str()).unwrap_or("").to_string();
                    if !id.is_empty() {
                        let db_exists = conv_dir.join(format!("{}.db", id)).exists();
                        let pb_exists = conv_dir.join(format!("{}.pb", id)).exists();
                        if !db_exists && !pb_exists && is_path_safe(&path)? {
                            let _ = fs::remove_dir_all(path);
                        }
                    }
                }
            }
        }
    }

    Ok(())
}

fn collect_files_recursive(
    dir: &Path,
    root_dir: &Path,
    custom_relative_prefix: Option<&str>,
    custom_type: Option<&str>,
    files: &mut Vec<BrainFileInfo>,
) -> Result<(), String> {
    if dir.is_file() {
        let name = dir.file_name()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_string();
        
        let path_rel = dir.strip_prefix(root_dir)
            .map_err(|e| e.to_string())?
            .to_string_lossy()
            .replace("\\", "/");
        
        let relative_path = match custom_relative_prefix {
            Some(prefix) => format!("{}/{}", prefix, path_rel),
            None => path_rel.clone()
        };
        
        let absolute_path = dir.to_string_lossy().to_string();
        
        let meta = dir.metadata().map_err(|e| e.to_string())?;
        let size_bytes = meta.len();
        
        let mod_time: DateTime<Utc> = meta.modified().unwrap_or(std::time::SystemTime::UNIX_EPOCH).into();
        let last_modified = mod_time.to_rfc3339();
        
        let file_type = match custom_type {
            Some(t) => t.to_string(),
            None => {
                if path_rel.starts_with(".system_generated") {
                    "log".to_string()
                } else if path_rel.starts_with("scratch") {
                    "scratch".to_string()
                } else if !path_rel.contains('/') && (path_rel.ends_with(".md") || path_rel.ends_with(".json") || path_rel.ends_with(".txt")) {
                    "artifact".to_string()
                } else {
                    "other".to_string()
                }
            }
        };

        files.push(BrainFileInfo {
            name,
            relative_path,
            absolute_path,
            size_bytes,
            last_modified,
            file_type,
        });
        
        return Ok(());
    }

    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            collect_files_recursive(&entry.path(), root_dir, custom_relative_prefix, custom_type, files)?;
        }
    }

    Ok(())
}

#[tauri::command]
pub fn get_brain_files(id: String) -> Result<Vec<BrainFileInfo>, String> {
    let brain_dir = get_brain_dir()?;
    let rec_dir = get_browser_recordings_dir()?;
    let art_dir = get_html_artifacts_dir()?;
    
    let path = brain_dir.join(&id);
    if !path.exists() {
        return Err("Brain directory not found".to_string());
    }

    let mut files = Vec::new();
    
    // 1. Scan brain files
    collect_files_recursive(&path, &path, None, None, &mut files)?;

    // 2. Scan recordings
    let rec_path = rec_dir.join(&id);
    if rec_path.exists() {
        let _ = collect_files_recursive(
            &rec_path,
            &rec_path,
            Some("browser_recordings"),
            Some("recording"),
            &mut files
        );
    }

    // 3. Scan HTML artifacts
    let art_path = art_dir.join(&id);
    if art_path.exists() {
        let _ = collect_files_recursive(
            &art_path,
            &art_path,
            Some("html_artifacts"),
            Some("html_artifact"),
            &mut files
        );
    }
    
    // Sort by name
    files.sort_by(|a, b| a.relative_path.cmp(&b.relative_path));
    Ok(files)
}

#[tauri::command]
pub fn read_brain_file(path: String) -> Result<String, String> {
    let p = Path::new(&path);
    if !is_path_safe(p)? {
        return Err("Access denied: path is outside the allowed workspace directories".to_string());
    }

    if !p.exists() {
        return Err("File not found".to_string());
    }

    fs::read_to_string(p).map_err(|e| format!("Failed to read file: {}", e))
}

#[tauri::command]
pub fn write_brain_file(path: String, content: String) -> Result<(), String> {
    let p = Path::new(&path);
    if !is_path_safe(p)? {
        return Err("Access denied: path is outside the allowed workspace directories".to_string());
    }

    // Ensure parent directory exists
    if let Some(parent) = p.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent).map_err(|e| format!("Failed to create directories: {}", e))?;
        }
    }

    fs::write(p, content).map_err(|e| format!("Failed to write file: {}", e))
}

#[tauri::command]
pub fn delete_brain_file(path: String) -> Result<(), String> {
    let p = Path::new(&path);
    if !is_path_safe(p)? {
        return Err("Access denied: path is outside the allowed workspace directories".to_string());
    }

    if p.exists() {
        if p.is_file() {
            fs::remove_file(p).map_err(|e| format!("Failed to delete file: {}", e))?;
        } else {
            return Err("Path is a directory, not a file".to_string());
        }
    }

    Ok(())
}

#[tauri::command]
pub fn create_brain_file(id: String, name: String, file_type: String) -> Result<(), String> {
    let brain_dir = get_brain_dir()?;
    let rec_dir = get_browser_recordings_dir()?;
    let art_dir = get_html_artifacts_dir()?;
    
    let session_dir = brain_dir.join(&id);
    if !session_dir.exists() {
        return Err("Session brain folder does not exist".to_string());
    }

    // Sanitize filename to prevent directory traversal in name
    let clean_name = Path::new(&name).file_name()
        .and_then(|n| n.to_str())
        .ok_or_else(|| "Invalid file name".to_string())?;

    let file_path = match file_type.as_str() {
        "scratch" => session_dir.join("scratch").join(clean_name),
        "artifact" => session_dir.join(clean_name),
        "recording" => rec_dir.join(&id).join(clean_name),
        "html_artifact" => art_dir.join(&id).join(clean_name),
        _ => session_dir.join(clean_name),
    };

    if !is_path_safe(&file_path)? {
        return Err("Access denied: unsafe file destination path".to_string());
    }

    if file_path.exists() {
        return Err("File already exists".to_string());
    }

    if let Some(parent) = file_path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent).map_err(|e| format!("Failed to create parent folder: {}", e))?;
        }
    }

    // Basic content template
    let content = if file_path.extension().map_or(false, |ext| ext == "md") {
        format!("# {}\n\nCreated: {}\n", clean_name, Utc::now().to_rfc3339())
    } else {
        "".to_string()
    };

    fs::write(&file_path, content).map_err(|e| format!("Failed to create file: {}", e))?;
    Ok(())
}
