#version 300 es

precision mediump float;

out vec4 fragColor;

void main() {
  // This shader is not used (transform feedback only)
  fragColor = vec4(0.0);
}
