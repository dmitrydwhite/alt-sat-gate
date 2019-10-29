function internal_messager(cb) {
  let is_sending_inbound = true;
  let internal_holding = [];
  let internal_queue = [];
  let internal_pace = 100;
  let handler = cb;

  function drain_internal(message) {
    if (message) {
      if (is_sending_inbound) {
        internal_holding = [...internal_holding, message];
      } else {
        internal_queue = [...internal_queue, message];
      }
    }

    if (handler) {
      is_sending_inbound = true;

      let inbound_interval = setInterval(function() {
        if (internal_queue.length === 0) {
          clearInterval(inbound_interval);

          resolve_drained_internal();
        } else {
          const to_send = internal_queue[0];

          internal_queue = internal_queue.slice(1);

          handler(to_send);
        }
      }, internal_pace);
    }
  }

  function resolve_drained_internal() {
    is_sending_inbound = false;

    if (internal_holding.length > 0) {
      internal_queue = [...internal_holding];
      internal_holding = [];

      drain_internal();
    }
  }

  function internal_message(str, received_error) {
    let message;
    let error;

    try {
      message = JSON.stringify(str);
    } catch (ignore) {
      message = `${str}`;
    }

    try {
      error = JSON.stringify(received_error);
    } catch (ignore) {
      if (received_error) {
        if (received_error instanceof Error) {
          error = received_error.message || received_error.error;
        } else {
          error = received_error;
        }
      }
    }

    drain_internal({
      type: 'Internal',
      message,
      timestamp: Date.now(),
      error,
    });
  }

  function on_message(cb) {
    if (typeof cb !== 'function') {
      return internal_message('Could not set message handler', 'Message handler must be a function');
    }

    handler = cb;

    resolve_drained_internal();
  }

  function set_internal_pace(num) {
    if (typeof num !== 'number') {
      return internal_message('Could not set internal message pace', 'Message pace must be a number');
    }

    internal_message('Message pace for internal messaging set to ' + num);

    internal_pace = num;
  }

  // Attempt to set the handler if this interface was invoked with one; throw an error if it doesn't
  // work since logic would tell us that there's no way to send an internal message yet.
  if (handler) {
    if (typeof handler !== 'function') {
      throw new Error('Could not initialize internal_messager with passed argument: Function required');
    }

    on_message(handler);
  }

  return Object.freeze({
    on_message,
    internal_message,
    set_internal_pace,
    drain_internal,
  });
}

module.exports = internal_messager;
