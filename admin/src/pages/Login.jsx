import { useState } from 'react';
import { useAuth } from '../lib/AuthContext';

export default function Login() {
  const { login, error } = useAuth();
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token.trim() || loading) return;
    setLoading(true);
    await login(token.trim());
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-nox-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-nox-accent text-white font-bold text-xl mb-4">
            N
          </div>
          <h1 className="text-xl font-semibold text-nox-text">NOX Admin</h1>
          <p className="text-sm text-nox-text-muted mt-1">Enter your admin token to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-nox-surface border border-nox-border rounded-xl p-6 space-y-4">
          <div>
            <label htmlFor="token" className="block text-sm font-medium text-nox-text-muted mb-1.5">
              Admin Token
            </label>
            <input
              id="token"
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Enter admin secret..."
              autoFocus
              className="w-full bg-nox-bg border border-nox-border rounded-lg px-3.5 py-2.5 text-sm text-nox-text placeholder-zinc-600 outline-none focus:border-nox-accent transition-colors"
            />
          </div>

          {error && (
            <p className="text-sm text-nox-danger">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !token.trim()}
            className="w-full bg-nox-accent hover:bg-nox-accent-hover text-white font-medium text-sm rounded-lg py-2.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? 'Verifying...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
