// Shared animation curves. Seamlessly loopable (value at phase 0 == phase 1)
// so the exported mp4 can repeat without a visible jump.

const TAU = Math.PI * 2;

/** Phase in [0,1) for a given time (seconds) and loop period (seconds). */
export function phaseOf(t, period) {
  if (!period || period <= 0) return 0;
  const p = (t % period) / period;
  return p < 0 ? p + 1 : p;
}

/**
 * Poke curve: 0 -> 1 -> 0 over one period using a raised-cosine (sin^2) shape.
 * Smooth ease-in/ease-out at both ends and seamless across the loop boundary.
 */
export function pokeCurve(phase) {
  return (1 - Math.cos(TAU * phase)) / 2;
}

/**
 * Pulse scale oscillating between 1 and 1+amp, seamless across the loop.
 */
export function pulseScale(phase, amp) {
  return 1 + amp * (1 - Math.cos(TAU * phase)) / 2;
}
