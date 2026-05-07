`users-admin` and `users-auth` Edge Functions

المطلوب في Supabase:

```bash
supabase functions deploy users-auth
supabase functions deploy users-admin
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
supabase secrets set APP_SESSION_SECRET=YOUR_LONG_RANDOM_SECRET
```

ثم شغّل داخل SQL Editor:

- [users_admin_manage_policy.sql](C:\Users\Administrator\Desktop\بيبس\توفيق\supabase\users_admin_manage_policy.sql)
- [users_signup_policy.sql](C:\Users\Administrator\Desktop\بيبس\توفيق\supabase\users_signup_policy.sql)

بعد هذه الخطوة:

- لا تعُد الواجهة تقرأ `public.users` مباشرة
- لا يوجد `select/update/delete` مفتوح لـ `anon` على جدول `users`
- القراءة والكتابة الحساسة تمر فقط عبر `users-auth` و `users-admin`

المهام التي أصبحت تمر عبر الدالة:

- تعطيل/تفعيل الحساب
- حذف الحساب
- تغيير الصلاحية
- إضافة/تعديل حساب من صفحة المدير
- إضافة/تعديل/حذف/تعطيل حسابات المندوب المتقدم
- تسجيل الدخول الآمن
- التحقق من كلمة المرور الحالية
- تغيير كلمة المرور الذاتية
