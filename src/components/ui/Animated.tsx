import { motion, type HTMLMotionProps } from 'framer-motion';
import { type ReactNode } from 'react';

export function MotionPanel({ children, className = '', ...props }: HTMLMotionProps<'div'> & { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className={`glass-panel glass-panel-hover ${className}`}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function MotionButton({ children, className = '', ...props }: HTMLMotionProps<'button'> & { children: ReactNode }) {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.95 }}
      transition={{ duration: 0.15 }}
      className={className}
      {...props}
    >
      {children}
    </motion.button>
  );
}

export function MotionModal({ children, onClose }: { children: ReactNode; onClose?: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        className="glass-panel w-full max-w-2xl p-6 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

export function SubTabs({ tabs, activeTab, onTabChange }: { tabs: { id: string; label: string }[]; activeTab: string; onTabChange: (id: string) => void }) {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide pb-1 mb-4">
      {tabs.map((tab) => (
        <motion.button
          key={tab.id}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.96 }}
          onClick={() => onTabChange(tab.id)}
          className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-200 ${
            activeTab === tab.id
              ? 'text-black'
              : 'text-ink-300 bg-white/[0.04] border border-white/[0.06] hover:text-ink-100'
          }`}
          style={activeTab === tab.id ? { background: 'var(--accent)', boxShadow: '0 0 16px var(--accent-glow)' } : {}}
        >
          {tab.label}
        </motion.button>
      ))}
    </div>
  );
}

export function FeatureToggleRow({ toggle, enabled, onToggle }: { toggle: { id: string; label: string; description: string }; enabled: boolean; onToggle: () => void }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
      <div className="min-w-0">
        <p className="text-xs font-medium text-ink-100">{toggle.label}</p>
        <p className="text-[10px] text-ink-400 mt-0.5">{toggle.description}</p>
      </div>
      <button onClick={onToggle} className={`relative w-9 h-5 rounded-full transition-all shrink-0 ml-3 ${enabled ? 'bg-accent' : 'bg-ink-600'}`} style={enabled ? { boxShadow: '0 0 12px var(--accent-glow)' } : {}}>
        <motion.span className="absolute top-0.5 w-4 h-4 rounded-full bg-white" animate={{ left: enabled ? 18 : 2 }} transition={{ duration: 0.2 }} />
      </button>
    </div>
  );
}
