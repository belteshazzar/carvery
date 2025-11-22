
const FACE_DIRS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],[0,0,0]]; // last is for ground plane

class Region {

  constructor(chunk, min, max) {
    this._chunk = chunk;
    this._mask = new Array(chunk.length).fill(false);

    for (let x = min[0]; x <= max[0]; x++) {
      for (let y = min[1]; y <= max[1]; y++) {
        for (let z = min[2]; z <= max[2]; z++) {
          if (!chunk.within(x, y, z)) continue;
          const idx = chunk.idx3(x, y, z);
          this._mask[idx] = true;
        }
      }
    }
  }

  contains(index) {
    return this._mask[index];
  }
}

export class VoxelChunk {

  constructor(size) {
    this._size = size;

    this._isSolid = new Array(size * size * size).fill(true);
    this._material = new Uint8Array(size * size * size);
    this._regions = new Map();
  }

  clearRegions() {
    this._regions.clear();
  }

  addRegion(name,min,max) {
    const region = new Region(this, min, max);
    this._regions.set(name, region);
  }

  fill(value) {
    this._isSolid.fill(value);
  }

  get length() {
    return this._isSolid.length;
  }
  
  isSolid(index) {
    return this._isSolid[index];
  }

  setSolid(index, value) {
    this._isSolid[index] = value;
  }

  material(index) {
    return this._material[index];
  }

  setMaterial(index, value) {
    this._material[index] = value;
  }

  setMaterialAll(value) {
    this._material.fill(value);
  }

  idx3(x, y, z) {
    const sizeX = this._sizeX || this._size;
    const sizeY = this._sizeY || this._size;
    return x + sizeX * (y + sizeY * z);
  }

  within(x, y, z) {
    const sizeX = this._sizeX || this._size;
    const sizeY = this._sizeY || this._size;
    const sizeZ = this._sizeZ || this._size;
    return x >= 0 && y >= 0 && z >= 0 && x < sizeX && y < sizeY && z < sizeZ;
  }

  coordsOf(id) {
    const sizeX = this._sizeX || this._size;
    const sizeY = this._sizeY || this._size;
    const z = Math.floor(id / (sizeX * sizeY));
    const y = Math.floor((id - z * sizeX * sizeY) / sizeX);
    const x = id - z * sizeX * sizeY - y * sizeX;
    return [x, y, z];
  }

  /**
   * Expand the chunk size in one or more dimensions, preserving existing voxel data
   * New voxels are initialized as empty (not solid)
   */
  expandSize(newSizeX, newSizeY, newSizeZ) {
    // Get old dimensions (may be different per axis if already expanded)
    const oldSizeX = this._sizeX || this._size;
    const oldSizeY = this._sizeY || this._size;
    const oldSizeZ = this._sizeZ || this._size;
    const oldIsSolid = this._isSolid;
    const oldMaterial = this._material;

    // Update size dimensions
    this._sizeX = newSizeX;
    this._sizeY = newSizeY;
    this._sizeZ = newSizeZ;
    this._size = Math.max(newSizeX, newSizeY, newSizeZ); // Keep _size for compatibility

    // Create new arrays
    const newLength = newSizeX * newSizeY * newSizeZ;
    this._isSolid = new Array(newLength).fill(false);
    this._material = new Uint8Array(newLength);

    // Copy old data with correct old dimensions
    for (let z = 0; z < oldSizeZ && z < newSizeZ; z++) {
      for (let y = 0; y < oldSizeY && y < newSizeY; y++) {
        for (let x = 0; x < oldSizeX && x < newSizeX; x++) {
          const oldIdx = x + oldSizeX * (y + oldSizeY * z);
          const newIdx = x + newSizeX * (y + newSizeY * z);
          this._isSolid[newIdx] = oldIsSolid[oldIdx];
          this._material[newIdx] = oldMaterial[oldIdx];
        }
      }
    }

    // Clear regions as they would need to be recalculated
    this._regions.clear();
  }

  /**
   * Reset the chunk back to the default 16×16×16 size
   */
  resetSize() {
    const defaultSize = 16;
    this._size = defaultSize;
    this._sizeX = undefined;
    this._sizeY = undefined;
    this._sizeZ = undefined;
    this._isSolid = new Array(defaultSize * defaultSize * defaultSize).fill(true);
    this._material = new Uint8Array(defaultSize * defaultSize * defaultSize);
    this._regions.clear();
  }

  get sizeX() { return this._sizeX || this._size; }
  get sizeY() { return this._sizeY || this._size; }
  get sizeZ() { return this._sizeZ || this._size; }

  faceExposed(x, y, z, f) {
    const d = FACE_DIRS[f], here = this.isSolid(this.idx3(x, y, z)); 
    const nx = x + d[0], ny = y + d[1], nz = z + d[2]; 
    const nb = this.within(nx, ny, nz) ? this.isSolid(this.idx3(nx, ny, nz)) : false; 
    return here && !nb;
  }

  seedMaterials(mode = "bands") {
    const sizeX = this._sizeX || this._size;
    const sizeY = this._sizeY || this._size;
    const sizeZ = this._sizeZ || this._size;
    for (let z = 0; z < sizeZ; z++) {
      for (let y = 0; y < sizeY; y++) {
        for (let x = 0; x < sizeX; x++) {
          const idx = this.idx3(x, y, z);
          const mat = mode === "random" ? ((Math.random() * 16) | 0) : (((x >> 2) + (y >> 2) + (z >> 2)) % 16);
          this.setMaterial(idx, mat);
        }
      }
    }
  }

  buildGreedyRenderMeshMain(gl, renderProg, vao) {
    const isSolid = (idx) => {
      if (!this.isSolid(idx)) return false;
      for (const region of this._regions.values()) {
        if (region.contains(idx)) {
          return false;
        }
      }
      return true;
    }

    return this._buildGreedyRenderMesh(gl, renderProg, vao, isSolid);
  }

  buildGreedyRenderMeshGroup(gl, renderProg, vao, regionName) {
    const region = this._regions.get(regionName);
    const isSolid = (idx) => {
      if (!this.isSolid(idx)) return false;
      if (region && region.contains(idx)) {
        return true;
      }
      return false;
    }

    return this._buildGreedyRenderMesh(gl, renderProg, vao, isSolid);
  }

  _buildGreedyRenderMesh(gl, renderProg, vao, isSolid) {
    const positions = [], normals = [], matIds = [], indices = [];
    let indexBase = 0;

    const sizeX = this._sizeX || this._size;
    const sizeY = this._sizeY || this._size;
    const sizeZ = this._sizeZ || this._size;

    for (let axis = 0; axis < 3; axis++) {
      const u = (axis + 1) % 3, v = (axis + 2) % 3;
      const dims = [sizeX, sizeY, sizeZ];
      
      for (let side = 0; side < 2; side++) {
        const n = [0, 0, 0]; n[axis] = (side === 0 ? 1 : -1);
        for (let k = 0; k <= dims[axis]; k++) {
          const mask = new Array(dims[u] * dims[v]).fill(null);
          for (let j = 0; j < dims[v]; j++) for (let i = 0; i < dims[u]; i++) {
            const c = [0, 0, 0]; c[u] = i; c[v] = j; c[axis] = (side === 0 ? k - 1 : k);
            if (!this.within(c[0], c[1], c[2])) continue;
            const idx = this.idx3(c[0], c[1], c[2]);
            if (!isSolid(idx)) continue;
            const neigh = [c[0] + n[0], c[1] + n[1], c[2] + n[2]];
            if (this.within(neigh[0], neigh[1], neigh[2]) && isSolid(this.idx3(neigh[0], neigh[1], neigh[2]))) continue;
            mask[i + dims[u] * j] = this.material(idx);
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
    gl.bindVertexArray(vao);

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

    return indices.length;
  }


    // Modify buildPickFaces to create separate geometries
  buildPickFaces(gl, pickProg) {
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
    const sizeX = this._sizeX || this._size;
    const sizeZ = this._sizeZ || this._size;
    for (let z = 0; z < sizeZ; z++) for (let x = 0; x < sizeX; x++) for (let fid = 2; fid <= 2; fid++) {
      const vIdx = this.idx3(x, groundY, z);
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

    const sizeY = this._sizeY || this._size;
    for (let z = 0; z < sizeZ; z++) for (let y = 0; y < sizeY; y++) for (let x = 0; x < sizeX; x++) {
      const vIdx = this.idx3(x, y, z);
      if (!this.isSolid(vIdx)) continue;

      const min = [x, y, z];

      for (const f of faces) {
        if (!this.faceExposed(x, y, z, f.id)) continue;
        
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
}
