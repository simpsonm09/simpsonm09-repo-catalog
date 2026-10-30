#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const OWNER = 'simpsonm09-org';
const TIERS = ['standard', 'template', 'catalog', 'plugin', 'tooling', 'feature', 'fixture', 'legacy'];
const LEVELS = ['none', 'read', 'propose', 'merge', 'full'];
const REPOSITORY_PATTERN = /^[A-Za-z0-9._-]{1,100}$/;
const OWNER_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;
const LINE_TERMINATORS = /[\r\n\u2028\u2029]/;

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function onlyKeys(value, allowed) {
  return Object.keys(value).every((key) => allowed.includes(key));
}

function isRepositoryName(value) {
  return typeof value === 'string' && !LINE_TERMINATORS.test(value) && REPOSITORY_PATTERN.test(value);
}

function invalid(message) {
  throw new TypeError(`autoqueue roster: ${message}`);
}

function validateOptionalSchema(value, label) {
  if (value.schema !== undefined && value.schema !== 1) invalid(`${label}.schema must be 1`);
}

function validateTierDefaults(defaults) {
  if (!isRecord(defaults)) invalid('repos.json.agentAccessDefaults must be an object');
  for (const tier of TIERS) {
    if (!(tier in defaults)) invalid(`agentAccessDefaults is missing the ${tier} tier`);
  }
  for (const [tier, level] of Object.entries(defaults)) {
    if (!TIERS.includes(tier)) invalid(`agentAccessDefaults has an unknown tier: ${tier}`);
    if (!LEVELS.includes(level)) invalid(`agentAccessDefaults.${tier} is not a level: ${level}`);
  }
}

function validateRepositoryEntry(entry, index, defaults, names) {
  if (!isRecord(entry)) invalid(`repos[${index}] must be an object`);
  if (!onlyKeys(entry, ['name', 'tier', 'adopted', 'agentAccess', 'rationale'])) invalid(`repos[${index}] has an unknown field`);
  if (!isRepositoryName(entry.name)) invalid(`repos[${index}].name is malformed`);
  const normalizedName = entry.name.toLowerCase();
  if (names.has(normalizedName)) invalid(`repos[${index}].name duplicates ${entry.name}`);
  names.add(normalizedName);
  if (!TIERS.includes(entry.tier)) invalid(`${entry.name} has an unknown tier: ${entry.tier}`);
  if (!(entry.tier in defaults)) invalid(`agentAccessDefaults is missing the ${entry.tier} tier`);
  if (entry.agentAccess !== undefined && !LEVELS.includes(entry.agentAccess)) {
    invalid(`${entry.name} has an unknown agentAccess level: ${entry.agentAccess}`);
  }
  if (entry.adopted !== undefined && typeof entry.adopted !== 'boolean') invalid(`${entry.name}.adopted must be a boolean`);
  if (entry.rationale !== undefined && typeof entry.rationale !== 'string') invalid(`${entry.name}.rationale must be a string`);
}

function validateCatalog(repos) {
  if (!isRecord(repos)) invalid('repos.json must contain an object');
  if (!onlyKeys(repos, ['schema', 'org', 'agentAccessDefaults', 'repos'])) invalid('repos.json has an unknown field');
  validateOptionalSchema(repos, 'repos.json');
  if (repos.org !== OWNER) invalid(`repos.json.org must be ${OWNER}`);
  validateTierDefaults(repos.agentAccessDefaults);
  if (!Array.isArray(repos.repos)) invalid('repos.json.repos must be an array');
  const names = new Set();
  for (const [index, entry] of repos.repos.entries()) {
    validateRepositoryEntry(entry, index, repos.agentAccessDefaults, names);
  }

  return names;
}

function validateIgnoreIdentity(identity, identityIndex, entryName, identities, rosterNames) {
  if (typeof identity !== 'string') invalid(`agentAccessIgnore[${identityIndex}] must be a string identity`);
  const parts = identity.split('/');
  if (parts.length !== 2 || LINE_TERMINATORS.test(parts[0]) || !OWNER_PATTERN.test(parts[0]) || !isRepositoryName(parts[1])) {
    invalid(`agentAccessIgnore[${identityIndex}] must be a fully qualified owner/repository identity`);
  }
  if (!['simpsonm09', OWNER].includes(parts[0].toLowerCase())) {
    invalid(`agentAccessIgnore[${identityIndex}] owner must be simpsonm09 or ${OWNER}`);
  }
  if (parts[1].toLowerCase() !== entryName.toLowerCase()) {
    invalid(`agentAccessIgnore[${identityIndex}] repository must match ${entryName}`);
  }
  const normalizedIdentity = identity.toLowerCase();
  if (identities.has(normalizedIdentity)) invalid(`agentAccessIgnore[${identityIndex}] duplicates ${identity}`);
  identities.add(normalizedIdentity);
  if (rosterNames.has(parts[1].toLowerCase())) invalid(`${identity} is both in repos.json and agentAccessIgnore`);
}

function validateIgnoreIdentities(entry, identities, rosterNames) {
  if (entry.agentAccessIgnore === undefined) return;
  if (!Array.isArray(entry.agentAccessIgnore)) invalid(`${entry.name}.agentAccessIgnore must be an array`);
  for (const [identityIndex, identity] of entry.agentAccessIgnore.entries()) {
    validateIgnoreIdentity(identity, identityIndex, entry.name, identities, rosterNames);
  }
}

function validateIgnoreEntry(entry, index, names, identities, rosterNames) {
  if (!isRecord(entry) || !onlyKeys(entry, ['name', 'reason', 'agentAccessIgnore'])) invalid(`ignore[${index}] has an invalid shape`);
  if (!isRepositoryName(entry.name)) invalid(`ignore[${index}].name is malformed`);
  if (typeof entry.reason !== 'string' || entry.reason.length === 0) invalid(`ignore[${index}].reason must be a non-empty string`);
  const normalizedName = entry.name.toLowerCase();
  if (names.has(normalizedName)) invalid(`ignore[${index}].name duplicates ${entry.name}`);
  names.add(normalizedName);
  validateIgnoreIdentities(entry, identities, rosterNames);
}

function validateIgnore(ignore, rosterNames) {
  if (!isRecord(ignore)) invalid('ignore.json must contain an object');
  if (!onlyKeys(ignore, ['ignore'])) invalid('ignore.json has an unknown field');
  if (!Array.isArray(ignore.ignore)) invalid('ignore.json.ignore must be an array');
  const names = new Set();
  const identities = new Set();
  for (const [index, entry] of ignore.ignore.entries()) {
    validateIgnoreEntry(entry, index, names, identities, rosterNames);
  }

  return { names, identities };
}

/** Build the deterministic, fail-closed roster snapshot from catalog metadata. */
export function buildAutoqueueRoster(repos, ignore, catalogCommit) {
  if (typeof catalogCommit !== 'string' || !/^[a-f0-9]{40}$/.test(catalogCommit)) {
    invalid('catalogCommit must be a 40-character lowercase hexadecimal commit');
  }

  const rosterNames = validateCatalog(repos);
  const ignored = validateIgnore(ignore, rosterNames);
  for (const name of rosterNames) {
    if (ignored.names.has(name)) invalid(`${name} is both in repos.json and ignore.json`);
    if (ignored.identities.has(`${OWNER}/${name}`.toLowerCase())) invalid(`${OWNER}/${name} is both in repos.json and agentAccessIgnore`);
  }

  const fullRepos = repos.repos
    .filter((entry) => (entry.agentAccess ?? repos.agentAccessDefaults[entry.tier]) === 'full')
    .filter((entry) => !ignored.names.has(entry.name.toLowerCase())
      && !ignored.identities.has(`${OWNER}/${entry.name}`.toLowerCase()))
    .map((entry) => entry.name)
    .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));

  return { schema: 1, catalogCommit, owner: OWNER, fullRepos };
}

function readCommittedJson(file) {
  const contents = execFileSync('git', ['show', `HEAD:${file}`], { encoding: 'utf8', windowsHide: true });
  return JSON.parse(contents);
}

function runCli() {
  const catalogCommit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', windowsHide: true }).trim();
  const roster = buildAutoqueueRoster(readCommittedJson('repos.json'), readCommittedJson('ignore.json'), catalogCommit);
  process.stdout.write(`${JSON.stringify(roster, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    runCli();
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
