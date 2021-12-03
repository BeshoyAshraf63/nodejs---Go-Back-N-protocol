const protocol = require('./gobackn')
//client.js
var io = require('socket.io-client');
var socket = io.connect('http://localhost:3001', {reconnect: true});

// Add a connect listener
socket.on('connect', function () {
    console.log('client Connected to server');
    protocol.goBackN_init(socket, false);

});
