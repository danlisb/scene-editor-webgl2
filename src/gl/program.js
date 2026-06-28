// src/gl/program.js
// Wrappers em cima do twgl.js pra criar/usar programas shader.
//
// Por que existir esse arquivo se o twgl já faz quase tudo:
//   - Centraliza a criação dos 2 programas (main e picking) num lugar.
//   - Expõe uma API mais explícita pro resto do código.
//   - Facilita trocar twgl por código manual depois, se quisermos.

import * as twgl from '../lib/twgl-full.module.js';
import { MAIN_VS, MAIN_FS, PICK_VS, PICK_FS } from './shaders.js';

/**
 * Cria os 2 programas shader e retorna num objeto.
 *
 * @param {WebGL2RenderingContext} gl
 * @returns {{ main: twgl.ProgramInfo, picking: twgl.ProgramInfo }}
 */
export function createPrograms(gl) {
  // twgl.createProgramInfo retorna um objeto com o WebGLProgram + maps
  // dos atributos e uniforms (com setters prontos).
  const main = twgl.createProgramInfo(gl, [MAIN_VS, MAIN_FS]);
  const picking = twgl.createProgramInfo(gl, [PICK_VS, PICK_FS]);
  return { main, picking };
}
