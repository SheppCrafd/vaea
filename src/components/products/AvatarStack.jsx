import Avatar from "@/components/products/Avatar";

// Overlapping avatar stack — max 5 visible, 5th slot becomes a "+X" badge when there are more.
export default function AvatarStack({ stakeholders }) {
  const visible = stakeholders.slice(0, 5);
  const overflow = stakeholders.length - 5;

  return (
    <div className="flex items-center">
      {visible.map((s, idx) => {
        const isLastWithOverflow = idx === 4 && overflow > 0;
        return (
          <div key={s.id} style={{ marginLeft: idx === 0 ? 0 : -10 }}>
            {isLastWithOverflow ? (
              <div className="w-8 h-8 rounded-full bg-muted text-muted-foreground text-xs font-medium flex items-center justify-center border-2 border-card">
                +{overflow}
              </div>
            ) : (
              <Avatar name={s.name} avatarUrl={s.avatarUrl} />
            )}
          </div>
        );
      })}
    </div>
  );
}