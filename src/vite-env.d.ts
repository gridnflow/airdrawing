/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 설정 시 OpenAI 직접 호출 대신 서버 프록시(server/ 참고)를 사용 */
  readonly VITE_API_PROXY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
