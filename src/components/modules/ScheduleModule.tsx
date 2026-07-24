import { useState, useMemo, useCallback, useRef, type DragEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar,
  Clock,
  Zap,
  CalendarClock,
  Sparkles,
  MessageSquare,
  Save,
  Globe,
  GripVertical,
  Radio,
  TrendingUp,
  RefreshCw,
  FileText,
  BookOpen,
  AlertCircle,
} from 'lucide-react';
import { useActiveStore, useToastStore, useApiVaultStore, useNavStore } from '../../lib/stores';
import {
  useEpisodesQuery,
  useUpdateEpisodeMutation,
  useSettingsQuery,
  useSaveSettingMutation,
  useAddLogMutation,
} from '../../lib/queries';
import {
  SCHEDULE_TABS,
  SCHEDULE_FEATURES,
  SCHEDULE_P3_FEATURES,
  type FeatureToggle,
} from '../../lib/featuresConfig';
import { MotionPanel, MotionButton, SubTabs, FeatureToggleRow } from '../ui/Animated';
import { Panel, Badge, ProgressBar, Spinner, EmptyState, Toggle } from '../ui/Primitives';
import type { Episode } from '../../lib/supabase';

// ─── Helpers ────────────────────────────────────────────────────────────────

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const HOURS = Array.from({ length: 24 }, (_, h) => h);

// Synthetic engagement curve (peaks at dawn ~7 and evening ~19) used by the
// "best posting time" analyzer / SVG bar chart. Deterministic, no API needed.
const ENGAGEMENT_BY_HOUR: number[] = HOURS.map((h) => {
  const dawn = Math.exp(-Math.pow(h - 7, 2) / 8);
  const evening = Math.exp(-Math.pow(h - 19, 2) / 10);
  const noise = 0.15 + 0.1 * Math.sin(h * 1.3);
  return Math.max(0.08, +(dawn * 0.9 + evening + noise).toFixed(3));
});
const BEST_HOUR = ENGAGEMENT_BY_HOUR.reduce(
  (best, v, h) => (v > ENGAGEMENT_BY_HOUR[best] ? h : best),
  0
);
// Hours from 6 AM (6) through 10 PM (22) inclusive — the window the trend
// scheduler heatmap visualizes.
const TREND_HOURS = HOURS.filter((h) => h >= 6 && h <= 22);
const TREND_MAX = Math.max(...TREND_HOURS.map((h) => ENGAGEMENT_BY_HOUR[h]));
// Any hour within 85% of the max engagement is considered a "peak" hour.
const PEAK_HOURS = TREND_HOURS.filter(
  (h) => ENGAGEMENT_BY_HOUR[h] >= TREND_MAX * 0.85
);

function startOfWeek(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - x.getDay());
  return x;
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function fmtTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function fmtDateShort(d: Date): string {
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ScheduleModule({ seriesId }: { seriesId: string | null }) {
  const addToast = useToastStore((s) => s.addToast);
  const setActiveEpisode = useActiveStore((s) => s.setActiveEpisode);
  const hasKey = useApiVaultStore((s) => s.hasKey);
  const navSubTab = useNavStore((s) => s.activeSubTab['schedule'] || 'queue');
  const setNavSubTab = useNavStore((s) => s.setActiveSubTab);

  const { data: episodes = [], isLoading: epsLoading } = useEpisodesQuery(seriesId);
  const updateEpisode = useUpdateEpisodeMutation();
  const { data: settings = [] } = useSettingsQuery();
  const saveSetting = useSaveSettingMutation();
  const addLog = useAddLogMutation();

  const activeTab = navSubTab;
  const setActiveTab = useCallback(
    (id: string) => setNavSubTab('schedule', id),
    [setNavSubTab]
  );

  // ── Local UI state ──────────────────────────────────────────────────────────
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverDay, setDragOverDay] = useState<number | null>(null);
  const [publishing, setPublishing] = useState<Record<string, number>>({});
  const publishTimers = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  // Feature toggle state seeded from SCHEDULE_FEATURES defaults + settings overrides
  const scheduleSettings = useMemo(
    () => settings.find((s) => s.key === 'schedule')?.value as Record<string, unknown> | undefined,
    [settings]
  );
  const [featureState, setFeatureState] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      [...SCHEDULE_FEATURES, ...SCHEDULE_P3_FEATURES].map((f) => [
        f.id,
        Boolean(scheduleSettings?.[f.id] ?? f.defaultEnabled),
      ])
    )
  );
  // Re-seed when settings load asynchronously
  const seededRef = useRef(false);
  if (!seededRef.current && scheduleSettings) {
    seededRef.current = true;
    setFeatureState(
      Object.fromEntries(
        [...SCHEDULE_FEATURES, ...SCHEDULE_P3_FEATURES].map((f) => [
          f.id,
          Boolean(scheduleSettings[f.id] ?? f.defaultEnabled),
        ])
      )
    );
  }

  const [dawnTime, setDawnTime] = useState<string>(
    (scheduleSettings?.dawnTime as string) || '07:00'
  );
  const [crossPost, setCrossPost] = useState<boolean>(
    (scheduleSettings?.crossPost as boolean) ?? true
  );

  // ── Phase 3 UI state ───────────────────────────────────────────────────────
  const [formatShifterOn, setFormatShifterOn] = useState(false);
  const [examModeOn, setExamModeOn] = useState(false);
  const [examStart, setExamStart] = useState('');
  const [examEnd, setExamEnd] = useState('');
  const [apiReschedOn, setApiReschedOn] = useState(false);

  // ── Derived calendar data ──────────────────────────────────────────────────
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return d;
    }),
    [weekStart]
  );

  const episodesForDay = useCallback(
    (day: Date) =>
      episodes.filter((e) => {
        if (!e.scheduled_at) return false;
        return sameDay(new Date(e.scheduled_at), day);
      }),
    [episodes]
  );

  // ── Phase 3: Smart Re-uploader derived data ─────────────────────────────────
  // Virality score is a per-dimension record; average the values into one number.
  const avgVirality = useCallback(
    (ep: Episode): number => {
      const vals = Object.values(ep.virality_score ?? {});
      if (vals.length === 0) return 0;
      return vals.reduce((a, b) => a + b, 0) / vals.length;
    },
    []
  );
  // Baseline: a published episode scoring under 1.0 average virality is a candidate.
  const underperformers = useMemo(
    () =>
      episodes
        .filter((e) => e.status === 'published')
        .filter((e) => avgVirality(e) < 1.0)
        .sort((a, b) => avgVirality(a) - avgVirality(b)),
    [episodes, avgVirality]
  );

  // ── Drag and drop handlers (native HTML5 DnD) ───────────────────────────────
  const onDragStart = useCallback((e: DragEvent<HTMLDivElement>, ep: Episode) => {
    setDragId(ep.id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', ep.id);
  }, []);

  const onDragEnd = useCallback(() => {
    setDragId(null);
    setDragOverDay(null);
  }, []);

  const onDragOver = useCallback((e: DragEvent<HTMLDivElement>, dayIdx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverDay(dayIdx);
  }, []);

  const onDragLeave = useCallback(() => setDragOverDay(null), []);

  const onDrop = useCallback(
    (e: DragEvent<HTMLDivElement>, targetDay: Date) => {
      e.preventDefault();
      const id = e.dataTransfer.getData('text/plain') || dragId;
      setDragOverDay(null);
      setDragId(null);
      if (!id) return;
      const ep = episodes.find((x) => x.id === id);
      if (!ep || !ep.scheduled_at) return;
      const src = new Date(ep.scheduled_at);
      if (sameDay(src, targetDay)) return; // no-op: same day
      const next = new Date(targetDay);
      next.setHours(src.getHours(), src.getMinutes(), 0, 0);
      updateEpisode.mutate(
        { id, updates: { scheduled_at: next.toISOString() } },
        {
          onSuccess: () => {
            addToast(
              `Ep ${ep.episode_number} rescheduled to ${next.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}`,
              'success'
            );
            addLog.mutate({
              level: 'info',
              message: `Rescheduled episode ${ep.episode_number} via drag-and-drop to ${next.toISOString()}`,
              source: 'schedule',
              details: {},
              retryable: false,
              resolved: false,
            });
          },
          onError: () => {
            addToast('Failed to reschedule episode', 'error');
            addLog.mutate({
              level: 'error',
              message: `Drag-drop reschedule failed for episode ${ep.episode_number}`,
              source: 'schedule',
              details: {},
              retryable: false,
              resolved: false,
            });
          },
        }
      );
    },
    [dragId, episodes, updateEpisode, addToast, addLog]
  );

  // ── Publish Now (simulated upload progress) ─────────────────────────────────
  const publishNow = useCallback(
    (ep: Episode) => {
      if (publishing[ep.id] !== undefined) return;
      setActiveEpisode(ep.id);
      addToast(`Publishing episode ${ep.episode_number}…`, 'info');
      addLog.mutate({
        level: 'info',
        message: `Publish started for episode ${ep.episode_number}`,
        source: 'schedule',
        details: {},
        retryable: false,
        resolved: false,
      });
      setPublishing((s) => ({ ...s, [ep.id]: 0 }));
      publishTimers.current[ep.id] = setInterval(() => {
        setPublishing((s) => {
          const cur = s[ep.id] ?? 0;
          if (cur >= 100) {
            clearInterval(publishTimers.current[ep.id]);
            delete publishTimers.current[ep.id];
            addToast(`Episode ${ep.episode_number} published live`, 'success');
            addLog.mutate({
              level: 'info',
              message: `Episode ${ep.episode_number} published successfully`,
              source: 'schedule',
              details: {},
              retryable: false,
              resolved: false,
            });
            updateEpisode.mutate({
              id: ep.id,
              updates: {
                status: 'published',
                published_at: new Date().toISOString(),
              },
            });
            const { [ep.id]: _omit, ...rest } = s;
            return rest;
          }
          return { ...s, [ep.id]: Math.min(100, cur + 10) };
        });
      }, 250);
    },
    [publishing, setActiveEpisode, addToast, addLog, updateEpisode]
  );

  // ── Feature toggle persistence ─────────────────────────────────────────────
  const handleFeatureToggle = useCallback(
    (f: FeatureToggle) => {
      const next = !featureState[f.id];
      setFeatureState((s) => ({ ...s, [f.id]: next }));
      const merged = { ...scheduleSettings, [f.id]: next };
      saveSetting.mutate(
        { key: 'schedule', value: merged },
        {
          onSuccess: () => {
            addToast(`${f.label} ${next ? 'enabled' : 'disabled'}`, 'success');
            addLog.mutate({
              level: 'info',
              message: `Schedule feature '${f.id}' toggled ${next ? 'ON' : 'OFF'}`,
              source: 'schedule',
              details: {},
              retryable: false,
              resolved: false,
            });
          },
          onError: () => addToast(`Failed to save ${f.label}`, 'error'),
        }
      );
    },
    [featureState, scheduleSettings, saveSetting, addToast, addLog]
  );

  const saveAutomationConfig = useCallback(() => {
    const merged = {
      ...scheduleSettings,
      dawnTime,
      crossPost,
      autoTiming: featureState.auto_timing,
      commentAutomation: featureState.comment_automation,
    };
    saveSetting.mutate(
      { key: 'schedule', value: merged },
      {
        onSuccess: () => {
          addToast('Automation configuration saved', 'success');
          addLog.mutate({
            level: 'info',
            message: `Smart timing config saved: dawn=${dawnTime}, crossPost=${crossPost}`,
            source: 'schedule',
            details: {},
            retryable: false,
            resolved: false,
          });
        },
        onError: () => addToast('Failed to save automation config', 'error'),
      }
    );
  }, [scheduleSettings, dawnTime, crossPost, featureState, saveSetting, addToast, addLog]);

  // ── API readiness ──────────────────────────────────────────────────────────
  const ytReady = hasKey('youtube_api_key') || hasKey('YOUTUBE_API_KEY');
  const igReady = hasKey('instagram_api_key') || hasKey('INSTAGRAM_API_KEY');

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      <SubTabs tabs={SCHEDULE_TABS} activeTab={activeTab} onTabChange={setActiveTab} />

      <AnimatePresence mode="wait">
        {activeTab === 'queue' && (
          <motion.div
            key="queue"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
            className="space-y-5"
          >
            {/* Queue header / week navigator */}
            <MotionPanel className="p-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2.5">
                  <Calendar className="w-4 h-4 text-accent" />
                  <div>
                    <h3 className="text-sm font-semibold text-ink-100">Queue Calendar</h3>
                    <p className="text-[10px] text-ink-400">
                      Drag episodes between days to reschedule
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <MotionButton
                    onClick={() => setWeekStart((d) => {
                      const n = new Date(d); n.setDate(n.getDate() - 7); return n;
                    })}
                    className="px-2.5 py-1 rounded-lg text-xs bg-white/[0.04] border border-white/[0.06] text-ink-200 hover:text-ink-100"
                  >
                    Prev
                  </MotionButton>
                  <span className="text-xs text-ink-200 tabular-nums min-w-[120px] text-center">
                    {fmtDateShort(weekDays[0])} – {fmtDateShort(weekDays[6])}
                  </span>
                  <MotionButton
                    onClick={() => setWeekStart((d) => {
                      const n = new Date(d); n.setDate(n.getDate() + 7); return n;
                    })}
                    className="px-2.5 py-1 rounded-lg text-xs bg-white/[0.04] border border-white/[0.06] text-ink-200 hover:text-ink-100"
                  >
                    Next
                  </MotionButton>
                  <MotionButton
                    onClick={() => setWeekStart(startOfWeek(new Date()))}
                    className="px-2.5 py-1 rounded-lg text-xs bg-white/[0.04] border border-white/[0.06] text-ink-200 hover:text-ink-100"
                  >
                    Today
                  </MotionButton>
                </div>
              </div>
            </MotionPanel>

            {/* Calendar grid */}
            <MotionPanel className="p-3">
              {epsLoading ? (
                <div className="flex items-center justify-center py-12 text-ink-300">
                  <Spinner size={20} />
                </div>
              ) : !seriesId ? (
                <EmptyState
                  icon={<Calendar className="w-6 h-6" />}
                  title="No series selected"
                  subtitle="Choose a series to manage its schedule"
                />
              ) : (
                <div className="grid grid-cols-7 gap-2">
                  {weekDays.map((day, idx) => {
                    const dayEps = episodesForDay(day);
                    const isOver = dragOverDay === idx;
                    const isToday = sameDay(day, new Date());
                    return (
                      <div
                        key={idx}
                        onDragOver={(e) => onDragOver(e, idx)}
                        onDragLeave={onDragLeave}
                        onDrop={(e) => onDrop(e, day)}
                        className={`min-h-[180px] rounded-xl p-2 border transition-colors ${
                          isOver
                            ? 'border-accent bg-accent-dim'
                            : 'border-white/[0.04] bg-white/[0.015]'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2 px-0.5">
                          <span
                            className={`text-[10px] font-semibold uppercase tracking-wide ${
                              isToday ? 'text-accent' : 'text-ink-300'
                            }`}
                          >
                            {DAYS[idx]}
                          </span>
                          <span className="text-[10px] text-ink-400 tabular-nums">
                            {day.getDate()}
                          </span>
                        </div>

                        <div className="space-y-1.5">
                          {dayEps.map((ep) => (
                            <motion.div
                              key={ep.id}
                              layout
                              draggable
                              onDragStart={(e) => onDragStart(e as unknown as DragEvent<HTMLDivElement>, ep)}
                              onDragEnd={onDragEnd}
                              whileHover={{ y: -1 }}
                              className={`group p-2 rounded-lg bg-white/[0.04] border border-white/[0.06] cursor-grab active:cursor-grabbing ${
                                dragId === ep.id ? 'opacity-40' : ''
                              }`}
                            >
                              <div className="flex items-start justify-between gap-1">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1">
                                    <GripVertical className="w-3 h-3 text-ink-400 shrink-0" />
                                    <span className="text-[10px] font-semibold text-accent">
                                      EP {ep.episode_number}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-ink-100 truncate mt-0.5">
                                    {ep.title || `Episode ${ep.episode_number}`}
                                  </p>
                                </div>
                                <Badge
                                  variant={
                                    ep.status === 'published'
                                      ? 'success'
                                      : ep.status === 'scheduled'
                                      ? 'accent'
                                      : 'neutral'
                                  }
                                >
                                  {ep.status}
                                </Badge>
                              </div>

                              <div className="flex items-center gap-1 mt-1.5 text-[10px] text-ink-300">
                                <Clock className="w-2.5 h-2.5" />
                                {fmtTime(ep.scheduled_at)}
                              </div>

                              {/* Publish progress meter */}
                              {publishing[ep.id] !== undefined && (
                                <div className="mt-2">
                                  <ProgressBar value={publishing[ep.id]} />
                                  <p className="text-[9px] text-ink-400 mt-1 text-center">
                                    Uploading {publishing[ep.id]}%
                                  </p>
                                </div>
                              )}

                              {/* Publish Now */}
                              {publishing[ep.id] === undefined &&
                                ep.status !== 'published' && (
                                  <MotionButton
                                    onClick={() => publishNow(ep)}
                                    className="mt-2 w-full flex items-center justify-center gap-1 py-1 rounded-md text-[10px] font-medium bg-accent text-black hover:opacity-90"
                                  >
                                    <Zap className="w-2.5 h-2.5" />
                                    Publish Now
                                  </MotionButton>
                                )}
                            </motion.div>
                          ))}

                          {dayEps.length === 0 && (
                            <div className="text-[9px] text-ink-500 text-center py-3">
                              Drop here
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </MotionPanel>

            {/* Smart Re-uploader Blueprint (Phase 3) */}
            <Panel
              title="Smart Re-uploader Blueprint"
              icon={<RefreshCw className="w-4 h-4" />}
              className="p-4"
              action={
                <Badge variant={underperformers.length > 0 ? 'warning' : 'neutral'}>
                  {underperformers.length} below baseline
                </Badge>
              }
            >
              {underperformers.length === 0 ? (
                <EmptyState
                  icon={<TrendingUp className="w-5 h-5" />}
                  title="No underperformers"
                  subtitle="Published episodes are all above the virality baseline."
                />
              ) : (
                <div className="space-y-2">
                  {underperformers.map((ep) => (
                    <div
                      key={ep.id}
                      className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-ink-100 truncate">
                          Ep {ep.episode_number}
                          {ep.title ? ` — ${ep.title}` : ''}
                        </p>
                        <p className="text-[10px] text-ink-400 mt-0.5">
                          Virality {avgVirality(ep).toFixed(2)} · published{' '}
                          {ep.published_at ? new Date(ep.published_at).toLocaleDateString() : '—'}
                        </p>
                      </div>
                      <MotionButton
                        className="flex items-center px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-xs text-ink-100 border border-white/[0.08] shrink-0"
                        onClick={() =>
                          addToast(
                            `Re-upload queued: “${ep.title ?? `Episode ${ep.episode_number}`}” will be re-uploaded with refreshed tags.`,
                            'info'
                          )
                        }
                      >
                        <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                        Re-upload with New Tags
                      </MotionButton>
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            {/* Feature toggles */}
            <Panel
              title="Queue Features"
              icon={<Sparkles className="w-4 h-4" />}
              className="p-4"
            >
              <div className="grid sm:grid-cols-2 gap-2.5">
                {SCHEDULE_FEATURES.map((f) => (
                  <FeatureToggleRow
                    key={f.id}
                    toggle={f}
                    enabled={!!featureState[f.id]}
                    onToggle={() => handleFeatureToggle(f)}
                  />
                ))}
              </div>
            </Panel>
          </motion.div>
        )}

        {activeTab === 'smart_timing' && (
          <motion.div
            key="smart_timing"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
            className="space-y-5"
          >
            {/* Dawn broadcast */}
            <MotionPanel className="p-5">
              <div className="flex items-center gap-2.5 mb-4">
                <Radio className="w-4 h-4 text-accent" />
                <div>
                  <h3 className="text-sm font-semibold text-ink-100">Dawn Broadcast Time</h3>
                  <p className="text-[10px] text-ink-400">
                    Fixed daily auto-upload time
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="time"
                  value={dawnTime}
                  onChange={(e) => setDawnTime(e.target.value)}
                  className="bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-ink-100 focus:outline-none focus:border-accent"
                />
                <Badge variant="accent">
                  <Clock className="w-2.5 h-2.5 mr-1 inline" />
                  {dawnTime}
                </Badge>
              </div>
            </MotionPanel>

            {/* Automation toggles */}
            <Panel
              title="Automation"
              icon={<CalendarClock className="w-4 h-4" />}
              className="p-4 space-y-3"
            >
              <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                <div className="flex items-center gap-2.5">
                  <TrendingUp className="w-4 h-4 text-accent" />
                  <div>
                    <p className="text-xs font-medium text-ink-100">Smart Auto-Timing</p>
                    <p className="text-[10px] text-ink-400">
                      Shift posting hours based on engagement
                    </p>
                  </div>
                </div>
                <Toggle
                  checked={!!featureState.auto_timing}
                  onChange={(v) =>
                    setFeatureState((s) => ({ ...s, auto_timing: v }))
                  }
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                <div className="flex items-center gap-2.5">
                  <MessageSquare className="w-4 h-4 text-accent" />
                  <div>
                    <p className="text-xs font-medium text-ink-100">Comment Automation</p>
                    <p className="text-[10px] text-ink-400">
                      Auto-post pinned comment when live
                    </p>
                  </div>
                </div>
                <Toggle
                  checked={!!featureState.comment_automation}
                  onChange={(v) =>
                    setFeatureState((s) => ({ ...s, comment_automation: v }))
                  }
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                <div className="flex items-center gap-2.5">
                  <Globe className="w-4 h-4 text-accent" />
                  <div>
                    <p className="text-xs font-medium text-ink-100">
                      Cross-Platform Simultaneous Post
                    </p>
                    <p className="text-[10px] text-ink-400">
                      Publish to YouTube + Instagram together
                    </p>
                  </div>
                </div>
                <Toggle checked={crossPost} onChange={setCrossPost} />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <Badge variant={ytReady ? 'success' : 'warning'}>YT {ytReady ? 'ready' : 'no key'}</Badge>
                <Badge variant={igReady ? 'success' : 'warning'}>IG {igReady ? 'ready' : 'no key'}</Badge>
              </div>

              <MotionButton
                onClick={saveAutomationConfig}
                disabled={saveSetting.isPending}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium bg-accent text-black disabled:opacity-50"
              >
                {saveSetting.isPending ? <Spinner size={14} /> : <Save className="w-4 h-4" />}
                Save Automation Config
              </MotionButton>
            </Panel>

            {/* Best posting time analyzer — SVG bar chart */}
            <Panel
              title="Best Posting Time Analyzer"
              icon={<TrendingUp className="w-4 h-4" />}
              className="p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-ink-300">
                  Predicted engagement by hour
                </p>
                <Badge variant="accent">
                  Peak: {String(BEST_HOUR).padStart(2, '0')}:00
                </Badge>
              </div>

              <BestTimeChart />

              <div className="mt-4 p-3 rounded-xl bg-accent-dim border border-accent/20">
                <p className="text-xs text-ink-100">
                  <Sparkles className="w-3 h-3 inline mr-1 text-accent" />
                  Recommended: post at{' '}
                  <span className="text-accent font-semibold">
                    {String(BEST_HOUR).padStart(2, '0')}:00
                  </span>{' '}
                  for maximum reach. Dawn broadcast set to{' '}
                  <span className="text-accent font-semibold">{dawnTime}</span>.
                </p>
              </div>
            </Panel>

            {/* ── Phase 3: Global Trend Scheduler ─────────────────────────────── */}
            <Panel
              title="Global Trend Scheduler"
              icon={<TrendingUp className="w-4 h-4" />}
              className="p-5"
              action={
                <Badge variant="accent">
                  Peak {String(PEAK_HOURS[0]).padStart(2, '0')}:00–
                  {String(PEAK_HOURS[PEAK_HOURS.length - 1]).padStart(2, '0')}:00
                </Badge>
              }
            >
              <p className="text-xs text-ink-300 mb-3">
                Viral traffic heatmap — engagement levels by hour (6 AM → 10 PM).
                Peak hours are highlighted.
              </p>

              <TrendHeatmap />

              <div className="mt-4 p-3 rounded-xl bg-accent-dim border border-accent/20">
                <p className="text-xs text-ink-100">
                  <TrendingUp className="w-3 h-3 inline mr-1 text-accent" />
                  The system dynamically shifts the{' '}
                  <span className="text-accent font-semibold">7:00 AM</span> default
                  based on these heatmaps — strongest engagement windows get
                  promoted automatically.
                </p>
              </div>
            </Panel>

            {/* ── Phase 3: Format Shifter ────────────────────────────────────── */}
            <Panel
              title="Format Shifter"
              icon={<FileText className="w-4 h-4" />}
              className="p-4 space-y-3"
              action={
                <Toggle checked={formatShifterOn} onChange={setFormatShifterOn} />
              }
            >
              <p className="text-xs text-ink-300">
                Adapt the same description for YouTube vs Instagram formatting.
              </p>

              {formatShifterOn && (
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-3">
                    <div className="flex items-center gap-1.5 mb-2">
                      <FileText className="w-3.5 h-3.5 text-red-400" />
                      <p className="text-[11px] font-semibold text-ink-100">
                        YouTube — full long-form
                      </p>
                    </div>
                    <pre className="text-[10px] leading-relaxed text-ink-300 whitespace-pre-wrap font-mono">
{`EPISODE 12 — The Hollow Crown

In this episode, Kael confronts the mirror-self
while the city burns above. Full lore breakdown,
character motivations, and foreshadowing analysis.

▸ Timestamps
00:00 Cold open
02:15 The mirror reveal
09:40 Crown sequence
18:00 Outro & next-time

#lore #hollowcrown #kael #mirrorself`}
                    </pre>
                  </div>
                  <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-3">
                    <div className="flex items-center gap-1.5 mb-2">
                      <FileText className="w-3.5 h-3.5 text-pink-400" />
                      <p className="text-[11px] font-semibold text-ink-100">
                        Instagram — clean blocks
                      </p>
                    </div>
                    <pre className="text-[10px] leading-relaxed text-ink-300 whitespace-pre-wrap font-mono">
{`EPISODE 12 ✦ The Hollow Crown

Kael confronts the mirror-self.
The city burns above. 🔥

— Lore breakdown
— Character motivations
— Foreshadowing analysis

Tap save for the full deep-dive 👆

#lore #hollowcrown #kael`}
                    </pre>
                  </div>
                </div>
              )}
            </Panel>

            {/* ── Phase 3: Exam Mode Scheduler ────────────────────────────────── */}
            <Panel
              title="Exam Mode Scheduler"
              icon={<BookOpen className="w-4 h-4" />}
              className="p-4 space-y-3"
              action={<Toggle checked={examModeOn} onChange={setExamModeOn} />}
            >
              <p className="text-xs text-ink-300">
                Pre-approved content auto-publishes during study/exam weeks
                without manual intervention.
              </p>

              <div className="grid sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-[10px] text-ink-400 mb-1 block">
                    Start date
                  </span>
                  <input
                    type="date"
                    value={examStart}
                    onChange={(e) => setExamStart(e.target.value)}
                    className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-ink-100 focus:outline-none focus:border-accent"
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] text-ink-400 mb-1 block">
                    End date
                  </span>
                  <input
                    type="date"
                    value={examEnd}
                    onChange={(e) => setExamEnd(e.target.value)}
                    className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-ink-100 focus:outline-none focus:border-accent"
                  />
                </label>
              </div>

              {examModeOn && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2">
                  <BookOpen className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
                  <p className="text-xs text-ink-100">
                    <span className="font-semibold text-amber-300">
                      Exam Mode Active:
                    </span>{' '}
                    Pre-approved content will auto-publish during the selected
                    period
                    {examStart && examEnd
                      ? ` (${examStart} → ${examEnd})`
                      : ''}{' '}
                    without manual intervention.
                  </p>
                </div>
              )}
            </Panel>

            {/* ── Phase 3: API Failure Auto-Rescheduler ──────────────────────── */}
            <Panel
              title="API Failure Auto-Rescheduler"
              icon={<AlertCircle className="w-4 h-4" />}
              className="p-4 space-y-3"
              action={<Toggle checked={apiReschedOn} onChange={setApiReschedOn} />}
            >
              <p className="text-xs text-ink-300">
                Catch upload/publish timeouts and retry automatically on a
                fixed delay.
              </p>

              {apiReschedOn && (
                <div className="p-3 rounded-xl bg-accent-dim border border-accent/20 flex items-start gap-2">
                  <AlertCircle className="w-3.5 h-3.5 text-accent mt-0.5 shrink-0" />
                  <p className="text-xs text-ink-100">
                    <span className="font-semibold text-accent">
                      Background queue active:
                    </span>{' '}
                    Failed API calls will be automatically retried 30 minutes
                    after timeout.
                  </p>
                </div>
              )}
            </Panel>

            {/* ── Phase 3: Feature toggles ───────────────────────────────────── */}
            <Panel
              title="Smart Timing Features (Phase 3)"
              icon={<Sparkles className="w-4 h-4" />}
              className="p-4"
            >
              <div className="grid sm:grid-cols-2 gap-2.5">
                {SCHEDULE_P3_FEATURES.map((f) => (
                  <FeatureToggleRow
                    key={f.id}
                    toggle={f}
                    enabled={!!featureState[f.id]}
                    onToggle={() => handleFeatureToggle(f)}
                  />
                ))}
              </div>
            </Panel>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Best Posting Time SVG Bar Chart ──────────────────────────────────────────

function BestTimeChart() {
  const max = Math.max(...ENGAGEMENT_BY_HOUR);
  const W = 560;
  const H = 160;
  const padL = 28;
  const padB = 22;
  const padT = 8;
  const innerW = W - padL - 8;
  const innerH = H - padB - padT;
  const barW = innerW / 24 * 0.7;
  const gap = innerW / 24 * 0.3;

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ minWidth: 480 }}
        role="img"
        aria-label="Engagement by hour bar chart"
      >
        {/* Y axis baseline */}
        <line
          x1={padL}
          y1={padT}
          x2={padL}
          y2={padT + innerH}
          stroke="rgba(255,255,255,0.08)"
        />
        <line
          x1={padL}
          y1={padT + innerH}
          x2={W - 8}
          y2={padT + innerH}
          stroke="rgba(255,255,255,0.08)"
        />

        {/* Bars */}
        {ENGAGEMENT_BY_HOUR.map((v, h) => {
          const bh = (v / max) * innerH;
          const x = padL + h * (barW + gap) + gap / 2;
          const y = padT + innerH - bh;
          const isPeak = h === BEST_HOUR;
          return (
            <g key={h}>
              <motion.rect
                x={x}
                y={y}
                width={barW}
                height={bh}
                rx={2}
                initial={{ height: 0, y: padT + innerH }}
                animate={{ height: bh, y }}
                transition={{ duration: 0.5, delay: h * 0.02 }}
                fill={isPeak ? 'var(--accent)' : 'color-mix(in srgb, var(--accent) 35%, transparent)'}
                style={isPeak ? { filter: 'drop-shadow(0 0 6px var(--accent-glow))' } : undefined}
              />
              {(h % 3 === 0 || isPeak) && (
                <text
                  x={x + barW / 2}
                  y={H - 6}
                  textAnchor="middle"
                  className="fill-ink-400"
                  style={{ fontSize: 9 }}
                >
                  {String(h).padStart(2, '0')}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ─── Phase 3: Viral Traffic Heatmap (6 AM → 10 PM) ─────────────────────────────

function TrendHeatmap() {
  const W = 560;
  const H = 170;
  const padL = 32;
  const padB = 24;
  const padT = 10;
  const innerW = W - padL - 8;
  const innerH = H - padB - padT;
  const barW = (innerW / TREND_HOURS.length) * 0.72;
  const gap = (innerW / TREND_HOURS.length) * 0.28;

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ minWidth: 480 }}
        role="img"
        aria-label="Viral traffic heatmap by hour, 6 AM to 10 PM"
      >
        {/* axes */}
        <line
          x1={padL}
          y1={padT}
          x2={padL}
          y2={padT + innerH}
          stroke="rgba(255,255,255,0.08)"
        />
        <line
          x1={padL}
          y1={padT + innerH}
          x2={W - 8}
          y2={padT + innerH}
          stroke="rgba(255,255,255,0.08)"
        />

        {/* bars */}
        {TREND_HOURS.map((h, i) => {
          const v = ENGAGEMENT_BY_HOUR[h];
          const bh = (v / TREND_MAX) * innerH;
          const x = padL + i * (barW + gap) + gap / 2;
          const y = padT + innerH - bh;
          const isPeak = PEAK_HOURS.includes(h);
          return (
            <g key={h}>
              <motion.rect
                x={x}
                y={y}
                width={barW}
                height={bh}
                rx={2}
                initial={{ height: 0, y: padT + innerH }}
                animate={{ height: bh, y }}
                transition={{ duration: 0.45, delay: i * 0.03 }}
                fill={
                  isPeak
                    ? 'var(--accent)'
                    : 'color-mix(in srgb, var(--accent) 30%, transparent)'
                }
                style={
                  isPeak
                    ? { filter: 'drop-shadow(0 0 6px var(--accent-glow))' }
                    : undefined
                }
              />
              {/* label every other hour + all peaks */}
              {(i % 2 === 0 || isPeak) && (
                <text
                  x={x + barW / 2}
                  y={H - 6}
                  textAnchor="middle"
                  fill={isPeak ? 'var(--accent)' : 'var(--ink-400, #6b7280)'}
                  style={{ fontSize: 9, fontWeight: isPeak ? 700 : 400 }}
                >
                  {String(h).padStart(2, '0')}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
