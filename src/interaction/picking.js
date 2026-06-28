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
