"use strict";

var alertConnection = new signalR.HubConnectionBuilder().withUrl("/IO-AV").build();

var _audioPath = '/assets/audio/clips/';

alertConnection.on("ReceiveNewAudioClip", function (filename) {

    var audio = document.createElement('audio');
    audio.src = _audioPath + filename;
    audio.id = +(new Date());
    audio.addEventListener('ended', audioStop, false);

    $('#container').append(audio);

    var playPromise = audio.play().catch(error => {
        throw error;
    });
});

alertConnection.on("ReceiveStopAudioClips", function () {
    $('#container').empty();
});

alertConnection.onclose(async () => {
    console.log('Closing (Audio)');
    await startAlertConnection();
});

alertConnection.start();

async function startAlertConnection() {
    try {
        console.log('Reconnecting (Audio)');
        await alertConnection.start();
    } catch (err) {
        setTimeout(() => startAlertConnection(), 5000);
    }
}

function audioStop(e) {
    $(e.srcElement).remove();
}