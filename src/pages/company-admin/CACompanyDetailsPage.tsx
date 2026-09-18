import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Building2, Loader2 } from "lucide-react";
import { extractError } from "../../utils/errorUtils";
import { useCaCompany } from "../../hooks/queries/useCaQueries";
import { useUpdateCompany } from "../../hooks/mutations/useCaMutations";

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

const labelStyle: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 700,
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: "0.4px",
  marginBottom: "4px",
  display: "block",
};

export default function CACompanyDetailsPage() {
  const [form, setForm] = useState({
    name: "",
    industry: "",
    email: "",
    phone: "",
    address: "",
  });
  const [formInitialized, setFormInitialized] = useState(false);
  const { data: company, isLoading } = useCaCompany();
  const updateCompany = useUpdateCompany();

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

  const handleSave = () => {
    updateCompany.mutate(form, {
      onSuccess: () => toast.success("Company details updated"),
      onError: (error) =>
        toast.error(extractError(error, "Failed to save company details")),
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div>
        <h1 style={{ fontSize: "20px", fontWeight: 700, color: "#0f172a" }}>
          Company details
        </h1>
        <p style={{ fontSize: "13px", color: "#64748b", marginTop: "2px" }}>
          Manage organization information. Personal account and billing controls
          live in their dedicated areas.
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
        {isLoading ? (
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
              maxWidth: "640px",
            }}
          >
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
                  {company?.name || "Your company"}
                </p>
                <p
                  style={{
                    fontSize: "12px",
                    color: "#64748b",
                    marginTop: "4px",
                  }}
                >
                  Organization information
                </p>
              </div>
            </div>

            <div
              style={{
                padding: "12px 14px",
                backgroundColor: "#f8fafc",
                borderRadius: "8px",
                border: "1px solid #e2e8f0",
                color: "#64748b",
                fontSize: "12px",
                lineHeight: 1.5,
              }}
            >
              Update your own name, email, password, and personal security from{" "}
              <strong style={{ color: "#475569" }}>Profile</strong>. Manage the
              company plan, payments, and billing history from{" "}
              <strong style={{ color: "#475569" }}>
                Subscription &amp; billing
              </strong>
              .
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "14px",
              }}
            >
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={labelStyle}>Company name</label>
                <input
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  style={fieldStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Industry</label>
                <input
                  value={form.industry}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      industry: event.target.value,
                    }))
                  }
                  placeholder="e.g. Manufacturing"
                  style={fieldStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Company email</label>
                <input
                  value={form.email}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                  placeholder="contact@company.com"
                  style={fieldStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Company phone</label>
                <input
                  value={form.phone}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      phone: event.target.value,
                    }))
                  }
                  placeholder="+91 98765 43210"
                  style={fieldStyle}
                />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={labelStyle}>Company address</label>
                <input
                  value={form.address}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      address: event.target.value,
                    }))
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
                  "Save changes"
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
