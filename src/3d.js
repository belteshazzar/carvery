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

// Generate sphere geometry using UV sphere algorithm
export function createSphere(radius = 0.5, segments = 32, rings = 16) {
  const positions = [];
  const normals = [];
  const indices = [];

  // Generate vertices
  for (let ring = 0; ring <= rings; ring++) {
    const phi = (ring / rings) * Math.PI; // 0 to PI
    const y = Math.cos(phi);
    const ringRadius = Math.sin(phi);

    for (let seg = 0; seg <= segments; seg++) {
      const theta = (seg / segments) * Math.PI * 2; // 0 to 2PI
      const x = ringRadius * Math.cos(theta);
      const z = ringRadius * Math.sin(theta);

      // Position
      positions.push(x * radius, y * radius, z * radius);

      // Normal (normalized position for a sphere centered at origin)
      normals.push(x, y, z);
    }
  }

  // Generate indices
  for (let ring = 0; ring < rings; ring++) {
    for (let seg = 0; seg < segments; seg++) {
      const current = ring * (segments + 1) + seg;
      const next = current + segments + 1;

      // Two triangles per quad
      indices.push(current, next, current + 1);
      indices.push(current + 1, next, next + 1);
    }
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices: new Uint32Array(indices)
  };
}

/**
 * Creates a ring/torus geometry (like Saturn's rings or asteroid belt)
 * 
 * @param {number} innerRadius - Inner radius of the ring
 * @param {number} outerRadius - Outer radius of the ring
 * @param {number} segments - Number of radial segments (around the circle)
 * @param {number} rings - Number of concentric rings (radial divisions)
 * @returns {Object} Geometry with positions, normals, and indices
 */
export function createRing(innerRadius = 0.5, outerRadius = 1.0, segments = 64, rings = 2) {
  const positions = [];
  const normals = [];
  const indices = [];

  // Generate vertices
  for (let ring = 0; ring <= rings; ring++) {
    const radius = innerRadius + (outerRadius - innerRadius) * (ring / rings);

    for (let seg = 0; seg <= segments; seg++) {
      const theta = (seg / segments) * Math.PI * 2;
      const x = Math.cos(theta) * radius;
      const z = Math.sin(theta) * radius;

      // Position (flat ring in XZ plane)
      positions.push(x, 0, z);

      // Normal (pointing up for a flat ring)
      normals.push(0, 1, 0);
    }
  }

  // Generate indices for top face
  for (let ring = 0; ring < rings; ring++) {
    for (let seg = 0; seg < segments; seg++) {
      const current = ring * (segments + 1) + seg;
      const next = current + segments + 1;

      // Two triangles per quad
      indices.push(current, next, current + 1);
      indices.push(current + 1, next, next + 1);
    }
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices: new Uint32Array(indices)
  };
}

// Generate cone geometry
export function createCone(radius = 0.5, height = 1.0, segments = 32) {
  const positions = [];
  const normals = [];
  const indices = [];

  const halfHeight = height / 2;
  
  // Calculate the slope angle for proper normals
  const slant = Math.sqrt(radius * radius + height * height);
  const normalY = radius / slant;
  const normalXZ = height / slant;

  // Apex (tip) of the cone
  const apexIndex = 0;
  positions.push(0, halfHeight, 0);
  normals.push(0, 1, 0); // Normal will be averaged

  // Generate base ring vertices (for the sides)
  for (let seg = 0; seg <= segments; seg++) {
    const theta = (seg / segments) * Math.PI * 2;
    const x = Math.cos(theta);
    const z = Math.sin(theta);

    // Position
    positions.push(x * radius, -halfHeight, z * radius);

    // Normal (points outward from cone surface)
    normals.push(x * normalXZ, normalY, z * normalXZ);
  }

  // Generate side triangles (from apex to base ring)
  for (let seg = 0; seg < segments; seg++) {
    const current = seg + 1;
    const next = seg + 2;

    indices.push(apexIndex, next, current);
  }

  // Generate base cap
  const baseCenterIndex = positions.length / 3;
  positions.push(0, -halfHeight, 0);
  normals.push(0, -1, 0);

  for (let seg = 0; seg <= segments; seg++) {
    const theta = (seg / segments) * Math.PI * 2;
    const x = Math.cos(theta);
    const z = Math.sin(theta);

    positions.push(x * radius, -halfHeight, z * radius);
    normals.push(0, -1, 0);
  }

  for (let seg = 0; seg < segments; seg++) {
    indices.push(baseCenterIndex, baseCenterIndex + seg + 1, baseCenterIndex + seg + 2);
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices: new Uint32Array(indices)
  };
}

// Generate cylinder geometry
export function createCylinder(radius = 0.5, height = 1.0, segments = 32) {
  const positions = [];
  const normals = [];
  const indices = [];

  const halfHeight = height / 2;

  // Generate side vertices (two rings - top and bottom)
  for (let i = 0; i <= 1; i++) {
    const y = i === 0 ? -halfHeight : halfHeight;
    
    for (let seg = 0; seg <= segments; seg++) {
      const theta = (seg / segments) * Math.PI * 2;
      const x = Math.cos(theta);
      const z = Math.sin(theta);

      // Position
      positions.push(x * radius, y, z * radius);

      // Normal (perpendicular to cylinder axis, points outward)
      normals.push(x, 0, z);
    }
  }

  // Generate side indices
  for (let seg = 0; seg < segments; seg++) {
    const current = seg;
    const next = seg + 1;
    const currentTop = seg + (segments + 1);
    const nextTop = next + (segments + 1);

    // Two triangles per quad
    indices.push(current, currentTop, next);
    indices.push(next, currentTop, nextTop);
  }

  // Generate bottom cap
  const bottomCenterIndex = positions.length / 3;
  positions.push(0, -halfHeight, 0);
  normals.push(0, -1, 0);

  for (let seg = 0; seg <= segments; seg++) {
    const theta = (seg / segments) * Math.PI * 2;
    const x = Math.cos(theta);
    const z = Math.sin(theta);

    positions.push(x * radius, -halfHeight, z * radius);
    normals.push(0, -1, 0);
  }

  for (let seg = 0; seg < segments; seg++) {
    indices.push(bottomCenterIndex, bottomCenterIndex + seg + 1, bottomCenterIndex + seg + 2);
  }

  // Generate top cap
  const topCenterIndex = positions.length / 3;
  positions.push(0, halfHeight, 0);
  normals.push(0, 1, 0);

  for (let seg = 0; seg <= segments; seg++) {
    const theta = (seg / segments) * Math.PI * 2;
    const x = Math.cos(theta);
    const z = Math.sin(theta);

    positions.push(x * radius, halfHeight, z * radius);
    normals.push(0, 1, 0);
  }

  for (let seg = 0; seg < segments; seg++) {
    indices.push(topCenterIndex, topCenterIndex + seg + 2, topCenterIndex + seg + 1);
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices: new Uint32Array(indices)
  };
}

// Generate torus geometry
export function createTorus(majorRadius = 0.5, minorRadius = 0.2, majorSegments = 32, minorSegments = 16) {
  const positions = [];
  const normals = [];
  const indices = [];

  // Generate vertices
  for (let i = 0; i <= majorSegments; i++) {
    const u = (i / majorSegments) * Math.PI * 2; // Major circle angle
    const cosMajor = Math.cos(u);
    const sinMajor = Math.sin(u);

    for (let j = 0; j <= minorSegments; j++) {
      const v = (j / minorSegments) * Math.PI * 2; // Minor circle angle
      const cosMinor = Math.cos(v);
      const sinMinor = Math.sin(v);

      // Position on torus surface
      const x = (majorRadius + minorRadius * cosMinor) * cosMajor;
      const y = minorRadius * sinMinor;
      const z = (majorRadius + minorRadius * cosMinor) * sinMajor;

      positions.push(x, y, z);

      // Normal vector (points outward from minor circle center)
      const nx = cosMinor * cosMajor;
      const ny = sinMinor;
      const nz = cosMinor * sinMajor;

      normals.push(nx, ny, nz);
    }
  }

  // Generate indices
  for (let i = 0; i < majorSegments; i++) {
    for (let j = 0; j < minorSegments; j++) {
      const current = i * (minorSegments + 1) + j;
      const next = current + minorSegments + 1;

      // Two triangles per quad
      indices.push(current, current + 1, next);
      indices.push(current + 1, next + 1, next);
    }
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices: new Uint32Array(indices)
  };
}

// Generate plane geometry divided into segments
export function createPlane(width = 1.0, height = 1.0, widthSegments = 1, heightSegments = 1) {
  const positions = [];
  const normals = [];
  const indices = [];

  const halfWidth = width / 2;
  const halfHeight = height / 2;

  // Generate vertices
  for (let i = 0; i <= heightSegments; i++) {
    const y = (i / heightSegments) * height - halfHeight;

    for (let j = 0; j <= widthSegments; j++) {
      const x = (j / widthSegments) * width - halfWidth;

      // Position (plane in XY, facing +Z)
      positions.push(x, 0, y);

      // Normal (all pointing in +Z direction)
      normals.push(0, 0, 1);
    }
  }

  // Generate indices
  for (let i = 0; i < heightSegments; i++) {
    for (let j = 0; j < widthSegments; j++) {
      const current = i * (widthSegments + 1) + j;
      const next = current + widthSegments + 1;

      // Two triangles per quad
      indices.push(current, next, current + 1);
      indices.push(current + 1, next, next + 1);
    }
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices: new Uint32Array(indices)
  };
}

/**
 * Create a grass blade using crossed quads (two perpendicular vertical quads)
 * @param {number} [height=0.3] - Height of the grass blade
 * @param {number} [width=0.08] - Width of the grass blade
 * @returns {{ positions: Float32Array, normals: Float32Array, indices: Uint16Array }}
 */
export function createGrassBlade(height = 0.3, width = 0.08) {
  const h = height;
  const w = width;
  
  const positions = new Float32Array([
    // First quad (vertical)
    -w, 0, 0,   w, 0, 0,   w, h, 0,   -w, h, 0,
    // Second quad (perpendicular)
    0, 0, -w,   0, 0, w,   0, h, w,   0, h, -w
  ]);
  
  const normals = new Float32Array([
    // First quad normals (facing +Z)
    0, 0, 1,   0, 0, 1,   0, 0, 1,   0, 0, 1,
    // Second quad normals (facing +X)
    1, 0, 0,   1, 0, 0,   1, 0, 0,   1, 0, 0
  ]);
  
  const indices = new Uint16Array([
    // First quad
    0, 1, 2,   0, 2, 3,
    // Second quad
    4, 5, 6,   4, 6, 7
  ]);
  
  return { positions, normals, indices };
}
