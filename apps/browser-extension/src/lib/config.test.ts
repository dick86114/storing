import { describe, expect, it } from 'vitest';
import { isCollectablePage, requiresInsecureHttpConfirmation, resolveApiBase } from './config';

describe('server configuration', () => {
  it('derives the API base from a Storing web address', () => {
    expect(resolveApiBase('https://storing.example.com/')).toBe('https://storing.example.com/api/v1');
  });

  it('uses an advanced API override when configured', () => {
    expect(resolveApiBase('https://storing.example.com', 'http://192.168.1.10:1052/api/v1/')).toBe('http://192.168.1.10:1052/api/v1');
  });

  it('requires an explicit warning acknowledgement for non-local HTTP servers', () => {
    expect(requiresInsecureHttpConfirmation('http://192.168.1.10:1052/api/v1')).toBe(true);
    expect(requiresInsecureHttpConfirmation('http://localhost:1052/api/v1')).toBe(false);
    expect(requiresInsecureHttpConfirmation('https://storing.example.com/api/v1')).toBe(false);
  });
});

describe('current tab collection eligibility', () => {
  it('only accepts normal HTTP(S) pages', () => {
    expect(isCollectablePage('https://example.com/article')).toBe(true);
    expect(isCollectablePage('http://localhost:3000/article')).toBe(true);
    expect(isCollectablePage('chrome://settings')).toBe(false);
    expect(isCollectablePage('about:blank')).toBe(false);
    expect(isCollectablePage('file:///Users/example/article.html')).toBe(false);
  });
});
