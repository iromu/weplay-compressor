const uuid = require('node-uuid').v4()
const logger = require('weplay-common').logger('compressor-service', uuid)
const EventBus = require('weplay-common').EventBus
const fps = require('fps')

class CompressorService {
  constructor(discoveryUrl, discoveryPort, statusPort) {
    this.uuid = require('node-uuid').v4()
    this.pngquant = undefined
    this.failures = 0
    this.romHash = undefined
    this.listenerCounter = 0
    this.ticker = fps({every: 60})
    this.ticker.on('data', framerate => {
      logger.info('CompressorService[%s] %s hash[%s] fps %s', uuid,
        this.listenerCounter, this.romHash, framerate)
    })
    this.bus = new EventBus({
      url: discoveryUrl,
      port: discoveryPort,
      statusPort: statusPort,
      name: 'compressor',
      id: this.uuid,
      clientListeners: [
        {
          name: 'emu',
          event: 'connect',
          handler: () => {
            logger.info('connected to emu')
            if (this.romHash && !this.joined) {
              this.joined = true
              this.listenerCounter++
              this.bus.streamJoin('emu', this.romHash, 'frame', this.onRawFrame.bind(this))
            }
          }
        },
        {
          name: 'emu',
          event: 'disconnect',
          handler: () => {
            this.joined = false
            logger.info('disconnect from emu')
          }
        }
      ],
      serverListeners: {
        'streamJoinRequested': this.streamJoinRequested.bind(this),
        'streamCreateRequested': this.streamCreateRequested.bind(this)
      }
    }, () => {
      logger.info('CompressorService connected to discovery server', {
        discoveryUrl: discoveryUrl,
        uuid: this.uuid
      })
      this.onConnect()
    })
  }

  onConnect() {
    if (!this.connected) {
      try {
        // Reset after discovery reconnects
        this.connected = true
        // compression lib
        this.pngquant = require('node-pngquant-native')
        logger.debug('pngquant loaded')
        logger.info('CompressorService waiting for incoming users.')
      } catch (e) {
        logger.error(e)
      }
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
    if (!this.romHash) {
      this.romHash = request
    }
    if (!this.joined) {
      logger.info('streamJoinRequested')
      // Locate a raw frame stream supplier
      // channel, room, event, listener
      this.joined = true
      this.listenerCounter++
      this.bus.streamJoin('emu', this.romHash, 'frame', this.onRawFrame.bind(this))
      // this.bus.stream(this.romHash, 'frame', {});
    } else {
      logger.error('EmulatorService.streamJoinRequested. Ignoring request for a new stream.', {
        socket: socket.id,
        request: JSON.stringify(request)
      })
    }
    socket.join(this.romHash)
  }

  sendFrame(frame) {
    this.ticker.tick()
    this.bus.stream(this.romHash, 'frame', frame)
  }

  destroy() {
    delete this.romHash
    delete this.joined
    this.bus.destroy()
  }
}

module.exports = CompressorService
