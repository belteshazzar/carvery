#version 300 es
precision mediump float;
in vec3 aPosition;
uniform mat4 uModel, uView, uProj;
uniform vec3 uOffset;     // world center of box
uniform vec3 uScaleVec;   // world size (sx, sy, sz)
uniform float uInflate;
void main(){
  vec3 p = (aPosition * uInflate) * uScaleVec + uOffset;
  gl_Position = uProj * uView * uModel * vec4(p, 1.0);
}