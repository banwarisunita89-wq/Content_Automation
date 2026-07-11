import { useEffect, useState, useCallback } from 'react';
import { supabase, type LogEntry } from '../supabase';

export function useLogs(limit = 50) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase
        .from('logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (mounted && data) setLogs(data as LogEntry[]);
      if (mounted) setLoading(false);
    })();

    const channel = supabase
      .channel('logs-stream')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'logs' }, (payload) => {
        setLogs((prev) => [payload.new as LogEntry, ...prev].slice(0, limit));
      })
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [limit]);

  const addLog = useCallback(async (entry: Omit<LogEntry, 'id' | 'created_at'>) => {
    const { data } = await supabase.from('logs').insert(entry).select('*').single();
    return data as LogEntry | null;
  }, []);

  const resolveLog = useCallback(async (id: string) => {
    await supabase.from('logs').update({ resolved: true }).eq('id', id);
    setLogs((prev) => prev.map((l) => (l.id === id ? { ...l, resolved: true } : l)));
  }, []);

  return { logs, loading, addLog, resolveLog };
}
