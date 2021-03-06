process.env.NODE_ENV = 'test'

global.chai = require('chai')
global.chai.should()
global.chai.config.truncateThreshold = 0
global.expect = global.chai.expect
global.sinon = require('sinon')

global.sinonChai = require('sinon-chai')
global.chai.use(global.sinonChai)

// ports used in this test
let latestPort = 55000
let ports = Array.from({length: 100}, () => latestPort++)

export default ports
