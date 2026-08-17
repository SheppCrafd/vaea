import { Skeleton } from "@/components/ui/skeleton";

// Loading placeholder for Dashboard's initial areas fetch — mirrors
// AreaCard.jsx's real shape (title, description, a row of product tiles)
// closely enough that the swap-in doesn't cause a layout jump.
export default function AreaCardSkeleton() {
  return (
    <div className="relative z-10 bg-card border border-foreground/[0.04] rounded-2xl shadow-md p-5 flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="h-4 w-2/3" />
      </div>
      <div className="flex gap-3 flex-wrap">
        <Skeleton className="h-28 w-[248px]" />
        <Skeleton className="h-28 w-[248px]" />
      </div>
      <Skeleton className="h-16 w-full" />
    </div>
  );
}
