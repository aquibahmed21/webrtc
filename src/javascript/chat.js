// chat.js - Chat functionality for text messaging
import { showToast } from './toast.js';

let chatMessages = [];
let chatPanel = null;
let chatToggle = null;

export function initializeChat() {
  createChatUI();
  setupChatEventListeners();
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
      <input type="text" id="chatInput" placeholder="Type a message..." maxlength="500">
      <button id="sendMessage">Send</button>
    </div>
  `;
  document.body.appendChild(chatPanel);
}

function setupChatEventListeners() {
  // Toggle chat panel
  chatToggle.addEventListener('click', () => {
    chatPanel.classList.toggle('active');
    if (chatPanel.classList.contains('active')) {
      document.getElementById('chatInput').focus();
    }
  });

  // Close chat panel
  document.getElementById('closeChat').addEventListener('click', () => {
    chatPanel.classList.remove('active');
  });

  // Send message
  const sendButton = document.getElementById('sendMessage');
  const chatInput = document.getElementById('chatInput');

  sendButton.addEventListener('click', sendMessage);
  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  });

  // Auto-scroll to bottom when new messages arrive
  const chatMessagesContainer = document.getElementById('chatMessages');
  chatMessagesContainer.addEventListener('DOMNodeInserted', () => {
    chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
  });
}

function sendMessage() {
  const chatInput = document.getElementById('chatInput');
  const message = chatInput.value.trim();

  if (!message) return;

  const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
  const senderName = userInfo.nickname || 'Anonymous';
  const messageData = {
    id: Date.now(),
    sender: senderName,
    senderId: userInfo.id || 'unknown',
    message: message,
    timestamp: new Date().toISOString()
  };

  // Add to local chat
  addMessageToChat(messageData, true);

  // Send to other participants via signaling
  sendChatMessage(messageData);

  // Clear input
  chatInput.value = '';
}

function addMessageToChat(messageData, isOwn = false) {
  const chatMessagesContainer = document.getElementById('chatMessages');
  const messageElement = document.createElement('div');
  messageElement.className = `chat-message ${isOwn ? 'own' : ''}`;

  const time = new Date(messageData.timestamp).toLocaleTimeString();

  messageElement.innerHTML = `
    <div class="sender">${messageData.sender}</div>
    <div>${escapeHtml(messageData.message)}</div>
    <div class="time">${time}</div>
  `;

  chatMessagesContainer.appendChild(messageElement);

  // Auto-scroll to bottom
  chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;

  // Store message
  chatMessages.push(messageData);

  // Keep only last 100 messages
  if (chatMessages.length > 100) {
    chatMessages = chatMessages.slice(-100);
  }
}

function sendChatMessage(messageData) {
  // Import drone from room.js dynamically to avoid circular dependency
  import('./room.js').then(({ drone }) => {
    if (drone && drone.rooms) {
      const roomName = Object.keys(drone.rooms)[0];
      if (roomName) {
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
  addMessageToChat(messageData, false);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Export for integration with room.js
export { addMessageToChat, sendChatMessage };
