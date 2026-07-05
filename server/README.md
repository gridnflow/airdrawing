# AI 인식 서버 프록시

기본 상태에서 앱은 사용자가 입력한 OpenAI 키를 localStorage에 두고 브라우저에서 직접 호출한다 — 개인용/데모용으로는 충분하지만, **불특정 다수에게 공개하는 서비스라면 키를 서버 뒤로 숨겨야 한다.** 이 디렉토리의 Cloudflare Worker가 그 프록시다.

## 배포 (Cloudflare 계정 필요)

```sh
npm install -g wrangler
wrangler login
cd server
wrangler deploy cloudflare-worker.js --name airdrawing-proxy
wrangler secret put OPENAI_API_KEY --name airdrawing-proxy   # 키 입력
```

## 클라이언트 연결

배포된 Worker URL을 빌드 환경변수로 지정하면 `src/ai.ts`가 자동으로 프록시 경유로 전환된다 (키 입력 UI 없이 동작):

```sh
VITE_API_PROXY=https://airdrawing-proxy.<계정>.workers.dev npm run build
```

GitHub Pages 배포에 적용하려면 `.github/workflows/deploy.yml`의 build step에 env로 추가:

```yaml
      - run: npm run build
        env:
          VITE_API_PROXY: ${{ vars.API_PROXY_URL }}
```

## 내장 보호 장치

- IP당 분당 5회 레이트리밋 (isolate 단위 인메모리 — 엄밀한 제한이 필요하면 Durable Objects/KV로 교체)
- 이미지 크기 제한 (~1MB), PNG dataURL 형식 검증
- 프롬프트는 서버에 고정 — 클라이언트가 임의 프롬프트로 남용 불가
