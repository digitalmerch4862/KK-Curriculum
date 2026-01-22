
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rrjoroevlicakwnxgpey.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJyam9yb2V2bGljYWt3bnhncGV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMDA2NTMsImV4cCI6MjA4NDY3NjY1M30.zXu2lgPu14qpbLukw6ZZb__22GRY_Mm-8tM14qolPKc';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
