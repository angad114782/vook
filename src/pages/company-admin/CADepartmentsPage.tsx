import { ResponsiveTable } from "../../components/data/ResponsiveDataView";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  BriefcaseBusiness,
  Pencil,
  Plus,
  Power,
} from "lucide-react";
import { toast } from "sonner";
import { organizationApi } from "../../api/organization";
import { caApi } from "../../api/companyAdmin";
import AppDrawer from "../../components/ui/AppDrawer";

type Branch = { _id: string; name: string; code: string };
type Department = {
  id: string;
  name: string;
  code: string;
  branchIds?: Array<string | { _id: string }>;
  isActive: boolean;
  active: number;
  total: number;
};
type Designation = {
  _id: string;
  name: string;
  code: string;
  departmentId?: { _id: string; name: string };
  branchIds?: Branch[];
  isActive: boolean;
};

export default function CADepartmentsPage() {
  const client = useQueryClient();
  const [tab, setTab] = useState<"departments" | "designations">("departments");
  const departments = useQuery({
    queryKey: ["ca", "departments", "organization"],
    queryFn: () =>
      caApi.getDepartments().then((response) => response.data as Department[]),
  });
  const branches = useQuery({
    queryKey: ["ca", "branches"],
    queryFn: () =>
      organizationApi.getOffices<Branch>().then((response) => response.data),
  });
  const designations = useQuery({
    queryKey: ["ca", "designations"],
    queryFn: () =>
      organizationApi
        .getDesignations<Designation>()
        .then((response) => response.data),
  });
  const [departmentForm, setDepartmentFormState] = useState<{
    id?: string;
    name: string;
    code: string;
    branchIds: string[];
  }>();
  const [designationForm, setDesignationFormState] = useState<{
    id?: string;
    name: string;
    code: string;
    departmentId: string;
    branchIds: string[];
  }>();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const setDepartmentForm = (next?: {
    id?: string;
    name: string;
    code: string;
    branchIds: string[];
  }) => {
    if (!next) {
      setDrawerOpen(false);
      return;
    }
    setDesignationFormState(undefined);
    setDepartmentFormState(next);
    setDrawerOpen(true);
  };
  const setDesignationForm = (next?: {
    id?: string;
    name: string;
    code: string;
    departmentId: string;
    branchIds: string[];
  }) => {
    if (!next) {
      setDrawerOpen(false);
      return;
    }
    setDepartmentFormState(undefined);
    setDesignationFormState(next);
    setDrawerOpen(true);
  };

  const invalidate = async () => {
    await client.invalidateQueries({ queryKey: ["ca", "departments"] });
    await client.invalidateQueries({ queryKey: ["ca", "designations"] });
  };
  const saveDepartment = async () => {
    if (!departmentForm?.name || !departmentForm.code) {
      toast.error("Name and code are required.");
      return;
    }
    try {
      if (departmentForm.id)
        await organizationApi.updateDepartment(departmentForm.id, {
          name: departmentForm.name,
          branchIds: departmentForm.branchIds,
        });
      else await organizationApi.createDepartment(departmentForm);
      setDrawerOpen(false);
      await invalidate();
      toast.success("Department saved.");
    } catch (error: any) {
      toast.error(
        error.response?.data?.message ?? "Unable to save department.",
      );
    }
  };
  const saveDesignation = async () => {
    if (!designationForm?.name || !designationForm.code) {
      toast.error("Name and code are required.");
      return;
    }
    try {
      const payload = {
        name: designationForm.name,
        code: designationForm.code,
        departmentId: designationForm.departmentId || undefined,
        branchIds: designationForm.branchIds,
      };
      if (designationForm.id)
        await organizationApi.updateDesignation(designationForm.id, payload);
      else await organizationApi.createDesignation(payload);
      setDrawerOpen(false);
      await invalidate();
      toast.success("Designation saved.");
    } catch (error: any) {
      toast.error(
        error.response?.data?.message ?? "Unable to save designation.",
      );
    }
  };
  const toggleBranch = (ids: string[], id: string) =>
    ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id];
  const openDepartmentForm = (form: {
    id?: string;
    name: string;
    code: string;
    branchIds: string[];
  }) => {
    setDesignationForm(undefined);
    setDepartmentForm(form);
    setDrawerOpen(true);
  };
  const openDesignationForm = (form: {
    id?: string;
    name: string;
    code: string;
    departmentId: string;
    branchIds: string[];
  }) => {
    setDepartmentForm(undefined);
    setDesignationForm(form);
    setDrawerOpen(true);
  };

  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <div>
          <h1>Organization</h1>
          <p>
            Manage branch-aware departments and designations used across
            workforce scope and reporting.
          </p>
        </div>
        <button
          className="admin-button admin-button--primary"
          onClick={() =>
            tab === "departments"
              ? openDepartmentForm({ name: "", code: "", branchIds: [] })
              : openDesignationForm({
                  name: "",
                  code: "",
                  departmentId: "",
                  branchIds: [],
                })
          }
        >
          <Plus size={15} /> Add{" "}
          {tab === "departments" ? "department" : "designation"}
        </button>
      </header>
      <div className="cycle-switch" aria-label="Organization records">
        <button
          className={tab === "departments" ? "is-active" : ""}
          onClick={() => setTab("departments")}
        >
          <Building2 size={14} /> Departments
        </button>
        <button
          className={tab === "designations" ? "is-active" : ""}
          onClick={() => setTab("designations")}
        >
          <BriefcaseBusiness size={14} /> Designations
        </button>
      </div>
      <section className="admin-card" style={{ overflow: "auto" }}>
        {tab === "departments" ? (
          <ResponsiveTable className="org-table">
            <thead>
              <tr>
                <th>Department</th>
                <th>Code</th>
                <th>Branches</th>
                <th>Headcount</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {departments.data?.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.name}</strong>
                  </td>
                  <td>
                    <code>{item.code}</code>
                  </td>
                  <td>
                    {item.branchIds?.length
                      ? `${item.branchIds.length} assigned`
                      : "All branches"}
                  </td>
                  <td>
                    {item.active} active · {item.total} total
                  </td>
                  <td>
                    <span data-status={item.isActive ? "ACTIVE" : "INACTIVE"}>
                      {item.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td>
                    <button
                      className="icon-button"
                      aria-label={`Edit ${item.name}`}
                      onClick={() =>
                        setDepartmentForm({
                          id: item.id,
                          name: item.name,
                          code: item.code,
                          branchIds: (item.branchIds ?? []).map((value: any) =>
                            typeof value === "string" ? value : value._id,
                          ),
                        })
                      }
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      className="icon-button"
                      aria-label={`${item.isActive ? "Deactivate" : "Activate"} ${item.name}`}
                      onClick={async () => {
                        try {
                          await organizationApi.updateDepartment(item.id, {
                            isActive: !item.isActive,
                          });
                          await invalidate();
                        } catch (error: any) {
                          toast.error(
                            error.response?.data?.message ??
                              "Unable to change status.",
                          );
                        }
                      }}
                    >
                      <Power size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </ResponsiveTable>
        ) : (
          <ResponsiveTable className="org-table">
            <thead>
              <tr>
                <th>Designation</th>
                <th>Code</th>
                <th>Department</th>
                <th>Branches</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {designations.data?.map((item) => (
                <tr key={item._id}>
                  <td>
                    <strong>{item.name}</strong>
                  </td>
                  <td>
                    <code>{item.code}</code>
                  </td>
                  <td>{item.departmentId?.name ?? "Any"}</td>
                  <td>
                    {item.branchIds?.length
                      ? item.branchIds.map((branch) => branch.code).join(", ")
                      : "All branches"}
                  </td>
                  <td>
                    <span data-status={item.isActive ? "ACTIVE" : "INACTIVE"}>
                      {item.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td>
                    <button
                      className="icon-button"
                      aria-label={`Edit ${item.name}`}
                      onClick={() =>
                        setDesignationForm({
                          id: item._id,
                          name: item.name,
                          code: item.code,
                          departmentId: item.departmentId?._id ?? "",
                          branchIds:
                            item.branchIds?.map((branch) => branch._id) ?? [],
                        })
                      }
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      className="icon-button"
                      aria-label={`${item.isActive ? "Deactivate" : "Activate"} ${item.name}`}
                      onClick={async () => {
                        await organizationApi.updateDesignation(item._id, {
                          isActive: !item.isActive,
                        });
                        await invalidate();
                      }}
                    >
                      <Power size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </ResponsiveTable>
        )}
      </section>
      {
        <AppDrawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          title={
            departmentForm
              ? `${departmentForm.id ? "Edit" : "Add"} department`
              : `${designationForm?.id ? "Edit" : "Add"} designation`
          }
          description="Assign specific branches, or leave all clear to make the record company-wide."
          placement="responsive"
          size="sm"
          contentClassName="organization-drawer__body"
        >
          <div className="organization-drawer__form">
            {departmentForm ? (
              <>
                <label className="admin-label">
                  Name
                  <input
                    className="admin-input"
                    value={departmentForm.name}
                    onChange={(e) =>
                      setDepartmentForm({
                        ...departmentForm,
                        name: e.target.value,
                      })
                    }
                  />
                </label>
                <label className="admin-label">
                  Code
                  <input
                    className="admin-input"
                    disabled={!!departmentForm.id}
                    value={departmentForm.code}
                    onChange={(e) =>
                      setDepartmentForm({
                        ...departmentForm,
                        code: e.target.value.toUpperCase(),
                      })
                    }
                  />
                </label>
              </>
            ) : designationForm ? (
              <>
                <label className="admin-label">
                  Name
                  <input
                    className="admin-input"
                    value={designationForm.name}
                    onChange={(e) =>
                      setDesignationForm({
                        ...designationForm,
                        name: e.target.value,
                      })
                    }
                  />
                </label>
                <label className="admin-label">
                  Code
                  <input
                    className="admin-input"
                    disabled={!!designationForm.id}
                    value={designationForm.code}
                    onChange={(e) =>
                      setDesignationForm({
                        ...designationForm,
                        code: e.target.value.toUpperCase(),
                      })
                    }
                  />
                </label>
                <label className="admin-label">
                  Department
                  <select
                    className="admin-input"
                    value={designationForm.departmentId}
                    onChange={(e) =>
                      setDesignationForm({
                        ...designationForm,
                        departmentId: e.target.value,
                      })
                    }
                  >
                    <option value="">Any department</option>
                    {departments.data
                      ?.filter((item) => item.isActive)
                      .map((item) => (
                        <option value={item.id} key={item.id}>
                          {item.name}
                        </option>
                      ))}
                  </select>
                </label>
              </>
            ) : null}
            <fieldset style={{ border: 0, padding: 0, margin: "16px 0 0" }}>
              <legend
                style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}
              >
                Branches
              </legend>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {branches.data?.map((branch) => {
                  const ids =
                    departmentForm?.branchIds ??
                    designationForm?.branchIds ??
                    [];
                  return (
                    <label
                      key={branch._id}
                      style={{
                        display: "flex",
                        gap: 6,
                        alignItems: "center",
                        border: "1px solid #cbd5e1",
                        borderRadius: 8,
                        padding: "8px 10px",
                        fontSize: 12,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={ids.includes(branch._id)}
                        onChange={() =>
                          departmentForm
                            ? setDepartmentForm({
                                ...departmentForm,
                                branchIds: toggleBranch(ids, branch._id),
                              })
                            : designationForm &&
                              setDesignationForm({
                                ...designationForm,
                                branchIds: toggleBranch(ids, branch._id),
                              })
                        }
                      />{" "}
                      {branch.name}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          </div>
          <footer className="organization-drawer__footer">
            <button
              className="admin-button admin-button--secondary"
              onClick={() => {
                setDepartmentForm(undefined);
                setDesignationForm(undefined);
              }}
            >
              Cancel
            </button>
            <button
              className="admin-button admin-button--primary"
              onClick={() =>
                void (departmentForm ? saveDepartment() : saveDesignation())
              }
            >
              Save
            </button>
          </footer>
        </AppDrawer>
      }
    </div>
  );
}
