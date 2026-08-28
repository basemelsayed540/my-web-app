# cache-bust.ps1
# ============================================================================
# أداة "كسر الكاش" التلقائي المبني على بصمة محتوى الملف (Content-Hash Cache Busting)
# ----------------------------------------------------------------------------
# الغرض: ضمان أن المتصفح يجلب آخر نسخة فعلية من الموارد الثابتة الداخلية
#        (shipment-config.js و style.css و tracking.js) فور رفعها على السيرفر،
#        دون اعتماد على hard refresh يدوي ودون نسيان تحديث رقم نسخة يدوي.
#
# كيف يعمل:
#   1) يحسب SHA-256 قصيراً (أول 10 خانات) من محتوى كل ملف ثابت داخلي.
#   2) يضيف البصمة كمعامل استعلام (query param ?v=...) إلى روابط <script>/<link>
#      التي تشير إلى تلك الملفات في صفحات الـ HTML الثماني.
#   3) البصمة تتغير تلقائياً فقط عندما يتغير محتوى الملف فعلياً:
#        - مضمون تغيّر  -> رابط جديد -> المتصفح يجلب الجديد.
#        - مضمون ثابت  -> نفس الرابط -> المتصفح يستخدم المحفوظ (بلا تحميل زائد).
#
# الاستخدام بعد أي تعديل على أحد الملفات الثابتة، ثم ارفع كل شيء على السيرفر:
#       .\cache-bust.ps1        (من مجلد المشروع)
# أو حدد مجلد المشروع صراحة:
#       .\cache-bust.ps1 -Root "D:\المشروع"
#
# ملاحظة: لا يعدّل أي منطق وظيفي؛ يغيّر رابط تحميل الموارد في الـ HTML فقط.
# ============================================================================

param(
    [string]$Root = (Split-Path -Parent $MyInvocation.MyCommand.Path)
)

$ErrorActionPreference = 'Stop'

$pages = @(
    'login.html',
    'admin-dashboard.html',
    'dev-settings.html',
    'monitor-dashboard.html',
    'rep-dashboard.html',
    'followup-dashboard.html',
    'housing-dashboard.html',
    'live-map.html'
)

# الموارد الثابتة الداخلية التي نريد "كسر كاشها" تلقائياً
$assets = @(
    'assets/js/shipment-config.js',
    'assets/css/style.css',
    'assets/js/tracking.js'
)

function Get-ShortHash([string]$path) {
    return (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.Substring(0, 10)
}

# حساب البصمات الحالية
$hashMap = @{}
foreach ($a in $assets) {
    $full = Join-Path $Root $a
    if (-not (Test-Path -LiteralPath $full)) {
        Write-Warning "الملف غير موجود، سيتخطى: $a"
        continue
    }
    $hashMap[$a] = Get-ShortHash $full
}

Write-Host ""
Write-Host "البصمات المحسوبة (من محتوى الملف):"
foreach ($a in $assets) {
    if ($hashMap.ContainsKey($a)) {
        Write-Host ("  {0}  ->  ?v={1}" -f $a, $hashMap[$a])
    }
}
Write-Host ""

# إعداد ترميز UTF-8 (مع/بدون BOM حسب الأصل) للحفاظ على بايتات كل ملف
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$utf8Bom   = New-Object System.Text.UTF8Encoding($true)

foreach ($p in $pages) {
    $f = Join-Path $Root $p
    if (-not (Test-Path -LiteralPath $f)) {
        Write-Warning "تخطي (الصفحة غير موجودة): $p"
        continue
    }

    $bytes = [System.IO.File]::ReadAllBytes($f)
    $hasBom = ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF)
    $offset = if ($hasBom) { 3 } else { 0 }
    $text = [System.Text.Encoding]::UTF8.GetString($bytes, $offset, $bytes.Length - $offset)

    $changed = $false

    foreach ($a in $assets) {
        if (-not $hashMap.ContainsKey($a)) { continue }
        $v = $hashMap[$a]
        # نمط يطابق الرابط مع أو بدون بصمة قديمة، في src (script) و href (link)
        # يضيف / يحدّث البصمة ?v=... بشكل محايد (Idempotent)
        $pat = ('(src|href)="' + [regex]::Escape($a) + '(\?v=[0-9A-Fa-f]+)?"')
        $rep = ('$1="' + $a + '?v=' + $v + '"')
        $newText = [regex]::Replace($text, $pat, $rep)
        if ($newText -ne $text) {
            $text = $newText
            $changed = $true
        }
    }

    if (-not $changed) {
        Write-Host ("لم تتغير أي روابط داخلية: {0}" -f $p)
        continue
    }

    if ($hasBom) {
        [System.IO.File]::WriteAllBytes($f, $utf8Bom.GetPreamble() + $utf8Bom.GetBytes($text))
    } else {
        [System.IO.File]::WriteAllBytes($f, $utf8NoBom.GetBytes($text))
    }

    Write-Host ("تم التحديث: {0}  (بصمات الموارد أُصيفت/حُدثت في الروابط)" -f $p)
}

Write-Host ""
Write-Host "انتهى. ارفع كل الملفات (بما فيها صفحات الـ HTML والموارد) على السيرفر."
