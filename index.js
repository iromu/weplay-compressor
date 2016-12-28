const uuid = require('node-uuid').v4();
const logger = require('weplay-common').logger('weplay-compressor', uuid);

// redis
const redis = require('weplay-common').redis();
const redisSub = require('weplay-common').redis();

const EventBus = require('weplay-common').EventBus;
let bus = new EventBus(redis, redisSub);

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
let persistCounter = {};
const sendFrame = (room, frame) => {
    io.to(room).emit('frame', frame);
    const counter = persistCounter[room];
    if (counter > 10) {
        persistCounter[room] = 1;
        redis.set(`weplay:frame:${room}`, frame);
    } else if (counter === undefined || counter === 0) {
        persistCounter[room] = 1;
        redis.set(`weplay:frame:${room}`, frame);
    } else {
        persistCounter[room] = counter + 1;
    }
};


bus.psubscribe('weplay:frame:raw:*', (pattern, channel, frame) => {
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


require('weplay-common').cleanup(function destroyData() {
    logger.info('Destroying data.');
    for (var room in persistCounter) {
        redis.del(`weplay:frame:${room}`);
    }

    bus.publish('weplay:compressor:unsubscribe', uuid);
    bus.destroy();
});