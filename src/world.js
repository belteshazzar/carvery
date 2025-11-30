import { Mat4, toRadians } from './math.js';
import { OrbitCamera } from './3d.js';
import { createProgram } from './webgl.js';
import { VoxelChunk } from './voxel-chunk.js';
import lambertFrag from './lambert.frag';
import lambertVert from './lambert.vert';

/*** ======= Procedural World Generator ======= ***/

// Simple 2D Perlin-style noise function
function noise2D(x, y, seed = 0) {
  // Simple hash-based pseudo-random noise
  // Improved hash: mixes x, y, and seed for more entropy
  const hash2D = (x, y, seed = 0) => {
    let n = x * 374761393 + y * 668265263 + seed * 982451653;
    n = (n ^ (n >> 13)) * 1274126177;
    n = (n ^ (n >> 16));
    return n & 0x7fffffff;
  };

  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;

  // Smoothstep interpolation
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);

  // Hash corners with improved mixing
  const a = hash2D(ix, iy, seed);
  const b = hash2D(ix + 1, iy, seed);
  const c = hash2D(ix, iy + 1, seed);
  const d = hash2D(ix + 1, iy + 1, seed);

  // Normalize to -1 to 1
  const normalize = (n) => (n / 0x7fffffff) * 2 - 1;

  // Bilinear interpolation
  const x1 = normalize(a) * (1 - u) + normalize(b) * u;
  const x2 = normalize(c) * (1 - u) + normalize(d) * u;

  return x1 * (1 - v) + x2 * v;
}

// Multi-octave noise (fractal Brownian motion)
function fbm(x, y, octaves = 4, persistence = 0.5, lacunarity = 2.0, seed = 0) {
  let total = 0;
  let amplitude = 1;
  let frequency = 1;
  let maxValue = 0;
  
  for (let i = 0; i < octaves; i++) {
    total += noise2D(x * frequency, y * frequency, seed + i) * amplitude;
    maxValue += amplitude;
    amplitude *= persistence;
    frequency *= lacunarity;
  }
  
  return total / maxValue;
}

// Generate terrain in a voxel chunk
function generateTerrain(chunk, seed = 0) {
  const sizeX = chunk.sizeX;
  const sizeY = chunk.sizeY;
  const sizeZ = chunk.sizeZ;
  
  // Materials
  const GRASS = 1;
  const DIRT = 0;
  const STONE = 8;
  const SAND = 12;
  const WATER = 11;
  
  // Generate heightmap
  for (let x = 0; x < sizeX; x++) {
    for (let z = 0; z < sizeZ; z++) {
      // Normalize coordinates to 0-1 range
      const nx = x / sizeX;
      const nz = z / sizeZ;
      
      // Generate height using fractal noise
      const height = fbm(nx * 4, nz * 4, 4, 0.5, 2.0, seed);
      
      // Map height to voxel Y coordinate (0 to sizeY-1)
      const terrainHeight = Math.floor(((height + 1) / 2) * (sizeY * 0.8)) + Math.floor(sizeY * 0.1);
      const waterLevel = Math.floor(sizeY * 0.25);
      
      // Fill column up to terrain height
      for (let y = 0; y < sizeY; y++) {
        const idx = chunk.idx3(x, y, z);
        
        if (y < terrainHeight) {
          chunk.setSolid(idx, true);
          
          // Determine material based on height and position
          if (y === terrainHeight - 1) {
            // Top layer
            if (terrainHeight <= waterLevel) {
              chunk.setMaterial(idx, SAND); // Beach sand
            } else if (terrainHeight > sizeY * 0.7) {
              chunk.setMaterial(idx, STONE); // Mountain stone
            } else {
              chunk.setMaterial(idx, GRASS); // Grass
            }
          } else if (y >= terrainHeight - 3) {
            // Sub-surface layers
            chunk.setMaterial(idx, DIRT);
          } else {
            // Deep layers
            chunk.setMaterial(idx, STONE);
          }
        } else if (y < waterLevel) {
          // Water
          chunk.setSolid(idx, true);
          chunk.setMaterial(idx, WATER);
        } else {
          chunk.setSolid(idx, false);
        }
      }
    }
  }
}

function main() {
    // Keyboard controls for moving camera target
    window.addEventListener('keydown', (e) => {
      const step = 1;
      if (e.key === 'ArrowLeft') {
        camera.target[0] -= step;
      } else if (e.key === 'ArrowRight') {
        camera.target[0] += step;
      } else if (e.key === 'ArrowUp') {
        camera.target[2] -= step;
      } else if (e.key === 'ArrowDown') {
        camera.target[2] += step;
      }
    });
  const canvas = document.getElementById('gl');
  const gl = canvas.getContext('webgl2', { antialias: true, alpha: false });
  if (!gl) {
    alert('WebGL2 not supported');
    return;
  }
  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.CULL_FACE);
  gl.cullFace(gl.BACK);

  // Create shader program
  const renderProg = createProgram(gl, lambertVert, lambertFrag);

  // Create voxel chunk (16x16x16)
  let chunk = new VoxelChunk(16, 16, 16);
  
  // Generate initial terrain
  let seed = Math.floor(Math.random() * 10000);
  generateTerrain(chunk, seed);

  // Build mesh
  renderProg.meta.renderIndexCount = chunk.buildGreedyRenderMeshMain(gl, renderProg, renderProg.vao);

  // Palette with terrain colors
  const palette = new Float32Array([
    0.55, 0.4, 0.3,  // Material 0: Dirt
    0.3, 0.6, 0.2,   // Material 1: Grass
    0.8, 0.2, 0.2,   // Material 2: Red
    0.2, 0.4, 0.8,   // Material 3: Blue
    1.0, 0.8, 0.2,   // Material 4: Yellow
    1.0, 0.0, 1.0,   // Material 5: Magenta
    0.0, 1.0, 1.0,   // Material 6: Cyan
    1.0, 1.0, 1.0,   // Material 7: White
    0.5, 0.5, 0.5,   // Material 8: Gray/Stone
    1.0, 0.0, 0.0,   // Material 9: Bright Red
    0.0, 0.8, 0.0,   // Material 10: Bright Green
    0.2, 0.5, 0.8,   // Material 11: Water Blue
    0.9, 0.85, 0.6,  // Material 12: Sand
    0.5, 0.0, 0.5,   // Material 13: Dark Magenta
    0.0, 0.5, 0.5,   // Material 14: Dark Cyan
    0.9, 0.9, 0.9    // Material 15: Light Gray
  ]);

  // Isometric camera setup (looking down at 45 degrees)
  const camera = new OrbitCamera({
    target: [8, 4, 8],
    radius: 30,
    theta: toRadians(45),   // 45 degrees horizontally
    phi: toRadians(60),     // 60 degrees from vertical (looking down)
    minRadius: 10,
    maxRadius: 60
  });

  // Mouse interaction for orbit camera
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
    }
  });

  canvas.addEventListener('mousemove', (e) => {
    if (dragging) {
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;

      camera.theta += dx * 0.01;
      camera.phi -= dy * 0.01;
      camera.clamp();
    }
  });

  canvas.addEventListener('mouseup', () => {
    dragging = false;
  });

  canvas.addEventListener('mouseleave', () => {
    dragging = false;
  });

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const z = Math.pow(1.1, e.deltaY * 0.01);
    camera.radius *= z;
    camera.clamp();
  }, { passive: false });

  // Regenerate button
  document.getElementById('btnRegenerate').addEventListener('click', () => {
    seed = Math.floor(Math.random() * 10000);
    chunk = new VoxelChunk(16, 16, 16);
    generateTerrain(chunk, seed);
    chunk.buildGreedyRenderMeshMain(gl, renderProg);
  });

  // Resize handling
  function resize() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
  window.addEventListener('resize', resize);
  resize();

  // Light direction
  const lightDir = new Float32Array([0.5, 0.8, 0.3]);
  const len = Math.sqrt(lightDir[0]**2 + lightDir[1]**2 + lightDir[2]**2);
  lightDir[0] /= len;
  lightDir[1] /= len;
  lightDir[2] /= len;

  // Render loop
  function render() {
    requestAnimationFrame(render);

    // Clear with sky blue background
    gl.clearColor(0.53, 0.81, 0.92, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Projection matrix
    const aspect = canvas.width / canvas.height;
    const proj = Mat4.perspective(toRadians(45), aspect, 0.1, 1000);

    // View matrix
    const view = camera.view();

    // Model matrix (identity - chunk at origin)
    const model = Mat4.identity();

    // Normal matrix
    const normalMat = Mat4.normalMatrix(model);

    // Draw chunk
    gl.useProgram(renderProg.program);
    renderProg.uView.set(view);
    renderProg.uProj.set(proj);
    renderProg.uModel.set(model);
    renderProg.uNormalMat.set(normalMat);
    renderProg.uPalette.set(palette);
    renderProg.uLightDirWS.set(lightDir);
    renderProg.uAmbient.set(0.4);
    
    gl.bindVertexArray(renderProg.vao);
    gl.drawElements(gl.TRIANGLES, renderProg.meta.renderIndexCount, gl.UNSIGNED_INT, 0);
    gl.bindVertexArray(null);
  }

  render();
}

main();
