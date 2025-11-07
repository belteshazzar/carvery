import './style.css'
import { Mat4, Vec3, toRadians } from './math.js';
import { makeCubeEdges, makeAxisGizmo, OrbitCamera } from './3d.js';
import { createProgram } from './webgl.js';
import lambertFrag from './lambert.frag';
import lambertVert from './lambert.vert';
import wireframeFrag from './wireframe.frag';
import wireframeVert from './wireframe.vert';
import pickFrag from './pick.frag';
import pickVert from './pick.vert';
import axisFrag from './axis.frag';
import axisVert from './axis.vert';
import { 
  hexToRgbF,
  rgbToHexF,
  PaletteUI 
} from './palette.js';
import { AnimationSystem } from './animation.js';
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
  const pickProg = createProgram(gl, pickVert, pickFrag);
  const wireProg = createProgram(gl, wireframeVert, wireframeFrag);
  const axisProg = createProgram(gl, axisVert, axisFrag);

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

  // gizmo

  const gizmo = makeAxisGizmo();

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

// Add inside main()
const animSystem = new AnimationSystem();
let animationTransforms = new Map();
let lastTime = 0;

  /*** ---- World State ---- ***/
  let N = 16;
  const chunk = new VoxelChunk(N);

  const FACE_DIRS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],[0,0,0]]; // last is for ground plane
  const FACE_INFO = [{ axis: 0, u: 2, v: 1 }, { axis: 0, u: 2, v: 1 }, { axis: 1, u: 0, v: 2 }, { axis: 1, u: 0, v: 2 }, { axis: 2, u: 0, v: 1 }, { axis: 2, u: 0, v: 1 }];

  chunk.seedMaterials("bands");

  /*** ---- Pick faces (unmerged) ---- ***/

  function rebuildAll() { 
    let { vao, indexCount } = chunk.buildGreedyRenderMesh(gl,renderProg, renderProg.vao); 
    renderProg.meta.renderIndexCount = indexCount;
    chunk.buildPickFaces(gl, pickProg);
  }

  rebuildAll();

  /*** ---- Camera / lighting ---- ***/
  const camera = new OrbitCamera({ 
    target: [8,8,8],
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

  function exportToJSON() {
    const palHex = [];

    for (let i = 0; i < 16; i++) palHex.push(rgbToHexF(palette.colors[i * 3 + 0], palette.colors[i * 3 + 1], palette.colors[i * 3 + 2]));

    const voxels = [];
    for (let z = 0; z < N; z++) {
      for (let y = 0; y < N; y++) {
        for (let x = 0; x < N; x++) {
          const id = chunk.idx3(x, y, z);
          if (chunk.isSolid(id)) {
            voxels.push( `${intToHexChar(x)}${intToHexChar(y)}${intToHexChar(z)}${intToHexChar(chunk.material(id))}`);
          }
        }
      }
    }

    return { version: 1, size: N, palette: palHex, voxels };
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

  function importFromJSON(obj) {
    if (!obj || typeof obj !== 'object') throw new Error('Root must be object');
    if (!Array.isArray(obj.voxels)) throw new Error('Missing "voxels"');
    if (obj.size != 16) throw new Error('Invalid "size"');
    
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
      const x = hexCharToInt(v[0]);
      const y = hexCharToInt(v[1]);
      const z = hexCharToInt(v[2]);
      const m = (hexCharToInt(v[3]) | 0) & 15;
      if (chunk.within(x, y, z)) {
        const id = chunk.idx3(x, y, z);
        chunk.setSolid(id, true);
        chunk.setMaterial(id, m);
      }
    }
    rebuildAll();
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
    for (let x = 0; x < N; x++) {
      for (let z = 0; z < N; z++) {
        const y = 0;
        out.push(chunk.idx3(x, y, z));
      }
    }
    return out;
  }

  function getPlaneAddTargets(vIdx, faceId) {
    const d = FACE_DIRS[faceId]
    const surf = (faceId === 6) ? getGroundPlaneVoxels() :getPlaneSurfaceVoxels(vIdx, faceId);
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
    if (action.type === 'voxels' && rebuild) rebuildAll();
  }

  function undo() {
    if (undoStack.length === 0) return;
    const act = undoStack.pop();
    applyAction(act, 'undo');
    redoStack.push(act);
    updateUndoUI();
    if (act.type === 'voxels') rebuildAll();
  }

  function redo() {
    if (redoStack.length === 0) return;
    const act = redoStack.pop();
    applyAction(act, 'do');
    undoStack.push(act);
    updateUndoUI();
    if (act.type === 'voxels') rebuildAll();
  }

  /*** ---- Input, hover, keyboard ---- ***/
  let dragging = false, lastX = 0, lastY = 0;
  let mouseX = 0, mouseY = 0, needsPick = true, buttons = 0;
  let hoverVoxel = -1, hoverFace = -1;

  // Hover sets
  let rowHoverSurf = [], rowHoverAdd = [], planeHoverSurf = [], planeHoverAdd = [];

  // Will be set by initializeUI
  let updateHoverUI = () => {};

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

  /*** ======= Grouping Meshes ======= ***/
  const meshData = {};
  let groupNames = [];

  function buildAllMeshes() {
  // 1. Remove group voxels from main
  const mainSolid = new Array(N*N*N).fill(false);
  for (let i = 0; i < chunk.isSolid.length; i++) mainSolid[i] = chunk.isSolid(i);
  for (const group of animSystem.groups.values()) {
    for (const idx of group.voxels) mainSolid[idx] = false;
  }
  meshData["main"] = { visible: true };

  // 2. Create isSolid for each group
  for (const [name, group] of animSystem.groups.entries()) {
    const arr = new Array(N*N*N).fill(false);
    for (const idx of group.voxels) arr[idx] = true;
    meshData[name] = { isSolid: arr, visible: true };
  }

  // 3. Build geometry for each
  for (const name of Object.keys(meshData)) {
    const solidArr = name === "main" ? mainSolid : meshData[name].isSolid;
    if (!meshData[name].vao) meshData[name].vao = gl.createVertexArray();
    const { vao, indexCount } = chunk.buildGreedyRenderMesh(gl,renderProg, meshData[name].vao);
    //meshData[name].vao = vao;
    meshData[name].indexCount = indexCount;
  }

  // 4. Update group names
  groupNames = ["main", ...Array.from(animSystem.groups.keys())];
  updateGroupPanel();
}

function updateGroupPanel() {
  const panel = document.getElementById('groupPanel');
  panel.innerHTML = '';
  groupNames.forEach(name => {
    const label = document.createElement('label');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = meshData[name].visible;
    cb.addEventListener('change', () => {
      meshData[name].visible = cb.checked;
    });
    label.appendChild(cb);
    label.appendChild(document.createTextNode(name === "main" ? "Main" : name));
    panel.appendChild(label);
  });
}

  // Add call to updateAxisLabels in render loop
  function render() {
    gl.clearColor(0.07, 0.08, 0.1, 1); 
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(renderProg.program);
    renderProg.uPalette.set(palette.colors);
    renderProg.uModel.set(model);
    renderProg.uView.set(camera.view());
    renderProg.uProj.set(proj);
    renderProg.uNormalMat.set(new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]));
    renderProg.uLightDirWS.set(new Float32Array([0.7 / 1.7, -1.2 / 1.7, 0.9 / 1.7]));
    renderProg.uAmbient.set(ambient);

    gl.bindVertexArray(renderProg.vao); 
    gl.drawElements(gl.TRIANGLES, renderProg.meta.renderIndexCount, gl.UNSIGNED_INT, 0); 
    gl.bindVertexArray(null);

  // for (const name of groupNames) {
  //   if (!meshData[name].visible) continue;
  //   gl.bindVertexArray(meshData[name].vao);
  //   gl.drawElements(gl.TRIANGLES, meshData[name].indexCount, gl.UNSIGNED_INT, 0);
  //   gl.bindVertexArray(null);
  // }

    // Render axis gizmo
    gl.useProgram(axisProg.program);
    axisProg.uModel.set(model);
    axisProg.uView.set(camera.view());
    axisProg.uProj.set(proj);
    gl.bindVertexArray(axisProg.vao);
    gl.drawArrays(gl.LINES, 0, gizmo.count);
    gl.bindVertexArray(null);

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
          const nx = x + d[0], ny = y + d[1], nz = z + d[2];
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
    
    // Functions
    rebuildAll,
    buildAllMeshes,
    clearHistory,
    undo,
    redo,
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
    updateGroupPanel,
    
    // Constants
    FACE_DIRS,
    
    // Will be set by initializeUI
    groupNames
  };

  initializeUI(uiState);
  
  // Get updateHoverUI function after initialization
  updateHoverUI = uiState.updateHoverUI;
}

document.addEventListener('DOMContentLoaded', main);
