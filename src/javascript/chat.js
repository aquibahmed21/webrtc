// chat.js - Chat functionality for text messaging
import { showToast } from './toast.js';

let chatMessages = [];
let chatPanel = null;
let chatToggle = null;
let chatEditor = null;
let fileInput = null;
let replyContext = null;
let currentReplyTo = null; // message id being replied to
let emojiMenu = null;

export function initializeChat() {
  createChatUI();
  setupChatEventListeners();
  loadChatHistory();
}

function createChatUI() {
  // Create chat toggle button
  chatToggle = document.createElement('button');
  chatToggle.id = 'chatToggle';
  chatToggle.innerHTML = '💬 Chat';
  chatToggle.title = 'Toggle Chat';
  const switchCamera = document.getElementById("switchCamera");
  switchCamera.parentNode.insertBefore(chatToggle, switchCamera.nextSibling);


  // Create chat panel
  chatPanel = document.createElement('div');
  chatPanel.className = 'chat-panel';
  chatPanel.innerHTML = `
    <div class="chat-header">
      <span>Chat</span>
      <button id="closeChat" style="background: none; border: none; color: var(--text-primary); font-size: 1.2rem; cursor: pointer;">×</button>
    </div>
    <div class="chat-messages" id="chatMessages">
      <div class="chat-message">
        <div class="sender">System</div>
        <div>Welcome to the chat! Type a message below.</div>
        <div class="time">${new Date().toLocaleTimeString()}</div>
      </div>
    </div>
    <div class="chat-input">
      <div style="display:flex;gap:6px;width:100%;align-items:center;justify-content: flex-end;">
        <div id="chatToolbar" style="display:flex; gap:6px;">
          <button id="btnBold" title="Bold" style="flex:unset; padding:4px 8px;">B</button>
          <button id="btnItalic" title="Italic" style="flex:unset; padding:4px 8px;"><i>I</i></button>
          <button id="btnEmoji" title="Emoji" style="flex:unset; padding:4px 8px;">😊</button>
          <button id="btnAttach" title="Attach file" style="flex:unset; padding:4px 8px; display:none;">📎</button>
          <input id="fileInput" type="file" multiple style="display:none;" />
        </div>
        <div id="replyContext" style="display:none; font-size:0.8rem; opacity:0.8; background: var(--bg-secondary); padding:2px 6px; border-radius:6px;"></div>
      </div>
      <div id="chatEditor" contenteditable="true" placeholder="Type a message..." style="flex:1; min-height:44px; max-height:140px; overflow:auto; padding:8px; border: 1px solid var(--border-primary); border-radius: var(--radius-small); background: var(--bg-input);"></div>
      <button id="sendMessage">Send</button>
      <div id="emojiMenu" style="display:none; position:absolute; background: var(--bg-panel); padding:6px; border-radius:8px; box-shadow: var(--shadow-soft); gap:4px;"></div>
    </div>
  `;
  document.body.appendChild(chatPanel);
  chatEditor = chatPanel.querySelector('#chatEditor');
  fileInput = chatPanel.querySelector('#fileInput');
  replyContext = chatPanel.querySelector('#replyContext');
  emojiMenu = chatPanel.querySelector('#emojiMenu');
}

function setupChatEventListeners() {
  // Toggle chat panel
  chatToggle.addEventListener('click', () => {
    chatPanel.classList.toggle('active');
    if (chatPanel.classList.contains('active')) {
      chatEditor.focus();
    }
  });

  // Close chat panel
  document.getElementById('closeChat').addEventListener('click', () => {
    chatPanel.classList.remove('active');
  });

  // Send message
  const sendButton = document.getElementById('sendMessage');

  sendButton.addEventListener('click', sendMessage);
  chatEditor.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      if (!e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    }
  });

  // Auto-scroll to bottom when new messages arrive
  const chatMessagesContainer = document.getElementById('chatMessages');
  chatMessagesContainer.addEventListener('DOMNodeInserted', () => {
    chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
  });

  // Rich text toolbar
  document.getElementById('btnBold').addEventListener('click', () => execCmd('bold'));
  document.getElementById('btnItalic').addEventListener('click', () => execCmd('italic'));
  document.getElementById('btnAttach').addEventListener('click', () => fileInput.click());
  document.getElementById('btnEmoji').addEventListener('click', toggleEmojiMenu);
  fileInput.addEventListener('change', handleFileSelection);
}

async function sendMessage() {
  const rawHtml = (chatEditor.innerHTML || '').trim();
  const hasText = stripHtml(rawHtml).trim().length > 0;
  let attachments = await collectPendingAttachments();
  // Attempt to compress image attachments to fit signalling limits
  attachments = await maybeCompressAttachments(attachments);
  if (!hasText && attachments.length === 0) return;

  const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
  const senderName = userInfo.nickname || 'Anonymous';
  const sanitizedHtml = sanitizeHtml(rawHtml);
  const messageData = {
    id: Date.now(),
    type: 'message',
    sender: senderName,
    senderId: userInfo.id || 'unknown',
    html: sanitizedHtml,
    text: stripHtml(sanitizedHtml).slice(0, 1000),
    timestamp: new Date().toISOString(),
    replyTo: currentReplyTo || null,
    attachments: attachments,
    reactions: {}
  };

  // Ensure payload size under ~9.5KB to avoid signalling limits
  const estimatedSize = estimateSize({ type: 'chat', messageData });
  if (estimatedSize > 9500) {
    showToast('Warning', 'Message too large to send. Reduce attachments or text.');
    return;
  }

  addMessageToChat(messageData, true);
  sendChatMessage(messageData);
  persistChatMessage(messageData);
  clearComposer();
}

function addMessageToChat(messageData, isOwn = false) {
  const chatMessagesContainer = document.getElementById('chatMessages');
  const messageElement = document.createElement('div');
  messageElement.className = `chat-message ${isOwn ? 'own' : ''}`;
  messageElement.setAttribute('data-id', messageData.id);

  const time = new Date(messageData.timestamp).toLocaleTimeString();

  // Reply preview
  let replyHtml = '';
  if (messageData.replyTo) {
    const replied = chatMessages.find(m => m.id === messageData.replyTo);
    if (replied) {
      const replyText = (replied.text || '').slice(0, 120);
      replyHtml = `<div style="font-size:0.75rem; opacity:0.8; border-left:2px solid var(--border-primary); padding-left:6px; margin-bottom:4px;">Replying to <b>${escapeHtml(replied.sender)}</b>: ${escapeHtml(replyText)}</div>`;
    }
  }

  // Attachments
  const attachmentsHtml = (messageData.attachments || []).map(att => renderAttachment(att)).join('');

  // Reaction bar
  const reactionsBar = `<div class="reactions" style="margin-top:6px; display:flex; gap:6px; align-items:center;">
      <button class="reactBtn" data-emoji="👍" title="Like" style="flex:unset; padding:2px 6px;">👍</button>
      <button class="reactBtn" data-emoji="❤️" title="Love" style="flex:unset; padding:2px 6px;">❤️</button>
      <button class="reactBtn" data-emoji="😂" title="Haha" style="flex:unset; padding:2px 6px;">😂</button>
      <button class="replyBtn" title="Reply" style="flex:unset; padding:2px 6px;">↩︎ Reply</button>
      <span class="reactionsDisplay" style="margin-left:auto; font-size:0.9rem;"></span>
    </div>`;

  const contentHtml = messageData.type === 'message'
    ? `<div class="sender">${escapeHtml(messageData.sender)}</div>
       ${replyHtml}
       <div class="content">${messageData.html || escapeHtml(messageData.text || '')}</div>
       ${attachmentsHtml}
       <div class="time">${time}</div>
       ${reactionsBar}`
    : '';

  // Reaction-only updates will be applied via updateMessageReactions
  if (contentHtml) messageElement.innerHTML = contentHtml;

  chatMessagesContainer.appendChild(messageElement);

  // Auto-scroll to bottom
  chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;

  // Store message
  chatMessages.push(messageData);

  // Keep only last 100 messages
  if (chatMessages.length > 100) {
    chatMessages = chatMessages.slice(-100);
  }

  // Wire actions
  wireMessageActions(messageElement, messageData);
}

function sendChatMessage(messageData) {
  // Import drone from room.js dynamically to avoid circular dependency
  import('./room.js').then(({ drone }) => {
    if (drone && drone.rooms) {
      const roomName = Object.keys(drone.rooms)[0];
      if (roomName && typeof drone.publish === 'function') {
        drone.publish({
          room: roomName,
          message: {
            type: 'chat',
            messageData: messageData,
            userInfo: JSON.parse(localStorage.getItem('userInfo') || '{}')
          }
        });
        console.log('Chat message sent:', messageData);
      }
    }
  }).catch(err => {
    console.error('Failed to send chat message:', err);
    showToast('Error', 'Failed to send message');
  });
}

export function receiveChatMessage(messageData) {
  // Called when receiving a chat message from another participant
  if (messageData.type === 'reaction') {
    applyIncomingReaction(messageData);
    return;
  }
  addMessageToChat(messageData, false);
  persistChatMessage(messageData);
}

export function sendDirectMessage(toMemberId, message) {
  const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
  const messageData = {
    id: Date.now(),
    sender: userInfo.nickname || 'Anonymous',
    senderId: userInfo.id || 'unknown',
    message,
    timestamp: new Date().toISOString(),
    to: toMemberId
  };

  // Add to local chat with receiver indicated
  addMessageToChat({ ...messageData, sender: `${messageData.sender} → DM` }, true);

  import('./room.js').then(({ drone }) => {
    if (drone && drone.rooms) {
      const roomName = Object.keys(drone.rooms)[0];
      if (roomName) {
        drone.publish({
          room: roomName,
          message: {
            type: 'dm',
            to: toMemberId,
            messageData,
            fromUserInfo: userInfo
          }
        });
      }
    }
  }).catch(() => {});
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Export for integration with room.js
export { addMessageToChat, sendChatMessage };

// ===== Advanced Chat Helpers =====

function execCmd(cmd) {
  chatEditor.focus();
  document.execCommand(cmd, false, null);
}

function toggleEmojiMenu(e) {
  if (!emojiMenu) return;
  if (emojiMenu.style.display === 'none' || !emojiMenu.style.display) {
    emojiMenu.style.display = 'grid';
    emojiMenu.style.gridTemplateColumns = 'repeat(6, 1fr)';
    emojiMenu.innerHTML = ['😀','😂','😍','👍','🙏','🎉','🔥','😮','😢','😆','😎','❤️']
      .map(em => `<button class="emojiPick" style="padding:4px; background:none; border:none; font-size:20px;">${em}</button>`)
      .join('');
    const rect = e?.target?.getBoundingClientRect?.();
    if (rect) {
      emojiMenu.style.top = `${rect.bottom + window.scrollY + 6}px`;
      emojiMenu.style.left = `${rect.left + window.scrollX}px`;
    }
    emojiMenu.querySelectorAll('.emojiPick').forEach(btn => {
      btn.addEventListener('click', () => {
        insertAtCursor(btn.textContent);
        emojiMenu.style.display = 'none';
        chatEditor.focus();
      });
    });
  } else {
    emojiMenu.style.display = 'none';
  }
}

function insertAtCursor(text) {
  chatEditor.focus();
  document.execCommand('insertText', false, text);
}

function stripHtml(html) {
  const tmp = document.createElement('div');
  tmp.innerHTML = html || '';
  return tmp.textContent || tmp.innerText || '';
}

function sanitizeHtml(html) {
  if (!html) return '';
  const allowed = new Set(['B','STRONG','I','EM','BR','SPAN','A']);
  const container = document.createElement('div');
  container.innerHTML = html;
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_ELEMENT, null);
  const toRemove = [];
  while (walker.nextNode()) {
    const el = walker.currentNode;
    if (!allowed.has(el.nodeName)) {
      toRemove.push(el);
      continue;
    }
    // Remove dangerous attrs
    [...el.attributes].forEach(attr => {
      const name = attr.name.toLowerCase();
      if (name.startsWith('on') || name === 'style') el.removeAttribute(attr.name);
    });
    if (el.nodeName === 'A') {
      const href = el.getAttribute('href') || '';
      if (!/^https?:\/\//i.test(href)) el.removeAttribute('href');
      el.setAttribute('target', '_blank');
      el.setAttribute('rel', 'noopener noreferrer');
    }
  }
  toRemove.forEach(n => n.replaceWith(document.createTextNode(n.textContent || '')));
  return container.innerHTML;
}

function estimateSize(obj) {
  try { return JSON.stringify(obj).length; } catch { return 0; }
}

// File sharing
let pendingFiles = [];
function handleFileSelection(e) {
  const files = Array.from(e.target.files || []);
  const maxSize = 5 * 1024 * 1024; // 5MB per file
  files.forEach(file => {
    if (file.size > maxSize) {
      showToast('Warning', `${file.name} is too large (max 5MB)`);
      return;
    }
    pendingFiles.push(file);
  });
  // Show small hint in replyContext
  if (pendingFiles.length) {
    replyContext.style.display = '';
    replyContext.textContent = `${pendingFiles.length} attachment(s) selected`;
  }
}

function collectPendingAttachments() {
  if (!pendingFiles.length) return Promise.resolve([]);
  const tasks = pendingFiles.map(file => new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = () => resolve({
      name: file.name,
      type: file.type,
      size: file.size,
      dataUrl: reader.result
    });
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  }));
  return Promise.all(tasks).then(arr => arr.filter(Boolean));
}

async function maybeCompressAttachments(attList) {
  const result = [];
  for (const att of attList) {
    if ((att.type || '').startsWith('image/') && typeof att.dataUrl === 'string') {
      try {
        const compressed = await compressImageDataUrl(att.dataUrl, 900, 900, 0.7);
        result.push({ ...att, dataUrl: compressed });
      } catch {
        result.push(att);
      }
    } else {
      result.push(att);
    }
  }
  return result;
}

function compressImageDataUrl(dataUrl, maxW = 900, maxH = 900, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      const ratio = Math.min(1, maxW / width, maxH / height);
      const cw = Math.max(1, Math.floor(width * ratio));
      const ch = Math.max(1, Math.floor(height * ratio));
      const canvas = document.createElement('canvas');
      canvas.width = cw; canvas.height = ch;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, cw, ch);
      try {
        const out = canvas.toDataURL('image/jpeg', quality);
        resolve(out);
      } catch (e) { resolve(dataUrl); }
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

function renderAttachment(att) {
  const safeName = escapeHtml(att.name || 'file');
  if ((att.type || '').startsWith('image/')) {
    return `<div style="margin-top:6px;"><img src="${att.dataUrl}" alt="${safeName}" style="max-width:200px; border-radius:6px;" /></div>`;
  }
  return `<div style="margin-top:6px;"><a href="${att.dataUrl}" download="${safeName}">📎 ${safeName}</a></div>`;
}

function clearComposer() {
  chatEditor.innerHTML = '';
  pendingFiles = [];
  currentReplyTo = null;
  replyContext.style.display = 'none';
  replyContext.textContent = '';
  fileInput.value = '';
}

function wireMessageActions(messageElement, messageData) {
  const replyBtn = messageElement.querySelector('.replyBtn');
  const reactBtns = messageElement.querySelectorAll('.reactBtn');
  if (replyBtn) {
    replyBtn.addEventListener('click', () => {
      currentReplyTo = messageData.id;
      replyContext.style.display = '';
      replyContext.textContent = `Replying to ${messageData.sender}: ${(messageData.text||'').slice(0,80)}`;
      chatEditor.focus();
    });
  }
  reactBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const emoji = btn.getAttribute('data-emoji');
      addReaction(messageData.id, emoji);
    });
  });
  updateReactionsDisplay(messageElement, messageData.reactions || {});
}

function addReaction(messageId, emoji) {
  const user = JSON.parse(localStorage.getItem('userInfo')||'{}');
  const payload = { id: Date.now(), type: 'reaction', messageId, emoji, userId: user.id, userName: user.nickname, timestamp: new Date().toISOString() };
  // Update local
  applyIncomingReaction(payload);
  // Broadcast
  sendChatMessage(payload);
}

function applyIncomingReaction(payload) {
  const idx = chatMessages.findIndex(m => m.id === payload.messageId);
  if (idx === -1) return;
  const msg = chatMessages[idx];
  if (!msg.reactions) msg.reactions = {};
  const key = payload.emoji;
  if (!msg.reactions[key]) msg.reactions[key] = new Set();
  if (Array.isArray(msg.reactions[key])) msg.reactions[key] = new Set(msg.reactions[key]);
  msg.reactions[key].add(payload.userId || 'unknown');
  // Update UI
  const el = document.querySelector(`.chat-message[data-id="${msg.id}"]`);
  if (el) updateReactionsDisplay(el, msg.reactions);
  // Persist updated message
  persistReplaceMessage(msg);
}

function updateReactionsDisplay(messageElement, reactions) {
  const disp = messageElement.querySelector('.reactionsDisplay');
  if (!disp) return;
  const parts = [];
  Object.keys(reactions || {}).forEach(k => {
    const v = reactions[k];
    const count = v instanceof Set ? v.size : (Array.isArray(v) ? v.length : 0);
    if (count > 0) parts.push(`${k} ${count}`);
  });
  disp.textContent = parts.join('  ');
}

// Persistence per room
function getRoomKey() {
  const room = localStorage.getItem('roomName') || 'observable-e7b2d4';
  return `chat_history_${room}`;
}

function loadChatHistory() {
  try {
    const raw = localStorage.getItem(getRoomKey());
    if (!raw) return;
    const arr = JSON.parse(raw);
    (arr || []).forEach(msg => {
      // Convert reactions arrays back to Sets for UI use
      if (msg.reactions) {
        Object.keys(msg.reactions).forEach(k => {
          if (Array.isArray(msg.reactions[k])) msg.reactions[k] = new Set(msg.reactions[k]);
        });
      }
      addMessageToChat(msg, msg.senderId === (JSON.parse(localStorage.getItem('userInfo')||'{}').id));
    });
  } catch {}
}

function persistChatMessage(message) {
  try {
    const raw = localStorage.getItem(getRoomKey());
    const arr = raw ? JSON.parse(raw) : [];
    arr.push(serializeMessage(message));
    localStorage.setItem(getRoomKey(), JSON.stringify(arr.slice(-200)));
  } catch {}
}

function persistReplaceMessage(message) {
  try {
    const raw = localStorage.getItem(getRoomKey());
    const arr = raw ? JSON.parse(raw) : [];
    const idx = arr.findIndex(m => m.id === message.id);
    if (idx !== -1) arr[idx] = serializeMessage(message);
    localStorage.setItem(getRoomKey(), JSON.stringify(arr));
  } catch {}
}

function serializeMessage(message) {
  const clone = JSON.parse(JSON.stringify(message));
  if (clone.reactions) {
    Object.keys(clone.reactions).forEach(k => {
      if (clone.reactions[k] instanceof Set) clone.reactions[k] = Array.from(clone.reactions[k]);
    });
  }
  return clone;
}
