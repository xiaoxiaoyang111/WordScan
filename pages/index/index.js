const { callDeepSeek, fileToBase64 } = require('../../utils/api.js')
const { analyzeResponse } = require('../../utils/analyzer.js')

Page({
  data: {
    img1: '',
    img2: '',
    apiKey: '',
    hasSavedKey: false,
    loading: false,
    loadingText: ''
  },

  onLoad () {
    const apiKey = wx.getStorageSync('ds_api_key') || ''
    this.setData({ apiKey, hasSavedKey: !!apiKey })
  },

  onShow () {
    const app = getApp()
    if (app.globalData.cropResult) {
      const crop = app.globalData.cropResult
      app.globalData.cropResult = null
      this.setData(crop.slot === '1' ? { img1: crop.path } : { img2: crop.path })
    }
  },

  onKeyInput (e) {
    this.setData({ apiKey: e.detail.value, hasSavedKey: false })
  },

  saveKey () {
    const key = this.data.apiKey.trim()
    if (!key.startsWith('sk-')) {
      wx.showToast({ title: 'Key 应以 sk- 开头', icon: 'none' })
      return
    }
    wx.setStorageSync('ds_api_key', key)
    this.setData({ hasSavedKey: true })
    wx.showToast({ title: '已保存', icon: 'success' })
  },

  clearKey () {
    wx.removeStorageSync('ds_api_key')
    this.setData({ apiKey: '', hasSavedKey: false })
    wx.showToast({ title: '已清除', icon: 'none' })
  },

  chooseImage (e) {
    const slot = e.currentTarget.dataset.slot
    if (this.data.loading) return
    wx.showActionSheet({
      itemList: ['拍照', '从相册选择'],
      success: (res) => {
        const source = res.tapIndex === 0 ? 'camera' : 'album'
        wx.chooseMedia({
          count: 1,
          mediaType: ['image'],
          sourceType: [source],
          sizeType: ['compressed'],
          success: (r) => {
            const path = r.tempFiles[0].tempFilePath
            const app = getApp()
            app.globalData.cropTemp = { slot, path }
            wx.navigateTo({ url: '/pages/crop/crop' })
          }
        })
      }
    })
  },

  removeImage (e) {
    const slot = e.currentTarget.dataset.slot
    if (this.data.loading) return
    this.setData(slot === '1' ? { img1: '' } : { img2: '' })
  },

  getFileInfo (path) {
    return new Promise((resolve, reject) => {
      wx.getImageInfo({
        src: path,
        success: (res) => resolve(res),
        fail: () => reject(new Error('读取图片信息失败'))
      })
    })
  },

  async startCompare () {
    const { img1, img2, apiKey } = this.data
    if (!img1 || !img2) {
      wx.showToast({ title: '请先提供两张图片', icon: 'none' })
      return
    }
    const key = apiKey.trim()
    if (!key) {
      wx.showToast({ title: '请先填写 DeepSeek API Key', icon: 'none' })
      return
    }
    if (!key.startsWith('sk-')) {
      wx.showToast({ title: 'Key 应以 sk- 开头', icon: 'none' })
      return
    }

    this.setData({ loading: true, loadingText: '正在读取图片…' })
    try {
      const [info1, info2, b64a, b64b] = await Promise.all([
        this.getFileInfo(img1),
        this.getFileInfo(img2),
        fileToBase64(img1),
        fileToBase64(img2)
      ])

      this.setData({ loadingText: 'AI 正在分析两张图片…' })
      const raw = await callDeepSeek(key, [b64a, b64b])
      this.setData({ loadingText: '正在生成标注…' })
      const result = analyzeResponse(raw)

      const app = getApp()
      app.globalData.resultData = {
        img1,
        img2,
        img1Size: { width: info1.width, height: info1.height },
        img2Size: { width: info2.width, height: info2.height },
        groups: result.groups
      }
      wx.navigateTo({ url: '/pages/result/result' })
    } catch (err) {
      console.error(err)
      let msg = err.message || '未知错误，请重试'
      if (msg.indexOf('url not in domain list') >= 0) {
        msg = '请求被域名校验拦截：请点击小程序右上角「···」→ 打开「开发调试」并允许，重启后重试；开发者工具中请勾选「详情 → 本地设置 → 不校验合法域名」'
      } else if (msg.indexOf('timeout') >= 0) {
        msg = '请求超时：请检查网络后重试（AI 分析两张图约需 10-60 秒）'
      } else if (msg.indexOf('401') >= 0 || msg.indexOf('Authentication') >= 0) {
        msg = 'API Key 无效或已过期，请检查后重新填写'
      }
      wx.showModal({
        title: '分析失败',
        content: msg,
        showCancel: false
      })
    } finally {
      this.setData({ loading: false, loadingText: '' })
    }
  }
})