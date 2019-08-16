const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const url = require('url');

const example_gateway = require('./example-app');

const app = express();
const port = process.env.PORT || 8080;
const auth_script = `
  <script>
    var username = prompt("Enter basic auth username");
    var password = prompt("Enter basic auth password");
    var origin = window.location.origin;

    if (username && password) {
      var r = new XMLHttpRequest();
      r.open("POST", origin + "/authorize");
      r.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
      r.onreadystatechange = function() {
        if (r.readyState === 4) {
          window.location.pathname = "/status";
        }
      };
      r.send(JSON.stringify({user: username, pass: password }));
    }
  </script>
`;
const p_style = 'style="font-size: 48px; font-family: Monospace;"';
const try_reconnect_button = `
  <button id="try-reconnect">Try Connecting Again</button>
  <script>
    document.getElementById("try-reconnect").addEventListener("click", function() {
      window.location.pathname = "/connect";
    });
  </script>
`;
let exposed_gateway;
let memory_token;
let auth_host;
const RETRY_LIMIT = 10;
let retries = RETRY_LIMIT;
let mem_user;
let mem_pass;

app.use(bodyParser.json({ strict: true }));

app.get('/pinCode', function(request, response) {
  if (exposed_gateway) {
    response.status(200).send(`
      <p ${p_style}>
        ${exposed_gateway.get_system_cx_key().replace('gateway', '')}
      </p>
    `);
  } else {
    response.status(200).send(`<p ${p_style}>not cx</p>`);
  }
});

app.get('/connect', function(request, response) {
  const { host, token, auth } = request.query;

  if (host && token) {
    if (memory_token !== token) {
      memory_token = token;

      exposed_gateway = undefined;
    }

    if (auth === 'true') {
      auth_host = host;
      response.status(200).send(`<p ${p_style}>authorizing</p>${auth_script}`);
      return;
    }

    if (!exposed_gateway || (exposed_gateway && !exposed_gateway.is_connected_to_mt())) {
      exposed_gateway = undefined;
      exposed_gateway = example_gateway(app_server, host, token);
    }

    setTimeout(function() {
      if (exposed_gateway.is_connected_to_mt()) {
        response.status(200).send(`<p ${p_style}>cx good</p>`);
      } else {
        response.status(200).send(`<p ${p_style}>not cx</p>`);
      }
    }, 500);

    const keep_alive = setInterval(function() {
      if (retries <= 0) {
        clearInterval(keep_alive);
      }

      if (exposed_gateway) {
        if (!exposed_gateway.is_connected_to_mt()) {
          exposed_gateway.connect_to_mt(host, token, mem_user, mem_pass);

          retries -= 1;
        } else {
          retries = RETRY_LIMIT;
        }
      }
    }, 60000);

  } else {
    response.status(200).send(`<p ${p_style}>not cx</p>`);
  }
});

app.get('/disconnect', function(request, response) {
  if (exposed_gateway) {
    exposed_gateway.disconnect_from_mt();
  }

  exposed_gateway = undefined;

  response.status(200).send(`<p ${p_style}>disconnected</p>`);
});

app.get('/', function(request, response) {
  response.status(200).send(`<p ${p_style}>App listening</p>`);
});

app.get('/status', function(request, response) {
  if (exposed_gateway && exposed_gateway.is_connected_to_mt()) {
    response.status(200).send(`<p ${p_style}>Connected</p>${try_reconnect_button}`);
  } else {
    response.status(200).send(`<p ${p_style}>Not Connected</p>${try_reconnect_button}`);
  }
});

app.post('/authorize', function(request, response) {
  if (exposed_gateway) {
    exposed_gateway = undefined;
  }

  const { user, pass } = request.body;

  exposed_gateway = example_gateway(app_server, auth_host, memory_token, user, pass);

  setTimeout(function() {
    if (exposed_gateway.is_connected_to_mt()) {
      mem_user = user;
      mem_pass = pass;
      response.status(200).end();
    } else {
      response.status(403).end();
    }
  }, 2000);
});

const app_server = app.listen(port, function() {
  console.log(`temp-server listening port :${port}`)
});
