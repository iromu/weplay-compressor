process.title = 'weplay-compressor'

const discoveryUrl = process.env.DISCOVERY_URL || 'http://localhost:3010'
const discoveryPort = process.env.DISCOVERY_PORT || 3040
const statusPort = process.env.STATUS_PORT || 8083

const CompressorService = require('./CompressorService')
const service = new CompressorService(discoveryUrl, discoveryPort, statusPort)

require('weplay-common').cleanup(service.destroy.bind(service))
