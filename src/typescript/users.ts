// users.ts - Participants list and direct messages
import { subscribeMembers, getMembers } from './room.js';
import { sendDirectMessage } from './chat.js';
import { showToast } from './toast.js';
import { Member, UserInfo } from '../types/index.js';

let usersPanel: HTMLElement | null = null;
let membersUnsub: (() => void) | null = null;
let initialized = false;

export function initializeUsersPanel(): void {
  try {
    if (initialized) return; // prevent duplicates
    initialized = true;
    createUsersUI();
    membersUnsub = subscribeMembers(renderMembers);
    // Initial render
    try { renderMembers(getMembers()); } catch {}
    try { renderRooms(); } catch {}
  } catch (e) {
    console.error('Failed to initialize users panel:', e);
  }
}

function createUsersUI(): void {
  // Renders into the shared side-drawer's People tab (index.html); the drawer itself
  // owns open/close + tab-switching (see app.ts's openDrawer/switchDrawerTab).
  usersPanel = document.getElementById('drawerPanePeople');
  if (!usersPanel) return;
  usersPanel.innerHTML = `
    <div class="people-room-row">
      <input id="customRoomName" placeholder="Enter room name" maxlength="100" />
      <button id="setRoom">Set Room</button>
    </div>
    <div class="chat-messages" id="usersList"></div>
    <div class="chat-messages" id="roomsList" style="margin-top:6px;"></div>
  `;

  document.getElementById('setRoom')?.addEventListener('click', () => {
    const input = document.getElementById('customRoomName') as HTMLInputElement;
    const value = (input.value || '').trim();
    if (!value) return;
    localStorage.setItem('roomName', value);
    showToast('Success', `Room set to ${value}. Share invite from list.`);
    upsertRoom(value);
    renderRooms();
  });
}

function renderMembers(members: Member[]): void {
  try {
    const list = document.getElementById('usersList');
    if (!list) return;
    list.innerHTML = '';
    const selfId = JSON.parse(localStorage.getItem('userInfo') || '{}').id;
    members.filter(m => m.id !== undefined && m.id !== null && m.id !== selfId).forEach(member => {
      const { userInfo = {} as UserInfo, callType } = member.clientData || {};
      const item = document.createElement('div');
      item.className = 'person-row';
      const name = userInfo.nickname || 'Unknown';
      const gender = userInfo.gender || '-';
      const status = userInfo.status || '';
      const age = userInfo.age || '';
      const initial = name.trim().charAt(0).toUpperCase() || '?';
      const liveTag = callType === 'live-host' ? '<span class="person-live-tag">🔴 LIVE</span>' : '';
      item.innerHTML = `
        <div class="person-avatar">${escapeHtml(initial)}<span class="presence-dot"></span></div>
        <div class="person-info">
          <div class="person-name">${escapeHtml(name)}${liveTag}</div>
          <div class="person-meta">${escapeHtml(gender)}${status ? ' • ' + escapeHtml(status) : ''}${age ? ' • ' + escapeHtml(String(age)) : ''}</div>
        </div>
        <div class="person-actions">
          <button class="dmBtn" data-id="${member.id}" title="Message">💬</button>
          <button class="inviteBtn" data-id="${member.id}" title="Invite">➕</button>
        </div>
      `;
      list.appendChild(item);
    });

    // Wire DM buttons
    list.querySelectorAll('.dmBtn').forEach(btn => {
      btn.addEventListener('click', () => {
        const toId = btn.getAttribute('data-id');
        const msg = prompt('Send a direct message:');
        if (!msg || !msg.trim()) return;
        try {
          sendDirectMessage(toId!, msg.trim());
          showToast('Success', 'Message sent');
        } catch (e) {
          showToast('Error', 'Failed to send message');
        }
      });
    });

    // Wire Invite buttons
    list.querySelectorAll('.inviteBtn').forEach(btn => {
      btn.addEventListener('click', () => {
        const toId = btn.getAttribute('data-id');
        const roomName = (localStorage.getItem('roomName') || '').trim();
        if (!roomName) {
          showToast('Warning', 'Set a room name first');
          return;
        }
        import('./room.js').then(({ drone }) => {
          if (drone && drone.rooms) {
            const room = Object.keys(drone.rooms)[0];
            drone.publish({ room, message: { type: 'invite', to: toId, roomName, fromUserInfo: JSON.parse(localStorage.getItem('userInfo')||'{}') } });
            showToast('Success', `Invite sent to join ${roomName}`);
          }
        }).catch(() => showToast('Error', 'Failed to send invite'));
      });
    });
  } catch (e) {
    console.error('Render members failed:', e);
  }
}

// ===== Rooms Manager (local only) =====
function getRooms(): string[] {
  try {
    const raw = localStorage.getItem('rooms_list');
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function setRooms(arr: string[]): void {
  try { localStorage.setItem('rooms_list', JSON.stringify(arr)); } catch {}
}

function upsertRoom(name: string): void {
  const rooms = getRooms();
  if (!rooms.includes(name)) rooms.push(name);
  setRooms(rooms);
}

function deleteRoom(name: string): void {
  const rooms = getRooms().filter(r => r !== name);
  setRooms(rooms);
  try { localStorage.removeItem(`rooms_members_${name}`); } catch {}
}

function clearAllRooms(): void {
  const rooms = getRooms();
  rooms.forEach(r => { try { localStorage.removeItem(`rooms_members_${r}`); } catch {} });
  setRooms([]);
}

function renderRooms(): void {
  const container = document.getElementById('roomsList');
  if (!container) return;
  const rooms = getRooms();
  container.innerHTML = '';
  const current = localStorage.getItem('roomName') || 'observable-e7b2d4';

  const header = document.createElement('div');
  header.className = 'chat-message';
  header.innerHTML = `<div class="sender">Rooms</div>`;
  container.appendChild(header);

  rooms.forEach(name => {
    const row = document.createElement('div');
    row.className = 'chat-message';
    const members = JSON.parse(localStorage.getItem(`rooms_members_${name}`) || '[]');
    const membersText = members.map((m: any) => m.nickname || m.id).join(', ');
    row.innerHTML = `
      <div style="display:flex; align-items:center; gap:6px;">
        <div style="flex:1;">
          <div><b>${escapeHtml(name)}</b> ${name===current? '(current)': ''}</div>
          <div style="font-size:0.8rem; opacity:0.85;">Users: ${escapeHtml(membersText)}</div>
        </div>
        <button class="roomSwitch" data-room="${escapeHtml(name)}" style="flex:unset; padding:4px 8px;">Join</button>
        <button class="roomEdit" data-room="${escapeHtml(name)}" style="flex:unset; padding:4px 8px;">Edit</button>
        <button class="roomDelete" data-room="${escapeHtml(name)}" style="flex:unset; padding:4px 8px;">Delete</button>
      </div>`;
    container.appendChild(row);
  });

  // Footer actions
  const footer = document.createElement('div');
  footer.className = 'chat-message';
  footer.innerHTML = `<div style="display:flex; gap:6px; justify-content:flex-end;"><button id="roomsClearAll" style="flex:unset; padding:4px 8px;">Clear All</button></div>`;
  container.appendChild(footer);

  container.querySelectorAll('.roomSwitch').forEach(btn => btn.addEventListener('click', () => {
    const r = btn.getAttribute('data-room');
    if (!r) return;
    localStorage.setItem('roomName', r);
    showToast('Info', `Joining ${r}...`);
    setTimeout(() => location.reload(), 300);
  }));
  container.querySelectorAll('.roomEdit').forEach(btn => btn.addEventListener('click', () => {
    const r = btn.getAttribute('data-room');
    const n = prompt('Rename room', r || '');
    if (!n || !n.trim()) return;
    const rooms = getRooms();
    const idx = rooms.indexOf(r || '');
    if (idx !== -1) rooms[idx] = n.trim();
    setRooms(rooms);
    const snapshot = localStorage.getItem(`rooms_members_${r}`);
    if (snapshot) { localStorage.setItem(`rooms_members_${n.trim()}`, snapshot); localStorage.removeItem(`rooms_members_${r}`); }
    if ((localStorage.getItem('roomName')||'') === r) localStorage.setItem('roomName', n.trim());
    renderRooms();
  }));
  container.querySelectorAll('.roomDelete').forEach(btn => btn.addEventListener('click', () => {
    const r = btn.getAttribute('data-room');
    if (!r) return;
    if (!confirm(`Delete room ${r}?`)) return;
    deleteRoom(r);
    renderRooms();
  }));
  const clearBtn = document.getElementById('roomsClearAll');
  if (clearBtn) clearBtn.addEventListener('click', () => { if (confirm('Clear all rooms?')) { clearAllRooms(); renderRooms(); }});
}

export function receiveDirectMessage(messageData: any, fromUserInfo: UserInfo): void {
  const name = fromUserInfo.nickname || 'Unknown';
  showToast('Info', `DM from ${name}: ${messageData.message}`);
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text == null ? '' : String(text);
  return div.innerHTML;
}

export function destroyUsersPanel(): void {
  try { if (membersUnsub) membersUnsub(); } catch {}
  // usersPanel is the persistent drawer pane (index.html), so just clear its content.
  try { if (usersPanel) usersPanel.innerHTML = ''; } catch {}
  initialized = false;
}
