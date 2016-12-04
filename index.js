'use strict';

// redis
const redis = require('./redis')();
const sub = require('./redis')();
const io = require('socket.io-emitter')(redis);

// compression lib
const pngquant = require('node-pngquant-native');

const option = {
    speed: 8
};

const compress = (frame) => {
    return pngquant.compress(frame, option);
};

sub.subscribe('weplay:frame:raw');
sub.on('message', (channel, frame) => {
    if ('weplay:frame:raw' != channel) return;

    try {
        const resBuffer = compress(frame);
        redis.set('weplay:frame', resBuffer);
        io.emit('frame', resBuffer);
    } catch (e) {
        console.error(e);
    }
});