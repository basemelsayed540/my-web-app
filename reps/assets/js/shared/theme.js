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
        document.documentElement.classList.toggle('dark', isDark);
        updateIcon(iconId, isDark);
        return isDark;
    }

    function toggle(options = {}) {
        const storageKey = options.storageKey || DEFAULT_STORAGE_KEY;
        const iconId = options.iconId || DEFAULT_ICON_ID;

        // Performance optimization: disable transitions for instant theme switch
        const css = document.createElement('style');
        css.type = 'text/css';
        css.appendChild(document.createTextNode(`* {
           -webkit-transition: none !important;
           -moz-transition: none !important;
           -o-transition: none !important;
           -ms-transition: none !important;
           transition: none !important;
        }`));
        document.head.appendChild(css);

        const isDark = document.body.classList.toggle('dark');
        document.documentElement.classList.toggle('dark', isDark);
        updateIcon(iconId, isDark);
        localStorage.setItem(storageKey, isDark ? 'dark' : 'light');

        // Force a reflow to ensure the theme is applied before re-enabling transitions
        const _ = window.getComputedStyle(css).opacity;

        // Re-enable transitions after a tiny frame
        setTimeout(() => {
            document.head.removeChild(css);
        }, 10);

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
