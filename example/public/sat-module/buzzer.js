function buzzer(available) {
  const metrics = {
    buzzer_available: {
      get_name: function() { return 'buzzer_available'; },
      get_value: function() { return available; },
    },
  };

  function buzz(pattern) {
    if (available) {
      window.navigator.vibrate(pattern);
    }
  }

  function get_name() { return 'buzzer'; }
  function get_metrics() { return metrics; }

  return {
    get_name,
    get_metrics,
    buzz,
  };
}

function async_buzzer() {
  return new Promise(function (resolve) {
    if (window && window.navigator && typeof window.navigator.vibrate === 'function') {
      resolve(buzzer(1));
    } else {
      resolve(buzzer(0));
    }
  });
}

export default async_buzzer;
