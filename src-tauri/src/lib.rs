use std::fs;
use std::path::{Path, PathBuf};
use std::collections::HashMap;
use serde::{Serialize, Deserialize};
use rusqlite::{Connection, OpenFlags};
use chrono::{DateTime, Utc};

// Project structures matching frontend
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Project {
    pub id: String,
    pub name: String,
    pub project_resources: ProjectResources,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ProjectResources {
    pub resources: Vec<ProjectResource>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ProjectResource {
    pub git_folder: GitFolder,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GitFolder {
    pub folder_uri: String,
    pub allow_write: bool,
}

fn default_true() -> bool {
    true
}

// Project structures matching the exact format Antigravity reads/writes
#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct DiskProject {
    pub id: String,
    pub name: String,
    pub project_resources: DiskProjectResources,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct DiskProjectResources {
    pub resources: Vec<DiskProjectResource>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct DiskProjectResource {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub git_folder: Option<DiskGitFolder>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub folder_uri: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub allow_write: Option<bool>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct DiskGitFolder {
    pub folder_uri: String,
    #[serde(default = "default_true")]
    pub allow_write: bool,
}

// Conversation Metadata structure
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ConversationMetadata {
    pub id: String,
    pub title: String,
    pub summary: String,
    pub created_at: String,
    pub modified_at: String,
    pub file_type: String, // "db" or "pb"
    pub size_bytes: u64,
    pub has_logs: bool,
    pub step_count: usize,
    pub message_count: usize,
    pub tool_call_count: usize,
    pub error_count: usize,
    pub project_id: Option<String>,
}

// Full Conversation Detail
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ConversationDetail {
    pub id: String,
    pub metadata: ConversationMetadata,
    pub steps: Vec<serde_json::Value>,
    pub artifacts: Vec<ArtifactFile>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ArtifactFile {
    pub name: String,
    pub path: String,
    pub content: String,
}

// Audit stats
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AuditStats {
    pub total_conversations: usize,
    pub total_steps: usize,
    pub total_tool_calls: usize,
    pub total_errors: usize,
    pub tool_frequency: HashMap<String, usize>,
    pub conversations_by_project: HashMap<String, usize>,
    pub errors_by_tool: HashMap<String, usize>,
    pub average_steps_per_conversation: f64,
}

// Helper paths
fn get_gemini_dir() -> Result<PathBuf, String> {
    dirs::home_dir()
        .map(|p| p.join(".gemini"))
        .ok_or_else(|| "Could not find home directory".to_string())
}

fn get_projects_dir() -> Result<PathBuf, String> {
    Ok(get_gemini_dir()?.join("config").join("projects"))
}

fn get_conversations_dir() -> Result<PathBuf, String> {
    Ok(get_gemini_dir()?.join("antigravity").join("conversations"))
}

fn get_brain_dir() -> Result<PathBuf, String> {
    Ok(get_gemini_dir()?.join("antigravity").join("brain"))
}

// ---------------- PROJECT COMMANDS ----------------

#[tauri::command]
fn get_projects() -> Result<Vec<Project>, String> {
    let projects_dir = get_projects_dir()?;
    if !projects_dir.exists() {
        return Ok(Vec::new());
    }

    let mut projects = Vec::new();
    let entries = fs::read_dir(projects_dir).map_err(|e| e.to_string())?;

    for entry in entries {
        if let Ok(entry) = entry {
            let path = entry.path();
            if path.extension().map_or(false, |ext| ext == "json") {
                let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
                match serde_json::from_str::<DiskProject>(&content) {
                    Ok(disk_project) => {
                        // Map to Project structure
                        let mut resources = Vec::new();
                        for res in disk_project.project_resources.resources {
                            let folder_uri = if let Some(ref gf) = res.git_folder {
                                gf.folder_uri.clone()
                            } else if let Some(ref uri) = res.folder_uri {
                                uri.clone()
                            } else {
                                continue;
                            };

                            let allow_write = if let Some(ref gf) = res.git_folder {
                                gf.allow_write
                            } else {
                                res.allow_write.unwrap_or(true)
                            };

                            resources.push(ProjectResource {
                                git_folder: GitFolder {
                                    folder_uri,
                                    allow_write,
                                },
                            });
                        }

                        projects.push(Project {
                            id: disk_project.id,
                            name: disk_project.name,
                            project_resources: ProjectResources { resources },
                        });
                    }
                    Err(err) => {
                        eprintln!("Failed to parse project file {:?}: {}", path, err);
                    }
                }
            }
        }
    }

    Ok(projects)
}

#[tauri::command]
fn save_project(project: Project) -> Result<(), String> {
    let projects_dir = get_projects_dir()?;
    if !projects_dir.exists() {
        fs::create_dir_all(&projects_dir).map_err(|e| e.to_string())?;
    }

    // Map frontend Project to DiskProject (camelCase)
    let mut resources = Vec::new();
    for res in project.project_resources.resources {
        resources.push(DiskProjectResource {
            git_folder: Some(DiskGitFolder {
                folder_uri: res.git_folder.folder_uri,
                allow_write: res.git_folder.allow_write,
            }),
            folder_uri: None,
            allow_write: None,
        });
    }

    let disk_project = DiskProject {
        id: project.id.clone(),
        name: project.name,
        project_resources: DiskProjectResources { resources },
    };

    let filename = format!("{}.json", project.id);
    let filepath = projects_dir.join(filename);

    let content = serde_json::to_string_pretty(&disk_project).map_err(|e| e.to_string())?;
    fs::write(filepath, content).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
fn delete_project(id: String) -> Result<(), String> {
    let filepath = get_projects_dir()?.join(format!("{}.json", id));
    if filepath.exists() {
        fs::remove_file(filepath).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn delete_projects_batch(ids: Vec<String>) -> Result<(), String> {
    let projects_dir = get_projects_dir()?;
    for id in ids {
        let filepath = projects_dir.join(format!("{}.json", id));
        if filepath.exists() {
            let _ = fs::remove_file(filepath);
        }
    }
    Ok(())
}

// ---------------- CONVERSATION COMMANDS ----------------

// Helper: Scan blob for known project IDs
fn extract_project_id_from_blob(blob: &[u8], project_ids: &[String]) -> Option<String> {
    let blob_str = String::from_utf8_lossy(blob);
    for pid in project_ids {
        if blob_str.contains(pid) {
            return Some(pid.clone());
        }
    }
    None
}

// Helper: Get project ID associated with conversation SQLite db
fn get_project_id_from_db(db_path: &Path, project_ids: &[String]) -> Option<String> {
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
fn extract_title_and_summary(content: &str) -> (String, String) {
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
fn get_conversations() -> Result<Vec<ConversationMetadata>, String> {
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
fn get_conversation_detail(id: String) -> Result<ConversationDetail, String> {
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
fn delete_conversation(id: String) -> Result<(), String> {
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
fn delete_conversations_batch(ids: Vec<String>) -> Result<(), String> {
    for id in ids {
        let _ = delete_conversation(id);
    }
    Ok(())
}

// ---------------- AUDITING COMMAND ----------------

#[tauri::command]
fn get_audit_stats() -> Result<AuditStats, String> {
    let conversations = get_conversations()?;
    let brain_dir = get_brain_dir()?;

    let mut total_steps = 0;
    let mut total_tool_calls = 0;
    let mut total_errors = 0;
    let mut tool_frequency = HashMap::new();
    let mut conversations_by_project = HashMap::new();
    let mut errors_by_tool = HashMap::new();

    for conv in &conversations {
        total_steps += conv.step_count;
        total_tool_calls += conv.tool_call_count;
        total_errors += conv.error_count;

        // Group by project
        let proj_name = conv.project_id.clone().unwrap_or_else(|| "Unassociated".to_string());
        *conversations_by_project.entry(proj_name).or_insert(0) += 1;

        // Parse tool stats from transcripts if logs exist
        if conv.has_logs {
            let log_path = brain_dir.join(&conv.id).join(".system_generated").join("logs").join("transcript.jsonl");
            if let Ok(log_content) = fs::read_to_string(log_path) {
                for line in log_content.lines() {
                    if let Ok(val) = serde_json::from_str::<serde_json::Value>(line) {
                        let is_error = val.get("status").and_then(|s| s.as_str()) == Some("ERROR");
                        
                        // Look inside tool calls
                        if let Some(tool_calls) = val.get("tool_calls").and_then(|t| t.as_array()) {
                            for tool in tool_calls {
                                if let Some(name) = tool.get("name").and_then(|n| n.as_str()) {
                                    *tool_frequency.entry(name.to_string()).or_insert(0) += 1;
                                    if is_error {
                                        *errors_by_tool.entry(name.to_string()).or_insert(0) += 1;
                                    }
                                }
                            }
                        }

                        // Look at the step type for errors when they are not explicit tool_calls
                        if is_error {
                            if let Some(step_type) = val.get("type").and_then(|t| t.as_str()) {
                                // If it's a tool-related step type, log it
                                if step_type != "PLANNER_RESPONSE" && step_type != "USER_INPUT" && step_type != "CONVERSATION_HISTORY" {
                                    let clean_name = step_type.to_lowercase();
                                    *errors_by_tool.entry(clean_name).or_insert(0) += 1;
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    let total_conversations = conversations.len();
    let average_steps_per_conversation = if total_conversations > 0 {
        total_steps as f64 / total_conversations as f64
    } else {
        0.0
    };

    Ok(AuditStats {
        total_conversations,
        total_steps,
        total_tool_calls,
        total_errors,
        tool_frequency,
        conversations_by_project,
        errors_by_tool,
        average_steps_per_conversation,
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_projects,
            save_project,
            delete_project,
            delete_projects_batch,
            get_conversations,
            get_conversation_detail,
            delete_conversation,
            delete_conversations_batch,
            get_audit_stats
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}



#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_projects() {
        let projects = get_projects().expect("Failed to get projects");
        println!("Loaded {} projects", projects.len());
        for p in &projects {
            println!("Project: {} (ID: {})", p.name, p.id);
        }
        assert_eq!(projects.len(), 15);
    }
}
