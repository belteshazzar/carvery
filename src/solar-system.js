import { Mat4, Vec3, toRadians } from './math.js';
import { OrbitCamera, createSphere, createRing } from './3d.js';
import { createProgram } from './webgl.js';
import { SceneNode } from './SceneNode.js';
import lambertFrag from './lambert.frag';
import lambertVert from './lambert.vert';

/*** ======= Solar System Demo ======= ***/

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

  // Create shader program
  const renderProg = createProgram(gl, lambertVert, lambertFrag);

  // Create sphere geometry (shared for all spheres)
  const sphere = createSphere(1.0, 64, 32);
  
  // Create ring geometry (shared for asteroid belt and Saturn rings)
  const ring = createRing(1.0, 1.3, 128, 4);

  // Palette with various colors
  const palette = new Float32Array([
    0.6, 0.4, 0.3,   // Material 0: Brown/Mercury
    0.9, 0.7, 0.4,   // Material 1: Orange/Venus
    0.8, 0.2, 0.2,   // Material 2: Red/Mars
    0.2, 0.4, 0.8,   // Material 3: Blue/Earth
    1.0, 0.8, 0.2,   // Material 4: Yellow/Sun
    0.8, 0.7, 0.5,   // Material 5: Tan/Jupiter
    0.9, 0.8, 0.6,   // Material 6: Beige/Saturn
    0.7, 0.8, 0.9,   // Material 7: Light Blue/Uranus
    0.3, 0.4, 0.8,   // Material 8: Deep Blue/Neptune
    0.5, 0.5, 0.5,   // Material 9: Gray/Moon
    0.6, 0.5, 0.4,   // Material 10: Brown/Gray Asteroid Belt
    0.8, 0.7, 0.5,   // Material 11: Light Tan/Saturn Rings
    0.5, 0.5, 0.0,   // Material 12: Dark Yellow
    0.5, 0.0, 0.5,   // Material 13: Dark Magenta
    0.0, 0.5, 0.5,   // Material 14: Dark Cyan
    0.9, 0.9, 0.9    // Material 15: Light Gray
  ]);

  // Helper function to create a VAO for a sphere with a specific material
  function createSphereVAO(materialId) {
    const matIds = new Uint8Array(sphere.positions.length / 3).fill(materialId);
    
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    // Position buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, sphere.positions, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(renderProg.aPosition.location);
    gl.vertexAttribPointer(renderProg.aPosition.location, 3, gl.FLOAT, false, 0, 0);

    // Normal buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, sphere.normals, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(renderProg.aNormal.location);
    gl.vertexAttribPointer(renderProg.aNormal.location, 3, gl.FLOAT, false, 0, 0);

    // Material ID buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, matIds, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(renderProg.aMatId.location);
    gl.vertexAttribIPointer(renderProg.aMatId.location, 1, gl.UNSIGNED_BYTE, 0, 0);

    // Index buffer
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, sphere.indices, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    
    return { vao, indexCount: sphere.indices.length };
  }

  // Helper function to create a VAO for a ring with a specific material
  function createRingVAO(materialId) {
    const matIds = new Uint8Array(ring.positions.length / 3).fill(materialId);
    
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    // Position buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, ring.positions, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(renderProg.aPosition.location);
    gl.vertexAttribPointer(renderProg.aPosition.location, 3, gl.FLOAT, false, 0, 0);

    // Normal buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, ring.normals, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(renderProg.aNormal.location);
    gl.vertexAttribPointer(renderProg.aNormal.location, 3, gl.FLOAT, false, 0, 0);

    // Material ID buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, matIds, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(renderProg.aMatId.location);
    gl.vertexAttribIPointer(renderProg.aMatId.location, 1, gl.UNSIGNED_BYTE, 0, 0);

    // Index buffer
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, ring.indices, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    
    return { vao, indexCount: ring.indices.length };
  }

  // Create VAOs for different celestial bodies
  const sunMesh = createSphereVAO(4);      // Yellow
  const mercuryMesh = createSphereVAO(0);  // Brown
  const venusMesh = createSphereVAO(1);    // Orange
  const earthMesh = createSphereVAO(3);    // Blue
  const marsMesh = createSphereVAO(2);     // Red
  const jupiterMesh = createSphereVAO(5);  // Tan
  const saturnMesh = createSphereVAO(6);   // Beige
  const uranusMesh = createSphereVAO(7);   // Light Blue
  const neptuneMesh = createSphereVAO(8);  // Deep Blue
  const moonMesh = createSphereVAO(9);     // Gray
  
  // Create ring VAOs
  const asteroidBeltMesh = createRingVAO(10);  // Brown/Gray
  const saturnRingMesh = createRingVAO(11);    // Light Tan

  // Build scene graph
  // Root node (world origin)
  const sceneRoot = new SceneNode('root');

  // Sun node - at the center, slowly rotating on its axis
  const sunNode = new SceneNode('sun', {
    localTransform: Mat4.identity(),
    materialId: 4,
    mesh: sunMesh
  });
  sceneRoot.addChild(sunNode);

  // Mercury - closest to sun
  const mercuryNode = new SceneNode('mercury', {
    localTransform: Mat4.translate(1.5, 0, 0),
    materialId: 0,
    mesh: mercuryMesh
  });
  sunNode.addChild(mercuryNode);

  // Venus
  const venusNode = new SceneNode('venus', {
    localTransform: Mat4.translate(2.2, 0, 0),
    materialId: 1,
    mesh: venusMesh
  });
  sunNode.addChild(venusNode);

  // Earth
  const earthNode = new SceneNode('earth', {
    localTransform: Mat4.translate(3, 0, 0),
    materialId: 3,
    mesh: earthMesh
  });
  sunNode.addChild(earthNode);

  // Moon - orbits around the earth
  const moonNode = new SceneNode('moon', {
    localTransform: Mat4.translate(0.6, 0, 0),
    materialId: 9,
    mesh: moonMesh
  });
  earthNode.addChild(moonNode);

  // Mars
  const marsNode = new SceneNode('mars', {
    localTransform: Mat4.translate(4, 0, 0),
    materialId: 2,
    mesh: marsMesh
  });
  sunNode.addChild(marsNode);

  // Asteroid Belt - between Mars and Jupiter
  const asteroidBeltNode = new SceneNode('asteroidBelt', {
    localTransform: Mat4.scaleMatrix(5, 1, 5), // Scale to position between Mars and Jupiter
    materialId: 10,
    mesh: asteroidBeltMesh
  });
  sunNode.addChild(asteroidBeltNode);

  // Jupiter - largest planet
  const jupiterNode = new SceneNode('jupiter', {
    localTransform: Mat4.translate(7, 0, 0),
    materialId: 5,
    mesh: jupiterMesh
  });
  sunNode.addChild(jupiterNode);

  // Saturn
  const saturnNode = new SceneNode('saturn', {
    localTransform: Mat4.translate(8, 0, 0),
    materialId: 6,
    mesh: saturnMesh
  });
  sunNode.addChild(saturnNode);

  // Saturn's Rings - child of Saturn so they orbit with the planet
  const saturnRingsNode = new SceneNode('saturnRings', {
    localTransform: Mat4.scaleMatrix(1.5, 1, 1.5), // Rings extend beyond planet
    materialId: 11,
    mesh: saturnRingMesh
  });
  saturnNode.addChild(saturnRingsNode);

  // Uranus
  const uranusNode = new SceneNode('uranus', {
    localTransform: Mat4.translate(10, 0, 0),
    materialId: 7,
    mesh: uranusMesh
  });
  sunNode.addChild(uranusNode);

  // Neptune - farthest planet
  const neptuneNode = new SceneNode('neptune', {
    localTransform: Mat4.translate(12, 0, 0),
    materialId: 8,
    mesh: neptuneMesh
  });
  sunNode.addChild(neptuneNode);

  // Camera setup - zoom out to see the entire solar system
  const camera = new OrbitCamera({
    target: [0, 0, 0],
    radius: 20,
    theta: toRadians(45),
    phi: toRadians(60)
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
  const lightDir = new Float32Array([0.7 / 1.7, -1.2 / 1.7, 0.9 / 1.7]);

  // Animation parameters - orbital speeds (approximate relative speeds)
  const mercuryOrbitSpeed = 1.6;  // Mercury is fastest
  const venusOrbitSpeed = 1.2;
  const earthOrbitSpeed = 1.0;
  const marsOrbitSpeed = 0.8;
  const jupiterOrbitSpeed = 0.4;
  const saturnOrbitSpeed = 0.3;
  const uranusOrbitSpeed = 0.2;
  const neptuneOrbitSpeed = 0.15; // Neptune is slowest
  const moonOrbitSpeed = 2.5;     // Moon orbits faster
  const sunRotationSpeed = 0.3;
  
  let startTime = performance.now();

  // Render loop
  function render() {
    requestAnimationFrame(render);
    
    const time = (performance.now() - startTime) / 1000.0; // Time in seconds

    // Update sun rotation (spin on its own axis)
    const sunRotation = Mat4.rotationY(time * sunRotationSpeed);
    sunNode.setLocalTransform(sunRotation);

    // Update Mercury orbit
    const mercuryOrbit = Mat4.multiply(
      Mat4.rotationY(time * mercuryOrbitSpeed),
      Mat4.translate(1.5, 0, 0),
      Mat4.scaleMatrix(0.15, 0.15, 0.15)
    );
    mercuryNode.setLocalTransform(mercuryOrbit);

    // Update Venus orbit
    const venusOrbit = Mat4.multiply(
      Mat4.rotationY(time * venusOrbitSpeed),
      Mat4.translate(2.2, 0, 0),
      Mat4.scaleMatrix(0.25, 0.25, 0.25)
    );
    venusNode.setLocalTransform(venusOrbit);

    // Update Earth orbit
    const earthOrbit = Mat4.multiply(
      Mat4.rotationY(time * earthOrbitSpeed),
      Mat4.translate(3, 0, 0),
      Mat4.scaleMatrix(0.26, 0.26, 0.26)
    );
    earthNode.setLocalTransform(earthOrbit);

    // Update Moon orbit around Earth
    const moonOrbit = Mat4.multiply(
      Mat4.rotationY(time * moonOrbitSpeed),
      Mat4.translate(0.6, 0, 0),
      Mat4.scaleMatrix(0.4, 0.4, 0.4)
    );
    moonNode.setLocalTransform(moonOrbit);

    // Update Mars orbit
    const marsOrbit = Mat4.multiply(
      Mat4.rotationY(time * marsOrbitSpeed),
      Mat4.translate(4, 0, 0),
      Mat4.scaleMatrix(0.2, 0.2, 0.2)
    );
    marsNode.setLocalTransform(marsOrbit);

    // Update Jupiter orbit (largest planet)
    const jupiterOrbit = Mat4.multiply(
      Mat4.rotationY(time * jupiterOrbitSpeed),
      Mat4.translate(7, 0, 0),
      Mat4.scaleMatrix(0.6, 0.6, 0.6)
    );
    jupiterNode.setLocalTransform(jupiterOrbit);

    // Update Saturn orbit
    const saturnOrbit = Mat4.multiply(
      Mat4.rotationY(time * saturnOrbitSpeed),
      Mat4.translate(8, 0, 0),
      Mat4.scaleMatrix(0.5, 0.5, 0.5)
    );
    saturnNode.setLocalTransform(saturnOrbit);

    // Update Uranus orbit
    const uranusOrbit = Mat4.multiply(
      Mat4.rotationY(time * uranusOrbitSpeed),
      Mat4.translate(10, 0, 0),
      Mat4.scaleMatrix(0.35, 0.35, 0.35)
    );
    uranusNode.setLocalTransform(uranusOrbit);

    // Update Neptune orbit
    const neptuneOrbit = Mat4.multiply(
      Mat4.rotationY(time * neptuneOrbitSpeed),
      Mat4.translate(12, 0, 0),
      Mat4.scaleMatrix(0.34, 0.34, 0.34)
    );
    neptuneNode.setLocalTransform(neptuneOrbit);

    // Update world transforms for entire scene graph
    sceneRoot.updateWorldTransform();

    // Clear with space-like black background
    gl.clearColor(0.02, 0.02, 0.05, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Projection matrix
    const aspect = canvas.width / canvas.height;
    const proj = Mat4.perspective(toRadians(45), aspect, 0.1, 1000);

    // View matrix
    const view = camera.view();

    // Setup common shader state
    gl.useProgram(renderProg.program);
    renderProg.uView.set(view);
    renderProg.uProj.set(proj);
    renderProg.uPalette.set(palette);
    renderProg.uLightDirWS.set(lightDir);
    renderProg.uAmbient.set(0.3);

    // Traverse scene graph and render each node with a mesh
    sceneRoot.traverse((node) => {
      if (node.mesh) {
        // Disable culling for rings so they're visible from both sides
        const isRing = node.name === 'asteroidBelt' || node.name === 'saturnRings';
        if (isRing) {
          gl.disable(gl.CULL_FACE);
        }
        
        // Set model matrix to the node's world transform
        renderProg.uModel.set(node.worldTransform);
        
        // Normal matrix (upper-left 3x3 of model matrix, identity for spheres)
        const normalMat = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);
        renderProg.uNormalMat.set(normalMat);
        
        // Draw the mesh
        gl.bindVertexArray(node.mesh.vao);
        gl.drawElements(gl.TRIANGLES, node.mesh.indexCount, gl.UNSIGNED_INT, 0);
        
        // Re-enable culling after rendering rings
        if (isRing) {
          gl.enable(gl.CULL_FACE);
        }
      }
    });

    gl.bindVertexArray(null);
  }

  render();
}

main();
