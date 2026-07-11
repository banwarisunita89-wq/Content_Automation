import { type ReactNode } from 'react';

export function Panel({
  children,
  className = '',
  title,
  icon,
  action,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className={`glass-panel glass-panel-hover ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.04]">
          <div className="flex items-center gap-2.5">
            {icon && <span className="text-accent">{icon}</span>}
            {title && <h3 className="text-sm font-semibold text-ink-100">{title}</h3>}
          </div>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

export function StatusDot({ status }: { status: 'online' | 'offline' | 'warning' | 'idle' }) {
  const colors = {
    online: 'bg-success',
    offline: 'bg-danger',
    warning: 'bg-warning',
    idle: 'bg-ink-400',
  };
  return (
    <span className={`status-dot ${colors[status]} ${status === 'online' ? 'animate-pulse-glow' : ''}`} />
  );
}

export function Badge({
  children,
  variant = 'neutral',
}: {
  children: ReactNode;
  variant?: 'neutral' | 'success' | 'warning' | 'danger' | 'accent';
}) {
  const styles = {
    neutral: 'bg-white/[0.06] text-ink-200',
    success: 'bg-success-dim text-success',
    warning: 'bg-warning-dim text-warning',
    danger: 'bg-danger-dim text-danger',
    accent: 'bg-accent-dim text-accent',
  };
  return <span className={`chip ${styles[variant]}`}>{children}</span>;
}

export function ProgressBar({ value, max = 100, className = '' }: { value: number; max?: number; className?: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className={`h-1.5 rounded-full bg-white/[0.06] overflow-hidden ${className}`}>
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, background: 'linear-gradient(90deg, var(--accent), color-mix(in srgb, var(--accent) 50%, #fff))' }}
      />
    </div>
  );
}

export function Spinner({ size = 16 }: { size?: number }) {
  return (
    <svg
      className="animate-spin"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      style={{ animationDuration: '0.6s' }}
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function EmptyState({ icon, title, subtitle }: { icon?: ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      {icon && <div className="mb-3 text-ink-400">{icon}</div>}
      <p className="text-sm font-medium text-ink-200">{title}</p>
      {subtitle && <p className="text-xs text-ink-400 mt-1">{subtitle}</p>}
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2.5 cursor-pointer group"
    >
      <span
        className={`relative w-9 h-5 rounded-full transition-all duration-200 ${
          checked ? 'bg-accent' : 'bg-ink-600'
        }`}
        style={checked ? { boxShadow: '0 0 12px var(--accent-glow)' } : {}}
      >
        <span
          className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all duration-200 ${
            checked ? 'left-[18px]' : 'left-0.5'
          }`}
        />
      </span>
      {label && <span className="text-xs text-ink-200 group-hover:text-ink-100 transition-colors">{label}</span>}
    </button>
  );
}
