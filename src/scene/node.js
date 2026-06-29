// SceneNode: instância de um modelo na cena. Referencia o modelo por modelId
// (não duplica buffer/textura). Guarda transform local, animação contínua e
// overrides opcionais de textura/filtro/tile.

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

    // Se o id veio pronto (ex: carregado de JSON) e segue o padrão "node_NNN",
    // avança o contador global pra que ids gerados depois não colidam com ele.
    // Sem isso: carregar uma cena salva e depois adicionar um nó poderia
    // regerar um id já em uso, sobrescrevendo o nó no índice nodesById.
    if (opts.id) {
      const match = /^node_(\d+)$/.exec(opts.id);
      if (match) {
        const n = parseInt(match[1], 10);
        if (n >= _nextId) _nextId = n + 1;
      }
    }

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
