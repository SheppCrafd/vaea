import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

const PAGE_SIZE = 20;

// True server-side lazy loading — "so that memory on the page is not
// overused" means the *fetch* has to stay bounded, not just the render.
// Only the most recent PAGE_SIZE messages are ever fetched eagerly; opening
// a long-running session costs one bounded request regardless of how many
// thousand messages it has. `loadMore()` issues one additional cursor-based
// fetch per call for the next older batch, merged into local state — older
// pages are never re-fetched once loaded.
export function useChatMessages(sessionId) {
  const [olderMessages, setOlderMessages] = useState([]); // accumulated older pages, oldest-first
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  useEffect(() => {
    setOlderMessages([]);
    setHasMore(true);
  }, [sessionId]);

  const recentQuery = useQuery({
    queryKey: ["chatMessages", sessionId, "recent"],
    queryFn: async () => {
      const desc = await base44.entities.ChatMessage.filter({ session_id: sessionId }, "-created_date", PAGE_SIZE, 0);
      return [...desc].reverse();
    },
    enabled: !!sessionId,
  });

  const recentMessages = recentQuery.data || [];

  // Cursor-based on the oldest loaded message's timestamp rather than a
  // skip offset — a skip count would drift (and open a gap in the merged
  // list) if a new message arrives and shifts the "recent" window while the
  // user is paginating backward. Querying strictly-older-than a fixed
  // timestamp is unaffected by anything appended at the tail.
  const loadMore = useCallback(async () => {
    if (!sessionId || isLoadingMore || !hasMore) return;
    const oldestLoaded = olderMessages[0] || recentMessages[0];
    if (!oldestLoaded) return;
    setIsLoadingMore(true);
    try {
      const desc = await base44.entities.ChatMessage.filter(
        { session_id: sessionId, created_date: { $lt: oldestLoaded.created_date } },
        "-created_date",
        PAGE_SIZE
      );
      if (desc.length < PAGE_SIZE) setHasMore(false);
      setOlderMessages((prev) => [...[...desc].reverse(), ...prev]);
    } finally {
      setIsLoadingMore(false);
    }
  }, [sessionId, isLoadingMore, hasMore, olderMessages, recentMessages]);

  return {
    ...recentQuery,
    messages: [...olderMessages, ...recentMessages],
    hasMore,
    isLoadingMore,
    loadMore,
  };
}

export function useCreateChatMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => base44.entities.ChatMessage.create(data),
    // Append directly to the cached "recent" page instead of invalidating
    // and refetching skip=0/limit=PAGE_SIZE — a refetch would slide the
    // window forward by one and open a gap against whatever older pages
    // were already loaded via loadMore's fixed timestamp cursor.
    onSuccess: (created, variables) => {
      queryClient.setQueryData(["chatMessages", variables.session_id, "recent"], (prev = []) => [...prev, created]);
    },
  });
}

export function useUpdateChatMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => base44.entities.ChatMessage.update(id, data),
    onSuccess: (_, variables) => {
      if (variables?.data?.session_id) {
        queryClient.invalidateQueries({ queryKey: ["chatMessages", variables.data.session_id] });
      } else {
        queryClient.invalidateQueries({ queryKey: ["chatMessages"] });
      }
    },
  });
}
