// assets/js/modules/seasons.js — сезонные темы (личные и глобальные)

import { state } from '../core/state.js';
import { apiCall } from '../core/api.js';
import { showToast } from '../core/ui.js';

// ============================================================
// ПРИМЕНЕНИЕ ТЕМЫ К UI
// ============================================================
export function applySeasonToUI(season) {
    document.body.classList.remove('season-winter', 'season-spring', 'season-summer', 'season-autumn');

    if (season && season !== 'default') {
        document.body.classList.add('season-' + season);
    }

    updateSeasonIcon(season || 'default');

    const modal = document.getElementById('seasonModal');
    if (modal) {
        const options = modal.querySelectorAll('.season-option');
        options.forEach(function(opt) {
            if (opt.dataset.season === (season || 'default')) {
                opt.classList.add('active');
            } else {
                opt.classList.remove('active');
            }
        });
    }

    renderSeasonManagement();
}

export function updateSeasonIcon(season) {
    const btn = document.getElementById('seasonToggleBtn');
    if (!btn) return;

    const icons = {
        'default': 'fa-tree',
        'winter': 'fa-snowflake',
        'spring': 'fa-seedling',
        'summer': 'fa-sun',
        'autumn': 'fa-leaf'
    };

    const icon = btn.querySelector('i');
    if (icon) {
        icon.className = 'fas ' + (icons[season] || 'fa-tree');
    }
}

// ============================================================
// РАБОТА С ЛИЧНОЙ И ГЛОБАЛЬНОЙ ТЕМОЙ
// ============================================================
export async function loadPersonalSeasonFromServer(studentId) {
    if (!studentId) return null;
    try {
        const result = await apiCall('getPersonalSeason', 'GET', { student_id: studentId });
        if (result && result.season) return result.season;
    } catch (e) {
        console.log('Load personal season error:', e);
    }
    return null;
}

export async function savePersonalSeasonToServer(studentId, season) {
    if (!studentId) return false;
    try {
        const result = await apiCall('setPersonalSeason', 'POST', {
            student_id: studentId,
            season: season
        });
        return result !== null;
    } catch (e) {
        console.error('Error saving personal season:', e);
        return false;
    }
}

export async function loadGlobalSeasonFromServer() {
    try {
        const result = await apiCall('getGlobalSeason', 'GET', {});
        if (result && result.season) return result.season;
    } catch (e) {
        console.log('Load global season error:', e);
    }
    return null;
}

export async function getActiveSeason() {
    const isPersonal = localStorage.getItem('shub_season_personal') === 'true';
    const personalSeason = localStorage.getItem('shub_season');

    if (isPersonal && personalSeason) {
        return personalSeason;
    }

    try {
        const result = await apiCall('getGlobalSeason', 'GET', {});
        if (result && result.season) {
            localStorage.setItem('shub_season', result.season);
            return result.season;
        }
    } catch (e) {
        console.log('Error fetching global season:', e);
    }

    return 'default';
}

export async function applyGlobalSeason(season) {
    if (!state.currentUser || (state.currentUser.role !== 'founder' && state.currentUser.role !== 'admin')) {
        showToast('Недостаточно прав', 'error');
        return;
    }

    localStorage.removeItem('shub_season_personal');
    localStorage.setItem('shub_season', season);
    applySeasonToUI(season);
    updateSeasonIcon(season);
    renderSeasonManagement();

    const result = await apiCall('setGlobalSeason', 'POST', {
        season: season,
        user_id: state.currentUser.id,
        user_login: state.currentUser.login
    });

    if (result) {
        showToast('🌍 Глобальный сезон обновлён для всех!', 'success');
    } else {
        showToast('❌ Ошибка сохранения на сервере', 'error');
    }
}

// ============================================================
// МОДАЛКА ВЫБОРА СЕЗОНА
// ============================================================
export function showSeasonModal() {
    const currentSeason = localStorage.getItem('shub_season') || 'default';
    const isPersonal = localStorage.getItem('shub_season_personal') === 'true';

    const isAdmin = state.currentUser && (state.currentUser.role === 'founder' || state.currentUser.role === 'admin');

    const existingModal = document.getElementById('seasonModal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'seasonModal';

    let adminSection = '';
    if (isAdmin) {
        adminSection = `
            <div style="margin-top: 16px; padding: 16px; background: rgba(255,255,255,0.03); border-radius: var(--radius-md); border: 1px solid var(--glass-border);">
                <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 8px;">
                    <i class="fas fa-globe"></i> <strong>Режим администратора:</strong>
                </p>
                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                    <button class="btn-small" id="seasonModePersonal" style="${!isPersonal ? 'opacity:0.5;' : ''}">
                        <i class="fas fa-user"></i> Личный выбор
                    </button>
                    <button class="btn-small" id="seasonModeGlobal" style="${isPersonal ? 'opacity:0.5;' : ''}">
                        <i class="fas fa-globe"></i> Для всех
                    </button>
                </div>
                <p style="font-size: 10px; color: var(--text-muted); margin-top: 6px;">
                    ${isPersonal ? '🔒 Сейчас используется <strong>личный</strong> выбор' : '🌍 Сейчас используется <strong>глобальная</strong> тема для всех'}
                </p>
            </div>
        `;
    }

    modal.innerHTML = `
        <div class="modal-content" style="max-width: 500px;">
            <div class="modal-header">
                <h3><i class="fas fa-tree"></i> Сезонная тема</h3>
                <button class="modal-close" id="seasonModalClose">&times;</button>
            </div>
            <div class="modal-body">
                <p style="margin-bottom: 16px; color: var(--text-muted);">
                    <i class="fas fa-palette"></i> Выберите сезонную тему:
                </p>
                <div class="season-grid" id="seasonModalGrid">
                    <div class="season-option" data-season="default">
                        <div class="season-icon">🌈</div>
                        <div class="season-name">Стандартная</div>
                        <div class="season-badge">По умолчанию</div>
                    </div>
                    <div class="season-option" data-season="winter">
                        <div class="season-icon">❄️</div>
                        <div class="season-name">Зима</div>
                        <div class="season-badge">Холодная</div>
                    </div>
                    <div class="season-option" data-season="spring">
                        <div class="season-icon">🌸</div>
                        <div class="season-name">Весна</div>
                        <div class="season-badge">Свежая</div>
                    </div>
                    <div class="season-option" data-season="summer">
                        <div class="season-icon">☀️</div>
                        <div class="season-name">Лето</div>
                        <div class="season-badge">Яркая</div>
                    </div>
                    <div class="season-option" data-season="autumn">
                        <div class="season-icon">🍂</div>
                        <div class="season-name">Осень</div>
                        <div class="season-badge">Тёплая</div>
                    </div>
                </div>
                ${adminSection}
            </div>
            <div class="modal-footer">
                <button class="btn-cancel" id="seasonModalCancel">Отмена</button>
                <button class="btn-primary" id="seasonModalSave">Применить</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    const options = modal.querySelectorAll('.season-option');
    options.forEach(function(opt) {
        if (opt.dataset.season === currentSeason) opt.classList.add('active');
        opt.addEventListener('click', function() {
            options.forEach(function(o) { o.classList.remove('active'); });
            this.classList.add('active');
        });
    });

    if (isAdmin) {
        const personalBtn = document.getElementById('seasonModePersonal');
        const globalBtn = document.getElementById('seasonModeGlobal');

        if (personalBtn) {
            personalBtn.addEventListener('click', function() {
                localStorage.setItem('shub_season_personal', 'true');
                personalBtn.style.opacity = '1';
                globalBtn.style.opacity = '0.5';
                showToast('🔒 Режим: личный выбор', 'info');
            });
        }
        if (globalBtn) {
            globalBtn.addEventListener('click', function() {
                localStorage.removeItem('shub_season_personal');
                globalBtn.style.opacity = '1';
                personalBtn.style.opacity = '0.5';
                loadGlobalSeasonFromServer().then(function(season) {
                    if (season) {
                        localStorage.setItem('shub_season', season);
                        applySeasonToUI(season);
                        updateSeasonIcon(season);
                        options.forEach(function(opt) {
                            if (opt.dataset.season === season) opt.classList.add('active');
                            else opt.classList.remove('active');
                        });
                        renderSeasonManagement();
                    }
                });
                showToast('🌍 Режим: для всех пользователей', 'info');
            });
        }
    }

    const closeBtn = modal.querySelector('#seasonModalClose');
    const cancelBtn = modal.querySelector('#seasonModalCancel');
    const saveBtn = modal.querySelector('#seasonModalSave');

    closeBtn.addEventListener('click', function() { modal.remove(); });
    cancelBtn.addEventListener('click', function() { modal.remove(); });
    modal.addEventListener('click', function(e) {
        if (e.target === modal) modal.remove();
    });

    saveBtn.addEventListener('click', function() {
        const active = modal.querySelector('.season-option.active');
        if (!active) {
            showToast('Выберите сезон', 'warning');
            return;
        }

        const season = active.dataset.season;
        const isPersonalMode = localStorage.getItem('shub_season_personal') === 'true';
        const studentId = getCurrentStudentId();

        localStorage.setItem('shub_season', season);

        if (isPersonalMode || !isAdmin) {
            applySeasonToUI(season);
            updateSeasonIcon(season);
            renderSeasonManagement();
            modal.remove();

            if (studentId) savePersonalSeasonToServer(studentId, season);

            showToast('🌿 Тема обновлена: ' + active.querySelector('.season-name').textContent, 'success');
            return;
        }

        applyGlobalSeason(season);
        modal.remove();
        showToast('🌍 Глобальная тема обновлена для всех: ' + active.querySelector('.season-name').textContent, 'success');
    });
}

// ============================================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================================
export function initSeasonToggle() {
    const seasonBtn = document.getElementById('seasonToggleBtn');
    if (!seasonBtn) return;

    const newBtn = seasonBtn.cloneNode(true);
    seasonBtn.parentNode.replaceChild(newBtn, seasonBtn);

    newBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        showSeasonModal();
    });
}

export async function initSeason() {
    const personalSeason = localStorage.getItem('shub_season');
    const isPersonal = localStorage.getItem('shub_season_personal') === 'true';
    const studentId = getCurrentStudentId();

    if (personalSeason && isPersonal) {
        applySeasonToUI(personalSeason);
        updateSeasonIcon(personalSeason);
        startGlobalSeasonCheck();
        updateSeasonButtonVisibility();
        renderSeasonManagement();

        if (studentId) {
            const serverPersonalSeason = await loadPersonalSeasonFromServer(studentId);
            if (serverPersonalSeason !== personalSeason) {
                savePersonalSeasonToServer(studentId, personalSeason);
            }
        }
        return;
    }

    if (studentId) {
        const serverPersonalSeason = await loadPersonalSeasonFromServer(studentId);
        if (serverPersonalSeason) {
            localStorage.setItem('shub_season', serverPersonalSeason);
            localStorage.setItem('shub_season_personal', 'true');
            applySeasonToUI(serverPersonalSeason);
            updateSeasonIcon(serverPersonalSeason);
            startGlobalSeasonCheck();
            updateSeasonButtonVisibility();
            renderSeasonManagement();
            return;
        }
    }

    const globalSeason = await loadGlobalSeasonFromServer();
    if (globalSeason) {
        localStorage.setItem('shub_season', globalSeason);
        applySeasonToUI(globalSeason);
        updateSeasonIcon(globalSeason);
    } else {
        applySeasonToUI('default');
        updateSeasonIcon('default');
    }

    startGlobalSeasonCheck();
    updateSeasonButtonVisibility();
    renderSeasonManagement();
}

export function startGlobalSeasonCheck() {
    if (state.globalSeasonCheckInterval) return;
    state.globalSeasonCheckInterval = setInterval(function() {
        if (state.currentUser) checkGlobalSeason();
    }, 15000);
}

export function stopGlobalSeasonCheck() {
    if (state.globalSeasonCheckInterval) {
        clearInterval(state.globalSeasonCheckInterval);
        state.globalSeasonCheckInterval = null;
    }
}

export async function checkGlobalSeason() {
    if (localStorage.getItem('shub_season_personal') === 'true') return;

    try {
        const result = await apiCall('getGlobalSeason', 'GET', {});
        if (result && result.season) {
            const serverSeason = result.season;
            const localSeason = localStorage.getItem('shub_season') || 'default';

            if (serverSeason !== localSeason) {
                localStorage.setItem('shub_season', serverSeason);
                applySeasonToUI(serverSeason);
                updateSeasonIcon(serverSeason);
                renderSeasonManagement();
            }
        }
    } catch (e) {
        console.log('Check global season error:', e);
    }
}

export function updateSeasonButtonVisibility() {
    const seasonBtn = document.getElementById('seasonToggleBtn');
    if (seasonBtn) {
        if (state.currentUser) seasonBtn.classList.remove('hidden');
        else seasonBtn.classList.add('hidden');
    }
}

// ============================================================
// УПРАВЛЕНИЕ СЕЗОНАМИ В ПАНЕЛИ ОСНОВАТЕЛЯ
// ============================================================
export function renderSeasonManagement() {
    const container = document.querySelector('.season-management');
    if (!container) return;

    let seasonGrid = document.getElementById('seasonGrid');
    if (!seasonGrid) {
        const grid = container.querySelector('.season-grid');
        if (!grid) {
            container.innerHTML = `
                <h3><i class="fas fa-tree"></i> Сезонная тема сайта</h3>
                <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 16px;">Выберите сезон, который будет применён ко всем пользователям</p>
                <div class="season-grid" id="seasonGrid">
                    <div class="season-option" data-season="default">
                        <div class="season-icon">🌈</div>
                        <div class="season-name">Стандартная</div>
                        <div class="season-badge">По умолчанию</div>
                    </div>
                    <div class="season-option" data-season="winter">
                        <div class="season-icon">❄️</div>
                        <div class="season-name">Зима</div>
                        <div class="season-badge">Холодная</div>
                    </div>
                    <div class="season-option" data-season="spring">
                        <div class="season-icon">🌸</div>
                        <div class="season-name">Весна</div>
                        <div class="season-badge">Свежая</div>
                    </div>
                    <div class="season-option" data-season="summer">
                        <div class="season-icon">☀️</div>
                        <div class="season-name">Лето</div>
                        <div class="season-badge">Яркая</div>
                    </div>
                    <div class="season-option" data-season="autumn">
                        <div class="season-icon">🍂</div>
                        <div class="season-name">Осень</div>
                        <div class="season-badge">Тёплая</div>
                    </div>
                </div>
            `;
            seasonGrid = document.getElementById('seasonGrid');
        } else {
            seasonGrid = grid;
            if (!seasonGrid.id) seasonGrid.id = 'seasonGrid';
        }
    }

    const currentSeason = localStorage.getItem('shub_season') || 'default';
    const options = seasonGrid.querySelectorAll('.season-option');

    options.forEach(function(opt) {
        opt.classList.remove('active');
        if (opt.dataset.season === currentSeason) opt.classList.add('active');

        const newOpt = opt.cloneNode(true);
        opt.parentNode.replaceChild(newOpt, opt);

        newOpt.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();

            if (!state.currentUser || (state.currentUser.role !== 'founder' && state.currentUser.role !== 'admin')) {
                showToast('Недостаточно прав', 'error');
                return;
            }

            const season = this.dataset.season;
            const allOptions = seasonGrid.querySelectorAll('.season-option');
            allOptions.forEach(function(o) { o.classList.remove('active'); });
            this.classList.add('active');

            applyGlobalSeason(season);
        });
    });
}

// Локальный хелпер (чтобы не тянуть из другого модуля)
function getCurrentStudentId() {
    if (state.founderToggleMode && state.currentStudent && state.currentStudent.id) return state.currentStudent.id;
    if (state.currentStudent && state.currentStudent.id) return state.currentStudent.id;
    if (state.currentUser && (state.currentUser.role === 'admin' || state.currentUser.role === 'founder')) return -state.currentUser.id;
    return null;
}

// Экспорт в window
window.applySeasonToUI = applySeasonToUI;
window.updateSeasonIcon = updateSeasonIcon;
window.showSeasonModal = showSeasonModal;
window.initSeasonToggle = initSeasonToggle;
window.initSeason = initSeason;
window.renderSeasonManagement = renderSeasonManagement;
window.applyGlobalSeason = applyGlobalSeason;
window.startGlobalSeasonCheck = startGlobalSeasonCheck;
window.stopGlobalSeasonCheck = stopGlobalSeasonCheck;
window.checkGlobalSeason = checkGlobalSeason;