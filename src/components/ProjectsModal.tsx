import React, { useState, useEffect, useRef } from "react";
import { Project } from "../types";
import { TranslationKey } from "../translations";
import { IconClose, IconPlus, IconEdit, IconTrash } from "./Icons";
import "./ProjectsModal.css";

interface ProjectsModalProps {
  t: (key: TranslationKey, variables?: Record<string, string | number>) => string;
  projects: Project[];
  editingProject: Project | null;
  setEditingProject: (proj: Project | null) => void;
  isCreatingProject: boolean;
  setShowProjectModal: (val: boolean) => void;
  handleSaveProject: (e: React.FormEvent) => void;
  handleDeleteProject: (id: string) => void;
  handleDeleteProjectsBatch: (ids: string[]) => void;
  startEditProject: (proj: Project) => void;
  startCreateProject: () => void;
}

export const ProjectsModal: React.FC<ProjectsModalProps> = ({
  t,
  projects,
  editingProject,
  setEditingProject,
  isCreatingProject,
  setShowProjectModal,
  handleSaveProject,
  handleDeleteProject,
  handleDeleteProjectsBatch,
  startEditProject,
  startCreateProject,
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
  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h3 className="modal-header-title">{t("projectsDirectoryConfig")}</h3>
          <button
            className="modal-close-btn"
            onClick={() => {
              setShowProjectModal(false);
              setEditingProject(null);
            }}
          >
            <IconClose />
          </button>
        </div>

        <div className="modal-body">
          {editingProject ? (
            /* Edit/Create Form */
            <form onSubmit={handleSaveProject}>
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
          ) : (
            /* Projects List */
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                  {t("linkingPhysicalFolders")}
                </span>
                <button
                  className="btn-primary"
                  style={{ padding: "6px 12px" }}
                  onClick={startCreateProject}
                >
                  <IconPlus /> {t("addProject")}
                </button>
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
                      onClick={() => handleDeleteProjectsBatch(Array.from(batchSelectedProjectIds))}
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
                    return (
                      <div className="project-row-card" key={p.id}>
                        <div
                          style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1, minWidth: 0, cursor: "pointer" }}
                          onClick={(e) => handleProjectClick(e, p)}
                        >
                          <input
                            type="checkbox"
                            className="checkbox-custom project-item-checkbox"
                            checked={batchSelectedProjectIds.has(p.id)}
                            readOnly
                          />
                          <div className="project-card-info" style={{ flex: 1, minWidth: 0 }}>
                            <span className="project-card-name">{p.name}</span>
                            <span className="project-card-path">
                              {decodeURIComponent(uri)}
                            </span>
                          </div>
                        </div>
                        <div className="project-card-actions">
                          <button
                            className="sidebar-btn"
                            style={{ padding: "4px 8px" }}
                            onClick={() => startEditProject(p)}
                          >
                            <IconEdit />
                          </button>
                          <button
                            className="btn-danger-sm"
                            style={{ padding: "4px 8px" }}
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

        <div className="modal-footer">
          <button
            className="btn-secondary"
            onClick={() => {
              setShowProjectModal(false);
              setEditingProject(null);
            }}
          >
            {t("closeManager")}
          </button>
        </div>
      </div>
    </div>
  );
};
