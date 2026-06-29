// Painel direito-topo: árvore HTML refletindo scene.rootNodes recursivamente.
// Click seleciona o nó, × deleta. Re-renderiza inteiro a cada evento da Scene
// (structureChanged, selectionChanged, nodeChanged).

export class SceneTree {
  /**
   * @param {HTMLElement} containerElement
   * @param {import('../scene/scene.js').Scene} scene
   */
  constructor(containerElement, scene) {
    this.container = containerElement;
    this.scene = scene;

    // Re-render quando estrutura ou seleção mudam.
    scene.on('structureChanged', () => this.render());
    scene.on('selectionChanged', () => this.render());
    // 'nodeChanged' (ex: renomear no inspector) atualiza só o label na árvore,
    // sem forçar o inspector a se re-renderizar.
    scene.on('nodeChanged', () => this.render());
  }

  /** Reconstrói toda a árvore. Brute-force mas barato (poucos nós). */
  render() {
    this.container.innerHTML = '';

    if (this.scene.rootNodes.length === 0) {
      const empty = document.createElement('p');
      empty.style.color = '#666';
      empty.textContent = '(cena vazia — clique num modelo do menu)';
      this.container.appendChild(empty);
      return;
    }

    const ul = document.createElement('ul');
    ul.className = 'tree';
    ul.style.listStyle = 'none';
    ul.style.paddingLeft = '0';
    for (const root of this.scene.rootNodes) {
      ul.appendChild(this._renderNode(root));
    }
    this.container.appendChild(ul);
  }

  /** Cria <li> pra um nó (com filhos aninhados). */
  _renderNode(node) {
    const li = document.createElement('li');
    li.style.padding = '2px 0';

    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.gap = '4px';
    row.style.cursor = 'pointer';
    row.style.padding = '2px 4px';
    row.style.borderRadius = '2px';
    if (node === this.scene.selectedNode) {
      row.style.background = '#3a5980';
      row.style.color = '#fff';
    }

    // Nome — click seleciona.
    const label = document.createElement('span');
    label.textContent = node.name;
    label.style.flex = '1';
    label.style.overflow = 'hidden';
    label.style.textOverflow = 'ellipsis';
    label.style.whiteSpace = 'nowrap';
    row.appendChild(label);

    // Botão deletar.
    const btnDel = document.createElement('button');
    btnDel.textContent = '×';
    btnDel.title = 'Remover nó (e seus filhos)';
    btnDel.style.background = 'transparent';
    btnDel.style.border = 'none';
    btnDel.style.color = '#888';
    btnDel.style.cursor = 'pointer';
    btnDel.style.padding = '0 4px';
    btnDel.addEventListener('click', (e) => {
      e.stopPropagation();
      this.scene.removeNode(node);
    });
    row.appendChild(btnDel);

    row.addEventListener('click', () => {
      this.scene.select(node);
    });
    li.appendChild(row);

    // Filhos recursivos com indentação.
    if (node.children.length > 0) {
      const childUl = document.createElement('ul');
      childUl.style.listStyle = 'none';
      childUl.style.paddingLeft = '16px';
      for (const c of node.children) {
        childUl.appendChild(this._renderNode(c));
      }
      li.appendChild(childUl);
    }

    return li;
  }
}
