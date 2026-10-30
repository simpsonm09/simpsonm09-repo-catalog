import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { LEVELS, TIERS, validateCatalogPolicy } from '../scripts/catalog-policy.mjs';

const readJson = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const roster = readJson('../repos.json');
const ignore = readJson('../ignore.json');
const valid = () => structuredClone({ roster, ignore });

test('committed catalog declares full for every tier and every roster repository', () => {
  assert.deepEqual(TIERS, Object.keys(roster.agentAccessDefaults));
  assert.ok(TIERS.every((tier) => roster.agentAccessDefaults[tier] === 'full'));
  assert.ok(roster.repos.every((entry) => entry.agentAccess === undefined || entry.agentAccess === 'full'));
  assert.equal(roster.repos.length, 17);
  assert.ok(roster.repos.every((entry) => (entry.agentAccess ?? roster.agentAccessDefaults[entry.tier]) === 'full'));
  assert.deepEqual(validateCatalogPolicy(roster, ignore), []);
});

test('selectable levels exclude internal read and none values', () => {
  assert.deepEqual(LEVELS, ['propose', 'merge', 'full']);
  for (const level of ['read', 'none', 'unknown']) {
    const candidate = valid();
    candidate.roster.agentAccessDefaults.fixture = level;
    assert.ok(validateCatalogPolicy(candidate.roster, candidate.ignore).some((error) => error.includes('selectable level')));
  }
});

test('requires every current tier default and rejects unknown tiers', () => {
  const missing = valid();
  delete missing.roster.agentAccessDefaults.legacy;
  assert.ok(validateCatalogPolicy(missing.roster, missing.ignore).some((error) => error.includes('missing the legacy tier')));
  const unknown = valid();
  unknown.roster.agentAccessDefaults.experimental = 'full';
  assert.ok(validateCatalogPolicy(unknown.roster, unknown.ignore).some((error) => error.includes('unknown tier')));
});

test('rejects invalid per-repository overrides', () => {
  const candidate = valid();
  candidate.roster.repos[0].agentAccess = 'read';
  assert.ok(validateCatalogPolicy(candidate.roster, candidate.ignore).some((error) => error.includes('agentAccess is not a selectable level')));
});

test('pure validation rejects invalid roster tier membership and roster/ignore overlap', () => {
  const invalidTier = valid();
  invalidTier.roster.repos[0].tier = 'experimental';
  assert.ok(validateCatalogPolicy(invalidTier.roster, invalidTier.ignore).some((error) => error.includes('unknown tier')));

  const overlap = valid();
  overlap.ignore.ignore.push({ name: overlap.roster.repos[0].name, reason: 'overlap' });
  assert.ok(validateCatalogPolicy(overlap.roster, overlap.ignore).some((error) => error.includes('both in the roster')));
});

test('rejects mixed-case roster and ignore name overlap', () => {
  const candidate = valid();
  candidate.roster.repos.push({ name: 'Contract-Fixture-Ignored', tier: 'fixture' });
  candidate.ignore.ignore.push({ name: 'contract-fixture-ignored', reason: 'Synthetic overlap fixture.' });
  assert.ok(validateCatalogPolicy(candidate.roster, candidate.ignore).some((error) => error.includes('both in the roster')));
});

test('pure validation reports malformed catalog roots and required metadata arrays', () => {
  assert.deepEqual(validateCatalogPolicy(null, ignore), ['repos.json must be an object']);
  assert.deepEqual(validateCatalogPolicy(roster, []), ['ignore.json must be an object']);

  const missing = valid();
  delete missing.roster.agentAccessDefaults;
  delete missing.roster.repos;
  delete missing.ignore.ignore;
  assert.ok(validateCatalogPolicy(missing.roster, missing.ignore).some((error) => error === 'agentAccessDefaults must be an object'));
  assert.ok(validateCatalogPolicy(missing.roster, missing.ignore).some((error) => error === 'repos must be an array'));
  assert.ok(validateCatalogPolicy(missing.roster, missing.ignore).some((error) => error === 'ignore must be an array'));

  const malformedEntry = valid();
  malformedEntry.roster.repos.push(null);
  malformedEntry.ignore.ignore.push(null);
  const errors = validateCatalogPolicy(malformedEntry.roster, malformedEntry.ignore);
  assert.ok(errors.some((error) => error === 'repos[17] must be an object'));
  assert.ok(errors.some((error) => error.startsWith('ignore[5] must be an object')));
});

test('ignore policy accepts only the published resolver top-level shape', () => {
  const withoutSchema = valid();
  assert.deepEqual(validateCatalogPolicy(withoutSchema.roster, withoutSchema.ignore), []);

  for (const key of ['schema', 'futureMetadata']) {
    const candidate = valid();
    candidate.ignore[key] = key === 'schema' ? 1 : true;
    assert.ok(validateCatalogPolicy(candidate.roster, candidate.ignore)
      .some((error) => error.includes('unknown top-level field')), key);
  }
});

test('committed deny metadata names exactly the three selected ignores and six identities', () => {
  const metadata = ignore.ignore.filter((entry) => entry.agentAccessIgnore !== undefined);
  assert.deepEqual(metadata.map((entry) => entry.name).sort(), [
    'The_Gaming_Index_Video_Game_Database_Final_Capstone',
    'pdf_field_automation_acrobat',
    'steam_wishlist_cleanup',
  ].sort());
  assert.equal(metadata.flatMap((entry) => entry.agentAccessIgnore).length, 6);
  assert.ok(metadata.every((entry) => {
    const owners = entry.agentAccessIgnore.map((identity) => identity.split('/')[0].toLowerCase()).sort();
    return owners.join(',') === 'simpsonm09,simpsonm09-org';
  }));
  assert.ok(ignore.ignore.filter((entry) => !metadata.includes(entry)).every((entry) => entry.agentAccessIgnore === undefined));
});

test('matches identities case-insensitively and requires an exact owner/repository pair', () => {
  for (const identity of [
    'unknown-owner/steam_wishlist_cleanup',
    'simpsonm09/another-repository',
    'steam_wishlist_cleanup',
    'simpsonm09/steam_wishlist_cleanup/extra',
  ]) {
    const candidate = valid();
    candidate.ignore.ignore.find((entry) => entry.name === 'steam_wishlist_cleanup').agentAccessIgnore = [identity];
    assert.ok(validateCatalogPolicy(candidate.roster, candidate.ignore).length > 0, identity);
  }
  const candidate = valid();
  candidate.ignore.ignore.find((entry) => entry.name === 'steam_wishlist_cleanup').agentAccessIgnore = [
    'SIMPSONM09-ORG/STEAM_WISHLIST_CLEANUP',
  ];
  assert.deepEqual(validateCatalogPolicy(candidate.roster, candidate.ignore), []);
});

test('rejects malformed and duplicate deny identities', () => {
  for (const identity of ['', 'simpsonm09/', '/steam_wishlist_cleanup', 'simpsonm09/steam_wishlist_cleanup\n']) {
    const candidate = valid();
    candidate.ignore.ignore.find((entry) => entry.name === 'steam_wishlist_cleanup').agentAccessIgnore = [identity];
    assert.ok(validateCatalogPolicy(candidate.roster, candidate.ignore).length > 0, JSON.stringify(identity));
  }
  const duplicate = valid();
  duplicate.ignore.ignore.find((entry) => entry.name === 'steam_wishlist_cleanup').agentAccessIgnore.push(
    'SIMPSONM09/STEAM_WISHLIST_CLEANUP',
  );
  assert.ok(validateCatalogPolicy(duplicate.roster, duplicate.ignore).some((error) => error.includes('duplicates')));
});

test('rejects malformed deny metadata names, arrays, and empty arrays', () => {
  for (const entry of [
    { agentAccessIgnore: ['simpsonm09/repository'] },
    { name: '', agentAccessIgnore: ['simpsonm09/repository'] },
    { name: 'bad/name', agentAccessIgnore: ['simpsonm09/bad'] },
    { name: 'repository', agentAccessIgnore: 'simpsonm09/repository' },
    { name: 'repository', agentAccessIgnore: [] },
  ]) {
    const candidate = valid();
    candidate.ignore.ignore.push(entry);
    assert.ok(validateCatalogPolicy(candidate.roster, candidate.ignore).length > 0, JSON.stringify(entry));
  }
});

test('rejects invalid ignore entry fields, names, and reasons', () => {
  const invalidEntries = [
    { name: 'contract@fixture', reason: 'Synthetic fixture.' },
    { name: 'contract/fixture', reason: 'Synthetic fixture.' },
    { name: 'contract-fixture', reason: '' },
    { name: 'contract-fixture' },
    { name: 'contract-fixture', reason: 1 },
    { name: 'contract-fixture', reason: 'Synthetic fixture.', futureMetadata: true },
    { name: `${'a'.repeat(100)}a`, reason: 'Synthetic fixture.' },
  ];
  for (const entry of invalidEntries) {
    const candidate = valid();
    candidate.ignore.ignore.push(entry);
    assert.ok(validateCatalogPolicy(candidate.roster, candidate.ignore).length > 0, JSON.stringify(entry));
  }
});

test('rejects duplicate ignore entry names without regard to case', () => {
  const candidate = valid();
  candidate.ignore.ignore.push(
    { name: 'contract-fixture', reason: 'First synthetic fixture.' },
    { name: 'CONTRACT-FIXTURE', reason: 'Second synthetic fixture.' },
  );
  assert.ok(validateCatalogPolicy(candidate.roster, candidate.ignore)
    .some((error) => error.includes('duplicates an earlier entry')));
});

test('owned policy files retain the expected ownership entries and levels', () => {
  assert.deepEqual(readJson('../owned-forks.json'), {
    forks: [
      { repository: 'simpsonm09/pstack-max', upstream: 'michael-denyer/pstack-claude', agentAccess: 'propose' },
      { repository: 'simpsonm09/pstack-opencode-plugin', upstream: 'simpsonm09-org/pstack-opencode-plugin', agentAccess: 'propose' },
      { repository: 'simpsonm09/cursor-plugins', upstream: 'cursor/plugins', agentAccess: 'propose' },
      { repository: 'simpsonm09/Win-CodexBar', upstream: 'nesszer/Win-CodexBar', agentAccess: 'propose' },
    ],
  });
  assert.deepEqual(readJson('../owned-repositories.json'), {
    repositories: [{ repository: 'simpsonm09/simpsonm09', agentAccess: 'propose' }],
  });
});
