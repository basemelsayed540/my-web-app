const { createClient } = supabase;
        const supabaseClient = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);

        const loginForm = document.getElementById('loginForm');
        const loginBtn = document.getElementById('loginBtn');
        const rememberMeCheckbox = document.getElementById('rememberMe');

        window.addEventListener('DOMContentLoaded', () => {
            const savedPhone = localStorage.getItem('savedPhone');
            const savedPassword = localStorage.getItem('savedPassword');
            if (savedPhone && savedPassword) {
                document.getElementById('phone').value = savedPhone;
                document.getElementById('password').value = savedPassword;
                if (rememberMeCheckbox) rememberMeCheckbox.checked = true;
            }
        });
        const repSignupModal = document.getElementById('repSignupModal');
        const repSignupForm = document.getElementById('repSignupForm');
        const signupBtn = document.getElementById('signupBtn');
        const openRepSignupBtn = document.getElementById('openRepSignup');
        const closeRepSignupBtn = document.getElementById('closeRepSignup');

        RepsTheme.apply();

        function toggleRepSignupModal(show) {
            repSignupModal.classList.toggle('hidden', !show);
            repSignupModal.classList.toggle('flex', show);
            document.body.classList.toggle('overflow-hidden', show);
        }

        openRepSignupBtn.addEventListener('click', (e) => {
            e.preventDefault();
            repSignupForm.reset();
            toggleRepSignupModal(true);
        });

        closeRepSignupBtn.addEventListener('click', () => toggleRepSignupModal(false));

        repSignupModal.addEventListener('click', (e) => {
            if (e.target === repSignupModal) toggleRepSignupModal(false);
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && repSignupModal.classList.contains('flex')) {
                toggleRepSignupModal(false);
            }
        });

        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const phone = document.getElementById('phone').value.trim();
            const password = document.getElementById('password').value;

            loginBtn.disabled = true;
            loginBtn.innerHTML = 'جاري التحقق...';

            try {
                const loginResult = await invokeUsersAuthAction('login', { phone, password });
                const data = loginResult?.user;
                if (!data) throw new Error('تعذر إنشاء جلسة تسجيل الدخول.');
                saveUserSession(data, loginResult.sessionToken || '');

                if (rememberMeCheckbox && rememberMeCheckbox.checked) {
                    localStorage.setItem('savedPhone', phone);
                    localStorage.setItem('savedPassword', password);
                } else {
                    localStorage.removeItem('savedPhone');
                    localStorage.removeItem('savedPassword');
                }

                Swal.fire({
                    icon: 'success',
                    title: 'تم تسجيل الدخول بنجاح',
                    text: phone === 'admin' ? 'مرحباً أيها المدير' : `مرحباً بك، ${data.full_name || data.username}`,
                    timer: 1500,
                    showConfirmButton: false
                }).then(() => {
                    if (data.role === 'admin' || data.role === 'housing') window.location.href = '../manager/dashboard.html';
                    else if (data.role === 'rep' || data.role === 'مندوب فرعي') window.location.href = 'rep-dashboard.html';
                    else if (data.role === 'sender') window.location.href = '../sender-follower/sender-dashboard.html';
                    else if (data.role === 'follower') window.location.href = '../sender-follower/follower-dashboard.html';
                    else if (data.role === 'sub-rep') window.location.href = 'sub-rep-dashboard.html';
                    else throw new Error('دور المستخدم غير معروف');
                });

            } catch (err) {
                Swal.fire({
                    icon: 'error',
                    title: 'فشل الدخول',
                    text: err.message
                });
            } finally {
                loginBtn.disabled = false;
                loginBtn.innerHTML = 'تسجيل الدخول';
            }
        });

        repSignupForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const signupRole = 'rep';
            const username = document.getElementById('signupName').value.trim();
            const phone = document.getElementById('signupPhone').value.trim();
            const email = document.getElementById('signupEmail').value.trim();
            const password = document.getElementById('signupPassword').value;
            const passwordConfirm = document.getElementById('signupPasswordConfirm').value;

            if (!username || !phone || !password) {
                Swal.fire({
                    icon: 'warning',
                    title: 'بيانات ناقصة',
                    text: 'يرجى استكمال الاسم ورقم الموبايل وكلمة المرور.'
                });
                return;
            }

            if (password.length < 6) {
                Swal.fire({
                    icon: 'warning',
                    title: 'كلمة مرور ضعيفة',
                    text: 'يرجى استخدام 6 أحرف أو أرقام على الأقل.'
                });
                return;
            }

            if (password !== passwordConfirm) {
                Swal.fire({
                    icon: 'error',
                    title: 'كلمتا المرور غير متطابقتين',
                    text: 'تأكد من إعادة كتابة كلمة المرور بشكل صحيح.'
                });
                return;
            }

            signupBtn.disabled = true;
            signupBtn.innerHTML = 'جاري إنشاء الحساب...';

            try {
                await invokeUsersAuthAction('signup', {
                    username,
                    phone,
                    email: email || null,
                    passwordHash: await hashPassword(password),
                    role: signupRole
                });

                Swal.fire({
                    icon: 'success',
                    title: 'تم إنشاء الحساب',
                    text: 'تم إنشاء حسابك بنجاح. يرجى الانتظار حتى يقوم المدير بتفعيل الحساب لتتمكن من تسجيل الدخول.'
                }).then(() => {
                    toggleRepSignupModal(false);
                    // No automatic redirect since it's not approved yet
                    window.location.href = 'login.html';
                });
            } catch (err) {
                Swal.fire({
                    icon: 'error',
                    title: 'تعذر إنشاء الحساب',
                    text: err.message || 'حدث خطأ أثناء إنشاء الحساب.'
                });
            } finally {
                signupBtn.disabled = false;
                signupBtn.innerHTML = '<span>إنشاء الحساب</span><i class="fas fa-user-plus"></i>';
            }
        });
