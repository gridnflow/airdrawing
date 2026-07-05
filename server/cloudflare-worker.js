/**
 * AI 인식용 서버 프록시 — Cloudflare Worker
 *
 * OpenAI API 키를 클라이언트에 노출하지 않기 위한 최소 프록시.
 * 배포 방법은 server/README.md 참고.
 *
 * 요청:  POST { image: "data:image/png;base64,...", mode: "describe" | "judge" }
 * 응답:  { text: string }
 */

const MODEL = 'gpt-4o-mini'
const MAX_IMAGE_BYTES = 1_400_000 // base64 기준 ≈ 1MB 원본
const RATE_LIMIT = 5 // IP당 분당 요청 수
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
}

const PROMPTS = {
  describe: `이 이미지는 사용자가 웹캠 앞에서 검지손가락으로 허공에 그린 그림입니다. 선이 거칠고 손떨림이 있을 수 있습니다.

1. 무엇을 그린 것인지 가장 유력한 추측 1개를 먼저 말하세요.
2. 다른 가능성이 있다면 1~2개 짧게 덧붙이세요.
3. 글자나 숫자로 보이면 그대로 읽어주세요.

한국어로 3문장 이내로 답하세요.`,
  judge: `이 이미지는 사용자가 웹캠 앞에서 손가락으로 허공에 그린 그림입니다. 선이 거칠고 손떨림이 있을 수 있습니다.
무엇을 그린 것인지 한국어 명사 한 단어로 추측하세요.
반드시 {"guess": "단어"} 형태의 JSON으로만 답하세요.`,
}

// isolate 단위 인메모리 레이트리밋. 엄밀하진 않지만(isolate별 독립) 남용 방지엔 충분.
// 더 정확히 하려면 Durable Objects나 KV 사용.
const hits = new Map()

function rateLimited(ip) {
  const now = Date.now()
  const windowStart = now - 60_000
  const list = (hits.get(ip) ?? []).filter((t) => t > windowStart)
  if (list.length >= RATE_LIMIT) return true
  list.push(now)
  hits.set(ip, list)
  return false
}

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...CORS },
  })
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS })
    if (request.method !== 'POST') return json(405, { error: 'method not allowed' })

    const ip = request.headers.get('cf-connecting-ip') ?? 'unknown'
    if (rateLimited(ip)) return json(429, { error: 'rate limited' })

    let body
    try {
      body = await request.json()
    } catch {
      return json(400, { error: 'invalid json' })
    }

    const { image, mode } = body
    const prompt = PROMPTS[mode]
    if (!prompt) return json(400, { error: 'invalid mode' })
    if (
      typeof image !== 'string' ||
      !image.startsWith('data:image/png;base64,') ||
      image.length > MAX_IMAGE_BYTES
    ) {
      return json(400, { error: 'invalid image' })
    }

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.OPENAI_API_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 300,
        ...(mode === 'judge' ? { response_format: { type: 'json_object' } } : {}),
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: image } },
            ],
          },
        ],
      }),
    })

    if (!openaiRes.ok) return json(502, { error: 'upstream error' })
    const data = await openaiRes.json()
    return json(200, { text: data.choices?.[0]?.message?.content ?? '' })
  },
}
