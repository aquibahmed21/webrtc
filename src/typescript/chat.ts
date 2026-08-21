// chat.ts - Chat functionality for text messaging
import { showToast } from './toast.js';
import { MessageData, ReactionPayload, Attachment } from '../types/index.js';

let chatMessages: MessageData[] = [];
let chatPanel: HTMLElement | null = null;
let chatEditor: HTMLElement | null = null;
let fileInput: HTMLInputElement | null = null;
let replyContext: HTMLElement | null = null;
let currentReplyTo: number | null = null; // message id being replied to
let emojiMenu: HTMLElement | null = null;

export function initializeChat(): void {
  createChatUI();
  setupChatEventListeners();
  loadChatHistory();
}

function createChatUI(): void {
  // Renders into the shared side-drawer's Chat tab (index.html); the drawer itself
  // owns open/close + tab-switching (see app.ts's openDrawer/switchDrawerTab).
  chatPanel = document.getElementById('drawerPaneChat');
  if (!chatPanel) return;
  chatPanel.innerHTML = `
    <div class="chat-messages" id="chatMessages">
      <div class="chat-message system">
        <div class="content">Welcome to the chat! Type a message below.</div>
        <div class="time">${new Date().toLocaleTimeString()}</div>
      </div>
    </div>
    <div class="chat-input">
      <div class="chat-toolbar-row">
        <div id="chatToolbar" class="chat-toolbar">
          <button id="btnBold" title="Bold">B</button>
          <button id="btnItalic" title="Italic"><i>I</i></button>
          <button id="btnEmoji" title="Emoji">😊</button>
          <button id="btnAttach" title="Attach file" style="display:none;">📎</button>
          <input id="fileInput" type="file" multiple style="display:none;" />
        </div>
        <div id="replyContext" class="reply-context hidden"></div>
      </div>
      <div class="chat-composer-row">
        <div id="chatEditor" contenteditable="true" data-placeholder="Type a message..."></div>
        <button id="sendMessage" class="send-btn" title="Send message">➤</button>
      </div>
      <div id="emojiMenu" class="emoji-menu hidden"></div>
    </div>
  `;
  chatEditor = chatPanel.querySelector('#chatEditor');
  fileInput = chatPanel.querySelector('#fileInput') as HTMLInputElement;
  replyContext = chatPanel.querySelector('#replyContext');
  emojiMenu = chatPanel.querySelector('#emojiMenu');
}

function setupChatEventListeners(): void {
  // Send message
  const sendButton = document.getElementById('sendMessage');

  sendButton?.addEventListener('click', sendMessage);
  chatEditor?.addEventListener('keypress', (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (!e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    }
  });

  // Auto-scroll to bottom when new messages arrive
  const chatMessagesContainer = document.getElementById('chatMessages');
  chatMessagesContainer?.addEventListener('DOMNodeInserted', () => {
    if (chatMessagesContainer) {
      chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
    }
  });

  // Rich text toolbar
  document.getElementById('btnBold')?.addEventListener('click', () => execCmd('bold'));
  document.getElementById('btnItalic')?.addEventListener('click', () => execCmd('italic'));
  document.getElementById('btnAttach')?.addEventListener('click', () => fileInput?.click());
  document.getElementById('btnEmoji')?.addEventListener('click', toggleEmojiMenu);
  fileInput?.addEventListener('change', handleFileSelection);
}

async function sendMessage(): Promise<void> {
  const rawHtml = (chatEditor?.innerHTML || '').trim();
  const hasText = stripHtml(rawHtml).trim().length > 0;
  let attachments = await collectPendingAttachments();
  // Attempt to compress image attachments to fit signalling limits
  attachments = await maybeCompressAttachments(attachments);
  if (!hasText && attachments.length === 0) return;

  const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
  const senderName = userInfo.nickname || 'Anonymous';
  const sanitizedHtml = sanitizeHtml(rawHtml);
  const messageData: MessageData = {
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

function addMessageToChat(messageData: MessageData, isOwn = false): void {
  const chatMessagesContainer = document.getElementById('chatMessages');
  const messageElement = document.createElement('div');
  messageElement.className = `chat-message ${isOwn ? 'own' : ''}`;
  messageElement.setAttribute('data-id', messageData.id.toString());

  const time = new Date(messageData.timestamp).toLocaleTimeString();

  // Reply preview
  let replyHtml = '';
  if (messageData.replyTo) {
    const replied = chatMessages.find(m => m.id === messageData.replyTo);
    if (replied) {
      const replyText = (replied.text || '').slice(0, 120);
      replyHtml = `<div class="reply-preview">Replying to <b>${escapeHtml(replied.sender)}</b>: ${escapeHtml(replyText)}</div>`;
    }
  }

  // Attachments
  const attachmentsHtml = (messageData.attachments || []).map(att => renderAttachment(att)).join('');

  // Reaction bar
  const reactionsBar = `<div class="reactions">
      <button class="reactBtn" data-emoji="👍" title="Like">👍</button>
      <button class="reactBtn" data-emoji="❤️" title="Love">❤️</button>
      <button class="reactBtn" data-emoji="😂" title="Haha">😂</button>
      <button class="replyBtn" title="Reply">↩︎</button>
      <span class="reactionsDisplay"></span>
    </div>`;

  const avatarInitial = (messageData.sender || '?').trim().charAt(0).toUpperCase() || '?';

  const contentHtml = messageData.type === 'message'
    ? `<div class="msg-avatar">${escapeHtml(avatarInitial)}</div>
       <div class="msg-body">
         <div class="msg-header"><span class="sender">${escapeHtml(messageData.sender)}</span><span class="time">${time}</span></div>
         ${replyHtml}
         <div class="content">${messageData.html || escapeHtml(messageData.text || '')}</div>
         ${attachmentsHtml}
         ${reactionsBar}
       </div>`
    : '';

  // Reaction-only updates will be applied via updateMessageReactions
  if (contentHtml) messageElement.innerHTML = contentHtml;

  chatMessagesContainer?.appendChild(messageElement);

  // Auto-scroll to bottom
  if (chatMessagesContainer) {
    chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
  }

  // Store message
  chatMessages.push(messageData);

  // Keep only last 100 messages
  if (chatMessages.length > 100) {
    chatMessages = chatMessages.slice(-100);
  }

  // Wire actions
  wireMessageActions(messageElement, messageData);
}

function sendChatMessage(messageData: MessageData): void {
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

export function receiveChatMessage(messageData: MessageData): void {
  // Called when receiving a chat message from another participant
  if (messageData.type === 'reaction') {
    applyIncomingReaction(messageData as any);
    return;
  }
  addMessageToChat(messageData, false);
  persistChatMessage(messageData);
}

export function sendDirectMessage(toMemberId: string, message: string): void {
  const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
  const messageData: MessageData = {
    id: Date.now(),
    sender: userInfo.nickname || 'Anonymous',
    senderId: userInfo.id || 'unknown',
    text: message,
    timestamp: new Date().toISOString(),
    type: 'message'
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

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Export for integration with room.js
export { addMessageToChat, sendChatMessage };

// ===== Advanced Chat Helpers =====

function execCmd(cmd: string): void {
  (chatEditor as HTMLElement)?.focus();
  document.execCommand(cmd, false, undefined);
}

function toggleEmojiMenu(e?: Event): void {
  if (!emojiMenu) return;
  if (emojiMenu.style.display === 'none' || !emojiMenu.style.display) {
    emojiMenu.style.display = 'grid';
    emojiMenu.style.gridTemplateColumns = 'repeat(6, 1fr)';
    emojiMenu.innerHTML = ['😀','😂','😍','👍','🙏','🎉','🔥','😮','😢','😆','😎','❤️']
      .map(em => `<button class="emojiPick" style="padding:4px; background:none; border:none; font-size:20px;">${em}</button>`)
      .join('');
    const rect = (e?.target as HTMLElement)?.getBoundingClientRect?.();
    if (rect) {
      emojiMenu.style.top = `${rect.bottom + window.scrollY + 6}px`;
      emojiMenu.style.left = `${rect.left + window.scrollX}px`;
    }
    emojiMenu.querySelectorAll('.emojiPick').forEach(btn => {
      btn.addEventListener('click', () => {
        insertAtCursor(btn.textContent || '');
        emojiMenu!.style.display = 'none';
        (chatEditor as HTMLElement)?.focus();
      });
    });
  } else {
    emojiMenu.style.display = 'none';
  }
}

function insertAtCursor(text: string): void {
  (chatEditor as HTMLElement)?.focus();
  document.execCommand('insertText', false, text);
}

function stripHtml(html: string): string {
  const tmp = document.createElement('div');
  tmp.innerHTML = html || '';
  return tmp.textContent || tmp.innerText || '';
}

function sanitizeHtml(html: string): string {
  if (!html) return '';
  const allowed = new Set(['B','STRONG','I','EM','BR','SPAN','A']);
  const container = document.createElement('div');
  container.innerHTML = html;
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_ELEMENT, null);
  const toRemove: Element[] = [];
  while (walker.nextNode()) {
    const el = walker.currentNode as Element;
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

function estimateSize(obj: any): number {
  try { return JSON.stringify(obj).length; } catch { return 0; }
}

// File sharing
let pendingFiles: File[] = [];
function handleFileSelection(e: Event): void {
  const target = e.target as HTMLInputElement;
  const files = Array.from(target.files || []);
  const maxSize = 5 * 1024 * 1024; // 5MB per file
  files.forEach(file => {
    if (file.size > maxSize) {
      showToast('Warning', `${file.name} is too large (max 5MB)`);
      return;
    }
    pendingFiles.push(file);
  });
  // Show small hint in replyContext
  if (pendingFiles.length && replyContext) {
    replyContext.style.display = '';
    replyContext.textContent = `${pendingFiles.length} attachment(s) selected`;
  }
}

function collectPendingAttachments(): Promise<Attachment[]> {
  if (!pendingFiles.length) return Promise.resolve([]);
  const tasks = pendingFiles.map(file => new Promise<Attachment | null>(resolve => {
    const reader = new FileReader();
    reader.onload = () => resolve({
      name: file.name,
      type: file.type,
      size: file.size,
      dataUrl: reader.result as string
    });
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  }));
  return Promise.all(tasks).then(arr => arr.filter(Boolean) as Attachment[]);
}

async function maybeCompressAttachments(attList: Attachment[]): Promise<Attachment[]> {
  const result: Attachment[] = [];
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

function compressImageDataUrl(dataUrl: string, maxW = 900, maxH = 900, quality = 0.7): Promise<string> {
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
      if (ctx) {
        ctx.drawImage(img, 0, 0, cw, ch);
        try {
          const out = canvas.toDataURL('image/jpeg', quality);
          resolve(out);
        } catch (e) { resolve(dataUrl); }
      } else {
        resolve(dataUrl);
      }
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

function renderAttachment(att: Attachment): string {
  const safeName = escapeHtml(att.name || 'file');
  if ((att.type || '').startsWith('image/')) {
    return `<div style="margin-top:6px;"><img src="${att.dataUrl}" alt="${safeName}" style="max-width:200px; border-radius:6px;" /></div>`;
  }
  return `<div style="margin-top:6px;"><a href="${att.dataUrl}" download="${safeName}">📎 ${safeName}</a></div>`;
}

function clearComposer(): void {
  if (chatEditor) chatEditor.innerHTML = '';
  pendingFiles = [];
  currentReplyTo = null;
  if (replyContext) {
    replyContext.style.display = 'none';
    replyContext.textContent = '';
  }
  if (fileInput) fileInput.value = '';
}

function wireMessageActions(messageElement: HTMLElement, messageData: MessageData): void {
  const replyBtn = messageElement.querySelector('.replyBtn');
  const reactBtns = messageElement.querySelectorAll('.reactBtn');
  if (replyBtn) {
    replyBtn.addEventListener('click', () => {
      currentReplyTo = messageData.id;
      if (replyContext) {
        replyContext.style.display = '';
        replyContext.textContent = `Replying to ${messageData.sender}: ${(messageData.text||'').slice(0,80)}`;
      }
      (chatEditor as HTMLElement)?.focus();
    });
  }
  reactBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const emoji = btn.getAttribute('data-emoji');
      if (emoji) addReaction(messageData.id, emoji);
    });
  });
  updateReactionsDisplay(messageElement, messageData.reactions || {});
}

function addReaction(messageId: number, emoji: string): void {
  const user = JSON.parse(localStorage.getItem('userInfo')||'{}');
  const payload: ReactionPayload = { 
    id: Date.now(), 
    type: 'reaction', 
    messageId, 
    emoji, 
    userId: user.id, 
    userName: user.nickname, 
    timestamp: new Date().toISOString() 
  };
  // Update local
  applyIncomingReaction(payload);
  // Broadcast
  sendChatMessage(payload as any);
}

function applyIncomingReaction(payload: ReactionPayload): void {
  const idx = chatMessages.findIndex(m => m.id === payload.messageId);
  if (idx === -1) return;
  const msg = chatMessages[idx];
  if (!msg.reactions) msg.reactions = {};
  const key = payload.emoji;
  if (!msg.reactions[key]) msg.reactions[key] = new Set();
  if (Array.isArray(msg.reactions[key])) msg.reactions[key] = new Set(msg.reactions[key] as string[]);
  (msg.reactions[key] as Set<string>).add(payload.userId || 'unknown');
  // Update UI
  const el = document.querySelector(`.chat-message[data-id="${msg.id}"]`);
  if (el) updateReactionsDisplay(el as HTMLElement, msg.reactions);
  // Persist updated message
  persistReplaceMessage(msg);
}

function updateReactionsDisplay(messageElement: HTMLElement, reactions: Record<string, Set<string> | string[]>): void {
  const disp = messageElement.querySelector('.reactionsDisplay');
  if (!disp) return;
  const parts: string[] = [];
  Object.keys(reactions || {}).forEach(k => {
    const v = reactions[k];
    const count = v instanceof Set ? v.size : (Array.isArray(v) ? v.length : 0);
    if (count > 0) parts.push(`${k} ${count}`);
  });
  disp.textContent = parts.join('  ');
}

// Persistence per room
function getRoomKey(): string {
  const room = localStorage.getItem('roomName') || 'observable-e7b2d4';
  return `chat_history_${room}`;
}

function loadChatHistory(): void {
  try {
    const raw = localStorage.getItem(getRoomKey());
    if (!raw) return;
    const arr = JSON.parse(raw);
    (arr || []).forEach((msg: any) => {
      // Convert reactions arrays back to Sets for UI use
      if (msg.reactions) {
        Object.keys(msg.reactions).forEach((k: string) => {
          if (Array.isArray(msg.reactions[k])) msg.reactions[k] = new Set(msg.reactions[k]);
        });
      }
      addMessageToChat(msg, msg.senderId === (JSON.parse(localStorage.getItem('userInfo')||'{}').id));
    });
  } catch {}
}

function persistChatMessage(message: MessageData): void {
  try {
    const raw = localStorage.getItem(getRoomKey());
    const arr = raw ? JSON.parse(raw) : [];
    arr.push(serializeMessage(message));
    localStorage.setItem(getRoomKey(), JSON.stringify(arr.slice(-200)));
  } catch {}
}

function persistReplaceMessage(message: MessageData): void {
  try {
    const raw = localStorage.getItem(getRoomKey());
    const arr = raw ? JSON.parse(raw) : [];
    const idx = arr.findIndex((m: any) => m.id === message.id);
    if (idx !== -1) arr[idx] = serializeMessage(message);
    localStorage.setItem(getRoomKey(), JSON.stringify(arr));
  } catch {}
}

function serializeMessage(message: MessageData): any {
  const clone = JSON.parse(JSON.stringify(message));
  if (clone.reactions) {
    Object.keys(clone.reactions).forEach((k: string) => {
      if (clone.reactions[k] instanceof Set) clone.reactions[k] = Array.from(clone.reactions[k]);
    });
  }
  return clone;
}
