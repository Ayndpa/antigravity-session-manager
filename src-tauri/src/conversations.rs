use std::fs;
use std::path::Path;
use rusqlite::{Connection, OpenFlags};
use chrono::{DateTime, Utc};

use crate::models::{ConversationMetadata, ConversationDetail, ArtifactFile};
use crate::paths::{get_conversations_dir, get_brain_dir};
use crate::projects::get_projects;

// Helper: Scan blob for known project IDs
pub fn extract_project_id_from_blob(blob: &[u8], project_ids: &[String]) -> Option<String> {
    let blob_str = String::from_utf8_lossy(blob);
    for pid in project_ids {
        if blob_str.contains(pid) {
            return Some(pid.clone());
        }
    }
    None
}

// Helper: Get project ID associated with conversation SQLite db
pub fn get_project_id_from_db(db_path: &Path, project_ids: &[String]) -> Option<String> {
    let conn = Connection::open_with_flags(
        db_path,
        OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_URI
    ).ok()?;

    let mut stmt = conn.prepare("SELECT data FROM trajectory_metadata_blob WHERE id = 'main'").ok()?;
    let mut rows = stmt.query([]).ok()?;

    if let Some(row) = rows.next().ok().flatten() {
        if let Ok(blob) = row.get::<_, Vec<u8>>(0) {
            return extract_project_id_from_blob(&blob, project_ids);
        }
    }

    None
}

// Helper: Clean up content tags for title/summary
pub fn extract_title_and_summary(content: &str) -> (String, String) {
    let mut request_content = content;
    
    // Attempt to extract text between <USER_REQUEST> tags
    if let Some(start_idx) = content.find("<USER_REQUEST>") {
        if let Some(end_idx) = content.find("</USER_REQUEST>") {
            let start = start_idx + "<USER_REQUEST>".len();
            if start < end_idx {
                request_content = &content[start..end_idx];
            }
        }
    }

    let cleaned = request_content.trim();
    if cleaned.is_empty() {
        return ("Empty Request".to_string(), "No request text found".to_string());
    }

    // Title is first non-empty line (capped to 50 chars)
    let first_line = cleaned.lines().next().unwrap_or("").trim();
    let title = if first_line.chars().count() > 50 {
        let truncated: String = first_line.chars().take(47).collect();
        format!("{}...", truncated)
    } else if first_line.is_empty() {
        "New Conversation".to_string()
    } else {
        first_line.to_string()
    };

    // Summary is the full request capped to 200 chars
    let summary = if cleaned.chars().count() > 200 {
        let truncated: String = cleaned.chars().take(197).collect();
        format!("{}...", truncated)
    } else {
        cleaned.to_string()
    };

    (title, summary)
}

#[tauri::command]
pub fn get_conversations() -> Result<Vec<ConversationMetadata>, String> {
    let conv_dir = get_conversations_dir()?;
    let brain_dir = get_brain_dir()?;
    if !conv_dir.exists() {
        return Ok(Vec::new());
    }

    // Get list of known project IDs
    let projects = get_projects().unwrap_or_default();
    let project_ids: Vec<String> = projects.iter().map(|p| p.id.clone()).collect();

    let mut list = Vec::new();
    let entries = fs::read_dir(conv_dir).map_err(|e| e.to_string())?;

    for entry in entries {
        if let Ok(entry) = entry {
            let path = entry.path();
            let extension = path.extension().and_then(|e| e.to_str());
            
            if extension == Some("db") || extension == Some("pb") {
                let id = path.file_stem().and_then(|s| s.to_str()).unwrap_or("").to_string();
                if id.is_empty() {
                    continue;
                }

                let metadata = entry.metadata().map_err(|e| e.to_string())?;
                let size_bytes = metadata.len();
                
                // Get times
                let mod_time = metadata.modified().unwrap_or(std::time::SystemTime::now());
                let mod_datetime: DateTime<Utc> = mod_time.into();
                let modified_at = mod_datetime.to_rfc3339();
                
                let mut created_at = modified_at.clone();
                let file_type = extension.unwrap().to_string();

                // Check logs
                let log_path = brain_dir.join(&id).join(".system_generated").join("logs").join("transcript.jsonl");
                let has_logs = log_path.exists();

                let mut title = format!("Conversation ({})", file_type.to_uppercase());
                let mut summary = "No detailed logs available.".to_string();
                let mut step_count = 0;
                let mut message_count = 0;
                let mut tool_call_count = 0;
                let mut error_count = 0;
                let mut project_id = None;

                if file_type == "db" {
                    project_id = get_project_id_from_db(&path, &project_ids);
                }

                if has_logs {
                    if let Ok(log_content) = fs::read_to_string(&log_path) {
                        let lines: Vec<&str> = log_content.lines().collect();
                        step_count = lines.len();

                        for (idx, line) in lines.iter().enumerate() {
                            if let Ok(val) = serde_json::from_str::<serde_json::Value>(line) {
                                // Extract creation time from first step
                                if idx == 0 {
                                    if let Some(created) = val.get("created_at").and_then(|c| c.as_str()) {
                                        created_at = created.to_string();
                                    }
                                    if let Some(content) = val.get("content").and_then(|c| c.as_str()) {
                                        let (t, s) = extract_title_and_summary(content);
                                        title = t;
                                        summary = s;
                                    }
                                }

                                // Count stats
                                if let Some(source) = val.get("source").and_then(|s| s.as_str()) {
                                    if source == "MODEL" || source == "USER_EXPLICIT" {
                                        message_count += 1;
                                    }
                                }

                                if let Some(status) = val.get("status").and_then(|s| s.as_str()) {
                                    if status == "ERROR" {
                                        error_count += 1;
                                    }
                                }

                                if let Some(tool_calls) = val.get("tool_calls").and_then(|tc| tc.as_array()) {
                                    tool_call_count += tool_calls.len();
                                }
                            }
                        }
                    }
                } else if file_type == "pb" {
                    title = format!("Archived Session ({})", id.chars().take(8).collect::<String>());
                    summary = "This session is archived. Logs are in Protobuf format and not loaded.".to_string();
                }

                list.push(ConversationMetadata {
                    id,
                    title,
                    summary,
                    created_at,
                    modified_at,
                    file_type,
                    size_bytes,
                    has_logs,
                    step_count,
                    message_count,
                    tool_call_count,
                    error_count,
                    project_id,
                });
            }
        }
    }

    // Sort by modified time descending
    list.sort_by(|a, b| b.modified_at.cmp(&a.modified_at));
    Ok(list)
}

#[tauri::command]
pub fn get_conversation_detail(id: String) -> Result<ConversationDetail, String> {
    let conv_dir = get_conversations_dir()?;
    let brain_dir = get_brain_dir()?;

    // Scan for project ID to put in metadata
    let projects = get_projects().unwrap_or_default();
    let project_ids: Vec<String> = projects.iter().map(|p| p.id.clone()).collect();

    // 1. Get metadata
    let mut file_type = "db".to_string();
    let mut path = conv_dir.join(format!("{}.db", id));
    if !path.exists() {
        path = conv_dir.join(format!("{}.pb", id));
        file_type = "pb".to_string();
    }

    if !path.exists() {
        return Err("Conversation files not found".to_string());
    }

    let file_metadata = path.metadata().map_err(|e| e.to_string())?;
    let size_bytes = file_metadata.len();
    let mod_time: DateTime<Utc> = file_metadata.modified().unwrap_or(std::time::SystemTime::now()).into();
    let modified_at = mod_time.to_rfc3339();
    let mut created_at = modified_at.clone();

    let mut title = format!("Conversation ({})", file_type.to_uppercase());
    let mut summary = "No detailed logs available.".to_string();
    let mut step_count = 0;
    let mut message_count = 0;
    let mut tool_call_count = 0;
    let mut error_count = 0;
    let mut project_id = None;

    if file_type == "db" {
        project_id = get_project_id_from_db(&path, &project_ids);
    }

    // 2. Read steps
    let mut steps = Vec::new();
    let log_path = brain_dir.join(&id).join(".system_generated").join("logs").join("transcript.jsonl");
    let has_logs = log_path.exists();

    if has_logs {
        if let Ok(log_content) = fs::read_to_string(&log_path) {
            for (idx, line) in log_content.lines().enumerate() {
                if let Ok(val) = serde_json::from_str::<serde_json::Value>(line) {
                    if idx == 0 {
                        if let Some(created) = val.get("created_at").and_then(|c| c.as_str()) {
                            created_at = created.to_string();
                        }
                        if let Some(content) = val.get("content").and_then(|c| c.as_str()) {
                            let (t, s) = extract_title_and_summary(content);
                            title = t;
                            summary = s;
                        }
                    }

                    // Count stats
                    if let Some(source) = val.get("source").and_then(|s| s.as_str()) {
                        if source == "MODEL" || source == "USER_EXPLICIT" {
                            message_count += 1;
                        }
                    }
                    if let Some(status) = val.get("status").and_then(|s| s.as_str()) {
                        if status == "ERROR" {
                            error_count += 1;
                        }
                    }
                    if let Some(tool_calls) = val.get("tool_calls").and_then(|tc| tc.as_array()) {
                        tool_call_count += tool_calls.len();
                    }

                    steps.push(val);
                }
            }
            step_count = steps.len();
        }
    } else if file_type == "pb" {
        title = format!("Archived Session ({})", id.chars().take(8).collect::<String>());
        summary = "This session is archived. Logs are in Protobuf format and not loaded.".to_string();
    }

    let meta = ConversationMetadata {
        id: id.clone(),
        title,
        summary,
        created_at,
        modified_at,
        file_type,
        size_bytes,
        has_logs,
        step_count,
        message_count,
        tool_call_count,
        error_count,
        project_id,
    };

    // 3. Scan for artifacts inside the brain/<id> directory
    let mut artifacts = Vec::new();
    let session_brain_dir = brain_dir.join(&id);
    if session_brain_dir.exists() {
        if let Ok(entries) = fs::read_dir(session_brain_dir) {
            for entry in entries {
                if let Ok(entry) = entry {
                    let path = entry.path();
                    if path.is_file() {
                        if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                            if ext == "md" || ext == "json" || ext == "txt" {
                                let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("").to_string();
                                if let Ok(content) = fs::read_to_string(&path) {
                                    artifacts.push(ArtifactFile {
                                        name,
                                        path: path.to_string_lossy().to_string(),
                                        content,
                                    });
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    Ok(ConversationDetail {
        id,
        metadata: meta,
        steps,
        artifacts,
    })
}

#[tauri::command]
pub fn delete_conversation(id: String) -> Result<(), String> {
    let conv_dir = get_conversations_dir()?;
    let brain_dir = get_brain_dir()?;

    // Remove DB files
    let db_files = vec![
        conv_dir.join(format!("{}.db", id)),
        conv_dir.join(format!("{}.db-shm", id)),
        conv_dir.join(format!("{}.db-wal", id)),
        conv_dir.join(format!("{}.pb", id)),
    ];

    for file in db_files {
        if file.exists() {
            let _ = fs::remove_file(file);
        }
    }

    // Remove brain directories
    let session_brain_dir = brain_dir.join(&id);
    if session_brain_dir.exists() {
        fs::remove_dir_all(session_brain_dir).map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub fn delete_conversations_batch(ids: Vec<String>) -> Result<(), String> {
    for id in ids {
        let _ = delete_conversation(id);
    }
    Ok(())
}
