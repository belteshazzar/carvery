
export const Vec3 = {
  create: (x = 0, y = 0, z = 0) => new Float32Array([x, y, z]),
  sub: (a, b) => new Float32Array([a[0] - b[0], a[1] - b[1], a[2] - b[2]]),
  norm: (a) => {
    const L = Math.hypot(a[0], a[1], a[2]) || 1;
    return new Float32Array([a[0] / L, a[1] / L, a[2] / L]);
  }
};

export const Mat4 = {
  identity: () => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]),
  perspective: (fovy, aspect, near, far) => {
    const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far), o = new Float32Array(16);
    o[0] = f / aspect;
    o[5] = f;
    o[10] = (far + near) * nf;
    o[11] = -1;
    o[14] = (2 * far * near) * nf;
    return o;
  },
  lookAt: (eye, target, up) => {
    const z = Vec3.norm(Vec3.sub(eye, target)),
      x = Vec3.norm(new Float32Array([up[1] * z[2] - up[2] * z[1], up[2] * z[0] - up[0] * z[2], up[0] * z[1] - up[1] * z[0]])),
      y = new Float32Array([z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]]);
    const o = new Float32Array(16);
    o[0] = x[0];
    o[1] = y[0];
    o[2] = z[0];
    o[4] = x[1];
    o[5] = y[1];
    o[6] = z[1];
    o[8] = x[2];
    o[9] = y[2];
    o[10] = z[2];
    o[12] = -(x[0] * eye[0] + x[1] * eye[1] + x[2] * eye[2]);
    o[13] = -(y[0] * eye[0] + y[1] * eye[1] + y[2] * eye[2]);
    o[14] = -(z[0] * eye[0] + z[1] * eye[1] + z[2] * eye[2]);
    o[15] = 1;
    return o;
  }
};
