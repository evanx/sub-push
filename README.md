# sub-push

A microservice to subscribe to a Redis pubsub channel, and push to a Redis list (queue).

Intended for requirement I have to subscribe to logging messages which are arrays published via pubsub. However it would suit me to `brpop` from a list using `redis-cli` in order to pipe those messages into a JSON formatter.

For example the following command line runs the service to subscribe to channel `log:test` and push messages to a similarly named list.
```
trimLength=99 subscribeChannel=log:test pushQueue=log:test npm start
```
where `trimLength` ensures the list is continually trimmed for safety purposes.

Then `redis-cli brpop` and pipe to `jq` for JSON formatting:
```
while [ 1 ] ; do redis-cli brpop log:test 4 | grep '^\[' | jq '.'; done
```
where we "grep" for our logging message JSON which is an array, so starts with a square bracket. This will exclude the line which is the list key e.g. `log:test` also returned by `brpop`

Manually publishing a test logging message:
```
redis-cli publish log:test '["info", {"name": "evanx"}]'
```
where we see:
```json
[
  "info",
  {
    "name": "evanx"
  }
]```

Sample Node code for a client logger that publishes via Redis:
```javascript
const loggerName = 'mylogger';
const logger = ['debug', 'info', 'warn', 'error'].reduce((logger, level) => {
    logger[level] = function() {
        if (!client || client.ended === true) { // Redis client
        } else if (level === 'debug' && !process.env.NODE_ENV) { // safety in production when not set
        } else if (level === 'debug' && process.env.NODE_ENV === 'production') {
        } else {
            const array = [].slice.call(arguments);
            const messageJson = JSON.stringify(lodash.flatten([
                level,
                ...array.map(item => {
                    if (lodash.isError(item)) {
                        return item.stack.split('\n').slice(0, 5);
                    } else {
                        return item;
                    }
                })
            ]));
            client.publish(['logger', loggerName].join(':'), messageJson);
        }
    };
    return a;
}, {});
```
where logged errors are specially handled.
