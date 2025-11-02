#version 300 es
precision mediump float;
in vec3 aPosition;
in uint aPacked; // ((voxelIdx+1)<<3) | faceId
uniform mat4 uModel, uView, uProj;
flat out uint vPacked;
void main(){
  vPacked = aPacked;
  gl_Position = uProj * uView * uModel * vec4(aPosition, 1.0);
}