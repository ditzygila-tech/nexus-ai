// api.js - Handler call API untuk semua provider

/**
 * Memanggil API model tertentu
 * @param {string} providerKey - salah satu dari: openai, anthropic, deepseek, xai, gemini, mistral
 * @param {string} modelId - ID model yang akan dipanggil
 * @param {Array} messages - array pesan {role, content}
 * @param {string} apiKey - API key
 * @returns {Promise<string>} response text
 */
async function callModelAPI(providerKey, modelId, messages, apiKey) {
    const config = MODEL_CONFIGS[providerKey];
    if (!config) throw new Error(`Provider ${providerKey} tidak dikenal`);

    const headers = config.headers(apiKey);
    let endpoint, body;

    // Penanganan khusus Gemini (API key di URL)
    if (providerKey === "gemini") {
        endpoint = config.getEndpoint(modelId, apiKey);
        body = JSON.stringify(config.buildBody(messages, modelId));
    } else {
        endpoint = config.endpoint;
        body = JSON.stringify(config.buildBody(messages, modelId));
    }

    try {
        const response = await fetch(endpoint, {
            method: "POST",
            headers: headers,
            body: body
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText.substring(0, 200)}`);
        }

        const data = await response.json();
        const reply = config.parseResponse(data);
        if (!reply) throw new Error("Response kosong dari API");
        return reply;
    } catch (err) {
        console.error(`API error (${providerKey}):`, err);
        throw new Error(`${config.name} gagal: ${err.message}`);
    }
}