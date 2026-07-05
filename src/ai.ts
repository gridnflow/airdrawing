import OpenAI from 'openai'

const KEY_STORAGE = 'openai-api-key'
const MODEL = 'gpt-4o-mini'

export function hasApiKey(): boolean {
  return !!localStorage.getItem(KEY_STORAGE)
}

export function clearApiKey(): void {
  localStorage.removeItem(KEY_STORAGE)
}

/** 저장된 키를 반환하고, 없으면 사용자에게 물어봐서 저장 */
function getApiKey(): string | null {
  let key = localStorage.getItem(KEY_STORAGE)
  if (!key) {
    key = prompt(
      'OpenAI API 키를 입력하세요 (sk-...).\n브라우저 localStorage에만 저장됩니다.',
    )
    if (key) localStorage.setItem(KEY_STORAGE, key.trim())
  }
  return key
}

const PROMPT = `이 이미지는 사용자가 웹캠 앞에서 검지손가락으로 허공에 그린 그림입니다. 선이 거칠고 손떨림이 있을 수 있습니다.

1. 무엇을 그린 것인지 가장 유력한 추측 1개를 먼저 말하세요.
2. 다른 가능성이 있다면 1~2개 짧게 덧붙이세요.
3. 글자나 숫자로 보이면 그대로 읽어주세요.

한국어로 3문장 이내로 답하세요.`

/** 그림 PNG(dataURL)를 보내 무엇을 그렸는지 추측. 실패 시 throw. */
export async function recognizeDrawing(pngDataUrl: string): Promise<string> {
  const apiKey = getApiKey()
  if (!apiKey) throw new Error('API 키가 없습니다.')

  const client = new OpenAI({ apiKey, dangerouslyAllowBrowser: true })

  try {
    const response = await client.chat.completions.create({
      model: MODEL,
      max_tokens: 300,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: PROMPT },
            { type: 'image_url', image_url: { url: pngDataUrl } },
          ],
        },
      ],
    })
    return response.choices[0]?.message?.content ?? '(응답 없음)'
  } catch (err) {
    if (err instanceof OpenAI.AuthenticationError) {
      clearApiKey()
      throw new Error('API 키가 유효하지 않습니다. 다시 시도하면 키를 새로 입력할 수 있습니다.')
    }
    if (err instanceof OpenAI.RateLimitError) {
      throw new Error('요청 한도를 초과했습니다. 잠시 후 다시 시도하세요.')
    }
    throw err
  }
}
