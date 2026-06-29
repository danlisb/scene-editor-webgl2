// Catálogo de modelos: carrega todos os OBJs/texturas UMA VEZ na inicialização
// e expõe por modelId. Atende o requisito do enunciado de que cada modelo só
// existe 1 vez na memória — vários SceneNodes podem referenciar o mesmo id.

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
      // Pra thumbnails do menu: arrays brutos + URL da textura,
      // necessários porque cada thumbnail tem seu próprio contexto WebGL2.
      _rawArrays:   objResult.rawArrays,
      _textureUrl:  def.texture ?? null,
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
