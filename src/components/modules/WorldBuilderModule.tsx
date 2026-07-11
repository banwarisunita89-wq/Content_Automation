import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Globe, Calendar, Sparkles, BookOpen, Wand2, X, Check,
  ChevronLeft, ChevronRight, Bookmark, BookmarkCheck, AlertTriangle, Users,
} from 'lucide-react';
import { type Episode } from '../../lib/supabase';
import { useActiveStore, useToastStore, useApiVaultStore, useNavStore } from '../../lib/stores';
import {
  useSeriesQuery, useActiveSeriesQuery, useUpdateSeriesMutation,
  useEpisodesQuery, useSettingsQuery, useSaveSettingMutation,
  useAddLogMutation, useCharactersQuery,
} from '../../lib/queries';
import { callGemini } from '../../lib/api';
import { WORLD_BUILDER_TABS, WORLD_BUILDER_FEATURES, type FeatureToggle } from '../../lib/featuresConfig';
import { Panel, Badge, Spinner, EmptyState } from '../ui/Primitives';
import { MotionPanel, MotionButton, SubTabs, FeatureToggleRow, MotionModal } from '../ui/Animated';

// ─── Types ───
type SeriesIdea = { title: string; description: string; bookmarked: boolean };
type CalendarDay = {
  date: Date;
  episode?: Episode;
  isToday: boolean;
  inMonth: boolean;
};

const SUB_TAB_KEY = 'world_builder';

// ─── Helpers ───
function deriveTone(s: string): string {
  if (/dark|thriller|horror|crime|noir/i.test(s)) return 'Dark, suspenseful, cinematic';
  if (/funny|comedy|humor|satire|parody/i.test(s)) return 'Light, humorous, playful';
  if (/epic|adventure|hero|quest|battle/i.test(s)) return 'Epic, adventurous, sweeping';
  if (/romance|love|heart/i.test(s)) return 'Warm, emotional, tender';
  return 'Heartwarming, engaging, cinematic';
}

function deriveVisualTheme(s: string): string {
  if (/sci-fi|space|future|cyber|robot|galaxy/i.test(s)) return 'Sci-fi 3D, neon volumetric lighting, futuristic bokeh';
  if (/fantasy|magic|medieval|dragon|wizard/i.test(s)) return 'Fantasy 3D, ethereal volumetric lighting, enchanted bokeh';
  if (/noir|detective|crime|mystery|shadow/i.test(s)) return 'Film-noir 3D, high-contrast chiaroscuro, moody bokeh';
  return 'Disney Pixar 3D style, octane render, volumetric lighting, rich bokeh';
}

// Parse Gemini's free-form text response into structured idea cards.
function parseIdeas(raw: string): SeriesIdea[] {
  const cleaned = raw.trim();

  // Attempt 1: JSON array (preferred, most structured).
  const jsonStart = cleaned.indexOf('[');
  const jsonEnd = cleaned.lastIndexOf(']');
  if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
    try {
      const parsed = JSON.parse(cleaned.slice(jsonStart, jsonEnd + 1));
      if (Array.isArray(parsed)) {
        const ideas = parsed
          .map((item): SeriesIdea | null => {
            if (typeof item === 'string') {
              return item.trim() ? { title: item.trim().split(':')[0].slice(0, 80), description: item.trim(), bookmarked: false } : null;
            }
            if (item && typeof item === 'object') {
              const title = String(item.title || item.name || item.idea || '').trim();
              const description = String(item.description || item.synopsis || item.summary || item.pitch || '').trim();
              if (!title && !description) return null;
              return { title: title || description.slice(0, 80), description: description || title, bookmarked: false };
            }
            return null;
          })
          .filter((x): x is SeriesIdea => x !== null);
        if (ideas.length) return ideas.slice(0, 5);
      }
    } catch {
      // fall through to line-based parsing
    }
  }

  // Attempt 2: line-based parsing — strip numbering / bullets / markdown.
  const lines = cleaned
    .split('\n')
    .map((l) => l.replace(/^[\s>*\-"'\d.)\]]+/, '').trim())
    .filter((l) => l.length > 12);

  const ideas: SeriesIdea[] = [];
  for (const line of lines) {
    const sep = line.indexOf(':');
    if (sep > 0 && sep < 80) {
      ideas.push({ title: line.slice(0, sep).trim(), description: line.slice(sep + 1).trim(), bookmarked: false });
    } else {
      ideas.push({ title: line.slice(0, 80), description: line, bookmarked: false });
    }
    if (ideas.length >= 5) break;
  }
  return ideas;
}

// ─── Component ───
export function WorldBuilderModule({ seriesId }: { seriesId: string | null }) {
  // Stores
  const activeSeriesId = useActiveStore((s) => s.activeSeriesId);
  const addToast = useToastStore((s) => s.addToast);
  const hasGeminiKey = useApiVaultStore((s) => s.hasKey('gemini_api_key'));

  // React Query — series
  const { data: seriesList } = useSeriesQuery();
  const activeSeries = useActiveSeriesQuery();
  const updateSeriesMut = useUpdateSeriesMutation();

  // React Query — episodes / characters / settings
  const { data: episodes = [] } = useEpisodesQuery(seriesId);
  const { data: characters = [] } = useCharactersQuery(seriesId);
  const { data: settings } = useSettingsQuery();
  const saveSettingMut = useSaveSettingMutation();
  const addLogMut = useAddLogMutation();

  // Local UI state — sub-tab navigation lives in the nav store.
  const activeTab = useNavStore((s) => s.activeSubTab[SUB_TAB_KEY]) || WORLD_BUILDER_TABS[0].id;
  const setActiveSubTab = useNavStore((s) => s.setActiveSubTab);

  const [synopsis, setSynopsis] = useState('');
  const [loreVault, setLoreVault] = useState('');
  const [ideaPrompt, setIdeaPrompt] = useState('');
  const [seriesIdeas, setSeriesIdeas] = useState<SeriesIdea[]>([]);
  const [generatingIdeas, setGeneratingIdeas] = useState(false);
  const [savingLore, setSavingLore] = useState(false);
  const [savingSynopsis, setSavingSynopsis] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState<Episode | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [featureState, setFeatureState] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(WORLD_BUILDER_FEATURES.map((f) => [f.id, f.defaultEnabled]))
  );

  // Resolve the effective series id (prop takes priority, then active store).
  const effectiveSeriesId = seriesId ?? activeSeriesId ?? activeSeries?.id ?? null;
  const effectiveSeries = useMemo(
    () => seriesList?.find((s) => s.id === effectiveSeriesId) ?? activeSeries ?? null,
    [seriesList, effectiveSeriesId, activeSeries]
  );

  // Hydrate synopsis from the active series.
  useEffect(() => {
    if (effectiveSeries) setSynopsis(effectiveSeries.synopsis || '');
  }, [effectiveSeries]);

  // Hydrate lore vault from settings (key: 'lore_vault').
  const loreSetting = settings?.find((s) => s.key === 'lore_vault');
  useEffect(() => {
    if (loreSetting && typeof loreSetting.value?.text === 'string') {
      setLoreVault(loreSetting.value.text as string);
    }
  }, [loreSetting]);

  // ─── Actions ───
  async function log(level: string, message: string, details: Record<string, unknown> = {}) {
    try {
      await addLogMut.mutateAsync({
        level,
        source: 'world-builder',
        message,
        details,
        retryable: false,
        resolved: false,
      });
    } catch {
      // logging is best-effort; never block UX on it
    }
  }

  async function saveSynopsis() {
    if (!effectiveSeries) {
      addToast('Select a series before optimizing the universe.', 'warning');
      return;
    }
    setSavingSynopsis(true);
    try {
      const tone = featureState.auto_tone_derive ? deriveTone(synopsis) : (effectiveSeries.tone || deriveTone(synopsis));
      const visualTheme = featureState.auto_visual_derive ? deriveVisualTheme(synopsis) : (effectiveSeries.visual_theme || deriveVisualTheme(synopsis));
      await updateSeriesMut.mutateAsync({
        id: effectiveSeries.id,
        updates: { synopsis, tone, visual_theme: visualTheme },
      });
      addToast('Series synopsis optimized — future scripts will align to this universe.', 'success');
      await log('success', 'Series synopsis updated — tone & visual theme derived', { series_id: effectiveSeries.id });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      addToast(`Failed to save synopsis: ${msg}`, 'error');
      await log('error', 'Synopsis save failed', { error: msg });
    } finally {
      setSavingSynopsis(false);
    }
  }

  async function saveLoreVault() {
    setSavingLore(true);
    try {
      await saveSettingMut.mutateAsync({ key: 'lore_vault', value: { text: loreVault } });
      addToast('Lore vault saved.', 'success');
      await log('info', 'Lore vault updated', { length: loreVault.length });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      addToast(`Failed to save lore vault: ${msg}`, 'error');
      await log('error', 'Lore vault save failed', { error: msg });
    } finally {
      setSavingLore(false);
    }
  }

  async function generateIdeas() {
    if (!hasGeminiKey) {
      addToast('Gemini API key not configured. Add it in the Secure API Vault.', 'error');
      return;
    }
    setGeneratingIdeas(true);
    setSeriesIdeas([]);
    addToast('Generating fresh series ideas via Gemini…', 'info');
    await log('info', 'Triggering Gemini for series idea generation', { prompt: ideaPrompt });

    try {
      const systemInstruction =
        'You are a senior YouTube series strategist. Output ONLY a JSON array of exactly 5 fresh, trending, high-concept series ideas. ' +
        'Each element must be an object with a short "title" (max 8 words) and a "description" (2-3 sentences). ' +
        'No markdown, no prose outside the array.';
      const prompt =
        `Generate 5 fresh, trending, high-concept short-form video series ideas.\n` +
        (ideaPrompt.trim() ? `Creative direction: ${ideaPrompt.trim()}\n` : '') +
        (synopsis.trim() ? `Current series synopsis for tonal continuity: ${synopsis.trim()}\n` : '') +
        `Return a JSON array of 5 objects, each with "title" and "description".`;

      const raw = await callGemini(prompt, systemInstruction);
      const ideas = parseIdeas(raw);
      if (!ideas.length) {
        throw new Error('Could not parse any ideas from the Gemini response.');
      }
      setSeriesIdeas(ideas);
      addToast(`Generated ${ideas.length} fresh series ideas.`, 'success');
      await log('success', 'Series ideas generated via Gemini', { count: ideas.length });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      addToast(`Idea generation failed: ${msg}`, 'error');
      await log('error', 'Gemini idea generation failed', { error: msg });
    } finally {
      setGeneratingIdeas(false);
    }
  }

  function toggleBookmark(index: number) {
    setSeriesIdeas((prev) => prev.map((idea, i) => (i === index ? { ...idea, bookmarked: !idea.bookmarked } : idea)));
  }

  function toggleFeature(id: string) {
    setFeatureState((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  // ─── Calendar grid ───
  const calendarDays: CalendarDay[] = useMemo(() => {
    const days: CalendarDay[] = [];
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startOffset = firstDay.getDay();
    const today = new Date().toDateString();

    for (let i = 0; i < startOffset; i++) {
      days.push({ date: new Date(year, month, -startOffset + i + 1), isToday: false, inMonth: false });
    }
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const date = new Date(year, month, d);
      const ep = episodes.find((e) => {
        if (!e.scheduled_at && !e.published_at) return false;
        const epDate = new Date((e.published_at || e.scheduled_at) as string);
        return epDate.toDateString() === date.toDateString();
      });
      days.push({ date, episode: ep, isToday: date.toDateString() === today, inMonth: true });
    }
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({ date: new Date(year, month + 1, i), isToday: false, inMonth: false });
    }
    return days;
  }, [calendarMonth, episodes]);

  const monthLabel = calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const shiftMonth = (delta: number) =>
    setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));

  // Derived tone / visual theme for live preview.
  const previewTone = effectiveSeries?.tone || deriveTone(synopsis);
  const previewVisual = effectiveSeries?.visual_theme || deriveVisualTheme(synopsis);

  // ─── Render ───
  return (
    <div className="space-y-4">
      {/* Header */}
      <MotionPanel className="p-5">
        <h2 className="text-xl font-bold text-gradient mb-1">World Builder & Global Context Matrix</h2>
        <p className="text-sm text-ink-300">
          Centralized series synopsis drives all future scripts, characters, and visual themes.
        </p>
      </MotionPanel>

      {/* Sub-tabs */}
      <SubTabs
        tabs={WORLD_BUILDER_TABS}
        activeTab={activeTab}
        onTabChange={(id) => setActiveSubTab(SUB_TAB_KEY, id)}
      />

      {/* ─── Series Ideas ─── */}
      {activeTab === 'series_ideas' && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-4"
        >
          <Panel
            title="Series Ideas Engine"
            icon={<Sparkles size={15} />}
            action={
              effectiveSeries ? <Badge variant="accent">{effectiveSeries.title}</Badge> : <Badge>No series</Badge>
            }
          >
            <div className="p-4 space-y-4">
              {/* API key warning */}
              {!hasGeminiKey && (
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-warning-dim border border-warning/30">
                  <AlertTriangle size={15} className="text-warning shrink-0 mt-0.5" />
                  <p className="text-xs text-warning">
                    Gemini API key not configured. Add it in <span className="font-semibold">Settings → API Vault</span> to enable live idea generation.
                  </p>
                </div>
              )}

              {/* Prompt input */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-ink-200 block">Creative Direction (optional)</label>
                <input
                  type="text"
                  value={ideaPrompt}
                  onChange={(e) => setIdeaPrompt(e.target.value)}
                  placeholder="e.g. cozy mystery, sci-fi anthology, edutainment for kids…"
                  className="input-field text-sm"
                />
              </div>

              <MotionButton
                onClick={generateIdeas}
                disabled={generatingIdeas || !hasGeminiKey}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generatingIdeas ? <Spinner size={14} /> : <Sparkles size={15} />}
                {generatingIdeas ? 'Generating…' : 'Generate Ideas'}
              </MotionButton>

              {/* Idea cards */}
              {generatingIdeas && seriesIdeas.length === 0 && (
                <EmptyState icon={<Sparkles size={28} />} title="Generating ideas…" subtitle="Gemini is brainstorming fresh concepts." />
              )}
              {!generatingIdeas && seriesIdeas.length === 0 && (
                <EmptyState icon={<Sparkles size={28} />} title="No ideas yet" subtitle="Click Generate Ideas to pull 5 fresh concepts from Gemini." />
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {seriesIdeas.map((idea, i) => (
                  <MotionPanel key={i} className="p-4" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }}>
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="shrink-0 w-6 h-6 rounded-lg bg-accent-dim text-accent flex items-center justify-center text-xs font-bold">
                          {i + 1}
                        </span>
                        <h4 className="text-sm font-semibold text-ink-100 truncate">{idea.title}</h4>
                      </div>
                      <button
                        onClick={() => toggleBookmark(i)}
                        className={`shrink-0 transition-colors ${idea.bookmarked ? 'text-accent' : 'text-ink-400 hover:text-ink-200'}`}
                        title={idea.bookmarked ? 'Bookmarked' : 'Bookmark this idea'}
                      >
                        {idea.bookmarked ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
                      </button>
                    </div>
                    <p className="text-xs text-ink-300 leading-relaxed">{idea.description}</p>
                    {idea.bookmarked && <Badge variant="accent">Bookmarked</Badge>}
                  </MotionPanel>
                ))}
              </div>
            </div>
          </Panel>

          {/* Synopsis + feature toggles */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Panel title="Series Synopsis" icon={<Globe size={15} />}>
              <div className="p-4 space-y-3">
                <textarea
                  value={synopsis}
                  onChange={(e) => setSynopsis(e.target.value)}
                  rows={5}
                  className="input-field resize-none text-sm"
                  placeholder="Type a high-level series synopsis. Gemini will optimize all future scripts, characters, titles, tone, and visual themes to match this universe…"
                />
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                    <p className="text-[10px] text-ink-400 uppercase tracking-wide mb-1">Auto-Derived Tone</p>
                    <p className="text-xs text-accent">{previewTone}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                    <p className="text-[10px] text-ink-400 uppercase tracking-wide mb-1">Visual Theme</p>
                    <p className="text-xs text-accent">{previewVisual}</p>
                  </div>
                </div>
                <MotionButton
                  onClick={saveSynopsis}
                  disabled={savingSynopsis || !effectiveSeries}
                  className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingSynopsis ? <Spinner size={14} /> : <Wand2 size={15} />}
                  {savingSynopsis ? 'Optimizing…' : 'Optimize Universe'}
                </MotionButton>
              </div>
            </Panel>

            <Panel title="Feature Toggles" icon={<Check size={15} />}>
              <div className="p-4 space-y-2 max-h-[420px] overflow-y-auto scrollbar-hide">
                {WORLD_BUILDER_FEATURES.map((toggle: FeatureToggle) => (
                  <FeatureToggleRow
                    key={toggle.id}
                    toggle={toggle}
                    enabled={featureState[toggle.id] ?? toggle.defaultEnabled}
                    onToggle={() => toggleFeature(toggle.id)}
                  />
                ))}
              </div>
            </Panel>
          </div>
        </motion.div>
      )}

      {/* ─── Lore Vault ─── */}
      {activeTab === 'lore_vault' && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-4">
          <Panel title="World Lore Continuity Vault" icon={<BookOpen size={15} />}>
            <div className="p-4 space-y-3">
              <textarea
                value={loreVault}
                onChange={(e) => setLoreVault(e.target.value)}
                rows={10}
                className="input-field resize-none text-xs font-mono"
                placeholder="Document world rules, logic systems, running jokes, character backstories… Prevents story contradictions across weeks of production."
              />
              <MotionButton
                onClick={saveLoreVault}
                disabled={savingLore}
                className="btn-ghost w-full text-xs disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingLore ? <Spinner size={12} /> : <Check size={12} />}
                {savingLore ? 'Saving…' : 'Save Lore Vault'}
              </MotionButton>
            </div>
          </Panel>

          <Panel title="Characters in this Series" icon={<Users size={15} />} action={<Badge>{characters.length}</Badge>}>
            <div className="p-4">
              {characters.length === 0 ? (
                <EmptyState icon={<Users size={28} />} title="No characters yet" subtitle="Register characters in the Character World module." />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {characters.map((c) => (
                    <div key={c.id} className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                      <p className="text-sm font-medium text-ink-100">{c.name}</p>
                      {c.description && <p className="text-xs text-ink-400 mt-1 line-clamp-2">{c.description}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Panel>
        </motion.div>
      )}

      {/* ─── Content Calendar ─── */}
      {activeTab === 'content_calendar' && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <Panel
            title="Interactive Content Calendar"
            icon={<Calendar size={15} />}
            action={effectiveSeries ? <Badge variant="accent">{effectiveSeries.title}</Badge> : <Badge>No series</Badge>}
          >
            <div className="p-4">
              {!effectiveSeriesId && (
                <EmptyState icon={<Calendar size={28} />} title="No series selected" subtitle="Select a series to view its content calendar." />
              )}

              {effectiveSeriesId && (
                <>
                  {/* Month navigation */}
                  <div className="flex items-center justify-between mb-3">
                    <button onClick={() => shiftMonth(-1)} className="btn-ghost p-1.5" aria-label="Previous month">
                      <ChevronLeft size={16} />
                    </button>
                    <span className="text-sm font-medium text-ink-100">{monthLabel}</span>
                    <button onClick={() => shiftMonth(1)} className="btn-ghost p-1.5" aria-label="Next month">
                      <ChevronRight size={16} />
                    </button>
                  </div>

                  {/* Weekday header */}
                  <div className="grid grid-cols-7 gap-1 mb-1">
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                      <div key={i} className="text-center text-[10px] text-ink-500 font-medium py-1">{d}</div>
                    ))}
                  </div>

                  {/* Day grid */}
                  <div className="grid grid-cols-7 gap-1">
                    {calendarDays.map((day, i) => {
                      const status = day.episode?.status;
                      const isPublished = status === 'published';
                      const isScheduled = status === 'scheduled' || status === 'draft';
                      return (
                        <button
                          key={i}
                          onClick={() => day.episode && setShowHistoryModal(day.episode)}
                          className={[
                            'aspect-square rounded-lg flex flex-col items-center justify-center text-xs transition-all',
                            !day.inMonth ? 'opacity-30' : '',
                            day.isToday ? 'border border-accent bg-accent-dim' : 'border border-white/[0.04] bg-white/[0.02]',
                            day.episode ? 'hover:border-accent/40 hover:bg-white/[0.05] cursor-pointer' : 'cursor-default',
                          ].join(' ')}
                        >
                          <span className={day.isToday ? 'text-accent font-bold' : day.episode ? 'text-ink-100' : 'text-ink-400'}>
                            {day.date.getDate()}
                          </span>
                          {day.episode && (
                            <span
                              className={[
                                'w-1.5 h-1.5 rounded-full mt-0.5',
                                isPublished ? 'bg-success' : isScheduled ? 'bg-warning' : 'bg-ink-500',
                              ].join(' ')}
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Legend */}
                  <div className="flex items-center gap-4 mt-3 text-[10px] text-ink-400 flex-wrap">
                    <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-success" /> Published</span>
                    <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-warning" /> Scheduled / Draft</span>
                    <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-accent" /> Today</span>
                  </div>

                  {episodes.length === 0 && (
                    <p className="text-xs text-ink-400 mt-3 text-center">No episodes scheduled for this series yet.</p>
                  )}
                </>
              )}
            </div>
          </Panel>
        </motion.div>
      )}

      {/* ─── History Modal ─── */}
      <AnimatePresence>
        {showHistoryModal && (
          <MotionModal onClose={() => setShowHistoryModal(null)}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-semibold text-ink-50">
                  Episode History — Ep {showHistoryModal.episode_number}
                </h3>
                <p className="text-xs text-ink-400">{showHistoryModal.title || 'Untitled'}</p>
              </div>
              <button onClick={() => setShowHistoryModal(null)} className="text-ink-400 hover:text-ink-100" aria-label="Close">
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                <p className="text-[10px] text-ink-400 uppercase">Status</p>
                <p className="text-sm text-accent">{showHistoryModal.status}</p>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                <p className="text-[10px] text-ink-400 uppercase">Published</p>
                <p className="text-sm text-ink-100">
                  {showHistoryModal.published_at ? new Date(showHistoryModal.published_at).toLocaleDateString() : '—'}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                <p className="text-[10px] text-ink-400 uppercase">Virality</p>
                <p className="text-sm text-success">
                  {Math.round(
                    Object.values(showHistoryModal.virality_score || {}).reduce((a, b) => a + b, 0) /
                      Math.max(1, Object.keys(showHistoryModal.virality_score || {}).length)
                  )}
                  /100
                </p>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                <p className="text-[10px] text-ink-400 uppercase">Resolution</p>
                <p className="text-sm text-ink-100">
                  {(showHistoryModal.metadata?.resolution as string) || '4K'}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-[10px] text-ink-400 uppercase mb-1">Hook</p>
                <p className="text-xs text-ink-200">{showHistoryModal.script?.hook || 'No hook recorded'}</p>
              </div>
              <div>
                <p className="text-[10px] text-ink-400 uppercase mb-1">CTA</p>
                <p className="text-xs text-ink-200">{showHistoryModal.script?.cta || 'No CTA recorded'}</p>
              </div>
              <div>
                <p className="text-[10px] text-ink-400 uppercase mb-1">SEO Keywords</p>
                <div className="flex flex-wrap gap-1.5">
                  {(showHistoryModal.script?.seo_keywords || []).length === 0 ? (
                    <span className="text-xs text-ink-400">No keywords recorded</span>
                  ) : (
                    (showHistoryModal.script?.seo_keywords || []).map((kw, i) => (
                      <Badge key={i} variant="neutral">{kw}</Badge>
                    ))
                  )}
                </div>
              </div>
            </div>
          </MotionModal>
        )}
      </AnimatePresence>
    </div>
  );
}
