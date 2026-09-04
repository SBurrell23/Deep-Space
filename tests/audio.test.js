import { describe, it, assert } from './harness.js';
import * as bus from '../src/audio/bus.js';
import { play, soundNames, SFX, voiceCount, __clearVoices } from '../src/audio/sfx.js';
import * as music from '../src/audio/music.js';

describe('audio bus', () => {
  it('loads defaults when storage is empty', () => {
    localStorage.clear();
    const s = bus.loadSettings();
    assert.between(s.master, 0, 1);
    assert.between(s.music, 0, 1);
    assert.between(s.sfx, 0, 1);
    assert.equal(s.muted, false);
  });

  it('persists settings across a reload', () => {
    localStorage.clear();
    bus.loadSettings();
    bus.setSetting('music', 0.25);
    bus.setSetting('muted', true);
    const raw = JSON.parse(localStorage.getItem('deepspace.audio.v1'));
    assert.close(raw.music, 0.25);
    assert.equal(raw.muted, true);
    // Scribble over the in-memory value only, then reload from storage.
    bus.settings.music = 1;
    bus.loadSettings();
    assert.close(bus.settings.music, 0.25, 1e-9, 'reload should restore the stored value');
  });

  it('clamps out-of-range and garbage values', () => {
    bus.setSetting('sfx', 5);
    assert.equal(bus.settings.sfx, 1);
    bus.setSetting('sfx', -3);
    assert.equal(bus.settings.sfx, 0);
    bus.setSetting('sfx', 'banana');
    assert.between(bus.settings.sfx, 0, 1, 'a non-numeric value must fall back, not become NaN');
  });

  it('survives corrupt stored JSON', () => {
    localStorage.setItem('deepspace.audio.v1', '{not json');
    const s = bus.loadSettings();
    assert.between(s.master, 0, 1);
  });

  it('reports zero channel level when muted', () => {
    bus.resetSettings();
    assert.greater(bus.channelLevel('sfx'), 0);
    bus.setSetting('muted', true);
    assert.equal(bus.channelLevel('sfx'), 0);
    assert.equal(bus.channelLevel('music'), 0);
    bus.setSetting('muted', false);
  });

  it('creates a running context on unlock', () => {
    const ctx = bus.unlock();
    assert.ok(ctx, 'expected a context');
    assert.equal(bus.isUnlocked(), true);
  });

  it('notifies subscribers on change and stops after unsubscribe', () => {
    let seen = 0;
    const off = bus.onSettingsChange(() => seen++);
    bus.setSetting('master', 0.6);
    assert.equal(seen, 1);
    off();
    bus.setSetting('master', 0.7);
    assert.equal(seen, 1);
  });
});

describe('sfx synthesis', () => {
  const freshBus = () => {
    bus.resetSettings();
    bus.unlock();
    __clearVoices();
  };

  it('has a substantial library', () => {
    assert.greater(soundNames().length, 60);
  });

  it('plays every registered sound without throwing', () => {
    bus.resetSettings();
    bus.unlock();
    const broken = [];
    for (const name of soundNames()) {
      // play() swallows errors by design, so invoke each generator directly.
      try { SFX[name]({}); } catch (e) { broken.push(`${name}: ${e.message}`); }
    }
    assert.deepEqual(broken, [], 'every sound must synthesise cleanly');
  });

  it('returns false for unknown sounds instead of throwing', () => {
    assert.equal(play('no_such_sound'), false);
  });

  it('is silent when the sfx channel is at zero', () => {
    freshBus();
    bus.setSetting('sfx', 0);
    assert.equal(play('click'), false);
    bus.setSetting('sfx', 0.75);
    assert.equal(play('click'), true);
  });

  it('never schedules an exponential ramp to zero', () => {
    // The fake AudioParam throws on exp-ramp-to-0, the classic Web Audio
    // footgun; playing the whole library above would have surfaced it.
    freshBus();
    assert.equal(play('explosion_large'), true);
  });

  it('honours the per-sound throttle', () => {
    freshBus();
    assert.equal(play('hull_hit', { throttle: 500 }), true);
    assert.equal(play('hull_hit', { throttle: 500 }), false, 'a second call inside the window is dropped');
  });

  it('caps concurrent voices instead of drowning the mix', () => {
    freshBus();
    let accepted = 0;
    for (let i = 0; i < 200; i++) if (play('laser_light')) accepted++;
    assert.between(accepted, 1, 24, 'the voice budget must hold');
  });

  it('recovers its voice budget as sounds finish', () => {
    freshBus();
    while (play('laser_light')) { /* saturate */ }
    assert.equal(play('laser_light'), false);
    // Advance the audio clock past every scheduled tail.
    bus.context().advance(10);
    assert.equal(voiceCount(), 0, 'expired voices must be reclaimed');
    assert.equal(play('laser_light'), true, 'the budget must free up again');
  });
});

describe('music player', () => {
  it('rejects unknown tracks', () => {
    music.__reset();
    assert.equal(music.play('nope'), false);
  });

  it('starts the main theme', () => {
    music.__reset();
    bus.resetSettings();
    assert.equal(music.play('main'), true);
    assert.equal(music.currentTrackName(), 'main');
  });

  it('exposes the bundled soundtrack', () => {
    assert.includes(music.trackNames(), 'main');
  });
});
