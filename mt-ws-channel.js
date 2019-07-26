const WebSocket = require('ws');
const internal_messager = require('./internal-message.js');

const command_update_fields = [
  'state', 'payload', 'status', 'output', 'errors',
  'progress_1_current', 'progress_1_max', 'progress_1_label',
  'progress_2_current', 'progress_2_max', 'progress_2_label',
];

function major_tom_ws_channel(invoked_url) {
  // Define internal variables
  let channel_queue = [];
  let channel_holding = [];
  let drain_pace = 100;
  let handshook = false;
  let is_cx = false;
  let is_draining = true;
  let url = invoked_url || '';
  let token;
  let channel_socket;
  let {
    drain_internal,
    internal_message,
    on_message,
    set_internal_pace,
  } = internal_messager();

  // Define exposed functions
  function connect() {
    try_connection();
  }

  function set_gateway_url(passed) {
    if (!passed && url && token) return;

    try {
      const match = new URL(passed || url);

      url = match.href;
      token = match.searchParams.get('gateway_token');

      internal_message(`${url} ${token}`);
    } catch (err) {
      internal_message('Could not set gateway url', err);
    }
  }

  function set_gateway_token(new_token) {
    token = new_token;
  }

  function send(str) {
    if (typeof str === 'string' || str instanceof String) {
      return push_message(str);
    }

    try {
      push_message(JSON.stringify(str));
    } catch (error) {
      internal_message(`Could not send ${str}`, error);
    }
  }

  function send_command_update(cmd_update) {
    const is_plain_object = typeof cmd_update === 'object' && !Array.isArray(cmd_update);
    const has_id = !Number.isNaN(Number(cmd_update.id));
    const has_udpate_field = !!command_update_fields.find(function(field) {
      return cmd_update[field];
    });

    if (is_plain_object && has_id && has_udpate_field) {
      return push_message(JSON.stringify({
        type: 'command_update',
        command: { ...cmd_update },
      }));
    }

    return internal_message(
      '',
      'Method send_command_update requires an object with an id and at least one updated field'
    );
  }

  function send_events(events) {
    send_of_type('events')(events);
  }

  function send_measurements(measurements) {
    send_of_type('measurements')(measurements);
  }

  function send_file_list(file_list) {
    if (typeof file_list === 'string') {
      try {
        const parsed = JSON.parse(file_list);

        if (typeof parsed === 'object') {
          if (parsed.type === 'file_list') {
            return push_message(file_list);
          }

          return push_message(JSON.stringify({
            type: 'file_list',
            file_list: parsed,
          }))
        }

        return push_message(file_list);
      } catch (e) {
        return internal_message(`Could not understand sent file_list string ${file_list}`, e);
      }
    }

    if (file_list.type === 'file_list') {
      return push_message(JSON.stringify(file_list));
    }

    return push_message(JSON.stringify({
      type: 'file_list',
      file_list,
    }));
  }

  function send_file_metadata(metadata) {
    if (typeof metadata === 'string') {
      try {
        const parsed = JSON.parse(metadata);

        if (parsed.type === 'file_metadata_update') {
          return push_message(metadata);
        }

        return push_message(JSON.stringify({
          type: 'file_metadata_update',
          downlinked_file: metadata,
        }));
      } catch (e) {
        return internal_message(`Could not understand sent file_metadata_update string ${metadata}`, e);
      }
    }

    if (metadata.type === 'file_metadata_update') {
      return push_message(JSON.stringify(metadata));
    }

    return push_message(JSON.stringify({
      type: 'file_metadata_update',
      downlinked_file: metadata,
    }));
  }

  function send_command_defs(definitions) {
    if (typeof definitions === 'string') {
      try {
        const parsed = JSON.parse(definitions);

        if (parsed.type === 'command_definitions_update') {
          return push_message(definitions);
        }

        return push_message(JSON.stringify({
          type: 'command_definitions_update',
          command_definitions: definitions,
        }))
      } catch (e) {
        return internal_message(
          `Could not understand sent command_definitions string ${definitions}`,
          e
        );
      }
    }

    if (definitions.type === 'command_definitions_update') {
      return push_message(JSON.stringify(definitions));
    }

    return push_message(JSON.stringify({
      type: 'command_definitions_update',
      command_definitions: definitions,
    }));
  }

  function is_connected() {
    return channel_socket && channel_socket.readyState === 1;
  }

  // Define internal functions
  function send_of_type(type) {
    return function(received) {
      if (typeof received === 'string') {
        // If we receive a string, we make a series of three evaluations & assumptions:
        // 1. If it parses to an object with a `received` property, we send the string we received.
        // 2. If it parses to an Array, we assume we got a JSON string of received, and wrap those
        //    in an object with a type: received property.
        // 3. If we got anything else really, we assume that it's a single measurement object, and put
        //    it into an array under the received prop of a formatted received object.
        try {
          const parsed = JSON.parse(received);

          if (parsed.type === type) {
            return push_message(received);
          }

          if (Array.isArray(parsed)) {
            return push_message(JSON.stringify({
              [type]: parsed,
              type,
            }));
          }

          return push_message(JSON.stringify({
            [type]: [parsed],
            type,
          }));
        } catch (error) {
          return internal_message(`Could not understand sent ${type} string ${received}`, error);
        }
      }

      if (Array.isArray(received)) {
        return push_message(JSON.stringify({
          [type]: received,
          type,
        }));
      }

      if (typeof received === 'object' && received.type === type) {
        return push_message(received);
      }

      return internal_message(
        `Method send_${type} is specifically to send ${type} to Major Tom`,
        `Method send_${type} received a ${type} argument that was not in any expected format`
      );
    };
  }

  function resolve_drained_queue() {
    is_draining = false;

    if (channel_holding.length > 0) {
      channel_queue = [...channel_holding];
      channel_holding = [];

      drain_queue();
    }
  }

  function drain_queue() {
    if (channel_socket && channel_socket.send && handshook) {
      if (channel_queue.length === 1) {
        channel_socket.send(channel_queue[0]);
      } else {
        is_draining = true;

        let drain_interval = setInterval(function() {
          if (channel_queue.length === 0) {
            clearInterval(drain_interval);
            resolve_drained_queue();
          }

          const to_send = channel_queue[0];

          if(to_send) channel_socket.send(to_send);

          channel_queue = channel_queue.slice(1);
        }, drain_pace);
      }
    }
  }

  function push_message(message) {
    if (!is_draining) {
      channel_queue.push(message);

      return drain_queue();
    } else {
      channel_holding.push(message);

      return;
    }
  }

  function url_is_complete() {
    set_gateway_url();

    return !!url && !!token;
  }

  function get_url() {
    return `${url}`;
  }

  function setup_channel_socket() {
    channel_socket = new WebSocket(get_url());

    is_cx = true;

    channel_socket.onmessage = function(message) {
      if (!handshook) {
        try {
          const hello = JSON.parse(message.data);

          if (hello.type === 'hello') {
            handshook = true;

            resolve_drained_queue();
          }
        } catch (e) {
          internal_message('Could not verify handshake with Major Tom', e);

          drain_internal(message.data);
        }
      }

      drain_internal(message.data);
    };

    channel_socket.onerror = function(error) {
      is_cx = false;
      internal_message('Channel socket connection experienced an error', error);
    };

    channel_socket.onclose = function(close_message) {
      is_cx = false;
      internal_message('Channel socket connection was closed', close_message);
    };
  }

  function try_connection() {
    if (is_cx) {
      internal_message('Connection attempted but gateway is already connected to Major Tom');
    } else if (url_is_complete()) {
      setup_channel_socket();
    } else {
      internal_message(
        `Connection attempted but missing ${url || token ? (url && 'token') || 'url' : 'url and token'} `
      );
    }
  }

  function close() {
    if (channel_socket) {
      channel_socket.close();
    }
  }

  // Attempt to connect automatically if the invoked url has all needed elements
  if (url_is_complete()) {
    try_connection();
  }

  return Object.freeze({
    close,
    connect,
    set_gateway_url,
    set_gateway_token,
    send,
    send_command_update,
    send_measurements,
    send_events,
    send_command_defs,
    send_file_list,
    send_file_metadata,
    on_message,
    is_connected,
  });
}

module.exports = major_tom_ws_channel;
