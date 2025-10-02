// Use require for CommonJS modules
const winston = require('winston');

// Create logger
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: '3d-asset-processing-mcp' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

// Add console output in development environment
// But not when running as MCP server (stdout is used for JSON-RPC)
const isInteractive = process.stdin.isTTY && process.stdout.isTTY;
const forceConsole = process.env.FORCE_CONSOLE_LOG === 'true';
const disableConsole = process.env.DISABLE_CONSOLE_LOG === 'true' || process.env.MCP_SERVER === 'true';
const isMCPServer = !isInteractive && !forceConsole;

if (process.env.NODE_ENV !== 'production' && !isMCPServer && !disableConsole) {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

export default logger;