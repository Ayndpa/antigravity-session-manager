import React from "react";
import { marked } from "marked";
import { ConversationDetail, ArtifactFile } from "../types";
import { TranslationKey } from "../translations";
import {
  IconChevronRight,
  IconDatabase,
  IconExport,
  IconTrash,
  IconTerminal,
  IconTool,
  IconClose,
} from "./Icons";
import "./DetailView.css";

interface DetailViewProps {
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (val: boolean) => void;
  t: (key: TranslationKey, variables?: Record<string, string | number>) => string;
  selectedConvDetail: ConversationDetail;
  deleteConversation: (id: string) => void;
  handleExportJson: () => void;
  activeArtifact: ArtifactFile | null;
  setActiveArtifact: (art: ArtifactFile | null) => void;
  expandedSteps: Set<number>;
  toggleStepExpanded: (idx: number) => void;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
}

export const DetailView: React.FC<DetailViewProps> = ({
  sidebarCollapsed,
  setSidebarCollapsed,
  t,
  selectedConvDetail,
  deleteConversation,
  handleExportJson,
  activeArtifact,
  setActiveArtifact,
  expandedSteps,
  toggleStepExpanded,
  messagesEndRef,
}) => {
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleString();
    } catch (e) {
      return dateStr;
    }
  };

  const renderMarkdown = (mdText: string) => {
    try {
      const parsed = marked.parse(mdText) as string;
      return (
        <div
          className="markdown-body"
          dangerouslySetInnerHTML={{ __html: parsed }}
        />
      );
    } catch (e) {
      return <div style={{ whiteSpace: "pre-wrap" }}>{mdText}</div>;
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flex: 1,
        height: "100%",
        overflow: "hidden",
        minWidth: 0,
      }}
    >
      {/* Main timeline thread */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          height: "100%",
          overflow: "hidden",
          minWidth: 0,
        }}
      >
        {/* Header */}
        <div className="chat-header">
          {sidebarCollapsed && (
            <button
              className="toggle-sidebar-btn"
              onClick={() => setSidebarCollapsed(false)}
              style={{ marginRight: "12px" }}
              title="Show Sidebar"
            >
              <IconChevronRight />
            </button>
          )}
          <div className="chat-header-info">
            <h2 className="chat-header-title">
              {selectedConvDetail.metadata.title}
            </h2>

            <div className="chat-header-meta">
              <span className="meta-item">
                ID:{" "}
                <span className="meta-item-strong">
                  {selectedConvDetail.metadata.id.substring(0, 8)}...
                </span>
              </span>
              <span className="meta-item">
                Format:{" "}
                <span
                  className={`conv-item-badge badge-${selectedConvDetail.metadata.file_type}`}
                >
                  {selectedConvDetail.metadata.file_type}
                </span>
              </span>
              <span className="meta-item">
                <IconDatabase /> Size:{" "}
                <span className="meta-item-strong">
                  {formatBytes(selectedConvDetail.metadata.size_bytes)}
                </span>
              </span>
              <span className="meta-item">
                Date:{" "}
                <span className="meta-item-strong">
                  {formatDate(selectedConvDetail.metadata.created_at)}
                </span>
              </span>
            </div>
          </div>
          <div className="chat-header-actions">
            <button className="btn-secondary" onClick={handleExportJson}>
              <IconExport /> {t("exportJson")}
            </button>
            <button
              className="btn-danger"
              onClick={() => deleteConversation(selectedConvDetail.metadata.id)}
            >
              <IconTrash /> {t("delete")}
            </button>
          </div>
        </div>

        {/* Chat timeline body */}
        <div className="chat-body-container">
          <div className="messages-list-wrapper">
            {selectedConvDetail.steps.length === 0 ? (
              <div className="empty-state" style={{ height: "100%" }}>
                <span className="empty-state-icon">🤖</span>
                <div>{t("noTextTranscriptLogs")}</div>
              </div>
            ) : (
              selectedConvDetail.steps.map((step: any, idx: number) => {
                const isUser =
                  step.source === "USER_EXPLICIT" || step.type === "USER_INPUT";
                const isSystem = step.source === "SYSTEM";
                const isModel = step.source === "MODEL";

                if (isSystem) {
                  const isExpanded = expandedSteps.has(idx);
                  return (
                    <div className="system-msg-row" key={idx}>
                      <div className="system-msg-card">
                        <div className="system-msg-header">
                          <span>
                            {t("systemContextStep", {
                              step: step.step_index ?? idx,
                            })}
                          </span>
                          <button
                            className="system-msg-toggle"
                            onClick={() => toggleStepExpanded(idx)}
                          >
                            {isExpanded ? t("collapse") : t("expandLogs")}
                          </button>
                        </div>
                        {isExpanded && (
                          <pre className="system-msg-content">{step.content}</pre>
                        )}
                      </div>
                    </div>
                  );
                }

                if (isModel && step.status === "ERROR" && step.content) {
                  return (
                    <div className="system-msg-row" key={idx}>
                      <div
                        className="system-msg-card"
                        style={{
                          borderColor: "var(--neon-pink)",
                          background: "rgba(255,0,127,0.03)",
                        }}
                      >
                        <div
                          className="system-msg-header"
                          style={{ color: "var(--neon-pink)" }}
                        >
                          <span>{t("stepErrorPlannerFailed")}</span>
                        </div>
                        <pre className="system-msg-content">{step.content}</pre>
                      </div>
                    </div>
                  );
                }

                if (!isUser && !isModel) return null;

                const avatar = isUser ? "👤" : "🤖";
                const name = isUser ? t("userRequest") : t("antigravityAgent");
                const time = step.created_at
                  ? formatDate(step.created_at).split(" ")[1]
                  : "";

                const hasToolCalls = step.tool_calls && step.tool_calls.length > 0;

                return (
                  <div
                    className={`msg-row ${isUser ? "user" : "model"}`}
                    key={idx}
                  >
                    <div className="msg-avatar">{avatar}</div>
                    <div className="msg-bubble">
                      <div className="msg-sender-info">
                        <span className="msg-sender-name">{name}</span>
                        {time && <span className="msg-time">{time}</span>}
                      </div>
                      <div className="msg-card">
                        {step.content && renderMarkdown(step.content)}

                        {hasToolCalls && (
                          <div className="tool-calls-container">
                            {step.tool_calls.map((tool: any, tIdx: number) => {
                              const toolKey = idx * 1000 + tIdx;
                              const isToolExpanded = expandedSteps.has(toolKey);
                              const isToolError = step.status === "ERROR";

                              return (
                                <div className="tool-call-box" key={tIdx}>
                                  <div
                                    className="tool-call-header"
                                    onClick={() => toggleStepExpanded(toolKey)}
                                  >
                                    <div className="tool-call-title-section">
                                      <span
                                        className="tool-call-icon"
                                        style={{ display: "flex", alignItems: "center" }}
                                      >
                                        {tool.name === "run_command" ? (
                                          <IconTerminal />
                                        ) : (
                                          <IconTool />
                                        )}
                                      </span>
                                      {t("toolCall")}
                                      <span className="tool-call-name">
                                        {tool.name}
                                      </span>
                                      {tool.args && tool.args.toolSummary && (
                                        <span className="tool-call-summary">
                                          ({tool.args.toolSummary.replace(/"/g, "")})
                                        </span>
                                      )}
                                    </div>
                                    <span
                                      className={`tool-call-status ${
                                        isToolError ? "status-error" : "status-success"
                                      }`}
                                    >
                                      {isToolError ? "Failed" : "Invoked"}
                                    </span>
                                  </div>

                                  {isToolExpanded && (
                                    <div className="tool-call-body">
                                      <div className="tool-code-section">
                                        <span className="tool-code-title">
                                          {t("argumentsJson")}
                                        </span>
                                        <pre className="tool-code-pre">
                                          {JSON.stringify(tool.args, null, 2)}
                                        </pre>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Right side panel: Artifacts */}
          <div className="artifacts-panel">
            <div className="artifacts-panel-header">
              📄{" "}
              {t("sessionArtifacts", {
                count: selectedConvDetail.artifacts.length,
              })}
            </div>
            {selectedConvDetail.artifacts.length === 0 ? (
              <div className="empty-state" style={{ marginTop: "30px" }}>
                {t("noArtifactsGenerated")}
              </div>
            ) : (
              <div className="artifacts-list">
                {selectedConvDetail.artifacts.map((art) => {
                  const isActive = activeArtifact?.name === art.name;
                  return (
                    <div
                      key={art.name}
                      className={`artifact-item ${isActive ? "active" : ""}`}
                      onClick={() => setActiveArtifact(isActive ? null : art)}
                    >
                      <span className="artifact-item-name" title={art.name}>
                        {art.name}
                      </span>
                      <span className="artifact-item-type">
                        {art.name.endsWith(".md")
                          ? t("markdownFile")
                          : t("configFile")}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Artifact Content Overlay panel */}
      {activeArtifact && (
        <div className="artifact-overlay-panel">
          <div
            className="chat-header"
            style={{ borderBottom: "1.5px solid var(--border-color)" }}
          >
            <div className="chat-header-info">
              <h3 className="chat-header-title">{activeArtifact.name}</h3>
              <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>
                {t("filePath", { path: activeArtifact.path })}
              </span>
            </div>
            <button
              className="modal-close-btn"
              onClick={() => setActiveArtifact(null)}
            >
              <IconClose />
            </button>
          </div>
          <div style={{ flex: 1, padding: "20px", overflowY: "auto" }}>
            {activeArtifact.name.endsWith(".md") ? (
              renderMarkdown(activeArtifact.content)
            ) : (
              <pre className="tool-code-pre" style={{ height: "100%" }}>
                {activeArtifact.content}
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
