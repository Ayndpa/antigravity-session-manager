use std::collections::HashMap;
use std::fs;

use crate::models::AuditStats;
use crate::paths::get_brain_dir;
use crate::conversations::get_conversations;

#[tauri::command]
pub fn get_audit_stats() -> Result<AuditStats, String> {
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
