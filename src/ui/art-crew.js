/**
 * Deep Space — hand-authored crew, system and status pixel art.
 *
 * Every sprite is a plain data record consumed by ./pixel.js:
 *   { pal: { <char>: '#rrggbb' }, rows: ['....', '....'] }
 *
 * Conventions used throughout this file:
 *   - Light source is TOP-LEFT. Highlights sit on upper-left facets, the
 *     darkest shade rides the lower-right edge, and a near-black key line
 *     wraps the silhouette so sprites read on any panel colour.
 *   - Crew are 12x12, framed as a top-down-ish 3/4 view facing the camera.
 *   - System icons are 16x16, resource/status icons are 12x12.
 *   - Palette keys are kept consistent per family so shading reads the same
 *     way across sprites: k = key line, d/m/l/h = dark..highlight ramp,
 *     w = specular white, and a race/accent hue on top.
 */

import { register } from './pixel.js';

/* ------------------------------------------------------------------ */
/* Shared hexes                                                        */
/* ------------------------------------------------------------------ */

const VOID = '#05070f';
const DEEP = '#0a0f1e';
const PANEL = '#121a2e';
const STEEL1 = '#2a3550';
const STEEL2 = '#3d4a6b';
const STEEL3 = '#5a6a91';
const STEEL4 = '#8494b8';
const WHITE = '#e8f0ff';
const CYAN1 = '#0d5a6b';
const CYAN2 = '#17a2b8';
const CYAN3 = '#4fe3f5';
const AMBER1 = '#7a4a10';
const AMBER2 = '#d98c1f';
const AMBER3 = '#ffcc5c';
const RED1 = '#5c1420';
const RED2 = '#b3243c';
const RED3 = '#ff5c72';
const GREEN1 = '#145c33';
const GREEN2 = '#22b35c';
const GREEN3 = '#5cf59b';
const PURPLE1 = '#3a1a5c';
const PURPLE2 = '#7b3fb3';
const PURPLE3 = '#c07ef5';
const SKIN1 = '#7a4a3a';
const SKIN2 = '#b87a5c';
const SKIN3 = '#e3ab89';
const BLACK = '#000000';

/* Palettes shared by the four animation frames of each race. ------- */

const P_HUMAN = {
  k: VOID, d: STEEL1, m: STEEL2, l: STEEL3, h: STEEL4, w: WHITE,
  v: CYAN1, c: CYAN2, g: CYAN3, s: SKIN2,
};
const P_HUMAN_DEAD = { k: VOID, d: STEEL1, m: STEEL2, v: CYAN1, r: RED1 };

const P_ENGI = {
  k: VOID, d: STEEL1, m: STEEL2, l: STEEL3, h: STEEL4, w: WHITE,
  e: GREEN1, n: GREEN2, g: GREEN3,
};
const P_ENGI_DEAD = { k: VOID, d: STEEL1, m: STEEL2, e: GREEN1 };

const P_MANTIS = {
  k: VOID, e: GREEN1, n: GREEN2, g: GREEN3,
  q: '#8fbf2a', y: '#c9e04a',
  r: RED1, o: RED3, d: STEEL1,
};
const P_MANTIS_DEAD = { k: VOID, e: GREEN1, q: '#6f9420', r: RED1 };

const P_ROCK = {
  k: VOID, b: '#3d2410', d: AMBER1, m: '#a8631a', l: AMBER2, h: AMBER3, w: WHITE,
};
const P_ROCK_DEAD = { k: VOID, b: '#3d2410', d: AMBER1, m: '#8a5214' };

const P_ZOLTAN = {
  a: AMBER1, b: '#a8690f', y: AMBER2, g: AMBER3, w: '#fff2b8', k: VOID,
};
const P_ZOLTAN_DEAD = { k: VOID, a: AMBER1, b: '#a8690f', y: AMBER2, d: STEEL1 };

const P_SLUG = {
  k: VOID, d: PURPLE1, m: '#5a2a85', p: PURPLE2, l: PURPLE3, w: '#e9d0ff',
  y: AMBER3, b: BLACK,
};
const P_SLUG_DEAD = { k: VOID, d: PURPLE1, m: '#4a2270', p: '#5f2f8f' };

const P_CRYSTAL = {
  k: VOID, b: '#0a3040', m: CYAN1, l: CYAN2, c: '#7fd6e8', g: CYAN3, w: WHITE,
};
const P_CRYSTAL_DEAD = { k: VOID, b: '#0a3040', m: CYAN1, l: '#16778c', c: '#4a9fb0' };

const P_SYNTH = {
  k: VOID, d: STEEL1, m: STEEL2, l: STEEL3, h: STEEL4, s: '#c3d0e8', w: WHITE,
  v: CYAN1, c: CYAN2, g: CYAN3,
};
const P_SYNTH_DEAD = { k: VOID, d: STEEL1, m: STEEL2, s: '#7d8aa8', v: CYAN1 };

const P_VEX = {
  k: VOID, b: DEEP, d: '#1a2135', m: STEEL1, l: STEEL2, h: STEEL3,
  r: RED1, o: RED2, x: RED3, w: WHITE,
};
const P_VEX_DEAD = { k: VOID, m: STEEL1, l: STEEL2, x: RED1 };

/**
 * One master palette for every icon. Keeping a single key->hex mapping across
 * all 46 icons means a glyph copied from one icon shades identically in the
 * next, and there is only one table to audit.
 *
 *   k b t     key line, deep, panel
 *   d m l h w steel ramp, dark -> highlight, plus specular white
 *   v c g     cyan ramp
 *   a o y     amber ramp
 *   e n s     green ramp
 *   r x q     red ramp
 *   i p u     purple ramp
 *   f j z     skin ramp
 */
const P_I = {
  k: VOID, b: DEEP, t: PANEL,
  d: STEEL1, m: STEEL2, l: STEEL3, h: STEEL4, w: WHITE,
  v: CYAN1, c: CYAN2, g: CYAN3,
  a: AMBER1, o: AMBER2, y: AMBER3,
  e: GREEN1, n: GREEN2, s: GREEN3,
  r: RED1, x: RED2, q: RED3,
  i: PURPLE1, p: PURPLE2, u: PURPLE3,
  f: SKIN1, j: SKIN2, z: SKIN3,
};

export const CREW_ART = {
  /* ================= HUMAN =========================================
     Rounded helmet, bright cyan visor, grey-blue hardsuit. */
  crew_human_idle0: {
    pal: P_HUMAN,
    rows: [
      '....hhll....',
      '..khhhllmk..',
      '.khwggccvmk.',
      '.khwgcccvmk.',
      '.khmccvvvmk.',
      '...hllmmm...',
      '.hhlmmmmldk.',
      '.hlwmccmmdk.',
      '.hlmmccmmdk.',
      '..lmmmmmdk..',
      '..lmk..hmk..',
      '..dkk..dkk..',
    ],
  },
  crew_human_idle1: {
    pal: P_HUMAN,
    rows: [
      '....hhll....',
      '..khhhllmk..',
      '.khwgcccvmk.',
      '.khmcccvvmk.',
      '.khmccvvvmk.',
      '...hlmmmm...',
      '.hhlmmmmldk.',
      '.hlmmccmmdk.',
      '.hlwmccmmdk.',
      '..lmmmmmdk..',
      '..lmk..hmk..',
      '..dkk..dkk..',
    ],
  },
  crew_human_walk0: {
    pal: P_HUMAN,
    rows: [
      '....hhll....',
      '..khhhllmk..',
      '.khwggccvmk.',
      '.khwgcccvmk.',
      '.khmccvvvmk.',
      '...hllmmm...',
      'hhllmmmmld..',
      '.hlwmccmmdk.',
      '.hlmmccmmdk.',
      '..lmmmmmdkk.',
      '.lmk...hmk..',
      '.dk.....dkk.',
    ],
  },
  crew_human_walk1: {
    pal: P_HUMAN,
    rows: [
      '....hhll....',
      '..khhhllmk..',
      '.khwggccvmk.',
      '.khwgcccvmk.',
      '.khmccvvvmk.',
      '...hllmmm...',
      '..hlmmmmldkk',
      '.hlwmccmmdk.',
      '.hlmmccmmdk.',
      '.hlmmmmmdk..',
      '..lmk...hmk.',
      '.lkk.....dk.',
    ],
  },
  crew_human_dead: {
    pal: P_HUMAN_DEAD,
    rows: [
      '............',
      '............',
      '.....kkkk...',
      '....kdvvmk..',
      '...kdmvvmk..',
      '..kdmmmdk...',
      '.kdmmmmmdk..',
      'kdmmdmmmmdk.',
      '.kddmmmddkk.',
      '..kkddddkk..',
      '...kdrdk....',
      '............',
    ],
  },

  /* ================= ENGI ==========================================
     Android: boxed head, no visor, single green optic, thin limbs. */
  crew_engi_idle0: {
    pal: P_ENGI,
    rows: [
      '...hhhhll...',
      '..hlmmmmld..',
      '..hlmgnemd..',
      '..hlmmnemd..',
      '..dmmmmmdk..',
      '....hmml....',
      '.h.hlmmld.d.',
      '.h.lmnnmd.d.',
      '.h.lmnnmd.d.',
      '.d.lmmmmd.k.',
      '...lm..hd...',
      '...dk..dk...',
    ],
  },
  crew_engi_idle1: {
    pal: P_ENGI,
    rows: [
      '...hhhhll...',
      '..hlmmmmld..',
      '..hlmmnemd..',
      '..hlmgnemd..',
      '..dmmmmmdk..',
      '....hmml....',
      '.h.hlmmld.d.',
      '.h.lmnnmd.d.',
      '.h.lmnegd.d.',
      '.d.lmmmmd.k.',
      '...lm..hd...',
      '...dk..dk...',
    ],
  },
  crew_engi_walk0: {
    pal: P_ENGI,
    rows: [
      '...hhhhll...',
      '..hlmmmmld..',
      '..hlmgnemd..',
      '..hlmmnemd..',
      '..dmmmmmdk..',
      '....hmml....',
      'h..hlmmld..d',
      'h..lmnnmd..d',
      '.h.lmnnmd.d.',
      '.d.lmmmmd.k.',
      '..lm....hd..',
      '..dk.....dk.',
    ],
  },
  crew_engi_walk1: {
    pal: P_ENGI,
    rows: [
      '...hhhhll...',
      '..hlmmmmld..',
      '..hlmgnemd..',
      '..hlmmnemd..',
      '..dmmmmmdk..',
      '....hmml....',
      '.d.hlmmld..h',
      '.d.lmnnmd..h',
      '.d.lmnnmd.h.',
      '.k.lmmmmd.d.',
      '...lm...hd..',
      '..dk......dk',
    ],
  },
  crew_engi_dead: {
    pal: P_ENGI_DEAD,
    rows: [
      '............',
      '............',
      '....kkk.....',
      '...kdemk....',
      '..kdmmmdk...',
      '.kdmmmmmdk..',
      'kdmmdmmmdkk.',
      '.kddmmmddk..',
      '..kkdddkk...',
      '...kd.dk....',
      '............',
      '............',
    ],
  },

  /* ================= MANTIS ========================================
     Insectoid: antennae, angular carapace, mandibles, hunched stance. */
  crew_mantis_idle0: {
    pal: P_MANTIS,
    rows: [
      '.y........y.',
      '..yqqqqqqe..',
      '.kyooqqooek.',
      '.kyqorroqek.',
      '..kqrrrrek..',
      '...eqqqqe...',
      '.y.eqqqqe.e.',
      '.yqqqnnqqqe.',
      '.eyqqnnqqee.',
      '..eqqqqqe...',
      '..eq..qe....',
      '.qk....kq...',
    ],
  },
  crew_mantis_idle1: {
    pal: P_MANTIS,
    rows: [
      '..y......y..',
      '..yqqqqqqe..',
      '.kyoqqqqoek.',
      '.kyqorroqek.',
      '..kqrrrrek..',
      '...eqqqqe...',
      '.y.eqqqqe.e.',
      '.yqqnnnnqqe.',
      '.eyqqnnqqee.',
      '..eqqqqqe...',
      '..eq..qe....',
      '.qk....kq...',
    ],
  },
  crew_mantis_walk0: {
    pal: P_MANTIS,
    rows: [
      '.y........y.',
      '..yqqqqqqe..',
      '.kyooqqooek.',
      '.kyqorroqek.',
      '..kqrrrrek..',
      '...eqqqqe...',
      'y..eqqqqe..e',
      '.yqqqnnqqqe.',
      '.eyqqnnqqee.',
      '.eqqqqqqe...',
      '.eq....qqe..',
      'qk.......ke.',
    ],
  },
  crew_mantis_walk1: {
    pal: P_MANTIS,
    rows: [
      '.y........y.',
      '..yqqqqqqe..',
      '.kyooqqooek.',
      '.kyqorroqek.',
      '..kqrrrrek..',
      '...eqqqqe...',
      '.e.eqqqqe.y.',
      '.yqqqnnqqqe.',
      '.eyqqnnqqee.',
      '...eqqqqqqe.',
      '..eqq....qe.',
      '.eq.......kq',
    ],
  },
  crew_mantis_dead: {
    pal: P_MANTIS_DEAD,
    rows: [
      '............',
      '............',
      '.....kkk....',
      '...kkerreek.',
      '..keqqqqek..',
      '.keqqeqqqek.',
      'keqqqqqqqek.',
      '.keeqqqeek..',
      '..kkeeekk...',
      '...k...kk...',
      '............',
      '............',
    ],
  },

  /* ================= ROCKMAN =======================================
     Small head sunk between enormous craggy stone shoulders. */
  crew_rockman_idle0: {
    pal: P_ROCK,
    rows: [
      '....hlld....',
      '...hmlldm...',
      '...hmwwdm...',
      '...dmmmdb...',
      '.hhlmmmmldb.',
      'hhlmlmmlmldb',
      'hlmmlmmlmmdb',
      'hlmmmllmmmdb',
      '.dmmmlmmmdb.',
      '.bdmmmmmmdb.',
      '..lmb..lmb..',
      '..dbb..dbb..',
    ],
  },
  crew_rockman_idle1: {
    pal: P_ROCK,
    rows: [
      '....hlld....',
      '...hmlldm...',
      '...hmwhdm...',
      '...dmmmdb...',
      '.hhlmmmmldb.',
      'hhlmmlmlmldb',
      'hlmmlmmlmmdb',
      'hlmmlmlmmmdb',
      '.dmmmlmmmdb.',
      '.bdmmmmmmdb.',
      '..lmb..lmb..',
      '..dbb..dbb..',
    ],
  },
  crew_rockman_walk0: {
    pal: P_ROCK,
    rows: [
      '....hlld....',
      '...hmlldm...',
      '...hmwwdm...',
      '...dmmmdb...',
      'hhhlmmmmldb.',
      'hhlmlmmlmldb',
      'hlmmlmmlmmdb',
      'hlmmmllmmmdb',
      '.dmmmlmmmdbb',
      '.bdmmmmmmdb.',
      '.lmb...lmb..',
      '.dbb....dbb.',
    ],
  },
  crew_rockman_walk1: {
    pal: P_ROCK,
    rows: [
      '....hlld....',
      '...hmlldm...',
      '...hmwwdm...',
      '...dmmmdb...',
      '.hhlmmmmldbb',
      'hhlmlmmlmldb',
      'hlmmlmmlmmdb',
      'hlmmmllmmmdb',
      'hhdmmmlmmmdb',
      '.bdmmmmmmdb.',
      '..lmb...lmb.',
      '.dbb.....dbb',
    ],
  },
  crew_rockman_dead: {
    pal: P_ROCK_DEAD,
    rows: [
      '............',
      '............',
      '....kkkk....',
      '...kbmmbk...',
      '..kbmmmmbk..',
      '.kbmmdmmmbk.',
      'kbmmmmmmmbkk',
      '.kbmdmmmbk..',
      '..kbbmmbbk..',
      '...kbbbbk...',
      '....kbbk....',
      '............',
    ],
  },

  /* ================= ZOLTAN ========================================
     Energy being: no key line, the silhouette is a bright halo that
     falls off into deep amber at the lower-right. */
  crew_zoltan_idle0: {
    pal: P_ZOLTAN,
    rows: [
      '....wyya....',
      '..wygbbyaa..',
      '.wygwwggbya.',
      '.wygwggbbya.',
      '..ygwggbya..',
      '...wyybaa...',
      '.w.ygwwbya.a',
      '.wygwggbbya.',
      '.wygggbbyaa.',
      '..ygwbbyaa..',
      '..ygb..bya..',
      '..ya....ab..',
    ],
  },
  crew_zoltan_idle1: {
    pal: P_ZOLTAN,
    rows: [
      '....wyya....',
      '..wygbbyaa..',
      '.wygwwwgbya.',
      '.wygwwgbbya.',
      '..ygwggbya..',
      '...wyybaa...',
      '.w.ygwwbya.a',
      '.wygwwgbbya.',
      '.wyggwbbyaa.',
      '..ygwbbyaa..',
      '..ygb..bya..',
      '..ya....ab..',
    ],
  },
  crew_zoltan_walk0: {
    pal: P_ZOLTAN,
    rows: [
      '....wyya....',
      '..wygbbyaa..',
      '.wygwwggbya.',
      '.wygwggbbya.',
      '..ygwggbya..',
      '...wyybaa...',
      'w..ygwwbya.a',
      '.wygwggbbya.',
      '.wygggbbyaa.',
      '.wygwbbyaaa.',
      '.ygb....bya.',
      '.ya......ab.',
    ],
  },
  crew_zoltan_walk1: {
    pal: P_ZOLTAN,
    rows: [
      '....wyya....',
      '..wygbbyaa..',
      '.wygwwggbya.',
      '.wygwggbbya.',
      '..ygwggbya..',
      '...wyybaa...',
      '.w.ygwwbya.a',
      '.wygwggbbya.',
      '.wygggbbyaa.',
      '.wwygwbbyaa.',
      '..ygb...bya.',
      '..ya......ab',
    ],
  },
  crew_zoltan_dead: {
    pal: P_ZOLTAN_DEAD,
    rows: [
      '............',
      '............',
      '.....aab....',
      '....abyba...',
      '..aabyybaa..',
      '.abyybbyaba.',
      'aabyybbyaab.',
      '.aabbbbaaa..',
      '..aaabaaa...',
      '...aa.a.....',
      '............',
      '............',
    ],
  },

  /* ================= SLUG ==========================================
     Legless purple blob, huge lidded eyes, glossy top-left sheen. */
  crew_slug_idle0: {
    pal: P_SLUG,
    rows: [
      '....lppd....',
      '..lwppppmd..',
      '.lwppppppmd.',
      '.lwybppybmd.',
      '.lwpbppbpmd.',
      '.lwppmmppmd.',
      'lwpppppppmdd',
      'lwppplppmmdd',
      '.lwpppppmdd.',
      '..lwpppmmd..',
      '..mlppmmdd..',
      '...dmmmdd...',
    ],
  },
  crew_slug_idle1: {
    pal: P_SLUG,
    rows: [
      '....lppd....',
      '..lwppppmd..',
      '.lwppppppmd.',
      '.lwpmppmpmd.',
      '.lwppppppmd.',
      '.lwppmmppmd.',
      'lwpppppppmdd',
      'lwpppplpmmdd',
      '.lwpppppmdd.',
      '..lwpppmmd..',
      '..mlppmmdd..',
      '...dmmmdd...',
    ],
  },
  crew_slug_walk0: {
    pal: P_SLUG,
    rows: [
      '...lppd.....',
      '..lwppppmd..',
      '.lwppppppmd.',
      '.lwybppybmd.',
      '.lwpbppbpmd.',
      '.lwppmmppmd.',
      'lwpppppppmd.',
      'lwppplppmmd.',
      '.lwpppppmddd',
      '..lwpppmmdd.',
      '.mlppmmddd..',
      '..dmmmdd....',
    ],
  },
  crew_slug_walk1: {
    pal: P_SLUG,
    rows: [
      '.....lppd...',
      '..lwppppmd..',
      '.lwppppppmd.',
      '.lwybppybmd.',
      '.lwpbppbpmd.',
      '.lwppmmppmd.',
      '.lwpppppppmd',
      '.lwppplppmmd',
      'llwpppppmdd.',
      '.llwpppmmd..',
      '..mmlppmmdd.',
      '....dmmmdd..',
    ],
  },
  crew_slug_dead: {
    pal: P_SLUG_DEAD,
    rows: [
      '............',
      '............',
      '............',
      '...kkkkk....',
      '..kpppdmk...',
      '.kppmpppdk..',
      'kpppppppdmk.',
      '.kppmpppdk..',
      '..kppdddk...',
      '...kdddk....',
      '............',
      '............',
    ],
  },

  /* ================= CRYSTAL =======================================
     Faceted prism body; every plane change is a hard shade step. */
  crew_crystal_idle0: {
    pal: P_CRYSTAL,
    rows: [
      '...wggc.....',
      '..wgggclm...',
      '.wgggcclmb..',
      '.wggcclllmb.',
      '..gcclllmb..',
      '...cclmmb...',
      'wg.gccllmb.m',
      '.wgggcclmmb.',
      '.wggcclllmb.',
      '..gcclllmb..',
      '..gcl..lmb..',
      '..cmb.cmb...',
    ],
  },
  crew_crystal_idle1: {
    pal: P_CRYSTAL,
    rows: [
      '...wggc.....',
      '..wggcclm...',
      '.wggccclmb..',
      '.wgccclllmb.',
      '..ccclllmb..',
      '...cclmmb...',
      'wg.gccllmb.m',
      '.wggcccllmb.',
      '.wgccclllmb.',
      '..gcclllmb..',
      '..gcl..lmb..',
      '..cmb.cmb...',
    ],
  },
  crew_crystal_walk0: {
    pal: P_CRYSTAL,
    rows: [
      '...wggc.....',
      '..wgggclm...',
      '.wgggcclmb..',
      '.wggcclllmb.',
      '..gcclllmb..',
      '...cclmmb...',
      'g..gccllmb.m',
      '.wgggcclmmb.',
      '.wggcclllmb.',
      '.gcclllmbb..',
      '.gcl...lmb..',
      '.cmb....cmb.',
    ],
  },
  crew_crystal_walk1: {
    pal: P_CRYSTAL,
    rows: [
      '...wggc.....',
      '..wgggclm...',
      '.wgggcclmb..',
      '.wggcclllmb.',
      '..gcclllmb..',
      '...cclmmb...',
      'wg.gccllmb.b',
      '.wgggcclmmb.',
      '.wggcclllmb.',
      '..wgcclllmb.',
      '..gcl...lmb.',
      '.cmb.....cmb',
    ],
  },
  crew_crystal_dead: {
    pal: P_CRYSTAL_DEAD,
    rows: [
      '............',
      '............',
      '............',
      '....kkk.k...',
      '...kclmbk...',
      '..kclllmbk..',
      '.kcllmlllbk.',
      'kcllllllmbk.',
      '.kclllmmbk..',
      '..kkbmmbk...',
      '...k.bb.k...',
      '............',
    ],
  },

  /* ================= SYNTH =========================================
     Sleek chrome plating, white specular top-left, cyan seams. */
  crew_synth_idle0: {
    pal: P_SYNTH,
    rows: [
      '...swwwh....',
      '..swwwhhlm..',
      '.swwhhhhlmd.',
      '.swgcccvvmd.',
      '..dshhhlmd..',
      '...swhlm....',
      'swwhhhhhlmmd',
      '.swhhcchlmd.',
      '.swhhcchlmd.',
      '..shhhhhmd..',
      '..shl..hlm..',
      '..dmm..dmd..',
    ],
  },
  crew_synth_idle1: {
    pal: P_SYNTH,
    rows: [
      '...swwwh....',
      '..swwwhhlm..',
      '.swwhhhhlmd.',
      '.swgggccvmd.',
      '..dshhhlmd..',
      '...swhlm....',
      'swwhhhhhlmmd',
      '.swhhcchlmd.',
      '.swhhvvhlmd.',
      '..shhhhhmd..',
      '..shl..hlm..',
      '..dmm..dmd..',
    ],
  },
  crew_synth_walk0: {
    pal: P_SYNTH,
    rows: [
      '...swwwh....',
      '..swwwhhlm..',
      '.swwhhhhlmd.',
      '.swgcccvvmd.',
      '..dshhhlmd..',
      '...swhlm....',
      'sswwhhhhhlmm',
      '.swhhcchlmd.',
      '.swhhcchlmd.',
      '.sshhhhhmdd.',
      '.shl....hlm.',
      '.dmm.....dmd',
    ],
  },
  crew_synth_walk1: {
    pal: P_SYNTH,
    rows: [
      '...swwwh....',
      '..swwwhhlm..',
      '.swwhhhhlmd.',
      '.swgcccvvmd.',
      '..dshhhlmd..',
      '...swhlm....',
      'swwhhhhhlmmm',
      '.swhhcchlmd.',
      '.swhhcchlmd.',
      '..sshhhhhmdd',
      '..shl...hlm.',
      '.dmm......dm',
    ],
  },
  crew_synth_dead: {
    pal: P_SYNTH_DEAD,
    rows: [
      '............',
      '............',
      '............',
      '....kkkk....',
      '...ksvvmk...',
      '..ksmmmdk...',
      '.ksmmmmmdk..',
      'ksmmdmmmmdk.',
      '.ksmmmmddk..',
      '..kkdmddkk..',
      '...kd..dk...',
      '............',
    ],
  },

  /* ================= VEX ===========================================
     Lean sprinter: narrow torso, very long limbs, red visor slit. */
  crew_vex_idle0: {
    pal: P_VEX,
    rows: [
      '....mllb....',
      '...hmllmb...',
      '...hxxxxmb..',
      '...hmllmbb..',
      '....mllb....',
      '.h.hmllmb.b.',
      '.h.hmxxmb.b.',
      '.h.hmllmb.b.',
      '.m.hmllmb.m.',
      '.b.hmllmb.b.',
      '...hmb.lmb..',
      '..hxb...xb..',
    ],
  },
  crew_vex_idle1: {
    pal: P_VEX,
    rows: [
      '....mllb....',
      '...hmllmb...',
      '...hmxxmb...',
      '...hmllmbb..',
      '....mllb....',
      '.h.hmllmb.b.',
      '.h.hmxxmb.b.',
      '.h.hmllmb.b.',
      '.m.hmllmb.m.',
      '.b.hmllmb.b.',
      '...hmb.lmb..',
      '..hxb...xb..',
    ],
  },
  crew_vex_walk0: {
    pal: P_VEX,
    rows: [
      '....mllb....',
      '...hmllmb...',
      '...hxxxxmb..',
      '...hmllmbb..',
      '....mllb....',
      'h..hmllmb..b',
      'h..hmxxmb..b',
      '.h.hmllmb.b.',
      '.m.hmllmb.m.',
      '.b.hmllmbb..',
      '..hmb...lmb.',
      '.hxb......xb',
    ],
  },
  crew_vex_walk1: {
    pal: P_VEX,
    rows: [
      '....mllb....',
      '...hmllmb...',
      '...hxxxxmb..',
      '...hmllmbb..',
      '....mllb....',
      '.b..hmllmb.h',
      '.b..hmxxmb.h',
      '.b.hmllmb.h.',
      '.m.hmllmb.m.',
      '..bhmllmb.b.',
      '.hmb...lmb..',
      'hxb......xb.',
    ],
  },
  crew_vex_dead: {
    pal: P_VEX_DEAD,
    rows: [
      '............',
      '............',
      '............',
      '.....kkk....',
      '....kmxxmk..',
      '...kmllmmk..',
      '..kmllllmk..',
      '.kmlllllmkk.',
      'kmllmllllmk.',
      '.kmmlllmmk..',
      '..kkmmmkk...',
      '...k..kk....',
    ],
  },

  /* ================================================================= */
  /* SYSTEM ICONS — 16x16                                              */
  /* ================================================================= */

  /* Heater shield with a raised boss. */
  icon_sys_shields: {
    pal: P_I,
    rows: [
      '...gggggggggg...',
      '..gwwwccccccvv..',
      '.gwwcccccccccvv.',
      '.gwcchhhhhhccvv.',
      '.gwchwwwwwwhcvv.',
      '.gwchwwccwwhcvv.',
      '.gwchwwccwwhcvv.',
      '.gwcchwwwwhccvv.',
      '.gwcccccccccvvv.',
      '.vgwccccccccvvv.',
      '..vgwcccccccvv..',
      '...vgwcccccvv...',
      '....vgwcccvv....',
      '.....vgwcvv.....',
      '......vgcv......',
      '.......gv.......',
    ],
  },

  /* Bell nozzle over a tapering plume. */
  icon_sys_engines: {
    pal: P_I,
    rows: [
      '.....hhhhhh.....',
      '....hwwlllmd....',
      '....hwlllmmd....',
      '...hwllllmmmd...',
      '...hwllllmmmd...',
      '..hwlllllmmmmd..',
      '..hwlllllmmmmd..',
      '.hwllllllmmmmmd.',
      '.hwllllllmmmmmd.',
      '.ddhhhllmmmddkk.',
      '..ywwwyyyyyyoa..',
      '...ywwyyyyyoa...',
      '...ywwyyyyoaa...',
      '....ywyyyyoa....',
      '.....yyyyoa.....',
      '......yyoa......',
    ],
  },

  /* Pressure bottle with valve and a big O stencil. */
  icon_sys_oxygen: {
    pal: P_I,
    rows: [
      '......hlld......',
      '.....hwlldm.....',
      '....hhwlldmm....',
      '....khwlldmk....',
      '...gwcccccvvk...',
      '..gwcccccccvvk..',
      '.gwccwwwwcccvvk.',
      '.gwcwwccwwccvvk.',
      '.gwcwwccwwccvvk.',
      '.gwcwwccwwccvvk.',
      '.gwccwwwwcccvvk.',
      '.gwccccccccvvvk.',
      '.gwccccccccvvvk.',
      '..gwcccccccvvk..',
      '...kvvvvvvvvk...',
      '.....kkkkkk.....',
    ],
  },

  /* Side-view cannon, muzzle flaring right. */
  icon_sys_weapons: {
    pal: P_I,
    rows: [
      '...hhhllmmd.....',
      '..hwwhllmmmd....',
      '..hwhhllmmmd....',
      '.hwhllllmmmdd...',
      '.hwhllllmmmdd...',
      '.hwhllllmmmdd...',
      '.hwhllllmmmddhg.',
      '.hwhllllmmmdhgwg',
      '.hwhllllmmmdhgwg',
      '.hwhllllmmmddhg.',
      '.hwhllllmmmdd...',
      '.hwhllllmmmdd...',
      '..hwhlllmmmd....',
      '...hhllmmmd.....',
      '....dmmmmd......',
      '...dmmmmmmd.....',
    ],
  },

  /* Beveled medical cross. */
  icon_sys_medbay: {
    pal: P_I,
    rows: [
      '.....knnnnk.....',
      '.....kswwnk.....',
      '.....kswwnk.....',
      '.....kswwnk.....',
      '.kkkkkswwnkkkkk.',
      '.kswwwwwwwwnnek.',
      '.kswwwwwwwwnnek.',
      '.ksnnnnwwnnnnek.',
      '.kennnnwwnnneek.',
      '.kkkkkswwnkkkkk.',
      '.....kswwnk.....',
      '.....kswwnk.....',
      '.....kswwnk.....',
      '.....kswwnk.....',
      '.....keeeek.....',
      '......kkkk......',
    ],
  },

  /* Ship's wheel: ring, four spokes, lit hub. */
  icon_sys_piloting: {
    pal: P_I,
    rows: [
      '......gggg......',
      '....gggggggg....',
      '...gg..gg..cc...',
      '..gg...gg...cc..',
      '.gg....gg....vc.',
      '.gc....gg....vv.',
      'gc.....gg.....cv',
      'ggcccchwwhcccccv',
      'gccccchwwhccccvv',
      'gc.....gg.....cv',
      '.cv....gg....vv.',
      '.cc....gg....vv.',
      '..cc...gg...vv..',
      '...cc..gg..vv...',
      '....cccccvvv....',
      '......cvvv......',
    ],
  },

  /* Radar scope: filled bezel, sweep line, two contacts. */
  icon_sys_sensors: {
    pal: P_I,
    rows: [
      '......cccc......',
      '....ccddddcc....',
      '...ccddddddcc...',
      '..ccddddddgdcc..',
      '.ccdddddddgdccv.',
      '.ccdddddddgdccv.',
      'ccddddddddgdddcv',
      'ccdyddddwgddddcv',
      'ccddddddwwddddcv',
      'ccdddddddddyddcv',
      '.ccdddddddddcvv.',
      '.ccdddddddddcvv.',
      '..ccdddddddcvv..',
      '...ccdddddcvv...',
      '....ccdddcvv....',
      '......cvvv......',
    ],
  },

  /* Blast door: framed leaves parting on a lit seam. */
  icon_sys_doors: {
    pal: P_I,
    rows: [
      'kkkkkkkkkkkkkkkk',
      'khhhhhhhhhhhhddk',
      'khlllllgvlllmddk',
      'khlmmmmgvmmmmddk',
      'khlmmmmgvmmmmddk',
      'khlmmmmgvmmmmddk',
      'khlmmhhgvhhmmddk',
      'khlmmhhgvhhmmddk',
      'khlmmhhgvhhmmddk',
      'khlmmhhgvhhmmddk',
      'khlmmmmgvmmmmddk',
      'khlmmmmgvmmmmddk',
      'khlmmmmgvmmmmddk',
      'khdddddgvddddddk',
      'kddddddddddddddk',
      'kkkkkkkkkkkkkkkk',
    ],
  },

  /* Combat drone: lensed disc between two thruster nubs. */
  icon_sys_drones: {
    pal: P_I,
    rows: [
      '......kkkk......',
      '.....khhllk.....',
      '....khlwwlmk....',
      '...khlwgglmmk...',
      '..khlwgccglmmk..',
      '.khlwgcvvcgwlmk.',
      'khhlwgcvwvcglmdk',
      'khhlwgcvwvcglmdk',
      '.khlwgcvvcgwlmk.',
      '..khlwgccglmmk..',
      '...khlwgglmmk...',
      '....khlwwlmk....',
      '.....khllmk.....',
      '......kkkk......',
      '...hlm....mlh...',
      '...kgc....cgk...',
    ],
  },

  /* Pad with three rising containment rings. */
  icon_sys_teleporter: {
    pal: P_I,
    rows: [
      '......gccg......',
      '.....gcvvcg.....',
      '......gccg......',
      '.......gg.......',
      '....gccccccg....',
      '...gcvv..vvcg...',
      '....gccccccg....',
      '.......gg.......',
      '..gccccccccccg..',
      '.gcvv......vvcg.',
      '..gccccccccccg..',
      '.......gg.......',
      '.khhhllllmmmmdk.',
      'khhllllllmmmmddk',
      'khllgggggglmmddk',
      '.kddddddddddddk.',
    ],
  },

  /* A solid form dissolving into a checkered ghost on its shadow side. */
  icon_sys_cloaking: {
    pal: P_I,
    rows: [
      '.......wc.......',
      '......gw.c......',
      '.....ggwc.v.....',
      '....cggw.c.v....',
      '...ccggwc.c.v...',
      '..vccggw.c.c.v..',
      '.vvccggwc.c.c.v.',
      'vvccggww.c.c.c.v',
      'vvccggwwc.c.c.v.',
      '.vvccggw.c.c.v..',
      '..vvccgwc.c.v...',
      '...vvcgw.c.v....',
      '....vvcwc.v.....',
      '.....vvc.v......',
      '......vvv.......',
      '.......v........',
    ],
  },

  /* Cell with terminal cap and three charge bars. */
  icon_sys_battery: {
    pal: P_I,
    rows: [
      '......khhk......',
      '......kllk......',
      '..kkkkkkkkkkkk..',
      '..khhhhhhhhhdk..',
      '..khwwyyooaadk..',
      '..khwwyyooaadk..',
      '..kdmmmmmmmmdk..',
      '..khwwyyooaadk..',
      '..khwwyyooaadk..',
      '..kdmmmmmmmmdk..',
      '..khwwyyooaadk..',
      '..khwwyyooaadk..',
      '..kdmmmmmmmmdk..',
      '..kddddddddddk..',
      '..kkkkkkkkkkkk..',
      '...dddddddddd...',
    ],
  },

  /* Growth tube: a body suspended in green fluid. */
  icon_sys_clonebay: {
    pal: P_I,
    rows: [
      '...kkkkkkkkkk...',
      '..khhllllllmdk..',
      '.khlsnnnnnnemdk.',
      '.khlsnnwwnnemdk.',
      '.khlsnnwwnnemdk.',
      '.khlsnwwwwnnemk.',
      '.khlsnwwwwnnemk.',
      '.khlsnnwwnnemdk.',
      '.khlsnnwwnnemdk.',
      '.khlsnwwwwnnemk.',
      '.khlsnnwwnnemdk.',
      '.khlsnnnnnnemdk.',
      '.khlseeeeeeemdk.',
      '..khddddddddmk..',
      '..kkkkkkkkkkkk..',
      '...dddddddddd...',
    ],
  },

  /* Head under a purple influence aura. */
  icon_sys_mindcontrol: {
    pal: P_I,
    rows: [
      'u.....kkkk.....u',
      '.u...kppppk...u.',
      '..ukpuuuuuupku..',
      '.p.kpuwwuuupk.p.',
      '.p.kpuwwwuupk.p.',
      '.u.kpuwwwuupk.u.',
      '...kpwkuukwpk...',
      '...kpuuuuuupk...',
      '...kpuwwwwupk...',
      '...kpuuuuuupk...',
      '...kppuuuuppk...',
      '....kppppppk....',
      '.....kppppk.....',
      '.....kippik.....',
      '..kkiippppiikk..',
      '.kiiiippppiiiik.',
    ],
  },

  /* Breached chip: pinned package around a live core. */
  icon_sys_hacking: {
    pal: P_I,
    rows: [
      '...h.h.h.h.h....',
      '...l.l.l.l.l....',
      '..kkkkkkkkkkkk..',
      'h.kmhhhhhhhhmk.h',
      '..kmggggggggmk..',
      'h.kmgcwwwwcgmk.h',
      '..kmgcwvvwcgmk..',
      'l.kmgcwvvwcgmk.l',
      'l.kmgcwvvwcgmk.l',
      '..kmgcwvvwcgmk..',
      'h.kmgcwwwwcgmk.h',
      '..kmggggggggmk..',
      '..kmddddddddmk..',
      '..kkkkkkkkkkkk..',
      '...d.d.d.d.d....',
      '...m.m.m.m.m....',
    ],
  },

  /* Anvil throwing sparks — automated hull repair. */
  icon_sys_nanoforge: {
    pal: P_I,
    rows: [
      '.....o...y......',
      '...y...w...o....',
      '......wy..y.....',
      '....o..w....y...',
      '.hhhhhhhhhhhhhd.',
      'hllllllllllllmdk',
      'hlllllllllllmmdk',
      '....kllmmmdk....',
      '.....kllmmdk....',
      '.....kllmmdk....',
      '....kllmmmdk....',
      '...kllmmmmmdk...',
      '.khhhllmmmmmddk.',
      'khhllllmmmmmmddk',
      'khllllmmmmmmdddk',
      '.kkkkkkkkkkkkkk.',
    ],
  },

  /* Lightning caught in a ring — system overcharge. */
  icon_sys_overdrive: {
    pal: P_I,
    rows: [
      '......gggg......',
      '....gggggggg....',
      '...ggv...yycc...',
      '..ggv...yy.vcc..',
      '.ggc...yy...vcc.',
      '.ggc..yy....vcv.',
      'ggc..yywwyy..vcv',
      'ccv.yywwyy...vcv',
      'ccv....yy....vcv',
      'ccv...yy.....vvv',
      '.ccv..yy....vvv.',
      '.ccv.yy.....vvv.',
      '..ccvy.....vvv..',
      '...ccv....vvv...',
      '....cccvvvvv....',
      '......cvvv......',
    ],
  },

  /* Shield bubble draining down into an arrow. */
  icon_sys_siphon: {
    pal: P_I,
    rows: [
      '.....gccccv.....',
      '...ggcwwwcccv...',
      '..gcwww...ccvv..',
      '.gcww......ccvv.',
      '.gcw........ccv.',
      '.gcw........ccv.',
      '..gcc......ccv..',
      '...gcc.yy.ccv...',
      '....gcyyyycv....',
      '.....gwyyav.....',
      '.....wyyyya.....',
      '.....wyyyya.....',
      '...ywwyyyyaaa...',
      '....wwyyyaaa....',
      '....wwyyyyaa....',
      '.....wyyyaa.....',
    ],
  },

  /* Hourglass mid-pour. */
  icon_sys_temporal: {
    pal: P_I,
    rows: [
      '.hhhhhhhhhhhhhh.',
      '.hllllllllllldk.',
      '..klyyyyyooodk..',
      '..klyyyyoooadk..',
      '...klyyoooadk...',
      '....klyooadk....',
      '.....klyoak.....',
      '......kyok......',
      '......kyok......',
      '.....kdyydk.....',
      '....kd.yy.dk....',
      '...kd..yy..dk...',
      '..kd.yyoooa.dk..',
      '..kdyyyoooaadk..',
      '.hllllllllllldk.',
      '.hhhhhhhhhhhhdk.',
    ],
  },

  /* Grabber claw closed on a chunk of scrap. */
  icon_sys_salvage: {
    pal: P_I,
    rows: [
      '.......ll.......',
      '.......ll.......',
      '.......ll.......',
      '.....hhhhhh.....',
      '...hhwwllmmdd...',
      '..hwwllllmmmdd..',
      '..hwllllllmmdd..',
      '..kdllllllmmdk..',
      '.hll........lmd.',
      'hll..........lmd',
      'hl............md',
      'hl...yyoa.....md',
      'hll..yyooa...lmd',
      '.hll..yooa..lmd.',
      '..hll......lmd..',
      '...hll....lmd...',
    ],
  },

  /* ================================================================= */
  /* RESOURCE + STATUS ICONS — 12x12                                   */
  /* ================================================================= */

  /* Three torn plates stacked into a salvage pile. */
  icon_scrap: {
    pal: P_I,
    rows: [
      '....hll.....',
      '...hwllmd...',
      '..hwllllmd..',
      '.hwllllmmdk.',
      '.hwllommmdk.',
      '..hlllmmdk..',
      '..dhlmmmdk..',
      'hlm...hwlmd.',
      'hwlmd.hwylmd',
      'hwllmdhlmmdk',
      'dhlmmdkhlmdk',
      '.dhmdk.dhmdk',
    ],
  },

  /* Capped fuel cell with a lit sight glass. */
  icon_fuel: {
    pal: P_I,
    rows: [
      '...khhk.....',
      '...klhk.....',
      '.kkkkkkkkkk.',
      '.khhhhhhhdk.',
      '.khlnnnnldk.',
      '.khlnsssldk.',
      '.khlnsssldk.',
      '.khlnnnnldk.',
      '.khlllllldk.',
      '.khdddddddk.',
      '.kkkkkkkkkk.',
      '..dddddddd..',
    ],
  },

  /* Finned missile, red nose, lit exhaust. */
  icon_missile: {
    pal: P_I,
    rows: [
      '.....ww.....',
      '....wqqx....',
      '....wqxr....',
      '...whlmmd...',
      '...whlmmd...',
      '...whlmmd...',
      '...whlmmd...',
      '...whlmmd...',
      '..hwhlmmdd..',
      '.hlwhlmmdmd.',
      'hllwhlmmdmdd',
      '...woyyoa...',
    ],
  },

  /* Rotor blade seated in a lensed hub. */
  icon_dronepart: {
    pal: P_I,
    rows: [
      '.......hlm..',
      '......hllmd.',
      '.....hllmd..',
      '....hllmd...',
      '...khhlmdk..',
      '..khgcccgmk.',
      '.kmgcwwcgmk.',
      '..kdgcccgdk.',
      '...kdmllhk..',
      '..dmllh.....',
      '.dmllh......',
      'dmllh.......',
    ],
  },

  /* Small hull, nose up, lit ports and thrusters. */
  icon_hull: {
    pal: P_I,
    rows: [
      '.....ww.....',
      '....hwwh....',
      '....hwlh....',
      '...hwlllh...',
      '...hwlgmh...',
      '..hwllggmd..',
      '.hwlllggmmd.',
      'hwllllggmmdd',
      'hwlmmlggmmdd',
      '.dhllllmmdd.',
      '..dhlmmmdd..',
      '...oyyyyo...',
    ],
  },

  /* Power bolt. */
  icon_power: {
    pal: P_I,
    rows: [
      '......yyyo..',
      '.....wyyoa..',
      '....wyyoa...',
      '...wyyoa....',
      '..wyyyyyyoa.',
      '.wyyyyyyoa..',
      '..wyyyoa....',
      '...wyyoa....',
      '..wyyoa.....',
      '.wyyoa......',
      '.wyoa.......',
      '.woa........',
    ],
  },

  /* Heart with a specular kick on the upper-left lobe. */
  icon_health: {
    pal: P_I,
    rows: [
      '..xxx..xxx..',
      '.xqwqxxqqqx.',
      'xqwwqqqqqqqx',
      'xqwqqqqqqqqx',
      'xqqqqqqqqqqr',
      'xqqqqqqqqqrr',
      '.xqqqqqqqrr.',
      '.xqqqqqqqrr.',
      '..xqqqqqrr..',
      '...xqqqrr...',
      '....xqrr....',
      '.....xr.....',
    ],
  },

  /* Open-end wrench laid on the diagonal. */
  icon_repair: {
    pal: P_I,
    rows: [
      '.hwh..hwh...',
      'hwlh..hlmd..',
      'hwl....lmd..',
      'hwlh..hlmd..',
      '.hwlhhhlmd..',
      '..hwlllmd...',
      '...hwlmd....',
      '....hwlmd...',
      '.....hwlmd..',
      '......hwlmd.',
      '.......hwlmd',
      '........hlmd',
    ],
  },

  /* Flame: white core, amber body, red envelope. */
  icon_fire: {
    pal: P_I,
    rows: [
      '.....yo.....',
      '....yyoa....',
      '....wyyoa...',
      '...wwyyoa...',
      '..xwyyyoaa..',
      '.xxwyyyyoaa.',
      '.xqwwyyyoaa.',
      'xqqwwyyyoaar',
      'xqqwwyyyooar',
      'xqqqwwyyoarr',
      '.xqqqwyyoar.',
      '..xqqqwyar..',
    ],
  },

  /* Torn plating around a hole onto vacuum, air streaming out. */
  icon_breach: {
    pal: P_I,
    rows: [
      'whhllmmmdddk',
      'whhllmmmdddk',
      'whhlkkkmdddk',
      'whhkkgkkddmk',
      'whkkkkkkkdmk',
      'whkkkkkkkkmk',
      'whlkkkkgkkmk',
      'whlkkkkkkdmk',
      'whllkkkkdmmk',
      'whlllkkmdmmk',
      'whlllmmmdmmk',
      'khhllmmmdddk',
    ],
  },

  /* Padlock, steel shackle over a brass body. */
  icon_lock: {
    pal: P_I,
    rows: [
      '...hhhhmm...',
      '..hk....km..',
      '..hk....km..',
      '..hk....km..',
      '..hk....km..',
      '.hhhhhhhhmd.',
      '.hwyyyyyomd.',
      '.hwyykyyomd.',
      '.hwyykkyomd.',
      '.hwyykyyomd.',
      '.hwyyyyyomd.',
      '.kddddddddk.',
    ],
  },

  /* Five-point star. */
  icon_star: {
    pal: P_I,
    rows: [
      '.....wy.....',
      '.....wy.....',
      '....wyyo....',
      '....wyyo....',
      'wwyyyyyyyooa',
      '.wyyyyyyyoa.',
      '.wyyyyyyyoa.',
      '..wyyyyyoa..',
      '..wyyyyyoa..',
      '.wyyo..oyoa.',
      'wyyo....oyoa',
      'wyo......oya',
    ],
  },

  /* Skull. */
  icon_skull: {
    pal: P_I,
    rows: [
      '...wwwhhh...',
      '..wwwhhhllm.',
      '.wwwhhhhllmd',
      '.wwhhhhhllmd',
      '.wwkkhhkklmd',
      '.wkkkhhkkkmd',
      '.wwkkhhkklmd',
      '.wwhhhkhhlmd',
      '..whhhhhlmd.',
      '...whkhkhlm.',
      '...whkhkhlm.',
      '....whhhlm..',
    ],
  },

  /* Store front under a striped awning. */
  icon_shop: {
    pal: P_I,
    rows: [
      'wwggwwggwwgg',
      'wwggwwggwwgg',
      'ccvvccvvccvv',
      '.c..c..c..c.',
      'khhhhhhhhhdk',
      'khttttttttdk',
      'khtyyyyyytdk',
      'khtttttttmdk',
      'khtyyyyyytdk',
      'khtttttttmdk',
      'khddddddddmk',
      'kkkkkkkkkkkk',
    ],
  },

  /* Beacon mast throwing red signal arcs. */
  icon_distress: {
    pal: P_I,
    rows: [
      '.....qq.....',
      '....qxxq....',
      '..q.qxxq.q..',
      '.q..hxxh..q.',
      'q....hh....q',
      '.....hh.....',
      '....hlmd....',
      '...hhlmdd...',
      '...hlmmmd...',
      '..hhlmmmdd..',
      '.hhlmmmmmdd.',
      'hhllmmmmmddd',
    ],
  },

  /* Hazard placard, diagonal caution stripes. */
  icon_hazard: {
    pal: P_I,
    rows: [
      'kkkkkkkkkkkk',
      'kakkdyoakkdk',
      'kkkdyoakkdyk',
      'kkdyoakkdyok',
      'kdyoakkdyoak',
      'kyoakkdyoakk',
      'koakkdyoakkk',
      'kakkdyoakkdk',
      'kkkdyoakkdyk',
      'kkdyoakkdyok',
      'kdyoakkdyoak',
      'kkkkkkkkkkkk',
    ],
  },

  /* Lit doorway with an exit arrow. */
  icon_exit: {
    pal: P_I,
    rows: [
      'kkkkkkk.....',
      'ksnnnek.....',
      'ksnnnek.....',
      'ksnnnek..s..',
      'ksnnnek..sn.',
      'ksnnneksnnne',
      'ksnnneksnnne',
      'ksnnnek..ne.',
      'ksnnnek..e..',
      'ksnnnek.....',
      'ksnnnek.....',
      'kkkkkkk.....',
    ],
  },

  /* Warning triangle. */
  icon_warning: {
    pal: P_I,
    rows: [
      '.....yo.....',
      '....yyoa....',
      '....ykoa....',
      '...yykkoa...',
      '...yykkoa...',
      '..yyykkooa..',
      '..yyykkooa..',
      '.yyyykkoooa.',
      '.yyyyyyoooa.',
      'yyyyykkoooaa',
      'yyyyyyyoooaa',
      'aaaaaaaaaaaa',
    ],
  },

  /* Check mark. */
  icon_check: {
    pal: P_I,
    rows: [
      '.........snn',
      '........snne',
      '.......snne.',
      '......snne..',
      's.....snne..',
      'sn...snne...',
      'snn.snne....',
      'snnnsnne....',
      '.snnnnne....',
      '..snnnee....',
      '...snne.....',
      '....se......',
    ],
  },

  /* Cross / cancel. */
  icon_cross: {
    pal: P_I,
    rows: [
      'xqr......xqr',
      '.xqr....xqr.',
      '..xqr..xqr..',
      '...xqrxqr...',
      '...xqqqqr...',
      '....xqqr....',
      '....xqqr....',
      '...xqqqqr...',
      '...xqrxqr...',
      '..xqr..xqr..',
      '.xqr....xqr.',
      'xqr......xqr',
    ],
  },

  /* Transport controls. */
  icon_pause: {
    pal: P_I,
    rows: [
      '.gggg..gggg.',
      '.gwcv..gwcv.',
      '.gwcv..gwcv.',
      '.gwcv..gwcv.',
      '.gwcv..gwcv.',
      '.gwcv..gwcv.',
      '.gwcv..gwcv.',
      '.gwcv..gwcv.',
      '.gwcv..gwcv.',
      '.gwcv..gwcv.',
      '.gwcv..gwcv.',
      '.vvvv..vvvv.',
    ],
  },
  icon_play: {
    pal: P_I,
    rows: [
      '.gw.........',
      '.gww........',
      '.gwwcc......',
      '.gwwccc.....',
      '.gwwcccvv...',
      '.gwwcccvvv..',
      '.gwwcccvvv..',
      '.gwwcccvv...',
      '.gwwccc.....',
      '.gwwcc......',
      '.gww........',
      '.gw.........',
    ],
  },

  /* Fast-forward chevrons. */
  icon_speed: {
    pal: P_I,
    rows: [
      'g.....g.....',
      'gw....gw....',
      'gwc...gwc...',
      'gwcc..gwcc..',
      'gwccv.gwccv.',
      'gwccvvgwccvv',
      'gwccvvgwccvv',
      'gwccv.gwccv.',
      'gwcc..gwcc..',
      'gwc...gwc...',
      'gw....gw....',
      'g.....g.....',
    ],
  },

  /* Evasion: a hard break up and to the right, with its wake. */
  icon_evade: {
    pal: P_I,
    rows: [
      '....wwwwggcc',
      '.....wwwggcc',
      '......wwggcc',
      '.......wggcc',
      '......wwggcc',
      '.....wwg.gcc',
      '....wwg...cc',
      '...wwg.....c',
      '..wwg.......',
      '.wwg........',
      'wwg.........',
      'wg..........',
    ],
  },

  /* Crew bust: helmet, visor, shoulders. */
  icon_crew: {
    pal: P_I,
    rows: [
      '....hlll....',
      '..khhllmmk..',
      '.khwggccvmk.',
      '.khwgcccvmk.',
      '.khmccvvvmk.',
      '..kkmllmmk..',
      '...hllmmm...',
      '.hhllmmmmld.',
      'hhlllmmmmmdd',
      'hhllmccmmmdd',
      'hlllmccmmmdd',
      'dlllmmmmmmdd',
    ],
  },

  /* Trophy cup. */
  icon_trophy: {
    pal: P_I,
    rows: [
      '.wwyyyyyooa.',
      'ywwyyyyyooay',
      'y.wyyyyyoa.y',
      'y.wyyyyyoa.y',
      '.a.wyyyoa.a.',
      '....wyoa....',
      '.....wo.....',
      '.....wo.....',
      '.....wo.....',
      '....awoa....',
      '..awwyyooa..',
      '.awwyyyyooa.',
    ],
  },
};

register(CREW_ART);
export default CREW_ART;
