// assets/js/modules/titles-editor.js — редактор титулов (админ)

import { state } from '../core/state.js';
import { apiCall } from '../core/api.js';
import { escapeHtml } from '../core/utils.js';
import { showToast, showModal, closeModal } from '../core/ui.js';

// ============================================================
// ФЛАГИ
// ============================================================
let titlesEditorInitDone = false;

// ============================================================
// НАЗВАНИЯ РЕДКОСТЕЙ
// ============================================================
export function getRarityName(rarity) {
    const names = {
        'common': 'Обычный',
        'rare': 'Редкий',
        'epic': 'Эпический',
        'legendary': 'Легендарный',
        'mythical': 'Мифический',
        'relic': 'Реликвия',
        'unique': 'Уникальный',
        'divine': 'Божественный',
        'cursed': 'Проклятый',
        'magical': 'Магический',
        'joker': 'Шутник',
        'elemental': 'Элементальный',
        'military': 'Военный',
        'festive': 'Праздничный',
        'seasonal': 'Сезонный',
        'tech': 'Технологический',
        'cosmic': 'Космический'
    };
    return names[rarity] || rarity.charAt(0).toUpperCase() + rarity.slice(1);
}

// ============================================================
// СПИСОК ТИТУЛОВ
// ============================================================
export async function renderAdminTitles() {
    const c = document.getElementById('adminTitlesList');
    if (!c) return;

    const titles = await apiCall('getTitles');

    // ⚡ Пустое состояние — БЕЗ кнопки "Создать первый титул"
    if (!titles || titles.length === 0) {
        c.innerHTML = '<div class="empty-state"><i class="fas fa-medal"></i><p>Нет титулов</p></div>';
        return;
    }

    let html = '';
    for (let i = 0; i < titles.length; i++) {
        const t = titles[i];
        const purchasableStatus = t.purchasable ? 'Доступен' : 'Недоступен';
        const purchasableClass = t.purchasable ? 'status-active' : 'status-inactive';

        html += '<div class="admin-title-item" data-title-id="' + t.id + '">' +
            '<div class="admin-title-header">' +
                '<div class="admin-title-info">' +
                    '<div class="admin-title-icon" style="font-size: 32px;">' + (t.icon || '⭐') + '</div>' +
                    '<span class="admin-title-name">' + escapeHtml(t.name) + '</span>' +
                    '<span class="admin-title-rarity ' + (t.rarity || 'common') + '">' + getRarityName(t.rarity || 'common').toUpperCase() + '</span>' +
                '</div>' +
                '<div class="admin-title-actions">' +
                    '<button class="admin-edit-btn" onclick="editTitle(' + t.id + ')"><i class="fas fa-edit"></i> Редактировать</button>' +
                    '<button class="admin-delete-btn" onclick="deleteTitleAdmin(' + t.id + ')"><i class="fas fa-trash"></i> Удалить</button>' +
                '</div>' +
            '</div>' +
            '<div class="admin-title-details">' +
                '<div class="admin-title-description">' + escapeHtml(t.description || 'Нет описания') + '</div>' +
                '<div class="admin-title-meta">' +
                    '<span><i class="fas fa-gem"></i> Цена: ' + t.price + ' 💎</span>' +
                    '<span><i class="fas fa-tag"></i> Цвет: <span style="display:inline-block;width:14px;height:14px;background:' + (t.color || '#9b4dff') + ';border-radius:50%;vertical-align:middle;margin-left:4px;"></span> ' + (t.color || '#9b4dff') + '</span>' +
                    '<span><i class="fas fa-palette"></i> Текст: ' + (t.text_color || '#ffffff') + '</span>' +
                    '<span class="' + purchasableClass + '"><i class="fas fa-' + (t.purchasable ? 'check-circle' : 'times-circle') + '"></i> ' + purchasableStatus + '</span>' +
                '</div>' +
                '<div style="display: flex; gap: 10px; margin-top: 16px; flex-wrap: wrap;">' +
                    '<button class="btn-small" onclick="toggleTitlePurchasable(' + t.id + ')">' + (t.purchasable ? '<i class="fas fa-lock"></i> Заблокировать' : '<i class="fas fa-lock-open"></i> Разблокировать') + '</button>' +
                '</div>' +
            '</div>' +
        '</div>';
    }
    c.innerHTML = html;
}

// ============================================================
// СОЗДАНИЕ ТИТУЛА
// ============================================================
export async function addTitle() {
    const name = document.getElementById('newTitleName') ? document.getElementById('newTitleName').value.trim() : '';
    const desc = document.getElementById('newTitleDescription') ? document.getElementById('newTitleDescription').value.trim() : '';
    const rarity = document.getElementById('newTitleRarity') ? document.getElementById('newTitleRarity').value : 'common';
    const color = document.getElementById('newTitleColor') ? document.getElementById('newTitleColor').value : '#9b4dff';
    const textColor = document.getElementById('newTitleTextColor') ? document.getElementById('newTitleTextColor').value : '#ffffff';
    const icon = document.getElementById('newTitleIcon') ? document.getElementById('newTitleIcon').value : '⭐';
    const price = parseInt(document.getElementById('newTitlePrice') ? document.getElementById('newTitlePrice').value : 0) || 0;

    if (!name) {
        showToast('Введите название титула', 'error');
        return;
    }

    const btn = document.getElementById('adminAddTitleBtn');
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Создание...';
    }

    try {
        const result = await apiCall('createTitle', 'POST', {
            name: name,
            description: desc,
            rarity: rarity,
            color: color,
            text_color: textColor,
            price: price,
            icon: icon,
            user_id: state.currentUser ? state.currentUser.id : 0,
            user_login: state.currentUser ? state.currentUser.login : ''
        });

        if (result) {
            showToast('✅ Титул "' + name + '" создан', 'success');
            closeModal('addTitleModal');

            await renderAdminTitles();
            if (typeof window.renderTitlesShop === 'function') await window.renderTitlesShop();

            const newTitleName = document.getElementById('newTitleName');
            const newTitleDescription = document.getElementById('newTitleDescription');
            const newTitleIcon = document.getElementById('newTitleIcon');
            const newTitlePrice = document.getElementById('newTitlePrice');
            if (newTitleName) newTitleName.value = '';
            if (newTitleDescription) newTitleDescription.value = '';
            if (newTitleIcon) newTitleIcon.value = '⭐';
            if (newTitlePrice) newTitlePrice.value = '';
        } else {
            showToast('❌ Ошибка при создании титула', 'error');
        }
    } catch (e) {
        console.error('addTitle error:', e);
        showToast('❌ Ошибка при создании', 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'Создать';
        }
    }
}

// ============================================================
// РЕДАКТИРОВАНИЕ ТИТУЛА
// ============================================================
export async function editTitle(titleId) {
    const titles = await apiCall('getTitles');
    let title = null;
    for (let i = 0; i < titles.length; i++) {
        if (titles[i].id == titleId) { title = titles[i]; break; }
    }
    if (!title) {
        showToast('Титул не найден', 'error');
        return;
    }

    const existingModal = document.getElementById('editTitleModal');
    if (existingModal) existingModal.remove();

    const rarityOptions = [
        'common', 'rare', 'epic', 'legendary', 'mythical', 'relic',
        'unique', 'divine', 'cursed', 'magical', 'joker', 'elemental',
        'military', 'festive', 'seasonal', 'tech', 'cosmic'
    ];
    const rarityNames = {
        'common': 'Обычный (Common)',
        'rare': 'Редкий (Rare)',
        'epic': 'Эпический (Epic)',
        'legendary': 'Легендарный (Legendary)',
        'mythical': 'Мифический (Mythical)',
        'relic': 'Реликвия (Relic)',
        'unique': 'Уникальный (Unique)',
        'divine': 'Божественный (Divine)',
        'cursed': 'Проклятый (Cursed)',
        'magical': 'Магический (Magical)',
        'joker': 'Шутник (Joker)',
        'elemental': 'Элементальный (Elemental)',
        'military': 'Военный (Military)',
        'festive': 'Праздничный (Festive)',
        'seasonal': 'Сезонный (Seasonal)',
        'tech': 'Технологический (Tech)',
        'cosmic': 'Космический (Cosmic)'
    };

    let rarityHtml = '';
    for (let r = 0; r < rarityOptions.length; r++) {
        const selected = title.rarity === rarityOptions[r] ? 'selected' : '';
        const displayName = rarityNames[rarityOptions[r]] || rarityOptions[r].charAt(0).toUpperCase() + rarityOptions[r].slice(1);
        rarityHtml += '<option value="' + rarityOptions[r] + '" ' + selected + '>' + displayName + '</option>';
    }

    const modalHtml = '<div class="modal active" id="editTitleModal">' +
        '<div class="modal-content" style="max-width: 550px;">' +
            '<div class="modal-header">' +
                '<h3><i class="fas fa-edit"></i> Редактировать титул</h3>' +
                '<button class="modal-close" id="editTitleModalClose">&times;</button>' +
            '</div>' +
            '<div class="modal-body">' +
                '<input type="text" id="editTitleName" value="' + escapeHtml(title.name) + '" placeholder="Название" style="margin-bottom: 12px;">' +
                '<input type="text" id="editTitleDescription" value="' + escapeHtml(title.description || '') + '" placeholder="Описание" style="margin-bottom: 12px;">' +
                '<select id="editTitleRarity" class="rarity-select" style="margin-bottom: 12px;">' + rarityHtml + '</select>' +
                '<div class="color-row" style="display: flex; gap: 12px; margin-bottom: 16px;">' +
                    '<div style="flex: 1;">' +
                        '<label style="display: block; font-size: 11px; color: var(--text-muted); margin-bottom: 6px;">Цвет обводки / фона</label>' +
                        '<input type="color" id="editTitleColor" value="' + (title.color || '#9b4dff') + '" style="width: 100%; height: 40px; padding: 5px; border-radius: 8px;">' +
                    '</div>' +
                    '<div style="flex: 1;">' +
                        '<label style="display: block; font-size: 11px; color: var(--text-muted); margin-bottom: 6px;">Цвет текста</label>' +
                        '<input type="color" id="editTitleTextColor" value="' + (title.text_color || '#ffffff') + '" style="width: 100%; height: 40px; padding: 5px; border-radius: 8px;">' +
                    '</div>' +
                '</div>' +
                '<div style="display: flex; gap: 12px; align-items: center; margin-bottom: 12px;">' +
                    '<input type="text" id="editTitleIcon" value="' + escapeHtml(title.icon || '⭐') + '" placeholder="Эмодзи" style="flex: 1;">' +
                    '<button type="button" id="editTitleEmojiBtn" style="padding: 10px 16px; background: rgba(155,77,255,0.1); border: 1px solid rgba(155,77,255,0.2); border-radius: 10px; color: white; cursor: pointer;"><i class="fas fa-smile"></i> Выбрать</button>' +
                '</div>' +
                '<input type="number" id="editTitlePrice" value="' + (title.price || 0) + '" placeholder="Цена" style="margin-bottom: 12px;">' +
                '<label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">' +
                    '<input type="checkbox" id="editTitlePurchasable" ' + (title.purchasable ? 'checked' : '') + '>' +
                    '<span>Доступен для покупки в магазине</span>' +
                '</label>' +
            '</div>' +
            '<div class="modal-footer">' +
                '<button class="btn-cancel" id="editTitleCancel">Отмена</button>' +
                '<button class="btn-primary" id="editTitleSave">Сохранить изменения</button>' +
            '</div>' +
        '</div>' +
    '</div>';

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const closeBtn = document.getElementById('editTitleModalClose');
    const cancelBtn = document.getElementById('editTitleCancel');
    const saveBtn = document.getElementById('editTitleSave');
    const modal = document.getElementById('editTitleModal');
    const emojiBtn = document.getElementById('editTitleEmojiBtn');
    const iconInput = document.getElementById('editTitleIcon');

    const closeModalFunc = function() { if (modal) modal.remove(); };

    if (closeBtn) closeBtn.addEventListener('click', closeModalFunc);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModalFunc);

    if (emojiBtn && iconInput && typeof window.showEmojiPicker === 'function') {
        emojiBtn.addEventListener('click', function() {
            window.showEmojiPicker(iconInput, function(emoji) {
                iconInput.value = emoji;
                showToast('✅ Эмодзи выбран: ' + emoji, 'success');
            });
        });
    }

    if (modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === modal) closeModalFunc();
        });
    }

    if (saveBtn) {
        saveBtn.onclick = async function() {
            const newName = document.getElementById('editTitleName').value.trim();
            if (!newName) { showToast('Введите название титула', 'error'); return; }

            const result = await apiCall('updateTitle', 'POST', {
                title_id: titleId,
                name: newName,
                description: document.getElementById('editTitleDescription').value || '',
                rarity: document.getElementById('editTitleRarity').value,
                color: document.getElementById('editTitleColor').value,
                text_color: document.getElementById('editTitleTextColor').value,
                price: parseInt(document.getElementById('editTitlePrice').value) || 0,
                icon: document.getElementById('editTitleIcon').value || '⭐',
                purchasable: document.getElementById('editTitlePurchasable').checked ? 1 : 0,
                user_id: state.currentUser ? state.currentUser.id : 0,
                user_login: state.currentUser ? state.currentUser.login : ''
            });

            if (result) {
                showToast('✅ Титул обновлён', 'success');
                closeModalFunc();
                await renderAdminTitles();
                if (typeof window.renderTitlesShop === 'function') await window.renderTitlesShop();
            } else {
                showToast('❌ Ошибка при обновлении титула', 'error');
            }
        };
    }
}

// ============================================================
// УДАЛЕНИЕ ТИТУЛА
// ============================================================
export async function deleteTitleAdmin(titleId) {
    if (!confirm('Удалить титул? Это действие нельзя отменить.')) return;

    const result = await apiCall('deleteTitle', 'POST', {
        title_id: titleId,
        user_id: state.currentUser ? state.currentUser.id : 0,
        user_login: state.currentUser ? state.currentUser.login : ''
    });

    if (result) {
        showToast('✅ Титул удалён', 'success');
        await renderAdminTitles();
        if (typeof window.renderTitlesShop === 'function') await window.renderTitlesShop();
    } else {
        showToast('❌ Ошибка при удалении титула', 'error');
    }
}

// ============================================================
// ПЕРЕКЛЮЧЕНИЕ ДОСТУПНОСТИ
// ============================================================
export async function toggleTitlePurchasable(titleId) {
    const result = await apiCall('toggleTitlePurchasable', 'POST', {
        title_id: titleId,
        user_id: state.currentUser ? state.currentUser.id : 0,
        user_login: state.currentUser ? state.currentUser.login : ''
    });

    if (result) {
        showToast('✅ Статус титула изменён', 'success');
        await renderAdminTitles();
        if (typeof window.renderTitlesShop === 'function') await window.renderTitlesShop();
    } else {
        showToast('❌ Ошибка', 'error');
    }
}

// ============================================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================================
export function initTitlesEditor() {
    if (titlesEditorInitDone) return;
    titlesEditorInitDone = true;

    // Кнопка "Создать титул" — открывает модалку
    const showAddTitleModal = document.getElementById('showAddTitleModal');
    if (showAddTitleModal) {
        const newBtn = showAddTitleModal.cloneNode(true);
        showAddTitleModal.parentNode.replaceChild(newBtn, showAddTitleModal);
        newBtn.addEventListener('click', function() { showModal('addTitleModal'); });
    }

    // Кнопка "Создать" внутри модалки
    const adminAddTitleBtn = document.getElementById('adminAddTitleBtn');
    if (adminAddTitleBtn) {
        const newBtn = adminAddTitleBtn.cloneNode(true);
        adminAddTitleBtn.parentNode.replaceChild(newBtn, adminAddTitleBtn);
        newBtn.addEventListener('click', addTitle);
    }

    // Emoji picker для нового титула
    const emojiBtn = document.getElementById('newTitleEmojiBtn');
    const iconInput = document.getElementById('newTitleIcon');
    if (emojiBtn && iconInput && typeof window.showEmojiPicker === 'function') {
        emojiBtn.onclick = function() {
            window.showEmojiPicker(iconInput, function(emoji) {
                iconInput.value = emoji;
                showToast('✅ Эмодзи выбран: ' + emoji, 'success');
            });
        };
    }
}

// ============================================================
// ЭКСПОРТ В WINDOW
// ============================================================
window.getRarityName = getRarityName;
window.renderAdminTitles = renderAdminTitles;
window.addTitle = addTitle;
window.editTitle = editTitle;
window.deleteTitleAdmin = deleteTitleAdmin;
window.toggleTitlePurchasable = toggleTitlePurchasable;
window.initTitlesEditor = initTitlesEditor;