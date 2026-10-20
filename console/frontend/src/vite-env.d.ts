/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Unsplash Access Key — .env.local 에서 주입(커밋 금지) */
  readonly VITE_UNSPLASH_ACCESS_KEY?: string
  /** 랜딩(브랜드 사이트) 주소 — 배포 환경에서 주입 */
  readonly VITE_LANDING_URL?: string
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}
