process.title = 'weplay-compressor';

const discoveryPort = process.env.DISCOVERY_PORT || 3040;
const discoveryUrl = process.env.DISCOVERY_URL || 'http://localhost:3010';

const CompressorService = require('./CompressorService');
const service = new CompressorService(discoveryUrl, discoveryPort);

require('weplay-common').cleanup(service.destroy.bind(service));
