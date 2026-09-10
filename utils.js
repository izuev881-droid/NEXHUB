// assets/js/core/utils.js — утилиты: экранирование, форматирование, проверки

import { state } from './state.js';

/**
 * Экранирование HTML (защита от XSS)
 */
export function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        if (m === '"') return '&quot;';
        if (m === "'") return '&#039;';
        return m;
    });
}

/**
 * Форматирование времени "HH:MM:SS" -> "HH:MM"
 */
export function formatTime(timeString) {
    if (!timeString) return '';
    const parts = timeString.split(':');
    if (parts.length >= 2) return parts[0] + ':' + parts[1];
    return timeString;
}

/**
 * Форматирование даты и времени: "10.09.2026, 13:02"
 */
export function formatDateTime(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleString('ru-RU', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit'
    });
}

/**
 * Только время: "13:02"
 */
export function formatTimeOnly(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Только дата: "Сегодня" или "10 сентября"
 */
export function formatDateOnly(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    const today = new Date();
    if (date.toDateString() === today.toDateString()) return 'Сегодня';
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}

/**
 * Форматирование размера файла: "1.5 MB"
 */
export function formatFileSizeDisplay(bytes) {
    if (!bytes) return '';
    if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(2) + ' GB';
    if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
    if (bytes >= 1024) return (bytes / 1024).toFixed(0) + ' KB';
    return bytes + ' B';
}

/**
 * Иконка Font Awesome по расширению файла
 */
export function getFileIconByName(filename) {
    const ext = (filename.split('.').pop() || '').toLowerCase();
    const icons = {
        'pdf': 'fa-file-pdf',
        'doc': 'fa-file-word', 'docx': 'fa-file-word',
        'xls': 'fa-file-excel', 'xlsx': 'fa-file-excel',
        'ppt': 'fa-file-powerpoint', 'pptx': 'fa-file-powerpoint',
        'jpg': 'fa-file-image', 'jpeg': 'fa-file-image',
        'png': 'fa-file-image', 'gif': 'fa-file-image', 'webp': 'fa-file-image',
        'mp4': 'fa-file-video', 'avi': 'fa-file-video',
        'mov': 'fa-file-video', 'mkv': 'fa-file-video',
        'mp3': 'fa-file-audio', 'wav': 'fa-file-audio', 'flac': 'fa-file-audio',
        'zip': 'fa-file-archive', 'rar': 'fa-file-archive', '7z': 'fa-file-archive',
        'txt': 'fa-file-alt',
        'html': 'fa-file-code', 'css': 'fa-file-code',
        'js': 'fa-file-code', 'php': 'fa-file-code'
    };
    return icons[ext] || 'fa-file';
}

/**
 * Скачивание файла по URL
 */
export function downloadFile(url, filename) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

/**
 * Проверка на мат (грубый фильтр)
 */
export function containsProfanity(text) {
    if (!text) return false;
    const lower = text.toLowerCase();
    const badWords = [
        'хуй','хуя','хую','хуё','хуи','хуем','хуе','хуёвый','хуйня','хуйло',
        'пизд','пизда','пизде','пизду','пиздой','пиздец','пиздешь','пиздеть',
        'бля','блять','блядь','бляди','блядью','блядский',
        'еба','ебу','ебал','ебать','ебаться','ебёт','еби','ебла','ебли','ебло',
        'заеб','заеба','заебал','заебать','заебаться','заебу','заебись',
        'нахуй','нахуя','охуел','охуеть','охуенный','похуй','похуизм','похую',
        'мудак','мудака','мудило','пидор','пидора','пидору','пидорас',
        'гандон','гандоны','лох','лоха','лоху','лошара','чмо','чмом',
        'шлюха','шлюхи','шлюшка','сука','суки','суку','сучка',
        'тварь','твари','ублюдок','ублюдка','дебил','дебила','дебильный',
        'даун','дауны','идиот','идиота','идиотизм','кретин','кретина',
        'придурок','придурки','дурак','дурака','тупица','тупой',
        'fuck','fucking','shit','bitch','asshole','dick','cunt','cock'
    ];
    for (let i = 0; i < badWords.length; i++) {
        if (lower.indexOf(badWords[i]) !== -1) return true;
    }
    const patterns = [
        /[хx][уy][йj]/i,
        /[пp][иi][з3z][дd]/i,
        /[бb][лl][яa][тt]?/i,
        /[еe][бb][аa][тt]?/i,
        /[нn][аa][хx][уy][йj]/i,
        /[пp][оo][хx][уy]/i,
        /[мm][уy][дd][аa][кk]/i,
        /[пp][иi][дd][оo][рp]/i,
        /[лl][оo][хx]/i,
        /[сc][уy][кk][аa]/i,
        /[тt][вv][аa][рp][ьь]?/i
    ];
    for (let p = 0; p < patterns.length; p++) {
        if (patterns[p].test(lower)) return true;
    }
    return false;
}

/**
 * Информация о наличии товара
 */
export function getStockInfo(s) {
    if (s === -1) return { class: 'stock-infinite', text: '♾️ Бесконечно' };
    if (s === 0) return { class: 'stock-zero', text: '❌ Нет в наличии' };
    if (s <= 5) return { class: 'stock-low', text: '⚠️ Осталось: ' + s + ' шт.' };
    return { class: 'stock-normal', text: '📦 В наличии: ' + s + ' шт.' };
}

/**
 * Проверка, является ли текущий пользователь админом или основателем
 */
export function isAdminOrFounder() {
    return state.currentUser && (state.currentUser.role === 'admin' || state.currentUser.role === 'founder');
}

// Экспорт в window для inline-обработчиков
window.escapeHtml = escapeHtml;
window.formatTime = formatTime;
window.formatDateTime = formatDateTime;
window.formatTimeOnly = formatTimeOnly;
window.formatDateOnly = formatDateOnly;
window.formatFileSizeDisplay = formatFileSizeDisplay;
window.getFileIconByName = getFileIconByName;
window.downloadFile = downloadFile;
window.containsProfanity = containsProfanity;
window.getStockInfo = getStockInfo;
window.isAdminOrFounder = isAdminOrFounder;