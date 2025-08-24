#!/bin/bash

# 3D Asset Processing MCP - Quick Start Script

set -e

echo "🚀 3D Asset Processing MCP - Quick Start"
echo "======================================"

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js not found"
    echo "Please install Node.js first: https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js version: $(node --version)"

# Check npm
if ! command -v npm &> /dev/null; then
    echo "❌ Error: npm not found"
    exit 1
fi

echo "✅ npm version: $(npm --version)"

# Install dependencies
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install --no-optional
else
    echo "✅ Dependencies already installed"
fi

# Build project
if [ ! -d "dist" ] || [ "src" -nt "dist" ]; then
    echo "🔨 Building project..."
    npm run build
else
    echo "✅ Project already built"
fi

# Create necessary directories
mkdir -p logs temp

# Test server
echo "🧪 Testing server..."
if npm test; then
    echo "✅ Server test passed"
else
    echo "❌ Server test failed"
    exit 1
fi

# Check gltf-validator
echo "🔍 Checking gltf-validator..."
if [ -f "./node_modules/gltf-validator/package.json" ]; then
    echo "✅ Found gltf-validator JavaScript API (integrated)"
else
    echo "⚠️  gltf-validator not available, will use basic validation mode"
fi

# Get current path
CURRENT_PATH=$(pwd)

echo ""
echo "🎉 Setup complete!"
echo ""
echo "📋 Configure MCP in Kiro:"
echo "Create or edit .kiro/settings/mcp.json in your workspace:"
echo ""
echo "{"
echo "  \"mcpServers\": {"
echo "    \"3d-asset-processing\": {"
echo "      \"command\": \"node\","
echo "      \"args\": [\"$CURRENT_PATH/dist/server.js\"],"
echo "      \"disabled\": false,"
echo "      \"autoApprove\": ["
echo "        \"analyze_model\","
echo "        \"validate_model\","
echo "        \"get_presets\","
echo "        \"get_validator_status\""
echo "      ]"
echo "    }"
echo "  }"
echo "}"
echo ""
echo "💡 Usage examples:"
echo "   - Analyze model: 'Analyze this 3D model: /path/to/model.glb'"
echo "   - Optimize model: 'Optimize this model using the web-lite preset: /path/to/model.glb'"
echo "   - Validate model: 'Validate this model's Web compatibility: /path/to/model.glb'"
echo ""
echo "📚 Detailed documentation: See SETUP_GUIDE.md"
echo ""
echo "🔧 Manually start server: npm start"