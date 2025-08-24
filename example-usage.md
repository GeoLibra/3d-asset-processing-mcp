# Usage Examples

## Configuring and Using 3D Asset Processing MCP in Kiro

### 1. Configure MCP Server

Create or edit `.kiro/settings/mcp.json` in your workspace:

```json
{
  "mcpServers": {
    "3d-asset-processing": {
      "command": "node",
      "args": ["/path/to/3d-asset-processing-mcp/dist/server.js"],
      "disabled": false,
      "autoApprove": ["analyze_model", "validate_model", "get_presets"]
    }
  }
}
```

### 2. Usage Examples

#### Analyze Model
```
Please analyze the detailed information of this 3D model: /Users/username/models/character.glb
```

Kiro will call the `analyze_model` tool and return a detailed model analysis report, including:
- File size and format information
- Geometry statistics (mesh count, triangle count, vertex count)
- Material and texture information
- Animation data
- Performance recommendations

#### Optimize Model
```
Optimize this model using the web-lite preset: /Users/username/models/scene.glb
Output to: /Users/username/models/scene_optimized.glb
```

#### Validate Model Compatibility
```
Check this model's Web compatibility: /Users/username/models/product.glb
```

#### Get Available Presets
```
Show all available optimization presets
```

### 3. Advanced Usage

#### Batch Processing
```
Analyze all glb files in the models folder
```

#### URL Processing
```
Analyze this online model: https://example.com/model.glb
```

#### Combined Operations
```
First analyze this model, then optimize it using the mobile preset: /path/to/model.glb
```

### 4. Preset Descriptions

- **web-high**: High quality Web optimization, preserves visual quality while optimizing for delivery
- **web-lite**: Lightweight optimization, prioritizes file size reduction
- **mobile**: Mobile optimization, balances quality and performance
- **editor-safe**: Editor-safe optimization, preserves all editing information

### 5. Troubleshooting

If you encounter issues:

1. Check if the server is running properly:
   ```bash
   ./start.sh
   ```

2. View logs:
   ```bash
   tail -f logs/combined.log
   ```

3. Test server functionality:
   ```bash
   node test-model.js