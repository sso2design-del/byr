import type { ReactElement } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Login from './pages/Login'
import AuthCallback from './pages/AuthCallback'
import AgentList from './pages/AgentList'
import AgentDetail from './pages/AgentDetail'
import Marketplace from './pages/Marketplace'
import Billing from './pages/Billing'
import Settings from './pages/Settings'
import UserGuide from './pages/UserGuide'
import Blog from './pages/Blog'
import BlogPost from './pages/BlogPost'
import Contact from './pages/Contact'
import TeamAgentList from './pages/TeamAgentList'
import TeamAgentDetail from './pages/TeamAgentDetail'
import Knowledge from './pages/Knowledge'
import Approvals from './pages/Approvals'
import WritePreview from './pages/WritePreview'
import Overview from './pages/Overview'
import { isAuthenticated, signIn } from './lib/auth'
import { RoleProvider } from './contexts/RoleContext'

// 경력기술서·포트폴리오 링크용 진입점 — 로그인 없이 데모 계정으로 바로 개요를 연다
function DemoEntry() {
  signIn({ provider: 'email', id: 'demo-soyi', name: '황소이 선임', email: 'soyi.hwang@company.com' })
  return <Navigate to="/overview" replace />
}

function ProtectedRoute({ children }: { children: ReactElement }) {
  return isAuthenticated() ? children : <Navigate to="/login" replace />
}


export default function App() {
  return (
    <RoleProvider>
    <BrowserRouter>

      <Routes>
        {/* 온보딩 — 레이아웃 없이 단독 렌더 */}
        <Route index element={<Navigate to={isAuthenticated() ? '/overview' : '/login'} replace />} />
        {/* 로그인 화면은 로그인 상태와 무관하게 항상 보여준다(포트폴리오 QR 진입점) */}
        <Route path="/login" element={<Login />} />
        <Route path="/demo" element={<DemoEntry />} />
        {/* 네이버·카카오 로그인 콜백 착지 — 백엔드가 토큰·프로필 처리 후 여기로 보낸다 */}
        <Route path="/auth/callback" element={<AuthCallback />} />

        <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route path="/overview" element={<Overview />} />
          <Route path="/agents" element={<AgentList />} />
          <Route path="/agents/:id" element={<AgentDetail />} />
          <Route path="/teams" element={<TeamAgentList />} />
          <Route path="/teams/:id" element={<TeamAgentDetail />} />
          {/* 검토·승인 — 두 화면 모두 URL로 바로 접근 가능(캡처·공유용) */}
          <Route path="/approvals" element={<Approvals />} />
          <Route path="/approvals/preview" element={<WritePreview />} />
          <Route path="/knowledge" element={<Knowledge />} />
          <Route path="/marketplace" element={<Marketplace />} />
          <Route path="/billing" element={<Billing />} />
          <Route path="/settings" element={<Settings />} />
        </Route>

        {/* LNB 없이 단독 렌더 — 랜딩(byr-homepage)에서 넘어오는 공개 페이지 */}
        <Route path="/guide" element={<UserGuide />} />
        <Route path="/blog" element={<Blog />} />
        <Route path="/blog/:id" element={<BlogPost />} />
        <Route path="/contact" element={<Contact />} />
      </Routes>
    </BrowserRouter>
    </RoleProvider>
  )
}
