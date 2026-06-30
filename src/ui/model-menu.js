// Painel esquerdo: thumbnail 3D 96×96 por modelo do catálogo. Click adiciona
// um SceneNode com aquele modelId à cena.
//
// Browsers limitam ~16 contextos WebGL ativos por página. Pra não estourar
// (16 thumbs + canvas principal = 17 -> evita o mais antigo, tela central
// fica branca), UM único contexto WebGL2 offscreen renderiza todos os
// thumbnails e o resultado é copiado pra cada <canvas> visível via contexto
// 2D (drawImage). Contextos 2D não contam pro limite. Total: principal + 1.

import * as twgl from '../lib/twgl-full.module.js';
import { m4 } from '../lib/m4.js';

const THUMB_SIZE = 96;

export class ModelMenu {
  /**
   * @param {HTMLElement} containerElement - onde o menu vai ser renderizado
   * @param {WebGL2RenderingContext} gl     - contexto WebGL principal (não usado pra thumbnails; mantido por compatibilidade)
   * @param {object} programInfoMain        - ProgramInfo do programa main (não usado aqui)
   * @param {import('../scene/catalog.js').Catalog} catalog
   * @param {import('../scene/scene.js').Scene} scene
   */
  constructor(containerElement, gl, programInfoMain, catalog, scene) {
    this.container = containerElement;
    this.catalog = catalog;
    this.scene = scene;

    // Renderizador offscreen compartilhado (criado sob demanda em render()).
    this._offscreenCanvas = null;   // HTMLCanvasElement não anexado ao DOM
    this._glThumb = null;           // contexto WebGL2 único pros thumbnails
    this._thumbProgram = null;      // ProgramInfo do shader de preview
    // Recursos de GPU por modelo (criados uma vez no contexto compartilhado).
    this._modelGpu = new Map();     // modelId -> { bufferInfo, tex }
  }

  /**
   * Constrói o DOM e renderiza um thumbnail pra cada modelo.
   * Chamar uma vez depois de catalog.loadAll terminar.
   */
  render() {
    this.container.innerHTML = '';
    this._ensureThumbRenderer();

    for (const model of this.catalog.list()) {
      // Estrutura: <div class="model-thumb"> <canvas /> <div class="label" /> </div>
      const thumb = document.createElement('div');
      thumb.className = 'model-thumb';
      thumb.title = `Adicionar "${model.name}" à cena`;

      const canvas = document.createElement('canvas');
      canvas.width = THUMB_SIZE;
      canvas.height = THUMB_SIZE;
      // Contexto 2d: destino onde copiamos o render do contexto offscreen.
      const ctx2d = canvas.getContext('2d');
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

      // Renderiza o thumbnail (no offscreen) e copia pro canvas 2d.
      this._renderThumbnail(ctx2d, model);
    }
  }

  /**
   * Cria (uma vez) o contexto WebGL2 offscreen e o programa de preview.
   */
  _ensureThumbRenderer() {
    if (this._glThumb) return;

    const off = document.createElement('canvas');
    off.width = THUMB_SIZE;
    off.height = THUMB_SIZE;
    // preserveDrawingBuffer: true garante que o conteúdo continue legível por
    // drawImage mesmo quando o redesenho acontece num callback async (textura).
    const gl2 = off.getContext('webgl2', { preserveDrawingBuffer: true });
    if (!gl2) {
      console.warn('[model-menu] WebGL2 indisponível pro renderizador de thumbnails.');
      return;
    }

    // Shader minimalista de preview (sem tile, sem ambient configurável).
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

    this._offscreenCanvas = off;
    this._glThumb = gl2;
    this._thumbProgram = twgl.createProgramInfo(gl2, [vs, fs]);
  }

  /**
   * Garante que os recursos de GPU (buffers + textura) do modelo existam no
   * contexto compartilhado, depois desenha e copia pro canvas 2d destino.
   *
   * @param {CanvasRenderingContext2D} ctx2d - destino visível
   * @param {object} model
   */
  _renderThumbnail(ctx2d, model) {
    const gl2 = this._glThumb;
    if (!gl2) return;

    let gpu = this._modelGpu.get(model.id);
    if (!gpu) {
      // Recria buffers a partir dos arrays brutos guardados em Catalog.
      // (WebGL não permite compartilhar buffers entre contextos, então o
      // contexto offscreen tem a sua própria cópia.)
      const arrays = model._rawArrays;
      if (!arrays) {
        console.warn(`[model-menu] modelo "${model.id}" sem rawArrays — thumbnail não renderiza.`);
        return;
      }
      const bufferInfo = twgl.createBufferInfoFromArrays(gl2, arrays);

      // Textura: se o modelo não tem, usa um placeholder cinza 1×1.
      const textureOpts = model._textureUrl
        ? { src: model._textureUrl, minMag: gl2.NEAREST, wrap: gl2.REPEAT, flipY: 1 }
        : { src: [200, 200, 200, 255], width: 1, height: 1 };

      const tex = twgl.createTexture(gl2, textureOpts, () => {
        // Textura terminou de carregar (async) -> redesenha este thumbnail.
        this._drawModelToCtx(model, ctx2d);
      });

      gpu = { bufferInfo, tex };
      this._modelGpu.set(model.id, gpu);
    }

    // Draw imediato (caso a textura já esteja pronta ou seja o placeholder).
    this._drawModelToCtx(model, ctx2d);
  }

  /**
   * Renderiza um modelo no contexto offscreen e copia o resultado pro ctx2d.
   *
   * @param {object} model
   * @param {CanvasRenderingContext2D} ctx2d
   */
  _drawModelToCtx(model, ctx2d) {
    const gl2 = this._glThumb;
    const gpu = this._modelGpu.get(model.id);
    if (!gl2 || !gpu) return;

    gl2.viewport(0, 0, THUMB_SIZE, THUMB_SIZE);
    gl2.clearColor(0.12, 0.13, 0.16, 1);
    gl2.enable(gl2.DEPTH_TEST);
    gl2.clear(gl2.COLOR_BUFFER_BIT | gl2.DEPTH_BUFFER_BIT);

    // Câmera fixa enquadrando o modelo. Modelos do pack são pequenos
    // (escala ~0.1-0.5), então distância 0.3 funciona pra maioria.
    const aspect = 1; // canvas quadrado
    const projection = m4.perspective(Math.PI / 4, aspect, 0.01, 10);
    const view = m4.lookAt([0.3, 0.2, 0.3], [0, 0.05, 0], [0, 1, 0]);
    const world = m4.identity();
    const mvp = m4.multiply(m4.multiply(projection, m4.inverse(view)), world);

    gl2.useProgram(this._thumbProgram.program);
    twgl.setBuffersAndAttributes(gl2, this._thumbProgram, gpu.bufferInfo);
    twgl.setUniforms(this._thumbProgram, { u_mvp: mvp, u_world: world, u_albedo: gpu.tex });
    twgl.drawBufferInfo(gl2, gpu.bufferInfo);

    // Copia o pixel buffer do contexto offscreen pro canvas 2d visível.
    ctx2d.clearRect(0, 0, THUMB_SIZE, THUMB_SIZE);
    ctx2d.drawImage(this._offscreenCanvas, 0, 0);
  }
}
