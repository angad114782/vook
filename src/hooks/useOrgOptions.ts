import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { organizationApi } from '../api/organization';
import { useCaDepartments } from './queries/useCaQueries';
import { useCreateCaDepartment } from './mutations/useCaMutations';
import { caApi } from '../api/companyAdmin';
import { makeOrgCode } from '../utils/orgCode';
import type { SelectOption } from '../components/ui/CreatableSelect';

type Designation = { _id?: string; id?: string; name: string; code: string; isActive?: boolean };

/** Include the currently stored value even if it is no longer (or not yet) in the master list. */
const withCurrent = (options: SelectOption[], current?: string): SelectOption[] =>
  current && !options.some((o) => o.value === current) ? [{ value: current, label: current }, ...options] : options;

/** Departments as select options plus a creator. The data source lives behind `caApi`, so a real API needs no change here. */
export function useDepartmentOptions(current?: string) {
  const qc = useQueryClient();
  const query = useCaDepartments();
  const create = useCreateCaDepartment();
  const rows = query.data ?? [];
  const options = useMemo(() => withCurrent(rows.filter((d) => d.isActive !== false).map((d) => ({ value: d.name, label: d.name })), current), [rows, current]);
  const createOption = async (name: string): Promise<SelectOption> => {
    const row = await create.mutateAsync({ name, code: makeOrgCode(name, rows.map((d) => d.code)) });
    return { value: row.name, label: row.name };
  };
  const deleteOption = async (name: string) => {
    const row = rows.find((d) => d.name === name);
    if (!row) return;
    await caApi.deleteDepartment(String(row.id ?? (row as { _id?: string })._id));
    await qc.invalidateQueries({ queryKey: ['ca', 'departments'] });
  };
  const canDelete = (name: string) => rows.some((d) => d.name === name);
  return { options, createOption, deleteOption, canDelete, loading: query.isLoading };
}

export function useDesignationOptions(current?: string) {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ['ca', 'designations'], queryFn: () => organizationApi.getDesignations<Designation>().then((r) => r.data) });
  const rows = query.data ?? [];
  const options = useMemo(() => withCurrent(rows.filter((d) => d.isActive !== false).map((d) => ({ value: d.name, label: d.name })), current), [rows, current]);
  const createOption = async (name: string): Promise<SelectOption> => {
    const row = (await organizationApi.createDesignation({ name, code: makeOrgCode(name, rows.map((d) => d.code)) })).data as Designation;
    await qc.invalidateQueries({ queryKey: ['ca', 'designations'] });
    return { value: row.name, label: row.name };
  };
  const deleteOption = async (name: string) => {
    const row = rows.find((d) => d.name === name);
    if (!row) return;
    await organizationApi.deleteDesignation(String(row.id ?? row._id));
    await qc.invalidateQueries({ queryKey: ['ca', 'designations'] });
  };
  const canDelete = (name: string) => rows.some((d) => d.name === name);
  return { options, createOption, deleteOption, canDelete, loading: query.isLoading };
}
