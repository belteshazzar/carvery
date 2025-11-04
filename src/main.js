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
  createPalette,
  setPaletteColor,
  PaletteUI 
} from './palette.js';

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


  /*** ---- World State ---- ***/
  let N = 16;

  let isSolid = new Array(N * N * N).fill(true);
  let voxelMat = new Uint8Array(N * N * N);    // 0..15
  let palette = createPalette();

  const FACE_DIRS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],[0,0,0]]; // last is for ground plane
  const FACE_INFO = [{ axis: 0, u: 2, v: 1 }, { axis: 0, u: 2, v: 1 }, { axis: 1, u: 0, v: 2 }, { axis: 1, u: 0, v: 2 }, { axis: 2, u: 0, v: 1 }, { axis: 2, u: 0, v: 1 }];
  const FACE_LABEL = ["+X", "-X", "+Y", "-Y", "+Z", "-Z", "Y+"]; // last is for ground plane
  const idx3 = (x, y, z) => x + N * (y + N * z);
  const within = (x, y, z) => x >= 0 && y >= 0 && z >= 0 && x < N && y < N && z < N;

  function coordsOf(id) {
    const z = Math.floor(id / (N * N));
    const y = Math.floor((id - z * N * N) / N);
    const x = id - z * N * N - y * N;
    return [x, y, z];
  }

  function faceExposed(x, y, z, f) {
    const d = FACE_DIRS[f], here = isSolid[idx3(x, y, z)]; 
    const nx = x + d[0], ny = y + d[1], nz = z + d[2]; 
    const nb = within(nx, ny, nz) ? isSolid[idx3(nx, ny, nz)] : false; 
    return here && !nb;
  }

  function seedMaterials(mode = "bands") {
    for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      voxelMat[idx3(x, y, z)] = mode === "random" ? ((Math.random() * 16) | 0) : (((x >> 2) + (y >> 2) + (z >> 2)) % 16);
    }
  }
  seedMaterials("bands");

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
              let w = 1; 
              while (iCol + w < dims[u] && mask[(iCol + w) + dims[u] * jRow] === m) w++;
              let h = 1; 
              heightLoop: while (jRow + h < dims[v]) { for (let xw = 0; xw < w; xw++) { if (mask[(iCol + xw) + dims[u] * (jRow + h)] !== m) break heightLoop; } h++; }
              // Update base position calculation in buildGreedyRenderMesh()
              const base = [0, 0, 0]; 
              base[u] = iCol;  // Remove cell multiplication
              base[v] = jRow;  
              base[axis] = k;
              const eps = 1e-6;

              // Fix quad vertex positions to use direct coordinates
              const du = [0, 0, 0]; du[u] = w;
              const dv = [0, 0, 0]; dv[v] = h;
              
              // Create quad vertices using actual coordinates
              const v0 = base.slice();
              const v1 = base.slice(); v1[u] += w;
              const v2 = v1.slice(); v2[v] += h;
              const v3 = base.slice(); v3[v] += h;

              // Add epsilon offset in normal direction
              const nrm = [0, 0, 0]; nrm[axis] = n[axis];
              v0[axis] += n[axis] * eps;
              v1[axis] += n[axis] * eps;
              v2[axis] += n[axis] * eps;
              v3[axis] += n[axis] * eps;

              positions.push(
                v0[0], v0[1], v0[2],
                v1[0], v1[1], v1[2],
                v2[0], v2[1], v2[2],
                v3[0], v3[1], v3[2]
              );

              normals.push(nrm[0], nrm[1], nrm[2], nrm[0], nrm[1], nrm[2], nrm[0], nrm[1], nrm[2], nrm[0], nrm[1], nrm[2]);
              matIds.push(m, m, m, m);
              if (n[axis] > 0) { 
                indices.push(indexBase, indexBase + 1, indexBase + 2, indexBase, indexBase + 2, indexBase + 3); 
              } else { 
                indices.push(indexBase, indexBase + 3, indexBase + 2, indexBase, indexBase + 2, indexBase + 1); 
              }
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
    gl.bindVertexArray(renderProg.vao);

    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(renderProg.aPosition.location);
    gl.vertexAttribPointer(renderProg.aPosition.location, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(renderProg.aNormal.location);
    gl.vertexAttribPointer(renderProg.aNormal.location, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Uint8Array(matIds), gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(renderProg.aMatId.location);
    gl.vertexAttribIPointer(renderProg.aMatId.location, 1, gl.UNSIGNED_BYTE, 0, 0);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(indices), gl.DYNAMIC_DRAW);
   
    gl.bindVertexArray(null);

    renderProg.meta.renderIndexCount = indices.length;
    document.getElementById('quads').textContent = (renderProg.meta.renderIndexCount / 6).toString();
    document.getElementById('tris').textContent = renderProg.meta.renderIndexCount.toString();
    document.getElementById('vis').textContent = visCount().toString();
  }

  /*** ---- Pick faces (unmerged) ---- ***/

  // Modify buildPickFaces to create separate geometries
  function buildPickFaces() {
    // Geometry for voxel faces
    const voxelPos = [], voxelPacked = [], voxelIndices = []; 
    // Geometry for ground plane
    const groundPos = [], groundPacked = [], groundIndices = [];
    let voxelBase = 0, groundBase = 0;

        // Build voxel face geometry
    const faces = [
      { axis: 0, sign: +1, u: 2, v: 1, id: 0 }, // +X
      { axis: 0, sign: -1, u: 2, v: 1, id: 1 }, // -X
      { axis: 1, sign: +1, u: 0, v: 2, id: 2 }, // +Y
      { axis: 1, sign: -1, u: 0, v: 2, id: 3 }, // -Y
      { axis: 2, sign: +1, u: 0, v: 1, id: 4 }, // +Z
      { axis: 2, sign: -1, u: 0, v: 1, id: 5 }  // -Z
    ];

    const groundY = 0; // Y position of ground plane
    // Build ground plane geometry
    for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) for (let fid = 2; fid <= 2; fid++) {
      const vIdx = idx3(x, groundY, z);
      const min = [x, groundY, z];
      const f = faces[fid];

        const plane = min.slice();
        
        const u = f.u
        const v = f.v;
        const p0 = plane.slice();
        const p1 = plane.slice(); 
        p1[u] += 1;
        const p2 = p1.slice(); 
        p2[v] += 1;
        const p3 = plane.slice(); 
        p3[v] += 1;
        
        groundPos.push(
          p0[0], p0[1], p0[2],
          p1[0], p1[1], p1[2],
          p2[0], p2[1], p2[2],
          p3[0], p3[1], p3[2]
        );
      
      // Special pack value for ground plane
      const groundPack = ((vIdx + 1) << 4) | (6 & 7); // Face ID 6 for ground plane

      groundPacked.push(groundPack, groundPack, groundPack, groundPack);
      groundIndices.push(
        groundBase, groundBase + 1, groundBase + 2,
        groundBase, groundBase + 2, groundBase + 3
      );
      groundBase += 4;
    }

    for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const vIdx = idx3(x, y, z);
      if (!isSolid[vIdx]) continue;

      const min = [x, y, z];

      for (const f of faces) {
        if (!faceExposed(x, y, z, f.id)) continue;
        
        const plane = min.slice();
        plane[f.axis] += (f.sign > 0 ? 1 : 0);
        
        const u = f.u
        const v = f.v;
        const p0 = plane.slice();
        const p1 = plane.slice(); 
        p1[u] += 1;
        const p2 = p1.slice(); 
        p2[v] += 1;
        const p3 = plane.slice(); 
        p3[v] += 1;
        
        voxelPos.push(
          p0[0], p0[1], p0[2],
          p1[0], p1[1], p1[2],
          p2[0], p2[1], p2[2],
          p3[0], p3[1], p3[2]
        );
        
        const pack = ((vIdx + 1) << 4) | (f.id & 7);
        voxelPacked.push(pack, pack, pack, pack);
        
        voxelIndices.push(
          voxelBase, voxelBase + 1, voxelBase + 2,
          voxelBase, voxelBase + 2, voxelBase + 3
        );
        voxelBase += 4;
      }
    }

    // Create second vao for pickProg
    if (!pickProg.vaoGround) pickProg.vaoGround = gl.createVertexArray();

    // Setup voxel VAO
    gl.bindVertexArray(pickProg.vao);

    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(voxelPos), gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(pickProg.aPosition.location);
    gl.vertexAttribPointer(pickProg.aPosition.location, 3, gl.FLOAT, false, 0, 0);
    
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Uint32Array(voxelPacked), gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(pickProg.aPacked.location);
    gl.vertexAttribIPointer(pickProg.aPacked.location, 1, gl.UNSIGNED_INT, 0, 0);
    
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(voxelIndices), gl.DYNAMIC_DRAW);

    // Setup ground VAO
    gl.bindVertexArray(pickProg.vaoGround);
    
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(groundPos), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(pickProg.aPosition.location);
    gl.vertexAttribPointer(pickProg.aPosition.location, 3, gl.FLOAT, false, 0, 0);
    
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Uint32Array(groundPacked), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(pickProg.aPacked.location);
    gl.vertexAttribIPointer(pickProg.aPacked.location, 1, gl.UNSIGNED_INT, 0, 0);
    
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(groundIndices), gl.STATIC_DRAW);

    gl.bindVertexArray(null);

    pickProg.meta.pickVoxelCount = voxelIndices.length;
    pickProg.meta.pickGroundCount = groundIndices.length;
  }

  function rebuildAll() { 
    buildGreedyRenderMesh(); 
    buildPickFaces();
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
    if (vId < 0 || vId >= isSolid.length) return { voxel: -1, face: -1 };
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
    const [x, y, z] = coordsOf(id);
    drawWireAABB(x, y, z, x, y, z, color, inflate);
  }

  /*** ---- UI: Palette & brush ---- ***/
  const paletteUI = new PaletteUI(
    document.getElementById('palette'),
    palette,
    (brushId) => {
      brushMat = brushId;
    },
    (index, fromHex, toHex) => {
      const act = beginPaletteAction(`Palette ${index}`);
      recordPaletteChange(act, index, fromHex, toHex);
      commitAction(act, false);
    }
  );

  // Update brush material access
  function selectBrush(id) {
    paletteUI.selectBrush(id);
    brushMat = paletteUI.getBrush();
  }

  // Update reset button handler
  document.getElementById('resetSolid').addEventListener('click', () => {
    isSolid.fill(true);
    seedMaterials('bands');
    rebuildAll();
    clearHistory();
  });

  let mode = document.querySelector('input[name="modeSelect"]:checked').value;
  document.querySelectorAll('input[name="modeSelect"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      if (e.target.checked) {
        mode = e.target.value;
      }
    });
  });

  let option = document.querySelector('input[name="optionSelect"]:checked').value;
  document.querySelectorAll('input[name="optionSelect"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      if (e.target.checked) {
        option = e.target.value;
      }
    });
  });

  /*** ---- Import/Export JSON ---- ***/
  const fileInput = document.getElementById('fileInput');
  document.getElementById('btnImport').addEventListener('click', () => fileInput.click());
  document.getElementById('btnExport').addEventListener('click', () => {
    const data = exportToJSON(); 
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }); 
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); 
    a.href = url; 
    a.download = 'voxels.json'; 
    a.click();
    URL.revokeObjectURL(url);
  });
  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0]; 
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const obj = JSON.parse(reader.result); 
        importFromJSON(obj);
      } catch (err) {
        alert('Invalid JSON: ' + err.message);
      } finally {
        fileInput.value = '';
      }
    };
    reader.readAsText(file);
  });

  function intToHexChar(i) {
    if (i >= 0 && i <= 9) return String.fromCharCode('0'.charCodeAt(0) + i);
    if (i >= 10 && i <= 15) return String.fromCharCode('a'.charCodeAt(0) + (i - 10));
    return '0';
  }

  function exportToJSON() {
    const palHex = [];
    
    for (let i = 0; i < 16; i++) palHex.push(rgbToHexF(palette[i * 3 + 0], palette[i * 3 + 1], palette[i * 3 + 2]));

    const voxels = [];
    for (let z = 0; z < N; z++) {
      for (let y = 0; y < N; y++) {
        for (let x = 0; x < N; x++) {
          const id = idx3(x, y, z);
          if (isSolid[id]) {
            voxels.push( `${intToHexChar(x)}${intToHexChar(y)}${intToHexChar(z)}${intToHexChar(voxelMat[id])}`);
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
          setPaletteColor(i, [
            Math.max(0, Math.min(1, rgb[0])), 
            Math.max(0, Math.min(1, rgb[1])), 
            Math.max(0, Math.min(1, rgb[2]))
          ]); 
        }
      }
      paletteUI.build();
    }

    isSolid.fill(false);
    voxelMat.fill(0);
  
    for (const v of obj.voxels) {
      if (!v) continue;
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
    const [x0, y0, z0] = coordsOf(vIdx); 
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
      if (!within(c[0], c[1], c[2])) continue;
      if (!isSolid[idx3(c[0], c[1], c[2])]) continue;
      out.push(idx3(c[0], c[1], c[2]));
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
    const [x0, y0, z0] = coordsOf(vIdx); 
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
      if (!within(c[0], c[1], c[2])) continue;
      if (isSolid[idx3(c[0], c[1], c[2])]) continue;
      out.push(idx3(c[0], c[1], c[2]));
    }
    return out;
  }

  /*** ---- Plane Tool ---- ***/

  function getPlaneSurfaceVoxels(vIdx, faceId) {
    if (vIdx < 0 || faceId < 0 || faceId >= FACE_INFO.length) return [];
    const info = FACE_INFO[faceId]
    const [x0, y0, z0] = coordsOf(vIdx);
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
          if (!within(c[0], c[1], c[2])) continue;
          if (!isSolid[idx3(c[0], c[1], c[2])]) continue;
          out.push(idx3(c[0], c[1], c[2]));
          continue;
        }

        if (!within(c[0], c[1], c[2])) continue;
        if (!isSolid[idx3(c[0], c[1], c[2])]) continue;
        if (!faceExposed(c[0], c[1], c[2], faceId)) continue;
        out.push(idx3(c[0], c[1], c[2]));
      }
    }

    return out;
  }

  function getGroundPlaneVoxels() {
    const out = [];
    for (let x = 0; x < N; x++) {
      for (let z = 0; z < N; z++) {
        const y = 0;
        out.push(idx3(x, y, z));
      }
    }
    return out;
  }

  function getPlaneAddTargets(vIdx, faceId) {
    const d = FACE_DIRS[faceId]
    const surf = (faceId === 6) ? getGroundPlaneVoxels() :getPlaneSurfaceVoxels(vIdx, faceId);
    const tSet = new Set();
    for (const s of surf) {
      const [x, y, z] = coordsOf(s); 
      const nx = x + d[0]
      const ny = y + d[1]
      const nz = z + d[2];
      if (within(nx, ny, nz) && !isSolid[idx3(nx, ny, nz)]) tSet.add(idx3(nx, ny, nz)); 
    }
    const res = [...tSet];
    return res;
  }

  /*** ---- UNDO/REDO system ---- ***/
  const undoStack = [];
  const redoStack = [];
  const undoBtn = document.getElementById('btnUndo');
  const redoBtn = document.getElementById('btnRedo');

  function updateUndoUI() {
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

  function recordVoxelChange(act, idx, toSolid, toMat = voxelMat[idx]) {
    const fromS = isSolid[idx], fromM = voxelMat[idx];
    if (fromS === toSolid && fromM === toMat) return;
    act.vox.push({ idx, fromS, fromM, toS: toSolid, toM: toMat });
    // apply immediately (compose effect)
    isSolid[idx] = toSolid;
    voxelMat[idx] = toMat;
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
          isSolid[c.idx] = c.fromS;
          voxelMat[c.idx] = c.fromM;
        }
      } else {
        for (const c of arr) {
          isSolid[c.idx] = c.toS;
          voxelMat[c.idx] = c.toM;
        }
      }
    } else if (action.type === 'palette') {
      const arr = action.pal;
      if (mode === 'undo') {
        for (const p of arr) {
          setPaletteColor(palette, p.i, p.from);
        }
      } else {
        for (const p of arr) {
          setPaletteColor(palette, p.i, p.to);
        }
      }
      paletteUI.build();
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
  let dragging = false, lastX = 0, lastY = 0;
  let mouseX = 0, mouseY = 0, needsPick = true, buttons = 0;
  let hoverVoxel = -1, hoverFace = -1;

  // Hover sets
  let rowHoverSurf = [], rowHoverAdd = [], planeHoverSurf = [], planeHoverAdd = [];

  function updateHoverUI() {
    if (hoverVoxel < 0 || hoverFace < 0) {
      hoverInfoEl.textContent = 'Hover: –';
      return; 
    }
    const [x, y, z] = coordsOf(hoverVoxel);
    hoverInfoEl.textContent = `Hover: (${x}, ${y}, ${z}) face ${FACE_LABEL[hoverFace] || '?'}`;
  }

  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();

    // Mode shortcuts
    if (k === 'q') {
      document.getElementById('modePaint').checked = true;
      mode = 'paint';
      return;
    }
    
    if (k === 'w') {
      document.getElementById('modeCarve').checked = true;
      mode = 'carve';
      return;
    }
    
    if (k === 's') {
      document.getElementById('modeAdd').checked = true;
      mode = 'add';
      return;
    }

    if (!e.ctrlKey && k === 'v') {
      document.getElementById('optionVoxel').checked = true;
      option = 'voxel';
      return;
    }

    if (k === 'r') {
      document.getElementById('optionRow').checked = true;
      option = 'row';
      return;
    }

    if (k === 'p') {
      document.getElementById('optionPlane').checked = true;
      option = 'plane';
      return;
    }

    // Undo/Redo
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (k === 'z')) {
      e.preventDefault();
      undo();
      return;
    }

    if ((e.ctrlKey || e.metaKey) && (k === 'y' || (e.shiftKey && (k === 'z')))) {
      e.preventDefault();
      redo();
      return;
    }
  
    // Quick material: 0-9, A-F
    if (/^[0-9]$/.test(k)) selectBrush(parseInt(k, 10));
    else if (/^[a-f]$/i.test(k)) selectBrush(10 + parseInt(k, 16) - 10);
    
    needsPick = true;
  });

  window.addEventListener('keyup', (e) => {
    needsPick = true;
  });

  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  // Edit handlers now produce actions (undoable)
  canvas.addEventListener('mousedown', (e) => {
    canvas.focus();
    const pick = decodePickAt(e.clientX, e.clientY);
    
    // If clicking on empty space, auto-start camera rotation
    if (pick.voxel < 0 || pick.face < 0) {
      if (e.button === 0) {
        dragging = true;
        lastX = e.clientX;
        lastY = e.clientY;
      }
      return;
    }

    if (e.button === 0 && mode === 'paint') {
      // Paint
      if (option == 'plane') {
        const arr = getPlaneSurfaceVoxels(pick.voxel, pick.face);
        if (arr.length > 0) {
          const act = beginVoxelAction('Paint plane');
          for (const id of arr) recordVoxelChange(act, id, true, brushMat);
          commitAction(act);
        }
      } else if (option == 'row') {
        const arr = getRowSurfaceVoxels(pick.voxel, pick.face);
        if (arr.length > 0) {
          const act = beginVoxelAction(`Paint row`);
          for (const id of arr) recordVoxelChange(act, id, true, brushMat);
          commitAction(act);
        }
      } else if (pick.voxel >= 0) {
        const id = idx3(...coordsOf(pick.voxel));
        if (isSolid[id]) {
          const act = beginVoxelAction('Paint voxel');
          recordVoxelChange(act, pick.voxel, true, brushMat);
          commitAction(act);
        }
      }
    } else if (e.button === 0 && mode === 'add') {
        // Add
        if (option == 'plane') {
          const targets = getPlaneAddTargets(pick.voxel, pick.face);
          if (targets.length > 0) {
            const act = beginVoxelAction('Add plane');
            for (const t of targets) recordVoxelChange(act, t, true, brushMat);
            commitAction(act);
          }
        } else if (option == 'row') {
          const targets = getRowAddTargets(pick.voxel, pick.face);
          if (targets.length > 0) {
            const act = beginVoxelAction(`Add row`);
            for (const t of targets) recordVoxelChange(act, t, true, brushMat);
            commitAction(act);
          }
        } else if (pick.voxel >= 0 && pick.face >= 0) {
            const [x, y, z] = coordsOf(pick.voxel);
            const d = FACE_DIRS[pick.face];
            const nx = x + d[0]
            const ny = y + d[1]
            const nz = z + d[2];
            if (within(nx, ny, nz)) {
              const id = idx3(nx, ny, nz);
              if (!isSolid[id]) {
                const act = beginVoxelAction('Add voxel');
                recordVoxelChange(act, id, true, brushMat);
                commitAction(act);
              }
            }
        }

        needsPick = true;

      } else if (e.button === 0 && mode === 'carve') {
        // Remove (or toggle for single)
        if (option == 'plane') {
          const arr = getPlaneSurfaceVoxels(pick.voxel, pick.face);
          const act = beginVoxelAction('Remove plane');
          for (const id of arr) recordVoxelChange(act, id, false, voxelMat[id]);
          commitAction(act);
        } else if (option == 'row') {
          const arr = getRowSurfaceVoxels(pick.voxel, pick.face);
          const act = beginVoxelAction(`Remove row`);
          for (const id of arr) recordVoxelChange(act, id, false, voxelMat[id]);
          commitAction(act);
        } else if (pick.voxel >= 0 && isSolid[pick.voxel]) {
            const act = beginVoxelAction('Remove voxel');
            recordVoxelChange(act, pick.voxel, false, voxelMat[pick.voxel]); // keep existing mat on toggle
            commitAction(act);
        }

        needsPick = true;
    }
  });

  window.addEventListener('mouseup', () => { 
    dragging = false; 
    buttons = 0; 
  });

  window.addEventListener('mousemove', (e) => {
    if (!dragging) { 
      mouseX = e.clientX;
      mouseY = e.clientY;
      needsPick = true; 
    }
    if (dragging) { 
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

  // Add call to updateAxisLabels in render loop
  function render() {
    gl.clearColor(0.07, 0.08, 0.1, 1); 
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(renderProg.program);
    renderProg.uPalette.set(palette);
    renderProg.uModel.set(model);
    renderProg.uView.set(camera.view());
    renderProg.uProj.set(proj);
    renderProg.uNormalMat.set(new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]));
    renderProg.uLightDirWS.set(new Float32Array([0.7 / 1.7, -1.2 / 1.7, 0.9 / 1.7]));
    renderProg.uAmbient.set(ambient);
    gl.bindVertexArray(renderProg.vao); 
    gl.drawElements(gl.TRIANGLES, renderProg.meta.renderIndexCount, gl.UNSIGNED_INT, 0); 
    gl.bindVertexArray(null);

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
          const [x, y, z] = coordsOf(hoverVoxel);
          const d = FACE_DIRS[hoverFace];
          const nx = x + d[0], ny = y + d[1], nz = z + d[2];
          if (within(nx, ny, nz) && !isSolid[idx3(nx, ny, nz)]) drawVoxelWire(idx3(nx, ny, nz), COLOR_ADD, 1.006);
        } else if (mode === 'carve') {
          const [x, y, z] = coordsOf(hoverVoxel);
          const id = idx3(x, y, z);
          if (isSolid[id]) drawVoxelWire(hoverVoxel, COLOR_CARVE, 1.006);
        } else if (mode === 'paint') {
          const [x, y, z] = coordsOf(hoverVoxel);
          const id = idx3(x, y, z);
          if (isSolid[id]) drawVoxelWire(hoverVoxel, COLOR_PAINT, 1.006);
        }
      }
    }
    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
  setTimeout(resize, 0);
}

document.addEventListener('DOMContentLoaded', main);
