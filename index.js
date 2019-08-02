const mt_ws_channel = require('./mt-ws-channel');
const mt_rest_channel = require('./mt-rest-channel');
const mt_system_channel = require('./mt-system-channel');

function mt_node_gateway(server) {
  let ws_channel;
  let rest_channel;
  let system_channel;

  function connect_to_mt(ws_connect_host, token, username, password) {
    const ws_regex = /^ws(s?):\/\//;
    if (ws_connect_host.search(ws_regex) !== 0) {
      throw new Error(
        'Connect to major tom with a host that includes a valid websocket protocol'
      );
    }

    const ws_host = (username && password)
      ? ws_connect_host.replace(ws_regex, `ws$1://${username}:${password}@`)
      : ws_connect_host;

    const full_ws_url =
      `${ws_host}/gateway_api/v1.0?gateway_token=${token}`;

    // Invoke ws channel with fully formed websocket url
    ws_channel = mt_ws_channel(full_ws_url);
    // Invoke rest channel with the protocol + auth? & hostname, token
    rest_channel = mt_rest_channel(
      ws_host.replace(ws_regex, 'http$1://'),
      token
    );
  }

  function open_system_channel() {
    system_channel = mt_system_channel(server);
  }

  function on_mt_message(cb) {
    ws_channel.on_message(cb);
    // rest_channel.on_message(cb);
  }

  function on_system_message(cb) {
    system_channel.on_message(cb);
  }

  function get_system(system_name) {
    try {
      return system_channel.get_connection_bus(system_name);
    } catch (ignore) {
      return undefined;
    }
  }

  function get_system_cx_key() {
    if (system_channel) {
      return system_channel.get_ws_key();
    }

    return undefined;
  }

  function to_mt(msg) {
    if (ws_channel) {
      ws_channel.send(msg);
    } else {
      // TODO: handle no ws_channel
    }
  }

  function on_system_connected(system_name, cb) {
    if (!system_name || typeof system_name !== 'string') {
      throw new Error(
        'on_system_connected requires a system name string as its first argument'
      );
    }

    if (typeof cb !== 'function') {
      throw new Error(
        'on_system_connected requires a callback function as the second argument'
      );
    }

    if (system_channel) {
      system_channel.await_connection(system_name, cb);
    }
  }

  function disconnect_from_mt() {
    if (ws_channel) ws_channel.close();
  }

  function download_file_from_mt(download_path) {
    if (rest_channel) {
      rest_channel.download_file_from_mt(download_path)
    }
  }

  function is_connected_to_mt() {
    return ws_channel && ws_channel.is_connected();
  }

  function on_file_download(success, failure) {
    if (rest_channel) {
      rest_channel.handle_file_download(success, failure);
    }
  }

  function on_http_request(cb) {
    if (system_channel) {
      system_channel.on_http_request(cb);
    }
  }

  function upload_file_to_mt(File, file_name, system_name) {
    if (rest_channel) {
      rest_channel.upload_file_to_mt(File, file_name, system_name);
    }
  }

  return {
    connect_to_mt,
    disconnect_from_mt,
    download_file_from_mt,
    get_system,
    get_system_cx_key,
    is_connected_to_mt,
    on_file_download,
    on_http_request,
    on_mt_message,
    on_system_connected,
    on_system_message,
    open_system_channel,
    to_mt,
    upload_file_to_mt,
  };
}

module.exports = mt_node_gateway;
