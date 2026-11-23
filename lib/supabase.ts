import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://zhgfsvsihuukmvpufnjh.supabase.co';
const supabaseAnonKey = 'sb_publishable_ynzgm4OKyVsAUstWu-MtYw__EzJE-x4';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);