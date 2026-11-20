const assert = require('assert')
const path = require('path')
const fs = require('fs')
const { PALETTE, analyzeResponse, extractJSON, sanitizeBbox } = require('../utils/analyzer.js')

let passed = 0
let failed = 0

function test (name, fn) {
  try {
    fn()
    passed++
    console.log(`  ✓ ${name}`)
  } catch (e) {
    failed++
    console.error(`  ✗ ${name}\n    ${e.message}`)
  }
}

console.log('== extractJSON ==')
test('直接解析纯 JSON', () => {
  const r = extractJSON('{"a":1}')
  assert.deepStrictEqual(r, { a: 1 })
})
test('剥离 markdown 代码块', () => {
  const r = extractJSON('```json\n{"a":1}\n```')
  assert.deepStrictEqual(r, { a: 1 })
})
test('从混合文本中提取', () => {
  const r = extractJSON('好的，结果如下：\n{"groups":[]} 以上。')
  assert.deepStrictEqual(r, { groups: [] })
})
test('非法输入返回 null', () => {
  assert.strictEqual(extractJSON('not json at all'), null)
  assert.strictEqual(extractJSON(''), null)
  assert.strictEqual(extractJSON(null), null)
})

console.log('== sanitizeBbox ==')
test('正常 bbox 原样通过', () => {
  assert.deepStrictEqual(sanitizeBbox([100, 200, 300, 400]), [100, 200, 300, 400])
})
test('越界裁剪到 0-1000', () => {
  assert.deepStrictEqual(sanitizeBbox([-50, -10, 2000, 900]), [0, 0, 1000, 900])
})
test('坐标翻转自动纠正', () => {
  assert.deepStrictEqual(sanitizeBbox([300, 400, 100, 200]), [100, 200, 300, 400])
})
test('非法输入返回 null', () => {
  assert.strictEqual(sanitizeBbox(null), null)
  assert.strictEqual(sanitizeBbox([1, 2, 3]), null)
  assert.strictEqual(sanitizeBbox(['a', 'b', 'c', 'd']), null)
})
test('过小框返回 null', () => {
  assert.strictEqual(sanitizeBbox([10, 10, 11, 11]), null)
})

console.log('== analyzeResponse ==')
const goodRaw = JSON.stringify({
  groups: [
    {
      relation: 'synonym',
      words: ['happy', 'glad'],
      items: [
        { image: 1, text: 'happy', bbox: [244, 100, 412, 192] },
        { image: 2, text: 'glad', bbox: [156, 100, 269, 192] }
      ]
    },
    {
      relation: 'identical',
      words: ['fast', 'quickly'],
      items: [
        { image: 1, text: 'fast', bbox: [269, 308, 381, 400] },
        { image: 2, text: 'quickly', bbox: [256, 308, 431, 400] }
      ]
    }
  ]
})

test('正常解析并分配颜色', () => {
  const r = analyzeResponse(goodRaw)
  assert.strictEqual(r.groups.length, 2)
  assert.strictEqual(r.groups[0].color, PALETTE[0])
  assert.strictEqual(r.groups[1].color, PALETTE[1])
  assert.strictEqual(r.groups[0].index, 1)
  assert.strictEqual(r.groups[0].items.length, 2)
})

test('剔除缺少图1或图2的组', () => {
  const raw = JSON.stringify({
    groups: [
      {
        relation: 'synonym',
        words: ['a', 'b'],
        items: [
          { image: 1, text: 'a', bbox: [10, 10, 100, 100] },
          { image: 1, text: 'b', bbox: [200, 10, 300, 100] }
        ]
      }
    ]
  })
  const r = analyzeResponse(raw)
  assert.strictEqual(r.groups.length, 0)
})

test('剔除 bbox 非法的条目', () => {
  const raw = JSON.stringify({
    groups: [
      {
        relation: 'synonym',
        words: ['a', 'b'],
        items: [
          { image: 1, text: 'a', bbox: null },
          { image: 2, text: 'b', bbox: [10, 10, 100, 100] }
        ]
      }
    ]
  })
  const r = analyzeResponse(raw)
  assert.strictEqual(r.groups.length, 0)
})

test('重复组去重（忽略大小写）', () => {
  const raw = JSON.stringify({
    groups: [
      {
        relation: 'synonym',
        words: ['Happy', 'Glad'],
        items: [
          { image: 1, text: 'happy', bbox: [10, 10, 100, 100] },
          { image: 2, text: 'glad', bbox: [10, 10, 100, 100] }
        ]
      },
      {
        relation: 'synonym',
        words: ['glad', 'happy'],
        items: [
          { image: 1, text: 'happy', bbox: [20, 20, 120, 120] },
          { image: 2, text: 'glad', bbox: [20, 20, 120, 120] }
        ]
      }
    ]
  })
  const r = analyzeResponse(raw)
  assert.strictEqual(r.groups.length, 1)
})

test('空 groups 返回空结果', () => {
  const r = analyzeResponse('{"groups":[]}')
  assert.strictEqual(r.groups.length, 0)
})

test('非 JSON 输入抛错', () => {
  assert.throws(() => analyzeResponse('模型返回了纯文本'), /无法解析/)
})

test('words 缺失时从 items 推断', () => {
  const raw = JSON.stringify({
    groups: [
      {
        relation: 'synonym',
        items: [
          { image: 1, text: 'Big', bbox: [10, 10, 100, 100] },
          { image: 2, text: 'Large', bbox: [10, 10, 100, 100] }
        ]
      }
    ]
  })
  const r = analyzeResponse(raw)
  assert.strictEqual(r.groups.length, 1)
  assert.ok(r.groups[0].words.includes('big') || r.groups[0].words.includes('Big'))
  assert.ok(r.groups[0].words.includes('large') || r.groups[0].words.includes('Large'))
})

test('过滤纯虚词组（The <-> A）', () => {
  const raw = JSON.stringify({
    groups: [
      {
        relation: 'synonym',
        words: ['The', 'A'],
        items: [
          { image: 1, text: 'The', bbox: [10, 10, 100, 100] },
          { image: 2, text: 'A', bbox: [10, 10, 100, 100] }
        ]
      },
      {
        relation: 'synonym',
        words: ['happy', 'glad'],
        items: [
          { image: 1, text: 'happy', bbox: [10, 10, 100, 100] },
          { image: 2, text: 'glad', bbox: [10, 10, 100, 100] }
        ]
      }
    ]
  })
  const r = analyzeResponse(raw)
  assert.strictEqual(r.groups.length, 1)
  assert.strictEqual(r.groups[0].words[0], 'happy')
})

test('颜色超过调色板长度时循环', () => {
  const groups = []
  for (let i = 0; i < PALETTE.length + 3; i++) {
    groups.push({
      relation: 'synonym',
      words: ['w' + i, 'x' + i],
      items: [
        { image: 1, text: 'w' + i, bbox: [10, 10, 100, 100] },
        { image: 2, text: 'x' + i, bbox: [10, 10, 100, 100] }
      ]
    })
  }
  const r = analyzeResponse(JSON.stringify({ groups }))
  assert.strictEqual(r.groups.length, PALETTE.length + 3)
  assert.strictEqual(r.groups[PALETTE.length].color, PALETTE[0])
})

console.log(`\n结果: ${passed} 通过, ${failed} 失败`)
process.exit(failed > 0 ? 1 : 0)