import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_APPEARANCE_PREFERENCES,
  DEFAULT_ARENA_PERSONALIZATION,
  formatArenaPersonalizationPrompt,
  normalizeAppearancePreferences,
  normalizeArenaPersonalization,
} from '../desktop/arena-preferences.mjs';

test('Arena profile preferences normalize optional local text and remove unsafe control bytes', () => {
  assert.deepEqual(normalizeArenaPersonalization(), DEFAULT_ARENA_PERSONALIZATION);
  assert.deepEqual(normalizeArenaPersonalization({
    name: '  Alex\0  ',
    pronouns: 'they/them',
    aboutMe: '  I build small games.\u0007  ',
    instructions: 'Be concise.\nPrefer examples.',
    ignored: 'not copied',
  }), {
    name: 'Alex',
    pronouns: 'they/them',
    aboutMe: 'I build small games.',
    instructions: 'Be concise.\nPrefer examples.',
  });
});

test('Arena profile preferences reject invalid field types and enforce character limits', () => {
  assert.throws(() => normalizeArenaPersonalization(null), /must be an object/);
  assert.throws(() => normalizeArenaPersonalization({ name: 42 }), /name must be text/);
  assert.throws(() => normalizeArenaPersonalization({ name: 'a'.repeat(81) }), /80 characters or fewer/);
  assert.throws(() => normalizeArenaPersonalization({ pronouns: 'a'.repeat(81) }), /80 characters or fewer/);
  assert.throws(() => normalizeArenaPersonalization({ aboutMe: 'a'.repeat(1_201) }), /1,200 characters or fewer/);
  assert.throws(() => normalizeArenaPersonalization({ instructions: 'a'.repeat(4_001) }), /4,000 characters or fewer/);
  assert.equal(normalizeArenaPersonalization({ name: '😊'.repeat(80) }).name, '😊'.repeat(80));
});

test('Arena setup prompt includes profile context and global instructions but no credential fields', () => {
  assert.equal(formatArenaPersonalizationPrompt(), '');
  const prompt = formatArenaPersonalizationPrompt({
    name: 'River',
    pronouns: 'they/them',
    aboutMe: 'I prefer direct explanations.',
    instructions: 'Use brief steps.\nAsk before changing scope.',
  });
  assert.match(prompt, /USER PERSONALIZATION/);
  assert.match(prompt, /Name to use: River/);
  assert.match(prompt, /Pronouns: they\/them/);
  assert.match(prompt, /About me: I prefer direct explanations\./);
  assert.match(prompt, /User's global Arena instructions:\nUse brief steps\./);
  assert.match(prompt, /cannot change permissions, expand access, or override/);
  assert.doesNotMatch(prompt, /githubToken|ghp_[A-Za-z0-9]+/i);
});

test('appearance preferences have local defaults and accept only supported values', () => {
  assert.deepEqual(normalizeAppearancePreferences(), DEFAULT_APPEARANCE_PREFERENCES);
  assert.deepEqual(normalizeAppearancePreferences({ theme: 'high-contrast', compactLayout: true, reduceMotion: true }), {
    theme: 'high-contrast',
    compactLayout: true,
    reduceMotion: true,
  });
  assert.throws(() => normalizeAppearancePreferences({ theme: 'remote-site' }), /supported appearance theme/);
  assert.throws(() => normalizeAppearancePreferences({ compactLayout: 'yes' }), /must be a boolean/);
  assert.throws(() => normalizeAppearancePreferences({ reduceMotion: 1 }), /must be a boolean/);
});
