import {describe, it, expect} from 'vitest';
import {Mat4} from '../src/mat4.js';

const IDENTITY = new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);

const approxMatrix = (actual, expected, epsilon = 1e-6) => {
  expect(actual.length).toBe(expected.length);
  for (let i = 0; i < actual.length; i++) {
    expect(Math.abs(actual[i] - expected[i])).toBeLessThanOrEqual(epsilon);
  }
};

const createIdentity = () => new Float32Array(IDENTITY);

const makePerspective = (fovy, aspect, near, far) => {
  const f = 1 / Math.tan(fovy / 2);
  const nf = 1 / (near - far);
  const o = new Float32Array(16);
  o[0] = f / aspect;
  o[5] = f;
  o[10] = (far + near) * nf;
  o[11] = -1;
  o[14] = (2 * far * near) * nf;
  return o;
};

const makeOrthographic = (left, right, bottom, top, near, far) => {
  const o = new Float32Array(16);
  const w = right - left;
  const h = top - bottom;
  const p = far - near;
  o[0] = 2 / w;
  o[5] = 2 / h;
  o[10] = -2 / p;
  o[12] = -(right + left) / w;
  o[13] = -(top + bottom) / h;
  o[14] = -(far + near) / p;
  o[15] = 1;
  return o;
};

const makeFrustum = (left, right, bottom, top, near, far) => {
  const o = new Float32Array(16);
  const rl = 1 / (right - left);
  const tb = 1 / (top - bottom);
  const nf = 1 / (near - far);
  o[0] = (2 * near) * rl;
  o[5] = (2 * near) * tb;
  o[8] = (right + left) * rl;
  o[9] = (top + bottom) * tb;
  o[10] = (far + near) * nf;
  o[11] = -1;
  o[14] = (2 * far * near) * nf;
  return o;
};

const makeTranslation = (x, y, z) => {
  const o = createIdentity();
  o[12] = x;
  o[13] = y;
  o[14] = z;
  return o;
};

const rotationAxisMatrix = (angle, x, y, z) => {
  let len = Math.hypot(x, y, z);
  if (len === 0) return createIdentity();
  len = 1 / len;
  x *= len; y *= len; z *= len;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const t = 1 - c;
  const o = new Float32Array(16);
  o[0] = x * x * t + c;
  o[1] = y * x * t + z * s;
  o[2] = z * x * t - y * s;
  o[4] = x * y * t - z * s;
  o[5] = y * y * t + c;
  o[6] = z * y * t + x * s;
  o[8] = x * z * t + y * s;
  o[9] = y * z * t - x * s;
  o[10] = z * z * t + c;
  o[15] = 1;
  return o;
};

const makeRotationX = (angle) => {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const o = createIdentity();
  o[5] = c;
  o[6] = s;
  o[9] = -s;
  o[10] = c;
  return o;
};

const makeRotationY = (angle) => {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const o = createIdentity();
  o[0] = c;
  o[2] = -s;
  o[8] = s;
  o[10] = c;
  return o;
};

const makeRotationZ = (angle) => {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const o = createIdentity();
  o[0] = c;
  o[1] = s;
  o[4] = -s;
  o[5] = c;
  return o;
};

const makeScale = (sx, sy, sz) => {
  const o = createIdentity();
  o[0] = sx;
  o[5] = sy;
  o[10] = sz;
  return o;
};

const vec3Sub = (a, b) => new Float32Array([a[0] - b[0], a[1] - b[1], a[2] - b[2]]);
const vec3Cross = (a, b) => new Float32Array([
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0]
]);
const vec3Dot = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
const vec3Norm = (v) => {
  const len = Math.hypot(v[0], v[1], v[2]);
  if (!len) return new Float32Array([0, 0, 0]);
  return new Float32Array([v[0] / len, v[1] / len, v[2] / len]);
};

const makeLookAt = (eye, target, up) => {
  const z = vec3Norm(vec3Sub(eye, target));
  const x = vec3Norm(vec3Cross(up, z));
  const y = vec3Cross(z, x);
  const o = new Float32Array(16);
  o[0] = x[0]; o[1] = y[0]; o[2] = z[0];
  o[4] = x[1]; o[5] = y[1]; o[6] = z[1];
  o[8] = x[2]; o[9] = y[2]; o[10] = z[2];
  o[12] = -vec3Dot(x, eye);
  o[13] = -vec3Dot(y, eye);
  o[14] = -vec3Dot(z, eye);
  o[15] = 1;
  return o;
};

const multiplyMatrices = (a, b) => {
  const o = new Float32Array(16);
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      o[j * 4 + i] =
        a[0 * 4 + i] * b[j * 4 + 0] +
        a[1 * 4 + i] * b[j * 4 + 1] +
        a[2 * 4 + i] * b[j * 4 + 2] +
        a[3 * 4 + i] * b[j * 4 + 3];
    }
  }
  return o;
};

const transposeMatrix = (m) => {
  const o = new Float32Array(16);
  o[0]=m[0]; o[1]=m[4]; o[2]=m[8]; o[3]=m[12];
  o[4]=m[1]; o[5]=m[5]; o[6]=m[9]; o[7]=m[13];
  o[8]=m[2]; o[9]=m[6]; o[10]=m[10]; o[11]=m[14];
  o[12]=m[3]; o[13]=m[7]; o[14]=m[11]; o[15]=m[15];
  return o;
};

const approxIdentity = (mat, epsilon = 1e-5) => approxMatrix(mat, IDENTITY, epsilon);

describe('Mat4 helper outputs', () => {
  it('builds expected projection matrices', () => {
    const perspective = Mat4.perspective(Math.PI / 3, 16 / 9, 0.1, 50);
    approxMatrix(perspective, makePerspective(Math.PI / 3, 16 / 9, 0.1, 50));

    const ortho = Mat4.orthographic(-2, 3, -1, 5, 0.5, 10);
    approxMatrix(ortho, makeOrthographic(-2, 3, -1, 5, 0.5, 10));

    const frustum = Mat4.frustum(-1, 1, -0.5, 0.5, 0.5, 40);
    approxMatrix(frustum, makeFrustum(-1, 1, -0.5, 0.5, 0.5, 40));

    const identity = Mat4.identity();
    approxMatrix(identity, IDENTITY);
  });

  it('computes expected view and translation matrices', () => {
    const eye = new Float32Array([3, 4, 10]);
    const target = new Float32Array([1, -2, 0]);
    const up = new Float32Array([0, 1, 0]);
    const lookAt = Mat4.lookAt(eye, target, up);
    approxMatrix(lookAt, makeLookAt(eye, target, up));

    const translate = Mat4.translate(5, -3, 2);
    approxMatrix(translate, makeTranslation(5, -3, 2));
  });

  it('builds rotation and scale matrices aligned with standard formulas', () => {
    const rx = Mat4.rotationX(Math.PI / 4);
    approxMatrix(rx, makeRotationX(Math.PI / 4));

    const ry = Mat4.rotationY(-Math.PI / 3);
    approxMatrix(ry, makeRotationY(-Math.PI / 3));

    const rz = Mat4.rotationZ(Math.PI / 6);
    approxMatrix(rz, makeRotationZ(Math.PI / 6));

    const axisRotate = Mat4.rotate(Math.PI / 5, 1, 2, 3);
    approxMatrix(axisRotate, rotationAxisMatrix(Math.PI / 5, 1, 2, 3));

    const scale = Mat4.scaleMatrix(2, 3, 4);
    approxMatrix(scale, makeScale(2, 3, 4));
  });

  it('multiplies, transposes, and inverts matrices correctly', () => {
    const a = Mat4.rotate(0.3, 0.5, 0.5, 0.1);
    const b = Mat4.translate(1, 2, 3);
    const c = Mat4.scaleMatrix(0.5, 1.5, -2);

    const expectedMul = multiplyMatrices(multiplyMatrices(a, b), c);
    const actualMul = Mat4.multiply(a, b, c);
    approxMatrix(actualMul, expectedMul);

    const expectedTranspose = transposeMatrix(actualMul);
    const actualTranspose = Mat4.transpose(actualMul);
    approxMatrix(actualTranspose, expectedTranspose);

    const inverse = Mat4.invert(actualMul);
    expect(inverse).not.toBeNull();
    approxIdentity(multiplyMatrices(actualMul, inverse));
    approxIdentity(multiplyMatrices(inverse, actualMul));
  });
});
