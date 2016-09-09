var http = require('http');
var fs = require('fs');

var spawn = require('child_process').spawn
var PassThrough = require('stream').PassThrough;
var lame = require('lame');
var BiquadFilter = require('audio-biquad');


process.stdin.resume(); //so the program will not close instantly
function exitHandler(options, err) {
    console.log("Killing process");
    endSOX();
    if (err) console.log(err.stack);
    if (options.exit) process.exit();
}
//app is closing
process.on('exit', exitHandler.bind(null, {cleanup:true}));
//catches ctrl+c event
process.on('SIGINT', exitHandler.bind(null, {exit:true}));
//catches uncaught exceptions
process.on('uncaughtException', exitHandler.bind(null, {exit:true}));

var soxPs;
var lastSoxUpdate = null;
var i = 0;
var encodedAudio = new PassThrough;
encodedAudio.resume();

function startSOX(){
    soxPs = spawn('C:\\Program Files (x86)\\sox-14-4-2\\sox.exe', ['-t', 'waveaudio', 'Hi-Fi Cable Output', '-t', 'wav', '-b', '16', '-r', '44100', '-']);

    soxPs.stdout.on('data', function (data) {
        if(i % 20 == 0)console.log("sox update", i, data.length);
        lastSoxUpdate = new Date();
        i++;
    });
    var encoder = new lame.Encoder({
        channels: 2,
        bitDepth: 16,
        sampleRate: 44100,
        bitRate: 192,
        outSampleRate: 44100,
        mode: lame.STEREO // STEREO (default), JOINTSTEREO, DUALCHANNEL or MONO 
    });

    soxPs.stdout.pipe(BiquadFilter({
        type: 'LowShelf',
        frequency: 36,
        Q: 8.9303,
        gain: 15
    })).pipe(encoder);

    encoder.pipe(encodedAudio, {end: false});
    console.log("SOX STARTED");
}

function endSOX() {
    if(soxPs) {
        soxPs.kill();
        soxPs = null;
        lastSoxUpdate = null;
    }
    console.log("SOX STOPPED");
}

startSOX();


setInterval(function(){
    if(lastSoxUpdate !== null && new Date() - lastSoxUpdate > 1000){
        console.log("SOX CRASH DETECTED - RESTARTING", new Date() - lastSoxUpdate);
        endSOX();
        startSOX();
    }
},200);



http.createServer(function(request, response) {
    response.writeHead(200, {
        'Content-Type': 'audio/mpeg, audio/x-mpeg, audio/x-mpeg-3, audio/mpeg3'
       // 'Content-Type': 'audio/pcm'
    });
    function sendData(data){
        if(i % 20 == 0) console.log("encoded update", i, request.connection.remoteAddress);
        response.write(data);
        i++;
    }
    
    request.on('close', function(err) {
        encodedAudio.removeListener('data', sendData);
        response.end();
    });
    var i = 0;
    encodedAudio.on('data', sendData);

})
.listen(9000);