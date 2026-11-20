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
- 忽略虚词：冠词（a/an/the）、介词（of/in/on/at/to/for/with 等）、连词（and/or/but 等）、代词（it/this/that 等）、be 动词（is/are/was/were 等），这些不参与配对
- 只配对有实际意义的词：名词、动词、形容词、副词等实义词
- items 中必须至少包含一个 image=1 和一个 image=2 的词条
- 同一个单词在图中出现多次时，每个位置单独一条
- 如果没有任何配对，返回 {"groups": []}`

const API_URL = 'https://api.deepseek.com/chat/completions'

function fileToBase64 (filePath) {
  return new Promise((resolve, reject) => {
    wx.getFileSystemManager().readFile({
      filePath,
      encoding: 'base64',
      success: (res) => resolve('data:image/jpeg;base64,' + res.data),
      fail: (err) => reject(new Error('读取图片失败: ' + (err.errMsg || '')))
    })
  })
}

function callDeepSeek (apiKey, imageBase64List) {
  return new Promise((resolve, reject) => {
    const content = []
    imageBase64List.forEach((b64, i) => {
      content.push({ type: 'text', text: `这是第${i + 1}张图片（图片${i + 1}）：` })
      content.push({ type: 'image_url', image_url: { url: b64 } })
    })
    content.push({ type: 'text', text: '请分析两张图片中相同或同义的单词，按系统要求的 JSON 格式返回。' })

    wx.request({
      url: API_URL,
      method: 'POST',
      timeout: 180000,
      header: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + apiKey
      },
      data: {
        model: 'deepseek-flash',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content }
        ],
        response_format: { type: 'json_object' },
        temperature: 0,
        effort: 'low',
        max_tokens: 16384
      },
      success: (res) => {
        if (res.statusCode !== 200) {
          const msg = (res.data && res.data.error && res.data.error.message) || ('HTTP ' + res.statusCode)
          reject(new Error('API 错误: ' + msg))
          return
        }
        const choice = res.data.choices && res.data.choices[0]
        const message = choice && choice.message
        let content = message && message.content
        if (!content && message && message.reasoning_content) {
          content = message.reasoning_content
        }
        if (!content) {
          const fr = choice ? choice.finish_reason : 'unknown'
          let hint = 'API 返回内容为空（finish_reason: ' + fr + '），请重试'
          if (fr === 'length') {
            hint = 'AI 输出被 max_tokens 截断，请换单词更少的图片或重试'
          }
          reject(new Error(hint))
          return
        }
        resolve(content)
      },
      fail: (err) => reject(new Error('网络请求失败: ' + (err.errMsg || '')))
    })
  })
}

module.exports = { SYSTEM_PROMPT, fileToBase64, callDeepSeek }