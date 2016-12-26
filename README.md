# sub-push

A microservice to subscribe to a Redis pubsub channel, and push to a Redis list (queue).

## Sample use case

This service is intended for a personal requirement to subscribe to logging messages published via Redis.
These are arrays published via pubsub. However it would suit me to `brpop` from a list using `redis-cli` in order to pipe those messages into a JSON formatter. That didn't work with `redis-cli subscribe` in my terminal.

For example the following command line runs this service to subscribe to channel `logger:test` and push messages to a similarly named list.
```
trimLength=99 subscribeChannel=logger:test pushQueue=logger:test npm start
```
where `trimLength` ensures the list is continually trimmed for safety purposes.

Then in order to "subscribe" to JSON logging messages and format these in a console, we can use
the following command line:
```
while /bin/true ; do redis-cli brpop logger:test 4 | grep '^\[' | jq '.'; done
```
where we "grep" for our logging message JSON which is an array, so starts with a square bracket. This will exclude the line which is the list key e.g. `logger:test` also returned by `brpop`

We manually publish a test logging message as follows:
```
redis-cli publish logger:test '["info", {"name": "evanx"}]'
```
and see it formatted via `jq`
```json
[
  "info",
  {
    "name": "evanx"
  }
]
```
via `redis-cli brpop`


## Related

Incidently, some sample Node code for a client logger that publishes via Redis:
```javascript
const createRedisLogger = (client, loggerName) =>
['debug', 'info', 'warn', 'error'].reduce((logger, level) => {
    logger[level] = function() {
        if (!client || client.ended === true) { // Redis client ended
        } else if (level === 'debug' && process.env.NODE_ENV === 'production') {
        } else {
            const array = [].slice.call(arguments);
            const messageJson = JSON.stringify([
                level,
                ...array.map(item => {
                    if (lodash.isError(item)) {
                        return item.stack.split('\n').slice(0, 5);
                    } else {
                        return item;
                    }
                })
            ]);
            client.publish(['logger', loggerName].join(':'), messageJson);
        }
    };
    return logger;
}, {});
```
where logged errors are specially handled i.e. a slice of the `stack` is logged e.g.:
```
[
  "error",
  "ReferenceError: queue is not defined",
  "    at /home/evanx/phantomjs-redis/build/index.js:57:59",
  "    at Generator.next (<anonymous>)",
  "    at step (/home/evanx/phantomjs-redis/build/index.js:119:191)",
  "    at /home/evans/phantomjs-redis/build/index.js:119:437"
]
```
where the first element `error` is the logger `level` which indicates this was logged via `logger.error()`
