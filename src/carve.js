import './style.css'
import { Mat4, Vec3, toRadians } from './math.js';
import { makeCubeEdges, makeAxisGizmo, makeParticleCube, OrbitCamera } from './3d.js';
import { createProgram } from './webgl.js';
import lambertFrag from './lambert.frag';
import lambertVert from './lambert.vert';
import wireframeFrag from './wireframe.frag';
import wireframeVert from './wireframe.vert';
import pickFrag from './pick.frag';
import pickVert from './pick.vert';
import axisFrag from './axis.frag';
import axisVert from './axis.vert';
import particleFrag from './particle.frag';
import particleVert from './particle.vert';
import {
  hexToRgbF,
  rgbToHexF,
  PaletteUI
} from './palette.js';
import { AnimationSystem } from './AnimationSystem.js';
import { VoxelChunk } from './voxel-chunk.js';
import { initializeUI } from './ui.js';

/*** ======= App ======= ***/
function main() {

  const canvas = document.getElementById('gl');
  const gl = canvas.getContext('webgl2', { antialias: true, alpha: false });
  if (!gl) {
    alert('WebGL2 not supported');
    return;
  }
  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.CULL_FACE);
  gl.cullFace(gl.BACK);

  // Programs
  const renderProg = createProgram(gl, lambertVert, lambertFrag);
  renderProg.meta.visible = true;
  renderProg.meta.regions = {};
  const pickProg = createProgram(gl, pickVert, pickFrag);
  const wireProg = createProgram(gl, wireframeVert, wireframeFrag);
  const axisProg = createProgram(gl, axisVert, axisFrag);
  const particleProg = createProgram(gl, particleVert, particleFrag);

  // Wireframe mesh

  const edges = makeCubeEdges();

  gl.bindVertexArray(wireProg.vao);

  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, edges.positions, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(wireProg.aPosition.location);
  gl.vertexAttribPointer(wireProg.aPosition.location, 3, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, edges.indices, gl.STATIC_DRAW);

  gl.bindVertexArray(null);

  // gizmo - create function to rebuild it
  function buildAxisGizmo() {
    const gizmo = makeAxisGizmo(chunk.sizeX, chunk.sizeZ);

    gl.bindVertexArray(axisProg.vao);

    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, gizmo.positions, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(axisProg.aPosition.location);
    gl.vertexAttribPointer(axisProg.aPosition.location, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, gizmo.colors, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(axisProg.aColor.location);
    gl.vertexAttribPointer(axisProg.aColor.location, 3, gl.FLOAT, false, 0, 0);

    gl.bindVertexArray(null);
    
    axisProg.meta.count = gizmo.count;
  }

  // Particle cube mesh for instanced rendering
  const particleCube = makeParticleCube();
  
  gl.bindVertexArray(particleProg.vao);
  
  // Position buffer
  if (particleProg.aPosition) {
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, particleCube.positions, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(particleProg.aPosition.location);
    gl.vertexAttribPointer(particleProg.aPosition.location, 3, gl.FLOAT, false, 0, 0);
  }
  
  // Normal buffer
  if (particleProg.aNormal) {
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, particleCube.normals, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(particleProg.aNormal.location);
    gl.vertexAttribPointer(particleProg.aNormal.location, 3, gl.FLOAT, false, 0, 0);
  }
  
  // Material ID buffer (single value per vertex, all 0 since we'll use uniforms)
  if (particleProg.aMatId) {
    const particleMatIds = new Uint8Array(particleCube.positions.length / 3);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, particleMatIds, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(particleProg.aMatId.location);
    gl.vertexAttribIPointer(particleProg.aMatId.location, 1, gl.UNSIGNED_BYTE, 0, 0);
  }
  
  // Index buffer
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, particleCube.indices, gl.STATIC_DRAW);
  
  gl.bindVertexArray(null);

  // Add inside main()
  const animSystem = new AnimationSystem();
  let animationTransforms = new Map();
  let lastTime = 0;

  // Region visualization state
  let selectedRegionName = null;  // Currently selected region for visualization
  let regionOverlaysVisible = new Map(); // regionName -> boolean (whether overlay is visible)

  /*** ---- World State ---- ***/
  let N = 16;
  const chunk = new VoxelChunk(N);

  const FACE_DIRS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1], [0, 0, 0]]; // last is for ground plane
  const FACE_INFO = [{ axis: 0, u: 2, v: 1 }, { axis: 0, u: 2, v: 1 }, { axis: 1, u: 0, v: 2 }, { axis: 1, u: 0, v: 2 }, { axis: 2, u: 0, v: 1 }, { axis: 2, u: 0, v: 1 }];

  chunk.seedMaterials("bands");
  buildAxisGizmo();

  const camera = new OrbitCamera({
    target: [8, 8, 8],
    radius: 40,  // Increase to match new world size
    theta: toRadians(215), // 45 degrees to see positive axes
    phi: toRadians(60)    // ~35 degrees up
  });
  const model = Mat4.identity();
  let proj = Mat4.perspective(60 * Math.PI / 180, 1, 0.01, 100);
  const ambient = 0.22;

  /*** ---- Resize & Pick Targets ---- ***/
  let dpr = 1, pickFBO = null, pickTex = null, pickDepth = null, pickW = 0, pickH = 0;

  function resizePickTargets() {
    const w = canvas.width, h = canvas.height;
    if (w === pickW && h === pickH && pickFBO) return;
    if (pickTex) gl.deleteTexture(pickTex);
    if (pickDepth) gl.deleteRenderbuffer(pickDepth);
    if (pickFBO) gl.deleteFramebuffer(pickFBO);

    pickTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, pickTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    pickDepth = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, pickDepth);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, w, h);
    pickFBO = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, pickFBO);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, pickTex, 0);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, pickDepth);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    pickW = w;
    pickH = h;
  }

  function resize() {
    dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const w = canvas.clientWidth || canvas.parentElement.clientWidth, h = canvas.clientHeight || canvas.parentElement.clientHeight;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    proj = Mat4.perspective(60 * Math.PI / 180, canvas.width / canvas.height, 0.01, 100);
    resizePickTargets();
  }

  window.addEventListener('resize', resize, { passive: true }); requestAnimationFrame(resize);

  function renderPick() {
    gl.bindFramebuffer(gl.FRAMEBUFFER, pickFBO);
    gl.viewport(0, 0, pickW, pickH);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const cullWas = gl.isEnabled(gl.CULL_FACE);
    if (cullWas) gl.disable(gl.CULL_FACE);

    gl.useProgram(pickProg.program);
    pickProg.uModel.set(model);
    pickProg.uView.set(camera.view());
    pickProg.uProj.set(proj);

    gl.bindVertexArray(pickProg.vao);
    gl.drawElements(gl.TRIANGLES, pickProg.meta.pickVoxelCount, gl.UNSIGNED_INT, 0);

    // Draw ground plane only for add mode
    if (mode === 'add') {
      gl.bindVertexArray(pickProg.vaoGround);
      gl.drawElements(gl.TRIANGLES, pickProg.meta.pickGroundCount, gl.UNSIGNED_INT, 0);
    }

    gl.bindVertexArray(null);
    if (cullWas) gl.enable(gl.CULL_FACE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  function clientToFB(xc, yc) {
    const r = canvas.getBoundingClientRect();
    const x = Math.floor((xc - r.left) * (canvas.width / r.width));
    const y = Math.floor((r.height - (yc - r.top)) * (canvas.height / r.height));
    return { x, y };
  }

  function decodePickAt(xc, yc) {
    if (pickProg.meta.pickVoxelCount === 0 && pickProg.meta.pickGroundCount === 0) return { voxel: -1, face: -1 };
    renderPick();
    const { x, y } = clientToFB(xc, yc);
    const px = new Uint8Array(4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, pickFBO);
    gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    const packed = (px[0]) | (px[1] << 8) | (px[2] << 16);
    if (packed === 0) {
      return { voxel: -1, face: -1 };
    }
    const face = packed & 7;
    const vId = (packed >> 4) - 1;
    if (vId < 0 || vId >= chunk.length) return { voxel: -1, face: -1 };
    return { voxel: vId, face };
  }

  /*** ---- Wireframe drawing ---- ***/
  function drawWireAABB(minX, minY, minZ, maxX, maxY, maxZ, color, inflate = 1.006) {
    const sx = (maxX - minX + 1);  // Remove cell multiplication
    const sy = (maxY - minY + 1);
    const sz = (maxZ - minZ + 1);

    const cx = minX + sx * 0.5;  // Remove cell multiplication
    const cy = minY + sy * 0.5;
    const cz = minZ + sz * 0.5;

    gl.useProgram(wireProg.program);

    wireProg.uModel.set(model);
    wireProg.uView.set(camera.view());
    wireProg.uProj.set(proj);
    wireProg.uOffset.set(new Float32Array([cx, cy, cz]));
    wireProg.uScaleVec.set(new Float32Array([sx, sy, sz]));
    wireProg.uInflate.set(inflate);
    wireProg.uColor.set(new Float32Array(color));

    gl.bindVertexArray(wireProg.vao);
    gl.drawElements(gl.LINES, edges.count, gl.UNSIGNED_SHORT, 0);
    gl.bindVertexArray(null);
  }

  function drawVoxelWire(id, color, inflate = 1.006) {
    const [x, y, z] = chunk.coordsOf(id);
    drawWireAABB(x, y, z, x, y, z, color, inflate);
  }

  /*** ---- UI: Palette & brush ---- ***/
  const palette = new PaletteUI(
    document.getElementById('palette'),
    (brushId) => {
      //brushMat = brushId;
    },
    (index, fromHex, toHex) => {
      const act = beginPaletteAction(`Palette ${index}`);
      recordPaletteChange(act, index, fromHex, toHex);
      commitAction(act, false);
    }
  );

  let mode = document.querySelector('input[name="modeSelect"]:checked').value;
  let option = document.querySelector('input[name="optionSelect"]:checked').value;

  /*** ---- Import/Export JSON ---- ***/

  function intToHexChar(i) {
    if (i >= 0 && i <= 9) return String.fromCharCode('0'.charCodeAt(0) + i);
    if (i >= 10 && i <= 15) return String.fromCharCode('a'.charCodeAt(0) + (i - 10));
    return '0';
  }

  function intToHex2(i) {
    // Convert integer (0-255) to 2-character hex string
    const val = Math.max(0, Math.min(255, i));
    return val.toString(16).padStart(2, '0');
  }

  function exportToJSON() {
    const palHex = [];

    for (let i = 0; i < 16; i++) palHex.push(rgbToHexF(palette.colors[i * 3 + 0], palette.colors[i * 3 + 1], palette.colors[i * 3 + 2]));

    const voxels = [];
    const maxSize = Math.max(chunk.sizeX, chunk.sizeY, chunk.sizeZ);
    const use4CharFormat = maxSize <= 16; // Use 4-char format for <=16, 7-char for >16
    
    for (let z = 0; z < chunk.sizeZ; z++) {
      for (let y = 0; y < chunk.sizeY; y++) {
        for (let x = 0; x < chunk.sizeX; x++) {
          const id = chunk.idx3(x, y, z);
          if (chunk.isSolid(id)) {
            if (use4CharFormat) {
              // 4-char format: "xyzm" (single hex digit each, 0-15)
              voxels.push(`${intToHexChar(x)}${intToHexChar(y)}${intToHexChar(z)}${intToHexChar(chunk.material(id))}`);
            } else {
              // 7-char format: "xxyyzzm" (2 hex digits for x,y,z, 1 for material, 0-255 for coords)
              voxels.push(`${intToHex2(x)}${intToHex2(y)}${intToHex2(z)}${intToHexChar(chunk.material(id))}`);
            }
          }
        }
      }
    }

    return Object.assign({ 
      version: 1, 
      size: [chunk.sizeX, chunk.sizeY, chunk.sizeZ], 
      palette: palHex, 
      voxels
    }, animSystem.toJSON());
  }

  function hexCharToInt(hex) {
    // Convert a single hex character (0-9, a-f, A-F) to integer (0-15)
    const c = hex.toLowerCase();
    if (c >= '0' && c <= '9') {
      return c.charCodeAt(0) - '0'.charCodeAt(0);
    }
    if (c >= 'a' && c <= 'f') {
      return 10 + (c.charCodeAt(0) - 'a'.charCodeAt(0));
    }
    return 0; // Invalid hex character
  }

  function hex2ToInt(hex) {
    // Convert a 2-character hex string to integer (0-255)
    return parseInt(hex, 16) || 0;
  }

  function importFromJSON(obj) {
    if (!obj || typeof obj !== 'object') throw new Error('Root must be object');
    if (!Array.isArray(obj.voxels)) throw new Error('Missing "voxels"');
    
    // Handle size as either a number or [x, y, z] array
    let sizeX, sizeY, sizeZ;
    if (Array.isArray(obj.size)) {
      if (obj.size.length !== 3) throw new Error('Size array must have 3 elements [x, y, z]');
      [sizeX, sizeY, sizeZ] = obj.size;
    } else if (typeof obj.size === 'number') {
      // Old format: single number for cubic chunk
      sizeX = sizeY = sizeZ = obj.size;
    } else {
      throw new Error('Invalid "size" field');
    }

    // Reset chunk to the imported size
    if (sizeX === 16 && sizeY === 16 && sizeZ === 16) {
      chunk.resetSize();
    } else {
      chunk.resetSize(); // Start from 16x16x16
      chunk.expandSize(sizeX, sizeY, sizeZ);
    }
    
    // Update N for compatibility
    N = Math.max(sizeX, sizeY, sizeZ);
    
    // Update camera target to center on imported chunk
    camera.target = [sizeX / 2, sizeY / 2, sizeZ / 2];
    
    // Rebuild grid and axes for new size
    buildAxisGizmo();

    if (Array.isArray(obj.palette)) {
      for (let i = 0; i < Math.min(16, obj.palette.length); i++) {
        const e = obj.palette[i];
        let rgb;

        if (typeof e === 'string') rgb = hexToRgbF(e);
        else if (Array.isArray(e) && e.length >= 3) rgb = [+e[0], +e[1], +e[2]];

        if (rgb) {
          palette.setPaletteColor(i, [
            Math.max(0, Math.min(1, rgb[0])),
            Math.max(0, Math.min(1, rgb[1])),
            Math.max(0, Math.min(1, rgb[2]))
          ]);
        }
      }
    }

    chunk.fill(false);
    chunk.setMaterialAll(0);

    for (const v of obj.voxels) {
      if (!v) continue;
      
      let x, y, z, m;
      if (typeof v === 'string') {
        if (v.length === 4) {
          // 4-char format: "xyzm" (single hex digit each, 0-15)
          x = hexCharToInt(v[0]);
          y = hexCharToInt(v[1]);
          z = hexCharToInt(v[2]);
          m = (hexCharToInt(v[3]) | 0) & 15;
        } else if (v.length === 7) {
          // 7-char format: "xxyyzzm" (2 hex digits for x,y,z, 1 for material, 0-255)
          x = hex2ToInt(v.substring(0, 2));
          y = hex2ToInt(v.substring(2, 4));
          z = hex2ToInt(v.substring(4, 6));
          m = (hexCharToInt(v[6]) | 0) & 15;
        } else {
          continue; // Skip invalid format
        }
      } else if (Array.isArray(v) && v.length >= 4) {
        // Array format: [x, y, z, m] (for backward compatibility)
        [x, y, z, m] = v;
      } else {
        continue; // Skip invalid entries
      }
      
      if (chunk.within(x, y, z)) {
        const id = chunk.idx3(x, y, z);
        chunk.setSolid(id, true);
        chunk.setMaterial(id, m);
      }
    }
    buildAllMeshes();
    updateChunkSizeUI();
    updateCameraTargetUI();

    if (obj.regions) animSystem.fromJSON(obj);
    clearHistory(); // imported scene becomes baseline
  }

  const FACE_ROW_INFO = [
    { axis: 0, u: 2, v: 1 }, // +X
    { axis: 0, u: 2, v: 1 }, // -X
    { axis: 1, u: 0, v: 2 }, // +Y
    { axis: 1, u: 0, v: 2 }, // -Y
    { axis: 2, u: 0, v: 1 }, // +Z
    { axis: 2, u: 0, v: 1 }, // -Z
    { axis: 1, u: 0, v: 2 }, // ground plane +Y
  ];

  function getRowSurfaceVoxels(vIdx, faceId) {
    if (vIdx < 0 || faceId < 0 || faceId > FACE_ROW_INFO.length) return [];
    const info = FACE_ROW_INFO[faceId]
    const [x0, y0, z0] = chunk.coordsOf(vIdx);
    const U = info.u
    const V = info.v
    const AX = info.axis;
    const fixedU = [x0, y0, z0][U];
    const fixedV = [x0, y0, z0][V];
    const out = [];

    for (let t = 0; t < N; t++) {
      const c = [0, 0, 0];
      c[U] = fixedU;
      c[V] = fixedV;
      c[AX] = t;
      if (!chunk.within(c[0], c[1], c[2])) continue;
      if (!chunk.isSolid(chunk.idx3(c[0], c[1], c[2]))) continue;
      out.push(chunk.idx3(c[0], c[1], c[2]));
    }
    return out;
  }

  const FACE_ROW_ADD_INFO = [
    { axis: 0, u: 2, v: 1 }, // +X
    { axis: 0, u: 2, v: 1 }, // -X
    { axis: 1, u: 0, v: 2 }, // +Y
    { axis: 1, u: 0, v: 2 }, // -Y
    { axis: 2, u: 0, v: 1 }, // +Z
    { axis: 2, u: 0, v: 1 }, // -Z
    { axis: 1, u: 0, v: 2 }, // ground plane +Y
  ];

  function getRowAddTargets(vIdx, faceId) {
    if (vIdx < 0 || faceId < 0) return [];

    const info = FACE_ROW_ADD_INFO[faceId]
    const [x0, y0, z0] = chunk.coordsOf(vIdx);
    const U = info.u
    const V = info.v
    const AX = info.axis;
    const fixedU = [x0, y0, z0][U];
    const fixedV = [x0, y0, z0][V];
    const out = [];

    for (let t = 0; t < N; t++) {
      const c = [0, 0, 0];
      c[U] = fixedU;
      c[V] = fixedV;
      c[AX] = t;
      if (!chunk.within(c[0], c[1], c[2])) continue;
      if (chunk.isSolid(chunk.idx3(c[0], c[1], c[2]))) continue;
      out.push(chunk.idx3(c[0], c[1], c[2]));
    }
    return out;
  }

  /*** ---- Plane Tool ---- ***/

  function getPlaneSurfaceVoxels(vIdx, faceId) {
    if (vIdx < 0 || faceId < 0 || faceId >= FACE_INFO.length) return [];
    const info = FACE_INFO[faceId]
    const [x0, y0, z0] = chunk.coordsOf(vIdx);
    const AX = info.axis
    const U = info.u
    const V = info.v;
    const fixedAX = [x0, y0, z0][AX];
    const out = [];

    for (let u = 0; u < N; u++) {
      for (let v = 0; v < N; v++) {
        const c = [0, 0, 0];
        c[AX] = fixedAX;
        c[U] = u;
        c[V] = v;

        if (faceId == 6) {
          if (!chunk.within(c[0], c[1], c[2])) continue;
          if (!chunk.isSolid(chunk.idx3(c[0], c[1], c[2]))) continue;
          out.push(chunk.idx3(c[0], c[1], c[2]));
          continue;
        }

        if (!chunk.within(c[0], c[1], c[2])) continue;
        if (!chunk.isSolid(chunk.idx3(c[0], c[1], c[2]))) continue;
        if (!chunk.faceExposed(c[0], c[1], c[2], faceId)) continue;
        out.push(chunk.idx3(c[0], c[1], c[2]));
      }
    }

    return out;
  }

  function getGroundPlaneVoxels() {
    const out = [];
    for (let x = 0; x < chunk.sizeX; x++) {
      for (let z = 0; z < chunk.sizeZ; z++) {
        const y = 0;
        out.push(chunk.idx3(x, y, z));
      }
    }
    return out;
  }

  function getPlaneAddTargets(vIdx, faceId) {
    const d = FACE_DIRS[faceId]
    const surf = (faceId === 6) ? getGroundPlaneVoxels() : getPlaneSurfaceVoxels(vIdx, faceId);
    const tSet = new Set();
    for (const s of surf) {
      const [x, y, z] = chunk.coordsOf(s);
      const nx = x + d[0]
      const ny = y + d[1]
      const nz = z + d[2];
      if (chunk.within(nx, ny, nz) && !chunk.isSolid(chunk.idx3(nx, ny, nz))) tSet.add(chunk.idx3(nx, ny, nz));
    }
    const res = [...tSet];
    return res;
  }

  /*** ---- UNDO/REDO system ---- ***/
  const undoStack = [];
  const redoStack = [];

  function updateUndoUI() {
    const undoBtn = document.getElementById('btnUndo');
    const redoBtn = document.getElementById('btnRedo');
    undoBtn.disabled = undoStack.length === 0;
    redoBtn.disabled = redoStack.length === 0;
  }

  function clearHistory() {
    undoStack.length = 0;
    redoStack.length = 0;
    updateUndoUI();
  }

  function beginVoxelAction(label) {
    return { type: 'voxels', label, vox: [] };
  }

  function recordVoxelChange(act, idx, toSolid, toMat = chunk.material(idx)) {
    const fromS = chunk.isSolid(idx), fromM = chunk.material(idx);
    if (fromS === toSolid && fromM === toMat) return;
    act.vox.push({ idx, fromS, fromM, toS: toSolid, toM: toMat });
    // apply immediately (compose effect)
    chunk.setSolid(idx, toSolid);
    chunk.setMaterial(idx, toMat);
  }

  function beginPaletteAction(label) {
    return { type: 'palette', label, pal: [] };
  }

  function recordPaletteChange(act, i, fromHex, toHex) {
    const from = hexToRgbF(fromHex);
    const to = hexToRgbF(toHex);
    if (fromHex === toHex) return;
    act.pal.push({ i, from, to });
    // already applied via input handler; nothing to do here
  }

  function applyAction(action, mode /* 'do' | 'undo' */) {
    if (action.type === 'voxels') {
      const arr = action.vox;
      if (mode === 'undo') {
        for (const c of arr) {
          chunk.setSolid(c.idx, c.fromS);
          chunk.setMaterial(c.idx, c.fromM);
        }
      } else {
        for (const c of arr) {
          chunk.setSolid(c.idx, c.toS);
          chunk.setMaterial(c.idx, c.toM);
        }
      }
    } else if (action.type === 'palette') {
      const arr = action.pal;
      if (mode === 'undo') {
        for (const p of arr) {
          palette.setPaletteColor(p.i, p.from);
        }
      } else {
        for (const p of arr) {
          palette.setPaletteColor(p.i, p.to);
        }
      }

    }
  }

  function commitAction(action, rebuild = true) {
    if (action.type === 'voxels' && action.vox.length === 0) return;
    if (action.type === 'palette' && (!action.pal || action.pal.length === 0)) return;
    undoStack.push(action);
    redoStack.length = 0;
    updateUndoUI();
    if (action.type === 'voxels' && rebuild) buildAllMeshes();
  }

  function undo() {
    if (undoStack.length === 0) return;
    const act = undoStack.pop();
    applyAction(act, 'undo');
    redoStack.push(act);
    updateUndoUI();
    if (act.type === 'voxels') buildAllMeshes();
  }

  function redo() {
    if (redoStack.length === 0) return;
    const act = redoStack.pop();
    applyAction(act, 'do');
    undoStack.push(act);
    updateUndoUI();
    if (act.type === 'voxels') buildAllMeshes();
  }

  /*** ---- Chunk Size Management ---- ***/
  function updateChunkSizeUI() {
    document.getElementById('sizeX').textContent = chunk.sizeX;
    document.getElementById('sizeY').textContent = chunk.sizeY;
    document.getElementById('sizeZ').textContent = chunk.sizeZ;
  }

  /*** ---- Camera Target Management ---- ***/
  function updateCameraTargetUI() {
    document.getElementById('cameraX').textContent = Math.round(camera.target[0]);
    document.getElementById('cameraY').textContent = Math.round(camera.target[1]);
    document.getElementById('cameraZ').textContent = Math.round(camera.target[2]);
  }

  function moveCameraTargetX(delta) {
    camera.target[0] += delta;
    updateCameraTargetUI();
  }

  function moveCameraTargetY(delta) {
    camera.target[1] += delta;
    updateCameraTargetUI();
  }

  function moveCameraTargetZ(delta) {
    camera.target[2] += delta;
    updateCameraTargetUI();
  }

  function expandChunkX() {
    const newSize = chunk.sizeX + 1;
    chunk.expandSize(newSize, chunk.sizeY, chunk.sizeZ);
    N = Math.max(chunk.sizeX, chunk.sizeY, chunk.sizeZ);
    
    // Update camera target to center on expanded chunk
    camera.target = [chunk.sizeX / 2, chunk.sizeY / 2, chunk.sizeZ / 2];
    
    buildAxisGizmo(); // Rebuild grid and axes
    buildAllMeshes();
    updateChunkSizeUI();
    updateCameraTargetUI();
    clearHistory(); // Clear undo/redo as chunk structure changed
  }

  function expandChunkY() {
    const newSize = chunk.sizeY + 1;
    chunk.expandSize(chunk.sizeX, newSize, chunk.sizeZ);
    N = Math.max(chunk.sizeX, chunk.sizeY, chunk.sizeZ);
    
    camera.target = [chunk.sizeX / 2, chunk.sizeY / 2, chunk.sizeZ / 2];
    
    buildAllMeshes();
    updateChunkSizeUI();
    updateCameraTargetUI();
    clearHistory();
  }

  function expandChunkZ() {
    const newSize = chunk.sizeZ + 1;
    chunk.expandSize(chunk.sizeX, chunk.sizeY, newSize);
    N = Math.max(chunk.sizeX, chunk.sizeY, chunk.sizeZ);
    
    camera.target = [chunk.sizeX / 2, chunk.sizeY / 2, chunk.sizeZ / 2];
    
    buildAxisGizmo(); // Rebuild grid and axes
    buildAllMeshes();
    updateChunkSizeUI();
    updateCameraTargetUI();
    clearHistory();
  }

  function shrinkChunkX() {
    if (chunk.sizeX <= 1) return; // Minimum size is 1
    const newSize = chunk.sizeX - 1;
    chunk.expandSize(newSize, chunk.sizeY, chunk.sizeZ);
    N = Math.max(chunk.sizeX, chunk.sizeY, chunk.sizeZ);
    
    camera.target = [chunk.sizeX / 2, chunk.sizeY / 2, chunk.sizeZ / 2];
    
    buildAxisGizmo();
    buildAllMeshes();
    updateChunkSizeUI();
    updateCameraTargetUI();
    clearHistory();
  }

  function shrinkChunkY() {
    if (chunk.sizeY <= 1) return;
    const newSize = chunk.sizeY - 1;
    chunk.expandSize(chunk.sizeX, newSize, chunk.sizeZ);
    N = Math.max(chunk.sizeX, chunk.sizeY, chunk.sizeZ);
    
    camera.target = [chunk.sizeX / 2, chunk.sizeY / 2, chunk.sizeZ / 2];
    
    buildAllMeshes();
    updateChunkSizeUI();
    updateCameraTargetUI();
    clearHistory();
  }

  function shrinkChunkZ() {
    if (chunk.sizeZ <= 1) return;
    const newSize = chunk.sizeZ - 1;
    chunk.expandSize(chunk.sizeX, chunk.sizeY, newSize);
    N = Math.max(chunk.sizeX, chunk.sizeY, chunk.sizeZ);
    
    camera.target = [chunk.sizeX / 2, chunk.sizeY / 2, chunk.sizeZ / 2];
    
    buildAxisGizmo();
    buildAllMeshes();
    updateChunkSizeUI();
    updateCameraTargetUI();
    clearHistory();
  }

  /*** ---- Shift all voxels ---- ***/
  function shiftVoxels(dx, dy, dz) {
    const act = beginVoxelAction(`Shift ${dx !== 0 ? (dx > 0 ? '+X' : '-X') : dy !== 0 ? (dy > 0 ? '+Y' : '-Y') : (dz > 0 ? '+Z' : '-Z')}`);
    
    // Create temporary copy of voxel data
    const tempSolid = new Array(chunk.length);
    const tempMaterial = new Uint8Array(chunk.length);
    
    for (let i = 0; i < chunk.length; i++) {
      tempSolid[i] = chunk.isSolid(i);
      tempMaterial[i] = chunk.material(i);
    }
    
    // Clear the chunk first
    for (let i = 0; i < chunk.length; i++) {
      chunk.setSolid(i, false);
      chunk.setMaterial(i, 0);
    }
    
    // Copy voxels to new positions
    for (let z = 0; z < chunk.sizeZ; z++) {
      for (let y = 0; y < chunk.sizeY; y++) {
        for (let x = 0; x < chunk.sizeX; x++) {
          const oldIdx = chunk.idx3(x, y, z);
          if (!tempSolid[oldIdx]) continue;
          
          const newX = x + dx;
          const newY = y + dy;
          const newZ = z + dz;
          
          // TODO: undo is not working ... fix this
          
          // Only copy if new position is within bounds
          if (chunk.within(newX, newY, newZ)) {
            const newIdx = chunk.idx3(newX, newY, newZ);
            recordVoxelChange(act, newIdx, true, tempMaterial[oldIdx]);
          } else {
            // Voxel moved out of bounds - record its removal
            recordVoxelChange(act, oldIdx, false, tempMaterial[oldIdx]);
          }
        }
      }
    }
    
    // Shift animation region bounding boxes
    for (const region of animSystem.regions.values()) {
      region.min[0] += dx;
      region.min[1] += dy;
      region.min[2] += dz;
      
      region.max[0] += dx;
      region.max[1] += dy;
      region.max[2] += dz;
    }
    
    // Shift animation keyframe pivot points
    for (const anim of animSystem.animations.values()) {
      for (const kf of anim.keyframes) {
        if (kf.type === 'rotate' && kf.pivot) {
          kf.pivot[0] += dx;
          kf.pivot[1] += dy;
          kf.pivot[2] += dz;
        }
      }
    }
    
    commitAction(act, true);
  }

  /*** ---- Input, hover, keyboard ---- ***/
  let dragging = false, lastX = 0, lastY = 0;
  let mouseX = 0, mouseY = 0, needsPick = true, buttons = 0;
  let hoverVoxel = -1, hoverFace = -1;
  let continuousMode = false; // true when shift + mouse button held
  let lastAppliedVoxel = -1; // track last voxel we applied tool to

  // Hover sets
  let rowHoverSurf = [], rowHoverAdd = [], planeHoverSurf = [], planeHoverAdd = [];

  // Will be set by initializeUI
  let updateHoverUI = () => { };

  // Apply current tool to picked voxel/face
  function applyToolAt(voxel, face) {
    if (voxel < 0 || face < 0) return;
    
    const currentMode = mode;
    const currentOption = option;
    
    if (currentMode === 'paint') {
      if (currentOption === 'voxel' && chunk.isSolid(voxel)) {
        const act = beginVoxelAction('Paint voxel');
        recordVoxelChange(act, voxel, true, palette.getBrush());
        commitAction(act);
      }
    } else if (currentMode === 'add') {
      if (currentOption === 'voxel') {
        const [x, y, z] = chunk.coordsOf(voxel);
        const d = FACE_DIRS[face];
        const nx = x + d[0];
        const ny = y + d[1];
        const nz = z + d[2];
        if (chunk.within(nx, ny, nz)) {
          const id = chunk.idx3(nx, ny, nz);
          if (!chunk.isSolid(id)) {
            const act = beginVoxelAction('Add voxel');
            recordVoxelChange(act, id, true, palette.getBrush());
            commitAction(act);
          }
        }
      }
    } else if (currentMode === 'carve') {
      if (currentOption === 'voxel' && chunk.isSolid(voxel)) {
        const act = beginVoxelAction('Remove voxel');
        recordVoxelChange(act, voxel, false, chunk.material(voxel));
        commitAction(act);
      }
    }
  }

  function updateHover() {
    if (!needsPick) return;
    needsPick = false;
    const p = decodePickAt(mouseX, mouseY);
    hoverVoxel = p.voxel;
    hoverFace = p.face;
    updateHoverUI();

    // Compute previews
    if (hoverVoxel >= 0 && hoverFace >= 0) {
      if (mode === 'add' && option === 'row') {
        rowHoverAdd = getRowAddTargets(hoverVoxel, hoverFace);
      } else {
        rowHoverAdd = [];
      }

      if (mode !== 'add' && option === 'row') {
        rowHoverSurf = getRowSurfaceVoxels(hoverVoxel, hoverFace);
      } else {
        rowHoverSurf = [];
      }

      if (mode === 'add' && option === 'plane') {
        planeHoverAdd = getPlaneAddTargets(hoverVoxel, hoverFace);
      } else {
        planeHoverAdd = [];
      }

      if (mode !== 'add' && option === 'plane') {
        planeHoverSurf = getPlaneSurfaceVoxels(hoverVoxel, hoverFace);
      } else {
        planeHoverSurf = [];
      }

    } else {
      rowHoverSurf = [];
      rowHoverAdd = [];
      planeHoverSurf = [];
      planeHoverAdd = [];
    }
  }

  const COLOR_PAINT = [1.0, 0.60, 0.20];
  const COLOR_CARVE = [1.0, 0.32, 0.32];
  const COLOR_ADD = [0.27, 0.95, 0.42];

  /*** ======= Regioning Meshes ======= ***/

  function buildAllMeshes() {

    renderProg.meta.renderIndexCount = chunk.buildGreedyRenderMeshMain(gl, renderProg, renderProg.vao);
    // TODO: build pick for regions and when animated
    chunk.buildPickFaces(gl, pickProg);

    renderProg.meta.regions = {};
    for (const [name, region] of animSystem.regions.entries()) {

      renderProg.meta.regions[name] = {};
      renderProg.meta.regions[name].vao = gl.createVertexArray();
      renderProg.meta.regions[name].visible = true;
      renderProg.meta.regions[name].indexCount = chunk.buildGreedyRenderMeshRegion(gl, renderProg, renderProg.meta.regions[name].vao, name);
    }
  }

  buildAllMeshes();

  // Create particle data texture (do this once during initialization)
  const maxParticles = 1000;
  const pixelsPerParticle = 2;  // 2 pixels per particle
  const textureWidth = 64;  // Power of 2, adjust based on maxParticles
  const textureHeight = Math.ceil((maxParticles * pixelsPerParticle) / textureWidth);

  const particleDataTexture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, particleDataTexture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, textureWidth, textureHeight, 0, gl.RGBA, gl.FLOAT, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  
  const texError = gl.getError();
  if (texError !== gl.NO_ERROR) {
    console.error('Texture creation error:', texError);
  }

  // Update particle data each frame
  function updateParticleTexture(particles) {
    const data = new Float32Array(textureWidth * textureHeight * 4);
    
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      
      // Calculate pixel positions for this particle (2 pixels per particle)
      const pixel0Index = i * 2;
      const pixel1Index = i * 2 + 1;
      
      // Convert pixel index to x,y coordinates
      const x0 = pixel0Index % textureWidth;
      const y0 = Math.floor(pixel0Index / textureWidth);
      const x1 = pixel1Index % textureWidth;
      const y1 = Math.floor(pixel1Index / textureWidth);
      
      // Calculate linear index in the data array (row-major order)
      const baseIdx0 = (y0 * textureWidth + x0) * 4;
      const baseIdx1 = (y1 * textureWidth + x1) * 4;
      
      // Pixel 0: position (RGB) + size (A)
      data[baseIdx0 + 0] = p.position[0];
      data[baseIdx0 + 1] = p.position[1];
      data[baseIdx0 + 2] = p.position[2];
      data[baseIdx0 + 3] = p.size;
      
      // Pixel 1: color (R) + alpha (G)
      data[baseIdx1 + 0] = p.color / 255.0;  // Normalize color to 0-1
      data[baseIdx1 + 1] = p.getAlpha();
      data[baseIdx1 + 2] = 0;  // Unused
      data[baseIdx1 + 3] = 0;  // Unused
    }
    
    gl.bindTexture(gl.TEXTURE_2D, particleDataTexture);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, textureWidth, textureHeight, gl.RGBA, gl.FLOAT, data);
  }


  function render() {
    // Update animation time
    const now = performance.now();
    const dt = (now - lastTime) / 1000;
    lastTime = now;
    
    animSystem.update(dt);

    gl.clearColor(0.07, 0.08, 0.1, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(renderProg.program);
    renderProg.uPalette.set(palette.colors);
    renderProg.uView.set(camera.view());
    renderProg.uProj.set(proj);
    renderProg.uNormalMat.set(new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]));
    renderProg.uLightDirWS.set(new Float32Array([0.7 / 1.7, -1.2 / 1.7, 0.9 / 1.7]));
    renderProg.uAmbient.set(ambient);

    // Render main mesh (non-animated voxels) with identity transform
    if (renderProg.meta.visible) {
      renderProg.uModel.set(model);
      gl.bindVertexArray(renderProg.vao);
      gl.drawElements(gl.TRIANGLES, renderProg.meta.renderIndexCount, gl.UNSIGNED_INT, 0);
      gl.bindVertexArray(null);
    }

    // Render each animated region with its transform
    Object.keys(renderProg.meta.regions).forEach(name => {
      const region = renderProg.meta.regions[name];
      if (!region.visible) return;
      
      // Get animation transform for this region
      const animTransform = animSystem.getRegionTransform(name);
      const regionModel = Mat4.multiply(model, animTransform);
      
      renderProg.uModel.set(regionModel);
      gl.bindVertexArray(region.vao);
      gl.drawElements(gl.TRIANGLES, region.indexCount, gl.UNSIGNED_INT, 0);
      gl.bindVertexArray(null);
    });

    // Render axis gizmo
    gl.useProgram(axisProg.program);
    axisProg.uModel.set(model);
    axisProg.uView.set(camera.view());
    axisProg.uProj.set(proj);
    gl.bindVertexArray(axisProg.vao);
    gl.drawArrays(gl.LINES, 0, axisProg.meta.count);
    gl.bindVertexArray(null);

    // Render particles
    const particles = animSystem.getAllParticles();
    if (particles.length > 0) {

      // Enable blending for transparent particles
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      
      gl.useProgram(particleProg.program);
      particleProg.uPalette.set(palette.colors);
      particleProg.uView.set(camera.view());
      particleProg.uProj.set(proj);
      particleProg.uLightDirWS.set(new Float32Array([0.7 / 1.7, -1.2 / 1.7, 0.9 / 1.7]));
      particleProg.uAmbient.set(ambient);
      
updateParticleTexture(particles);
      
      // if (particleProg.uParticleCount) particleProg.uParticleCount.set(count);
      // if (particleProg.uParticlePositions) particleProg.uParticlePositions.set(positions);
      // if (particleProg.uParticleSizes) particleProg.uParticleSizes.set(sizes);
      // if (particleProg.uParticleColors) particleProg.uParticleColors.set(colors);
      // if (particleProg.uParticleAlphas) particleProg.uParticleAlphas.set(alphas);
      

      // console.log('Updating particle texture with', particleProg);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, particleDataTexture);
      particleProg.uParticleData.set(0);  // Texture unit 0
      particleProg.uTextureWidth.set(textureWidth);
      // particleProg.uParticleCount.set(activeParticleCount);

      gl.bindVertexArray(particleProg.vao);
      gl.drawElementsInstanced(gl.TRIANGLES, particleCube.count, gl.UNSIGNED_SHORT, 0, particles.length);
      const drawError = gl.getError();
      if (drawError !== gl.NO_ERROR) {
        console.error('Draw error:', drawError, 'hex:', drawError.toString(16));
      }
      gl.bindVertexArray(null);
      
      gl.disable(gl.BLEND);
    }

    updateHover();

    if (mode !== 'move' && hoverVoxel >= 0 && hoverFace >= 0) {
      if (option === 'plane') {
        if (mode === 'add') {
          for (const t of planeHoverAdd) drawVoxelWire(t, COLOR_ADD, 1.006);
        } else if (mode === 'carve') {
          for (const id of planeHoverSurf) drawVoxelWire(id, COLOR_CARVE, 1.006);
        } else if (mode === 'paint') {
          for (const id of planeHoverSurf) drawVoxelWire(id, COLOR_PAINT, 1.006);
        }
      } else if (option === 'row') {
        if (mode === 'add') {
          for (const t of rowHoverAdd) drawVoxelWire(t, COLOR_ADD, 1.006);
        } else if (mode === 'carve') {
          for (const id of rowHoverSurf) drawVoxelWire(id, COLOR_CARVE, 1.006);
        } else if (mode === 'paint') {
          for (const id of rowHoverSurf) drawVoxelWire(id, COLOR_PAINT, 1.006);
        }
      } else if (option === 'voxel') {
        if (mode === 'add') {
          const [x, y, z] = chunk.coordsOf(hoverVoxel);
          const d = FACE_DIRS[hoverFace];
          const nx = x + d[0];
          const ny = y + d[1];
          const nz = z + d[2];
          if (chunk.within(nx, ny, nz) && !chunk.isSolid(chunk.idx3(nx, ny, nz))) drawVoxelWire(chunk.idx3(nx, ny, nz), COLOR_ADD, 1.006);
        } else if (mode === 'carve') {
          const [x, y, z] = chunk.coordsOf(hoverVoxel);
          const id = chunk.idx3(x, y, z);
          if (chunk.isSolid(id)) drawVoxelWire(hoverVoxel, COLOR_CARVE, 1.006);
        } else if (mode === 'paint') {
          const [x, y, z] = chunk.coordsOf(hoverVoxel);
          const id = chunk.idx3(x, y, z);
          if (chunk.isSolid(id)) drawVoxelWire(hoverVoxel, COLOR_PAINT, 1.006);
        }
      }
    }

    // Render region overlays
    for (const [regionName, region] of animSystem.regions.entries()) {
      if (regionOverlaysVisible.get(regionName)) {
        const [minX, minY, minZ] = region.min;
        const [maxX, maxY, maxZ] = region.max;
        const color = selectedRegionName === regionName ? [0.2, 0.6, 1.0] : [0.6, 0.8, 0.3];
        drawWireAABB(minX, minY, minZ, maxX, maxY, maxZ, color, 1.01);
      }
    }

    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
  setTimeout(resize, 0);

  /*** ---- Initialize UI ---- ***/
  const uiState = {
    canvas,
    chunk,
    N,
    palette,
    camera,
    animSystem,
    animationTransforms,

    // State getters/setters
    getMode: () => mode,
    setMode: (val) => { mode = val; },
    getOption: () => option,
    setOption: (val) => { option = val; },
    getHoverVoxel: () => hoverVoxel,
    setHoverVoxel: (val) => { hoverVoxel = val; },
    getHoverFace: () => hoverFace,
    setHoverFace: (val) => { hoverFace = val; },
    setNeedsPick: (val) => { needsPick = val; },
    getDragging: () => dragging,
    setDragging: (val) => { dragging = val; },
    getLastX: () => lastX,
    setLastX: (val) => { lastX = val; },
    getLastY: () => lastY,
    setLastY: (val) => { lastY = val; },
    getMouseX: () => mouseX,
    setMouseX: (val) => { mouseX = val; },
    getMouseY: () => mouseY,
    setMouseY: (val) => { mouseY = val; },
    getLastTime: () => lastTime,
    setLastTime: (val) => { lastTime = val; },
    getRowHoverSurf: () => rowHoverSurf,
    setRowHoverSurf: (val) => { rowHoverSurf = val; },
    getRowHoverAdd: () => rowHoverAdd,
    setRowHoverAdd: (val) => { rowHoverAdd = val; },
    getPlaneHoverSurf: () => planeHoverSurf,
    setPlaneHoverSurf: (val) => { planeHoverSurf = val; },
    getPlaneHoverAdd: () => planeHoverAdd,
    setPlaneHoverAdd: (val) => { planeHoverAdd = val; },
    getSelectedRegionName: () => selectedRegionName,
    setSelectedRegionName: (val) => { selectedRegionName = val; },
    getRegionOverlaysVisible: () => regionOverlaysVisible,
    setRegionOverlaysVisible: (val) => { regionOverlaysVisible = val; },
    getContinuousMode: () => continuousMode,
    setContinuousMode: (val) => { continuousMode = val; },
    getLastAppliedVoxel: () => lastAppliedVoxel,
    setLastAppliedVoxel: (val) => { lastAppliedVoxel = val; },

    // Functions
    buildAllMeshes,
    applyToolAt,
    buildAxisGizmo,
    updateChunkSizeUI,
    updateCameraTargetUI,
    moveCameraTargetX,
    moveCameraTargetY,
    moveCameraTargetZ,
    clearHistory,
    undo,
    redo,
    shiftVoxels,
    expandChunkX,
    expandChunkY,
    expandChunkZ,
    shrinkChunkX,
    shrinkChunkY,
    shrinkChunkZ,
    exportToJSON,
    importFromJSON,
    decodePickAt,
    getRowSurfaceVoxels,
    getRowAddTargets,
    getPlaneSurfaceVoxels,
    getPlaneAddTargets,
    beginVoxelAction,
    recordVoxelChange,
    commitAction,

    // Constants
    FACE_DIRS
  };

  initializeUI(uiState);

  // Get updateHoverUI function after initialization
  updateHoverUI = uiState.updateHoverUI;

}

document.addEventListener('DOMContentLoaded', main);
