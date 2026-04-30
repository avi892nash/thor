import { useState, useCallback } from 'react';
import { RoomManager } from './components/RoomManager';
import { apiService } from './services/apiService';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AuthGate } from './components/AuthGate';
import { ChangePasswordModal } from './components/ChangePasswordModal';
import { ManageUsersModal } from './components/ManageUsersModal';
import { MustChangeBanner } from './components/MustChangeBanner';

const Header = ({
  onChangePassword,
  onManageUsers,
}: {
  onChangePassword: () => void;
  onManageUsers: () => void;
}) => {
  const { user, logout } = useAuth();
  return (
    <div className="flex items-center justify-end gap-3 mb-3 text-sm">
      <span className="text-gray-400">
        Signed in as <span className="text-gray-200 font-medium">{user?.username}</span>
        {user?.role === 'root' && (
          <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-purple-700 text-purple-100">
            root
          </span>
        )}
      </span>
      <button
        onClick={onChangePassword}
        className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-100"
      >
        Change password
      </button>
      {user?.role === 'root' && (
        <button
          onClick={onManageUsers}
          className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-100"
        >
          Manage users
        </button>
      )}
      <button
        onClick={logout}
        className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-100"
      >
        Logout
      </button>
    </div>
  );
};

const Shell = () => {
  const { user } = useAuth();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_lightStates, setLightStates] = useState<{ [ip: string]: boolean }>({});
  const [showChangePw, setShowChangePw] = useState(false);
  const [showManage, setShowManage] = useState(false);

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
      {user?.mustChangePassword && (
        <MustChangeBanner onChangeClick={() => setShowChangePw(true)} />
      )}
      <div className="container mx-auto px-4 py-5 max-w-6xl bg-gray-900 relative">
        <Header
          onChangePassword={() => setShowChangePw(true)}
          onManageUsers={() => setShowManage(true)}
        />
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

      {showChangePw && <ChangePasswordModal onClose={() => setShowChangePw(false)} />}
      {showManage && <ManageUsersModal onClose={() => setShowManage(false)} />}
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
