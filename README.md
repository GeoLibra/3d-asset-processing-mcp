# 3D Asset Processing MCP

A comprehensive system for processing, validating, optimizing, and analyzing 3D models, with a focus on glTF.

## Features

- **Validation**: Ensure 3D models meet standards using both built-in checks and the gltf-validator library
- **Processing**: Convert between formats, extract textures, and apply optimizations using gltf-pipeline
- **Transformation**: Apply advanced model transformations using gltf-transform for mesh simplification, texture compression, etc.
- **Analysis**: Get detailed model statistics including geometry, materials, animations, and performance metrics
- **Optimization**: Apply various optimization presets for different use cases (web, mobile, etc.)

## Getting started

install the Playwright MCP server with your client.
```json
{
  "mcpServers": {
    "3d-asset-processing-mcp": {
      "command": "npx",
      "args": [
        "-y",
        "3d-asset-processing-mcp@0.0.1-beta.2"
      ]
    }
  }
}
```

### Built-in Dependencies

This MCP tool comes with all necessary dependencies pre-installed:

- **gltf-pipeline**: Integrated for glTF processing and optimization
- **gltf-transform**: Included for advanced model transformations
- **gltf-validator**: Optional, for enhanced validation (install separately if needed)

**No additional installations required!** Users can start using glTF processing features immediately after installing this MCP tool.


### Command Line Interface

The project includes a CLI for processing 3D models:

```bash
# Convert between formats
npx gltf-process convert input.gltf --format glb --output output.glb

# Extract textures
npx gltf-process extract-textures input.glb

# Optimize a model
npx gltf-process optimize input.glb --draco --output optimized.glb

# Process with custom options
npx gltf-process process input.glb --separate-textures --optimize --draco
```

## MCP Integration

This project implements the Model Context Protocol (MCP), allowing it to be used as a plugin in compatible environments. The following MCP tools are available:

### Core Tools
- `analyze_model`: Analyze a 3D model and provide detailed statistics
- `validate_model`: Validate a 3D model for compliance and compatibility, and also returns validator availability/status

### glTF Pipeline Tools
- `gltf_process`: Process glTF files using gltf-pipeline with various optimization options
- `gltf_convert`: Convert between glTF and GLB formats
- `gltf_draco`: Apply Draco compression to glTF geometry

### glTF Transform Tools
- `gltf_transform`: Process glTF files using gltf-transform library with advanced optimization options
- `gltf_transform_optimize`: Optimize glTF files using gltf-transform with default optimization settings
- `gltf_simplify`: Simplify geometry in glTF files to reduce polygon count
- `gltf_compress_textures`: Compress textures in glTF files
- `gltf_draco`: Apply Draco compression to glTF geometry

## Development

```bash
# Clone the repository
git clone git@github.com:GeoLibra/3d-asset-processing-mcp.git
cd 3d-asset-processing-mcp

# Install dependencies
npm install

# Build the project
npm run build
```

## License

MIT