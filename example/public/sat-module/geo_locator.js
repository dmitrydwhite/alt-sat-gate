function async_locator() {
  function geo_locator() {
    const metrics = {
      locator_accuracy: {
        get_name: function() { return 'locator_accuracy'; },
        get_value: function() { return accuracy; },
      },
      locator_available: {
        get_name: function() { return 'locator_available'; },
        get_value: function() { return is_watching; },
      },
      locator_latitude: {
        get_name: function() { return 'locator_latitude'; },
        get_value: function() { return latitude; }
      },
      locator_longitude: {
        get_name: function() { return 'locator_longitude'; },
        get_value: function() { return longitude; },
      },
    };

    function get_name() { return 'geo_locator'; }
    function get_metrics() { return metrics; }

    function get_location() {
      return {
        position: `${latitude}, ${longitude}`,
        latitude,
        longitude,
      };
    }

    return {
      get_name,
      get_metrics,
      get_location,
    };
  }

  function on_position_update(new_position) {
    const coords = new_position.coords || {};

    latitude = coords.latitude || 0;
    longitude = coords.longitude || 0;
    accuracy = coords.accuracy || 0;
  }

  function cancel_watching() {
    is_watching = 0;
  }

  let accuracy = 0;
  let latitude = 0;
  let longitude = 0;
  let is_watching = 0;

  return new Promise(function (resolve) {
    if (
      window &&
      window.navigator &&
      window.navigator.geolocation &&
      typeof window.navigator.geolocation.watchPosition === 'function'
    ) {
      is_watching = 1;

      window.navigator.geolocation.watchPosition(
        on_position_update,
        cancel_watching
      );

      resolve(geo_locator());
    } else {
      resolve(geo_locator());
    }
  });
}

export default async_locator;
