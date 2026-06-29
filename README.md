# Editor de Cena WebGL2 — Trabalho 1 de CG

Editor de cena 3D em WebGL2 vanilla (HTML + JS, sem build).

## Como rodar

```bash
cd "<pasta do projeto>"
python3 -m http.server 8000
```

Acessar `http://localhost:8000/` no navegador (Chrome, Firefox ou Safari).

## Uso

- **Painel esquerdo:** clique num modelo pra adicionar à cena.
- **Canvas central:**
  - Mouse esquerdo + arrastar = rotacionar câmera
  - Mouse direito + arrastar = pan
  - Scroll = zoom
  - Click (sem arrastar) = selecionar modelo
- **Painel direito-topo:** árvore da cena. Clique seleciona; `×` deleta.
- **Painel direito-baixo:** edita propriedades do nó selecionado (transform, animação, textura, hierarquia).
- **Topo:** botões Salvar/Carregar JSON.

## Cenas de exemplo

Carregar via "Carregar JSON":

- `examples/cena_simples.json` — pistola sobre chão.
- `examples/cena_hierarquia.json` — rifle girando com cubo como filho.
- `examples/cena_animada.json` — modelos translando e girando.

## Estrutura do código

```
src/
├── main.js               # entry point, mainLoop, render
├── lib/                  # twgl.js, m4.js (auxiliares do webgl2fundamentals)
├── gl/                   # shaders, programa, parser de OBJ
├── scene/                # Catalog, SceneNode, Scene, animação
├── interaction/          # câmera orbital, picking
└── ui/                   # 4 painéis HTML
```

## Assets

Modelos do Retro Weapon Pack (licença livre, https://itch.io/), convertidos de FBX pra OBJ no Blender.
