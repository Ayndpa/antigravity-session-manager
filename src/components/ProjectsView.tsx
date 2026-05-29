import React, { useState, useEffect, useRef } from "react";
import { Project, ConversationMetadata } from "../types";
import { TranslationKey } from "../translations";
import { IconClose, IconPlus, IconEdit, IconTrash, IconChevronRight } from "./Icons";
import "./ProjectsView.css";

interface ProjectsViewProps {
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (val: boolean) => void;
  t: (key: TranslationKey, variables?: Record<string, string | number>) => string;
  projects: Project[];
  editingProject: Project | null;
  setEditingProject: (proj: Project | null) => void;
  isCreatingProject: boolean;
  setShowProjectsView: (val: boolean) => void;
  handleSaveProject: (e: React.FormEvent) => void;
  handleDeleteProject: (id: string) => void;
  handleDeleteProjectsBatch: (ids: string[]) => void;
  startEditProject: (proj: Project) => void;
  startCreateProject: () => void;
  conversations: ConversationMetadata[];
}

export const ProjectsView: React.FC<ProjectsViewProps> = ({
  sidebarCollapsed,
  setSidebarCollapsed,
  t,
  projects,
  editingProject,
  setEditingProject,
  isCreatingProject,
  setShowProjectsView,
  handleSaveProject,
  handleDeleteProject,
  handleDeleteProjectsBatch,
  startEditProject,
  startCreateProject,
  conversations,
}) => {
  const [batchSelectedProjectIds, setBatchSelectedProjectIds] = useState<Set<string>>(new Set());
  const lastClickedProjectIdRef = useRef<string | null>(null);

  const handleProjectClick = (e: React.MouseEvent, p: Project) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      setBatchSelectedProjectIds((prev) => {
        const next = new Set(prev);
        if (next.has(p.id)) {
          next.delete(p.id);
        } else {
          next.add(p.id);
        }
        return next;
      });
      lastClickedProjectIdRef.current = p.id;
    } else if (e.shiftKey) {
      e.preventDefault();
      const lastId = lastClickedProjectIdRef.current;
      const currentIdx = projects.findIndex((item) => item.id === p.id);
      const lastIdx = lastId ? projects.findIndex((item) => item.id === lastId) : -1;

      const idsInRange: string[] = [];
      if (lastIdx !== -1 && currentIdx !== -1) {
        const start = Math.min(lastIdx, currentIdx);
        const end = Math.max(lastIdx, currentIdx);
        for (let i = start; i <= end; i++) {
          idsInRange.push(projects[i].id);
        }
      } else {
        idsInRange.push(p.id);
      }

      const shouldSelect = !batchSelectedProjectIds.has(p.id);

      setBatchSelectedProjectIds((prev) => {
        const next = new Set(prev);
        if (shouldSelect) {
          idsInRange.forEach((id) => next.add(id));
        } else {
          idsInRange.forEach((id) => next.delete(id));
        }
        return next;
      });
      lastClickedProjectIdRef.current = p.id;
    } else {
      // Normal click: toggle selection
      setBatchSelectedProjectIds((prev) => {
        const next = new Set(prev);
        if (next.has(p.id)) {
          next.delete(p.id);
        } else {
          next.add(p.id);
        }
        return next;
      });
      lastClickedProjectIdRef.current = p.id;
    }
  };

  useEffect(() => {
    setBatchSelectedProjectIds(new Set());
  }, [editingProject, projects.length]);

  // Compute summary stats for the cards
  const writeAccessCount = projects.filter(
    (p) => p.project_resources.resources[0]?.git_folder.allow_write
  ).length;
  const unassociatedCount = conversations.filter((c) => !c.project_id).length;

  return (
    <div className="projects-container">
      {/* Header */}
      <div className="projects-header">
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {sidebarCollapsed && (
            <button
              className="toggle-sidebar-btn"
              onClick={() => setSidebarCollapsed(false)}
              title="Show Sidebar"
            >
              <IconChevronRight />
            </button>
          )}
          <h2 className="projects-title">{t("projectsDirectoryConfig")}</h2>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          {!editingProject && (
            <button className="btn-primary" onClick={startCreateProject}>
              <IconPlus /> {t("addProject")}
            </button>
          )}
          <button
            className="btn-secondary"
            style={{ padding: "6px 12px" }}
            onClick={() => {
              setShowProjectsView(false);
              setEditingProject(null);
            }}
          >
            <IconClose /> {t("closeManager")}
          </button>
        </div>
      </div>

      {/* Stats Cards (similar to AuditView) */}
      {!editingProject && (
        <div className="projects-stats-grid">
          <div className="projects-stat-card">
            <span className="projects-stat-label">{t("projects") || "Total Projects"}</span>
            <span className="projects-stat-value">{projects.length}</span>
          </div>
          <div className="projects-stat-card purple">
            <span className="projects-stat-label">{t("enableWriteAccess") || "Write Allowed"}</span>
            <span className="projects-stat-value">{writeAccessCount}</span>
          </div>
          <div className="projects-stat-card pink">
            <span className="projects-stat-label">{t("unassociated") || "Unassociated Sessions"}</span>
            <span className="projects-stat-value">{unassociatedCount}</span>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="projects-content-card">
        {editingProject ? (
          /* Edit/Create Form Card */
          <div>
            <h3 className="projects-content-title" style={{ marginBottom: "20px" }}>
              {isCreatingProject ? t("registerProject") : t("applyEdits")}
            </h3>
            <form onSubmit={handleSaveProject} className="form-card">
              <div className="form-group">
                <label className="form-label">{t("projectIdUuid")}</label>
                <input
                  type="text"
                  className="form-input"
                  disabled
                  value={editingProject.id}
                />
              </div>
              <div className="form-group">
                <label className="form-label">{t("projectName")}</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  placeholder="e.g. Lively Hubble"
                  value={editingProject.name}
                  onChange={(e) =>
                    setEditingProject({
                      ...editingProject,
                      name: e.target.value,
                    })
                  }
                />
              </div>
              <div className="form-group">
                <label className="form-label">{t("gitWorkspaceFolderUri")}</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  placeholder="file:///c:/path/to/folder"
                  value={
                    editingProject.project_resources.resources[0].git_folder
                      .folder_uri
                  }
                  onChange={(e) => {
                    const updated = { ...editingProject };
                    updated.project_resources.resources[0].git_folder.folder_uri =
                      e.target.value;
                    setEditingProject(updated);
                  }}
                />
              </div>
              <div className="form-checkbox-row">
                <input
                  type="checkbox"
                  id="allowWriteCheckbox"
                  className="checkbox-custom"
                  checked={
                    editingProject.project_resources.resources[0].git_folder
                      .allow_write
                  }
                  onChange={(e) => {
                    const updated = { ...editingProject };
                    updated.project_resources.resources[0].git_folder.allow_write =
                      e.target.checked;
                    setEditingProject(updated);
                  }}
                />
                <label htmlFor="allowWriteCheckbox" className="form-checkbox-label">
                  {t("enableWriteAccess")}
                </label>
              </div>
              <div
                style={{
                  marginTop: "24px",
                  display: "flex",
                  gap: "10px",
                  justifyContent: "flex-end",
                }}
              >
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setEditingProject(null)}
                >
                  {t("back")}
                </button>
                <button type="submit" className="btn-primary">
                  {isCreatingProject ? t("registerProject") : t("applyEdits")}
                </button>
              </div>
            </form>
          </div>
        ) : (
          /* Projects List */
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <h3 className="projects-content-title" style={{ borderBottom: "none", paddingBottom: 0, margin: 0 }}>
                {t("projects") || "Projects List"}
              </h3>
              <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                {t("linkingPhysicalFolders")}
              </span>
            </div>

            {projects.length > 0 && (
              <div className="project-batch-bar">
                <label className="checkbox-label" style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    className="checkbox-custom"
                    checked={
                      projects.length > 0 &&
                      projects.every((p) => batchSelectedProjectIds.has(p.id))
                    }
                    onChange={(e) => {
                      if (e.target.checked) {
                        setBatchSelectedProjectIds(new Set(projects.map((p) => p.id)));
                      } else {
                        setBatchSelectedProjectIds(new Set());
                      }
                    }}
                  />
                  {t("selectAll")}
                </label>
                {batchSelectedProjectIds.size > 0 && (
                  <button
                    className="btn-danger-sm"
                    onClick={() => {
                      handleDeleteProjectsBatch(Array.from(batchSelectedProjectIds));
                    }}
                  >
                    {t("deleteSelected", { count: batchSelectedProjectIds.size })}
                  </button>
                )}
              </div>
            )}

            {projects.length === 0 ? (
              <div className="empty-state">{t("noProjectsLoaded")}</div>
            ) : (
              <div className="project-list-grid">
                {projects.map((p) => {
                  const uri =
                    p.project_resources.resources[0]?.git_folder.folder_uri ||
                    "No folder";
                  const allowWrite = p.project_resources.resources[0]?.git_folder.allow_write;
                  return (
                    <div className="project-row-card" key={p.id}>
                      <div
                        style={{ display: "flex", alignItems: "center", gap: "14px", flex: 1, minWidth: 0, cursor: "pointer" }}
                        onClick={(e) => handleProjectClick(e, p)}
                      >
                        <input
                          type="checkbox"
                          className="checkbox-custom project-item-checkbox"
                          checked={batchSelectedProjectIds.has(p.id)}
                          readOnly
                        />
                        <div className="project-card-info" style={{ flex: 1, minWidth: 0 }}>
                          <div className="project-card-name-row">
                            <span className="project-card-name" title={p.name}>{p.name}</span>
                            {allowWrite ? (
                              <span className="badge-write">{t("enableWriteAccess") ? "Write" : "Write"}</span>
                            ) : (
                              <span className="badge-readonly">Read-Only</span>
                            )}
                          </div>
                          <span className="project-card-path" title={decodeURIComponent(uri)}>
                            {decodeURIComponent(uri)}
                          </span>
                        </div>
                      </div>
                      <div className="project-card-actions">
                        <button
                          className="sidebar-btn"
                          style={{ padding: "6px 10px", width: "auto" }}
                          onClick={() => startEditProject(p)}
                          title={t("applyEdits")}
                        >
                          <IconEdit />
                        </button>
                        <button
                          className="btn-danger-sm"
                          style={{ padding: "6px 10px" }}
                          onClick={() => handleDeleteProject(p.id)}
                        >
                          <IconTrash />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
