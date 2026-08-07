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
	// didn't save. `mutation.options.onError` is checked so a mutation that
	// already handles its own error isn't double-toasted.
	mutationCache: new MutationCache({
		onError: (error, _variables, _context, mutation) => {
			if (mutation.options.onError) return;
			toast({
				variant: "destructive",
				title: "Couldn't save that change",
				description: error?.message || "Something went wrong — try again.",
			});
		},
	}),
});