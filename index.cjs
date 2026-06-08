// index.cjs
const { createServer } = require('http');
const serverModule = require('./dist/server/server.js');

const port = process.env.PORT || 3000;

const startServer = async () => {
  const handler = serverModule.default || serverModule;
  
  const server = createServer(async (req, res) => {
    try {
      const response = await handler(req, res);
      if (response) {
        res.writeHead(response.status || 200, response.headers || {});
        res.end(response.body);
      }
    } catch (err) {
      console.error(err);
      res.writeHead(500);
      res.end('Server Error');
    }
  });

  server.listen(port, () => {
    console.log(`✅ Server running on http://localhost:${port}`);
  });
};

startServer();