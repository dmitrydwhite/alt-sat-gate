const url = require('url');

const app = require('../index.js');
// This is an example solution for communications between the gateway and systems.
// It uses WebSockets, with the intention of talk to a mock system that exists
// in a web browser tab.
const mt_systems_channel = require('./mt-systems-channel.js');

let gateway;

/**
 * This is the default export function that starts the example app.
 *
 * @param {HTTPServer} server An HTTP Server that can be upgraded to a WebSocket server
 * @param {String} host Your Major Tom instance WebSocket url
 * @param {String} token Your Major Tom Gateway Token
 * @param {[String]} username Basic Auth User Name
 * @param {[String]} password Basic Auth Password
 * @return {Object} An instance of the example app
 */
function example_gateway(server, host, token, username, password) {
  gateway = {
    // Get all the methods exposed from the Major Tom Node Gateway Library
    ...app(),
    // Get the methods from this example systems connection implementation
    ...mt_systems_channel(server),
  };

  const unsent_queue = {};

  const working_files = {};

  const file_retrieve_queue = [];
  let is_retrieving_file = false;

  /**
   * A higher order function to send any stored, unsent commands to a recently
   * re-connected system.
   * @param {String} system_name  The system name
   * @return {Function}
   */
  function drain(system_name) {
    return function() {
      if (unsent_queue[system_name]) {
        unsent_queue[system_name].forEach(function (command) {
          gateway.get_system(system_name).send(JSON.stringify(command));
        });
      }
    };
  }

  /**
   * The primary function to send a command to a system. If the system is connected,
   * this will convert the command arg to a JSON string and send it over WebSocket.
   * If not connected, this will store the JSON string in the unsent queue object.
   * @param  {String} system_name The system name
   * @param  {Object} command The command as a JS object
   */
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

  /**
   * Handles receiving a file chunk from a system. Sends the complete file and
   * tidies up the queue when a chunk marked "complete" is received.
   * @param  {Object} obj The object containing the file chunk, along with system and file name
   */
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

  const sending_files_in_progress = {};

  function send_file_to_system(system_name, filename, id, file_buffer, available_for_downlink) {
    const buffer_array = [...file_buffer];

    sending_files_in_progress[`${id}_${filename}`] = buffer_array;
    sending_files_in_progress[`${id}_${filename}`].checksum = 0;

    send_to_system(
      system_name,
      {
        id,
        type: 'trigger_file_uplink',
        fields: [
          { name: 'filename', value: filename },
          { name: 'chunks', value: Math.ceil(buffer_array.length / 5000) },
          { name: 'available_for_downlink', value: available_for_downlink },
        ],
        system: system_name,
      }
    );
  }

  function push_update(command_obj) {
    const command = command_obj.command || command_obj;
    const { id, payload, status } = command;
    const [key_name, checksum, filename] = payload.split(' ');
    const [encoded_system_name] = status.split(' ');
    const system_name = decodeURIComponent(encoded_system_name);
    let chunk_to_send;
    let new_checksum;

    if (sending_files_in_progress[key_name].checksum !== Number(checksum)) {
      chunk_to_send = 'uplink_error';

      return gateway.to_mt(JSON.stringify({
        type: 'command_update',
        command: {
          id,
          errors: 'File uplink checksum mismatch in uplink from gateway to satellite',
          state: 'failed',
          system: system_name,
        },
      }));
    }

    if (sending_files_in_progress[key_name].length === 0) {
      delete sending_files_in_progress[key_name];
      chunk_to_send = 'uplink_complete';
    } else {
      chunk_to_send = sending_files_in_progress[key_name].slice(0, 5000);
      new_checksum = chunk_to_send.reduce(function (accum, curr) { return accum + curr; }) % 10;

      sending_files_in_progress[key_name] = sending_files_in_progress[key_name].slice(5000);
      sending_files_in_progress[key_name].checksum = new_checksum;
    }


    send_to_system(system_name, {
      id,
      type: 'reserved_file_uplink_chunk',
      chunk: chunk_to_send,
      file_key: key_name,
      filename: filename || payload,
      system: system_name,
    });
  }

  /**
   * Check if this message from a satellite is an update to a file uplink
   * @param  {Object} msg_obj The object received from the satellite
   * @return {Boolean} Whether or not we should push another file update to the system.
   */
  function is_uplink_update(msg_obj) {
    if (
      !msg_obj.command ||
      !msg_obj.command.payload ||
      !(sending_files_in_progress[msg_obj.command.payload] || sending_files_in_progress[msg_obj.command.payload.split(' ')[0]])
    ) {
      return false;
    }

    return true;
  }

  /**
   * Most commands received by the gateway may simply be passed along by the gateway
   * to the destination system. However, some commands require a bit more management
   * at the gateway layer. This function identifies those commands
   * @param  {[type]} msg [description]
   * @return {[type]} [description]
   */
  function manage_command_on_gateway(msg, g_d_p) {
    const { id, fields, filename, system, type } = msg;

    if (type === 'uplink_file') {
      const gateway_download_path = g_d_p || (fields.find(function(field) {
        return field.name === 'gateway_download_path';
      }) || {}).value;
      const file_name = filename || (fields.find(function(field) {
        return field.name === 'filename';
      }) || {}).value;
      const available_for_downlink = (fields.find(function(field) {
        return field.name === 'available_for_downlink';
      }) || {}).value;

      if (is_retrieving_file) {
        file_retrieve_queue.push({
          id,
          system,
          type,
          gateway_download_path,
          available_for_downlink,
          filename: file_name
        });

        gateway.to_mt(JSON.stringify({
          type: 'command_update',
          command: {
            ...msg,
            state: 'preparing_on_gateway',
          },
        }));

        return;
      }

      is_retrieving_file = true;

      gateway.to_mt(JSON.stringify({
        type: 'command_update',
        command: {
          ...msg,
          state: 'preparing_on_gateway',
        },
      }));

      if (!gateway_download_path || !file_name) {
        if (file_retrieve_queue.length > 0) {
          const next_file = file_retrieve_queue.shift();

          manage_command_on_gateway(next_file, next_file.gateway_download_path);
        } else {
          is_retrieving_file = false;
        }

        return gateway.to_mt(JSON.stringify({
          type: 'command_update',
          command: {
            ...msg,
            state: 'failed',
            errors: [`Both gateway_download_path and filename fields must be present on command`],
          },
        }));
      }

      let chunks = Buffer.from([]);

      gateway.on_file_download(function(chunk, done) {
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
          send_file_to_system(system, file_name, id, chunks, available_for_downlink);

          if (file_retrieve_queue.length > 0) {
            const next_file = file_retrieve_queue.shift();

            manage_command_on_gateway(next_file, next_file.gateway_download_path);
          } else {
            is_retrieving_file = false;
          }

          return;
        }

        chunks = Buffer.concat([chunks, chunk]);
      });

      gateway.download_file_from_mt(gateway_download_path);
    }
  }

  gateway.connect_to_mt(host, token, username, password);

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

    if (msg.type === 'command_definitions_update') {
      const definitions = msg.command_definitions && msg.command_definitions.definitions;
      const needs_uplink_file = Object.keys(definitions || {}).indexOf('uplink_file') === -1;

      if (needs_uplink_file) {
        msg.command_definitions.definitions = {
          ...definitions,
          uplink_file: {
            display_name: 'uplink file (Generated)',
            description: 'uplink_file Command Automatically Generated by Gateway',
            fields: [
              { name: 'gateway_download_path', type: 'string' },
              { name: 'filename', type: 'string' },
              { name: 'available_for_downlink', type: 'number', range: [0, 1], default: 0 },
            ],
          },
        };

        return gateway.to_mt(JSON.stringify(msg));
      }
    }

    if (msg.type === 'command_update' && is_uplink_update(msg)) {
      push_update(msg);
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
