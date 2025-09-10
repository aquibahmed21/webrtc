import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../room.js', () => ({
  subscribeMembers: (cb) => {
    cb([
      { id: 'peer1', userInfo: { nickname: 'Alice' } },
      { id: 'peer2', userInfo: { nickname: 'Bob' } }
    ]);
    return () => {};
  },
  getMembers: () => ([
    { id: 'peer1', userInfo: { nickname: 'Alice' } },
    { id: 'peer2', userInfo: { nickname: 'Bob' } }
  ])
}));

import { initializeUsersPanel } from '../users.js';

describe('users panel', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div class="controls"><button id="hangup"></button></div>';
    localStorage.clear();
  });

  it('creates toggle and renders participants', () => {
    initializeUsersPanel();
    const toggle = document.getElementById('usersToggle');
    expect(toggle).toBeTruthy();
    toggle.click();
    const list = document.getElementById('usersList');
    expect(list.textContent).toContain('Alice');
    expect(list.textContent).toContain('Bob');
  });
});


