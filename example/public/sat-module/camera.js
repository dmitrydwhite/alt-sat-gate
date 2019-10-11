function async_camera() {
  return new Promise(function(resolve) {
    try {
      if (
        window &&
        window.navigator &&
        window.navigator.mediaDevices &&
        typeof window.navigator.mediaDevices.getUserMedia === 'function'
      ) {
        resolve(camera(window.navigator.mediaDevices.getUserMedia));
      } else {
        resolve(camera());
      }
    } catch (e) {
      resolve(camera());
    }
  });
}

function camera(requestor) {
  const metrics = {
    camera_available: {
      get_name: function() { return 'camera_available'; },
      get_value: get_is_available,
    }
  };

  function get_name() { return 'camera'; }
  function get_metrics() { return metrics; }
  function get_is_available() { return !!requestor ? 1 : 0; }

  return {
    get_name,
    get_metrics,
    get_is_available,
  };
}

export default async_camera;
