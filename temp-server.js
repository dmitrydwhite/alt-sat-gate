const express = require('express');
const cors = require('cors');
const http = require('http');
const https = require('https');
const url = require('url');

const example_gateway = require('./example-app');

const app = express();
const port = process.env.PORT || 8080;
let exposed_gateway;
let memory_token;


// let app;
// app = https.createServer(options, function (request, response) {
//   const req_url = url.parse(request);

//   if (req_url.pathname === 'pin_code') {
//     if (exposed_gateway) {
//       response.status(200).send(`
//         <p style="font-size: 48px; font-family: Monospace;">
//           ${exposed_gateway.get_system_cx_key().replace('gateway', '')}
//         </p>
//       `);
//     } else {
//       response.status(204).end();
//     }
//   } else if (req_url.pathname === '/connect') {
//     const host = req_url.searchParams.get('host');
//     const token = req_url.searchParams.get('token');
//     const username = req_url.searchParams.get('username');
//     const password = req_url.searchParams.get('password');

//     if (host && token && memory_token !== token) {
//       memory_token = token;

//       exposed_gateway = example_gateway(app, host, token, username, password);

//       response.status(200).end();
//     } else {
//       response.status(204).end();
//     }
//   }
// });

app.use(cors());

app.get('/pinCode', function(request, response) {
  if (exposed_gateway) {
    response.status(200).send(`
      <p style="font-size: 48px; font-family: Monospace;">
        ${exposed_gateway.get_system_cx_key().replace('gateway', '')}
      </p>
    `);
  } else {
    response.status(204).end();
  }
});

app.get('/connect', function(request, response) {
  const { host, token, username, password } = request.query;

  if (host && token && memory_token !== token) {
    memory_token = token;

    exposed_gateway = example_gateway(app, host, token, username, password);

    response.status(200).end();
  } else {
    response.status(204).end();
  }
});

app.get('/', function(request, response) {
  response.status(204).end();
});

app.listen(port, function() {
  console.log(`temp-server listening port :${port}`)
});