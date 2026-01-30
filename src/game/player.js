import { INPUT, PHYS } from "../core/constants.js";
import { clamp, rectFromCenterBottom, sign } from "../core/math.js";

export class Player {
  constructor({ x, y }) {
    this.x = x;
    this.y = y;

    this.vx = 0;
    this.vy = 0;

    this.grounded = false;
    this._coyoteUntil = 0;

    this.rolling = false;

    // Stats placeholders for HUD (rings/score later).
    this.rings = 0;
    this.score = 0;
    this.lives = 3;
  }

  respawn({ x, y }) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.grounded = false;
    this._coyoteUntil = 0;
    this.rolling = false;
  }

  getHitbox() {
    // Standing hitbox is center-bottom anchored.
    if (this.rolling) {
      // Rolling/jumping hitbox: smaller height; keep bottom aligned.
      return rectFromCenterBottom(this.x, this.y, 30, 30);
    }
    return rectFromCenterBottom(this.x, this.y, 20, 40);
  }

  update(dt, input, level, nowSeconds) {
    const frameScale = dt * 60;

    // --- Jump buffering + coyote time ---
    const canJump = this.grounded || nowSeconds <= this._coyoteUntil;
    if (input.jumpBuffered(nowSeconds) && canJump) {
      this._doJump(input);
      input.consumeJumpBuffer();
    }

    // Variable jump height (cut)
    if (input.jumpReleasedThisFrame() && this.vy < 0) {
      this.vy *= PHYS.jumpCutMultiplier;
    }

    // --- Horizontal control ---
    const left = input.left();
    const right = input.right();
    const down = input.down();

    // Enter roll
    if (this.grounded && !this.rolling && down && Math.abs(this.vx) > 0.5) {
      this.rolling = true;
    }

    if (this.rolling) {
      // No active acceleration while rolling; only friction/roll decel.
      const vxSign = sign(this.vx);
      const absVx = Math.abs(this.vx);
      const decel = PHYS.rollDecelFlat * frameScale;
      const nextAbs = Math.max(0, absVx - decel);
      this.vx = nextAbs * vxSign;

      // Apply roll friction (slightly multiplicative).
      this.vx *= 1 - PHYS.rollFriction;

      if (!this.grounded) {
        // In air, keep rolling hitbox, but allow slight air control.
        this._applyAirControl(frameScale, left, right);
      }

      // Exit roll if slowed enough on ground.
      if (this.grounded && Math.abs(this.vx) < 0.5) {
        this.rolling = false;
      }
    } else if (this.grounded) {
      // Ground movement per spec: accel if pressing, friction when not.
      if (left !== right) {
        const dir = left ? -1 : 1;
        const sameDir = sign(this.vx) === dir || this.vx === 0;
        if (sameDir) {
          this.vx += dir * PHYS.groundAccel * frameScale;
        } else {
          // Skid / quick direction change
          this.vx += dir * PHYS.groundDecel * frameScale;
        }
        this.vx = clamp(this.vx, -PHYS.topSpeed, PHYS.topSpeed);
      } else {
        // Friction
        this.vx *= 1 - PHYS.groundFriction;
        if (Math.abs(this.vx) < 0.05) this.vx = 0;
      }
    } else {
      this._applyAirControl(frameScale, left, right);
    }

    // --- Gravity ---
    if (!this.grounded) {
      this.vy += PHYS.gravity * frameScale;
      if (this.vy > PHYS.terminalVel) this.vy = PHYS.terminalVel;
    }

    // --- Integrate ---
    this.x += this.vx * frameScale;
    this.y += this.vy * frameScale;

    // --- Collide with level (simple rectangles for phase 1) ---
    this._collideWithLevel(level, nowSeconds);
  }

  _applyAirControl(frameScale, left, right) {
    if (left === right) return;
    const dir = left ? -1 : 1;
    this.vx += dir * PHYS.airAccel * frameScale;

    // "Cannot exceed TOP_SPEED in normal air movement" (but can keep higher if already high).
    if (Math.abs(this.vx) < PHYS.topSpeed) {
      this.vx = clamp(this.vx, -PHYS.topSpeed, PHYS.topSpeed);
    }
  }

  _doJump(input) {
    this.grounded = false;
    this.vy = -PHYS.jumpVel;
    // If rolling, maintain horizontal velocity (already does).
    // Optional: small "jump buffer consume" handled by caller.
  }

  _collideWithLevel(level, nowSeconds) {
    // Clamp within level bounds horizontally.
    this.x = clamp(this.x, 0 + 20, level.width - 20);

    // Resolve collisions against platforms and ground (treated as solids from above).
    // For Phase 1 we only do "ground from above" + "walls" against platform edges.
    const hb = this.getHitbox();

    // 1) Ground collision
    this.grounded = false;

    // Build a list of candidate solids: ground + platforms.
    const solids = level.getSolidsNear(hb);

    // First resolve vertical (landing).
    for (const s of solids) {
      // Only consider landing on top when falling.
      if (this.vy >= 0) {
        const prevBottom = hb.y + hb.h - this.vy; // approximate previous bottom
        const nextBottom = hb.y + hb.h;
        const onTopCross =
          prevBottom <= s.y && nextBottom >= s.y && hb.x + hb.w > s.x && hb.x < s.x + s.w;
        if (onTopCross) {
          // Land
          this.y = s.y; // since y is bottom anchor
          this.vy = 0;
          this.grounded = true;
          this._coyoteUntil = nowSeconds + INPUT.coyoteSeconds;
        }
      }
    }

    // If grounded, ensure we aren't stuck inside ground (simple snap).
    // Recompute hb after possible y change.
    const hb2 = this.getHitbox();

    // 2) Simple wall push-out (only if intersecting).
    for (const s of solids) {
      if (
        hb2.x < s.x + s.w &&
        hb2.x + hb2.w > s.x &&
        hb2.y < s.y + s.h &&
        hb2.y + hb2.h > s.y
      ) {
        // Resolve minimally in X (since Y resolved already).
        const overlapLeft = hb2.x + hb2.w - s.x;
        const overlapRight = s.x + s.w - hb2.x;
        if (overlapLeft < overlapRight) {
          this.x -= overlapLeft;
        } else {
          this.x += overlapRight;
        }
        this.vx = 0;
      }
    }

    // Pit / bottom clamp (respawn for now).
    if (this.y > level.height + 200) {
      this.respawn({ x: 80, y: 220 });
    }
  }

  render(ctx, camera) {
    const p = camera.worldToScreen(this.x, this.y);

    // Simple placeholder "Sonic-like" shape.
    // Body
    ctx.save();
    ctx.translate(p.x, p.y);

    // Shadow
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.ellipse(0, 6, 18, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    if (this.rolling || !this.grounded) {
      ctx.fillStyle = "#1b4dff";
      ctx.beginPath();
      ctx.arc(0, -15, 15, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "rgba(255,255,255,0.25)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, -15, 11, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      // Standing capsule
      ctx.fillStyle = "#1b4dff";
      ctx.beginPath();
      ctx.roundRect(-10, -40, 20, 40, 10);
      ctx.fill();

      // Face
      ctx.fillStyle = "#ffd1a6";
      ctx.beginPath();
      ctx.roundRect(-7, -28, 14, 14, 6);
      ctx.fill();
    }

    ctx.restore();
  }
}

