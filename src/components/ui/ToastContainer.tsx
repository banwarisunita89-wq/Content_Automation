import { AnimatePresence, motion } from 'framer-motion';
import { useToastStore } from '../../lib/stores';
import { CheckCircle2, AlertTriangle, Info, XCircle, Loader2 } from 'lucide-react';

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const removeToast = useToastStore((s) => s.removeToast);

  const icons = {
    success: <CheckCircle2 size={16} className="text-success" />,
    warning: <AlertTriangle size={16} className="text-warning" />,
    error: <XCircle size={16} className="text-danger" />,
    info: <Info size={16} className="text-accent" />,
  };

  return (
    <div className="fixed top-20 right-4 z-[70] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, x: 40, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40, scale: 0.9 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="glass-panel px-4 py-3 flex items-center gap-2.5 pointer-events-auto min-w-[260px] max-w-[360px]"
          >
            {toast.attempt ? <Loader2 size={16} className="text-warning animate-spin" /> : icons[toast.type]}
            <span className="text-xs text-ink-100 flex-1">{toast.message}</span>
            <button onClick={() => removeToast(toast.id)} className="text-ink-500 hover:text-ink-200 text-xs">×</button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
