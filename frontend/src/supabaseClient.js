import { createClient } from '@supabase/supabase-js';

let currentUrl = import.meta.env.VITE_SUPABASE_URL || '';
let currentKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const checkConfig = (url, key) => 
  Boolean(url) && 
  Boolean(key) && 
  url !== 'https://your-project.supabase.co' &&
  key !== 'your-anon-key';

export let isSupabaseConfigured = checkConfig(currentUrl, currentKey);

export let supabase = createClient(
  isSupabaseConfigured ? currentUrl : 'https://placeholder.supabase.co',
  isSupabaseConfigured ? currentKey : 'placeholder-key'
);

export const applyRuntimeSupabaseConfig = (url, key) => {
  if (checkConfig(url, key)) {
    currentUrl = url;
    currentKey = key;
    isSupabaseConfigured = true;
    supabase = createClient(currentUrl, currentKey);
    return true;
  }
  return false;
};
