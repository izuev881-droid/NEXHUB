// assets/js/core/api.js — обёртка для вызовов API

import { state } from './state.js';

/**
 * Универсальный вызов API
 * @param {string} endpoint - имя эндпоинта (например 'login')
 * @param {string} method - 'GET' | 'POST'
 * @param {object|null} data - данные для отправки
 * @returns {Promise<any|null>} - data из ответа или null при ошибке
 */
export async function apiCall(endpoint, method, data) {
    if (method === undefined) method = 'GET';
    if (data === undefined) data = null;

    try {
        let url = state.API_URL + '?endpoint=' + endpoint;
        const opts = {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(15000)
        };

        if (data && method === 'POST') {
            opts.body = JSON.stringify(data);
        } else if (data && method === 'GET') {
            const params = new URLSearchParams(data);
            url += '&' + params.toString();
        }

        const r = await fetch(url, opts);
        const text = await r.text();

        // Иногда сервер возвращает HTML (например, при 500 ошибке)
        if (text.trim().startsWith('<')) {
            console.error('API returned HTML for', endpoint);
            return null;
        }

        let j;
        try {
            j = JSON.parse(text);
        } catch (parseError) {
            console.error('JSON parse error for', endpoint);
            return null;
        }

        if (!j.success) {
            // Некоторые эндпоинты могут "тихо" вернуть false — не спамим в консоль
            const silentEndpoints = [
                'toggleAttendance',
                'markMessagesRead',
                'getStudentInfiniteStatus',
                'getNewChatMessages',
                'getNewMessages'
            ];
            if (!silentEndpoints.includes(endpoint)) {
                console.warn('API Error:', endpoint, j.error);
            }
            return null;
        }

        return j.data;
    } catch (e) {
        console.error('API Error:', endpoint, e);
        return null;
    }
}

/**
 * Простой fetch, возвращающий распарсенный JSON (без обёртки)
 */
export async function fetchJson(url) {
    const r = await fetch(url);
    return r.json();
}

// Экспорт в window
window.apiCall = apiCall;
window.fetchJson = fetchJson;