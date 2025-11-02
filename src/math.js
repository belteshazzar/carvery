
export const Vec3 = {
  /**
   * Creates a new 3D vector as Float32Array
   * @param {number} [x=0] X component
   * @param {number} [y=0] Y component
   * @param {number} [z=0] Z component
   * @returns {Float32Array} New vector [x,y,z]
   */
  create: (x = 0, y = 0, z = 0) => new Float32Array([x, y, z]),

  /**
   * Subtracts vector b from vector a
   * @param {Float32Array} a First vector
   * @param {Float32Array} b Vector to subtract
   * @returns {Float32Array} Result of a - b
   */
  sub: (a, b) => new Float32Array([a[0] - b[0], a[1] - b[1], a[2] - b[2]]),

  /**
   * Normalizes a vector to unit length
   * @param {Float32Array} a Vector to normalize
   * @returns {Float32Array} Normalized vector (or [1,0,0] if input was zero)
   */
  norm: (a) => {
    const L = Math.hypot(a[0], a[1], a[2]) || 1;
    return new Float32Array([a[0] / L, a[1] / L, a[2] / L]);
  }
};

export const Mat4 = {
  /**
   * Creates a 4x4 identity matrix
   * @returns {Float32Array} New identity matrix (16 elements)
   */
  identity: () => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]),

  /**
   * Creates a perspective projection matrix
   * @param {number} fovy Vertical field of view in radians
   * @param {number} aspect Aspect ratio (width/height)
   * @param {number} near Near clipping plane distance
   * @param {number} far Far clipping plane distance
   * @returns {Float32Array} New perspective matrix (16 elements)
   */
  perspective: (fovy, aspect, near, far) => {
    const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far), o = new Float32Array(16);
    o[0] = f / aspect;
    o[5] = f;
    o[10] = (far + near) * nf;
    o[11] = -1;
    o[14] = (2 * far * near) * nf;
    return o;
  },

  /**
   * Creates a view matrix looking from eye point at target point
   * @param {Float32Array} eye Camera position
   * @param {Float32Array} target Point to look at
   * @param {Float32Array} up Up vector (typically [0,1,0])
   * @returns {Float32Array} New view matrix (16 elements)
   */
  lookAt: (eye, target, up) => {
    // Calculate camera basis vectors
    const z = Vec3.norm(Vec3.sub(eye, target));
    const x = Vec3.norm(new Float32Array([up[1] * z[2] - up[2] * z[1], up[2] * z[0] - up[0] * z[2], up[0] * z[1] - up[1] * z[0]]));
    const y = new Float32Array([z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]]);
    const o = new Float32Array(16);
    // First three rows are the camera basis vectors
    o[0] = x[0];
    o[1] = y[0];
    o[2] = z[0];
    o[4] = x[1];
    o[5] = y[1];
    o[6] = z[1];
    o[8] = x[2];
    o[9] = y[2];
    o[10] = z[2];
    // Last row is the translation
    o[12] = -(x[0] * eye[0] + x[1] * eye[1] + x[2] * eye[2]);
    o[13] = -(y[0] * eye[0] + y[1] * eye[1] + y[2] * eye[2]);
    o[14] = -(z[0] * eye[0] + z[1] * eye[1] + z[2] * eye[2]);
    o[15] = 1;
    return o;
  }
};
