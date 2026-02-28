import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Scenarios from './pages/Scenarios';
import ToneLanguage from './pages/ToneLanguage';
import Guardrails from './pages/Guardrails';
import PromptEditor from './pages/PromptEditor';
import Sessions from './pages/Sessions';
import Settings from './pages/Settings';

function AuthGate() {
  const { authenticated } = useAuth();

  if (!authenticated) return <Login />;

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="scenarios" element={<Scenarios />} />
        <Route path="tone" element={<ToneLanguage />} />
        <Route path="guardrails" element={<Guardrails />} />
        <Route path="prompt" element={<PromptEditor />} />
        <Route path="sessions" element={<Sessions />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename="/admin">
        <AuthGate />
      </BrowserRouter>
    </AuthProvider>
  );
}
