use std::path::PathBuf;

pub fn get_gemini_dir() -> Result<PathBuf, String> {
    dirs::home_dir()
        .map(|p| p.join(".gemini"))
        .ok_or_else(|| "Could not find home directory".to_string())
}

pub fn get_projects_dir() -> Result<PathBuf, String> {
    Ok(get_gemini_dir()?.join("config").join("projects"))
}

pub fn get_conversations_dir() -> Result<PathBuf, String> {
    Ok(get_gemini_dir()?.join("antigravity").join("conversations"))
}

pub fn get_brain_dir() -> Result<PathBuf, String> {
    Ok(get_gemini_dir()?.join("antigravity").join("brain"))
}
