const uuid = require('node-uuid').v4()
const logger = require('weplay-common').logger('compressor-service', uuid)
const EventBus = require('weplay-common').EventBus
const fps = require('fps')
const memwatch = require('memwatch-next')
memwatch.on('stats', (stats) => {
  logger.info('stats', stats)
})
memwatch.on('leak', (info) => {
  logger.error('leak', info)
})

class CompressorService {
  constructor(discoveryUrl, discoveryPort, statusPort) {
    this.uuid = require('node-uuid').v4()
    this.pngquant = undefined
    this.failures = 0
    this.romHash = undefined
    this.listenerCounter = 0
    this.ticker = null
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
        'streamCreateRequested': this.streamCreateRequested.bind(this),
        'streamLeaveRequested': this.streamLeaveRequested.bind(this)
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

  streamLeaveRequested(socket, request) {
    if (this.romHash === request) {
      logger.info('CompressorService.streamLeaveRequested', {
        socket: socket.id,
        request: JSON.stringify(request)
      })
      socket.leave(request)
      this.bus.streamLeave('emu', request)
      this.bus.destroyStream(this.romHash, 'frame')
      this.joined = false
      this.romHash = null
      this.ticker = null
    }
  }

  streamJoinRequested(socket, request) {
    logger.info('CompressorService.streamJoinRequested', {
      socket: socket.id,
      request: JSON.stringify(request)
    })
    this.checkRuntimeStatus(request, socket)
  }

  checkRuntimeStatus(request, socket) {
    if (!this.romHash) {
      this.romHash = request
      this.checkTicker()
      if (!this.joined) {
        logger.info('streamJoinRequested', this.joined)
        // Locate a raw frame stream supplier
        // channel, room, event, listener
        this.joined = true
        this.listenerCounter++
        this.bus.streamJoin('emu', request, 'frame', this.onRawFrame.bind(this))
        // this.bus.stream(this.romHash, 'frame', {});
      } else {
        logger.error('CompressorService.streamJoinRequested. Ignoring request for same stream.', {
          socket: socket.id,
          request: JSON.stringify(request)
        })
      }
      socket.leave(request)
      socket.join(request)
    } else if (this.romHash !== request) {
      logger.error('CompressorService.streamJoinRequested. streamRejected Ignoring request for a new stream.', {
        socket: socket.id,
        request: JSON.stringify(request)
      })
      socket.emit('streamRejected', request)
    } else {
      socket.leave(request)
      socket.join(request)
    }
  }

  checkTicker() {
    if (!this.ticker && this.romHash) {
      this.ticker = fps({every: 60})
      logger.info('CompressorService[%s] Init ticker ', this.romHash)
      const listener = framerate => {
        logger.info('CompressorService[%s] fps %s', this.romHash ? this.romHash : 'ERROR', Math.floor(framerate), {
          conn: this.listenerCounter,
          list: this.ticker.listenerCount()
        })
      }
      this.ticker.removeListener('data', listener)
      this.ticker.on('data', listener)
    }
  }

  sendFrame(frame) {
    if (this.ticker) {
      this.ticker.tick()
    }
    if (this.romHash) {
      this.bus.stream(this.romHash, 'frame', frame)
    }
  }

  destroy() {
    this.ticker && this.ticker.removeAllListeners('data')
    this.ticker = null
    this.bus.destroyStream(this.romHash, 'frame')
    delete this.romHash
    delete this.joined
    this.bus.destroy()
  }
}

module.exports = CompressorService
