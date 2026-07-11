// ─── Dynamic Feature Configuration ───
// All module sub-tabs, feature toggles, and settings are defined here as data,
// then mapped over in the UI to generate elements dynamically.

export type SubTab = { id: string; label: string };
export type FeatureToggle = { id: string; label: string; description: string; defaultEnabled: boolean };
export type FeatureInput = { id: string; label: string; type: 'text' | 'number' | 'select' | 'color' | 'textarea'; placeholder?: string; options?: string[]; defaultValue?: string | number };

// ─── Script Lab ───
export const SCRIPT_LAB_TABS: SubTab[] = [
  { id: 'generator', label: 'Generator' },
  { id: 'drafts', label: 'Drafts' },
  { id: 'analysis', label: 'Analysis' },
];

export const SCRIPT_LAB_FEATURES: FeatureToggle[] = [
  { id: 'viral_hook_engine', label: 'Viral Hook Engineering', description: 'Multi-layer visual/auditory hooks in first 3 seconds', defaultEnabled: true },
  { id: 'storyline_sequencer', label: 'Continuous Storyline Sequencer', description: 'Inject previous episode transcripts for continuity', defaultEnabled: true },
  { id: 'seo_optimizer', label: 'SEO Optimizer System', description: 'Mine high-ranking search parameters into dialogue', defaultEnabled: true },
  { id: 'cta_formulator', label: 'High-Conversion CTA Formulator', description: 'Templates for shares, saves, subscriptions', defaultEnabled: true },
  { id: 'storyboard_descriptor', label: 'Visual Storyboard Descriptor', description: 'Deep spatial descriptions for each shot', defaultEnabled: true },
  { id: 'expression_mapping', label: 'Character Expression Mapping', description: 'Emotional changes line-by-line', defaultEnabled: true },
  { id: 'lighting_protocol', label: 'Lighting & Atmosphere Protocol', description: 'Volumetric studio lighting directives', defaultEnabled: true },
  { id: 'virality_predictor', label: 'Virality Score Predictor', description: 'Retention, CTR, shareability, resonance', defaultEnabled: true },
  { id: 'auto_seo_keywords', label: 'Auto SEO Keyword Mining', description: 'Real-time keyword extraction from Gemini', defaultEnabled: true },
  { id: 'dialogue_pacing', label: 'Dialogue Pacing Analyzer', description: 'Words-per-minute optimization', defaultEnabled: false },
  { id: 'emotion_arc', label: 'Emotion Arc Visualizer', description: 'Map emotional journey across scenes', defaultEnabled: false },
  { id: 'a_b_test_hooks', label: 'A/B Hook Testing', description: 'Generate 3 hook variants for testing', defaultEnabled: true },
  { id: 'auto_scene_count', label: 'Auto Scene Count Optimizer', description: 'Optimal scene count for 60s format', defaultEnabled: true },
  { id: 'trending_hashtags', label: 'Trending Hashtag Injector', description: 'Pull current trending hashtags', defaultEnabled: true },
  { id: 'script_continuity_check', label: 'Script Continuity Checker', description: 'Cross-reference with lore vault', defaultEnabled: true },
];

export const SCRIPT_LAB_INPUTS: FeatureInput[] = [
  { id: 'series_select', label: 'Select Series', type: 'select', options: [], placeholder: 'Choose series...' },
  { id: 'episode_number', label: 'Episode No.', type: 'number', defaultValue: 1 },
  { id: 'language', label: 'Language', type: 'select', options: ['English', 'Hindi', 'Hinglish'], defaultValue: 'English' },
  { id: 'tone_override', label: 'Tone Override', type: 'text', placeholder: 'e.g. Dark, suspenseful...' },
  { id: 'target_duration', label: 'Target Duration (seconds)', type: 'number', defaultValue: 60 },
  { id: 'custom_prompt', label: 'Custom Prompt Addition', type: 'textarea', placeholder: 'Add specific instructions...' },
];

// ─── Production Studio ───
export const STUDIO_TABS: SubTab[] = [
  { id: 'preview', label: 'Video Preview' },
  { id: 'metadata', label: 'Metadata' },
  { id: 'pipeline', label: 'Pipeline' },
  { id: 'render_settings', label: 'Render Settings' },
];

export const STUDIO_FEATURES: FeatureToggle[] = [
  { id: 'fal_injector', label: 'Fal Prompt Injector', description: 'Disney Pixar 3D, octane render, DoF, bokeh', defaultEnabled: true },
  { id: 'elevenlabs_sync', label: 'ElevenLabs Audio Sync', description: 'Low-stability, high-similarity voice delivery', defaultEnabled: true },
  { id: 'hf_sfx', label: 'HuggingFace SFX Layering', description: 'Atmospheric sounds and impact effects', defaultEnabled: true },
  { id: 'timeline_merger', label: 'Linear Timeline Merger', description: 'Sync video, audio, and lip-sync', defaultEnabled: true },
  { id: 'motion_pacing', label: 'Dynamic Motion Pacing (1.4x)', description: 'Auto reformat to 1.4x with pitch adjustment', defaultEnabled: true },
  { id: 'upscaler_4k', label: 'High-Fidelity 4K Upscaler', description: '4K resolution at 60 FPS', defaultEnabled: true },
  { id: 'chunk_manager', label: 'Asset Chunk Manager (20s)', description: 'Slice into 20-second blocks', defaultEnabled: true },
  { id: 'storage_push', label: 'Auto Supabase Storage Push', description: 'Push completed chunks to storage', defaultEnabled: true },
  { id: 'hdr_mode', label: 'Ultra HD HDR Mode', description: 'Premium HDR color grading', defaultEnabled: true },
  { id: 'premium_color_grading', label: 'Premium Color Grading', description: 'Cinematic color science', defaultEnabled: true },
  { id: 'heavy_bokeh', label: 'Heavy Bokeh Accents', description: 'Strict cinematic DoF with heavy bokeh', defaultEnabled: true },
  { id: 'lip_sync', label: 'Synthetic Lip-Sync', description: 'Auto-align mouth movement to audio', defaultEnabled: true },
  { id: 'auto_denoise', label: 'AI Denoiser', description: 'Noise reduction pass on final output', defaultEnabled: false },
  { id: 'frame_interpolation', label: 'Frame Interpolation', description: 'Smooth 60fps from 30fps source', defaultEnabled: true },
  { id: 'audio_normalize', label: 'Audio Normalization', description: 'Broadcast-safe loudness levels', defaultEnabled: true },
];

export const STUDIO_RENDER_INPUTS: FeatureInput[] = [
  { id: 'resolution', label: 'Resolution', type: 'select', options: ['1080p', '1440p', '4K'], defaultValue: '4K' },
  { id: 'fps', label: 'Frame Rate', type: 'select', options: ['30', '60', '120'], defaultValue: '60' },
  { id: 'motion_speed', label: 'Motion Speed', type: 'number', defaultValue: 1.4 },
  { id: 'bitrate', label: 'Bitrate (Mbps)', type: 'number', defaultValue: 45 },
  { id: 'color_space', label: 'Color Space', type: 'select', options: ['Rec.709', 'Rec.2020 HDR', 'DCI-P3'], defaultValue: 'Rec.2020 HDR' },
  { id: 'chunk_duration', label: 'Chunk Duration (seconds)', type: 'number', defaultValue: 20 },
];

// ─── Character World ───
export const CHARACTER_TABS: SubTab[] = [
  { id: 'roster', label: 'Roster' },
  { id: 'face_identity', label: 'Face Identity Lock' },
  { id: 'voice_profiles', label: 'Voice Profiles' },
];

export const CHARACTER_FEATURES: FeatureToggle[] = [
  { id: 'face_lock', label: 'Strict Face Identity Lock', description: 'Lock eye spacing, nose width, jawline curvature', defaultEnabled: true },
  { id: 'visual_consistency', label: 'Visual Consistency Engine', description: 'Append strict visual anchors to every Fal prompt', defaultEnabled: true },
  { id: 'voice_clone_map', label: 'Voice-Clone Reference Map', description: 'Save ElevenLabs voice IDs with character cards', defaultEnabled: true },
  { id: 'costume_matrix', label: 'Costume Matrix Manager', description: 'Log clothes, textures, color values', defaultEnabled: true },
  { id: 'reference_seed', label: 'Reference Image Seed Lock', description: 'Pass strict seeds to prevent facial morphing', defaultEnabled: true },
  { id: 'auto_anchor_inject', label: 'Auto Anchor Injection', description: 'Automatically append anchors to Fal payloads', defaultEnabled: true },
  { id: 'expression_library', label: 'Expression Library', description: 'Predefined emotional expressions per character', defaultEnabled: false },
  { id: 'aging_simulation', label: 'Aging Simulation', description: 'Progressive character aging across episodes', defaultEnabled: false },
  { id: 'voice_preview', label: 'Voice Preview', description: 'Test voice clone before assignment', defaultEnabled: true },
  { id: 'costume_variants', label: 'Costume Variant Manager', description: 'Multiple outfits per character', defaultEnabled: true },
];

export const FACE_METRICS_CONFIG: FeatureInput[] = [
  { id: 'eye_spacing', label: 'Eye Spacing', type: 'number', defaultValue: 34, placeholder: 'mm' },
  { id: 'nose_width', label: 'Nose Width', type: 'number', defaultValue: 28, placeholder: 'mm' },
  { id: 'forehead_height', label: 'Forehead Height', type: 'number', defaultValue: 65, placeholder: 'mm' },
  { id: 'jawline_curvature', label: 'Jawline Curvature', type: 'number', defaultValue: 128, placeholder: 'degrees' },
  { id: 'lip_thickness', label: 'Lip Thickness', type: 'number', defaultValue: 12, placeholder: 'mm' },
  { id: 'cheekbone_width', label: 'Cheekbone Width', type: 'number', defaultValue: 42, placeholder: 'mm' },
];

export const COSTUME_FIELDS: FeatureInput[] = [
  { id: 'top', label: 'Top / Outfit', type: 'text', placeholder: 'e.g. Blue hoodie' },
  { id: 'top_color', label: 'Top Color', type: 'color', defaultValue: '#3b82f6' },
  { id: 'bottom', label: 'Bottom', type: 'text', placeholder: 'e.g. Dark jeans' },
  { id: 'bottom_color', label: 'Bottom Color', type: 'color', defaultValue: '#1e3a5f' },
  { id: 'shoes', label: 'Footwear', type: 'text', placeholder: 'e.g. White sneakers' },
  { id: 'shoes_color', label: 'Shoe Color', type: 'color', defaultValue: '#ffffff' },
  { id: 'accessories', label: 'Accessories', type: 'text', placeholder: 'e.g. Red scarf' },
  { id: 'hair_style', label: 'Hair Style', type: 'text', placeholder: 'e.g. Short curly' },
  { id: 'hair_color', label: 'Hair Color', type: 'color', defaultValue: '#3d2817' },
];

// ─── World Builder ───
export const WORLD_BUILDER_TABS: SubTab[] = [
  { id: 'series_ideas', label: 'Series Ideas' },
  { id: 'lore_vault', label: 'Lore Vault' },
  { id: 'content_calendar', label: 'Content Calendar' },
];

export const WORLD_BUILDER_FEATURES: FeatureToggle[] = [
  { id: 'series_engine', label: 'Series Description Engine', description: 'Synopsis drives all future scripts', defaultEnabled: true },
  { id: 'lore_calendar', label: 'Interactive Lore Calendar', description: 'Grid of scheduled/published/drafted videos', defaultEnabled: true },
  { id: 'historic_modal', label: 'Deep Historic Data Modal', description: 'Click date for full analytic history', defaultEnabled: true },
  { id: 'post_series_gen', label: 'Auto Post-Series Idea Generator', description: '5 fresh ideas when series block concludes', defaultEnabled: true },
  { id: 'lore_vault', label: 'World Lore Continuity Vault', description: 'Document world rules and running jokes', defaultEnabled: true },
  { id: 'gemini_ideas', label: 'Gemini-Powered Idea Generation', description: 'Live trending ideas from Gemini API', defaultEnabled: true },
  { id: 'auto_tone_derive', label: 'Auto Tone Derivation', description: 'Derive tone from synopsis automatically', defaultEnabled: true },
  { id: 'auto_visual_derive', label: 'Auto Visual Theme Derivation', description: 'Derive visual style from synopsis', defaultEnabled: true },
  { id: 'series_duration_track', label: 'Series Duration Tracker', description: 'Monitor ongoing series duration', defaultEnabled: true },
  { id: 'idea_bookmark', label: 'Idea Bookmarking', description: 'Save promising ideas for later', defaultEnabled: false },
];

// ─── Analytics ───
export const ANALYTICS_TABS: SubTab[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'instagram', label: 'Instagram' },
];

export const ANALYTICS_FEATURES: FeatureToggle[] = [
  { id: 'retention_curve', label: 'Audience Retention Curve', description: 'Visual retention graph across video duration', defaultEnabled: true },
  { id: 'drop_off_points', label: 'Drop-off Point Detection', description: 'Identify exact seconds where viewers leave', defaultEnabled: true },
  { id: 'ctr_tracking', label: 'Thumbnail CTR Tracking', description: 'Click-through rate by quadrant', defaultEnabled: true },
  { id: 'sentiment_index', label: 'Comment Sentiment Index', description: 'AI-powered sentiment analysis', defaultEnabled: true },
  { id: 'follower_velocity', label: 'Follower Velocity Tracker', description: 'Growth rate over time', defaultEnabled: true },
  { id: 'learning_loop', label: 'Algorithmic Learning Loop', description: 'Auto-isolate weak factors', defaultEnabled: true },
  { id: 'prompt_tuning', label: 'Dynamic Prompt Tuning', description: 'Inject mistakes as negative instructions', defaultEnabled: true },
  { id: 'monthly_pdf', label: 'Monthly Summary PDF Builder', description: 'Deep visual report generation', defaultEnabled: true },
  { id: 'cross_platform_sync', label: 'Cross-Platform Sync Score', description: 'Compare performance across platforms', defaultEnabled: false },
  { id: 'best_post_time', label: 'Best Posting Time Analyzer', description: 'Optimal publish time recommendations', defaultEnabled: true },
];

// ─── Settings ───
export const SETTINGS_TABS: SubTab[] = [
  { id: 'api_vault', label: 'API Vault' },
  { id: 'deep_customization', label: 'Deep Customization' },
  { id: 'defaults', label: 'Defaults' },
];

export const SETTINGS_FEATURES: FeatureToggle[] = [
  { id: 'encrypt_locally', label: 'Encrypt Keys Locally', description: 'AES encryption before storing', defaultEnabled: true },
  { id: 'auto_sync_vault', label: 'Auto-Sync Vault to Supabase', description: 'Push keys to cloud on change', defaultEnabled: true },
  { id: 'key_rotation', label: 'Auto Key Rotation Reminder', description: 'Notify when keys are 90+ days old', defaultEnabled: false },
  { id: 'connection_test', label: 'Auto Connection Test on Save', description: 'Validate each key on save', defaultEnabled: true },
  { id: 'mask_keys', label: 'Mask Key Display', description: 'Hide key values in UI', defaultEnabled: true },
];

export const SETTINGS_CUSTOMIZATION_INPUTS: FeatureInput[] = [
  { id: 'accent_color', label: 'Accent Color', type: 'color', defaultValue: '#00d4ff' },
  { id: 'bg_gradient_color', label: 'Background Gradient Color', type: 'color', defaultValue: '#0a0c14' },
  { id: 'border_radius', label: 'Border Radius (px)', type: 'number', defaultValue: 12 },
  { id: 'font_size', label: 'Base Font Size (px)', type: 'number', defaultValue: 14 },
  { id: 'panel_opacity', label: 'Panel Opacity (%)', type: 'number', defaultValue: 60 },
  { id: 'gemini_temp', label: 'Gemini Temperature', type: 'number', defaultValue: 0.8 },
  { id: 'gemini_top_p', label: 'Gemini Top-P', type: 'number', defaultValue: 0.9 },
  { id: 'elevenlabs_stability', label: 'ElevenLabs Stability', type: 'number', defaultValue: 0.3 },
  { id: 'elevenlabs_similarity', label: 'ElevenLabs Similarity', type: 'number', defaultValue: 0.85 },
  { id: 'motion_speed', label: 'Default Motion Speed', type: 'number', defaultValue: 1.4 },
];

// ─── Caption Production ───
export const CAPTION_TABS: SubTab[] = [
  { id: 'yt_studio', label: 'YT Studio' },
  { id: 'insta_studio', label: 'Insta Studio' },
];

export const CAPTION_FEATURES: FeatureToggle[] = [
  { id: 'auto_made_with_ai', label: 'Auto "Made with AI" Tag', description: 'Enable YouTube AI flag automatically', defaultEnabled: true },
  { id: 'thumbnail_extractor', label: 'AI Thumbnail Frame Extractor', description: 'Scan video for highest-CTR frame', defaultEnabled: true },
  { id: 'sharpness_filter', label: 'Thumbnail Sharpness Filter', description: 'Ensure unblurred cover image', defaultEnabled: true },
  { id: 'auto_pinned_comment', label: 'Auto Pinned Comment Generation', description: 'Conversational comment to spark debate', defaultEnabled: true },
  { id: 'tag_drag_drop', label: 'Interactive Tag Customizer', description: 'Drag-and-drop tag chips', defaultEnabled: true },
  { id: 'rich_text_edit', label: 'Rich-Text Editing', description: 'Fully editable metadata fields', defaultEnabled: true },
  { id: 'emoji_injector', label: 'Emoji Injector for Instagram', description: 'Auto-add relevant emojis to captions', defaultEnabled: true },
  { id: 'line_break_optimizer', label: 'Line Break Optimizer', description: 'Clean structured caption formatting', defaultEnabled: true },
];

// ─── Schedule & Auto ───
export const SCHEDULE_TABS: SubTab[] = [
  { id: 'queue', label: 'Queue' },
  { id: 'smart_timing', label: 'Smart Timing' },
];

export const SCHEDULE_FEATURES: FeatureToggle[] = [
  { id: 'dawn_broadcast', label: 'Fixed Dawn Broadcast (7 AM)', description: 'Auto-upload and publish at 7:00 AM daily', defaultEnabled: true },
  { id: 'auto_timing', label: 'Smart Auto-Timing Adjuster', description: 'Shift hours if view thresholds drop', defaultEnabled: true },
  { id: 'comment_automation', label: 'Smart Comment Automation', description: 'Post pinned comment when video goes live', defaultEnabled: true },
  { id: 'upload_meter', label: 'Real-Time Upload Progress Meter', description: 'Track network speeds and upload states', defaultEnabled: true },
  { id: 'drag_drop_queue', label: 'Drag-and-Drop Queue Calendar', description: 'Visual calendar for queue management', defaultEnabled: true },
  { id: 'cross_post', label: 'Cross-Platform Simultaneous Post', description: 'Publish to YT + IG simultaneously', defaultEnabled: true },
  { id: 'auto_retry_failed', label: 'Auto-Retry Failed Uploads', description: 'Retry failed posts with backoff', defaultEnabled: true },
];

// ─── PHASE 3: Cockpit & Navigation Features ───
export const COCKPIT_FEATURES: FeatureToggle[] = [
  { id: 'timeline_progress', label: 'Interactive Timeline Progress Bar', description: 'Glowing top anchor tracking live asset stages', defaultEnabled: true },
  { id: 'panic_button', label: 'Panic Button Override', description: 'Red neon trigger to halt all active queues', defaultEnabled: true },
  { id: 'time_saved_tracker', label: 'Daily Time-Saved Tracker', description: 'Calculates hours saved vs manual editing', defaultEnabled: true },
  { id: 'zen_mode', label: 'Zen Mode Toggle', description: 'Collapses panels, shows timeline + lofi player', defaultEnabled: false },
  { id: 'system_badges', label: 'Dynamic System Badges', description: 'Pulsing neon dots on side-tabs for API activity', defaultEnabled: true },
];

export const TIMELINE_STAGES = [
  { id: 0, label: 'Script', icon: 'FileText' },
  { id: 1, label: 'Render', icon: 'Clapperboard' },
  { id: 2, label: 'Captions', icon: 'Captions' },
  { id: 3, label: 'Scheduled', icon: 'CalendarClock' },
];

// ─── PHASE 3: Script Lab Advanced Narrative ───
export const SCRIPT_LAB_P3_FEATURES: FeatureToggle[] = [
  { id: 'arc_analyzer', label: 'Emotional Storytelling Arc Analyzer', description: 'AI parser ensuring hook, build-up, and payoff', defaultEnabled: true },
  { id: 'curiosity_loop', label: 'Binge-Watch Curiosity Loop', description: 'Verifies cliffhanger for next episode', defaultEnabled: true },
  { id: 'pacing_highlights', label: 'Viral Dialogue Pacing Highlights', description: 'Syntax highlighting for visual zooms/SFX cues', defaultEnabled: true },
  { id: 'tone_switcher', label: 'Audience Tone Switcher', description: 'Slider to morph tone: Funny, Aggressive, Mysterious', defaultEnabled: true },
  { id: 'word_count_pacer', label: 'Smart Word-Count Pacer', description: 'Hard limits to guarantee under-58s audio runtime', defaultEnabled: true },
];

export const TONE_PRESETS = [
  { id: 'funny', label: 'Funny', color: '#ffb547' },
  { id: 'aggressive', label: 'Aggressive', color: '#ff5470' },
  { id: 'mysterious', label: 'Mysterious', color: '#8b5cf6' },
  { id: 'heartwarming', label: 'Heartwarming', color: '#22e078' },
];

// ─── PHASE 3: Production Studio Cinematic ───
export const STUDIO_P3_FEATURES: FeatureToggle[] = [
  { id: 'identity_protocol', label: 'Cinematic Identity Protocol Enforcer', description: 'Locks facial proportions via Fal API strict reference parameters', defaultEnabled: true },
  { id: 'sound_fx_toggle', label: 'Ultimate Visual Sound FX', description: 'Mechanical clicks/chimes in UI transitions', defaultEnabled: false },
  { id: 'emotion_color_mapper', label: 'Emotion-to-Color API Mapper', description: 'Reads script tone, injects color grading into Fal prompt', defaultEnabled: true },
  { id: 'lens_directives', label: 'High-Fidelity Lens Directives', description: 'Auto-injects Ultra HD HDR, 60 FPS, heavy bokeh', defaultEnabled: true },
  { id: 'aspect_switcher', label: 'Cinematic Aspect Ratio Switcher', description: '1-click toggle: 9:16, 16:9, 1:1', defaultEnabled: true },
  { id: 'lipsync_tester', label: 'Lip-Sync Quality Tester', description: 'Pre-render frequency matching checklist', defaultEnabled: true },
];

export const ASPECT_RATIOS = [
  { id: '9:16', label: '9:16 (Shorts/Reels)', value: '9:16' },
  { id: '16:9', label: '16:9 (Wide)', value: '16:9' },
  { id: '1:1', label: '1:1 (Square)', value: '1:1' },
];

export const EMOTION_COLOR_MAP: Record<string, { color: string; grading: string }> = {
  sad: { color: '#4a90d9', grading: 'Cold blue color grading, desaturated tones, melancholic atmosphere' },
  happy: { color: '#ff8a3d', grading: 'Warm orange color grading, vibrant saturation, joyful atmosphere' },
  angry: { color: '#ff5470', grading: 'Red-tinted color grading, high contrast, intense atmosphere' },
  mysterious: { color: '#8b5cf6', grading: 'Purple-tinted color grading, deep shadows, enigmatic atmosphere' },
  neutral: { color: '#22e078', grading: 'Balanced natural color grading, cinematic standard' },
};

// ─── PHASE 3: Caption Production ───
export const CAPTION_P3_FEATURES: FeatureToggle[] = [
  { id: 'ab_thumbnail', label: 'A/B Test Thumbnail Generator', description: 'Renders dual high-CTR unblurred thumbnail options', defaultEnabled: true },
  { id: 'clickbait_score', label: 'Click-Bait Score Matrix', description: 'Ranks titles/captions on 1-10 virality scale', defaultEnabled: true },
  { id: 'emoji_pattern', label: 'Emoji Auto-Pattern Injector', description: 'Contextual emoji insertion for readability', defaultEnabled: true },
  { id: 'comment_prompt', label: 'Comment Prompt Formulator', description: 'Auto-generates controversial pinned questions', defaultEnabled: true },
  { id: 'brand_overlay', label: 'Brand Overlay Module', description: 'Embeds custom transparent signature in video quadrant', defaultEnabled: false },
];

// ─── PHASE 3: Schedule & Optimization ───
export const SCHEDULE_P3_FEATURES: FeatureToggle[] = [
  { id: 'trend_scheduler', label: 'Global Trend Scheduler', description: 'Shifts upload time based on viral traffic heatmaps', defaultEnabled: true },
  { id: 'smart_reuploader', label: 'Smart Re-uploader Blueprint', description: 'Auto-archives poor performers, restreams with new tags', defaultEnabled: false },
  { id: 'format_shifter', label: 'Format Shifter', description: 'Adapts descriptions for YouTube vs Instagram', defaultEnabled: true },
  { id: 'exam_mode', label: 'Exam Mode Scheduler', description: 'Cache locker to auto-publish during study weeks', defaultEnabled: false },
  { id: 'api_failure_resched', label: 'API Failure Auto-Rescheduler', description: 'Catches timeouts, retries exactly 30 min later', defaultEnabled: true },
];

// ─── PHASE 3: Analytics & Finance Vault ───
export const ANALYTICS_P3_FEATURES: FeatureToggle[] = [
  { id: 'api_quota_tracker', label: 'API Quota Dashboard', description: 'Real-time tracker for free-tier token limits', defaultEnabled: true },
  { id: 'hook_heatmap', label: 'Hook Retention Heatmap', description: 'Visualizes projected drop-off points', defaultEnabled: true },
  { id: 'follower_predictor', label: 'Follower Velocity Predictor', description: 'Projects exact dates for subscriber milestones', defaultEnabled: true },
  { id: 'monthly_contrast', label: 'Monthly Contrast Strategy Report', description: 'Balances lore-heavy vs action-heavy performance', defaultEnabled: true },
  { id: 'negative_feedback', label: 'Negative Feedback Detector', description: 'Analyzes comments for disliked characters/arcs', defaultEnabled: true },
];

export const API_QUOTA_PROVIDERS = [
  { id: 'elevenlabs', label: 'ElevenLabs', freeLimit: 10000, unit: 'characters', key: 'elevenlabs_api_key' },
  { id: 'fal', label: 'Fal', freeLimit: 500, unit: 'credits', key: 'fal_api_key' },
  { id: 'gemini', label: 'Gemini', freeLimit: 1500, unit: 'requests/day', key: 'gemini_api_key' },
  { id: 'hf', label: 'HuggingFace', freeLimit: 1000, unit: 'calls/day', key: 'hf_access_token' },
];

// ─── PHASE 3: Character World ───
export const CHARACTER_P3_FEATURES: FeatureToggle[] = [
  { id: 'mood_canvas', label: 'Dynamic Mood Canvas Builder', description: 'Expression grid (Happy, Shocked, Angry) mapped to characters', defaultEnabled: true },
  { id: 'outfit_memory', label: 'Outfit Memory Vault', description: 'Context history to prevent accidental clothing changes', defaultEnabled: true },
  { id: 'voice_tuner', label: 'Voice Pitch & Speed Tuner', description: 'Granular sliders for ElevenLabs profiles', defaultEnabled: true },
  { id: 'scaling_controller', label: 'Dynamic Scaling Controller', description: 'Maintains height/width proportions in multi-character scenes', defaultEnabled: true },
  { id: 'asset_downloader', label: 'Interactive Asset Downloader', description: '1-click export for 3D templates and audio clips', defaultEnabled: true },
];

export const MOOD_EXPRESSIONS = [
  { id: 'happy', label: 'Happy', color: '#22e078' },
  { id: 'shocked', label: 'Shocked', color: '#ffb547' },
  { id: 'angry', label: 'Angry', color: '#ff5470' },
  { id: 'sad', label: 'Sad', color: '#4a90d9' },
  { id: 'neutral', label: 'Neutral', color: '#7c8499' },
  { id: 'excited', label: 'Excited', color: '#00d4ff' },
];
