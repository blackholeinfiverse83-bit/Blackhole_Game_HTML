import { clamp } from "../core/math.js";

export function createTestLevel() {
  const level = new TestLevel();
  level.reset();
  return level;
}

class TestLevel {
  constructor() {
    this.width = 2200;
    this.height = 900;

    // Simple parallax markers
    this._clouds = Array.from({ length: 18 }, (_, i) => ({
      x: i * 180 + (i % 3) * 40,
      y: 60 + (i % 5) * 18,
      r: 18 + (i % 4) * 6,
    }));

    this._solids = [];
    this._coins = [];
    this._coinAnim = 0;
  }

  reset() {
    // Base ground "strip" represented by wide rectangles.
    // World coordinates: y increases downward; ground top is y=300-ish in first screen.
    this._solids = [
      { x: 0, y: 300, w: 2200, h: 600 },

      // Platforms / steps
      { x: 320, y: 250, w: 120, h: 20 },
      { x: 520, y: 220, w: 140, h: 20 },
      { x: 760, y: 260, w: 120, h: 20 },

      // A pit by removing ground with two blocks instead of one (fake pit)
      // We'll build pit edges by adding floor segments.
      { x: 980, y: 300, w: 200, h: 600 }, // left floor
      { x: 1280, y: 300, w: 920, h: 600 }, // right floor

      // Small "tunnel ceiling" segment for future (not solid from below yet).
      { x: 1450, y: 210, w: 260, h: 20 },
    ];

    // Replace initial ground with two segments around pit:
    this._solids.splice(0, 1);
    this._solids.unshift(
      { x: 0, y: 300, w: 980, h: 600 },
      { x: 1180, y: 300, w: 1020, h: 600 }
    );

    // Coins placed on/near platforms
    this._coins = [
      // First platform at (320..440, y=250)
      { x: 340, y: 226, active: true },
      { x: 370, y: 226, active: true },
      { x: 400, y: 226, active: true },

      // Second platform at (520..660, y=220)
      { x: 545, y: 196, active: true },
      { x: 575, y: 196, active: true },
      { x: 605, y: 196, active: true },
      { x: 635, y: 196, active: true },

      // Third platform at (760..880, y=260)
      { x: 780, y: 236, active: true },
      { x: 810, y: 236, active: true },
      { x: 840, y: 236, active: true },
    ];
  }

  update(dt, player) {
    // Animate + collect coins.
    this._coinAnim = (this._coinAnim + dt * 10) % 8; // ~10fps

    const hb = player.getHitbox();
    const px = hb.x + hb.w / 2;
    const py = hb.y + hb.h / 2;
    const r = 16;
    const r2 = r * r;

    for (const c of this._coins) {
      if (!c.active) continue;
      const dx = c.x - px;
      const dy = c.y - py;
      if (dx * dx + dy * dy <= r2) {
        c.active = false;
        player.rings += 1;
        player.score += 10;
      }
    }
  }

  getSolidsNear(hb) {
    // Very small broadphase: filter by X-range.
    const margin = 96;
    const minX = hb.x - margin;
    const maxX = hb.x + hb.w + margin;
    return this._solids.filter((s) => s.x < maxX && s.x + s.w > minX);
  }

  renderBackground(ctx, camera) {
    // Sky is canvas background color; draw hills and clouds as parallax.
    const cx = camera.x;
    const cy = camera.y;

    // Far hills
    ctx.save();
    ctx.translate(-(cx * 0.2), -(cy * 0.05));
    ctx.fillStyle = "rgba(47, 160, 110, 0.45)";
    for (let i = 0; i < 8; i++) {
      const x = i * 340;
      ctx.beginPath();
      ctx.ellipse(x + 140, 250, 220, 90, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Clouds
    ctx.save();
    ctx.translate(-(cx * 0.1), -(cy * 0.02));
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    for (const c of this._clouds) {
      const sx = c.x - cx * 0.1;
      const sy = c.y - cy * 0.02;
      ctx.beginPath();
      ctx.arc(sx, sy, c.r, 0, Math.PI * 2);
      ctx.arc(sx + c.r * 0.9, sy + 4, c.r * 0.8, 0, Math.PI * 2);
      ctx.arc(sx - c.r * 0.9, sy + 6, c.r * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  render(ctx, camera) {
    // Terrain blocks
    for (const s of this._solids) {
      const x = s.x - camera.x;
      const y = s.y - camera.y;
      if (x + s.w < -50 || x > camera.width + 50) continue;

      // Dirt
      ctx.fillStyle = "#a86a2a";
      ctx.fillRect(x, y, s.w, s.h);

      // Grass top only for "ground" heights
      if (s.h >= 80) {
        ctx.fillStyle = "#2fdc74";
        ctx.fillRect(x, y, s.w, 12);
      } else {
        // Platform top
        ctx.fillStyle = "#2fdc74";
        ctx.fillRect(x, y, s.w, 8);
      }

      // Checkered hint
      ctx.fillStyle = "rgba(0,0,0,0.06)";
      const step = 16;
      const startX = clamp(Math.floor(x / step) * step, -99999, 99999);
      for (let xx = startX; xx < x + s.w; xx += step) {
        for (let yy = Math.floor(y / step) * step; yy < y + Math.min(s.h, 160); yy += step) {
          if (((xx / step) ^ (yy / step)) & 1) ctx.fillRect(xx, yy, step, step);
        }
      }
    }

    // Coins (simple "ring-like" animation)
    const frame = Math.floor(this._coinAnim);
    const squash = [0.25, 0.5, 0.75, 1, 0.75, 0.5, 0.25, 0.5][frame] ?? 1;
    for (const c of this._coins) {
      if (!c.active) continue;
      const sx = c.x - camera.x;
      const sy = c.y - camera.y;
      if (sx < -40 || sx > camera.width + 40 || sy < -40 || sy > camera.height + 40) continue;

      ctx.save();
      ctx.translate(sx, sy);
      ctx.scale(squash, 1);

      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(0,0,0,0.35)";
      ctx.fillStyle = "#ffd24a";
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(255,255,255,0.55)";
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Signpost placeholder (goal) at far right
    const gx = this.width - 120 - camera.x;
    const gy = 300 - camera.y;
    ctx.fillStyle = "#202025";
    ctx.fillRect(gx + 36, gy - 60, 8, 60);
    ctx.fillStyle = "#ffd24a";
    ctx.beginPath();
    ctx.arc(gx + 40, gy - 70, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#111";
    ctx.fillText("GO", gx + 30, gy - 66);
  }
}

