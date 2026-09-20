import { ListFilter, Search } from 'lucide-react';
import { type ChangeEvent, useState } from 'react';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import AppDrawer from '../ui/AppDrawer';

export interface FilterOption {
  label: string;
  value: string;
}

export interface FilterConfig {
  key: string;
  label: string;
  options: FilterOption[];
  value: string;
  onChange: (value: string) => void;
}

interface FilterBarProps {
  search?: string;
  onSearch?: (value: string) => void;
  searchPlaceholder?: string;
  filters?: FilterConfig[];
  rightSlot?: React.ReactNode;
}

export default function FilterBar({ search, onSearch, searchPlaceholder = 'Search…', filters = [], rightSlot }: FilterBarProps) {
  const compact = useMediaQuery('(max-width: 1199px)');
  const [open, setOpen] = useState(false);
  const activeFilters = filters.filter((filter) => filter.value && filter.value !== 'ALL');
  const filterControls = <>{filters.map((f) => (
    <label className="filter-bar__field" key={f.key}><span>{f.label}</span><select value={f.value} onChange={(e) => f.onChange(e.target.value)} aria-label={f.label}>
      <option value="ALL">All</option>{f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select></label>
  ))}</>;
  return (
    <div className="filter-bar">
      {onSearch !== undefined && (
        <div className="filter-bar__search">
          <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={search ?? ''}
            onChange={(e: ChangeEvent<HTMLInputElement>) => onSearch(e.target.value)}
            style={{
              width: '100%',
              paddingLeft: 32,
              paddingRight: 12,
              paddingTop: 7,
              paddingBottom: 7,
              fontSize: 13,
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              outline: 'none',
              background: 'white',
            }}
          />
        </div>
      )}
      {compact ? <>
        {filters.length > 0 && <button type="button" className="filter-bar__trigger" onClick={() => setOpen(true)}><ListFilter size={16} aria-hidden /> Filters{activeFilters.length > 0 && <span>{activeFilters.length}</span>}</button>}
        <AppDrawer open={open} onOpenChange={setOpen} placement="bottom" title="Filters" description="Narrow the records shown on this page." footer={<button type="button" className="admin-button" onClick={() => setOpen(false)}>Show results</button>}><div className="filter-bar__sheet">{filterControls}</div></AppDrawer>
      </> : <div className="filter-bar__desktop">{filterControls}</div>}
      {activeFilters.length > 0 && <div className="filter-bar__chips" aria-label="Active filters">{activeFilters.map((filter) => <span key={filter.key}>{filter.label}: {filter.options.find((option) => option.value === filter.value)?.label ?? filter.value}</span>)}</div>}
      {rightSlot && <div className="filter-bar__right">{rightSlot}</div>}
    </div>
  );
}
