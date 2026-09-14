import { fetch as expoFetch } from 'expo/fetch';
import { File } from 'expo-file-system';
import { Platform } from 'react-native';

import { getDevServerBaseUrl } from './ai-client';

type TranscriptionResponse = {
  success: boolean;
  text?: string;
  error?: string;
};

function getAudioMetadata(uri: string): { name: string; type: string } {
  const extension = uri.split('?')[0].split('.').pop()?.toLowerCase();

  switch (extension) {
    case 'wav':
      return { name: 'recording.wav', type: 'audio/wav' };
    case 'webm':
      return { name: 'recording.webm', type: 'audio/webm' };
    case '3gp':
      return { name: 'recording.3gp', type: 'audio/3gpp' };
    case 'caf':
      return { name: 'recording.caf', type: 'audio/x-caf' };
    case 'mp3':
      return { name: 'recording.mp3', type: 'audio/mpeg' };
    case 'm4a':
    case 'mp4':
    default:
      return { name: 'recording.m4a', type: 'audio/mp4' };
  }
}

function isTranscriptionResponse(value: unknown): value is TranscriptionResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    'success' in value &&
    typeof value.success === 'boolean'
  );
}

export async function transcribeAudio(recordingUri: string): Promise<string> {
  if (!recordingUri) {
    throw new Error('No recording was produced.');
  }

  const metadata =
    Platform.OS === 'web'
      ? { name: 'recording.webm', type: 'audio/webm' }
      : getAudioMetadata(recordingUri);
  const response =
    Platform.OS === 'web'
      ? await (async () => {
          const audioResponse = await globalThis.fetch(recordingUri);
          if (!audioResponse.ok) {
            throw new Error('Unable to read the browser recording.');
          }
          const audioBlob = await audioResponse.blob();
          return globalThis.fetch(`${getDevServerBaseUrl()}/api/transcribe`, {
            method: 'POST',
            headers: {
              'Content-Type': metadata.type,
              'X-Audio-Filename': metadata.name,
            },
            body: audioBlob,
          });
        })()
      : await (() => {
          const audioFile = new File(recordingUri);
          return expoFetch(`${getDevServerBaseUrl()}/api/transcribe`, {
            method: 'POST',
            headers: {
              'Content-Type': metadata.type,
              'X-Audio-Filename': metadata.name,
            },
            body: audioFile,
          });
        })();

  const data: unknown = await response.json();
  if (!response.ok) {
    const message =
      isTranscriptionResponse(data) && data.error
        ? data.error
        : `Transcription request failed (HTTP ${response.status}).`;
    throw new Error(message);
  }

  if (!isTranscriptionResponse(data) || !data.success || !data.text?.trim()) {
    throw new Error('The transcription service returned no text.');
  }

  return data.text.trim();
}
