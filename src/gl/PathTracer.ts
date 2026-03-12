import { fullscreenVert, pathtracerFrag, displayFrag } from './shaders'

export class PathTracer {
  private gl: WebGL2RenderingContext
  private traceProgram: WebGLProgram
  private displayProgram: WebGLProgram
  private fbos: WebGLFramebuffer[] = []
  private textures: WebGLTexture[] = []
  private vao: WebGLVertexArrayObject
  private frameCount = 0
  private ping = 0
  private mode: number
  private scene: number
  private targetSamples = 0
  private width: number
  private height: number

  constructor(canvas: HTMLCanvasElement, mode: 'uniform' | 'direct', scene = 0) {
    this.mode = mode === 'uniform' ? 0 : 1
    this.scene = scene
    this.width = canvas.width
    this.height = canvas.height

    const gl = canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: false })
    if (!gl) throw new Error('WebGL2 not supported')
    this.gl = gl

    gl.getExtension('EXT_color_buffer_float')

    this.traceProgram = this.createProgram(fullscreenVert, pathtracerFrag)
    this.displayProgram = this.createProgram(fullscreenVert, displayFrag)

    this.vao = gl.createVertexArray()!
    gl.bindVertexArray(this.vao)

    for (let i = 0; i < 2; i++) {
      const tex = gl.createTexture()!
      gl.bindTexture(gl.TEXTURE_2D, tex)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, this.width, this.height, 0, gl.RGBA, gl.FLOAT, null)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

      const fbo = gl.createFramebuffer()!
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0)

      this.textures.push(tex)
      this.fbos.push(fbo)
    }

    this.reset()
    this.displayCurrent()
  }

  get currentFrame() { return this.frameCount }
  get done() { return this.frameCount >= this.targetSamples }

  reset() {
    const gl = this.gl
    this.frameCount = 0
    this.ping = 0
    for (const fbo of this.fbos) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
    }
    this.displayCurrent()
  }

  setTargetSamples(n: number) {
    this.targetSamples = n
    this.reset()
  }

  setScene(scene: number) {
    this.scene = scene
    this.reset()
  }

  /** Render exactly one sample per pixel and display. Returns new frame count. */
  renderOneSample(): number {
    if (this.frameCount >= this.targetSamples) return this.frameCount

    const gl = this.gl
    gl.bindVertexArray(this.vao)

    const readIdx = this.ping
    const writeIdx = 1 - this.ping

    // Trace one sample, accumulate
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbos[writeIdx])
    gl.viewport(0, 0, this.width, this.height)
    gl.useProgram(this.traceProgram)

    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.textures[readIdx])
    gl.uniform1i(gl.getUniformLocation(this.traceProgram, 'u_prevAccum'), 0)
    gl.uniform2f(gl.getUniformLocation(this.traceProgram, 'u_resolution'), this.width, this.height)
    gl.uniform1f(gl.getUniformLocation(this.traceProgram, 'u_frame'), this.frameCount)
    gl.uniform1i(gl.getUniformLocation(this.traceProgram, 'u_mode'), this.mode)
    gl.uniform1i(gl.getUniformLocation(this.traceProgram, 'u_scene'), this.scene)

    gl.drawArrays(gl.TRIANGLES, 0, 3)

    this.ping = writeIdx
    this.frameCount++

    this.displayCurrent()
    return this.frameCount
  }

  /** Render N samples in one go. */
  renderBatch(n: number): number {
    const count = Math.min(n, this.targetSamples - this.frameCount)
    for (let i = 0; i < count; i++) {
      // Skip display for intermediate frames
      if (i < count - 1) {
        this.traceOneNoDisplay()
      } else {
        this.renderOneSample()
      }
    }
    return this.frameCount
  }

  private traceOneNoDisplay() {
    if (this.frameCount >= this.targetSamples) return

    const gl = this.gl
    gl.bindVertexArray(this.vao)

    const readIdx = this.ping
    const writeIdx = 1 - this.ping

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbos[writeIdx])
    gl.viewport(0, 0, this.width, this.height)
    gl.useProgram(this.traceProgram)

    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.textures[readIdx])
    gl.uniform1i(gl.getUniformLocation(this.traceProgram, 'u_prevAccum'), 0)
    gl.uniform2f(gl.getUniformLocation(this.traceProgram, 'u_resolution'), this.width, this.height)
    gl.uniform1f(gl.getUniformLocation(this.traceProgram, 'u_frame'), this.frameCount)
    gl.uniform1i(gl.getUniformLocation(this.traceProgram, 'u_mode'), this.mode)
    gl.uniform1i(gl.getUniformLocation(this.traceProgram, 'u_scene'), this.scene)

    gl.drawArrays(gl.TRIANGLES, 0, 3)

    this.ping = writeIdx
    this.frameCount++
  }

  private displayCurrent() {
    const gl = this.gl
    gl.bindVertexArray(this.vao)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, this.width, this.height)
    gl.useProgram(this.displayProgram)

    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.textures[this.ping])
    gl.uniform1i(gl.getUniformLocation(this.displayProgram, 'u_accumTex'), 0)
    gl.uniform1f(gl.getUniformLocation(this.displayProgram, 'u_frameCount'), Math.max(this.frameCount, 1))
    gl.uniform2f(gl.getUniformLocation(this.displayProgram, 'u_resolution'), this.width, this.height)

    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }

  dispose() {
    const gl = this.gl
    this.textures.forEach(t => gl.deleteTexture(t))
    this.fbos.forEach(f => gl.deleteFramebuffer(f))
    gl.deleteProgram(this.traceProgram)
    gl.deleteProgram(this.displayProgram)
    gl.deleteVertexArray(this.vao)
  }

  private createProgram(vert: string, frag: string): WebGLProgram {
    const gl = this.gl
    const vs = gl.createShader(gl.VERTEX_SHADER)!
    gl.shaderSource(vs, vert)
    gl.compileShader(vs)
    if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS))
      console.error('Vert:', gl.getShaderInfoLog(vs))

    const fs = gl.createShader(gl.FRAGMENT_SHADER)!
    gl.shaderSource(fs, frag)
    gl.compileShader(fs)
    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS))
      console.error('Frag:', gl.getShaderInfoLog(fs))

    const prog = gl.createProgram()!
    gl.attachShader(prog, vs)
    gl.attachShader(prog, fs)
    gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS))
      console.error('Link:', gl.getProgramInfoLog(prog))

    gl.deleteShader(vs)
    gl.deleteShader(fs)
    return prog
  }
}
