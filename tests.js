// tests.js
// Testes automatizados focados em código puro (sem WebGL/DOM).
//
// Cobre 3 invariantes mais fáceis de quebrar:
//   1. updateWorldMatrices: filho herda transform do pai.
//   2. updateAnimations: integração com dt produz movimento esperado.
//   3. JSON roundtrip: salvar + carregar não perde nada.
//
// Como rodar: abrir test.html no browser, ver resultados na <pre> e no console.

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
  original.addNode({
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
