/**
 * REZORA — Next-Gen Enterprise UX Controller
 * Replaces native alerts/toasts, powers fluid navigation, mobile bottom bar, and micro-interactions
 */

(function () {
    'use strict';

    // ──────────────────────────────────────────────────────────────────────────
    // 1. REZORA TOAST NOTIFICATION ENGINE
    // ──────────────────────────────────────────────────────────────────────────
    const RezoraToast = {
        container: null,

        getContainer() {
            if (!this.container || !document.body.contains(this.container)) {
                this.container = document.getElementById('rezoraToastContainer');
                if (!this.container) {
                    this.container = document.createElement('div');
                    this.container.id = 'rezoraToastContainer';
                    document.body.appendChild(this.container);
                }
            }
            return this.container;
        },

        show(type = 'info', title = '', message = '', duration = 4000) {
            const container = this.getContainer();

            const toast = document.createElement('div');
            toast.className = `rezora-toast ${type}`;

            const icons = {
                success: '✓',
                error: '✕',
                warning: '!',
                info: 'ℹ'
            };

            const iconChar = icons[type] || icons.info;

            toast.innerHTML = `
                <div class="rezora-toast-icon">${iconChar}</div>
                <div class="rezora-toast-body">
                    ${title ? `<div class="rezora-toast-title">${title}</div>` : ''}
                    ${message ? `<div class="rezora-toast-message">${message}</div>` : ''}
                </div>
                <button type="button" class="rezora-toast-close" title="إغلاق">&times;</button>
                <div class="rezora-toast-progress" style="animation-duration: ${duration}ms;"></div>
            `;

            container.appendChild(toast);

            // Animate In
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    toast.classList.add('show');
                });
            });

            // Dismiss timer
            let timeoutId = setTimeout(() => {
                this.dismiss(toast);
            }, duration);

            // Close button click
            const closeBtn = toast.querySelector('.rezora-toast-close');
            if (closeBtn) {
                closeBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    clearTimeout(timeoutId);
                    this.dismiss(toast);
                });
            }

            // Click toast to dismiss
            toast.addEventListener('click', () => {
                clearTimeout(timeoutId);
                this.dismiss(toast);
            });

            return toast;
        },

        dismiss(toast) {
            if (!toast || toast.classList.contains('hide')) return;
            toast.classList.remove('show');
            toast.classList.add('hide');
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 260);
        }
    };

    // Override global showToast for backwards compatibility with all scripts
    window.showToast = function (type, title, message, duration = 4000) {
        return RezoraToast.show(type, title, message, duration);
    };

    // Soft override for browser alert() to use beautiful modern notifications
    const originalAlert = window.alert;
    window.alert = function (message) {
        if (!message) return;
        const msgStr = String(message);
        const isError = msgStr.includes('خطأ') || msgStr.includes('فشل') || msgStr.includes('غير صحيح');
        const isSuccess = msgStr.includes('نجاح') || msgStr.includes('تم') || msgStr.includes('حفظ');
        const type = isError ? 'error' : (isSuccess ? 'success' : 'info');
        const title = isError ? 'تنبيه خطأ' : (isSuccess ? 'تم بنجاح' : 'تنبيه النظام');
        RezoraToast.show(type, title, msgStr, 4500);
        console.warn('Native alert intercepted by REZORA UX:', message);
    };

    // ──────────────────────────────────────────────────────────────────────────
    // 2. BRANDED LOADING OVERLAY
    // ──────────────────────────────────────────────────────────────────────────
    const RezoraLoader = {
        overlay: null,

        getOverlay() {
            if (!this.overlay || !document.body.contains(this.overlay)) {
                this.overlay = document.getElementById('rezoraLoadingOverlay');
                if (!this.overlay) {
                    this.overlay = document.createElement('div');
                    this.overlay.id = 'rezoraLoadingOverlay';
                    this.overlay.className = 'rezora-loading-overlay';
                    this.overlay.innerHTML = `
                        <div class="rezora-spinner"></div>
                        <div class="rezora-loading-text" id="rezoraLoadingText">جاري معالجة البيانات...</div>
                    `;
                    document.body.appendChild(this.overlay);
                }
            }
            return this.overlay;
        },

        show(message = 'جاري معالجة البيانات...') {
            const overlay = this.getOverlay();
            const textEl = document.getElementById('rezoraLoadingText');
            if (textEl) textEl.textContent = message;
            overlay.classList.add('active');
        },

        hide() {
            if (this.overlay) {
                this.overlay.classList.remove('active');
            }
        }
    };

    window.showLoading = function (msg) { RezoraLoader.show(msg); };
    window.hideLoading = function () { RezoraLoader.hide(); };

    // ──────────────────────────────────────────────────────────────────────────
    // 3. FLUID PAGE NAVIGATION ENHANCEMENT
    // ──────────────────────────────────────────────────────────────────────────
    function setupNavigationHook() {
        if (typeof window.navigateTo === 'function') {
            const existingNavigateTo = window.navigateTo;

            window.navigateTo = function (pageId) {
                // Call existing logic
                existingNavigateTo(pageId);

                // Add active-section for smooth CSS keyframe animation
                document.querySelectorAll('.page-section').forEach(sec => {
                    sec.classList.remove('active-section');
                });
                const target = document.getElementById(`${pageId}-section`);
                if (target) {
                    target.classList.add('active-section');
                }

                // Update mobile bottom nav active status
                updateMobileNavActive(pageId);

                // Close mobile sidebar if open
                closeMobileSidebar();

                // Smooth scroll to top of viewport
                window.scrollTo({ top: 0, behavior: 'smooth' });
            };
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 4. MOBILE BOTTOM NAVIGATION DOCK & DRAWER
    // ──────────────────────────────────────────────────────────────────────────
    function createMobileBottomNav() {
        if (document.querySelector('.rezora-mobile-nav')) return;

        const nav = document.createElement('nav');
        nav.className = 'rezora-mobile-nav';
        nav.setAttribute('aria-label', 'التنقل الرئيسي للجوال');
        nav.innerHTML = `
            <a href="javascript:void(0)" class="mobile-nav-item active" data-page="home" onclick="navigateTo('home')">
                <span class="mobile-nav-icon">📊</span>
                <span>المؤشرات</span>
            </a>
            <a href="javascript:void(0)" class="mobile-nav-item" data-page="reconciliation" onclick="navigateTo('reconciliation')">
                <span class="mobile-nav-icon">⚖️</span>
                <span>التسوية</span>
            </a>
            <div class="mobile-nav-highlight" onclick="navigateTo('sales')" title="تسجيل بيع فوري">
                <span>+</span>
            </div>
            <a href="javascript:void(0)" class="mobile-nav-item" data-page="treasury" onclick="navigateTo('treasury')">
                <span class="mobile-nav-icon">🏦</span>
                <span>الخزينة</span>
            </a>
            <a href="javascript:void(0)" class="mobile-nav-item" data-page="more" onclick="toggleSidebar()">
                <span class="mobile-nav-icon">☰</span>
                <span>المزيد</span>
            </a>
        `;
        document.body.appendChild(nav);
    }

    function updateMobileNavActive(pageId) {
        document.querySelectorAll('.mobile-nav-item').forEach(item => {
            const p = item.getAttribute('data-page');
            if (p === pageId) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 5. MOBILE SIDEBAR BACKDROP & BEHAVIOR
    // ──────────────────────────────────────────────────────────────────────────
    let sidebarBackdrop = null;

    function createSidebarBackdrop() {
        if (document.querySelector('.rezora-sidebar-backdrop')) return;

        sidebarBackdrop = document.createElement('div');
        sidebarBackdrop.className = 'rezora-sidebar-backdrop';
        sidebarBackdrop.addEventListener('click', () => {
            closeMobileSidebar();
        });
        document.body.appendChild(sidebarBackdrop);

        // Enhance toggleSidebar
        const originalToggleSidebar = window.toggleSidebar;
        window.toggleSidebar = function () {
            if (typeof originalToggleSidebar === 'function') {
                originalToggleSidebar();
            }
            const sidebar = document.getElementById('sidebar');
            if (sidebar && sidebar.classList.contains('active')) {
                if (sidebarBackdrop) sidebarBackdrop.classList.add('show');
                document.body.style.overflow = 'hidden';
            } else {
                if (sidebarBackdrop) sidebarBackdrop.classList.remove('show');
                document.body.style.overflow = '';
            }
        };

        // When any sidebar item is clicked on mobile, close the drawer
        document.querySelectorAll('.sidebar .nav-item').forEach(navItem => {
            navItem.addEventListener('click', () => {
                if (window.innerWidth <= 992) {
                    closeMobileSidebar();
                }
            });
        });
    }

    function closeMobileSidebar() {
        const sidebar = document.getElementById('sidebar');
        if (sidebar && sidebar.classList.contains('active')) {
            sidebar.classList.remove('active');
        }
        if (sidebarBackdrop) {
            sidebarBackdrop.classList.remove('show');
        }
        document.body.style.overflow = '';
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 6. FLOATING SCROLL-TO-TOP BUTTON
    // ──────────────────────────────────────────────────────────────────────────
    function createScrollTopButton() {
        if (document.querySelector('.rezora-scroll-top')) return;

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'rezora-scroll-top';
        btn.setAttribute('aria-label', 'العودة للأعلى');
        btn.setAttribute('title', 'العودة للأعلى');
        btn.innerHTML = '▲';
        btn.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });

        document.body.appendChild(btn);

        window.addEventListener('scroll', () => {
            if (window.scrollY > 280) {
                btn.classList.add('show');
            } else {
                btn.classList.remove('show');
            }
        }, { passive: true });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 7. KEYBOARD SHORTCUTS PALETTE & ESCAPE DISMISSAL
    // ──────────────────────────────────────────────────────────────────────────
    function showShortcutsModal() {
        let existing = document.getElementById('rezoraShortcutsBackdrop');
        if (existing) {
            existing.classList.add('show');
            return;
        }

        const backdrop = document.createElement('div');
        backdrop.id = 'rezoraShortcutsBackdrop';
        backdrop.className = 'rezora-modal-backdrop';
        backdrop.innerHTML = `
            <div class="rezora-dialog-card" style="max-width: 500px;">
                <div class="rezora-dialog-header">
                    <div class="rezora-dialog-icon" style="background: var(--gold-surface, rgba(201,165,50,0.1)); color: var(--gold-400, #C9A532); border: 1px solid var(--gold-border, rgba(201,165,50,0.25));">⌨️</div>
                    <div>
                        <h3 class="rezora-dialog-title">اختصارات لوحة المفاتيح</h3>
                        <p style="margin: 0; font-size: 0.78rem; color: var(--tx-muted);">لإنجاز المهام بسرعة واحترافية</p>
                    </div>
                </div>
                <div class="rezora-shortcuts-grid">
                    <div class="rezora-shortcut-row">
                        <span>البحث المؤسسي السريع</span>
                        <span class="rezora-kbd">Ctrl + K</span>
                    </div>
                    <div class="rezora-shortcut-row">
                        <span>تسجيل بيع جديد</span>
                        <span class="rezora-kbd">Ctrl + M</span>
                    </div>
                    <div class="rezora-shortcut-row">
                        <span>إغلاق النوافذ والقوائم</span>
                        <span class="rezora-kbd">Esc</span>
                    </div>
                    <div class="rezora-shortcut-row">
                        <span>قائمة الاختصارات</span>
                        <span class="rezora-kbd">?</span>
                    </div>
                </div>
                <div class="rezora-dialog-actions" style="margin-top: 14px;">
                    <button type="button" class="btn-sap btn-emphasized" onclick="document.getElementById('rezoraShortcutsBackdrop').classList.remove('show')" style="padding: 6px 20px; font-weight: 600;">
                        فهمت ذلك
                    </button>
                </div>
            </div>
        `;

        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) backdrop.classList.remove('show');
        });

        document.body.appendChild(backdrop);
        requestAnimationFrame(() => backdrop.classList.add('show'));
    }

    function setupGlobalKeyboardHandlers() {
        document.addEventListener('keydown', (e) => {
            // Escape key closes modals and mobile sidebar
            if (e.key === 'Escape' || e.keyCode === 27) {
                // Close shortcuts
                const shortcuts = document.getElementById('rezoraShortcutsBackdrop');
                if (shortcuts && shortcuts.classList.contains('show')) {
                    shortcuts.classList.remove('show');
                    return;
                }
                // Close Branch Modal
                if (typeof window.closeBranchModal === 'function') {
                    window.closeBranchModal();
                }
                // Close Duplicate Manager
                if (typeof window.closeDuplicateManager === 'function') {
                    window.closeDuplicateManager();
                }
                // Close Mobile Sidebar
                closeMobileSidebar();
            }

            // '?' key opens shortcuts helper when not typing
            if (e.key === '?' || (e.shiftKey && e.key === '/')) {
                const target = e.target;
                const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
                if (!isInput) {
                    e.preventDefault();
                    showShortcutsModal();
                }
            }
        });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 8. ENTERPRISE CONFIRMATION DIALOG (PROMISE-BASED)
    // ──────────────────────────────────────────────────────────────────────────
    function RezoraConfirm({ title = 'تأكيد الإجراء', message = 'هل أنت متأكد من المتابعة؟', confirmText = 'تأكيد', cancelText = 'إلغاء', type = 'warning' } = {}) {
        return new Promise((resolve) => {
            let overlay = document.getElementById('rezoraConfirmOverlay');
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.id = 'rezoraConfirmOverlay';
                overlay.className = 'rezora-confirm-overlay';
                document.body.appendChild(overlay);
            }

            const icons = {
                danger: '🗑️',
                warning: '⚠️',
                info: 'ℹ️'
            };

            overlay.innerHTML = `
                <div class="rezora-confirm-box">
                    <div class="rezora-confirm-header">
                        <div class="rezora-confirm-icon ${type}">${icons[type] || '⚠️'}</div>
                        <h3 class="rezora-confirm-title">${title}</h3>
                    </div>
                    <div class="rezora-confirm-message">${message}</div>
                    <div class="rezora-confirm-actions">
                        <button type="button" class="btn-sap btn-standard" id="rezoraConfirmCancelBtn">${cancelText}</button>
                        <button type="button" class="btn-sap ${type === 'danger' ? 'btn-danger' : 'btn-emphasized'}" id="rezoraConfirmOkBtn" style="${type === 'danger' ? 'background: #DC2626; color: white; border-color: #DC2626;' : ''}">${confirmText}</button>
                    </div>
                </div>
            `;

            function close(val) {
                overlay.classList.remove('show');
                setTimeout(() => {
                    resolve(val);
                }, 200);
            }

            overlay.querySelector('#rezoraConfirmCancelBtn').onclick = () => close(false);
            overlay.querySelector('#rezoraConfirmOkBtn').onclick = () => close(true);
            overlay.onclick = (e) => {
                if (e.target === overlay) close(false);
            };

            requestAnimationFrame(() => overlay.classList.add('show'));
        });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 9. SHIMMER SKELETON LOADER CONTROLLER
    // ──────────────────────────────────────────────────────────────────────────
    const RezoraSkeleton = {
        renderTableRows(tbodyId, rowsCount = 4, colsCount = 5) {
            const tbody = document.getElementById(tbodyId);
            if (!tbody) return;
            let html = '';
            for (let r = 0; r < rowsCount; r++) {
                html += '<tr class="skeleton-row">';
                for (let c = 0; c < colsCount; c++) {
                    const w = c === 0 ? 'w-sm' : (c === 1 ? 'w-md' : 'w-full');
                    html += `<td><span class="rezora-skeleton skeleton-cell ${w}"></span></td>`;
                }
                html += '</tr>';
            }
            tbody.innerHTML = html;
        }
    };

    // ──────────────────────────────────────────────────────────────────────────
    // 10. DASHBOARD TIME-RANGE FILTER CONTROLLER
    // ──────────────────────────────────────────────────────────────────────────
    async function setDashboardRange(range, btn) {
        if (btn) {
            document.querySelectorAll('#dashboardTimeFilter .rezora-segment-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        }

        try {
            if (typeof window.getSales !== 'function') return;
            const sales = await window.getSales();
            const now = new Date();
            const todayStr = (typeof window.getTodayIsoDate === 'function') ? window.getTodayIsoDate() : now.toISOString().split('T')[0];

            let filteredSales = sales;
            let rangeLabel = 'اليوم';

            if (range === 'today') {
                filteredSales = sales.filter(s => s.date === todayStr);
                rangeLabel = 'اليوم';
            } else if (range === 'week') {
                const weekAgo = new Date(now);
                weekAgo.setDate(weekAgo.getDate() - 7);
                const weekAgoStr = weekAgo.toISOString().split('T')[0];
                filteredSales = sales.filter(s => s.date >= weekAgoStr && s.date <= todayStr);
                rangeLabel = 'آخر 7 أيام';
            } else if (range === 'month') {
                const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
                filteredSales = sales.filter(s => s.date >= monthStart && s.date <= todayStr);
                rangeLabel = 'هذا الشهر';
            } else if (range === 'all') {
                filteredSales = sales;
                rangeLabel = 'كل السجلات';
            }

            const totalAmount = filteredSales.reduce((sum, s) => sum + Number(s.amount || 0), 0);
            const statTodayEl = document.getElementById('statToday');
            if (statTodayEl && typeof window.formatMoney === 'function') {
                statTodayEl.innerHTML = window.formatMoney(totalAmount);
            }

            const statTrendEl = document.getElementById('statTodayTrend');
            if (statTrendEl) {
                statTrendEl.innerHTML = `<span style="color: var(--gold-400); font-weight: 600;">📊 ${filteredSales.length} عملية (${rangeLabel})</span>`;
            }

            // Update recent table with filtered sales
            if (typeof window.updateRecentSalesTable === 'function') {
                const sorted = [...filteredSales].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
                window.updateRecentSalesTable(sorted.slice(0, 10));
            }
        } catch (err) {
            console.error('Error applying dashboard time filter:', err);
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 11. INITIALIZE ON DOM READY
    // ──────────────────────────────────────────────────────────────────────────
    function initRezoraUX() {
        setupNavigationHook();
        createMobileBottomNav();
        createSidebarBackdrop();
        createScrollTopButton();
        setupGlobalKeyboardHandlers();

        // Mark home section active on startup
        const homeSection = document.getElementById('home-section');
        if (homeSection && homeSection.style.display !== 'none') {
            homeSection.classList.add('active-section');
        }

        console.log('🚀 REZORA Enterprise UX System initialized successfully');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initRezoraUX);
    } else {
        initRezoraUX();
    }

    // Export globally
    window.RezoraToast = RezoraToast;
    window.RezoraLoader = RezoraLoader;
    window.RezoraConfirm = RezoraConfirm;
    window.RezoraSkeleton = RezoraSkeleton;
    window.showShortcutsModal = showShortcutsModal;
    window.setDashboardRange = setDashboardRange;

})();
