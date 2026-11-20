// ==========================================================================
// REZORA ENTERPRISE - POS Daily Sales Matrix Logic (مبيعات نقاط البيع اليومية)
// Supports: POS 501, 502, 500, Live Real-time Math, Network Splits, A4 & Thermal Print
// ==========================================================================

// Global state for POS Matrix
let masterPosList = []; // All pre-defined POS points in the system
let currentPosList = []; // Currently active & pinned POS points in the daily matrix
let currentMatrixDate = '';
let currentMatrixData = {}; // keyed by posId: { grossSales, returns, netSales, networks, networkItems: [], actualCash }
let activeNetworkPosId = null;

const DEFAULT_POS_LIST = [
    { id: 'pos_501', name: 'نقطة بيع 501', code: '501', branch: 'المركز الرئيسي' },
    { id: 'pos_502', name: 'نقطة بيع 502', code: '502', branch: 'المركز الرئيسي' },
    { id: 'pos_500', name: 'نقطة بيع 500', code: '500', branch: 'المركز الرئيسي' }
];

/**
 * Format currency with Saudi Riyal and 2 decimals
 */
function formatPosMoney(val) {
    const num = parseFloat(val) || 0;
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Get Today's Date in YYYY-MM-DD
 */
function getTodayIsoDate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Initialize POS Sales Matrix Module
 */
async function initPosSalesMatrix() {
    console.log('Initializing POS Sales Matrix...');

    // 1. Set default date to today if not set
    const dateInput = document.getElementById('posSalesDate');
    if (dateInput) {
        if (!dateInput.value) {
            dateInput.value = getTodayIsoDate();
        }
        currentMatrixDate = dateInput.value;
    } else {
        currentMatrixDate = getTodayIsoDate();
    }

    // 2. Load POS Terminals (Master & Pinned)
    await loadPosTerminals();

    // 3. Load Sales for Selected Date
    await loadPosSalesForDate(currentMatrixDate);
}

/**
 * Load configured POS Terminals (Master & Pinned in Matrix)
 */
async function loadPosTerminals() {
    try {
        // 1. Load Master POS List (all pre-defined terminals)
        let storedMaster = [];
        if (typeof window.getPOS === 'function') {
            storedMaster = await window.getPOS();
        } else {
            storedMaster = JSON.parse(localStorage.getItem('pos_master_data') || localStorage.getItem('pos_data') || '[]');
        }

        if (Array.isArray(storedMaster) && storedMaster.length > 0) {
            masterPosList = storedMaster.map(p => ({
                id: p.id || `pos_${p.name}`,
                name: p.name || 'نقطة بيع',
                code: p.code || (p.name.match(/\d+/) ? p.name.match(/\d+/)[0] : ''),
                branch: p.branch || 'الفرع الرئيسي',
                notes: p.notes || ''
            }));
        } else {
            masterPosList = [...DEFAULT_POS_LIST];
            if (typeof window.savePOS === 'function') {
                await window.savePOS(masterPosList);
            }
            localStorage.setItem('pos_master_data', JSON.stringify(masterPosList));
            localStorage.setItem('pos_data', JSON.stringify(masterPosList));
        }

        // 2. Load Pinned Terminals for Active Daily Matrix
        const storedPinned = JSON.parse(localStorage.getItem('pos_pinned_data') || 'null');
        if (Array.isArray(storedPinned) && storedPinned.length > 0) {
            currentPosList = storedPinned.filter(pinned => masterPosList.some(m => m.id === pinned.id));
            if (currentPosList.length === 0) {
                currentPosList = [...masterPosList];
            }
        } else {
            currentPosList = [...masterPosList];
            localStorage.setItem('pos_pinned_data', JSON.stringify(currentPosList));
        }

        renderPredefinedPosDropdown();
    } catch (e) {
        console.error('Error loading POS terminals:', e);
        masterPosList = [...DEFAULT_POS_LIST];
        currentPosList = [...DEFAULT_POS_LIST];
        renderPredefinedPosDropdown();
    }
}

/**
 * Render Predefined POS Dropdown for Matrix Toolbar
 */
function renderPredefinedPosDropdown() {
    const select = document.getElementById('predefinedPosSelect');
    if (!select) return;

    select.innerHTML = '';

    // Filter points in masterPosList that are NOT currently in currentPosList
    const unpinned = masterPosList.filter(m => !currentPosList.some(p => p.id === m.id));

    if (unpinned.length === 0) {
        const defaultOpt = document.createElement('option');
        defaultOpt.value = '';
        defaultOpt.textContent = '✅ جميع نقاط البيع مثبتة في الجدول';
        select.appendChild(defaultOpt);
        select.disabled = true;
    } else {
        select.disabled = false;
        const defaultOpt = document.createElement('option');
        defaultOpt.value = '';
        defaultOpt.textContent = '➕ اختر نقطة بيع لإضافتها وتثبيتها...';
        select.appendChild(defaultOpt);

        unpinned.forEach(pos => {
            const opt = document.createElement('option');
            opt.value = pos.id;
            opt.textContent = `${pos.name} ${pos.code ? `(رمز: ${pos.code})` : ''} - ${pos.branch || 'الفرع'}`;
            select.appendChild(opt);
        });
    }
}

/**
 * Add Selected Pre-defined POS from Dropdown to Active Matrix
 */
function addSelectedPosFromDropdown() {
    const select = document.getElementById('predefinedPosSelect');
    if (!select || !select.value) {
        alert('يرجى اختيار نقطة بيع من القائمة المنسدلة أولاً.');
        return;
    }

    const posId = select.value;
    const target = masterPosList.find(m => m.id === posId);
    if (!target) return;

    if (!currentPosList.some(p => p.id === posId)) {
        currentPosList.push(target);
        localStorage.setItem('pos_pinned_data', JSON.stringify(currentPosList));

        // Ensure state in currentMatrixData
        if (!currentMatrixData[posId]) {
            currentMatrixData[posId] = {
                grossSales: 0, returns: 0, netSales: 0, networks: 0, networkItems: [], actualCash: 0, notes: ''
            };
        }

        renderPosSalesMatrix();
        renderPredefinedPosDropdown();

        if (typeof showToast === 'function') {
            showToast('success', 'تم التثبيت', `تم تثبيت "${target.name}" في جدول المبيعات اليومي بنجاح.`);
        }
    }
}

/**
 * Unpin / Remove a POS Point from the Active Matrix Table
 */
function unpinPosFromMatrix(posId) {
    const target = currentPosList.find(p => p.id === posId);
    if (!target) return;

    const data = currentMatrixData[posId];
    const hasEnteredData = data && (data.grossSales > 0 || data.returns > 0 || data.networks > 0);

    if (hasEnteredData) {
        if (!confirm(`نقطة البيع "${target.name}" تحتوي على مبالغ مدخلة اليوم. هل أنت متأكد من إلغاء تثبيتها من الجدول؟ (البيانات المسجلة لن تحذف)`)) {
            return;
        }
    }

    currentPosList = currentPosList.filter(p => p.id !== posId);
    localStorage.setItem('pos_pinned_data', JSON.stringify(currentPosList));

    renderPosSalesMatrix();
    renderPredefinedPosDropdown();

    if (typeof showToast === 'function') {
        showToast('info', 'تم إلغاء التثبيت', `تمت إزالة "${target.name}" من الجدول المؤقت. يمكنك إضافتها مجدداً في أي وقت من القائمة المنسدلة.`);
    }
}

/**
 * Load POS Daily Sales for a specific date
 */
async function loadPosSalesForDate(dateStr) {
    if (!dateStr) dateStr = getTodayIsoDate();
    currentMatrixDate = dateStr;

    // Load from local storage / Firestore
    const storageKey = `pos_matrix_sales_${dateStr}`;
    let savedData = {};

    try {
        const local = localStorage.getItem(storageKey);
        if (local) {
            savedData = JSON.parse(local);
        } else {
            // Check if there are sales in main sales repository for this date
            let allSales = [];
            if (typeof window.getSales === 'function') {
                allSales = await window.getSales();
            }
            const dateSales = allSales.filter(s => (s.date || '').split('T')[0] === dateStr);

            // Populate from main sales if available
            dateSales.forEach(s => {
                const matchedPos = currentPosList.find(p => p.name === s.branch || p.id === s.branch);
                if (matchedPos) {
                    savedData[matchedPos.id] = {
                        grossSales: parseFloat(s.grossSales || s.amount || 0),
                        returns: parseFloat(s.returns || 0),
                        netSales: parseFloat(s.netSales || s.amount || 0),
                        networks: parseFloat(s.networkSales || s.networks || 0),
                        networkItems: s.networkItems || [],
                        expectedCash: parseFloat(s.expectedCash || (s.amount - (s.networkSales || 0)) || 0),
                        actualCash: parseFloat(s.actualCash || (s.amount - (s.networkSales || 0)) || 0),
                        diff: parseFloat(s.diff || 0),
                        notes: s.notes || '',
                        isSettled: s.isSettled || false,
                        settledTime: s.settledTime || '',
                        settledAt: s.settledAt || ''
                    };
                }
            });
        }
    } catch (e) {
        console.error('Error loading matrix sales data:', e);
    }

    currentMatrixData = {};

    // Initialize all current POS terminals
    currentPosList.forEach(pos => {
        const existing = savedData[pos.id];
        if (existing) {
            const gross = parseFloat(existing.grossSales) || 0;
            const returns = parseFloat(existing.returns) || 0;
            const net = parseFloat(existing.netSales) || Math.max(0, gross - returns);
            const networks = parseFloat(existing.networks) || 0;
            const expected = typeof existing.expectedCash !== 'undefined' ? parseFloat(existing.expectedCash) : Math.max(0, net - networks);
            const actual = typeof existing.actualCash !== 'undefined' ? parseFloat(existing.actualCash) : 0;
            const diff = typeof existing.diff !== 'undefined' ? parseFloat(existing.diff) : (actual - expected);

            currentMatrixData[pos.id] = {
                grossSales: gross,
                returns: returns,
                netSales: net,
                networks: networks,
                networkItems: Array.isArray(existing.networkItems) ? existing.networkItems : [],
                expectedCash: expected,
                actualCash: actual,
                diff: diff,
                notes: existing.notes || '',
                isSettled: !!existing.isSettled || !!existing.settledTime,
                settledTime: existing.settledTime || '',
                settledAt: existing.settledAt || ''
            };
        } else {
            currentMatrixData[pos.id] = {
                grossSales: 0,
                returns: 0,
                netSales: 0,
                networks: 0,
                networkItems: [],
                expectedCash: 0,
                actualCash: 0,
                diff: 0,
                notes: '',
                isSettled: false,
                settledTime: '',
                settledAt: ''
            };
        }
    });

    renderPosSalesMatrix();
}

/**
 * Render visual badge for cash difference (عجز / زيادة / متطابق)
 */
function renderDiffBadge(diff, gross, actual) {
    if ((!gross || gross === 0) && (!actual || actual === 0)) {
        return `<span style="font-family: var(--font-family-mono); font-size: 0.82rem; color: var(--colors-neutral-7); font-weight: 600;">0.00 ر.س</span>`;
    }
    const val = parseFloat(diff) || 0;
    if (Math.abs(val) < 0.009) {
        return `<span class="badge-diff-pill badge-diff-matching" title="الكاش الفعلي بالدرج يطابق تماماً صافي الكاش المطلوب">✓ 0.00 ر.س (متطابق)</span>`;
    } else if (val < 0) {
        return `<span class="badge-diff-pill badge-diff-deficit" title="عجز في النقدية: الموجود بالدرج أقل من المطلوب">🔻 -${formatPosMoney(Math.abs(val))} ر.س (عجز)</span>`;
    } else {
        return `<span class="badge-diff-pill badge-diff-surplus" title="زيادة في النقدية: الموجود بالدرج أكثر من المطلوب">🔺 +${formatPosMoney(val)} ر.س (زيادة)</span>`;
    }
}

/**
 * Render the POS Sales Matrix Table
 */
function renderPosSalesMatrix() {
    const tbody = document.getElementById('posSalesMatrixBody');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (!currentPosList || currentPosList.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" style="text-align: center; padding: 48px 20px;">
                    <div style="font-size: 2.5rem; margin-bottom: 8px;">🏪</div>
                    <div style="font-size: 1.1rem; font-weight: 700; color: var(--colors-neutral-11);">لا توجد نقاط بيع مثبتة في جدول اليوم</div>
                    <p style="color: var(--colors-neutral-8); font-size: 0.88rem; margin: 4px 0 16px 0;">اختر نقطة بيع من القائمة أعلاه أو قم بتعريف نقاط جديدة لتسجيل مبيعاتها فوراً.</p>
                    <button type="button" class="btn-sap btn-emphasized" onclick="document.getElementById('predefinedPosSelect').focus()" style="font-weight: 600;">
                        ➕ اختر نقطة بيع الآن
                    </button>
                </td>
            </tr>
        `;
        updateMatrixTotals();
        return;
    }

    currentPosList.forEach((pos, idx) => {
        const data = currentMatrixData[pos.id] || {
            grossSales: 0, returns: 0, netSales: 0, networks: 0, networkItems: [], expectedCash: 0, actualCash: 0, diff: 0, isSettled: false, settledTime: ''
        };

        const networkCount = data.networkItems ? data.networkItems.length : 0;
        const countLabel = networkCount > 0 ? `${networkCount} مبالغ` : '0 مبالغ';
        const expectedCash = typeof data.expectedCash !== 'undefined' ? data.expectedCash : Math.max(0, data.netSales - data.networks);
        const diff = typeof data.diff !== 'undefined' ? data.diff : ((data.actualCash || 0) - expectedCash);
        const posCodeText = pos.code ? pos.code : `${idx + 1}`;
        const isSettled = !!data.isSettled && !!data.settledTime;

        const row = document.createElement('tr');
        row.id = `pos-row-${pos.id}`;
        row.className = 'pos-matrix-row';

        row.innerHTML = `
            <!-- 1. نقطة البيع -->
            <td class="pos-name-cell">
                <div class="pos-cell-title">
                    <div class="pos-avatar-badge" title="رمز نقطة البيع: ${posCodeText}">
                        #${posCodeText}
                    </div>
                    <div>
                        <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                            <strong class="pos-title-text">${pos.name}</strong>
                            ${isSettled 
                                ? `<span class="pos-settled-pill" title="تم تسوية وحفظ مبيعات هذه النقطة في تمام ${data.settledTime}">✅ ${data.settledTime}</span>` 
                                : `<span class="pos-pending-pill" title="لم يتم اعتماد تسوية هذه النقطة بعد">⏳ قيد الإدخال</span>`
                            }
                        </div>
                        <div style="display: flex; gap: 8px; align-items: center; margin-top: 3px; font-size: 0.74rem; color: var(--colors-neutral-7);">
                            ${pos.branch ? `<span>🏢 ${pos.branch}</span> • ` : ''}
                            <button type="button" 
                                    onclick="unpinPosFromMatrix('${pos.id}')" 
                                    title="إلغاء تثبيت نقطة البيع من جدول اليوم" 
                                    class="btn-unpin-link">
                                إلغاء التثبيت ✕
                            </button>
                        </div>
                    </div>
                </div>
            </td>

            <!-- 2. إجمالي المبيعات -->
            <td class="pos-input-cell">
                <div class="pos-input-wrapper">
                    <input type="number" 
                           id="gross_${pos.id}" 
                           class="pos-num-input" 
                           step="0.01" 
                           min="0" 
                           placeholder="0.00" 
                           value="${data.grossSales > 0 ? data.grossSales : ''}"
                           oninput="handleMatrixInput('${pos.id}')"
                           onkeydown="handleMatrixKeyNav(event, ${idx}, 0)"
                           onfocus="this.select()"
                           title="إجمالي المبيعات قبل الخصومات">
                    <span class="currency-hint">ر.س</span>
                </div>
            </td>

            <!-- 3. المرتجعات -->
            <td class="pos-input-cell">
                <div class="pos-input-wrapper">
                    <input type="number" 
                           id="returns_${pos.id}" 
                           class="pos-num-input pos-returns-input" 
                           step="0.01" 
                           min="0" 
                           placeholder="0.00" 
                           value="${data.returns > 0 ? data.returns : ''}"
                           oninput="handleMatrixInput('${pos.id}')"
                           onkeydown="handleMatrixKeyNav(event, ${idx}, 1)"
                           onfocus="this.select()"
                           title="مرتجعات المبيعات (تخصم)">
                    <span class="currency-hint" style="color: #DC2626;">ر.س</span>
                </div>
            </td>

            <!-- 4. صافي المبيعات (محسوب) -->
            <td class="pos-calc-cell">
                <div class="pos-calc-value" id="net_${pos.id}" title="صافي المبيعات = إجمالي المبيعات - المرتجعات">
                    ${formatPosMoney(data.netSales)}
                </div>
            </td>

            <!-- 5. الشبكات (تخصم) -->
            <td class="pos-input-cell pos-networks-cell">
                <div class="pos-network-group">
                    <div class="pos-input-wrapper">
                        <input type="number" 
                               id="networks_${pos.id}" 
                               class="pos-num-input pos-network-input" 
                               step="0.01" 
                               min="0" 
                               placeholder="0.00" 
                               value="${data.networks > 0 ? data.networks : ''}"
                               oninput="handleMatrixInput('${pos.id}')"
                               onkeydown="handleMatrixKeyNav(event, ${idx}, 2)"
                               onfocus="this.select()"
                               title="إجمالي مبالغ الشبكة">
                        <span class="currency-hint" style="color: #D97706;">ر.س</span>
                    </div>
                    <button type="button" 
                            class="btn-network-split" 
                            onclick="openNetworkModal('${pos.id}')" 
                            title="عرض وتفصيل مبالغ الشبكة المنفصلة">
                        <span class="badge-split-count" id="count_${pos.id}">${countLabel}</span>
                        <span>➕ تفصيل</span>
                    </button>
                </div>
            </td>

            <!-- 6. الكاش المتوقع (النظام: الصافي - الشبكات) -->
            <td class="pos-calc-cell">
                <div class="pos-expected-value" id="expected_${pos.id}" title="الكاش المتوقع بالنظام = صافي المبيعات - الشبكات">
                    ${formatPosMoney(expectedCash)}
                </div>
            </td>

            <!-- 7. الكاش الفعلي بالدرج (إدخال يدوي) -->
            <td class="pos-input-cell pos-cash-cell">
                <div class="pos-input-wrapper">
                    <input type="number" 
                           id="actual_${pos.id}" 
                           class="pos-num-input pos-actual-cash-input" 
                           step="0.01" 
                           min="0" 
                           placeholder="0.00" 
                           value="${data.actualCash > 0 ? data.actualCash : ''}"
                           oninput="handleMatrixInput('${pos.id}')"
                           onkeydown="handleMatrixKeyNav(event, ${idx}, 3)"
                           onfocus="this.select()"
                           title="الكاش الفعلي الموجود بالدرج (يدوي)">
                    <span class="currency-hint" style="color: #059669;">ر.س</span>
                </div>
            </td>

            <!-- 8. الفرق (المطابقة بين الفعلي والمتوقع) -->
            <td class="pos-calc-cell" style="text-align: center;">
                <div id="diff_${pos.id}">
                    ${renderDiffBadge(diff, data.grossSales, data.actualCash)}
                </div>
            </td>

            <!-- 9. إجراءات (حفظ التسوية / إيصال / A4) -->
            <td class="pos-actions-cell">
                <div class="pos-btn-action-group">
                    <button type="button" 
                            id="btn-save-${pos.id}"
                            class="btn-pos-action ${isSettled ? 'btn-pos-settled' : 'btn-pos-save-row'}" 
                            onclick="saveSinglePosSettlement('${pos.id}')" 
                            title="${isSettled ? `تم الحفظ في تمام ${data.settledTime}. انقر لإعادة الحفظ وتحديث البيانات` : 'حفظ تسوية هذه النقطة الآن واعتمادها'}">
                        <span>${isSettled ? '✓' : '💾'}</span> ${isSettled ? 'محفوظ' : 'حفظ'}
                    </button>
                    <button type="button" 
                            class="btn-pos-action btn-pos-receipt" 
                            onclick="printPosReceipt('${pos.id}')" 
                            title="طباعة إيصال كاشير حراري 80mm">
                        <span>🧾</span> إيصال
                    </button>
                    <button type="button" 
                            class="btn-pos-action btn-pos-a4" 
                            onclick="printPosA4('${pos.id}')" 
                            title="طباعة تقرير تفصيلي مقاس A4">
                        <span>📄</span> A4
                    </button>
                </div>
            </td>
        `;

        tbody.appendChild(row);
    });

    updateMatrixTotals();
}

/**
 * Helper to get a matrix input element by row index and column index
 * Col 0: gross (إجمالي المبيعات)
 * Col 1: returns (المرتجعات)
 * Col 2: networks (الشبكات)
 * Col 3: actual (الكاش الفعلي بالدرج)
 */
function getMatrixInputElement(rowIndex, colIndex) {
    if (!currentPosList || rowIndex < 0 || rowIndex >= currentPosList.length) return null;
    const pos = currentPosList[rowIndex];
    if (!pos) return null;

    let inputId = '';
    if (colIndex === 0) inputId = `gross_${pos.id}`;
    else if (colIndex === 1) inputId = `returns_${pos.id}`;
    else if (colIndex === 2) inputId = `networks_${pos.id}`;
    else if (colIndex === 3) inputId = `actual_${pos.id}`;

    return document.getElementById(inputId);
}

/**
 * Handle Keyboard Navigation for Sales Matrix Inputs (4 Columns):
 * - Enter: Move to next field horizontally (0 -> 1 -> 2 -> 3), then down to the next row's 0
 * - Shift + Enter: Move to previous field
 * - ArrowDown: Move directly to same column in the row BELOW (without changing numbers)
 * - ArrowUp: Move directly to same column in the row ABOVE (without changing numbers)
 */
function handleMatrixKeyNav(event, rowIndex, colIndex) {
    if (event.key === 'Enter') {
        event.preventDefault();
        if (event.shiftKey) {
            // Move backwards
            if (colIndex > 0) {
                const prevInput = getMatrixInputElement(rowIndex, colIndex - 1);
                if (prevInput) { prevInput.focus(); prevInput.select(); }
            } else if (rowIndex > 0) {
                const prevInput = getMatrixInputElement(rowIndex - 1, 3);
                if (prevInput) { prevInput.focus(); prevInput.select(); }
            }
        } else {
            // Move forward (next column or next row)
            if (colIndex < 3) {
                const nextInput = getMatrixInputElement(rowIndex, colIndex + 1);
                if (nextInput) { nextInput.focus(); nextInput.select(); }
            } else if (rowIndex + 1 < currentPosList.length) {
                const nextInput = getMatrixInputElement(rowIndex + 1, 0);
                if (nextInput) { nextInput.focus(); nextInput.select(); }
            } else {
                // At the last input of the table -> focus the save button
                const saveBtn = document.getElementById('btnSavePosMatrix');
                if (saveBtn) {
                    saveBtn.focus();
                } else {
                    const firstInput = getMatrixInputElement(0, 0);
                    if (firstInput) { firstInput.focus(); firstInput.select(); }
                }
            }
        }
    } else if (event.key === 'ArrowDown') {
        event.preventDefault(); // Prevent native number decrement
        const targetRow = (rowIndex + 1 < currentPosList.length) ? rowIndex + 1 : 0;
        const targetInput = getMatrixInputElement(targetRow, colIndex);
        if (targetInput) {
            targetInput.focus();
            targetInput.select();
        }
    } else if (event.key === 'ArrowUp') {
        event.preventDefault(); // Prevent native number increment
        const targetRow = (rowIndex - 1 >= 0) ? rowIndex - 1 : (currentPosList.length - 1);
        const targetInput = getMatrixInputElement(targetRow, colIndex);
        if (targetInput) {
            targetInput.focus();
            targetInput.select();
        }
    } else if (event.key === 'ArrowLeft') {
        // In RTL: ArrowLeft moves forward to the next cell
        event.preventDefault();
        if (colIndex < 3) {
            const nextInput = getMatrixInputElement(rowIndex, colIndex + 1);
            if (nextInput) { nextInput.focus(); nextInput.select(); }
        } else if (rowIndex + 1 < currentPosList.length) {
            const nextInput = getMatrixInputElement(rowIndex + 1, 0);
            if (nextInput) { nextInput.focus(); nextInput.select(); }
        }
    } else if (event.key === 'ArrowRight') {
        // In RTL: ArrowRight moves backward to previous cell
        event.preventDefault();
        if (colIndex > 0) {
            const prevInput = getMatrixInputElement(rowIndex, colIndex - 1);
            if (prevInput) { prevInput.focus(); prevInput.select(); }
        } else if (rowIndex > 0) {
            const prevInput = getMatrixInputElement(rowIndex - 1, 3);
            if (prevInput) { prevInput.focus(); prevInput.select(); }
        }
    }
}

// Global safeguard: prevent mouse wheel scrolling from changing any number inputs
if (!window._posWheelSafeguardAttached) {
    window._posWheelSafeguardAttached = true;
    document.addEventListener('wheel', function (e) {
        if (document.activeElement && document.activeElement.type === 'number') {
            document.activeElement.blur();
        }
    }, { passive: true });
}

/**
 * Handle real-time input change for a POS terminal
 */
function handleMatrixInput(posId) {
    const grossInput = document.getElementById(`gross_${posId}`);
    const returnsInput = document.getElementById(`returns_${posId}`);
    const networksInput = document.getElementById(`networks_${posId}`);
    const actualInput = document.getElementById(`actual_${posId}`);

    const gross = grossInput ? (parseFloat(grossInput.value) || 0) : (currentMatrixData[posId]?.grossSales || 0);
    const returns = returnsInput ? (parseFloat(returnsInput.value) || 0) : (currentMatrixData[posId]?.returns || 0);
    const networks = networksInput ? (parseFloat(networksInput.value) || 0) : (currentMatrixData[posId]?.networks || 0);
    const actualCash = actualInput ? (parseFloat(actualInput.value) || 0) : (currentMatrixData[posId]?.actualCash || 0);

    // Calculations
    const netSales = Math.max(0, gross - returns);
    const expectedCash = Math.max(0, netSales - networks);
    const diff = actualCash - expectedCash;

    // Update state
    if (!currentMatrixData[posId]) {
        currentMatrixData[posId] = { networkItems: [] };
    }
    currentMatrixData[posId].grossSales = gross;
    currentMatrixData[posId].returns = returns;
    currentMatrixData[posId].netSales = netSales;
    currentMatrixData[posId].networks = networks;
    currentMatrixData[posId].expectedCash = expectedCash;
    currentMatrixData[posId].actualCash = actualCash;
    currentMatrixData[posId].diff = diff;

    // Update UI elements
    const netEl = document.getElementById(`net_${posId}`);
    if (netEl) netEl.textContent = formatPosMoney(netSales);

    const expectedEl = document.getElementById(`expected_${posId}`);
    if (expectedEl) expectedEl.textContent = formatPosMoney(expectedCash);

    const diffEl = document.getElementById(`diff_${posId}`);
    if (diffEl) diffEl.innerHTML = renderDiffBadge(diff, gross, actualCash);

    // If point was previously settled and edited, indicate update is needed
    const saveBtn = document.getElementById(`btn-save-${posId}`);
    if (saveBtn && currentMatrixData[posId]?.isSettled) {
        saveBtn.className = 'btn-pos-action btn-pos-save-row';
        saveBtn.innerHTML = '<span>💾</span> تحديث';
        saveBtn.title = 'تم تعديل الأرقام. اضغط لاعتماد التسوية المحدثة';
    }

    // Re-calculate totals row
    updateMatrixTotals();
}

/**
 * Update the bottom Totals Row (الإجمالي) and Live Executive KPI Cards
 */
function updateMatrixTotals() {
    let totalGross = 0;
    let totalReturns = 0;
    let totalNet = 0;
    let totalNetworks = 0;
    let totalExpected = 0;
    let totalCash = 0;

    currentPosList.forEach(pos => {
        const d = currentMatrixData[pos.id] || {};
        totalGross += parseFloat(d.grossSales) || 0;
        totalReturns += parseFloat(d.returns) || 0;
        totalNet += parseFloat(d.netSales) || 0;
        totalNetworks += parseFloat(d.networks) || 0;
        totalExpected += parseFloat(d.expectedCash) || 0;
        totalCash += parseFloat(d.actualCash) || 0;
    });

    const totalDiff = totalCash - totalExpected;

    // 1. Table Footer Elements
    const totalGrossEl = document.getElementById('totalMatrixGross');
    const totalReturnsEl = document.getElementById('totalMatrixReturns');
    const totalNetEl = document.getElementById('totalMatrixNet');
    const totalNetworksEl = document.getElementById('totalMatrixNetworks');
    const totalExpectedEl = document.getElementById('totalMatrixExpected');
    const totalCashEl = document.getElementById('totalMatrixActualCash');
    const totalDiffEl = document.getElementById('totalMatrixDiff');

    if (totalGrossEl) totalGrossEl.textContent = formatPosMoney(totalGross);
    if (totalReturnsEl) totalReturnsEl.textContent = formatPosMoney(totalReturns);
    if (totalNetEl) totalNetEl.textContent = formatPosMoney(totalNet);
    if (totalNetworksEl) totalNetworksEl.textContent = formatPosMoney(totalNetworks);
    if (totalExpectedEl) totalExpectedEl.textContent = formatPosMoney(totalExpected);
    if (totalCashEl) totalCashEl.textContent = formatPosMoney(totalCash);
    if (totalDiffEl) totalDiffEl.innerHTML = renderDiffBadge(totalDiff, totalGross, totalCash);

    // 2. Top Executive Live KPI Cards (if present in DOM)
    const liveGross = document.getElementById('livePosGross');
    const liveReturns = document.getElementById('livePosReturns');
    const liveNet = document.getElementById('livePosNet');
    const liveNetworks = document.getElementById('livePosNetworks');
    const liveExpected = document.getElementById('livePosExpected');
    const liveActual = document.getElementById('livePosActual');
    const liveDiffBadge = document.getElementById('livePosDiffBadge');

    if (liveGross) liveGross.textContent = formatPosMoney(totalGross) + ' ر.س';
    if (liveReturns) liveReturns.textContent = formatPosMoney(totalReturns) + ' ر.س';
    if (liveNet) liveNet.textContent = formatPosMoney(totalNet) + ' ر.س';
    if (liveNetworks) liveNetworks.textContent = formatPosMoney(totalNetworks) + ' ر.س';
    if (liveExpected) liveExpected.textContent = formatPosMoney(totalExpected) + ' ر.س';
    if (liveActual) liveActual.textContent = formatPosMoney(totalCash) + ' ر.س';
    if (liveDiffBadge) liveDiffBadge.innerHTML = renderDiffBadge(totalDiff, totalGross, totalCash);

    // 3. Top Hero Session Badge Status
    const sessionBadge = document.getElementById('posSessionBadge');
    const sessionBadgeText = document.getElementById('posSessionBadgeText');
    if (sessionBadge && sessionBadgeText) {
        const todayIso = getTodayIsoDate();
        const curDate = currentMatrixDate || todayIso;
        if (curDate === todayIso) {
            sessionBadge.className = 'badge-pill badge-pill-success';
            sessionBadgeText.textContent = 'جلسة اليوم نشطة';
        } else if (curDate < todayIso) {
            sessionBadge.className = 'badge-pill badge-pill-neutral';
            sessionBadgeText.textContent = `سجل معتمد (${curDate})`;
        } else {
            sessionBadge.className = 'badge-pill badge-pill-warning';
            sessionBadgeText.textContent = `تاريخ مستقبلي (${curDate})`;
        }
    }
}

/**
 * Save single POS settlement independently with exact timestamp
 * Allows closing and saving POS terminals at different shift hours (e.g. 4 PM, 8 PM, 12 AM)
 */
async function saveSinglePosSettlement(posId) {
    const saveBtn = document.getElementById(`btn-save-${posId}`);
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '⏳...';
    }

    try {
        handleMatrixInput(posId);
        const pos = currentPosList.find(p => p.id === posId);
        if (!pos) return;

        const date = currentMatrixDate || getTodayIsoDate();
        const d = currentMatrixData[posId] || {};

        const now = new Date();
        const timeStr = now.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit', hour12: true });
        const isoTime = now.toISOString();

        // 1. Mark this POS as settled with its timestamp
        d.isSettled = true;
        d.settledTime = timeStr;
        d.settledAt = isoTime;
        d.settledDate = date;
        currentMatrixData[posId] = d;

        // 2. Persist matrix storage for this date (merging with all points)
        const storageKey = `pos_matrix_sales_${date}`;
        localStorage.setItem(storageKey, JSON.stringify(currentMatrixData));

        // 3. Upsert into Main Sales table (leaving other points intact)
        let mainSales = [];
        if (typeof window.getSales === 'function') {
            mainSales = await window.getSales();
        } else {
            try {
                mainSales = JSON.parse(localStorage.getItem('sales_data') || '[]');
            } catch (e) {
                mainSales = [];
            }
        }

        const recordId = `pos_sale_${posId}_${date}`;
        // Remove prior record for this specific POS & date only
        mainSales = mainSales.filter(s => s.id !== recordId && !(s.branch === pos.name && (s.date || '').split('T')[0] === date));

        const netSales = parseFloat(d.netSales) || 0;
        const grossSales = parseFloat(d.grossSales) || 0;
        const returns = parseFloat(d.returns) || 0;
        const networks = parseFloat(d.networks) || 0;
        const expectedCash = typeof d.expectedCash !== 'undefined' ? parseFloat(d.expectedCash) : Math.max(0, netSales - networks);
        const actualCash = parseFloat(d.actualCash) || 0;
        const diff = typeof d.diff !== 'undefined' ? parseFloat(d.diff) : (actualCash - expectedCash);

        // Add this POS record
        mainSales.push({
            id: recordId,
            date: date,
            branch: pos.name,
            amount: netSales,
            grossSales: grossSales,
            returns: returns,
            netSales: netSales,
            networkSales: networks,
            networkItems: d.networkItems || [],
            expectedCash: expectedCash,
            actualCash: actualCash,
            diff: diff,
            description: `تسوية نقطة بيع (${pos.name}) - الساعة ${timeStr}`,
            notes: `تسوية معتمدة في تمام ${timeStr} | إجمالي: ${formatPosMoney(grossSales)} | مرتجع: ${formatPosMoney(returns)} | شبكات: ${formatPosMoney(networks)} | كاش متوقع: ${formatPosMoney(expectedCash)} | كاش فعلي: ${formatPosMoney(actualCash)} | فرق: ${formatPosMoney(diff)}`,
            isPosMatrix: true,
            isSettled: true,
            settledTime: timeStr,
            settledAt: isoTime,
            updatedAt: isoTime
        });

        if (typeof window.saveSales === 'function') {
            await window.saveSales(mainSales);
        } else {
            localStorage.setItem('sales_data', JSON.stringify(mainSales));
        }

        // 4. Notify app components & update dashboard
        window.dispatchEvent(new CustomEvent('salesUpdated', { detail: mainSales }));
        if (typeof updateDashboard === 'function') updateDashboard();

        // 5. Re-render table to display updated badge and state
        renderPosSalesMatrix();

        if (typeof showToast === 'function') {
            showToast('success', `تم حفظ تسوية (${pos.name})`, `تم اعتماد تسوية نقطة البيع في تمام الساعة ${timeStr} بنجاح.`);
        }
    } catch (err) {
        console.error('Error saving single POS settlement:', err);
        if (typeof showToast === 'function') {
            showToast('error', 'خطأ في الحفظ', 'تعذر حفظ تسوية نقطة البيع.');
        } else {
            alert('تعذر حفظ تسوية نقطة البيع.');
        }
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<span>💾</span> حفظ';
        }
    }
}

/**
 * Save all POS matrix sales for the current date (bulk save)
 */
async function savePosSalesMatrix() {
    const saveBtn = document.getElementById('btnSavePosMatrix');
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '⏳ جاري الحفظ...';
    }

    try {
        const date = currentMatrixDate || getTodayIsoDate();
        const now = new Date();
        const currentTimeStr = now.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit', hour12: true });
        const currentIso = now.toISOString();

        // 1. Sync with Main Sales Table & Reconciliations
        let mainSales = [];
        if (typeof window.getSales === 'function') {
            mainSales = await window.getSales();
        } else {
            try {
                mainSales = JSON.parse(localStorage.getItem('sales_data') || '[]');
            } catch (e) {
                mainSales = [];
            }
        }

        // Remove previous records for this date from the current POS terminals
        const currentPosNames = currentPosList.map(p => p.name);
        mainSales = mainSales.filter(s => {
            const isSameDate = (s.date || '').split('T')[0] === date;
            const isPos = currentPosNames.includes(s.branch);
            return !(isSameDate && isPos);
        });

        // Add each POS entry with non-zero or recorded sales
        currentPosList.forEach(pos => {
            const d = currentMatrixData[pos.id];
            if (d && (d.grossSales > 0 || d.netSales > 0 || d.networks > 0 || d.actualCash > 0)) {
                // Preserve existing individual settlement time if already settled, else stamp current
                const pointSettledTime = d.settledTime || currentTimeStr;
                const pointSettledAt = d.settledAt || currentIso;
                d.isSettled = true;
                d.settledTime = pointSettledTime;
                d.settledAt = pointSettledAt;
                d.settledDate = date;

                const expected = typeof d.expectedCash !== 'undefined' ? d.expectedCash : Math.max(0, d.netSales - d.networks);
                const actual = d.actualCash || 0;
                const diff = typeof d.diff !== 'undefined' ? d.diff : (actual - expected);

                mainSales.push({
                    id: `pos_sale_${pos.id}_${date}`,
                    date: date,
                    branch: pos.name,
                    amount: d.netSales, // Net sales counts towards overall company turnover
                    grossSales: d.grossSales,
                    returns: d.returns,
                    netSales: d.netSales,
                    networkSales: d.networks,
                    networkItems: d.networkItems || [],
                    expectedCash: expected,
                    actualCash: actual,
                    diff: diff,
                    description: `مبيعات يومية - ${pos.name} (${pointSettledTime})`,
                    notes: `تسوية (${pointSettledTime}) | إجمالي: ${d.grossSales} | مرتجع: ${d.returns} | شبكات: ${d.networks} | كاش متوقع: ${formatPosMoney(expected)} | كاش فعلي: ${formatPosMoney(actual)} | فرق: ${formatPosMoney(diff)}`,
                    isPosMatrix: true,
                    isSettled: true,
                    settledTime: pointSettledTime,
                    settledAt: pointSettledAt,
                    updatedAt: currentIso
                });
            }
        });

        // Save updated matrix data (with updated settlement flags)
        const storageKey = `pos_matrix_sales_${date}`;
        localStorage.setItem(storageKey, JSON.stringify(currentMatrixData));

        if (typeof window.saveSales === 'function') {
            await window.saveSales(mainSales);
        } else {
            localStorage.setItem('sales_data', JSON.stringify(mainSales));
        }

        // 3. Notify app components
        window.dispatchEvent(new CustomEvent('salesUpdated', { detail: mainSales }));
        if (typeof updateDashboard === 'function') updateDashboard();

        // 4. Re-render matrix to show updated badges
        renderPosSalesMatrix();

        if (typeof showToast === 'function') {
            showToast('success', 'تم الحفظ والاعتماد بنجاح', `تم حفظ واعتماد تسوية نقاط البيع لتاريخ ${date} وتحديث كافة المؤشرات.`);
        } else {
            alert(`تم حفظ مبيعات نقاط البيع لتاريخ ${date} بنجاح!`);
        }

    } catch (error) {
        console.error('Error saving POS sales matrix:', error);
        if (typeof showToast === 'function') {
            showToast('error', 'خطأ في الحفظ', 'حدث خطأ أثناء حفظ مبيعات نقاط البيع.');
        } else {
            alert('حدث خطأ أثناء حفظ البيانات.');
        }
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '💾 حفظ واعتماد الكل';
        }
    }
}

/**
 * Change Matrix Date
 */
function handlePosDateChange(dateValue) {
    if (!dateValue) return;
    loadPosSalesForDate(dateValue);
}

/**
 * Step Date forward or backward
 */
function stepPosDate(days) {
    const dateInput = document.getElementById('posSalesDate');
    if (!dateInput || !dateInput.value) return;

    const current = new Date(dateInput.value);
    current.setDate(current.getDate() + days);

    const year = current.getFullYear();
    const month = String(current.getMonth() + 1).padStart(2, '0');
    const day = String(current.getDate()).padStart(2, '0');
    const newDate = `${year}-${month}-${day}`;

    dateInput.value = newDate;
    handlePosDateChange(newDate);
}

/**
 * Set Matrix Date to Today
 */
function setPosDateToday() {
    const today = getTodayIsoDate();
    const dateInput = document.getElementById('posSalesDate');
    if (dateInput) {
        dateInput.value = today;
    }
    handlePosDateChange(today);
}

// ==========================================================================
// Network Breakdown Modal (تفصيل مبالغ الشبكات)
// ==========================================================================

function openNetworkModal(posId) {
    activeNetworkPosId = posId;
    const pos = currentPosList.find(p => p.id === posId);
    const data = currentMatrixData[posId] || { networks: 0, networkItems: [] };

    const modal = document.getElementById('networkBreakdownModal');
    const title = document.getElementById('networkModalTitle');
    const listContainer = document.getElementById('networkItemsList');

    if (title && pos) {
        title.textContent = `تفصيل مبالغ الشبكة - ${pos.name}`;
    }

    if (listContainer) {
        listContainer.innerHTML = '';
        const items = data.networkItems || [];

        if (items.length === 0 && data.networks > 0) {
            // Pre-populate with single existing network amount
            addNetworkItemRow(data.networks, 'شبكة مدى');
        } else if (items.length === 0) {
            // Empty row
            addNetworkItemRow('', 'شبكة مدى');
        } else {
            items.forEach(item => {
                addNetworkItemRow(item.amount, item.type || 'شبكة مدى');
            });
        }
    }

    calculateNetworkModalTotal();
    if (modal) modal.style.display = 'flex';
}

function closeNetworkModal() {
    const modal = document.getElementById('networkBreakdownModal');
    if (modal) modal.style.display = 'none';
    activeNetworkPosId = null;
}

function handleNetworkKeyNav(event, inputEl) {
    if (event.key === 'Enter') {
        event.preventDefault();
        const allInputs = Array.from(document.querySelectorAll('.network-amount-input'));
        const idx = allInputs.indexOf(inputEl);
        if (idx !== -1 && idx < allInputs.length - 1) {
            allInputs[idx + 1].focus();
            allInputs[idx + 1].select();
        } else {
            addNetworkItemRow('', 'شبكة مدى');
            const updatedInputs = document.querySelectorAll('.network-amount-input');
            const lastInput = updatedInputs[updatedInputs.length - 1];
            if (lastInput) {
                lastInput.focus();
                lastInput.select();
            }
        }
    } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        const allInputs = Array.from(document.querySelectorAll('.network-amount-input'));
        const idx = allInputs.indexOf(inputEl);
        if (idx !== -1 && idx < allInputs.length - 1) {
            allInputs[idx + 1].focus();
            allInputs[idx + 1].select();
        }
    } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        const allInputs = Array.from(document.querySelectorAll('.network-amount-input'));
        const idx = allInputs.indexOf(inputEl);
        if (idx > 0) {
            allInputs[idx - 1].focus();
            allInputs[idx - 1].select();
        }
    }
}

function addNetworkItemRow(amount = '', type = 'شبكة مدى') {
    const listContainer = document.getElementById('networkItemsList');
    if (!listContainer) return;

    const row = document.createElement('div');
    row.className = 'network-item-row';
    row.style.cssText = 'display: flex; gap: 8px; align-items: center; margin-bottom: 8px;';

    row.innerHTML = `
        <select class="sap-input network-type-select" style="width: 140px; height: 36px; padding: 4px 8px; font-size: 0.85rem;">
            <option value="شبكة مدى" ${type === 'شبكة مدى' ? 'selected' : ''}>شبكة مدى</option>
            <option value="فيزا / ماستركارد" ${type === 'فيزا / ماستركارد' ? 'selected' : ''}>فيزا / ماستر</option>
            <option value="أبل باي" ${type === 'أبل باي' ? 'selected' : ''}>أبل باي</option>
            <option value="أخرى" ${type === 'أخرى' ? 'selected' : ''}>عملية أخرى</option>
        </select>
        <input type="number" 
               class="sap-input network-amount-input" 
               step="0.01" 
               placeholder="المبلغ (0.00)" 
               value="${amount}" 
               style="flex: 1; height: 36px; font-family: var(--font-family-mono); text-align: left;"
               oninput="calculateNetworkModalTotal()"
               onfocus="this.select()"
               onkeydown="handleNetworkKeyNav(event, this)">
        <button type="button" 
                class="btn-sap btn-transparent" 
                onclick="this.parentElement.remove(); calculateNetworkModalTotal();" 
                style="color: var(--cds-support-error, #DA1E28); font-size: 1.1rem; padding: 4px 8px;">
            ✖
        </button>
    `;

    listContainer.appendChild(row);
}

function calculateNetworkModalTotal() {
    const inputs = document.querySelectorAll('.network-amount-input');
    let sum = 0;
    let count = 0;

    inputs.forEach(inp => {
        const val = parseFloat(inp.value);
        if (!isNaN(val) && val > 0) {
            sum += val;
            count++;
        }
    });

    const totalEl = document.getElementById('networkModalTotal');
    const countEl = document.getElementById('networkModalCount');

    if (totalEl) totalEl.textContent = formatPosMoney(sum);
    if (countEl) countEl.textContent = `${count} مبالغ`;
}

function saveNetworkBreakdown() {
    if (!activeNetworkPosId) return;

    const rows = document.querySelectorAll('.network-item-row');
    const items = [];
    let total = 0;

    rows.forEach(r => {
        const type = r.querySelector('.network-type-select').value;
        const amt = parseFloat(r.querySelector('.network-amount-input').value) || 0;
        if (amt > 0) {
            items.push({ type, amount: amt });
            total += amt;
        }
    });

    if (!currentMatrixData[activeNetworkPosId]) {
        currentMatrixData[activeNetworkPosId] = {};
    }

    currentMatrixData[activeNetworkPosId].networkItems = items;
    currentMatrixData[activeNetworkPosId].networks = total;

    // Update table input
    const networkInput = document.getElementById(`networks_${activeNetworkPosId}`);
    if (networkInput) {
        networkInput.value = total > 0 ? total : '';
    }

    // Update count badge
    const countBadge = document.getElementById(`count_${activeNetworkPosId}`);
    if (countBadge) {
        countBadge.textContent = items.length > 0 ? `${items.length} مبالغ` : '0 مبالغ';
    }

    // Re-trigger row calculations
    handleMatrixInput(activeNetworkPosId);

    closeNetworkModal();
}

// ==========================================================================
// Master POS Terminals Management (إدارة وتعريف نقاط البيع مسبقاً)
// ==========================================================================

async function openMasterPosModal() {
    const modal = document.getElementById('masterPosManagerModal');
    if (!modal) return;

    // Load available branches into select dropdown
    const branchSelect = document.getElementById('masterPosBranch');
    if (branchSelect) {
        branchSelect.innerHTML = '<option value="">-- اختر الفرع التابع له --</option>';
        try {
            let branches = [];
            if (typeof window.getBranches === 'function') {
                branches = await window.getBranches();
            } else {
                branches = JSON.parse(localStorage.getItem('branches_data') || '[]');
            }
            branches.forEach(b => {
                const opt = document.createElement('option');
                opt.value = b.name;
                opt.textContent = b.name;
                branchSelect.appendChild(opt);
            });
        } catch (err) {
            console.error('Error loading branches in master POS modal:', err);
        }
    }

    // Reset inputs
    const nameInput = document.getElementById('masterPosName');
    const codeInput = document.getElementById('masterPosCode');
    const notesInput = document.getElementById('masterPosNotes');
    const pinCheck = document.getElementById('masterPosPinCheck');

    if (nameInput) nameInput.value = '';
    if (codeInput) codeInput.value = '';
    if (notesInput) notesInput.value = '';
    if (pinCheck) pinCheck.checked = true;

    const companyInput = document.getElementById('posCompanyNameInput');
    if (companyInput) companyInput.value = getPosCompanyName();

    renderMasterPosTable();
    modal.style.display = 'flex';
}

function closeMasterPosModal() {
    const modal = document.getElementById('masterPosManagerModal');
    if (modal) modal.style.display = 'none';
}

/**
 * Render Table of All Pre-defined Master POS Terminals
 */
function renderMasterPosTable() {
    const tbody = document.getElementById('masterPosTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (masterPosList.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 2rem; color: var(--colors-neutral-7);">
                    لا توجد نقاط بيع معرفة مسبقاً. استخدم النموذج أعلاه لإضافة نقطة جديدة.
                </td>
            </tr>
        `;
        return;
    }

    masterPosList.forEach((pos, idx) => {
        const isPinned = currentPosList.some(p => p.id === pos.id);
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-family: var(--font-family-mono); font-weight: 600;">${idx + 1}</td>
            <td>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 1.1rem;">🏪</span>
                    <strong>${pos.name}</strong>
                </div>
                ${pos.notes ? `<small style="color: var(--colors-neutral-7); display: block;">${pos.notes}</small>` : ''}
            </td>
            <td>
                <span class="pos-code-tag">${pos.code || '---'}</span>
            </td>
            <td>
                <span style="font-size: 0.82rem; color: var(--colors-neutral-8);">${pos.branch || 'الفرع الرئيسي'}</span>
            </td>
            <td>
                ${isPinned 
                    ? `<span class="badge-pill badge-pill-success" style="font-size: 0.72rem;">📌 مثبتة بالجدول</span>` 
                    : `<span class="badge-pill" style="background: var(--colors-neutral-3); color: var(--colors-neutral-7); font-size: 0.72rem;">غير مثبتة</span>`}
            </td>
            <td style="text-align: center;">
                <div style="display: flex; gap: 6px; justify-content: center;">
                    <button type="button" 
                            class="btn-sap btn-standard" 
                            onclick="togglePinMasterPos('${pos.id}')" 
                            style="padding: 3px 8px; font-size: 0.75rem;">
                        ${isPinned ? 'إلغاء التثبيت' : '📌 تثبيت بالجدول'}
                    </button>
                    <button type="button" 
                            class="btn-sap btn-critical" 
                            onclick="deleteMasterPosTerminal('${pos.id}')" 
                            style="padding: 3px 8px; font-size: 0.75rem;" 
                            title="حذف نقطة البيع نهائياً">
                        🗑️
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

/**
 * Save / Pre-define a new POS Terminal into Master Repository
 */
async function saveMasterPosTerminal(e) {
    if (e) e.preventDefault();
    const nameInput = document.getElementById('masterPosName');
    const codeInput = document.getElementById('masterPosCode');
    const branchSelect = document.getElementById('masterPosBranch');
    const notesInput = document.getElementById('masterPosNotes');
    const pinCheck = document.getElementById('masterPosPinCheck');

    const name = (nameInput ? nameInput.value : '').trim();
    const code = (codeInput ? codeInput.value : '').trim();
    const branch = (branchSelect ? branchSelect.value : '').trim();
    const notes = (notesInput ? notesInput.value : '').trim();
    const isPinned = pinCheck ? pinCheck.checked : true;

    if (!name) {
        alert('يرجى إدخال اسم نقطة البيع.');
        return;
    }

    if (masterPosList.some(p => p.name.trim().toLowerCase() === name.toLowerCase())) {
        alert('نقطة البيع موجودة مسبقاً بنفس الاسم!');
        return;
    }

    const newPos = {
        id: `pos_${Date.now()}`,
        name: name,
        code: code || (name.match(/\d+/) ? name.match(/\d+/)[0] : ''),
        branch: branch || 'المركز الرئيسي',
        notes: notes,
        createdAt: new Date().toISOString()
    };

    masterPosList.push(newPos);
    localStorage.setItem('pos_master_data', JSON.stringify(masterPosList));
    localStorage.setItem('pos_data', JSON.stringify(masterPosList));
    if (typeof window.savePOS === 'function') {
        await window.savePOS(masterPosList);
    }

    // Also register in branches if selected or not existing
    if (typeof window.getBranches === 'function' && typeof window.saveBranches === 'function') {
        const branches = await window.getBranches();
        if (branch && !branches.some(b => b.name === branch)) {
            branches.push({ id: `b_${Date.now()}`, name: branch, createdAt: new Date().toISOString() });
            await window.saveBranches(branches);
            window.dispatchEvent(new CustomEvent('branchesUpdated', { detail: branches }));
        }
    }

    // Pin to active matrix if requested
    if (isPinned && !currentPosList.some(p => p.id === newPos.id)) {
        currentPosList.push(newPos);
        localStorage.setItem('pos_pinned_data', JSON.stringify(currentPosList));
        if (!currentMatrixData[newPos.id]) {
            currentMatrixData[newPos.id] = {
                grossSales: 0, returns: 0, netSales: 0, networks: 0, networkItems: [], actualCash: 0, notes: ''
            };
        }
    }

    // Reset form fields
    if (nameInput) nameInput.value = '';
    if (codeInput) codeInput.value = '';
    if (notesInput) notesInput.value = '';

    renderMasterPosTable();
    renderPosSalesMatrix();
    renderPredefinedPosDropdown();

    if (typeof showToast === 'function') {
        showToast('success', 'تم تعريف نقطة البيع', `تمت إضافة "${name}" بنجاح ${isPinned ? 'وتثبيتها في الجدول' : ''}.`);
    }
}

/**
 * Toggle Pinning a Master POS in or out of the Active Matrix
 */
function togglePinMasterPos(posId) {
    const target = masterPosList.find(p => p.id === posId);
    if (!target) return;

    const isPinned = currentPosList.some(p => p.id === posId);
    if (isPinned) {
        currentPosList = currentPosList.filter(p => p.id !== posId);
    } else {
        currentPosList.push(target);
        if (!currentMatrixData[posId]) {
            currentMatrixData[posId] = {
                grossSales: 0, returns: 0, netSales: 0, networks: 0, networkItems: [], actualCash: 0, notes: ''
            };
        }
    }

    localStorage.setItem('pos_pinned_data', JSON.stringify(currentPosList));
    renderMasterPosTable();
    renderPosSalesMatrix();
    renderPredefinedPosDropdown();

    if (typeof showToast === 'function') {
        showToast('info', isPinned ? 'تم إلغاء التثبيت' : 'تم التثبيت بالجدول', `تم تحديث حالة تثبيت "${target.name}".`);
    }
}

/**
 * Delete a POS Terminal permanently from Master List
 */
async function deleteMasterPosTerminal(posId) {
    const target = masterPosList.find(p => p.id === posId);
    if (!target) return;

    if (!confirm(`هل أنت متأكد من حذف نقطة البيع "${target.name}" نهائياً من قائمة نقاط البيع؟`)) {
        return;
    }

    masterPosList = masterPosList.filter(p => p.id !== posId);
    currentPosList = currentPosList.filter(p => p.id !== posId);

    localStorage.setItem('pos_master_data', JSON.stringify(masterPosList));
    localStorage.setItem('pos_data', JSON.stringify(masterPosList));
    localStorage.setItem('pos_pinned_data', JSON.stringify(currentPosList));
    if (typeof window.savePOS === 'function') {
        await window.savePOS(masterPosList);
    }

    renderMasterPosTable();
    renderPosSalesMatrix();
    renderPredefinedPosDropdown();

    if (typeof showToast === 'function') {
        showToast('warning', 'تم الحذف', `تم حذف نقطة البيع "${target.name}".`);
    }
}

// Quick Add POS backward-compatible aliases
function openAddPosModal() {
    openMasterPosModal();
}

function closeAddPosModal() {
    closeMasterPosModal();
}

async function saveNewPosTerminal(e) {
    await saveMasterPosTerminal(e);
}

// ==========================================================================
// Company Information & Printing Helpers
// ==========================================================================

/**
 * Retrieve the active company name for receipt headers
 */
function getPosCompanyName() {
    return localStorage.getItem('pos_company_name') || 'شركة ركن العمارية';
}

/**
 * Save company name to localStorage
 */
function savePosCompanyName(name) {
    const clean = (name || '').trim();
    if (clean) {
        localStorage.setItem('pos_company_name', clean);
    }
    return getPosCompanyName();
}

/**
 * Handle Save Company Name button inside Master POS Modal
 */
function savePosCompanyNameFromModal() {
    const input = document.getElementById('posCompanyNameInput');
    const val = input ? input.value.trim() : '';
    if (!val) {
        alert('يرجى إدخال اسم الشركة.');
        return;
    }
    savePosCompanyName(val);
    if (typeof showToast === 'function') {
        showToast('success', 'تم حفظ اسم الشركة', `تم اعتماد "${val}" كاسم معتمد في ترويسة جميع الإيصالات.`);
    } else {
        alert(`تم حفظ اسم الشركة: ${val}`);
    }
}

/**
 * Helper to render individual network items (الشبكات إفرادي) for thermal receipts
 */
function renderThermalNetworkItemsHtml(data, networks) {
    const items = (data && Array.isArray(data.networkItems)) ? data.networkItems : [];
    
    if (items.length > 0) {
        return `
            <tr>
                <td colspan="2" style="font-weight: 700; padding-top: 5px; border-top: 1px dashed #999; font-size: 10px; color: #111;">
                    💳 تفصيل مبالغ الشبكات (إفرادي):
                </td>
            </tr>
            ${items.map((item, idx) => `
                <tr style="font-size: 10px; color: #222;">
                    <td style="padding-right: 6px;">• ${item.type || 'شبكة'}${items.length > 1 ? ` (${idx + 1})` : ''}:</td>
                    <td class="num mono">-${formatPosMoney(item.amount)}</td>
                </tr>
            `).join('')}
            <tr style="font-weight: 700; color: #000; border-bottom: 1px dashed #999;">
                <td style="padding-right: 4px;">إجمالي الشبكات المخصومة:</td>
                <td class="num mono">-${formatPosMoney(networks)}</td>
            </tr>
        `;
    } else if (networks > 0) {
        return `
            <tr>
                <td colspan="2" style="font-weight: 700; padding-top: 5px; border-top: 1px dashed #999; font-size: 10px; color: #111;">
                    💳 تفصيل مبالغ الشبكات (إفرادي):
                </td>
            </tr>
            <tr style="font-size: 10px; color: #222;">
                <td style="padding-right: 6px;">• شبكة مدى:</td>
                <td class="num mono">-${formatPosMoney(networks)}</td>
            </tr>
            <tr style="font-weight: 700; color: #000; border-bottom: 1px dashed #999;">
                <td style="padding-right: 4px;">إجمالي الشبكات المخصومة:</td>
                <td class="num mono">-${formatPosMoney(networks)}</td>
            </tr>
        `;
    } else {
        return `
            <tr>
                <td>خصم الشبكات:</td>
                <td class="num mono">0.00</td>
            </tr>
        `;
    }
}

// ==========================================================================
// Printing Engine: A4 Report & Thermal Receipt
// ==========================================================================

/**
 * Print Formal A4 Report for a single POS Terminal
 */
function printPosA4(posId) {
    const pos = currentPosList.find(p => p.id === posId);
    if (!pos) return;

    const data = currentMatrixData[posId] || { grossSales: 0, returns: 0, netSales: 0, networks: 0, actualCash: 0, networkItems: [] };
    const date = currentMatrixDate || getTodayIsoDate();
    const companyName = getPosCompanyName();

    const printWin = window.open('', '_blank', 'width=900,height=1000');
    if (!printWin) {
        alert('يرجى السماح بالنوافذ المنبثقة للطباعة.');
        return;
    }

    const gross = parseFloat(data.grossSales) || 0;
    const returns = parseFloat(data.returns) || 0;
    const net = parseFloat(data.netSales) || Math.max(0, gross - returns);
    const networks = parseFloat(data.networks) || 0;
    const expected = typeof data.expectedCash !== 'undefined' ? parseFloat(data.expectedCash) : Math.max(0, net - networks);
    const actual = typeof data.actualCash !== 'undefined' ? parseFloat(data.actualCash) : 0;
    const diff = typeof data.diff !== 'undefined' ? parseFloat(data.diff) : (actual - expected);

    let networkDetailsHtml = '';
    if (data.networkItems && data.networkItems.length > 0) {
        networkDetailsHtml = `
            <div style="margin-top: 10px; padding: 10px 14px; background: #F8F9FA; border: 1px solid #E2E8F0; border-right: 4px solid #0F62FE; border-radius: 4px; font-size: 0.88rem;">
                <strong style="color: #1E3A8A; display: block; margin-bottom: 6px;">💳 تفاصيل مبالغ الشبكات المخصومة إفرادي (${data.networkItems.length} عمليات):</strong>
                <table style="width: 100%; border-collapse: collapse; font-size: 0.84rem;">
                    <tbody>
                        ${data.networkItems.map((it, idx) => `
                            <tr style="border-bottom: 1px dashed #E2E8F0;">
                                <td style="padding: 4px 6px;">• عملية ${idx + 1} (${it.type || 'شبكة'}):</td>
                                <td class="mono" style="text-align: left; padding: 4px 6px; font-weight: 600;">-${formatPosMoney(it.amount)} ر.س</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    } else if (networks > 0) {
        networkDetailsHtml = `
            <div style="margin-top: 8px; padding: 6px 12px; background: #F8F9FA; border-right: 3px solid #0F62FE; font-size: 0.85rem;">
                <span>• عملية شبكة مدى: <strong class="mono">-${formatPosMoney(networks)} ر.س</strong></span>
            </div>
        `;
    }

    let diffText = '0.00 ر.س (متطابق ✅)';
    let diffColor = '#24A148';
    if (Math.abs(diff) >= 0.009) {
        if (diff < 0) {
            diffText = `-${formatPosMoney(Math.abs(diff))} ر.س (عجز 🔻)`;
            diffColor = '#DA1E28';
        } else {
            diffText = `+${formatPosMoney(diff)} ر.س (زيادة 🔺)`;
            diffColor = '#B28600';
        }
    }

    printWin.document.write(`
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
            <meta charset="UTF-8">
            <title>تقرير مبيعات نقطة البيع - ${pos.name} - ${date}</title>
            <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap" rel="stylesheet">
            <style>
                @page {
                    size: A4 portrait;
                    margin: 15mm;
                }
                * { box-sizing: border-box; }
                body {
                    font-family: 'IBM Plex Sans Arabic', sans-serif;
                    margin: 0;
                    padding: 20px;
                    color: #161616;
                    background: #FFFFFF;
                    line-height: 1.5;
                }
                .mono {
                    font-family: 'IBM Plex Mono', monospace;
                    font-variant-numeric: tabular-nums;
                }
                .report-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-bottom: 2px solid #161616;
                    padding-bottom: 12px;
                    margin-bottom: 20px;
                }
                .report-title h1 {
                    font-size: 1.4rem;
                    margin: 0 0 4px 0;
                    color: #0F62FE;
                }
                .report-title p {
                    margin: 0;
                    font-size: 0.85rem;
                    color: #525252;
                }
                .meta-box {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 12px;
                    background: #F4F4F4;
                    padding: 12px 16px;
                    border: 1px solid #E0E0E0;
                    margin-bottom: 24px;
                    font-size: 0.9rem;
                }
                .statement-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 24px;
                }
                .statement-table th {
                    background: #E0E0E0;
                    border-bottom: 2px solid #8D8D8D;
                    padding: 10px 14px;
                    text-align: right;
                    font-size: 0.88rem;
                }
                .statement-table td {
                    padding: 12px 14px;
                    border-bottom: 1px solid #E0E0E0;
                    font-size: 0.92rem;
                }
                .highlight-row {
                    background: #EDF5FF;
                    font-weight: 700;
                }
                .final-cash-box {
                    background: #DEFBE6;
                    border: 1px solid #24A148;
                    border-right: 6px solid #24A148;
                    padding: 16px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 30px;
                }
                .final-cash-box .label {
                    font-size: 1.1rem;
                    font-weight: 700;
                    color: #044317;
                }
                .final-cash-box .value {
                    font-size: 1.6rem;
                    font-weight: 700;
                    color: #044317;
                }
                .signature-grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 20px;
                    margin-top: 40px;
                    padding-top: 20px;
                }
                .sig-box {
                    border-top: 1px solid #8D8D8D;
                    padding-top: 8px;
                    text-align: center;
                    font-size: 0.85rem;
                }
                .no-print-bar {
                    margin-bottom: 20px;
                    text-align: center;
                    background: #F4F4F4;
                    padding: 12px;
                    border: 1px dashed #8D8D8D;
                }
                .btn-print {
                    background: #0F62FE;
                    color: white;
                    border: none;
                    padding: 8px 24px;
                    font-size: 0.95rem;
                    font-weight: 600;
                    cursor: pointer;
                }
                @media print {
                    .no-print-bar { display: none; }
                    body { padding: 0; }
                }
            </style>
        </head>
        <body>
            <div class="no-print-bar">
                <button class="btn-print" onclick="window.print()">🖨️ طباعة تقرير A4 الآن</button>
            </div>

            <div class="report-header">
                <div class="report-title">
                    <h1>${companyName}</h1>
                    <p>تقرير إقفال ومبيعات نقطة البيع اليومية (Z-Report)</p>
                </div>
                <div style="text-align: left; font-size: 0.85rem; color: #525252;">
                    <div>رقم المستند: <strong class="mono">POS-A4-${pos.code || '00'}-${date.replace(/-/g, '')}</strong></div>
                    <div>تاريخ الإصدار: <span class="mono">${new Date().toLocaleTimeString('ar-SA')}</span></div>
                </div>
            </div>

            <div class="meta-box">
                <div>نقطة البيع: <strong>${pos.name}</strong></div>
                <div>التاريخ: <strong class="mono">${date}</strong></div>
                <div>وقت التسوية والإقفال: <strong class="mono">${data.settledTime || new Date().toLocaleTimeString('ar-SA')}</strong></div>
                <div>الرمز التعريفي: <strong class="mono">${pos.code || '---'}</strong></div>
            </div>

            <table class="statement-table">
                <thead>
                    <tr>
                        <th width="60%">البند والبيان المالي</th>
                        <th width="40%" style="text-align: left;">المبلغ المستحق (ريال سعودي)</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td><strong>1. إجمالي المبيعات (Gross Sales)</strong></td>
                        <td style="text-align: left;" class="mono">${formatPosMoney(gross)} ر.س</td>
                    </tr>
                    <tr style="color: #DA1E28;">
                        <td><strong>2. (-) المرتجعات (Returns)</strong></td>
                        <td style="text-align: left;" class="mono">(${formatPosMoney(returns)}) ر.س</td>
                    </tr>
                    <tr class="highlight-row" style="color: #0F62FE;">
                        <td><strong>3. (=) صافي المبيعات (Net Sales)</strong></td>
                        <td style="text-align: left;" class="mono">${formatPosMoney(net)} ر.س</td>
                    </tr>
                    <tr style="color: #B28600;">
                        <td>
                            <strong>4. (-) مبيعات الشبكة والبطاقات (تخصم)</strong>
                            ${networkDetailsHtml}
                        </td>
                        <td style="text-align: left; vertical-align: top;" class="mono">(${formatPosMoney(networks)}) ر.س</td>
                    </tr>
                    <tr style="font-weight: 700; background: #F4F4F4; color: #161616;">
                        <td><strong>5. (=) الكاش المتوقع بالنظام (صافي الكاش المطلوب)</strong></td>
                        <td style="text-align: left;" class="mono">${formatPosMoney(expected)} ر.س</td>
                    </tr>
                </tbody>
            </table>

            <div class="final-cash-box" style="border-color: ${diffColor};">
                <div>
                    <div class="label">💵 الكاش الفعلي بالدرج (المعدود يدوياً):</div>
                    <div class="value mono">${formatPosMoney(actual)} ر.س</div>
                </div>
                <div style="text-align: left;">
                    <div style="font-size: 0.88rem; color: #525252; font-weight: 600;">فروقات الصندوق (الدرج vs النظام):</div>
                    <div class="mono" style="font-size: 1.25rem; font-weight: 700; color: ${diffColor};">
                        ${diffText}
                    </div>
                </div>
            </div>

            <div class="signature-grid">
                <div class="sig-box">
                    <strong>توقيع الكاشير / البائع</strong>
                    <div style="height: 40px;"></div>
                    <div>......................................</div>
                </div>
                <div class="sig-box">
                    <strong>توقيع المحاسب المستلم</strong>
                    <div style="height: 40px;"></div>
                    <div>......................................</div>
                </div>
                <div class="sig-box">
                    <strong>اعتماد المشرف / المدير</strong>
                    <div style="height: 40px;"></div>
                    <div>......................................</div>
                </div>
            </div>

            <div style="text-align: center; margin-top: 35px; padding-top: 14px; border-top: 1px solid #E0E0E0; font-size: 0.82rem; color: #666;">
                تم الإصدار عبر تطبيق ريزورا • REZORA POS SYSTEM
            </div>
        </body>
        </html>
    `);

    printWin.document.close();
}

/**
 * Print Thermal 80mm Cashier Receipt for a single POS Terminal
 */
function printPosReceipt(posId) {
    const pos = currentPosList.find(p => p.id === posId);
    if (!pos) return;

    const data = currentMatrixData[posId] || { grossSales: 0, returns: 0, netSales: 0, networks: 0, actualCash: 0, networkItems: [] };
    const date = currentMatrixDate || getTodayIsoDate();
    const companyName = getPosCompanyName();

    const gross = parseFloat(data.grossSales) || 0;
    const returns = parseFloat(data.returns) || 0;
    const net = parseFloat(data.netSales) || Math.max(0, gross - returns);
    const networks = parseFloat(data.networks) || 0;
    const expected = typeof data.expectedCash !== 'undefined' ? parseFloat(data.expectedCash) : Math.max(0, net - networks);
    const actual = typeof data.actualCash !== 'undefined' ? parseFloat(data.actualCash) : 0;
    const diff = typeof data.diff !== 'undefined' ? parseFloat(data.diff) : (actual - expected);

    let diffText = '0.00 ر.س (متطابق ✅)';
    if (Math.abs(diff) >= 0.009) {
        if (diff < 0) {
            diffText = `-${formatPosMoney(Math.abs(diff))} ر.س (عجز 🔻)`;
        } else {
            diffText = `+${formatPosMoney(diff)} ر.س (زيادة 🔺)`;
        }
    }

    const printWin = window.open('', '_blank', 'width=420,height=650');
    if (!printWin) {
        alert('يرجى السماح بالنوافذ المنبثقة للطباعة.');
        return;
    }

    printWin.document.write(`
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
            <meta charset="UTF-8">
            <title>إيصال إقفال - ${pos.name} - ${companyName}</title>
            <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap" rel="stylesheet">
            <style>
                @page {
                    size: 80mm auto;
                    margin: 2mm;
                }
                * { box-sizing: border-box; }
                body {
                    font-family: 'IBM Plex Sans Arabic', sans-serif;
                    width: 76mm;
                    margin: 0 auto;
                    padding: 6mm 2mm;
                    color: #000000;
                    background: #FFFFFF;
                    font-size: 11px;
                    line-height: 1.35;
                }
                .mono {
                    font-family: 'IBM Plex Mono', monospace;
                    font-variant-numeric: tabular-nums;
                }
                .receipt-header {
                    text-align: center;
                    border-bottom: 1px dashed #000000;
                    padding-bottom: 6px;
                    margin-bottom: 8px;
                }
                .store-name {
                    font-size: 15px;
                    font-weight: 700;
                    margin-bottom: 2px;
                }
                .receipt-type {
                    font-size: 11px;
                    font-weight: 600;
                }
                .receipt-meta {
                    margin-bottom: 8px;
                    border-bottom: 1px dashed #000000;
                    padding-bottom: 6px;
                    font-size: 10px;
                }
                .meta-row {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 2px;
                }
                .receipt-table {
                    width: 100%;
                    margin-bottom: 8px;
                    border-collapse: collapse;
                }
                .receipt-table td {
                    padding: 3px 0;
                }
                .receipt-table .num {
                    text-align: left;
                    font-weight: 600;
                }
                .divider {
                    border-top: 1px dashed #000000;
                    margin: 6px 0;
                }
                .double-divider {
                    border-top: 2px solid #000000;
                    margin: 6px 0;
                }
                .cash-highlight {
                    border: 1px solid #000000;
                    padding: 6px;
                    text-align: center;
                    margin: 8px 0;
                }
                .cash-highlight .label {
                    font-size: 11px;
                    font-weight: 600;
                }
                .cash-highlight .val {
                    font-size: 16px;
                    font-weight: 700;
                    margin-top: 2px;
                }
                .receipt-footer {
                    text-align: center;
                    font-size: 9px;
                    margin-top: 10px;
                }
                .no-print {
                    margin-bottom: 10px;
                    text-align: center;
                }
                .btn-print {
                    background: #000000;
                    color: #FFFFFF;
                    border: none;
                    padding: 6px 14px;
                    font-size: 11px;
                    cursor: pointer;
                }
                @media print {
                    .no-print { display: none; }
                }
            </style>
        </head>
        <body>
            <div class="no-print">
                <button class="btn-print" onclick="window.print()">🖨️ طباعة الإيصال (80mm)</button>
            </div>

            <div class="receipt-header">
                <div class="store-name">${companyName}</div>
                <div class="receipt-type">إيصال إقفال ومطابقة مبيعات الصندوق (Z-Report)</div>
                <div style="font-size: 10px; color: #333; margin-top: 2px;">نقطة البيع: ${pos.name} ${pos.code ? `(${pos.code})` : ''}</div>
            </div>

            <div class="receipt-meta">
                <div class="meta-row">
                    <span>نقطة البيع:</span>
                    <strong>${pos.name}</strong>
                </div>
                <div class="meta-row">
                    <span>التاريخ:</span>
                    <span class="mono">${date}</span>
                </div>
                <div class="meta-row">
                    <span>وقت التسوية والإقفال:</span>
                    <span class="mono">${data.settledTime || new Date().toLocaleTimeString('ar-SA')}</span>
                </div>
            </div>

            <table class="receipt-table">
                <tr>
                    <td>إجمالي المبيعات:</td>
                    <td class="num mono">${formatPosMoney(gross)}</td>
                </tr>
                <tr>
                    <td>المرتجعات:</td>
                    <td class="num mono">-${formatPosMoney(returns)}</td>
                </tr>
                <tr style="font-weight: 700;">
                    <td style="border-top: 1px dotted #000;">صافي المبيعات:</td>
                    <td style="border-top: 1px dotted #000;" class="num mono">${formatPosMoney(net)}</td>
                </tr>
                ${renderThermalNetworkItemsHtml(data, networks)}
                <tr style="font-weight: 700;">
                    <td style="border-top: 1px dashed #000;">الكاش المتوقع بالنظام:</td>
                    <td style="border-top: 1px dashed #000;" class="num mono">${formatPosMoney(expected)}</td>
                </tr>
            </table>

            <div class="cash-highlight">
                <div class="label">الكاش الفعلي بالدرج:</div>
                <div class="val mono">${formatPosMoney(actual)} ر.س</div>
                <div style="margin-top: 4px; font-size: 10px;">
                    الفرق: <strong>${diffText}</strong>
                </div>
            </div>

            <div style="display: flex; justify-content: space-between; margin-top: 20px; font-size: 9px;">
                <div style="text-align: center; width: 45%;">
                    <div>توقيع الكاشير</div>
                    <div style="height: 25px;"></div>
                    <div>-------------</div>
                </div>
                <div style="text-align: center; width: 45%;">
                    <div>المشرف المستلم</div>
                    <div style="height: 25px;"></div>
                    <div>-------------</div>
                </div>
            </div>

            <div class="receipt-footer">
                <div class="divider"></div>
                <div style="font-weight: 600; font-size: 10px;">*** شكراً لتعاملكم معنا ***</div>
                <div style="margin-top: 4px; color: #555; font-size: 8.5px;">تم الإصدار عبر تطبيق ريزورا (REZORA POS)</div>
                <div class="mono" style="color: #888; font-size: 8px; margin-top: 2px;">VER-${date.replace(/-/g, '')}-80MM</div>
            </div>
        </body>
        </html>
    `);

    printWin.document.close();
}

/**
 * Print Consolidated A4 Report for ALL POS terminals for the day
 */
function printDailyConsolidatedA4() {
    const date = currentMatrixDate || getTodayIsoDate();
    const companyName = getPosCompanyName();
    const printWin = window.open('', '_blank', 'width=950,height=1000');
    if (!printWin) {
        alert('يرجى السماح بالنوافذ المنبثقة للطباعة.');
        return;
    }

    let totalGross = 0;
    let totalReturns = 0;
    let totalNet = 0;
    let totalNetworks = 0;
    let totalExpected = 0;
    let totalCash = 0;

    const rowsHtml = currentPosList.map(pos => {
        const d = currentMatrixData[pos.id] || { grossSales: 0, returns: 0, netSales: 0, networks: 0, actualCash: 0 };
        const gross = parseFloat(d.grossSales) || 0;
        const returns = parseFloat(d.returns) || 0;
        const net = parseFloat(d.netSales) || Math.max(0, gross - returns);
        const networks = parseFloat(d.networks) || 0;
        const expected = typeof d.expectedCash !== 'undefined' ? parseFloat(d.expectedCash) : Math.max(0, net - networks);
        const actual = typeof d.actualCash !== 'undefined' ? parseFloat(d.actualCash) : 0;
        const diff = typeof d.diff !== 'undefined' ? parseFloat(d.diff) : (actual - expected);

        totalGross += gross;
        totalReturns += returns;
        totalNet += net;
        totalNetworks += networks;
        totalExpected += expected;
        totalCash += actual;

        let diffBadge = '<span style="color: #24A148; font-weight: 700;">0.00 (متطابق)</span>';
        if (Math.abs(diff) >= 0.009) {
            if (diff < 0) {
                diffBadge = `<span style="color: #DA1E28; font-weight: 700;">-${formatPosMoney(Math.abs(diff))} (عجز)</span>`;
            } else {
                diffBadge = `<span style="color: #B28600; font-weight: 700;">+${formatPosMoney(diff)} (زيادة)</span>`;
            }
        }

        return `
            <tr>
                <td><strong>${pos.name}</strong></td>
                <td class="mono" style="text-align: left;">${formatPosMoney(gross)}</td>
                <td class="mono" style="text-align: left; color: #DA1E28;">${formatPosMoney(returns)}</td>
                <td class="mono" style="text-align: left; font-weight: 700; color: #0F62FE;">${formatPosMoney(net)}</td>
                <td class="mono" style="text-align: left; color: #B28600;">${formatPosMoney(networks)}</td>
                <td class="mono" style="text-align: left; font-weight: 700; color: #0F62FE;">${formatPosMoney(expected)}</td>
                <td class="mono" style="text-align: left; font-weight: 700; color: #24A148;">${formatPosMoney(actual)}</td>
                <td class="mono" style="text-align: center;">${diffBadge}</td>
            </tr>
        `;
    }).join('');

    const totalDiff = totalCash - totalExpected;
    let totalDiffBadge = '<span style="color: #24A148; font-weight: 700;">0.00 (متطابق)</span>';
    if (Math.abs(totalDiff) >= 0.009) {
        if (totalDiff < 0) {
            totalDiffBadge = `<span style="color: #DA1E28; font-weight: 700;">-${formatPosMoney(Math.abs(totalDiff))} (عجز)</span>`;
        } else {
            totalDiffBadge = `<span style="color: #B28600; font-weight: 700;">+${formatPosMoney(totalDiff)} (زيادة)</span>`;
        }
    }

    printWin.document.write(`
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
            <meta charset="UTF-8">
            <title>تقرير مبيعات نقاط البيع المجمع - ${date} - ${companyName}</title>
            <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap" rel="stylesheet">
            <style>
                @page { size: A4 landscape; margin: 15mm; }
                * { box-sizing: border-box; }
                body {
                    font-family: 'IBM Plex Sans Arabic', sans-serif;
                    padding: 20px;
                    color: #161616;
                    background: #FFFFFF;
                }
                .mono {
                    font-family: 'IBM Plex Mono', monospace;
                    font-variant-numeric: tabular-nums;
                }
                .header-bar {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-bottom: 2px solid #161616;
                    padding-bottom: 10px;
                    margin-bottom: 20px;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 24px;
                }
                th {
                    background: #E0E0E0;
                    border-bottom: 2px solid #8D8D8D;
                    padding: 10px 12px;
                    text-align: right;
                    font-size: 0.88rem;
                }
                td {
                    padding: 10px 12px;
                    border-bottom: 1px solid #E0E0E0;
                    font-size: 0.9rem;
                }
                tfoot tr {
                    background: #F4F4F4;
                    font-weight: 700;
                    border-top: 2px solid #161616;
                    border-bottom: 2px solid #161616;
                }
                .no-print { margin-bottom: 20px; text-align: center; }
                .btn-print {
                    background: #0F62FE; color: white; border: none; padding: 8px 24px; font-weight: 600; cursor: pointer;
                }
                @media print { .no-print { display: none; } }
            </style>
        </head>
        <body>
            <div class="no-print">
                <button class="btn-print" onclick="window.print()">🖨️ طباعة التقرير المجمع الآن</button>
            </div>

            <div class="header-bar">
                <div>
                    <h1 style="margin: 0; font-size: 1.4rem; color: #0F62FE;">${companyName}</h1>
                    <p style="margin: 4px 0 0 0; color: #525252;">التقرير المالي المجمع لمبيعات نقاط البيع اليومية ومطابقة الصندوق</p>
                </div>
                <div style="text-align: left; font-size: 0.9rem;">
                    <div>التاريخ: <strong class="mono">${date}</strong></div>
                    <div>إجمالي النقاط: <strong>${currentPosList.length} نقاط</strong></div>
                </div>
            </div>

            <table>
                <thead>
                    <tr>
                        <th>نقطة البيع</th>
                        <th style="text-align: left;">إجمالي المبيعات</th>
                        <th style="text-align: left;">المرتجعات</th>
                        <th style="text-align: left;">صافي المبيعات</th>
                        <th style="text-align: left;">الشبكات (تخصم)</th>
                        <th style="text-align: left;">الكاش المتوقع</th>
                        <th style="text-align: left;">الكاش الفعلي (الدرج)</th>
                        <th style="text-align: center;">الفرق</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
                <tfoot>
                    <tr>
                        <td>الإجمالي العام</td>
                        <td class="mono" style="text-align: left;">${formatPosMoney(totalGross)} ر.س</td>
                        <td class="mono" style="text-align: left; color: #DA1E28;">${formatPosMoney(totalReturns)} ر.س</td>
                        <td class="mono" style="text-align: left; color: #0F62FE;">${formatPosMoney(totalNet)} ر.س</td>
                        <td class="mono" style="text-align: left; color: #B28600;">${formatPosMoney(totalNetworks)} ر.س</td>
                        <td class="mono" style="text-align: left; color: #0F62FE;">${formatPosMoney(totalExpected)} ر.س</td>
                        <td class="mono" style="text-align: left; color: #24A148;">${formatPosMoney(totalCash)} ر.س</td>
                        <td class="mono" style="text-align: center;">${totalDiffBadge}</td>
                    </tr>
                </tfoot>
            </table>

            <div style="display: flex; justify-content: space-between; margin-top: 50px;">
                <div style="text-align: center; width: 30%;">
                    <div>إعداد المشرف</div>
                    <div style="height: 35px;"></div>
                    <div>......................................</div>
                </div>
                <div style="text-align: center; width: 30%;">
                    <div>المراجعة والتدقيق</div>
                    <div style="height: 35px;"></div>
                    <div>......................................</div>
                </div>
                <div style="text-align: center; width: 30%;">
                    <div>الاعتماد المالي</div>
                    <div style="height: 35px;"></div>
                    <div>......................................</div>
                </div>
            </div>

            <div style="text-align: center; margin-top: 35px; padding-top: 14px; border-top: 1px solid #E0E0E0; font-size: 0.82rem; color: #666;">
                تم الإصدار عبر تطبيق ريزورا • REZORA POS SYSTEM
            </div>
        </body>
        </html>
    `);

    printWin.document.close();
}

// ==========================================================================
// POS Sales Reporting Engine (محرك استخراج وتصدير تقارير نقاط البيع)
// ==========================================================================

let lastGeneratedPosReportData = [];

/**
 * Open the POS Reports Modal
 */
async function openPosReportModal(preselectedPosId = 'all') {
    const modal = document.getElementById('posReportModal');
    if (!modal) return;

    // Populate terminal filter dropdown
    initPosReportFilters(preselectedPosId);

    // Set default date range to this month
    setPosReportDatePreset('month');

    modal.style.display = 'flex';
}

function closePosReportModal() {
    const modal = document.getElementById('posReportModal');
    if (modal) modal.style.display = 'none';
}

/**
 * Initialize Filters in POS Report Modal
 */
function initPosReportFilters(preselectedPosId = 'all') {
    const select = document.getElementById('posReportTerminalSelect');
    if (!select) return;

    select.innerHTML = '<option value="all">🌐 كل نقاط البيع (تقرير شامل مجمع)</option>';

    masterPosList.forEach(pos => {
        const opt = document.createElement('option');
        opt.value = pos.id;
        opt.textContent = `${pos.name} ${pos.code ? `(${pos.code})` : ''} - ${pos.branch || 'الفرع'}`;
        if (pos.id === preselectedPosId || pos.name === preselectedPosId) {
            opt.selected = true;
        }
        select.appendChild(opt);
    });
}

/**
 * Quick Date Range Presets for POS Reports
 */
function setPosReportDatePreset(preset) {
    const fromInput = document.getElementById('posReportFromDate');
    const toInput = document.getElementById('posReportToDate');
    if (!fromInput || !toInput) return;

    const now = new Date();
    const todayStr = getTodayIsoDate();

    if (preset === 'today') {
        fromInput.value = todayStr;
        toInput.value = todayStr;
    } else if (preset === 'yesterday') {
        const y = new Date();
        y.setDate(now.getDate() - 1);
        const yStr = y.toISOString().split('T')[0];
        fromInput.value = yStr;
        toInput.value = yStr;
    } else if (preset === 'week') {
        const w = new Date();
        w.setDate(now.getDate() - 7);
        fromInput.value = w.toISOString().split('T')[0];
        toInput.value = todayStr;
    } else if (preset === 'month') {
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        const y = firstDay.getFullYear();
        const m = String(firstDay.getMonth() + 1).padStart(2, '0');
        fromInput.value = `${y}-${m}-01`;
        toInput.value = todayStr;
    } else if (preset === 'lastMonth') {
        const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
        fromInput.value = firstDayLastMonth.toISOString().split('T')[0];
        toInput.value = lastDayLastMonth.toISOString().split('T')[0];
    } else if (preset === 'all') {
        fromInput.value = '2024-01-01';
        toInput.value = todayStr;
    }

    generatePosReport();
}

/**
 * Generate & Filter POS Sales Report
 */
async function generatePosReport() {
    const terminalSelect = document.getElementById('posReportTerminalSelect');
    const fromInput = document.getElementById('posReportFromDate');
    const toInput = document.getElementById('posReportToDate');

    const selectedTerminalId = terminalSelect ? terminalSelect.value : 'all';
    const fromDate = fromInput ? fromInput.value : '';
    const toDate = toInput ? toInput.value : '';

    const records = [];
    const dateMap = new Map(); // key: `date_posName`

    // 1. Fetch from main sales records
    let allSales = [];
    try {
        if (typeof window.getSales === 'function') {
            allSales = await window.getSales();
        } else {
            allSales = JSON.parse(localStorage.getItem('sales_data') || '[]');
        }
    } catch (e) {
        console.error('Error fetching sales for report:', e);
    }

    // 2. Scan localStorage for all pos_matrix_sales_*
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('pos_matrix_sales_')) {
            const date = key.replace('pos_matrix_sales_', '');
            try {
                const matrixObj = JSON.parse(localStorage.getItem(key) || '{}');
                Object.entries(matrixObj).forEach(([posId, d]) => {
                    const matchedPos = masterPosList.find(p => p.id === posId) || currentPosList.find(p => p.id === posId) || { id: posId, name: posId, branch: 'الفرع' };
                    const gross = parseFloat(d.grossSales || 0);
                    const net = parseFloat(d.netSales || 0);
                    const networks = parseFloat(d.networks || 0);
                    const cash = parseFloat(d.actualCash || 0);
                    const returns = parseFloat(d.returns || 0);

                    if (gross > 0 || net > 0 || networks > 0 || cash > 0) {
                        const compoundKey = `${date}_${matchedPos.name}`;
                        dateMap.set(compoundKey, {
                            date: date,
                            posId: matchedPos.id,
                            posName: matchedPos.name,
                            posCode: matchedPos.code || '',
                            branch: matchedPos.branch || 'الفرع',
                            grossSales: gross,
                            returns: returns,
                            netSales: net,
                            networks: networks,
                            networkItems: Array.isArray(d.networkItems) ? d.networkItems : [],
                            actualCash: cash,
                            notes: d.notes || ''
                        });
                    }
                });
            } catch (err) {
                console.error('Error reading pos matrix key:', key, err);
            }
        }
    }

    // 3. Merge with main sales
    allSales.forEach(s => {
        const date = (s.date || '').split('T')[0];
        const matchedPos = masterPosList.find(p => p.name === s.branch || p.id === s.branch);
        if (matchedPos && date) {
            const compoundKey = `${date}_${matchedPos.name}`;
            if (!dateMap.has(compoundKey)) {
                dateMap.set(compoundKey, {
                    date: date,
                    posId: matchedPos.id,
                    posName: matchedPos.name,
                    posCode: matchedPos.code || '',
                    branch: matchedPos.branch || 'الفرع',
                    grossSales: parseFloat(s.grossSales || s.amount || 0),
                    returns: parseFloat(s.returns || 0),
                    netSales: parseFloat(s.netSales || s.amount || 0),
                    networks: parseFloat(s.networkSales || s.networks || 0),
                    networkItems: Array.isArray(s.networkItems) ? s.networkItems : [],
                    actualCash: parseFloat(s.actualCash || (s.amount - (s.networkSales || 0)) || 0),
                    notes: s.notes || s.description || ''
                });
            }
        }
    });

    // 4. Filter according to criteria
    dateMap.forEach(item => {
        let matchTerminal = true;
        if (selectedTerminalId !== 'all') {
            matchTerminal = (item.posId === selectedTerminalId || item.posName === selectedTerminalId);
        }

        let matchDate = true;
        if (fromDate && item.date < fromDate) matchDate = false;
        if (toDate && item.date > toDate) matchDate = false;

        if (matchTerminal && matchDate) {
            records.push(item);
        }
    });

    // Sort descending by date
    records.sort((a, b) => b.date.localeCompare(a.date));
    lastGeneratedPosReportData = records;

    // 5. Compute Totals & Aggregates
    let totalGross = 0;
    let totalReturns = 0;
    let totalNet = 0;
    let totalNetworks = 0;
    let totalExpected = 0;
    let totalCash = 0;
    let totalNetworkTx = 0;

    records.forEach(r => {
        const gross = parseFloat(r.grossSales) || 0;
        const returns = parseFloat(r.returns) || 0;
        const net = parseFloat(r.netSales) || Math.max(0, gross - returns);
        const networks = parseFloat(r.networks) || 0;
        const expected = typeof r.expectedCash !== 'undefined' ? parseFloat(r.expectedCash) : Math.max(0, net - networks);
        const actual = parseFloat(r.actualCash) || 0;
        const diff = typeof r.diff !== 'undefined' ? parseFloat(r.diff) : (actual - expected);

        r.expectedCash = expected;
        r.actualCash = actual;
        r.diff = diff;

        totalGross += gross;
        totalReturns += returns;
        totalNet += net;
        totalNetworks += networks;
        totalExpected += expected;
        totalCash += actual;
        totalNetworkTx += (r.networkItems ? r.networkItems.length : 0);
    });

    const totalDiff = totalCash - totalExpected;

    // 6. Update KPI Cards in Modal
    const kpiGrossEl = document.getElementById('posReportKpiGross');
    const kpiReturnsEl = document.getElementById('posReportKpiReturns');
    const kpiNetEl = document.getElementById('posReportKpiNet');
    const kpiNetworksEl = document.getElementById('posReportKpiNetworks');
    const kpiExpectedEl = document.getElementById('posReportKpiExpected');
    const kpiCashEl = document.getElementById('posReportKpiCash');
    const kpiDiffEl = document.getElementById('posReportKpiDiff');
    const kpiDaysEl = document.getElementById('posReportKpiDays');

    if (kpiGrossEl) kpiGrossEl.textContent = `${formatPosMoney(totalGross)} ر.س`;
    if (kpiReturnsEl) kpiReturnsEl.textContent = `${formatPosMoney(totalReturns)} ر.س`;
    if (kpiNetEl) kpiNetEl.textContent = `${formatPosMoney(totalNet)} ر.س`;
    if (kpiNetworksEl) kpiNetworksEl.textContent = `${formatPosMoney(totalNetworks)} ر.س`;
    if (kpiExpectedEl) kpiExpectedEl.textContent = `${formatPosMoney(totalExpected)} ر.س`;
    if (kpiCashEl) kpiCashEl.textContent = `${formatPosMoney(totalCash)} ر.س`;
    if (kpiDiffEl) kpiDiffEl.innerHTML = renderDiffBadge(totalDiff, totalGross, totalCash);
    if (kpiDaysEl) kpiDaysEl.textContent = `${records.length} يوم / عملية (${totalNetworkTx} شبكة)`;

    // 7. Render Report Table Rows
    const tbody = document.getElementById('posReportTableBody');
    const tfoot = document.getElementById('posReportTableFoot');

    if (tbody) {
        tbody.innerHTML = '';
        if (records.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="11" style="text-align: center; padding: 2.5rem; color: var(--colors-neutral-7);">
                        لا توجد مبيعات مسجلة لنقاط البيع المحددة في هذه الفترة الزمنية.
                    </td>
                </tr>
            `;
        } else {
            records.forEach((r, idx) => {
                const networkCount = r.networkItems ? r.networkItems.length : 0;
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td style="font-family: var(--font-family-mono); font-weight: 600;">${idx + 1}</td>
                    <td style="font-family: var(--font-family-mono); font-weight: 600; white-space: nowrap;">
                        📅 ${r.date}
                    </td>
                    <td>
                        <div style="font-weight: 600; color: var(--colors-neutral-11);">${r.posName}</div>
                        ${r.posCode ? `<span class="pos-code-tag">رمز: ${r.posCode}</span>` : ''}
                        ${r.branch ? `<span style="font-size: 0.72rem; color: var(--colors-neutral-7);">🏢 ${r.branch}</span>` : ''}
                    </td>
                    <td class="tabular-numbers" style="text-align: left;">${formatPosMoney(r.grossSales)}</td>
                    <td class="tabular-numbers" style="text-align: left; color: var(--colors-error-solid);">${formatPosMoney(r.returns)}</td>
                    <td class="tabular-numbers" style="text-align: left; font-weight: 700; color: var(--colors-accent-7);">${formatPosMoney(r.netSales)}</td>
                    <td class="tabular-numbers" style="text-align: left; color: var(--colors-warning-fg);">
                        ${formatPosMoney(r.networks)}
                        ${networkCount > 0 ? `<div style="font-size: 0.72rem; color: var(--colors-neutral-7);">(${networkCount} عمليات)</div>` : ''}
                    </td>
                    <td class="tabular-numbers" style="text-align: left; color: #1D4ED8; font-weight: 700;">${formatPosMoney(r.expectedCash)}</td>
                    <td class="tabular-numbers" style="text-align: left; font-weight: 700; color: var(--colors-success-fg);">${formatPosMoney(r.actualCash)}</td>
                    <td style="text-align: center;">${renderDiffBadge(r.diff, r.grossSales, r.actualCash)}</td>
                    <td style="text-align: center; white-space: nowrap;">
                        <button type="button" 
                                class="btn-sap btn-standard" 
                                onclick="printSpecificPosDateA4('${r.posId}', '${r.date}')" 
                                style="padding: 2px 8px; font-size: 0.75rem;" 
                                title="طباعة تقرير A4 لهذا اليوم">
                            📄 A4
                        </button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }
    }

    // 8. Update Table Footer Totals
    if (tfoot) {
        tfoot.innerHTML = `
            <tr style="background: var(--colors-neutral-2); font-weight: 700; border-top: 2px solid var(--colors-neutral-5);">
                <td colspan="3" style="text-align: right; padding: 12px 16px;">الإجمالي العام (${records.length} يوم)</td>
                <td style="text-align: left;" class="tabular-numbers">${formatPosMoney(totalGross)} ر.س</td>
                <td style="text-align: left; color: var(--colors-error-solid);" class="tabular-numbers">${formatPosMoney(totalReturns)} ر.س</td>
                <td style="text-align: left; color: var(--colors-accent-7);" class="tabular-numbers">${formatPosMoney(totalNet)} ر.س</td>
                <td style="text-align: left; color: var(--colors-warning-fg);" class="tabular-numbers">${formatPosMoney(totalNetworks)} ر.س</td>
                <td style="text-align: left; color: #1D4ED8;" class="tabular-numbers">${formatPosMoney(totalExpected)} ر.س</td>
                <td style="text-align: left; color: var(--colors-success-fg);" class="tabular-numbers">${formatPosMoney(totalCash)} ر.س</td>
                <td style="text-align: center;">${renderDiffBadge(totalDiff, totalGross, totalCash)}</td>
                <td></td>
            </tr>
        `;
    }
}

/**
 * Print A4 for a Specific POS and Specific Date
 */
function printSpecificPosDateA4(posId, dateStr) {
    const prevDate = currentMatrixDate;
    currentMatrixDate = dateStr;
    printPosA4(posId);
    currentMatrixDate = prevDate;
}

/**
 * Export POS Report to Excel (XLSX via SheetJS)
 */
function exportPosReportToExcel() {
    if (!lastGeneratedPosReportData || lastGeneratedPosReportData.length === 0) {
        alert('لا توجد بيانات لتصديرها. يرجى تعديل خيارات البحث والضغط على تحديث.');
        return;
    }

    if (typeof XLSX === 'undefined') {
        alert('مكتبة SheetJS غير محملة. يرجى التأكد من اتصال الإنترنت.');
        return;
    }

    const terminalSelect = document.getElementById('posReportTerminalSelect');
    const selectedText = terminalSelect && terminalSelect.options[terminalSelect.selectedIndex] ? terminalSelect.options[terminalSelect.selectedIndex].text : 'نقاط البيع';
    const fromDate = document.getElementById('posReportFromDate').value || 'البداية';
    const toDate = document.getElementById('posReportToDate').value || 'اليوم';

    // Format rows for SheetJS
    const rows = lastGeneratedPosReportData.map((r, i) => {
        const expected = typeof r.expectedCash !== 'undefined' ? r.expectedCash : Math.max(0, (r.netSales || 0) - (r.networks || 0));
        const actual = r.actualCash || 0;
        const diff = typeof r.diff !== 'undefined' ? r.diff : (actual - expected);

        return {
            'م': i + 1,
            'التاريخ': r.date,
            'نقطة البيع': r.posName,
            'الرمز': r.posCode || '',
            'الفرع': r.branch || '',
            'إجمالي المبيعات': r.grossSales,
            'المرتجعات': r.returns,
            'صافي المبيعات': r.netSales,
            'الشبكات والبطاقات': r.networks,
            'عدد عمليات الشبكة': (r.networkItems ? r.networkItems.length : 0),
            'الكاش المتوقع': expected,
            'الكاش الفعلي بالدرج': actual,
            'الفرق (عجز/زيادة)': diff,
            'المطابقة': (Math.abs(diff) < 0.01 ? 'متطابق' : diff < 0 ? 'عجز' : 'زيادة'),
            'الملاحظات': r.notes || ''
        };
    });

    // Add totals row
    let sumGross = 0, sumRet = 0, sumNet = 0, sumNetw = 0, sumExpected = 0, sumCash = 0;
    lastGeneratedPosReportData.forEach(r => {
        sumGross += r.grossSales || 0;
        sumRet += r.returns || 0;
        sumNet += r.netSales || 0;
        sumNetw += r.networks || 0;
        sumExpected += (typeof r.expectedCash !== 'undefined' ? r.expectedCash : Math.max(0, (r.netSales || 0) - (r.networks || 0)));
        sumCash += r.actualCash || 0;
    });
    const sumDiff = sumCash - sumExpected;

    rows.push({
        'م': '',
        'التاريخ': 'الإجمالي العام',
        'نقطة البيع': '',
        'الرمز': '',
        'الفرع': '',
        'إجمالي المبيعات': sumGross,
        'المرتجعات': sumRet,
        'صافي المبيعات': sumNet,
        'الشبكات والبطاقات': sumNetw,
        'عدد عمليات الشبكة': '',
        'الكاش المتوقع': sumExpected,
        'الكاش الفعلي بالدرج': sumCash,
        'الفرق (عجز/زيادة)': sumDiff,
        'المطابقة': (Math.abs(sumDiff) < 0.01 ? 'متطابق' : sumDiff < 0 ? 'عجز' : 'زيادة'),
        'الملاحظات': ''
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'تقرير نقاط البيع');

    const fileName = `تقرير_مبيعات_نقاط_البيع_${fromDate}_الى_${toDate}.xlsx`;
    XLSX.writeFile(workbook, fileName);

    if (typeof showToast === 'function') {
        showToast('success', 'تم التصدير بنجاح', `تم تنزيل ملف Excel: ${fileName}`);
    }
}

/**
 * Print Formal A4 Consolidated Report for POS Search Results
 */
function printPosReportA4() {
    if (!lastGeneratedPosReportData || lastGeneratedPosReportData.length === 0) {
        alert('لا توجد بيانات لطباعتها.');
        return;
    }

    const terminalSelect = document.getElementById('posReportTerminalSelect');
    const selectedText = terminalSelect && terminalSelect.options[terminalSelect.selectedIndex] ? terminalSelect.options[terminalSelect.selectedIndex].text : 'نقاط البيع';
    const fromDate = document.getElementById('posReportFromDate').value || '---';
    const toDate = document.getElementById('posReportToDate').value || '---';
    const companyName = getPosCompanyName();

    const printWin = window.open('', '_blank', 'width=1000,height=1000');
    if (!printWin) {
        alert('يرجى السماح بالنوافذ المنبثقة للطباعة.');
        return;
    }

    let sumGross = 0, sumRet = 0, sumNet = 0, sumNetw = 0, sumExpected = 0, sumCash = 0;
    const rowsHtml = lastGeneratedPosReportData.map((r, i) => {
        const expected = typeof r.expectedCash !== 'undefined' ? r.expectedCash : Math.max(0, (r.netSales || 0) - (r.networks || 0));
        const actual = r.actualCash || 0;
        const diff = typeof r.diff !== 'undefined' ? r.diff : (actual - expected);

        sumGross += r.grossSales || 0;
        sumRet += r.returns || 0;
        sumNet += r.netSales || 0;
        sumNetw += r.networks || 0;
        sumExpected += expected;
        sumCash += actual;

        const diffText = Math.abs(diff) < 0.01 ? '0.00 (متطابق)' : diff < 0 ? `-${formatPosMoney(Math.abs(diff))} (عجز)` : `+${formatPosMoney(diff)} (زيادة)`;
        const diffColor = Math.abs(diff) < 0.01 ? '#10B981' : diff < 0 ? '#EF4444' : '#F59E0B';

        return `
            <tr>
                <td class="mono" style="text-align: center;">${i + 1}</td>
                <td class="mono" style="text-align: center;">${r.date}</td>
                <td><strong>${r.posName}</strong> ${r.posCode ? `<span style="font-size: 10px; color: #555;">(${r.posCode})</span>` : ''}</td>
                <td>${r.branch || 'الفرع'}</td>
                <td class="mono" style="text-align: left;">${formatPosMoney(r.grossSales)}</td>
                <td class="mono" style="text-align: left; color: #DA1E28;">${formatPosMoney(r.returns)}</td>
                <td class="mono" style="text-align: left; font-weight: 700; color: #4F46E5;">${formatPosMoney(r.netSales)}</td>
                <td class="mono" style="text-align: left; color: #B28600;">${formatPosMoney(r.networks)}</td>
                <td class="mono" style="text-align: left; color: #1D4ED8; font-weight: 700;">${formatPosMoney(expected)}</td>
                <td class="mono" style="text-align: left; font-weight: 700; color: #10B981;">${formatPosMoney(actual)}</td>
                <td class="mono" style="text-align: center; font-weight: 700; color: ${diffColor};">${diffText}</td>
            </tr>
        `;
    }).join('');

    const sumDiff = sumCash - sumExpected;
    const sumDiffColor = Math.abs(sumDiff) < 0.01 ? '#10B981' : sumDiff < 0 ? '#EF4444' : '#F59E0B';
    const sumDiffText = Math.abs(sumDiff) < 0.01 ? '0.00 (متطابق ✅)' : sumDiff < 0 ? `-${formatPosMoney(Math.abs(sumDiff))} (عجز 🔻)` : `+${formatPosMoney(sumDiff)} (زيادة 🔺)`;

    printWin.document.write(`
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
            <meta charset="UTF-8">
            <title>تقرير مبيعات ومطابقة نقاط البيع - ${fromDate} إلى ${toDate} - ${companyName}</title>
            <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap" rel="stylesheet">
            <style>
                @page { size: A4 landscape; margin: 10mm; }
                * { box-sizing: border-box; }
                body {
                    font-family: 'IBM Plex Sans Arabic', sans-serif;
                    margin: 0;
                    padding: 15px;
                    color: #0F172A;
                    background: #FFFFFF;
                }
                .mono {
                    font-family: 'IBM Plex Mono', monospace;
                    font-variant-numeric: tabular-nums;
                }
                .header-bar {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-bottom: 2px solid #0F172A;
                    padding-bottom: 12px;
                    margin-bottom: 16px;
                }
                .meta-grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 10px;
                    background: #F8FAFC;
                    border: 1px solid #E2E8F0;
                    border-radius: 8px;
                    padding: 10px 14px;
                    margin-bottom: 18px;
                    font-size: 0.88rem;
                }
                .summary-cards {
                    display: grid;
                    grid-template-columns: repeat(5, 1fr);
                    gap: 10px;
                    margin-bottom: 20px;
                }
                .sum-card {
                    background: #F8FAFC;
                    border: 1px solid #E2E8F0;
                    border-radius: 8px;
                    padding: 10px;
                    text-align: center;
                }
                .sum-card .label { font-size: 0.78rem; color: #475569; }
                .sum-card .val { font-size: 1.15rem; font-weight: 700; margin-top: 4px; }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 0.82rem;
                    margin-bottom: 20px;
                }
                th {
                    background: #F1F5F9;
                    border-bottom: 2px solid #CBD5E1;
                    padding: 8px 10px;
                    text-align: right;
                }
                td {
                    padding: 7px 10px;
                    border-bottom: 1px solid #E2E8F0;
                }
                tfoot tr {
                    background: #F8FAFC;
                    font-weight: 700;
                    border-top: 2px solid #0F172A;
                    border-bottom: 2px solid #0F172A;
                }
                .signatures {
                    display: flex;
                    justify-content: space-between;
                    margin-top: 35px;
                    padding-top: 15px;
                }
                .sig-box {
                    text-align: center;
                    width: 30%;
                    font-size: 0.85rem;
                }
                .no-print { text-align: center; margin-bottom: 15px; }
                .btn-print {
                    background: #0F172A; color: white; border: none; padding: 8px 24px; font-weight: 600; cursor: pointer; border-radius: 6px;
                }
                @media print { .no-print { display: none; } }
            </style>
        </head>
        <body>
            <div class="no-print">
                <button class="btn-print" onclick="window.print()">🖨️ طباعة تقرير A4 الآن</button>
            </div>

            <div class="header-bar">
                <div>
                    <h1 style="margin: 0; font-size: 1.4rem; color: #0F172A;">${companyName}</h1>
                    <p style="margin: 3px 0 0 0; color: #475569; font-size: 0.9rem;">تقرير مبيعات ومطابقة عهدة نقاط البيع المعتمد</p>
                </div>
                <div style="text-align: left; font-size: 0.85rem; color: #475569;">
                    <div>تاريخ الاستخراج: <span class="mono">${new Date().toLocaleDateString('ar-SA')}</span></div>
                    <div>إجمالي السجلات: <strong class="mono">${lastGeneratedPosReportData.length} سجل</strong></div>
                </div>
            </div>

            <div class="meta-grid">
                <div>النطاق: <strong>${selectedText}</strong></div>
                <div>من تاريخ: <strong class="mono">${fromDate}</strong></div>
                <div>إلى تاريخ: <strong class="mono">${toDate}</strong></div>
            </div>

            <div class="summary-cards">
                <div class="sum-card">
                    <div class="label">صافي المبيعات الكلي</div>
                    <div class="val mono" style="color: #4F46E5;">${formatPosMoney(sumNet)} ر.س</div>
                </div>
                <div class="sum-card">
                    <div class="label">إجمالي مدفوعات الشبكة</div>
                    <div class="val mono" style="color: #B28600;">${formatPosMoney(sumNetw)} ر.س</div>
                </div>
                <div class="sum-card">
                    <div class="label">الكاش المتوقع (النظام)</div>
                    <div class="val mono" style="color: #1D4ED8;">${formatPosMoney(sumExpected)} ر.س</div>
                </div>
                <div class="sum-card">
                    <div class="label">الكاش الفعلي المحصل</div>
                    <div class="val mono" style="color: #10B981;">${formatPosMoney(sumCash)} ر.س</div>
                </div>
                <div class="sum-card">
                    <div class="label">فروقات الصندوق الكلية</div>
                    <div class="val mono" style="color: ${sumDiffColor};">${sumDiffText}</div>
                </div>
            </div>

            <table>
                <thead>
                    <tr>
                        <th width="3%">#</th>
                        <th width="10%" style="text-align: center;">التاريخ</th>
                        <th width="15%">نقطة البيع</th>
                        <th width="12%">الفرع</th>
                        <th width="10%" style="text-align: left;">إجمالي المبيعات</th>
                        <th width="8%" style="text-align: left;">المرتجعات</th>
                        <th width="10%" style="text-align: left;">صافي المبيعات</th>
                        <th width="10%" style="text-align: left;">الشبكات</th>
                        <th width="10%" style="text-align: left;">الكاش المتوقع</th>
                        <th width="10%" style="text-align: left;">الكاش الفعلي</th>
                        <th width="12%" style="text-align: center;">الفرق (المطابقة)</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
                <tfoot>
                    <tr>
                        <td colspan="4" style="text-align: right;">الإجمالي العام (${lastGeneratedPosReportData.length} يوم)</td>
                        <td class="mono" style="text-align: left;">${formatPosMoney(sumGross)}</td>
                        <td class="mono" style="text-align: left; color: #DA1E28;">${formatPosMoney(sumRet)}</td>
                        <td class="mono" style="text-align: left; color: #4F46E5;">${formatPosMoney(sumNet)}</td>
                        <td class="mono" style="text-align: left; color: #B28600;">${formatPosMoney(sumNetw)}</td>
                        <td class="mono" style="text-align: left; color: #1D4ED8;">${formatPosMoney(sumExpected)}</td>
                        <td class="mono" style="text-align: left; color: #10B981;">${formatPosMoney(sumCash)}</td>
                        <td class="mono" style="text-align: center; color: ${sumDiffColor};">${sumDiffText}</td>
                    </tr>
                </tfoot>
            </table>

            <div class="signatures">
                <div class="sig-box">
                    <div>إعداد المشرف</div>
                    <div style="height: 30px;"></div>
                    <div>......................................</div>
                </div>
                <div class="sig-box">
                    <div>المراجعة المالية</div>
                    <div style="height: 30px;"></div>
                    <div>......................................</div>
                </div>
                <div class="sig-box">
                    <div>اعتماد الإدارة</div>
                    <div style="height: 30px;"></div>
                    <div>......................................</div>
                </div>
            </div>

            <div style="text-align: center; margin-top: 35px; padding-top: 14px; border-top: 1px solid #CBD5E1; font-size: 0.82rem; color: #64748B;">
                تم الإصدار عبر تطبيق ريزورا • REZORA POS SYSTEM
            </div>
        </body>
        </html>
    `);

    printWin.document.close();
}

/**
 * Print 80mm Thermal Receipt Summary for POS Report
 */
function printPosReportThermal() {
    if (!lastGeneratedPosReportData || lastGeneratedPosReportData.length === 0) {
        alert('لا توجد بيانات لطباعتها.');
        return;
    }

    const terminalSelect = document.getElementById('posReportTerminalSelect');
    const selectedText = terminalSelect && terminalSelect.options[terminalSelect.selectedIndex] ? terminalSelect.options[terminalSelect.selectedIndex].text : 'نقاط البيع';
    const fromDate = document.getElementById('posReportFromDate').value || '---';
    const toDate = document.getElementById('posReportToDate').value || '---';
    const companyName = getPosCompanyName();

    let sumGross = 0, sumRet = 0, sumNet = 0, sumNetw = 0, sumExpected = 0, sumCash = 0;
    lastGeneratedPosReportData.forEach(r => {
        const expected = typeof r.expectedCash !== 'undefined' ? r.expectedCash : Math.max(0, (r.netSales || 0) - (r.networks || 0));
        const actual = r.actualCash || 0;

        sumGross += r.grossSales || 0;
        sumRet += r.returns || 0;
        sumNet += r.netSales || 0;
        sumNetw += r.networks || 0;
        sumExpected += expected;
        sumCash += actual;
    });

    const sumDiff = sumCash - sumExpected;

    const printWin = window.open('', '_blank', 'width=380,height=720');
    if (!printWin) {
        alert('يرجى السماح بالنوافذ المنبثقة للطباعة.');
        return;
    }

    printWin.document.write(`
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
            <meta charset="UTF-8">
            <title>إيصال ملخص مبيعات - ${selectedText} - ${companyName}</title>
            <style>
                @page { size: 80mm auto; margin: 2mm; }
                body {
                    font-family: 'Courier New', monospace;
                    width: 76mm;
                    margin: 0 auto;
                    padding: 8px 4px;
                    font-size: 11px;
                    color: #000;
                    line-height: 1.4;
                }
                .mono { font-variant-numeric: tabular-nums; }
                .center { text-align: center; }
                .bold { font-weight: 700; }
                .divider { border-bottom: 1px dashed #000; margin: 6px 0; }
                table { width: 100%; border-collapse: collapse; margin: 6px 0; font-size: 11px; }
                td { padding: 3px 0; }
                .val { text-align: left; }
                .highlight {
                    border: 1px solid #000;
                    padding: 6px;
                    margin: 8px 0;
                    text-align: center;
                    background: #f0f0f0;
                }
                .no-print { text-align: center; margin-bottom: 10px; }
                @media print { .no-print { display: none; } }
            </style>
        </head>
        <body>
            <div class="no-print">
                <button onclick="window.print()">🖨️ طباعة الإيصال</button>
            </div>
            <div class="center bold" style="font-size: 13px;">${companyName}</div>
            <div class="center">ملخص تقرير ومطابقة نقاط البيع</div>
            <div class="divider"></div>
            <div>النطاق: <strong>${selectedText}</strong></div>
            <div>الفترة: ${fromDate} إلى ${toDate}</div>
            <div>عدد الأيام: ${lastGeneratedPosReportData.length} يوم</div>
            <div>تاريخ الطباعة: ${new Date().toLocaleString('ar-SA')}</div>
            <div class="divider"></div>
            <table>
                <tr>
                    <td>إجمالي المبيعات:</td>
                    <td class="val mono">${formatPosMoney(sumGross)}</td>
                </tr>
                <tr>
                    <td>المرتجعات:</td>
                    <td class="val mono">-${formatPosMoney(sumRet)}</td>
                </tr>
                <tr class="bold">
                    <td style="border-top: 1px dotted #000;">صافي المبيعات:</td>
                    <td style="border-top: 1px dotted #000;" class="val mono">${formatPosMoney(sumNet)}</td>
                </tr>
                <tr>
                    <td>مبيعات الشبكة:</td>
                    <td class="val mono">-${formatPosMoney(sumNetw)}</td>
                </tr>
                <tr class="bold">
                    <td style="border-top: 1px dotted #000;">الكاش المتوقع (النظام):</td>
                    <td style="border-top: 1px dotted #000;" class="val mono">${formatPosMoney(sumExpected)}</td>
                </tr>
            </table>
            <div class="highlight">
                <div>الكاش الفعلي بالدرج:</div>
                <div class="bold mono" style="font-size: 13px;">${formatPosMoney(sumCash)} ر.س</div>
                <div style="margin-top: 4px; font-size: 10px;">
                    الفرق: <strong class="mono">${sumDiff >= 0 ? '+' : ''}${formatPosMoney(sumDiff)} (${Math.abs(sumDiff) < 0.01 ? 'متطابق' : sumDiff < 0 ? 'عجز' : 'زيادة'})</strong>
                </div>
            </div>
            <div class="divider"></div>
            <div class="center" style="font-size: 9px; margin-top: 8px; color: #555;">تم الإصدار عبر تطبيق ريزورا (REZORA POS)</div>
        </body>
        </html>
    `);

    printWin.document.close();
}

// Export functions to window
window.initPosSalesMatrix = initPosSalesMatrix;
window.handleMatrixInput = handleMatrixInput;
window.updateMatrixTotals = updateMatrixTotals;
window.savePosSalesMatrix = savePosSalesMatrix;
window.saveSinglePosSettlement = saveSinglePosSettlement;
window.handlePosDateChange = handlePosDateChange;
window.stepPosDate = stepPosDate;
window.setPosDateToday = setPosDateToday;
window.openNetworkModal = openNetworkModal;
window.closeNetworkModal = closeNetworkModal;
window.addNetworkItemRow = addNetworkItemRow;
window.calculateNetworkModalTotal = calculateNetworkModalTotal;
window.saveNetworkBreakdown = saveNetworkBreakdown;
window.renderPredefinedPosDropdown = renderPredefinedPosDropdown;
window.addSelectedPosFromDropdown = addSelectedPosFromDropdown;
window.unpinPosFromMatrix = unpinPosFromMatrix;
window.openMasterPosModal = openMasterPosModal;
window.closeMasterPosModal = closeMasterPosModal;
window.renderMasterPosTable = renderMasterPosTable;
window.saveMasterPosTerminal = saveMasterPosTerminal;
window.deleteMasterPosTerminal = deleteMasterPosTerminal;
window.togglePinMasterPos = togglePinMasterPos;
window.openAddPosModal = openAddPosModal;
window.closeAddPosModal = closeAddPosModal;
window.saveNewPosTerminal = saveNewPosTerminal;
window.printPosA4 = printPosA4;
window.printPosReceipt = printPosReceipt;
window.printDailyConsolidatedA4 = printDailyConsolidatedA4;
window.openPosReportModal = openPosReportModal;
window.closePosReportModal = closePosReportModal;
window.setPosReportDatePreset = setPosReportDatePreset;
window.generatePosReport = generatePosReport;
window.exportPosReportToExcel = exportPosReportToExcel;
window.printPosReportA4 = printPosReportA4;
window.printPosReportThermal = printPosReportThermal;
window.handleMatrixKeyNav = handleMatrixKeyNav;
window.handleNetworkKeyNav = handleNetworkKeyNav;
window.getMatrixInputElement = getMatrixInputElement;
window.printSpecificPosDateA4 = printSpecificPosDateA4;
window.getPosCompanyName = getPosCompanyName;
window.savePosCompanyName = savePosCompanyName;
window.savePosCompanyNameFromModal = savePosCompanyNameFromModal;
window.renderThermalNetworkItemsHtml = renderThermalNetworkItemsHtml;
window.getCurrentMatrixData = () => currentMatrixData;
window.setCurrentMatrixData = (d) => { currentMatrixData = d; };

