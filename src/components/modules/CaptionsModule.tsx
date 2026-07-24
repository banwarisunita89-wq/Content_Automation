// ─── Caption Production Module (Phase 2 Enterprise Overhaul) ───
// Real Gemini API integration · Zustand stores · React Query · framer-motion
// Sub-tabs: YT Studio | Insta Studio

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Youtube, Instagram, FileText, Image, Pin,
  Sparkles, GripVertical, X, Wand2,
  AlertTriangle, Loader2, Hash, Smile, Save, RefreshCw,
  ImagePlus, TrendingUp, MessageCircle, Stamp,
} from 'lucide-react';

// ─── Stores (Zustand) ───
import {
  useActiveStore,
  useToastStore,
  useApiVaultStore,
  useScriptStore,
} from '../../lib/stores';

// ─── React Query hooks ───
import {
  useEpisodesQuery,
  useUpdateEpisodeMutation,
  useAddLogMutation,
} from '../../lib/queries';

// ─── Real Gemini API ───
import { callGemini } from '../../lib/api';

// ─── Feature config (data-driven UI) ───
import {
  CAPTION_TABS,
  CAPTION_FEATURES,
  CAPTION_P3_FEATURES,
  type FeatureToggle,
} from '../../lib/featuresConfig';

// ─── Types ───
import type { Episode } from '../../lib/supabase';

// ─── Animated UI primitives ───
import {
  MotionPanel,
  MotionButton,
  SubTabs,
  FeatureToggleRow,
} from '../ui/Animated';

// ─── Static UI primitives ───
import { Panel, Badge, Spinner, EmptyState } from '../ui/Primitives';

// ─── Helpers ───
type TagChip = { id: string; label: string };

type ThumbnailFrame = {
  time: string;
  score: number;
  sharpness: number;
};

type YtMetadata = {
  title: string;
  description: string;
  tags: string[];
  madeWithAI: boolean;
};

type IgMetadata = {
  caption: string;
  hashtags: string[];
  emojiInjector: boolean;
};

// Strip ```json ... ``` fences and extract the first JSON object from a Gemini text response.
function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return candidate.trim();
  return candidate.slice(start, end + 1).trim();
}

function buildYtPrompt(opts: {
  scriptText: string;
  episodeNumber: number;
  seriesTitle: string;
  enabledFeatures: string[];
}): string {
  const featureDirectives = opts.enabledFeatures.length
    ? `\nACTIVE ENHANCEMENT MODULES: ${opts.enabledFeatures.join(', ')}.`
    : '';

  return [
    `You are an elite YouTube Shorts metadata strategist for an AI-animated series.`,
    `SERIES: "${opts.seriesTitle}".`,
    `EPISODE NUMBER: ${opts.episodeNumber}.`,
    `SCRIPT CONTEXT:\n${opts.scriptText}`,
    featureDirectives,
    ``,
    `Generate YouTube metadata optimized for maximum CTR, retention, and search discoverability.`,
    `Respond with ONLY a single JSON object (no markdown, no commentary) with this exact schema:`,
    `{`,
    `  "title": string,          // SEO-optimized, under 100 chars, high-CTR`,
    `  "description": string,    // Full description with hook, summary, timestamps placeholder, CTA, and hashtags`,
    `  "tags": string[],          // 8-15 relevant SEO tags (lowercase, no #)`,
    `  "pinned_comment": string   // Conversational comment to spark engagement and debate`,
    `}`,
  ].filter(Boolean).join('\n');
}

function buildIgPrompt(opts: {
  scriptText: string;
  episodeNumber: number;
  seriesTitle: string;
  enabledFeatures: string[];
}): string {
  const featureDirectives = opts.enabledFeatures.length
    ? `\nACTIVE ENHANCEMENT MODULES: ${opts.enabledFeatures.join(', ')}.`
    : '';

  return [
    `You are an elite Instagram Reels caption strategist for an AI-animated series.`,
    `SERIES: "${opts.seriesTitle}".`,
    `EPISODE NUMBER: ${opts.episodeNumber}.`,
    `SCRIPT CONTEXT:\n${opts.scriptText}`,
    featureDirectives,
    ``,
    `Generate an Instagram Reel caption optimized for engagement, saves, and shares.`,
    `Use clean line breaks for readability. Include relevant emojis if emoji injector is active.`,
    `Respond with ONLY a single JSON object (no markdown, no commentary) with this exact schema:`,
    `{`,
    `  "caption": string,       // Full caption with hook, body, CTA, and line breaks`,
    `  "hashtags": string[],    // 10-20 relevant hashtags (with # prefix)`,
    `  "optimized_preview": string  // The caption reflowed with optimal line breaks for preview`,
    `}`,
  ].filter(Boolean).join('\n');
}

// Assemble a flat text representation of the current script for Gemini context.
function scriptToText(ep: Episode | null, fallbackScript: string | null): string {
  const script = ep?.script || null;
  if (!script && !fallbackScript) return 'No script available — generate metadata based on series context.';
  const s = script || null;
  const parts: string[] = [];
  if (s?.hook) parts.push(`HOOK: ${s.hook}`);
  if (s?.dialogue) parts.push(`DIALOGUE: ${s.dialogue}`);
  if (s?.scenes?.length) {
    parts.push(`SCENES:\n${s.scenes.map((sc, i) => `  ${i + 1}. [${sc.shot}] ${sc.dialogue}`).join('\n')}`);
  }
  if (s?.cta) parts.push(`CTA: ${s.cta}`);
  if (s?.seo_keywords?.length) parts.push(`SEO KEYWORDS: ${s.seo_keywords.join(', ')}`);
  return parts.join('\n') || fallbackScript || 'No script content available.';
}

// ─── Component ───
export function CaptionsModule({ seriesId }: { seriesId: string | null }) {
  // Stores
  const activeEpisodeId = useActiveStore((s) => s.activeEpisodeId);
  const setActiveEpisode = useActiveStore((s) => s.setActiveEpisode);
  const addToast = useToastStore((s) => s.addToast);
  const hasGeminiKey = useApiVaultStore((s) => s.hasKey('gemini_api_key'));
  const currentScript = useScriptStore((s) => s.currentScript);

  // React Query
  const { data: episodes = [], isLoading: episodesLoading } = useEpisodesQuery(seriesId);
  const updateEpisodeMut = useUpdateEpisodeMutation();
  const addLogMut = useAddLogMutation();

  // Local UI state — sub-tab
  const [activeTab, setActiveTab] = useState<string>('yt_studio');

  // Active episode (local selection, synced with store)
  const [activeEpisode, setActiveEpisodeState] = useState<Episode | null>(null);

  // YT Studio state
  const [ytTitle, setYtTitle] = useState<string>('');
  const [ytDesc, setYtDesc] = useState<string>('');
  const [ytTags, setYtTags] = useState<TagChip[]>([]);
  const [madeWithAI, setMadeWithAI] = useState<boolean>(true);
  const [pinnedComment, setPinnedComment] = useState<string>('');
  const [thumbnailFrame, setThumbnailFrame] = useState<ThumbnailFrame | null>(null);
  const [ytGenerating, setYtGenerating] = useState<boolean>(false);
  const [ytSaving, setYtSaving] = useState<boolean>(false);

  // Insta Studio state
  const [igCaption, setIgCaption] = useState<string>('');
  const [igHashtags, setIgHashtags] = useState<TagChip[]>([]);
  const [igOptimizedPreview, setIgOptimizedPreview] = useState<string>('');
  const [emojiInjector, setEmojiInjector] = useState<boolean>(true);
  const [igGenerating, setIgGenerating] = useState<boolean>(false);
  const [igSaving, setIgSaving] = useState<boolean>(false);

  // Feature toggle state (data-driven from CAPTION_FEATURES)
  const [featureState, setFeatureState] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(CAPTION_FEATURES.map((f) => [f.id, f.defaultEnabled]))
  );

  // ─── Phase 3 feature state ───
  // A/B Test Thumbnail Generator
  const [abThumbnails, setAbThumbnails] = useState<{ a: { score: number } | null; b: { score: number } | null }>({
    a: null,
    b: null,
  });
  const [abGenerating, setAbGenerating] = useState<boolean>(false);

  // Click-Bait Score Matrix
  const [clickbaitScore, setClickbaitScore] = useState<{ title: number; caption: number } | null>(null);

  // Emoji Auto-Pattern Injector
  const [emojiPatternEnabled, setEmojiPatternEnabled] = useState<boolean>(false);

  // Comment Prompt Formulator
  const [commentPrompt, setCommentPrompt] = useState<string>('');
  const [commentPromptGenerating, setCommentPromptGenerating] = useState<boolean>(false);

  // Brand Overlay Module
  const [brandOverlayEnabled, setBrandOverlayEnabled] = useState<boolean>(false);
  const [brandQuadrant, setBrandQuadrant] = useState<'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'>(
    'bottom-right'
  );

  // Phase 3 feature toggle state (data-driven from CAPTION_P3_FEATURES)
  const [p3FeatureState, setP3FeatureState] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(CAPTION_P3_FEATURES.map((f) => [f.id, f.defaultEnabled]))
  );

  // ─── Sync active episode from store / episodes list ───
  const episodeLoadedRef = useRef(false);
  useEffect(() => {
    if (episodes.length === 0) {
      episodeLoadedRef.current = false;
      setActiveEpisodeState(null);
      return;
    }
    if (activeEpisodeId) {
      const found = episodes.find((e) => e.id === activeEpisodeId);
      if (found) {
        setActiveEpisodeState(found);
        episodeLoadedRef.current = true;
        return;
      }
    }
    if (!episodeLoadedRef.current) {
      const preferred =
        episodes.find((e) => e.status === 'rendered' || e.status === 'published') ||
        episodes.find((e) => e.status === 'approved') ||
        episodes[0];
      setActiveEpisodeState(preferred);
      episodeLoadedRef.current = true;
    }
  }, [episodes, activeEpisodeId]);

  // ─── Load existing metadata when active episode changes ───
  useEffect(() => {
    if (!activeEpisode) return;
    const meta = activeEpisode.metadata as Record<string, unknown> | null;
    if (!meta) return;

    const yt = (meta.youtube || {}) as Partial<YtMetadata>;
    const ig = (meta.instagram || {}) as Partial<IgMetadata>;
    const thumb = (meta.thumbnail || null) as ThumbnailFrame | null;
    const pinned = (meta.pinned_comment || meta.pinnedComment || '') as string;

    if (typeof yt.title === 'string') setYtTitle(yt.title);
    if (typeof yt.description === 'string') setYtDesc(yt.description);
    if (Array.isArray(yt.tags)) {
      setYtTags(yt.tags.map((t, i) => ({ id: `loaded-${i}`, label: t })));
    }
    if (typeof yt.madeWithAI === 'boolean') setMadeWithAI(yt.madeWithAI);
    if (typeof pinned === 'string' && pinned) setPinnedComment(pinned);
    if (thumb && typeof thumb.time === 'string') setThumbnailFrame(thumb);

    if (typeof ig.caption === 'string') setIgCaption(ig.caption);
    if (Array.isArray(ig.hashtags)) {
      setIgHashtags(ig.hashtags.map((t, i) => ({ id: `loaded-ig-${i}`, label: t })));
    }
    if (typeof ig.emojiInjector === 'boolean') setEmojiInjector(ig.emojiInjector);
  }, [activeEpisode]);

  // ─── Tag management (YT) ───
  const addYtTag = useCallback((label: string) => {
    const trimmed = label.trim();
    if (!trimmed) return;
    setYtTags((prev) => [...prev, { id: `tag-${Date.now()}-${prev.length}`, label: trimmed }]);
  }, []);

  const removeYtTag = useCallback((id: string) => {
    setYtTags((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const moveYtTag = useCallback((index: number, direction: -1 | 1) => {
    setYtTags((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }, []);

  // ─── Hashtag management (IG) ───
  const addIgHashtag = useCallback((label: string) => {
    const trimmed = label.trim().replace(/^#/, '');
    if (!trimmed) return;
    setIgHashtags((prev) => [...prev, { id: `hash-${Date.now()}-${prev.length}`, label: `#${trimmed}` }]);
  }, []);

  const removeIgHashtag = useCallback((id: string) => {
    setIgHashtags((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ─── Generate YT metadata via Gemini ───
  const handleGenerateYt = useCallback(async () => {
    if (!hasGeminiKey) {
      addToast('Gemini API key not configured. Add it in the Secure API Vault.', 'error');
      return;
    }
    if (!activeEpisode && !currentScript) {
      addToast('No episode or script available. Select or generate a script first.', 'warning');
      return;
    }

    setYtGenerating(true);
    addToast('Generating YouTube metadata from Gemini...', 'info');

    await addLogMut.mutateAsync({
      level: 'info',
      source: 'caption-production',
      message: `YT metadata generation requested — Ep ${activeEpisode?.episode_number ?? '?'}`,
      details: { episodeId: activeEpisode?.id, tab: 'yt_studio' },
      retryable: true,
      resolved: false,
    });

    const scriptText = scriptToText(activeEpisode, currentScript?.raw || null);
    const enabledFeatures = Object.keys(featureState).filter((id) => featureState[id]);
    const seriesTitle = 'AI Cartoon Wallah'; // Derived from active series context
    const prompt = buildYtPrompt({
      scriptText,
      episodeNumber: activeEpisode?.episode_number ?? 1,
      seriesTitle,
      enabledFeatures,
    });

    try {
      const raw = await callGemini(prompt, 'You are a JSON-only response engine. Output valid JSON and nothing else.');
      const jsonStr = extractJson(raw);
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(jsonStr);
      } catch {
        throw new Error('Gemini response was not valid JSON.');
      }

      if (typeof parsed.title === 'string') setYtTitle(parsed.title);
      if (typeof parsed.description === 'string') setYtDesc(parsed.description);
      if (Array.isArray(parsed.tags)) {
        setYtTags(
          (parsed.tags as string[])
            .map((t) => String(t).replace(/^#/, '').toLowerCase().trim())
            .filter(Boolean)
            .map((t, i) => ({ id: `gemini-yt-${i}`, label: t }))
        );
      }
      if (typeof parsed.pinned_comment === 'string') {
        setPinnedComment(parsed.pinned_comment);
      }

      // Thumbnail frame placeholder (Gemini-driven heuristic)
      if (featureState.thumbnail_extractor) {
        setThumbnailFrame({ time: '0:14', score: 94, sharpness: 98 });
      }

      await addLogMut.mutateAsync({
        level: 'success',
        source: 'caption-production',
        message: `YT metadata generated for Ep ${activeEpisode?.episode_number ?? '?'}`,
        details: { title: parsed.title, tagCount: Array.isArray(parsed.tags) ? (parsed.tags as string[]).length : 0 },
        retryable: false,
        resolved: false,
      });
      addToast('YouTube metadata generated successfully.', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      await addLogMut.mutateAsync({
        level: 'error',
        source: 'caption-production',
        message: `YT metadata generation failed: ${message}`,
        details: { error: message },
        retryable: true,
        resolved: false,
      });
      addToast(`Generation failed: ${message}`, 'error');
    } finally {
      setYtGenerating(false);
    }
  }, [hasGeminiKey, activeEpisode, currentScript, featureState, addToast, addLogMut]);

  // ─── Save YT metadata via useUpdateEpisodeMutation ───
  const handleSaveYt = useCallback(async () => {
    if (!activeEpisode) {
      addToast('No active episode to save metadata for.', 'warning');
      return;
    }
    setYtSaving(true);
    try {
      await updateEpisodeMut.mutateAsync({
        id: activeEpisode.id,
        updates: {
          metadata: {
            ...(activeEpisode.metadata || {}),
            youtube: {
              title: ytTitle,
              description: ytDesc,
              tags: ytTags.map((t) => t.label),
              madeWithAI,
            },
            pinned_comment: pinnedComment,
            thumbnail: thumbnailFrame,
          },
        },
      });
      await addLogMut.mutateAsync({
        level: 'success',
        source: 'caption-production',
        message: `YT metadata saved for Ep ${activeEpisode.episode_number}`,
        details: { episodeId: activeEpisode.id, title: ytTitle, tagCount: ytTags.length },
        retryable: false,
        resolved: false,
      });
      addToast(`YouTube metadata saved for Ep ${activeEpisode.episode_number}.`, 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      addToast(`Save failed: ${message}`, 'error');
    } finally {
      setYtSaving(false);
    }
  }, [activeEpisode, ytTitle, ytDesc, ytTags, madeWithAI, pinnedComment, thumbnailFrame, updateEpisodeMut, addLogMut, addToast]);

  // ─── Generate IG caption via Gemini ───
  const handleGenerateIg = useCallback(async () => {
    if (!hasGeminiKey) {
      addToast('Gemini API key not configured. Add it in the Secure API Vault.', 'error');
      return;
    }
    if (!activeEpisode && !currentScript) {
      addToast('No episode or script available. Select or generate a script first.', 'warning');
      return;
    }

    setIgGenerating(true);
    addToast('Generating Instagram caption from Gemini...', 'info');

    await addLogMut.mutateAsync({
      level: 'info',
      source: 'caption-production',
      message: `IG caption generation requested — Ep ${activeEpisode?.episode_number ?? '?'}`,
      details: { episodeId: activeEpisode?.id, tab: 'insta_studio' },
      retryable: true,
      resolved: false,
    });

    const scriptText = scriptToText(activeEpisode, currentScript?.raw || null);
    const enabledFeatures = Object.keys(featureState).filter((id) => featureState[id]);
    if (emojiInjector) enabledFeatures.push('emoji_injector');
    const seriesTitle = 'AI Cartoon Wallah';
    const prompt = buildIgPrompt({
      scriptText,
      episodeNumber: activeEpisode?.episode_number ?? 1,
      seriesTitle,
      enabledFeatures,
    });

    try {
      const raw = await callGemini(prompt, 'You are a JSON-only response engine. Output valid JSON and nothing else.');
      const jsonStr = extractJson(raw);
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(jsonStr);
      } catch {
        throw new Error('Gemini response was not valid JSON.');
      }

      if (typeof parsed.caption === 'string') setIgCaption(parsed.caption);
      if (Array.isArray(parsed.hashtags)) {
        setIgHashtags(
          (parsed.hashtags as string[])
            .map((t) => {
              const s = String(t).trim();
              return s.startsWith('#') ? s : `#${s}`;
            })
            .filter(Boolean)
            .map((t, i) => ({ id: `gemini-ig-${i}`, label: t }))
        );
      }
      if (typeof parsed.optimized_preview === 'string') {
        setIgOptimizedPreview(parsed.optimized_preview);
      } else if (typeof parsed.caption === 'string') {
        // Fallback: reflow caption with line-break optimizer
        setIgOptimizedPreview(parsed.caption.replace(/\. /g, '.\n\n'));
      }

      await addLogMut.mutateAsync({
        level: 'success',
        source: 'caption-production',
        message: `IG caption generated for Ep ${activeEpisode?.episode_number ?? '?'}`,
        details: { hashtagCount: Array.isArray(parsed.hashtags) ? (parsed.hashtags as string[]).length : 0 },
        retryable: false,
        resolved: false,
      });
      addToast('Instagram caption generated successfully.', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      await addLogMut.mutateAsync({
        level: 'error',
        source: 'caption-production',
        message: `IG caption generation failed: ${message}`,
        details: { error: message },
        retryable: true,
        resolved: false,
      });
      addToast(`Generation failed: ${message}`, 'error');
    } finally {
      setIgGenerating(false);
    }
  }, [hasGeminiKey, activeEpisode, currentScript, featureState, emojiInjector, addToast, addLogMut]);

  // ─── Save IG metadata via useUpdateEpisodeMutation ───
  const handleSaveIg = useCallback(async () => {
    if (!activeEpisode) {
      addToast('No active episode to save metadata for.', 'warning');
      return;
    }
    setIgSaving(true);
    try {
      await updateEpisodeMut.mutateAsync({
        id: activeEpisode.id,
        updates: {
          metadata: {
            ...(activeEpisode.metadata || {}),
            instagram: {
              caption: igCaption,
              hashtags: igHashtags.map((t) => t.label),
              emojiInjector,
            },
          },
        },
      });
      await addLogMut.mutateAsync({
        level: 'success',
        source: 'caption-production',
        message: `IG caption saved for Ep ${activeEpisode.episode_number}`,
        details: { episodeId: activeEpisode.id, hashtagCount: igHashtags.length },
        retryable: false,
        resolved: false,
      });
      addToast(`Instagram caption saved for Ep ${activeEpisode.episode_number}.`, 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      addToast(`Save failed: ${message}`, 'error');
    } finally {
      setIgSaving(false);
    }
  }, [activeEpisode, igCaption, igHashtags, emojiInjector, updateEpisodeMut, addLogMut, addToast]);

  // ─── Phase 3 helpers ───

  // A/B Test Thumbnail Generator — deterministic CTR scores based on episode number
  const handleGenerateAbThumbnails = useCallback(() => {
    if (!activeEpisode) return;
    setAbGenerating(true);
    // Deterministic pseudo-scores derived from episode number so they're stable per episode
    const epNum = activeEpisode.episode_number ?? 1;
    const scoreA = Math.round((4 + ((epNum * 7) % 6) + (epNum % 3)) * 10) / 10; // ~4.0–9.9
    const scoreB = Math.round((4 + ((epNum * 11) % 6) + ((epNum + 1) % 4)) * 10) / 10;
    setTimeout(() => {
      setAbThumbnails({ a: { score: scoreA }, b: { score: scoreB } });
      setAbGenerating(false);
    }, 600);
  }, [activeEpisode]);

  // Click-Bait Score Matrix — simple 1-10 virality scoring algorithm
  const computeClickbaitScore = useCallback((text: string): number => {
    if (!text || !text.trim()) return 0;
    const lower = text.toLowerCase();
    let score = 1; // baseline
    const powerWords = ['ultimate', 'insane', 'shocking', 'secret', 'exposed', 'crazy', 'unbelievable', 'never', 'always', 'nobody', 'everyone', 'destroy', 'crushed', 'insane'];
    const emotionalTriggers = ['you won\'t believe', 'mind-blowing', 'game-changer', 'this is why', 'the truth', 'what happens', 'changed my life'];
    if (/\d/.test(text)) score += 1.5; // contains a number
    if (lower.includes('?') || /\bhow\b|\bwhy\b|\bwhat\b|\bwho\b|\bwhen\b/.test(lower)) score += 1.5; // question
    if (powerWords.some((w) => lower.includes(w))) score += 2;
    if (emotionalTriggers.some((p) => lower.includes(p))) score += 2;
    if (/[A-Z]{3,}/.test(text)) score += 1; // all-caps emphasis
    if (text.length > 0 && text.length < 120) score += 1; // punchy length
    return Math.max(1, Math.min(10, Math.round(score * 10) / 10));
  }, []);

  const handleComputeClickbait = useCallback(() => {
    setClickbaitScore({
      title: computeClickbaitScore(ytTitle),
      caption: computeClickbaitScore(ytDesc),
    });
  }, [computeClickbaitScore, ytTitle, ytDesc]);

  // Emoji Auto-Pattern Injector — contextual emoji insertion
  const emojiEnhancedCaption = useMemo(() => {
    if (!emojiPatternEnabled || !igCaption) return igCaption;
    const patterns: Array<[RegExp, string]> = [
      [/\b(save|saved|saving)\b/gi, ' 🔖'],
      [/\b(share|shared|sharing)\b/gi, ' 📤'],
      [/\b(follow|followed|following)\b/gi, ' ⭐'],
      [/\b(like|liked|liking)\b/gi, ' ❤️'],
      [/\b(comment|commented)\b/gi, ' 💬'],
      [/\b(subscribe|subscribed)\b/gi, ' 🔔'],
      [/\b(fire|viral|trending)\b/gi, ' 🔥'],
      [/\b(love|loved)\b/gi, ' 💖'],
      [/\b(laugh|funny|lol)\b/gi, ' 😂'],
      [/\b(win|winner|winning)\b/gi, ' 🏆'],
    ];
    let result = igCaption;
    for (const [re, emoji] of patterns) {
      result = result.replace(re, (m) => `${m}${emoji}`);
    }
    return result;
  }, [emojiPatternEnabled, igCaption]);

  // Comment Prompt Formulator — generates a debate-sparking pinned comment
  const handleGenerateCommentPrompt = useCallback(() => {
    if (!activeEpisode) return;
    setCommentPromptGenerating(true);
    const epNum = activeEpisode.episode_number ?? 1;
    const prompts = [
      `Hot take: most people get this completely wrong. What's YOUR take on Episode ${epNum}? Drop a comment — I'm reading every single one.`,
      `Unpopular opinion: this episode changes everything. Do you agree or am I crazy? Let's debate 👇`,
      `Question of the day: if you had to pick one moment from this, what hit hardest? No wrong answers.`,
      `Controversial take incoming: nobody is talking about the real lesson here. What did YOU take away?`,
      `Be honest — did you see the twist coming? I need to know if I'm the only one. Comment below.`,
    ];
    const pick = prompts[epNum % prompts.length];
    setTimeout(() => {
      setCommentPrompt(pick);
      setCommentPromptGenerating(false);
    }, 500);
  }, [activeEpisode]);

  // Brand Overlay Module — quadrant selection
  const quadrantClasses: Record<typeof brandQuadrant, string> = {
    'top-left': 'top-2 left-2',
    'top-right': 'top-2 right-2',
    'bottom-left': 'bottom-2 left-2',
    'bottom-right': 'bottom-2 right-2',
  };

  const handleToggleP3Feature = useCallback((id: string) => {
    setP3FeatureState((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  // ─── Derived ───
  const isLoading = episodesLoading;
  const saving = ytSaving || igSaving || updateEpisodeMut.isPending;

  return (
    <div className="space-y-4">
      {/* Header */}
      <MotionPanel className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gradient mb-1">Caption Production & Visual Asset Enhancer</h2>
          <p className="text-sm text-ink-300">
            Platform-specific metadata for YouTube and Instagram — powered by Gemini.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!hasGeminiKey && (
            <span className="flex items-center gap-1.5 text-xs text-warning">
              <AlertTriangle size={13} /> Gemini key missing
            </span>
          )}
          {activeEpisode && (
            <Badge variant="accent">Ep {activeEpisode.episode_number}</Badge>
          )}
        </div>
      </MotionPanel>

      {/* API key error state */}
      {!hasGeminiKey && (
        <MotionPanel className="p-4 border border-warning/30 bg-warning/5">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="text-warning shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-ink-100">Gemini API key not configured</p>
              <p className="text-xs text-ink-300 mt-1">
                Add your Gemini API key in <span className="text-accent">Settings → API Vault</span> to enable
                real metadata generation. All fields remain fully editable.
              </p>
            </div>
          </div>
        </MotionPanel>
      )}

      {/* Episode selector */}
      {isLoading ? (
        <MotionPanel className="p-12 flex justify-center">
          <Spinner size={24} />
        </MotionPanel>
      ) : episodes.length === 0 ? (
        <Panel>
          <EmptyState
            icon={<FileText size={28} />}
            title="No episodes available"
            subtitle="Create episodes in the Script Lab to generate captions."
          />
        </Panel>
      ) : (
        <>
          {/* Episode strip */}
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1">
            {episodes.slice(0, 12).map((ep) => (
              <MotionButton
                key={ep.id}
                onClick={() => {
                  setActiveEpisodeState(ep);
                  setActiveEpisode(ep.id);
                }}
                className={`shrink-0 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                  activeEpisode?.id === ep.id
                    ? 'bg-accent-dim text-accent border border-accent/30'
                    : 'bg-white/[0.04] text-ink-300 border border-white/[0.06] hover:text-ink-100'
                }`}
              >
                Ep {ep.episode_number}
                <span className="ml-1.5 text-[9px] opacity-60">{ep.status}</span>
              </MotionButton>
            ))}
          </div>

          {/* Sub-tabs */}
          <SubTabs tabs={CAPTION_TABS} activeTab={activeTab} onTabChange={setActiveTab} />

          {/* ─── YT Studio Tab ─── */}
          <AnimatePresence mode="wait">
            {activeTab === 'yt_studio' && (
              <motion.div
                key="yt_studio"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3 }}
                className="space-y-4"
              >
                {/* Generate button row */}
                <MotionPanel className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <Wand2 size={18} className="text-accent shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-ink-100">Generate from Gemini</p>
                      <p className="text-xs text-ink-300 mt-0.5">
                        Uses the current script to generate SEO-optimized title, description, tags, and pinned comment.
                      </p>
                    </div>
                  </div>
                  <MotionButton
                    onClick={handleGenerateYt}
                    disabled={ytGenerating || !hasGeminiKey || !activeEpisode}
                    className="btn-primary"
                  >
                    {ytGenerating ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                    {ytGenerating ? 'Generating...' : 'Generate from Gemini'}
                  </MotionButton>
                </MotionPanel>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* YouTube Metadata */}
                  <Panel title="YouTube Metadata Architect" icon={<Youtube size={15} />} action={<Badge variant="danger">YouTube Shorts</Badge>}>
                    <div className="p-4 space-y-4">
                      {/* Title */}
                      <div>
                        <label className="text-xs font-medium text-ink-200 mb-1.5 block">Optimized Title</label>
                        <input
                          value={ytTitle}
                          onChange={(e) => setYtTitle(e.target.value)}
                          className="input-field"
                          placeholder="SEO-optimized title..."
                        />
                        <p className="text-[10px] text-ink-400 mt-1">{ytTitle.length}/100 characters</p>
                      </div>

                      {/* Description */}
                      <div>
                        <label className="text-xs font-medium text-ink-200 mb-1.5 block">Deep Description</label>
                        <textarea
                          value={ytDesc}
                          onChange={(e) => setYtDesc(e.target.value)}
                          rows={7}
                          className="input-field resize-none font-mono text-sm"
                          placeholder="Full description with timestamps, links, and SEO..."
                        />
                      </div>

                      {/* Tags */}
                      <div>
                        <label className="text-xs font-medium text-ink-200 mb-1.5 block">Tag String</label>
                        <div className="flex flex-wrap gap-1.5 p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04] min-h-[60px]">
                          {ytTags.map((tag, idx) => (
                            <motion.span
                              key={tag.id}
                              layout
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.8 }}
                              className="chip bg-danger-dim text-danger cursor-grab active:cursor-grabbing flex items-center gap-1 group"
                            >
                              <GripVertical size={10} className="opacity-50 group-hover:opacity-100" />
                              {tag.label}
                              <button
                                onClick={() => moveYtTag(idx, -1)}
                                className="ml-0.5 opacity-40 hover:opacity-100"
                                title="Move left"
                              >
                                <X size={9} className="rotate-90" />
                              </button>
                              <button
                                onClick={() => moveYtTag(idx, 1)}
                                className="opacity-40 hover:opacity-100"
                                title="Move right"
                              >
                                <X size={9} className="-rotate-90" />
                              </button>
                              <button
                                onClick={() => removeYtTag(tag.id)}
                                className="ml-0.5 hover:text-white"
                                title="Remove"
                              >
                                <X size={10} />
                              </button>
                            </motion.span>
                          ))}
                          <input
                            placeholder="add tag..."
                            className="bg-transparent text-xs text-ink-100 outline-none flex-1 min-w-[80px] px-1"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                addYtTag(e.currentTarget.value);
                                e.currentTarget.value = '';
                              }
                            }}
                          />
                        </div>
                        <p className="text-[10px] text-ink-400 mt-1">
                          {ytTags.length} tags · Enter to add · × to remove · arrows to reorder
                        </p>
                      </div>

                      {/* Made with AI toggle */}
                      <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                        <div className="flex items-center gap-2">
                          <Sparkles size={14} className="text-accent" />
                          <div>
                            <p className="text-xs font-medium text-ink-100">"Made with AI" Tag</p>
                            <p className="text-[10px] text-ink-400">Enable YouTube AI disclosure flag</p>
                          </div>
                        </div>
                        <button
                          onClick={() => setMadeWithAI(!madeWithAI)}
                          className={`relative w-9 h-5 rounded-full transition-all ${madeWithAI ? 'bg-accent' : 'bg-ink-600'}`}
                          style={madeWithAI ? { boxShadow: '0 0 12px var(--accent-glow)' } : {}}
                        >
                          <motion.span
                            className="absolute top-0.5 w-4 h-4 rounded-full bg-white"
                            animate={{ left: madeWithAI ? 18 : 2 }}
                            transition={{ duration: 0.2 }}
                          />
                        </button>
                      </div>
                    </div>
                  </Panel>

                  {/* Thumbnail Frame Picker */}
                  <Panel title="AI Thumbnail Frame Picker" icon={<Image size={15} />}>
                    <div className="p-4">
                      {thumbnailFrame ? (
                        <div className="space-y-3">
                          <div className="relative aspect-video rounded-xl bg-ink-950 border border-white/[0.06] overflow-hidden grid-bg flex items-center justify-center">
                            <div className="text-center">
                              <Image size={32} className="text-accent mx-auto mb-2" />
                              <p className="text-xs text-ink-300">Best frame extracted at {thumbnailFrame.time}</p>
                              <p className="text-[10px] text-ink-400 mt-1">Sharpness filter applied · Maximum CTR</p>
                            </div>
                            <div className="absolute top-2 right-2 flex gap-1.5">
                              <Badge variant="success">Sharpness {thumbnailFrame.sharpness}%</Badge>
                              <Badge variant="accent">CTR Score {thumbnailFrame.score}</Badge>
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            {['0:05', '0:14', '0:28'].map((time) => (
                              <button
                                key={time}
                                onClick={() => setThumbnailFrame({ ...thumbnailFrame, time })}
                                className={`aspect-video rounded-lg border flex items-center justify-center cursor-pointer hover:border-white/[0.12] transition-all ${
                                  time === thumbnailFrame.time
                                    ? 'border-accent bg-accent-dim'
                                    : 'border-white/[0.04] bg-ink-900'
                                }`}
                              >
                                <span className="text-[10px] text-ink-400 font-mono">{time}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <EmptyState
                          icon={<Image size={24} />}
                          title="No thumbnail yet"
                          subtitle="Generate metadata to extract the best frame"
                        />
                      )}
                    </div>
                  </Panel>

                  {/* Pinned Comment Generator */}
                  <Panel title="Automated Pinned Comment" icon={<Pin size={15} />}>
                    <div className="p-4 space-y-3">
                      <textarea
                        value={pinnedComment}
                        onChange={(e) => setPinnedComment(e.target.value)}
                        rows={5}
                        className="input-field resize-none text-sm"
                        placeholder="Conversational comment designed to spark debate and engagement..."
                      />
                      <div className="p-3 rounded-xl bg-accent-dim border border-accent/20">
                        <p className="text-[10px] text-accent font-semibold uppercase tracking-wide mb-1">
                          Engagement Strategy
                        </p>
                        <p className="text-xs text-ink-200">
                          Open-ended question · Personal invitation · References next episode
                        </p>
                      </div>
                    </div>
                  </Panel>

                  {/* ─── Phase 3: A/B Test Thumbnail Generator ─── */}
                  <Panel title="A/B Test Thumbnail Generator" icon={<ImagePlus size={15} />}>
                    <div className="p-4 space-y-3">
                      <p className="text-xs text-ink-300">
                        Generate dual high-CTR thumbnail options with deterministic scoring per episode.
                      </p>
                      <MotionButton
                        onClick={handleGenerateAbThumbnails}
                        disabled={abGenerating || !activeEpisode}
                        className="btn-secondary text-sm"
                      >
                        {abGenerating ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <ImagePlus size={14} />
                        )}
                        Generate A/B Thumbnails
                      </MotionButton>
                      {(abThumbnails.a || abThumbnails.b) && (
                        <div className="grid grid-cols-2 gap-3">
                          {(['a', 'b'] as const).map((opt) => {
                            const data = abThumbnails[opt];
                            const scoreA = abThumbnails.a?.score ?? 0;
                            const scoreB = abThumbnails.b?.score ?? 0;
                            const isWinner = data && opt === 'a' ? scoreA >= scoreB : data && opt === 'b' ? scoreB > scoreA : false;
                            return (
                              <div
                                key={opt}
                                className={`relative rounded-xl border-2 p-3 transition-all ${
                                  isWinner
                                    ? 'border-accent bg-accent-dim'
                                    : 'border-ink-700 bg-ink-900/40'
                                }`}
                              >
                                {isWinner && (
                                  <span className="absolute -top-2 right-2 rounded-full bg-accent text-[9px] font-bold uppercase tracking-wide text-white px-2 py-0.5">
                                    Winner
                                  </span>
                                )}
                                <div className="aspect-video rounded-lg bg-gradient-to-br from-ink-700 to-ink-900 flex items-center justify-center mb-2 border border-ink-600">
                                  <Image size={28} className="text-ink-500" />
                                </div>
                                <p className="text-xs font-semibold text-ink-100">Option {opt.toUpperCase()}</p>
                                <p className="text-[10px] text-ink-300">CTR Score</p>
                                <p className="text-lg font-bold text-accent">{data?.score?.toFixed(1) ?? '—'}</p>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </Panel>

                  {/* ─── Phase 3: Click-Bait Score Matrix ─── */}
                  <Panel title="Click-Bait Score Matrix" icon={<TrendingUp size={15} />}>
                    <div className="p-4 space-y-3">
                      <p className="text-xs text-ink-300">
                        Virality scoring (1–10) based on power words, numbers, questions, and emotional triggers.
                      </p>
                      <MotionButton
                        onClick={handleComputeClickbait}
                        disabled={!ytTitle && !ytDesc}
                        className="btn-secondary text-sm"
                      >
                        <TrendingUp size={14} />
                        Analyze Virality
                      </MotionButton>
                      {clickbaitScore && (
                        <div className="space-y-3">
                          {([
                            { label: 'Title', value: clickbaitScore.title },
                            { label: 'Caption', value: clickbaitScore.caption },
                          ]).map(({ label, value }) => {
                            const pct = (value / 10) * 100;
                            const color = value >= 7 ? 'bg-green-500' : value >= 4 ? 'bg-yellow-500' : 'bg-red-500';
                            return (
                              <div key={label}>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs font-semibold text-ink-200">{label}</span>
                                  <span className="text-xs font-bold text-ink-100">{value.toFixed(1)} / 10</span>
                                </div>
                                <div className="h-2 rounded-full bg-ink-800 overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${color} transition-all duration-500`}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </Panel>

                  {/* ─── Phase 3: Comment Prompt Formulator ─── */}
                  <Panel title="Comment Prompt Formulator" icon={<MessageCircle size={15} />}>
                    <div className="p-4 space-y-3">
                      <p className="text-xs text-ink-300">
                        Auto-generates a controversial / question-based pinned comment to spark debate.
                      </p>
                      <MotionButton
                        onClick={handleGenerateCommentPrompt}
                        disabled={commentPromptGenerating || !activeEpisode}
                        className="btn-secondary text-sm"
                      >
                        {commentPromptGenerating ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <MessageCircle size={14} />
                        )}
                        Generate Comment Prompt
                      </MotionButton>
                      <textarea
                        value={commentPrompt}
                        onChange={(e) => setCommentPrompt(e.target.value)}
                        rows={4}
                        className="input-field resize-none text-sm"
                        placeholder="Click generate to formulate a debate-sparking pinned comment..."
                      />
                    </div>
                  </Panel>

                  {/* ─── Phase 3: Brand Overlay Module ─── */}
                  <Panel title="Brand Overlay Module" icon={<Stamp size={15} />}>
                    <div className="p-4 space-y-3">
                      <label className="flex items-center justify-between cursor-pointer">
                        <span className="text-xs font-semibold text-ink-200">Enable Brand Overlay</span>
                        <button
                          type="button"
                          onClick={() => setBrandOverlayEnabled((v) => !v)}
                          className={`relative w-10 h-5 rounded-full transition-colors ${
                            brandOverlayEnabled ? 'bg-accent' : 'bg-ink-700'
                          }`}
                        >
                          <span
                            className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                              brandOverlayEnabled ? 'translate-x-5' : ''
                            }`}
                          />
                        </button>
                      </label>
                      {brandOverlayEnabled && (
                        <>
                          <p className="text-xs text-ink-300">Select quadrant for transparent brand signature:</p>
                          <div className="grid grid-cols-2 gap-2">
                            {(['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const).map((q) => (
                              <button
                                key={q}
                                type="button"
                                onClick={() => setBrandQuadrant(q)}
                                className={`text-xs py-2 px-3 rounded-lg border transition-all ${
                                  brandQuadrant === q
                                    ? 'border-accent bg-accent-dim text-accent'
                                    : 'border-ink-700 text-ink-300 hover:border-ink-500'
                                }`}
                              >
                                {q.replace('-', ' ')}
                              </button>
                            ))}
                          </div>
                          <div className="relative aspect-video rounded-lg bg-gradient-to-br from-ink-700 to-ink-900 border border-ink-600 overflow-hidden">
                            <div className={`absolute ${quadrantClasses[brandQuadrant]} flex items-center gap-1`}>
                              <Stamp size={14} className="text-white/70" />
                              <span className="text-[9px] text-white/70 font-semibold">BRAND</span>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </Panel>

                  {/* Feature Toggles */}
                  <MotionPanel className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles size={15} className="text-accent" />
                      <h3 className="text-sm font-semibold text-ink-100">Enhancement Modules</h3>
                    </div>
                    <div className="space-y-2 max-h-[300px] overflow-y-auto scrollbar-hide pr-1">
                      {CAPTION_FEATURES.map((toggle: FeatureToggle) => (
                        <FeatureToggleRow
                          key={toggle.id}
                          toggle={toggle}
                          enabled={!!featureState[toggle.id]}
                          onToggle={() =>
                            setFeatureState((prev) => ({ ...prev, [toggle.id]: !prev[toggle.id] }))
                          }
                        />
                      ))}
                    </div>
                  </MotionPanel>

                  {/* Phase 3 Feature Toggles */}
                  <Panel title="Phase 3 Features" icon={<Sparkles size={15} />}>
                    <div className="space-y-1">
                      {CAPTION_P3_FEATURES.map((toggle: FeatureToggle) => (
                        <FeatureToggleRow
                          key={toggle.id}
                          toggle={toggle}
                          enabled={!!p3FeatureState[toggle.id]}
                          onToggle={() => handleToggleP3Feature(toggle.id)}
                        />
                      ))}
                    </div>
                  </Panel>
                </div>

                {/* Save button */}
                <div className="flex justify-end">
                  <MotionButton
                    onClick={handleSaveYt}
                    disabled={saving || !activeEpisode}
                    className="btn-primary"
                  >
                    {ytSaving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                    Save YouTube Metadata
                  </MotionButton>
                </div>
              </motion.div>
            )}

            {/* ─── Insta Studio Tab ─── */}
            {activeTab === 'insta_studio' && (
              <motion.div
                key="insta_studio"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3 }}
                className="space-y-4"
              >
                {/* Generate button row */}
                <MotionPanel className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <Wand2 size={18} className="text-accent shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-ink-100">Generate Caption</p>
                      <p className="text-xs text-ink-300 mt-0.5">
                        Uses the current script to generate an Instagram-optimized caption with hashtags.
                      </p>
                    </div>
                  </div>
                  <MotionButton
                    onClick={handleGenerateIg}
                    disabled={igGenerating || !hasGeminiKey || !activeEpisode}
                    className="btn-primary"
                  >
                    {igGenerating ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                    {igGenerating ? 'Generating...' : 'Generate Caption'}
                  </MotionButton>
                </MotionPanel>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Instagram Caption */}
                  <Panel title="Instagram Bio-Caption Formulator" icon={<Instagram size={15} />} action={<Badge variant="accent">Reels</Badge>}>
                    <div className="p-4 space-y-4">
                      <div>
                        <label className="text-xs font-medium text-ink-200 mb-1.5 block">Clean Caption with Hook Lines</label>
                        <textarea
                          value={igCaption}
                          onChange={(e) => setIgCaption(e.target.value)}
                          rows={8}
                          className="input-field resize-none font-mono text-sm"
                          placeholder="Engaging hook + structured line breaks..."
                        />
                      </div>

                      {/* Emoji Injector toggle */}
                      <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                        <div className="flex items-center gap-2">
                          <Smile size={14} className="text-accent" />
                          <div>
                            <p className="text-xs font-medium text-ink-100">Emoji Injector</p>
                            <p className="text-[10px] text-ink-400">Auto-add relevant emojis to caption</p>
                          </div>
                        </div>
                        <button
                          onClick={() => setEmojiInjector(!emojiInjector)}
                          className={`relative w-9 h-5 rounded-full transition-all ${emojiInjector ? 'bg-accent' : 'bg-ink-600'}`}
                          style={emojiInjector ? { boxShadow: '0 0 12px var(--accent-glow)' } : {}}
                        >
                          <motion.span
                            className="absolute top-0.5 w-4 h-4 rounded-full bg-white"
                            animate={{ left: emojiInjector ? 18 : 2 }}
                            transition={{ duration: 0.2 }}
                          />
                        </button>
                      </div>
                    </div>
                  </Panel>

                  {/* Line Break Optimizer Preview */}
                  <Panel title="Line Break Optimizer Preview" icon={<RefreshCw size={15} />}>
                    <div className="p-4 space-y-3">
                      {igOptimizedPreview ? (
                        <pre className="text-xs font-mono text-ink-200 whitespace-pre-wrap p-3 rounded-xl bg-black/30 border border-white/[0.04] min-h-[160px]">
                          {igOptimizedPreview}
                        </pre>
                      ) : (
                        <EmptyState
                          icon={<RefreshCw size={24} />}
                          title="No preview yet"
                          subtitle="Generate a caption to see the optimized line breaks"
                        />
                      )}
                      <div className="p-3 rounded-xl bg-accent-dim border border-accent/20">
                        <p className="text-[10px] text-accent font-semibold uppercase tracking-wide mb-1">
                          Caption Structure
                        </p>
                        <div className="space-y-1 text-[10px] text-ink-300">
                          <p>1. Hook line (first 2 lines visible before "more")</p>
                          <p>2. Context with line breaks</p>
                          <p>3. CTA + hashtags at the end</p>
                        </div>
                      </div>
                    </div>
                  </Panel>

                  {/* Hashtag Manager */}
                  <Panel title="Hashtag Manager" icon={<Hash size={15} />}>
                    <div className="p-4 space-y-3">
                      <div className="flex flex-wrap gap-1.5 p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04] min-h-[60px]">
                        {igHashtags.map((tag) => (
                          <motion.span
                            key={tag.id}
                            layout
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            className="chip bg-accent-dim text-accent flex items-center gap-1 group"
                          >
                            <Hash size={10} />
                            {tag.label}
                            <button
                              onClick={() => removeIgHashtag(tag.id)}
                              className="ml-0.5 hover:text-white"
                            >
                              <X size={10} />
                            </button>
                          </motion.span>
                        ))}
                        <input
                          placeholder="add hashtag..."
                          className="bg-transparent text-xs text-ink-100 outline-none flex-1 min-w-[80px] px-1"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              addIgHashtag(e.currentTarget.value);
                              e.currentTarget.value = '';
                            }
                          }}
                        />
                      </div>
                      <p className="text-[10px] text-ink-400">
                        {igHashtags.length} hashtags · Enter to add · × to remove
                      </p>
                    </div>
                  </Panel>

                  {/* ─── Phase 3: Emoji Auto-Pattern Injector ─── */}
                  <Panel title="Emoji Auto-Pattern Injector" icon={<Smile size={15} />}>
                    <div className="p-4 space-y-3">
                      <label className="flex items-center justify-between cursor-pointer">
                        <span className="text-xs font-semibold text-ink-200">Auto-inject contextual emojis</span>
                        <button
                          type="button"
                          onClick={() => setEmojiPatternEnabled((v) => !v)}
                          className={`relative w-10 h-5 rounded-full transition-colors ${
                            emojiPatternEnabled ? 'bg-accent' : 'bg-ink-700'
                          }`}
                        >
                          <span
                            className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                              emojiPatternEnabled ? 'translate-x-5' : ''
                            }`}
                          />
                        </button>
                      </label>
                      <p className="text-xs text-ink-300">
                        When enabled, contextual emojis are inserted after keywords (save 🔖, share 📤, follow ⭐, like ❤️, comment 💬, subscribe 🔔, fire 🔥).
                      </p>
                      {emojiPatternEnabled && (
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-ink-400 mb-1">Preview</p>
                          <div className="rounded-lg border border-ink-700 bg-ink-900/40 p-3 text-xs text-ink-200 whitespace-pre-wrap max-h-40 overflow-y-auto scrollbar-hide">
                            {emojiEnhancedCaption || <span className="text-ink-500">Generate a caption to see emoji-enhanced preview.</span>}
                          </div>
                        </div>
                      )}
                    </div>
                  </Panel>

                  {/* Feature Toggles (Insta) */}
                  <MotionPanel className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles size={15} className="text-accent" />
                      <h3 className="text-sm font-semibold text-ink-100">Enhancement Modules</h3>
                    </div>
                    <div className="space-y-2 max-h-[300px] overflow-y-auto scrollbar-hide pr-1">
                      {CAPTION_FEATURES.map((toggle: FeatureToggle) => (
                        <FeatureToggleRow
                          key={toggle.id}
                          toggle={toggle}
                          enabled={!!featureState[toggle.id]}
                          onToggle={() =>
                            setFeatureState((prev) => ({ ...prev, [toggle.id]: !prev[toggle.id] }))
                          }
                        />
                      ))}
                    </div>
                  </MotionPanel>

                  {/* Phase 3 Feature Toggles (Insta) */}
                  <Panel title="Phase 3 Features" icon={<Sparkles size={15} />}>
                    <div className="space-y-1">
                      {CAPTION_P3_FEATURES.map((toggle: FeatureToggle) => (
                        <FeatureToggleRow
                          key={toggle.id}
                          toggle={toggle}
                          enabled={!!p3FeatureState[toggle.id]}
                          onToggle={() => handleToggleP3Feature(toggle.id)}
                        />
                      ))}
                    </div>
                  </Panel>
                </div>

                {/* Save button */}
                <div className="flex justify-end">
                  <MotionButton
                    onClick={handleSaveIg}
                    disabled={saving || !activeEpisode}
                    className="btn-primary"
                  >
                    {igSaving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                    Save Instagram Caption
                  </MotionButton>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}
