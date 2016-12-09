'use strict';

const logger = require('weplay-common').logger('weplay-compressor');

// redis
const redis = require('weplay-common').redis();
const sub = require('weplay-common').redis();
const io = require('socket.io-emitter')(redis);

var pngquant;
try {
    // compression lib
    //pngquant = require('node-pngquant-native');
} catch (e) {
    logger.error(e);
}

const option = {
    speed: 8
};

var failures = 0;

sub.subscribe('weplay:frame:raw');
sub.on('message', (channel, frame) => {
    if ('weplay:frame:raw' != channel) return;
    if (failures < 3 && pngquant) {
        try {
            const resBuffer = pngquant.compress(frame);
            logger.debug('weplay:frame:raw compressed');
            redis.set('weplay:frame', resBuffer);
            io.emit('frame', resBuffer);
        } catch (e) {
            failures++;
            logger.error('weplay:frame:raw', e);
            redis.set('weplay:frame', frame);
            io.emit('frame', frame);
        }
    } else {
        logger.debug('weplay:frame:raw');
        redis.set('weplay:frame', frame);
        io.emit('frame', frame);
    }
});