import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export type Series = {
  id: string;
  user_id: string;
  title: string;
  synopsis: string | null;
  tone: string | null;
  visual_theme: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  duration_days: number;
  created_at: string;
  updated_at: string;
};

export type ScriptData = {
  hook?: string;
  scenes?: SceneData[];
  cta?: string;
  seo_keywords?: string[];
  dialogue?: string;
  storyboard?: string;
  character_expressions?: Record<string, string>;
  lighting?: string;
  raw?: string;
};

export type SceneData = {
  shot: string;
  description: string;
  dialogue: string;
  lighting: string;
  expression: string;
};

export type Episode = {
  id: string;
  series_id: string | null;
  episode_number: number;
  title: string | null;
  script: ScriptData | null;
  script_variants: ScriptData[];
  active_variant_index: number;
  status: string;
  scheduled_at: string | null;
  published_at: string | null;
  video_url: string | null;
  thumbnail_url: string | null;
  metadata: Record<string, unknown>;
  virality_score: Record<string, number>;
  created_at: string;
  updated_at: string;
};

export type Character = {
  id: string;
  series_id: string | null;
  name: string;
  description: string | null;
  face_metrics: Record<string, number | string>;
  voice_id: string | null;
  costume: Record<string, string>;
  visual_anchors: string | null;
  reference_image_url: string | null;
  created_at: string;
  updated_at: string;
};

export type Analytic = {
  id: string;
  episode_id: string | null;
  metric_name: string;
  metric_value: number | null;
  baseline: boolean;
  recorded_at: string;
};

export type LogEntry = {
  id: string;
  user_id?: string;
  level: string;
  source: string;
  message: string;
  details: Record<string, unknown>;
  retryable: boolean;
  resolved: boolean;
  created_at: string;
};

export type Task = {
  id: string;
  user_id: string;
  title: string;
  type: string;
  status: string;
  scheduled_at: string | null;
  completed_at: string | null;
  payload: Record<string, unknown>;
  created_at: string;
};

export type Setting = {
  id: string;
  user_id: string;
  key: string;
  value: Record<string, unknown>;
  updated_at: string;
};
