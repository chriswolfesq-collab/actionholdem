const STORAGE_KEY = "morning-me-state-v1";

const defaultState = {
    protectionEnabled: true,
    startTime: "22:00",
    endTime: "06:00",
    delayMinutes: 120,
    checkMode: "soft",
    contacts: ["Alex", "Maya", "Boss"],
    held: [],
    sent: [],
    activeTab: "held"
};

const riskWords = [
    "miss", "sorry", "ex", "love", "hate", "why", "alone", "angry", "again",
    "come over", "u up", "wyd", "mistake", "never", "always", "please"
];

const sampleReplies = [
    "You good?",
    "Maybe sleep on it.",
    "Morning-you gets a vote.",
    "Saved as a draft."
];

let state = loadState();
let pendingMessage = null;
let currentChallenge = null;
let toastTimer = null;

const els = {};

document.addEventListener("DOMContentLoaded", () => {
    cacheElements();
    bindEvents();
    renderAll();
});

function cacheElements() {
    [
        "riskModeLabel", "protectedCountLabel", "heldCountLabel", "protectionToggle",
        "startTimeInput", "endTimeInput", "delaySelect", "contactForm",
        "contactNameInput", "contactList", "contactBadge", "recipientSelect",
        "recipientRiskPill", "conversationPreview", "messageForm", "messageInput",
        "riskScore", "queueContent", "challengeDialog", "challengeTitle",
        "challengePrompt", "challengeInput", "challengeFeedback", "holdInsteadBtn",
        "challengeSendBtn", "toast", "resetDemoBtn"
    ].forEach(id => {
        els[id] = document.getElementById(id);
    });
}

function bindEvents() {
    els.protectionToggle.addEventListener("change", () => {
        state.protectionEnabled = els.protectionToggle.checked;
        persistAndRender();
    });

    els.startTimeInput.addEventListener("change", () => {
        state.startTime = els.startTimeInput.value || defaultState.startTime;
        persistAndRender();
    });

    els.endTimeInput.addEventListener("change", () => {
        state.endTime = els.endTimeInput.value || defaultState.endTime;
        persistAndRender();
    });

    els.delaySelect.addEventListener("change", () => {
        state.delayMinutes = Number(els.delaySelect.value);
        persistAndRender();
    });

    document.querySelectorAll(".segment").forEach(button => {
        button.addEventListener("click", () => {
            state.checkMode = button.dataset.check;
            persistAndRender();
        });
    });

    document.querySelectorAll(".tab").forEach(button => {
        button.addEventListener("click", () => {
            state.activeTab = button.dataset.tab;
            persistAndRender();
        });
    });

    els.contactForm.addEventListener("submit", event => {
        event.preventDefault();
        const name = cleanText(els.contactNameInput.value);
        if (!name) return;
        if (!state.contacts.some(contact => contact.toLowerCase() === name.toLowerCase())) {
            state.contacts.push(name);
        }
        els.contactNameInput.value = "";
        persistAndRender();
    });

    els.recipientSelect.addEventListener("change", renderConversation);
    els.messageInput.addEventListener("input", renderRiskScore);
    els.messageForm.addEventListener("submit", handleMessageSubmit);
    els.holdInsteadBtn.addEventListener("click", holdPendingMessage);
    els.challengeSendBtn.addEventListener("click", tryChallengeSend);
    els.resetDemoBtn.addEventListener("click", resetDemo);
}

function loadState() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return structuredClone(defaultState);
        const saved = JSON.parse(raw);
        return {
            ...structuredClone(defaultState),
            ...saved,
            contacts: Array.isArray(saved.contacts) ? saved.contacts : defaultState.contacts,
            held: Array.isArray(saved.held) ? saved.held : [],
            sent: Array.isArray(saved.sent) ? saved.sent : []
        };
    } catch {
        return structuredClone(defaultState);
    }
}

function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function persistAndRender() {
    saveState();
    renderAll();
}

function renderAll() {
    normalizeMessages();
    renderSettings();
    renderContacts();
    renderRecipientOptions();
    renderConversation();
    renderRiskScore();
    renderQueue();
    renderMetrics();
}

function normalizeMessages() {
    const now = Date.now();
    state.held = state.held.map(message => ({
        ...message,
        ready: message.ready || message.releaseAt <= now
    }));
    saveState();
}

function renderSettings() {
    els.protectionToggle.checked = state.protectionEnabled;
    els.startTimeInput.value = state.startTime;
    els.endTimeInput.value = state.endTime;
    els.delaySelect.value = String(state.delayMinutes);

    document.querySelectorAll(".segment").forEach(button => {
        button.classList.toggle("active", button.dataset.check === state.checkMode);
    });

    document.querySelectorAll(".tab").forEach(button => {
        button.classList.toggle("active", button.dataset.tab === state.activeTab);
    });
}

function renderContacts() {
    els.contactBadge.textContent = state.contacts.length;
    els.contactList.innerHTML = "";

    if (!state.contacts.length) {
        els.contactList.innerHTML = `<div class="empty-state">No protected contacts.</div>`;
        return;
    }

    state.contacts.forEach(contact => {
        const row = document.createElement("div");
        row.className = "contact-chip";
        row.innerHTML = `
            <span>${escapeHtml(contact)}</span>
            <button type="button" aria-label="Remove ${escapeAttr(contact)}">x</button>
        `;
        row.querySelector("button").addEventListener("click", () => {
            state.contacts = state.contacts.filter(item => item !== contact);
            persistAndRender();
        });
        els.contactList.appendChild(row);
    });
}

function renderRecipientOptions() {
    const current = els.recipientSelect.value;
    const options = [...state.contacts, "Jamie", "Sam", "Mom"];
    const uniqueOptions = [...new Set(options)].sort((a, b) => a.localeCompare(b));
    els.recipientSelect.innerHTML = uniqueOptions.map(name => (
        `<option value="${escapeAttr(name)}">${escapeHtml(name)}</option>`
    )).join("");

    if (uniqueOptions.includes(current)) {
        els.recipientSelect.value = current;
    } else if (uniqueOptions.length) {
        els.recipientSelect.value = uniqueOptions[0];
    }
}

function renderConversation() {
    const recipient = els.recipientSelect.value;
    const protectedRecipient = isProtectedRecipient(recipient);
    els.recipientRiskPill.textContent = protectedRecipient ? "Protected" : "Clear";
    els.recipientRiskPill.classList.toggle("clear", !protectedRecipient);

    const sent = state.sent
        .filter(message => message.recipient === recipient)
        .slice(-3)
        .map(message => bubble(message.text, "sent", `Sent ${formatTime(message.createdAt)}`));

    const held = state.held
        .filter(message => message.recipient === recipient)
        .slice(-2)
        .map(message => bubble(message.text, "held", message.ready ? "Ready" : `Held until ${formatTime(message.releaseAt)}`));

    const intro = bubble(sampleReplies[Math.abs(hashCode(recipient)) % sampleReplies.length], "", recipient);
    els.conversationPreview.innerHTML = [intro, ...sent, ...held].join("");
}

function bubble(text, tone, meta) {
    return `
        <div class="bubble ${tone}">
            ${escapeHtml(text)}
            <small>${escapeHtml(meta)}</small>
        </div>
    `;
}

function renderRiskScore() {
    const recipient = els.recipientSelect.value;
    const text = els.messageInput.value;
    const score = scoreMessage(text, recipient);
    els.riskScore.textContent = `Risk: ${score}`;
    els.riskScore.classList.toggle("warn", score >= 35 && score < 70);
    els.riskScore.classList.toggle("hot", score >= 70);
}

function renderQueue() {
    const tab = state.activeTab;
    if (tab === "held") renderHeldQueue(false);
    if (tab === "review") renderHeldQueue(true);
    if (tab === "sent") renderSentQueue();
}

function renderHeldQueue(readyOnly) {
    const messages = state.held
        .filter(message => !readyOnly || message.ready)
        .sort((a, b) => a.releaseAt - b.releaseAt);

    if (!messages.length) {
        els.queueContent.innerHTML = `<div class="empty-state">${readyOnly ? "No drafts ready for morning review." : "No messages are being held."}</div>`;
        return;
    }

    els.queueContent.innerHTML = "";
    messages.forEach(message => els.queueContent.appendChild(createMessageCard(message, "held")));
}

function renderSentQueue() {
    const messages = [...state.sent].sort((a, b) => b.createdAt - a.createdAt);
    if (!messages.length) {
        els.queueContent.innerHTML = `<div class="empty-state">No sent messages in this demo.</div>`;
        return;
    }

    els.queueContent.innerHTML = "";
    messages.forEach(message => els.queueContent.appendChild(createMessageCard(message, "sent")));
}

function createMessageCard(message, type) {
    const card = document.createElement("article");
    card.className = "message-card";
    const status = type === "held"
        ? message.ready ? "Ready for review" : `Unlocks ${formatTime(message.releaseAt)}`
        : `Sent ${formatTime(message.createdAt)}`;

    card.innerHTML = `
        <div class="held-meta">
            <strong>${escapeHtml(message.recipient)}</strong>
            <span>${escapeHtml(status)}</span>
        </div>
        <p class="message-text">${escapeHtml(message.text)}</p>
        ${type === "held" ? `
            <div class="message-actions">
                <button type="button" class="send-action">Send</button>
                <button type="button" class="edit-action">Edit</button>
                <button type="button" class="delete-action">Delete</button>
            </div>
        ` : ""}
    `;

    if (type === "held") {
        card.querySelector(".send-action").addEventListener("click", () => sendHeldMessage(message.id));
        card.querySelector(".edit-action").addEventListener("click", () => editHeldMessage(message.id));
        card.querySelector(".delete-action").addEventListener("click", () => deleteHeldMessage(message.id));
    }

    return card;
}

function renderMetrics() {
    els.riskModeLabel.textContent = state.protectionEnabled
        ? isRiskWindow() ? "Active" : "Standby"
        : "Off";
    els.protectedCountLabel.textContent = String(state.contacts.length);
    els.heldCountLabel.textContent = String(state.held.length);
}

function handleMessageSubmit(event) {
    event.preventDefault();
    const text = cleanText(els.messageInput.value);
    const recipient = els.recipientSelect.value;

    if (!text) {
        showToast("Write a message first.");
        return;
    }

    const message = makeMessage(text, recipient);
    const score = scoreMessage(text, recipient);
    const shouldIntercept = state.protectionEnabled
        && isProtectedRecipient(recipient)
        && (isRiskWindow() || score >= 45);

    if (!shouldIntercept) {
        sendMessage(message);
        els.messageInput.value = "";
        persistAndRender();
        showToast("Sent.");
        return;
    }

    pendingMessage = message;
    if (score >= 72 || state.checkMode !== "soft") {
        openChallenge(message, score);
    } else {
        holdMessage(message);
        els.messageInput.value = "";
        persistAndRender();
        showToast(`Held until ${formatTime(message.releaseAt)}.`);
    }
}

function makeMessage(text, recipient) {
    const now = Date.now();
    return {
        id: crypto.randomUUID ? crypto.randomUUID() : `${now}-${Math.random()}`,
        recipient,
        text,
        createdAt: now,
        releaseAt: now + state.delayMinutes * 60 * 1000,
        ready: false
    };
}

function openChallenge(message, score) {
    currentChallenge = buildChallenge(score);
    els.challengeTitle.textContent = currentChallenge.title;
    els.challengePrompt.textContent = currentChallenge.prompt;
    els.challengeInput.value = "";
    els.challengeFeedback.textContent = "";
    els.challengeDialog.showModal();
    setTimeout(() => els.challengeInput.focus(), 50);
}

function buildChallenge(score) {
    if (state.checkMode === "strict" || score >= 80) {
        return {
            title: "Read it back",
            prompt: "Type FUTURE ME FIRST to send right now.",
            expected: "future me first"
        };
    }

    if (state.checkMode === "steady") {
        return {
            title: "Steady check",
            prompt: "Type the recipient's name exactly.",
            expected: pendingMessage.recipient.toLowerCase()
        };
    }

    return {
        title: "One quick pause",
        prompt: "Type SEND to override the hold.",
        expected: "send"
    };
}

function tryChallengeSend() {
    if (!pendingMessage || !currentChallenge) return;

    const answer = cleanText(els.challengeInput.value).toLowerCase();
    if (answer !== currentChallenge.expected) {
        els.challengeFeedback.textContent = "That did not match.";
        return;
    }

    sendMessage(pendingMessage);
    closeChallenge();
    els.messageInput.value = "";
    persistAndRender();
    showToast("Sent after override.");
}

function holdPendingMessage() {
    if (!pendingMessage) return;
    const releaseAt = pendingMessage.releaseAt;
    holdMessage(pendingMessage);
    closeChallenge();
    els.messageInput.value = "";
    persistAndRender();
    showToast(`Held until ${formatTime(releaseAt)}.`);
}

function closeChallenge() {
    els.challengeDialog.close();
    pendingMessage = null;
    currentChallenge = null;
}

function holdMessage(message) {
    state.held.unshift(message);
}

function sendMessage(message) {
    state.sent.unshift({
        ...message,
        sentAt: Date.now(),
        ready: true
    });
}

function sendHeldMessage(id) {
    const message = state.held.find(item => item.id === id);
    if (!message) return;
    state.held = state.held.filter(item => item.id !== id);
    sendMessage(message);
    persistAndRender();
    showToast("Sent.");
}

function editHeldMessage(id) {
    const message = state.held.find(item => item.id === id);
    if (!message) return;
    state.held = state.held.filter(item => item.id !== id);
    els.recipientSelect.value = message.recipient;
    els.messageInput.value = message.text;
    persistAndRender();
    els.messageInput.focus();
    showToast("Draft moved back to composer.");
}

function deleteHeldMessage(id) {
    state.held = state.held.filter(item => item.id !== id);
    persistAndRender();
    showToast("Deleted.");
}

function resetDemo() {
    state = structuredClone(defaultState);
    saveState();
    renderAll();
    showToast("Demo reset.");
}

function scoreMessage(text, recipient) {
    const lower = text.toLowerCase();
    let score = 0;
    if (isProtectedRecipient(recipient)) score += 24;
    if (isRiskWindow()) score += 22;
    if (text.length > 140) score += 12;
    if ((text.match(/[!?]/g) || []).length >= 3) score += 10;
    if (/(.)\1{3,}/.test(lower)) score += 8;
    riskWords.forEach(word => {
        if (lower.includes(word)) score += 7;
    });
    return Math.min(100, score);
}

function isProtectedRecipient(recipient) {
    return state.contacts.some(contact => contact.toLowerCase() === String(recipient).toLowerCase());
}

function isRiskWindow(date = new Date()) {
    const now = date.getHours() * 60 + date.getMinutes();
    const start = timeToMinutes(state.startTime);
    const end = timeToMinutes(state.endTime);

    if (start === end) return true;
    if (start < end) return now >= start && now < end;
    return now >= start || now < end;
}

function timeToMinutes(value) {
    const [hours, minutes] = value.split(":").map(Number);
    return hours * 60 + minutes;
}

function cleanText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
}

function formatTime(timestamp) {
    return new Intl.DateTimeFormat([], {
        hour: "numeric",
        minute: "2-digit"
    }).format(new Date(timestamp));
}

function hashCode(value) {
    return String(value).split("").reduce((hash, char) => {
        return ((hash << 5) - hash) + char.charCodeAt(0);
    }, 0);
}

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    }[char]));
}

function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, "&#96;");
}

function showToast(message) {
    window.clearTimeout(toastTimer);
    els.toast.textContent = message;
    els.toast.classList.add("show");
    toastTimer = window.setTimeout(() => {
        els.toast.classList.remove("show");
    }, 2600);
}
