use serde::{Serialize, Deserialize};
use std::collections::HashMap;

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
