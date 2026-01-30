import { INPUT } from "./constants.js";

const DEFAULT_BINDINGS = Object.freeze({
  left: ["ArrowLeft", "KeyA"],
  right: ["ArrowRight", "KeyD"],
  down: ["ArrowDown", "KeyS"],
  up: ["ArrowUp", "KeyW"],
  jump: ["Space", "KeyZ", "KeyX"],
  pause: ["Enter", "KeyP"],
  reset: ["KeyR"],
});

export class InputHandler {
  constructor(target = window, bindings = DEFAULT_BINDINGS) {
    this.bindings = bindings;

    this._down = new Set();
    this._pressedThisFrame = new Set();
    this._releasedThisFrame = new Set();

    // Derived / buffered controls
    this._jumpBufferedUntil = 0;
    this._jumpReleasedThisFrame = false;

    target.addEventListener("keydown", (e) => {
      if (e.repeat) return;
      this._down.add(e.code);
      this._pressedThisFrame.add(e.code);
    });
    target.addEventListener("keyup", (e) => {
      this._down.delete(e.code);
      this._releasedThisFrame.add(e.code);
    });
  }

  beginFrame(nowSeconds) {
    // Update edge-triggered fields.
    this._jumpReleasedThisFrame = this._anyJustReleased("jump");

    if (this._anyJustPressed("jump")) {
      this._jumpBufferedUntil = nowSeconds + INPUT.jumpBufferSeconds;
    }
  }

  endFrame() {
    this._pressedThisFrame.clear();
    this._releasedThisFrame.clear();
  }

  // --- High-level queries used by gameplay ---
  left() {
    return this._anyDown("left");
  }
  right() {
    return this._anyDown("right");
  }
  down() {
    return this._anyDown("down");
  }
  up() {
    return this._anyDown("up");
  }

  pausePressed() {
    return this._anyJustPressed("pause");
  }
  resetPressed() {
    return this._anyJustPressed("reset");
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

  // --- Internals ---
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

