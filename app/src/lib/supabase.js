import { createClient } from '@supabase/supabase-js';

// Public SPA credentials — safe to ship; all authorization lives in RLS.
export const SUPABASE_URL = 'https://qflxrnnpqzbuoypxgwhv.supabase.co';
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmbHhybm5wcXpidW95cHhnd2h2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwMjI5NDUsImV4cCI6MjA5ODU5ODk0NX0.skZDwfIkWrRSJRhKOV6YuqFRM_GIMeW6Q1okXjRiiqs';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
