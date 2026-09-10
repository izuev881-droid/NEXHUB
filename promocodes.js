// assets/js/modules/promocodes.js — промокоды (студент)

import { state } from '../core/state.js';
import { apiCall } from '../core/api.js';
import { escapeHtml } from '../core/utils.js';
import { showToast } from '../core/ui.js';

// ============================================================
// ФЛАГИ
// ============================================================
let promoInitDone = false;
let promoActivateInProgress = false;

// ============================================================
// АКТИВАЦИЯ ПРОМОКОДА
// ============================================================
export async function activatePromoCode() {
    // Защита от двойного клика
    if (promoActivateInProgress) return;

    const inp = document.getElementById('bonusCodeInput');
    const code = inp ? inp.value.trim().toUpperCase() : '';

    if (!code) {
        showToast('Введите промокод', 'warning');
        return;
    }
    if (!state.currentStudent) {
        showToast('Войдите как студент', 'error');
        return;
    }

    promoActivateInProgress = true;

    const btn = document.getElementById('submitBonusCodeBtn');
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Проверка...';
    }

    try {
        const r = await apiCall('activatePromo', 'POST', {
            student_id: state.currentStudent.id,
            code: code
        });

        if (r) {
            // Формируем текст о награде
            let rewardText = '';
            if (r.reward) {
                if (r.reward.crystals > 0) rewardText += '+' + r.reward.crystals + '💎 ';
                if (r.reward.exp > 0) rewardText += '+' + r.reward.exp + '⭐ ';
            }
            if (r.title_given) rewardText += 'Вы получили тег!';

            showToast('✅ Промокод активирован! ' + rewardText, 'success');

            if (inp) inp.value = '';

            if (typeof window.updateStudentStats === 'function') await window.updateStudentStats();
            await renderUsedPromoCodes();
            if (typeof window.renderHistory === 'function') await window.renderHistory();
        } else {
            // apiCall сам показывает ошибку в console.warn, но покажем пользователю
            showToast('❌ Промокод не найден или уже использован', 'error');
        }
    } catch (e) {
        console.error('activatePromoCode error:', e);
        showToast('❌ Ошибка при активации промокода', 'error');
    } finally {
        setTimeout(function() {
            promoActivateInProgress = false;
            if (btn) {
                btn.disabled = false;
                btn.textContent = 'Активировать';
            }
        }, 300);
    }
}

// ============================================================
// СПИСОК ИСПОЛЬЗОВАННЫХ ПРОМОКОДОВ
// ============================================================
export async function renderUsedPromoCodes() {
    const c = document.getElementById('usedPromoCodes');
    if (!c || !state.currentStudent) return;

    const u = await apiCall('getStudentPromoCodes', 'GET', { student_id: state.currentStudent.id });

    if (!u || u.length === 0) {
        c.innerHTML = '<div class="empty-state"><i class="fas fa-ticket-alt"></i><p>Нет активированных промокодов</p></div>';
        return;
    }

    let html = '';
    for (let i = 0; i < u.length; i++) {
        html += '<div class="used-promo-item">' +
            '<span class="used-promo-code">' + escapeHtml(u[i]) + '</span>' +
            '<i class="fas fa-check-circle" style="color:#10b981;"></i>' +
        '</div>';
    }
    c.innerHTML = html;
}

// ============================================================
// ИНИЦИАЛИЗАЦИЯ (кнопка + Enter в поле)
// ============================================================
export function initPromocodes() {
    if (promoInitDone) return;
    promoInitDone = true;

    // Кнопка "Активировать"
    const submitBtn = document.getElementById('submitBonusCodeBtn');
    if (submitBtn) {
        const newBtn = submitBtn.cloneNode(true);
        submitBtn.parentNode.replaceChild(newBtn, submitBtn);
        newBtn.addEventListener('click', activatePromoCode);
    } else {
        console.warn('⚠️ Кнопка submitBonusCodeBtn не найдена');
    }

    // Enter в поле промокода
    const inp = document.getElementById('bonusCodeInput');
    if (inp) {
        const newInp = inp.cloneNode(true);
        inp.parentNode.replaceChild(newInp, inp);
        newInp.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                activatePromoCode();
            }
        });

        // Автоапперкейс по мере ввода
        newInp.addEventListener('input', function() {
            const start = this.selectionStart;
            const end = this.selectionEnd;
            this.value = this.value.toUpperCase();
            this.setSelectionRange(start, end);
        });
    }
}

// ============================================================
// ЭКСПОРТ В WINDOW
// ============================================================
window.activatePromoCode = activatePromoCode;
window.renderUsedPromoCodes = renderUsedPromoCodes;
window.initPromocodes = initPromocodes;