import './style.css'
import { Mat4, Vec3 } from './math.js';
import { OrbitCamera } from './3d.js';
import { createProgram } from './webgl.js';

/*** ======= Minimal Math & Camera ======= ***/

/*** ======= WebGL Helpers ======= ***/

/*** ======= Shaders ======= ***/
// Render (Lambert) using palette (material IDs)
const RENDER_VS = `#version 300 es
precision mediump float;
in vec3 aPosition;
in vec3 aNormal;
in uint aMatId;
uniform mat4 uModel, uView, uProj;
uniform mat3 uNormalMat;
out vec3 vNormalWS;
flat out uint vMatId;
void main(){
  vec4 worldPos = uModel * vec4(aPosition, 1.0);
  vNormalWS = normalize(uNormalMat * aNormal);
  vMatId = aMatId;
  gl_Position = uProj * uView * worldPos;
}`;
const RENDER_FS = `#version 300 es
precision mediump float;
in vec3 vNormalWS;
flat in uint vMatId;
uniform vec3 uPalette[16];
uniform vec3 uLightDirWS;
uniform float uAmbient;
out vec4 fragColor;
void main(){
  vec3 base = uPalette[int(vMatId)];
  float NdotL = max(dot(normalize(vNormalWS), normalize(-uLightDirWS)), 0.0);
  float lambert = uAmbient + (1.0 - uAmbient) * NdotL;
  vec3 rgb = pow(base * lambert, vec3(1.0/1.8));
  fragColor = vec4(rgb, 1.0);
}`;
// Picking (voxel + face packed into RGB)
const PICK_VS = `#version 300 es
precision mediump float;
in vec3 aPosition;
in uint aPacked; // ((voxelIdx+1)<<3) | faceId
uniform mat4 uModel, uView, uProj;
flat out uint vPacked;
void main(){
  vPacked = aPacked;
  gl_Position = uProj * uView * uModel * vec4(aPosition, 1.0);
}`;
const PICK_FS = `#version 300 es
precision mediump float;
flat in uint vPacked;
out vec4 fragColor;
void main(){
  uint r=(vPacked)&255u, g=(vPacked>>8)&255u, b=(vPacked>>16)&255u;
  fragColor=vec4(vec3(float(r),float(g),float(b))/255.0,1.0);
}`;
// Wireframe (non-uniform scale for AABB outlines)
const WIREFRAME_VS = `#version 300 es
precision mediump float;
in vec3 aPosition;
uniform mat4 uModel, uView, uProj;
uniform vec3 uOffset;     // world center of box
uniform vec3 uScaleVec;   // world size (sx, sy, sz)
uniform float uInflate;
void main(){
  vec3 p = (aPosition * uInflate) * uScaleVec + uOffset;
  gl_Position = uProj * uView * uModel * vec4(p, 1.0);
}`;
const WIREFRAME_FS = `#version 300 es
precision mediump float;
uniform vec3 uColor;
out vec4 fragColor;
void main(){ fragColor = vec4(uColor, 1.0); }`;

/*** ======= Wireframe Edge Mesh ======= ***/
function makeCubeEdges() {
  const P = new Float32Array([
    -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, -0.5, -0.5, 0.5, -0.5,
    -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5, 0.5
  ]);
  const I = new Uint16Array([0, 1, 1, 2, 2, 3, 3, 0, 4, 5, 5, 6, 6, 7, 7, 4, 0, 4, 1, 5, 2, 6, 3, 7]);
  return { positions: P, indices: I, count: I.length };
}

/*** ======= Utilities ======= ***/
const hexToRgbF = (hex) => {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return m ? [parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255] : [1, 1, 1];
};
const decToHex = (x) => ('0' + Math.round(x * 255).toString(16)).slice(-2);
const rgbToHexF = (r, g, b) => {
  return '#' + decToHex(r) + decToHex(g) + decToHex(b);
};

/*** ======= App ======= ***/
(function main() {
  const canvas = document.getElementById('gl');
  /** @type {WebGL2RenderingContext} */
  const gl = canvas.getContext('webgl2', { antialias: true, alpha: false });
  if (!gl) { alert('WebGL2 not supported'); return; }
  gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK);

  // Programs
  const renderProg = createProgram(gl, RENDER_VS, RENDER_FS);
  const pickProg = createProgram(gl, PICK_VS, PICK_FS);
  const wireProg = createProgram(gl, WIREFRAME_VS, WIREFRAME_FS);

  // Locations
  const rLoc = {
    aPosition: gl.getAttribLocation(renderProg, 'aPosition'), aNormal: gl.getAttribLocation(renderProg, 'aNormal'), aMatId: gl.getAttribLocation(renderProg, 'aMatId'),
    uModel: gl.getUniformLocation(renderProg, 'uModel'), uView: gl.getUniformLocation(renderProg, 'uView'), uProj: gl.getUniformLocation(renderProg, 'uProj'),
    uNormalMat: gl.getUniformLocation(renderProg, 'uNormalMat'), uLightDirWS: gl.getUniformLocation(renderProg, 'uLightDirWS'), uAmbient: gl.getUniformLocation(renderProg, 'uAmbient'),
    uPalette: gl.getUniformLocation(renderProg, 'uPalette[0]')
  };
  const pLoc = {
    aPosition: gl.getAttribLocation(pickProg, 'aPosition'), aPacked: gl.getAttribLocation(pickProg, 'aPacked'),
    uModel: gl.getUniformLocation(pickProg, 'uModel'), uView: gl.getUniformLocation(pickProg, 'uView'), uProj: gl.getUniformLocation(pickProg, 'uProj')
  };
  const wLoc = {
    aPosition: gl.getAttribLocation(wireProg, 'aPosition'),
    uModel: gl.getUniformLocation(wireProg, 'uModel'), uView: gl.getUniformLocation(wireProg, 'uView'), uProj: gl.getUniformLocation(wireProg, 'uProj'),
    uOffset: gl.getUniformLocation(wireProg, 'uOffset'), uScaleVec: gl.getUniformLocation(wireProg, 'uScaleVec'), uInflate: gl.getUniformLocation(wireProg, 'uInflate'),
    uColor: gl.getUniformLocation(wireProg, 'uColor')
  };

  // Buffers (render)
  let renderVAO = gl.createVertexArray();
  let renderPosBuf = gl.createBuffer();
  let renderNrmBuf = gl.createBuffer();
  let renderMatBuf = gl.createBuffer();
  let renderIdxBuf = gl.createBuffer();
  let renderIndexCount = 0;

  // Buffers (pick)
  let pickVAO = gl.createVertexArray();
  let pickPosBuf = gl.createBuffer();
  let pickPackedBuf = gl.createBuffer();
  let pickIdxBuf = gl.createBuffer();
  let pickIndexCount = 0;

  // Wireframe mesh
  const edges = makeCubeEdges();
  const edgeVAO = gl.createVertexArray();
  const edgePosBuf = gl.createBuffer();
  const edgeIdxBuf = gl.createBuffer();
  gl.bindVertexArray(edgeVAO);
  gl.bindBuffer(gl.ARRAY_BUFFER, edgePosBuf);
  gl.bufferData(gl.ARRAY_BUFFER, edges.positions, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(wLoc.aPosition);
  gl.vertexAttribPointer(wLoc.aPosition, 3, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, edgeIdxBuf);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, edges.indices, gl.STATIC_DRAW);
  gl.bindVertexArray(null);

  /*** ---- World State ---- ***/
  let N = 16, cell = 1 / N, half = 0.5;
  let isSolid = new Array(N * N * N).fill(true);
  let voxelMat = new Uint8Array(N * N * N);    // 0..15
  let palette = new Float32Array(16 * 3);

  const defaultHex = ['#e76f51', '#f4a261', '#e9c46a', '#2a9d8f', '#264653', '#a8dadc', '#457b9d', '#1d3557', '#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#b983ff', '#ff4d6d', '#9ef01a', '#00f5d4'];
  function setPaletteColor(i, rgb) { palette[i * 3 + 0] = rgb[0]; palette[i * 3 + 1] = rgb[1]; palette[i * 3 + 2] = rgb[2]; }
  for (let i = 0; i < 16; i++) { const [r, g, b] = hexToRgbF(defaultHex[i]); setPaletteColor(i, [r, g, b]); }

  const FACE_DIRS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  const FACE_INFO = [{ axis: 0, u: 2, v: 1 }, { axis: 0, u: 2, v: 1 }, { axis: 1, u: 0, v: 2 }, { axis: 1, u: 0, v: 2 }, { axis: 2, u: 0, v: 1 }, { axis: 2, u: 0, v: 1 }];
  const FACE_LABEL = ["+X", "-X", "+Y", "-Y", "+Z", "-Z"];
  const idx3 = (x, y, z) => x + N * (y + N * z);
  const within = (x, y, z) => x >= 0 && y >= 0 && z >= 0 && x < N && y < N && z < N;
  function coordsOf(id) { const z = Math.floor(id / (N * N)); const y = Math.floor((id - z * N * N) / N); const x = id - z * N * N - y * N; return [x, y, z]; }
  function centerOf(id) { const [x, y, z] = coordsOf(id); return new Float32Array([-half + cell * (x + 0.5), -half + cell * (y + 0.5), -half + cell * (z + 0.5)]); }
  function faceExposed(x, y, z, f) { const d = FACE_DIRS[f], here = isSolid[idx3(x, y, z)]; const nx = x + d[0], ny = y + d[1], nz = z + d[2]; const nb = within(nx, ny, nz) ? isSolid[idx3(nx, ny, nz)] : false; return here && !nb; }

  function seedMaterials(mode = "bands") {
    for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      voxelMat[idx3(x, y, z)] = mode === "random" ? ((Math.random() * 16) | 0) : (((x >> 2) + (y >> 2) + (z >> 2)) % 16);
    }
  }
  seedMaterials("bands");

  function resizeWorld(newN) {
    N = Math.max(1, Math.floor(newN)); cell = 1 / N; half = 0.5;
    isSolid = new Array(N * N * N).fill(false);
    voxelMat = new Uint8Array(N * N * N);
    clearHistory(); // world layout changed → clear undo/redo
  }

  /*** ---- Greedy meshing (merge by material) ---- ***/
  function buildGreedyRenderMesh() {
    const positions = [], normals = [], matIds = [], indices = [];
    let indexBase = 0;

    const visCount = () => { let vis = 0; for (let z = 0; z < N; z++)for (let y = 0; y < N; y++)for (let x = 0; x < N; x++) { if (!isSolid[idx3(x, y, z)]) continue; if (faceExposed(x, y, z, 0) || faceExposed(x, y, z, 1) || faceExposed(x, y, z, 2) || faceExposed(x, y, z, 3) || faceExposed(x, y, z, 4) || faceExposed(x, y, z, 5)) vis++; } return vis; };

    for (let axis = 0; axis < 3; axis++) {
      const u = (axis + 1) % 3, v = (axis + 2) % 3, dims = [N, N, N];
      for (let side = 0; side < 2; side++) {
        const n = [0, 0, 0]; n[axis] = (side === 0 ? 1 : -1);
        for (let k = 0; k <= dims[axis]; k++) {
          const mask = new Array(dims[u] * dims[v]).fill(null);
          for (let j = 0; j < dims[v]; j++) for (let i = 0; i < dims[u]; i++) {
            const c = [0, 0, 0]; c[u] = i; c[v] = j; c[axis] = (side === 0 ? k - 1 : k);
            if (!within(c[0], c[1], c[2])) continue;
            if (!isSolid[idx3(c[0], c[1], c[2])]) continue;
            const neigh = [c[0] + n[0], c[1] + n[1], c[2] + n[2]];
            if (within(neigh[0], neigh[1], neigh[2]) && isSolid[idx3(neigh[0], neigh[1], neigh[2])]) continue;
            mask[i + dims[u] * j] = voxelMat[idx3(c[0], c[1], c[2])];
          }
          let jRow = 0;
          while (jRow < dims[v]) {
            let iCol = 0;
            while (iCol < dims[u]) {
              const m = mask[iCol + dims[u] * jRow];
              if (m == null) { iCol++; continue; }
              let w = 1; while (iCol + w < dims[u] && mask[(iCol + w) + dims[u] * jRow] === m) w++;
              let h = 1; heightLoop: while (jRow + h < dims[v]) { for (let xw = 0; xw < w; xw++) { if (mask[(iCol + xw) + dims[u] * (jRow + h)] !== m) break heightLoop; } h++; }
              const du = [0, 0, 0]; du[u] = w * cell;
              const dv = [0, 0, 0]; dv[v] = h * cell;
              const base = [0, 0, 0]; base[u] = -half + cell * iCol; base[v] = -half + cell * jRow; base[axis] = -half + cell * k;
              const eps = 1e-6;
              let v0 = base.slice(), v1 = [base[0] + du[0], base[1] + du[1], base[2] + du[2]];
              let v2 = [v1[0] + dv[0], v1[1] + dv[1], v1[2] + dv[2]], v3 = [base[0] + dv[0], base[1] + dv[1], base[2] + dv[2]];
              const nrm = [0, 0, 0]; nrm[axis] = n[axis];
              v0[axis] += n[axis] * eps; v1[axis] += n[axis] * eps; v2[axis] += n[axis] * eps; v3[axis] += n[axis] * eps;
              positions.push(v0[0], v0[1], v0[2], v1[0], v1[1], v1[2], v2[0], v2[1], v2[2], v3[0], v3[1], v3[2]);
              normals.push(nrm[0], nrm[1], nrm[2], nrm[0], nrm[1], nrm[2], nrm[0], nrm[1], nrm[2], nrm[0], nrm[1], nrm[2]);
              matIds.push(m, m, m, m);
              if (n[axis] > 0) { indices.push(indexBase, indexBase + 1, indexBase + 2, indexBase, indexBase + 2, indexBase + 3); }
              else { indices.push(indexBase, indexBase + 3, indexBase + 2, indexBase, indexBase + 2, indexBase + 1); }
              indexBase += 4;
              for (let y2 = 0; y2 < h; y2++) for (let x2 = 0; x2 < w; x2++) mask[(iCol + x2) + dims[u] * (jRow + y2)] = null;
              iCol += w;
            }
            jRow++;
          }
        }
      }
    }

    // Upload render mesh
    gl.bindVertexArray(renderVAO);
    gl.bindBuffer(gl.ARRAY_BUFFER, renderPosBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(rLoc.aPosition);
    gl.vertexAttribPointer(rLoc.aPosition, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, renderNrmBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(rLoc.aNormal);
    gl.vertexAttribPointer(rLoc.aNormal, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, renderMatBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Uint8Array(matIds), gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(rLoc.aMatId);
    gl.vertexAttribIPointer(rLoc.aMatId, 1, gl.UNSIGNED_BYTE, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, renderIdxBuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(indices), gl.DYNAMIC_DRAW);
    gl.bindVertexArray(null);

    renderIndexCount = indices.length;
    document.getElementById('quads').textContent = (renderIndexCount / 6).toString();
    document.getElementById('tris').textContent = renderIndexCount.toString();
    document.getElementById('vis').textContent = visCount().toString();
  }

  /*** ---- Pick faces (unmerged) ---- ***/
  function buildPickFaces() {
    const positions = [], packed = [], indices = []; let base = 0;
    const faces = [{ axis: 0, sign: +1, u: 2, v: 1, id: 0 }, { axis: 0, sign: -1, u: 2, v: 1, id: 1 }, { axis: 1, sign: +1, u: 0, v: 2, id: 2 }, { axis: 1, sign: -1, u: 0, v: 2, id: 3 }, { axis: 2, sign: +1, u: 0, v: 1, id: 4 }, { axis: 2, sign: -1, u: 0, v: 1, id: 5 }];
    for (let z = 0; z < N; z++)for (let y = 0; y < N; y++)for (let x = 0; x < N; x++) {
      const vIdx = idx3(x, y, z); if (!isSolid[vIdx]) continue; const min = [-half + x * cell, -half + y * cell, -half + z * cell];
      for (const f of faces) {
        if (!faceExposed(x, y, z, f.id)) continue;
        const plane = min.slice(); plane[f.axis] += (f.sign > 0 ? cell : 0);
        const u = f.u, v = f.v;
        const p0 = plane.slice(), p1 = plane.slice(); p1[u] += cell;
        const p2 = p1.slice(); p2[v] += cell; const p3 = plane.slice(); p3[v] += cell;
        positions.push(p0[0], p0[1], p0[2], p1[0], p1[1], p1[2], p2[0], p2[1], p2[2], p3[0], p3[1], p3[2]);
        const pack = ((vIdx + 1) << 3) | (f.id & 7); packed.push(pack, pack, pack, pack);
        indices.push(base, base + 1, base + 2, base, base + 2, base + 3); base += 4;
      }
    }
    gl.bindVertexArray(pickVAO);
    gl.bindBuffer(gl.ARRAY_BUFFER, pickPosBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(pLoc.aPosition); gl.vertexAttribPointer(pLoc.aPosition, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, pickPackedBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Uint32Array(packed), gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(pLoc.aPacked); gl.vertexAttribIPointer(pLoc.aPacked, 1, gl.UNSIGNED_INT, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, pickIdxBuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(indices), gl.DYNAMIC_DRAW);
    gl.bindVertexArray(null);
    pickIndexCount = indices.length;
  }

  function rebuildAll() { buildGreedyRenderMesh(); buildPickFaces(); }
  rebuildAll();

  /*** ---- Camera / lighting ---- ***/
  const camera = new OrbitCamera({ radius: 2.3, theta: 0.9, phi: 0.9 });
  const model = Mat4.identity();
  let proj = Mat4.perspective(60 * Math.PI / 180, 1, 0.01, 100);
  const ambient = 0.22;

  /*** ---- Resize & Pick Targets ---- ***/
  let dpr = 1, pickFBO = null, pickTex = null, pickDepth = null, pickW = 0, pickH = 0;
  function resizePickTargets() {
    const w = canvas.width, h = canvas.height;
    if (w === pickW && h === pickH && pickFBO) return;
    if (pickTex) gl.deleteTexture(pickTex); if (pickDepth) gl.deleteRenderbuffer(pickDepth); if (pickFBO) gl.deleteFramebuffer(pickFBO);
    pickTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, pickTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    pickDepth = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, pickDepth); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, w, h);
    pickFBO = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, pickFBO);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, pickTex, 0);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, pickDepth);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); pickW = w; pickH = h;
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
    gl.viewport(0, 0, pickW, pickH); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const cullWas = gl.isEnabled(gl.CULL_FACE); if (cullWas) gl.disable(gl.CULL_FACE);
    gl.useProgram(pickProg);
    gl.uniformMatrix4fv(pLoc.uModel, false, model); gl.uniformMatrix4fv(pLoc.uView, false, camera.view()); gl.uniformMatrix4fv(pLoc.uProj, false, proj);
    gl.bindVertexArray(pickVAO); gl.drawElements(gl.TRIANGLES, pickIndexCount, gl.UNSIGNED_INT, 0); gl.bindVertexArray(null);
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
    if (pickIndexCount === 0) return { voxel: -1, face: -1 };
    renderPick();
    const { x, y } = clientToFB(xc, yc); const px = new Uint8Array(4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, pickFBO); gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    const packed = (px[0]) | (px[1] << 8) | (px[2] << 16);
    if (packed === 0) return { voxel: -1, face: -1 };
    const face = packed & 7; const vId = (packed >> 3) - 1; if (vId < 0 || vId >= isSolid.length) return { voxel: -1, face: -1 };
    return { voxel: vId, face };
  }

  /*** ---- Wireframe drawing ---- ***/
  function drawWireAABB(minX, minY, minZ, maxX, maxY, maxZ, color, inflate = 1.006) {
    const sx = (maxX - minX + 1) * cell, sy = (maxY - minY + 1) * cell, sz = (maxZ - minZ + 1) * cell;
    const cx = (-half + minX * cell) + sx * 0.5;
    const cy = (-half + minY * cell) + sy * 0.5;
    const cz = (-half + minZ * cell) + sz * 0.5;
    gl.useProgram(wireProg);
    gl.uniformMatrix4fv(wLoc.uModel, false, model); gl.uniformMatrix4fv(wLoc.uView, false, camera.view()); gl.uniformMatrix4fv(wLoc.uProj, false, proj);
    gl.uniform3fv(wLoc.uOffset, new Float32Array([cx, cy, cz]));
    gl.uniform3fv(wLoc.uScaleVec, new Float32Array([sx, sy, sz]));
    gl.uniform1f(wLoc.uInflate, inflate);
    gl.uniform3fv(wLoc.uColor, new Float32Array(color));
    gl.bindVertexArray(edgeVAO); gl.drawElements(gl.LINES, edges.count, gl.UNSIGNED_SHORT, 0); gl.bindVertexArray(null);
  }

  function drawVoxelWire(id, color, inflate = 1.006) {
    const [x, y, z] = coordsOf(id);
    drawWireAABB(x, y, z, x, y, z, color, inflate);
  }

  /*** ---- UI: Palette & brush ---- ***/
  const paletteEl = document.getElementById('palette'); let brushMat = 0;
  function buildPaletteUI() {
    paletteEl.innerHTML = '';
    for (let i = 0; i < 16; i++) {
      const hex = rgbToHexF(palette[i * 3 + 0], palette[i * 3 + 1], palette[i * 3 + 2]);
      const row = document.createElement('div'); row.className = 'swatch';
      const idx = document.createElement('div'); idx.className = 'idx'; idx.textContent = i.toString(16).toUpperCase();
      const chip = document.createElement('div'); chip.className = 'chip'; chip.style.background = hex; if (i === brushMat) chip.classList.add('active');
      chip.title = `Select material ${i}`; chip.addEventListener('click', () => selectBrush(i));
      const picker = document.createElement('input'); picker.type = 'color'; picker.value = hex; picker.title = `Edit palette[${i}]`;
      // Palette live update on input; record undo on change (single action)
      let lastHex = hex;
      picker.addEventListener('focus', () => { lastHex = picker.value; });
      picker.addEventListener('pointerdown', () => { lastHex = picker.value; });
      picker.addEventListener('input', () => { const [r, g, b] = hexToRgbF(picker.value); setPaletteColor(i, [r, g, b]); chip.style.background = picker.value; });
      picker.addEventListener('change', () => {
        if (picker.value !== lastHex) {
          const act = beginPaletteAction(`Palette ${i}`);
          recordPaletteChange(act, i, lastHex, picker.value);
          commitAction(act, /*rebuild*/false);
          lastHex = picker.value;
        }
      });
      row.appendChild(idx); row.appendChild(chip); row.appendChild(picker); paletteEl.appendChild(row);
    }
    document.getElementById('brushMat').textContent = brushMat;
  }
  buildPaletteUI();
  function selectBrush(id) { brushMat = id & 15; document.getElementById('brushMat').textContent = brushMat; document.querySelectorAll('.chip').forEach(c => c.classList.remove('active')); const chips = document.querySelectorAll('.chip'); if (chips[brushMat]) chips[brushMat].classList.add('active'); }

  // Buttons for palette/materials/world
  document.getElementById('randPalette').addEventListener('click', () => {
    for (let i = 0; i < 16; i++) setPaletteColor(i, [Math.random() * 0.9 + 0.1, Math.random() * 0.9 + 0.1, Math.random() * 0.9 + 0.1]);
    buildPaletteUI();
    clearHistory(); // treat as scene change
  });
  document.getElementById('randMaterials').addEventListener('click', () => {
    seedMaterials('random'); rebuildAll(); clearHistory();
  });
  document.getElementById('resetSolid').addEventListener('click', () => {
    isSolid.fill(true); seedMaterials('bands'); rebuildAll(); clearHistory();
  });

  let mode = document.querySelector('input[name="modeSelect"]:checked').value;
  document.querySelectorAll('input[name="modeSelect"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      if (e.target.checked) {
        mode = e.target.value;
        console.log('Mode changed to', mode);
      }
    });
  });

  let option = document.querySelector('input[name="optionSelect"]:checked').value;
  document.querySelectorAll('input[name="optionSelect"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      if (e.target.checked) {
        option = e.target.value;
        console.log('Option changed to', option);
      }
    });
  });


  /*** ---- Import/Export JSON ---- ***/
  const fileInput = document.getElementById('fileInput');
  document.getElementById('btnImport').addEventListener('click', () => fileInput.click());
  document.getElementById('btnExport').addEventListener('click', () => {
    const data = exportToJSON(); const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'voxels.json'; a.click(); URL.revokeObjectURL(url);
  });
  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { try { const obj = JSON.parse(reader.result); importFromJSON(obj); } catch (err) { alert('Invalid JSON: ' + err.message); } finally { fileInput.value = ''; } };
    reader.readAsText(file);
  });
  function exportToJSON() {
    const palHex = [];
    
    for (let i = 0; i < 16; i++) palHex.push(rgbToHexF(palette[i * 3 + 0], palette[i * 3 + 1], palette[i * 3 + 2]));

    const voxels = [];
    for (let z = 0; z < N; z++) {
      for (let y = 0; y < N; y++) {
        for (let x = 0; x < N; x++) {
          const id = idx3(x, y, z);
          if (isSolid[id]) voxels.push( `${decToHex(x).slice(-1)}${decToHex(y).slice(-1)}${decToHex(z).slice(-1)}${voxelMat[id] | 0}`);
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
          setPaletteColor(i, [Math.max(0, Math.min(1, rgb[0])), Math.max(0, Math.min(1, rgb[1])), Math.max(0, Math.min(1, rgb[2]))]); 
        }
      }
      buildPaletteUI();
    }

    isSolid.fill(false);
    voxelMat.fill(0);
  
    for (const v of obj.voxels) {
      if (!v) continue;
      console.log(v);
      const x = hexCharToInt(v[0]);
      const y = hexCharToInt(v[1]);
      const z = hexCharToInt(v[2]);
      const m = (hexCharToInt(v[3]) | 0) & 15;
      if (within(x, y, z)) {
        const id = idx3(x, y, z);
        isSolid[id] = true;
        voxelMat[id] = m;
      }
    }
    rebuildAll();
    clearHistory(); // imported scene becomes baseline
  }

  /*** ---- Row Tool ---- ***/
  // let rowToolOn = false, rowAxis = 'U';
  // const rowStateEl = document.getElementById('rowState'), rowAxisLbl = document.getElementById('rowAxisLbl');
  // function refreshRowUI() { rowStateEl.textContent = rowToolOn ? 'On' : 'Off'; rowAxisLbl.textContent = rowAxis; document.getElementById('toggleRow').classList.toggle('toggled', rowToolOn); document.getElementById('toggleAxis').classList.toggle('toggled', true); }
  // document.getElementById('toggleRow').addEventListener('click', () => { rowToolOn = !rowToolOn; if (rowToolOn) { planeToolOn = false; refreshPlaneUI(); boxToolOn = false; refreshBoxUI(); } refreshRowUI(); });
  // document.getElementById('toggleAxis').addEventListener('click', () => { rowAxis = (rowAxis === 'U' ? 'V' : 'U'); refreshRowUI(); });
  // refreshRowUI();

  function getRowSurfaceVoxels(vIdx, faceId, axisMode) {
    if (vIdx < 0 || faceId < 0) return [];
    const info = FACE_INFO[faceId], [x0, y0, z0] = coordsOf(vIdx); 
    const U = info.u, V = info.v, AX = info.axis; 
    const fixedV = [x0, y0, z0][V], fixedAX = [x0, y0, z0][AX];
    const out = [];
    for (let t = 0; t < N; t++) {
      const c = [0, 0, 0];
      if (axisMode === 'U') {
        c[U] = t;
        c[V] = fixedV;
        c[AX] = fixedAX;
      } else {
        c[U] = [x0, y0, z0][U];
        c[V] = t;
        c[AX] = fixedAX;
      }
      if (!within(c[0], c[1], c[2])) continue;
      if (!isSolid[idx3(c[0], c[1], c[2])]) continue;
      if (!faceExposed(c[0], c[1], c[2], faceId)) continue;
      out.push(idx3(c[0], c[1], c[2]));
    }
    return out;
  }
  function getRowAddTargets(vIdx, faceId, axisMode) {
    const d = FACE_DIRS[faceId], surf = getRowSurfaceVoxels(vIdx, faceId, axisMode), tSet = new Set();
    for (const s of surf) {
      const [x, y, z] = coordsOf(s);
      const nx = x + d[0], ny = y + d[1], nz = z + d[2];
      if (within(nx, ny, nz) && !isSolid[idx3(nx, ny, nz)]) tSet.add(idx3(nx, ny, nz));
    }
    return [...tSet];
  }

  /*** ---- Plane Tool ---- ***/
  // let planeToolOn = false;
  // const planeStateEl = document.getElementById('planeState');
  // function refreshPlaneUI() { planeStateEl.textContent = planeToolOn ? 'On' : 'Off'; document.getElementById('togglePlane').classList.toggle('toggled', planeToolOn); }
  // document.getElementById('togglePlane').addEventListener('click', () => { planeToolOn = !planeToolOn; if (planeToolOn) { rowToolOn = false; refreshRowUI(); boxToolOn = false; refreshBoxUI(); } refreshPlaneUI(); });
  // refreshPlaneUI();

  function getPlaneSurfaceVoxels(vIdx, faceId) {
    if (vIdx < 0 || faceId < 0) return [];
    const info = FACE_INFO[faceId], [x0, y0, z0] = coordsOf(vIdx); const AX = info.axis, U = info.u, V = info.v; const fixedAX = [x0, y0, z0][AX];
    const out = []; for (let u = 0; u < N; u++)for (let v = 0; v < N; v++) { const c = [0, 0, 0]; c[AX] = fixedAX; c[U] = u; c[V] = v; if (!within(c[0], c[1], c[2])) continue; if (!isSolid[idx3(c[0], c[1], c[2])]) continue; if (!faceExposed(c[0], c[1], c[2], faceId)) continue; out.push(idx3(c[0], c[1], c[2])); }
    return out;
  }
  function getPlaneAddTargets(vIdx, faceId) {
    const d = FACE_DIRS[faceId], surf = getPlaneSurfaceVoxels(vIdx, faceId), tSet = new Set();
    for (const s of surf) { const [x, y, z] = coordsOf(s); const nx = x + d[0], ny = y + d[1], nz = z + d[2]; if (within(nx, ny, nz) && !isSolid[idx3(nx, ny, nz)]) tSet.add(idx3(nx, ny, nz)); }
    return [...tSet];
  }

  /*** ---- Box Tool ---- ***/
  // let boxToolOn = false; let boxSize = 3; let boxFaceOffset = true;
  // const boxStateEl = document.getElementById('boxState'); const boxSizeEl = document.getElementById('boxSize'); const boxSizeLbl = document.getElementById('boxSizeLbl'); const boxFaceOffsetEl = document.getElementById('boxFaceOffset');
  // function refreshBoxUI() { boxStateEl.textContent = boxToolOn ? 'On' : 'Off'; document.getElementById('toggleBox').classList.toggle('toggled', boxToolOn); boxSizeLbl.textContent = boxSize; }
  // document.getElementById('toggleBox').addEventListener('click', () => { boxToolOn = !boxToolOn; if (boxToolOn) { rowToolOn = false; refreshRowUI(); planeToolOn = false; refreshPlaneUI(); } refreshBoxUI(); });
  // boxSizeEl.addEventListener('input', () => { boxSize = Math.max(2, Math.min(8, boxSizeEl.value | 0)); refreshBoxUI(); });
  // boxFaceOffsetEl.addEventListener('change', () => { boxFaceOffset = boxFaceOffsetEl.checked; });
  // refreshBoxUI();

  // function getCenteredBoxBounds(cx, cy, cz, size) {
  //   const h = Math.floor((size - 1) / 2);
  //   const minX = cx - h, maxX = cx + (size - 1 - h);
  //   const minY = cy - h, maxY = cy + (size - 1 - h);
  //   const minZ = cz - h, maxZ = cz + (size - 1 - h);
  //   return [minX, minY, minZ, maxX, maxY, maxZ];
  // }
  // function clampBounds(minX, minY, minZ, maxX, maxY, maxZ) {
  //   return [
  //     Math.max(0, Math.min(N - 1, minX)),
  //     Math.max(0, Math.min(N - 1, minY)),
  //     Math.max(0, Math.min(N - 1, minZ)),
  //     Math.max(0, Math.min(N - 1, maxX)),
  //     Math.max(0, Math.min(N - 1, maxY)),
  //     Math.max(0, Math.min(N - 1, maxZ)),
  //   ];
  // }
  // function offsetBoundsByFace(minX, minY, minZ, maxX, maxY, maxZ, faceId) {
  //   if (faceId < 0) return [minX, minY, minZ, maxX, maxY, maxZ];
  //   const d = FACE_DIRS[faceId];
  //   return [minX + d[0], minY + d[1], minZ + d[2], maxX + d[0], maxY + d[1], maxZ + d[2]];
  // }
  // function forEachInBounds(minX, minY, minZ, maxX, maxY, maxZ, fn) {
  //   for (let z = minZ; z <= maxZ; z++) for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) fn(x, y, z);
  // }

  /*** ---- UNDO/REDO system ---- ***/
  const undoBtn = document.getElementById('btnUndo');
  const redoBtn = document.getElementById('btnRedo');
  const undoInfo = document.getElementById('undoInfo');

  const undoStack = [];
  const redoStack = [];

  function updateUndoUI() {
    undoBtn.disabled = undoStack.length === 0;
    redoBtn.disabled = redoStack.length === 0;
    const last = undoStack[undoStack.length - 1];
    const next = redoStack[redoStack.length - 1];
    undoInfo.textContent = `Undo: ${last ? last.label : '—'} • Redo: ${next ? next.label : '—'}`;
  }
  function clearHistory() { undoStack.length = 0; redoStack.length = 0; updateUndoUI(); }

  function beginVoxelAction(label) { return { type: 'voxels', label, vox: [] }; }
  function recordVoxelChange(act, idx, toSolid, toMat = voxelMat[idx]) {
    const fromS = isSolid[idx], fromM = voxelMat[idx];
    if (fromS === toSolid && fromM === toMat) return;
    act.vox.push({ idx, fromS, fromM, toS: toSolid, toM: toMat });
    // apply immediately (compose effect)
    isSolid[idx] = toSolid;
    voxelMat[idx] = toMat;
  }
  function beginPaletteAction(label) { return { type: 'palette', label, pal: [] }; }
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
        for (const c of arr) { isSolid[c.idx] = c.fromS; voxelMat[c.idx] = c.fromM; }
      } else {
        for (const c of arr) { isSolid[c.idx] = c.toS; voxelMat[c.idx] = c.toM; }
      }
    } else if (action.type === 'palette') {
      const arr = action.pal;
      if (mode === 'undo') {
        for (const p of arr) { setPaletteColor(p.i, p.from); }
      } else {
        for (const p of arr) { setPaletteColor(p.i, p.to); }
      }
      buildPaletteUI(); // refresh swatches to reflect the current palette colors
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
  undoBtn.addEventListener('click', undo);
  redoBtn.addEventListener('click', redo);

  /*** ---- Input, hover, keyboard ---- ***/
  const hoverInfoEl = document.getElementById('hoverInfo');
  let dragging = false, rotating = false, lastX = 0, lastY = 0; let mouseX = 0, mouseY = 0, needsPick = true, ctrlDown = false, buttons = 0;
  let hoverVoxel = -1, hoverFace = -1;

  // Hover sets
  let rowHoverSurf = [], rowHoverAdd = [], planeHoverSurf = [], planeHoverAdd = [];
  // Box hover bounds
  // let boxHoverBounds = null; // [minX,minY,minZ,maxX,maxY,maxZ]
  // let boxHoverAddBounds = null;

  function updateHoverUI() {
    if (hoverVoxel < 0 || hoverFace < 0) {
      hoverInfoEl.textContent = 'Hover: –';
      return; 
    }
    const [x, y, z] = coordsOf(hoverVoxel);
    hoverInfoEl.textContent = `Hover: (${x}, ${y}, ${z}) face ${FACE_LABEL[hoverFace] || '?'}`;
  }

  window.addEventListener('keydown', (e) => {
    const k = e.key;
    // Undo/Redo
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (k === 'z' || k === 'Z')) {
      e.preventDefault();
      undo();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && (k === 'y' || (e.shiftKey && (k === 'z' || k === 'Z')))) {
      e.preventDefault();
      redo();
      return;
    }
    // Quick material: 0-9, A-F
    if (/^[0-9]$/.test(k)) selectBrush(parseInt(k, 10));
    else if (/^[a-f]$/i.test(k)) selectBrush(10 + parseInt(k, 16) - 10);
    // Tools
    if (k === 'r' || k === 'R') {
      rowToolOn = !rowToolOn;
      if (rowToolOn) {
        planeToolOn = false;
        refreshPlaneUI();
        boxToolOn = false;
        refreshBoxUI();
      }
      refreshRowUI();
    }
    if (k === 'x' || k === 'X') {
      rowAxis = (rowAxis === 'U' ? 'V' : 'U');
      refreshRowUI();
    }
    if (k === 'p' || k === 'P') {
      planeToolOn = !planeToolOn;
      if (planeToolOn) {
        rowToolOn = false;
        refreshRowUI();
        boxToolOn = false;
        refreshBoxUI();
      }
      refreshPlaneUI();
    }
    if (k === 'b' || k === 'B') {
      boxToolOn = !boxToolOn;
      if (boxToolOn) {
        rowToolOn = false;
        refreshRowUI();
        planeToolOn = false;
        refreshPlaneUI();
      }
      refreshBoxUI();
    }
    ctrlDown = e.ctrlKey || e.metaKey;
    needsPick = true;
  });
  window.addEventListener('keyup', (e) => {
    ctrlDown = e.ctrlKey || e.metaKey;
    needsPick = true;
  });

  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  // Edit handlers now produce actions (undoable)
  canvas.addEventListener('mousedown', (e) => {
    canvas.focus();
    buttons = e.buttons;

    if (e.button === 0 && mode === 'move') {
      dragging = true;
      rotating = true;
      lastX = e.clientX;
      lastY = e.clientY;
      return;
    }


    const pick = decodePickAt(e.clientX, e.clientY);

    if (e.button === 0 && mode === 'paint') {
      // Paint
      if (option == 'plane') {
        const arr = getPlaneSurfaceVoxels(pick.voxel, pick.face);
        const act = beginVoxelAction('Paint plane');
        for (const id of arr) recordVoxelChange(act, id, true, brushMat);
        commitAction(act);
      } else if (option == 'row') {
        const arr = getRowSurfaceVoxels(pick.voxel, pick.face, rowAxis);
        const act = beginVoxelAction(`Paint row ${rowAxis}`);
        for (const id of arr) recordVoxelChange(act, id, true, brushMat);
        commitAction(act);
      } else if (pick.voxel >= 0) {
          const act = beginVoxelAction('Paint voxel');
          recordVoxelChange(act, pick.voxel, true, brushMat);
          commitAction(act);
      }
    } else if (e.button === 0 && mode === 'add') {

        // Add
        if (option == 'plane') {
          const targets = getPlaneAddTargets(pick.voxel, pick.face);
          const act = beginVoxelAction('Add plane');
          for (const t of targets) recordVoxelChange(act, t, true, brushMat);
          commitAction(act);
        } else if (option == 'row') {
          const targets = getRowAddTargets(pick.voxel, pick.face, rowAxis);
          const act = beginVoxelAction(`Add row ${rowAxis}`);
          for (const t of targets) recordVoxelChange(act, t, true, brushMat);
          commitAction(act);
        } else if (pick.voxel >= 0 && pick.face >= 0) {
            const [x, y, z] = coordsOf(pick.voxel); const d = FACE_DIRS[pick.face]; const nx = x + d[0], ny = y + d[1], nz = z + d[2];
            if (within(nx, ny, nz)) {
              const id = idx3(nx, ny, nz);
              const act = beginVoxelAction('Add voxel');
              if (!isSolid[id]) recordVoxelChange(act, id, true, brushMat);
              commitAction(act);
            }
        }
      } else if (e.button === 0 && mode === 'carve') {
        // Remove (or toggle for single)
        if (option == 'plane') {
          const arr = getPlaneSurfaceVoxels(pick.voxel, pick.face);
          const act = beginVoxelAction('Remove plane');
          for (const id of arr) recordVoxelChange(act, id, false, voxelMat[id]);
          commitAction(act);
        } else if (option == 'row') {
          const arr = getRowSurfaceVoxels(pick.voxel, pick.face, rowAxis);
          const act = beginVoxelAction(`Remove row ${rowAxis}`);
          for (const id of arr) recordVoxelChange(act, id, false, voxelMat[id]);
          commitAction(act);
        } else if (pick.voxel >= 0) {
            const act = beginVoxelAction('Remove voxel');
            const cur = isSolid[pick.voxel];
            recordVoxelChange(act, pick.voxel, !cur, voxelMat[pick.voxel]); // keep existing mat on toggle
            commitAction(act);
        }

    }
  });

  window.addEventListener('mouseup', () => { 
    dragging = false; 
    rotating = false; 
    buttons = 0; 
  });

  window.addEventListener('mousemove', (e) => {
    if (!dragging || !rotating) { 
      mouseX = e.clientX;
      mouseY = e.clientY;
      needsPick = true; 
    }
    if (dragging && rotating) { 
      const dx = e.clientX - lastX, dy = e.clientY - lastY; 
      lastX = e.clientX;
      lastY = e.clientY; 
      const s = 0.005;
      camera.theta += dx * s;
      camera.phi -= dy * s;
      camera.clamp();
    }
  }, { passive: true });

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const z = Math.pow(1.1, e.deltaY * 0.01);
    camera.radius *= z;
    camera.clamp();
  }, { passive: false });

  function updateHover() {
    if (!needsPick) return;
    needsPick = false;
    const p = decodePickAt(mouseX, mouseY);
    hoverVoxel = p.voxel;
    hoverFace = p.face;
    updateHoverUI();

    // Compute previews
    if (mode !== 'move' && hoverVoxel >= 0 && hoverFace >= 0) {
      if (option === 'row') {
        rowHoverSurf = getRowSurfaceVoxels(hoverVoxel, hoverFace);
        rowHoverAdd = getRowAddTargets(hoverVoxel, hoverFace);
      } else {
        rowHoverSurf = [];
        rowHoverAdd = [];
      }

      if (option === 'plane') {
        planeHoverSurf = getPlaneSurfaceVoxels(hoverVoxel, hoverFace);
        planeHoverAdd = getPlaneAddTargets(hoverVoxel, hoverFace);
      } else {
        planeHoverSurf = [];
        planeHoverAdd = [];
      }
    } else {
      rowHoverSurf = [];
      rowHoverAdd = [];
      planeHoverSurf = [];
      planeHoverAdd = [];
    }
  }

  /*** ---- Render loop ---- ***/
  function render() {
    gl.clearColor(0.07, 0.08, 0.1, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(renderProg);
    gl.uniform3fv(rLoc.uPalette, palette);
    gl.uniformMatrix4fv(rLoc.uModel, false, model); gl.uniformMatrix4fv(rLoc.uView, false, camera.view()); gl.uniformMatrix4fv(rLoc.uProj, false, proj);
    gl.uniformMatrix3fv(rLoc.uNormalMat, false, new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]));
    gl.uniform3fv(rLoc.uLightDirWS, new Float32Array([0.7 / 1.7, 1.2 / 1.7, 0.9 / 1.7])); gl.uniform1f(rLoc.uAmbient, ambient);
    gl.bindVertexArray(renderVAO); gl.drawElements(gl.TRIANGLES, renderIndexCount, gl.UNSIGNED_INT, 0); gl.bindVertexArray(null);

    updateHover();

    if (mode !== 'move' && hoverVoxel >= 0 && hoverFace >= 0) {
      if (option === 'plane') {
        if (planeHoverAdd.length) {
          for (const t of planeHoverAdd) drawVoxelWire(t, [0.27, 0.95, 0.42], 1.006);
        } else if (planeHoverSurf.length) {
          for (const id of planeHoverSurf) drawVoxelWire(id, [1.0, 0.32, 0.32], 1.006);
        } else if (planeHoverSurf.length) {
          for (const id of planeHoverSurf) drawVoxelWire(id, [1.0, 0.60, 0.20], 1.006);
        }
      } else if (option === 'row') {
        if (rowHoverAdd.length) {
          for (const t of rowHoverAdd) drawVoxelWire(t, [0.27, 0.95, 0.42], 1.006);
        } else if (rowHoverSurf.length) {
          for (const id of rowHoverSurf) drawVoxelWire(id, [1.0, 0.32, 0.32], 1.006);
        } else if (rowHoverSurf.length) {
          for (const id of rowHoverSurf) drawVoxelWire(id, [1.0, 0.60, 0.20], 1.006);
        }
      } else if (option === 'voxel') {
        if (mode === 'add') {
          console.log('draw add voxel preview');
          const [x, y, z] = coordsOf(hoverVoxel);
          const d = FACE_DIRS[hoverFace];
          const nx = x + d[0], ny = y + d[1], nz = z + d[2];
          if (within(nx, ny, nz) && !isSolid[idx3(nx, ny, nz)]) drawVoxelWire(idx3(nx, ny, nz), [0.27, 0.95, 0.42], 1.006);
        } else if (mode === 'carve') {
          console.log('draw carve voxel preview');
          drawVoxelWire(hoverVoxel, [1.0, 0.32, 0.32], 1.006);
        } else if (mode === 'paint') {
          console.log('draw paint voxel preview');
          drawVoxelWire(hoverVoxel, [1.0, 0.60, 0.20], 1.006);
        }
      }
    }
    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
  setTimeout(resize, 0);
})();