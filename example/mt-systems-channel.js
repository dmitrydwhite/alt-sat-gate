const WebSocketServer = require('websocket').server;
const https = require('https');
const internal_messager = require('../src/internal-message.js');

function get_random (low, hi) {
  return hi > low &&
    Math.floor(Math.random() * (hi - low + 1)) + (low || 0) || 0;
};

function mt_system_channel(server) {
  let http_request_callback;
  const ws_key = '000000gateway';
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
  const connection_bus = {};
  const connection_timers = {};
  const waiting_connections = {};
  let system_message_cb;
  let system_name;

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

  function get_system(cx) {
    return connection_bus[cx];
  }

  function get_ws_key() {
    return ws_key;
  }

  /**
   * Set a callback to execute when a message from a system is received.
   * @param {Function} cb Callback function to run when the gateway receives a message from a system
   */
  function on_system_message(cb) {
    if (typeof cb !== 'function') {
      throw new Error(`System callback must be a function`);
    }

    system_message_cb = cb;
  }

  function set_connection_timer(system_name) {
    if (connection_timers[system_name]) {
      clearTimeout(connection_timers[system_name]);
    }

    connection_timers[system_name] = setTimeout(function () {
      delete connection_bus[system_name];
    }, 120 * 60 * 1000); // 120 minutes;
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

  ws_server.on('connection', function (cx_obj) {
    console.log('heard event: CONNECTION', cx_obj);
  });

  ws_server.on('request', function (incoming) {
    const { origin, resource } = incoming;

    last_req_system_name = valid_resource_request(resource);

    if (!last_req_system_name) {
      incoming.reject();
      internal_message(
        `${new Date()} : Connection from origin ${origin} rejected`
      );
    } else {
      incoming.accept(null, origin);
    }
  });

  ws_server.on('connect', function(connection) {
    // Keep a reference to the system name in scope.
    // This is a less-than-ideal way to pass around the name obtained from the
    // last connection url:
    let system_connection = last_req_system_name;

    connection.on('message', function(message) {
      if (system_message_cb) {
        system_message_cb(message);
      } else {
        internal_message(message);
      }
    });

    connection.on('close', function() {
      delete connection_bus[system_connection];
    });

    connection.on('error', function() {
      delete connection_bus[system_connection];
    });

    set_connection_timer(system_connection);

    connection_bus[system_connection] = connection;

    update_connected(system_connection);

    last_req_system_name = undefined;
  });

  if (!server) {
    httpServer.listen(process.env.PORT || 8080, function () {
      internal_message(`${new Date()} : Server is listening on :${process.env.PORT || 8080}`);
    });
  }

  return {
    await_connection,
    get_system,
    get_ws_key,
    on_system_message,
    on_system_connected: await_connection,
    on_http_request,
  };
}

module.exports = mt_system_channel;
