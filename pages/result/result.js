const { relationLabel } = require('../../utils/analyzer.js')

Page({
  data: {
    img1: '',
    img2: '',
    groups: [],
    relationLabelMap: { identical: '相同', synonym: '同义' },
    canvasReady: false
  },

  onLoad () {
    const app = getApp()
    const d = app.globalData.resultData
    if (!d || !d.groups) {
      wx.showToast({ title: '无结果数据', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 800)
      return
    }
    this.resultData = d
    this.setData({
      img1: d.img1,
      img2: d.img2,
      groups: d.groups
    })
  },

  onReady () {
    if (!this.resultData) return
    wx.createSelectorQuery()
      .select('#canvas1').fields({ node: true, size: true })
      .select('#canvas2').fields({ node: true, size: true })
      .exec((res) => {
        if (!res || !res[0] || !res[1]) return
        this.canvasInfo = res
        this.drawAll()
      })
  },

  loadImage (src) {
    return new Promise((resolve, reject) => {
      const img = this.canvasInfo[0].node.createImage()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('图片加载失败'))
      img.src = src
    })
  },

  async drawAnnotated (canvasIdx, imageEl, imgSize) {
    const info = this.canvasInfo[canvasIdx]
    const canvas = info.node
    const ctx = canvas.getContext('2d')
    const dpr = wx.getSystemInfoSync().pixelRatio || 2
    canvas.width = info.width * dpr
    canvas.height = info.height * dpr
    ctx.scale(dpr, dpr)

    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, info.width, info.height)

    const scale = Math.min(info.width / imgSize.width, info.height / imgSize.height)
    const dw = imgSize.width * scale
    const dh = imgSize.height * scale
    const ox = (info.width - dw) / 2
    const oy = (info.height - dh) / 2
    ctx.drawImage(imageEl, ox, oy, dw, dh)

    this.resultData.groups.forEach((g) => {
      g.items.forEach((it) => {
        if (it.image !== canvasIdx + 1) return
        const x1 = ox + (it.bbox[0] / 1000) * dw
        const y1 = oy + (it.bbox[1] / 1000) * dh
        const x2 = ox + (it.bbox[2] / 1000) * dw
        const y2 = oy + (it.bbox[3] / 1000) * dh

        const thickness = Math.max(3, (y2 - y1) * 0.08)
        ctx.strokeStyle = g.color
        ctx.lineWidth = thickness
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.moveTo(x1, y2 + thickness)
        ctx.lineTo(x2, y2 + thickness)
        ctx.stroke()

        const r = thickness * 0.8
        ctx.fillStyle = g.color
        ctx.beginPath()
        ctx.arc(x2 + r, y2 + thickness, r, 0, Math.PI * 2)
        ctx.fill()
      })
    })
  },

  async drawAll () {
    try {
      const [imgA, imgB] = await Promise.all([
        this.loadImage(this.resultData.img1),
        this.loadImage(this.resultData.img2)
      ])
      await this.drawAnnotated(0, imgA, this.resultData.img1Size)
      await this.drawAnnotated(1, imgB, this.resultData.img2Size)
      this.setData({ canvasReady: true })
    } catch (e) {
      console.error(e)
      wx.showToast({ title: '标注绘制失败', icon: 'none' })
    }
  },

  saveResult () {
    if (!this.canvasInfo) return
    const save = (idx) => new Promise((resolve, reject) => {
      const canvas = this.canvasInfo[idx].node
      wx.canvasToTempFilePath({
        canvas,
        success: (r) => resolve(r.tempFilePath),
        fail: (e) => reject(new Error(e.errMsg || '导出失败'))
      })
    })
    Promise.all([save(0), save(1)])
      .then((paths) => {
        let done = 0
        return Promise.all(paths.map((p) => new Promise((resolve, reject) => {
          wx.saveImageToPhotosAlbum({
            filePath: p,
            success: resolve,
            fail: (e) => {
              if (e.errMsg && e.errMsg.includes('auth')) {
                wx.showModal({
                  title: '需要相册权限',
                  content: '请在设置中允许保存图片到相册',
                  confirmText: '去设置',
                  success: (r) => { if (r.confirm) wx.openSetting() }
                })
              }
              reject(new Error(e.errMsg || '保存失败'))
            }
          })
        })))
      })
      .then(() => wx.showToast({ title: '两张图片已保存', icon: 'success' }))
      .catch((e) => {
        if (e && e.message && !e.message.includes('auth')) {
          wx.showToast({ title: '保存失败', icon: 'none' })
        }
      })
  },

  backHome () {
    wx.navigateBack()
  }
})