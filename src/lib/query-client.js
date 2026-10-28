import { QueryClient, MutationCache } from '@tanstack/react-query';
import { toast } from '@/components/ui/use-toast';

export const queryClientInstance = new QueryClient({
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false,
			retry: 1,
		},
	},
	// A global fallback for any mutation with no onError of its own. Before
	// this, only the four entity-creation forms (AreaForm/ProductForm/
	// ProjectForm/TaskForm) showed a real error toast — every other mutation
	// in the app (in-place edits: task status/quadrant/stakeholders, card
	// title/objective edits, drag-reorder writes, ~57 call sites total) had
	// no onError at all, so a real write failure (a parent deleted out from
	// under it, a device-storage write error, a permission revoked
	// mid-session) failed completely silently — no toast, no indicator, the
	// UI just didn't update and the user had no way to know their edit
	// didn't save.
	//
	// This is the ONE place a failed write becomes a toast. Don't pass
	// onError to `.mutate()` to show your own: React Query runs both, so the
	// user got two red toasts for one failure (this check can't see per-call
	// handlers). Instead:
	//   - a hook names what failed with `meta: { errorTitle: "Couldn't create area" }`
	//   - an error that knows the fix carries its own `title` (and says the
	//     fix in its message), e.g. toggleTopThree's "Top 3 is full"
	// A hook that handles its own errors in useMutation({ onError }) is skipped.
	mutationCache: new MutationCache({
		onError: (error, _variables, _context, mutation) => {
			if (mutation.options.onError) return;
			toast({
				variant: "destructive",
				title: error?.title || mutation.meta?.errorTitle || "Couldn't save that change",
				description: error?.message || "Something went wrong. Try again.",
			});
		},
	}),
});