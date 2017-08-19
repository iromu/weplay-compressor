const uuid = require('uuid/v1')()
const logger = require('weplay-common').logger('compressor-service', uuid)
const EventBus = require('weplay-common').EventBus
const fps = require('fps')

const memwatch = require('memwatch-next')

memwatch.on('stats', (stats) => {
  logger.info('CompressorService stats', stats)
})
memwatch.on('leak', (info) => {
  logger.error('CompressorService leak', info)
})

const CHECK_INTERVAL = 2000

class CompressorService {
  constructor(discoveryUrl, discoveryPort, statusPort) {
    this.uuid = require('uuid/v1')()
    this.pngquant = undefined
    this.failures = 0
    this.romHash = null
    this.roomsTimestamp = {}
    this.listenerCounter = 0
    this.ticker = null

    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = undefined
    }

    this.checkInterval = setInterval(() => {
      this.gc()
    }, CHECK_INTERVAL)

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
            // if (this.romHash && !this.joined) {
            //   this.joined = true
            //   this.listenerCounter++
            //   this.bus.streamJoin('emu', this.romHash, 'frame', this.onRawFrame.bind(this))
            // }
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

  gc() {
    // if (this.romHash) {
    //   logger.debug('CompressorService.check roomsTimestamp', this.romHash, this.roomsTimestamp)
    // }
    for (var room in this.roomsTimestamp) {
      if (this.isOlderThan(this.roomsTimestamp[room], CHECK_INTERVAL)) {
        this.bus.streamLeave('emu', room)
        this.bus.destroyStream(room, 'frame' + room)
        this.joined = false
        this.romHash = null
        this.ticker = null
      }
    }
    if (!this.roomsTimestamp[this.romHash] && this.romHash) {
      this.joined = true
      this.listenerCounter++
      this.bus.streamJoin('emu', this.romHash, 'frame' + this.romHash, this.onRawFrame.bind(this))
    }
    this.roomsTimestamp = {}
  }

  isOlderThan(ts, limit) {
    return Date.now() - ts > limit
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
        this.pngquant = require('node-pngquant-native')
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
    delete this.roomsTimestamp[request]
    if (this.romHash === request) {
      logger.info('CompressorService.streamLeaveRequested', {
        socket: socket.id,
        request: JSON.stringify(request)
      })
      socket.leave(request)
      this.bus.streamLeave('emu', request)
      this.bus.destroyStream(this.romHash, 'frame' + this.romHash)
      this.joined = false
      this.romHash = null
      this.ticker = null
      this.failures = 0
    }
  }

  streamJoinRequested(socket, request) {
    logger.info('CompressorService.streamJoinRequested', {
      socket: socket.id,
      request: JSON.stringify(request),
      current: this.romHash
    })
    if (request) {
      this.checkRuntimeStatus(request, socket)
    }
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
        this.bus.streamJoin('emu', this.romHash, 'frame' + this.romHash, this.onRawFrame.bind(this))
        // this.bus.stream(this.romHash, 'frame', {});
      } else {
        logger.error('CompressorService.streamJoinRequested. Ignoring request for same stream.', {
          socket: socket.id,
          request: JSON.stringify(request)
        })
      }
      socket.join(request)
    } else if (this.romHash !== request) {
      logger.error('CompressorService.streamJoinRequested. streamRejected Ignoring request for a new stream.', {
        socket: socket.id,
        request: JSON.stringify(request)
      })
      socket.emit('streamRejected', request)
    } else {
      socket.join(request)
    }
  }

  checkTicker() {
    if (!this.ticker && this.romHash) {
      this.ticker = fps({every: 200})
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
      this.roomsTimestamp[this.romHash] = Date.now()
      this.bus.stream(this.romHash, 'frame' + this.romHash, frame)
    }
  }

  destroy() {
    this.ticker && this.ticker.removeAllListeners('data')
    this.ticker = null
    this.bus.destroyStream(this.romHash, 'frame' + this.romHash)
    this.romHash = null
    delete this.joined
    this.bus.destroy()
    clearInterval(this.checkInterval)
    this.checkInterval = undefined
    this.roomsTimestamp = {}
  }
}

module.exports = CompressorService
