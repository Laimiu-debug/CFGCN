// Original, very quiet pentatonic chimes. Never starts without a user gesture.
export async function createAmbience() {
  const context = new AudioContext();
  try {
    await context.resume();
  } catch (error) {
    await context.close();
    throw error;
  }
  const master = context.createGain();
  master.gain.value = 0.035;
  master.connect(context.destination);
  const notes = [261.63, 293.66, 329.63, 392, 440];
  let index = 0;
  function chime() {
    if (context.state !== 'running') return;
    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = notes[[0, 2, 4, 3, 1, 2, 0, 3][index++ % 8]];
    envelope.gain.setValueAtTime(0, now);
    envelope.gain.linearRampToValueAtTime(0.5, now + 0.4);
    envelope.gain.exponentialRampToValueAtTime(0.001, now + 4.5);
    oscillator.connect(envelope);
    envelope.connect(master);
    oscillator.start(now);
    oscillator.stop(now + 5);
    oscillator.onended = () => {
      oscillator.disconnect();
      envelope.disconnect();
    };
  }
  chime();
  const timer = window.setInterval(chime, 5200);
  const visibility = () => {
    if (document.hidden) void context.suspend();
    else void context.resume().catch(() => undefined);
  };
  document.addEventListener('visibilitychange', visibility);
  return async () => {
    clearInterval(timer);
    document.removeEventListener('visibilitychange', visibility);
    await context.close();
  };
}
