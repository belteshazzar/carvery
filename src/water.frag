#version 300 es

precision mediump float;

in vec3 vNormalWS;
in vec3 vWorldPos;
flat in uint vMatId;

uniform vec3 uPalette[16];
uniform vec3 uLightDirWS;
uniform float uAmbient;
uniform vec3 uCameraPos;

out vec4 fragColor;

void main(){
  vec3 base = uPalette[int(vMatId)];
  
  // Lighting
  float NdotL = max(dot(normalize(vNormalWS), normalize(-uLightDirWS)), 0.0);
  float lambert = uAmbient + (1.0 - uAmbient) * NdotL;
  
  // Fresnel effect - water is more reflective at grazing angles
  vec3 viewDir = normalize(uCameraPos - vWorldPos);
  float fresnel = pow(1.0 - abs(dot(normalize(vNormalWS), viewDir)), 3.0);
  
  // Add slight brightness at edges (like water reflections)
  vec3 waterColor = base * lambert + vec3(0.2) * fresnel;
  
  // Variable transparency - more transparent when viewed straight on
  float alpha = mix(0.3, 0.7, fresnel);
  
  vec3 rgb = pow(waterColor, vec3(1.0/1.8));
  fragColor = vec4(rgb, alpha);
}
