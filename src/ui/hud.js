function pad6(n) {
  const s = String(Math.max(0, Math.floor(n)));
  return s.padStart(6, "0");
}

function formatTime(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export class Hud {
  render(ctx, { state, timeSeconds, player }) {
    ctx.save();

    // Retro-ish HUD styling
    ctx.font = "bold 18px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
    ctx.textBaseline = "top";
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(0,0,0,0.55)";
    ctx.fillStyle = "#ffe04a";

    const x = 18;
    const y = 14;

    const score = `SCORE: ${pad6(player.score)}`;
    const time = `TIME:  ${formatTime(timeSeconds)}`;
    const rings = `RINGS: ${player.rings}`;

    ctx.strokeText(score, x, y);
    ctx.fillText(score, x, y);
    ctx.strokeText(time, x, y + 22);
    ctx.fillText(time, x, y + 22);

    const ringsColor = player.rings === 0 ? "#ff4a4a" : "#ffe04a";
    ctx.strokeText(rings, x, y + 44);
    ctx.fillStyle = ringsColor;
    ctx.fillText(rings, x, y + 44);

    // Overlays
    if (state === "title") {
      this._centerText(ctx, "SONIC-STYLE PROTOTYPE", 0, -42, 34);
      this._centerText(ctx, "Press any movement or JUMP to start", 0, 10, 18);
    } else if (state === "paused") {
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.globalAlpha = 1;
      this._centerText(ctx, "PAUSED", 0, -10, 36);
      this._centerText(ctx, "Press Enter / P to resume", 0, 30, 18);
    }

    ctx.restore();
  }

  _centerText(ctx, text, dx, dy, size) {
    ctx.save();
    ctx.font = `bold ${size}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(0,0,0,0.6)";
    ctx.fillStyle = "#fff";
    const cx = ctx.canvas.width / 2 + dx;
    const cy = ctx.canvas.height / 2 + dy;
    ctx.strokeText(text, cx, cy);
    ctx.fillText(text, cx, cy);
    ctx.restore();
  }
}

