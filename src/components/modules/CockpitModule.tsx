// --- src/modules/CockpitModule.tsx ---
import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2, Circle, Clock, Activity, Zap, AlertTriangle, AlertOctagon,
  Headphones, Timer, Sparkles, RotateCw, FileText, Eye, Gauge, ChevronDown, Plus,
} from 'lucide-react';

import {
  useSystemStore, useActiveStore, useNavStore, useToastStore, useScriptStore, useBackendStatusStore
} from '../../lib/stores';
import { COCKPIT_FEATURES, TIMELINE_STAGES } from '../../lib/featuresConfig';
import {
  useTasksQuery, useCreateTaskMutation, useUpdateTaskMutation,
  useEpisodesQuery, useUpdateEpisodeMutation, useLogsQuery,
  useResolveLogMutation, useAddLogMutation,
} from '../../lib/queries';
import { MotionPanel, MotionButton, FeatureToggleRow } from '../ui/Animated';
import { Panel, StatusDot, Badge, ProgressBar, Spinner, EmptyState } from '../ui/Primitives';
import type { Episode, Task, LogEntry } from '../../lib/supabase';

const DAILY_TARGET = 3;

export function CockpitModule({ seriesId }: { seriesId: string | null }) {
  const setActiveEpisode = useActiveStore((s) => s.setActiveEpisode);
  const setActiveModule = useNavStore((s) => s.setActiveModule);
  const addToast = useToastStore((s) => s.addToast);
  const setScript = useScriptStore((s) => s.setScript);
  const setActiveVariantIndex = useScriptStore((s) => s.setActiveVariant);

  // SECURE BACKEND STATUS READ
  const backendStatus = useBackendStatusStore((s) => s.status);
  
  const panicActive = useSystemStore((s) => s.panicActive);
  const zenMode = useSystemStore((s) => s.zenMode);
  const timelineStage = useSystemStore((s) => s.timelineStage);
  const timeSavedMinutes = useSystemStore((s) => s.timeSavedMinutes);
  const systemBadges = useSystemStore((s) => s.systemBadges);
  const triggerPanic = useSystemStore((s) => s.triggerPanic);
  const toggleZen = useSystemStore((s) => s.toggleZen);

  const { data: tasks = [], isLoading: tasksLoading } = useTasksQuery();
  const createTaskMut = useCreateTaskMutation();
  const updateTaskMut = useUpdateTaskMutation();

  const { data: episodes = [], isLoading: episodesLoading } = useEpisodesQuery(seriesId);
  const updateEpisodeMut = useUpdateEpisodeMutation();

  const { data: logs = [], isLoading: logsLoading } = useLogsQuery(50);
  const resolveLogMut = useResolveLogMutation();
  const addLogMut = useAddLogMutation();

  const [variantDropdownFor, setVariantDropdownFor] = useState<string | null>(null);

  const checklist = useMemo(() => tasks.filter((t) => t.type === 'daily' || t.type === 'checklist'), [tasks]);
  const todayCompleted = useMemo(() => checklist.filter((t) => t.status === 'completed').length, [checklist]);
  const completionPct = Math.min(100, Math.round((todayCompleted / DAILY_TARGET) * 100));

  const approvalQueue = useMemo(() => episodes.filter((e) => e.status === 'draft' || e.status === 'pending_review').slice(0, 5), [episodes]);
  const renderQueue = useMemo(() => episodes.filter((e) => e.status === 'rendering' || e.status === 'queued'), [episodes]);
  const scriptVariants = useMemo(() => episodes.filter((e) => Array.isArray(e.script_variants) && e.script_variants.length > 1), [episodes]);
  const errorLogs = useMemo(() => logs.filter((l) => l.level === 'error' && !l.resolved && l.retryable), [logs]);

  // Using Secure Status Check
  const apiHealth = useMemo(() => [
    { key: 'gemini', name: 'Gemini', latency: 240, configured: backendStatus.gemini },
    { key: 'fal', name: 'Fal', latency: 380, configured: backendStatus.fal },
    { key: 'elevenlabs', name: 'ElevenLabs', latency: 320, configured: backendStatus.elevenlabs },
    { key: 'supabase', name: 'Supabase', latency: 45, configured: backendStatus.supabase },
  ], [backendStatus]);

  function toggleChecklistItem(task: Task) {
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    updateTaskMut.mutate(
      { id: task.id, updates: { status: newStatus, completed_at: newStatus === 'completed' ? new Date().toISOString() : null } },
      { onSuccess: () => addToast(newStatus === 'completed' ? 'Task completed' : 'Task reopened', newStatus === 'completed' ? 'success' : 'info') }
    );
  }

  function addQuickTask() {
    createTaskMut.mutate({ title: 'New review task', type: 'daily', status: 'pending' }, { onSuccess: () => addToast('Task added to checklist', 'success') });
  }

  function approveEpisode(ep: Episode) {
    updateEpisodeMut.mutate({ id: ep.id, updates: { status: 'approved' } }, { onSuccess: () => addToast(`Episode ${ep.episode_number} approved for production`, 'success') });
  }

  function retryLog(log: LogEntry) {
    addLogMut.mutate({ level: 'info', source: log.source, message: `Retrying: ${log.message}`, details: log.details, retryable: false, resolved: false }, { onSuccess: () => { resolveLogMut.mutate(log.id); addToast(`Retry dispatched`, 'info'); } });
  }

  function switchVariant(ep: Episode, variantIndex: number) {
    updateEpisodeMut.mutate({ id: ep.id, updates: { active_variant_index: variantIndex } }, {
      onSuccess: () => {
        const variant = ep.script_variants?.[variantIndex] ?? null;
        if (variant) setScript(variant);
        setActiveVariantIndex(variantIndex);
        setActiveEpisode(ep.id);
        addToast(`Switched to variant ${variantIndex + 1}`, 'success');
        setVariantDropdownFor(null);
      }
    });
  }

  function focusEpisode(ep: Episode) {
    setActiveEpisode(ep.id);
    setActiveModule('scriptlab');
  }

  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - todayCompleted / DAILY_TARGET);

  return (
    <div className="space-y-4">
      <MotionPanel className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gradient mb-1">Daily Master Control</h2>
          <p className="text-sm text-ink-300">Complete your production workflow in under 10 minutes.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-accent">{todayCompleted}/{DAILY_TARGET}</div>
            <div className="text-[10px] text-ink-400 uppercase tracking-wide">Today's Progress</div>
          </div>
          <div className="w-px h-10 bg-white/[0.06]" />
          <div className="text-center">
            <div className="text-2xl font-bold text-success">{completionPct}%</div>
            <div className="text-[10px] text-ink-400 uppercase tracking-wide">Goal Met</div>
          </div>
        </div>
        <MotionButton
          onClick={() => { if (window.confirm('Halt all active rendering and publishing queues?')) triggerPanic(); }}
          className="relative flex items-center gap-2 px-3 py-2 rounded-lg border shrink-0"
          style={{ borderColor: panicActive ? '#ff0033' : 'rgba(255,0,51,0.4)', background: panicActive ? 'rgba(255,0,51,0.18)' : 'rgba(255,0,51,0.06)', boxShadow: panicActive ? '0 0 22px rgba(255,0,51,0.55)' : '0 0 10px rgba(255,0,51,0.15)' }}
        >
          <motion.span animate={panicActive ? { scale: [1, 1.25, 1] } : { scale: 1 }} transition={panicActive ? { duration: 0.9, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.2 }}>
            <AlertOctagon className="w-4 h-4" style={{ color: '#ff4d6d' }} />
          </motion.span>
          <span className="text-[11px] font-bold" style={{ color: '#ff4d6d' }}>{panicActive ? 'PANIC ACTIVE' : 'PANIC'}</span>
        </MotionButton>
      </MotionPanel>

      <div data-spotlight="timeline-anchor" className="relative px-4 py-3 rounded-xl border border-white/[0.04] bg-white/[0.02]">
        <div className="flex items-center justify-between">
          {TIMELINE_STAGES.map((stage, idx) => {
            const completed = idx < timelineStage;
            const current = idx === timelineStage;
            const dim = idx > timelineStage;
            return (
              <div key={stage.id} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center gap-1.5 shrink-0">
                  <motion.div
                    className="w-7 h-7 rounded-full flex items-center justify-center border"
                    style={{ borderColor: completed || current ? 'var(--accent)' : 'rgba(255,255,255,0.12)', background: completed ? 'var(--accent)' : current ? 'rgba(0,212,255,0.15)' : 'transparent', boxShadow: completed ? '0 0 14px var(--accent-glow)' : current ? '0 0 18px var(--accent-glow)' : 'none' }}
                    animate={current ? { scale: [1, 1.18, 1] } : { scale: 1 }}
                    transition={current ? { duration: 1.4, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.2 }}
                  >
                    {completed ? <CheckCircle2 className="w-4 h-4 text-ink-900" /> : <span className="text-[10px] font-bold" style={{ color: dim ? 'rgba(255,255,255,0.3)' : 'var(--accent)' }}>{idx + 1}</span>}
                  </motion.div>
                  <span className="text-[10px] font-medium" style={{ color: dim ? 'rgba(255,255,255,0.3)' : current ? 'var(--accent)' : 'var(--ink-100)' }}>{stage.label}</span>
                </div>
                {idx < TIMELINE_STAGES.length - 1 && (
                  <div className="flex-1 h-px mx-2 relative">
                    <div className="absolute inset-0 bg-white/[0.06]" />
                    <motion.div className="absolute inset-y-0 left-0" style={{ background: 'var(--accent)', boxShadow: '0 0 8px var(--accent-glow)' }} animate={{ width: completed ? '100%' : '0%' }} transition={{ duration: 0.4 }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-stretch gap-3 flex-wrap">
        <MotionPanel className="flex-1 min-w-[220px]">
          <div className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2"><Headphones className="w-4 h-4 text-accent" /><span className="text-xs font-semibold text-ink-100">Zen Mode</span></div>
              <MotionButton onClick={toggleZen} className="text-[11px]">{zenMode ? 'Exit' : 'Enter'}</MotionButton>
            </div>
            <AnimatePresence>
              {zenMode && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <div className="mt-2 p-3 rounded-lg bg-white/[0.03] border border-white/[0.06] flex items-center gap-2">
                    <Headphones className="w-3.5 h-3.5 text-accent shrink-0" />
                    <span className="text-[10px] text-ink-300">Lofi Stream</span>
                    <div className="flex-1 h-6 rounded bg-gradient-to-r from-accent/20 to-transparent flex items-center px-2 gap-1">
                      {[...Array(8)].map((_, i) => <motion.span key={i} className="w-0.5 bg-accent rounded-full" animate={{ height: [4, 14, 4] }} transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.1 }} />)}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </MotionPanel>

        <MotionPanel className="flex-1 min-w-[220px]">
          <div className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(34,224,120,0.12)', boxShadow: '0 0 16px rgba(34,224,120,0.25)' }}>
              <Sparkles className="w-5 h-5" style={{ color: '#22e078' }} />
            </div>
            <div className="min-w-0">
              <p className="text-lg font-bold text-ink-100 leading-none">{(timeSavedMinutes / 60).toFixed(1)}h</p>
              <p className="text-[10px] text-ink-400 mt-1">Hours saved today vs manual editing</p>
            </div>
            <Timer className="w-4 h-4 text-ink-500 ml-auto shrink-0" />
          </div>
        </MotionPanel>
      </div>

      {Object.keys(systemBadges).length > 0 && (
        <MotionPanel>
          <div className="p-3 flex items-center gap-3 flex-wrap">
            <span className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider">Active API Activity</span>
            <div className="flex items-center gap-2 flex-wrap">
              {Object.entries(systemBadges).map(([mod, active]) =>
                active ? (
                  <span key={mod} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-white/[0.04] border border-white/[0.06]">
                    <motion.span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--accent)', boxShadow: '0 0 8px var(--accent-glow)' }} animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.2, repeat: Infinity }} />
                    <span className="text-[10px] text-ink-200 capitalize">{mod}</span>
                  </span>
                ) : null
              )}
            </div>
          </div>
        </MotionPanel>
      )}

      <AnimatePresence>
        {panicActive && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 pointer-events-none" style={{ background: 'radial-gradient(circle at center, rgba(255,0,0,0.18), transparent 70%)' }}>
            <motion.div className="absolute inset-0" animate={{ opacity: [0.4, 0.8, 0.4] }} transition={{ duration: 1, repeat: Infinity }} style={{ background: 'rgba(255,0,0,0.05)' }} />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Panel title="Daily Action Checklist" icon={<CheckCircle2 size={15} />} className="lg:col-span-1">
          <div className="p-4 space-y-2">
            {tasksLoading ? <div className="flex justify-center py-6"><Spinner /></div> : checklist.length === 0 ? <EmptyState icon={<Circle size={24} />} title="No tasks yet" subtitle="Create daily tasks to track your workflow" /> : (
              <>
                {checklist.map((task) => (
                  <MotionButton key={task.id} onClick={() => toggleChecklistItem(task)} className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.04] text-left group">
                    {task.status === 'completed' ? <CheckCircle2 size={18} className="text-success shrink-0" /> : <Circle size={18} className="text-ink-500 shrink-0 group-hover:text-ink-300 transition-colors" />}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${task.status === 'completed' ? 'text-ink-400 line-through' : 'text-ink-100'}`}>{task.title}</p>
                      {task.scheduled_at && <p className="text-[10px] text-ink-400 flex items-center gap-1 mt-0.5"><Clock size={10} /> {new Date(task.scheduled_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</p>}
                    </div>
                  </MotionButton>
                ))}
                <MotionButton onClick={addQuickTask} className="w-full py-2.5 rounded-xl border border-dashed border-white/[0.08] text-xs text-ink-400 hover:text-ink-200 flex items-center justify-center gap-1.5"><Plus size={13} /> Add task</MotionButton>
              </>
            )}
          </div>
        </Panel>

        <Panel title="Direct Approval Gateway" icon={<Eye size={15} />} className="lg:col-span-1">
          <div className="p-4 space-y-2 max-h-[320px] overflow-y-auto">
            {episodesLoading ? <div className="flex justify-center py-6"><Spinner /></div> : approvalQueue.length === 0 ? <EmptyState icon={<FileText size={24} />} title="Nothing to approve" subtitle="Generated scripts will appear here" /> : (
              approvalQueue.map((ep) => (
                <motion.div key={ep.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink-100 truncate">Ep {ep.episode_number}: {ep.title || 'Untitled'}</p>
                      <p className="text-[10px] text-ink-400">Script · Visuals · Metadata</p>
                    </div>
                    <Badge variant="warning">Review</Badge>
                  </div>
                  <div className="flex gap-2">
                    <MotionButton onClick={() => approveEpisode(ep)} disabled={updateEpisodeMut.isPending} className="flex-1 btn-primary text-xs py-2 flex items-center justify-center gap-1.5 disabled:opacity-50"><CheckCircle2 size={13} /> Approve</MotionButton>
                    <MotionButton onClick={() => focusEpisode(ep)} className="btn-ghost text-xs py-2 px-3 flex items-center justify-center gap-1.5"><Eye size={13} /> View</MotionButton>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </Panel>

        <Panel title="Daily Goal Metric Gauge" icon={<Gauge size={15} />} className="lg:col-span-1">
          <div className="p-5 flex flex-col items-center">
            <div className="relative w-36 h-36 mb-4">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
                <motion.circle cx="50" cy="50" r={radius} fill="none" stroke="var(--accent)" strokeWidth="6" strokeLinecap="round" strokeDasharray={circumference} initial={{ strokeDashoffset: circumference }} animate={{ strokeDashoffset: dashOffset }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }} style={{ filter: 'drop-shadow(0 0 6px var(--accent-glow))' }} />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold text-ink-50">{todayCompleted}</span>
                <span className="text-[10px] text-ink-400 uppercase tracking-wide">of {DAILY_TARGET}</span>
              </div>
            </div>
            <div className="w-full space-y-2">
              <div className="flex items-center justify-between text-xs"><span className="text-ink-300">Tasks completed</span><span className="text-ink-100 font-medium">{todayCompleted}</span></div>
              <div className="flex items-center justify-between text-xs"><span className="text-ink-300">Target release</span><span className="text-accent font-medium">7:00 AM</span></div>
              <div className="flex items-center justify-between text-xs"><span className="text-ink-300">Time remaining</span><span className="text-warning font-medium">{Math.max(0, 10 - todayCompleted * 3)} min</span></div>
            </div>
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Active Render Pipeline" icon={<Activity size={15} />} className="lg:col-span-1">
          <div className="p-4 space-y-3 max-h-[280px] overflow-y-auto">
            {episodesLoading ? <div className="flex justify-center py-6"><Spinner /></div> : renderQueue.length === 0 ? <EmptyState icon={<Activity size={24} />} title="No active renders" subtitle="Pipeline is idle" /> : (
              <AnimatePresence initial={false}>
                {renderQueue.map((ep) => {
                  const progress = ep.status === 'rendering' ? (ep.metadata?.render_progress as number) ?? 45 : 0;
                  return (
                    <motion.div key={ep.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="p-3 rounded-xlbg-white/[0.02] border border-white/[0.04]">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-ink-100">Ep {ep.episode_number}: {ep.title || 'Untitled'}</span>
                        <Badge variant={ep.status === 'rendering' ? 'accent' : 'neutral'}>{ep.status === 'rendering' ? 'Rendering' : 'Queued'}</Badge>
                      </div>
                      <ProgressBar value={progress} />
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-[10px] text-ink-400 font-mono">{progress}% · 4K 60FPS</span>
                        <span className="text-[10px] text-ink-400">{ep.status === 'rendering' ? '~3 min left' : 'Waiting'}</span>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            )}
          </div>
        </Panel>

        <Panel title="Live API Health Matrix" icon={<Zap size={15} />} className="lg:col-span-1">
          <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {apiHealth.map((api) => {
              const status: 'online' | 'offline' = api.configured ? 'online' : 'offline';
              return (
                <motion.div key={api.key} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.2 }} className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] flex flex-col items-center gap-1.5">
                  <div className="relative">
                    <StatusDot status={status} />
                    {api.configured && <span className="absolute -inset-1 rounded-full animate-ping" style={{ background: 'var(--accent-glow)' }} />}
                  </div>
                  <span className="text-[11px] font-medium text-ink-200">{api.name}</span>
                  <span className={`text-[10px] font-mono ${api.configured ? 'text-success' : 'text-danger'}`}>{api.configured ? `${api.latency}ms` : 'SECURE CONFIG MISSING'}</span>
                </motion.div>
              );
            })}
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Quick Script Variant Switcher" icon={<FileText size={15} />} className="lg:col-span-1">
          <div className="p-4 space-y-3">
            {scriptVariants.length === 0 ? <EmptyState icon={<ChevronDown size={24} />} title="No variants" subtitle="Generate multiple script iterations in Script Lab" /> : (
              scriptVariants.map((ep) => {
                const isOpen = variantDropdownFor === ep.id;
                const activeIdx = ep.active_variant_index ?? 0;
                const variantCount = ep.script_variants?.length ?? 0;
                const activeHook = ep.script_variants?.[activeIdx]?.hook ?? ep.script?.hook ?? 'No hook generated yet.';
                return (
                  <div key={ep.id} className="relative">
                    <MotionButton onClick={() => setVariantDropdownFor(isOpen ? null : ep.id)} className="w-full flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:border-white/[0.08]">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <FileText size={15} className="text-accent shrink-0" />
                        <div className="min-w-0 text-left">
                          <p className="text-sm font-medium text-ink-100 truncate">{ep.title || 'Untitled'} · Ep {ep.episode_number}</p>
                          <p className="text-[10px] text-ink-400">Variant {activeIdx + 1} of {variantCount}</p>
                        </div>
                      </div>
                      <ChevronDown size={16} className={`text-ink-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </MotionButton>
                    <AnimatePresence>
                      {isOpen && (
                        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }} className="absolute top-full left-0 right-0 mt-1 glass-panel z-20 max-h-48 overflow-y-auto">
                          {ep.script_variants?.map((_, idx) => (
                            <button key={idx} onClick={() => switchVariant(ep, idx)} className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-white/[0.04] transition-colors ${idx === activeIdx ? 'bg-accent-dim' : ''}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${idx === activeIdx ? 'bg-accent' : 'bg-ink-500'}`} />
                              <span className="text-sm text-ink-100">Variant {idx + 1}</span>
                              {idx === activeIdx && <Badge variant="accent">Active</Badge>}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <div className="mt-2 p-3 rounded-xl bg-ink-900/40 border border-white/[0.04]">
                      <p className="text-xs text-ink-200 line-clamp-3">{activeHook}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Panel>

        <Panel title="System Failure Notifications" icon={<AlertTriangle size={15} />} className="lg:col-span-1" action={errorLogs.length > 0 ? <Badge variant="danger">{errorLogs.length}</Badge> : undefined}>
          <div className="p-4 space-y-2 max-h-[260px] overflow-y-auto">
            {logsLoading ? <div className="flex justify-center py-6"><Spinner /></div> : errorLogs.length === 0 ? <EmptyState icon={<CheckCircle2 size={24} />} title="All systems nominal" subtitle="No active errors" /> : (
              <AnimatePresence initial={false}>
                {errorLogs.map((log) => (
                  <motion.div key={log.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="p-3 rounded-xl bg-danger-dim border border-danger/20">
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <AlertTriangle size={14} className="text-danger shrink-0" />
                        <span className="text-xs font-medium text-ink-100 truncate">{log.source}</span>
                      </div>
                      <span className="text-[10px] text-ink-400 shrink-0">{new Date(log.created_at).toLocaleTimeString()}</span>
                    </div>
                    <p className="text-xs text-ink-200 mb-2">{log.message}</p>
                    <MotionButton onClick={() => retryLog(log)} disabled={resolveLogMut.isPending || addLogMut.isPending} className="btn-ghost text-xs py-1.5 px-3 text-warning hover:text-warning flex items-center gap-1.5 disabled:opacity-50">
                      <RotateCw size={12} /> Retry
                    </MotionButton>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        </Panel>
      </div>

      <Panel>
        <div className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-accent" />
            <h3 className="text-sm font-semibold text-ink-100">Cockpit Feature Toggles</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {COCKPIT_FEATURES.map((toggle) => (
              <FeatureToggleRow key={toggle.id} toggle={toggle} enabled={toggle.defaultEnabled} onToggle={() => {}} />
            ))}
          </div>
        </div>
      </Panel>
    </div>
  );
}
