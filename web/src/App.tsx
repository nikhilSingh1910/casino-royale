import { Route, Routes } from 'react-router-dom';
import { Header } from './components/Header';
import { Nav } from './components/Nav';
import { OpenBets } from './components/OpenBets';
import { Sidebar } from './components/Sidebar';
import { SelectionProvider } from './lib/selection';
import { HomePage } from './pages/HomePage';
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
            <Route path="/m/:id" element={<MatchPage />} />
          </Routes>
        </main>
        <aside>
          <OpenBets />
        </aside>
      </div>
    </SelectionProvider>
  );
}
