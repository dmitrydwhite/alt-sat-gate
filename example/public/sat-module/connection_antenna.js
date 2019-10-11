function async_antenna() {
  return new Promise(function(resolve) {
    if (window && window.navigator && typeof window.navigator.connection === 'object') {
      resolve(network_antenna(window.navigator.connection));
    } else {
      resolve(network_antenna());
    }
  });
}

function network_antenna(cx) {
  const metrics = {
    downlink: {
      get_name: function() { return 'connection_downlink'; },
      get_value: function() { return cx ? cx.downlink : 0; },
    },
    effective: {
      get_name: function() { return 'connection_effective_type'; },
      get_value: function() {
        return cx ? parseInt(cx.effectiveType) : 0;
      },
    },
    rtt: {
      get_name: function() { return 'connection_rtt'; },
      get_value: function() {
        return cx ? cx.rtt : 0;
      },
    },
  };

  function get_name() { return 'connection_antenna'; }
  function get_metrics() { return metrics; }

  return {
    get_name,
    get_metrics,
  };
}

export default async_antenna;
