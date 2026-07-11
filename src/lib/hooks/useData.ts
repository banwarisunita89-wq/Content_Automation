import { useEffect, useState, useCallback } from 'react';
import { supabase, type Series, type Episode, type Character, type Task, type Setting } from '../supabase';

export function useSeries() {
  const [series, setSeries] = useState<Series[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSeries, setActiveSeries] = useState<Series | null>(null);

  const refresh = useCallback(async () => {
    const { data } = await supabase.from('series').select('*').order('created_at', { ascending: false });
    if (data) {
      setSeries(data as Series[]);
      setActiveSeries((data as Series[]).find((s) => s.status === 'active') ?? (data as Series[])[0] ?? null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const updateSeries = useCallback(async (id: string, updates: Partial<Series>) => {
    const { data } = await supabase.from('series').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select('*').single();
    if (data) {
      setSeries((prev) => prev.map((s) => (s.id === id ? (data as Series) : s)));
      setActiveSeries((prev) => (prev?.id === id ? (data as Series) : prev));
    }
    return data as Series | null;
  }, []);

  return { series, activeSeries, loading, refresh, updateSeries, setActiveSeries };
}

export function useEpisodes(seriesId: string | null) {
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!seriesId) {
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('episodes')
      .select('*')
      .eq('series_id', seriesId)
      .order('episode_number', { ascending: false });
    if (data) setEpisodes(data as Episode[]);
    setLoading(false);
  }, [seriesId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const updateEpisode = useCallback(async (id: string, updates: Partial<Episode>) => {
    const { data } = await supabase.from('episodes').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select('*').single();
    if (data) setEpisodes((prev) => prev.map((e) => (e.id === id ? (data as Episode) : e)));
    return data as Episode | null;
  }, []);

  const createEpisode = useCallback(async (ep: Partial<Episode>) => {
    const { data } = await supabase.from('episodes').insert(ep).select('*').single();
    if (data) setEpisodes((prev) => [data as Episode, ...prev]);
    return data as Episode | null;
  }, []);

  return { episodes, loading, refresh, updateEpisode, createEpisode };
}

export function useCharacters(seriesId: string | null) {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!seriesId) {
      setLoading(false);
      return;
    }
    const { data } = await supabase.from('characters').select('*').eq('series_id', seriesId).order('created_at', { ascending: false });
    if (data) setCharacters(data as Character[]);
    setLoading(false);
  }, [seriesId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createCharacter = useCallback(async (char: Partial<Character>) => {
    const { data } = await supabase.from('characters').insert(char).select('*').single();
    if (data) setCharacters((prev) => [data as Character, ...prev]);
    return data as Character | null;
  }, []);

  const updateCharacter = useCallback(async (id: string, updates: Partial<Character>) => {
    const { data } = await supabase.from('characters').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select('*').single();
    if (data) setCharacters((prev) => (prev).map((c) => (c.id === id ? (data as Character) : c)));
    return data as Character | null;
  }, []);

  const deleteCharacter = useCallback(async (id: string) => {
    await supabase.from('characters').delete().eq('id', id);
    setCharacters((prev) => prev.filter((c) => c.id !== id));
  }, []);

  return { characters, loading, refresh, createCharacter, updateCharacter, deleteCharacter };
}

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const { data } = await supabase.from('tasks').select('*').order('created_at', { ascending: false });
    if (data) setTasks(data as Task[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createTask = useCallback(async (task: Partial<Task>) => {
    const { data } = await supabase.from('tasks').insert(task).select('*').single();
    if (data) setTasks((prev) => [data as Task, ...prev]);
    return data as Task | null;
  }, []);

  const updateTask = useCallback(async (id: string, updates: Partial<Task>) => {
    const { data } = await supabase.from('tasks').update(updates).eq('id', id).select('*').single();
    if (data) setTasks((prev) => prev.map((t) => (t.id === id ? (data as Task) : t)));
    return data as Task | null;
  }, []);

  const deleteTask = useCallback(async (id: string) => {
    await supabase.from('tasks').delete().eq('id', id);
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { tasks, loading, refresh, createTask, updateTask, deleteTask };
}

export function useSetting<T = Record<string, unknown>>(key: string) {
  const [value, setValue] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const { data } = await supabase.from('settings').select('value').eq('key', key).maybeSingle();
    if (data?.value) setValue(data.value as T);
    setLoading(false);
  }, [key]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const save = useCallback(async (val: T) => {
    await supabase.from('settings').upsert({ key, value: val as unknown as Record<string, unknown> }, { onConflict: 'key' });
    setValue(val);
  }, [key]);

  return { value, loading, save, refresh };
}

export function useSettings() {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const { data } = await supabase.from('settings').select('*');
    if (data) setSettings(data as Setting[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const saveSetting = useCallback(async (key: string, value: Record<string, unknown>) => {
    const { data } = await supabase.from('settings').upsert({ key, value }, { onConflict: 'key' }).select('*').single();
    if (data) setSettings((prev) => {
      const exists = prev.find((s) => s.key === key);
      if (exists) return prev.map((s) => (s.key === key ? (data as Setting) : s));
      return [...prev, data as Setting];
    });
  }, []);

  const getSetting = useCallback((key: string): Record<string, unknown> | null => {
    return settings.find((s) => s.key === key)?.value ?? null;
  }, [settings]);

  return { settings, loading, refresh, saveSetting, getSetting };
}
