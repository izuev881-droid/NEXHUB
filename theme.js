// assets/js/modules/theme.js — переключение тёмной/светлой темы

import { showToast } from '../core/ui.js';

export function initThemeToggle() {
    const themeBtn = document.getElementById('themeToggleBtn');
    if (!themeBtn) return;

    const savedTheme = localStorage.getItem('shub_theme');
    const sunIcon = themeBtn.querySelector('.fa-sun');
    const moonIcon = themeBtn.querySelector('.fa-moon');

    if (savedTheme === 'light') {
        document.body.classList.add('light-theme');
        if (sunIcon) sunIcon.style.display = 'inline-block';
        if (moonIcon) moonIcon.style.display = 'none';
    } else {
        document.body.classList.remove('light-theme');
        if (sunIcon) sunIcon.style.display = 'none';
        if (moonIcon) moonIcon.style.display = 'inline-block';
    }

    themeBtn.addEventListener('click', function() {
        const isLight = document.body.classList.toggle('light-theme');

        if (isLight) {
            localStorage.setItem('shub_theme', 'light');
            if (sunIcon) sunIcon.style.display = 'inline-block';
            if (moonIcon) moonIcon.style.display = 'none';
            showToast('🌞 Светлая тема включена', 'info');
        } else {
            localStorage.setItem('shub_theme', 'dark');
            if (sunIcon) sunIcon.style.display = 'none';
            if (moonIcon) moonIcon.style.display = 'inline-block';
            showToast('🌙 Тёмная тема включена', 'info');
        }
    });
}

window.initThemeToggle = initThemeToggle;