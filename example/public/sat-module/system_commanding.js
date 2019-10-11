function system_commanding({ get_command_bus, get_name, send }) {
  function command_update({
    id,
    state,
    status,
    payload,
    output,
    errors,
    progress_1_label,
    progress_1_max,
    progress_1_current,
    progress_2_label,
    progress_2_max,
    progress_2_current,
     }) {
    const update = {
      type: 'command_update',
      command: {
        id,
        state,
        status,
        payload,
        output,
        errors,
        progress_1_label,
        progress_1_max,
        progress_1_current,
        progress_2_label,
        progress_2_max,
        progress_2_current,
      },
    };

    return send(update);
  }

  function get_field(field_name, field_type, fields, err_cb) {
    function eject(msg) {
      if (!err_cb || typeof err_cb !== 'function') {
        throw new Error(msg);
      }

      return err_cb(msg);
    }

    try {
      if (!(fields && fields.length > 0)) {
        return eject('No fields provided but command expected them');
      }

      const field = fields.find(function(field_obj) {
        return field_obj.name === field_name;
      }) || {};

      const { type, value } = field;
      const number_types = ['enum', 'float', 'integer', 'number', 'datetime'];
      const string_types = ['string', 'text'];

      if (
        (number_types.indexOf(field_type) !== -1 && typeof value !== 'number') ||
        (string_types.indexOf(type) !== -1 && typeof value !== 'string')
      ) {
        return eject(`Expected ${field_name} to be a ${field_type}`);
      }

      return value;
    } catch (e) {
      return eject(e);
    }
  }

  function run_command({ id, type, system, fields }) {
    const system_name = get_name();
    const command_fn = get_command_bus(type);

    command_update({ id, state: 'acked_by_system' });

    if (system !== system_name) {
      return command_update({
        id,
        state: 'failed',
        errors: [
        `Command ${id} intended for ${system} but sent to ${system_name}`
        ],
      });
    }

    if (!command_fn || typeof command_fn !== 'function') {
      return command_update({
        id,
        state: 'failed',
        errors: [
        `System ${system_name} cannot execute command of type ${type}`
        ],
      });
    }

    try {
      command_fn(id, fields, finish_command(id));
    } catch (errors) {
      finish_command(id)(errors);
    }
  }

  function set_command_progress(id) {
    return function (progress) {
      if (!id) {
        throw new Error(
          'Attempted to call set_command_progress without an id, which is required'
        );
      }

      const {
        output,
        status,
        payload,
        progress_1_label,
        progress_1_max,
        progress_1_current,
        progress_2_label,
        progress_2_max,
        progress_2_current,
      } = progress;

      return command_update({
        id,
        state: 'executing_on_system',
        output,
        status,
        payload,
        progress_1_label,
        progress_1_max,
        progress_1_current,
        progress_2_label,
        progress_2_max,
        progress_2_current,
      })
    }
  }

  function set_command_payload(id) {
    return function (payload) {

      if (!id) {
        throw new Error(
          'Attempted to call set_command_payload without an id, which is required'
        );
      }

      return command_update({
        id,
        payload,
        state: 'executing_on_system',
      })
    }
  }

  function finish_command(id) {
    return function (err) {
      if (err && typeof err !== 'string') {
        err = err.toString();
      }

      const errors = err ? Array.isArray(err) && err || [err] : undefined;

      return command_update({
        id,
        errors,
        state: errors ? 'failed' : 'processing_on_gateway',
      });
    }
  }

  return {
    finish_command,
    get_field,
    run_command,
    set_command_payload,
    set_command_progress,
  };
}

export default system_commanding;
