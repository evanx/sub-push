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
    assert(process.env[key], key);
    config[key] = process.env[key];    
    return config;
}, {});
```

For example the following command line runs this service to subscribe to channel `logger:test` and push messages to a similarly named list.
```shell
subscribeChannel=logger:test pushQueue=logger:test trimLength=99 npm start
```
where `trimLength` ensures the list is continually trimmed for production-safety, i.e. will not exceed a negligible limit of Redis memory usage.

## Sample use case

This service is intended for a personal requirement to subscribe to logging messages published via Redis.
These are arrays published via pubsub.
```
redis-cli publish 'logger:mylogger' '["info", "service started"]'
```
where we might subscribe in the terminal as follows:
```
redis-cli psubscribe 'logger:*'
```
However we wish to pipe the messages into a JSON formatter, and `redis-cli psubscribe` did not work for that requirement.

As a work-around we can use `redis-cli brpop` to pop messages from a list rather:
```shell
while /bin/true
do
  redis-cli brpop logger:test 4 | grep '^\[' | jq '.'
done
```
where we pipe to the `jq` command-line JSON formatter.

Note that we "grep" for our logging message JSON which is an array, so starts with a square bracket. This will exclude the line which is the list key e.g. `logger:test` also returned by `brpop` and also blank lines when the `4` seconds timeout expires and an empty line is output by `redis-cli brpop`

Alternatively `python -mjson.tool` as follows:
```  redis-cli brpop logger:phantomjs-redis 4 | grep '^\[' | python -mjson.tool 2>/dev/null
```
where we suppress error messages from `python -mjson.tool`

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

We plan to publish microservices that similarly subcribe, but with purpose-built rendering for logging messages e.g. error messages coloured red.

Watch
- https://github.com/evanx/sublog-console
- https://github.com/evanx/sublog-web
