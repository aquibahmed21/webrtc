import { describe, it, expect, beforeEach } from 'vitest';
import { applyTheme, getCurrentTheme, initializeTheme, themes } from '../theme.js';

describe('theme', () => {
  beforeEach(() => {
    document.documentElement.style.cssText = '';
    localStorage.clear();
  });

  it('applies theme variables to :root', () => {
    applyTheme('darkcyan');
    const root = document.documentElement;
    expect(root.style.getPropertyValue('--bg-primary')).toBe(themes.darkcyan.colors['--bg-primary']);
  });

  it('maps legacy purple to darkcyan and persists', () => {
    applyTheme('purple');
    expect(getCurrentTheme()).toBe('darkcyan');
  });

  it('initializes using saved theme', () => {
    localStorage.setItem('selectedTheme', 'dark');
    const used = initializeTheme();
    expect(used).toBe('dark');
    expect(document.documentElement.style.getPropertyValue('--bg-primary')).toBe(themes.dark.colors['--bg-primary']);
  });
});


