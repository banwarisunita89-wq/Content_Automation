import { type ReactNode, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TopActionPanel } from './TopActionPanel';
import { AmbientConsole } from './AmbientConsole';
import { SpotlightOverlay } from './ui/SpotlightOverlay';
import { ToastContainer } from './ui/ToastContainer';
import { useNavStore, useThemeStore, useSystemStore } from '../lib/themeStoreIntegration';
import {
  LayoutDashboard, FileText, Clapperboard, Captions,
  CalendarClock, Globe, Users, BarChart3, KeyRound, Menu, X,
} from 'lucide-react';

export type ModuleId =
  | 'cockpit' | 'scriptlab' | 'studio' | 'captions'
  | 'schedule' | 'worldbuilder' | 'characters' | 'analytics' | 'settings';

const NAV_ITEMS: { id: ModuleId; label: string; icon: typeof LayoutDashboard; desc: string }[] = [
  { id: 'cockpit', label: 'The Cockpit', icon: LayoutDashboard, desc: '10-min master control' },
  { id: 'scriptlab', label: 'Script Lab', icon: FileText, desc: 'Viral generator engine' },
  { id: 'studio', label: 'Production Studio', icon: Clapperboard, desc: 'Pipeline synthesizer' },
  { id: 'captions', label: 'Caption Production', icon: Captions, desc: 'Visual asset enhancer' },
  { id: 'schedule', label: 'Schedule & Auto', icon: CalendarClock, desc: 'Automation engine' },
  { id: 'worldbuilder', label: 'World Builder', icon: Globe, desc: 'Global context matrix' },
  { id: 'characters', label: 'Character World', icon: Users, desc: 'Facial sync registry' },
  { id: 'analytics', label: 'Analytics Engine', icon: BarChart3, desc: '50+ factor tracking' },
  { id: 'settings', label: 'Settings & Vault', icon: KeyRound, desc: 'API keys & customization' },
];

function applyThemeCSSVars(accent: string, radius: number, fontSize: number) {
  const root = document.documentElement;
  root.style.setProperty('--accent', accent);
  root.style.setProperty('--accent-glow', hexToRgba(accent, 0.35));
  root.style.setProperty('--accent-dim', hexToRgba(accent, 0.12));
  root.style.setProperty('--radius', `${radius}px`);
  root.style.setProperty('--bg-grad-1', hexToRgba(accent, 0.04));
  document.body.style.fontSize = `${fontSize}px`;
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function Layout({ children }: { children: ReactNode }) {
  const activeModule = useNavStore((s) => s.activeModule);
  const setActiveModule = useNavStore((s) => s.setActiveModule);
  const theme = useThemeStore();
  const zenMode = useSystemStore((s) => s.zenMode);
  const systemBadges = useSystemStore((s) => s.systemBadges);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    applyThemeCSSVars(theme.accent, theme.radius, theme.fontSize);
  }, [theme.accent, theme.radius, theme.fontSize]);

  const activeItem = NAV_ITEMS.find((n) => n.id === activeModule);

  return (
    <div className="relative min-h-screen flex">
      <ToastContainer />
      <SpotlightOverlay />

      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden" onClick={() => setMobileNavOpen(false)} />
      )}

      <aside
        className={`fixed lg:sticky top-0 left-0 z-50 lg:z-10 h-screen w-[260px] shrink-0 flex-col bg-ink-900/80 backdrop-blur-2xl border-r border-white/[0.04] transition-transform duration-300 ${
          mobileNavOpen ? 'flex translate-x-0' : '-translate-x-full lg:flex lg:translate-x-0'
        } ${zenMode ? 'hidden lg:hidden' : 'flex'}`}
      >
        <div className="flex items-center gap-3 px-5 py-5 border-b border-white/[0.04]">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="relative w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 50%, #000))' }}
          >
            <Clapperboard size={18} className="text-black" />
            <span className="absolute -inset-0.5 rounded-xl opacity-50 animate-pulse-glow" style={{ boxShadow: '0 0 16px var(--accent-glow)' }} />
          </motion.div>
          <div>
            <h1 className="text-sm font-bold text-ink-50 leading-tight">ContentOps</h1>
            <p className="text-[10px] text-ink-400 leading-tight">Automation Dashboard</p>
          </div>
          <button onClick={() => setMobileNavOpen(false)} className="ml-auto lg:hidden text-ink-400 hover:text-ink-100">
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1 scrollbar-hide">
          {NAV_ITEMS.map((item, idx) => {
            const Icon = item.icon;
            const active = activeModule === item.id;
            return (
              <motion.button
                key={item.id}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.04 }}
                whileHover={{ x: 3 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => { setActiveModule(item.id); setMobileNavOpen(false); }}
                className={`nav-item w-full text-left ${active ? 'active' : ''}`}
              >
                <Icon size={17} className="shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="block truncate">{item.label}</span>
                  <span className="block text-[10px] text-ink-400 truncate">{item.desc}</span>
                </div>
                {systemBadges[item.id] && (
                  <span className="w-2 h-2 rounded-full bg-accent animate-pulse-glow shrink-0" style={{ boxShadow: '0 0 8px var(--accent-glow)' }} />
                )}
              </motion.button>
            );
          })}
        </nav>

        <div className="px-5 py-3 border-t border-white/[0.04]">
          <p className="text-[10px] text-ink-500 font-mono">v2.0 · Zero-Cost Framework</p>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 px-4 sm:px-6 py-3 bg-ink-950/70 backdrop-blur-2xl border-b border-white/[0.04]">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => setMobileNavOpen(true)} className="lg:hidden text-ink-300 hover:text-ink-100">
              <Menu size={20} />
            </button>
            <AnimatePresence mode="wait">
              <motion.div
                key={activeModule}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="min-w-0"
              >
                <h2 className="text-sm font-semibold text-ink-50 truncate">{activeItem?.label}</h2>
                <p className="text-[10px] text-ink-400 truncate hidden sm:block">{activeItem?.desc}</p>
              </motion.div>
            </AnimatePresence>
          </div>
          <TopActionPanel />
        </header>

        <main className="flex-1 px-4 sm:px-6 py-5 pb-32 relative z-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeModule}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="max-w-[1400px] mx-auto"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>

        <div className="fixed bottom-0 left-0 right-0 lg:left-[260px] z-20 px-4 sm:px-6 pb-4">
          <AmbientConsole />
        </div>
      </div>
    </div>
  );
}
