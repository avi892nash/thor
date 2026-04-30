import { useEffect, useState, FormEvent } from 'react';
import {
  PublicUser,
  listUsers,
  createUser,
  deleteUser,
  resetUserPassword,
} from '../services/authService';
import { useAuth } from '../contexts/AuthContext';

interface Props {
  onClose: () => void;
}

export const ManageUsersModal = ({ onClose }: Props) => {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    try {
      const list = await listUsers();
      setUsers(list);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await createUser(newUsername, newPassword);
      setNewUsername('');
      setNewPassword('');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed');
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async (username: string) => {
    if (!window.confirm(`Delete user '${username}'?`)) return;
    setError(null);
    try {
      await deleteUser(username);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed');
    }
  };

  const onReset = async (username: string) => {
    const pw = window.prompt(`New password for '${username}' (min 6 chars):`);
    if (!pw) return;
    setError(null);
    try {
      await resetUserPassword(username, pw);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed');
    }
  };

  const rootCount = users.filter((u) => u.role === 'root').length;

  return (
    <div className="fixed inset-0 z-20 bg-black/60 flex items-center justify-center px-4">
      <div className="w-full max-w-lg bg-gray-800 border border-gray-700 rounded-xl p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-100">Manage users</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl leading-none">
            ×
          </button>
        </div>

        {loading ? (
          <div className="text-gray-400 text-sm">Loading…</div>
        ) : (
          <div className="space-y-1">
            {users.map((u) => {
              const isLastRoot = u.role === 'root' && rootCount <= 1;
              const isMe = me?.username === u.username;
              return (
                <div
                  key={u.username}
                  className="flex items-center justify-between bg-gray-900 border border-gray-700 rounded px-3 py-2"
                >
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-100 font-medium">{u.username}</span>
                    {u.role === 'root' && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-purple-700 text-purple-100">
                        root
                      </span>
                    )}
                    {u.mustChangePassword && (
                      <span className="text-xs text-yellow-400">temp pw</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      onClick={() => onReset(u.username)}
                      className="px-2 py-0.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-100"
                    >
                      Reset pw
                    </button>
                    <button
                      onClick={() => onDelete(u.username)}
                      disabled={isLastRoot}
                      title={isLastRoot ? 'cannot delete the last root user' : isMe ? 'this is your own account' : ''}
                      className="px-2 py-0.5 rounded bg-red-700 hover:bg-red-600 disabled:bg-gray-700 disabled:text-gray-500 text-red-100"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <form onSubmit={onCreate} className="border-t border-gray-700 pt-4 space-y-2">
          <h3 className="text-sm text-gray-300 font-medium">Add user</h3>
          <div className="flex gap-2">
            <input
              placeholder="Username"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              required
              className="flex-1 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-white text-sm"
            />
            <input
              type="password"
              placeholder="Password (min 6)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={6}
              className="flex-1 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-white text-sm"
            />
            <button
              type="submit"
              disabled={busy}
              className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-sm"
            >
              {busy ? '…' : 'Create'}
            </button>
          </div>
        </form>

        {error && <div className="text-sm text-red-400">{error}</div>}
      </div>
    </div>
  );
};
