function async_battery() {
  return new Promise(function (resolve) {
    if (window && window.navigator && typeof window.navigator.getBattery === 'function') {
      window.navigator.getBattery().then(function (battery) {
        resolve(native_battery(battery));
      });
    } else {
      resolve(native_battery());
    }
  });
}

function native_battery(battery) {
  const metrics = {
    battery_available: {
      get_name: function () { return 'battery_available'; },
      get_value: function () { return !!battery ? 1 : 0; },
    },
    percentage: {
      get_name: function () { return 'percentage'; },
      get_value: get_percentage,
    },
    battery_charging: {
      get_name: function () { return 'battery_charging'; },
      get_value: function () { return battery && battery.charging ? 1 : 0 },
    },
  };

  function get_name() { return 'battery'; }
  function get_metrics() { return metrics; }

  function get_percentage() {
    return battery ? battery.level : 0;
  }

  return {
    get_metrics,
    get_name,
    get_percentage,
  };
}

export default async_battery;
