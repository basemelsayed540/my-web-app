# Delivery

هذا المشروع يحتوي على أكثر من واجهة:

- تطبيق المندوب المعتمد داخل [reps](C:/Users/Administrator/Desktop/3/Delivery/reps)
- قسم الراسل والمتابعة المنظم داخل [sender-follower](C:/Users/Administrator/Desktop/3/Delivery/sender-follower)
- قسم الإدارة المنظم داخل [manager](C:/Users/Administrator/Desktop/3/Delivery/manager)

## المسارات المهمة

- [reps/login.html](C:/Users/Administrator/Desktop/3/Delivery/reps/login.html): صفحة الدخول المعتمدة لتطبيق المندوب
- [reps/rep-dashboard.html](C:/Users/Administrator/Desktop/3/Delivery/reps/rep-dashboard.html): لوحة المندوب
- [reps/sub-rep-dashboard.html](C:/Users/Administrator/Desktop/3/Delivery/reps/sub-rep-dashboard.html): لوحة المندوب الفرعي
- [reps/account.html](C:/Users/Administrator/Desktop/3/Delivery/reps/account.html): الحساب
- [reps/wallet.html](C:/Users/Administrator/Desktop/3/Delivery/reps/wallet.html): المحفظة
- [reps/rep-map.html](C:/Users/Administrator/Desktop/3/Delivery/reps/rep-map.html): خريطة المندوب
- [reps/assets](C:/Users/Administrator/Desktop/3/Delivery/reps/assets): الملفات المشتركة الخاصة بنسخة المندوب
- [sender-follower/login.html](C:/Users/Administrator/Desktop/3/Delivery/sender-follower/login.html): صفحة دخول الراسل والمتابعة
- [sender-follower/sender-dashboard.html](C:/Users/Administrator/Desktop/3/Delivery/sender-follower/sender-dashboard.html): لوحة الراسل
- [sender-follower/follower-dashboard.html](C:/Users/Administrator/Desktop/3/Delivery/sender-follower/follower-dashboard.html): لوحة المتابعة
- [sender-follower/assets](C:/Users/Administrator/Desktop/3/Delivery/sender-follower/assets): الملفات المشتركة الخاصة بنسخة الراسل والمتابعة
- [manager/dashboard.html](C:/Users/Administrator/Desktop/3/Delivery/manager/dashboard.html): لوحة الإدارة
- [manager/live-map.html](C:/Users/Administrator/Desktop/3/Delivery/manager/live-map.html): خريطة المتابعة الحية للإدارة
- [manager/scanner.html](C:/Users/Administrator/Desktop/3/Delivery/manager/scanner.html): صفحة الماسح على الهاتف
- [manager/assets](C:/Users/Administrator/Desktop/3/Delivery/manager/assets): الملفات المشتركة الخاصة بالإدارة

## ملاحظات مهمة

- الصفحات القديمة في الجذر مثل [index.html](C:/Users/Administrator/Desktop/3/Delivery/index.html) و[rep.html](C:/Users/Administrator/Desktop/3/Delivery/rep.html) و[sub-rep.html](C:/Users/Administrator/Desktop/3/Delivery/sub-rep.html) أصبحت صفحات تحويل فقط إلى نسخة `reps`.
- الصفحة [map.html](C:/Users/Administrator/Desktop/3/Delivery/map.html) في الجذر أصبحت صفحة تحويل فقط إلى [reps/rep-map.html](C:/Users/Administrator/Desktop/3/Delivery/reps/rep-map.html).
- الصفحتان [sender.html](C:/Users/Administrator/Desktop/3/Delivery/sender.html) و[follower.html](C:/Users/Administrator/Desktop/3/Delivery/follower.html) في الجذر أصبحتا صفحات تحويل فقط إلى نسخة `sender-follower`.
- الصفحات [admin.html](C:/Users/Administrator/Desktop/3/Delivery/admin.html) و[admin-map.html](C:/Users/Administrator/Desktop/3/Delivery/admin-map.html) و[mobile.html](C:/Users/Administrator/Desktop/3/Delivery/mobile.html) في الجذر أصبحت صفحات تحويل فقط إلى نسخة `manager`.
- عند تعديل تطبيق المندوب مستقبلاً، التعديل يجب أن يكون داخل [reps](C:/Users/Administrator/Desktop/3/Delivery/reps) وليس في صفحات الجذر القديمة.
- عند تعديل قسم الراسل أو المتابعة مستقبلًا، التعديل يجب أن يكون داخل [sender-follower](C:/Users/Administrator/Desktop/3/Delivery/sender-follower) وليس في صفحات الجذر القديمة.
- عند تعديل قسم الإدارة مستقبلًا، التعديل يجب أن يكون داخل [manager](C:/Users/Administrator/Desktop/3/Delivery/manager) وليس في صفحات الجذر القديمة.

## مراجعة سريعة للبنية

### يفضل الإبقاء عليه

- [reps](C:/Users/Administrator/Desktop/3/Delivery/reps): النسخة المعتمدة لتطبيق المندوب
- [sender-follower](C:/Users/Administrator/Desktop/3/Delivery/sender-follower): النسخة المنظمة لقسم الراسل والمتابعة
- [manager](C:/Users/Administrator/Desktop/3/Delivery/manager): النسخة المنظمة لقسم الإدارة
- [admin-map.html](C:/Users/Administrator/Desktop/3/Delivery/admin-map.html): تحويل إلى نسخة الإدارة المنظمة
- [mobile.html](C:/Users/Administrator/Desktop/3/Delivery/mobile.html): تحويل إلى نسخة الإدارة المنظمة
- [supabase](C:/Users/Administrator/Desktop/3/Delivery/supabase): دوال وسياسات قاعدة البيانات
- [archive/root-assets](C:/Users/Administrator/Desktop/3/Delivery/archive/root-assets): أرشيف الأصول القديمة الخاصة بالجذر بعد فصل الأقسام

### ملفات تمت أرشفتها

- [archive/tools](C:/Users/Administrator/Desktop/3/Delivery/archive/tools): يحتوي على الأدوات والملفات المساندة القديمة التي لم تعد ضمن المسار التشغيلي الأساسي
- الملفات المؤرشفة تشمل: `fix.js` و`fix2.js` و`fix.jsnode` و`test_syntax.js` و`update.ps1` و`update_nav.ps1` و`update_tracking.ps1`
- [archive/root-assets](C:/Users/Administrator/Desktop/3/Delivery/archive/root-assets): يحتوي على `css` و`js` القديمين الخاصين بالجذر بعد نقل الاعتماديات إلى `reps` و`sender-follower` و`manager`

### يحتاج حذرًا قبل أي حذف أو نقل

- [map.html](C:/Users/Administrator/Desktop/3/Delivery/map.html): صفحة تحويل إلى خريطة المندوب داخل `reps`
- صفحات الجذر المحولة مثل [rep.html](C:/Users/Administrator/Desktop/3/Delivery/rep.html) و[account.html](C:/Users/Administrator/Desktop/3/Delivery/account.html): يفضل إبقاؤها لأنها تحفظ التوافق مع الروابط القديمة
- [sender-follower](C:/Users/Administrator/Desktop/3/Delivery/sender-follower): يحتوي على صفحات الراسل والمتابعة ويجب الإبقاء عليه ضمن المسار التشغيلي
