/**
 * Creates and compiles a WebGL shader.
 * 
 * @param {WebGLRenderingContext} gl WebGL context
 * @param {number} t Shader type (gl.VERTEX_SHADER or gl.FRAGMENT_SHADER)
 * @param {string} src GLSL source code
 * @returns {WebGLShader} Compiled shader object
 * @throws {Error} If shader compilation fails
 */
function createShader(gl, t, src) {
  const sh = gl.createShader(t);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error('Shader compile failed:\n' + log);
  }
  return sh;
}

/**
 * Creates and links a WebGL program from vertex and fragment shaders.
 * 
 * @param {WebGLRenderingContext} gl WebGL context
 * @param {string} vsSrc Vertex shader GLSL source
 * @param {string} fsSrc Fragment shader GLSL source
 * @returns {WebGLProgram} Linked program object
 * @throws {Error} If shader compilation or program linking fails
 */
export function createProgram(gl, vsSrc, fsSrc) {
  const vs = createShader(gl, gl.VERTEX_SHADER, vsSrc);
  const fs = createShader(gl, gl.FRAGMENT_SHADER, fsSrc);
  const p = gl.createProgram();
  gl.attachShader(p, vs);
  gl.attachShader(p, fs);
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(p);
    gl.deleteProgram(p);
    throw new Error('Program link failed:\n' + log);
  }
  return p;
}
