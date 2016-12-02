'use strict';

// redis
var redis = require('./redis')();
var sub = require('./redis')();
var io = require('socket.io-emitter')(redis);
// compression lib
var pngquant = require('node-pngquant-native');

var option = {
    speed: 8
};

sub.subscribe('weplay:frame:raw');
sub.on('message', function (channel, frame) {
    if ('weplay:frame:raw' != channel) return;

    var resBuffer = pngquant.compress(frame, option);
    redis.set('weplay:frame', resBuffer);
    io.emit('frame', resBuffer);
});