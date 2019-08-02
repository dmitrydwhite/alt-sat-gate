# wip-mt-node-gateway-lib
```
This is a flat structure for now, but it should look something like this:

📁mt-node-gateway
┣ index.js
┣ 📁src
┃ ┗ internal-message.js
┃ ┗ mt-rest-channel.js
┃ ┗ mt-system-channel.js
┃ ┗ mt-ws-channel.js
┗ 📁examples
  ┗ example-app.js  // This app can run in a node instance
  ┗ temp-server.js  // This server is a very rudimentary UI
```

This app modularizes three gateway functions: communicating with major tom over a WebSocket connection, communicating with major tom over a REST connection, and communicating with Systems over a WebSocket connection.

Those three functionalities are exposed and accessed in `index.js`.

`example-app.js` is an example implementation of using the library with a bare bones node interface.

`temp-server.js` allows you to run a localhost server that allows a user to take some rudimentary actions.  It's built on top of `example-app.js`, but it probably could just talk to `index.js` directly too.
