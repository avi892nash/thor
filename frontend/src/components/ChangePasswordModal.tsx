import { useState, FormEvent } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { changePassword } from '../services/authService';

interface Props {
  onClose: () => void;
}

export const ChangePasswordModal = ({ onClose }: Props) => {
  const { refreshMe } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (next !== confirm) {
      setError('passwords do not match');
      return;
    }
    setBusy(true);
    try {
      await changePassword(current, next);
      await refreshMe();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-20 bg-black/60 flex items-center justify-center px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm bg-gray-800 border border-gray-700 rounded-xl p-6 space-y-4 shadow-2xl"
      >
        <h2 className="text-lg font-semibold text-gray-100">Change password</h2>

        <div className="space-y-2">
          <label className="block text-sm text-gray-300">Current password</label>
          <input
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            required
            autoFocus
            className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white outline-none focus:border-blue-500"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm text-gray-300">New password</label>
          <input
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            required
            minLength={6}
            className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white outline-none focus:border-blue-500"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm text-gray-300">Confirm new password</label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            minLength={6}
            className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white outline-none focus:border-blue-500"
          />
        </div>

        {error && <div className="text-sm text-red-400">{error}</div>}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 text-gray-300 hover:text-white"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="px-4 py-1 rounded bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700"
          >
            {busy ? '…' : 'Change'}
          </button>
        </div>
      </form>
    </div>
  );
};
