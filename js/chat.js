// chat.js - NexusAI full logic v2
// Supports: 6 models, API key modal, compare mode, chat history, export, etc.

document.addEventListener("DOMContentLoaded", () => {
    // ---------- DOM Elements ----------
    const modal = document.getElementById("apiModal");
    const saveKeysBtn = document.getElementById("saveKeys");
    const rememberCheck = document.getElementById("rememberKeys");
    const app = document.getElementById("app");
    const modelSwitcher = document.getElementById("modelSwitcher");
    const modelPills = document.querySelectorAll(".model-pill");
    const compareToggle = document.getElementById("compareToggle");
    const comparePanel = document.getElementById("comparePanel");
    const closeCompare = document.getElementById("closeCompare");
    const compareGrid = document.getElementById("compareGrid");
    const messagesList = document.getElementById("messagesList");
    const emptyState = document.getElementById("emptyState");
    const typingIndicator = document.getElementById("typingIndicator");
    const typingLabel = document.getElementById("typingLabel");
    const userInput = document.getElementById("userInput");
    const sendBtn = document.getElementById("sendBtn");
    const charCount = document.getElementById("charCount");
    const currentModelLabel = document.getElementById("currentModelLabel");
    const exportChatBtn = document.getElementById("exportChat");
    const newChatBtn = document.getElementById("newChatBtn");
    const clearAllBtn = document.getElementById("clearAll");
    const openKeysBtn = document.getElementById("openKeys");
    const sidebarToggle = document.getElementById("sidebarToggle");
    const sidebar = document.getElementById("sidebar");
    const chatList = document.getElementById("chatList");
    const searchChats = document.getElementById("searchChats");

    // Sidebar model info
    const smiDot = document.getElementById("smiDot");
    const smiName = document.getElementById("smiName");
    const smiMaker = document.getElementById("smiMaker");

    // ---------- State ----------
    let currentChatId = null;           // ID chat aktif
    let chats = [];                     // array of { id, title, model, messages, timestamp }
    let currentModel = "gpt-4o";        // model ID (dari data-model)
    let compareMode = false;
    let lastCompareQuestion = "";
    let allApiKeys = {                  // from localStorage
        openai: "", anthropic: "", deepseek: "", xai: "", gemini: "", mistral: ""
    };

    // ---------- Local Storage Helpers ----------
    function loadKeysFromStorage() {
        const saved = localStorage.getItem("nexusai_keys");
        if (saved) {
            try {
                const obj = JSON.parse(saved);
                Object.assign(allApiKeys, obj);
                // isi input fields di modal
                document.getElementById("key-openai").value = allApiKeys.openai || "";
                document.getElementById("key-anthropic").value = allApiKeys.anthropic || "";
                document.getElementById("key-deepseek").value = allApiKeys.deepseek || "";
                document.getElementById("key-xai").value = allApiKeys.xai || "";
                document.getElementById("key-gemini").value = allApiKeys.gemini || "";
                document.getElementById("key-mistral").value = allApiKeys.mistral || "";
            } catch(e) {}
        }
    }

    function saveKeysToStorage() {
        if (rememberCheck.checked) {
            localStorage.setItem("nexusai_keys", JSON.stringify(allApiKeys));
        } else {
            localStorage.removeItem("nexusai_keys");
        }
    }

    function loadChatsFromStorage() {
        const saved = localStorage.getItem("nexusai_chats");
        if (saved) {
            try {
                chats = JSON.parse(saved);
                renderChatList();
                if (chats.length > 0) {
                    loadChat(chats[0].id);
                } else {
                    newChat();
                }
            } catch(e) { newChat(); }
        } else {
            newChat();
        }
    }

    function saveChatsToStorage() {
        localStorage.setItem("nexusai_chats", JSON.stringify(chats));
    }

    // ---------- Chat CRUD ----------
    function newChat() {
        const id = Date.now().toString();
        const newChatObj = {
            id: id,
            title: "New conversation",
            model: currentModel,
            messages: [],
            timestamp: Date.now()
        };
        chats.unshift(newChatObj);
        saveChatsToStorage();
        renderChatList();
        loadChat(id);
    }

    function loadChat(chatId) {
        const chat = chats.find(c => c.id === chatId);
        if (!chat) return;
        currentChatId = chatId;
        currentModel = chat.model;
        // update UI pill active
        updateActivePill(currentModel);
        // render messages
        renderMessages(chat.messages);
        updateEmptyState(chat.messages.length === 0);
        updateSidebarModelInfo();
        // update title input (optional, but we don't have title inline)
    }

    function addMessage(chatId, role, content) {
        const chat = chats.find(c => c.id === chatId);
        if (!chat) return;
        chat.messages.push({ role, content, timestamp: Date.now() });
        if (chat.messages.length === 1 && role === "user") {
            // generate title from first user message
            chat.title = content.substring(0, 40) + (content.length > 40 ? "..." : "");
        }
        saveChatsToStorage();
        renderChatList();
        if (chatId === currentChatId) {
            renderMessages(chat.messages);
            updateEmptyState(false);
        }
    }

    function updateMessagesInCurrentChat(messages) {
        const chat = chats.find(c => c.id === currentChatId);
        if (chat) {
            chat.messages = messages;
            saveChatsToStorage();
            renderMessages(messages);
            updateEmptyState(messages.length === 0);
        }
    }

    function deleteChat(chatId) {
        chats = chats.filter(c => c.id !== chatId);
        saveChatsToStorage();
        if (currentChatId === chatId) {
            if (chats.length > 0) loadChat(chats[0].id);
            else newChat();
        }
        renderChatList();
    }

    function clearAllChats() {
        if (confirm("Delete all conversations?")) {
            chats = [];
            saveChatsToStorage();
            newChat();
        }
    }

    // ---------- Render Messages ----------
    function renderMessages(messages) {
        messagesList.innerHTML = "";
        if (!messages.length) return;
        messages.forEach(msg => {
            const div = document.createElement("div");
            div.className = `message-bubble ${msg.role === "user" ? "user" : "assistant"}`;
            div.innerHTML = `
                <div class="msg-avatar">${msg.role === "user" ? "👤" : "🤖"}</div>
                <div class="msg-content">${escapeHtml(msg.content)}</div>
            `;
            messagesList.appendChild(div);
        });
        messagesList.scrollTop = messagesList.scrollHeight;
    }

    function updateEmptyState(isEmpty) {
        if (isEmpty && (!messagesList || messagesList.children.length === 0)) {
            emptyState.style.display = "flex";
        } else {
            emptyState.style.display = "none";
        }
    }

    // ---------- Send Message (normal or compare) ----------
    async function sendMessage() {
        let prompt = userInput.value.trim();
        if (!prompt) return;

        if (compareMode) {
            await sendCompare(prompt);
            return;
        }

        // Add user message
        addMessage(currentChatId, "user", prompt);
        userInput.value = "";
        updateCharCount();

        // Show typing indicator
        showTyping(getProviderName(currentModel));

        try {
            const { provider, modelId } = MODEL_MAP[currentModel];
            const apiKey = allApiKeys[provider];
            if (!apiKey) throw new Error(`API key untuk ${provider} belum diisi. Buka kunci 🔑 di sidebar.`);

            const chat = chats.find(c => c.id === currentChatId);
            const conversation = chat.messages.filter(m => m.role !== "system").map(m => ({
                role: m.role,
                content: m.content
            }));

            const reply = await callModelAPI(provider, modelId, conversation, apiKey);
            hideTyping();
            addMessage(currentChatId, "assistant", reply);
        } catch (err) {
            hideTyping();
            addMessage(currentChatId, "assistant", `❌ Error: ${err.message}`);
        }
    }

    async function sendCompare(question) {
        lastCompareQuestion = question;
        compareGrid.innerHTML = "";
        comparePanel.style.display = "flex";
        // get all models that have keys
        const activeModels = [];
        for (const pill of modelPills) {
            const modelId = pill.dataset.model;
            const { provider } = MODEL_MAP[modelId];
            if (allApiKeys[provider]) {
                activeModels.push({ modelId, provider, name: pill.querySelector(".pill-name").innerText });
            }
        }
        if (activeModels.length === 0) {
            alert("No API keys found. Please save keys first.");
            comparePanel.style.display = "none";
            return;
        }

        // create loading cards
        for (const m of activeModels) {
            const card = document.createElement("div");
            card.className = "compare-card";
            card.innerHTML = `
                <div class="compare-card-header">
                    <span class="compare-model-name">${m.name}</span>
                    <div class="compare-spinner"></div>
                </div>
                <div class="compare-card-content">Thinking...</div>
            `;
            compareGrid.appendChild(card);
        }

        // fetch all in parallel
        const promises = activeModels.map(async (m, idx) => {
            try {
                const conversation = [{ role: "user", content: question }];
                const reply = await callModelAPI(m.provider, m.modelId, conversation, allApiKeys[m.provider]);
                return { idx, reply, error: null };
            } catch (err) {
                return { idx, reply: null, error: err.message };
            }
        });
        const results = await Promise.all(promises);
        for (const res of results) {
            const card = compareGrid.children[res.idx];
            if (res.error) {
                card.querySelector(".compare-card-content").innerHTML = `<span class="error">❌ ${escapeHtml(res.error)}</span>`;
            } else {
                card.querySelector(".compare-card-content").innerHTML = escapeHtml(res.reply);
            }
            card.querySelector(".compare-spinner")?.remove();
        }
    }

    // ---------- UI Helpers ----------
    function updateActivePill(modelId) {
        modelPills.forEach(pill => {
            if (pill.dataset.model === modelId) {
                pill.classList.add("active");
            } else {
                pill.classList.remove("active");
            }
        });
        updateSidebarModelInfo();
        const { provider } = MODEL_MAP[modelId];
        const config = MODEL_CONFIGS[provider];
        currentModelLabel.innerText = `${config.name} · ${provider}`;
    }

    function updateSidebarModelInfo() {
        const { provider } = MODEL_MAP[currentModel];
        const config = MODEL_CONFIGS[provider];
        smiName.innerText = config.name;
        smiMaker.innerText = provider;
        const colors = { openai: "#10b981", anthropic: "#f97316", deepseek: "#00b4ff", xai: "#ff5f7e", gemini: "#a78bfa", mistral: "#ffc947" };
        smiDot.style.backgroundColor = colors[provider] || "#fff";
    }

    function getProviderName(modelId) {
        const { provider } = MODEL_MAP[modelId];
        return MODEL_CONFIGS[provider].name;
    }

    function showTyping(modelName) {
        typingLabel.innerText = `${modelName} is thinking...`;
        typingIndicator.style.display = "flex";
        messagesList.scrollTop = messagesList.scrollHeight;
    }

    function hideTyping() {
        typingIndicator.style.display = "none";
    }

    function updateCharCount() {
        charCount.innerText = userInput.value.length;
        sendBtn.disabled = userInput.value.trim().length === 0;
    }

    function escapeHtml(str) {
        return str.replace(/[&<>]/g, function(m) {
            if (m === '&') return '&amp;';
            if (m === '<') return '&lt;';
            if (m === '>') return '&gt;';
            return m;
        });
    }

    function renderChatList() {
        const searchTerm = searchChats.value.toLowerCase();
        const filtered = chats.filter(c => c.title.toLowerCase().includes(searchTerm));
        chatList.innerHTML = `<div class="chat-list-label mono">Recent</div>`;
        filtered.forEach(chat => {
            const div = document.createElement("div");
            div.className = `chat-item ${chat.id === currentChatId ? "active" : ""}`;
            div.innerHTML = `
                <div class="chat-item-title">${escapeHtml(chat.title)}</div>
                <button class="chat-delete" data-id="${chat.id}">✕</button>
            `;
            div.addEventListener("click", (e) => {
                if (e.target.classList.contains("chat-delete")) return;
                loadChat(chat.id);
            });
            const delBtn = div.querySelector(".chat-delete");
            delBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                deleteChat(chat.id);
            });
            chatList.appendChild(div);
        });
    }

    function exportCurrentChat() {
        const chat = chats.find(c => c.id === currentChatId);
        if (!chat || chat.messages.length === 0) {
            alert("No messages to export");
            return;
        }
        const text = chat.messages.map(m => `${m.role.toUpperCase()}:\n${m.content}\n`).join("\n---\n");
        const blob = new Blob([text], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `nexusai-chat-${currentChatId}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    }

    // ---------- Event Listeners ----------
    // Modal keys
    if (saveKeysBtn) {
        saveKeysBtn.addEventListener("click", () => {
            allApiKeys.openai = document.getElementById("key-openai").value.trim();
            allApiKeys.anthropic = document.getElementById("key-anthropic").value.trim();
            allApiKeys.deepseek = document.getElementById("key-deepseek").value.trim();
            allApiKeys.xai = document.getElementById("key-xai").value.trim();
            allApiKeys.gemini = document.getElementById("key-gemini").value.trim();
            allApiKeys.mistral = document.getElementById("key-mistral").value.trim();
            saveKeysToStorage();
            modal.style.display = "none";
            app.style.filter = "none";
            showToast("API keys saved locally");
        });
    }

    document.querySelectorAll(".key-toggle").forEach(btn => {
        btn.addEventListener("click", () => {
            const targetId = btn.dataset.target;
            const input = document.getElementById(targetId);
            if (input.type === "password") input.type = "text";
            else input.type = "password";
        });
    });

    openKeysBtn?.addEventListener("click", () => {
        modal.style.display = "flex";
        app.style.filter = "blur(4px)";
    });

    // Model switching
    modelPills.forEach(pill => {
        pill.addEventListener("click", () => {
            const newModel = pill.dataset.model;
            if (newModel === currentModel) return;
            currentModel = newModel;
            // update current chat's model
            const chat = chats.find(c => c.id === currentChatId);
            if (chat) chat.model = currentModel;
            saveChatsToStorage();
            updateActivePill(currentModel);
        });
    });

    // Compare mode toggle
    compareToggle?.addEventListener("click", () => {
        compareMode = !compareMode;
        compareToggle.classList.toggle("active", compareMode);
        if (!compareMode) comparePanel.style.display = "none";
    });
    closeCompare?.addEventListener("click", () => {
        compareMode = false;
        compareToggle.classList.remove("active");
        comparePanel.style.display = "none";
    });

    // Input handlers
    userInput.addEventListener("input", updateCharCount);
    userInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    sendBtn.addEventListener("click", sendMessage);

    // Sidebar and misc
    sidebarToggle?.addEventListener("click", () => sidebar.classList.toggle("collapsed"));
    newChatBtn?.addEventListener("click", newChat);
    clearAllBtn?.addEventListener("click", clearAllChats);
    exportChatBtn?.addEventListener("click", exportCurrentChat);
    searchChats?.addEventListener("input", renderChatList);

    // Suggestions
    document.querySelectorAll(".suggestion-chip").forEach(chip => {
        chip.addEventListener("click", () => {
            userInput.value = chip.dataset.prompt;
            updateCharCount();
            sendMessage();
        });
    });

    function showToast(msg) {
        const toast = document.getElementById("toast");
        toast.innerText = msg;
        toast.classList.add("show");
        setTimeout(() => toast.classList.remove("show"), 3000);
    }

    // Initialization
    loadKeysFromStorage();
    loadChatsFromStorage();
    updateActivePill(currentModel);
    if (modal) {
        if (Object.values(allApiKeys).some(k => k)) {
            modal.style.display = "none";
        } else {
            modal.style.display = "flex";
            app.style.filter = "blur(4px)";
        }
    }
    updateCharCount();
});