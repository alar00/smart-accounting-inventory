// app.js - نقطة البداية والتشغيل والربط الشامل للنظام المحاسبي والمخزني

document.addEventListener('DOMContentLoaded', () => {
    console.log('✨ جاري تشغيل نظام المحاسبة وإدارة المخزون المتقدم...');
    
    // تسجيل الـ Service Worker للعمل أوفلاين
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js')
                .then(reg => console.log('✅ تم تفعيل التشغيل أوفلاين (Service Worker Ready):', reg.scope))
                .catch(err => console.log('⚠️ تعذر تسجيل Service Worker:', err));
        });
    }

    // تهيئة واجهة المستخدم
    ui.init();

    // ==================== نماذج المحاسبة ====================
    const entryForm = document.getElementById('entry-form');
    if (entryForm) {
        entryForm.addEventListener('submit', (e) => {
            e.preventDefault();
            ui.saveEntryFromForm();
        });
    }

    const accountForm = document.getElementById('account-form');
    if (accountForm) {
        accountForm.addEventListener('submit', (e) => {
            e.preventDefault();
            ui.saveAccountFromForm();
        });
    }

    const settingsForm = document.getElementById('settings-form');
    if (settingsForm) {
        settingsForm.addEventListener('submit', (e) => {
            e.preventDefault();
            ui.saveSettingsFromForm();
        });
    }

    const passwordSettingsForm = document.getElementById('password-settings-form');
    if (passwordSettingsForm) {
        passwordSettingsForm.addEventListener('submit', (e) => {
            e.preventDefault();
            ui.savePasswordFromForm();
        });
    }

    const passwordConfirmForm = document.getElementById('password-confirm-form');
    if (passwordConfirmForm) {
        passwordConfirmForm.addEventListener('submit', (e) => {
            e.preventDefault();
            ui.confirmPasswordAction();
        });
    }

    // ==================== نماذج المخزون ====================
    const productForm = document.getElementById('product-form');
    if (productForm) {
        productForm.addEventListener('submit', (e) => {
            e.preventDefault();
            ui.saveProductFromForm();
        });
    }

    const warehouseForm = document.getElementById('warehouse-form');
    if (warehouseForm) {
        warehouseForm.addEventListener('submit', (e) => {
            e.preventDefault();
            ui.saveWarehouseFromForm();
        });
    }

    const transferForm = document.getElementById('transfer-form');
    if (transferForm) {
        transferForm.addEventListener('submit', (e) => {
            e.preventDefault();
            ui.saveTransferFromForm();
        });
    }

    const adjustmentForm = document.getElementById('adjustment-form');
    if (adjustmentForm) {
        adjustmentForm.addEventListener('submit', (e) => {
            e.preventDefault();
            ui.saveAdjustmentFromForm();
        });
    }

    const stockInForm = document.getElementById('stock-in-form');
    if (stockInForm) {
        stockInForm.addEventListener('submit', (e) => {
            e.preventDefault();
            ui.saveStockInFromForm();
        });
    }

    const invoiceForm = document.getElementById('invoice-form');
    if (invoiceForm) {
        invoiceForm.addEventListener('submit', (e) => {
            e.preventDefault();
            ui.saveInvoiceFromForm();
        });
    }

    const openingBatchForm = document.getElementById('opening-batch-form');
    if (openingBatchForm) {
        openingBatchForm.addEventListener('submit', (e) => {
            e.preventDefault();
            ui.saveOpeningBatchFromForm();
        });
    }

    const voucherForm = document.getElementById('voucher-form');
    if (voucherForm) {
        voucherForm.addEventListener('submit', (e) => {
            e.preventDefault();
            ui.saveVoucherFromForm();
        });
    }

    const partyForm = document.getElementById('party-form');
    if (partyForm) {
        partyForm.addEventListener('submit', (e) => {
            e.preventDefault();
            ui.savePartyFromForm();
        });
    }

    const quotationForm = document.getElementById('quotation-form');
    if (quotationForm) {
        quotationForm.addEventListener('submit', (e) => {
            e.preventDefault();
            ui.saveQuotationFromForm();
        });
    }

    const expenseForm = document.getElementById('expense-form');
    if (expenseForm) {
        expenseForm.addEventListener('submit', (e) => {
            e.preventDefault();
            ui.saveExpenseFromForm();
        });
    }

    const installmentForm = document.getElementById('installment-form');
    if (installmentForm) {
        installmentForm.addEventListener('submit', (e) => {
            e.preventDefault();
            ui.saveInstallmentFromForm();
        });
    }

    // ==================== أحداث الفلاتر للفواتير ====================
    const invSearch = document.getElementById('invoice-search');
    if (invSearch) invSearch.addEventListener('input', () => ui.renderInvoices());

    const invTypeFilter = document.getElementById('invoice-type-filter');
    if (invTypeFilter) invTypeFilter.addEventListener('change', () => ui.renderInvoices());

    const invPayFilter = document.getElementById('invoice-pay-filter');
    if (invPayFilter) invPayFilter.addEventListener('change', () => ui.renderInvoices());

    // ==================== أحداث الفلاتر للمنتجات ====================
    const prodSearch = document.getElementById('products-search');
    if (prodSearch) prodSearch.addEventListener('input', () => ui.renderProducts());

    const prodCatFilter = document.getElementById('products-category-filter');
    if (prodCatFilter) prodCatFilter.addEventListener('change', () => ui.renderProducts());

    // ==================== أحداث حركات المخزون والتحويل ====================
    const stockSearch = document.getElementById('stock-ops-search');
    if (stockSearch) stockSearch.addEventListener('input', () => ui.renderStockOps());

    const stockTypeFilter = document.getElementById('stock-ops-type-filter');
    if (stockTypeFilter) stockTypeFilter.addEventListener('change', () => ui.renderStockOps());

    const trFromWh = document.getElementById('tr-from-wh');
    if (trFromWh) trFromWh.addEventListener('change', () => ui.updateTransferAvailableStock());

    const trProd = document.getElementById('tr-product');
    if (trProd) trProd.addEventListener('change', () => ui.updateTransferAvailableStock());

    const adjProd = document.getElementById('adj-prod');
    if (adjProd) adjProd.addEventListener('change', () => ui.onAdjustmentProductSelect());

    const adjWh = document.getElementById('adj-wh');
    if (adjWh) adjWh.addEventListener('change', () => ui.onAdjustmentProductSelect());

    const inProd = document.getElementById('in-prod');
    if (inProd) inProd.addEventListener('change', () => ui.onStockInProductSelect());

    // ==================== أحداث تقارير المخزون ====================
    document.querySelectorAll('input[name="inv-report-sub"]').forEach(radio => {
        radio.addEventListener('change', (e) => ui.showSubReport(e.target.value));
    });

    const invRepWhFilter = document.getElementById('inv-rep-wh-filter');
    if (invRepWhFilter) invRepWhFilter.addEventListener('change', () => ui.renderInventoryReports());

    const invRepProdSelect = document.getElementById('inv-rep-prod-select');
    if (invRepProdSelect) invRepProdSelect.addEventListener('change', () => ui.showSubReport('item_card'));

    const invRepDateFrom = document.getElementById('inv-rep-date-from');
    if (invRepDateFrom) invRepDateFrom.addEventListener('change', () => ui.showSubReport('item_card'));

    const invRepDateTo = document.getElementById('inv-rep-date-to');
    if (invRepDateTo) invRepDateTo.addEventListener('change', () => ui.showSubReport('item_card'));

    // ==================== فلاتر الحسابات والقيود والتقارير المالية ====================
    const accSearch = document.getElementById('accounts-search');
    if (accSearch) accSearch.addEventListener('input', () => ui.renderAccounts());

    const accTypeFilter = document.getElementById('accounts-type-filter');
    if (accTypeFilter) accTypeFilter.addEventListener('change', () => ui.renderAccounts());

    const entrySearch = document.getElementById('entries-search');
    if (entrySearch) entrySearch.addEventListener('input', () => ui.renderEntries());

    const entryDateFrom = document.getElementById('entries-date-from');
    if (entryDateFrom) entryDateFrom.addEventListener('change', () => ui.renderEntries());

    const entryDateTo = document.getElementById('entries-date-to');
    if (entryDateTo) entryDateTo.addEventListener('change', () => ui.renderEntries());

    const ledgerAccSelect = document.getElementById('ledger-account-select');
    if (ledgerAccSelect) ledgerAccSelect.addEventListener('change', () => ui.renderLedger());

    const ledgerDateFrom = document.getElementById('ledger-date-from');
    if (ledgerDateFrom) ledgerDateFrom.addEventListener('change', () => ui.renderLedger());

    const ledgerDateTo = document.getElementById('ledger-date-to');
    if (ledgerDateTo) ledgerDateTo.addEventListener('change', () => ui.renderLedger());

    const tbDateFrom = document.getElementById('tb-date-from');
    if (tbDateFrom) tbDateFrom.addEventListener('change', () => ui.renderTrialBalance());

    const tbDateTo = document.getElementById('tb-date-to');
    if (tbDateTo) tbDateTo.addEventListener('change', () => ui.renderTrialBalance());

    document.querySelectorAll('input[name="report-type"]').forEach(radio => {
        radio.addEventListener('change', () => ui.renderReports());
    });

    const reportDateTo = document.getElementById('report-date-to');
    if (reportDateTo) reportDateTo.addEventListener('change', () => ui.renderReports());

    // تعيين التاريخ الافتراضي
    const today = new Date().toISOString().split('T')[0];
    if (reportDateTo && !reportDateTo.value) reportDateTo.value = today;
    if (tbDateTo && !tbDateTo.value) tbDateTo.value = today;

    console.log('✅ تم تشغيل النظام بنجاح وتجهيز كافة السجلات المحاسبية والمخزنية.');
});
