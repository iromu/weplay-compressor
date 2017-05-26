const uuid = require('node-uuid').v4()
const logger = require('weplay-common').logger('compressor-service', uuid)
const EventBus = require('weplay-common').EventBus
const fps = require('fps')

const autoload = process.env.AUTOLOAD || false

class CompressorService {
  constructor(discoveryUrl, discoveryPort) {
    this.uuid = require('node-uuid').v4()
    this.pngquant = undefined
    this.failures = 0
    this.romHash = undefined
    this.ticker = fps({every: 60})
    this.ticker.on('data', framerate => {
      logger.info('CompressorService[%s] fps %s', uuid, framerate)
    })
    this.bus = new EventBus({
      url: discoveryUrl,
      port: discoveryPort,
      name: 'compressor',
      id: this.uuid,
      serverListeners: {
        'streamJoinRequested': this.streamJoinRequested.bind(this),
        'streamCreateRequested': this.streamCreateRequested.bind(this)
      }
    }, () => {
      logger.info('CompressorService connected to discovery server', {
        discoveryUrl: discoveryUrl,
        uuid: this.uuid
      })
      this.init()
    })
  }

  init() {
    if (autoload) {
      //this.bus.emit('rom', 'request');
    }

    try {
      this.romHash = null
      // compression lib
      this.pngquant = require('node-pngquant-native')
      logger.debug('pngquant loaded')
      logger.info('CompressorService waiting for incoming users.')
    } catch (e) {
      logger.error(e)
    }
  }

  onRawFrame(frame) {
    if (this.pngquant && this.failures < 3) {
      try {
        const resBuffer = this.pngquant.compress(frame)
        this.sendFrame(resBuffer)
      } catch (e) {
        this.failures++
        this.sendFrame(frame)
      }
    } else {
      this.sendFrame(frame)
    }
  }

  streamCreateRequested(socket, request) {
    logger.info('CompressorService.streamCreateRequested', {
      socket: socket.id,
      request: JSON.stringify(request)
    })
  }

  streamJoinRequested(socket, request) {
    logger.info('CompressorService.streamJoinRequested', {
      socket: socket.id,
      request: JSON.stringify(request)
    })
    if (!this.romHash || this.romHash === request) {
      this.romHash = request
      socket.join(this.romHash)
      // Locate a raw frame stream supplier
      // channel, room, event, listener
      this.bus.streamJoin('emu', this.romHash, 'frame', this.onRawFrame.bind(this))
      //this.bus.stream(this.romHash, 'frame', {});
    } else {
      logger.error('EmulatorService.streamJoinRequested. Ignoring request for a new stream.', {
        socket: socket.id,
        request: JSON.stringify(request)
      })
    }
  }

  sendFrame(frame) {
    this.ticker.tick()
    this.bus.stream(this.romHash, 'frame', frame)
  }

  destroy() {
  }
}

module.exports = CompressorService
