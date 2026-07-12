// --- src/modules/WorldBuilderModule.tsx ---
import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Globe, Calendar, Sparkles, BookOpen, Wand2, X, Check,
  ChevronLeft, ChevronRight, Bookmark, BookmarkCheck, AlertTriangle, Users, Video
} from 'lucide-react';

import { type Episode } from '../../lib/supabase';
import { useActiveStore, useToastStore, useApiVaultStore, useNavStore } from '../../lib/stores';
import {
  useSeriesQuery, useActiveSeriesQuery, useUpdateSeriesMutation,
  useEpisodesQuery, useSettingsQuery, useSaveSettingMutation,
  useAddLogMutation, useCharactersQuery,
} from '../../lib/queries';

import { generateAIContent } from '../../lib/geminiClient';
import { WORLD_BUILDER_TABS, WORLD_BUILDER_FEATURES, type FeatureToggle } from '../../lib/featuresConfig';
import { Panel, Badge, Spinner, EmptyState } from '../ui/Primitives';
import { MotionPanel, MotionButton, SubTabs, FeatureToggleRow, MotionModal } from '../ui/Animated';

type SeriesIdea = { title: string; description: string; bookmarked: boolean };
type CalendarDay = { date: Date; episode?: Episode; isToday: boolean; inMonth: boolean; };

const SUB_TAB_KEY = 'world_builder';

function deriveTone(s: string): string {
  if (!s) return 'Engaging, cinematic';
  if (/dark|thriller|horror|crime|noir/i.test(s)) return 'Dark, suspenseful, cinematic';
  if (/funny|comedy|humor|satire|parody/i.test(s)) return 'Light, humorous, playful';
  return 'Heartwarming, engaging, cinematic';
}

function deriveVisualTheme(s: string): string {
  if (!s) return 'Standard 3D render';
  if (/sci-fi|space|future|cyber/i.test(s)) return 'Sci-fi 3D, neon volumetric lighting';
  if (/fantasy|magic|medieval/i.test(s)) return 'Fantasy 3D, ethereal lighting';
  return 'Disney Pixar 3D style, octane render';
}

// Resilient parsing to prevent silent failures
function parseIdeas(raw: string): SeriesIdea[] {
  if (!raw) return [];
  const cleaned = raw.trim();
  try {
    const jsonStart = cleaned.indexOf('[');
    const jsonEnd = cleaned.lastIndexOf(']');
    if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
      const parsed = JSON.parse(cleaned.slice(jsonStart, jsonEnd + 1));
      if (Array.isArray(parsed)) {
        return parsed.map((item) => ({
          title: item.title || item.name || 'Untitled Idea',
          description: item.description || item.synopsis || 'No description provided',
          bookmarked: false
        })).slice(0, 5);
      }
    }
  } catch { /* Fallback to line parsing */ }

  const lines = cleaned.split('\n').map((l) => l.replace(/^[\s>*\-"'\d.)\]]+/, '').trim()).filter((l) => l.length > 12);
  return lines.slice(0, 5).map(line => {
    const sep = line.indexOf(':');
    return sep > 0 && sep < 80 
      ? { title: line.slice(0, sep).trim(), description: line.slice(sep + 1).trim(), bookmarked: false }
      : { title: line.slice(0, 80), description: line, bookmarked: false };
  });
}

export function WorldBuilderModule({ seriesId }: { seriesId: string | null }) {
  const activeSeriesId = useActiveStore((s) => s.activeSeriesId);
  const projectMode = useActiveStore((s) => s.projectMode);
  const addToast = useToastStore((s) => s.addToast);
  const hasGeminiKey = useApiVaultStore((s) => s.hasKey('gemini_api_key'));

  const { data: seriesList } = useSeriesQuery();
  const activeSeries = useActiveSeriesQuery();
  const updateSeriesMut = useUpdateSeriesMutation();

  const { data: episodes = [] } = useEpisodesQuery(seriesId);
  const { data: characters = [] } = useCharactersQuery(seriesId);
  const { data: settings } = useSettingsQuery();
  const saveSettingMut = useSaveSettingMutation();

  const activeTab = useNavStore((s) => s.activeSubTab[SUB_TAB_KEY]) || WORLD_BUILDER_TABS[0].id;
  const setActiveSubTab = useNavStore((s) => s.setActiveSubTab);

  const [synopsis, setSynopsis] = useState('');
  const [loreVault, setLoreVault] = useState('');
  const [ideaPrompt, setIdeaPrompt] = useState('');
  const [seriesIdeas, setSeriesIdeas] = useState<SeriesIdea[]>([]);
  const [generatingIdeas, setGeneratingIdeas] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [showHistoryModal, setShowHistoryModal] = useState<Episode | null>(null);
  
  const effectiveSeriesId = seriesId ?? activeSeriesId ?? activeSeries?.id ?? null;
  const effectiveSeries = useMemo(() => seriesList?.find((s) => s.id === effectiveSeriesId) ?? activeSeries ?? null, [seriesList, effectiveSeriesId, activeSeries]);

  useEffect(() => {
    if (effectiveSeries) setSynopsis(effectiveSeries.synopsis || '');
  }, [effectiveSeries]);

  const loreSetting = settings?.find((s) => s.key === 'lore_vault');
  useEffect(() => {
    if (loreSetting && typeof loreSetting.value?.text === 'string') {
      setLoreVault(loreSetting.value.text as string);
    }
  }, [loreSetting]);

  const generateIdeas = async () => {
    if (!hasGeminiKey) return addToast('AI Engine key missing.', 'error');
    setGeneratingIdeas(true);
    try {
      const prompt = `Generate 5 fresh, trending, high-concept short-form video ideas.\n${ideaPrompt.trim() ? `Direction: ${ideaPrompt.trim()}\n` : ''}`;
      const raw = await generateAIContent({ prompt, systemInstruction: 'Output JSON array of {title, description}.' });
      const ideas = parseIdeas(raw);
      if (!ideas.length) throw new Error('No valid ideas parsed');
      setSeriesIdeas(ideas);
    } catch (err) {
      addToast(`Generation failed: ${err instanceof Error ? err.message : 'Unknown'}`, 'error');
    } finally {
      setGeneratingIdeas(false);
    }
  };

  // ─── CRITICAL BUG FIX: Protected Calendar Parsing ───
  const calendarDays: CalendarDay[] = useMemo(() => {
    try {
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
          // Protected date parsing
          const timestamp = Date.parse((e.published_at || e.scheduled_at) as string);
          if (isNaN(timestamp)) return false;
          return new Date(timestamp).toDateString() === date.toDateString();
        });
        days.push({ date, episode: ep, isToday: date.toDateString() === today, inMonth: true });
      }
      
      const remaining = 42 - days.length;
      for (let i = 1; i <= remaining; i++) {
        days.push({ date: new Date(year, month + 1, i), isToday: false, inMonth: false });
      }
      return days;
    } catch (err) {
      console.error("Calendar rendering failed safely", err);
      return []; // Return empty grid on fatal crash
    }
  }, [calendarMonth, episodes]);

  // If in individual mode, we alter the UI to make sense for standalone videos
  if (projectMode === 'individual') {
    return (
      <div className="space-y-4">
        <MotionPanel className="p-5">
          <h2 className="text-xl font-bold text-gradient mb-1 flex items-center gap-2">
            <Video size={20} /> Project Context Matrix
          </h2>
          <p className="text-sm text-ink-300">Standalone videos do not utilize series continuity, lore vaults, or global calendars.</p>
        </MotionPanel>
        <Panel title="Individual Video Ideation" icon={<Sparkles size={15}/>}>
           <div className="p-4 space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-ink-200 block">Standalone Video Concept Engine</label>
                <input type="text" value={ideaPrompt} onChange={(e) => setIdeaPrompt(e.target.value)} placeholder="Enter a topic (e.g. History facts, tech news...)" className="input-field text-sm" />
              </div>
              <MotionButton onClick={generateIdeas} disabled={generatingIdeas || !hasGeminiKey} className="btn-primary">
                {generatingIdeas ? <Spinner size={14} /> : <Sparkles size={15} />} Generate Standalone Hooks
              </MotionButton>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                {seriesIdeas.map((idea, i) => (
                  <div key={i} className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                    <h4 className="text-sm font-semibold text-ink-100 truncate mb-1">{idea.title}</h4>
                    <p className="text-xs text-ink-300">{idea.description}</p>
                  </div>
                ))}
              </div>
           </div>
        </Panel>
      </div>
    );
  }

  // --- SERIES MODE UI (Original UI with crash fixes applied) ---
  return (
    <div className="space-y-4">
      <MotionPanel className="p-5">
        <h2 className="text-xl font-bold text-gradient mb-1">World Builder & Global Context Matrix</h2>
        <p className="text-sm text-ink-300">Centralized series synopsis drives all future scripts.</p>
      </MotionPanel>
      <SubTabs tabs={WORLD_BUILDER_TABS} activeTab={activeTab} onTabChange={(id) => setActiveSubTab(SUB_TAB_KEY, id)} />
      
      {activeTab === 'series_ideas' && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <Panel title="Series Ideas Engine" icon={<Sparkles size={15} />}>
            <div className="p-4 space-y-4">
              <input type="text" value={ideaPrompt} onChange={(e) => setIdeaPrompt(e.target.value)} placeholder="Creative Direction..." className="input-field text-sm" />
              <MotionButton onClick={generateIdeas} disabled={generatingIdeas || !hasGeminiKey} className="btn-primary">
                {generatingIdeas ? <Spinner size={14} /> : <Sparkles size={15} />} Generate Series Hooks
              </MotionButton>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {seriesIdeas.map((idea, i) => (
                   <div key={i} className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                    <h4 className="text-sm font-semibold text-ink-100 truncate mb-1">{idea.title}</h4>
                    <p className="text-xs text-ink-300">{idea.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </Panel>
        </motion.div>
      )}

      {activeTab === 'content_calendar' && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <Panel title="Interactive Content Calendar" icon={<Calendar size={15} />}>
            <div className="p-4">
              {calendarDays.length > 0 ? (
                <div className="grid grid-cols-7 gap-1">
                  {calendarDays.map((day, i) => (
                    <button key={i} className={`aspect-square rounded-lg flex flex-col items-center justify-center text-xs transition-all ${!day.inMonth ? 'opacity-30' : ''} ${day.isToday ? 'border border-accent bg-accent-dim' : 'border border-white/[0.04] bg-white/[0.02]'}`}>
                      <span className={day.isToday ? 'text-accent font-bold' : day.episode ? 'text-ink-100' : 'text-ink-400'}>{day.date.getDate()}</span>
                      {day.episode && <span className="w-1.5 h-1.5 rounded-full mt-0.5 bg-accent" />}
                    </button>
                  ))}
                </div>
              ) : (
                 <EmptyState icon={<Calendar size={28} />} title="Calendar Error" subtitle="Unable to render dates. Check your episode data." />
              )}
            </div>
          </Panel>
        </motion.div>
      )}
    </div>
  );
}
  
