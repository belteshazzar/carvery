import { describe, it, expect } from 'vitest';
import { Vec3 } from '../src/vec3.js';

const approxVec = (actual, expected, digits = 6) => {
  expect(actual.length).toBe(expected.length);
  for (let i = 0; i < actual.length; i++) {
    expect(actual[i]).toBeCloseTo(expected[i], digits);
  }
};

describe('Vec3 helpers', () => {
  it('create returns the provided components', () => {
    const v = Vec3.create(1, 2, 3);
    approxVec(v, [1, 2, 3]);
  });

  it('add, sub, scale, mul', () => {
    const a = Vec3.create(1, 2, 3);
    const b = Vec3.create(4, 5, 6);
    approxVec(Vec3.add(a, b), [5, 7, 9]);
    approxVec(Vec3.sub(b, a), [3, 3, 3]);
    approxVec(Vec3.scale(a, -2), [-2, -4, -6]);
    approxVec(Vec3.mul(a, b), [4, 10, 18]);
  });

  it('dot, length, distance', () => {
    const a = Vec3.create(1, 2, 3);
    const b = Vec3.create(4, -5, 6);
    expect(Vec3.dot(a, b)).toBeCloseTo(12);
    expect(Vec3.length(a)).toBeCloseTo(Math.sqrt(14));
    expect(Vec3.distance(a, b)).toBeCloseTo(Math.sqrt((1 - 4) ** 2 + (2 + 5) ** 2 + (3 - 6) ** 2));
  });

  it('cross produces a perpendicular vector', () => {
    const a = Vec3.create(1, 0, 0);
    const b = Vec3.create(0, 1, 0);
    approxVec(Vec3.cross(a, b), [0, 0, 1]);
  });

  it('norm/normalize produce unit vectors with same direction', () => {
    const a = Vec3.create(1, 2, 3);
    const len = Math.hypot(1, 2, 3);
    approxVec(Vec3.norm(a), [1 / len, 2 / len, 3 / len]);
    approxVec(Vec3.normalize(a), [1 / len, 2 / len, 3 / len]);
  });

  it('lerp interpolates between vectors', () => {
    const a = Vec3.create(0, 0, 0);
    const b = Vec3.create(10, 20, 30);
    approxVec(Vec3.lerp(a, b, 0.25), [2.5, 5, 7.5]);
  });

  it('transformMat4 applies 4x4 transforms with perspective divide', () => {
    const v = Vec3.create(1, 2, 3);
    const m = [
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      10, 20, 30, 1
    ];
    approxVec(Vec3.transformMat4(v, m), [11, 22, 33]);
  });

  it('transformDirection ignores translation (uses linear part only)', () => {
    const dir = Vec3.create(0, 1, 0);
    const m = [
      2, 0, 0, 0,
      0, 3, 0, 0,
      0, 0, 4, 0,
      10, 20, 30, 1
    ];
    approxVec(Vec3.transformDirection(dir, m), [0, 3, 0]);
  });

  it('clamp limits components with scalar or vector ranges', () => {
    const v = Vec3.create(-5, 0.5, 20);
    approxVec(Vec3.clamp(v, -1, 1), [-1, 0.5, 1]);
    const min = Vec3.create(-2, 0, 2);
    const max = Vec3.create(0, 1, 10);
    approxVec(Vec3.clamp(v, min, max), [-2, 0.5, 10]);
  });

  it('reflect follows r = v - 2 * dot(v,n) * n', () => {
    const v = Vec3.create(1, -1, 0);
    const n = Vec3.create(0, 1, 0);
    const dot = v[0] * n[0] + v[1] * n[1] + v[2] * n[2];
    const expected = [
      v[0] - 2 * dot * n[0],
      v[1] - 2 * dot * n[1],
      v[2] - 2 * dot * n[2]
    ];
    approxVec(Vec3.reflect(v, n), expected);
  });

  it('project computes vector projection onto a basis vector', () => {
    const a = Vec3.create(3, 4, 0);
    const b = Vec3.create(1, 0, 0);
    const scalar = (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (b[0] ** 2 + b[1] ** 2 + b[2] ** 2);
    approxVec(Vec3.project(a, b), [scalar * b[0], scalar * b[1], scalar * b[2]]);
  });

  it('normalize handles zero vector safely', () => {
    const r = Vec3.norm(Vec3.create(0, 0, 0));
    approxVec(r, [0, 0, 0]);
  });

  it('ceil/floor/round/clone/copy/negate behave like Math.*', () => {
    const a = Vec3.create(1.1, -2.6, 3.5);
    approxVec(Vec3.ceil(a), [Math.ceil(1.1), Math.ceil(-2.6), Math.ceil(3.5)]);
    approxVec(Vec3.floor(a), [Math.floor(1.1), Math.floor(-2.6), Math.floor(3.5)]);
    approxVec(Vec3.round(a), [Math.round(1.1), Math.round(-2.6), Math.round(3.5)]);
    approxVec(Vec3.clone(a), [1.1, -2.6, 3.5]);
    approxVec(Vec3.copy(a), [1.1, -2.6, 3.5]);
    approxVec(Vec3.negate(a), [-1.1, 2.6, -3.5]);
  });

  it('scaleAndAdd and set', () => {
    const a = Vec3.create(1, 2, 3);
    const b = Vec3.create(2, 3, 4);
    approxVec(Vec3.scaleAndAdd(a, b, 0.5), [2, 3.5, 5]);
    approxVec(Vec3.set(7, 8, 9), [7, 8, 9]);
  });

  it('rotateX/Y/Z apply correct rotations about an arbitrary origin', () => {
    const v = Vec3.create(2, 3, 4);
    const origin = Vec3.create(1, 1, 1);
    const angle = Math.PI / 4;
    const sin = Math.sin(angle);
    const cos = Math.cos(angle);
    const rel = (vec) => [vec[0] - origin[0], vec[1] - origin[1], vec[2] - origin[2]];

    const relVec = rel(v);
    const rxExp = [
      origin[0] + relVec[0],
      origin[1] + relVec[1] * cos - relVec[2] * sin,
      origin[2] + relVec[1] * sin + relVec[2] * cos
    ];
    approxVec(Vec3.rotateX(v, origin, angle), rxExp);

    const ryExp = [
      origin[0] + relVec[0] * cos + relVec[2] * sin,
      origin[1] + relVec[1],
      origin[2] - relVec[0] * sin + relVec[2] * cos
    ];
    approxVec(Vec3.rotateY(v, origin, angle), ryExp);

    const rzExp = [
      origin[0] + relVec[0] * cos - relVec[1] * sin,
      origin[1] + relVec[0] * sin + relVec[1] * cos,
      origin[2] + relVec[2]
    ];
    approxVec(Vec3.rotateZ(v, origin, angle), rzExp);
  });
});

