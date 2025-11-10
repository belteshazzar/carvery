#version 300 es

precision highp float;

in vec3 aPosition;
in vec3 aNormal;
in uint aMatId;

uniform mat4 uView, uProj;
uniform sampler2D uParticleData;  // RGBA texture storing particle data
//uniform int uParticleCount;
uniform int uTextureWidth;        // Width of the particle data texture

out vec3 vNormalWS;
flat out uint vMatId;
flat out float vAlpha;

// Fetch particle data from texture
// Layout per particle (2 pixels):
//   Pixel 0: RGB = position, A = size
//   Pixel 1: R = color (as float), G = alpha, BA = unused
void main(){
  int instanceId = gl_InstanceID;
  
  // Calculate texture coordinates for this particle
  int particleIndex = instanceId * 2;  // 2 pixels per particle
  int pixelX0 = particleIndex % uTextureWidth;
  int pixelY0 = particleIndex / uTextureWidth;
  int pixelX1 = (particleIndex + 1) % uTextureWidth;
  int pixelY1 = (particleIndex + 1) / uTextureWidth;
  
  // Fetch particle data from texture (use texelFetch for pixel-perfect lookup)
  vec4 data0 = texelFetch(uParticleData, ivec2(pixelX0, pixelY0), 0);
  vec4 data1 = texelFetch(uParticleData, ivec2(pixelX1, pixelY1), 0);
  
  // Extract particle properties
  vec3 particlePos = data0.rgb;
  float particleSize = data0.a;
  vMatId = uint(data1.r * 255.0);  // Color stored as normalized float
  vAlpha = data1.g;
  
  // Scale and translate the cube vertex
  vec3 worldPos = particlePos + aPosition * particleSize;
  vNormalWS = aNormal;
  
  gl_Position = uProj * uView * vec4(worldPos, 1.0);
}
