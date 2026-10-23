// storage.js - إدارة حفظ واسترجاع وتصدير البيانات المحاسبية والمخزنية

const STORAGE_KEYS = {
    ACCOUNTS: 'smart_acc_accounts_v2',
    ENTRIES: 'smart_acc_entries_v2',
    SETTINGS: 'smart_acc_settings_v2',
    WAREHOUSES: 'smart_acc_warehouses_v2',
    PRODUCTS: 'smart_acc_products_v2',
    INVENTORY_TXS: 'smart_acc_inventory_txs_v2',
    INVOICES: 'smart_acc_invoices_v2',
    OPENING_BATCHES: 'smart_acc_opening_batches_v2',
    VOUCHERS: 'smart_acc_vouchers_v2',
    PARTIES: 'smart_acc_parties_v2',
    QUOTATIONS: 'smart_acc_quotations_v2',
    EXPENSES: 'smart_acc_expenses_v2',
    AUDIT_LOGS: 'smart_acc_audit_logs_v2',
    STOCKTAKING_SHEETS: 'smart_acc_stocktaking_v2',
    INSTALLMENT_PLANS: 'smart_acc_installments_v2'
};

class StorageManager {
    constructor() {
        this._memCache = {};
        this.idb = null;
        this.autoSaveFileHandle = null;
        this.autoSaveFileName = '';
        this.lastDiskSaveTime = null;
        this._diskSaveTimer = null;
        this.init();
        this.initIndexedDBAndAutoRestore();
    }

    // ==================== محرك التخزين الموسّع غير المحدود (IndexedDB + Auto-Save File) ====================
    _persistKey(key, dataObj) {
        const jsonStr = JSON.stringify(dataObj);
        this._memCache[key] = dataObj;
        try {
            localStorage.setItem(key, jsonStr);
        } catch (e) {
            console.warn('localStorage quota warning — falling back to IndexedDB & Memory cache:', e);
        }
        this._writeKeyToIDB(key, jsonStr);
        this._scheduleDiskAutoSave();
    }

    _readKey(key, defaultFallback) {
        try {
            const raw = localStorage.getItem(key);
            if (raw) return JSON.parse(raw);
            if (this._memCache[key] !== undefined) return this._memCache[key];
            return defaultFallback;
        } catch (e) {
            return this._memCache[key] !== undefined ? this._memCache[key] : defaultFallback;
        }
    }

    initIndexedDBAndAutoRestore() {
        if (typeof indexedDB === 'undefined') return;
        try {
            const req = indexedDB.open('SmartAccountingUnlimitedDB', 1);
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('kv_store')) {
                    db.createObjectStore('kv_store');
                }
            };
            req.onsuccess = (e) => {
                this.idb = e.target.result;
                this._syncWithIDBOnStartup();
            };
        } catch (err) {
            console.warn('IndexedDB init warning:', err);
        }
    }

    _writeKeyToIDB(key, jsonStr) {
        if (!this.idb) return;
        try {
            const tx = this.idb.transaction('kv_store', 'readwrite');
            tx.objectStore('kv_store').put(jsonStr, key);
        } catch (err) {}
    }

    _syncWithIDBOnStartup() {
        if (!this.idb) return;
        try {
            const tx = this.idb.transaction('kv_store', 'readonly');
            const store = tx.objectStore('kv_store');
            const allKeys = Object.values(STORAGE_KEYS);
            let restoredAny = false;

            allKeys.forEach(k => {
                const getReq = store.get(k);
                getReq.onsuccess = () => {
                    const idbVal = getReq.result;
                    const lsVal = localStorage.getItem(k);
                    if (idbVal && (!lsVal || lsVal === '[]') && idbVal !== '[]') {
                        try {
                            localStorage.setItem(k, idbVal);
                            this._memCache[k] = JSON.parse(idbVal);
                            restoredAny = true;
                        } catch (e) {}
                    } else if (lsVal && !idbVal) {
                        this._writeKeyToIDB(k, lsVal);
                    }
                };
            });

            tx.oncomplete = () => {
                if (restoredAny && typeof ui !== 'undefined' && ui && typeof ui.renderCurrentTab === 'function') {
                    ui.renderCurrentTab();
                    ui.showToast('🛡️ تمت استعادة البيانات تلقائياً من قاعدة البيانات المحمية (IndexedDB)', 'info');
                }
            };
        } catch (err) {}
    }

    _scheduleDiskAutoSave() {
        if (!this.autoSaveFileHandle) return;
        if (this._diskSaveTimer) clearTimeout(this._diskSaveTimer);
        this._diskSaveTimer = setTimeout(() => {
            this.writeToDiskFileNow();
        }, 350);
    }

    writeToDiskFileNow() {
        if (!this.autoSaveFileHandle) return Promise.resolve(false);
        return this.autoSaveFileHandle.createWritable()
            .then(writable => {
                const jsonBackup = this.exportBackupJSON();
                return writable.write(jsonBackup).then(() => writable.close());
            })
            .then(() => {
                this.lastDiskSaveTime = new Date().toLocaleTimeString('ar-EG');
                if (typeof ui !== 'undefined' && ui && typeof ui.updateDiskAutoSaveIndicator === 'function') {
                    ui.updateDiskAutoSaveIndicator();
                }
                return true;
            })
            .catch(err => {
                console.warn('Auto-save to disk failed:', err);
                return false;
            });
    }

    getStorageStats() {
        let totalBytes = 0;
        Object.values(STORAGE_KEYS).forEach(k => {
            const v = localStorage.getItem(k) || '';
            totalBytes += v.length * 2;
        });
        const kb = (totalBytes / 1024).toFixed(1);
        const mb = (totalBytes / (1024 * 1024)).toFixed(2);
        return {
            totalBytes,
            kb,
            mb,
            idbActive: Boolean(this.idb),
            unlimitedDBActive: typeof indexedDB !== 'undefined',
            diskAutoSaveActive: Boolean(this.autoSaveFileHandle),
            diskAutoSaveConnected: Boolean(this.autoSaveFileHandle),
            diskFileName: this.autoSaveFileName || '',
            lastDiskSaveTime: this.lastDiskSaveTime || ''
        };
    }

    // تهيئة البيانات عند أول استخدام للتطبيق (نظام نظيف ومصفر بدون أمثلة)
    init() {
        // تنظيف أي بيانات تجريبية سابقة إن وجدت
        ['smart_acc_accounts_v1', 'smart_acc_entries_v1', 'smart_acc_settings_v1', 'smart_acc_warehouses_v1', 'smart_acc_products_v1', 'smart_acc_inventory_txs_v1'].forEach(k => {
            try { localStorage.removeItem(k); } catch (e) {}
        });

        if (!localStorage.getItem(STORAGE_KEYS.ACCOUNTS)) {
            this.saveAccounts(DEFAULT_ACCOUNTS);
        }
        if (!localStorage.getItem(STORAGE_KEYS.ENTRIES)) {
            this.saveEntries(DEMO_JOURNAL_ENTRIES);
        }
        if (!localStorage.getItem(STORAGE_KEYS.WAREHOUSES)) {
            this.saveWarehouses(DEFAULT_WAREHOUSES);
        }
        if (!localStorage.getItem(STORAGE_KEYS.PRODUCTS)) {
            this.saveProducts(DEFAULT_PRODUCTS);
        }
        if (!localStorage.getItem(STORAGE_KEYS.INVENTORY_TXS)) {
            this.saveInventoryTransactions(DEFAULT_INVENTORY_TRANSACTIONS);
        }
        if (!localStorage.getItem(STORAGE_KEYS.INVOICES)) {
            this.saveInvoices(DEFAULT_INVOICES);
        }
        if (!localStorage.getItem(STORAGE_KEYS.OPENING_BATCHES)) {
            this.saveOpeningBatches(DEFAULT_OPENING_BATCHES);
        }
        if (!localStorage.getItem(STORAGE_KEYS.VOUCHERS)) {
            this.saveVouchers(DEFAULT_VOUCHERS);
        }
        if (!localStorage.getItem(STORAGE_KEYS.PARTIES)) {
            this.saveParties(DEFAULT_PARTIES);
        }
        if (!localStorage.getItem(STORAGE_KEYS.QUOTATIONS)) {
            this.saveQuotations(DEFAULT_QUOTATIONS);
        }
        if (!localStorage.getItem(STORAGE_KEYS.EXPENSES)) {
            this.saveExpenses(DEFAULT_EXPENSES);
        }
        if (!localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS)) {
            this.saveAuditLogs(DEFAULT_AUDIT_LOGS);
        }
        if (!localStorage.getItem(STORAGE_KEYS.STOCKTAKING_SHEETS)) {
            this.saveStocktakingSheets([]);
        }
        if (!localStorage.getItem(STORAGE_KEYS.INSTALLMENT_PLANS)) {
            this.saveInstallmentPlans([]);
        }
        if (!localStorage.getItem(STORAGE_KEYS.SETTINGS)) {
            const defaultSettings = {
                companyName: 'المؤسسة التجارية',
                companyPhone: '',
                companyAddress: '',
                companyTaxNumber: '',
                invoiceFooterText: 'شكراً لتعاملكم معنا - نتطلع لخدمتكم دائماً',
                currency: '$',
                fiscalYear: '2026',
                autoEntryNumber: 1001,
                adminPassword: '1234',
                lastUpdated: new Date().toISOString()
            };
            this.saveSettings(defaultSettings);
        }
    }

    // ==================== إدارة الحسابات المالية ====================
    getAccounts() {
        try {
            const data = localStorage.getItem(STORAGE_KEYS.ACCOUNTS);
            return data ? JSON.parse(data) : [...DEFAULT_ACCOUNTS];
        } catch (e) {
            console.error('خطأ في جلب الحسابات:', e);
            return [...DEFAULT_ACCOUNTS];
        }
    }

    saveAccounts(accounts) {
        this._persistKey(STORAGE_KEYS.ACCOUNTS, accounts);
    }

    getAccountByCode(code) {
        const accounts = this.getAccounts();
        return accounts.find(acc => acc.code === String(code)) || null;
    }

    addAccount(accountData) {
        const accounts = this.getAccounts();
        if (accounts.some(a => a.code === accountData.code)) {
            throw new Error(`رقم الحساب ${accountData.code} موجود بالفعل!`);
        }
        accounts.push(accountData);
        accounts.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
        this.saveAccounts(accounts);
        return accountData;
    }

    updateAccount(code, updatedFields) {
        const accounts = this.getAccounts();
        const index = accounts.findIndex(a => a.code === String(code));
        if (index === -1) {
            throw new Error('الحساب غير موجود!');
        }
        accounts[index] = { ...accounts[index], ...updatedFields };
        this.saveAccounts(accounts);
        return accounts[index];
    }

    deleteAccount(code) {
        const accounts = this.getAccounts();
        const acc = accounts.find(a => a.code === String(code));
        if (!acc) throw new Error('الحساب غير موجود!');

        const entries = this.getEntries();
        const hasTransactions = entries.some(entry => 
            entry.lines.some(l => l.accountCode === String(code))
        );

        if (hasTransactions) {
            throw new Error('لا يمكن حذف الحساب نظراً لوجود قيود وحركات محاسبية مرتبطة به!');
        }

        const filtered = accounts.filter(a => a.code !== String(code));
        this.saveAccounts(filtered);
        return true;
    }

    // ==================== إدارة القيود اليومية ====================
    getEntries() {
        try {
            const data = localStorage.getItem(STORAGE_KEYS.ENTRIES);
            const list = data ? JSON.parse(data) : [];
            return list.sort((a, b) => {
                if (b.date === a.date) {
                    return (b.number || 0) - (a.number || 0);
                }
                return new Date(b.date) - new Date(a.date);
            });
        } catch (e) {
            console.error('خطأ في جلب القيود:', e);
            return [];
        }
    }

    saveEntries(entries) {
        this._persistKey(STORAGE_KEYS.ENTRIES, entries);
    }

    getEntryById(id) {
        const entries = this.getEntries();
        return entries.find(e => e.id === id) || null;
    }

    getNextEntryNumber() {
        const settings = this.getSettings();
        const entries = this.getEntries();
        let maxNum = settings.autoEntryNumber || 1001;
        entries.forEach(e => {
            if (e.number && e.number >= maxNum) {
                maxNum = e.number + 1;
            }
        });
        return maxNum;
    }

    addEntry(entryData) {
        const entries = this.getEntries();
        const nextNum = this.getNextEntryNumber();
        
        const newEntry = {
            id: entryData.id || `JV-${nextNum}`,
            number: entryData.number || nextNum,
            date: entryData.date || new Date().toISOString().split('T')[0],
            description: entryData.description || 'قيد تسوية يومية',
            reference: entryData.reference || '',
            createdAt: new Date().toISOString(),
            lines: entryData.lines || []
        };

        entries.push(newEntry);
        this.saveEntries(entries);

        const settings = this.getSettings();
        settings.autoEntryNumber = Math.max(settings.autoEntryNumber || 0, newEntry.number + 1);
        this.saveSettings(settings);

        return newEntry;
    }

    updateEntry(id, updatedData) {
        const entries = this.getEntries();
        const index = entries.findIndex(e => e.id === id);
        if (index === -1) throw new Error('القيد غير موجود!');
        
        entries[index] = {
            ...entries[index],
            ...updatedData,
            updatedAt: new Date().toISOString()
        };
        this.saveEntries(entries);
        this.addAuditLog({
            actionType: 'UPDATE',
            module: 'قيود اليومية',
            reference: id,
            description: `تعديل قيد اليومية رقم (${id}) — ${entries[index].description || ''}`
        });
        return entries[index];
    }

    deleteEntry(id) {
        const entries = this.getEntries();
        const target = entries.find(e => e.id === id);
        const filtered = entries.filter(e => e.id !== id);
        if (filtered.length === entries.length) {
            throw new Error('القيد المطلوب حذفه غير موجود!');
        }
        this.saveEntries(filtered);
        this.addAuditLog({
            actionType: 'DELETE',
            module: 'قيود اليومية',
            reference: id,
            description: `حذف قيد اليومية رقم (${id}) — ${target ? target.description : ''}`
        });
        return true;
    }

    // ==================== إدارة المستودعات والمخازن ====================
    getWarehouses() {
        try {
            const data = localStorage.getItem(STORAGE_KEYS.WAREHOUSES);
            return data ? JSON.parse(data) : [...DEFAULT_WAREHOUSES];
        } catch (e) {
            console.error('خطأ في جلب المستودعات:', e);
            return [...DEFAULT_WAREHOUSES];
        }
    }

    saveWarehouses(warehouses) {
        this._persistKey(STORAGE_KEYS.WAREHOUSES, warehouses);
    }

    getWarehouseById(id) {
        const warehouses = this.getWarehouses();
        return warehouses.find(w => w.id === id || w.code === id) || null;
    }

    addWarehouse(warehouseData) {
        const warehouses = this.getWarehouses();
        if (warehouses.some(w => w.code === warehouseData.code || w.id === warehouseData.id)) {
            throw new Error(`كود المستودع ${warehouseData.code} موجود بالفعل!`);
        }

        let maxSeq = warehouses.length + 1;
        warehouses.forEach(w => {
            const num = parseInt(String(w.id).replace(/\D/g, ''));
            if (num && num >= maxSeq) maxSeq = num + 1;
        });

        const newWh = {
            id: warehouseData.id || `WH-${String(maxSeq).padStart(2, '0')}`,
            code: warehouseData.code || `WH-${String(maxSeq).padStart(2, '0')}`,
            name: warehouseData.name,
            location: warehouseData.location || '',
            keeper: warehouseData.keeper || '',
            phone: warehouseData.phone || '',
            isDefault: Boolean(warehouseData.isDefault),
            notes: warehouseData.notes || '',
            createdAt: new Date().toISOString()
        };

        if (newWh.isDefault) {
            warehouses.forEach(w => w.isDefault = false);
        }

        warehouses.push(newWh);
        this.saveWarehouses(warehouses);
        return newWh;
    }

    updateWarehouse(id, updatedFields) {
        const warehouses = this.getWarehouses();
        const index = warehouses.findIndex(w => w.id === id);
        if (index === -1) throw new Error('المستودع غير موجود!');

        if (updatedFields.isDefault) {
            warehouses.forEach(w => w.isDefault = false);
        }

        warehouses[index] = { ...warehouses[index], ...updatedFields, updatedAt: new Date().toISOString() };
        this.saveWarehouses(warehouses);
        return warehouses[index];
    }

    deleteWarehouse(id) {
        const warehouses = this.getWarehouses();
        if (warehouses.length <= 1) {
            throw new Error('يجب الإبقاء على مستودع رئيسي واحد على الأقل في النظام!');
        }

        // فحص هل توجد حركات مخزنية في هذا المستودع
        const txs = this.getInventoryTransactions();
        const hasTxs = txs.some(t => t.warehouseId === id || t.fromWarehouseId === id || t.toWarehouseId === id);
        if (hasTxs) {
            throw new Error('لا يمكن حذف المستودع نظراً لوجود حركات مخزنية مسجلة عليه!');
        }

        const filtered = warehouses.filter(w => w.id !== id);
        if (filtered.length === warehouses.length) {
            throw new Error('المستودع المطلوب حذفه غير موجود!');
        }

        // إذا كان المحذوف هو الافتراضي، نجعل الأول هو الافتراضي
        if (!filtered.some(w => w.isDefault) && filtered.length > 0) {
            filtered[0].isDefault = true;
        }

        this.saveWarehouses(filtered);
        return true;
    }

    // ==================== إدارة المنتجات والأصناف ====================
    getProducts() {
        try {
            const data = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
            return data ? JSON.parse(data) : [...DEFAULT_PRODUCTS];
        } catch (e) {
            console.error('خطأ في جلب المنتجات:', e);
            return [...DEFAULT_PRODUCTS];
        }
    }

    saveProducts(products) {
        this._persistKey(STORAGE_KEYS.PRODUCTS, products);
    }

    getProductById(id) {
        const products = this.getProducts();
        return products.find(p => p.id === id || p.sku === id) || null;
    }

    addProduct(productData) {
        const products = this.getProducts();
        if (products.some(p => p.sku === productData.sku)) {
            throw new Error(`كود الصنف (SKU) ${productData.sku} موجود بالفعل!`);
        }

        let maxPrdNum = 100 + products.length + 1;
        products.forEach(p => {
            const num = parseInt(String(p.id).replace(/\D/g, ''));
            if (num && num >= maxPrdNum) maxPrdNum = num + 1;
        });

        const retailPrice = parseFloat(productData.sellingPrice) || 0;
        const wholesalePrice = productData.wholesalePrice !== undefined && productData.wholesalePrice !== ''
            ? (parseFloat(productData.wholesalePrice) || 0)
            : retailPrice;

        const newProduct = {
            id: productData.id || `PRD-${maxPrdNum}`,
            sku: productData.sku || `SKU-${Date.now().toString().slice(-4)}`,
            barcode: productData.barcode || '',
            name: productData.name,
            category: productData.category || 'عام',
            unit: productData.unit || 'حبة / قطعة',
            purchasePrice: parseFloat(productData.purchasePrice) || 0,
            sellingPrice: retailPrice,
            wholesalePrice: wholesalePrice,
            minStockAlert: parseInt(productData.minStockAlert) || 5,
            description: productData.description || '',
            createdAt: new Date().toISOString()
        };

        products.push(newProduct);
        this.saveProducts(products);
        this.addAuditLog({
            actionType: 'CREATE',
            module: 'المنتجات',
            reference: newProduct.sku,
            description: `إضافة منتج جديد (${newProduct.name}) بسعر بيع ${newProduct.sellingPrice.toFixed(2)}`
        });
        return newProduct;
    }

    updateProduct(id, updatedFields) {
        const products = this.getProducts();
        const index = products.findIndex(p => p.id === id);
        if (index === -1) throw new Error('المنتج غير موجود!');

        products[index] = {
            ...products[index],
            ...updatedFields,
            purchasePrice: parseFloat(updatedFields.purchasePrice ?? products[index].purchasePrice) || 0,
            sellingPrice: parseFloat(updatedFields.sellingPrice ?? products[index].sellingPrice) || 0,
            wholesalePrice: parseFloat(updatedFields.wholesalePrice ?? products[index].wholesalePrice ?? updatedFields.sellingPrice ?? products[index].sellingPrice) || 0,
            minStockAlert: parseInt(updatedFields.minStockAlert ?? products[index].minStockAlert) || 0,
            updatedAt: new Date().toISOString()
        };
        this.saveProducts(products);
        this.addAuditLog({
            actionType: 'UPDATE',
            module: 'المنتجات',
            reference: products[index].sku,
            description: `تحديث بيانات/أسعار الصنف (${products[index].name})`
        });
        return products[index];
    }

    deleteProduct(id) {
        const products = this.getProducts();
        const prod = products.find(p => p.id === id);
        const txs = this.getInventoryTransactions();
        const hasTxs = txs.some(t => t.productId === id);
        if (hasTxs) {
            throw new Error('لا يمكن حذف المنتج نظراً لوجود حركات وعمليات مخزنية مسجلة عليه!');
        }

        const filtered = products.filter(p => p.id !== id);
        if (filtered.length === products.length) throw new Error('المنتج المطلوب حذفه غير موجود!');
        this.saveProducts(filtered);
        this.addAuditLog({
            actionType: 'DELETE',
            module: 'المنتجات',
            reference: prod ? prod.sku : id,
            description: `حذف المنتج (${prod ? prod.name : id})`
        });
        return true;
    }

    // ==================== إدارة الحركات والتسويات المخزنية ====================
    getInventoryTransactions() {
        try {
            const data = localStorage.getItem(STORAGE_KEYS.INVENTORY_TXS);
            const list = data ? JSON.parse(data) : [];
            return list.sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));
        } catch (e) {
            console.error('خطأ في جلب حركات المخزون:', e);
            return [];
        }
    }

    saveInventoryTransactions(txs) {
        this._persistKey(STORAGE_KEYS.INVENTORY_TXS, txs);
    }

    addInventoryTransaction(txData) {
        const txs = this.getInventoryTransactions();
        let maxTxNum = 1000 + txs.length + 1;
        txs.forEach(t => {
            const num = parseInt(String(t.id).replace(/\D/g, ''));
            if (num && num >= maxTxNum) maxTxNum = num + 1;
        });

        const newTx = {
            id: txData.id || `TX-${maxTxNum}`,
            date: txData.date || new Date().toISOString().split('T')[0],
            type: txData.type, // 'IN', 'OUT', 'TRANSFER', 'ADJUSTMENT'
            adjustmentType: txData.adjustmentType || null, // 'INCREASE' or 'DECREASE' for adjustments
            warehouseId: txData.warehouseId || null,
            fromWarehouseId: txData.fromWarehouseId || null,
            toWarehouseId: txData.toWarehouseId || null,
            productId: txData.productId,
            quantity: parseFloat(txData.quantity) || 0,
            unitCost: parseFloat(txData.unitCost) || 0,
            totalCost: (parseFloat(txData.quantity) || 0) * (parseFloat(txData.unitCost) || 0),
            reference: txData.reference || '',
            reason: txData.reason || '',
            journalEntryId: txData.journalEntryId || null,
            createdAt: new Date().toISOString()
        };

        txs.push(newTx);
        this.saveInventoryTransactions(txs);
        return newTx;
    }

    deleteInventoryTransaction(id) {
        const txs = this.getInventoryTransactions();
        const filtered = txs.filter(t => t.id !== id);
        if (filtered.length === txs.length) throw new Error('الحركة المخزنية غير موجودة!');
        this.saveInventoryTransactions(filtered);
        return true;
    }

    // ==================== إدارة فواتير المبيعات والمشتريات ====================
    getInvoices() {
        try {
            const data = localStorage.getItem(STORAGE_KEYS.INVOICES);
            const list = data ? JSON.parse(data) : [];
            return list.sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));
        } catch (e) {
            console.error('خطأ في جلب الفواتير:', e);
            return [];
        }
    }

    saveInvoices(invoices) {
        this._persistKey(STORAGE_KEYS.INVOICES, invoices);
    }

    getInvoiceById(id) {
        const invoices = this.getInvoices();
        return invoices.find(inv => inv.id === id || inv.number === id) || null;
    }

    getNextInvoiceNumber(type = 'SALES') {
        const invoices = this.getInvoices();
        const prefixes = {
            SALES: 'INV-S',
            PURCHASE: 'INV-P',
            SALES_RETURN: 'RET-S',
            PURCHASE_RETURN: 'RET-P'
        };
        const prefix = prefixes[type] || 'INV-S';
        const typeInvoices = invoices.filter(i => i.type === type || (i.id && i.id.startsWith(prefix)));
        let nextSeq = 1001;
        typeInvoices.forEach(i => {
            const numPart = parseInt(String(i.id).replace(/\D/g, ''));
            if (numPart && numPart >= nextSeq) {
                nextSeq = numPart + 1;
            }
        });
        return `${prefix}-${nextSeq}`;
    }

    addInvoice(invoiceData) {
        const invoices = this.getInvoices();
        const nextId = invoiceData.id || this.getNextInvoiceNumber(invoiceData.type);
        
        const newInvoice = {
            id: nextId,
            number: invoiceData.number || nextId,
            type: invoiceData.type, // 'SALES' or 'PURCHASE'
            partyName: invoiceData.partyName || (invoiceData.type === 'SALES' ? 'عميل نقدي' : 'مورد عام'),
            partyAccountCode: invoiceData.partyAccountCode || (invoiceData.type === 'SALES' ? '1103' : '2101'),
            paymentMethod: invoiceData.paymentMethod || 'CASH', // 'CASH', 'BANK', 'CREDIT'
            warehouseId: invoiceData.warehouseId,
            date: invoiceData.date || new Date().toISOString().split('T')[0],
            dueDate: invoiceData.dueDate || '',
            items: invoiceData.items || [],
            subtotal: parseFloat(invoiceData.subtotal) || 0,
            discount: parseFloat(invoiceData.discount) || 0,
            taxRate: parseFloat(invoiceData.taxRate) || 0,
            taxAmount: parseFloat(invoiceData.taxAmount) || 0,
            totalAmount: parseFloat(invoiceData.totalAmount) || 0,
            paidAmount: invoiceData.paidAmount !== undefined ? (parseFloat(invoiceData.paidAmount) || 0) : (invoiceData.paymentMethod === 'CREDIT' ? 0 : parseFloat(invoiceData.totalAmount) || 0),
            netPaidAmount: invoiceData.netPaidAmount !== undefined ? (parseFloat(invoiceData.netPaidAmount) || 0) : (invoiceData.paymentMethod === 'CREDIT' ? 0 : parseFloat(invoiceData.totalAmount) || 0),
            changeAmount: parseFloat(invoiceData.changeAmount) || 0,
            remainingAmount: invoiceData.remainingAmount !== undefined ? (parseFloat(invoiceData.remainingAmount) || 0) : (invoiceData.paymentMethod === 'CREDIT' ? parseFloat(invoiceData.totalAmount) || 0 : 0),
            notes: invoiceData.notes || '',
            journalEntryId: invoiceData.journalEntryId || null,
            cogsEntryId: invoiceData.cogsEntryId || null,
            createdAt: new Date().toISOString()
        };

        invoices.push(newInvoice);
        this.saveInvoices(invoices);
        this.addAuditLog({
            actionType: 'CREATE',
            module: 'الفواتير',
            reference: newInvoice.id,
            description: `إصدار فاتورة (${newInvoice.type}) للطرف (${newInvoice.partyName}) بمبلغ إجمالي ${newInvoice.totalAmount.toFixed(2)} (المستلم: ${newInvoice.paidAmount.toFixed(2)})`
        });
        return newInvoice;
    }

    deleteInvoice(id) {
        const invoices = this.getInvoices();
        const inv = invoices.find(i => i.id === id);
        if (!inv) throw new Error('الفاتورة غير موجودة!');
        
        // حذف القيود المحاسبية المرتبطة إن وجدت
        if (inv.journalEntryId) {
            try { this.deleteEntry(inv.journalEntryId); } catch (e) {}
        }
        if (inv.cogsEntryId) {
            try { this.deleteEntry(inv.cogsEntryId); } catch (e) {}
        }

        // حذف حركات المخزون المرتبطة بالفاتورة
        const txs = this.getInventoryTransactions();
        const remainingTxs = txs.filter(t => 
            t.reference !== inv.id && 
            t.reference !== inv.number &&
            !(inv.journalEntryId && t.journalEntryId === inv.journalEntryId) &&
            !(inv.cogsEntryId && t.journalEntryId === inv.cogsEntryId)
        );
        if (remainingTxs.length !== txs.length) {
            this.saveInventoryTransactions(remainingTxs);
        }

        const filtered = invoices.filter(i => i.id !== id);
        this.saveInvoices(filtered);
        this.addAuditLog({
            actionType: 'DELETE',
            module: 'الفواتير',
            reference: inv.id,
            description: `حذف الفاتورة رقم (${inv.id}) الخاصة بالطرف (${inv.partyName}) بقيمة ${parseFloat(inv.totalAmount || 0).toFixed(2)}`
        });
        return true;
    }

    // ==================== إدارة دفعات الأرصدة الافتتاحية ====================
    getOpeningBatches() {
        try {
            const data = localStorage.getItem(STORAGE_KEYS.OPENING_BATCHES);
            const list = data ? JSON.parse(data) : [];
            return list.sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));
        } catch (e) {
            console.error('خطأ في جلب دفعات الأرصدة الافتتاحية:', e);
            return [];
        }
    }

    saveOpeningBatches(batches) {
        this._persistKey(STORAGE_KEYS.OPENING_BATCHES, batches);
    }

    getOpeningBatchById(id) {
        const batches = this.getOpeningBatches();
        return batches.find(b => b.id === id) || null;
    }

    getNextOpeningBatchId() {
        const batches = this.getOpeningBatches();
        let maxSeq = batches.length + 1;
        batches.forEach(b => {
            const num = parseInt(String(b.id).replace(/\D/g, ''));
            if (num && num >= maxSeq) maxSeq = num + 1;
        });
        return `OP-BATCH-${String(maxSeq).padStart(3, '0')}`;
    }

    addOpeningBatch(batchData) {
        const batches = this.getOpeningBatches();
        const nextId = batchData.id || this.getNextOpeningBatchId();

        const newBatch = {
            id: nextId,
            date: batchData.date || new Date().toISOString().split('T')[0],
            warehouseId: batchData.warehouseId,
            items: batchData.items || [],
            totalQuantity: parseFloat(batchData.totalQuantity) || 0,
            totalCost: parseFloat(batchData.totalCost) || 0,
            notes: batchData.notes || 'رصيد افتتاحي لبضاعة أول المدة',
            journalEntryId: batchData.journalEntryId || null,
            createdAt: new Date().toISOString()
        };

        batches.push(newBatch);
        this.saveOpeningBatches(batches);
        return newBatch;
    }

    deleteOpeningBatch(id) {
        const batches = this.getOpeningBatches();
        const batch = batches.find(b => b.id === id);
        if (!batch) throw new Error('دفعة الرصيد الافتتاحي غير موجودة!');

        if (batch.journalEntryId) {
            try { this.deleteEntry(batch.journalEntryId); } catch (e) {}
        }

        // حذف حركات المخزون المرتبطة بالدفعة الافتتاحية
        const txs = this.getInventoryTransactions();
        const remainingTxs = txs.filter(t => 
            t.reference !== batch.id &&
            !(batch.journalEntryId && (t.journalEntryId === batch.journalEntryId || t.reference === batch.journalEntryId))
        );
        if (remainingTxs.length !== txs.length) {
            this.saveInventoryTransactions(remainingTxs);
        }

        const filtered = batches.filter(b => b.id !== id);
        this.saveOpeningBatches(filtered);
        return true;
    }

    // ==================== إدارة العملاء والموردين والديون ====================
    getParties() {
        try {
            const data = localStorage.getItem(STORAGE_KEYS.PARTIES);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            return [];
        }
    }

    saveParties(parties) {
        this._persistKey(STORAGE_KEYS.PARTIES, parties);
    }

    getPartyById(idOrName) {
        const parties = this.getParties();
        return parties.find(p => p.id === idOrName || p.name === idOrName) || null;
    }

    addParty(partyData) {
        const parties = this.getParties();
        const isCustomer = partyData.type !== 'SUPPLIER';
        const cleanName = (partyData.name || '').trim();
        if (!cleanName) throw new Error('يرجى إدخال اسم العميل أو المورد!');

        const prefix = isCustomer ? 'CUS' : 'SUP';
        let maxSeq = 101;
        parties.forEach(p => {
            const num = parseInt(String(p.id).replace(/\D/g, ''));
            if (num && num >= maxSeq) maxSeq = num + 1;
        });

        const nextId = partyData.id || `${prefix}-${maxSeq}`;
        const openingBal = parseFloat(partyData.openingBalance) || 0;
        let openingEntryId = null;

        if (openingBal > 0) {
            const jv = this.addEntry({
                date: new Date().toISOString().split('T')[0],
                description: `رصيد افتتاحي (${isCustomer ? 'عميل' : 'مورد'}): ${cleanName}`,
                reference: nextId,
                lines: isCustomer
                    ? [
                        { accountCode: '1103', debit: openingBal, credit: 0, note: `رصيد أول المدة للعميل (${cleanName})` },
                        { accountCode: '3101', debit: 0, credit: openingBal, note: `مقابل رصيد افتتاحي للعميل (${cleanName})` }
                    ]
                    : [
                        { accountCode: '3101', debit: openingBal, credit: 0, note: `مقابل رصيد افتتاحي للمورد (${cleanName})` },
                        { accountCode: '2101', debit: 0, credit: openingBal, note: `رصيد أول المدة للمورد (${cleanName})` }
                    ]
            });
            openingEntryId = jv.id;
        }

        const newParty = {
            id: nextId,
            name: cleanName,
            type: isCustomer ? 'CUSTOMER' : 'SUPPLIER', // 'CUSTOMER' or 'SUPPLIER'
            phone: partyData.phone || '',
            address: partyData.address || '',
            openingBalance: openingBal,
            openingEntryId,
            notes: partyData.notes || '',
            createdAt: new Date().toISOString()
        };

        parties.push(newParty);
        this.saveParties(parties);
        return newParty;
    }

    updateParty(id, updatedFields) {
        const parties = this.getParties();
        const idx = parties.findIndex(p => p.id === id);
        if (idx === -1) throw new Error('العميل / المورد غير موجود!');

        const oldParty = parties[idx];
        const newType = updatedFields.type || oldParty.type;
        const isCustomer = newType !== 'SUPPLIER';
        const cleanName = (updatedFields.name ?? oldParty.name ?? '').trim();
        const newOpening = parseFloat(updatedFields.openingBalance ?? oldParty.openingBalance) || 0;

        // تحديث قيد الرصيد الافتتاحي إن تغير
        let openingEntryId = oldParty.openingEntryId || null;
        if (openingEntryId) {
            try { this.deleteEntry(openingEntryId); } catch (e) {}
            openingEntryId = null;
        }
        if (newOpening > 0) {
            const jv = this.addEntry({
                date: (oldParty.createdAt || '').split('T')[0] || new Date().toISOString().split('T')[0],
                description: `رصيد افتتاحي (${isCustomer ? 'عميل' : 'مورد'}): ${cleanName}`,
                reference: oldParty.id,
                lines: isCustomer
                    ? [
                        { accountCode: '1103', debit: newOpening, credit: 0, note: `رصيد أول المدة للعميل (${cleanName})` },
                        { accountCode: '3101', debit: 0, credit: newOpening, note: `مقابل رصيد افتتاحي للعميل (${cleanName})` }
                    ]
                    : [
                        { accountCode: '3101', debit: newOpening, credit: 0, note: `مقابل رصيد افتتاحي للمورد (${cleanName})` },
                        { accountCode: '2101', debit: 0, credit: newOpening, note: `رصيد أول المدة للمورد (${cleanName})` }
                    ]
            });
            openingEntryId = jv.id;
        }

        parties[idx] = {
            ...oldParty,
            ...updatedFields,
            name: cleanName,
            type: newType,
            openingBalance: newOpening,
            openingEntryId,
            updatedAt: new Date().toISOString()
        };
        this.saveParties(parties);

        // تحديث اسم العميل أو المورد تلقائياً في الفواتير والسندات المرتبطة به عند تعديل الاسم
        if (oldParty.name && cleanName && oldParty.name !== cleanName) {
            const invoices = this.getInvoices();
            let invChanged = false;
            invoices.forEach(inv => {
                if ((inv.partyName || '').trim() === oldParty.name) {
                    inv.partyName = cleanName;
                    invChanged = true;
                }
            });
            if (invChanged) this.saveInvoices(invoices);

            const vouchers = this.getVouchers();
            let vchChanged = false;
            vouchers.forEach(v => {
                if (v.partyId === oldParty.id || (v.partyName || '').trim() === oldParty.name) {
                    v.partyName = cleanName;
                    vchChanged = true;
                }
            });
            if (vchChanged) this.saveVouchers(vouchers);
        }

        return parties[idx];
    }

    deleteParty(id) {
        const parties = this.getParties();
        const party = parties.find(p => p.id === id);
        if (!party) throw new Error('العميل / المورد غير موجود!');
        if (party.openingEntryId) {
            try { this.deleteEntry(party.openingEntryId); } catch (e) {}
        }
        const filtered = parties.filter(p => p.id !== id);
        this.saveParties(filtered);
        this.addAuditLog({
            actionType: 'DELETE',
            module: 'العملاء والموردين',
            reference: party.id,
            description: `حذف سجل ${party.type === 'SUPPLIER' ? 'المورد' : 'العميل'} (${party.name})`
        });
        return true;
    }

    isGenericPartyName(name) {
        const clean = (name || '').trim();
        if (!clean) return true;
        const generics = [
            'نقدي', 'عميل نقدي', 'عميل نقدي عام', 'زبون نقدي', 'مبيعات نقدية',
            'مورد عام', 'مورد نقدي', 'عميل', 'مستفيد', 'نقداً', 'كاش'
        ];
        return generics.includes(clean);
    }

    ensurePartyExists(name, type = 'CUSTOMER') {
        const cleanName = (name || '').trim();
        if (this.isGenericPartyName(cleanName)) return null;
        let existing = this.getPartyById(cleanName);
        if (!existing) {
            existing = this.addParty({ name: cleanName, type });
        }
        return existing;
    }

    // مزامنة تلقائية لأي عملاء أو موردين مسجلين في الفواتير أو السندات لضمان ظهورهم في شاشة العملاء والديون
    syncPartiesFromTransactions() {
        // تنظيف أي سجل وهمي باسم "نقدي" أو "عميل نقدي" بلا رصيد افتتاحي
        const currentParties = this.getParties();
        const cleanedParties = currentParties.filter(p => {
            if (this.isGenericPartyName(p.name) && !(parseFloat(p.openingBalance) > 0)) {
                return false;
            }
            return true;
        });
        if (cleanedParties.length !== currentParties.length) {
            this.saveParties(cleanedParties);
        }

        const invoices = this.getInvoices();
        invoices.forEach(inv => {
            const pName = (inv.partyName || '').trim();
            if (this.isGenericPartyName(pName)) return;
            const pType = (inv.type === 'PURCHASE' || inv.type === 'PURCHASE_RETURN') ? 'SUPPLIER' : 'CUSTOMER';
            this.ensurePartyExists(pName, pType);
        });

        const vouchers = this.getVouchers();
        vouchers.forEach(v => {
            const pName = (v.partyName || '').trim();
            if (this.isGenericPartyName(pName)) return;
            if (v.targetAccountCode === '1103') {
                this.ensurePartyExists(pName, 'CUSTOMER');
            } else if (v.targetAccountCode === '2101') {
                this.ensurePartyExists(pName, 'SUPPLIER');
            }
        });
    }

    // احتساب كشف حساب ورصيد عميل أو مورد بالتفصيل
    getPartyStatement(partyIdOrName) {
        const party = this.getPartyById(partyIdOrName);
        if (!party) return null;

        const invoices = this.getInvoices();
        const vouchers = this.getVouchers();
        const isCustomer = party.type === 'CUSTOMER';

        const movements = [];
        const openingBalance = parseFloat(party.openingBalance) || 0;

        // كافة الفواتير (النقدية والآجلة والمدفوعة جزئياً) والمرتجعات الخاصة بهذا الطرف
        invoices.forEach(inv => {
            if ((inv.partyName || '').trim() !== party.name) return;
            const amt = parseFloat(inv.totalAmount) || 0;
            const netPaid = inv.netPaidAmount !== undefined
                ? (parseFloat(inv.netPaidAmount) || 0)
                : (inv.paymentMethod === 'CREDIT' ? 0 : amt);
            const remAmt = inv.remainingAmount !== undefined
                ? (parseFloat(inv.remainingAmount) || 0)
                : (inv.paymentMethod === 'CREDIT' ? amt : 0);

            if (isCustomer) {
                if (inv.type === 'SALES') {
                    movements.push({
                        date: inv.date,
                        ref: inv.id,
                        typeLabel: remAmt === 0 ? 'فاتورة مبيعات (مسددة)' : (netPaid > 0 ? 'فاتورة مبيعات (دفع جزئي)' : 'فاتورة مبيعات آجلة'),
                        description: `فاتورة مبيعات (${inv.items ? inv.items.length : 0} أصناف) — الإجمالي: ${amt.toFixed(2)}`,
                        debit: amt, // على العميل
                        credit: 0
                    });
                    if (netPaid > 0) {
                        movements.push({
                            date: inv.date,
                            ref: inv.id,
                            typeLabel: 'المبلغ المستلم من العميل',
                            description: `المبلغ المستلم من العميل دفعة فورية على فاتورة ${inv.id}`,
                            debit: 0,
                            credit: netPaid // له (سداد)
                        });
                    }
                } else if (inv.type === 'SALES_RETURN') {
                    movements.push({
                        date: inv.date,
                        ref: inv.id,
                        typeLabel: inv.paymentMethod === 'CREDIT' ? 'مرتجع مبيعات آجل' : 'مرتجع مبيعات نقدي',
                        description: `مرتجع مبيعات رقم ${inv.id}`,
                        debit: 0,
                        credit: amt // له
                    });
                    if (inv.paymentMethod !== 'CREDIT') {
                        movements.push({
                            date: inv.date,
                            ref: inv.id,
                            typeLabel: 'رد قيمة المرتجع للعميل',
                            description: `رد قيمة مرتجع المبيعات ${inv.id} للعميل`,
                            debit: amt,
                            credit: 0
                        });
                    }
                }
            } else {
                // مورد
                if (inv.type === 'PURCHASE') {
                    movements.push({
                        date: inv.date,
                        ref: inv.id,
                        typeLabel: remAmt === 0 ? 'فاتورة مشتريات (مسددة)' : (netPaid > 0 ? 'فاتورة مشتريات (دفع جزئي)' : 'فاتورة مشتريات آجلة'),
                        description: `فاتورة مشتريات (${inv.items ? inv.items.length : 0} أصناف) — الإجمالي: ${amt.toFixed(2)}`,
                        debit: amt, // للمورد علينا
                        credit: 0
                    });
                    if (netPaid > 0) {
                        movements.push({
                            date: inv.date,
                            ref: inv.id,
                            typeLabel: 'المبلغ المدفوع للمورد',
                            description: `دفعة مسددة فورية للمورد على فاتورة ${inv.id}`,
                            debit: 0,
                            credit: netPaid
                        });
                    }
                } else if (inv.type === 'PURCHASE_RETURN') {
                    movements.push({
                        date: inv.date,
                        ref: inv.id,
                        typeLabel: inv.paymentMethod === 'CREDIT' ? 'مرتجع مشتريات آجل' : 'مرتجع مشتريات نقدي',
                        description: `مرتجع مشتريات رقم ${inv.id}`,
                        debit: 0,
                        credit: amt
                    });
                    if (inv.paymentMethod !== 'CREDIT') {
                        movements.push({
                            date: inv.date,
                            ref: inv.id,
                            typeLabel: 'استرداد قيمة المرتجع من المورد',
                            description: `استرداد قيمة مرتجع المشتريات ${inv.id} من المورد`,
                            debit: amt,
                            credit: 0
                        });
                    }
                }
            }
        });

        // السندات (قبض / صرف) المرتبطة بهذا الطرف
        vouchers.forEach(v => {
            if (v.partyId !== party.id && (v.partyName || '').trim() !== party.name) return;
            const amt = parseFloat(v.amount) || 0;
            if (isCustomer) {
                if (v.targetAccountCode && v.targetAccountCode !== '1103') return;
                if (v.type === 'RECEIPT') {
                    movements.push({
                        date: v.date,
                        ref: v.id,
                        typeLabel: 'سند قبض',
                        description: v.description || 'دفعة مسددة من العميل',
                        debit: 0,
                        credit: amt
                    });
                } else if (v.type === 'PAYMENT') {
                    movements.push({
                        date: v.date,
                        ref: v.id,
                        typeLabel: 'سند صرف للعميل',
                        description: v.description || 'دفعة مصروفة للعميل',
                        debit: amt,
                        credit: 0
                    });
                }
            } else {
                if (v.targetAccountCode && v.targetAccountCode !== '2101') return;
                if (v.type === 'PAYMENT') {
                    movements.push({
                        date: v.date,
                        ref: v.id,
                        typeLabel: 'سند صرف',
                        description: v.description || 'دفعة مسددة للمورد',
                        debit: 0,
                        credit: amt
                    });
                } else if (v.type === 'RECEIPT') {
                    movements.push({
                        date: v.date,
                        ref: v.id,
                        typeLabel: 'سند قبض من المورد',
                        description: v.description || 'دفعة مستردة من المورد',
                        debit: amt,
                        credit: 0
                    });
                }
            }
        });

        movements.sort((a, b) => new Date(a.date) - new Date(b.date));

        let totalInvoiced = 0;
        let totalReturned = 0;
        let totalPaid = 0;
        let invoicesCount = 0;

        invoices.forEach(inv => {
            if ((inv.partyName || '').trim() !== party.name) return;
            const amt = parseFloat(inv.totalAmount) || 0;
            const netPaid = inv.netPaidAmount !== undefined
                ? (parseFloat(inv.netPaidAmount) || 0)
                : (inv.paymentMethod === 'CREDIT' ? 0 : amt);
            if (isCustomer) {
                if (inv.type === 'SALES') {
                    totalInvoiced += amt;
                    totalPaid += netPaid;
                    invoicesCount++;
                }
                if (inv.type === 'SALES_RETURN') totalReturned += amt;
            } else {
                if (inv.type === 'PURCHASE') {
                    totalInvoiced += amt;
                    totalPaid += netPaid;
                    invoicesCount++;
                }
                if (inv.type === 'PURCHASE_RETURN') totalReturned += amt;
            }
        });

        vouchers.forEach(v => {
            if (v.partyId !== party.id && (v.partyName || '').trim() !== party.name) return;
            const amt = parseFloat(v.amount) || 0;
            if (isCustomer && (!v.targetAccountCode || v.targetAccountCode === '1103') && v.type === 'RECEIPT') {
                totalPaid += amt;
            } else if (!isCustomer && (!v.targetAccountCode || v.targetAccountCode === '2101') && v.type === 'PAYMENT') {
                totalPaid += amt;
            }
        });

        let running = openingBalance;
        let totalDebit = openingBalance > 0 ? openingBalance : 0;
        let totalCredit = openingBalance < 0 ? Math.abs(openingBalance) : 0;
        const rows = movements.map(m => {
            totalDebit += m.debit;
            totalCredit += m.credit;
            running += (m.debit - m.credit);
            return {
                ...m,
                docId: m.ref,
                increase: m.debit,
                decrease: m.credit,
                runningBalance: running
            };
        });

        // احتساب عمر الدين بطريقة الوارد أولاً يسدد أولاً (FIFO) لأقدم ذمة غير مسددة
        let daysOverdue = 0;
        let oldestUnpaidDate = (party.createdAt || '').split('T')[0] || new Date().toISOString().split('T')[0];
        if (running > 0.009) {
            let cumDebit = openingBalance > 0 ? openingBalance : 0;
            if (cumDebit <= totalCredit + 0.009) {
                for (const m of rows) {
                    if (m.debit > 0) {
                        cumDebit += m.debit;
                        if (cumDebit > totalCredit + 0.009) {
                            oldestUnpaidDate = m.date;
                            break;
                        }
                    }
                }
            }
            const refMs = new Date(oldestUnpaidDate).getTime() || Date.now();
            daysOverdue = Math.max(0, Math.floor((Date.now() - refMs) / 86400000));
        }

        const allMovements = [];
        if (openingBalance !== 0) {
            allMovements.push({
                date: (party.createdAt || '').split('T')[0] || '2026-01-01',
                ref: 'OP-BAL',
                docId: 'OP-BAL',
                typeLabel: 'رصيد افتتاحي',
                description: 'رصيد أول المدة',
                debit: openingBalance > 0 ? openingBalance : 0,
                credit: openingBalance < 0 ? Math.abs(openingBalance) : 0,
                increase: openingBalance > 0 ? openingBalance : 0,
                decrease: openingBalance < 0 ? Math.abs(openingBalance) : 0,
                runningBalance: openingBalance
            });
        }
        allMovements.push(...rows);

        return {
            party,
            openingBalance,
            totalInvoiced,
            totalReturned,
            totalPaid,
            invoicesCount,
            totalDebit,
            totalCredit,
            closingBalance: running,
            daysOverdue,
            oldestUnpaidDate,
            lastActivityDate: rows.length > 0 ? rows[rows.length - 1].date : ((party.createdAt || '').split('T')[0] || ''),
            movements: allMovements,
            rows
        };
    }

    // تحليل أعمار الديون والتأخر في السداد للعملاء والموردين (Debt Aging & Reminders)
    getDebtAgingReport() {
        const parties = this.getParties();
        const customerDebts = [];
        const supplierDebts = [];

        parties.forEach(p => {
            const stmt = this.getPartyStatement(p.id);
            const balance = stmt ? stmt.closingBalance : (parseFloat(p.openingBalance) || 0);
            if (balance <= 0.009) return;

            const daysOverdue = stmt ? stmt.daysOverdue : 0;
            const refDateStr = stmt ? stmt.oldestUnpaidDate : ((p.createdAt || '').split('T')[0] || new Date().toISOString().split('T')[0]);

            let status = 'CURRENT'; // 0-14 يوم
            let statusLabel = '🟢 حديث (أقل من 15 يوم)';
            if (daysOverdue >= 30) {
                status = 'CRITICAL';
                statusLabel = `🔴 متأخر جداً (${daysOverdue} يوم)`;
            } else if (daysOverdue >= 15) {
                status = 'WARNING';
                statusLabel = `🟡 مستحق المتابعة (${daysOverdue} يوم)`;
            }

            const item = {
                party: p,
                balance,
                daysOverdue,
                lastInvoiceDate: refDateStr,
                status,
                statusLabel
            };

            if (p.type === 'SUPPLIER') {
                supplierDebts.push(item);
            } else {
                customerDebts.push(item);
            }
        });

        customerDebts.sort((a, b) => b.daysOverdue - a.daysOverdue || b.balance - a.balance);
        supplierDebts.sort((a, b) => b.daysOverdue - a.daysOverdue || b.balance - a.balance);

        return {
            customerDebts,
            supplierDebts,
            overdueCustomersCount: customerDebts.filter(c => c.daysOverdue >= 15).length,
            criticalCustomersCount: customerDebts.filter(c => c.daysOverdue >= 30).length,
            totalCustomerDebt: customerDebts.reduce((s, c) => s + c.balance, 0),
            totalSupplierDebt: supplierDebts.reduce((s, c) => s + c.balance, 0)
        };
    }

    // ==================== إدارة سندات القبض وسندات الصرف ====================
    getVouchers() {
        try {
            const data = localStorage.getItem(STORAGE_KEYS.VOUCHERS);
            const list = data ? JSON.parse(data) : [];
            return list.sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));
        } catch (e) {
            return [];
        }
    }

    saveVouchers(vouchers) {
        this._persistKey(STORAGE_KEYS.VOUCHERS, vouchers);
    }

    getVoucherById(id) {
        const vouchers = this.getVouchers();
        return vouchers.find(v => v.id === id) || null;
    }

    getNextVoucherNumber(type = 'RECEIPT') {
        const vouchers = this.getVouchers();
        const prefix = type === 'RECEIPT' ? 'RV' : 'PV';
        const filtered = vouchers.filter(v => v.type === type || (v.id && v.id.startsWith(prefix)));
        let nextSeq = 1001;
        filtered.forEach(v => {
            const num = parseInt(String(v.id).replace(/\D/g, ''));
            if (num && num >= nextSeq) nextSeq = num + 1;
        });
        return `${prefix}-${nextSeq}`;
    }

    addVoucher(voucherData) {
        const vouchers = this.getVouchers();
        const type = voucherData.type || 'RECEIPT'; // 'RECEIPT' or 'PAYMENT'
        const nextId = voucherData.id || this.getNextVoucherNumber(type);
        const amount = parseFloat(voucherData.amount) || 0;
        if (amount <= 0) throw new Error('يجب أن يكون مبلغ السند أكبر من الصفر');

        const date = voucherData.date || new Date().toISOString().split('T')[0];
        const payMethod = voucherData.paymentMethod || 'CASH'; // 'CASH' or 'BANK'
        const cashOrBankCode = payMethod === 'BANK' ? '1102' : '1101';
        const targetAccCode = voucherData.targetAccountCode || (type === 'RECEIPT' ? '1103' : '2101');
        const partyName = (voucherData.partyName || '').trim() || (type === 'RECEIPT' ? 'عميل' : 'مستفيد');
        let resolvedPartyId = voucherData.partyId || null;
        if (!resolvedPartyId && (targetAccCode === '1103' || targetAccCode === '2101')) {
            const pObj = this.ensurePartyExists(partyName, targetAccCode === '1103' ? 'CUSTOMER' : 'SUPPLIER');
            if (pObj) resolvedPartyId = pObj.id;
        }

        // توليد القيد المحاسبي للسند تلقائياً
        const lines = type === 'RECEIPT'
            ? [
                { accountCode: cashOrBankCode, debit: amount, credit: 0, note: `قبض بموجب سند قبض رقم ${nextId} من (${partyName})` },
                { accountCode: targetAccCode, debit: 0, credit: amount, note: voucherData.description || `سداد دفعة من (${partyName}) - سند ${nextId}` }
            ]
            : [
                { accountCode: targetAccCode, debit: amount, credit: 0, note: voucherData.description || `صرف دفعة إلى (${partyName}) - سند ${nextId}` },
                { accountCode: cashOrBankCode, debit: 0, credit: amount, note: `صرف بموجب سند صرف رقم ${nextId} إلى (${partyName})` }
            ];

        const jv = this.addEntry({
            date,
            description: `${type === 'RECEIPT' ? 'سند قبض' : 'سند صرف'} رقم ${nextId} - ${partyName}: ${voucherData.description || ''}`,
            reference: nextId,
            lines
        });

        const newVoucher = {
            id: nextId,
            type,
            date,
            amount,
            paymentMethod: payMethod,
            partyId: resolvedPartyId,
            partyName,
            targetAccountCode: targetAccCode,
            reference: voucherData.reference || '',
            description: voucherData.description || (type === 'RECEIPT' ? `دفعة مقبوضة من ${partyName}` : `دفعة مصروفة إلى ${partyName}`),
            journalEntryId: jv.id,
            createdAt: new Date().toISOString()
        };

        vouchers.push(newVoucher);
        this.saveVouchers(vouchers);
        this.addAuditLog({
            actionType: 'CREATE',
            module: 'السندات المالية',
            reference: newVoucher.id,
            description: `إصدار ${type === 'RECEIPT' ? 'سند قبض' : 'سند صرف'} (${newVoucher.id}) بمبلغ ${amount.toFixed(2)} — الطرف: ${partyName}`
        });
        return newVoucher;
    }

    deleteVoucher(id) {
        const vouchers = this.getVouchers();
        const v = vouchers.find(x => x.id === id);
        if (!v) throw new Error('السند غير موجود!');
        if (v.journalEntryId) {
            try { this.deleteEntry(v.journalEntryId); } catch (e) {}
        }
        this.saveVouchers(vouchers.filter(x => x.id !== id));
        this.addAuditLog({
            actionType: 'DELETE',
            module: 'السندات المالية',
            reference: v.id,
            description: `حذف السند (${v.id}) بقيمة ${parseFloat(v.amount || 0).toFixed(2)}`
        });
        return true;
    }

    // ==================== إدارة عروض الأسعار (Quotations) ====================
    getQuotations() {
        try {
            const data = localStorage.getItem(STORAGE_KEYS.QUOTATIONS);
            const list = data ? JSON.parse(data) : [];
            return list.sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));
        } catch (e) {
            return [];
        }
    }

    saveQuotations(quotations) {
        this._persistKey(STORAGE_KEYS.QUOTATIONS, quotations);
    }

    getQuotationById(id) {
        return this.getQuotations().find(q => q.id === id) || null;
    }

    getNextQuotationNumber() {
        const list = this.getQuotations();
        let nextSeq = 1001;
        list.forEach(q => {
            const num = parseInt(String(q.id).replace(/\D/g, ''));
            if (num && num >= nextSeq) nextSeq = num + 1;
        });
        return `QT-${nextSeq}`;
    }

    addQuotation(data) {
        const list = this.getQuotations();
        const nextId = data.id || this.getNextQuotationNumber();
        const items = (data.items || []).filter(i => i.productId && (parseFloat(i.quantity) || 0) > 0).map(item => {
            const prod = this.getProductById(item.productId);
            const qty = parseFloat(item.quantity) || 0;
            const price = parseFloat(item.unitPrice) || 0;
            return {
                productId: item.productId,
                sku: prod ? prod.sku : '',
                productName: prod ? prod.name : (item.productName || ''),
                unit: prod ? prod.unit : '',
                quantity: qty,
                unitPrice: price,
                total: qty * price
            };
        });

        if (items.length === 0) {
            throw new Error('يرجى إضافة صنف واحد على الأقل إلى عرض السعر');
        }

        const subtotal = items.reduce((s, i) => s + i.total, 0);
        const discount = Math.min(parseFloat(data.discount) || 0, subtotal);
        const afterDisc = Math.max(subtotal - discount, 0);
        const taxRate = parseFloat(data.taxRate) || 0;
        const taxAmount = (afterDisc * taxRate) / 100;
        const totalAmount = afterDisc + taxAmount;

        const partyName = (data.partyName || '').trim() || 'عميل محتمل';
        this.ensurePartyExists(partyName, 'CUSTOMER');

        const newQt = {
            id: nextId,
            date: data.date || new Date().toISOString().split('T')[0],
            validUntil: data.validUntil || '',
            partyName,
            warehouseId: data.warehouseId || 'WH-01',
            items,
            subtotal,
            discount,
            taxRate,
            taxAmount,
            totalAmount,
            notes: data.notes || '',
            status: 'PENDING',
            convertedInvoiceId: null,
            createdAt: new Date().toISOString()
        };

        list.push(newQt);
        this.saveQuotations(list);
        return newQt;
    }

    updateQuotation(id, patch) {
        const list = this.getQuotations();
        const idx = list.findIndex(q => q.id === id);
        if (idx === -1) throw new Error('عرض السعر غير موجود');
        list[idx] = { ...list[idx], ...patch };
        this.saveQuotations(list);
        return list[idx];
    }

    deleteQuotation(id) {
        const list = this.getQuotations();
        this.saveQuotations(list.filter(q => q.id !== id));
        this.addAuditLog({
            actionType: 'DELETE',
            module: 'عروض الأسعار',
            reference: id,
            description: `حذف عرض السعر رقم (${id})`
        });
        return true;
    }

    // ==================== إدارة المصروفات التشغيلية اليومية (Quick Expenses) ====================
    getExpenses() {
        try {
            const data = localStorage.getItem(STORAGE_KEYS.EXPENSES);
            const list = data ? JSON.parse(data) : [];
            return list.sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));
        } catch (e) {
            return [];
        }
    }

    saveExpenses(expenses) {
        this._persistKey(STORAGE_KEYS.EXPENSES, expenses);
    }

    getNextExpenseNumber() {
        const list = this.getExpenses();
        let nextSeq = 1001;
        list.forEach(ex => {
            const num = parseInt(String(ex.id).replace(/\D/g, ''));
            if (num && num >= nextSeq) nextSeq = num + 1;
        });
        return `EXP-${nextSeq}`;
    }

    addExpense(data) {
        const list = this.getExpenses();
        const nextId = data.id || this.getNextExpenseNumber();
        const amount = parseFloat(data.amount) || 0;
        if (amount <= 0) throw new Error('يجب أن يكون مبلغ المصروف أكبر من الصفر');

        const date = data.date || new Date().toISOString().split('T')[0];
        const categoryId = data.categoryId || 'OTHER';
        const catObj = (typeof EXPENSE_CATEGORIES !== 'undefined' ? EXPENSE_CATEGORIES : []).find(c => c.id === categoryId) || { id: 'OTHER', name: 'مصاريف تشغيلية', accountCode: '5104' };
        const expenseAccCode = data.accountCode || catObj.accountCode || '5104';
        const payMethod = data.paymentMethod || 'CASH'; // 'CASH' or 'BANK'
        const cashOrBankCode = payMethod === 'BANK' ? '1102' : '1101';
        const beneficiary = (data.beneficiary || '').trim() || 'مصروف تشغيلي عام';
        const description = (data.description || '').trim() || `${catObj.name} - ${beneficiary}`;

        // توليد القيد المحاسبي التلقائي للمصروف
        const jv = this.addEntry({
            date,
            description: `مصروف تشغيلي (${nextId}) - ${catObj.name}: ${description}`,
            reference: nextId,
            lines: [
                {
                    accountCode: expenseAccCode,
                    debit: amount,
                    credit: 0,
                    note: `إثبات مصروف (${catObj.name}) — المستفيد: ${beneficiary} — ${description}`
                },
                {
                    accountCode: cashOrBankCode,
                    debit: 0,
                    credit: amount,
                    note: `سداد مصروف (${nextId}) ${payMethod === 'BANK' ? 'من الحساب البنكي' : 'نقداً من الصندوق'}`
                }
            ]
        });

        const newExp = {
            id: nextId,
            date,
            categoryId,
            categoryName: catObj.name,
            accountCode: expenseAccCode,
            paymentMethod: payMethod,
            amount,
            beneficiary,
            description,
            reference: data.reference || '',
            journalEntryId: jv.id,
            createdAt: new Date().toISOString()
        };

        list.push(newExp);
        this.saveExpenses(list);
        this.addAuditLog({
            actionType: 'CREATE',
            module: 'المصروفات اليومية',
            reference: newExp.id,
            description: `تسجيل مصروف (${newExp.categoryName}) بمبلغ ${amount.toFixed(2)} إلى (${beneficiary})`
        });
        return newExp;
    }

    deleteExpense(id) {
        const list = this.getExpenses();
        const exp = list.find(e => e.id === id);
        if (!exp) throw new Error('سجل المصروف غير موجود!');
        if (exp.journalEntryId) {
            try { this.deleteEntry(exp.journalEntryId); } catch (e) {}
        }
        this.saveExpenses(list.filter(e => e.id !== id));
        this.addAuditLog({
            actionType: 'DELETE',
            module: 'المصروفات اليومية',
            reference: exp.id,
            description: `حذف المصروف (${exp.id}) بقيمة ${parseFloat(exp.amount || 0).toFixed(2)}`
        });
        return true;
    }

    // ==================== سجل الرقابة والتدقيق الأمني (Audit Log) ====================
    getAuditLogs() {
        try {
            const data = localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS);
            const list = data ? JSON.parse(data) : [];
            return list.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        } catch (e) {
            return [];
        }
    }

    saveAuditLogs(logs) {
        // الاحتفاظ بآخر 500 عملية رقابية كحد أقصى للحفاظ على سرعة الأداء
        const trimmed = (logs || []).slice(0, 500);
        this._persistKey(STORAGE_KEYS.AUDIT_LOGS, trimmed);
    }

    addAuditLog(logData) {
        try {
            const logs = this.getAuditLogs();
            const newLog = {
                id: `AUD-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`,
                timestamp: new Date().toISOString(),
                actionType: logData.actionType || 'INFO', // 'CREATE', 'UPDATE', 'DELETE', 'SECURITY'
                module: logData.module || 'النظام',
                reference: logData.reference || '-',
                description: logData.description || ''
            };
            logs.unshift(newLog);
            this.saveAuditLogs(logs);
            return newLog;
        } catch (e) {
            return null;
        }
    }

    // ==================== حركة الخزينة والصندوق اليومي وتقفيل الوردية (Cash Drawer) ====================
    getDailyCashDrawerReport(targetDate = null) {
        const dateStr = targetDate || new Date().toISOString().split('T')[0];
        const entries = this.getEntries();
        // فرز تصاعدي
        const sorted = [...entries].sort((a, b) => new Date(a.date) - new Date(b.date));

        let cashOpening = 0;
        let bankOpening = 0;
        let cashInToday = 0;
        let cashOutToday = 0;
        let bankInToday = 0;
        let bankOutToday = 0;

        const todayMovements = [];

        sorted.forEach(entry => {
            const isBefore = entry.date < dateStr;
            const isToday = entry.date === dateStr;

            (entry.lines || []).forEach(line => {
                const debit = parseFloat(line.debit) || 0;
                const credit = parseFloat(line.credit) || 0;
                if (line.accountCode === '1101') {
                    if (isBefore) {
                        cashOpening += (debit - credit);
                    } else if (isToday) {
                        cashInToday += debit;
                        cashOutToday += credit;
                        todayMovements.push({
                            entryId: entry.id,
                            date: entry.date,
                            time: entry.createdAt ? new Date(entry.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : '-',
                            accountCode: '1101',
                            accountName: 'الصندوق النقدي (كاش)',
                            reference: entry.reference || entry.id,
                            description: line.note || entry.description,
                            cashIn: debit,
                            cashOut: credit
                        });
                    }
                } else if (line.accountCode === '1102') {
                    if (isBefore) {
                        bankOpening += (debit - credit);
                    } else if (isToday) {
                        bankInToday += debit;
                        bankOutToday += credit;
                        todayMovements.push({
                            entryId: entry.id,
                            date: entry.date,
                            time: entry.createdAt ? new Date(entry.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : '-',
                            accountCode: '1102',
                            accountName: 'البنك / البطاقة',
                            reference: entry.reference || entry.id,
                            description: line.note || entry.description,
                            cashIn: debit,
                            cashOut: credit
                        });
                    }
                }
            });
        });

        const cashClosing = cashOpening + cashInToday - cashOutToday;
        const bankClosing = bankOpening + bankInToday - bankOutToday;

        return {
            date: dateStr,
            cashOpening,
            cashInToday,
            cashOutToday,
            cashNetToday: cashInToday - cashOutToday,
            cashClosing,
            bankOpening,
            bankInToday,
            bankOutToday,
            bankClosing,
            totalLiquidityClosing: cashClosing + bankClosing,
            movements: todayMovements
        };
    }

    // ==================== إدارة محاضر الجرد الفعلي السريع (Stocktaking Sheets) ====================
    getStocktakingSheets() {
        try {
            const data = localStorage.getItem(STORAGE_KEYS.STOCKTAKING_SHEETS);
            const list = data ? JSON.parse(data) : [];
            return list.sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));
        } catch (e) {
            return [];
        }
    }

    saveStocktakingSheets(sheets) {
        this._persistKey(STORAGE_KEYS.STOCKTAKING_SHEETS, sheets);
    }

    getStocktakingSheetById(id) {
        return this.getStocktakingSheets().find(s => s.id === id) || null;
    }

    getNextStocktakingNumber() {
        const list = this.getStocktakingSheets();
        let nextSeq = 1001;
        list.forEach(s => {
            const num = parseInt(String(s.id).replace(/\D/g, ''));
            if (num && num >= nextSeq) nextSeq = num + 1;
        });
        return `ST-${nextSeq}`;
    }

    addStocktakingSheet(sheetObj) {
        const list = this.getStocktakingSheets();
        list.push(sheetObj);
        this.saveStocktakingSheets(list);
        return sheetObj;
    }

    deleteStocktakingSheet(id) {
        const list = this.getStocktakingSheets();
        const sheet = list.find(s => s.id === id);
        if (!sheet) throw new Error('محضر الجرد غير موجود!');
        if (Array.isArray(sheet.transactionIds)) {
            sheet.transactionIds.forEach(txId => {
                try { this.deleteInventoryTransaction(txId); } catch (e) {}
            });
        }
        if (sheet.journalEntryId) {
            try { this.deleteEntry(sheet.journalEntryId); } catch (e) {}
        }
        this.saveStocktakingSheets(list.filter(s => s.id !== id));
        this.addAuditLog({
            actionType: 'DELETE',
            module: 'الجرد الفعلي السريع',
            reference: id,
            description: `حذف محضر الجرد (${id}) وإلغاء التسويات المرتبطة به`
        });
        return true;
    }

    // ==================== إدارة خطط الأقساط وجدولة الديون (Installments & Payment Plans) ====================
    getInstallmentPlans() {
        try {
            const data = localStorage.getItem(STORAGE_KEYS.INSTALLMENT_PLANS);
            const list = data ? JSON.parse(data) : [];
            return list.sort((a, b) => new Date(b.createdAt || b.startDate) - new Date(a.createdAt || a.startDate));
        } catch (e) {
            return [];
        }
    }

    saveInstallmentPlans(plans) {
        this._persistKey(STORAGE_KEYS.INSTALLMENT_PLANS, plans);
    }

    getInstallmentPlanById(id) {
        return this.getInstallmentPlans().find(p => p.id === id) || null;
    }

    getNextInstallmentPlanNumber() {
        const list = this.getInstallmentPlans();
        let nextSeq = 1001;
        list.forEach(p => {
            const num = parseInt(String(p.id).replace(/\D/g, ''));
            if (num && num >= nextSeq) nextSeq = num + 1;
        });
        return `INS-${nextSeq}`;
    }

    addInstallmentPlan(planData) {
        const partyName = (planData.partyName || '').trim();
        if (!partyName) throw new Error('يرجى تحديد اسم العميل صاحب خطة التقسيط');
        const totalAmount = parseFloat(planData.totalAmount) || 0;
        const downPayment = Math.max(0, parseFloat(planData.downPayment) || 0);
        const financedAmount = Number((totalAmount - downPayment).toFixed(2));
        if (financedAmount <= 0) throw new Error('يجب أن يكون المبلغ المتبقي للتقسيط أكبر من الصفر');

        const count = Math.max(1, parseInt(planData.installmentsCount ?? planData.installmentCount) || 1);
        const frequency = planData.frequency || 'MONTHLY'; // 'MONTHLY' | 'WEEKLY' | 'BIWEEKLY'
        const startDate = planData.startDate || new Date().toISOString().split('T')[0];
        const planId = planData.id || this.getNextInstallmentPlanNumber();

        const party = this.ensurePartyExists(partyName, 'CUSTOMER');

        // إذا طلب المستخدم تسجيل أصل المديونية كقيد ذمة على العميل (في حال لم تكن مرتبطة بفاتورة سابقة)
        let debtEntryId = null;
        if (planData.createDebtEntry) {
            const jv = this.addEntry({
                date: startDate,
                description: `إثبات مديونية عقد بيع بالتقسيط رقم (${planId}) للعميل: ${partyName} — ${planData.title || ''}`,
                reference: planId,
                lines: [
                    { accountCode: '1103', debit: totalAmount, credit: 0, note: `إجمالي عقد التقسيط (${planId}) - ${partyName}` },
                    { accountCode: '4101', debit: 0, credit: totalAmount, note: `مبيعات بالتقسيط بموجب العقد (${planId})` }
                ]
            });
            debtEntryId = jv.id;
        }

        // إذا كان هناك دفعة مقدمة وطلب تسجيل سند قبض فوري لها
        let downPaymentVoucherId = null;
        if (downPayment > 0 && planData.recordDownPaymentVoucher !== false) {
            const vch = this.addVoucher({
                type: 'RECEIPT',
                partyName,
                date: startDate,
                amount: downPayment,
                paymentMethod: planData.paymentMethod || 'CASH',
                targetAccountCode: '1103',
                reference: planId,
                description: `دفعة مقدمة لعقد التقسيط رقم (${planId}) — ${planData.title || ''}`
            });
            downPaymentVoucherId = vch.id;
        }

        // توليد جدول الأقساط الدورية بدقة محاسبية
        const baseInstAmt = Math.floor((financedAmount / count) * 100) / 100;
        const installments = [];
        let accumulated = 0;
        const baseDateObj = new Date(startDate);

        for (let i = 1; i <= count; i++) {
            const dueObj = new Date(baseDateObj.getTime());
            if (frequency === 'WEEKLY') {
                dueObj.setDate(dueObj.getDate() + (i * 7));
            } else if (frequency === 'BIWEEKLY') {
                dueObj.setDate(dueObj.getDate() + (i * 14));
            } else {
                dueObj.setMonth(dueObj.getMonth() + i);
            }
            const dueDateStr = dueObj.toISOString().split('T')[0];
            const amt = (i === count) ? Number((financedAmount - accumulated).toFixed(2)) : baseInstAmt;
            accumulated = Number((accumulated + amt).toFixed(2));

            installments.push({
                number: i,
                dueDate: dueDateStr,
                amount: amt,
                paidAmount: 0,
                status: 'PENDING', // 'PENDING' | 'PAID'
                paidDate: null,
                voucherId: null,
                note: ''
            });
        }

        const newPlan = {
            id: planId,
            partyId: party ? party.id : null,
            partyName,
            partyPhone: planData.partyPhone || (party ? party.phone : '') || '',
            title: (planData.title || 'عقد تقسيط بضاعة / فاتورة').trim(),
            invoiceId: (planData.invoiceId || '').trim(),
            startDate,
            frequency,
            totalAmount,
            downPayment,
            financedAmount,
            paidAmount: downPayment,
            paidInstallmentsTotal: 0,
            remainingAmount: financedAmount,
            installmentsCount: count,
            installmentCount: count,
            status: financedAmount <= 0.009 ? 'COMPLETED' : 'ACTIVE',
            installments,
            debtEntryId,
            downPaymentVoucherId,
            notes: (planData.notes || '').trim(),
            createdAt: new Date().toISOString()
        };

        const plans = this.getInstallmentPlans();
        plans.push(newPlan);
        this.saveInstallmentPlans(plans);
        this.addAuditLog({
            actionType: 'CREATE',
            module: 'نظام الأقساط',
            reference: newPlan.id,
            description: `إنشاء خطة تقسيط (${newPlan.id}) للعميل (${partyName}) بصافي مقسط ${financedAmount.toFixed(2)} على (${count}) أقساط`
        });
        return newPlan;
    }

    payInstallment(planIdOrObj, installmentNumber, paymentMethod = 'CASH') {
        let planId = planIdOrObj;
        if (planIdOrObj && typeof planIdOrObj === 'object') {
            planId = planIdOrObj.planId;
            installmentNumber = planIdOrObj.installmentNumber;
            paymentMethod = planIdOrObj.paymentMethod || 'CASH';
        }
        const plans = this.getInstallmentPlans();
        const pIdx = plans.findIndex(p => p.id === planId);
        if (pIdx === -1) throw new Error('خطة التقسيط غير موجودة');

        const plan = plans[pIdx];
        const inst = (plan.installments || []).find(x => Number(x.number) === Number(installmentNumber));
        if (!inst) throw new Error('القسط المحدد غير موجود');
        if (inst.status === 'PAID') throw new Error('هذا القسط مسدد مسبقاً');

        const remainingInstAmt = Number((inst.amount - (inst.paidAmount || 0)).toFixed(2));
        const today = new Date().toISOString().split('T')[0];

        const voucher = this.addVoucher({
            type: 'RECEIPT',
            partyName: plan.partyName,
            date: today,
            amount: remainingInstAmt,
            paymentMethod: paymentMethod || 'CASH',
            targetAccountCode: '1103',
            reference: `${plan.id}-Q${inst.number}`,
            description: `تحصيل القسط رقم (${inst.number} من ${plan.installmentsCount || plan.installmentCount}) — عقد تقسيط (${plan.id}: ${plan.title})`
        });

        inst.paidAmount = inst.amount;
        inst.status = 'PAID';
        inst.paidDate = today;
        inst.voucherId = voucher.id;

        plan.paidInstallmentsTotal = Number(
            plan.installments.reduce((sum, item) => sum + (parseFloat(item.paidAmount) || 0), 0).toFixed(2)
        );
        plan.paidAmount = Number(((parseFloat(plan.downPayment) || 0) + plan.paidInstallmentsTotal).toFixed(2));
        plan.remainingAmount = Math.max(0, Number((plan.financedAmount - plan.paidInstallmentsTotal).toFixed(2)));
        plan.status = plan.remainingAmount <= 0.009 ? 'COMPLETED' : 'ACTIVE';

        plans[pIdx] = plan;
        this.saveInstallmentPlans(plans);
        this.addAuditLog({
            actionType: 'UPDATE',
            module: 'نظام الأقساط',
            reference: `${plan.id}#${inst.number}`,
            description: `تحصيل القسط رقم (${inst.number}) للعميل (${plan.partyName}) بمبلغ ${remainingInstAmt.toFixed(2)} بموجب سند القبض (${voucher.id})`
        });
        return { plan, installment: inst, voucher };
    }

    deleteInstallmentPlan(planId) {
        const plans = this.getInstallmentPlans();
        const plan = plans.find(p => p.id === planId);
        if (!plan) throw new Error('خطة التقسيط غير موجودة');
        this.saveInstallmentPlans(plans.filter(p => p.id !== planId));
        this.addAuditLog({
            actionType: 'DELETE',
            module: 'نظام الأقساط',
            reference: planId,
            description: `حذف خطة التقسيط (${planId}) للعميل (${plan.partyName})`
        });
        return true;
    }

    // ==================== إعدادات المنشأة والنسخ الاحتياطي ====================
    getSettings() {
        const defaults = {
            companyName: 'المؤسسة التجارية',
            companyPhone: '',
            companyAddress: '',
            companyTaxNumber: '',
            invoiceFooterText: 'شكراً لتعاملكم معنا - نتطلع لخدمتكم دائماً',
            invoiceLogo: '',
            invoiceBanner: '',
            invoiceAccent: '#1e3a8a',
            invoiceHeaderStyle: 'modern',
            invoiceSlogan: '',
            currency: '$',
            secondaryCurrency: 'د.ع',
            exchangeRate: 1500,
            showSecondaryCurrency: false,
            fiscalYear: '2026',
            autoEntryNumber: 1001,
            adminPassword: '1234'
        };
        try {
            const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
            return data ? { ...defaults, ...JSON.parse(data) } : defaults;
        } catch (e) {
            return defaults;
        }
    }

    verifyAdminPassword(inputPassword) {
        const settings = this.getSettings();
        const storedPass = settings.adminPassword || '1234';
        return String(inputPassword).trim() === String(storedPass).trim();
    }

    saveSettings(settings) {
        this._persistKey(STORAGE_KEYS.SETTINGS, settings);
    }

    // تصفير وإعادة تعيين النظام بالكامل
    resetToDemoData() {
        this.clearAllData();
    }

    // تصفير كل الحركات والبدء من الصفر
    clearAllData() {
        this.saveAccounts(DEFAULT_ACCOUNTS);
        this.saveEntries([]);
        this.saveWarehouses(DEFAULT_WAREHOUSES);
        this.saveProducts([]);
        this.saveInventoryTransactions([]);
        this.saveInvoices([]);
        this.saveOpeningBatches([]);
        this.saveVouchers([]);
        this.saveParties([]);
        this.saveQuotations([]);
        this.saveExpenses([]);
        this.saveAuditLogs([]);
        this.saveStocktakingSheets([]);
        this.saveInstallmentPlans([]);
        const settings = this.getSettings();
        settings.autoEntryNumber = 1001;
        this.saveSettings(settings);
        this.addAuditLog({
            actionType: 'SECURITY',
            module: 'النظام والحماية',
            reference: 'RESET',
            description: 'تم تصفير جميع الحركات والقيود وإعادة ضبط النظام بكلمة المرور'
        });
    }

    // تصدير نسخة احتياطية شاملة JSON
    exportBackupJSON() {
        const exportObj = {
            version: '2.5',
            exportedAt: new Date().toISOString(),
            settings: this.getSettings(),
            accounts: this.getAccounts(),
            entries: this.getEntries(),
            warehouses: this.getWarehouses(),
            products: this.getProducts(),
            inventoryTransactions: this.getInventoryTransactions(),
            invoices: this.getInvoices(),
            openingBatches: this.getOpeningBatches(),
            vouchers: this.getVouchers(),
            parties: this.getParties(),
            quotations: this.getQuotations(),
            expenses: this.getExpenses(),
            auditLogs: this.getAuditLogs(),
            stocktakingSheets: this.getStocktakingSheets(),
            installmentPlans: this.getInstallmentPlans()
        };
        return JSON.stringify(exportObj, null, 2);
    }

    // استيراد واسترجاع نسخة احتياطية كاملة
    importBackupJSON(jsonString) {
        try {
            const parsed = JSON.parse(jsonString);
            if (!parsed.accounts || !Array.isArray(parsed.accounts)) {
                throw new Error('ملف النسخة الاحتياطية غير صالح');
            }
            if (parsed.accounts) this.saveAccounts(parsed.accounts);
            if (parsed.entries) this.saveEntries(parsed.entries);
            if (parsed.warehouses) this.saveWarehouses(parsed.warehouses);
            if (parsed.products) this.saveProducts(parsed.products);
            if (parsed.inventoryTransactions) this.saveInventoryTransactions(parsed.inventoryTransactions);
            if (parsed.invoices) this.saveInvoices(parsed.invoices);
            if (parsed.openingBatches) this.saveOpeningBatches(parsed.openingBatches);
            if (parsed.vouchers) this.saveVouchers(parsed.vouchers);
            if (parsed.parties) this.saveParties(parsed.parties);
            if (parsed.quotations) this.saveQuotations(parsed.quotations);
            if (parsed.expenses) this.saveExpenses(parsed.expenses);
            if (parsed.auditLogs) this.saveAuditLogs(parsed.auditLogs);
            if (parsed.stocktakingSheets) this.saveStocktakingSheets(parsed.stocktakingSheets);
            if (parsed.installmentPlans) this.saveInstallmentPlans(parsed.installmentPlans);
            if (parsed.settings) this.saveSettings(parsed.settings);
            return true;
        } catch (err) {
            throw new Error(`فشل استيراد النسخة الاحتياطية: ${err.message}`);
        }
    }
}

// كائن إدارة التخزين العام
const storage = new StorageManager();
