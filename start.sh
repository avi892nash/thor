#!/bin/bash

# WiZ Lights Controller Startup Script

echo "🌟 Starting WiZ Lights Controller..."

# Check if client build exists
if [ ! -d "client/build" ]; then
    echo "📦 Building React client..."
    cd client && npm run build && cd ..
fi

echo "🚀 Starting server..."
echo "📡 Server will be available at: http://localhost:3000"
echo "🔍 Use the web interface to discover and control your WiZ lights"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Start the server
npm start 