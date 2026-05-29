import React from "react";
import { Project, ConversationMetadata, AuditStats } from "../types";
import { TranslationKey } from "../translations";
import { IconChevronRight } from "./Icons";
import "./WelcomePanel.css";

interface WelcomePanelProps {
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (val: boolean) => void;
  t: (key: TranslationKey, variables?: Record<string, string | number>) => string;
  projects: Project[];
  conversations: ConversationMetadata[];
  auditStats: AuditStats | null;
}

export const WelcomePanel: React.FC<WelcomePanelProps> = ({
  sidebarCollapsed,
  setSidebarCollapsed,
  t,
  projects,
  conversations,
  auditStats,
}) => {
  return (
    <div className="welcome-panel" style={{ position: "relative" }}>
      {sidebarCollapsed && (
        <button
          className="toggle-sidebar-btn floating-toggle-btn"
          onClick={() => setSidebarCollapsed(false)}
          title="Show Sidebar"
        >
          <IconChevronRight />
        </button>
      )}
      <img
        src="/logo.png"
        className="welcome-logo"
        alt="Logo"
        style={{ width: "96px", height: "96px", objectFit: "contain" }}
      />
      <h2 className="welcome-title">{t("welcomeTitle")}</h2>

      <p className="welcome-subtitle">{t("welcomeSubtitle")}</p>

      <div className="dashboard-grid">
        <div className="dash-card">
          <span className="dash-card-icon">📁</span>
          <span className="dash-card-val">{projects.length}</span>
          <span className="dash-card-lbl">{t("projectsLinked")}</span>
        </div>
        <div className="dash-card">
          <span className="dash-card-icon">💬</span>
          <span className="dash-card-val">{conversations.length}</span>
          <span className="dash-card-lbl">{t("totalSessions")}</span>
        </div>
        <div className="dash-card">
          <span className="dash-card-icon">⚡</span>
          <span className="dash-card-val">
            {auditStats ? auditStats.total_tool_calls : 0}
          </span>
          <span className="dash-card-lbl">{t("toolsAudited")}</span>
        </div>
      </div>
    </div>
  );
};
