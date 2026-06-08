document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const loginPage = document.getElementById('login-page');
  const dashboardPage = document.getElementById('dashboard-page');
  const loginForm = document.getElementById('login-form');
  const loginError = document.getElementById('login-error');
  const loginBtn = document.getElementById('login-btn');
  const loginLoader = document.getElementById('login-loader');
  const loginBtnText = loginBtn.querySelector('span');
  
  const logoutBtn = document.getElementById('logout-btn');
  const userCompanyEl = document.getElementById('user-company');
  const currentDateEl = document.getElementById('current-date');
  const totalConsumptionEl = document.getElementById('total-consumption');
  const peakDemandEl = document.getElementById('peak-demand');
  const generateBillingBtn = document.getElementById('generate-billing-btn');
  const toast = document.getElementById('toast');

  let chartInstance = null;

  // Check if already logged in
  const token = localStorage.getItem('nexus_token');
  if (token) {
    showDashboard();
  }

  // --- Event Listeners ---

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    // UI Loading state
    loginError.textContent = '';
    loginBtnText.classList.add('hidden');
    loginLoader.classList.remove('hidden');
    loginBtn.disabled = true;

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        localStorage.setItem('nexus_token', data.token);
        localStorage.setItem('nexus_company', data.user.company);
        showDashboard();
      } else {
        loginError.textContent = data.error || 'Login failed';
      }
    } catch (err) {
      loginError.textContent = 'Network error. Please try again.';
      console.error(err);
    } finally {
      // Reset UI Loading state
      loginBtnText.classList.remove('hidden');
      loginLoader.classList.add('hidden');
      loginBtn.disabled = false;
    }
  });

  logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('nexus_token');
    localStorage.removeItem('nexus_company');
    loginPage.classList.remove('hidden');
    loginPage.classList.add('active');
    dashboardPage.classList.add('hidden');
    dashboardPage.classList.remove('active');
    document.getElementById('password').value = '';
    if (chartInstance) {
      chartInstance.destroy();
      chartInstance = null;
    }
  });

  generateBillingBtn.addEventListener('click', async () => {
    const token = localStorage.getItem('nexus_token');
    
    // Animate button
    generateBillingBtn.classList.add('pulse');
    generateBillingBtn.disabled = true;
    generateBillingBtn.innerHTML = '<div class="loader" style="width:16px;height:16px;border-width:2px;display:inline-block;vertical-align:middle;margin-right:8px;"></div> Processing...';

    try {
      const response = await fetch('/api/billing/generate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      
      if (response.ok) {
        showToast(data.message);
      } else {
        showToast(data.error || 'Failed to generate invoice', true);
      }
    } catch (err) {
      showToast('Network error while generating invoice', true);
      console.error(err);
    } finally {
      generateBillingBtn.classList.remove('pulse');
      generateBillingBtn.disabled = false;
      generateBillingBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:8px;">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
          <polyline points="10 9 9 9 8 9"></polyline>
        </svg>
        Generate Invoice
      `;
    }
  });

  // --- Core Functions ---

  function showDashboard() {
    loginPage.classList.remove('active');
    setTimeout(() => {
      loginPage.classList.add('hidden');
      dashboardPage.classList.remove('hidden');
      setTimeout(() => dashboardPage.classList.add('active'), 50);
      
      loadDashboardData();
    }, 300);
  }

  async function loadDashboardData() {
    const token = localStorage.getItem('nexus_token');
    userCompanyEl.textContent = localStorage.getItem('nexus_company') || 'Client';

    try {
      const response = await fetch('/api/telemetry', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.status === 401 || response.status === 403) {
        logoutBtn.click(); // Token expired or invalid
        return;
      }
      
      const data = await response.json();
      
      // Update UI
      const dateObj = new Date(data.date);
      currentDateEl.textContent = dateObj.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      
      const totalKwh = data.data.reduce((acc, curr) => acc + curr.consumption_kwh, 0);
      const peakKw = Math.max(...data.data.map(d => d.peak_demand_kw));
      
      // Animate numbers
      animateValue(totalConsumptionEl, 0, totalKwh, 1500);
      animateValue(peakDemandEl, 0, peakKw, 1500);
      
      // Render Chart
      renderChart(data.data);
      
    } catch (err) {
      console.error('Error fetching telemetry:', err);
      showToast('Failed to load telemetry data', true);
    }
  }

  function renderChart(data) {
    const ctx = document.getElementById('telemetryChart').getContext('2d');
    
    if (chartInstance) {
      chartInstance.destroy();
    }
    
    // Gradient for the line chart
    const gradientFill = ctx.createLinearGradient(0, 0, 0, 400);
    gradientFill.addColorStop(0, 'rgba(0, 242, 254, 0.5)');
    gradientFill.addColorStop(1, 'rgba(0, 242, 254, 0.0)');

    chartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.map(d => d.time),
        datasets: [{
          label: 'Consumption (kWh)',
          data: data.map(d => d.consumption_kwh),
          borderColor: '#00f2fe',
          backgroundColor: gradientFill,
          borderWidth: 2,
          pointBackgroundColor: '#0f172a',
          pointBorderColor: '#00f2fe',
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
          fill: true,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.9)',
            titleColor: '#f8fafc',
            bodyColor: '#94a3b8',
            borderColor: 'rgba(255,255,255,0.1)',
            borderWidth: 1,
            padding: 12,
            displayColors: false,
            callbacks: {
              label: function(context) {
                return `${context.parsed.y} kWh`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: {
              color: 'rgba(255, 255, 255, 0.05)',
              drawBorder: false
            },
            ticks: {
              color: '#94a3b8',
              maxTicksLimit: 12
            }
          },
          y: {
            grid: {
              color: 'rgba(255, 255, 255, 0.05)',
              drawBorder: false
            },
            ticks: {
              color: '#94a3b8'
            },
            beginAtZero: true
          }
        },
        interaction: {
          intersect: false,
          mode: 'index',
        },
      }
    });
  }

  // --- Utilities ---

  function showToast(message, isError = false) {
    toast.textContent = message;
    toast.style.backgroundColor = isError ? 'var(--danger)' : 'var(--success)';
    
    toast.classList.remove('hidden');
    // small delay to allow display block to apply before adding show class for animation
    setTimeout(() => {
      toast.classList.add('show');
    }, 10);
    
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.classList.add('hidden'), 300);
    }, 3000);
  }

  function animateValue(obj, start, end, duration) {
    let startTimestamp = null;
    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      // easeOutQuart
      const easeProgress = 1 - Math.pow(1 - progress, 4);
      obj.innerHTML = Math.floor(easeProgress * (end - start) + start);
      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };
    window.requestAnimationFrame(step);
  }
});
