function camera_controls({ stream, on_capture }) {
  const doc_body = document.getElementsByTagName('body')[0];
  const wrapper = document.createElement('div');
  const video = document.createElement('video');
  const button_row = document.createElement('div');

  function close_cam() {
    stream.getTracks()[0].stop();

    video.remove();
    button_row.remove();
    wrapper.remove();
  }

  function capture() {
    const canvas = document.createElement('canvas');
    const video = document.getElementById('video_display');
    let image_buf;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    canvas
      .getContext('2d')
      .drawImage(video, 0, 0);

    const data_url = canvas.toDataURL('image/png');
    const bare_data = data_url.slice(data_url.indexOf(',') + 1);
    const raw_data = atob(bare_data);
    const data_length = raw_data.length;
    const capture_buffer = new Uint8Array(data_length);

    for (let i = 0; i < data_length; i += 1) {
      capture_buffer[i] = raw_data.charCodeAt(i);
    }

    close_cam();
    on_capture(capture_buffer);
  }

  [{ text: 'Capture', handler: capture }, { text: 'Cancel', handler: close_cam }]
    .forEach(function(btn) {
      const control = document.createElement('button');

      control.innerHTML = btn.text;
      control.addEventListener('click', btn.handler);

      button_row.appendChild(control);
    });

  button_row.id = 'video-buttons-row';

  video.id = 'video_display';
  video.style.width = '100%';
  video.style.height = 'auto';
  video.srcObject = stream;
  video.autoplay = true;

  wrapper.id = 'video-wrapper';

  wrapper.appendChild(video);
  wrapper.appendChild(button_row);
  doc_body.appendChild(wrapper);
}

export default camera_controls;
