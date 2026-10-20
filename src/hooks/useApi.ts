import { useState, useEffect, useCallback } from 'react';
import { isSupabaseConfigured } from '../services/supabase';

export type ApiStatus = 'idle' | 'loading' | 'success' | 'error';

export interface UseApiResult<T> {
  data: T | null;
  status: ApiStatus;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Generic data-fetching hook.
 *
 * Usage:
 *   const { data, loading, error } = useApi(
 *     () => customersApi.getAll({ city: 'Lucknow' }),
 *     fallbackData,          // shown while backend is unavailable
 *     [city]                 // re-fetch when these deps change
 *   );
 */
export function useApi<T>(
  fetcher: () => Promise<T>,
  fallback?: T,
  deps: any[] = []
): UseApiResult<T> {
  const [data, setData] = useState<T | null>(fallback ?? null);
  const [status, setStatus] = useState<ApiStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [trigger, setTrigger] = useState(0);

  const isBackendConfigured = !!(import.meta.env.VITE_API_URL as string) || isSupabaseConfigured;

  const fetch = useCallback(async () => {
    if (!isBackendConfigured) {
      setError('Backend connection not configured. Please check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
      setStatus('error');
      return;
    }

    setStatus('loading');
    setError(null);
    try {
      const result = await fetcher();
      setData(result);
      setStatus('success');
    } catch (err: any) {
      console.error('[RoadRider API] Fetch error:', err.message);
      setError(err.message || 'Failed to fetch data from backend');
      setStatus('error');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger, ...deps]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const refetch = () => setTrigger(t => t + 1);

  return {
    data: data,
    status,
    loading: status === 'loading',
    error,
    refetch,
  };
}

/**
 * Paginated variant – wraps paginated API responses.
 */
export function usePaginatedApi<T>(
  fetcher: (page: number) => Promise<{ data: T[]; total: number }>,
  initialRows: T[] = [],
  deps: any[] = []
) {
  const [page, setPage] = useState(1);
  const { data, loading, error, refetch } = useApi(
    () => fetcher(page),
    { data: initialRows, total: initialRows.length },
    [page, ...deps]
  );

  return {
    rows: data?.data ?? [],
    total: data?.total ?? 0,
    page,
    setPage,
    loading,
    error,
    refetch,
  };
}

