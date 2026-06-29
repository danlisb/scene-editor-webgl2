// Câmera orbital. Estado em coords esféricas: target + distance + azimuth +
// elevation (rad). Mouse esquerdo rotaciona (az/elev), direito faz pan (move
// target no plano de visão), scroll faz zoom (distance). Clique sem drag
// dispara onClick — usado pelo picking. Elevation é clamped em ±84° pra
// evitar o gimbal-lock do lookAt quando alinha com o vetor up.

import { m4 } from '../lib/m4.js';

const ELEVATION_LIMIT = Math.PI / 2 - 0.05;  // ~84 graus
const ZOOM_MIN = 0.05;
const ZOOM_MAX = 20;
const ROT_SENSITIVITY = 0.008;   // rad por pixel
const PAN_SENSITIVITY = 0.0015;  // unidades por pixel (proporcional a distance)
const ZOOM_SENSITIVITY = 1.1;    // multiplicativo por wheel tick

export class Camera {
  /**
   * @param {HTMLCanvasElement} canvas - usado pra eventos de mouse e dimensões
   */
  constructor(canvas) {
    this.canvas = canvas;

    // Estado inicial: 45° de elevação, distância 0.5, olhando pra origem.
    this.target    = [0, 0, 0];
    this.distance  = 0.5;
    this.azimuth   = 0.7;
    this.elevation = 0.4;

    // Estado de drag (preenchido nos handlers).
    this._dragMode = null;   // 'rotate' | 'pan' | null
    this._lastX = 0;
    this._lastY = 0;

    // Detecção clique-vs-drag (pra picking).
    this._mouseDownX = 0;
    this._mouseDownY = 0;
    this._mouseDownTime = 0;

    /** Callback chamado quando o usuário CLICA (sem drag). UI conecta picking aqui. */
    this.onClick = null;  // (x, y) => void

    this._installEventHandlers();
  }

  _installEventHandlers() {
    const c = this.canvas;
    c.addEventListener('mousedown', e => this._onMouseDown(e));
    c.addEventListener('mousemove', e => this._onMouseMove(e));
    c.addEventListener('mouseup',   e => this._onMouseUp(e));
    c.addEventListener('mouseleave', () => { this._dragMode = null; });
    c.addEventListener('wheel',     e => this._onWheel(e), { passive: false });
    // Desliga menu de contexto pra mouse direito poder ser usado como pan.
    c.addEventListener('contextmenu', e => e.preventDefault());
  }

  _onMouseDown(e) {
    this._lastX = e.clientX;
    this._lastY = e.clientY;
    this._mouseDownX = e.clientX;
    this._mouseDownY = e.clientY;
    this._mouseDownTime = performance.now();
    if (e.button === 0)      this._dragMode = 'rotate';
    else if (e.button === 2) this._dragMode = 'pan';
  }

  _onMouseMove(e) {
    if (!this._dragMode) return;
    const dx = e.clientX - this._lastX;
    const dy = e.clientY - this._lastY;
    this._lastX = e.clientX;
    this._lastY = e.clientY;

    if (this._dragMode === 'rotate') {
      this.azimuth   -= dx * ROT_SENSITIVITY;
      this.elevation += dy * ROT_SENSITIVITY;
      // Clamp pra não virar de cabeça pra baixo.
      this.elevation = Math.max(-ELEVATION_LIMIT, Math.min(ELEVATION_LIMIT, this.elevation));
    } else if (this._dragMode === 'pan') {
      // Pan: move target no plano de visão da câmera.
      // Calcula vetores right/up da câmera e desloca proporcional ao drag.
      const { right, up } = this._cameraBasis();
      const factor = PAN_SENSITIVITY * this.distance;
      this.target[0] -= (right[0] * dx - up[0] * dy) * factor;
      this.target[1] -= (right[1] * dx - up[1] * dy) * factor;
      this.target[2] -= (right[2] * dx - up[2] * dy) * factor;
    }
  }

  _onMouseUp(e) {
    const wasRotate = this._dragMode === 'rotate';
    this._dragMode = null;

    // Detecta clique (botão esquerdo, drag pequeno, duração curta).
    if (wasRotate && e.button === 0) {
      const movedX = e.clientX - this._mouseDownX;
      const movedY = e.clientY - this._mouseDownY;
      const dist = Math.sqrt(movedX * movedX + movedY * movedY);
      const duration = performance.now() - this._mouseDownTime;
      if (dist < 5 && duration < 300 && this.onClick) {
        // Coordenadas em pixels CSS do canvas (não DPR-multiplicados).
        const rect = this.canvas.getBoundingClientRect();
        this.onClick(e.clientX - rect.left, e.clientY - rect.top);
      }
    }
  }

  _onWheel(e) {
    e.preventDefault();
    // Scroll pra baixo (deltaY > 0) afasta; pra cima aproxima.
    const factor = e.deltaY > 0 ? ZOOM_SENSITIVITY : 1 / ZOOM_SENSITIVITY;
    this.distance = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, this.distance * factor));
  }

  /**
   * Calcula a posição da câmera a partir de target + distance + azimuth + elevation.
   * @returns {[number, number, number]}
   */
  getPosition() {
    const ce = Math.cos(this.elevation);
    const se = Math.sin(this.elevation);
    const ca = Math.cos(this.azimuth);
    const sa = Math.sin(this.azimuth);
    return [
      this.target[0] + this.distance * ce * sa,
      this.target[1] + this.distance * se,
      this.target[2] + this.distance * ce * ca,
    ];
  }

  /**
   * Devolve matriz view (inversa do transform da câmera).
   * @returns {Float32Array}
   */
  getViewMatrix() {
    const eye = this.getPosition();
    return m4.inverse(m4.lookAt(eye, this.target, [0, 1, 0]));
  }

  /**
   * Calcula vetores "right" e "up" da câmera no espaço mundo, pro pan.
   */
  _cameraBasis() {
    const eye = this.getPosition();
    const forward = m4.normalize([
      this.target[0] - eye[0],
      this.target[1] - eye[1],
      this.target[2] - eye[2],
    ]);
    const right = m4.normalize(m4.cross(forward, [0, 1, 0]));
    const up = m4.normalize(m4.cross(right, forward));
    return { right, up };
  }

  /** Serializa estado pro JSON. */
  toJson() {
    return {
      target: [...this.target],
      distance: this.distance,
      azimuth: this.azimuth,
      elevation: this.elevation,
    };
  }

  /** Restaura estado vindo do JSON. */
  fromJson(data) {
    this.target = [...data.target];
    this.distance = data.distance;
    this.azimuth = data.azimuth;
    this.elevation = data.elevation;
  }
}
