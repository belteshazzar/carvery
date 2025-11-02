#version 300 es

precision mediump float;

uniform mat4 uModel;
uniform mat4 uView;
uniform mat4 uProj;
in vec3 aPosition;
in vec3 aColor;
out vec3 vColor;

void main() {
  // Scale the gizmo but don't offset it - it should be at origin
  vec3 pos = aPosition;
  gl_Position = uProj * uView * uModel * vec4(pos, 1.0);
  vColor = aColor;
}