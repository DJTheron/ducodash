import { describe, expect, it } from 'vitest';
import type { Miner } from '../api/schema';
import { classifyMiner, densityFor, groupIntoRigs, summariseFleet } from './classify';

const worker = (over: Partial<Miner>): Miner => ({
  threadid: Math.random().toString(16).slice(2),
  username: 'someone',
  hashrate: 80_000,
  sharetime: 5,
  accepted: 1000,
  rejected: 0,
  diff: 8200,
  software: 'Official ESP32 Miner 4.3',
  identifier: 'rig',
  algorithm: 'DUCO-S1',
  pool: 'node-1',
  ...over,
});

describe('classifyMiner', () => {
  it('reads the hardware class from the real software strings', () => {
    const cases: [string, string][] = [
      ['Official ESP32 Miner 4.3', 'ESP32'],
      ['Official ESP32-S2 Miner 4.3', 'ESP32'],
      ['Official DUCOCUBE Miner (ESP32) 4.3', 'ESP32'],
      ['Official ESP8266 Miner 3.5', 'ESP8266'],
      ['Official AVR Miner 4.3', 'Arduino'],
      ['AVR I2C v3.4', 'Arduino'],
      ['Official PC Miner 4.3', 'CPU'],
      ['Official Web Miner 3.4', 'Web'],
      ['Fatorius  Android Miner', 'Phone'],
    ];
    for (const [software, expected] of cases) {
      expect(classifyMiner({ software, identifier: 'None' })).toBe(expected);
    }
  });

  it('prefers RPi over AVR when a Pi drives the AVRs over I2C', () => {
    // "RPI I2C AVR Miner" matches both patterns; the more specific one must win.
    expect(classifyMiner({ software: 'RPI I2C AVR Miner 4.3', identifier: 'None' })).toBe('RPi');
  });

  it('reclassifies the PC miner as a Pi when the rig name says so', () => {
    expect(classifyMiner({ software: 'Official PC Miner 4.3', identifier: 'raspberrypi-4' })).toBe(
      'RPi',
    );
  });
});

describe('groupIntoRigs', () => {
  /*
    The case this exists for, taken from a real account: four dual-core ESP32 boards
    reported as eight worker rows. Each board opens one connection per core, so the
    API's unit is a thread and the owner's unit is a board.
  */
  const dualCoreFleet = [
    worker({ identifier: 'ESP32 Wroom 1 M', hashrate: 81_159, accepted: 71_116, sharetime: 7.001 }),
    worker({ identifier: 'ESP32 Wroom 1 M', hashrate: 81_101, accepted: 70_672, sharetime: 9.413 }),
    worker({ identifier: 'ESP32 Wroom 2 N', hashrate: 80_864, accepted: 22_920 }),
    worker({ identifier: 'ESP32 Wroom 2 N', hashrate: 80_386, accepted: 22_512 }),
    worker({ identifier: 'ESP32 Wroom 4 B', hashrate: 81_150, accepted: 145_405, rejected: 1 }),
    worker({ identifier: 'ESP32 Wroom 4 B', hashrate: 81_508, accepted: 143_385, rejected: 3 }),
    worker({ identifier: 'ESP32Wroom3N', hashrate: 80_944, accepted: 140_500, rejected: 1 }),
    worker({ identifier: 'ESP32Wroom3N', hashrate: 80_710, accepted: 139_159, rejected: 3 }),
  ];

  it('collapses eight worker threads into four devices', () => {
    const rigs = groupIntoRigs(dualCoreFleet);
    expect(rigs).toHaveLength(4);
    expect(rigs.every((r) => r.threads === 2)).toBe(true);
  });

  it('sums hashrate and shares across a device’s threads', () => {
    const rig = groupIntoRigs(dualCoreFleet).find((r) => r.name === 'ESP32 Wroom 1 M')!;
    expect(rig.hashrate).toBe(81_159 + 81_101);
    expect(rig.accepted).toBe(71_116 + 70_672);
    // Share time is per-thread, so it averages rather than sums.
    expect(rig.sharetime).toBeCloseTo((7.001 + 9.413) / 2, 6);
  });

  it('keeps unnamed workers separate rather than merging them into one rig', () => {
    // "None" is the default identifier; two unnamed rigs are not one dual-core rig.
    const rigs = groupIntoRigs([
      worker({ identifier: 'None', threadid: 'a' }),
      worker({ identifier: 'None', threadid: 'b' }),
    ]);
    expect(rigs).toHaveLength(2);
    expect(rigs.every((r) => r.threads === 1)).toBe(true);
  });

  it('leaves a single-threaded fleet untouched', () => {
    const rigs = groupIntoRigs([worker({ identifier: 'solo' })]);
    expect(rigs).toHaveLength(1);
    expect(rigs[0]!.threads).toBe(1);
  });
});

describe('summariseFleet', () => {
  it('counts devices and threads separately', () => {
    const summary = summariseFleet(
      groupIntoRigs([
        worker({ identifier: 'a', hashrate: 100 }),
        worker({ identifier: 'a', hashrate: 100 }),
        worker({ identifier: 'b', hashrate: 50 }),
      ]),
    );
    expect(summary.count).toBe(2);
    expect(summary.threads).toBe(3);
    expect(summary.hashrate).toBe(250);
  });

  it('reports an accept rate over combined shares', () => {
    const summary = summariseFleet(
      groupIntoRigs([worker({ identifier: 'a', accepted: 99, rejected: 1 })]),
    );
    expect(summary.acceptRate).toBeCloseTo(0.99, 6);
  });

  it('treats an empty fleet as fully accepting rather than dividing by zero', () => {
    expect(summariseFleet([]).acceptRate).toBe(1);
  });
});

describe('densityFor', () => {
  it('switches tier on device count, not thread count', () => {
    expect(densityFor(4)).toBe('showcase');
    expect(densityFor(6)).toBe('showcase');
    expect(densityFor(7)).toBe('compact');
    expect(densityFor(24)).toBe('compact');
    expect(densityFor(25)).toBe('dense');
  });
});
