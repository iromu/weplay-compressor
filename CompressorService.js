const uuid = require('node-uuid').v4();
const logger = require('weplay-common').logger('compressor-service', uuid);
const EventBus = require('weplay-common').EventBus;

class CompressorService {

    constructor(discoveryUrl, discoveryPort) {
        this.uuid = require('node-uuid').v4();
        this.pngquant = undefined;
        this.failures = 0;
        this.sockets = [];

        this.bus = new EventBus({
            url: discoveryUrl,
            port: discoveryPort,
            name: 'compressor',
            id: this.uuid,
            serverListeners: {
                'frame': this.onRawFrame.bind(this),
                'stream:join': this.onStreamJoin.bind(this),
            },
            listeners: [
                //{name: 'emu', event: 'frame', handler: this.onRawFrame.bind(this)},
                {name: 'game', event: 'join', handler: this.onGameJoin.bind(this)}
            ]
        }, ()=> {
            logger.info('CompressorService connected to discovery server', {
                discoveryUrl: discoveryUrl,
                uuid: this.uuid
            });
            this.init();
        });
    }

    init() {
        try {
            // compression lib
            this.pngquant = require('node-pngquant-native');
            logger.debug('pngquant loaded');
        } catch (e) {
            logger.error(e);
        }
    }

    onRawFrame(socket, data) {
        const hash = data.hash;
        const frame = data.frame;

        if (this.pngquant && this.failures < 3) {
            try {
                const resBuffer = this.pngquant.compress(frame);
                this.sendFrame(hash, resBuffer);
            } catch (e) {
                this.failures++;
                this.sendFrame(hash, frame);
            }
        } else {
            this.sendFrame(hash, frame);
        }
    }

    onGameJoin(socket, user) {
        logger.debug('onGameJoin. Choose me !!!!', user);
        //{nick: socket.nick, hash: hash, clientId: clientId}

        // Given the user.hash selection,
        // Then return where it should listen for incoming frames

        socket.emit('frame:location', this.uuid);
    }

    // socket:  GatewayService.js
    // user:    {nick: socket.nick, hash: hash, clientId: clientId}
    onStreamJoin(socket, user) {
        logger.debug('onStreamJoin.', {user: user});
        //{nick: socket.nick, hash: hash, clientId: clientId}
        if (!socket.hashes) {
            socket.hashes = [];
        }
        socket.hashes.push(user.hash);
        // Given the user.hash selection,
        // Then find a emulator, join and relay frame data
        // on private channel
        socket.join(`${user.hash}:frame`);
        if (this.sockets.filter(s=>s.id === socket.id)[0] === undefined) {
            this.sockets.push(socket);
        }
    }

    sendFrame(room, frame) {
        //logger.debug('sendFrame.', {room: room});
        this.bus.publish(`${room}:frame`, frame);
        /*this.sockets
         //.filter(s=>s.hash === room)
         .forEach((socket)=> {
         //logger.debug(`sendFrame to ${room}:frame`, {socket: socket.id});
         socket.emit(`${room}:frame`, frame);
         })*/
    }

    destroy() {
    }
}


module.exports = CompressorService;
//
//return;
//// redis
//const redis = require('weplay-common').redis();
//const redisSub = require('weplay-common').redis();
//
//const EventBus = require('weplay-common').EventBus;
//const bus = new EventBus(redis, redisSub);
//
//const io = require('socket.io-emitter')(redis);
//
//const fps = require('fps');
//const ticker = fps({
//    every: 100   // update every 10 frames
//});
//ticker
//    .on(
//        'data'
//        ,
//        framerate
//            => {
//            logger
//                .info(
//                    'fps'
//                    , {
//                        fps: Math.round
//                        (
//                            framerate
//                        )
//                    }
//                )
//            ;
//        })
//;
//
//let pngquant;
//try {
//    // compression lib
//    pngquant = require('node-pngquant-native');
//    logger.info('pngquant loaded');
//} catch (e) {
//    logger.error(e);
//}
//
//let failures = 0;
//const persistCounter = {};
//const sendFrame = (room, frame) => {
//    io.to(room).emit('frame', frame);
//    const counter = persistCounter[room];
//    if (counter > 10 || counter === undefined || counter === 0) {
//        persistCounter[room] = 1;
//        redis.set(`weplay:frame:${room}`, frame);
//    } else {
//        persistCounter[room] = counter + 1;
//    }
//};
//
//
//bus.psubscribe('weplay:frame:raw:*', (pattern, channel, frame) => {
//    const room = channel.toString().split(":")[3];
//
//    if (pngquant && failures < 3) {
//        try {
//            const resBuffer = pngquant.compress(frame);
//            sendFrame(room, resBuffer);
//        } catch (e) {
//            failures++;
//            logger.error('weplay:frame:raw', e);
//            sendFrame(room, frame);
//        }
//    } else {
//        logger.debug('weplay:frame:raw');
//        sendFrame(room, frame);
//    }
//    ticker.tick();
//});
//
//
//require('weplay-common').cleanup(function destroyData() {
//    logger.info('Destroying data.');
//    for (var room in persistCounter) {
//        if (persistCounter.hasOwnProperty(room)) {
//            redis.del(`weplay:frame:${room}`);
//        }
//    }
//
//    bus.publish('weplay:compressor:unsubscribe', uuid);
//    bus.destroy();
//});