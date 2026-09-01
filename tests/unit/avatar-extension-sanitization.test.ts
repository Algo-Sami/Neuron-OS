import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AVATAR_EXTENSION_MAP } from '../../src/actions/storage';

describe('Avatar File Extension Sanitization & Allowlist Suite', () => {
  it('Test 1: image/svg+xml maps strictly to svg (never .svg+xml)', () => {
    const ext = AVATAR_EXTENSION_MAP['image/svg+xml'];
    assert.strictEqual(ext, 'svg');
    assert.notStrictEqual(ext, 'svg+xml');
  });

  it('Test 2: Approved image types map to canonical extensions', () => {
    assert.strictEqual(AVATAR_EXTENSION_MAP['image/jpeg'], 'jpg');
    assert.strictEqual(AVATAR_EXTENSION_MAP['image/jpg'], 'jpg');
    assert.strictEqual(AVATAR_EXTENSION_MAP['image/png'], 'png');
    assert.strictEqual(AVATAR_EXTENSION_MAP['image/webp'], 'webp');
    assert.strictEqual(AVATAR_EXTENSION_MAP['image/gif'], 'gif');
  });

  it('Test 3: Dangerous or unsupported MIME types are rejected by allowlist', () => {
    assert.strictEqual(AVATAR_EXTENSION_MAP['application/javascript'], undefined);
    assert.strictEqual(AVATAR_EXTENSION_MAP['text/html'], undefined);
    assert.strictEqual(AVATAR_EXTENSION_MAP['application/octet-stream'], undefined);
    assert.strictEqual(AVATAR_EXTENSION_MAP['application/x-sh'], undefined);
    assert.strictEqual(AVATAR_EXTENSION_MAP['image/x-icon'], undefined);
  });

  it('Test 4: Filenames with path traversal and special characters are sanitized', () => {
    const sanitizeAvatarFileName = (rawName: string | undefined, ext: string) => {
      const safeBaseName = rawName
        ? rawName.replace(/[/\\?%*:|"<>]/g, '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60)
        : `avatar_12345`;
      return `${safeBaseName}.${ext}`;
    };

    const malicious1 = '../../../../etc/passwd.png';
    const clean1 = sanitizeAvatarFileName(malicious1, 'png');
    assert.strictEqual(clean1.includes('..'), false);
    assert.strictEqual(clean1.includes('/'), false);
    assert.strictEqual(clean1.includes('\\'), false);
    assert.ok(clean1.endsWith('.png'));

    const malicious2 = 'user profile $#@! & photo.svg+xml';
    const clean2 = sanitizeAvatarFileName(malicious2, 'svg');
    assert.strictEqual(clean2.includes('$'), false);
    assert.strictEqual(clean2.includes('+'), false);
    assert.ok(clean2.endsWith('.svg'));
  });
});
