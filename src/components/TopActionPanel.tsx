import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSettingsQuery, useSaveSettingMutation } from '../lib/queries';
import { useThemeStore } from '../lib/stores';
import { ACCENT_PRESETS, RADIUS_PRESETS } from '../lib/constants';
import { StatusDot } from './ui/Primitives';
import { useDebouncedCallback } from '../lib/hooks/useDebounce';
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
  const dropdownRef = useRef<HTMLDivElement>(null);

  const social = (settings?.find((s) => s.key === 'social')?.value ?? {
    instagram: { handle: '@cartoonwallahai', status: 'disconnected' },
    youtube: { handle: 'Edit with Me', status: 'disconnected' },
    facebook: { handle: '', status: 'disconnected' },
  }) as Record<SocialKey, { handle: string; status: string }>;

  const toggleSocial = useDebouncedCallback((key: SocialKey) => {
    const current = social[key];
    const nextStatus = current.status === 'connected' ? 'disconnected' : 'connected';
    const updated = { ...social, [key]: { ...current, status: nextStatus } };
    saveSetting.mutate({ key: 'social', value: updated as unknown as Record<string, unknown> });
  }, 1000);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowCustomizer(false);
      }
    }
    if (showCustomizer) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showCustomizer]);

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
              <a
                href={meta.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-2 px-2.5 sm:px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
                title={`${meta.label}: ${meta.handle}`}
              >
                <Icon size={14} className={connected ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-400'} />
                <div className="hidden md:flex flex-col items-start">
                  <span className="text-[10px] font-medium text-zinc-600 dark:text-zinc-400 leading-tight">{meta.label}</span>
                  <span className="text-[10px] text-zinc-400 dark:text-zinc-500 leading-tight">{data.handle || meta.handle}</span>
                </div>
                <ExternalLink size={10} className="hidden md:block text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </a>
              <button
                onClick={(e) => { e.stopPropagation(); toggleSocial(key); }}
                className="ml-1 p-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                title={connected ? `Disconnect ${meta.label}` : `Connect ${meta.label}`}
              >
                <StatusDot status={connected ? 'online' : 'idle'} />
              </button>
            </div>
          );
        })}

        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowCustomizer(!showCustomizer)}
            className="flex items-center gap-2 px-2.5 sm:px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
            title="Theme Personalization"
          >
            <Palette size={14} className="text-zinc-600 dark:text-zinc-400" />
            <span className="hidden md:inline text-[10px] font-medium text-zinc-600 dark:text-zinc-400">Theme</span>
          </button>

          <AnimatePresence>
            {showCustomizer && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -8 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-full mt-2 origin-top-right z-[100] max-w-[90vw] w-80 p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-xl overflow-y-auto max-h-[80vh]"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Settings2 size={15} className="text-zinc-600 dark:text-zinc-400" />
                    <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Theme</h2>
                  </div>
                  <button onClick={() => setShowCustomizer(false)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">
                    <X size={16} />
                  </button>
                </div>

                <div className="space-y-5">
                  <div>
                    <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2 block">Accent</label>
                    <div className="grid grid-cols-6 gap-1.5">
                      {ACCENT_PRESETS.map((preset) => (
                        <button
                          key={preset.name}
                          onClick={() => theme.applyPreset(preset.name, preset.color)}
                          className={`relative h-8 rounded-lg transition-all ${theme.accent === preset.color ? 'ring-2 ring-offset-2 ring-offset-white dark:ring-offset-zinc-950' : ''}`}
                          style={{ background: preset.color }}
                          title={preset.name}
                        >
                          {theme.accent === preset.color && <Check size={12} className="absolute inset-0 m-auto text-white" />}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <input
                        type="color"
                        value={theme.accent}
                        onChange={(e) => theme.setAccent(e.target.value)}
                        className="w-8 h-8 rounded-lg bg-transparent border border-zinc-200 dark:border-zinc-800 cursor-pointer"
                      />
                      <span className="text-xs text-zinc-400 font-mono">{theme.accent}</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2 block">Radius</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {RADIUS_PRESETS.map((preset) => (
                        <button
                          key={preset.name}
                          onClick={() => theme.setRadius(preset.value)}
                          className={`py-2 text-xs font-medium rounded-lg transition-all ${
                            theme.radius === preset.value
                              ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                              : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800'
                          }`}
                          style={{ borderRadius: preset.value }}
                        >
                          {preset.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2 block">Font Size ({theme.fontSize}px)</label>
                    <input
                      type="range"
                      min={12}
                      max={18}
                      value={theme.fontSize}
                      onChange={(e) => theme.setFontSize(Number(e.target.value))}
                      className="w-full accent-zinc-900 dark:accent-zinc-100"
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </>
  );
}
