// Same spinner DeviceStorageGate.jsx already uses for its own full-screen
// loading state — was hand-copied there rather than shared, while
// Dashboard/ArchivedTaskList/ArchiveView's own loading states stayed bare
// unstyled text instead of reusing it.
export default function Spinner({ className = "w-8 h-8" }) {
  return <div className={`${className} border-4 border-border border-t-foreground rounded-full animate-spin`} />;
}
