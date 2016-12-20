'use strict';

const logger = require('weplay-common').logger('weplay-compressor');

// redis
const redis = require('weplay-common').redis();
const sub = require('weplay-common').redis();
const io = require('socket.io-emitter')(redis);


const fps = require('fps');
const ticker = fps({
    every: 100   // update every 10 frames
});
ticker.on('data', framerate => {
    logger.info('fps', {fps: Math.round(framerate)});
});

var pngquant;
try {
    // compression lib
    pngquant = require('node-pngquant-native');
    logger.info('pngquant loaded');
} catch (e) {
    logger.error(e);
}

var failures = 0;

var sendFrame = function (room, frame) {
    io.to(room).emit('frame', frame);
    redis.set(`weplay:frame:${room}`, frame);
    redis.expire(`weplay:frame:${room}`, 1);
};


sub.psubscribe('weplay:frame:raw:*');
sub.on('pmessage', (pattern, channel, frame) => {
    var room = channel.toString().split(":")[3];
    //console.log("A temperature of " + message + " was read in " + room);

    //logger.debug('weplay:frame:raw compressed', room);
    if (pngquant && failures < 3) {
        try {
            const resBuffer = pngquant.compress(frame);
            //logger.debug('weplay:frame:raw compressed');
            sendFrame(room,resBuffer);
        } catch (e) {
            failures++;
            logger.error('weplay:frame:raw', e);
            sendFrame(room,frame);
        }
    } else {
        logger.debug('weplay:frame:raw');
        sendFrame(room,frame);
    }
    ticker.tick();
});