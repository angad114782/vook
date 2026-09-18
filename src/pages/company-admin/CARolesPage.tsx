import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  CopyPlus,
  Loader2,
  LockKeyhole,
  Plus,
  ShieldCheck,
  Trash2,
  UserRoundCog,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { caApi, type CAModule } from "../../api/companyAdmin";
import {
  organizationApi,
  type RoleAssignment,
  type RoleDefinition,
} from "../../api/organization";
import { extractError } from "../../utils/errorUtils";

const permissionName = (permission: string) =>
  permission
    .split(".")[1]
    ?.replaceAll("_", " ")
    .toLowerCase()
    .replace(/^./, (letter) => letter.toUpperCase()) ?? permission;

function AssignmentManager({ roles }: { roles: RoleDefinition[] }) {
  const client = useQueryClient();
  const assignments = useQuery({
    queryKey: ["ca", "role-assignments"],
    queryFn: () =>
      organizationApi
        .getRoleAssignments<RoleAssignment>()
        .then((response) => response.data),
  });
  const users = useQuery({
    queryKey: ["ca", "users", "assignment"],
    queryFn: () =>
      caApi.getUsers({ limit: "100" }).then((response) => response.data.users),
  });
  const branches = useQuery({
    queryKey: ["ca", "branches"],
    queryFn: () =>
      organizationApi.getOffices<any>().then((response) => response.data),
  });
  const departments = useQuery({
    queryKey: ["ca", "departments"],
    queryFn: () => caApi.getDepartments().then((response) => response.data),
  });
  const teams = useQuery({
    queryKey: ["ca", "teams"],
    queryFn: () =>
      organizationApi.getTeams<any>().then((response) => response.data),
  });
  const assignable = roles.filter((role) => role.key !== "COMPANY_ADMIN");
  const [form, setForm] = useState({
    userId: "",
    roleDefinitionId: assignable[0]?.id ?? "",
    scopeType: "COMPANY",
    scopeId: "",
  });
  useEffect(() => {
    if (!form.roleDefinitionId && assignable[0])
      setForm((current) => ({
        ...current,
        roleDefinitionId: assignable[0].id,
      }));
  }, [assignable, form.roleDefinitionId]);
  const scopeOptions =
    form.scopeType === "BRANCH"
      ? (branches.data ?? [])
      : form.scopeType === "DEPARTMENT"
        ? (departments.data ?? [])
        : form.scopeType === "TEAM"
          ? (teams.data ?? [])
          : [];
  const create = useMutation({
    mutationFn: () => organizationApi.createRoleAssignment(form),
    onSuccess: async () => {
      toast.success("Scoped role assignment created.");
      setForm((current) => ({ ...current, userId: "", scopeId: "" }));
      await client.invalidateQueries({ queryKey: ["ca", "role-assignments"] });
      await client.invalidateQueries({ queryKey: ["auth", "access"] });
    },
    onError: (error) =>
      toast.error(extractError(error, "The role could not be assigned.")),
  });
  const remove = async (assignment: RoleAssignment) => {
    try {
      await organizationApi.deleteRoleAssignment(
        assignment.id ?? assignment._id!,
      );
      await client.invalidateQueries({ queryKey: ["ca", "role-assignments"] });
      await client.invalidateQueries({ queryKey: ["auth", "access"] });
      toast.success("Role assignment removed.");
    } catch (error) {
      toast.error(extractError(error, "The assignment could not be removed."));
    }
  };

  return (
    <section className="admin-card role-assignment-card">
      <header>
        <div>
          <h2>People and organizational scope</h2>
          <p>
            A person can hold several roles. Each role only applies inside its
            company, branch, department, team, or own record.
          </p>
        </div>
        <UserRoundCog size={19} />
      </header>
      <div className="role-assignment-form">
        <label className="admin-label">
          User
          <select
            className="admin-input"
            value={form.userId}
            onChange={(event) =>
              setForm({ ...form, userId: event.target.value })
            }
          >
            <option value="">Select user</option>
            {users.data?.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name} · {user.email}
              </option>
            ))}
          </select>
        </label>
        <label className="admin-label">
          Role
          <select
            className="admin-input"
            value={form.roleDefinitionId}
            onChange={(event) =>
              setForm({ ...form, roleDefinitionId: event.target.value })
            }
          >
            {assignable.map((role) => (
              <option value={role.id} key={role.id}>
                {role.name}
                {role.kind === "CUSTOM" ? " · Custom" : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="admin-label">
          Scope
          <select
            className="admin-input"
            value={form.scopeType}
            onChange={(event) =>
              setForm({ ...form, scopeType: event.target.value, scopeId: "" })
            }
          >
            <option>COMPANY</option>
            <option>BRANCH</option>
            <option>DEPARTMENT</option>
            <option>TEAM</option>
            <option>SELF</option>
          </select>
        </label>
        <label className="admin-label">
          Scope record
          <select
            className="admin-input"
            disabled={
              !["BRANCH", "DEPARTMENT", "TEAM"].includes(form.scopeType)
            }
            value={form.scopeId}
            onChange={(event) =>
              setForm({ ...form, scopeId: event.target.value })
            }
          >
            <option value="">
              {["BRANCH", "DEPARTMENT", "TEAM"].includes(form.scopeType)
                ? "Select record"
                : "Automatic"}
            </option>
            {scopeOptions.map((item: any) => (
              <option key={item.id ?? item._id} value={item.id ?? item._id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="role-assignment-submit">
        <button
          className="admin-button"
          disabled={
            create.isPending ||
            !form.userId ||
            !form.roleDefinitionId ||
            (["BRANCH", "DEPARTMENT", "TEAM"].includes(form.scopeType) &&
              !form.scopeId)
          }
          onClick={() => create.mutate()}
        >
          {create.isPending ? (
            <Loader2 className="spin" size={15} />
          ) : (
            <Plus size={15} />
          )}{" "}
          Assign role
        </button>
      </div>
      <div className="assignment-list">
        {assignments.isLoading ? (
          <div className="admin-loading">
            <Loader2 className="spin" size={17} /> Loading assignments…
          </div>
        ) : (
          assignments.data?.map((assignment) => (
            <div key={assignment.id ?? assignment._id}>
              <span>
                <strong>{assignment.userId.name}</strong>
                <small>{assignment.userId.email}</small>
              </span>
              <span>
                {assignment.roleName ?? assignment.role}
                <small>
                  {
                    roles.find(
                      (role) => role.id === assignment.roleDefinitionId,
                    )?.kind
                  }
                </small>
              </span>
              <span>
                {assignment.scopeType}
                <small>
                  {assignment.isPrimary
                    ? "Primary assignment"
                    : "Additional access"}
                </small>
              </span>
              <button
                className="icon-button"
                aria-label={`Remove ${assignment.roleName} from ${assignment.userId.name}`}
                disabled={assignment.isPrimary}
                onClick={() => void remove(assignment)}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

export default function CARolesPage() {
  const client = useQueryClient();
  const modulesQuery = useQuery({
    queryKey: ["ca", "entitled-modules", "permissions"],
    queryFn: () => caApi.getModules().then((response) => response.data.modules),
  });
  const rolesQuery = useQuery({
    queryKey: ["ca", "role-definitions"],
    queryFn: () =>
      organizationApi.getRoleDefinitions().then((response) => response.data),
  });
  const [selectedId, setSelectedId] = useState("");
  const [permissions, setPermissions] = useState<string[]>([]);
  const roles = useMemo(() => rolesQuery.data ?? [], [rolesQuery.data]);
  const modules = useMemo(() => modulesQuery.data ?? [], [modulesQuery.data]);
  const selected =
    roles.find((role) => role.id === selectedId) ??
    roles.find((role) => role.key === "HR") ??
    roles[0];
  useEffect(() => {
    if (selected) {
      setSelectedId(selected.id);
      setPermissions(selected.permissions);
    }
  }, [selected]);
  const enabledKeys = useMemo(
    () =>
      new Set(
        modules
          .filter((module) => module.enabled || module.isEnabled)
          .flatMap((module) =>
            module.actions.map((action) => `${module.key}.${action}`),
          ),
      ),
    [modules],
  );
  const activeCount = permissions.filter((permission) =>
    enabledKeys.has(permission),
  ).length;

  const refresh = async () => {
    await client.invalidateQueries({ queryKey: ["ca", "role-definitions"] });
    await client.invalidateQueries({ queryKey: ["ca", "role-assignments"] });
    await client.invalidateQueries({ queryKey: ["auth", "access"] });
  };

  const save = useMutation({
    mutationFn: () =>
      organizationApi.updateRoleDefinition(selected.id, { permissions }),
    onSuccess: async () => {
      await refresh();
      toast.success(`${selected.name} permissions saved.`);
    },
    onError: (error) =>
      toast.error(extractError(error, "Permissions could not be saved.")),
  });

  const clone = useMutation({
    mutationFn: () =>
      organizationApi.createRoleDefinition({
        name: `${selected.name} copy`,
        description: `Created from ${selected.name}`,
        permissions: selected.permissions.filter((permission) =>
          enabledKeys.has(permission),
        ),
      }),
    onSuccess: async ({ data }) => {
      await refresh();
      setSelectedId(data.id);
      toast.success("Role copied as a custom role.");
    },
    onError: (error) =>
      toast.error(extractError(error, "The role could not be copied.")),
  });
  const remove = async () => {
    try {
      await organizationApi.deleteRoleDefinition(selected.id);
      await refresh();
      setSelectedId("");
      toast.success("Custom role deleted.");
    } catch (error) {
      toast.error(extractError(error, "The role could not be deleted."));
    }
  };
  const toggle = (permission: string, module: CAModule) => {
    if (selected.locked || !(module.enabled || module.isEnabled)) return;
    setPermissions((current) =>
      current.includes(permission)
        ? current.filter((item) => item !== permission)
        : [...current, permission],
    );
  };

  if (rolesQuery.isLoading || modulesQuery.isLoading || !selected)
    return (
      <div className="admin-loading">
        <Loader2 className="spin" size={22} /> Loading tenant access model…
      </div>
    );
  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <div>
          <h1>Roles, permissions, and scope</h1>
          <p>
            Plan entitlements decide what the company owns. Roles decide what
            each person can do. Scope decides which records they can reach.
          </p>
        </div>
        <span className="health-chip">
          <ShieldCheck size={15} />
          {
            modules.filter((module) => module.enabled || module.isEnabled)
              .length
          }{" "}
          entitled modules
        </span>
      </header>
      <AssignmentManager roles={roles} />
      <section className="role-permission-layout">
        <nav className="admin-card role-list" aria-label="Company roles">
          {/* <div className="custom-role-entry">
            <input
              className="admin-input"
              value={createName}
              onChange={(event) => setCreateName(event.target.value)}
              placeholder="New custom role"
            />
            <button
              className="icon-button"
              aria-label="Create custom role"
              disabled={!createName.trim() || create.isPending}
              onClick={() => create.mutate()}
            >
              <Plus size={15} />
            </button>
          </div> */}
          {roles.map((role) => (
            <button
              key={role.id}
              className={selected.id === role.id ? "is-active" : ""}
              onClick={() => setSelectedId(role.id)}
            >
              <span>{role.name}</span>
              <small>
                {role.locked
                  ? "Locked system role"
                  : role.kind === "CUSTOM"
                    ? "Custom role"
                    : "Standard template"}{" "}
                ·{" "}
                {
                  role.permissions.filter((permission) =>
                    enabledKeys.has(permission),
                  ).length
                }{" "}
                active
              </small>
            </button>
          ))}
        </nav>
        <div className="admin-card permission-panel">
          <header>
            <div>
              <h2>{selected.name}</h2>
              <p>
                {activeCount} effective actions ·{" "}
                {selected.permissions.length - activeCount} dormant because of
                the current plan
              </p>
            </div>
            <div className="role-header-actions">
              {selected.locked ? (
                <span className="admin-status success">
                  <LockKeyhole size={12} /> Locked full access
                </span>
              ) : (
                <>
                  <button
                    className="icon-button"
                    aria-label={`Copy ${selected.name}`}
                    onClick={() => clone.mutate()}
                  >
                    <CopyPlus size={15} />
                  </button>
                  {selected.kind === "CUSTOM" && (
                    <button
                      className="icon-button"
                      aria-label={`Delete ${selected.name}`}
                      onClick={() => void remove()}
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </>
              )}
            </div>
          </header>
          <div className="permission-modules">
            {modules.map((module) => {
              const available = Boolean(module.enabled || module.isEnabled);
              return (
                <article
                  key={module.id}
                  className={available ? "" : "is-dormant"}
                >
                  <div>
                    <strong>{module.name}</strong>
                    <small>
                      {module.category} ·{" "}
                      {available
                        ? module.source === "OVERRIDE_GRANT"
                          ? "Super Admin grant"
                          : "Included in plan"
                        : module.source === "OVERRIDE_DENY"
                          ? "Denied by Super Admin"
                          : "Not in plan"}
                    </small>
                  </div>
                  <div>
                    {module.actions.map((action) => {
                      const key = `${module.key}.${action}`;
                      const granted =
                        selected.locked || permissions.includes(key);
                      return (
                        <button
                          type="button"
                          key={key}
                          aria-pressed={granted && available}
                          disabled={selected.locked || !available}
                          className={granted ? "is-enabled" : ""}
                          onClick={() => toggle(key, module)}
                        >
                          {selected.locked ? (
                            <LockKeyhole size={11} />
                          ) : granted ? (
                            <Check size={12} />
                          ) : null}
                          {permissionName(key)}
                        </button>
                      );
                    })}
                  </div>
                </article>
              );
            })}
          </div>
          <footer>
            {selected.locked ? (
              <span>
                Company Admin always has full tenant access inside entitled
                modules.
              </span>
            ) : (
              <>
                <button
                  className="admin-button admin-button--secondary"
                  onClick={() =>
                    setPermissions((current) =>
                      current.filter(
                        (permission) => !enabledKeys.has(permission),
                      ),
                    )
                  }
                >
                  Revoke active
                </button>
                <button
                  className="admin-button admin-button--secondary"
                  onClick={() =>
                    setPermissions((current) => [
                      ...new Set([...current, ...enabledKeys]),
                    ])
                  }
                >
                  Grant all entitled
                </button>

                <button
                  className="admin-button"
                  disabled={save.isPending}
                  onClick={() => save.mutate()}
                >
                  {save.isPending ? "Saving…" : "Save permissions"}
                </button>
              </>
            )}
          </footer>
        </div>
      </section>
    </div>
  );
}
