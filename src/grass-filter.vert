#version 300 es

precision highp float;

// Input: grid coordinates
in vec2 aGridCoord; // x, z in grid space (0 to gridSize-1)

// Uniforms
uniform sampler2D uGrassTexture;
uniform vec2 uGridMin;
uniform vec2 uGridMax;
uniform float uSpacing;
uniform float uOffsetX;
uniform float uOffsetZ;
uniform int uGridSize;

// Output: filtered instance positions
out vec3 vInstanceOffset;
flat out int vIsVisible;

// Pseudo-random function for consistent offsets
float pseudoRandom(vec2 seed) {
  return fract(sin(dot(seed, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  // Calculate world position for this grid cell
  float seed = aGridCoord.x * 100.0 + aGridCoord.y;
  float randomX = (pseudoRandom(vec2(seed, 0.0)) - 0.5) * 0.16; // ±0.08
  float randomZ = (pseudoRandom(vec2(seed, 1.0)) - 0.5) * 0.16;
  
  float worldX = uOffsetX + aGridCoord.x * uSpacing + randomX;
  float worldZ = uOffsetZ + aGridCoord.y * uSpacing + randomZ;
  
  // Map to texture coordinates
  vec2 uv = (vec2(worldX, worldZ) - uGridMin) / (uGridMax - uGridMin);
  
  // Sample grass mask (R channel)
  float grassMask = texture(uGrassTexture, uv).r;
  
  // Determine if this instance should be visible
  vIsVisible = grassMask > 0.04 ? 1 : 0; // Threshold ~10/255
  
  // Output position (will only be used if visible)
  vInstanceOffset = vec3(worldX, 0.0, worldZ);
  
  // Dummy position (transform feedback doesn't need actual rendering)
  gl_Position = vec4(0.0);
  gl_PointSize = 1.0;
}
