import React, { useState, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { marked } from "marked";
import { BrainFolderInfo, BrainFileInfo } from "../types";
import { TranslationKey } from "../translations";
import {
  IconBrain,
  IconFile,
  IconTrash,
  IconEdit,
  IconClose,
  IconChevronLeft,
  IconRefresh,
  IconPlus
} from "./Icons";
import "./BrainView.css";

interface BrainViewProps {
  t: (key: TranslationKey, variables?: Record<string, string | number>) => string;
  showConfirm: (message: string) => Promise<boolean>;
  showAlert: (message: string) => Promise<void>;
}

export const BrainView: React.FC<BrainViewProps> = ({
  t,
  showConfirm,
  showAlert
}) => {
  const [brains, setBrains] = useState<BrainFolderInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterOrphaned, setFilterOrphaned] = useState(false);

  // File Explorer States
  const [selectedBrainId, setSelectedBrainId] = useState<string | null>(null);
  const [selectedBrainTitle, setSelectedBrainTitle] = useState("");
  const [brainFiles, setBrainFiles] = useState<BrainFileInfo[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);

  // File Editor States
  const [editingFile, setEditingFile] = useState<BrainFileInfo | null>(null);
  const [fileContent, setFileContent] = useState("");
  const [loadingContent, setLoadingContent] = useState(false);
  const [savingFile, setSavingFile] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [activeTab, setActiveTab] = useState<"edit" | "preview">("edit");
  const [isBinaryFile, setIsBinaryFile] = useState(false);

  const isBinary = (name: string) => {
    const ext = name.split('.').pop()?.toLowerCase();
    return ["webm", "mp4", "mov", "png", "jpg", "jpeg", "gif", "ico", "pdf", "zip", "gz", "tar", "db", "sqlite"].includes(ext || "");
  };

  // Create File Modal States
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [newFileType, setNewFileType] = useState<"scratch" | "artifact" | "other">("scratch");
  const [creatingFile, setCreatingFile] = useState(false);

  useEffect(() => {
    loadBrains();
  }, []);

  const loadBrains = async () => {
    setLoading(true);
    try {
      const res = await invoke<BrainFolderInfo[]>("get_brains");
      setBrains(res);
    } catch (e) {
      console.error("Failed to load brains:", e);
    } finally {
      setLoading(false);
    }
  };

  const deleteBrainFolder = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!(await showConfirm(t("confirmDeleteBrainFolder")))) return;
    try {
      await invoke("delete_brain", { id });
      await loadBrains();
      if (selectedBrainId === id) {
        setSelectedBrainId(null);
        setBrainFiles([]);
      }
    } catch (e) {
      await showAlert("Failed to delete brain folder: " + e);
    }
  };

  const cleanOrphanedBrains = async () => {
    if (!(await showConfirm(t("cleanOrphanedConfirm")))) return;
    setLoading(true);
    try {
      await invoke("clean_orphaned_brains");
      await showAlert(t("cleanOrphanedSuccess"));
      await loadBrains();
    } catch (e) {
      await showAlert("Failed to clean orphaned brains: " + e);
    } finally {
      setLoading(false);
    }
  };

  const selectBrain = async (brain: BrainFolderInfo) => {
    setSelectedBrainId(brain.id);
    setSelectedBrainTitle(brain.title);
    setLoadingFiles(true);
    try {
      const files = await invoke<BrainFileInfo[]>("get_brain_files", { id: brain.id });
      setBrainFiles(files);
    } catch (e) {
      console.error("Failed to fetch brain files:", e);
      await showAlert("Failed to fetch files: " + e);
    } finally {
      setLoadingFiles(false);
    }
  };

  const refreshFiles = async () => {
    if (!selectedBrainId) return;
    setLoadingFiles(true);
    try {
      const files = await invoke<BrainFileInfo[]>("get_brain_files", { id: selectedBrainId });
      setBrainFiles(files);
    } catch (e) {
      console.error("Failed to refresh files:", e);
    } finally {
      setLoadingFiles(false);
    }
  };

  const openFile = async (file: BrainFileInfo) => {
    setEditingFile(file);
    setFileContent("");
    setLoadingContent(true);
    setEditMode(false);

    if (isBinary(file.name)) {
      setIsBinaryFile(true);
      setLoadingContent(false);
      setActiveTab("edit");
      return;
    }

    setIsBinaryFile(false);
    setLoadingContent(true);
    setActiveTab(file.name.endsWith(".md") ? "preview" : "edit");

    try {
      const content = await invoke<string>("read_brain_file", { path: file.absolute_path });
      setFileContent(content);
    } catch (e) {
      console.error("Failed to read file content:", e);
      await showAlert("Failed to read file: " + e);
      setEditingFile(null);
    } finally {
      setLoadingContent(false);
    }
  };

  const saveFile = async () => {
    if (!editingFile) return;
    setSavingFile(true);
    try {
      await invoke("write_brain_file", {
        path: editingFile.absolute_path,
        content: fileContent
      });
      await showAlert(t("saveSuccess"));
      setEditMode(false);
      // Reload file info
      refreshFiles();
    } catch (e) {
      await showAlert("Failed to save file: " + e);
    } finally {
      setSavingFile(false);
    }
  };

  const deleteFile = async (e: React.MouseEvent, file: BrainFileInfo) => {
    e.stopPropagation();
    if (!(await showConfirm(t("deleteFileConfirm", { name: file.name })))) return;
    try {
      await invoke("delete_brain_file", { path: file.absolute_path });
      if (editingFile?.absolute_path === file.absolute_path) {
        setEditingFile(null);
      }
      refreshFiles();
    } catch (e) {
      await showAlert("Failed to delete file: " + e);
    }
  };

  const handleCreateFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBrainId || !newFileName.trim()) return;
    setCreatingFile(true);
    try {
      await invoke("create_brain_file", {
        id: selectedBrainId,
        name: newFileName.trim(),
        fileType: newFileType
      });
      setShowCreateModal(false);
      setNewFileName("");
      refreshFiles();
    } catch (e) {
      await showAlert("Failed to create file: " + e);
    } finally {
      setCreatingFile(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString();
    } catch (e) {
      return dateStr;
    }
  };

  // Computations
  const stats = useMemo(() => {
    let totalSize = 0;
    let orphanedCount = 0;
    brains.forEach((b) => {
      totalSize += b.total_size_bytes;
      if (!b.has_conversation_db) orphanedCount++;
    });
    return {
      totalFolders: brains.length,
      totalSize,
      orphanedCount
    };
  }, [brains]);

  const filteredBrains = useMemo(() => {
    return brains.filter((b) => {
      const matchesSearch =
        b.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.id.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesOrphaned = !filterOrphaned || !b.has_conversation_db;
      return matchesSearch && matchesOrphaned;
    });
  }, [brains, searchTerm, filterOrphaned]);

  // Group files by category
  const categorizedFiles = useMemo(() => {
    const categories = {
      log: [] as BrainFileInfo[],
      artifact: [] as BrainFileInfo[],
      scratch: [] as BrainFileInfo[],
      recording: [] as BrainFileInfo[],
      html_artifact: [] as BrainFileInfo[],
      other: [] as BrainFileInfo[]
    };
    brainFiles.forEach((file) => {
      if (file.file_type in categories) {
        categories[file.file_type as keyof typeof categories].push(file);
      } else {
        categories.other.push(file);
      }
    });
    return categories;
  }, [brainFiles]);

  const getFileCategoryLabel = (type: string) => {
    switch (type) {
      case "log": return t("logFile");
      case "scratch": return t("scratchFile");
      case "artifact": return t("artifactDoc");
      case "recording": return t("recordingFile");
      case "html_artifact": return t("htmlArtifact");
      default: return t("otherFile");
    }
  };

  const renderMarkdown = (md: string) => {
    try {
      const html = marked.parse(md) as string;
      return { __html: html };
    } catch (e) {
      return { __html: `<p>Error rendering markdown</p><pre>${md}</pre>` };
    }
  };

  return (
    <div className="brain-view-container">
      {/* HEADER SECTION */}
      <header className="brain-header">
        <div className="brain-title-row">
          {selectedBrainId && (
            <button className="btn-back" onClick={() => setSelectedBrainId(null)}>
              <IconChevronLeft /> {t("back")}
            </button>
          )}
          <div className="brain-title-wrapper">
            <h1 className="brain-title-main">
              <span className="brain-icon-gradient"><IconBrain /></span>
              {selectedBrainId ? t("filesInBrain", { id: selectedBrainTitle }) : t("brainManager")}
            </h1>
            <p className="brain-subtitle">
              {selectedBrainId ? `Folder ID: ${selectedBrainId}` : t("brainManagerDesc")}
            </p>
          </div>

          <div className="brain-header-actions">
            {!selectedBrainId ? (
              <>
                <button className="btn-refresh" onClick={loadBrains} disabled={loading}>
                  <IconRefresh /> {t("refreshStats")}
                </button>
                <button
                  className="btn-danger-sm flex-center"
                  onClick={cleanOrphanedBrains}
                  disabled={loading || stats.orphanedCount === 0}
                >
                  <IconTrash /> {t("cleanOrphaned")}
                </button>
              </>
            ) : (
              <>
                <button className="btn-refresh" onClick={refreshFiles} disabled={loadingFiles}>
                  <IconRefresh /> {t("refreshStats")}
                </button>
                <button className="btn-primary-sm flex-center" onClick={() => setShowCreateModal(true)}>
                  <IconPlus /> {t("createFile")}
                </button>
              </>
            )}
          </div>
        </div>

        {/* METRICS CARDS */}
        {!selectedBrainId && (
          <div className="brain-metrics-grid">
            <div className="metric-card glassmorphic">
              <span className="metric-label">{t("totalBrains")}</span>
              <span className="metric-value">{stats.totalFolders}</span>
            </div>
            <div className="metric-card glassmorphic">
              <span className="metric-label">{t("storageUsed")}</span>
              <span className="metric-value">{formatSize(stats.totalSize)}</span>
            </div>
            <div className="metric-card glassmorphic status-warning">
              <span className="metric-label">{t("orphaned")}</span>
              <span className="metric-value">{stats.orphanedCount}</span>
            </div>
          </div>
        )}
      </header>

      {/* MAIN CONTENT AREA */}
      <div className="brain-content-body">
        {loading ? (
          <div className="loading-wrapper center-loading">
            <div className="spinner"></div>
            <div className="loading-text">{t("decryptingTimeline")}</div>
          </div>
        ) : !selectedBrainId ? (
          /* ================= BRAIN FOLDERS DASHBOARD ================= */
          <div className="brain-dashboard">
            <div className="filter-controls-row glassmorphic">
              <div className="search-input-wrapper flex-grow">
                <span className="search-icon-span"><IconBrain /></span>
                <input
                  type="text"
                  placeholder={t("searchBrains")}
                  className="search-input"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="filter-toggle-buttons">
                <button
                  className={`btn-toggle-filter ${!filterOrphaned ? "active" : ""}`}
                  onClick={() => setFilterOrphaned(false)}
                >
                  {t("filterAll")}
                </button>
                <button
                  className={`btn-toggle-filter ${filterOrphaned ? "active" : ""}`}
                  onClick={() => setFilterOrphaned(true)}
                >
                  {t("filterOrphaned")}
                </button>
              </div>
            </div>

            {filteredBrains.length === 0 ? (
              <div className="empty-state">
                <span className="empty-state-icon">🧠</span>
                <div>{t("noBrainFolders")}</div>
              </div>
            ) : (
              <div className="brains-grid">
                {filteredBrains.map((brain) => (
                  <div
                    key={brain.id}
                    className="brain-folder-card glassmorphic"
                    onClick={() => selectBrain(brain)}
                  >
                    <div className="card-header">
                      <h3 className="card-title" title={brain.title}>
                        {brain.title}
                      </h3>
                      <span className={`badge ${brain.has_conversation_db ? "badge-active" : "badge-orphaned"}`}>
                        {brain.has_conversation_db ? t("active") : t("orphaned")}
                      </span>
                    </div>

                    <p className="card-uuid">ID: {brain.id}</p>

                    <div className="card-stats">
                      <div className="stat-item">
                        <span className="stat-label">Files</span>
                        <span className="stat-val">{brain.file_count}</span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-label">Size</span>
                        <span className="stat-val">{formatSize(brain.total_size_bytes)}</span>
                      </div>
                    </div>

                    <div className="card-footer">
                      <span className="date-span">📅 {formatDate(brain.last_modified).split(" ")[0]}</span>
                      <div className="card-actions">
                        <button className="btn-card-primary">{t("expandLogs")}</button>
                        <button
                          className="btn-card-danger"
                          onClick={(e) => deleteBrainFolder(e, brain.id)}
                          title="Delete folder"
                        >
                          <IconTrash />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* ================= FILES EXPLORER VIEW ================= */
          <div className="brain-files-explorer">
            {loadingFiles ? (
              <div className="loading-wrapper">
                <div className="spinner"></div>
                <div className="loading-text">Loading files...</div>
              </div>
            ) : brainFiles.length === 0 ? (
              <div className="empty-state">
                <span className="empty-state-icon">📂</span>
                <div>Folder is empty. Create a file to get started.</div>
              </div>
            ) : (
              <div className="files-category-list">
                {Object.entries(categorizedFiles).map(([category, files]) => {
                  if (files.length === 0) return null;
                  return (
                    <div key={category} className="files-category-section glassmorphic">
                      <h2 className="category-title">
                        {category === "log" && "📜"}
                        {category === "scratch" && "🧪"}
                        {category === "artifact" && "📦"}
                        {category === "recording" && "📹"}
                        {category === "html_artifact" && "🌐"}
                        {category === "other" && "📄"}
                        {" "}{getFileCategoryLabel(category)} ({files.length})
                      </h2>
                      <div className="files-table-wrapper">
                        <table className="files-table">
                          <thead>
                            <tr>
                              <th>Name</th>
                              <th>Path</th>
                              <th>Size</th>
                              <th>Last Modified</th>
                              <th style={{ width: "100px", textAlign: "right" }}>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {files.map((file) => (
                              <tr key={file.absolute_path} className="file-row" onClick={() => openFile(file)}>
                                <td>
                                  <span className="file-name-cell">
                                    <IconFile /> {file.name}
                                  </span>
                                </td>
                                <td><span className="file-path-cell" title={file.relative_path}>{file.relative_path}</span></td>
                                <td>{formatSize(file.size_bytes)}</td>
                                <td>{formatDate(file.last_modified)}</td>
                                <td style={{ textAlign: "right" }}>
                                  <div className="file-actions" onClick={(e) => e.stopPropagation()}>
                                    <button className="btn-file-edit" onClick={() => openFile(file)}>
                                      <IconEdit />
                                    </button>
                                    {file.file_type !== "log" && (
                                      <button className="btn-file-danger" onClick={(e) => deleteFile(e, file)}>
                                        <IconTrash />
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ================= FILE EDITOR PANEL (OVERLAY) ================= */}
      {editingFile && (
        <div className="editor-overlay">
          <div className="editor-panel glassmorphic">
            <header className="editor-header">
              <div className="editor-header-title">
                <span className="editor-icon"><IconFile /></span>
                <div>
                  <h3>{editingFile.name}</h3>
                  <p>{editingFile.relative_path}</p>
                </div>
              </div>
              <button className="btn-editor-close" onClick={() => setEditingFile(null)}>
                <IconClose />
              </button>
            </header>

            {loadingContent ? (
              <div className="editor-loading">
                <div className="spinner"></div>
                <div>Loading content...</div>
              </div>
            ) : (
              <>
                {/* Editor Tabs & Controls */}
                <div className="editor-toolbar">
                  <div className="editor-tabs">
                    {editingFile.name.endsWith(".md") && !isBinaryFile && (
                      <button
                        className={`editor-tab ${activeTab === "preview" ? "active" : ""}`}
                        onClick={() => setActiveTab("preview")}
                      >
                        {t("previewMarkdown")}
                      </button>
                    )}
                    {!isBinaryFile && (
                      <button
                        className={`editor-tab ${activeTab === "edit" ? "active" : ""}`}
                        onClick={() => setActiveTab("edit")}
                      >
                        {editingFile.file_type === "log" ? "View Logs" : t("editContent")}
                      </button>
                    )}
                  </div>

                  <div className="editor-actions">
                    {editingFile.file_type !== "log" && !isBinaryFile && !editMode && (
                      <button className="btn-primary-sm" onClick={() => { setEditMode(true); setActiveTab("edit"); }}>
                        <IconEdit /> Edit
                      </button>
                    )}
                    {editMode && (
                      <>
                        <button className="btn-secondary-sm" onClick={() => setEditMode(false)}>
                          {t("cancel")}
                        </button>
                        <button className="btn-primary-sm" onClick={saveFile} disabled={savingFile}>
                          {savingFile ? "Saving..." : t("save")}
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Editor/Viewer Workspace */}
                <div className="editor-workspace">
                  {isBinaryFile ? (
                    <div className="binary-preview-placeholder" style={{ padding: "40px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, color: "var(--text-muted)", gap: "15px", textAlign: "center" }}>
                      <span style={{ fontSize: "48px" }}>💾</span>
                      <h4 style={{ margin: 0, color: "var(--text-main)", fontSize: "16px" }}>{editingFile.name}</h4>
                      <p style={{ margin: 0, fontSize: "13px", maxWidth: "400px" }}>{t("binaryFileNotice")}</p>
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px", background: "rgba(0,0,0,0.15)", padding: "12px 20px", borderRadius: "8px", border: "1px solid var(--border-color)", marginTop: "10px", fontSize: "12px", fontFamily: "monospace" }}>
                        <div><strong>Size:</strong> {formatSize(editingFile.size_bytes)}</div>
                        <div><strong>Type:</strong> {editingFile.file_type.toUpperCase()}</div>
                        <div><strong>Modified:</strong> {formatDate(editingFile.last_modified)}</div>
                      </div>
                    </div>
                  ) : activeTab === "preview" ? (
                    <div
                      className="markdown-rendered-view"
                      dangerouslySetInnerHTML={renderMarkdown(fileContent || "# No Content")}
                    />
                  ) : (
                    <div className="editor-textarea-wrapper">
                      <textarea
                        className="editor-textarea"
                        value={fileContent}
                        onChange={(e) => setFileContent(e.target.value)}
                        readOnly={!editMode || editingFile.file_type === "log"}
                        placeholder={t("emptyFile")}
                      />
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ================= NEW FILE MODAL ================= */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal-panel glassmorphic">
            <header className="modal-header">
              <h3>{t("createFile")}</h3>
              <button className="btn-modal-close" onClick={() => setShowCreateModal(false)}>
                <IconClose />
              </button>
            </header>

            <form onSubmit={handleCreateFile}>
              <div className="modal-body">
                <div className="form-group">
                  <label>{t("fileName")}</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. script.py, plan.md, notes.txt"
                    className="modal-input"
                    value={newFileName}
                    onChange={(e) => setNewFileName(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>{t("fileType")}</label>
                  <select
                    className="modal-select"
                    value={newFileType}
                    onChange={(e) => setNewFileType(e.target.value as any)}
                  >
                    <option value="scratch">{t("scratchFile")}</option>
                    <option value="artifact">{t("artifactDoc")}</option>
                    <option value="recording">{t("recordingFile")}</option>
                    <option value="html_artifact">{t("htmlArtifact")}</option>
                    <option value="other">{t("otherFile")}</option>
                  </select>
                </div>
              </div>

              <footer className="modal-footer">
                <button type="button" className="btn-secondary-sm" onClick={() => setShowCreateModal(false)}>
                  {t("cancel")}
                </button>
                <button type="submit" className="btn-primary-sm" disabled={creatingFile}>
                  {creatingFile ? "Creating..." : t("confirm")}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
