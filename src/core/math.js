export function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function sign(v) {
  return v < 0 ? -1 : v > 0 ? 1 : 0;
}

export function aabbIntersects(a, b) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

export function rectFromCenterBottom(centerX, bottomY, w, h) {
  return { x: centerX - w / 2, y: bottomY - h, w, h };
}

