const PALETTE = [
  '#EF4444',
  '#3B82F6',
  '#10B981',
  '#F59E0B',
  '#8B5CF6',
  '#EC4899',
  '#06B6D4',
  '#84CC16',
  '#F97316',
  '#14B8A6'
]

const STOPWORDS = new Set([
  'a', 'an', 'the',
  'of', 'in', 'on', 'at', 'to', 'for', 'with', 'by', 'from', 'about', 'into', 'over', 'under',
  'and', 'or', 'but', 'so', 'yet', 'nor',
  'it', 'its', 'this', 'that', 'these', 'those',
  'i', 'you', 'he', 'she', 'we', 'they', 'me', 'him', 'her', 'us', 'them',
  'my', 'your', 'his', 'our', 'their',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'am',
  'will', 'would', 'shall', 'should', 'may', 'might', 'must', 'can', 'could',
  'do', 'does', 'did', 'have', 'has', 'had',
  'not', 'no', 'as', 'if', 'then', 'than', 'there', 'here', 'what', 'which', 'who', 'when', 'where', 'how'
])

function clamp (v, min, max) {
  return Math.min(max, Math.max(min, v))
}

function sanitizeBbox (bbox) {
  if (!Array.isArray(bbox) || bbox.length !== 4) return null
  const nums = bbox.map((n) => Number(n))
  if (nums.some((n) => !isFinite(n))) return null
  let [x1, y1, x2, y2] = nums
  if (x1 > x2) { const t = x1; x1 = x2; x2 = t }
  if (y1 > y2) { const t = y1; y1 = y2; y2 = t }
  x1 = clamp(x1, 0, 1000); x2 = clamp(x2, 0, 1000)
  y1 = clamp(y1, 0, 1000); y2 = clamp(y2, 0, 1000)
  if (x2 - x1 < 2 || y2 - y1 < 2) return null
  return [x1, y1, x2, y2]
}

function extractJSON (raw) {
  if (typeof raw !== 'string') return null
  const text = raw.trim().replace(/^```(json)?/i, '').replace(/```$/, '').trim()
  try {
    return JSON.parse(text)
  } catch (e) {}
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(text.slice(start, end + 1))
    } catch (e) {}
  }
  return null
}

function analyzeResponse (raw) {
  const parsed = extractJSON(raw)
  if (!parsed || !Array.isArray(parsed.groups)) {
    throw new Error('无法解析模型返回的 JSON')
  }
  const validGroups = []
  const seen = new Set()

  parsed.groups.forEach((g) => {
    if (!g || !Array.isArray(g.items)) return
    const items = []
    g.items.forEach((it) => {
      if (!it || (it.image !== 1 && it.image !== 2)) return
      const bbox = sanitizeBbox(it.bbox)
      if (!bbox) return
      const text = String(it.text || '').trim().slice(0, 50)
      if (!text) return
      items.push({ image: it.image, text, bbox })
    })
    const hasImg1 = items.some((i) => i.image === 1)
    const hasImg2 = items.some((i) => i.image === 2)
    if (!hasImg1 || !hasImg2 || items.length < 2) return

    const words = Array.isArray(g.words)
      ? g.words.map((w) => String(w || '').trim()).filter(Boolean).slice(0, 5)
      : [...new Set(items.map((i) => i.text.toLowerCase()))]
    if (words.length === 0) return
    if (words.every((w) => STOPWORDS.has(w.toLowerCase().replace(/[^a-z]/g, '')))) return

    const key = words.map((w) => w.toLowerCase()).sort().join('|')
    if (seen.has(key)) return
    seen.add(key)

    validGroups.push({
      relation: g.relation === 'identical' ? 'identical' : 'synonym',
      words,
      items
    })
  })

  validGroups.forEach((g, i) => {
    g.color = PALETTE[i % PALETTE.length]
    g.index = i + 1
  })

  return { groups: validGroups }
}

function relationLabel (relation) {
  return relation === 'identical' ? '相同' : '同义'
}

module.exports = { PALETTE, analyzeResponse, relationLabel, extractJSON, sanitizeBbox }