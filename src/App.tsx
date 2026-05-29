import React, { useState, useEffect, useMemo, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { marked } from "marked";
import "./App.css";
import { translations, TranslationKey } from "./translations";

// Interface Definitions
interface Project {
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

interface ConversationMetadata {
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

interface ArtifactFile {
  name: string;
  path: string;
  content: string;
}

interface ConversationDetail {
  id: string;
  metadata: ConversationMetadata;
  steps: Array<any>;
  artifacts: Array<ArtifactFile>;
}

interface AuditStats {
  total_conversations: number;
  total_steps: number;
  total_tool_calls: number;
  total_errors: number;
  tool_frequency: Record<string, number>;
  conversations_by_project: Record<string, number>;
  errors_by_tool: Record<string, number>;
  average_steps_per_conversation: number;
}

interface SecurityPolicy {
  name: string;
  path: string;
  permission: string;
}

interface SystemInfo {
  disk: Array<{ Name: string; Used: number; Free: number }> | null;
  memory: { FreePhysicalMemory: number; TotalVisibleMemorySize: number } | null;
  processes: Array<{ ProcessName: string; CPU: number; WorkingSet: number }> | null;
  os: { Caption: string; Version: string; OSArchitecture: string } | null;
}

// Inline SVG Icons
const IconSearch = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
);
const IconTrash = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
);
const IconFolder = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
);
const IconChart = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
);
const IconClose = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
);
const IconDatabase = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path><path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3"></path></svg>
);
const IconRefresh = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
);
const IconExport = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
);
const IconTerminal = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>
);
const IconTool = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>
);
const IconPlus = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
);
const IconEdit = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4z"></path></svg>
);

const IconChevronLeft = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
);
const IconChevronRight = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
);


function App() {
  // Determine if this window is the admin console
  const [isAdminConsole, setIsAdminConsole] = useState(false);
  const [adminTab, setAdminTab] = useState<"system" | "audit" | "config" | "mcp">("system");

  // Collapsible sidebar state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Language State
  const [lang, setLang] = useState<"en" | "zh">(() => {
    return (localStorage.getItem("language") as "en" | "zh") || "en";
  });

  // Persist language choice
  useEffect(() => {
    localStorage.setItem("language", lang);
  }, [lang]);

  // Translation function
  const t = (key: TranslationKey, variables?: Record<string, string | number>) => {
    let text: string = translations[lang]?.[key] || translations.en[key] || String(key);
    if (variables) {
      Object.entries(variables).forEach(([k, v]) => {
        text = text.replace(`{${k}}`, String(v));
      });
    }
    return text;
  };


  // User Space Lists
  const [projects, setProjects] = useState<Project[]>([]);
  const [conversations, setConversations] = useState<ConversationMetadata[]>([]);
  const [auditStats, setAuditStats] = useState<AuditStats | null>(null);

  // Admin Space Lists
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [securityPolicies, setSecurityPolicies] = useState<SecurityPolicy[]>([]);
  const [adminConfigText, setAdminConfigText] = useState("");
  const [mcpConfigText, setMcpConfigText] = useState("");

  // Selections
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [selectedConvDetail, setSelectedConvDetail] = useState<ConversationDetail | null>(null);
  const [activeArtifact, setActiveArtifact] = useState<ArtifactFile | null>(null);
  const [batchSelectedIds, setBatchSelectedIds] = useState<Set<string>>(new Set());

  // Loading States
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [adminActionLoading, setAdminActionLoading] = useState(false);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState("");
  const [projectFilter, setProjectFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  // Modals
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showAuditView, setShowAuditView] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [isCreatingProject, setIsCreatingProject] = useState(false);

  // UI Interactive States
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Detect admin context & fetch initial data
  useEffect(() => {
    detectContext();
  }, []);

  const detectContext = async () => {
    try {
      const win = getCurrentWindow();
      if (win.label === "admin_console") {
        setIsAdminConsole(true);
      } else {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get("role") === "admin") {
          setIsAdminConsole(true);
        }
      }
    } catch (e) {
      console.warn("Failed to read window label, fallback to user space:", e);
    }
    loadData();
  };

  useEffect(() => {
    if (isAdminConsole) {
      loadAdminData();
    }
  }, [isAdminConsole, adminTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      const projs = await invoke<Project[]>("get_projects");
      const convs = await invoke<ConversationMetadata[]>("get_conversations");
      const stats = await invoke<AuditStats>("get_audit_stats");

      setProjects(projs);
      setConversations(convs);
      setAuditStats(stats);
    } catch (e) {
      console.error("Failed to load user space data:", e);
    } finally {
      setLoading(false);
    }
  };

  const loadAdminData = async () => {
    setLoading(true);
    try {
      if (adminTab === "system") {
        const info = await invoke<SystemInfo>("get_system_info");
        setSystemInfo(info);
      } else if (adminTab === "audit") {
        const policies = await invoke<SecurityPolicy[]>("get_security_audit");
        setSecurityPolicies(policies);
      } else if (adminTab === "config") {
        const config = await invoke<any>("get_admin_config");
        setAdminConfigText(JSON.stringify(config, null, 2));
      } else if (adminTab === "mcp") {
        const config = await invoke<any>("get_mcp_config");
        setMcpConfigText(JSON.stringify(config, null, 2));
      }
    } catch (e) {
      console.error("Failed to load admin console data:", e);
      alert(t("adminQueryError") + e);
    } finally {
      setLoading(false);
    }
  };

  // Auto-scroll chat detail
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selectedConvDetail]);

  // Project map for quick lookup
  const projectMap = useMemo(() => {
    const map = new Map<string, string>();
    projects.forEach((p) => map.set(p.id, p.name));
    return map;
  }, [projects]);

  // Filter conversations
  const filteredConversations = useMemo(() => {
    return conversations.filter((c) => {
      const matchesSearch =
        c.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.summary.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.id.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesProject =
        projectFilter === "all" ||
        (projectFilter === "unassociated" && !c.project_id) ||
        c.project_id === projectFilter;

      const matchesType = typeFilter === "all" || c.file_type === typeFilter;

      return matchesSearch && matchesProject && matchesType;
    });
  }, [conversations, searchTerm, projectFilter, typeFilter]);

  // Select conversation and load detail
  const selectConversation = async (id: string) => {
    if (selectedConvId === id) return;
    setSelectedConvId(id);
    setLoadingDetail(true);
    setActiveArtifact(null);
    setExpandedSteps(new Set([0])); // expand first step by default
    try {
      const detail = await invoke<ConversationDetail>("get_conversation_detail", { id });
      setSelectedConvDetail(detail);
    } catch (e) {
      console.error("Failed to fetch conversation details:", e);
      alert(t("errorLoadingConversation") + e);
    } finally {
      setLoadingDetail(false);
    }
  };

  // Delete single conversation
  const deleteConversation = async (id: string) => {
    if (!confirm(t("confirmDeleteConversation"))) return;
    try {
      await invoke("delete_conversation", { id });
      if (selectedConvId === id) {
        setSelectedConvId(null);
        setSelectedConvDetail(null);
      }
      setBatchSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      await loadData();
    } catch (e) {
      alert(t("failedDeleteConversation") + e);
    }
  };

  // Batch delete selected conversations
  const deleteConversationsBatch = async () => {
    const count = batchSelectedIds.size;
    if (count === 0) return;
    if (!confirm(t("confirmDeleteConversationsBatch", { count }))) return;

    try {
      setLoading(true);
      await invoke("delete_conversations_batch", { ids: Array.from(batchSelectedIds) });
      setBatchSelectedIds(new Set());
      setSelectedConvId(null);
      setSelectedConvDetail(null);
      await loadData();
    } catch (e) {
      alert(t("failedBatchDelete") + e);
      setLoading(false);
    }
  };

  // Select/Deselect All in batch
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const ids = filteredConversations.map((c) => c.id);
      setBatchSelectedIds(new Set(ids));
    } else {
      setBatchSelectedIds(new Set());
    }
  };

  // Save Project
  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProject) return;

    try {
      await invoke("save_project", { project: editingProject });
      setEditingProject(null);
      await loadData();
    } catch (e) {
      alert(t("failedSaveProject") + e);
    }
  };

  // Delete Project
  const handleDeleteProject = async (id: string) => {
    if (!confirm(t("confirmDeleteProject"))) return;
    try {
      await invoke("delete_project", { id });
      await loadData();
    } catch (e) {
      alert(t("failedDeleteProject") + e);
    }
  };

  // Admin Config Actions
  const handleApplyConfig = async () => {
    try {
      const json = JSON.parse(adminConfigText);
      setAdminActionLoading(true);
      await invoke("save_admin_config", { content: json });
      alert(t("configAppliedSuccess"));
    } catch (e) {
      alert(t("invalidJsonFormat") + e);
    } finally {
      setAdminActionLoading(false);
    }
  };

  const handleApplyMcpConfig = async () => {
    try {
      const json = JSON.parse(mcpConfigText);
      setAdminActionLoading(true);
      await invoke("save_mcp_config", { content: json });
      alert(t("mcpAppliedSuccess"));
    } catch (e) {
      alert(t("invalidJsonFormat") + e);
    } finally {
      setAdminActionLoading(false);
    }
  };

  // Trigger project edit
  const startEditProject = (proj: Project) => {
    setEditingProject({ ...proj });
    setIsCreatingProject(false);
  };

  // Trigger project create
  const startCreateProject = () => {
    const newId = crypto.randomUUID();
    setEditingProject({
      id: newId,
      name: "",
      project_resources: {
        resources: [
          {
            git_folder: {
              folder_uri: "file:///",
              allow_write: true,
            },
          },
        ],
      },
    });
    setIsCreatingProject(true);
  };

  // Toggle step expanded
  const toggleStepExpanded = (idx: number) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  };

  // Format helpers
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

  const handleExportJson = () => {
    if (!selectedConvDetail) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(selectedConvDetail, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `conversation_${selectedConvDetail.id}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const renderMarkdown = (mdText: string) => {
    try {
      const parsed = marked.parse(mdText) as string;
      return <div className="markdown-body" dangerouslySetInnerHTML={{ __html: parsed }} />;
    } catch (e) {
      return <div style={{ whiteSpace: "pre-wrap" }}>{mdText}</div>;
    }
  };

  /* ================= ADMIN CONSOLE WINDOW LAYOUT ================= */
  if (isAdminConsole) {
    return (
      <div className="app-container">
        {/* Sidebar Nav */}
        <aside className={`sidebar ${sidebarCollapsed ? "collapsed" : ""}`} style={sidebarCollapsed ? { width: 0, minWidth: 0, borderRight: "none" } : { width: "240px", minWidth: "240px" }}>
          <div className="sidebar-header">
            <div className="brand-section" style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span className="brand-logo">⚡</span>
                <h1 className="brand-name" style={{ fontSize: "14px" }}>{t("adminPanel")}</h1>
              </div>
              <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                <button
                  className="toggle-sidebar-btn"
                  style={{ width: "auto", padding: "0 8px", fontSize: "11px", height: "28px" }}
                  onClick={() => setLang(lang === "en" ? "zh" : "en")}
                  title={lang === "en" ? "切换为中文" : "Switch to English"}
                >
                  🌐 {lang === "en" ? "ZH" : "EN"}
                </button>
                <button className="toggle-sidebar-btn" style={{ width: "28px", height: "28px" }} onClick={() => setSidebarCollapsed(true)} title="Collapse Sidebar">
                  <IconChevronLeft />
                </button>
              </div>
            </div>
          </div>

          <div className="conversation-list-container" style={{ padding: "10px" }}>
            <button
              className={`sidebar-btn ${adminTab === "system" ? "active" : ""}`}
              onClick={() => setAdminTab("system")}
              style={{ width: "100%", justifyContent: "flex-start", marginBottom: "8px", background: adminTab === "system" ? "rgba(0, 242, 254, 0.08)" : "" }}
            >
              📊 {t("systemHealth")}
            </button>
            <button
              className={`sidebar-btn ${adminTab === "audit" ? "active" : ""}`}
              onClick={() => setAdminTab("audit")}
              style={{ width: "100%", justifyContent: "flex-start", marginBottom: "8px", background: adminTab === "audit" ? "rgba(0, 242, 254, 0.08)" : "" }}
            >
              🛡️ {t("securityPolicies")}
            </button>
            <button
              className={`sidebar-btn ${adminTab === "config" ? "active" : ""}`}
              onClick={() => setAdminTab("config")}
              style={{ width: "100%", justifyContent: "flex-start", marginBottom: "8px", background: adminTab === "config" ? "rgba(0, 242, 254, 0.08)" : "" }}
            >
              ⚙️ {t("systemConfigJson")}
            </button>
            <button
              className={`sidebar-btn ${adminTab === "mcp" ? "active" : ""}`}
              onClick={() => setAdminTab("mcp")}
              style={{ width: "100%", justifyContent: "flex-start", marginBottom: "8px", background: adminTab === "mcp" ? "rgba(0, 242, 254, 0.08)" : "" }}
            >
              🔌 {t("mcpServers")}
            </button>
          </div>
          <div style={{ padding: "15px", borderTop: "1px solid var(--border-color)", textAlign: "center", fontSize: "10px", color: "var(--text-muted)" }}>
            {t("rootOperatorContext")}
          </div>
        </aside>

        {/* Content Pane */}
        <main className="main-content" style={{ padding: "40px", overflowY: "auto" }}>
          <div className="audit-header" style={{ marginBottom: "30px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              {sidebarCollapsed && (
                <button className="toggle-sidebar-btn" onClick={() => setSidebarCollapsed(false)} title="Show Sidebar">
                  <IconChevronRight />
                </button>
              )}
              <h2 className="audit-title">
                {adminTab === "system" && t("liveSystemHealthMonitor")}
                {adminTab === "audit" && t("permissionsAuditSecurityPolicies")}
                {adminTab === "config" && t("systemConfigEditor")}
                {adminTab === "mcp" && t("mcpServersConnections")}
              </h2>
            </div>
            <button className="btn-primary" onClick={loadAdminData}>
              <IconRefresh /> {t("refreshInfo")}
            </button>
          </div>


          {loading ? (
            <div className="loading-wrapper">
              <div className="spinner"></div>
              <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>{t("connectingToDaemon")}</div>
            </div>
          ) : (
            <>
              {/* Tab 1: System Health */}
              {adminTab === "system" && systemInfo && (
                <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                  {/* OS & Memory Cards */}
                  <div className="admin-flex-row">
                    <div className="audit-stat-card">

                      <span className="audit-stat-label">{t("operatingSystem")}</span>
                      <span className="audit-stat-value" style={{ fontSize: "18px", marginTop: "8px" }}>
                        {systemInfo.os?.Caption || "Microsoft Windows"}
                      </span>
                      <span style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
                        Kernel: {systemInfo.os?.Version || "N/A"} ({systemInfo.os?.OSArchitecture || "64-bit"})
                      </span>
                    </div>

                    <div className="audit-stat-card purple">
                      <span className="audit-stat-label">{t("physicalMemoryUsage")}</span>
                      {systemInfo.memory ? (() => {
                        const total = systemInfo.memory.TotalVisibleMemorySize;
                        const free = systemInfo.memory.FreePhysicalMemory;
                        const used = total - free;
                        const pct = (used / total) * 100;
                        return (
                          <>
                            <span className="audit-stat-value" style={{ fontSize: "20px", marginTop: "8px" }}>
                              {pct.toFixed(1)}% <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: "500" }}>({(used / 1024 / 1024).toFixed(1)} GB / {(total / 1024 / 1024).toFixed(1)} GB)</span>
                            </span>
                            <div style={{ width: "100%", height: "6px", background: "#131836", borderRadius: "3px", marginTop: "10px", overflow: "hidden" }}>
                              <div style={{ width: `${pct}%`, height: "100%", background: "var(--neon-purple)", borderRadius: "3px", boxShadow: "0 0 8px var(--neon-purple)" }}></div>
                            </div>
                          </>
                        );
                      })() : (
                        <span className="audit-stat-value">N/A</span>
                      )}
                    </div>
                  </div>

                  {/* Disk and Processes Row */}
                  <div className="charts-row">
                    {/* Disks */}
                    <div className="chart-card" style={{ height: "auto" }}>
                      <h3 className="chart-card-title">{t("storagePartitionLayout")}</h3>
                      <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "10px" }}>
                        {systemInfo.disk ? systemInfo.disk.map((d) => {
                          const pct = (d.Used / (d.Used + d.Free)) * 100;
                          return (
                            <div key={d.Name} style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
                                <span style={{ fontWeight: "700" }}>Partition {d.Name}:</span>
                                <span style={{ color: "var(--text-muted)" }}>
                                  {formatBytes(d.Used)} used / {formatBytes(d.Free)} free
                                </span>
                              </div>
                              <div style={{ width: "100%", height: "8px", background: "#03050a", borderRadius: "4px", overflow: "hidden" }}>
                                <div style={{ width: `${pct}%`, height: "100%", background: "var(--neon-cyan)", borderRadius: "4px", boxShadow: "var(--shadow-neon)" }}></div>
                              </div>
                            </div>
                          );
                        }) : (
                          <div className="empty-state">{t("noStatisticsLoaded")}</div>
                        )}
                      </div>
                    </div>

                    {/* Processes */}
                    <div className="chart-card" style={{ height: "auto" }}>
                      <h3 className="chart-card-title">{t("topHostProcessThreads")}</h3>
                      <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "5px" }}>
                        {systemInfo.processes ? systemInfo.processes.map((p, idx) => (
                          <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", borderBottom: "0.5px solid rgba(255,255,255,0.02)", paddingBottom: "6px" }}>
                            <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-main)" }}>
                              {p.ProcessName}
                            </span>
                            <div style={{ display: "flex", gap: "15px" }}>
                              <span style={{ color: "var(--neon-pink)" }}>CPU: {p.CPU.toFixed(1)}s</span>
                              <span style={{ color: "var(--text-muted)" }}>RAM: {formatBytes(p.WorkingSet)}</span>
                            </div>
                          </div>
                        )) : (
                          <div className="empty-state">{t("noStatisticsLoaded")}</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: Security Policies */}
              {adminTab === "audit" && (
                <div className="chart-card" style={{ height: "auto" }}>
                  <h3 className="chart-card-title">{t("sandboxBoundaries")}</h3>
                  <div style={{ overflowX: "auto", marginTop: "10px" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", textAlign: "left" }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid var(--border-color)", color: "var(--text-muted)" }}>
                          <th style={{ padding: "12px" }}>{t("resourceNamespace")}</th>
                          <th style={{ padding: "12px" }}>{t("localDiskPathCommandPrefix")}</th>
                          <th style={{ padding: "12px", textAlign: "center" }}>{t("sandboxSecurityState")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {securityPolicies.map((pol, idx) => {
                          const isDenied = pol.permission.includes("Denied");
                          const isAsk = pol.permission.includes("Ask");
                          const labelColor = isDenied
                            ? "var(--neon-pink)"
                            : isAsk
                            ? "var(--neon-purple)"
                            : "#00ff7f";
                          const labelBg = isDenied
                            ? "rgba(255, 0, 127, 0.1)"
                            : isAsk
                            ? "rgba(155, 81, 224, 0.1)"
                            : "rgba(0, 255, 127, 0.1)";

                          return (
                            <tr key={idx} style={{ borderBottom: "1.5px solid rgba(255,255,255,0.02)" }}>
                              <td style={{ padding: "12px", fontWeight: "700" }}>{pol.name}</td>
                              <td style={{ padding: "12px", fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>{pol.path}</td>
                              <td style={{ padding: "12px", textAlign: "center" }}>
                                <span style={{
                                  background: labelBg,
                                  color: labelColor,
                                  border: `0.5px solid ${labelColor}`,
                                  padding: "3px 8px",
                                  borderRadius: "4px",
                                  fontSize: "10px",
                                  fontWeight: "800",
                                  textTransform: "uppercase"
                                }}>
                                  {pol.permission}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Tab 3: config.json Editor */}
              {adminTab === "config" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
                  <div className="form-group">
                    <label className="form-label">{t("configJsonPayload")}</label>
                    <textarea
                      className="form-input"
                      style={{ height: "350px", fontFamily: "var(--font-mono)", fontSize: "12px", lineHeight: "1.5", resize: "none" }}
                      value={adminConfigText}
                      onChange={(e) => setAdminConfigText(e.target.value)}
                    />
                  </div>
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button className="btn-primary" onClick={handleApplyConfig} disabled={adminActionLoading}>
                      {adminActionLoading ? t("writingChanges") : t("applyConfigSettings")}
                    </button>
                  </div>
                </div>
              )}

              {/* Tab 4: mcp_config.json Editor */}
              {adminTab === "mcp" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
                  <div className="form-group">
                    <label className="form-label">{t("mcpProtocolConfigPayload")}</label>
                    <textarea
                      className="form-input"
                      style={{ height: "350px", fontFamily: "var(--font-mono)", fontSize: "12px", lineHeight: "1.5", resize: "none" }}
                      value={mcpConfigText}
                      onChange={(e) => setMcpConfigText(e.target.value)}
                    />
                  </div>
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button className="btn-primary" onClick={handleApplyMcpConfig} disabled={adminActionLoading}>
                      {adminActionLoading ? t("writingChanges") : t("applyMcpConfigurations")}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    );
  }

  /* ================= USER SPACE WINDOW LAYOUT ================= */
  return (
    <div className="app-container">
      {/* 1. SIDEBAR */}
      <aside className={`sidebar ${sidebarCollapsed ? "collapsed" : ""}`}>
        <div className="sidebar-header">
          <div className="brand-section" style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span className="brand-logo">🌌</span>
              <h1 className="brand-name">Antigravity</h1>
            </div>
            <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
              <button
                className="toggle-sidebar-btn"
                style={{ width: "auto", padding: "0 8px", fontSize: "11px", height: "28px" }}
                onClick={() => setLang(lang === "en" ? "zh" : "en")}
                title={lang === "en" ? "切换为中文" : "Switch to English"}
              >
                🌐 {lang === "en" ? "ZH" : "EN"}
              </button>
              <button className="toggle-sidebar-btn" style={{ width: "28px", height: "28px" }} onClick={() => setSidebarCollapsed(true)} title="Collapse Sidebar">
                <IconChevronLeft />
              </button>
            </div>
          </div>

          <div className="sidebar-controls" style={{ flexWrap: "wrap", gap: "6px" }}>
            <button className="sidebar-btn" onClick={() => setShowProjectModal(true)}>
              <IconFolder /> {t("projects")}
            </button>
            <button className="sidebar-btn" onClick={() => setShowAuditView(!showAuditView)}>
              <IconChart /> {showAuditView ? t("sessions") : t("audit")}
            </button>
            <button
              className="sidebar-btn"
              onClick={async () => {
                try {
                  await invoke("open_admin_window");
                } catch (e) {
                  alert(t("failedSpawnAdmin") + e);
                }
              }}
              style={{ width: "100%", borderColor: "var(--neon-pink)", color: "var(--neon-pink)" }}
            >
              ⚡ {t("adminPanel")}
            </button>
          </div>
        </div>

        {/* Filters Panel */}
        <div className="search-filter-section">
          <div className="search-input-wrapper">
            <span style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", display: "flex" }}>
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
            <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{t("initializingScanner")}</div>
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
              const pName = c.project_id ? projectMap.get(c.project_id) || "Binding Project" : null;

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
                      <span>{pName ? `📁 ${pName}` : `📡 ${t("unassociated")}`}</span>
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

      {/* 2. MAIN WORKSPACE CONTENT */}
      <main className="main-content">
        {showAuditView ? (
          /* ================= AUDIT STATISTICS VIEW ================= */
          <div className="audit-container">
            <div className="audit-header">
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                {sidebarCollapsed && (
                  <button className="toggle-sidebar-btn" onClick={() => setSidebarCollapsed(false)} title="Show Sidebar">
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
                        {t("successPercent", { pct: auditStats.total_steps > 0
                          ? ((1 - auditStats.total_errors / auditStats.total_steps) * 100).toFixed(1)
                          : "100" })}
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
                                    {toolName.length > 15 ? `${toolName.substring(0, 12)}...` : toolName}
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
                                    <animate attributeName="width" from="0" to={barWidth} dur="0.8s" fill="freeze" />
                                  </rect>
                                  <text x={135 + barWidth} y={y + 15} fill="var(--text-glow)" fontSize="11" fontWeight="700">
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
                                  const name = projectMap.get(projId) || (projId === "Unassociated" ? t("unassociated") : "Unknown");

                                  return (
                                    <g key={projId}>
                                      <text x={x + 18} y={y - 8} fill="var(--text-glow)" fontSize="11" fontWeight="700" textAnchor="middle">
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
                                        <animate attributeName="height" from="0" to={barHeight} dur="0.8s" fill="freeze" />
                                        <animate attributeName="y" from="180" to={y} dur="0.8s" fill="freeze" />
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
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", textAlign: "left" }}>
                        <thead>
                          <tr style={{ borderBottom: "1px solid var(--border-color)", color: "var(--text-muted)" }}>
                            <th style={{ padding: "10px" }}>{t("taskModuleToolName")}</th>
                            <th style={{ padding: "10px" }}>{t("failureCount")}</th>
                            <th style={{ padding: "10px" }}>{t("securityLevel")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(auditStats.errors_by_tool).map(([toolName, val]) => (
                            <tr key={toolName} style={{ borderBottom: "1.5px solid rgba(255,255,255,0.02)" }}>
                              <td style={{ padding: "10px", fontFamily: "var(--font-mono)", color: "var(--neon-cyan)" }}>
                                {toolName}
                              </td>
                              <td style={{ padding: "10px", color: "var(--neon-pink)", fontWeight: "700" }}>
                                {val}
                              </td>
                              <td style={{ padding: "10px" }}>
                                <span style={{
                                  background: "rgba(255, 0, 127, 0.1)",
                                  color: "var(--neon-pink)",
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  fontSize: "9px",
                                  fontWeight: "800",
                                  border: "0.5px solid var(--neon-pink)"
                                }}>
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
        ) : loadingDetail ? (
          <div className="loading-wrapper">
            <div className="spinner"></div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>{t("decryptingTimeline")}</div>
          </div>
        ) : selectedConvDetail ? (
          /* ================= CHAT LOG DETAIL VIEW ================= */
          <div style={{ display: "flex", flex: 1, height: "100%", overflow: "hidden", minWidth: 0 }}>
            {/* Main timeline thread */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", minWidth: 0 }}>
              {/* Header */}
              <div className="chat-header">
                {sidebarCollapsed && (
                  <button className="toggle-sidebar-btn" onClick={() => setSidebarCollapsed(false)} style={{ marginRight: "12px" }} title="Show Sidebar">
                    <IconChevronRight />
                  </button>
                )}
                <div className="chat-header-info">
                  <h2 className="chat-header-title">{selectedConvDetail.metadata.title}</h2>

                  <div className="chat-header-meta">
                    <span className="meta-item">
                      ID: <span className="meta-item-strong">{selectedConvDetail.metadata.id.substring(0, 8)}...</span>
                    </span>
                    <span className="meta-item">
                      Format: <span className={`conv-item-badge badge-${selectedConvDetail.metadata.file_type}`}>{selectedConvDetail.metadata.file_type}</span>
                    </span>
                    <span className="meta-item">
                      <IconDatabase /> Size: <span className="meta-item-strong">{formatBytes(selectedConvDetail.metadata.size_bytes)}</span>
                    </span>
                    <span className="meta-item">
                      Date: <span className="meta-item-strong">{formatDate(selectedConvDetail.metadata.created_at)}</span>
                    </span>
                  </div>
                </div>
                <div className="chat-header-actions">
                  <button className="btn-secondary" onClick={handleExportJson}>
                    <IconExport /> {t("exportJson")}
                  </button>
                  <button className="btn-danger" onClick={() => deleteConversation(selectedConvDetail.metadata.id)}>
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
                      const isUser = step.source === "USER_EXPLICIT" || step.type === "USER_INPUT";
                      const isSystem = step.source === "SYSTEM";
                      const isModel = step.source === "MODEL";

                      if (isSystem) {
                        const isExpanded = expandedSteps.has(idx);
                        return (
                          <div className="system-msg-row" key={idx}>
                            <div className="system-msg-card">
                              <div className="system-msg-header">
                                <span>{t("systemContextStep", { step: step.step_index ?? idx })}</span>
                                <button className="system-msg-toggle" onClick={() => toggleStepExpanded(idx)}>
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
                            <div className="system-msg-card" style={{
                              borderColor: "var(--neon-pink)",
                              background: "rgba(255,0,127,0.03)"
                            }}>
                              <div className="system-msg-header" style={{ color: "var(--neon-pink)" }}>
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
                      const time = step.created_at ? formatDate(step.created_at).split(" ")[1] : "";

                      const hasToolCalls = step.tool_calls && step.tool_calls.length > 0;

                      return (
                        <div className={`msg-row ${isUser ? "user" : "model"}`} key={idx}>
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
                                        <div className="tool-call-header" onClick={() => toggleStepExpanded(toolKey)}>
                                          <div className="tool-call-title-section">
                                            <span className="tool-call-icon" style={{ display: "flex", alignItems: "center" }}>
                                              {tool.name === "run_command" ? <IconTerminal /> : <IconTool />}
                                            </span>
                                            {t("toolCall")}
                                            <span className="tool-call-name">{tool.name}</span>
                                            {tool.args && tool.args.toolSummary && (
                                              <span className="tool-call-summary">
                                                ({tool.args.toolSummary.replace(/"/g, "")})
                                              </span>
                                            )}
                                          </div>
                                          <span className={`tool-call-status ${isToolError ? "status-error" : "status-success"}`}>
                                            {isToolError ? "Failed" : "Invoked"}
                                          </span>
                                        </div>

                                        {isToolExpanded && (
                                          <div className="tool-call-body">
                                            <div className="tool-code-section">
                                              <span className="tool-code-title">{t("argumentsJson")}</span>
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
                    📄 {t("sessionArtifacts", { count: selectedConvDetail.artifacts.length })}
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
                              {art.name.endsWith(".md") ? t("markdownFile") : t("configFile")}
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

                <div className="chat-header" style={{ borderBottom: "1.5px solid var(--border-color)" }}>
                  <div className="chat-header-info">
                    <h3 className="chat-header-title">{activeArtifact.name}</h3>
                    <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>
                      {t("filePath", { path: activeArtifact.path })}
                    </span>
                  </div>
                  <button className="modal-close-btn" onClick={() => setActiveArtifact(null)}>
                    <IconClose />
                  </button>
                </div>
                <div style={{ flex: 1, padding: "20px", overflowY: "auto" }}>
                  {activeArtifact.name.endsWith(".md") ? (
                    renderMarkdown(activeArtifact.content)
                  ) : (
                    <pre className="tool-code-pre" style={{ height: "100%" }}>{activeArtifact.content}</pre>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ================= WELCOME SCREEN DASHBOARD ================= */
          <div className="welcome-panel" style={{ position: "relative" }}>
            {sidebarCollapsed && (
              <button className="toggle-sidebar-btn floating-toggle-btn" onClick={() => setSidebarCollapsed(false)} title="Show Sidebar">
                <IconChevronRight />
              </button>
            )}
            <span className="welcome-logo">🧠</span>
            <h2 className="welcome-title">{t("welcomeTitle")}</h2>

            <p className="welcome-subtitle">
              {t("welcomeSubtitle")}
            </p>

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
        )}
      </main>

      {/* 3. PROJECTS MANAGER MODAL */}
      {showProjectModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-header-title">{t("projectsDirectoryConfig")}</h3>
              <button className="modal-close-btn" onClick={() => {
                setShowProjectModal(false);
                setEditingProject(null);
              }}>
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
                      onChange={(e) => setEditingProject({ ...editingProject, name: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">{t("gitWorkspaceFolderUri")}</label>
                    <input
                      type="text"
                      className="form-input"
                      required
                      placeholder="file:///c:/path/to/folder"
                      value={editingProject.project_resources.resources[0].git_folder.folder_uri}
                      onChange={(e) => {
                        const updated = { ...editingProject };
                        updated.project_resources.resources[0].git_folder.folder_uri = e.target.value;
                        setEditingProject(updated);
                      }}
                    />
                  </div>
                  <div className="form-checkbox-row">
                    <input
                      type="checkbox"
                      id="allowWriteCheckbox"
                      className="checkbox-custom"
                      checked={editingProject.project_resources.resources[0].git_folder.allow_write}
                      onChange={(e) => {
                        const updated = { ...editingProject };
                        updated.project_resources.resources[0].git_folder.allow_write = e.target.checked;
                        setEditingProject(updated);
                      }}
                    />
                    <label htmlFor="allowWriteCheckbox" className="form-checkbox-label">
                      {t("enableWriteAccess")}
                    </label>
                  </div>
                  <div style={{ marginTop: "24px", display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                    <button type="button" className="btn-secondary" onClick={() => setEditingProject(null)}>
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
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                      {t("linkingPhysicalFolders")}
                    </span>
                    <button className="btn-primary" style={{ padding: "6px 12px" }} onClick={startCreateProject}>
                      <IconPlus /> {t("addProject")}
                    </button>
                  </div>
                  
                  {projects.length === 0 ? (
                    <div className="empty-state">{t("noProjectsLoaded")}</div>
                  ) : (
                    <div className="project-list-grid">
                      {projects.map((p) => {
                        const uri = p.project_resources.resources[0]?.git_folder.folder_uri || "No folder";
                        return (
                          <div className="project-row-card" key={p.id}>
                            <div className="project-card-info">
                              <span className="project-card-name">{p.name}</span>
                              <span className="project-card-path">{decodeURIComponent(uri)}</span>
                            </div>
                            <div className="project-card-actions">
                              <button className="sidebar-btn" style={{ padding: "4px 8px" }} onClick={() => startEditProject(p)}>
                                <IconEdit />
                              </button>
                              <button className="btn-danger-sm" style={{ padding: "4px 8px" }} onClick={() => handleDeleteProject(p.id)}>
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
              <button className="btn-secondary" onClick={() => {
                setShowProjectModal(false);
                setEditingProject(null);
              }}>
                {t("closeManager")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
