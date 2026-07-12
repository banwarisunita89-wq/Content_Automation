// --- src/modules/CharactersModule.tsx ---
import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Scan, Mic, Shirt, Plus, X, Save, User, Lock, Volume2,
  AlertTriangle, Trash2, Check, Download, Palette, Sliders, Maximize
} from 'lucide-react';

// ─── Stores ───
// FIX: Swapped useApiVaultStore with useBackendStatusStore for zero-trust security
import { useActiveStore, useToastStore, useBackendStatusStore } from '../../lib/stores';

// ─── React Query hooks ───
import {
  useCharactersQuery,
  useCreateCharacterMutation,
  useUpdateCharacterMutation,
  useDeleteCharacterMutation,
  useAddLogMutation,
} from '../../lib/queries';

// ─── Feature configuration (data-driven UI) ───
import {
  CHARACTER_TABS,
  CHARACTER_FEATURES,
  FACE_METRICS_CONFIG,
  COSTUME_FIELDS,
  type FeatureToggle,
  type FeatureInput,
  CHARACTER_P3_FEATURES, 
  MOOD_EXPRESSIONS
} from '../../lib/featuresConfig';

// ─── Animated UI primitives ───
import {
  MotionPanel,
  MotionButton,
  SubTabs,
  FeatureToggleRow,
} from '../ui/Animated';

// ─── Static UI primitives ───
import { Panel, Badge, Spinner, EmptyState } from '../ui/Primitives';

// ─── External API (ElevenLabs voice test) ───
import { callElevenLabs } from '../../lib/api';

// ─── Types ───
import type { Character } from '../../lib/supabase';

// ─── Constants ───
const DEFAULT_VISUAL_ANCHORS =
  'Disney Pixar 3D style, consistent character model, octane render, volumetric lighting, rich bokeh, cinematic depth of field, 4K detail';

const FAL_LOCK_EXPLANATION =
  'The Fal API payloads explicitly lock parameters for eye spacing, nose width, and jawline by passing strict reference image seeds to prevent facial morphing between shots.';

const TEST_VOICE_TEXT = 'Hi, this is a voice identity check for visual consistency across episodes.';

// Build a fresh, blank character edit buffer (used by the Register form).
function blankCharacter(): Partial<Character> {
  return {
    name: '',
    description: '',
    face_metrics: {},
    voice_id: '',
    costume: {},
    visual_anchors: DEFAULT_VISUAL_ANCHORS,
    reference_image_url: '',
  };
}

export function CharactersModule({ seriesId }: { seriesId: string | null }) {
  // ─── Stores ───
  const activeSeriesId = useActiveStore((s) => s.activeSeriesId);
  const addToast = useToastStore((s) => s.addToast);
  
  // FIX: SECURE BACKEND READ (No client side keys)
  const backendStatus = useBackendStatusStore((s) => s.services);
  const hasElevenLabsKey = backendStatus.elevenlabs;

  // Resolve the effective series id: explicit prop first, then the active store.
  const effectiveSeriesId = seriesId ?? activeSeriesId;

  // ─── React Query ───
  const { data: characters = [], isLoading } = useCharactersQuery(effectiveSeriesId);
  const createMut = useCreateCharacterMutation();
  const updateMut = useUpdateCharacterMutation();
  const deleteMut = useDeleteCharacterMutation();
  const addLogMut = useAddLogMutation();

  // ─── Local UI state ───
  const [activeTab, setActiveTab] = useState<string>('roster');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Partial<Character>>(blankCharacter());
  const [showForm, setShowForm] = useState(false);
  const [testingVoiceId, setTestingVoiceId] = useState<string | null>(null);

  // Phase 3 state
  const [moodState, setMoodState] = useState<Record<string, string>>({});
  const [voiceTuning, setVoiceTuning] = useState<Record<string, { pitch: number; speed: number }>>({});
  const [scaling, setScaling] = useState({ heightCm: 175, widthCm: 45 });
  const [toast, setToast] = useState<string | null>(null);

  // Feature toggle state — seeded from CHARACTER_FEATURES defaults.
  const [featureState, setFeatureState] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(CHARACTER_FEATURES.map((f) => [f.id, f.defaultEnabled]))
  );

  // Auto-select the first character once the roster loads.
  const editingRef = useRef(false);
  useEffect(() => {
    if (characters.length === 0) {
      editingRef.current = false;
      setSelectedId(null);
      setEditing(blankCharacter());
      return;
    }
    if (!selectedId) {
      setSelectedId(characters[0].id);
      setEditing(characters[0]);
      editingRef.current = true;
      return;
    }
    // Only sync from query data if user hasn't started editing
    if (!editingRef.current) {
      const current = characters.find((c) => c.id === selectedId);
      if (current) setEditing(current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [characters]);

  const selected = useMemo(
    () => characters.find((c) => c.id === selectedId) ?? null,
    [characters, selectedId]
  );

  // ─── Logging helper ───
  function log(level: 'success' | 'info' | 'warning' | 'error', message: string) {
    addLogMut.mutate({
      level,
      source: 'character-world',
      message,
      details: {},
      retryable: false,
      resolved: false,
    });
  }

  // ─── Actions ───
  function startNew() {
    setEditing(blankCharacter());
    setShowForm(true);
    setActiveTab('roster');
  }

  function cancelForm() {
    setShowForm(false);
    if (selected) {
      setEditing(selected);
    } else {
      setEditing(blankCharacter());
    }
  }

  async function saveCharacter() {
    if (!effectiveSeriesId) {
      addToast('Select a series before registering characters.', 'warning');
      return;
    }
    if (!editing.name?.trim()) {
      addToast('Character name is required.', 'warning');
      return;
    }

    try {
      if (selected && !showForm) {
        // Update existing character from the detail panel.
        await updateMut.mutateAsync({ id: selected.id, updates: editing });
        addToast(`Character "${editing.name}" updated`, 'success');
        log('success', `Character "${editing.name}" updated with identity lock changes`);
      } else if (showForm && selected) {
        // Editing an existing character via the form.
        await updateMut.mutateAsync({ id: selected.id, updates: editing });
        addToast(`Character "${editing.name}" updated`, 'success');
        log('success', `Character "${editing.name}" updated via registration form`);
        setShowForm(false);
      } else {
        // Creating a new character.
        const created = await createMut.mutateAsync({
          ...editing,
          series_id: effectiveSeriesId,
        } as Partial<Character>);
        if (created) {
          setSelectedId(created.id);
          setEditing(created);
          addToast(`Character "${created.name}" registered`, 'success');
          log('success', `Character "${created.name}" registered with face identity lock`);
        }
        setShowForm(false);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      addToast(`Failed to save character: ${message}`, 'error');
      log('error', `Character save failed: ${message}`);
    }
  }

  async function removeCharacter(id: string) {
    const char = characters.find((c) => c.id === id);
    try {
      await deleteMut.mutateAsync(id);
      setSelectedId(null);
      setEditing(blankCharacter());
      setShowForm(false);
      addToast(`Character "${char?.name ?? id}" deleted`, 'info');
      log('info', `Character "${char?.name ?? id}" deleted from roster`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      addToast(`Failed to delete character: ${message}`, 'error');
      log('error', `Character delete failed: ${message}`);
    }
  }

  async function testVoice(voiceId: string) {
    if (!hasElevenLabsKey) {
      addToast('ElevenLabs API key not configured on server. Add it in the Secure Vault.', 'warning');
      return;
    }
    if (!voiceId.trim()) {
      addToast('Enter an ElevenLabs voice ID to test.', 'warning');
      return;
    }
    setTestingVoiceId(voiceId);
    try {
      await callElevenLabs(TEST_VOICE_TEXT, voiceId);
      addToast('Voice test succeeded — voice ID is valid.', 'success');
      log('success', `ElevenLabs voice test succeeded for voice ID "${voiceId.slice(0, 12)}…"`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      addToast(`Voice test failed: ${message}`, 'error');
      log('error', `ElevenLabs voice test failed for "${voiceId}": ${message}`);
    } finally {
      setTestingVoiceId(null);
    }
  }

  // ─── Field helpers (data-driven from config) ───
  function setMetric(key: string, value: number | string) {
    setEditing((prev) => ({
      ...prev,
      face_metrics: { ...(prev.face_metrics ?? {}), [key]: value },
    }));
  }

  function setCostumeField(key: string, value: string) {
    setEditing((prev) => ({
      ...prev,
      costume: { ...(prev.costume ?? {}), [key]: value },
    }));
  }

  // ─── Derived: costume color swatches for the roster card preview ───
  const costumeColorFields = COSTUME_FIELDS.filter((f) => f.type === 'color');

  const saving = createMut.isPending || updateMut.isPending;
  const deleting = deleteMut.isPending;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="glass-panel p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gradient mb-1">
            Character World — Facial Sync Identity Registry
          </h2>
          <p className="text-sm text-ink-300">
            Lock character metrics, voice clones, and costumes for visual consistency.
          </p>
        </div>
        <MotionButton onClick={startNew} className="btn-primary">
          <Plus size={15} /> Register Character
        </MotionButton>
      </div>

      {/* Sub-tabs */}
      <SubTabs tabs={CHARACTER_TABS} activeTab={activeTab} onTabChange={setActiveTab} />

      <AnimatePresence mode="wait">
        {/* ───────────────── Roster Tab ───────────────── */}
        {activeTab === 'roster' && (
          <motion.div
            key="roster"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            {isLoading ? (
              <MotionPanel className="p-12 flex justify-center">
                <Spinner size={24} />
              </MotionPanel>
            ) : characters.length === 0 && !showForm ? (
              <Panel>
                <EmptyState
                  icon={<Users size={28} />}
                  title="No characters registered"
                  subtitle="Register characters to lock visual identity across all episodes"
                />
              </Panel>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Roster grid */}
                <div className="lg:col-span-2">
                  <Panel
                    title="Character Roster"
                    icon={<Users size={15} />}
                    action={<Badge>{characters.length}</Badge>}
                  >
                    <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {characters.map((char) => {
                        const isSelected = selectedId === char.id;
                        return (
                          <MotionButton
                            key={char.id}
                            onClick={() => {
                              setSelectedId(char.id);
                              setEditing(char);
                              setShowForm(false);
                            }}
                            className={`text-left p-3 rounded-xl border transition-all ${
                              isSelected
                                ? 'bg-accent-dim border-accent/30'
                                : 'bg-white/[0.02] border-white/[0.04] hover:border-white/[0.08]'
                            }`}
                          >
                            <div className="flex items-center gap-3 mb-2">
                              <div className="w-9 h-9 rounded-xl bg-ink-700 flex items-center justify-center shrink-0">
                                <User size={16} className="text-accent" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-ink-100 truncate">
                                  {char.name}
                                </p>
                                <p className="text-[10px] text-ink-400 truncate">
                                  {char.description || 'No description'}
                                </p>
                              </div>
                              <Lock size={12} className="text-success shrink-0" />
                            </div>

                            {/* Voice ID status */}
                            <div className="flex items-center gap-1.5 mb-2">
                              <Mic size={11} className="text-ink-400" />
                              {char.voice_id ? (
                                <Badge variant="success">
                                  Voice: {char.voice_id.slice(0, 10)}…
                                </Badge>
                              ) : (
                                <Badge variant="warning">No voice assigned</Badge>
                              )}
                            </div>

                            {/* Costume color swatches */}
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <Shirt size={11} className="text-ink-400" />
                              {costumeColorFields.length > 0 ? (
                                costumeColorFields.map((field) => {
                                  const color = (char.costume?.[field.id] as string) || (field.defaultValue as string) || '#444';
                                  return (
                                    <span
                                      key={field.id}
                                      title={`${field.label}: ${color}`}
                                      className="w-4 h-4 rounded-full border border-white/10"
                                      style={{ backgroundColor: color }}
                                    />
                                  );
                                })
                              ) : (
                                <span className="text-[10px] text-ink-500">No costume set</span>
                              )}
                            </div>
                          </MotionButton>
                        );
                      })}
                    </div>
                  </Panel>
                </div>

                {/* Detail / form panel */}
                <div className="lg:col-span-1">
                  <Panel
                    title={
                      showForm
                        ? 'Register New Character'
                        : selected
                          ? `Identity Lock — ${selected.name}`
                          : 'Character Details'
                    }
                    icon={showForm ? <Plus size={15} /> : <Scan size={15} />}
                    action={
                      selected && !showForm ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => setShowForm(true)}
                            className="btn-ghost text-xs py-1.5 px-3"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => selected.id && removeCharacter(selected.id)}
                            disabled={deleting}
                            className="btn-ghost text-xs py-1.5 px-3 text-danger hover:text-danger"
                          >
                            Delete
                          </button>
                        </div>
                      ) : undefined
                    }
                  >
                    <div className="p-4 space-y-4">
                      {/* Name + Reference image URL */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-medium text-ink-200 mb-1.5 block">
                            Character Name
                          </label>
                          <input
                            value={editing.name ?? ''}
                            onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                            className="input-field"
                            placeholder="e.g. Aria"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-ink-200 mb-1.5 block">
                            Reference Image URL
                          </label>
                          <input
                            value={editing.reference_image_url ?? ''}
                            onChange={(e) => setEditing({ ...editing, reference_image_url: e.target.value })}
                            className="input-field"
                            placeholder="https://..."
                          />
                        </div>
                      </div>

                      {/* Description */}
                      <div>
                        <label className="text-xs font-medium text-ink-200 mb-1.5 block">
                          Description
                        </label>
                        <textarea
                          value={editing.description ?? ''}
                          onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                          rows={2}
                          className="input-field resize-none text-sm"
                          placeholder="Character personality and role..."
                        />
                      </div>

                      {/* Costume Matrix (rendered dynamically from COSTUME_FIELDS) */}
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Shirt size={14} className="text-accent" />
                          <span className="text-xs font-medium text-ink-200">Costume Matrix</span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {COSTUME_FIELDS.map((field: FeatureInput) => (
                            <div key={field.id}>
                              <p className="text-[10px] text-ink-400 mb-1">{field.label}</p>
                              {field.type === 'color' ? (
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="color"
                                    value={(editing.costume?.[field.id] as string) || (field.defaultValue as string) || '#000000'}
                                    onChange={(e) => setCostumeField(field.id, e.target.value)}
                                    className="w-8 h-8 rounded-lg bg-transparent border border-white/10 cursor-pointer shrink-0"
                                  />
                                  <input
                                    type="text"
                                    value={(editing.costume?.[field.id] as string) || (field.defaultValue as string) || ''}
                                    onChange={(e) => setCostumeField(field.id, e.target.value)}
                                    className="input-field text-xs font-mono"
                                    placeholder="#000000"
                                  />
                                </div>
                              ) : (
                                <input
                                  type="text"
                                  value={(editing.costume?.[field.id] as string) || ''}
                                  onChange={(e) => setCostumeField(field.id, e.target.value)}
                                  className="input-field text-xs"
                                  placeholder={field.placeholder ?? field.label}
                                />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Save / Cancel */}
                      <div className="flex gap-2">
                        <MotionButton
                          onClick={saveCharacter}
                          disabled={saving}
                          className="btn-primary flex-1"
                        >
                          {saving ? <Spinner size={14} /> : <Save size={15} />}
                          {selected && showForm ? 'Update' : 'Register'} Character
                        </MotionButton>
                        {showForm && (
                          <button onClick={cancelForm} className="btn-ghost">
                            <X size={15} /> Cancel
                          </button>
                        )}
                      </div>
                    </div>
                  </Panel>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* ───────────────── Phase 3: Mood / Outfit / Scaling / Assets (Roster) ───────────────── */}
        {activeTab === 'roster' && selected && !showForm && (
          <motion.div
            key="p3-roster"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            {/* Dynamic Mood Canvas Builder */}
            <Panel title="Dynamic Mood Canvas Builder" icon={<Palette size={15} />}>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {MOOD_EXPRESSIONS.map((mood) => {
                  const selectedMood = moodState[selected.id] === mood.id;
                  return (
                    <button
                      key={mood.id}
                      type="button"
                      onClick={() =>
                        setMoodState((prev) => ({ ...prev, [selected.id]: mood.id }))
                      }
                      className={`flex flex-col items-center gap-1 rounded-lg border p-2 text-xs transition ${
                        selectedMood
                          ? 'border-indigo-400 bg-indigo-500/10'
                          : 'border-slate-700 hover:border-slate-500'
                      }`}
                    >
                      <span
                        className="h-8 w-8 rounded-full"
                        style={{ backgroundColor: mood.color }}
                      />
                      <span className="font-medium text-slate-200">{mood.label}</span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-900/50 p-3">
                <span
                  className="h-10 w-10 rounded-full"
                  style={{
                    backgroundColor:
                      MOOD_EXPRESSIONS.find((m) => m.id === moodState[selected.id])?.color ??
                      '#7c8499',
                  }}
                />
                <div className="text-sm">
                  <div className="font-medium text-slate-100">Default Expression</div>
                  <div className="text-xs text-slate-400">
                    {MOOD_EXPRESSIONS.find((m) => m.id === moodState[selected.id])?.label ?? 'Neutral'}
                  </div>
                </div>
              </div>
            </Panel>

            {/* Outfit Memory Vault */}
            <Panel title="Outfit Memory Vault" icon={<Shirt size={15} />}>
              <p className="mb-3 text-xs text-slate-400">
                Prevents accidental clothing changes between episodes.
              </p>
              <div className="space-y-2">
                {((editing as Record<string, unknown>)?.outfitHistory as Array<{ episode: number; description: string }> | undefined ?? [
                  { episode: 1, description: 'Default casual outfit' },
                  { episode: 2, description: 'Formal event attire' },
                  { episode: 3, description: 'Outdoor adventure gear' },
                ]).map((entry: { episode: number; description: string }, idx: number) => (
                  <div
                    key={idx}
                    className="flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-900/40 p-2"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-500/20 text-xs font-bold text-indigo-300">
                      {entry.episode}
                    </span>
                    <span className="text-sm text-slate-200">{entry.description}</span>
                  </div>
                ))}
              </div>
            </Panel>

            {/* Dynamic Scaling Controller */}
            <Panel title="Dynamic Scaling Controller" icon={<Maximize size={15} />}>
              <p className="mb-3 text-xs text-slate-400">
                Maintains height/width proportions in multi-character scenes.
              </p>
              <div className="flex flex-wrap items-end gap-4">
                <label className="text-xs text-slate-400">
                  Height (cm)
                  <input
                    type="number"
                    value={scaling.heightCm}
                    onChange={(e) =>
                      setScaling((s) => ({ ...s, heightCm: Number(e.target.value) || 0 }))
                    }
                    className="mt-1 block w-24 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100"
                  />
                </label>
                <label className="text-xs text-slate-400">
                  Width (cm)
                  <input
                    type="number"
                    value={scaling.widthCm}
                    onChange={(e) =>
                      setScaling((s) => ({ ...s, widthCm: Number(e.target.value) || 0 }))
                    }
                    className="mt-1 block w-24 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100"
                  />
                </label>
                <div className="flex items-end gap-2">
                  <div
                    className="rounded bg-indigo-500/30"
                    style={{ height: Math.min(scaling.heightCm / 4, 120), width: Math.min(scaling.widthCm / 2, 40) }}
                  />
                  <div
                    className="rounded bg-emerald-500/30"
                    style={{ height: Math.min((scaling.heightCm * 0.85) / 4, 102), width: Math.min((scaling.widthCm * 0.85) / 2, 34) }}
                  />
                </div>
              </div>
            </Panel>

            {/* Interactive Asset Downloader */}
            <Panel title="Interactive Asset Downloader" icon={<Download size={15} />}>
              <div className="flex flex-wrap gap-2">
                {['3D Template Export', 'Audio Clip Export', 'Reference Sheet Export'].map((label) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => {
                      setToast(`Preparing export: ${label}`);
                      setTimeout(() => setToast(null), 2000);
                    }}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-200 hover:border-indigo-400 hover:bg-slate-700"
                  >
                    <Download size={14} />
                    {label}
                  </button>
                ))}
              </div>
            </Panel>
          </motion.div>
        )}

        {/* Toast */}
        {toast && (
          <div className="fixed bottom-6 right-6 z-50 rounded-lg bg-slate-800 px-4 py-2 text-sm text-slate-100 shadow-lg ring-1 ring-slate-600">
            {toast}
          </div>
        )}

        {/* ───────────────── Face Identity Lock Tab ───────────────── */}
        {activeTab === 'face_identity' && (
          <motion.div
            key="face_identity"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            {!selected ? (
              <Panel>
                <EmptyState
                  icon={<Scan size={28} />}
                  title="No character selected"
                  subtitle="Select a character from the Roster to configure face identity lock metrics."
                />
              </Panel>
            ) : (
              <>
                {/* CRITICAL: Fal API lock explanation */}
                <MotionPanel className="p-4 border-l-2 border-warning/60">
                  <div className="flex items-start gap-3">
                    <AlertTriangle size={18} className="text-warning shrink-0 mt-0.5" />
                    <div>
                      <h3 className="text-sm font-semibold text-warning mb-1">
                        Fal API Identity Lock — Strict Seed Enforcement
                      </h3>
                      <p className="text-xs text-ink-200 leading-relaxed">
                        {FAL_LOCK_EXPLANATION}
                      </p>
                    </div>
                  </div>
                </MotionPanel>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Face metrics (data-driven from FACE_METRICS_CONFIG) */}
                  <Panel
                    title={`Face Identity Lock Metrics — ${selected.name}`}
                    icon={<Scan size={15} />}
                    action={<Badge variant="accent">{FACE_METRICS_CONFIG.length} metrics</Badge>}
                  >
                    <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {FACE_METRICS_CONFIG.map((metric: FeatureInput) => (
                        <div
                          key={metric.id}
                          className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04]"
                        >
                          <p className="text-[10px] text-ink-400 mb-1">{metric.label}</p>
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              value={
                                (editing.face_metrics?.[metric.id] as number) ??
                                (metric.defaultValue as number) ??
                                ''
                              }
                              onChange={(e) =>
                                setMetric(metric.id, parseFloat(e.target.value) || 0)
                              }
                              className="w-full bg-transparent text-xs text-accent outline-none"
                              placeholder={metric.placeholder ?? '0'}
                            />
                            <span className="text-[10px] text-ink-500">
                              {metric.placeholder ?? ''}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Panel>

                  {/* Visual anchors + reference image */}
                  <Panel
                    title="Visual Anchors & Reference Image"
                    icon={<Lock size={15} />}
                  >
                    <div className="p-4 space-y-3">
                      <div>
                        <label className="text-xs font-medium text-ink-200 mb-1.5 block">
                          Visual Anchors (appended to every Fal prompt)
                        </label>
                        <textarea
                          value={editing.visual_anchors ?? ''}
                          onChange={(e) =>
                            setEditing({ ...editing, visual_anchors: e.target.value })
                          }
                          rows={4}
                          className="input-field resize-none text-xs font-mono"
                          placeholder="Strict visual anchors to prevent style drift..."
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-ink-200 mb-1.5 block">
                          Reference Image URL (strict seed source)
                        </label>
                        <input
                          value={editing.reference_image_url ?? ''}
                          onChange={(e) =>
                            setEditing({ ...editing, reference_image_url: e.target.value })
                          }
                          className="input-field"
                          placeholder="https://..."
                        />
                      </div>
                      <MotionButton
                        onClick={saveCharacter}
                        disabled={saving}
                        className="btn-primary w-full"
                      >
                        {saving ? <Spinner size={14} /> : <Save size={15} />}
                        Save Identity Lock
                      </MotionButton>
                    </div>
                  </Panel>
                </div>
              </>
            )}
          </motion.div>
        )}

        {/* ───────────────── Voice Profiles Tab ───────────────── */}
        {activeTab === 'voice_profiles' && (
          <motion.div
            key="voice_profiles"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            {/* Connection status banner */}
            <MotionPanel className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Volume2 size={16} className="text-accent" />
                  <div>
                    <p className="text-sm font-semibold text-ink-100">
                      ElevenLabs Voice-Clone Reference Map
                    </p>
                    <p className="text-[11px] text-ink-400">
                      Assign and test voice IDs for each character.
                    </p>
                  </div>
                </div>
                {hasElevenLabsKey ? (
                  <Badge variant="success">
                    <Check size={11} className="mr-1" /> Connected
                  </Badge>
                ) : (
                  <Badge variant="danger">No API Key</Badge>
                )}
              </div>
            </MotionPanel>

            {characters.length === 0 ? (
              <Panel>
                <EmptyState
                  icon={<Mic size={28} />}
                  title="No characters available"
                  subtitle="Register characters in the Roster before assigning voice profiles."
                />
              </Panel>
            ) : (
              <Panel title="Voice Profiles" icon={<Mic size={15} />} action={<Badge>{characters.length}</Badge>}>
                <div className="p-3 space-y-2">
                  {characters.map((char) => {
                    const isSelected = selectedId === char.id;
                    const isTestingThis = testingVoiceId !== null && selectedId === char.id;
                    return (
                      <div
                        key={char.id}
                        className={`p-3 rounded-xl border transition-all ${
                          isSelected
                            ? 'bg-accent-dim border-accent/30'
                            : 'bg-white/[0.02] border-white/[0.04]'
                        }`}
                      >
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-8 h-8 rounded-lg bg-ink-700 flex items-center justify-center shrink-0">
                            <User size={14} className="text-accent" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-ink-100 truncate">{char.name}</p>
                            <p className="text-[10px] text-ink-400 truncate">
                              {char.voice_id ? `Current: ${char.voice_id}` : 'No voice assigned'}
                            </p>
                          </div>
                          {char.voice_id && <Badge variant="success">Locked</Badge>}
                        </div>

                        <div className="flex items-center gap-2">
                          <input
                            value={
                              (isSelected ? editing.voice_id : char.voice_id) ?? ''
                            }
                            onChange={(e) => {
                              if (!isSelected) {
                                setSelectedId(char.id);
                                setEditing({ ...char, voice_id: e.target.value });
                              } else {
                                setEditing({ ...editing, voice_id: e.target.value });
                              }
                            }}
                            onFocus={() => {
                              if (!isSelected) {
                                setSelectedId(char.id);
                                setEditing(char);
                              }
                            }}
                            className="input-field font-mono text-xs"
                            placeholder="ElevenLabs voice ID, e.g. 21m00Tcm4TlvDq8ibWus"
                          />
                          <MotionButton
                            onClick={() => {
                              const vid = (isSelected ? editing.voice_id : char.voice_id) ?? '';
                              testVoice(vid);
                            }}
                            disabled={isTestingThis || !hasElevenLabsKey}
                            className="btn-ghost text-xs py-1.5 px-3 shrink-0"
                          >
                            {isTestingThis ? <Spinner size={12} /> : <Volume2 size={12} />}
                            Test Voice
                          </MotionButton>
                          <MotionButton
                            onClick={async () => {
                              if (!isSelected) {
                                setSelectedId(char.id);
                                setEditing({ ...char, voice_id: char.voice_id });
                              }
                              // Ensure the latest voice_id is committed before saving.
                              const pending = isSelected ? editing : { ...char, voice_id: char.voice_id };
                              try {
                                await updateMut.mutateAsync({
                                  id: char.id,
                                  updates: { voice_id: pending.voice_id },
                                });
                                addToast(`Voice ID saved for "${char.name}"`, 'success');
                                log('success', `Voice profile updated for "${char.name}"`);
                              } catch (err) {
                                const message = err instanceof Error ? err.message : 'Unknown error';
                                addToast(`Failed to save voice: ${message}`, 'error');
                                log('error', `Voice save failed for "${char.name}": ${message}`);
                              }
                            }}
                            disabled={updateMut.isPending}
                            className="btn-ghost text-xs py-1.5 px-3 shrink-0"
                          >
                            {updateMut.isPending && isSelected ? <Spinner size={12} /> : <Save size={12} />}
                            Save
                          </MotionButton>
                        </div>

                        {/* Phase 3: Voice Pitch & Speed Tuner */}
                        <div className="mt-3 space-y-2 rounded-lg border border-white/[0.04] bg-white/[0.02] p-3">
                          <div className="flex items-center gap-2 text-xs font-medium text-ink-300">
                            <Sliders size={12} />
                            Pitch & Speed Tuner
                          </div>
                          {(() => {
                            const tuning = voiceTuning[char.id] ?? { pitch: 1.0, speed: 1.0 };
                            return (
                              <>
                                <label className="block text-[10px] text-ink-400">
                                  Pitch: {tuning.pitch.toFixed(2)}
                                  <input
                                    type="range"
                                    min={0}
                                    max={2}
                                    step={0.05}
                                    value={tuning.pitch}
                                    onChange={(e) =>
                                      setVoiceTuning((prev) => ({
                                        ...prev,
                                        [char.id]: { ...tuning, pitch: Number(e.target.value) },
                                      }))
                                    }
                                    className="mt-1 w-full accent-indigo-500"
                                  />
                                </label>
                                <label className="block text-[10px] text-ink-400">
                                  Speed: {tuning.speed.toFixed(2)}
                                  <input
                                    type="range"
                                    min={0.5}
                                    max={2}
                                    step={0.05}
                                    value={tuning.speed}
                                    onChange={(e) =>
                                      setVoiceTuning((prev) => ({
                                        ...prev,
                                        [char.id]: { ...tuning, speed: Number(e.target.value) },
                                      }))
                                    }
                                    className="mt-1 w-full accent-indigo-500"
                                  />
                                </label>
                                <MotionButton
                                  onClick={() => {
                                    const vid = (isSelected ? editing.voice_id : char.voice_id) ?? '';
                                    testVoice(vid);
                                  }}
                                  disabled={isTestingThis || !hasElevenLabsKey}
                                  className="btn-ghost text-xs py-1.5 px-3"
                                >
                                  {isTestingThis ? <Spinner size={12} /> : <Volume2 size={12} />}
                                  Test Voice
                                </MotionButton>
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Panel>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ───────────────── Feature Toggles (bottom of detail panel) ───────────────── */}
      <MotionPanel className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Lock size={15} className="text-accent" />
          <h3 className="text-sm font-semibold text-ink-100">Character World Enhancement Modules</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {CHARACTER_FEATURES.map((toggle: FeatureToggle) => (
            <FeatureToggleRow
              key={toggle.id}
              toggle={toggle}
              enabled={!!featureState[toggle.id]}
              onToggle={() =>
                setFeatureState((prev) => ({ ...prev, [toggle.id]: !prev[toggle.id] }))
              }
            />
          ))}
          {CHARACTER_P3_FEATURES.map((toggle: FeatureToggle) => (
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

      {/* Delete confirmation affordance (compact inline notice) */}
      {selected && !showForm && activeTab === 'roster' && (
        <div className="flex items-center justify-end gap-2 text-[11px] text-ink-400">
          <Trash2 size={11} />
          Use the Delete action in the detail panel to remove "{selected.name}" from the roster.
        </div>
      )}
    </div>
  );
 }
