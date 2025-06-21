<p align="center">
  <img src="client/public/thor.png" alt="Thor Logo" width="180"/>
</p>

# Thor: WiZ Lights Controller

Thor is a comprehensive React-based web application for controlling Philips WiZ smart lights with advanced features including rhythm synchronization, color control, and network discovery.

## Features

- 🔍 **Network Discovery**: Automatically discover WiZ lights on your network
- 💡 **Light Control**: Individual and group control of lights (on/off, brightness, color, temperature)
- 🎵 **Rhythm & Music Sync**: Synchronize lights with music/beats with various effects
- 🌐 **Real-time Updates**: WebSocket connection for live status updates
- 📱 **Responsive Design**: Modern, mobile-friendly interface
- ⚡ **React Architecture**: Component-based structure with proper state management

## Architecture

### Backend (Node.js/Express)
- **server.js**: Main Express server with API endpoints
- **lib/wizLight.js**: WiZ light communication library
- **lib/rhythmController.js**: Music synchronization controller
- WebSocket server for real-time updates

### Frontend (React/TypeScript)
- **React Components**: Modular, reusable UI components
- **Custom Hooks**: API calls and WebSocket management
- **TypeScript**: Type-safe development
- **Responsive CSS**: Modern gradient design with animations

## Quick Start

### Installation
```bash
# Install dependencies for both backend and React client
npm install

# This will also install client dependencies via postinstall script
```

### Development
```bash
# Start the backend server (serves React build in production)
npm run dev

# For development, run client separately:
npm run dev-client
```

### Production Build
```bash
# Build React client for production
npm run build

# Start production server
npm start
```

## Usage

1. **Discovery**: Click "Discover Lights" to scan your network for WiZ lights
2. **Connect**: Click "Connect" on discovered lights to establish connection
3. **Control**: Use the Light Control section to manage all connected lights
4. **Rhythm**: Set up rhythm synchronization and choose effects for music sync

## API Endpoints

### Network & Discovery
- `GET /api/network` - Get network interface information
- `POST /api/discover` - Discover lights on network
- `POST /api/test/:ip` - Test communication with specific IP

### Light Control
- `GET /api/lights` - Get all discovered and connected lights
- `POST /api/lights/:ip/connect` - Connect to specific light
- `POST /api/lights/:ip/on|off` - Turn light on/off
- `POST /api/lights/:ip/color` - Set light color (RGB + brightness)
- `POST /api/lights/:ip/brightness` - Set light brightness
- `POST /api/lights/:ip/temperature` - Set color temperature

### Rhythm/Music Sync
- `GET /api/rhythm/status` - Get rhythm controller status
- `POST /api/rhythm/setup` - Setup rhythm with connected lights
- `POST /api/rhythm/start` - Start rhythm effect
- `POST /api/rhythm/stop` - Stop all effects
- `POST /api/rhythm/bpm` - Set BPM for effects
- `POST /api/rhythm/beat` - Trigger manual beat

## Project Structure

```
├── server.js                 # Main server file
├── package.json              # Backend dependencies
├── lib/                      # Backend libraries
│   ├── wizLight.js          # WiZ light communication
│   └── rhythmController.js  # Rhythm/music sync
└── client/                  # React frontend
    ├── package.json         # Frontend dependencies
    ├── public/              # Static assets
    └── src/                 # React source code
        ├── App.tsx          # Main app component
        ├── App.css          # Styling
        ├── types.ts         # TypeScript definitions
        ├── hooks/           # Custom React hooks
        │   ├── useApi.ts    # API call management
        │   └── useWebSocket.ts # WebSocket connection
        └── components/      # React components
            ├── DiscoverySection.tsx
            ├── LightControlSection.tsx
            ├── RhythmControlSection.tsx
            └── WebSocketStatus.tsx
```

## Benefits of React Conversion

### State Management
- **Centralized State**: React state prevents data inconsistencies
- **Real-time Updates**: WebSocket integration with React state
- **Component Isolation**: Each section manages its own local state

### User Experience
- **Loading States**: Visual feedback during operations
- **Error Handling**: Proper error messages and recovery
- **Responsive Design**: Adapts to different screen sizes
- **Type Safety**: TypeScript prevents runtime errors

### Development
- **Component Reusability**: Modular component architecture
- **Hot Reloading**: Fast development cycle
- **Code Organization**: Clear separation of concerns
- **Testing Ready**: React Testing Library compatible

## Network Configuration

The application automatically detects your network configuration. For manual configuration:

1. Use the network auto-detection feature
2. Or manually enter your broadcast address (e.g., `192.168.1.255`)
3. Test individual IPs using the "Test Single IP" feature

## Troubleshooting

- **No lights discovered**: Check that lights are on the same network and powered on
- **Connection issues**: Verify UDP port 38899 is not blocked
- **WebSocket disconnected**: Check network connectivity, auto-reconnect is enabled
- **Effects not working**: Ensure lights are connected and rhythm is set up first

## License

MIT License - see LICENSE file for details. 