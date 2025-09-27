# 3D Asset Processing MCP Setup Guide

## Quick Start

### 1. Installation and Build

```bash
# Install dependencies
npm install

# Build project
npm run build

# Test server
npm test
```

### 2. Configure in Kiro

Create or edit `.kiro/settings/mcp.json` in your workspace:

```json
{
  "mcpServers": {
    "3d-asset-processing": {
      "command": "node",
      "args": ["/absolute/path/to/3d-asset-processing-mcp/dist/server.js"],
      "disabled": false,
      "autoApprove": [
        "analyze_model",
        "validate_model"
      ]
    }
  }
}
```

**Important**: Please replace `/absolute/path/to/3d-asset-processing-mcp` with your actual project path.

### 3. gltf-validator Integration

gltf-validator is included as a dependency in the project, no additional installation is required. The system will automatically detect and use:

1. gltf-validator in local dependencies (priority)
2. Version used through npx
3. Globally installed version (if available)

If none are available, it will automatically fall back to basic validation mode.

## Available Tools

### 1. analyze_model
Analyze detailed information of 3D models

**Usage in Kiro:**
```
Analyze this 3D model: /path/to/model.glb
```

**Returns:**
- File size and format
- Geometry statistics (meshes, triangles, vertices)
- Material and texture information
- Animation data
- Performance recommendations



### 3. validate_model
Validate model compliance and compatibility

**Usage in Kiro:**
```
Validate this model's Web compatibility: /path/to/model.glb
```

**Validation Rules:**
- `basic`: Basic validation
- `web-compatible`: Web compatibility check
- `mobile-compatible`: Mobile compatibility
- `strict`: Strict validation





## Supported Input Formats

### Local Files
```
Analyze this model: /Users/username/models/character.glb
```

### Web URLs
```
Analyze this online model: https://example.com/model.glb
```

### Base64 Data
```
Analyze this base64 model: data:model/gltf-binary;base64,R0xURg...
```

## Usage Examples

### Complete Workflow

1. **Analyze Model**
   ```
   Analyze this model: /path/to/original.glb
   ```

2. **Validate Model (includes validator status)**
   ```
   Validate this model using strict rules: /path/to/original.glb
   ```







### Batch Processing
```
Analyze all glb files in the models folder, then optimize them using the mobile preset
```

## Troubleshooting

### Common Issues

1. **"gltf-validator not found"**
   - Install gltf-validator: `npm install -g gltf-validator`
   - Or use the npx version (will download automatically)

2. **"File not found" Error**
   - Ensure the file path is correct
   - Use absolute paths to avoid path issues

3. **Out of Memory**
   - For large files, increase the Node.js memory limit:
     ```bash
     node --max-old-space-size=4096 dist/server.js
     ```

4. **Permission Error**
   - Ensure you have read/write permissions for the temp and logs directories
   - Check write permissions for the output directory

### Debug Mode

Enable detailed logging:
```bash
NODE_ENV=development node dist/server.js
```

View logs:
```bash
tail -f logs/combined.log
```

### Performance Optimization

1. **Cache Configuration**
   - Analysis and validation results are automatically cached
   - Repeated operations on the same file will return cached results

2. **Temporary File Cleanup**
   - Temporary files are automatically cleaned up
   - Manual cleanup: `rm -rf temp/*`

3. **Memory Management**
   - Memory is automatically released after processing large files
   - Monitor memory usage: check memoryUsage metrics in logs

## Advanced Configuration

### Custom Cache Settings

Modify the configuration in `src/utils/cache.ts`:
```typescript
export const globalCache = new CacheManager({
  stdTTL: 7200, // 2 hours cache
  maxKeys: 2000 // Maximum cache entries
});
```

### Custom Temporary Directory

Set environment variable:
```bash
TEMP_DIR=/custom/temp/path node dist/server.js
```

### Log Level

Set log level:
```bash
LOG_LEVEL=debug node dist/server.js
```

## Development and Extension

### Adding New Optimization Presets

Edit the `getPreset` method in `src/core/optimizer-simple.ts`:

```typescript
'custom-preset': {
  name: 'custom-preset',
  description: 'Custom optimization preset',
  geometry: [
    dedup(),
    // Add your optimization steps
  ],
  textures: []
}
```

### Adding New Tools

1. Define a new tool in `src/tools/index.ts`
2. Add it to the `allTools` array
3. Rebuild the project

## Support and Feedback

If you encounter issues or have improvement suggestions, please:

1. Check log files: `logs/error.log` and `logs/combined.log`
2. Run tests: `npm test`
3. Check gltf-validator status: Run "Check validator status" in Kiro

## Changelog

### v1.0.0
- Basic analysis, optimization, validation functions
- Integration with official gltf-validator
- Support for multiple input formats
- Smart caching mechanism
- Complete MCP integration