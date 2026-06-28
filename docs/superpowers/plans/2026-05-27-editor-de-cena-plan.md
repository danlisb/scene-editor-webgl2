# Editor de Cena WebGL2 — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar um editor de cena 3D em WebGL2 vanilla, conforme spec em `docs/superpowers/specs/2026-05-27-editor-de-cena-design.md`.

**Architecture:** Vanilla JS + ES modules, sem build. Catalog singleton dona dos buffers/texturas; SceneNodes referenciam por modelId; render agrupado por modelId atende compartilhamento de geometria. 3 painéis HTML + canvas central; picking por framebuffer offscreen.

**Tech Stack:** WebGL2, `twgl.js` + `m4.js` (helpers do webgl2fundamentals), HTML5, CSS Grid. Servido via `python -m http.server`.

---

## Convenções para todas as tasks

Antes de começar qualquer task, releia [feedback_clear_code.md] mentalmente:

- **Identificadores em inglês** (`scene`, `node`, `updateAnimations()`)
- **Comentários em português** (`// Multiplica a matriz pai pela local pra obter a world`)
- **Strings de UI em português** (`"Salvar JSON"`)
- **Imperativo verboso** > clever code
- **JSDoc** nas funções principais em português

Não usamos git neste projeto. Para fazer backup, copiar a pasta inteira manualmente.

---

## Mapa de arquivos

Todos os caminhos relativos a `/Users/daniel/Documents/Facul/CG/Trab 1/`.

```
.
├── index.html                       (T2)  página principal: canvas + painéis
├── styles.css                       (T2)  layout grid + visual dos painéis
├── test.html                        (T17) página dos testes
├── tests.js                         (T17) testes automatizados
├── README.md                        (T18) instruções de uso
├── assets/
│   └── models.json                  (T4)  catálogo: ~16 entradas
├── examples/
│   ├── cena_simples.json            (T16) demo: pistola + cubo
│   ├── cena_hierarquia.json         (T16) demo: pai-filho
│   └── cena_animada.json            (T16) demo: rotacionando + translando
├── src/
│   ├── main.js                      (T3)  entry point: bootstrap + mainLoop
│   ├── lib/
│   │   ├── twgl-full.module.js      (T2)  baixado do webgl2fundamentals
│   │   └── m4.js                    (T2)  baixado do webgl2fundamentals
│   ├── gl/
│   │   ├── shaders.js               (T3)  GLSL inline (main + picking)
│   │   ├── program.js               (T3)  wrappers de program/uniform
│   │   └── obj-loader.js            (T4)  parser OBJ adaptado
│   ├── scene/
│   │   ├── catalog.js               (T5)  carrega 16 modelos 1x
│   │   ├── node.js                  (T6)  SceneNode + transform/anim/textura props
│   │   ├── scene.js                 (T7)  árvore, traversal, seleção, eventos
│   │   └── animation.js             (T8)  updateAnimations(dt)
│   ├── interaction/
│   │   ├── camera.js                (T9)  câmera orbital + controles mouse
│   │   └── picking.js               (T10) framebuffer offscreen + readPixels
│   └── ui/
│       ├── model-menu.js            (T11) painel esquerdo: 16 canvases thumb
│       ├── scene-tree.js            (T12) painel direito-topo: árvore HTML
│       ├── inspector.js             (T13) painel direito-baixo: edita seleção
│       └── io-buttons.js            (T14) botões Salvar/Carregar JSON
└── docs/
    └── superpowers/
        ├── specs/2026-05-27-editor-de-cena-design.md   (já existe)
        └── plans/2026-05-27-editor-de-cena-plan.md     (este arquivo)
```

---

## Fases e tasks

O plano tem **18 tasks** em **6 fases**. Cada fase deixa o projeto num estado verificável.

| Fase | Tasks | Resultado verificável no fim |
|---|---|---|
| 1. Setup + WebGL básico | T1–T4 | Um modelo OBJ renderiza com textura no canvas |
| 2. Grafo de cena | T5–T8 | Múltiplos modelos compartilham VAO; anim+hierarquia funcionam |
| 3. Interação | T9–T10 | Câmera orbital + clicar seleciona modelo |
| 4. UI | T11–T14 | Editor funcional ponta-a-ponta |
| 5. Persistência | T15–T16 | Salvar/carregar JSON com cenas-exemplo |
| 6. Verificação | T17–T18 | Testes passam + README + smoke test rodado |

---

# Fase 1 — Setup + WebGL básico

## Task 1: Inicializar projeto

**Files:**
- Create: `README.md` (esqueleto, expandido na T18)

**O que esta task faz:** cria a estrutura de diretórios vazia que vamos preencher e um README mínimo.

- [ ] **Step 1: Criar estrutura de diretórios**

Rodar no terminal:
```bash
cd "/Users/daniel/Documents/Facul/CG/Trab 1"
mkdir -p src/gl src/scene src/interaction src/ui src/lib assets examples
```

Esperado: diretórios criados sem erro.

- [ ] **Step 2: Criar README esqueleto**

Conteúdo de `README.md`:

````markdown
# Editor de Cena WebGL2 — Trabalho 1 de CG

Editor de cena 3D em WebGL2 puro (vanilla JS).

## Como rodar

```bash
python3 -m http.server 8000
```

Depois acessar `http://localhost:8000/`.

## Estrutura

Ver `docs/superpowers/specs/2026-05-27-editor-de-cena-design.md`.
````

---

## Task 2: Adicionar helpers do webgl2fundamentals e página inicial

**Files:**
- Create: `src/lib/twgl-full.module.js` (download)
- Create: `src/lib/m4.js` (download)
- Create: `index.html`
- Create: `styles.css`

**O que esta task faz:** baixa as bibliotecas auxiliares que os tutoriais usam, cria a página HTML com layout grid (3 painéis + canvas), e o CSS base.

- [ ] **Step 1: Baixar twgl.js (versão modular)**

```bash
curl -L -o src/lib/twgl-full.module.js \
  https://cdn.jsdelivr.net/npm/twgl.js@5.5.4/dist/5.x/twgl-full.module.js
```

Esperado: arquivo de ~120KB criado. Verificar:
```bash
wc -l src/lib/twgl-full.module.js
```
(deve mostrar alguns milhares de linhas)

- [ ] **Step 2: Baixar m4.js**

```bash
curl -L -o src/lib/m4.js \
  https://webgl2fundamentals.org/webgl/resources/m4.js
```

Esperado: arquivo ~20KB. Esse `m4.js` é UMD e expõe `m4` no escopo global quando importado via `<script>`. Vamos convertê-lo num módulo ES.

- [ ] **Step 3: Converter `m4.js` em módulo ES**

Adicionar no final do arquivo `src/lib/m4.js`:

```js

// Adicionado pra usar como módulo ES no projeto.
// O m4.js original expõe `m4` no objeto global (window.m4).
// Reexportamos aqui pra poder fazer `import { m4 } from './lib/m4.js'`.
export { m4 };
```

Editar o início do arquivo: o m4.js original começa com `"use strict";` e `var m4 = (function() { ...`. Está OK — só precisamos da exportação acima.

- [ ] **Step 4: Criar `index.html`**

Conteúdo:

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Editor de Cena — Trabalho 1 CG</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <!-- Barra superior: botões de IO + título -->
  <header id="topbar">
    <div class="io-buttons">
      <button id="btn-save">Salvar JSON</button>
      <button id="btn-load">Carregar JSON</button>
      <!-- Input file escondido — o botão "Carregar" dispara ele via click() -->
      <input type="file" id="file-load" accept=".json" style="display:none" />
    </div>
    <h1>Trabalho 1 — Computação Gráfica</h1>
  </header>

  <!-- Painel esquerdo: menu de modelos com canvases-thumbnail -->
  <aside id="model-menu">
    <h2>Modelos</h2>
    <div id="model-menu-list">
      <!-- Preenchido pelo JS (model-menu.js) -->
    </div>
  </aside>

  <!-- Canvas central — onde a cena é renderizada -->
  <main id="canvas-container">
    <canvas id="main-canvas"></canvas>
  </main>

  <!-- Painel direito: árvore + inspector -->
  <aside id="right-panel">
    <section id="scene-tree-section">
      <h2>Cena</h2>
      <div id="scene-tree">
        <!-- Preenchido pelo JS (scene-tree.js) -->
      </div>
    </section>
    <section id="inspector-section">
      <h2>Inspector</h2>
      <div id="inspector">
        <!-- Preenchido pelo JS (inspector.js) -->
      </div>
    </section>
  </aside>

  <!-- Entry point — module pra suportar import/export -->
  <script type="module" src="src/main.js"></script>
</body>
</html>
```

- [ ] **Step 5: Criar `styles.css` com layout grid**

Conteúdo:

```css
/* Reset básico */
* { box-sizing: border-box; margin: 0; padding: 0; }

html, body {
  height: 100%;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  background: #1e1e1e;
  color: #ddd;
  overflow: hidden;
}

/* Layout principal: grid 3 colunas × 2 linhas
   ┌────────────────────────────────────┐
   │           topbar (linha 1)         │
   ├──────────┬────────────┬────────────┤
   │  menu    │  canvas    │  painel    │
   │  esq.    │  central   │  direito   │
   └──────────┴────────────┴────────────┘ */
body {
  display: grid;
  grid-template-columns: 220px 1fr 300px;
  grid-template-rows: 48px 1fr;
  grid-template-areas:
    "top top top"
    "left main right";
}

#topbar       { grid-area: top;   display: flex; align-items: center;
                gap: 16px; padding: 0 16px; background: #2a2a2a;
                border-bottom: 1px solid #444; }
#topbar h1    { font-size: 14px; font-weight: 500; color: #888; margin-left: auto; }
.io-buttons   { display: flex; gap: 8px; }
.io-buttons button { background: #3a3a3a; border: 1px solid #555; color: #eee;
                     padding: 6px 12px; cursor: pointer; border-radius: 3px; }
.io-buttons button:hover { background: #4a4a4a; }

#model-menu    { grid-area: left;  background: #252525;
                 border-right: 1px solid #444; overflow-y: auto; }
#canvas-container { grid-area: main; position: relative; }
#main-canvas   { display: block; width: 100%; height: 100%; cursor: grab; }
#main-canvas:active { cursor: grabbing; }
#right-panel   { grid-area: right; background: #252525;
                 border-left: 1px solid #444; display: flex; flex-direction: column; }

aside h2       { font-size: 13px; text-transform: uppercase; color: #888;
                 padding: 10px 12px; border-bottom: 1px solid #3a3a3a; }

#scene-tree-section { flex: 1; overflow-y: auto; border-bottom: 1px solid #444; }
#inspector-section  { flex: 1; overflow-y: auto; }
#scene-tree, #inspector { padding: 8px 12px; font-size: 12px; }

/* Grid de thumbnails do menu de modelos */
#model-menu-list { display: grid; grid-template-columns: 1fr 1fr;
                   gap: 6px; padding: 8px; }
.model-thumb { background: #1a1a1a; border: 1px solid #444; cursor: pointer;
               border-radius: 3px; padding: 4px; text-align: center; }
.model-thumb:hover { border-color: #888; }
.model-thumb canvas { display: block; width: 90px; height: 90px;
                      image-rendering: pixelated; margin: 0 auto; }
.model-thumb .label { font-size: 10px; color: #aaa; margin-top: 2px; }
```

- [ ] **Step 6: Criar `src/main.js` stub e testar página**

```js
// src/main.js — entry point da aplicação.
// Por enquanto só prova que o módulo está sendo carregado.

import { m4 } from './lib/m4.js';

console.log('[main] módulo carregado. m4 disponível?', typeof m4.identity === 'function');
```

Rodar:
```bash
cd "/Users/daniel/Documents/Facul/CG/Trab 1"
python3 -m http.server 8000
```

Abrir `http://localhost:8000/` no navegador. Esperado:
- Layout aparece (3 colunas, topbar, fundo escuro).
- Botões "Salvar JSON" e "Carregar JSON" visíveis no topo.
- Console do DevTools mostra: `[main] módulo carregado. m4 disponível? true`.
- Nenhum erro vermelho.

---

## Task 3: Renderizar primeiro triângulo (sanity check WebGL)

**Files:**
- Create: `src/gl/shaders.js`
- Create: `src/gl/program.js`
- Modify: `src/main.js`

**O que esta task faz:** garante que o pipeline WebGL2 está funcionando — cria contexto, programa shader simples, desenha um triângulo. Isso isola problemas de WebGL antes de adicionar complexidade (OBJ, texturas, etc).

- [ ] **Step 1: Criar fontes GLSL em `src/gl/shaders.js`**

```js
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
```

- [ ] **Step 2: Criar wrappers em `src/gl/program.js`**

```js
// src/gl/program.js
// Wrappers em cima do twgl.js pra criar/usar programas shader.
//
// Por que existir esse arquivo se o twgl já faz quase tudo:
//   - Centraliza a criação dos 2 programas (main e picking) num lugar.
//   - Expõe uma API mais explícita pro resto do código.
//   - Facilita trocar twgl por código manual depois, se quisermos.

import * as twgl from '../lib/twgl-full.module.js';
import { MAIN_VS, MAIN_FS, PICK_VS, PICK_FS } from './shaders.js';

/**
 * Cria os 2 programas shader e retorna num objeto.
 *
 * @param {WebGL2RenderingContext} gl
 * @returns {{ main: twgl.ProgramInfo, picking: twgl.ProgramInfo }}
 */
export function createPrograms(gl) {
  // twgl.createProgramInfo retorna um objeto com o WebGLProgram + maps
  // dos atributos e uniforms (com setters prontos).
  const main = twgl.createProgramInfo(gl, [MAIN_VS, MAIN_FS]);
  const picking = twgl.createProgramInfo(gl, [PICK_VS, PICK_FS]);
  return { main, picking };
}
```

- [ ] **Step 3: Atualizar `src/main.js` pra desenhar um triângulo**

```js
// src/main.js — entry point do editor.
// Nesta etapa: cria contexto WebGL2, programa shader, e desenha um triângulo
// hardcoded pra confirmar que o pipeline está funcionando.

import * as twgl from './lib/twgl-full.module.js';
import { m4 } from './lib/m4.js';
import { createPrograms } from './gl/program.js';

// ---- Bootstrap ----------------------------------------------------------------

const canvas = document.getElementById('main-canvas');
const gl = canvas.getContext('webgl2');
if (!gl) {
  alert('WebGL2 não suportado neste navegador');
  throw new Error('webgl2 indisponível');
}

const programs = createPrograms(gl);

// ---- Geometria de teste: triângulo no plano XY -------------------------------
// Buffers via twgl: ele cria os WebGLBuffer e configura atributos automaticamente.

const triangleBufferInfo = twgl.createBufferInfoFromArrays(gl, {
  a_position: { numComponents: 3, data: [
     0.0,  0.5,  0.0,  // topo
    -0.5, -0.5,  0.0,  // canto esquerdo
     0.5, -0.5,  0.0,  // canto direito
  ]},
  a_normal: { numComponents: 3, data: [
    0, 0, 1,  0, 0, 1,  0, 0, 1,
  ]},
  a_uv: { numComponents: 2, data: [
    0.5, 1.0,  0.0, 0.0,  1.0, 0.0,
  ]},
});

// Textura branca 1x1 — pra o shader principal não falhar com sampler indefinido.
const whiteTexture = twgl.createTexture(gl, {
  src: [255, 255, 255, 255], width: 1, height: 1,
});

// ---- Loop principal ----------------------------------------------------------

function resizeCanvas() {
  // Ajusta o tamanho do canvas ao tamanho real em pixels do elemento HTML.
  // Sem isso a imagem fica esticada e pixelada quando o display é HiDPI.
  const dpr = window.devicePixelRatio || 1;
  const w = Math.floor(canvas.clientWidth * dpr);
  const h = Math.floor(canvas.clientHeight * dpr);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  gl.viewport(0, 0, canvas.width, canvas.height);
}

function mainLoop() {
  resizeCanvas();

  // Limpa com cor de fundo cinza-azulado e o depth buffer.
  gl.clearColor(0.1, 0.12, 0.15, 1.0);
  gl.enable(gl.DEPTH_TEST);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  // Câmera estática olhando pra origem.
  const aspect = canvas.width / canvas.height;
  const projection = m4.perspective(Math.PI / 3, aspect, 0.01, 100);
  const view = m4.lookAt([0, 0, 2], [0, 0, 0], [0, 1, 0]);
  const viewProjection = m4.multiply(projection, m4.inverse(view));

  // Identidade pro world (triângulo na origem).
  const world = m4.identity();
  const worldInverseTranspose = m4.transpose(m4.inverse(world));

  gl.useProgram(programs.main.program);
  twgl.setBuffersAndAttributes(gl, programs.main, triangleBufferInfo);
  twgl.setUniforms(programs.main, {
    u_viewProjection: viewProjection,
    u_worldMatrix: world,
    u_worldInverseTranspose: worldInverseTranspose,
    u_albedo: whiteTexture,
    u_lightDir: [0, 0, 1],
    u_ambient: 0.3,
    u_tile: [1, 1],
  });
  twgl.drawBufferInfo(gl, triangleBufferInfo);

  requestAnimationFrame(mainLoop);
}

requestAnimationFrame(mainLoop);
console.log('[main] WebGL2 inicializado, desenhando triângulo de teste.');
```

- [ ] **Step 4: Verificar no navegador**

Recarregar `http://localhost:8000/`. Esperado:
- Triângulo branco no centro do canvas, fundo cinza-azulado.
- Console: `[main] WebGL2 inicializado, desenhando triângulo de teste.`
- Sem erros vermelhos.

Se não aparecer o triângulo, abrir o console e procurar mensagens de compilação de shader — `twgl.createProgramInfo` loga erros detalhados de GLSL.

---

## Task 4: Carregar e renderizar um modelo OBJ

**Files:**
- Create: `src/gl/obj-loader.js`
- Create: `assets/models.json` (parcial — só uma entrada inicialmente)
- Modify: `src/main.js`

**O que esta task faz:** implementa o parser de OBJ adaptado do tutorial `webgl-load-obj-w-mtl`, carrega o primeiro modelo (a pistola) com sua textura, e troca o triângulo de teste por esse modelo. Confirma que tudo do pipeline OBJ → buffers → render funciona.

- [ ] **Step 1: Criar `src/gl/obj-loader.js`**

```js
// src/gl/obj-loader.js
// Carregador de arquivos .obj (Wavefront). Adaptado do tutorial:
//   https://webgl2fundamentals.org/webgl/lessons/webgl-load-obj-w-mtl.html
//
// Diferenças do tutorial:
//   - Ignoramos o map_Kd do .mtl (paths que o Blender escreve são quebrados).
//     A textura vem do models.json e é carregada à parte.
//   - Suporta duas estratégias de leitura: merge (junta todos os 'o' blocks)
//     ou objectName (carrega só um bloco específico).

import * as twgl from '../lib/twgl-full.module.js';

/**
 * Carrega um arquivo OBJ e devolve um BufferInfo pronto pra renderizar.
 *
 * @param {WebGL2RenderingContext} gl
 * @param {string} url - URL do arquivo .obj
 * @param {object} options
 * @param {boolean} [options.merge=true]    - junta todos os blocos 'o' em uma única geometria
 * @param {string}  [options.objectName]    - se setado, carrega só esse bloco 'o' (ignora merge)
 * @returns {Promise<{ bufferInfo: object, vao: WebGLVertexArrayObject, indexCount: number }>}
 */
export async function loadObj(gl, url, options = {}) {
  const { merge = true, objectName } = options;

  // 1) Baixar o conteúdo do .obj como texto.
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Falha ao baixar ${url}: ${response.status}`);
  const text = await response.text();

  // 2) Parsear linha por linha.
  const objData = parseObj(text);

  // 3) Filtrar quais 'o' blocks vamos usar.
  let blocks;
  if (objectName) {
    blocks = objData.objects.filter(o => o.name === objectName);
    if (blocks.length === 0) {
      throw new Error(`Objeto "${objectName}" não encontrado em ${url}. ` +
                      `Disponíveis: ${objData.objects.map(o => o.name).join(', ')}`);
    }
  } else if (merge) {
    blocks = objData.objects;  // todos
  } else {
    blocks = [objData.objects[0]];  // só o primeiro
  }

  // 4) Concatenar vértices/normais/UVs/índices dos blocos selecionados.
  const positions = [];
  const normals   = [];
  const uvs       = [];
  for (const block of blocks) {
    // Cada face do bloco vira 3 vértices "expandidos" (sem reuso por índice).
    // Simplifica o parser; o overhead é aceitável pra escala desse projeto.
    for (const face of block.faces) {
      for (const vert of face) {
        // vert = { v: idx_posicao, vt: idx_uv, vn: idx_normal }
        const p = objData.positions[vert.v - 1];
        const t = vert.vt ? objData.uvs[vert.vt - 1]      : [0, 0];
        const n = vert.vn ? objData.normals[vert.vn - 1]  : [0, 1, 0];
        positions.push(p[0], p[1], p[2]);
        uvs.push(t[0], t[1]);
        normals.push(n[0], n[1], n[2]);
      }
    }
  }

  // 5) Criar BufferInfo via twgl (geometria sem índices — drawArrays).
  const bufferInfo = twgl.createBufferInfoFromArrays(gl, {
    a_position: { numComponents: 3, data: positions },
    a_normal:   { numComponents: 3, data: normals },
    a_uv:       { numComponents: 2, data: uvs },
  });

  // 6) Criar VAO pra esses buffers — vamos compartilhar entre os nós.
  //    O VAO é criado com base no programa "main"; o programa "picking" também
  //    usa só a_position, então o mesmo VAO serve pros dois (twgl ignora atributos
  //    do VAO que o programa atual não usa).
  // OBS: o VAO real vai ser criado em catalog.js usando este bufferInfo.
  //      Aqui só devolvemos o bufferInfo e o vertexCount.

  return {
    bufferInfo,
    vertexCount: positions.length / 3,
  };
}

/**
 * Parser interno de OBJ.
 * Reconhece: o (objeto), v (vértice), vn (normal), vt (UV), f (face).
 * Ignora: usemtl, mtllib, s, g (não usamos esses no projeto).
 *
 * @param {string} text - conteúdo do .obj
 * @returns {{ positions: number[][], normals: number[][], uvs: number[][],
 *             objects: Array<{ name: string, faces: Array<Array<{v:number,vt?:number,vn?:number}>> }> }}
 */
function parseObj(text) {
  const positions = [];
  const normals   = [];
  const uvs       = [];
  const objects   = [];
  let current = { name: 'default', faces: [] };
  objects.push(current);

  // Itera as linhas; ignora comentários e linhas vazias.
  const lines = text.split('\n');
  for (let raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;

    const parts = line.split(/\s+/);
    const tag = parts[0];

    if (tag === 'o') {
      // Novo bloco de objeto. O nome pode ter espaços; pega tudo depois do 'o '.
      const name = line.slice(2).trim();
      // Se o primeiro 'o' aparece antes de qualquer face, sobrescrevemos o default.
      if (current.faces.length === 0 && objects.length === 1) {
        current.name = name;
      } else {
        current = { name, faces: [] };
        objects.push(current);
      }
    }
    else if (tag === 'v') {
      // Vértice de posição.
      positions.push([parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])]);
    }
    else if (tag === 'vn') {
      // Vértice de normal.
      normals.push([parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])]);
    }
    else if (tag === 'vt') {
      // Coord de textura.
      uvs.push([parseFloat(parts[1]), parseFloat(parts[2])]);
    }
    else if (tag === 'f') {
      // Face: cada parte é "v/vt/vn" (vt e vn opcionais).
      // OBJ pode ter face com >3 vértices (quad ou n-gon).
      // Triangulamos com fan: (0, i, i+1) pra i de 1 a n-2.
      const verts = parts.slice(1).map(parseFaceVertex);
      for (let i = 1; i < verts.length - 1; i++) {
        current.faces.push([verts[0], verts[i], verts[i + 1]]);
      }
    }
    // Demais tags (usemtl, mtllib, s, g) são ignoradas intencionalmente.
  }

  return { positions, normals, uvs, objects };
}

/**
 * Parseia um vértice de face no formato "v", "v/vt", "v//vn" ou "v/vt/vn".
 * Índices no OBJ são 1-based; mantemos assim aqui (corrigimos pra 0-based no consumidor).
 *
 * @param {string} s
 * @returns {{ v: number, vt?: number, vn?: number }}
 */
function parseFaceVertex(s) {
  const [v, vt, vn] = s.split('/');
  return {
    v: parseInt(v, 10),
    vt: vt ? parseInt(vt, 10) : undefined,
    vn: vn ? parseInt(vn, 10) : undefined,
  };
}
```

- [ ] **Step 2: Criar `assets/models.json` com uma entrada de teste (Pistol)**

```json
{
  "models": [
    {
      "id": "pistol",
      "name": "Pistol",
      "obj": "RetroWeaponPack_V1 Assets/RetroWeaponsPack/Guns/Pistol_01/FbxFiles/Pistol_01.obj",
      "texture": "RetroWeaponPack_V1 Assets/RetroWeaponsPack/Guns/Pistol_01/Textures/Pistol_01_Albedo.png",
      "merge": true
    }
  ]
}
```

Vamos preencher o resto na T5.

- [ ] **Step 3: Atualizar `src/main.js` pra carregar e desenhar a pistola**

Substituir o conteúdo de `src/main.js`:

```js
// src/main.js — entry point do editor.
// Etapa atual: carregar UM modelo OBJ + textura e renderizar.

import * as twgl from './lib/twgl-full.module.js';
import { m4 } from './lib/m4.js';
import { createPrograms } from './gl/program.js';
import { loadObj } from './gl/obj-loader.js';

const canvas = document.getElementById('main-canvas');
const gl = canvas.getContext('webgl2');
if (!gl) { alert('WebGL2 não suportado'); throw new Error('webgl2 indisponível'); }

const programs = createPrograms(gl);

// ---- Carregar modelo + textura (assíncrono) ----------------------------------

async function bootstrap() {
  // Carrega o catálogo (por enquanto só 1 modelo).
  const catalog = await fetch('assets/models.json').then(r => r.json());
  const modelDef = catalog.models[0];

  // Carrega geometria.
  const model = await loadObj(gl, modelDef.obj, { merge: modelDef.merge });

  // Carrega textura.
  // A textura é carregada de forma assíncrona; twgl.createTexture chama o callback
  // quando termina (e devolve um placeholder enquanto carrega).
  const texture = await new Promise((resolve, reject) => {
    const tex = twgl.createTexture(gl, {
      src: modelDef.texture,
      minMag: gl.NEAREST,  // visual retrô; depois fica configurável por nó.
      wrap: gl.REPEAT,
      flipY: 1,
    }, (err, tex) => err ? reject(err) : resolve(tex));
  });

  // Inicia o loop principal.
  startRenderLoop(model, texture);
}

function startRenderLoop(model, texture) {
  let tempoInicioMs = performance.now();

  function mainLoop() {
    resizeCanvas();

    gl.clearColor(0.1, 0.12, 0.15, 1.0);
    gl.enable(gl.DEPTH_TEST);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Câmera orbitando lentamente em torno do modelo, pra ver os 360°.
    const t = (performance.now() - tempoInicioMs) / 1000;
    const cameraDistance = 0.4;
    const cameraPos = [
      Math.sin(t * 0.3) * cameraDistance,
      0.1,
      Math.cos(t * 0.3) * cameraDistance,
    ];
    const target = [0, 0.05, 0];   // modelos do pack são bem pequenos
    const view = m4.lookAt(cameraPos, target, [0, 1, 0]);
    const aspect = canvas.width / canvas.height;
    const projection = m4.perspective(Math.PI / 3, aspect, 0.01, 100);
    const viewProjection = m4.multiply(projection, m4.inverse(view));

    // Transform do modelo (centro do mundo).
    const world = m4.identity();
    const worldInverseTranspose = m4.transpose(m4.inverse(world));

    gl.useProgram(programs.main.program);
    twgl.setBuffersAndAttributes(gl, programs.main, model.bufferInfo);
    twgl.setUniforms(programs.main, {
      u_viewProjection: viewProjection,
      u_worldMatrix: world,
      u_worldInverseTranspose: worldInverseTranspose,
      u_albedo: texture,
      u_lightDir: m4.normalize([0.3, 0.7, 0.5]),
      u_ambient: 0.25,
      u_tile: [1, 1],
    });
    twgl.drawBufferInfo(gl, model.bufferInfo);

    requestAnimationFrame(mainLoop);
  }
  requestAnimationFrame(mainLoop);
}

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const w = Math.floor(canvas.clientWidth * dpr);
  const h = Math.floor(canvas.clientHeight * dpr);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w; canvas.height = h;
  }
  gl.viewport(0, 0, canvas.width, canvas.height);
}

bootstrap().catch(err => {
  console.error('[main] erro no bootstrap:', err);
  alert('Erro ao iniciar: ' + err.message);
});
```

- [ ] **Step 4: Verificar no navegador**

Recarregar `http://localhost:8000/`. Esperado:
- Modelo da pistola aparece no centro do canvas, rotacionando lentamente.
- Textura visível (albedo do pack).
- Iluminação Lambert: lado iluminado mais claro, lado oposto mais escuro.
- Console: sem erros vermelhos.

Se aparecer sólido preto: provavelmente a textura não carregou (verificar Network tab). Se aparecer wireframe estranho: provavelmente a triangulação está errada (verificar parser na console).

---

# Fase 2 — Grafo de cena

## Task 5: Criar Catalog e preencher os 16 modelos

**Files:**
- Create: `src/scene/catalog.js`
- Modify: `assets/models.json` (preencher com todas as entradas)
- Modify: `src/main.js` (usar Catalog)

**O que esta task faz:** transforma o carregamento ad-hoc da T4 num Catalog reutilizável que carrega TODOS os modelos uma vez no startup. Cada modelo ganha um `bufferInfo` único, um `vao` único e uma textura única — todos vivem só no Catalog (não duplicados por nó).

- [ ] **Step 1: Descobrir os nomes dos 8 projéteis**

Rodar no terminal pra listar os blocos `o ...` do `Projectiles.obj`:

```bash
grep "^o " "RetroWeaponPack_V1 Assets/RetroWeaponsPack/Guns/AdditionalMeshes/Projectiles/FbxFile/Projectiles.obj"
```

Esperado: 8 linhas com nomes (ex: `o BulletShell`, `o Bullet_Small`, etc). Anotar os 8 nomes pra usar no JSON.

- [ ] **Step 2: Preencher `assets/models.json` com todas as 16 entradas**

Substituir o conteúdo de `assets/models.json` por (ajustando os 8 nomes de projétil conforme o passo anterior):

```json
{
  "models": [
    { "id": "pistol",  "name": "Pistol",  "obj": "RetroWeaponPack_V1 Assets/RetroWeaponsPack/Guns/Pistol_01/FbxFiles/Pistol_01.obj",  "texture": "RetroWeaponPack_V1 Assets/RetroWeaponsPack/Guns/Pistol_01/Textures/Pistol_01_Albedo.png",  "merge": true },
    { "id": "rifle",   "name": "Rifle",   "obj": "RetroWeaponPack_V1 Assets/RetroWeaponsPack/Guns/Rifle_01/Fbx_Files/Rifle_01.obj",   "texture": "RetroWeaponPack_V1 Assets/RetroWeaponsPack/Guns/Rifle_01/Textures/Rifle_01_Albedo.png",   "merge": true },
    { "id": "shotgun", "name": "Shotgun", "obj": "RetroWeaponPack_V1 Assets/RetroWeaponsPack/Guns/Shotgun_01/FbxFiles/Shotgun_01.obj", "texture": "RetroWeaponPack_V1 Assets/RetroWeaponsPack/Guns/Shotgun_01/Textures/Shotgun_01_Albedo.png", "merge": true },
    { "id": "smg",     "name": "SMG",     "obj": "RetroWeaponPack_V1 Assets/RetroWeaponsPack/Guns/SMG_01/Fbx_Files/SMG_01.obj",       "texture": "RetroWeaponPack_V1 Assets/RetroWeaponsPack/Guns/SMG_01/Textures/SMG_01_Albedo.png",       "merge": true },

    { "id": "block_cube",    "name": "Cube",             "obj": "RetroWeaponPack_V1 Assets/BlockoutAssets/BasicBlockoutMeshes.obj", "objectName": "Blockout_Cube" },
    { "id": "block_plane_c", "name": "Plane (centered)", "obj": "RetroWeaponPack_V1 Assets/BlockoutAssets/BasicBlockoutMeshes.obj", "objectName": "Blockout_Plane_Centered" },
    { "id": "block_plane",   "name": "Plane",            "obj": "RetroWeaponPack_V1 Assets/BlockoutAssets/BasicBlockoutMeshes.obj", "objectName": "Blockout_Plane" },
    { "id": "block_capsule", "name": "Capsule",          "obj": "RetroWeaponPack_V1 Assets/BlockoutAssets/BasicBlockoutMeshes.obj", "objectName": "Capsule" },

    { "id": "proj_1", "name": "Projétil 1", "obj": "RetroWeaponPack_V1 Assets/RetroWeaponsPack/Guns/AdditionalMeshes/Projectiles/FbxFile/Projectiles.obj", "texture": "RetroWeaponPack_V1 Assets/RetroWeaponsPack/Guns/AdditionalMeshes/Projectiles/Texture/Projectiles_Albedo.png", "objectName": "AJUSTAR_NOME_1" },
    { "id": "proj_2", "name": "Projétil 2", "obj": "RetroWeaponPack_V1 Assets/RetroWeaponsPack/Guns/AdditionalMeshes/Projectiles/FbxFile/Projectiles.obj", "texture": "RetroWeaponPack_V1 Assets/RetroWeaponsPack/Guns/AdditionalMeshes/Projectiles/Texture/Projectiles_Albedo.png", "objectName": "AJUSTAR_NOME_2" },
    { "id": "proj_3", "name": "Projétil 3", "obj": "RetroWeaponPack_V1 Assets/RetroWeaponsPack/Guns/AdditionalMeshes/Projectiles/FbxFile/Projectiles.obj", "texture": "RetroWeaponPack_V1 Assets/RetroWeaponsPack/Guns/AdditionalMeshes/Projectiles/Texture/Projectiles_Albedo.png", "objectName": "AJUSTAR_NOME_3" },
    { "id": "proj_4", "name": "Projétil 4", "obj": "RetroWeaponPack_V1 Assets/RetroWeaponsPack/Guns/AdditionalMeshes/Projectiles/FbxFile/Projectiles.obj", "texture": "RetroWeaponPack_V1 Assets/RetroWeaponsPack/Guns/AdditionalMeshes/Projectiles/Texture/Projectiles_Albedo.png", "objectName": "AJUSTAR_NOME_4" },
    { "id": "proj_5", "name": "Projétil 5", "obj": "RetroWeaponPack_V1 Assets/RetroWeaponsPack/Guns/AdditionalMeshes/Projectiles/FbxFile/Projectiles.obj", "texture": "RetroWeaponPack_V1 Assets/RetroWeaponsPack/Guns/AdditionalMeshes/Projectiles/Texture/Projectiles_Albedo.png", "objectName": "AJUSTAR_NOME_5" },
    { "id": "proj_6", "name": "Projétil 6", "obj": "RetroWeaponPack_V1 Assets/RetroWeaponsPack/Guns/AdditionalMeshes/Projectiles/FbxFile/Projectiles.obj", "texture": "RetroWeaponPack_V1 Assets/RetroWeaponsPack/Guns/AdditionalMeshes/Projectiles/Texture/Projectiles_Albedo.png", "objectName": "AJUSTAR_NOME_6" },
    { "id": "proj_7", "name": "Projétil 7", "obj": "RetroWeaponPack_V1 Assets/RetroWeaponsPack/Guns/AdditionalMeshes/Projectiles/FbxFile/Projectiles.obj", "texture": "RetroWeaponPack_V1 Assets/RetroWeaponsPack/Guns/AdditionalMeshes/Projectiles/Texture/Projectiles_Albedo.png", "objectName": "AJUSTAR_NOME_7" },
    { "id": "proj_8", "name": "Projétil 8", "obj": "RetroWeaponPack_V1 Assets/RetroWeaponsPack/Guns/AdditionalMeshes/Projectiles/FbxFile/Projectiles.obj", "texture": "RetroWeaponPack_V1 Assets/RetroWeaponsPack/Guns/AdditionalMeshes/Projectiles/Texture/Projectiles_Albedo.png", "objectName": "AJUSTAR_NOME_8" }
  ]
}
```

**IMPORTANTE:** substituir os `AJUSTAR_NOME_N` pelos nomes reais que apareceram no `grep`. Se sobrarem menos de 8, deletar as entradas extras.

- [ ] **Step 3: Criar `src/scene/catalog.js`**

```js
// src/scene/catalog.js
// Catálogo de modelos — singleton que carrega TODOS os modelos do projeto UMA VEZ
// e expõe acesso por modelId. Atende o requisito do enunciado:
//   "o modelo só pode existir 1 vez na memória".

import * as twgl from '../lib/twgl-full.module.js';
import { loadObj } from '../gl/obj-loader.js';

/**
 * Estrutura interna de cada modelo do catálogo:
 *
 * {
 *   id:          string,           // identificador único (ex: "pistol")
 *   name:        string,           // nome amigável (ex: "Pistol")
 *   bufferInfo:  twgl.BufferInfo,  // geometria pronta pra setBuffersAndAttributes
 *   vao:         WebGLVertexArrayObject, // criado a partir do bufferInfo
 *   texture:     WebGLTexture,     // textura albedo
 *   vertexCount: number,           // pra estatísticas
 * }
 */
export class Catalog {
  constructor() {
    /** @type {Map<string, object>} */
    this.models = new Map();
  }

  /**
   * Carrega todos os modelos definidos em models.json.
   *
   * @param {WebGL2RenderingContext} gl
   * @param {object} programInfoMain - o ProgramInfo do programa main (precisa pra criar VAO)
   * @returns {Promise<void>}
   */
  async loadAll(gl, programInfoMain) {
    const catalog = await fetch('assets/models.json').then(r => r.json());

    // Carrega em paralelo pra ir mais rápido.
    await Promise.all(catalog.models.map(def => this._loadOne(gl, programInfoMain, def)));

    console.log(`[catalog] ${this.models.size} modelos carregados`);
  }

  async _loadOne(gl, programInfoMain, def) {
    // Geometria
    const objResult = await loadObj(gl, def.obj, {
      merge: def.merge ?? false,
      objectName: def.objectName,
    });

    // VAO — criado a partir do bufferInfo e do programa.
    // O mesmo VAO funciona pro programa "picking" porque ele só usa a_position
    // (que está no bufferInfo).
    const vao = twgl.createVAOFromBufferInfo(gl, programInfoMain, objResult.bufferInfo);

    // Textura. Modelos sem textura própria (blockouts) recebem placeholder branco.
    let texture;
    if (def.texture) {
      texture = await new Promise((resolve, reject) => {
        const tex = twgl.createTexture(gl, {
          src: def.texture,
          minMag: gl.NEAREST,
          wrap: gl.REPEAT,
          flipY: 1,
        }, (err, tex) => err ? reject(err) : resolve(tex));
      });
    } else {
      // Textura branca 1×1 — pros blockouts ficarem cinza claro com a luz.
      texture = twgl.createTexture(gl, {
        src: [200, 200, 200, 255], width: 1, height: 1,
      });
    }

    this.models.set(def.id, {
      id: def.id,
      name: def.name,
      bufferInfo: objResult.bufferInfo,
      vao,
      texture,
      vertexCount: objResult.vertexCount,
    });
  }

  /** Devolve o modelo com esse id, ou null se não existe. */
  get(modelId) {
    return this.models.get(modelId) ?? null;
  }

  /** Devolve um array com todos os modelos (pra iteração no menu). */
  list() {
    return Array.from(this.models.values());
  }
}
```

- [ ] **Step 4: Atualizar `src/main.js` pra usar o Catalog**

Substituir o conteúdo:

```js
// src/main.js — entry point do editor.
// Esta etapa: carrega TODOS os modelos via Catalog e renderiza o primeiro
// como sanity-check (a partir da T7 isso vai ser um loop por nós da cena).

import * as twgl from './lib/twgl-full.module.js';
import { m4 } from './lib/m4.js';
import { createPrograms } from './gl/program.js';
import { Catalog } from './scene/catalog.js';

const canvas = document.getElementById('main-canvas');
const gl = canvas.getContext('webgl2');
if (!gl) { alert('WebGL2 não suportado'); throw new Error('webgl2 indisponível'); }

const programs = createPrograms(gl);
const catalog = new Catalog();

async function bootstrap() {
  await catalog.loadAll(gl, programs.main);
  startRenderLoop();
}

function startRenderLoop() {
  let tempoInicioMs = performance.now();

  function mainLoop() {
    resizeCanvas();
    gl.clearColor(0.1, 0.12, 0.15, 1.0);
    gl.enable(gl.DEPTH_TEST);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Câmera orbitando em torno do primeiro modelo.
    const t = (performance.now() - tempoInicioMs) / 1000;
    const cameraDistance = 0.4;
    const cameraPos = [
      Math.sin(t * 0.3) * cameraDistance,
      0.1,
      Math.cos(t * 0.3) * cameraDistance,
    ];
    const view = m4.lookAt(cameraPos, [0, 0.05, 0], [0, 1, 0]);
    const aspect = canvas.width / canvas.height;
    const projection = m4.perspective(Math.PI / 3, aspect, 0.01, 100);
    const viewProjection = m4.multiply(projection, m4.inverse(view));

    // Renderiza o primeiro modelo do catálogo no centro.
    const model = catalog.list()[0];
    const world = m4.identity();
    const worldInverseTranspose = m4.transpose(m4.inverse(world));

    gl.useProgram(programs.main.program);
    gl.bindVertexArray(model.vao);
    twgl.setUniforms(programs.main, {
      u_viewProjection: viewProjection,
      u_worldMatrix: world,
      u_worldInverseTranspose: worldInverseTranspose,
      u_albedo: model.texture,
      u_lightDir: m4.normalize([0.3, 0.7, 0.5]),
      u_ambient: 0.25,
      u_tile: [1, 1],
    });
    twgl.drawBufferInfo(gl, model.bufferInfo);
    gl.bindVertexArray(null);

    requestAnimationFrame(mainLoop);
  }
  requestAnimationFrame(mainLoop);
}

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const w = Math.floor(canvas.clientWidth * dpr);
  const h = Math.floor(canvas.clientHeight * dpr);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w; canvas.height = h;
  }
  gl.viewport(0, 0, canvas.width, canvas.height);
}

bootstrap().catch(err => {
  console.error('[main] erro no bootstrap:', err);
  alert('Erro ao iniciar: ' + err.message);
});
```

- [ ] **Step 5: Verificar no navegador**

Recarregar. Esperado:
- Pistola rotacionando (igual à T4).
- Console: `[catalog] 16 modelos carregados` (ou menos se ajustou projéteis).
- Nenhum erro na aba Network (todos os OBJs + PNGs com status 200).

Se algum OBJ falhar (404), o path no `models.json` está errado — checar pasta real.

---

## Task 6: SceneNode — data structure

**Files:**
- Create: `src/scene/node.js`

**O que esta task faz:** define a classe `SceneNode` com todas as propriedades de transform/animação/textura. Sem comportamento ainda — só dados + métodos triviais (serializar/desserializar). Comportamento vem na T7 (Scene) e T8 (animation).

- [ ] **Step 1: Criar `src/scene/node.js`**

```js
// src/scene/node.js
// SceneNode — uma instância de um modelo dentro da cena.
//
// Cada nó referencia o modelo pelo modelId (não duplica buffers/texturas).
// Tem transform local, propriedades de animação contínua, e overrides
// opcionais de textura/filtro/tile.

import { m4 } from '../lib/m4.js';

let _nextId = 1;
let _nextPickingId = 1;  // 0 fica reservado pra "nenhum nó" no picking

/**
 * Gera um ID curto único pro nó (ex: "node_001", "node_002"...).
 * @returns {string}
 */
function generateNodeId() {
  const id = String(_nextId).padStart(3, '0');
  _nextId++;
  return `node_${id}`;
}

export class SceneNode {
  /**
   * @param {object} opts
   * @param {string}  opts.modelId        - id do modelo no Catalog (obrigatório)
   * @param {string}  [opts.id]           - id custom (default: gera novo)
   * @param {string}  [opts.name]         - nome amigável (default: igual ao modelId)
   * @param {number[]} [opts.position]    - [x,y,z]
   * @param {number[]} [opts.rotation]    - [rx,ry,rz] em radianos
   * @param {number[]} [opts.scale]       - [sx,sy,sz]
   * @param {number[]} [opts.animDir]     - direção da translação contínua
   * @param {number}   [opts.animSpeed]   - velocidade linear (unidades/s)
   * @param {number[]} [opts.animRotSpeed]- velocidade angular por eixo (rad/s)
   * @param {string?}  [opts.textureOverride] - modelId cuja textura usar; null = própria
   * @param {string}   [opts.textureFilter]   - "nearest" | "linear"
   * @param {number}   [opts.tileU]
   * @param {number}   [opts.tileV]
   */
  constructor(opts) {
    if (!opts.modelId) throw new Error('SceneNode precisa de modelId');

    this.id      = opts.id   ?? generateNodeId();
    this.name    = opts.name ?? opts.modelId;
    this.modelId = opts.modelId;

    // Hierarquia — preenchida pelo Scene; nunca mexer direto aqui de fora.
    this.parent   = null;
    this.children = [];

    // Transform local — defaults: na origem, sem rotação, escala 1.
    this.position = opts.position ? [...opts.position] : [0, 0, 0];
    this.rotation = opts.rotation ? [...opts.rotation] : [0, 0, 0];
    this.scale    = opts.scale    ? [...opts.scale]    : [1, 1, 1];

    // Animação — defaults: parado.
    this.animDir      = opts.animDir      ? [...opts.animDir]      : [0, 0, 0];
    this.animSpeed    = opts.animSpeed    ?? 0;
    this.animRotSpeed = opts.animRotSpeed ? [...opts.animRotSpeed] : [0, 0, 0];

    // Textura — defaults: usa a do próprio modelo, nearest, sem tile.
    this.textureOverride = opts.textureOverride ?? null;
    this.textureFilter   = opts.textureFilter   ?? 'nearest';
    this.tileU = opts.tileU ?? 1.0;
    this.tileV = opts.tileV ?? 1.0;

    // ---- Cache de runtime (NÃO vai pro JSON) ----
    // Matriz mundo recalculada por Scene.updateWorldMatrices a cada frame.
    this.worldMatrix = m4.identity();

    // ID único de picking — codificado como cor RGBA no shader de picking.
    // Reserva 0 pra "vazio", usa uint32 incremental.
    this.pickingId = _nextPickingId++;
  }

  /**
   * Serializa o nó pra um objeto plain (JSON-safe).
   * Não inclui cache (worldMatrix, pickingId).
   * @returns {object}
   */
  toJson() {
    return {
      id:       this.id,
      name:     this.name,
      modelId:  this.modelId,
      parentId: this.parent?.id ?? null,
      position: [...this.position],
      rotation: [...this.rotation],
      scale:    [...this.scale],
      animDir:  [...this.animDir],
      animSpeed: this.animSpeed,
      animRotSpeed: [...this.animRotSpeed],
      textureOverride: this.textureOverride,
      textureFilter: this.textureFilter,
      tileU: this.tileU,
      tileV: this.tileV,
    };
  }

  /**
   * Cria um SceneNode a partir de um objeto plain (vindo de JSON).
   * NOTA: parent fica null aqui; quem chama é responsável por chamar
   * scene.setParent(node, parent) depois usando parentId.
   * @param {object} data
   * @returns {SceneNode}
   */
  static fromJson(data) {
    return new SceneNode({
      id:       data.id,
      name:     data.name,
      modelId:  data.modelId,
      position: data.position,
      rotation: data.rotation,
      scale:    data.scale,
      animDir:  data.animDir,
      animSpeed: data.animSpeed,
      animRotSpeed: data.animRotSpeed,
      textureOverride: data.textureOverride,
      textureFilter: data.textureFilter,
      tileU: data.tileU,
      tileV: data.tileV,
    });
  }
}
```

(Não há teste manual aqui — vamos exercitar SceneNode quando integrarmos na Scene.)

---

## Task 7: Scene — árvore, traversal e seleção

**Files:**
- Create: `src/scene/scene.js`

**O que esta task faz:** implementa a classe `Scene` que mantém a árvore de nós, faz traversal pra `updateWorldMatrices`, gerencia hierarquia (add/remove/reparent), e emite eventos de seleção.

- [ ] **Step 1: Criar `src/scene/scene.js`**

```js
// src/scene/scene.js
// Scene — contém a árvore de SceneNodes editada pelo usuário.
//
// Responsabilidades:
//   - Manter os nós e a hierarquia parent->children.
//   - Recalcular worldMatrix de cada nó (traversal recursivo).
//   - Gerenciar qual nó está selecionado.
//   - Disparar eventos quando algo muda (pra UI reagir).

import { m4 } from '../lib/m4.js';
import { SceneNode } from './node.js';

export class Scene {
  constructor() {
    /** @type {SceneNode[]} - nós que não têm parent (filhos da raiz virtual) */
    this.rootNodes = [];

    /** @type {Map<string, SceneNode>} - índice id -> nó pra lookup rápido */
    this.nodesById = new Map();

    /** @type {SceneNode|null} - nó atualmente selecionado pelo usuário */
    this.selectedNode = null;

    /** @type {Object<string, Array<Function>>} - listeners de eventos */
    this._listeners = {};
  }

  // ---- Eventos -------------------------------------------------------------

  /**
   * Registra um callback pra um evento.
   * Eventos disparados:
   *   - "selectionChanged" (sem args): seleção mudou (selecionar ou desselecionar)
   *   - "structureChanged" (sem args): nó adicionado/removido/reparentado
   *   - "nodeChanged" (node): props de um nó mudaram (chamado por UI externa)
   */
  on(event, callback) {
    (this._listeners[event] ??= []).push(callback);
  }
  _emit(event, ...args) {
    for (const cb of this._listeners[event] ?? []) cb(...args);
  }

  // ---- Adicionar / remover nós --------------------------------------------

  /**
   * Adiciona um nó novo à cena.
   * @param {object} opts - opções pro SceneNode (precisa de modelId; resto opcional)
   * @param {SceneNode|null} [parent] - parent (default: raiz)
   * @returns {SceneNode}
   */
  addNode(opts, parent = null) {
    const node = new SceneNode(opts);
    this._attach(node, parent);
    this._emit('structureChanged');
    return node;
  }

  /**
   * Adiciona um SceneNode já criado (usado pelo loader de JSON).
   * @param {SceneNode} node
   * @param {SceneNode|null} [parent]
   */
  _attachExisting(node, parent = null) {
    this._attach(node, parent);
  }

  _attach(node, parent) {
    this.nodesById.set(node.id, node);
    if (parent) {
      parent.children.push(node);
      node.parent = parent;
    } else {
      this.rootNodes.push(node);
    }
  }

  /**
   * Remove um nó e todos seus descendentes da cena.
   * @param {SceneNode} node
   */
  removeNode(node) {
    // Coleta descendentes (incluindo o próprio) pra remover do índice.
    const toRemove = [];
    const stack = [node];
    while (stack.length > 0) {
      const n = stack.pop();
      toRemove.push(n);
      stack.push(...n.children);
    }
    for (const n of toRemove) this.nodesById.delete(n.id);

    // Desconecta do parent.
    if (node.parent) {
      const idx = node.parent.children.indexOf(node);
      node.parent.children.splice(idx, 1);
    } else {
      const idx = this.rootNodes.indexOf(node);
      this.rootNodes.splice(idx, 1);
    }

    // Limpa seleção se o nó removido (ou descendente) estava selecionado.
    if (this.selectedNode && toRemove.includes(this.selectedNode)) {
      this.selectedNode = null;
      this._emit('selectionChanged');
    }

    this._emit('structureChanged');
  }

  /**
   * Muda o parent de um nó (reparent).
   * Detecta ciclos: se newParent é descendente de node, recusa.
   * @param {SceneNode} node
   * @param {SceneNode|null} newParent - null = vira filho da raiz
   */
  setParent(node, newParent) {
    if (newParent && this._isDescendantOf(newParent, node)) {
      console.warn('[scene] reparent ignorado: criaria ciclo');
      return;
    }

    // Tira do parent atual.
    if (node.parent) {
      const idx = node.parent.children.indexOf(node);
      node.parent.children.splice(idx, 1);
    } else {
      const idx = this.rootNodes.indexOf(node);
      this.rootNodes.splice(idx, 1);
    }

    // Adiciona no novo parent.
    if (newParent) {
      newParent.children.push(node);
      node.parent = newParent;
    } else {
      this.rootNodes.push(node);
      node.parent = null;
    }

    this._emit('structureChanged');
  }

  /** Verifica se `candidate` é descendente de `ancestor`. */
  _isDescendantOf(candidate, ancestor) {
    let n = candidate.parent;
    while (n) {
      if (n === ancestor) return true;
      n = n.parent;
    }
    return false;
  }

  // ---- Seleção -------------------------------------------------------------

  /**
   * Seleciona um nó (ou null pra desselecionar).
   * Dispara "selectionChanged" se mudou.
   */
  select(node) {
    if (this.selectedNode === node) return;
    this.selectedNode = node;
    this._emit('selectionChanged');
  }

  // ---- Traversal -----------------------------------------------------------

  /** Devolve TODOS os nós da cena em ordem topológica (pai antes do filho). */
  getAllNodes() {
    const out = [];
    const walk = (node) => {
      out.push(node);
      for (const c of node.children) walk(c);
    };
    for (const root of this.rootNodes) walk(root);
    return out;
  }

  /**
   * Recalcula worldMatrix de cada nó.
   * Deve ser chamado todo frame, ANTES de renderizar.
   */
  updateWorldMatrices() {
    const walk = (node, parentWorld) => {
      // Local = T(position) * R(rotation) * S(scale)
      // m4.js: cada função multiplica DA DIREITA, então a ordem é translation
      // -> xRotate -> yRotate -> zRotate -> scale (lê de baixo pra cima).
      let local = m4.translation(node.position[0], node.position[1], node.position[2]);
      local = m4.xRotate(local, node.rotation[0]);
      local = m4.yRotate(local, node.rotation[1]);
      local = m4.zRotate(local, node.rotation[2]);
      local = m4.scale(local, node.scale[0], node.scale[1], node.scale[2]);

      // World = parentWorld * local.
      node.worldMatrix = m4.multiply(parentWorld, local);

      for (const c of node.children) walk(c, node.worldMatrix);
    };
    const identity = m4.identity();
    for (const root of this.rootNodes) walk(root, identity);
  }

  /**
   * Agrupa todos os nós por modelId — usado pelo renderer pra
   * dar bind do VAO uma vez por modelo.
   * @returns {Map<string, SceneNode[]>}
   */
  groupNodesByModelId() {
    const groups = new Map();
    for (const node of this.getAllNodes()) {
      if (!groups.has(node.modelId)) groups.set(node.modelId, []);
      groups.get(node.modelId).push(node);
    }
    return groups;
  }

  // ---- Persistência (placeholder; lógica completa vai pra T15) -------------

  /** Limpa a cena toda. */
  clear() {
    this.rootNodes = [];
    this.nodesById.clear();
    this.selectedNode = null;
    this._emit('structureChanged');
    this._emit('selectionChanged');
  }
}
```

---

## Task 8: Animação + renderer que percorre a cena

**Files:**
- Create: `src/scene/animation.js`
- Modify: `src/main.js`

**O que esta task faz:** implementa `updateAnimations(scene, dt)` (integra translação e rotação contínuas), e troca o render hardcoded da T5 por um render que percorre `scene.groupNodesByModelId()` e desenha cada instância. No fim, conseguimos adicionar manualmente 2-3 nós à cena via console e ver eles aparecem com transforms próprios.

- [ ] **Step 1: Criar `src/scene/animation.js`**

```js
// src/scene/animation.js
// Lógica de animação contínua: avança position e rotation de cada nó
// pelo delta time (dt em segundos).

/**
 * Aplica animação a todos os nós da cena.
 *
 * Para cada nó:
 *   position += animDir * animSpeed * dt
 *   rotation += animRotSpeed * dt
 *
 * Integração simples (Euler explícito). Pra esse projeto, basta.
 *
 * @param {import('./scene.js').Scene} scene
 * @param {number} dt - segundos desde o último frame
 */
export function updateAnimations(scene, dt) {
  for (const node of scene.getAllNodes()) {
    // Translação: anda na direção configurada vezes velocidade.
    node.position[0] += node.animDir[0] * node.animSpeed * dt;
    node.position[1] += node.animDir[1] * node.animSpeed * dt;
    node.position[2] += node.animDir[2] * node.animSpeed * dt;

    // Rotação: gira por eixo conforme velocidade angular.
    node.rotation[0] += node.animRotSpeed[0] * dt;
    node.rotation[1] += node.animRotSpeed[1] * dt;
    node.rotation[2] += node.animRotSpeed[2] * dt;
  }
}
```

- [ ] **Step 2: Atualizar `src/main.js` pra usar Scene + animação**

Substituir o conteúdo:

```js
// src/main.js — entry point do editor.
// Esta etapa: integra Scene + animação. Adiciona alguns nós de teste via
// console pra confirmar que múltiplas instâncias compartilham VAO.

import * as twgl from './lib/twgl-full.module.js';
import { m4 } from './lib/m4.js';
import { createPrograms } from './gl/program.js';
import { Catalog } from './scene/catalog.js';
import { Scene } from './scene/scene.js';
import { updateAnimations } from './scene/animation.js';

const canvas = document.getElementById('main-canvas');
const gl = canvas.getContext('webgl2');
if (!gl) { alert('WebGL2 não suportado'); throw new Error('webgl2 indisponível'); }

const programs = createPrograms(gl);
const catalog = new Catalog();
const scene = new Scene();

// Expõe no window pra debug no console — REMOVER ANTES DE ENTREGAR.
window.catalog = catalog;
window.scene = scene;
window.m4 = m4;

async function bootstrap() {
  await catalog.loadAll(gl, programs.main);

  // Cena inicial: 2 pistolas e 1 cubo, espaçadas, pra ver compartilhamento de VAO.
  // (Depois das T11+ a cena começa vazia — o usuário adiciona via menu.)
  scene.addNode({ modelId: 'pistol', name: 'Pistola A', position: [-0.15, 0, 0],
                  animRotSpeed: [0, 0.5, 0] });
  scene.addNode({ modelId: 'pistol', name: 'Pistola B', position: [ 0.15, 0, 0],
                  animRotSpeed: [0, -0.5, 0] });
  scene.addNode({ modelId: 'block_cube', name: 'Cubo', position: [0, -0.1, 0],
                  scale: [0.1, 0.02, 0.1] });

  startRenderLoop();
}

let lastFrameMs = 0;

function startRenderLoop() {
  function mainLoop(tempoAtualMs) {
    const dt = lastFrameMs ? (tempoAtualMs - lastFrameMs) / 1000 : 0;
    lastFrameMs = tempoAtualMs;

    resizeCanvas();

    // 1. Avança animações.
    updateAnimations(scene, dt);
    // 2. Recalcula matrizes mundo.
    scene.updateWorldMatrices();

    // 3. Desenha.
    gl.clearColor(0.1, 0.12, 0.15, 1.0);
    gl.enable(gl.DEPTH_TEST);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    drawScene();

    requestAnimationFrame(mainLoop);
  }
  requestAnimationFrame(mainLoop);
}

/**
 * Desenha a cena agrupando nós por modelId — bind do VAO acontece UMA VEZ
 * por modelo, depois loop pelas instâncias.
 *
 * Câmera por enquanto é estática (vai ficar interativa na T9).
 */
function drawScene() {
  const aspect = canvas.width / canvas.height;
  const projection = m4.perspective(Math.PI / 3, aspect, 0.01, 100);
  const view = m4.lookAt([0, 0.2, 0.6], [0, 0, 0], [0, 1, 0]);
  const viewProjection = m4.multiply(projection, m4.inverse(view));

  gl.useProgram(programs.main.program);

  const groups = scene.groupNodesByModelId();
  for (const [modelId, nodes] of groups) {
    const model = catalog.get(modelId);
    if (!model) continue;

    // Bind do VAO UMA VEZ por modelo.
    gl.bindVertexArray(model.vao);

    for (const node of nodes) {
      // Override de textura? Pega a textura de outro modelo.
      const textureSource = node.textureOverride
        ? (catalog.get(node.textureOverride)?.texture ?? model.texture)
        : model.texture;

      // worldInverseTranspose pra normais resistirem a escalas não-uniformes.
      const worldInverseTranspose = m4.transpose(m4.inverse(node.worldMatrix));

      twgl.setUniforms(programs.main, {
        u_viewProjection: viewProjection,
        u_worldMatrix: node.worldMatrix,
        u_worldInverseTranspose: worldInverseTranspose,
        u_albedo: textureSource,
        u_lightDir: m4.normalize([0.3, 0.7, 0.5]),
        u_ambient: 0.25,
        u_tile: [node.tileU, node.tileV],
      });

      twgl.drawBufferInfo(gl, model.bufferInfo);
    }
  }

  gl.bindVertexArray(null);
}

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const w = Math.floor(canvas.clientWidth * dpr);
  const h = Math.floor(canvas.clientHeight * dpr);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w; canvas.height = h;
  }
  gl.viewport(0, 0, canvas.width, canvas.height);
}

bootstrap().catch(err => {
  console.error('[main] erro no bootstrap:', err);
  alert('Erro ao iniciar: ' + err.message);
});
```

- [ ] **Step 3: Verificar no navegador**

Recarregar. Esperado:
- Duas pistolas, espaçadas, **girando em direções opostas**.
- Um cubo achatado debaixo delas.
- No console, rodar: `scene.groupNodesByModelId().get('pistol').length` → deve devolver `2`.
- No console: `scene.getAllNodes()[0] === scene.getAllNodes()[1]` → `false` (são objetos diferentes).
- No console: `catalog.get('pistol').vao === catalog.get('pistol').vao` → `true` (mesma referência, geometria compartilhada).

---

# Fase 3 — Interação (câmera + picking)

## Task 9: Câmera orbital com controles de mouse

**Files:**
- Create: `src/interaction/camera.js`
- Modify: `src/main.js`

**O que esta task faz:** câmera orbital — clique-esquerdo arrasta = rotaciona em torno do alvo; scroll = zoom; clique-direito arrasta = pan do alvo.

- [ ] **Step 1: Criar `src/interaction/camera.js`**

```js
// src/interaction/camera.js
// Câmera orbital. O usuário controla com mouse:
//   - Clique esquerdo + arrastar -> rotaciona (azimute / elevação)
//   - Scroll                     -> zoom (distance)
//   - Clique direito + arrastar  -> pan (move target no plano de visão)
//
// Estado interno:
//   target    [x,y,z] - ponto pra onde ela olha
//   distance  number  - distância do target
//   azimuth   number  - rotação horizontal em torno do target (rad)
//   elevation number  - rotação vertical (rad), clamped pra não virar de cabeça pra baixo

import { m4 } from '../lib/m4.js';

const ELEVATION_LIMIT = Math.PI / 2 - 0.05;  // ~84 graus
const ZOOM_MIN = 0.05;
const ZOOM_MAX = 20;
const ROT_SENSITIVITY = 0.008;   // rad por pixel
const PAN_SENSITIVITY = 0.0015;  // unidades por pixel (proporcional a distance)
const ZOOM_SENSITIVITY = 1.1;    // multiplicativo por wheel tick

export class Camera {
  /**
   * @param {HTMLCanvasElement} canvas - usado pra eventos de mouse e dimensões
   */
  constructor(canvas) {
    this.canvas = canvas;

    // Estado inicial: 45° de elevação, distância 0.5, olhando pra origem.
    this.target    = [0, 0, 0];
    this.distance  = 0.5;
    this.azimuth   = 0.7;
    this.elevation = 0.4;

    // Estado de drag (preenchido nos handlers).
    this._dragMode = null;   // 'rotate' | 'pan' | null
    this._lastX = 0;
    this._lastY = 0;

    // Detecção clique-vs-drag (pra picking).
    this._mouseDownX = 0;
    this._mouseDownY = 0;
    this._mouseDownTime = 0;

    /** Callback chamado quando o usuário CLICA (sem drag). UI conecta picking aqui. */
    this.onClick = null;  // (x, y) => void

    this._installEventHandlers();
  }

  _installEventHandlers() {
    const c = this.canvas;
    c.addEventListener('mousedown', e => this._onMouseDown(e));
    c.addEventListener('mousemove', e => this._onMouseMove(e));
    c.addEventListener('mouseup',   e => this._onMouseUp(e));
    c.addEventListener('mouseleave', () => { this._dragMode = null; });
    c.addEventListener('wheel',     e => this._onWheel(e), { passive: false });
    // Desliga menu de contexto pra mouse direito poder ser usado como pan.
    c.addEventListener('contextmenu', e => e.preventDefault());
  }

  _onMouseDown(e) {
    this._lastX = e.clientX;
    this._lastY = e.clientY;
    this._mouseDownX = e.clientX;
    this._mouseDownY = e.clientY;
    this._mouseDownTime = performance.now();
    if (e.button === 0)      this._dragMode = 'rotate';
    else if (e.button === 2) this._dragMode = 'pan';
  }

  _onMouseMove(e) {
    if (!this._dragMode) return;
    const dx = e.clientX - this._lastX;
    const dy = e.clientY - this._lastY;
    this._lastX = e.clientX;
    this._lastY = e.clientY;

    if (this._dragMode === 'rotate') {
      this.azimuth   -= dx * ROT_SENSITIVITY;
      this.elevation += dy * ROT_SENSITIVITY;
      // Clamp pra não virar de cabeça pra baixo.
      this.elevation = Math.max(-ELEVATION_LIMIT, Math.min(ELEVATION_LIMIT, this.elevation));
    } else if (this._dragMode === 'pan') {
      // Pan: move target no plano de visão da câmera.
      // Calcula vetores right/up da câmera e desloca proporcional ao drag.
      const { right, up } = this._cameraBasis();
      const factor = PAN_SENSITIVITY * this.distance;
      this.target[0] -= (right[0] * dx - up[0] * dy) * factor;
      this.target[1] -= (right[1] * dx - up[1] * dy) * factor;
      this.target[2] -= (right[2] * dx - up[2] * dy) * factor;
    }
  }

  _onMouseUp(e) {
    const wasRotate = this._dragMode === 'rotate';
    this._dragMode = null;

    // Detecta clique (botão esquerdo, drag pequeno, duração curta).
    if (wasRotate && e.button === 0) {
      const movedX = e.clientX - this._mouseDownX;
      const movedY = e.clientY - this._mouseDownY;
      const dist = Math.sqrt(movedX * movedX + movedY * movedY);
      const duration = performance.now() - this._mouseDownTime;
      if (dist < 5 && duration < 300 && this.onClick) {
        // Coordenadas em pixels CSS do canvas (não DPR-multiplicados).
        const rect = this.canvas.getBoundingClientRect();
        this.onClick(e.clientX - rect.left, e.clientY - rect.top);
      }
    }
  }

  _onWheel(e) {
    e.preventDefault();
    // Scroll pra baixo (deltaY > 0) afasta; pra cima aproxima.
    const factor = e.deltaY > 0 ? ZOOM_SENSITIVITY : 1 / ZOOM_SENSITIVITY;
    this.distance = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, this.distance * factor));
  }

  /**
   * Calcula a posição da câmera a partir de target + distance + azimuth + elevation.
   * @returns {[number, number, number]}
   */
  getPosition() {
    const ce = Math.cos(this.elevation);
    const se = Math.sin(this.elevation);
    const ca = Math.cos(this.azimuth);
    const sa = Math.sin(this.azimuth);
    return [
      this.target[0] + this.distance * ce * sa,
      this.target[1] + this.distance * se,
      this.target[2] + this.distance * ce * ca,
    ];
  }

  /**
   * Devolve matriz view (inversa do transform da câmera).
   * @returns {Float32Array}
   */
  getViewMatrix() {
    const eye = this.getPosition();
    return m4.inverse(m4.lookAt(eye, this.target, [0, 1, 0]));
  }

  /**
   * Calcula vetores "right" e "up" da câmera no espaço mundo, pro pan.
   */
  _cameraBasis() {
    const eye = this.getPosition();
    const forward = m4.normalize([
      this.target[0] - eye[0],
      this.target[1] - eye[1],
      this.target[2] - eye[2],
    ]);
    const right = m4.normalize(m4.cross(forward, [0, 1, 0]));
    const up = m4.normalize(m4.cross(right, forward));
    return { right, up };
  }

  /** Serializa estado pro JSON. */
  toJson() {
    return {
      target: [...this.target],
      distance: this.distance,
      azimuth: this.azimuth,
      elevation: this.elevation,
    };
  }

  /** Restaura estado vindo do JSON. */
  fromJson(data) {
    this.target = [...data.target];
    this.distance = data.distance;
    this.azimuth = data.azimuth;
    this.elevation = data.elevation;
  }
}
```

- [ ] **Step 2: Integrar Camera no `src/main.js`**

Em `src/main.js`:

**(a)** Adicionar import no topo:
```js
import { Camera } from './interaction/camera.js';
```

**(b)** Após `const programs = createPrograms(gl);` e antes do bootstrap, adicionar:
```js
const camera = new Camera(canvas);
window.camera = camera;  // debug
```

**(c)** Substituir o cálculo de view dentro de `drawScene()`:

```js
// Antes:
//   const view = m4.lookAt([0, 0.2, 0.6], [0, 0, 0], [0, 1, 0]);
//   const viewProjection = m4.multiply(projection, m4.inverse(view));
// Depois:
const viewMatrix = camera.getViewMatrix();
const viewProjection = m4.multiply(projection, viewMatrix);
```

- [ ] **Step 3: Verificar no navegador**

Recarregar. Testar manualmente:
- **Clique esquerdo + arrastar** → as pistolas rotacionam em torno do centro.
- **Scroll up/down** → zoom in/out (distance varia).
- **Clique direito + arrastar** → pan (centro se move junto com o mouse, sem menu de contexto aparecer).
- Não dá pra virar a câmera de cabeça pra baixo (clamp em ±84°).
- No console: `camera.distance` reflete os zooms feitos.

---

## Task 10: Picking 3D via framebuffer

**Files:**
- Create: `src/interaction/picking.js`
- Modify: `src/main.js`

**O que esta task faz:** clique no canvas seleciona o nó embaixo do cursor. Implementação: programa de picking que renderiza cada nó com cor = ID codificado, num framebuffer offscreen; `readPixels` na coord do mouse dá o ID.

- [ ] **Step 1: Criar `src/interaction/picking.js`**

```js
// src/interaction/picking.js
// Picking 3D via framebuffer offscreen com cores codificadas.
//
// Como funciona:
//   1. Para cada SceneNode, o pickingId (uint32) é codificado nos 4 bytes RGBA.
//   2. Renderizamos a cena num FBO usando o programa "picking" — cada nó pinta
//      seus pixels com sua cor única (sem textura, sem luz, sem nada).
//   3. Quando o usuário clica em (x,y), lemos o pixel do FBO naquela coord
//      e decodificamos os 4 bytes de volta em uint32.
//   4. Procuramos o SceneNode com aquele pickingId.

import * as twgl from '../lib/twgl-full.module.js';

/**
 * Codifica um uint32 nos 4 bytes RGBA (range [0, 1]).
 * @param {number} id
 * @returns {[number, number, number, number]}
 */
function encodeIdAsColor(id) {
  const r = ((id >>  0) & 0xff) / 255;
  const g = ((id >>  8) & 0xff) / 255;
  const b = ((id >> 16) & 0xff) / 255;
  const a = ((id >> 24) & 0xff) / 255;
  return [r, g, b, a];
}

/**
 * Decodifica 4 bytes RGBA (uint8) num uint32.
 */
function decodeColorAsId(r, g, b, a) {
  return (r) | (g << 8) | (b << 16) | (a << 24);
}

export class PickingSystem {
  /**
   * @param {WebGL2RenderingContext} gl
   * @param {object} programInfoPicking
   */
  constructor(gl, programInfoPicking) {
    this.gl = gl;
    this.programInfo = programInfoPicking;
    this.fbo = null;
    this.fboWidth = 0;
    this.fboHeight = 0;
  }

  /** (Re)cria o framebuffer com o tamanho do canvas atual. */
  _ensureFbo(width, height) {
    const gl = this.gl;
    if (this.fbo && this.fboWidth === width && this.fboHeight === height) return;

    // Cria attachments: color (RGBA8) + depth (DEPTH_COMPONENT24).
    const attachments = [
      { format: gl.RGBA8, type: gl.UNSIGNED_BYTE, min: gl.NEAREST, mag: gl.NEAREST,
        wrap: gl.CLAMP_TO_EDGE },
      { format: gl.DEPTH_COMPONENT24 },
    ];
    this.fbo = twgl.createFramebufferInfo(gl, attachments, width, height);
    this.fboWidth = width;
    this.fboHeight = height;
  }

  /**
   * Renderiza a cena no FBO de picking e lê o pixel em (cssX, cssY).
   * cssX/cssY estão em coords CSS do canvas (sem DPR multiplicado).
   *
   * @param {import('../scene/scene.js').Scene} scene
   * @param {import('../scene/catalog.js').Catalog} catalog
   * @param {Float32Array} viewProjection
   * @param {number} cssX
   * @param {number} cssY
   * @returns {import('../scene/node.js').SceneNode|null}
   */
  pick(scene, catalog, viewProjection, cssX, cssY) {
    const gl = this.gl;
    const canvas = gl.canvas;

    // Garante FBO do tamanho certo.
    this._ensureFbo(canvas.width, canvas.height);

    twgl.bindFramebufferInfo(gl, this.fbo);
    gl.viewport(0, 0, this.fboWidth, this.fboHeight);

    // Fundo preto = "nenhum nó" (pickingId 0).
    gl.clearColor(0, 0, 0, 0);
    gl.enable(gl.DEPTH_TEST);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.useProgram(this.programInfo.program);

    // Renderiza cada nó com sua cor de picking.
    const groups = scene.groupNodesByModelId();
    for (const [modelId, nodes] of groups) {
      const model = catalog.get(modelId);
      if (!model) continue;
      gl.bindVertexArray(model.vao);
      for (const node of nodes) {
        twgl.setUniforms(this.programInfo, {
          u_viewProjection: viewProjection,
          u_worldMatrix: node.worldMatrix,
          u_pickingColor: encodeIdAsColor(node.pickingId),
        });
        twgl.drawBufferInfo(gl, model.bufferInfo);
      }
    }
    gl.bindVertexArray(null);

    // Lê 1 pixel onde o mouse clicou.
    // Atenção: o FBO tem origem no canto INFERIOR-esquerdo (convenção WebGL),
    // mas o evento de mouse tem origem no canto SUPERIOR-esquerdo (DOM).
    // Então invertemos Y: fboY = height - cssY.
    // Também: convertemos CSS coords pra device pixels (multiplica por DPR).
    const dpr = window.devicePixelRatio || 1;
    const px = Math.floor(cssX * dpr);
    const py = Math.floor((canvas.clientHeight - cssY) * dpr);

    const pixel = new Uint8Array(4);
    gl.readPixels(px, py, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);

    twgl.bindFramebufferInfo(gl, null);
    gl.viewport(0, 0, canvas.width, canvas.height);

    // Decodifica e busca o nó.
    const id = decodeColorAsId(pixel[0], pixel[1], pixel[2], pixel[3]);
    if (id === 0) return null;
    return scene.getAllNodes().find(n => n.pickingId === id) ?? null;
  }
}
```

- [ ] **Step 2: Integrar Picking no `src/main.js`**

Em `src/main.js`:

**(a)** Adicionar import:
```js
import { PickingSystem } from './interaction/picking.js';
```

**(b)** Após `const camera = new Camera(canvas);`, criar o picking:
```js
const picking = new PickingSystem(gl, programs.picking);
window.picking = picking;
```

**(c)** Conectar o callback de clique da câmera. Adicionar dentro de `bootstrap()`, após a criação da cena inicial:

```js
camera.onClick = (cssX, cssY) => {
  // Calcula viewProjection ATUAL (mesma que será usada no próximo frame).
  const aspect = canvas.width / canvas.height;
  const projection = m4.perspective(Math.PI / 3, aspect, 0.01, 100);
  const viewProjection = m4.multiply(projection, camera.getViewMatrix());

  const clickedNode = picking.pick(scene, catalog, viewProjection, cssX, cssY);
  scene.select(clickedNode);
  console.log('[click] selecionado:', clickedNode?.name ?? '(nenhum)');
};
```

**(d)** Adicionar destaque visual do nó selecionado: substituir o `u_ambient` no `drawScene()` por algo que destaca o selecionado. Editar a parte dos uniforms dentro do loop em `drawScene()`:

```js
// Antes:
//   u_ambient: 0.25,
// Depois:
const isSelected = node === scene.selectedNode;
const ambient = isSelected ? 0.6 : 0.25;  // selecionado fica visualmente mais claro
// e dentro do setUniforms, trocar u_ambient: 0.25 por u_ambient: ambient
```

A linha completa fica:
```js
twgl.setUniforms(programs.main, {
  u_viewProjection: viewProjection,
  u_worldMatrix: node.worldMatrix,
  u_worldInverseTranspose: worldInverseTranspose,
  u_albedo: textureSource,
  u_lightDir: m4.normalize([0.3, 0.7, 0.5]),
  u_ambient: ambient,
  u_tile: [node.tileU, node.tileV],
});
```

- [ ] **Step 3: Verificar no navegador**

Recarregar. Testar:
- **Clique numa pistola** → ela fica mais clara (ambiente=0.6). Console: `[click] selecionado: Pistola A`.
- **Clique na outra pistola** → a primeira volta ao normal, a segunda fica clara.
- **Clique no vazio** → seleção limpa, todas voltam ao normal. Console: `[click] selecionado: (nenhum)`.
- **Arrastar (drag)** NÃO conta como clique — câmera rotaciona normalmente.

Se o picking errar consistentemente (clica numa pistola e seleciona a outra): provavelmente a inversão de Y está errada. Re-verificar `py = (clientHeight - cssY) * dpr`.

---

# Fase 4 — UI

## Task 11: Menu de modelos com thumbnails 3D

**Files:**
- Create: `src/ui/model-menu.js`
- Modify: `src/main.js`

**O que esta task faz:** preenche o painel esquerdo com 16 itens, cada um com um `<canvas>` próprio onde renderizamos o modelo (snapshot estático). Click no item adiciona o modelo à cena no centro.

- [ ] **Step 1: Criar `src/ui/model-menu.js`**

```js
// src/ui/model-menu.js
// Painel esquerdo: lista de modelos disponíveis renderizados em 3D
// (snapshot estático em <canvas> de 96×96 px por item).
//
// Click no item -> adiciona um SceneNode com aquele modelId no centro da cena.

import * as twgl from '../lib/twgl-full.module.js';
import { m4 } from '../lib/m4.js';

export class ModelMenu {
  /**
   * @param {HTMLElement} containerElement - onde o menu vai ser renderizado
   * @param {WebGL2RenderingContext} gl     - contexto WebGL principal (vamos rodar shaders pra preview)
   * @param {object} programInfoMain        - ProgramInfo do programa main (mesmo que cena usa)
   * @param {import('../scene/catalog.js').Catalog} catalog
   * @param {import('../scene/scene.js').Scene} scene
   */
  constructor(containerElement, gl, programInfoMain, catalog, scene) {
    this.container = containerElement;
    this.gl = gl;
    this.programInfo = programInfoMain;
    this.catalog = catalog;
    this.scene = scene;
  }

  /**
   * Constrói o DOM e renderiza um thumbnail pra cada modelo.
   * Chamar uma vez depois de catalog.loadAll terminar.
   */
  render() {
    // Limpa container.
    this.container.innerHTML = '';

    for (const model of this.catalog.list()) {
      // Estrutura: <div class="model-thumb"> <canvas /> <div class="label" /> </div>
      const thumb = document.createElement('div');
      thumb.className = 'model-thumb';
      thumb.title = `Adicionar "${model.name}" à cena`;

      const canvas = document.createElement('canvas');
      canvas.width = 96;
      canvas.height = 96;
      thumb.appendChild(canvas);

      const label = document.createElement('div');
      label.className = 'label';
      label.textContent = model.name;
      thumb.appendChild(label);

      // Click -> adiciona à cena.
      thumb.addEventListener('click', () => {
        this.scene.addNode({ modelId: model.id, name: model.name });
      });

      this.container.appendChild(thumb);

      // Renderiza o thumbnail uma vez (snapshot).
      this._renderThumbnail(canvas, model);
    }
  }

  /**
   * Renderiza um modelo num canvas pequeno, uma vez.
   * Usa o MESMO contexto WebGL do canvas principal — não cria um novo.
   * Estratégia:
   *   1. Desenha o modelo no canvas WebGL principal num FBO temporário.
   *   2. Pega os pixels e desenha no <canvas> 2D do thumbnail.
   * Mais simples: usa o offscreen do canvas principal e copia via drawImage.
   *
   * Pra esse projeto simplificamos ainda mais: renderizamos NO canvas principal
   * uma vez (sobre o que estiver lá), capturamos via toDataURL, e seteamos
   * como background-image do thumbnail. Isso interfere com a cena, então a
   * gente faz tudo ANTES do mainLoop começar.
   *
   * VERSÃO mais limpa (usada aqui): renderiza num canvas offscreen com seu
   * próprio contexto WebGL2 — mais isolado, ignora o canvas principal.
   */
  _renderThumbnail(thumbCanvas, model) {
    // Criamos um contexto WebGL2 SEPARADO no canvas do thumbnail.
    // OBS: WebGL não permite compartilhar VAO/buffers entre contextos diferentes.
    //      Então o thumbnail precisa ter seu próprio buffer.
    // Pra simplificar: vamos copiar a posição/normal/UV do BufferInfo do model
    //                  pra um BufferInfo novo nesse contexto.
    const gl2 = thumbCanvas.getContext('webgl2');
    if (!gl2) return;

    // Re-cria programa nesse contexto.
    // (Não dá pra reusar this.programInfo porque é de outro contexto.)
    // Importamos as fontes pra evitar deps circulares.
    // Solução simples: usar uma versão minimalista de shader inline aqui.
    const vs = `#version 300 es
      in vec3 a_position;
      in vec3 a_normal;
      in vec2 a_uv;
      uniform mat4 u_mvp;
      uniform mat4 u_world;
      out vec3 v_normal;
      out vec2 v_uv;
      void main() {
        gl_Position = u_mvp * vec4(a_position, 1.0);
        v_normal = mat3(u_world) * a_normal;
        v_uv = a_uv;
      }
    `;
    const fs = `#version 300 es
      precision highp float;
      in vec3 v_normal;
      in vec2 v_uv;
      uniform sampler2D u_albedo;
      out vec4 outColor;
      void main() {
        vec3 L = normalize(vec3(0.3, 0.7, 0.5));
        float diff = max(0.0, dot(normalize(v_normal), L));
        vec4 tex = texture(u_albedo, v_uv);
        outColor = vec4(tex.rgb * (0.3 + diff), 1.0);
      }
    `;
    const prog = twgl.createProgramInfo(gl2, [vs, fs]);

    // Recria buffers nesse contexto a partir dos dados originais.
    // twgl não expõe arrays brutos do bufferInfo; carregamos de novo do .obj
    // seria caro. Solução: ler de volta usando getBufferSubData (mas WebGL2
    // não deixa "ler" buffer de OUTRO contexto). Logo, precisamos guardar
    // os arrays.
    //
    // Pra evitar essa complicação: vamos guardar os arrays raw em Catalog
    // (na T5 modificamos catalog.js pra guardar `rawArrays`).
    const arrays = model._rawArrays;
    if (!arrays) {
      console.warn(`[model-menu] modelo "${model.id}" sem rawArrays — thumbnail não renderiza.`);
      return;
    }
    const bufferInfo = twgl.createBufferInfoFromArrays(gl2, arrays);

    // Recria textura nesse contexto.
    const tex = twgl.createTexture(gl2, {
      src: model._textureUrl,  // também guardado em Catalog
      minMag: gl2.NEAREST,
      wrap: gl2.REPEAT,
      flipY: 1,
    }, () => {
      // Quando a textura terminar de carregar, renderiza.
      drawOnce();
    });

    function drawOnce() {
      gl2.viewport(0, 0, thumbCanvas.width, thumbCanvas.height);
      gl2.clearColor(0.12, 0.13, 0.16, 1);
      gl2.enable(gl2.DEPTH_TEST);
      gl2.clear(gl2.COLOR_BUFFER_BIT | gl2.DEPTH_BUFFER_BIT);

      // Câmera fixa enquadrando o modelo.
      // Distância heurística: assume modelos pequenos (escala ~0.1-0.5).
      const aspect = thumbCanvas.width / thumbCanvas.height;
      const projection = m4.perspective(Math.PI / 4, aspect, 0.01, 10);
      const view = m4.lookAt([0.3, 0.2, 0.3], [0, 0.05, 0], [0, 1, 0]);
      const world = m4.identity();
      const mvp = m4.multiply(m4.multiply(projection, m4.inverse(view)), world);

      gl2.useProgram(prog.program);
      twgl.setBuffersAndAttributes(gl2, prog, bufferInfo);
      twgl.setUniforms(prog, { u_mvp: mvp, u_world: world, u_albedo: tex });
      twgl.drawBufferInfo(gl2, bufferInfo);
    }
    // Também dispara um draw imediato (caso a textura já esteja carregada).
    drawOnce();
  }
}
```

- [ ] **Step 2: Atualizar `src/scene/catalog.js` pra guardar arrays brutos**

O thumbnail precisa criar buffers num contexto WebGL2 separado, mas WebGL não compartilha buffers entre contextos. Solução: guardar os arrays Float32 originais junto do modelo.

Em `src/scene/catalog.js`, editar `_loadOne`:

```js
async _loadOne(gl, programInfoMain, def) {
  // Geometria
  const objResult = await loadObj(gl, def.obj, {
    merge: def.merge ?? false,
    objectName: def.objectName,
  });

  const vao = twgl.createVAOFromBufferInfo(gl, programInfoMain, objResult.bufferInfo);

  let texture;
  if (def.texture) {
    texture = await new Promise((resolve, reject) => {
      const tex = twgl.createTexture(gl, {
        src: def.texture, minMag: gl.NEAREST, wrap: gl.REPEAT, flipY: 1,
      }, (err, tex) => err ? reject(err) : resolve(tex));
    });
  } else {
    texture = twgl.createTexture(gl, { src: [200, 200, 200, 255], width: 1, height: 1 });
  }

  this.models.set(def.id, {
    id: def.id,
    name: def.name,
    bufferInfo: objResult.bufferInfo,
    vao,
    texture,
    vertexCount: objResult.vertexCount,
    // ---- Pra thumbnails: arrays brutos + URL da textura ----
    _rawArrays: objResult.rawArrays,
    _textureUrl: def.texture ?? null,
  });
}
```

E em `src/gl/obj-loader.js`, **fazer o `loadObj` devolver também os arrays brutos**. Na função `loadObj`, ao retornar:

```js
// Antes:
//   return { bufferInfo, vertexCount: positions.length / 3 };
// Depois:
return {
  bufferInfo,
  vertexCount: positions.length / 3,
  rawArrays: {
    a_position: { numComponents: 3, data: positions },
    a_normal:   { numComponents: 3, data: normals },
    a_uv:       { numComponents: 2, data: uvs },
  },
};
```

- [ ] **Step 3: Integrar ModelMenu no `src/main.js`**

Em `src/main.js`:

**(a)** Adicionar import:
```js
import { ModelMenu } from './ui/model-menu.js';
```

**(b)** Dentro de `bootstrap()`, após `await catalog.loadAll(...)` e ANTES de criar nós de teste, criar o menu:

```js
const modelMenuElement = document.getElementById('model-menu-list');
const modelMenu = new ModelMenu(modelMenuElement, gl, programs.main, catalog, scene);
modelMenu.render();
```

**(c)** Remover (ou comentar) os `scene.addNode(...)` de teste — agora o usuário vai adicionar via click no menu:

```js
// // Cena inicial vazia — usuário adiciona modelos clicando no menu.
// scene.addNode({ modelId: 'pistol', ... });   // <- remover
```

(Manter um nó de exemplo se quiser pra ver na primeira visita, mas pode iniciar vazio.)

- [ ] **Step 4: Verificar no navegador**

Recarregar. Esperado:
- Painel esquerdo: 16 thumbnails 3D, cada um renderizando seu modelo.
- Clicar num thumbnail → o modelo aparece no canvas central.
- Pode clicar várias vezes → várias instâncias do mesmo modelo (sobrepostas no centro).
- Console: `scene.getAllNodes().length` aumenta a cada clique.

**Possíveis problemas:**
- Thumbnails todos pretos: textura não carregou no contexto secundário. Verificar Network tab — se o PNG está sendo baixado de novo, está OK. Se 404, problema de path.
- Thumbnails brancos sem geometria: `_rawArrays` não foi guardado. Verificar step 2.

---

## Task 12: Scene-tree — árvore HTML

**Files:**
- Create: `src/ui/scene-tree.js`
- Modify: `src/main.js`

**O que esta task faz:** painel direito-topo mostra a árvore de nós da cena. Itens são clicáveis (selecionam). Botões pequenos: `×` deletar.

(Reparent vai pelo Inspector — T13 — porque já temos o dropdown de pai lá; manter aqui também duplica.)

- [ ] **Step 1: Criar `src/ui/scene-tree.js`**

```js
// src/ui/scene-tree.js
// Painel direito-topo: árvore HTML refletindo scene.rootNodes recursivamente.
// Click num item -> seleciona o nó. Botão × -> remove o nó.
//
// Reagimos aos eventos da cena (selectionChanged, structureChanged) re-renderizando.

export class SceneTree {
  /**
   * @param {HTMLElement} containerElement
   * @param {import('../scene/scene.js').Scene} scene
   */
  constructor(containerElement, scene) {
    this.container = containerElement;
    this.scene = scene;

    // Re-render quando estrutura ou seleção mudam.
    scene.on('structureChanged', () => this.render());
    scene.on('selectionChanged', () => this.render());
  }

  /** Reconstrói toda a árvore. Brute-force mas barato (poucos nós). */
  render() {
    this.container.innerHTML = '';

    if (this.scene.rootNodes.length === 0) {
      const empty = document.createElement('p');
      empty.style.color = '#666';
      empty.textContent = '(cena vazia — clique num modelo do menu)';
      this.container.appendChild(empty);
      return;
    }

    const ul = document.createElement('ul');
    ul.className = 'tree';
    ul.style.listStyle = 'none';
    ul.style.paddingLeft = '0';
    for (const root of this.scene.rootNodes) {
      ul.appendChild(this._renderNode(root));
    }
    this.container.appendChild(ul);
  }

  /** Cria <li> pra um nó (com filhos aninhados). */
  _renderNode(node) {
    const li = document.createElement('li');
    li.style.padding = '2px 0';

    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.gap = '4px';
    row.style.cursor = 'pointer';
    row.style.padding = '2px 4px';
    row.style.borderRadius = '2px';
    if (node === this.scene.selectedNode) {
      row.style.background = '#3a5980';
      row.style.color = '#fff';
    }

    // Nome — click seleciona.
    const label = document.createElement('span');
    label.textContent = node.name;
    label.style.flex = '1';
    label.style.overflow = 'hidden';
    label.style.textOverflow = 'ellipsis';
    label.style.whiteSpace = 'nowrap';
    row.appendChild(label);

    // Botão deletar.
    const btnDel = document.createElement('button');
    btnDel.textContent = '×';
    btnDel.title = 'Remover nó (e seus filhos)';
    btnDel.style.background = 'transparent';
    btnDel.style.border = 'none';
    btnDel.style.color = '#888';
    btnDel.style.cursor = 'pointer';
    btnDel.style.padding = '0 4px';
    btnDel.addEventListener('click', (e) => {
      e.stopPropagation();
      this.scene.removeNode(node);
    });
    row.appendChild(btnDel);

    row.addEventListener('click', () => {
      this.scene.select(node);
    });
    li.appendChild(row);

    // Filhos recursivos com indentação.
    if (node.children.length > 0) {
      const childUl = document.createElement('ul');
      childUl.style.listStyle = 'none';
      childUl.style.paddingLeft = '16px';
      for (const c of node.children) {
        childUl.appendChild(this._renderNode(c));
      }
      li.appendChild(childUl);
    }

    return li;
  }
}
```

- [ ] **Step 2: Integrar SceneTree no `src/main.js`**

**(a)** Adicionar import:
```js
import { SceneTree } from './ui/scene-tree.js';
```

**(b)** Dentro de `bootstrap()`, após criar o `ModelMenu`, criar a tree:

```js
const sceneTreeElement = document.getElementById('scene-tree');
const sceneTree = new SceneTree(sceneTreeElement, scene);
sceneTree.render();
```

- [ ] **Step 3: Verificar no navegador**

Recarregar. Testar:
- Cena vazia → texto "(cena vazia — clique num modelo do menu)".
- Clicar 3 modelos no menu → 3 itens na árvore.
- **Clique num item da árvore** → o item fica destacado (azul) E o modelo no canvas fica iluminado (selecionado).
- **Clique numa pistola no canvas** → o item correspondente na árvore fica destacado.
- **Click no `×` de um item** → o item some da árvore e o modelo some do canvas.
- Console: `scene.getAllNodes().length` reflete adições/remoções.

---

## Task 13: Inspector — edição de propriedades

**Files:**
- Create: `src/ui/inspector.js`
- Modify: `src/main.js`

**O que esta task faz:** painel direito-baixo. Quando há nó selecionado, mostra campos editáveis pra todas as suas propriedades (nome, transform, animação, textura, pai). Mudança em qualquer campo escreve no nó direto; o próximo frame renderiza com o novo valor.

- [ ] **Step 1: Criar `src/ui/inspector.js`**

```js
// src/ui/inspector.js
// Painel direito-baixo: edita o nó selecionado.
//
// Estratégia: quando seleção muda, reconstrói TODOS os campos do zero
// (brute-force re-render). Cada <input> tem handler oninput que escreve
// direto no nó — o render loop pega na próxima iteração.
//
// Rotação: armazenada em radianos no SceneNode, mas mostrada/editada
// em graus na UI (mais intuitivo pro usuário).

const RAD_TO_DEG = 180 / Math.PI;
const DEG_TO_RAD = Math.PI / 180;

export class Inspector {
  /**
   * @param {HTMLElement} containerElement
   * @param {import('../scene/scene.js').Scene} scene
   * @param {import('../scene/catalog.js').Catalog} catalog
   */
  constructor(containerElement, scene, catalog) {
    this.container = containerElement;
    this.scene = scene;
    this.catalog = catalog;

    // Re-render quando seleção muda ou estrutura muda (lista de pais pode mudar).
    scene.on('selectionChanged', () => this.render());
    scene.on('structureChanged', () => this.render());
  }

  render() {
    this.container.innerHTML = '';
    const node = this.scene.selectedNode;
    if (!node) {
      const empty = document.createElement('p');
      empty.style.color = '#666';
      empty.textContent = '(nada selecionado)';
      this.container.appendChild(empty);
      return;
    }

    // Helper pra criar uma "linha" rotulada com inputs.
    const row = (labelText, makeInputs) => {
      const r = document.createElement('div');
      r.style.display = 'flex';
      r.style.alignItems = 'center';
      r.style.gap = '4px';
      r.style.marginBottom = '4px';
      const l = document.createElement('label');
      l.textContent = labelText;
      l.style.flex = '0 0 60px';
      l.style.fontSize = '11px';
      l.style.color = '#aaa';
      r.appendChild(l);
      makeInputs(r);
      this.container.appendChild(r);
    };

    // ---- Nome ----
    row('Nome', (r) => {
      const inp = document.createElement('input');
      inp.type = 'text';
      inp.value = node.name;
      inp.style.flex = '1';
      inp.addEventListener('input', () => {
        node.name = inp.value;
        this.scene._emit('structureChanged');  // árvore reflete nome novo
      });
      r.appendChild(inp);
    });

    // ---- Modelo (read-only) ----
    row('Modelo', (r) => {
      const span = document.createElement('span');
      span.textContent = node.modelId;
      span.style.color = '#999';
      r.appendChild(span);
    });

    // ---- Transform: 3 grupos XYZ ----
    this._vec3Row('Posição', node.position, 0.1);
    this._vec3RowDegrees('Rotação°', node.rotation, 1);
    this._vec3Row('Escala', node.scale, 0.1);

    // Separador.
    this._separator('Animação');

    this._vec3Row('Dir',     node.animDir,      0.1);
    this._scalarRow('Velocidade', node, 'animSpeed', 0.1);
    this._vec3Row('Rot vel', node.animRotSpeed, 0.1);

    // Separador.
    this._separator('Textura');

    // ---- Textura override (dropdown com lista de modelos) ----
    row('Textura', (r) => {
      const sel = document.createElement('select');
      sel.style.flex = '1';
      const optDefault = document.createElement('option');
      optDefault.value = '';
      optDefault.textContent = '(própria)';
      sel.appendChild(optDefault);
      for (const m of this.catalog.list()) {
        const opt = document.createElement('option');
        opt.value = m.id;
        opt.textContent = m.name;
        sel.appendChild(opt);
      }
      sel.value = node.textureOverride ?? '';
      sel.addEventListener('change', () => {
        node.textureOverride = sel.value === '' ? null : sel.value;
      });
      r.appendChild(sel);
    });

    // ---- Filtro ----
    row('Filtro', (r) => {
      const sel = document.createElement('select');
      sel.style.flex = '1';
      for (const opt of ['nearest', 'linear']) {
        const o = document.createElement('option');
        o.value = opt;
        o.textContent = opt;
        sel.appendChild(o);
      }
      sel.value = node.textureFilter;
      sel.addEventListener('change', () => {
        node.textureFilter = sel.value;
      });
      r.appendChild(sel);
    });

    // ---- Tile U/V ----
    row('Tile U/V', (r) => {
      const u = this._makeNumberInput(node.tileU, 0.1, (v) => node.tileU = v);
      const v = this._makeNumberInput(node.tileV, 0.1, (v) => node.tileV = v);
      r.appendChild(u);
      r.appendChild(v);
    });

    // Separador.
    this._separator('Hierarquia');

    // ---- Pai (dropdown com todos os outros nós + "(raiz)") ----
    row('Pai', (r) => {
      const sel = document.createElement('select');
      sel.style.flex = '1';
      const optRoot = document.createElement('option');
      optRoot.value = '';
      optRoot.textContent = '(raiz)';
      sel.appendChild(optRoot);
      // Lista nós que NÃO são o próprio nem descendentes (pra evitar ciclo).
      for (const other of this.scene.getAllNodes()) {
        if (other === node) continue;
        if (this._isDescendant(other, node)) continue;
        const opt = document.createElement('option');
        opt.value = other.id;
        opt.textContent = other.name;
        sel.appendChild(opt);
      }
      sel.value = node.parent?.id ?? '';
      sel.addEventListener('change', () => {
        const newParent = sel.value === '' ? null : this.scene.nodesById.get(sel.value);
        this.scene.setParent(node, newParent);
      });
      r.appendChild(sel);
    });

    // ---- Botão deletar ----
    const btn = document.createElement('button');
    btn.textContent = 'Deletar nó';
    btn.style.marginTop = '12px';
    btn.style.padding = '6px 12px';
    btn.style.background = '#7a2a2a';
    btn.style.border = '1px solid #a44';
    btn.style.color = '#fff';
    btn.style.cursor = 'pointer';
    btn.addEventListener('click', () => {
      this.scene.removeNode(node);
    });
    this.container.appendChild(btn);
  }

  // ---- Helpers ----

  _separator(text) {
    const sep = document.createElement('div');
    sep.textContent = text;
    sep.style.borderTop = '1px solid #3a3a3a';
    sep.style.marginTop = '8px';
    sep.style.paddingTop = '6px';
    sep.style.fontSize = '10px';
    sep.style.color = '#777';
    sep.style.textTransform = 'uppercase';
    this.container.appendChild(sep);
  }

  /** Linha com 3 inputs numéricos editando um array [x,y,z]. */
  _vec3Row(labelText, arr, step) {
    const r = document.createElement('div');
    r.style.display = 'flex';
    r.style.alignItems = 'center';
    r.style.gap = '4px';
    r.style.marginBottom = '4px';
    const l = document.createElement('label');
    l.textContent = labelText;
    l.style.flex = '0 0 60px';
    l.style.fontSize = '11px';
    l.style.color = '#aaa';
    r.appendChild(l);
    for (let i = 0; i < 3; i++) {
      r.appendChild(this._makeNumberInput(arr[i], step, (v) => arr[i] = v));
    }
    this.container.appendChild(r);
  }

  /** Variante de _vec3Row que converte rad <-> graus na UI. */
  _vec3RowDegrees(labelText, arr, step) {
    const r = document.createElement('div');
    r.style.display = 'flex';
    r.style.alignItems = 'center';
    r.style.gap = '4px';
    r.style.marginBottom = '4px';
    const l = document.createElement('label');
    l.textContent = labelText;
    l.style.flex = '0 0 60px';
    l.style.fontSize = '11px';
    l.style.color = '#aaa';
    r.appendChild(l);
    for (let i = 0; i < 3; i++) {
      const inDegrees = arr[i] * RAD_TO_DEG;
      r.appendChild(this._makeNumberInput(inDegrees, step, (v) => arr[i] = v * DEG_TO_RAD));
    }
    this.container.appendChild(r);
  }

  /** Linha com 1 input numérico editando uma prop escalar do nó. */
  _scalarRow(labelText, obj, propName, step) {
    const r = document.createElement('div');
    r.style.display = 'flex';
    r.style.alignItems = 'center';
    r.style.gap = '4px';
    r.style.marginBottom = '4px';
    const l = document.createElement('label');
    l.textContent = labelText;
    l.style.flex = '0 0 60px';
    l.style.fontSize = '11px';
    l.style.color = '#aaa';
    r.appendChild(l);
    r.appendChild(this._makeNumberInput(obj[propName], step, (v) => obj[propName] = v));
    this.container.appendChild(r);
  }

  /** Cria um <input type=number> com listener que chama onChange(novoValor). */
  _makeNumberInput(value, step, onChange) {
    const inp = document.createElement('input');
    inp.type = 'number';
    inp.step = String(step);
    inp.value = String(value);
    inp.style.width = '50px';
    inp.style.background = '#1a1a1a';
    inp.style.border = '1px solid #444';
    inp.style.color = '#ddd';
    inp.style.padding = '2px 4px';
    inp.style.fontSize = '11px';
    inp.addEventListener('input', () => {
      const v = parseFloat(inp.value);
      if (!isNaN(v)) onChange(v);
    });
    return inp;
  }

  /** Verifica se descendant é descendente (ou igual) a ancestor. */
  _isDescendant(descendant, ancestor) {
    let n = descendant;
    while (n) {
      if (n === ancestor) return true;
      n = n.parent;
    }
    return false;
  }
}
```

- [ ] **Step 2: Integrar Inspector no `src/main.js`**

**(a)** Adicionar import:
```js
import { Inspector } from './ui/inspector.js';
```

**(b)** Dentro de `bootstrap()`, após criar a `SceneTree`, criar o Inspector:

```js
const inspectorElement = document.getElementById('inspector');
const inspector = new Inspector(inspectorElement, scene, catalog);
inspector.render();
```

**(c)** Atualizar o uso de `node.textureFilter` no `drawScene()` pra realmente aplicar o filtro na textura:

Em `drawScene()`, antes de chamar `twgl.setUniforms`, configurar o filtro:

```js
// Pega a textura (própria ou override) e aplica o filtro do nó.
const textureSource = node.textureOverride
  ? (catalog.get(node.textureOverride)?.texture ?? model.texture)
  : model.texture;

// Aplica o filtro do nó na textura.
// gl.NEAREST = pixelado, gl.LINEAR = suavizado.
const filterValue = node.textureFilter === 'linear' ? gl.LINEAR : gl.NEAREST;
gl.bindTexture(gl.TEXTURE_2D, textureSource);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filterValue);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filterValue);
```

- [ ] **Step 3: Verificar no navegador**

Recarregar. Testar TODOS os campos:

1. **Selecionar uma pistola** (click no canvas ou na árvore).
2. **Nome** → mudar pra "Minha pistola" → árvore reflete.
3. **Posição X** → digitar 0.3 → pistola se move pra direita.
4. **Rotação Y°** → digitar 90 → pistola rotaciona 90° no eixo Y.
5. **Escala** → digitar 2 em todos → pistola dobra de tamanho.
6. **Anim Dir Z = 0.1, Velocidade = 1** → pistola começa a andar em Z.
7. **Rot vel Y = 1** → começa a girar em Y.
8. **Textura → "Rifle"** → pistola fica com a textura do rifle.
9. **Filtro → linear** → textura suaviza (menos pixelada).
10. **Tile U = 2** → textura repete 2× horizontalmente.
11. **Pai → outra pistola** → o nó vira filho. Mover a outra arrasta esse junto.
12. **Pai → (raiz)** → volta a ser independente.
13. **Botão "Deletar nó"** → some.

- [ ] **Step 4: Bug check — limitar dropdown de pai contra ciclos**

Selecionar um nó, criar uma cadeia (A -> B -> C, onde -> = pai-de). Selecionar A; tentar mudar pai de A pra C. Esperado: C NÃO aparece no dropdown (porque é descendente de A). Se aparecer, o `_isDescendant` está invertido.

---

# Fase 5 — Persistência (Salvar/Carregar JSON)

## Task 14: Serialização da cena (toJson / fromJson)

**Files:**
- Modify: `src/scene/scene.js`

**O que esta task faz:** adiciona métodos `Scene.prototype.toJson()` e `Scene.fromJson(data, scene)` que preservam todos os campos editáveis. Camera e SceneNode já têm seus métodos. Esta task junta tudo num formato único.

- [ ] **Step 1: Adicionar `toJson` e estatico `fromJson` em `src/scene/scene.js`**

Editar `src/scene/scene.js`: adicionar import no topo (se não tiver):
```js
import { SceneNode } from './node.js';
```

E adicionar estes 2 métodos como métodos finais da classe `Scene` (antes do `}` que fecha a classe):

```js
  /**
   * Serializa a cena toda num objeto plain (JSON-safe).
   * NOTA: a câmera é serializada à parte (na chamada externa) porque ela
   * não pertence à Scene — é argumento separado em saveSceneAsJson.
   *
   * @returns {object}
   */
  toJson() {
    return {
      version: 1,
      // Lista plana: percorre em ordem topológica (pai antes do filho).
      nodes: this.getAllNodes().map(n => n.toJson()),
      selectedNodeId: this.selectedNode?.id ?? null,
    };
  }

  /**
   * Reconstrói a cena a partir do JSON.
   * IMPORTANTE: chama scene.clear() antes — descarta o estado atual.
   *
   * @param {object} data
   */
  loadFromJson(data) {
    if (data.version !== 1) {
      throw new Error(`Versão JSON não suportada: ${data.version}`);
    }

    this.clear();

    // Duas passadas:
    //   1) cria todos os nós (sem hierarquia).
    //   2) faz o reparent usando parentId.
    // Sem isso, um nó que aparece antes do seu parent na lista quebraria.

    // Passada 1: cria nós, indexa por id.
    const created = new Map();
    for (const nodeData of data.nodes) {
      const node = SceneNode.fromJson(nodeData);
      created.set(node.id, node);
      this._attachExisting(node, null);  // parent provisório = raiz
    }

    // Passada 2: reparent.
    for (const nodeData of data.nodes) {
      if (nodeData.parentId) {
        const node = created.get(nodeData.id);
        const parent = created.get(nodeData.parentId);
        if (!node || !parent) {
          console.warn(`[scene] referência quebrada no JSON: ${nodeData.id} -> ${nodeData.parentId}`);
          continue;
        }
        this.setParent(node, parent);
      }
    }

    // Restaura seleção (se havia).
    if (data.selectedNodeId) {
      const sel = created.get(data.selectedNodeId);
      if (sel) this.select(sel);
    }

    this._emit('structureChanged');
  }
```

- [ ] **Step 2: Verificar no console**

Recarregar a página. Adicionar manualmente 2 nós no console:
```js
scene.addNode({ modelId: 'pistol', position: [0, 0, 0] });
scene.addNode({ modelId: 'rifle',  position: [0.2, 0, 0] });
```

Depois:
```js
const json = scene.toJson();
console.log(JSON.stringify(json, null, 2));
```

Esperado: aparece um JSON com 2 entradas em `nodes`, ambas com `parentId: null`.

Testar roundtrip:
```js
const snapshot = JSON.stringify(scene.toJson());
scene.clear();
scene.loadFromJson(JSON.parse(snapshot));
```

Esperado: as 2 pistolas/rifles voltam exatamente como estavam.

---

## Task 15: Botões "Salvar JSON" / "Carregar JSON"

**Files:**
- Create: `src/ui/io-buttons.js`
- Modify: `src/main.js`

**O que esta task faz:** conecta os 2 botões do topo. "Salvar JSON" baixa cena.json; "Carregar JSON" abre `<input type=file>` e reconstrói a cena.

- [ ] **Step 1: Criar `src/ui/io-buttons.js`**

```js
// src/ui/io-buttons.js
// Conecta os botões "Salvar JSON" e "Carregar JSON" do topo.
//
// Salvar: monta um objeto { version, camera, ...scene.toJson() }, vira string,
//         vira Blob, vira link de download. Tudo client-side.
// Carregar: usa <input type=file> escondido pra abrir picker, lê via File.text().

export function setupIoButtons(scene, camera) {
  const btnSave = document.getElementById('btn-save');
  const btnLoad = document.getElementById('btn-load');
  const fileInput = document.getElementById('file-load');

  btnSave.addEventListener('click', () => {
    saveSceneAsJson(scene, camera);
  });

  // O botão "Carregar" delega pro input file escondido.
  btnLoad.addEventListener('click', () => {
    fileInput.click();
  });

  // Quando o usuário escolhe um arquivo no picker:
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    try {
      await loadSceneFromJson(file, scene, camera);
    } catch (err) {
      console.error('[io] erro ao carregar JSON:', err);
      alert('Erro ao carregar JSON: ' + err.message);
    } finally {
      // Limpa pro mesmo arquivo poder ser escolhido de novo.
      fileInput.value = '';
    }
  });
}

/**
 * Monta o objeto final e força download.
 */
function saveSceneAsJson(scene, camera) {
  const sceneData = scene.toJson();
  const data = {
    version: 1,
    camera: camera.toJson(),
    nodes: sceneData.nodes,
    selectedNodeId: sceneData.selectedNodeId,
  };

  const jsonString = JSON.stringify(data, null, 2);

  // Cria um Blob e força download via link temporário.
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'cena.json';
  document.body.appendChild(a);  // alguns browsers exigem estar no DOM
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Lê o arquivo e reconstrói cena + câmera.
 */
async function loadSceneFromJson(file, scene, camera) {
  const text = await file.text();
  const data = JSON.parse(text);

  if (data.version !== 1) {
    throw new Error(`Versão não suportada: ${data.version}`);
  }

  // Câmera primeiro (não depende da cena).
  if (data.camera) camera.fromJson(data.camera);

  // Cena (o método loadFromJson espera { version, nodes, selectedNodeId }).
  scene.loadFromJson({
    version: data.version,
    nodes: data.nodes,
    selectedNodeId: data.selectedNodeId,
  });
}
```

- [ ] **Step 2: Conectar no `src/main.js`**

**(a)** Import:
```js
import { setupIoButtons } from './ui/io-buttons.js';
```

**(b)** Dentro de `bootstrap()`, após criar Inspector:
```js
setupIoButtons(scene, camera);
```

- [ ] **Step 3: Verificar no navegador**

Recarregar. Testar:
1. Adicionar 3 nós, editar transforms, fazer hierarquia (um filho de outro).
2. Clicar **"Salvar JSON"** → arquivo `cena.json` baixa.
3. Abrir o `cena.json` num editor de texto: verificar que tem `camera`, `nodes` (3 entradas), `selectedNodeId`.
4. **Recarregar a página** (estado some).
5. Clicar **"Carregar JSON"** → escolher o `cena.json` baixado.
6. Esperado: cena volta IDÊNTICA — posições, hierarquia, seleção, câmera.

7. **Teste de edição manual:** abrir `cena.json` num editor, mudar `"position": [0,0,0]` de um nó pra `[1,0,0]`. Salvar. Recarregar no editor. Esperado: aquele nó aparece deslocado.

---

## Task 16: Cenas de exemplo

**Files:**
- Create: `examples/cena_simples.json`
- Create: `examples/cena_hierarquia.json`
- Create: `examples/cena_animada.json`

**O que esta task faz:** cria 3 cenas JSON prontas pra demonstração rápida (vídeo, debug).

- [ ] **Step 1: Criar `examples/cena_simples.json`**

Cena básica: 1 pistola + 1 cubo achatado como "chão".

```json
{
  "version": 1,
  "camera": {
    "target": [0, 0, 0],
    "distance": 0.5,
    "azimuth": 0.7,
    "elevation": 0.4
  },
  "nodes": [
    {
      "id": "node_chao",
      "name": "Chão",
      "modelId": "block_cube",
      "parentId": null,
      "position": [0, -0.05, 0],
      "rotation": [0, 0, 0],
      "scale": [0.4, 0.02, 0.4],
      "animDir": [0, 0, 0], "animSpeed": 0, "animRotSpeed": [0, 0, 0],
      "textureOverride": null, "textureFilter": "nearest", "tileU": 1, "tileV": 1
    },
    {
      "id": "node_pistola",
      "name": "Pistola",
      "modelId": "pistol",
      "parentId": null,
      "position": [0, 0.05, 0],
      "rotation": [0, 0, 0],
      "scale": [1, 1, 1],
      "animDir": [0, 0, 0], "animSpeed": 0, "animRotSpeed": [0, 0, 0],
      "textureOverride": null, "textureFilter": "nearest", "tileU": 1, "tileV": 1
    }
  ],
  "selectedNodeId": null
}
```

- [ ] **Step 2: Criar `examples/cena_hierarquia.json`**

Cena que demonstra hierarquia: rifle com cubo como filho — mover o rifle arrasta o cubo junto.

```json
{
  "version": 1,
  "camera": {
    "target": [0, 0, 0],
    "distance": 0.6,
    "azimuth": 0.5,
    "elevation": 0.3
  },
  "nodes": [
    {
      "id": "node_rifle",
      "name": "Rifle (pai)",
      "modelId": "rifle",
      "parentId": null,
      "position": [0, 0, 0],
      "rotation": [0, 0, 0],
      "scale": [1, 1, 1],
      "animDir": [0, 0, 0], "animSpeed": 0,
      "animRotSpeed": [0, 0.3, 0],
      "textureOverride": null, "textureFilter": "nearest", "tileU": 1, "tileV": 1
    },
    {
      "id": "node_cubo_filho",
      "name": "Cubo (filho do rifle)",
      "modelId": "block_cube",
      "parentId": "node_rifle",
      "position": [0, 0.1, 0],
      "rotation": [0, 0, 0],
      "scale": [0.05, 0.05, 0.05],
      "animDir": [0, 0, 0], "animSpeed": 0, "animRotSpeed": [0, 0, 0],
      "textureOverride": null, "textureFilter": "nearest", "tileU": 1, "tileV": 1
    }
  ],
  "selectedNodeId": "node_rifle"
}
```

- [ ] **Step 3: Criar `examples/cena_animada.json`**

Cena demonstrando animação: pistola translada em Z, rifle gira em Y, SMG gira em todos os eixos.

```json
{
  "version": 1,
  "camera": {
    "target": [0, 0, 0],
    "distance": 0.8,
    "azimuth": 0.6,
    "elevation": 0.4
  },
  "nodes": [
    {
      "id": "node_pistol_anim",
      "name": "Pistola translando",
      "modelId": "pistol",
      "parentId": null,
      "position": [-0.2, 0, 0],
      "rotation": [0, 0, 0],
      "scale": [1, 1, 1],
      "animDir": [0, 0, 0.1], "animSpeed": 0.3,
      "animRotSpeed": [0, 0, 0],
      "textureOverride": null, "textureFilter": "nearest", "tileU": 1, "tileV": 1
    },
    {
      "id": "node_rifle_anim",
      "name": "Rifle girando",
      "modelId": "rifle",
      "parentId": null,
      "position": [0, 0, 0],
      "rotation": [0, 0, 0],
      "scale": [1, 1, 1],
      "animDir": [0, 0, 0], "animSpeed": 0,
      "animRotSpeed": [0, 1.0, 0],
      "textureOverride": null, "textureFilter": "nearest", "tileU": 1, "tileV": 1
    },
    {
      "id": "node_smg_anim",
      "name": "SMG girando em 3D",
      "modelId": "smg",
      "parentId": null,
      "position": [0.2, 0, 0],
      "rotation": [0, 0, 0],
      "scale": [1, 1, 1],
      "animDir": [0, 0, 0], "animSpeed": 0,
      "animRotSpeed": [0.5, 1.0, 0.3],
      "textureOverride": null, "textureFilter": "nearest", "tileU": 1, "tileV": 1
    }
  ],
  "selectedNodeId": null
}
```

- [ ] **Step 4: Verificar carregando cada cena**

Recarregar a página. Pra cada arquivo de `examples/`:
1. Clicar "Carregar JSON" → escolher.
2. Verificar visualmente que faz sentido (chão, hierarquia segue o pai, animações rodam).

**Atenção:** os IDs de picking são gerados sequencialmente em runtime; ao carregar JSON, eles são recriados. Isso NÃO afeta o JSON em si (pickingId não é serializado) — só significa que após carregar, picking continua funcionando normalmente.

---

# Fase 6 — Verificação

## Task 17: Testes automatizados

**Files:**
- Create: `test.html`
- Create: `tests.js`

**O que esta task faz:** cria 3 testes automatizados rodando no console do browser — cobrem hierarquia, animação, JSON roundtrip. São as 3 áreas de código puro mais fáceis de quebrar silenciosamente.

- [ ] **Step 1: Criar `test.html`**

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Testes — Editor de Cena</title>
  <style>
    body { font-family: monospace; padding: 20px; background: #1e1e1e; color: #ddd; }
    h1 { font-size: 16px; }
    .ok   { color: #6c6; }
    .fail { color: #f66; }
    pre { background: #111; padding: 12px; border-radius: 4px; }
  </style>
</head>
<body>
  <h1>Testes — Editor de Cena</h1>
  <p>Abra o console (F12) pra ver os resultados detalhados.</p>
  <pre id="results">(rodando...)</pre>
  <script type="module" src="tests.js"></script>
</body>
</html>
```

- [ ] **Step 2: Criar `tests.js`**

```js
// tests.js
// Testes automatizados focados em código puro (sem WebGL/DOM).
//
// Cobre 3 invariantes mais fáceis de quebrar:
//   1. updateWorldMatrices: filho herda transform do pai.
//   2. updateAnimations: integração com dt produz movimento esperado.
//   3. JSON roundtrip: salvar + carregar não perde nada.
//
// Como rodar: abrir test.html no browser, ver resultados na <pre> e no console.

import { m4 } from './src/lib/m4.js';
import { Scene } from './src/scene/scene.js';
import { updateAnimations } from './src/scene/animation.js';

const tests = [];
const output = document.getElementById('results');
let outputText = '';

/** Registra um teste. */
function test(name, fn) {
  tests.push({ name, fn });
}

/** Assert: deep equals via JSON.stringify (suficiente pra primitivos + arrays). */
function assertEq(actual, expected, msg = '') {
  // Tolera diferença de ponto flutuante em arrays.
  if (Array.isArray(actual) && Array.isArray(expected)) {
    if (actual.length !== expected.length) {
      throw new Error(`${msg}\n  tamanhos diferentes: ${actual.length} vs ${expected.length}`);
    }
    for (let i = 0; i < actual.length; i++) {
      if (Math.abs(actual[i] - expected[i]) > 1e-5) {
        throw new Error(`${msg}\n  [${i}] esperado ${expected[i]}, obtido ${actual[i]}`);
      }
    }
    return;
  }
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${msg}\n  esperado: ${JSON.stringify(expected)}\n  obtido:   ${JSON.stringify(actual)}`);
  }
}

// =============================================================================
// 1. Hierarquia
// =============================================================================
test('Hierarquia: worldMatrix do filho compõe com o pai', () => {
  const scene = new Scene();
  const parent = scene.addNode({ modelId: 'fake', position: [10, 0, 0] });
  const child  = scene.addNode({ modelId: 'fake', position: [0, 5, 0] }, parent);
  scene.updateWorldMatrices();

  // Extrai translação da worldMatrix do filho (m4 guarda em col-major; pos = elements 12,13,14).
  const wm = child.worldMatrix;
  const worldPos = [wm[12], wm[13], wm[14]];
  assertEq(worldPos, [10, 5, 0], 'filho deve estar em [10,5,0] (pai 10 + local 5y)');
});

// =============================================================================
// 2. Animação
// =============================================================================
test('Animação: integra dt corretamente em translação', () => {
  const scene = new Scene();
  const node = scene.addNode({
    modelId: 'fake',
    position: [0, 0, 0],
    animDir: [1, 0, 0],
    animSpeed: 2,
  });
  updateAnimations(scene, 1.0);  // dt = 1 segundo
  assertEq(node.position, [2, 0, 0], 'andou 2 unidades em X (dir=1, speed=2, dt=1)');
});

test('Animação: integra dt corretamente em rotação', () => {
  const scene = new Scene();
  const node = scene.addNode({
    modelId: 'fake',
    rotation: [0, 0, 0],
    animRotSpeed: [0, 1, 0],
  });
  updateAnimations(scene, 0.5);
  assertEq(node.rotation, [0, 0.5, 0], 'rotação Y avançou 0.5 rad (vel=1 rad/s, dt=0.5s)');
});

// =============================================================================
// 3. JSON roundtrip
// =============================================================================
test('JSON roundtrip: salvar e carregar preserva todos os campos', () => {
  const original = new Scene();
  const a = original.addNode({
    modelId: 'pistol',
    name: 'Pistola A',
    position: [1, 2, 3],
    rotation: [0.1, 0.2, 0.3],
    scale: [2, 2, 2],
    animDir: [0, 0, 1], animSpeed: 0.5,
    animRotSpeed: [0, 0.5, 0],
    textureOverride: 'rifle',
    textureFilter: 'linear',
    tileU: 2, tileV: 3,
  });
  const b = original.addNode({
    modelId: 'rifle',
    name: 'Rifle filho de A',
    position: [0, 1, 0],
  }, a);

  const json = original.toJson();

  // Reconstrói em outra Scene.
  const restored = new Scene();
  restored.loadFromJson(json);

  // Verifica que serializar a restaurada dá o mesmo resultado.
  assertEq(restored.toJson(), json, 'toJson() da Scene restaurada deve bater com original');
});

// =============================================================================
// Runner
// =============================================================================
let passed = 0;
let failed = 0;
for (const { name, fn } of tests) {
  try {
    fn();
    outputText += `✅ ${name}\n`;
    console.log(`✅ ${name}`);
    passed++;
  } catch (e) {
    outputText += `❌ ${name}: ${e.message}\n`;
    console.error(`❌ ${name}:`, e);
    failed++;
  }
}
outputText += `\n${passed} passou, ${failed} falhou.`;
output.textContent = outputText;
```

- [ ] **Step 3: Rodar os testes**

Com o `python3 -m http.server 8000` rodando, abrir `http://localhost:8000/test.html`.

Esperado:
- 4 linhas `✅` (1 hierarquia + 2 animação + 1 JSON roundtrip).
- `4 passou, 0 falhou.`

Se algum falhar, a mensagem de erro indica esperado vs obtido — investigar o módulo correspondente.

---

## Task 18: Smoke test completo + README final

**Files:**
- Modify: `README.md`

**O que esta task faz:** rodar o checklist manual do spec do começo ao fim, anotar bugs encontrados, expandir README final pra entrega.

- [ ] **Step 1: Atualizar `README.md`**

Substituir conteúdo por:

````markdown
# Editor de Cena WebGL2 — Trabalho 1 de CG

Editor de cena 3D em WebGL2 vanilla (HTML + JS, sem build).

## Como rodar

```bash
cd "<pasta do projeto>"
python3 -m http.server 8000
```

Acessar `http://localhost:8000/` no navegador (Chrome, Firefox ou Safari).

## Uso

- **Painel esquerdo:** clique num modelo pra adicionar à cena.
- **Canvas central:**
  - Mouse esquerdo + arrastar = rotacionar câmera
  - Mouse direito + arrastar = pan
  - Scroll = zoom
  - Click (sem arrastar) = selecionar modelo
- **Painel direito-topo:** árvore da cena. Clique seleciona; × deleta.
- **Painel direito-baixo:** edita propriedades do nó selecionado (transform, animação, textura, hierarquia).
- **Topo:** botões Salvar/Carregar JSON.

## Cenas de exemplo

Carregar via "Carregar JSON":
- `examples/cena_simples.json` — pistola sobre chão.
- `examples/cena_hierarquia.json` — rifle girando com cubo como filho.
- `examples/cena_animada.json` — modelos translando e girando.

## Estrutura do código

```
src/
├── main.js               # entry point, mainLoop, render
├── lib/                  # twgl.js, m4.js (auxiliares do webgl2fundamentals)
├── gl/                   # shaders, programa, parser de OBJ
├── scene/                # Catalog, SceneNode, Scene, animação
├── interaction/          # câmera orbital, picking
└── ui/                   # 4 painéis HTML
```

Detalhes em `docs/superpowers/specs/2026-05-27-editor-de-cena-design.md`.

## Testes automatizados

Abrir `http://localhost:8000/test.html` — 4 testes cobrindo hierarquia, animação e JSON roundtrip.

## Assets

Modelos do [Retro Weapon Pack](https://itch.io/) (licença livre), convertidos de FBX pra OBJ no Blender.
````

- [ ] **Step 2: Rodar o smoke test completo do spec**

Abrir `http://localhost:8000/` e rodar TODO o checklist da seção 11 do spec:

```
□  Carregamento inicial (sem erro, 16 thumbnails aparecem)
□  Adicionar à cena (cada um dos 16 modelos)
□  Câmera (rotacionar, scroll-zoom, pan)
□  Picking (acerto + limpar seleção)
□  Inspector: transformações (posição, rotação°, escala)
□  Inspector: animação (translação + rotação contínua + parar)
□  Inspector: textura (swap + filtro + tile)
□  Hierarquia (reparent, mover pai arrasta filho, deletar pai some filho)
□  Save/Load JSON (roundtrip preserva tudo)
□  Compartilhamento de geometria (catalog.get('pistol').vao === ele mesmo entre instâncias)
```

Cada item: marcar ✓ se passou, anotar bug se falhou.

- [ ] **Step 3: Resolver bugs encontrados (se houver)**

Se algum item do smoke test falhou, voltar ao código correspondente:

| Sintoma | Onde investigar |
|---|---|
| Picking acerta o nó errado | `picking.js` — inversão de Y, DPR |
| Textura não troca via dropdown | `inspector.js` (handler) + `drawScene` em `main.js` (uso) |
| Animação acumula erros visíveis | `animation.js` — `dt` muito grande? Verificar `lastFrameMs` |
| Save/Load não restaura algo | comparar `node.toJson()` vs lista de campos no Inspector |
| Reparent quebra a árvore | `scene.js` `setParent` — verificar remoção do parent antigo |

- [ ] **Step 4: Gravar o vídeo de explicação**

(Não é tarefa de código — checklist do que mostrar no vídeo)

Roteiro sugerido:
1. **Introdução (~30s):** O que o trabalho faz. Mostrar a tela principal.
2. **Arquitetura (~1min):** Abrir o spec, mostrar o diagrama de arquitetura, explicar o papel do Catalog.
3. **Carregar uma cena de exemplo (~1min):** Demonstrar Salvar/Carregar. Mostrar o JSON resultante no editor.
4. **Tour pelo código (~3-5min):** Abrir os arquivos principais:
   - `main.js` mainLoop
   - `scene.js` updateWorldMatrices + hierarquia
   - `animation.js` integração dt
   - `picking.js` color picking via FBO
5. **Demonstração interativa (~2min):** Adicionar modelos, editar transforms, fazer hierarquia, animar, mostrar que mover o pai arrasta os filhos.
6. **Mostrar testes automatizados:** abrir `test.html` e o `tests.js`.

---

# Self-review do plano

Após escrever o plano completo, esta seção lista possíveis lacunas e como resolvê-las.

## Cobertura dos requisitos do .pptx

| Req | Onde está implementado no plano |
|---|---|
| R1 — WebGL2 em HTML/JS sem OpenGL nativo | T2 (index.html + main.js) |
| R2 — Carregar um conjunto de modelos | T4 (OBJ loader) + T5 (Catalog) |
| R3 — Menu com lista de modelos em 3D | T11 (thumbnails) |
| R4 — Click no modelo → aparece no centro | T11 (handler addNode) |
| R5 — Menu pra editar propriedades | T13 (Inspector) |
| R6 — Translação/Escala/Rotação | T13 (vec3Rows) |
| R7 — Propriedades de textura | T13 (textureOverride/filter/tile) |
| R8 — Animação | T8 + T13 |
| R9 — Hierarquia | T7 (Scene.setParent) + T13 (dropdown pai) |
| R10 — Modelo 1× na memória | T5 (Catalog singleton) + T8 (groupNodesByModelId) |
| R11 — Menus em HTML, não em WebGL | T2 (index.html) + T11-T14 |
| R12 — Salvar JSON | T14 + T15 |
| R13 — Carregar JSON | T14 + T15 |
| R14 — (opcional) Picking 3D | T10 |
| R15 — Vídeo | T18 step 4 |

Todos os requisitos têm task correspondente.

## Possíveis riscos não cobertos

- **Modelos fora de escala:** os FBX exportados do Blender podem ter unidades muito pequenas (~0.05). Se o canvas ficar vazio aparente, ajustar `camera.distance` inicial ou aplicar escala uniforme no Catalog.
- **Textura não carrega por path:** `models.json` tem paths com espaços; o browser codifica automaticamente, mas se algum 404 aparecer, conferir o path EXATO.
- **`m4.js` UMD vs ES module:** Adicionamos `export { m4 }` no final. Se algum import falhar com "m4 is not exported", verificar que essa linha está presente.

---

**Fim do plano.**







