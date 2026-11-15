// Проверки к 14.04 в Chromium с фейковой камерой: безопасный контекст, getUserMedia и дорожки, MediaRecorder,
// Web Audio (OfflineAudioContext, политика автозапуска), WebRTC между двумя соединениями с ручным сигналингом.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { chromium } from 'playwright-core';
import { findChromium } from '../../_lib/browser.mjs';

const server = await new Promise((resolve) => {
  const s = createServer((req, res) => { res.setHeader('content-type', 'text/html; charset=utf-8'); res.end('<!doctype html><video id="v" autoplay muted playsinline></video>'); }).listen(0, () => resolve(s));
});
const port = server.address().port;
const browser = await chromium.launch({
  executablePath: findChromium(),
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--host-resolver-rules=MAP shop.test 127.0.0.1'],
});

try {
  const context = await browser.newContext();
  const page = await context.newPage();

  // --- небезопасный контекст: http на обычном домене — mediaDevices нет вовсе ---
  await page.goto(`http://shop.test:${port}/`);
  assert.deepEqual(await page.evaluate(() => [isSecureContext, typeof navigator.mediaDevices]), [false, 'undefined']);

  // --- localhost считается безопасным ---
  await context.grantPermissions(['camera', 'microphone'], { origin: `http://localhost:${port}` });
  await page.goto(`http://localhost:${port}/`);
  const capture = await page.evaluate(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: true });
    document.getElementById('v').srcObject = stream;
    const [video] = stream.getVideoTracks();
    const settings = video.getSettings();
    const kinds = stream.getTracks().map((t) => t.kind).sort();
    // запись полсекунды
    const chunks = [];
    const recorder = new MediaRecorder(stream);
    recorder.ondataavailable = (e) => chunks.push(e.data);
    recorder.start();
    await new Promise((r) => setTimeout(r, 500));
    await new Promise((r) => { recorder.onstop = r; recorder.stop(); });
    const blob = new Blob(chunks, { type: recorder.mimeType });
    stream.getTracks().forEach((t) => t.stop()); // выключить камеру
    return { secure: isSecureContext, kinds, width: settings.width, height: settings.height, mime: recorder.mimeType, size: blob.size, state: video.readyState };
  });
  assert.equal(capture.secure, true);
  assert.deepEqual(capture.kinds, ['audio', 'video']);
  assert.deepEqual([capture.width, capture.height], [640, 480]);
  assert.match(capture.mime, /^video\/webm/);
  assert.ok(capture.size > 1000, String(capture.size));
  assert.equal(capture.state, 'ended'); // после stop() дорожка завершена, индикатор камеры гаснет

  // --- Web Audio: граф узлов, рендер без колонок ---
  const audio = await page.evaluate(async () => {
    const ctx = new OfflineAudioContext(1, 44100, 44100); // 1 секунда, моно
    const osc = new OscillatorNode(ctx, { frequency: 440 });
    const gain = new GainNode(ctx, { gain: 0.5 });
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    const buffer = await ctx.startRendering();
    const data = buffer.getChannelData(0);
    let peak = 0, crossings = 0;
    for (let i = 1; i < data.length; i++) { peak = Math.max(peak, Math.abs(data[i])); if (data[i - 1] < 0 && data[i] >= 0) crossings++; }
    return { peak: Math.round(peak * 100) / 100, crossings, live: new AudioContext().state };
  });
  assert.equal(audio.peak, 0.5);    // громкость 0,5
  assert.ok(Math.abs(audio.crossings - 440) <= 1); // 440 колебаний за секунду
  console.log(`  AudioContext без жеста пользователя: ${audio.live}`);

  // --- WebRTC: два соединения на одной странице, сигналинг — наш код ---
  const rtc = await page.evaluate(async () => {
    const a = new RTCPeerConnection();
    const b = new RTCPeerConnection();
    // без обмена описаниями соединения нет
    const lonely = new RTCPeerConnection();
    lonely.createDataChannel('x');
    await lonely.setLocalDescription(await lonely.createOffer());
    await new Promise((r) => setTimeout(r, 300));
    const lonelyState = lonely.connectionState;

    // «сигналинг»: ICE-кандидаты и SDP передаём сами
    a.onicecandidate = (e) => e.candidate && b.addIceCandidate(e.candidate);
    b.onicecandidate = (e) => e.candidate && a.addIceCandidate(e.candidate);
    const candidateTypes = new Set();
    a.addEventListener('icecandidate', (e) => e.candidate && candidateTypes.add(e.candidate.type));

    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    stream.getTracks().forEach((t) => a.addTrack(t, stream));
    const remoteTrack = new Promise((r) => { b.ontrack = (e) => r(e.track.kind); });

    const channel = a.createDataChannel('chat');
    const received = new Promise((r) => { b.ondatachannel = (e) => { e.channel.onmessage = (m) => r(m.data); }; });

    const offer = await a.createOffer();
    await a.setLocalDescription(offer);
    await b.setRemoteDescription(offer);
    const answer = await b.createAnswer();
    await b.setLocalDescription(answer);
    await a.setRemoteDescription(answer);

    await new Promise((r) => { channel.onopen = r; });
    channel.send('привет, это канал данных');
    const message = await received;
    const kind = await remoteTrack;
    await new Promise((r) => (a.connectionState === 'connected' ? r() : a.addEventListener('connectionstatechange', () => a.connectionState === 'connected' && r())));
    return {
      lonelyState, message, kind, state: a.connectionState,
      sdpVideo: /^m=video /m.test(offer.sdp), sdpData: /^m=application .*webrtc-datachannel/m.test(offer.sdp),
      fingerprint: /^a=fingerprint:sha-256 /m.test(offer.sdp), types: [...candidateTypes],
    };
  });
  assert.equal(rtc.lonelyState, 'new');      // предложение есть, ответа нет — соединения нет
  assert.equal(rtc.message, 'привет, это канал данных');
  assert.equal(rtc.kind, 'video');
  assert.equal(rtc.state, 'connected');
  assert.ok(rtc.sdpVideo && rtc.sdpData);
  assert.ok(rtc.fingerprint);                 // DTLS-отпечаток: шифрование обязательно
  assert.ok(rtc.types.includes('host'));      // без STUN — только локальные кандидаты
} finally {
  await browser.close();
  server.close();
}
console.log('media ok');
