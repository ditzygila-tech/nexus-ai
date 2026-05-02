// config.js - Konfigurasi endpoint, model, dan parser untuk 6 provider

const MODEL_CONFIGS = {
    openai: {
        name: "OpenAI",
        endpoint: "https://api.openai.com/v1/chat/completions",
        defaultModel: "gpt-4o-mini",
        headers: (apiKey) => ({
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
        }),
        buildBody: (messages, modelId) => ({
            model: modelId,
            messages: messages,
            temperature: 0.7
        }),
        parseResponse: (data) => data.choices[0]?.message?.content || "No response"
    },
    anthropic: {
        name: "Anthropic",
        endpoint: "https://api.anthropic.com/v1/messages",
        defaultModel: "claude-3-haiku-20240307",
        headers: (apiKey) => ({
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01"
        }),
        buildBody: (messages, modelId) => {
            let systemMsg = null;
            const filtered = messages.filter(msg => {
                if (msg.role === "system") {
                    systemMsg = msg.content;
                    return false;
                }
                return true;
            });
            return {
                model: modelId,
                messages: filtered,
                system: systemMsg,
                max_tokens: 1024,
                temperature: 0.7
            };
        },
        parseResponse: (data) => data.content[0]?.text || "Empty response"
    },
    deepseek: {
        name: "DeepSeek",
        endpoint: "https://api.deepseek.com/v1/chat/completions",
        defaultModel: "deepseek-chat",
        headers: (apiKey) => ({
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
        }),
        buildBody: (messages, modelId) => ({
            model: modelId,
            messages: messages,
            temperature: 0.7
        }),
        parseResponse: (data) => data.choices[0]?.message?.content || ""
    },
    xai: {
        name: "xAI",
        endpoint: "https://api.x.ai/v1/chat/completions",
        defaultModel: "grok-beta",
        headers: (apiKey) => ({
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
        }),
        buildBody: (messages, modelId) => ({
            model: modelId,
            messages: messages,
            temperature: 0.7
        }),
        parseResponse: (data) => data.choices[0]?.message?.content || ""
    },
    gemini: {
        name: "Google Gemini",
        endpoint: `https://generativelanguage.googleapis.com/v1beta/models/`,
        defaultModel: "gemini-1.5-pro",
        headers: () => ({ "Content-Type": "application/json" }),
        buildBody: (messages, modelId) => {
            // Gemini format: contents array
            const contents = messages.map(m => ({
                role: m.role === "assistant" ? "model" : "user",
                parts: [{ text: m.content }]
            }));
            return { contents };
        },
        parseResponse: (data) => data.candidates?.[0]?.content?.parts?.[0]?.text || "No response",
        // Special endpoint builder because API key is in URL
        getEndpoint: (modelId, apiKey) => `${MODEL_CONFIGS.gemini.endpoint}${modelId}:generateContent?key=${apiKey}`
    },
    mistral: {
        name: "Mistral AI",
        endpoint: "https://api.mistral.ai/v1/chat/completions",
        defaultModel: "mistral-large-latest",
        headers: (apiKey) => ({
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
        }),
        buildBody: (messages, modelId) => ({
            model: modelId,
            messages: messages,
            temperature: 0.7
        }),
        parseResponse: (data) => data.choices[0]?.message?.content || ""
    }
};

// Mapping dari model ID di HTML ke provider & model name
const MODEL_MAP = {
    "gpt-4o": { provider: "openai", modelId: "gpt-4o-mini" },
    "claude-3-5-sonnet-20241022": { provider: "anthropic", modelId: "claude-3-5-sonnet-20241022" },
    "deepseek-chat": { provider: "deepseek", modelId: "deepseek-chat" },
    "grok-2-latest": { provider: "xai", modelId: "grok-2-latest" },
    "gemini-1.5-pro": { provider: "gemini", modelId: "gemini-1.5-pro" },
    "mistral-large-latest": { provider: "mistral", modelId: "mistral-large-latest" }
};