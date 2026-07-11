import { AnimatePresence, motion } from 'framer-motion';
import { useNavStore } from '../../lib/stores';
import { useEffect } from 'react';
import { X, ArrowRight } from 'lucide-react';

export function SpotlightOverlay() {
  const spotlight = useNavStore((s) => s.spotlight);
  const clearSpotlight = useNavStore((s) => s.clearSpotlight);

  useEffect(() => {
    if (!spotlight) return;
    const el = document.querySelector(spotlight.selector);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('spotlight-pulse');
      return () => { el.classList.remove('spotlight-pulse'); };
    }
  }, [spotlight]);

  return (
    <AnimatePresence>
      {spotlight && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at center, transparent 200px, rgba(0,0,0,0.65) 100%)' }}
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute bottom-8 left-1/2 -translate-x-1/2 pointer-events-auto"
          >
            <div className="glass-panel px-5 py-3.5 flex items-center gap-3" style={{ boxShadow: '0 0 32px var(--accent-glow)' }}>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'var(--accent)' }}>
                <ArrowRight size={16} className="text-black" />
              </div>
              <div>
                <p className="text-sm font-semibold text-ink-50">{spotlight.label}</p>
                <p className="text-[10px] text-ink-400">Click the highlighted button to continue</p>
              </div>
              <button onClick={clearSpotlight} className="ml-2 text-ink-400 hover:text-ink-100">
                <X size={16} />
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
