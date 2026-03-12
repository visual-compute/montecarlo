// Fullscreen triangle vertex shader — covers entire viewport with gl_VertexID trick
export const fullscreenVert = `#version 300 es
out vec2 vUv;
void main() {
  vUv = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  gl_Position = vec4(vUv * 2.0 - 1.0, 0.0, 1.0);
}
`

// Progressive path tracer — traces ONE sample per pixel per frame, accumulates
export const pathtracerFrag = `#version 300 es
precision highp float;

in vec2 vUv;

uniform vec2 u_resolution;
uniform float u_frame;
uniform int u_mode; // 0 = uniform hemisphere, 1 = direct light
uniform int u_scene; // 0 = lecture, 1 = studio, 2 = gallery, 3 = noir, 4 = cyber, 5 = sunset
uniform sampler2D u_prevAccum;

layout(location = 0) out vec4 fragColor;

#define PI 3.14159265359
#define TWO_PI 6.28318530718
#define INV_PI 0.31830988618

uint hashU(uint x) {
  x ^= x >> 16u;
  x *= 0x45d9f3bu;
  x ^= x >> 16u;
  x *= 0x45d9f3bu;
  x ^= x >> 16u;
  return x;
}

uint rngState;

void initRNG(vec2 pixel, float frame) {
  rngState = hashU(uint(pixel.x) * 1973u + uint(pixel.y) * 9277u + uint(frame) * 26699u);
}

float rand() {
  rngState = hashU(rngState);
  return float(rngState) / 4294967295.0;
}

vec2 rand2() { return vec2(rand(), rand()); }

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

int getLightCount() {
  if (u_scene >= 4) return 2;
  return 1;
}

float lightIdFromIndex(int idx) {
  return idx == 0 ? 3.0 : 8.0;
}

int lightIndexFromId(float id) {
  return id > 7.0 ? 1 : 0;
}

vec3 getLightCenter(int idx) {
  if (u_scene == 1) return vec3(-1.2, 5.2, -2.4);
  if (u_scene == 2) return vec3(0.4, 5.8, -3.7);
  if (u_scene == 3) return vec3(2.0, 4.9, -3.0);
  if (u_scene == 4) {
    if (idx == 0) return vec3(-1.9, 5.4, -2.9);
    return vec3(2.1, 5.1, -4.3);
  }
  if (u_scene == 5) {
    if (idx == 0) return vec3(-2.0, 4.8, -2.2);
    return vec3(1.8, 5.7, -5.1);
  }
  return vec3(0.0, 5.0, -1.0);
}

vec2 getLightHalf(int idx) {
  if (u_scene == 1) return vec2(1.3, 0.9);
  if (u_scene == 2) return vec2(1.8, 0.75);
  if (u_scene == 3) return vec2(0.7, 1.8);
  if (u_scene == 4) {
    if (idx == 0) return vec2(1.1, 0.40);
    return vec2(0.85, 0.30);
  }
  if (u_scene == 5) {
    if (idx == 0) return vec2(1.5, 0.65);
    return vec2(2.0, 0.95);
  }
  return vec2(1.5, 1.5);
}

vec3 getLightEmission(int idx) {
  if (u_scene == 1) return vec3(36.0, 31.0, 26.0);
  if (u_scene == 2) return vec3(24.0, 28.0, 34.0);
  if (u_scene == 3) return vec3(42.0, 36.0, 28.0);
  if (u_scene == 4) {
    if (idx == 0) return vec3(34.0, 8.0, 26.0);
    return vec3(7.0, 28.0, 36.0);
  }
  if (u_scene == 5) {
    if (idx == 0) return vec3(38.0, 22.0, 10.0);
    return vec3(9.0, 14.0, 26.0);
  }
  return vec3(30.0);
}

vec3 getLightNormal(int idx) {
  return vec3(0.0, -1.0, 0.0);
}

float getBackWallZ() {
  if (u_scene == 1) return -8.0;
  if (u_scene == 2) return -8.8;
  if (u_scene == 3) return -9.2;
  if (u_scene == 4) return -9.6;
  if (u_scene == 5) return -10.0;
  return -1e8;
}

float getLeftWallX() {
  if (u_scene == 2) return -5.6;
  if (u_scene == 3) return -5.8;
  if (u_scene == 4) return -5.6;
  if (u_scene == 5) return -6.1;
  return -1e8;
}

float getRightWallX() {
  if (u_scene == 2) return 5.6;
  if (u_scene == 3) return 5.0;
  if (u_scene == 4) return 5.6;
  if (u_scene == 5) return 6.1;
  return 1e8;
}

vec3 getBoxMinA() {
  if (u_scene == 1) return vec3(-1.7, 0.0, -4.2);
  if (u_scene == 2) return vec3(-0.9, 0.0, -4.7);
  if (u_scene == 3) return vec3(-2.4, 0.0, -3.7);
  if (u_scene == 4) return vec3(-1.2, 0.0, -4.8);
  if (u_scene == 5) return vec3(-2.6, 0.0, -5.5);
  return vec3(-1.2, 2.2, -2.2);
}

vec3 getBoxMaxA() {
  if (u_scene == 1) return vec3(-0.4, 2.2, -2.8);
  if (u_scene == 2) return vec3(0.9, 3.1, -3.0);
  if (u_scene == 3) return vec3(-0.6, 1.75, -2.1);
  if (u_scene == 4) return vec3(0.2, 3.2, -3.2);
  if (u_scene == 5) return vec3(-0.9, 1.3, -3.9);
  return vec3(1.2, 2.8, 0.2);
}

bool hasBoxB() {
  return u_scene != 0;
}

vec3 getBoxMinB() {
  if (u_scene == 1) return vec3(0.7, 0.0, -3.1);
  if (u_scene == 2) return vec3(1.7, 0.0, -2.9);
  if (u_scene == 4) return vec3(1.3, 0.0, -5.7);
  if (u_scene == 5) return vec3(0.6, 0.0, -3.5);
  return vec3(0.5, 0.0, -4.9);
}

vec3 getBoxMaxB() {
  if (u_scene == 1) return vec3(2.3, 1.05, -1.7);
  if (u_scene == 2) return vec3(2.9, 1.0, -1.8);
  if (u_scene == 4) return vec3(2.8, 0.85, -4.4);
  if (u_scene == 5) return vec3(2.4, 2.9, -2.1);
  return vec3(2.4, 3.55, -3.2);
}

bool hasBackWall() { return u_scene != 0; }
bool hasSideWalls() { return u_scene >= 2; }

float hitFloor(vec3 ro, vec3 rd) {
  if (abs(rd.y) < 1e-7) return -1.0;
  float t = -ro.y / rd.y;
  return t > 0.0 ? t : -1.0;
}

float hitPlaneZ(vec3 ro, vec3 rd, float zPos) {
  if (abs(rd.z) < 1e-7) return -1.0;
  float t = (zPos - ro.z) / rd.z;
  if (t <= 0.0) return -1.0;
  vec3 p = ro + t * rd;
  if (p.y < 0.0 || p.y > 6.6 || p.x < -6.4 || p.x > 6.4) return -1.0;
  return t;
}

float hitPlaneX(vec3 ro, vec3 rd, float xPos) {
  if (abs(rd.x) < 1e-7) return -1.0;
  float t = (xPos - ro.x) / rd.x;
  if (t <= 0.0) return -1.0;
  vec3 p = ro + t * rd;
  if (p.y < 0.0 || p.y > 6.6 || p.z < -9.5 || p.z > 3.0) return -1.0;
  return t;
}

float hitBox(vec3 ro, vec3 rd, vec3 bmin, vec3 bmax) {
  vec3 invRd = 1.0 / rd;
  vec3 t0 = (bmin - ro) * invRd;
  vec3 t1 = (bmax - ro) * invRd;
  vec3 tmin = min(t0, t1);
  vec3 tmax = max(t0, t1);
  float tNear = max(max(tmin.x, tmin.y), tmin.z);
  float tFar = min(min(tmax.x, tmax.y), tmax.z);
  if (tNear > tFar || tFar < 0.0) return -1.0;
  return tNear > 0.0 ? tNear : -1.0;
}

float hitLight(vec3 ro, vec3 rd, int idx) {
  vec3 lightCenter = getLightCenter(idx);
  vec2 lightHalf = getLightHalf(idx);
  if (abs(rd.y) < 1e-7) return -1.0;
  float t = (lightCenter.y - ro.y) / rd.y;
  if (t < 0.0) return -1.0;
  vec3 p = ro + t * rd;
  if (abs(p.x - lightCenter.x) <= lightHalf.x &&
      abs(p.z - lightCenter.z) <= lightHalf.y) {
    return t;
  }
  return -1.0;
}

vec2 traceScene(vec3 ro, vec3 rd) {
  float closest = 1e20;
  float id = 0.0;

  float tf = hitFloor(ro, rd);
  if (tf > 0.001 && tf < closest) { closest = tf; id = 1.0; }

  float tBoxA = hitBox(ro, rd, getBoxMinA(), getBoxMaxA());
  if (tBoxA > 0.001 && tBoxA < closest) { closest = tBoxA; id = 2.0; }

  if (hasBoxB()) {
    float tBoxB = hitBox(ro, rd, getBoxMinB(), getBoxMaxB());
    if (tBoxB > 0.001 && tBoxB < closest) { closest = tBoxB; id = 6.0; }
  }

  if (hasBackWall()) {
    float tBack = hitPlaneZ(ro, rd, getBackWallZ());
    if (tBack > 0.001 && tBack < closest) { closest = tBack; id = 4.0; }
  }

  if (hasSideWalls()) {
    float tLeft = hitPlaneX(ro, rd, getLeftWallX());
    if (tLeft > 0.001 && tLeft < closest) { closest = tLeft; id = 5.0; }

    float tRight = hitPlaneX(ro, rd, getRightWallX());
    if (tRight > 0.001 && tRight < closest) { closest = tRight; id = 7.0; }
  }

  float tl0 = hitLight(ro, rd, 0);
  if (tl0 > 0.001 && tl0 < closest) { closest = tl0; id = lightIdFromIndex(0); }

  if (getLightCount() > 1) {
    float tl1 = hitLight(ro, rd, 1);
    if (tl1 > 0.001 && tl1 < closest) { closest = tl1; id = lightIdFromIndex(1); }
  }

  return vec2(closest, id);
}

vec3 boxNormal(vec3 p, vec3 bmin, vec3 bmax) {
  vec3 c = (bmin + bmax) * 0.5;
  vec3 hs = (bmax - bmin) * 0.5;
  vec3 d = (p - c) / hs;
  vec3 ad = abs(d);
  if (ad.x > ad.y && ad.x > ad.z) return vec3(sign(d.x), 0.0, 0.0);
  if (ad.y > ad.z) return vec3(0.0, sign(d.y), 0.0);
  return vec3(0.0, 0.0, sign(d.z));
}

vec3 surfaceNormal(float id, vec3 p) {
  if (id == 1.0) return vec3(0.0, 1.0, 0.0);
  if (id == 2.0) return boxNormal(p, getBoxMinA(), getBoxMaxA());
  if (id == 4.0) return vec3(0.0, 0.0, 1.0);
  if (id == 5.0) return vec3(1.0, 0.0, 0.0);
  if (id == 6.0) return boxNormal(p, getBoxMinB(), getBoxMaxB());
  if (id == 7.0) return vec3(-1.0, 0.0, 0.0);
  return vec3(0.0, 1.0, 0.0);
}

vec3 sceneFloorAlbedo() {
  if (u_scene == 1) return vec3(0.66, 0.63, 0.60);
  if (u_scene == 2) return vec3(0.74, 0.74, 0.76);
  if (u_scene == 3) return vec3(0.56, 0.57, 0.60);
  if (u_scene == 4) return vec3(0.12, 0.12, 0.14);
  if (u_scene == 5) return vec3(0.54, 0.48, 0.44);
  return vec3(0.68);
}

vec3 surfaceAlbedo(float id, vec3 p) {
  float variation = 0.95 + 0.05 * hash21(p.xz * 2.4);

  if (id == 1.0) {
    vec3 base = sceneFloorAlbedo();
    float falloff = 0.96 + 0.04 * sin(p.x * 1.3) * sin(p.z * 1.7);
    return base * variation * falloff;
  }

  if (id == 2.0) {
    if (u_scene == 1) return vec3(0.74, 0.69, 0.63) * variation;
    if (u_scene == 2) return vec3(0.76, 0.77, 0.79) * variation;
    if (u_scene == 3) return vec3(0.49, 0.47, 0.45) * variation;
    if (u_scene == 4) return vec3(0.22, 0.24, 0.29) * variation;
    if (u_scene == 5) return vec3(0.83, 0.64, 0.40) * variation;
    return vec3(0.84) * variation;
  }

  if (id == 6.0) {
    if (u_scene == 1) return vec3(0.56, 0.54, 0.50) * variation;
    if (u_scene == 2) return vec3(0.70, 0.71, 0.73) * variation;
    if (u_scene == 4) return vec3(0.10, 0.11, 0.14) * variation;
    if (u_scene == 5) return vec3(0.36, 0.34, 0.33) * variation;
    return vec3(0.22, 0.23, 0.27) * variation;
  }

  if (id == 4.0) {
    if (u_scene == 1) return vec3(0.36, 0.34, 0.31) * (0.94 + 0.06 * hash21(p.xy));
    if (u_scene == 2) return vec3(0.64, 0.64, 0.66) * (0.97 + 0.03 * hash21(p.xy));
    if (u_scene == 4) return vec3(0.10, 0.10, 0.12) * (0.95 + 0.05 * hash21(p.xy));
    if (u_scene == 5) return vec3(0.34, 0.28, 0.26) * (0.95 + 0.05 * hash21(p.xy));
    return vec3(0.18, 0.19, 0.23) * (0.95 + 0.05 * hash21(p.xy));
  }

  if (id == 5.0) {
    if (u_scene == 2) return vec3(0.72, 0.30, 0.28);
    if (u_scene == 4) return vec3(0.34, 0.08, 0.26);
    if (u_scene == 5) return vec3(0.47, 0.27, 0.22);
    return vec3(0.22, 0.23, 0.27);
  }

  if (id == 7.0) {
    if (u_scene == 2) return vec3(0.24, 0.35, 0.58);
    if (u_scene == 4) return vec3(0.06, 0.20, 0.29);
    if (u_scene == 5) return vec3(0.20, 0.26, 0.34);
    return vec3(0.15, 0.16, 0.20);
  }

  return vec3(0.7);
}

bool isDiffuseSurface(float id) {
  return id == 1.0 || id == 2.0 || id == 4.0 || id == 5.0 || id == 6.0 || id == 7.0;
}

vec3 sceneAmbientTint() {
  if (u_scene == 1) return vec3(0.18, 0.16, 0.14);
  if (u_scene == 2) return vec3(0.18, 0.20, 0.24);
  if (u_scene == 3) return vec3(0.12, 0.11, 0.12);
  if (u_scene == 4) return vec3(0.08, 0.07, 0.11);
  if (u_scene == 5) return vec3(0.24, 0.18, 0.14);
  return vec3(0.14, 0.14, 0.15);
}

float sceneAmbientStrength() {
  if (u_scene == 1) return 0.18;
  if (u_scene == 2) return 0.28;
  if (u_scene == 3) return 0.12;
  if (u_scene == 4) return 0.30;
  if (u_scene == 5) return 0.24;
  return 0.14;
}

vec3 ambientBounce(float id, vec3 hitPos, vec3 normal, vec3 albedo) {
  float upness = clamp(normal.y * 0.5 + 0.5, 0.0, 1.0);
  float roomDepth = clamp((-hitPos.z - 1.0) / 8.0, 0.0, 1.0);
  vec3 ambient = sceneAmbientTint() * (0.45 + 0.55 * upness);

  if (u_scene == 2) {
    vec3 leftBounce = vec3(0.16, 0.06, 0.07) * clamp(normal.x, 0.0, 1.0);
    vec3 rightBounce = vec3(0.05, 0.09, 0.18) * clamp(-normal.x, 0.0, 1.0);
    vec3 backBounce = vec3(0.10, 0.11, 0.13) * (0.35 + 0.65 * roomDepth);
    ambient += leftBounce + rightBounce + backBounce;
  } else if (u_scene == 1) {
    ambient += vec3(0.08, 0.06, 0.04) * (0.3 + 0.7 * roomDepth);
  } else if (u_scene == 3) {
    vec3 warmEdge = vec3(0.14, 0.10, 0.06) * clamp(-normal.x, 0.0, 1.0);
    ambient += warmEdge + vec3(0.03, 0.03, 0.04) * upness;
  } else if (u_scene == 4) {
    vec3 magentaEdge = vec3(0.18, 0.05, 0.14) * clamp(normal.x, 0.0, 1.0);
    vec3 cyanEdge = vec3(0.03, 0.14, 0.18) * clamp(-normal.x, 0.0, 1.0);
    vec3 backGlow = vec3(0.05, 0.06, 0.10) * (0.35 + 0.65 * roomDepth);
    ambient += magentaEdge + cyanEdge + backGlow;
  } else if (u_scene == 5) {
    vec3 warmTop = vec3(0.18, 0.10, 0.05) * upness;
    vec3 coolFill = vec3(0.04, 0.06, 0.10) * (1.0 - upness) * (0.3 + 0.7 * roomDepth);
    ambient += warmTop + coolFill;
  }

  if (id == 1.0) {
    ambient *= 0.6;
  }

  return albedo * ambient * sceneAmbientStrength();
}

vec3 sampleHemisphereUniform(vec3 n, vec2 xi) {
  float cosTheta = xi.x;
  float sinTheta = sqrt(max(0.0, 1.0 - cosTheta * cosTheta));
  float phi = TWO_PI * xi.y;

  vec3 up = abs(n.y) < 0.999 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
  vec3 tangent = normalize(cross(up, n));
  vec3 bitangent = cross(n, tangent);

  return normalize(
    sinTheta * cos(phi) * tangent +
    sinTheta * sin(phi) * bitangent +
    cosTheta * n
  );
}

vec3 sampleLightPoint(vec2 xi, int idx) {
  vec3 lightCenter = getLightCenter(idx);
  vec2 lightHalf = getLightHalf(idx);
  return lightCenter + vec3(
    (xi.x - 0.5) * 2.0 * lightHalf.x,
    0.0,
    (xi.y - 0.5) * 2.0 * lightHalf.y
  );
}

void getCamera(vec2 pixel, vec2 res, out vec3 ro, out vec3 rd) {
  vec2 uv = (pixel - 0.5 * res) / res.y;
  vec3 lookAt;
  vec3 vup = vec3(0.0, 1.0, 0.0);
  float fov;

  if (u_scene == 1) {
    ro = vec3(0.4, 2.8, 8.3);
    lookAt = vec3(0.2, 1.1, -2.8);
    fov = 0.68;
  } else if (u_scene == 2) {
    ro = vec3(0.5, 2.7, 8.8);
    lookAt = vec3(0.5, 1.45, -3.7);
    fov = 0.65;
  } else if (u_scene == 3) {
    ro = vec3(0.2, 2.6, 8.5);
    lookAt = vec3(0.1, 1.3, -3.2);
    fov = 0.70;
  } else if (u_scene == 4) {
    ro = vec3(0.1, 2.3, 8.2);
    lookAt = vec3(0.4, 1.4, -4.0);
    fov = 0.66;
  } else if (u_scene == 5) {
    ro = vec3(0.2, 2.9, 9.4);
    lookAt = vec3(0.0, 1.6, -4.3);
    fov = 0.67;
  } else {
    ro = vec3(0.0, 3.5, 10.0);
    lookAt = vec3(0.0, 1.5, -1.0);
    fov = 0.75;
  }

  vec3 w = normalize(ro - lookAt);
  vec3 u = normalize(cross(vup, w));
  vec3 v = cross(w, u);
  rd = normalize(-w + uv.x * u * fov + uv.y * v * fov);
}

void main() {
  vec2 pixel = gl_FragCoord.xy;
  initRNG(pixel, u_frame);

  vec2 jitter = rand2() - 0.5;
  vec3 ro, rd;
  getCamera(pixel + jitter, u_resolution, ro, rd);

  vec2 hit = traceScene(ro, rd);
  float t = hit.x;
  float id = hit.y;
  vec3 color = vec3(0.0);

  if (isDiffuseSurface(id)) {
    vec3 hitPos = ro + t * rd;
    vec3 normal = surfaceNormal(id, hitPos);
    vec3 albedo = surfaceAlbedo(id, hitPos);
    vec3 offset = hitPos + normal * 0.002;
    color += ambientBounce(id, hitPos, normal, albedo);

    if (u_mode == 0) {
      vec3 dir = sampleHemisphereUniform(normal, rand2());
      vec2 shadowHit = traceScene(offset, dir);

      if (shadowHit.y == 3.0 || shadowHit.y == 8.0) {
        float cosTheta = max(dot(normal, dir), 0.0);
        int lightIdx = lightIndexFromId(shadowHit.y);
        vec3 lightEmission = getLightEmission(lightIdx);
        color += lightEmission * albedo * 2.0 * cosTheta;
      }
    } else {
      int lightIdx = getLightCount() > 1 && rand() > 0.5 ? 1 : 0;
      vec3 lightPoint = sampleLightPoint(rand2(), lightIdx);
      vec3 toLight = lightPoint - offset;
      float dist2 = dot(toLight, toLight);
      float dist = sqrt(dist2);
      vec3 dir = toLight / dist;
      vec3 lightNormal = getLightNormal(lightIdx);
      vec3 lightEmission = getLightEmission(lightIdx);

      float cosTheta = max(dot(normal, dir), 0.0);
      float cosLight = max(dot(lightNormal, -dir), 0.0);

      if (cosTheta > 0.0 && cosLight > 0.0) {
        vec2 shadowHit = traceScene(offset, dir);
        if (shadowHit.y == lightIdFromIndex(lightIdx) && shadowHit.x >= dist - 0.01) {
          vec2 lightHalf = getLightHalf(lightIdx);
          float lightArea = 4.0 * lightHalf.x * lightHalf.y;
          float mixtureWeight = float(getLightCount());
          color += lightEmission * albedo * INV_PI * cosTheta * cosLight * lightArea * mixtureWeight / dist2;
        }
      }
    }
  } else if (id == 3.0 || id == 8.0) {
    color = getLightEmission(lightIndexFromId(id));
  }

  vec3 prev = texelFetch(u_prevAccum, ivec2(pixel), 0).rgb;
  fragColor = vec4(prev + color, 1.0);
}
`

// Display shader — reads accumulated buffer, divides by sample count, tone maps
export const displayFrag = `#version 300 es
precision highp float;

in vec2 vUv;

uniform sampler2D u_accumTex;
uniform float u_frameCount;
uniform vec2 u_resolution;

out vec4 fragColor;

// ACES filmic tone mapping
vec3 ACESFilm(vec3 x) {
  float a = 2.51;
  float b = 0.03;
  float c = 2.43;
  float d = 0.59;
  float e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}

void main() {
  vec3 accum = texelFetch(u_accumTex, ivec2(gl_FragCoord.xy), 0).rgb;
  vec3 color = accum / max(u_frameCount, 1.0);

  // Tone map
  color = ACESFilm(color);

  // Gamma correction
  color = pow(color, vec3(1.0 / 2.2));

  fragColor = vec4(color, 1.0);
}
`

// Atmospheric smoke/light background shader
export const atmosphereFrag = `#version 300 es
precision highp float;

in vec2 vUv;

uniform vec2 u_resolution;
uniform float u_time;
uniform vec2 u_mouse; // normalized [0,1]

out vec4 fragColor;

// ── Noise ──
float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash21(i), hash21(i + vec2(1, 0)), f.x),
    mix(hash21(i + vec2(0, 1)), hash21(i + vec2(1, 1)), f.x),
    f.y
  );
}

float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 6; i++) {
    v += a * noise(p);
    p = rot * p * 2.0;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * u_resolution) / u_resolution.y;
  float t = u_time * 0.03;

  // Domain warping for organic smoke shapes
  vec2 q = vec2(
    fbm(p * 2.0 + t * 0.4),
    fbm(p * 2.0 + vec2(5.2, 1.3) + t * 0.3)
  );
  vec2 r = vec2(
    fbm(p * 2.0 + q * 4.0 + vec2(1.7, 9.2) + t * 0.15),
    fbm(p * 2.0 + q * 4.0 + vec2(8.3, 2.8) + t * 0.12)
  );
  float f = fbm(p * 2.0 + r * 2.0);

  // Mouse-reactive light — soft radial glow around cursor
  vec2 mouseP = u_mouse * 2.0 - 1.0;
  mouseP.x *= u_resolution.x / u_resolution.y;
  float mouseDist = length(p - mouseP);
  float mouseGlow = 0.25 / (0.15 + mouseDist * mouseDist);
  mouseGlow = smoothstep(0.0, 2.5, mouseGlow);

  // Secondary ambient glow from center-top
  float centerGlow = 0.12 / (0.3 + length(p - vec2(0.0, 0.3)));

  // Color palette
  vec3 deepBlue = vec3(0.02, 0.02, 0.06);
  vec3 midBlue = vec3(0.05, 0.07, 0.18);
  vec3 brightBlue = vec3(0.15, 0.25, 0.65);
  vec3 white = vec3(0.6, 0.7, 1.0);

  vec3 color = deepBlue;
  color = mix(color, midBlue, smoothstep(0.2, 0.8, f));
  color += brightBlue * centerGlow * f;
  color += white * mouseGlow * (0.3 + 0.7 * f);

  // Subtle vertical gradient
  float grad = smoothstep(-0.5, 0.5, p.y);
  color = mix(color, color * 0.5, grad * 0.3);

  // Vignette
  float vig = 1.0 - 0.5 * dot(p * 0.7, p * 0.7);
  color *= max(vig, 0.0);

  fragColor = vec4(color, 1.0);
}
`
