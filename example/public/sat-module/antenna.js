function get_random (low, hi) {
  return hi > low &&
    Math.floor(Math.random() * (hi - low + 1)) + (low || 0) || 0;
};


function antenna() {
  const metrics = {
    rf_lock: {
      get_name: function() { return 'rf_lock'; },
      get_value: get_locked,
    },
    rf_acquiring: {
      get_name: function() { return 'rf_acquiring'; },
      get_value: get_acquiring,
    }
  };

  let is_locked = false;
  let acquiring = 0;

  function start_drifting() {
    const drift_timeout = setTimeout(function () {
      is_locked = false;
      clearTimeout(drift_timeout);
    }, 45 * 60 * 1000);
  }

  function establish_rf_lock() {
    const this_attempt = get_random(7, 61);

    acquiring = 1;

    const acquire_interval = setInterval(function() {
      if (acquiring >= this_attempt) {
        is_locked = true;
        acquiring = 0;
        clearInterval(acquire_interval);
        start_drifting();

        return;
      }

      acquiring += 1;
    }, 1000);
  }

  function get_locked() {
    return is_locked && !acquiring ? 1 : 0;
  }

  function get_acquiring() {
    return acquiring;
  }

  function get_metrics() {
    return metrics;
  }

  function get_name() { return 'antenna'; }

  return {
    get_name,
    get_metrics,
    get_locked,
    get_acquiring,
    establish_rf_lock,
  };
}

export default antenna;