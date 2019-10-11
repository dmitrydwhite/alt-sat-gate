function radio() {
  const bands = {
    C: [3.7, 6.425],
    Ku: [10.7, 18.1],
    Ka: [18, 31],
    EHF: [30, 300],
    V: [36, 51.4],
  };

  const metrics = {
    available_bands: {
      get_name: function() { return 'radio_available_bands'; },
      get_value: function() {
        const all_bands = get_available_bands();
        const bands_str = all_bands.join(' ');
        
        return bands_str.split('').reduce(function(accum, curr) {
          const next = curr.charCodeAt();
          const next_char = next < 100 ? `0${next}` : `${next}`;

          return `${accum}${next_char}`;
        }, '');
      },
    },
    band: {
      get_name: function() { return 'radio_band'; },
      get_value: function() { return current_band || 0; },
    },
    frequency: {
      get_name: function() { return 'radio_frequency'; },
      get_value: function() { return frequency || 0; }
    },
    status: {
      get_name: function() { return 'radio_status'; },
      get_value: function() { return is_on ? 1 : 0; }
    },
  };

  let current_band;
  let frequency = 0;
  let is_on = false;

  function get_frequency() { return frequency; }
  function get_metrics() { return metrics }
  function get_name() { return 'radio'; }

  function get_available_bands() {
    return Object.keys(bands);
  }

  function set_band(band) {
    if (!is_on) is_on = true;

    if (Object.keys(bands).indexOf(band) !== -1) {
      current_band = band;
    } else {
      throw new Error(`Band ${band} not available`);
    }
  }

  function tune(freq) {
    if (!is_on) {
      throw new Error('Cannot tune radio when radio is OFF');
    }

    if (!current_band) {
      throw new Error('Cannot tune radio when not set to a band');
    }

    const range = bands[current_band];

    if (!range) {
      throw new Error('Radio is not properly set to a recognized band');
    }

    if (Number(freq) >= range[0] && Number(freq) <= range[1]) {
      frequency = freq;
    } else {
      throw new Error(`Frequency ${freq} is out of the range of ${current_band} band`);
    }
  }

  function turn_on() { is_on = true; }
  function turn_off() {
    is_on = false;
    current_band = undefined;
    frequency = undefined;
  }

  return {
    get_available_bands,
    get_metrics,
    get_name,
    get_frequency,
    set_band,
    tune,
    turn_on,
    turn_off,
  };
}

export default radio;
