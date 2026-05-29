pub mod models;
pub mod paths;
pub mod projects;
pub mod conversations;
pub mod audit;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            projects::get_projects,
            projects::save_project,
            projects::delete_project,
            projects::delete_projects_batch,
            conversations::get_conversations,
            conversations::get_conversation_detail,
            conversations::delete_conversation,
            conversations::delete_conversations_batch,
            audit::get_audit_stats
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_projects() {
        let projects = projects::get_projects().expect("Failed to get projects");
        println!("Loaded {} projects", projects.len());
        for p in &projects {
            println!("Project: {} (ID: {})", p.name, p.id);
        }
        assert_eq!(projects.len(), 15);
    }
}
