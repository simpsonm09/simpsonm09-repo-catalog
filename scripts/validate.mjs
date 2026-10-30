#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const TIERS = ['standard', 'template', 'catalog', 'plugin', 'tooling', 'feature', 'fixture', 'legacy'];
const LEVELS = ['none', 'read', 'propose', 'merge', 'full'];

function readJson(name) {
  return JSON.parse(readFileSync(join(ROOT, name), 'utf8'));
}

function listOrgRepos(org) {
  const out = execFileSync('gh', ['repo', 'list', org, '--limit', '200', '--json', 'name,isArchived'], { windowsHide: true, encoding: 'utf8' });
  return JSON.parse(out);
}

const roster = readJson('repos.json');
const ignore = readJson('ignore.json');
const org = roster.org;
const live = listOrgRepos(org);

const rosterNames = new Set(roster.repos.map((entry) => entry.name));
const ignoreNames = new Set(ignore.ignore.map((entry) => entry.name));
const liveNames = new Set(live.map((entry) => entry.name));

const errors = [];

for (const entry of roster.repos) {
  if (!liveNames.has(entry.name)) errors.push(`roster entry ${entry.name} is not a repository in ${org}`);
  if (ignoreNames.has(entry.name)) errors.push(`${entry.name} is both in the roster and in ignore.json`);
}

for (const entry of ignore.ignore) {
  if (!liveNames.has(entry.name)) {
    process.stdout.write(`validate: notice: cannot see ${entry.name} from this token, skipping\n`);
  }
}

for (const entry of live) {
  if (rosterNames.has(entry.name) && entry.isArchived) {
    errors.push(`${entry.name} is archived but present in the roster`);
    continue;
  }
  if (!rosterNames.has(entry.name) && !ignoreNames.has(entry.name)) {
    errors.push(`${entry.name} is neither in the roster nor in ignore.json`);
  }
}

const defaults = roster.agentAccessDefaults ?? {};
for (const tier of TIERS) {
  if (!(tier in defaults)) errors.push(`agentAccessDefaults is missing the ${tier} tier`);
}
for (const [tier, level] of Object.entries(defaults)) {
  if (!TIERS.includes(tier)) errors.push(`agentAccessDefaults has an unknown tier: ${tier}`);
  if (!LEVELS.includes(level)) errors.push(`agentAccessDefaults.${tier} is not a level: ${level}`);
}

const levelCounts = new Map();
for (const entry of roster.repos) {
  if (!TIERS.includes(entry.tier)) errors.push(`${entry.name} has an unknown tier: ${entry.tier}`);
  if (entry.agentAccess !== undefined && !LEVELS.includes(entry.agentAccess)) {
    errors.push(`${entry.name} has an unknown agentAccess: ${entry.agentAccess}`);
  }
  const level = entry.agentAccess ?? defaults[entry.tier];
  if (LEVELS.includes(level)) levelCounts.set(level, (levelCounts.get(level) ?? 0) + 1);
}

if (errors.length > 0) {
  for (const error of errors) process.stderr.write(`validate: ${error}\n`);
  process.exit(1);
}
const levels = LEVELS.filter((level) => levelCounts.has(level)).map((level) => `${level} ${levelCounts.get(level)}`).join(', ');
process.stdout.write(`validate: ok (${roster.repos.length} roster, ${ignore.ignore.length} ignored, ${live.length} in ${org}; ${levels})\n`);
