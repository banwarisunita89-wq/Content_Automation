// --- src/modules/ScriptLabModule.tsx ---
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Sparkles, Film, TrendingUp, Send, Wand2, Copy, Loader2,
  AlertTriangle, FileText, Sun, Users, Tag, RefreshCw, Lock, ChevronRight,
  Trash2, Activity, Zap, Gauge, Video
} from 'lucide-react';

import {
  useScriptStore,
  useActiveStore,
  useNavStore,
  useToastStore,
  useApiVaultStore,
} from '../../lib/stores';

import {
  useSeriesQuery,
  useEpisodesQuery,
  useCreateEpisodeMutation,
  useUpdateEpisodeMutation,
  useAddLogMutation,
} from '../../lib/queries';

// ─── Phase 1 Engine Integration ───
import { generateAIContent } from '../../lib/geminiClient';

import {
  SCRIPT_LAB_TABS,
  SCRIPT_LAB_FEATURES,
  SCRIPT_LAB_INPUTS,
  SCRIPT_LAB_P3_FEATURES,
  TONE_PRESETS,
  type FeatureToggle,
} from '../../lib/featuresConfig';

import type { ScriptData, SceneData, Episode } from '../../lib/supabase';

import { MotionPanel, MotionButton, SubTabs, FeatureToggleRow } from '../ui/Animated';

type LanguageCode = 'en' | 'hi' | 'hinglish';
const LANGUAGE_OPTIONS: { label: string; code: LanguageCode }[] = [
  { label: 'English', code: 'en' },
  { label: 'Hindi', code: 'hi' },
  { label: 'Hinglish', code: 'hinglish' },
];

const LANG_LABEL_TO_CODE: Record<string, LanguageCode> = {
  English: 'en',
  Hindi: 'hi',
  Hinglish: 'hinglish',
};

type ViralityScore = { retention: number; ctr: number; shareability: number; resonance: number; };
const DEFAULT_SCORE: ViralityScore = { retention: 0, ctr: 0, shareability: 0, resonance: 0 };

function isViralityScore(value: unknown): value is ViralityScore {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.retention === 'number' && typeof v.ctr === 'number' && typeof v.shareability === 'number' && typeof v.resonance === 'number';
}

function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return candidate.trim();
  return candidate.slice(start, end + 1).trim();
}

function buildGeminiPrompt(opts: {
  projectMode: 'series' | 'individual';
  seriesTitle: string;
  seriesSynopsis: string;
  seriesTone: string;
  episodeNumber: number;
  previousContext: string;
  language: LanguageCode;
  toneOverride: string;
  targetDuration: number;
  customPrompt: string;
  enabledFeatures: string[];
}): string {
  const langName = LANGUAGE_OPTIONS.find((l) => l.code === opts.language)?.label || 'English';
  const featureDirectives = opts.enabledFeatures.length ? `\nACTIVE ENHANCEMENT MODULES: ${opts.enabledFeatures.join(', ')}.` : '';
  
  const modeDirectives = opts.projectMode === 'series' 
    ? `SERIES: "${opts.seriesTitle}".\nSYNOPSIS: ${opts.seriesSynopsis || 'N/A'}.\nEPISODE NUMBER: ${opts.episodeNumber}.\nPREVIOUS EPISODE CONTEXT: ${opts.previousContext}\nCRITICAL: You MUST maintain story continuity with the previous episode context.`
    : `PROJECT TYPE: Standalone Individual Video.\nCRITICAL: This is a single, self-contained video. Do not reference previous or future episodes.`;

  return [
    `You are an elite viral short-form video scriptwriter for an AI-animated production.`,
    modeDirectives,
    `TONE: ${opts.toneOverride || opts.seriesTone || 'engaging, cinematic'}.`,
    `TARGET DURATION: ${opts.targetDuration} seconds.`,
    `LANGUAGE: ${langName} (write all dialogue and on-screen text in ${langName}).`,
    featureDirectives,
    opts.customPrompt ? `\nADDITIONAL INSTRUCTIONS: ${opts.customPrompt}` : '',
    ``,
    `CRITICAL INSTRUCTION: You MUST output the ENTIRE script. Do not stop after the hook. Do not truncate the JSON.`,
    `Respond with ONLY a single JSON object (no markdown, no commentary) with this exact schema:`,
    `{`,
    `  "hook": string,                          // 3-second attention-grabbing opening line`,
    `  "scenes": [`,
    `    {`,
    `      "shot": string,                       // shot type, e.g. "Wide establishing", "Close-up"`,
    `      "description": string,                // deep spatial/visual description of the shot`,
    `      "dialogue": string,                    // the spoken line for this scene`,
    `      "lighting": string,                   // volumetric studio lighting directive`,
    `      "expression": string                  // character emotional direction for this line`,
    `    }`,
    `  ],`,
    `  "cta": string,                            // high-conversion call-to-action`,
    `  "seo_keywords": string[]                  // 6-10 SEO keywords mined for this video`,
    `}`,
    `Generate exactly enough scenes to fill a ${opts.targetDuration}s vertical video.`,
  ].filter(Boolean).join('\n');
}

export function ScriptLabModule({ seriesId }: { seriesId: string | null }) {
  const currentScript = useScriptStore((s) => s.currentScript);
  const setScript = useScriptStore((s) => s.setScript);
  const clearScript = useScriptStore((s) => s.clearScript);
  const addVariant = useScriptStore((s) => s.addVariant);
  const isGenerating = useScriptStore((s) => s.isGenerating);
  const setGenerating = useScriptStore((s) => s.setGenerating);
  const language = useScriptStore((s) => s.language);
  const setLanguage = useScriptStore((s) => s.setLanguage);

  const setActiveSeries = useActiveStore((s) => s.setActiveSeries);
  const setActiveEpisode = useActiveStore((s) => s.setActiveEpisode);
  const projectMode = useActiveStore((s) => s.projectMode);

  const setActiveModule = useNavStore((s) => s.setActiveModule);
  const setSpotlight = useNavStore((s) => s.setSpotlight);

  const addToast = useToastStore((s) => s.addToast);
  const hasGeminiKey = useApiVaultStore((s) => s.hasKey('gemini_api_key'));

  const { data: seriesList = [], isLoading: seriesLoading } = useSeriesQuery();
  const { data: episodes = [], isLoading: episodesLoading } = useEpisodesQuery(seriesId);
  const createEpisodeMut = useCreateEpisodeMutation();
  const updateEpisodeMut = useUpdateEpisodeMutation();
  const addLogMut = useAddLogMutation();

  const [activeTab, setActiveTab] = useState<string>('generator');
  const [selectedSeriesId, setSelectedSeriesId] = useState<string | null>(seriesId);
  const [episodeNumber, setEpisodeNumber] = useState<number>(1);
  const [toneOverride, setToneOverride] = useState<string>('');
  const [targetDuration, setTargetDuration] = useState<number>(60);
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [featureState, setFeatureState] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(SCRIPT_LAB_FEATURES.map((f) => [f.id, f.defaultEnabled]))
  );
  const [activeEpisode, setActiveEpisodeState] = useState<Episode | null>(null);
  const [viralityScore, setViralityScore] = useState<ViralityScore>(DEFAULT_SCORE);
  const [typedText, setTypedText] = useState<string>('');
  const [editBuffer, setEditBuffer] = useState<string>('');
  const typingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (seriesId && !selectedSeriesId) setSelectedSeriesId(seriesId);
  }, [seriesId, selectedSeriesId]);

  useEffect(() => {
    if (projectMode === 'series' && episodes.length > 0) {
      const maxNum = Math.max(...episodes.map((e) => e.episode_number));
      setEpisodeNumber((prev) => (prev < 1 ? maxNum + 1 : prev));
    } else if (projectMode === 'individual') {
      setEpisodeNumber(1); 
    }
  }, [episodes, projectMode]);

  const loadEpisodeIntoEditor = useCallback((ep: Episode) => {
    setActiveEpisodeState(ep);
    setActiveEpisode(ep.id);
    if (ep.script) {
      setScript(ep.script);
      setEditBuffer(JSON.stringify(ep.script, null, 2));
    } else {
      setEditBuffer('');
    }
    if (isViralityScore(ep.virality_score)) setViralityScore(ep.virality_score);
    else setViralityScore(DEFAULT_SCORE);
  }, [setActiveEpisode, setScript]);

  useEffect(() => {
    if (episodes.length > 0 && !activeEpisode) {
      const draft = episodes.find((e) => e.status === 'draft' || e.status === 'pending_review') || episodes[0];
      loadEpisodeIntoEditor(draft);
    }
  }, [episodes, activeEpisode, loadEpisodeIntoEditor]);

  useEffect(() => {
    return () => {
      if (typingTimerRef.current) clearInterval(typingTimerRef.current);
    };
  }, []);

  const runTypingEffect = useCallback((fullText: string, onDone?: () => void) => {
    if (typingTimerRef.current) clearInterval(typingTimerRef.current);
    setTypedText('');
    let i = 0;
    typingTimerRef.current = setInterval(() => {
      i += 5; // Sped up for UX
      setTypedText(fullText.slice(0, i));
      if (i >= fullText.length) {
        if (typingTimerRef.current) clearInterval(typingTimerRef.current);
        typingTimerRef.current = null;
        setTypedText(fullText);
        onDone?.();
      }
    }, 16);
  }, []);

  const [selectedToneId, setSelectedToneId] = useState<string>('');
  const tonePrefix = useMemo(() => {
    if (!selectedToneId) return '';
    const preset = TONE_PRESETS.find((t) => t.id === selectedToneId);
    return preset ? `\nTONE DIRECTIVE: Write in a ${preset.label.toLowerCase()} tone. Lean into ${preset.label.toLowerCase()} delivery, word choice, and pacing.\n` : '';
  }, [selectedToneId]);

  const handleGenerate = useCallback(async () => {
    if (!hasGeminiKey) {
      addToast('AI Engine key not configured. Add it in the Secure API Vault.', 'error');
      return;
    }
    if (projectMode === 'series' && !selectedSeriesId) {
      addToast('Select a series before generating.', 'warning');
      return;
    }

    const series = projectMode === 'series' ? seriesList.find((s) => s.id === selectedSeriesId) || null : null;
    
    // Continuity logic
    let previousContext = 'No previous context available.';
    if (projectMode === 'series' && episodeNumber > 1) {
       const prevEp = episodes.find(e => e.episode_number === episodeNumber - 1);
       if (prevEp?.script) {
         previousContext = `In Episode ${episodeNumber - 1}, the story ended with: "${prevEp.script.cta}". Dialogue summary: "${prevEp.script.dialogue?.substring(0, 300)}"`;
       }
    }

    clearScript();
    setActiveEpisodeState(null);
    setActiveEpisode(null);
    setViralityScore(DEFAULT_SCORE);
    setTypedText('');
    setEditBuffer('');
    setGenerating(true);
    if (selectedSeriesId) setActiveSeries(selectedSeriesId);

    const enabledFeatures = Object.keys(featureState).filter((id) => featureState[id]);
    const prompt = buildGeminiPrompt({
      projectMode,
      seriesTitle: series?.title || 'Individual Video Project',
      seriesSynopsis: series?.synopsis || '',
      seriesTone: series?.tone || '',
      episodeNumber,
      previousContext,
      language,
      toneOverride: tonePrefix + toneOverride,
      targetDuration,
      customPrompt,
      enabledFeatures,
    });

    const systemInstruction = 'You are a JSON-only response engine. Output strictly valid JSON. Output the entire script.';

    try {
      // ─── PHASE 1 ARCHITECTURE: USING THE CACHED SMART FETCHER ───
      const raw = await generateAIContent({
        prompt,
        systemInstruction,
        maxOutputTokens: 8192 // Ensure enough tokens for full script
      });

      const jsonStr = extractJson(raw);
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(jsonStr);
      } catch {
        throw new Error('AI response was not valid JSON.');
      }

      const scenes = Array.isArray(parsed.scenes) ? (parsed.scenes as SceneData[]) : [];
      const newScript: ScriptData = {
        hook: typeof parsed.hook === 'string' ? parsed.hook : '',
        scenes,
        cta: typeof parsed.cta === 'string' ? parsed.cta : '',
        seo_keywords: Array.isArray(parsed.seo_keywords) ? (parsed.seo_keywords as string[]) : [],
        dialogue: scenes.map((sc) => sc.dialogue).join('\n'),
        storyboard: scenes.map((sc, i) => `SHOT ${i + 1} [${sc.shot}]: ${sc.description}`).join('\n\n'),
        character_expressions: Object.fromEntries(scenes.map((sc, i) => [`Scene ${i + 1}`, sc.expression])),
        lighting: scenes.map((sc) => sc.lighting).join('\n'),
        raw,
      };

      setScript(newScript);
      setEditBuffer(JSON.stringify(newScript, null, 2));
      addVariant(newScript);

      const typingSource = [
        `HOOK: ${newScript.hook}`,
        ...scenes.map((sc, i) => `SCENE ${i + 1} [${sc.shot}]: ${sc.dialogue}`),
        `CTA: ${newScript.cta}`,
      ].join('\n');
      runTypingEffect(typingSource);

      const base = 60;
      const featureBoost = Math.min(enabledFeatures.length * 2, 30);
      const sceneBoost = Math.min(scenes.length * 3, 12);
      const jitter = (seed: number) => Math.min(99, base + featureBoost + sceneBoost + ((seed * 7) % 10));
      const score: ViralityScore = { retention: jitter(1), ctr: jitter(2), shareability: jitter(3), resonance: jitter(4) };
      setViralityScore(score);

      const created = await createEpisodeMut.mutateAsync({
        series_id: projectMode === 'series' ? selectedSeriesId : null, // Support individual standalone
        episode_number: episodeNumber,
        title: projectMode === 'series' ? `${series?.title} — Ep ${episodeNumber}` : `Standalone Video - ${new Date().toLocaleDateString()}`,
        script: newScript,
        script_variants: [newScript],
        active_variant_index: 0,
        status: 'draft',
        virality_score: score as unknown as Record<string, number>,
        metadata: { language, targetDuration, toneOverride, enabledFeatures },
      });

      if (created) {
        setActiveEpisodeState(created);
        setActiveEpisode(created.id);
      }

      addToast(`Script generated successfully.`, 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      addToast(`Generation failed: ${message}`, 'error');
    } finally {
      setGenerating(false);
    }
  }, [
    hasGeminiKey, projectMode, selectedSeriesId, seriesList, episodeNumber, language, toneOverride, tonePrefix,
    targetDuration, customPrompt, featureState, clearScript, setActiveEpisode,
    setViralityScore, setGenerating, setActiveSeries, addToast, addLogMut,
    setScript, addVariant, runTypingEffect, createEpisodeMut, episodes
  ]);

  const handleSaveVariant = useCallback(async () => {
    if (!activeEpisode) {
      addToast('No active episode to save a variant for.', 'warning');
      return;
    }
    let parsed: ScriptData;
    try {
      parsed = JSON.parse(editBuffer) as ScriptData;
    } catch {
      addToast('Script JSON is invalid — fix before saving.', 'error');
      return;
    }
    setScript(parsed);
    addVariant(parsed);
    const updatedVariants = [...(activeEpisode.script_variants || []), parsed];
    await updateEpisodeMut.mutateAsync({
      id: activeEpisode.id,
      updates: { script: parsed, script_variants: updatedVariants, active_variant_index: updatedVariants.length - 1 },
    });
    addToast(`Variant ${updatedVariants.length} saved.`, 'success');
  }, [activeEpisode, editBuffer, setScript, addVariant, updateEpisodeMut, addToast]);

  const handleLockAndDispatch = useCallback(async () => {
    if (!currentScript) {
      addToast('No script to lock. Generate or load one first.', 'warning');
      return;
    }
    setScript(currentScript);
    if (activeEpisode) {
      await updateEpisodeMut.mutateAsync({
        id: activeEpisode.id,
        updates: { status: 'approved', script: currentScript },
      });
    }
    addToast('Script locked. Routing to Production Studio...', 'success');
    setActiveModule('studio');
  }, [currentScript, activeEpisode, setScript, updateEpisodeMut, addToast, setActiveModule]);

  const handlePurgeDrafts = useCallback(() => {
    clearScript();
    setActiveEpisodeState(null);
    setActiveEpisode(null);
    setEditBuffer('');
    setTypedText('');
    setViralityScore(DEFAULT_SCORE);
    addToast('Script cache purged. Ready for fresh generation.', 'info');
  }, [clearScript, setActiveEpisode, addToast]);

  // Derived metrics
  const wordCount = useMemo(() => {
    if (!currentScript) return 0;
    const text = [currentScript.hook, currentScript.dialogue, currentScript.cta].filter(Boolean).join(' ');
    return text ? text.split(/\s+/).filter(Boolean).length : 0;
  }, [currentScript]);
  const WORDS_MAX = 145; 
  const wordPct = Math.min(100, Math.round((wordCount / WORDS_MAX) * 100));
  const wordOver = wordCount > WORDS_MAX;

  return (
    <div className="space-y-4">
      {/* Header */}
      <MotionPanel className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gradient mb-1">Script Lab & Viral Generator</h2>
          <p className="text-sm text-ink-300">
            {projectMode === 'individual' ? 'Craft standalone viral hooks.' : 'Engineer multi-layer hooks, ensure storyline continuity.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={projectMode === 'series' ? 'accent' : 'success'}>
            {projectMode === 'series' ? <Film size={12} className="mr-1"/> : <Video size={12} className="mr-1"/>}
            {projectMode === 'series' ? 'Series Mode' : 'Individual Mode'}
          </Badge>
          <MotionButton onClick={handleGenerate} disabled={isGenerating || !hasGeminiKey} className="btn-primary">
            {isGenerating ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
            {isGenerating ? 'Generating...' : 'Regenerate Script'}
          </MotionButton>
        </div>
      </MotionPanel>

      <SubTabs tabs={SCRIPT_LAB_TABS} activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === 'generator' && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            
            {/* Conditional Project UI Context */}
            <MotionPanel className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Film size={15} className="text-accent" />
                <h3 className="text-sm font-semibold text-ink-100">Project Context</h3>
                <button onClick={handlePurgeDrafts} className="ml-auto flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20">
                  <Trash2 size={13} /> Purge Drafts
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                
                {/* Series Only UI Elements */}
                {projectMode === 'series' && (
                  <>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-ink-200">Select Series</label>
                      <select value={selectedSeriesId ?? ''} onChange={(e) => setSelectedSeriesId(e.target.value || null)} className="input-field" disabled={seriesLoading}>
                        <option value="">{seriesLoading ? 'Loading…' : 'Choose series…'}</option>
                        {seriesList.map((s) => (
                          <option key={s.id} value={s.id}>{s.title}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-ink-200">Select Episode No.</label>
                      <input type="number" min={1} value={episodeNumber} onChange={(e) => setEpisodeNumber(Math.max(1, Number(e.target.value) || 1))} className="input-field" />
                    </div>
                  </>
                )}

                {/* Individual UI Elements */}
                {projectMode === 'individual' && (
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-xs font-medium text-ink-200">Standalone Project Target</label>
                    <div className="input-field flex items-center text-ink-300">Single Video Workflow (Continuity Disabled)</div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-ink-200">Language</label>
                  <select value={language} onChange={(e) => setLanguage(e.target.value as LanguageCode)} className="input-field">
                    <option value="en">English</option>
                    <option value="hi">Hindi</option>
                    <option value="hinglish">Hinglish</option>
                  </select>
                </div>
              </div>
            </MotionPanel>

            <MotionPanel className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Wand2 size={15} className="text-accent" />
                <h3 className="text-sm font-semibold text-ink-100">Generator Configuration</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                 <div className="space-y-1.5">
                    <label className="text-xs font-medium text-ink-200">Tone Override</label>
                    <input type="text" value={toneOverride} placeholder="e.g. suspenseful, energetic..." onChange={(e) => setToneOverride(e.target.value)} className="input-field" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-ink-200">Target Duration (s)</label>
                    <input type="number" min={15} max={180} value={targetDuration} onChange={(e) => setTargetDuration(Math.max(15, Number(e.target.value) || 60))} className="input-field" />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-xs font-medium text-ink-200">Custom Prompt</label>
                    <textarea rows={3} value={customPrompt} placeholder="Special instructions for the AI..." onChange={(e) => setCustomPrompt(e.target.value)} className="input-field resize-none" />
                  </div>
              </div>
            </MotionPanel>

            <MotionPanel className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles size={15} className="text-accent" />
                <h3 className="text-sm font-semibold text-ink-100">Live Generation</h3>
                {isGenerating && <span className="ml-auto text-[10px] text-accent"><Loader2 size={11} className="animate-spin inline" /> streaming</span>}
              </div>
              <pre className="text-xs font-mono text-ink-200 whitespace-pre-wrap min-h-[120px] p-3 rounded-xl bg-black/30 border border-white/[0.04]">
                {typedText || (isGenerating ? 'Awaiting AI response...' : 'Press "Regenerate Script" to begin.')}
              </pre>
            </MotionPanel>
          </div>

          <div className="space-y-4">
            <MotionPanel className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Film size={15} className="text-accent" />
                <h3 className="text-sm font-semibold text-ink-100">Enhancement Modules</h3>
              </div>
              <div className="space-y-2">
                {SCRIPT_LAB_FEATURES.map((toggle: FeatureToggle) => (
                  <FeatureToggleRow key={toggle.id} toggle={toggle} enabled={!!featureState[toggle.id]} onToggle={() => setFeatureState((prev) => ({ ...prev, [toggle.id]: !prev[toggle.id] }))} />
                ))}
              </div>
            </MotionPanel>
          </div>
        </motion.div>
      )}

      <MotionPanel className="p-4 mt-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <Lock size={18} className="text-accent shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-ink-100">Lock Script & Send to Production Studio</p>
              <p className="text-xs text-ink-300 mt-0.5">Finalize the current script and route to the pipeline.</p>
            </div>
          </div>
          <MotionButton onClick={handleLockAndDispatch} disabled={!currentScript || updateEpisodeMut.isPending} className="btn-primary">
            {updateEpisodeMut.isPending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            Send to Studio
          </MotionButton>
        </div>
      </MotionPanel>
    </div>
  );
}
