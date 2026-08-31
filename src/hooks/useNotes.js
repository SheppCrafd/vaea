import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { localDb } from "@/lib/localDb";

// Standalone "notepad" notes — distinct from ProjectNote (RISK/QUESTION/NOTE
// pinned to one project). A notepad note is free-floating scratch text with
// optional metadata: stakeholder_ids, product_ids, project_ids, date (the
// note's own date, defaults to today at create), due_date. Backed by the
// `notes` collection in localDb.
export function useNotes() {
  return useQuery({
    queryKey: ["notes"],
    queryFn: () => localDb.notes.list(),
    // Local-only data — see the matching comment in useAreas.js.
    staleTime: Infinity,
  });
}

export const createNote = (data) =>
  localDb.notes.create({ date: new Date().toISOString().slice(0, 10), ...data });

export const updateNote = ({ id, data }) => localDb.notes.update(id, data);

export const deleteNote = (id) => localDb.notes.delete(id);

export function useCreateNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createNote,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notes"] }),
  });
}

export function useUpdateNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateNote,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notes"] }),
  });
}

export function useDeleteNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteNote,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notes"] }),
  });
}
