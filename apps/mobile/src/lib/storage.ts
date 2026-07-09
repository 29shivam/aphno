import { Platform } from 'react-native';

// Tiny token store. Uses localStorage on web; an in-memory map on native.
// TODO(native): swap the native branch for expo-secure-store to persist across
// app restarts. Kept dependency-free so the web build works out of the box.
const mem: Record<string, string> = {};

export const storage = {
  get(key: string): string | null {
    if (Platform.OS === 'web') {
      try {
        return globalThis.localStorage?.getItem(key) ?? null;
      } catch {
        return null;
      }
    }
    return mem[key] ?? null;
  },
  set(key: string, value: string): void {
    if (Platform.OS === 'web') {
      try {
        globalThis.localStorage?.setItem(key, value);
      } catch {
        /* ignore */
      }
    } else {
      mem[key] = value;
    }
  },
  remove(key: string): void {
    if (Platform.OS === 'web') {
      try {
        globalThis.localStorage?.removeItem(key);
      } catch {
        /* ignore */
      }
    } else {
      delete mem[key];
    }
  },
};
