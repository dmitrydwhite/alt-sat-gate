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
const gateway_status_info_display = `
  <div id="gateway-status-info"></div>
  <script>
    var q = (window.location.search || "").substring(1).split("&").forEach(function (c) {
      var b = c.split("=");
      var d = document.createElement("h3");
      var e = document.createElement("h2");
      d.setAttribute("style", "font-family: Monospace;");
      d.innerText = "" + b[0];
      e.setAttribute("style", "font-family: Monospace;");
      e.innerText = "" + b[1];

      document.getElementById("gateway-status-info").appendChild(d);
      document.getElementById("gateway-status-info").appendChild(e);
    });
  </script>
`;
const button_actions_bank = `
  <button id="try-reconnect">Re-Connect</button>
  <button id="check-status">Check Status</button>
  <button id="to-disconnect">Disconnect</button>
  <script>
    document.getElementById("try-reconnect").addEventListener("click", function() {
      window.location.pathname = "/connect";
    });
    document.getElementById("to-disconnect").addEventListener("click", function() {
      window.location.pathname = "/disconnect";
    });
    document.getElementById("check-status").addEventListener("click", function() {
      window.location.pathname = "/status";
    });
  </script>
`;
const redirect_to_status_script = `
  <script>
    window.setTimeout(function() {
      window.location.pathname = "/status";
    }, 800);
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
    response.status(200).send(`<p ${p_style}>Not Connected</p>`);
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
      response.status(200).send(`<p ${p_style}>Authorizing</p>${auth_script}`);
      return;
    }

    if (!exposed_gateway || (exposed_gateway && !exposed_gateway.is_connected_to_mt())) {
      exposed_gateway = example_gateway(app_server, host, token);
    }
    
    response.status(200).send(`<p ${p_style}>Connecting...</p>${redirect_to_status_script}`);
  } else {
    response.status(200).send(`<p ${p_style}>Not Connected</p>`);
  }
});

app.get('/disconnect', function(request, response) {
  if (exposed_gateway) {
    exposed_gateway.disconnect_from_mt();
  }

  exposed_gateway = undefined;

  response.status(200).send(`${gateway_status_info_display}<p ${p_style}>Disconnected</p>${button_actions_bank}`);
});

app.get('/', function(request, response) {
  response.status(200).send(`<p ${p_style}>App Listening</p>`);
});

app.get('/status', function(request, response) {
  const connected_state = exposed_gateway && exposed_gateway.is_connected_to_mt()
    ? 'Connected'
    : 'Not Connected';

  response.status(200).send(`
    ${gateway_status_info_display}
    <p ${p_style}>${connected_state}</p>
    ${button_actions_bank}
  `);
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
