import { Mat4, Vec3, toRadians } from './math.js';
import { OrbitCamera, createPlane, createGrassBlade, makeParticleCube } from './3d.js';
import { createProgram } from './webgl.js';
import lambertFrag from './lambert.frag';
import lambertVert from './lambert.vert';
import grassVert from './grass.vert';

/*** ======= Grass Plane Demo ======= ***/

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

  // Rendering programs
  const renderProg = createProgram(gl, lambertVert, lambertFrag);
  const grassProg = createProgram(gl, grassVert, lambertFrag);
  const plane = createPlane(20.0, 20.0, 1, 1); // Increased from 2.0 to 20.0
  const grass = createGrassBlade();
  const cube = makeParticleCube();

  // Grid constants
  const gridSize = 100; // Increased from 10 to 100 (10x in each direction)
  const spacing = 0.2;
  const offsetX = -gridSize * spacing / 2;
  const offsetZ = -gridSize * spacing / 2;
  const gridMinX = offsetX;
  const gridMaxX = offsetX + gridSize * spacing;
  const gridMinZ = offsetZ;
  const gridMaxZ = offsetZ + gridSize * spacing;

  // Create grass texture with two channels:
  // R channel = grass placement mask (0 = no grass, 255 = full grass)
  // G channel = cut amount (0 = full height, 255 = fully cut)
  const grassTextureSize = 256;
  const grassTextureData = new Uint8Array(grassTextureSize * grassTextureSize * 2);
  
  // Initialize with a pattern: circular patches of grass
  function createGrassPattern() {
    for (let y = 0; y < grassTextureSize; y++) {
      for (let x = 0; x < grassTextureSize; x++) {
        const idx = (y * grassTextureSize + x) * 2;
        
        // Normalize coordinates to -1 to 1
        const nx = (x / grassTextureSize) * 2 - 1;
        const ny = (y / grassTextureSize) * 2 - 1;
        
        // Create interesting grass pattern with circles and noise
        let grassValue = 0;
        
        // Add some circular patches
        const patches = [
          { cx: 0, cy: 0, r: 0.8 },
          { cx: -0.5, cy: 0.5, r: 0.3 },
          { cx: 0.6, cy: -0.4, r: 0.25 },
          { cx: -0.3, cy: -0.6, r: 0.2 }
        ];
        
        for (const patch of patches) {
          const dx = nx - patch.cx;
          const dy = ny - patch.cy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < patch.r) {
            const falloff = 1 - (dist / patch.r);
            grassValue = Math.max(grassValue, falloff);
          }
        }
        
        // Add some noise for variation
        const noiseX = Math.sin(nx * 10 + ny * 7) * 0.5 + 0.5;
        const noiseY = Math.cos(ny * 8 + nx * 6) * 0.5 + 0.5;
        grassValue *= (0.7 + noiseX * noiseY * 0.3);
        
        grassTextureData[idx] = Math.floor(grassValue * 255); // R: grass placement
        grassTextureData[idx + 1] = 0; // G: cut amount (initially 0)
      }
    }
  }
  
  createGrassPattern();
  
  const grassTexture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, grassTexture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG8, grassTextureSize, grassTextureSize, 0, gl.RG, gl.UNSIGNED_BYTE, grassTextureData);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  // Function to save grass texture as PNG
  function saveGrassTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = grassTextureSize;
    canvas.height = grassTextureSize;
    const ctx = canvas.getContext('2d');
    const imageData = ctx.createImageData(grassTextureSize, grassTextureSize);
    
    for (let i = 0; i < grassTextureSize * grassTextureSize; i++) {
      const texIdx = i * 2;
      const imgIdx = i * 4;
      imageData.data[imgIdx] = grassTextureData[texIdx];     // R: grass placement
      imageData.data[imgIdx + 1] = grassTextureData[texIdx + 1]; // G: cut amount
      imageData.data[imgIdx + 2] = 0;                        // B: unused
      imageData.data[imgIdx + 3] = 255;                      // A: opaque
    }
    
    ctx.putImageData(imageData, 0, 0);
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'grass-texture.png';
      a.click();
      URL.revokeObjectURL(url);
    });
  }
  
  // Function to load grass texture from image
  function loadGrassTexture(imageUrl) {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = grassTextureSize;
      canvas.height = grassTextureSize;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, grassTextureSize, grassTextureSize);
      const imageData = ctx.getImageData(0, 0, grassTextureSize, grassTextureSize);
      
      for (let i = 0; i < grassTextureSize * grassTextureSize; i++) {
        const imgIdx = i * 4;
        const texIdx = i * 2;
        grassTextureData[texIdx] = imageData.data[imgIdx];     // R: grass placement
        grassTextureData[texIdx + 1] = imageData.data[imgIdx + 1]; // G: cut amount
      }
      
      gl.bindTexture(gl.TEXTURE_2D, grassTexture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG8, grassTextureSize, grassTextureSize, 0, gl.RG, gl.UNSIGNED_BYTE, grassTextureData);
      
      // Refilter instances when texture is loaded
      filteredInstances = filterGrassInstances();
      visibleInstanceCount = filteredInstances.length / 3;
      console.log(`Grass instances refiltered: ${visibleInstanceCount} / ${gridSize * gridSize}`);
      
      // Update instance buffer
      gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, filteredInstances, gl.DYNAMIC_DRAW);
    };
    img.src = imageUrl;
  }
  loadGrassTexture("http://localhost:5173/grass-texture.png")
  
  // Expose functions globally for UI
  window.saveGrassTexture = saveGrassTexture;
  window.loadGrassTexture = loadGrassTexture;

  // Material IDs for plane (brown)
  const planeMatIds = new Uint8Array(plane.positions.length / 3).fill(0);
  
  // Material IDs for grass (green)
  const grassMatIds = new Uint8Array(grass.positions.length / 3).fill(1);
  
  // Material IDs for cube (red)
  const cubeMatIds = new Uint8Array(cube.positions.length / 3).fill(2);

  // Palette with brown, green, and red
  const palette = new Float32Array([
    0.5, 0.35, 0.2,  // Material 0: Dark brown/dirt
    0.3, 0.6, 0.2,   // Material 1: Grass green
    0.8, 0.2, 0.2,   // Material 2: Red cube
    0.0, 0.0, 1.0,  // Material 3: Blue (unused)
    1.0, 1.0, 0.0,  // Material 4: Yellow (unused)
    1.0, 0.0, 1.0,  // Material 5: Magenta (unused)
    0.0, 1.0, 1.0,  // Material 6: Cyan (unused)
    1.0, 1.0, 1.0,  // Material 6: White (unused)
    0.5, 0.5, 0.5,  // Material 7: Gray (unused)
    1.0, 0.0, 0.0,  // Material 8: Red (unused)
    0.0, 0.5, 0.0,  // Material 9: Dark Green (unused)
    0.0, 0.0, 0.5,  // Material 10: Dark Blue (unused)
    0.5, 0.5, 0.0,  // Material 11: Dark Yellow (unused)
    0.5, 0.0, 0.5,  // Material 12: Dark Magenta (unused)
    0.0, 0.5, 0.5,  // Material 13: Dark Cyan (unused)
    0.8, 0.8, 0.8,  // Material 14: Light Gray (unused)
    0.3, 0.3, 0.3   // Material 15: Dark Gray (unused)
  ]);

  // Setup VAO for plane
  const planeVao = gl.createVertexArray();
  gl.bindVertexArray(planeVao);

  // Position buffer
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, plane.positions, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(renderProg.aPosition.location);
  gl.vertexAttribPointer(renderProg.aPosition.location, 3, gl.FLOAT, false, 0, 0);

  // Normal buffer
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, plane.normals, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(renderProg.aNormal.location);
  gl.vertexAttribPointer(renderProg.aNormal.location, 3, gl.FLOAT, false, 0, 0);

  // Material ID buffer
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, planeMatIds, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(renderProg.aMatId.location);
  gl.vertexAttribIPointer(renderProg.aMatId.location, 1, gl.UNSIGNED_BYTE, 0, 0);

  // Index buffer
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, plane.indices, gl.STATIC_DRAW);
  gl.bindVertexArray(null);

  // Setup VAO for grass with instanced rendering
  const grassVao = gl.createVertexArray();
  gl.bindVertexArray(grassVao);

  // Position buffer (shared geometry)
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, grass.positions, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(grassProg.aPosition.location);
  gl.vertexAttribPointer(grassProg.aPosition.location, 3, gl.FLOAT, false, 0, 0);

  // Normal buffer (shared geometry)
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, grass.normals, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(grassProg.aNormal.location);
  gl.vertexAttribPointer(grassProg.aNormal.location, 3, gl.FLOAT, false, 0, 0);

  // Material ID buffer (shared geometry)
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, grassMatIds, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(grassProg.aMatId.location);
  gl.vertexAttribIPointer(grassProg.aMatId.location, 1, gl.UNSIGNED_BYTE, 0, 0);

  // Function to filter grass instances based on texture mask
  function filterGrassInstances() {
    const visibleInstances = [];
    
    for (let x = 0; x < gridSize; x++) {
      for (let z = 0; z < gridSize; z++) {
        const seed = x * 100 + z;
        const randomX = ((seed * 12.9898) % 1) * 0.08 - 0.04;
        const randomZ = ((seed * 78.233) % 1) * 0.08 - 0.04;
        
        const worldX = offsetX + x * spacing + randomX;
        const worldZ = offsetZ + z * spacing + randomZ;
        
        // Map to texture coordinates
        const uvX = (worldX - gridMinX) / (gridMaxX - gridMinX);
        const uvZ = (worldZ - gridMinZ) / (gridMaxZ - gridMinZ);
        
        // Sample grass texture at this position
        const texX = Math.floor(uvX * grassTextureSize);
        const texZ = Math.floor(uvZ * grassTextureSize);
        const texIdx = (texZ * grassTextureSize + texX) * 2;
        
        // Check if grass exists at this position (R channel > threshold)
        const grassMask = grassTextureData[texIdx];
        if (grassMask > 10) { // Threshold ~4% (10/255)
          visibleInstances.push(worldX, 0, worldZ);
        }
      }
    }
    
    return new Float32Array(visibleInstances);
  }
  
  // Initial filtering
  let filteredInstances = filterGrassInstances();
  let visibleInstanceCount = filteredInstances.length / 3;
  
  console.log(`Grass instances: ${visibleInstanceCount} / ${gridSize * gridSize} (${(visibleInstanceCount / (gridSize * gridSize) * 100).toFixed(1)}% visible)`);
  
  // Instance offset buffer (dynamic, filtered positions)
  const instanceBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, filteredInstances, gl.DYNAMIC_DRAW); // DYNAMIC since it may change
  
  // Add instance offset attribute
  const aInstanceOffset = gl.getAttribLocation(grassProg.program, 'aInstanceOffset');
  if (aInstanceOffset >= 0) {
    gl.enableVertexAttribArray(aInstanceOffset);
    gl.vertexAttribPointer(aInstanceOffset, 3, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(aInstanceOffset, 1); // This attribute advances per instance
  }

  // Index buffer
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, grass.indices, gl.STATIC_DRAW);
  gl.bindVertexArray(null);

  // Setup VAO for cube
  const cubeVao = gl.createVertexArray();
  gl.bindVertexArray(cubeVao);

  // Position buffer
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, cube.positions, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(renderProg.aPosition.location);
  gl.vertexAttribPointer(renderProg.aPosition.location, 3, gl.FLOAT, false, 0, 0);

  // Normal buffer
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, cube.normals, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(renderProg.aNormal.location);
  gl.vertexAttribPointer(renderProg.aNormal.location, 3, gl.FLOAT, false, 0, 0);

  // Material ID buffer
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, cubeMatIds, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(renderProg.aMatId.location);
  gl.vertexAttribIPointer(renderProg.aMatId.location, 1, gl.UNSIGNED_BYTE, 0, 0);

  // Index buffer
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, cube.indices, gl.STATIC_DRAW);
  gl.bindVertexArray(null);

  // Cube position and rotation
  const cubePos = { x: 0, y: 0.15, z: 0 };
  let cubeRotation = 0; // Y-axis rotation in radians
  const cubeSize = 0.3;
  const cubePivotOffset = -cubeSize / 2; // Pivot point offset for forklift-style steering
  const cubeSpeed = 0.05;
  const rotationSpeed = 0.05; // Radians per frame

  // Keyboard state
  const keys = {};
  window.addEventListener('keydown', (e) => {
    keys[e.key] = true;
  });
  window.addEventListener('keyup', (e) => {
    keys[e.key] = false;
  });

  // Function to update grass texture based on cube position (cuts grass in G channel)
  function updateCutTexture() {
    // Calculate cube bounds in world space (full extents)
    const minX = cubePos.x - cubeSize / 2;
    const maxX = cubePos.x + cubeSize / 2;
    const minZ = cubePos.z - cubeSize / 2;
    const maxZ = cubePos.z + cubeSize / 2;
    
    // Convert to texture coordinates
    const texMinX = Math.floor(((minX - gridMinX) / (gridMaxX - gridMinX)) * grassTextureSize);
    const texMaxX = Math.ceil(((maxX - gridMinX) / (gridMaxX - gridMinX)) * grassTextureSize);
    const texMinZ = Math.floor(((minZ - gridMinZ) / (gridMaxZ - gridMinZ)) * grassTextureSize);
    const texMaxZ = Math.ceil(((maxZ - gridMinZ) / (gridMaxZ - gridMinZ)) * grassTextureSize);
    
    // Mark affected pixels as fully cut (G channel = 255)
    let updated = false;
    for (let z = Math.max(0, texMinZ); z < Math.min(grassTextureSize, texMaxZ); z++) {
      for (let x = Math.max(0, texMinX); x < Math.min(grassTextureSize, texMaxX); x++) {
        const idx = (z * grassTextureSize + x) * 2 + 1; // G channel
        if (grassTextureData[idx] !== 255) {
          grassTextureData[idx] = 255; // Set to maximum cut value immediately
          updated = true;
        }
      }
    }
    
    // Update texture if changed
    if (updated) {
      gl.bindTexture(gl.TEXTURE_2D, grassTexture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG8, grassTextureSize, grassTextureSize, 0, gl.RG, gl.UNSIGNED_BYTE, grassTextureData);
    }
  }

  // Function to calculate percentage of grass cut
  function calculateCutPercentage() {
    let totalGrass = 0;
    let cutGrass = 0;
    const totalPixels = grassTextureSize * grassTextureSize;
    
    for (let i = 0; i < totalPixels; i++) {
      const idx = i * 2;
      const grassAmount = grassTextureData[idx]; // R channel
      const cutAmount = grassTextureData[idx + 1]; // G channel
      
      if (grassAmount > 0) {
        totalGrass += grassAmount;
        cutGrass += (grassAmount / 255) * cutAmount;
      }
    }
    
    return totalGrass > 0 ? (cutGrass / totalGrass) * 100 : 0;
  }

  // Camera setup
  const camera = new OrbitCamera();
  camera.target = Vec3.create(0, 0, 0);
  camera.radius = 4;
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

  // Resize handling
  function resize() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
  window.addEventListener('resize', resize);
  resize();

  // Cache reusable objects to reduce allocations
  const lightDir = new Float32Array([0.7 / 1.7, -1.2 / 1.7, 0.9 / 1.7]);
  const gridMinVec = new Float32Array([gridMinX, gridMinZ]);
  const gridMaxVec = new Float32Array([gridMaxX, gridMaxZ]);

  // Render loop
  let startTime = performance.now();
  
  function render() {
    requestAnimationFrame(render);

    const time = (performance.now() - startTime) / 1000.0; // Time in seconds

    // Update cube rotation and position based on keyboard input
    // For forklift-style steering, rotate around the front pivot point
    
    // Check if moving forward or backward
    const isMoving = keys['ArrowUp'] || keys['w'] || keys['ArrowDown'] || keys['s'];
    
    // Only allow turning while moving (like a real vehicle)
    if (isMoving) {
      if (keys['ArrowLeft']) {
        cubeRotation += rotationSpeed;
      }
      if (keys['ArrowRight']) {
        cubeRotation -= rotationSpeed;
      }
    }
    
    // Forward and backward movement in the direction the cube is facing
    // Move the front pivot point, not the center
    let frontPivotX = cubePos.x + Math.sin(cubeRotation) * cubePivotOffset;
    let frontPivotZ = cubePos.z + Math.cos(cubeRotation) * cubePivotOffset;
    
    if (keys['ArrowUp'] || keys['w']) {
      frontPivotX += Math.sin(cubeRotation) * cubeSpeed;
      frontPivotZ += Math.cos(cubeRotation) * cubeSpeed;
    }
    if (keys['ArrowDown'] || keys['s']) {
      frontPivotX -= Math.sin(cubeRotation) * cubeSpeed;
      frontPivotZ -= Math.cos(cubeRotation) * cubeSpeed;
    }
    
    // Strafe left and right (A/D keys)
    if (keys['a']) {
      frontPivotX += Math.cos(cubeRotation) * cubeSpeed;
      frontPivotZ -= Math.sin(cubeRotation) * cubeSpeed;
    }
    if (keys['d']) {
      frontPivotX -= Math.cos(cubeRotation) * cubeSpeed;
      frontPivotZ += Math.sin(cubeRotation) * cubeSpeed;
    }
    
    // Update cube center position based on front pivot
    cubePos.x = frontPivotX - Math.sin(cubeRotation) * cubePivotOffset;
    cubePos.z = frontPivotZ - Math.cos(cubeRotation) * cubePivotOffset;
    
    // Clamp cube to grid bounds
    cubePos.x = Math.max(gridMinX + cubeSize/2, Math.min(gridMaxX - cubeSize/2, cubePos.x));
    cubePos.z = Math.max(gridMinZ + cubeSize/2, Math.min(gridMaxZ - cubeSize/2, cubePos.z));
    
    // Update cut texture
    updateCutTexture();
    
    // Update UI with cut percentage (throttle to once per second)
    if (Math.floor(time) !== Math.floor(time - 1/60)) {
      const cutPercent = calculateCutPercentage();
      const percentElem = document.getElementById('cutPercentage');
      if (percentElem) {
        percentElem.textContent = `Grass cut: ${cutPercent.toFixed(1)}%`;
      }
    }

    // Clear
    gl.clearColor(0.53, 0.81, 0.92, 1.0); // Sky blue background
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Projection matrix
    const aspect = canvas.width / canvas.height;
    const proj = Mat4.perspective(toRadians(45), aspect, 0.1, 1000);

    // View matrix
    const view = camera.view();

    // Normal matrix (upper-left 3x3 of model matrix)
    const normalMat = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);

    // Draw ground plane
    gl.useProgram(renderProg.program);
    renderProg.uView.set(view);
    renderProg.uProj.set(proj);
    renderProg.uNormalMat.set(normalMat);
    renderProg.uPalette.set(palette);
    renderProg.uLightDirWS.set(lightDir);
    renderProg.uAmbient.set(0.22);
    
    gl.bindVertexArray(planeVao);
    const planeModel = Mat4.identity();
    renderProg.uModel.set(planeModel);
    gl.drawElements(gl.TRIANGLES, plane.indices.length, gl.UNSIGNED_INT, 0);

    // Draw grass blades with instanced rendering (single draw call)
    gl.useProgram(grassProg.program);
    grassProg.uView.set(view);
    grassProg.uProj.set(proj);
    grassProg.uNormalMat.set(normalMat);
    grassProg.uPalette.set(palette);
    grassProg.uLightDirWS.set(lightDir);
    grassProg.uAmbient.set(0.22);
    grassProg.uTime.set(time);
    
    // Bind grass texture
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, grassTexture);
    grassProg.uCutTexture.set(0);
    grassProg.uGridMin.set(gridMinVec);
    grassProg.uGridMax.set(gridMaxVec);
    
    gl.bindVertexArray(grassVao);
    grassProg.uModel.set(Mat4.identity());
    
    // Single instanced draw call with only visible instances
    gl.drawElementsInstanced(gl.TRIANGLES, grass.indices.length, gl.UNSIGNED_SHORT, 0, visibleInstanceCount);

    // Draw cube
    gl.useProgram(renderProg.program);
    renderProg.uView.set(view);
    renderProg.uProj.set(proj);
    renderProg.uNormalMat.set(normalMat);
    renderProg.uPalette.set(palette);
    renderProg.uLightDirWS.set(lightDir);
    renderProg.uAmbient.set(0.22);
    
    gl.bindVertexArray(cubeVao);
    // Create cube model matrix with rotation around front pivot (forklift-style)
    // 1. Translate to cube center
    // 2. Translate forward by pivot offset
    // 3. Rotate around Y-axis
    // 4. Translate back by pivot offset
    const translateToCenter = Mat4.translate(cubePos.x, cubePos.y, cubePos.z);
    const translateToPivot = Mat4.translate(
      Math.sin(cubeRotation) * cubePivotOffset,
      0,
      Math.cos(cubeRotation) * cubePivotOffset
    );
    const rotate = Mat4.rotationY(cubeRotation);
    const translateBack = Mat4.translate(
      -Math.sin(cubeRotation) * cubePivotOffset,
      0,
      -Math.cos(cubeRotation) * cubePivotOffset
    );
    const cubeModel = Mat4.multiply(translateToCenter, translateToPivot, rotate, translateBack);
    renderProg.uModel.set(cubeModel);
    gl.drawElements(gl.TRIANGLES, cube.indices.length, gl.UNSIGNED_SHORT, 0);

    gl.bindVertexArray(null);
  }

  render();
}

main();
