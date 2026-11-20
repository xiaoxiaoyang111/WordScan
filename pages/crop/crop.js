Page({
  data: {
    path: '',
    ready: false,
    sel: { x: 0, y: 0, w: 0, h: 0 }
  },

  onLoad () {
    const app = getApp()
    const t = app.globalData.cropTemp
    if (!t || !t.path) {
      wx.navigateBack()
      return
    }
    this.slot = t.slot
    this.setData({ path: t.path })
  },

  onReady () {
    wx.createSelectorQuery()
      .select('#stage')
      .boundingClientRect((rect) => {
        this.stageRect = rect
        this.tryInit()
      })
      .exec()
  },

  onImgLoad (e) {
    this.imgW = e.detail.width
    this.imgH = e.detail.height
    this.tryInit()
  },

  tryInit () {
    if (!this.stageRect || !this.imgW || !this.imgH || this.data.ready) return
    const sw = this.stageRect.width
    const sh = this.stageRect.height
    const scale = Math.min(sw / this.imgW, sh / this.imgH)
    const dw = this.imgW * scale
    const dh = this.imgH * scale
    const ox = (sw - dw) / 2
    const oy = (sh - dh) / 2
    this.disp = { ox, oy, dw, dh }
    this.minSize = 40
    this.setData({ ready: true, sel: { x: ox, y: oy, w: dw, h: dh } })
  },

  onMoveStart (e) {
    this._moving = true
    this._sx = e.touches[0].clientX
    this._sy = e.touches[0].clientY
    this._orig = Object.assign({}, this.data.sel)
  },

  onMove (e) {
    if (!this._moving || !this.disp) return
    const dx = e.touches[0].clientX - this._sx
    const dy = e.touches[0].clientY - this._sy
    const { ox, oy, dw, dh } = this.disp
    const o = this._orig
    const x = Math.min(Math.max(o.x + dx, ox), ox + dw - o.w)
    const y = Math.min(Math.max(o.y + dy, oy), oy + dh - o.h)
    this.setData({ sel: { x, y, w: o.w, h: o.h } })
  },

  onMoveEnd () {
    this._moving = false
  },

  onCornerStart (e) {
    this._corner = e.currentTarget.dataset.corner
    this._sx = e.touches[0].clientX
    this._sy = e.touches[0].clientY
    this._orig = Object.assign({}, this.data.sel)
  },

  onCornerMove (e) {
    if (!this._corner || !this.disp) return
    const dx = e.touches[0].clientX - this._sx
    const dy = e.touches[0].clientY - this._sy
    const { ox, oy, dw, dh } = this.disp
    const o = this._orig
    let x1 = o.x
    let y1 = o.y
    let x2 = o.x + o.w
    let y2 = o.y + o.h
    if (this._corner.indexOf('l') >= 0) x1 = Math.min(Math.max(o.x + dx, ox), x2 - this.minSize)
    if (this._corner.indexOf('r') >= 0) x2 = Math.max(Math.min(o.x + o.w + dx, ox + dw), x1 + this.minSize)
    if (this._corner.indexOf('t') >= 0) y1 = Math.min(Math.max(o.y + dy, oy), y2 - this.minSize)
    if (this._corner.indexOf('b') >= 0) y2 = Math.max(Math.min(o.y + o.h + dy, oy + dh), y1 + this.minSize)
    this.setData({ sel: { x: x1, y: y1, w: x2 - x1, h: y2 - y1 } })
  },

  onCornerEnd () {
    this._corner = null
  },

  resetSel () {
    if (!this.disp) return
    const { ox, oy, dw, dh } = this.disp
    this.setData({ sel: { x: ox, y: oy, w: dw, h: dh } })
  },

  cancel () {
    wx.navigateBack()
  },

  confirm () {
    if (!this.data.ready || !this.disp) return
    wx.showLoading({ title: '处理中…', mask: true })
    wx.createSelectorQuery()
      .select('#cropCanvas')
      .fields({ node: true })
      .exec((res) => {
        if (!res || !res[0]) {
          wx.hideLoading()
          wx.showToast({ title: '画布初始化失败', icon: 'none' })
          return
        }
        const canvas = res[0].node
        const ctx = canvas.getContext('2d')
        const img = canvas.createImage()
        img.onload = () => {
          const { ox, oy, dw } = this.disp
          const sel = this.data.sel
          const scale = this.imgW / dw
          let sx = (sel.x - ox) * scale
          let sy = (sel.y - oy) * scale
          let sw = sel.w * scale
          let sh = sel.h * scale
          sx = Math.max(0, Math.min(sx, this.imgW - 1))
          sy = Math.max(0, Math.min(sy, this.imgH - 1))
          sw = Math.min(sw, this.imgW - sx)
          sh = Math.min(sh, this.imgH - sy)
          const outScale = Math.min(1, 1280 / Math.max(sw, sh))
          canvas.width = Math.max(1, Math.round(sw * outScale))
          canvas.height = Math.max(1, Math.round(sh * outScale))
          ctx.clearRect(0, 0, canvas.width, canvas.height)
          ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
          wx.canvasToTempFilePath({
            canvas,
            fileType: 'jpg',
            quality: 0.9,
            success: (r) => {
              wx.hideLoading()
              const app = getApp()
              app.globalData.cropResult = { slot: this.slot, path: r.tempFilePath }
              wx.navigateBack()
            },
            fail: () => {
              wx.hideLoading()
              wx.showToast({ title: '导出失败', icon: 'none' })
            }
          })
        }
        img.onerror = () => {
          wx.hideLoading()
          wx.showToast({ title: '图片加载失败', icon: 'none' })
        }
        img.src = this.data.path
      })
  }
})