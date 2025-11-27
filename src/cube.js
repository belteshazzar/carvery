import { Mat4, Vec3, toRadians } from './math.js';
import { OrbitCamera, createPlane } from './3d.js';
import { createProgram } from './webgl.js';
import lambertFrag from './lambert.frag';
import lambertVert from './lambert.vert';

/*** ======= Single Plane Demo ======= ***/


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

  // Rendering program
  const renderProg = createProgram(gl, lambertVert, lambertFrag);
  const plane = createPlane(1.0, 1.0, 10, 10);

  // Material IDs (all same color - use material 0)
  const matIds = new Uint8Array(plane.positions.length / 3).fill(0);

  // Simple palette with a single color (orange/red)
  const palette = new Float32Array([
    1.0, 0.5, 0.2,  // Material 0: Orange
    0.0, 1.0, 0.0,  // Material 1: Green (unused)
    0.0, 0.0, 1.0,  // Material 2: Blue (unused)
    1.0, 1.0, 0.0,  // Material 3: Yellow (unused)
    1.0, 0.0, 1.0,  // Material 4: Magenta (unused)
    0.0, 1.0, 1.0,  // Material 5: Cyan (unused)
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

  // Setup VAO
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);

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
  gl.bufferData(gl.ARRAY_BUFFER, matIds, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(renderProg.aMatId.location);
  gl.vertexAttribIPointer(renderProg.aMatId.location, 1, gl.UNSIGNED_BYTE, 0, 0);

  // Index buffer
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, plane.indices, gl.STATIC_DRAW);
  gl.bindVertexArray(null);

  // Camera setup
  const camera = new OrbitCamera();
  camera.target = Vec3.create(0, 0, 0);
  camera.radius = 3;
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

  // Render loop
  function render() {
    requestAnimationFrame(render);

    // Clear
    gl.clearColor(0.53, 0.81, 0.92, 1.0); // Sky blue background
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Projection matrix
    const aspect = canvas.width / canvas.height;
    const proj = Mat4.perspective(toRadians(45), aspect, 0.1, 1000);

    // View matrix
    const view = camera.view();

    // Model matrix (identity)
    const model = Mat4.identity();

    // Normal matrix (upper-left 3x3 of model matrix)
    const normalMat = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);

    // Set uniforms and draw
    gl.useProgram(renderProg.program);
    gl.bindVertexArray(vao);

    renderProg.uModel.set(model);
    renderProg.uView.set(view);
    renderProg.uProj.set(proj);
    renderProg.uNormalMat.set(normalMat);
    renderProg.uPalette.set(palette);
    renderProg.uLightDirWS.set(new Float32Array([0.7 / 1.7, -1.2 / 1.7, 0.9 / 1.7]));
    renderProg.uAmbient.set(0.22);

    gl.drawElements(gl.TRIANGLES, plane.indices.length, gl.UNSIGNED_INT, 0);

    gl.bindVertexArray(null);
  }

  render();
}

main();
