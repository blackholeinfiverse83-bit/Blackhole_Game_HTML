import { GAME } from "./constants.js";

const GameState = Object.freeze({
  title: "title",
  playing: "playing",
  paused: "paused",
});

export class GameEngine {
  constructor({ canvas, ctx, input, level, player, camera, hud }) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.input = input;
    this.level = level;
    this.player = player;
    this.camera = camera;
    this.hud = hud;

    this.state = GameState.title;
    this._running = false;

    this._accumulator = 0;
    this._last = 0;
    this._timeSeconds = 0;
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

    this._timeSeconds += dt;
    this.input.beginFrame(this._timeSeconds);

    if (this.state === GameState.title) {
      // Any jump/move starts.
      if (
        this.input.left() ||
        this.input.right() ||
        this.input.up() ||
        this.input.down() ||
        this.input.jumpBuffered(this._timeSeconds)
      ) {
        this.state = GameState.playing;
        this.input.consumeJumpBuffer();
      }
    }

    if (this.input.resetPressed()) {
      this._reset();
    }

    if (this.input.pausePressed() && this.state !== GameState.title) {
      this.state = this.state === GameState.paused ? GameState.playing : GameState.paused;
    }

    if (this.state === GameState.playing) {
      // Fixed-step simulation for consistent feel.
      this._accumulator += dt;
      while (this._accumulator >= GAME.fixedDt) {
        this._step(GAME.fixedDt);
        this._accumulator -= GAME.fixedDt;
      }
    }

    this._render();
    this.input.endFrame();

    requestAnimationFrame((t) => this._frame(t));
  }

  _reset() {
    this.player.respawn({ x: 80, y: 220 });
    this.level.reset();
    this.state = GameState.title;
    this._accumulator = 0;
    this._timeSeconds = 0;
  }

  _step(dt) {
    this.player.update(dt, this.input, this.level, this._timeSeconds);
    this.level.update(dt, this.player);
    this.camera.update(dt, this.level);
  }

  _render() {
    const ctx = this.ctx;
    const { width, height } = this.canvas;

    ctx.clearRect(0, 0, width, height);

    // Background (simple parallax placeholders)
    this.level.renderBackground(ctx, this.camera);

    // World
    this.level.render(ctx, this.camera);
    this.player.render(ctx, this.camera);

    // HUD & overlays
    this.hud.render(ctx, {
      state: this.state,
      timeSeconds: this._timeSeconds,
      player: this.player,
    });
  }
}

