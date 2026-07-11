import { QueryClient, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, type Series, type Episode, type Character, type Task, type Setting, type LogEntry } from './supabase';
import { useActiveStore } from './stores';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

// ─── Series Queries ───
export function useSeriesQuery() {
  return useQuery({
    queryKey: ['series'],
    queryFn: async () => {
      const { data, error } = await supabase.from('series').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data as Series[];
    },
  });
}

export function useActiveSeriesQuery() {
  const { data: series } = useSeriesQuery();
  const activeSeriesId = useActiveStore((s) => s.activeSeriesId);
  return series?.find((s) => s.id === activeSeriesId) || series?.find((s) => s.status === 'active') || series?.[0] || null;
}

export function useUpdateSeriesMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Series> }) => {
      const { data, error } = await supabase.from('series').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select('*').single();
      if (error) throw error;
      return data as Series;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['series'] }),
  });
}

export function useCreateSeriesMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (series: Partial<Series>) => {
      const { data, error } = await supabase.from('series').insert(series).select('*').single();
      if (error) throw error;
      return data as Series;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['series'] }),
  });
}

// ─── Episode Queries ───
export function useEpisodesQuery(seriesId: string | null) {
  return useQuery({
    queryKey: ['episodes', seriesId],
    queryFn: async () => {
      if (!seriesId) return [];
      const { data, error } = await supabase.from('episodes').select('*').eq('series_id', seriesId).order('episode_number', { ascending: false });
      if (error) throw error;
      return data as Episode[];
    },
    enabled: !!seriesId,
  });
}

export function useUpdateEpisodeMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Episode> }) => {
      const { data, error } = await supabase.from('episodes').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select('*').single();
      if (error) throw error;
      return data as Episode;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['episodes'] }),
  });
}

export function useCreateEpisodeMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ep: Partial<Episode>) => {
      const { data, error } = await supabase.from('episodes').insert(ep).select('*').single();
      if (error) throw error;
      return data as Episode;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['episodes'] }),
  });
}

// ─── Character Queries ───
export function useCharactersQuery(seriesId: string | null) {
  return useQuery({
    queryKey: ['characters', seriesId],
    queryFn: async () => {
      if (!seriesId) return [];
      const { data, error } = await supabase.from('characters').select('*').eq('series_id', seriesId).order('created_at', { ascending: false });
      if (error) throw error;
      return data as Character[];
    },
    enabled: !!seriesId,
  });
}

export function useCreateCharacterMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (char: Partial<Character>) => {
      const { data, error } = await supabase.from('characters').insert(char).select('*').single();
      if (error) throw error;
      return data as Character;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['characters'] }),
  });
}

export function useUpdateCharacterMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Character> }) => {
      const { data, error } = await supabase.from('characters').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select('*').single();
      if (error) throw error;
      return data as Character;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['characters'] }),
  });
}

export function useDeleteCharacterMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('characters').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['characters'] }),
  });
}

// ─── Task Queries ───
export function useTasksQuery() {
  return useQuery({
    queryKey: ['tasks'],
    queryFn: async () => {
      const { data, error } = await supabase.from('tasks').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data as Task[];
    },
  });
}

export function useCreateTaskMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (task: Partial<Task>) => {
      const { data, error } = await supabase.from('tasks').insert(task).select('*').single();
      if (error) throw error;
      return data as Task;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });
}

export function useUpdateTaskMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Task> }) => {
      const { data, error } = await supabase.from('tasks').update(updates).eq('id', id).select('*').single();
      if (error) throw error;
      return data as Task;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });
}

export function useDeleteTaskMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tasks').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });
}

// ─── Log Queries ───
export function useLogsQuery(limit = 50) {
  return useQuery({
    queryKey: ['logs', limit],
    queryFn: async () => {
      const { data, error } = await supabase.from('logs').select('*').order('created_at', { ascending: false }).limit(limit);
      if (error) throw error;
      return data as LogEntry[];
    },
  });
}

export function useAddLogMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entry: Omit<LogEntry, 'id' | 'created_at'>) => {
      const { data, error } = await supabase.from('logs').insert(entry).select('*').single();
      if (error) throw error;
      return data as LogEntry;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['logs'] }),
  });
}

export function useResolveLogMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('logs').update({ resolved: true }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['logs'] }),
  });
}

// ─── Settings Queries ───
export function useSettingsQuery() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('settings').select('*');
      if (error) throw error;
      return data as Setting[];
    },
  });
}

export function useSaveSettingMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ key, value }: { key: string; value: Record<string, unknown> }) => {
      const { data, error } = await supabase.from('settings').upsert({ key, value }, { onConflict: 'key' }).select('*').single();
      if (error) throw error;
      return data as Setting;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }),
  });
}

export function useSettingValue<T = Record<string, unknown>>(key: string): T | null {
  const { data: settings } = useSettingsQuery();
  return (settings?.find((s) => s.key === key)?.value as T) ?? null;
}

// ─── Analytics Queries ───
export function useAnalyticsQuery(episodeId: string | null) {
  return useQuery({
    queryKey: ['analytics', episodeId],
    queryFn: async () => {
      if (!episodeId) return [];
      const { data, error } = await supabase.from('analytics').select('*').eq('episode_id', episodeId).order('recorded_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!episodeId,
  });
}

export function useInsertAnalyticsMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entry: { episode_id: string; metric_name: string; metric_value: number; baseline?: boolean }) => {
      const { data, error } = await supabase.from('analytics').insert(entry).select('*').single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['analytics'] }),
  });
}
