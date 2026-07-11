import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSettingsQuery, useSaveSettingMutation } from '../lib/queries';
import { useThemeStore } from '../lib/stores';
import { ACCENT_PRESETS, RADIUS_PRESETS } from '../lib/constants';
import { StatusDot } from './ui/Primitives';
import { Instagram, Youtube, Facebook, Palette, X, Check, Settings2, ExternalLink } from 'lucide-react';

type SocialKey = 'instagram' | 'youtube' | 'facebook';

const SOCIAL_META: Record<SocialKey, { icon: typeof Instagram; label: string; handle: string; url: string }> = {
  instagram: { icon: Instagram, label: 'Instagram', handle: '@cartoonwallahai', url: 'https://www.instagram.com/cartoonwallahai?igsh=MThnMWx6cHN6Nzhreg==' },
  youtube: { icon: Youtube, label: 'YouTube', handle: 'Edit with Me', url: 'https://youtube.com/@editwithme0910?si=wAqsVulIWYURDoKH' },
  facebook: { icon: Facebook, label: 'AI Cartoon', handle: 'Facebook Page', url: 'https://www.facebook.com/share/1CBFPsPcHG/' },
};

export function TopActionPanel() {
  const { data: settings } = useSettingsQuery();
  const saveSetting = useSaveSettingMutation();
  const theme = useThemeStore();
  const [showCustomizer, setShowCustomizer] = useState(false);

  const social = (settings?.find((s) => s.key === 'social')?.value ?? {
    instagram: { handle: '@cartoonwallahai', status: 'disconnected' },
    youtube: { handle: 'Edit with Me', status: 'disconnected' },
    facebook: { handle: '', status: 'disconnected' },
  }) as Record<SocialKey, { handle: string; status: string }>;

  async function toggleSocial(key: SocialKey) {
    const current = social[key];
    const nextStatus = current.status === 'connected' ? 'disconnected' : 'connected';
    const updated = { ...social, [key]: { ...current, status: nextStatus } };
    saveSetting.mutate({ key: 'social', value: updated as unknown as Record<string, unknown> });
  }

  return (
    <>
      <div className="flex items-center gap-2 sm:gap-3">
        {(Object.keys(SOCIAL_META) as SocialKey[]).map((key) => {
          const meta = SOCIAL_META[key];
          const Icon = meta.icon;
          const data = social[key];
          const connected = data.status === 'connected';
          return (
            <div key={key} className="flex items-center">
              <motion.a
                href={meta.url}
                target="_blank"
                rel="noopener noreferrer"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="group flex items-center gap-2 px-2.5 sm:px-3 py-2 rounded-xl border border-white/[0.06] bg-ink-850/60 backdrop-blur-xl hover:border-white/[0.12] transition-all duration-200"
                title={`${meta.label}: ${meta.handle}`}
              >
                <Icon size={15} className={connected ? 'text-accent' : 'text-ink-400'} />
                <div className="hidden md:flex flex-col items-start">
                  <span className="text-[10px] font-medium text-ink-300 leading-tight">{meta.label}</span>
                  <span className="text-[10px] text-ink-400 leading-tight">{data.handle || meta.handle}</span>
                </div>
                <ExternalLink size={10} className="hidden md:block text-ink-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              </motion.a>
              <button
                onClick={(e) => { e.stopPropagation(); toggleSocial(key); }}
                className="ml-1 p-1 rounded-lg hover:bg-white/[0.06] transition-colors"
                title={connected ? `Disconnect ${meta.label}` : `Connect ${meta.label}`}
              >
                <StatusDot status={connected ? 'online' : 'idle'} />
              </button>
            </div>
          );
        })}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowCustomizer(true)}
          className="flex items-center gap-2 px-2.5 sm:px-3 py-2 rounded-xl border border-white/[0.06] bg-ink-850/60 backdrop-blur-xl hover:border-accent/30 transition-all duration-200"
          title="Theme Personalization"
        >
          <Palette size={15} className="text-accent" />
          <span className="hidden md:inline text-[10px] font-medium text-ink-200">Theme</span>
        </motion.button>
      </div>

      <AnimatePresence>
        {showCustomizer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowCustomizer(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="glass-panel w-full max-w-md p-6 max-h-screen overflow-y-auto custom-scrollbar"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2.5">
                  <Settings2 size={18} className="text-accent" />
                  <h2 className="text-base font-semibold text-ink-50">Theme Personalization</h2>
                </div>
                <button onClick={() => setShowCustomizer(false)} className="text-ink-400 hover:text-ink-100 transition-colors">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="text-xs font-medium text-ink-200 mb-2.5 block">Ambient Accent Color</label>
                  <div className="grid grid-cols-6 gap-2">
                    {ACCENT_PRESETS.map((preset) => (
                      <motion.button
                        key={preset.name}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => theme.applyPreset(preset.name, preset.color)}
                        className={`relative h-10 rounded-xl transition-all ${theme.accent === preset.color ? 'ring-2 ring-offset-2 ring-offset-ink-850' : ''}`}
                        style={{ background: preset.color, boxShadow: theme.accent === preset.color ? `0 0 16px ${preset.color}80` : 'none' }}
                        title={preset.name}
                      >
                        {theme.accent === preset.color && <Check size={14} className="absolute inset-0 m-auto text-black" />}
                      </motion.button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 mt-2.5">
                    <input
                      type="color"
                      value={theme.accent}
                      onChange={(e) => theme.setAccent(e.target.value)}
                      className="w-9 h-9 rounded-lg bg-transparent border border-white/[0.06] cursor-pointer"
                    />
                    <span className="text-xs text-ink-400 font-mono">{theme.accent}</span>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-ink-200 mb-2.5 block">Border Radius</label>
                  <div className="grid grid-cols-3 gap-2">
                    {RADIUS_PRESETS.map((preset) => (
                      <motion.button
                        key={preset.name}
                        whileTap={{ scale: 0.96 }}
                        onClick={() => theme.setRadius(preset.value)}
                        className={`py-2.5 text-xs font-medium rounded-xl transition-all ${
                          theme.radius === preset.value
                            ? 'bg-accent-dim text-accent border border-accent/30'
                            : 'bg-white/[0.04] text-ink-300 border border-white/[0.06] hover:text-ink-100'
                        }`}
                        style={{ borderRadius: preset.value }}
                      >
                        {preset.name}
                      </motion.button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-ink-200 mb-2.5 block">Base Font Size ({theme.fontSize}px)</label>
                  <input
                    type="range"
                    min={12}
                    max={18}
                    value={theme.fontSize}
                    onChange={(e) => theme.setFontSize(Number(e.target.value))}
                    className="w-full accent-[var(--accent)]"
                  />
                </div>

                <div className="pt-2 border-t border-white/[0.04]">
                  <p className="text-[10px] text-ink-400 font-mono">Changes persist automatically to Supabase + localStorage.</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
