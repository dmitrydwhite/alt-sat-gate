# mt-node-gateway-lib

This app modularizes the primary Major Tom gateway functions: communicating with Major Tom over a WebSocket connection and communicating with Major Tom over a REST connection.

### To Install

<!-- `npm install mt-node-gateway-lib` -->

in the shell
```sh
$ git clone <this repo>
$ npm install
```

in your app
```js
// My-Gateway-App.js
import mt_node_gateway from '../path/to/mt-node-gateway-lib/index.js';

const my_gateway = mt_node_gateway();
```

The WebSocket and REST connections to Major Tom are accessible through this library, along with some callback and event listeners.

### You Can Start a Major Tom Gateway Right from the Node REPL

(Before you start this, make sure you have created a mission in your Major Tom instance,
and then created a Gateway inside that mission. You'll need the Gateway token in
order to complete these steps.)

If you've never used the Node REPL before, it's simply an environment where you can
write JavaScript statements and get immediate feedback from them. To reach it, just
type in `node` on the command line in any terminal window, so long as Node is installed
on your computer and in your path.

```javascript
const new_gateway = require('../path/to/mt-node-gateway-lib/index.js');

const my_gateway = new_gateway();
// my_gateway is now an instance of Major Tom Node Gateway

// Now let's connect it to Major Tom, using the WebSocket path and the gateway token you can find
// in your Major Tom instance, on your gateway's page.
my_gateway.connect_to_mt('wss://you.majortom.cloud', '<your gateway token>');
// If your instance of you.majortom.cloud is protected by basic auth, pass
// username and password as the third and fourth args to connect_to_mt()

// This gateway is now connected to Major Tom. Tell it what to do when it receives a message from
// Major Tom by passing a function to .on_mt_message. We'll keep it simple and just log to console:
my_gateway.on_mt_message(console.log);

// You'll now likely see a couple messages: one marked "Internal Message" that is
// a sort of log message from your gateway. The other one is from Major Tom, saying
// "hello"!

// Now we can send a message to Major Tom
const first_message = {
  type: 'events',
  events: [{
    type: 'Greeting',
    message: 'Hello from the Node REPL',
  }]
};
// Convert the JavaScript object to a properly formatted JSON string
const first_message_string = JSON.stringify(first_message);

// The method .to_mt sends a string over WebSocket to your Major Tom gateway.
my_gateway.to_mt(first_message_string);

// Now if you check your Major Tom Events UI, you should see the message was
// received from this gateway.

// Let's upload a file from the file system to Major Tom.
// In order to do this, you need to have a system to associate with the file. Either take note of an
// existing system's name, or create a new one. We'll need this in a minute.
// For this exercise, we'll just use a file from the file system on our computer;
const fs = require('fs');
// If you're not familiar with fs, it's a module included in nodeJS that allows direct interface
// with the file system in a manner closely modeled around standard POSIX functions. We'll use its
// .readFileSync method to read the contents of a file into a node Buffer object.
const my_file_buffer = fs.readFileSync('path/to/my_file');

// This library expects the file as a Buffer, the file name (as a string) to
// display in the Major Tom UI, and the System name (a string) that this file is
// associated with:
my_gateway.upload_file_to_mt(my_file_buffer, 'My File', 'System_Name_Noted_Above');

// Now if you check your Major Tom Mission Files UI, you should see this file (named "My File")
// available for download to your machine.
```

### More Advanced Usage Examples

`example/example-app.js` is an example implementation of using the library with a bare bones node interface.

`example/temp-server.js` allows you to run a localhost server that allows a user to take some rudimentary actions.  It's built on top of `example/example-app.js`, but it probably could just talk to `index.js` directly too.

### Connecting to Systems

Every Mission may have unique archi
tecture; this library focuses solely on communication between your Gateway solution and Major Tom.  Connecting to systems could be done in various ways.  See the `📂examples` folder for one solution to connecting to a set of test systems.
