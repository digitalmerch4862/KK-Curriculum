
import { createClient } from '@supabase/supabase-js';

/**
 * Safe utility to access environment variables.
 * In a production Vercel environment, these are injected.
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

// Updated with your Supabase Project Details
const supabaseUrl = getEnvVar('NEXT_PUBLIC_SUPABASE_URL', 'https://wfjhmimqntryohnrmuxc.supabase.co');
const supabaseAnonKey = getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndmamhtaW1xbnRyeW9obnJtdXhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxNDI0NjYsImV4cCI6MjA4NDcxODQ2Nn0.TanfHQNv9EE6pZPQ5GxCY6Af2cdVfId3SN6KLx7H-U4');

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
