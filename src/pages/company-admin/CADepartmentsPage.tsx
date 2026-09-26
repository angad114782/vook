import { ResponsiveTable } from "../../components/data/ResponsiveDataView";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Pencil,
  Plus,
  Power,
} from "lucide-react";
import { toast } from "sonner";
import { organizationApi } from "../../api/organization";
import { caApi } from "../../api/companyAdmin";
import AppDrawer from "../../components/ui/AppDrawer";

type Department = {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  active: number;
  total: number;
};
type Designation = {
  _id: string;
  name: string;
  code: string;
  departmentId?: { _id: string; name: string };
  isActive: boolean;
};

type OrganizationSection = "departments" | "designations";

export default function CADepartmentsPage({
  section = "departments",
}: {
  section?: OrganizationSection;
}) {
  const client = useQueryClient();
  const departments = useQuery({
    queryKey: ["ca", "departments", "organization"],
    queryFn: () =>
      caApi.getDepartments().then((response) => response.data as Department[]),
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
  }>();
  const [designationForm, setDesignationFormState] = useState<{
    id?: string;
    name: string;
    code: string;
    departmentId: string;
  }>();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const setDepartmentForm = (next?: {
    id?: string;
    name: string;
    code: string;
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
  const openDepartmentForm = (form: {
    id?: string;
    name: string;
    code: string;
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
  }) => {
    setDepartmentForm(undefined);
    setDesignationForm(form);
    setDrawerOpen(true);
  };

  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <div>
          <h1>{section === "departments" ? "Departments" : "Designations"}</h1>
          <p>
            {section === "departments"
              ? "Manage departments used across workforce records and reporting."
              : "Manage designations used across workforce records and reporting."}
          </p>
        </div>
        <button
          className="admin-button admin-button--primary"
          onClick={() =>
            section === "departments"
              ? openDepartmentForm({ name: "", code: "" })
              : openDesignationForm({
                  name: "",
                  code: "",
                  departmentId: "",
                })
          }
        >
          <Plus size={15} /> Add{" "}
          {section === "departments" ? "department" : "designation"}
        </button>
      </header>
      <section className="admin-card" style={{ overflow: "auto" }}>
        {section === "departments" ? (
          <ResponsiveTable className="org-table">
            <thead>
              <tr>
                <th>Department</th>
                <th>Code</th>
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
          description="Manage company-wide departments and designations."
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
