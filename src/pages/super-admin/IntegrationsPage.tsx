import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  FlaskConical,
  KeyRound,
  PlugZap,
  Save,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { integrationsApi, type Integration } from "../../api/integrations";

function ProviderCard({ provider }: { provider: Integration }) {
  const client = useQueryClient();
  const [publicConfig, setPublicConfig] = useState<Record<string, unknown>>(
    provider.publicConfig ?? {},
  );
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const refresh = () =>
    client.invalidateQueries({ queryKey: ["integrations"] });
  const action = useMutation({
    mutationFn: async (kind: "save" | "test" | "activate" | "disable") => {
      if (kind === "save")
        return integrationsApi.save(provider.providerKey, {
          publicConfig,
          secrets,
          reason: "Dashboard configuration update",
        });
      if (kind === "test") return integrationsApi.test(provider.providerKey);
      if (kind === "activate")
        return integrationsApi.activate(
          provider.providerKey,
          "Approved after successful connection test",
        );
      return integrationsApi.disable(
        provider.providerKey,
        "Disabled from dashboard",
      );
    },
    onSuccess: (_response, kind) => {
      toast.success(
        kind === "test" ? "Configuration validated" : "Integration updated",
      );
      refresh();
    },
    onError: (error: any) =>
      toast.error(
        error?.response?.data?.message ?? "Integration action failed",
      ),
  });
  return (
    <article className="admin-card integration-card">
      <header>
        <div className="provider-icon">
          <PlugZap size={18} />
        </div>
        <div>
          <h2>{provider.displayName}</h2>
          <p>{provider.category}</p>
        </div>
        <span data-status={provider.status}>
          {provider.status.replaceAll("_", " ")}
        </span>
      </header>
      {!provider.available && (
        <div className="notice-muted">
          Adapter readiness: configuration draft only. Activation is
          intentionally disabled.
        </div>
      )}
      <div className="integration-fields">
        {(provider.publicFields ?? []).map((field) => (
          <label className="admin-label" key={field.key}>
            {field.label}
            {field.required ? " *" : ""}
            <input
              className="admin-input"
              value={String(publicConfig[field.key] ?? "")}
              onChange={(event) =>
                setPublicConfig((current) => ({
                  ...current,
                  [field.key]: event.target.value,
                }))
              }
            />
          </label>
        ))}
        {(provider.secretFields ?? []).map((field) => (
          <label className="admin-label" key={field.key}>
            {field.label}
            {field.required ? " *" : ""}
            <input
              className="admin-input"
              type="password"
              value={secrets[field.key] ?? ""}
              placeholder={
                provider.secretConfigured
                  ? "Stored securely — enter to rotate"
                  : ""
              }
              onChange={(event) =>
                setSecrets((current) => ({
                  ...current,
                  [field.key]: event.target.value,
                }))
              }
            />
          </label>
        ))}
      </div>
      <footer>
        <button
          className="admin-button admin-button--secondary"
          onClick={() => action.mutate("save")}
        >
          <Save size={15} /> Save draft
        </button>
        <button
          className="admin-button admin-button--secondary"
          disabled={!provider.available}
          onClick={() => action.mutate("test")}
        >
          <FlaskConical size={15} /> Test
        </button>
        {provider.status === "ACTIVE" ? (
          <button
            className="admin-button admin-button--secondary"
            onClick={() => action.mutate("disable")}
          >
            Disable
          </button>
        ) : (
          <button
            className="admin-button"
            disabled={!provider.available || !provider.lastTestedAt}
            onClick={() => action.mutate("activate")}
          >
            <ShieldCheck size={15} /> Activate
          </button>
        )}
      </footer>
      <small className="secret-note">
        <KeyRound size={13} /> Secrets are encrypted at rest and are never
        returned by the API.
        {provider.pendingConfiguration
          ? " A newer configuration is waiting for a successful test."
          : ""}
      </small>
    </article>
  );
}

export default function IntegrationsPage() {
  const query = useQuery({
    queryKey: ["integrations"],
    queryFn: () => integrationsApi.list().then((response) => response.data),
  });
  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <div>
          <h1>Integrations</h1>
          <p>
            Configure platform providers without redeploying the application.
            New credentials do not replace an active connection until validation
            succeeds.
          </p>
        </div>
        <div className="health-chip">
          <CheckCircle2 size={15} />
          {query.data?.filter((item) => item.status === "ACTIVE").length ??
            0}{" "}
          active
        </div>
      </header>
      <section className="integration-grid">
        {query.data?.map((provider) => (
          <ProviderCard key={provider.providerKey} provider={provider} />
        ))}
      </section>
    </div>
  );
}
