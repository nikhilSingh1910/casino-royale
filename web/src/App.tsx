import { Outlet, Route, Routes } from 'react-router-dom';
import { Header } from './components/Header';
import { Nav } from './components/Nav';
import { OpenBets } from './components/OpenBets';
import { Sidebar } from './components/Sidebar';
import { SelectionProvider } from './lib/selection';
import { AccountPage } from './pages/AccountPage';
import { AdminPage } from './pages/AdminPage';
import { BallByBallPage } from './pages/BallByBallPage';
import { HomePage } from './pages/HomePage';
import { InPlayPage } from './pages/InPlayPage';
import { LoginPage } from './pages/LoginPage';
import { MatchPage } from './pages/MatchPage';

function Shell() {
  return (
    <>
      <Header />
      <Nav />
      <div className="shell">
        <aside>
          <Sidebar />
        </aside>
        <main>
          <Outlet />
        </main>
        <aside>
          <OpenBets />
        </aside>
      </div>
    </>
  );
}

export function App() {
  return (
    <SelectionProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<Shell />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/inplay" element={<InPlayPage />} />
          <Route path="/m/:id" element={<MatchPage />} />
          <Route path="/bbb/:id" element={<BallByBallPage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Route>
      </Routes>
    </SelectionProvider>
  );
}
