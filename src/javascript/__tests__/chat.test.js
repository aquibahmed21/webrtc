import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../room.js', () => ({
  drone: { rooms: { r: {} }, publish: vi.fn() },
}));

import { initializeChat } from '../chat.js';

describe('chat', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div class="controls"><button id="switchCamera"></button></div>';
    localStorage.clear();
    localStorage.setItem('userInfo', JSON.stringify({ id: 'me', nickname: 'Me' }));
  });

  it('creates chat UI and accepts basic message', () => {
    initializeChat();
    const toggle = document.getElementById('chatToggle');
    expect(toggle).toBeTruthy();
    toggle.click();
    const editor = document.getElementById('chatEditor');
    editor.innerHTML = 'Hello <script>alert(1)</script>World';
    document.getElementById('sendMessage').click();
    const messages = document.getElementById('chatMessages').textContent;
    expect(messages).toContain('Hello');
    expect(messages).toContain('World');
    expect(messages).not.toContain('script');
  });
});


