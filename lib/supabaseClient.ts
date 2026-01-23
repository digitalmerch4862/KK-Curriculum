
import { createClient } from '@supabase/supabase-js';

// Hardcoded credentials provided for direct testing
// Fixed the typo in the Anon Key to match the user's provided value
const supabaseUrl = 'https://wfjhmimqntryohnrmuxc.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndmamhtaW1xbnRyeW9obnJtdXhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxNDI0NjYsImV4cCI6MjA4NDcxODQ2Nn0.TanfHQNv9EE6pZPQ5GxCY6Af2cdVfId3SN6KLx7H-U4';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
