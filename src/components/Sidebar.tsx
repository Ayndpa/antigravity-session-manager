import React from "react";
import { ConversationMetadata, Project } from "../types";
import { TranslationKey } from "../translations";
import {
  IconSearch,
  IconFolder,
  IconChart,
  IconChevronLeft,
} from "./Icons";
import "./Sidebar.css";

interface SidebarProps {
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (val: boolean) => void;
  lang: "en" | "zh";
  setLang: (lang: "en" | "zh") => void;
  t: (key: TranslationKey, variables?: Record<string, string | number>) => string;
  projects: Project[];
  conversations: ConversationMetadata[];
  filteredConversations: ConversationMetadata[];
  selectedConvId: string | null;
  selectConversation: (id: string) => void;
  batchSelectedIds: Set<string>;
  setBatchSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  projectFilter: string;
  setProjectFilter: (filter: string) => void;
  typeFilter: string;
  setTypeFilter: (filter: string) => void;
  loading: boolean;
  projectMap: Map<string, string>;
  setShowProjectModal: (val: boolean) => void;
  showAuditView: boolean;
  setShowAuditView: (val: boolean) => void;
  deleteConversationsBatch: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  sidebarCollapsed,
  setSidebarCollapsed,
  lang,
  setLang,
  t,
  projects,
  filteredConversations,
  selectedConvId,
  selectConversation,
  batchSelectedIds,
  setBatchSelectedIds,
  searchTerm,
  setSearchTerm,
  projectFilter,
  setProjectFilter,
  typeFilter,
  setTypeFilter,
  loading,
  projectMap,
  setShowProjectModal,
  showAuditView,
  setShowAuditView,
  deleteConversationsBatch,
}) => {
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const ids = filteredConversations.map((c) => c.id);
      setBatchSelectedIds(new Set(ids));
    } else {
      setBatchSelectedIds(new Set());
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleString();
    } catch (e) {
      return dateStr;
    }
  };

  return (
    <aside className={`sidebar ${sidebarCollapsed ? "collapsed" : ""}`}>
      <div className="sidebar-header">
        <div
          className="brand-section"
          style={{
            display: "flex",
            justifyContent: "space-between",
            width: "100%",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <img
              src="/logo.png"
              className="brand-logo"
              alt="Logo"
              style={{ width: "24px", height: "24px", objectFit: "contain" }}
            />
            <h1 className="brand-name">Antigravity</h1>
          </div>
          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
            <button
              className="toggle-sidebar-btn"
              style={{
                width: "auto",
                padding: "0 8px",
                fontSize: "11px",
                height: "28px",
              }}
              onClick={() => setLang(lang === "en" ? "zh" : "en")}
              title={lang === "en" ? "切换为中文" : "Switch to English"}
            >
              🌐 {lang === "en" ? "ZH" : "EN"}
            </button>
            <button
              className="toggle-sidebar-btn"
              style={{ width: "28px", height: "28px" }}
              onClick={() => setSidebarCollapsed(true)}
              title="Collapse Sidebar"
            >
              <IconChevronLeft />
            </button>
          </div>
        </div>

        <div className="sidebar-controls" style={{ flexWrap: "wrap", gap: "6px" }}>
          <button className="sidebar-btn" onClick={() => setShowProjectModal(true)}>
            <IconFolder /> {t("projects")}
          </button>
          <button
            className="sidebar-btn"
            onClick={() => setShowAuditView(!showAuditView)}
          >
            <IconChart /> {showAuditView ? t("sessions") : t("audit")}
          </button>
        </div>
      </div>

      {/* Filters Panel */}
      <div className="search-filter-section">
        <div className="search-input-wrapper">
          <span
            style={{
              position: "absolute",
              left: "10px",
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--text-muted)",
              display: "flex",
            }}
          >
            <IconSearch />
          </span>
          <input
            type="text"
            placeholder={t("searchSessions")}
            className="search-input"
            style={{ paddingLeft: "32px" }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="filter-row">
          <select
            className="filter-select"
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
          >
            <option value="all">{t("allProjects")}</option>
            <option value="unassociated">{t("unassociated")}</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            className="filter-select"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="all">{t("allFormats")}</option>
            <option value="db">{t("sqliteDb")}</option>
            <option value="pb">{t("protobufPb")}</option>
          </select>
        </div>
      </div>

      {/* Conversation List */}
      {loading ? (
        <div className="loading-wrapper">
          <div className="spinner"></div>
          <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
            {t("initializingScanner")}
          </div>
        </div>
      ) : filteredConversations.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state-icon">🛰️</span>
          <div>{t("noConversationsMatch")}</div>
        </div>
      ) : (
        <div className="conversation-list-container">
          {filteredConversations.map((c) => {
            const isSelected = selectedConvId === c.id;
            const isChecked = batchSelectedIds.has(c.id);
            const pName = c.project_id
              ? projectMap.get(c.project_id) || "Binding Project"
              : null;

            return (
              <div
                key={c.id}
                className={`conv-item ${isSelected ? "active" : ""}`}
                onClick={() => selectConversation(c.id)}
              >
                <input
                  type="checkbox"
                  className="checkbox-custom conv-item-checkbox"
                  checked={isChecked}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => {
                    setBatchSelectedIds((prev) => {
                      const next = new Set(prev);
                      if (e.target.checked) next.add(c.id);
                      else next.delete(c.id);
                      return next;
                    });
                  }}
                />
                <div className="conv-item-content">
                  <div className="conv-item-header">
                    <span className="conv-item-title" title={c.title}>
                      {c.title}
                    </span>
                    <span className={`conv-item-badge badge-${c.file_type}`}>
                      {c.file_type}
                    </span>
                  </div>
                  <div className="conv-item-desc" title={c.summary}>
                    {c.summary}
                  </div>
                  <div className="conv-item-footer">
                    <span>
                      {pName ? `📁 ${pName}` : `📡 ${t("unassociated")}`}
                    </span>
                    <span>{formatDate(c.modified_at).split(" ")[0]}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Batch Actions Footer */}
      {!loading && filteredConversations.length > 0 && (
        <div className="batch-actions-bar">
          <label className="checkbox-label">
            <input
              type="checkbox"
              className="checkbox-custom"
              checked={
                filteredConversations.length > 0 &&
                filteredConversations.every((c) => batchSelectedIds.has(c.id))
              }
              onChange={(e) => handleSelectAll(e.target.checked)}
            />
            {t("selectAll")}
          </label>
          {batchSelectedIds.size > 0 && (
            <button className="btn-danger-sm" onClick={deleteConversationsBatch}>
              {t("deleteSelected", { count: batchSelectedIds.size })}
            </button>
          )}
        </div>
      )}
    </aside>
  );
};
