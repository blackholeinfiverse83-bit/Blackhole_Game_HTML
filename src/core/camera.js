import { clamp, lerp, sign } from "./math.js";

export class Camera {
  constructor({ width, height }) {
    this.width = width;
    this.height = height;

    this.x = 0;
    this.y = 0;

    this.deadZoneX = 60;
    this.deadZoneY = 80;

    this.lookAhead = 20;
    this._target = null;
    this._bounds = { left: 0, right: 0, top: 0, bottom: 0 };
  }

  follow(target) {
    this._target = target;
  }

  setBounds(bounds) {
    this._bounds = bounds;
  }

  update(dt, level) {
    if (!this._target) return;

    const target = this._target;
    const centerX = this.x + this.width / 2;
    const centerY = this.y + this.height / 2;

    const speed = Math.abs(target.vx);
    const dzX = speed > 8 ? 100 : this.deadZoneX;
    const lead = sign(target.vx) * (speed > 8 ? this.lookAhead : 0);

    const desiredX = target.x + lead;
    const desiredY = target.y;

    let nextX = this.x;
    let nextY = this.y;

    if (desiredX < centerX - dzX) nextX = this.x - (centerX - dzX - desiredX);
    if (desiredX > centerX + dzX) nextX = this.x + (desiredX - (centerX + dzX));

    if (desiredY < centerY - this.deadZoneY)
      nextY = this.y - (centerY - this.deadZoneY - desiredY);
    if (desiredY > centerY + this.deadZoneY)
      nextY = this.y + (desiredY - (centerY + this.deadZoneY));

    // Smooth follow: slightly slower vertically, a bit faster when falling.
    const lerpX = 1 - Math.pow(0.001, dt); // ~0.1 at 60fps
    const lerpYBase = 1 - Math.pow(0.0005, dt);
    const lerpY = target.vy > 0 ? lerpYBase * 1.35 : lerpYBase;

    this.x = lerp(this.x, nextX, lerpX);
    this.y = lerp(this.y, nextY, lerpY);

    const b = this._bounds;
    this.x = clamp(this.x, b.left, b.right);
    this.y = clamp(this.y, b.top, b.bottom);
  }

  worldToScreen(wx, wy) {
    return { x: wx - this.x, y: wy - this.y };
  }
}

