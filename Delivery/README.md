# Delivery

هذا المشروع يحتوي على أكثر من واجهة:

- تطبيق المندوب المعتمد داخل [t](C:/Users/Administrator/Desktop/3/Delivery/t)
- قسم الراسل والمتابعة المنظم داخل [m](C:/Users/Administrator/Desktop/3/Delivery/m)
- قسم الإدارة المنظم داخل [admin](C:/Users/Administrator/Desktop/3/Delivery/admin)

## المسارات المهمة

- [t/index.html](C:/Users/Administrator/Desktop/3/Delivery/t/index.html): صفحة الدخول المعتمدة لتطبيق المندوب
- [t/rep.html](C:/Users/Administrator/Desktop/3/Delivery/t/rep.html): لوحة المندوب
- [t/sub-rep.html](C:/Users/Administrator/Desktop/3/Delivery/t/sub-rep.html): لوحة المندوب الفرعي
- [t/account.html](C:/Users/Administrator/Desktop/3/Delivery/t/account.html): الحساب
- [t/wallet.html](C:/Users/Administrator/Desktop/3/Delivery/t/wallet.html): المحفظة
- [t/map.html](C:/Users/Administrator/Desktop/3/Delivery/t/map.html): خريطة المندوب
- [t/assets](C:/Users/Administrator/Desktop/3/Delivery/t/assets): الملفات المشتركة الخاصة بنسخة المندوب
- [m/sender.html](C:/Users/Administrator/Desktop/3/Delivery/m/sender.html): لوحة الراسل
- [m/follower.html](C:/Users/Administrator/Desktop/3/Delivery/m/follower.html): لوحة المتابعة
- [m/assets](C:/Users/Administrator/Desktop/3/Delivery/m/assets): الملفات المشتركة الخاصة بنسخة الراسل والمتابعة
- [admin/admin.html](C:/Users/Administrator/Desktop/3/Delivery/admin/admin.html): لوحة الإدارة
- [admin/admin-map.html](C:/Users/Administrator/Desktop/3/Delivery/admin/admin-map.html): خريطة المتابعة الحية للإدارة
- [admin/mobile.html](C:/Users/Administrator/Desktop/3/Delivery/admin/mobile.html): صفحة الماسح على الهاتف
- [admin/assets](C:/Users/Administrator/Desktop/3/Delivery/admin/assets): الملفات المشتركة الخاصة بالإدارة

## ملاحظات مهمة

- الصفحات القديمة في الجذر مثل [index.html](C:/Users/Administrator/Desktop/3/Delivery/index.html) و[rep.html](C:/Users/Administrator/Desktop/3/Delivery/rep.html) و[sub-rep.html](C:/Users/Administrator/Desktop/3/Delivery/sub-rep.html) أصبحت صفحات تحويل فقط إلى نسخة `t`.
- الصفحة [map.html](C:/Users/Administrator/Desktop/3/Delivery/map.html) في الجذر أصبحت صفحة تحويل فقط إلى [t/map.html](C:/Users/Administrator/Desktop/3/Delivery/t/map.html).
- الصفحتان [sender.html](C:/Users/Administrator/Desktop/3/Delivery/sender.html) و[follower.html](C:/Users/Administrator/Desktop/3/Delivery/follower.html) في الجذر أصبحتا صفحات تحويل فقط إلى نسخة `m`.
- الصفحات [admin.html](C:/Users/Administrator/Desktop/3/Delivery/admin.html) و[admin-map.html](C:/Users/Administrator/Desktop/3/Delivery/admin-map.html) و[mobile.html](C:/Users/Administrator/Desktop/3/Delivery/mobile.html) في الجذر أصبحت صفحات تحويل فقط إلى نسخة `admin`.
- عند تعديل تطبيق المندوب مستقبلاً، التعديل يجب أن يكون داخل [t](C:/Users/Administrator/Desktop/3/Delivery/t) وليس في صفحات الجذر القديمة.
- عند تعديل قسم الراسل أو المتابعة مستقبلًا، التعديل يجب أن يكون داخل [m](C:/Users/Administrator/Desktop/3/Delivery/m) وليس في صفحات الجذر القديمة.
- عند تعديل قسم الإدارة مستقبلًا، التعديل يجب أن يكون داخل [admin](C:/Users/Administrator/Desktop/3/Delivery/admin) وليس في صفحات الجذر القديمة.

## مراجعة سريعة للبنية

### يفضل الإبقاء عليه

- [t](C:/Users/Administrator/Desktop/3/Delivery/t): النسخة المعتمدة لتطبيق المندوب
- [m](C:/Users/Administrator/Desktop/3/Delivery/m): النسخة المنظمة لقسم الراسل والمتابعة
- [admin](C:/Users/Administrator/Desktop/3/Delivery/admin): النسخة المنظمة لقسم الإدارة
- [admin-map.html](C:/Users/Administrator/Desktop/3/Delivery/admin-map.html): تحويل إلى نسخة الإدارة المنظمة
- [mobile.html](C:/Users/Administrator/Desktop/3/Delivery/mobile.html): تحويل إلى نسخة الإدارة المنظمة
- [supabase](C:/Users/Administrator/Desktop/3/Delivery/supabase): دوال وسياسات قاعدة البيانات
- [archive/root-assets](C:/Users/Administrator/Desktop/3/Delivery/archive/root-assets): أرشيف الأصول القديمة الخاصة بالجذر بعد فصل الأقسام

### ملفات تمت أرشفتها

- [archive/tools](C:/Users/Administrator/Desktop/3/Delivery/archive/tools): يحتوي على الأدوات والملفات المساندة القديمة التي لم تعد ضمن المسار التشغيلي الأساسي
- الملفات المؤرشفة تشمل: `fix.js` و`fix2.js` و`fix.jsnode` و`test_syntax.js` و`update.ps1` و`update_nav.ps1` و`update_tracking.ps1`
- [archive/root-assets](C:/Users/Administrator/Desktop/3/Delivery/archive/root-assets): يحتوي على `css` و`js` القديمين الخاصين بالجذر بعد نقل الاعتماديات إلى `t` و`m` و`admin`

### يحتاج حذرًا قبل أي حذف أو نقل

- [map.html](C:/Users/Administrator/Desktop/3/Delivery/map.html): يبدو صفحة مستقلة وقد تكون مستخدمة يدويًا حتى لو لم أجد لها استدعاء مباشر
- صفحات الجذر المحولة مثل [rep.html](C:/Users/Administrator/Desktop/3/Delivery/rep.html) و[account.html](C:/Users/Administrator/Desktop/3/Delivery/account.html): يفضل إبقاؤها لأنها تحفظ التوافق مع الروابط القديمة
- المجلد [m](C:/Users/Administrator/Desktop/3/Delivery/m): موجود لكنه يبدو فارغًا حاليًا، ويمكن حذفه فقط إذا كنت متأكدًا أنه ليس جزءًا من تنظيمك الشخصي
