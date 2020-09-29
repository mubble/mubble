# Mubble Library

## Version Changes

#### apocalypse

+ Protocol **'v2'** was implemented which included **https based server to server protocol** for communication from third party entities, and **wss based client / server to server protocol** for communication between our app and app server and also between our own servers.

+ _**ClientIdentity**_ deprecated. The old _**ConnectionInfo**_ is now divided into _**ConnectionInfo**_ and _**SessionInfo**_. _**ConnectionInfo**_ will only contain information related to the client-server connection and _**SessionInfo**_ will contain session information while the client is in session.

## Upcoming
+ SMS verification service.
