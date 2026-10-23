// ui.js - إدارة واجهة المستخدم والتفاعلات وعرض الشاشات المحاسبية والمخزنية المتكاملة

class UIManager {
    constructor() {
        this.currentTab = 'dashboard';
        this.entryLines = [];
        this.activeModal = null;
        this.editingEntryId = null;
        this.editingAccountCode = null;
        this.editingProductId = null;
        this.editingWarehouseId = null;
        this.deferredPrompt = null; // لتثبيت تطبيق PWA
    }

    init() {
        this.bindNavigation();
        this.bindGlobalEvents();
        this.setupPWAInstall();
        this.updateDiskAutoSaveIndicator();
        this.renderCurrentTab();
    }

    // إظهار رسائل التنبيه العائمة
    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        let icon = 'ℹ️';
        if (type === 'success') icon = '✅';
        if (type === 'error') icon = '❌';
        if (type === 'warning') icon = '⚠️';

        toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(10px)';
            toast.style.transition = 'all 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3800);
    }

    // ربط التنقل بين الشاشات
    bindNavigation() {
        const navBtns = document.querySelectorAll('.nav-item-btn');
        navBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const targetTab = btn.getAttribute('data-tab');
                this.switchTab(targetTab);
            });
        });

        // زر القائمة في الشاشات الصغيرة
        const menuToggle = document.getElementById('menu-toggle');
        const sidebar = document.querySelector('.sidebar');
        if (menuToggle && sidebar) {
            menuToggle.addEventListener('click', () => {
                sidebar.classList.toggle('open');
            });
        }
    }

    switchTab(tabId) {
        this.currentTab = tabId;

        // تحديث أزرار القائمة الجانبية
        document.querySelectorAll('.nav-item-btn').forEach(btn => {
            if (btn.getAttribute('data-tab') === tabId) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // إغلاق القائمة في الجوال بعد الاختيار
        const sidebar = document.querySelector('.sidebar');
        if (sidebar && window.innerWidth < 992) {
            sidebar.classList.remove('open');
        }

        // تحديث أقسام المحتوى
        document.querySelectorAll('.tab-pane').forEach(pane => {
            pane.classList.remove('active');
        });

        const activePane = document.getElementById(`tab-${tabId}`);
        if (activePane) {
            activePane.classList.add('active');
        }

        // عناوين الصفحات
        const pageTitle = document.getElementById('current-page-title');
        const pageSub = document.getElementById('current-page-desc');
        
        const titles = {
            dashboard: { title: 'لوحة التحكم والمؤشرات الشاملة', desc: 'نظرة عامة على المركز المالي، السيولة، وحركة المخزون' },
            pos: { title: 'نقطة البيع السريعة (POS الكاشير)', desc: 'بيع فوري بالباركود أو البطاقات، حساب الباقي للعميل، وطباعة إيصال حراري 80mm' },
            invoices: { title: 'فواتير المبيعات والمشتريات والمرتجعات', desc: 'إصدار وإدارة فواتير البيع والشراء والمرتجعات مع الربط المحاسبي التلقائي' },
            quotations: { title: 'عروض الأسعار والطلبيات (Quotations)', desc: 'إصدار عروض أسعار رسمية للعملاء وتحويلها إلى فواتير مبيعات بضغطة زر' },
            vouchers: { title: 'سندات القبض والصرف النقدية والبنكية', desc: 'تحصيل ديون العملاء، سداد مستحقات الموردين، صرف المصروفات وطباعة السندات الرسمية' },
            expenses: { title: 'المصروفات التشغيلية اليومية السريعة', desc: 'تسجيل فوري لمصاريف الإيجار، الرواتب، الكهرباء، النقل والضيافة مع توليد القيد المحاسبي آلياً' },
            cash_drawer: { title: 'حركة الخزينة والصندوق اليومي وتقفيل الكاشير', desc: 'مطابقة النقدية الفعلية بالدرج، رصيد أول اليوم، المقبوضات والمدفوعات اليومية' },
            parties: { title: 'إدارة العملاء والموردين وأعمار الديون', desc: 'متابعة أرصدة العملاء والموردين، تنبيهات التأخر في السداد، وكشوفات الحساب التفصيلية' },
            installments: { title: 'نظام الأقساط وجدولة الديون والعقود', desc: 'إنشاء عقود البيع بالتقسيط، جدولة الأقساط الشهرية والأسبوعية، وتحصيل القسط بضغطة زر مع سند قبض آلي' },
            invoice_print: { title: 'مركز طباعة ومعاينة الفواتير', desc: 'تخصيص قوالب طباعة الفواتير (A4 رسمي أو كاشير حراري 80mm) والطباعة المباشرة' },
            opening_balances: { title: 'الأرصدة الافتتاحية ودفعات بضاعة أول المدة', desc: 'إدخال أرصدة المخزون الابتدائية وإضافة الكميات للمستودعات مع قيد محاسبي تلقائي' },
            products: { title: 'دليل وإدارة المنتجات والأصناف', desc: 'إدارة كتالوج المنتجات، الباركود، أسعار الشراء والبيع، وتتبع المخزون' },
            warehouses: { title: 'إدارة المستودعات والمخازن المتعددة', desc: 'تعريف المخازن، أمناء المستودعات، وتوزيع البضائع في الفروع' },
            stock_ops: { title: 'التحويل والتسوية وحركات المخزون', desc: 'تسجيل التحويلات بين المخازن، تسويات الزيادة والنقص، والربط المحاسبي' },
            stocktaking: { title: 'شاشة الجرد الفعلي السريع للمخزون (Smart Stocktaking)', desc: 'مقارنة الأرصدة الدفترية بالكميات الفعلية المعدودة على الرفوف وتوليد تسويات وقيود الفائض والعجز بضغطة زر' },
            inventory_reports: { title: 'تقارير المخزون الشاملة', desc: 'جرد وتقييم المخزون، بطاقة حركة الصنف، التسويات، وتنبيهات النواقص' },
            accounts: { title: 'دليل شجرة الحسابات', desc: 'إدارة وتصنيف الحسابات المالية (أصول، خصوم، حقوق ملكية، إيرادات، مصروفات)' },
            entries: { title: 'دفتر قيود اليومية', desc: 'تسجيل واستعراض القيود المحاسبية المزدوجة المتوازنة' },
            ledger: { title: 'دفتر الأستاذ وكشف الحساب', desc: 'تتبع حركة وأرصدة أي حساب مالي خلال فترة محددة' },
            trial_balance: { title: 'ميزان المراجعة', desc: 'التحقق من توازن إجمالي الأرصدة والمجاميع المحاسبية' },
            reports: { title: 'القوائم والتقارير المالية الختامية', desc: 'قائمة الدخل (الأرباح والخسائر) وقائمة المركز المالي (الميزانية العمومية)' },
            audit_log: { title: 'سجل الرقابة والتدقيق الأمني (Audit Log)', desc: 'مراقبة كافة عمليات الإصدار والتعديل والحذف والتصفير بالوقت والتاريخ' },
            settings: { title: 'الإعدادات والعملات والنسخ الاحتياطي', desc: 'تخصيص بيانات المنشأة، سعر الصرف، استيراد وتصدير النسخ الاحتياطية، وتثبيت التطبيق' }
        };

        if (titles[tabId]) {
            if (pageTitle) pageTitle.textContent = titles[tabId].title;
            if (pageSub) pageSub.textContent = titles[tabId].desc;
        }

        this.renderCurrentTab();
    }

    renderCurrentTab() {
        switch (this.currentTab) {
            case 'dashboard':
                this.renderDashboard();
                break;
            case 'pos':
                this.renderPOS();
                break;
            case 'invoices':
                this.renderInvoices();
                break;
            case 'quotations':
                this.renderQuotations();
                break;
            case 'vouchers':
                this.renderVouchers();
                break;
            case 'expenses':
                this.renderExpenses();
                break;
            case 'cash_drawer':
                this.renderCashDrawer();
                break;
            case 'parties':
                this.renderParties();
                break;
            case 'installments':
                this.renderInstallments();
                break;
            case 'invoice_print':
                this.renderInvoicePrintCenter();
                break;
            case 'opening_balances':
                this.renderOpeningBalances();
                break;
            case 'products':
                this.renderProducts();
                break;
            case 'warehouses':
                this.renderWarehouses();
                break;
            case 'stock_ops':
                this.renderStockOps();
                break;
            case 'stocktaking':
                this.renderStocktaking();
                break;
            case 'inventory_reports':
                this.renderInventoryReports();
                break;
            case 'accounts':
                this.renderAccounts();
                break;
            case 'entries':
                this.renderEntries();
                break;
            case 'ledger':
                this.renderLedger();
                break;
            case 'trial_balance':
                this.renderTrialBalance();
                break;
            case 'reports':
                this.renderReports();
                break;
            case 'audit_log':
                this.renderAuditLog();
                break;
            case 'settings':
                this.renderSettings();
                break;
        }
    }

    // ربط الأحداث العامة
    bindGlobalEvents() {
        document.querySelectorAll('.action-new-entry').forEach(btn => btn.addEventListener('click', () => this.openEntryModal()));
        document.querySelectorAll('.action-new-account').forEach(btn => btn.addEventListener('click', () => this.openAccountModal()));
        document.querySelectorAll('.action-new-product').forEach(btn => btn.addEventListener('click', () => this.openProductModal()));
        document.querySelectorAll('.action-new-warehouse').forEach(btn => btn.addEventListener('click', () => this.openWarehouseModal()));
        document.querySelectorAll('.action-new-transfer').forEach(btn => btn.addEventListener('click', () => this.openTransferModal()));
        document.querySelectorAll('.action-new-adjustment').forEach(btn => btn.addEventListener('click', () => this.openAdjustmentModal()));
        document.querySelectorAll('.action-new-stock-in').forEach(btn => btn.addEventListener('click', () => this.openStockInModal()));
        document.querySelectorAll('.action-new-invoice').forEach(btn => btn.addEventListener('click', () => this.openInvoiceModal('SALES')));
        document.querySelectorAll('.action-new-sales-inv').forEach(btn => btn.addEventListener('click', () => this.openInvoiceModal('SALES')));
        document.querySelectorAll('.action-new-purchase-inv').forEach(btn => btn.addEventListener('click', () => this.openInvoiceModal('PURCHASE')));
        document.querySelectorAll('.action-new-opening-batch').forEach(btn => btn.addEventListener('click', () => this.openOpeningBatchModal()));

        // إغلاق النوافذ المنبثقة
        document.querySelectorAll('.modal-close-btn, .modal-close-trigger').forEach(btn => {
            btn.addEventListener('click', () => this.closeModal());
        });

        document.querySelectorAll('.modal-overlay').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) this.closeModal();
            });
        });

        document.querySelectorAll('.action-print').forEach(btn => {
            if (!btn.getAttribute('onclick')) {
                btn.addEventListener('click', () => window.print());
            }
        });
    }

    // إعداد تثبيت التطبيق المكتبي PWA ومركز التنصيب لأجهزة أخرى
    setupPWAInstall() {
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.deferredPrompt = e;
        });
    }

    openInstallerModal() {
        this.openModal('installer-center-modal');
    }

    triggerPWAInstall() {
        if (this.deferredPrompt) {
            this.deferredPrompt.prompt();
            this.deferredPrompt.userChoice.then(({ outcome }) => {
                if (outcome === 'accepted') {
                    this.showToast('تم بدء تثبيت التطبيق على الجهاز بنجاح!', 'success');
                }
                this.deferredPrompt = null;
            });
        } else {
            this.showToast('لتثبيت البرنامج مع أيقونة سطح مكتب وقائمة ابدأ على أي كمبيوتر، قم بتحميل وتشغيل (SmartAccounting_Setup.exe) أو أداة الاختصار (.bat)', 'info');
        }
    }

    downloadDesktopLauncherBat() {
        const batContent = [
            '@echo off',
            'chcp 65001 > nul',
            'title Smart Accounting Desktop Shortcut Creator',
            'set "APP_DIR=%~dp0"',
            'set "VBS=%TEMP%\\make_acc_shortcut.vbs"',
            'echo Set oWS = WScript.CreateObject("WScript.Shell") > "%VBS%"',
            'echo sLink = oWS.SpecialFolders("Desktop") ^& "\\المحاسب الذكي وإدارة المخزون.lnk" >> "%VBS%"',
            'echo Set oLink = oWS.CreateShortcut(sLink) >> "%VBS%"',
            'echo oLink.TargetPath = "%APP_DIR%run_offline.bat" >> "%VBS%"',
            'echo oLink.WorkingDirectory = "%APP_DIR%" >> "%VBS%"',
            'echo oLink.IconLocation = "%APP_DIR%app_icon.ico" >> "%VBS%"',
            'echo oLink.WindowStyle = 7 >> "%VBS%"',
            'echo oLink.Save >> "%VBS%"',
            'cscript //nologo "%VBS%"',
            'del "%VBS%"',
            'msg * "تم إنشاء أيقونة برنامج (المحاسب الذكي وإدارة المخزون) على سطح المكتب بنجاح!"',
            'exit'
        ].join('\r\n');

        const blob = new Blob([batContent], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'إنشاء_أيقونة_سطح_المكتب.bat';
        a.click();
        URL.revokeObjectURL(url);
        this.showToast('تم تحميل أداة إنشاء اختصار سطح المكتب بنجاح!', 'success');
    }

    downloadPortableSingleFile(includeCurrentData = false) {
        try {
            const cssText = window.PORTABLE_CSS_TEXT || '';
            const seedDataScript = includeCurrentData
                ? `
                (function() {
                    const seed = ${storage.exportBackupJSON()};
                    if (!localStorage.getItem(STORAGE_KEYS.ACCOUNTS) && seed) {
                        if (seed.accounts) localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(seed.accounts));
                        if (seed.entries) localStorage.setItem(STORAGE_KEYS.JOURNAL_ENTRIES, JSON.stringify(seed.entries));
                        if (seed.settings) localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(seed.settings));
                        if (seed.products) localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(seed.products));
                        if (seed.warehouses) localStorage.setItem(STORAGE_KEYS.WAREHOUSES, JSON.stringify(seed.warehouses));
                        if (seed.inventoryTransactions) localStorage.setItem(STORAGE_KEYS.INV_TRANSACTIONS, JSON.stringify(seed.inventoryTransactions));
                        if (seed.invoices) localStorage.setItem(STORAGE_KEYS.INVOICES, JSON.stringify(seed.invoices));
                        if (seed.openingBatches) localStorage.setItem(STORAGE_KEYS.OPENING_BATCHES, JSON.stringify(seed.openingBatches));
                        if (seed.parties) localStorage.setItem(STORAGE_KEYS.PARTIES, JSON.stringify(seed.parties));
                        if (seed.vouchers) localStorage.setItem(STORAGE_KEYS.VOUCHERS, JSON.stringify(seed.vouchers));
                        if (seed.quotations) localStorage.setItem(STORAGE_KEYS.QUOTATIONS, JSON.stringify(seed.quotations));
                        if (seed.expenses) localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(seed.expenses));
                        if (seed.auditLogs) localStorage.setItem(STORAGE_KEYS.AUDIT_LOG, JSON.stringify(seed.auditLogs));
                        if (seed.stocktakingSheets && STORAGE_KEYS.STOCKTAKING_SHEETS) localStorage.setItem(STORAGE_KEYS.STOCKTAKING_SHEETS, JSON.stringify(seed.stocktakingSheets));
                        if (seed.installmentPlans && STORAGE_KEYS.INSTALLMENT_PLANS) localStorage.setItem(STORAGE_KEYS.INSTALLMENT_PLANS, JSON.stringify(seed.installmentPlans));
                    }
                })();
                `
                : '';

            const modelsJs = [
                `const STORAGE_KEYS = ${JSON.stringify(STORAGE_KEYS)};`,
                `const ACCOUNT_TYPES = ${JSON.stringify(ACCOUNT_TYPES)};`,
                `const DEFAULT_ACCOUNTS = ${JSON.stringify(DEFAULT_ACCOUNTS)};`,
                `const DEFAULT_WAREHOUSES = ${JSON.stringify(DEFAULT_WAREHOUSES)};`,
                `const UNIT_OPTIONS = ${JSON.stringify(UNIT_OPTIONS)};`,
                `const EXPENSE_CATEGORIES = ${JSON.stringify(EXPENSE_CATEGORIES)};`,
                `const DEFAULT_PRODUCTS = ${JSON.stringify(DEFAULT_PRODUCTS)};`,
                `window.PORTABLE_CSS_TEXT = ${JSON.stringify(cssText)};`
            ].join('\n');

            const classesJs = [
                StorageManager.toString(),
                'const storage = new StorageManager();',
                AccountingEngine.toString(),
                'const engine = new AccountingEngine(storage);',
                InventoryEngine.toString(),
                'const inventory = new InventoryEngine(storage, engine);',
                UIManager.toString(),
                'const ui = new UIManager();'
            ].join('\n\n');

            const appInitJs = typeof window.__PORTABLE_APP_INIT_JS__ === 'string'
                ? window.__PORTABLE_APP_INIT_JS__
                : `document.addEventListener('DOMContentLoaded', () => { ui.init(); });`;

            const clone = document.documentElement.cloneNode(true);
            clone.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
            const toastCont = clone.querySelector('#toast-container');
            if (toastCont) toastCont.innerHTML = '';
            clone.querySelectorAll('link[rel="stylesheet"], link[rel="manifest"]').forEach(el => el.remove());
            clone.querySelectorAll('script[src]').forEach(el => el.remove());

            const head = clone.querySelector('head');
            const styleEl = document.createElement('style');
            styleEl.textContent = cssText;
            head.appendChild(styleEl);

            const body = clone.querySelector('body');
            const bundleScript = document.createElement('script');
            bundleScript.textContent = [seedDataScript, modelsJs, classesJs, appInitJs].join('\n\n');
            body.appendChild(bundleScript);

            const fullHtml = '<!DOCTYPE html>\n' + clone.outerHTML;
            const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            const suffix = includeCurrentData ? '_مع_البيانات' : '_نسخة_جديدة';
            a.href = url;
            a.download = `المحاسب_الذكي_نسخة_محمولة${suffix}.html`;
            a.click();
            URL.revokeObjectURL(url);
            this.showToast('✅ تم توليد وتحميل النسخة المحمولة الشاملة (ملف واحد يعمل على أي جهاز بدون إنترنت)!', 'success');
        } catch (err) {
            this.showToast('حدث خطأ أثناء توليد النسخة المحمولة: ' + err.message, 'error');
        }
    }

    // ==================== 1. لوحة التحكم (Dashboard) ====================
    renderDashboard() {
        const metrics = engine.getDashboardMetrics();
        const invReport = inventory.getInventoryValuationReport();
        const lowStock = inventory.getLowStockAlerts();

        const setTxt = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
        };

        setTxt('kpi-total-assets', engine.formatMoney(metrics.totalAssets));
        setTxt('kpi-cash-bank', engine.formatMoney(metrics.totalCashAndBank));
        setTxt('kpi-revenues', engine.formatMoney(metrics.totalRevenues));
        setTxt('kpi-expenses', engine.formatMoney(metrics.totalExpenses));
        setTxt('kpi-net-income', engine.formatMoney(metrics.netIncome));
        setTxt('kpi-inventory-val', engine.formatMoney(invReport.grandTotals.totalCostValue));
        setTxt('kpi-inventory-items', `${invReport.grandTotals.totalQty} قطعة (${storage.getProducts().length} صنف)`);

        const netIncomeSub = document.getElementById('kpi-net-income-sub');
        if (netIncomeSub) {
            if (metrics.isProfit) {
                netIncomeSub.className = 'metric-sub positive';
                netIncomeSub.textContent = '📈 صافي ربح للفترة';
            } else {
                netIncomeSub.className = 'metric-sub negative';
                netIncomeSub.textContent = '📉 صافي خسارة للفترة';
            }
        }

        // تنبيه النواقص إن وجد
        const alertBox = document.getElementById('dashboard-low-stock-alert-box');
        if (alertBox) {
            if (lowStock.length > 0) {
                alertBox.style.display = 'block';
                alertBox.innerHTML = `
                    <div style="background: var(--warning-bg); border: 1px solid var(--warning); border-radius: var(--radius-md); padding: 14px 18px; display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span style="font-size: 20px;">⚠️</span>
                            <div>
                                <strong style="color: #92400e;">تنبيه مخزون: يوجد ${lowStock.length} أصناف وصلت إلى حد إعادة الطلب أو نفدت!</strong>
                                <span style="font-size: 12.5px; color: #b45309; display: block;">يرجى مراجعة تقرير النواقص لإصدار طلبات التوريد.</span>
                            </div>
                        </div>
                        <button class="btn btn-sm btn-outline" style="background: #fff;" onclick="ui.switchTab('inventory_reports'); ui.showSubReport('low_stock');">
                            عرض النواقص ←
                        </button>
                    </div>
                `;
            } else {
                alertBox.style.display = 'none';
            }
        }

        // تنبيه الديون المتأخرة والمستحقة للتحصيل
        const debtAlertBox = document.getElementById('dashboard-overdue-debts-alert-box');
        if (debtAlertBox) {
            const aging = storage.getDebtAgingReport();
            if (aging.overdueCustomersCount > 0) {
                debtAlertBox.style.display = 'block';
                debtAlertBox.innerHTML = `
                    <div style="background: #fef2f2; border: 1px solid #fca5a5; border-radius: var(--radius-md); padding: 14px 18px; display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span style="font-size: 20px;">🔔</span>
                            <div>
                                <strong style="color: #991b1b;">تنبيه تحصيل ديون: يوجد (${aging.overdueCustomersCount}) عملاء تأخروا عن سداد ذممهم لأكثر من 15 يوماً!</strong>
                                <span style="font-size: 12.5px; color: #b91c1c; display: block;">إجمالي ديون العملاء في السوق: ${engine.formatMoney(aging.totalCustomerDebt)} — يمكنك نسخ إشعار مطالبة أو إصدار سند قبض.</span>
                            </div>
                        </div>
                        <button class="btn btn-sm btn-outline" style="background: #fff; color: #b91c1c; border-color: #fca5a5;" onclick="ui.switchTab('parties');">
                            متابعة وتحصيل الديون ←
                        </button>
                    </div>
                `;
            } else {
                debtAlertBox.style.display = 'none';
            }
        }

        // جدول أحدث العمليات والقيود
        const recentTbody = document.getElementById('dashboard-recent-entries-tbody');
        if (recentTbody) {
            if (metrics.recentEntries.length === 0) {
                recentTbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 30px;">لا توجد قيود مسجلة بعد.</td></tr>`;
            } else {
                recentTbody.innerHTML = metrics.recentEntries.map(entry => {
                    const totalAmount = entry.lines.reduce((sum, l) => sum + (parseFloat(l.debit) || 0), 0);
                    return `
                        <tr>
                            <td><strong style="color: var(--primary);">${entry.id}</strong></td>
                            <td>${entry.date}</td>
                            <td>${entry.description}</td>
                            <td class="num">${engine.formatMoney(totalAmount)}</td>
                            <td>
                                <button class="btn btn-outline btn-sm" onclick="ui.viewEntryVoucher('${entry.id}')">🔍 استعراض</button>
                            </td>
                        </tr>
                    `;
                }).join('');
            }
        }

        this.renderDashboardCharts(metrics);
    }

    renderDashboardCharts(metrics) {
        const canvas = document.getElementById('revenue-expense-chart');
        if (canvas) {
            const ctx = canvas.getContext('2d');
            const width = canvas.width = Math.max(canvas.parentElement.clientWidth || 350, 310);
            const height = canvas.height = 205;

            ctx.clearRect(0, 0, width, height);

            const rev = Math.max(metrics.totalRevenues, 0);
            const exp = Math.max(metrics.totalExpenses, 0);
            const net = Math.max(metrics.netIncome, 0);
            const cash = Math.max(metrics.totalCashAndBank, 0);
            const maxVal = Math.max(rev, exp, net, cash, 100);

            const bars = [
                { label: 'الإيرادات', val: rev, color: '#059669' },
                { label: 'المصروفات', val: exp, color: '#dc2626' },
                { label: 'صافي الربح', val: net, color: '#2563eb' },
                { label: 'السيولة النقدية', val: cash, color: '#0d9488' }
            ];

            const barWidth = Math.min(54, Math.floor((width - 90) / 4));
            const spacing = Math.min(28, Math.floor((width - barWidth * 4) / 5));
            const totalBarsWidth = (barWidth * 4) + (spacing * 3);
            const startX = Math.max(16, (width - totalBarsWidth) / 2);
            const chartHeight = height - 56;

            // خطوط شبكة خفيفة
            ctx.strokeStyle = '#e2e8f0';
            ctx.lineWidth = 1;
            for (let g = 0.25; g <= 1; g += 0.25) {
                const gy = height - 30 - (chartHeight * g);
                ctx.beginPath();
                ctx.moveTo(12, gy);
                ctx.lineTo(width - 12, gy);
                ctx.stroke();
            }

            bars.forEach((b, idx) => {
                const x = startX + idx * (barWidth + spacing);
                const h = Math.max(4, (b.val / maxVal) * chartHeight);
                const y = height - 30 - h;

                ctx.fillStyle = b.color;
                ctx.beginPath();
                if (typeof ctx.roundRect === 'function') {
                    ctx.roundRect(x, y, barWidth, h, [6, 6, 0, 0]);
                } else {
                    ctx.rect(x, y, barWidth, h);
                }
                ctx.fill();

                ctx.fillStyle = '#475569';
                ctx.font = 'bold 11px Cairo, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(b.label, x + barWidth / 2, height - 10);

                ctx.fillStyle = '#0f172a';
                ctx.font = 'bold 10.5px Cairo, sans-serif';
                ctx.fillText(engine.formatMoney(b.val), x + barWidth / 2, Math.max(y - 6, 13));
            });
        }

        // الرسم التفاعلي الثاني: أعلى الأصناف مبيعاً وتحليل الديون والأقساط
        const topBox = document.getElementById('dashboard-top-products-chart');
        if (topBox) {
            const invoices = storage.getInvoices().filter(inv => inv.type === 'SALES');
            const products = storage.getProducts();
            const prodStats = {};
            products.forEach(p => {
                prodStats[p.id] = { name: p.name, qtySold: 0, revenue: 0, stockVal: inventory.getProductStock(p.id) * (p.purchasePrice || 0) };
            });

            invoices.forEach(inv => {
                (inv.items || []).forEach(it => {
                    if (!prodStats[it.productId]) {
                        prodStats[it.productId] = { name: it.productName || it.productId, qtySold: 0, revenue: 0, stockVal: 0 };
                    }
                    const q = parseFloat(it.quantity) || 0;
                    const pr = parseFloat(it.unitPrice) || 0;
                    prodStats[it.productId].qtySold += q;
                    prodStats[it.productId].revenue += (q * pr);
                });
            });

            const sortedProds = Object.values(prodStats)
                .sort((a, b) => (b.revenue - a.revenue) || (b.stockVal - a.stockVal))
                .slice(0, 3);
            const maxMetric = Math.max(...sortedProds.map(p => p.revenue > 0 ? p.revenue : p.stockVal), 1);

            const aging = storage.getDebtAgingReport();
            const activePlans = (storage.getInstallmentPlans ? storage.getInstallmentPlans() : []).filter(pl => pl.status !== 'COMPLETED');
            const totalInstallmentRem = activePlans.reduce((s, pl) => s + (parseFloat(pl.remainingAmount) || 0), 0);

            topBox.innerHTML = `
                <div style="display: flex; flex-direction: column; gap: 8px;">
                    <div style="font-size: 12px; font-weight: 800; color: var(--text-secondary);">🔥 أعلى الأصناف حركة وقيمة:</div>
                    ${sortedProds.length === 0 ? `<div style="font-size: 12px; color: var(--text-muted);">لا توجد أصناف مسجلة بعد.</div>` : sortedProds.map(p => {
                        const val = p.revenue > 0 ? p.revenue : p.stockVal;
                        const pct = Math.min(100, Math.max(8, Math.round((val / maxMetric) * 100)));
                        const subTxt = p.revenue > 0 ? `مبيعات: ${engine.formatMoney(p.revenue)} (${p.qtySold})` : `قيمة مخزنية: ${engine.formatMoney(p.stockVal)}`;
                        return `
                            <div style="font-size: 12px;">
                                <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
                                    <strong style="color: var(--text-primary);">${this.escapeHtml(p.name)}</strong>
                                    <span class="num" style="color: var(--primary); font-weight: 700;">${subTxt}</span>
                                </div>
                                <div style="height: 7px; background: #e2e8f0; border-radius: 99px; overflow: hidden;">
                                    <div style="width: ${pct}%; height: 100%; background: linear-gradient(90deg, #2563eb, #10b981); border-radius: 99px;"></div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; padding-top: 8px; border-top: 1px dashed var(--border-color); font-size: 11.5px;">
                    <div style="background: #fef2f2; padding: 7px 9px; border-radius: 8px; border: 1px solid #fecaca;">
                        <span style="color: #991b1b; display: block;">ديون العملاء</span>
                        <strong class="num" style="color: #dc2626; font-size: 13px;">${engine.formatMoney(aging.totalCustomerDebt)}</strong>
                    </div>
                    <div style="background: #fffbeb; padding: 7px 9px; border-radius: 8px; border: 1px solid #fde68a;">
                        <span style="color: #92400e; display: block;">مستحقات الموردين</span>
                        <strong class="num" style="color: #d97706; font-size: 13px;">${engine.formatMoney(aging.totalSupplierDebt)}</strong>
                    </div>
                    <div style="background: #f5f3ff; padding: 7px 9px; border-radius: 8px; border: 1px solid #ddd6fe;">
                        <span style="color: #5b21b6; display: block;">أقساط قيد التحصيل</span>
                        <strong class="num" style="color: #6d28d9; font-size: 13px;">${engine.formatMoney(totalInstallmentRem)}</strong>
                    </div>
                </div>
            `;
        }
    }

    // ==================== 2. قسم المنتجات والأصناف (Products) ====================
    renderProducts() {
        const products = storage.getProducts();
        const searchInput = document.getElementById('products-search');
        const categoryFilter = document.getElementById('products-category-filter');

        const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
        const selectedCat = categoryFilter ? categoryFilter.value : 'all';

        // تحديث خيارات التصنيف في الفلتر بشكل ديناميكي دائماً
        if (categoryFilter) {
            const cats = Array.from(new Set(products.map(p => p.category).filter(Boolean)));
            categoryFilter.innerHTML = `<option value="all">جميع التصنيفات</option>` +
                cats.map(c => `<option value="${this.escapeHtml(c)}">${this.escapeHtml(c)}</option>`).join('');
            categoryFilter.value = cats.includes(selectedCat) ? selectedCat : 'all';
        }

        const filtered = products.filter(p => {
            const matchSearch = p.name.toLowerCase().includes(query) ||
                                p.sku.toLowerCase().includes(query) ||
                                (p.barcode && p.barcode.includes(query)) ||
                                (p.description && p.description.toLowerCase().includes(query));
            const matchCat = selectedCat === 'all' || p.category === selectedCat;
            return matchSearch && matchCat;
        });

        const tbody = document.getElementById('products-tbody');
        if (!tbody) return;

        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 30px; color: var(--text-muted);">لا توجد منتجات تطابق البحث. اضغط على "إضافة منتج جديد" أو "استيراد من Excel" للبدء.</td></tr>`;
            return;
        }

        tbody.innerHTML = filtered.map(product => {
            const currentStock = inventory.getProductStock(product.id);
            const totalCostValue = currentStock * (product.purchasePrice || 0);
            const isLowStock = currentStock <= (product.minStockAlert || 5) && currentStock > 0;
            const isOutOfStock = currentStock <= 0;

            let stockBadge = `<span class="badge" style="background:#ecfdf5; color:#047857;">${currentStock} ${product.unit}</span>`;
            if (isOutOfStock) {
                stockBadge = `<span class="badge" style="background:#fef2f2; color:#b91c1c;">نفد المخزون (0)</span>`;
            } else if (isLowStock) {
                stockBadge = `<span class="badge" style="background:#fffbeb; color:#b45309;">منخفض (${currentStock} ${product.unit}) ⚠️</span>`;
            }

            const wholesaleVal = (product.wholesalePrice !== undefined && product.wholesalePrice !== null && product.wholesalePrice !== '')
                ? parseFloat(product.wholesalePrice)
                : (parseFloat(product.sellingPrice) || 0);

            return `
                <tr>
                    <td><strong style="font-family: monospace; color: var(--primary); font-size: 13.5px;">${product.sku}</strong></td>
                    <td>
                        <strong>${product.name}</strong>
                        ${product.barcode ? `<div style="font-size: 11.5px; color: var(--text-muted);">باركود: ${product.barcode}</div>` : ''}
                        ${product.description ? `<div style="font-size: 11.5px; color: var(--text-secondary);">${product.description}</div>` : ''}
                    </td>
                    <td><span class="badge badge-asset">${product.category}</span></td>
                    <td class="num">${engine.formatMoney(product.purchasePrice)}</td>
                    <td class="num" style="color: var(--success); font-weight: 700;">${engine.formatMoney(product.sellingPrice)}</td>
                    <td class="num" style="color: #1d4ed8; font-weight: 700;">${engine.formatMoney(wholesaleVal)}</td>
                    <td>${stockBadge}</td>
                    <td class="num"><strong>${engine.formatMoney(totalCostValue)}</strong></td>
                    <td>
                        <div style="display: flex; gap: 6px; justify-content: flex-end;">
                            <button class="btn btn-outline btn-sm" onclick="ui.openBarcodeModal('${product.id}')" title="طباعة ملصق باركود للصنف">
                                🏷️
                            </button>
                            <button class="btn btn-outline btn-sm" onclick="ui.viewItemCard('${product.id}')" title="بطاقة حركة الصنف">
                                📊 حركة
                            </button>
                            <button class="btn btn-outline btn-sm" onclick="ui.openProductModal('${product.id}')" title="تعديل">
                                ✏️
                            </button>
                            <button class="btn btn-outline btn-sm" style="color: var(--danger);" onclick="ui.confirmDeleteProduct('${product.id}')" title="حذف">
                                🗑️
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    openProductModal(productId = null) {
        this.editingProductId = productId;
        const modal = document.getElementById('product-modal');
        const form = document.getElementById('product-form');
        const modalTitle = document.getElementById('product-modal-title');
        
        const skuInput = document.getElementById('prod-form-sku');
        const barcodeInput = document.getElementById('prod-form-barcode');
        const nameInput = document.getElementById('prod-form-name');
        const catInput = document.getElementById('prod-form-cat');
        const unitInput = document.getElementById('prod-form-unit');
        const buyPriceInput = document.getElementById('prod-form-buy-price');
        const sellPriceInput = document.getElementById('prod-form-sell-price');
        const wholesalePriceInput = document.getElementById('prod-form-wholesale-price');
        const minStockInput = document.getElementById('prod-form-min-stock');
        const descInput = document.getElementById('prod-form-desc');

        // خيارات الوحدات
        if (unitInput) {
            unitInput.innerHTML = PRODUCT_UNITS.map(u => `<option value="${u}">${u}</option>`).join('');
        }

        if (productId) {
            const p = storage.getProductById(productId);
            if (!p) return;
            modalTitle.textContent = `تعديل الصنف: ${p.name}`;
            skuInput.value = p.sku;
            barcodeInput.value = p.barcode || '';
            nameInput.value = p.name;
            catInput.value = p.category || 'عام';
            unitInput.value = p.unit || 'حبة / قطعة';
            buyPriceInput.value = p.purchasePrice || '';
            sellPriceInput.value = p.sellingPrice || '';
            if (wholesalePriceInput) wholesalePriceInput.value = (p.wholesalePrice !== undefined && p.wholesalePrice !== null) ? p.wholesalePrice : (p.sellingPrice || '');
            minStockInput.value = p.minStockAlert || 5;
            descInput.value = p.description || '';
        } else {
            modalTitle.textContent = 'إضافة صنف / منتج جديد';
            form.reset();
            const nextSkuNum = 100 + storage.getProducts().length + 1;
            skuInput.value = `PRD-${nextSkuNum}`;
            if (wholesalePriceInput) wholesalePriceInput.value = '';
            minStockInput.value = 5;
        }

        this.openModal('product-modal');
    }

    saveProductFromForm() {
        const sku = document.getElementById('prod-form-sku').value.trim();
        const barcode = document.getElementById('prod-form-barcode').value.trim();
        const name = document.getElementById('prod-form-name').value.trim();
        const category = document.getElementById('prod-form-cat').value.trim();
        const unit = document.getElementById('prod-form-unit').value;
        const purchasePrice = parseFloat(document.getElementById('prod-form-buy-price').value) || 0;
        const sellingPrice = parseFloat(document.getElementById('prod-form-sell-price').value) || 0;
        const wholesaleRaw = document.getElementById('prod-form-wholesale-price')?.value;
        const wholesalePrice = (wholesaleRaw !== undefined && String(wholesaleRaw).trim() !== '')
            ? (parseFloat(wholesaleRaw) || 0)
            : sellingPrice;
        const minStockAlert = parseInt(document.getElementById('prod-form-min-stock').value) || 5;
        const description = document.getElementById('prod-form-desc').value.trim();

        if (!sku || !name) {
            this.showToast('يرجى ملء كود الصنف واسم المنتج على الأقل!', 'error');
            return;
        }

        try {
            if (this.editingProductId) {
                storage.updateProduct(this.editingProductId, {
                    sku, barcode, name, category, unit, purchasePrice, sellingPrice, wholesalePrice, minStockAlert, description
                });
                this.showToast('تم تحديث بيانات المنتج بنجاح', 'success');
            } else {
                storage.addProduct({
                    sku, barcode, name, category, unit, purchasePrice, sellingPrice, wholesalePrice, minStockAlert, description
                });
                this.showToast('تمت إضافة المنتج الجديد بنجاح', 'success');
            }
            this.closeModal();
            this.renderProducts();
            this.renderDashboard();
        } catch (err) {
            this.showToast(err.message, 'error');
        }
    }

    confirmDeleteProduct(productId) {
        const p = storage.getProductById(productId);
        if (!p) return;
        if (confirm(`هل أنت متأكد من رغبتك في حذف الصنف (${p.name})؟`)) {
            try {
                storage.deleteProduct(productId);
                this.showToast('تم حذف المنتج بنجاح', 'success');
                this.renderProducts();
                this.renderDashboard();
            } catch (err) {
                this.showToast(err.message, 'error');
            }
        }
    }

    // ==================== 3. قسم المستودعات والمخازن (Warehouses) ====================
    renderWarehouses() {
        const warehouses = storage.getWarehouses();
        const { matrix } = inventory.calculateStockMatrix();
        const products = storage.getProducts();

        const grid = document.getElementById('warehouses-grid');
        if (!grid) return;

        grid.innerHTML = warehouses.map(w => {
            // احتساب إجمالي كميات وقيم البضاعة في هذا المستودع
            let totalQty = 0;
            let totalValue = 0;

            products.forEach(p => {
                const q = (matrix[p.id] && matrix[p.id][w.id]) ? matrix[p.id][w.id] : 0;
                totalQty += q;
                totalValue += q * (p.purchasePrice || 0);
            });

            return `
                <div class="card" style="margin-bottom: 0;">
                    <div class="card-header" style="background: ${w.isDefault ? '#eff6ff' : '#fafbfc'};">
                        <div>
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <h3 style="margin-bottom: 0;">🏬 ${w.name}</h3>
                                ${w.isDefault ? '<span class="badge badge-asset" style="font-size: 11px;">المستودع الرئيسي الافتراضي</span>' : ''}
                            </div>
                            <span style="font-size: 12px; color: var(--text-muted); font-family: monospace;">كود: ${w.code}</span>
                        </div>
                        <div style="display: flex; gap: 6px;">
                            <button class="btn btn-outline btn-sm" onclick="ui.openWarehouseModal('${w.id}')" title="تعديل">✏️</button>
                            ${!w.isDefault ? `<button class="btn btn-outline btn-sm" style="color: var(--danger);" onclick="ui.confirmDeleteWarehouse('${w.id}')" title="حذف">🗑️</button>` : ''}
                        </div>
                    </div>
                    <div class="card-body">
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; background: #f8fafc; padding: 14px; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
                            <div>
                                <span style="font-size: 12px; color: var(--text-muted); display: block;">إجمالي القطع المخزنة:</span>
                                <strong style="font-size: 16px; color: var(--primary);">${totalQty} قطعة</strong>
                            </div>
                            <div>
                                <span style="font-size: 12px; color: var(--text-muted); display: block;">إجمالي القيمة الدفترية:</span>
                                <strong style="font-size: 16px; color: var(--success);">${engine.formatMoney(totalValue)}</strong>
                            </div>
                        </div>

                        <div style="font-size: 13px; display: flex; flex-direction: column; gap: 6px; color: var(--text-secondary);">
                            <div><strong>📍 الموقع:</strong> ${w.location || 'غير محدد'}</div>
                            <div><strong>👤 أمين المستودع:</strong> ${w.keeper || 'غير محدد'}</div>
                            <div><strong>📞 الهاتف:</strong> ${w.phone || '-'}</div>
                            ${w.notes ? `<div><strong>📝 ملاحظات:</strong> ${w.notes}</div>` : ''}
                        </div>

                        <div style="margin-top: 18px; padding-top: 14px; border-top: 1px solid var(--border-color); display: flex; gap: 8px;">
                            <button class="btn btn-outline btn-sm" style="flex: 1;" onclick="ui.showWarehouseStockModal('${w.id}')">
                                📦 عرض بضاعة المستودع
                            </button>
                            <button class="btn btn-outline btn-sm" onclick="ui.openTransferModal('${w.id}')" title="تحويل من هذا المستودع">
                                🔄 تحويل
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    openWarehouseModal(warehouseId = null) {
        this.editingWarehouseId = warehouseId;
        const modal = document.getElementById('warehouse-modal');
        const form = document.getElementById('warehouse-form');
        const modalTitle = document.getElementById('warehouse-modal-title');
        
        const codeInput = document.getElementById('wh-form-code');
        const nameInput = document.getElementById('wh-form-name');
        const locInput = document.getElementById('wh-form-loc');
        const keeperInput = document.getElementById('wh-form-keeper');
        const phoneInput = document.getElementById('wh-form-phone');
        const isDefInput = document.getElementById('wh-form-is-default');
        const notesInput = document.getElementById('wh-form-notes');

        if (warehouseId) {
            const w = storage.getWarehouseById(warehouseId);
            if (!w) return;
            modalTitle.textContent = `تعديل المستودع: ${w.name}`;
            codeInput.value = w.code;
            nameInput.value = w.name;
            locInput.value = w.location || '';
            keeperInput.value = w.keeper || '';
            phoneInput.value = w.phone || '';
            isDefInput.checked = Boolean(w.isDefault);
            notesInput.value = w.notes || '';
        } else {
            modalTitle.textContent = 'إضافة مستودع / مخزن جديد';
            form.reset();
            const nextCode = `WH-${String(storage.getWarehouses().length + 1).padStart(2, '0')}`;
            codeInput.value = nextCode;
            isDefInput.checked = false;
        }

        this.openModal('warehouse-modal');
    }

    saveWarehouseFromForm() {
        const code = document.getElementById('wh-form-code').value.trim();
        const name = document.getElementById('wh-form-name').value.trim();
        const location = document.getElementById('wh-form-loc').value.trim();
        const keeper = document.getElementById('wh-form-keeper').value.trim();
        const phone = document.getElementById('wh-form-phone').value.trim();
        const isDefault = document.getElementById('wh-form-is-default').checked;
        const notes = document.getElementById('wh-form-notes').value.trim();

        if (!code || !name) {
            this.showToast('يرجى إدخال كود واسم المستودع!', 'error');
            return;
        }

        try {
            if (this.editingWarehouseId) {
                storage.updateWarehouse(this.editingWarehouseId, {
                    code, name, location, keeper, phone, isDefault, notes
                });
                this.showToast('تم تحديث بيانات المستودع بنجاح', 'success');
            } else {
                storage.addWarehouse({
                    code, name, location, keeper, phone, isDefault, notes
                });
                this.showToast('تمت إضافة المستودع الجديد بنجاح', 'success');
            }
            this.closeModal();
            this.renderWarehouses();
        } catch (err) {
            this.showToast(err.message, 'error');
        }
    }

    confirmDeleteWarehouse(warehouseId) {
        const w = storage.getWarehouseById(warehouseId);
        if (!w) return;
        if (confirm(`هل أنت متأكد من حذف المستودع (${w.name})؟`)) {
            try {
                storage.deleteWarehouse(warehouseId);
                this.showToast('تم حذف المستودع بنجاح', 'success');
                this.renderWarehouses();
            } catch (err) {
                this.showToast(err.message, 'error');
            }
        }
    }

    showWarehouseStockModal(warehouseId) {
        const w = storage.getWarehouseById(warehouseId);
        if (!w) return;
        const { matrix } = inventory.calculateStockMatrix();
        const products = storage.getProducts();

        const content = document.getElementById('wh-stock-modal-content');
        const title = document.getElementById('wh-stock-modal-title');
        if (title) title.textContent = `محتويات وجرد مستودع: ${w.name}`;

        if (content) {
            content.innerHTML = `
                <table class="acc-table">
                    <thead>
                        <tr>
                            <th>كود الصنف SKU</th>
                            <th>اسم المنتج</th>
                            <th>التصنيف</th>
                            <th class="num">الكمية المتوفرة</th>
                            <th class="num">سعر التكلفة</th>
                            <th class="num">إجمالي القيمة</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${products.map(p => {
                            const qty = (matrix[p.id] && matrix[p.id][w.id]) ? matrix[p.id][w.id] : 0;
                            const totalVal = qty * (p.purchasePrice || 0);
                            return `
                                <tr>
                                    <td style="font-family: monospace;">${p.sku}</td>
                                    <td><strong>${p.name}</strong></td>
                                    <td><span class="badge badge-asset">${p.category}</span></td>
                                    <td class="num"><strong>${qty} ${p.unit}</strong></td>
                                    <td class="num">${engine.formatMoney(p.purchasePrice)}</td>
                                    <td class="num">${engine.formatMoney(totalVal)}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            `;
        }

        this.openModal('warehouse-stock-modal');
    }

    // ==================== 4. حركات المخزون والتحويل والتسوية (Stock Ops) ====================
    renderStockOps() {
        const txs = storage.getInventoryTransactions();
        const searchInput = document.getElementById('stock-ops-search');
        const typeFilter = document.getElementById('stock-ops-type-filter');

        const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
        const selectedType = typeFilter ? typeFilter.value : 'all';

        const filtered = txs.filter(t => {
            const product = storage.getProductById(t.productId);
            const prodName = product ? product.name.toLowerCase() : '';
            const prodSku = product ? product.sku.toLowerCase() : '';
            const matchSearch = (t.reference && t.reference.toLowerCase().includes(query)) ||
                                (t.reason && t.reason.toLowerCase().includes(query)) ||
                                prodName.includes(query) ||
                                prodSku.includes(query);
            const matchType = selectedType === 'all' || t.type === selectedType;
            return matchSearch && matchType;
        });

        const tbody = document.getElementById('stock-ops-tbody');
        if (!tbody) return;

        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 30px; color: var(--text-muted);">لا توجد حركات مخزنية مسجلة تطابق البحث.</td></tr>`;
            return;
        }

        tbody.innerHTML = filtered.map(t => {
            const product = storage.getProductById(t.productId);
            const unit = product ? product.unit : '';

            let typeBadge = '';
            let locationDesc = '';

            if (t.type === 'TRANSFER') {
                const fromW = storage.getWarehouseById(t.fromWarehouseId);
                const toW = storage.getWarehouseById(t.toWarehouseId);
                typeBadge = `<span class="badge" style="background:#eff6ff; color:#1d4ed8;">🔄 تحويل مخزني</span>`;
                locationDesc = `<div style="font-size: 12px; color: var(--text-secondary);">من: <strong>${fromW ? fromW.name : t.fromWarehouseId}</strong> ← إلى: <strong>${toW ? toW.name : t.toWarehouseId}</strong></div>`;
            } else if (t.type === 'ADJUSTMENT') {
                const w = storage.getWarehouseById(t.warehouseId);
                const isInc = t.adjustmentType === 'INCREASE';
                typeBadge = isInc 
                    ? `<span class="badge" style="background:#ecfdf5; color:#047857;">➕ تسوية (فائض جرد)</span>`
                    : `<span class="badge" style="background:#fef2f2; color:#b91c1c;">➖ تسوية (عجز / تالف)</span>`;
                locationDesc = `<div style="font-size: 12px; color: var(--text-secondary);">المستودع: <strong>${w ? w.name : t.warehouseId}</strong></div>`;
            } else if (t.type === 'IN') {
                const w = storage.getWarehouseById(t.warehouseId);
                typeBadge = `<span class="badge" style="background:#ecfdf5; color:#047857;">📥 توريد / إضافة</span>`;
                locationDesc = `<div style="font-size: 12px; color: var(--text-secondary);">المستودع: <strong>${w ? w.name : t.warehouseId}</strong></div>`;
            } else if (t.type === 'OUT') {
                const w = storage.getWarehouseById(t.warehouseId);
                typeBadge = `<span class="badge" style="background:#fef2f2; color:#b91c1c;">📤 صرف / إخراج</span>`;
                locationDesc = `<div style="font-size: 12px; color: var(--text-secondary);">المستودع: <strong>${w ? w.name : t.warehouseId}</strong></div>`;
            }

            return `
                <tr>
                    <td><strong style="color: var(--primary); font-family: monospace;">${t.id}</strong></td>
                    <td>${t.date}</td>
                    <td>${typeBadge}</td>
                    <td>
                        <strong>${product ? product.name : t.productId}</strong>
                        ${locationDesc}
                        ${t.reason ? `<div style="font-size: 11.5px; color: var(--text-muted);">${t.reason}</div>` : ''}
                    </td>
                    <td class="num"><strong>${t.quantity} ${unit}</strong></td>
                    <td class="num">${engine.formatMoney(t.totalCost || (t.quantity * (t.unitCost || 0)))}</td>
                    <td>
                        <div style="display: flex; gap: 6px; align-items: center;">
                            ${t.journalEntryId ? `
                                <button class="btn btn-outline btn-sm" onclick="ui.viewEntryVoucher('${t.journalEntryId}')" title="عرض القيد المحاسبي">
                                    📑 قيد ${t.journalEntryId}
                                </button>
                            ` : '<span style="font-size: 11.5px; color: var(--text-muted);">بدون قيد</span>'}
                            <button class="btn btn-outline btn-sm" style="color: var(--danger); padding: 4px 8px;" onclick="ui.confirmDeleteInventoryTx('${t.id}')" title="حذف الحركة">
                                🗑️
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    openTransferModal(sourceWarehouseId = null) {
        const modal = document.getElementById('transfer-modal');
        const form = document.getElementById('transfer-form');
        form.reset();

        const fromSelect = document.getElementById('tr-from-wh');
        const toSelect = document.getElementById('tr-to-wh');
        const prodSelect = document.getElementById('tr-product');
        const dateInput = document.getElementById('tr-date');
        const availSpan = document.getElementById('tr-avail-stock');

        const warehouses = storage.getWarehouses();
        const products = storage.getProducts();

        fromSelect.innerHTML = `<option value="">-- اختر مستودع المصدر --</option>` +
            warehouses.map(w => `<option value="${w.id}" ${sourceWarehouseId === w.id ? 'selected' : ''}>${w.name}</option>`).join('');

        toSelect.innerHTML = `<option value="">-- اختر مستودع الوجهة --</option>` +
            warehouses.map(w => `<option value="${w.id}">${w.name}</option>`).join('');

        prodSelect.innerHTML = `<option value="">-- اختر المنتج / الصنف --</option>` +
            products.map(p => `<option value="${p.id}">${p.sku} - ${p.name}</option>`).join('');

        dateInput.value = new Date().toISOString().split('T')[0];
        if (availSpan) availSpan.textContent = '0';

        this.openModal('transfer-modal');
    }

    updateTransferAvailableStock() {
        const fromW = document.getElementById('tr-from-wh')?.value;
        const pId = document.getElementById('tr-product')?.value;
        const span = document.getElementById('tr-avail-stock');
        if (!span) return;

        if (fromW && pId) {
            const stock = inventory.getProductStock(pId, fromW);
            const product = storage.getProductById(pId);
            span.textContent = `${stock} ${product ? product.unit : ''}`;
        } else {
            span.textContent = '0';
        }
    }

    saveTransferFromForm() {
        const fromWarehouseId = document.getElementById('tr-from-wh').value;
        const toWarehouseId = document.getElementById('tr-to-wh').value;
        const productId = document.getElementById('tr-product').value;
        const quantity = parseFloat(document.getElementById('tr-qty').value);
        const date = document.getElementById('tr-date').value;
        const reference = document.getElementById('tr-ref').value.trim();
        const reason = document.getElementById('tr-reason').value.trim();

        try {
            inventory.executeTransfer({
                fromWarehouseId,
                toWarehouseId,
                productId,
                quantity,
                date,
                reference,
                reason
            });

            this.showToast('تم تسجيل وتنفيذ التحويل المخزني بنجاح', 'success');
            this.closeModal();
            this.renderStockOps();
            this.renderProducts();
            this.renderWarehouses();
            this.renderDashboard();
        } catch (err) {
            this.showToast(err.message, 'error');
        }
    }

    openAdjustmentModal() {
        const modal = document.getElementById('adjustment-modal');
        const form = document.getElementById('adjustment-form');
        form.reset();

        const whSelect = document.getElementById('adj-wh');
        const prodSelect = document.getElementById('adj-prod');
        const dateInput = document.getElementById('adj-date');
        const unitCostInput = document.getElementById('adj-cost');
        const autoJvCheck = document.getElementById('adj-auto-jv');

        const warehouses = storage.getWarehouses();
        const products = storage.getProducts();

        whSelect.innerHTML = `<option value="">-- اختر المستودع --</option>` +
            warehouses.map(w => `<option value="${w.id}">${w.name}</option>`).join('');

        prodSelect.innerHTML = `<option value="">-- اختر الصنف المراد تسويته --</option>` +
            products.map(p => `<option value="${p.id}" data-cost="${p.purchasePrice}">${p.sku} - ${p.name}</option>`).join('');

        dateInput.value = new Date().toISOString().split('T')[0];
        if (autoJvCheck) autoJvCheck.checked = true;

        this.openModal('adjustment-modal');
    }

    onAdjustmentProductSelect() {
        const prodSelect = document.getElementById('adj-prod');
        const costInput = document.getElementById('adj-cost');
        const whSelect = document.getElementById('adj-wh');
        const currentStockSpan = document.getElementById('adj-current-stock');

        if (!prodSelect || !costInput) return;
        const opt = prodSelect.options[prodSelect.selectedIndex];
        const cost = opt?.getAttribute('data-cost') || 0;
        costInput.value = cost;

        if (whSelect && currentStockSpan && prodSelect.value && whSelect.value) {
            const stock = inventory.getProductStock(prodSelect.value, whSelect.value);
            const p = storage.getProductById(prodSelect.value);
            currentStockSpan.textContent = `الرصيد الحالي بالمستودع: ${stock} ${p ? p.unit : ''}`;
        }
    }

    saveAdjustmentFromForm() {
        const warehouseId = document.getElementById('adj-wh').value;
        const productId = document.getElementById('adj-prod').value;
        const adjustmentType = document.querySelector('input[name="adj-type"]:checked')?.value || 'INCREASE';
        const quantity = parseFloat(document.getElementById('adj-qty').value);
        const unitCost = parseFloat(document.getElementById('adj-cost').value) || 0;
        const date = document.getElementById('adj-date').value;
        const reference = document.getElementById('adj-ref').value.trim();
        const reason = document.getElementById('adj-reason').value.trim();
        const createJournalEntry = document.getElementById('adj-auto-jv').checked;

        try {
            const result = inventory.executeAdjustment({
                warehouseId,
                productId,
                adjustmentType,
                quantity,
                unitCost,
                date,
                reference,
                reason,
                createJournalEntry
            });

            let msg = 'تمت التسوية المخزنية بنجاح وتحديث الأرصدة!';
            if (result.journalEntryId) {
                msg += ` وتم توليد القيد المحاسبي (${result.journalEntryId}) تلقائياً.`;
            }

            this.showToast(msg, 'success');
            this.closeModal();
            this.renderStockOps();
            this.renderProducts();
            this.renderWarehouses();
            this.renderDashboard();
        } catch (err) {
            this.showToast(err.message, 'error');
        }
    }

    openStockInModal() {
        const modal = document.getElementById('stock-in-modal');
        const form = document.getElementById('stock-in-form');
        form.reset();

        const whSelect = document.getElementById('in-wh');
        const prodSelect = document.getElementById('in-prod');
        const dateInput = document.getElementById('in-date');
        const costInput = document.getElementById('in-cost');

        const warehouses = storage.getWarehouses();
        const products = storage.getProducts();

        whSelect.innerHTML = `<option value="">-- اختر المستودع --</option>` +
            warehouses.map(w => `<option value="${w.id}">${w.name}</option>`).join('');

        prodSelect.innerHTML = `<option value="">-- اختر الصنف المراد توريده --</option>` +
            products.map(p => `<option value="${p.id}" data-cost="${p.purchasePrice}">${p.sku} - ${p.name}</option>`).join('');

        dateInput.value = new Date().toISOString().split('T')[0];

        this.openModal('stock-in-modal');
    }

    onStockInProductSelect() {
        const prodSelect = document.getElementById('in-prod');
        const costInput = document.getElementById('in-cost');
        if (!prodSelect || !costInput) return;
        const opt = prodSelect.options[prodSelect.selectedIndex];
        const cost = opt?.getAttribute('data-cost');
        if (cost !== null && cost !== undefined && cost !== '') {
            costInput.value = cost;
        }
    }

    saveStockInFromForm() {
        const warehouseId = document.getElementById('in-wh').value;
        const productId = document.getElementById('in-prod').value;
        const quantity = parseFloat(document.getElementById('in-qty').value);
        const unitCost = parseFloat(document.getElementById('in-cost').value) || 0;
        const date = document.getElementById('in-date').value;
        const reference = document.getElementById('in-ref').value.trim();
        const reason = document.getElementById('in-reason').value.trim();

        try {
            inventory.executeStockIn({ warehouseId, productId, quantity, unitCost, date, reference, reason });
            this.showToast('تم تسجيل التوريد المخزني بنجاح', 'success');
            this.closeModal();
            this.renderStockOps();
            this.renderProducts();
            this.renderWarehouses();
            this.renderDashboard();
        } catch (err) {
            this.showToast(err.message, 'error');
        }
    }

    confirmDeleteInventoryTx(txId) {
        if (confirm(`هل أنت متأكد من رغبتك في حذف الحركة المخزنية (${txId})؟`)) {
            try {
                storage.deleteInventoryTransaction(txId);
                this.showToast('تم حذف الحركة المخزنية بنجاح', 'success');
                this.renderStockOps();
                this.renderProducts();
                this.renderWarehouses();
                this.renderDashboard();
            } catch (err) {
                this.showToast(err.message, 'error');
            }
        }
    }

    // ==================== 5. تقارير المخزون الشاملة (Inventory Reports) ====================
    renderInventoryReports() {
        const subReport = document.querySelector('input[name="inv-report-sub"]:checked')?.value || 'valuation';
        const whFilter = document.getElementById('inv-rep-wh-filter');
        const prodSelect = document.getElementById('inv-rep-prod-select');

        // تعبئة قوائم الفلاتر مع الحفاظ على الاختيار الحالي
        if (whFilter) {
            const currentWh = whFilter.value || 'all';
            const warehouses = storage.getWarehouses();
            whFilter.innerHTML = `<option value="all">جميع المستودعات</option>` +
                warehouses.map(w => `<option value="${w.id}">${this.escapeHtml(w.name)}</option>`).join('');
            whFilter.value = warehouses.some(w => w.id === currentWh) ? currentWh : 'all';
        }

        if (prodSelect) {
            const currentProd = prodSelect.value || '';
            const products = storage.getProducts();
            prodSelect.innerHTML = `<option value="">-- اختر الصنف لعرض بطاقة حركته --</option>` +
                products.map(p => `<option value="${p.id}">${this.escapeHtml(p.sku)} - ${this.escapeHtml(p.name)}</option>`).join('');
            prodSelect.value = products.some(p => p.id === currentProd) ? currentProd : '';
        }

        this.showSubReport(subReport);
    }

    showSubReport(type) {
        // تحديث الراديو
        const radio = document.querySelector(`input[name="inv-report-sub"][value="${type}"]`);
        if (radio) radio.checked = true;

        const container = document.getElementById('inv-report-content');
        if (!container) return;

        const itemCardBar = document.getElementById('inv-rep-item-card-bar');
        if (itemCardBar) {
            itemCardBar.style.display = type === 'item_card' ? 'flex' : 'none';
        }

        if (type === 'valuation') {
            this.renderValuationReport(container);
        } else if (type === 'item_card') {
            this.renderItemCardReport(container);
        } else if (type === 'adjustments') {
            this.renderAdjustmentsReport(container);
        } else if (type === 'low_stock') {
            this.renderLowStockReport(container);
        } else if (type === 'profitability') {
            this.renderProfitabilitySubReport(container);
        }
    }

    renderValuationReport(container) {
        const whId = document.getElementById('inv-rep-wh-filter')?.value || 'all';
        const report = inventory.getInventoryValuationReport(whId);
        const settings = storage.getSettings();

        container.innerHTML = `
            <div class="voucher-paper">
                <div class="voucher-header">
                    <h2>${settings.companyName}</h2>
                    <div class="sub-title">تقرير جرد وتقييم المخزون العام (Inventory Valuation)</div>
                    <div style="font-size: 13px; color: var(--text-muted); margin-top: 4px;">
                        المستودع: <strong>${whId === 'all' ? 'كافة المستودعات والفروع' : storage.getWarehouseById(whId)?.name}</strong>
                    </div>
                </div>

                <!-- بطاقات إجماليات التقييم -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px; background: #f8fafc; padding: 16px; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
                    <div>
                        <span style="font-size: 12px; color: var(--text-muted); display: block;">إجمالي كمية القطع:</span>
                        <strong style="font-size: 17px; color: var(--primary);">${report.grandTotals.totalQty} قطعة</strong>
                    </div>
                    <div>
                        <span style="font-size: 12px; color: var(--text-muted); display: block;">إجمالي قيمة التكلفة (شراء):</span>
                        <strong style="font-size: 17px; color: #1e3a8a;">${engine.formatMoney(report.grandTotals.totalCostValue)}</strong>
                    </div>
                    <div>
                        <span style="font-size: 12px; color: var(--text-muted); display: block;">إجمالي القيمة السوقية (بيع):</span>
                        <strong style="font-size: 17px; color: var(--success);">${engine.formatMoney(report.grandTotals.totalSellingValue)}</strong>
                    </div>
                    <div>
                        <span style="font-size: 12px; color: var(--text-muted); display: block;">هامش الربح التقديري المتوقع:</span>
                        <strong style="font-size: 17px; color: #059669;">${engine.formatMoney(report.grandTotals.totalSellingValue - report.grandTotals.totalCostValue)}</strong>
                    </div>
                </div>

                <div class="table-responsive">
                    <table class="acc-table">
                        <thead>
                            <tr>
                                <th>كود SKU</th>
                                <th>اسم الصنف / المنتج</th>
                                <th>التصنيف</th>
                                <th class="num">الكمية المتوفرة</th>
                                <th class="num">سعر التكلفة</th>
                                <th class="num">إجمالي قيمة التكلفة</th>
                                <th class="num">سعر البيع</th>
                                <th class="num">إجمالي قيمة البيع</th>
                                <th>الحالة</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${report.rows.map(r => `
                                <tr>
                                    <td style="font-family: monospace;">${r.product.sku}</td>
                                    <td><strong>${r.product.name}</strong></td>
                                    <td><span class="badge badge-asset">${r.product.category}</span></td>
                                    <td class="num"><strong>${r.quantity} ${r.product.unit}</strong></td>
                                    <td class="num">${engine.formatMoney(r.unitCost)}</td>
                                    <td class="num"><strong>${engine.formatMoney(r.totalCostValue)}</strong></td>
                                    <td class="num">${engine.formatMoney(r.sellingPrice)}</td>
                                    <td class="num" style="color: var(--success);">${engine.formatMoney(r.totalSellingValue)}</td>
                                    <td><span class="badge" style="background:${r.isOutOfStock ? '#fef2f2' : (r.isLowStock ? '#fffbeb' : '#ecfdf5')}; color:${r.isOutOfStock ? '#b91c1c' : (r.isLowStock ? '#b45309' : '#047857')};">${r.statusText}</span></td>
                                </tr>
                            `).join('')}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td colspan="3"><strong>الإجمــــــــــالي العــــــــــام</strong></td>
                                <td class="num"><strong>${report.grandTotals.totalQty} قطعة</strong></td>
                                <td>-</td>
                                <td class="num" style="color: #1e3a8a; font-size: 15px;"><strong>${engine.formatMoney(report.grandTotals.totalCostValue)}</strong></td>
                                <td>-</td>
                                <td class="num" style="color: var(--success); font-size: 15px;"><strong>${engine.formatMoney(report.grandTotals.totalSellingValue)}</strong></td>
                                <td>-</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        `;
    }

    renderItemCardReport(container) {
        const prodId = document.getElementById('inv-rep-prod-select')?.value;
        const whId = document.getElementById('inv-rep-wh-filter')?.value || 'all';
        const fromDate = document.getElementById('inv-rep-date-from')?.value || '';
        const toDate = document.getElementById('inv-rep-date-to')?.value || '';

        if (!prodId) {
            container.innerHTML = `
                <div style="text-align: center; padding: 50px 20px; color: var(--text-muted); background: var(--bg-surface); border-radius: var(--radius-lg); border: 1px dashed var(--border-dark);">
                    <div style="font-size: 40px; margin-bottom: 10px;">📋</div>
                    <h3>يرجى اختيار منتج أو صنف من القائمة أعلاه لعرض بطاقة حركته بالتفصيل</h3>
                </div>
            `;
            return;
        }

        const card = inventory.getItemCardReport(prodId, whId, fromDate, toDate);
        if (!card) return;
        const settings = storage.getSettings();

        container.innerHTML = `
            <div class="voucher-paper">
                <div class="voucher-header">
                    <h2>${settings.companyName}</h2>
                    <div class="sub-title">بطاقة حركة صنف مخزني (Stock Item Movement Card)</div>
                    <div style="font-size: 14px; font-weight: 700; color: var(--primary); margin-top: 6px;">
                        ${card.product.name} (كود: ${card.product.sku})
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px; margin-bottom: 20px; background: #f8fafc; padding: 14px; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
                    <div>
                        <span style="font-size: 12px; color: var(--text-muted); display: block;">الرصيد الافتتاحي:</span>
                        <strong style="font-size: 15px;">${card.openingBalance} ${card.product.unit}</strong>
                    </div>
                    <div>
                        <span style="font-size: 12px; color: var(--text-muted); display: block;">إجمالي الوارد والإضافات (+):</span>
                        <strong style="font-size: 15px; color: var(--success);">${card.totalPeriodIn} ${card.product.unit}</strong>
                    </div>
                    <div>
                        <span style="font-size: 12px; color: var(--text-muted); display: block;">إجمالي الصادر والمنصرف (-):</span>
                        <strong style="font-size: 15px; color: var(--danger);">${card.totalPeriodOut} ${card.product.unit}</strong>
                    </div>
                    <div>
                        <span style="font-size: 12px; color: var(--text-muted); display: block;">الرصيد الختامي الحالي:</span>
                        <strong style="font-size: 16px; color: var(--primary);">${card.closingBalance} ${card.product.unit}</strong>
                    </div>
                </div>

                <div class="table-responsive">
                    <table class="acc-table">
                        <thead>
                            <tr>
                                <th style="width: 12%;">التاريخ</th>
                                <th style="width: 16%;">نوع الحركة</th>
                                <th style="width: 20%;">المستودع / الأطراف</th>
                                <th style="width: 24%;">البيان والشرح</th>
                                <th class="num" style="width: 10%;">وارد (+)</th>
                                <th class="num" style="width: 10%;">صادر (-)</th>
                                <th class="num" style="width: 12%;">الرصيد التراكمي</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr style="background: #fdfdfd; font-style: italic;">
                                <td>${fromDate || '-'}</td>
                                <td>-</td>
                                <td>-</td>
                                <td><strong>الرصيد الافتتاحي المنقول</strong></td>
                                <td class="num">-</td>
                                <td class="num">-</td>
                                <td class="num"><strong>${card.openingBalance} ${card.product.unit}</strong></td>
                            </tr>
                            ${card.movements.length === 0 ? `
                                <tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 20px;">لا توجد حركات مسجلة لهذا الصنف خلال الفترة المحددة.</td></tr>
                            ` : card.movements.map(m => `
                                <tr>
                                    <td>${m.tx.date}</td>
                                    <td><span class="badge badge-asset">${m.typeName}</span></td>
                                    <td>${m.whDetails}</td>
                                    <td>
                                        ${m.tx.reason || m.tx.reference || '-'}
                                        ${m.tx.journalEntryId ? `<a href="javascript:void(0)" onclick="ui.viewEntryVoucher('${m.tx.journalEntryId}')" style="display:block; font-size:11px; color:var(--primary);">سند قيد ${m.tx.journalEntryId}</a>` : ''}
                                    </td>
                                    <td class="num" style="color: var(--success);">${m.qtyIn > 0 ? m.qtyIn : '-'}</td>
                                    <td class="num" style="color: var(--danger);">${m.qtyOut > 0 ? m.qtyOut : '-'}</td>
                                    <td class="num"><strong>${m.runningBalance} ${card.product.unit}</strong></td>
                                </tr>
                            `).join('')}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td colspan="4"><strong>الرصيد الختامي الحالي</strong></td>
                                <td class="num" style="color: var(--success);"><strong>${card.totalPeriodIn}</strong></td>
                                <td class="num" style="color: var(--danger);"><strong>${card.totalPeriodOut}</strong></td>
                                <td class="num" style="color: var(--primary); font-size: 15px;"><strong>${card.closingBalance} ${card.product.unit}</strong></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        `;
    }

    renderAdjustmentsReport(container) {
        const txs = storage.getInventoryTransactions().filter(t => t.type === 'ADJUSTMENT' || t.type === 'TRANSFER');
        const settings = storage.getSettings();

        container.innerHTML = `
            <div class="voucher-paper">
                <div class="voucher-header">
                    <h2>${settings.companyName}</h2>
                    <div class="sub-title">تقرير حركات التحويل والتسويات وفروقات الجرد (Transfers & Adjustments)</div>
                </div>

                <table class="acc-table">
                    <thead>
                        <tr>
                            <th>رقم الحركة</th>
                            <th>التاريخ</th>
                            <th>النوع</th>
                            <th>الصنف</th>
                            <th>المستودع / المسار</th>
                            <th class="num">الكمية</th>
                            <th class="num">القيمة</th>
                            <th>البيان والسبب</th>
                            <th>القيد المحاسبي</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${txs.length === 0 ? `
                            <tr><td colspan="9" style="text-align: center; color: var(--text-muted); padding: 25px;">لا توجد حركات تسوية أو تحويل مسجلة.</td></tr>
                        ` : txs.map(t => {
                            const p = storage.getProductById(t.productId);
                            let wh = '';
                            if (t.type === 'TRANSFER') {
                                const fw = storage.getWarehouseById(t.fromWarehouseId);
                                const tw = storage.getWarehouseById(t.toWarehouseId);
                                wh = `${fw ? fw.name : ''} ← ${tw ? tw.name : ''}`;
                            } else {
                                const w = storage.getWarehouseById(t.warehouseId);
                                wh = w ? w.name : '';
                            }
                            return `
                                <tr>
                                    <td style="font-family: monospace;">${t.id}</td>
                                    <td>${t.date}</td>
                                    <td>
                                        ${t.type === 'TRANSFER' ? '<span class="badge badge-asset">تحويل</span>' : (t.adjustmentType === 'INCREASE' ? '<span class="badge" style="background:#ecfdf5; color:#047857;">فائض جرد (+)</span>' : '<span class="badge" style="background:#fef2f2; color:#b91c1c;">عجز / تلف (-)</span>')}
                                    </td>
                                    <td><strong>${p ? p.name : t.productId}</strong></td>
                                    <td>${wh}</td>
                                    <td class="num"><strong>${t.quantity} ${p ? p.unit : ''}</strong></td>
                                    <td class="num">${engine.formatMoney(t.totalCost || (t.quantity * (t.unitCost || 0)))}</td>
                                    <td>${t.reason || '-'}</td>
                                    <td>
                                        ${t.journalEntryId ? `<button class="btn btn-outline btn-sm" onclick="ui.viewEntryVoucher('${t.journalEntryId}')">سند ${t.journalEntryId}</button>` : '<span style="color:var(--text-muted); font-size:11.5px;">-</span>'}
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    renderLowStockReport(container) {
        const lowStock = inventory.getLowStockAlerts();
        const settings = storage.getSettings();

        container.innerHTML = `
            <div class="voucher-paper">
                <div class="voucher-header">
                    <h2>${settings.companyName}</h2>
                    <div class="sub-title">تقرير النواقص وحد إعادة الطلب (Low Stock & Reorder Report)</div>
                </div>

                ${lowStock.length === 0 ? `
                    <div style="text-align: center; padding: 40px; color: var(--success); font-weight: 700;">
                        ✅ جميع الأصناف والمنتجات متوفرة بكميات كافية وأعلى من حد إعادة الطلب.
                    </div>
                ` : `
                    <table class="acc-table">
                        <thead>
                            <tr>
                                <th>كود SKU</th>
                                <th>اسم الصنف</th>
                                <th>التصنيف</th>
                                <th class="num">الرصيد الحالي</th>
                                <th class="num">حد الطلب الأدنى</th>
                                <th class="num">الكمية المقترح شراؤها</th>
                                <th class="num">سعر التكلفة التقديري</th>
                                <th>الحالة</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${lowStock.map(item => {
                                const suggestedBuy = Math.max((item.product.minStockAlert * 2) - item.quantity, item.product.minStockAlert);
                                return `
                                    <tr>
                                        <td style="font-family: monospace;">${item.product.sku}</td>
                                        <td><strong>${item.product.name}</strong></td>
                                        <td><span class="badge badge-asset">${item.product.category}</span></td>
                                        <td class="num" style="color: ${item.isOutOfStock ? 'var(--danger)' : 'var(--warning)'}; font-weight: 800;">
                                            ${item.quantity} ${item.product.unit}
                                        </td>
                                        <td class="num">${item.product.minStockAlert} ${item.product.unit}</td>
                                        <td class="num" style="color: var(--primary); font-weight: 700;">${suggestedBuy} ${item.product.unit}</td>
                                        <td class="num">${engine.formatMoney(item.unitCost)}</td>
                                        <td>
                                            <span class="badge" style="background:${item.isOutOfStock ? '#fef2f2' : '#fffbeb'}; color:${item.isOutOfStock ? '#b91c1c' : '#b45309'};">
                                                ${item.statusText}
                                            </span>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                `}
            </div>
        `;
    }

    viewItemCard(productId) {
        this.switchTab('inventory_reports');
        const select = document.getElementById('inv-rep-prod-select');
        if (select) {
            select.value = productId;
        }
        this.showSubReport('item_card');
    }

    // ==================== 6. دليل الحسابات المالية (Accounts) ====================
    renderAccounts() {
        const accounts = storage.getAccounts();
        const balances = engine.calculateAllBalances();
        const searchInput = document.getElementById('accounts-search');
        const filterType = document.getElementById('accounts-type-filter');

        const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
        const selectedType = filterType ? filterType.value : 'all';

        const filtered = accounts.filter(acc => {
            const matchSearch = acc.name.toLowerCase().includes(query) || 
                                acc.code.includes(query) || 
                                (acc.description && acc.description.toLowerCase().includes(query));
            const matchType = selectedType === 'all' || acc.type === selectedType;
            return matchSearch && matchType;
        });

        const tbody = document.getElementById('accounts-tbody');
        if (!tbody) return;

        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 30px; color: var(--text-muted);">لا توجد حسابات تطابق خيارات البحث.</td></tr>`;
            return;
        }

        const typeBadges = {
            '1': '<span class="badge badge-asset">أصول</span>',
            '2': '<span class="badge badge-liability">خصوم</span>',
            '3': '<span class="badge badge-equity">حقوق ملكية</span>',
            '4': '<span class="badge badge-revenue">إيرادات</span>',
            '5': '<span class="badge badge-expense">مصروفات</span>'
        };

        tbody.innerHTML = filtered.map(acc => {
            const balInfo = balances[acc.code] || { netBalance: 0, totalDebit: 0, totalCredit: 0 };
            const categoryObj = Object.values(ACCOUNT_CATEGORIES).find(c => c.id === acc.category);
            const categoryName = categoryObj ? categoryObj.name : '-';
            const natureBadge = acc.nature === 'debit' ? '<span class="badge badge-debit">مدين</span>' : '<span class="badge badge-credit">دائن</span>';

            return `
                <tr>
                    <td><strong style="font-family: monospace; font-size: 15px; color: var(--primary);">${acc.code}</strong></td>
                    <td><strong>${acc.name}</strong> <small style="display: block; color: var(--text-muted);">${acc.description || ''}</small></td>
                    <td>${typeBadges[acc.type] || ''}</td>
                    <td><span style="font-size: 12px; color: var(--text-secondary);">${categoryName}</span></td>
                    <td>${natureBadge}</td>
                    <td class="num"><strong>${engine.formatMoney(balInfo.netBalance)}</strong></td>
                    <td>
                        <div style="display: flex; gap: 6px; justify-content: flex-end;">
                            <button class="btn btn-outline btn-sm" onclick="ui.viewAccountStatement('${acc.code}')" title="كشف حساب">📊 كشف</button>
                            <button class="btn btn-outline btn-sm" onclick="ui.openAccountModal('${acc.code}')" title="تعديل">✏️</button>
                            ${!acc.isSystem ? `<button class="btn btn-outline btn-sm" style="color: var(--danger);" onclick="ui.confirmDeleteAccount('${acc.code}')" title="حذف">🗑️</button>` : ''}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    openAccountModal(accountCode = null) {
        this.editingAccountCode = accountCode;
        const modal = document.getElementById('account-modal');
        const form = document.getElementById('account-form');
        const modalTitle = document.getElementById('account-modal-title');
        const codeInput = document.getElementById('acc-form-code');
        const typeSelect = document.getElementById('acc-form-type');
        const categorySelect = document.getElementById('acc-form-category');
        const nameInput = document.getElementById('acc-form-name');
        const descInput = document.getElementById('acc-form-desc');

        this.updateCategoryOptions();

        if (accountCode) {
            const acc = storage.getAccountByCode(accountCode);
            if (!acc) return;
            modalTitle.textContent = `تعديل الحساب: ${acc.name} (${acc.code})`;
            codeInput.value = acc.code;
            codeInput.disabled = true;
            typeSelect.value = acc.type;
            this.updateCategoryOptions();
            categorySelect.value = acc.category;
            nameInput.value = acc.name;
            descInput.value = acc.description || '';
        } else {
            modalTitle.textContent = 'إضافة حساب مالي جديد';
            form.reset();
            codeInput.disabled = false;
            typeSelect.value = '1';
            this.updateCategoryOptions();
            this.suggestNextAccountCode();
        }

        this.openModal('account-modal');
    }

    updateCategoryOptions() {
        const typeSelect = document.getElementById('acc-form-type');
        const categorySelect = document.getElementById('acc-form-category');
        if (!typeSelect || !categorySelect) return;

        const selectedType = typeSelect.value;
        const matchingCategories = Object.values(ACCOUNT_CATEGORIES).filter(c => c.typeId === selectedType);

        categorySelect.innerHTML = matchingCategories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    }

    suggestNextAccountCode() {
        const typeSelect = document.getElementById('acc-form-type');
        const codeInput = document.getElementById('acc-form-code');
        if (!typeSelect || !codeInput) return;

        const type = typeSelect.value;
        const accounts = storage.getAccounts().filter(a => a.type === type);
        
        let maxNum = parseInt(type + '100');
        accounts.forEach(a => {
            const n = parseInt(a.code);
            if (!isNaN(n) && n > maxNum) maxNum = n;
        });

        codeInput.value = String(maxNum + 1);
    }

    saveAccountFromForm() {
        const codeInput = document.getElementById('acc-form-code');
        const typeSelect = document.getElementById('acc-form-type');
        const categorySelect = document.getElementById('acc-form-category');
        const nameInput = document.getElementById('acc-form-name');
        const descInput = document.getElementById('acc-form-desc');

        const code = codeInput.value.trim();
        const name = nameInput.value.trim();
        const type = typeSelect.value;
        const category = categorySelect.value;
        const description = descInput.value.trim();

        if (!code || !name) {
            this.showToast('يرجى ملء جميع الحقول المطلوبة (رقم الحساب واسم الحساب)', 'error');
            return;
        }

        const nature = (type === '1' || type === '5') ? 'debit' : 'credit';

        try {
            if (this.editingAccountCode) {
                storage.updateAccount(this.editingAccountCode, { name, category, description });
                this.showToast('تم تحديث بيانات الحساب بنجاح', 'success');
            } else {
                storage.addAccount({ code, name, type, category, nature, description, isSystem: false });
                this.showToast('تم إضافة الحساب المالي الجديد بنجاح', 'success');
            }

            this.closeModal();
            this.renderAccounts();
        } catch (err) {
            this.showToast(err.message, 'error');
        }
    }

    confirmDeleteAccount(code) {
        const acc = storage.getAccountByCode(code);
        if (!acc) return;
        if (confirm(`هل أنت متأكد من رغبتك في حذف الحساب: "${acc.name} (${acc.code})"؟`)) {
            try {
                storage.deleteAccount(code);
                this.showToast('تم حذف الحساب بنجاح', 'success');
                this.renderAccounts();
            } catch (err) {
                this.showToast(err.message, 'error');
            }
        }
    }

    // ==================== 7. دفتر قيود اليومية (Journal Entries) ====================
    renderEntries() {
        const entries = storage.getEntries();
        const searchInput = document.getElementById('entries-search');
        const dateFromInput = document.getElementById('entries-date-from');
        const dateToInput = document.getElementById('entries-date-to');

        const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
        const dateFrom = dateFromInput ? dateFromInput.value : '';
        const dateTo = dateToInput ? dateToInput.value : '';

        const filtered = entries.filter(e => {
            const matchSearch = e.id.toLowerCase().includes(query) ||
                                (e.reference && e.reference.toLowerCase().includes(query)) ||
                                e.description.toLowerCase().includes(query) ||
                                e.lines.some(l => {
                                    const acc = storage.getAccountByCode(l.accountCode);
                                    return acc && acc.name.toLowerCase().includes(query);
                                });
            const matchDate = (!dateFrom || e.date >= dateFrom) && (!dateTo || e.date <= dateTo);
            return matchSearch && matchDate;
        });

        const tbody = document.getElementById('entries-tbody');
        if (!tbody) return;

        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 30px; color: var(--text-muted);">لا توجد قيود مسجلة تطابق محددات البحث.</td></tr>`;
            return;
        }

        tbody.innerHTML = filtered.map(entry => {
            const totalDebit = entry.lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
            
            const linesPreview = entry.lines.map(l => {
                const acc = storage.getAccountByCode(l.accountCode);
                const accName = acc ? acc.name : l.accountCode;
                const isDebit = parseFloat(l.debit) > 0;
                return `<div style="font-size: 12px; margin-bottom: 3px; display: flex; flex-wrap: wrap; gap: 6px; align-items: center;">
                    <span style="color: ${isDebit ? 'var(--primary-light)' : 'var(--success)'}; font-weight: 700;">
                        ${isDebit ? 'من حـ/' : 'إلى حـ/'}
                    </span>
                    <strong>${accName}</strong>
                    <span class="num" style="font-weight: 700; color: var(--text-primary);">(${engine.formatMoney(isDebit ? l.debit : l.credit)})</span>
                    ${l.note ? `<span style="color: var(--text-secondary); font-size: 11.5px;">— ${this.escapeHtml(l.note)}</span>` : ''}
                </div>`;
            }).join('');

            return `
                <tr>
                    <td><strong style="color: var(--primary); font-family: monospace; font-size: 14px;">${entry.id}</strong></td>
                    <td>${entry.date}</td>
                    <td>
                        <strong>${entry.description}</strong>
                        ${entry.reference ? `<div style="font-size: 11.5px; color: var(--text-muted);">مرجع: ${entry.reference}</div>` : ''}
                        <div style="margin-top: 6px; padding: 6px 10px; background: var(--bg-alt); border-radius: var(--radius-sm);">
                            ${linesPreview}
                        </div>
                    </td>
                    <td class="num"><strong style="font-size: 14.5px;">${engine.formatMoney(totalDebit)}</strong></td>
                    <td><span class="badge" style="background: #ecfdf5; color: #047857;">متوازن ✅</span></td>
                    <td>
                        <div style="display: flex; gap: 6px; justify-content: flex-end;">
                            <button class="btn btn-outline btn-sm" onclick="ui.viewEntryVoucher('${entry.id}')" title="عرض وطباعة السند">📄 سند</button>
                            <button class="btn btn-outline btn-sm" onclick="ui.openEntryModal('${entry.id}')" title="تعديل">✏️</button>
                            <button class="btn btn-outline btn-sm" style="color: var(--danger);" onclick="ui.confirmDeleteEntry('${entry.id}')" title="حذف">🗑️</button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    openEntryModal(entryId = null) {
        this.editingEntryId = entryId;
        const modal = document.getElementById('entry-modal');
        const modalTitle = document.getElementById('entry-modal-title');
        const dateInput = document.getElementById('entry-form-date');
        const descInput = document.getElementById('entry-form-desc');
        const refInput = document.getElementById('entry-form-ref');
        const numInput = document.getElementById('entry-form-num');

        if (entryId) {
            const entry = storage.getEntryById(entryId);
            if (!entry) return;
            modalTitle.textContent = `تعديل القيد المحاسبي: ${entry.id}`;
            numInput.value = entry.number || entry.id;
            dateInput.value = entry.date;
            descInput.value = entry.description;
            refInput.value = entry.reference || '';
            this.entryLines = JSON.parse(JSON.stringify(entry.lines));
        } else {
            modalTitle.textContent = 'إنشاء قيد يومية مزدوج جديد';
            const nextNum = storage.getNextEntryNumber();
            numInput.value = nextNum;
            dateInput.value = new Date().toISOString().split('T')[0];
            descInput.value = '';
            refInput.value = '';
            this.entryLines = [
                { accountCode: '', debit: '', credit: '', note: '' },
                { accountCode: '', debit: '', credit: '', note: '' }
            ];
        }

        this.renderEntryFormLines();
        this.openModal('entry-modal');
    }

    addEntryLine() {
        this.entryLines.push({ accountCode: '', debit: '', credit: '', note: '' });
        this.renderEntryFormLines();
    }

    removeEntryLine(index) {
        if (this.entryLines.length <= 2) {
            this.showToast('يجب أن يتضمن القيد سطرين على الأقل!', 'warning');
            return;
        }
        this.entryLines.splice(index, 1);
        this.renderEntryFormLines();
    }

    renderEntryFormLines() {
        const tbody = document.getElementById('entry-lines-tbody');
        if (!tbody) return;

        const accounts = storage.getAccounts();

        tbody.innerHTML = this.entryLines.map((line, index) => {
            return `
                <tr>
                    <td style="width: 35%;">
                        <select class="select-control entry-line-acc" data-index="${index}" onchange="ui.onEntryLineChange(${index}, 'accountCode', this.value)">
                            <option value="">-- اختر الحساب المالي --</option>
                            ${accounts.map(a => `
                                <option value="${a.code}" ${line.accountCode === a.code ? 'selected' : ''}>
                                    ${a.code} - ${a.name} (${a.nature === 'debit' ? 'مدين' : 'دائن'})
                                </option>
                            `).join('')}
                        </select>
                    </td>
                    <td style="width: 18%;">
                        <input type="number" step="0.01" min="0" class="input-control entry-line-debit num" 
                               value="${line.debit || ''}" placeholder="0.00" 
                               oninput="ui.onEntryLineChange(${index}, 'debit', this.value)">
                    </td>
                    <td style="width: 18%;">
                        <input type="number" step="0.01" min="0" class="input-control entry-line-credit num" 
                               value="${line.credit || ''}" placeholder="0.00" 
                               oninput="ui.onEntryLineChange(${index}, 'credit', this.value)">
                    </td>
                    <td style="width: 24%;">
                        <input type="text" class="input-control" 
                               value="${line.note || ''}" placeholder="ملاحظة أو بيان السطر" 
                               oninput="ui.onEntryLineChange(${index}, 'note', this.value)">
                    </td>
                    <td style="width: 5%; text-align: center;">
                        <button type="button" class="btn btn-outline btn-sm" style="color: var(--danger); padding: 4px 8px;" 
                                onclick="ui.removeEntryLine(${index})" title="حذف السطر">
                            ✕
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        this.updateEntryBalanceStatus();
    }

    onEntryLineChange(index, field, value) {
        if (!this.entryLines[index]) return;

        if (field === 'debit') {
            const val = parseFloat(value) || 0;
            this.entryLines[index].debit = value;
            if (val > 0) {
                this.entryLines[index].credit = '';
                const creditInput = document.querySelectorAll('.entry-line-credit')[index];
                if (creditInput) creditInput.value = '';
            }
        } else if (field === 'credit') {
            const val = parseFloat(value) || 0;
            this.entryLines[index].credit = value;
            if (val > 0) {
                this.entryLines[index].debit = '';
                const debitInput = document.querySelectorAll('.entry-line-debit')[index];
                if (debitInput) debitInput.value = '';
            }
        } else {
            this.entryLines[index][field] = value;
        }

        this.updateEntryBalanceStatus();
    }

    updateEntryBalanceStatus() {
        let totalDebit = 0;
        let totalCredit = 0;

        this.entryLines.forEach(l => {
            totalDebit += parseFloat(l.debit) || 0;
            totalCredit += parseFloat(l.credit) || 0;
        });

        const diff = Math.abs(totalDebit - totalCredit);
        const isBalanced = diff < 0.001 && totalDebit > 0;

        const totalDebitEl = document.getElementById('entry-total-debit');
        const totalCreditEl = document.getElementById('entry-total-credit');
        const diffEl = document.getElementById('entry-diff-amount');
        const statusBox = document.getElementById('entry-balance-status-box');
        const saveBtn = document.getElementById('save-entry-btn');

        if (totalDebitEl) totalDebitEl.textContent = engine.formatMoney(totalDebit);
        if (totalCreditEl) totalCreditEl.textContent = engine.formatMoney(totalCredit);
        if (diffEl) diffEl.textContent = engine.formatMoney(diff);

        if (statusBox) {
            if (isBalanced) {
                statusBox.className = 'balance-status balanced';
                statusBox.innerHTML = `<span>✅ القيد متوازن تماماً</span>`;
            } else {
                statusBox.className = 'balance-status unbalanced';
                statusBox.innerHTML = `<span>⚠️ القيد غير متوازن! الفارق: ${engine.formatMoney(diff)}</span>`;
            }
        }

        if (saveBtn) {
            saveBtn.disabled = !isBalanced;
            saveBtn.style.opacity = isBalanced ? '1' : '0.6';
        }
    }

    saveEntryFromForm() {
        const dateInput = document.getElementById('entry-form-date');
        const descInput = document.getElementById('entry-form-desc');
        const refInput = document.getElementById('entry-form-ref');
        const numInput = document.getElementById('entry-form-num');

        const date = dateInput.value;
        const description = descInput.value.trim();
        const reference = refInput.value.trim();
        const number = parseInt(numInput.value) || undefined;

        const validLines = this.entryLines.filter(l => 
            l.accountCode && ((parseFloat(l.debit) || 0) > 0 || (parseFloat(l.credit) || 0) > 0)
        ).map(l => ({
            accountCode: l.accountCode,
            debit: parseFloat(l.debit) || 0,
            credit: parseFloat(l.credit) || 0,
            note: l.note || ''
        }));

        const entryPayload = { date, description, reference, number, lines: validLines };
        const validation = engine.validateEntry(entryPayload);
        if (!validation.isValid) {
            this.showToast(validation.errors[0] || 'البيانات غير صالحة', 'error');
            return;
        }

        try {
            if (this.editingEntryId) {
                storage.updateEntry(this.editingEntryId, entryPayload);
                this.showToast('تم تعديل قيد اليومية بنجاح', 'success');
            } else {
                const newEntry = storage.addEntry(entryPayload);
                this.showToast(`تم حفظ القيد رقم ${newEntry.id} بنجاح`, 'success');
            }

            this.closeModal();
            this.renderEntries();
            this.renderDashboard();
        } catch (err) {
            this.showToast(err.message, 'error');
        }
    }

    confirmDeleteEntry(entryId) {
        if (confirm(`هل أنت متأكد من حذف القيد المحاسبي (${entryId})؟`)) {
            try {
                storage.deleteEntry(entryId);
                this.showToast('تم حذف القيد بنجاح', 'success');
                this.renderEntries();
                this.renderDashboard();
            } catch (err) {
                this.showToast(err.message, 'error');
            }
        }
    }

    viewEntryVoucher(entryId) {
        const entry = storage.getEntryById(entryId);
        if (!entry) return;

        const settings = storage.getSettings();
        const totalDebit = entry.lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
        const totalCredit = entry.lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);

        const modalBody = document.getElementById('voucher-modal-content');
        if (!modalBody) return;

        modalBody.innerHTML = `
            <div class="voucher-paper" id="printable-voucher">
                <div class="voucher-header">
                    <h2>${settings.companyName}</h2>
                    <div class="sub-title">سند قيد يومية محاسبي (Journal Voucher)</div>
                </div>

                <div class="voucher-meta-grid">
                    <div class="voucher-meta-item">
                        <strong>رقم القيد:</strong> <span style="font-family: monospace; font-size: 15px; color: var(--primary);">${entry.id}</span>
                    </div>
                    <div class="voucher-meta-item">
                        <strong>تاريخ القيد:</strong> <span>${entry.date}</span>
                    </div>
                    <div class="voucher-meta-item">
                        <strong>المرجع / المستند:</strong> <span>${entry.reference || 'لا يوجد'}</span>
                    </div>
                    <div class="voucher-meta-item" style="grid-column: span 3;">
                        <strong>البيان العام:</strong> <span>${entry.description}</span>
                    </div>
                </div>

                <table class="acc-table" style="margin-bottom: 24px;">
                    <thead>
                        <tr>
                            <th style="width: 18%;">رقم الحساب</th>
                            <th style="width: 32%;">اسم الحساب المالي</th>
                            <th style="width: 25%;">البيان / الشرح</th>
                            <th class="num" style="width: 12.5%;">مدين (${settings.currency})</th>
                            <th class="num" style="width: 12.5%;">دائن (${settings.currency})</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${entry.lines.map(line => {
                            const acc = storage.getAccountByCode(line.accountCode);
                            const accName = acc ? acc.name : line.accountCode;
                            return `
                                <tr>
                                    <td style="font-family: monospace; font-weight: 600;">${line.accountCode}</td>
                                    <td><strong>${accName}</strong></td>
                                    <td>${line.note || entry.description}</td>
                                    <td class="num">${line.debit > 0 ? engine.formatMoney(line.debit) : '-'}</td>
                                    <td class="num">${line.credit > 0 ? engine.formatMoney(line.credit) : '-'}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="3" style="text-align: left;"><strong>الإجمــــالي</strong></td>
                            <td class="num" style="color: var(--primary);"><strong>${engine.formatMoney(totalDebit)}</strong></td>
                            <td class="num" style="color: var(--primary);"><strong>${engine.formatMoney(totalCredit)}</strong></td>
                        </tr>
                    </tfoot>
                </table>

                <div class="voucher-signatures">
                    <div class="sig-box">
                        <span>المحاسب المسؤول</span>
                        <span>___________________</span>
                    </div>
                    <div class="sig-box">
                        <span>المراجع والتدقيق</span>
                        <span>___________________</span>
                    </div>
                    <div class="sig-box">
                        <span>المدير المالي / الاعتماد</span>
                        <span>___________________</span>
                    </div>
                </div>
            </div>
        `;

        this.openModal('voucher-modal');
    }

    // ==================== 8. دفتر الأستاذ العام وكشف الحساب ====================
    renderLedger() {
        const accounts = storage.getAccounts();
        const select = document.getElementById('ledger-account-select');
        const dateFromInput = document.getElementById('ledger-date-from');
        const dateToInput = document.getElementById('ledger-date-to');

        if (!select) return;

        const prevCode = select.value;
        select.innerHTML = `<option value="">-- اختر الحساب المالي لعرض كشف الحساب --</option>` +
            accounts.map(a => `<option value="${a.code}">${a.code} - ${this.escapeHtml(a.name)}</option>`).join('');
        if (prevCode && accounts.some(a => a.code === prevCode)) {
            select.value = prevCode;
        }

        const selectedCode = select.value;
        const fromDate = dateFromInput ? dateFromInput.value : '';
        const toDate = dateToInput ? dateToInput.value : '';
        const container = document.getElementById('ledger-results-container');
        if (!container) return;

        if (!selectedCode) {
            container.innerHTML = `
                <div style="text-align: center; padding: 60px 20px; color: var(--text-muted); background: var(--bg-surface); border-radius: var(--radius-lg); border: 1px dashed var(--border-dark);">
                    <div style="font-size: 40px; margin-bottom: 12px;">📑</div>
                    <h3>يرجى اختيار حساب مالي لاستعراض دفتر الأستاذ وكشف الحركات</h3>
                </div>
            `;
            return;
        }

        const ledger = engine.getAccountLedger(selectedCode, fromDate, toDate);
        if (!ledger) return;

        const natureName = ledger.account.nature === 'debit' ? 'طبيعة مدينة (أصول/مصروفات)' : 'طبيعة دائنة (خصوم/حقوق ملكية/إيرادات)';

        container.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <div>
                        <h3 style="margin-bottom: 4px;">كشف حساب: ${ledger.account.name} (${ledger.account.code})</h3>
                        <span style="font-size: 12.5px; color: var(--text-muted);">${natureName}</span>
                    </div>
                    <div>
                        <button class="btn btn-outline btn-sm action-print" onclick="window.print()">🖨️ طباعة كشف الحساب</button>
                    </div>
                </div>
                <div class="card-body">
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px; background: #f8fafc; padding: 16px; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
                        <div>
                            <span style="font-size: 12px; color: var(--text-muted); display: block;">الرصيد الافتتاحي للفترة:</span>
                            <strong style="font-size: 16px; color: var(--text-primary);">${engine.formatMoney(ledger.openingBalance)}</strong>
                        </div>
                        <div>
                            <span style="font-size: 12px; color: var(--text-muted); display: block;">إجمالي حركات المدين:</span>
                            <strong style="font-size: 16px; color: var(--primary);">${engine.formatMoney(ledger.periodDebitTotal)}</strong>
                        </div>
                        <div>
                            <span style="font-size: 12px; color: var(--text-muted); display: block;">إجمالي حركات الدائن:</span>
                            <strong style="font-size: 16px; color: var(--success);">${engine.formatMoney(ledger.periodCreditTotal)}</strong>
                        </div>
                        <div>
                            <span style="font-size: 12px; color: var(--text-muted); display: block;">الرصيد الختامي الحالي:</span>
                            <strong style="font-size: 17px; color: #1e3a8a;">${engine.formatMoney(ledger.closingBalance)}</strong>
                        </div>
                    </div>

                    <div class="table-responsive">
                        <table class="acc-table">
                            <thead>
                                <tr>
                                    <th style="width: 12%;">التاريخ</th>
                                    <th style="width: 12%;">رقم القيد</th>
                                    <th style="width: 32%;">البيان والشرح</th>
                                    <th class="num" style="width: 14%;">مدين (+)</th>
                                    <th class="num" style="width: 14%;">دائن (-)</th>
                                    <th class="num" style="width: 16%;">الرصيد التراكمي</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr style="background: #fdfdfd; font-style: italic;">
                                    <td>${fromDate || '-'}</td>
                                    <td>-</td>
                                    <td><strong>الرصيد الافتتاحي المنقول</strong></td>
                                    <td class="num">-</td>
                                    <td class="num">-</td>
                                    <td class="num"><strong>${engine.formatMoney(ledger.openingBalance)}</strong></td>
                                </tr>
                                ${ledger.transactions.length === 0 ? `
                                    <tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 24px;">لا توجد حركات مسجلة لهذا الحساب خلال الفترة المحددة.</td></tr>
                                ` : ledger.transactions.map(tx => `
                                    <tr>
                                        <td>${tx.date}</td>
                                        <td>
                                            <a href="javascript:void(0)" onclick="ui.viewEntryVoucher('${tx.entryId}')" style="color: var(--primary); text-decoration: none; font-weight: 600;">
                                                ${tx.entryId}
                                            </a>
                                        </td>
                                        <td>
                                            <strong>${tx.description}</strong>
                                            ${tx.lineNote ? `<div style="font-size: 11.5px; color: var(--text-muted);">${tx.lineNote}</div>` : ''}
                                        </td>
                                        <td class="num">${tx.debit > 0 ? engine.formatMoney(tx.debit) : '-'}</td>
                                        <td class="num">${tx.credit > 0 ? engine.formatMoney(tx.credit) : '-'}</td>
                                        <td class="num"><strong>${engine.formatMoney(tx.runningBalance)}</strong></td>
                                    </tr>
                                `).join('')}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td colspan="3"><strong>الإجماليات والرصيد الختامي</strong></td>
                                    <td class="num" style="color: var(--primary);"><strong>${engine.formatMoney(ledger.totalDebit)}</strong></td>
                                    <td class="num" style="color: var(--success);"><strong>${engine.formatMoney(ledger.totalCredit)}</strong></td>
                                    <td class="num" style="color: #1e3a8a; font-size: 15px;"><strong>${engine.formatMoney(ledger.closingBalance)}</strong></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            </div>
        `;
    }

    viewAccountStatement(code) {
        this.switchTab('ledger');
        const select = document.getElementById('ledger-account-select');
        if (select) {
            select.value = code;
            this.renderLedger();
        }
    }

    // ==================== 9. ميزان المراجعة ====================
    renderTrialBalance() {
        const dateFromInput = document.getElementById('tb-date-from');
        const dateToInput = document.getElementById('tb-date-to');
        const fromDate = dateFromInput ? dateFromInput.value : '';
        const toDate = dateToInput ? dateToInput.value : '';

        const tb = engine.generateTrialBalance(fromDate, toDate);
        const tbody = document.getElementById('tb-tbody');
        const statusBox = document.getElementById('tb-balance-status');
        const totalsRow = document.getElementById('tb-totals-row');

        if (statusBox) {
            if (tb.isBalanced) {
                statusBox.className = 'balance-status balanced';
                statusBox.innerHTML = `<span>✅ ميزان المراجعة متوازن تماماً (إجمالي المدين = إجمالي الدائن)</span>`;
            } else {
                statusBox.className = 'balance-status unbalanced';
                statusBox.innerHTML = `<span>⚠️ تحذير: يوجد عدم توازن في ميزان المراجعة!</span>`;
            }
        }

        if (tbody) {
            if (tb.rows.length === 0) {
                tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 30px; color: var(--text-muted);">لا توجد حركات أو أرصدة خلال الفترة المحددة.</td></tr>`;
            } else {
                tbody.innerHTML = tb.rows.map(row => `
                    <tr>
                        <td style="font-family: monospace; font-weight: 600; color: var(--primary);">${row.account.code}</td>
                        <td>
                            <strong>${row.account.name}</strong>
                            <small style="display: block; color: var(--text-muted);">${row.account.nature === 'debit' ? 'مدين' : 'دائن'}</small>
                        </td>
                        <td class="num">${row.totalDebit > 0 ? engine.formatMoney(row.totalDebit) : '-'}</td>
                        <td class="num">${row.totalCredit > 0 ? engine.formatMoney(row.totalCredit) : '-'}</td>
                        <td class="num" style="color: var(--primary);">${row.debitBalance > 0 ? engine.formatMoney(row.debitBalance) : '-'}</td>
                        <td class="num" style="color: var(--success);">${row.creditBalance > 0 ? engine.formatMoney(row.creditBalance) : '-'}</td>
                    </tr>
                `).join('');
            }
        }

        if (totalsRow) {
            totalsRow.innerHTML = `
                <td colspan="2"><strong>المجمـــــــــوع العـــــــام</strong></td>
                <td class="num"><strong>${engine.formatMoney(tb.totals.totalDebitSum)}</strong></td>
                <td class="num"><strong>${engine.formatMoney(tb.totals.totalCreditSum)}</strong></td>
                <td class="num" style="color: var(--primary); font-size: 15px;"><strong>${engine.formatMoney(tb.totals.totalDebitBalanceSum)}</strong></td>
                <td class="num" style="color: var(--success); font-size: 15px;"><strong>${engine.formatMoney(tb.totals.totalCreditBalanceSum)}</strong></td>
            `;
        }
    }

    // ==================== 10. القوائم والتقارير المالية الختامية ====================
    renderReports() {
        const subTab = document.querySelector('input[name="report-type"]:checked')?.value || 'income';
        const dateToInput = document.getElementById('report-date-to');
        const toDate = dateToInput ? dateToInput.value : '';
        const container = document.getElementById('financial-report-content');
        if (!container) return;

        if (subTab === 'income') {
            this.renderIncomeStatementReport(container, toDate);
        } else {
            this.renderBalanceSheetReport(container, toDate);
        }
    }

    renderIncomeStatementReport(container, toDate) {
        const is = engine.generateIncomeStatement(null, toDate);
        const settings = storage.getSettings();

        container.innerHTML = `
            <div class="voucher-paper">
                <div class="voucher-header">
                    <h2>${settings.companyName}</h2>
                    <div class="sub-title">قائمة الدخل والأرباح والخسائر (Income Statement)</div>
                    <div style="font-size: 13px; color: var(--text-muted); margin-top: 4px;">
                        للفترة المنتهية في: <strong>${toDate || new Date().toISOString().split('T')[0]}</strong>
                    </div>
                </div>

                <h4 style="color: var(--success); margin-bottom: 12px; border-bottom: 2px solid #ecfdf5; padding-bottom: 6px;">أولاً: الإيرادات (Revenues)</h4>
                <table class="acc-table" style="margin-bottom: 24px;">
                    <thead>
                        <tr>
                            <th style="width: 20%;">رقم الحساب</th>
                            <th style="width: 55%;">اسم الحساب</th>
                            <th class="num" style="width: 25%;">المبلغ (${settings.currency})</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${is.revenues.length === 0 ? `<tr><td colspan="3" style="text-align: center; color: var(--text-muted);">لا توجد إيرادات مسجلة للفترة.</td></tr>` : is.revenues.map(r => `
                            <tr>
                                <td style="font-family: monospace;">${r.account.code}</td>
                                <td>${r.account.name}</td>
                                <td class="num">${engine.formatMoney(r.amount)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="2"><strong>إجمالي الإيرادات</strong></td>
                            <td class="num" style="color: var(--success); font-size: 15px;"><strong>${engine.formatMoney(is.totalRevenues)}</strong></td>
                        </tr>
                    </tfoot>
                </table>

                <h4 style="color: var(--danger); margin-bottom: 12px; border-bottom: 2px solid #fef2f2; padding-bottom: 6px;">ثانياً: المصروفات (Expenses)</h4>
                <table class="acc-table" style="margin-bottom: 24px;">
                    <thead>
                        <tr>
                            <th style="width: 20%;">رقم الحساب</th>
                            <th style="width: 55%;">اسم الحساب</th>
                            <th class="num" style="width: 25%;">المبلغ (${settings.currency})</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${is.expenses.length === 0 ? `<tr><td colspan="3" style="text-align: center; color: var(--text-muted);">لا توجد مصروفات مسجلة للفترة.</td></tr>` : is.expenses.map(e => `
                            <tr>
                                <td style="font-family: monospace;">${e.account.code}</td>
                                <td>${e.account.name}</td>
                                <td class="num">${engine.formatMoney(e.amount)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="2"><strong>إجمالي المصروفات</strong></td>
                            <td class="num" style="color: var(--danger); font-size: 15px;"><strong>${engine.formatMoney(is.totalExpenses)}</strong></td>
                        </tr>
                    </tfoot>
                </table>

                <div style="background: ${is.isProfit ? 'var(--success-bg)' : 'var(--danger-bg)'}; border: 2px solid ${is.isProfit ? 'var(--success)' : 'var(--danger)'}; padding: 20px; border-radius: var(--radius-md); display: flex; align-items: center; justify-content: space-between;">
                    <div>
                        <h3 style="color: ${is.isProfit ? 'var(--success)' : 'var(--danger)'}; margin-bottom: 4px;">
                            ${is.isProfit ? 'صافي الربح المحقق (Net Income):' : 'صافي الخسارة (Net Loss):'}
                        </h3>
                        <span style="font-size: 13px; color: var(--text-secondary);">إجمالي الإيرادات - إجمالي المصروفات</span>
                    </div>
                    <div style="font-size: 24px; font-weight: 800; color: ${is.isProfit ? 'var(--success)' : 'var(--danger)'};">
                        ${engine.formatMoney(Math.abs(is.netIncome))}
                    </div>
                </div>
            </div>
        `;
    }

    renderBalanceSheetReport(container, toDate) {
        const bs = engine.generateBalanceSheet(toDate);
        const settings = storage.getSettings();

        container.innerHTML = `
            <div class="voucher-paper">
                <div class="voucher-header">
                    <h2>${settings.companyName}</h2>
                    <div class="sub-title">الميزانية العمومية وقائمة المركز المالي (Balance Sheet)</div>
                    <div style="font-size: 13px; color: var(--text-muted); margin-top: 4px;">كما في تاريخ: <strong>${bs.asOfDate}</strong></div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px;">
                    <div>
                        <h4 style="background: #eff6ff; color: var(--primary); padding: 10px 14px; border-radius: var(--radius-sm); margin-bottom: 14px;">جانب الأصول (Assets)</h4>
                        <h5 style="color: var(--text-secondary); margin-bottom: 8px;">الأصول المتداولة (تشمل النقدية والبنوك ومخزون البضائع):</h5>
                        <table class="acc-table" style="margin-bottom: 16px;">
                            <tbody>
                                ${bs.assets.current.map(a => `
                                    <tr>
                                        <td>${a.account.name}</td>
                                        <td class="num">${engine.formatMoney(a.balance)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>

                        <h5 style="color: var(--text-secondary); margin-bottom: 8px;">الأصول الثابتة وغير المتداولة:</h5>
                        <table class="acc-table" style="margin-bottom: 16px;">
                            <tbody>
                                ${bs.assets.fixed.map(a => `
                                    <tr>
                                        <td>${a.account.name}</td>
                                        <td class="num">${engine.formatMoney(a.balance)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>

                        <div style="background: #f1f5f9; padding: 14px; border-radius: var(--radius-sm); display: flex; justify-content: space-between; font-weight: 700; border-top: 2px solid var(--primary);">
                            <span>إجمالي الأصول</span>
                            <span class="num" style="color: var(--primary); font-size: 16px;">${engine.formatMoney(bs.totalAssets)}</span>
                        </div>
                    </div>

                    <div>
                        <h4 style="background: #fff7ed; color: #c2410c; padding: 10px 14px; border-radius: var(--radius-sm); margin-bottom: 14px;">جانب الخصوم وحقوق الملكية</h4>
                        <h5 style="color: var(--text-secondary); margin-bottom: 8px;">الخصوم (المطلوبات):</h5>
                        <table class="acc-table" style="margin-bottom: 16px;">
                            <tbody>
                                ${[...bs.liabilities.current, ...bs.liabilities.longTerm].map(l => `
                                    <tr>
                                        <td>${l.account.name}</td>
                                        <td class="num">${engine.formatMoney(l.balance)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td>إجمالي الخصوم</td>
                                    <td class="num">${engine.formatMoney(bs.liabilities.total)}</td>
                                </tr>
                            </tfoot>
                        </table>

                        <h5 style="color: var(--text-secondary); margin-bottom: 8px;">حقوق الملكية:</h5>
                        <table class="acc-table" style="margin-bottom: 16px;">
                            <tbody>
                                ${bs.equity.items.map(e => `
                                    <tr>
                                        <td>${e.account.name}</td>
                                        <td class="num">${engine.formatMoney(e.balance)}</td>
                                    </tr>
                                `).join('')}
                                <tr style="background: #faf5ff;">
                                    <td><strong>صافي أرباح/خسائر الفترة الحالية</strong></td>
                                    <td class="num" style="color: ${bs.equity.currentYearProfit >= 0 ? 'var(--success)' : 'var(--danger)'};">
                                        <strong>${engine.formatMoney(bs.equity.currentYearProfit)}</strong>
                                    </td>
                                </tr>
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td>إجمالي حقوق الملكية</td>
                                    <td class="num">${engine.formatMoney(bs.equity.totalWithProfit)}</td>
                                </tr>
                            </tfoot>
                        </table>

                        <div style="background: #f1f5f9; padding: 14px; border-radius: var(--radius-sm); display: flex; justify-content: space-between; font-weight: 700; border-top: 2px solid #c2410c;">
                            <span>إجمالي الخصوم وحقوق الملكية</span>
                            <span class="num" style="color: #c2410c; font-size: 16px;">${engine.formatMoney(bs.totalLiabilitiesAndEquity)}</span>
                        </div>
                    </div>
                </div>

                <div style="margin-top: 24px; padding: 14px 20px; border-radius: var(--radius-md); text-align: center; font-weight: 700; background: ${bs.isBalanced ? 'var(--success-bg)' : 'var(--danger-bg)'}; color: ${bs.isBalanced ? 'var(--success)' : 'var(--danger)'}; border: 1px solid ${bs.isBalanced ? 'rgba(5, 150, 105, 0.3)' : 'rgba(220, 38, 38, 0.3)'};">
                    ${bs.isBalanced ? '✅ الميزانية العمومية متوازنة تماماً: الأصول = الخصوم + حقوق الملكية' : `⚠️ يوجد فارق في الميزانية بمقدار: ${engine.formatMoney(bs.difference)}`}
                </div>
            </div>
        `;
    }

    // ==================== 11. الإعدادات والنسخ الاحتياطي والحماية (Settings) ====================
    renderSettings() {
        const settings = storage.getSettings();
        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.value = val || '';
        };

        setVal('settings-company-name', settings.companyName || '');
        setVal('settings-currency', settings.currency || '$');
        setVal('settings-fiscal-year', settings.fiscalYear || '2026');
        setVal('settings-sec-currency', settings.secondaryCurrency || 'د.ع');
        setVal('settings-exchange-rate', settings.exchangeRate || 1500);
        const secChk = document.getElementById('settings-show-sec-currency');
        if (secChk) secChk.checked = Boolean(settings.showSecondaryCurrency);
        setVal('settings-company-phone', settings.companyPhone || '');
        setVal('settings-company-tax', settings.companyTaxNumber || '');
        setVal('settings-company-address', settings.companyAddress || '');
        setVal('settings-invoice-footer', settings.invoiceFooterText || 'شكراً لتعاملكم معنا - نتطلع لخدمتكم دائماً');
    }

    saveSettingsFromForm() {
        const getVal = (id) => document.getElementById(id)?.value.trim() || '';

        const companyName = getVal('settings-company-name') || 'المؤسسة التجارية';
        const currency = getVal('settings-currency') || '$';
        const fiscalYear = getVal('settings-fiscal-year') || '2026';
        const secondaryCurrency = getVal('settings-sec-currency') || 'د.ع';
        const exchangeRate = parseFloat(getVal('settings-exchange-rate')) || 1500;
        const showSecondaryCurrency = Boolean(document.getElementById('settings-show-sec-currency')?.checked);
        const companyPhone = getVal('settings-company-phone');
        const companyTaxNumber = getVal('settings-company-tax');
        const companyAddress = getVal('settings-company-address');
        const invoiceFooterText = getVal('settings-invoice-footer') || 'شكراً لتعاملكم معنا - نتطلع لخدمتكم دائماً';

        const current = storage.getSettings();
        storage.saveSettings({
            ...current,
            companyName,
            currency,
            fiscalYear,
            secondaryCurrency,
            exchangeRate,
            showSecondaryCurrency,
            companyPhone,
            companyTaxNumber,
            companyAddress,
            invoiceFooterText
        });

        this.showToast('تم حفظ إعدادات المنشأة والعملات وترويسة الفواتير بنجاح', 'success');
        this.renderCurrentTab();
    }

    savePasswordFromForm() {
        const oldPassInput = document.getElementById('settings-old-pass');
        const newPassInput = document.getElementById('settings-new-pass');

        const oldPass = oldPassInput ? oldPassInput.value.trim() : '';
        const newPass = newPassInput ? newPassInput.value.trim() : '';

        if (!storage.verifyAdminPassword(oldPass)) {
            this.showToast('كلمة المرور الحالية غير صحيحة!', 'error');
            return;
        }
        if (!newPass || newPass.length < 3) {
            this.showToast('يرجى إدخال كلمة مرور جديدة (3 أحرف أو أرقام على الأقل)', 'warning');
            return;
        }

        const current = storage.getSettings();
        storage.saveSettings({ ...current, adminPassword: newPass });

        if (oldPassInput) oldPassInput.value = '';
        if (newPassInput) newPassInput.value = '';

        this.showToast('تم تحديث كلمة مرور حماية التصفير بنجاح ✅', 'success');
    }

    exportJSONBackup() {
        const json = storage.exportBackupJSON();
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Accounting_Inventory_Backup_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        this.showToast('تم تصدير ملف النسخة الاحتياطية الشاملة (محاسبة + مخزون) بنجاح', 'success');
    }

    importJSONBackup(fileInput) {
        const file = fileInput.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                storage.importBackupJSON(e.target.result);
                this.showToast('تم استعادة النسخة الاحتياطية الشاملة بنجاح!', 'success');
                this.renderCurrentTab();
            } catch (err) {
                this.showToast(err.message, 'error');
            }
        };
        reader.readAsText(file);
    }

    resetToDemo() {
        this.pendingResetType = 'RESET_ALL';
        const descEl = document.getElementById('password-confirm-desc');
        if (descEl) {
            descEl.innerHTML = '🔒 <strong>إعادة تعيين وتصفير النظام بالكامل:</strong> سيتم مسح كافة الفواتير والمنتجات والقيود وإعادة ضبط النظام للصفر. يرجى إدخال كلمة المرور للمتابعة:';
        }
        const passInput = document.getElementById('confirm-admin-password');
        if (passInput) passInput.value = '';
        this.openModal('password-confirm-modal');
        setTimeout(() => { if (passInput) passInput.focus(); }, 100);
    }

    clearAll() {
        this.pendingResetType = 'CLEAR_ALL';
        const descEl = document.getElementById('password-confirm-desc');
        if (descEl) {
            descEl.innerHTML = '⚠️ <strong>تصفير جميع الحركات والقيود:</strong> سيتم حذف جميع القيود المحاسبية والفواتير وحركات المخزون نهائياً. يرجى إدخال كلمة المرور للتأكيد:';
        }
        const passInput = document.getElementById('confirm-admin-password');
        if (passInput) passInput.value = '';
        this.openModal('password-confirm-modal');
        setTimeout(() => { if (passInput) passInput.focus(); }, 100);
    }

    confirmPasswordAction() {
        const passInput = document.getElementById('confirm-admin-password');
        const enteredPass = passInput ? passInput.value.trim() : '';

        if (!storage.verifyAdminPassword(enteredPass)) {
            this.showToast('❌ كلمة المرور غير صحيحة! تم رفض عملية التصفير لحماية البيانات.', 'error');
            if (passInput) {
                passInput.value = '';
                passInput.focus();
            }
            return;
        }

        storage.clearAllData();
        this.selectedPrintInvoiceId = null;
        this.closeModal();
        this.showToast('✅ تم التحقق من كلمة المرور وتصفير النظام بنجاح', 'success');
        this.renderCurrentTab();
    }

    // ==================== 12. قسم فواتير المبيعات والمشتريات والمرتجعات (Invoices) ====================
    renderInvoices() {
        const invoices = storage.getInvoices();
        const searchInput = document.getElementById('invoice-search');
        const typeFilter = document.getElementById('invoice-type-filter');
        const payFilter = document.getElementById('invoice-pay-filter');

        const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
        const selectedType = typeFilter ? typeFilter.value : 'all';
        const selectedPay = payFilter ? payFilter.value : 'all';

        // حساب مؤشرات الفواتير الصافية
        const salesInvs = invoices.filter(i => i.type === 'SALES');
        const salesRetInvs = invoices.filter(i => i.type === 'SALES_RETURN');
        const purchaseInvs = invoices.filter(i => i.type === 'PURCHASE');
        const purchaseRetInvs = invoices.filter(i => i.type === 'PURCHASE_RETURN');
        const creditInvs = invoices.filter(i => i.paymentMethod === 'CREDIT' && (i.type === 'SALES' || i.type === 'PURCHASE'));

        const totalSales = salesInvs.reduce((s, i) => s + (parseFloat(i.totalAmount) || 0), 0) - salesRetInvs.reduce((s, i) => s + (parseFloat(i.totalAmount) || 0), 0);
        const totalPurchases = purchaseInvs.reduce((s, i) => s + (parseFloat(i.totalAmount) || 0), 0) - purchaseRetInvs.reduce((s, i) => s + (parseFloat(i.totalAmount) || 0), 0);
        const totalCredit = creditInvs.reduce((s, i) => s + (i.remainingAmount !== undefined ? (parseFloat(i.remainingAmount) || 0) : (parseFloat(i.totalAmount) || 0)), 0);

        const setTxt = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
        };

        setTxt('inv-kpi-sales', engine.formatMoney(totalSales));
        setTxt('inv-kpi-sales-count', `${salesInvs.length} فاتورة مبيعات (${salesRetInvs.length} مرتجع)`);
        setTxt('inv-kpi-purchases', engine.formatMoney(totalPurchases));
        setTxt('inv-kpi-purchases-count', `${purchaseInvs.length} فاتورة مشتريات (${purchaseRetInvs.length} مرتجع)`);
        setTxt('inv-kpi-credit', engine.formatMoney(totalCredit));
        setTxt('inv-kpi-credit-sub', `${creditInvs.length} فاتورة آجلة على الحساب`);

        const filtered = invoices.filter(inv => {
            const matchType = selectedType === 'all' || inv.type === selectedType;
            const matchPay = selectedPay === 'all' || inv.paymentMethod === selectedPay;
            const matchSearch = !query ||
                (inv.id && inv.id.toLowerCase().includes(query)) ||
                (inv.partyName && inv.partyName.toLowerCase().includes(query)) ||
                (inv.notes && inv.notes.toLowerCase().includes(query));
            return matchType && matchPay && matchSearch;
        });

        const tbody = document.getElementById('invoices-tbody');
        if (!tbody) return;

        if (filtered.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; padding: 36px; color: var(--text-muted);">
                        لا توجد فواتير مسجلة. يمكنك إصدار فاتورة مبيعات أو مشتريات جديدة من الأزرار أعلاه.
                    </td>
                </tr>
            `;
            return;
        }

        const payLabels = {
            CASH: { text: '💵 نقداً', badge: 'badge-success' },
            BANK: { text: '🏦 بنكي', badge: 'badge-info' },
            CREDIT: { text: '⏳ آجل', badge: 'badge-warning' }
        };

        const typeBadges = {
            SALES: { label: '🛒 مبيعات', cls: 'badge-success', color: 'var(--success)' },
            PURCHASE: { label: '📥 مشتريات', cls: 'badge-info', color: 'var(--primary)' },
            SALES_RETURN: { label: '↩️ مرتجع بيع', cls: 'badge-warning', color: '#b45309' },
            PURCHASE_RETURN: { label: '↪️ مرتجع شراء', cls: 'badge-danger', color: '#7e22ce' }
        };

        tbody.innerHTML = filtered.map(inv => {
            const tInfo = typeBadges[inv.type] || typeBadges.SALES;
            const canReturn = inv.type === 'SALES' || inv.type === 'PURCHASE';
            const wh = storage.getWarehouseById(inv.warehouseId);
            const whName = wh ? wh.name : (inv.warehouseId || '-');
            const payInfo = payLabels[inv.paymentMethod] || { text: inv.paymentMethod, badge: 'badge-info' };

            return `
                <tr>
                    <td><strong style="color: var(--primary); font-family: monospace;">${inv.id}</strong></td>
                    <td>
                        <span class="badge ${tInfo.cls}">${tInfo.label}</span>
                    </td>
                    <td>${inv.date}</td>
                    <td>
                        <strong>${inv.partyName}</strong>
                        <span style="display: block; font-size: 11.5px; color: var(--text-muted);">${inv.items ? inv.items.length : 0} أصناف</span>
                    </td>
                    <td><span class="badge ${payInfo.badge}">${payInfo.text}</span></td>
                    <td>${whName}</td>
                    <td class="num"><strong style="color: ${tInfo.color};">${engine.formatMoney(inv.totalAmount)}</strong></td>
                    <td style="text-align: left; white-space: nowrap;">
                        <button class="btn btn-primary btn-sm" onclick="ui.openInvoiceInPrintCenter('${inv.id}')" title="فتح في مركز طباعة الفواتير">🖨️ طباعة</button>
                        <button class="btn btn-outline btn-sm" onclick="ui.viewInvoiceVoucher('${inv.id}')" title="معاينة سريعة">🔍</button>
                        ${canReturn ? `<button class="btn btn-outline btn-sm" style="color: #b45309; border-color: #fde68a;" onclick="ui.createReturnFromInvoice('${inv.id}')" title="إصدار فاتورة مرتجع لهذه الفاتورة">↩️ مرتجع</button>` : ''}
                        ${inv.paymentMethod === 'CREDIT' && canReturn ? `<button class="btn btn-outline btn-sm" style="color: #059669; border-color: #a7f3d0;" onclick="ui.openVoucherFormModal('${inv.type === 'SALES' ? 'RECEIPT' : 'PAYMENT'}', '${this.escapeHtml(inv.partyName)}', ${inv.remainingAmount !== undefined && inv.remainingAmount > 0 ? inv.remainingAmount : inv.totalAmount}, '${inv.id}')" title="تحصيل أو سداد هذه الفاتورة الآجلة">💳 سند</button>` : ''}
                        ${inv.journalEntryId ? `<button class="btn btn-outline btn-sm" onclick="ui.viewEntryVoucher('${inv.journalEntryId}')" title="عرض القيد المحاسبي">📝</button>` : ''}
                        <button class="btn btn-outline btn-sm" style="color: var(--danger); border-color: #fca5a5;" onclick="ui.deleteInvoice('${inv.id}')" title="حذف الفاتورة">🗑️</button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    openInvoiceModal(type = 'SALES') {
        const products = storage.getProducts();
        if (products.length === 0) {
            this.showToast('يرجى إضافة منتج واحد على الأقل في "دليل المنتجات والأصناف" قبل إصدار فاتورة!', 'warning');
            this.switchTab('products');
            this.openProductModal();
            return;
        }

        this.populatePartiesDatalist();

        const warehouses = storage.getWarehouses();
        const whSelect = document.getElementById('inv-form-wh');
        if (whSelect) {
            whSelect.innerHTML = warehouses.map(w => `<option value="${w.id}" ${w.isDefault ? 'selected' : ''}>${w.name} (${w.code})</option>`).join('');
        }

        const dateInput = document.getElementById('inv-form-date');
        if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];

        const partyInput = document.getElementById('inv-form-party');
        if (partyInput) partyInput.value = '';

        const paySelect = document.getElementById('inv-form-pay');
        if (paySelect) paySelect.value = 'CASH';

        const discInput = document.getElementById('inv-form-discount');
        if (discInput) discInput.value = '0';

        const taxInput = document.getElementById('inv-form-tax-rate');
        if (taxInput) taxInput.value = '0';

        const paidInput = document.getElementById('inv-form-paid');
        if (paidInput) paidInput.value = '';

        const notesInput = document.getElementById('inv-form-notes');
        if (notesInput) notesInput.value = '';

        const radios = document.querySelectorAll('input[name="inv-form-type"]');
        radios.forEach(r => { r.checked = (r.value === type); });

        const isSalesSide = (type === 'SALES' || type === 'SALES_RETURN');
        this.invoiceLines = [
            { productId: products[0].id, quantity: 1, unitPrice: isSalesSide ? (products[0].sellingPrice || 0) : (products[0].purchasePrice || 0) }
        ];

        this.onInvoiceTypeChange(type);
        this.openModal('invoice-modal');
    }

    createReturnFromInvoice(invoiceId) {
        const orig = storage.getInvoiceById(invoiceId);
        if (!orig) return;
        const returnType = orig.type === 'SALES' ? 'SALES_RETURN' : 'PURCHASE_RETURN';
        this.openInvoiceModal(returnType);

        const partyInput = document.getElementById('inv-form-party');
        if (partyInput) partyInput.value = orig.partyName || '';

        const whSelect = document.getElementById('inv-form-wh');
        if (whSelect && orig.warehouseId) whSelect.value = orig.warehouseId;

        const paySelect = document.getElementById('inv-form-pay');
        if (paySelect && orig.paymentMethod) paySelect.value = orig.paymentMethod;

        const discInput = document.getElementById('inv-form-discount');
        if (discInput) discInput.value = String(orig.discount || 0);

        const taxInput = document.getElementById('inv-form-tax-rate');
        if (taxInput) taxInput.value = String(orig.taxRate || 0);

        const notesInput = document.getElementById('inv-form-notes');
        if (notesInput) notesInput.value = `مرتجع للفاتورة الأصلية رقم ${orig.id}`;

        if (Array.isArray(orig.items) && orig.items.length > 0) {
            this.invoiceLines = orig.items.map(it => ({
                productId: it.productId,
                quantity: parseFloat(it.quantity) || 1,
                unitPrice: parseFloat(it.unitPrice) || 0
            }));
        }

        this.renderInvoiceLinesTable();
        this.showToast(`تم تجهيز نموذج المرتجع للفاتورة (${orig.id}) — يمكنك تعديل الكميات ثم الحفظ`, 'info');
    }

    onInvoiceTypeChange(type) {
        const titleEl = document.getElementById('invoice-modal-title');
        const partyLabel = document.getElementById('inv-form-party-label');
        const partyInput = document.getElementById('inv-form-party');
        const nextNoEl = document.getElementById('inv-form-next-no');
        const hintEl = document.getElementById('inv-accounting-hint');

        if (nextNoEl) nextNoEl.textContent = storage.getNextInvoiceNumber(type);

        if (type === 'SALES') {
            if (titleEl) titleEl.textContent = '🛒 إصدار فاتورة مبيعات جديدة';
            if (partyLabel) partyLabel.innerHTML = 'اسم العميل <span class="req">*</span>:';
            if (partyInput && !partyInput.value) partyInput.placeholder = 'عميل نقدي / اسم العميل...';
            if (hintEl) {
                hintEl.innerHTML = '🔗 <strong>الربط المحاسبي والمخزني التلقائي:</strong> سيتم خصم الكميات من المستودع، وتوليد قيد المبيعات (مدين الصندوق/البنك/العملاء 1101/1102/1103 ← دائن إيراد المبيعات 4101) + قيد تكلفة البضاعة المباعة (مدين 5302 ← دائن مخزون البضائع 1104).';
            }
        } else if (type === 'PURCHASE') {
            if (titleEl) titleEl.textContent = '📥 إصدار فاتورة مشتريات جديدة';
            if (partyLabel) partyLabel.innerHTML = 'اسم المورد <span class="req">*</span>:';
            if (partyInput && !partyInput.value) partyInput.placeholder = 'اسم المورد / الشركة الموردة...';
            if (hintEl) {
                hintEl.innerHTML = '🔗 <strong>الربط المحاسبي والمخزني التلقائي:</strong> سيتم إضافة الكميات إلى المستودع وتحديث تكلفة الشراء، وتوليد قيد المشتريات (مدين مخزون البضائع 1104 ← دائن الصندوق/البنك/الموردون 1101/1102/2101).';
            }
        } else if (type === 'SALES_RETURN') {
            if (titleEl) titleEl.textContent = '↩️ إصدار فاتورة مرتجع مبيعات';
            if (partyLabel) partyLabel.innerHTML = 'اسم العميل المُرجِع <span class="req">*</span>:';
            if (partyInput && !partyInput.value) partyInput.placeholder = 'اسم العميل...';
            if (hintEl) {
                hintEl.innerHTML = '🔗 <strong>الربط المحاسبي والمخزني التلقائي لمرتجع المبيعات:</strong> سيتم إعادة الكميات إلى المستودع، وعكس قيد المبيعات وتكلفة البضاعة المباعة وتخفيض مديونية العميل أو رد النقدية.';
            }
        } else if (type === 'PURCHASE_RETURN') {
            if (titleEl) titleEl.textContent = '↪️ إصدار فاتورة مرتجع مشتريات';
            if (partyLabel) partyLabel.innerHTML = 'اسم المورد <span class="req">*</span>:';
            if (partyInput && !partyInput.value) partyInput.placeholder = 'اسم المورد...';
            if (hintEl) {
                hintEl.innerHTML = '🔗 <strong>الربط المحاسبي والمخزني التلقائي لمرتجع المشتريات:</strong> سيتم خصم الكميات المرتجعة من المستودع، وعكس قيد المشتريات وتخفيض رصيد المورد أو استرداد النقدية.';
            }
        }

        const isSalesSide = (type === 'SALES' || type === 'SALES_RETURN');
        const priceTier = document.getElementById('inv-form-price-tier')?.value || 'RETAIL';
        const paidLabelEl = document.getElementById('inv-form-paid-label');
        if (paidLabelEl) {
            paidLabelEl.textContent = isSalesSide ? '💵 المبلغ المستلم ($):' : '💵 المبلغ المدفوع ($):';
        }
        if (this.invoiceLines && this.invoiceLines.length > 0) {
            this.invoiceLines.forEach(line => {
                const prod = storage.getProductById(line.productId);
                if (prod) {
                    const sellUnit = (priceTier === 'WHOLESALE' && prod.wholesalePrice !== undefined && prod.wholesalePrice !== null)
                        ? (parseFloat(prod.wholesalePrice) || 0)
                        : (parseFloat(prod.sellingPrice) || 0);
                    line.unitPrice = isSalesSide ? sellUnit : (prod.purchasePrice || 0);
                }
            });
        }

        this.renderInvoiceLinesTable();
    }

    onInvoicePriceTierChange(tier) {
        const type = document.querySelector('input[name="inv-form-type"]:checked')?.value || 'SALES';
        const isSalesSide = (type === 'SALES' || type === 'SALES_RETURN');
        if (!isSalesSide) return;
        if (this.invoiceLines && this.invoiceLines.length > 0) {
            this.invoiceLines.forEach(line => {
                const prod = storage.getProductById(line.productId);
                if (prod) {
                    line.unitPrice = (tier === 'WHOLESALE' && prod.wholesalePrice !== undefined && prod.wholesalePrice !== null)
                        ? (parseFloat(prod.wholesalePrice) || 0)
                        : (parseFloat(prod.sellingPrice) || 0);
                }
            });
        }
        this.renderInvoiceLinesTable();
        this.showToast(tier === 'WHOLESALE' ? '📦 تم التبديل إلى تسعير الجملة (Wholesale)' : '🛍️ تم التبديل إلى تسعير المفرد (قطاعي)', 'info');
    }

    renderInvoiceLinesTable() {
        const tbody = document.getElementById('invoice-lines-tbody');
        if (!tbody) return;

        const products = storage.getProducts();
        const whId = document.getElementById('inv-form-wh')?.value;

        tbody.innerHTML = this.invoiceLines.map((line, idx) => {
            const avail = line.productId ? inventory.getProductStock(line.productId, whId) : 0;
            const prod = storage.getProductById(line.productId);
            const unitName = prod ? prod.unit : '';
            const rowTotal = (parseFloat(line.quantity) || 0) * (parseFloat(line.unitPrice) || 0);

            return `
                <tr>
                    <td>
                        <select class="select-control" style="width: 100%;" onchange="ui.onInvoiceProductChange(${idx}, this.value)" required>
                            ${products.map(p => `<option value="${p.id}" ${p.id === line.productId ? 'selected' : ''}>${p.sku} - ${p.name}</option>`).join('')}
                        </select>
                    </td>
                    <td style="text-align: center; font-size: 12.5px;">
                        <span class="badge ${avail > 0 ? 'badge-success' : 'badge-danger'}">${avail} ${unitName}</span>
                    </td>
                    <td>
                        <input type="number" step="0.01" min="0.01" class="input-control num" style="width: 100%;" value="${line.quantity}" oninput="ui.onInvoiceLineQtyPriceChange(${idx}, 'quantity', this.value)" required>
                    </td>
                    <td>
                        <input type="number" step="0.01" min="0" class="input-control num" style="width: 100%;" value="${line.unitPrice}" oninput="ui.onInvoiceLineQtyPriceChange(${idx}, 'unitPrice', this.value)" required>
                    </td>
                    <td class="num"><strong id="inv-line-total-${idx}">${engine.formatMoney(rowTotal)}</strong></td>
                    <td style="text-align: center;">
                        <button type="button" class="btn btn-outline btn-sm" style="color: var(--danger); padding: 4px 8px;" onclick="ui.removeInvoiceLine(${idx})" ${this.invoiceLines.length <= 1 ? 'disabled' : ''}>✕</button>
                    </td>
                </tr>
            `;
        }).join('');

        this.calculateInvoiceTotals();
    }

    refreshInvoiceStockHints() {
        this.renderInvoiceLinesTable();
    }

    addInvoiceLine() {
        const products = storage.getProducts();
        if (products.length === 0) return;
        const type = document.querySelector('input[name="inv-form-type"]:checked')?.value || 'SALES';
        const isSalesSide = (type === 'SALES' || type === 'SALES_RETURN');
        const priceTier = document.getElementById('inv-form-price-tier')?.value || 'RETAIL';
        const firstProd = products[0];
        const sellUnit = (priceTier === 'WHOLESALE' && firstProd.wholesalePrice !== undefined && firstProd.wholesalePrice !== null)
            ? (parseFloat(firstProd.wholesalePrice) || 0)
            : (parseFloat(firstProd.sellingPrice) || 0);
        this.invoiceLines.push({
            productId: firstProd.id,
            quantity: 1,
            unitPrice: isSalesSide ? sellUnit : (firstProd.purchasePrice || 0)
        });
        this.renderInvoiceLinesTable();
    }

    removeInvoiceLine(index) {
        if (this.invoiceLines.length <= 1) return;
        this.invoiceLines.splice(index, 1);
        this.renderInvoiceLinesTable();
    }

    onInvoiceProductChange(index, productId) {
        const prod = storage.getProductById(productId);
        const type = document.querySelector('input[name="inv-form-type"]:checked')?.value || 'SALES';
        const isSalesSide = (type === 'SALES' || type === 'SALES_RETURN');
        const priceTier = document.getElementById('inv-form-price-tier')?.value || 'RETAIL';
        if (this.invoiceLines[index]) {
            this.invoiceLines[index].productId = productId;
            if (prod) {
                const sellUnit = (priceTier === 'WHOLESALE' && prod.wholesalePrice !== undefined && prod.wholesalePrice !== null)
                    ? (parseFloat(prod.wholesalePrice) || 0)
                    : (parseFloat(prod.sellingPrice) || 0);
                this.invoiceLines[index].unitPrice = isSalesSide ? sellUnit : (prod.purchasePrice || 0);
            }
        }
        this.renderInvoiceLinesTable();
    }

    onInvoiceLineQtyPriceChange(index, field, value) {
        if (!this.invoiceLines[index]) return;
        this.invoiceLines[index][field] = parseFloat(value) || 0;
        const rowTotal = (parseFloat(this.invoiceLines[index].quantity) || 0) * (parseFloat(this.invoiceLines[index].unitPrice) || 0);
        const rowEl = document.getElementById(`inv-line-total-${index}`);
        if (rowEl) rowEl.textContent = engine.formatMoney(rowTotal);
        this.calculateInvoiceTotals();
    }

    calculateInvoiceTotals() {
        const subtotal = (this.invoiceLines || []).reduce((sum, l) => {
            return sum + ((parseFloat(l.quantity) || 0) * (parseFloat(l.unitPrice) || 0));
        }, 0);

        const disc = Math.min(parseFloat(document.getElementById('inv-form-discount')?.value) || 0, subtotal);
        const afterDisc = Math.max(subtotal - disc, 0);
        const taxRate = parseFloat(document.getElementById('inv-form-tax-rate')?.value) || 0;
        const taxAmount = (afterDisc * taxRate) / 100;
        const grandTotal = afterDisc + taxAmount;

        const payMethod = document.getElementById('inv-form-pay')?.value || 'CASH';
        const paidInputEl = document.getElementById('inv-form-paid');
        if (paidInputEl) {
            paidInputEl.placeholder = payMethod === 'CREDIT' ? '0.00 (أو دفعة مقدمة)' : 'تلقائي بالكامل';
        }
        const paidRaw = paidInputEl?.value;
        const hasExplicitPaid = paidRaw !== undefined && paidRaw !== null && String(paidRaw).trim() !== '';
        const receivedAmount = hasExplicitPaid
            ? Math.max(0, parseFloat(paidRaw) || 0)
            : (payMethod === 'CREDIT' ? 0 : grandTotal);

        const changeAmount = receivedAmount > grandTotal ? (receivedAmount - grandTotal) : 0;
        const netPaid = Math.min(receivedAmount, grandTotal);
        const remainingAmount = Math.max(0, grandTotal - netPaid);

        const setTxt = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
        };

        setTxt('inv-sum-subtotal', engine.formatMoney(subtotal));
        setTxt('inv-sum-tax', engine.formatMoney(taxAmount));
        setTxt('inv-sum-grand', engine.formatMoney(grandTotal));

        const changeBox = document.getElementById('inv-sum-change-box');
        const changeLabel = document.getElementById('inv-sum-change-label');
        const changeValEl = document.getElementById('inv-sum-change');

        if (remainingAmount > 0) {
            if (changeBox) {
                changeBox.style.background = '#fffbeb';
                changeBox.style.borderColor = '#fde68a';
            }
            if (changeLabel) {
                changeLabel.style.color = '#92400e';
                changeLabel.textContent = 'المتبقي الآجل بالذمة:';
            }
            if (changeValEl) {
                changeValEl.style.color = '#b45309';
                changeValEl.textContent = engine.formatMoney(remainingAmount);
            }
        } else {
            if (changeBox) {
                changeBox.style.background = '#ecfdf5';
                changeBox.style.borderColor = '#a7f3d0';
            }
            if (changeLabel) {
                changeLabel.style.color = '#065f46';
                changeLabel.textContent = 'الباقي للعميل:';
            }
            if (changeValEl) {
                changeValEl.style.color = '#047857';
                changeValEl.textContent = engine.formatMoney(changeAmount);
            }
        }
    }

    saveInvoiceFromForm() {
        try {
            const type = document.querySelector('input[name="inv-form-type"]:checked')?.value || 'SALES';
            const partyName = document.getElementById('inv-form-party')?.value.trim() || (type === 'SALES' ? 'عميل نقدي' : 'مورد عام');
            const warehouseId = document.getElementById('inv-form-wh')?.value;
            const paymentMethod = document.getElementById('inv-form-pay')?.value || 'CASH';
            const date = document.getElementById('inv-form-date')?.value;
            const discount = parseFloat(document.getElementById('inv-form-discount')?.value) || 0;
            const taxRate = parseFloat(document.getElementById('inv-form-tax-rate')?.value) || 0;
            const paidRaw = document.getElementById('inv-form-paid')?.value;
            const notes = document.getElementById('inv-form-notes')?.value.trim() || '';

            const result = inventory.executeInvoice({
                type,
                partyName,
                paymentMethod,
                warehouseId,
                date,
                items: this.invoiceLines,
                discount,
                taxRate,
                paidAmount: paidRaw,
                notes
            });

            this.closeModal();
            this.showToast(`تم إصدار الفاتورة رقم (${result.invoice.id}) وتوليد القيود وحركة المخزون بنجاح!`, 'success');
            this.renderCurrentTab();
        } catch (err) {
            this.showToast(err.message, 'error');
        }
    }

    viewInvoiceVoucher(invoiceId) {
        const inv = storage.getInvoiceById(invoiceId);
        if (!inv) {
            this.showToast('الفاتورة غير موجودة', 'error');
            return;
        }

        const content = document.getElementById('voucher-modal-content');
        if (!content) return;

        content.innerHTML = this.buildInvoiceHTML(inv, { template: 'a4' });
        this.openModal('voucher-modal');
    }

    deleteInvoice(invoiceId) {
        if (!confirm(`هل أنت متأكد من حذف الفاتورة رقم (${invoiceId})؟ سيتم إلغاء القيود المحاسبية وحركات المخزون المرتبطة بها.`)) {
            return;
        }
        try {
            storage.deleteInvoice(invoiceId);
            this.showToast('تم حذف الفاتورة وإلغاء قيودها وحركتها المخزنية بنجاح', 'info');
            this.renderCurrentTab();
        } catch (err) {
            this.showToast(err.message, 'error');
        }
    }

    // ==================== 13. قسم الأرصدة الافتتاحية ودفعات المخزون (Opening Balances) ====================
    renderOpeningBalances() {
        const batches = storage.getOpeningBatches();
        const tbody = document.getElementById('opening-batches-tbody');
        if (!tbody) return;

        if (batches.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 36px; color: var(--text-muted);">
                        لا توجد دفعات أرصدة افتتاحية مسجلة بعد. اضغط على "إدخال دفعة رصيد افتتاحي" لإضافة بضاعة أول المدة للمستودعات.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = batches.map(batch => {
            const wh = storage.getWarehouseById(batch.warehouseId);
            const whName = wh ? wh.name : batch.warehouseId;
            const itemsCount = batch.items ? batch.items.length : 0;

            return `
                <tr>
                    <td><strong style="color: var(--primary); font-family: monospace;">${batch.id}</strong></td>
                    <td>${batch.date}</td>
                    <td>
                        <strong>${whName}</strong>
                        ${batch.notes ? `<span style="display: block; font-size: 11.5px; color: var(--text-muted);">${batch.notes}</span>` : ''}
                    </td>
                    <td><span class="badge badge-info">${itemsCount} أصناف</span></td>
                    <td class="num"><strong>${batch.totalQuantity}</strong></td>
                    <td class="num"><strong style="color: var(--success);">${engine.formatMoney(batch.totalCost)}</strong></td>
                    <td style="text-align: left; white-space: nowrap;">
                        <button class="btn btn-outline btn-sm" onclick="ui.viewOpeningBatchVoucher('${batch.id}')" title="استعراض وطباعة الدفعة">🖨️ استعراض</button>
                        ${batch.journalEntryId ? `<button class="btn btn-outline btn-sm" onclick="ui.viewEntryVoucher('${batch.journalEntryId}')" title="عرض القيد المحاسبي">📝 القيد</button>` : ''}
                        <button class="btn btn-outline btn-sm" style="color: var(--danger); border-color: #fca5a5;" onclick="ui.deleteOpeningBatch('${batch.id}')" title="حذف الدفعة">🗑️</button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    openOpeningBatchModal() {
        const products = storage.getProducts();
        if (products.length === 0) {
            this.showToast('يرجى تعريف المنتجات أولاً في "دليل المنتجات والأصناف" قبل إدخال أرصدتها الافتتاحية!', 'warning');
            this.switchTab('products');
            this.openProductModal();
            return;
        }

        const warehouses = storage.getWarehouses();
        const whSelect = document.getElementById('op-batch-wh');
        if (whSelect) {
            whSelect.innerHTML = warehouses.map(w => `<option value="${w.id}" ${w.isDefault ? 'selected' : ''}>${w.name} (${w.code})</option>`).join('');
        }

        const dateInput = document.getElementById('op-batch-date');
        if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];

        const notesInput = document.getElementById('op-batch-notes');
        if (notesInput) notesInput.value = '';

        this.openingBatchLines = [
            { productId: products[0].id, quantity: 1, unitCost: products[0].purchasePrice || 0 }
        ];

        this.renderOpeningBatchLinesTable();
        this.openModal('opening-batch-modal');
    }

    renderOpeningBatchLinesTable() {
        const tbody = document.getElementById('opening-batch-lines-tbody');
        if (!tbody) return;

        const products = storage.getProducts();

        tbody.innerHTML = (this.openingBatchLines || []).map((line, idx) => {
            const rowCost = (parseFloat(line.quantity) || 0) * (parseFloat(line.unitCost) || 0);
            return `
                <tr>
                    <td>
                        <select class="select-control" style="width: 100%;" onchange="ui.onOpeningProductChange(${idx}, this.value)" required>
                            ${products.map(p => `<option value="${p.id}" ${p.id === line.productId ? 'selected' : ''}>${p.sku} - ${p.name} (${p.unit})</option>`).join('')}
                        </select>
                    </td>
                    <td>
                        <input type="number" step="0.01" min="0.01" class="input-control num" style="width: 100%;" value="${line.quantity}" oninput="ui.onOpeningLineChange(${idx}, 'quantity', this.value)" required>
                    </td>
                    <td>
                        <input type="number" step="0.01" min="0" class="input-control num" style="width: 100%;" value="${line.unitCost}" oninput="ui.onOpeningLineChange(${idx}, 'unitCost', this.value)" required>
                    </td>
                    <td class="num"><strong id="op-line-total-${idx}">${engine.formatMoney(rowCost)}</strong></td>
                    <td style="text-align: center;">
                        <button type="button" class="btn btn-outline btn-sm" style="color: var(--danger); padding: 4px 8px;" onclick="ui.removeOpeningBatchLine(${idx})" ${this.openingBatchLines.length <= 1 ? 'disabled' : ''}>✕</button>
                    </td>
                </tr>
            `;
        }).join('');

        this.calculateOpeningBatchTotals();
    }

    addOpeningBatchLine() {
        const products = storage.getProducts();
        if (products.length === 0) return;
        const firstProd = products[0];
        this.openingBatchLines.push({
            productId: firstProd.id,
            quantity: 1,
            unitCost: firstProd.purchasePrice || 0
        });
        this.renderOpeningBatchLinesTable();
    }

    removeOpeningBatchLine(index) {
        if (this.openingBatchLines.length <= 1) return;
        this.openingBatchLines.splice(index, 1);
        this.renderOpeningBatchLinesTable();
    }

    onOpeningProductChange(index, productId) {
        const prod = storage.getProductById(productId);
        if (this.openingBatchLines[index]) {
            this.openingBatchLines[index].productId = productId;
            if (prod) {
                this.openingBatchLines[index].unitCost = prod.purchasePrice || 0;
            }
        }
        this.renderOpeningBatchLinesTable();
    }

    onOpeningLineChange(index, field, value) {
        if (!this.openingBatchLines[index]) return;
        this.openingBatchLines[index][field] = parseFloat(value) || 0;
        const rowCost = (parseFloat(this.openingBatchLines[index].quantity) || 0) * (parseFloat(this.openingBatchLines[index].unitCost) || 0);
        const rowEl = document.getElementById(`op-line-total-${index}`);
        if (rowEl) rowEl.textContent = engine.formatMoney(rowCost);
        this.calculateOpeningBatchTotals();
    }

    calculateOpeningBatchTotals() {
        const lines = this.openingBatchLines || [];
        let totalQty = 0;
        let totalCost = 0;

        lines.forEach(l => {
            const q = parseFloat(l.quantity) || 0;
            const c = parseFloat(l.unitCost) || 0;
            totalQty += q;
            totalCost += (q * c);
        });

        const setTxt = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
        };

        setTxt('op-batch-items-count', String(lines.length));
        setTxt('op-batch-total-qty', String(totalQty));
        setTxt('op-batch-total-cost', engine.formatMoney(totalCost));
    }

    saveOpeningBatchFromForm() {
        try {
            const warehouseId = document.getElementById('op-batch-wh')?.value;
            const date = document.getElementById('op-batch-date')?.value;
            const notes = document.getElementById('op-batch-notes')?.value.trim() || '';

            const result = inventory.executeOpeningBalanceBatch({
                warehouseId,
                date,
                items: this.openingBatchLines,
                notes
            });

            this.closeModal();
            this.showToast(`تم تسجيل دفعة الرصيد الافتتاحي (${result.batch.id}) وتوليد القيد المحاسبي بنجاح!`, 'success');
            this.renderCurrentTab();
        } catch (err) {
            this.showToast(err.message, 'error');
        }
    }

    viewOpeningBatchVoucher(batchId) {
        const batch = storage.getOpeningBatchById(batchId);
        if (!batch) {
            this.showToast('دفعة الرصيد الافتتاحي غير موجودة', 'error');
            return;
        }

        const settings = storage.getSettings();
        const wh = storage.getWarehouseById(batch.warehouseId);
        const content = document.getElementById('voucher-modal-content');
        if (!content) return;

        content.innerHTML = `
            <div class="voucher-paper">
                <div class="voucher-header">
                    <h2>${settings.companyName}</h2>
                    <div class="sub-title">بيان وسند دفعة رصيد افتتاحي للمخزون (Opening Stock Batch)</div>
                </div>

                <div class="voucher-meta">
                    <div><strong>رقم الدفعة:</strong> <span style="font-family: monospace; color: var(--primary);">${batch.id}</span></div>
                    <div><strong>التاريخ:</strong> ${batch.date}</div>
                    <div><strong>المستودع المستلم:</strong> ${wh ? wh.name : batch.warehouseId}</div>
                    <div><strong>رقم القيد المحاسبي:</strong> ${batch.journalEntryId || '-'}</div>
                </div>

                <table class="acc-table" style="margin-bottom: 20px;">
                    <thead>
                        <tr>
                            <th style="width: 8%;">#</th>
                            <th style="width: 18%;">كود الصنف</th>
                            <th style="width: 34%;">اسم الصنف</th>
                            <th style="width: 12%;">الوحدة</th>
                            <th class="num" style="width: 12%;">الكمية الافتتاحية</th>
                            <th class="num" style="width: 16%;">تكلفة الوحدة</th>
                            <th class="num" style="width: 16%;">إجمالي التكلفة</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${(batch.items || []).map((item, idx) => `
                            <tr>
                                <td>${idx + 1}</td>
                                <td style="font-family: monospace;">${item.sku || item.productId}</td>
                                <td><strong>${item.productName}</strong></td>
                                <td>${item.unit || '-'}</td>
                                <td class="num">${item.quantity}</td>
                                <td class="num">${engine.formatMoney(item.unitCost)}</td>
                                <td class="num"><strong>${engine.formatMoney(item.totalCost)}</strong></td>
                            </tr>
                        `).join('')}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="4"><strong>الإجمالي الكلي للدفعة الافتتاحية</strong></td>
                            <td class="num"><strong>${batch.totalQuantity}</strong></td>
                            <td></td>
                            <td class="num" style="color: var(--success); font-size: 15px;"><strong>${engine.formatMoney(batch.totalCost)}</strong></td>
                        </tr>
                    </tfoot>
                </table>

                <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: var(--radius-sm); padding: 12px; font-size: 13px; color: #166534;">
                    <strong>التوجيه المحاسبي المنفذ:</strong> من حـ/ مخزون البضائع (1104) مدين بمبلغ ${engine.formatMoney(batch.totalCost)} — إلى حـ/ رأس المال المدفوع / رصيد افتتاحي (3101) دائن بمبلغ ${engine.formatMoney(batch.totalCost)}.
                </div>

                <div class="voucher-signatures">
                    <div class="sig-box">أمين المستودع</div>
                    <div class="sig-box">المحاسب المالي</div>
                    <div class="sig-box">اعتماد الإدارة</div>
                </div>
            </div>
        `;

        this.openModal('voucher-modal');
    }

    deleteOpeningBatch(batchId) {
        if (!confirm(`هل أنت متأكد من حذف دفعة الرصيد الافتتاحي رقم (${batchId})؟ سيتم حذف القيد المحاسبي وسحب الكميات الافتتاحية المرتبطة بها.`)) {
            return;
        }
        try {
            storage.deleteOpeningBatch(batchId);
            this.showToast('تم حذف دفعة الرصيد الافتتاحي وإلغاء قيدها وحركاتها المخزنية بنجاح', 'info');
            this.renderCurrentTab();
        } catch (err) {
            this.showToast(err.message, 'error');
        }
    }

    // ==================== 14. مركز طباعة ومعاينة الفواتير (Invoice Print Center) ====================
    openInvoiceInPrintCenter(invoiceId) {
        this.selectedPrintInvoiceId = invoiceId;
        this.switchTab('invoice_print');
    }

    renderInvoicePrintCenter() {
        const invoices = storage.getInvoices();
        if (!this.selectedPrintInvoiceId && invoices.length > 0) {
            this.selectedPrintInvoiceId = invoices[0].id;
        } else if (this.selectedPrintInvoiceId && !invoices.some(i => i.id === this.selectedPrintInvoiceId)) {
            this.selectedPrintInvoiceId = invoices.length > 0 ? invoices[0].id : null;
        }
        this.renderBrandPanel();
        this.renderInvoicePrintList();
        this.updateInvoicePrintPreview();
    }

    renderInvoicePrintList() {
        const invoices = storage.getInvoices();
        const searchVal = document.getElementById('print-center-search')?.value.trim().toLowerCase() || '';
        const typeVal = document.getElementById('print-center-type')?.value || 'all';
        const listEl = document.getElementById('print-center-invoices-list');
        const countEl = document.getElementById('print-list-count');

        if (!listEl) return;

        const filtered = invoices.filter(inv => {
            const matchType = typeVal === 'all' || inv.type === typeVal;
            const matchQuery = !searchVal ||
                (inv.id && inv.id.toLowerCase().includes(searchVal)) ||
                (inv.partyName && inv.partyName.toLowerCase().includes(searchVal));
            return matchType && matchQuery;
        });

        if (countEl) countEl.textContent = String(filtered.length);

        if (filtered.length === 0) {
            listEl.innerHTML = `
                <div style="text-align: center; padding: 30px 14px; color: var(--text-muted); font-size: 13px;">
                    لا توجد فواتير مطابقة. قم بإصدار فاتورة مبيعات أو مشتريات لتتمكن من طباعتها.
                </div>
            `;
            return;
        }

        if (!this.selectedPrintInvoiceId || !filtered.some(i => i.id === this.selectedPrintInvoiceId)) {
            this.selectedPrintInvoiceId = filtered[0].id;
        }

        const typeLabels = {
            SALES: { badge: '🛒 مبيعات', cls: 'badge-success', color: 'var(--success)' },
            PURCHASE: { badge: '📥 مشتريات', cls: 'badge-info', color: 'var(--primary)' },
            SALES_RETURN: { badge: '↩️ مرتجع بيع', cls: 'badge-warning', color: '#b45309' },
            PURCHASE_RETURN: { badge: '↪️ مرتجع شراء', cls: 'badge-danger', color: '#7e22ce' }
        };

        listEl.innerHTML = filtered.map(inv => {
            const isSelected = inv.id === this.selectedPrintInvoiceId;
            const tInfo = typeLabels[inv.type] || typeLabels.SALES;
            return `
                <div class="print-inv-item ${isSelected ? 'active' : ''}" onclick="ui.selectInvoiceForPrint('${inv.id}')">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                        <strong style="font-family: monospace; color: ${isSelected ? '#1e3a8a' : 'var(--text-primary)'}; font-size: 13.5px;">${inv.id}</strong>
                        <span class="badge ${tInfo.cls}" style="font-size: 10.5px;">
                            ${tInfo.badge}
                        </span>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; font-size: 12.5px; color: var(--text-secondary);">
                        <span>${inv.partyName}</span>
                        <strong class="num" style="color: ${tInfo.color};">${engine.formatMoney(inv.totalAmount)}</strong>
                    </div>
                    <div style="font-size: 11px; color: var(--text-muted); margin-top: 3px;">
                        📅 ${inv.date} • 📦 ${inv.items ? inv.items.length : 0} أصناف
                    </div>
                </div>
            `;
        }).join('');
    }

    selectInvoiceForPrint(invoiceId) {
        this.selectedPrintInvoiceId = invoiceId;
        this.renderInvoicePrintList();
        this.updateInvoicePrintPreview();
    }

    // ---------- أدوات مساعدة لتصميم الفاتورة والكليشة ----------
    escapeHtml(str) {
        return String(str === undefined || str === null ? '' : str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    shadeColor(hex, percent) {
        let h = String(hex || '#1e3a8a').replace('#', '');
        if (h.length === 3) h = h.split('').map(c => c + c).join('');
        const num = parseInt(h, 16) || 0;
        let r = (num >> 16) & 255;
        let g = (num >> 8) & 255;
        let b = num & 255;
        const target = percent < 0 ? 0 : 255;
        const p = Math.abs(percent) / 100;
        r = Math.round((target - r) * p + r);
        g = Math.round((target - g) * p + g);
        b = Math.round((target - b) * p + b);
        return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
    }

    hexToRgba(hex, alpha) {
        let h = String(hex || '#1e3a8a').replace('#', '');
        if (h.length === 3) h = h.split('').map(c => c + c).join('');
        const num = parseInt(h, 16) || 0;
        return `rgba(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}, ${alpha})`;
    }

    // بناء HTML الفاتورة (يُستخدم في مركز الطباعة وفي المعاينة السريعة)
    buildInvoiceHTML(inv, opts = {}) {
        const settings = storage.getSettings();
        const template = opts.template || 'a4';
        const showLogo = opts.showLogo !== false;
        const showSigs = opts.showSigs !== false;
        const showNotes = opts.showNotes !== false;
        const e = (v) => this.escapeHtml(v);

        const isQuotation = Boolean(opts.isQuotation);
        const isSales = inv.type === 'SALES' || inv.type === 'SALES_RETURN';
        const paidRowLabel = inv.type === 'SALES_RETURN'
            ? 'المبلغ المردود للعميل'
            : (inv.type === 'PURCHASE_RETURN'
                ? 'المبلغ المسترد من المورد'
                : (isSales ? 'المبلغ المستلم من العميل' : 'المبلغ المدفوع للمورد'));
        const wh = storage.getWarehouseById(inv.warehouseId);
        const accent = settings.invoiceAccent || '#1e3a8a';
        const style = settings.invoiceHeaderStyle || 'modern';
        const cssVars = `--inv-accent:${accent};--inv-accent-dark:${this.shadeColor(accent, -38)};--inv-accent-soft:${this.hexToRgba(accent, 0.08)};--inv-accent-mid:${this.hexToRgba(accent, 0.18)};`;

        const payNames = { CASH: 'نقداً', BANK: 'تحويل بنكي', CREDIT: 'آجل (على الحساب)' };
        const isPaid = inv.paymentMethod !== 'CREDIT';
        const docTitles = {
            SALES: { ar: isQuotation ? 'عرض سعر رسمي' : 'فاتورة مبيعات', en: isQuotation ? 'PRICE QUOTATION' : 'SALES INVOICE' },
            PURCHASE: { ar: 'فاتورة مشتريات', en: 'PURCHASE INVOICE' },
            SALES_RETURN: { ar: 'إشعار مرتجع مبيعات', en: 'SALES RETURN NOTE' },
            PURCHASE_RETURN: { ar: 'إشعار مرتجع مشتريات', en: 'PURCHASE RETURN NOTE' }
        };
        const titleAr = (docTitles[inv.type] || docTitles.SALES).ar;
        const titleEn = (docTitles[inv.type] || docTitles.SALES).en;
        const initial = (settings.companyName || 'م').trim().charAt(0);
        const logoHtml = settings.invoiceLogo
            ? `<img src="${settings.invoiceLogo}" alt="logo">`
            : `<span class="inv-logo-mono">${e(initial)}</span>`;

        const contactBits = [
            settings.companyAddress ? `📍 ${e(settings.companyAddress)}` : '',
            settings.companyPhone ? `📞 ${e(settings.companyPhone)}` : '',
            settings.companyTaxNumber ? `🧾 الرقم الضريبي: ${e(settings.companyTaxNumber)}` : ''
        ].filter(Boolean);

        // ===== قالب الكاشير الحراري 80mm =====
        if (template === 'thermal') {
            return `
                <div class="thermal-receipt-paper" id="printable-invoice-sheet" style="${cssVars}">
                    ${showLogo ? `
                    <div class="thermal-header">
                        ${settings.invoiceLogo ? `<img class="thermal-logo" src="${settings.invoiceLogo}" alt="logo">` : ''}
                        <h2>${e(settings.companyName)}</h2>
                        ${settings.invoiceSlogan ? `<div style="font-size: 11.5px; font-weight: 700;">${e(settings.invoiceSlogan)}</div>` : ''}
                        ${settings.companyAddress ? `<div style="font-size: 11.5px;">${e(settings.companyAddress)}</div>` : ''}
                        ${settings.companyPhone ? `<div style="font-size: 11.5px;">هاتف: ${e(settings.companyPhone)}</div>` : ''}
                        ${settings.companyTaxNumber ? `<div style="font-size: 11px;">الرقم الضريبي: ${e(settings.companyTaxNumber)}</div>` : ''}
                    </div>` : ''}

                    <div class="thermal-title-box">${titleAr}</div>

                    <div class="thermal-meta">
                        <div><span>رقم الفاتورة:</span> <strong style="font-family: monospace;">${e(inv.id)}</strong></div>
                        <div><span>التاريخ:</span> <strong>${e(inv.date)}</strong></div>
                        <div><span>${isSales ? 'العميل:' : 'المورد:'}</span> <strong>${e(inv.partyName)}</strong></div>
                        <div><span>الدفع:</span> <strong>${payNames[inv.paymentMethod] || e(inv.paymentMethod)}</strong></div>
                    </div>

                    <table class="thermal-table">
                        <thead>
                            <tr><th>الصنف</th><th class="num">الكمية</th><th class="num">السعر</th><th class="num">المجموع</th></tr>
                        </thead>
                        <tbody>
                            ${(inv.items || []).map(item => `
                                <tr>
                                    <td>${e(item.productName)}</td>
                                    <td class="num">${item.quantity}</td>
                                    <td class="num">${engine.formatMoney(item.unitPrice)}</td>
                                    <td class="num"><strong>${engine.formatMoney(item.total)}</strong></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>

                    <div class="thermal-totals">
                        <div class="row"><span>المجموع الفرعي:</span> <span class="num">${engine.formatMoney(inv.subtotal)}</span></div>
                        ${inv.discount > 0 ? `<div class="row"><span>الخصم:</span> <span class="num">- ${engine.formatMoney(inv.discount)}</span></div>` : ''}
                        ${inv.taxAmount > 0 ? `<div class="row"><span>الضريبة (${inv.taxRate}%):</span> <span class="num">${engine.formatMoney(inv.taxAmount)}</span></div>` : ''}
                        <div class="row grand"><span>الإجمالي الصافي:</span> <span class="num">${engine.formatMoney(inv.totalAmount)}</span></div>
                        ${settings.showSecondaryCurrency ? `<div class="row" style="font-size: 11px; color: #334155;"><span>المعادل (${e(settings.secondaryCurrency)}):</span> <span class="num"><strong>${engine.formatSecondaryMoney(inv.totalAmount)}</strong></span></div>` : ''}
                        ${!isQuotation ? `<div class="row" style="margin-top: 4px; padding-top: 4px; border-top: 1px dashed #cbd5e1;"><span>${paidRowLabel}:</span> <span class="num"><strong>${engine.formatMoney(inv.paidAmount !== undefined ? inv.paidAmount : (inv.paymentMethod === 'CREDIT' ? 0 : inv.totalAmount))}</strong></span></div>` : ''}
                        ${!isQuotation && (inv.changeAmount || 0) > 0 ? `<div class="row" style="color: #047857;"><span>الباقي للعميل:</span> <span class="num"><strong>${engine.formatMoney(inv.changeAmount)}</strong></span></div>` : ''}
                        ${!isQuotation && (inv.remainingAmount || 0) > 0 ? `<div class="row" style="color: #b45309;"><span>المتبقي الآجل:</span> <span class="num"><strong>${engine.formatMoney(inv.remainingAmount)}</strong></span></div>` : ''}
                    </div>

                    ${showNotes && (inv.notes || settings.invoiceFooterText) ? `
                    <div class="thermal-footer">
                        ${inv.notes ? `<div style="margin-bottom: 4px;">${e(inv.notes)}</div>` : ''}
                        <div>${e(settings.invoiceFooterText || '')}</div>
                    </div>` : ''}
                </div>
            `;
        }

        // ===== قالب A4 العصري =====
        let header = '';
        if (showLogo && settings.invoiceBanner) {
            header = `
                <div class="inv-banner"><img src="${settings.invoiceBanner}" alt="كليشة المنشأة"></div>
                <div class="inv-title-strip">
                    <div class="t"><strong>${titleAr}</strong><span>${titleEn}</span></div>
                    <div class="n">#${e(inv.id)}</div>
                </div>`;
        } else if (showLogo) {
            header = `
                <div class="inv-header inv-header-${style}">
                    <div class="inv-brand">
                        <div class="inv-logo">${logoHtml}</div>
                        <div class="inv-brand-text">
                            <h1>${e(settings.companyName)}</h1>
                            ${settings.invoiceSlogan ? `<div class="inv-slogan">${e(settings.invoiceSlogan)}</div>` : ''}
                            ${contactBits.length ? `<div class="inv-contact">${contactBits.map(b => `<span>${b}</span>`).join('')}</div>` : ''}
                        </div>
                    </div>
                    <div class="inv-doc">
                        <div class="inv-doc-title">${titleAr}</div>
                        <div class="inv-doc-en">${titleEn}</div>
                        <div class="inv-doc-no">#${e(inv.id)}</div>
                    </div>
                </div>`;
        } else {
            header = `
                <div class="inv-title-strip">
                    <div class="t"><strong>${titleAr}</strong><span>${titleEn}</span></div>
                    <div class="n">#${e(inv.id)}</div>
                </div>`;
        }

        const rows = (inv.items || []).map((item, idx) => `
            <tr>
                <td class="c">${idx + 1}</td>
                <td><strong>${e(item.productName)}</strong><div class="inv-sku">${e(item.sku || item.productId)}</div></td>
                <td class="c">${e(item.unit || '-')}</td>
                <td class="c"><strong>${item.quantity}</strong></td>
                <td class="num">${engine.formatMoney(item.unitPrice)}</td>
                <td class="num"><strong>${engine.formatMoney(item.total)}</strong></td>
            </tr>
        `).join('');

        return `
            <div class="inv-sheet" id="printable-invoice-sheet" style="${cssVars}">
                ${header}

                <div class="inv-body">
                    <div class="inv-info-grid">
                        <div class="inv-info-card">
                            <div class="inv-info-title">${isSales ? 'فاتورة إلى' : 'المورد'}</div>
                            <div class="inv-party">${e(inv.partyName)}</div>
                            <div class="inv-info-line"><span>طريقة الدفع</span><strong>${payNames[inv.paymentMethod] || e(inv.paymentMethod)}</strong></div>
                            <div class="inv-info-line"><span>المستودع</span><strong>${e(wh ? wh.name : inv.warehouseId)}</strong></div>
                        </div>
                        <div class="inv-info-card">
                            <div class="inv-info-title">تفاصيل الفاتورة</div>
                            <div class="inv-info-line"><span>رقم الفاتورة</span><strong style="font-family: monospace;">${e(inv.id)}</strong></div>
                            <div class="inv-info-line"><span>تاريخ الإصدار</span><strong>${e(inv.date)}</strong></div>
                            <div class="inv-info-line"><span>مرجع القيد</span><strong style="font-family: monospace;">${e(inv.journalEntryId || '-')}</strong></div>
                        </div>
                    </div>

                    <table class="inv-table">
                        <thead>
                            <tr>
                                <th class="c" style="width: 6%;">#</th>
                                <th style="width: 38%;">البيان / الصنف</th>
                                <th class="c" style="width: 12%;">الوحدة</th>
                                <th class="c" style="width: 10%;">الكمية</th>
                                <th class="num" style="width: 16%;">سعر الوحدة</th>
                                <th class="num" style="width: 18%;">الإجمالي</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>

                    <div class="inv-bottom">
                        <div class="inv-notes-col">
                            ${showNotes && inv.notes ? `
                            <div class="inv-note-box"><strong>ملاحظات</strong><div>${e(inv.notes)}</div></div>` : ''}
                            <div class="inv-stamp ${isQuotation ? 'paid' : (isPaid ? 'paid' : 'unpaid')}">${isQuotation ? (inv.validUntil ? `صالح حتى ${e(inv.validUntil)}` : 'عرض سعر') : (isPaid ? 'مدفوعة' : 'آجلة')}</div>
                        </div>

                        <div class="inv-totals">
                            <div class="r"><span>المجموع الفرعي</span><strong class="num">${engine.formatMoney(inv.subtotal)}</strong></div>
                            ${inv.discount > 0 ? `<div class="r disc"><span>الخصم</span><strong class="num">- ${engine.formatMoney(inv.discount)}</strong></div>` : ''}
                            ${inv.taxAmount > 0 ? `<div class="r"><span>ضريبة القيمة المضافة (${inv.taxRate}%)</span><strong class="num">${engine.formatMoney(inv.taxAmount)}</strong></div>` : ''}
                            <div class="r grand"><span>${isQuotation ? 'صافي قيمة العرض' : 'الصافي المستحق'}</span><strong class="num">${engine.formatMoney(inv.totalAmount)}</strong></div>
                            ${settings.showSecondaryCurrency ? `<div class="r" style="background: #f0fdf4; padding: 4px 8px; border-radius: 6px; font-size: 12px;"><span>المعادل بالعملة المحلية (${e(settings.secondaryCurrency)})</span><strong class="num" style="color: #166534;">${engine.formatSecondaryMoney(inv.totalAmount)}</strong></div>` : ''}
                            ${!isQuotation ? `<div class="r" style="border-top: 1px dashed #cbd5e1; margin-top: 6px; padding-top: 6px;"><span>${paidRowLabel}</span><strong class="num" style="color: #047857;">${engine.formatMoney(inv.paidAmount !== undefined ? inv.paidAmount : (inv.paymentMethod === 'CREDIT' ? 0 : inv.totalAmount))}</strong></div>` : ''}
                            ${!isQuotation && (inv.changeAmount || 0) > 0 ? `<div class="r"><span>الباقي النقدي للعميل</span><strong class="num" style="color: #0284c7;">${engine.formatMoney(inv.changeAmount)}</strong></div>` : ''}
                            ${!isQuotation && (inv.remainingAmount || 0) > 0 ? `<div class="r"><span>المتبقي الآجل بالذمة</span><strong class="num" style="color: #b45309;">${engine.formatMoney(inv.remainingAmount)}</strong></div>` : ''}
                        </div>
                    </div>

                    ${showSigs ? `
                    <div class="inv-sigs">
                        <div class="inv-sig">توقيع المستلم / العميل</div>
                        <div class="inv-sig">أمين المستودع</div>
                        <div class="inv-sig">الختم والاعتماد</div>
                    </div>` : ''}
                </div>

                ${showNotes && settings.invoiceFooterText ? `<div class="inv-footer">${e(settings.invoiceFooterText)}</div>` : ''}
            </div>
        `;
    }

    updateInvoicePrintPreview() {
        const previewEl = document.getElementById('invoice-print-preview-area');
        if (!previewEl) return;

        const inv = this.selectedPrintInvoiceId ? storage.getInvoiceById(this.selectedPrintInvoiceId) : null;
        if (!inv) {
            previewEl.innerHTML = `
                <div class="voucher-paper" style="text-align: center; padding: 60px 20px; color: var(--text-muted);">
                    <div style="font-size: 48px; margin-bottom: 12px;">🖨️</div>
                    <h3 style="color: var(--text-secondary); margin-bottom: 8px;">لا توجد فاتورة محددة للطباعة</h3>
                    <p style="font-size: 13.5px; margin-bottom: 20px;">قم بإصدار فاتورة جديدة أو اختر فاتورة من القائمة الجانبية لمعاينتها وطباعتها فوراً.</p>
                    <button class="btn btn-primary" onclick="ui.openInvoiceModal('SALES')">🛒 إصدار فاتورة مبيعات الآن</button>
                </div>
            `;
            return;
        }

        previewEl.innerHTML = this.buildInvoiceHTML(inv, {
            template: document.getElementById('print-template-style')?.value || 'a4',
            showLogo: document.getElementById('print-opt-logo') ? document.getElementById('print-opt-logo').checked : true,
            showSigs: document.getElementById('print-opt-sigs') ? document.getElementById('print-opt-sigs').checked : true,
            showNotes: document.getElementById('print-opt-notes') ? document.getElementById('print-opt-notes').checked : true
        });
    }

    // ---------- تخصيص الكليشة (الشعار / الترويسة / الألوان) ----------
    readImageAsDataURL(file, maxWidth, mime, quality) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = () => reject(new Error('تعذر قراءة ملف الصورة'));
            reader.onload = () => {
                const img = new Image();
                img.onerror = () => reject(new Error('الملف المحدد ليس صورة صالحة'));
                img.onload = () => {
                    const scale = Math.min(1, maxWidth / img.width);
                    const canvas = document.createElement('canvas');
                    canvas.width = Math.max(1, Math.round(img.width * scale));
                    canvas.height = Math.max(1, Math.round(img.height * scale));
                    const ctx = canvas.getContext('2d');
                    if (mime === 'image/jpeg') {
                        ctx.fillStyle = '#ffffff';
                        ctx.fillRect(0, 0, canvas.width, canvas.height);
                    }
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    resolve(canvas.toDataURL(mime, quality));
                };
                img.src = reader.result;
            };
            reader.readAsDataURL(file);
        });
    }

    saveBrandSetting(patch) {
        try {
            storage.saveSettings({ ...storage.getSettings(), ...patch });
        } catch (err) {
            this.showToast('تعذر الحفظ: مساحة التخزين ممتلئة، جرّب صورة أصغر حجماً', 'error');
            return false;
        }
        this.renderBrandPanel();
        this.updateInvoicePrintPreview();
        return true;
    }

    onBrandLogoSelected(input) {
        const file = input.files && input.files[0];
        if (!file) return;
        this.readImageAsDataURL(file, 400, 'image/png', 0.92)
            .then(url => {
                if (this.saveBrandSetting({ invoiceLogo: url })) this.showToast('تم تحديث شعار الفاتورة', 'success');
            })
            .catch(err => this.showToast(err.message, 'error'));
        input.value = '';
    }

    removeBrandLogo() {
        this.saveBrandSetting({ invoiceLogo: '' });
        this.showToast('تمت إزالة الشعار (سيظهر الحرف الأول من اسم المنشأة)', 'info');
    }

    onBrandBannerSelected(input) {
        const file = input.files && input.files[0];
        if (!file) return;
        this.readImageAsDataURL(file, 1400, 'image/jpeg', 0.9)
            .then(url => {
                if (this.saveBrandSetting({ invoiceBanner: url })) this.showToast('تم اعتماد الكليشة الجديدة في ترويسة الفاتورة', 'success');
            })
            .catch(err => this.showToast(err.message, 'error'));
        input.value = '';
    }

    removeBrandBanner() {
        this.saveBrandSetting({ invoiceBanner: '' });
        this.showToast('تمت إزالة الكليشة، عاد التصميم التلقائي للترويسة', 'info');
    }

    setBrandAccent(color) {
        this.saveBrandSetting({ invoiceAccent: color });
    }

    onBrandFieldChange() {
        const getVal = (id) => document.getElementById(id)?.value.trim() || '';
        this.saveBrandSetting({
            invoiceHeaderStyle: getVal('brand-header-style') || 'modern',
            invoiceSlogan: getVal('brand-slogan'),
            invoiceFooterText: getVal('brand-footer')
        });
    }

    resetBrandDefaults() {
        this.saveBrandSetting({
            invoiceLogo: '',
            invoiceBanner: '',
            invoiceAccent: '#1e3a8a',
            invoiceHeaderStyle: 'modern',
            invoiceSlogan: ''
        });
        this.showToast('تمت استعادة تصميم الفاتورة الافتراضي', 'info');
    }

    renderBrandPanel() {
        const settings = storage.getSettings();
        const e = (v) => this.escapeHtml(v);

        const logoBox = document.getElementById('brand-logo-preview');
        if (logoBox) {
            logoBox.innerHTML = settings.invoiceLogo
                ? `<img src="${settings.invoiceLogo}" alt="logo" style="max-width: 100%; max-height: 100%; object-fit: contain;">`
                : `<span style="font-size: 12.5px; color: var(--text-muted);">لا يوجد شعار — يظهر الحرف الأول «${e((settings.companyName || 'م').trim().charAt(0))}»</span>`;
        }

        const bannerBox = document.getElementById('brand-banner-preview');
        if (bannerBox) {
            bannerBox.innerHTML = settings.invoiceBanner
                ? `<img src="${settings.invoiceBanner}" alt="banner" style="width: 100%; height: 100%; object-fit: contain;">`
                : `<span style="font-size: 12.5px; color: var(--text-muted);">لم تُرفع كليشة — الترويسة تُصمَّم تلقائياً</span>`;
        }

        const accent = (settings.invoiceAccent || '#1e3a8a').toLowerCase();
        const colors = ['#1e3a8a', '#0f766e', '#047857', '#b91c1c', '#7c3aed', '#c2410c', '#0f172a', '#be185d', '#b45309'];
        const swatches = document.getElementById('brand-swatches');
        if (swatches) {
            swatches.innerHTML = colors.map(c => `
                <button type="button" class="brand-swatch ${c === accent ? 'active' : ''}" style="background: ${c};" title="${c}" onclick="ui.setBrandAccent('${c}')"></button>
            `).join('');
        }

        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.value = val;
        };
        setVal('brand-accent-input', /^#[0-9a-f]{6}$/i.test(accent) ? accent : '#1e3a8a');
        setVal('brand-header-style', settings.invoiceHeaderStyle || 'modern');
        setVal('brand-slogan', settings.invoiceSlogan || '');
        setVal('brand-footer', settings.invoiceFooterText || '');
    }

    printSelectedInvoice() {
        if (!this.selectedPrintInvoiceId) {
            this.showToast('يرجى اختيار فاتورة أولاً لطباعتها', 'warning');
            return;
        }
        window.print();
    }

    // ==================== 15. قسم سندات القبض والصرف (Vouchers) ====================
    renderVouchers() {
        const vouchers = storage.getVouchers();
        const searchVal = document.getElementById('voucher-search')?.value.trim().toLowerCase() || '';
        const typeVal = document.getElementById('voucher-type-filter')?.value || 'all';

        const receipts = vouchers.filter(v => v.type === 'RECEIPT');
        const payments = vouchers.filter(v => v.type === 'PAYMENT');
        const totalReceipts = receipts.reduce((s, v) => s + (parseFloat(v.amount) || 0), 0);
        const totalPayments = payments.reduce((s, v) => s + (parseFloat(v.amount) || 0), 0);
        const netFlow = totalReceipts - totalPayments;

        const setTxt = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
        };

        setTxt('vch-kpi-receipts', engine.formatMoney(totalReceipts));
        setTxt('vch-kpi-receipts-count', `${receipts.length} سند قبض`);
        setTxt('vch-kpi-payments', engine.formatMoney(totalPayments));
        setTxt('vch-kpi-payments-count', `${payments.length} سند صرف`);
        setTxt('vch-kpi-net', engine.formatMoney(netFlow));

        const filtered = vouchers.filter(v => {
            const matchType = typeVal === 'all' || v.type === typeVal;
            const matchQuery = !searchVal ||
                (v.id && v.id.toLowerCase().includes(searchVal)) ||
                (v.partyName && v.partyName.toLowerCase().includes(searchVal)) ||
                (v.description && v.description.toLowerCase().includes(searchVal)) ||
                (v.reference && v.reference.toLowerCase().includes(searchVal));
            return matchType && matchQuery;
        });

        const tbody = document.getElementById('vouchers-tbody');
        if (!tbody) return;

        if (filtered.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; padding: 36px; color: var(--text-muted);">
                        لا توجد سندات قبض أو صرف مسجلة بعد. اضغط على "سند قبض جديد" أو "سند صرف جديد" للبدء.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = filtered.map(v => {
            const isReceipt = v.type === 'RECEIPT';
            const acc = storage.getAccountByCode(v.targetAccountCode);
            const accName = acc ? `${acc.code} - ${acc.name}` : v.targetAccountCode;
            const payBadge = v.paymentMethod === 'BANK'
                ? '<span class="badge badge-info">🏦 بنكي (1102)</span>'
                : '<span class="badge badge-success">💵 نقداً (1101)</span>';

            return `
                <tr>
                    <td><strong style="font-family: monospace; color: var(--primary);">${this.escapeHtml(v.id)}</strong></td>
                    <td>
                        <span class="badge ${isReceipt ? 'badge-success' : 'badge-danger'}">
                            ${isReceipt ? '📥 سند قبض' : '📤 سند صرف'}
                        </span>
                    </td>
                    <td>${this.escapeHtml(v.date)}</td>
                    <td>
                        <strong>${this.escapeHtml(v.partyName)}</strong>
                        ${v.reference ? `<span style="display: block; font-size: 11px; color: var(--text-muted);">مرجع: ${this.escapeHtml(v.reference)}</span>` : ''}
                    </td>
                    <td>${payBadge}</td>
                    <td>
                        <div style="font-size: 12.5px; font-weight: 700;">${this.escapeHtml(accName)}</div>
                        <div style="font-size: 11.5px; color: var(--text-muted);">${this.escapeHtml(v.description || '')}</div>
                    </td>
                    <td class="num"><strong style="color: ${isReceipt ? 'var(--success)' : 'var(--danger)'};">${engine.formatMoney(v.amount)}</strong></td>
                    <td style="text-align: left; white-space: nowrap;">
                        <button class="btn btn-primary btn-sm" onclick="ui.viewCashVoucher('${v.id}')" title="طباعة ومعاينة السند">🖨️ طباعة</button>
                        ${v.journalEntryId ? `<button class="btn btn-outline btn-sm" onclick="ui.viewEntryVoucher('${v.journalEntryId}')" title="عرض القيد المحاسبي">📝</button>` : ''}
                        <button class="btn btn-outline btn-sm" style="color: var(--danger); border-color: #fca5a5;" onclick="ui.deleteVoucher('${v.id}')" title="حذف السند">🗑️</button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    openVoucherFormModal(type = 'RECEIPT', partyName = '', suggestedAmount = '', reference = '') {
        this.populatePartiesDatalist();

        const radios = document.querySelectorAll('input[name="vch-form-type"]');
        radios.forEach(r => { r.checked = (r.value === type); });

        const dateEl = document.getElementById('vch-form-date');
        if (dateEl) dateEl.value = new Date().toISOString().split('T')[0];

        const partyEl = document.getElementById('vch-form-party');
        if (partyEl) partyEl.value = partyName || '';

        const amountEl = document.getElementById('vch-form-amount');
        if (amountEl) amountEl.value = suggestedAmount || '';

        const methodEl = document.getElementById('vch-form-method');
        if (methodEl) methodEl.value = 'CASH';

        const refEl = document.getElementById('vch-form-ref');
        if (refEl) refEl.value = reference || '';

        const descEl = document.getElementById('vch-form-desc');
        if (descEl) {
            if (reference) {
                descEl.value = type === 'RECEIPT' ? `تحصيل دفعة عن الفاتورة رقم ${reference}` : `سداد دفعة عن الفاتورة رقم ${reference}`;
            } else if (partyName) {
                descEl.value = type === 'RECEIPT' ? `تحصيل دفعة من حساب العميل: ${partyName}` : `سداد دفعة لحساب المورد: ${partyName}`;
            } else {
                descEl.value = '';
            }
        }

        this.onVoucherTypeChange(type);
        this.openModal('voucher-form-modal');
    }

    onVoucherTypeChange(type) {
        const titleEl = document.getElementById('voucher-form-modal-title');
        const nextNoEl = document.getElementById('vch-form-next-no');
        const partyLbl = document.getElementById('vch-form-party-label');
        const accSelect = document.getElementById('vch-form-account');
        const hintEl = document.getElementById('vch-accounting-hint');

        if (nextNoEl) nextNoEl.textContent = storage.getNextVoucherNumber(type);

        const accounts = storage.getAccounts().filter(a => a.code !== '1101' && a.code !== '1102');
        const defaultCode = type === 'RECEIPT' ? '1103' : '2101';

        if (accSelect) {
            accSelect.innerHTML = accounts.map(a =>
                `<option value="${a.code}" ${a.code === defaultCode ? 'selected' : ''}>${a.code} - ${a.name}</option>`
            ).join('');
        }

        if (type === 'RECEIPT') {
            if (titleEl) titleEl.textContent = '📥 إصدار سند قبض نقدي / بنكي (تحصيل)';
            if (partyLbl) partyLbl.innerHTML = 'استلمنا من السيد / العميل <span class="req">*</span>:';
            if (hintEl) {
                hintEl.style.background = '#f0fdf4';
                hintEl.style.borderColor = '#86efac';
                hintEl.style.color = '#166534';
                hintEl.innerHTML = '🔗 <strong>القيد التلقائي:</strong> من حـ/ الصندوق أو البنك (1101/1102 مدين) ← إلى حـ/ الحساب المحدد (افتراضياً العملاء 1103 دائن) مع تخفيض مديونية العميل.';
            }
        } else {
            if (titleEl) titleEl.textContent = '📤 إصدار سند صرف نقدي / بنكي (دفع)';
            if (partyLbl) partyLbl.innerHTML = 'يصرف إلى السيد / المورد / الجهة <span class="req">*</span>:';
            if (hintEl) {
                hintEl.style.background = '#fef2f2';
                hintEl.style.borderColor = '#fecaca';
                hintEl.style.color = '#991b1b';
                hintEl.innerHTML = '🔗 <strong>القيد التلقائي:</strong> من حـ/ الحساب المحدد (الموردون 2101 أو المصروفات مدين) ← إلى حـ/ الصندوق أو البنك (1101/1102 دائن).';
            }
        }
    }

    saveVoucherFromForm() {
        try {
            const type = document.querySelector('input[name="vch-form-type"]:checked')?.value || 'RECEIPT';
            const partyName = document.getElementById('vch-form-party')?.value.trim() || '';
            const date = document.getElementById('vch-form-date')?.value;
            const amount = parseFloat(document.getElementById('vch-form-amount')?.value) || 0;
            const paymentMethod = document.getElementById('vch-form-method')?.value || 'CASH';
            const targetAccountCode = document.getElementById('vch-form-account')?.value || (type === 'RECEIPT' ? '1103' : '2101');
            const reference = document.getElementById('vch-form-ref')?.value.trim() || '';
            const description = document.getElementById('vch-form-desc')?.value.trim() || '';

            const voucher = storage.addVoucher({
                type,
                partyName,
                date,
                amount,
                paymentMethod,
                targetAccountCode,
                reference,
                description
            });

            this.closeModal();
            this.showToast(`تم حفظ ${type === 'RECEIPT' ? 'سند القبض' : 'سند الصرف'} رقم (${voucher.id}) وتوليد القيد بنجاح!`, 'success');
            this.renderCurrentTab();
        } catch (err) {
            this.showToast(err.message, 'error');
        }
    }

    viewCashVoucher(voucherId) {
        const v = storage.getVoucherById(voucherId);
        if (!v) {
            this.showToast('السند غير موجود', 'error');
            return;
        }

        const settings = storage.getSettings();
        const e = (val) => this.escapeHtml(val);
        const isReceipt = v.type === 'RECEIPT';
        const accent = settings.invoiceAccent || (isReceipt ? '#047857' : '#b91c1c');
        const style = settings.invoiceHeaderStyle || 'modern';
        const cssVars = `--inv-accent:${accent};--inv-accent-dark:${this.shadeColor(accent, -38)};--inv-accent-soft:${this.hexToRgba(accent, 0.08)};--inv-accent-mid:${this.hexToRgba(accent, 0.18)};`;

        const titleAr = isReceipt ? 'سند قبض نقدي / بنكي' : 'سند صرف نقدي / بنكي';
        const titleEn = isReceipt ? 'RECEIPT VOUCHER' : 'PAYMENT VOUCHER';
        const initial = (settings.companyName || 'م').trim().charAt(0);
        const logoHtml = settings.invoiceLogo
            ? `<img src="${settings.invoiceLogo}" alt="logo">`
            : `<span class="inv-logo-mono">${e(initial)}</span>`;
        const contactBits = [
            settings.companyAddress ? `📍 ${e(settings.companyAddress)}` : '',
            settings.companyPhone ? `📞 ${e(settings.companyPhone)}` : '',
            settings.companyTaxNumber ? `🧾 الرقم الضريبي: ${e(settings.companyTaxNumber)}` : ''
        ].filter(Boolean);

        const acc = storage.getAccountByCode(v.targetAccountCode);
        const accName = acc ? `${acc.code} - ${acc.name}` : v.targetAccountCode;
        const payMethodAr = v.paymentMethod === 'BANK' ? 'شيك / تحويل بنكي (1102)' : 'نقداً — الصندوق الرئيسي (1101)';

        let header = '';
        if (settings.invoiceBanner) {
            header = `
                <div class="inv-banner"><img src="${settings.invoiceBanner}" alt="كليشة المنشأة"></div>
                <div class="inv-title-strip">
                    <div class="t"><strong>${titleAr}</strong><span>${titleEn}</span></div>
                    <div class="n">#${e(v.id)}</div>
                </div>`;
        } else {
            header = `
                <div class="inv-header inv-header-${style}">
                    <div class="inv-brand">
                        <div class="inv-logo">${logoHtml}</div>
                        <div class="inv-brand-text">
                            <h1>${e(settings.companyName)}</h1>
                            ${settings.invoiceSlogan ? `<div class="inv-slogan">${e(settings.invoiceSlogan)}</div>` : ''}
                            ${contactBits.length ? `<div class="inv-contact">${contactBits.map(b => `<span>${b}</span>`).join('')}</div>` : ''}
                        </div>
                    </div>
                    <div class="inv-doc">
                        <div class="inv-doc-title">${titleAr}</div>
                        <div class="inv-doc-en">${titleEn}</div>
                        <div class="inv-doc-no">#${e(v.id)}</div>
                    </div>
                </div>`;
        }

        const content = document.getElementById('voucher-modal-content');
        if (!content) return;

        content.innerHTML = `
            <div class="inv-sheet" style="${cssVars}">
                ${header}
                <div class="inv-body">
                    <div style="display: flex; justify-content: space-between; align-items: center; background: var(--inv-accent-soft); border: 2px solid var(--inv-accent-mid); border-radius: 12px; padding: 18px 24px; margin-bottom: 22px;">
                        <div>
                            <div style="font-size: 12.5px; color: #64748b; font-weight: 700;">${isReceipt ? 'المبلغ المستلم' : 'المبلغ المصروف'}</div>
                            <div style="font-size: 28px; font-weight: 900; color: var(--inv-accent-dark); font-family: monospace;">${engine.formatMoney(v.amount)}</div>
                        </div>
                        <div style="text-align: left; font-size: 13px; color: #334155;">
                            <div><strong>تاريخ السند:</strong> ${e(v.date)}</div>
                            <div><strong>رقم القيد:</strong> <span style="font-family: monospace;">${e(v.journalEntryId || '-')}</span></div>
                        </div>
                    </div>

                    <table class="inv-table" style="margin-bottom: 24px;">
                        <tbody>
                            <tr>
                                <td style="width: 28%; background: #f8fafc; font-weight: 800;">${isReceipt ? 'استلمنا من السيد / السادة:' : 'يصرف إلى السيد / السادة:'}</td>
                                <td style="font-size: 15px; font-weight: 800;">${e(v.partyName)}</td>
                            </tr>
                            <tr>
                                <td style="background: #f8fafc; font-weight: 800;">طريقة الدفع:</td>
                                <td>${payMethodAr}</td>
                            </tr>
                            <tr>
                                <td style="background: #f8fafc; font-weight: 800;">الحساب المالي المقابل:</td>
                                <td>${e(accName)}</td>
                            </tr>
                            <tr>
                                <td style="background: #f8fafc; font-weight: 800;">وذلك عن (البيان):</td>
                                <td>${e(v.description || '-')}</td>
                            </tr>
                            ${v.reference ? `
                            <tr>
                                <td style="background: #f8fafc; font-weight: 800;">رقم المرجع / المستند:</td>
                                <td style="font-family: monospace;">${e(v.reference)}</td>
                            </tr>` : ''}
                        </tbody>
                    </table>

                    <div class="inv-sigs">
                        <div class="inv-sig">${isReceipt ? 'توقيع الدافع / المسلِّم' : 'توقيع المستلم'}</div>
                        <div class="inv-sig">أمين الصندوق / المحاسب</div>
                        <div class="inv-sig">الختم والاعتماد</div>
                    </div>
                </div>
                ${settings.invoiceFooterText ? `<div class="inv-footer">${e(settings.invoiceFooterText)}</div>` : ''}
            </div>
        `;

        this.openModal('voucher-modal');
    }

    deleteVoucher(voucherId) {
        if (!confirm(`هل أنت متأكد من حذف السند رقم (${voucherId})؟ سيتم إلغاء القيد المحاسبي المرتبط به.`)) {
            return;
        }
        try {
            storage.deleteVoucher(voucherId);
            this.showToast('تم حذف السند وإلغاء قيده المحاسبي بنجاح', 'info');
            this.renderCurrentTab();
        } catch (err) {
            this.showToast(err.message, 'error');
        }
    }

    // ==================== 16. قسم العملاء والموردين والديون (Parties & Debts CRM) ====================
    populatePartiesDatalist() {
        const dl = document.getElementById('parties-datalist');
        if (!dl) return;
        const parties = storage.getParties();
        dl.innerHTML = parties.map(p => `<option value="${this.escapeHtml(p.name)}">${p.type === 'SUPPLIER' ? 'مورد' : 'عميل'}</option>`).join('');
    }

    setPartyQuickFilter(mode) {
        const typeSel = document.getElementById('party-type-filter');
        const agingSel = document.getElementById('party-aging-filter');
        const searchInp = document.getElementById('party-search');

        if (mode === 'ALL') {
            if (typeSel) typeSel.value = 'all';
            if (agingSel) agingSel.value = 'all';
            if (searchInp) searchInp.value = '';
        } else if (mode === 'CUSTOMER') {
            if (typeSel) typeSel.value = 'CUSTOMER';
            if (agingSel) agingSel.value = 'all';
        } else if (mode === 'SUPPLIER') {
            if (typeSel) typeSel.value = 'SUPPLIER';
            if (agingSel) agingSel.value = 'all';
        } else if (mode === 'HAS_DEBT') {
            if (typeSel) typeSel.value = 'all';
            if (agingSel) agingSel.value = 'HAS_DEBT';
        } else if (mode === 'OVERDUE') {
            if (typeSel) typeSel.value = 'all';
            if (agingSel) agingSel.value = 'OVERDUE_15';
        }
        this.renderParties();
    }

    renderParties() {
        if (typeof storage.syncPartiesFromTransactions === 'function') {
            storage.syncPartiesFromTransactions();
        }
        const parties = storage.getParties();
        const searchVal = document.getElementById('party-search')?.value.trim().toLowerCase() || '';
        const typeVal = document.getElementById('party-type-filter')?.value || 'all';
        const agingVal = document.getElementById('party-aging-filter')?.value || 'all';

        let totalReceivables = 0;
        let totalPayables = 0;
        let custCount = 0;
        let supCount = 0;
        let overdueCount = 0;
        let maxOverdueDays = 0;

        const enriched = parties.map(p => {
            const stmt = storage.getPartyStatement(p.id);
            const bal = stmt ? stmt.closingBalance : (parseFloat(p.openingBalance) || 0);
            const daysOverdue = stmt ? (stmt.daysOverdue || 0) : 0;

            if (p.type === 'SUPPLIER') {
                supCount++;
                if (bal > 0.009) totalPayables += bal;
            } else {
                custCount++;
                if (bal > 0.009) totalReceivables += bal;
            }

            if (bal > 0.009 && daysOverdue >= 15) {
                overdueCount++;
            }
            if (bal > 0.009 && daysOverdue > maxOverdueDays) {
                maxOverdueDays = daysOverdue;
            }

            return { party: p, stmt, balance: bal, daysOverdue };
        });

        const setTxt = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
        };

        setTxt('party-kpi-receivables', engine.formatMoney(totalReceivables));
        setTxt('party-kpi-customers-count', `${custCount} عميل مسجل`);
        setTxt('party-kpi-payables', engine.formatMoney(totalPayables));
        setTxt('party-kpi-suppliers-count', `${supCount} مورد مسجل`);
        setTxt('party-kpi-net', engine.formatMoney(totalReceivables - totalPayables));
        setTxt('party-kpi-overdue', `${overdueCount} حساب متأخر`);
        setTxt('party-kpi-overdue-sub', maxOverdueDays > 0 ? `أقدم دين غير مسدد منذ ${maxOverdueDays} يوم` : 'جميع الحسابات منتظمة بالسداد');

        const filtered = enriched.filter(({ party, balance, daysOverdue }) => {
            const matchType = typeVal === 'all' || party.type === typeVal;
            const matchQuery = !searchVal ||
                (party.id && party.id.toLowerCase().includes(searchVal)) ||
                (party.name && party.name.toLowerCase().includes(searchVal)) ||
                (party.phone && party.phone.toLowerCase().includes(searchVal)) ||
                (party.address && party.address.toLowerCase().includes(searchVal));
            let matchAging = true;
            if (agingVal === 'HAS_DEBT') matchAging = Math.abs(balance) > 0.009;
            else if (agingVal === 'OVERDUE_15') matchAging = balance > 0.009 && daysOverdue >= 15;
            else if (agingVal === 'OVERDUE_30') matchAging = balance > 0.009 && daysOverdue >= 30;
            return matchType && matchQuery && matchAging;
        });

        const tbody = document.getElementById('parties-tbody');
        if (!tbody) return;

        if (filtered.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; padding: 36px; color: var(--text-muted);">
                        لا يوجد عملاء أو موردون يطابقون معايير البحث. يتم إضافة العملاء والموردين تلقائياً عند إصدار الفواتير أو يدوياً من الأزرار أعلاه.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = filtered.map(({ party, stmt, balance, daysOverdue }) => {
            const isSupplier = party.type === 'SUPPLIER';
            const totalInvoiced = stmt ? (stmt.totalInvoiced - stmt.totalReturned) : 0;
            const totalPaid = stmt ? stmt.totalPaid : 0;
            const invCount = stmt ? (stmt.invoicesCount || 0) : 0;

            let balColor = 'var(--success)';
            let balNote = 'خالص / مسدد';
            if (balance > 0.009) {
                balColor = isSupplier ? '#b45309' : 'var(--danger)';
                balNote = isSupplier ? 'مستحق للمورد علينا' : 'مستحق لنا بذمة العميل';
            } else if (balance < -0.009) {
                balColor = '#2563eb';
                balNote = isSupplier ? 'دفعة مقدمة لنا عند المورد' : 'رصيد دائن لصالح العميل';
            }

            let agingBadge = '<span class="badge badge-success">✅ مسدد بالكامل</span>';
            if (balance > 0.009) {
                if (daysOverdue >= 30) {
                    agingBadge = `<span class="badge badge-danger">🔴 متأخر حرج (${daysOverdue} يوم)</span>`;
                } else if (daysOverdue >= 15) {
                    agingBadge = `<span class="badge badge-warning">🟡 مستحق (${daysOverdue} يوم)</span>`;
                } else {
                    agingBadge = `<span class="badge badge-info">🟢 جاري (${daysOverdue} يوم)</span>`;
                }
            } else if (balance < -0.009) {
                agingBadge = `<span class="badge badge-info">💳 رصيد دائن مقدم</span>`;
            }

            const contactBits = [];
            if (party.phone) contactBits.push(`📞 ${this.escapeHtml(party.phone)}`);
            if (party.address) contactBits.push(`📍 ${this.escapeHtml(party.address)}`);

            const safePartyNameJs = JSON.stringify(party.name || '').replace(/"/g, '&quot;');
            const defaultPayAmt = balance > 0.009 ? Number(balance.toFixed(2)) : "''";

            return `
                <tr>
                    <td>
                        <div style="display: flex; align-items: center; gap: 6px;">
                            <strong style="font-size: 13.5px; color: var(--text-primary); cursor: pointer;" onclick="ui.viewPartyStatement('${party.id}')">${this.escapeHtml(party.name)}</strong>
                            <span style="font-size: 10.5px; font-family: monospace; color: var(--text-muted); background: #f1f5f9; padding: 1px 6px; border-radius: 4px;">${this.escapeHtml(party.id)}</span>
                        </div>
                        <div style="font-size: 11.5px; color: var(--text-muted); margin-top: 3px;">
                            ${contactBits.length > 0 ? contactBits.join(' • ') : 'بدون رقم هاتف أو عنوان'}
                        </div>
                    </td>
                    <td>
                        <span class="badge ${isSupplier ? 'badge-info' : 'badge-success'}">
                            ${isSupplier ? '🏢 مورد' : '👤 عميل'}
                        </span>
                    </td>
                    <td class="num">${engine.formatMoney(party.openingBalance || 0)}</td>
                    <td class="num">
                        <strong>${engine.formatMoney(totalInvoiced)}</strong>
                        <span style="display: block; font-size: 10.5px; color: var(--text-muted);">${invCount} فاتورة</span>
                    </td>
                    <td class="num" style="color: var(--success); font-weight: 700;">${engine.formatMoney(totalPaid)}</td>
                    <td class="num">
                        <strong style="color: ${balColor}; font-size: 14px; display: block;">${engine.formatMoney(Math.abs(balance))}</strong>
                        <span style="font-size: 10.5px; color: ${balColor};">${balNote}</span>
                    </td>
                    <td>${agingBadge}</td>
                    <td style="text-align: center; white-space: nowrap;">
                        <div style="display: inline-flex; gap: 4px; align-items: center; flex-wrap: nowrap;">
                            <button class="btn btn-primary btn-sm" style="padding: 4px 8px; font-size: 11.5px;" onclick="ui.viewPartyStatement('${party.id}')" title="فتح كشف الحساب التفصيلي">📑 كشف</button>
                            <button class="btn btn-outline btn-sm" style="padding: 4px 8px; font-size: 11.5px; color: #059669; border-color: #a7f3d0; font-weight: 700;" onclick="ui.openVoucherFormModal('${isSupplier ? 'PAYMENT' : 'RECEIPT'}', ${safePartyNameJs}, ${defaultPayAmt})" title="${isSupplier ? 'تسجيل سند صرف للمورد' : 'تسجيل سند قبض من العميل'}">
                                💳 ${isSupplier ? 'سداد' : 'تحصيل'}
                            </button>
                            ${!isSupplier ? `<button class="btn btn-outline btn-sm" style="padding: 4px 7px; font-size: 11.5px; color: #5b21b6; border-color: #c4b5fd;" onclick="ui.openInstallmentModal(${safePartyNameJs})" title="إنشاء عقد وجدول أقساط لهذا العميل">📅</button>` : ''}
                            ${balance > 0.009 ? `<button class="btn btn-outline btn-sm" style="padding: 4px 7px; font-size: 11.5px;" onclick="ui.copyDebtReminderMessage('${party.id}')" title="نسخ رسالة مطالبة مالية لإرسالها عبر واتساب">📲</button>` : ''}
                            <button class="btn btn-outline btn-sm" style="padding: 4px 7px; font-size: 11.5px;" onclick="ui.openPartyModal('${party.id}')" title="تعديل بيانات الطرف">✏️</button>
                            <button class="btn btn-outline btn-sm" style="padding: 4px 7px; font-size: 11.5px; color: var(--danger); border-color: #fca5a5;" onclick="ui.deleteParty('${party.id}')" title="حذف">🗑️</button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    copyDebtReminderMessage(partyId) {
        const stmt = storage.getPartyStatement(partyId);
        if (!stmt) return;
        const settings = storage.getSettings();
        const p = stmt.party;
        const balStr = engine.formatMoney(stmt.closingBalance);
        const secStr = settings.showSecondaryCurrency ? ` (المعادل: ${engine.formatSecondaryMoney(stmt.closingBalance)})` : '';
        const msg = `تحية طيبة من (${settings.companyName})\nالسيد / السادة: ${p.name} المحترمين،\nنود تذكيركم بأن الرصيد المستحق في ذمتكم حتى تاريخ اليوم هو: ${balStr}${secStr}.\nشاكرين حسن تعاونكم معنا.`;

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(msg).then(() => {
                this.showToast(`📲 تم نسخ رسالة المطالبة المالية للعميل (${p.name}) بنجاح! يمكنك لصقها في واتساب أو الرسائل.`, 'success');
            }).catch(() => {
                prompt('انسخ نص المطالبة المالية التالي:', msg);
            });
        } else {
            prompt('انسخ نص المطالبة المالية التالي:', msg);
        }
    }

    openPartyModal(partyId = null, defaultType = 'CUSTOMER') {
        if (partyId === 'CUSTOMER' || partyId === 'SUPPLIER') {
            defaultType = partyId;
            partyId = null;
        }
        this.editingPartyId = partyId;
        const titleEl = document.getElementById('party-modal-title');
        const nameEl = document.getElementById('party-form-name');
        const phoneEl = document.getElementById('party-form-phone');
        const openEl = document.getElementById('party-form-opening');
        const addrEl = document.getElementById('party-form-address');
        const notesEl = document.getElementById('party-form-notes');
        const radios = document.querySelectorAll('input[name="party-form-type"]');

        if (partyId) {
            const p = storage.getPartyById(partyId);
            if (!p) return;
            if (titleEl) titleEl.textContent = `✏️ تعديل بيانات: ${p.name}`;
            radios.forEach(r => { r.checked = (r.value === p.type); });
            if (nameEl) nameEl.value = p.name || '';
            if (phoneEl) phoneEl.value = p.phone || '';
            if (openEl) openEl.value = String(p.openingBalance || 0);
            if (addrEl) addrEl.value = p.address || '';
            if (notesEl) notesEl.value = p.notes || '';
        } else {
            if (titleEl) titleEl.textContent = defaultType === 'SUPPLIER' ? '🏢 إضافة مورد جديد' : '👤 إضافة عميل جديد';
            radios.forEach(r => { r.checked = (r.value === defaultType); });
            if (nameEl) nameEl.value = '';
            if (phoneEl) phoneEl.value = '';
            if (openEl) openEl.value = '0';
            if (addrEl) addrEl.value = '';
            if (notesEl) notesEl.value = '';
        }

        this.openModal('party-modal');
    }

    savePartyFromForm() {
        try {
            const type = document.querySelector('input[name="party-form-type"]:checked')?.value || 'CUSTOMER';
            const name = document.getElementById('party-form-name')?.value.trim() || '';
            const phone = document.getElementById('party-form-phone')?.value.trim() || '';
            const openingBalance = parseFloat(document.getElementById('party-form-opening')?.value) || 0;
            const address = document.getElementById('party-form-address')?.value.trim() || '';
            const notes = document.getElementById('party-form-notes')?.value.trim() || '';

            if (this.editingPartyId) {
                storage.updateParty(this.editingPartyId, { type, name, phone, openingBalance, address, notes });
                this.showToast('تم تحديث بيانات الطرف بنجاح', 'success');
            } else {
                storage.addParty({ type, name, phone, openingBalance, address, notes });
                this.showToast('تمت إضافة السجل بنجاح', 'success');
            }

            this.editingPartyId = null;
            this.closeModal();
            this.renderCurrentTab();
        } catch (err) {
            this.showToast(err.message, 'error');
        }
    }

    deleteParty(partyId) {
        if (!confirm('هل أنت متأكد من حذف هذا العميل/المورد من السجل؟')) return;
        try {
            storage.deleteParty(partyId);
            this.showToast('تم حذف السجل بنجاح', 'info');
            this.renderCurrentTab();
        } catch (err) {
            this.showToast(err.message, 'error');
        }
    }

    viewPartyStatement(partyId) {
        const stmt = storage.getPartyStatement(partyId);
        if (!stmt) {
            this.showToast('تعذر العثور على بيانات الطرف', 'error');
            return;
        }

        const settings = storage.getSettings();
        const p = stmt.party;
        const isSupplier = p.type === 'SUPPLIER';
        const titleEl = document.getElementById('party-statement-title');
        if (titleEl) titleEl.textContent = `📑 كشف حساب ${isSupplier ? 'مورد' : 'عميل'}: ${p.name}`;

        const quickActionsEl = document.getElementById('party-statement-quick-actions');
        if (quickActionsEl) {
            const safePartyNameJs = JSON.stringify(p.name || '').replace(/"/g, '&quot;');
            const defaultPayAmt = stmt.closingBalance > 0.009 ? Number(stmt.closingBalance.toFixed(2)) : "''";
            quickActionsEl.innerHTML = `
                <button type="button" class="btn btn-outline btn-sm" style="color: #059669; border-color: #86efac; font-weight: 700;" onclick="ui.closeModal(); ui.openVoucherFormModal('${isSupplier ? 'PAYMENT' : 'RECEIPT'}', ${safePartyNameJs}, ${defaultPayAmt})">
                    💳 ${isSupplier ? 'تسجيل سند صرف الآن' : 'تسجيل سند قبض الآن'}
                </button>
                ${stmt.closingBalance > 0.009 ? `<button type="button" class="btn btn-outline btn-sm" onclick="ui.copyDebtReminderMessage('${p.id}')">📲 نسخ مطالبة</button>` : ''}
            `;
        }

        const content = document.getElementById('party-statement-content');
        if (!content) return;

        content.innerHTML = `
            <div class="voucher-paper">
                <div class="voucher-header">
                    <h2>${this.escapeHtml(settings.companyName)}</h2>
                    <div class="sub-title">كشف حساب تفصيلي (${isSupplier ? 'مورد' : 'عميل'}): <strong>${this.escapeHtml(p.name)}</strong></div>
                    <div style="font-size: 12.5px; color: var(--text-muted); margin-top: 4px;">
                        ${p.phone ? `📞 ${this.escapeHtml(p.phone)} • ` : ''}${p.address ? `📍 ${this.escapeHtml(p.address)} • ` : ''}تاريخ الكشف: ${new Date().toISOString().split('T')[0]}
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin-bottom: 18px; background: #f8fafc; padding: 14px; border-radius: 8px; border: 1px solid var(--border-color);">
                    <div><span style="font-size: 12px; color: var(--text-muted); display: block;">الرصيد الافتتاحي</span><strong>${engine.formatMoney(stmt.openingBalance)}</strong></div>
                    <div><span style="font-size: 12px; color: var(--text-muted); display: block;">إجمالي الفواتير</span><strong style="color: var(--primary);">${engine.formatMoney(stmt.totalInvoiced)}</strong></div>
                    <div><span style="font-size: 12px; color: var(--text-muted); display: block;">إجمالي المرتجعات</span><strong style="color: #b45309;">${engine.formatMoney(stmt.totalReturned)}</strong></div>
                    <div><span style="font-size: 12px; color: var(--text-muted); display: block;">إجمالي المسدد / المحصل</span><strong style="color: var(--success);">${engine.formatMoney(stmt.totalPaid)}</strong></div>
                    <div><span style="font-size: 12px; color: var(--text-muted); display: block;">الرصيد المتبقي الحالي</span><strong style="font-size: 16px; color: ${stmt.closingBalance > 0 ? 'var(--danger)' : 'var(--success)'};">${engine.formatMoney(stmt.closingBalance)}</strong></div>
                </div>

                <table class="acc-table">
                    <thead>
                        <tr>
                            <th>التاريخ</th>
                            <th>رقم المستند</th>
                            <th>البيان والتفاصيل</th>
                            <th class="num">زيادة المديونية (+)</th>
                            <th class="num">تخفيض / سداد (-)</th>
                            <th class="num">الرصيد التراكمي</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr style="background: #f8fafc;">
                            <td>-</td>
                            <td>OPEN</td>
                            <td><strong>الرصيد الافتتاحي السابق</strong></td>
                            <td class="num">${stmt.openingBalance > 0 ? engine.formatMoney(stmt.openingBalance) : '-'}</td>
                            <td class="num">-</td>
                            <td class="num"><strong>${engine.formatMoney(stmt.openingBalance)}</strong></td>
                        </tr>
                        ${stmt.rows.length === 0 ? `
                            <tr><td colspan="6" style="text-align: center; padding: 24px; color: var(--text-muted);">لا توجد حركات مسجلة لهذا الحساب بعد.</td></tr>
                        ` : stmt.rows.map(r => `
                            <tr>
                                <td>${this.escapeHtml(r.date)}</td>
                                <td style="font-family: monospace; font-weight: 700;">${this.escapeHtml(r.docId)}</td>
                                <td>${this.escapeHtml(r.description)}</td>
                                <td class="num" style="color: var(--danger);">${r.increase > 0 ? engine.formatMoney(r.increase) : '-'}</td>
                                <td class="num" style="color: var(--success);">${r.decrease > 0 ? engine.formatMoney(r.decrease) : '-'}</td>
                                <td class="num"><strong>${engine.formatMoney(r.runningBalance)}</strong></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;

        this.openModal('party-statement-modal');
    }

    // ==================== 17. تصدير الجداول إلى Excel (CSV UTF-8 BOM) ====================
    exportTableToExcel(tableSelector, filenamePrefix = 'تقرير') {
        const table = document.querySelector(tableSelector);
        if (!table) {
            this.showToast('لا يوجد جدول بيانات لتصديره حالياً', 'warning');
            return;
        }

        const rows = Array.from(table.querySelectorAll('tr'));
        if (rows.length === 0) {
            this.showToast('الجدول فارغ لا يحتوي على بيانات', 'warning');
            return;
        }

        const headerCells = Array.from(rows[0].querySelectorAll('th, td'));
        const excludedIndices = new Set();
        headerCells.forEach((hc, idx) => {
            const hTxt = (hc.textContent || '').trim();
            if (hTxt === 'إجراءات' || hTxt === 'إجراءات سريعة') {
                excludedIndices.add(idx);
            }
        });

        const csvLines = rows.map(row => {
            const cells = Array.from(row.querySelectorAll('th, td'));
            const filteredCells = cells.filter((c, idx) => !excludedIndices.has(idx));
            return filteredCells.map(cell => {
                const inp = cell.querySelector('input, select, textarea');
                let text = '';
                if (inp && inp.type !== 'checkbox' && inp.type !== 'radio') {
                    text = String(inp.value || '').trim();
                } else {
                    text = (cell.innerText || cell.textContent || '').replace(/\r?\n|\r/g, ' — ').replace(/\s+/g, ' ').trim();
                }
                text = text.replace(/"/g, '""');
                return `"${text}"`;
            }).join(',');
        }).filter(line => line.length > 0);

        const bom = '\uFEFF';
        const csvContent = bom + csvLines.join('\r\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const dateStr = new Date().toISOString().split('T')[0];
        link.href = url;
        link.download = `${filenamePrefix}_${dateStr}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        this.showToast(`📊 تم تصدير الملف (${filenamePrefix}_${dateStr}.csv) جاهز للفتح في برنامج Excel!`, 'success');
    }

    // ==================== 18. شاشة نقطة البيع السريعة (POS الكاشير) ====================
    renderPOS() {
        this.populatePartiesDatalist();
        if (!this.posCart) this.posCart = [];

        const whSelect = document.getElementById('pos-warehouse');
        if (whSelect) {
            const currentWh = whSelect.value;
            const warehouses = storage.getWarehouses();
            whSelect.innerHTML = warehouses.map(w => `<option value="${w.id}" ${w.isDefault ? 'selected' : ''}>${this.escapeHtml(w.name)}</option>`).join('');
            if (currentWh && warehouses.some(w => w.id === currentWh)) {
                whSelect.value = currentWh;
            }
        }

        const catFilter = document.getElementById('pos-category-filter');
        if (catFilter) {
            const products = storage.getProducts();
            const cats = Array.from(new Set(products.map(p => p.category).filter(Boolean)));
            const currentCat = catFilter.value || 'all';
            catFilter.innerHTML = `<option value="all">جميع التصنيفات</option>` + cats.map(c => `<option value="${this.escapeHtml(c)}">${this.escapeHtml(c)}</option>`).join('');
            catFilter.value = cats.includes(currentCat) ? currentCat : 'all';
        }

        this.renderPOSProducts();
        this.renderPOSCart();
    }

    renderPOSProducts() {
        const grid = document.getElementById('pos-products-grid');
        if (!grid) return;

        const products = storage.getProducts();
        const whId = document.getElementById('pos-warehouse')?.value || 'WH-01';
        const query = document.getElementById('pos-barcode-input')?.value.trim().toLowerCase() || '';
        const cat = document.getElementById('pos-category-filter')?.value || 'all';

        const filtered = products.filter(p => {
            const matchCat = cat === 'all' || p.category === cat;
            const matchQuery = !query ||
                (p.name && p.name.toLowerCase().includes(query)) ||
                (p.sku && p.sku.toLowerCase().includes(query)) ||
                (p.barcode && p.barcode.toLowerCase().includes(query));
            return matchCat && matchQuery;
        });

        if (filtered.length === 0) {
            grid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 40px 20px; color: var(--text-muted);">
                    <div style="font-size: 38px; margin-bottom: 8px;">🏷️</div>
                    <div>لا توجد أصناف مطابقة. يمكنك إضافة أصناف جديدة من شاشة المنتجات.</div>
                </div>
            `;
            return;
        }

        const posTier = document.getElementById('pos-price-tier')?.value || 'RETAIL';
        grid.innerHTML = filtered.map(p => {
            const stock = inventory.getProductStock(p.id, whId);
            const hasStock = stock > 0;
            const activePrice = (posTier === 'WHOLESALE' && p.wholesalePrice !== undefined && p.wholesalePrice !== null)
                ? (parseFloat(p.wholesalePrice) || 0)
                : (parseFloat(p.sellingPrice) || 0);
            return `
                <div onclick="ui.addToPOSCart('${p.id}')" style="cursor: pointer; background: #fff; border: 1.5px solid ${hasStock ? '#e2e8f0' : '#fecaca'}; border-radius: 12px; padding: 12px; transition: all 0.15s ease; display: flex; flex-direction: column; justify-content: space-between; box-shadow: 0 2px 5px rgba(15,23,42,0.04);">
                    <div>
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                            <span style="font-family: monospace; font-size: 11px; color: var(--text-muted); background: #f1f5f9; padding: 2px 6px; border-radius: 4px;">${this.escapeHtml(p.sku)}</span>
                            <span class="badge ${hasStock ? 'badge-success' : 'badge-danger'}" style="font-size: 10.5px;">${stock} ${this.escapeHtml(p.unit || '')}</span>
                        </div>
                        <div style="font-weight: 800; font-size: 13.5px; color: var(--text-primary); margin-bottom: 8px; line-height: 1.35;">${this.escapeHtml(p.name)}</div>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px dashed #e2e8f0; padding-top: 8px;">
                        <strong class="num" style="color: ${posTier === 'WHOLESALE' ? '#1d4ed8' : 'var(--primary)'}; font-size: 14.5px;">${engine.formatMoney(activePrice)}</strong>
                        <span style="font-size: 11px; font-weight: 700; color: ${posTier === 'WHOLESALE' ? '#1d4ed8' : '#059669'};">${posTier === 'WHOLESALE' ? '📦 جملة' : '➕'}</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    onPOSPriceTierChange(tier) {
        if (this.posCart && this.posCart.length > 0) {
            this.posCart.forEach(item => {
                const prod = storage.getProductById(item.productId);
                if (prod) {
                    item.unitPrice = (tier === 'WHOLESALE' && prod.wholesalePrice !== undefined && prod.wholesalePrice !== null)
                        ? (parseFloat(prod.wholesalePrice) || 0)
                        : (parseFloat(prod.sellingPrice) || 0);
                }
            });
            this.renderPOSCart();
        }
        this.renderPOSProducts();
        this.showToast(tier === 'WHOLESALE' ? '📦 تم التبديل إلى تسعير الجملة في الكاشير وتحديث السلة' : '🛍️ تم التبديل إلى تسعير المفرد (قطاعي) في الكاشير', 'info');
    }

    onPOSBarcodeKeydown(e) {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        const input = document.getElementById('pos-barcode-input');
        const val = input ? input.value.trim().toLowerCase() : '';
        if (!val) return;

        const products = storage.getProducts();
        const exact = products.find(p =>
            (p.barcode && p.barcode.toLowerCase() === val) ||
            (p.sku && p.sku.toLowerCase() === val)
        ) || products.find(p => p.name && p.name.toLowerCase().includes(val));

        if (exact) {
            this.addToPOSCart(exact.id);
            if (input) input.value = '';
            this.renderPOSProducts();
        } else {
            this.showToast('لم يتم العثور على صنف بهذا الباركود أو الكود', 'warning');
        }
    }

    addToPOSCart(productId) {
        if (!this.posCart) this.posCart = [];
        const prod = storage.getProductById(productId);
        if (!prod) return;

        const whId = document.getElementById('pos-warehouse')?.value || 'WH-01';
        const avail = inventory.getProductStock(productId, whId);
        const existing = this.posCart.find(item => item.productId === productId);
        const nextQty = existing ? existing.quantity + 1 : 1;

        if (avail < nextQty) {
            this.showToast(`الكمية المتوفرة من (${prod.name}) في هذا المستودع هي ${avail} فقط!`, 'warning');
            return;
        }

        if (existing) {
            existing.quantity = nextQty;
        } else {
            const posTier = document.getElementById('pos-price-tier')?.value || 'RETAIL';
            const activePrice = (posTier === 'WHOLESALE' && prod.wholesalePrice !== undefined && prod.wholesalePrice !== null)
                ? (parseFloat(prod.wholesalePrice) || 0)
                : (parseFloat(prod.sellingPrice) || 0);
            this.posCart.push({
                productId: prod.id,
                name: prod.name,
                unitPrice: activePrice,
                quantity: 1
            });
        }
        this.renderPOSCart();
    }

    updatePOSCartQty(index, delta) {
        if (!this.posCart || !this.posCart[index]) return;
        const item = this.posCart[index];
        const newQty = (parseFloat(item.quantity) || 0) + delta;
        if (newQty <= 0) {
            this.posCart.splice(index, 1);
            this.renderPOSCart();
            return;
        }
        const whId = document.getElementById('pos-warehouse')?.value || 'WH-01';
        const avail = inventory.getProductStock(item.productId, whId);
        if (newQty > avail) {
            this.showToast(`الرصيد المتاح بالمستودع (${avail}) فقط`, 'warning');
            return;
        }
        item.quantity = newQty;
        this.renderPOSCart();
    }

    removeFromPOSCart(index) {
        if (!this.posCart) return;
        this.posCart.splice(index, 1);
        this.renderPOSCart();
    }

    clearPOSCart() {
        this.posCart = [];
        const discEl = document.getElementById('pos-discount');
        if (discEl) discEl.value = '0';
        const paidEl = document.getElementById('pos-paid-amount');
        if (paidEl) paidEl.value = '';
        this.renderPOSCart();
    }

    renderPOSCart() {
        const tbody = document.getElementById('pos-cart-tbody');
        if (!tbody) return;
        const cart = this.posCart || [];

        if (cart.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 28px; color: var(--text-muted);">السلة فارغة — اضغط على أي صنف لإضافته</td></tr>`;
            this.updatePOSTotals();
            return;
        }

        tbody.innerHTML = cart.map((item, idx) => {
            const lineTotal = (parseFloat(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0);
            return `
                <tr>
                    <td><strong>${this.escapeHtml(item.name)}</strong></td>
                    <td style="text-align: center; white-space: nowrap;">
                        <button type="button" class="btn btn-outline btn-sm" style="padding: 2px 7px;" onclick="ui.updatePOSCartQty(${idx}, -1)">-</button>
                        <strong style="margin: 0 6px;">${item.quantity}</strong>
                        <button type="button" class="btn btn-outline btn-sm" style="padding: 2px 7px;" onclick="ui.updatePOSCartQty(${idx}, 1)">+</button>
                    </td>
                    <td class="num">${engine.formatMoney(item.unitPrice)}</td>
                    <td class="num"><strong>${engine.formatMoney(lineTotal)}</strong></td>
                    <td><button type="button" class="btn btn-outline btn-sm" style="color: var(--danger); padding: 2px 6px;" onclick="ui.removeFromPOSCart(${idx})">✕</button></td>
                </tr>
            `;
        }).join('');

        this.updatePOSTotals();
    }

    updatePOSTotals() {
        const cart = this.posCart || [];
        const subtotal = cart.reduce((s, i) => s + ((parseFloat(i.quantity) || 0) * (parseFloat(i.unitPrice) || 0)), 0);
        const discount = Math.min(parseFloat(document.getElementById('pos-discount')?.value) || 0, subtotal);
        const grand = Math.max(subtotal - discount, 0);
        const payMethod = document.getElementById('pos-pay-method')?.value || 'CASH';
        const paidInputEl = document.getElementById('pos-paid-amount');
        if (paidInputEl) {
            paidInputEl.placeholder = payMethod === 'CREDIT' ? '0.00 (أو دفعة مقدمة)' : 'تلقائي بالكامل';
        }
        const paidRaw = paidInputEl?.value;
        const hasExplicitPaid = paidRaw !== undefined && paidRaw !== null && String(paidRaw).trim() !== '';
        const paid = hasExplicitPaid
            ? Math.max(0, parseFloat(paidRaw) || 0)
            : (payMethod === 'CREDIT' ? 0 : grand);

        const change = paid > grand ? (paid - grand) : 0;
        const remaining = Math.max(0, grand - Math.min(paid, grand));

        const setTxt = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
        };

        setTxt('pos-subtotal', engine.formatMoney(subtotal));
        setTxt('pos-grand-total', engine.formatMoney(grand));
        const settings = storage.getSettings();
        setTxt('pos-grand-secondary', settings.showSecondaryCurrency ? `≈ ${engine.formatSecondaryMoney(grand)}` : '');

        const box = document.getElementById('pos-change-box');
        const lbl = document.getElementById('pos-change-label');
        const amtEl = document.getElementById('pos-change-amount');

        if (remaining > 0) {
            if (box) { box.style.background = '#fffbeb'; box.style.borderColor = '#fde68a'; }
            if (lbl) { lbl.style.color = '#92400e'; lbl.textContent = 'المتبقي الآجل:'; }
            if (amtEl) { amtEl.style.color = '#b45309'; amtEl.textContent = engine.formatMoney(remaining); }
        } else {
            if (box) { box.style.background = '#ecfdf5'; box.style.borderColor = '#a7f3d0'; }
            if (lbl) { lbl.style.color = '#065f46'; lbl.textContent = 'الباقي للعميل:'; }
            if (amtEl) { amtEl.style.color = '#047857'; amtEl.textContent = engine.formatMoney(change); }
        }
    }

    checkoutPOS(printReceipt = false) {
        if (!this.posCart || this.posCart.length === 0) {
            this.showToast('السلة فارغة! أضف صنفاً واحداً على الأقل لإتمام البيع.', 'warning');
            return;
        }

        try {
            const warehouseId = document.getElementById('pos-warehouse')?.value || 'WH-01';
            const partyName = document.getElementById('pos-party')?.value.trim() || 'عميل نقدي';
            const paymentMethod = document.getElementById('pos-pay-method')?.value || 'CASH';
            const discount = parseFloat(document.getElementById('pos-discount')?.value) || 0;
            const paidRaw = document.getElementById('pos-paid-amount')?.value;
            const date = new Date().toISOString().split('T')[0];

            const result = inventory.executeInvoice({
                type: 'SALES',
                partyName,
                paymentMethod,
                warehouseId,
                date,
                items: this.posCart.map(c => ({
                    productId: c.productId,
                    quantity: c.quantity,
                    unitPrice: c.unitPrice
                })),
                discount,
                taxRate: 0,
                paidAmount: paidRaw,
                notes: 'مبيعات نقطة البيع السريعة (POS)'
            });

            this.clearPOSCart();
            this.renderPOSProducts();
            this.showToast(`✅ تم إتمام البيع وإصدار الفاتورة (${result.invoice.id}) بنجاح!`, 'success');

            if (printReceipt) {
                const content = document.getElementById('voucher-modal-content');
                if (content) {
                    content.innerHTML = this.buildInvoiceHTML(result.invoice, { template: 'thermal' });
                    this.openModal('voucher-modal');
                    setTimeout(() => window.print(), 250);
                }
            }
        } catch (err) {
            this.showToast(err.message, 'error');
        }
    }

    // ==================== 19. قسم عروض الأسعار (Quotations) ====================
    renderQuotations() {
        const list = storage.getQuotations();
        const searchVal = document.getElementById('quotation-search')?.value.trim().toLowerCase() || '';
        const statusVal = document.getElementById('quotation-status-filter')?.value || 'all';

        const totalVal = list.reduce((s, q) => s + (parseFloat(q.totalAmount) || 0), 0);
        const pendingCount = list.filter(q => q.status !== 'CONVERTED').length;
        const convertedCount = list.filter(q => q.status === 'CONVERTED').length;

        const setTxt = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
        };

        setTxt('qt-kpi-total', engine.formatMoney(totalVal));
        setTxt('qt-kpi-count', `${list.length} عرض سعر`);
        setTxt('qt-kpi-pending', `${pendingCount} عرض`);
        setTxt('qt-kpi-converted', `${convertedCount} فاتورة`);

        const filtered = list.filter(q => {
            const matchStatus = statusVal === 'all' || q.status === statusVal;
            const matchQuery = !searchVal ||
                (q.id && q.id.toLowerCase().includes(searchVal)) ||
                (q.partyName && q.partyName.toLowerCase().includes(searchVal));
            return matchStatus && matchQuery;
        });

        const tbody = document.getElementById('quotations-tbody');
        if (!tbody) return;

        if (filtered.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; padding: 36px; color: var(--text-muted);">
                        لا توجد عروض أسعار مسجلة بعد. اضغط على "إصدار عرض سعر جديد" للبدء.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = filtered.map(q => {
            const isConverted = q.status === 'CONVERTED';
            return `
                <tr>
                    <td><strong style="font-family: monospace; color: var(--primary);">${this.escapeHtml(q.id)}</strong></td>
                    <td>${this.escapeHtml(q.date)}</td>
                    <td>${this.escapeHtml(q.validUntil || '-')}</td>
                    <td><strong>${this.escapeHtml(q.partyName)}</strong></td>
                    <td><span class="badge badge-info">${q.items ? q.items.length : 0} أصناف</span></td>
                    <td class="num"><strong style="color: var(--primary);">${engine.formatMoney(q.totalAmount)}</strong></td>
                    <td>
                        ${isConverted
                            ? `<span class="badge badge-success">✅ حُوّل (${this.escapeHtml(q.convertedInvoiceId || '')})</span>`
                            : `<span class="badge badge-warning">⏳ قيد الانتظار</span>`}
                    </td>
                    <td style="text-align: left; white-space: nowrap;">
                        <button class="btn btn-primary btn-sm" onclick="ui.viewQuotationVoucher('${q.id}')" title="طباعة ومعاينة عرض السعر">🖨️ طباعة</button>
                        ${!isConverted ? `<button class="btn btn-outline btn-sm" style="color: #059669; border-color: #a7f3d0;" onclick="ui.convertQuotationToInvoice('${q.id}')" title="تحويل عرض السعر إلى فاتورة مبيعات بضغطة واحدة">🔄 تحويل لفاتورة</button>` : ''}
                        <button class="btn btn-outline btn-sm" style="color: var(--danger); border-color: #fca5a5;" onclick="ui.deleteQuotation('${q.id}')" title="حذف">🗑️</button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    openQuotationModal() {
        const products = storage.getProducts();
        if (products.length === 0) {
            this.showToast('يرجى إضافة منتج واحد على الأقل في "دليل المنتجات" قبل إصدار عرض سعر!', 'warning');
            this.switchTab('products');
            this.openProductModal();
            return;
        }

        this.populatePartiesDatalist();

        const whSelect = document.getElementById('qt-form-wh');
        if (whSelect) {
            whSelect.innerHTML = storage.getWarehouses().map(w => `<option value="${w.id}" ${w.isDefault ? 'selected' : ''}>${this.escapeHtml(w.name)}</option>`).join('');
        }

        const today = new Date();
        const validDate = new Date(today.getTime() + 15 * 86400000);
        const dateEl = document.getElementById('qt-form-date');
        if (dateEl) dateEl.value = today.toISOString().split('T')[0];
        const validEl = document.getElementById('qt-form-valid');
        if (validEl) validEl.value = validDate.toISOString().split('T')[0];

        const partyEl = document.getElementById('qt-form-party');
        if (partyEl) partyEl.value = '';
        const notesEl = document.getElementById('qt-form-notes');
        if (notesEl) notesEl.value = 'العرض ساري لمدة 15 يوماً من تاريخ الإصدار.';
        const discEl = document.getElementById('qt-form-discount');
        if (discEl) discEl.value = '0';
        const taxEl = document.getElementById('qt-form-tax-rate');
        if (taxEl) taxEl.value = '0';

        this.quotationLines = [
            { productId: products[0].id, quantity: 1, unitPrice: products[0].sellingPrice || 0 }
        ];

        this.renderQuotationLinesTable();
        this.openModal('quotation-modal');
    }

    renderQuotationLinesTable() {
        const tbody = document.getElementById('quotation-lines-tbody');
        if (!tbody) return;
        const products = storage.getProducts();

        tbody.innerHTML = (this.quotationLines || []).map((line, idx) => {
            const rowTotal = (parseFloat(line.quantity) || 0) * (parseFloat(line.unitPrice) || 0);
            return `
                <tr>
                    <td>
                        <select class="select-control" style="width: 100%;" onchange="ui.onQuotationProductChange(${idx}, this.value)" required>
                            ${products.map(p => `<option value="${p.id}" ${p.id === line.productId ? 'selected' : ''}>${this.escapeHtml(p.sku)} - ${this.escapeHtml(p.name)}</option>`).join('')}
                        </select>
                    </td>
                    <td>
                        <input type="number" step="0.01" min="0.01" class="input-control num" style="width: 100%;" value="${line.quantity}" oninput="ui.onQuotationLineChange(${idx}, 'quantity', this.value)" required>
                    </td>
                    <td>
                        <input type="number" step="0.01" min="0" class="input-control num" style="width: 100%;" value="${line.unitPrice}" oninput="ui.onQuotationLineChange(${idx}, 'unitPrice', this.value)" required>
                    </td>
                    <td class="num"><strong id="qt-line-total-${idx}">${engine.formatMoney(rowTotal)}</strong></td>
                    <td style="text-align: center;">
                        <button type="button" class="btn btn-outline btn-sm" style="color: var(--danger); padding: 4px 8px;" onclick="ui.removeQuotationLine(${idx})" ${this.quotationLines.length <= 1 ? 'disabled' : ''}>✕</button>
                    </td>
                </tr>
            `;
        }).join('');

        this.calculateQuotationTotals();
    }

    addQuotationLine() {
        const products = storage.getProducts();
        if (products.length === 0) return;
        this.quotationLines.push({
            productId: products[0].id,
            quantity: 1,
            unitPrice: products[0].sellingPrice || 0
        });
        this.renderQuotationLinesTable();
    }

    removeQuotationLine(idx) {
        if (!this.quotationLines || this.quotationLines.length <= 1) return;
        this.quotationLines.splice(idx, 1);
        this.renderQuotationLinesTable();
    }

    onQuotationProductChange(idx, productId) {
        const prod = storage.getProductById(productId);
        if (this.quotationLines && this.quotationLines[idx]) {
            this.quotationLines[idx].productId = productId;
            if (prod) this.quotationLines[idx].unitPrice = prod.sellingPrice || 0;
        }
        this.renderQuotationLinesTable();
    }

    onQuotationLineChange(idx, field, value) {
        if (!this.quotationLines || !this.quotationLines[idx]) return;
        this.quotationLines[idx][field] = parseFloat(value) || 0;
        const rowTotal = (parseFloat(this.quotationLines[idx].quantity) || 0) * (parseFloat(this.quotationLines[idx].unitPrice) || 0);
        const el = document.getElementById(`qt-line-total-${idx}`);
        if (el) el.textContent = engine.formatMoney(rowTotal);
        this.calculateQuotationTotals();
    }

    calculateQuotationTotals() {
        const subtotal = (this.quotationLines || []).reduce((s, l) => s + ((parseFloat(l.quantity) || 0) * (parseFloat(l.unitPrice) || 0)), 0);
        const disc = Math.min(parseFloat(document.getElementById('qt-form-discount')?.value) || 0, subtotal);
        const afterDisc = Math.max(subtotal - disc, 0);
        const taxRate = parseFloat(document.getElementById('qt-form-tax-rate')?.value) || 0;
        const grand = afterDisc + (afterDisc * taxRate) / 100;

        const setTxt = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
        };
        setTxt('qt-sum-subtotal', engine.formatMoney(subtotal));
        setTxt('qt-sum-grand', engine.formatMoney(grand));
    }

    saveQuotationFromForm() {
        try {
            const partyName = document.getElementById('qt-form-party')?.value.trim() || 'عميل محتمل';
            const warehouseId = document.getElementById('qt-form-wh')?.value || 'WH-01';
            const date = document.getElementById('qt-form-date')?.value;
            const validUntil = document.getElementById('qt-form-valid')?.value || '';
            const discount = parseFloat(document.getElementById('qt-form-discount')?.value) || 0;
            const taxRate = parseFloat(document.getElementById('qt-form-tax-rate')?.value) || 0;
            const notes = document.getElementById('qt-form-notes')?.value.trim() || '';

            const qt = storage.addQuotation({
                partyName,
                warehouseId,
                date,
                validUntil,
                items: this.quotationLines,
                discount,
                taxRate,
                notes
            });

            this.closeModal();
            this.showToast(`تم إصدار عرض السعر رقم (${qt.id}) بنجاح!`, 'success');
            this.renderCurrentTab();
        } catch (err) {
            this.showToast(err.message, 'error');
        }
    }

    viewQuotationVoucher(qtId) {
        const qt = storage.getQuotationById(qtId);
        if (!qt) return;
        const fakeInv = {
            ...qt,
            type: 'SALES',
            paymentMethod: 'CASH',
            journalEntryId: 'عرض سعر (غير مرحّل)'
        };
        const html = this.buildInvoiceHTML(fakeInv, { template: 'a4', isQuotation: true });

        const content = document.getElementById('voucher-modal-content');
        if (content) {
            content.innerHTML = html;
            this.openModal('voucher-modal');
        }
    }

    convertQuotationToInvoice(qtId) {
        const qt = storage.getQuotationById(qtId);
        if (!qt) return;
        if (!confirm(`هل تريد تحويل عرض السعر (${qt.id}) الخاص بالعميل (${qt.partyName}) إلى فاتورة مبيعات فعلية؟`)) return;

        try {
            const result = inventory.executeInvoice({
                type: 'SALES',
                partyName: qt.partyName,
                paymentMethod: 'CASH',
                warehouseId: qt.warehouseId || 'WH-01',
                date: new Date().toISOString().split('T')[0],
                items: qt.items,
                discount: qt.discount || 0,
                taxRate: qt.taxRate || 0,
                notes: `محوّلة من عرض السعر رقم ${qt.id} — ${qt.notes || ''}`
            });

            storage.updateQuotation(qt.id, {
                status: 'CONVERTED',
                convertedInvoiceId: result.invoice.id
            });

            this.showToast(`🎉 تم تحويل عرض السعر (${qt.id}) إلى فاتورة مبيعات رقم (${result.invoice.id}) بنجاح!`, 'success');
            this.renderCurrentTab();
        } catch (err) {
            this.showToast(err.message, 'error');
        }
    }

    deleteQuotation(qtId) {
        if (!confirm(`هل أنت متأكد من حذف عرض السعر رقم (${qtId})؟`)) return;
        storage.deleteQuotation(qtId);
        this.showToast('تم حذف عرض السعر بنجاح', 'info');
        this.renderCurrentTab();
    }

    // ==================== 20. تقرير تحليل أرباح الأصناف والعملاء (Profitability Report) ====================
    renderProfitabilitySubReport(container) {
        const rep = inventory.getProfitabilityReport();
        const settings = storage.getSettings();

        container.innerHTML = `
            <div class="voucher-paper">
                <div class="voucher-header">
                    <h2>${this.escapeHtml(settings.companyName)}</h2>
                    <div class="sub-title">💎 تقرير تحليل أرباح الأصناف والعملاء وهوامش الربح الفعلية</div>
                </div>

                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 14px; margin-bottom: 22px; background: #f8fafc; padding: 16px; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
                    <div>
                        <span style="font-size: 12px; color: var(--text-muted); display: block;">صافي إيرادات المبيعات:</span>
                        <strong style="font-size: 17px; color: var(--primary);">${engine.formatMoney(rep.summary.totalRevenue)}</strong>
                    </div>
                    <div>
                        <span style="font-size: 12px; color: var(--text-muted); display: block;">تكلفة البضاعة المباعة (COGS):</span>
                        <strong style="font-size: 17px; color: var(--danger);">${engine.formatMoney(rep.summary.totalCost)}</strong>
                    </div>
                    <div>
                        <span style="font-size: 12px; color: var(--text-muted); display: block;">صافي الربح التجاري المحقق:</span>
                        <strong style="font-size: 18px; color: var(--success);">${engine.formatMoney(rep.summary.totalProfit)}</strong>
                    </div>
                    <div>
                        <span style="font-size: 12px; color: var(--text-muted); display: block;">نسبة هامش الربح العام:</span>
                        <strong style="font-size: 18px; color: #047857;">${rep.summary.overallMarginPct.toFixed(1)}%</strong>
                    </div>
                </div>

                <h4 style="margin-bottom: 10px; color: var(--text-primary);">📦 أولاً: تحليل الربحية حسب الصنف / المنتج</h4>
                <div class="table-responsive" style="margin-bottom: 24px;">
                    <table class="acc-table">
                        <thead>
                            <tr>
                                <th>كود SKU</th>
                                <th>اسم المنتج / الصنف</th>
                                <th class="num">صافي الكمية المباعة</th>
                                <th class="num">صافي المبيعات</th>
                                <th class="num">إجمالي التكلفة</th>
                                <th class="num">صافي الربح</th>
                                <th class="num">هامش الربح %</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rep.productRows.length === 0 ? `
                                <tr><td colspan="7" style="text-align: center; padding: 24px; color: var(--text-muted);">لا توجد مبيعات مسجلة بعد لاحتساب الأرباح.</td></tr>
                            ` : rep.productRows.map(r => `
                                <tr>
                                    <td style="font-family: monospace;">${this.escapeHtml(r.product.sku)}</td>
                                    <td><strong>${this.escapeHtml(r.product.name)}</strong></td>
                                    <td class="num"><strong>${r.netQty} ${this.escapeHtml(r.product.unit || '')}</strong></td>
                                    <td class="num">${engine.formatMoney(r.revenue)}</td>
                                    <td class="num">${engine.formatMoney(r.cost)}</td>
                                    <td class="num"><strong style="color: ${r.profit >= 0 ? 'var(--success)' : 'var(--danger)'};">${engine.formatMoney(r.profit)}</strong></td>
                                    <td class="num"><span class="badge ${r.marginPct >= 15 ? 'badge-success' : 'badge-warning'}">${r.marginPct.toFixed(1)}%</span></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>

                <h4 style="margin-bottom: 10px; color: var(--text-primary);">👥 ثانياً: أكثر العملاء تحقيقاً للإيرادات والأرباح</h4>
                <div class="table-responsive">
                    <table class="acc-table">
                        <thead>
                            <tr>
                                <th>اسم العميل</th>
                                <th class="num">عدد الفواتير</th>
                                <th class="num">صافي المشتريات منا</th>
                                <th class="num">تكلفة البضاعة</th>
                                <th class="num">صافي الربح من العميل</th>
                                <th class="num">هامش الربح %</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rep.customerRows.length === 0 ? `
                                <tr><td colspan="6" style="text-align: center; padding: 20px; color: var(--text-muted);">لا توجد بيانات عملاء بعد.</td></tr>
                            ` : rep.customerRows.map(c => `
                                <tr>
                                    <td><strong>${this.escapeHtml(c.partyName)}</strong></td>
                                    <td class="num">${c.invoicesCount}</td>
                                    <td class="num">${engine.formatMoney(c.revenue)}</td>
                                    <td class="num">${engine.formatMoney(c.cost)}</td>
                                    <td class="num"><strong style="color: var(--success);">${engine.formatMoney(c.profit)}</strong></td>
                                    <td class="num">${c.marginPct.toFixed(1)}%</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    // ==================== 21. طباعة ملصقات وستيكرات الباركود (Barcode Labels) ====================
    openBarcodeModal(productId = null) {
        const products = storage.getProducts();
        if (products.length === 0) {
            this.showToast('يرجى إضافة منتج واحد على الأقل أولاً لطباعة ملصقات الباركود!', 'warning');
            return;
        }

        const select = document.getElementById('barcode-prod-select');
        if (select) {
            select.innerHTML = products.map(p =>
                `<option value="${p.id}" ${p.id === productId ? 'selected' : ''}>${this.escapeHtml(p.sku)} — ${this.escapeHtml(p.name)}</option>`
            ).join('');
            if (productId) select.value = productId;
        }

        this.renderBarcodePreview();
        this.openModal('barcode-modal');
    }

    generateBarcodeSVG(codeText) {
        const clean = String(codeText || 'PRD101').trim();
        // توليد نمط خطوط باركود حتمي وعالي الدقة يعمل 100% أوفلاين
        const bars = [2, 1, 1, 2, 1, 1]; // Start guard
        for (let i = 0; i < clean.length; i++) {
            const c = clean.charCodeAt(i);
            bars.push(((c >> 0) & 1) + 1);
            bars.push(((c >> 1) & 1) + 1);
            bars.push(((c >> 2) & 1) + 2);
            bars.push(((c >> 3) & 1) + 1);
            bars.push(((c >> 4) & 1) + 1);
            bars.push(((c >> 5) & 1) + 2);
        }
        bars.push(2, 1, 1, 2, 1, 2); // Stop guard

        const totalUnits = bars.reduce((s, w) => s + w, 0);
        const svgWidth = 200;
        const svgHeight = 46;
        const unitW = svgWidth / totalUnits;

        let x = 0;
        let rects = '';
        for (let i = 0; i < bars.length; i++) {
            const w = bars[i] * unitW;
            if (i % 2 === 0) {
                rects += `<rect x="${x.toFixed(2)}" y="0" width="${w.toFixed(2)}" height="${svgHeight}" fill="#0f172a"/>`;
            }
            x += w;
        }

        return `<svg viewBox="0 0 ${svgWidth} ${svgHeight}" width="100%" height="44" xmlns="http://www.w3.org/2000/svg" style="display:block; margin: 4px auto;">${rects}</svg>`;
    }

    renderBarcodePreview() {
        const preview = document.getElementById('barcode-preview-area');
        if (!preview) return;

        const prodId = document.getElementById('barcode-prod-select')?.value;
        const copies = parseInt(document.getElementById('barcode-copies')?.value) || 12;
        const showCompany = document.getElementById('barcode-show-company') ? document.getElementById('barcode-show-company').checked : true;
        const showPrice = document.getElementById('barcode-show-price') ? document.getElementById('barcode-show-price').checked : true;

        const prod = storage.getProductById(prodId) || storage.getProducts()[0];
        if (!prod) return;

        const settings = storage.getSettings();
        const codeStr = prod.barcode || prod.sku || prod.id;
        const svg = this.generateBarcodeSVG(codeStr);

        const singleSticker = `
            <div style="border: 1.5px dashed #94a3b8; border-radius: 8px; padding: 10px 8px; text-align: center; background: #fff; page-break-inside: avoid;">
                ${showCompany ? `<div style="font-size: 10.5px; font-weight: 800; color: #475569; margin-bottom: 2px;">${this.escapeHtml(settings.companyName)}</div>` : ''}
                <div style="font-size: 12.5px; font-weight: 900; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${this.escapeHtml(prod.name)}</div>
                ${svg}
                <div style="font-family: monospace; font-size: 11.5px; font-weight: 800; letter-spacing: 1.5px; color: #1e293b;">${this.escapeHtml(codeStr)}</div>
                ${showPrice ? `<div style="margin-top: 4px; font-size: 13px; font-weight: 900; color: #1e3a8a; background: #eff6ff; display: inline-block; padding: 1px 10px; border-radius: 99px;">السعر: ${engine.formatMoney(prod.sellingPrice || 0)}</div>` : ''}
            </div>
        `;

        preview.innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(185px, 1fr)); gap: 12px;">
                ${Array.from({ length: copies }).map(() => singleSticker).join('')}
            </div>
        `;
    }

    // ==================== 22. قسم المصروفات التشغيلية اليومية السريعة (Quick Expenses) ====================
    renderExpenses() {
        const list = storage.getExpenses();
        const searchVal = document.getElementById('expense-search')?.value.trim().toLowerCase() || '';
        const catFilter = document.getElementById('expense-cat-filter');
        const selectedCat = catFilter ? catFilter.value : 'all';

        if (catFilter && catFilter.children.length <= 1) {
            catFilter.innerHTML = `<option value="all">جميع بنود المصروفات</option>` +
                EXPENSE_CATEGORIES.map(c => `<option value="${c.id}">${this.escapeHtml(c.name)}</option>`).join('');
            catFilter.value = selectedCat;
        }

        const todayStr = new Date().toISOString().split('T')[0];
        const currentMonthPrefix = todayStr.slice(0, 7);

        let totalAll = 0;
        let totalMonth = 0;
        let totalToday = 0;
        const byCat = {};

        list.forEach(ex => {
            const amt = parseFloat(ex.amount) || 0;
            totalAll += amt;
            if (ex.date === todayStr) totalToday += amt;
            if (ex.date && ex.date.startsWith(currentMonthPrefix)) totalMonth += amt;
            const cName = ex.categoryName || 'أخرى';
            byCat[cName] = (byCat[cName] || 0) + amt;
        });

        let topCatName = '-';
        let topCatVal = 0;
        Object.entries(byCat).forEach(([k, v]) => {
            if (v > topCatVal) {
                topCatVal = v;
                topCatName = `${k} (${engine.formatMoney(v)})`;
            }
        });

        const setTxt = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
        };

        setTxt('exp-kpi-total', engine.formatMoney(totalAll));
        setTxt('exp-kpi-count', `${list.length} عملية صرف`);
        setTxt('exp-kpi-month', engine.formatMoney(totalMonth));
        setTxt('exp-kpi-today', `اليوم: ${engine.formatMoney(totalToday)}`);
        setTxt('exp-kpi-top-cat', topCatName);

        const filtered = list.filter(ex => {
            const matchCat = selectedCat === 'all' || ex.categoryId === selectedCat;
            const matchQuery = !searchVal ||
                (ex.id && ex.id.toLowerCase().includes(searchVal)) ||
                (ex.description && ex.description.toLowerCase().includes(searchVal)) ||
                (ex.beneficiary && ex.beneficiary.toLowerCase().includes(searchVal)) ||
                (ex.categoryName && ex.categoryName.toLowerCase().includes(searchVal));
            return matchCat && matchQuery;
        });

        const tbody = document.getElementById('expenses-tbody');
        if (!tbody) return;

        if (filtered.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; padding: 36px; color: var(--text-muted);">
                        لا توجد مصروفات تشغيلية مسجلة بعد. اضغط على "تسجيل مصروف يومي جديد" لإضافة إيجار أو كهرباء أو رواتب أو مصاريف يومية.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = filtered.map(ex => {
            const isBank = ex.paymentMethod === 'BANK';
            return `
                <tr>
                    <td><strong style="font-family: monospace; color: var(--primary);">${this.escapeHtml(ex.id)}</strong></td>
                    <td>${this.escapeHtml(ex.date)}</td>
                    <td><span class="badge badge-warning">${this.escapeHtml(ex.categoryName)}</span></td>
                    <td><strong>${this.escapeHtml(ex.beneficiary || '-')}</strong></td>
                    <td>${this.escapeHtml(ex.description)}</td>
                    <td>
                        <span class="badge ${isBank ? 'badge-info' : 'badge-success'}">
                            ${isBank ? '🏦 بنكي (1102)' : '💵 نقداً (1101)'}
                        </span>
                    </td>
                    <td class="num"><strong style="color: var(--danger);">${engine.formatMoney(ex.amount)}</strong></td>
                    <td style="text-align: left; white-space: nowrap;">
                        ${ex.journalEntryId ? `<button class="btn btn-outline btn-sm" onclick="ui.viewEntryVoucher('${ex.journalEntryId}')" title="عرض وسند القيد المحاسبي">📝 القيد</button>` : ''}
                        <button class="btn btn-outline btn-sm" style="color: var(--danger); border-color: #fca5a5;" onclick="ui.deleteExpense('${ex.id}')" title="حذف المصروف">🗑️</button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    openExpenseModal() {
        const catSelect = document.getElementById('exp-form-cat');
        if (catSelect) {
            catSelect.innerHTML = EXPENSE_CATEGORIES.map(c =>
                `<option value="${c.id}">${this.escapeHtml(c.name)} (حساب ${c.accountCode})</option>`
            ).join('');
        }
        const dateEl = document.getElementById('exp-form-date');
        if (dateEl) dateEl.value = new Date().toISOString().split('T')[0];
        const amtEl = document.getElementById('exp-form-amount');
        if (amtEl) amtEl.value = '';
        const benEl = document.getElementById('exp-form-beneficiary');
        if (benEl) benEl.value = '';
        const descEl = document.getElementById('exp-form-desc');
        if (descEl) descEl.value = '';

        this.openModal('expense-modal');
    }

    saveExpenseFromForm() {
        try {
            const categoryId = document.getElementById('exp-form-cat')?.value || 'OTHER';
            const date = document.getElementById('exp-form-date')?.value;
            const amount = parseFloat(document.getElementById('exp-form-amount')?.value) || 0;
            const paymentMethod = document.getElementById('exp-form-method')?.value || 'CASH';
            const beneficiary = document.getElementById('exp-form-beneficiary')?.value.trim() || '';
            const description = document.getElementById('exp-form-desc')?.value.trim() || '';

            const exp = storage.addExpense({
                categoryId,
                date,
                amount,
                paymentMethod,
                beneficiary,
                description
            });

            this.closeModal();
            this.showToast(`✅ تم تسجيل المصروف (${exp.id}) وتوليد القيد المحاسبي بنجاح!`, 'success');
            this.renderCurrentTab();
        } catch (err) {
            this.showToast(err.message, 'error');
        }
    }

    deleteExpense(id) {
        if (!confirm(`هل أنت متأكد من حذف المصروف رقم (${id})؟ سيتم إلغاء القيد المحاسبي المرتبط به.`)) return;
        try {
            storage.deleteExpense(id);
            this.showToast('تم حذف المصروف وإلغاء قيده المحاسبي بنجاح', 'info');
            this.renderCurrentTab();
        } catch (err) {
            this.showToast(err.message, 'error');
        }
    }

    // ==================== 23. حركة الخزينة والصندوق اليومي وتقفيل الوردية (Cash Drawer) ====================
    renderCashDrawer() {
        const dateInput = document.getElementById('cash-drawer-date');
        if (dateInput && !dateInput.value) {
            dateInput.value = new Date().toISOString().split('T')[0];
        }
        const selectedDate = dateInput ? dateInput.value : new Date().toISOString().split('T')[0];
        const rep = storage.getDailyCashDrawerReport(selectedDate);

        const setTxt = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
        };

        setTxt('cd-kpi-opening', engine.formatMoney(rep.cashOpening));
        setTxt('cd-kpi-in', engine.formatMoney(rep.cashInToday));
        setTxt('cd-kpi-out', engine.formatMoney(rep.cashOutToday));
        setTxt('cd-kpi-closing', engine.formatMoney(rep.cashClosing));
        setTxt('cd-kpi-bank', `رصيد البنك الحالي: ${engine.formatMoney(rep.bankClosing)}`);

        const tbody = document.getElementById('cash-drawer-tbody');
        if (!tbody) return;

        if (rep.movements.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 36px; color: var(--text-muted);">
                        لا توجد حركات نقدية أو بنكية مسجلة في تاريخ (${selectedDate}).
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = rep.movements.map(m => `
            <tr>
                <td><strong style="font-family: monospace; color: var(--primary);">${this.escapeHtml(m.entryId)}</strong></td>
                <td>${this.escapeHtml(m.time)}</td>
                <td>
                    <span class="badge ${m.accountCode === '1101' ? 'badge-success' : 'badge-info'}">
                        ${m.accountCode === '1101' ? '💵 الصندوق النقدي' : '🏦 الحساب البنكي'}
                    </span>
                </td>
                <td style="font-family: monospace;">${this.escapeHtml(m.reference)}</td>
                <td><strong>${this.escapeHtml(m.description)}</strong></td>
                <td class="num" style="color: var(--success); font-weight: 800;">${m.cashIn > 0 ? `+ ${engine.formatMoney(m.cashIn)}` : '-'}</td>
                <td class="num" style="color: var(--danger); font-weight: 800;">${m.cashOut > 0 ? `- ${engine.formatMoney(m.cashOut)}` : '-'}</td>
            </tr>
        `).join('');
    }

    // ==================== 24. سجل الرقابة والتدقيق الأمني (Audit Log) ====================
    renderAuditLog() {
        const logs = storage.getAuditLogs();
        const searchVal = document.getElementById('audit-search')?.value.trim().toLowerCase() || '';
        const typeVal = document.getElementById('audit-type-filter')?.value || 'all';

        const filtered = logs.filter(l => {
            const matchType = typeVal === 'all' || l.actionType === typeVal;
            const matchQuery = !searchVal ||
                (l.module && l.module.toLowerCase().includes(searchVal)) ||
                (l.reference && l.reference.toLowerCase().includes(searchVal)) ||
                (l.description && l.description.toLowerCase().includes(searchVal));
            return matchType && matchQuery;
        });

        const tbody = document.getElementById('audit-log-tbody');
        if (!tbody) return;

        if (filtered.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; padding: 36px; color: var(--text-muted);">
                        لا توجد سجلات رقابية مطابقة حالياً. يتم تسجيل أي عملية إضافة أو تعديل أو حذف تلقائياً هنا.
                    </td>
                </tr>
            `;
            return;
        }

        const badges = {
            CREATE: { text: '🟢 إضافة / إصدار', cls: 'badge-success' },
            UPDATE: { text: '🟡 تعديل بيانات', cls: 'badge-warning' },
            DELETE: { text: '🔴 حذف مستند', cls: 'badge-danger' },
            SECURITY: { text: '🔒 أمان وحماية', cls: 'badge-info' }
        };

        tbody.innerHTML = filtered.map(l => {
            const b = badges[l.actionType] || { text: l.actionType, cls: 'badge-info' };
            const dt = l.timestamp ? new Date(l.timestamp).toLocaleString('ar-EG') : '-';
            return `
                <tr>
                    <td style="font-size: 12px; color: var(--text-secondary);">${this.escapeHtml(dt)}</td>
                    <td><span class="badge ${b.cls}">${b.text}</span></td>
                    <td><strong>${this.escapeHtml(l.module)}</strong></td>
                    <td style="font-family: monospace; color: var(--primary); font-weight: 700;">${this.escapeHtml(l.reference)}</td>
                    <td>${this.escapeHtml(l.description)}</td>
                </tr>
            `;
        }).join('');
    }

    // ==================== 25. شاشة الجرد الفعلي السريع للمخزون (Smart Stocktaking Sheet) ====================
    renderStocktaking(forceReloadWarehouse = false) {
        const whSelect = document.getElementById('st-warehouse-select');
        const dateInput = document.getElementById('st-date-input');
        const catSelect = document.getElementById('st-category-filter');

        const warehouses = storage.getWarehouses();
        if (whSelect) {
            const currentWh = whSelect.value;
            whSelect.innerHTML = warehouses.map(w => `<option value="${w.id}">${this.escapeHtml(w.name)}</option>`).join('');
            if (currentWh && warehouses.some(w => w.id === currentWh)) {
                whSelect.value = currentWh;
            } else if (warehouses.length > 0) {
                whSelect.value = warehouses[0].id;
            }
        }

        if (dateInput && !dateInput.value) {
            dateInput.value = new Date().toISOString().split('T')[0];
        }

        const products = storage.getProducts();
        if (catSelect) {
            const currentCat = catSelect.value || 'all';
            const categories = [...new Set(products.map(p => (p.category || '').trim()).filter(Boolean))];
            catSelect.innerHTML = `<option value="all">جميع التصنيفات (${products.length})</option>` +
                categories.map(c => `<option value="${this.escapeHtml(c)}">${this.escapeHtml(c)}</option>`).join('');
            if (categories.includes(currentCat) || currentCat === 'all') {
                catSelect.value = currentCat;
            }
        }

        const selectedWhId = whSelect ? whSelect.value : (warehouses[0]?.id || 'WH-01');

        if (!this.stocktakingDraft || this.stocktakingDraftWarehouseId !== selectedWhId || forceReloadWarehouse) {
            this.stocktakingDraftWarehouseId = selectedWhId;
            this.stocktakingDraft = {};
            this.stocktakingNotes = {};
            products.forEach(p => {
                const bookQty = inventory.getProductStock(p.id, selectedWhId);
                this.stocktakingDraft[p.id] = bookQty;
                this.stocktakingNotes[p.id] = '';
            });
        } else {
            // Ensure any newly added products exist in the draft
            products.forEach(p => {
                if (this.stocktakingDraft[p.id] === undefined) {
                    const bookQty = inventory.getProductStock(p.id, selectedWhId);
                    this.stocktakingDraft[p.id] = bookQty;
                    this.stocktakingNotes[p.id] = '';
                }
            });
        }

        this.renderStocktakingTable();
        this.renderStocktakingHistory();
    }

    renderStocktakingTable() {
        const whSelect = document.getElementById('st-warehouse-select');
        const selectedWhId = whSelect ? whSelect.value : (this.stocktakingDraftWarehouseId || 'WH-01');
        const catVal = document.getElementById('st-category-filter')?.value || 'all';
        const diffVal = document.getElementById('st-diff-filter')?.value || 'all';
        const searchVal = document.getElementById('st-search-input')?.value.trim().toLowerCase() || '';

        const products = storage.getProducts();
        const tbody = document.getElementById('stocktaking-tbody');
        if (!tbody) return;

        this.updateStocktakingSummaryKPIs();

        const filtered = products.filter(p => {
            const matchCat = catVal === 'all' || (p.category || '') === catVal;
            const pCode = p.sku || p.code || p.id || '';
            const matchQuery = !searchVal ||
                (p.name && p.name.toLowerCase().includes(searchVal)) ||
                (pCode && pCode.toLowerCase().includes(searchVal)) ||
                (p.barcode && p.barcode.toLowerCase().includes(searchVal));

            const bookQty = inventory.getProductStock(p.id, selectedWhId);
            const actualQty = this.stocktakingDraft && this.stocktakingDraft[p.id] !== undefined
                ? (parseFloat(this.stocktakingDraft[p.id]) || 0)
                : bookQty;
            const diffQty = Number((actualQty - bookQty).toFixed(4));

            let matchDiff = true;
            if (diffVal === 'DIFF_ONLY') matchDiff = Math.abs(diffQty) > 0.0001;
            else if (diffVal === 'SURPLUS') matchDiff = diffQty > 0.0001;
            else if (diffVal === 'SHORTAGE') matchDiff = diffQty < -0.0001;
            else if (diffVal === 'MATCHED') matchDiff = Math.abs(diffQty) <= 0.0001;

            return matchCat && matchQuery && matchDiff;
        });

        if (filtered.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; padding: 32px; color: var(--text-muted);">
                        لا توجد أصناف تطابق عوامل التصفية المحددة في ورقة الجرد.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = filtered.map(p => {
            const pCode = p.sku || p.code || p.id || '';
            const bookQty = inventory.getProductStock(p.id, selectedWhId);
            const actualQty = this.stocktakingDraft && this.stocktakingDraft[p.id] !== undefined
                ? (parseFloat(this.stocktakingDraft[p.id]) || 0)
                : bookQty;
            const diffQty = Number((actualQty - bookQty).toFixed(4));
            const costPrice = parseFloat(p.purchasePrice ?? p.costPrice) || 0;
            const diffValMoney = Number((diffQty * costPrice).toFixed(2));
            const noteVal = (this.stocktakingNotes && this.stocktakingNotes[p.id]) || '';

            let rowBg = '';
            let diffBadge = '<span class="badge badge-success">✅ مطابق</span>';
            let diffColor = 'var(--text-muted)';

            if (diffQty > 0.0001) {
                rowBg = 'background: #f0fdf4;';
                diffBadge = `<span class="badge badge-success">📈 فائض (+${diffQty})</span>`;
                diffColor = '#059669';
            } else if (diffQty < -0.0001) {
                rowBg = 'background: #fef2f2;';
                diffBadge = `<span class="badge badge-danger">📉 عجز (${diffQty})</span>`;
                diffColor = '#dc2626';
            }

            return `
                <tr id="st-row-${p.id}" style="${rowBg}">
                    <td>
                        <strong style="font-family: monospace; color: var(--primary);">${this.escapeHtml(pCode)}</strong>
                        ${p.barcode ? `<span style="display: block; font-size: 10.5px; font-family: monospace; color: var(--text-muted);">🏷️ ${this.escapeHtml(p.barcode)}</span>` : ''}
                    </td>
                    <td>
                        <strong>${this.escapeHtml(p.name)}</strong>
                        <span style="display: block; font-size: 11px; color: var(--text-muted);">${this.escapeHtml(p.category || 'عام')} • الوحدة: ${this.escapeHtml(p.unit || 'قطعة')}</span>
                    </td>
                    <td class="num">${engine.formatMoney(costPrice)}</td>
                    <td class="num">
                        <strong style="font-size: 13.5px;">${bookQty}</strong>
                        <span style="font-size: 11px; color: var(--text-muted);">${this.escapeHtml(p.unit || '')}</span>
                    </td>
                    <td style="text-align: center;">
                        <div style="display: inline-flex; align-items: center; gap: 4px;">
                            <button type="button" class="btn btn-outline btn-sm" style="padding: 2px 8px; font-weight: 900;" onclick="ui.stepStocktakingActual('${p.id}', -1)">-</button>
                            <input type="number" step="any" min="0" id="st-actual-${p.id}" class="input-control num" style="width: 86px; text-align: center; font-weight: 800; height: 32px;" value="${actualQty}" oninput="ui.onStocktakingActualChange('${p.id}', this.value)">
                            <button type="button" class="btn btn-outline btn-sm" style="padding: 2px 8px; font-weight: 900;" onclick="ui.stepStocktakingActual('${p.id}', 1)">+</button>
                        </div>
                    </td>
                    <td class="num" id="st-diff-qty-${p.id}" style="font-weight: 800; color: ${diffColor};">
                        ${diffQty > 0 ? `+${diffQty}` : diffQty}
                    </td>
                    <td class="num" id="st-diff-val-${p.id}" style="font-weight: 800; color: ${diffColor};">
                        ${diffValMoney > 0 ? `+${engine.formatMoney(diffValMoney)}` : engine.formatMoney(diffValMoney)}
                    </td>
                    <td id="st-status-${p.id}">
                        <div style="margin-bottom: 4px;">${diffBadge}</div>
                        <input type="text" class="input-control" style="font-size: 11px; height: 26px; padding: 2px 6px;" placeholder="سبب الفرق..." value="${this.escapeHtml(noteVal)}" oninput="ui.onStocktakingNoteChange('${p.id}', this.value)">
                    </td>
                </tr>
            `;
        }).join('');
    }

    onStocktakingActualChange(productId, rawValue) {
        if (!this.stocktakingDraft) this.stocktakingDraft = {};
        const val = parseFloat(rawValue);
        const actualQty = isNaN(val) || val < 0 ? 0 : val;
        this.stocktakingDraft[productId] = actualQty;

        const p = storage.getProductById(productId);
        if (p) {
            const selectedWhId = this.stocktakingDraftWarehouseId || document.getElementById('st-warehouse-select')?.value || 'WH-01';
            const bookQty = inventory.getProductStock(p.id, selectedWhId);
            const diffQty = Number((actualQty - bookQty).toFixed(4));
            const costPrice = parseFloat(p.purchasePrice ?? p.costPrice) || 0;
            const diffValMoney = Number((diffQty * costPrice).toFixed(2));

            const rowEl = document.getElementById(`st-row-${productId}`);
            const diffQtyEl = document.getElementById(`st-diff-qty-${productId}`);
            const diffValEl = document.getElementById(`st-diff-val-${productId}`);
            const statusEl = document.getElementById(`st-status-${productId}`);

            let diffColor = 'var(--text-muted)';
            let diffBadge = '<span class="badge badge-success">✅ مطابق</span>';
            if (diffQty > 0.0001) {
                diffColor = '#059669';
                diffBadge = `<span class="badge badge-success">📈 فائض (+${diffQty})</span>`;
                if (rowEl) rowEl.style.background = '#f0fdf4';
            } else if (diffQty < -0.0001) {
                diffColor = '#dc2626';
                diffBadge = `<span class="badge badge-danger">📉 عجز (${diffQty})</span>`;
                if (rowEl) rowEl.style.background = '#fef2f2';
            } else {
                if (rowEl) rowEl.style.background = '';
            }

            if (diffQtyEl) {
                diffQtyEl.style.color = diffColor;
                diffQtyEl.textContent = diffQty > 0 ? `+${diffQty}` : String(diffQty);
            }
            if (diffValEl) {
                diffValEl.style.color = diffColor;
                diffValEl.textContent = diffValMoney > 0 ? `+${engine.formatMoney(diffValMoney)}` : engine.formatMoney(diffValMoney);
            }
            if (statusEl) {
                const badgeDiv = statusEl.querySelector('div');
                if (badgeDiv) badgeDiv.innerHTML = diffBadge;
            }
        }

        this.updateStocktakingSummaryKPIs();
    }

    stepStocktakingActual(productId, delta) {
        if (!this.stocktakingDraft) this.stocktakingDraft = {};
        const current = parseFloat(this.stocktakingDraft[productId]) || 0;
        const nextVal = Math.max(0, Number((current + delta).toFixed(4)));
        this.stocktakingDraft[productId] = nextVal;
        const inp = document.getElementById(`st-actual-${productId}`);
        if (inp) inp.value = String(nextVal);
        this.onStocktakingActualChange(productId, nextVal);
    }

    onStocktakingNoteChange(productId, note) {
        if (!this.stocktakingNotes) this.stocktakingNotes = {};
        this.stocktakingNotes[productId] = note;
    }

    onStocktakingBarcodeScan(event) {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        const inp = event.target;
        const code = (inp?.value || '').trim().toLowerCase();
        if (!code) return;

        const products = storage.getProducts();
        const p = products.find(prod =>
            (prod.barcode && prod.barcode.toLowerCase() === code) ||
            (prod.sku && prod.sku.toLowerCase() === code) ||
            (prod.id && prod.id.toLowerCase() === code)
        );
        if (!p) {
            this.showToast(`لم يتم العثور على صنف بالباركود أو الكود: ${inp.value}`, 'error');
            return;
        }

        this.stepStocktakingActual(p.id, 1);
        inp.value = '';
        this.showToast(`✅ تم عد (+1) للصنف: ${p.name} (الإجمالي المعدود: ${this.stocktakingDraft[p.id]})`, 'success');
    }

    resetStocktakingToBook() {
        const whSelect = document.getElementById('st-warehouse-select');
        const selectedWhId = whSelect ? whSelect.value : 'WH-01';
        const products = storage.getProducts();
        this.stocktakingDraft = {};
        this.stocktakingNotes = {};
        products.forEach(p => {
            const bookQty = inventory.getProductStock(p.id, selectedWhId);
            this.stocktakingDraft[p.id] = bookQty;
            this.stocktakingNotes[p.id] = '';
        });
        this.renderStocktakingTable();
        this.showToast('تمت مساواة جميع الكميات الفعلية بالرصيد الدفتري الحالي', 'info');
    }

    updateStocktakingSummaryKPIs() {
        const selectedWhId = this.stocktakingDraftWarehouseId || document.getElementById('st-warehouse-select')?.value || 'WH-01';
        const products = storage.getProducts();

        let matchedCount = 0;
        let surplusCount = 0;
        let shortageCount = 0;
        let surplusVal = 0;
        let shortageVal = 0;

        products.forEach(p => {
            const bookQty = inventory.getProductStock(p.id, selectedWhId);
            const actualQty = this.stocktakingDraft && this.stocktakingDraft[p.id] !== undefined
                ? (parseFloat(this.stocktakingDraft[p.id]) || 0)
                : bookQty;
            const diffQty = Number((actualQty - bookQty).toFixed(4));
            const costPrice = parseFloat(p.purchasePrice ?? p.costPrice) || 0;

            if (diffQty > 0.0001) {
                surplusCount++;
                surplusVal += diffQty * costPrice;
            } else if (diffQty < -0.0001) {
                shortageCount++;
                shortageVal += Math.abs(diffQty) * costPrice;
            } else {
                matchedCount++;
            }
        });

        const netVal = surplusVal - shortageVal;
        const setTxt = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
        };

        setTxt('st-kpi-total-items', `${products.length} صنف`);
        setTxt('st-kpi-matched-items', `${matchedCount} صنف مطابق للدفتري`);
        setTxt('st-kpi-surplus-val', `+${engine.formatMoney(surplusVal)}`);
        setTxt('st-kpi-surplus-count', `${surplusCount} صنف فائض`);
        setTxt('st-kpi-shortage-val', `-${engine.formatMoney(shortageVal)}`);
        setTxt('st-kpi-shortage-count', `${shortageCount} صنف عجز`);
        setTxt('st-kpi-net-val', netVal >= 0 ? `+${engine.formatMoney(netVal)}` : `-${engine.formatMoney(Math.abs(netVal))}`);
        setTxt('st-kpi-net-sub', (surplusCount === 0 && shortageCount === 0)
            ? 'جميع الأصناف مطابقة للرصيد الدفتري'
            : `سيتم تعديل (${surplusCount + shortageCount}) صنف وتوليد قيد التسوية`);
    }

    saveStocktakingSheet() {
        try {
            const warehouseId = document.getElementById('st-warehouse-select')?.value || 'WH-01';
            const date = document.getElementById('st-date-input')?.value || new Date().toISOString().split('T')[0];
            const notes = document.getElementById('st-sheet-notes')?.value.trim() || '';
            const products = storage.getProducts();

            const items = products.map(p => {
                const bookQty = inventory.getProductStock(p.id, warehouseId);
                const actualQty = this.stocktakingDraft && this.stocktakingDraft[p.id] !== undefined
                    ? (parseFloat(this.stocktakingDraft[p.id]) || 0)
                    : bookQty;
                return {
                    productId: p.id,
                    actualQty,
                    note: (this.stocktakingNotes && this.stocktakingNotes[p.id]) || ''
                };
            });

            const sheet = inventory.executeBatchStocktaking({
                warehouseId,
                date,
                notes,
                items
            });

            const notesEl = document.getElementById('st-sheet-notes');
            if (notesEl) notesEl.value = '';

            this.renderStocktaking(true);
            this.renderProducts();
            this.renderWarehouses();
            this.renderDashboard();
            this.showToast(`⚖️ تم اعتماد محضر الجرد رقم (${sheet.id}) وتحديث أرصدة المستودع والقيود المحاسبية بنجاح!`, 'success');
        } catch (err) {
            this.showToast(err.message, 'error');
        }
    }

    renderStocktakingHistory() {
        const tbody = document.getElementById('stocktaking-history-tbody');
        if (!tbody) return;

        const sheets = storage.getStocktakingSheets();
        if (sheets.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; padding: 28px; color: var(--text-muted);">
                        لا توجد محاضر جرد معتمدة سابقة. عند اعتماد أي جرد من الجدول أعلاه سيظهر هنا مع إمكانية طباعته.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = sheets.map(s => {
            const netVal = (parseFloat(s.totalSurplusValue) || 0) - (parseFloat(s.totalShortageValue) || 0);
            const netColor = netVal > 0.009 ? '#059669' : (netVal < -0.009 ? '#dc2626' : 'var(--text-secondary)');
            const changedCount = s.changedItemsCount !== undefined ? s.changedItemsCount : ((s.surplusItemsCount || 0) + (s.shortageItemsCount || 0));
            return `
                <tr>
                    <td><strong style="font-family: monospace; color: var(--primary);">${this.escapeHtml(s.id)}</strong></td>
                    <td>${this.escapeHtml(s.date)}</td>
                    <td>
                        <strong>${this.escapeHtml(s.warehouseName || s.warehouseId)}</strong>
                        ${s.notes ? `<span style="display: block; font-size: 11px; color: var(--text-muted);">${this.escapeHtml(s.notes)}</span>` : ''}
                    </td>
                    <td>
                        <span class="badge ${changedCount > 0 ? 'badge-warning' : 'badge-success'}">
                            ${changedCount > 0 ? `⚖️ ${changedCount} صنف معدل` : '✅ مطابق بالكامل'}
                        </span>
                    </td>
                    <td class="num" style="color: #059669; font-weight: 700;">+${engine.formatMoney(s.totalSurplusValue || 0)}</td>
                    <td class="num" style="color: #dc2626; font-weight: 700;">-${engine.formatMoney(s.totalShortageValue || 0)}</td>
                    <td class="num"><strong style="color: ${netColor};">${netVal >= 0 ? `+${engine.formatMoney(netVal)}` : `-${engine.formatMoney(Math.abs(netVal))}`}</strong></td>
                    <td style="text-align: left; white-space: nowrap;">
                        <button class="btn btn-primary btn-sm" onclick="ui.viewStocktakingVoucher('${s.id}')" title="معاينة وطباعة محضر الجرد">🖨️ محضر الجرد</button>
                        <button class="btn btn-outline btn-sm" style="color: var(--danger); border-color: #fca5a5;" onclick="ui.deleteStocktakingSheet('${s.id}')" title="حذف السجل">🗑️</button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    viewStocktakingVoucher(sheetId) {
        const s = storage.getStocktakingSheetById(sheetId);
        if (!s) {
            this.showToast('محضر الجرد غير موجود', 'error');
            return;
        }

        const settings = storage.getSettings();
        const content = document.getElementById('voucher-modal-content');
        if (!content) return;

        const totalItemsCount = s.totalItems !== undefined ? s.totalItems : (s.totalItemsCount || (s.items ? s.items.length : 0));
        const changedCount = s.changedItemsCount !== undefined ? s.changedItemsCount : ((s.surplusItemsCount || 0) + (s.shortageItemsCount || 0));

        content.innerHTML = `
            <div class="voucher-paper">
                <div class="voucher-header">
                    <h2>${this.escapeHtml(settings.companyName)}</h2>
                    <div class="sub-title">📋 محضر جرد فعلي ومطابقة مخزنية رسمي</div>
                    <div style="font-size: 12.5px; color: var(--text-muted); margin-top: 4px;">
                        رقم المحضر: <strong>${this.escapeHtml(s.id)}</strong> • التاريخ: <strong>${this.escapeHtml(s.date)}</strong> • المستودع: <strong>${this.escapeHtml(s.warehouseName)}</strong>
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-bottom: 18px; background: #f8fafc; padding: 14px; border-radius: 8px; border: 1px solid var(--border-color);">
                    <div><span style="font-size: 12px; color: var(--text-muted); display: block;">إجمالي الأصناف المجرودة</span><strong>${totalItemsCount} صنف</strong></div>
                    <div><span style="font-size: 12px; color: var(--text-muted); display: block;">أصناف بها فروقات</span><strong>${changedCount} صنف</strong></div>
                    <div><span style="font-size: 12px; color: var(--text-muted); display: block;">إجمالي الفائض (+)</span><strong style="color: #059669;">+${engine.formatMoney(s.totalSurplusValue)}</strong></div>
                    <div><span style="font-size: 12px; color: var(--text-muted); display: block;">إجمالي العجز (-)</span><strong style="color: #dc2626;">-${engine.formatMoney(s.totalShortageValue)}</strong></div>
                    <div><span style="font-size: 12px; color: var(--text-muted); display: block;">رقم القيد المحاسبي</span><strong style="font-family: monospace;">${this.escapeHtml(s.journalEntryId || 'لا يوجد فرق مالي')}</strong></div>
                </div>

                ${s.notes ? `<div style="margin-bottom: 14px; font-size: 13px;"><strong>📝 ملاحظات اللجنة / البيان:</strong> ${this.escapeHtml(s.notes)}</div>` : ''}

                <table class="acc-table">
                    <thead>
                        <tr>
                            <th>الكود</th>
                            <th>اسم الصنف</th>
                            <th class="num">الرصيد الدفتري</th>
                            <th class="num">الرصيد الفعلي</th>
                            <th class="num">الفارق</th>
                            <th class="num">التكلفة</th>
                            <th class="num">قيمة الفارق</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${(s.items || []).map(it => {
                            const d = parseFloat(it.diffQty) || 0;
                            const col = d > 0 ? '#059669' : (d < 0 ? '#dc2626' : 'var(--text-secondary)');
                            const code = it.sku || it.productCode || it.productId || '';
                            const uCost = it.unitCost ?? it.costPrice ?? 0;
                            return `
                                <tr>
                                    <td style="font-family: monospace;">${this.escapeHtml(code)}</td>
                                    <td><strong>${this.escapeHtml(it.productName)}</strong> ${it.note ? `<span style="font-size:11px; color:var(--text-muted);">(${this.escapeHtml(it.note)})</span>` : ''}</td>
                                    <td class="num">${it.bookQty} ${this.escapeHtml(it.unit || '')}</td>
                                    <td class="num"><strong>${it.actualQty} ${this.escapeHtml(it.unit || '')}</strong></td>
                                    <td class="num" style="color: ${col}; font-weight: 800;">${d > 0 ? `+${d}` : d}</td>
                                    <td class="num">${engine.formatMoney(uCost)}</td>
                                    <td class="num" style="color: ${col}; font-weight: 800;">${it.diffValue > 0 ? `+${engine.formatMoney(it.diffValue)}` : engine.formatMoney(it.diffValue)}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>

                <div style="display: flex; justify-content: space-between; margin-top: 34px; padding-top: 16px; border-top: 1px dashed var(--border-color); font-size: 13px; color: var(--text-secondary);">
                    <div>توقيع أمين المستودع: ____________________</div>
                    <div>توقيع لجنة الجرد / المحاسب: ____________________</div>
                    <div>اعتماد الإدارة: ____________________</div>
                </div>
            </div>
        `;

        this.openModal('voucher-modal');
    }

    deleteStocktakingSheet(sheetId) {
        if (!confirm(`هل أنت متأكد من حذف محضر الجرد رقم (${sheetId}) من السجل؟ سيتم إلغاء التسويات والقيد المحاسبي المرتبط به.`)) return;
        try {
            storage.deleteStocktakingSheet(sheetId);
            this.showToast('تم حذف محضر الجرد وإلغاء التسويات المرتبطة به بنجاح', 'info');
            this.renderStocktaking(true);
            this.renderProducts();
            this.renderWarehouses();
            this.renderDashboard();
        } catch (err) {
            this.showToast(err.message, 'error');
        }
    }

    // ==================== 24. الحفظ التلقائي المستمر على القرص الصلب وقاعدة البيانات غير المحدودة ====================
    updateDiskAutoSaveIndicator() {
        const stats = storage.getStorageStats ? storage.getStorageStats() : { unlimitedDBActive: true, diskAutoSaveConnected: false };
        const statusEl = document.getElementById('autosave-disk-status');
        const btnTextEl = document.getElementById('disk-autosave-btn-text');
        const btnEl = document.getElementById('disk-autosave-btn');

        if (stats.diskAutoSaveConnected) {
            if (statusEl) statusEl.textContent = `💾 حفظ تلقائي نشط: ${stats.diskFileName}`;
            if (btnTextEl) btnTextEl.textContent = `متصل بالقرص (${stats.diskFileName})`;
            if (btnEl) {
                btnEl.style.background = '#059669';
                btnEl.style.color = '#ffffff';
                btnEl.style.borderColor = '#059669';
            }
        } else {
            if (statusEl) statusEl.textContent = '🛡️ قاعدة بيانات غير محدودة نشطة';
            if (btnTextEl) btnTextEl.textContent = 'الحفظ التلقائي للقرص';
        }
    }

    connectAutoSaveDiskFile() {
        if (typeof window.showSaveFilePicker === 'function') {
            window.showSaveFilePicker({
                suggestedName: `SmartAccounting_AutoSave_${new Date().toISOString().split('T')[0]}.json`,
                types: [{
                    description: 'ملف قاعدة بيانات المحاسب الذكي (JSON)',
                    accept: { 'application/json': ['.json'] }
                }]
            }).then((handle) => {
                storage.autoSaveFileHandle = handle;
                storage.autoSaveFileName = handle.name || 'database.json';
                return storage.writeToDiskFileNow();
            }).then((saved) => {
                this.updateDiskAutoSaveIndicator();
                if (saved) {
                    this.showToast('✅ تم ربط ملف الحفظ التلقائي على القرص الصلب بنجاح! سيتم حفظ كل حركة وعميل وفاتورة تلقائياً على القرص في نفس اللحظة.', 'success');
                }
            }).catch((err) => {
                if (err && err.name === 'AbortError') return;
                this.showToast('تعذر ربط الملف المباشر: ' + (err.message || ''), 'warning');
            });
        } else {
            // في حال كان المتصفح لا يدعم File System Access API نقوم بتحميل نسخة فورية مع تأكيد تفعيل IndexedDB غير المحدود
            const jsonStr = storage.exportBackupJSON();
            const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `SmartAccounting_Database_${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
            this.showToast('🛡️ قاعدة البيانات غير المحدودة (IndexedDB) نشطة تلقائياً وتم حفظ نسخة فورية على القرص الصلب!', 'success');
        }
    }

    // ==================== 25. استيراد الأصناف والعملاء دفعة واحدة من ملف Excel / CSV ====================
    _parseCSVText(text) {
        const clean = String(text || '').replace(/^\uFEFF/, '').trim();
        if (!clean) return [];
        const lines = clean.split(/\r?\n/).filter(l => l.trim().length > 0);
        if (lines.length === 0) return [];
        const sep = (lines[0].split(';').length > lines[0].split(',').length) ? ';' : ',';

        return lines.map(line => {
            const cells = [];
            let cur = '';
            let inQuotes = false;
            for (let i = 0; i < line.length; i++) {
                const ch = line[i];
                if (ch === '"') {
                    if (inQuotes && line[i + 1] === '"') {
                        cur += '"';
                        i++;
                    } else {
                        inQuotes = !inQuotes;
                    }
                } else if (ch === sep && !inQuotes) {
                    cells.push(cur.trim());
                    cur = '';
                } else {
                    cur += ch;
                }
            }
            cells.push(cur.trim());
            return cells;
        });
    }

    downloadProductsExcelTemplate() {
        const rows = [
            ['كود الصنف SKU', 'الباركود', 'اسم المنتج', 'التصنيف', 'الوحدة', 'سعر التكلفة', 'سعر البيع مفرد', 'سعر البيع جملة', 'الرصيد الافتتاحي', 'حد الطلب الأدنى'],
            ['PRD-201', '6281000201', 'شاشة سامسونج سمارت 55 بوصة', 'إلكترونيات', 'حبة / قطعة', '320', '420', '390', '10', '3'],
            ['PRD-202', '6281000202', 'طابعة ليزر إتش بي وايرلس', 'طابعات', 'حبة / قطعة', '140', '195', '175', '15', '5'],
            ['PRD-203', '6281000203', 'ورق تصوير A4 فاخر', 'قرطاسية', 'كرتون', '18', '25', '22', '50', '10']
        ];
        const csvContent = '\uFEFF' + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'نموذج_استيراد_المنتجات_والأسعار.csv';
        a.click();
        URL.revokeObjectURL(url);
        this.showToast('📄 تم تحميل نموذج Excel للمنتجات! يمكنك فتحه في Excel وتعبئة أصنافك ثم الضغط على "استيراد من Excel".', 'info');
    }

    triggerProductsExcelImport() {
        const inp = document.getElementById('products-excel-input');
        if (inp) {
            inp.value = '';
            inp.click();
        }
    }

    handleProductsExcelImport(event) {
        const file = event?.target?.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const rows = this._parseCSVText(e.target.result);
                if (rows.length < 2) {
                    this.showToast('الملف فارغ أو لا يحتوي على صفوف بيانات بعد الترويسة!', 'warning');
                    return;
                }

                const existingProducts = storage.getProducts();
                const defaultWh = storage.getWarehouses().find(w => w.isDefault) || storage.getWarehouses()[0];
                const whId = defaultWh ? defaultWh.id : 'WH-01';
                const openingItems = [];
                let addedCount = 0;
                let updatedCount = 0;

                for (let i = 1; i < rows.length; i++) {
                    const r = rows[i];
                    if (!r || r.length < 2) continue;

                    let sku = (r[0] || '').trim();
                    const barcode = (r[1] || '').trim();
                    const name = (r[2] || r[0] || '').trim();
                    if (!name) continue;
                    if (!sku) sku = `PRD-${100 + existingProducts.length + addedCount + 1}`;

                    const category = (r[3] || 'عام').trim() || 'عام';
                    const unit = (r[4] || 'حبة / قطعة').trim() || 'حبة / قطعة';
                    const purchasePrice = Math.max(0, parseFloat(r[5]) || 0);
                    const sellingPrice = Math.max(0, parseFloat(r[6]) || purchasePrice);
                    const wholesalePrice = (r[7] !== undefined && String(r[7]).trim() !== '')
                        ? Math.max(0, parseFloat(r[7]) || 0)
                        : sellingPrice;
                    const openingQty = Math.max(0, parseFloat(r[8]) || 0);
                    const minStockAlert = Math.max(0, parseInt(r[9]) || 5);

                    const existing = storage.getProducts().find(p => p.sku.toLowerCase() === sku.toLowerCase() || p.name.trim() === name);
                    let targetProd = null;
                    if (existing) {
                        storage.updateProduct(existing.id, {
                            sku: existing.sku,
                            barcode: barcode || existing.barcode,
                            name,
                            category,
                            unit,
                            purchasePrice,
                            sellingPrice,
                            wholesalePrice,
                            minStockAlert
                        });
                        targetProd = storage.getProductById(existing.id);
                        updatedCount++;
                    } else {
                        targetProd = storage.addProduct({
                            sku,
                            barcode,
                            name,
                            category,
                            unit,
                            purchasePrice,
                            sellingPrice,
                            wholesalePrice,
                            minStockAlert,
                            description: 'مستورد من ملف Excel'
                        });
                        addedCount++;
                    }

                    if (openingQty > 0 && targetProd) {
                        openingItems.push({
                            productId: targetProd.id,
                            warehouseId: whId,
                            quantity: openingQty,
                            unitCost: purchasePrice
                        });
                    }
                }

                if (openingItems.length > 0) {
                    inventory.executeOpeningBalanceBatch({
                        warehouseId: whId,
                        date: new Date().toISOString().split('T')[0],
                        notes: `رصيد افتتاحي مستورد آلياً من ملف Excel (${openingItems.length} صنف)`,
                        items: openingItems
                    });
                }

                this.renderProducts();
                this.renderDashboard();
                this.showToast(`✅ تم استيراد ملف Excel بنجاح! (إضافة ${addedCount} صنف جديد، تحديث ${updatedCount} صنف${openingItems.length > 0 ? `، وإثبات رصيد افتتاحي لـ ${openingItems.length} صنف` : ''})`, 'success');
            } catch (err) {
                this.showToast('خطأ أثناء قراءة ملف Excel: ' + err.message, 'error');
            }
        };
        reader.readAsText(file, 'UTF-8');
    }

    downloadPartiesExcelTemplate() {
        const rows = [
            ['الاسم الكامل', 'النوع (عميل / مورد)', 'رقم الهاتف', 'العنوان', 'الرصيد الافتتاحي المستحق', 'ملاحظات'],
            ['شركة النور للتجارة العامة', 'عميل', '0501112233', 'الرياض - الملز', '2500', 'عميل جملة معتمد'],
            ['مؤسسة الخليج للتوريدات', 'مورد', '0554445566', 'جدة - المنطقة الصناعية', '4800', 'مورد أجهزة رئيسي'],
            ['معرض الأفق الحديث', 'عميل', '0567778899', 'الدمام', '0', 'عميل نقدي وأقساط']
        ];
        const csvContent = '\uFEFF' + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'نموذج_استيراد_العملاء_والموردين.csv';
        a.click();
        URL.revokeObjectURL(url);
        this.showToast('📄 تم تحميل نموذج Excel للعملاء والموردين!', 'info');
    }

    triggerPartiesExcelImport() {
        const inp = document.getElementById('parties-excel-input');
        if (inp) {
            inp.value = '';
            inp.click();
        }
    }

    handlePartiesExcelImport(event) {
        const file = event?.target?.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const rows = this._parseCSVText(e.target.result);
                if (rows.length < 2) {
                    this.showToast('الملف فارغ أو لا يحتوي على بيانات بعد الترويسة!', 'warning');
                    return;
                }

                let addedCount = 0;
                for (let i = 1; i < rows.length; i++) {
                    const r = rows[i];
                    const name = (r[0] || '').trim();
                    if (!name) continue;
                    const rawType = (r[1] || '').trim();
                    const type = (rawType.includes('مورد') || rawType.toUpperCase() === 'SUPPLIER') ? 'SUPPLIER' : 'CUSTOMER';
                    const phone = (r[2] || '').trim();
                    const address = (r[3] || '').trim();
                    const openingBalance = Math.max(0, parseFloat(r[4]) || 0);
                    const notes = (r[5] || '').trim();

                    const existingParty = storage.getParties().find(p => p.name.trim() === name);
                    if (existingParty) {
                        storage.updateParty(existingParty.id, {
                            name,
                            type,
                            phone: phone || existingParty.phone,
                            address: address || existingParty.address,
                            openingBalance,
                            notes: notes || existingParty.notes
                        });
                    } else {
                        storage.addParty({
                            name,
                            type,
                            phone,
                            address,
                            openingBalance,
                            notes
                        });
                    }
                    addedCount++;
                }

                this.renderParties();
                this.renderDashboard();
                this.showToast(`✅ تم استيراد (${addedCount}) عميل/مورد مع أرصدتهم الافتتاحية من ملف Excel بنجاح!`, 'success');
            } catch (err) {
                this.showToast('خطأ أثناء استيراد ملف العملاء: ' + err.message, 'error');
            }
        };
        reader.readAsText(file, 'UTF-8');
    }

    // ==================== 26. نظام الأقساط وجدولة الديون (Installments & Payment Plans) ====================
    renderInstallments() {
        this.populatePartiesDatalist();
        const plans = storage.getInstallmentPlans ? storage.getInstallmentPlans() : [];
        const today = new Date().toISOString().split('T')[0];

        let activePlansCount = 0;
        let totalFinanced = 0;
        let totalCollected = 0;
        let totalRemaining = 0;
        let upcomingInstCount = 0;
        let overdueAmount = 0;
        let overdueInstCount = 0;

        plans.forEach(pl => {
            totalFinanced += (parseFloat(pl.totalAmount) || 0);
            totalCollected += (parseFloat(pl.paidAmount) || 0);
            totalRemaining += (parseFloat(pl.remainingAmount) || 0);
            if (pl.status !== 'COMPLETED' && (parseFloat(pl.remainingAmount) || 0) > 0.009) {
                activePlansCount++;
            }
            (pl.installments || []).forEach(inst => {
                const rem = Math.max(0, (parseFloat(inst.amount) || 0) - (parseFloat(inst.paidAmount) || 0));
                if (inst.status !== 'PAID' && rem > 0.009) {
                    upcomingInstCount++;
                    if (inst.dueDate <= today) {
                        overdueInstCount++;
                        overdueAmount += rem;
                    }
                }
            });
        });

        const setTxt = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
        };

        setTxt('ins-kpi-active-plans', `${activePlansCount} عقد نشط`);
        setTxt('ins-kpi-total-financed', `إجمالي العقود: ${engine.formatMoney(totalFinanced)}`);
        setTxt('ins-kpi-collected', engine.formatMoney(totalCollected));
        setTxt('ins-kpi-remaining', engine.formatMoney(totalRemaining));
        setTxt('ins-kpi-upcoming-count', `${upcomingInstCount} قسط مجدول غير مسدد`);
        setTxt('ins-kpi-overdue', engine.formatMoney(overdueAmount));
        setTxt('ins-kpi-overdue-count', `${overdueInstCount} قسط حان موعده أو متأخر`);

        const query = document.getElementById('ins-search')?.value.trim().toLowerCase() || '';
        const statusFilter = document.getElementById('ins-status-filter')?.value || 'ALL';

        const filtered = plans.filter(pl => {
            const matchSearch = !query ||
                (pl.id && pl.id.toLowerCase().includes(query)) ||
                (pl.partyName && pl.partyName.toLowerCase().includes(query)) ||
                (pl.title && pl.title.toLowerCase().includes(query));

            if (!matchSearch) return false;
            if (statusFilter === 'ACTIVE') return pl.status !== 'COMPLETED' && (parseFloat(pl.remainingAmount) || 0) > 0.009;
            if (statusFilter === 'COMPLETED') return pl.status === 'COMPLETED' || (parseFloat(pl.remainingAmount) || 0) <= 0.009;
            if (statusFilter === 'OVERDUE') {
                return (pl.installments || []).some(inst => inst.status !== 'PAID' && inst.dueDate <= today);
            }
            return true;
        });

        const tbody = document.getElementById('installments-tbody');
        if (!tbody) return;

        if (filtered.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; padding: 36px; color: var(--text-muted);">
                        لا توجد عقود تقسيط مسجلة تطابق الفلتر الحالي. اضغط على "➕ إنشاء عقد وجدول أقساط جديد" لجدولة دين أي عميل.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = filtered.map(pl => {
            const unpaidInsts = (pl.installments || []).filter(i => i.status !== 'PAID');
            const paidCount = (pl.installments || []).length - unpaidInsts.length;
            const totalCount = (pl.installments || []).length;
            const nextInst = unpaidInsts[0] || null;

            let nextBadgeHtml = `<span class="badge" style="background: #ecfdf5; color: #047857; font-weight: 800;">✅ مسدد بالكامل (${paidCount}/${totalCount})</span>`;
            if (nextInst) {
                const instRem = Number(((parseFloat(nextInst.amount) || 0) - (parseFloat(nextInst.paidAmount) || 0)).toFixed(2));
                const isOverdue = nextInst.dueDate <= today;
                nextBadgeHtml = `
                    <div style="display: flex; flex-direction: column; gap: 3px;">
                        <span class="badge" style="background: ${isOverdue ? '#fef2f2' : '#eff6ff'}; color: ${isOverdue ? '#dc2626' : '#1d4ed8'}; font-weight: 800;">
                            ${isOverdue ? '🚨 مستحق:' : '📅 القسط'} #${nextInst.number} (${engine.formatMoney(instRem)})
                        </span>
                        <span style="font-size: 11px; color: var(--text-muted);">تاريخ الاستحقاق: <strong>${this.escapeHtml(nextInst.dueDate)}</strong> (${paidCount}/${totalCount} مسدد)</span>
                    </div>
                `;
            }

            return `
                <tr>
                    <td>
                        <strong style="font-family: monospace; color: var(--primary); font-size: 13.5px;">${this.escapeHtml(pl.id)}</strong>
                        <div style="font-size: 11px; color: var(--text-muted);">${this.escapeHtml(pl.startDate || '')}</div>
                    </td>
                    <td>
                        <strong style="font-size: 14px;">👤 ${this.escapeHtml(pl.partyName)}</strong>
                        <div style="font-size: 12px; color: var(--text-secondary);">${this.escapeHtml(pl.title || '')}</div>
                    </td>
                    <td class="num"><strong>${engine.formatMoney(pl.totalAmount)}</strong></td>
                    <td class="num" style="color: var(--text-secondary);">${engine.formatMoney(pl.downPayment)}</td>
                    <td class="num" style="color: var(--success); font-weight: 700;">${engine.formatMoney(pl.paidAmount)}</td>
                    <td class="num" style="color: ${pl.remainingAmount > 0 ? 'var(--danger)' : 'var(--success)'}; font-weight: 800;">${engine.formatMoney(pl.remainingAmount)}</td>
                    <td>${nextBadgeHtml}</td>
                    <td style="text-align: center;">
                        <div style="display: flex; gap: 5px; justify-content: center; flex-wrap: wrap;">
                            ${nextInst ? `
                                <button type="button" class="btn btn-primary btn-sm" style="background: #059669; border-color: #059669; padding: 4px 9px; font-size: 11.5px;" onclick="ui.collectInstallmentNow('${pl.id}', ${nextInst.number})" title="تحصيل القسط رقم ${nextInst.number} وإصدار سند قبض وقيد محاسبي آلي">
                                    💵 تحصيل قسط #${nextInst.number}
                                </button>
                            ` : ''}
                            <button type="button" class="btn btn-outline btn-sm" style="padding: 4px 8px; font-size: 11.5px;" onclick="ui.viewInstallmentContract('${pl.id}')" title="استعراض وطباعة عقد وجدول الأقساط">
                                🖨️ العقد والجدول
                            </button>
                            <button type="button" class="btn btn-outline btn-sm" style="color: var(--danger); padding: 4px 7px;" onclick="ui.deleteInstallmentPlan('${pl.id}')" title="حذف عقد التقسيط">
                                🗑️
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    openInstallmentModal(defaultPartyName = '') {
        this.populatePartiesDatalist();
        const form = document.getElementById('installment-form');
        if (form) form.reset();

        const partyEl = document.getElementById('ins-form-party');
        if (partyEl) partyEl.value = defaultPartyName || '';

        const startEl = document.getElementById('ins-form-start-date');
        if (startEl) {
            const nextMonth = new Date();
            nextMonth.setMonth(nextMonth.getMonth() + 1);
            startEl.value = nextMonth.toISOString().split('T')[0];
        }

        this.calculateInstallmentModalPreview();
        this.openModal('installment-modal');
    }

    calculateInstallmentModalPreview() {
        const total = Math.max(0, parseFloat(document.getElementById('ins-form-total')?.value) || 0);
        const down = Math.max(0, parseFloat(document.getElementById('ins-form-down')?.value) || 0);
        const count = Math.max(1, parseInt(document.getElementById('ins-form-count')?.value) || 1);
        const freq = document.getElementById('ins-form-freq')?.value || 'MONTHLY';
        const netFinanced = Math.max(0, total - down);
        const perInstallment = count > 0 ? (netFinanced / count) : 0;

        const freqLabel = freq === 'WEEKLY' ? 'أسبوعي' : (freq === 'BIWEEKLY' ? 'نصف شهري' : 'شهري');
        const box = document.getElementById('ins-form-preview-box');
        if (box) {
            box.innerHTML = `
                <div style="display: flex; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
                    <div>الرصيد المقسط بعد المقدم: <strong class="num" style="color: var(--primary);">${engine.formatMoney(netFinanced)}</strong></div>
                    <div>قيمة القسط الواحد (${freqLabel}): <strong class="num" style="color: var(--success); font-size: 14.5px;">${engine.formatMoney(perInstallment)}</strong> × ${count} أقساط</div>
                </div>
            `;
        }
    }

    saveInstallmentFromForm() {
        try {
            const partyName = document.getElementById('ins-form-party')?.value.trim();
            const title = document.getElementById('ins-form-title')?.value.trim();
            const totalAmount = parseFloat(document.getElementById('ins-form-total')?.value) || 0;
            const downPayment = parseFloat(document.getElementById('ins-form-down')?.value) || 0;
            const paymentMethod = document.getElementById('ins-form-pay-method')?.value || 'CASH';
            const installmentCount = parseInt(document.getElementById('ins-form-count')?.value) || 1;
            const frequency = document.getElementById('ins-form-freq')?.value || 'MONTHLY';
            const startDate = document.getElementById('ins-form-start-date')?.value;
            const notes = document.getElementById('ins-form-notes')?.value.trim() || '';

            const plan = storage.addInstallmentPlan({
                partyName,
                title,
                totalAmount,
                downPayment,
                paymentMethod,
                installmentCount,
                frequency,
                startDate,
                notes
            });

            this.closeModal();
            this.renderInstallments();
            this.renderParties();
            this.renderDashboard();
            this.showToast(`✅ تم إنشاء عقد التقسيط (${plan.id}) للعميل (${plan.partyName}) بعدد ${plan.installmentCount} أقساط بنجاح!`, 'success');
        } catch (err) {
            this.showToast(err.message, 'error');
        }
    }

    collectInstallmentNow(planId, instNumber) {
        const plan = storage.getInstallmentPlanById(planId);
        if (!plan) return;
        const inst = (plan.installments || []).find(i => Number(i.number) === Number(instNumber));
        if (!inst) return;

        const rem = Number(((parseFloat(inst.amount) || 0) - (parseFloat(inst.paidAmount) || 0)).toFixed(2));
        if (!confirm(`هل تريد تحصيل القسط رقم (#${inst.number}) من العميل (${plan.partyName}) بمبلغ (${engine.formatMoney(rem)}) وإصدار سند قبض رسمي وقيد محاسبي الآن؟`)) {
            return;
        }

        try {
            const res = storage.payInstallment({
                planId,
                installmentNumber: instNumber,
                amount: rem,
                paymentMethod: 'CASH',
                date: new Date().toISOString().split('T')[0]
            });
            this.renderInstallments();
            this.renderParties();
            this.renderDashboard();
            this.showToast(`💵 تم تحصيل القسط رقم #${instNumber} بنجاح وإصدار سند القبض رقم (${res.voucher.id})!`, 'success');
        } catch (err) {
            this.showToast(err.message, 'error');
        }
    }

    viewInstallmentContract(planId) {
        const pl = storage.getInstallmentPlanById(planId);
        if (!pl) return;
        const settings = storage.getSettings();
        const content = document.getElementById('voucher-modal-content');
        if (!content) return;

        content.innerHTML = `
            <div class="voucher-paper">
                <div class="voucher-header">
                    <h2>${this.escapeHtml(settings.companyName)}</h2>
                    <div class="sub-title">📅 عقد بيع بالتقسيط وجدول استحقاق الأقساط</div>
                    <div style="font-size: 12.5px; color: var(--text-muted); margin-top: 4px;">
                        رقم العقد: <strong>${this.escapeHtml(pl.id)}</strong> • العميل: <strong>${this.escapeHtml(pl.partyName)}</strong> • البيان: <strong>${this.escapeHtml(pl.title)}</strong>
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(145px, 1fr)); gap: 12px; margin-bottom: 18px; background: #f8fafc; padding: 14px; border-radius: 8px; border: 1px solid var(--border-color);">
                    <div><span style="font-size: 12px; color: var(--text-muted); display: block;">إجمالي العقد</span><strong>${engine.formatMoney(pl.totalAmount)}</strong></div>
                    <div><span style="font-size: 12px; color: var(--text-muted); display: block;">الدفعة المقدمة</span><strong>${engine.formatMoney(pl.downPayment)}</strong></div>
                    <div><span style="font-size: 12px; color: var(--text-muted); display: block;">المبلغ المقسط</span><strong style="color: var(--primary);">${engine.formatMoney(pl.financedAmount)}</strong></div>
                    <div><span style="font-size: 12px; color: var(--text-muted); display: block;">إجمالي المحصل</span><strong style="color: var(--success);">${engine.formatMoney(pl.paidAmount)}</strong></div>
                    <div><span style="font-size: 12px; color: var(--text-muted); display: block;">الرصيد المتبقي</span><strong style="color: var(--danger);">${engine.formatMoney(pl.remainingAmount)}</strong></div>
                </div>

                ${pl.notes ? `<div style="margin-bottom: 14px; font-size: 13px;"><strong>📝 شروط وملاحظات العقد:</strong> ${this.escapeHtml(pl.notes)}</div>` : ''}

                <table class="acc-table">
                    <thead>
                        <tr>
                            <th>رقم القسط</th>
                            <th>تاريخ الاستحقاق</th>
                            <th class="num">قيمة القسط</th>
                            <th class="num">المسدد</th>
                            <th>الحالة ورقم السند</th>
                            <th class="no-print" style="text-align: center;">إجراء</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${(pl.installments || []).map(inst => {
                            const isPaid = inst.status === 'PAID';
                            return `
                                <tr>
                                    <td><strong>القسط #${inst.number}</strong></td>
                                    <td>${this.escapeHtml(inst.dueDate)}</td>
                                    <td class="num"><strong>${engine.formatMoney(inst.amount)}</strong></td>
                                    <td class="num" style="color: var(--success);">${engine.formatMoney(inst.paidAmount || 0)}</td>
                                    <td>
                                        ${isPaid
                                            ? `<span class="badge badge-success">✅ مسدد (${this.escapeHtml(inst.voucherId || '')} - ${this.escapeHtml(inst.paidDate || '')})</span>`
                                            : `<span class="badge" style="background:#fffbeb; color:#b45309;">⏳ غير مسدد</span>`}
                                    </td>
                                    <td class="no-print" style="text-align: center;">
                                        ${!isPaid ? `<button type="button" class="btn btn-primary btn-sm" style="background:#059669; border-color:#059669; padding:3px 8px; font-size:11px;" onclick="ui.closeModal(); ui.collectInstallmentNow('${pl.id}', ${inst.number});">💵 تحصيل</button>` : '-'}
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>

                <div style="display: flex; justify-content: space-between; margin-top: 34px; padding-top: 16px; border-top: 1px dashed var(--border-color); font-size: 13px; color: var(--text-secondary);">
                    <div>توقيع العميل (الطرف الثاني): ____________________</div>
                    <div>توقيع المحاسب / البائع (الطرف الأول): ____________________</div>
                </div>
            </div>
        `;

        this.openModal('voucher-modal');
    }

    deleteInstallmentPlan(planId) {
        if (!confirm(`هل أنت متأكد من حذف عقد التقسيط رقم (${planId})؟`)) return;
        try {
            storage.deleteInstallmentPlan(planId);
            this.renderInstallments();
            this.renderDashboard();
            this.showToast('تم حذف عقد التقسيط بنجاح', 'info');
        } catch (err) {
            this.showToast(err.message, 'error');
        }
    }

    // إدارة النوافذ المنبثقة
    openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
            this.activeModal = modal;
        }
    }

    closeModal() {
        if (this.activeModal) {
            this.activeModal.classList.remove('active');
            this.activeModal = null;
        } else {
            document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
        }
    }
}

// إنشاء مدير الواجهة
const ui = new UIManager();
