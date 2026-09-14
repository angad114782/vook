import { Search } from 'lucide-react';
import { type ChangeEvent } from 'react';

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
  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
      {onSearch !== undefined && (
        <div style={{ position: 'relative', flex: '1 1 220px', maxWidth: 320 }}>
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
      {filters.map((f) => (
        <select
          key={f.key}
          value={f.value}
          onChange={(e) => f.onChange(e.target.value)}
          style={{
            padding: '7px 10px',
            fontSize: 13,
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            background: 'white',
            color: '#374151',
            cursor: 'pointer',
          }}
          aria-label={f.label}
        >
          <option value="ALL">{f.label}: All</option>
          {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ))}
      {rightSlot && <div style={{ marginLeft: 'auto' }}>{rightSlot}</div>}
    </div>
  );
}
