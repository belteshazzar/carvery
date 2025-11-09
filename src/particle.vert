#version 300 es

precision mediump float;

in vec3 aPosition;
in vec3 aNormal;
in uint aMatId;

uniform mat4 uView, uProj;
uniform vec3 uParticlePositions[1000];
uniform float uParticleSizes[1000];
uniform uint uParticleColors[1000];
uniform float uParticleAlphas[1000];
uniform int uParticleCount;

out vec3 vNormalWS;
flat out uint vMatId;
flat out float vAlpha;

void main(){
  int instanceId = gl_InstanceID;
  
  // Get particle properties
  vec3 particlePos = uParticlePositions[instanceId];
  float particleSize = uParticleSizes[instanceId];
  vMatId = uParticleColors[instanceId];
  vAlpha = uParticleAlphas[instanceId];
  
  // Scale and translate the cube vertex
  vec3 worldPos = particlePos + aPosition * particleSize;
  vNormalWS = aNormal;
  
  gl_Position = uProj * uView * vec4(worldPos, 1.0);
}
