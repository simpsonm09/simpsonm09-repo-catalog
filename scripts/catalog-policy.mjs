export const TIERS = ['standard', 'template', 'catalog', 'plugin', 'tooling', 'feature', 'fixture', 'legacy'];
export const LEVELS = ['propose', 'merge', 'full'];

const IGNORED_OWNERS = new Set(['simpsonm09', 'simpsonm09-org']);
const QUALIFIED_IDENTITY = /^[^/\s]+\/[^/\s]+$/u;
const REPOSITORY_NAME = /^[A-Za-z0-9._-]{1,100}$/u;
const LINE_TERMINATORS = /[\r\n\u2028\u2029]/u;

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isRepositoryName(value) {
  return typeof value === 'string' && !LINE_TERMINATORS.test(value) && REPOSITORY_NAME.test(value);
}

function validateDefaults(defaults) {
  const errors = [];
  if (!isRecord(defaults)) return ['agentAccessDefaults must be an object'];

  for (const tier of TIERS) {
    if (!(tier in defaults)) errors.push(`agentAccessDefaults is missing the ${tier} tier`);
  }
  for (const [tier, level] of Object.entries(defaults)) {
    if (!TIERS.includes(tier)) errors.push(`agentAccessDefaults has an unknown tier: ${tier}`);
    if (!LEVELS.includes(level)) errors.push(`agentAccessDefaults.${tier} is not a selectable level: ${level}`);
  }
  return errors;
}

function validateRosterEntries(roster, ignoredNames) {
  if (!Array.isArray(roster.repos)) return ['repos must be an array'];
  const errors = [];
  for (const [index, entry] of roster.repos.entries()) {
    if (!isRecord(entry)) {
      errors.push(`repos[${index}] must be an object`);
      continue;
    }
    const label = entry.name ?? `repos[${index}]`;
    if (!TIERS.includes(entry.tier)) errors.push(`${label} has an unknown tier: ${entry.tier}`);
    if (entry.agentAccess !== undefined && !LEVELS.includes(entry.agentAccess)) {
      errors.push(`${label}.agentAccess is not a selectable level: ${entry.agentAccess}`);
    }
    if (typeof entry.name === 'string' && ignoredNames.has(entry.name.toLowerCase())) {
      errors.push(`${entry.name} is both in the roster and in ignore.json`);
    }
  }
  return errors;
}

function validateIdentity(identity, entryName, identityIndex, seenIdentities) {
  const label = `${entryName}.agentAccessIgnore[${identityIndex}]`;
  if (typeof identity !== 'string' || !QUALIFIED_IDENTITY.test(identity)) {
    return [`${label} must be a fully qualified owner/repository identity`];
  }

  const errors = [];
  const [owner, repository] = identity.split('/');
  if (!IGNORED_OWNERS.has(owner.toLowerCase())) errors.push(`${label} owner must be simpsonm09 or simpsonm09-org`);
  if (typeof entryName === 'string' && repository.toLowerCase() !== entryName.toLowerCase()) {
    errors.push(`${label} repository must match ${entryName}`);
  }
  const normalized = identity.toLowerCase();
  if (seenIdentities.has(normalized)) errors.push(`${label} duplicates ${identity}`);
  seenIdentities.add(normalized);
  return errors;
}

function validateIgnoreEntry(entry, entryIndex, seenNames, seenIdentities) {
  if (!isRecord(entry)) return [`ignore[${entryIndex}] must be an object`];
  const errors = [];
  if (!Object.keys(entry).every((key) => ['name', 'reason', 'agentAccessIgnore'].includes(key))) {
    errors.push(`ignore[${entryIndex}] has an unknown field`);
  }
  if (!isRepositoryName(entry.name)) {
    errors.push(`ignore[${entryIndex}].name is invalid`);
  } else {
    const normalizedName = entry.name.toLowerCase();
    if (seenNames.has(normalizedName)) errors.push(`ignore[${entryIndex}].name duplicates an earlier entry`);
    seenNames.add(normalizedName);
  }
  if (typeof entry.reason !== 'string' || entry.reason.length === 0) {
    errors.push(`ignore[${entryIndex}].reason is invalid`);
  }
  if (entry.agentAccessIgnore === undefined) return errors;
  if (!Array.isArray(entry.agentAccessIgnore) || entry.agentAccessIgnore.length === 0) {
    return [...errors, `${entry.name}.agentAccessIgnore must be a non-empty array`];
  }

  for (const [identityIndex, identity] of entry.agentAccessIgnore.entries()) {
    errors.push(...validateIdentity(identity, entry.name, identityIndex, seenIdentities));
  }
  return errors;
}

function validateIgnoreEntries(ignore) {
  if (!Array.isArray(ignore.ignore)) return ['ignore must be an array'];
  const errors = [];
  const seenNames = new Set();
  const seenIdentities = new Set();
  for (const [index, entry] of ignore.ignore.entries()) {
    errors.push(...validateIgnoreEntry(entry, index, seenNames, seenIdentities));
  }
  return errors;
}

function namesInIgnore(ignore) {
  if (!Array.isArray(ignore.ignore)) return new Set();
  return new Set(ignore.ignore
    .filter(isRecord)
    .map((entry) => entry.name)
    .filter((name) => typeof name === 'string')
    .map((name) => name.toLowerCase()));
}

export function validateCatalogPolicy(roster, ignore) {
  if (!isRecord(roster)) return ['repos.json must be an object'];
  if (!isRecord(ignore)) return ['ignore.json must be an object'];
  return [
    ...(!Object.keys(ignore).every((key) => key === 'ignore') ? ['ignore.json has an unknown top-level field'] : []),
    ...validateDefaults(roster.agentAccessDefaults),
    ...validateRosterEntries(roster, namesInIgnore(ignore)),
    ...validateIgnoreEntries(ignore),
  ];
}
