import { Route, Routes } from 'react-router-dom';
import { Header } from './components/Header';
import { LobbyPage } from './pages/LobbyPage';
import { LoginPage } from './pages/LoginPage';
import { MatchPage } from './pages/MatchPage';

export function App() {
  return (
    <div className="app">
      <Header />
      <main className="main">
        <Routes>
          <Route path="/" element={<LobbyPage />} />
          <Route path="/m/:id" element={<MatchPage />} />
          <Route path="/login" element={<LoginPage />} />
        </Routes>
      </main>
    </div>
  );
}
