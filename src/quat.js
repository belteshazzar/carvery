/**
 * Quaternion helpers that mirror the behavior of gl-quat but
 * return freshly allocated Float32Array instances to match this codebase.
 */
export const Quat = {
  /** Create a quaternion from optional components (defaults to identity). */
  create: (x = 0, y = 0, z = 0, w = 1) => new Float32Array([x, y, z, w]),

  /** Return the identity quaternion (0,0,0,1). */
  identity: () => new Float32Array([0, 0, 0, 1]),

  /** Clone/copy helpers for parity with gl-quat's API surface. */
  clone: (q) => new Float32Array([q[0], q[1], q[2], q[3]]),
  copy: (q) => new Float32Array([q[0], q[1], q[2], q[3]]),
  set: (x, y, z, w) => new Float32Array([x, y, z, w]),
  fromValues: (x, y, z, w) => new Float32Array([x, y, z, w]),

  /** Basic numeric helpers. */
  add: (a, b) => new Float32Array([a[0] + b[0], a[1] + b[1], a[2] + b[2], a[3] + b[3]]),
  scale: (q, s) => new Float32Array([q[0] * s, q[1] * s, q[2] * s, q[3] * s]),
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3],
  length: (q) => Math.hypot(q[0], q[1], q[2], q[3]) || 0,
  squaredLength: (q) => q[0] * q[0] + q[1] * q[1] + q[2] * q[2] + q[3] * q[3],

  /** Normalize the quaternion, returning identity when magnitude is zero. */
  normalize: (q) => {
    const lenSq = Quat.squaredLength(q);
    if (!lenSq) return new Float32Array([0, 0, 0, 0]);
    const inv = 1 / Math.sqrt(lenSq);
    return new Float32Array([q[0] * inv, q[1] * inv, q[2] * inv, q[3] * inv]);
  },

  /** Quaternion conjugate and inverse (same math as gl-quat). */
  conjugate: (q) => new Float32Array([-q[0], -q[1], -q[2], q[3]]),
  invert: (q) => {
    const dot = Quat.squaredLength(q);
    if (!dot) return new Float32Array([0, 0, 0, 0]);
    const invDot = 1 / dot;
    return new Float32Array([-q[0] * invDot, -q[1] * invDot, -q[2] * invDot, q[3] * invDot]);
  },

  /**
   * Multiply two quaternions (order matches gl-quat.multiply: a * b).
   */
  multiply: (a, b) => {
    const ax = a[0], ay = a[1], az = a[2], aw = a[3];
    const bx = b[0], by = b[1], bz = b[2], bw = b[3];
    return new Float32Array([
      ax * bw + aw * bx + ay * bz - az * by,
      ay * bw + aw * by + az * bx - ax * bz,
      az * bw + aw * bz + ax * by - ay * bx,
      aw * bw - ax * bx - ay * by - az * bz
    ]);
  },
  mul: (a, b) => Quat.multiply(a, b),

  /**
   * Interpolate between quaternions (linear and spherical variants).
   */
  lerp: (a, b, t) => new Float32Array([
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
    a[3] + (b[3] - a[3]) * t
  ]),
  slerp: (a, b, t) => {
    let bx = b[0], by = b[1], bz = b[2], bw = b[3];
    let cosom = Quat.dot(a, b);
    if (cosom < 0) {
      cosom = -cosom;
      bx = -bx; by = -by; bz = -bz; bw = -bw;
    }
    let scale0, scale1;
    if (1 - cosom > 1e-6) {
      const omega = Math.acos(cosom);
      const sinom = Math.sin(omega);
      scale0 = Math.sin((1 - t) * omega) / sinom;
      scale1 = Math.sin(t * omega) / sinom;
    } else {
      scale0 = 1 - t;
      scale1 = t;
    }
    const ax = a[0], ay = a[1], az = a[2], aw = a[3];
    return new Float32Array([
      scale0 * ax + scale1 * bx,
      scale0 * ay + scale1 * by,
      scale0 * az + scale1 * bz,
      scale0 * aw + scale1 * bw
    ]);
  },

  /** Build a quaternion for a rotation around an axis (matches setAxisAngle). */
  fromAxisAngle: (axis, angle) => {
    const half = angle * 0.5;
    const s = Math.sin(half);
    return new Float32Array([axis[0] * s, axis[1] * s, axis[2] * s, Math.cos(half)]);
  },
  setAxisAngle: (axis, angle) => Quat.fromAxisAngle(axis, angle),
  /** Recalculate w from xyz assuming unit length (parity helper). */
  calculateW: (q) => {
    const x = q[0], y = q[1], z = q[2];
    const w = Math.sqrt(Math.abs(1 - x * x - y * y - z * z));
    return new Float32Array([x, y, z, w]);
  },

  /** Rotate an existing quaternion by the axis-aligned angles. */
  rotateX: (q, angle) => {
    const half = angle * 0.5;
    const bx = Math.sin(half);
    const bw = Math.cos(half);
    const ax = q[0], ay = q[1], az = q[2], aw = q[3];
    return new Float32Array([
      ax * bw + aw * bx,
      ay * bw + az * bx,
      az * bw - ay * bx,
      aw * bw - ax * bx
    ]);
  },
  rotateY: (q, angle) => {
    const half = angle * 0.5;
    const by = Math.sin(half);
    const bw = Math.cos(half);
    const ax = q[0], ay = q[1], az = q[2], aw = q[3];
    return new Float32Array([
      ax * bw - az * by,
      ay * bw + aw * by,
      az * bw + ax * by,
      aw * bw - ay * by
    ]);
  },
  rotateZ: (q, angle) => {
    const half = angle * 0.5;
    const bz = Math.sin(half);
    const bw = Math.cos(half);
    const ax = q[0], ay = q[1], az = q[2], aw = q[3];
    return new Float32Array([
      ax * bw + ay * bz,
      ay * bw - ax * bz,
      az * bw + aw * bz,
      aw * bw - az * bz
    ]);
  },

  /** Build a quaternion from a 3x3 rotation matrix (column-major). */
  fromMat3: (m) => {
    const trace = m[0] + m[4] + m[8];
    if (trace > 0) {
      const root = Math.sqrt(trace + 1);
      const w = 0.5 * root;
      const inv = 0.5 / root;
      return new Float32Array([
        (m[5] - m[7]) * inv,
        (m[6] - m[2]) * inv,
        (m[1] - m[3]) * inv,
        w
      ]);
    }
    let i = 0;
    if (m[4] > m[0]) i = 1;
    if (m[8] > m[i * 3 + i]) i = 2;
    const j = (i + 1) % 3;
    const k = (i + 2) % 3;
    const diag = Math.sqrt(m[i * 3 + i] - m[j * 3 + j] - m[k * 3 + k] + 1);
    const q = [0, 0, 0, 0];
    q[i] = 0.5 * diag;
    const inv = 0.5 / diag;
    q[3] = (m[j * 3 + k] - m[k * 3 + j]) * inv;
    q[j] = (m[j * 3 + i] + m[i * 3 + j]) * inv;
    q[k] = (m[k * 3 + i] + m[i * 3 + k]) * inv;
    return new Float32Array(q);
  }
};

export default Quat;
