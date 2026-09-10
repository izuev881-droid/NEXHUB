// assets/js/modules/cursor.js — кастомный курсор

import { showToast } from '../core/ui.js';

export function initCustomCursor() {
    if (localStorage.getItem('shub_cursor_disabled') === 'true') return;

    const isTouchOnly = ('ontouchstart' in window) && !('onmousemove' in window);
    if (isTouchOnly) return;

    if (document.getElementById('customCursor')) return;

    const style = document.createElement('style');
    style.id = 'cursorStyle';
    style.textContent = 'body, body * { cursor: none !important; }';
    document.head.appendChild(style);

    const cursor = document.createElement('div');
    cursor.className = 'custom-cursor';
    cursor.id = 'customCursor';
    cursor.style.cssText = `
        position: fixed !important;
        pointer-events: none !important;
        z-index: 99999 !important;
        width: 24px !important;
        height: 24px !important;
        transform: translate(-50%, -50%) !important;
        transition: opacity 0.15s ease, transform 0.15s ease, width 0.2s ease, height 0.2s ease, border-color 0.3s ease, box-shadow 0.3s ease !important;
        will-change: transform !important;
        opacity: 1 !important;
        display: block !important;
        visibility: visible !important;
        border-radius: 50% !important;
        border: 1.5px solid rgba(255, 255, 255, 0.7) !important;
        box-shadow: 0 0 15px rgba(155, 77, 255, 0.2), inset 0 0 15px rgba(155, 77, 255, 0.03) !important;
        background: transparent !important;
        backdrop-filter: none !important;
        -webkit-backdrop-filter: none !important;
    `;

    const dot = document.createElement('div');
    dot.className = 'cursor-dot';
    dot.style.cssText = `
        position: absolute !important;
        top: 50% !important;
        left: 50% !important;
        transform: translate(-50%, -50%) !important;
        width: 3px !important;
        height: 3px !important;
        border-radius: 50% !important;
        background: radial-gradient(circle, #ffffff, #c44dff) !important;
        box-shadow: 0 0 8px rgba(155, 77, 255, 0.8), 0 0 16px rgba(155, 77, 255, 0.3) !important;
        transition: width 0.2s ease, height 0.2s ease, background 0.3s ease, box-shadow 0.3s ease !important;
        will-change: transform !important;
    `;
    cursor.appendChild(dot);

    const ring = document.createElement('div');
    ring.className = 'cursor-ring';
    ring.style.cssText = `
        position: absolute !important;
        top: 50% !important;
        left: 50% !important;
        transform: translate(-50%, -50%) !important;
        width: 100% !important;
        height: 100% !important;
        border-radius: 50% !important;
        border: 1px solid rgba(155, 77, 255, 0.12) !important;
        animation: cursorPulse 2.5s ease-in-out infinite !important;
        pointer-events: none !important;
        transition: border-color 0.3s ease !important;
        background: transparent !important;
    `;
    cursor.appendChild(ring);

    document.body.appendChild(cursor);

    const animStyle = document.createElement('style');
    animStyle.textContent = `
        @keyframes cursorPulse {
            0% { transform: translate(-50%, -50%) scale(1); opacity: 0.8; }
            50% { transform: translate(-50%, -50%) scale(1.6); opacity: 0.2; }
            100% { transform: translate(-50%, -50%) scale(1); opacity: 0.8; }
        }
        @keyframes cursorPulseFast {
            0% { transform: translate(-50%, -50%) scale(1); opacity: 0.8; }
            50% { transform: translate(-50%, -50%) scale(1.8); opacity: 0.1; }
            100% { transform: translate(-50%, -50%) scale(1); opacity: 0.8; }
        }
        .custom-cursor.clickable .cursor-ring {
            animation: cursorPulseFast 0.5s ease-in-out infinite !important;
            border-color: rgba(155, 77, 255, 0.4) !important;
        }
        .custom-cursor.text .cursor-ring {
            animation: cursorPulseFast 0.7s ease-in-out infinite !important;
            border-color: rgba(155, 77, 255, 0.3) !important;
        }
        .custom-cursor.click {
            transform: translate(-50%, -50%) scale(0.8) !important;
            transition: transform 0.05s ease !important;
        }
        .custom-cursor.click .cursor-dot {
            width: 5px !important;
            height: 5px !important;
            background: radial-gradient(circle, #ffffff, #d400ff) !important;
            box-shadow: 0 0 16px rgba(155, 77, 255, 1), 0 0 32px rgba(155, 77, 255, 0.5) !important;
        }
        .custom-cursor.clickable {
            border-color: rgba(155, 77, 255, 0.9) !important;
            box-shadow: 0 0 25px rgba(155, 77, 255, 0.4), inset 0 0 25px rgba(155, 77, 255, 0.08) !important;
            width: 28px !important;
            height: 28px !important;
            background: rgba(155, 77, 255, 0.04) !important;
        }
        .custom-cursor.text {
            border-color: rgba(155, 77, 255, 0.4) !important;
            box-shadow: 0 0 20px rgba(155, 77, 255, 0.15), inset 0 0 20px rgba(155, 77, 255, 0.03) !important;
            width: 18px !important;
            height: 18px !important;
            background: transparent !important;
        }
        .custom-cursor.text .cursor-dot {
            width: 2px !important;
            height: 2px !important;
        }
    `;
    document.head.appendChild(animStyle);

    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let rafId = null;
    let cursorVisible = true;

    function updateCursorPosition(e) {
        if (e && e.clientX !== undefined && e.clientY !== undefined) {
            mouseX = e.clientX;
            mouseY = e.clientY;
        }
        if (rafId === null) rafId = requestAnimationFrame(renderCursor);
    }

    function renderCursor() {
        if (cursor && cursorVisible) {
            cursor.style.left = mouseX + 'px';
            cursor.style.top = mouseY + 'px';
        }
        rafId = null;
    }

    function updateCursorType(e) {
        if (!cursor) return;
        const target = document.elementFromPoint(e.clientX, e.clientY);
        if (target) {
            const isClickable = target.matches('button, a, .menu-nav-link, .action-btn, .btn-add, .btn-primary, .btn-login, select, .student-card, .group-card, .chat-item, .admin-chat-item, .day-btn, .day-tab, .shop-item-new, .event-card, .leaderboard-item, .upload-image-btn, .buy-btn-new, .send-btn, input[type="submit"], .title-card, .chat-item-messenger, .person-item, .auth-tab, .modal-close, .btn-cancel, .notification-item, .messenger-tab, .filter-chip, .new-chat-btn, .send-message-btn, .admin-common-message-action, .messenger-action-btn, .participant-select-item, .logo-area-enhanced, .top-profile, .menu-close, .menu-logout-btn, .notifications-btn, .promo-input-group button, .week-selector .day-btn, .pair-card-new, .common-message-avatar, .password-tab, .admin-edit-btn, .admin-delete-btn, .group-change-select, .infinite-balance-label, .btn-clear, .btn-small, .btn-small-danger, .message-delete-btn, .theme-toggle-btn, .discord-menu-item, .discord-logo, .discord-profile-btn, .season-option, .season-toggle-btn, .discord-logout-btn, .messenger-image-btn, .messenger-file-btn, .messenger-send-btn, .common-chat-image-btn, .common-chat-file-btn, .auth-btn-login-new, .auth-tab-new, .season-option, .logout-header-btn');
            const isText = target.matches('input[type="text"], input[type="password"], input[type="number"], input[type="date"], input[type="time"], textarea, [contenteditable="true"], .messenger-input, .common-message-input textarea, .search-bar input, .promo-input-group input, .control-group input');

            cursor.classList.remove('clickable', 'text');
            if (isText) cursor.classList.add('text');
            else if (isClickable) cursor.classList.add('clickable');
        }
    }

    document.addEventListener('mousemove', function(e) {
        updateCursorPosition(e);
        updateCursorType(e);
    });

    document.addEventListener('mousedown', function() {
        if (cursor) {
            cursor.classList.add('click');
            setTimeout(function() { if (cursor) cursor.classList.remove('click'); }, 150);
        }
    });

    document.addEventListener('mouseleave', function() {
        cursorVisible = false;
        if (cursor) cursor.style.opacity = '0';
    });

    document.addEventListener('mouseenter', function(e) {
        cursorVisible = true;
        if (cursor) {
            cursor.style.opacity = '1';
            updateCursorPosition(e);
            updateCursorType(e);
        }
    });

    window.addEventListener('resize', function() {
        if (cursor) cursor.style.display = 'block';
    });

    // Shift+Escape — быстрое отключение курсора
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && e.shiftKey) {
            const disabled = localStorage.getItem('shub_cursor_disabled') === 'true';
            localStorage.setItem('shub_cursor_disabled', disabled ? 'false' : 'true');
            if (!disabled) {
                const s = document.getElementById('cursorStyle');
                if (s) s.remove();
                const cur = document.getElementById('customCursor');
                if (cur) cur.remove();
                document.body.style.cursor = '';
                showToast('🖱️ Курсор отключен (Shift+Escape для включения)', 'info');
            } else {
                document.body.style.cursor = 'none';
                initCustomCursor();
                showToast('🖱️ Курсор включен', 'success');
            }
        }
    });

    setTimeout(function() {
        const checkCursor = document.getElementById('customCursor');
        if (!checkCursor && !localStorage.getItem('shub_cursor_disabled')) {
            const existingStyle = document.getElementById('cursorStyle');
            if (existingStyle) existingStyle.remove();
            initCustomCursor();
        }
    }, 2000);
}

window.initCustomCursor = initCustomCursor;