/**
 * Supabase Client for M-Care Mobile App
 *
 * Initializes the Supabase client with a custom storage adapter
 * that uses expo-secure-store for secure auth token persistence.
 * This ensures the user stays logged in between app launches.
 */

import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/constants/Config';

// ── SecureStore Adapter ─────────────────────────────────────
// Supabase needs a storage adapter to persist auth tokens.
// Expo SecureStore keys only permit alphanumeric characters, ".", "-", and "_".
const sanitizeKey = (key: string) => key.replace(/[^a-zA-Z0-9.\-_]/g, '_');

const SecureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      return await SecureStore.getItemAsync(sanitizeKey(key));
    } catch (error) {
      console.warn('SecureStore getItem error:', error);
      return null;
    }
  },

  setItem: async (key: string, value: string): Promise<void> => {
    try {
      await SecureStore.setItemAsync(sanitizeKey(key), value);
    } catch (error) {
      console.warn('SecureStore setItem error:', error);
    }
  },

  removeItem: async (key: string): Promise<void> => {
    try {
      await SecureStore.deleteItemAsync(sanitizeKey(key));
    } catch (error) {
      console.warn('SecureStore removeItem error:', error);
    }
  },
};

const WebStorageAdapter = {
  getItem: async (key: string): Promise<string | null> =>
    typeof localStorage === 'undefined' ? null : localStorage.getItem(key),
  setItem: async (key: string, value: string): Promise<void> => {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
  },
  removeItem: async (key: string): Promise<void> => {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
  },
};

// ── Supabase Client ─────────────────────────────────────────
// Create the Supabase client with our secure storage adapter.
// autoRefreshToken keeps the session alive automatically.
// detectSessionInUrl is disabled since we're on mobile (no URL bar).
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: Platform.OS === 'web' ? WebStorageAdapter : SecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
