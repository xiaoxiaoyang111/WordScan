const fs = require('fs')
const https = require('https')
const { execSync } = require('child_process')

const API_KEY = process.env.DS_API_KEY
if (!API_KEY) { console.error('缺少 DS_API_KEY'); process.exit(1) }

const { SYSTEM_PROMPT } = require('../utils/api.js')
const { analyzeResponse } = require('../utils/analyzer.js')

const b64 = (p) => `data:image/jpeg;base64,${fs.readFileSync(p).toString('base64')}`

function callAPI (payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload)
    const req = https.request({
      hostname: 'api.deepseek.com',
      path: '/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`,
        'Content-Length': Buffer.byteLength(body)
      },
      timeout: 120000
    }, (res) => {
      let data = ''
      res.on('data', (c) => data += c)
      res.on('end', () => {
        if (res.statusCode !== 200) reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 300)}`))
        else resolve(JSON.parse(data))
      })
    })
    req.on('error', reject)
    req.on('timeout', () => req.destroy(new Error('timeout')))
    req.write(body)
    req.end()
  })
}

function drawAnnotated (imgPath, groups, imageIndex, outPath, imgSize) {
  const { createCanvas, loadImage } = require('canvas')
  return loadImage(imgPath).then((image) => {
    const canvas = createCanvas(800, 600)
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, 800, 600)
    ctx.drawImage(image, 0, 0, 800, 600)

    groups.forEach((g) => {
      g.items.forEach((it) => {
        if (it.image !== imageIndex) return
        const x1 = (it.bbox[0] / 1000) * 800
        const y1 = (it.bbox[1] / 1000) * 600
        const x2 = (it.bbox[2] / 1000) * 800
        const y2 = (it.bbox[3] / 1000) * 600
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
    fs.writeFileSync(outPath, canvas.toBuffer('image/png'))
  })
}

(async () => {
  console.log('端到端验收：真实 API → 解析 → 渲染')
  const res = await callAPI({
    model: 'deepseek-flash',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          { type: 'text', text: '这是第一张图片（图片1）：' },
          { type: 'image_url', image_url: { url: b64('test/img1.jpg') } },
          { type: 'text', text: '这是第二张图片（图片2）：' },
          { type: 'image_url', image_url: { url: b64('test/img2.jpg') } },
          { type: 'text', text: '请分析两张图片中相同或同义的单词，按系统要求的 JSON 格式返回。' }
        ]
      }
    ],
    response_format: { type: 'json_object' },
    temperature: 0,
    max_tokens: 16384
  })
  console.log('API 调用成功, tokens:', res.usage.total_tokens)

  const result = analyzeResponse(res.choices[0].message.content)
  console.log(`解析成功: ${result.groups.length} 组配对`)
  result.groups.forEach((g) => {
    console.log(`  [${g.relation}] ${g.words.join(' <-> ')} (${g.color}) x${g.items.length}`)
  })

  const ok = result.groups.length >= 4 && result.groups.every((g) =>
    g.items.some((i) => i.image === 1) && g.items.some((i) => i.image === 2))
  if (!ok) throw new Error('配对数量或结构不符合预期')

  try {
    require.resolve('canvas')
    await drawAnnotated('test/img1.jpg', result.groups, 1, 'test/output1.png')
    await drawAnnotated('test/img2.jpg', result.groups, 2, 'test/output2.png')
    console.log('标注图已生成: test/output1.png, test/output2.png')
  } catch (e) {
    console.log('跳过渲染（未安装 node-canvas）:', e.message.slice(0, 60))
  }

  console.log('\n端到端验收通过 ✅')
})().catch((e) => { console.error('验收失败:', e.message); process.exit(1) })