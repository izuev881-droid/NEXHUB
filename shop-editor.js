// assets/js/modules/shop-editor.js — редактор магазина (админ)

import { state } from '../core/state.js';
import { apiCall } from '../core/api.js';
import { escapeHtml } from '../core/utils.js';
import { showToast } from '../core/ui.js';

// Локальное состояние фильтров
let adminShopFilter = 'all';
let adminShopSearchTerm = '';
let adminShopSearchTimeout = null;

// ============================================================
// РЕНДЕР СПИСКА ТОВАРОВ
// ============================================================
export async function renderAdminShop() {
    const container = document.getElementById('adminShopItemsList');
    if (!container) return;

    const items = await apiCall('getShopItems');
    if (!items || items.length === 0) {
        container.innerHTML = `
            <div class="admin-shop-empty-modern">
                <div class="empty-icon"><i class="fas fa-store"></i></div>
                <h3>Магазин пуст</h3>
                <p>Добавьте первый товар, чтобы начать продажи</p>
                <button class="btn-add-first" onclick="document.getElementById('showAddItemModal').click()">
                    <i class="fas fa-plus"></i> Добавить товар
                </button>
            </div>
        `;
        return;
    }

    let filteredItems = items;
    if (adminShopFilter === 'in-stock') {
        filteredItems = filteredItems.filter(item => item.stock > 0 || item.stock === -1);
    } else if (adminShopFilter === 'low-stock') {
        filteredItems = filteredItems.filter(item => item.stock > 0 && item.stock <= 5);
    } else if (adminShopFilter === 'out-of-stock') {
        filteredItems = filteredItems.filter(item => item.stock === 0);
    } else if (adminShopFilter === 'infinite') {
        filteredItems = filteredItems.filter(item => item.stock === -1);
    }

    if (adminShopSearchTerm) {
        const term = adminShopSearchTerm.toLowerCase().trim();
        filteredItems = filteredItems.filter(item =>
            item.name.toLowerCase().includes(term) ||
            item.id.toString().includes(term)
        );
    }

    const totalItems = items.length;
    const inStockItems = items.filter(item => item.stock > 0 || item.stock === -1).length;
    const lowStockItems = items.filter(item => item.stock > 0 && item.stock <= 5).length;
    const outOfStockItems = items.filter(item => item.stock === 0).length;
    const infiniteItems = items.filter(item => item.stock === -1).length;

    let html = `
        <div class="admin-shop-topbar">
            <div class="topbar-left">
                <div class="topbar-icon"><i class="fas fa-boxes"></i></div>
                <div class="topbar-info">
                    <h2>Управление магазином</h2>
                    <p>Всего товаров: ${totalItems}</p>
                </div>
            </div>
            <div class="topbar-right">
                <button class="btn-add-item" onclick="document.getElementById('showAddItemModal').click()">
                    <i class="fas fa-plus"></i> Добавить товар
                </button>
            </div>
        </div>

        <div class="admin-shop-stats-grid">
            <div class="admin-shop-stat-block">
                <div class="stat-icon-box total"><i class="fas fa-box"></i></div>
                <div class="stat-content">
                    <div class="stat-label">Всего товаров</div>
                    <div class="stat-number">${totalItems}</div>
                </div>
            </div>
            <div class="admin-shop-stat-block">
                <div class="stat-icon-box in-stock"><i class="fas fa-check-circle"></i></div>
                <div class="stat-content">
                    <div class="stat-label">В наличии</div>
                    <div class="stat-number">${inStockItems}</div>
                </div>
            </div>
            <div class="admin-shop-stat-block">
                <div class="stat-icon-box low-stock"><i class="fas fa-exclamation-triangle"></i></div>
                <div class="stat-content">
                    <div class="stat-label">Заканчиваются</div>
                    <div class="stat-number">${lowStockItems}</div>
                </div>
            </div>
            <div class="admin-shop-stat-block">
                <div class="stat-icon-box sold"><i class="fas fa-times-circle"></i></div>
                <div class="stat-content">
                    <div class="stat-label">Нет в наличии</div>
                    <div class="stat-number">${outOfStockItems}</div>
                </div>
            </div>
            <div class="admin-shop-stat-block">
                <div class="stat-icon-box revenue"><i class="fas fa-infinity"></i></div>
                <div class="stat-content">
                    <div class="stat-label">Бесконечные</div>
                    <div class="stat-number">${infiniteItems}</div>
                </div>
            </div>
        </div>

        <div class="admin-shop-filters">
            <div class="filter-search">
                <i class="fas fa-search search-icon"></i>
                <input type="text" id="adminShopSearchInput" placeholder="Поиск по названию или ID..." value="${escapeHtml(adminShopSearchTerm)}">
            </div>
            <div class="filter-group">
                <button class="filter-chip ${adminShopFilter === 'all' ? 'active' : ''}" data-filter="all">Все</button>
                <button class="filter-chip ${adminShopFilter === 'in-stock' ? 'active' : ''}" data-filter="in-stock">В наличии</button>
                <button class="filter-chip ${adminShopFilter === 'low-stock' ? 'active' : ''}" data-filter="low-stock">Заканчиваются</button>
                <button class="filter-chip ${adminShopFilter === 'out-of-stock' ? 'active' : ''}" data-filter="out-of-stock">Нет в наличии</button>
                <button class="filter-chip ${adminShopFilter === 'infinite' ? 'active' : ''}" data-filter="infinite">♾️ Бесконечные</button>
            </div>
        </div>
    `;

    if (filteredItems.length === 0) {
        html += `
            <div class="admin-shop-empty-modern" style="margin-top: 20px;">
                <div class="empty-icon"><i class="fas fa-search"></i></div>
                <h3>Ничего не найдено</h3>
                <p>Попробуйте изменить фильтры или поисковый запрос</p>
            </div>
        `;
    } else {
        html += `<div class="admin-shop-items-grid">`;
        for (const item of filteredItems) {
            const stockStatus = item.stock === -1 ? 'infinite' :
                               item.stock === 0 ? 'out-of-stock' :
                               item.stock <= 5 ? 'low-stock' : 'in-stock';

            const statusLabels = {
                'in-stock': 'В наличии',
                'low-stock': 'Заканчивается',
                'out-of-stock': 'Нет в наличии',
                'infinite': '♾️ Бесконечно'
            };

            html += `
                <div class="admin-shop-item-card-modern" data-item-id="${item.id}">
                    <span class="item-status-badge ${stockStatus}">${statusLabels[stockStatus]}</span>

                    <div class="item-image-section" onclick="document.getElementById('file-input-${item.id}').click()">
                        ${item.image_url ? `<img src="${item.image_full_url}" alt="${escapeHtml(item.name)}">` : `
                            <div class="no-image-placeholder-modern">
                                <i class="fas fa-image"></i>
                                <span>Нет фото</span>
                                <span style="font-size:10px;opacity:0.5;">Нажмите для загрузки</span>
                            </div>
                        `}
                        <div class="item-image-actions">
                            <button class="upload-btn-modern" onclick="event.stopPropagation(); document.getElementById('file-input-${item.id}').click()" title="Загрузить фото">
                                <i class="fas fa-upload"></i>
                            </button>
                            ${item.image_url ? `<button class="delete-img-btn-modern" onclick="event.stopPropagation(); deleteItemImage(${item.id})" title="Удалить фото">
                                <i class="fas fa-trash"></i>
                            </button>` : ''}
                        </div>
                        <input type="file" id="file-input-${item.id}" accept="image/jpeg,image/png,image/gif,image/webp" style="display:none" onchange="uploadItemImage(${item.id}, this.files[0])">
                    </div>

                    <div class="item-body-modern">
                        <div class="item-name-row">
                            <input type="text" class="item-name-input-modern" id="admin-item-name-${item.id}" value="${escapeHtml(item.name)}" placeholder="Название товара">
                            <span class="item-id-badge">#${item.id}</span>
                        </div>

                        <div class="item-fields-grid">
                            <div class="field-group-modern">
                                <label><i class="fas fa-gem"></i> Цена</label>
                                <input type="number" class="price-input" id="admin-item-price-${item.id}" value="${item.price}" min="0">
                            </div>
                            <div class="field-group-modern">
                                <label><i class="fas fa-box"></i> Количество</label>
                                <input type="number" id="admin-item-stock-${item.id}" value="${item.stock}" min="-1" placeholder="-1 = бесконечно">
                            </div>
                        </div>

                        <div class="item-actions-row">
                            <button class="btn-save-item" onclick="updateShopItemAdmin(${item.id})">
                                <i class="fas fa-save"></i> Сохранить
                            </button>
                            <button class="btn-delete-item" onclick="deleteShopItemAdmin(${item.id})">
                                <i class="fas fa-trash"></i> Удалить
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }
        html += `</div>`;
    }

    container.innerHTML = html;

    // Фильтры
    const filterChips = document.querySelectorAll('.admin-shop-filters .filter-chip');
    filterChips.forEach(chip => {
        chip.addEventListener('click', function() {
            adminShopFilter = this.dataset.filter;
            renderAdminShop();
        });
    });

    // Поиск
    const searchInput = document.getElementById('adminShopSearchInput');
    if (searchInput) {
        const newSearchInput = searchInput.cloneNode(true);
        searchInput.parentNode.replaceChild(newSearchInput, searchInput);

        newSearchInput.addEventListener('input', function() {
            if (adminShopSearchTimeout) clearTimeout(adminShopSearchTimeout);
            const value = this.value;
            adminShopSearchTimeout = setTimeout(function() {
                adminShopSearchTerm = value;
                renderAdminShop();
            }, 500);
        });

        newSearchInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                if (adminShopSearchTimeout) clearTimeout(adminShopSearchTimeout);
                adminShopSearchTerm = this.value;
                renderAdminShop();
            }
        });
    }
}

// ============================================================
// ДОБАВЛЕНИЕ ТОВАРА
// ============================================================
export async function addShopItem() {
    const name = document.getElementById('newItemName')?.value.trim();
    const price = parseInt(document.getElementById('newItemPrice')?.value) || 0;
    const stock = parseInt(document.getElementById('newItemStock')?.value) || -1;

    if (!name) { showToast('Введите название товара', 'error'); return; }
    if (price < 0) { showToast('Цена не может быть отрицательной', 'error'); return; }

    const result = await apiCall('addShopItem', 'POST', {
        name,
        price,
        stock,
        user_id: state.currentUser?.id || 0,
        user_login: state.currentUser?.login || ''
    });

    if (result) {
        showToast('✅ Товар "' + name + '" добавлен', 'success');
        if (typeof window.closeModal === 'function') window.closeModal('addItemModal');

        document.getElementById('newItemName').value = '';
        document.getElementById('newItemPrice').value = '';
        document.getElementById('newItemStock').value = '';

        await renderAdminShop();
        if (state.currentStudent && typeof window.renderShop === 'function') await window.renderShop();
    } else {
        showToast('❌ Ошибка при добавлении товара', 'error');
    }
}

// ============================================================
// ОБНОВЛЕНИЕ ТОВАРА
// ============================================================
export async function updateShopItemAdmin(id) {
    const name = document.getElementById(`admin-item-name-${id}`)?.value.trim();
    const price = parseInt(document.getElementById(`admin-item-price-${id}`)?.value) || 0;
    const stock = parseInt(document.getElementById(`admin-item-stock-${id}`)?.value) || -1;

    if (!name) { showToast('Введите название товара', 'error'); return; }
    if (price < 0) { showToast('Цена не может быть отрицательной', 'error'); return; }

    const result = await apiCall('updateShopItem', 'POST', {
        item_id: id,
        name,
        price,
        stock,
        user_id: state.currentUser?.id || 0,
        user_login: state.currentUser?.login || ''
    });

    if (result) {
        showToast('✅ Товар обновлен', 'success');
        await renderAdminShop();
        if (state.currentStudent && typeof window.renderShop === 'function') await window.renderShop();
    } else {
        showToast('❌ Ошибка при обновлении товара', 'error');
    }
}

// ============================================================
// УДАЛЕНИЕ ТОВАРА
// ============================================================
export async function deleteShopItemAdmin(id) {
    if (!confirm('Удалить этот товар? Это действие нельзя отменить.')) return;

    const result = await apiCall('deleteShopItem', 'POST', {
        item_id: id,
        user_id: state.currentUser?.id || 0,
        user_login: state.currentUser?.login || ''
    });

    if (result) {
        showToast('✅ Товар удален', 'success');
        await renderAdminShop();
        if (state.currentStudent && typeof window.renderShop === 'function') await window.renderShop();
    } else {
        showToast('❌ Ошибка при удалении товара', 'error');
    }
}

// ============================================================
// ЗАГРУЗКА ИЗОБРАЖЕНИЯ
// ============================================================
export async function uploadItemImage(id, file) {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)) {
        showToast('❌ Разрешены только JPEG, PNG, GIF, WEBP', 'error');
        return;
    }
    if (file.size > 5 * 1024 * 1024) {
        showToast('❌ Файл слишком большой (макс 5MB)', 'error');
        return;
    }

    const fd = new FormData();
    fd.append('item_image', file);
    fd.append('item_id', id);
    if (state.currentUser) {
        fd.append('user_id', state.currentUser.id);
        fd.append('user_login', state.currentUser.login || '');
    }

    try {
        const response = await fetch(state.API_URL + '?endpoint=uploadShopImage', { method: 'POST', body: fd });
        const result = await response.json();
        if (result.success) {
            showToast('✅ Фото загружено', 'success');
            await renderAdminShop();
            if (state.currentStudent && typeof window.renderShop === 'function') await window.renderShop();
        } else {
            showToast('❌ ' + (result.error || 'Ошибка загрузки'), 'error');
        }
    } catch (e) {
        console.error('Upload error:', e);
        showToast('❌ Ошибка загрузки изображения', 'error');
    }
}

// ============================================================
// УДАЛЕНИЕ ИЗОБРАЖЕНИЯ
// ============================================================
export async function deleteItemImage(id) {
    if (!confirm('Удалить изображение?')) return;

    const result = await apiCall('deleteShopItemImage', 'POST', {
        item_id: id,
        user_id: state.currentUser?.id || 0,
        user_login: state.currentUser?.login || ''
    });

    if (result) {
        showToast('✅ Изображение удалено', 'success');
        await renderAdminShop();
        if (state.currentStudent && typeof window.renderShop === 'function') await window.renderShop();
    } else {
        showToast('❌ Ошибка при удалении изображения', 'error');
    }
}

// ============================================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================================
export function initShopEditor() {
    const adminAddItemBtn = document.getElementById('adminAddItemBtn');
    if (adminAddItemBtn) adminAddItemBtn.addEventListener('click', addShopItem);
}

// Экспорт в window
window.renderAdminShop = renderAdminShop;
window.addShopItem = addShopItem;
window.updateShopItemAdmin = updateShopItemAdmin;
window.deleteShopItemAdmin = deleteShopItemAdmin;
window.uploadItemImage = uploadItemImage;
window.deleteItemImage = deleteItemImage;
window.initShopEditor = initShopEditor;