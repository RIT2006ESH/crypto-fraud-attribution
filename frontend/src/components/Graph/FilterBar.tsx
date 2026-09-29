import { Filter, Eye, AlertTriangle, Shield, User, Globe } from "lucide-react";

interface Props {
  activeFilter: string;
  onFilterChange: (filter: string) => void;
}

export default function FilterBar({ activeFilter, onFilterChange }: Props) {
  const filters = [
    { id: "all", label: "All Nodes", icon: Globe },
    { id: "known", label: "Known Entities", icon: Shield },
    { id: "high-risk", label: "High Risk", icon: AlertTriangle },
    { id: "mixers", label: "Mixers", icon: Eye },
    { id: "sanctioned", label: "Sanctioned", icon: AlertTriangle },
    { id: "unlabelled", label: "Unlabelled", icon: User },
  ];

  return (
    <div className="filter-bar" style={{ display: 'flex', gap: '8px', padding: '12px 20px', background: 'rgba(11, 17, 26, 0.8)', borderBottom: '1px solid var(--border-subtle)', alignItems: 'center' }}>
      <Filter size={14} className="text-muted" />
      <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontWeight: 600, marginRight: '8px' }}>View</span>
      {filters.map(f => {
        const Icon = f.icon;
        const isActive = activeFilter === f.id;
        return (
          <button
            key={f.id}
            onClick={() => onFilterChange(f.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '6px 12px',
              background: isActive ? 'var(--color-primary)' : 'rgba(255,255,255,0.05)',
              border: '1px solid',
              borderColor: isActive ? 'var(--color-primary)' : 'var(--border-subtle)',
              borderRadius: '6px',
              color: isActive ? '#fff' : 'var(--color-text-muted)',
              fontSize: '11px',
              fontWeight: isActive ? 600 : 500,
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            <Icon size={12} />
            {f.label}
          </button>
        );
      })}
    </div>
  );
}
