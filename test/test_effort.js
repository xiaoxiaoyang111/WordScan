const fs = require('fs')
const https = require('https')

const API_KEY = process.env.DS_API_KEY
if (!API_KEY) { console.error('缺少 DS_API_KEY'); process.exit(1) }

const { SYSTEM_PROMPT } = require('../utils/api.js')
const { analyzeResponse } = require('../utils/analyzer.js')
const b64 = (p) => `data:image/jpeg;base64,${fs.readFileSync(p).toString('base64')}`

function callAPI (payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload)
    const req = https.request({
      hostname: 'api.deepseek.com', path: '/chat/completions', method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}`, 'Content-Length': Buffer.byteLength(body) },
      timeout: 180000
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
    req.write(body); req.end()
  })
}

async function run (label, extra) {
  const t0 = Date.now()
  const res = await callAPI({
    model: 'deepseek-flash',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: [
        { type: 'text', text: '这是第一张图片（图片1）：' },
        { type: 'image_url', image_url: { url: b64('test/img1.jpg') } },
        { type: 'text', text: '这是第二张图片（图片2）：' },
        { type: 'image_url', image_url: { url: b64('test/img2.jpg') } },
        { type: 'text', text: '请分析两张图片中相同或同义的单词，按系统要求的 JSON 格式返回。' }
      ] }
    ],
    response_format: { type: 'json_object' },
    temperature: 0,
    max_tokens: 16384,
    ...extra
  })
  const ms = ((Date.now() - t0) / 1000).toFixed(1)
  const rt = res.usage.completion_tokens_details ? res.usage.completion_tokens_details.reasoning_tokens : '?'
  let groups = []
  try { groups = analyzeResponse(res.choices[0].message.content).groups } catch (e) {}
  const pairs = groups.map((g) => g.words.join('/')).join(', ')
  console.log(`[${label}] ${ms}s | 总输出=${res.usage.completion_tokens} | 思考=${rt} | ${groups.length}组: ${pairs}`)
  return { ms: Date.now() - t0, groups }
}

(async () => {
  try {
    await run('默认high(基线)', {})
  } catch (e) { console.log('high 失败:', e.message.slice(0, 120)) }
  for (const p of [{ reasoning_effort: 'low' }, { effort: 'low' }]) {
    try {
      await run('low档 ' + JSON.stringify(p), p)
    } catch (e) { console.log('low 失败 (' + JSON.stringify(p) + '):', e.message.slice(0, 120)) }
  }
})()