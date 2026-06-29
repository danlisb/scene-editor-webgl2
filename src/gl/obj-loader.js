// Parser de .obj (Wavefront). Lê v/vn/vt/f, triangula n-gons por fan, devolve
// BufferInfo pronto pro twgl. Suporta merge (junta todos os blocos 'o') ou
// objectName (carrega só um bloco). Ignora .mtl — textura vem por fora via
// models.json porque os paths que o Blender escreve no .mtl ficam quebrados.
// Adaptado de https://webgl2fundamentals.org/webgl/lessons/webgl-load-obj-w-mtl.html

import * as twgl from '../lib/twgl-full.module.js';

/**
 * Carrega um arquivo OBJ e devolve um BufferInfo pronto pra renderizar.
 *
 * @param {WebGL2RenderingContext} gl
 * @param {string} url - URL do arquivo .obj
 * @param {object} options
 * @param {boolean} [options.merge=true]    - junta todos os blocos 'o' em uma única geometria
 * @param {string}  [options.objectName]    - se setado, carrega só esse bloco 'o' (ignora merge)
 * @returns {Promise<{ bufferInfo: object, vertexCount: number }>}
 */
export async function loadObj(gl, url, options = {}) {
  const { merge = true, objectName } = options;

  // 1) Baixar o conteúdo do .obj como texto.
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Falha ao baixar ${url}: ${response.status}`);
  const text = await response.text();

  // 2) Parsear linha por linha.
  const objData = parseObj(text);

  // 3) Filtrar quais 'o' blocks vamos usar.
  let blocks;
  if (objectName) {
    blocks = objData.objects.filter(o => o.name === objectName);
    if (blocks.length === 0) {
      throw new Error(`Objeto "${objectName}" não encontrado em ${url}. ` +
                      `Disponíveis: ${objData.objects.map(o => o.name).join(', ')}`);
    }
  } else if (merge) {
    blocks = objData.objects;  // todos
  } else {
    blocks = [objData.objects[0]];  // só o primeiro
  }

  // 4) Concatenar vértices/normais/UVs/índices dos blocos selecionados.
  const positions = [];
  const normals   = [];
  const uvs       = [];
  for (const block of blocks) {
    // Cada face do bloco vira 3 vértices "expandidos" (sem reuso por índice).
    // Simplifica o parser; o overhead é aceitável pra escala desse projeto.
    for (const face of block.faces) {
      for (const vert of face) {
        // vert = { v: idx_posicao, vt: idx_uv, vn: idx_normal }
        const p = objData.positions[vert.v - 1];
        const t = vert.vt ? objData.uvs[vert.vt - 1]      : [0, 0];
        const n = vert.vn ? objData.normals[vert.vn - 1]  : [0, 1, 0];
        positions.push(p[0], p[1], p[2]);
        uvs.push(t[0], t[1]);
        normals.push(n[0], n[1], n[2]);
      }
    }
  }

  // 5) Criar BufferInfo via twgl (geometria sem índices — drawArrays).
  const bufferInfo = twgl.createBufferInfoFromArrays(gl, {
    a_position: { numComponents: 3, data: positions },
    a_normal:   { numComponents: 3, data: normals },
    a_uv:       { numComponents: 2, data: uvs },
  });

  // 6) Criar VAO pra esses buffers — vamos compartilhar entre os nós.
  //    O VAO é criado com base no programa "main"; o programa "picking" também
  //    usa só a_position, então o mesmo VAO serve pros dois (twgl ignora atributos
  //    do VAO que o programa atual não usa).
  // OBS: o VAO real vai ser criado em catalog.js usando este bufferInfo.
  //      Aqui só devolvemos o bufferInfo e o vertexCount.

  return {
    bufferInfo,
    vertexCount: positions.length / 3,
    // Arrays brutos guardados pra outros contextos WebGL (ex: thumbnails do menu)
    // poderem recriar buffers — WebGL não permite compartilhar buffer entre contextos.
    rawArrays: {
      a_position: { numComponents: 3, data: positions },
      a_normal:   { numComponents: 3, data: normals },
      a_uv:       { numComponents: 2, data: uvs },
    },
  };
}

/**
 * Parser interno de OBJ.
 * Reconhece: o (objeto), v (vértice), vn (normal), vt (UV), f (face).
 * Ignora: usemtl, mtllib, s, g (não usamos esses no projeto).
 *
 * @param {string} text - conteúdo do .obj
 * @returns {{ positions: number[][], normals: number[][], uvs: number[][],
 *             objects: Array<{ name: string, faces: Array<Array<{v:number,vt?:number,vn?:number}>> }> }}
 */
function parseObj(text) {
  const positions = [];
  const normals   = [];
  const uvs       = [];
  const objects   = [];
  let current = { name: 'default', faces: [] };
  objects.push(current);

  // Itera as linhas; ignora comentários e linhas vazias.
  const lines = text.split('\n');
  for (let raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;

    const parts = line.split(/\s+/);
    const tag = parts[0];

    if (tag === 'o') {
      // Novo bloco de objeto. O nome pode ter espaços; pega tudo depois do 'o '.
      const name = line.slice(2).trim();
      // Se o primeiro 'o' aparece antes de qualquer face, sobrescrevemos o default.
      if (current.faces.length === 0 && objects.length === 1) {
        current.name = name;
      } else {
        current = { name, faces: [] };
        objects.push(current);
      }
    }
    else if (tag === 'v') {
      // Vértice de posição.
      positions.push([parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])]);
    }
    else if (tag === 'vn') {
      // Vértice de normal.
      normals.push([parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])]);
    }
    else if (tag === 'vt') {
      // Coord de textura.
      uvs.push([parseFloat(parts[1]), parseFloat(parts[2])]);
    }
    else if (tag === 'f') {
      // Face: cada parte é "v/vt/vn" (vt e vn opcionais).
      // OBJ pode ter face com >3 vértices (quad ou n-gon).
      // Triangulamos com fan: (0, i, i+1) pra i de 1 a n-2.
      const verts = parts.slice(1).map(parseFaceVertex);
      for (let i = 1; i < verts.length - 1; i++) {
        current.faces.push([verts[0], verts[i], verts[i + 1]]);
      }
    }
    // Demais tags (usemtl, mtllib, s, g) são ignoradas intencionalmente.
  }

  return { positions, normals, uvs, objects };
}

/**
 * Parseia um vértice de face no formato "v", "v/vt", "v//vn" ou "v/vt/vn".
 * Índices no OBJ são 1-based; mantemos assim aqui (corrigimos pra 0-based no consumidor).
 *
 * @param {string} s
 * @returns {{ v: number, vt?: number, vn?: number }}
 */
function parseFaceVertex(s) {
  const [v, vt, vn] = s.split('/');
  return {
    v: parseInt(v, 10),
    vt: vt ? parseInt(vt, 10) : undefined,
    vn: vn ? parseInt(vn, 10) : undefined,
  };
}
