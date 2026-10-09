import CreatableSelect from './CreatableSelect';
import { useLookup } from '../../hooks/useLookup';
import type { LookupType } from '../../api/lookups';

interface Props { type: LookupType; value: string; onChange: (value: string) => void; entityLabel: string; placeholder?: string; id?: string; disabled?: boolean }

/** A dropdown whose choices come from the database, with “+ Add new” and a small bin for those allowed to manage the list. */
export default function LookupSelect({ type, value, onChange, entityLabel, placeholder, ...rest }: Props) {
  const l = useLookup(type, value);
  return <CreatableSelect {...rest} value={value} onChange={onChange} options={l.options} loading={l.loading} entityLabel={entityLabel} placeholder={placeholder}
    onCreate={l.canManage ? l.createOption : undefined} onDelete={l.canManage ? l.deleteOption : undefined} canDelete={l.canDelete} />;
}
