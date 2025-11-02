#version 300 es

precision mediump float;

in vec3 aPosition;
in vec3 aNormal;
in uint aMatId;

uniform mat4 uModel, uView, uProj;
uniform mat3 uNormalMat;

out vec3 vNormalWS;
flat out uint vMatId;

void main(){
  vec4 worldPos = uModel * vec4(aPosition, 1.0);
  vNormalWS = normalize(uNormalMat * aNormal);
  vMatId = aMatId;
  gl_Position = uProj * uView * worldPos;
}