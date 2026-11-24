/**
 * Web Audio API synthesizer for the Waiting Area TV notification chime.
 * Generates an elegant, harmonic two/three-note chime without requiring external audio files.
 */

let audioContextInstance: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  try {
    if (!audioContextInstance) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        audioContextInstance = new AudioCtx();
      }
    }
    if (audioContextInstance && audioContextInstance.state === 'suspended') {
      audioContextInstance.resume();
    }
    return audioContextInstance;
  } catch (err) {
    console.warn('Web Audio Context initialization error:', err);
    return null;
  }
}

/**
 * Plays a pleasant three-note harmonic chime (C5 -> E5 -> G5)
 */
export function playNotificationChime(muted: boolean = false) {
  if (muted) return;

  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    const playTone = (freq: number, startTime: number, duration: number, gainPeak: number = 0.25) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.exponentialRampToValueAtTime(gainPeak, startTime + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    // Soft celestial arpeggio: C5 (523Hz), E5 (659Hz), G5 (784Hz)
    playTone(523.25, now, 0.9, 0.2);
    playTone(659.25, now + 0.14, 1.0, 0.22);
    playTone(783.99, now + 0.28, 1.4, 0.25);
  } catch (error) {
    console.warn('Could not play notification chime:', error);
  }
}
