export const GAME = Object.freeze({
  targetFps: 60,
  fixedDt: 1 / 60,
  maxDt: 1 / 20,
});

// Values here are in "pixels per frame" units (classic Sonic style),
// but we integrate them in a time-scaled loop by multiplying by (dt * 60).
// That keeps the numbers readable while still using requestAnimationFrame timing.
export const PHYS = Object.freeze({
  gravity: 0.21875,
  terminalVel: 16,

  topSpeed: 6,
  maxSpeedRolling: 16,

  groundAccel: 0.046875,
  groundDecel: 0.5,
  groundFriction: 0.046875,

  airAccel: 0.09375,

  jumpVel: 6.5, // applied upward as -jumpVel
  jumpCutMultiplier: 0.5,

  rollFriction: 0.0234375,
  rollDecelFlat: 0.125,
});

export const INPUT = Object.freeze({
  jumpBufferSeconds: 5 / 60, // 5 frames
  coyoteSeconds: 6 / 60, // 6 frames
});

