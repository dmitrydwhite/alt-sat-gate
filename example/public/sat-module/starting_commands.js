function starting_commands({
  get_field,
  get_file_bus,
  get_hardware_bus,
  get_name,
  monitor,
  send_file_list,
  send_file_chunk,
  send_measurements,
  set_command_payload,
  set_command_progress,
  start_uploading_file,
}) {
  return {
    ping: function (id, fields, done, get_fields) {
      try {
        if (get_fields) {
          return {
            tags: ['establish_comms'],
          };
        }

        const buzzer = get_hardware_bus('buzzer');

        set_command_payload(id)('pong');

        if (buzzer) {
          buzzer.buzz([
            600, // T
            600, // Space
            600, 200, 600, 200, 600, // O
            600, // Space
            600, 200, 600, // M
          ]);
        }

        done();
      } catch (err) {
        done(err);
      }
    },
    deploy_solar_panels: function (id, fields, done, get_fields) {
      try {
        if (get_fields) {
          return {
            tags: ['hardware', 'solar_panels'],
          }
        }

        const typical_deploy_time = 60;
        const max_wait_for_deploy = 90;
        const solar_panel = get_hardware_bus('solar_panel');
        const is_deployed = solar_panel.get_is_deployed();

        if (is_deployed) {
          set_command_payload(id)('solar panel deployed');
          return done();
        }

        solar_panel.deploy();

        set_command_payload(id)('initiating solar panel deployment');

        let deploy_counter = 0;
        const deploy_interval = setInterval(function() {
          if (deploy_counter >= max_wait_for_deploy) {
            clearInterval(deploy_interval);

            return done('Error: solar panel deployment took too long to confirm');
          }

          if (solar_panel.get_is_deployed()) {
            clearInterval(deploy_interval);
            set_command_payload(id)('solar panel deploy complete');

            return done();
          }

          deploy_counter += 1;

          set_command_progress(id)({
            status: 'solar panel deployment in progress',
            progress_1_current: deploy_counter,
            progress_1_max: deploy_counter > typical_deploy_time ? max_wait_for_deploy : typical_deploy_time,
            progress_1_label: 'Deploying',
          });
        }, 1000);
      } catch (err) {
        done(err);
      }
    },
    update_file_list: function (id, fields, done, get_fields) {
      try {
        if (get_fields) {
          return {
            tags: ['files'],
          };
        }

        set_command_payload(id)('retrieving file list');

        send_file_list();

        set_command_payload(id)('file list finished');

        done();
      } catch (err) {
        done(err);
      }
    },
    downlink_file: function (id, fields, done, get_fields) {
      try {
        if (get_fields) {
          return {
            fields: [{ name: 'filename', type: 'string' }],
            tags: ['files'],
          };
        }

        const file_name = get_field('filename', 'string', fields);
        const file_obj = get_file_bus(file_name);
        const interval = 10000;
        let counter = 0;

        if (!file_obj) throw new Error(`System does not have file ${file_name}`);

        const file_size = file_obj.file_info.size;

        const xfer_interval = setInterval(function() {
          if (counter >= file_size) {
            clearInterval(xfer_interval);
            send_file_chunk(file_name, 'complete');

            const allow_complete = setTimeout(function() {
              clearTimeout(allow_complete);
              done();
            }, 1000);
          }

          send_file_chunk(
            file_name,
            Array.from(file_obj.File.slice(counter, counter + interval))
          );
          set_command_progress(id)({
            status: 'downlinking from system',
            progress_1_max: 100,
            progress_1_current: Math.ceil((counter / file_size) * 100),
          });

          counter += interval;
        }, 10);
      } catch (err) {
        done(err);
      }
    },
    trigger_file_uplink: function (id, fields, done, get_fields) {
      try {
        if (get_fields) {
          return {
            fields: [
              { name: 'filename', type: 'string' },
              { name: 'chunks', type: 'number' },
              { name: 'available_for_downlink', type: 'number', range: [0, 1] },
            ],
            tags: ['files'],
          };
        }

        const filename = get_field('filename', 'string', fields);
        const chunks = get_field('chunks', 'number', fields);
        const available_for_downlink = get_field('available_for_downlink', 'number', fields);

        set_command_payload(id)('Beginning file uplink');

        start_uploading_file({ id, filename, chunks, done, available_for_downlink });
      } catch (err) {
        done(err);
      }
    },
    switch_radio_on: function (id, fields, done, get_fields) {
      try {
        if (get_fields) {
          return {
            tags: ['establish_comms', 'hardware', 'radio'],
          };
        }

        set_command_payload(id)('Switching radio on');
        get_hardware_bus('radio').turn_on();
        done();
      } catch (err) {
        done(err);
      }
    },
    switch_radio_off: function (id, fields, done, get_fields) {
      try {
        if (get_fields) {
          return {
            tags: ['hardware', 'radio'],
          };
        }

        set_command_payload(id)('Switching radio off');
        get_hardware_bus('radio').turn_off();
        done();
      } catch (err) {
        done(err);
      }
    },
    tune_radio: function (id, fields, done, get_fields) {
      try {
        const radio = get_hardware_bus('radio');

        if (get_fields) {
          return {
            fields: [
              { name: 'band', type: 'string', range: radio ? radio.get_available_bands() : [] },
              { name: 'frequency', type: 'float' },
            ],
            tags: ['hardware', 'radio'],
          };
        }

        const band = get_field('band', 'string', fields);
        const frequency = get_field('frequency', 'float', fields);

        if (band) { radio.set_band(band); }

        set_command_payload(id)(`Tuning radio to frequency ${frequency} in ${band} band`);
        radio.tune(frequency);

        done();
      } catch (err) {
        done(err);
      }
    },
    start_hs_telemetry: function (id, fields, done, get_fields) {
      try {
        if (get_fields) {
          return {
            fields: [{ name: 'subsystem', type: 'string' }],
            tags: ['establish_comms', 'hardware', 'telemetry'],
          };
        }

        const hardware = get_field(
          'subsystem',
          'string',
          fields,
          function() {
            set_command_payload(id)(
              'Warning: Could not understand argument(s) sent to start_hs_telemetry; running H&S on all subsystems'
            );
          }
        ) || 'all';

        monitor(true);

        const monitor_interval = setInterval(function () {
          if (!monitor()) {
            clearInterval(monitor_interval);
            return;
          }

          const systems = hardware === 'all'
            ? get_hardware_bus(hardware)
            : [get_hardware_bus(hardware)];

          const measurements = systems
            .map(function (subsystem) {
              const subsys_metrics = subsystem.get_metrics();

              return Object.keys(subsys_metrics).map(function(key) {
                const metric_obj = subsys_metrics[key];

                return {
                  subsystem: subsystem.get_name(),
                  system: get_name(),
                  metric: metric_obj.get_name(),
                  value: metric_obj.get_value(),
                  timestamp: Date.now(),
                };
              });
            })
            .reduce(function (accum, curr) {
              return [...accum, ...curr];
            }, []);

          send_measurements(measurements);
        }, 1250);

        set_command_payload(id)('health & status checks begun for ' + hardware);

        done();
      } catch (err) {
        done(err);
      }
    },
    stop_hs_telemetry: function(id, fields, done, get_fields) {
      try {
        if (get_fields) {
          return {
            tags: ['hardware', 'telemetry'],
          };
        }

        monitor(false);

        set_command_payload(id)('stopping all health & status checks');

        done();
      } catch (err) {
        done(err);
      }
    },
  };
}

export default starting_commands;
