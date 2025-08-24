# 3D Asset Processing MCP Server

A 3D asset processing server based on the Model Context Protocol (MCP), providing model analysis, optimization, and validation functions.

## Features

- **Model Analysis**: Detailed analysis of 3D model geometry, materials, textures, and performance characteristics
- **Model Optimization**: Optimize models using preset configurations, supporting multiple optimization strategies
- **Model Validation**: Validate model compliance and platform compatibility
- **Caching Mechanism**: Intelligent caching to improve processing efficiency
- **Multi-format Support**: Support for glTF/GLB formats, with file, URL, and Base64 input options

## Quick Start

### Install Dependencies

```bash
npm install
```

### Build Project

```bash
npm run build
```

### Run in Development Mode

```bash
npm run dev
```

### Run in Production Mode

```bash
npm start
```

## MCP Tools

### 1. analyze_model

Analyze 3D models and provide detailed statistics and recommendations.

**Input Parameters:**
```json
{
  "input": {
    "source": "path/to/model.glb",
    "type": "file"
  }
}
```

**Output Example:**
```json
{
  "success": true,
  "data": {
    "metadata": {
      "fileSize": 1024000,
      "format": "GLB",
      "version": "2.0"
    },
    "geometry": {
      "meshCount": 5,
      "triangleCount": 15000,
      "vertexCount": 8000
    },
    "performance": {
      "estimatedDrawCalls": 5,
      "recommendations": ["Consider texture compression"]
    }
  }
}
```

### 2. optimize_model

Optimize 3D models using preset configurations.

**Input Parameters:**
```json
{
  "input": {
    "source": "path/to/model.glb",
    "type": "file"
  },
  "preset": "web-high",
  "outputPath": "path/to/optimized.glb"
}
```

**Available Presets:**
- `web-high`: High quality Web optimization
- `web-lite`: Lightweight Web optimization
- `mobile`: Mobile optimization
- `editor-safe`: Editor-safe optimization

### 3. validate_model

Validate 3D model compliance and compatibility.

**Input Parameters:**
```json
{
  "input": {
    "source": "path/to/model.glb",
    "type": "file"
  },
  "rules": "web-compatible"
}
```

### 4. get_presets

Get a list of available optimization presets.

## Configuring MCP in Kiro

Create or edit `.kiro/settings/mcp.json` in your Kiro workspace:

```json
{
  "mcpServers": {
    "3d-asset-processing": {
      "command": "node",
      "args": ["path/to/3d-asset-processing-mcp/dist/server.js"],
      "env": {
        "NODE_ENV": "production"
      },
      "disabled": false,
      "autoApprove": [
        "analyze_model",
        "validate_model",
        "get_presets"
      ]
    }
  }
}
```

## Usage Examples

In Kiro, you can use it like this:

```
Analyze this 3D model: /path/to/model.glb
```

```
Optimize this model using the web-lite preset: /path/to/model.glb
```

```
Validate this model's Web compatibility: /path/to/model.glb
```

## Supported Input Formats

### File Path
```json
{
  "source": "/absolute/path/to/model.glb",
  "type": "file"
}
```

### URL
```json
{
  "source": "https://example.com/model.glb",
  "type": "url"
}
```

### Base64
```json
{
  "source": "data:model/gltf-binary;base64,R0xURg...",
  "type": "base64"
}
```

## Project Structure

```
src/
├── core/           # Core processing modules
│   ├── analyzer.ts # Model analyzer
│   ├── optimizer.ts# Model optimizer
│   └── validator.ts# Model validator
├── tools/          # MCP tool definitions
│   └── index.ts    # Tool exports
├── types/          # TypeScript type definitions
│   └── index.ts
├── utils/          # Utility functions
│   ├── cache.ts    # Cache management
│   ├── file-handler.ts # File handling
│   └── logger.ts   # Logging system
└── server.ts       # MCP server main file
```

## Development

### Adding New Tools

1. Define a new tool in `src/tools/index.ts`
2. Implement the tool's `execute` method
3. Add appropriate input validation and error handling

### Adding New Optimization Presets

Add new preset configurations in the `getPreset` method in `src/core/optimizer.ts`.

## Logs

Log files are located in the `logs/` directory:
- `error.log`: Error logs
- `combined.log`: All logs

## Performance Optimization

- Use memory caching to avoid repeated processing
- Automatic temporary file cleanup
- Support for large file streaming
- Smart error recovery

## Troubleshooting

### Common Issues

1. **Module not found error**: Make sure you've run `npm install` and `npm run build`
2. **Permission error**: Ensure you have read/write permissions for the temporary directory
3. **Out of memory**: For large files, consider increasing the Node.js memory limit

### Debug Mode

Set environment variables to enable detailed logging:
```bash
NODE_ENV=development npm run dev
```

## License

MIT License