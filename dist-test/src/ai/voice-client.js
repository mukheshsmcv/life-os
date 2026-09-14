"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transcribeAudio = transcribeAudio;
const fetch_1 = require("expo/fetch");
const expo_file_system_1 = require("expo-file-system");
const react_native_1 = require("react-native");
const ai_client_1 = require("./ai-client");
function getAudioMetadata(uri) {
    const extension = uri.split('?')[0].split('.').pop()?.toLowerCase();
    switch (extension) {
        case 'wav':
            return { name: 'recording.wav', type: 'audio/wav' };
        case 'webm':
            return { name: 'recording.webm', type: 'audio/webm' };
        case '3gp':
            return { name: 'recording.3gp', type: 'audio/3gpp' };
        case 'mp3':
            return { name: 'recording.mp3', type: 'audio/mpeg' };
        case 'm4a':
        case 'mp4':
        default:
            return { name: 'recording.m4a', type: 'audio/mp4' };
    }
}
function isTranscriptionResponse(value) {
    return (typeof value === 'object' &&
        value !== null &&
        'success' in value &&
        typeof value.success === 'boolean');
}
async function transcribeAudio(recordingUri) {
    if (react_native_1.Platform.OS === 'web') {
        throw new Error('Voice transcription is currently supported on Android and iOS only.');
    }
    if (!recordingUri) {
        throw new Error('No recording was produced.');
    }
    const audioFile = new expo_file_system_1.File(recordingUri);
    const metadata = getAudioMetadata(recordingUri);
    const response = await (0, fetch_1.fetch)(`${(0, ai_client_1.getDevServerBaseUrl)()}/api/transcribe`, {
        method: 'POST',
        headers: {
            'Content-Type': metadata.type,
            'X-Audio-Filename': metadata.name,
        },
        body: audioFile,
    });
    const data = await response.json();
    if (!response.ok) {
        const message = isTranscriptionResponse(data) && data.error
            ? data.error
            : `Transcription request failed (HTTP ${response.status}).`;
        throw new Error(message);
    }
    if (!isTranscriptionResponse(data) || !data.success || !data.text?.trim()) {
        throw new Error('The transcription service returned no text.');
    }
    return data.text.trim();
}
