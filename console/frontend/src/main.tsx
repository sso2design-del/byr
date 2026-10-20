import React from 'react'
import ReactDOM from 'react-dom/client'
import '@astryxdesign/core/reset.css'
import '@astryxdesign/core/astryx.css'
import '@astryxdesign/theme-neutral/theme.css'
import { Theme } from '@astryxdesign/core/theme'
import { neutralTheme } from './themes/neutral/neutralTheme'
import App from './App'
import './mobile.css'

const style = document.createElement('style')
style.textContent = [
  /* ── Pill 모서리: Button / Input / Selector 전체 적용 ──────────────────────
   *
   * Astryx StyleX는 :not(#\#) 반복으로 specificity를 높여 일반 CSS 오버라이드를 막는다.
   * 각 규칙의 원본 specificity를 정확히 파악하고 1단계씩 높여 이긴다.
   *
   * [1] Button — x1jxw6zd: border-radius:var(--_button-radius,var(--radius-element))
   *     원본 2단계(:not×2) → 3단계로 이김
   */
  '.x1jxw6zd:not(#\\#):not(#\\#):not(#\\#){border-radius:9999px}',
  /*
   * [2] TextInput / TextArea / NumberInput / DateInput / Typeahead 등
   *     모든 필드 wrapper — x1832zxr: --_field-radius:var(--radius-element)
   *     원본 1단계(class만) → 2단계로 이김 → xvdfih8이 읽는 --_field-radius가 9999px로 바뀜
   */
  '.x1832zxr:not(#\\#){--_field-radius:9999px}',
  /* [2-1] 도입 상담(/contact) 여러 줄 입력란만 8px — 위 [2] 보다 클래스 1단계 높여 이김.
   *      알약 모양이면 여러 줄 입력란은 모서리 쪽 글자가 잘린다 */
  '.contact-request .x1832zxr:not(#\\#){--_field-radius:8px}',
  /*
   * [3] Selector 트리거 — inputWrapperStyles.base.kaIpWk(xvdfih8)를
   *     xh6dtrn으로 교체: border-radius:var(--radius-element)
   *     원본 2단계(:not×2) → 3단계로 이김
   */
  '.xh6dtrn:not(#\\#):not(#\\#):not(#\\#){border-radius:9999px}',
  /* ── CTA 버튼 기본 사이즈: primary / destructive → lg (36px) ─────────────
   *
   * size 미지정(md, x1ueg155: height:32px) 버튼 중 primary·destructive variant만
   * lg(xssyfek: height:36px)로 자동 업그레이드한다.
   * 원본 4단계(:not×4) → 5단계로 이김.
   * size="sm" 명시 시 x6k0iem 적용되어 이 규칙 영향 없음.
   *
   * primary  variant root class: x1ewilqj
   * destructive variant root class: x1pjz0fi
   */
  '.x1ewilqj.x1ueg155:not(#\\#):not(#\\#):not(#\\#):not(#\\#):not(#\\#){height:var(--size-element-lg)}',
  '.x1pjz0fi.x1ueg155:not(#\\#):not(#\\#):not(#\\#):not(#\\#):not(#\\#){height:var(--size-element-lg)}',
  /* ── 커스텀 시맨틱 토큰 ──────────────────────────────────────────────────────
   * --color-status-active: "활성/배치됨" 상태 도트·아이콘색.
   *   light = Tailwind green-600 #16a34a  /  dark = green T70 파스텔 #84c980
   * Astryx TokenName에 없으므로 [data-astryx-theme] 컨테이너에 직접 정의.
   * color-scheme 전환(system/dark/light)에 모두 대응.
   */
  '[data-astryx-theme]{--color-status-active:#16a34a}',
  '@media(prefers-color-scheme:dark){[data-astryx-theme]{--color-status-active:#84c980}}',
  '[data-astryx-theme][data-theme="dark"]{--color-status-active:#84c980}',
  '[data-astryx-theme][data-theme="light"]{--color-status-active:#16a34a}',
  /* ── 기본 글꼴 ── body 에 글꼴이 없어 포털로 body 에 붙는 팝업(에이전트 만들기 등)이
   * 브라우저 기본 명조(Times)로 나왔다. 테마와 같은 글꼴 + 한글 고딕 대체 글꼴을 body 에 준다. */
  'body{font-family:Figtree,-apple-system,"system-ui","Segoe UI",Roboto,Helvetica,Arial,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif}',
  /* ── 코드 블록 ── 알약 반경(9999px)이 걸려 코드 상자가 과하게 둥글었다 → 각진 8px.
   * 인라인·클래스 반경을 모두 이기도록 :not(#\#) 로 단계를 올린다 */
  '.astryx-codeblock:not(#\\#):not(#\\#):not(#\\#):not(#\\#):not(#\\#){border-radius:8px}',
  /* ── 레이아웃 보정 ────────────────────────────────────────────────────────── */
  /* SideNav 접힘 너비 64px */
  '.xhgvbfk:not(#\\#):not(#\\#):not(#\\#):not(#\\#):not(#\\#){width:64px}',
  /* 라인형 TabList 탭 호버 배경 제거 */
  '.x1u3b27q:hover .x1a1zr74:not(#\\#):not(#\\#):not(#\\#):not(#\\#){background-color:transparent}',
].join('')
document.head.appendChild(style)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Theme theme={neutralTheme}>
      <App />
    </Theme>
  </React.StrictMode>
)
