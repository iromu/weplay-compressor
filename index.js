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

let pngquant;
try {
    // compression lib
    pngquant = require('node-pngquant-native');
    logger.info('pngquant loaded');
} catch (e) {
    logger.error(e);
}

let failures = 0;

const sendFrame = (room, frame) => {
    io.to(room).emit('frame', frame);
    redis.set(`weplay:frame:${room}`, frame);
};


sub.psubscribe('weplay:frame:raw:*');
sub.on('pmessage', (pattern, channel, frame) => {
    const room = channel.toString().split(":")[3];

    if (pngquant && failures < 3) {
        try {
            const resBuffer = pngquant.compress(frame);
            sendFrame(room, resBuffer);
        } catch (e) {
            failures++;
            logger.error('weplay:frame:raw', e);
            sendFrame(room, frame);
        }
    } else {
        logger.debug('weplay:frame:raw');
        sendFrame(room, frame);
    }
    ticker.tick();
});