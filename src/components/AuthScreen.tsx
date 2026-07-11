import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/authStore';
import { Clapperboard, Mail, Lock, Loader2, Sparkles } from 'lucide-react';

export function AuthScreen() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const setSession = useAuthStore((s) => s.setSession);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => { setSession(session); })();
    });
    return () => subscription.unsubscribe();
  }, [setSession]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'radial-gradient(ellipse at 50% 30%, #1F2833 0%, #0B0C10 70%)' }}>
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="glass-panel w-full max-w-md p-8"
        style={{ boxShadow: '0 0 48px var(--accent-glow)' }}
      >
        <div className="flex flex-col items-center mb-8">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="relative w-14 h-14 rounded-2xl flex items-center justify-center mb-3"
            style={{ background: 'linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 50%, #000))' }}
          >
            <Clapperboard size={28} className="text-black" />
            <span className="absolute -inset-1 rounded-2xl opacity-40 animate-pulse-glow" style={{ boxShadow: '0 0 24px var(--accent-glow)' }} />
          </motion.div>
          <h1 className="text-xl font-bold text-ink-50">ContentOps</h1>
          <p className="text-xs text-ink-400 mt-1">Automation Dashboard — Secure Access</p>
        </div>

        <div className="flex gap-2 mb-6 p-1 rounded-xl bg-white/[0.03] border border-white/[0.06]">
          {(['signup', 'signin'] as const).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(''); }}
              className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${mode === m ? 'bg-accent text-black' : 'text-ink-300 hover:text-ink-100'}`}
            >
              {m === 'signup' ? 'Create Account' : 'Sign In'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-ink-200 mb-1.5 block">Email</label>
            <div className="relative">
              <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-ink-850/60 border border-white/[0.06] text-sm text-ink-50 placeholder:text-ink-500 focus:border-accent/40 focus:outline-none transition-colors"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-ink-200 mb-1.5 block">Password</label>
            <div className="relative">
              <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder="Min 6 characters"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-ink-850/60 border border-white/[0.06] text-sm text-ink-50 placeholder:text-ink-500 focus:border-accent/40 focus:outline-none transition-colors"
              />
            </div>
          </div>

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="text-xs text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <motion.button
            type="submit"
            disabled={loading}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            className="w-full py-2.5 rounded-xl font-medium text-sm text-black flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            style={{ background: 'var(--accent)', boxShadow: '0 0 20px var(--accent-glow)' }}
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {mode === 'signup' ? 'Create Account' : 'Sign In'}
          </motion.button>
        </form>

        <p className="text-[10px] text-ink-500 text-center mt-6">
          Your data is protected with row-level security. Each account sees only its own content.
        </p>
      </motion.div>
    </div>
  );
}
