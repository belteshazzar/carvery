#version 300 es

precision mediump float;

in vec3 vNormalWS;
flat in uint vMatId;

uniform vec3 uPalette[16];
uniform vec3 uLightDirWS;
uniform float uAmbient;

out vec4 fragColor;

void main(){
  vec3 base = uPalette[int(vMatId)];
  float NdotL = max(dot(normalize(vNormalWS), normalize(-uLightDirWS)), 0.0);
  float lambert = uAmbient + (1.0 - uAmbient) * NdotL;
  vec3 rgb = pow(base * lambert, vec3(1.0/1.8));
  fragColor = vec4(rgb, 0.5);
}