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
        // Evento leve: só a árvore re-renderiza (atualiza o label). NÃO usamos
        // 'structureChanged' aqui porque o inspector também escuta esse evento
        // e se re-renderizaria, destruindo este <input> e perdendo o foco a
        // cada tecla digitada.
        this.scene._emit('nodeChanged', node);
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
