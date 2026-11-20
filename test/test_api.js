const fs = require('fs');
const https = require('https');

const API_KEY = process.env.DS_API_KEY;
if (!API_KEY) { console.error('缺少 DS_API_KEY'); process.exit(1); }

const b64 = (p) => `data:image/jpeg;base64,${fs.readFileSync(p).toString('base64')}`;

const SYSTEM_PROMPT = `你是图片文字分析与同义词配对专家。用户会提供两张包含英文文本的图片。
你的任务：
1. 识别每张图片中的所有英文单词
2. 找出两张图片之间"完全相同"或"互为同义词"的单词配对组
3. 返回每个单词的精确边界框

坐标系：归一化到 0-1000（相对于图片宽高），bbox 格式 [x1, y1, x2, y2]，其中 (x1,y1) 是单词左上角，(x2,y2) 是单词右下角。

严格返回以下 JSON 格式，不要输出任何其他内容：
{
  "groups": [
    {
      "relation": "identical | synonym",
      "words": ["单词1", "单词2"],
      "items": [
        { "image": 1, "text": "happy", "bbox": [x1, y1, x2, y2] },
        { "image": 2, "text": "glad", "bbox": [x1, y1, x2, y2] }
      ]
    }
  ]
}

规则：
- 只配对两张图片之间的单词，同一张图内部的重复不算
- "identical" 表示拼写完全相同（忽略大小写），"synonym" 表示同义
- items 中必须至少包含一个 image=1 和一个 image=2 的词条
- 同一个单词在图中出现多次时，每个位置单独一条
- 如果没有任何配对，返回 {"groups": []}`;

function callAPI(payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const req = https.request({
      hostname: 'api.deepseek.com',
      path: '/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Length': Buffer.byteLength(body)
      },
      timeout: 120000
    }, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 500)}`));
        } else {
          resolve(JSON.parse(data));
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(new Error('timeout')); });
    req.write(body);
    req.end();
  });
}

(async () => {
  const t0 = Date.now();
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
    max_tokens: 4096
  });
  const ms = Date.now() - t0;
  console.log(`耗时 ${ms}ms, 用量:`, JSON.stringify(res.usage));
  const content = res.choices[0].message.content;
  console.log('--- 原始返回 ---');
  console.log(content);
  console.log('--- 解析校验 ---');
  try {
    const j = JSON.parse(content);
    console.log(`配对组数: ${j.groups.length}`);
    for (const g of j.groups) {
      console.log(`[${g.relation}] ${g.words.join(' <-> ')} , items=${g.items.length}`);
      for (const it of g.items) {
        console.log(`   img${it.image} "${it.text}" bbox=[${it.bbox.join(',')}]`);
      }
    }
  } catch (e) {
    console.error('JSON 解析失败:', e.message);
  }
})().catch(e => { console.error('API 错误:', e.message); process.exit(1); });