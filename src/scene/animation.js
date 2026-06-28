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
