import './style.css'

(function () {
  'use strict';

  const canvas = document.getElementById('glcanvas');
  const gl = canvas.getContext('webgl', { antialias: true, alpha: false });
  if (!gl) { alert('WebGL not supported'); return; }

  // ===== Shaders =====
  const vsSrc = `
    attribute vec3 a_pos;
    attribute vec3 a_col;
    uniform mat4 u_mvp;
    varying vec3 v_col;
    void main() {
      gl_Position = u_mvp * vec4(a_pos, 1.0);
      v_col = a_col;
    }
  `;
  const fsSrc = `
    precision mediump float;
    varying vec3 v_col;
    void main() {
      gl_FragColor = vec4(v_col, 1.0);
    }
  `;
  function compileShader(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(s)); throw new Error('Shader compile failed');
    }
    return s;
  }
  function createProgram(vs, fs) {
    const p = gl.createProgram();
    gl.attachShader(p, compileShader(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, compileShader(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(p)); throw new Error('Program link failed');
    }
    return p;
  }
  const prog = createProgram(vsSrc, fsSrc);
  gl.useProgram(prog);
  const a_pos = gl.getAttribLocation(prog, 'a_pos');
  const a_col = gl.getAttribLocation(prog, 'a_col');
  const u_mvp = gl.getUniformLocation(prog, 'u_mvp');

  const posBuf = gl.createBuffer();
  const colBuf = gl.createBuffer();
  gl.enableVertexAttribArray(a_pos);
  gl.enableVertexAttribArray(a_col);

  gl.enable(gl.DEPTH_TEST);
  gl.frontFace(gl.CCW);
  gl.cullFace(gl.BACK);
  gl.enable(gl.CULL_FACE);
  gl.clearColor(0.10, 0.12, 0.16, 1);

  // ===== Math =====
  function mat4Multiply(a, b) {
    const out = new Float32Array(16);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
      out[c * 4 + r] =
        a[0 * 4 + r] * b[c * 4 + 0] +
        a[1 * 4 + r] * b[c * 4 + 1] +
        a[2 * 4 + r] * b[c * 4 + 2] +
        a[3 * 4 + r] * b[c * 4 + 3];
    }
    return out;
  }
  function mat4Perspective(fovy, aspect, near, far) {
    const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
    const m = new Float32Array(16);
    m[0] = f / aspect; m[5] = f; m[10] = (far + near) * nf; m[11] = -1; m[14] = (2 * far * near) * nf; m[15] = 0;
    return m;
  }
  function vSub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function vNorm(a) { const L = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / L, a[1] / L, a[2] / L]; }
  function vCross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function vDot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function lookAt(eye, target, up) {
    const z = vNorm(vSub(eye, target));   // forward
    const x = vNorm(vCross(up, z));       // right
    const y = vCross(z, x);               // up
    const m = new Float32Array(16);
    m[0] = x[0]; m[4] = x[1]; m[8] = x[2]; m[12] = -vDot(x, eye);
    m[1] = y[0]; m[5] = y[1]; m[9] = y[2]; m[13] = -vDot(y, eye);
    m[2] = z[0]; m[6] = z[1]; m[10] = z[2]; m[14] = -vDot(z, eye);
    m[3] = 0; m[7] = 0; m[11] = 0; m[15] = 1;
    return m;
  }
  function eyeFromSpherical(r, az, el) {
    const ce = Math.cos(el);
    return [r * Math.sin(az) * ce, r * Math.sin(el), r * Math.cos(az) * ce];
  }

  // ===== Orbit & Input =====
  let radius = 3.2, theta = 0.6, phi = 0.35;
  const minPhi = (-Math.PI / 2) + 0.05, maxPhi = (Math.PI / 2) - 0.05, minR = 2.3, maxR = 30.0;
  let dragging = false, lastX = 0, lastY = 0, downX = 0, downY = 0;
  let lastMouseX = null, lastMouseY = null;
  let shiftDown = false, ctrlDown = false, altDown = false;

  let mode = document.querySelector('input[name="mode"]:checked').value;
  document.querySelectorAll('input[name="mode"]').forEach(radio => {
    radio.addEventListener('change', function () {
      mode = this.value
    });
  });

  function onDown(x, y) { dragging = true; lastX = x; lastY = y; downX = x; downY = y; }
  function onMove(e) {
    const x = e.clientX, y = e.clientY; lastMouseX = x; lastMouseY = y;
    if (dragging) {
      const dx = x - lastX, dy = y - lastY; lastX = x; lastY = y;
      theta -= dx * 0.005;
      phi += dy * 0.005;
      if (phi < minPhi) phi = minPhi; if (phi > maxPhi) phi = maxPhi;
    } else {
      updateHover(x, y);
    }
  }

  function onUp(e) {
    const x = e.clientX, y = e.clientY;
    const dist = Math.abs(x - downX) + Math.abs(y - downY);
    if (dist < 6) {
      if (mode === "paint") paintFaceAt(x, y);
      else if (mode === "add") addVoxelAt(x, y);
      else if (mode === "carve-row") carveRowAt(x, y);
      else if (mode === "carve") removeVoxelAt(x, y);
    }
    dragging = false;
  }
  canvas.addEventListener('mousedown', (e) => onDown(e.clientX, e.clientY));
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const d = Math.sign(e.deltaY);
    radius *= (1 + 0.12 * d);
    radius = Math.min(Math.max(radius, minR), maxR);
  }, { passive: false });

  window.addEventListener('keydown', (e) => {
    if (lastMouseX != null) updateHover(lastMouseX, lastMouseY);

    const k = e.key.toLowerCase();
    const cmd = e.ctrlKey || e.metaKey;
    if (cmd && k === 'z' && !e.repeat && !dragging) {
      e.preventDefault();
      if (e.shiftKey) redoAction();
      else undoAction();
    } else if (cmd && k === 'y' && !e.repeat && !dragging) {
      e.preventDefault();
      redoAction();
    }
  });
  window.addEventListener('keyup', (e) => {
    if (lastMouseX != null) updateHover(lastMouseX, lastMouseY);
  });

  // ===== Resize / DPR =====
  function resize() {
    const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    const w = Math.floor(canvas.clientWidth * dpr);
    const h = Math.floor(canvas.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
  window.addEventListener('resize', resize);
  resize();

  // ===== Voxel grid =====
  const N = 16;
  const SIZE = 2 / N;
  const BMIN = -1.0, BMAX = 1.0;
  const vox = new Uint8Array(N * N * N); vox.fill(1);
  function I(x, y, z) { return x + y * N + z * N * N; }
  function inB(x, y, z) { return x >= 0 && x < N && y >= 0 && y < N && z >= 0 && z < N; }

  const FACE = { PX: 0, NX: 1, PY: 2, NY: 3, PZ: 4, NZ: 5 };
  const BASE = {
    [FACE.PZ]: [1.00, 0.30, 0.30],
    [FACE.NZ]: [0.30, 1.00, 0.30],
    [FACE.PX]: [0.30, 0.45, 1.00],
    [FACE.NX]: [1.00, 1.00, 0.30],
    [FACE.PY]: [1.00, 0.35, 1.00],
    [FACE.NY]: [0.30, 1.00, 1.00],
  };

  // Per-face overrides -> palette index (null or 0..15)
  const faceOverrideIdx = new Array(N);
  for (let x = 0; x < N; x++) {
    faceOverrideIdx[x] = new Array(N);
    for (let y = 0; y < N; y++) {
      faceOverrideIdx[x][y] = new Array(N);
      for (let z = 0; z < N; z++) {
        faceOverrideIdx[x][y][z] = [null, null, null, null, null, null];
      }
    }
  }
  function setFaceOverrideIdx(x, y, z, f, idx) { faceOverrideIdx[x][y][z][f] = (idx == null ? null : (idx | 0)); }
  function getFaceOverrideIdx(x, y, z, f) { return faceOverrideIdx[x][y][z][f]; }
  function snapshotOverridesIdx(x, y, z) {
    const arr = new Array(6);
    for (let f = 0; f < 6; f++) { const ov = getFaceOverrideIdx(x, y, z, f); arr[f] = (ov == null ? null : ov | 0); }
    return arr;
  }
  function applyOverridesIdx(x, y, z, arr) {
    for (let f = 0; f < 6; f++) { setFaceOverrideIdx(x, y, z, f, arr ? arr[f] : null); }
  }

  function checkerColor(face, x, y, z) {
    const base = BASE[face];
    let u = 0, v = 0;
    switch (face) {
      case FACE.PZ: u = x; v = y; break;
      case FACE.NZ: u = (N - 1 - x); v = y; break;
      case FACE.PX: u = z; v = y; break;
      case FACE.NX: u = (N - 1 - z); v = y; break;
      case FACE.PY: u = x; v = (N - 1 - z); break;
      case FACE.NY: u = x; v = z; break;
    }
    const light = ((u + v) & 1) === 0 ? 0.90 : 0.55;
    return [base[0] * light, base[1] * light, base[2] * light];
  }

  // ===== Palette (editable, persisted) =====
  const PALETTE_KEY = 'voxelPalette16';
  const defaultPaletteHex = [
    '#ffffff', '#000000', '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff',
    '#ff8800', '#8844ff', '#00cc66', '#cc0066', '#775533', '#aaaaaa', '#444444', '#66ccff'
  ];
  let paletteHex = loadPalette() || defaultPaletteHex.slice();
  let selectedIndex = 0;

  const panelEl = document.getElementById('panel');
  const editPaletteChk = document.getElementById('editPaletteChk');
  const resetPaletteBtn = document.getElementById('resetPaletteBtn');
  editPaletteChk.addEventListener('change', () => panelEl.classList.toggle('editing', editPaletteChk.checked));
  resetPaletteBtn.addEventListener('click', () => {
    paletteHex = defaultPaletteHex.slice();
    savePalette(paletteHex);
    rebuildSwatches();
    rebuildMesh(); // propagate new colors immediately
  });
  function hexToRgb01(hex) {
    const h = hex.startsWith('#') ? hex.slice(1) : hex;
    return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255];
  }
  function loadPalette() {
    try {
      const raw = localStorage.getItem(PALETTE_KEY);
      if (!raw) return null;
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.length === 16 && arr.every(x => typeof x === 'string' && /^#[0-9a-fA-F]{6}$/.test(x))) return arr;
      return null;
    } catch (e) { return null; }
  }
  function savePalette(arr) { try { localStorage.setItem(PALETTE_KEY, JSON.stringify(arr)); } catch (e) { } }

  const swatchesEl = document.getElementById('swatches');
  function rebuildSwatches() {
    swatchesEl.innerHTML = '';
    for (let i = 0; i < paletteHex.length; i++) {
      const wrap = document.createElement('div'); wrap.className = 'swatch-wrap';
      const sw = document.createElement('div');
      sw.className = 'swatch' + (i === selectedIndex ? ' selected' : '');
      sw.style.background = paletteHex[i];
      sw.title = `#${paletteHex[i].slice(1).toUpperCase()} (${i})`;
      const picker = document.createElement('input');
      picker.className = 'picker'; picker.type = 'color'; picker.value = paletteHex[i];

      sw.addEventListener('click', () => {
        if (!editPaletteChk.checked) { selectedIndex = i; rebuildSelectionHighlights(); }
      });
      picker.addEventListener('input', () => {
        const hx = picker.value;
        paletteHex[i] = hx;
        savePalette(paletteHex);
        sw.style.background = hx;
        sw.title = `#${hx.slice(1).toUpperCase()} (${i})`;
        rebuildMesh(); // repaint all faces using this index
      });

      wrap.appendChild(sw); wrap.appendChild(picker);
      swatchesEl.appendChild(wrap);
    }
  }
  function rebuildSelectionHighlights() {
    const nodes = swatchesEl.querySelectorAll('.swatch');
    nodes.forEach((node, idx) => node.classList.toggle('selected', idx === selectedIndex));
  }
  rebuildSwatches();

  // ===== Mesh build & export buffers =====
  let vertexCount = 0, faceCount = 0;
  let meshPositions = new Float32Array(0);
  let meshColors = new Float32Array(0);

  function faceCornersCCW(x0, y0, z0, x1, y1, z1, f) {
    switch (f) {
      case FACE.PX: return [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]];
      case FACE.NX: return [[x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [x0, y0, z0]];
      case FACE.PY: return [[x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0]];
      case FACE.NY: return [[x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [x0, y0, z0]];
      case FACE.PZ: return [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
      case FACE.NZ: return [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]];
    }
  }
  function addFaceCCW(x0, y0, z0, x1, y1, z1, f, col, P, C) {
    const c = faceCornersCCW(x0, y0, z0, x1, y1, z1, f);
    P.push(...c[0], ...c[1], ...c[2], ...c[0], ...c[2], ...c[3]);
    for (let i = 0; i < 6; i++) C.push(col[0], col[1], col[2]);
  }
  function colorFromOverrideOrChecker(x, y, z, f) {
    const idx = getFaceOverrideIdx(x, y, z, f);
    if (idx == null) return checkerColor(f, x, y, z);
    return hexToRgb01(paletteHex[idx]);
  }
  function rebuildMesh() {
    const P = [], C = []; faceCount = 0;
    for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (vox[I(x, y, z)] === 0) continue;
      const x0 = BMIN + x * SIZE, x1 = x0 + SIZE;
      const y0 = BMIN + y * SIZE, y1 = y0 + SIZE;
      const z0 = BMIN + z * SIZE, z1 = z0 + SIZE;
      const nPX = (x + 1 < N) ? vox[I(x + 1, y, z)] : 0;
      const nNX = (x - 1 >= 0) ? vox[I(x - 1, y, z)] : 0;
      const nPY = (y + 1 < N) ? vox[I(x, y + 1, z)] : 0;
      const nNY = (y - 1 >= 0) ? vox[I(x, y - 1, z)] : 0;
      const nPZ = (z + 1 < N) ? vox[I(x, y, z + 1)] : 0;
      const nNZ = (z - 1 >= 0) ? vox[I(x, y, z - 1)] : 0;
      if (!nPX) { addFaceCCW(x0, y0, z0, x1, y1, z1, FACE.PX, colorFromOverrideOrChecker(x, y, z, FACE.PX), P, C); faceCount++; }
      if (!nNX) { addFaceCCW(x0, y0, z0, x1, y1, z1, FACE.NX, colorFromOverrideOrChecker(x, y, z, FACE.NX), P, C); faceCount++; }
      if (!nPY) { addFaceCCW(x0, y0, z0, x1, y1, z1, FACE.PY, colorFromOverrideOrChecker(x, y, z, FACE.PY), P, C); faceCount++; }
      if (!nNY) { addFaceCCW(x0, y0, z0, x1, y1, z1, FACE.NY, colorFromOverrideOrChecker(x, y, z, FACE.NY), P, C); faceCount++; }
      if (!nPZ) { addFaceCCW(x0, y0, z0, x1, y1, z1, FACE.PZ, colorFromOverrideOrChecker(x, y, z, FACE.PZ), P, C); faceCount++; }
      if (!nNZ) { addFaceCCW(x0, y0, z0, x1, y1, z1, FACE.NZ, colorFromOverrideOrChecker(x, y, z, FACE.NZ), P, C); faceCount++; }
    }
    const posArr = new Float32Array(P);
    const colArr = new Float32Array(C);
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.bufferData(gl.ARRAY_BUFFER, posArr, gl.STATIC_DRAW);
    gl.vertexAttribPointer(a_pos, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, colBuf);
    gl.bufferData(gl.ARRAY_BUFFER, colArr, gl.STATIC_DRAW);
    gl.vertexAttribPointer(a_col, 3, gl.FLOAT, false, 0, 0);
    vertexCount = posArr.length / 3;
    meshPositions = posArr; meshColors = colArr;
    document.getElementById('verts').textContent = vertexCount.toLocaleString();
    document.getElementById('faces').textContent = faceCount.toLocaleString();
    document.getElementById('tris').textContent = (faceCount * 2).toLocaleString();
  }
  rebuildMesh();

  // ===== Undo/Redo & UI =====
  const undoStack = [];
  const redoStack = [];
  const undoBtn = document.getElementById('undoBtn');
  const redoBtn = document.getElementById('redoBtn');
  const stackInfo = document.getElementById('stackInfo');
  undoBtn.addEventListener('click', undoAction);
  redoBtn.addEventListener('click', redoAction);
  function pushAction(act) { undoStack.push(act); redoStack.length = 0; updateStacksUI(); }
  function updateStacksUI() {
    undoBtn.disabled = undoStack.length === 0;
    redoBtn.disabled = redoStack.length === 0;
    stackInfo.textContent = `${undoStack.length} / ${redoStack.length}`;
  }
  function applyAction(act, forward) {
    switch (act.type) {
      case 'paint': {
        const idx = forward ? act.nextIdx : act.prevIdx;
        setFaceOverrideIdx(act.x, act.y, act.z, act.f, idx);
        break;
      }
      case 'add':
      case 'remove': {
        const occ = forward ? act.nextOcc : act.prevOcc;
        vox[I(act.x, act.y, act.z)] = occ;
        const overrides = forward ? act.nextOverridesIdx : act.prevOverridesIdx;
        applyOverridesIdx(act.x, act.y, act.z, overrides);
        break;
      }
      case 'carveRow': {
        const cells = act.cells;
        for (const c of cells) {
          const occ = forward ? c.nextOcc : c.prevOcc;
          vox[I(c.x, c.y, c.z)] = occ;
          const overrides = forward ? c.nextOverridesIdx : c.prevOverridesIdx;
          applyOverridesIdx(c.x, c.y, c.z, overrides);
        }
        break;
      }
    }
  }
  function undoAction() {
    if (undoStack.length === 0) return;
    const act = undoStack.pop();
    applyAction(act, false);
    redoStack.push(act);
    rebuildMesh(); refreshHover(); updateStacksUI();
  }
  function redoAction() {
    if (redoStack.length === 0) return;
    const act = redoStack.pop();
    applyAction(act, true);
    undoStack.push(act);
    rebuildMesh(); refreshHover(); updateStacksUI();
  }
  updateStacksUI();

  // ===== Picking & Hover =====
  function buildRay(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const px = (clientX - rect.left) * dpr;
    const py = (clientY - rect.top) * dpr;
    const ndcX = (2 * px / canvas.width) - 1;
    const ndcY = 1 - (2 * py / canvas.height);
    const eye = eyeFromSpherical(radius, theta, phi);
    const center = [0, 0, 0], upWorld = [0, 1, 0];
    const forward = vNorm(vSub(center, eye));
    const right = vNorm(vCross(forward, upWorld));
    const upCam = vCross(right, forward);
    const fov = 45 * Math.PI / 180, aspect = canvas.width / canvas.height;
    const tanHalf = Math.tan(fov / 2);
    const rx = ndcX * tanHalf * aspect, ry = ndcY * tanHalf;
    const dir = vNorm([
      forward[0] + rx * right[0] + ry * upCam[0],
      forward[1] + rx * right[1] + ry * upCam[1],
      forward[2] + rx * right[2] + ry * upCam[2],
    ]);
    return { eye, dir };
  }
  function rayAABB(origin, dir, minB, maxB) {
    let tmin = -Infinity, tmax = +Infinity;
    let entryAxis = -1, entrySign = 0;
    function axisInter(o, d, min, max, axis) {
      if (d === 0) { if (o < min || o > max) return false; return true; }
      const t1 = (min - o) / d, t2 = (max - o) / d;
      const enter = Math.min(t1, t2), exit = Math.max(t1, t2);
      if (enter > tmin) { tmin = enter; entryAxis = axis; entrySign = (t1 < t2) ? -1 : +1; }
      tmax = Math.min(tmax, exit);
      return true;
    }
    if (!axisInter(origin[0], dir[0], BMIN, BMAX, 0)) return null;
    if (!axisInter(origin[1], dir[1], BMIN, BMAX, 1)) return null;
    if (!axisInter(origin[2], dir[2], BMIN, BMAX, 2)) return null;
    if (tmax < tmin || tmax < 0) return null;
    return { tEnter: Math.max(tmin, 0), tExit: tmax, entryAxis, entrySign };
  }
  function entryAxisSignToFace(axis, sign) {
    if (axis === 0) return (sign < 0 ? FACE.NX : FACE.PX);
    if (axis === 1) return (sign < 0 ? FACE.NY : FACE.PY);
    if (axis === 2) return (sign < 0 ? FACE.NZ : FACE.PZ);
    return FACE.PZ;
  }
  function traverseGrid(eye, dir, tEnter, tExit, entryAxis, entrySign) {
    const p = [eye[0] + tEnter * dir[0], eye[1] + tEnter * dir[1], eye[2] + tEnter * dir[2]];
    const toGrid = w => ((w - BMIN) / (BMAX - BMIN)) * N;
    let gx = Math.min(Math.max(toGrid(p[0]), 1e-6), N - 1e-6);
    let gy = Math.min(Math.max(toGrid(p[1]), 1e-6), N - 1e-6);
    let gz = Math.min(Math.max(toGrid(p[2]), 1e-6), N - 1e-6);
    let i = Math.floor(gx), j = Math.floor(gy), k = Math.floor(gz);
    const stepX = dir[0] > 0 ? +1 : -1;
    const stepY = dir[1] > 0 ? +1 : -1;
    const stepZ = dir[2] > 0 ? +1 : -1;
    const boundaryX = (stepX > 0 ? (i + 1) : i) * SIZE + BMIN;
    const boundaryY = (stepY > 0 ? (j + 1) : j) * SIZE + BMIN;
    const boundaryZ = (stepZ > 0 ? (k + 1) : k) * SIZE + BMIN;
    let tMaxX = (dir[0] !== 0) ? (boundaryX - p[0]) / dir[0] : Infinity;
    let tMaxY = (dir[1] !== 0) ? (boundaryY - p[1]) / dir[1] : Infinity;
    let tMaxZ = (dir[2] !== 0) ? (boundaryZ - p[2]) / dir[2] : Infinity;
    const tDeltaX = (dir[0] !== 0) ? SIZE / Math.abs(dir[0]) : Infinity;
    const tDeltaY = (dir[1] !== 0) ? SIZE / Math.abs(dir[1]) : Infinity;
    const tDeltaZ = (dir[2] !== 0) ? SIZE / Math.abs(dir[2]) : Infinity;
    let lastAxis = entryAxis, lastSign = entrySign, t = tEnter;
    while (t <= tExit + 1e-7) {
      if (i >= 0 && i < N && j >= 0 && j < N && k >= 0 && k < N && vox[I(i, j, k)]) {
        const faceIndex = entryAxisSignToFace(lastAxis, lastSign);
        return { i, j, k, faceIndex };
      }
      if (tMaxX < tMaxY && tMaxX < tMaxZ) { t = tMaxX; tMaxX += tDeltaX; lastAxis = 0; lastSign = (stepX > 0 ? -1 : +1); i += stepX; }
      else if (tMaxY < tMaxZ) { t = tMaxY; tMaxY += tDeltaY; lastAxis = 1; lastSign = (stepY > 0 ? -1 : +1); j += stepY; }
      else { t = tMaxZ; tMaxZ += tDeltaZ; lastAxis = 2; lastSign = (stepZ > 0 ? -1 : +1); k += stepZ; }
      if (i < 0 || i >= N || j < 0 || j >= N || k < 0 || k >= N) return null;
    }
    return null;
  }

  // Hover previews (voxel wire, face outline, row wire)
  const wfPosBuf = gl.createBuffer();
  const wfColBuf = gl.createBuffer();
  let wfVerts = 0;

  const foPosBuf = gl.createBuffer();
  const foColBuf = gl.createBuffer();
  let foVerts = 0;

  const rwfPosBuf = gl.createBuffer();
  const rwfColBuf = gl.createBuffer();
  let rwfVerts = 0;

  function buildWireframeForVoxel(i, j, k, colorRGB = [1, 1, 1]) {
    const x0 = BMIN + i * SIZE, x1 = x0 + SIZE;
    const y0 = BMIN + j * SIZE, y1 = y0 + SIZE;
    const z0 = BMIN + k * SIZE, z1 = z0 + SIZE;
    const P = new Float32Array([
      x0, y0, z0, x1, y0, z0, x1, y0, z0, x1, y0, z1,
      x1, y0, z1, x0, y0, z1, x0, y0, z1, x0, y0, z0,
      x0, y1, z0, x1, y1, z0, x1, y1, z0, x1, y1, z1,
      x1, y1, z1, x0, y1, z1, x0, y1, z1, x0, y1, z0,
      x0, y0, z0, x0, y1, z0, x1, y0, z0, x1, y1, z0,
      x1, y0, z1, x1, y1, z1, x0, y0, z1, x0, y1, z1,
    ]);
    const C = new Float32Array(P.length);
    for (let v = 0; v < C.length; v += 3) { C[v] = colorRGB[0]; C[v + 1] = colorRGB[1]; C[v + 2] = colorRGB[2]; }
    gl.bindBuffer(gl.ARRAY_BUFFER, wfPosBuf); gl.bufferData(gl.ARRAY_BUFFER, P, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, wfColBuf); gl.bufferData(gl.ARRAY_BUFFER, C, gl.STATIC_DRAW);
    wfVerts = P.length / 3;
  }

  function buildFaceOutline(i, j, k, faceIndex, colorRGB = [1, 1, 0]) {
    const x0 = BMIN + i * SIZE, x1 = x0 + SIZE;
    const y0 = BMIN + j * SIZE, y1 = y0 + SIZE;
    const z0 = BMIN + k * SIZE, z1 = z0 + SIZE;
    const corners = faceCornersCCW(x0, y0, z0, x1, y1, z1, faceIndex);
    const P = new Float32Array([
      ...corners[0], ...corners[1],
      ...corners[1], ...corners[2],
      ...corners[2], ...corners[3],
      ...corners[3], ...corners[0],
    ]);
    const C = new Float32Array(P.length);
    for (let v = 0; v < C.length; v += 3) { C[v] = colorRGB[0]; C[v + 1] = colorRGB[1]; C[v + 2] = colorRGB[2]; }
    gl.bindBuffer(gl.ARRAY_BUFFER, foPosBuf); gl.bufferData(gl.ARRAY_BUFFER, P, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, foColBuf); gl.bufferData(gl.ARRAY_BUFFER, C, gl.STATIC_DRAW);
    foVerts = P.length / 3;
  }

  function buildRowWireframe(axis, baseI, baseJ, baseK, colorRGB = [1.0, 0.5, 0.25]) {
    const segments = []; // accumulate line segments for all occupied voxels
    for (let t = 0; t < N; t++) {
      let x = baseI, y = baseJ, z = baseK;
      if (axis === 'X') x = t;
      else if (axis === 'Y') y = t;
      else if (axis === 'Z') z = t;
      if (!inB(x, y, z)) continue;
      if (vox[I(x, y, z)] !== 1) continue;
      const x0 = BMIN + x * SIZE, x1 = x0 + SIZE;
      const y0 = BMIN + y * SIZE, y1 = y0 + SIZE;
      const z0 = BMIN + z * SIZE, z1 = z0 + SIZE;
      // 12 edges -> 24 positions
      segments.push(
        x0, y0, z0, x1, y0, z0,
        x1, y0, z0, x1, y0, z1,
        x1, y0, z1, x0, y0, z1,
        x0, y0, z1, x0, y0, z0,

        x0, y1, z0, x1, y1, z0,
        x1, y1, z0, x1, y1, z1,
        x1, y1, z1, x0, y1, z1,
        x0, y1, z1, x0, y1, z0,

        x0, y0, z0, x0, y1, z0,
        x1, y0, z0, x1, y1, z0,
        x1, y0, z1, x1, y1, z1,
        x0, y0, z1, x0, y1, z1
      );
    }
    if (segments.length === 0) {
      rwfVerts = 0;
      return;
    }
    const P = new Float32Array(segments);
    const C = new Float32Array(P.length);
    for (let v = 0; v < C.length; v += 3) { C[v] = colorRGB[0]; C[v + 1] = colorRGB[1]; C[v + 2] = colorRGB[2]; }
    gl.bindBuffer(gl.ARRAY_BUFFER, rwfPosBuf); gl.bufferData(gl.ARRAY_BUFFER, P, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, rwfColBuf); gl.bufferData(gl.ARRAY_BUFFER, C, gl.STATIC_DRAW);
    rwfVerts = P.length / 3;
  }

  function updateHover(clientX, clientY) {
    const { eye, dir } = buildRay(clientX, clientY);
    const hit = rayAABB(eye, dir, BMIN, BMAX);
    wfVerts = 0;
    foVerts = 0;
    rwfVerts = 0;
    if (!hit) return;
    const { tEnter, tExit, entryAxis, entrySign } = hit;
    const res = traverseGrid(eye, dir, tEnter, tExit, entryAxis, entrySign);
    if (!res) return;

    if (mode === 'carve-row') {
      let axis = null;
      if (res.faceIndex == 0 || res.faceIndex == 1) axis = 'X';
      else if (res.faceIndex == 2 || res.faceIndex == 3) axis = 'Y';
      else if (res.faceIndex == 4 || res.faceIndex == 5) axis = 'Z';
      if (!axis) return;
      buildRowWireframe(axis, res.i, res.j, res.k, [1,1,1]);
      return;
    }
    if (mode === 'paint') {
      buildFaceOutline(res.i, res.j, res.k, res.faceIndex, [1,1,1]);
      return;
    }
    if (mode === 'add') {
      const d = faceDelta(res.faceIndex);
      const nx = res.i + d[0], ny = res.j + d[1], nz = res.k + d[2];
      if (inB(nx, ny, nz) && vox[I(nx, ny, nz)] === 0) {
        buildWireframeForVoxel(nx, ny, nz, [1,1,1]);
      }
      return;
    }
    if (mode === 'carve') {
      buildWireframeForVoxel(res.i, res.j, res.k, [1, 1, 1]);
    }
  }
  function refreshHover() {
    if (lastMouseX != null) updateHover(lastMouseX, lastMouseY);
  }

  // ===== Actions handlers =====
  function removeVoxelAt(clientX, clientY) {
    const res = pickCell(clientX, clientY); if (!res) return;
    const { i, j, k } = res; if (!vox[I(i, j, k)]) return;
    const prevOverridesIdx = snapshotOverridesIdx(i, j, k);
    const nextOverridesIdx = [null, null, null, null, null, null];
    vox[I(i, j, k)] = 0; applyOverridesIdx(i, j, k, nextOverridesIdx);
    pushAction({ type: 'remove', x: i, y: j, z: k, prevOcc: 1, nextOcc: 0, prevOverridesIdx, nextOverridesIdx });
    rebuildMesh(); refreshHover();
  }
  function addVoxelAt(clientX, clientY) {
    const res = pickCell(clientX, clientY); if (!res) return;
    const d = faceDelta(res.faceIndex);
    const nx = res.i + d[0], ny = res.j + d[1], nz = res.k + d[2];
    if (!inB(nx, ny, nz) || vox[I(nx, ny, nz)] !== 0) return;
    const prevOverridesIdx = snapshotOverridesIdx(nx, ny, nz);
    const nextOverridesIdx = [null, null, null, null, null, null];
    vox[I(nx, ny, nz)] = 1; applyOverridesIdx(nx, ny, nz, nextOverridesIdx);
    pushAction({ type: 'add', x: nx, y: ny, z: nz, prevOcc: 0, nextOcc: 1, prevOverridesIdx, nextOverridesIdx });
    rebuildMesh(); refreshHover();
  }
  function paintFaceAt(clientX, clientY) {
    const res = pickCell(clientX, clientY); if (!res) return;
    const { i, j, k, faceIndex } = res;
    const prevIdx = getFaceOverrideIdx(i, j, k, faceIndex);
    const nextIdx = selectedIndex;
    if (prevIdx === nextIdx) return; // no change
    setFaceOverrideIdx(i, j, k, faceIndex, nextIdx);
    pushAction({ type: 'paint', x: i, y: j, z: k, f: faceIndex, prevIdx, nextIdx });
    rebuildMesh(); refreshHover();
  }
  function carveRowAt(clientX, clientY) {
    const res = pickCell(clientX, clientY); if (!res) return;

      let axis = null;//getSelectedCarveAxis(); // 'X'|'Y'|'Z'
      // console.log('build row wireframe', axis, res.i, res.j, res.k, res.faceIndex);
      if (res.faceIndex == 0 || res.faceIndex == 1) axis = 'X';
      else if (res.faceIndex == 2 || res.faceIndex == 3) axis = 'Y';
      else if (res.faceIndex == 4 || res.faceIndex == 5) axis = 'Z';

      const cells = [];
    for (let t = 0; t < N; t++) {
      let x = res.i, y = res.j, z = res.k;
      if (axis === 'X') x = t;
      else if (axis === 'Y') y = t;
      else if (axis === 'Z') z = t;
      if (!inB(x, y, z)) continue;
      if (vox[I(x, y, z)] !== 1) continue; // only record occupied voxels
      const prevOverridesIdx = snapshotOverridesIdx(x, y, z);
      const nextOverridesIdx = [null, null, null, null, null, null];
      // Apply carve removal
      vox[I(x, y, z)] = 0;
      applyOverridesIdx(x, y, z, nextOverridesIdx);
      cells.push({
        x, y, z,
        prevOcc: 1, nextOcc: 0,
        prevOverridesIdx, nextOverridesIdx
      });
    }
    if (cells.length === 0) return;
    pushAction({ type: 'carveRow', axis, cells });
    rebuildMesh(); refreshHover();
  }
  function pickCell(clientX, clientY) {
    const { eye, dir } = buildRay(clientX, clientY);
    const hit = rayAABB(eye, dir, BMIN, BMAX);
    if (!hit) return null;
    const { tEnter, tExit, entryAxis, entrySign } = hit;
    return traverseGrid(eye, dir, tEnter, tExit, entryAxis, entrySign);
  }
  function faceDelta(faceIndex) {
    switch (faceIndex) {
      case FACE.PX: return [+1, 0, 0];
      case FACE.NX: return [-1, 0, 0];
      case FACE.PY: return [0, +1, 0];
      case FACE.NY: return [0, -1, 0];
      case FACE.PZ: return [0, 0, +1];
      case FACE.NZ: return [0, 0, -1];
      default: return [0, 0, 0];
    }
  }

  // ===== Save/Load JSON (version 2) =====
  const saveBtn = document.getElementById('saveBtn');
  const loadBtn = document.getElementById('loadBtn');
  const fileInput = document.getElementById('fileInput');
  saveBtn.addEventListener('click', saveSceneJSON);
  loadBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) readSceneFile(file);
    fileInput.value = '';
  });
  canvas.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
  canvas.addEventListener('drop', (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      readSceneFile(e.dataTransfer.files[0]);
    }
  });

  function sceneToObject() {
    const overridesList = [];
    for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) for (let z = 0; z < N; z++) {
      const faces = faceOverrideIdx[x][y][z];
      let any = false; for (let f = 0; f < 6; f++) { if (faces[f] != null) { any = true; break; } }
      if (any) overridesList.push({ x, y, z, faces: faces.map(v => (v == null ? null : v | 0)) });
    }
    return {
      version: 2,
      gridSize: N,
      createdAt: new Date().toISOString(),
      voxels: Array.from(vox),
      palette: paletteHex.slice(),
      overridesIdx: overridesList
    };
  }
  function saveSceneJSON() {
    const obj = sceneToObject();
    const json = JSON.stringify(obj);
    downloadBlob(json, makeSceneFilename('.json'), 'application/json');
  }
  function readSceneFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try { const obj = JSON.parse(reader.result); loadSceneObject(obj); }
      catch (err) { console.error(err); alert('Invalid JSON file.'); }
    };
    reader.onerror = () => { alert('Failed to read file.'); };
    reader.readAsText(file);
  }
  function loadSceneObject(obj) {
    if (!obj || typeof obj !== 'object') { alert('Invalid scene file.'); return; }
    if (obj.gridSize !== N) { alert(`Grid size mismatch. File: ${obj.gridSize}, Editor: ${N}.`); return; }
    if (!Array.isArray(obj.voxels) || obj.voxels.length !== N * N * N) { alert('Invalid voxels array length.'); return; }
    if (obj.version !== 2) {
      alert(`Unsupported scene version (${obj.version}). This build expects version 2 with palette-index overrides.`);
      return;
    }
    if (!Array.isArray(obj.overridesIdx)) { alert('Invalid overridesIdx list.'); return; }
    if (!Array.isArray(obj.palette) || obj.palette.length !== 16) { alert('Missing or invalid palette in file.'); return; }

    for (let i = 0; i < obj.voxels.length; i++) { vox[i] = (obj.voxels[i] === 1) ? 1 : 0; }
    paletteHex = obj.palette.slice(); savePalette(paletteHex); rebuildSwatches();

    for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) for (let z = 0; z < N; z++) {
      faceOverrideIdx[x][y][z] = [null, null, null, null, null, null];
    }
    for (const entry of obj.overridesIdx) {
      const { x, y, z, faces } = entry || {};
      if (!inB(x, y, z) || !Array.isArray(faces) || faces.length !== 6) continue;
      for (let f = 0; f < 6; f++) {
        const v = faces[f];
        setFaceOverrideIdx(x, y, z, f, (v == null ? null : (v | 0)));
      }
    }
    undoStack.length = 0; redoStack.length = 0; updateStacksUI();
    rebuildMesh(); refreshHover();
  }

  // ===== OBJ Export =====
  const saveObjBtn = document.getElementById('saveObjBtn');
  const saveObjMtlBtn = document.getElementById('saveObjMtlBtn');
  saveObjBtn.addEventListener('click', exportOBJGeometryOnly);
  saveObjMtlBtn.addEventListener('click', exportOBJWithMTL);

  function exportOBJGeometryOnly() {
    if (!meshPositions || meshPositions.length === 0) { alert('No geometry to export.'); return; }
    const lines = [];
    lines.push(`# Voxel editor export`);
    lines.push(`# vertices: ${meshPositions.length / 3}`);
    lines.push(`# triangles: ${meshPositions.length / 9}`);
    lines.push(`o voxel_mesh`);
    lines.push(`s off`);
    for (let i = 0; i < meshPositions.length; i += 3) {
      lines.push(`v ${fmt(meshPositions[i])} ${fmt(meshPositions[i + 1])} ${fmt(meshPositions[i + 2])}`);
    }
    const numTriangles = meshPositions.length / 9;
    for (let t = 0; t < numTriangles; t++) {
      const a = t * 3 + 1, b = t * 3 + 2, c = t * 3 + 3;
      lines.push(`f ${a} ${b} ${c}`);
    }
    downloadBlob(lines.join('\n') + '\n', makeSceneFilename('.obj'), 'text/plain');
  }
  function exportOBJWithMTL() {
    if (!meshPositions || meshPositions.length === 0) { alert('No geometry to export.'); return; }
    const baseName = makeSceneBaseName();
    const objName = `${baseName}.obj`;
    const mtlName = `${baseName}.mtl`;
    const colorToMtl = new Map();
    const mtlLines = [];
    function colorKey(r, g, b) { const rr = Math.round(r * 1000) / 1000, gg = Math.round(g * 1000) / 1000, bb = Math.round(b * 1000) / 1000; return `${rr},${gg},${bb}`; }
    function ensureMaterial(r, g, b) {
      const key = colorKey(r, g, b);
      if (colorToMtl.has(key)) return colorToMtl.get(key);
      const name = `mat_${Math.round(r * 255)}_${Math.round(g * 255)}_${Math.round(b * 255)}`;
      colorToMtl.set(key, name);
      mtlLines.push(`newmtl ${name}`, `Ka 0 0 0`, `Kd ${fmt(r)} ${fmt(g)} ${fmt(b)}`, `Ks 0 0 0`, `d 1`, `illum 1`, '');
      return name;
    }
    const objLines = [];
    objLines.push(`# Voxel editor export with MTL`);
    objLines.push(`# vertices: ${meshPositions.length / 3}`);
    objLines.push(`# triangles: ${meshPositions.length / 9}`);
    objLines.push(`mtllib ${mtlName}`);
    objLines.push(`o voxel_mesh`);
    objLines.push(`s off`);
    for (let i = 0; i < meshPositions.length; i += 3) {
      objLines.push(`v ${fmt(meshPositions[i])} ${fmt(meshPositions[i + 1])} ${fmt(meshPositions[i + 2])}`);
    }
    const numTriangles = meshPositions.length / 9;
    let currentMtl = null;
    for (let t = 0; t < numTriangles; t++) {
      const ci = t * 9;
      const r = meshColors[ci + 0], g = meshColors[ci + 1], b = meshColors[ci + 2];
      const mtl = ensureMaterial(r, g, b);
      if (mtl !== currentMtl) { objLines.push(`usemtl ${mtl}`); currentMtl = mtl; }
      const a = t * 3 + 1, bIdx = t * 3 + 2, c = t * 3 + 3;
      objLines.push(`f ${a} ${bIdx} ${c}`);
    }
    downloadBlob(objLines.join('\n') + '\n', objName, 'text/plain');
    setTimeout(() => downloadBlob(mtlLines.join('\n') + '\n', mtlName, 'text/plain'), 50);
  }

  // ===== Helpers =====
  function fmt(n) { return (Math.abs(n) < 1e-9) ? '0' : Number(n).toFixed(6).replace(/\.?0+$/, ''); }
  function makeSceneBaseName() {
    const pad2 = (n) => String(n).padStart(2, '0');
    const d = new Date();
    return `voxel_scene_${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}_${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`;
  }
  function makeSceneFilename(ext = '.json') { return `${makeSceneBaseName()}${ext}`; }
  function downloadBlob(text, filename, mime) {
    const blob = new Blob([text], { type: mime || 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 0);
  }

  // ===== Render =====
  function render() {
    resize();
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const aspect = canvas.width / canvas.height;
    const proj = mat4Perspective(45 * Math.PI / 180, aspect, 0.1, 100.0);
    const eye = eyeFromSpherical(radius, theta, phi);
    const view = lookAt(eye, [0, 0, 0], [0, 1, 0]);
    const mvp = mat4Multiply(proj, view);
    gl.uniformMatrix4fv(u_mvp, false, mvp);

    // Solid mesh
    if (vertexCount > 0) {
      gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
      gl.vertexAttribPointer(a_pos, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, colBuf);
      gl.vertexAttribPointer(a_col, 3, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLES, 0, vertexCount);
    }
    // Face outline (paint preview)
    if (foVerts > 0) {
      gl.bindBuffer(gl.ARRAY_BUFFER, foPosBuf);
      gl.vertexAttribPointer(a_pos, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, foColBuf);
      gl.vertexAttribPointer(a_col, 3, gl.FLOAT, false, 0, 0);
      gl.lineWidth(1);
      gl.drawArrays(gl.LINES, 0, foVerts);
    }
    // Row wireframe (carve preview)
    if (rwfVerts > 0) {
      gl.bindBuffer(gl.ARRAY_BUFFER, rwfPosBuf);
      gl.vertexAttribPointer(a_pos, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, rwfColBuf);
      gl.vertexAttribPointer(a_col, 3, gl.FLOAT, false, 0, 0);
      gl.lineWidth(1);
      gl.drawArrays(gl.LINES, 0, rwfVerts);
    }
    // Voxel wireframe (remove/add preview)
    if (wfVerts > 0) {
      gl.bindBuffer(gl.ARRAY_BUFFER, wfPosBuf);
      gl.vertexAttribPointer(a_pos, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, wfColBuf);
      gl.vertexAttribPointer(a_col, 3, gl.FLOAT, false, 0, 0);
      gl.lineWidth(1);
      gl.drawArrays(gl.LINES, 0, wfVerts);
    }

    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);

})();
