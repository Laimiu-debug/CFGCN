// One sound preference and one AudioContext, including pages whose header is hidden.
export type AudioStatus = { enabled: boolean; busy: boolean };
export const audioToggleEvent = 'cfgcn:audio-toggle';
const audioStatusEvent = 'cfgcn:audio-status';
let status: AudioStatus = { enabled: false, busy: false };

export const getAudioStatus = () => status;
export function publishAudioStatus(next: AudioStatus) {
  status = next;
  window.dispatchEvent(new Event(audioStatusEvent));
}
export function subscribeAudioStatus(listener: () => void) {
  window.addEventListener(audioStatusEvent, listener);
  return () => window.removeEventListener(audioStatusEvent, listener);
}
export function requestAudioToggle() {
  // Synchronous dispatch preserves the click/touch gesture for AudioContext.resume.
  window.dispatchEvent(new Event(audioToggleEvent));
}
