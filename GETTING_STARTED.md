# Getting Started with WiZ Lights Controller

A simple guide to get your Philips WiZ lights dancing to the rhythm!

## What This Does

This tool lets you:
- Control all your WiZ lights from one place
- Make lights flash and change colors to music
- Create cool lighting effects
- Control lights from your phone/computer
- Trigger effects manually or automatically

## Before You Start

### What You Need:
- Philips WiZ lights (connected to your Wi-Fi)
- Computer with Node.js installed
- WiZ lights and computer on the same network

### Quick Setup Check:
1. Make sure your WiZ lights work with the official WiZ app
2. Note down your network info (usually starts with 192.168.1.xxx)

## Installation (5 minutes)

### Step 1: Download and Install
```bash
# Install dependencies
npm install

# Start the server
npm start
```

You should see:
```
WiZ Lights Server running on port 3000
WebSocket server running on ws://localhost:3000
Use POST /api/discover to find lights on your network
Use /api/rhythm/* endpoints for music synchronization
```

### Step 2: Open the Web Interface
1. Open your browser
2. Go to: `http://localhost:3000`
3. You should see a beautiful control interface

## First Time Use (2 minutes)

### Step 1: Find Your Lights
1. Click **"Discover Lights"** button
2. Wait 3-5 seconds
3. Your lights should appear in the list

**Troubleshooting:** If no lights found:
- Change the subnet to match your network (e.g., `192.168.0.255` or `10.0.0.255`)
- Make sure lights are on and connected to Wi-Fi

### Step 2: Connect to Lights
1. Click **"Connect"** next to each light you want to control
2. Green checkmarks mean successful connection

### Step 3: Test Basic Control
1. Click **"All Lights On"** - all connected lights should turn on
2. Use the color picker to change all lights to a color
3. Use the brightness slider

## Making Lights Dance to Music

### Quick Start - Rhythm Effects

1. **Setup Rhythm Control:**
   - Click **"Setup Rhythm (All Lights)"**
   - This prepares all connected lights for effects

2. **Start an Effect:**
   - Choose BPM (beats per minute) - try 120 for normal music
   - Click any effect button:
     - **Pulse** - Flash on each beat
     - **Rainbow** - Cycle through colors
     - **Strobe** - Random flashing
     - **Wave** - Smooth wave pattern
     - **Beat** - Random colors each beat
     - **Breathe** - Gentle breathing effect

3. **Manual Beat Trigger:**
   - Click **"Manual Beat"** to trigger effects instantly
   - Perfect for testing or manual control

### For Live Music:
1. Set BPM to match your music (most songs are 120-140 BPM)
2. Start with **Pulse** or **Beat** effects
3. Use **Manual Beat** button to tap along with the music

### Stopping Effects:
- Click **"Stop All Effects"** to return lights to normal

## Advanced Usage

### Using Different Devices
The web interface works on any device with a browser:
- **Phone**: Go to `http://YOUR_COMPUTER_IP:3000`
- **Tablet**: Same URL as phone
- **Other Computer**: Same URL

To find your computer's IP:
- **Windows**: Open Command Prompt, type `ipconfig`
- **Mac/Linux**: Open Terminal, type `ifconfig`

### Controlling Individual Lights
Each discovered light has its own controls:
- Toggle on/off
- Set custom colors
- Adjust brightness
- Disconnect if needed

### Custom Network Setup
If your network is different:
1. Find your router's IP (usually printed on the router)
2. Change the last number to 255 (e.g., `192.168.1.1` becomes `192.168.1.255`)
3. Use this in the subnet field when discovering

## API Usage (For Developers)

### Quick Commands with cURL:

```bash
# Find lights
curl -X POST http://localhost:3000/api/discover

# Turn on a light
curl -X POST http://localhost:3000/api/lights/192.168.1.10/on

# Set red color
curl -X POST http://localhost:3000/api/lights/192.168.1.10/color \
  -H "Content-Type: application/json" \
  -d '{"r": 255, "g": 0, "b": 0}'

# Start pulse effect
curl -X POST http://localhost:3000/api/rhythm/start \
  -H "Content-Type: application/json" \
  -d '{"effect": "pulse", "bpm": 120}'
```

### Integration with Other Apps:
- **Home Assistant**: Use the REST API endpoints
- **IFTTT**: Create webhooks to the API endpoints
- **Spotify**: Connect using Spotify's API to get current song BPM
- **Discord Bots**: Make lights react to voice chat activity

## Common Issues & Solutions

### No Lights Found
**Problem**: Discovery shows 0 lights
**Solutions**:
1. Check lights work in official WiZ app first
2. Try different subnet addresses:
   - `192.168.1.255`
   - `192.168.0.255` 
   - `10.0.0.255`
3. Make sure computer and lights are on same Wi-Fi network
4. Turn lights off and on again

### Can't Connect to Light
**Problem**: Connect button doesn't work
**Solutions**:
1. Light might be busy - wait 10 seconds and try again
2. Restart the light (turn off/on)
3. Check if another app is controlling the light

### Rhythm Effects Don't Work
**Problem**: Effects start but lights don't change
**Solutions**:
1. Make sure you clicked "Setup Rhythm" first
2. Verify lights are connected (green checkmarks)
3. Try turning lights on manually first
4. Check BPM is between 60-200

### Web Interface Won't Load
**Problem**: Browser shows error
**Solutions**:
1. Make sure server is running (see startup messages)
2. Try `http://127.0.0.1:3000` instead
3. Check no other app is using port 3000

## Fun Ideas to Try

### Party Mode:
1. Connect all your lights
2. Set BPM to match your music (use a BPM finder app)
3. Start with "Beat" effect for color variety
4. Switch between effects during different songs

### Ambient Lighting:
1. Use "Breathe" effect at slow BPM (60-80)
2. Set custom colors for different moods
3. Perfect for relaxation or work

### Gaming Setup:
1. Use "Strobe" for action games
2. Use "Wave" for strategy games
3. Trigger manual beats for game events

### Streaming/Content Creation:
1. Use manual beat triggers for emphasis
2. Change effects for different segments
3. Set up different colors for different topics

## Getting Help

If you run into issues:
1. Check the console output for error messages
2. Look at the browser's developer console (F12)
3. Make sure your WiZ lights work with the official app first
4. Try restarting the server (`Ctrl+C` then `npm start`)

## What's Next?

Once you're comfortable with the basics:
- Explore the full API documentation in README.md
- Try integrating with other smart home systems
- Build custom rhythm detection using microphone input
- Create scheduled lighting scenes
- Connect to music streaming services

Have fun with your smart lights! 