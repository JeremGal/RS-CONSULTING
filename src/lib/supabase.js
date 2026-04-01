import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: true, autoRefreshToken: true },
  realtime: { params: { eventsPerSecond: 20 } }
});

export const handleError = (error) => {
  if (!error) return 'Erreur inconnue';
  if (typeof error === 'string') return error;
  return error.message || error.details || 'Une erreur est survenue';
};

export const logActivity = async (action, prospectId = null, details = {}) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('activity_logs').insert([{
      user_id: user.id,
      prospect_id: prospectId,
      action,
      details
    }]);
  } catch (e) {
    if (import.meta.env.DEV) console.warn('Activity log failed:', e);
  }
};
