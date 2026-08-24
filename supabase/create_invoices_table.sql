-- ============================================================
-- إنشاء جدول الفواتير (الشحنات) الجديد — بديل جدول abdo
-- شغّل هذا الملف كاملاً داخل Supabase SQL Editor
-- ============================================================

-- الجدول الأساسي
create table public.invoices (
  id bigserial not null,
  m text null default ''::text,
  "اسم العميل" text null default ''::text,
  "العنوان" text null default ''::text,
  "الزون" text null default ''::text,
  "المنتج" text null default ''::text,
  "الهاتف" text null default ''::text,
  "هاتف بديل" text null default ''::text,
  "المبلغ" text null default ''::text,
  "الراسل" text null default ''::text,
  "كود الشحنة" text null default ''::text,
  "المندوب" text null default ''::text,
  "الحالة" text null default ''::text,
  "سبب الحالة" text null default ''::text,
  "المدفوع" text null default ''::text,
  "عمولة المندوب" text null default ''::text,
  "الصافي" text null default ''::text,
  "الشحن" text null default ''::text,
  "التاريخ" text null default ''::text,
  "تقفيل" text null default ''::text,
  "اليومية" text null default ''::text,
  "الموظف" text null default ''::text,
  "ملاحظات" text null default ''::text,
  "نوع المندوب" text null default ''::text,
  "ارشيف" text null default ''::text,
  "حدث" text null default ''::text,
  created_at timestamp with time zone null default now(),
  "عدد" text null default ''::text,
  constraint invoices_pkey primary key (id)
) TABLESPACE pg_default;

-- فهرس فريد على كود الشحنة
create unique INDEX IF not exists idx_invoices_code on public.invoices using btree ("كود الشحنة") TABLESPACE pg_default;

-- ============================================================
-- الوصول (RLS)
-- التطبيق الحالي يعمل بـ anon key مباشرة على جدول abdo،
-- فلضمان استمرار عمل كل الصفحات بنفس الطريقة على الجدول الجديد:
--  أ) إيقاف RLS (نفس النمط المعمول به غالباً)، أو
--  ب) تفعيل RLS مع سياسة مفتوحة (المبدّل أسفله)
-- اختر خياراً واحداً فقط حسب إعدادات abdo عندك.
-- ============================================================

-- (أ) إيقاف RLS — استخدمه لو كان جدول abdo الحالي بلا RLS
alter table public.invoices disable row level security;

-- (ب) بديل: تفعيل RLS مع سياسة مفتوحة (علّق السطرين أعلاه وافتح سطرين تحت)
-- alter table public.invoices enable row level security;
-- create policy "invoices_open_access" on public.invoices for all to anon, authenticated using (true) with check (true);

-- ============================================================
-- (اختياري) لاحقاً بعد نقل البيانات: إزالة الجدول القديم
-- تحذير: لا تشغّل هذا السطر قبل التأكد من ترحيل كل بيانات abdo إلى invoices
-- drop table if exists public.abdo;
-- ============================================================
