// src/gl/shaders.js
// Fontes GLSL dos programas de shader usados pelo editor.
// Cada constante é uma string com o código GLSL.
//
// IMPORTANTE: a primeira linha precisa ser "#version 300 es" pra usar GLSL ES 3.00
// (WebGL2). Não pode ter nada antes desse diretiva (nem comentário, nem espaço).

// === Programa principal (render normal com textura + iluminação Lambert) ===

export const MAIN_VS = `#version 300 es
precision highp float;

in vec3 a_position;
in vec3 a_normal;
in vec2 a_uv;

uniform mat4 u_viewProjection;
uniform mat4 u_worldMatrix;

// A matriz pra transformar normal precisa ser a inversa transposta de world.
// O JS calcula isso e passa pronto pra evitar fazer no shader.
uniform mat4 u_worldInverseTranspose;

out vec3 v_normal;
out vec2 v_uv;

void main() {
  // Posição final: world -> view -> projection.
  gl_Position = u_viewProjection * u_worldMatrix * vec4(a_position, 1.0);

  // Transforma a normal pelo "world inverse transpose" pra que escalas
  // não-uniformes não distorçam ela.
  v_normal = mat3(u_worldInverseTranspose) * a_normal;

  // UV passa direto pro fragment.
  v_uv = a_uv;
}
`;

export const MAIN_FS = `#version 300 es
precision highp float;

in vec3 v_normal;
in vec2 v_uv;

uniform sampler2D u_albedo;
uniform vec3 u_lightDir;      // já normalizado, em world space
uniform float u_ambient;      // ex: 0.2
uniform vec2 u_tile;          // multiplicador de UV (tileU, tileV)

out vec4 outColor;

void main() {
  // Multiplica UV pelo tile pra repetir/esticar a textura.
  vec4 tex = texture(u_albedo, v_uv * u_tile);

  // Difuso Lambertiano: intensidade = max(0, N · L).
  float diffuse = max(0.0, dot(normalize(v_normal), u_lightDir));

  // Cor final = textura * (ambiente + difuso).
  outColor = vec4(tex.rgb * (u_ambient + diffuse), tex.a);
}
`;

// === Programa de picking (renderiza ID do nó como cor RGBA no FBO) ===

export const PICK_VS = `#version 300 es
precision highp float;

in vec3 a_position;

uniform mat4 u_viewProjection;
uniform mat4 u_worldMatrix;

void main() {
  gl_Position = u_viewProjection * u_worldMatrix * vec4(a_position, 1.0);
}
`;

export const PICK_FS = `#version 300 es
precision highp float;

// O ID do nó é passado como 4 bytes (R, G, B, A normalizados).
// JS codifica uint32 -> 4 floats no range [0, 1] antes de enviar.
uniform vec4 u_pickingColor;

out vec4 outColor;

void main() {
  outColor = u_pickingColor;
}
`;
