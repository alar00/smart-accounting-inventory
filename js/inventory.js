// inventory.js - المحرك المخزني لإدارة المستودعات، المنتجات، التحويلات، التسويات الجردية والربط المحاسبي

class InventoryEngine {
    constructor(storageManager) {
        this.storage = storageManager;
    }

    // احتساب أرصدة المخزون لكافة المنتجات في كل مستودع
    calculateStockMatrix() {
        const products = this.storage.getProducts();
        const warehouses = this.storage.getWarehouses();
        const txs = this.storage.getInventoryTransactions();

        // هيكل التخزين: matrix[productId][warehouseId] = quantity
        const matrix = {};
        const productTotals = {};

        // تهيئة المصفوفة
        products.forEach(p => {
            matrix[p.id] = {};
            productTotals[p.id] = {
                product: p,
                totalQty: 0,
                totalValue: 0,
                byWarehouse: {}
            };

            warehouses.forEach(w => {
                matrix[p.id][w.id] = 0;
                productTotals[p.id].byWarehouse[w.id] = {
                    warehouse: w,
                    quantity: 0,
                    value: 0
                };
            });
        });

        // فرز الحركات تصاعدياً لاحتساب الرصيد
        const sortedTxs = [...txs].sort((a, b) => new Date(a.date || a.createdAt) - new Date(b.date || b.createdAt));

        sortedTxs.forEach(tx => {
            const pId = tx.productId;
            const qty = parseFloat(tx.quantity) || 0;
            if (!matrix[pId]) return;

            if (tx.type === 'IN') {
                const wId = tx.warehouseId;
                if (matrix[pId][wId] !== undefined) {
                    matrix[pId][wId] += qty;
                }
            } else if (tx.type === 'OUT') {
                const wId = tx.warehouseId;
                if (matrix[pId][wId] !== undefined) {
                    matrix[pId][wId] -= qty;
                }
            } else if (tx.type === 'TRANSFER') {
                const fromW = tx.fromWarehouseId;
                const toW = tx.toWarehouseId;
                if (matrix[pId][fromW] !== undefined) {
                    matrix[pId][fromW] -= qty;
                }
                if (matrix[pId][toW] !== undefined) {
                    matrix[pId][toW] += qty;
                }
            } else if (tx.type === 'ADJUSTMENT') {
                const wId = tx.warehouseId;
                if (matrix[pId][wId] !== undefined) {
                    if (tx.adjustmentType === 'INCREASE') {
                        matrix[pId][wId] += qty;
                    } else if (tx.adjustmentType === 'DECREASE') {
                        matrix[pId][wId] -= qty;
                    }
                }
            }
        });

        // تجميع الإجماليات والقيم
        products.forEach(p => {
            let sumQty = 0;
            warehouses.forEach(w => {
                const q = matrix[p.id][w.id] || 0;
                sumQty += q;
                productTotals[p.id].byWarehouse[w.id].quantity = q;
                productTotals[p.id].byWarehouse[w.id].value = q * (p.purchasePrice || 0);
            });
            productTotals[p.id].totalQty = sumQty;
            productTotals[p.id].totalValue = sumQty * (p.purchasePrice || 0);
        });

        return {
            matrix,
            productTotals
        };
    }

    // جلب الرصيد المتوفر لمنتج في مستودع معين أو إجمالي كافة المستودعات
    getProductStock(productId, warehouseId = null) {
        const { matrix, productTotals } = this.calculateStockMatrix();
        if (warehouseId) {
            return (matrix[productId] && matrix[productId][warehouseId]) ? matrix[productId][warehouseId] : 0;
        }
        return (productTotals[productId] && productTotals[productId].totalQty) ? productTotals[productId].totalQty : 0;
    }

    // تنفيذ عملية تحويل مخزني بين مستودعين
    executeTransfer(data) {
        const { fromWarehouseId, toWarehouseId, productId, quantity, date, reference, reason } = data;

        if (!fromWarehouseId || !toWarehouseId) {
            throw new Error('يرجى تحديد مستودع المصدر ومستودع الوجهة');
        }
        if (fromWarehouseId === toWarehouseId) {
            throw new Error('لا يمكن التحويل إلى نفس المستودع، يرجى اختيار مستودعين مختلفين');
        }
        if (!productId) {
            throw new Error('يرجى تحديد المنتج أو الصنف المراد تحويله');
        }
        const qty = parseFloat(quantity);
        if (isNaN(qty) || qty <= 0) {
            throw new Error('يجب أن تكون كمية التحويل أكبر من الصفر');
        }

        // فحص توفر الرصيد في مستودع المصدر
        const currentStock = this.getProductStock(productId, fromWarehouseId);
        if (currentStock < qty) {
            const product = this.storage.getProductById(productId);
            const fromWh = this.storage.getWarehouseById(fromWarehouseId);
            throw new Error(`الرصيد غير كافٍ في مستودع (${fromWh ? fromWh.name : fromWarehouseId})! الرصيد المتوفر: ${currentStock} ${product ? product.unit : ''}`);
        }

        const product = this.storage.getProductById(productId);
        const unitCost = product ? (product.purchasePrice || 0) : 0;

        const newTx = this.storage.addInventoryTransaction({
            type: 'TRANSFER',
            fromWarehouseId,
            toWarehouseId,
            productId,
            quantity: qty,
            unitCost,
            date: date || new Date().toISOString().split('T')[0],
            reference: reference || `TR-${Date.now().toString().slice(-4)}`,
            reason: reason || 'تحويل مخزني داخلي بين المستودعات'
        });

        return newTx;
    }

    // تنفيذ عملية تسوية مخزنية (زيادة أو نقص جردي مع إمكانية الربط المحاسبي)
    executeAdjustment(data) {
        const { warehouseId, productId, adjustmentType, quantity, unitCost, date, reference, reason, createJournalEntry } = data;

        if (!warehouseId) throw new Error('يرجى تحديد المستودع المراد تسويته');
        if (!productId) throw new Error('يرجى تحديد الصنف المراد تسويته');
        if (!adjustmentType || (adjustmentType !== 'INCREASE' && adjustmentType !== 'DECREASE')) {
            throw new Error('يرجى تحديد نوع التسوية (زيادة جردية أو نقص/عجز/تالف)');
        }
        const qty = parseFloat(quantity);
        if (isNaN(qty) || qty <= 0) throw new Error('يجب أن تكون كمية التسوية أكبر من الصفر');

        const product = this.storage.getProductById(productId);
        const cost = parseFloat(unitCost) || (product ? product.purchasePrice : 0) || 0;
        const totalAmount = qty * cost;

        // في حالة النقص، فحص الرصيد المتوفر
        if (adjustmentType === 'DECREASE') {
            const currentStock = this.getProductStock(productId, warehouseId);
            if (currentStock < qty) {
                const wh = this.storage.getWarehouseById(warehouseId);
                throw new Error(`الكمية المراد خصمها (${qty}) تتجاوز رصيد الصنف المتوفر في مستودع (${wh ? wh.name : warehouseId}) البالغ (${currentStock})!`);
            }
        }

        let journalEntryId = null;

        // توليد قيد محاسبي آلي إذا طلب المستخدم
        if (createJournalEntry && totalAmount > 0) {
            const wh = this.storage.getWarehouseById(warehouseId);
            const entryDate = date || new Date().toISOString().split('T')[0];
            const entryLines = [];

            if (adjustmentType === 'INCREASE') {
                // زيادة / فائض جرد: مدين مخزون البضائع 1104 / دائن أرباح وإيرادات متنوعة 4201
                entryLines.push({
                    accountCode: '1104',
                    debit: totalAmount,
                    credit: 0,
                    note: `إثبات فائض جرد صنف (${product.name}) بمستودع (${wh ? wh.name : ''})`
                });
                entryLines.push({
                    accountCode: '4201',
                    debit: 0,
                    credit: totalAmount,
                    note: `أرباح وفروقات جرد مخزني - فائض صنف (${product.name})`
                });
            } else {
                // نقص / عجز أو تالف: مدين تكلفة البضاعة/تسويات المخزون 5302 / دائن مخزون البضائع 1104
                entryLines.push({
                    accountCode: '5302',
                    debit: totalAmount,
                    credit: 0,
                    note: `إثبات عجز/تلف صنف (${product.name}) بمستودع (${wh ? wh.name : ''})`
                });
                entryLines.push({
                    accountCode: '1104',
                    debit: 0,
                    credit: totalAmount,
                    note: `تخفيض مخزون البضائع مقابل عجز/تلف صنف (${product.name})`
                });
            }

            const jv = this.storage.addEntry({
                date: entryDate,
                description: `قيد تسوية مخزنية (${adjustmentType === 'INCREASE' ? 'فائض جرد' : 'عجز/تلف'}) - ${product.name}`,
                reference: reference || 'ADJ-AUTO',
                lines: entryLines
            });

            journalEntryId = jv.id;
        }

        const newTx = this.storage.addInventoryTransaction({
            type: 'ADJUSTMENT',
            adjustmentType,
            warehouseId,
            productId,
            quantity: qty,
            unitCost: cost,
            totalCost: totalAmount,
            date: date || new Date().toISOString().split('T')[0],
            reference: reference || `ADJ-${Date.now().toString().slice(-4)}`,
            reason: reason || (adjustmentType === 'INCREASE' ? 'فائض تسوية جردية' : 'عجز أو تلف مخزني'),
            journalEntryId
        });

        return {
            transaction: newTx,
            journalEntryId
        };
    }

    // اعتماد محضر الجرد الفعلي السريع للمخزون (Smart Batch Stocktaking)
    executeBatchStocktaking(data) {
        const { warehouseId, date, reference, notes, createJournalEntry = true, items = [] } = data;
        if (!warehouseId) throw new Error('يرجى اختيار المستودع المراد اعتماد جرده');

        const wh = this.storage.getWarehouseById(warehouseId);
        const sheetId = (reference || '').trim() || this.storage.getNextStocktakingNumber();
        const sheetDate = date || new Date().toISOString().split('T')[0];

        const processedItems = [];
        let matchedCount = 0;
        let surplusItemsCount = 0;
        let shortageItemsCount = 0;
        let totalSurplusQty = 0;
        let totalShortageQty = 0;
        let totalSurplusValue = 0;
        let totalShortageValue = 0;

        items.forEach(row => {
            const product = this.storage.getProductById(row.productId);
            if (!product) return;
            const bookQty = this.getProductStock(product.id, warehouseId);
            const actualQty = row.actualQty !== undefined && row.actualQty !== '' && row.actualQty !== null
                ? Math.max(0, parseFloat(row.actualQty) || 0)
                : bookQty;
            const diffQty = Number((actualQty - bookQty).toFixed(4));
            const unitCost = parseFloat(row.unitCost ?? product.purchasePrice) || 0;
            const diffValue = Number((Math.abs(diffQty) * unitCost).toFixed(2));

            if (Math.abs(diffQty) < 0.0001) {
                matchedCount++;
            } else if (diffQty > 0) {
                surplusItemsCount++;
                totalSurplusQty += diffQty;
                totalSurplusValue += diffValue;
            } else {
                shortageItemsCount++;
                totalShortageQty += Math.abs(diffQty);
                totalShortageValue += diffValue;
            }

            processedItems.push({
                productId: product.id,
                sku: product.sku,
                productName: product.name,
                unit: product.unit || 'قطعة',
                bookQty,
                actualQty,
                diffQty,
                unitCost,
                diffValue: diffQty >= 0 ? diffValue : -diffValue,
                note: (row.note || '').trim()
            });
        });

        if (processedItems.length === 0) {
            throw new Error('لا توجد أصناف في ورقة الجرد لاعتمادها');
        }

        let journalEntryId = null;
        const entryLines = [];

        if (createJournalEntry && (totalSurplusValue > 0.009 || totalShortageValue > 0.009)) {
            if (totalSurplusValue > 0.009) {
                entryLines.push({
                    accountCode: '1104',
                    debit: Number(totalSurplusValue.toFixed(2)),
                    credit: 0,
                    note: `إثبات فائض جرد مخزني (${surplusItemsCount} أصناف) بموجب محضر جرد ${sheetId} - ${wh ? wh.name : ''}`
                });
                entryLines.push({
                    accountCode: '4201',
                    debit: 0,
                    credit: Number(totalSurplusValue.toFixed(2)),
                    note: `إيرادات وفروقات فائض الجرد الفعلي (${sheetId})`
                });
            }
            if (totalShortageValue > 0.009) {
                entryLines.push({
                    accountCode: '5302',
                    debit: Number(totalShortageValue.toFixed(2)),
                    credit: 0,
                    note: `إثبات عجز/نقص جرد مخزني (${shortageItemsCount} أصناف) بموجب محضر جرد ${sheetId} - ${wh ? wh.name : ''}`
                });
                entryLines.push({
                    accountCode: '1104',
                    debit: 0,
                    credit: Number(totalShortageValue.toFixed(2)),
                    note: `تخفيض مخزون البضائع مقابل عجز الجرد الفعلي (${sheetId})`
                });
            }

            if (entryLines.length >= 2) {
                const jv = this.storage.addEntry({
                    date: sheetDate,
                    description: `قيد تسوية محضر الجرد الفعلي رقم (${sheetId}) - مستودع (${wh ? wh.name : warehouseId})`,
                    reference: sheetId,
                    lines: entryLines
                });
                journalEntryId = jv.id;
            }
        }

        const transactionIds = [];
        processedItems.forEach(item => {
            if (Math.abs(item.diffQty) < 0.0001) return;
            const adjType = item.diffQty > 0 ? 'INCREASE' : 'DECREASE';
            const absQty = Math.abs(item.diffQty);
            const tx = this.storage.addInventoryTransaction({
                type: 'ADJUSTMENT',
                adjustmentType: adjType,
                warehouseId,
                productId: item.productId,
                quantity: absQty,
                unitCost: item.unitCost,
                totalCost: Math.abs(item.diffValue),
                date: sheetDate,
                reference: sheetId,
                reason: item.note || `تسوية جرد فعلي (${sheetId}) — الرصيد الدفتري: ${item.bookQty} | الفعلي: ${item.actualQty}`,
                journalEntryId
            });
            transactionIds.push(tx.id);
        });

        const sheetRecord = {
            id: sheetId,
            date: sheetDate,
            warehouseId,
            warehouseName: wh ? wh.name : warehouseId,
            totalItems: processedItems.length,
            matchedCount,
            surplusItemsCount,
            shortageItemsCount,
            totalSurplusQty,
            totalShortageQty,
            totalSurplusValue: Number(totalSurplusValue.toFixed(2)),
            totalShortageValue: Number(totalShortageValue.toFixed(2)),
            netVarianceValue: Number((totalSurplusValue - totalShortageValue).toFixed(2)),
            journalEntryId,
            transactionIds,
            notes: (notes || '').trim(),
            items: processedItems,
            createdAt: new Date().toISOString()
        };

        this.storage.addStocktakingSheet(sheetRecord);
        this.storage.addAuditLog({
            actionType: 'CREATE',
            module: 'الجرد الفعلي السريع',
            reference: sheetId,
            description: `اعتماد محضر الجرد الفعلي (${sheetId}) لمستودع (${sheetRecord.warehouseName}) — مطابق: ${matchedCount} | فائض: ${surplusItemsCount} | عجز: ${shortageItemsCount}`
        });

        return sheetRecord;
    }

    // توريد بضاعة للمستودع (إضافة مخزنية عادية)
    executeStockIn(data) {
        const { warehouseId, productId, quantity, unitCost, date, reference, reason } = data;
        if (!warehouseId || !productId) throw new Error('يرجى تحديد المستودع والصنف');
        const qty = parseFloat(quantity);
        if (isNaN(qty) || qty <= 0) throw new Error('يجب إدخال كمية صحيحة');

        const product = this.storage.getProductById(productId);
        const cost = parseFloat(unitCost) || (product ? product.purchasePrice : 0) || 0;

        return this.storage.addInventoryTransaction({
            type: 'IN',
            warehouseId,
            productId,
            quantity: qty,
            unitCost: cost,
            totalCost: qty * cost,
            date: date || new Date().toISOString().split('T')[0],
            reference: reference || '',
            reason: reason || 'توريد واستلام بضاعة للمستودع'
        });
    }

    // تقرير جرد وتقييم المخزون العام
    getInventoryValuationReport(warehouseId = null, category = 'all') {
        const { productTotals } = this.calculateStockMatrix();
        const products = this.storage.getProducts();

        let filtered = products;
        if (category && category !== 'all') {
            filtered = filtered.filter(p => p.category === category);
        }

        const rows = filtered.map(p => {
            const info = productTotals[p.id];
            let qty = 0;
            let value = 0;

            if (warehouseId && warehouseId !== 'all') {
                const whInfo = info.byWarehouse[warehouseId];
                qty = whInfo ? whInfo.quantity : 0;
                value = whInfo ? whInfo.value : 0;
            } else {
                qty = info.totalQty;
                value = info.totalValue;
            }

            const totalSellingValue = qty * (p.sellingPrice || 0);
            const isLowStock = qty <= (p.minStockAlert || 5) && qty > 0;
            const isOutOfStock = qty <= 0;

            let statusText = 'متوفر ✅';
            let statusClass = 'success';
            if (isOutOfStock) {
                statusText = 'نفد المخزون ❌';
                statusClass = 'danger';
            } else if (isLowStock) {
                statusText = 'منخفض (طلب) ⚠️';
                statusClass = 'warning';
            }

            return {
                product: p,
                quantity: qty,
                unitCost: p.purchasePrice || 0,
                totalCostValue: value,
                sellingPrice: p.sellingPrice || 0,
                totalSellingValue,
                statusText,
                statusClass,
                isLowStock,
                isOutOfStock
            };
        });

        // ترتيب حسب كود الصنف
        rows.sort((a, b) => a.product.sku.localeCompare(b.product.sku));

        const grandTotals = rows.reduce((acc, row) => {
            acc.totalQty += row.quantity;
            acc.totalCostValue += row.totalCostValue;
            acc.totalSellingValue += row.totalSellingValue;
            return acc;
        }, { totalQty: 0, totalCostValue: 0, totalSellingValue: 0 });

        return {
            rows,
            grandTotals,
            warehouseId,
            category
        };
    }

    // بطاقة حركة الصنف التفصيلية (Stock Item Card)
    getItemCardReport(productId, warehouseId = null, fromDate = null, toDate = null) {
        const product = this.storage.getProductById(productId);
        if (!product) return null;

        const txs = this.storage.getInventoryTransactions();
        // فرز الحركات تصاعدياً
        const sortedTxs = [...txs]
            .filter(t => t.productId === productId)
            .sort((a, b) => new Date(a.date || a.createdAt) - new Date(b.date || b.createdAt));

        let openingBalance = 0;
        const periodMovements = [];

        sortedTxs.forEach(tx => {
            const isBefore = fromDate && (tx.date < fromDate);
            const isInPeriod = (!fromDate || tx.date >= fromDate) && (!toDate || tx.date <= toDate);

            // احتساب أثر الحركة على المستودع المحدد أو العام
            let qtyIn = 0;
            let qtyOut = 0;

            if (tx.type === 'IN') {
                if (!warehouseId || warehouseId === 'all' || tx.warehouseId === warehouseId) {
                    qtyIn = tx.quantity;
                }
            } else if (tx.type === 'OUT') {
                if (!warehouseId || warehouseId === 'all' || tx.warehouseId === warehouseId) {
                    qtyOut = tx.quantity;
                }
            } else if (tx.type === 'TRANSFER') {
                if (!warehouseId || warehouseId === 'all') {
                    // على المستوى الإجمالي لا يتغير الرصيد الكلي
                    qtyIn = 0;
                    qtyOut = 0;
                } else {
                    if (tx.toWarehouseId === warehouseId) qtyIn = tx.quantity;
                    if (tx.fromWarehouseId === warehouseId) qtyOut = tx.quantity;
                }
            } else if (tx.type === 'ADJUSTMENT') {
                if (!warehouseId || warehouseId === 'all' || tx.warehouseId === warehouseId) {
                    if (tx.adjustmentType === 'INCREASE') qtyIn = tx.quantity;
                    if (tx.adjustmentType === 'DECREASE') qtyOut = tx.quantity;
                }
            }

            if (qtyIn === 0 && qtyOut === 0 && (!warehouseId || warehouseId === 'all') && tx.type === 'TRANSFER') {
                // حركة تحويل لا تؤثر على الإجمالي ولكن تسجل كبيان
            } else if (isBefore) {
                openingBalance += (qtyIn - qtyOut);
            } else if (isInPeriod) {
                periodMovements.push({
                    tx,
                    qtyIn,
                    qtyOut
                });
            }
        });

        // احتساب الرصيد التراكمي بعد كل حركة
        let runningBalance = openingBalance;
        let totalPeriodIn = 0;
        let totalPeriodOut = 0;

        const movementsWithBalance = periodMovements.map(m => {
            totalPeriodIn += m.qtyIn;
            totalPeriodOut += m.qtyOut;
            runningBalance += (m.qtyIn - m.qtyOut);

            let typeName = 'حركة مخزنية';
            const txTypeObj = INVENTORY_TX_TYPES[m.tx.type];
            if (txTypeObj) typeName = txTypeObj.name;
            if (m.tx.type === 'ADJUSTMENT') {
                typeName = m.tx.adjustmentType === 'INCREASE' ? 'تسوية جردية (زيادة / فائض)' : 'تسوية جردية (نقص / تالف)';
            }

            let whDetails = '';
            if (m.tx.type === 'TRANSFER') {
                const fromW = this.storage.getWarehouseById(m.tx.fromWarehouseId);
                const toW = this.storage.getWarehouseById(m.tx.toWarehouseId);
                whDetails = `من: ${fromW ? fromW.name : m.tx.fromWarehouseId} ← إلى: ${toW ? toW.name : m.tx.toWarehouseId}`;
            } else {
                const w = this.storage.getWarehouseById(m.tx.warehouseId);
                whDetails = w ? w.name : '';
            }

            return {
                ...m,
                typeName,
                whDetails,
                runningBalance
            };
        });

        return {
            product,
            warehouseId,
            fromDate,
            toDate,
            openingBalance,
            totalPeriodIn,
            totalPeriodOut,
            closingBalance: runningBalance,
            movements: movementsWithBalance
        };
    }

    // تنبيهات النواقص والأصناف التي وصلت للحد الأدنى
    getLowStockAlerts() {
        const { rows } = this.getInventoryValuationReport();
        return rows.filter(r => r.isLowStock || r.isOutOfStock);
    }

    // ==================== تنفيذ دفعة الرصيد الافتتاحي للمخزون ====================
    executeOpeningBalanceBatch(data) {
        const { warehouseId, date, items, notes } = data;

        if (!warehouseId) throw new Error('يرجى اختيار المستودع لاستقبال البضاعة الافتتاحية');
        if (!items || !Array.isArray(items) || items.length === 0) {
            throw new Error('يجب إضافة صنف واحد على الأقل في دفعة الرصيد الافتتاحي');
        }

        const wh = this.storage.getWarehouseById(warehouseId);
        const whName = wh ? wh.name : warehouseId;
        const entryDate = date || new Date().toISOString().split('T')[0];

        let totalBatchQuantity = 0;
        let totalBatchCost = 0;
        const processedItems = [];

        items.forEach((item, index) => {
            const product = this.storage.getProductById(item.productId);
            if (!product) {
                throw new Error(`السطر ${index + 1}: الصنف غير موجود بالنظام`);
            }
            const qty = parseFloat(item.quantity);
            const cost = parseFloat(item.unitCost);

            if (isNaN(qty) || qty <= 0) {
                throw new Error(`السطر ${index + 1}: كمية الصنف (${product.name}) يجب أن تكون أكبر من الصفر`);
            }
            if (isNaN(cost) || cost < 0) {
                throw new Error(`السطر ${index + 1}: تكلفة الصنف (${product.name}) غير صحيحة`);
            }

            const itemTotalCost = qty * cost;
            totalBatchQuantity += qty;
            totalBatchCost += itemTotalCost;

            processedItems.push({
                productId: product.id,
                productName: product.name,
                sku: product.sku,
                unit: product.unit,
                quantity: qty,
                unitCost: cost,
                totalCost: itemTotalCost
            });
        });

        const batchId = this.storage.getNextOpeningBatchId();

        // 1. توليد القيد المحاسبي المتوازن: مدين مخزون البضائع 1104 / دائن رأس المال / رصيد افتتاحي 3101
        let journalEntry = null;
        if (totalBatchCost > 0) {
            journalEntry = this.storage.addEntry({
                date: entryDate,
                description: `قيد إثبات رصيد بضاعة أول المدة (${batchId}) - مستودع: ${whName}`,
                reference: batchId,
                lines: [
                    {
                        accountCode: '1104',
                        debit: totalBatchCost,
                        credit: 0,
                        note: `إثبات مخزون بضاعة أول المدة (${processedItems.length} أصناف) بمستودع (${whName})`
                    },
                    {
                        accountCode: '3101',
                        debit: 0,
                        credit: totalBatchCost,
                        note: `رأس المال / رصيد افتتاحي مقابل بضاعة أول المدة بمستودع (${whName})`
                    }
                ]
            });
        }

        // 2. تسجيل الحركات المخزنية الواردة لكل صنف
        processedItems.forEach(item => {
            this.storage.addInventoryTransaction({
                type: 'IN',
                warehouseId,
                productId: item.productId,
                quantity: item.quantity,
                unitCost: item.unitCost,
                totalCost: item.totalCost,
                date: entryDate,
                reference: batchId,
                reason: `رصيد مخزون افتتاحي (أول المدة) - دفعة رقم ${batchId}`,
                journalEntryId: journalEntry ? journalEntry.id : null
            });

            // تحديث سعر التكلفة للصنف إذا كان صفراً
            try {
                const prod = this.storage.getProductById(item.productId);
                if (prod && (!prod.purchasePrice || prod.purchasePrice === 0) && item.unitCost > 0) {
                    this.storage.updateProduct(item.productId, { purchasePrice: item.unitCost });
                }
            } catch (e) {}
        });

        // 3. حفظ الدفعة في سجل الأرصدة الافتتاحية
        const batch = this.storage.addOpeningBatch({
            id: batchId,
            date: entryDate,
            warehouseId,
            items: processedItems,
            totalQuantity: totalBatchQuantity,
            totalCost: totalBatchCost,
            notes: notes || `رصيد بضاعة أول المدة - ${whName}`,
            journalEntryId: journalEntry ? journalEntry.id : null
        });

        return {
            batch,
            journalEntry
        };
    }

    // ==================== تنفيذ ومعالجة الفواتير ومرتجعاتها (مبيعات / مشتريات / مرتجعات) ====================
    executeInvoice(data) {
        let { type, partyName, partyAccountCode, paymentMethod, warehouseId, date, items, discount, taxRate, notes, paidAmount } = data;
        if (type === 'SALE') type = 'SALES';
        if (type === 'SALE_RETURN') type = 'SALES_RETURN';
        if (!warehouseId) {
            const defWh = this.storage.getWarehouses().find(w => w.isDefault) || this.storage.getWarehouses()[0];
            if (defWh) warehouseId = defWh.id;
        }

        const validTypes = ['SALES', 'PURCHASE', 'SALES_RETURN', 'PURCHASE_RETURN'];
        if (!type || !validTypes.includes(type)) {
            throw new Error('يرجى تحديد نوع الفاتورة أو المرتجع بشكل صحيح');
        }
        if (!warehouseId) throw new Error('يرجى تحديد المستودع المرتبط بالعملية');
        if (!items || !Array.isArray(items) || items.length === 0) {
            throw new Error('يجب إضافة صنف واحد على الأقل في الفاتورة');
        }

        const isSalesFamily = (type === 'SALES' || type === 'SALES_RETURN');
        const wh = this.storage.getWarehouseById(warehouseId);
        const whName = wh ? wh.name : warehouseId;
        const invoiceDate = date || new Date().toISOString().split('T')[0];
        const payMethod = paymentMethod || 'CASH';

        let subtotal = 0;
        let totalCOGS = 0; // تكلفة البضاعة المباعة في حالة المبيعات أو مرتجع المبيعات
        const processedItems = [];

        // التحقق من الأصناف والأسعار والكميات
        items.forEach((item, index) => {
            const product = this.storage.getProductById(item.productId);
            if (!product) {
                throw new Error(`السطر ${index + 1}: الصنف غير موجود`);
            }
            const qty = parseFloat(item.quantity);
            const price = parseFloat(item.unitPrice);

            if (isNaN(qty) || qty <= 0) {
                throw new Error(`السطر ${index + 1}: كمية الصنف (${product.name}) يجب أن تكون أكبر من الصفر`);
            }
            if (isNaN(price) || price < 0) {
                throw new Error(`السطر ${index + 1}: سعر الصنف (${product.name}) غير صحيح`);
            }

            // فحص توفر الكمية في المستودع عند الصرف (مبيعات أو مرتجع مشتريات)
            if (type === 'SALES' || type === 'PURCHASE_RETURN') {
                const availableStock = this.getProductStock(product.id, warehouseId);
                if (availableStock < qty) {
                    throw new Error(`الرصيد غير كافٍ للصنف (${product.name}) بمستودع (${whName})! المتوفر: ${availableStock} ${product.unit} - المطلوب: ${qty}`);
                }
            }

            if (type === 'SALES' || type === 'SALES_RETURN') {
                const itemCost = product.purchasePrice || 0;
                totalCOGS += (qty * itemCost);
            }

            const itemTotal = qty * price;
            subtotal += itemTotal;

            processedItems.push({
                productId: product.id,
                productName: product.name,
                sku: product.sku,
                unit: product.unit,
                quantity: qty,
                unitPrice: price,
                unitCost: product.purchasePrice || 0,
                total: itemTotal
            });
        });

        const discAmount = Math.min(parseFloat(discount) || 0, subtotal);
        const afterDiscount = Math.max(subtotal - discAmount, 0);
        const taxRateNum = parseFloat(taxRate) || 0;
        const taxAmount = (afterDiscount * taxRateNum) / 100;
        const grandTotal = afterDiscount + taxAmount;

        const nextInvNumber = this.storage.getNextInvoiceNumber(type);
        const cleanPartyName = (partyName || '').trim() || (isSalesFamily ? 'عميل نقدي' : 'مورد عام');

        // احتساب المبلغ المستلم من العميل (أو المدفوع للمورد)، الباقي النقدي المردود، والمتبقي الآجل بالذمة
        const hasExplicitPaid = paidAmount !== undefined && paidAmount !== null && String(paidAmount).trim() !== '';
        const receivedAmount = hasExplicitPaid
            ? Math.max(0, parseFloat(paidAmount) || 0)
            : (payMethod === 'CREDIT' ? 0 : grandTotal);
        const changeAmount = receivedAmount > grandTotal ? (receivedAmount - grandTotal) : 0;
        const netPaidAmount = Math.min(receivedAmount, grandTotal);
        const remainingAmount = Math.max(0, grandTotal - netPaidAmount);

        const cashOrBankCode = payMethod === 'BANK' ? '1102' : '1101';
        const cashOrBankLabel = payMethod === 'BANK' ? 'تحويل بنكي' : 'نقداً بالصندوق';

        // ضمان تسجيل العميل أو المورد في دليل الأطراف تلقائياً
        this.storage.ensurePartyExists(cleanPartyName, isSalesFamily ? 'CUSTOMER' : 'SUPPLIER');

        let journalEntry = null;
        let cogsEntry = null;

        // 1. توليد القيد المالي وحركات المخزون بحسب نوع الفاتورة مع إظهار المبلغ المستلم والباقي/المتبقي في القيود
        if (type === 'SALES') {
            const customerAccCode = partyAccountCode || '1103';
            const salesLines = [];

            if (receivedAmount > grandTotal) {
                // استلام مبلغ أكبر من قيمة الفاتورة ورد الباقي للعميل
                salesLines.push({
                    accountCode: cashOrBankCode,
                    debit: receivedAmount,
                    credit: 0,
                    note: `المبلغ المستلم من العميل (${cleanPartyName}) ${cashOrBankLabel} - فاتورة رقم ${nextInvNumber}`
                });
                salesLines.push({
                    accountCode: cashOrBankCode,
                    debit: 0,
                    credit: changeAmount,
                    note: `رد الباقي النقدي للعميل (${cleanPartyName}) - فاتورة رقم ${nextInvNumber}`
                });
            } else if (receivedAmount > 0 && remainingAmount > 0) {
                // دفعة جزئية مستلمة + مبلغ متبقي آجل بذمة العميل
                salesLines.push({
                    accountCode: cashOrBankCode,
                    debit: netPaidAmount,
                    credit: 0,
                    note: `المبلغ المستلم من العميل (${cleanPartyName}) كدفعة من فاتورة رقم ${nextInvNumber}`
                });
                salesLines.push({
                    accountCode: customerAccCode,
                    debit: remainingAmount,
                    credit: 0,
                    note: `المبلغ المتبقي الآجل بذمة العميل (${cleanPartyName}) - فاتورة رقم ${nextInvNumber}`
                });
            } else if (receivedAmount > 0 && remainingAmount === 0) {
                // استلام قيمة الفاتورة بالكامل
                salesLines.push({
                    accountCode: cashOrBankCode,
                    debit: grandTotal,
                    credit: 0,
                    note: `المبلغ المستلم من العميل (${cleanPartyName}) بالكامل (${cashOrBankLabel}) - فاتورة رقم ${nextInvNumber}`
                });
            } else {
                // مبيعات آجلة بالكامل (المبلغ المستلم = 0)
                salesLines.push({
                    accountCode: customerAccCode,
                    debit: grandTotal,
                    credit: 0,
                    note: `مبيعات آجلة للعميل (${cleanPartyName}) - فاتورة رقم ${nextInvNumber} (المبلغ المستلم: 0.00)`
                });
            }

            salesLines.push({
                accountCode: '4101',
                debit: 0,
                credit: afterDiscount,
                note: `إيراد مبيعات فاتورة رقم ${nextInvNumber} (${cleanPartyName})`
            });
            if (taxAmount > 0) {
                salesLines.push({ accountCode: '2103', debit: 0, credit: taxAmount, note: `ضريبة القيمة المضافة لفاتورة مبيعات ${nextInvNumber}` });
            }

            let salesDesc = `فاتورة مبيعات رقم ${nextInvNumber} - ${cleanPartyName} (إجمالي: ${grandTotal.toFixed(2)} | المبلغ المستلم من العميل: ${receivedAmount.toFixed(2)}`;
            if (changeAmount > 0) salesDesc += ` | الباقي للعميل: ${changeAmount.toFixed(2)}`;
            if (remainingAmount > 0) salesDesc += ` | المتبقي الآجل: ${remainingAmount.toFixed(2)}`;
            salesDesc += `)`;

            journalEntry = this.storage.addEntry({
                date: invoiceDate,
                description: salesDesc,
                reference: nextInvNumber,
                lines: salesLines
            });

            if (totalCOGS > 0) {
                cogsEntry = this.storage.addEntry({
                    date: invoiceDate,
                    description: `قيد تكلفة مبيعات فاتورة رقم ${nextInvNumber}`,
                    reference: nextInvNumber,
                    lines: [
                        { accountCode: '5302', debit: totalCOGS, credit: 0, note: `تكلفة البضاعة المباعة لفاتورة مبيعات ${nextInvNumber}` },
                        { accountCode: '1104', debit: 0, credit: totalCOGS, note: `صرف مخزون مباع بموجب فاتورة ${nextInvNumber} من مستودع (${whName})` }
                    ]
                });
            }

            processedItems.forEach(item => {
                this.storage.addInventoryTransaction({
                    type: 'OUT',
                    warehouseId,
                    productId: item.productId,
                    quantity: item.quantity,
                    unitCost: item.unitCost,
                    totalCost: item.quantity * item.unitCost,
                    date: invoiceDate,
                    reference: nextInvNumber,
                    reason: `صرف مبيعات - فاتورة رقم ${nextInvNumber} للعميل (${cleanPartyName})`,
                    journalEntryId: cogsEntry ? cogsEntry.id : journalEntry.id
                });
            });

        } else if (type === 'SALES_RETURN') {
            // مرتجع مبيعات (عكس المبيعات وإرجاع البضاعة للمستودع)
            let creditAccountCode = '1101';
            let creditAccountNote = `رد نقدي للعميل (${cleanPartyName}) عن مرتجع مبيعات رقم ${nextInvNumber}`;
            if (payMethod === 'BANK') {
                creditAccountCode = '1102';
                creditAccountNote = `رد بنكي للعميل (${cleanPartyName}) عن مرتجع مبيعات رقم ${nextInvNumber}`;
            } else if (payMethod === 'CREDIT') {
                creditAccountCode = partyAccountCode || '1103';
                creditAccountNote = `تخفيض مديونية العميل (${cleanPartyName}) بموجب مرتجع مبيعات ${nextInvNumber}`;
            }

            const returnSalesLines = [
                { accountCode: '4101', debit: afterDiscount, credit: 0, note: `مردودات ومرتجعات مبيعات رقم ${nextInvNumber} (${cleanPartyName})` }
            ];
            if (taxAmount > 0) {
                returnSalesLines.push({ accountCode: '2103', debit: taxAmount, credit: 0, note: `رد ضريبة القيمة المضافة لمرتجع مبيعات ${nextInvNumber}` });
            }
            returnSalesLines.push({ accountCode: creditAccountCode, debit: 0, credit: grandTotal, note: creditAccountNote });

            journalEntry = this.storage.addEntry({
                date: invoiceDate,
                description: `مرتجع مبيعات رقم ${nextInvNumber} - ${cleanPartyName}`,
                reference: nextInvNumber,
                lines: returnSalesLines
            });

            if (totalCOGS > 0) {
                cogsEntry = this.storage.addEntry({
                    date: invoiceDate,
                    description: `قيد استرداد مخزون وتكلفة مرتجع مبيعات رقم ${nextInvNumber}`,
                    reference: nextInvNumber,
                    lines: [
                        { accountCode: '1104', debit: totalCOGS, credit: 0, note: `إعادة بضاعة مرتجعة للمخزون بمستودع (${whName}) - مرتجع ${nextInvNumber}` },
                        { accountCode: '5302', debit: 0, credit: totalCOGS, note: `عكس تكلفة البضاعة المباعة لمرتجع ${nextInvNumber}` }
                    ]
                });
            }

            processedItems.forEach(item => {
                this.storage.addInventoryTransaction({
                    type: 'IN',
                    warehouseId,
                    productId: item.productId,
                    quantity: item.quantity,
                    unitCost: item.unitCost,
                    totalCost: item.quantity * item.unitCost,
                    date: invoiceDate,
                    reference: nextInvNumber,
                    reason: `إرجاع مبيعات للمستودع - مرتجع رقم ${nextInvNumber} من العميل (${cleanPartyName})`,
                    journalEntryId: cogsEntry ? cogsEntry.id : journalEntry.id
                });
            });

        } else if (type === 'PURCHASE') {
            // فاتورة مشتريات
            const supplierAccCode = partyAccountCode || '2101';
            const purchaseLines = [
                { accountCode: '1104', debit: afterDiscount, credit: 0, note: `توريد بضاعة ومخزون بفاتورة مشتريات رقم ${nextInvNumber}` }
            ];
            if (taxAmount > 0) {
                purchaseLines.push({ accountCode: '2103', debit: taxAmount, credit: 0, note: `ضريبة مدخلات مشتريات فاتورة رقم ${nextInvNumber}` });
            }

            if (receivedAmount > grandTotal) {
                purchaseLines.push({
                    accountCode: cashOrBankCode,
                    debit: changeAmount,
                    credit: 0,
                    note: `استرداد الباقي النقدي من المورد (${cleanPartyName}) - فاتورة رقم ${nextInvNumber}`
                });
                purchaseLines.push({
                    accountCode: cashOrBankCode,
                    debit: 0,
                    credit: receivedAmount,
                    note: `المبلغ المدفوع للمورد (${cleanPartyName}) - فاتورة مشتريات رقم ${nextInvNumber}`
                });
            } else if (receivedAmount > 0 && remainingAmount > 0) {
                purchaseLines.push({
                    accountCode: cashOrBankCode,
                    debit: 0,
                    credit: netPaidAmount,
                    note: `المبلغ المدفوع للمورد (${cleanPartyName}) كدفعة من فاتورة رقم ${nextInvNumber}`
                });
                purchaseLines.push({
                    accountCode: supplierAccCode,
                    debit: 0,
                    credit: remainingAmount,
                    note: `المبلغ المتبقي الآجل للمورد (${cleanPartyName}) - فاتورة رقم ${nextInvNumber}`
                });
            } else if (receivedAmount > 0 && remainingAmount === 0) {
                purchaseLines.push({
                    accountCode: cashOrBankCode,
                    debit: 0,
                    credit: grandTotal,
                    note: `المبلغ المدفوع للمورد (${cleanPartyName}) بالكامل - فاتورة مشتريات رقم ${nextInvNumber}`
                });
            } else {
                purchaseLines.push({
                    accountCode: supplierAccCode,
                    debit: 0,
                    credit: grandTotal,
                    note: `مشتريات آجلة من المورد (${cleanPartyName}) - فاتورة رقم ${nextInvNumber}`
                });
            }

            let purchaseDesc = `فاتورة مشتريات رقم ${nextInvNumber} - ${cleanPartyName} (إجمالي: ${grandTotal.toFixed(2)} | المدفوع: ${receivedAmount.toFixed(2)}`;
            if (remainingAmount > 0) purchaseDesc += ` | المتبقي الآجل: ${remainingAmount.toFixed(2)}`;
            purchaseDesc += `)`;

            journalEntry = this.storage.addEntry({
                date: invoiceDate,
                description: purchaseDesc,
                reference: nextInvNumber,
                lines: purchaseLines
            });

            processedItems.forEach(item => {
                this.storage.addInventoryTransaction({
                    type: 'IN',
                    warehouseId,
                    productId: item.productId,
                    quantity: item.quantity,
                    unitCost: item.unitPrice,
                    totalCost: item.quantity * item.unitPrice,
                    date: invoiceDate,
                    reference: nextInvNumber,
                    reason: `توريد مشتريات - فاتورة رقم ${nextInvNumber} من المورد (${cleanPartyName})`,
                    journalEntryId: journalEntry.id
                });

                try {
                    this.storage.updateProduct(item.productId, { purchasePrice: item.unitPrice });
                } catch (e) {}
            });

        } else if (type === 'PURCHASE_RETURN') {
            // مرتجع مشتريات (رد بضاعة للمورد وصرفها من المستودع)
            let debitAccountCode = '1101';
            let debitAccountNote = `استرداد نقدي لمرتجع مشتريات رقم ${nextInvNumber}`;
            if (payMethod === 'BANK') {
                debitAccountCode = '1102';
                debitAccountNote = `استرداد بنكي لمرتجع مشتريات رقم ${nextInvNumber}`;
            } else if (payMethod === 'CREDIT') {
                debitAccountCode = partyAccountCode || '2101';
                debitAccountNote = `تخفيض حساب المورد (${cleanPartyName}) بموجب مرتجع مشتريات ${nextInvNumber}`;
            }

            const returnPurchaseLines = [
                { accountCode: debitAccountCode, debit: grandTotal, credit: 0, note: debitAccountNote },
                { accountCode: '1104', debit: 0, credit: afterDiscount, note: `إخراج بضاعة مردودة للمورد - مرتجع مشتريات ${nextInvNumber}` }
            ];
            if (taxAmount > 0) {
                returnPurchaseLines.push({ accountCode: '2103', debit: 0, credit: taxAmount, note: `عكس ضريبة مدخلات لمرتجع مشتريات ${nextInvNumber}` });
            }

            journalEntry = this.storage.addEntry({
                date: invoiceDate,
                description: `مرتجع مشتريات رقم ${nextInvNumber} - ${cleanPartyName}`,
                reference: nextInvNumber,
                lines: returnPurchaseLines
            });

            processedItems.forEach(item => {
                this.storage.addInventoryTransaction({
                    type: 'OUT',
                    warehouseId,
                    productId: item.productId,
                    quantity: item.quantity,
                    unitCost: item.unitPrice,
                    totalCost: item.quantity * item.unitPrice,
                    date: invoiceDate,
                    reference: nextInvNumber,
                    reason: `إخراج مرتجع مشتريات - رقم ${nextInvNumber} للمورد (${cleanPartyName})`,
                    journalEntryId: journalEntry.id
                });
            });
        }

        // 3. حفظ الفاتورة في السجل
        const effectivePayMethod = (remainingAmount > 0 && (type === 'SALES' || type === 'PURCHASE')) ? 'CREDIT' : payMethod;
        const invoice = this.storage.addInvoice({
            id: nextInvNumber,
            number: nextInvNumber,
            type,
            partyName: cleanPartyName,
            partyAccountCode: partyAccountCode || (isSalesFamily ? '1103' : '2101'),
            paymentMethod: effectivePayMethod,
            warehouseId,
            date: invoiceDate,
            items: processedItems,
            subtotal,
            discount: discAmount,
            taxRate: taxRateNum,
            taxAmount,
            totalAmount: grandTotal,
            paidAmount: receivedAmount,
            netPaidAmount,
            changeAmount,
            remainingAmount,
            notes: notes || '',
            journalEntryId: journalEntry ? journalEntry.id : null,
            cogsEntryId: cogsEntry ? cogsEntry.id : null
        });

        return {
            invoice,
            journalEntry,
            cogsEntry
        };
    }

    // ==================== 10. تقرير تحليل أرباح الأصناف والعملاء (Profitability Analytics) ====================
    getProfitabilityReport() {
        const products = this.storage.getProducts();
        const invoices = this.storage.getInvoices();

        const prodStats = {};
        products.forEach(p => {
            prodStats[p.id] = {
                product: p,
                soldQty: 0,
                returnedQty: 0,
                netQty: 0,
                revenue: 0,
                cost: 0,
                profit: 0,
                marginPct: 0
            };
        });

        const customerStats = {};
        const invoiceProfits = [];

        invoices.forEach(inv => {
            if (inv.type !== 'SALES' && inv.type !== 'SALES_RETURN') return;
            const sign = inv.type === 'SALES' ? 1 : -1;
            const subtotal = parseFloat(inv.subtotal) || 0;
            const discount = parseFloat(inv.discount) || 0;
            const discountFactor = subtotal > 0 ? Math.max(0, (subtotal - discount) / subtotal) : 1;

            let invRev = 0;
            let invCost = 0;

            (inv.items || []).forEach(it => {
                const prod = this.storage.getProductById(it.productId);
                const qty = parseFloat(it.quantity) || 0;
                const unitPrice = parseFloat(it.unitPrice) || 0;
                const unitCost = it.unitCost !== undefined ? parseFloat(it.unitCost) : (prod ? (parseFloat(prod.purchasePrice) || 0) : 0);

                const lineNetRev = (qty * unitPrice) * discountFactor;
                const lineCost = qty * unitCost;

                invRev += lineNetRev * sign;
                invCost += lineCost * sign;

                if (!prodStats[it.productId]) {
                    prodStats[it.productId] = {
                        product: prod || { id: it.productId, sku: it.sku || it.productId, name: it.productName || it.productId, unit: it.unit || '' },
                        soldQty: 0,
                        returnedQty: 0,
                        netQty: 0,
                        revenue: 0,
                        cost: 0,
                        profit: 0,
                        marginPct: 0
                    };
                }

                if (sign === 1) {
                    prodStats[it.productId].soldQty += qty;
                } else {
                    prodStats[it.productId].returnedQty += qty;
                }
                prodStats[it.productId].netQty += (qty * sign);
                prodStats[it.productId].revenue += (lineNetRev * sign);
                prodStats[it.productId].cost += (lineCost * sign);
            });

            const invProfit = invRev - invCost;
            const invMargin = Math.abs(invRev) > 0 ? (invProfit / Math.abs(invRev)) * 100 : 0;

            invoiceProfits.push({
                id: inv.id,
                type: inv.type,
                date: inv.date,
                partyName: inv.partyName || 'عميل نقدي',
                revenue: invRev,
                cost: invCost,
                profit: invProfit,
                marginPct: invMargin
            });

            const custName = (inv.partyName || 'عميل نقدي').trim();
            if (!customerStats[custName]) {
                customerStats[custName] = { partyName: custName, invoicesCount: 0, revenue: 0, cost: 0, profit: 0 };
            }
            customerStats[custName].invoicesCount += 1;
            customerStats[custName].revenue += invRev;
            customerStats[custName].cost += invCost;
            customerStats[custName].profit += invProfit;
        });

        let totalRevenue = 0;
        let totalCost = 0;

        const productRows = Object.values(prodStats).map(row => {
            row.profit = row.revenue - row.cost;
            row.marginPct = row.revenue > 0 ? (row.profit / row.revenue) * 100 : 0;
            totalRevenue += row.revenue;
            totalCost += row.cost;
            return row;
        }).sort((a, b) => b.profit - a.profit);

        const customerRows = Object.values(customerStats).map(c => ({
            ...c,
            marginPct: c.revenue > 0 ? (c.profit / c.revenue) * 100 : 0
        })).sort((a, b) => b.profit - a.profit);

        const totalProfit = totalRevenue - totalCost;
        const overallMarginPct = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

        return {
            productRows,
            customerRows,
            invoiceProfits,
            summary: {
                totalRevenue,
                totalCost,
                totalProfit,
                overallMarginPct
            }
        };
    }
}

// كائن المحرك المخزني المشترك
const inventory = new InventoryEngine(storage);

