#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { allTools } from './tools/index';
import logger from './utils/logger';
import { globalCache } from './utils/cache';
import { globalFileHandler } from './utils/file-handler';
import { version } from '../package.json';

class AssetProcessingMCPServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: '3d-asset-processing-mcp',
        version: version,
      }
    );

    this.setupHandlers();
    this.setupErrorHandling();
  }

  private setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools: Tool[] = allTools.map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      }));

      return { tools };
    });

    // Execute tool call
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      logger.info(`Tool called: ${name}`, { args });

      // Find the corresponding tool
      const tool = allTools.find(t => t.name === name);
      if (!tool) {
        throw new Error(`Unknown tool: ${name}`);
      }

      try {
        // Execute the tool
        const result = await tool.execute(args || {});

        logger.info(`Tool ${name} completed`, {
          success: result.success,
          processingTime: result.metrics?.processingTime
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        logger.error(`Tool ${name} failed:`, error);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: error instanceof Error ? error.message : String(error),
                stack: process.env.NODE_ENV === 'development' && error instanceof Error ? error.stack : undefined
              }, null, 2),
            },
          ],
          isError: true,
        };
      }
    });
  }

  private setupErrorHandling() {
    // Global error handling
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception:', error);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled rejection at:', promise, 'reason:', reason);
      process.exit(1);
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('Received SIGINT, shutting down gracefully...');
      await this.cleanup();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info('Received SIGTERM, shutting down gracefully...');
      await this.cleanup();
      process.exit(0);
    });
  }

  private async cleanup() {
    try {
      // Clear cache
      globalCache.flush();

      // Clean up temporary files
      await globalFileHandler.cleanupAll();

      logger.info('Cleanup completed');
    } catch (error) {
      logger.error('Cleanup failed:', error);
    }
  }

  async run() {
    // Ensure necessary directories exist
    await globalFileHandler.ensureDir('./temp');
    await globalFileHandler.ensureDir('./logs');

    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    // Log to file only, not to console to avoid interfering with MCP JSON-RPC protocol
    logger.info('3D Asset Processing MCP Server v' + version + ' started');
    logger.info(`Available tools: ${allTools.map(t => t.name).join(', ')}`);
    logger.info('Server ready for connections...');
  }
}

if (require.main === module) {
  const server = new AssetProcessingMCPServer();
  server.run().catch((error) => {
    logger.error('Failed to start server:', error);
    process.exit(1);
  });
}

export default AssetProcessingMCPServer;