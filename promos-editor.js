// assets/js/modules/promos-editor.js — редактор промокодов (админ)

import { state } from '../core/state.js';
import { apiCall } from '../core/api.js';
import { escapeHtml } from '../core/utils.js';
import { showToast, showModal, closeModal } from '../core/ui.js';

// ============================================================
// ФЛАГИ
// ============================================================
let promosEditorInitDone = false;

// ============================================================
// СПИСОК ПРОМОКОДОВ (красивый дизайн)
// ============================================================
export async function renderAdminPromos() {
    const c = document.getElementById('adminBonusList');
    if (!c) return;

    const p = await apiCall('getPromocodes');
    if (!p || p.length === 0) {
        c.innerHTML = '<div class="empty-state"><i class="fas fa-ticket-alt"></i><p>Нет промокодов</p></div>';
        return;
    }

    let html = '';
    for (let i = 0; i < p.length; i++) {
        const pr = p[i];

        // Прогресс использований
        const isInfinite = pr.max_uses <= 0;
        const percent = isInfinite ? 20 : Math.min(100, Math.round((pr.used_count / pr.max_uses) * 100));
        const isExhausted = !isInfinite && pr.used_count >= pr.max_uses;

        // Цвет прогресса
        let progressClass = 'low';
        if (isExhausted) progressClass = 'exhausted';
        else if (percent >= 80) progressClass = 'high';
        else if (percent >= 40) progressClass = 'mid';

        // Награды
        let rewardText = '';
        if (pr.reward_crystals > 0) {
            rewardText += '<span class="promo-reward-item crystals"><i class="fas fa-gem"></i> ' + pr.reward_crystals + '</span>';
        }
        if (pr.reward_exp > 0) {
            rewardText += '<span class="promo-reward-item exp"><i class="fas fa-star"></i> ' + pr.reward_exp + '</span>';
        }
        if (pr.title_id) {
            rewardText += '<span class="promo-reward-item title"><i class="fas fa-medal"></i> Тег</span>';
        }
        if (!rewardText) {
            rewardText = '<span class="promo-reward-item empty">Нет наград</span>';
        }

        // Статус
        const statusClass = pr.active ? 'active' : 'inactive';
        const statusText = pr.active ? 'Активен' : 'Отключён';
        const statusIcon = pr.active ? 'fa-check-circle' : 'fa-times-circle';

        html += '<div class="promo-card-admin ' + statusClass + '">' +
            // Левая часть — иконка подарка
            '<div class="promo-gift-icon">' +
                '<i class="fas fa-gift"></i>' +
            '</div>' +

            // Центральная часть
            '<div class="promo-body">' +
                '<div class="promo-header-row">' +
                    '<div class="promo-code-wrap">' +
                        '<span class="promo-code-label">ПРОМОКОД</span>' +
                        '<span class="promo-code-value" onclick="copyPromoCode(\'' + escapeHtml(pr.code) + '\', this)" title="Нажмите, чтобы скопировать">' +
                            escapeHtml(pr.code) +
                            '<i class="fas fa-copy copy-icon"></i>' +
                        '</span>' +
                    '</div>' +
                    '<span class="promo-status ' + statusClass + '">' +
                        '<i class="fas ' + statusIcon + '"></i> ' + statusText +
                    '</span>' +
                '</div>' +

                '<div class="promo-rewards-row">' +
                    rewardText +
                '</div>' +

                '<div class="promo-progress-wrap">' +
                    '<div class="promo-progress-header">' +
                        '<span class="promo-progress-label">' +
                            '<i class="fas fa-chart-line"></i> Использовано: ' +
                            '<strong>' + pr.used_count + '</strong> / ' + (isInfinite ? '∞' : pr.max_uses) +
                        '</span>' +
                        (isExhausted ? '<span class="promo-progress-note exhausted-note"><i class="fas fa-exclamation-triangle"></i> Исчерпан</span>' : '') +
                    '</div>' +
                    '<div class="promo-progress-bar">' +
                        '<div class="promo-progress-fill ' + progressClass + '" style="width: ' + percent + '%"></div>' +
                    '</div>' +
                '</div>' +
            '</div>' +

            // Правая часть — кнопки
            '<div class="promo-actions">' +
                '<button class="promo-btn toggle ' + (pr.active ? 'danger' : 'success') + '" ' +
                        'onclick="togglePromoAdmin(' + pr.id + ',\'' + escapeHtml(pr.code) + '\',' + pr.active + ')" ' +
                        'title="' + (pr.active ? 'Отключить' : 'Включить') + '">' +
                    '<i class="fas fa-' + (pr.active ? 'toggle-on' : 'toggle-off') + '"></i>' +
                    '<span>' + (pr.active ? 'Отключить' : 'Включить') + '</span>' +
                '</button>' +
                '<button class="promo-btn delete" ' +
                        'onclick="deletePromoAdmin(' + pr.id + ',\'' + escapeHtml(pr.code) + '\')" ' +
                        'title="Удалить">' +
                    '<i class="fas fa-trash"></i>' +
                    '<span>Удалить</span>' +
                '</button>' +
            '</div>' +
        '</div>';
    }
    c.innerHTML = html;
}

// ============================================================
// КОПИРОВАНИЕ ПРОМОКОДА
// ============================================================
export function copyPromoCode(code, element) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(code).then(function() {
            showToast('📋 Промокод "' + code + '" скопирован', 'success');
            if (element) {
                element.classList.add('copied');
                setTimeout(function() { element.classList.remove('copied'); }, 1000);
            }
        }).catch(function() {
            fallbackCopy(code, element);
        });
    } else {
        fallbackCopy(code, element);
    }
}

function fallbackCopy(code, element) {
    const ta = document.createElement('textarea');
    ta.value = code;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
        document.execCommand('copy');
        showToast('📋 Промокод "' + code + '" скопирован', 'success');
        if (element) {
            element.classList.add('copied');
            setTimeout(function() { element.classList.remove('copied'); }, 1000);
        }
    } catch (e) {
        showToast('Не удалось скопировать', 'error');
    }
    document.body.removeChild(ta);
}

// ============================================================
// СОЗДАНИЕ ПРОМОКОДА
// ============================================================
export async function addPromo() {
    const code = document.getElementById('newBonusCode') ? document.getElementById('newBonusCode').value.trim().toUpperCase() : '';
    const cr = parseInt(document.getElementById('newBonusReward') ? document.getElementById('newBonusReward').value : 0) || 0;
    const ex = parseInt(document.getElementById('newBonusExp') ? document.getElementById('newBonusExp').value : 0) || 0;
    const us = parseInt(document.getElementById('newBonusUses') ? document.getElementById('newBonusUses').value : 1) || 1;
    const titleId = document.getElementById('newBonusTitleId') ? (document.getElementById('newBonusTitleId').value || null) : null;

    if (!code) {
        showToast('Введите код промокода', 'error');
        return;
    }
    if (cr === 0 && ex === 0 && !titleId) {
        showToast('Укажите награду (кристаллы, опыт или тег)', 'error');
        return;
    }

    const btn = document.getElementById('adminAddBonusBtn');
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Создание...';
    }

    try {
        const r = await apiCall('addPromo', 'POST', {
            code: code,
            reward_crystals: cr,
            reward_exp: ex,
            max_uses: us,
            title_id: titleId,
            user_id: state.currentUser ? state.currentUser.id : 0,
            user_login: state.currentUser ? state.currentUser.login : ''
        });

        if (r) {
            showToast('✅ Промокод "' + code + '" создан!', 'success');
            closeModal('addPromoModal');

            const newBonusCode = document.getElementById('newBonusCode');
            const newBonusReward = document.getElementById('newBonusReward');
            const newBonusExp = document.getElementById('newBonusExp');
            const newBonusUses = document.getElementById('newBonusUses');
            if (newBonusCode) newBonusCode.value = '';
            if (newBonusReward) newBonusReward.value = '';
            if (newBonusExp) newBonusExp.value = '';
            if (newBonusUses) newBonusUses.value = '1';

            await renderAdminPromos();
        } else {
            showToast('❌ Ошибка при создании промокода', 'error');
        }
    } catch (e) {
        console.error('addPromo error:', e);
        showToast('❌ Ошибка при создании', 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'Создать';
        }
    }
}

// ============================================================
// ПЕРЕКЛЮЧЕНИЕ АКТИВНОСТИ
// ============================================================
export async function togglePromoAdmin(pid, pcode, cactive) {
    const result = await apiCall('togglePromo', 'POST', {
        promo_id: pid,
        user_id: state.currentUser ? state.currentUser.id : 0,
        user_login: state.currentUser ? state.currentUser.login : ''
    });

    if (result) {
        if (!cactive) {
            showToast('✅ Промокод "' + pcode + '" активирован', 'success');
        } else {
            showToast('🔒 Промокод "' + pcode + '" деактивирован', 'warning');
        }
        await renderAdminPromos();
    } else {
        showToast('❌ Ошибка при переключении', 'error');
    }
}

// ============================================================
// УДАЛЕНИЕ ПРОМОКОДА
// ============================================================
export async function deletePromoAdmin(pid, pcode) {
    if (!confirm('Удалить промокод "' + pcode + '"?')) return;

    const result = await apiCall('deletePromo', 'POST', {
        promo_id: pid,
        user_id: state.currentUser ? state.currentUser.id : 0,
        user_login: state.currentUser ? state.currentUser.login : ''
    });

    if (result) {
        showToast('🗑️ Промокод "' + pcode + '" удалён', 'success');
        await renderAdminPromos();
    } else {
        showToast('❌ Ошибка при удалении', 'error');
    }
}

// ============================================================
// ЗАГРУЗКА ТИТУЛОВ ДЛЯ SELECT
// ============================================================
export async function loadTitlesForPromoSelect() {
    const titles = await apiCall('getTitles');
    const select = document.getElementById('newBonusTitleId');
    if (select && titles) {
        let options = '<option value="">-- Тег (опционально) --</option>';
        for (let i = 0; i < titles.length; i++) {
            const t = titles[i];
            options += '<option value="' + t.id + '">' + t.icon + ' ' + escapeHtml(t.name) + ' (' + t.rarity + ')</option>';
        }
        select.innerHTML = options;
    }
}

// ============================================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================================
export function initPromosEditor() {
    if (promosEditorInitDone) return;
    promosEditorInitDone = true;

    // Кнопка "Создать промокод" — открывает модалку
    const showAddPromoModal = document.getElementById('showAddPromoModal');
    if (showAddPromoModal) {
        const newBtn = showAddPromoModal.cloneNode(true);
        showAddPromoModal.parentNode.replaceChild(newBtn, showAddPromoModal);
        newBtn.addEventListener('click', function() { showModal('addPromoModal'); });
    }

    // Кнопка "Создать" внутри модалки
    const adminAddBonusBtn = document.getElementById('adminAddBonusBtn');
    if (adminAddBonusBtn) {
        const newBtn = adminAddBonusBtn.cloneNode(true);
        adminAddBonusBtn.parentNode.replaceChild(newBtn, adminAddBonusBtn);
        newBtn.addEventListener('click', addPromo);
    }
}

// ============================================================
// ЭКСПОРТ В WINDOW
// ============================================================
window.renderAdminPromos = renderAdminPromos;
window.addPromo = addPromo;
window.togglePromoAdmin = togglePromoAdmin;
window.deletePromoAdmin = deletePromoAdmin;
window.loadTitlesForPromoSelect = loadTitlesForPromoSelect;
window.initPromosEditor = initPromosEditor;
window.copyPromoCode = copyPromoCode;