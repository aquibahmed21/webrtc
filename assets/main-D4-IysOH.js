var _a, _b, _c, _d;
/* empty css                       */
/* empty css                 */
(function polyfill() {
  const relList = document.createElement("link").relList;
  if (relList && relList.supports && relList.supports("modulepreload")) {
    return;
  }
  for (const link of document.querySelectorAll('link[rel="modulepreload"]')) {
    processPreload(link);
  }
  new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type !== "childList") {
        continue;
      }
      for (const node of mutation.addedNodes) {
        if (node.tagName === "LINK" && node.rel === "modulepreload")
          processPreload(node);
      }
    }
  }).observe(document, { childList: true, subtree: true });
  function getFetchOpts(link) {
    const fetchOpts = {};
    if (link.integrity) fetchOpts.integrity = link.integrity;
    if (link.referrerPolicy) fetchOpts.referrerPolicy = link.referrerPolicy;
    if (link.crossOrigin === "use-credentials")
      fetchOpts.credentials = "include";
    else if (link.crossOrigin === "anonymous") fetchOpts.credentials = "omit";
    else fetchOpts.credentials = "same-origin";
    return fetchOpts;
  }
  function processPreload(link) {
    if (link.ep)
      return;
    link.ep = true;
    const fetchOpts = getFetchOpts(link);
    fetch(link.href, fetchOpts);
  }
})();
let serviceWorkerMain = null;
if ("serviceWorker" in navigator) {
  window.addEventListener(
    "load",
    async () => {
      const path = "/webrtc/service-worker.js";
      serviceWorkerMain = await navigator.serviceWorker.register(path).catch((err) => {
        console.log("ServiceWorker registration failed:", err);
        return null;
      });
    }
  );
}
const scriptRel = "modulepreload";
const assetsURL = function(dep) {
  return "/webrtc/" + dep;
};
const seen = {};
const __vitePreload = function preload(baseModule, deps, importerUrl) {
  let promise = Promise.resolve();
  if (deps && deps.length > 0) {
    let allSettled2 = function(promises) {
      return Promise.all(
        promises.map(
          (p) => Promise.resolve(p).then(
            (value) => ({ status: "fulfilled", value }),
            (reason) => ({ status: "rejected", reason })
          )
        )
      );
    };
    document.getElementsByTagName("link");
    const cspNonceMeta = document.querySelector(
      "meta[property=csp-nonce]"
    );
    const cspNonce = (cspNonceMeta == null ? void 0 : cspNonceMeta.nonce) || (cspNonceMeta == null ? void 0 : cspNonceMeta.getAttribute("nonce"));
    promise = allSettled2(
      deps.map((dep) => {
        dep = assetsURL(dep);
        if (dep in seen) return;
        seen[dep] = true;
        const isCss = dep.endsWith(".css");
        const cssSelector = isCss ? '[rel="stylesheet"]' : "";
        if (document.querySelector(`link[href="${dep}"]${cssSelector}`)) {
          return;
        }
        const link = document.createElement("link");
        link.rel = isCss ? "stylesheet" : scriptRel;
        if (!isCss) {
          link.as = "script";
        }
        link.crossOrigin = "";
        link.href = dep;
        if (cspNonce) {
          link.setAttribute("nonce", cspNonce);
        }
        document.head.appendChild(link);
        if (isCss) {
          return new Promise((res, rej) => {
            link.addEventListener("load", res);
            link.addEventListener(
              "error",
              () => rej(new Error(`Unable to preload CSS for ${dep}`))
            );
          });
        }
      })
    );
  }
  function handlePreloadError(err) {
    const e = new Event("vite:preloadError", {
      cancelable: true
    });
    e.payload = err;
    window.dispatchEvent(e);
    if (!e.defaultPrevented) {
      throw err;
    }
  }
  return promise.then((res) => {
    for (const item of res || []) {
      if (item.status !== "rejected") continue;
      handlePreloadError(item.reason);
    }
    return baseModule().catch(handlePreloadError);
  });
};
function createScaledrone(roomName, onOpen, onMessage) {
  const userInfo2 = JSON.parse(window.localStorage.getItem("userInfo") || "{}");
  const CHANNEL_ID = "EoIG3R1I4JdyS4L1";
  const ref = { drone: null, room: null };
  let drone2 = null;
  let room2 = null;
  let reconnectAttempts = 0;
  const maxReconnectDelayMs = 15e3;
  function connect() {
    drone2 = new window.ScaleDrone(CHANNEL_ID, {
      data: { userInfo: userInfo2 }
    });
    room2 = drone2.subscribe(roomName);
    ref.drone = drone2;
    ref.room = room2;
    drone2.on("open", (err) => {
      reconnectAttempts = 0;
      onOpen && onOpen(err);
    });
    room2.on("message", (msg) => onMessage && onMessage(msg));
    drone2.on("error", (err) => {
      console.error("Scaledrone error:", err);
    });
    drone2.on("close", () => {
      scheduleReconnect();
    });
    room2.on("error", (err) => {
      console.error("Room error:", err);
    });
  }
  function scheduleReconnect() {
    if (!navigator.onLine) {
      window.addEventListener("online", handleOnlineOnce, { once: true });
      return;
    }
    const delay = Math.min(1e3 * Math.pow(2, reconnectAttempts++), maxReconnectDelayMs);
    setTimeout(() => {
      try {
        connect();
      } catch (e) {
        console.error("Reconnect attempt failed:", e);
        scheduleReconnect();
      }
    }, delay);
  }
  function handleOnlineOnce() {
    scheduleReconnect();
  }
  connect();
  return ref;
}
function showToast(type, message) {
  try {
    let toastContainer = document.getElementById("toastContainer");
    if (!toastContainer) {
      toastContainer = document.createElement("div");
      toastContainer.id = "toastContainer";
      document.body.appendChild(toastContainer);
    }
    const normalizedType = String(type || "info").toLowerCase();
    const text = typeof message === "string" ? message : JSON.stringify(message);
    const toast = document.createElement("div");
    toast.classList.add("toast");
    if (["info", "warn", "warning", "error", "success"].includes(normalizedType)) {
      toast.classList.add(normalizedType === "warning" ? "warn" : normalizedType);
    } else {
      toast.classList.add("info");
    }
    toast.textContent = text;
    toastContainer.innerHTML = "";
    toastContainer.appendChild(toast);
    setTimeout(() => {
      try {
        toast.remove();
      } catch {
      }
    }, 3e3);
  } catch (e) {
    console.error("showToast failed:", e);
  }
}
let chatMessages = [];
let chatPanel = null;
let chatToggle = null;
let chatEditor = null;
let fileInput = null;
let replyContext = null;
let currentReplyTo = null;
let emojiMenu = null;
function initializeChat() {
  createChatUI();
  setupChatEventListeners();
  loadChatHistory();
}
function createChatUI() {
  var _a2;
  chatToggle = document.createElement("button");
  chatToggle.id = "chatToggle";
  chatToggle.innerHTML = "💬 Chat";
  chatToggle.title = "Toggle Chat";
  const switchCamera2 = document.getElementById("switchCamera");
  (_a2 = switchCamera2 == null ? void 0 : switchCamera2.parentNode) == null ? void 0 : _a2.insertBefore(chatToggle, switchCamera2.nextSibling);
  chatPanel = document.createElement("div");
  chatPanel.className = "chat-panel";
  chatPanel.innerHTML = `
    <div class="chat-header">
      <span>Chat</span>
      <button id="closeChat" style="background: none; border: none; color: var(--text-primary); font-size: 1.2rem; cursor: pointer;">×</button>
    </div>
    <div class="chat-messages" id="chatMessages">
      <div class="chat-message">
        <div class="sender">System</div>
        <div>Welcome to the chat! Type a message below.</div>
        <div class="time">${(/* @__PURE__ */ new Date()).toLocaleTimeString()}</div>
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
  chatEditor = chatPanel.querySelector("#chatEditor");
  fileInput = chatPanel.querySelector("#fileInput");
  replyContext = chatPanel.querySelector("#replyContext");
  emojiMenu = chatPanel.querySelector("#emojiMenu");
}
function setupChatEventListeners() {
  var _a2, _b2, _c2, _d2, _e;
  chatToggle == null ? void 0 : chatToggle.addEventListener("click", () => {
    chatPanel == null ? void 0 : chatPanel.classList.toggle("active");
    if (chatPanel == null ? void 0 : chatPanel.classList.contains("active")) {
      chatEditor == null ? void 0 : chatEditor.focus();
    }
  });
  (_a2 = document.getElementById("closeChat")) == null ? void 0 : _a2.addEventListener("click", () => {
    chatPanel == null ? void 0 : chatPanel.classList.remove("active");
  });
  const sendButton = document.getElementById("sendMessage");
  sendButton == null ? void 0 : sendButton.addEventListener("click", sendMessage);
  chatEditor == null ? void 0 : chatEditor.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      if (!e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    }
  });
  const chatMessagesContainer = document.getElementById("chatMessages");
  chatMessagesContainer == null ? void 0 : chatMessagesContainer.addEventListener("DOMNodeInserted", () => {
    if (chatMessagesContainer) {
      chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
    }
  });
  (_b2 = document.getElementById("btnBold")) == null ? void 0 : _b2.addEventListener("click", () => execCmd("bold"));
  (_c2 = document.getElementById("btnItalic")) == null ? void 0 : _c2.addEventListener("click", () => execCmd("italic"));
  (_d2 = document.getElementById("btnAttach")) == null ? void 0 : _d2.addEventListener("click", () => fileInput == null ? void 0 : fileInput.click());
  (_e = document.getElementById("btnEmoji")) == null ? void 0 : _e.addEventListener("click", toggleEmojiMenu);
  fileInput == null ? void 0 : fileInput.addEventListener("change", handleFileSelection);
}
async function sendMessage() {
  const rawHtml = ((chatEditor == null ? void 0 : chatEditor.innerHTML) || "").trim();
  const hasText = stripHtml(rawHtml).trim().length > 0;
  let attachments = await collectPendingAttachments();
  attachments = await maybeCompressAttachments(attachments);
  if (!hasText && attachments.length === 0) return;
  const userInfo2 = JSON.parse(localStorage.getItem("userInfo") || "{}");
  const senderName = userInfo2.nickname || "Anonymous";
  const sanitizedHtml = sanitizeHtml(rawHtml);
  const messageData = {
    id: Date.now(),
    type: "message",
    sender: senderName,
    senderId: userInfo2.id || "unknown",
    html: sanitizedHtml,
    text: stripHtml(sanitizedHtml).slice(0, 1e3),
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    replyTo: currentReplyTo || null,
    attachments,
    reactions: {}
  };
  const estimatedSize = estimateSize({ type: "chat", messageData });
  if (estimatedSize > 9500) {
    showToast("Warning", "Message too large to send. Reduce attachments or text.");
    return;
  }
  addMessageToChat(messageData, true);
  sendChatMessage(messageData);
  persistChatMessage(messageData);
  clearComposer();
}
function addMessageToChat(messageData, isOwn = false) {
  const chatMessagesContainer = document.getElementById("chatMessages");
  const messageElement = document.createElement("div");
  messageElement.className = `chat-message ${isOwn ? "own" : ""}`;
  messageElement.setAttribute("data-id", messageData.id.toString());
  const time = new Date(messageData.timestamp).toLocaleTimeString();
  let replyHtml = "";
  if (messageData.replyTo) {
    const replied = chatMessages.find((m) => m.id === messageData.replyTo);
    if (replied) {
      const replyText = (replied.text || "").slice(0, 120);
      replyHtml = `<div style="font-size:0.75rem; opacity:0.8; border-left:2px solid var(--border-primary); padding-left:6px; margin-bottom:4px;">Replying to <b>${escapeHtml$3(replied.sender)}</b>: ${escapeHtml$3(replyText)}</div>`;
    }
  }
  const attachmentsHtml = (messageData.attachments || []).map((att) => renderAttachment(att)).join("");
  const reactionsBar = `<div class="reactions" style="margin-top:6px; display:flex; gap:6px; align-items:center;">
      <button class="reactBtn" data-emoji="👍" title="Like" style="flex:unset; padding:2px 6px;">👍</button>
      <button class="reactBtn" data-emoji="❤️" title="Love" style="flex:unset; padding:2px 6px;">❤️</button>
      <button class="reactBtn" data-emoji="😂" title="Haha" style="flex:unset; padding:2px 6px;">😂</button>
      <button class="replyBtn" title="Reply" style="flex:unset; padding:2px 6px;">↩︎ Reply</button>
      <span class="reactionsDisplay" style="margin-left:auto; font-size:0.9rem;"></span>
    </div>`;
  const contentHtml = messageData.type === "message" ? `<div class="sender">${escapeHtml$3(messageData.sender)}</div>
       ${replyHtml}
       <div class="content">${messageData.html || escapeHtml$3(messageData.text || "")}</div>
       ${attachmentsHtml}
       <div class="time">${time}</div>
       ${reactionsBar}` : "";
  if (contentHtml) messageElement.innerHTML = contentHtml;
  chatMessagesContainer == null ? void 0 : chatMessagesContainer.appendChild(messageElement);
  if (chatMessagesContainer) {
    chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
  }
  chatMessages.push(messageData);
  if (chatMessages.length > 100) {
    chatMessages = chatMessages.slice(-100);
  }
  wireMessageActions(messageElement, messageData);
}
function sendChatMessage(messageData) {
  __vitePreload(async () => {
    const { drone: drone2 } = await Promise.resolve().then(() => room$1);
    return { drone: drone2 };
  }, true ? void 0 : void 0).then(({ drone: drone2 }) => {
    if (drone2 && drone2.rooms) {
      const roomName = Object.keys(drone2.rooms)[0];
      if (roomName && typeof drone2.publish === "function") {
        drone2.publish({
          room: roomName,
          message: {
            type: "chat",
            messageData,
            userInfo: JSON.parse(localStorage.getItem("userInfo") || "{}")
          }
        });
        console.log("Chat message sent:", messageData);
      }
    }
  }).catch((err) => {
    console.error("Failed to send chat message:", err);
    showToast("Error", "Failed to send message");
  });
}
function receiveChatMessage(messageData) {
  if (messageData.type === "reaction") {
    applyIncomingReaction(messageData);
    return;
  }
  addMessageToChat(messageData, false);
  persistChatMessage(messageData);
}
function sendDirectMessage(toMemberId, message) {
  const userInfo2 = JSON.parse(localStorage.getItem("userInfo") || "{}");
  const messageData = {
    id: Date.now(),
    sender: userInfo2.nickname || "Anonymous",
    senderId: userInfo2.id || "unknown",
    text: message,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    type: "message"
  };
  addMessageToChat({ ...messageData, sender: `${messageData.sender} → DM` }, true);
  __vitePreload(async () => {
    const { drone: drone2 } = await Promise.resolve().then(() => room$1);
    return { drone: drone2 };
  }, true ? void 0 : void 0).then(({ drone: drone2 }) => {
    if (drone2 && drone2.rooms) {
      const roomName = Object.keys(drone2.rooms)[0];
      if (roomName) {
        drone2.publish({
          room: roomName,
          message: {
            type: "dm",
            to: toMemberId,
            messageData,
            fromUserInfo: userInfo2
          }
        });
      }
    }
  }).catch(() => {
  });
}
function escapeHtml$3(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
function execCmd(cmd) {
  chatEditor == null ? void 0 : chatEditor.focus();
  document.execCommand(cmd, false, void 0);
}
function toggleEmojiMenu(e) {
  var _a2, _b2;
  if (!emojiMenu) return;
  if (emojiMenu.style.display === "none" || !emojiMenu.style.display) {
    emojiMenu.style.display = "grid";
    emojiMenu.style.gridTemplateColumns = "repeat(6, 1fr)";
    emojiMenu.innerHTML = ["😀", "😂", "😍", "👍", "🙏", "🎉", "🔥", "😮", "😢", "😆", "😎", "❤️"].map((em) => `<button class="emojiPick" style="padding:4px; background:none; border:none; font-size:20px;">${em}</button>`).join("");
    const rect = (_b2 = (_a2 = e == null ? void 0 : e.target) == null ? void 0 : _a2.getBoundingClientRect) == null ? void 0 : _b2.call(_a2);
    if (rect) {
      emojiMenu.style.top = `${rect.bottom + window.scrollY + 6}px`;
      emojiMenu.style.left = `${rect.left + window.scrollX}px`;
    }
    emojiMenu.querySelectorAll(".emojiPick").forEach((btn) => {
      btn.addEventListener("click", () => {
        insertAtCursor(btn.textContent || "");
        emojiMenu.style.display = "none";
        chatEditor == null ? void 0 : chatEditor.focus();
      });
    });
  } else {
    emojiMenu.style.display = "none";
  }
}
function insertAtCursor(text) {
  chatEditor == null ? void 0 : chatEditor.focus();
  document.execCommand("insertText", false, text);
}
function stripHtml(html) {
  const tmp = document.createElement("div");
  tmp.innerHTML = html || "";
  return tmp.textContent || tmp.innerText || "";
}
function sanitizeHtml(html) {
  if (!html) return "";
  const allowed = /* @__PURE__ */ new Set(["B", "STRONG", "I", "EM", "BR", "SPAN", "A"]);
  const container = document.createElement("div");
  container.innerHTML = html;
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_ELEMENT, null);
  const toRemove = [];
  while (walker.nextNode()) {
    const el = walker.currentNode;
    if (!allowed.has(el.nodeName)) {
      toRemove.push(el);
      continue;
    }
    [...el.attributes].forEach((attr) => {
      const name = attr.name.toLowerCase();
      if (name.startsWith("on") || name === "style") el.removeAttribute(attr.name);
    });
    if (el.nodeName === "A") {
      const href = el.getAttribute("href") || "";
      if (!/^https?:\/\//i.test(href)) el.removeAttribute("href");
      el.setAttribute("target", "_blank");
      el.setAttribute("rel", "noopener noreferrer");
    }
  }
  toRemove.forEach((n) => n.replaceWith(document.createTextNode(n.textContent || "")));
  return container.innerHTML;
}
function estimateSize(obj) {
  try {
    return JSON.stringify(obj).length;
  } catch {
    return 0;
  }
}
let pendingFiles = [];
function handleFileSelection(e) {
  const target = e.target;
  const files = Array.from(target.files || []);
  const maxSize = 5 * 1024 * 1024;
  files.forEach((file) => {
    if (file.size > maxSize) {
      showToast("Warning", `${file.name} is too large (max 5MB)`);
      return;
    }
    pendingFiles.push(file);
  });
  if (pendingFiles.length && replyContext) {
    replyContext.style.display = "";
    replyContext.textContent = `${pendingFiles.length} attachment(s) selected`;
  }
}
function collectPendingAttachments() {
  if (!pendingFiles.length) return Promise.resolve([]);
  const tasks = pendingFiles.map((file) => new Promise((resolve) => {
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
  return Promise.all(tasks).then((arr) => arr.filter(Boolean));
}
async function maybeCompressAttachments(attList) {
  const result = [];
  for (const att of attList) {
    if ((att.type || "").startsWith("image/") && typeof att.dataUrl === "string") {
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
function compressImageDataUrl(dataUrl, maxW = 900, maxH = 900, quality2 = 0.7) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      const ratio = Math.min(1, maxW / width, maxH / height);
      const cw = Math.max(1, Math.floor(width * ratio));
      const ch = Math.max(1, Math.floor(height * ratio));
      const canvas = document.createElement("canvas");
      canvas.width = cw;
      canvas.height = ch;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0, cw, ch);
        try {
          const out = canvas.toDataURL("image/jpeg", quality2);
          resolve(out);
        } catch (e) {
          resolve(dataUrl);
        }
      } else {
        resolve(dataUrl);
      }
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}
function renderAttachment(att) {
  const safeName = escapeHtml$3(att.name || "file");
  if ((att.type || "").startsWith("image/")) {
    return `<div style="margin-top:6px;"><img src="${att.dataUrl}" alt="${safeName}" style="max-width:200px; border-radius:6px;" /></div>`;
  }
  return `<div style="margin-top:6px;"><a href="${att.dataUrl}" download="${safeName}">📎 ${safeName}</a></div>`;
}
function clearComposer() {
  if (chatEditor) chatEditor.innerHTML = "";
  pendingFiles = [];
  currentReplyTo = null;
  if (replyContext) {
    replyContext.style.display = "none";
    replyContext.textContent = "";
  }
  if (fileInput) fileInput.value = "";
}
function wireMessageActions(messageElement, messageData) {
  const replyBtn = messageElement.querySelector(".replyBtn");
  const reactBtns = messageElement.querySelectorAll(".reactBtn");
  if (replyBtn) {
    replyBtn.addEventListener("click", () => {
      currentReplyTo = messageData.id;
      if (replyContext) {
        replyContext.style.display = "";
        replyContext.textContent = `Replying to ${messageData.sender}: ${(messageData.text || "").slice(0, 80)}`;
      }
      chatEditor == null ? void 0 : chatEditor.focus();
    });
  }
  reactBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const emoji = btn.getAttribute("data-emoji");
      if (emoji) addReaction(messageData.id, emoji);
    });
  });
  updateReactionsDisplay(messageElement, messageData.reactions || {});
}
function addReaction(messageId, emoji) {
  const user = JSON.parse(localStorage.getItem("userInfo") || "{}");
  const payload = {
    id: Date.now(),
    type: "reaction",
    messageId,
    emoji,
    userId: user.id,
    userName: user.nickname,
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  };
  applyIncomingReaction(payload);
  sendChatMessage(payload);
}
function applyIncomingReaction(payload) {
  const idx = chatMessages.findIndex((m) => m.id === payload.messageId);
  if (idx === -1) return;
  const msg = chatMessages[idx];
  if (!msg.reactions) msg.reactions = {};
  const key = payload.emoji;
  if (!msg.reactions[key]) msg.reactions[key] = /* @__PURE__ */ new Set();
  if (Array.isArray(msg.reactions[key])) msg.reactions[key] = new Set(msg.reactions[key]);
  msg.reactions[key].add(payload.userId || "unknown");
  const el = document.querySelector(`.chat-message[data-id="${msg.id}"]`);
  if (el) updateReactionsDisplay(el, msg.reactions);
  persistReplaceMessage(msg);
}
function updateReactionsDisplay(messageElement, reactions) {
  const disp = messageElement.querySelector(".reactionsDisplay");
  if (!disp) return;
  const parts = [];
  Object.keys(reactions || {}).forEach((k) => {
    const v = reactions[k];
    const count = v instanceof Set ? v.size : Array.isArray(v) ? v.length : 0;
    if (count > 0) parts.push(`${k} ${count}`);
  });
  disp.textContent = parts.join("  ");
}
function getRoomKey() {
  const room2 = localStorage.getItem("roomName") || "observable-e7b2d4";
  return `chat_history_${room2}`;
}
function loadChatHistory() {
  try {
    const raw = localStorage.getItem(getRoomKey());
    if (!raw) return;
    const arr = JSON.parse(raw);
    (arr || []).forEach((msg) => {
      if (msg.reactions) {
        Object.keys(msg.reactions).forEach((k) => {
          if (Array.isArray(msg.reactions[k])) msg.reactions[k] = new Set(msg.reactions[k]);
        });
      }
      addMessageToChat(msg, msg.senderId === JSON.parse(localStorage.getItem("userInfo") || "{}").id);
    });
  } catch {
  }
}
function persistChatMessage(message) {
  try {
    const raw = localStorage.getItem(getRoomKey());
    const arr = raw ? JSON.parse(raw) : [];
    arr.push(serializeMessage(message));
    localStorage.setItem(getRoomKey(), JSON.stringify(arr.slice(-200)));
  } catch {
  }
}
function persistReplaceMessage(message) {
  try {
    const raw = localStorage.getItem(getRoomKey());
    const arr = raw ? JSON.parse(raw) : [];
    const idx = arr.findIndex((m) => m.id === message.id);
    if (idx !== -1) arr[idx] = serializeMessage(message);
    localStorage.setItem(getRoomKey(), JSON.stringify(arr));
  } catch {
  }
}
function serializeMessage(message) {
  const clone = JSON.parse(JSON.stringify(message));
  if (clone.reactions) {
    Object.keys(clone.reactions).forEach((k) => {
      if (clone.reactions[k] instanceof Set) clone.reactions[k] = Array.from(clone.reactions[k]);
    });
  }
  return clone;
}
const membersList = [];
const memberSubscribers = /* @__PURE__ */ new Set();
const userInfo$2 = JSON.parse(window.localStorage.getItem("userInfo") || "{}");
const peerConnections = {};
const candidateQueues = {};
let localStream$1 = null;
let pcInfo = null;
let drone = null;
let room = null;
let signallingRef = null;
const connectionStatus = {
  onChange: null,
  // function(status: 'connected'|'reconnecting'|'disconnected')
  set(status) {
    if (typeof this.onChange === "function") this.onChange(status);
  }
};
const iceServers = [
  { urls: ["stun:stun.l.google.com:19302"] },
  {
    urls: ["turn:122.166.150.147:5060?transport=tcp"],
    "username": "test",
    "credential": "pa55w0rd!"
  }
];
const configuration = { iceServers };
function setupRoom(localStreamRef, onRemoteTrack) {
  localStream$1 = localStreamRef;
  const ROOM_NAME = localStorage.getItem("roomName") || "observable-e7b2d4";
  signallingRef = createScaledrone(ROOM_NAME, handleOpen, handleMessage);
  drone = signallingRef.drone;
  room = signallingRef.room;
  window.addEventListener("online", () => {
    showToast("Info", "Network connected. Attempting to reconnect...");
    connectionStatus.set("reconnecting");
    attemptReconnect(onRemoteTrack);
  });
  window.addEventListener("offline", () => {
    showToast("Error", "Network disconnected. Trying to recover...");
    connectionStatus.set("disconnected");
  });
  function handleOpen(error) {
    if (error) return console.error(error);
    drone = signallingRef.drone;
    room = signallingRef.room;
    bindRoomEvents(onRemoteTrack);
    attemptReconnect(onRemoteTrack);
    connectionStatus.set("connected");
    console.log("Connected to Scaledrone");
  }
  function enqueueOrAddCandidate(id, candidate) {
    if (!candidateQueues[id]) candidateQueues[id] = [];
    const pc = peerConnections[id];
    if (pc && pc.remoteDescription && pc.remoteDescription.type) {
      try {
        pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.warn("addIceCandidate failed, queueing:", e);
        candidateQueues[id].push(candidate);
      }
    } else {
      candidateQueues[id].push(candidate);
    }
  }
  async function drainCandidateQueue(id) {
    const pc = peerConnections[id];
    if (!pc || !pc.remoteDescription || !candidateQueues[id] || candidateQueues[id].length === 0) return;
    const queue = candidateQueues[id];
    while (queue.length) {
      const cand = queue.shift();
      try {
        await pc.addIceCandidate(new RTCIceCandidate(cand));
      } catch (e) {
        console.warn("Failed to add queued ICE candidate:", e);
      }
    }
  }
  function handleMessage(message) {
    var _a2, _b2, _c2, _d2, _e, _f, _g, _h, _i;
    const { data } = message || {};
    const member = (message == null ? void 0 : message.member) || {};
    const senderId = (_a2 = message == null ? void 0 : message.member) == null ? void 0 : _a2.id;
    console.log({ data });
    if (!data) return;
    if (!drone) return;
    if (!senderId || senderId === drone.clientId) return;
    switch (data.type) {
      case "offer":
        createPeerConnection(senderId, false, onRemoteTrack);
        peerConnections[senderId].setRemoteDescription(new RTCSessionDescription(data.offer)).then(async () => {
          const answer = await peerConnections[senderId].createAnswer();
          await peerConnections[senderId].setLocalDescription(answer);
          drone.publish({ room: ROOM_NAME, message: { type: "answer", answer, to: senderId, userInfo: userInfo$2 } });
          await drainCandidateQueue(senderId);
        });
        break;
      case "answer":
        if (data.to === drone.clientId && peerConnections[senderId]) {
          peerConnections[senderId].setRemoteDescription(new RTCSessionDescription(data.answer)).then(async () => {
            await drainCandidateQueue(senderId);
          });
        }
        break;
      case "candidate":
        if (data.to === drone.clientId) {
          enqueueOrAddCandidate(senderId, data.candidate);
        }
        break;
      case "leave":
        console.log(senderId, "has left the room");
        const index = membersList.findIndex((memberObj) => member.id === memberObj.id);
        const videoEl = document.getElementById(senderId);
        if (videoEl) {
          (_b2 = videoEl.parentElement) == null ? void 0 : _b2.remove();
          if (index > -1)
            showToast("Info", ((_e = (_d2 = (_c2 = membersList[index]) == null ? void 0 : _c2.clientData) == null ? void 0 : _d2.userInfo) == null ? void 0 : _e.nickname) + " has left the room!");
        }
        membersList.splice(index, 1);
        if (peerConnections[senderId]) {
          peerConnections[senderId].close();
          delete peerConnections[senderId];
        }
        delete candidateQueues[senderId];
        __vitePreload(async () => {
          const { removeRemoteAudioContext: removeRemoteAudioContext2 } = await Promise.resolve().then(() => media);
          return { removeRemoteAudioContext: removeRemoteAudioContext2 };
        }, true ? void 0 : void 0).then(({ removeRemoteAudioContext: removeRemoteAudioContext2 }) => removeRemoteAudioContext2(senderId)).catch(() => {
        });
        if (document.querySelector(".Channel").childElementCount === 1)
          (_g = (_f = document.querySelector(".Channel")) == null ? void 0 : _f.children[0]) == null ? void 0 : _g.querySelector("video").click();
        break;
      case "join":
        if (!membersList.find((m) => m.id === member.id))
          membersList.push(member);
        console.log(senderId, "has joined the room");
        createPeerConnection(senderId, true, onRemoteTrack);
        break;
      case "screenShare":
        {
          const videoEl2 = document.getElementById(senderId);
          if (videoEl2)
            data.isShared === true ? videoEl2.setAttribute("screenShare", "true") : videoEl2.removeAttribute("screenShare");
        }
        break;
      case "chat":
        if (data.messageData) {
          receiveChatMessage(data.messageData);
        }
        break;
      case "dm":
        try {
          if (data.to === drone.clientId && data.messageData) {
            __vitePreload(async () => {
              const { receiveDirectMessage: receiveDirectMessage2 } = await Promise.resolve().then(() => users);
              return { receiveDirectMessage: receiveDirectMessage2 };
            }, true ? void 0 : void 0).then(({ receiveDirectMessage: receiveDirectMessage2 }) => {
              if (typeof receiveDirectMessage2 === "function") {
                receiveDirectMessage2(data.messageData, data.fromUserInfo);
              }
            }).catch(() => {
            });
          }
        } catch {
        }
        break;
      case "invite":
        try {
          if (data.to === drone.clientId && data.roomName) {
            const inviter = ((_i = (_h = membersList.find((m) => m.id === senderId)) == null ? void 0 : _h.clientData) == null ? void 0 : _i.userInfo.nickname) || "Someone";
            const join = confirm(`${inviter} invited you to join room "${data.roomName}". Join now?`);
            if (join) {
              localStorage.setItem("roomName", data.roomName);
              showToast("Info", `Joining room ${data.roomName}...`);
              setTimeout(() => location.reload(), 300);
            }
          }
        } catch {
        }
        break;
      default:
        console.warn("Unknown data type:", data.type);
        showToast("Warning", "Unknown data type: " + data.type);
    }
  }
  function bindRoomEvents(onRemoteTrackCb) {
    if (!room) return;
    room.on("members", (members) => {
      console.log("Members connected:", members);
      members.forEach((member) => {
        if (member.id !== drone.clientId) {
          if (!membersList.find((m) => m.id === member.id)) membersList.push(member);
          if (!peerConnections[member.id]) {
            createPeerConnection(member.id, true, onRemoteTrackCb);
          }
        }
      });
      notifyMemberSubscribers();
    });
    room.on("member_join", (member) => {
      var _a2;
      if (!membersList.find((m) => m.id === member.id)) membersList.push(member);
      console.log("Member joined:", (_a2 = member.clientData) == null ? void 0 : _a2.userInfo.nickname);
      if (!peerConnections[member.id]) {
        createPeerConnection(member.id, false, onRemoteTrackCb);
      }
      notifyMemberSubscribers();
    });
    room.on("member_leave", (memberObj) => {
      var _a2, _b2, _c2, _d2;
      const index = membersList.findIndex((member) => member.id === memberObj.id);
      console.log("Member left:", (_c2 = (_b2 = (_a2 = membersList[index]) == null ? void 0 : _a2.clientData) == null ? void 0 : _b2.userInfo) == null ? void 0 : _c2.nickname);
      const videoEl = document.getElementById(memberObj.id);
      if (videoEl) {
        (_d2 = videoEl.parentElement) == null ? void 0 : _d2.remove();
        if (index > -1)
          showToast("Info", membersList[index].clientData.userInfo.nickname + " has left the room!");
      }
      membersList.splice(index, 1);
      if (peerConnections[memberObj.id]) {
        peerConnections[memberObj.id].close();
        delete peerConnections[memberObj.id];
      }
      delete candidateQueues[memberObj.id];
      __vitePreload(async () => {
        const { removeRemoteAudioContext: removeRemoteAudioContext2 } = await Promise.resolve().then(() => media);
        return { removeRemoteAudioContext: removeRemoteAudioContext2 };
      }, true ? void 0 : void 0).then(({ removeRemoteAudioContext: removeRemoteAudioContext2 }) => removeRemoteAudioContext2(memberObj.id)).catch(() => {
      });
      notifyMemberSubscribers();
    });
  }
  async function createPeerConnection(id, isInitiator, onRemoteTrack2) {
    if (peerConnections[id] && peerConnections[id].connectionState && peerConnections[id].connectionState !== "closed") {
      return;
    }
    const pc = pcInfo = new RTCPeerConnection(configuration);
    if (localStream$1)
      localStream$1.getTracks().forEach((track) => pc.addTrack(track, localStream$1));
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        drone.publish({
          room: ROOM_NAME,
          message: { type: "candidate", candidate: event.candidate, to: id, userInfo: userInfo$2 }
        });
      }
    };
    pc.oniceconnectionstatechange = async () => {
      if (pc.iceConnectionState === "failed") {
        connectionStatus.set("reconnecting");
        showToast("Error", "Connection failed. Attempting ICE restart...");
        await attemptIceRestart(pc, id, ROOM_NAME);
      } else if (pc.iceConnectionState === "disconnected") {
        connectionStatus.set("reconnecting");
        showToast("Error", "Connection disconnected. Retrying...");
        await attemptIceRestart(pc, id, ROOM_NAME);
      } else if (pc.iceConnectionState === "closed") {
        const el = document.getElementById(id);
        if (el) el.remove();
        __vitePreload(async () => {
          const { removeRemoteAudioContext: removeRemoteAudioContext2 } = await Promise.resolve().then(() => media);
          return { removeRemoteAudioContext: removeRemoteAudioContext2 };
        }, true ? void 0 : void 0).then(({ removeRemoteAudioContext: removeRemoteAudioContext2 }) => removeRemoteAudioContext2(id)).catch(() => {
        });
        showToast("Info", "User has left the room!");
      }
    };
    pc.onconnectionstatechange = async () => {
      if (pc.connectionState === "connected") {
        connectionStatus.set("connected");
      }
      if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
        connectionStatus.set("reconnecting");
        await attemptIceRestart(pc, id, ROOM_NAME);
      }
    };
    pc.onnegotiationneeded = () => {
    };
    pc.onsignalingstatechange = () => {
    };
    pc.ontrack = (event) => {
      var _a2, _b2, _c2, _d2;
      console.log("Track received:", event.track.kind);
      console.log({ stream: event.streams[0], id, name: ((_a2 = membersList.find((member) => member.id === id)) == null ? void 0 : _a2.clientData.userInfo.nickname) || "" });
      onRemoteTrack2(event.streams[0], id, ((_b2 = membersList.find((member) => member.id === id)) == null ? void 0 : _b2.clientData.userInfo.nickname) || "");
      const index = membersList.findIndex((member) => member.id === id);
      if (index > -1)
        showToast("Info", ((_d2 = (_c2 = membersList[index].clientData) == null ? void 0 : _c2.userInfo) == null ? void 0 : _d2.nickname) + " has joined the room!");
    };
    if (isInitiator) {
      const offer = await createOfferWithPreferredCodec(pc);
      if (offer) {
        drone.publish({ room: ROOM_NAME, message: { type: "offer", offer, to: id, userInfo: userInfo$2 } });
      }
    }
    peerConnections[id] = pc;
  }
  async function attemptIceRestart(pc, id, roomName) {
    try {
      const offer = await pc.createOffer({ iceRestart: true });
      await pc.setLocalDescription(offer);
      drone.publish({ room: roomName, message: { type: "offer", offer, to: id, userInfo: userInfo$2 } });
    } catch (e) {
      console.error("ICE restart failed:", e);
      showToast("Error", "ICE restart failed. Will attempt full reconnection.");
      attemptReconnect(onRemoteTrack);
    }
  }
  function attemptReconnect(onRemoteTrackCb) {
    try {
      Object.keys(peerConnections).forEach((peerId) => {
        try {
          if (peerConnections[peerId]) {
            peerConnections[peerId].close();
            delete peerConnections[peerId];
          }
        } catch {
        }
      });
      Object.keys(candidateQueues).forEach((id) => delete candidateQueues[id]);
      membersList.forEach((member) => {
        if (drone && member.id !== drone.clientId) {
          createPeerConnection(member.id, true, onRemoteTrackCb);
        }
      });
    } catch (e) {
      console.error("Reconnect attempt failed:", e);
    }
  }
}
function getPeerConnections() {
  return peerConnections;
}
function getPeerName(peerId) {
  var _a2;
  try {
    if (!peerId) return "";
    const m = membersList.find((x) => (x == null ? void 0 : x.id) === peerId);
    return ((_a2 = m == null ? void 0 : m.clientData) == null ? void 0 : _a2.userInfo.nickname) || "";
  } catch {
    return "";
  }
}
function notifyMemberSubscribers() {
  try {
    memberSubscribers.forEach((cb) => {
      try {
        cb(getMembers());
      } catch {
      }
    });
    try {
      const roomName = localStorage.getItem("roomName") || "observable-e7b2d4";
      const snapshot = getMembers().map((m) => {
        var _a2;
        return { id: m.id, nickname: ((_a2 = m.clientData) == null ? void 0 : _a2.userInfo.nickname) || "" };
      });
      localStorage.setItem(`rooms_members_${roomName}`, JSON.stringify(snapshot));
    } catch {
    }
  } catch {
  }
}
function subscribeMembers(callback) {
  if (typeof callback === "function") {
    memberSubscribers.add(callback);
    try {
      callback(getMembers());
    } catch {
    }
    return () => memberSubscribers.delete(callback);
  }
  return () => {
  };
}
function getMembers() {
  return membersList.filter((m) => !!m && m.id !== (drone == null ? void 0 : drone.clientId)).map((m) => ({
    id: m.id,
    clientData: m.clientData || {}
  }));
}
function manualReconnect() {
  const localVideo = document.getElementById("localVideo");
  const hasLocalStream = !!localVideo;
  if (hasLocalStream) {
    if (typeof window !== "undefined") {
      const evt = new Event("online");
      window.dispatchEvent(evt);
    }
  } else {
    showToast("Warning", "Start the call first to reconnect.");
  }
}
function destroyConnections() {
  try {
    Object.keys(peerConnections).forEach((peerId) => {
      try {
        if (peerConnections[peerId]) {
          peerConnections[peerId].close();
          delete peerConnections[peerId];
        }
      } catch {
      }
      __vitePreload(async () => {
        const { removeRemoteAudioContext: removeRemoteAudioContext2 } = await Promise.resolve().then(() => media);
        return { removeRemoteAudioContext: removeRemoteAudioContext2 };
      }, true ? void 0 : void 0).then(({ removeRemoteAudioContext: removeRemoteAudioContext2 }) => removeRemoteAudioContext2(peerId)).catch(() => {
      });
    });
    Object.keys(candidateQueues).forEach((id) => delete candidateQueues[id]);
    try {
      membersList.splice(0, membersList.length);
    } catch {
    }
    pcInfo = null;
    try {
      if (drone && typeof drone.close === "function") drone.close();
    } catch {
    }
    drone = null;
    room = null;
  } catch {
  }
}
const room$1 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  connectionStatus,
  destroyConnections,
  get drone() {
    return drone;
  },
  getMembers,
  getPeerConnections,
  getPeerName,
  manualReconnect,
  get pcInfo() {
    return pcInfo;
  },
  get room() {
    return room;
  },
  setupRoom,
  subscribeMembers
}, Symbol.toStringTag, { value: "Module" }));
const userInfo$1 = JSON.parse(window.localStorage.getItem("userInfo") || "{}");
let localwidth = 0;
let localheight = 0;
let localstream = null;
let localframeRate = 0;
let localfacingMode = "user";
let selectedVideoDeviceId = null;
let selectedAudioDeviceId = null;
function getCurrentLocalStream() {
  return localstream;
}
function setSelectedDevices({ videoDeviceId, audioDeviceId }) {
  if (typeof videoDeviceId === "string") selectedVideoDeviceId = videoDeviceId || null;
  if (typeof audioDeviceId === "string") selectedAudioDeviceId = audioDeviceId || null;
}
function getSelectedDevices() {
  return { videoDeviceId: selectedVideoDeviceId, audioDeviceId: selectedAudioDeviceId };
}
const AUDIO_OUTPUT_STORAGE_KEY = "selectedAudioOutputId";
const remoteAudioContexts = /* @__PURE__ */ new Map();
function isAudioOutputSwitchingSupported() {
  return typeof AudioContext !== "undefined" && typeof AudioContext.prototype.setSinkId === "function";
}
function getStoredAudioOutputId() {
  try {
    return localStorage.getItem(AUDIO_OUTPUT_STORAGE_KEY) || "";
  } catch {
    return "";
  }
}
async function applySinkIdToContext(ctx, deviceId) {
  if (typeof ctx.setSinkId !== "function") return;
  try {
    await ctx.setSinkId(deviceId);
  } catch (e) {
    console.warn("Failed to set audio output for a peer:", e);
  }
}
async function setAudioOutputDevice(deviceId) {
  try {
    localStorage.setItem(AUDIO_OUTPUT_STORAGE_KEY, deviceId);
  } catch {
  }
  await Promise.all(Array.from(remoteAudioContexts.values()).map((ctx) => applySinkIdToContext(ctx, deviceId)));
}
function removeRemoteAudioContext(id) {
  const ctx = remoteAudioContexts.get(id);
  if (!ctx) return;
  try {
    ctx.close();
  } catch {
  }
  remoteAudioContexts.delete(id);
}
const quality = document.querySelector("#quality");
const framerate = document.querySelector("#framerate");
const screenShare = document.querySelector("#shareScreen");
const muteVideo$1 = document.querySelector("#muteVideo");
const switchCamerabutton = document.querySelector("#switchCamera");
if (quality) {
  quality.addEventListener("click", async (event) => {
    const target = event.target;
    if (target.tagName !== "INPUT") return;
    if (!localstream) return;
    const selectedOption = quality.querySelector("input:checked");
    if (!selectedOption) return;
    const [width, height] = selectedOption.value.split("x").map(Number);
    if (!await updateStream(width, height, localframeRate)) return;
  });
}
if (framerate) {
  framerate.addEventListener("click", async (event) => {
    const target = event.target;
    if (target.tagName !== "INPUT") return;
    if (!localstream) return;
    const selectedOption = framerate.querySelector("input:checked");
    if (!selectedOption) return;
    const frameRateValue = Number(selectedOption.value);
    if (!await updateStream(localwidth, localheight, frameRateValue)) return;
  });
}
if (screenShare) {
  screenShare.addEventListener("click", async (event) => {
    const target = event.target;
    const localVideo = document.querySelector("#localVideo");
    target.setAttribute("disabled", "true");
    if (target.getAttribute("isShared") === "true") {
      target.textContent = "🖥️ Share Screen";
      target.setAttribute("isShared", "false");
      muteVideo$1 == null ? void 0 : muteVideo$1.removeAttribute("disabled");
      quality == null ? void 0 : quality.removeAttribute("disabled");
      framerate == null ? void 0 : framerate.removeAttribute("disabled");
      switchCamerabutton == null ? void 0 : switchCamerabutton.removeAttribute("disabled");
      target.removeAttribute("disabled");
      localVideo == null ? void 0 : localVideo.removeAttribute("screenShare");
      await updateStream(localwidth, localheight, localframeRate);
      if (drone) {
        const roomName = Object.keys(drone.rooms)[0];
        drone.publish({ room: roomName, message: { type: "screenShare", from: drone.clientId, isShared: false, userInfo: userInfo$1 } });
      }
      return;
    }
    if (!localstream) {
      target.removeAttribute("disabled");
      return;
    }
    try {
      const screenStream = await startScreenShare();
      if (!screenStream) return;
      target.textContent = "🖥️ Stop Sharing";
      target.setAttribute("isShared", "true");
      muteVideo$1 == null ? void 0 : muteVideo$1.setAttribute("disabled", "true");
      quality == null ? void 0 : quality.setAttribute("disabled", "true");
      framerate == null ? void 0 : framerate.setAttribute("disabled", "true");
      switchCamerabutton == null ? void 0 : switchCamerabutton.setAttribute("disabled", "true");
      localVideo == null ? void 0 : localVideo.setAttribute("screenShare", "true");
      if (localstream) {
        const existingVideo = localstream.getVideoTracks()[0];
        if (existingVideo) existingVideo.stop();
        localstream.getVideoTracks().forEach((t) => localstream.removeTrack(t));
      }
      const videoTrack = screenStream.getVideoTracks()[0];
      localstream.addTrack(videoTrack);
      await updateLocalVideoStream();
      if (drone) {
        const roomName = Object.keys(drone.rooms)[0];
        drone.publish({ room: roomName, message: { type: "screenShare", from: drone.clientId, isShared: true, userInfo: userInfo$1 } });
      }
    } catch (err) {
      console.error("Error starting screen share:", err);
      showToast("Error", "Error starting screen share");
    } finally {
      target.removeAttribute("disabled");
    }
  });
}
async function getMediaStream(width, height, frameRate, newFacing) {
  if (localstream) {
    localstream.getVideoTracks().forEach((e) => {
      localstream.removeTrack(e);
      e.stop();
    });
  }
  try {
    const videoConstraints = selectedVideoDeviceId ? { deviceId: { exact: selectedVideoDeviceId } } : {
      width: { ideal: width },
      height: { ideal: height },
      frameRate: { ideal: frameRate },
      facingMode: { ideal: newFacing }
    };
    const audioConstraints = selectedAudioDeviceId ? { deviceId: { exact: selectedAudioDeviceId } } : true;
    const constraints = {
      video: videoConstraints,
      audio: localstream ? false : audioConstraints
    };
    const newStream = await navigator.mediaDevices.getUserMedia(constraints);
    return newStream;
  } catch (error) {
    console.error("Failed to get media stream:", error);
    showToast("Error", "Failed to get media stream!");
    return null;
  }
}
async function updateStream(width, height, frameRate, isLocal = false, isToggle = false) {
  var _a2;
  localheight = height;
  localwidth = width;
  localframeRate = frameRate;
  const currentFacing = isToggle ? ((_a2 = localstream == null ? void 0 : localstream.getVideoTracks()[0]) == null ? void 0 : _a2.getSettings().facingMode) || "user" : "user";
  localfacingMode = isToggle ? currentFacing === "user" ? "environment" : "user" : localfacingMode;
  const newStream = await getMediaStream(localwidth, localheight, localframeRate, localfacingMode);
  if (!newStream) return false;
  const newVideoTrack = newStream.getVideoTracks()[0];
  const newAudioTrack = newStream.getAudioTracks()[0];
  if (localstream) {
    const oldTrack = localstream.getVideoTracks()[0];
    if (oldTrack) {
      oldTrack.stop();
      localstream.removeTrack(oldTrack);
    }
    localstream.addTrack(newVideoTrack);
    if (newAudioTrack && localstream.getAudioTracks().length === 0) {
      localstream.addTrack(newAudioTrack);
    }
  } else {
    localstream = newStream;
  }
  if (isLocal) {
    const video = document.querySelector("#localVideo");
    if (video && localstream.getVideoTracks()[0]) {
      video.setAttribute("mode", localstream.getVideoTracks()[0].getSettings().facingMode || "user");
      video.srcObject = localstream;
    }
  }
  await updateLocalVideoStream();
  await updateLocalAudioStream();
  return true;
}
function switchCamera() {
  updateStream(localwidth, localheight, localframeRate, true, true);
}
async function switchToSelectedDevices(videoDeviceId, audioDeviceId) {
  if (videoDeviceId) selectedVideoDeviceId = videoDeviceId;
  if (audioDeviceId) selectedAudioDeviceId = audioDeviceId;
  return await updateStream(localwidth, localheight, localframeRate, true, false);
}
async function getLocalStream() {
  const selectedOption = quality == null ? void 0 : quality.querySelector("input:checked");
  const [width, height] = ((selectedOption == null ? void 0 : selectedOption.value) || "640x480").split("x").map(Number);
  const framerateInput = framerate == null ? void 0 : framerate.querySelector("input:checked");
  const frameRateValue = Number((framerateInput == null ? void 0 : framerateInput.value) || 30);
  await updateStream(width, height, frameRateValue);
  return localstream;
}
function createVideoElement(stream, id, isLocal = false, name = "") {
  const div = document.createElement("div");
  div.className = "participant";
  div.setAttribute("data-id", id);
  div.innerHTML = `<video autoplay playsinline></video>
    <div class="overlay">
      <span class="name">${name}</span>
      <div class="controls">
        <button class="muteAudio">🔇</button>
        <button class="muteVideo">🎥</button>
        <button class="switchCamera">🔄</button>
        <button class="hangup">📞</button>
      </div>
    </div>
  `;
  const video = div.querySelector("video");
  video.srcObject = stream;
  video.id = id;
  video.autoplay = true;
  video.playsInline = true;
  video.setAttribute("memberId", id);
  const channel = document.getElementsByClassName("Channel")[0];
  if (!channel) return;
  if (isLocal) {
    video.muted = true;
    channel.appendChild(div);
    if (localstream == null ? void 0 : localstream.getVideoTracks()[0])
      video.setAttribute("mode", localstream.getVideoTracks()[0].getSettings().facingMode || "user");
    video.click();
  } else {
    video.setAttribute("isRemote", "true");
    channel.prepend(div);
    if (channel.childElementCount === 2) video.click();
    handleIncomingStream(stream, video, id);
  }
}
function handleIncomingStream(stream, video, id) {
  const threshold = 20;
  const audioContext = new AudioContext();
  const source = audioContext.createMediaStreamSource(stream);
  const gainNode = audioContext.createGain();
  gainNode.gain.value = 2.5;
  const analyserNode = audioContext.createAnalyser();
  analyserNode.fftSize = 256;
  const bufferLength = analyserNode.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  source.connect(analyserNode);
  source.connect(gainNode).connect(audioContext.destination);
  remoteAudioContexts.set(id, audioContext);
  const storedOutputId = getStoredAudioOutputId();
  if (storedOutputId) applySinkIdToContext(audioContext, storedOutputId);
  video.srcObject = stream;
  video.volume = 0;
  let isSpeaking = false;
  let lastActivityTime = 0;
  const activityTimeout = 500;
  const audioLevelIndicator = createAudioLevelIndicator(video);
  const monitorInterval = setInterval(() => {
    analyserNode.getByteFrequencyData(dataArray);
    let totalEnergy = 0;
    for (let i = 0; i < dataArray.length; i++) {
      totalEnergy += dataArray[i];
    }
    const averageEnergy = totalEnergy / dataArray.length;
    const currentTime = Date.now();
    updateAudioLevelIndicator(audioLevelIndicator, averageEnergy);
    if (averageEnergy > threshold) {
      lastActivityTime = currentTime;
      if (!isSpeaking) {
        isSpeaking = true;
        highlightSpeaker(true, video);
        notifySpeakingStatus(video.id, true);
      }
    } else if (currentTime - lastActivityTime > activityTimeout && isSpeaking) {
      isSpeaking = false;
      highlightSpeaker(false, video);
      notifySpeakingStatus(video.id, false);
    }
  }, 100);
  video.addEventListener("removed", () => {
    clearInterval(monitorInterval);
    audioContext.close();
  });
}
function highlightSpeaker(isSpeaking, video) {
  const participant = video.closest(".participant");
  if (!participant) return;
  if (isSpeaking) {
    participant.classList.add("speaking");
  } else {
    participant.classList.remove("speaking");
  }
}
function createAudioLevelIndicator(video) {
  const participant = video.closest(".participant");
  if (!participant) return null;
  const indicator = document.createElement("div");
  indicator.className = "audio-level-indicator";
  indicator.innerHTML = `
    <div class="audio-bars">
      <div class="bar"></div>
      <div class="bar"></div>
      <div class="bar"></div>
      <div class="bar"></div>
    </div>
  `;
  participant.appendChild(indicator);
  return indicator;
}
function updateAudioLevelIndicator(indicator, level) {
  if (!indicator) return;
  const bars = indicator.querySelectorAll(".bar");
  const normalizedLevel = Math.min(level / 50, 1);
  const activeBars = Math.ceil(normalizedLevel * bars.length);
  bars.forEach((bar, index) => {
    const barElement = bar;
    if (index < activeBars) {
      barElement.style.height = `${index * 25}%`;
      barElement.style.opacity = "1";
    } else {
      barElement.style.height = "5px";
      barElement.style.opacity = "0.3";
    }
  });
}
function notifySpeakingStatus(participantId, isSpeaking) {
  console.log(`Participant ${participantId} is ${isSpeaking ? "speaking" : "not speaking"}`);
}
async function updateLocalVideoStream() {
  const pc = pcInfo;
  if (!pc) return;
  const videoSender = pc.getSenders().find((sender) => sender.track && sender.track.kind === "video");
  if (videoSender) {
    const oldTrack = videoSender.track;
    try {
      oldTrack == null ? void 0 : oldTrack.stop();
      const newStream = localstream;
      if (!newStream) return;
      const newVideoTrack = newStream.getVideoTracks()[0];
      await videoSender.replaceTrack(newVideoTrack);
      await createOfferWithPreferredCodec(pc);
    } catch (error) {
      console.error("Error updating local video stream:", error);
      showToast("Error", "Error updating local video stream!");
      if (videoSender && oldTrack && videoSender.replaceTrack) {
        try {
          await videoSender.replaceTrack(oldTrack);
        } catch {
        }
      }
    }
  } else {
    console.log("No video sender found.");
  }
}
async function updateLocalAudioStream() {
  const pc = pcInfo;
  if (!pc) return;
  const audioSender = pc.getSenders().find((sender) => sender.track && sender.track.kind === "audio");
  const localAudio = localstream == null ? void 0 : localstream.getAudioTracks()[0];
  if (!localAudio) return;
  if (audioSender) {
    try {
      await audioSender.replaceTrack(localAudio);
    } catch (error) {
      console.error("Error updating local audio stream:", error);
    }
  } else {
    try {
      pc.addTrack(localAudio, localstream);
    } catch {
    }
  }
}
function getPreferredVideoCodec() {
  const ua = navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/.test(ua);
  const isAndroid = /Android/.test(ua);
  const isSafari = /Safari/.test(ua) && !/Chrome|CriOS|FxiOS/.test(ua);
  const isChrome = /Chrome/.test(ua) && !/Edge|Edg/.test(ua);
  const isFirefox = /Firefox/.test(ua);
  const isEdge = /Edge|Edg/.test(ua);
  if (isIOS && isSafari) {
    return "H264";
  }
  if (isIOS && (isChrome || isFirefox)) {
    return "VP8";
  }
  if (isAndroid && isChrome) {
    return "VP8";
  }
  if (isAndroid && isFirefox) {
    return "VP8";
  }
  if (isSafari && !isIOS) {
    return "H264";
  }
  if (isChrome && !isAndroid) {
    return "VP8";
  }
  if (isFirefox && !isIOS) {
    return "VP8";
  }
  if (isEdge) {
    return "VP8";
  }
  return "VP8";
}
function getSupportedCodecs() {
  const codecs = [];
  if (RTCRtpReceiver.getCapabilities && RTCRtpReceiver.getCapabilities("video")) {
    const videoCapabilities = RTCRtpReceiver.getCapabilities("video");
    if (videoCapabilities == null ? void 0 : videoCapabilities.codecs) {
      videoCapabilities.codecs.forEach((codec) => {
        if (codec.mimeType.includes("VP8")) codecs.push("VP8");
        if (codec.mimeType.includes("VP9")) codecs.push("VP9");
        if (codec.mimeType.includes("H264")) codecs.push("H264");
        if (codec.mimeType.includes("AV1")) codecs.push("AV1");
      });
    }
  }
  return [...new Set(codecs)];
}
function preferCodec(sdp, codec, kind = "video") {
  const lines = sdp.split("\r\n");
  const mLineIndex = lines.findIndex((line) => line.startsWith(`m=${kind}`));
  if (mLineIndex === -1) return sdp;
  const codecRegex = new RegExp(`a=rtpmap:(\\d+)\\s${codec}`, "i");
  const codecPayloads = lines.filter((line) => codecRegex.test(line)).map((line) => line.match(codecRegex)[1]);
  if (codecPayloads.length === 0) return sdp;
  const mLineParts = lines[mLineIndex].split(" ");
  const newPayloads = codecPayloads.concat(
    mLineParts.slice(3).filter((pt) => !codecPayloads.includes(pt))
  );
  lines[mLineIndex] = [...mLineParts.slice(0, 3), ...newPayloads].join(" ");
  return lines.join("\r\n");
}
async function createOfferWithPreferredCodec(pc) {
  try {
    const offer = await pc.createOffer();
    const supportedCodecs = getSupportedCodecs();
    const preferredCodec = getPreferredVideoCodec();
    console.log("Supported codecs:", supportedCodecs);
    console.log("Preferred codec:", preferredCodec);
    let finalOffer = offer;
    if (supportedCodecs.includes(preferredCodec)) {
      const modifiedSdp = preferCodec(offer.sdp || "", preferredCodec);
      finalOffer = { type: offer.type, sdp: modifiedSdp };
    } else {
      console.warn(`Preferred codec ${preferredCodec} not supported, using default`);
      const fallbackCodecs = ["VP8", "H264", "VP9"];
      for (const codec of fallbackCodecs) {
        if (supportedCodecs.includes(codec)) {
          const modifiedSdp = preferCodec(offer.sdp || "", codec);
          finalOffer = { type: offer.type, sdp: modifiedSdp };
          console.log(`Using fallback codec: ${codec}`);
          break;
        }
      }
    }
    await pc.setLocalDescription(finalOffer);
    return finalOffer;
  } catch (e) {
    console.error("Failed to create/set local description:", e);
    showToast("Error", "Failed to negotiate video. Retrying may help.");
    try {
      const fallbackOffer = await pc.createOffer();
      await pc.setLocalDescription(fallbackOffer);
      return fallbackOffer;
    } catch {
      return null;
    }
  }
}
function checkScreenSharingSupport() {
  const ua = navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/.test(ua);
  const isAndroid = /Android/.test(ua);
  const isSafari = /Safari/.test(ua) && !/Chrome|CriOS|FxiOS/.test(ua);
  const isChrome = /Chrome/.test(ua) && !/Edge|Edg/.test(ua);
  const isFirefox = /Firefox/.test(ua);
  const isEdge = /Edge|Edg/.test(ua);
  if (isIOS) {
    console.log("Screen sharing is not supported on iOS devices via web apps.");
    if (screenShare) {
      screenShare.style.display = "none";
      screenShare.setAttribute("disabled", "true");
    }
    return false;
  }
  if (isAndroid) {
    if (isChrome) {
      if ("mediaDevices" in navigator && "getDisplayMedia" in navigator.mediaDevices) {
        console.log("Screen sharing is supported on Android Chrome.");
        return true;
      }
    }
    console.log("Screen sharing is not supported on this Android browser.");
    if (screenShare) {
      screenShare.style.display = "none";
      screenShare.setAttribute("disabled", "true");
    }
    return false;
  }
  if ("mediaDevices" in navigator && "getDisplayMedia" in navigator.mediaDevices) {
    if (isSafari) {
      console.log("Screen sharing is supported on desktop Safari (limited).");
      return true;
    } else if (isChrome || isFirefox || isEdge) {
      console.log("Screen sharing is fully supported on this desktop browser.");
      return true;
    }
  }
  console.log("Screen sharing is not supported on this platform.");
  if (screenShare) {
    screenShare.style.display = "none";
    screenShare.setAttribute("disabled", "true");
  }
  return false;
}
async function startScreenShare() {
  try {
    if (!checkScreenSharingSupport()) {
      showToast("Error", "Screen sharing is not supported on this device.");
      return null;
    }
    const constraints = {
      video: {
        mediaSource: "screen",
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        frameRate: { ideal: 30 }
      },
      audio: true
    };
    const stream = await navigator.mediaDevices.getDisplayMedia(constraints);
    stream.getVideoTracks()[0].addEventListener("ended", () => {
      console.log("Screen sharing ended by user");
      if (screenShare) {
        screenShare.textContent = "🖥️ Share Screen";
        screenShare.setAttribute("isShared", "false");
        screenShare.removeAttribute("disabled");
      }
    });
    return stream;
  } catch (error) {
    console.error("Screen sharing error:", error);
    if (error.name === "NotAllowedError") {
      showToast("Error", "Screen sharing permission denied.");
    } else if (error.name === "NotSupportedError") {
      showToast("Error", "Screen sharing not supported on this device.");
    } else {
      showToast("Error", "Failed to start screen sharing.");
    }
    return null;
  }
}
checkScreenSharingSupport();
const media = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  createOfferWithPreferredCodec,
  createVideoElement,
  getCurrentLocalStream,
  getLocalStream,
  getSelectedDevices,
  getStoredAudioOutputId,
  isAudioOutputSwitchingSupported,
  removeRemoteAudioContext,
  setAudioOutputDevice,
  setSelectedDevices,
  switchCamera,
  switchToSelectedDevices
}, Symbol.toStringTag, { value: "Module" }));
function urlBase64ToUint8Array(base64String) {
  try {
    if (!base64String || typeof base64String !== "string") {
      return new Uint8Array();
    }
    const padding = "=".repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, "+").replace(/_/g, "/");
    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
    return outputArray;
  } catch (e) {
    return new Uint8Array();
  }
}
const themes = {
  default: {
    name: "Default",
    colors: {
      "--bg-primary": "#0f2027",
      "--bg-secondary": "#203a43",
      "--bg-tertiary": "#2c5364",
      "--bg-panel": "rgba(255, 255, 255, 0.05)",
      "--text-primary": "#ffffff",
      "--border-primary": "rgba(255, 255, 255, 0.15)"
    }
  },
  dark: {
    name: "Dark",
    colors: {
      "--bg-primary": "#0b0b0b",
      "--bg-secondary": "#1a1a1a",
      "--bg-tertiary": "#2d2d2d",
      "--text-primary": "#ffffff",
      "--border-primary": "rgba(255, 255, 255, 0.1)"
    }
  },
  light: {
    name: "Light",
    colors: {
      "--bg-primary": "#f8fafc",
      "--bg-secondary": "#e2e8f0",
      "--bg-tertiary": "#cbd5e1",
      "--text-primary": "#1e293b",
      "--border-primary": "rgba(0, 0, 0, 0.1)"
    }
  },
  darkcyan: {
    name: "Dark Cyan",
    colors: {
      "--bg-primary": "#052b2b",
      "--bg-secondary": "#074040",
      "--bg-tertiary": "#0b5a5a",
      "--text-primary": "#ffffff",
      "--border-primary": "rgba(255, 255, 255, 0.15)"
    }
  }
};
function applyTheme(themeName) {
  if (themeName === "purple") themeName = "darkcyan";
  const theme = themes[themeName];
  if (!theme) return;
  const root = document.documentElement;
  Object.entries(theme.colors).forEach(([property, value]) => {
    root.style.setProperty(property, value);
  });
  localStorage.setItem("selectedTheme", themeName);
}
function getCurrentTheme() {
  const saved = localStorage.getItem("selectedTheme") || "default";
  return saved === "purple" ? "darkcyan" : saved;
}
function initializeTheme() {
  const savedTheme = getCurrentTheme();
  applyTheme(savedTheme);
  return savedTheme;
}
function createThemeSelector() {
  const selector = document.createElement("div");
  selector.id = "themeSelector";
  selector.innerHTML = `
    <label for="themeSelect">Theme:</label>
    <select id="themeSelect">
      ${Object.entries(themes).map(
    ([key, theme]) => `<option value="${key}">${theme.name}</option>`
  ).join("")}
    </select>
  `;
  const select = selector.querySelector("#themeSelect");
  select.value = getCurrentTheme();
  select.addEventListener("change", (e) => {
    const target = e.target;
    applyTheme(target.value);
  });
  return selector;
}
let usersPanel = null;
let usersToggle = null;
let membersUnsub = null;
function initializeUsersPanel() {
  try {
    if (document.getElementById("usersToggle")) return;
    createUsersUI();
    membersUnsub = subscribeMembers(renderMembers);
    try {
      renderMembers(getMembers());
    } catch {
    }
    try {
      renderRooms();
    } catch {
    }
  } catch (e) {
    console.error("Failed to initialize users panel:", e);
  }
}
function createUsersUI() {
  var _a2, _b2, _c2;
  usersToggle = document.createElement("button");
  usersToggle.id = "usersToggle";
  usersToggle.innerHTML = "👥 Users";
  usersToggle.title = "Show Participants";
  const pipBtn2 = document.getElementById("pipToggle") || document.getElementById("hangup");
  (_a2 = pipBtn2 == null ? void 0 : pipBtn2.parentNode) == null ? void 0 : _a2.insertBefore(usersToggle, pipBtn2.nextSibling);
  usersPanel = document.createElement("div");
  usersPanel.className = "chat-panel";
  usersPanel.style.zIndex = "1003";
  usersPanel.style.right = "unset";
  usersPanel.style.left = "unset";
  usersPanel.innerHTML = `
    <div class="chat-header"><span>Participants</span>
      <button id="closeUsers" style="background: none; border: none; color: var(--text-primary); font-size: 1.2rem; cursor: pointer;">×</button>
    </div>
    <div class="chat-input" style="padding:6px; gap:6px;">
      <input id="customRoomName" placeholder="Enter room name" maxlength="100" />
      <button id="setRoom">Set Room</button>
    </div>
    <div class="chat-messages" id="usersList" style="gap:6px"></div>
    <div class="chat-messages" id="roomsList" style="gap:6px; margin-top:6px;"></div>
  `;
  document.body.appendChild(usersPanel);
  usersToggle.addEventListener("click", () => usersPanel == null ? void 0 : usersPanel.classList.toggle("active"));
  (_b2 = usersPanel.querySelector("#closeUsers")) == null ? void 0 : _b2.addEventListener("click", () => usersPanel == null ? void 0 : usersPanel.classList.remove("active"));
  (_c2 = document.getElementById("setRoom")) == null ? void 0 : _c2.addEventListener("click", () => {
    const input = document.getElementById("customRoomName");
    const value = (input.value || "").trim();
    if (!value) return;
    localStorage.setItem("roomName", value);
    showToast("Success", `Room set to ${value}. Share invite from list.`);
    upsertRoom(value);
    renderRooms();
  });
}
function renderMembers(members) {
  try {
    const list = document.getElementById("usersList");
    if (!list) return;
    list.innerHTML = "";
    const selfId = JSON.parse(localStorage.getItem("userInfo") || "{}").id;
    members.filter((m) => m.id !== void 0 && m.id !== null && m.id !== selfId).forEach((member) => {
      const { userInfo: userInfo2 = {} } = member.clientData || {};
      const item = document.createElement("div");
      item.className = "chat-message";
      const name = userInfo2.nickname || "Unknown";
      const gender = userInfo2.gender || "-";
      const status = userInfo2.status || "";
      const age = userInfo2.age || "";
      item.innerHTML = `
        <div class="sender">${escapeHtml$2(name)}</div>
        <div style="font-size: 0.85rem; opacity: 0.9;">${escapeHtml$2(gender)}${status ? " • " + escapeHtml$2(status) : ""}${age ? " • " + escapeHtml$2(String(age)) : ""}</div>
        <div style="margin-top:6px; display:flex; gap:6px;">
          <button class="dmBtn" data-id="${member.id}" style="flex:unset; padding:4px 8px;">Message</button>
          <button class="inviteBtn" data-id="${member.id}" style="flex:unset; padding:4px 8px;">Invite</button>
        </div>
      `;
      list.appendChild(item);
    });
    list.querySelectorAll(".dmBtn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const toId = btn.getAttribute("data-id");
        const msg = prompt("Send a direct message:");
        if (!msg || !msg.trim()) return;
        try {
          sendDirectMessage(toId, msg.trim());
          showToast("Success", "Message sent");
        } catch (e) {
          showToast("Error", "Failed to send message");
        }
      });
    });
    list.querySelectorAll(".inviteBtn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const toId = btn.getAttribute("data-id");
        const roomName = (localStorage.getItem("roomName") || "").trim();
        if (!roomName) {
          showToast("Warning", "Set a room name first");
          return;
        }
        __vitePreload(async () => {
          const { drone: drone2 } = await Promise.resolve().then(() => room$1);
          return { drone: drone2 };
        }, true ? void 0 : void 0).then(({ drone: drone2 }) => {
          if (drone2 && drone2.rooms) {
            const room2 = Object.keys(drone2.rooms)[0];
            drone2.publish({ room: room2, message: { type: "invite", to: toId, roomName, fromUserInfo: JSON.parse(localStorage.getItem("userInfo") || "{}") } });
            showToast("Success", `Invite sent to join ${roomName}`);
          }
        }).catch(() => showToast("Error", "Failed to send invite"));
      });
    });
  } catch (e) {
    console.error("Render members failed:", e);
  }
}
function getRooms() {
  try {
    const raw = localStorage.getItem("rooms_list");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
function setRooms(arr) {
  try {
    localStorage.setItem("rooms_list", JSON.stringify(arr));
  } catch {
  }
}
function upsertRoom(name) {
  const rooms = getRooms();
  if (!rooms.includes(name)) rooms.push(name);
  setRooms(rooms);
}
function deleteRoom(name) {
  const rooms = getRooms().filter((r) => r !== name);
  setRooms(rooms);
  try {
    localStorage.removeItem(`rooms_members_${name}`);
  } catch {
  }
}
function clearAllRooms() {
  const rooms = getRooms();
  rooms.forEach((r) => {
    try {
      localStorage.removeItem(`rooms_members_${r}`);
    } catch {
    }
  });
  setRooms([]);
}
function renderRooms() {
  const container = document.getElementById("roomsList");
  if (!container) return;
  const rooms = getRooms();
  container.innerHTML = "";
  const current = localStorage.getItem("roomName") || "observable-e7b2d4";
  const header = document.createElement("div");
  header.className = "chat-message";
  header.innerHTML = `<div class="sender">Rooms</div>`;
  container.appendChild(header);
  rooms.forEach((name) => {
    const row = document.createElement("div");
    row.className = "chat-message";
    const members = JSON.parse(localStorage.getItem(`rooms_members_${name}`) || "[]");
    const membersText = members.map((m) => m.nickname || m.id).join(", ");
    row.innerHTML = `
      <div style="display:flex; align-items:center; gap:6px;">
        <div style="flex:1;">
          <div><b>${escapeHtml$2(name)}</b> ${name === current ? "(current)" : ""}</div>
          <div style="font-size:0.8rem; opacity:0.85;">Users: ${escapeHtml$2(membersText)}</div>
        </div>
        <button class="roomSwitch" data-room="${escapeHtml$2(name)}" style="flex:unset; padding:4px 8px;">Join</button>
        <button class="roomEdit" data-room="${escapeHtml$2(name)}" style="flex:unset; padding:4px 8px;">Edit</button>
        <button class="roomDelete" data-room="${escapeHtml$2(name)}" style="flex:unset; padding:4px 8px;">Delete</button>
      </div>`;
    container.appendChild(row);
  });
  const footer = document.createElement("div");
  footer.className = "chat-message";
  footer.innerHTML = `<div style="display:flex; gap:6px; justify-content:flex-end;"><button id="roomsClearAll" style="flex:unset; padding:4px 8px;">Clear All</button></div>`;
  container.appendChild(footer);
  container.querySelectorAll(".roomSwitch").forEach((btn) => btn.addEventListener("click", () => {
    const r = btn.getAttribute("data-room");
    if (!r) return;
    localStorage.setItem("roomName", r);
    showToast("Info", `Joining ${r}...`);
    setTimeout(() => location.reload(), 300);
  }));
  container.querySelectorAll(".roomEdit").forEach((btn) => btn.addEventListener("click", () => {
    const r = btn.getAttribute("data-room");
    const n = prompt("Rename room", r || "");
    if (!n || !n.trim()) return;
    const rooms2 = getRooms();
    const idx = rooms2.indexOf(r || "");
    if (idx !== -1) rooms2[idx] = n.trim();
    setRooms(rooms2);
    const snapshot = localStorage.getItem(`rooms_members_${r}`);
    if (snapshot) {
      localStorage.setItem(`rooms_members_${n.trim()}`, snapshot);
      localStorage.removeItem(`rooms_members_${r}`);
    }
    if ((localStorage.getItem("roomName") || "") === r) localStorage.setItem("roomName", n.trim());
    renderRooms();
  }));
  container.querySelectorAll(".roomDelete").forEach((btn) => btn.addEventListener("click", () => {
    const r = btn.getAttribute("data-room");
    if (!r) return;
    if (!confirm(`Delete room ${r}?`)) return;
    deleteRoom(r);
    renderRooms();
  }));
  const clearBtn = document.getElementById("roomsClearAll");
  if (clearBtn) clearBtn.addEventListener("click", () => {
    if (confirm("Clear all rooms?")) {
      clearAllRooms();
      renderRooms();
    }
  });
}
function receiveDirectMessage(messageData, fromUserInfo) {
  const name = fromUserInfo.nickname || "Unknown";
  showToast("Info", `DM from ${name}: ${messageData.message}`);
}
function escapeHtml$2(text) {
  const div = document.createElement("div");
  div.textContent = text == null ? "" : String(text);
  return div.innerHTML;
}
function destroyUsersPanel() {
  try {
    if (membersUnsub) membersUnsub();
  } catch {
  }
  try {
    usersToggle == null ? void 0 : usersToggle.remove();
  } catch {
  }
  try {
    usersPanel == null ? void 0 : usersPanel.remove();
  } catch {
  }
}
const users = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  destroyUsersPanel,
  initializeUsersPanel,
  receiveDirectMessage
}, Symbol.toStringTag, { value: "Module" }));
const ROUTE_ICONS = {
  speaker: "🔊",
  earpiece: "📞",
  bluetooth: "🎧",
  headphones: "🎧",
  default: "🔈"
};
let toggleBtn = null;
let menuEl = null;
function classifyAudioOutputDevice(label) {
  const l = (label || "").toLowerCase();
  if (!l || l.includes("default") || l.includes("communications")) return "default";
  if (/bluetooth|airpods|hands-?free/.test(l)) return "bluetooth";
  if (/earpiece|receiver/.test(l)) return "earpiece";
  if (/speakerphone|speaker/.test(l)) return "speaker";
  if (/headphone|headset|wired|line|aux/.test(l)) return "headphones";
  return "default";
}
async function listAudioOutputOptions() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((d) => d.kind === "audiooutput").map((d, idx) => ({
      id: d.deviceId,
      label: d.label || `Audio Output ${idx + 1}`,
      kind: classifyAudioOutputDevice(d.label)
    }));
  } catch (e) {
    console.warn("Failed to enumerate audio output devices:", e);
    return [];
  }
}
function escapeHtml$1(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
function updateToggleIcon(kind) {
  if (toggleBtn) toggleBtn.textContent = `${ROUTE_ICONS[kind]} Audio Output`;
}
function closeMenu() {
  menuEl == null ? void 0 : menuEl.classList.add("hidden");
}
function isMenuOpen() {
  return !!menuEl && !menuEl.classList.contains("hidden");
}
async function openMenu() {
  if (!menuEl || !toggleBtn) return;
  const devices = await listAudioOutputOptions();
  const selectedId = getStoredAudioOutputId();
  const options = [
    { id: "", label: "System Default", kind: "default" },
    ...devices.filter((d) => d.id)
    // avoid duplicating the default entry
  ];
  menuEl.innerHTML = options.map((option) => `
    <button type="button" class="audio-output-item${option.id === selectedId ? " active" : ""}"
      data-device-id="${escapeHtml$1(option.id)}" data-kind="${option.kind}">
      <span class="icon">${ROUTE_ICONS[option.kind]}</span>
      <span class="label">${escapeHtml$1(option.label)}</span>
      ${option.id === selectedId ? '<span class="check">✓</span>' : ""}
    </button>
  `).join("");
  const rect = toggleBtn.getBoundingClientRect();
  const menuWidth = 260;
  menuEl.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - menuWidth - 8))}px`;
  menuEl.style.top = `${rect.bottom + 6}px`;
  menuEl.classList.remove("hidden");
}
async function handleMenuClick(event) {
  var _a2;
  const target = event.target.closest(".audio-output-item");
  if (!target) return;
  const deviceId = target.dataset.deviceId || "";
  const kind = target.dataset.kind || "default";
  closeMenu();
  try {
    await setAudioOutputDevice(deviceId);
    updateToggleIcon(kind);
    showToast("Success", `Audio output switched to ${(_a2 = target.querySelector(".label")) == null ? void 0 : _a2.textContent}`);
  } catch (e) {
    console.error("Failed to switch audio output:", e);
    showToast("Error", "Unable to switch audio output");
  }
}
function initializeAudioOutput() {
  var _a2, _b2;
  toggleBtn = document.getElementById("audioOutputToggle");
  if (!toggleBtn) return;
  if (!isAudioOutputSwitchingSupported()) {
    toggleBtn.style.display = "none";
    return;
  }
  menuEl = document.createElement("div");
  menuEl.id = "audioOutputMenu";
  menuEl.className = "audio-output-menu hidden";
  document.body.appendChild(menuEl);
  toggleBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (isMenuOpen()) closeMenu();
    else openMenu();
  });
  menuEl.addEventListener("click", handleMenuClick);
  document.addEventListener("click", (e) => {
    if (isMenuOpen() && menuEl && !menuEl.contains(e.target) && e.target !== toggleBtn) {
      closeMenu();
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeMenu();
  });
  (_b2 = (_a2 = navigator.mediaDevices) == null ? void 0 : _a2.addEventListener) == null ? void 0 : _b2.call(_a2, "devicechange", () => {
    if (isMenuOpen()) openMenu();
  });
  const storedId = getStoredAudioOutputId();
  if (storedId) {
    listAudioOutputOptions().then((devices) => {
      const match = devices.find((d) => d.id === storedId);
      if (match) updateToggleIcon(match.kind);
    });
  }
}
const isIos = /iphone|ipod|ipad/i.test(navigator.userAgent);
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
let localStream = null;
const muteVideo = document.querySelector("#muteVideo");
const muteAudio = document.querySelector("#muteAudio");
const userInfoModal = document.querySelector("#userInfoModal");
const retryBtn = document.querySelector("#retryBtn");
const connectionStatusBar = document.querySelector("#connectionStatus");
const connectionStatusText = connectionStatusBar == null ? void 0 : connectionStatusBar.querySelector(".text");
let callStartMs = null;
let statsInterval = null;
let statsVisible = true;
const pipToggleBtn = document.getElementById("pipToggle");
const videoInputSelect = document.getElementById("videoInputSelect");
const audioInputSelect = document.getElementById("audioInputSelect");
const serverURL = window.location.hostname === "localhost" ? "http://localhost:3000/" : "https://web-push-3zaz.onrender.com/";
const subscribeToPushNotification = document.querySelector("#push");
if (navigator.mediaDevices) {
  (async () => {
    if (videoInputSelect) {
      videoInputSelect.addEventListener("change", async () => {
        const vid = videoInputSelect.value || "";
        const { audioDeviceId } = getSelectedDevices();
        setSelectedDevices({ videoDeviceId: vid });
        persistSelectedDevices();
        try {
          await switchToSelectedDevices(vid, audioDeviceId || "");
        } catch (e) {
          console.warn(e);
        }
      });
    }
    if (audioInputSelect) {
      audioInputSelect.addEventListener("change", async () => {
        const aud = audioInputSelect.value || "";
        const { videoDeviceId } = getSelectedDevices();
        setSelectedDevices({ audioDeviceId: aud });
        persistSelectedDevices();
        try {
          await switchToSelectedDevices(videoDeviceId || "", aud);
        } catch (e) {
          console.warn(e);
        }
      });
    }
  })();
}
function SendPushToAll(title, body) {
  var _a2;
  try {
    if (!navigator.onLine) return;
    const initiator = ((_a2 = JSON.parse(window.localStorage.getItem("userInfo") || "{}")) == null ? void 0 : _a2.id) || 0;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5e3);
    fetch(serverURL + "notifyAll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initiator, title, body }),
      signal: controller.signal
    }).catch((err) => {
      console.warn("NotifyAll failed (ignored):", (err == null ? void 0 : err.message) || err);
    }).finally(() => clearTimeout(timeout));
  } catch (e) {
    console.warn("NotifyAll threw (ignored):", (e == null ? void 0 : e.message) || e);
  }
}
async function IsSubscribedToPush() {
  const userInfo2 = JSON.parse(window.localStorage.getItem("userInfo") || "{}");
  if (!userInfo2) return false;
  if (Notification.permission === "granted") {
    const subscribe = localStorage.getItem("subscription");
    if (!subscribe) {
      const subscription = await (serviceWorkerMain == null ? void 0 : serviceWorkerMain.pushManager.getSubscription());
      if (subscription) {
        await subscription.unsubscribe();
        showToast("Info", "Notification unsubscribed locally!, Please resubscribe.");
      }
      return false;
    }
    const res = await fetch(serverURL + "isPushSubscribed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: subscribe
    });
    const json = await res.json();
    return json.isSubscribed;
  }
  return false;
}
if (connectionStatusBar) {
  connectionStatus.onChange = (status) => {
    connectionStatusBar.classList.remove("connected", "reconnecting", "disconnected");
    connectionStatusBar.classList.add(status);
    if (connectionStatusText) {
      if (status === "connected") connectionStatusText.textContent = "Connected";
      if (status === "reconnecting") connectionStatusText.textContent = "Reconnecting…";
      if (status === "disconnected") connectionStatusText.textContent = "Disconnected";
    }
  };
}
if (retryBtn) {
  retryBtn.addEventListener("click", () => {
    connectionStatus.set("reconnecting");
    manualReconnect();
  });
}
subscribeToPushNotification == null ? void 0 : subscribeToPushNotification.addEventListener("click", async () => {
  var _a2, _b2;
  const getVapidKey = await fetch(serverURL + "vapid").catch((err) => console.log(err));
  if (!getVapidKey) return;
  const { publicKey } = await getVapidKey.json();
  subscribeToPushNotification.setAttribute("disabled", "true");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    showToast("Error", "Unable to subscribe to push notifications");
    subscribeToPushNotification.setAttribute("disabled", "false");
    return;
  }
  const subscription = await (serviceWorkerMain == null ? void 0 : serviceWorkerMain.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey)
  }));
  const subscribejson = {
    "endpoint": subscription == null ? void 0 : subscription.toJSON().endpoint,
    "expirationTime": subscription == null ? void 0 : subscription.toJSON().expirationTime,
    "keys": {
      "p256dh": (_a2 = subscription == null ? void 0 : subscription.toJSON().keys) == null ? void 0 : _a2.p256dh,
      "auth": (_b2 = subscription == null ? void 0 : subscription.toJSON().keys) == null ? void 0 : _b2.auth,
      "id": JSON.parse(window.localStorage.getItem("userInfo") || "{}").id
    }
  };
  localStorage.setItem("subscription", JSON.stringify(subscription));
  await fetch(serverURL + "subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscribejson)
  }).then((res) => {
    if (res.status === 200)
      showToast("Success", "Push notifications subscribed successfully");
    else
      showToast("Error", "Unable to subscribe to push notifications");
  }).catch((err) => {
    console.log(err);
    showToast("Error", "Unable to subscribe to push notifications");
  });
  subscribeToPushNotification.style.display = "none";
  showToast("Success", "Push notifications subscribed successfully");
}, false);
setTimeout(async () => {
  const isSubscribed = await IsSubscribedToPush();
  if (subscribeToPushNotification) {
    subscribeToPushNotification.style.display = isSubscribed ? "none" : "";
  }
}, 1e3);
let userInfo = JSON.parse(window.localStorage.getItem("userInfo") || "null");
if (!userInfo) {
  openModal();
} else {
  const { nickname, gender } = userInfo;
  if (!nickname || !gender)
    openModal();
}
navigator.mediaDevices.addEventListener("devicechange", () => {
  populateDeviceSelectors();
});
async function populateDeviceSelectors() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoInputs = devices.filter((d) => d.kind === "videoinput");
    const audioInputs = devices.filter((d) => d.kind === "audioinput");
    if (videoInputSelect) {
      const current = getSelectedDevices().videoDeviceId;
      videoInputSelect.innerHTML = "";
      videoInputs.forEach((d, idx) => {
        const option = document.createElement("option");
        option.value = d.deviceId;
        option.text = d.label || `Camera ${idx + 1}`;
        videoInputSelect.appendChild(option);
      });
      if (current && [...videoInputSelect.options].some((o) => o.value === current)) {
        videoInputSelect.value = current;
      }
    }
    if (audioInputSelect) {
      const current = getSelectedDevices().audioDeviceId;
      audioInputSelect.innerHTML = "";
      audioInputs.forEach((d, idx) => {
        const option = document.createElement("option");
        option.value = d.deviceId;
        option.text = d.label || `Microphone ${idx + 1}`;
        audioInputSelect.appendChild(option);
      });
      if (current && [...audioInputSelect.options].some((o) => o.value === current)) {
        audioInputSelect.value = current;
      }
    }
  } catch (e) {
    console.error("Failed to populate device selectors", e);
  }
}
function persistSelectedDevices() {
  const vid = (videoInputSelect == null ? void 0 : videoInputSelect.value) || "";
  const aud = (audioInputSelect == null ? void 0 : audioInputSelect.value) || "";
  try {
    localStorage.setItem("selectedVideoDeviceId", vid);
  } catch {
  }
  try {
    localStorage.setItem("selectedAudioDeviceId", aud);
  } catch {
  }
}
function restoreSelectedDevices() {
  try {
    const vid = localStorage.getItem("selectedVideoDeviceId") || "";
    const aud = localStorage.getItem("selectedAudioDeviceId") || "";
    setSelectedDevices({ videoDeviceId: vid || null, audioDeviceId: aud || null });
  } catch {
  }
}
(_a = document.querySelector("#controls")) == null ? void 0 : _a.addEventListener("click", async (event) => {
  const target = event.target;
  const targetID = target.id;
  switch (targetID) {
    case "start":
      target.disabled = true;
      await main();
      target.disabled = false;
      break;
    case "muteAudio":
      target.textContent = "🔇 " + ((localStream == null ? void 0 : localStream.getAudioTracks()[0].enabled) ? "Unmute Audio" : "Mute Audio");
      (localStream == null ? void 0 : localStream.getAudioTracks()[0]) && (localStream.getAudioTracks()[0].enabled = !localStream.getAudioTracks()[0].enabled);
      break;
    case "muteVideo":
      target.textContent = "🎥 " + ((localStream == null ? void 0 : localStream.getVideoTracks()[0].enabled) ? "Unmute Video" : "Mute Video");
      (localStream == null ? void 0 : localStream.getVideoTracks()[0]) && (localStream.getVideoTracks()[0].enabled = !localStream.getVideoTracks()[0].enabled);
      break;
    case "switchCamera":
      await switchCamera();
      break;
    case "videoDevicesRefresh":
      populateDeviceSelectors();
      break;
    case "audioDevicesRefresh":
      populateDeviceSelectors();
      break;
    case "hangup":
      resetAfterHangup();
      break;
    case "pipToggle":
      handlePiPToggle();
      break;
  }
});
(_b = document.querySelector(".Channel")) == null ? void 0 : _b.addEventListener("click", (event) => {
  const target = event.target;
  if (target.tagName !== "VIDEO") return;
  const mainVideo = document.getElementById("localMainVideo");
  if (mainVideo.getAttribute("participantID") == target.id) return;
  mainVideo.setAttribute("participantID", target.id);
  const video = target;
  mainVideo.srcObject = video.srcObject;
  mainVideo.classList.add("active");
  mainVideo.style.transform = video.id === "localVideo" ? "scale(-1, 1)" : "";
});
(_c = document.querySelector("#localMainVideo")) == null ? void 0 : _c.addEventListener("dblclick", (event) => {
  const target = event.target;
  target.requestFullscreen();
});
if (pipToggleBtn) {
  const pipSupported = "pictureInPictureEnabled" in document && typeof HTMLVideoElement !== "undefined" && "requestPictureInPicture" in HTMLVideoElement.prototype;
  if (!pipSupported) {
    pipToggleBtn.style.display = "none";
  } else {
    const mainVideo = document.getElementById("localMainVideo");
    if (mainVideo) {
      mainVideo.addEventListener("enterpictureinpicture", () => {
        pipToggleBtn.textContent = "🗗 Exit PiP";
      });
      mainVideo.addEventListener("leavepictureinpicture", () => {
        pipToggleBtn.textContent = "🗔 Picture-in-Picture";
      });
    }
  }
}
async function handlePiPToggle() {
  try {
    if (!("pictureInPictureEnabled" in document)) return;
    const mainVideo = document.getElementById("localMainVideo");
    if (!mainVideo || !mainVideo.srcObject) return;
    if (mainVideo.paused) {
      try {
        await mainVideo.play();
      } catch {
      }
    }
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture();
      return;
    }
    if (document.pictureInPictureElement && document.pictureInPictureElement !== mainVideo) {
      await document.exitPictureInPicture();
    }
    await mainVideo.requestPictureInPicture();
  } catch (err) {
    console.error("PiP toggle failed:", err);
    showToast("Error", "Unable to toggle Picture-in-Picture");
  }
}
async function main() {
  const nickname = JSON.parse(window.localStorage.getItem("userInfo") || "{}").nickname || "No name";
  SendPushToAll("Video Conferencing with KiteCite", "Started by " + nickname);
  restoreSelectedDevices();
  localStream = await getLocalStream();
  if (localStream) {
    createVideoElement(localStream, "localVideo", true, "You");
  }
  callStartMs = Date.now();
  startStatsPolling();
  if (!isIos) {
    await populateDeviceSelectors();
  }
  if (drone) {
    drone.publish({
      room: Object.keys(drone.rooms)[0],
      message: { type: "join", from: drone.clientId, userInfo }
    });
    return;
  }
  if (localStream) {
    setupRoom(localStream, (remoteStream, id, name) => {
      if (!document.getElementById(id)) {
        createVideoElement(remoteStream, id, false, name);
      }
    });
  }
}
if (!isIos)
  populateDeviceSelectors();
if (!isMobile) {
  const switchCameraEl = document.querySelector("#switchCamera");
  if (switchCameraEl) switchCameraEl.style.display = "none";
}
initializeTheme();
const themeSelector = createThemeSelector();
const controls = document.querySelector(".controls");
if (controls) {
  controls.insertAdjacentElement("afterend", themeSelector);
}
const pipBtn = document.getElementById("pipToggle") || document.getElementById("shareScreen") || document.getElementById("hangup");
if (pipBtn) {
  const statsToggle = document.createElement("button");
  statsToggle.id = "statsToggle";
  statsToggle.textContent = "📊 Stats";
  statsToggle.title = "Show/Hide bitrate stats";
  (_d = pipBtn.parentNode) == null ? void 0 : _d.insertBefore(statsToggle, pipBtn.nextSibling);
  statsToggle.addEventListener("click", () => {
    statsVisible = !statsVisible;
    const panel = document.getElementById("statsPanel");
    if (panel) panel.style.display = statsVisible ? "" : "none";
  });
}
initializeChat();
initializeUsersPanel();
initializeAudioOutput();
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("message", (event) => {
    if (event.data && event.data.type === "NOTIFICATION_CLICK") {
      console.log("Notification clicked:", event.data.data);
      if (event.data.data.type === "chat") {
        const chatPanel2 = document.querySelector(".chat-panel");
        if (chatPanel2) {
          chatPanel2.classList.add("active");
          const chatInput = document.getElementById("chatInput");
          if (chatInput) {
            chatInput.focus();
          }
        }
      }
      if (event.data.data.type === "call" && event.data.data.roomId) {
        showToast("Info", `Incoming call to room: ${event.data.data.roomId}`);
      }
    }
  });
}
let deferredPrompt;
const installBtn = document.getElementById("install-btn");
window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredPrompt = event;
  installBtn.style.display = "flex";
  setTimeout(() => {
    installBtn.style.display = "none";
    showToast("Info", "You can add this app to your home screen!");
  }, 15e3);
  installBtn.addEventListener("click", () => {
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === "accepted") {
        console.log("User accepted the A2HS prompt");
      } else {
        console.log("User dismissed the A2HS prompt");
      }
      deferredPrompt = null;
    });
  });
});
if (window.matchMedia("(display-mode: standalone)").matches) {
  installBtn.style.display = "none";
}
userInfoModal == null ? void 0 : userInfoModal.addEventListener("click", (event) => {
  const target = event.target;
  if (target === userInfoModal || target.id === "closeModal")
    closeModal();
  else if (target.id === "submit-btn") {
    event.stopPropagation();
    const nickname = document.querySelector("#nickname").value;
    const gender = document.querySelector("#divGender").querySelector("input:checked");
    const status = document.querySelector("#status").value;
    const age = document.querySelector("#age").value;
    if (!nickname || !gender) {
      showToast("Error", "Please fill all the fields!");
      return;
    }
    userInfo = { nickname, gender: gender.value, status, age: parseInt(age), id: (/* @__PURE__ */ new Date()).getTime() };
    window.localStorage.setItem("userInfo", JSON.stringify(userInfo));
    closeModal();
  }
});
function openModal() {
  userInfoModal == null ? void 0 : userInfoModal.classList.add("show-modal");
  const userInfo2 = window.localStorage.getItem("userInfo");
  const h4 = document.querySelector("h4");
  if (userInfo2) {
    const parsed = JSON.parse(userInfo2);
    document.querySelector("#nickname").value = parsed.nickname;
    document.querySelector("#divGender").querySelector(`input[value=${parsed.gender}]`);
    document.querySelector("#status").value = parsed.status;
    document.querySelector("#age").value = parsed.age;
    h4.innerHTML = "Video Conferencing with KiteCite";
  } else {
    document.querySelector("#start").setAttribute("disabled", "true");
    h4.innerHTML = "Dear Anonymous User, Please Enter Your Details";
  }
}
function closeModal() {
  const userInfo2 = window.localStorage.getItem("userInfo");
  const h4 = document.querySelector("h4");
  userInfoModal == null ? void 0 : userInfoModal.classList.remove("show-modal");
  if (userInfo2) {
    document.querySelector("#nickname").value = "";
    document.querySelector("#divGender").querySelector("input[value='male']");
    document.querySelector("#status").value = "";
    document.querySelector("#age").value = "";
    h4.innerHTML = "Video Conferencing with KiteCite";
    document.querySelector("#start").removeAttribute("disabled");
    h4.removeEventListener("click", openModal);
  } else {
    document.querySelector("#start").setAttribute("disabled", "true");
    h4.innerHTML = "Dear Anonymous User, Please Enter Your Details By Clicking Here";
    h4.addEventListener("click", openModal);
  }
}
let statsPanel = null;
function ensureStatsPanel() {
  if (statsPanel) return statsPanel;
  statsPanel = document.createElement("div");
  statsPanel.id = "statsPanel";
  statsPanel.style.position = "fixed";
  statsPanel.style.bottom = "10px";
  statsPanel.style.left = "10px";
  statsPanel.style.zIndex = "1001";
  statsPanel.style.background = "var(--bg-card)";
  statsPanel.style.border = "1px solid var(--border-primary)";
  statsPanel.style.borderRadius = "8px";
  statsPanel.style.padding = "8px 10px";
  statsPanel.style.fontSize = "12px";
  statsPanel.style.maxWidth = "320px";
  statsPanel.innerHTML = `<div id="callDuration">Duration: 00:00</div><div id="overallStats"></div><div id="perPeerStats" style="margin-top:6px;"></div>`;
  document.body.appendChild(statsPanel);
  makeDraggable(statsPanel);
  return statsPanel;
}
function formatDuration(ms) {
  const total = Math.floor(ms / 1e3);
  const h = Math.floor(total / 3600).toString().padStart(2, "0");
  const m = Math.floor(total % 3600 / 60).toString().padStart(2, "0");
  const s = Math.floor(total % 60).toString().padStart(2, "0");
  return h === "00" ? `${m}:${s}` : `${h}:${m}:${s}`;
}
let lastStats = {};
let baseStats = {};
async function pollStatsOnce() {
  try {
    ensureStatsPanel();
    if (callStartMs) {
      const cd = document.getElementById("callDuration");
      if (cd) cd.textContent = `Duration: ${formatDuration(Date.now() - callStartMs)}`;
    }
    const peers = getPeerConnections();
    let overallUpBps = 0, overallDownBps = 0;
    let overallSentBytes = 0, overallRecvBytes = 0;
    const perPeer = [];
    const now = Date.now();
    const pcEntries = Object.entries(peers);
    for (const [peerId, pc] of pcEntries) {
      if (!pc || typeof pc.getStats !== "function") continue;
      const stats = await pc.getStats();
      let bytesSent = 0, bytesRecv = 0;
      stats.forEach((report) => {
        if (report.type === "outbound-rtp" && !report.isRemote) {
          if (typeof report.bytesSent === "number") bytesSent += report.bytesSent;
        }
        if (report.type === "inbound-rtp" && !report.isRemote) {
          if (typeof report.bytesReceived === "number") bytesRecv += report.bytesReceived;
        }
      });
      if (!baseStats[peerId]) baseStats[peerId] = { sent: bytesSent, recv: bytesRecv };
      const last = lastStats[peerId] || { t: now, sent: bytesSent, recv: bytesRecv };
      const dt = Math.max(1, now - last.t) / 1e3;
      const upBps = Math.max(0, (bytesSent - last.sent) * 8 / dt);
      const downBps = Math.max(0, (bytesRecv - last.recv) * 8 / dt);
      lastStats[peerId] = { t: now, sent: bytesSent, recv: bytesRecv };
      overallUpBps += upBps;
      overallDownBps += downBps;
      overallSentBytes += Math.max(0, bytesSent - baseStats[peerId].sent);
      overallRecvBytes += Math.max(0, bytesRecv - baseStats[peerId].recv);
      perPeer.push({ peerId, upBps, downBps });
    }
    const overall = document.getElementById("overallStats");
    if (overall) overall.textContent = `Total Up: ${formatBytes(overallSentBytes)} | Total Down: ${formatBytes(overallRecvBytes)}`;
    const per = document.getElementById("perPeerStats");
    if (per) per.innerHTML = perPeer.map((p) => {
      const name = getPeerName(p.peerId) || p.peerId;
      return `<div>${escapeHtml(name)}: ↑ ${formatBps(p.upBps)} ↓ ${formatBps(p.downBps)}</div>`;
    }).join("");
  } catch (e) {
  }
}
function formatBps(bps) {
  if (!isFinite(bps)) return "0 bps";
  if (bps < 1e3) return `${bps.toFixed(0)} bps`;
  if (bps < 1e6) return `${(bps / 1e3).toFixed(1)} Kbps`;
  if (bps < 1e9) return `${(bps / 1e6).toFixed(1)} Mbps`;
  return `${(bps / 1e9).toFixed(2)} Gbps`;
}
function formatBytes(bytes) {
  if (!isFinite(bytes)) return "0 B";
  if (bytes < 1024) return `${bytes.toFixed(0)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
function startStatsPolling() {
  try {
    ensureStatsPanel();
    if (statsInterval) clearInterval(statsInterval);
    statsInterval = setInterval(pollStatsOnce, 1e3);
  } catch {
  }
}
function stopStatsPolling() {
  try {
    if (statsInterval) clearInterval(statsInterval);
  } catch {
  }
  statsInterval = null;
  lastStats = {};
  baseStats = {};
}
function resetControlsUI() {
  var _a2;
  try {
    if (muteVideo) muteVideo.textContent = "🎥 Mute Video";
    if (muteAudio) muteAudio.textContent = "🔇 Mute Audio";
    (_a2 = document.querySelector("#localMainVideo")) == null ? void 0 : _a2.classList.remove("active");
    const channel = document.querySelector(".Channel");
    if (channel) channel.innerHTML = "";
    const { videoDeviceId, audioDeviceId } = getSelectedDevices();
    if (videoInputSelect && videoDeviceId) videoInputSelect.value = videoDeviceId;
    if (audioInputSelect && audioDeviceId) audioInputSelect.value = audioDeviceId;
    if (connectionStatusBar) {
      connectionStatusBar.classList.remove("reconnecting", "disconnected");
      connectionStatusBar.classList.add("connected");
      if (connectionStatusText) connectionStatusText.textContent = "Connected";
    }
  } catch {
  }
}
async function resetAfterHangup() {
  try {
    stopStatsPolling();
    try {
      if (localStream) {
        localStream.getTracks().forEach((track) => {
          try {
            track.stop();
          } catch {
          }
        });
      }
    } catch {
    }
    localStream = null;
    try {
      if (drone && drone.rooms) {
        const roomName = Object.keys(drone.rooms)[0];
        drone.publish({ room: roomName, message: { type: "leave", from: drone.clientId, userInfo } });
      }
    } catch {
    }
    try {
      if (pcInfo) {
        pcInfo.getSenders().forEach((sender) => {
          var _a2;
          try {
            (_a2 = sender.track) == null ? void 0 : _a2.stop();
          } catch {
          }
        });
      }
    } catch {
    }
    try {
      const mod = await __vitePreload(() => Promise.resolve().then(() => room$1), true ? void 0 : void 0);
      if (typeof mod.destroyConnections === "function") mod.destroyConnections();
    } catch {
    }
    resetControlsUI();
  } catch {
  }
}
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text == null ? "" : String(text);
  return div.innerHTML;
}
function makeDraggable(el) {
  let dragging = false;
  let offsetX = 0;
  let offsetY = 0;
  const onDown = (clientX, clientY) => {
    const rect = el.getBoundingClientRect();
    dragging = true;
    offsetX = clientX - rect.left;
    offsetY = clientY - rect.top;
    el.style.right = "unset";
    el.style.bottom = "unset";
    el.style.transform = "none";
    document.body.style.userSelect = "none";
  };
  const onMove = (clientX, clientY) => {
    if (!dragging) return;
    const maxX = window.innerWidth - el.offsetWidth - 4;
    const maxY = window.innerHeight - el.offsetHeight - 4;
    let x = Math.max(4, Math.min(clientX - offsetX, maxX));
    let y = Math.max(4, Math.min(clientY - offsetY, maxY));
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
  };
  const onUp = () => {
    dragging = false;
    document.body.style.userSelect = "";
  };
  el.style.cursor = "move";
  el.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    onDown(e.clientX, e.clientY);
    e.preventDefault();
  });
  window.addEventListener("mousemove", (e) => onMove(e.clientX, e.clientY));
  window.addEventListener("mouseup", onUp);
  el.addEventListener("touchstart", (e) => {
    const t = e.touches[0];
    onDown(t.clientX, t.clientY);
  }, { passive: true });
  window.addEventListener("touchmove", (e) => {
    const t = e.touches[0];
    onMove(t.clientX, t.clientY);
  }, { passive: true });
  window.addEventListener("touchend", onUp);
}
//# sourceMappingURL=main-D4-IysOH.js.map
