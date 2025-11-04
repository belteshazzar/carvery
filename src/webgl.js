

const GL_TYPES = new Map();

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

  if (GL_TYPES.size === 0) {
    // Populate GL_TYPES map
    for (const key in gl) {
      if (typeof gl[key] === 'number') {
        GL_TYPES.set(gl[key], key);
      }
    }
  }

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
  const res = {
    program: p,
    meta: {},
    vao: gl.createVertexArray()
  };

  const numAttribs = gl.getProgramParameter(p, gl.ACTIVE_ATTRIBUTES);

  for (let i = 0; i < numAttribs; i++) {
      const attribInfo = gl.getActiveAttrib(p, i);
      // attribInfo contains:
      // - name: The name of the attribute (e.g., "a_position")
      // - type: The GLSL type of the attribute (e.g., gl.FLOAT_VEC3)
      // - size: The size of the attribute (e.g., 1 for a single vector)
      
      // Get the location of the attribute
      const location = gl.getAttribLocation(p, attribInfo.name);

      res[nameOf(attribInfo.name)] = {
        kind: 'attribute',
        location,
        type: attribInfo.type,
        typeName: GL_TYPES.get(attribInfo.type),
        size: attribInfo.size
      };
  }

  const numUniforms = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);

  for (let i = 0; i < numUniforms; i++) {
      const uniformInfo = gl.getActiveUniform(p, i);
      // uniformInfo contains:
      // - name: The name of the uniform (e.g., "u_matrix")
      // - type: The GLSL type of the uniform (e.g., gl.FLOAT_MAT4)
      // - size: The size of the uniform (e.g., 1 for a single matrix, or array length)

      // Get the location of the uniform
      const location = gl.getUniformLocation(p, uniformInfo.name);

      res[nameOf(uniformInfo.name)] = {
        kind: 'uniform',
        location,
        type: uniformInfo.type,
        typeName: GL_TYPES.get(uniformInfo.type),
        size: uniformInfo.size
      };

      if (uniformInfo.type === gl.FLOAT_MAT4) {
        res[nameOf(uniformInfo.name)].set = function(value) {
          gl.uniformMatrix4fv(location, false, value);
        };
      } else if (uniformInfo.type === gl.FLOAT_MAT3) {
        res[nameOf(uniformInfo.name)].set = function(value) {
          gl.uniformMatrix3fv(location, false, value);
        };
      } else if (uniformInfo.type === gl.FLOAT_VEC3) {
        res[nameOf(uniformInfo.name)].set = function(value) {
          gl.uniform3fv(location, value);
        };
      } else if (uniformInfo.type === gl.FLOAT) {
        res[nameOf(uniformInfo.name)].set = function(value) {
          gl.uniform1f(location, value);
        };
      }
  }

  return res;
}

function nameOf(name) {
  return name.replace(/\[.*\]/, '');
}