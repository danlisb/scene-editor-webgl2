// src/ui/io-buttons.js
// Conecta os botões "Salvar JSON" e "Carregar JSON" do topo.
//
// Salvar: monta um objeto { version, camera, ...scene.toJson() }, vira string,
//         vira Blob, vira link de download. Tudo client-side.
// Carregar: usa <input type=file> escondido pra abrir picker, lê via File.text().

export function setupIoButtons(scene, camera) {
  const btnSave = document.getElementById('btn-save');
  const btnLoad = document.getElementById('btn-load');
  const fileInput = document.getElementById('file-load');

  btnSave.addEventListener('click', () => {
    saveSceneAsJson(scene, camera);
  });

  // O botão "Carregar" delega pro input file escondido.
  btnLoad.addEventListener('click', () => {
    fileInput.click();
  });

  // Quando o usuário escolhe um arquivo no picker:
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    try {
      await loadSceneFromJson(file, scene, camera);
    } catch (err) {
      console.error('[io] erro ao carregar JSON:', err);
      alert('Erro ao carregar JSON: ' + err.message);
    } finally {
      // Limpa pro mesmo arquivo poder ser escolhido de novo.
      fileInput.value = '';
    }
  });
}

/**
 * Monta o objeto final e força download.
 */
function saveSceneAsJson(scene, camera) {
  const sceneData = scene.toJson();
  const data = {
    version: 1,
    camera: camera.toJson(),
    nodes: sceneData.nodes,
    selectedNodeId: sceneData.selectedNodeId,
  };

  const jsonString = JSON.stringify(data, null, 2);

  // Cria um Blob e força download via link temporário.
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'cena.json';
  document.body.appendChild(a);  // alguns browsers exigem estar no DOM
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Lê o arquivo e reconstrói cena + câmera.
 */
async function loadSceneFromJson(file, scene, camera) {
  const text = await file.text();
  const data = JSON.parse(text);

  if (data.version !== 1) {
    throw new Error(`Versão não suportada: ${data.version}`);
  }

  // Câmera primeiro (não depende da cena).
  if (data.camera) camera.fromJson(data.camera);

  // Cena (o método loadFromJson espera { version, nodes, selectedNodeId }).
  scene.loadFromJson({
    version: data.version,
    nodes: data.nodes,
    selectedNodeId: data.selectedNodeId,
  });
}
