// engine.js - المحرك المحاسبي لحساب الأرصدة ودفاتر الأستاذ والقوائم المالية الختامية

class AccountingEngine {
    constructor(storageManager) {
        this.storage = storageManager;
    }

    // التحقق من صحة وتوازن القيد اليومي
    validateEntry(entry) {
        const errors = [];
        if (!entry.date) errors.push('يجب تحديد تاريخ القيد');
        if (!entry.description || entry.description.trim() === '') errors.push('يجب كتابة البيان أو شرح القيد');
        if (!entry.lines || entry.lines.length < 2) errors.push('يجب أن يحتوي القيد على سطرين على الأقل (طرف مدين وطرف دائن)');

        let totalDebit = 0;
        let totalCredit = 0;

        entry.lines.forEach((line, index) => {
            if (!line.accountCode) {
                errors.push(`السطر رقم ${index + 1}: لم يتم تحديد الحساب`);
            }
            const debit = parseFloat(line.debit) || 0;
            const credit = parseFloat(line.credit) || 0;

            if (debit < 0 || credit < 0) {
                errors.push(`السطر رقم ${index + 1}: لا يمكن إدخال مبالغ سالبة`);
            }
            if (debit > 0 && credit > 0) {
                errors.push(`السطر رقم ${index + 1}: لا يمكن أن يكون السطر مديناً ودائناً في نفس الوقت`);
            }
            if (debit === 0 && credit === 0) {
                errors.push(`السطر رقم ${index + 1}: يجب إدخال مبلغ مدين أو دائن أكبر من الصفر`);
            }

            totalDebit += debit;
            totalCredit += credit;
        });

        // فحص التوازن بفارق تقريب لا يتجاوز 0.001
        const diff = Math.abs(totalDebit - totalCredit);
        if (diff > 0.001) {
            errors.push(`القيد غير متوازن! إجمالي المدين: ${this.formatMoney(totalDebit)} - إجمالي الدائن: ${this.formatMoney(totalCredit)} (الفارق: ${this.formatMoney(diff)})`);
        }

        return {
            isValid: errors.length === 0,
            errors,
            totalDebit,
            totalCredit,
            diff
        };
    }

    // احتساب مجاميع وأرصدة جميع الحسابات (مع إمكانية الفلترة بتاريخ)
    calculateAllBalances(fromDate = null, toDate = null) {
        const accounts = this.storage.getAccounts();
        const entries = this.storage.getEntries();

        // تصفية القيود حسب التاريخ إن وجد
        const filteredEntries = entries.filter(e => {
            if (fromDate && e.date < fromDate) return false;
            if (toDate && e.date > toDate) return false;
            return true;
        });

        // خريطة لتخزين الإجماليات لكل حساب
        const balanceMap = {};
        accounts.forEach(acc => {
            balanceMap[acc.code] = {
                account: acc,
                totalDebit: 0,
                totalCredit: 0,
                netBalance: 0, // الرصيد الصافي وفق طبيعة الحساب
                debitBalance: 0, // رصيد مدين إن وجد
                creditBalance: 0 // رصيد دائن إن وجد
            };
        });

        filteredEntries.forEach(entry => {
            entry.lines.forEach(line => {
                const code = String(line.accountCode);
                if (balanceMap[code]) {
                    const debit = parseFloat(line.debit) || 0;
                    const credit = parseFloat(line.credit) || 0;
                    balanceMap[code].totalDebit += debit;
                    balanceMap[code].totalCredit += credit;
                }
            });
        });

        // احتساب الأرصدة الختامية
        Object.keys(balanceMap).forEach(code => {
            const item = balanceMap[code];
            const nature = item.account.nature; // 'debit' or 'credit'

            if (nature === 'debit') {
                // الأصول والمصروفات: الرصيد الطبيعي = مدين - دائن
                item.netBalance = item.totalDebit - item.totalCredit;
            } else {
                // الخصوم، حقوق الملكية، الإيرادات: الرصيد الطبيعي = دائن - مدين
                item.netBalance = item.totalCredit - item.totalDebit;
            }

            if (item.totalDebit >= item.totalCredit) {
                item.debitBalance = item.totalDebit - item.totalCredit;
                item.creditBalance = 0;
            } else {
                item.debitBalance = 0;
                item.creditBalance = item.totalCredit - item.totalDebit;
            }
        });

        return balanceMap;
    }

    // توليد دفتر الأستاذ / كشف الحساب التفصيلي
    getAccountLedger(accountCode, fromDate = null, toDate = null) {
        const account = this.storage.getAccountByCode(accountCode);
        if (!account) return null;

        const entries = this.storage.getEntries();
        // فرز القيود تصاعدياً حسب التاريخ لترتيب الحركات
        const sortedEntries = [...entries].sort((a, b) => new Date(a.date) - new Date(b.date));

        let openingDebit = 0;
        let openingCredit = 0;
        const transactions = [];

        sortedEntries.forEach(entry => {
            const isBeforePeriod = fromDate && entry.date < fromDate;
            const isInPeriod = (!fromDate || entry.date >= fromDate) && (!toDate || entry.date <= toDate);

            entry.lines.forEach(line => {
                if (String(line.accountCode) === String(accountCode)) {
                    const debit = parseFloat(line.debit) || 0;
                    const credit = parseFloat(line.credit) || 0;

                    if (isBeforePeriod) {
                        openingDebit += debit;
                        openingCredit += credit;
                    } else if (isInPeriod) {
                        transactions.push({
                            entryId: entry.id,
                            entryNumber: entry.number,
                            date: entry.date,
                            description: entry.description,
                            lineNote: line.note || '',
                            reference: entry.reference || '',
                            debit,
                            credit
                        });
                    }
                }
            });
        });

        // احتساب الرصيد الافتتاحي
        let openingBalance = 0;
        if (account.nature === 'debit') {
            openingBalance = openingDebit - openingCredit;
        } else {
            openingBalance = openingCredit - openingDebit;
        }

        // احتساب الرصيد التراكمي المتحرك بعد كل حركة
        let runningBalance = openingBalance;
        let periodDebitTotal = 0;
        let periodCreditTotal = 0;

        const transactionsWithBalance = transactions.map(tx => {
            periodDebitTotal += tx.debit;
            periodCreditTotal += tx.credit;

            if (account.nature === 'debit') {
                runningBalance += (tx.debit - tx.credit);
            } else {
                runningBalance += (tx.credit - tx.debit);
            }

            return {
                ...tx,
                runningBalance
            };
        });

        const closingBalance = runningBalance;

        return {
            account,
            fromDate,
            toDate,
            openingDebit,
            openingCredit,
            openingBalance,
            periodDebitTotal,
            periodCreditTotal,
            totalDebit: openingDebit + periodDebitTotal,
            totalCredit: openingCredit + periodCreditTotal,
            closingBalance,
            transactions: transactionsWithBalance
        };
    }

    // ميزان المراجعة (Trial Balance) بالمجاميع والأرصدة
    generateTrialBalance(fromDate = null, toDate = null) {
        const balanceMap = this.calculateAllBalances(fromDate, toDate);
        const rows = [];

        let totalDebitSum = 0;
        let totalCreditSum = 0;
        let totalDebitBalanceSum = 0;
        let totalCreditBalanceSum = 0;

        Object.values(balanceMap).forEach(item => {
            // إظهار الحسابات التي لها حركة أو رصيد
            if (item.totalDebit > 0 || item.totalCredit > 0 || item.netBalance !== 0) {
                totalDebitSum += item.totalDebit;
                totalCreditSum += item.totalCredit;
                totalDebitBalanceSum += item.debitBalance;
                totalCreditBalanceSum += item.creditBalance;

                rows.push({
                    account: item.account,
                    totalDebit: item.totalDebit,
                    totalCredit: item.totalCredit,
                    debitBalance: item.debitBalance,
                    creditBalance: item.creditBalance
                });
            }
        });

        // ترتيب الحسابات بحسب كود الحساب
        rows.sort((a, b) => a.account.code.localeCompare(b.account.code, undefined, { numeric: true }));

        const isBalanced = Math.abs(totalDebitBalanceSum - totalCreditBalanceSum) < 0.01 &&
                           Math.abs(totalDebitSum - totalCreditSum) < 0.01;

        return {
            rows,
            totals: {
                totalDebitSum,
                totalCreditSum,
                totalDebitBalanceSum,
                totalCreditBalanceSum
            },
            isBalanced,
            fromDate,
            toDate
        };
    }

    // قائمة الدخل (الأرباح والخسائر - Income Statement)
    generateIncomeStatement(fromDate = null, toDate = null) {
        const balanceMap = this.calculateAllBalances(fromDate, toDate);

        const revenues = [];
        const expenses = [];

        let totalRevenues = 0;
        let totalExpenses = 0;

        Object.values(balanceMap).forEach(item => {
            const accType = item.account.type;

            if (accType === '4') { // إيرادات (طبيعة دائنة)
                const amount = item.netBalance; // دائن - مدين
                if (amount !== 0 || item.totalDebit > 0 || item.totalCredit > 0) {
                    revenues.push({
                        account: item.account,
                        amount: amount
                    });
                    totalRevenues += amount;
                }
            } else if (accType === '5') { // مصروفات (طبيعة مدينة)
                const amount = item.netBalance; // مدين - دائن
                if (amount !== 0 || item.totalDebit > 0 || item.totalCredit > 0) {
                    expenses.push({
                        account: item.account,
                        amount: amount
                    });
                    totalExpenses += amount;
                }
            }
        });

        // ترتيب الحسابات
        revenues.sort((a, b) => a.account.code.localeCompare(b.account.code, undefined, { numeric: true }));
        expenses.sort((a, b) => a.account.code.localeCompare(b.account.code, undefined, { numeric: true }));

        const netIncome = totalRevenues - totalExpenses; // صافي الربح / الخسارة

        return {
            revenues,
            expenses,
            totalRevenues,
            totalExpenses,
            netIncome,
            isProfit: netIncome >= 0,
            fromDate,
            toDate
        };
    }

    // الميزانية العمومية / قائمة المركز المالي (Balance Sheet)
    generateBalanceSheet(toDate = null) {
        // الميزانية العمومية تراكمية حتى تاريخ محدد
        const balanceMap = this.calculateAllBalances(null, toDate);
        const incomeStatement = this.generateIncomeStatement(null, toDate);

        const assets = { current: [], fixed: [], total: 0 };
        const liabilities = { current: [], longTerm: [], total: 0 };
        const equity = { items: [], total: 0 };

        Object.values(balanceMap).forEach(item => {
            const accType = item.account.type;
            const category = item.account.category;
            const balance = item.netBalance;

            if (accType === '1') { // أصول (مدين)
                if (category === '11') {
                    assets.current.push({ account: item.account, balance });
                } else {
                    assets.fixed.push({ account: item.account, balance });
                }
                assets.total += balance;
            } else if (accType === '2') { // خصوم (دائن)
                if (category === '21') {
                    liabilities.current.push({ account: item.account, balance });
                } else {
                    liabilities.longTerm.push({ account: item.account, balance });
                }
                liabilities.total += balance;
            } else if (accType === '3') { // حقوق الملكية (دائن)
                equity.items.push({ account: item.account, balance });
                equity.total += balance;
            }
        });

        // إضافة صافي ربح/خسارة الفترة لحقوق الملكية
        const currentYearProfit = incomeStatement.netIncome;
        const totalEquityWithProfit = equity.total + currentYearProfit;
        const totalLiabilitiesAndEquity = liabilities.total + totalEquityWithProfit;

        // التحقق من المعادلة المحاسبية: الأصول = الخصوم + حقوق الملكية
        const diff = Math.abs(assets.total - totalLiabilitiesAndEquity);
        const isBalanced = diff < 0.01;

        return {
            assets,
            liabilities,
            equity: {
                ...equity,
                currentYearProfit,
                totalWithProfit: totalEquityWithProfit
            },
            totalAssets: assets.total,
            totalLiabilitiesAndEquity,
            difference: diff,
            isBalanced,
            asOfDate: toDate || new Date().toISOString().split('T')[0]
        };
    }

    // مؤشرات لوحة القيادة (Dashboard KPIs)
    getDashboardMetrics() {
        const balanceMap = this.calculateAllBalances();
        const incomeStatement = this.generateIncomeStatement();
        const entries = this.storage.getEntries();
        const accounts = this.storage.getAccounts();

        let totalAssets = 0;
        let totalLiabilities = 0;
        let totalCashAndBank = 0;
        let accountsReceivable = 0;
        let accountsPayable = 0;

        Object.values(balanceMap).forEach(item => {
            const code = item.account.code;
            const type = item.account.type;

            if (type === '1') totalAssets += item.netBalance;
            if (type === '2') totalLiabilities += item.netBalance;

            // سيولة نقدية (صندوق + بنك: 1101, 1102)
            if (code === '1101' || code === '1102') {
                totalCashAndBank += item.netBalance;
            }
            // عملاء: 1103
            if (code === '1103') {
                accountsReceivable += item.netBalance;
            }
            // موردون: 2101
            if (code === '2101') {
                accountsPayable += item.netBalance;
            }
        });

        return {
            totalAssets,
            totalLiabilities,
            totalCashAndBank,
            accountsReceivable,
            accountsPayable,
            totalRevenues: incomeStatement.totalRevenues,
            totalExpenses: incomeStatement.totalExpenses,
            netIncome: incomeStatement.netIncome,
            isProfit: incomeStatement.isProfit,
            entriesCount: entries.length,
            accountsCount: accounts.length,
            recentEntries: entries.slice(0, 5)
        };
    }

    // تنسيق المبالغ المالية
    formatMoney(amount) {
        const settings = this.storage.getSettings();
        const currency = settings.currency || '$';
        const num = parseFloat(amount) || 0;
        return `${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
    }

    // تنسيق المبلغ بالعملة الثانوية (سعر الصرف الفوري)
    formatSecondaryMoney(amount) {
        const settings = this.storage.getSettings();
        const secCurr = settings.secondaryCurrency || 'د.ع';
        const rate = parseFloat(settings.exchangeRate) || 1500;
        const num = (parseFloat(amount) || 0) * rate;
        return `${num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${secCurr}`;
    }
}

// إنشاء المحرك المحاسبي
const engine = new AccountingEngine(storage);
