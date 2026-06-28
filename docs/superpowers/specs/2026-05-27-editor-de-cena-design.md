# Editor de Cena WebGL2 — Design

**Disciplina:** Computação Gráfica
**Trabalho:** Trabalho 1
**Data:** 2026-05-27
**Status:** Aprovado (brainstorming) — pronto pra fase de plano de implementação

---

## 1. Objetivo do projeto

Construir um site (HTML + JS, WebGL2 — **sem OpenGL nativo**) que funciona como **editor de cena 3D**. O usuário escolhe modelos de um catálogo, instancia eles numa cena, edita transformações/animação/textura, monta hierarquias pai-filho, e consegue salvar e carregar a cena em arquivo JSON.

Requisitos diretos do enunciado (slides do `trabalho1.pptx`):

| # | Requisito | Onde é atendido |
|---|---|---|
| R1 | Site WebGL2 em HTML/JS, **não** OpenGL nativo | Toda a arquitetura |
| R2 | Carregar um conjunto de modelos | §2 Catálogo |
| R3 | Menu com lista de modelos disponíveis **renderizados em 3D**, não só nomes | §2 Menu 3D |
| R4 | Clicar num modelo do menu → ele aparece no centro da cena | §5 UI, §3 Cena |
| R5 | Menu pra editar propriedades dos modelos na cena | §5 Inspector |
| R6 | Editar transformações: translação, escala, rotação | §3 SceneNode, §5 Inspector |
| R7 | Editar propriedades da textura | §3 textureOverride/filter/tile, §5 Inspector |
| R8 | Editar animação (para onde vai e velocidade) | §3 animDir/animSpeed/animRotSpeed, §4 tick |
| R9 | Hierarquia entre objetos da cena | §3 SceneNode.parent, §5 Scene-tree |
| R10 | Modelo só pode existir 1× na memória; instâncias compartilham geometria | §1 Catalog, §4 render por modelId |
| R11 | Menus, botões e textos em HTML, **não** dentro do WebGL | §5 UI |
| R12 | Salvar cena em arquivo JSON | §6 saveSceneAsJson |
| R13 | Carregar JSON salvo | §6 loadSceneFromJson |
| R14 | (Opcional) Picking 3D com mouse | §3 Picking, §5 click handler |
| R15 | Entregar vídeo explicando o trabalho | Fora do escopo do código |

---

## 2. Decisões tomadas no brainstorming

Resumo das escolhas que orientam o resto do design:

| Decisão | Escolha | Alternativas descartadas |
|---|---|---|
| Ambição | **Completo** (com picking, hierarquia multinível, animação trans+rot, câmera orbital) | Mínimo viável; Avançado com luzes múltiplas/undo/gizmos |
| Setup de dev | **Vanilla JS + ES modules**, sem npm/build. `<script type="module">` direto no HTML. Helpers `twgl.js` e `m4.js` copiados do webgl2fundamentals como arquivos locais. Servido com `python -m http.server`. | Vite/npm; Vanilla sem helpers |
| Interpretação de animação | **Translação linear (direção × velocidade) + rotação contínua por eixo (velocidade angular)** | Só translação; Ida-volta entre 2 pontos |
| Propriedades de textura editáveis | **Swap de textura + filtro (nearest/linear) + tile U/V** | Só swap; Conjunto amplo com offset e tint |
| Idioma do código | **Inglês** (identificadores, classes, funções, arquivos) | Tudo PT; Misturado |
| Idioma dos comentários | **Português** (linha, bloco, JSDoc) | Inglês; Sem comentários |
| Idioma de strings de UI | **Português** ("Salvar JSON", "Adicionar", "Velocidade", etc.) | Inglês |

---

## 3. Vocabulário

Pra evitar ambiguidade no resto do documento:

- **Catálogo (Catalog)**: estrutura em memória que carrega os arquivos `.obj` e `.png` **uma vez** e expõe pra qualquer parte do código acessar. Identificado por `modelId`.
- **Modelo (Model)**: uma entrada do catálogo. Contém o VAO/buffers de geometria + textura albedo + nome amigável + bounding box.
- **Cena (Scene)**: a árvore de nós que está sendo editada no momento. Tem uma raiz invisível (`root`) cujos filhos são os nós no nível mais alto.
- **Nó (SceneNode / Node)**: uma instância de um modelo dentro da cena. Carrega ref ao `modelId` + transform local + propriedades de animação + propriedades de textura override + lista de filhos.
- **Hierarquia**: relação pai-filho entre nós. Transform mundo de um filho = transform mundo do pai × transform local do filho.
- **Inspector**: painel HTML à direita que mostra os campos editáveis do nó selecionado.
- **Picking**: técnica de renderizar a cena com cada nó pintado de uma cor única num framebuffer offscreen, e ler o pixel sob o cursor pra descobrir qual nó foi clicado.

---

## 4. Convenções de código

Regras válidas pra todo arquivo de código deste projeto:

| Categoria | Idioma | Exemplos |
|---|---|---|
| Identificadores no código (variáveis, funções, classes, arquivos) | **inglês** | `scene`, `node`, `selectedNode`, `updateAnimations()`, `Camera`, `models.json` |
| API WebGL + libs externas | inglês (fixo) | `gl.useProgram`, `twgl.createProgramInfo`, `m4.lookAt` |
| Identificadores GLSL | inglês curto | `u_worldMatrix`, `a_position`, `v_uv` |
| Comentários (linha, bloco, JSDoc) | **português** | `// Multiplica a matriz pai pela local pra obter a world` |
| Strings de UI | **português** | `"Adicionar à cena"`, `"Salvar JSON"`, `"Velocidade"` |

**Princípios de estilo:**

- Comentários explicam **o porquê e o como**, não o quê. Em código de gráficos: por que esse uniform existe, o que essa matriz faz na pipeline, por que multiplicar nessa ordem.
- JSDoc nas funções principais (`@param`, `@returns`) em português — a interface fica óbvia sem ler o corpo.
- Estrutura linear: evitar abstrações pra abstrações. Função `renderScene()` fazendo tudo em sequência é melhor que pattern com 4 classes que se chamam.
- Sem clever code: imperativo verboso é preferível.

---

## 5. Arquitetura geral

### Estrutura de arquivos

```
Trab 1/
├── index.html               # canvas + 3 painéis HTML, importa main.js
├── styles.css
├── src/
│   ├── main.js              # entry point: bootstrap, mainLoop
│   ├── gl/
│   │   ├── shaders.js       # fontes GLSL inline (program normal + program picking)
│   │   ├── program.js       # wrappers de program/uniforms (usa twgl)
│   │   └── obj-loader.js    # parser de OBJ+MTL (adaptado do tutorial)
│   ├── scene/
│   │   ├── catalog.js       # carrega os ~16 modelos 1x na memória
│   │   ├── scene.js         # grafo de cena: nós, hierarquia, traversal
│   │   ├── node.js          # SceneNode: transform local + world matrix
│   │   └── animation.js     # função updateAnimations(dt) sobre a cena
│   ├── interaction/
│   │   ├── camera.js        # câmera orbital (mouse esq=rotaciona, dir=pan, scroll=zoom)
│   │   └── picking.js       # color-picking via framebuffer (1 ID por nó)
│   ├── ui/
│   │   ├── model-menu.js    # painel esquerdo: lista 3D de modelos
│   │   ├── scene-tree.js    # painel direito-topo: árvore da hierarquia
│   │   ├── inspector.js     # painel direito-baixo: edita props da seleção
│   │   └── io-buttons.js    # botões "Salvar JSON" / "Carregar JSON"
│   └── lib/
│       ├── twgl-full.module.js   # copiado do webgl2fundamentals
│       └── m4.js                  # idem
├── assets/
│   └── models.json          # catálogo: nome → arquivo OBJ + textura + estratégia
├── examples/
│   ├── cena_simples.json
│   ├── cena_hierarquia.json
│   └── cena_animada.json
├── test.html                # roda os testes automatizados
├── tests.js                 # 3 testes pontuais (matriz mundo, anim, JSON roundtrip)
├── RetroWeaponPack_V1 Assets/ # já existe; OBJ+MTL+PNG referenciados pelo models.json
└── README.md
```

### Como as peças conversam

```
                ┌───────────────────┐
                │   Catalog (1x)    │  ← OBJ buffers + textures em memória
                └─────────┬─────────┘
                          │ shared geometry (modelId)
                          ▼
   ┌──────────┐    ┌──────────────┐    ┌────────────┐
   │ ModelMenu│───▶│    Scene     │◀───│ Inspector  │
   │ (HTML)   │add │ (lista nós)  │edit│   (HTML)   │
   └──────────┘    └──────┬───────┘    └────────────┘
                          │                  ▲
                          ▼                  │ select
                  ┌──────────────┐    ┌──────┴─────┐
                  │  mainLoop    │───▶│  Picking   │
                  │   (render)   │    │ (FBO read) │
                  └──────────────┘    └────────────┘
```

**Princípio central:** o `Catalog` é a única dona dos buffers/texturas. Cada nó referencia o modelo pelo `modelId` — sem duplicação de geometria. Isso atende R10 ("modelo só pode existir 1× na memória").

---

## 6. Catálogo de modelos e menu 3D

### Catálogo (`assets/models.json`)

Config explícita pra cada item do menu. **Fugimos dos paths zoados que o Blender escreveu nos `.mtl`** (espaços não escapados, subpasta `Texture/` em vez de `Textures/`): o loader vai ignorar o `map_Kd` do MTL e pegar o caminho da textura daqui.

```jsonc
{
  "models": [
    {
      "id": "pistol",
      "name": "Pistol",
      "obj": "RetroWeaponPack_V1 Assets/RetroWeaponsPack/Guns/Pistol_01/FbxFiles/Pistol_01.obj",
      "texture": "RetroWeaponPack_V1 Assets/RetroWeaponsPack/Guns/Pistol_01/Textures/Pistol_01_Albedo.png",
      "merge": true
    },
    { "id": "rifle",    "name": "Rifle",    "obj": "...", "texture": "...", "merge": true },
    { "id": "shotgun",  "name": "Shotgun",  "obj": "...", "texture": "...", "merge": true },
    { "id": "smg",      "name": "SMG",      "obj": "...", "texture": "...", "merge": true },

    {
      "id": "block_cube",
      "name": "Cube",
      "obj": "RetroWeaponPack_V1 Assets/BlockoutAssets/BasicBlockoutMeshes.obj",
      "objectName": "Blockout_Cube"
    },
    { "id": "block_plane",    "name": "Plane",    "obj": "...", "objectName": "Blockout_Plane" },
    { "id": "block_plane_c",  "name": "Plane (centered)", "obj": "...", "objectName": "Blockout_Plane_Centered" },
    { "id": "block_capsule",  "name": "Capsule",  "obj": "...", "objectName": "Capsule" },

    {
      "id": "bullet_1",
      "name": "Bullet 1",
      "obj": "RetroWeaponPack_V1 Assets/RetroWeaponsPack/Guns/AdditionalMeshes/Projectiles/FbxFile/Projectiles.obj",
      "texture": "RetroWeaponPack_V1 Assets/RetroWeaponsPack/Guns/AdditionalMeshes/Projectiles/Texture/Projectiles_Albedo.png",
      "objectName": "<descobrir ao implementar — um dos 8 nomes 'o' no arquivo>"
    }
    // ... +7 entradas pros projéteis restantes
  ]
}
```

**Duas estratégias de carga por modelo:**

- `merge: true` → todos os blocos `o ...` do arquivo OBJ são unidos num único mesh. Usado pras 4 armas (cada arma é uma peça só funcionalmente).
- `objectName: "X"` → carrega só o bloco `o X` daquele OBJ. Usado pros 4 blockouts e 8 projéteis (cada `o` é um item separado no menu).

**Total esperado no menu: ~16 itens** (4 armas + 4 blockouts + 8 projéteis). Os `_AdditionalMeshes.obj` das armas ficam fora do MVP — fáceis de adicionar via uma linha no JSON se sobrar tempo.

### Renderização do menu 3D (R3 — "não só os nomes")

Cada item do menu é uma `<div>` com um `<canvas width=96 height=96>` próprio. No carregamento inicial:

1. `Catalog` carrega os OBJs + texturas.
2. Pra cada modelo, computa a bounding box e enquadra uma câmera nele (distância proporcional ao maior eixo).
3. Renderiza **uma vez** (snapshot estático) no canvas pequeno usando o mesmo program GLSL da cena principal.
4. Snapshot fica lá; HTML cuida apenas do evento `click → scene.addNode({ modelId })`.

**Por que snapshot estático e não canvases vivos:** 16 canvases rodando em loop = 16× overhead de render por frame. Snapshot é renderizado uma vez no startup. Visual ainda é 3D real (perspectiva, luz, textura) — não é PNG pré-renderizado.

---

## 7. Cena, hierarquia e seleção

### `SceneNode`

```js
class SceneNode {
  id           // string única, ex: "node_001"
  name         // editável pelo usuário (ex: "Pistola principal")
  modelId      // ref ao Catalog (ex: "pistol")
  parent       // SceneNode | null
  children     // SceneNode[]

  // Transform local (compõe com o do pai pra formar o world)
  position     // [x, y, z]
  rotation     // [rx, ry, rz] em radianos (Euler XYZ)
  scale        // [sx, sy, sz]

  // Animação (integrada em position/rotation a cada frame)
  animDir      // [dx, dy, dz] direção da translação contínua
  animSpeed    // escalar (unidades/segundo)
  animRotSpeed // [rsx, rsy, rsz] velocidade angular por eixo (rad/s)

  // Textura — overrides do que vem do Catalog
  textureOverride // string modelId | null (null = usa textura do próprio modelo)
  textureFilter   // "nearest" | "linear"
  tileU, tileV    // floats — multiplicador de UV para repetir/esticar

  // Cache de runtime (não serializado pro JSON)
  worldMatrix     // recalculada a cada frame
  pickingId       // uint32 — usado no shader de picking
}
```

### Composição de transform e animação

A cada frame, dentro de `updateAnimations(dt)`:

```
position += animDir * animSpeed * dt
rotation += animRotSpeed * dt
```

A animação é **integrada** continuamente em `position` e `rotation` (não recalculada do zero). Consequências:

- Zerar `animSpeed` no Inspector **para** a animação, mas mantém o objeto onde ele andou até agora.
- Editar `position` direto no Inspector **teleporta** o objeto pra aquele lugar.
- A combinação de translação linear + rotação contínua é o que o slide pede ("para onde vai e velocidade").

Depois, em `updateWorldMatrices()`:

```
localMatrix = T(position) × R(rotation) × S(scale)
worldMatrix = (parent.worldMatrix || identity) × localMatrix
```

Traversal recursivo a partir da raiz garante que a ordem está certa (pai antes do filho).

### Picking

Implementação clássica de **color picking** com framebuffer offscreen:

1. Cada `SceneNode` recebe um `pickingId` uint32 único quando é criado.
2. Existe um program GLSL secundário (`pickingProgram`) que, em vez de cor de textura, escreve `pickingId` codificado em RGBA no fragment.
3. Quando há clique pendente, o mainLoop renderiza a cena uma vez nesse program, no framebuffer offscreen.
4. `gl.readPixels(x, y, 1, 1, ...)` lê o pixel sob o cursor → decodifica os 4 bytes RGBA em uint32 → procura o nó com aquele ID.
5. `scene.select(node)` dispara evento → Inspector e Scene-tree re-renderizam.

Render normal e picking compartilham os **mesmos VAOs do Catalog** — só o program muda. Isso evita duplicar geometria.

### UI da hierarquia (Scene-tree)

Painel HTML que exibe a árvore como `<ul>` aninhado. Cada item tem botões pequenos:

- `+` adiciona um filho (abre modal pra escolher modelId, ou usa o último adicionado)
- `×` remove o nó (e seus descendentes)
- `↕` reparent — abre um `<select>` com IDs disponíveis (incluindo "(raiz)")

Drag-and-drop **fica fora** — exige bastante código DOM e não traz nada conceitual.

---

## 8. Render loop, câmera e iluminação

### `mainLoop`

```js
let lastFrameMs = 0;

// Loop principal: chamado pelo navegador uma vez por frame via requestAnimationFrame.
// tempoAtualMs vem do RAF e está em milissegundos desde o load da página.
function mainLoop(tempoAtualMs) {
  // Delta time em segundos pra animação ficar consistente entre FPS diferentes
  // (60fps -> dt ~0.016, 30fps -> dt ~0.033).
  const dt = (tempoAtualMs - lastFrameMs) / 1000;
  lastFrameMs = tempoAtualMs;

  // 1) Avança translação e rotação contínua de cada nó.
  scene.updateAnimations(dt);

  // 2) Recalcula matrizes world percorrendo a árvore (pai antes do filho).
  scene.updateWorldMatrices();

  // 3) Desenha a cena no canvas visível.
  sceneRenderer.draw(scene, camera, light);

  // 4) Se houve clique pendente, faz um pass de picking offscreen
  //    pra descobrir qual nó está embaixo do cursor.
  if (pendingClick) {
    const clickedNode = pickingRenderer.readNodeAt(pendingClick.x, pendingClick.y);
    scene.select(clickedNode);
    pendingClick = null;
  }

  requestAnimationFrame(mainLoop);
}
```

### Câmera orbital

Estado:

```js
class Camera {
  target     // [x, y, z] ponto pra onde ela olha
  distance   // float — distância do alvo
  azimuth    // float (rad) — rotação horizontal em torno do alvo
  elevation  // float (rad) — rotação vertical, clampada em [-π/2 + ε, π/2 - ε]
}
```

Posição é derivada por trigonometria:

```
posX = target.x + distance * cos(elevation) * sin(azimuth)
posY = target.y + distance * sin(elevation)
posZ = target.z + distance * cos(elevation) * cos(azimuth)

viewMatrix = m4.lookAt([posX, posY, posZ], target, [0, 1, 0])
```

**Controles:**

| Evento | Efeito |
|---|---|
| `mousedown` esquerdo + drag | varia `azimuth` (horizontal) e `elevation` (vertical) |
| `wheel` | varia `distance` com clamp em [min, max] |
| `mousedown` direito + drag | translada `target` no plano de visão da câmera |
| `mousedown` esquerdo **sem drag** (< 5px, < 300ms) | marca `pendingClick` |
| `contextmenu` | `preventDefault()` pra mouse direito não abrir menu do browser |

### Iluminação

Mantém simples — uma luz direcional + ambiente.

- **Luz direcional**: direção fixa no shader (`u_lightDir`), cor branca.
- **Ambiente**: multiplicador 0.2 da textura, evita sombras pretas absolutas.
- **Modelo**: Lambertiano (só difuso, N · L). Sem specular. Shaders ficam curtos e fáceis de explicar.

GLSL do fragment shader principal (esboço):

```glsl
#version 300 es
precision highp float;

in vec3 v_normal;
in vec2 v_uv;

uniform sampler2D u_albedo;
uniform vec3 u_lightDir;     // já normalizado
uniform float u_ambient;     // ex: 0.2
uniform vec2 u_tile;         // multiplicador de UV

out vec4 outColor;

void main() {
  // Repete a textura conforme tile (tileU, tileV) configurado no nó.
  vec4 tex = texture(u_albedo, v_uv * u_tile);

  // Difuso Lambertiano: intensidade = max(0, N · L).
  float diffuse = max(0.0, dot(normalize(v_normal), u_lightDir));

  // Cor final = textura * (ambiente + difuso).
  outColor = vec4(tex.rgb * (u_ambient + diffuse), tex.a);
}
```

### Compartilhamento de geometria (R10)

O renderizador agrupa nós da cena por `modelId`. Pseudo-código do desenho:

```js
function drawScene(scene, camera, light) {
  // Agrupa todos os nós por qual modelo eles instanciam.
  const groups = scene.groupNodesByModelId();

  for (const [modelId, nodes] of groups) {
    const model = catalog.get(modelId);

    // Bind do VAO UMA VEZ por modelo.
    gl.bindVertexArray(model.vao);

    // Loop pelos nós: cada um seta seu uniforms e desenha,
    // mas o VAO/buffers continuam o mesmo objeto na GPU.
    for (const node of nodes) {
      setUniform("u_worldMatrix", node.worldMatrix);
      setUniform("u_tile",        [node.tileU, node.tileV]);
      bindTexture(node.textureOverride ?? model.textureId, node.textureFilter);
      gl.drawElements(gl.TRIANGLES, model.indexCount, gl.UNSIGNED_SHORT, 0);
    }
  }
}
```

Esse padrão atende R10 sem precisar do `gl_InstanceID` ainda. Se sobrar tempo, dá pra trocar pelo instanced drawing real do tutorial sem mudar interface.

---

## 9. UI e interação

### Layout (`index.html`)

```
┌──────────────────────────────────────────────────────────────┐
│  [Salvar JSON] [Carregar JSON]              <Trab 1 - CG>    │  ← topo
├──────────┬──────────────────────────────────┬────────────────┤
│          │                                  │  Cena (tree)   │
│ Modelos  │                                  │ ▾ root         │
│          │                                  │   ▾ Pistol#1   │
│ ┌──┐┌──┐ │           Canvas WebGL           │     Bullet#1   │
│ │P │ │R │ │     (clique-arrasta = orbita    │   Rifle#1     │
│ └──┘└──┘ │      scroll = zoom               │   Cube#1       │
│ ┌──┐┌──┐ │      botão dir. = pan)           ├────────────────┤
│ │S │ │SH│ │                                  │ Inspector      │
│ └──┘└──┘ │                                  │ ─ Nome: ____   │
│  ...     │                                  │ ─ Modelo: ____ │
│  (16     │                                  │ ─ Posição XYZ  │
│  itens)  │                                  │ ─ Rotação XYZ  │
│          │                                  │ ─ Escala XYZ   │
│          │                                  │ ─ Anim dir/spd │
│          │                                  │ ─ Textura ▼    │
│          │                                  │ ─ Filtro ▼     │
│          │                                  │ ─ Tile U/V     │
│          │                                  │ [Deletar nó]   │
└──────────┴──────────────────────────────────┴────────────────┘
```

CSS Grid: 3 colunas (200px / 1fr / 280px) × 2 linhas (topo fixo / área principal).

### Campos do Inspector

| Campo | Tipo de input | Escreve em |
|---|---|---|
| Nome | `<input type=text>` | `node.name` |
| Modelo (read-only) | label texto | `node.modelId` (não editável depois de criar) |
| Posição X/Y/Z | 3× `<input type=number step=0.1>` | `node.position` |
| Rotação X/Y/Z (graus) | 3× `<input type=number step=1>` | `node.rotation` (converte ° → rad) |
| Escala X/Y/Z | 3× `<input type=number step=0.1>` | `node.scale` |
| Animação direção X/Y/Z | 3× `<input type=number>` | `node.animDir` |
| Animação velocidade | `<input type=number>` | `node.animSpeed` |
| Animação rotação X/Y/Z | 3× `<input type=number>` | `node.animRotSpeed` |
| Textura | `<select>` com os 16 modelIds + "(própria)" | `node.textureOverride` |
| Filtro | `<select>` nearest/linear | `node.textureFilter` |
| Tile U / V | 2× `<input type=number step=0.1>` | `node.tileU` / `node.tileV` |
| Pai | `<select>` com nodeIds + "(raiz)" | dispara `scene.setParent(node, novoPai)` |
| Botão "Deletar nó" | `<button>` | `scene.removeNode(node)` |

### Sincronização

- **Inspector → cena:** edição em qualquer `<input>` muta o nó direto. O próximo frame já reflete no canvas (o mainLoop chama `updateWorldMatrices` sempre).
- **Cena → Inspector:** quando `scene.selectedNode` muda (via picking ou via clique na Scene-tree), o Inspector dispara um re-render completo dos campos com os valores do novo nó.
- Sem two-way binding fancy — re-render brute force é simples e basta nesse tamanho.

### Diferenciar clique de drag

No `mousedown`, guarda timestamp e coordenadas. No `mouseup`:

```
isClique = (
  distance(mousedownPos, mouseupPos) < 5px  &&
  (mouseupTime - mousedownTime) < 300ms
)
```

Se foi clique, marca `pendingClick = { x, y }`. Se foi drag, foi câmera (e a câmera já foi atualizada incrementalmente em cada `mousemove`).

---

## 10. Schema JSON (salvar/carregar)

### Estrutura

```jsonc
{
  // Versão do formato. Detecta JSONs antigos se o schema mudar.
  "version": 1,

  // Estado da câmera no momento do save.
  "camera": {
    "target":   [0, 0, 0],
    "distance": 5.0,
    "azimuth":  0.7,
    "elevation": 0.4
  },

  // Lista plana — a hierarquia vem do "parentId".
  // Lista plana facilita parse e edição manual do JSON.
  "nodes": [
    {
      "id":       "node_001",
      "name":     "Pistola principal",
      "modelId":  "pistol",
      "parentId": null,                  // null = filho da raiz
      "position": [0, 0, 0],
      "rotation": [0, 0, 0],             // radianos
      "scale":    [1, 1, 1],
      "animDir":      [0, 0, 0],
      "animSpeed":    0,
      "animRotSpeed": [0, 0, 0],
      "textureOverride": null,
      "textureFilter":   "nearest",
      "tileU": 1.0,
      "tileV": 1.0
    }
    // ... outros nós
  ],

  // ID do nó atualmente selecionado (opcional).
  "selectedNodeId": "node_001"
}
```

### Por que lista plana e não JSON aninhado

JSON aninhado parece mais "natural" pra árvore, mas tem 3 problemas:

1. **Reparent mexe em arrays profundos**: tirar um nó de um lugar da árvore e colocar em outro vira manipulação de array com índices.
2. **Validar IDs únicos fica chato**: precisa fazer travessia recursiva.
3. **Editar à mão é desconfortável**: indentação fica muito grande conforme aprofunda.

Lista plana + `parentId` é como o **glTF** faz — padrão da indústria.

### Implementação

**Salvar:**

```js
// Botão "Salvar JSON" -> serialize + download via blob.
function saveSceneAsJson() {
  // 1. Coleta o estado da cena num objeto plain.
  const data = {
    version: 1,
    camera: camera.serialize(),
    nodes: scene.getAllNodes().map(node => node.serialize()),
    selectedNodeId: scene.getSelectedNode()?.id ?? null,
  };

  // 2. Converte pra string JSON com indentação (legível pra debug).
  const jsonString = JSON.stringify(data, null, 2);

  // 3. Cria um Blob e força o download via link temporário.
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'cena.json';
  a.click();
  URL.revokeObjectURL(url);
}
```

**Carregar:**

```js
// Botão "Carregar JSON" -> <input type="file"> -> parse e reconstrói.
async function loadSceneFromJson(file) {
  // 1. Lê o arquivo como texto e parseia.
  const text = await file.text();
  const data = JSON.parse(text);

  // 2. Valida versão (preparação pra compatibilidade futura).
  if (data.version !== 1) {
    alert(`Versão de JSON não suportada: ${data.version}`);
    return;
  }

  // 3. Limpa a cena atual e restaura câmera.
  scene.clear();
  camera.deserialize(data.camera);

  // 4. Recria nós em duas passadas:
  //    - Primeira: cria todos os nós sem hierarquia (precisa só do modelId).
  //    - Segunda: faz o reparent (precisa que os IDs já existam).
  // Sem isso, um nó cujo pai aparece depois quebraria.
  const nodesById = new Map();
  for (const nodeData of data.nodes) {
    const node = scene.createNodeFromData(nodeData);
    nodesById.set(node.id, node);
  }
  for (const nodeData of data.nodes) {
    if (nodeData.parentId) {
      const node = nodesById.get(nodeData.id);
      const parent = nodesById.get(nodeData.parentId);
      scene.setParent(node, parent);
    }
  }

  // 5. Restaura seleção (se havia uma).
  if (data.selectedNodeId) {
    scene.select(nodesById.get(data.selectedNodeId));
  }
}
```

### Requisitos do .pptx que esse design atende

| Requisito (slide) | Como é atendido |
|---|---|
| "deve salvar a cena num arquivo json" | `saveSceneAsJson()` baixa cena.json |
| "ser possível carregar um json salvo" | `loadSceneFromJson()` reconstrói a cena |
| "o modelo só pode existir 1× na memória" | JSON salva só refs (`modelId`), Catalog é singleton |
| "transformações e propriedades da textura devem ser diferentes entre as instâncias" | cada nó tem suas próprias position/rotation/scale/textureOverride/filter/tile |

---

## 11. Plano de testes

Pra trabalho desse porte, automação completa é overhead. Estratégia: **checklist manual sólido + alguns testes pontuais do que dá pra automatizar facilmente**.

### A) Smoke test manual (passar antes de gravar o vídeo)

Checklist completo a rodar do começo ao fim:

```
□  Carregamento inicial
   □ Ao abrir index.html, o canvas aparece e os 16 modelos do menu
     renderizam (não ficam preto/quadrado vazio)
   □ Nenhum erro vermelho no console do navegador

□  Adicionar à cena
   □ Clicar em cada um dos 16 modelos do menu adiciona um nó no centro
   □ A Scene-tree reflete a adição

□  Câmera
   □ Mouse esquerdo arrastando rotaciona em volta do centro
   □ Scroll faz zoom in/out sem virar de cabeça pra baixo
   □ Mouse direito arrastando faz pan

□  Picking
   □ Clicar num modelo no canvas seleciona ele (destaque + inspector preenche)
   □ Clicar no vazio limpa a seleção
   □ Picking acerta o mais próximo quando dois modelos estão sobrepostos

□  Inspector — transformações
   □ Editar posição XYZ move o modelo em tempo real
   □ Editar rotação XYZ (em graus) rotaciona corretamente
   □ Editar escala (incluindo negativa) escala / inverte

□  Inspector — animação
   □ Setar animDir=[0,0,1] + animSpeed=1 faz o modelo andar em Z
   □ Setar animRotSpeed.y=1 faz o modelo girar continuamente
   □ Zerar velocidades para a animação sem resetar posição

□  Inspector — textura
   □ Trocar textura via dropdown (ex: textura do rifle no SMG) altera o visual
   □ Filtro nearest vs linear muda a aparência (nearest = pixelado)
   □ Tile U=2 repete a textura horizontalmente

□  Hierarquia
   □ Reparentar nó A como filho de B: mover B move A junto
   □ Reparentar A pra raiz: A volta a se mover independente
   □ Deletar nó pai: descendentes também somem
   □ Animação do pai compõe com a do filho

□  Save / Load
   □ Botão "Salvar JSON" baixa um arquivo cena.json
   □ Recarregar página + "Carregar JSON" desse arquivo → cena volta IDÊNTICA
     (posição, hierarquia, anim, textura override, filtro, tile, seleção, câmera)
   □ Editar um valor no JSON na mão e recarregar reflete a edição

□  Compartilhamento de geometria (R10 do enunciado)
   □ Adicionar 10 cópias do mesmo modelo → catalog.get('pistol').vao é
     o MESMO objeto JS pros 10 nós (verificável no console)
   □ Memória total reportada pela aba "Performance" do DevTools não cresce 10×
     ao instanciar 10× o mesmo modelo
```

### B) Testes automatizados pontuais (`test.html` + `tests.js`)

Cobrem só **código puro** (sem WebGL/DOM) — a parte que pode quebrar silenciosamente em refator:

```js
// tests.js — abre test.html no navegador, vê os ✅/❌ no console.

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assertEq(a, b, msg = '') {
  const eq = JSON.stringify(a) === JSON.stringify(b);
  if (!eq) throw new Error(`${msg}\n  esperado: ${JSON.stringify(b)}\n  obtido:   ${JSON.stringify(a)}`);
}

// 1. Hierarquia: filho herda transform do pai
test('worldMatrix do filho compõe com o pai', () => {
  const scene = new Scene();
  const parent = scene.addNode({ position: [10, 0, 0] });
  const child  = scene.addNode({ position: [0, 5, 0], parentId: parent.id });
  scene.updateWorldMatrices();

  // Posição mundo do filho deve ser [10, 5, 0]
  const worldPos = m4.getTranslation(child.worldMatrix);
  assertEq(worldPos, [10, 5, 0]);
});

// 2. Animação: integração de dt produz movimento esperado
test('animação anda na direção certa por 1 segundo', () => {
  const scene = new Scene();
  const node = scene.addNode({ position: [0,0,0], animDir: [1,0,0], animSpeed: 2 });
  scene.updateAnimations(1.0);
  assertEq(node.position, [2, 0, 0]);
});

// 3. JSON roundtrip: salvar e carregar não perde nada
test('JSON roundtrip preserva todos os campos', () => {
  const sceneOriginal = makeSceneCheia(); // helper que cria cena com hierarquia
  const json = sceneOriginal.toJson();
  const sceneRestaurada = Scene.fromJson(json);
  assertEq(sceneRestaurada.toJson(), json);
});

// runner
tests.forEach(({ name, fn }) => {
  try { fn(); console.log(`✅ ${name}`); }
  catch (e) { console.error(`❌ ${name}: ${e.message}`); }
});
```

3 testes só, mas cobrem as 3 invariantes mais fáceis de quebrar: hierarquia, animação, JSON. O resto cai no manual (envolve renderização ou eventos de mouse — não rola sem ambiente real).

### C) Cenas .json de exemplo no repo

Ter 2-3 cenas prontas em `examples/`:

- `cena_simples.json` — uma pistola, uma cápsula, sem hierarquia
- `cena_hierarquia.json` — pistola com bullet como filho (demonstra composição de transform)
- `cena_animada.json` — modelos rotacionando + translando (demonstra animação)

Servem pra:

- Demonstração rápida no vídeo ("vou carregar essa cena que preparei")
- Smoke test rápido depois de mudança no código
- Caso o avaliador queira ver um exemplo concreto sem montar do zero

---

## 12. Referências (tutoriais do webgl2fundamentals.org)

| Tutorial | Onde é usado |
|---|---|
| `webgl-setup-and-installation` | Setup inicial do projeto |
| `webgl-boilerplate` | Estrutura básica do canvas + shaders |
| `webgl-load-obj-w-mtl` | Parser do OBJ em `src/gl/obj-loader.js` |
| `webgl-less-code-more-fun` | Uso do `twgl.js` pra reduzir boilerplate |
| `webgl-2-textures` | Filtros, wrap, e troca de textura no Inspector |
| `webgl-scene-graph` | Hierarquia em `src/scene/scene.js` (updateWorldMatrices) |
| `webgl-animation` | Padrão do mainLoop com dt |
| `webgl-picking` | Color-picking em `src/interaction/picking.js` |
| `webgl-drawing-multiple-things` | Agrupar nós por modelId no renderizador |
| `webgl-instanced-drawing` | (Stretch) trocar loop por draw instanciado se sobrar tempo |

---

## 13. Próximos passos

1. **Você revisa este documento** — me aponta o que mudar.
2. **Eu invoco a skill `writing-plans`** — gera um plano de implementação detalhado (lista de tarefas em ordem, com critérios de "pronto" pra cada uma).
3. **Eu implemento por etapas** — cada etapa termina num smoke test parcial pra você ver o progresso.
4. **Você grava o vídeo** — usando este doc + o código + as cenas de exemplo como roteiro do que mostrar.
