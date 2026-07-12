import { type ReactNode, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TopActionPanel } from './TopActionPanel';
import { AmbientConsole } from './AmbientConsole';
import { SpotlightOverlay } from './ui/SpotlightOverlay';
import { ToastContainer } from './ui/ToastContainer';
import { useNavStore, useThemeStore, useSystemStore } from '../lib/themeStoreIntegration';
import {
  LayoutDashboard, FileText, Clapperboard, Captions,
  CalendarClock, Globe, Users, BarChart3, Settings, Menu, X,
} from 'lucide-react';

export type ModuleId =
  | 'cockpit' | 'scriptlab' | 'studio' | 'captions'
  | 'schedule' | 'worldbuilder' | 'characters' | 'analytics' | 'settings';

const NAV_ITEMS: { id: ModuleId; label: string; icon: typeof LayoutDashboard; desc: string }[] = [
  { id: 'cockpit', label: 'Cockpit', icon: LayoutDashboard, desc: 'Master control' },
  { id: 'scriptlab', label: 'Script Lab', icon: FileText, desc: 'Script generator' },
  { id: 'studio', label: 'Studio', icon: Clapperboard, desc: 'Production pipeline' },
  { id: 'captions', label: 'Captions', icon: Captions, desc: 'Metadata & tags' },
  { id: 'schedule', label: 'Schedule', icon: CalendarClock, desc: 'Auto-publish queue' },
  { id: 'worldbuilder', label: 'World Builder', icon: Globe, desc: 'Series & lore' },
  { id: 'characters', label: 'Characters', icon: Users, desc: 'Face & voice lock' },
  { id: 'analytics', label: 'Analytics', icon: BarChart3, desc: 'Performance metrics' },
  { id: 'settings', label: 'Settings', icon: Settings, desc: 'Schema matrix' },
];

function applyThemeCSSVars(accent: string, radius: number, fontSize: number) {
  const root = document.documentElement;
  root.style.setProperty('--accent', accent);
  root.style.setProperty('--accent-glow', hexToRgba(accent, 0.25));
  root.style.setProperty('--accent-dim', hexToRgba(accent, 0.08));
  root.style.setProperty('--radius', `${radius}px`);
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
    <div className="relative min-h-screen flex overflow-x-hidden bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <ToastContainer />
      <SpotlightOverlay />

      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 bg-zinc-900/50 backdrop-blur-sm lg:hidden" onClick={() => setMobileNavOpen(false)} />
      )}

      <aside
        className={`fixed lg:sticky top-0 left-0 z-50 lg:z-10 h-screen w-[240px] shrink-0 flex-col bg-zinc-50 dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-900 transition-transform duration-200 ${
          mobileNavOpen ? 'flex translate-x-0' : '-translate-x-full lg:flex lg:translate-x-0'
        } ${zenMode ? 'hidden lg:hidden' : 'flex'}`}
      >
        <div className="flex items-center gap-2.5 px-4 py-4 border-b border-zinc-200 dark:border-zinc-900">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-zinc-900 dark:bg-zinc-100">
            <Clapperboard size={15} className="text-zinc-50 dark:text-zinc-900" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 leading-tight">ContentOps</h1>
            <p className="text-[10px] text-zinc-400 leading-tight">Production Dashboard</p>
          </div>
          <button onClick={() => setMobileNavOpen(false)} className="lg:hidden text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">
            <X size={16} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeModule === item.id;
            return (
              <button
                key={item.id}
                onClick={() => { setActiveModule(item.id); setMobileNavOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900'
                    : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                <Icon size={15} className="shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="block truncate">{item.label}</span>
                </div>
                {systemBadges[item.id] && (
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                )}
              </button>
            );
          })}
        </nav>

        <div className="px-4 py-3 border-t border-zinc-200 dark:border-zinc-900">
          <p className="text-[10px] text-zinc-400 font-mono">v2.1 · Secure</p>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 min-h-screen overflow-x-hidden">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 px-4 sm:px-6 py-3 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-200 dark:border-zinc-900">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => setMobileNavOpen(true)} className="lg:hidden text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
              <Menu size={18} />
            </button>
            <AnimatePresence mode="wait">
              <motion.div
                key={activeModule}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
                className="min-w-0"
              >
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">{activeItem?.label}</h2>
                <p className="text-[10px] text-zinc-400 truncate hidden sm:block">{activeItem?.desc}</p>
              </motion.div>
            </AnimatePresence>
          </div>
          <TopActionPanel />
        </header>

        <main className="flex-1 px-4 sm:px-6 py-5 pb-32 relative z-10 overflow-x-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeModule}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="max-w-[1200px] mx-auto"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>

        <div className="fixed bottom-0 left-0 right-0 lg:left-[240px] z-20 px-4 sm:px-6 pb-4">
          <AmbientConsole />
        </div>
      </div>
    </div>
  );
}
