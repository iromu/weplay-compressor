/* eslint-disable no-undef */
'use strict'

let ports = require('./common.spec')

const uuidv1 = require('uuid/v1')
process.env.NODE_ENV = 'test'

const EventBus = require('weplay-common').EventBus
const Discovery = require('weplay-common').Discovery

let serviceCleanup = []
let roomsTimestamp = {}
let discovery
let service
let emuMock
let room
let discoveryPort = ports.pop()
const discoveryUrl = 'http://localhost:' + discoveryPort

const CompressorService = require('../src/CompressorService')

describe('CompressorService', () => {
  beforeEach((done) => {
    room = 'room-' + uuidv1()
    roomsTimestamp = {}
    discovery = new Discovery().server({name: 'discovery', port: discoveryPort}, () => {
      let emuRomHash = null
      const streamJoinRequested = (socket, request) => {
        if (!emuRomHash) {
          emuRomHash = request
          socket.join(emuRomHash)
          emuMock.stream(emuRomHash, 'frame' + emuRomHash, 'blah')
        } else {
          socket.emit('streamRejected', request)
        }
      }
      const streamLeaveRequested = null
      const serverListeners = {
        'streamJoinRequested': streamJoinRequested,
        'streamLeaveRequested': streamLeaveRequested
      }
      emuMock = busFactory({name: 'emu', id: 'emu', serverListeners: serverListeners}, () => {
      })
      done()
    })
  })

  afterEach((done) => {
    serviceCleanup.forEach((clean) => {
      clean()
    })
    serviceCleanup = []
    discovery.destroy()
    done()
  })

  let busFactory = (config, onConnect) => {
    config.url = discoveryUrl
    config.port = ports.pop()
    let bus = new EventBus(config, onConnect)
    serviceCleanup.push(bus.destroy.bind(bus))
    return bus
  }

  describe('streamJoinRequested', () => {
    beforeEach((done) => {
      service = new CompressorService(discoveryUrl, ports.pop())
      done()
    })

    afterEach((done) => {
      serviceCleanup.forEach((clean) => {
        clean()
      })
      serviceCleanup = []
      service.destroy()
      done()
    })

    it('should start emu stream and connect', (done) => {
      let client = busFactory({name: 'client', id: 'client'}, () => {
        client.streamJoin('compressor', room, 'frame' + room, (frame) => {
          roomsTimestamp[room] = Date.now()
          done()
        })
      })
    })
  })
})
