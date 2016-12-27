# sub-push

A microservice to subscribe to a Redis pubsub channel, and push to a Redis list (queue).

The essence of the implementation is as follows:
```javascript
async function startProduction() {
    sub.on('message', (channel, message) => {
        if (process.env.NODE_ENV !== 'production') {
            console.log({channel, message});
        }
        multiExecAsync(client, multi => {
            multi.lpush(config.pushQueue, message);
            multi.ltrim(config.pushQueue, 0, config.trimLength);
        });
    });
    sub.subscribe(config.subscribeChannel);
}
```
where `config` is populated from environment variables as follows:
```javascript
const config = ['subscribeChannel', 'pushQueue', 'trimLength'].reduce((config, key) => {
    assert(process.env[key], `env.${key}`);
    config[key] = process.env[key];    
    return config;
}, {});
```

For example the following command line runs this service to subscribe to channel `logger:test` and push messages to a similarly named list.
```shell
trimLength=99 subscribeChannel=logger:test pushQueue=logger:test npm start
```
where `trimLength` ensures the list is continually trimmed for safety purposes.

## Sample use case

This service is intended for a personal requirement to subscribe to logging messages published via Redis.
```
redis-cli psubscribe 'logger:*'
```
These are arrays published via pubsub.
```
redis-cli publish 'logger:mylogger' '["info", "service started"]'
```
However it would suit me to `brpop` from a list using `redis-cli` in order to pipe those messages into a JSON formatter. That didn't work with `redis-cli psubscribe` in my terminal.

Then in order to "subscribe" to JSON logging messages and format these in a console, we can use
the following command line:
```shell
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
```json
[
  "error",
  [
    "ReferenceError: queue is not defined",
    "    at /home/evans/phantomjs-redis/build/index.js:57:59",
    "    at Generator.next (<anonymous>)",
    "    at step (/home/evans/phantomjs-redis/build/index.js:119:191)",
    "    at /home/evans/phantomjs-redis/build/index.js:119:437"
  ]
]
```
where the first item `"error"` is the logger `level` which indicates this was logged via `logger.error()`
