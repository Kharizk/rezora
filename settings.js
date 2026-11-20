// Settings Page - Backup & Restore & Data Management

/**
 * Export Data (Backup)
 */
async function exportData() {
    try {
        let sales = [];
        let branches = [];
        let reconciliations = [];
        let treasuryReconciliations = [];

        if (typeof window.getSales === 'function') sales = await window.getSales();
        if (typeof window.getBranches === 'function') branches = await window.getBranches();
        if (typeof window.getReconciliations === 'function') reconciliations = await window.getReconciliations();
        if (typeof window.getTreasuryReconciliations === 'function') treasuryReconciliations = await window.getTreasuryReconciliations();

        const data = {
            system: 'Rezora Enterprise (IBM Carbon v11 Edition)',
            version: '5.0',
            timestamp: new Date().toISOString(),
            sales: sales,
            branches: branches,
            reconciliations: reconciliations,
            treasuryReconciliations: treasuryReconciliations,
            settings: JSON.parse(localStorage.getItem('settings') || '{}')
        };

        const dataStr = JSON.stringify(data, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        const date = new Date().toISOString().slice(0, 10);
        a.download = `rezora_carbon_backup_${date}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showToast('success', 'تم التصدير', `تم تحميل ملف النسخة الاحتياطية بنجاح (${sales.length} مبيعات، ${branches.length} فروع)`);
    } catch (error) {
        console.error('Export error:', error);
        showToast('error', 'خطأ', 'فشل تصدير البيانات: ' + error.message);
    }
}

/**
 * Trigger File Input
 */
function triggerImport() {
    const input = document.getElementById('importFile');
    if (input) input.click();
}

/**
 * Import Data (Restore)
 */
function importData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function (e) {
        try {
            const data = JSON.parse(e.target.result);

            if (!data.sales && !data.branches) {
                throw new Error('الملف لا يحتوي على بيانات مبيعات أو فروع صالحة');
            }

            const salesCount = (data.sales || []).length;
            const branchesCount = (data.branches || []).length;

            if (confirm(`تحذير: سيتم استعادة البيانات (${salesCount} عملية مبيعات، ${branchesCount} فرع). هل أنت متأكد من المتابعة؟`)) {
                if (typeof window.saveSales === 'function' && data.sales) {
                    await window.saveSales(data.sales);
                }
                if (typeof window.saveBranches === 'function' && data.branches) {
                    await window.saveBranches(data.branches);
                }
                if (typeof window.saveReconciliations === 'function' && data.reconciliations) {
                    await window.saveReconciliations(data.reconciliations);
                }
                if (typeof window.saveTreasuryReconciliations === 'function' && data.treasuryReconciliations) {
                    await window.saveTreasuryReconciliations(data.treasuryReconciliations);
                }

                showToast('success', 'تمت الاستعادة بنجاح', 'تمت استعادة البيانات بنجاح، جاري إعادة تحميل الصفحة...');
                setTimeout(() => location.reload(), 1200);
            }
        } catch (error) {
            console.error('Import error:', error);
            showToast('error', 'خطأ في الاستعادة', error.message || 'الملف غير صالح أو تالف');
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}

// Export functions
window.exportData = exportData;
window.triggerImport = triggerImport;
window.importData = importData;
