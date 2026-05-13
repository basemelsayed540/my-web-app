window.RepsSession = (() => {
    function getStoredUser() {
        try {
            if (typeof AppCrypto !== 'undefined') {
                return AppCrypto.getItem('user');
            }
            return JSON.parse(localStorage.getItem('user') || 'null');
        } catch (error) {
            return null;
        }
    }

    function hasAllowedRole(user, allowedRoles = []) {
        if (!user) return false;
        if (!Array.isArray(allowedRoles) || allowedRoles.length === 0) return true;
        return allowedRoles.includes(user.role);
    }

    function requireUser(allowedRoles = [], redirectTo = 'login.html') {
        const user = getStoredUser();
        if (hasAllowedRole(user, allowedRoles)) {
            return user;
        }

        window.location.href = redirectTo;
        throw new Error(`Unauthorized session for ${redirectTo}`);
    }

    function clear() {
        clearStoredUserSession();
    }

    return {
        clear,
        getStoredUser,
        hasAllowedRole,
        requireUser,
    };
})();
