import { fullscreenVert, atmosphereFrag } from './shaders'

export class AtmosphereRenderer {
  private gl: WebGL2RenderingContext
  private program: WebGLProgram
  private vao: WebGLVertexArrayObject
  private animId = 0
  private startTime = performance.now()
  private mouseX = 0.5
  private mouseY = 0.5
  private canvas: HTMLCanvasElement

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const gl = canvas.getContext('webgl2', { antialias: false })
    if (!gl) throw new Error('WebGL2 not supported')
    this.gl = gl

    this.program = this.createProgram(fullscreenVert, atmosphereFrag)
    this.vao = gl.createVertexArray()!
    gl.bindVertexArray(this.vao)

    this.startLoop()
  }

  setMouse(nx: number, ny: number) {
    this.mouseX = nx
    this.mouseY = ny
  }

  private startLoop() {
    const loop = () => {
      this.animId = requestAnimationFrame(loop)
      this.render()
    }
    loop()
  }

  private render() {
    const gl = this.gl
    const w = this.canvas.clientWidth
    const h = this.canvas.clientHeight

    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w
      this.canvas.height = h
    }

    gl.viewport(0, 0, w, h)
    gl.bindVertexArray(this.vao)
    gl.useProgram(this.program)

    const t = (performance.now() - this.startTime) / 1000
    gl.uniform2f(gl.getUniformLocation(this.program, 'u_resolution'), w, h)
    gl.uniform1f(gl.getUniformLocation(this.program, 'u_time'), t)
    gl.uniform2f(gl.getUniformLocation(this.program, 'u_mouse'), this.mouseX, this.mouseY)

    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }

  dispose() {
    cancelAnimationFrame(this.animId)
    const gl = this.gl
    gl.deleteProgram(this.program)
    gl.deleteVertexArray(this.vao)
  }

  private createProgram(vert: string, frag: string): WebGLProgram {
    const gl = this.gl

    const vs = gl.createShader(gl.VERTEX_SHADER)!
    gl.shaderSource(vs, vert)
    gl.compileShader(vs)
    if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
      console.error('Vert:', gl.getShaderInfoLog(vs))
    }

    const fs = gl.createShader(gl.FRAGMENT_SHADER)!
    gl.shaderSource(fs, frag)
    gl.compileShader(fs)
    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
      console.error('Frag:', gl.getShaderInfoLog(fs))
    }

    const prog = gl.createProgram()!
    gl.attachShader(prog, vs)
    gl.attachShader(prog, fs)
    gl.linkProgram(prog)
    gl.deleteShader(vs)
    gl.deleteShader(fs)
    return prog
  }
}
