/**
 * Component constructors — wraps package geometry into Components placed at a
 * specific PCB-mm rectangle. Stateless; all randomness flows through Rng.
 */

import type { Rng } from '../rng.js';
import type { Component, ComponentKind, Zone } from './types.js';
import {
  bga,
  qfp,
  soic,
  dimm,
  pcie,
  electrolytic,
  ceramicSmd,
  inductorToroid,
  mosfet,
  ioPanel,
} from './packages.js';

interface MakeArgs {
  kind: ComponentKind;
  zone: Zone;
  x: number;
  y: number;
  w: number;
  h: number;
  rng: Rng;
  topLabel?: string;
  rot?: 0 | 90 | 180 | 270;
}

export function makeCpu(a: MakeArgs): Component {
  return {
    id: '',
    kind: 'cpu',
    zone: a.zone,
    rect: { x: a.x, y: a.y, w: a.w, h: a.h },
    pkg: bga({ w: a.w, h: a.h, rng: a.rng, ballPitch: 1.0, ballR: 0.42, edgeMargin: 1.8, centreVoid: false }),
    topLabel: a.topLabel ?? 'CPU',
  };
}

export function makeNorthbridge(a: MakeArgs): Component {
  return {
    id: '',
    kind: 'northbridge',
    zone: a.zone,
    rect: { x: a.x, y: a.y, w: a.w, h: a.h },
    pkg: bga({ w: a.w, h: a.h, rng: a.rng, ballPitch: 0.9, ballR: 0.35, edgeMargin: 1.4 }),
    topLabel: a.topLabel ?? 'MCH',
  };
}

export function makeSouthbridge(a: MakeArgs): Component {
  return {
    id: '',
    kind: 'southbridge',
    zone: a.zone,
    rect: { x: a.x, y: a.y, w: a.w, h: a.h },
    pkg: qfp({ w: a.w, h: a.h, rng: a.rng, leadPitch: 0.65 }),
    topLabel: a.topLabel ?? 'ICH',
  };
}

export function makeRam(a: MakeArgs): Component {
  return {
    id: '',
    kind: 'ram',
    zone: a.zone,
    rect: { x: a.x, y: a.y, w: a.w, h: a.h },
    pkg: dimm({ w: a.w, h: a.h, rng: a.rng }),
    topLabel: a.topLabel ?? 'DIMM',
  };
}

export function makeRom(a: MakeArgs): Component {
  return {
    id: '',
    kind: 'rom',
    zone: a.zone,
    rect: { x: a.x, y: a.y, w: a.w, h: a.h },
    pkg: soic({ w: a.w, h: a.h, rng: a.rng }),
    topLabel: a.topLabel ?? 'BIOS',
  };
}

export function makeElectro(a: MakeArgs): Component {
  return {
    id: '',
    kind: 'cap-electro',
    zone: a.zone,
    rect: { x: a.x, y: a.y, w: a.w, h: a.h },
    pkg: electrolytic({ w: a.w, h: a.h, rng: a.rng }),
  };
}

export function makeCeramic(a: MakeArgs): Component {
  return {
    id: '',
    kind: 'cap-ceramic',
    zone: a.zone,
    rect: { x: a.x, y: a.y, w: a.w, h: a.h },
    pkg: ceramicSmd({ w: a.w, h: a.h, rng: a.rng }),
  };
}

export function makePcie(a: MakeArgs): Component {
  return {
    id: '',
    kind: 'pcie',
    zone: a.zone,
    rect: { x: a.x, y: a.y, w: a.w, h: a.h },
    pkg: pcie({ w: a.w, h: a.h, rng: a.rng }),
    topLabel: a.topLabel ?? 'PCIE',
  };
}

export function makeInductor(a: MakeArgs): Component {
  return {
    id: '',
    kind: 'inductor',
    zone: a.zone,
    rect: { x: a.x, y: a.y, w: a.w, h: a.h },
    pkg: inductorToroid({ w: a.w, h: a.h, rng: a.rng }),
  };
}

export function makeMosfet(a: MakeArgs): Component {
  return {
    id: '',
    kind: 'mosfet',
    zone: a.zone,
    rect: { x: a.x, y: a.y, w: a.w, h: a.h },
    pkg: mosfet({ w: a.w, h: a.h, rng: a.rng }),
  };
}

export function makeIo(a: MakeArgs): Component {
  return {
    id: '',
    kind: 'io-panel',
    zone: a.zone,
    rect: { x: a.x, y: a.y, w: a.w, h: a.h },
    pkg: ioPanel({ w: a.w, h: a.h, rng: a.rng }),
  };
}

export function makeMountHole(a: MakeArgs): Component {
  return {
    id: '',
    kind: 'mount-hole',
    zone: a.zone,
    rect: { x: a.x, y: a.y, w: a.w, h: a.h },
    // Mount holes have no pads/pins; emit an empty geometry.
    pkg: { kind: 'electro', pins: [] },
  };
}
