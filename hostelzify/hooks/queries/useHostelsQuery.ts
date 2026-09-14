'use client';

import { useQuery } from '@tanstack/react-query';
import api from '../../services/api';
import { Hostel } from '@hostelzify/api-client';

/**
 * Hook to query and cache hostels with deduplication.
 */
export function useHostelsQuery(params?: Record<string, unknown>) {
  return useQuery<Hostel[]>({
    queryKey: ['hostels', params || {}],
    queryFn: async ({ signal }) => {
      const data = await api.getHostels(params, { signal });
      return Array.isArray(data) ? (data as Hostel[]) : [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes fresh
  });
}
