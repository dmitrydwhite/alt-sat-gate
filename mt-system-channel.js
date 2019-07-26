const WebSocketServer = require('websocket').server;
// const WebSocketServer = require('ws').Server;
// const io = require('socket.io');
const https = require('https');
const internal_messager = require('./internal-message.js');

function get_random (low, hi) {
  return hi > low &&
    Math.floor(Math.random() * (hi - low + 1)) + (low || 0) || 0;
};

function mt_system_channel(server) {
  let http_request_callback;
  const ws_key = get_random(1048576, 16777215).toString(16) + 'gateway';
  // const ws_key = '000000gateway';
  const { internal_message } = internal_messager();
  const httpServer = https.createServer(function (request, response) {
    if (http_request_callback) {
      http_request_callback(request, response);
    } else {
      response.writeHead(204);
      response.end();
    }
  });
  const ws_server = new WebSocketServer({
    autoAcceptConnections: false,
    httpServer: server || httpServer,
  });
  // const ws_server = io(server || httpServer);
  const connection_bus = {};
  const waiting_connections = {};
  let system_message_cb;

  function valid_resource_request(resource) {
    const [match_key, encoded_sys_name] = resource.split('/')
      .filter(function(item) {
        return !!item;
      });
    const system_name = encoded_sys_name && decodeURI(encoded_sys_name);

    if (match_key !== ws_key) {
      return false;
    }

    if (!system_name || !!connection_bus[system_name]) {
      return false;
    }

    return system_name;
  }

  function get_connection_bus(cx) {
    return connection_bus[cx];
  }

  function get_ws_key() {
    return ws_key;
  }

  function on_message(cb) {
    if (typeof cb !== 'function') {
      throw new Error(`System callback must be a function`);
    }

    system_message_cb = cb;
  }

  function update_connected(system_name) {
    if (waiting_connections[system_name]) {
      waiting_connections[system_name]();

      delete waiting_connections[system_name];
    }
  }

  function await_connection(system_name, cb) {
    if (!system_name || typeof system_name !== 'string') {
      throw new Error(
        'await_connection takes a system name string as its first argument'
      );
    }

    if (typeof cb !== 'function') {
      throw new Error(
        'await_connection requires a callback function as its second argument'
      );
    }

    waiting_connections[system_name] = cb;
  }

  function on_http_request(cb) {
    if (typeof cb !== 'function') {
      throw new Error('on_http_request requires a function as its argument');
    }

    http_request_callback = cb;
  }

  ws_server.on('request', function (request) {
    const { origin, resource } = request;
    const system_name = valid_resource_request(resource);

    console.log(request);
    console.log(system_name);

    if (!system_name) {
      request.reject();
      internal_message(
        `${new Date()} : Connection from origin ${origin} rejected`
      );
      return;
    }

    const connection = request.accept('', origin);

    connection.on('message', function(message) {
      if (system_message_cb) {
        system_message_cb(message);
      } else {
        internal_message(message);
      }
    });

    connection.on('close', function() {
      delete connection_bus[system_name];
    });

    connection_bus[system_name] = connection;

    update_connected(system_name);
  });

  if (!server) {
    httpServer.listen(process.env.PORT || 8080, function () {
      internal_message(`${new Date()} : Server is listening on :${process.env.PORT || 8080}`);
    });
  }

  return {
    await_connection,
    get_connection_bus,
    get_ws_key,
    on_message,
    on_http_request,
  };
}

module.exports = mt_system_channel;
