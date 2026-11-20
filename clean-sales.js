// Clean Sales Logic - Direct Submission - SAP Fiori Style
// With Duplicate Prevention & Resolution System

/**
 * Normalizes date string to YYYY-MM-DD
 */
function normalizeDate(d) {
    if (!d) return '';
    return String(d).trim().split('T')[0];
}

/**
 * Normalizes branch name for safe, bulletproof comparison
 */
function normalizeBranch(b) {
    if (!b) return '';
    if (typeof window.canonicalizeBranchName === 'function') {
        return window.canonicalizeBranchName(b);
    }
    return String(b)
        .replace(/[\u200B-\u200F\u202A-\u202E\uFEFF\u00AD\u00A0]/g, ' ')
        .replace(/[\u064B-\u065F\u0670]/g, '')
        .replace(/\u0640/g, '')
        .replace(/[أإآٱ]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}

/**
 * Checks if a sale already exists for the given date and branch
 * @param {string} date - Date string YYYY-MM-DD
 * @param {string} branch - Branch name
 * @param {string|null} excludeId - ID to exclude (when editing)
 * @returns {Promise<Object|null>} existing sale object or null
 */
async function getExistingSaleForBranchAndDate(date, branch, excludeId = null) {
    if (!date || !branch) return null;
    let sales = [];
    if (typeof window.getSales === 'function') {
        sales = await window.getSales();
    }
    const normDate = normalizeDate(date);
    const normBranch = normalizeBranch(branch);

    return sales.find(s => {
        if (excludeId && String(s.id) === String(excludeId)) return false;
        return normalizeDate(s.date) === normDate && normalizeBranch(s.branch) === normBranch;
    }) || null;
}

/**
 * Live validation check triggered when date or branch inputs change
 */
async function checkDuplicateSaleInput() {
    const dateInput = document.getElementById('saleDate');
    const branchInput = document.getElementById('saleBranch');
    const saleIdInput = document.getElementById('saleId');
    const alertBox = document.getElementById('duplicateSaleAlert');
    const submitBtn = document.querySelector('#cleanSalesForm button[type="submit"]');

    if (!dateInput || !branchInput) return;

    const date = dateInput.value;
    const branch = branchInput.value;
    const id = saleIdInput ? saleIdInput.value : '';

    if (!date || !branch) {
        if (alertBox) alertBox.style.display = 'none';
        dateInput.style.borderColor = '';
        branchInput.style.borderColor = '';
        if (submitBtn && !id) submitBtn.disabled = false;
        return;
    }

    try {
        const duplicate = await getExistingSaleForBranchAndDate(date, branch, id);

        if (duplicate) {
            // Show alert box
            if (alertBox) {
                alertBox.style.display = 'flex';
                const detailsEl = document.getElementById('duplicateAlertDetails');
                if (detailsEl) {
                    const amtStr = parseFloat(duplicate.amount || 0).toLocaleString('ar-SA', { minimumFractionDigits: 2 });
                    const descStr = duplicate.description ? `(البيان: ${duplicate.description})` : '';
                    detailsEl.innerHTML = `تم تسجيل مبيعات الفرع <strong>"${duplicate.branch}"</strong> بتاريخ <strong>${duplicate.date}</strong> مسبقاً بمبلغ <strong>${amtStr} ريال</strong> ${descStr}.`;
                }
                const editBtn = document.getElementById('btnEditDuplicate');
                if (editBtn) {
                    editBtn.onclick = () => editSale(duplicate.id);
                }
            }

            // Visual indicators on inputs
            dateInput.style.borderColor = 'var(--sap-error, #BB0000)';
            branchInput.style.borderColor = 'var(--sap-error, #BB0000)';
        } else {
            // No duplicate found
            if (alertBox) alertBox.style.display = 'none';
            dateInput.style.borderColor = '';
            branchInput.style.borderColor = '';
            if (submitBtn && !id) submitBtn.disabled = false;
        }
    } catch (e) {
        console.error('Error during duplicate check:', e);
    }
}

/**
 * Handle Clean Sales Form Submission
 */
async function handleCleanSubmit(event) {
    event.preventDefault();

    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;

    try {
        const date = document.getElementById('saleDate').value;
        const branch = document.getElementById('saleBranch').value;
        const amount = parseFloat(document.getElementById('saleAmount').value);
        const description = document.getElementById('saleDescription').value;
        const notes = document.getElementById('saleNotes').value;
        const id = document.getElementById('saleId').value;

        if (!date || !branch || isNaN(amount)) {
            showToast('warning', 'تنبيه', 'يرجى تعبئة الحقول الأساسية (التاريخ، الفرع، والمبلغ)');
            return;
        }

        // Check for duplicate sales on the same day for the same branch
        const duplicate = await getExistingSaleForBranchAndDate(date, branch, id);
        if (duplicate) {
            const formattedAmt = parseFloat(duplicate.amount || 0).toFixed(2);
            showToast(
                'error',
                '⚠️ تكرار غير مسموح',
                `تم تسجيل مبيعات الفرع "${branch}" لتاريخ ${date} مسبقاً بمبلغ ${formattedAmt} ريال. لا يمكن تسجيل أكثر من عملية لنفس الفرع في نفس اليوم.`
            );

            // Display alert banner in form
            await checkDuplicateSaleInput();
            return;
        }

        // Loading state
        submitBtn.innerHTML = '⏳ جاري الحفظ...';
        submitBtn.disabled = true;

        // Prepare data object
        const saleData = {
            id: id || Date.now().toString(),
            date,
            branch,
            amount,
            description,
            notes,
            updatedAt: new Date().toISOString()
        };

        if (!id) {
            saleData.createdAt = new Date().toISOString();
        }

        // Get current sales
        let currentSales = [];
        if (typeof window.getSales === 'function') {
            currentSales = await window.getSales();
        }

        if (id) {
            // Update existing
            const index = currentSales.findIndex(s => String(s.id) === String(id));
            if (index !== -1) {
                currentSales[index] = { ...currentSales[index], ...saleData };
            } else {
                currentSales.push(saleData);
            }
        } else {
            // Add new
            currentSales.push(saleData);
        }

        // Save
        if (typeof window.saveSales === 'function') {
            await window.saveSales(currentSales);

            showToast('success', 'تم الحفظ بنجاح', id ? 'تم تحديث بيانات العملية بنجاح' : 'تم تسجيل العملية بنجاح');
            resetCleanForm();

            // Refresh list if visible
            const listSection = document.getElementById('salesListSection');
            if (listSection && listSection.style.display !== 'none') {
                loadSalesTable();
            }

            // Update dashboard stats if needed
            window.dispatchEvent(new CustomEvent('salesUpdated', { detail: currentSales }));
        }

    } catch (error) {
        console.error('Error saving sale:', error);
        showToast('error', 'خطأ', 'حدثت مشكلة أثناء الحفظ');
    } finally {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

/**
 * Reset Sales Form and clear state
 */
function resetCleanForm() {
    const form = document.getElementById('cleanSalesForm');
    if (form) form.reset();

    const idInput = document.getElementById('saleId');
    if (idInput) idInput.value = '';

    const dateInput = document.getElementById('saleDate');
    if (dateInput) dateInput.valueAsDate = new Date();

    const branchInput = document.getElementById('saleBranch');
    if (branchInput) branchInput.style.borderColor = '';
    if (dateInput) dateInput.style.borderColor = '';

    // Hide banners
    const alertBox = document.getElementById('duplicateSaleAlert');
    if (alertBox) alertBox.style.display = 'none';

    const editBanner = document.getElementById('editModeBanner');
    if (editBanner) editBanner.style.display = 'none';

    // Reset button
    const submitBtn = document.querySelector('#cleanSalesForm button[type="submit"]');
    if (submitBtn) {
        submitBtn.innerHTML = 'حفظ العملية';
        submitBtn.disabled = false;
    }
}

/**
 * Cancel Edit mode
 */
function cancelEdit() {
    resetCleanForm();
    showToast('info', 'تم الإلغاء', 'تم إلغاء وضع التعديل والعودة لتسجيل عملية جديدة');
}

/**
 * Load Branches dropdown options with bulletproof Arabic canonicalization & deduplication
 */
async function loadBranches() {
    const select = document.getElementById('saleBranch');
    if (!select) return;

    try {
        let branches = [];
        if (typeof window.getBranches === 'function') {
            branches = await window.getBranches();
        }

        const currentValue = select.value ? normalizeBranch(select.value) : '';

        // Reset select with single clean placeholder
        select.innerHTML = '<option value="">اختر الفرع...</option>';

        // Deduplicate branch names strictly with Arabic canonicalization
        const seenKeys = new Set();
        let matchedValue = '';

        branches.forEach(b => {
            if (!b) return;
            const rawName = typeof b === 'string' ? b : (b.name || b.branch || b.branchName || '');
            const cleanName = String(rawName)
                .replace(/[\u200B-\u200F\u202A-\u202E\uFEFF\u00AD\u00A0]/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();

            if (!cleanName) return;

            const canonicalKey = normalizeBranch(cleanName);
            if (!seenKeys.has(canonicalKey)) {
                seenKeys.add(canonicalKey);
                const opt = document.createElement('option');
                opt.value = cleanName;
                opt.textContent = cleanName;
                select.appendChild(opt);

                if (currentValue && canonicalKey === currentValue) {
                    matchedValue = cleanName;
                }
            }
        });

        // Restore previous value if still valid
        if (matchedValue) {
            select.value = matchedValue;
        }
    } catch (e) {
        console.error('Error loading branches:', e);
    }
}

// Auto-update dropdown whenever branches are updated in the system
window.addEventListener('branchesUpdated', () => {
    loadBranches();
});

/**
 * Load and render Sales Table with Duplicate Badging and Search
 */
async function loadSalesTable() {
    const tbody = document.getElementById('salesTableBody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">جاري التحميل...</td></tr>';

    try {
        let sales = [];
        if (typeof window.getSales === 'function') {
            sales = await window.getSales();
        }

        if (sales.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--sap-text-secondary);">لا توجد سجلات</td></tr>';
            updateDuplicateCounter([]);
            return;
        }

        // Map duplicates across all sales
        const duplicateCountMap = {};
        sales.forEach(sale => {
            const key = `${normalizeDate(sale.date)}_${normalizeBranch(sale.branch)}`;
            duplicateCountMap[key] = (duplicateCountMap[key] || 0) + 1;
        });

        // Update UI indicator for duplicate manager
        updateDuplicateCounter(sales, duplicateCountMap);

        // Filter sales if search input is active
        const searchInput = document.getElementById('searchSales');
        const searchQuery = searchInput ? searchInput.value.trim().toLowerCase() : '';

        const displaySales = searchQuery
            ? sales.filter(s =>
                (s.branch && s.branch.toLowerCase().includes(searchQuery)) ||
                (s.date && s.date.includes(searchQuery)) ||
                (s.description && s.description.toLowerCase().includes(searchQuery)) ||
                (s.amount && String(s.amount).includes(searchQuery))
            )
            : sales;

        if (displaySales.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--sap-text-secondary);">لا توجد نتائج مطابقة للبحث</td></tr>';
            return;
        }

        // Group sales by year and month
        const groupedData = {};
        const currentDate = new Date();
        const currentYear = currentDate.getFullYear();
        const currentMonth = currentDate.getMonth() + 1;

        displaySales.forEach(sale => {
            const saleDate = new Date(sale.date);
            const year = saleDate.getFullYear() || currentYear;
            const month = (saleDate.getMonth() + 1) || currentMonth;
            const monthKey = `${year}-${String(month).padStart(2, '0')}`;

            if (!groupedData[year]) {
                groupedData[year] = {};
            }
            if (!groupedData[year][monthKey]) {
                groupedData[year][monthKey] = {
                    sales: [],
                    total: 0,
                    month: month,
                    year: year
                };
            }
            groupedData[year][monthKey].sales.push(sale);
            groupedData[year][monthKey].total += parseFloat(sale.amount || 0);
        });

        // Sort years descending
        const years = Object.keys(groupedData).sort((a, b) => b - a);

        const monthNames = [
            'يناير', 'فبراير', 'مارس', 'إبريل', 'مايو', 'يونيو',
            'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
        ];

        let html = '';

        years.forEach(year => {
            const yearData = groupedData[year];
            const yearTotal = Object.values(yearData).reduce((sum, m) => sum + m.total, 0);
            const isCurrentYear = parseInt(year) === currentYear;
            const yearId = `year-${year}`;

            // Year header row
            html += `
                <tr class="year-header" onclick="toggleYear('${yearId}')" style="cursor:pointer; background-color: var(--sap-bg-hover, #EBF5FE); font-weight: bold;">
                    <td colspan="3">
                        <span id="${yearId}-icon" style="display:inline-block; transition: transform 0.3s;">${isCurrentYear ? '▼' : '◀'}</span>
                        📅 السنة ${year}
                    </td>
                    <td style="font-weight:bold; color:var(--sap-primary, #0A6ED1);">${yearTotal.toFixed(2)} ريال</td>
                    <td></td>
                </tr>
            `;

            // Sort months descending
            const months = Object.keys(yearData).sort((a, b) => b.localeCompare(a));

            months.forEach(monthKey => {
                const monthData = yearData[monthKey];
                const isCurrentMonth = parseInt(year) === currentYear && monthData.month === currentMonth;
                const monthId = `month-${monthKey}`;
                const monthName = monthNames[monthData.month - 1] || monthKey;

                // Month header row
                html += `
                    <tr class="month-header ${yearId}-content" style="display:${isCurrentYear ? 'table-row' : 'none'}; cursor:pointer; background-color: #F8F9FA;" onclick="toggleMonth('${monthId}')">
                        <td colspan="3" style="padding-right: 30px;">
                            <span id="${monthId}-icon" style="display:inline-block; transition: transform 0.3s;">${isCurrentMonth ? '▼' : '◀'}</span>
                            📊 ${monthName} ${year}
                        </td>
                        <td style="font-weight:bold; color:var(--sap-primary-active, #063B70);">${monthData.total.toFixed(2)} ريال</td>
                        <td style="color:var(--sap-text-secondary); font-size:0.85rem;">${monthData.sales.length} عملية</td>
                    </tr>
                `;

                // Sort sales within month by date descending
                monthData.sales.sort((a, b) => new Date(b.date) - new Date(a.date));

                // Sales rows
                monthData.sales.forEach(sale => {
                    const dupKey = `${normalizeDate(sale.date)}_${normalizeBranch(sale.branch)}`;
                    const isDuplicate = duplicateCountMap[dupKey] > 1;

                    const duplicateBadge = isDuplicate
                        ? `<span title="يوجد أكثر من عملية لنفس الفرع في هذا اليوم" style="background:#FFF3CD; color:#856404; border:1px solid #FFEBAA; padding:2px 6px; border-radius:4px; font-size:0.75rem; font-weight:bold; margin-right:6px; cursor:pointer;" onclick="openDuplicateManager()">⚠️ مكرر</span>`
                        : '';

                    html += `
                        <tr class="${monthId}-content ${yearId}-content" style="display:${isCurrentYear && isCurrentMonth ? 'table-row' : 'none'}; ${isDuplicate ? 'background-color: #fffdf5;' : ''}">
                            <td style="padding-right: 50px;">
                                ${sale.date}
                                ${duplicateBadge}
                            </td>
                            <td>${sale.branch}</td>
                            <td>${sale.description || '-'}</td>
                            <td style="font-weight:bold; color:var(--sap-primary-active, #063B70);">${parseFloat(sale.amount || 0).toFixed(2)}</td>
                            <td>
                                <button class="btn-sap btn-standard" style="padding:5px 10px; font-size:0.8rem;" onclick="editSale('${sale.id}')" title="تعديل">✏️</button>
                                <button class="btn-sap btn-standard" style="padding:5px 10px; font-size:0.8rem; color:var(--sap-error, #BB0000); border-color:var(--sap-error, #BB0000);" onclick="deleteSale('${sale.id}')" title="حذف">🗑️</button>
                            </td>
                        </tr>
                    `;
                });
            });
        });

        tbody.innerHTML = html;

    } catch (e) {
        console.error('Error loading table:', e);
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:red;">خطأ في التحميل</td></tr>';
    }
}

/**
 * Updates duplicate detection indicator button above sales table
 */
function updateDuplicateCounter(sales, duplicateCountMap = null) {
    if (!duplicateCountMap) {
        duplicateCountMap = {};
        sales.forEach(sale => {
            const key = `${normalizeDate(sale.date)}_${normalizeBranch(sale.branch)}`;
            duplicateCountMap[key] = (duplicateCountMap[key] || 0) + 1;
        });
    }

    const duplicateRowsCount = sales.filter(sale => {
        const key = `${normalizeDate(sale.date)}_${normalizeBranch(sale.branch)}`;
        return duplicateCountMap[key] > 1;
    }).length;

    const btnCheckDuplicates = document.getElementById('btnCheckDuplicates');
    const badgeCount = document.getElementById('duplicateBadgeCount');

    if (btnCheckDuplicates && badgeCount) {
        if (duplicateRowsCount > 0) {
            badgeCount.textContent = duplicateRowsCount;
            btnCheckDuplicates.style.display = 'inline-flex';
        } else {
            btnCheckDuplicates.style.display = 'none';
        }
    }
}

/**
 * Toggle year visibility in sales table
 */
function toggleYear(yearId) {
    const icon = document.getElementById(`${yearId}-icon`);
    const rows = document.querySelectorAll(`.${yearId}-content`);

    const isVisible = rows[0]?.style.display !== 'none';

    rows.forEach(row => {
        if (row.classList.contains('month-header')) {
            row.style.display = isVisible ? 'none' : 'table-row';
        } else {
            const monthId = Array.from(row.classList).find(c => c.endsWith('-content') && c !== `${yearId}-content`);
            if (monthId) {
                const monthIcon = document.getElementById(monthId.replace('-content', '-icon'));
                if (monthIcon && monthIcon.textContent === '▼') {
                    row.style.display = isVisible ? 'none' : 'table-row';
                }
            }
        }
    });

    if (icon) icon.textContent = isVisible ? '◀' : '▼';
}

/**
 * Toggle month visibility in sales table
 */
function toggleMonth(monthId) {
    if (window.event) window.event.stopPropagation();
    const icon = document.getElementById(`${monthId}-icon`);
    const rows = document.querySelectorAll(`.${monthId}-content`);

    const isVisible = rows[0]?.style.display !== 'none';

    rows.forEach(row => {
        if (!row.classList.contains('month-header')) {
            row.style.display = isVisible ? 'none' : 'table-row';
        }
    });

    if (icon) icon.textContent = isVisible ? '◀' : '▼';
}

/**
 * Delete a sale
 */
async function deleteSale(id) {
    if (!confirm('هل أنت متأكد من حذف هذا السجل؟')) return;

    try {
        let sales = await window.getSales();
        sales = sales.filter(s => String(s.id) !== String(id));
        await window.saveSales(sales);
        showToast('info', 'تم الحذف', 'تم حذف السجل بنجاح');
        loadSalesTable();
        window.dispatchEvent(new CustomEvent('salesUpdated', { detail: sales }));
    } catch (e) {
        console.error(e);
        showToast('error', 'خطأ', 'فشل الحذف');
    }
}

/**
 * Load sale into form for editing
 */
async function editSale(id) {
    try {
        const sales = await window.getSales();
        const sale = sales.find(s => String(s.id) === String(id));
        if (sale) {
            document.getElementById('saleId').value = sale.id;
            document.getElementById('saleDate').value = sale.date;
            document.getElementById('saleBranch').value = sale.branch;
            document.getElementById('saleAmount').value = sale.amount;
            document.getElementById('saleDescription').value = sale.description || '';
            document.getElementById('saleNotes').value = sale.notes || '';

            // Update edit mode indicator banner
            const editBanner = document.getElementById('editModeBanner');
            if (editBanner) {
                editBanner.style.display = 'flex';
                const editInfo = document.getElementById('editModeInfo');
                if (editInfo) {
                    editInfo.textContent = `أنت الآن في وضع تعديل سجل الفرع "${sale.branch}" لتاريخ ${sale.date}`;
                }
            }

            // Update submit button text
            const submitBtn = document.querySelector('#cleanSalesForm button[type="submit"]');
            if (submitBtn) {
                submitBtn.innerHTML = '💾 تحديث العملية';
                submitBtn.disabled = false;
            }

            // Hide duplicate warning since we're now editing this record
            const alertBox = document.getElementById('duplicateSaleAlert');
            if (alertBox) alertBox.style.display = 'none';

            const dateInput = document.getElementById('saleDate');
            const branchInput = document.getElementById('saleBranch');
            if (dateInput) dateInput.style.borderColor = '';
            if (branchInput) branchInput.style.borderColor = '';

            // Scroll to form smoothly
            const card = document.querySelector('.sap-card') || document.querySelector('.clean-card');
            if (card) card.scrollIntoView({ behavior: 'smooth' });

            showToast('info', 'وضع التعديل', `تم تحميل بيانات السجل لتعديلها.`);
        }
    } catch (e) {
        console.error('Error in editSale:', e);
    }
}

/**
 * Toggle sales table section
 */
function toggleSalesTable() {
    const section = document.getElementById('salesListSection');
    const btn = document.getElementById('toggleSalesBtn');
    if (!section) return;

    if (section.style.display === 'none') {
        section.style.display = 'block';
        if (btn) btn.style.backgroundColor = '#EBF5FE';
        loadSalesTable();
    } else {
        section.style.display = 'none';
        if (btn) btn.style.backgroundColor = '';
    }
}

/**
 * Open Duplicate Manager Modal to review, merge, or delete past duplicates
 */
async function openDuplicateManager() {
    const modal = document.getElementById('duplicateManagerModalOverlay');
    const container = document.getElementById('duplicateManagerList');
    if (!modal || !container) return;

    container.innerHTML = '<div style="text-align:center; padding: 2rem;">جاري الفحص...</div>';
    modal.style.display = 'flex';

    try {
        const sales = await window.getSales();

        // Group by branch + date
        const groupsMap = {};
        sales.forEach(sale => {
            const key = `${normalizeDate(sale.date)}_${normalizeBranch(sale.branch)}`;
            if (!groupsMap[key]) {
                groupsMap[key] = {
                    date: sale.date,
                    branch: sale.branch,
                    items: []
                };
            }
            groupsMap[key].items.push(sale);
        });

        const duplicateGroups = Object.values(groupsMap).filter(g => g.items.length > 1);

        if (duplicateGroups.length === 0) {
            container.innerHTML = `
                <div style="text-align:center; padding: 2.5rem 1rem; color: var(--sap-success, #107E3E);">
                    <div style="font-size: 3rem; margin-bottom: 0.5rem;">🎉</div>
                    <h3 style="margin: 0 0 0.5rem 0;">رائع! لا توجد مبيعات مكررة</h3>
                    <p style="color: var(--sap-text-secondary); margin: 0;">جميع سجلات المبيعات فريدة لكل فرع وتاريخ.</p>
                </div>
            `;
            return;
        }

        let html = '';
        duplicateGroups.forEach((group, gIndex) => {
            const groupTotal = group.items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

            html += `
                <div style="border: 1px solid #FFE0B2; background: #FFFDF9; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #FFE0B2; padding-bottom: 10px; margin-bottom: 12px;">
                        <div>
                            <span style="font-weight: bold; font-size: 1.05rem; color: #E65100;">📍 ${group.branch}</span>
                            <span style="color: #666; margin: 0 8px;">|</span>
                            <span style="font-weight: 600;">📅 ${group.date}</span>
                            <span style="background: #FFE0B2; color: #BF360C; font-size: 0.75rem; padding: 2px 8px; border-radius: 12px; margin-right: 8px; font-weight: bold;">${group.items.length} عمليات</span>
                        </div>
                        <div style="text-align: left;">
                            <span style="font-size: 0.85rem; color: #666;">الإجمالي الحالي: </span>
                            <strong style="color: var(--sap-primary, #0A6ED1); font-size: 1.05rem;">${groupTotal.toFixed(2)} ريال</strong>
                        </div>
                    </div>

                    <div style="display: grid; gap: 8px; margin-bottom: 14px;">
                        ${group.items.map((item, idx) => `
                            <div style="display: flex; justify-content: space-between; align-items: center; background: #FFFFFF; border: 1px solid #EEEEEE; padding: 10px 14px; border-radius: 6px;">
                                <div>
                                    <strong style="color: #333;">عملية ${idx + 1}:</strong>
                                    <span style="color: var(--sap-primary-active, #063B70); font-weight: bold; margin: 0 8px;">${parseFloat(item.amount).toFixed(2)} ريال</span>
                                    <span style="color: #777; font-size: 0.9rem;">${item.description ? `(البيان: ${item.description})` : '(بدون بيان)'}</span>
                                </div>
                                <div style="display: flex; gap: 8px;">
                                    <button class="btn-sap btn-standard" style="padding: 4px 10px; font-size: 0.8rem;" onclick="editSale('${item.id}'); closeDuplicateManager();" title="تعديل هذا السجل">✏️ تعديل</button>
                                    <button class="btn-sap btn-standard" style="padding: 4px 10px; font-size: 0.8rem; color: var(--sap-error, #BB0000); border-color: var(--sap-error, #BB0000);" onclick="deleteDuplicateRecord('${item.id}', '${group.date}', '${group.branch}')" title="حذف هذا السجل">🗑️ حذف</button>
                                </div>
                            </div>
                        `).join('')}
                    </div>

                    <div style="display: flex; justify-content: flex-end;">
                        <button class="btn-sap btn-emphasized" style="font-size: 0.85rem;" onclick="mergeDuplicateGroup('${group.date}', '${group.branch}')">
                            ⚡ دمج السجلات في سجل واحد (${groupTotal.toFixed(2)} ريال)
                        </button>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;

    } catch (e) {
        console.error('Error loading duplicate manager:', e);
        container.innerHTML = '<div style="color:red; text-align:center;">حدث خطأ أثناء فحص السجلات</div>';
    }
}

/**
 * Close Duplicate Manager Modal
 */
function closeDuplicateManager() {
    const modal = document.getElementById('duplicateManagerModalOverlay');
    if (modal) modal.style.display = 'none';
}

/**
 * Merge a group of duplicate records into a single consolidated record
 */
async function mergeDuplicateGroup(date, branch) {
    if (!confirm(`هل أنت متأكد من دمج مبيعات الفرع "${branch}" بتاريخ ${date} في سجل واحد؟\nسيتم جمع مبالغ العمليات وتوحيد البيانات في سجل واحد.`)) {
        return;
    }

    try {
        let sales = await window.getSales();
        const normDate = normalizeDate(date);
        const normBranch = normalizeBranch(branch);

        const group = sales.filter(s => normalizeDate(s.date) === normDate && normalizeBranch(s.branch) === normBranch);
        if (group.length <= 1) {
            showToast('info', 'معلومات', 'لا توجد سجلات مكررة لدمجها.');
            openDuplicateManager();
            return;
        }

        // Calculate total amount
        const totalAmount = group.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);

        // Combine unique descriptions
        const descriptions = group.map(s => (s.description || '').trim()).filter(Boolean);
        const uniqueDescriptions = [...new Set(descriptions)];
        const combinedDescription = uniqueDescriptions.join(' + ') || 'مبيعات مدمجة';

        // Combine notes
        const notesList = group.map((s, idx) => {
            const note = (s.notes || '').trim();
            return note ? `[عملية ${idx + 1}: ${note}]` : '';
        }).filter(Boolean);
        const combinedNotes = notesList.join('\n');

        // Master ID is first item, others will be removed
        const masterId = group[0].id;
        const otherIds = new Set(group.slice(1).map(s => String(s.id)));

        sales = sales.filter(s => !otherIds.has(String(s.id))).map(s => {
            if (String(s.id) === String(masterId)) {
                return {
                    ...s,
                    date: date,
                    branch: branch,
                    amount: totalAmount,
                    description: combinedDescription,
                    notes: combinedNotes ? (s.notes ? s.notes + '\n' + combinedNotes : combinedNotes) : (s.notes || ''),
                    updatedAt: new Date().toISOString()
                };
            }
            return s;
        });

        await window.saveSales(sales);
        showToast('success', 'تم الدمج بنجاح', `تم دمج ${group.length} عمليات بإجمالي ${totalAmount.toFixed(2)} ريال.`);

        loadSalesTable();
        window.dispatchEvent(new CustomEvent('salesUpdated', { detail: sales }));

        // Refresh modal
        openDuplicateManager();

    } catch (e) {
        console.error('Error merging duplicate group:', e);
        showToast('error', 'خطأ', 'حدث خطأ أثناء دمج السجلات.');
    }
}

/**
 * Delete one of the duplicate records from within the Duplicate Manager
 */
async function deleteDuplicateRecord(id, date, branch) {
    if (!confirm('هل أنت متأكد من حذف هذه العملية المكررة؟')) return;

    try {
        let sales = await window.getSales();
        sales = sales.filter(s => String(s.id) !== String(id));
        await window.saveSales(sales);
        showToast('info', 'تم الحذف', 'تم حذف العملية المكررة بنجاح.');

        loadSalesTable();
        window.dispatchEvent(new CustomEvent('salesUpdated', { detail: sales }));

        // Refresh modal
        openDuplicateManager();

    } catch (e) {
        console.error('Error deleting duplicate record:', e);
        showToast('error', 'خطأ', 'فشل حذف العملية.');
    }
}

/**
 * Initialize event listeners
 */
function initCleanSales() {
    loadBranches();

    // Default date to today
    const dateInput = document.getElementById('saleDate');
    if (dateInput && !dateInput.value) {
        dateInput.valueAsDate = new Date();
    }

    // Attach live duplicate check on date change
    if (dateInput) {
        dateInput.addEventListener('change', checkDuplicateSaleInput);
        dateInput.addEventListener('input', checkDuplicateSaleInput);
    }

    // Attach live duplicate check on branch change
    const branchInput = document.getElementById('saleBranch');
    if (branchInput) {
        branchInput.addEventListener('change', checkDuplicateSaleInput);
    }

    // Attach live search filtering on table search input
    const searchInput = document.getElementById('searchSales');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            loadSalesTable();
        });
    }
}

// Global initialization
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCleanSales);
} else {
    initCleanSales();
}
