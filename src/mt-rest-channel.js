const http = require('http');
const https = require('https');
const crypto = require('crypto');
const request = require('request');
const stream = require('stream');
const internal_messager = require('./internal-message.js');

function major_tom_files_channel(passed_host, passed_token) {
  let files_table = {};
  let host;
  let token;
  let { internal_message, on_message, set_internal_pace } = internal_messager();
  let on_download_cb = internal_message;
  let on_download_failed_cb = internal_message;
  let on_upload_failed_cb = internal_message;
  let on_upload_cb = internal_message;

  function set_files_url(url, opt_token) {
    host = url;
    token = opt_token;
  }

  function set_gateway_token(new_token) {
    token = new_token;
  }

  function download_file_from_mt(download_path) {
    let node_request;

    function get(dest) {
      node_request.get(dest, {
        headers: {
          'X-Gateway-Token': token,
        },
      }, function download_cb(res) {
        if (res.statusCode >= 400) {
          on_download_failed_cb(
            new Error(
              `Request to ${major_tom_url.href} failed: status ${res.statusCode} ${res.statusMessage}`.trim()
            )
          );
        }

        if (res.headers.location && res.headers.location !== dest) {
          // We need to follow Major Tom's redirects.
          return get(res.headers.location);
        }

        res.on('data', function(data_chunk) {
          on_download_cb(data_chunk);
        });

        res.on('end', function() {
          on_download_cb(undefined, true);
        });

        res.on('error', function (read_error) {
          on_download_failed_cb(new Error(read_error));
        });
      }).on('error', function http_error(err) {
        on_download_failed_cb(new Error(`Network Error: ${err}`));
      });
    }

    if (!host || !token) {
      on_download_failed_cb('Method download_file_from_mt cannot execute without a host and gateway token');
    }

    if (typeof download_path !== 'string') {
      on_download_failed_cb('Method download_file_from_mt requires a string');
    }

    if (download_path[0] !== '/') {
      download_path = `/${download_path}`;
    }

    const major_tom_url = new URL(download_path, host);

    node_request = major_tom_url.protocol === 'https:' ? https : http;

    get(major_tom_url.href);
  }

  /**
   * This method sets the channel handlers for the download_file_from_mt process.
   * @param {Function} success The handler for receiving partial data from a file download from MT.
   * @param {Function} [failure] The error handler if downloading a file from MT goes wrong.
   */
  function handle_file_download(success, failure) {
    if (typeof success !== 'function') {
      throw new Error('Method handle_file_download requires at least one callback function');
    }

    if (['function', 'undefined'].indexOf(typeof failure) === -1) {
      throw new Error(
        'Method handle_file_download second argument must be a callback function'
      );
    }

    if (success.length !== 2) {
      throw new Error(
        'Handler for file download should take two parameters; see docs for details'
      );
    }

    on_download_failed_cb = failure || success;
    on_download_cb = success;
  }

  function upload_file_to_mt(File, file_name, system_name) {
    function make_third_request() {
      var url = new URL('/gateway_api/v1.0/downlinked_files', host);

      request({
        uri: url.href,
        method: 'post',
        headers: {
          'X-Gateway-Token': token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: file_name,
          system: system_name,
          signed_id,
          timestamp,
          command_id: null,
        }),
      }, function third_request_callback(error, response, body) {
        if (error) {
          on_upload_failed_cb(error);
          return;
        }

        try {
          const response_body = JSON.parse(body);

          on_upload_cb(response_body);
        } catch (e) {
          on_upload_failed_cb(e);
        }
      });
    }

    function make_second_request() {
      const direct_upload_vals = first_response.direct_upload || {};
      const headers = direct_upload_vals.headers || {};
      const content_type = headers['Content-Type'];
      const content_md5 = headers['Content-MD5'];
      const upload_url = direct_upload_vals.url;

      request({
          uri: upload_url,
          method: 'put',
          body: File,
          headers: {
            'Content-Type': content_type,
            'Content-MD5': checksum,
          },
        }, function second_request_cb(error, response, body) {
          if (error || response.statusCode >= 400) {
            on_upload_failed_cb(error || `Response status ${response.statusCode}`);
            return;
          }

          make_third_request();
        });
    }

    function make_first_request() {
      request({
        uri: new URL('/rails/active_storage/direct_uploads', host).href,
        method: 'post',
        body: JSON.stringify({
          content_type: 'binary/octet-stream',
          filename: file_name,
          byte_size,
          checksum,
        }),
        headers: {
          'X-Gateway-Token': token,
          'Content-Type': 'application/json',
        },
      }, function (error, response, body) {
        if (error) {
          on_upload_failed_cb(error);
          return;
        }

        if (body) {
          try {
            first_response = JSON.parse(body);
            signed_id = first_response.signed_id;

            make_second_request();
          } catch (err) {
            on_upload_failed_cb(err);
          }
        }
      });
    }

    function calculate_checksum() {
      const checksum_calculator = new stream.Readable();

      // This is a little dance to hash the file as a stream:
      checksum_calculator._read = function() { return false; };
      checksum_calculator.push(File);
      checksum_calculator.push(null);

      checksum_calculator.on('data', function(file_chunk) {
        hashing.update(file_chunk, 'utf8');
      });

      checksum_calculator.on('end', function() {
        checksum = hashing.digest('base64');

        // Make the first request once the checksum has been calculated:
        make_first_request();
      });
    }

    const byte_size = File.byteLength;
    const hashing = crypto.createHash('md5');
    const timestamp = Date.now();
    let first_response = {};
    let signed_id;
    let checksum;

    calculate_checksum();
  }

  function handle_file_upload(success, failure) {
    if (typeof success !== 'function') {
      throw new Error('Method handle_file_upload requires at least one callback function');
    }

    if (['function', 'undefined'].indexOf(typeof failure) === -1) {
      throw new Error(
        'Method handle_file_upload second argument must be a callback function'
      );
    }

    if (success.length !== 2) {
      throw new Error(
        'Handler for file download should take two parameters; see docs for details'
      );
    }

    on_upload_failed_cb = failure || success;
    on_upload_cb = success;
  }

  set_files_url(passed_host, passed_token);

  return {
    download_file_from_mt,
    handle_file_download,
    on_message,
    set_files_url,
    set_gateway_token,
    set_internal_pace,
    upload_file_to_mt,
    handle_file_upload,
  };
}

module.exports = major_tom_files_channel;
