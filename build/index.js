let multiExecAsync = (() => {
    var _ref = _asyncToGenerator(function* (client, multiFunction) {
        const multi = client.multi();
        multiFunction(multi);
        return Promise.promisify(multi.exec).call(multi);
    });

    return function multiExecAsync(_x, _x2) {
        return _ref.apply(this, arguments);
    };
})();

let delay = (() => {
    var _ref2 = _asyncToGenerator(function* (duration) {
        logger.debug('delay', duration);
        return new Promise(function (resolve) {
            return setTimeout(resolve, duration);
        });
    });

    return function delay(_x3) {
        return _ref2.apply(this, arguments);
    };
})();

let start = (() => {
    var _ref3 = _asyncToGenerator(function* () {
        state.started = Math.floor(Date.now() / 1000);
        state.pid = process.pid;
        state.instanceId = yield client.incrAsync(`${ config.namespace }:instance:seq`);
        logger.info('start', { config, state });
        const instanceKey = `${ config.namespace }:instance:${ state.instanceId }:h`;
        yield multiExecAsync(client, function (multi) {
            ['started', 'pid'].forEach(function (property) {
                multi.hset(instanceKey, property, state[property]);
            });
            multi.expire(instanceKey, config.processExpire);
        });
        if (process.env.NODE_ENV === 'development') {
            yield startDevelopment();
        } else if (process.env.NODE_ENV === 'test') {
            return startTest();
        } else {}
        return end();
    });

    return function start() {
        return _ref3.apply(this, arguments);
    };
})();

let startTest = (() => {
    var _ref4 = _asyncToGenerator(function* () {});

    return function startTest() {
        return _ref4.apply(this, arguments);
    };
})();

let startDevelopment = (() => {
    var _ref5 = _asyncToGenerator(function* () {});

    return function startDevelopment() {
        return _ref5.apply(this, arguments);
    };
})();

let end = (() => {
    var _ref6 = _asyncToGenerator(function* () {
        client.quit();
    });

    return function end() {
        return _ref6.apply(this, arguments);
    };
})();

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

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

start().then(() => {}).catch(err => {
    console.log(err);
    end();
}).finally(() => {});
