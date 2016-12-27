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

let start = (() => {
    var _ref2 = _asyncToGenerator(function* () {
        state.started = Math.floor(Date.now() / 1000);
        state.pid = process.pid;
        console.log('start', { config, state });
        if (process.env.NODE_ENV === 'development') {
            return startDevelopment();
        } else if (process.env.NODE_ENV === 'test') {
            return startTest();
        } else {
            return startProduction();
        }
    });

    return function start() {
        return _ref2.apply(this, arguments);
    };
})();

let startTest = (() => {
    var _ref3 = _asyncToGenerator(function* () {
        return startProduction();
    });

    return function startTest() {
        return _ref3.apply(this, arguments);
    };
})();

let startDevelopment = (() => {
    var _ref4 = _asyncToGenerator(function* () {
        return startProduction();
    });

    return function startDevelopment() {
        return _ref4.apply(this, arguments);
    };
})();

let startProduction = (() => {
    var _ref5 = _asyncToGenerator(function* () {
        sub.on('message', function (channel, message) {
            if (process.env.NODE_ENV !== 'production') {
                console.log({ channel, message });
            }
            multiExecAsync(client, function (multi) {
                multi.lpush(config.pushQueue, message);
                multi.ltrim(config.pushQueue, 0, config.trimLength);
            });
        });
        sub.subscribe(config.subscribeChannel);
    });

    return function startProduction() {
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

start().then(() => {}).catch(err => {
    console.log(err);
    end();
}).finally(() => {});
