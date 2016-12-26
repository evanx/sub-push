const assert = require('assert');
const lodash = require('lodash');
const Promise = require('bluebird');

const envName = process.env.NODE_ENV || 'production';
const envKeys = ['subscribeChannel', 'pushQueue', 'trimLength'];
const config = {};
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
    const missingProps = lodash.compact(envKeys.map(key => {
        if (process.env[key]) {
            config[key] = process.env[key];
        } else {
            return key;
        }
    }));
    if (missingProps.length) {
        throw new Error('Missing required config properties: ' + missingProps.join(', '));
    }
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
    return sub.subscribe(config.subscribeChannel);
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