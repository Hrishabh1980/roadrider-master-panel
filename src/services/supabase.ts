// ─────────────────────────────────────────────────────────────────────
//  RoadRider Master Admin Panel — Supabase Client & Service Layer
// ─────────────────────────────────────────────────────────────────────
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Retrieve credentials supporting both VITE_ and standard SUPABASE_ prefixes
const rawUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  import.meta.env.SUPABASE_URL ||
  '';

const rawKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.SUPABASE_ANON_KEY ||
  import.meta.env.SUPABASE_KEY ||
  '';

export const SUPABASE_URL: string = String(rawUrl).trim().replace(/^["']|["']$/g, '');
export const SUPABASE_ANON_KEY: string = String(rawKey).trim().replace(/^["']|["']$/g, '');

// Validate that credentials look like a legitimate Supabase project setup
export const isSupabaseConfigured: boolean = Boolean(
  SUPABASE_URL &&
  SUPABASE_ANON_KEY &&
  !SUPABASE_URL.includes('your-project') &&
  !SUPABASE_ANON_KEY.includes('your-anon-key') &&
  SUPABASE_URL.startsWith('http')
);

// Fallback dummy credentials when keys are missing, preventing client initialization crash
const FALLBACK_URL = 'https://placeholder.supabase.co';
const FALLBACK_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.placeholder';

export const supabase: SupabaseClient = createClient(
  isSupabaseConfigured ? SUPABASE_URL : FALLBACK_URL,
  isSupabaseConfigured ? SUPABASE_ANON_KEY : FALLBACK_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);

export interface SupabaseHealthCheck {
  isConfigured: boolean;
  isConnected: boolean;
  url?: string;
  error?: string | null;
  latencyMs?: number;
  timestamp: string;
}

/**
 * Actively tests connectivity to Supabase backend
 */
export async function testSupabaseConnection(): Promise<SupabaseHealthCheck> {
  const timestamp = new Date().toLocaleTimeString();

  if (!isSupabaseConfigured) {
    return {
      isConfigured: false,
      isConnected: false,
      error: 'Supabase credentials missing. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file and save.',
      timestamp,
    };
  }

  const startTime = performance.now();
  try {
    // Test auth service reachability
    const { error } = await supabase.auth.getSession();
    const latencyMs = Math.round(performance.now() - startTime);

    if (error) {
      return {
        isConfigured: true,
        isConnected: false,
        url: SUPABASE_URL,
        error: error.message,
        latencyMs,
        timestamp,
      };
    }

    return {
      isConfigured: true,
      isConnected: true,
      url: SUPABASE_URL,
      latencyMs,
      timestamp,
    };
  } catch (err: any) {
    return {
      isConfigured: true,
      isConnected: false,
      url: SUPABASE_URL,
      error: err.message || 'Network connection failed',
      timestamp,
    };
  }
}

/**
 * Generic Supabase table query returning live database rows
 */
export async function fetchTableData<T>(
  tableName: string,
  fallbackData?: T[],
  options?: {
    select?: string;
    orderBy?: { column: string; ascending?: boolean };
    limit?: number;
  }
): Promise<T[]> {
  if (!isSupabaseConfigured) return fallbackData || [];

  try {
    let query = supabase.from(tableName).select(options?.select || '*');
    if (options?.orderBy) {
      query = query.order(options.orderBy.column, { ascending: options?.orderBy.ascending ?? true });
    }
    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;
    if (error) {
      console.error(`[Supabase] Table "${tableName}" returned error:`, error.message);
      return [];
    }

    if (Array.isArray(data)) {
      return data as T[];
    }
    return [];
  } catch (err) {
    console.error(`[Supabase] Query exception on "${tableName}":`, err);
    return [];
  }
}

/**
 * Subscribe to realtime changes on a given table.
 * Creates a unique channel per subscriber so listeners are always registered
 * BEFORE calling .subscribe(), preventing Supabase "cannot add callbacks after subscribe()" errors.
 */
export function subscribeToTable(
  tableName: string,
  callback: (payload: any) => void
): () => void {
  if (!isSupabaseConfigured) return () => {};

  try {
    const channelId = `sub_${tableName}_${Math.random().toString(36).slice(2, 9)}_${Date.now()}`;
    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: tableName },
        (payload) => {
          try {
            callback(payload);
          } catch (cbErr) {
            console.warn(`[Supabase Realtime] Error in callback for "${tableName}":`, cbErr);
          }
        }
      )
      .subscribe((status, err) => {
        if (err) {
          console.warn(`[Supabase Realtime] Channel subscription error on "${tableName}":`, err.message || err);
        }
      });

    return () => {
      try {
        supabase.removeChannel(channel);
      } catch (cleanupErr) {
        console.warn(`[Supabase Realtime] Error cleaning up channel for "${tableName}":`, cleanupErr);
      }
    };
  } catch (err: any) {
    console.warn(`[Supabase Realtime] Failed to initialize subscription for "${tableName}":`, err?.message || err);
    return () => {};
  }
}

/**
 * Subscribe to realtime changes across multiple tables on a single combined channel.
 * Registers ALL .on('postgres_changes', ...) listeners BEFORE calling .subscribe().
 */
export function subscribeToTables(
  tableNames: string[],
  callback: (payload: any) => void
): () => void {
  if (!isSupabaseConfigured || !tableNames.length) return () => {};

  try {
    const channelId = `batch_${Math.random().toString(36).slice(2, 9)}_${Date.now()}`;
    let channel = supabase.channel(channelId);

    // Register all table listeners before subscribing
    for (const tableName of tableNames) {
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: tableName },
        (payload) => {
          try {
            callback(payload);
          } catch (cbErr) {
            console.warn(`[Supabase Realtime] Error in batch callback for "${tableName}":`, cbErr);
          }
        }
      );
    }

    // Subscribe once to the fully configured channel
    channel.subscribe((status, err) => {
      if (err) {
        console.warn('[Supabase Realtime] Batch channel subscription error:', err.message || err);
      }
    });

    return () => {
      try {
        supabase.removeChannel(channel);
      } catch (cleanupErr) {
        console.warn('[Supabase Realtime] Error cleaning up batch channel:', cleanupErr);
      }
    };
  } catch (err: any) {
    console.warn('[Supabase Realtime] Failed to initialize batch subscription:', err?.message || err);
    return () => {};
  }
}

export default supabase;

