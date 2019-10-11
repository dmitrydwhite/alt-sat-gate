import system_commanding from './system_commanding.js';
import starting_commands from './starting_commands.js';
import make_hardware_bus from './make_hardware_bus.js';

function create_satellite(mock_flag, supress_defs) {
  const command_bus = {};
  function get_hardware_bus(item) {
    if (item === 'all') {
      return Object.keys(hardware_bus).map(function(key) {
        return hardware_bus[key];
      });
    }

    return hardware_bus[item];
  }

  function get_hardware_state() {
    const hardware = get_hardware_bus('all');
    const ret = hardware.reduce(function(accum, item) {
      const metrics = item.get_metrics();
      const as_prim = Object.keys(metrics).reduce(function(accum, curr) {
        const metric = metrics[curr];

        return {
          ...accum,
          [metric.get_name()]: metric.get_value(),
        };
      }, {});

      return {
        ...accum,
        [item.get_name()]: as_prim,
      };
    }, {});

    return JSON.stringify(ret);
  }

  const file_bus = {};
  let file_counter = 1;
  function get_file_bus(file_name) {
    if (file_name) {
      return file_bus[file_name];
    }

    return Object.keys(file_bus).map(function (key) {
      return file_bus[key].file_info;
    });
  }


  let hardware_bus = {};

  const {
    finish_command,
    get_field,
    run_command,
    set_command_payload,
    set_command_progress,
  } = system_commanding({ get_command_bus, get_name, send });

  function send_file_list() {
    const file_list = {
      type: 'file_list',
      file_list: {
        system: get_name(),
        timestamp: Date.now(),
        files: Object.keys(file_bus).map(function (file_name) {
          const for_system= file_bus[file_name].file_info.for_system;

          if (for_system) return false;

          return file_bus[file_name].file_info;
        }).filter(function(obj) { return !!obj; }),
      }
    };

    send(file_list);
  }

  function send_file_chunk(file_name, chunk) {
    const file_chunk = {
      type: 'file_chunk',
      system: get_name(),
      file_name,
      chunk,
    };

    send(file_chunk);
  }

  function send_measurements(measurements) {
    if (measurements && Array.isArray(measurements)) {
      send({ type: 'measurements', measurements });
    }
  }

  const files_in_progress = {};
  function start_uploading_file({ id, filename, chunks, done, available_for_downlink }) {
    files_in_progress[`${id}_${filename}`] = {
      chunks, filename, received: 0, file_arr: [], available_for_downlink,
    };

    set_command_progress(id)({
      status: `${encodeURIComponent(get_name())} ready to receive file chunks for ${filename}`,
      payload: `${id}_${filename} 0 ${filename}`,
    });
  }

  function receive_file_chunk(msg_obj) {
    const { id, chunk, filename, file_key } = msg_obj;
    const file = files_in_progress[file_key];

    if (['uplink_complete', 'uplink_error'].indexOf(chunk) > -1) {
      if (chunk === 'uplink_complete') {
        add_file(new Uint8Array(file.file_arr), filename, !file.available_for_downlink);
        finish_command(id)();
      }

      return delete files_in_progress[file_key];
    }

    // Payload pattern: commandId_fileName checksum filename
    const payload = `${file_key} ${chunk
      .reduce(function (accum, curr) {
        return accum + curr;
      }) % 10} ${filename}`;

    file.received += 1;
    file.file_arr = file.file_arr.concat(chunk);

    set_command_progress(id)({
      payload,
      state: 'uplinking_to_system',
      status: `${encodeURIComponent(get_name())} receiving uplinked file`,
      progress_1_current: file.received,
      progress_1_max: file.chunks,
      progress_1_label: 'Chunks Received On Orbit',
    });
  }

  const {
    add_command,
    ...initial_commands
  } = starting_commands({
    get_field,
    get_file_bus,
    get_hardware_bus,
    get_name,
    send_file_chunk,
    send_file_list,
    send_measurements,
    set_command_payload,
    set_command_progress,
    start_uploading_file,
    monitor,
  });

  let onboard_error; // Reserved for onboard_error_function
  let onboard_message; // Reserved for onboard_message_function
  let send_hook; // Reserved for UI for sending messages
  let disconnect_hook; // Reserved for UI disconnect callback
  let file_added_hook; // Reserved for UI file added to bus callback;

  let is_running_measurements = false;
  function monitor(should) {
    if (should === true) {
      is_running_measurements = true;
    }

    if (should === false) {
      is_running_measurements = false;
    }

    return is_running_measurements;
  }

  let WSX;

  let system_name = '';
  function get_name() {
    return system_name;
  }
  function set_name(new_name) {
    if (typeof new_name !== 'string') {
      throw new Error('System name must be a string');
    }

    system_name = new_name;
  }

  function get_command_bus(command_type) {
    return command_bus[command_type];
  }

  function handle_message(msg) {
    try {
      const message_data = msg.data;
      const message = JSON.parse(message_data);

      if (message.type === 'reserved_file_uplink_chunk') {
        receive_file_chunk(message);

        return;
      }

      if (message.type === 'command') {
        run_command(message.command);
      } else {
        run_command(message);
      }

      if (onboard_message) {
        onboard_message(JSON.stringify(message, null, 2));
      }
    } catch (err) {
      if (onboard_error) {
        onboard_error(err);
      }
    }
  }

  function launch(ws_url) {
    try {
      const url_obj = new URL(ws_url);

      if (url_obj.protocol.indexOf('ws') === -1) {
        throw new Error('Gateway websocket url must use websocket protocol');
      }

      WSX = new WebSocket(url_obj.href);
      WSX.onmessage = handle_message;
      WSX.onclose = function() {
        WSX = undefined;
        if (disconnect_hook) disconnect_hook();
      };

      if (!supress_defs) {
        WSX.onopen = send_command_defs;
      }
    } catch (err) {
      onboard_error(err);
    }
  }

  function deorbit() {
    try {
      WSX.close();
      WSX = undefined;
    } catch (err) {
      if(onboard_error) {
        onboard_error(err);
      }
    }
  }

  function on_incoming_message(cb, err_cb) {
    if (typeof cb !== 'function') {
      throw new Error('on_incoming_message requires a function callback');
    }

    if (err_cb && typeof err_cb !== 'function') {
      throw new Error(
        'Optional error callback passed to on_incoming_message must be a function'
      );
    }

    onboard_error = err_cb || cb;
    onboard_message = cb;
  }

  function on_outgoing_message(cb) {
    if (typeof cb !== 'function') {
      throw new Error('on_outgoing_message requires a function callback');
    }

    send_hook = cb;
  }

  function on_file_added(cb) {
    if (typeof cb !== 'function') {
      throw new Error('on_file_added requires a function callback');
    }

    file_added_hook = cb;
  }

  function send(msg) {
    if (typeof msg !== 'object') {
      throw new Error(
        'send requires an object; it will be converted to a string for transport'
      );
    }

    if (send_hook) {
      send_hook(JSON.stringify(msg, null, 2));
    }

    WSX.send(JSON.stringify(msg));
  }

  function is_connected() {
    return !!WSX;
  }

  function on_disconnect(cb) {
    if (typeof cb !== 'function') {
      throw new Error(
        'Function must be passed as disconnect handler'
      );
    }

    disconnect_hook = cb;

    if (WSX) {
      WSX.onclose = function() {
        WSX = undefined;
        disconnect_hook();
      }
    }
  }

  function enable_camera() {
    return new Promise(function(resolve, reject) {
      const camera = get_hardware_bus('camera');

      if (!camera) { reject('camera not available'); }

      camera.async_request_camera()
        .then(function(stream) {
          resolve(stream);
        })
        .catch(function(rej) {
          reject(rej);
        });
    })
  }

  function add_file(file_buf, file_name, for_system_only) {
    if (file_buf) {
      // const buffer = Uint8Array.from(file_buf.split(',')[1], 'base64');
      const name = file_name || `file_${Date.now()}_${file_counter}.png`;
      const size = file_buf.length;
      const timestamp = Date.now();

      file_bus[name] = {
        File: file_buf,
        file_info: { name, size, timestamp, for_system: !!for_system_only },
      };

      file_counter += 1;

      if (file_added_hook) file_added_hook(get_file_bus());
    }
  }

  function buzz(pattern) {
    const buzzer = get_hardware_bus('buzzer');

    if (buzzer) {
      buzzer.buzz(pattern);
    }
  }

  function send_command_defs() {
    const definitions = {};
    const private_commands = ['trigger_file_uplink'];

    Object.keys(command_bus).forEach(function (command) {
      if (private_commands.indexOf(command) > -1) return;

      const { fields = [], tags = [] } = command_bus[command](null, null, null, true) || [];

      definitions[command] = {
        display_name: `${command.replace(/_/g, ' ')} (Generated)`,
        description: `${command} Command Automatically Generated by Satellite ${get_name()}`,
        fields,
        tags,
      }
    });

    send({
      type: 'command_definitions_update',
      command_definitions: {
        system: get_name(),
        definitions,
      },
    });
  }

  // This needs to be done asynchronously due to some of the permission requests
  // being asynchronouse
  make_hardware_bus(mock_flag).then(function (sync_hardware_bus) {
    hardware_bus = sync_hardware_bus;
  }).catch(function(err) {
    console.log(err);
  })

  // Initialize starting commands
  Object.keys(initial_commands).forEach(function(command_type) {
    command_bus[command_type] = initial_commands[command_type];
  });

  return {
    add_file,
    buzz,
    deorbit,
    enable_camera,
    get_name,
    set_name,
    is_connected,
    on_disconnect,
    launch,
    on_incoming_message,
    on_outgoing_message,
    on_file_added,
    send_command_defs,
    get_hardware_state,
  };
}

export default create_satellite;
