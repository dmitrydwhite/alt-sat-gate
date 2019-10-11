function async_system_clock() {
  return Promise.resolve(system_clock());
}

function system_clock() {
  const clock_start = Date.now();
  const metrics = {
    uptime: {
      get_name: function() { return 'system_uptime'; },
      get_value: get_uptime,
    },
  };

  function get_uptime() {
    return (Date.now() - clock_start) / 1000;
  }

  function get_name() { return 'system_clock'; }
  function get_metrics() { return metrics; }

  return {
    get_name,
    get_metrics,
    get_uptime,
  };
}

export default async_system_clock;
