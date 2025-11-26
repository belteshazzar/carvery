import { Mat4, Vec3, toRadians } from './math.js';
import { OrbitCamera } from './3d.js';
import { createProgram } from './webgl.js';
import lambertFrag from './lambert.frag';
import lambertVert from './lambert.vert';
import { hexToRgbF } from './palette.js';
import { VoxelChunk } from './voxel-chunk.js';

/*** ======= Render-Only Viewer ======= ***/
function main() {
  const canvas = document.getElementById('gl');
  const gl = canvas.getContext('webgl2', { antialias: true, alpha: false, preserveDrawingBuffer: true });
  if (!gl) {
    alert('WebGL2 not supported');
    return;
  }
  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.CULL_FACE);
  gl.cullFace(gl.BACK);

  // Rendering program
  const renderProg = createProgram(gl, lambertVert, lambertFrag);
  renderProg.meta.visible = true;
  renderProg.meta.regions = {};
  renderProg.meta.renderIndexCount = 0; // No voxels initially

  // Initialize chunk
  let chunk = new VoxelChunk(16, 16, 16);
  chunk.fill(false); // Start with empty chunk
  
  // Default palette (16 colors)
  const paletteColors = new Float32Array(16 * 3);
  const defaultColors = [
    '#FFFFFF', '#FF0000', '#00FF00', '#0000FF',
    '#FFFF00', '#FF00FF', '#00FFFF', '#FFA500',
    '#800080', '#A52A2A', '#808080', '#FFC0CB',
    '#FFD700', '#008000', '#000080', '#8B4513'
  ];
  for (let i = 0; i < 16; i++) {
    const rgb = hexToRgbF(defaultColors[i]);
    paletteColors[i * 3 + 0] = rgb[0];
    paletteColors[i * 3 + 1] = rgb[1];
    paletteColors[i * 3 + 2] = rgb[2];
  }

  // Camera setup
  const camera = new OrbitCamera();
  camera.target = Vec3.create(8, 8, 8);
  camera.radius = 40;
  camera.theta = toRadians(45);
  camera.phi = toRadians(30);

  // Mouse interaction
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

  window.addEventListener('mouseup', () => {
    dragging = false;
  });

  window.addEventListener('mousemove', (e) => {
    if (dragging) {
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      const s = 0.005;
      camera.theta += dx * s;
      camera.phi -= dy * s;
      camera.phi = Math.min(Math.PI/2-s, camera.phi);
      camera.clamp();
    }
  });

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const z = Math.pow(1.1, e.deltaY * 0.01);
    camera.radius *= z;
    camera.clamp();
  }, { passive: false });

  // File loading
  const fileInput = document.getElementById('fileInput');
  const btnLoad = document.getElementById('btnLoad');
  const btnScreenshot = document.getElementById('btnScreenshot');

  btnLoad.addEventListener('click', () => {
    fileInput.click();
  });

  btnScreenshot.addEventListener('click', () => {
    // Capture the canvas as a data URL
    const dataURL = canvas.toDataURL('image/png');
    
    // Create a temporary link and trigger download
    const link = document.createElement('a');
    link.download = `voxel-screenshot-${Date.now()}.png`;
    link.href = dataURL;
    link.click();
  });

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const obj = JSON.parse(reader.result);
        importFromJSON(obj);
        buildAllMeshes();
      } catch (err) {
        alert('Error loading file: ' + err.message);
      } finally {
        fileInput.value = '';
      }
    };
    reader.readAsText(file);
  });

  function importFromJSON(obj) {
    if (!obj) return;

    // Import chunk data
    if (obj.size && Array.isArray(obj.size)) {
      const [sizeX, sizeY, sizeZ] = obj.size;
      chunk = new VoxelChunk(Math.max(sizeX, sizeY, sizeZ));
      chunk.fill(false); // Clear all voxels first
      
      // Expand to proper dimensions if needed
      if (sizeX !== sizeY || sizeY !== sizeZ || sizeX !== sizeZ) {
        chunk.expandSize(sizeX, sizeY, sizeZ);
      }
      
      if (obj.voxels && Array.isArray(obj.voxels)) {
        const maxSize = Math.max(sizeX, sizeY, sizeZ);
        const use4CharFormat = maxSize <= 16;
        
        obj.voxels.forEach((v) => {
          if (typeof v === 'string') {
            // Parse hex string format
            let x, y, z, mat;
            if (use4CharFormat && v.length === 4) {
              // 4-char format: "xyzm"
              x = parseInt(v[0], 16);
              y = parseInt(v[1], 16);
              z = parseInt(v[2], 16);
              mat = parseInt(v[3], 16);
            } else if (v.length === 7) {
              // 7-char format: "xxyyzzm"
              x = parseInt(v.substring(0, 2), 16);
              y = parseInt(v.substring(2, 4), 16);
              z = parseInt(v.substring(4, 6), 16);
              mat = parseInt(v[6], 16);
            } else {
              return; // Invalid format
            }
            
            const idx = chunk.idx3(x, y, z);
            chunk.setSolid(idx, true);
            chunk.setMaterial(idx, mat);
          } else if (typeof v === 'object') {
            // Legacy object format
            const idx = chunk.idx3(v.x, v.y, v.z);
            chunk.setSolid(idx, true);
            if (v.material !== undefined) {
              chunk.setMaterial(idx, v.material);
            }
          }
        });
      }

      // Update camera target to center of chunk
      camera.target = Vec3.create(
        sizeX / 2,
        sizeY / 2,
        sizeZ / 2
      );
    } else if (obj.chunk) {
      // Legacy format with chunk object
      const { sizeX, sizeY, sizeZ, voxels } = obj.chunk;
      chunk = new VoxelChunk(sizeX || 16, sizeY || 16, sizeZ || 16);
      
      if (voxels && Array.isArray(voxels)) {
        voxels.forEach((v) => {
          const idx = chunk.idx3(v.x, v.y, v.z);
          chunk.setSolid(idx, true);
          if (v.material !== undefined) {
            chunk.setMaterial(idx, v.material);
          }
        });
      }

      // Update camera target to center of chunk
      camera.target = Vec3.create(
        sizeX / 2,
        sizeY / 2,
        sizeZ / 2
      );
    }

    // Import palette if present
    if (obj.palette && Array.isArray(obj.palette)) {
      for (let i = 0; i < Math.min(16, obj.palette.length); i++) {
        const rgb = hexToRgbF(obj.palette[i]);
        paletteColors[i * 3 + 0] = rgb[0];
        paletteColors[i * 3 + 1] = rgb[1];
        paletteColors[i * 3 + 2] = rgb[2];
      }
    }
  }

  function buildAllMeshes() {
    renderProg.meta.renderIndexCount = chunk.buildGreedyRenderMeshMain(gl, renderProg, renderProg.vao);
  }

  // Render loop
  function render() {
    // Resize canvas to match display size
    const dpr = window.devicePixelRatio || 1;
    const displayWidth = Math.floor(canvas.clientWidth * dpr);
    const displayHeight = Math.floor(canvas.clientHeight * dpr);

    if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
      canvas.width = displayWidth;
      canvas.height = displayHeight;
    }

    gl.viewport(0, 0, canvas.width, canvas.height);

    // Blue sky background
    gl.clearColor(0.53, 0.81, 0.92, 1.0); // Sky blue
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Setup camera matrices
    const aspect = canvas.width / canvas.height;
    const proj = Mat4.perspective(toRadians(45), aspect, 0.1, 500);
    const view = camera.view();

    // Render ground plane (green)
    renderGroundPlane(proj, view);

    // Render voxel model
    if (renderProg.meta.renderIndexCount > 0) {
      gl.useProgram(renderProg.program);
      gl.bindVertexArray(renderProg.vao);

      const model = Mat4.identity();
      const normalMat = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);
      
      renderProg.uModel.set(model);
      renderProg.uView.set(view);
      renderProg.uProj.set(proj);
      renderProg.uNormalMat.set(normalMat);
      renderProg.uPalette.set(paletteColors);
      renderProg.uLightDirWS.set(new Float32Array([0.7 / 1.7, -1.2 / 1.7, 0.9 / 1.7]));
      renderProg.uAmbient.set(0.22);

      gl.drawElements(gl.TRIANGLES, renderProg.meta.renderIndexCount, gl.UNSIGNED_INT, 0);

      gl.bindVertexArray(null);
    }

    requestAnimationFrame(render);
  }

  // Ground plane rendering
  let groundVAO = null;
  let groundIndexCount = 0;

  function buildGroundPlane() {
    const size = 100; // Large ground plane
    const y = -0.01; // Slightly below y=0
    
    const positions = new Float32Array([
      -size, y, -size,
      size, y, -size,
      size, y, size,
      -size, y, size,
    ]);

    const normals = new Float32Array([
      0, 1, 0,
      0, 1, 0,
      0, 1, 0,
      0, 1, 0,
    ]);

    const indices = new Uint32Array([
      0, 2, 1,
      0, 3, 2,
    ]);

    // Create VAO for ground plane
    groundVAO = gl.createVertexArray();
    gl.bindVertexArray(groundVAO);

    if (renderProg.aPosition) {
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
      gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(renderProg.aPosition.location);
      gl.vertexAttribPointer(renderProg.aPosition.location, 3, gl.FLOAT, false, 0, 0);
    }

    if (renderProg.aNormal) {
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
      gl.bufferData(gl.ARRAY_BUFFER, normals, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(renderProg.aNormal.location);
      gl.vertexAttribPointer(renderProg.aNormal.location, 3, gl.FLOAT, false, 0, 0);
    }

    if (renderProg.aMatId) {
      // All vertices use material 2 (green from palette)
      const materials = new Uint8Array([2, 2, 2, 2]);
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
      gl.bufferData(gl.ARRAY_BUFFER, materials, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(renderProg.aMatId.location);
      gl.vertexAttribIPointer(renderProg.aMatId.location, 1, gl.UNSIGNED_BYTE, 0, 0);
    }

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

    gl.bindVertexArray(null);

    groundIndexCount = indices.length;
  }

  function renderGroundPlane(proj, view) {
    if (!groundVAO) {
      buildGroundPlane();
    }

    gl.useProgram(renderProg.program);
    gl.bindVertexArray(groundVAO);

    const model = Mat4.identity();
    const normalMat = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);
    
    // Fixed green palette for ground plane
    const groundPalette = new Float32Array(16 * 3);
    const greenRgb = hexToRgbF('#00FF00'); // Bright green
    for (let i = 0; i < 16; i++) {
      groundPalette[i * 3 + 0] = greenRgb[0];
      groundPalette[i * 3 + 1] = greenRgb[1];
      groundPalette[i * 3 + 2] = greenRgb[2];
    }
    
    renderProg.uModel.set(model);
    renderProg.uView.set(view);
    renderProg.uProj.set(proj);
    renderProg.uNormalMat.set(normalMat);
    renderProg.uPalette.set(groundPalette);
    renderProg.uLightDirWS.set(new Float32Array([0.7 / 1.7, -1.2 / 1.7, 0.9 / 1.7]));
    renderProg.uAmbient.set(0.22);

    gl.drawElements(gl.TRIANGLES, groundIndexCount, gl.UNSIGNED_INT, 0);

    gl.bindVertexArray(null);
  }

  render();
}

main();
