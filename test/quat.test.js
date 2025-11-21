import {describe, it, expect} from 'vitest';
import glQuat from 'gl-quat';
import {Quat} from '../src/quat.js';

const approxQuat = (actual, expected, epsilon = 1e-6) => {
  expect(actual.length).toBe(expected.length);
  for (let i = 0; i < actual.length; i++) {
    expect(Math.abs(actual[i] - expected[i])).toBeLessThanOrEqual(epsilon);
  }
};

const outQuat = () => new Float32Array(4);

describe('Quat matches gl-quat outputs', () => {
  it('constructors and arithmetic align with gl-quat', () => {
    approxQuat(Quat.create(), glQuat.create());
    approxQuat(Quat.identity(), glQuat.identity(outQuat()));

    const a = Quat.fromValues(0.2, -0.3, 0.1, 0.9);
    const b = Quat.fromValues(-0.5, 0.25, 0.4, -0.1);

    approxQuat(Quat.add(a, b), glQuat.add(outQuat(), a, b));
    approxQuat(Quat.scale(a, 2.5), glQuat.scale(outQuat(), a, 2.5));
    expect(Quat.dot(a, b)).toBeCloseTo(glQuat.dot(a, b));
    expect(Quat.length(a)).toBeCloseTo(glQuat.length(a));
    expect(Quat.squaredLength(a)).toBeCloseTo(glQuat.squaredLength(a));
  });

  it('normalize, conjugate, invert, and calculateW match gl-quat', () => {
    const q = Quat.fromValues(0.4, -0.2, 0.1, 0.5);

    approxQuat(Quat.normalize(q), glQuat.normalize(outQuat(), q));
    approxQuat(Quat.conjugate(q), glQuat.conjugate(outQuat(), q));
    approxQuat(Quat.invert(q), glQuat.invert(outQuat(), q));
    approxQuat(Quat.calculateW(q), glQuat.calculateW(outQuat(), q));
  });

  it('axis helpers, rotate operations, and multiplication align with gl-quat', () => {
    const axis = new Float32Array([0.3, 0.4, 0.5]);
    const angle = Math.PI / 3;
    approxQuat(Quat.fromAxisAngle(axis, angle), glQuat.setAxisAngle(outQuat(), axis, angle));

    const base = Quat.fromValues(0.2, 0.5, -0.3, 0.7);
    approxQuat(Quat.rotateX(base, 0.3), glQuat.rotateX(outQuat(), base, 0.3));
    approxQuat(Quat.rotateY(base, -0.4), glQuat.rotateY(outQuat(), base, -0.4));
    approxQuat(Quat.rotateZ(base, 0.9), glQuat.rotateZ(outQuat(), base, 0.9));

    const q1 = Quat.fromValues(0.25, -0.5, 0.1, 0.8);
    const q2 = Quat.fromValues(-0.2, 0.3, 0.4, 0.6);
    approxQuat(Quat.multiply(q1, q2), glQuat.multiply(outQuat(), q1, q2));
  });

  it('interpolation and fromMat3 stay in sync with gl-quat', () => {
    const q1 = Quat.fromValues(0.3, -0.6, 0.2, 0.7);
    const q2 = Quat.fromValues(-0.1, 0.4, -0.3, 0.5);

    approxQuat(Quat.lerp(q1, q2, 0.35), glQuat.lerp(outQuat(), q1, q2, 0.35));
    approxQuat(Quat.slerp(q1, q2, 0.72), glQuat.slerp(outQuat(), q1, q2, 0.72));

    const rotY = Math.PI / 6;
    const rotZ = Math.PI / 4;
    const cosY = Math.cos(rotY), sinY = Math.sin(rotY);
    const cosZ = Math.cos(rotZ), sinZ = Math.sin(rotZ);
    const mat3 = new Float32Array([
      cosY * cosZ, -sinZ, sinY * cosZ,
      cosY * sinZ, cosZ, sinY * sinZ,
      -sinY, 0, cosY
    ]);
    approxQuat(Quat.fromMat3(mat3), glQuat.fromMat3(outQuat(), mat3));
  });
});
