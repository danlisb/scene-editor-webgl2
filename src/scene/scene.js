// Scene: árvore de SceneNodes + índice id->nó + seleção corrente. Recalcula
// worldMatrix de cada nó por traversal recursivo (parent->children) e dispara
// eventos (structureChanged, selectionChanged, nodeChanged) pra UI reagir
// sem polling. Também faz a (de)serialização JSON da cena toda.

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

  // ---- Persistência --------------------------------------------------------

  /** Limpa a cena toda. */
  clear() {
    this.rootNodes = [];
    this.nodesById.clear();
    this.selectedNode = null;
    this._emit('structureChanged');
    this._emit('selectionChanged');
  }

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
}
