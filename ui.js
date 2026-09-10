// assets/js/core/ui.js — toast-уведомления, модалки

import { escapeHtml } from './utils.js';

/**
 * Показ toast-уведомления
 * @param {string} text - текст сообщения
 * @param {string} type - 'success' | 'error' | 'warning' | 'info'
 */
export function showToast(text, type) {
    if (type === undefined) type = 'success';

    let c = document.getElementById('toastContainer');
    if (!c) {
        c = document.createElement('div');
        c.id = 'toastContainer';
        c.style.cssText = 'position:fixed;bottom:30px;left:50%;transform:translateX(-50%);z-index:9999;display:flex;flex-direction:column;gap:10px;align-items:center;pointer-events:none;';
        document.body.appendChild(c);
    }

    const t = document.createElement('div');
    t.className = 'toast ' + type;

    let i;
    if (type === 'success') i = 'check-circle';
    else if (type === 'error') i = 'exclamation-circle';
    else if (type === 'warning') i = 'exclamation-triangle';
    else i = 'info-circle';

    t.innerHTML = '<i class="fas fa-' + i + '"></i> ' + escapeHtml(text);
    c.appendChild(t);

    setTimeout(function() {
        t.style.opacity = '0';
        t.style.transform = 'translateY(20px)';
        setTimeout(function() { if (t && t.remove) t.remove(); }, 300);
    }, 3500);
}

/**
 * Открыть модалку по id
 */
export function showModal(id) {
    const m = document.getElementById(id);
    if (m) m.classList.add('active');
}

/**
 * Закрыть модалку по id
 */
export function closeModal(id) {
    const m = document.getElementById(id);
    if (m) m.classList.remove('active');
}

// Экспорт в window
window.showToast = showToast;
window.showModal = showModal;
window.closeModal = closeModal;