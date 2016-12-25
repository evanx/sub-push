# sub-push

A microservice to subscribe to a Redis pubsub channel, and push to a Redis list (queue).

Intended for requirement I have to subscribe to logging messages which are published via pubsub. However it would suit me to `brpop` from a list using `redis-cli` in order to pipe those messages into a JSON formatter.
