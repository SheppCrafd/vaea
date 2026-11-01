import { QueryClient, MutationCache } from '@tanstack/react-query';
import { toast } from '@/components/ui/use-toast';

// What a failed request means to the person, in their words. A server's
// raw error text ("Request failed with status code 404") isn't shown;
// Vaea's own errors, written to be read, are.
function describeError(error) {
	const status = error?.status ?? error?.response?.status;
	if (status === 401 || status === 403) return "Sign in to do this, then try again.";
	if (status === 429) return "Too many requests at once. Wait a minute, then try again.";
	// Vaea's own server functions answer with a readable { error } message.
	const serverMessage = error?.data?.error || error?.response?.data?.error;
	if (status && typeof serverMessage === "string") return serverMessage;
	if (status || /network|failed to fetch|load failed/i.test(error?.message || "")) {
		return "Vaea couldn't reach its server. Check your connection and try again.";
	}
	return error?.message || "Something went wrong. Try again.";
}

export const queryClientInstance = new QueryClient({
	defaultOptions: {
		// "always": run even when the browser reports offline. The board's
		// data lives on this device (or is reached through its own
		// requests), so the default "online" mode paused every save while
		// offline and left Create stuck on "Creating…". A request that really
		// needs the network now fails and says so instead of hanging.
		queries: {
			refetchOnWindowFocus: false,
			retry: 1,
			networkMode: "always",
		},
		mutations: {
			networkMode: "always",
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
	//     fix in its message), e.g. "Couldn't reach your vault" + how to reconnect
	// A hook that handles its own errors in useMutation({ onError }) is skipped.
	mutationCache: new MutationCache({
		onError: (error, _variables, _context, mutation) => {
			if (mutation.options.onError) return;
			toast({
				variant: "destructive",
				title: error?.title || mutation.meta?.errorTitle || "Couldn't save that change",
				description: describeError(error),
			});
		},
	}),
});