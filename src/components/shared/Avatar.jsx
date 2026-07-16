import { useState } from "react";

// Same pastel palette as the "Task Statistics" chart in the sidebar
// (src/components/sidebar/StatisticsChart.jsx) — green/blue/yellow/orange/red,
// excluding its grey and white entries since those aren't really "pastels".
const PASTELS = ["#86efac", "#93c5fd", "#fde68a", "#fdba74", "#fca5a5"];

// FNV-1a hash — chosen over the simpler `hash*31+c` scheme because that one
// mixes bits poorly for short strings (most first names), which made the
// mod-5 bucket pick cluster into just one or two colors in practice instead
// of spreading across the palette.
function pastelForName(name) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < name.length; i++) {
    hash ^= name.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return PASTELS[(hash >>> 0) % PASTELS.length];
}

function getInitials(name) {
  return name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}

// Avatar that shows the uploaded photo when available; otherwise falls back
// to initials on a pastel background, picked (stably, from the person's
// name) from the same palette as the sidebar's Task Statistics chart.
export default function Avatar({ name, avatarUrl, className = "" }) {
  const [imageFailed, setImageFailed] = useState(false);

  if (avatarUrl && !imageFailed) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        title={name}
        onError={() => setImageFailed(true)}
        className={`w-8 h-8 rounded-full object-cover border-2 border-card ${className}`}
      />
    );
  }

  return (
    <div
      title={name}
      style={{ backgroundColor: pastelForName(name) }}
      className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-slate-800 border-2 border-card ${className}`}
    >
      {getInitials(name)}
    </div>
  );
}
