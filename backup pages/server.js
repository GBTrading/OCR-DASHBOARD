const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

// Load environment variables from .env file
function loadEnvFile() {
  try {
    const envPath = path.join(__dirname, '.env');
    const envData = fs.readFileSync(envPath, 'utf8');

    envData.split('\n').forEach(line => {
      const trimmedLine = line.trim();
      if (trimmedLine && !trimmedLine.startsWith('#')) {
        const [key, ...valueParts] = trimmedLine.split('=');
        if (key && valueParts.length > 0) {
          process.env[key.trim()] = valueParts.join('=').trim();
        }
      }
    });
  } catch (error) {
    console.log('No .env file found or error reading it:', error.message);
  }
}

// Load environment variables
loadEnvFile();

// Import existing serverless function handlers
const createCheckoutSessionHandler = require('./api/create-checkout-session');
const stripeWebhookHandler = require('./api/stripe-webhook');

const PORT = 4242;

// MIME types for serving static files
const mimeTypes = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.json': 'application/json'
};

// Helper function to get MIME type
function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return mimeTypes[ext] || 'application/octet-stream';
}

// Helper function to serve static files
function serveStaticFile(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('File not found');
      return;
    }

    const mimeType = getMimeType(filePath);
    res.writeHead(200, { 'Content-Type': mimeType });
    res.end(data);
  });
}

// Helper function to parse JSON body
function parseBody(req, callback) {
  let body = '';
  req.on('data', chunk => {
    body += chunk.toString();
  });
  req.on('end', () => {
    try {
      const parsed = JSON.parse(body);
      callback(null, parsed);
    } catch (error) {
      callback(error, null);
    }
  });
}

// Helper function to get raw body (for webhooks)
function getRawBody(req, callback) {
  let body = [];
  req.on('data', chunk => {
    body.push(chunk);
  });
  req.on('end', () => {
    callback(Buffer.concat(body));
  });
}

// Create HTTP server
const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  // Set CORS headers for all requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle OPTIONS requests
  if (method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Handle API routes
  if (pathname === '/api/create-checkout-session' && method === 'POST') {
    parseBody(req, (err, body) => {
      if (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
        return;
      }

      // Create mock req/res objects that match Express format
      const mockReq = { ...req, body, headers: req.headers };
      const mockRes = {
        setHeader: (name, value) => res.setHeader(name, value),
        status: (code) => {
          mockRes._statusCode = code;
          return mockRes;
        },
        json: (data) => {
          res.writeHead(mockRes._statusCode || 200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(data));
        }
      };

      createCheckoutSessionHandler(mockReq, mockRes);
    });
    return;
  }

  if (pathname === '/api/stripe-webhook' && method === 'POST') {
    getRawBody(req, (rawBody) => {
      // Create mock req/res objects that match Express format
      // CRITICAL: Properly forward ALL headers, especially stripe-signature
      const mockReq = {
        ...req,
        body: rawBody,
        rawBody,
        headers: req.headers // Ensure headers are properly forwarded
      };
      const mockRes = {
        setHeader: (name, value) => res.setHeader(name, value),
        status: (code) => {
          mockRes._statusCode = code;
          return mockRes;
        },
        json: (data) => {
          res.writeHead(mockRes._statusCode || 200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(data));
        },
        send: (data) => {
          res.writeHead(mockRes._statusCode || 200);
          res.end(data);
        },
        end: () => res.end()
      };

      stripeWebhookHandler(mockReq, mockRes);
    });
    return;
  }

  // Handle static files
  let filePath;
  if (pathname === '/' || pathname === '') {
    filePath = path.join(__dirname, 'index.html');
  } else if (pathname === '/landing') {
    filePath = path.join(__dirname, 'landing.html');
  } else {
    filePath = path.join(__dirname, pathname);
  }

  // Check if file exists and serve it
  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      // File doesn't exist, return 404
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('File not found');
    } else {
      serveStaticFile(res, filePath);
    }
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  console.log('📡 API endpoints available:');
  console.log(`   POST http://localhost:${PORT}/api/create-checkout-session`);
  console.log(`   POST http://localhost:${PORT}/api/stripe-webhook`);
  console.log('💡 Make sure Stripe CLI webhook forwarding is running:');
  console.log(`   stripe listen --forward-to localhost:${PORT}/api/stripe-webhook`);
});