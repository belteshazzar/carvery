/**
 * 3D vector utilities (Vec3).
 *
 * All functions return newly-allocated Float32Array instances to match the
 * previous project convention and the `gl-vec3` parity tests.
 */
export const Vec3 = {
  /**
   * Add two vectors component-wise.
   * @param {Float32Array} a
   * @param {Float32Array} b
   * @returns {Float32Array} a + b
   */
  add: (a, b) => new Float32Array([a[0] + b[0], a[1] + b[1], a[2] + b[2]]),

  /**
   * Component-wise ceil.
   * @param {Float32Array} a
   * @returns {Float32Array}
   */
  ceil: (a) => new Float32Array([Math.ceil(a[0]), Math.ceil(a[1]), Math.ceil(a[2])]),

  /**
   * Clamp components between min and max (scalars or vec3).
   * @param {Float32Array} a
   * @param {number|Float32Array} min
   * @param {number|Float32Array} max
   * @returns {Float32Array}
   */
  clamp: (a, min, max) => {
    const isScalar = (v) => typeof v === 'number';
    const minX = isScalar(min) ? min : min[0];
    const minY = isScalar(min) ? min : min[1];
    const minZ = isScalar(min) ? min : min[2];
    const maxX = isScalar(max) ? max : max[0];
    const maxY = isScalar(max) ? max : max[1];
    const maxZ = isScalar(max) ? max : max[2];
    return new Float32Array([
      Math.min(Math.max(a[0], minX), maxX),
      Math.min(Math.max(a[1], minY), maxY),
      Math.min(Math.max(a[2], minZ), maxZ)
    ]);
  },

  /**
   * Create a copy (clone) of a vector.
   * @param {Float32Array} a
   * @returns {Float32Array}
   */
  clone: (a) => new Float32Array([a[0], a[1], a[2]]),

  /**
   * Copy components and return a new vector. (Same as clone; kept for parity.)
   * @param {Float32Array} a
   * @returns {Float32Array}
   */
  copy: (a) => new Float32Array([a[0], a[1], a[2]]),

  /**
   * Create a new vec3 with the given components.
   * @param {number} [x=0]
   * @param {number} [y=0]
   * @param {number} [z=0]
   * @returns {Float32Array}
   */
  create: (x = 0, y = 0, z = 0) => new Float32Array([x, y, z]),

  /**
   * Cross product of two vectors.
   * @param {Float32Array} a
   * @param {Float32Array} b
   * @returns {Float32Array}
   */
  cross: (a, b) => new Float32Array([
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ]),

  /**
   * Euclidean distance between two vectors.
   * @param {Float32Array} a
   * @param {Float32Array} b
   * @returns {number}
   */
  distance: (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) || 0,

  /**
   * Dot product of two vectors.
   * @param {Float32Array} a
   * @param {Float32Array} b
   * @returns {number}
   */
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],

  /**
   * Component-wise floor.
   * @param {Float32Array} a
   * @returns {Float32Array}
   */
  floor: (a) => new Float32Array([Math.floor(a[0]), Math.floor(a[1]), Math.floor(a[2])]),

  /**
   * Euclidean length (magnitude) of a vector.
   * @param {Float32Array} a
   * @returns {number}
   */
  length: (a) => Math.hypot(a[0], a[1], a[2]) || 0,

  /**
   * Linear interpolation between a and b by t in [0,1].
   * @param {Float32Array} a
   * @param {Float32Array} b
   * @param {number} t
   * @returns {Float32Array}
   */
  lerp: (a, b, t) => new Float32Array([
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t
  ]),

  /**
   * Component-wise multiply of two vectors.
   * @param {Float32Array} a
   * @param {Float32Array} b
   * @returns {Float32Array}
   */
  mul: (a, b) => new Float32Array([a[0] * b[0], a[1] * b[1], a[2] * b[2]]),

  /**
   * Negate components of a vector.
   * @param {Float32Array} a
   * @returns {Float32Array}
   */
  negate: (a) => new Float32Array([-a[0], -a[1], -a[2]]),

  /**
   * Normalize a vector (returns unit vector). If length is zero, returns [0,0,0].
   * @param {Float32Array} a
   * @returns {Float32Array}
   */
  norm: (a) => {
    const L = Math.hypot(a[0], a[1], a[2]) || 1;
    return new Float32Array([a[0] / L, a[1] / L, a[2] / L]);
  },

  /**
   * Alias for normalize.
   * @param {Float32Array} a
   * @returns {Float32Array}
   */
  normalize: (a) => Vec3.norm(a),

  /**
   * Project vector a onto vector b (returns projection vector).
   * If b is zero-length, returns zero vector.
   * @param {Float32Array} a
   * @param {Float32Array} b
   * @returns {Float32Array}
   */
  project: (a, b) => {
    const bb = Vec3.dot(b, b);
    if (bb === 0) return Vec3.create(0, 0, 0);
    const s = Vec3.dot(a, b) / bb;
    return Vec3.scale(b, s);
  },

  /**
   * Reflect vector v around normal n. (n should be normalized for correct magnitude).
   * @param {Float32Array} v
   * @param {Float32Array} n
   * @returns {Float32Array}
   */
  reflect: (v, n) => {
    const d = Vec3.dot(v, n);
    return new Float32Array([
      v[0] - 2 * d * n[0],
      v[1] - 2 * d * n[1],
      v[2] - 2 * d * n[2]
    ]);
  },

  /**
   * Rotate point v around origin by angle (radians) about X axis.
   * @param {Float32Array} v
   * @param {Float32Array} origin
   * @param {number} angle radians
   * @returns {Float32Array}
   */
  rotateX: (v, origin, angle) => {
    const py = v[1] - origin[1];
    const pz = v[2] - origin[2];
    const sc = Math.sin(angle), cc = Math.cos(angle);
    return new Float32Array([v[0], origin[1] + py * cc - pz * sc, origin[2] + py * sc + pz * cc]);
  },

  /**
   * Rotate point v around origin by angle (radians) about Y axis.
   * @param {Float32Array} v
   * @param {Float32Array} origin
   * @param {number} angle radians
   * @returns {Float32Array}
   */
  rotateY: (v, origin, angle) => {
    const px = v[0] - origin[0];
    const pz = v[2] - origin[2];
    const sc = Math.sin(angle), cc = Math.cos(angle);
    return new Float32Array([origin[0] + pz * sc + px * cc, v[1], origin[2] + pz * cc - px * sc]);
  },

  /**
   * Rotate point v around origin by angle (radians) about Z axis.
   * @param {Float32Array} v
   * @param {Float32Array} origin
   * @param {number} angle radians
   * @returns {Float32Array}
   */
  rotateZ: (v, origin, angle) => {
    const px = v[0] - origin[0];
    const py = v[1] - origin[1];
    const sc = Math.sin(angle), cc = Math.cos(angle);
    return new Float32Array([origin[0] + px * cc - py * sc, origin[1] + px * sc + py * cc, v[2]]);
  },

  /**
   * Component-wise round.
   * @param {Float32Array} a
   * @returns {Float32Array}
   */
  round: (a) => new Float32Array([Math.round(a[0]), Math.round(a[1]), Math.round(a[2])]),

  /**
   * Scale a vector by a scalar.
   * @param {Float32Array} a
   * @param {number} s
   * @returns {Float32Array}
   */
  scale: (a, s) => new Float32Array([a[0] * s, a[1] * s, a[2] * s]),

  /**
   * Add a scaled vector to another: a + b * s
   * @param {Float32Array} a
   * @param {Float32Array} b
   * @param {number} s
   * @returns {Float32Array}
   */
  scaleAndAdd: (a, b, s) => new Float32Array([a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s]),

  /**
   * Create a new vector from components.
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @returns {Float32Array}
   */
  set: (x, y, z) => new Float32Array([x, y, z]),

  /**
   * Subtract vector b from a component-wise.
   * @param {Float32Array} a
   * @param {Float32Array} b
   * @returns {Float32Array}
   */
  sub: (a, b) => new Float32Array([a[0] - b[0], a[1] - b[1], a[2] - b[2]]),

  /**
   * Transform a direction vector by a 4x4 matrix (ignores translation component).
   * @param {Float32Array} v
   * @param {Float32Array|number[]} m 4x4 matrix in column-major order
   * @returns {Float32Array}
   */
  transformDirection: (v, m) => new Float32Array([
    m[0] * v[0] + m[4] * v[1] + m[8] * v[2],
    m[1] * v[0] + m[5] * v[1] + m[9] * v[2],
    m[2] * v[0] + m[6] * v[1] + m[10] * v[2]
  ]),

  /**
   * Transform a 3-component point by a 4x4 matrix. Applies perspective divide when w != 1.
   * @param {Float32Array} v
   * @param {Float32Array|number[]} m 4x4 matrix in column-major order
   * @returns {Float32Array}
   */
  transformMat4: (v, m) => {
    const x = m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12];
    const y = m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13];
    const z = m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14];
    const w = m[3] * v[0] + m[7] * v[1] + m[11] * v[2] + m[15];
    if (w === 0 || w === 1) return new Float32Array([x, y, z]);
    return new Float32Array([x / w, y / w, z / w]);
  }
};

export default Vec3;
