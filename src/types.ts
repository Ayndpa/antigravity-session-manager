export interface Project {
  id: string;
  name: string;
  project_resources: {
    resources: Array<{
      git_folder: {
        folder_uri: string;
        allow_write: boolean;
      };
    }>;
  };
}

export interface ConversationMetadata {
  id: string;
  title: string;
  summary: string;
  created_at: string;
  modified_at: string;
  file_type: string;
  size_bytes: number;
  has_logs: boolean;
  step_count: number;
  message_count: number;
  tool_call_count: number;
  error_count: number;
  project_id: string | null;
}

export interface ArtifactFile {
  name: string;
  path: string;
  content: string;
}

export interface ConversationDetail {
  id: string;
  metadata: ConversationMetadata;
  steps: Array<any>;
  artifacts: Array<ArtifactFile>;
}

export interface AuditStats {
  total_conversations: number;
  total_steps: number;
  total_tool_calls: number;
  total_errors: number;
  tool_frequency: Record<string, number>;
  conversations_by_project: Record<string, number>;
  errors_by_tool: Record<string, number>;
  average_steps_per_conversation: number;
}

export interface BrainFolderInfo {
  id: string;
  title: string;
  file_count: number;
  total_size_bytes: number;
  has_conversation_db: boolean;
  last_modified: string;
}

export interface BrainFileInfo {
  name: string;
  relative_path: string;
  absolute_path: string;
  size_bytes: number;
  last_modified: string;
  file_type: "log" | "scratch" | "artifact" | "recording" | "html_artifact" | "other";
}
