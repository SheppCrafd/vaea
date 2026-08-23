import { cn } from "@/lib/utils";

// The one card wrapper every Settings section root div uses — was the exact
// same className string retyped in 17 places across 16 section components
// instead of shared.
export function SettingsCard({ className, children, ...props }) {
  return (
    <div className={cn("card-enter bg-card border border-foreground/[0.04] rounded-2xl shadow-md p-6", className)} {...props}>
      {children}
    </div>
  );
}
