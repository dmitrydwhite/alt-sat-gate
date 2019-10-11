import mount_antenna from './connection_antenna.js';
import mount_battery from './native_battery.js';
import mount_buzzer from './buzzer.js';
import mount_camera from './camera.js';
import mount_clock from './system_clock.js';
import mount_locator from './geo_locator.js';
import mount_mock_battery from './battery.js';
import mount_mock_solar_panel from './solar_panel.js';
import mount_mock_radio from './radio.js';

function asnyc_make_hardware_bus(mock_systems) {
  if (mock_systems === 'mock') {
    return new Promise(function (resolve) {
      Promise.all([mount_clock(), mount_antenna(), mount_battery(), mount_camera()]).then(function (async_mock_hardware) {
        const [clock, antenna, battery, camera] = async_mock_hardware;

        const solar_panel = mount_mock_solar_panel();
        
        resolve({
          antenna,
          battery,
          camera,
          clock,
          radio: mount_mock_radio(),
          solar_panel,
        });
      });
    });
  }

  return new Promise(function (resolve) {
    Promise.all([
      mount_antenna(),
      mount_battery(),
      mount_buzzer(),
      mount_camera(),
      mount_clock(),
      mount_locator(),
    ]).then(function(hardware) {
      const [antenna, battery, buzzer, camera, clock, locator] = hardware;

      resolve({
        antenna,
        battery,
        buzzer,
        camera,
        clock,
        locator,
      });
    });
  });
}

export default asnyc_make_hardware_bus;
