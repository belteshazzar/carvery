import { Mat4, Vec3 } from './math.js';

/**
 * Camera that orbits around a target point with spherical coordinates.
 */
export class OrbitCamera {
  /**
   * Creates a new orbit camera.
   *
   * @param {Object} options Camera initialization options
   * @param {number[]} [options.target=[0,0,0]] Target point to orbit around
   * @param {number} [options.radius=2.3] Initial distance from target
   * @param {number} [options.minRadius=0.3] Minimum allowed radius
   * @param {number} [options.maxRadius=100] Maximum allowed radius
   * @param {number} [options.theta=0.9] Initial horizontal angle in radians
   * @param {number} [options.phi=0.9] Initial vertical angle in radians
   */
  constructor({ target = [0, 0, 0], radius = 2.3, minRadius = 0.3, maxRadius = 100, theta = 0.9, phi = 0.9 } = {}) {
    this.target = Float32Array.from(target);
    this.radius = radius;
    this.minRadius = minRadius;
    this.maxRadius = maxRadius;
    this.theta = theta;
    this.phi = phi;
    this.up = Vec3.create(0, 1, 0);
  }

  /**
   * Clamps camera parameters to valid ranges.
   *
   * Ensures:
   * - Phi (vertical angle) between 0 and PI
   * - Radius between minRadius and maxRadius
   * - Theta (horizontal angle) wrapped to [-PI, PI]
   */
  clamp() {
    const eps = 0.001;
    const minPhi = 0 + eps;
    const maxPhi = Math.PI - eps;

    this.phi = Math.max(minPhi, Math.min(maxPhi, this.phi));
    this.radius = Math.max(this.minRadius, Math.min(this.maxRadius, this.radius));
    if (this.theta > Math.PI) this.theta -= 2 * Math.PI;
    if (this.theta < -Math.PI) this.theta += 2 * Math.PI;
  }

  /**
   * Calculates the camera position in world space.
   *
   * @returns {Float32Array} Camera position [x,y,z]
   */
  getEye() {
    const s = Math.sin(this.phi);
    const c = Math.cos(this.phi);
    const x = this.radius * Math.cos(this.theta) * s;
    const y = this.radius * c;
    const z = this.radius * Math.sin(this.theta) * s;

    return new Float32Array([this.target[0] + x, this.target[1] + y, this.target[2] + z]);
  }

  /**
   * Creates a view matrix for the current camera position.
   *
   * @returns {Mat4} View transformation matrix
   */
  view() {
    return Mat4.lookAt(this.getEye(), this.target, this.up);
  }
}

/*** ======= Wireframe Edge Mesh ======= ***/
export function makeCubeEdges() {
  const P = new Float32Array([
    -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, -0.5, -0.5, 0.5, -0.5,
    -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5, 0.5
  ]);
  const I = new Uint16Array([0, 1, 1, 2, 2, 3, 3, 0, 4, 5, 5, 6, 6, 7, 7, 4, 0, 4, 1, 5, 2, 6, 3, 7]);
  return { positions: P, indices: I, count: I.length };
}

// Add this new function to create axis gizmo geometry
export function makeAxisGizmo(sizeX = 16, sizeZ = 16) {
  const positions = [];
  const colors = [];
  


  // Grid color (subtle grey)
  const gridColor = [0.2, 0.2, 0.2];

  // // XY plane grid (floor)
  // for (let i = 0; i <= 16; i++) {
  //   // Vertical lines
  //   positions.push(i,0,0, i,16,0);
  //   colors.push(...gridColor, ...gridColor);
  //   // Horizontal lines
  //   positions.push(0,i,0, 16,i,0);
  //   colors.push(...gridColor, ...gridColor);
  // }

  // XZ plane grid (back)
  // Skip i=0 to avoid overlap with axis lines
  for (let i = 1; i <= sizeX; i++) {
    // Vertical lines (parallel to Z axis)
    positions.push(i,-0.01,0, i,-0.01,sizeZ);
    colors.push(...gridColor, ...gridColor);
  }
  
  for (let i = 1; i <= sizeZ; i++) {
    // Horizontal lines (parallel to X axis)
    positions.push(0,-0.01,i, sizeX,-0.01,i);
    colors.push(...gridColor, ...gridColor);
  }

  // // YZ plane grid (side)
  // for (let i = 0; i <= 16; i++) {
  //   // Vertical lines
  //   positions.push(0,i,0, 0,i,16);
  //   colors.push(...gridColor, ...gridColor);
  //   // Horizontal lines
  //   positions.push(0,0,i, 0,16,i);
  //   colors.push(...gridColor, ...gridColor);
  // }

    // Extended main axes (extend past grid by 4 units)
  const axisLength = Math.max(sizeX, sizeZ) + 4;
  positions.push(
    0,0,0, axisLength,0,0,  // X axis
    0,0,0, 0,axisLength,0,  // Y axis
    0,0,0, 0,0,axisLength   // Z axis
  );
  colors.push(
    1,0,0, 1,0,0,  // Red for X
    0,1,0, 0,1,0,  // Green for Y
    0,0,1, 0,0,1   // Blue for Z
  );
  
  return {
    positions: new Float32Array(positions),
    colors: new Float32Array(colors),
    count: positions.length / 3
  };
}

/**
 * Create a unit cube mesh for particle rendering
 * Centered at origin, size 1.0 in each dimension
 */
export function makeParticleCube() {
  // Cube vertices (8 corners of a unit cube centered at origin)
  const positions = new Float32Array([
    // Front face
    -0.5, -0.5,  0.5,
     0.5, -0.5,  0.5,
     0.5,  0.5,  0.5,
    -0.5,  0.5,  0.5,
    // Back face
    -0.5, -0.5, -0.5,
    -0.5,  0.5, -0.5,
     0.5,  0.5, -0.5,
     0.5, -0.5, -0.5,
    // Top face
    -0.5,  0.5, -0.5,
    -0.5,  0.5,  0.5,
     0.5,  0.5,  0.5,
     0.5,  0.5, -0.5,
    // Bottom face
    -0.5, -0.5, -0.5,
     0.5, -0.5, -0.5,
     0.5, -0.5,  0.5,
    -0.5, -0.5,  0.5,
    // Right face
     0.5, -0.5, -0.5,
     0.5,  0.5, -0.5,
     0.5,  0.5,  0.5,
     0.5, -0.5,  0.5,
    // Left face
    -0.5, -0.5, -0.5,
    -0.5, -0.5,  0.5,
    -0.5,  0.5,  0.5,
    -0.5,  0.5, -0.5
  ]);

  const normals = new Float32Array([
    // Front
     0,  0,  1,
     0,  0,  1,
     0,  0,  1,
     0,  0,  1,
    // Back
     0,  0, -1,
     0,  0, -1,
     0,  0, -1,
     0,  0, -1,
    // Top
     0,  1,  0,
     0,  1,  0,
     0,  1,  0,
     0,  1,  0,
    // Bottom
     0, -1,  0,
     0, -1,  0,
     0, -1,  0,
     0, -1,  0,
    // Right
     1,  0,  0,
     1,  0,  0,
     1,  0,  0,
     1,  0,  0,
    // Left
    -1,  0,  0,
    -1,  0,  0,
    -1,  0,  0,
    -1,  0,  0
  ]);

  const indices = new Uint16Array([
     0,  1,  2,    0,  2,  3,  // Front
     4,  5,  6,    4,  6,  7,  // Back
     8,  9, 10,    8, 10, 11,  // Top
    12, 13, 14,   12, 14, 15,  // Bottom
    16, 17, 18,   16, 18, 19,  // Right
    20, 21, 22,   20, 22, 23   // Left
  ]);

  return {
    positions,
    normals,
    indices,
    count: indices.length
  };
}

