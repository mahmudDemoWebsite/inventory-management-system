
/* Stockroom — frontend inventory manager. Data is stored locally in this browser. */
const STORAGE_KEY = 'stockroom_inventory_v1';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const money = value => new Intl.NumberFormat('en-BD', {
  style: 'currency',
  currency: 'BDT',
  maximumFractionDigits: 0
}).format(Number(value) || 0);

const number = value => new Intl.NumberFormat('en-BD').format(Number(value) || 0);
const todayISO = () => new Date().toISOString().slice(0, 10);

const dateLabel = value => value
  ? new Date(`${value}T00:00:00`).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric'
  })
  : '—';

const escapeHTML = value => String(value ?? '').replace(/[&<>'"]/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
})[char]);

const seedData = {
  products: [
    { id: 101, name: 'Wireless earbuds', sku: 'AUD-001', category: 'Electronics', price: 1850, cost: 1250, stock: 34, minStock: 10, supplierId: 201, unit: 'pcs' },
    { id: 102, name: 'Fast charging adapter', sku: 'PWR-014', category: 'Accessories', price: 650, cost: 390, stock: 8, minStock: 12, supplierId: 202, unit: 'pcs' },
    { id: 103, name: 'Power bank 10000mAh', sku: 'PWR-022', category: 'Electronics', price: 1450, cost: 980, stock: 21, minStock: 8, supplierId: 201, unit: 'pcs' },
    { id: 104, name: 'USB-C braided cable', sku: 'CBL-008', category: 'Accessories', price: 280, cost: 140, stock: 0, minStock: 15, supplierId: 203, unit: 'pcs' },
    { id: 105, name: 'Laptop stand', sku: 'DSK-003', category: 'Office', price: 920, cost: 610, stock: 17, minStock: 6, supplierId: 202, unit: 'pcs' },
    { id: 106, name: 'Bluetooth speaker mini', sku: 'AUD-019', category: 'Electronics', price: 1250, cost: 820, stock: 5, minStock: 8, supplierId: 203, unit: 'pcs' }
  ],

  suppliers: [
    { id: 201, name: 'Techline Distributors', contact: 'Rahim Uddin', phone: '01712-345678', email: 'sales@techline.example', address: 'Feni Sadar, Feni' },
    { id: 202, name: 'Metro Gadget Supply', contact: 'Nusrat Jahan', phone: '01822-987654', email: 'hello@metrogadget.example', address: 'Chawkbazar, Chattogram' },
    { id: 203, name: 'Nova Accessories', contact: 'Sabbir Hasan', phone: '01911-223344', email: 'orders@nova.example', address: 'Dhaka, Bangladesh' }
  ],

  purchases: [
    { id: 301, productId: 101, supplierId: 201, quantity: 20, unitCost: 1250, date: todayISO(), status: 'Received' },
    { id: 302, productId: 102, supplierId: 202, quantity: 12, unitCost: 390, date: todayISO(), status: 'Received' }
  ],

  sales: [
    { id: 401, productId: 101, quantity: 3, unitPrice: 1850, customer: 'Walk-in customer', date: todayISO(), status: 'Completed' },
    { id: 402, productId: 103, quantity: 2, unitPrice: 1450, customer: 'Online order', date: todayISO(), status: 'Completed' },
    { id: 403, productId: 105, quantity: 1, unitPrice: 920, customer: 'Walk-in customer', date: todayISO(), status: 'Completed' }
  ],

  stockLog: [
    { id: 501, productId: 101, type: 'Purchase', change: 20, date: todayISO(), note: 'Opening stock receipt' },
    { id: 502, productId: 101, type: 'Sale', change: -3, date: todayISO(), note: 'Counter sale' },
    { id: 503, productId: 103, type: 'Sale', change: -2, date: todayISO(), note: 'Online order' }
  ]
};

let db = loadData();
let currentPage = 'dashboard';
let activeSearch = '';
let activeFilter = 'all';
let modalSubmitHandler = null;

// Load saved data
function loadData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (saved) {
      const parsed = JSON.parse(saved);

      if (parsed && Array.isArray(parsed.products) && Array.isArray(parsed.suppliers)) {
        return parsed;
      }
    }
  } catch (error) {
    console.warn('Could not load saved inventory data:', error);
  }

  return structuredClone(seedData);
}

// Save data in browser
function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch (error) {
    toast('Storage is full. Export your data before continuing.', 'error');
  }

  updateGlobalCounts();
}

function nextId(collection) {
  return Math.max(0, ...collection.map(item => Number(item.id) || 0)) + 1;
}

function productById(id) {
  return db.products.find(item => Number(item.id) === Number(id));
}

function supplierById(id) {
  return db.suppliers.find(item => Number(item.id) === Number(id));
}

function productStatus(product) {
  if (Number(product.stock) <= 0) return 'Out of stock';
  if (Number(product.stock) <= Number(product.minStock)) return 'Low stock';
  return 'In stock';
}

function statusClass(status) {
  return ({
    'In stock': 'status-in-stock',
    'Low stock': 'status-low',
    'Out of stock': 'status-out',
    'Received': 'status-completed',
    'Completed': 'status-completed',
    'Pending': 'status-pending',
    'Cancelled': 'status-cancelled'
  })[status] || 'status-active';
}

// Toast notification
function toast(message, type = 'success') {
  const node = document.createElement('div');
  node.className = `toast ${type === 'error' ? 'error' : ''}`;
  node.textContent = message;

  $('#toastRegion').appendChild(node);

  setTimeout(() => node.remove(), 3200);
}

function updateGlobalCounts() {
  $('#productNavCount').textContent = db.products.length;
}

// Navigation
function setPage(page) {
  const pages = [
    'dashboard', 'products', 'stock',
    'suppliers', 'purchase', 'sales', 'reports'
  ];

  currentPage = pages.includes(page) ? page : 'dashboard';

  activeSearch = '';
  activeFilter = 'all';

  $$('.nav-link').forEach(button => {
    button.classList.toggle('active', button.dataset.page === currentPage);
  });

  $('#breadcrumbCurrent').textContent = pageTitle(currentPage);
  $('#sidebar').classList.remove('open');

  renderPage();
}

function pageTitle(page) {
  return ({
    dashboard: 'Dashboard',
    products: 'Products',
    stock: 'Stock management',
    suppliers: 'Suppliers',
    purchase: 'Purchase',
    sales: 'Sales',
    reports: 'Reports'
  })[page] || 'Dashboard';
}

function heading(title, subtitle, buttonLabel = '', buttonAction = '') {
  return `
    <div class="page-heading">
      <div>
        <span class="eyebrow">INVENTORY OVERVIEW</span>
        <h1>${title}</h1>
        <p>${subtitle}</p>
      </div>

      ${buttonLabel ? `
        <button class="button button-primary" data-action="${buttonAction}">
          ${buttonLabel} <span>↗</span>
        </button>
      ` : ''}
    </div>
  `;
}

function renderPage() {
  const pages = {
    dashboard: renderDashboard,
    products: renderProducts,
    stock: renderStock,
    suppliers: renderSuppliers,
    purchase: renderPurchase,
    sales: renderSales,
    reports: renderReports
  };

  $('#pageContent').innerHTML = pages[currentPage]();
  updateGlobalCounts();
}

function statCard(label, value, note, icon, highlight = false, trend = '') {
  return `
    <article class="stat-card ${highlight ? 'highlight' : ''}">
      <div class="stat-top">
        <span>${label}</span>
        <span class="stat-icon">${icon}</span>
      </div>

      <div class="stat-value">${value}</div>

      <div class="stat-foot">
        ${trend ? `<span class="trend">${trend}</span>` : ''}
        <span>${note}</span>
      </div>
    </article>
  `;
}

// Dashboard monthly revenue
function getRevenueByMonth() {
  const now = new Date();

  return Array.from({ length: 6 }, (_, index) => {
    const month = new Date(
      now.getFullYear(),
      now.getMonth() - (5 - index),
      1
    );

    const label = month.toLocaleDateString('en-US', {
      month: 'short'
    });

    const value = db.sales
      .filter(s => {
        const d = new Date(`${s.date}T00:00:00`);

        return (
          d.getMonth() === month.getMonth() &&
          d.getFullYear() === month.getFullYear() &&
          s.status !== 'Cancelled'
        );
      })
      .reduce((sum, s) => sum + s.quantity * s.unitPrice, 0);

    return { label, value };
  });
}

// Dashboard
function renderDashboard() {
  const stockValue = db.products.reduce(
    (sum, p) => sum + p.stock * p.cost, 0
  );

  const salesTotal = db.sales
    .filter(s => s.status !== 'Cancelled')
    .reduce((sum, s) => sum + s.quantity * s.unitPrice, 0);

  const low = db.products.filter(
    p => p.stock > 0 && p.stock <= p.minStock
  ).length;

  const out = db.products.filter(p => p.stock <= 0).length;

  const revenue = getRevenueByMonth();
  const maxRevenue = Math.max(1, ...revenue.map(item => item.value));

  const recentSales = [...db.sales]
    .sort((a, b) => b.id - a.id)
    .slice(0, 5);

  const stockCounts = [
    {
      label: 'Healthy stock',
      value: db.products.filter(p => p.stock > p.minStock).length,
      cls: '',
      count: db.products.filter(p => p.stock > p.minStock).length
    },
    { label: 'Low stock', value: low, cls: 'low', count: low },
    { label: 'Out of stock', value: out, cls: 'out', count: out }
  ];

  const totalProducts = Math.max(1, db.products.length);

  return `
    ${heading(
    'A clearer view of your stock.',
    'Here’s what is happening across your inventory today.',
    '＋ Add product',
    'add-product'
  )}

    <div class="stats-grid">
      ${statCard(
    'TOTAL PRODUCTS',
    number(db.products.length),
    'Unique items in your catalog',
    '◇'
  )}

      ${statCard(
    'STOCK VALUE',
    money(stockValue),
    'Based on purchase cost',
    '▦',
    true,
    '↗'
  )}

      ${statCard(
    'SALES REVENUE',
    money(salesTotal),
    `${db.sales.filter(s => s.status !== 'Cancelled').length} recorded transactions`,
    '↗'
  )}

      ${statCard(
    'NEEDS ATTENTION',
    number(low + out),
    `${low} low · ${out} out of stock`,
    '!',
    false,
    low + out ? 'Review' : 'All clear'
  )}
    </div>

    <div class="dashboard-grid">
      <section class="panel">
        <div class="panel-heading">
          <div>
            <h2>Sales performance</h2>
            <p>Revenue from completed sales · last 6 months</p>
          </div>
          <span class="status status-active">Live data</span>
        </div>

        <div class="chart-area">
          ${revenue.map(item => {
    const height = item.value
      ? Math.max(5, item.value / maxRevenue * 100)
      : 3;

    return `
              <div class="chart-column">
                <div class="chart-bar" style="height:${height * .66}%"></div>
                <div class="chart-bar secondary" style="height:${height}%"></div>
              </div>
            `;
  }).join('')}
        </div>

        <div class="chart-labels">
          ${revenue.map(item => `<span>${item.label}</span>`).join('')}
        </div>
      </section>

      <section class="panel">
        <div class="panel-heading">
          <div>
            <h2>Stock health</h2>
            <p>Product availability at a glance</p>
          </div>
          <button class="link-button" data-action="go-stock">View stock ↗</button>
        </div>

        <div class="stock-health">
          ${stockCounts.map(item => `
            <div>
              <div class="health-row">
                <span class="health-mark ${item.cls}"></span>
                <div class="health-copy">
                  <span>${item.label}</span>
                  <strong>${item.count}</strong>
                </div>
              </div>

              <div class="health-progress">
                <span class="${item.cls}" style="width:${item.value / totalProducts * 100}%"></span>
              </div>
            </div>
          `).join('')}
        </div>

        <div class="inline-note" style="margin-top:20px">
          ${low + out
      ? `${low + out} product${low + out > 1 ? 's need' : ' needs'} a restock check. Review stock levels before your next sale.`
      : 'Everything looks healthy. Your products are above their minimum stock levels.'
    }
        </div>
      </section>
    </div>

    <div class="bottom-grid">
      <section class="panel">
        <div class="panel-heading">
          <div>
            <h2>Recent transactions</h2>
            <p>Your latest sales activity</p>
          </div>
          <button class="link-button" data-action="go-sales">All sales ↗</button>
        </div>

        ${recentSales.length ? `
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>PRODUCT</th>
                  <th>CUSTOMER</th>
                  <th>DATE</th>
                  <th>AMOUNT</th>
                </tr>
              </thead>

              <tbody>
                ${recentSales.map(s => {
      const p = productById(s.productId);

      return `
                    <tr>
                      <td><strong>${escapeHTML(p?.name || 'Deleted product')}</strong></td>
                      <td>${escapeHTML(s.customer)}</td>
                      <td>${dateLabel(s.date)}</td>
                      <td><strong>${money(s.quantity * s.unitPrice)}</strong></td>
                    </tr>
                  `;
    }).join('')}
              </tbody>
            </table>
          </div>
        ` : `
          <div class="empty-state">
            <strong>No transactions yet</strong>
            Your sales will appear here.
          </div>
        `}
      </section>

      <section class="panel">
        <div class="panel-heading">
          <div>
            <h2>Activity feed</h2>
            <p>Latest stock movements</p>
          </div>
          <button class="link-button" data-action="go-stock">View log ↗</button>
        </div>

        <div class="activity-list">
          ${[...db.stockLog]
      .sort((a, b) => b.id - a.id)
      .slice(0, 4)
      .map(log => {
        const p = productById(log.productId);

        return `
                <div class="activity-item">
                  <div class="activity-symbol ${log.change < 0 ? 'sale' : ''}">
                    ${log.change < 0 ? '↗' : '↙'}
                  </div>

                  <div class="activity-text">
                    <strong>${escapeHTML(p?.name || 'Product')}</strong>
                    ${log.change < 0 ? 'sold' : 'stock added'} ·
                    ${log.change > 0 ? '+' : ''}${log.change}
                    ${escapeHTML(p?.unit || 'pcs')}

                    <time>
                      ${dateLabel(log.date)} · ${escapeHTML(log.note || log.type)}
                    </time>
                  </div>
                </div>
              `;
      }).join('') || '<div class="empty-state">No stock activity yet.</div>'
    }
        </div>
      </section>
    </div>
  `;
}

// Search and filter toolbar
function toolbar(searchPlaceholder, filterOptions = [], extra = '') {
  return `
    <div class="toolbar">
      <div class="toolbar-left">
        <div class="search-box">
          <span>⌕</span>
          <input
            id="tableSearch"
            type="search"
            placeholder="${searchPlaceholder}"
            value="${escapeHTML(activeSearch)}"
          />
        </div>

        ${filterOptions.length ? `
          <select class="filter-select" id="tableFilter">
            <option value="all">All categories</option>
            ${filterOptions.map(opt => `
              <option value="${escapeHTML(opt)}" ${activeFilter === opt ? 'selected' : ''}>
                ${escapeHTML(opt)}
              </option>
            `).join('')}
          </select>
        ` : ''}
      </div>

      <div class="toolbar-right">${extra}</div>
    </div>
  `;
}

// Reusable data table
function tableShell(headers, rows, label) {
  return `
    <section class="panel data-panel">
      <div class="table-wrap">
        <table>
          <thead>
            <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
          </thead>

          <tbody>
            ${rows || `
              <tr>
                <td colspan="${headers.length}">
                  <div class="empty-state">
                    <strong>No ${label} found</strong>
                    Try adjusting your search or add a new record.
                  </div>
                </td>
              </tr>
            `}
          </tbody>
        </table>
      </div>

      <div class="table-footer">
        <span>Showing ${rows ? (rows.match(/<tr/g) || []).length : 0} ${label}</span>
        <div class="pagination">
          <span class="page-number active">1</span>
        </div>
      </div>
    </section>
  `;
}

function productRows(products) {
  return products.map(p => `
    <tr>
      <td>
        <div class="product-cell">
          <div class="product-thumb">${categoryIcon(p.category)}</div>

          <div class="product-meta">
            <strong>${escapeHTML(p.name)}</strong>
            <small>${escapeHTML(p.sku)}</small>
          </div>
        </div>
      </td>

      <td>${escapeHTML(p.category)}</td>
      <td>${number(p.stock)} ${escapeHTML(p.unit)}</td>
      <td>${money(p.cost)}</td>
      <td>${money(p.price)}</td>

      <td>
        <span class="status ${statusClass(productStatus(p))}">
          ${productStatus(p)}
        </span>
      </td>

      <td>
        <div class="action-group">
          <button class="table-action" title="Edit" data-action="edit-product" data-id="${p.id}">✎</button>
          <button class="table-action delete" title="Delete" data-action="delete-product" data-id="${p.id}">×</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function categoryIcon(category) {
  return ({
    Electronics: '⌁',
    Accessories: '◇',
    Office: '▤',
    Clothing: '✳',
    Food: '◉'
  })[category] || '◈';
}

// Products page
function renderProducts() {
  const filtered = db.products.filter(p =>
    `${p.name} ${p.sku} ${p.category}`
      .toLowerCase()
      .includes(activeSearch.toLowerCase()) &&
    (activeFilter === 'all' || p.category === activeFilter)
  );

  return `
    ${heading(
    'Products',
    'Manage your catalog, pricing and product details.',
    '＋ Add product',
    'add-product'
  )}

    ${toolbar(
    'Search by name, SKU or category',
    [...new Set(db.products.map(p => p.category))],
    '<button class="button button-quiet" data-action="export-products">↓ Export CSV</button>'
  )}

    ${tableShell(
    ['PRODUCT', 'CATEGORY', 'ON HAND', 'COST PRICE', 'SELLING PRICE', 'STATUS', 'ACTIONS'],
    productRows(filtered),
    'products'
  )}
  `;
}

// Stock management page
function renderStock() {
  const filtered = db.products.filter(p =>
    `${p.name} ${p.sku}`
      .toLowerCase()
      .includes(activeSearch.toLowerCase()) &&
    (
      activeFilter === 'all' ||
      (activeFilter === 'low' && p.stock > 0 && p.stock <= p.minStock) ||
      (activeFilter === 'out' && p.stock <= 0) ||
      (activeFilter === 'healthy' && p.stock > p.minStock)
    )
  );

  const low = db.products.filter(
    p => p.stock > 0 && p.stock <= p.minStock
  ).length;

  const out = db.products.filter(p => p.stock <= 0).length;

  const rows = filtered.map(p => `
    <tr>
      <td>
        <div class="product-meta">
          <strong>${escapeHTML(p.name)}</strong>
          <small>${escapeHTML(p.sku)}</small>
        </div>
      </td>

      <td><strong>${number(p.stock)} ${escapeHTML(p.unit)}</strong></td>
      <td>${number(p.minStock)} ${escapeHTML(p.unit)}</td>

      <td>
        <span class="status ${statusClass(productStatus(p))}">
          ${productStatus(p)}
        </span>
      </td>

      <td>${escapeHTML(supplierById(p.supplierId)?.name || '—')}</td>

      <td>
        <button class="button button-quiet button-small"
          data-action="adjust-stock" data-id="${p.id}">
          Adjust stock
        </button>
      </td>
    </tr>
  `).join('');

  const logRows = [...db.stockLog]
    .sort((a, b) => b.id - a.id)
    .slice(0, 8)
    .map(log => `
      <tr>
        <td>${dateLabel(log.date)}</td>
        <td><strong>${escapeHTML(productById(log.productId)?.name || 'Deleted product')}</strong></td>
        <td>${escapeHTML(log.type)}</td>
        <td>
          <strong style="color:${log.change < 0 ? '#c47768' : '#5b9665'}">
            ${log.change > 0 ? '+' : ''}${log.change}
          </strong>
        </td>
        <td>${escapeHTML(log.note || '—')}</td>
      </tr>
    `).join('');

  return `
    ${heading(
    'Stock management',
    'Keep quantities accurate and catch low stock early.',
    '＋ Adjust stock',
    'adjust-stock'
  )}

    <div class="kpi-strip">
      <div class="mini-kpi">
        <span>Products tracked</span>
        <strong>${number(db.products.length)}</strong>
      </div>

      <div class="mini-kpi">
        <span>Low stock alerts</span>
        <strong>${number(low)}</strong>
      </div>

      <div class="mini-kpi">
        <span>Out of stock</span>
        <strong>${number(out)}</strong>
      </div>
    </div>

    ${toolbar(
    'Search products or SKU',
    [],
    `
        <select class="filter-select" id="tableFilter">
          <option value="all">All stock levels</option>
          <option value="low" ${activeFilter === 'low' ? 'selected' : ''}>Low stock</option>
          <option value="out" ${activeFilter === 'out' ? 'selected' : ''}>Out of stock</option>
          <option value="healthy" ${activeFilter === 'healthy' ? 'selected' : ''}>Healthy</option>
        </select>
      `
  )}

    ${tableShell(
    ['PRODUCT', 'CURRENT QTY', 'REORDER LEVEL', 'STATUS', 'PREFERRED SUPPLIER', 'ACTION'],
    rows,
    'products'
  )}

    <div style="height:15px"></div>

    <section class="panel">
      <div class="panel-heading">
        <div>
          <h2>Stock movement history</h2>
          <p>Recent purchase, sale and manual adjustments</p>
        </div>

        <button class="link-button" data-action="export-stock">Export log ↓</button>
      </div>

      ${db.stockLog.length ? `
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>DATE</th>
                <th>PRODUCT</th>
                <th>TYPE</th>
                <th>CHANGE</th>
                <th>NOTE</th>
              </tr>
            </thead>
            <tbody>${logRows}</tbody>
          </table>
        </div>
      ` : '<div class="empty-state">No stock movement recorded yet.</div>'}
    </section>
  `;
}

// Suppliers page
function renderSuppliers() {
  const filtered = db.suppliers.filter(s =>
    `${s.name} ${s.contact} ${s.phone} ${s.email}`
      .toLowerCase()
      .includes(activeSearch.toLowerCase())
  );

  const rows = filtered.map(s => `
    <tr>
      <td>
        <div class="product-cell">
          <div class="product-thumb">♧</div>
          <div class="product-meta">
            <strong>${escapeHTML(s.name)}</strong>
            <small>${escapeHTML(s.address || 'No address')}</small>
          </div>
        </div>
      </td>

      <td>${escapeHTML(s.contact)}</td>
      <td>${escapeHTML(s.phone)}</td>
      <td>${escapeHTML(s.email || '—')}</td>
      <td>${db.products.filter(p => p.supplierId === s.id).length} items</td>

      <td>
        <div class="action-group">
          <button class="table-action" title="Edit" data-action="edit-supplier" data-id="${s.id}">✎</button>
          <button class="table-action delete" title="Delete" data-action="delete-supplier" data-id="${s.id}">×</button>
        </div>
      </td>
    </tr>
  `).join('');

  return `
    ${heading(
    'Suppliers',
    'Build stronger relationships with the people who keep you stocked.',
    '＋ Add supplier',
    'add-supplier'
  )}

    ${toolbar(
    'Search suppliers, contact or phone',
    [],
    '<button class="button button-quiet" data-action="export-suppliers">↓ Export CSV</button>'
  )}

    ${tableShell(
    ['SUPPLIER', 'CONTACT PERSON', 'PHONE', 'EMAIL', 'PRODUCTS', 'ACTIONS'],
    rows,
    'suppliers'
  )}
  `;
}

// Purchase page
function renderPurchase() {
  const filteredPurchases = [...db.purchases]
    .sort((a, b) => b.id - a.id)
    .filter(p => {
      const productName = productById(p.productId)?.name || '';
      const supplierName = supplierById(p.supplierId)?.name || '';

      return `${p.id} ${productName} ${supplierName} ${p.date} ${p.status}`
        .toLowerCase()
        .includes(activeSearch.toLowerCase());
    });

  const rows = filteredPurchases.map(p => `
    <tr>
      <td><strong>#PO-${p.id}</strong></td>
      <td>${escapeHTML(productById(p.productId)?.name || 'Deleted product')}</td>
      <td>${escapeHTML(supplierById(p.supplierId)?.name || '—')}</td>
      <td>${number(p.quantity)}</td>
      <td>${money(p.unitCost)}</td>
      <td><strong>${money(p.quantity * p.unitCost)}</strong></td>
      <td>${dateLabel(p.date)}</td>
      <td>
        <span class="status ${statusClass(p.status)}">
          ${escapeHTML(p.status)}
        </span>
      </td>
    </tr>
  `).join('');

  const total = db.purchases.reduce(
    (sum, p) => sum + p.quantity * p.unitCost, 0
  );

  return `
    ${heading(
    'Purchase orders',
    'Record incoming products and keep your stock up to date.',
    '＋ New purchase',
    'add-purchase'
  )}

    <div class="kpi-strip">
      <div class="mini-kpi">
        <span>Total purchase records</span>
        <strong>${number(db.purchases.length)}</strong>
      </div>

      <div class="mini-kpi">
        <span>Total purchase value</span>
        <strong>${money(total)}</strong>
      </div>

      <div class="mini-kpi">
        <span>Units purchased</span>
        <strong>${number(db.purchases.reduce((s, p) => s + p.quantity, 0))}</strong>
      </div>
    </div>

    ${toolbar(
    'Search purchase records',
    [],
    '<button class="button button-quiet" data-action="export-purchases">↓ Export CSV</button>'
  )}

    ${tableShell(
    ['ORDER ID', 'PRODUCT', 'SUPPLIER', 'QUANTITY', 'UNIT COST', 'TOTAL', 'DATE', 'STATUS'],
    rows,
    'purchase records'
  )}
  `;
}

// Sales page
function renderSales() {
  const filtered = [...db.sales]
    .sort((a, b) => b.id - a.id)
    .filter(s =>
      `${productById(s.productId)?.name || ''} ${s.customer} ${s.id}`
        .toLowerCase()
        .includes(activeSearch.toLowerCase())
    );

  const rows = filtered.map(s => `
    <tr>
      <td><strong>#SL-${s.id}</strong></td>
      <td>${escapeHTML(productById(s.productId)?.name || 'Deleted product')}</td>
      <td>${escapeHTML(s.customer)}</td>
      <td>${number(s.quantity)}</td>
      <td>${money(s.unitPrice)}</td>
      <td><strong>${money(s.quantity * s.unitPrice)}</strong></td>
      <td>${dateLabel(s.date)}</td>

      <td>
        <span class="status ${statusClass(s.status)}">
          ${escapeHTML(s.status)}
        </span>
      </td>

      <td>
        <button class="table-action delete"
          title="Delete sale"
          data-action="delete-sale"
          data-id="${s.id}">×</button>
      </td>
    </tr>
  `).join('');

  const revenue = db.sales
    .filter(s => s.status !== 'Cancelled')
    .reduce((sum, s) => sum + s.quantity * s.unitPrice, 0);

  return `
    ${heading(
    'Sales',
    'Track outgoing orders, customers and revenue.',
    '＋ Record sale',
    'add-sale'
  )}

    <div class="kpi-strip">
      <div class="mini-kpi">
        <span>Sales transactions</span>
        <strong>${number(db.sales.filter(s => s.status !== 'Cancelled').length)}</strong>
      </div>

      <div class="mini-kpi">
        <span>Total revenue</span>
        <strong>${money(revenue)}</strong>
      </div>

      <div class="mini-kpi">
        <span>Units sold</span>
        <strong>${number(db.sales.filter(s => s.status !== 'Cancelled').reduce((sum, s) => sum + s.quantity, 0))}</strong>
      </div>
    </div>

    ${toolbar(
    'Search sales, customer or ID',
    [],
    '<button class="button button-quiet" data-action="export-sales">↓ Export CSV</button>'
  )}

    ${tableShell(
    ['SALE ID', 'PRODUCT', 'CUSTOMER', 'QTY', 'UNIT PRICE', 'TOTAL', 'DATE', 'STATUS', 'ACTION'],
    rows,
    'sales'
  )}
  `;
}

// Reports page
function renderReports() {
  const revenue = db.sales
    .filter(s => s.status !== 'Cancelled')
    .reduce((sum, s) => sum + s.quantity * s.unitPrice, 0);

  const purchaseCost = db.purchases.reduce(
    (sum, p) => sum + p.quantity * p.unitCost, 0
  );

  const grossProfit = db.sales
    .filter(s => s.status !== 'Cancelled')
    .reduce((sum, s) => {
      const product = productById(s.productId);
      return sum + s.quantity * (s.unitPrice - (product?.cost || 0));
    }, 0);

  const topProducts = [...db.products]
    .map(p => ({
      ...p,
      sold: db.sales
        .filter(s => s.productId === p.id && s.status !== 'Cancelled')
        .reduce((sum, s) => sum + s.quantity, 0)
    }))
    .sort((a, b) => b.sold - a.sold)
    .slice(0, 5);

  const maxSold = Math.max(1, ...topProducts.map(p => p.sold));

  const healthyCount = db.products.filter(
    p => p.stock > p.minStock
  ).length;

  const low = db.products.filter(
    p => p.stock > 0 && p.stock <= p.minStock
  ).length;

  const out = db.products.filter(p => p.stock <= 0).length;

  const healthyPct = db.products.length
    ? healthyCount / db.products.length * 100
    : 0;

  const lowPct = db.products.length
    ? (healthyCount + low) / db.products.length * 100
    : 0;

  return `
    ${heading(
    'Reports & insights',
    'A quick read on business performance and inventory health.',
    '↓ Export all data',
    'export-all'
  )}

    <div class="stats-grid">
      ${statCard('TOTAL REVENUE', money(revenue), 'Completed sales value', '↗')}
      ${statCard('EST. GROSS PROFIT', money(grossProfit), 'Revenue less current product cost', '✳', true)}
      ${statCard('PURCHASE VALUE', money(purchaseCost), 'Recorded purchase cost', '↙')}
      ${statCard('PRODUCTS TO RESTOCK', number(low + out), `${low} low · ${out} out`, '!')}
    </div>

    <div class="report-grid">
      <section class="report-card">
        <h3>Top products by units sold</h3>
        <p>Based on completed sales records</p>

        <div class="report-bars">
          ${topProducts.map(p => `
            <div class="report-bar-wrap">
              <div class="report-bar"
                title="${escapeHTML(p.name)}: ${p.sold} sold"
                style="height:${p.sold / maxSold * 100}%"></div>
            </div>
          `).join('')}
        </div>

        <div class="report-labels">
          ${topProducts.map(p => `
            <span>${escapeHTML(p.name.length > 10 ? p.name.slice(0, 10) + '…' : p.name)}</span>
          `).join('')}
        </div>
      </section>

      <section class="report-card">
        <h3>Inventory health distribution</h3>
        <p>How your current catalog is looking</p>

        <div class="donut-wrap">
          <div class="donut" style="background:conic-gradient(#83a980 0 ${healthyPct}%, #e5b775 ${healthyPct}% ${lowPct}%, #e2e8df ${lowPct}% 100%)"></div>

          <div class="legend">
            <span><i></i> Healthy · ${healthyCount}</span>
            <span><i></i> Low stock · ${low}</span>
            <span><i style="background:#e2e8df"></i> Out of stock · ${out}</span>
          </div>
        </div>
      </section>
    </div>

    <div style="height:15px"></div>

    <section class="panel">
      <div class="panel-heading">
        <div>
          <h2>Inventory valuation</h2>
          <p>Current stock quantity × purchase cost</p>
        </div>

        <button class="link-button" data-action="export-products">
          Export products ↓
        </button>
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>PRODUCT</th>
              <th>QUANTITY</th>
              <th>UNIT COST</th>
              <th>STOCK VALUE</th>
              <th>STATUS</th>
            </tr>
          </thead>

          <tbody>
            ${db.products.map(p => `
              <tr>
                <td><strong>${escapeHTML(p.name)}</strong></td>
                <td>${number(p.stock)}</td>
                <td>${money(p.cost)}</td>
                <td><strong>${money(p.stock * p.cost)}</strong></td>
                <td>
                  <span class="status ${statusClass(productStatus(p))}">
                    ${productStatus(p)}
                  </span>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

// Modal system
function openModal({
  title,
  eyebrow = 'WORKSPACE',
  body,
  submit = 'Save changes',
  onSubmit
}) {
  $('#modalTitle').textContent = title;
  $('#modalEyebrow').textContent = eyebrow;
  $('#modalBody').innerHTML = body;
  $('#modalSubmit').innerHTML = `${submit} <span>↗</span>`;

  modalSubmitHandler = onSubmit;

  $('#modalBackdrop').classList.add('open');
  $('#modalBackdrop').setAttribute('aria-hidden', 'false');

  setTimeout(() => $('#modalBody input, #modalBody select')?.focus(), 40);
}

function closeModal() {
  $('#modalBackdrop').classList.remove('open');
  $('#modalBackdrop').setAttribute('aria-hidden', 'true');
  $('#modalForm').reset();
  modalSubmitHandler = null;
}

// Reusable form field
function field(
  name,
  label,
  value = '',
  type = 'text',
  options = null,
  required = true,
  full = false,
  placeholder = ''
) {
  const control = options
    ? `
      <select name="${name}" ${required ? 'required' : ''}>
        ${options.map(o => `
          <option value="${escapeHTML(o.value)}"
            ${String(o.value) === String(value) ? 'selected' : ''}>
            ${escapeHTML(o.label)}
          </option>
        `).join('')}
      </select>
    `
    : `
      <input
        name="${name}"
        type="${type}"
        value="${escapeHTML(value)}"
        ${required ? 'required' : ''}
        ${placeholder ? `placeholder="${placeholder}"` : ''}
        ${type === 'number' ? 'min="0" step="any"' : ''}
      />
    `;

  return `
    <div class="field ${full ? 'full' : ''}">
      <label>${label}${required ? ' *' : ''}</label>
      ${control}
    </div>
  `;
}

// Product form
function productForm(product = {}) {
  const isEdit = Boolean(product.id);

  const supplierOptions = [
    { value: '', label: 'No preferred supplier' },
    ...db.suppliers.map(s => ({ value: s.id, label: s.name }))
  ];

  return `
    <div class="form-grid">
      ${field('name', 'Product name', product.name || '')}
      ${field('sku', 'SKU / product code', product.sku || '')}

      ${field(
    'category',
    'Category',
    product.category || 'Electronics',
    'text',
    ['Electronics', 'Accessories', 'Office', 'Clothing', 'Food', 'Other']
      .map(x => ({ value: x, label: x }))
  )}

      ${field(
    'unit',
    'Unit',
    product.unit || 'pcs',
    'text',
    [
      { value: 'pcs', label: 'Pieces (pcs)' },
      { value: 'box', label: 'Box' },
      { value: 'kg', label: 'Kilogram (kg)' },
      { value: 'pack', label: 'Pack' },
      { value: 'set', label: 'Set' }
    ]
  )}

      ${field('cost', 'Cost price (BDT)', product.cost ?? '', 'number')}
      ${field('price', 'Selling price (BDT)', product.price ?? '', 'number')}
      ${field('stock', 'Current quantity', product.stock ?? 0, 'number')}
      ${field('minStock', 'Minimum stock alert', product.minStock ?? 5, 'number')}

      ${field(
    'supplierId',
    'Preferred supplier',
    product.supplierId ?? '',
    'text',
    supplierOptions,
    false,
    true
  )}

      ${!isEdit ? `
        <div class="field-hint full">
          New products start with the quantity entered above.
          Use Stock management for later adjustments.
        </div>
      ` : ''}
    </div>
  `;
}

// Add or edit product
function addProduct(product = null) {
  openModal({
    title: product ? 'Edit product' : 'Add a product',
    eyebrow: 'PRODUCT CATALOG',
    body: productForm(product || {}),
    submit: product ? 'Update product' : 'Add product',

    onSubmit: data => {
      const payload = {
        name: data.name.trim(),
        sku: data.sku.trim(),
        category: data.category,
        unit: data.unit,
        cost: Number(data.cost),
        price: Number(data.price),
        stock: Number(data.stock),
        minStock: Number(data.minStock),
        supplierId: data.supplierId ? Number(data.supplierId) : null
      };

      if (
        !payload.name ||
        !payload.sku ||
        Object.values(payload).some(v =>
          typeof v === 'number' && (!Number.isFinite(v) || v < 0)
        )
      ) {
        return toast('Please enter valid product details.', 'error');
      }

      const duplicate = db.products.some(p =>
        p.sku.toLowerCase() === payload.sku.toLowerCase() &&
        p.id !== product?.id
      );

      if (duplicate) {
        return toast('This SKU already exists. Use a unique product code.', 'error');
      }

      if (product) {
        Object.assign(product, payload);
      } else {
        const record = { id: nextId(db.products), ...payload };
        db.products.push(record);

        if (payload.stock) {
          db.stockLog.push({
            id: nextId(db.stockLog),
            productId: record.id,
            type: 'Opening stock',
            change: payload.stock,
            date: todayISO(),
            note: 'Initial quantity'
          });
        }
      }

      saveData();
      closeModal();
      renderPage();

      toast(product ? 'Product updated successfully.' : 'Product added to your catalog.');
    }
  });
}

// Add or edit supplier
function addSupplier(supplier = null) {
  openModal({
    title: supplier ? 'Edit supplier' : 'Add a supplier',
    eyebrow: 'SUPPLIER DIRECTORY',

    body: `
      <div class="form-grid">
        ${field('name', 'Supplier / company name', supplier?.name || '')}
        ${field('contact', 'Contact person', supplier?.contact || '')}
        ${field('phone', 'Phone number', supplier?.phone || '', 'tel')}
        ${field('email', 'Email address', supplier?.email || '', 'email', null, false)}
        ${field('address', 'Business address', supplier?.address || '', 'text', null, false, true)}
      </div>
    `,

    submit: supplier ? 'Update supplier' : 'Add supplier',

    onSubmit: data => {
      const payload = {
        name: data.name.trim(),
        contact: data.contact.trim(),
        phone: data.phone.trim(),
        email: data.email.trim(),
        address: data.address.trim()
      };

      if (!payload.name || !payload.contact || !payload.phone) {
        return toast('Name, contact person and phone are required.', 'error');
      }

      if (supplier) {
        Object.assign(supplier, payload);
      } else {
        db.suppliers.push({
          id: nextId(db.suppliers),
          ...payload
        });
      }

      saveData();
      closeModal();
      renderPage();

      toast(supplier ? 'Supplier updated.' : 'Supplier added successfully.');
    }
  });
}

// New purchase
function addPurchase() {
  if (!db.products.length || !db.suppliers.length) {
    return toast('Add at least one product and one supplier first.', 'error');
  }

  const productOptions = db.products.map(p => ({
    value: p.id,
    label: `${p.name} (${p.stock} ${p.unit} in stock)`
  }));

  const supplierOptions = db.suppliers.map(s => ({
    value: s.id,
    label: s.name
  }));

  openModal({
    title: 'Record a purchase',
    eyebrow: 'INCOMING STOCK',
    submit: 'Save purchase',

    body: `
      <div class="form-grid">
        ${field('productId', 'Product', productOptions[0].value, 'text', productOptions)}
        ${field('supplierId', 'Supplier', supplierOptions[0].value, 'text', supplierOptions)}
        ${field('quantity', 'Quantity received', 1, 'number')}
        ${field('unitCost', 'Unit purchase cost (BDT)', productById(productOptions[0].value)?.cost || 0, 'number')}
        ${field('date', 'Purchase date', todayISO(), 'date', null, true, true)}

        <div class="inline-note full">
          Saving this purchase automatically adds the received quantity to the selected product’s stock.
        </div>
      </div>
    `,

    onSubmit: data => {
      const product = productById(data.productId);
      const qty = Number(data.quantity);
      const cost = Number(data.unitCost);

      if (
        !product ||
        !supplierById(data.supplierId) ||
        !Number.isInteger(qty) ||
        qty <= 0 ||
        !Number.isFinite(cost) ||
        cost < 0
      ) {
        return toast('Check product, supplier, quantity and cost.', 'error');
      }

      product.stock += qty;
      product.cost = cost;
      product.supplierId = Number(data.supplierId);

      db.purchases.push({
        id: nextId(db.purchases),
        productId: product.id,
        supplierId: Number(data.supplierId),
        quantity: qty,
        unitCost: cost,
        date: data.date,
        status: 'Received'
      });

      db.stockLog.push({
        id: nextId(db.stockLog),
        productId: product.id,
        type: 'Purchase',
        change: qty,
        date: data.date,
        note: 'Purchase received'
      });

      saveData();
      closeModal();
      renderPage();

      toast('Purchase saved and stock updated.');
    }
  });
}

// New sale
function addSale() {
  const available = db.products.filter(p => p.stock > 0);

  if (!available.length) {
    return toast('No products are currently available to sell.', 'error');
  }

  const opts = available.map(p => ({
    value: p.id,
    label: `${p.name} · ${p.stock} available`
  }));

  openModal({
    title: 'Record a sale',
    eyebrow: 'OUTGOING STOCK',
    submit: 'Complete sale',

    body: `
      <div class="form-grid">
        ${field('productId', 'Product', opts[0].value, 'text', opts)}
        ${field('quantity', 'Quantity sold', 1, 'number')}
        ${field('unitPrice', 'Unit selling price (BDT)', productById(opts[0].value)?.price || 0, 'number')}
        ${field('customer', 'Customer / order name', 'Walk-in customer', 'text', null, true, true)}
        ${field('date', 'Sale date', todayISO(), 'date', null, true, true)}

        <div class="inline-note full">
          The sale quantity will be deducted from stock.
          A sale cannot be completed if there is not enough stock.
        </div>
      </div>
    `,

    onSubmit: data => {
      const product = productById(data.productId);
      const qty = Number(data.quantity);
      const price = Number(data.unitPrice);

      if (
        !product ||
        !Number.isInteger(qty) ||
        qty <= 0 ||
        qty > product.stock ||
        !Number.isFinite(price) ||
        price < 0
      ) {
        return toast('Invalid quantity or price. Check available stock.', 'error');
      }

      product.stock -= qty;

      db.sales.push({
        id: nextId(db.sales),
        productId: product.id,
        quantity: qty,
        unitPrice: price,
        customer: data.customer.trim() || 'Walk-in customer',
        date: data.date,
        status: 'Completed'
      });

      db.stockLog.push({
        id: nextId(db.stockLog),
        productId: product.id,
        type: 'Sale',
        change: -qty,
        date: data.date,
        note: `Sale to ${data.customer.trim() || 'Walk-in customer'}`
      });

      saveData();
      closeModal();
      renderPage();

      toast('Sale completed and stock deducted.');
    }
  });
}

// Manual stock adjustment
function adjustStock(product = null) {
  if (!db.products.length) {
    return toast('Add a product before adjusting stock.', 'error');
  }

  const options = db.products.map(p => ({
    value: p.id,
    label: `${p.name} · Current: ${p.stock}`
  }));

  openModal({
    title: 'Adjust stock quantity',
    eyebrow: 'STOCK CONTROL',
    submit: 'Save adjustment',

    body: `
      <div class="form-grid">
        ${field('productId', 'Product', product?.id || options[0].value, 'text', options, true, true)}

        ${field(
      'direction',
      'Adjustment type',
      'add',
      'text',
      [
        { value: 'add', label: 'Add stock' },
        { value: 'remove', label: 'Remove stock' },
        { value: 'set', label: 'Set exact quantity' }
      ],
      true,
      true
    )}

        ${field('quantity', 'Quantity', 1, 'number', null, true, true)}
        ${field('date', 'Adjustment date', todayISO(), 'date', null, true, true)}
        ${field('note', 'Reason / note', '', 'text', null, false, true)}

        <div class="inline-note full">
          Manual stock adjustments are saved in the movement history so changes remain traceable.
        </div>
      </div>
    `,

    onSubmit: data => {
      const target = productById(data.productId);
      const qty = Number(data.quantity);

      if (
        !target ||
        !Number.isInteger(qty) ||
        qty < 0 ||
        (data.direction !== 'set' && qty === 0)
      ) {
        return toast('Enter a valid quantity.', 'error');
      }

      const old = target.stock;

      const updated = data.direction === 'add'
        ? old + qty
        : data.direction === 'remove'
          ? old - qty
          : qty;

      if (updated < 0) {
        return toast('Stock cannot be lower than zero.', 'error');
      }

      target.stock = updated;

      const diff = updated - old;

      if (diff) {
        db.stockLog.push({
          id: nextId(db.stockLog),
          productId: target.id,
          type: 'Adjustment',
          change: diff,
          date: data.date,
          note: data.note.trim() || 'Manual adjustment'
        });
      }

      saveData();
      closeModal();
      renderPage();

      toast('Stock quantity updated.');
    }
  });
}

// Delete confirmation
function confirmDelete(message, callback) {
  if (window.confirm(message)) callback();
}

function deleteProduct(id) {
  const p = productById(id);
  if (!p) return;

  confirmDelete(
    `Delete “${p.name}”? Historical sales and purchases will remain, but the product record will be removed.`,
    () => {
      db.products = db.products.filter(x => x.id !== id);

      saveData();
      renderPage();

      toast('Product deleted.');
    }
  );
}

function deleteSupplier(id) {
  const s = supplierById(id);
  if (!s) return;

  if (db.products.some(p => p.supplierId === id)) {
    return toast(
      'This supplier is assigned to products. Change those suppliers before deleting.',
      'error'
    );
  }

  confirmDelete(
    `Delete supplier “${s.name}”?`,
    () => {
      db.suppliers = db.suppliers.filter(x => x.id !== id);

      saveData();
      renderPage();

      toast('Supplier deleted.');
    }
  );
}

function deleteSale(id) {
  const sale = db.sales.find(s => s.id === id);
  if (!sale) return;

  confirmDelete(
    'Delete this sale and return its quantity to stock?',
    () => {
      const p = productById(sale.productId);

      if (p) p.stock += sale.quantity;

      db.stockLog.push({
        id: nextId(db.stockLog),
        productId: sale.productId,
        type: 'Sale reversal',
        change: sale.quantity,
        date: todayISO(),
        note: 'Deleted sale returned to stock'
      });

      db.sales = db.sales.filter(s => s.id !== id);

      saveData();
      renderPage();

      toast('Sale deleted and stock restored.');
    }
  );
}

// CSV export
function exportCSV(filename, rows) {
  if (!rows.length) {
    return toast('There is no data to export.', 'error');
  }

  const csv = rows.map(row =>
    row.map(value =>
      `"${String(value ?? '').replace(/"/g, '""')}"`
    ).join(',')
  ).join('\r\n');

  const blob = new Blob(['\ufeff' + csv], {
    type: 'text/csv;charset=utf-8;'
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');

  a.href = url;
  a.download = filename;
  a.click();

  URL.revokeObjectURL(url);

  toast(`${filename} exported.`);
}

function exportProducts() {
  exportCSV('stockroom-products.csv', [
    ['Name', 'SKU', 'Category', 'Quantity', 'Unit', 'Cost price', 'Selling price', 'Minimum stock', 'Status'],
    ...db.products.map(p => [
      p.name, p.sku, p.category, p.stock, p.unit,
      p.cost, p.price, p.minStock, productStatus(p)
    ])
  ]);
}

function exportSuppliers() {
  exportCSV('stockroom-suppliers.csv', [
    ['Supplier', 'Contact', 'Phone', 'Email', 'Address'],
    ...db.suppliers.map(s => [
      s.name, s.contact, s.phone, s.email, s.address
    ])
  ]);
}

function exportPurchases() {
  exportCSV('stockroom-purchases.csv', [
    ['Order ID', 'Product', 'Supplier', 'Quantity', 'Unit cost', 'Total', 'Date', 'Status'],
    ...db.purchases.map(p => [
      p.id,
      productById(p.productId)?.name,
      supplierById(p.supplierId)?.name,
      p.quantity,
      p.unitCost,
      p.quantity * p.unitCost,
      p.date,
      p.status
    ])
  ]);
}

function exportSales() {
  exportCSV('stockroom-sales.csv', [
    ['Sale ID', 'Product', 'Customer', 'Quantity', 'Unit price', 'Total', 'Date', 'Status'],
    ...db.sales.map(s => [
      s.id,
      productById(s.productId)?.name,
      s.customer,
      s.quantity,
      s.unitPrice,
      s.quantity * s.unitPrice,
      s.date,
      s.status
    ])
  ]);
}

function exportStock() {
  exportCSV('stockroom-stock-movements.csv', [
    ['Date', 'Product', 'Type', 'Change', 'Note'],
    ...db.stockLog.map(l => [
      l.date,
      productById(l.productId)?.name,
      l.type,
      l.change,
      l.note
    ])
  ]);
}

function exportAll() {
  exportCSV('stockroom-inventory-summary.csv', [
    ['Section', 'Name / ID', 'Details', 'Quantity', 'Value / Note'],

    ...db.products.map(p => [
      'Product', p.name, p.sku, p.stock, p.stock * p.cost
    ]),

    ...db.suppliers.map(s => [
      'Supplier', s.name, s.phone, '', s.email
    ]),

    ...db.sales.map(s => [
      'Sale', `SL-${s.id}`, productById(s.productId)?.name,
      s.quantity, s.quantity * s.unitPrice
    ]),

    ...db.purchases.map(p => [
      'Purchase', `PO-${p.id}`, productById(p.productId)?.name,
      p.quantity, p.quantity * p.unitCost
    ])
  ]);
}

// All button actions
function handleAction(action, id) {
  switch (action) {
    case 'add-product':
      addProduct();
      break;

    case 'edit-product':
      addProduct(productById(Number(id)));
      break;

    case 'delete-product':
      deleteProduct(Number(id));
      break;

    case 'add-supplier':
      addSupplier();
      break;

    case 'edit-supplier':
      addSupplier(supplierById(Number(id)));
      break;

    case 'delete-supplier':
      deleteSupplier(Number(id));
      break;

    case 'add-purchase':
      addPurchase();
      break;

    case 'add-sale':
      addSale();
      break;

    case 'adjust-stock':
      adjustStock(id ? productById(Number(id)) : null);
      break;

    case 'delete-sale':
      deleteSale(Number(id));
      break;

    case 'go-stock':
      setPage('stock');
      break;

    case 'go-sales':
      setPage('sales');
      break;

    case 'export-products':
      exportProducts();
      break;

    case 'export-suppliers':
      exportSuppliers();
      break;

    case 'export-purchases':
      exportPurchases();
      break;

    case 'export-sales':
      exportSales();
      break;

    case 'export-stock':
      exportStock();
      break;

    case 'export-all':
      exportAll();
      break;
  }
}

// Event delegation keeps controls working after each page render.
document.addEventListener('click', event => {
  const nav = event.target.closest('[data-page]');

  if (nav) {
    setPage(nav.dataset.page);
    return;
  }

  const action = event.target.closest('[data-action]');

  if (action) {
    handleAction(action.dataset.action, action.dataset.id);
    return;
  }
});

// Search
$('#pageContent').addEventListener('input', event => {
  if (event.target.id === 'tableSearch') {
    activeSearch = event.target.value;

    const cursor = event.target.selectionStart;

    renderPage();

    const next = $('#tableSearch');

    next?.focus();
    next?.setSelectionRange(cursor, cursor);
  }
});

// Filters
$('#pageContent').addEventListener('change', event => {
  if (event.target.id === 'tableFilter') {
    activeFilter = event.target.value;
    renderPage();
  }
});

// Modal close buttons
$('#modalClose').addEventListener('click', closeModal);
$('#modalCancel').addEventListener('click', closeModal);

$('#modalBackdrop').addEventListener('click', event => {
  if (event.target === $('#modalBackdrop')) {
    closeModal();
  }
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape') closeModal();
});

// Form submission
$('#modalForm').addEventListener('submit', event => {
  event.preventDefault();

  if (!modalSubmitHandler) return;

  const data = Object.fromEntries(
    new FormData(event.currentTarget).entries()
  );

  modalSubmitHandler(data);
});

// Mobile navigation
$('#mobileMenu').addEventListener('click', () => {
  $('#sidebar').classList.toggle('open');
});

// Help button
$('#helpButton').addEventListener('click', () => {
  openModal({
    title: 'A quick tour of Stockroom',
    eyebrow: 'HELP CENTER',
    submit: 'Got it',

    body: `
      <div class="activity-list">
        <div class="activity-item">
          <div class="activity-symbol">◇</div>
          <div class="activity-text">
            <strong>Products</strong> — Add your catalog, SKUs, prices and reorder levels.
          </div>
        </div>

        <div class="activity-item">
          <div class="activity-symbol">⇅</div>
          <div class="activity-text">
            <strong>Stock management</strong> — Adjust quantities and review every stock movement.
          </div>
        </div>

        <div class="activity-item">
          <div class="activity-symbol">↙</div>
          <div class="activity-text">
            <strong>Purchases</strong> — Record stock received from suppliers; quantities are added automatically.
          </div>
        </div>

        <div class="activity-item">
          <div class="activity-symbol sale">↗</div>
          <div class="activity-text">
            <strong>Sales</strong> — Record outgoing sales; quantities are deducted automatically.
          </div>
        </div>

        <div class="inline-note">
          Your data is saved in this browser using localStorage.
          This is a frontend demo, not a secure multi-user cloud system.
          Export your CSV files regularly.
        </div>
      </div>
    `,

    onSubmit: () => closeModal()
  });
});

// Profile button
$('#profileButton').addEventListener('click', () => {
  toast('Signed in as Store administrator.');
});

// Notification button
$('#notificationButton').addEventListener('click', () => {
  const low = db.products.filter(p => p.stock <= p.minStock);

  toast(
    low.length
      ? `${low.length} product(s) are at or below minimum stock.`
      : 'No stock alerts right now.'
  );
});

// Set today's date
$('#todayDate').textContent = new Date().toLocaleDateString('en-GB', {
  weekday: 'short',
  day: '2-digit',
  month: 'short',
  year: 'numeric'
});

// Initial application load
updateGlobalCounts();
renderPage();
