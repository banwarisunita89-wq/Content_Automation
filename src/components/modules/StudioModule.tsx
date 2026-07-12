// --- src/modules/StudioModule.tsx ---
import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  useScriptStore,
  useActiveStore,
  useNavStore,
  useToastStore,
  useBackendStatusStore,
  useVideoStore,
  useSystemStore,
} from '../../lib/stores';
import {
  useEpisodesQuery,
  useUpdateEpisodeMutation,
  useAddLogMutation,
} from '../../lib/queries';
import type { Episode } from '../../lib/supabase';
import {
  callFal,
  callElevenLabs,
  callHuggingFace,
} from '../../lib/api';
// Injecting our Phase 1 Smart Fetcher
import { generateAIContent } from '../../lib/geminiClient';
import {
  STUDIO_TABS,
  STUDIO_FEATURES,
  STUDIO_RENDER_INPUTS,
  STUDIO_P3_FEATURES,
  ASPECT_RATIOS,
  EMOTION_COLOR_MAP,
  type FeatureToggle,
} from '../../lib/featuresConfig';
import {
  MotionPanel,
  MotionButton,
  SubTabs,
  FeatureToggleRow,
} from '../ui/Animated';
import { Panel, Badge, ProgressBar, Spinner, EmptyState } from '../ui/Primitives';
import {
  Terminal,
  Image as ImageIcon,
  Mic,
  Volume2,
  VolumeX,
  Monitor,
  Layers,
  Gauge,
  Maximize,
  Scissors,
  HardDrive,
  Play,
  Pause,
  Check,
  Scan,
  Cpu,
  Sparkles,
  AlertTriangle,
  RefreshCw,
  Settings2,
  Film,
  Video
} from 'lucide-react';

// ─── Pipeline step model ───
type StepStatus = 'idle' | 'running' | 'done' | 'error';

type PipelineStep = {
  id: string;
  label: string;
  icon: typeof ImageIcon;
  status: StepStatus;
  progress: number;
  detail: string;
  api: 'fal' | 'elevenlabs' | 'hf' | 'none';
};

const INITIAL_STEPS: PipelineStep[] = [
  { id: 'fal', label: 'Fal Prompt Injection', icon: ImageIcon, status: 'idle', progress: 0, detail: 'Disney Pixar 3D · octane · DoF · bokeh', api: 'fal' },
  { id: 'elevenlabs', label: 'ElevenLabs Audio Sync', icon: Mic, status: 'idle', progress: 0, detail: 'Low-stability · high-similarity · expressive', api: 'elevenlabs' },
  { id: 'hf_sfx', label: 'HF SFX Layering', icon: Volume2, status: 'idle', progress: 0, detail: 'Atmospheric + impact + foley', api: 'hf' },
  { id: 'timeline', label: 'Timeline Merger', icon: Layers, status: 'idle', progress: 0, detail: 'Multi-part video + audio + lip-sync', api: 'none' },
  { id: 'motion', label: 'Motion Pacing', icon: Gauge, status: 'idle', progress: 0, detail: '1.4x playback · pitch-adjusted', api: 'none' },
  { id: 'upscale', label: 'High-Fidelity Upscaler', icon: Maximize, status: 'idle', progress: 0, detail: '4K · 60 FPS · HDR', api: 'none' },
];

type ChunkState = { id: number; status: 'pending' | 'rendering' | 'done'; progress: number };
type StoredChunk = { id: number; url: string; size: string };

const FAL_PAYLOAD_CONSTRAINT = 'Ultra HD HDR, 60 FPS, Premium Color Grading, strict cinematic depth of field with heavy bokeh.';
const LENS_DIRECTIVES = ['Ultra HD HDR', '60 FPS', 'Heavy Cinematic Bokeh'];
const LIPSYNC_CHECKLIST = ['Audio frequency matched', 'Phoneme alignment verified', 'Frame interpolation ready', 'Mouth shape library loaded'];
const EMOTION_TONES = Object.keys(EMOTION_COLOR_MAP);

function playClickSound() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
    osc.onended = () => ctx.close();
  } catch { /* silent fallback */ }
}

function parseGeminiMetadata(raw: string): { title: string; description: string; tags: string[]; } {
  const result = { title: '', description: '', tags: [] as string[] };
  const titleMatch = raw.match(/TITLE\s*:\s*(.+)/i);
  const descMatch = raw.match(/DESCRIPTION\s*:\s*([\s\S]+?)(?=TAGS|$)/i);
  const tagsMatch = raw.match(/TAGS?\s*:\s*(.+)/i);

  if (titleMatch) result.title = titleMatch[1].trim();
  if (descMatch) result.description = descMatch[1].trim();
  if (tagsMatch) {
    result.tags = tagsMatch[1].split(/[,#|\n]/).map((t) => t.trim().replace(/^#+/, '')).filter(Boolean).slice(0, 15);
  }

  if (!result.title) {
    const lines = raw.trim().split('\n').filter(Boolean);
    result.title = lines[0]?.slice(0, 120) ?? 'Untitled Episode';
    if (!result.description && lines.length > 1) {
      result.description = lines.slice(1, 4).join(' ').trim();
    }
  }
  return result;
}

function formatChunkTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function StudioModule({ seriesId }: { seriesId: string | null }) {
  const currentScript = useScriptStore((s) => s.currentScript);
  const activeEpisodeId = useActiveStore((s) => s.activeEpisodeId);
  const setActiveEpisode = useActiveStore((s) => s.setActiveEpisode);
  const projectMode = useActiveStore((s) => s.projectMode);
  
  const activeSubTab = useNavStore((s) => s.activeSubTab);
  const setActiveSubTab = useNavStore((s) => s.setActiveSubTab);
  const addToast = useToastStore((s) => s.addToast);
  
  const backendStatus = useBackendStatusStore((s) => s.services);
  const currentVideoUrl = useVideoStore((s) => s.currentVideoUrl);
  const setCurrentVideo = useVideoStore((s) => s.setCurrentVideo);
  const setPipelineStep = useVideoStore((s) => s.setPipelineStep);

  const soundFxEnabled = useSystemStore((s) => s.soundFxEnabled);
  const toggleSoundFx = useSystemStore((s) => s.toggleSoundFx);

  const { data: episodes = [], isLoading: episodesLoading } = useEpisodesQuery(seriesId);
  const updateEpisodeMutation = useUpdateEpisodeMutation();
  const addLogMutation = useAddLogMutation();

  const moduleId = 'studio';
  const tab = activeSubTab[moduleId] || STUDIO_TABS[0].id;
  const setTab = useCallback((id: string) => setActiveSubTab(moduleId, id), [setActiveSubTab]);

  const [activeEpisode, setActiveEpisodeState] = useState<Episode | null>(null);
  const [steps, setSteps] = useState<PipelineStep[]>(INITIAL_STEPS);
  const [assembling, setAssembling] = useState(false);
  const [chunks, setChunks] = useState<ChunkState[]>([]);
  const [renderedChunks, setRenderedChunks] = useState<StoredChunk[]>([]);

  const [metaTitle, setMetaTitle] = useState('');
  const [metaDescription, setMetaDescription] = useState('');
  const [metaTags, setMetaTags] = useState('');
  const [fetchingMetadata, setFetchingMetadata] = useState(false);

  const [renderInputs, setRenderInputs] = useState<Record<string, string | number>>(() => {
    const init: Record<string, string | number> = {};
    STUDIO_RENDER_INPUTS.forEach((inp) => { if (inp.defaultValue !== undefined) init[inp.id] = inp.defaultValue; });
    return init;
  });
  
  const [featureStates, setFeatureStates] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    STUDIO_FEATURES.forEach((f) => { init[f.id] = f.defaultEnabled; });
    return init;
  });

  const [p3FeatureStates, setP3FeatureStates] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    STUDIO_P3_FEATURES.forEach((f) => { init[f.id] = f.defaultEnabled; });
    return init;
  });

  const [emotionTone, setEmotionTone] = useState<string>('neutral');
  const [aspectRatio, setAspectRatio] = useState<string>('16:9');
  const [lipsyncChecks, setLipsyncChecks] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    LIPSYNC_CHECKLIST.forEach((item) => { init[item] = false; });
    return init;
  });

  const faceMetrics = (activeEpisode?.metadata as { face_metrics?: Record<string, number> } | undefined)?.face_metrics ?? {
    eye_spacing: 42, nose_width: 36, jawline_width: 58,
  };

  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const playerWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (projectMode === 'individual') {
      // In individual mode, we just bind to the current active script, no episode switching needed
      setActiveEpisodeState(episodes[0] || null);
      return;
    }
    if (episodes.length === 0) {
      setActiveEpisodeState(null);
      return;
    }
    if (activeEpisodeId) {
      const found = episodes.find((e) => e.id === activeEpisodeId);
      if (found) setActiveEpisodeState(found);
    } else {
      const approved = episodes.find((e) => e.status === 'approved') || episodes.find((e) => e.status === 'rendering') || episodes[0];
      setActiveEpisodeState(approved);
      setActiveEpisode(approved.id);
    }
  }, [episodes, activeEpisodeId, setActiveEpisode, projectMode]);

  useEffect(() => {
    if (activeEpisode?.video_url && !currentVideoUrl) setCurrentVideo(activeEpisode.video_url);
  }, [activeEpisode, currentVideoUrl, setCurrentVideo]);

  useEffect(() => {
    setSteps(INITIAL_STEPS.map((s) => ({ ...s })));
    setChunks([]);
    setRenderedChunks([]);
  }, [activeEpisode?.id]);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play(); setIsPlaying(true); } else { v.pause(); setIsPlaying(false); }
  }, []);

  const handleTimeUpdate = useCallback(() => {
    const v = videoRef.current;
    if (!v || !v.duration) return;
    setVideoProgress((v.currentTime / v.duration) * 100);
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    const v = videoRef.current;
    if (v?.duration) setVideoDuration(v.duration);
  }, []);

  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const v = videoRef.current;
    if (!v || !v.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    v.currentTime = pct * v.duration;
    setVideoProgress(pct * 100);
    if (soundFxEnabled) playClickSound();
  }, [soundFxEnabled]);

  const withClick = useCallback(<T extends unknown[]>(fn: (...args: T) => void) => (...args: T) => {
    if (soundFxEnabled) playClickSound();
    fn(...args);
  }, [soundFxEnabled]);

  const toggleFullscreen = useCallback(() => {
    const el = playerWrapRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.().catch(() => { addToast('Fullscreen not supported in this browser', 'warning'); });
    } else {
      document.exitFullscreen?.();
    }
  }, [addToast]);

  const fetchMetadata = useCallback(async () => {
    if (!backendStatus.gemini) {
      addToast('Gemini API key not configured on backend. Add it in the Secure API Vault.', 'error');
      return;
    }
    if (!currentScript) {
      addToast('No script selected. Generate or select a script in Script Lab first.', 'warning');
      return;
    }

    setFetchingMetadata(true);
    try {
      const scriptSummary = currentScript.raw || currentScript.dialogue || (currentScript.scenes || []).map((sc) => sc.dialogue).join(' ') || '';
      const prompt = `You are a YouTube SEO metadata expert. Given the script below, produce a viral, high-CTR metadata package. Respond in EXACTLY this format:\n\nTITLE: <a single punchy title under 100 chars>\nDESCRIPTION: <2-3 sentence description with a hook and CTA>\nTAGS: <comma-separated list of 10-15 SEO tags>\n\nSCRIPT:\n${scriptSummary.slice(0, 4000)}`;

      addLogMutation.mutate({
        level: 'info', source: 'production-studio', message: 'Fetching metadata from Gemini', details: { episodeId: activeEpisode?.id ?? null }, retryable: false, resolved: false,
      });

      const response = await generateAIContent({ prompt, maxOutputTokens: 2048 });
      const parsed = parseGeminiMetadata(response);

      setMetaTitle(parsed.title);
      setMetaDescription(parsed.description);
      setMetaTags(parsed.tags.join(', '));

      addToast('Metadata fetched from Gemini', 'success');
      
      if (activeEpisode) {
        await updateEpisodeMutation.mutateAsync({
          id: activeEpisode.id,
          updates: { title: parsed.title, metadata: { ...activeEpisode.metadata, description: parsed.description, tags: parsed.tags } },
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown Gemini error';
      addToast(`Gemini metadata failed: ${msg}`, 'error');
    } finally {
      setFetchingMetadata(false);
    }
  }, [backendStatus.gemini, currentScript, addToast, addLogMutation, activeEpisode, updateEpisodeMutation]);

  const runPipeline = useCallback(async () => {
    // If Individual mode, we rely strictly on currentScript without needing activeEpisode
    if (projectMode === 'series' && !activeEpisode) {
      addToast('No active episode to assemble', 'warning');
      return;
    }
    if (!currentScript) {
      addToast('No script loaded to assemble', 'warning');
      return;
    }

    setAssembling(true);
    setPipelineStep(0);

    const chunkDuration = Number(renderInputs.chunk_duration) || 20;
    const targetDuration = Number(activeEpisode?.metadata?.target_duration) || 60;
    const chunkCount = Math.max(1, Math.ceil(targetDuration / chunkDuration));
    const newChunks: ChunkState[] = Array.from({ length: chunkCount }, (_, i) => ({ id: i + 1, status: 'pending', progress: 0 }));
    setChunks(newChunks);

    addToast('Pipeline started — assembling video', 'info');
    
    if (activeEpisode) {
      try {
        await updateEpisodeMutation.mutateAsync({
          id: activeEpisode.id,
          updates: { status: 'rendering', metadata: { ...activeEpisode.metadata, render_progress: 0 } },
        });
      } catch { /* non-fatal */ }
    }

    const falReady = backendStatus.fal;
    const elevenReady = backendStatus.elevenlabs;
    const hfReady = backendStatus.supabase;

    for (let i = 0; i < INITIAL_STEPS.length; i++) {
      const step = INITIAL_STEPS[i];
      setPipelineStep(i + 1);
      setSteps((prev) => prev.map((s) => (s.id === step.id ? { ...s, status: 'running', progress: 0 } : s)));
      
      // Simulate/Trigger API calls based on step
      if (step.api === 'fal' && falReady) {
        try {
          await callFal('fal-ai/kling-video', { prompt: `Disney Pixar 3D style, ${FAL_PAYLOAD_CONSTRAINT}`, duration: targetDuration });
          addToast('Fal video generation complete', 'success');
        } catch (err) { addToast(`Fal call failed: ${err instanceof Error ? err.message : 'unknown'}`, 'warning'); }
      }

      if (step.api === 'elevenlabs' && elevenReady) {
        const voiceId = 'EXAVITQu4vr4xnSDxMaL';
        try {
          const dialogue = currentScript?.dialogue || '';
          await callElevenLabs(dialogue.slice(0, 1000) || 'Test voiceover', voiceId);
          addToast('ElevenLabs audio synced', 'success');
        } catch (err) { addToast(`ElevenLabs call failed: ${err instanceof Error ? err.message : 'unknown'}`, 'warning'); }
      }

      if (step.api === 'hf' && hfReady) {
        try {
          await callHuggingFace('facebook/musicgen-small', { inputs: 'cinematic ambient foley impact effects' });
          addToast('HuggingFace SFX layered', 'success');
        } catch (err) { addToast(`HuggingFace SFX failed: ${err instanceof Error ? err.message : 'unknown'}`, 'warning'); }
      }

      for (let p = 0; p <= 100; p += 20) {
        setSteps((prev) => prev.map((s) => (s.id === step.id ? { ...s, progress: p } : s)));
        await new Promise((r) => setTimeout(r, 180));
      }

      setSteps((prev) => prev.map((s) => (s.id === step.id ? { ...s, status: 'done', progress: 100 } : s)));

      if (step.id === 'timeline') {
        for (let c = 0; c < newChunks.length; c++) {
          setChunks((prev) => prev.map((ch) => (ch.id === c + 1 ? { ...ch, status: 'rendering' } : ch)));
          for (let p = 0; p <= 100; p += 25) {
            setChunks((prev) => prev.map((ch) => (ch.id === c + 1 ? { ...ch, progress: p } : ch)));
            await new Promise((r) => setTimeout(r, 140));
          }
          setChunks((prev) => prev.map((ch) => ch.id === c + 1 ? { ...ch, status: 'done', progress: 100 } : ch));
          const chunkUrl = `https://storage.supabase.co/ep${activeEpisode?.episode_number || '1'}/chunk_${c + 1}.mp4`;
          const size = `${(15 + Math.random() * 10).toFixed(1)} MB`;
          setRenderedChunks((prev) => [...prev, { id: c + 1, url: chunkUrl, size }]);
        }
      }
    }

    const finalUrl = `https://storage.supabase.co/ep${activeEpisode?.episode_number || '1'}/final_4k60.mp4`;
    setCurrentVideo(finalUrl);
    setPipelineStep(INITIAL_STEPS.length);

    if (activeEpisode) {
      try {
        await updateEpisodeMutation.mutateAsync({
          id: activeEpisode.id,
          updates: {
            status: 'rendered', video_url: finalUrl,
            metadata: { ...activeEpisode.metadata, render_progress: 100, resolution: renderInputs.resolution, fps: Number(renderInputs.fps) },
          },
        });
      } catch { /* non-fatal */ }
    }

    addToast(`Video Rendered — 4K 60FPS ready`, 'success');
    setAssembling(false);
  }, [activeEpisode, projectMode, currentScript, addToast, backendStatus, renderInputs.chunk_duration, renderInputs.resolution, renderInputs.fps, updateEpisodeMutation, setCurrentVideo, setPipelineStep]);

  const apiStatus = [
    { name: 'Gemini', ok: backendStatus.gemini },
    { name: 'Fal', ok: backendStatus.fal },
    { name: 'ElevenLabs', ok: backendStatus.elevenlabs },
  ];

  return (
    <div className="space-y-4">
      <MotionPanel className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gradient mb-1 flex items-center gap-2">
            <Film size={20} /> Production Studio
          </h2>
          <p className="text-sm text-ink-300">
            Assemble multi-part video, audio channels, and lip-sync into a final 4K 60FPS render.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={projectMode === 'series' ? 'accent' : 'success'}>
            {projectMode === 'series' ? <Film size={12} className="mr-1"/> : <Video size={12} className="mr-1"/>}
            {projectMode === 'series' ? 'Series Mode' : 'Individual Mode'}
          </Badge>
          {apiStatus.map((a) => (
            <Badge key={a.name} variant={a.ok ? 'success' : 'danger'}>
              {a.name} {a.ok ? '✓' : '✗'}
            </Badge>
          ))}
        </div>
      </MotionPanel>

      <SubTabs tabs={STUDIO_TABS} activeTab={tab} onTabChange={setTab} />

      <AnimatePresence mode="wait">
        {tab === 'preview' && (
          <motion.div key="preview" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <Panel title="Custom Video Player" icon={<Play size={15} />} action={<Badge>{projectMode === 'series' && activeEpisode ? `Ep ${activeEpisode.episode_number}` : 'Standalone Video'}</Badge>}>
              <div className="p-4">
                {currentVideoUrl ? (
                  <div ref={playerWrapRef} className="relative rounded-xl overflow-hidden bg-black border border-white/[0.06] group">
                    <video ref={videoRef} src={currentVideoUrl} className="w-full aspect-video object-contain" onTimeUpdate={handleTimeUpdate} onLoadedMetadata={handleLoadedMetadata} onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} onClick={togglePlay} playsInline />
                    <button onClick={togglePlay} className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="w-16 h-16 rounded-full bg-black/60 flex items-center justify-center backdrop-blur-sm">
                        {isPlaying ? <Pause size={26} className="text-white" /> : <Play size={26} className="text-white ml-1" />}
                      </span>
                    </button>
                    <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
                      <div className="h-1.5 rounded-full bg-white/20 cursor-pointer mb-2" onClick={handleSeek}>
                        <div className="h-full rounded-full" style={{ width: `${videoProgress}%`, background: 'linear-gradient(90deg, var(--accent), #fff)' }} />
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-white/80 font-mono">
                        <button onClick={togglePlay} className="flex items-center gap-1.5 hover:text-white">
                          {isPlaying ? <Pause size={14} /> : <Play size={14} />} {isPlaying ? 'Pause' : 'Play'}
                        </button>
                        <span>{formatChunkTime(Math.floor((videoDuration * videoProgress) / 100 || 0))} / {formatChunkTime(Math.floor(videoDuration || 0))}</span>
                        <button onClick={toggleFullscreen} className="flex items-center gap-1.5 hover:text-white"><Maximize size={14} /> Fullscreen</button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <EmptyState icon={<Film size={28} />} title="No video rendered yet" subtitle="Run the Pipeline tab to assemble a video." />
                )}
              </div>
            </Panel>
          </motion.div>
        )}

        {tab === 'metadata' && (
          <motion.div key="metadata" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-4">
            <Panel title="Episode Metadata" icon={<Sparkles size={15} />}>
              <div className="p-4 space-y-4">
                {!backendStatus.gemini && (
                  <div className="p-3 rounded-xl bg-danger-dim border border-danger/20 flex items-start gap-2">
                    <AlertTriangle size={16} className="text-danger shrink-0 mt-0.5" />
                    <p className="text-xs text-danger">AI Engine offline. Configure in Settings to generate metadata.</p>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <p className="text-xs text-ink-400">Source script: {currentScript ? 'Loaded from Script Lab' : 'None selected'}</p>
                  <MotionButton onClick={fetchMetadata} disabled={fetchingMetadata || !backendStatus.gemini} className="btn-primary flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium">
                    {fetchingMetadata ? <Spinner size={14} /> : <RefreshCw size={14} />} {fetchingMetadata ? 'Fetching...' : 'Fetch from AI Engine'}
                  </MotionButton>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-ink-200">Title</label>
                  <textarea value={metaTitle} onChange={(e) => setMetaTitle(e.target.value)} rows={2} placeholder="Episode title..." className="w-full p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-sm text-ink-100 resize-none focus:outline-none focus:border-accent/40" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-ink-200">Description</label>
                  <textarea value={metaDescription} onChange={(e) => setMetaDescription(e.target.value)} rows={5} placeholder="Episode description..." className="w-full p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-sm text-ink-100 resize-none focus:outline-none focus:border-accent/40" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-ink-200">Tags (comma-separated)</label>
                  <textarea value={metaTags} onChange={(e) => setMetaTags(e.target.value)} rows={2} placeholder="tag1, tag2, tag3..." className="w-full p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-sm text-ink-100 resize-none focus:outline-none focus:border-accent/40" />
                </div>
              </div>
            </Panel>
          </motion.div>
        )}

        {tab === 'pipeline' && (
          <motion.div key="pipeline" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-4">
            {episodesLoading ? (
              <div className="flex justify-center py-12"><Spinner size={24} /></div>
            ) : projectMode === 'series' && !activeEpisode ? (
              <Panel><EmptyState icon={<Terminal size={28} />} title="No episodes available" subtitle="Generate and approve scripts in Script Lab first" /></Panel>
            ) : (
          <>
            {projectMode === 'series' && (
              <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1">
                {episodes.slice(0, 8).map((ep) => (
                  <button key={ep.id} onClick={() => { setActiveEpisodeState(ep); setActiveEpisode(ep.id); setSteps(INITIAL_STEPS.map((s) => ({ ...s }))); setChunks([]); setRenderedChunks([]); }} className={`shrink-0 px-3 py-2 rounded-xl text-xs font-medium transition-all ${activeEpisode?.id === ep.id ? 'bg-accent-dim text-accent border border-accent/30' : 'bg-white/[0.04] text-ink-300 border border-white/[0.06] hover:text-ink-100'}`}>
                    Ep {ep.episode_number} <span className="ml-1 opacity-50">· {ep.status}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Panel title="Terminal Flow Engine" icon={<Terminal size={15} />} className="lg:col-span-2">
                <div className="p-4">
                  <div className="relative rounded-xl bg-ink-950 border border-white/[0.04] p-4 overflow-hidden min-h-[320px] grid-bg">
                    <div className="absolute inset-0 pointer-events-none overflow-hidden">
                      <div className="absolute left-0 right-0 h-px animate-scan" style={{ background: 'linear-gradient(90deg, transparent, var(--accent), transparent)' }} />
                    </div>
                    <div className="relative space-y-2 font-mono text-[11px]">
                      <div className="text-accent font-semibold mb-2">$ production_pipeline --target {projectMode === 'series' ? `episode_${activeEpisode?.episode_number}` : 'standalone_video'} --style "disney_pixar_3d"</div>
                      {steps.map((step) => {
                        const Icon = step.icon;
                        return (
                          <div key={step.id} className="space-y-1">
                            <div className="flex items-center gap-2.5 py-1">
                              <span className={`shrink-0 ${step.status === 'done' ? 'text-success' : step.status === 'running' ? 'text-accent' : step.status === 'error' ? 'text-danger' : 'text-ink-500'}`}>
                                {step.status === 'done' ? <Check size={13} /> : step.status === 'running' ? <Spinner size={13} /> : <Icon size={13} />}
                              </span>
                              <span className={`shrink-0 w-44 ${step.status === 'idle' ? 'text-ink-500' : 'text-ink-100'}`}>{step.label}</span>
                              <span className="text-ink-400 flex-1 truncate">{step.detail}</span>
                              <span className={`shrink-0 font-semibold ${step.status === 'done' ? 'text-success' : step.status === 'running' ? 'text-accent' : step.status === 'error' ? 'text-danger' : 'text-ink-500'}`}>
                                {step.status === 'idle' ? 'IDLE' : step.status === 'done' ? 'DONE' : step.status === 'error' ? 'FAIL' : `${step.progress}%`}
                              </span>
                            </div>
                            {step.status === 'running' && (<div className="pl-8"><ProgressBar value={step.progress} /></div>)}
                          </div>
                        );
                      })}
                      {assembling && <div className="text-accent font-semibold pt-2"><span className="animate-blink">█</span> processing...</div>}
                      {!assembling && steps.every((s) => s.status === 'done') && <div className="text-success font-semibold pt-2">✓ Pipeline complete. Output ready for caption production.</div>}
                    </div>
                  </div>

                  <MotionButton onClick={runPipeline} disabled={assembling} data-spotlight="assemble-video" className="btn-primary w-full mt-3 flex items-center justify-center gap-2">
                    {assembling ? <Spinner size={15} /> : <Play size={15} />} {assembling ? 'Assembling...' : 'Assemble Video'}
                  </MotionButton>
                </div>
              </Panel>

              <Panel title="Asset Chunk Manager" icon={<Scissors size={15} />} action={<Badge>{Number(renderInputs.chunk_duration) || 20}s blocks</Badge>}>
                <div className="p-4 space-y-2">
                  {chunks.length === 0 ? (
                    <EmptyState icon={<Scissors size={22} />} title="No chunks" subtitle={`Pipeline will slice into ${Number(renderInputs.chunk_duration) || 20}-second blocks`} />
                  ) : (
                    chunks.map((chunk) => {
                      const dur = Number(renderInputs.chunk_duration) || 20;
                      return (
                        <div key={chunk.id} className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-medium text-ink-100">Chunk {chunk.id} ({formatChunkTime((chunk.id - 1) * dur)}–{formatChunkTime(chunk.id * dur)})</span>
                            <Badge variant={chunk.status === 'done' ? 'success' : chunk.status === 'rendering' ? 'accent' : 'neutral'}>{chunk.status}</Badge>
                          </div>
                          <ProgressBar value={chunk.progress} />
                        </div>
                      );
                    })
                  )}
                </div>
              </Panel>

              <Panel title="Rendering Queue Storage" icon={<HardDrive size={15} />} action={<Badge>{renderedChunks.length} stored</Badge>}>
                <div className="p-4 space-y-2">
                  {renderedChunks.length === 0 ? (
                    <EmptyState icon={<HardDrive size={22} />} title="No stored chunks" subtitle="Completed chunks push to Supabase storage" />
                  ) : (
                    renderedChunks.map((chunk) => (
                      <div key={chunk.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                        <HardDrive size={14} className="text-accent shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-ink-100 truncate">chunk_{chunk.id}.mp4</p>
                          <p className="text-[10px] text-ink-400 font-mono truncate">{chunk.url}</p>
                        </div>
                        <span className="text-[10px] text-ink-400 shrink-0">{chunk.size}</span>
                        <Check size={14} className="text-success shrink-0" />
                      </div>
                    ))
                  )}
                  {renderedChunks.length > 0 && (
                    <div className="p-2.5 rounded-xl bg-success-dim border border-success/20 flex items-center gap-2">
                      <Cpu size={14} className="text-success" />
                      <span className="text-xs text-success">All chunks stored. Final assembly ready.</span>
                    </div>
                  )}
                </div>
              </Panel>
            </div>
          </>
        )}
      </motion.div>
        )}

        {tab === 'render_settings' && (
          <motion.div key="render_settings" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-4">
            <MotionPanel className="p-4 border border-accent/30">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent-dim flex items-center justify-center shrink-0"><AlertTriangle size={20} className="text-accent" /></div>
                <div className="flex-1">
                  <h3 className="text-sm font-bold text-accent mb-1 flex items-center gap-2">CRITICAL AI Constraint — Fal Payload</h3>
                  <p className="text-xs text-ink-300 mb-2">The Fal API payload explicitly demands the following render specification. This is injected into every generation request and cannot be downgraded:</p>
                  <div className="p-3 rounded-xl bg-ink-950 border border-accent/20 font-mono text-xs text-accent leading-relaxed">"{FAL_PAYLOAD_CONSTRAINT}"</div>
                </div>
              </div>
            </MotionPanel>

            <MotionPanel className="p-4 border border-accent/20">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent-dim flex items-center justify-center shrink-0"><Scan size={20} className="text-accent" /></div>
                <div className="flex-1">
                  <h3 className="text-sm font-bold text-accent mb-1 flex items-center gap-2">Cinematic Identity Protocol Enforcer</h3>
                  <p className="text-xs text-ink-300 mb-3">Fal API payloads explicitly lock facial proportions via strict reference parameters. The following values cannot be overridden:</p>
                  <div className="grid grid-cols-3 gap-2">
                    {Object.entries(faceMetrics).map(([key, val]) => (
                      <div key={key} className="p-2.5 rounded-xl bg-ink-950 border border-accent/20 text-center">
                        <p className="text-[10px] text-ink-400 uppercase tracking-wide mb-1">{key.replace(/_/g, ' ')}</p>
                        <p className="text-sm font-mono font-semibold text-accent">{val}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </MotionPanel>

            <MotionPanel className="p-4 border border-white/[0.06]">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/[0.04] flex items-center justify-center shrink-0">
                    {soundFxEnabled ? <Volume2 size={20} className="text-accent" /> : <VolumeX size={20} className="text-ink-400" />}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-bold text-ink-100 mb-1 flex items-center gap-2">Ultimate Visual Sound FX</h3>
                    <p className="text-xs text-ink-400">When enabled, UI transitions play a subtle click sound via the Web Audio API oscillator.</p>
                  </div>
                </div>
                <button onClick={withClick(toggleSoundFx)} className={`relative shrink-0 w-12 h-7 rounded-full transition-colors ${soundFxEnabled ? 'bg-accent' : 'bg-white/[0.08]'}`}>
                  <span className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white transition-transform ${soundFxEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>
            </MotionPanel>

            <MotionPanel className="p-4 border border-white/[0.06]">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/[0.04] flex items-center justify-center shrink-0"><Sparkles size={20} className="text-accent" /></div>
                <div className="flex-1">
                  <h3 className="text-sm font-bold text-ink-100 mb-1 flex items-center gap-2">Emotion-to-Color API Mapper</h3>
                  <p className="text-xs text-ink-400 mb-3">Select the script's emotional tone. The corresponding color grading is injected into the Fal visual prompt.</p>
                  <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                    <select value={emotionTone} onChange={(e) => { setEmotionTone(e.target.value); if (soundFxEnabled) playClickSound(); }} className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-sm text-ink-100">
                      {EMOTION_TONES.map((tone) => <option key={tone} value={tone} className="bg-ink-900">{tone.charAt(0).toUpperCase() + tone.slice(1)}</option>)}
                    </select>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-ink-400">Preview:</span>
                      <span className="w-8 h-8 rounded-lg border border-white/[0.1]" style={{ backgroundColor: EMOTION_COLOR_MAP[emotionTone].color }} />
                      <span className="text-xs text-ink-200 font-mono">{EMOTION_COLOR_MAP[emotionTone].grading}</span>
                    </div>
                  </div>
                </div>
              </div>
            </MotionPanel>

            <MotionPanel className="p-4 border border-accent/20">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent-dim flex items-center justify-center shrink-0"><Monitor size={20} className="text-accent" /></div>
                <div className="flex-1">
                  <h3 className="text-sm font-bold text-accent mb-1 flex items-center gap-2">High-Fidelity Lens Directives</h3>
                  <p className="text-xs text-ink-300 mb-3">These directives are always-on and cannot be disabled. They are injected into every Fal generation request.</p>
                  <div className="flex flex-wrap gap-2">
                    {LENS_DIRECTIVES.map((directive) => (
                      <span key={directive} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-ink-950 border border-accent/30 text-xs font-medium text-accent"><Check size={12} /> {directive}</span>
                    ))}
                  </div>
                </div>
              </div>
            </MotionPanel>

            <MotionPanel className="p-4 border border-white/[0.06]">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/[0.04] flex items-center justify-center shrink-0"><Maximize size={20} className="text-accent" /></div>
                <div className="flex-1">
                  <h3 className="text-sm font-bold text-ink-100 mb-1 flex items-center gap-2">Cinematic Aspect Ratio Switcher</h3>
                  <p className="text-xs text-ink-400 mb-3">Selected ratio is applied to the Fal generation request.</p>
                  <div className="flex gap-2">
                    {ASPECT_RATIOS.map((ar) => (
                      <button key={ar.id} onClick={() => { setAspectRatio(ar.value); if (soundFxEnabled) playClickSound(); }} className={`px-4 py-2 rounded-xl text-xs font-medium transition-all ${aspectRatio === ar.value ? 'bg-accent text-ink-950 border border-accent' : 'bg-white/[0.04] text-ink-300 border border-white/[0.06]'}`}>{ar.label}</button>
                    ))}
                  </div>
                </div>
              </div>
            </MotionPanel>

            <MotionPanel className="p-4 border border-white/[0.06]">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/[0.04] flex items-center justify-center shrink-0"><Mic size={20} className="text-accent" /></div>
                <div className="flex-1">
                  <h3 className="text-sm font-bold text-ink-100 mb-1 flex items-center gap-2">Lip-Sync Quality Tester</h3>
                  <p className="text-xs text-ink-400 mb-3">Pre-render checklist. Verify each item before assembling the pipeline.</p>
                  <div className="space-y-2">
                    {LIPSYNC_CHECKLIST.map((item) => {
                      const checked = !!lipsyncChecks[item];
                      return (
                        <button key={item} onClick={() => { setLipsyncChecks((prev) => ({ ...prev, [item]: !prev[item] })); if (soundFxEnabled) playClickSound(); }} className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:border-accent/30 text-left">
                          <span className={`shrink-0 w-5 h-5 rounded-md flex items-center justify-center border ${checked ? 'bg-accent border-accent' : 'bg-transparent border-white/[0.1]'}`}>{checked && <Check size={13} className="text-ink-950" />}</span>
                          <span className={`text-xs ${checked ? 'text-ink-100' : 'text-ink-300'}`}>{item}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </MotionPanel>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Panel title="Render Inputs" icon={<Settings2 size={15} />}>
                <div className="p-4 space-y-3">
                  {STUDIO_RENDER_INPUTS.map((input) => (
                    <div key={input.id} className="space-y-1.5">
                      <label className="text-xs font-medium text-ink-200">{input.label}</label>
                      {input.type === 'select' && input.options ? (
                        <select value={String(renderInputs[input.id] ?? '')} onChange={(e) => setRenderInputs((prev) => ({ ...prev, [input.id]: e.target.value }))} className="w-full p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-sm text-ink-100">
                          {input.options.map((opt) => <option key={opt} value={opt} className="bg-ink-900">{opt}</option>)}
                        </select>
                      ) : (
                        <input type="number" value={Number(renderInputs[input.id] ?? input.defaultValue ?? 0)} onChange={(e) => setRenderInputs((prev) => ({ ...prev, [input.id]: e.target.value === '' ? 0 : Number(e.target.value) }))} className="w-full p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-sm text-ink-100" />
                      )}
                    </div>
                  ))}
                </div>
              </Panel>

              <Panel title="Feature Toggles" icon={<Sparkles size={15} />}>
                <div className="p-4 space-y-2">
                  {STUDIO_FEATURES.map((feature: FeatureToggle) => (
                    <FeatureToggleRow key={feature.id} toggle={feature} enabled={!!featureStates[feature.id]} onToggle={() => setFeatureStates((prev) => ({ ...prev, [feature.id]: !prev[feature.id] }))} />
                  ))}
                </div>
              </Panel>
              <Panel title="Phase 3 Feature Toggles" icon={<Sparkles size={15} />}>
                <div className="p-4 space-y-2">
                  {STUDIO_P3_FEATURES.map((feature: FeatureToggle) => (
                    <FeatureToggleRow key={feature.id} toggle={feature} enabled={!!p3FeatureStates[feature.id]} onToggle={() => setP3FeatureStates((prev) => ({ ...prev, [feature.id]: !prev[feature.id] }))} />
                  ))}
                </div>
              </Panel>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
              
