#!/usr/bin/env node

// Simple test script to verify MCP server functionality
const { spawn } = require('child_process');
const path = require('path');

async function testMCPServer() {
  console.log('Testing 3D Asset Processing MCP Server...\n');

  // Start MCP server
  const serverPath = path.join(__dirname, 'dist', 'server.js');
  const server = spawn('node', [serverPath], {
    stdio: ['pipe', 'pipe', 'inherit']
  });

  // Test messages
  const testMessages = [
    // 1. List tools
    {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
      params: {}
    },
    // 2. Get presets
    {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'get_presets',
        arguments: {}
      }
    }
  ];

  let messageIndex = 0;

  // Handle server responses
  server.stdout.on('data', (data) => {
    const response = data.toString().trim();
    if (response) {
      console.log(`Response ${messageIndex}:`, response);
      console.log('---\n');

      messageIndex++;

      // Send next test message
      if (messageIndex < testMessages.length) {
        const nextMessage = JSON.stringify(testMessages[messageIndex]) + '\n';
        console.log(`Sending message ${messageIndex + 1}:`, nextMessage.trim());
        server.stdin.write(nextMessage);
      } else {
        // Tests completed
        console.log('All tests completed!');
        server.kill();
      }
    }
  });

  server.on('error', (error) => {
    console.error('Server error:', error);
  });

  server.on('close', (code) => {
    console.log(`Server exited with code ${code}`);
    process.exit(code);
  });

  // Send first test message
  setTimeout(() => {
    const firstMessage = JSON.stringify(testMessages[0]) + '\n';
    console.log(`Sending message 1:`, firstMessage.trim());
    server.stdin.write(firstMessage);
  }, 1000);
}

// Check if project is built
const fs = require('fs');
if (!fs.existsSync('./dist/server.js')) {
  console.error('Please build the project first: npm run build');
  process.exit(1);
}

testMCPServer().catch(console.error);