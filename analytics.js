// Analytics Page Logic - Executive Business Intelligence Dashboard - SAP Fiori Style

/**
 * Universal Excel Downloader using SheetJS
 */
function downloadExcel(data, fileName, sheetName = 'تقرير') {
    try {
        if (typeof XLSX === 'undefined') {
            showToast('error', 'خطأ', 'مكتبة SheetJS غير محملة');
            return;
        }
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
        const dateStr = new Date().toISOString().split('T')[0];
        XLSX.writeFile(wb, `${fileName}_${dateStr}.xlsx`);
        showToast('success', 'تم التصدير بنجاح', `تم تنزيل ملف Excel بنجاح`);
    } catch (e) {
        console.error('Error downloading Excel:', e);
        showToast('error', 'خطأ', 'فشل تصدير ملف Excel');
    }
}

/**
 * Update Executive KPI Cards at the top of Analytics
 */
async function updateAnalyticsKPIs() {
    try {
        let sales = [];
        if (typeof window.getSales === 'function') {
            sales = await window.getSales();
        }

        const totalSales = sales.reduce((sum, s) => sum + Number(s.amount || 0), 0);
        const totalTx = sales.length;
        const avgTx = totalTx > 0 ? totalSales / totalTx : 0;

        // Top branch
        const branchTotals = {};
        sales.forEach(s => {
            const b = s.branch || 'غير محدد';
            branchTotals[b] = (branchTotals[b] || 0) + Number(s.amount || 0);
        });

        const sortedBranches = Object.entries(branchTotals).sort((a, b) => b[1] - a[1]);
        const topBranch = sortedBranches[0] || ['-', 0];

        const elTotalSales = document.getElementById('kpiTotalSales');
        if (elTotalSales) elTotalSales.textContent = (typeof formatMoney === 'function' ? formatMoney(totalSales) : totalSales.toFixed(2)) + ' ريال';

        const elTotalTx = document.getElementById('kpiTotalTx');
        if (elTotalTx) elTotalTx.textContent = totalTx.toLocaleString('ar-SA');

        const elAvgTx = document.getElementById('kpiAvgTx');
        if (elAvgTx) elAvgTx.textContent = (typeof formatMoney === 'function' ? formatMoney(avgTx) : avgTx.toFixed(2)) + ' ريال';

        const elTopBranch = document.getElementById('kpiTopBranch');
        if (elTopBranch) elTopBranch.textContent = topBranch[0];

        const elTopBranchAmount = document.getElementById('kpiTopBranchAmount');
        if (elTopBranchAmount) elTopBranchAmount.textContent = `بإجمالي ${(typeof formatMoney === 'function' ? formatMoney(topBranch[1]) : topBranch[1].toFixed(2))} ريال`;
    } catch (e) {
        console.error('Error updating Analytics KPIs:', e);
    }
}

// HTML Templates for different reports
const REPORT_TEMPLATES = {
    daily: `
        <div class="sap-card" style="margin: 0;">
            <div class="sap-card-header" style="flex-wrap: wrap; gap: 10px;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <h3 class="sap-card-title">📅 التقرير اليومي</h3>
                </div>
                <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                    <div style="display: flex; gap: 4px;">
                        <button type="button" class="quick-preset-btn" onclick="document.getElementById('reportDate').valueAsDate=new Date(); generateReport();">اليوم</button>
                        <button type="button" class="quick-preset-btn" onclick="const y=new Date(); y.setDate(y.getDate()-1); document.getElementById('reportDate').value=y.toISOString().split('T')[0]; generateReport();">أمس</button>
                    </div>
                    <input type="date" id="reportDate" class="sap-input" style="width: auto;">
                    <button class="btn-sap btn-emphasized" onclick="generateReport()">🔄 تحديث</button>
                    <button class="btn-sap btn-standard" onclick="copyReportText()">📋 نسخ الملخص</button>
                    <button class="btn-sap btn-standard" onclick="printReport()">🖨️ طباعة</button>
                    <button class="btn-sap btn-standard" onclick="exportDailyReportToExcel()" style="color: #107E3E; border-color: #107E3E;">📊 Excel</button>
                </div>
            </div>
            <div class="sap-card-content">
                <div id="reportPaper" class="report-paper-container">
                    <div class="report-header-banner">
                        <h2>تقرير المبيعات اليومي المعتمد</h2>
                        <div style="color: var(--sap-text-secondary); font-size: 0.95rem; font-weight: 600; display: inline-flex; align-items: center; gap: 8px; background: var(--sap-bg-secondary); padding: 5px 18px; border-radius: var(--sap-radius-pill); border: 1px solid var(--sap-border);">
                            <span>📅</span>
                            <span id="displayDate">--/--/----</span>
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.25rem; margin-bottom: 1.75rem;">
                        <div class="report-stat-box report-stat-primary">
                            <div style="color: var(--sap-text-secondary); font-size: 0.88rem; font-weight: 600;">إجمالي اليوم</div>
                            <div id="todayTotal" style="color: var(--sap-primary); font-size: 2rem; font-weight: 800; margin: 4px 0;">0.00</div>
                            <div style="color: var(--sap-text-muted); font-size: 0.8rem; font-weight: 500;">ريال سعودي</div>
                        </div>
                        <div class="report-stat-box">
                            <div style="color: var(--sap-text-secondary); font-size: 0.88rem; font-weight: 600;">المتوسط الشهري</div>
                            <div id="monthlyAverage" style="color: var(--sap-text-primary); font-size: 1.6rem; font-weight: 800; margin: 4px 0;">0.00</div>
                            <div style="color: var(--sap-text-muted); font-size: 0.8rem; font-weight: 500;">ريال / يوم</div>
                        </div>
                        <div class="report-stat-box report-stat-success">
                            <div style="color: var(--sap-text-secondary); font-size: 0.88rem; font-weight: 600;">إجمالي الشهر (تراكمي)</div>
                            <div id="monthTotal" style="color: var(--sap-success); font-size: 1.6rem; font-weight: 800; margin: 4px 0;">0.00</div>
                            <div style="color: var(--sap-text-muted); font-size: 0.8rem; font-weight: 500;">ريال سعودي</div>
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; background: var(--sap-bg-secondary); padding: 1.25rem; border-radius: var(--sap-radius-md); border: 1px solid var(--sap-border); margin-bottom: 1.75rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="color: var(--sap-text-secondary); font-weight: 600;">عدد العمليات:</span>
                            <span id="transactionsCount" style="font-weight: 800; font-size: 1.2rem; color: var(--sap-text-primary);">0</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="color: var(--sap-text-secondary); font-weight: 600;">أعلى عملية اليوم:</span>
                            <span id="maxTransaction" style="font-weight: 800; font-size: 1.2rem; color: var(--sap-primary);">0.00 ريال</span>
                        </div>
                    </div>

                    <!-- Day Transactions List -->
                    <div id="dailyTransactionsSection" style="margin-top: 1.75rem; border-top: 1px solid var(--sap-border-light); padding-top: 1.5rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                            <h4 style="margin: 0; color: var(--sap-text-primary); font-size: 1.1rem; font-weight: 700;">تفاصيل عمليات مبيعات اليوم</h4>
                            <span id="dailyTxBadge" class="badge-pill badge-pill-primary">0 عمليات</span>
                        </div>
                        <div style="overflow-x: auto;">
                            <table class="sap-table" style="font-size: 0.9rem;">
                                <thead>
                                    <tr>
                                        <th style="width: 50px;">#</th>
                                        <th>الفرع</th>
                                        <th>البيان / الوصف</th>
                                        <th style="text-align: left;">المبلغ (ريال)</th>
                                    </tr>
                                </thead>
                                <tbody id="dailyTransactionsBody">
                                    <tr><td colspan="4" style="text-align:center; color:#999; padding: 15px;">جاري التحميل...</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div style="text-align: center; color: #999; font-size: 0.8rem; margin-top: 25px; border-top: 1px solid #f0f0f0; padding-top: 10px;">
                        <p style="margin: 0;">تم إنشاء هذا التقرير تلقائياً بواسطة نظام المبيعات في: <span id="generationTime">--:--</span></p>
                    </div>
                </div>
            </div>
        </div>
    `,
    monthly: `
        <div class="sap-card" style="margin: 0;">
            <div class="sap-card-header" style="flex-wrap: wrap; gap: 10px;">
                <h3 class="sap-card-title">📈 التقرير الشهري</h3>
                <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
                    <select id="mbrBranch" class="sap-input" style="width: auto;">
                        <option value="">كل الفروع</option>
                    </select>
                    <input type="month" id="mbrFromDate" class="sap-input" style="width: auto;">
                    <span>إلى</span>
                    <input type="month" id="mbrToDate" class="sap-input" style="width: auto;">
                    <select id="mbrReportType" class="sap-input" style="width: auto;">
                        <option value="summary">ملخص شهري</option>
                        <option value="detailed">تفصيلي (يومي)</option>
                    </select>
                    <button class="btn-sap btn-emphasized" onclick="generateMonthlyBranchReport()">🔄 عرض</button>
                    <button class="btn-sap btn-standard" onclick="printMonthlyBranchReport()">🖨️ طباعة</button>
                    <button class="btn-sap btn-standard" onclick="exportMonthlyBranchReportToExcel()" style="color: #107E3E; border-color: #107E3E;">📊 Excel</button>
                </div>
            </div>
            <div class="sap-card-content" style="padding: 0;">
                <div id="summaryReportSection">
                    <div style="overflow-x: auto;">
                        <table class="sap-table" id="mbrTable">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>الفرع</th>
                                    <th>الشهر / السنة</th>
                                    <th>عدد العمليات</th>
                                    <th>المتوسط</th>
                                    <th>النسبة</th>
                                    <th>إجمالي المبيعات</th>
                                </tr>
                            </thead>
                            <tbody id="mbrBody"></tbody>
                            <tfoot id="mbrFoot"></tfoot>
                        </table>
                    </div>
                </div>

                <div id="detailedReportSection" style="display: none;">
                    <div style="overflow-x: auto;">
                        <table class="sap-table" id="mbrDetailedTable">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>التاريخ</th>
                                    <th>الفرع</th>
                                    <th>عدد العمليات</th>
                                    <th>إجمالي المبيعات</th>
                                    <th>المتوسط</th>
                                </tr>
                            </thead>
                            <tbody id="mbrDetailedBody"></tbody>
                            <tfoot id="mbrDetailedFoot"></tfoot>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    `,
    custom: `
        <div class="sap-card" style="margin: 0;">
            <div class="sap-card-header" style="flex-wrap: wrap; gap: 10px;">
                <h3 class="sap-card-title">🔍 تقرير مخصص</h3>
                <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                    <div style="display: flex; gap: 4px; flex-wrap: wrap;">
                        <button type="button" class="quick-preset-btn" id="preset-today" onclick="setCustomDatePreset('today')">اليوم</button>
                        <button type="button" class="quick-preset-btn" id="preset-yesterday" onclick="setCustomDatePreset('yesterday')">أمس</button>
                        <button type="button" class="quick-preset-btn" id="preset-week" onclick="setCustomDatePreset('week')">هذا الأسبوع</button>
                        <button type="button" class="quick-preset-btn active" id="preset-month" onclick="setCustomDatePreset('month')">هذا الشهر</button>
                        <button type="button" class="quick-preset-btn" id="preset-lastMonth" onclick="setCustomDatePreset('lastMonth')">الشهر الماضي</button>
                        <button type="button" class="quick-preset-btn" id="preset-year" onclick="setCustomDatePreset('year')">هذا العام</button>
                    </div>
                    <select id="customBranch" class="sap-input" style="width: auto;">
                        <option value="">كل الفروع</option>
                    </select>
                    <input type="date" id="customFromDate" class="sap-input" style="width: auto;">
                    <span>إلى</span>
                    <input type="date" id="customToDate" class="sap-input" style="width: auto;">
                    <button class="btn-sap btn-emphasized" onclick="generateCustomReport()">🔄 عرض</button>
                    <button class="btn-sap btn-standard" onclick="printCustomReport()">🖨️ طباعة</button>
                    <button class="btn-sap btn-standard" onclick="exportCustomReportToExcel()" style="color: #107E3E; border-color: #107E3E;">📊 Excel</button>
                </div>
            </div>
            <div class="sap-card-content">
                <div id="customReportContent" style="display: none;">
                    <div class="report-paper-container">
                        <div class="report-header-banner">
                            <h2>تقرير المبيعات المخصص</h2>
                            <div style="color: var(--sap-text-secondary); font-size: 0.95rem; font-weight: 600; display: inline-flex; align-items: center; gap: 8px; background: var(--sap-bg-secondary); padding: 5px 18px; border-radius: var(--sap-radius-pill); border: 1px solid var(--sap-border);">
                                <span>الفترة من <strong id="displayFromDate"></strong> إلى <strong id="displayToDate"></strong></span>
                                <span id="displayBranchFilter" style="margin-right: 8px; color: var(--sap-primary);"></span>
                            </div>
                        </div>

                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.25rem; margin-bottom: 1.75rem;">
                            <div class="report-stat-box report-stat-primary">
                                <div style="color: var(--sap-text-secondary); font-size: 0.88rem; font-weight: 600;">إجمالي المبيعات</div>
                                <div id="customTotalSales" style="color: var(--sap-primary); font-size: 2rem; font-weight: 800; margin-top: 4px;">0.00 ريال</div>
                            </div>
                            <div class="report-stat-box report-stat-success">
                                <div style="color: var(--sap-text-secondary); font-size: 0.88rem; font-weight: 600;">عدد العمليات</div>
                                <div id="customTxCount" style="color: var(--sap-text-primary); font-size: 2rem; font-weight: 800; margin-top: 4px;">0</div>
                            </div>
                            <div class="report-stat-box" style="border-right: 4px solid var(--sap-purple); background: linear-gradient(135deg, rgba(139, 92, 246, 0.08) 0%, rgba(139, 92, 246, 0.02) 100%);">
                                <div style="color: var(--sap-text-secondary); font-size: 0.88rem; font-weight: 600;">المتوسط اليومي</div>
                                <div id="customDailyAvg" style="color: var(--sap-purple); font-size: 2rem; font-weight: 800; margin-top: 4px;">0.00 ريال</div>
                            </div>
                        </div>

                        <div id="customBranchesSection" style="margin-bottom: 25px;">
                            <h3 style="font-size: 1.1rem; margin-bottom: 12px; color: var(--sap-text-primary);">📊 ملخص أداء الفروع في الفترة</h3>
                            <div style="overflow-x: auto;">
                                <table class="sap-table">
                                    <thead>
                                        <tr>
                                            <th>الفرع</th>
                                            <th>عدد العمليات</th>
                                            <th>متوسط العملية</th>
                                            <th>إجمالي المبيعات</th>
                                            <th>نسبة المساهمة</th>
                                        </tr>
                                    </thead>
                                    <tbody id="customBranchesBody"></tbody>
                                </table>
                            </div>
                        </div>

                        <div id="customTransactionsSection">
                            <h3 style="font-size: 1.1rem; margin-bottom: 12px; color: var(--sap-text-primary);">📋 سجل العمليات التفصيلية في الفترة</h3>
                            <div style="overflow-x: auto; max-height: 400px;">
                                <table class="sap-table">
                                    <thead>
                                        <tr>
                                            <th>#</th>
                                            <th>التاريخ</th>
                                            <th>الفرع</th>
                                            <th>البيان / الوصف</th>
                                            <th style="text-align: left;">المبلغ (ريال)</th>
                                        </tr>
                                    </thead>
                                    <tbody id="customTransactionsBody"></tbody>
                                </table>
                            </div>
                        </div>

                        <div style="margin-top: 25px; padding-top: 15px; border-top: 1px solid #eee; text-align: center; color: #999; font-size: 0.8rem;">
                            تم استخراج هذا التقرير بتاريخ <span id="customPrintDate"></span>
                        </div>
                    </div>
                </div>

                <div id="customEmptyState" style="padding: 50px 20px; text-align: center;">
                    <div style="font-size: 3.5rem; margin-bottom: 1rem;">📅</div>
                    <h3 style="margin-bottom: 8px;">اختر الفترة الزمنية للتقرير</h3>
                    <p style="color: var(--sap-text-secondary); margin-bottom: 20px;">يمكنك اختيار أحد الأزرار السريعة بالأعلى أو تحديد نطاق التواريخ يدوياً</p>
                    <button class="btn-sap btn-emphasized" onclick="setCustomDatePreset('month')">عرض مبيعات هذا الشهر</button>
                </div>
            </div>
        </div>
    `,
    branches: `
        <div class="sap-card" style="margin: 0;">
            <div class="sap-card-header" style="flex-wrap: wrap; gap: 10px;">
                <h3 class="sap-card-title">🏢 أداء الفروع ومقارنة المبيعات</h3>
                <div style="display: flex; gap: 8px;">
                    <button class="btn-sap btn-emphasized" onclick="generateBranchesReport()">🔄 تحديث البيانات</button>
                    <button class="btn-sap btn-standard" onclick="exportBranchesReportToExcel()" style="color: #107E3E; border-color: #107E3E;">📊 Excel</button>
                </div>
            </div>
            <div class="sap-card-content">
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 15px; margin-bottom: 20px;">
                    <div style="background: white; padding: 20px; border-radius: 6px; border: 1px solid #eee; border-right: 4px solid var(--sap-primary, #0A6ED1);">
                        <div style="color: #666; font-size: 0.9rem; font-weight: 600;">🏆 الفرع الأفضل أداءً</div>
                        <div id="topBranchName" style="font-size: 1.8rem; font-weight: bold; color: var(--sap-primary, #0A6ED1); margin-top: 5px;">-</div>
                        <div id="topBranchValue" style="font-size: 1.1rem; color: var(--sap-success, #107E3E); margin-top: 4px;">-</div>
                    </div>
                    <div style="background: white; padding: 20px; border-radius: 6px; border: 1px solid #eee; border-right: 4px solid var(--sap-success, #107E3E);">
                        <div style="color: #666; font-size: 0.9rem; font-weight: 600;">🏢 إجمالي الفروع النشطة</div>
                        <div id="totalBranchesCount" style="font-size: 1.8rem; font-weight: bold; color: #333; margin-top: 5px;">0</div>
                        <div style="font-size: 0.85rem; color: #888; margin-top: 4px;">فرع مسجل بالنظام</div>
                    </div>
                </div>

                <!-- Comparison Chart -->
                <div style="background: white; padding: 20px; border-radius: 6px; border: 1px solid #eee; margin-bottom: 20px;">
                    <h3 style="margin: 0 0 15px 0; font-size: 1.1rem; color: var(--sap-text-primary);">📊 الرسم البياني لمقارنة المبيعات بين الفروع</h3>
                    <div style="height: 320px; position: relative;">
                        <canvas id="branchesComparisonChart"></canvas>
                    </div>
                </div>

                <!-- Detailed List -->
                <div style="background: white; border-radius: 6px; border: 1px solid #eee; overflow: hidden;">
                    <div style="padding: 15px; border-bottom: 1px solid #eee;">
                        <h3 style="margin: 0; font-size: 1.1rem;">جدول ترتيب الفروع حسب إجمالي المبيعات</h3>
                    </div>
                    <div style="overflow-x: auto;">
                        <table class="sap-table">
                            <thead>
                                <tr>
                                    <th style="width: 60px;">الترتيب</th>
                                    <th>الفرع</th>
                                    <th>عدد العمليات</th>
                                    <th>متوسط العملية</th>
                                    <th>الإجمالي (ريال)</th>
                                    <th style="width: 180px;">النسبة من الإجمالي</th>
                                </tr>
                            </thead>
                            <tbody id="branchesPerformanceBody"></tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    `,
    matrix: `
        <div class="sap-card" style="margin: 0;">
            <div class="sap-card-header" style="flex-wrap: wrap; gap: 10px;">
                <h3 class="sap-card-title">📊 مصفوفة المبيعات الشهرية</h3>
                <div style="display: flex; gap: 10px; flex-wrap: wrap; align-items: flex-end;">
                    <div>
                        <label class="sap-label">الفرع</label>
                        <select id="matrixBranch" class="sap-input" style="width: 160px;">
                            <option value="">كل الفروع</option>
                        </select>
                    </div>
                    <div>
                        <label class="sap-label">من شهر</label>
                        <input type="month" id="matrixFromMonth" class="sap-input" style="width: 150px;">
                    </div>
                    <div>
                        <label class="sap-label">إلى شهر</label>
                        <input type="month" id="matrixToMonth" class="sap-input" style="width: 150px;">
                    </div>
                    <button class="btn-sap btn-emphasized" onclick="generateMatrixReport()">🔄 عرض</button>
                    <button class="btn-sap btn-standard" onclick="printMatrixReport(false)">🖨️ طباعة</button>
                    <button class="btn-sap btn-standard" onclick="exportMatrixToExcel()" style="color: #107E3E; border-color: #107E3E;">📊 Excel</button>
                </div>
            </div>
            <div class="sap-card-content" style="padding: 0;">
                <div id="matrixReportContent" style="padding: 1rem;">
                    <!-- Injected by matrix-report.js -->
                </div>
            </div>
        </div>
    `,
    yearly: `
        <div class="sap-card" style="margin: 0;">
            <div class="sap-card-header" style="flex-wrap: wrap; gap: 10px;">
                <h3 class="sap-card-title">🗓️ المقارنة السنوية للمبيعات</h3>
                <div style="display: flex; gap: 10px; align-items: center;">
                    <label class="sap-label">السنة:</label>
                    <select id="yearlyYear" class="sap-input" style="width: auto;"></select>
                    <button class="btn-sap btn-emphasized" onclick="generateYearlyReport()">🔄 عرض</button>
                    <button class="btn-sap btn-standard" onclick="exportYearlyReportToExcel()" style="color: #107E3E; border-color: #107E3E;">📊 Excel</button>
                </div>
            </div>
            <div class="sap-card-content">
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 15px; margin-bottom: 20px;">
                    <div style="background: white; padding: 20px; border-radius: 6px; border: 1px solid #eee; text-align: center;">
                        <h4 style="margin: 0 0 8px 0; color: #666; font-size: 0.95rem;">معدل نمو المبيعات</h4>
                        <div id="yearlyGrowth" style="font-size: 2.2rem; font-weight: bold;">0%</div>
                        <div style="color: #888; font-size: 0.85rem; margin-top: 4px;">مقارنة بالسنة السابقة</div>
                    </div>
                </div>

                <div style="background: white; padding: 20px; border-radius: 6px; border: 1px solid #eee; margin-bottom: 20px;">
                    <h3 style="margin: 0 0 15px 0; font-size: 1.1rem;">📈 مقارنة مبيعات الشهور (السنة الحالية vs السنة السابقة)</h3>
                    <div style="height: 350px; position: relative;">
                        <canvas id="yearlyComparisonChart"></canvas>
                    </div>
                </div>

                <div style="background: white; border-radius: 6px; border: 1px solid #eee; overflow: hidden;">
                    <div style="padding: 15px; border-bottom: 1px solid #eee;">
                        <h4 style="margin: 0;">جدول مبيعات شهور السنة</h4>
                    </div>
                    <div style="overflow-x: auto;">
                        <table class="sap-table" id="yearlyTable">
                            <thead>
                                <tr>
                                    <th>الشهر</th>
                                    <th>مبيعات السنة الحالية</th>
                                    <th>مبيعات السنة السابقة</th>
                                    <th>الفرق</th>
                                    <th>نسبة التغير</th>
                                </tr>
                            </thead>
                            <tbody id="yearlyTableBody"></tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    `,
    peak: `
        <div class="sap-card" style="margin: 0;">
            <div class="sap-card-header" style="flex-wrap: wrap; gap: 10px;">
                <h3 class="sap-card-title">⏱️ تحليل أوقات وأيام الذروة</h3>
                <div style="display: flex; gap: 8px;">
                    <button class="btn-sap btn-emphasized" onclick="generatePeakReport()">🔄 تحديث البيانات</button>
                    <button class="btn-sap btn-standard" onclick="exportPeakReportToExcel()" style="color: #107E3E; border-color: #107E3E;">📊 Excel</button>
                </div>
            </div>
            <div class="sap-card-content">
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 15px; margin-bottom: 20px;">
                    <div style="background: white; padding: 20px; border-radius: 6px; border: 1px solid #eee; border-right: 4px solid var(--sap-success, #107E3E); text-align: center;">
                        <h4 style="margin: 0 0 8px 0; color: #666; font-size: 0.95rem;">🏆 أفضل يوم للمبيعات</h4>
                        <div id="bestDayName" style="font-size: 2rem; font-weight: bold; color: var(--sap-primary, #0A6ED1);">-</div>
                        <div id="bestDayAmount" style="color: #888; font-size: 0.85rem; margin-top: 4px;">-</div>
                    </div>
                </div>

                <div style="background: white; padding: 20px; border-radius: 6px; border: 1px solid #eee; margin-bottom: 20px;">
                    <h3 style="margin: 0 0 15px 0; font-size: 1.1rem;">📊 توزيع المبيعات الإجمالية حسب أيام الأسبوع</h3>
                    <div style="height: 320px; position: relative;">
                        <canvas id="peakDaysChart"></canvas>
                    </div>
                </div>

                <div style="background: white; border-radius: 6px; border: 1px solid #eee; overflow: hidden;">
                    <div style="overflow-x: auto;">
                        <table class="sap-table">
                            <thead>
                                <tr>
                                    <th>اليوم</th>
                                    <th>إجمالي المبيعات</th>
                                    <th>عدد العمليات</th>
                                    <th>متوسط المبيعات اليومية</th>
                                    <th>النسبة من الإجمالي</th>
                                </tr>
                            </thead>
                            <tbody id="peakDaysTableBody"></tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    `,
    branchTrends: `
        <div class="sap-card" style="margin: 0;">
            <div class="sap-card-header" style="flex-wrap: wrap; gap: 10px;">
                <h3 class="sap-card-title">📈 اتجاهات وتطور أداء الفروع عبر الشهور</h3>
                <div style="display: flex; gap: 8px;">
                    <button class="btn-sap btn-emphasized" onclick="generateBranchTrendsReport()">🔄 تحديث البيانات</button>
                    <button class="btn-sap btn-standard" onclick="exportBranchTrendsToExcel()" style="color: #107E3E; border-color: #107E3E;">📊 Excel</button>
                </div>
            </div>
            <div class="sap-card-content">
                <div style="background: white; padding: 20px; border-radius: 6px; border: 1px solid #eee;">
                    <h3 style="margin: 0 0 15px 0; font-size: 1.1rem;">تطور مبيعات كل فرع خلال آخر 12 شهراً</h3>
                    <div style="height: 420px; position: relative;">
                        <canvas id="branchTrendsChart"></canvas>
                    </div>
                </div>
            </div>
        </div>
    `,
    products: `
        <div class="sap-card" style="margin: 0;">
            <div class="sap-card-header" style="flex-wrap: wrap; gap: 10px;">
                <h3 class="sap-card-title">📦 تحليلات أداء المنتجات والقوائم</h3>
                <div style="display: flex; gap: 8px;">
                    <button class="btn-sap btn-emphasized" onclick="generateProductsReport()">🔄 تحديث البيانات</button>
                    <button class="btn-sap btn-standard" onclick="exportProductsReportToExcel()" style="color: #107E3E; border-color: #107E3E;">📊 Excel</button>
                </div>
            </div>
            <div class="sap-card-content">
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 15px; margin-bottom: 20px;">
                    <div style="background: white; padding: 20px; border-radius: 6px; border: 1px solid #eee; border-right: 4px solid var(--sap-primary, #0A6ED1);">
                        <h4 style="margin: 0 0 8px 0; color: #666; font-size: 0.95rem;">🔝 المنتج الأكثر طلباً</h4>
                        <div id="topProductName" style="font-size: 1.8rem; font-weight: bold; color: var(--sap-primary, #0A6ED1); margin-bottom: 5px;">-</div>
                        <div id="topProductValue" style="font-size: 1.1rem; color: var(--sap-success, #107E3E);">-</div>
                    </div>
                </div>

                <div style="background: white; border-radius: 6px; border: 1px solid #eee; overflow: hidden;">
                    <div style="padding: 15px; border-bottom: 1px solid #eee;">
                        <h4 style="margin: 0;">تفاصيل المنتجات الأكثر طلباً في القوائم</h4>
                    </div>
                    <div style="overflow-x: auto;">
                        <table class="sap-table">
                            <thead>
                                <tr>
                                    <th>المنتج</th>
                                    <th>الكود</th>
                                    <th>عدد القوائم</th>
                                    <th>إجمالي الكمية</th>
                                    <th>توزيع الفئات</th>
                                </tr>
                            </thead>
                            <tbody id="productsPerformanceBody"></tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    `,
    ai: `
        <div class="sap-card" style="margin: 0;">
            <div class="sap-card-header" style="flex-wrap: wrap; gap: 10px;">
                <h3 class="sap-card-title">🤖 التحليل الذكي والتنبؤات بالمبيعات</h3>
                <div style="display: flex; gap: 8px;">
                    <button class="btn-sap btn-standard" onclick="if (typeof printAIReport === 'function') printAIReport(); else window.print();">🖨️ طباعة</button>
                    <button class="btn-sap btn-emphasized" onclick="initAIAnalytics()">🚀 تحديث التحليل الذكي</button>
                </div>
            </div>
            <div class="sap-card-content">
                <div id="aiReportContent">
                    <div style="padding: 50px 20px; text-align: center;">
                        <div style="font-size: 4rem; margin-bottom: 1rem;">🤖</div>
                        <h3 style="margin-bottom: 8px;">لوحة الذكاء الاصطناعي والتنبؤ بالمبيعات</h3>
                        <p style="color: var(--sap-text-secondary); max-width: 500px; margin: 0 auto 20px auto;">
                            يقوم النظام باستخدام خوارزميات الانحدار الخطي والتنعيم الأسي واكتشاف الشذوذ لتقديم رؤى ذكية وتوقعات دقيقة للمبيعات القادمة.
                        </p>
                        <button class="btn-sap btn-emphasized" onclick="initAIAnalytics()" style="padding: 10px 24px; font-size: 1rem;">
                            🚀 ابدأ التحليل والتنبؤ الآن
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `
};

/**
 * Initialize Analytics Page
 */
async function initAnalytics() {
    console.log('Initializing Executive Analytics BI Dashboard');

    // 1. Update Top KPIs
    await updateAnalyticsKPIs();

    // 2. Load Branches dropdown in custom report if present
    loadBranchesForAnalytics();

    // 3. Check URL params for report type or default to 'daily'
    const urlParams = new URLSearchParams(window.location.search);
    const reportType = urlParams.get('type') || 'daily';

    switchReport(reportType);
}

/**
 * Load Branches into custom dropdown
 */
async function loadBranchesForAnalytics() {
    const branchSelect = document.getElementById('customBranch');
    if (!branchSelect) return;

    try {
        if (typeof getBranches === 'function') {
            const branches = await getBranches();
            const seen = new Set();
            const getCanon = typeof window.canonicalizeBranchName === 'function' ? window.canonicalizeBranchName : (s) => String(s).trim().toLowerCase();
            branchSelect.innerHTML = '<option value="">كل الفروع</option>';
            branches.forEach(b => {
                if (!b) return;
                const rawName = typeof b === 'string' ? b : (b.name || b.branch || b.branchName || '');
                const name = String(rawName).replace(/[\u200B-\u200F\u202A-\u202E\uFEFF\u00AD\u00A0]/g, ' ').replace(/\s+/g, ' ').trim();
                const canonKey = getCanon(name);
                if (!canonKey || seen.has(canonKey)) return;
                seen.add(canonKey);
                const opt = document.createElement('option');
                opt.value = name;
                opt.textContent = name;
                branchSelect.appendChild(opt);
            });
        }
    } catch (e) {
        console.error('Error loading branches for analytics:', e);
    }
}

/**
 * Switch Active Report Type
 */
async function switchReport(type) {
    // Update Sidebar Navigation UI Active State
    document.querySelectorAll('.report-nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    const activeBtn = document.getElementById(`btn-${type}`);
    if (activeBtn) activeBtn.classList.add('active');

    // Load Content Template into Display Area
    const displayArea = document.getElementById('reportDisplayArea');
    if (!displayArea) return;

    displayArea.innerHTML = REPORT_TEMPLATES[type] || REPORT_TEMPLATES.daily;

    // Load branch list in custom report if needed
    if (type === 'custom') {
        loadBranchesForAnalytics();
    }

    // Initialize specific report logic
    if (type === 'daily') {
        await loadScript('js/pages/daily-report.js');
        if (typeof initDailyReport === 'function') {
            initDailyReport();
        }
    } else if (type === 'monthly') {
        await loadScript(`js/pages/monthly-report.js?v=${Date.now()}`);
        const today = new Date();
        const currentMonth = today.toISOString().slice(0, 7); // YYYY-MM

        const fromDateInput = document.getElementById('mbrFromDate');
        const toDateInput = document.getElementById('mbrToDate');

        if (fromDateInput && toDateInput) {
            fromDateInput.value = `${today.getFullYear()}-01`;
            toDateInput.value = currentMonth;
        }

        // Load branches for dropdown
        const branchSelect = document.getElementById('mbrBranch');
        if (branchSelect && typeof getBranches === 'function') {
            const branches = await getBranches();
            branchSelect.innerHTML = '<option value="">كل الفروع</option>';
            branches.forEach(b => {
                const option = document.createElement('option');
                option.value = b.name;
                option.textContent = b.name;
                branchSelect.appendChild(option);
            });
        }

        if (typeof generateMonthlyBranchReport === 'function') {
            generateMonthlyBranchReport();
        }
    } else if (type === 'custom') {
        setCustomDatePreset('month');
    } else if (type === 'branches') {
        generateBranchesReport();
    } else if (type === 'matrix') {
        await loadScript('js/pages/matrix-report.js');
        if (typeof initMatrixReport === 'function') {
            initMatrixReport();
        }
    } else if (type === 'products') {
        generateProductsReport();
    } else if (type === 'yearly') {
        const yearSelect = document.getElementById('yearlyYear');
        if (yearSelect) {
            const currentYear = new Date().getFullYear();
            yearSelect.innerHTML = '';
            for (let i = 0; i < 5; i++) {
                const yr = currentYear - i;
                const option = document.createElement('option');
                option.value = yr;
                option.textContent = yr;
                yearSelect.appendChild(option);
            }
        }
        generateYearlyReport();
    } else if (type === 'peak') {
        generatePeakReport();
    } else if (type === 'branchTrends') {
        generateBranchTrendsReport();
    } else if (type === 'ai') {
        await loadScript('js/pages/ai-analytics.js');
        if (typeof initAIAnalytics === 'function') {
            initAIAnalytics();
        }
    }
}

/**
 * Set Custom Date Preset Filters
 */
function setCustomDatePreset(preset) {
    const fromInput = document.getElementById('customFromDate');
    const toInput = document.getElementById('customToDate');
    if (!fromInput || !toInput) return;

    const today = new Date();
    let fromDate = new Date();
    let toDate = new Date();

    if (preset === 'today') {
        // Same day
    } else if (preset === 'yesterday') {
        fromDate.setDate(today.getDate() - 1);
        toDate.setDate(today.getDate() - 1);
    } else if (preset === 'week') {
        const day = today.getDay();
        fromDate.setDate(today.getDate() - day);
    } else if (preset === 'month') {
        fromDate = new Date(today.getFullYear(), today.getMonth(), 1);
    } else if (preset === 'lastMonth') {
        fromDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        toDate = new Date(today.getFullYear(), today.getMonth(), 0);
    } else if (preset === 'year') {
        fromDate = new Date(today.getFullYear(), 0, 1);
    }

    fromInput.value = fromDate.toISOString().split('T')[0];
    toInput.value = toDate.toISOString().split('T')[0];

    // Highlight active preset button
    document.querySelectorAll('.quick-preset-btn').forEach(b => b.classList.remove('active'));
    const activePresetBtn = document.getElementById(`preset-${preset}`);
    if (activePresetBtn) activePresetBtn.classList.add('active');

    // Trigger report generation
    generateCustomReport();
}

/**
 * Helper to dynamically load scripts
 */
function loadScript(src) {
    return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) {
            resolve();
            return;
        }

        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.body.appendChild(script);
    });
}

// --- Custom Report Functions ---

async function generateCustomReport() {
    const fromDate = document.getElementById('customFromDate')?.value;
    const toDate = document.getElementById('customToDate')?.value;
    const branchFilter = document.getElementById('customBranch')?.value || '';

    if (!fromDate || !toDate) {
        showToast('warning', 'تنبيه', 'يرجى تحديد الفترة الزمنية');
        return;
    }

    if (fromDate > toDate) {
        showToast('error', 'خطأ', 'تاريخ البداية يجب أن يكون قبل تاريخ النهاية');
        return;
    }

    showLoading('جاري إعداد التقرير...');

    try {
        const sales = await getSales();

        // Filter sales by date and branch
        const filteredSales = sales.filter(s => {
            const inDate = s.date >= fromDate && s.date <= toDate;
            const inBranch = !branchFilter || s.branch === branchFilter;
            return inDate && inBranch;
        });

        // Calculate Stats
        const totalSales = filteredSales.reduce((sum, s) => sum + Number(s.amount || 0), 0);
        const txCount = filteredSales.length;

        // Days count
        const start = new Date(fromDate);
        const end = new Date(toDate);
        const daysDiff = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1);
        const dailyAvg = totalSales / daysDiff;

        // Update UI
        document.getElementById('customTotalSales').textContent = (typeof formatMoney === 'function' ? formatMoney(totalSales) : totalSales.toFixed(2)) + ' ريال';
        document.getElementById('customTxCount').textContent = txCount.toLocaleString('ar-SA');
        document.getElementById('customDailyAvg').textContent = (typeof formatMoney === 'function' ? formatMoney(dailyAvg) : dailyAvg.toFixed(2)) + ' ريال';

        document.getElementById('displayFromDate').textContent = fromDate;
        document.getElementById('displayToDate').textContent = toDate;
        const branchDisplay = document.getElementById('displayBranchFilter');
        if (branchDisplay) {
            branchDisplay.textContent = branchFilter ? `(الفرع: ${branchFilter})` : '(كل الفروع)';
        }
        document.getElementById('customPrintDate').textContent = new Date().toLocaleString('ar-SA');

        // Branches Breakdown Table
        const branchesBody = document.getElementById('customBranchesBody');
        branchesBody.innerHTML = '';

        const branchGroups = {};
        filteredSales.forEach(s => {
            if (!branchGroups[s.branch]) branchGroups[s.branch] = { count: 0, total: 0 };
            branchGroups[s.branch].count++;
            branchGroups[s.branch].total += Number(s.amount || 0);
        });

        const sortedBranches = Object.entries(branchGroups).sort((a, b) => b[1].total - a[1].total);

        if (sortedBranches.length === 0) {
            branchesBody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#999; padding:15px;">لا توجد مبيعات في الفترة المحددة</td></tr>';
        } else {
            sortedBranches.forEach(([branch, data]) => {
                const avg = data.count > 0 ? data.total / data.count : 0;
                const pct = totalSales > 0 ? ((data.total / totalSales) * 100).toFixed(1) : 0;
                const row = `
                    <tr>
                        <td><strong>${branch}</strong></td>
                        <td>${data.count}</td>
                        <td>${(typeof formatMoney === 'function' ? formatMoney(avg) : avg.toFixed(2))} ريال</td>
                        <td style="font-weight: bold; color: var(--sap-primary, #0A6ED1);">${(typeof formatMoney === 'function' ? formatMoney(data.total) : data.total.toFixed(2))} ريال</td>
                        <td><span class="report-badge-pill" style="background:#EBF5FE; color:#0A6ED1;">${pct}%</span></td>
                    </tr>
                `;
                branchesBody.innerHTML += row;
            });
        }

        // Transactions Details Table
        const txBody = document.getElementById('customTransactionsBody');
        if (txBody) {
            if (filteredSales.length === 0) {
                txBody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#999; padding:15px;">لا توجد عمليات</td></tr>';
            } else {
                txBody.innerHTML = filteredSales.map((s, idx) => `
                    <tr>
                        <td>${idx + 1}</td>
                        <td>${s.date}</td>
                        <td><strong>${s.branch}</strong></td>
                        <td>${s.description || '-'}</td>
                        <td style="font-weight: bold; color: var(--sap-primary, #0A6ED1);">${parseFloat(s.amount || 0).toFixed(2)} ريال</td>
                    </tr>
                `).join('');
            }
        }

        // Show Content
        document.getElementById('customEmptyState').style.display = 'none';
        document.getElementById('customReportContent').style.display = 'block';

    } catch (error) {
        console.error(error);
        showToast('error', 'خطأ', 'حدث خطأ أثناء إنشاء التقرير');
    } finally {
        hideLoading();
    }
}

function printCustomReport() {
    const content = document.getElementById('customReportContent').innerHTML;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html dir="rtl" lang="ar">
        <head>
            <title>تقرير مخصص</title>
            <style>
                body { font-family: 'Arial', sans-serif; padding: 25px; direction: rtl; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 13px; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: right; }
                th { background-color: #f2f2f2; }
                .report-badge-pill { font-weight: bold; }
            </style>
        </head>
        <body>
            ${content}
            <script>window.print();</script>
        </body>
        </html>
    `);
    printWindow.document.close();
}

async function exportDailyReportToExcel() {
    try {
        const dateInput = document.getElementById('reportDate');
        const selectedDate = dateInput ? dateInput.value : new Date().toISOString().split('T')[0];
        const sales = await getSales();
        const daySales = sales.filter(s => s.date === selectedDate);

        if (daySales.length === 0) {
            showToast('warning', 'تنبيه', 'لا توجد بيانات لتصديرها لهذا اليوم');
            return;
        }

        const excelData = daySales.map((s, idx) => ({
            '#': idx + 1,
            'التاريخ': s.date,
            'الفرع': s.branch,
            'المبلغ (ريال)': Number(s.amount || 0),
            'الوصف / البيان': s.description || '',
            'الملاحظات': s.notes || ''
        }));

        const total = daySales.reduce((sum, s) => sum + Number(s.amount || 0), 0);
        excelData.push({
            '#': 'الإجمالي',
            'التاريخ': selectedDate,
            'الفرع': `عدد العمليات: ${daySales.length}`,
            'المبلغ (ريال)': total,
            'الوصف / البيان': '',
            'الملاحظات': ''
        });

        downloadExcel(excelData, `تقرير_المبيعات_اليومي_${selectedDate}`, 'المبيعات اليومية');
    } catch (e) {
        console.error('Error exporting daily report:', e);
        showToast('error', 'خطأ', 'فشل تصدير التقرير إلى Excel');
    }
}

async function exportCustomReportToExcel() {
    try {
        const fromDate = document.getElementById('customFromDate')?.value;
        const toDate = document.getElementById('customToDate')?.value;
        const branchFilter = document.getElementById('customBranch')?.value || '';

        const sales = await getSales();
        const filteredSales = sales.filter(s => {
            const inDate = s.date >= fromDate && s.date <= toDate;
            const inBranch = !branchFilter || s.branch === branchFilter;
            return inDate && inBranch;
        });

        if (filteredSales.length === 0) {
            showToast('warning', 'تنبيه', 'لا توجد بيانات لتصديرها');
            return;
        }

        const data = filteredSales.map((s, idx) => ({
            '#': idx + 1,
            'التاريخ': s.date,
            'الفرع': s.branch,
            'المبلغ (ريال)': Number(s.amount || 0),
            'الوصف': s.description || '',
            'الملاحظات': s.notes || ''
        }));

        const total = filteredSales.reduce((sum, s) => sum + Number(s.amount || 0), 0);
        data.push({
            '#': 'الإجمالي',
            'التاريخ': `${fromDate} إلى ${toDate}`,
            'الفرع': `عدد العمليات: ${filteredSales.length}`,
            'المبلغ (ريال)': total,
            'الوصف': '',
            'الملاحظات': ''
        });

        downloadExcel(data, `تقرير_مبيعات_مخصص_${fromDate}_${toDate}`, 'المبيعات');
    } catch (e) {
        console.error(e);
        showToast('error', 'خطأ', 'فشل تصدير التقرير إلى Excel');
    }
}

// --- Branch Performance Functions ---

async function generateBranchesReport() {
    showLoading('جاري تحليل أداء الفروع...');

    try {
        const sales = await getSales();
        const branches = await getBranches();

        const branchStats = {};
        branches.forEach(b => {
            branchStats[b.name] = { name: b.name, count: 0, total: 0 };
        });

        sales.forEach(s => {
            if (!branchStats[s.branch]) branchStats[s.branch] = { name: s.branch, count: 0, total: 0 };
            branchStats[s.branch].count++;
            branchStats[s.branch].total += Number(s.amount || 0);
        });

        const sortedBranches = Object.values(branchStats).sort((a, b) => b.total - a.total);
        const overallTotal = sortedBranches.reduce((sum, b) => sum + b.total, 0);

        // Top Branch & Total branches
        if (sortedBranches.length > 0) {
            document.getElementById('topBranchName').textContent = sortedBranches[0].name;
            document.getElementById('topBranchValue').textContent = (typeof formatMoney === 'function' ? formatMoney(sortedBranches[0].total) : sortedBranches[0].total.toFixed(2)) + ' ريال';
        }
        const totalBranchesEl = document.getElementById('totalBranchesCount');
        if (totalBranchesEl) totalBranchesEl.textContent = branches.length;

        // Table
        const tbody = document.getElementById('branchesPerformanceBody');
        tbody.innerHTML = '';

        sortedBranches.forEach((b, index) => {
            const avg = b.count > 0 ? b.total / b.count : 0;
            const percentage = overallTotal > 0 ? ((b.total / overallTotal) * 100).toFixed(1) : 0;

            const row = `
                <tr>
                    <td><strong>#${index + 1}</strong></td>
                    <td><strong>${b.name}</strong></td>
                    <td>${b.count}</td>
                    <td>${(typeof formatMoney === 'function' ? formatMoney(avg) : avg.toFixed(2))} ريال</td>
                    <td><strong style="color: var(--sap-primary, #0A6ED1);">${(typeof formatMoney === 'function' ? formatMoney(b.total) : b.total.toFixed(2))} ريال</strong></td>
                    <td style="width: 180px;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <div style="flex: 1; height: 8px; background: #eee; border-radius: 4px; overflow: hidden;">
                                <div style="height: 100%; width: ${percentage}%; background: var(--sap-primary, #0A6ED1); border-radius: 4px;"></div>
                            </div>
                            <span style="font-size: 0.8rem; font-weight: bold; width: 45px;">${percentage}%</span>
                        </div>
                    </td>
                </tr>
            `;
            tbody.innerHTML += row;
        });

        // Chart
        renderBranchesChart(sortedBranches);

    } catch (error) {
        console.error(error);
        showToast('error', 'خطأ', 'حدث خطأ أثناء تحليل بيانات الفروع');
    } finally {
        hideLoading();
    }
}

function renderBranchesChart(data) {
    const ctx = document.getElementById('branchesComparisonChart');
    if (!ctx || typeof Chart === 'undefined') return;

    const existingChart = Chart.getChart(ctx);
    if (existingChart) existingChart.destroy();

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.map(d => d.name),
            datasets: [{
                label: 'إجمالي المبيعات (ريال)',
                data: data.map(d => d.total),
                backgroundColor: 'rgba(10, 110, 209, 0.75)',
                hoverBackgroundColor: '#0A6ED1',
                borderRadius: 6,
                borderWidth: 1,
                borderColor: '#0A6ED1'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    rtl: true,
                    callbacks: {
                        label: (ctx) => ` المبيعات: ${Number(ctx.raw).toLocaleString('ar-SA')} ريال`
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: (val) => `${val.toLocaleString('ar-SA')} ر.س`
                    }
                }
            }
        }
    });
}

async function exportBranchesReportToExcel() {
    try {
        const sales = await getSales();
        const branches = await getBranches();
        const branchStats = {};
        branches.forEach(b => {
            branchStats[b.name] = { name: b.name, count: 0, total: 0 };
        });
        sales.forEach(s => {
            if (!branchStats[s.branch]) branchStats[s.branch] = { name: s.branch, count: 0, total: 0 };
            branchStats[s.branch].count++;
            branchStats[s.branch].total += Number(s.amount || 0);
        });

        const sorted = Object.values(branchStats).sort((a, b) => b.total - a.total);
        const overall = sorted.reduce((sum, b) => sum + b.total, 0);

        const data = sorted.map((b, idx) => ({
            'الترتيب': idx + 1,
            'اسم الفرع': b.name,
            'عدد العمليات': b.count,
            'متوسط العملية (ريال)': b.count > 0 ? (b.total / b.count).toFixed(2) : 0,
            'إجمالي المبيعات (ريال)': b.total,
            'نسبة المساهمة': overall > 0 ? `${((b.total / overall) * 100).toFixed(1)}%` : '0%'
        }));

        downloadExcel(data, 'تقرير_أداء_الفروع', 'الفروع');
    } catch (e) {
        console.error(e);
        showToast('error', 'خطأ', 'فشل تصدير تقرير الفروع');
    }
}

// --- Yearly Comparison Functions ---

async function generateYearlyReport() {
    const selectedYear = parseInt(document.getElementById('yearlyYear')?.value || new Date().getFullYear());
    showLoading('جاري تحليل البيانات السنوية...');

    try {
        const sales = await getSales();

        const currentYearSales = new Array(12).fill(0);
        const prevYearSales = new Array(12).fill(0);

        sales.forEach(s => {
            const date = new Date(s.date);
            const year = date.getFullYear();
            const month = date.getMonth();

            if (year === selectedYear) {
                currentYearSales[month] += Number(s.amount || 0);
            } else if (year === selectedYear - 1) {
                prevYearSales[month] += Number(s.amount || 0);
            }
        });

        const currentTotal = currentYearSales.reduce((a, b) => a + b, 0);
        const prevTotal = prevYearSales.reduce((a, b) => a + b, 0);

        // Growth
        const growthEl = document.getElementById('yearlyGrowth');
        if (growthEl) {
            if (prevTotal > 0) {
                const growth = ((currentTotal - prevTotal) / prevTotal) * 100;
                growthEl.textContent = (growth > 0 ? '+' : '') + growth.toFixed(1) + '%';
                growthEl.style.color = growth >= 0 ? 'var(--sap-success, #107E3E)' : 'var(--sap-error, #BB0000)';
            } else {
                growthEl.textContent = currentTotal > 0 ? '+100%' : '0%';
                growthEl.style.color = 'var(--sap-primary, #0A6ED1)';
            }
        }

        // Table
        const monthsNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
        const tbody = document.getElementById('yearlyTableBody');
        if (tbody) {
            tbody.innerHTML = monthsNames.map((m, idx) => {
                const c = currentYearSales[idx];
                const p = prevYearSales[idx];
                const diff = c - p;
                const pct = p > 0 ? ((diff / p) * 100).toFixed(1) : (c > 0 ? '100+' : '0');
                const isPositive = diff >= 0;
                return `
                    <tr>
                        <td><strong>${m}</strong></td>
                        <td style="font-weight: bold; color: var(--sap-primary, #0A6ED1);">${c.toFixed(2)} ريال</td>
                        <td>${p.toFixed(2)} ريال</td>
                        <td style="color: ${isPositive ? '#107E3E' : '#BB0000'}; direction: ltr; text-align: right;">${diff > 0 ? '+' : ''}${diff.toFixed(2)} ريال</td>
                        <td><span class="report-badge-pill" style="background:${isPositive ? '#E8F5E9' : '#FFEBEE'}; color:${isPositive ? '#107E3E' : '#BB0000'};">${pct}%</span></td>
                    </tr>
                `;
            }).join('');
        }

        // Chart
        renderYearlyChart(currentYearSales, prevYearSales, selectedYear);

    } catch (error) {
        console.error(error);
        showToast('error', 'خطأ', 'حدث خطأ أثناء تحليل البيانات السنوية');
    } finally {
        hideLoading();
    }
}

function renderYearlyChart(current, prev, year) {
    const ctx = document.getElementById('yearlyComparisonChart');
    if (!ctx || typeof Chart === 'undefined') return;

    const existingChart = Chart.getChart(ctx);
    if (existingChart) existingChart.destroy();

    const months = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: months,
            datasets: [
                {
                    label: `سنة ${year}`,
                    data: current,
                    borderColor: '#0A6ED1',
                    backgroundColor: 'rgba(10, 110, 209, 0.1)',
                    fill: true,
                    tension: 0.35,
                    borderWidth: 2.5
                },
                {
                    label: `سنة ${year - 1}`,
                    data: prev,
                    borderColor: '#999',
                    borderDash: [5, 5],
                    fill: false,
                    tension: 0.35,
                    borderWidth: 2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top' }
            },
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
}

async function exportYearlyReportToExcel() {
    try {
        const selectedYear = parseInt(document.getElementById('yearlyYear')?.value || new Date().getFullYear());
        const sales = await getSales();
        const currentYearSales = new Array(12).fill(0);
        const prevYearSales = new Array(12).fill(0);

        sales.forEach(s => {
            const date = new Date(s.date);
            const year = date.getFullYear();
            const month = date.getMonth();

            if (year === selectedYear) {
                currentYearSales[month] += Number(s.amount || 0);
            } else if (year === selectedYear - 1) {
                prevYearSales[month] += Number(s.amount || 0);
            }
        });

        const monthsNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
        const data = monthsNames.map((m, idx) => ({
            'الشهر': m,
            [`سنة ${selectedYear} (ريال)`]: currentYearSales[idx],
            [`سنة ${selectedYear - 1} (ريال)`]: prevYearSales[idx],
            'الفرق (ريال)': currentYearSales[idx] - prevYearSales[idx]
        }));

        downloadExcel(data, `المقارنة_السنوية_${selectedYear}`, 'المقارنة السنوية');
    } catch (e) {
        console.error(e);
        showToast('error', 'خطأ', 'فشل تصدير التقرير السنوي');
    }
}

// --- Peak Sales Functions ---

async function generatePeakReport() {
    showLoading('جاري تحليل أوقات الذروة...');

    try {
        const sales = await getSales();

        const dayStats = new Array(7).fill(0);
        const dayCounts = new Array(7).fill(0);
        const dayNames = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

        sales.forEach(s => {
            const date = new Date(s.date);
            const day = date.getDay();
            dayStats[day] += Number(s.amount || 0);
            dayCounts[day] += 1;
        });

        let maxVal = -1;
        let bestDayIdx = -1;
        dayStats.forEach((val, idx) => {
            if (val > maxVal) {
                maxVal = val;
                bestDayIdx = idx;
            }
        });

        const totalOverall = dayStats.reduce((sum, v) => sum + v, 0);

        const bestDayNameEl = document.getElementById('bestDayName');
        if (bestDayNameEl && bestDayIdx !== -1) {
            bestDayNameEl.textContent = dayNames[bestDayIdx];
        }
        const bestDayAmountEl = document.getElementById('bestDayAmount');
        if (bestDayAmountEl && bestDayIdx !== -1) {
            bestDayAmountEl.textContent = `بإجمالي ${dayStats[bestDayIdx].toFixed(2)} ريال (${dayCounts[bestDayIdx]} عملية)`;
        }

        // Render Table
        const tbody = document.getElementById('peakDaysTableBody');
        if (tbody) {
            tbody.innerHTML = dayNames.map((d, idx) => {
                const amt = dayStats[idx];
                const count = dayCounts[idx];
                const avg = count > 0 ? amt / count : 0;
                const pct = totalOverall > 0 ? ((amt / totalOverall) * 100).toFixed(1) : 0;
                const isBest = idx === bestDayIdx;
                return `
                    <tr ${isBest ? 'style="background: #F1F8E9; font-weight: bold;"' : ''}>
                        <td>${isBest ? '🏆 ' : ''}<strong>${d}</strong></td>
                        <td style="color: var(--sap-primary, #0A6ED1);">${amt.toFixed(2)} ريال</td>
                        <td>${count}</td>
                        <td>${avg.toFixed(2)} ريال</td>
                        <td><span class="report-badge-pill" style="background:#EBF5FE; color:#0A6ED1;">${pct}%</span></td>
                    </tr>
                `;
            }).join('');
        }

        // Chart
        renderPeakChart(dayStats, dayNames);

    } catch (error) {
        console.error(error);
        showToast('error', 'خطأ', 'حدث خطأ أثناء تحليل أوقات الذروة');
    } finally {
        hideLoading();
    }
}

function renderPeakChart(data, labels) {
    const ctx = document.getElementById('peakDaysChart');
    if (!ctx || typeof Chart === 'undefined') return;

    const existingChart = Chart.getChart(ctx);
    if (existingChart) existingChart.destroy();

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'إجمالي المبيعات (ريال)',
                data: data,
                backgroundColor: 'rgba(16, 126, 62, 0.75)',
                hoverBackgroundColor: '#107E3E',
                borderRadius: 6,
                borderColor: '#107E3E',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
}

async function exportPeakReportToExcel() {
    try {
        const sales = await getSales();
        const dayStats = new Array(7).fill(0);
        const dayCounts = new Array(7).fill(0);
        const dayNames = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

        sales.forEach(s => {
            const date = new Date(s.date);
            const day = date.getDay();
            dayStats[day] += Number(s.amount || 0);
            dayCounts[day] += 1;
        });

        const totalOverall = dayStats.reduce((sum, v) => sum + v, 0);

        const data = dayNames.map((d, idx) => ({
            'اليوم': d,
            'إجمالي المبيعات (ريال)': dayStats[idx],
            'عدد العمليات': dayCounts[idx],
            'متوسط العملية (ريال)': dayCounts[idx] > 0 ? (dayStats[idx] / dayCounts[idx]).toFixed(2) : 0,
            'النسبة من المبيعات': totalOverall > 0 ? `${((dayStats[idx] / totalOverall) * 100).toFixed(1)}%` : '0%'
        }));

        downloadExcel(data, 'تقرير_أيام_الذروة', 'أيام الذروة');
    } catch (e) {
        console.error(e);
        showToast('error', 'خطأ', 'فشل تصدير تقرير أيام الذروة');
    }
}

// --- Branch Trends Functions ---

async function generateBranchTrendsReport() {
    showLoading('جاري تحليل اتجاهات الفروع...');

    try {
        const sales = await getSales();
        const branches = await getBranches();

        const months = [];
        const today = new Date();
        for (let i = 11; i >= 0; i--) {
            const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
            months.push(d.toISOString().slice(0, 7));
        }

        const datasets = branches.map((branch, idx) => {
            const data = months.map(month => {
                return sales
                    .filter(s => s.branch === branch.name && s.date.startsWith(month))
                    .reduce((sum, s) => sum + Number(s.amount || 0), 0);
            });

            const colors = [
                '#0A6ED1', '#E74C3C', '#2ECC71', '#F1C40F', '#9B59B6',
                '#1ABC9C', '#E67E22', '#34495E', '#95A5A6', '#D35400'
            ];

            return {
                label: branch.name,
                data: data,
                borderColor: colors[idx % colors.length],
                backgroundColor: 'transparent',
                tension: 0.35,
                borderWidth: 2
            };
        });

        const ctx = document.getElementById('branchTrendsChart');
        if (ctx && typeof Chart !== 'undefined') {
            const existingChart = Chart.getChart(ctx);
            if (existingChart) existingChart.destroy();

            const monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
            const labels = months.map(m => {
                const [y, mm] = m.split('-');
                return monthNames[parseInt(mm) - 1] + ' ' + y;
            });

            new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: datasets
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'bottom' }
                    },
                    scales: {
                        y: { beginAtZero: true }
                    }
                }
            });
        }

    } catch (error) {
        console.error(error);
        showToast('error', 'خطأ', 'حدث خطأ أثناء تحليل اتجاهات الفروع');
    } finally {
        hideLoading();
    }
}

async function exportBranchTrendsToExcel() {
    try {
        const sales = await getSales();
        const branches = await getBranches();

        const months = [];
        const today = new Date();
        for (let i = 11; i >= 0; i--) {
            const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
            months.push(d.toISOString().slice(0, 7));
        }

        const data = months.map(month => {
            const row = { 'الشهر': month };
            branches.forEach(b => {
                row[b.name] = sales
                    .filter(s => s.branch === b.name && s.date.startsWith(month))
                    .reduce((sum, s) => sum + Number(s.amount || 0), 0);
            });
            return row;
        });

        downloadExcel(data, 'اتجاهات_أداء_الفروع', 'الاتجاهات');
    } catch (e) {
        console.error(e);
        showToast('error', 'خطأ', 'فشل تصدير اتجاهات الفروع');
    }
}

// --- Product Performance Functions ---

async function generateProductsReport() {
    showLoading('جاري تحليل المنتجات...');

    try {
        const lists = JSON.parse(localStorage.getItem('lists') || '[]');
        const products = JSON.parse(localStorage.getItem('products_advanced') || localStorage.getItem('products') || '[]');

        const productStats = {};

        lists.forEach(list => {
            (list.items || []).forEach(item => {
                if (!productStats[item.productId]) {
                    const product = products.find(p => p.id === item.productId);
                    productStats[item.productId] = {
                        name: product ? product.name : (item.productName || 'منتج غير معروف'),
                        code: product ? product.code : (item.productCode || '-'),
                        listCount: 0,
                        totalQty: 0,
                        categories: {}
                    };
                }
                productStats[item.productId].listCount++;
                productStats[item.productId].totalQty += Number(item.quantity || 0);

                const cat = list.category || 'عام';
                productStats[item.productId].categories[cat] = (productStats[item.productId].categories[cat] || 0) + 1;
            });
        });

        const sortedProducts = Object.values(productStats).sort((a, b) => b.totalQty - a.totalQty);

        if (sortedProducts.length > 0) {
            document.getElementById('topProductName').textContent = sortedProducts[0].name;
            document.getElementById('topProductValue').textContent = sortedProducts[0].totalQty + ' وحدة';
        }

        const tbody = document.getElementById('productsPerformanceBody');
        if (tbody) {
            if (sortedProducts.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#999; padding:20px;">لا توجد بيانات منتجات مسجلة في القوائم حتى الآن</td></tr>';
            } else {
                tbody.innerHTML = sortedProducts.map(p => {
                    const catBadges = Object.entries(p.categories)
                        .map(([cat, count]) => `<span class="report-badge-pill" style="background: #eee; margin-left: 4px;">${cat}: ${count}</span>`)
                        .join('');

                    return `
                        <tr>
                            <td><strong>${p.name}</strong></td>
                            <td>${p.code}</td>
                            <td>${p.listCount}</td>
                            <td style="font-weight: bold; color: var(--sap-primary, #0A6ED1);">${p.totalQty}</td>
                            <td>${catBadges || '-'}</td>
                        </tr>
                    `;
                }).join('');
            }
        }

    } catch (error) {
        console.error(error);
        showToast('error', 'خطأ', 'حدث خطأ أثناء تحليل المنتجات');
    } finally {
        hideLoading();
    }
}

async function exportProductsReportToExcel() {
    try {
        const lists = JSON.parse(localStorage.getItem('lists') || '[]');
        const products = JSON.parse(localStorage.getItem('products_advanced') || localStorage.getItem('products') || '[]');
        const productStats = {};

        lists.forEach(list => {
            (list.items || []).forEach(item => {
                if (!productStats[item.productId]) {
                    const product = products.find(p => p.id === item.productId);
                    productStats[item.productId] = {
                        name: product ? product.name : (item.productName || 'منتج'),
                        code: product ? product.code : (item.productCode || '-'),
                        listCount: 0,
                        totalQty: 0
                    };
                }
                productStats[item.productId].listCount++;
                productStats[item.productId].totalQty += Number(item.quantity || 0);
            });
        });

        const sorted = Object.values(productStats).sort((a, b) => b.totalQty - a.totalQty);
        const data = sorted.map((p, idx) => ({
            '#': idx + 1,
            'اسم المنتج': p.name,
            'كود المنتج': p.code,
            'عدد القوائم': p.listCount,
            'إجمالي الكمية': p.totalQty
        }));

        downloadExcel(data, 'تقرير_المنتجات', 'المنتجات');
    } catch (e) {
        console.error(e);
        showToast('error', 'خطأ', 'فشل تصدير تقرير المنتجات');
    }
}

async function exportMonthlyBranchReportToExcel() {
    try {
        const branchFilter = document.getElementById('mbrBranch')?.value || '';
        const fromDate = document.getElementById('mbrFromDate')?.value || '';
        const toDate = document.getElementById('mbrToDate')?.value || '';
        const sales = await getSales();

        const filtered = sales.filter(s => {
            const saleMonth = (s.date || '').substring(0, 7);
            const inDate = (!fromDate || saleMonth >= fromDate) && (!toDate || saleMonth <= toDate);
            const inBranch = !branchFilter || s.branch === branchFilter;
            return inDate && inBranch;
        });

        if (filtered.length === 0) {
            showToast('warning', 'تنبيه', 'لا توجد بيانات لتصديرها');
            return;
        }

        const data = filtered.map((s, idx) => ({
            '#': idx + 1,
            'التاريخ': s.date,
            'الفرع': s.branch,
            'المبلغ (ريال)': Number(s.amount || 0),
            'الوصف': s.description || '',
            'الملاحظات': s.notes || ''
        }));

        downloadExcel(data, `تقرير_المبيعات_الشهري_${fromDate}_${toDate}`, 'المبيعات الشهرية');
    } catch (e) {
        console.error(e);
        showToast('error', 'خطأ', 'فشل تصدير التقرير الشهري');
    }
}

// Export functions to global window
window.initAnalytics = initAnalytics;
window.updateAnalyticsKPIs = updateAnalyticsKPIs;
window.switchReport = switchReport;
window.setCustomDatePreset = setCustomDatePreset;
window.generateCustomReport = generateCustomReport;
window.printCustomReport = printCustomReport;
window.exportCustomReportToExcel = exportCustomReportToExcel;
window.exportDailyReportToExcel = exportDailyReportToExcel;
window.exportBranchesReportToExcel = exportBranchesReportToExcel;
window.exportMonthlyBranchReportToExcel = exportMonthlyBranchReportToExcel;
window.exportYearlyReportToExcel = exportYearlyReportToExcel;
window.exportPeakReportToExcel = exportPeakReportToExcel;
window.exportBranchTrendsToExcel = exportBranchTrendsToExcel;
window.exportProductsReportToExcel = exportProductsReportToExcel;
window.generateBranchesReport = generateBranchesReport;
window.generateProductsReport = generateProductsReport;
window.generateYearlyReport = generateYearlyReport;
window.generatePeakReport = generatePeakReport;
window.generateBranchTrendsReport = generateBranchTrendsReport;
window.generateMatrixReport = function () { };
window.printMatrixReport = function () { };
window.exportMatrixToExcel = function () { };
window.REPORT_TEMPLATES = REPORT_TEMPLATES;
