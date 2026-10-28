/** Short beep + vibration after a successful scan (both optional; failures are ignored). */
export function scanFeedback(win: Window & typeof globalThis = window): void {
  try {
    win.navigator.vibrate?.(80);
  } catch {
    /* not supported */
  }
  try {
    const Ctx = win.AudioContext ?? (win as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = 1800;
    gain.gain.value = 0.08;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.onended = () => void ctx.close();
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
  } catch {
    /* audio blocked */
  }
}
