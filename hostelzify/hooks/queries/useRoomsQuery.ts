'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';

export interface RoomFilters {
  hostelId?: string;
  status?: string;
  category?: string;
  search?: string;
}

/**
 * Hook to query and cache rooms with automatic signal-based cancellation.
 */
export function useRoomsQuery(filters: RoomFilters = {}) {
  return useQuery({
    queryKey: ['rooms', filters.hostelId || 'all'],
    queryFn: async ({ signal }) => {
      const res = await api.getRooms(
        { hostelId: filters.hostelId || undefined },
        { signal }
      );
      const data = res?.data ?? res;
      return Array.isArray(data) ? data : [];
    },
    staleTime: 60 * 1000, // 1 minute fresh
  });
}

/**
 * Hook to delete a room with automatic query cache invalidation.
 */
export function useDeleteRoomMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (roomId: string) => api.deleteRoom(roomId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
    },
  });
}
