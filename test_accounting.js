// test_accounting.js - اختبار شامل للمحرك المحاسبي وصحة المعادلات المحاسبية

// محاكاة localStorage في بيئة Node.js
global.localStorage = {
    store: {},
    getItem(key) { return this.store[key] || null; },
    setItem(key, value) { this.store[key] = String(value); },
    removeItem(key) { delete this.store[key]; },
    clear() { this.store = {}; }
};

// تحميل النماذج
const fs = require('fs');
const path = require('path');

const modelsCode = fs.readFileSync(path.join(__dirname, 'js/models.js'), 'utf8');
const storageCode = fs.readFileSync(path.join(__dirname, 'js/storage.js'), 'utf8');
const engineCode = fs.readFileSync(path.join(__dirname, 'js/engine.js'), 'utf8');

eval(modelsCode);
eval(storageCode);
eval(engineCode);

console.log('🧪 بدء اختبارات النظام المحاسبي...');

let passed = 0;
let failed = 0;

function assert(condition, message) {
    if (condition) {
        console.log(`  ✅ [نجاح]: ${message}`);
        passed++;
    } else {
        console.error(`  ❌ [فشل]: ${message}`);
        failed++;
    }
}

// 1. اختبار تهيئة شجرة الحسابات
console.log('\n1. فحص شجرة الحسابات:');
const accounts = storage.getAccounts();
assert(accounts.length >= 18, `تم تحميل ${accounts.length} حساب مالي قياسي.`);
const cashAcc = storage.getAccountByCode('1101');
assert(cashAcc && cashAcc.nature === 'debit', 'حساب الصندوق ذو طبيعة مدينة.');
const capAcc = storage.getAccountByCode('3101');
assert(capAcc && capAcc.nature === 'credit', 'حساب رأس المال ذو طبيعة دائنة.');

// 2. اختبار فحص توازن القيود
console.log('\n2. فحص التحقق من توازن القيود اليومية:');
const balancedEntry = {
    date: '2026-02-01',
    description: 'شراء بضاعة نقداً',
    lines: [
        { accountCode: '1104', debit: 5000, credit: 0 },
        { accountCode: '1101', debit: 0, credit: 5000 }
    ]
};
const v1 = engine.validateEntry(balancedEntry);
assert(v1.isValid === true, 'تم قبول القيد المتوازن بنجاح (5000 مدين = 5000 دائن).');

const unbalancedEntry = {
    date: '2026-02-01',
    description: 'قيد غير متوازن خطأ',
    lines: [
        { accountCode: '1104', debit: 5000, credit: 0 },
        { accountCode: '1101', debit: 0, credit: 4000 }
    ]
};
const v2 = engine.validateEntry(unbalancedEntry);
assert(v2.isValid === false, 'تم رفض القيد غير المتوازن بنجاح واكتشاف الفارق (1000).');

// 3. اختبار ميزان المراجعة
console.log('\n3. فحص ميزان المراجعة (Trial Balance):');
const tb = engine.generateTrialBalance();
assert(tb.isBalanced === true, 'ميزان المراجعة متوازن تماماً.');
assert(Math.abs(tb.totals.totalDebitSum - tb.totals.totalCreditSum) < 0.01, `إجمالي المجاميع متساوية: ${tb.totals.totalDebitSum}`);
assert(Math.abs(tb.totals.totalDebitBalanceSum - tb.totals.totalCreditBalanceSum) < 0.01, `إجمالي الأرصدة متساوية: ${tb.totals.totalDebitBalanceSum}`);

// 4. اختبار قائمة الدخل
console.log('\n4. فحص قائمة الدخل والأرباح والخسائر:');
const inc = engine.generateIncomeStatement();
assert(inc.totalRevenues > 0, `إجمالي الإيرادات: ${inc.totalRevenues}`);
assert(inc.totalExpenses > 0, `إجمالي المصروفات: ${inc.totalExpenses}`);
assert(inc.netIncome === (inc.totalRevenues - inc.totalExpenses), `صافي الربح صحيح: ${inc.netIncome}`);

// 5. اختبار الميزانية العمومية والمركز المالي
console.log('\n5. فحص الميزانية العمومية (معادلة الميزانية: الأصول = الخصوم + حقوق الملكية):');
const bs = engine.generateBalanceSheet();
console.log(`   - إجمالي الأصول: ${bs.totalAssets}`);
console.log(`   - إجمالي الخصوم: ${bs.liabilities.total}`);
console.log(`   - إجمالي حقوق الملكية (شاملة أرباح الفترة): ${bs.equity.totalWithProfit}`);
console.log(`   - إجمالي الخصوم وحقوق الملكية: ${bs.totalLiabilitiesAndEquity}`);
assert(bs.isBalanced === true, 'الميزانية العمومية متوازنة تماماً (الأصول = الخصوم + حقوق الملكية).');

// 6. اختبار دفتر الأستاذ وكشف الحساب
console.log('\n6. فحص دفتر الأستاذ وكشف حساب البنك:');
const bankLedger = engine.getAccountLedger('1102');
assert(bankLedger.transactions.length > 0, `عدد حركات حساب البنك: ${bankLedger.transactions.length}`);
assert(bankLedger.closingBalance > 0, `رصيد البنك الختامي: ${bankLedger.closingBalance}`);

console.log(`\n================================`);
console.log(`📊 نتيجة الاختبارات: ${passed} ناجحة | ${failed} فاشلة`);
console.log(`================================\n`);

if (failed > 0) {
    process.exit(1);
}
