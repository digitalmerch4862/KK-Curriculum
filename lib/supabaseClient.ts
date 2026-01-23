
import { createClient } from '@supabase/supabase-js';

/**
 * Safe utility to access environment variables.
 * In a production Vercel/Next environment, these are injected.
 * In the local/browser preview, we fallback to the provided defaults.
 */
const getEnvVar = (key: string, fallback: string): string => {
  try {
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      return process.env[key] as string;
    }
  } catch (e) {
    // Silent fail to use fallback
  }
  return fallback;
};

const supabaseUrl = getEnvVar('NEXT_PUBLIC_SUPABASE_URL', 'https://rrjoroevlicakwnxgpey.supabase.co');
const supabaseAnonKey = getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJyam9yb2V2bGljYWt3bnhncGV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMDA2NTMsImV4cCI6MjA4NDY3NjY1M30.zXu2lgPu14qpbLukw6ZZb__22GRY_Mm-8tM14qolPKc');

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
