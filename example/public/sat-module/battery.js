function get_random (low, hi) {
  return hi > low &&
    Math.floor(Math.random() * (hi - low + 1)) + (low || 0) || 0;
};

function battery(solar_panel) {
  const metrics = {
    temperature: {
      get_name: function() { return 'temperature' },
      get_value: get_temperature,
    },
    voltage: {
      get_name: function() { return 'voltage' },
      get_value: get_voltage,
    },
  };

  function generate_battery_voltage() {
    if (solar_panel.get_is_deployed()) {
      const minute = Math.floor(((Date.now() % 5400000) / 1000) / 60);

      if (minute > 55) {
        return (4.5 - (30 * 0.14)) + (get_random(0, 0.25) * get_random(-1, 1));
      }

      if (minute > 45) {
        return (5 - ((55 - minute) * 0.05)) + (get_random(0, 0.25) * get_random(-1, 1)); 
      }

      if (minute < 25) {
        return (minute * 0.2) + (get_random(0, 0.1) * get_random(-1, 1));
      }

      return 5 + (get_random(0, 0.5) * get_random(-1, 1));
    } else {
      return 0.1;
    }
  }

  function generate_battery_temperature() {
    return (generate_battery_voltage() * 5) + (get_random(0, 2) * get_random(-1, 1));
  }

  function get_metrics() {
    return metrics;
  }

  function get_temperature() {
    return generate_battery_temperature();
  }

  function get_voltage() {
    return generate_battery_voltage();
  }

  function get_name() { return 'battery'; }

  return {
    get_metrics,
    get_name,
    get_temperature,
    get_voltage,
  };
}

export default battery;