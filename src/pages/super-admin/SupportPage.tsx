import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { supportApi, type SupportTicket } from "../../api/support";
import { useSaSupport } from "../../hooks/queries/useSaQueries";
import { extractError } from "../../utils/errorUtils";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import TicketConversationModal from "../../components/support/TicketConversationModal";
import {
  TicketCheck,
  AlertCircle,
  Clock,
  CheckCircle2,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  BookOpen,
  FileText,
  Users,
  Shield,
  BarChart3,
  ChevronDown,
  HelpCircle,
  Layers,
  Settings,
} from "lucide-react";

// ── badge configs ──────────────────────────────────────────────────────────────

const STATUS_META: Record<
  string,
  { label: string; bg: string; color: string }
> = {
  PENDING: { label: "Open", bg: "#fef9c3", color: "#854d0e" },
  IN_PROGRESS: { label: "In Progress", bg: "#dbeafe", color: "#1d4ed8" },
  RESOLVED: { label: "Resolved", bg: "#dcfce7", color: "#15803d" },
  CLOSED: { label: "Closed", bg: "#f1f5f9", color: "#475569" },
};

const PRIORITY_META: Record<
  string,
  { label: string; bg: string; color: string }
> = {
  LOW: { label: "Low", bg: "#f0fdf4", color: "#15803d" },
  MEDIUM: { label: "Medium", bg: "#fef9c3", color: "#854d0e" },
  HIGH: { label: "High", bg: "#fff7ed", color: "#c2410c" },
  CRITICAL: { label: "Critical", bg: "#fef2f2", color: "#b91c1c" },
};

const CATEGORIES = [
  "Attendance Issue",
  "Employee Management",
  "Leave Management",
  "Payroll",
  "Documents & Policies",
  "Access & Permissions",
  "Technical Issue",
  "Others",
];

const KNOWLEDGE_BASE = [
  {
    title: "How to correct attendance records?",
    category: "Attendance",
    views: "844 views",
    icon: Clock,
    color: "#f59e0b",
  },
  {
    title: "How to update leave policy settings?",
    category: "Leave Management",
    views: "1.2k views",
    icon: FileText,
    color: "#10b981",
  },
  {
    title: "Understanding payroll recalculation process",
    category: "Payroll",
    views: "530 views",
    icon: BarChart3,
    color: "#6366f1",
  },
  {
    title: "Managing employee roles and permissions",
    category: "Access & Permissions",
    views: "920 views",
    icon: Shield,
    color: "#3b82f6",
  },
  {
    title: "Bulk employee data import guide",
    category: "Employee Management",
    views: "234 views",
    icon: Users,
    color: "#ec4899",
  },
  {
    title: "Document upload and policy management",
    category: "Documents & Policies",
    views: "156 views",
    icon: Layers,
    color: "#0ea5e9",
  },
];

const avatarColors = [
  { bg: "#eef2ff", color: "#6366f1" },
  { bg: "#f5f3ff", color: "#8b5cf6" },
  { bg: "#f0f9ff", color: "#0ea5e9" },
  { bg: "#f0fdf4", color: "#10b981" },
  { bg: "#fffbeb", color: "#f59e0b" },
  { bg: "#fdf4ff", color: "#ec4899" },
];
const getAv = (name?: string) =>
  avatarColors[(name ?? "S").charCodeAt(0) % avatarColors.length]!;
const initials = (name?: string) =>
  (name ?? "Support")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
// ── New Ticket Modal ───────────────────────────────────────────────────────────

function NewTicketModal({
  companies,
  onClose,
  onCreated,
}: {
  companies: { id: string; name: string }[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    category: "",
    subject: "",
    description: "",
    priority: "MEDIUM",
    companyId: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.category || !form.subject || !form.description) {
      setError("Category, Subject and Description are required.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await supportApi.create(form);
      onCreated();
      onClose();
    } catch (err) {
      setError(extractError(err, "Failed to create ticket"));
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "9px 12px",
    border: "1.5px solid #e2e8f0",
    borderRadius: "8px",
    fontSize: "13px",
    outline: "none",
    fontFamily: "Inter, sans-serif",
    color: "#0f172a",
    backgroundColor: "white",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: "12px",
    fontWeight: 600,
    color: "#374151",
    marginBottom: "5px",
    display: "block",
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "24px",
      }}
    >
      <div
        style={{
          backgroundColor: "white",
          borderRadius: "16px",
          width: "100%",
          maxWidth: "500px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "20px 24px",
            borderBottom: "1px solid #f1f5f9",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                backgroundColor: "#f0fdf4",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Plus size={16} color="#0d7470" />
            </div>
            <div>
              <h2
                style={{ fontSize: "15px", fontWeight: 700, color: "#0f172a" }}
              >
                New Ticket
              </h2>
              <p style={{ fontSize: "11px", color: "#64748b" }}>
                Report an issue or request support
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#94a3b8",
            }}
          >
            <X size={18} />
          </button>
        </div>

        <div
          style={{
            padding: "22px 24px",
            display: "flex",
            flexDirection: "column",
            gap: "14px",
          }}
        >
          {error && (
            <div
              style={{
                padding: "10px 14px",
                borderRadius: "8px",
                backgroundColor: "#fef2f2",
                color: "#b91c1c",
                fontSize: "13px",
              }}
            >
              {error}
            </div>
          )}

          <div>
            <label style={labelStyle}>Issue Category *</label>
            <div style={{ position: "relative" }}>
              <select
                value={form.category}
                onChange={(e) => set("category", e.target.value)}
                style={{
                  ...inputStyle,
                  appearance: "none",
                  paddingRight: "32px",
                }}
              >
                <option value="">Select category</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={14}
                style={{
                  position: "absolute",
                  right: "10px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "#94a3b8",
                  pointerEvents: "none",
                }}
              />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Subject *</label>
            <input
              value={form.subject}
              onChange={(e) => set("subject", e.target.value)}
              placeholder="Brief title of the issue"
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Description *</label>
            <textarea
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Describe the issue in detail..."
              rows={4}
              style={{ ...inputStyle, resize: "vertical", lineHeight: "1.5" }}
            />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "12px",
            }}
          >
            <div>
              <label style={labelStyle}>Priority</label>
              <div style={{ position: "relative" }}>
                <select
                  value={form.priority}
                  onChange={(e) => set("priority", e.target.value)}
                  style={{
                    ...inputStyle,
                    appearance: "none",
                    paddingRight: "32px",
                  }}
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="CRITICAL">Critical</option>
                </select>
                <ChevronDown
                  size={14}
                  style={{
                    position: "absolute",
                    right: "10px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "#94a3b8",
                    pointerEvents: "none",
                  }}
                />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Company</label>
              <div style={{ position: "relative" }}>
                <select
                  value={form.companyId}
                  onChange={(e) => set("companyId", e.target.value)}
                  style={{
                    ...inputStyle,
                    appearance: "none",
                    paddingRight: "32px",
                  }}
                >
                  <option value="">Select company</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={14}
                  style={{
                    position: "absolute",
                    right: "10px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "#94a3b8",
                    pointerEvents: "none",
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            padding: "16px 24px",
            borderTop: "1px solid #f1f5f9",
            display: "flex",
            gap: "10px",
            justifyContent: "flex-end",
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: "8px 18px",
              backgroundColor: "white",
              border: "1.5px solid #e2e8f0",
              borderRadius: "8px",
              color: "#374151",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "Inter, sans-serif",
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => void handleSubmit()}
            disabled={loading}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 20px",
              backgroundColor: "#0d7470",
              border: "none",
              borderRadius: "8px",
              color: "white",
              fontSize: "13px",
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              fontFamily: "Inter, sans-serif",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading && (
              <Loader2
                size={13}
                style={{ animation: "spin 1s linear infinite" }}
              />
            )}
            Submit Ticket
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Tickets Tab ────────────────────────────────────────────────────────────────

function TicketsTab() {
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>(
    []
  );
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [companyFilter, setCompanyFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [viewTicket, setViewTicket] = useState<SupportTicket | null>(null);
  const [showNew, setShowNew] = useState(false);
  const debouncedSearch = useDebouncedValue(search, 500);

  const ticketParams: Record<string, string> = {
    page: String(page),
    limit: "10",
  };
  if (debouncedSearch.trim().length >= 2)
    ticketParams.search = debouncedSearch.trim();
  if (statusFilter !== "ALL") ticketParams.status = statusFilter;
  if (priorityFilter !== "ALL") ticketParams.priority = priorityFilter;
  if (companyFilter !== "ALL") ticketParams.company = companyFilter;

  const { data, isLoading: loading } = useSaSupport(ticketParams);
  const tickets = (data?.tickets ?? []) as SupportTicket[];
  const pagination = data?.pagination ?? { total: 0, page: 1, totalPages: 1 };

  useEffect(() => {
    supportApi
      .getCompanies()
      .then(({ data }) => setCompanies(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const ticketId = searchParams.get("ticket");
    if (!ticketId) return;
    supportApi
      .getOne(ticketId)
      .then(({ data }) => setViewTicket(data))
      .finally(() => setSearchParams({}, { replace: true }));
  }, [searchParams, setSearchParams]);

  const handleStatusChange = (id: string, status: string) => {
    void qc.invalidateQueries({ queryKey: ["sa", "support"] });
    void qc.invalidateQueries({ queryKey: ["sa", "activity"] });
    if (viewTicket?.id === id)
      setViewTicket((v) =>
        v ? { ...v, status: status as SupportTicket["status"] } : null
      );
  };

  const selectStyle: React.CSSProperties = {
    padding: "7px 10px",
    border: "1.5px solid #e2e8f0",
    borderRadius: "8px",
    fontSize: "12px",
    color: "#374151",
    backgroundColor: "white",
    cursor: "pointer",
    outline: "none",
    fontFamily: "Inter, sans-serif",
  };

  return (
    <>
      <div
        style={{
          backgroundColor: "white",
          borderRadius: "12px",
          border: "1px solid #e2e8f0",
          overflow: "hidden",
        }}
      >
        {/* Filters + New button */}
        <div
          style={{
            padding: "14px 20px",
            borderBottom: "1px solid #f1f5f9",
            display: "flex",
            gap: "8px",
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <div style={{ position: "relative", flex: 1, minWidth: "180px" }}>
            <Search
              size={13}
              style={{
                position: "absolute",
                left: "11px",
                top: "50%",
                transform: "translateY(-50%)",
                color: "#94a3b8",
              }}
            />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search tickets..."
              style={{
                width: "100%",
                paddingLeft: "34px",
                paddingRight: "10px",
                paddingTop: "7px",
                paddingBottom: "7px",
                border: "1.5px solid #e2e8f0",
                borderRadius: "8px",
                fontSize: "12px",
                outline: "none",
                fontFamily: "Inter, sans-serif",
                color: "#374151",
                backgroundColor: "#f8fafc",
              }}
            />
          </div>
          <select
            value={companyFilter}
            onChange={(e) => {
              setCompanyFilter(e.target.value);
              setPage(1);
            }}
            style={selectStyle}
          >
            <option value="ALL">All Companies</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            style={selectStyle}
          >
            <option value="ALL">All Status</option>
            <option value="PENDING">Open</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="RESOLVED">Resolved</option>
            <option value="CLOSED">Closed</option>
          </select>
          <select
            value={priorityFilter}
            onChange={(e) => {
              setPriorityFilter(e.target.value);
              setPage(1);
            }}
            style={selectStyle}
          >
            <option value="ALL">All Priority</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="CRITICAL">Critical</option>
          </select>
          <button
            onClick={() => setShowNew(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 14px",
              backgroundColor: "#0d7470",
              border: "none",
              borderRadius: "8px",
              color: "white",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "Inter, sans-serif",
              whiteSpace: "nowrap",
            }}
          >
            <Plus size={14} /> New Ticket
          </button>
        </div>

        {/* Table */}
        {loading ? (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              padding: "60px",
              gap: "10px",
              color: "#64748b",
            }}
          >
            <Loader2
              size={20}
              style={{ animation: "spin 1s linear infinite" }}
            />
            <span style={{ fontSize: "14px" }}>Loading tickets...</span>
          </div>
        ) : tickets.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px" }}>
            <TicketCheck
              size={40}
              color="#e2e8f0"
              style={{ margin: "0 auto 12px" }}
            />
            <p style={{ fontSize: "14px", fontWeight: 600, color: "#94a3b8" }}>
              No tickets found
            </p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ backgroundColor: "#f8fafc" }}>
                  {[
                    "Ticket ID",
                    "Company",
                    "Category",
                    "Subject",
                    "Priority",
                    "Status",
                    "Created",
                  ].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: "left",
                        padding: "10px 18px",
                        fontSize: "11px",
                        fontWeight: 700,
                        color: "#94a3b8",
                        textTransform: "uppercase",
                        letterSpacing: "0.4px",
                        borderBottom: "1px solid #f1f5f9",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tickets.map((t, i) => {
                  const sm = STATUS_META[t.status]!;
                  const pm = PRIORITY_META[t.priority]!;
                  return (
                    <tr
                      key={t.id}
                      onClick={() => setViewTicket(t)}
                      style={{
                        borderBottom:
                          i < tickets.length - 1 ? "1px solid #f8fafc" : "none",
                        cursor: "pointer",
                      }}
                    >
                      <td
                        style={{ padding: "13px 18px", whiteSpace: "nowrap" }}
                      >
                        <span
                          style={{
                            fontSize: "13px",
                            fontWeight: 700,
                            color: "#0d7470",
                            fontFamily: "monospace",
                          }}
                        >
                          {t.ticketNo}
                        </span>
                      </td>
                      <td style={{ padding: "13px 18px" }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "7px",
                          }}
                        >
                          {t.company && (
                            <div
                              style={{
                                width: "26px",
                                height: "26px",
                                borderRadius: "50%",
                                backgroundColor: getAv(t.company.name).bg,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: getAv(t.company.name).color,
                                fontWeight: 700,
                                fontSize: "9px",
                                flexShrink: 0,
                              }}
                            >
                              {initials(t.company.name)}
                            </div>
                          )}
                          <span
                            style={{
                              fontSize: "13px",
                              color: "#374151",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {t.company?.name ?? "—"}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: "13px 18px" }}>
                        <span
                          style={{
                            fontSize: "12px",
                            color: "#64748b",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {t.category}
                        </span>
                      </td>
                      <td style={{ padding: "13px 18px", maxWidth: "220px" }}>
                        <p
                          style={{
                            fontSize: "13px",
                            color: "#0f172a",
                            fontWeight: 500,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {t.subject}
                        </p>
                      </td>
                      <td style={{ padding: "13px 18px" }}>
                        <span
                          style={{
                            padding: "3px 8px",
                            borderRadius: "20px",
                            fontSize: "11px",
                            fontWeight: 600,
                            backgroundColor: pm.bg,
                            color: pm.color,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {pm.label}
                        </span>
                      </td>
                      <td style={{ padding: "13px 18px" }}>
                        <span
                          style={{
                            padding: "3px 8px",
                            borderRadius: "20px",
                            fontSize: "11px",
                            fontWeight: 600,
                            backgroundColor: sm.bg,
                            color: sm.color,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {sm.label}
                        </span>
                      </td>
                      <td
                        style={{ padding: "13px 18px", whiteSpace: "nowrap" }}
                      >
                        <span style={{ fontSize: "12px", color: "#64748b" }}>
                          {fmtDate(t.createdAt)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "14px 20px",
              borderTop: "1px solid #f1f5f9",
            }}
          >
            <span style={{ fontSize: "13px", color: "#64748b" }}>
              Showing {(page - 1) * 10 + 1}–
              {Math.min(page * 10, pagination.total)} of {pagination.total}
            </span>
            <div style={{ display: "flex", gap: "6px" }}>
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                style={{
                  width: "32px",
                  height: "32px",
                  border: "1px solid #e2e8f0",
                  borderRadius: "7px",
                  backgroundColor: page === 1 ? "#f8fafc" : "white",
                  cursor: page === 1 ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: page === 1 ? "#cbd5e1" : "#374151",
                }}
              >
                <ChevronLeft size={15} />
              </button>
              {Array.from(
                { length: Math.min(pagination.totalPages, 5) },
                (_, i) => i + 1
              ).map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  style={{
                    width: "32px",
                    height: "32px",
                    border: "1px solid #e2e8f0",
                    borderRadius: "7px",
                    backgroundColor: p === page ? "#0d7470" : "white",
                    color: p === page ? "white" : "#374151",
                    cursor: "pointer",
                    fontSize: "13px",
                    fontWeight: p === page ? 700 : 400,
                  }}
                >
                  {p}
                </button>
              ))}
              <button
                disabled={page === pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
                style={{
                  width: "32px",
                  height: "32px",
                  border: "1px solid #e2e8f0",
                  borderRadius: "7px",
                  backgroundColor:
                    page === pagination.totalPages ? "#f8fafc" : "white",
                  cursor:
                    page === pagination.totalPages ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: page === pagination.totalPages ? "#cbd5e1" : "#374151",
                }}
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Knowledge Base */}
      <div
        style={{
          backgroundColor: "white",
          borderRadius: "12px",
          border: "1px solid #e2e8f0",
          padding: "20px 22px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginBottom: "16px",
          }}
        >
          <BookOpen size={16} color="#0d7470" />
          <h3 style={{ fontSize: "15px", fontWeight: 700, color: "#0f172a" }}>
            Knowledge Base
          </h3>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "12px",
          }}
        >
          {KNOWLEDGE_BASE.map((kb) => {
            const Icon = kb.icon;
            return (
              <div
                key={kb.title}
                style={{
                  padding: "14px 16px",
                  borderRadius: "10px",
                  border: "1px solid #f1f5f9",
                  backgroundColor: "#fafafa",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.borderColor = "#0d7470";
                  el.style.backgroundColor = "white";
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.borderColor = "#f1f5f9";
                  el.style.backgroundColor = "#fafafa";
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    marginBottom: "8px",
                  }}
                >
                  <div
                    style={{
                      width: "28px",
                      height: "28px",
                      borderRadius: "7px",
                      backgroundColor: `${kb.color}15`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Icon size={13} color={kb.color} />
                  </div>
                  <span
                    style={{
                      fontSize: "11px",
                      color: "#94a3b8",
                      fontWeight: 500,
                    }}
                  >
                    {kb.category}
                  </span>
                </div>
                <p
                  style={{
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "#0f172a",
                    lineHeight: "1.4",
                    marginBottom: "8px",
                  }}
                >
                  {kb.title}
                </p>
                <div
                  style={{ display: "flex", alignItems: "center", gap: "4px" }}
                >
                  <HelpCircle size={11} color="#94a3b8" />
                  <span style={{ fontSize: "11px", color: "#94a3b8" }}>
                    {kb.views}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {viewTicket && (
        <TicketConversationModal
          ticket={viewTicket}
          onClose={() => setViewTicket(null)}
          onStatusChange={handleStatusChange}
          admin
        />
      )}
      {showNew && (
        <NewTicketModal
          companies={companies}
          onClose={() => setShowNew(false)}
          onCreated={() => {
            void qc.invalidateQueries({ queryKey: ["sa", "support"] });
            void qc.invalidateQueries({ queryKey: ["sa", "activity"] });
          }}
        />
      )}
    </>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function SupportPage() {
  const { data: statsData } = useSaSupport({ limit: "1", page: "1" });
  const stats = statsData?.stats ?? {
    total: 0,
    open: 0,
    inProgress: 0,
    resolved: 0,
  };

  const statsRow = [
    {
      label: "Total Tickets",
      value: stats.total,
      icon: TicketCheck,
      bg: "#eff6ff",
      color: "#3b82f6",
    },
    {
      label: "Open",
      value: stats.open,
      icon: AlertCircle,
      bg: "#fef9c3",
      color: "#ca8a04",
    },
    {
      label: "In Progress",
      value: stats.inProgress,
      icon: Clock,
      bg: "#dbeafe",
      color: "#1d4ed8",
    },
    {
      label: "Resolved",
      value: stats.resolved,
      icon: CheckCircle2,
      bg: "#dcfce7",
      color: "#15803d",
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
        }}
      >
        <div>
          <h1 style={{ fontSize: "20px", fontWeight: 700, color: "#0f172a" }}>
            Support & Issues
          </h1>
          <p style={{ fontSize: "13px", color: "#64748b", marginTop: "2px" }}>
            Manage support tickets — employee, payroll, policy or system issues
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "9px",
              border: "1px solid #e2e8f0",
              backgroundColor: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <Settings size={15} color="#64748b" />
          </div>
        </div>
      </div>

      {/* Stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "14px",
        }}
      >
        {statsRow.map((s) => (
          <div
            key={s.label}
            style={{
              backgroundColor: "white",
              borderRadius: "12px",
              border: "1px solid #e2e8f0",
              padding: "16px 20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div>
              <p
                style={{
                  fontSize: "12px",
                  color: "#64748b",
                  marginBottom: "6px",
                }}
              >
                {s.label}
              </p>
              <p
                style={{ fontSize: "26px", fontWeight: 800, color: "#0f172a" }}
              >
                {s.value}
              </p>
            </div>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "10px",
                backgroundColor: s.bg,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <s.icon size={19} color={s.color} />
            </div>
          </div>
        ))}
      </div>

      {/* Tickets + Knowledge Base */}
      <TicketsTab />

    </div>
  );
}
