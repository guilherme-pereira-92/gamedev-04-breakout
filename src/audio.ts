// Síntese de áudio via Web Audio API — sem assets externos.
// Tons gerados sob demanda; o AudioContext só é criado após a primeira interação
// do usuário (requisito dos navegadores), e mantido vivo até a aba fechar.

let ctx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new Ctor();
  }
  return ctx;
}

export function unlockAudio(): void {
  const audio = getAudioContext();
  if (audio.state === "suspended") {
    void audio.resume();
  }
}

export type WaveType = OscillatorType;

export function playTone(
  frequency: number,
  durationMs: number,
  type: WaveType = "sine",
  volume = 0.16,
): void {
  const audio = getAudioContext();
  const now = audio.currentTime;
  const duration = durationMs / 1000;

  const osc = audio.createOscillator();
  const gain = audio.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(frequency, now);

  // envelope ADSR simplificado: attack rápido + decay exponencial
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(volume, now + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  osc.connect(gain).connect(audio.destination);
  osc.start(now);
  osc.stop(now + duration + 0.02);
}
