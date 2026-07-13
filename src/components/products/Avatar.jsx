import { useState } from "react";

// Single avatar with a simple initials fallback when the mock image URL fails to load.
export default function Avatar({ name, avatarUrl, className = "" }) {
  const [failed, setFailed] = useState(false);
  const initials = name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();

  if (failed) {
    return (
      <div
        className={`w-8 h-8 rounded-full bg-primary text-primary-foreground text-xs font-medium flex items-center justify-center border-2 border-card ${className}`}
        title={name}
      >
        {initials}
      </div>
    );
  }

  return (
    <img
      src={avatarUrl}
      alt={name}
      title={name}
      onError={() => setFailed(true)}
      className={`w-8 h-8 rounded-full object-cover border-2 border-card ${className}`}
    />
  );
}