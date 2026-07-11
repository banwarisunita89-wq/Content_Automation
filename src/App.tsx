import { QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { Layout } from './components/Layout';
import { AuthScreen } from './components/AuthScreen';
import { CockpitModule } from './components/modules/CockpitModule';
import { ScriptLabModule } from './components/modules/ScriptLabModule';
import { StudioModule } from './components/modules/StudioModule';
import { CaptionsModule } from './components/modules/CaptionsModule';
import { ScheduleModule } from './components/modules/ScheduleModule';
import { WorldBuilderModule } from './components/modules/WorldBuilderModule';
import { CharactersModule } from './components/modules/CharactersModule';
import { AnalyticsModule } from './components/modules/AnalyticsModule';
import { SettingsModule } from './components/modules/SettingsModule';
import { queryClient } from './lib/queries';
import { useNavStore, useActiveStore } from './lib/stores';
import { useAuthStore } from './lib/authStore';
import { supabase } from './lib/supabase';
import { useSeriesQuery } from './lib/queries';

function AppContent() {
  const activeModule = useNavStore((s) => s.activeModule);
  const { data: series } = useSeriesQuery();
  const activeSeriesId = useActiveStore((s) => s.activeSeriesId);
  const setActiveSeries = useActiveStore((s) => s.setActiveSeries);

  useEffect(() => {
    if (series && series.length > 0 && !activeSeriesId) {
      const active = series.find((s) => s.status === 'active') || series[0];
      setActiveSeries(active.id);
    }
  }, [series, activeSeriesId, setActiveSeries]);

  const seriesId = activeSeriesId ?? series?.[0]?.id ?? null;

  return (
    <Layout>
      {activeModule === 'cockpit' && <CockpitModule seriesId={seriesId} />}
      {activeModule === 'scriptlab' && <ScriptLabModule seriesId={seriesId} />}
      {activeModule === 'studio' && <StudioModule seriesId={seriesId} />}
      {activeModule === 'captions' && <CaptionsModule seriesId={seriesId} />}
      {activeModule === 'schedule' && <ScheduleModule seriesId={seriesId} />}
      {activeModule === 'worldbuilder' && <WorldBuilderModule seriesId={seriesId} />}
      {activeModule === 'characters' && <CharactersModule seriesId={seriesId} />}
      {activeModule === 'analytics' && <AnalyticsModule seriesId={seriesId} />}
      {activeModule === 'settings' && <SettingsModule />}
    </Layout>
  );
}

export default function App() {
  const session = useAuthStore((s) => s.session);
  const initialized = useAuthStore((s) => s.initialized);
  const setSession = useAuthStore((s) => s.setSession);
  const setInitialized = useAuthStore((s) => s.setInitialized);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setInitialized(true);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => { setSession(session); })();
    });
    return () => subscription.unsubscribe();
  }, [setSession, setInitialized]);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        {!initialized ? (
          <div className="min-h-screen flex items-center justify-center" style={{ background: '#0B0C10' }}>
            <div className="text-ink-400 text-sm">Loading...</div>
          </div>
        ) : !session ? (
          <AuthScreen />
        ) : (
          <AppContent />
        )}
        <SpeedInsights />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
