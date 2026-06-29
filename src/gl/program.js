// Cria os 2 programas shader (main + picking) via twgl.createProgramInfo.
// Wrapper fino só pra centralizar a criação num lugar e deixar main.js
// pegar tudo via createPrograms(gl).

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
