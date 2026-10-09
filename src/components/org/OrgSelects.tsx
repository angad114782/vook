import CreatableSelect from '../ui/CreatableSelect';
import { useAccess } from '../../hooks/queries/useAccess';
import { useDepartmentOptions, useDesignationOptions } from '../../hooks/useOrgOptions';

interface OrgSelectProps { value: string; onChange: (value: string) => void; id?: string; disabled?: boolean; placeholder?: string }

/** Drop-in department picker: lists existing departments; users with ORGANIZATION.CREATE can add one inline and users with ORGANIZATION.EDIT can delete one (a small bin on each row). */
export function DepartmentSelect({ value, onChange, placeholder = 'Select department', ...rest }: OrgSelectProps) {
  const { options, createOption, deleteOption, canDelete, loading } = useDepartmentOptions(value);
  const { can } = useAccess();
  const canCreate = can('ORGANIZATION.CREATE');
  return <CreatableSelect {...rest} value={value} onChange={onChange} options={options} onCreate={canCreate ? createOption : undefined} onDelete={can('ORGANIZATION.EDIT') ? deleteOption : undefined} canDelete={canDelete} loading={loading} entityLabel="department" placeholder={placeholder} />;
}

/** Drop-in designation picker: lists existing designations; users with ORGANIZATION.CREATE can add one inline and users with ORGANIZATION.EDIT can delete one (a small bin on each row). */
export function DesignationSelect({ value, onChange, placeholder = 'Select designation', ...rest }: OrgSelectProps) {
  const { options, createOption, deleteOption, canDelete, loading } = useDesignationOptions(value);
  const { can } = useAccess();
  const canCreate = can('ORGANIZATION.CREATE');
  return <CreatableSelect {...rest} value={value} onChange={onChange} options={options} onCreate={canCreate ? createOption : undefined} onDelete={can('ORGANIZATION.EDIT') ? deleteOption : undefined} canDelete={canDelete} loading={loading} entityLabel="designation" placeholder={placeholder} />;
}
