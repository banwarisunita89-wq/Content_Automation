import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useThemeStore, useToastStore } from '../../lib/stores';
import { useSettingsQuery, useSaveSettingMutation, useAddLogMutation } from '../../lib/queries';
import { ACCENT_PRESETS, RADIUS_PRESETS } from '../../lib/constants';
import { MotionButton, SubTabs } from '../ui/Animated';
import { Panel, Badge, Spinner, Toggle } from '../ui/Primitives';
import { DynamicController, type ControlValues } from '../ui/DynamicController';
import {
  Shield, Save, Check, Palette, SlidersHorizontal, RotateCcw,
  Clock, MessageSquare, Film, Languages, Sparkles,
} from 'lucide-react';

const SETTINGS_TABS = [
  { id: 'schema_matrix', label: 'Schema Matrix' },
  { id: 'deep_customization', label: 'Deep Customization' },
  { id: 'defaults', label: 'Defaults' },
];

const DEFAULT_AUTOMATION = {
  publish_time: '07:00',
  auto_timing: true,
  comment_automation: true,
};

const DEFAULT_RENDER = {
  resolution: '4K',
  fps: '60',
  motion_speed: 1.4,
};

const DEFAULT_SCRIPT = {
  language: 'English',
  target_duration: 60,
};

export function SettingsModule() {
  const themeAccent = useThemeStore((s) => s.accent);
  const themeRadius = useThemeStore((s) => s.radius);
  const themeFontSize = useThemeStore((s) => s.fontSize);
  const themeBgGradient = useThemeStore((s) => s.bgGradient);
  const setAccent = useThemeStore((s) => s.setAccent);
  const setRadius = useThemeStore((s) => s.setRadius);
  const setFontSize = useThemeStore((s) => s.setFontSize);
  const setBgGradient = useThemeStore((s) => s.setBgGradient);
  const applyPreset = useThemeStore((s) => s.applyPreset);

  const addToast = useToastStore((s) => s.addToast);

  const { data: settings, isLoading: settingsLoading } = useSettingsQuery();
  const saveSetting = useSaveSettingMutation();
  const addLog = useAddLogMutation();

  const [activeTab, setActiveTab] = useState<string>('schema_matrix');
  const [schemaValues, setSchemaValues] = useState<ControlValues>({});
  const [customValues, setCustomValues] = useState<Record<string, string | number>>({});
  const [defaults, setDefaults] = useState({
    ...DEFAULT_AUTOMATION,
    ...DEFAULT_RENDER,
    ...DEFAULT_SCRIPT,
  });
  const [defaultsSaving, setDefaultsSaving] = useState(false);
  const [defaultsSaved, setDefaultsSaved] = useState(false);

  useEffect(() => {
    if (settingsLoading || !settings) return;

    const schemaSetting = settings.find((s) => s.key === 'schema_matrix')?.value as Record<string, unknown> | undefined;
    if (schemaSetting) {
      const vals: ControlValues = {};
      for (const [k, v] of Object.entries(schemaSetting)) {
        vals[k] = v as boolean | string | number;
      }
      setSchemaValues(vals);
    }

    const customSetting = settings.find((s) => s.key === 'customization')?.value as Record<string, unknown> | undefined;
    if (customSetting) {
      const vals: Record<string, string | number> = {};
      for (const [k, v] of Object.entries(customSetting)) {
        if (v !== undefined && v !== null) vals[k] = typeof v === 'number' ? v : String(v);
      }
      setCustomValues(vals);
    }

    const defaultsSetting = settings.find((s) => s.key === 'defaults')?.value as Record<string, unknown> | undefined;
    if (defaultsSetting) {
      setDefaults((prev) => ({
        ...prev,
        publish_time: typeof defaultsSetting.publish_time === 'string' ? defaultsSetting.publish_time : prev.publish_time,
        auto_timing: typeof defaultsSetting.auto_timing === 'boolean' ? defaultsSetting.auto_timing : prev.auto_timing,
        comment_automation: typeof defaultsSetting.comment_automation === 'boolean' ? defaultsSetting.comment_automation : prev.comment_automation,
        resolution: typeof defaultsSetting.resolution === 'string' ? defaultsSetting.resolution : prev.resolution,
        fps: typeof defaultsSetting.fps === 'string' ? defaultsSetting.fps : prev.fps,
        motion_speed: typeof defaultsSetting.motion_speed === 'number' ? defaultsSetting.motion_speed : prev.motion_speed,
        language: typeof defaultsSetting.language === 'string' ? defaultsSetting.language : prev.language,
        target_duration: typeof defaultsSetting.target_duration === 'number' ? defaultsSetting.target_duration : prev.target_duration,
      }));
    }
  }, [settings, settingsLoading]);

  const themeSetters = useMemo<Record<string, (v: string | number) => void>>(
    () => ({
      accent_color: (v) => setAccent(String(v)),
      bg_gradient_color: (v) => setBgGradient(String(v)),
      border_radius: (v) => setRadius(Number(v)),
      font_size: (v) => setFontSize(Number(v)),
    }),
    [setAccent, setBgGradient, setRadius, setFontSize]
  );

  const isThemeInput = (id: string) => id in themeSetters;

  function handleSchemaChange(id: string, value: boolean | string | number) {
    setSchemaValues((prev) => {
      const next = { ...prev, [id]: value };
      saveSetting.mutate(
        { key: 'schema_matrix', value: next as Record<string, unknown> },
        { onError: () => addToast(`Failed to save ${id}`, 'error') }
      );
      return next;
    });
  }

  function handleCustomChange(id: string, value: string | number) {
    setCustomValues((prev) => ({ ...prev, [id]: value }));
    if (isThemeInput(id)) themeSetters[id](value);
  }

  function handleCustomBlur(id: string) {
    if (isThemeInput(id)) {
      const value = customValues[id];
      if (value === undefined) return;
      saveSetting.mutate(
        { key: 'customization', value: { ...customValues, [id]: value } as Record<string, unknown> },
        { onError: () => addToast(`Failed to sync ${id}`, 'error') }
      );
    }
  }

  function applyAccentPreset(name: string, color: string) {
    applyPreset(name, color);
    setCustomValues((prev) => ({ ...prev, accent_color: color }));
    saveSetting.mutate(
      { key: 'customization', value: { ...customValues, accent_color: color } as Record<string, unknown> },
      { onError: () => addToast('Failed to save accent preset', 'error') }
    );
    addToast(`Accent preset "${name}" applied`, 'success');
  }

  function applyRadiusPreset(value: number) {
    setRadius(value);
    setCustomValues((prev) => ({ ...prev, border_radius: value }));
    saveSetting.mutate(
      { key: 'customization', value: { ...customValues, border_radius: value } as Record<string, unknown> },
      { onError: () => addToast('Failed to save radius preset', 'error') }
    );
  }

  function updateDefault<K extends keyof typeof defaults>(key: K, value: (typeof defaults)[K]) {
    setDefaults((prev) => ({ ...prev, [key]: value }));
  }

  async function saveDefaults() {
    setDefaultsSaving(true);
    try {
      await saveSetting.mutateAsync({ key: 'defaults', value: { ...defaults } as Record<string, unknown> });
      await addLog.mutateAsync({
        level: 'success',
        source: 'settings-defaults',
        message: 'Default automation, render & script settings saved',
        details: { ...defaults },
        retryable: false,
        resolved: false,
      });
      addToast('Defaults saved to cloud', 'success');
      setDefaultsSaved(true);
      setTimeout(() => setDefaultsSaved(false), 2000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      addToast(`Failed to save defaults: ${msg}`, 'error');
    } finally {
      setDefaultsSaving(false);
    }
  }

  function resetDefaults() {
    setDefaults({ ...DEFAULT_AUTOMATION, ...DEFAULT_RENDER, ...DEFAULT_SCRIPT });
    addToast('Defaults reset — click Save to persist', 'info');
  }

  const CUSTOM_INPUTS = [
    { id: 'accent_color', label: 'Accent Color', type: 'color' as const, defaultValue: '#00d4ff' },
    { id: 'bg_gradient_color', label: 'Background Gradient Color', type: 'color' as const, defaultValue: '#0a0c14' },
    { id: 'border_radius', label: 'Border Radius (px)', type: 'number' as const, defaultValue: 12 },
    { id: 'font_size', label: 'Base Font Size (px)', type: 'number' as const, defaultValue: 14 },
    { id: 'panel_opacity', label: 'Panel Opacity (%)', type: 'number' as const, defaultValue: 60 },
    { id: 'gemini_temp', label: 'Gemini Temperature', type: 'number' as const, defaultValue: 0.8 },
    { id: 'gemini_top_p', label: 'Gemini Top-P', type: 'number' as const, defaultValue: 0.9 },
    { id: 'elevenlabs_stability', label: 'ElevenLabs Stability', type: 'number' as const, defaultValue: 0.3 },
    { id: 'elevenlabs_similarity', label: 'ElevenLabs Similarity', type: 'number' as const, defaultValue: 0.85 },
    { id: 'motion_speed', label: 'Default Motion Speed', type: 'number' as const, defaultValue: 1.4 },
  ];

  return (
    <div className="space-y-4">
      <div className="glass-panel p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gradient mb-1">Settings & Vault</h2>
          <p className="text-sm text-ink-300">All credentials are managed server-side. No client-side keys.</p>
        </div>
        <Badge variant="success">
          <Shield size={12} className="mr-1" /> Secured
        </Badge>
      </div>

      <SubTabs tabs={SETTINGS_TABS} activeTab={activeTab} onTabChange={setActiveTab} />

      <AnimatePresence mode="wait">
        {activeTab === 'schema_matrix' && (
          <motion.div
            key="schema_matrix"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
          >
            {settingsLoading ? (
              <div className="flex justify-center py-12"><Spinner size={24} /></div>
            ) : (
              <DynamicController
                values={schemaValues}
                onChange={handleSchemaChange}
              />
            )}
          </motion.div>
        )}

        {activeTab === 'deep_customization' && (
          <motion.div
            key="deep_customization"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="space-y-4"
          >
            <Panel title="Live Preview" icon={<Palette size={15} />}>
              <div className="p-5 flex flex-col sm:flex-row items-center gap-6">
                <div className="flex flex-col items-center gap-2">
                  <span className="text-[10px] text-ink-400 uppercase tracking-wide">Accent</span>
                  <div className="w-16 h-16 rounded-2xl transition-all duration-300" style={{ background: themeAccent, boxShadow: `0 0 24px ${themeAccent}55`, borderRadius: `${themeRadius}px` }} />
                  <span className="text-[10px] font-mono text-ink-300">{themeAccent}</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <span className="text-[10px] text-ink-400 uppercase tracking-wide">Radius</span>
                  <div className="w-16 h-16 border-2 border-white/10 transition-all duration-300" style={{ borderRadius: `${themeRadius}px` }} />
                  <span className="text-[10px] font-mono text-ink-300">{themeRadius}px</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <span className="text-[10px] text-ink-400 uppercase tracking-wide">Font</span>
                  <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/[0.06]" style={{ fontSize: `${themeFontSize}px` }}>Aa</div>
                  <span className="text-[10px] font-mono text-ink-300">{themeFontSize}px</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <span className="text-[10px] text-ink-400 uppercase tracking-wide">Gradient</span>
                  <div className="w-16 h-16 rounded-2xl border border-white/10 transition-all duration-300" style={{ background: themeBgGradient, borderRadius: `${themeRadius}px` }} />
                  <span className="text-[10px] font-mono text-ink-300 truncate max-w-[80px]">{themeBgGradient}</span>
                </div>
              </div>
            </Panel>

            <Panel title="Accent Presets" icon={<Sparkles size={15} />}>
              <div className="p-4 flex flex-wrap gap-2.5">
                {ACCENT_PRESETS.map((preset) => (
                  <MotionButton
                    key={preset.name}
                    onClick={() => applyAccentPreset(preset.name, preset.color)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all ${
                      themeAccent === preset.color ? 'border-accent bg-accent-dim' : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]'
                    }`}
                  >
                    <span className="w-4 h-4 rounded-full" style={{ background: preset.color }} />
                    <span className="text-xs font-medium text-ink-100">{preset.name}</span>
                  </MotionButton>
                ))}
              </div>
            </Panel>

            <Panel title="Radius Presets" icon={<SlidersHorizontal size={15} />}>
              <div className="p-4 flex flex-wrap gap-2.5">
                {RADIUS_PRESETS.map((preset) => (
                  <MotionButton
                    key={preset.name}
                    onClick={() => applyRadiusPreset(preset.value)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all ${
                      themeRadius === preset.value ? 'border-accent bg-accent-dim' : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]'
                    }`}
                  >
                    <span className="w-4 h-4 border-2 border-ink-200" style={{ borderRadius: `${preset.value}px` }} />
                    <span className="text-xs font-medium text-ink-100">{preset.name}</span>
                    <span className="text-[10px] text-ink-400 font-mono">{preset.value}px</span>
                  </MotionButton>
                ))}
              </div>
            </Panel>

            <Panel title="Customization Inputs" icon={<SlidersHorizontal size={15} />}>
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                {CUSTOM_INPUTS.map((input) => {
                  const value = customValues[input.id] ?? input.defaultValue ?? '';
                  const themeBased = isThemeInput(input.id);
                  return (
                    <div key={input.id} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-medium text-ink-200">{input.label}</label>
                        {themeBased && <Badge variant="accent">Theme</Badge>}
                      </div>
                      {input.type === 'color' && (
                        <div className="flex items-center gap-2">
                          <input type="color" value={String(value)} onChange={(e) => handleCustomChange(input.id, e.target.value)} onBlur={() => handleCustomBlur(input.id)} className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border border-white/[0.08]" />
                          <input type="text" value={String(value)} onChange={(e) => handleCustomChange(input.id, e.target.value)} onBlur={() => handleCustomBlur(input.id)} className="input-field flex-1 font-mono text-sm" />
                        </div>
                      )}
                      {input.type === 'number' && (
                        <input type="number" value={Number(value)} step={input.id === 'border_radius' || input.id === 'font_size' || input.id === 'panel_opacity' ? 1 : 0.05} onChange={(e) => handleCustomChange(input.id, parseFloat(e.target.value))} onBlur={() => handleCustomBlur(input.id)} className="input-field text-sm" />
                      )}
                    </div>
                  );
                })}
              </div>
            </Panel>
          </motion.div>
        )}

        {activeTab === 'defaults' && (
          <motion.div
            key="defaults"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="space-y-4"
          >
            <Panel title="Default Automation" icon={<Clock size={15} />}>
              <div className="p-4 space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-ink-200">Default Publish Time</label>
                  <input type="time" value={defaults.publish_time} onChange={(e) => updateDefault('publish_time', e.target.value)} className="input-field text-sm" />
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                  <div className="flex items-center gap-2.5">
                    <Clock size={14} className="text-ink-400" />
                    <div>
                      <p className="text-xs font-medium text-ink-100">Smart Auto-Timing</p>
                      <p className="text-[10px] text-ink-400">Shift hours if view thresholds drop</p>
                    </div>
                  </div>
                  <Toggle checked={defaults.auto_timing} onChange={(v) => updateDefault('auto_timing', v)} />
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                  <div className="flex items-center gap-2.5">
                    <MessageSquare size={14} className="text-ink-400" />
                    <div>
                      <p className="text-xs font-medium text-ink-100">Comment Automation</p>
                      <p className="text-[10px] text-ink-400">Post pinned comment when video goes live</p>
                    </div>
                  </div>
                  <Toggle checked={defaults.comment_automation} onChange={(v) => updateDefault('comment_automation', v)} />
                </div>
              </div>
            </Panel>

            <Panel title="Default Render Settings" icon={<Film size={15} />}>
              <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-ink-200">Resolution</label>
                  <select value={defaults.resolution} onChange={(e) => updateDefault('resolution', e.target.value)} className="input-field text-sm">
                    <option value="1080p">1080p</option>
                    <option value="1440p">1440p</option>
                    <option value="4K">4K</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-ink-200">Frame Rate (FPS)</label>
                  <select value={defaults.fps} onChange={(e) => updateDefault('fps', e.target.value)} className="input-field text-sm">
                    <option value="30">30</option>
                    <option value="60">60</option>
                    <option value="120">120</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-ink-200">Motion Speed</label>
                  <input type="number" step={0.1} value={defaults.motion_speed} onChange={(e) => updateDefault('motion_speed', parseFloat(e.target.value) || 1.4)} className="input-field text-sm" />
                </div>
              </div>
            </Panel>

            <Panel title="Default Script Settings" icon={<Languages size={15} />}>
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-ink-200">Language</label>
                  <select value={defaults.language} onChange={(e) => updateDefault('language', e.target.value)} className="input-field text-sm">
                    <option value="English">English</option>
                    <option value="Hindi">Hindi</option>
                    <option value="Hinglish">Hinglish</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-ink-200">Target Duration (seconds)</label>
                  <input type="number" value={defaults.target_duration} onChange={(e) => updateDefault('target_duration', parseInt(e.target.value, 10) || 60)} className="input-field text-sm" />
                </div>
              </div>
            </Panel>

            <div className="flex justify-between items-center">
              <MotionButton onClick={resetDefaults} className="btn-ghost flex items-center gap-2">
                <RotateCcw size={15} />
                Reset to Defaults
              </MotionButton>
              <MotionButton onClick={saveDefaults} disabled={defaultsSaving} className="btn-primary flex items-center gap-2">
                {defaultsSaving ? <Spinner size={15} /> : defaultsSaved ? <Check size={15} /> : <Save size={15} />}
                {defaultsSaving ? 'Saving...' : defaultsSaved ? 'Saved' : 'Save Defaults'}
              </MotionButton>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
