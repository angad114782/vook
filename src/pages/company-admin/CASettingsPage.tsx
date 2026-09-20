import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useAuthStore } from "../../store/authStore";
import { type PlanData, subscriptionsApi } from "../../api/subscriptions";
import { getPlanBadge } from "../../utils/planColors";
import { accountApi } from "../../api/account";
import { Loader2, Building2 } from "lucide-react";
import { extractError } from "../../utils/errorUtils";
import { useCaCompany } from "../../hooks/queries/useCaQueries";
import { useUpdateCompany } from "../../hooks/mutations/useCaMutations";
import { paymentsApi, type Payment } from "../../api/payments";

type Tab = "Company Profile" | "Subscription" | "Security";

const fieldStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  border: "1.5px solid #e2e8f0",
  borderRadius: "8px",
  fontSize: "13px",
  outline: "none",
  fontFamily: "Inter, sans-serif",
  color: "#374151",
  backgroundColor: "#f8fafc",
  boxSizing: "border-box",
};
const readStyle: React.CSSProperties = {
  ...fieldStyle,
  backgroundColor: "#f1f5f9",
  color: "#94a3b8",
};
const labelStyle: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 700,
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: "0.4px",
  marginBottom: "4px",
  display: "block",
};

export default function CASettingsPage() {
  const { user } = useAuthStore();
  const [tab] = useState<Tab>("Company Profile");
  const [plans, setPlans] = useState<PlanData[]>([]);
  const [form, setForm] = useState({
    name: "",
    industry: "",
    email: "",
    phone: "",
    address: "",
  });
  const [formInitialized, setFormInitialized] = useState(false);
  const [pwForm, setPwForm] = useState({ current: "", next: "", confirm: "" });
  const [pwMsg, setPwMsg] = useState("");
  const [pwError, setPwError] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [payments, setPayments] = useState<Payment[]>([]);

  const { data: company, isLoading: companyLoading } = useCaCompany();
  const updateCompany = useUpdateCompany();
  const loading = companyLoading;

  // Initialize form when company data arrives
  useEffect(() => {
    if (company && !formInitialized) {
      setForm({
        name: company.name ?? "",
        industry: company.industry ?? "",
        email: company.email ?? "",
        phone: company.phone ?? "",
        address: company.address ?? "",
      });
      setFormInitialized(true);
    }
  }, [company, formInitialized]);

  useEffect(() => {
    subscriptionsApi
      .getPlans()
      .then(({ data }) => setPlans(data))
      .catch(() => {});
    paymentsApi
      .mine()
      .then(({ data }) => setPayments(data))
      .catch(() => {});
  }, []);

  // Load plans (no hook — keeping direct call)
  const handleSave = () => {
    updateCompany.mutate(form, {
      onSuccess: () => {
        toast.success("Company details updated");
      },
      onError: (err) => {
        toast.error(extractError(err, "Failed to save company details"));
      },
    });
  };

  // @ts-ignore Legacy duplicate declaration retained for old page code.

  const fmtDate = (d: string | null) =>
    d
      ? new Date(d).toLocaleDateString("en-IN", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : "—";
  const plan = company?.subscription?.plan ?? company?.plan ?? "";
  const pm = getPlanBadge(plan, plans);
  // @ts-ignore Legacy page retained for old imports while the route uses CACompanyDetailsPage.
  {
    const fmtDate = (d: string | null) =>
      d
        ? new Date(d).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })
        : "—";
    void fmtDate;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div>
        <h1 style={{ fontSize: "20px", fontWeight: 700, color: "#0f172a" }}>
          Settings
        </h1>
        <p style={{ fontSize: "13px", color: "#64748b", marginTop: "2px" }}>
          Manage your company profile, subscription, and admin security
        </p>
      </div>

      <div
        style={{
          backgroundColor: "white",
          borderRadius: "12px",
          border: "1px solid #e2e8f0",
          padding: "24px",
        }}
      >
        {companyLoading ? (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              padding: "40px",
            }}
          >
            <Loader2
              size={20}
              style={{ animation: "spin 1s linear infinite" }}
              color="#6366f1"
            />
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "20px",
              maxWidth: "540px",
            }}
          >
            {/* Company identity */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "16px",
                padding: "14px 18px",
                backgroundColor: "#eef2ff",
                borderRadius: "10px",
                border: "1px solid #c7d2fe",
              }}
            >
              <div
                style={{
                  width: "52px",
                  height: "52px",
                  borderRadius: "12px",
                  backgroundColor: "#6366f1",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Building2 size={24} color="white" />
              </div>
              <div>
                <p
                  style={{
                    fontSize: "16px",
                    fontWeight: 700,
                    color: "#0f172a",
                  }}
                >
                  {company?.name}
                </p>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    marginTop: "4px",
                  }}
                >
                  <span
                    style={{
                      padding: "2px 8px",
                      borderRadius: "20px",
                      fontSize: "11px",
                      fontWeight: 700,
                      backgroundColor: pm.bg,
                      color: pm.color,
                    }}
                  >
                    {pm.label || plan}
                  </span>
                  <span style={{ fontSize: "11px", color: "#64748b" }}>
                    · {company?.status}
                  </span>
                  <span style={{ fontSize: "11px", color: "#64748b" }}>
                    · Max {company?.maxUsers} users
                  </span>
                </div>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "14px",
              }}
            >
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={labelStyle}>Company Name</label>
                <input
                  value={form.name}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, name: e.target.value }))
                  }
                  style={fieldStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Industry</label>
                <input
                  value={form.industry}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, industry: e.target.value }))
                  }
                  placeholder="e.g. Manufacturing"
                  style={fieldStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Email</label>
                <input
                  value={form.email}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, email: e.target.value }))
                  }
                  placeholder="contact@company.com"
                  style={fieldStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Phone</label>
                <input
                  value={form.phone}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, phone: e.target.value }))
                  }
                  placeholder="+91 98765 43210"
                  style={fieldStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Plan Expiry</label>
                <input
                  value={fmtDate(company?.planExpiry ?? null)}
                  readOnly
                  style={readStyle}
                />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={labelStyle}>Address</label>
                <input
                  value={form.address}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, address: e.target.value }))
                  }
                  placeholder="Full address"
                  style={fieldStyle}
                />
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={handleSave}
                disabled={updateCompany.isPending}
                style={{
                  padding: "9px 20px",
                  backgroundColor: updateCompany.isPending
                    ? "#a5b4fc"
                    : "#6366f1",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: updateCompany.isPending ? "not-allowed" : "pointer",
                  fontFamily: "Inter, sans-serif",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                {updateCompany.isPending ? (
                  <>
                    <Loader2
                      size={13}
                      style={{ animation: "spin 1s linear infinite" }}
                    />{" "}
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </button>
            </div>
          </div>
        )}

        {tab === "Subscription" && (
          <div style={{ maxWidth: "540px" }}>
            {loading ? (
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  padding: "40px",
                }}
              >
                <Loader2
                  size={20}
                  style={{ animation: "spin 1s linear infinite" }}
                  color="#6366f1"
                />
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "16px",
                }}
              >
                <div
                  style={{
                    backgroundColor: "#eef2ff",
                    borderRadius: "12px",
                    border: "1px solid #c7d2fe",
                    padding: "20px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                    }}
                  >
                    <div>
                      <p
                        style={{
                          fontSize: "12px",
                          color: "#64748b",
                          marginBottom: "4px",
                        }}
                      >
                        Current Plan
                      </p>
                      <p
                        style={{
                          fontSize: "24px",
                          fontWeight: 800,
                          color: "#6366f1",
                        }}
                      >
                        {pm.label || plan}
                      </p>
                      <p
                        style={{
                          fontSize: "12px",
                          color: "#64748b",
                          marginTop: "4px",
                        }}
                      >
                        {company?.subscription
                          ? `₹${company.subscription.amount.toLocaleString("en-IN")} / ${company.subscription.billingCycle}`
                          : "No billing data"}
                      </p>
                    </div>
                    <span
                      style={{
                        padding: "4px 12px",
                        borderRadius: "20px",
                        fontSize: "12px",
                        fontWeight: 700,
                        backgroundColor:
                          company?.status === "ACTIVE" ? "#f0fdf4" : "#fef9c3",
                        color:
                          company?.status === "ACTIVE" ? "#15803d" : "#854d0e",
                      }}
                    >
                      {company?.status}
                    </span>
                  </div>
                </div>
                {[
                  {
                    label: "Billing Cycle",
                    value: company?.subscription?.billingCycle ?? "—",
                  },
                  {
                    label: "Plan Start",
                    value: company?.subscription?.startDate
                      ? new Date(
                          company.subscription.startDate,
                        ).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })
                      : "—",
                  },
                  {
                    label: "Plan Expiry",
                    value: fmtDate(company?.subscription?.endDate ?? null),
                  },
                  {
                    label: "Max Users",
                    value: String(company?.maxUsers ?? "—"),
                  },
                ].map(({ label, value }) => (
                  <div
                    key={label}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "10px 0",
                      borderBottom: "1px solid #f1f5f9",
                    }}
                  >
                    <span style={{ fontSize: "13px", color: "#64748b" }}>
                      {label}
                    </span>
                    <span
                      style={{
                        fontSize: "13px",
                        fontWeight: 600,
                        color: "#0f172a",
                      }}
                    >
                      {value}
                    </span>
                  </div>
                ))}
                <div
                  style={{
                    padding: "12px",
                    backgroundColor: "#fffbeb",
                    borderRadius: "8px",
                    border: "1px solid #fde68a",
                    fontSize: "12px",
                    color: "#92400e",
                  }}
                >
                  To upgrade or change your plan, contact your Super Admin or
                  reach out to support.
                </div>
                <div
                  style={{ borderTop: "1px solid #e2e8f0", paddingTop: "14px" }}
                >
                  <p
                    style={{
                      fontSize: "13px",
                      fontWeight: 700,
                      color: "#0f172a",
                      marginBottom: "8px",
                    }}
                  >
                    Payment history
                  </p>
                  {payments.length === 0 ? (
                    <p style={{ fontSize: "12px", color: "#64748b" }}>
                      Not recorded — this may be a legacy subscription. Contact
                      your Super Admin for payment details.
                    </p>
                  ) : (
                    payments.map((payment) => (
                      <div
                        key={payment.id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          padding: "8px 0",
                          fontSize: "12px",
                          borderBottom: "1px solid #f1f5f9",
                        }}
                      >
                        <span>
                          {payment.source} · {payment.plan}
                        </span>
                        <span
                          style={{
                            fontWeight: 700,
                            color:
                              payment.status === "PAID" ? "#15803d" : "#a16207",
                          }}
                        >
                          {payment.status} · ₹
                          {payment.amount.toLocaleString("en-IN")}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "Security" && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "20px",
              maxWidth: "440px",
            }}
          >
            <div
              style={{
                padding: "16px 18px",
                backgroundColor: "#f8fafc",
                borderRadius: "10px",
                border: "1px solid #e2e8f0",
              }}
            >
              <p
                style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a" }}
              >
                {user?.name}
              </p>
              <p
                style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}
              >
                {user?.email} · Company Admin
              </p>
            </div>
            <div
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: "10px",
                padding: "20px",
              }}
            >
              <h3
                style={{
                  fontSize: "14px",
                  fontWeight: 700,
                  color: "#0f172a",
                  marginBottom: "14px",
                }}
              >
                Change Password
              </h3>
              {pwMsg && (
                <div
                  style={{
                    padding: "10px 14px",
                    backgroundColor: "#f0fdf4",
                    borderRadius: "8px",
                    color: "#16a34a",
                    fontSize: "12px",
                    marginBottom: "12px",
                  }}
                >
                  {pwMsg}
                </div>
              )}
              {pwError && (
                <div
                  style={{
                    padding: "10px 14px",
                    backgroundColor: "#fef2f2",
                    borderRadius: "8px",
                    color: "#dc2626",
                    fontSize: "12px",
                    marginBottom: "12px",
                  }}
                >
                  {pwError}
                </div>
              )}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                <div>
                  <label style={labelStyle}>Current Password</label>
                  <input
                    type="password"
                    value={pwForm.current}
                    onChange={(e) =>
                      setPwForm((p) => ({ ...p, current: e.target.value }))
                    }
                    placeholder="Enter current password"
                    style={fieldStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>New Password</label>
                  <input
                    type="password"
                    value={pwForm.next}
                    onChange={(e) =>
                      setPwForm((p) => ({ ...p, next: e.target.value }))
                    }
                    placeholder="Min 8 characters"
                    style={fieldStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Confirm New Password</label>
                  <input
                    type="password"
                    value={pwForm.confirm}
                    onChange={(e) =>
                      setPwForm((p) => ({ ...p, confirm: e.target.value }))
                    }
                    placeholder="Re-enter new password"
                    style={fieldStyle}
                  />
                </div>
                <button
                  onClick={async () => {
                    setPwMsg("");
                    setPwError("");
                    if (pwForm.next !== pwForm.confirm) {
                      setPwError("Passwords do not match");
                      return;
                    }
                    if (pwForm.next.length < 8) {
                      setPwError("Minimum 8 characters required");
                      return;
                    }
                    setPwSaving(true);
                    try {
                      await accountApi.changePassword(
                        pwForm.current,
                        pwForm.next,
                      );
                      setPwMsg("Password updated successfully!");
                      setPwForm({ current: "", next: "", confirm: "" });
                    } catch (err: any) {
                      setPwError(
                        err?.response?.data?.message ??
                          "Failed to update password",
                      );
                    } finally {
                      setPwSaving(false);
                    }
                  }}
                  disabled={pwSaving}
                  style={{
                    alignSelf: "flex-end",
                    padding: "9px 20px",
                    backgroundColor: pwSaving ? "#a5b4fc" : "#6366f1",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: pwSaving ? "not-allowed" : "pointer",
                    fontFamily: "Inter, sans-serif",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  {pwSaving && (
                    <Loader2
                      size={13}
                      style={{ animation: "spin 1s linear infinite" }}
                    />
                  )}
                  Update Password
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
