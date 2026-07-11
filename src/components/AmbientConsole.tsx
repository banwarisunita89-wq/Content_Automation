import { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLogsQuery, useAddLogMutation, useResolveLogMutation } from '../lib/queries';
import { Terminal, ChevronDown, ChevronUp, RotateCw } from 'lucide-react';

const LEVEL_COLORS: Record<string, string> = {
  info: 'text-accent',
  success: 'text-success',
  warning: 'text-warning',
  error: 'text-danger',
  debug: 'text-ink-400',
};

export function AmbientConsole() {
  const { data: logs = [] } = useLogsQuery(60);
  const addLog = useAddLogMutation();
  const resolveLog = useResolveLogMutation();
  const [expanded, setExpanded] = useState(true);
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [logs, autoScroll]);

  async function handleRetry(id: string, source: string, message: string) {
    await addLog.mutateAsync({ level: 'info', source, message: `Retrying: ${message}`, details: {}, retryable: false, resolved: false });
    await resolveLog.mutateAsync(id);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-panel overflow-hidden flex flex-col"
      style={{ height: expanded ? '280px' : '44px' }}
    >
      <div
        className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.04] cursor-pointer hover:bg-white/[0.02] transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2.5">
          <Terminal size={14} className="text-accent" />
          <span className="text-xs font-semibold text-ink-100">Ambient Backend Stream</span>
          <span className="text-[10px] text-ink-400 font-mono">{logs.length} entries</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); setAutoScroll(!autoScroll); }}
            className={`text-[10px] px-2 py-1 rounded-md font-mono transition-colors ${autoScroll ? 'text-accent bg-accent-dim' : 'text-ink-400 bg-white/[0.04]'}`}
          >
            AUTO
          </button>
          {expanded ? <ChevronDown size={14} className="text-ink-400" /> : <ChevronUp size={14} className="text-ink-400" />}
        </div>
      </div>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-4 py-2 font-mono text-[11px] leading-relaxed grid-bg custom-scrollbar"
          >
            {logs.length === 0 ? (
              <div className="text-ink-400">No activity yet. System idle.</div>
            ) : (
              logs.map((log) => (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: log.resolved ? 0.4 : 1, x: 0 }}
                  className="flex items-start gap-2 py-0.5"
                >
                  <span className="text-ink-500 shrink-0">{new Date(log.created_at).toLocaleTimeString('en-US', { hour12: false })}</span>
                  <span className={`shrink-0 font-semibold ${LEVEL_COLORS[log.level] || 'text-ink-300'}`}>[{log.level.toUpperCase()}]</span>
                  <span className="text-ink-400 shrink-0">{log.source}:</span>
                  <span className="text-ink-100 flex-1">{log.message}</span>
                  {log.retryable && !log.resolved && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleRetry(log.id, log.source, log.message); }}
                      className="shrink-0 text-warning hover:text-warning/80 transition-colors flex items-center gap-1"
                    >
                      <RotateCw size={10} /> Retry
                    </button>
                  )}
                  {log.resolved && <span className="shrink-0 text-success text-[10px]">RESOLVED</span>}
                </motion.div>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
