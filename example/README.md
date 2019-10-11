# temp-server.js

This is a small app designed to demonstrate how the Major Tom gateway library can be implemented in a JavaScript app.

### To Run `temp-server.js` Locally

```sh
$ git clone <this repo>
$ cd ./wip-mt-node-gateway-lib/
$ npm install
$ cd example
$ npm install
$ npm start
```

This will start the localhost web server running.

### To Interact with `temp-server.js`

* navigate to [`http://localhost:8080/`](http://localhost:8080)

If you get a 200 response that says `App Listening` then the app is running.

However, it hasn't connected to Major Tom yet.

* connect to a Major Tom instance by navigating to a url with this pattern:

[`http://localhost:8080/connect?host=<your full major tom host, including protocol>&token=<your valid gateway token>`](http://localhost:8080/status)

* if your Major Tom instance is protected by Basic Auth, include the query param `&auth=true` in your url.  You'll be prompted to enter Basic Auth username and password in order to attempt a connection.

* After a moment or two, you'll be redirected to the `/status` path.  Here you'll either be shown `Connected` or `Not Connected`.  There will also be buttons to retry, check the status of, or disconnect from your connection.  (Right now this works smoothly because when the pathname is updated, the query params are not, so you'll go back to `/connect?<all your query params>`.  When in doubt, manipulate the url directly.)

* If you want to disconnect the gateway from the Major Tom instance, navigate to [`http://localhost:8080/disconnect`](http://localhost:8080/disconnect) or click the `disconnect` button.

### Connecting Systems

The gateway library does not solve the problem of handling connections to systems. There are too many unique variables around every mission's architecture to attempt a unified solution to that.  For the purposes of this example app, we have created a small package called `mt-systems-channel` that expects systems to connect to a WebSocket server. We've also included an html file that represents a satellite with a few subsystems and telemetry data points, but that is intended to be run in a web browser window.

### To Connect Systems to The Example App

To add a new system to your Major Tom mock mission, simply navigate to [`http://localhost:8080/satellite`](http://localhost:8080/satellite), where you'll see an interface with our mock system. All the code for this "satellite" is running in the browser's memory. To add another "satellite", you can simply open another tab at the same url in the same browser window.


