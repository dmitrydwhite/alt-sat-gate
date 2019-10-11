function get_random (low, hi) {
  return hi > low &&
    Math.floor(Math.random() * (hi - low + 1)) + (low || 0) || 0;
};

function cooling(min) {
  return ((min - 45) * 50) + (get_random(0, 5) * get_random(-1, 1)); 
}

function heating(min) {
  return (min * 50) + (get_random(0, 5) * get_random(-1, 1));
}

function generate_panel_temp() {
  // High value is 500
  // It takes from 0 - 10 minutes to get there
  // It stays there from 10 - 45
  // It then cools from 45 - 55 back down to 0
  
  const minute = Math.floor(((Date.now() % 5400000) / 1000) / 60);

  if (minute > 55) return 0;

  if (minute > 45) return cooling(minute);

  if (minute < 10) return heating(minute);

  return 500;
}

function solar_panel() {
  const metrics = {
    deployed: {
      get_name: function() { return 'deployed'; },
      get_value: get_is_deployed,
    },
    actuating: {
      get_name: function() { return 'actuating'; },
      get_value: function() { return (stowing && 2) || (deploying && 1) || 0; },
    },
    temperature: {
      get_name: function() { return 'temperature'; },
      get_value: get_temperature,
    },
  };

  let is_deployed = false;
  let deploying = 0;
  let stowing = 0;
  let temperature = 0;

  function deploy() {
    const this_attempt = get_random(30, 92);

    deploying = 1;

    const deploy_interval = setInterval(function() {
      if (deploying >= this_attempt) {
        is_deployed = true;
        deploying = 0;
        clearInterval(deploy_interval);
        
        return;
      }

      deploying += 1;
    }, 1000);
  }

  function stow() {
    deploying = get_random(30, 92);

    const stow_interval = setInterval(function() {
      if (deploying <= 0) {
        is_deployed = false;
        deploying = 0;
        clearInterval(stow_interval);

        return;
      }

      deploying -= 1;
    }, 1000);
  }

  function get_is_deployed() {
    return is_deployed ? 1 : 0;
  }

  function get_temperature() {
    if (!is_deployed || deploying) {
      return 0;
    }

    return generate_panel_temp();
  }

  function get_metrics() {
    return metrics;
  }

  function get_name() {
    return 'solar_panel';
  }

  return {
    deploy,
    get_is_deployed,
    get_metrics,
    get_name,
    get_temperature,
    stow,
  };
}

export default solar_panel;
