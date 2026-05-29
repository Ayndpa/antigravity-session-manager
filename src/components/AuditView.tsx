import React from "react";
import { AuditStats } from "../types";
import { TranslationKey } from "../translations";
import { IconChevronRight, IconRefresh } from "./Icons";
import "./AuditView.css";

interface AuditViewProps {
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (val: boolean) => void;
  t: (key: TranslationKey, variables?: Record<string, string | number>) => string;
  auditStats: AuditStats | null;
  loadData: () => void;
  projectMap: Map<string, string>;
}

export const AuditView: React.FC<AuditViewProps> = ({
  sidebarCollapsed,
  setSidebarCollapsed,
  t,
  auditStats,
  loadData,
  projectMap,
}) => {
  return (
    <div className="audit-container">
      <div className="audit-header">
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
          <h2 className="audit-title">{t("antigravitySessionsAudit")}</h2>
        </div>
        <button className="btn-primary" onClick={loadData}>
          <IconRefresh /> {t("refreshStats")}
        </button>
      </div>

      {auditStats ? (
        <>
          {/* Stats Cards */}
          <div className="audit-stats-grid">
            <div className="audit-stat-card">
              <span className="audit-stat-label">{t("totalConversations")}</span>
              <span className="audit-stat-value">{auditStats.total_conversations}</span>
            </div>
            <div className="audit-stat-card purple">
              <span className="audit-stat-label">{t("totalActionsSteps")}</span>
              <span className="audit-stat-value">{auditStats.total_steps}</span>
            </div>
            <div className="audit-stat-card">
              <span className="audit-stat-label">{t("toolCallsInvoked")}</span>
              <span className="audit-stat-value">{auditStats.total_tool_calls}</span>
            </div>
            <div className="audit-stat-card pink">
              <span className="audit-stat-label">{t("failedTasksErrors")}</span>
              <span className="audit-stat-value">
                {auditStats.total_errors}{" "}
                <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                  {t("successPercent", {
                    pct:
                      auditStats.total_steps > 0
                        ? ((1 - auditStats.total_errors / auditStats.total_steps) * 100).toFixed(1)
                        : "100",
                  })}
                </span>
              </span>
            </div>
          </div>

          {/* SVG Visualizations */}
          <div className="charts-row">
            {/* Tool frequency horizontal bar chart */}
            <div className="chart-card">
              <h3 className="chart-card-title">{t("top5ToolFrequencies")}</h3>
              <div className="chart-wrapper">
                {Object.keys(auditStats.tool_frequency).length === 0 ? (
                  <div className="empty-state">{t("noToolCallData")}</div>
                ) : (
                  <svg width="100%" height="100%" viewBox="0 0 400 240">
                    {(() => {
                      const sortedTools = Object.entries(auditStats.tool_frequency)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 5);
                      const maxVal = Math.max(...sortedTools.map((t) => t[1])) || 1;

                      return sortedTools.map(([toolName, val], idx) => {
                        const y = 20 + idx * 45;
                        const barWidth = (val / maxVal) * 220;

                        return (
                          <g key={toolName}>
                            <text
                              x="10"
                              y={y + 16}
                              fill="var(--text-muted)"
                              fontSize="11"
                              fontFamily="var(--font-mono)"
                            >
                              {toolName.length > 15
                                ? `${toolName.substring(0, 12)}...`
                                : toolName}
                            </text>
                            <rect x="130" y={y} width="220" height="20" rx="3" fill="#131836" />
                            <rect
                              x="130"
                              y={y}
                              width={barWidth}
                              height="20"
                              rx="3"
                              fill="url(#neonCyanGrad)"
                            >
                              <animate
                                attributeName="width"
                                from="0"
                                to={barWidth}
                                dur="0.8s"
                                fill="freeze"
                              />
                            </rect>
                            <text
                              x={135 + barWidth}
                              y={y + 15}
                              fill="var(--text-glow)"
                              fontSize="11"
                              fontWeight="700"
                            >
                              {val}
                            </text>
                          </g>
                        );
                      });
                    })()}
                    <defs>
                      <linearGradient id="neonCyanGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#00F2FE" stopOpacity="0.8" />
                        <stop offset="100%" stopColor="#9b51e0" stopOpacity="0.8" />
                      </linearGradient>
                    </defs>
                  </svg>
                )}
              </div>
            </div>

            {/* Sessions by project vertical bar chart */}
            <div className="chart-card">
              <h3 className="chart-card-title">{t("sessionsByProject")}</h3>
              <div className="chart-wrapper">
                {Object.keys(auditStats.conversations_by_project).length === 0 ? (
                  <div className="empty-state">{t("noProjectAssociationData")}</div>
                ) : (
                  <svg width="100%" height="100%" viewBox="0 0 400 240">
                    {(() => {
                      const sortedProjs = Object.entries(auditStats.conversations_by_project)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 5);
                      const maxVal = Math.max(...sortedProjs.map((t) => t[1])) || 1;

                      return (
                        <>
                          {sortedProjs.map(([projId, val], idx) => {
                            const x = 50 + idx * 70;
                            const barHeight = (val / maxVal) * 140;
                            const y = 180 - barHeight;
                            const name =
                              projectMap.get(projId) ||
                              (projId === "Unassociated" ? t("unassociated") : "Unknown");

                            return (
                              <g key={projId}>
                                <text
                                  x={x + 18}
                                  y={y - 8}
                                  fill="var(--text-glow)"
                                  fontSize="11"
                                  fontWeight="700"
                                  textAnchor="middle"
                                >
                                  {val}
                                </text>
                                <rect x={x} y="40" width="36" height="140" rx="4" fill="#131836" />
                                <rect
                                  x={x}
                                  y={y}
                                  width="36"
                                  height={barHeight}
                                  rx="4"
                                  fill="url(#neonPurpleGrad)"
                                >
                                  <animate
                                    attributeName="height"
                                    from="0"
                                    to={barHeight}
                                    dur="0.8s"
                                    fill="freeze"
                                  />
                                  <animate
                                    attributeName="y"
                                    from="180"
                                    to={y}
                                    dur="0.8s"
                                    fill="freeze"
                                  />
                                </rect>
                                <text
                                  x={x + 18}
                                  y="198"
                                  fill="var(--text-muted)"
                                  fontSize="10"
                                  textAnchor="middle"
                                  fontWeight="500"
                                >
                                  {name.length > 8 ? `${name.substring(0, 6)}..` : name}
                                </text>
                              </g>
                            );
                          })}
                          <defs>
                            <linearGradient id="neonPurpleGrad" x1="0%" y1="100%" x2="0%" y2="0%">
                              <stop offset="0%" stopColor="#9b51e0" stopOpacity="0.4" />
                              <stop offset="100%" stopColor="#ff007f" stopOpacity="0.8" />
                            </linearGradient>
                          </defs>
                        </>
                      );
                    })()}
                  </svg>
                )}
              </div>
            </div>
          </div>

          {/* Audit Errors Table */}
          <div className="chart-card" style={{ height: "auto", flex: "none" }}>
            <h3 className="chart-card-title">{t("errorVulnerabilitiesAudit")}</h3>
            <div style={{ overflowX: "auto", marginTop: "10px" }}>
              {Object.keys(auditStats.errors_by_tool).length === 0 ? (
                <div className="empty-state" style={{ padding: "20px" }}>
                  {t("zeroCriticalErrors")}
                </div>
              ) : (
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: "12px",
                    textAlign: "left",
                  }}
                >
                  <thead>
                    <tr
                      style={{
                        borderBottom: "1px solid var(--border-color)",
                        color: "var(--text-muted)",
                      }}
                    >
                      <th style={{ padding: "10px" }}>{t("taskModuleToolName")}</th>
                      <th style={{ padding: "10px" }}>{t("failureCount")}</th>
                      <th style={{ padding: "10px" }}>{t("securityLevel")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(auditStats.errors_by_tool).map(([toolName, val]) => (
                      <tr
                        key={toolName}
                        style={{ borderBottom: "1.5px solid rgba(255,255,255,0.02)" }}
                      >
                        <td
                          style={{
                            padding: "10px",
                            fontFamily: "var(--font-mono)",
                            color: "var(--neon-cyan)",
                          }}
                        >
                          {toolName}
                        </td>
                        <td style={{ padding: "10px", color: "var(--neon-pink)", fontWeight: "700" }}>
                          {val}
                        </td>
                        <td style={{ padding: "10px" }}>
                          <span
                            style={{
                              background: "rgba(255, 0, 127, 0.1)",
                              color: "var(--neon-pink)",
                              padding: "2px 6px",
                              borderRadius: "4px",
                              fontSize: "9px",
                              fontWeight: "800",
                              border: "0.5px solid var(--neon-pink)",
                            }}
                          >
                            {t("vulnerable")}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="empty-state">{t("noStatisticsLoaded")}</div>
      )}
    </div>
  );
};
