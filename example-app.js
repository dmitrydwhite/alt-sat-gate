const url = require('url');

const app = require('./index.js');

let gateway;

function example_gateway(server, host, token, username, password) {
  gateway = app(server);

  const unsent_queue = {};

  const working_files = {};

  function drain(system_name) {
    return function() {
      if (unsent_queue[system_name]) {
        unsent_queue[system_name].forEach(function (command) {
          gateway.get_system(system_name).send(JSON.stringify(command));
        });
      }
    };
  }

  function send_to_system(system_name, command) {
    const system_cx = gateway.get_system(system_name);

    if (system_cx) {
      system_cx.send(JSON.stringify(command));
    } else {
      unsent_queue[system_name] = unsent_queue[system_name] || [];
      unsent_queue[system_name].push(command);

      gateway.to_mt(JSON.stringify({
        type: 'command_update',
        command: {
          ...command,
          state: 'preparing_on_gateway',
        },
      }));

      gateway.on_system_connected(system_name, drain(system_name));
    }
  }

  function handle_file_chunk(obj) {
    const file_key = `_n${obj.system}_${obj.file_name}`.replace('-', '#');

    if (obj.chunk === 'complete') {
      gateway.upload_file_to_mt(
        Buffer.concat(working_files[file_key]),
        obj.file_name,
        obj.system
      );

      delete working_files[file_key];

      return;
    }

    if (!working_files[file_key]) {
      working_files[file_key] = [];
    }

    working_files[file_key].push(Uint8Array.from(obj.chunk));
  }

  function manage_command_on_gateway(msg) {
    const { fields, system, type } = msg;

    if (type === 'uplink_file') {
      const gateway_download_path = (fields.find(function(field) {
        return field.name === 'gateway_download_path';
      }) || {}).value;

      gateway.to_mt(JSON.stringify({
        type: 'command_update',
        command: {
          ...msg,
          state: 'preparing_on_gateway',
        },
      }));

      if (!gateway_download_path) {
        return gateway.to_mt(JSON.stringify({
          type: 'command_update',
          command: {
            ...msg,
            state: 'failed',
            errors: ['Missing value for required field gateway_download_path']
          }
        }));
      }

      gateway.on_file_download(function(chunk, done) {
        let chunks = Buffer.from([]);

        if (chunk instanceof Error) {
          console.log('File download failed', chunk);

          gateway.to_mt(JSON.stringify({
            type: 'command_update',
            command: {
              ...msg,
              state: 'failed',
            },
          }));

          return;
        }

        if (done) {
          console.log('file done');
          console.log(chunks);
          console.log(chunks.buffer);

          return;
        }

        console.log(chunk);
        chunks = Buffer.concat([chunks, chunk]);
      });

      gateway.download_file_from_mt(gateway_download_path);
    }
  }

  gateway.connect_to_mt(host, token, username, password);

  gateway.open_system_channel();

  gateway.on_mt_message(function(message) {
    try {
      const msg = JSON.parse(message);

      if (msg.type === 'command') {
        const manage_on_gateway = ['uplink_file'];
        const system_name = msg.command.system;

        if (manage_on_gateway.indexOf(msg.command.type) !== -1) {
          return manage_command_on_gateway(msg.command);
        }

        send_to_system(system_name, msg.command);
      }

      if (msg.type === 'error') {
        // TODO: Implement this:
        gateway.token_invalidated();
      }
    } catch (err) {
      console.log(err);
    }

    console.log(message);
  });

  gateway.on_system_message(function(message) {
    const message_string = message.utf8Data;
    const msg = JSON.parse(message_string);
    const command = msg.command || {};
    const id = command.id;
    const state_from_sat = command.state;

    if (msg.type === 'file_chunk') {
      handle_file_chunk(msg);

      console.log(message);

      return;
    }

    gateway.to_mt(message_string);

    if (id && state_from_sat === 'processing_on_gateway') {
      gateway.to_mt(JSON.stringify({
        type: 'command_update',
        command: {
          id,
          state: 'completed',
        },
      }));
    }

    console.log(message);
  });

  return gateway;
}

module.exports = example_gateway;
