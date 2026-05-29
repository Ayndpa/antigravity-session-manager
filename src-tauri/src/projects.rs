use std::fs;
use crate::models::{
    Project, DiskProject, DiskProjectResource, DiskProjectResources,
    DiskGitFolder, ProjectResource, GitFolder, ProjectResources
};
use crate::paths::get_projects_dir;

#[tauri::command]
pub fn get_projects() -> Result<Vec<Project>, String> {
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
pub fn save_project(project: Project) -> Result<(), String> {
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
pub fn delete_project(id: String) -> Result<(), String> {
    let filepath = get_projects_dir()?.join(format!("{}.json", id));
    if filepath.exists() {
        fs::remove_file(filepath).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn delete_projects_batch(ids: Vec<String>) -> Result<(), String> {
    let projects_dir = get_projects_dir()?;
    for id in ids {
        let filepath = projects_dir.join(format!("{}.json", id));
        if filepath.exists() {
            let _ = fs::remove_file(filepath);
        }
    }
    Ok(())
}
