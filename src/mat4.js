import {Vec3} from './vec3.js';

export const Mat4 = {
  identity: () => new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]),

  perspective: (fovy, aspect, near, far) => {
    const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far), o = new Float32Array(16);
    o[0] = f / aspect;
    o[5] = f;
    o[10] = (far + near) * nf;
    o[11] = -1;
    o[14] = (2 * far * near) * nf;
    return o;
  },

  orthographic: (left, right, bottom, top, near, far) => {
    const o = new Float32Array(16);
    const w = right - left; const h = top - bottom; const p = far - near;
    o[0] = 2 / w; o[5] = 2 / h; o[10] = -2 / p; o[15] = 1;
    o[12] = -(right + left) / w; o[13] = -(top + bottom) / h; o[14] = -(far + near) / p;
    return o;
  },

  frustum: (left, right, bottom, top, near, far) => {
    const o = new Float32Array(16);
    const rl = 1 / (right - left), tb = 1 / (top - bottom), nf = 1 / (near - far);
    o[0] = 2 * near * rl; o[5] = 2 * near * tb;
    o[8] = (right + left) * rl; o[9] = (top + bottom) * tb;
    o[10] = (far + near) * nf; o[11] = -1;
    o[14] = (2 * far * near) * nf;
    return o;
  },

  lookAt: (eye, target, up) => {
    const z = Vec3.norm(Vec3.sub(eye, target));
    const x = Vec3.norm(new Float32Array([up[1]*z[2] - up[2]*z[1], up[2]*z[0] - up[0]*z[2], up[0]*z[1] - up[1]*z[0]]));
    const y = new Float32Array([z[1]*x[2] - z[2]*x[1], z[2]*x[0] - z[0]*x[2], z[0]*x[1] - z[1]*x[0]]);
    const o = new Float32Array(16);
    o[0] = x[0]; o[1] = y[0]; o[2] = z[0]; o[3] = 0;
    o[4] = x[1]; o[5] = y[1]; o[6] = z[1]; o[7] = 0;
    o[8] = x[2]; o[9] = y[2]; o[10] = z[2]; o[11] = 0;
    o[12] = -(x[0]*eye[0] + x[1]*eye[1] + x[2]*eye[2]);
    o[13] = -(y[0]*eye[0] + y[1]*eye[1] + y[2]*eye[2]);
    o[14] = -(z[0]*eye[0] + z[1]*eye[1] + z[2]*eye[2]);
    o[15] = 1;
    return o;
  },

  translate: (x, y, z) => {
    const o = Mat4.identity(); o[12] = x; o[13] = y; o[14] = z; return o;
  },

  rotationX: (a) => {
    const c = Math.cos(a), s = Math.sin(a); const o = Mat4.identity();
    o[5] = c; o[6] = s; o[9] = -s; o[10] = c; return o;
  },

  rotationY: (a) => {
    const c = Math.cos(a), s = Math.sin(a); const o = Mat4.identity();
    o[0] = c; o[2] = -s; o[8] = s; o[10] = c; return o;
  },

  rotationZ: (a) => {
    const c = Math.cos(a), s = Math.sin(a); const o = Mat4.identity();
    o[0] = c; o[1] = s; o[4] = -s; o[5] = c; return o;
  },

  rotate: (angle, x, y, z) => {
    const len = Math.hypot(x, y, z); if (len === 0) return Mat4.identity(); x /= len; y /= len; z /= len;
    const c = Math.cos(angle), s = Math.sin(angle), t = 1 - c; const o = new Float32Array(16);
    o[0] = x*x*t + c; o[1] = y*x*t + z*s; o[2] = z*x*t - y*s; o[3]=0;
    o[4] = x*y*t - z*s; o[5]= y*y*t + c; o[6]= z*y*t + x*s; o[7]=0;
    o[8] = x*z*t + y*s; o[9]= y*z*t - x*s; o[10]= z*z*t + c; o[11]=0;
    o[12]=0; o[13]=0; o[14]=0; o[15]=1; return o;
  },

  scaleMatrix: (sx, sy, sz) => { const o = Mat4.identity(); o[0]=sx; o[5]=sy; o[10]=sz; return o; },

  fromTRS: (t, r, s) => {
    const S = Mat4.scaleMatrix(s[0], s[1], s[2]);
    const R = r; // assume already a 4x4 rotation matrix
    const T = Mat4.translate(t[0], t[1], t[2]);
    return Mat4.multiply(T, R, S);
  },

  multiply: (...matrices) => {
    if (matrices.length === 0) return Mat4.identity();
    if (matrices.length === 1) return matrices[0];
    let result = matrices[0];
    for (let i = 1; i < matrices.length; i++) result = Mat4.multiplyTwo(result, matrices[i]);
    return result;
  },

  multiplyTwo: (a, b) => {
    const o = new Float32Array(16);
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        o[j*4 + i] = a[0*4 + i]*b[j*4 + 0] + a[1*4 + i]*b[j*4 + 1] + a[2*4 + i]*b[j*4 + 2] + a[3*4 + i]*b[j*4 + 3];
      }
    }
    return o;
  },

  transpose: (m) => {
    const o = new Float32Array(16);
    o[0]=m[0]; o[1]=m[4]; o[2]=m[8]; o[3]=m[12];
    o[4]=m[1]; o[5]=m[5]; o[6]=m[9]; o[7]=m[13];
    o[8]=m[2]; o[9]=m[6]; o[10]=m[10]; o[11]=m[14];
    o[12]=m[3]; o[13]=m[7]; o[14]=m[11]; o[15]=m[15];
    return o;
  },

  invert: (m) => {
    const a = m; const o = new Float32Array(16);
    const b00 = a[0]*a[5] - a[1]*a[4];
    const b01 = a[0]*a[6] - a[2]*a[4];
    const b02 = a[0]*a[7] - a[3]*a[4];
    const b03 = a[1]*a[6] - a[2]*a[5];
    const b04 = a[1]*a[7] - a[3]*a[5];
    const b05 = a[2]*a[7] - a[3]*a[6];
    const b06 = a[8]*a[13] - a[9]*a[12];
    const b07 = a[8]*a[14] - a[10]*a[12];
    const b08 = a[8]*a[15] - a[11]*a[12];
    const b09 = a[9]*a[14] - a[10]*a[13];
    const b10 = a[9]*a[15] - a[11]*a[13];
    const b11 = a[10]*a[15] - a[11]*a[14];
    const det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
    if (!det) return null;
    const invDet = 1.0 / det;
    o[0] = ( a[5] * b11 - a[6] * b10 + a[7] * b09) * invDet;
    o[1] = (-a[1] * b11 + a[2] * b10 - a[3] * b09) * invDet;
    o[2] = ( a[13]*b05 - a[14]*b04 + a[15]*b03) * invDet;
    o[3] = (-a[9] * b05 + a[10]*b04 - a[11]*b03) * invDet;
    o[4] = (-a[4]*b11 + a[6]*b08 - a[7]*b07) * invDet;
    o[5] = ( a[0]*b11 - a[2]*b08 + a[3]*b07) * invDet;
    o[6] = (-a[12]*b05 + a[14]*b02 - a[15]*b01) * invDet;
    o[7] = ( a[8]*b05 - a[10]*b02 + a[11]*b01) * invDet;
    o[8] = ( a[4]*b10 - a[5]*b08 + a[7]*b06) * invDet;
    o[9] = (-a[0]*b10 + a[1]*b08 - a[3]*b06) * invDet;
    o[10]= ( a[12]*b04 - a[13]*b02 + a[15]*b00) * invDet;
    o[11]= (-a[8]*b04 + a[9]*b02 - a[11]*b00) * invDet;
    o[12]= (-a[4]*b09 + a[5]*b07 - a[6]*b06) * invDet;
    o[13]= ( a[0]*b09 - a[1]*b07 + a[2]*b06) * invDet;
    o[14]= (-a[12]*b03 + a[13]*b01 - a[14]*b00) * invDet;
    o[15]= ( a[8]*b03 - a[9]*b01 + a[10]*b00) * invDet;
    return o;
  },

  transform: (m, v) => {
    const x = v[0], y = v[1], z = v[2]; const w = v.length === 4 ? v[3] : 1;
    return [m[0]*x + m[4]*y + m[8]*z + m[12]*w,
            m[1]*x + m[5]*y + m[9]*z + m[13]*w,
            m[2]*x + m[6]*y + m[10]*z + m[14]*w,
            m[3]*x + m[7]*y + m[11]*z + m[15]*w];
  },

  transformPoint: (m, v) => {
    const x = m[0]*v[0] + m[4]*v[1] + m[8]*v[2] + m[12];
    const y = m[1]*v[0] + m[5]*v[1] + m[9]*v[2] + m[13];
    const z = m[2]*v[0] + m[6]*v[1] + m[10]*v[2] + m[14];
    const w = m[3]*v[0] + m[7]*v[1] + m[11]*v[2] + m[15];
    if (w === 0 || w === 1) return new Float32Array([x, y, z]);
    return new Float32Array([x / w, y / w, z / w]);
  },

  transformDirection: (m, v) => new Float32Array([
    m[0]*v[0] + m[4]*v[1] + m[8]*v[2],
    m[1]*v[0] + m[5]*v[1] + m[9]*v[2],
    m[2]*v[0] + m[6]*v[1] + m[10]*v[2]
  ]),

  normalMatrix: (m) => {
    const a00 = m[0], a01 = m[4], a02 = m[8];
    const a10 = m[1], a11 = m[5], a12 = m[9];
    const a20 = m[2], a21 = m[6], a22 = m[10];
    const det = a00*(a11*a22 - a12*a21) - a01*(a10*a22 - a12*a20) + a02*(a10*a21 - a11*a20);
    if (!det) return new Float32Array([1,0,0, 0,1,0, 0,0,1]);
    const id = 1 / det;
    const r00 = (a11*a22 - a12*a21) * id;
    const r01 = (a02*a21 - a01*a22) * id;
    const r02 = (a01*a12 - a02*a11) * id;
    const r10 = (a12*a20 - a10*a22) * id;
    const r11 = (a00*a22 - a02*a20) * id;
    const r12 = (a02*a10 - a00*a12) * id;
    const r20 = (a10*a21 - a11*a20) * id;
    const r21 = (a01*a20 - a00*a21) * id;
    const r22 = (a00*a11 - a01*a10) * id;
    return new Float32Array([r00, r01, r02, r10, r11, r12, r20, r21, r22]);
  }
};
