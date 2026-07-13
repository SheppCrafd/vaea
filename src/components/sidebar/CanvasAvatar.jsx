import { useRef, useState } from "react";

function hashToColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  let color = "#";
  for (let i = 0; i < 3; i++) {
    const value = (hash >> (i * 8)) & 0xff;
    color += ("00" + value.toString(16)).slice(-2);
  }
  return color;
}

// Avatar with a canvas-drawn fallback: on image error, draws a colored circle
// with the person's initials onto a hidden canvas and uses its dataURL as the image src.
export default function CanvasAvatar({ name, avatarUrl }) {
  const [src, setSrc] = useState(avatarUrl);
  const canvasRef = useRef(null);

  const handleError = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const size = 32;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = hashToColor(name);
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const initials = name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
    ctx.fillText(initials, size / 2, size / 2 + 1);
    setSrc(canvas.toDataURL());
  };

  return (
    <>
      <img src={src} alt={name} onError={handleError} className="w-8 h-8 rounded-full object-cover" />
      <canvas ref={canvasRef} style={{ display: "none" }} />
    </>
  );
}