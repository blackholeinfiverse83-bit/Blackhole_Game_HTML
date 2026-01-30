(() => {
  // =========================
  // core/math
  // =========================
  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }
  function lerp(a, b, t) {
    return a + (b - a) * t;
  }
  function sign(v) {
    return v < 0 ? -1 : v > 0 ? 1 : 0;
  }
  function rectFromCenterBottom(centerX, bottomY, w, h) {
    return { x: centerX - w / 2, y: bottomY - h, w, h };
  }
  function aabbIntersects(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  // =========================
  // core/constants
  // =========================
  const GAME = Object.freeze({
    targetFps: 60,
    fixedDt: 1 / 60,
    maxDt: 1 / 20,
  });

  // Values are in "pixels per frame" units; we scale by (dt * 60).
  const PHYS = Object.freeze({
    gravity: 0.21875,
    terminalVel: 16,
    topSpeed: 6,
    maxSpeedRolling: 16,
    groundAccel: 0.046875,
    groundDecel: 0.5,
    groundFriction: 0.046875,
    airAccel: 0.09375,
    jumpVel: 6.5,
    jumpCutMultiplier: 0.5,
    rollFriction: 0.0234375,
    rollDecelFlat: 0.125,
  });

  // =========================
  // core/audio (simple hooks)
  // =========================
  const AUDIO_ENABLED = typeof window !== "undefined" && "Audio" in window;
  const SFX = AUDIO_ENABLED
    ? {
        coin: new Audio("audio/sfx_coin.wav.mp3"),
        power: new Audio("audio/sfx_power.wav.mp3"),
        spring: new Audio("audio/sfx_power.wav.mp3"),
        shoot: new Audio("audio/sfx_shoot.wav.mp3"),
        enemyHit: new Audio("audio/sfx_enemy_hit.wav.mp3"),
        bossHit: new Audio("audio/sfx_boss_hit.wav.mp3"),
        bossExplode: new Audio("audio/sfx_boss_explode.wav.mp3"),
        magnetDeactivate: (() => {
          const a = new Audio("audio/sfx_power.wav.mp3");
          a.volume = 0.45;
          return a;
        })(),
      }
    : {};
  const MUSIC = AUDIO_ENABLED ? new Audio("audio/music_loop.mp3") : null;
  const MUSIC_VOLUME = 0.4;
  let musicMuted = false;
  let sfxMuted = false;
  if (MUSIC) {
    MUSIC.loop = true;
    MUSIC.volume = MUSIC_VOLUME;
  }

  function setMusicMuted(muted) {
    musicMuted = muted;
    if (MUSIC) MUSIC.volume = muted ? 0 : MUSIC_VOLUME;
  }
  function setSfxMuted(muted) {
    sfxMuted = muted;
  }
  function getMusicMuted() {
    return musicMuted;
  }
  function getSfxMuted() {
    return sfxMuted;
  }

  function playSound(name) {
    if (sfxMuted) return;
    const a = SFX[name];
    if (!a) return;
    try {
      a.currentTime = 0;
      a.play().catch(() => {});
    } catch {
      // ignore autoplay / file errors
    }
  }

  function startMusicOnce() {
    if (!MUSIC || MUSIC._started) return;
    MUSIC._started = true;
    MUSIC.play().catch(() => {});
  }

  const INPUT_CONST = Object.freeze({
    jumpBufferSeconds: 5 / 60,
    coyoteSeconds: 6 / 60,
  });

  // =========================
  // core/input
  // =========================
  const DEFAULT_BINDINGS = Object.freeze({
    left: ["ArrowLeft", "KeyA", "TouchLeft"],
    right: ["ArrowRight", "KeyD", "TouchRight"],
    down: ["ArrowDown", "KeyS"],
    up: ["ArrowUp", "KeyW"],
    jump: ["Space", "KeyZ", "KeyX", "KeyC", "ShiftLeft", "ShiftRight", "TouchJump"],
    shoot: ["KeyF", "ControlLeft", "ControlRight", "TouchShoot"],
    shield: ["KeyE", "TouchShield"],
    pause: ["Enter", "KeyP", "TouchPause"],
    reset: ["KeyR"],
    musicMute: ["Digit1"],
    musicUnmute: ["Digit2"],
  });

  class InputHandler {
    constructor(target = window, bindings = DEFAULT_BINDINGS) {
      this.bindings = bindings;
      this._down = new Set();
      this._pressedThisFrame = new Set();
      this._releasedThisFrame = new Set();
      this._jumpBufferedUntil = 0;
      this._jumpReleasedThisFrame = false;
      this._levelSelectIndex = null;

      target.addEventListener("keydown", (e) => {
        if (e.repeat) return;
        this._down.add(e.code);
        this._pressedThisFrame.add(e.code);

        // Capture level select keys (1–9, 0) for title screen.
        if (e.code.startsWith("Digit")) {
          const n = e.code === "Digit0" ? 10 : Number(e.key);
          if (!Number.isNaN(n)) {
            const idx = (n - 1 + 10) % 10;
            this._levelSelectIndex = idx;
          }
        }
      });
      target.addEventListener("keyup", (e) => {
        this._down.delete(e.code);
        this._releasedThisFrame.add(e.code);
      });
    }

    beginFrame(nowSeconds) {
      this._jumpReleasedThisFrame = this._anyJustReleased("jump");
      if (this._anyJustPressed("jump")) {
        this._jumpBufferedUntil = nowSeconds + INPUT_CONST.jumpBufferSeconds;
      }
    }

    endFrame() {
      this._pressedThisFrame.clear();
      this._releasedThisFrame.clear();
      // Leave _levelSelectIndex so title screen can still read last choice.
    }

    left() {
      return this._anyDown("left");
    }
    right() {
      return this._anyDown("right");
    }
    leftPressed() {
      return this._anyJustPressed("left");
    }
    rightPressed() {
      return this._anyJustPressed("right");
    }
    down() {
      return this._anyDown("down");
    }
    up() {
      return this._anyDown("up");
    }
    shootPressed() {
      return this._anyJustPressed("shoot");
    }
    shieldPressed() {
      return this._anyJustPressed("shield");
    }
    pausePressed() {
      return this._anyJustPressed("pause");
    }
    resetPressed() {
      return this._anyJustPressed("reset");
    }
    musicMutePressed() {
      return this._anyJustPressed("musicMute");
    }
    musicUnmutePressed() {
      return this._anyJustPressed("musicUnmute");
    }
    jumpBuffered(nowSeconds) {
      return nowSeconds <= this._jumpBufferedUntil;
    }
    consumeJumpBuffer() {
      this._jumpBufferedUntil = 0;
    }
    jumpReleasedThisFrame() {
      return this._jumpReleasedThisFrame;
    }

    consumeLevelSelect() {
      const v = this._levelSelectIndex;
      this._levelSelectIndex = null;
      return v;
    }

    setVirtualKey(code, pressed) {
      if (pressed) {
        this._down.add(code);
        this._pressedThisFrame.add(code);
      } else {
        this._down.delete(code);
        this._releasedThisFrame.add(code);
      }
    }

    _anyDown(action) {
      for (const code of this.bindings[action] || []) {
        if (this._down.has(code)) return true;
      }
      return false;
    }
    _anyJustPressed(action) {
      for (const code of this.bindings[action] || []) {
        if (this._pressedThisFrame.has(code)) return true;
      }
      return false;
    }
    _anyJustReleased(action) {
      for (const code of this.bindings[action] || []) {
        if (this._releasedThisFrame.has(code)) return true;
      }
      return false;
    }
  }

  // =========================
  // core/camera – smooth dynamic follow (Sonic-style)
  // =========================
  class Camera {
    constructor({ width, height }) {
      this.width = width;
      this.height = height;
      this.x = 0;
      this.y = 0;
      this._target = null;
      this._bounds = { left: 0, right: 0, top: 0, bottom: 0 };
      // Tuning: look-ahead in movement direction (pixels)
      this.lookAheadBase = 25;
      this.lookAheadMax = 80;
      // Hero vertical offset from screen center: positive = hero slightly lower on screen (see more above)
      this.heroOffsetYGround = 15;
      this.heroOffsetYAir = 45;
      // Damping: higher = snappier. X fast, Y varies by state.
      this.smoothSpeedX = 6;
      this.smoothSpeedYGround = 2.2;
      this.smoothSpeedYAir = 5.5;
      this.smoothSpeedYLaunch = 11;
    }

    follow(target) {
      this._target = target;
    }
    setBounds(bounds) {
      this._bounds = bounds;
    }

    update(dt) {
      if (!this._target) return;
      const t = this._target;
      const w = this.width;
      const h = this.height;

      // —— Desired camera center (world space) ——
      // X: hero + look-ahead in movement direction (see upcoming platforms/enemies)
      const speedX = Math.abs(t.vx);
      const lookAhead = this.lookAheadBase + Math.min(speedX * 3, this.lookAheadMax - this.lookAheadBase);
      const desiredCenterX = t.x + sign(t.vx) * lookAhead;

      // Y: hero position minus offset so hero sits at (center + offset) on screen
      // When jumping, use larger offset so hero is slightly lower on screen and we see more above
      const inAir = !t.grounded;
      const isLaunch = (t.springLaunchTimer && t.springLaunchTimer > 0) || t.vy < -7;
      const heroOffsetY = inAir ? this.heroOffsetYAir : this.heroOffsetYGround;
      const desiredCenterY = t.y + heroOffsetY;

      // Desired camera position (top-left of viewport)
      let desiredX = desiredCenterX - w / 2;
      let desiredY = desiredCenterY - h / 2;

      // —— Smooth damping (exponential ease toward desired) ——
      // Vertical follow speed: much faster during spring/high jump so camera doesn't lag
      let speedY = this.smoothSpeedYGround;
      if (inAir) {
        speedY = isLaunch ? this.smoothSpeedYLaunch : this.smoothSpeedYAir;
      }
      const dampX = 1 - Math.exp(-this.smoothSpeedX * dt);
      const dampY = 1 - Math.exp(-speedY * dt);

      this.x = lerp(this.x, desiredX, dampX);
      this.y = lerp(this.y, desiredY, dampY);

      // Clamp within level bounds (no snap, we already moved smoothly)
      const b = this._bounds;
      this.x = clamp(this.x, b.left, b.right);
      this.y = clamp(this.y, b.top, b.bottom);

      // Integer camera position = crisp rendering, no subpixel jitter
      this.x = Math.round(this.x);
      this.y = Math.round(this.y);
    }

    worldToScreen(wx, wy) {
      return { x: wx - this.x, y: wy - this.y };
    }
  }

  // =========================
  // game/player
  // =========================
  class Player {
    constructor({ x, y }) {
      this.x = x;
      this.y = y;
      this.spawnX = x;
      this.spawnY = y;
      this.vx = 0;
      this.vy = 0;
      this.grounded = false;
      this._coyoteUntil = 0;
      this.rolling = false;
      this.rings = 0;
      this.score = 0;
      this.lives = 5;
      this.invuln = 0;
      this.jumpsRemaining = 2;
      this.hasGunPower = false; // permanently unlocked after green coin, until death
      this.gunCooldown = 0; // time until next shot
      this.powerFlash = 0; // brief flash when gaining power
      this.shootFlash = 0; // brief flash when shooting
      this.comboCount = 0;
      this.comboTimer = 0;
      // Blue shield system
      this.hasShieldPower = false; // unlocked after blue coin
      this.shieldActive = false; // manually activated with E key
      this.shieldHits = 0; // current hits absorbed
      this.shieldMaxHits = 5; // shield breaks after this many hits
      this.shieldShatter = 0; // timer for shatter effect
      this.springLaunchTimer = 0; // trail effect after spring launch
      this.facing = 1; // 1 = right, -1 = left (for drawing)
      // Mario-style growth: start small, become big via fruit from power boxes
      this.isBig = false;
      this.growthTransformTimer = 0; // flash/scale-up animation when growing
      this.magnetTimer = 0; // coin magnet: lasts exactly 8s, reset on re-collect (no stacking)
    }

    respawn({ x, y }) {
      this.x = x;
      this.y = y;
      this.vx = 0;
      this.vy = 0;
      this.grounded = false;
      this._coyoteUntil = 0;
      this.rolling = false;
      this.invuln = 0;
      this.jumpsRemaining = 2;
      this.hasGunPower = false; // reset on respawn/death
      this.gunCooldown = 0;
      this.powerFlash = 0;
      this.shootFlash = 0;
      this.comboCount = 0;
      this.comboTimer = 0;
      // Reset shield
      this.hasShieldPower = false;
      this.shieldActive = false;
      this.shieldHits = 0;
      this.shieldShatter = 0;
      this.springLaunchTimer = 0;
      this.isBig = false;
      this.growthTransformTimer = 0;
      this.magnetTimer = 0;
    }

    setSpawn({ x, y }) {
      this.spawnX = x;
      this.spawnY = y;
    }

    takeHit(knockDir = 1) {
      if (this.invuln > 0) return;

      // Shield absorbs damage first
      if (this.shieldActive && this.hasShieldPower) {
        this.shieldHits += 1;
        if (this.shieldHits >= this.shieldMaxHits) {
          this.shieldActive = false;
          this.shieldShatter = 0.5;
          playSound("enemyHit");
        } else {
          playSound("enemyHit");
        }
        return;
      }

      if (this.rings > 0) {
        this.rings = 0;
        this.invuln = 1.0;
        this.vx = -knockDir * 2.5;
        this.vy = -4.5;
        this.grounded = false;
        return;
      }

      // Big hero: revert to small (classic Mario rule); small hero: lose life
      if (this.isBig) {
        this.isBig = false;
        this.invuln = 1.2;
        this.vx = -knockDir * 3;
        this.vy = -5;
        this.grounded = false;
        playSound("enemyHit");
        return;
      }

      this.lives -= 1;
      this.invuln = 1.0;
      this.respawn({ x: this.spawnX, y: this.spawnY });
    }

    addComboScore(base) {
      // Simple combo: each quick successive kill within 1.5s increases multiplier.
      const nowCombo = this.comboTimer > 0 ? this.comboCount + 1 : 1;
      this.comboCount = nowCombo;
      this.comboTimer = 1.5;
      const mult = 1 + (nowCombo - 1) * 0.5;
      this.score += Math.floor(base * mult);
    }

    getHitbox() {
      // Small hero: reduced height/collider; big hero: full size
      const w = this.isBig ? 20 : 16;
      const h = this.isBig ? 40 : 28;
      if (this.rolling) {
        const rw = this.isBig ? 30 : 24;
        const rh = this.isBig ? 30 : 24;
        return rectFromCenterBottom(this.x, this.y, rw, rh);
      }
      return rectFromCenterBottom(this.x, this.y, w, h);
    }

    update(dt, input, level, nowSeconds) {
      const frameScale = dt * 60;
      if (this.invuln > 0) this.invuln = Math.max(0, this.invuln - dt);

      if (this.gunCooldown > 0) {
        this.gunCooldown = Math.max(0, this.gunCooldown - dt);
      }
      if (this.powerFlash > 0) {
        this.powerFlash = Math.max(0, this.powerFlash - dt);
      }
      if (this.shootFlash > 0) {
        this.shootFlash = Math.max(0, this.shootFlash - dt);
      }
      if (this.comboTimer > 0) {
        this.comboTimer = Math.max(0, this.comboTimer - dt);
        if (this.comboTimer === 0) this.comboCount = 0;
      }
      if (this.shieldShatter > 0) {
        this.shieldShatter = Math.max(0, this.shieldShatter - dt);
      }
      if (this.springLaunchTimer > 0) {
        this.springLaunchTimer = Math.max(0, this.springLaunchTimer - dt);
      }
      if (this.growthTransformTimer > 0) {
        this.growthTransformTimer = Math.max(0, this.growthTransformTimer - dt);
      }
      if (this.magnetTimer > 0) {
        this.magnetTimer = Math.max(0, this.magnetTimer - dt);
      }

      // Shield toggle with E key (only if shield power unlocked)
      if (this.hasShieldPower && input.shieldPressed()) {
        if (this.shieldActive) {
          // Deactivate shield
          this.shieldActive = false;
          this.shieldShatter = 0.3; // brief shatter effect
        } else {
          // Activate shield (reset hits if broken)
          this.shieldActive = true;
          if (this.shieldHits >= this.shieldMaxHits) {
            this.shieldHits = 0; // reset if it was broken
          }
        }
      }

      if (input.jumpBuffered(nowSeconds)) {
        const canGroundJump = this.grounded || nowSeconds <= this._coyoteUntil;
        if (canGroundJump) {
          this._doJump();
          this.jumpsRemaining = 1; // allow one extra jump in air
          input.consumeJumpBuffer();
        } else if (!this.grounded && this.jumpsRemaining > 0) {
          this._doDoubleJump();
          this.jumpsRemaining = 0;
          input.consumeJumpBuffer();
        }
      }

      if (input.jumpReleasedThisFrame() && this.vy < 0) {
        this.vy *= PHYS.jumpCutMultiplier;
      }

      const left = input.left();
      const right = input.right();
      const down = input.down();

      if (this.grounded && !this.rolling && down && Math.abs(this.vx) > 0.5) {
        this.rolling = true;
      }

      // Instant horizontal movement: move only while key held, stop immediately on release.
      if (this.rolling) {
        if (left !== right) {
          const dir = left ? -1 : 1;
          this.vx = dir * PHYS.topSpeed;
        } else {
          this.vx = 0;
          if (this.grounded) this.rolling = false;
        }
      } else if (this.grounded) {
        if (left !== right) {
          const dir = left ? -1 : 1;
          this.vx = dir * PHYS.topSpeed;
        } else {
          this.vx = 0;
        }
      } else {
        // In air: same instant response
        if (left !== right) {
          const dir = left ? -1 : 1;
          this.vx = dir * PHYS.topSpeed;
        } else {
          this.vx = 0;
        }
      }

      if (!this.grounded) {
        this.vy += PHYS.gravity * frameScale;
        if (this.vy > PHYS.terminalVel) this.vy = PHYS.terminalVel;
      }

      this.x += this.vx * frameScale;
      this.y += this.vy * frameScale;
      if (this.vx !== 0) this.facing = this.vx > 0 ? 1 : -1;

      this._collideWithLevel(level, nowSeconds);
    }

    _applyAirControl(frameScale, left, right) {
      if (left === right) return;
      const dir = left ? -1 : 1;
      this.vx += dir * PHYS.airAccel * frameScale;
      if (Math.abs(this.vx) < PHYS.topSpeed) {
        this.vx = clamp(this.vx, -PHYS.topSpeed, PHYS.topSpeed);
      }
    }

    _doJump() {
      this.grounded = false;
      this.vy = -PHYS.jumpVel;
    }

    _doDoubleJump() {
      this.grounded = false;
      // Slightly reduced power for the second jump so it feels controlled.
      this.vy = -PHYS.jumpVel * 0.85;
    }

    _collideWithLevel(level, nowSeconds) {
      this.x = clamp(this.x, 20, level.width - 20);

      const hb = this.getHitbox();
      this.grounded = false;
      const solids = level.getSolidsNear(hb);

      for (const s of solids) {
        if (this.vy >= 0) {
          const prevBottom = hb.y + hb.h - this.vy;
          const nextBottom = hb.y + hb.h;
          const onTopCross =
            prevBottom <= s.y &&
            nextBottom >= s.y &&
            hb.x + hb.w > s.x &&
            hb.x < s.x + s.w;
          if (onTopCross) {
            this.y = s.y;
            this.vy = 0;
            this.grounded = true;
            this._coyoteUntil = nowSeconds + INPUT_CONST.coyoteSeconds;
            this.jumpsRemaining = 2;
          }
        }
      }

      const hb2 = this.getHitbox();
      for (const s of solids) {
        const intersects =
          hb2.x < s.x + s.w &&
          hb2.x + hb2.w > s.x &&
          hb2.y < s.y + s.h &&
          hb2.y + hb2.h > s.y;
        if (!intersects) continue;

        const overlapLeft = hb2.x + hb2.w - s.x;
        const overlapRight = s.x + s.w - hb2.x;
        if (overlapLeft < overlapRight) this.x -= overlapLeft;
        else this.x += overlapRight;
        this.vx = 0;
      }

      if (this.y > level.height + 200) {
        this.takeHit(1);
      }
    }

    render(ctx, camera) {
      const p = camera.worldToScreen(this.x, this.y);
      const t = performance.now() * 0.001;
      const speed = Math.abs(this.vx);
      const isFast = speed > 4;
      const isAir = !this.grounded;
      const isRolling = this.rolling;
      const dir = this.facing;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.scale(dir, 1);

      // Mario-style size: small hero 0.7x, big hero 1x; scale-up animation when growing
      const growthT = this.growthTransformTimer;
      const sizeFrom = 0.7;
      const sizeTo = 1;
      const sizeScale = growthT > 0
        ? sizeFrom + (sizeTo - sizeFrom) * (1 - growthT / 0.6)
        : (this.isBig ? sizeTo : sizeFrom);
      ctx.scale(sizeScale, sizeScale);

      // Blink while invulnerable
      if (this.invuln > 0) {
        const blink = Math.floor(performance.now() / 60) % 2;
        if (blink === 0) ctx.globalAlpha = 0.4;
      }

      // Shadow (slightly stretch when moving fast)
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = "#000";
      ctx.beginPath();
      const shW = 18 + (isFast ? 4 : 0);
      const shH = 6;
      ctx.ellipse(0, 6, shW, shH, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      // Speed trail – blue police energy lines
      if (isFast && this.grounded && !isRolling) {
        const trailW = 8 + Math.min(18, speed * 2);
        const back = -dir * trailW;
        const grad = ctx.createLinearGradient(back, 0, 0, 0);
        grad.addColorStop(0, "rgba(30,80,180,0.4)");
        grad.addColorStop(0.4, "rgba(25,65,150,0.2)");
        grad.addColorStop(1, "rgba(15,40,100,0)");
        ctx.fillStyle = grad;
        ctx.fillRect(back, -28, trailW, 36);
        for (let i = 0; i < 4; i++) {
          ctx.globalAlpha = 0.25 - i * 0.05;
          ctx.fillStyle = "rgba(60,120,220,0.6)";
          ctx.fillRect(back - i * 5, -24 + i * 2, 4, 20 - i * 3);
        }
        ctx.globalAlpha = 1;
      }

      // Spring launch trail – heroic blue energy
      if (this.springLaunchTimer > 0) {
        const st = 1 - this.springLaunchTimer / 0.45;
        for (let i = 0; i < 4; i++) {
          const off = (i + 1) * 8;
          const alpha = (1 - st - i * 0.15) * 0.55;
          if (alpha <= 0) continue;
          ctx.globalAlpha = alpha;
          const grad = ctx.createRadialGradient(0, off, 0, 0, off, 16);
          grad.addColorStop(0, "rgba(40,100,200,0.95)");
          grad.addColorStop(1, "rgba(20,60,140,0)");
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(0, off, 16, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      // —— POLICE HERO: dark blue uniform, silver/black accents ——
      const uniformBlue = "#0d1b3a";
      const uniformBlueMid = "#1a237e";
      const silver = "#b0bec5";
      const silverBright = "#eceff1";
      const black = "#0a0a0f";

      if (isRolling || (isAir && !this.springLaunchTimer)) {
        // Roll pose – dark blue ball, reinforced boot peek
        ctx.fillStyle = uniformBlueMid;
        ctx.beginPath();
        ctx.arc(0, -14, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(176,190,197,0.4)";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = black;
        ctx.fillRect(-6, 0, 12, 4);
        const glow = isFast ? 0.5 + Math.sin(t * 8) * 0.2 : 0.2;
        ctx.fillStyle = `rgba(60,120,200,${glow})`;
        ctx.fillRect(-5, 1, 4, 2);
        ctx.fillRect(1, 1, 4, 2);
      } else {
        // Torso – dark blue police uniform (futuristic sleek)
        ctx.fillStyle = uniformBlue;
        ctx.beginPath();
        ctx.roundRect(-9, -38, 18, 36, 8);
        ctx.fill();
        ctx.fillStyle = uniformBlueMid;
        ctx.fillRect(-8, -36, 16, 8);
        ctx.strokeStyle = "rgba(176,190,197,0.35)";
        ctx.lineWidth = 1;
        ctx.stroke();

        // Police badge on chest
        ctx.fillStyle = silver;
        ctx.strokeStyle = black;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, -32);
        ctx.lineTo(4, -28);
        ctx.lineTo(4, -24);
        ctx.lineTo(0, -22);
        ctx.lineTo(-4, -24);
        ctx.lineTo(-4, -28);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = black;
        ctx.fillRect(-1.5, -29, 3, 3);

        // Utility belt (tech details)
        ctx.fillStyle = black;
        ctx.fillRect(-9, -4, 18, 5);
        ctx.fillStyle = silver;
        ctx.fillRect(-7, -3, 3, 2);
        ctx.fillRect(0, -3, 3, 2);
        ctx.fillRect(5, -3, 3, 2);

        // Tactical gloves – arms
        ctx.fillStyle = black;
        ctx.strokeStyle = silver;
        ctx.lineWidth = 1;
        const armY = -28;
        const runPhase = (t * 12 + (dir > 0 ? 0 : Math.PI)) % (Math.PI * 2);
        const armSwing = this.grounded ? Math.sin(runPhase) * 6 : (this.vy < 0 ? -8 : 4);
        if (this.shootFlash > 0 && this.hasGunPower) {
          ctx.fillRect(dir * 6, armY - 4, dir * 14, 10);
          ctx.fillRect(dir * 18, armY - 2, 6, 6);
          ctx.fillStyle = "rgba(80,200,120,0.8)";
          ctx.fillRect(dir * 17, armY - 1, 4, 4);
        } else {
          ctx.fillRect(dir * (4 + armSwing), armY, 10, 8);
          ctx.fillRect(-dir * (4 + armSwing * 0.5), armY + 2, 8, 7);
        }
        ctx.fillStyle = silver;
        ctx.fillRect(dir * (5 + armSwing), armY + 2, 2, 4);
        ctx.fillRect(-dir * (3 + armSwing * 0.5), armY + 4, 2, 3);

        // Legs & reinforced boots
        ctx.fillStyle = uniformBlueMid;
        ctx.fillRect(-7, 0, 6, 14);
        ctx.fillRect(1, 0, 6, 14);
        ctx.fillStyle = black;
        ctx.fillRect(-7, 10, 6, 6);
        ctx.fillRect(1, 10, 6, 6);
        ctx.strokeStyle = silver;
        ctx.lineWidth = 1;
        ctx.strokeRect(-7, 10, 6, 6);
        ctx.strokeRect(1, 10, 6, 6);
        const bootGlow = isFast ? 0.4 + Math.sin(t * 10) * 0.25 : 0.1;
        ctx.fillStyle = `rgba(60,130,220,${bootGlow})`;
        ctx.fillRect(-6, 12, 3, 2);
        ctx.fillRect(2, 12, 3, 2);

        // Face – visor/sunglasses, disciplined protector look
        const faceY = -34;
        ctx.fillStyle = "#1a1a22";
        ctx.beginPath();
        ctx.ellipse(0, faceY, 8, 9, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = silver;
        ctx.lineWidth = 1;
        ctx.stroke();
        // Visor / tactical glasses (dark with silver frame)
        ctx.fillStyle = "rgba(20,40,80,0.9)";
        ctx.fillRect(-6, faceY - 4, 12, 5);
        ctx.strokeStyle = silver;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-6, faceY - 4, 12, 5);
        ctx.fillStyle = "rgba(40,80,160,0.5)";
        ctx.fillRect(-5, faceY - 3, 4, 3);
        ctx.fillRect(1, faceY - 3, 4, 3);
        // Firm mouth – disciplined expression
        ctx.strokeStyle = "rgba(176,190,197,0.6)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-2, faceY + 4);
        ctx.lineTo(2, faceY + 4);
        ctx.stroke();
      }

      // Green glow when shooting power unlocked (tactical)
      if (this.hasGunPower) {
        const pulse = 1 + Math.sin(t * 8) * 0.06;
        ctx.save();
        ctx.translate(0, -22);
        ctx.scale(pulse, pulse);
        const grad = ctx.createRadialGradient(0, 0, 2, 0, 0, 28);
        grad.addColorStop(0, "rgba(80,220,120,0.75)");
        grad.addColorStop(0.6, "rgba(40,160,80,0.35)");
        grad.addColorStop(1, "rgba(20,100,50,0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, 28, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        ctx.fillStyle = "rgba(100,255,140,0.7)";
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 + t * 0.15;
          const r = 16 + (i % 2) * 4;
          ctx.beginPath();
          ctx.arc(Math.cos(a) * r, -22 + Math.sin(a) * r, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Power-up flash (green tactical)
      if (this.powerFlash > 0) {
        const alpha = this.powerFlash / 0.5;
        ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
        ctx.strokeStyle = "rgba(100,255,140,0.9)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(-12, -44, 24, 46, 10);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // Magnet power-up effect (glow/particles around hero)
      if (this.magnetTimer > 0) {
        const t = performance.now() * 0.003;
        const alpha = Math.min(1, this.magnetTimer / 2);
        ctx.globalAlpha = alpha * 0.4;
        const r = 40 + Math.sin(t * 3) * 6;
        const grad = ctx.createRadialGradient(0, -20, 0, 0, -20, r);
        grad.addColorStop(0, "rgba(100,100,255,0.7)");
        grad.addColorStop(0.6, "rgba(40,40,180,0.4)");
        grad.addColorStop(1, "rgba(20,20,80,0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, -20, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = alpha * 0.8;
        ctx.strokeStyle = "rgba(150,150,255,0.8)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, -20, r - 6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // Growth transformation: glow/flash when small -> big
      if (growthT > 0) {
        const alpha = Math.min(1, growthT / 0.15) * (1 - (0.6 - growthT) / 0.6);
        ctx.globalAlpha = Math.max(0, Math.min(1, alpha * 0.9));
        const grad = ctx.createRadialGradient(0, -20, 2, 0, -20, 45);
        grad.addColorStop(0, "rgba(255,240,180,0.95)");
        grad.addColorStop(0.4, "rgba(255,200,80,0.6)");
        grad.addColorStop(0.8, "rgba(200,150,50,0.2)");
        grad.addColorStop(1, "rgba(255,220,100,0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, -20, 45, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // Police energy barrier – blue shield
      if (this.shieldActive && this.hasShieldPower) {
        const pulse = 1 + Math.sin(t * 10) * 0.05;
        ctx.save();
        ctx.translate(0, -20);
        ctx.scale(pulse, pulse);
        const grad = ctx.createRadialGradient(0, 0, 6, 0, 0, 34);
        grad.addColorStop(0, "rgba(40,100,200,0.85)");
        grad.addColorStop(0.4, "rgba(30,70,160,0.5)");
        grad.addColorStop(1, "rgba(15,40,120,0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, 34, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(100,150,255,0.9)";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, 30, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = "rgba(176,190,197,0.5)";
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(0, 0, 28, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }

      // Shield shatter – police barrier break
      if (this.shieldShatter > 0) {
        const alpha = this.shieldShatter / 0.5;
        ctx.save();
        ctx.translate(0, -20);
        ctx.globalAlpha = alpha;
        for (let i = 0; i < 12; i++) {
          const ang = (i * Math.PI * 2) / 12;
          const dist = 22 + (1 - alpha) * 12;
          ctx.fillStyle = "rgba(60,120,200,0.9)";
          ctx.beginPath();
          ctx.arc(Math.cos(ang) * dist, Math.sin(ang) * dist, 3, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        ctx.restore();
      }

      ctx.restore();
    }
  }

  // =========================
  // levels (10 environments)
  // =========================
  // Task types: coins, flyingEnemies, groundEnemies, springsUsed, bothCoins, bossNoShield, timeLimit
  function getTasksForLevel(levelIndex) {
    const pool = [];
    const coinTargets = [8, 10, 12, 14, 16, 18, 20, 22, 24, 26];
    pool.push({ id: `L${levelIndex}_coins`, type: "coins", target: coinTargets[Math.min(levelIndex, 9)], mandatory: true, description: "Collect gold coins" });
    pool.push({ id: `L${levelIndex}_fly`, type: "flyingEnemies", target: -1, mandatory: levelIndex < 5, description: "Defeat all flying enemies" });
    pool.push({ id: `L${levelIndex}_spring`, type: "springsUsed", target: levelIndex < 4 ? 2 : 3, mandatory: false, description: "Use spring jumps" });
    if (levelIndex >= 2) pool.push({ id: `L${levelIndex}_both`, type: "bothCoins", target: 1, mandatory: false, description: "Collect green & blue coins" });
    if (levelIndex >= 4) pool.push({ id: `L${levelIndex}_boss`, type: "bossNoShield", target: 1, mandatory: false, description: "Defeat boss with shield intact" });
    if (levelIndex >= 3) pool.push({ id: `L${levelIndex}_ground`, type: "groundEnemies", target: -1, mandatory: false, description: "Defeat all ground enemies" });
    if (levelIndex >= 5) pool.push({ id: `L${levelIndex}_time`, type: "timeLimit", target: [120, 150, 140, 180, 160, 200][levelIndex % 6], mandatory: false, description: "Reach goal in time" });
    const count = Math.min(pool.length, Math.max(2, 2 + (levelIndex % 3)));
    return pool.slice(0, count);
  }

  const LEVEL_DEFS = [
    { name: "Green Plains (Day)", sky: "#8cb4ff", hill: "rgba(47,160,110,0.45)", groundTop: "#2fdc74", dirt: "#a86a2a" },
    { name: "Haunted Hills (Night)", sky: "#070814", hill: "rgba(140,140,255,0.14)", groundTop: "#4fe68a", dirt: "#3b2430" },
    { name: "Forest Grove", sky: "#5dc7ff", hill: "rgba(25,110,65,0.55)", groundTop: "#2fdc74", dirt: "#5c3b22" },
    { name: "Underwater Ruins", sky: "#154064", hill: "rgba(80,160,220,0.45)", groundTop: "#6ad7ff", dirt: "#24405d" },
    { name: "Desert Dunes", sky: "#ffd08a", hill: "rgba(220,160,80,0.35)", groundTop: "#c7ff6a", dirt: "#c08a2a" },
    { name: "Sky Islands", sky: "#bfe6ff", hill: "rgba(255,255,255,0.45)", groundTop: "#e8fff7", dirt: "#6a7a8a" },
    { name: "Lava Caverns", sky: "#2a0b0b", hill: "rgba(255,120,60,0.25)", groundTop: "#ffcc6a", dirt: "#5a1a10" },
    { name: "City Rooftops", sky: "#0a0f2a", hill: "rgba(255,255,255,0.10)", groundTop: "#5dffb0", dirt: "#3a3a44" },
    { name: "Ocean Night", sky: "#062238", hill: "rgba(40,170,220,0.35)", groundTop: "#2fdc74", dirt: "#20485f" },
    { name: "Starship Zone", sky: "#05060d", hill: "rgba(120,255,240,0.12)", groundTop: "#66fff0", dirt: "#2a2a38" },
  ];

  class Enemy {
    constructor({ x, y, range = 120, speed = 0.6, hp = 2 }) {
      this.x = x;
      this.y = y;
      this.w = 32;
      this.h = 28;
      this.baseX = x;
      this.range = range;
      this.speed = speed;
      this.dir = 1;
      this.alive = true;
      this.hp = hp;
      this.maxHp = hp;
      this.hitTimer = 0;
      this.deathTimer = 0;
      this.isFlying = false;
    }

    getAabb() {
      return { x: this.x - this.w / 2, y: this.y - this.h, w: this.w, h: this.h };
    }

    takeHit(amount = 1) {
      if (!this.alive) return;
      this.hp = Math.max(0, this.hp - amount);
      this.hitTimer = 0.2;
      if (this.hp <= 0) {
        this.alive = false;
        this.deathTimer = 0.5;
      }
    }

    update(dt) {
      if (!this.alive) {
        if (this.deathTimer > 0) this.deathTimer = Math.max(0, this.deathTimer - dt);
        return;
      }
      if (this.hitTimer > 0) this.hitTimer = Math.max(0, this.hitTimer - dt);
      const frameScale = dt * 60;
      this.x += this.dir * this.speed * frameScale;
      if (this.x > this.baseX + this.range) this.dir = -1;
      if (this.x < this.baseX - this.range) this.dir = 1;
    }

    render(ctx, camera) {
      const sx = this.x - camera.x;
      const sy = this.y - camera.y;
      ctx.save();
      ctx.translate(sx, sy);

      // Death dissolve – energy particles
      if (!this.alive && this.deathTimer > 0) {
        const t = 1 - this.deathTimer / 0.5;
        for (let i = 0; i < 12; i++) {
          const ang = (i / 12) * Math.PI * 2 + t * 4;
          const dist = 8 + t * 28;
          const alpha = 1 - t;
          ctx.globalAlpha = alpha;
          ctx.fillStyle = i % 3 === 0 ? "rgba(0,255,200,0.9)" : "rgba(160,80,255,0.9)";
          ctx.beginPath();
          ctx.arc(Math.cos(ang) * dist, Math.sin(ang) * dist - 14, 3, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        ctx.restore();
        return;
      }
      if (!this.alive) {
        ctx.restore();
        return;
      }

      const alienT = performance.now() * 0.003;
      // Alien ground creature – organic blob, glowing eyes, claws
      ctx.save();
      if (this.hitTimer > 0) {
        ctx.globalAlpha = 0.7;
        ctx.fillStyle = "rgba(0,255,220,0.8)";
      } else {
        const pulse = 1 + Math.sin(alienT * 4) * 0.04;
        ctx.scale(pulse, 1);
        ctx.fillStyle = "#3d1a6e";
      }
      ctx.beginPath();
      ctx.ellipse(0, -14, 14, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(0,255,200,0.5)";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = "#1a0a2e";
      ctx.beginPath();
      ctx.moveTo(-8, 2);
      ctx.lineTo(-14, 8);
      ctx.lineTo(-6, 6);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(8, 2);
      ctx.lineTo(14, 8);
      ctx.lineTo(6, 6);
      ctx.closePath();
      ctx.fill();

      const eyeGlow = 0.7 + Math.sin(alienT * 6) * 0.3;
      ctx.fillStyle = `rgba(0,255,220,${eyeGlow})`;
      ctx.beginPath();
      ctx.ellipse(-5, -16, 3, 4, 0, 0, Math.PI * 2);
      ctx.ellipse(5, -16, 3, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(-5, -16, 1.5, 0, Math.PI * 2);
      ctx.arc(5, -16, 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.restore();
    }
  }

  class BirdEnemy {
    constructor({ x, y, range = 160, speed = 0.9, amp = 24, hp = 1 }) {
      this.x = x;
      this.y = y;
      this.baseX = x;
      this.baseY = y;
      this.range = range;
      this.speed = speed;
      this.amp = amp;
      this.w = 32;
      this.h = 24;
      this.dir = 1;
      this.t = 0;
      this.alive = true;
      this.hp = hp;
      this.maxHp = hp;
      this.hitTimer = 0;
      this.deathTimer = 0;
      this.isFlying = true;
    }

    getAabb() {
      return { x: this.x - this.w / 2, y: this.y - this.h / 2, w: this.w, h: this.h };
    }

    takeHit(amount = 1) {
      if (!this.alive) return;
      this.hp = Math.max(0, this.hp - amount);
      this.hitTimer = 0.2;
      if (this.hp <= 0) {
        this.alive = false;
        this.deathTimer = 0.5;
      }
    }

    update(dt) {
      if (!this.alive) {
        if (this.deathTimer > 0) this.deathTimer = Math.max(0, this.deathTimer - dt);
        return;
      }
      if (this.hitTimer > 0) this.hitTimer = Math.max(0, this.hitTimer - dt);
      const frameScale = dt * 60;
      this.x += this.dir * this.speed * frameScale;
      if (this.x > this.baseX + this.range) this.dir = -1;
      if (this.x < this.baseX - this.range) this.dir = 1;
      this.t += dt;
      this.y = this.baseY + Math.sin(this.t * 3) * this.amp;
    }

    render(ctx, camera) {
      const sx = this.x - camera.x;
      const sy = this.y - camera.y;
      ctx.save();
      ctx.translate(sx, sy);

      // Death dissolve – energy particles
      if (!this.alive && this.deathTimer > 0) {
        const t = 1 - this.deathTimer / 0.5;
        for (let i = 0; i < 10; i++) {
          const ang = (i / 10) * Math.PI * 2 + t * 3;
          const dist = 6 + t * 22;
          const alpha = 1 - t;
          ctx.globalAlpha = alpha;
          ctx.fillStyle = i % 2 === 0 ? "rgba(0,255,255,0.9)" : "rgba(200,100,255,0.9)";
          ctx.beginPath();
          ctx.arc(Math.cos(ang) * dist, Math.sin(ang) * dist, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        ctx.restore();
        return;
      }
      if (!this.alive) {
        ctx.restore();
        return;
      }

      const droneT = performance.now() * 0.004 + this.t * 2;
      // Flying alien drone – oval body, glowing eyes, energy fins
      if (this.hitTimer > 0) {
        ctx.globalAlpha = 0.7;
        ctx.fillStyle = "rgba(0,255,255,0.8)";
      } else {
        ctx.fillStyle = "#1a2e4a";
      }
      ctx.strokeStyle = "rgba(0,255,255,0.5)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, -2, 12, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "rgba(0,180,220,0.4)";
      ctx.beginPath();
      ctx.ellipse(0, -2, 10, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      const finPulse = 0.6 + Math.sin(droneT) * 0.2;
      ctx.globalAlpha = finPulse;
      ctx.fillStyle = "rgba(0,255,255,0.7)";
      ctx.beginPath();
      ctx.moveTo(-10, -4);
      ctx.lineTo(-20, -2);
      ctx.lineTo(-10, 0);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(10, -4);
      ctx.lineTo(20, -2);
      ctx.lineTo(10, 0);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
      const eyeGlow = 0.8 + Math.sin(droneT * 2) * 0.2;
      ctx.fillStyle = `rgba(0,255,255,${eyeGlow})`;
      ctx.beginPath();
      ctx.ellipse(-4, -4, 2.5, 3, 0, 0, Math.PI * 2);
      ctx.ellipse(4, -4, 2.5, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(-4, -4, 1, 0, Math.PI * 2);
      ctx.arc(4, -4, 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  class Boss {
    constructor({ x, y, levelIndex = 0, maxHp = 10 }) {
      this.x = x;
      this.y = y;
      this.baseX = x;
      this.range = 200 + levelIndex * 10;
      this.w = 96;
      this.h = 96;
      this.maxHp = maxHp;
      this.hp = maxHp;
      this.alive = true;
      this.hurtTimer = 0;
      this.deathTimer = 0;
      this._hitParticles = [];
      this.dir = -1;
      this.attackCooldown = 0;
      this.attackInterval = 2.5 - levelIndex * 0.1;
    }

    getAabb() {
      return { x: this.x - this.w / 2, y: this.y - this.h, w: this.w, h: this.h };
    }

    takeHit(amount = 1) {
      if (!this.alive) return;
      this.hp = Math.max(0, this.hp - amount);
      this.hurtTimer = 0.3;
      const px = this.x;
      const py = this.y - this.h / 2;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + Math.random() * 0.5;
        const sp = 2 + Math.random() * 4;
        this._hitParticles.push({
          x: px,
          y: py,
          vx: Math.cos(a) * sp,
          vy: -Math.abs(Math.sin(a)) * sp - 2,
          life: 0.4,
        });
      }
      if (this.hp <= 0) {
        this.alive = false;
        this.deathTimer = 0.6;
      }
    }

    update(dt, player, level) {
      const frameScale = dt * 60;
      if (this.hurtTimer > 0) this.hurtTimer = Math.max(0, this.hurtTimer - dt);
      for (let i = this._hitParticles.length - 1; i >= 0; i--) {
        const p = this._hitParticles[i];
        p.x += p.vx * frameScale * dt;
        p.y += p.vy * frameScale * dt;
        p.vy += 0.15 * frameScale * dt;
        p.life -= dt;
        if (p.life <= 0) this._hitParticles.splice(i, 1);
      }
      if (!this.alive) {
        this.deathTimer = Math.max(0, this.deathTimer - dt);
        return;
      }
      this.x += this.dir * 0.7 * frameScale;
      if (this.x > this.baseX + this.range) this.dir = -1;
      if (this.x < this.baseX - this.range) this.dir = 1;
      if (this.attackCooldown > 0) {
        this.attackCooldown = Math.max(0, this.attackCooldown - dt);
      } else {
        const dx = player.x - this.x;
        const distX = Math.abs(dx);
        if (distX < 800 && distX > 30) {
          const speed = 5;
          const vx = dx > 0 ? speed : -speed;
          const vy = 0;
          level.spawnBossAttack(this.x, this.y - 40, vx, vy);
          this.attackCooldown = this.attackInterval;
        }
      }
    }

    render(ctx, camera) {
      if (!this.alive && this.deathTimer <= 0) return;
      const sx = this.x - camera.x;
      const sy = this.y - camera.y;
      const bossT = performance.now() * 0.002;

      // Hit effect particles (blood / damage sparks)
      for (const p of this._hitParticles) {
        const px = p.x - camera.x;
        const py = p.y - camera.y;
        if (px < -20 || px > camera.width + 20 || py < -20 || py > camera.height + 20) continue;
        const alpha = p.life / 0.4;
        ctx.save();
        ctx.translate(px, py);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = "#ff4040";
        ctx.beginPath();
        ctx.arc(0, 0, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ff8888";
        ctx.beginPath();
        ctx.arc(0, 0, 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.restore();
      }

      // Death animation: explosion / dissolve
      if (!this.alive && this.deathTimer > 0) {
        const t = 1 - this.deathTimer / 0.6;
        ctx.save();
        ctx.translate(sx, sy);
        for (let i = 0; i < 16; i++) {
          const ang = (i / 16) * Math.PI * 2 + t * 4;
          const dist = 20 + t * 80;
          const alpha = 1 - t;
          ctx.globalAlpha = alpha;
          ctx.fillStyle = i % 2 === 0 ? "rgba(255,60,60,0.95)" : "rgba(200,40,40,0.9)";
          ctx.beginPath();
          ctx.arc(Math.cos(ang) * dist, Math.sin(ang) * dist, 6, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        ctx.restore();
        return;
      }

      ctx.save();
      ctx.translate(sx, sy);
      if (this.hurtTimer > 0) {
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = "rgba(255,80,80,0.8)";
      } else {
        ctx.fillStyle = "#1a0a3e";
      }
      ctx.strokeStyle = "rgba(160,80,255,0.6)";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.roundRect(-this.w / 2, -this.h, this.w, this.h, 18);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "rgba(60,20,100,0.8)";
      ctx.beginPath();
      ctx.roundRect(-this.w / 2 + 6, -this.h + 8, this.w - 12, this.h - 16, 12);
      ctx.fill();
      const eyeGlow = 0.8 + Math.sin(bossT * 3) * 0.2;
      ctx.fillStyle = `rgba(0,255,200,${eyeGlow})`;
      ctx.beginPath();
      ctx.ellipse(-22, -this.h + 28, 12, 14, 0, 0, Math.PI * 2);
      ctx.ellipse(22, -this.h + 28, 12, 14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(-22, -this.h + 28, 5, 0, Math.PI * 2);
      ctx.arc(22, -this.h + 28, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,220,0,0.9)";
      ctx.fillRect(-8, -this.h + 48, 16, 6);
      ctx.strokeStyle = "rgba(160,80,255,0.8)";
      ctx.lineWidth = 2;
      ctx.strokeRect(-this.w / 2 + 4, -this.h + 4, this.w - 8, 20);
      ctx.strokeRect(-this.w / 2 + 4, 4, this.w - 8, 16);
      ctx.globalAlpha = 1;
      ctx.restore();
    }
  }

  class Level {
    constructor(def, index) {
      this.def = def;
      this.index = index;
      // Make all 10 levels noticeably longer so there is more space
      // for extra obstacles, platforms, and enemies.
      this.width = 6200 + index * 520;
      this.height = 900;
      this._clouds = Array.from({ length: 18 }, (_, i) => ({
        x: i * 180 + (i % 3) * 40,
        y: 60 + (i % 5) * 18,
        r: 18 + (i % 4) * 6,
      }));
      this._solids = [];
      this._coins = []; // only populated when released from coin boxes (x, y, vx, vy, active)
      this._coinAnim = 0;
      this._enemies = [];
      this._powerPickups = []; // green/blue power-ups released from power boxes (floating, collect to activate)
      this._powerCoinAnim = 0;
      this._bullets = [];
      this._boss = null;
      this._bossRewarded = false;
      this._muzzleFlash = null;
      this._bossAttacks = []; // fireballs/explosions
      this._springs = [];
      this._boxes = []; // Mario-style jump-activated: type = coin | power_green | power_blue | growth
      this._fruits = []; // growth fruit from growth boxes
      this._magnetPickups = []; // floor magnet power-ups (8s coin attraction)
      this.goalX = this.width - 120;
      this._tasks = [];
      this._progress = {};
      this._completedTasks = new Set();
      this._justCompleted = null;
    }

    reset() {
      // Slight variation per level so it feels different.
      const lift = (this.index % 3) * 10;
      const pitWidth = 180 + (this.index % 4) * 40;
      const pitX1 = 980 + (this.index % 5) * 30;
      const pitX2 = pitX1 + pitWidth;
      this._bossRewarded = false;

      this._solids = [
        { x: 0, y: 300 + lift, w: pitX1, h: 600 },
        { x: pitX2, y: 300 + lift, w: this.width - pitX2, h: 600 },

        { x: 320, y: 250 - lift, w: 120, h: 20 },
        { x: 520, y: 220 - lift, w: 140, h: 20 },
        { x: 760, y: 260 - lift, w: 120, h: 20 },
        { x: 1450, y: 210 - lift, w: 260, h: 20 },
      ];

      this._powerPickups = [];
      const baseY = 300 + lift;
      const springBaseX = pitX2 + 400 + this.index * 80;

      const BOX_HEIGHT_ABOVE_GROUND = 48;
      const boxW = 32;
      const boxH = 32;
      const boxY = (platformTopY) => platformTopY - BOX_HEIGHT_ABOVE_GROUND - boxH;

      this._coins = [];
      const floorCoinY = baseY - 10;
      for (let i = 0; i < 14; i++) {
        const gx = 120 + i * 55 + (this.index % 3) * 5;
        if (gx < pitX1 - 40) this._coins.push({ x: gx, y: floorCoinY, vx: 0, vy: 0, active: true, static: true });
      }
      for (let i = 0; i < 12; i++) {
        const gx = pitX2 + 80 + i * 60 + (this.index % 2) * 8;
        if (gx < this.width - 80) this._coins.push({ x: gx, y: floorCoinY, vx: 0, vy: 0, active: true, static: true });
      }

      this._magnetPickups = [];
      const magnetY = baseY - 12;
      this._magnetPickups.push({ x: 420, y: magnetY, collected: false, bob: 0 });
      this._magnetPickups.push({ x: pitX2 + 350 + this.index * 40, y: magnetY, collected: false, bob: 0 });
      this._magnetPickups.push({ x: springBaseX + 350, y: magnetY, collected: false, bob: 0 });
      if (this.index >= 3) this._magnetPickups.push({ x: this.width - 1200, y: magnetY, collected: false, bob: 0 });

      // Springs: classic Sonic-style launch pads (dir: 'up' | 'diag-left' | 'diag-right')
      this._springs = [];
      const springW = 24;
      const springH = 16;
      // On first platform
      this._springs.push({ x: 340, y: 250 - lift, w: springW, h: springH, dir: "up", compress: 0 });
      this._springs.push({ x: 800, y: 260 - lift, w: springW, h: springH, dir: "up", compress: 0 });
      this._springs.push({ x: 1480, y: 210 - lift, w: springW, h: springH, dir: "diag-right", compress: 0 });
      // Mid-level springs
      this._springs.push({ x: springBaseX, y: baseY - 20, w: springW, h: springH, dir: "up", compress: 0 });
      this._springs.push({ x: springBaseX + 380, y: baseY - 80, w: springW, h: springH, dir: "diag-left", compress: 0 });
      this._springs.push({ x: springBaseX + 720, y: baseY - 120, w: springW, h: springH, dir: "up", compress: 0 });
      // Near boss
      this._springs.push({ x: this.width - 800, y: baseY - 40, w: springW, h: springH, dir: "diag-right", compress: 0 });

      // Boxes: elevated above ground (BOX_HEIGHT_ABOVE_GROUND), consistent across levels; hero jumps to hit from below
      const plat1 = 250 - lift;
      const plat2 = 220 - lift;
      const plat3 = 260 - lift;
      const plat4 = 210 - lift;
      this._boxes = [
        { x: 380, y: boxY(plat1), w: boxW, h: boxH, type: "coin", used: false, bounceAnim: 0 },
        { x: 440, y: boxY(plat1), w: boxW, h: boxH, type: "coin", used: false, bounceAnim: 0 },
        { x: 500, y: boxY(plat1), w: boxW, h: boxH, type: "coin", used: false, bounceAnim: 0 },
        { x: 560, y: boxY(plat2), w: boxW, h: boxH, type: "coin", used: false, bounceAnim: 0 },
        { x: 620, y: boxY(plat2), w: boxW, h: boxH, type: "power_green", used: false, bounceAnim: 0 },
        { x: 680, y: boxY(plat2), w: boxW, h: boxH, type: "coin", used: false, bounceAnim: 0 },
        { x: 740, y: boxY(plat3), w: boxW, h: boxH, type: "growth", used: false, bounceAnim: 0 },
        { x: 800, y: boxY(plat3), w: boxW, h: boxH, type: "coin", used: false, bounceAnim: 0 },
        { x: 1100 + this.index * 60, y: boxY(baseY), w: boxW, h: boxH, type: "coin", used: false, bounceAnim: 0 },
        { x: springBaseX + 120, y: boxY(baseY - 20), w: boxW, h: boxH, type: "coin", used: false, bounceAnim: 0 },
        { x: springBaseX + 200, y: boxY(baseY - 20), w: boxW, h: boxH, type: "power_blue", used: false, bounceAnim: 0 },
        { x: springBaseX + 280, y: boxY(baseY - 20), w: boxW, h: boxH, type: "coin", used: false, bounceAnim: 0 },
        { x: springBaseX + 440, y: boxY(baseY - 100), w: boxW, h: boxH, type: "coin", used: false, bounceAnim: 0 },
        { x: springBaseX + 500, y: boxY(baseY - 100), w: boxW, h: boxH, type: "growth", used: false, bounceAnim: 0 },
        { x: springBaseX + 560, y: boxY(baseY - 100), w: boxW, h: boxH, type: "coin", used: false, bounceAnim: 0 },
        { x: springBaseX + 680, y: boxY(baseY - 140), w: boxW, h: boxH, type: "power_green", used: false, bounceAnim: 0 },
        { x: springBaseX + 740, y: boxY(baseY - 140), w: boxW, h: boxH, type: "coin", used: false, bounceAnim: 0 },
      ];

      // Boss near the far right of the level on ground.
      const bossHp = 10 + this.index * 4;
      this._boss = new Boss({
        x: this.width - 260,
        y: baseY,
        levelIndex: this.index,
        maxHp: bossHp,
      });

      // Enemies: more as levels go up (baseline patrols near the start/middle).
      this._enemies = [];
      const enemyCount = 1 + Math.floor(this.index / 2);
      for (let i = 0; i < enemyCount; i++) {
        const ex = 520 + i * 260 + (this.index % 3) * 40;
        const ey = 300 + lift;
        // Most enemies take 2 hits, some take 1
        const hp = (i % 2 === 0) ? 2 : 1;
        this._enemies.push(
          new Enemy({
            x: ex,
            y: ey,
            range: 90 + i * 20,
            speed: 0.55 + this.index * 0.02,
            hp: hp,
          })
        );
      }

      // Add a few flying bird enemies per level (1 HP each).
      const birdCount = 2 + Math.floor(this.index / 3);
      for (let i = 0; i < birdCount; i++) {
        const bx = 900 + this.index * 260 + i * 420;
        const by = 200 - (this.index % 3) * 20 - i * 10;
        this._enemies.push(
          new BirdEnemy({
            x: bx,
            y: by,
            range: 140 + this.index * 12,
            speed: 0.8 + this.index * 0.03,
            amp: 20 + (i % 2) * 10,
            hp: 1,
          })
        );
      }

      // Extra length & obstacles – different pattern per level group so
      // layouts are not the same for every level.
      const layoutType = this.index % 4;

      if (layoutType === 0) {
        // Type A: long staircase and sky route on the right side.
        const extraPitStart = this.width - 1100;
        const extraPitWidth = 220 + (this.index % 3) * 40;
        const lastGround = this._solids.find(
          (s) => s.y === baseY && s.h >= 580 && s.x < this.width - 10
        );
        if (lastGround) {
          const oldRight = lastGround.x + lastGround.w;
          const newRight = extraPitStart;
          const afterPitStart = extraPitStart + extraPitWidth;
          if (afterPitStart < oldRight - 80) {
            lastGround.w = Math.max(0, newRight - lastGround.x);
            this._solids.push({
              x: afterPitStart,
              y: baseY,
              w: oldRight - afterPitStart,
              h: lastGround.h,
            });
          }
        }

        const stepWidth = 140;
        const stepHeight = 20;
        const firstStepX = pitX2 + 120;
        const firstStepY = baseY - 70;
        const steps = 4 + Math.min(4, this.index);
        for (let i = 0; i < steps; i++) {
          this._solids.push({
            x: firstStepX + i * (stepWidth + 40),
            y: firstStepY - i * 30,
            w: stepWidth,
            h: stepHeight,
          });
        }

        const skyY = baseY - 260;
        const skyPlatforms = 3 + Math.min(3, Math.floor(this.index / 2));
        for (let i = 0; i < skyPlatforms; i++) {
          this._solids.push({
            x: firstStepX + 140 + i * 260 + this.index * 40,
            y: skyY + (i % 2 === 0 ? 0 : -40),
            w: 160,
            h: 20,
          });
        }

        const stairCoins = 8 + this.index;
        for (let i = 0; i < stairCoins; i++) {
          const cx = firstStepX + 20 + i * 70;
          const stepTop = firstStepY - i * 30;
          this._boxes.push({ x: cx - boxW / 2, y: boxY(stepTop), w: boxW, h: boxH, type: "coin", used: false, bounceAnim: 0 });
        }

        const skyCoins = 6 + Math.floor(this.index / 2);
        for (let i = 0; i < skyCoins; i++) {
          const cx = firstStepX + 140 + i * 220 + this.index * 30;
          const platTop = skyY + (i % 2 === 0 ? 0 : -40);
          this._boxes.push({ x: cx - boxW / 2, y: boxY(platTop), w: boxW, h: boxH, type: "coin", used: false, bounceAnim: 0 });
        }

        this._enemies.push(
          new Enemy({
            x: firstStepX + 3 * (stepWidth + 40) + this.index * 40,
            y: baseY,
            range: 140 + this.index * 10,
            speed: 0.75 + this.index * 0.03,
            hp: 2,
          }),
          new Enemy({
            x: this.width - 550,
            y: baseY,
            range: 160 + this.index * 8,
            speed: 0.85 + this.index * 0.035,
            hp: 2,
          })
        );
      } else if (layoutType === 1) {
        // Type B: zig-zag mid-air platforms and multiple short pits.
        const segmentStart = pitX2 + 260;
        const pits = 3 + Math.floor(this.index / 2);
        for (let i = 0; i < pits; i++) {
          const pitStart = segmentStart + i * 320;
          const pitW = 120 + (i % 2) * 60;
          this._solids.push({
            x: pitStart + pitW,
            y: baseY,
            w: 200,
            h: 600,
          });
        }

        const platCount = 6 + this.index;
        for (let i = 0; i < platCount; i++) {
          const dirUp = i % 2 === 0;
          this._solids.push({
            x: segmentStart + i * 210,
            y: baseY - 80 - i * 10 * (dirUp ? 1 : -1),
            w: 130,
            h: 20,
          });
        }

        for (let i = 0; i < platCount; i++) {
          const cx = segmentStart + i * 210 + 40;
          const platTop = baseY - 80 - i * 10 * (i % 2 === 0 ? 1 : -1);
          this._boxes.push({ x: cx - boxW / 2, y: boxY(platTop), w: boxW, h: boxH, type: "coin", used: false, bounceAnim: 0 });
        }

        this._enemies.push(
          new Enemy({
            x: segmentStart + 260,
            y: baseY,
            range: 120 + this.index * 12,
            speed: 0.8 + this.index * 0.03,
            hp: 2,
          }),
          new Enemy({
            x: segmentStart + 260 * 3,
            y: baseY - 40,
            range: 140 + this.index * 10,
            speed: 0.85 + this.index * 0.03,
            hp: 1,
          })
        );
      } else if (layoutType === 2) {
        // Type C: tall vertical towers and small floating "stepping stones".
        const towerBase = pitX2 + 220;
        const towerCount = 4 + Math.floor(this.index / 2);
        for (let i = 0; i < towerCount; i++) {
          this._solids.push({
            x: towerBase + i * 320,
            y: baseY - 80 - i * 10,
            w: 80,
            h: 680,
          });
        }

        const stoneCount = 10 + this.index;
        for (let i = 0; i < stoneCount; i++) {
          this._solids.push({
            x: towerBase + 80 + i * 160,
            y: baseY - 180 - (i % 3) * 40,
            w: 90,
            h: 18,
          });
        }

        for (let i = 0; i < stoneCount; i++) {
          const cx = towerBase + 80 + i * 160 + 30;
          const platTop = baseY - 180 - (i % 3) * 40;
          this._boxes.push({ x: cx - boxW / 2, y: boxY(platTop), w: boxW, h: boxH, type: "coin", used: false, bounceAnim: 0 });
        }

        this._enemies.push(
          new Enemy({
            x: towerBase + 160,
            y: baseY,
            range: 150 + this.index * 10,
            speed: 0.8 + this.index * 0.03,
            hp: 2,
          }),
          new Enemy({
            x: towerBase + 160 * 3,
            y: baseY - 60,
            range: 130 + this.index * 8,
            speed: 0.9 + this.index * 0.03,
            hp: 1,
          })
        );
      } else {
        // Type D: high sky path with sparse ground islands.
        const islandBase = pitX2 + 260;
        const islandCount = 4 + Math.floor(this.index / 2);
        for (let i = 0; i < islandCount; i++) {
          this._solids.push({
            x: islandBase + i * 420,
            y: baseY,
            w: 180,
            h: 600,
          });
        }

        const skyPathY = baseY - 260;
        const skyPlats = 6 + this.index;
        for (let i = 0; i < skyPlats; i++) {
          this._solids.push({
            x: islandBase + i * 220,
            y: skyPathY + (i % 2 === 0 ? -30 : 20),
            w: 150,
            h: 20,
          });
        }

        for (let i = 0; i < skyPlats; i++) {
          const cx = islandBase + i * 220 + 50;
          const platTop = skyPathY + (i % 2 === 0 ? -30 : 20);
          this._boxes.push({ x: cx - boxW / 2, y: boxY(platTop), w: boxW, h: boxH, type: "coin", used: false, bounceAnim: 0 });
        }

        this._enemies.push(
          new Enemy({
            x: islandBase + 260,
            y: baseY - 40,
            range: 150 + this.index * 10,
            speed: 0.85 + this.index * 0.03,
            hp: 2,
          }),
          new Enemy({
            x: this.width - 620,
            y: baseY - 80,
            range: 190 + this.index * 8,
            speed: 0.95 + this.index * 0.03,
            hp: 1,
          })
        );
      }

      // Mission tasks: 2–4 per level, varied
      this._tasks = getTasksForLevel(this.index);
      this._progress = {
        coinsCollected: 0,
        flyingKilled: 0,
        flyingTotal: this._enemies.filter((e) => e.isFlying).length,
        groundKilled: 0,
        groundTotal: this._enemies.filter((e) => !e.isFlying).length,
        springsUsed: 0,
        hasPowerCoin: false,
        hasShieldCoin: false,
        bossDefeatedNoShield: false,
        startTime: undefined,
        reachedGoal: false,
        goalReachedTime: undefined,
      };
      for (const t of this._tasks) {
        if (t.type === "flyingEnemies") t.target = this._progress.flyingTotal;
        if (t.type === "groundEnemies") t.target = this._progress.groundTotal;
      }
      this._completedTasks = new Set();
      this._justCompleted = null;
    }

    spawnBullet(x, y, dir) {
      const speed = 12;
      this._bullets.push({
        x,
        y,
        vx: dir * speed,
        life: 1.0,
        dir,
      });
      // Store muzzle flash position for rendering
      this._muzzleFlash = { x, y, dir, time: 0.1 };
    }

    spawnBossAttack(x, y, vx, vy) {
      this._bossAttacks.push({
        x,
        y,
        vx,
        vy,
        life: 3.0,
        r: 12,
      });
    }

    update(dt, player, nowSeconds = 0) {
      const frameScale = dt * 60;
      this._coinAnim = (this._coinAnim + dt * 10) % 8;
      this._powerCoinAnim = (this._powerCoinAnim + dt * 8) % 6;
      if (this._progress.startTime === undefined) this._progress.startTime = nowSeconds;
      if (player.x >= this.goalX - 20) {
        this._progress.reachedGoal = true;
        if (this._progress.goalReachedTime === undefined) this._progress.goalReachedTime = nowSeconds;
      }
      if (this._justCompleted) {
        this._justCompleted.timer -= dt;
        if (this._justCompleted.timer <= 0) this._justCompleted = null;
      }

      const hb = player.getHitbox();
      const px = hb.x + hb.w / 2;
      const py = hb.y + hb.h / 2;
      const r = 16;
      const r2 = r * r;
      const phb = player.getHitbox();
      const playerBottom = phb.y + phb.h;

      // Springs: when player lands on spring, launch upward or diagonal
      for (const s of this._springs) {
        if (s.compress > 0) s.compress = Math.max(0, s.compress - dt * 4);
        const sx = s.x - s.w / 2;
        const sy = s.y - s.h; // spring top
        const sb = { x: sx, y: sy, w: s.w, h: s.h };
        if (!aabbIntersects(phb, sb)) continue;
        if (player.vy < 0) continue; // only trigger when falling onto spring
        if (playerBottom < sy + 4) continue; // player bottom must be at or past spring top
        if (playerBottom > s.y + 8) continue;

        s.compress = 0.35;
        this._progress.springsUsed += 1;
        playSound("spring");
        player.grounded = false;
        player.springLaunchTimer = 0.4;
        player._justLaunchedSpring = true;
        const normalJumpVel = 6.5;
        const springBoost = 1.35;
        const maxSpringVy = -normalJumpVel * springBoost;
        if (s.dir === "up") {
          player.vy = maxSpringVy;
          player.vx = 0;
        } else if (s.dir === "diag-left") {
          player.vy = maxSpringVy;
          player.vx = -4;
        } else {
          player.vy = maxSpringVy;
          player.vx = 4;
        }
      }

      // Box platform: top collider = solid (getSolidsNear); bottom = trigger for jump-hit activation only.
      const boxGroundY = 300 + (this.index % 3) * 10;
      const SPAWN_OFFSET_ABOVE_BOX = 28;

      for (const box of this._boxes) {
        if (box.bounceAnim > 0) box.bounceAnim = Math.max(0, box.bounceAnim - dt);
        // One-time use: after activation, disable further collisions
        if (box.used) continue;

        const boxLeft = box.x;
        const boxRight = box.x + box.w;
        const boxBottom = box.y + box.h;
        const boxTop = box.y;

        // Horizontal overlap with box
        if (phb.x + phb.w < boxLeft || phb.x > boxRight) continue;
        // CRITICAL: must be moving upward (jump hit from below)
        if (player.vy >= 0) continue;

        const playerTop = phb.y;
        const playerBottom = phb.y + phb.h;
        const prevPlayerTop = playerTop - player.vy * frameScale;
        const hitFromBelow =
          prevPlayerTop >= boxBottom && playerTop < boxBottom && playerBottom > boxTop;

        if (!hitFromBelow) continue;

        // Activate once: bounce animation, spawn item instantly, set used
        box.used = true;
        box.bounceAnim = 0.28;

        const cx = box.x + box.w / 2;
        const boxTopY = box.y;
        const spawnY = boxTopY - SPAWN_OFFSET_ABOVE_BOX;

        if (box.type === "coin") {
          const count = Math.max(1, 1 + (this.index % 3));
          for (let i = 0; i < count; i++) {
            const coin = {
              x: cx + (i - count / 2) * 8,
              y: spawnY,
              vx: (i - count / 2) * 1.8,
              vy: -9 - i * 0.6,
              active: true,
            };
            this._coins.push(coin);
            if (typeof console !== "undefined" && console.log) {
              console.log("[Box] Coin spawned:", coin.x.toFixed(0), coin.y.toFixed(0), "count", count);
            }
          }
        } else if (box.type === "power_green" || box.type === "power_blue") {
          const POWER_MAX_RISE = 22;
          const pp = {
            x: cx,
            y: spawnY,
            vy: -3.2,
            maxY: spawnY - POWER_MAX_RISE,
            type: box.type,
            collected: false,
            bob: 0,
          };
          this._powerPickups.push(pp);
          if (typeof console !== "undefined" && console.log) {
            console.log("[Box] Power spawned:", pp.type, pp.x.toFixed(0), pp.y.toFixed(0));
          }
        } else if (box.type === "growth") {
          const FRUIT_MAX_RISE = 22;
          const fruit = {
            x: cx,
            y: spawnY,
            vy: -3.2,
            maxY: spawnY - FRUIT_MAX_RISE,
            collected: false,
            bob: 0,
          };
          this._fruits.push(fruit);
          if (typeof console !== "undefined" && console.log) {
            console.log("[Box] Fruit spawned:", fruit.x.toFixed(0), fruit.y.toFixed(0));
          }
        }

        player.vy = 0.6;
      }

      // Released coins: gravity, bounce; floor coins (static) do not move
      for (const c of this._coins) {
        if (!c.active) continue;
        if (c.static) continue;
        const grav = 0.4;
        c.vy += grav * dt * 60;
        c.y += c.vy * dt * 60;
        c.x += (c.vx || 0) * dt * 60;
        if (c.y >= boxGroundY) {
          c.y = boxGroundY;
          c.vy = -(c.vy || 0) * 0.45;
          if (Math.abs(c.vy) < 2) c.vy = 0;
        }
      }
      const MAGNET_RADIUS = 140;
      const MAGNET_PULL_SPEED = 5.5;
      const MAGNET_COLLECT_R = 28;
      if (player.magnetTimer > 0) {
        for (const c of this._coins) {
          if (!c.active) continue;
          let dx = px - c.x;
          let dy = py - c.y;
          let dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < MAGNET_RADIUS && dist > 0.1) {
            const move = MAGNET_PULL_SPEED * dt * 60;
            c.x += (dx / dist) * Math.min(move, dist);
            c.y += (dy / dist) * Math.min(move, dist);
            dx = px - c.x;
            dy = py - c.y;
            dist = Math.sqrt(dx * dx + dy * dy);
          }
          if (dist < MAGNET_COLLECT_R) {
            c.active = false;
            this._progress.coinsCollected += 1;
            player.rings += 1;
            player.addComboScore(10);
            playSound("coin");
          }
        }
      }
      for (const c of this._coins) {
        if (!c.active) continue;
        const dx = c.x - px;
        const dy = c.y - py;
        if (dx * dx + dy * dy <= r2) {
          c.active = false;
          this._progress.coinsCollected += 1;
          player.rings += 1;
          player.addComboScore(10);
          playSound("coin");
        }
      }

      for (const mp of this._magnetPickups) {
        if (mp.collected) continue;
        mp.bob = (mp.bob + dt * 6) % (Math.PI * 2);
        const mx = mp.x;
        const my = mp.y + Math.sin(mp.bob) * 4;
        const mdx = px - mx;
        const mdy = py - my;
        if (mdx * mdx + mdy * mdy <= 24 * 24) {
          mp.collected = true;
          player.magnetTimer = 8;
          playSound("power");
        }
      }
      this._magnetPickups = this._magnetPickups.filter((m) => !m.collected);

      // Power pickups (green gun / blue shield): controlled rise, then float (same in all levels)
      const powerGravityLight = 0.06;
      const powerMaxUpwardVy = -3.5;
      for (const pp of this._powerPickups) {
        if (pp.collected) continue;
        pp.y += pp.vy * dt * 60;
        pp.vy += powerGravityLight * dt * 60;
        pp.vy = Math.min(pp.vy, 1.2);
        if (pp.vy < powerMaxUpwardVy) pp.vy = powerMaxUpwardVy;
        if (pp.maxY != null && pp.y < pp.maxY) {
          pp.y = pp.maxY;
          pp.vy = 0;
        }
        pp.bob = (pp.bob + dt * 5) % (Math.PI * 2);
        const pb = { x: pp.x - 14, y: pp.y - 14, w: 28, h: 28 };
        if (aabbIntersects(phb, pb)) {
          pp.collected = true;
          if (pp.type === "power_green") {
            this._progress.hasPowerCoin = true;
            player.hasGunPower = true;
            player.gunCooldown = 0;
          } else {
            this._progress.hasShieldCoin = true;
            player.hasShieldPower = true;
          }
          player.powerFlash = 0.5;
          playSound("power");
        }
      }
      this._powerPickups = this._powerPickups.filter((p) => !p.collected);

      // Fruit: controlled rise, then float in place (same in all levels)
      const fruitGravityLight = 0.06;
      const fruitMaxUpwardVy = -3.5;
      for (const fruit of this._fruits) {
        if (fruit.collected) continue;
        fruit.y += fruit.vy * dt * 60;
        fruit.vy += fruitGravityLight * dt * 60;
        fruit.vy = Math.min(fruit.vy, 1.2);
        if (fruit.vy < fruitMaxUpwardVy) fruit.vy = fruitMaxUpwardVy;
        if (fruit.maxY != null && fruit.y < fruit.maxY) {
          fruit.y = fruit.maxY;
          fruit.vy = 0;
        }
        fruit.bob = (fruit.bob + dt * 5) % (Math.PI * 2);
        const fruitBox = { x: fruit.x - 14, y: fruit.y - 14, w: 28, h: 28 };
        if (aabbIntersects(phb, fruitBox)) {
          fruit.collected = true;
          player.isBig = true;
          player.growthTransformTimer = 0.6;
          playSound("power");
        }
      }
      this._fruits = this._fruits.filter((f) => !f.collected);

      // Enemies
      for (const e of this._enemies) e.update(dt);
      for (const e of this._enemies) {
        if (!e.alive) continue;
        const eb = e.getAabb();
        if (!aabbIntersects(phb, eb)) continue;

        // Stomp if falling and player was above enemy.
        const playerBottom = phb.y + phb.h;
        const enemyTop = eb.y;
        const wasAbove = playerBottom - player.vy <= enemyTop + 6;
        if (player.vy > 0 && wasAbove) {
          e.alive = false;
          if (e.isFlying) this._progress.flyingKilled += 1;
          else this._progress.groundKilled += 1;
          player.addComboScore(100);
          playSound("enemyHit");
          player.vy = -4.5; // bounce
          player.grounded = false;
        } else {
          const knockDir = player.x < e.x ? -1 : 1;
          player.takeHit(knockDir);
        }
      }

      // Boss update and collisions.
      if (this._boss) {
        this._boss.update(dt, player, this);
        const boss = this._boss;
        if (boss.alive) {
          const bb = boss.getAabb();
          if (aabbIntersects(phb, bb)) {
            const playerBottom = phb.y + phb.h;
            const bossTop = bb.y;
            const wasAboveBoss = playerBottom - player.vy <= bossTop + 8;
            if (player.vy > 0 && wasAboveBoss) {
              // Stomp bounces player only; boss takes damage ONLY from hero bullets
              player.vy = -5;
              player.grounded = false;
            } else {
              const knockDir = player.x < boss.x ? -1 : 1;
              player.takeHit(knockDir);
            }
          }
        }
      }

      // Boss attacks: move and collide with player/shield.
      for (const atk of this._bossAttacks) {
        atk.x += atk.vx * frameScale;
        atk.y += atk.vy * frameScale;
        atk.life -= dt;
      }
      this._bossAttacks = this._bossAttacks.filter((atk) => {
        if (atk.life <= 0 || atk.x < -100 || atk.x > this.width + 100) return false;
        const ab = { x: atk.x - atk.r, y: atk.y - atk.r, w: atk.r * 2, h: atk.r * 2 };
        if (aabbIntersects(phb, ab)) {
          // Hit player - shield absorbs if active
          const knockDir = player.x < atk.x ? -1 : 1;
          player.takeHit(knockDir);
          return false; // attack disappears
        }
        return true;
      });

      // Update muzzle flash
      if (this._muzzleFlash) {
        this._muzzleFlash.time -= dt;
        if (this._muzzleFlash.time <= 0) {
          this._muzzleFlash = null;
        }
      }

      // Bullets: move forward and hit any enemies (including birds).
      for (const b of this._bullets) {
        b.x += b.vx * frameScale;
        b.life -= dt;
      }
      // Remove dead/expired bullets and apply collisions.
      this._bullets = this._bullets.filter((b) => {
        if (b.life <= 0 || b.x < -100 || b.x > this.width + 100) return false;
        const bb = { x: b.x - 4, y: b.y - 4, w: 8, h: 8 };
        for (const e of this._enemies) {
          if (!e.alive) continue;
          const eb = e.getAabb();
          if (aabbIntersects(bb, eb)) {
            e.takeHit(1);
            if (!e.alive) {
              if (e.isFlying) this._progress.flyingKilled += 1;
              else this._progress.groundKilled += 1;
              player.addComboScore(80);
              playSound("enemyHit");
            } else {
              playSound("enemyHit");
            }
            return false; // bullet disappears
          }
        }
        // Bullet vs boss: always trigger damage when bullet hits boss (all levels, no invincible boss).
        if (this._boss && this._boss.alive) {
          const bossBox = this._boss.getAabb();
          if (aabbIntersects(bb, bossBox)) {
            this._boss.takeHit(1);
            player.addComboScore(150);
            playSound("bossHit");
            return false;
          }
        }
        return true;
      });

      // Boss defeat: stop attacks, drop many coins, hide health bar (handled by HUD).
      if (this._boss && !this._boss.alive && !this._bossRewarded) {
        this._bossRewarded = true;
        this._bossAttacks = [];
        this._progress.bossDefeatedNoShield = player.shieldHits < player.shieldMaxHits;
        player.addComboScore(1000);
        player.rings += 20;
        playSound("bossExplode");
        const cx = this._boss.x;
        const cy = this._boss.y - 40;
        for (let i = 0; i < 24; i++) {
          this._coins.push({
            x: cx - 120 + i * 10,
            y: cy - (i % 4) * 8,
            vx: (i % 5 - 2) * 2.5,
            vy: -6 - (i % 3) * 2,
            active: true,
          });
        }
        const rewardY = cy - 40;
        this._powerPickups.push({
          x: cx,
          y: rewardY,
          vy: -3.2,
          maxY: rewardY - 22,
          type: "power_green",
          collected: false,
          bob: 0,
        });
      }

      // Evaluate task completion
      const p = this._progress;
      for (const t of this._tasks) {
        if (this._completedTasks.has(t.id)) continue;
        let done = false;
        if (t.type === "coins") done = p.coinsCollected >= t.target;
        else if (t.type === "flyingEnemies") done = p.flyingKilled >= (t.target || p.flyingTotal);
        else if (t.type === "groundEnemies") done = p.groundKilled >= (t.target || p.groundTotal);
        else if (t.type === "springsUsed") done = p.springsUsed >= t.target;
        else if (t.type === "bothCoins") done = p.hasPowerCoin && p.hasShieldCoin;
        else if (t.type === "bossNoShield") done = p.bossDefeatedNoShield;
        else if (t.type === "timeLimit") done = p.reachedGoal && (p.goalReachedTime - p.startTime <= t.target);
        if (done) {
          this._completedTasks.add(t.id);
          this._justCompleted = { id: t.id, timer: 0.7 };
          playSound("power");
          if (!t.mandatory) player.rings += 5;
        }
      }
    }

    areMandatoryTasksComplete() {
      for (const t of this._tasks) {
        if (t.mandatory && !this._completedTasks.has(t.id)) return false;
      }
      return true;
    }

    getTasks() {
      return this._tasks;
    }
    getProgress() {
      return this._progress;
    }
    getCompletedTasks() {
      return this._completedTasks;
    }
    getJustCompleted() {
      return this._justCompleted;
    }

    hasAliveBoss() {
      return !!(this._boss && this._boss.alive);
    }

    getBoss() {
      return this._boss;
    }

    getSolidsNear(hb) {
      const margin = 96;
      const minX = hb.x - margin;
      const maxX = hb.x + hb.w + margin;
      const platformSolids = this._solids.filter((s) => s.x < maxX && s.x + s.w > minX);
      const boxTopHeight = 8;
      const boxTops = this._boxes
        .filter((b) => b.x + b.w > minX && b.x < maxX)
        .map((b) => ({ x: b.x, y: b.y, w: b.w, h: boxTopHeight }));
      return platformSolids.concat(boxTops);
    }

    renderBackground(ctx, camera) {
      const cx = camera.x;
      const cy = camera.y;
      const t = performance.now() * 0.00004;

      // Far background hills / mountains.
      ctx.save();
      ctx.translate(-(cx * 0.2), -(cy * 0.05));
      ctx.fillStyle = this.def.hill;
      for (let i = 0; i < 8; i++) {
        const x = i * 340;
        ctx.beginPath();
        ctx.ellipse(x + 140, 250, 220, 90, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // Mid-layer trees / city silhouettes depending on theme.
      ctx.save();
      ctx.translate(-(cx * 0.35), -(cy * 0.08));
      ctx.fillStyle = this.index === 7 ? "rgba(20,20,40,0.9)" : "rgba(10,70,30,0.85)";
      for (let i = -2; i < 14; i++) {
        const baseX = i * 260;
        const treeH = 80 + ((i + this.index) % 3) * 24;
        const x = baseX + ((this.index * 50) % 120);
        ctx.fillRect(x, 320 - treeH, 26, treeH);
        ctx.beginPath();
        ctx.moveTo(x - 24, 320 - treeH);
        ctx.lineTo(x + 13, 320 - treeH - 40);
        ctx.lineTo(x + 50, 320 - treeH);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();

      // Moving clouds / sky particles.
      ctx.save();
      ctx.translate(-(cx * 0.1), -(cy * 0.02));
      ctx.fillStyle = this.index === 9 ? "rgba(120,255,240,0.55)" : "rgba(255,255,255,0.85)";
      for (let i = 0; i < this._clouds.length; i++) {
        const c = this._clouds[i];
        const sx = c.x + Math.sin(t + i * 0.7) * 30 - cx * 0.1;
        const sy = c.y + Math.cos(t * 1.2 + i) * 4 - cy * 0.02;
        ctx.beginPath();
        ctx.arc(sx, sy, c.r, 0, Math.PI * 2);
        ctx.arc(sx + c.r * 0.9, sy + 4, c.r * 0.8, 0, Math.PI * 2);
        ctx.arc(sx - c.r * 0.9, sy + 6, c.r * 0.7, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    render(ctx, camera) {
      for (const s of this._solids) {
        const x = s.x - camera.x;
        const y = s.y - camera.y;
        if (x + s.w < -50 || x > camera.width + 50) continue;

        ctx.fillStyle = this.def.dirt;
        ctx.fillRect(x, y, s.w, s.h);

        ctx.fillStyle = this.def.groundTop;
        ctx.fillRect(x, y, s.w, s.h >= 80 ? 12 : 8);

        // Subtle top-edge shadow only (no checkerboard/tiling – clean solid ground)
        ctx.fillStyle = "rgba(0,0,0,0.08)";
        ctx.fillRect(x, y, s.w, 4);
      }

      // Springs: classic Sonic red/blue with arrow and compression
      for (const spr of this._springs) {
        const sx = spr.x - spr.w / 2 - camera.x;
        const syBot = spr.y - camera.y;
        const compressMul = 1 - Math.min(1, spr.compress) * 0.65;
        const rh = Math.max(4, spr.h * compressMul);
        const sy = syBot - rh;
        if (sx + spr.w < -30 || sx > camera.width + 30 || syBot < -20 || sy > camera.height + 30) continue;

        ctx.save();
        ctx.translate(sx, sy);

        // Red/blue horizontal stripes (classic Sonic spring)
        const stripeH = 3;
        for (let yy = 0; yy < rh; yy += stripeH) {
          ctx.fillStyle = (Math.floor(yy / stripeH) & 1) ? "#e62e2e" : "#2563eb";
          ctx.fillRect(0, yy, spr.w, Math.min(stripeH, rh - yy));
        }
        ctx.strokeStyle = "rgba(0,0,0,0.4)";
        ctx.lineWidth = 1;
        ctx.strokeRect(0, 0, spr.w, rh);

        // Direction arrow on top (classic Sonic arrow)
        ctx.translate(spr.w / 2, -4);
        ctx.fillStyle = "#fff";
        ctx.strokeStyle = "rgba(0,0,0,0.5)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        if (spr.dir === "up") {
          ctx.moveTo(0, -6);
          ctx.lineTo(-5, 4);
          ctx.lineTo(0, 0);
          ctx.lineTo(5, 4);
        } else if (spr.dir === "diag-left") {
          ctx.moveTo(2, -5);
          ctx.lineTo(-4, 0);
          ctx.lineTo(2, 5);
          ctx.lineTo(4, 0);
        } else {
          ctx.moveTo(-2, -5);
          ctx.lineTo(4, 0);
          ctx.lineTo(-2, 5);
          ctx.lineTo(-4, 0);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }

      const frame = Math.floor(this._coinAnim);
      const squash = [0.25, 0.5, 0.75, 1, 0.75, 0.5, 0.25, 0.5][frame] ?? 1;
      // Released coins (from coin boxes): bounce then collectible
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

      // Power pickups (green shoot / blue shield) – released from power boxes
      const pFrame = Math.floor(this._powerCoinAnim);
      const pulse = [1, 1.1, 1.2, 1.1, 1][pFrame] ?? 1;
      for (const pp of this._powerPickups) {
        if (pp.collected) continue;
        const sx = pp.x - camera.x;
        const sy = pp.y - camera.y + Math.sin(pp.bob) * 3;
        if (sx < -40 || sx > camera.width + 40 || sy < -40 || sy > camera.height + 40) continue;
        ctx.save();
        ctx.translate(sx, sy);
        ctx.scale(pulse, pulse);
        ctx.lineWidth = 3;
        if (pp.type === "power_green") {
          ctx.strokeStyle = "rgba(0,40,0,0.7)";
          ctx.fillStyle = "#6aff7a";
        } else {
          ctx.strokeStyle = "rgba(0,0,40,0.7)";
          ctx.fillStyle = "#6ad7ff";
        }
        ctx.beginPath();
        ctx.arc(0, 0, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#ffffff";
        if (pp.type === "power_green") ctx.fillRect(-3, -6, 6, 12);
        else {
          ctx.beginPath();
          ctx.arc(0, 0, 6, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // Mario-style boxes: type = coin | power_green | power_blue | growth (color + icon)
      for (const box of this._boxes) {
        const sx = box.x - camera.x;
        const sy = box.y - camera.y;
        if (sx + box.w < -40 || sx > camera.width + 40 || sy + box.h < -40 || sy > camera.height + 40) continue;
        ctx.save();
        const bounceOff = box.bounceAnim > 0 ? box.bounceAnim * 8 : 0;
        ctx.translate(sx + box.w / 2, sy + box.h / 2 - bounceOff);
        ctx.translate(-box.w / 2, -box.h / 2);
        if (box.used) {
          ctx.fillStyle = "#4a3728";
          ctx.strokeStyle = "rgba(0,0,0,0.5)";
        } else {
          if (box.type === "coin") {
            ctx.fillStyle = "#d4a84b";
            ctx.strokeStyle = "#8b6914";
          } else if (box.type === "power_green") {
            ctx.fillStyle = "#5a9f5a";
            ctx.strokeStyle = "#2d6b2d";
          } else if (box.type === "power_blue") {
            ctx.fillStyle = "#5a8fcf";
            ctx.strokeStyle = "#2d5a9f";
          } else {
            ctx.fillStyle = "#cf7a4a";
            ctx.strokeStyle = "#8b4a2d";
          }
        }
        ctx.lineWidth = 2;
        ctx.fillRect(0, 0, box.w, box.h);
        ctx.strokeRect(0, 0, box.w, box.h);
        if (!box.used) {
          ctx.fillStyle = "#1a1a1a";
          ctx.font = "bold 16px ui-sans-serif, system-ui, sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          if (box.type === "coin") ctx.fillText("$", box.w / 2, box.h / 2);
          else if (box.type === "power_green") ctx.fillText("P", box.w / 2, box.h / 2);
          else if (box.type === "power_blue") ctx.fillText("S", box.w / 2, box.h / 2);
          else ctx.fillText("G", box.w / 2, box.h / 2);
        }
        ctx.restore();
      }

      // Fruits (growth power-up): float/bob
      for (const fruit of this._fruits) {
        if (fruit.collected) continue;
        const sx = fruit.x - camera.x;
        const sy = fruit.y - camera.y;
        if (sx < -30 || sx > camera.width + 30 || sy < -30 || sy > camera.height + 30) continue;
        ctx.save();
        const bobY = Math.sin(fruit.bob) * 3;
        ctx.translate(sx, sy + bobY);
        ctx.fillStyle = "#e85a2a";
        ctx.strokeStyle = "rgba(0,0,0,0.4)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(0, 0, 10, 12, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#4a9020";
        ctx.beginPath();
        ctx.ellipse(0, -6, 4, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Magnet power-ups (floor): magnet icon + glow, easy to see while running
      for (const mp of this._magnetPickups) {
        if (mp.collected) continue;
        const sx = mp.x - camera.x;
        const sy = mp.y - camera.y;
        if (sx < -50 || sx > camera.width + 50 || sy < -50 || sy > camera.height + 50) continue;
        const bobY = Math.sin(mp.bob) * 4;
        ctx.save();
        ctx.translate(sx, sy + bobY);
        const t = performance.now() * 0.002;
        const pulse = 0.85 + Math.sin(t) * 0.15;
        // Outer glow – magnetic field
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 28);
        grad.addColorStop(0, "rgba(120,100,255,0.5)");
        grad.addColorStop(0.5, "rgba(80,60,200,0.25)");
        grad.addColorStop(1, "rgba(40,20,120,0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, 28, 0, Math.PI * 2);
        ctx.fill();
        // Magnet body – U-shape (horseshoe)
        ctx.scale(pulse, pulse);
        ctx.strokeStyle = "rgba(0,0,0,0.4)";
        ctx.lineWidth = 3;
        ctx.fillStyle = "#c04040";
        ctx.beginPath();
        ctx.arc(-8, -6, 8, 0, Math.PI);
        ctx.lineTo(-8, 10);
        ctx.lineTo(8, 10);
        ctx.lineTo(8, -6);
        ctx.arc(8, -6, 8, 0, Math.PI);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#e0e0e0";
        ctx.beginPath();
        ctx.arc(-6, -6, 4, 0, Math.PI * 2);
        ctx.arc(6, -6, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(80,60,200,0.9)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 14, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Enemies
      for (const e of this._enemies) e.render(ctx, camera);

      // Boss
      if (this._boss) this._boss.render(ctx, camera);

      // Muzzle flash
      if (this._muzzleFlash) {
        const mf = this._muzzleFlash;
        const sx = mf.x - camera.x;
        const sy = mf.y - camera.y;
        if (sx > -30 && sx < camera.width + 30 && sy > -30 && sy < camera.height + 30) {
          ctx.save();
          ctx.translate(sx, sy);
          const alpha = mf.time / 0.1;
          const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 12);
          grad.addColorStop(0, `rgba(160,255,180,${alpha * 0.9})`);
          grad.addColorStop(0.5, `rgba(100,255,120,${alpha * 0.6})`);
          grad.addColorStop(1, `rgba(40,200,60,0)`);
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(0, 0, 12, 0, Math.PI * 2);
          ctx.fill();
          // Flash lines
          ctx.strokeStyle = `rgba(200,255,220,${alpha})`;
          ctx.lineWidth = 2;
          for (let i = 0; i < 4; i++) {
            const ang = (i * Math.PI * 2) / 4;
            ctx.beginPath();
            ctx.moveTo(Math.cos(ang) * 4, Math.sin(ang) * 4);
            ctx.lineTo(Math.cos(ang) * 10, Math.sin(ang) * 10);
            ctx.stroke();
          }
          ctx.restore();
        }
      }

      // Bullets - green glowing energy shots
      for (const b of this._bullets) {
        const sx = b.x - camera.x;
        const sy = b.y - camera.y;
        if (sx < -20 || sx > camera.width + 20 || sy < -20 || sy > camera.height + 20) continue;
        ctx.save();
        ctx.translate(sx, sy);
        // Glowing green energy core
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 6);
        grad.addColorStop(0, "rgba(160,255,180,1)");
        grad.addColorStop(0.5, "rgba(100,255,120,0.8)");
        grad.addColorStop(1, "rgba(40,200,60,0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, 6, 0, Math.PI * 2);
        ctx.fill();
        // Outer glow
        ctx.fillStyle = "rgba(160,255,180,0.4)";
        ctx.beginPath();
        ctx.arc(0, 0, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Boss attacks – plasma / alien energy blasts
      for (const atk of this._bossAttacks) {
        const sx = atk.x - camera.x;
        const sy = atk.y - camera.y;
        if (sx < -50 || sx > camera.width + 50 || sy < -50 || sy > camera.height + 50) continue;
        ctx.save();
        ctx.translate(sx, sy);
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, atk.r);
        grad.addColorStop(0, "rgba(0,255,255,1)");
        grad.addColorStop(0.4, "rgba(160,80,255,0.9)");
        grad.addColorStop(0.8, "rgba(0,200,180,0.5)");
        grad.addColorStop(1, "rgba(60,20,120,0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, atk.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(0,255,255,0.4)";
        ctx.beginPath();
        ctx.arc(0, 0, atk.r + 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Goal sign only appears once boss is defeated.
      if (!this._boss || !this._boss.alive) {
        const gx = this.width - 120 - camera.x;
        const gy = 300 - camera.y;
        ctx.fillStyle = "#202025";
        ctx.fillRect(gx + 36, gy - 60, 8, 60);
        ctx.fillStyle = "#ffd24a";
        ctx.beginPath();
        ctx.arc(gx + 40, gy - 70, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#111";
        ctx.font = "12px ui-monospace, Menlo, Consolas, monospace";
        ctx.fillText("GO", gx + 30, gy - 66);
      }
    }
  }

  function createLevel(levelIndex) {
    const def = LEVEL_DEFS[clamp(levelIndex, 0, LEVEL_DEFS.length - 1)];
    const level = new Level(def, levelIndex);
    level.reset();
    return level;
  }

  // =========================
  // ui/hud
  // =========================
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

  function getTaskProgressText(task, progress, timeSeconds = 0) {
    const p = progress;
    if (task.type === "coins") return `${p.coinsCollected ?? 0}/${task.target}`;
    if (task.type === "flyingEnemies") return `${p.flyingKilled ?? 0}/${task.target || p.flyingTotal || 0}`;
    if (task.type === "groundEnemies") return `${p.groundKilled ?? 0}/${task.target || p.groundTotal || 0}`;
    if (task.type === "springsUsed") return `${p.springsUsed ?? 0}/${task.target}`;
    if (task.type === "bothCoins") return p.hasPowerCoin && p.hasShieldCoin ? "Done" : (p.hasPowerCoin ? "1/2" : "0/2");
    if (task.type === "bossNoShield") return p.bossDefeatedNoShield ? "Done" : "-";
    if (task.type === "timeLimit") {
      if (p.reachedGoal) return `${Math.floor((p.goalReachedTime - p.startTime) || 0)}s`;
      const elapsed = p.startTime != null ? Math.floor(timeSeconds - p.startTime) : 0;
      return `${elapsed}s / ${task.target}s`;
    }
    return "";
  }

  class Hud {
    render(
      ctx,
      {
        state,
        timeSeconds,
        player,
        levelIndex,
        levelName,
        lives,
        gameOver,
        bossHp = 0,
        bossHpDisplay = 0,
        bossMaxHp = 0,
        tasks = [],
        progress = {},
        completedTasks = new Set(),
        justCompleted = null,
        mandatoryComplete = true,
        hasAliveBoss = false,
        titleLogo = null,
        titleScreenShownAt = undefined,
      }
    ) {
      ctx.save();
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
      const livesText = `LIVES: ${lives}`;
      const levelText = `LEVEL: ${levelIndex + 1} - ${levelName}`;

      ctx.strokeText(score, x, y);
      ctx.fillText(score, x, y);
      ctx.strokeText(time, x, y + 22);
      ctx.fillText(time, x, y + 22);

      const ringsColor = player.rings === 0 ? "#ff4a4a" : "#ffe04a";
      ctx.strokeText(rings, x, y + 44);
      ctx.fillStyle = ringsColor;
      ctx.fillText(rings, x, y + 44);

      ctx.fillStyle = "#ffe04a";
      ctx.strokeText(livesText, x, y + 66);
      ctx.fillText(livesText, x, y + 66);

      // Hero icon – police badge theme
      const iconX = ctx.canvas.width - 52;
      const iconY = y + 8;
      ctx.save();
      ctx.translate(iconX, iconY);
      const iconT = (state === "playing" ? (performance.now() * 0.002) : 0) % 1;
      const iconPulse = 1 + Math.sin(iconT * Math.PI * 2) * 0.05;
      ctx.scale(iconPulse, iconPulse);
      ctx.strokeStyle = "#b0bec5";
      ctx.lineWidth = 2;
      ctx.fillStyle = "#0d1b3a";
      ctx.beginPath();
      ctx.moveTo(0, -16);
      ctx.lineTo(14, -4);
      ctx.lineTo(14, 8);
      ctx.lineTo(0, 14);
      ctx.lineTo(-14, 8);
      ctx.lineTo(-14, -4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#b0bec5";
      ctx.beginPath();
      ctx.moveTo(0, -10);
      ctx.lineTo(8, -2);
      ctx.lineTo(8, 4);
      ctx.lineTo(0, 8);
      ctx.lineTo(-8, 4);
      ctx.lineTo(-8, -2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#0a0a0f";
      ctx.fillRect(-2, -1, 4, 3);
      if (player.hasGunPower) {
        ctx.strokeStyle = "rgba(80,220,120,0.9)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 20, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (player.shieldActive && player.hasShieldPower) {
        ctx.strokeStyle = "rgba(60,130,220,0.9)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 22, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();

      ctx.font = "bold 16px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
      ctx.strokeText(levelText, x, y + 92);
      ctx.fillText(levelText, x, y + 92);

      // Boss health bar (blood bar) at top – visible when boss exists, smooth red decrease, hide when dead.
      if (state === "playing" && bossMaxHp > 0 && (bossHp > 0 || bossHpDisplay > 0.5) && !gameOver) {
        const barWidth = 280;
        const barHeight = 18;
        const cx = ctx.canvas.width / 2;
        const bx = cx - barWidth / 2;
        const by = 12;
        const ratio = clamp(bossHpDisplay / bossMaxHp, 0, 1);

        ctx.lineWidth = 3;
        ctx.strokeStyle = "rgba(0,0,0,0.8)";
        ctx.fillStyle = "rgba(30,0,0,0.95)";
        ctx.fillRect(bx, by, barWidth, barHeight);
        ctx.strokeRect(bx, by, barWidth, barHeight);

        const innerWidth = Math.max(0, Math.floor((barWidth - 4) * ratio));
        const innerX = bx + 2;
        const innerY = by + 2;
        const grad = ctx.createLinearGradient(innerX, innerY, innerX + barWidth, innerY);
        grad.addColorStop(0, "#cc2020");
        grad.addColorStop(0.5, "#e03030");
        grad.addColorStop(1, "#a01818");
        ctx.fillStyle = grad;
        ctx.fillRect(innerX, innerY, innerWidth, barHeight - 4);

        ctx.font = "bold 13px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#fff";
        ctx.strokeStyle = "rgba(0,0,0,0.8)";
        const label = `BOSS ${Math.round(bossHpDisplay)} / ${bossMaxHp}`;
        ctx.strokeText(label, cx, by + barHeight / 2 + 1);
        ctx.fillText(label, cx, by + barHeight / 2 + 1);
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
      }

      if (state === "title") {
        this._renderTitleScreen(ctx, levelIndex, levelName, titleLogo, titleScreenShownAt, timeSeconds);
      } else if (gameOver) {
        ctx.globalAlpha = 0.65;
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.globalAlpha = 1;
        this._centerText(ctx, "GAME OVER", 0, -10, 44);
        this._centerText(ctx, "Press R to restart", 0, 34, 18);
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

    _renderTitleScreen(ctx, levelIndex, levelName, titleLogo, titleScreenShownAt, timeSeconds) {
      const w = ctx.canvas.width;
      const h = ctx.canvas.height;
      const t = performance.now() * 0.001;
      const elapsed = timeSeconds - (titleScreenShownAt ?? timeSeconds);

      // Dark sci-fi background (no placeholder graphics – clean for logo)
      const bgGrad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.9);
      bgGrad.addColorStop(0, "rgba(12,6,32,0.98)");
      bgGrad.addColorStop(0.6, "rgba(4,2,18,0.99)");
      bgGrad.addColorStop(1, "rgba(0,0,8,1)");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      for (let i = 0; i < 40; i++) {
        const x = ((i * 137.5) % w);
        const y = ((i * 89.3) % h);
        ctx.beginPath();
        ctx.arc(x, y, 0.8, 0, Math.PI * 2);
        ctx.fill();
      }

      // Logo: above the title text, smaller so it fits the screen
      const logoFade = Math.min(1, elapsed / 1.2);
      const logoZoom = 0.92 + 0.08 * logoFade;
      if (titleLogo && titleLogo.complete && titleLogo.naturalWidth > 0) {
        ctx.save();
        const maxLogoWidth = w * 0.48 * logoZoom;
        const imgW = titleLogo.naturalWidth;
        const imgH = titleLogo.naturalHeight;
        const scale = maxLogoWidth / imgW;
        let drawW = imgW * scale;
        let drawH = imgH * scale;
        if (drawH > h * 0.4) {
          const scaleH = (h * 0.4) / drawH;
          drawW *= scaleH;
          drawH *= scaleH;
        }
        const lx = (w - drawW) / 2;
        const logoCenterY = h / 2 - 130;
        const ly = logoCenterY - drawH / 2;
        ctx.globalAlpha = 0.85 * logoFade + 0.15;
        ctx.drawImage(titleLogo, lx, ly, drawW, drawH);
        ctx.globalAlpha = 1;
        ctx.restore();
      }

      // Title text: below the logo, "BLACKHOLE INFIVERSE PRESENTS"
      const titleDelay = 0.85;
      const titleFade = elapsed < titleDelay ? 0 : Math.min(1, (elapsed - titleDelay) / 0.55);
      const cx = w / 2;
      const cy = h / 2 + 12;
      const pulse = 1 + Math.sin(t * 2) * 0.022;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(pulse * titleFade, pulse * titleFade);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "bold 36px ui-sans-serif, system-ui, 'Segoe UI', sans-serif";
      ctx.shadowColor = "rgba(120,80,255,0.95)";
      ctx.shadowBlur = 28;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      ctx.strokeStyle = "rgba(0,0,0,0.85)";
      ctx.lineWidth = 6;
      ctx.strokeText("BLACKHOLE INFIVERSE PRESENTS", 0, 0);
      ctx.fillStyle = "#e8e4ff";
      ctx.fillText("BLACKHOLE INFIVERSE PRESENTS", 0, 0);
      ctx.shadowBlur = 0;
      ctx.shadowColor = "transparent";
      ctx.restore();

      this._centerText(ctx, `Current level: ${levelIndex + 1} / 10 – ${levelName}`, 0, 52, 20);
      this._centerText(
        ctx,
        "Use 1–0 or ←/→ to pick a level, then press JUMP or ↑/↓ to start",
        0,
        78,
        15
      );
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

  // =========================
  // core/engine + bootstrap
  // =========================
  const GameState = Object.freeze({
    title: "title",
    playing: "playing",
    paused: "paused",
  });

  class GameEngine {
    constructor({ canvas, ctx, input, level, player, camera, hud, titleLogo = null, pauseMenuEl = null, settingsMenuEl = null }) {
      this.canvas = canvas;
      this.ctx = ctx;
      this.input = input;
      this.level = level;
      this.player = player;
      this.camera = camera;
      this.hud = hud;
      this.titleLogo = titleLogo;
      this.pauseMenuEl = pauseMenuEl;
      this.settingsMenuEl = settingsMenuEl;
      this.settingsOpen = false;
      this.openedFromPause = false;
      this._titleScreenShownAt = undefined;
      this._screenShake = 0;
      this._screenZoom = 0;
      this._wasShieldActive = false;
      this._wasMagnetActive = false;
      this._sirenFlash = 0;
      this.state = GameState.title;
      this._running = false;
      this._accumulator = 0;
      this._last = 0;
      this._timeSeconds = 0;
      this.levelIndex = 0;
      this.gameOver = false;
      this._bossHpDisplay = 0;
    }

    start() {
      if (this._running) return;
      this._running = true;
      this._last = performance.now();
      requestAnimationFrame((t) => this._frame(t));
    }

    _frame(nowMs) {
      if (!this._running) return;
      const dt = Math.min(GAME.maxDt, (nowMs - this._last) / 1000);
      this._last = nowMs;

      this.input.beginFrame(this._timeSeconds);

      if (this.settingsOpen) {
        this._render();
        this.input.endFrame();
        requestAnimationFrame((t) => this._frame(t));
        return;
      }

      this._timeSeconds += dt;

      if (this.state === GameState.title) {
        // Handle number keys (1–10) while on title.
        const sel = this.input.consumeLevelSelect();
        if (sel != null) {
          this.levelIndex = sel;
          this.level = createLevel(this.levelIndex);
          this._bossHpDisplay = 0;
          this.player.setSpawn({ x: 80, y: 220 });
          this.player.respawn({ x: 80, y: 220 });
        }

        // Allow cycling levels with left/right arrows.
        if (this.input.leftPressed()) {
          this.levelIndex = (this.levelIndex - 1 + LEVEL_DEFS.length) % LEVEL_DEFS.length;
          this.level = createLevel(this.levelIndex);
          this._bossHpDisplay = 0;
          this.player.setSpawn({ x: 80, y: 220 });
          this.player.respawn({ x: 80, y: 220 });
        } else if (this.input.rightPressed()) {
          this.levelIndex = (this.levelIndex + 1) % LEVEL_DEFS.length;
          this.level = createLevel(this.levelIndex);
          this._bossHpDisplay = 0;
          this.player.setSpawn({ x: 80, y: 220 });
          this.player.respawn({ x: 80, y: 220 });
        }

        const startPressed =
          this.input.up() || this.input.down() || this.input.jumpBuffered(this._timeSeconds);
        if (startPressed) {
          this.state = GameState.playing;
          this.input.consumeJumpBuffer();
        }
      }

      if (this.input.resetPressed()) this._reset();
      if (this.input.pausePressed() && this.state !== GameState.title && !this.settingsOpen) {
        this.state = this.state === GameState.paused ? GameState.playing : GameState.paused;
      }
      // Music mute/unmute (1 = mute, 2 = unmute) — instant, affects only background music
      if (this.input.musicMutePressed()) setMusicMuted(true);
      if (this.input.musicUnmutePressed()) setMusicMuted(false);

      if (this.state === GameState.title) {
        if (this._titleScreenShownAt === undefined) this._titleScreenShownAt = this._timeSeconds;
      } else {
        this._titleScreenShownAt = undefined;
      }

      if (this.state === GameState.playing) {
        this._accumulator += dt;
        while (this._accumulator >= GAME.fixedDt) {
          this._step(GAME.fixedDt);
          this._accumulator -= GAME.fixedDt;
        }
        this._screenShake = Math.max(0, this._screenShake - dt * 12);
        this._screenZoom = Math.max(0, this._screenZoom - dt * 6);
        this._sirenFlash = Math.max(0, this._sirenFlash - dt * 18);
      }

      this._render();
      this.input.endFrame();
      requestAnimationFrame((t) => this._frame(t));
    }

    _reset() {
      this.levelIndex = 0;
      this.gameOver = false;
      this.player.lives = 5;
      this.player.rings = 0;
      this.player.score = 0;
      this.player.setSpawn({ x: 80, y: 220 });
      this.player.respawn({ x: 80, y: 220 });
      this.level = createLevel(this.levelIndex);
      this._bossHpDisplay = 0;
      this.state = GameState.title;
      this._titleScreenShownAt = undefined;
      this._accumulator = 0;
      this._timeSeconds = 0;
    }

    resume() {
      if (this.state === GameState.paused) this.state = GameState.playing;
    }

    replayLevel() {
      if (this.state !== GameState.paused && !this.gameOver) return;
      this.level.reset();
      this.player.setSpawn({ x: 80, y: 220 });
      this.player.respawn({ x: 80, y: 220 });
      this._bossHpDisplay = 0;
      this.state = GameState.playing;
      this.gameOver = false;
    }

    exitToMenu() {
      if (this.state === GameState.paused || this.gameOver) this._reset();
    }

    openSettings(fromPause) {
      this.settingsOpen = true;
      this.openedFromPause = !!fromPause;
      if (this.state === GameState.playing) this.state = GameState.paused;
    }

    closeSettings() {
      this.settingsOpen = false;
    }

    _step(dt) {
      if (this.gameOver) return;

      // Handle shooting when gun power is active (permanently unlocked after green coin).
      if (this.player.hasGunPower && this.input.shootPressed()) {
        if (this.player.gunCooldown <= 0) {
          const dir = this.input.left() && !this.input.right() ? -1 : 1;
          const bulletX = this.player.x + dir * 24;
          const bulletY = this.player.y - 24;
          this.level.spawnBullet(bulletX, bulletY, dir);
          this.player.gunCooldown = 0.25;
          this.player.shootFlash = 0.15;
          this._screenShake = 0.12;
          this._screenZoom = 0.2;
          this._sirenFlash = 0.08;
          playSound("shoot");
        }
      }

      if (this.player._justLaunchedSpring) {
        this._screenShake = 0.15;
        this._screenZoom = 0.22;
        this._sirenFlash = 0.1;
        this.player._justLaunchedSpring = false;
      }

      const wasMagnetActive = this.player.magnetTimer > 0;
      this.player.update(dt, this.input, this.level, this._timeSeconds);

      if (this.player.shieldActive && !this._wasShieldActive) {
        this._screenShake = 0.08;
        this._screenZoom = 0.14;
        this._sirenFlash = 0.06;
      }
      this._wasShieldActive = this.player.shieldActive;
      this.level.update(dt, this.player, this._timeSeconds);
      if (wasMagnetActive && this.player.magnetTimer === 0) playSound("magnetDeactivate");
      const boss = this.level.getBoss ? this.level.getBoss() : null;
      const targetHp = boss && boss.alive ? boss.hp : 0;
      this._bossHpDisplay += (targetHp - this._bossHpDisplay) * Math.min(1, 10 * dt);
      if (boss && !boss.alive) this._bossHpDisplay = Math.max(0, this._bossHpDisplay);
      this.camera.setBounds({
        left: 0,
        right: this.level.width - this.canvas.width,
        top: 0,
        bottom: this.level.height - this.canvas.height,
      });
      this.camera.update(dt);

      if (this.player.lives <= 0) {
        this.gameOver = true;
        return;
      }

      // Goal: pass the signpost AFTER defeating the boss.
      if (
        this.player.x >= this.level.goalX &&
        this.player.grounded &&
        (!this.level.hasAliveBoss || !this.level.hasAliveBoss())
      ) {
        this.levelIndex += 1;
        if (this.levelIndex >= LEVEL_DEFS.length) {
          // Finished all 10 levels: loop back to title.
          this._reset();
          return;
        }
        this.level = createLevel(this.levelIndex);
        this._bossHpDisplay = 0;
        this.player.setSpawn({ x: 80, y: 220 });
        this.player.respawn({ x: 80, y: 220 });
      }
    }

    _render() {
      const ctx = this.ctx;
      const { width, height } = this.canvas;
      // Reset state every frame so overlays never leave globalAlpha/transform dirty
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = this.level.def.sky;
      ctx.fillRect(0, 0, width, height);

      // Screen shake and zoom for gameplay only (deterministic = no flicker)
      ctx.save();
      const t = this._timeSeconds * 60;
      const shakeMag = Math.min(1, this._screenShake * 12);
      const shakeX = shakeMag > 0 ? Math.sin(t * 7.3) * this._screenShake * 4 : 0;
      const shakeY = shakeMag > 0 ? Math.sin(t * 5.7 + 1) * this._screenShake * 3 : 0;
      const zoom = 1 + Math.min(0.06, this._screenZoom);
      ctx.translate(shakeX, shakeY);
      ctx.translate(width / 2, height / 2);
      ctx.scale(zoom, zoom);
      ctx.translate(-width / 2, -height / 2);

      this.level.renderBackground(ctx, this.camera);
      this.level.render(ctx, this.camera);
      this.player.render(ctx, this.camera);
      ctx.restore();

      // Pause menu: show when paused and settings not open
      if (this.pauseMenuEl) {
        const showPause = this.state === GameState.paused && !this.settingsOpen;
        this.pauseMenuEl.classList.toggle("visible", showPause);
        this.pauseMenuEl.setAttribute("aria-hidden", showPause ? "false" : "true");
      }
      // Settings menu: show when open; "from-pause" shows Game options section
      if (this.settingsMenuEl) {
        this.settingsMenuEl.classList.toggle("visible", this.settingsOpen);
        this.settingsMenuEl.classList.toggle("from-pause", this.openedFromPause);
        this.settingsMenuEl.setAttribute("aria-hidden", this.settingsOpen ? "false" : "true");
      }
      // HUD always drawn outside shake/zoom = stable, no flickering UI
      const boss = this.level.getBoss ? this.level.getBoss() : null;
      this.hud.render(ctx, {
        state: this.state,
        timeSeconds: this._timeSeconds,
        player: this.player,
        levelIndex: this.levelIndex,
        levelName: this.level.def.name,
        lives: this.player.lives,
        gameOver: this.gameOver,
        bossHp: boss && boss.alive ? boss.hp : 0,
        bossHpDisplay: this._bossHpDisplay,
        bossMaxHp: boss ? boss.maxHp : 0,
        tasks: this.level.getTasks ? this.level.getTasks() : [],
        progress: this.level.getProgress ? this.level.getProgress() : {},
        completedTasks: this.level.getCompletedTasks ? this.level.getCompletedTasks() : new Set(),
        justCompleted: this.level.getJustCompleted ? this.level.getJustCompleted() : null,
        mandatoryComplete: this.level.areMandatoryTasksComplete ? this.level.areMandatoryTasksComplete() : true,
        hasAliveBoss: this.level.hasAliveBoss ? this.level.hasAliveBoss() : false,
        titleLogo: this.titleLogo,
        titleScreenShownAt: this._titleScreenShownAt,
      });

      // Subtle siren-like blue flash (fullscreen overlay, no transform)
      if (this._sirenFlash > 0) {
        const alpha = Math.min(0.12, this._sirenFlash * 1.5);
        ctx.fillStyle = `rgba(40,80,180,${alpha})`;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      }
    }
  }

  const GAME_WIDTH = 960;
  const GAME_HEIGHT = 540;

  function resizeCanvas(canvas) {
    const w = typeof window !== "undefined" ? window.innerWidth : GAME_WIDTH;
    const h = typeof window !== "undefined" ? window.innerHeight : GAME_HEIGHT;
    const padding = 16;
    const helpHeight = 60;
    const scale = Math.min((w - padding) / GAME_WIDTH, (h - helpHeight - padding) / GAME_HEIGHT, 2);
    const displayW = Math.floor(GAME_WIDTH * scale);
    const displayH = Math.floor(GAME_HEIGHT * scale);
    canvas.style.width = displayW + "px";
    canvas.style.height = displayH + "px";
  }

  function setupPauseMenu(engine) {
    const resumeBtn = document.getElementById("pause-resume");
    const replayBtn = document.getElementById("pause-replay");
    const settingsBtn = document.getElementById("pause-settings");
    const exitBtn = document.getElementById("pause-exit");
    if (resumeBtn) resumeBtn.addEventListener("click", () => engine.resume());
    if (replayBtn) replayBtn.addEventListener("click", () => engine.replayLevel());
    if (settingsBtn) settingsBtn.addEventListener("click", () => engine.openSettings(true));
    if (exitBtn) exitBtn.addEventListener("click", () => engine.exitToMenu());
    if (resumeBtn) resumeBtn.addEventListener("touchend", (e) => { e.preventDefault(); engine.resume(); }, { passive: false });
    if (replayBtn) replayBtn.addEventListener("touchend", (e) => { e.preventDefault(); engine.replayLevel(); }, { passive: false });
    if (settingsBtn) settingsBtn.addEventListener("touchend", (e) => { e.preventDefault(); engine.openSettings(true); }, { passive: false });
    if (exitBtn) exitBtn.addEventListener("touchend", (e) => { e.preventDefault(); engine.exitToMenu(); }, { passive: false });
  }

  function setupSettingsMenu(engine) {
    const menuEl = document.getElementById("settings-menu");
    const closeBtn = document.getElementById("settings-close");
    const musicBtn = document.getElementById("settings-music");
    const sfxBtn = document.getElementById("settings-sfx");
    const resumeBtn = document.getElementById("settings-resume");
    const replayBtn = document.getElementById("settings-replay");
    const exitBtn = document.getElementById("settings-exit");
    const entryBtn = document.getElementById("settings-entry-btn");

    function updateAudioLabels() {
      if (musicBtn) {
        musicBtn.textContent = getMusicMuted() ? "OFF" : "ON";
        musicBtn.setAttribute("aria-pressed", getMusicMuted() ? "true" : "false");
      }
      if (sfxBtn) {
        sfxBtn.textContent = getSfxMuted() ? "OFF" : "ON";
        sfxBtn.setAttribute("aria-pressed", getSfxMuted() ? "true" : "false");
      }
    }

    function openSettings(fromPause) {
      engine.openSettings(fromPause);
      updateAudioLabels();
    }

    function closeSettings() {
      engine.closeSettings();
    }

    if (closeBtn) {
      closeBtn.addEventListener("click", closeSettings);
      closeBtn.addEventListener("touchend", (e) => { e.preventDefault(); closeSettings(); }, { passive: false });
    }
    if (musicBtn) {
      musicBtn.addEventListener("click", () => {
        setMusicMuted(!getMusicMuted());
        updateAudioLabels();
      });
      musicBtn.addEventListener("touchend", (e) => {
        e.preventDefault();
        setMusicMuted(!getMusicMuted());
        updateAudioLabels();
      }, { passive: false });
    }
    if (sfxBtn) {
      sfxBtn.addEventListener("click", () => {
        setSfxMuted(!getSfxMuted());
        updateAudioLabels();
      });
      sfxBtn.addEventListener("touchend", (e) => {
        e.preventDefault();
        setSfxMuted(!getSfxMuted());
        updateAudioLabels();
      }, { passive: false });
    }
    if (resumeBtn) {
      resumeBtn.addEventListener("click", () => { closeSettings(); engine.resume(); });
      resumeBtn.addEventListener("touchend", (e) => { e.preventDefault(); closeSettings(); engine.resume(); }, { passive: false });
    }
    if (replayBtn) {
      replayBtn.addEventListener("click", () => { closeSettings(); engine.replayLevel(); });
      replayBtn.addEventListener("touchend", (e) => { e.preventDefault(); closeSettings(); engine.replayLevel(); }, { passive: false });
    }
    if (exitBtn) {
      exitBtn.addEventListener("click", () => { closeSettings(); engine.exitToMenu(); });
      exitBtn.addEventListener("touchend", (e) => { e.preventDefault(); closeSettings(); engine.exitToMenu(); }, { passive: false });
    }
    if (entryBtn) {
      entryBtn.addEventListener("click", () => openSettings(engine.state === GameState.paused));
      entryBtn.addEventListener("touchend", (e) => {
        e.preventDefault();
        openSettings(engine.state === GameState.paused);
      }, { passive: false });
    }
    updateAudioLabels();
  }

  function setupTouchControls(input) {
    const overlay = document.getElementById("touch-controls");
    if (!overlay || !input) return;
    const actionToCode = { left: "TouchLeft", right: "TouchRight", jump: "TouchJump", shoot: "TouchShoot", shield: "TouchShield", pause: "TouchPause" };
    const handleStart = (e, action) => {
      e.preventDefault();
      const code = actionToCode[action];
      if (code) input.setVirtualKey(code, true);
    };
    const handleEnd = (e, action) => {
      e.preventDefault();
      const code = actionToCode[action];
      if (code) input.setVirtualKey(code, false);
    };
    overlay.querySelectorAll(".touch-btn").forEach((btn) => {
      const action = btn.getAttribute("data-action");
      if (!action) return;
      btn.addEventListener("pointerdown", (e) => handleStart(e, action), { passive: false });
      btn.addEventListener("pointerup", (e) => handleEnd(e, action), { passive: false });
      btn.addEventListener("pointerleave", (e) => handleEnd(e, action), { passive: false });
      btn.addEventListener("pointercancel", (e) => handleEnd(e, action), { passive: false });
      btn.addEventListener("touchstart", (e) => { e.preventDefault(); handleStart(e, action); }, { passive: false });
      btn.addEventListener("touchend", (e) => { e.preventDefault(); handleEnd(e, action); }, { passive: false });
      btn.addEventListener("touchcancel", (e) => handleEnd(e, action), { passive: false });
    });
  }

  function bootstrap() {
    const canvas = document.getElementById("game");
    if (!(canvas instanceof HTMLCanvasElement)) throw new Error("Canvas #game not found");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D context not available");

    canvas.width = GAME_WIDTH;
    canvas.height = GAME_HEIGHT;
    // Clean, stable visuals: smooth scaling, no blurry stretch
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    resizeCanvas(canvas);
    if (typeof window !== "undefined") {
      window.addEventListener("resize", () => resizeCanvas(canvas));
      window.addEventListener("orientationchange", () => { setTimeout(() => resizeCanvas(canvas), 100); });
    }

    const input = new InputHandler(window);
    setupTouchControls(input);

    const titleLogo = typeof Image !== "undefined" ? new Image() : null;
    if (titleLogo) titleLogo.src = "images/Logo.png";

    const level = createLevel(0);
    const player = new Player({ x: 80, y: 220 });
    player.setSpawn({ x: 80, y: 220 });
    const camera = new Camera({ width: canvas.width, height: canvas.height });
    camera.setBounds({
      left: 0,
      right: level.width - canvas.width,
      top: 0,
      bottom: level.height - canvas.height,
    });
    camera.follow(player);
    const hud = new Hud();
    const pauseMenuEl = document.getElementById("pause-menu");
    const settingsMenuEl = document.getElementById("settings-menu");

    const engine = new GameEngine({ canvas, ctx, input, level, player, camera, hud, titleLogo, pauseMenuEl, settingsMenuEl });
    setupPauseMenu(engine);
    setupSettingsMenu(engine);
    // Start music on first user interaction (click, key, or touch) to satisfy autoplay policy
    const startMusicOnInteraction = () => {
      startMusicOnce();
      window.removeEventListener("click", startMusicOnInteraction);
      window.removeEventListener("keydown", startMusicOnInteraction);
      window.removeEventListener("touchstart", startMusicOnInteraction);
    };
    window.addEventListener("click", startMusicOnInteraction, { once: true });
    window.addEventListener("keydown", startMusicOnInteraction, { once: true });
    window.addEventListener("touchstart", startMusicOnInteraction, { once: true, passive: true });
    engine.start();
  }

  bootstrap();
})();

