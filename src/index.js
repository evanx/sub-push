const assert = require('assert');
const lodash = require('lodash');
const Promise = require('bluebird');

const envName = process.env.NODE_ENV || 'production';
const config = require(process.env.configFile || '../config/' + envName);
const state = {};
const redis = require('redis');
const client = Promise.promisifyAll(redis.createClient());

class Counter {
    constructor() {
        this.count = 0;
    }
}

class TimestampedCounter {
    constructor() {
        this.timestamp = Date.now();
        this.count = 0;
    }
}

async function multiExecAsync(client, multiFunction) {
    const multi = client.multi();
    multiFunction(multi);
    return Promise.promisify(multi.exec).call(multi);
}

async function delay(duration) {
    logger.debug('delay', duration);
    return new Promise(resolve => setTimeout(resolve, duration));
}

async function start() {
    state.started = Math.floor(Date.now()/1000);
    state.pid = process.pid;
    state.instanceId = await client.incrAsync(`${config.namespace}:instance:seq`);
    logger.info('start', {config, state});
    const instanceKey = `${config.namespace}:instance:${state.instanceId}:h`;
    await multiExecAsync(client, multi => {
        ['started', 'pid'].forEach(property => {
            multi.hset(instanceKey, property, state[property]);
        });
        multi.expire(instanceKey, config.processExpire);
    });
    if (process.env.NODE_ENV === 'development') {
        await startDevelopment();
    } else if (process.env.NODE_ENV === 'test') {
        return startTest();
    } else {
    }
    return end();
}

async function startTest() {
}

async function startDevelopment() {
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
