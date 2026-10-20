import React, { useState } from 'react';
import { ChevronDown, X, Search, ChevronLeft, ChevronRight, Download, Filter, SlidersHorizontal } from 'lucide-react';

// ── Color palette ─────────────────────────────────────────────────────────────
export const C = {
  black: '#000000',
  charcoal: '#464646',
  gray: '#9C9A9A',
  brick: '#A35E47',
  white: '#FFFFFF',
};

// ── Status badge ─────────────────────────────────────────────────────────────
const BADGE_MAP: Record<string, { bg: string; text: string; dot?: string }> = {
  active: { bg: '#F0F0F0', text: '#000000', dot: '#000000' },
  online: { bg: '#F0F0F0', text: '#000000', dot: '#000000' },
  verified: { bg: '#F0F0F0', text: '#000000', dot: '#000000' },
  delivered: { bg: '#F0F0F0', text: '#000000', dot: '#000000' },
  success: { bg: '#F0F0F0', text: '#000000', dot: '#000000' },
  completed: { bg: '#F0F0F0', text: '#000000', dot: '#000000' },
  processed: { bg: '#F0F0F0', text: '#000000', dot: '#000000' },
  resolved: { bg: '#F0F0F0', text: '#000000', dot: '#000000' },
  low: { bg: '#F0F0F0', text: '#464646' },

  pending: { bg: '#FFF8F0', text: '#A35E47', dot: '#A35E47' },
  preparing: { bg: '#FFF8F0', text: '#A35E47', dot: '#A35E47' },
  searching: { bg: '#FFF8F0', text: '#A35E47', dot: '#A35E47' },
  open: { bg: '#FFF8F0', text: '#A35E47', dot: '#A35E47' },
  scheduled: { bg: '#FFF8F0', text: '#A35E47', dot: '#A35E47' },
  monitoring: { bg: '#FFF8F0', text: '#A35E47', dot: '#A35E47' },
  expiring: { bg: '#FFF8F0', text: '#A35E47', dot: '#A35E47' },
  arriving: { bg: '#FFF8F0', text: '#A35E47', dot: '#A35E47' },
  medium: { bg: '#FFF8F0', text: '#A35E47' },
  busy: { bg: '#FFF8F0', text: '#A35E47', dot: '#A35E47' },
  inprogress: { bg: '#FFF8F0', text: '#A35E47', dot: '#A35E47' },
  intransit: { bg: '#F5F5F5', text: '#464646', dot: '#464646' },
  underreview: { bg: '#FFF8F0', text: '#A35E47', dot: '#A35E47' },

  suspended: { bg: '#1A1A1A', text: '#FFFFFF', dot: '#9C9A9A' },
  rejected: { bg: '#1A1A1A', text: '#FFFFFF', dot: '#9C9A9A' },
  failed: { bg: '#1A1A1A', text: '#FFFFFF', dot: '#9C9A9A' },
  cancelled: { bg: '#1A1A1A', text: '#FFFFFF', dot: '#9C9A9A' },
  delayed: { bg: '#1A1A1A', text: '#FFFFFF', dot: '#A35E47' },
  disputed: { bg: '#1A1A1A', text: '#FFFFFF', dot: '#9C9A9A' },
  escalated: { bg: '#1A1A1A', text: '#FFFFFF', dot: '#A35E47' },
  refunded: { bg: '#E8E8E8', text: '#464646' },
  offline: { bg: '#1A1A1A', text: '#FFFFFF', dot: '#9C9A9A' },
  inactive: { bg: '#E8E8E8', text: '#9C9A9A' },
  expired: { bg: '#E8E8E8', text: '#9C9A9A' },
  high: { bg: '#A35E47', text: '#FFFFFF' },
  critical: { bg: '#000000', text: '#FFFFFF' },
  flagged: { bg: '#000000', text: '#FFFFFF' },

  food: { bg: '#000000', text: '#FFFFFF' },
  grocery: { bg: '#464646', text: '#FFFFFF' },
  rides: { bg: '#A35E47', text: '#FFFFFF' },
  courier: { bg: '#9C9A9A', text: '#FFFFFF' },
  comingsoon: { bg: '#F0F0F0', text: '#9C9A9A' },
};

export function Badge({ variant, label, showDot = false }: { variant?: string; label: string; showDot?: boolean }) {
  const key = (variant || label).toLowerCase().replace(/\s+/g, '');
  const style = BADGE_MAP[key] || { bg: '#F0F0F0', text: '#464646' };
  return (
    <span style={{ background: style.bg, color: style.text }}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap">
      {(showDot && style.dot) && (
        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: style.dot }} />
      )}
      {label}
    </span>
  );
}

// ── Service badge ─────────────────────────────────────────────────────────────
export function ServiceBadge({ service }: { service: string }) {
  return <Badge variant={service.toLowerCase()} label={service} />;
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
export function KPICard({
  label, value, sub, highlight = false, trend,
}: {
  label: string; value: string; sub?: string; highlight?: boolean; trend?: string;
}) {
  return (
    <div className="border border-[#E8E8E8] rounded-xl p-4 bg-white min-w-0">
      <p className="text-label mb-2" style={{ color: '#9C9A9A' }}>{label}</p>
      <p className={`text-2xl font-black leading-none tracking-tight font-mono-data ${highlight ? 'text-[#A35E47]' : 'text-black'}`}>
        {value}
      </p>
      {sub && <p className="text-xs mt-1.5" style={{ color: '#9C9A9A' }}>{sub}</p>}
      {trend && (
        <p className={`text-xs mt-1.5 font-semibold ${trend.startsWith('+') ? 'text-[#464646]' : 'text-[#A35E47]'}`}>
          {trend} vs yesterday
        </p>
      )}
    </div>
  );
}

// ── Section header ────────────────────────────────────────────────────────────
export function SectionHeader({ title, subtitle, children }: {
  title: string; subtitle?: string; children?: React.ReactNode
}) {
  return (
    <div className="flex items-end justify-between mb-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-black">{title}</h1>
        {subtitle && <p className="text-sm mt-0.5" style={{ color: '#9C9A9A' }}>{subtitle}</p>}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}

// ── Action button ─────────────────────────────────────────────────────────────
export function Btn({
  children, variant = 'secondary', onClick, icon, small = false, danger = false, disabled = false, className = '',
}: {
  children: React.ReactNode; variant?: 'primary' | 'secondary' | 'ghost'; onClick?: () => void;
  icon?: React.ReactNode; small?: boolean; danger?: boolean; disabled?: boolean; className?: string;
}) {
  const px = small ? 'px-3 py-1.5' : 'px-4 py-2';
  const disabledClasses = disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : 'cursor-pointer';
  const base = `inline-flex items-center gap-1.5 rounded font-semibold transition-all border whitespace-nowrap ${px} ${disabledClasses} ${className}`;
  const text = small ? 'text-xs' : 'text-sm';

  if (danger) return (
    <button type="button" disabled={disabled} onClick={onClick} className={`${base} ${text} bg-[#A35E47] text-white border-[#A35E47] hover:opacity-90`}>
      {icon}{children}
    </button>
  );
  if (variant === 'primary') return (
    <button type="button" disabled={disabled} onClick={onClick} className={`${base} ${text} bg-black text-white border-black hover:opacity-90`}>
      {icon}{children}
    </button>
  );
  if (variant === 'ghost') return (
    <button type="button" disabled={disabled} onClick={onClick} className={`${base} ${text} bg-transparent border-transparent text-[#464646] hover:bg-[#F5F5F5]`}>
      {icon}{children}
    </button>
  );
  return (
    <button type="button" disabled={disabled} onClick={onClick} className={`${base} ${text} bg-white text-black border-[#9C9A9A] hover:border-black`}>
      {icon}{children}
    </button>
  );
}

// ── Filter bar ────────────────────────────────────────────────────────────────
export function FilterBar({ onSearch, filters = [], children }: {
  onSearch?: (v: string) => void;
  filters?: { label: string; options: string[]; value?: string; onChange?: (v: string) => void }[];
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 mb-4 flex-wrap">
      <div className="relative flex-1 min-w-48 max-w-72">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9C9A9A]" />
        <input
          type="search"
          placeholder="Search..."
          onChange={e => onSearch?.(e.target.value)}
          className="w-full pl-8 pr-3 py-1.5 text-sm rounded border border-[#9C9A9A] focus:border-black outline-none"
        />
      </div>
      {filters.map(f => (
        <div key={f.label} className="relative">
          <select
            value={f.value ?? ''}
            onChange={e => f.onChange?.(e.target.value)}
            className="appearance-none pl-3 pr-7 py-1.5 text-sm rounded border border-[#9C9A9A] focus:border-black outline-none bg-white text-black cursor-pointer"
          >
            <option value="">{f.label}</option>
            {f.options.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#9C9A9A]" />
        </div>
      ))}
      <Btn icon={<SlidersHorizontal className="w-3.5 h-3.5" />} small>Filters</Btn>
      <Btn icon={<Download className="w-3.5 h-3.5" />} small>Export</Btn>
      {children}
    </div>
  );
}

// ── Tabs ──────────────────────────────────────────────────────────────────────
export function Tabs({ tabs, active, onChange }: {
  tabs: string[]; active: string; onChange: (t: string) => void
}) {
  return (
    <div className="flex border-b border-[#E8E8E8] mb-6">
      {tabs.map(tab => (
        <button
          key={tab}
          onClick={() => onChange(tab)}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${active === tab
            ? 'border-[#A35E47] text-black'
            : 'border-transparent text-[#9C9A9A] hover:text-[#464646]'
            }`}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}

// ── Data table ────────────────────────────────────────────────────────────────
export function DataTable({ columns, rows, onRowClick }: {
  columns: { key: string; label: string; width?: string }[];
  rows: Record<string, any>[];
  onRowClick?: (row: Record<string, any>) => void;
}) {
  const [page, setPage] = useState(1);
  const perPage = 10;
  const total = rows.length;
  const totalPages = Math.ceil(total / perPage);
  const sliced = rows.slice((page - 1) * perPage, page * perPage);

  return (
    <div>
      <div className="scrollable-x border border-[#E8E8E8] rounded-xl overflow-hidden">
        <table className="rr-table">
          <thead>
            <tr>
              {columns.map(col => (
                <th key={col.key} style={{ width: col.width }}>{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sliced.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="text-center py-12 text-[#9C9A9A] text-sm">
                  No records found
                </td>
              </tr>
            ) : sliced.map((row, i) => (
              <tr key={i}
                onClick={() => onRowClick?.(row)}
                className={onRowClick ? 'cursor-pointer' : ''}
              >
                {columns.map(col => (
                  <td key={col.key}>{row[col.key]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between mt-3">
        <p className="text-xs text-[#9C9A9A]">
          Showing {Math.min((page - 1) * perPage + 1, total)}–{Math.min(page * perPage, total)} of {total} records
        </p>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="p-1.5 rounded border border-[#E8E8E8] disabled:opacity-30 hover:border-black transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            const n = i + 1;
            return (
              <button key={n} onClick={() => setPage(n)}
                className={`w-7 h-7 rounded text-xs font-semibold transition-colors ${n === page ? 'bg-black text-white' : 'text-[#464646] hover:bg-[#F5F5F5]'}`}>
                {n}
              </button>
            );
          })}
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="p-1.5 rounded border border-[#E8E8E8] disabled:opacity-30 hover:border-black transition-colors"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Drawer ────────────────────────────────────────────────────────────────────
export function Drawer({ open, onClose, title, subtitle, badge, children }: {
  open: boolean; onClose: () => void; title: string; subtitle?: string;
  badge?: React.ReactNode; children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <div className="w-[480px] bg-white border-l border-[#E8E8E8] flex flex-col drawer-enter h-full overflow-hidden">
        <div className="flex items-start justify-between p-5 border-b border-[#E8E8E8]">
          <div>
            <div className="flex items-center gap-2 mb-1">{badge}</div>
            <h2 className="text-lg font-black text-black">{title}</h2>
            {subtitle && <p className="text-xs mt-0.5" style={{ color: '#9C9A9A' }}>{subtitle}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-[#F5F5F5] transition-colors">
            <X className="w-4 h-4 text-[#464646]" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-5">{children}</div>
      </div>
    </div>
  );
}

// ── Detail row ────────────────────────────────────────────────────────────────
export function DetailRow({ label, value, mono = false }: {
  label: string; value: React.ReactNode; mono?: boolean;
}) {
  return (
    <div className="flex justify-between items-start gap-4 py-2 border-b border-[#F0F0F0] last:border-0">
      <span className="text-label shrink-0" style={{ color: '#9C9A9A' }}>{label}</span>
      <span className={`text-sm font-medium text-right ${mono ? 'font-mono-data' : ''}`}>{value}</span>
    </div>
  );
}

// ── Section group ─────────────────────────────────────────────────────────────
export function DrawerSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-label mb-3" style={{ color: '#9C9A9A' }}>{title}</p>
      <div>{children}</div>
    </div>
  );
}

// ── Timeline ──────────────────────────────────────────────────────────────────
export function Timeline({ events }: {
  events: { time: string; label: string; detail?: string; status?: 'done' | 'active' | 'pending' }[]
}) {
  return (
    <div className="space-y-0">
      {events.map((e, i) => (
        <div key={i} className="flex gap-3">
          <div className="flex flex-col items-center">
            <div className={`w-2 h-2 rounded-full mt-1 flex-shrink-0 ${e.status === 'active' ? 'bg-[#A35E47]' : e.status === 'pending' ? 'bg-[#E8E8E8]' : 'bg-black'}`} />
            {i < events.length - 1 && <div className="w-px flex-1 bg-[#E8E8E8] my-1" />}
          </div>
          <div className="pb-4">
            <div className="flex items-baseline gap-2">
              <span className="text-xs font-semibold">{e.label}</span>
              <span className="text-xs text-[#9C9A9A]">{e.time}</span>
            </div>
            {e.detail && <p className="text-xs text-[#9C9A9A] mt-0.5">{e.detail}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Alert banner ──────────────────────────────────────────────────────────────
export function AlertBanner({ type = 'warning', children }: {
  type?: 'warning' | 'error' | 'info'; children: React.ReactNode
}) {
  const styles = {
    warning: { bg: '#FFF8F0', border: '#A35E47', text: '#A35E47' },
    error: { bg: '#1A1A1A', border: '#000000', text: '#FFFFFF' },
    info: { bg: '#F5F5F5', border: '#9C9A9A', text: '#464646' },
  }[type];
  return (
    <div style={{ background: styles.bg, borderColor: styles.border, color: styles.text }}
      className="border rounded-lg px-4 py-3 text-sm font-medium">
      {children}
    </div>
  );
}

// ── Stat group (for analytics) ────────────────────────────────────────────────
export function StatGroup({ items }: {
  items: { label: string; value: string; change?: string; highlight?: boolean }[]
}) {
  return (
    <div className="grid grid-cols-2 gap-4">
      {items.map(item => (
        <div key={item.label} className="border border-[#E8E8E8] rounded-xl p-4">
          <p className="text-label mb-1" style={{ color: '#9C9A9A' }}>{item.label}</p>
          <p className={`text-xl font-black font-mono-data tracking-tight ${item.highlight ? 'text-[#A35E47]' : 'text-black'}`}>
            {item.value}
          </p>
          {item.change && (
            <p className={`text-xs mt-1 font-semibold ${item.change.startsWith('+') ? 'text-[#464646]' : 'text-[#A35E47]'}`}>
              {item.change}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
export function EmptyState({ message = 'No records found', sub }: { message?: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-12 h-12 rounded-full border-2 border-[#E8E8E8] flex items-center justify-center mb-4">
        <Search className="w-5 h-5 text-[#9C9A9A]" />
      </div>
      <p className="text-sm font-semibold text-[#464646]">{message}</p>
      {sub && <p className="text-xs text-[#9C9A9A] mt-1">{sub}</p>}
    </div>
  );
}

// ── Chart card wrapper ────────────────────────────────────────────────────────
export function ChartCard({ title, children, action }: {
  title: string; children: React.ReactNode; action?: React.ReactNode
}) {
  return (
    <div className="border border-[#E8E8E8] rounded-xl p-5 bg-white">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-bold text-black">{title}</p>
        {action}
      </div>
      {children}
    </div>
  );
}

// ── Live indicator ────────────────────────────────────────────────────────────
export function LiveDot() {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: '#A35E47' }}>
      <span className="w-1.5 h-1.5 rounded-full bg-[#A35E47] live-dot" />
      LIVE
    </span>
  );
}

// ── Permission row ────────────────────────────────────────────────────────────
export function PermRow({ module, perms }: {
  module: string;
  perms: Record<string, boolean>;
}) {
  const keys = Object.keys(perms);
  return (
    <tr className="border-b border-[#F0F0F0]">
      <td className="py-3 px-4 text-sm font-medium text-black">{module}</td>
      {keys.map(k => (
        <td key={k} className="py-3 px-4 text-center">
          {perms[k] ? (
            <span className="inline-block w-5 h-5 rounded bg-black text-white text-xs flex items-center justify-center">✓</span>
          ) : (
            <span className="inline-block w-5 h-5 rounded bg-[#F0F0F0] text-[#9C9A9A] text-xs flex items-center justify-center">—</span>
          )}
        </td>
      ))}
    </tr>
  );
}

// ── Metric row (for finance) ──────────────────────────────────────────────────
export function MetricRow({ label, value, sub, accent = false }: {
  label: string; value: string; sub?: string; accent?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-[#F0F0F0] last:border-0">
      <div>
        <p className="text-sm font-medium text-black">{label}</p>
        {sub && <p className="text-xs text-[#9C9A9A]">{sub}</p>}
      </div>
      <p className={`text-sm font-black font-mono-data ${accent ? 'text-[#A35E47]' : 'text-black'}`}>{value}</p>
    </div>
  );
}
