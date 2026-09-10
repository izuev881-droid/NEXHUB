// assets/js/modules/shop.js — магазин (студент)

import { state } from '../core/state.js';
import { apiCall } from '../core/api.js';
import { escapeHtml, getStockInfo } from '../core/utils.js';
import { showToast } from '../core/ui.js';

export async function renderShop() {
    const c = document.getElementById('shopList');
    if (!c || !state.currentStudent) return;

    c.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> Загрузка...</div>';

    const items = await apiCall('getShopItems', 'GET', { _t: Date.now() });
    if (!items || items.length === 0) {
        c.innerHTML = '<div class="empty-state"><i class="fas fa-store"></i><p>Нет товаров</p></div>';
        return;
    }

    let html = '';
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const si = getStockInfo(item.stock);
        const hasEnoughBalance = state.currentStudent.infinite_balance ? true : state.currentStudent.balance >= item.price;
        const cb = hasEnoughBalance && item.stock !== 0;

        html += '<div class="shop-item-new">' +
            '<div class="shop-image-container">' +
                (item.image_url
                    ? '<img src="' + item.image_full_url + '" class="shop-item-image" alt="' + escapeHtml(item.name) + '" onerror="this.parentElement.innerHTML=\'<div class=no-image-placeholder><i class=fas fa-image></i><span>Нет фото</span></div>\'">'
                    : '<div class="no-image-placeholder"><i class="fas fa-box"></i><span>Нет фото</span></div>') +
            '</div>' +
            '<div class="shop-title">' + escapeHtml(item.name) + '</div>' +
            '<div class="shop-price"><i class="fas fa-gem"></i> ' + item.price + '</div>' +
            '<div class="shop-stock ' + si.class + '">' + si.text + '</div>' +
            '<button class="buy-btn-new ' + (cb ? '' : 'disabled') + '" onclick="buyShopItem(' + item.id + ',' + item.price + ',\'' + escapeHtml(item.name) + '\')" ' + (cb ? '' : 'disabled') + '>' +
                (cb ? '<i class="fas fa-shopping-cart"></i> Купить' : (item.stock === 0 ? '❌ Нет в наличии' : '💎 Недостаточно средств')) +
            '</button>' +
        '</div>';
    }
    c.innerHTML = html;
}

export async function buyShopItem(id, price, name) {
    const r = await apiCall('buyItem', 'POST', {
        student_id: state.currentStudent.id,
        item_id: id,
        price: price
    });

    if (r) {
        showToast('✅ Куплено: ' + name, 'success');
        await renderShop();
        if (typeof window.updateStudentStats === 'function') await window.updateStudentStats();
        if (typeof window.renderHistory === 'function') await window.renderHistory();
    }
}

window.renderShop = renderShop;
window.buyShopItem = buyShopItem;