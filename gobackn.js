let socket;

/* should be 2^n - 1 */
const MAX_SEQ  = 2;

// frame types
const frameTypeData = 0;
const frameTypeAch = 1;

// received data flags
let receivedData;
let isDataReceived = false;

// network layer enabled flag
let networkLayerEnabled = false;

// current event
let currentEvent;

// indicates timout
let timedOut = false;

// indicates whether it's a sender or receiver
let isSender;

// events
const network_layer_ready = 0;
const frame_arrival = 1;
const cksum_err = 2;
const timeout = 3;
const nullEvent = 4;

// array for holding timers
let timersArr = new Array(MAX_SEQ + 1);

const inc = (k) => {
    if(k < MAX_SEQ) {
        return k + 1;
    }
    else {
        return 0;
    }
} 

let nthDataToSend = 0;

const send_data = (frame_nr, frame_expected, buffer, frameType) => {
    nthDataToSend ++;
    let s = {};
    s.info = buffer[frame_nr];
    s.seq = frame_nr;
    s.ack = (frame_expected + MAX_SEQ) % (MAX_SEQ + 1);
    s.type = frameType;

    // fail to send the 5th data each time
    if ((nthDataToSend % 5 != 0 && isSender) || !isSender)
        to_physical_layer(s);
    else
        console.log("error sending" + buffer[frame_nr])
    if(s.type == frameTypeData)
        start_timer(frame_nr);
}

const to_physical_layer = (data) => {
    console.log("sending: ", data)
    socket.emit('sendTOPhysicalLayer', 'sender', data);
}

const from_physical_layer = () => {
    return receivedData;
}

let dataToSendFromNetwork = 0;
const from_network_layer = () => {
    // data to send
    let data = "123456789123456789";
    let sendData = data.substr(dataToSendFromNetwork, 1);
    dataToSendFromNetwork ++;
    return sendData;
}

const to_network_layer = (data) => {
    console.log(data)
}

const enableNetworkLayer = () => {
    networkLayerEnabled = true;
}

const disableNetworkLayer = () => {
    networkLayerEnabled = false;
}

const start_timer = (index) => {
    if(isSender)
    {
        console.log('sender Timer started for ' + index)
        timersArr[index] = setTimeout(() => {
            timedOut = true;
            console.log('Time out for ' + index)
            for(let i = 0; i < MAX_SEQ + 1; i++)
                clearTimeout(timersArr[i]);
        }, (MAX_SEQ + 1)*1000 + 500)
    }    
}


const stop_timer = (index) => {
    clearTimeout(timersArr[index]);
    console.log('Timer stoped for ' + index)
}

const getEvent = () => {
        currentEvent = nullEvent;
        if(networkLayerEnabled) {
            currentEvent = network_layer_ready;
            networkLayerEnabled = false;
        }
        else if(timedOut) {
            currentEvent = timeout;
            timedOut = false;
        }else if (isDataReceived){
            currentEvent = frame_arrival;
            isDataReceived = false;
        }
    return currentEvent;
}

let buffer = new Array(MAX_SEQ + 1);
let next_frame_to_send = 0;
let nbuffered = 0;
let frame_expected = 0
let ack_expected = 0;
let repeatTimer;
let repeatTime = 1000;

const goBackN_init = (s, sender) => {
    socket = s;
    isSender = sender;
    socket.on('sendTOPhysicalLayer', function (from, data) {
        if(isSender)
        {
            setTimeout(() => {
                receivedData = data;
                isDataReceived = true;
            }, (MAX_SEQ + 1) * 1000/2)
        }
        else{
             setTimeout(() => {
                receivedData = data;
                isDataReceived = true;
             }, (MAX_SEQ + 1) * 1000/2)
        }
        
    });

    if(isSender)
    {
        enableNetworkLayer();
        goBackN_sender()
    }
    else{
        goBackN_receiver()
    }
}

let retransmitting = false;
const goBackN_sender = () => {
    let event = getEvent();
    switch (event) {
        case network_layer_ready:
            if (!retransmitting)
                buffer[next_frame_to_send] = from_network_layer();
            nbuffered += 1;
            send_data(next_frame_to_send, frame_expected, buffer, frameTypeData);
            next_frame_to_send = inc(next_frame_to_send);
            console.log("network_layer_ready")
            console.log("")
            break;
        case frame_arrival:
            let data = from_physical_layer();	/* get incoming frame from physical layer */
            console.log(data)
            /* Ack n implies n - 1, n - 2, etc.  Check for this. */
            // while (between(ack_expected, data.ack, next_frame_to_send)) {
            while (ack_expected == data.ack) {
                /* Handle piggybacked ack. */
                nbuffered = nbuffered - 1;	/* one frame fewer buffered */
                stop_timer(ack_expected);	/* frame arrived intact; stop timer */
                ack_expected = inc(ack_expected);	/* contract sender's window */
                retransmitting = false;
            }
            console.log("frame_arrival")
            console.log("")
            break;
        case cksum_err:
            console.log("cksum_err")
            console.log("")
            break;
        case timeout:
            next_frame_to_send = ack_expected;	/* start retransmitting here */
            nbuffered = 0;
            retransmitting = true;
            console.log("timeout")
            console.log("")
            break;
    }
    if (nbuffered <= MAX_SEQ){
        enableNetworkLayer();
        repeatTime = 1000;
    }else{
        disableNetworkLayer();
        repeatTime = 10;
    }
    repeatTimer = setTimeout(() => {
        goBackN_sender();
    }, repeatTime)
}

const goBackN_receiver = () => {
    let event = getEvent();
    switch (event) {
        case network_layer_ready:
            buffer[next_frame_to_send] = from_network_layer();
            nbuffered += 1;
            send_data(next_frame_to_send, frame_expected, buffer, frameTypeData);
            next_frame_to_send = inc(next_frame_to_send);
            console.log("network_layer_ready")
            console.log("")
            break;
        case frame_arrival:
            let data = from_physical_layer();	/* get incoming frame from physical layer */
            console.log(data)
            if (data.seq == frame_expected) {
                if(data.seq != 20)
                {
                    /* Frames are accepted only in order. */
                    to_network_layer(data.info);	/* pass packet to network layer */
                    frame_expected = inc(frame_expected);	/* advance lower edge of receiver's window */
                    send_data(next_frame_to_send, frame_expected, buffer, frameTypeAch);
                }
            }

            console.log("frame_arrival")
            console.log("")
            break;
        case cksum_err:
            console.log("cksum_err")
            console.log("")
            break;
    }
    repeatTime = 10;
repeatTimer = setTimeout(() => {
    goBackN_receiver();
}, repeatTime)
}

module.exports = {goBackN_init}