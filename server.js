const protocol = require('./gobackn')
const express = require('express')
const app = express()
const path = require('path');
const server = require('http').createServer(app)
const io = require('socket.io')(server, { cors: { origin: "*" }})

server.listen(3001, () => {
    console.log("server running....")
})

io.on('connection', (socket) => {
    protocol.goBackN_init(socket, true);
})
