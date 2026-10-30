import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAutoqueueRoster } from '../scripts/export-autoqueue-roster.mjs';

const catalogCommit = '15354b3b9d6d3e8efe842d5ed47da2c9663a497e';
const reposFixture = {
  schema: 1,
  org: 'simpsonm09-org',
  agentAccessDefaults: {
    standard: 'merge',
    template: 'merge',
    catalog: 'merge',
    plugin: 'merge',
    tooling: 'merge',
    feature: 'merge',
    fixture: 'read',
    legacy: 'none',
  },
  repos: [
    { name: 'z-full-override', tier: 'standard', agentAccess: 'full' },
    { name: 'a-merge-default', tier: 'standard' },
    { name: 'merge-repo', tier: 'fixture', agentAccess: 'merge' },
    { name: 'propose-repo', tier: 'feature', agentAccess: 'propose' },
  ],
};
const ignoreFixture = {
  ignore: [{ name: 'ignored-repo', reason: 'Fixture exclusion.' }],
};

test('exports only FULL repositories, applies overrides, and sorts deterministically', () => {
  assert.deepEqual(buildAutoqueueRoster(reposFixture, ignoreFixture, catalogCommit), {
    schema: 1,
    catalogCommit,
    owner: 'simpsonm09-org',
    fullRepos: ['z-full-override'],
  });
});

test('accepts the reviewed per-entry agentAccessIgnore array shape', () => {
  const ignoredIdentity = {
    ...ignoreFixture,
    ignore: [{
      name: 'another-repo',
      reason: 'Fixture exclusion.',
      agentAccessIgnore: ['simpsonm09/another-repo', 'simpsonm09-org/another-repo'],
    }],
  };
  assert.deepEqual(buildAutoqueueRoster(reposFixture, ignoredIdentity, catalogCommit).fullRepos, ['z-full-override']);
});

test('rejects a personal-owner identity colliding with a FULL roster name', () => {
  const ignore = {
    ignore: [{ name: 'z-full-override', reason: 'Fixture exclusion.', agentAccessIgnore: ['simpsonm09/z-full-override'] }],
  };
  assert.throws(() => buildAutoqueueRoster(reposFixture, ignore, catalogCommit), /both in repos\.json and agentAccessIgnore/);
});

test('rejects an identity whose repository does not match its ignore entry', () => {
  const ignore = {
    ignore: [{ name: 'z-full-override', reason: 'Fixture exclusion.', agentAccessIgnore: ['simpsonm09-org/another-repo'] }],
  };
  assert.throws(() => buildAutoqueueRoster(reposFixture, ignore, catalogCommit), /repository must match z-full-override/);
});

test('rejects identities for owners outside the two owned namespaces', () => {
  const ignore = {
    ignore: [{ name: 'ignored-repo', reason: 'Fixture exclusion.', agentAccessIgnore: ['someone-else/ignored-repo'] }],
  };
  assert.throws(() => buildAutoqueueRoster(reposFixture, ignore, catalogCommit), /owner must be simpsonm09 or simpsonm09-org/);
});

test('rejects top-level agentAccessIgnore metadata', () => {
  assert.throws(() => buildAutoqueueRoster(reposFixture, {
    ignore: [],
    agentAccessIgnore: ['simpsonm09-org/another-repo'],
  }, catalogCommit), /unknown field/);
});

test('rejects the unsupported ignore schema key and preserves unknown-field rejection', () => {
  assert.throws(() => buildAutoqueueRoster(reposFixture, { ...ignoreFixture, schema: 1 }, catalogCommit), /unknown field/);
  assert.throws(() => buildAutoqueueRoster(reposFixture, { ...ignoreFixture, futureMetadata: true }, catalogCommit), /unknown field/);
  assert.doesNotThrow(() => buildAutoqueueRoster({ ...reposFixture, schema: 1 }, ignoreFixture, catalogCommit));
});

test('fails when a name appears in both catalog and name ignore metadata', () => {
  const repos = { ...reposFixture, repos: [...reposFixture.repos, { name: 'ignored-repo', tier: 'standard' }] };
  assert.throws(() => buildAutoqueueRoster(repos, ignoreFixture, catalogCommit), /both in repos\.json and ignore\.json/);
});

test('fails when a name appears in both catalog and exact identity ignore metadata', () => {
  const ignore = {
    ignore: [{ name: 'z-full-override', reason: 'Fixture exclusion.', agentAccessIgnore: ['simpsonm09-org/z-full-override'] }],
  };
  assert.throws(() => buildAutoqueueRoster(reposFixture, ignore, catalogCommit), /both in repos\.json and agentAccessIgnore/);
});

test('fails closed for unknown or missing tiers and invalid levels', () => {
  assert.throws(() => buildAutoqueueRoster({ ...reposFixture, repos: [{ name: 'unknown-tier', tier: 'new-tier' }] }, ignoreFixture, catalogCommit), /unknown tier/);
  const { legacy, ...missingDefaults } = reposFixture.agentAccessDefaults;
  assert.equal(legacy, 'none');
  assert.throws(() => buildAutoqueueRoster({ ...reposFixture, agentAccessDefaults: missingDefaults }, ignoreFixture, catalogCommit), /missing the legacy tier/);
  assert.throws(() => buildAutoqueueRoster({ ...reposFixture, agentAccessDefaults: { ...reposFixture.agentAccessDefaults, standard: 'all' } }, ignoreFixture, catalogCommit), /is not a level/);
  assert.throws(() => buildAutoqueueRoster({ ...reposFixture, repos: [{ name: 'bad-override', tier: 'standard', agentAccess: 'all' }] }, ignoreFixture, catalogCommit), /unknown agentAccess level/);
});

test('fails closed for invalid schema, owner, duplicate entries, and malformed names', () => {
  assert.throws(() => buildAutoqueueRoster({ ...reposFixture, schema: 2 }, ignoreFixture, catalogCommit), /schema must be 1/);
  assert.throws(() => buildAutoqueueRoster({ ...reposFixture, org: 'simpsonm09' }, ignoreFixture, catalogCommit), /org must be simpsonm09-org/);
  assert.throws(() => buildAutoqueueRoster({ ...reposFixture, repos: [...reposFixture.repos, { name: 'Z-FULL-OVERRIDE', tier: 'standard' }] }, ignoreFixture, catalogCommit), /duplicates/);
  assert.throws(() => buildAutoqueueRoster({ ...reposFixture, repos: [{ name: 'bad/name', tier: 'standard' }] }, ignoreFixture, catalogCommit), /name is malformed/);
  assert.throws(() => buildAutoqueueRoster(reposFixture, { ...ignoreFixture, schema: 2 }, catalogCommit), /unknown field/);
});

test('fails closed for malformed explicit ignore identities and invalid catalog commits', () => {
  const ignore = { ignore: [{ name: 'ignored-repo', reason: 'Fixture exclusion.', agentAccessIgnore: ['z-full-default'] }] };
  assert.throws(() => buildAutoqueueRoster(reposFixture, ignore, catalogCommit), /fully qualified/);
  assert.throws(() => buildAutoqueueRoster(reposFixture, ignoreFixture, 'not-a-commit'), /40-character/);
});
