// src/main.js — entry point do editor.
// Inicializa WebGL2, carrega o catálogo de modelos, monta os painéis de UI
// (menu, árvore, inspector, IO) e roda o loop de render (animação +
// atualização de matrizes mundo + desenho da cena).

import * as twgl from './lib/twgl-full.module.js';
import { m4 } from './lib/m4.js';
import { createPrograms } from './gl/program.js';
import { Catalog } from './scene/catalog.js';
import { Scene } from './scene/scene.js';
import { updateAnimations } from './scene/animation.js';
import { Camera } from './interaction/camera.js';
import { PickingSystem } from './interaction/picking.js';
import { ModelMenu } from './ui/model-menu.js';
import { SceneTree } from './ui/scene-tree.js';
import { Inspector } from './ui/inspector.js';
import { setupIoButtons } from './ui/io-buttons.js';

const canvas = document.getElementById('main-canvas');
const gl = canvas.getContext('webgl2');
if (!gl) { alert('WebGL2 não suportado'); throw new Error('webgl2 indisponível'); }

const programs = createPrograms(gl);
const catalog = new Catalog();
const scene = new Scene();
const camera = new Camera(canvas);
const picking = new PickingSystem(gl, programs.picking);

async function bootstrap() {
  await catalog.loadAll(gl, programs.main);

  // Constrói o menu de modelos (painel esquerdo) com thumbnails 3D.
  const modelMenuElement = document.getElementById('model-menu-list');
  const modelMenu = new ModelMenu(modelMenuElement, gl, programs.main, catalog, scene);
  modelMenu.render();

  // Constrói a árvore da cena (painel direito-topo).
  const sceneTreeElement = document.getElementById('scene-tree');
  const sceneTree = new SceneTree(sceneTreeElement, scene);
  sceneTree.render();

  // Constrói o inspector (painel direito-baixo).
  const inspectorElement = document.getElementById('inspector');
  const inspector = new Inspector(inspectorElement, scene, catalog);
  inspector.render();

  // Conecta os botões Salvar/Carregar JSON do topo.
  setupIoButtons(scene, camera);

  // Cena começa vazia — o usuário adiciona modelos clicando no menu da esquerda.

  // Conecta picking: clique no canvas seleciona o nó embaixo do cursor.
  camera.onClick = (cssX, cssY) => {
    // Recalcula viewProjection atual (mesma que será usada no próximo frame).
    const aspect = canvas.width / canvas.height;
    const projection = m4.perspective(Math.PI / 3, aspect, 0.01, 100);
    const viewProjection = m4.multiply(projection, camera.getViewMatrix());

    const clickedNode = picking.pick(scene, catalog, viewProjection, cssX, cssY);
    scene.select(clickedNode);
  };

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
 */
function drawScene() {
  const aspect = canvas.width / canvas.height;
  const projection = m4.perspective(Math.PI / 3, aspect, 0.01, 100);
  // Câmera orbital — usuário controla com mouse (ver src/interaction/camera.js).
  const viewMatrix = camera.getViewMatrix();
  const viewProjection = m4.multiply(projection, viewMatrix);

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

      // Aplica o filtro escolhido pelo usuário (nearest = pixelado, linear = suave).
      // Reseta no objeto de textura (afeta todos os usos dela neste frame).
      const filterValue = node.textureFilter === 'linear' ? gl.LINEAR : gl.NEAREST;
      gl.bindTexture(gl.TEXTURE_2D, textureSource);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filterValue);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filterValue);

      // worldInverseTranspose pra normais resistirem a escalas não-uniformes.
      const worldInverseTranspose = m4.transpose(m4.inverse(node.worldMatrix));

      // Nó selecionado fica visualmente mais claro (ambiente maior).
      const isSelected = node === scene.selectedNode;
      const ambient = isSelected ? 0.6 : 0.25;

      twgl.setUniforms(programs.main, {
        u_viewProjection: viewProjection,
        u_worldMatrix: node.worldMatrix,
        u_worldInverseTranspose: worldInverseTranspose,
        u_albedo: textureSource,
        u_lightDir: m4.normalize([0.3, 0.7, 0.5]),
        u_ambient: ambient,
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
