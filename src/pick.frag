#version 300 es
precision mediump float;
flat in uint vPacked;
out vec4 fragColor;
void main(){
  uint r=(vPacked)&255u, g=(vPacked>>8)&255u, b=(vPacked>>16)&255u;
  fragColor=vec4(vec3(float(r),float(g),float(b))/255.0,1.0);
}