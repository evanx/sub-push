const assert = require('assert');
const lodash = require('lodash');
const Promise = require('bluebird');

const envName = process.env.NODE_ENV || 'production';
const config = ['subscribeChannel', 'pushQueue', 'trimLength'].reduce((config, key) => {
    assert(process.env[key], key);
    config[key] = process.env[key];
    return config;
}, {});
const state = {};
const redis = require('redis');
const client = Promise.promisifyAll(redis.createClient());
const sub = redis.createClient();

assert(process.env.NODE_ENV);

async function multiExecAsync(client, multiFunction) {
    const multi = client.multi();
    multiFunction(multi);
    return Promise.promisify(multi.exec).call(multi);
}

async function start() {
    state.started = Math.floor(Date.now()/1000);
    state.pid = process.pid;
    console.log('start', {config, state});
    if (process.env.NODE_ENV === 'development') {
        return startDevelopment();
    } else if (process.env.NODE_ENV === 'test') {
        return startTest();
    } else {
        return startProduction();
    }
}

async function startTest() {
    return startProduction();
}

async function startDevelopment() {
    return startProduction();
}

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

async function end() {
    client.quit();
}

start().then(() => {
}).catch(err => {
    console.log(err);
    end();
}).finally(() => {
});
