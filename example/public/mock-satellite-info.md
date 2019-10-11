# How To Use Your Mock Satellite

## A couple things to know up front

* Your mock satellite exists as long as your browser session exists. This means that if you refresh your satellite's page, even though you'll still see its name and old messages, the state of all the mock systems (including the uptime) will go back to the start.
* The "systems" on your mock satellite are a combination of real data from your computer and mock data stored in browser memory. Real data has a black icon, mock data has a white one.
* Your mock satellite comes with a set of command definitions that it knows how to execute. The first time it connects to Major Tom through the example gateway, it will send Major Tom the information about the commands it knows. Obviously, you can change the command definitions through the Major Tom UI, but if you do then your mock satellite may not understand what to do with them anymore.

## Let's get started!

