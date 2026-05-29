import React, { useState, useEffect, useMemo, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";

import "./App.css";
import { translations, TranslationKey } from "./translations";
import {
  Project,
  ConversationMetadata,
  ConversationDetail,
  AuditStats,
  ArtifactFile,
} from "./types";

import { Sidebar } from "./components/Sidebar";
import { WelcomePanel } from "./components/WelcomePanel";
import { AuditView } from "./components/AuditView";
import { DetailView } from "./components/DetailView";
import { ProjectsModal } from "./components/ProjectsModal";

function App() {
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
  const t = (
    key: TranslationKey,
    variables?: Record<string, string | number>
  ) => {
    let text: string =
      translations[lang]?.[key] || translations.en[key] || String(key);
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

  // Selections
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [selectedConvDetail, setSelectedConvDetail] =
    useState<ConversationDetail | null>(null);
  const [activeArtifact, setActiveArtifact] = useState<ArtifactFile | null>(
    null
  );
  const [batchSelectedIds, setBatchSelectedIds] = useState<Set<string>>(
    new Set()
  );

  // Loading States
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);

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

  // Fetch initial data
  useEffect(() => {
    loadData();
  }, []);

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
      const detail = await invoke<ConversationDetail>("get_conversation_detail", {
        id,
      });
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
      await invoke("delete_conversations_batch", {
        ids: Array.from(batchSelectedIds),
      });
      setBatchSelectedIds(new Set());
      setSelectedConvId(null);
      setSelectedConvDetail(null);
      await loadData();
    } catch (e) {
      alert(t("failedBatchDelete") + e);
      setLoading(false);
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

  // Batch Delete Projects
  const handleDeleteProjectsBatch = async (ids: string[]) => {
    const count = ids.length;
    if (count === 0) return;
    if (!confirm(t("confirmDeleteProjectsBatch", { count }))) return;
    try {
      await invoke("delete_projects_batch", { ids });
      await loadData();
    } catch (e) {
      alert(t("failedDeleteProjectsBatch") + e);
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

  const handleExportJson = () => {
    if (!selectedConvDetail) return;
    const dataStr =
      "data:text/json;charset=utf-8," +
      encodeURIComponent(JSON.stringify(selectedConvDetail, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute(
      "download",
      `conversation_${selectedConvDetail.id}.json`
    );
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="app-container">
      {/* 1. SIDEBAR */}
      <Sidebar
        sidebarCollapsed={sidebarCollapsed}
        setSidebarCollapsed={setSidebarCollapsed}
        lang={lang}
        setLang={setLang}
        t={t}
        projects={projects}
        conversations={conversations}
        filteredConversations={filteredConversations}
        selectedConvId={selectedConvId}
        selectConversation={selectConversation}
        batchSelectedIds={batchSelectedIds}
        setBatchSelectedIds={setBatchSelectedIds}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        projectFilter={projectFilter}
        setProjectFilter={setProjectFilter}
        typeFilter={typeFilter}
        setTypeFilter={setTypeFilter}
        loading={loading}
        projectMap={projectMap}
        setShowProjectModal={setShowProjectModal}
        showAuditView={showAuditView}
        setShowAuditView={setShowAuditView}
        deleteConversationsBatch={deleteConversationsBatch}
      />

      {/* 2. MAIN WORKSPACE CONTENT */}
      <main className="main-content">
        {showAuditView ? (
          /* ================= AUDIT STATISTICS VIEW ================= */
          <AuditView
            sidebarCollapsed={sidebarCollapsed}
            setSidebarCollapsed={setSidebarCollapsed}
            t={t}
            auditStats={auditStats}
            loadData={loadData}
            projectMap={projectMap}
          />
        ) : loadingDetail ? (
          <div className="loading-wrapper">
            <div className="spinner"></div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              {t("decryptingTimeline")}
            </div>
          </div>
        ) : selectedConvDetail ? (
          /* ================= CHAT LOG DETAIL VIEW ================= */
          <DetailView
            sidebarCollapsed={sidebarCollapsed}
            setSidebarCollapsed={setSidebarCollapsed}
            t={t}
            selectedConvDetail={selectedConvDetail}
            deleteConversation={deleteConversation}
            handleExportJson={handleExportJson}
            activeArtifact={activeArtifact}
            setActiveArtifact={setActiveArtifact}
            expandedSteps={expandedSteps}
            toggleStepExpanded={toggleStepExpanded}
            messagesEndRef={messagesEndRef}
          />
        ) : (
          /* ================= WELCOME SCREEN DASHBOARD ================= */
          <WelcomePanel
            sidebarCollapsed={sidebarCollapsed}
            setSidebarCollapsed={setSidebarCollapsed}
            t={t}
            projects={projects}
            conversations={conversations}
            auditStats={auditStats}
          />
        )}
      </main>

      {/* 3. PROJECTS MANAGER MODAL */}
      {showProjectModal && (
        <ProjectsModal
          t={t}
          projects={projects}
          editingProject={editingProject}
          setEditingProject={setEditingProject}
          isCreatingProject={isCreatingProject}
          setShowProjectModal={setShowProjectModal}
          handleSaveProject={handleSaveProject}
          handleDeleteProject={handleDeleteProject}
          handleDeleteProjectsBatch={handleDeleteProjectsBatch}
          startEditProject={startEditProject}
          startCreateProject={startCreateProject}
        />
      )}
    </div>
  );
}

export default App;
