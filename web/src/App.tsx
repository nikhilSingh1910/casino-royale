import { Route, Routes } from 'react-router-dom';
import { Header } from './components/Header';
import { Nav } from './components/Nav';
import { OpenBets } from './components/OpenBets';
import { Sidebar } from './components/Sidebar';
import { SelectionProvider } from './lib/selection';
import { BallByBallPage } from './pages/BallByBallPage';
import { HomePage } from './pages/HomePage';
import { InPlayPage } from './pages/InPlayPage';
import { MatchPage } from './pages/MatchPage';

export function App() {
  return (
    <SelectionProvider>
      <Header />
      <Nav />
      <div className="shell">
        <aside>
          <Sidebar />
        </aside>
        <main>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/inplay" element={<InPlayPage />} />
            <Route path="/m/:id" element={<MatchPage />} />
            <Route path="/bbb/:id" element={<BallByBallPage />} />
          </Routes>
        </main>
        <aside>
          <OpenBets />
        </aside>
      </div>
    </SelectionProvider>
  );
}
