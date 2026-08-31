const assert = require('node:assert/strict');
const test = require('node:test');
const { CrossChannelEchoGate } = require('../src/vad');

function makePcm(sampleCount, amplitude) {
  const buf = Buffer.alloc(sampleCount * 2);
  for (let i = 0; i < sampleCount; i++) {
    buf.writeInt16LE(Math.round(amplitude), i * 2);
  }
  return buf;
}

test('CrossChannelEchoGate: defaults to balanced mode', () => {
  const gate = new CrossChannelEchoGate();
  assert.equal(gate.mode, 'balanced');
  assert.equal(gate.hangoverMs, 350);
});

test('CrossChannelEchoGate: off mode allows all audio through', () => {
  const gate = new CrossChannelEchoGate({ mode: 'off' });
  const youAudio = makePcm(480, 5000); // loud speech
  const themAudio = makePcm(480, 800); // low bleed

  gate.onYouFrame(youAudio, true);
  assert.equal(gate.shouldSuppressThem(themAudio), false);
});

test('CrossChannelEchoGate: balanced mode suppresses acoustic bleed during candidate speech', () => {
  const gate = new CrossChannelEchoGate({ mode: 'balanced', hangoverMs: 300 });
  const youAudio = makePcm(480, 4000); // loud candidate speech (RMS ~4000)
  const themBleed = makePcm(480, 1200); // acoustic bleed into loopback (RMS ~1200)

  gate.onYouFrame(youAudio, true);
  // Bleed is ~30% of mic energy, well under balanced threshold -> should suppress
  assert.equal(gate.shouldSuppressThem(themBleed), true);
});

test('CrossChannelEchoGate: balanced mode allows loud interviewer speech (barge-in)', () => {
  const gate = new CrossChannelEchoGate({ mode: 'balanced', hangoverMs: 300 });
  const youAudio = makePcm(480, 1500); // moderate candidate speech
  const themLoud = makePcm(480, 6000); // loud interviewer speech over candidate

  gate.onYouFrame(youAudio, true);
  // Interviewer voice is much louder than mic bleed -> should NOT suppress
  assert.equal(gate.shouldSuppressThem(themLoud), false);
});

test('CrossChannelEchoGate: aggressive mode strictly mutes them channel during candidate speech', () => {
  const gate = new CrossChannelEchoGate({ mode: 'aggressive', hangoverMs: 300 });
  const youAudio = makePcm(480, 2000);
  const themLoud = makePcm(480, 5000);

  gate.onYouFrame(youAudio, true);
  // In aggressive mode, all them audio within hangover is suppressed
  assert.equal(gate.shouldSuppressThem(themLoud), true);
});

test('CrossChannelEchoGate: hangover expires and resumes normal pass-through', async () => {
  const gate = new CrossChannelEchoGate({ mode: 'balanced', hangoverMs: 50 });
  const youAudio = makePcm(480, 3000);
  const themAudio = makePcm(480, 500);

  gate.onYouFrame(youAudio, true);
  assert.equal(gate.shouldSuppressThem(themAudio), true);

  // Wait for hangover to expire
  await new Promise((resolve) => setTimeout(resolve, 70));
  assert.equal(gate.shouldSuppressThem(themAudio), false);
});
