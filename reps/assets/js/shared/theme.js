window.RepsTheme = (() => {
    const DEFAULT_STORAGE_KEY = 'rep-theme';
    const DEFAULT_ICON_ID = 'themeIcon';

    function updateIcon(iconId, isDark) {
        const icon = document.getElementById(iconId);
        if (icon) {
            icon.className = isDark ? 'fas fa-sun text-xl' : 'fas fa-moon text-xl';
        }
    }

    function apply(options = {}) {
        const storageKey = options.storageKey || DEFAULT_STORAGE_KEY;
        const iconId = options.iconId || DEFAULT_ICON_ID;
        const isDark = localStorage.getItem(storageKey) === 'dark';
        document.body.classList.toggle('dark', isDark);
        updateIcon(iconId, isDark);
        return isDark;
    }

    function toggle(options = {}) {
        const storageKey = options.storageKey || DEFAULT_STORAGE_KEY;
        const iconId = options.iconId || DEFAULT_ICON_ID;
        const isDark = document.body.classList.toggle('dark');
        updateIcon(iconId, isDark);
        localStorage.setItem(storageKey, isDark ? 'dark' : 'light');
        return isDark;
    }

    return {
        apply,
        toggle,
    };
})();

window.toggleTheme = function toggleTheme() {
    return window.RepsTheme.toggle();
};
