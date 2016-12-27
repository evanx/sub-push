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

For example the following command line runs this service to subscribe to channel `logger:mylogger` and push messages to a similarly named list.
```shell
subscribeChannel=logger:mylogger pushQueue=logger:mylogger trimLength=99 npm start
```
where `trimLength` ensures the list is continually trimmed for production-safety, i.e. will not exceed a negligible limit of Redis memory usage.

## Sample use case

This service is intended for a personal requirement to subscribe to logging messages published via Redis.
These are arrays published via pubsub.
```
redis-cli publish 'logger:mylogger' '["info", {"name": "evanx"}]'
```
where we might subscribe in the terminal as follows:
```
redis-cli psubscribe 'logger:*'
```
where we see the messages in the console as follows:
```
Reading messages... (press Ctrl-C to quit)
1) "psubscribe"
2) "logger:*"
3) (integer) 1
1) "pmessage"
2) "logger:*"
3) "logger:mylogger"
4) "[\"info\", {\"name\": \"evanx\"}]"
```
However we want to pipe to a command-line JSON formatter to enjoy a more readable rendering:
```json
[
  "info",
  {
    "name": "evanx"
  }
]
```

We found that `redis-cli psubscribe` didn't suit that use case. So we wish to use `redis-cli brpop` to pop messages from a list rather:
```shell
while /bin/true
do
  redis-cli brpop logger:mylogger 4 | grep '^\[' | jq '.'
done
```
where we "grep" for our logging message JSON which is an array, so starts with a square bracket. This will exclude the line which is the list key e.g. `logger:mylogger` also returned by `brpop` and also blank lines when the `4` seconds timeout expires and an empty line is output by `redis-cli brpop`

Indeed, this `sub-push` service was created to enable the above work-around, i.e. to switch messages from a channel to a list, so we can `brpop` and pipe to `jq`

Alternatively `python -mjson.tool` as follows:
```shell
   redis-cli brpop logger:mylogger 4 | grep '^\[' | python -mjson.tool 2>/dev/null
```
where we suppress error messages from `python -mjson.tool`

Alternatively we might append the JSON log messages to a file:
```shell
  redis-cli brpop logger:mylogger 4 | grep '^\[' >> /tmp/mylogger.log
```

Then we might format the tail into JSON, and serve that file statically to view in our browser using a JSON formatter extension.
```shell
  (
      echo '['
      cat /tmp/mylogger.log | tail -9 | tac | sed 's/$/,/'
      cat /tmp/mylogger.log | tail -10 | head -1
      echo ']'
  ) | jq '.' > /tmp/mylogger.json
```

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
