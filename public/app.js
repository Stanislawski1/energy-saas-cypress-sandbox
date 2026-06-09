/**
 * app.js — Nexus Energy Enterprise SaaS Frontend
 *
 * Architecture:
 *  - Auth flow: login → store JWT → show app shell
 *  - SPA routing: sidebar buttons switch tab panels without page reload
 *  - API calls: all protected routes use Bearer JWT from localStorage
 *  - CSV download: Blob + anchor trick for real browser file download
 */

document.addEventListener('DOMContentLoaded', () => {

  // ── DOM References ───────────────────────────────────────────────────────
  const loginPage     = document.getElementById('login-page');
  const appShell      = document.getElementById('app-shell');
  const loginForm     = document.getElementById('login-form');
  const loginError    = document.getElementById('login-error');
  const loginBtn      = document.getElementById('login-btn');
  const loginBtnText  = document.getElementById('login-btn-text');
  const loginLoader   = document.getElementById('login-loader');

  const logoutBtn       = document.getElementById('logout-btn');
  const sidebarUsername = document.getElementById('sidebar-username');
  const sidebarCompany  = document.getElementById('sidebar-company');
  const userAvatar      = document.getElementById('user-avatar');
  const currentDateEl   = document.getElementById('current-date');
  const pageTitle       = document.getElementById('page-title');
  const pageSubtitle    = document.getElementById('page-subtitle');
  const toast           = document.getElementById('toast');

  // Dashboard
  const totalConsumptionEl    = document.getElementById('total-consumption');
  const peakDemandEl          = document.getElementById('peak-demand');
  const refreshTelemetryBtn   = document.getElementById('refresh-telemetry-btn');

  // Billing
  const generateBillingBtn  = document.getElementById('generate-billing-btn');
  const billingBtnText      = document.getElementById('billing-btn-text');
  const invoiceTbody        = document.getElementById('invoice-tbody');
  const refreshBillingBtn   = document.getElementById('refresh-billing-btn');

  // Reports
  const downloadMonthlyBtn  = document.getElementById('download-monthly-csv');
  const downloadAnnualBtn   = document.getElementById('download-annual-csv');
  const downloadLog         = document.getElementById('download-log');

  let chartInstance   = null;
  let activeTab       = 'dashboard';

  // ── Page title metadata per tab ──────────────────────────────────────────
  const TAB_META = {
    dashboard: { title: 'Dashboard',     subtitle: 'Real-time energy telemetry' },
    billing:   { title: 'Billing',       subtitle: 'Invoice management & history' },
    reports:   { title: 'Reports',       subtitle: 'Data export & analytics downloads' },
  };

  // ════════════════════════════════════════════════════════════════════════
  //  AUTH FLOW
  // ════════════════════════════════════════════════════════════════════════

  /** Check for an existing session on load */
  const storedToken = localStorage.getItem('nexus_token');
  if (storedToken) {
    showAppShell();
  }

  /** Handle login form submission */
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    setLoginLoading(true);
    loginError.textContent = '';

    try {
      const res  = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();

      if (res.ok) {
        localStorage.setItem('nexus_token',    data.token);
        localStorage.setItem('nexus_username', data.user.username);
        localStorage.setItem('nexus_company',  data.user.company);
        showAppShell();
      } else {
        loginError.textContent = data.error || 'Login failed. Please try again.';
      }
    } catch {
      loginError.textContent = 'Network error. Is the server running?';
    } finally {
      setLoginLoading(false);
    }
  });

  /** Sign out — clear state and return to login */
  logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('nexus_token');
    localStorage.removeItem('nexus_username');
    localStorage.removeItem('nexus_company');

    if (chartInstance) { chartInstance.destroy(); chartInstance = null; }

    appShell.classList.add('hidden');
    loginPage.classList.remove('hidden');
    document.getElementById('password').value = '';
    loginError.textContent = '';
  });

  /** Show/hide login loading state */
  function setLoginLoading(loading) {
    loginBtn.disabled = loading;
    if (loading) {
      loginBtnText.textContent = 'Signing in...';
      loginLoader.classList.remove('hidden');
    } else {
      loginBtnText.textContent = 'Sign In to Platform';
      loginLoader.classList.add('hidden');
    }
  }

  /** Transition to the app shell after successful auth */
  function showAppShell() {
    loginPage.classList.add('hidden');
    appShell.classList.remove('hidden');

    // Populate sidebar user info
    const username = localStorage.getItem('nexus_username') || 'User';
    const company  = localStorage.getItem('nexus_company')  || 'Company';
    sidebarUsername.textContent = username.charAt(0).toUpperCase() + username.slice(1);
    sidebarCompany.textContent  = company;
    userAvatar.textContent      = username.charAt(0).toUpperCase();

    // Set today's date in top bar
    currentDateEl.textContent = new Date().toLocaleDateString('en-US', {
      weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
    });

    switchTab('dashboard');
  }

  // ════════════════════════════════════════════════════════════════════════
  //  SPA TAB ROUTING
  // ════════════════════════════════════════════════════════════════════════

  /** Wire up sidebar nav buttons */
  document.querySelectorAll('.nav-item[data-tab]').forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  /**
   * switchTab — show one panel, hide others, update nav active state
   * @param {string} tab - 'dashboard' | 'billing' | 'reports'
   */
  function switchTab(tab) {
    // Update active state on nav items
    document.querySelectorAll('.nav-item[data-tab]').forEach((btn) => {
      const isActive = btn.dataset.tab === tab;
      btn.classList.toggle('nav-item-active', isActive);
      if (!isActive) {
        btn.classList.remove('nav-item-active');
        btn.style.background = '';
        btn.style.color = '';
        btn.style.border = '';
      }
    });

    // Show/hide panels
    ['dashboard', 'billing', 'reports'].forEach((t) => {
      const panel = document.getElementById(`tab-${t}`);
      if (t === tab) {
        panel.classList.remove('hidden');
      } else {
        panel.classList.add('hidden');
      }
    });

    // Update top bar meta
    const meta = TAB_META[tab] || {};
    pageTitle.textContent    = meta.title    || tab;
    pageSubtitle.textContent = meta.subtitle || '';

    activeTab = tab;

    // Load data for the newly activated tab
    if (tab === 'dashboard') loadTelemetry();
    if (tab === 'billing')   loadInvoices();
  }

  // ════════════════════════════════════════════════════════════════════════
  //  DASHBOARD — TELEMETRY
  // ════════════════════════════════════════════════════════════════════════

  refreshTelemetryBtn.addEventListener('click', loadTelemetry);

  async function loadTelemetry() {
    const token = localStorage.getItem('nexus_token');
    refreshTelemetryBtn.disabled = true;
    refreshTelemetryBtn.innerHTML = `
      <div class="loader" style="width:12px;height:12px;border-width:2px;border-color:rgba(255,255,255,0.15);border-top-color:#94a3b8"></div>
      Loading...`;

    try {
      const res = await fetch('/api/telemetry', {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (res.status === 401 || res.status === 403) { logoutBtn.click(); return; }

      const data = await res.json();

      // Update KPI values
      const totalKwh = data.data.reduce((sum, d) => sum + d.consumption_kwh, 0);
      const peakKw   = Math.max(...data.data.map((d) => d.peak_demand_kw));

      animateValue(totalConsumptionEl, 0, totalKwh, 1200);
      animateValue(peakDemandEl,       0, peakKw,   1200);

      renderChart(data.data);
    } catch {
      showToast('Failed to load telemetry data', true);
    } finally {
      refreshTelemetryBtn.disabled = false;
      refreshTelemetryBtn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="23 4 23 10 17 10"/>
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
        </svg>
        Refresh`;
    }
  }

  function renderChart(data) {
    const ctx = document.getElementById('telemetryChart').getContext('2d');
    if (chartInstance) chartInstance.destroy();

    const gradFill = ctx.createLinearGradient(0, 0, 0, 320);
    gradFill.addColorStop(0,   'rgba(0, 242, 254, 0.35)');
    gradFill.addColorStop(1,   'rgba(0, 242, 254, 0.0)');

    const gradLine = ctx.createLinearGradient(0, 0, ctx.canvas.width, 0);
    gradLine.addColorStop(0,   '#00f2fe');
    gradLine.addColorStop(1,   '#4facfe');

    chartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.map((d) => d.time),
        datasets: [{
          label:           'Consumption (kWh)',
          data:            data.map((d) => d.consumption_kwh),
          borderColor:     gradLine,
          backgroundColor: gradFill,
          borderWidth:     2.5,
          pointBackgroundColor: '#0f172a',
          pointBorderColor:     '#00f2fe',
          pointBorderWidth:     2,
          pointRadius:     3,
          pointHoverRadius: 6,
          fill: true,
          tension: 0.4,
        }, {
          label:        'Peak Demand (kW)',
          data:         data.map((d) => d.peak_demand_kw),
          borderColor:  'rgba(139, 92, 246, 0.7)',
          borderWidth:  1.5,
          pointRadius:  0,
          pointHoverRadius: 5,
          fill: false,
          tension: 0.4,
          borderDash: [4, 4],
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { intersect: false, mode: 'index' },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            align: 'end',
            labels: {
              color: '#94a3b8',
              font: { family: 'Inter', size: 12 },
              boxWidth: 12,
              usePointStyle: true,
              pointStyleWidth: 12,
            },
          },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            titleColor: '#f8fafc',
            bodyColor: '#94a3b8',
            borderColor: 'rgba(0, 242, 254, 0.2)',
            borderWidth: 1,
            padding: 14,
            cornerRadius: 10,
            callbacks: {
              label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)}`,
            },
          },
        },
        scales: {
          x: {
            grid: { color: 'rgba(255,255,255,0.04)' },
            ticks: { color: '#64748b', font: { size: 11 }, maxTicksLimit: 12 },
          },
          y: {
            grid: { color: 'rgba(255,255,255,0.04)' },
            ticks: { color: '#64748b', font: { size: 11 } },
            beginAtZero: true,
          },
        },
      },
    });
  }

  // ════════════════════════════════════════════════════════════════════════
  //  BILLING TAB
  // ════════════════════════════════════════════════════════════════════════

  generateBillingBtn.addEventListener('click', generateInvoice);
  refreshBillingBtn.addEventListener('click',  loadInvoices);

  async function generateInvoice() {
    const token = localStorage.getItem('nexus_token');
    generateBillingBtn.disabled = true;
    billingBtnText.textContent  = 'Processing...';

    try {
      const res  = await fetch('/api/billing/generate', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: +(Math.random() * 2000 + 500).toFixed(2) }),
      });
      const data = await res.json();

      if (res.ok) {
        showToast(`✓ ${data.message}`);
        loadInvoices(); // Refresh table
      } else {
        showToast(data.error || 'Failed to generate invoice', true);
      }
    } catch {
      showToast('Network error while generating invoice', true);
    } finally {
      generateBillingBtn.disabled = false;
      billingBtnText.textContent  = 'Generate Invoice';
    }
  }

  async function loadInvoices() {
    const token = localStorage.getItem('nexus_token');
    invoiceTbody.innerHTML = `
      <tr><td colspan="4" class="text-center text-slate-500 py-10">
        <div class="loader mx-auto mb-2" style="border-color:rgba(255,255,255,0.08);border-top-color:#00f2fe"></div>
        Fetching invoices...
      </td></tr>`;

    try {
      const res  = await fetch('/api/billing', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();

      if (!res.ok) { throw new Error(data.error); }

      const invoices = data.invoices || [];

      if (invoices.length === 0) {
        invoiceTbody.innerHTML = `
          <tr><td colspan="4" class="text-center text-slate-500 py-10">
            No invoices found. Generate your first invoice above.
          </td></tr>`;
        return;
      }

      invoiceTbody.innerHTML = invoices.map((inv) => `
        <tr>
          <td class="text-slate-500 font-mono text-xs px-2">#${String(inv.id).padStart(4, '0')}</td>
          <td class="px-2">${inv.date}</td>
          <td class="px-2 font-semibold">$${parseFloat(inv.amount).toFixed(2)}</td>
          <td class="px-2"><span class="${statusBadgeClass(inv.status)}">${inv.status}</span></td>
        </tr>`).join('');
    } catch (err) {
      invoiceTbody.innerHTML = `
        <tr><td colspan="4" class="text-center text-red-400 py-8">
          Failed to load invoices: ${err.message || 'Unknown error'}
        </td></tr>`;
    }
  }

  function statusBadgeClass(status) {
    if (!status) return 'badge-pending';
    const s = status.toLowerCase();
    if (s === 'paid')       return 'badge-paid';
    if (s === 'pending')    return 'badge-pending';
    if (s === 'processing') return 'badge-processing';
    return 'badge-pending';
  }

  // ════════════════════════════════════════════════════════════════════════
  //  REPORTS TAB — CSV DOWNLOAD
  // ════════════════════════════════════════════════════════════════════════

  downloadMonthlyBtn.addEventListener('click', () => {
    const csv      = generateMonthlyCSV();
    const filename = 'report_may_2026.csv';
    downloadCSV(csv, filename);
    logDownload(filename, 'Monthly Consumption Report · May 2026');
  });

  downloadAnnualBtn.addEventListener('click', () => {
    const csv      = generateAnnualCSV();
    const filename = 'annual_summary_2026.csv';
    downloadCSV(csv, filename);
    logDownload(filename, 'Annual Summary Report · FY 2026');
  });

  /**
   * downloadCSV — Creates a Blob from CSV string and triggers a real
   * browser file download without any server roundtrip.
   *
   * @param {string} csvContent - The raw CSV string
   * @param {string} filename   - The filename the user will see
   */
  function downloadCSV(csvContent, filename) {
    // 1. Create a Blob with the CSV MIME type
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });

    // 2. Create an invisible anchor element pointing to an object URL
    const url  = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.display = 'none';

    // 3. Append, click (triggers download), then clean up
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // 4. Release the object URL from memory
    URL.revokeObjectURL(url);

    showToast(`✓ Downloading ${filename}`);
  }

  /** Generate a realistic monthly consumption CSV */
  function generateMonthlyCSV() {
    const company = localStorage.getItem('nexus_company') || 'Company';
    const rows    = [
      ['# Nexus Energy — Monthly Consumption Report'],
      [`# Company: ${company}`],
      ['# Period: May 2026'],
      [`# Generated: ${new Date().toISOString()}`],
      [''],
      ['Hour', 'Consumption (kWh)', 'Peak Demand (kW)', 'Avg Voltage (V)', 'Power Factor', 'Status'],
    ];

    for (let h = 0; h < 24; h++) {
      const consumption = (Math.random() * 50 + 10).toFixed(2);
      const peak        = (Math.random() * 20 + 5).toFixed(2);
      const voltage     = (Math.random() * 10 + 228).toFixed(1);
      const pf          = (Math.random() * 0.15 + 0.82).toFixed(3);
      const status      = Math.random() > 0.05 ? 'Normal' : 'Warning';
      rows.push([`${String(h).padStart(2, '0')}:00`, consumption, peak, voltage, pf, status]);
    }

    rows.push(['']);
    rows.push(['# Daily Totals']);
    const totalKwh = (Math.random() * 400 + 600).toFixed(2);
    const peakKw   = (Math.random() * 20 + 25).toFixed(2);
    rows.push(['Total Consumption (kWh)', totalKwh]);
    rows.push(['Max Peak Demand (kW)',    peakKw]);
    rows.push(['Estimated Cost ($)',      (parseFloat(totalKwh) * 0.12).toFixed(2)]);

    return rows.map((r) => r.join(',')).join('\r\n');
  }

  /** Generate a realistic annual summary CSV */
  function generateAnnualCSV() {
    const company = localStorage.getItem('nexus_company') || 'Company';
    const months  = ['January', 'February', 'March', 'April', 'May', 'June',
                     'July', 'August', 'September', 'October', 'November', 'December'];
    const rows = [
      ['# Nexus Energy — Annual Summary Report'],
      [`# Company: ${company}`],
      ['# Fiscal Year: 2026'],
      [`# Generated: ${new Date().toISOString()}`],
      [''],
      ['Month', 'Total Consumption (kWh)', 'Peak Demand (kW)', 'Total Cost ($)', 'Efficiency Score (%)', 'Carbon (tCO2e)'],
    ];

    let grandTotal = 0;
    months.forEach((m) => {
      const kwh   = +(Math.random() * 5000 + 12000).toFixed(2);
      const peak  = +(Math.random() * 30 + 40).toFixed(2);
      const cost  = (kwh * 0.12).toFixed(2);
      const eff   = (Math.random() * 15 + 80).toFixed(1);
      const co2   = (kwh * 0.000233).toFixed(3);
      grandTotal += kwh;
      rows.push([m, kwh, peak, cost, eff, co2]);
    });

    rows.push(['']);
    rows.push(['TOTAL', grandTotal.toFixed(2), '', (grandTotal * 0.12).toFixed(2), '', (grandTotal * 0.000233).toFixed(3)]);

    return rows.map((r) => r.join(',')).join('\r\n');
  }

  /** Add an entry to the download history log in the Reports tab */
  function logDownload(filename, label) {
    const placeholder = downloadLog.querySelector('p');
    if (placeholder) placeholder.remove();

    const time  = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const entry = document.createElement('div');
    entry.className = 'download-entry';
    entry.innerHTML = `
      <div class="dl-icon">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00f2fe" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
      </div>
      <div class="flex-1 min-w-0">
        <p class="text-sm font-medium text-slate-200 truncate">${label}</p>
        <p class="text-xs text-slate-500 font-mono">${filename}</p>
      </div>
      <span class="text-xs text-slate-500 flex-shrink-0">${time}</span>`;

    downloadLog.insertBefore(entry, downloadLog.firstChild);
  }

  // ════════════════════════════════════════════════════════════════════════
  //  UTILITIES
  // ════════════════════════════════════════════════════════════════════════

  /**
   * showToast — display a temporary notification banner
   * @param {string}  message  - text to show
   * @param {boolean} isError  - true for error styling
   */
  function showToast(message, isError = false) {
    toast.textContent        = message;
    toast.style.background   = isError
      ? 'linear-gradient(135deg, #ef4444, #dc2626)'
      : 'linear-gradient(135deg, #10b981, #059669)';
    toast.style.border       = `1px solid ${isError ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}`;

    toast.classList.remove('hidden');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => toast.classList.add('show'));
    });

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.classList.add('hidden'), 350);
    }, 3200);
  }

  /**
   * animateValue — smooth counter animation from start to end
   * Uses easeOutQuart easing for a premium feel.
   */
  function animateValue(el, start, end, duration) {
    let startTs = null;
    const step  = (ts) => {
      if (!startTs) startTs = ts;
      const progress = Math.min((ts - startTs) / duration, 1);
      const ease     = 1 - Math.pow(1 - progress, 4); // easeOutQuart
      el.textContent = Math.floor(ease * (end - start) + start);
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

});
