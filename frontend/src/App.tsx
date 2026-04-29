import { useState, useCallback } from 'react';
import { RoomManager } from './components/RoomManager';
import { apiService } from './services/apiService';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AuthGate } from './components/AuthGate';
import { register as svcRegister } from './services/authService';

const Header = () => {
  const { user, logout } = useAuth();
  const [showAdd, setShowAdd] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submitNew = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await svcRegister(newUsername, newPassword);
      setShowAdd(false);
      setNewUsername('');
      setNewPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center justify-end gap-3 mb-3 text-sm">
      <span className="text-gray-400">
        Signed in as <span className="text-gray-200 font-medium">{user?.username}</span>
      </span>
      <button
        onClick={() => setShowAdd((v) => !v)}
        className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-100"
      >
        Add user
      </button>
      <button
        onClick={logout}
        className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-100"
      >
        Logout
      </button>

      {showAdd && (
        <form
          onSubmit={submitNew}
          className="absolute right-4 top-12 z-10 bg-gray-800 border border-gray-700 rounded-lg p-4 w-72 space-y-2 shadow-xl"
        >
          <h3 className="text-gray-100 font-medium">Add user</h3>
          <input
            placeholder="Username"
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value)}
            className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-white"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            minLength={6}
            className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-white"
            required
          />
          {error && <div className="text-xs text-red-400">{error}</div>}
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="px-2 py-1 text-gray-300 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700"
            >
              {busy ? '…' : 'Create'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

const Shell = () => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_lightStates, setLightStates] = useState<{ [ip: string]: boolean }>({});

  const toggleLight = useCallback(async (ip: string) => {
    try {
      let currentState: boolean | undefined;
      setLightStates((prev) => {
        currentState = prev[ip];
        return prev;
      });

      const endpoint = currentState ? 'off' : 'on';
      const result = await apiService.lights.toggleLight(ip, endpoint);
      if (result.success) {
        setLightStates((prev) => ({ ...prev, [ip]: !prev[ip] }));
      }
      return result;
    } catch (error) {
      console.error(`Failed to toggle light ${ip}:`, error);
      throw error;
    }
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white">
      <div className="container mx-auto px-4 py-5 max-w-6xl bg-gray-900 relative">
        <Header />
        <div className="flex items-center justify-center mb-5">
          <img src="/thor.png" alt="Thor Logo" className="w-16 h-16 mr-4" />
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            Thor: Smart Home Automation
          </h1>
        </div>

        <RoomManager
          onToggleLight={toggleLight}
          onToggleAllLights={async (ips: string[], state: boolean) => {
            const endpoint = state ? 'on' : 'off';
            await apiService.lights.toggleMultipleLights(ips, endpoint);
          }}
        />
      </div>
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <AuthGate>
        <Shell />
      </AuthGate>
    </AuthProvider>
  );
}

export default App;
