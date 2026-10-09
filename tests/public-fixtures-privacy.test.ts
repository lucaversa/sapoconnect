import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

function fixtureFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? fixtureFiles(path) : /\.(?:tsx?|html)$/.test(path) ? [path] : [];
  });
}

describe('public test fixture privacy', () => {
  it('uses synthetic identifiers instead of institutional-format academic IDs', () => {
    const violations: string[] = [];
    for (const path of fixtureFiles(join(process.cwd(), 'tests'))) {
      const identifiers = readFileSync(path, 'utf8').match(/(?<!\d)\d{5,6}\.\d{5}(?!\d)/g) ?? [];
      // All-zero prefixes are reserved by this project for numeric parser fixtures.
      if (identifiers.some((identifier) => !/^0{5,6}\.\d{5}$/.test(identifier))) {
        // Report filenames only, so a failed check does not publish the identifier again.
        violations.push(relative(process.cwd(), path));
      }
    }
    expect(violations).toEqual([]);
  });
});
