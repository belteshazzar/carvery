#version 300 es

precision mediump float;

in vec3 aPosition;
in vec3 aNormal;
in uint aMatId;
in vec3 aInstanceOffset; // Per-instance offset for positioning

uniform mat4 uModel, uView, uProj;
uniform mat3 uNormalMat;
uniform float uTime;
uniform sampler2D uCutTexture;
uniform vec2 uGridMin;
uniform vec2 uGridMax;

out vec3 vNormalWS;
flat out uint vMatId;

void main(){
  vec3 pos = aPosition;
  
  // Apply instance offset to position grass blade
  pos += aInstanceOffset;
  
  // Calculate world position to check grass texture
  vec4 worldPos = uModel * vec4(pos, 1.0);
  
  // Map world position to texture coordinates
  vec2 uv = (worldPos.xz - uGridMin) / (uGridMax - uGridMin);
  
  // Sample grass texture
  // R channel = grass placement mask (0 = no grass, 1 = full grass)
  // G channel = cut amount (0 = full height, 1 = fully cut)
  vec2 grassData = texture(uCutTexture, uv).rg;
  float grassMask = grassData.r;
  float cutAmount = grassData.g;
  
  // Scale grass based on placement mask and cut amount
  float heightScale = grassMask * (1.0 - cutAmount * 0.8); // Cut grass is 20% of original height
  pos.y *= heightScale;
  
  // Apply wave displacement to vertices based on height
  // Only affect the top vertices (y > 0.1) and reduce wave for cut grass
  if (pos.y > 0.1) {
    // Create wave motion using position and time
    worldPos = uModel * vec4(pos, 1.0);
    float wave1 = sin(worldPos.x * 3.0 + uTime * 2.0) * 0.03;
    float wave2 = sin(worldPos.z * 2.5 + uTime * 1.7) * 0.025;
    
    // Scale displacement by height and cut amount (cut grass waves less)
    float heightFactor = pos.y / 0.3;
    float waveFactor = heightScale;
    pos.x += (wave1 + wave2) * heightFactor * waveFactor;
    pos.z += (wave1 * 0.7 - wave2 * 0.8) * heightFactor * waveFactor;
  }
  
  worldPos = uModel * vec4(pos, 1.0);
  vNormalWS = normalize(uNormalMat * aNormal);
  vMatId = aMatId;
  gl_Position = uProj * uView * worldPos;
}
