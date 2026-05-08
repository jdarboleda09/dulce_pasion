/* ============================================================
   DulcePasión Admin — JavaScript
   Gestión completa de productos y clientes (localStorage)
============================================================ */

// ──────────────────────────────────────────────
// 1. ESTADO GLOBAL
// ──────────────────────────────────────────────
const ITEMS_PER_PAGE = 8;
let productPage = 1;
let clientPage = 1;
let editingProductId = null;
let editingClientId = null;
let confirmCallback = null;

// ──────────────────────────────────────────────
// 2. API HELPERS
// ──────────────────────────────────────────────
const API = 'http://localhost:3000/api';

function getToken() {
    return localStorage.getItem('token');
}

async function apiFetch(endpoint) {
    const res = await fetch(API + endpoint, {
        headers: { 'Authorization': 'Bearer ' + getToken() }
    });
    if (res.status === 401 || res.status === 403) {
        logout();
        return null;
    }
    return res.json();
}

// Mantén estas funciones para compatibilidad con modales
// (los modales siguen usando localStorage temporalmente)
function getProducts() {
    try { return JSON.parse(localStorage.getItem('dp_products') || '[]'); }
    catch { return []; }
}
function saveProducts(arr) { localStorage.setItem('dp_products', JSON.stringify(arr)); }
function getClients() {
    try { return JSON.parse(localStorage.getItem('dp_clients') || '[]'); }
    catch { return []; }
}
function saveClients(arr) { localStorage.setItem('dp_clients', JSON.stringify(arr)); }

// ──────────────────────────────────────────────
// 3. SEED (deshabilitado — datos vienen de la BD)
// ──────────────────────────────────────────────
function seed() { /* no-op */ }

// ──────────────────────────────────────────────
// 4. NAVEGACIÓN
// ──────────────────────────────────────────────
const viewTitles = {
    dashboard: { title: 'Dashboard', sub: 'Resumen general del sistema' },
    products: { title: 'Productos', sub: 'Gestiona el catálogo de la tienda' },
    clients: { title: 'Clientes', sub: 'Administra los clientes registrados' },
};

function navigateTo(view) {
    document.querySelectorAll('.admin-view').forEach(v => v.classList.remove('admin-view--active'));
    document.querySelectorAll('.sidebar__link').forEach(l => l.classList.remove('sidebar__link--active'));

    const target = document.getElementById('view-' + view);
    if (target) target.classList.add('admin-view--active');

    document.querySelectorAll(`.sidebar__link[data-view="${view}"]`).forEach(l => l.classList.add('sidebar__link--active'));

    const meta = viewTitles[view] || {};
    document.getElementById('topbarTitle').innerHTML = (meta.title || view) + `<span class="admin-topbar__subtitle">${meta.sub || ''}</span>`;

    if (view === 'products') { productPage = 1; renderProducts(); }
    if (view === 'clients') { clientPage = 1; renderClients(); }
    if (view === 'dashboard') renderDashboard();

    closeSidebar();
}

document.querySelectorAll('.sidebar__link[data-view]').forEach(btn => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.view));
});

// ──────────────────────────────────────────────
// 5. DASHBOARD
// ──────────────────────────────────────────────
async function renderDashboard() {
    // Cargar productos y clientes desde la BD
    const [prodData, clientData] = await Promise.all([
        apiFetch('/products'),
        apiFetch('/clients')
    ]);

    const products = prodData?.products || [];
    const clients = clientData?.clients || [];

    // Sincronizar localStorage para que los modales funcionen
    saveProducts(products.map(p => ({
        id: p.id_producto,
        name: p.nombre,
        category: p.categoria || 'Sin categoría',
        price: p.precio,
        stock: p.stock,          // ← ahora viene de inventario
        status: p.estado,
        desc: p.descripcion || '',
        emoji: '🍬',
        sku: ''
    })));

    saveClients(clients.map(c => ({
        id: c.id_cliente,
        name: c.contacto?.split(' ')[0] || c.empresa,
        lastName: c.contacto?.split(' ').slice(1).join(' ') || '',
        email: c.email,
        phone: c.telefono || '',
        city: c.direccion || '',
        rol: c.tipo === 'Corporativo' ? 'VIP' : c.tipo === 'Mayorista' ? 'Regular' : 'Nuevo',
        status: c.estado,
        orders: 0,
        points: 0,
        notes: ''
    })));

    // Actualizar contadores del dashboard
    const activeProducts = products.filter(p => p.estado === 'Activo').length;
    const activeClients = clients.filter(c => c.estado === 'Activo').length;

    document.getElementById('dash-total-products').textContent = activeProducts;
    document.getElementById('dash-total-clients').textContent = activeClients;
    updateBadges();

    // Bar chart (ventas ficticias — ajusta cuando tengas tabla de ventas)
    const salesData = [
        { label: 'Dic', val: 78, accent: false },
        { label: 'Ene', val: 95, accent: false },
        { label: 'Feb', val: 110, accent: false },
        { label: 'Mar', val: 88, accent: false },
        { label: 'Abr', val: 130, accent: true },
        { label: 'May', val: 142, accent: true },
    ];
    const maxVal = Math.max(...salesData.map(d => d.val));
    const chart = document.getElementById('salesChart');
    chart.innerHTML = salesData.map(d => `
        <div class="bar-chart__bar-wrap">
            <div class="bar-chart__bar ${d.accent ? 'bar-chart__bar--accent' : ''}"
                 style="height:${Math.round((d.val / maxVal) * 100)}%"></div>
            <span class="bar-chart__label">${d.label}</span>
        </div>
    `).join('');

    // Top productos desde BD
    const topProductsList = products.slice(0, 5);
    const maxOrders = 100;
    document.getElementById('topProductsList').innerHTML = topProductsList.length
        ? topProductsList.map((p, i) => `
            <div class="top-list-item">
                <div class="top-list-item__rank ${i === 0 ? 'top-list-item__rank--gold' : ''}">${i + 1}</div>
                <div class="top-list-item__name">${p.nombre}</div>
                <div class="top-list-item__bar">
                    <div class="top-list-item__progress">
                        <div class="top-list-item__fill" style="width:${Math.round(((5 - i) / 5) * 100)}%"></div>
                    </div>
                </div>
                <div class="top-list-item__val">${Math.round(((5 - i) / 5) * 100)}%</div>
            </div>
        `).join('')
        : '<p style="color:var(--color-text-muted);font-size:.85rem;padding:12px 0;">Sin productos registrados</p>';
}

function updateBadges() {
    const products = getProducts();
    const clients = getClients();
    document.getElementById('productCountBadge').textContent = products.length;
    document.getElementById('clientCountBadge').textContent = clients.length;
}

// ──────────────────────────────────────────────
// 6. PRODUCTOS — RENDER
// ──────────────────────────────────────────────
function getFilteredProducts() {
    const q = (document.getElementById('productSearch')?.value || '').toLowerCase();
    const cat = document.getElementById('productCatFilter')?.value || '';
    const stock = document.getElementById('productStockFilter')?.value || '';
    return getProducts().filter(p => {
        const matchQ = !q || p.name.toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q);
        const matchC = !cat || p.category === cat;
        const matchSt = !stock ||
            (stock === 'active' && p.stock > 10) ||
            (stock === 'low' && p.stock > 0 && p.stock <= 10) ||
            (stock === 'out' && p.stock === 0);
        return matchQ && matchC && matchSt;
    });
}

function renderProducts() {
    const all = getFilteredProducts();
    const start = (productPage - 1) * ITEMS_PER_PAGE;
    const paged = all.slice(start, start + ITEMS_PER_PAGE);
    const tbody = document.getElementById('productsTableBody');
    const empty = document.getElementById('productsEmpty');
    const pgInfo = document.getElementById('productsPaginationInfo');
    const pgNum = document.getElementById('productPageNum');

    updateBadges();

    if (!all.length) {
        tbody.innerHTML = '';
        empty.style.display = 'block';
        document.getElementById('productsPagination').style.display = 'none';
        return;
    }

    empty.style.display = 'none';
    document.getElementById('productsPagination').style.display = 'flex';
    pgInfo.textContent = `Mostrando ${start + 1}–${Math.min(start + ITEMS_PER_PAGE, all.length)} de ${all.length} productos`;
    pgNum.textContent = productPage;

    tbody.innerHTML = paged.map(p => {
        const stockBadge = p.stock === 0
            ? '<span class="badge badge--out">Sin stock</span>'
            : p.stock <= 10
                ? `<span class="badge badge--low">⚠ Bajo (${p.stock})</span>`
                : `<span style="font-size:.84rem;color:var(--color-text-muted);">${p.stock}</span>`;

        const statusBadge = p.status === 'Activo'
            ? '<span class="badge badge--active">● Activo</span>'
            : '<span class="badge badge--inactive">● Inactivo</span>';

        return `<tr>
      <td>
        <div class="table-product-cell">
          <div class="table-product-thumb">${p.emoji || '🍬'}</div>
          <div class="table-product-info">
            <span class="table-product-name">${p.name}</span>
            <span class="table-product-sku">${p.sku || '—'}</span>
          </div>
        </div>
      </td>
      <td><span style="font-size:.8rem;color:var(--color-text-muted);">${p.category}</span></td>
      <td><span class="price-text">$${Number(p.price).toLocaleString('es-CO')}</span></td>
      <td>${stockBadge}</td>
      <td>${statusBadge}</td>
      <td>
        <div class="table-actions">
          <button class="table-action-btn" title="Editar" onclick="openEditProduct(${p.id})">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
          </button>
          <button class="table-action-btn table-action-btn--delete" title="Eliminar" onclick="confirmDeleteProduct(${p.id})">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          </button>
        </div>
      </td>
    </tr>`;
    }).join('');
}

function filterProducts() { productPage = 1; renderProducts(); }
function changeProductPage(dir) {
    const total = Math.ceil(getFilteredProducts().length / ITEMS_PER_PAGE);
    productPage = Math.max(1, Math.min(total, productPage + dir));
    renderProducts();
}

// ──────────────────────────────────────────────
// 7. MODAL PRODUCTO
// ──────────────────────────────────────────────
function clearProductForm() {
    ['pName', 'pCategory', 'pPrice', 'pStock', 'pStatus', 'pDesc', 'pEmoji', 'pSku'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = id === 'pStatus' ? 'Activo' : '';
    });
}

function openAddProduct() {
    editingProductId = null;
    document.getElementById('productModalTitle').textContent = 'Agregar producto';
    clearProductForm();
    document.getElementById('productModal').classList.add('modal-overlay--visible');
}

function openEditProduct(id) {
    const p = getProducts().find(x => x.id === id);
    if (!p) return;
    editingProductId = id;
    document.getElementById('productModalTitle').textContent = 'Editar producto';
    document.getElementById('pName').value = p.name;
    document.getElementById('pCategory').value = p.category;
    document.getElementById('pPrice').value = p.price;
    document.getElementById('pStock').value = p.stock;
    document.getElementById('pStatus').value = p.status;
    document.getElementById('pDesc').value = p.desc || '';
    document.getElementById('pEmoji').value = p.emoji || '';
    document.getElementById('pSku').value = p.sku || '';
    document.getElementById('productModal').classList.add('modal-overlay--visible');
}

function closeProductModal() {
    document.getElementById('productModal').classList.remove('modal-overlay--visible');
    editingProductId = null;
}

function saveProduct() {
    const name = document.getElementById('pName').value.trim();
    const category = document.getElementById('pCategory').value;
    const price = parseFloat(document.getElementById('pPrice').value);
    const stock = parseInt(document.getElementById('pStock').value);
    const status = document.getElementById('pStatus').value;
    const desc = document.getElementById('pDesc').value.trim();
    const emoji = document.getElementById('pEmoji').value.trim() || '🍬';
    const sku = document.getElementById('pSku').value.trim();

    if (!name || !category || isNaN(price) || isNaN(stock)) {
        showToast('⚠️ Completa los campos obligatorios', 'error');
        return;
    }

    const products = getProducts();
    if (editingProductId) {
        const idx = products.findIndex(p => p.id === editingProductId);
        if (idx >= 0) products[idx] = { ...products[idx], name, category, price, stock, status, desc, emoji, sku };
        showToast('✅ Producto actualizado', 'success');
    } else {
        const newId = products.length ? Math.max(...products.map(p => p.id)) + 1 : 1;
        products.push({ id: newId, name, category, price, stock, status, desc, emoji, sku });
        showToast('✅ Producto agregado', 'success');
    }

    saveProducts(products);
    closeProductModal();
    renderProducts();
    updateBadges();
}

function confirmDeleteProduct(id) {
    const p = getProducts().find(x => x.id === id);
    if (!p) return;
    document.getElementById('confirmTitle').textContent = `¿Eliminar "${p.name}"?`;
    document.getElementById('confirmText').textContent = 'Este producto se eliminará permanentemente del catálogo.';
    confirmCallback = () => {
        const arr = getProducts().filter(x => x.id !== id);
        saveProducts(arr);
        renderProducts();
        updateBadges();
        showToast('🗑️ Producto eliminado', 'error');
    };
    document.getElementById('confirmModal').classList.add('modal-overlay--visible');
}

// ──────────────────────────────────────────────
// 8. CLIENTES — RENDER
// ──────────────────────────────────────────────
function getFilteredClients() {
    const q = (document.getElementById('clientSearch')?.value || '').toLowerCase();
    const rol = document.getElementById('clientRolFilter')?.value || '';
    const status = document.getElementById('clientStatusFilter')?.value || '';
    return getClients().filter(c => {
        const fullName = `${c.name} ${c.lastName}`.toLowerCase();
        const matchQ = !q || fullName.includes(q) || c.email.toLowerCase().includes(q);
        const matchR = !rol || c.rol === rol;
        const matchS = !status || c.status === status;
        return matchQ && matchR && matchS;
    });
}

function renderClients() {
    const all = getFilteredClients();
    const start = (clientPage - 1) * ITEMS_PER_PAGE;
    const paged = all.slice(start, start + ITEMS_PER_PAGE);
    const tbody = document.getElementById('clientsTableBody');
    const empty = document.getElementById('clientsEmpty');
    const pgInfo = document.getElementById('clientsPaginationInfo');
    const pgNum = document.getElementById('clientPageNum');

    updateBadges();

    if (!all.length) {
        tbody.innerHTML = '';
        empty.style.display = 'block';
        document.getElementById('clientsPagination').style.display = 'none';
        return;
    }

    empty.style.display = 'none';
    document.getElementById('clientsPagination').style.display = 'flex';
    pgInfo.textContent = `Mostrando ${start + 1}–${Math.min(start + ITEMS_PER_PAGE, all.length)} de ${all.length} clientes`;
    pgNum.textContent = clientPage;

    const rolBadge = {
        VIP: '<span class="badge badge--vip">✨ VIP</span>',
        Regular: '<span class="badge badge--active">Regular</span>',
        Nuevo: '<span class="badge badge--new">Nuevo</span>',
    };

    tbody.innerHTML = paged.map(c => {
        const initials = (c.name[0] || '') + (c.lastName[0] || '');
        const status = c.status === 'Activo'
            ? '<span class="badge badge--active">● Activo</span>'
            : '<span class="badge badge--inactive">● Inactivo</span>';

        return `<tr>
      <td>
        <div class="table-client-cell">
          <div class="table-client-avatar">${initials.toUpperCase()}</div>
          <div>
            <div class="table-client-name">${c.name} ${c.lastName}</div>
            <div class="table-client-email">${c.email}</div>
          </div>
        </div>
      </td>
      <td><span style="font-size:.82rem;color:var(--color-text-muted);">${c.city || '—'}</span></td>
      <td><span style="font-size:.86rem;font-weight:600;">${c.orders || 0}</span></td>
      <td><span style="font-size:.8rem;color:var(--color-accent);font-weight:700;">🍬 ${c.points || 0}</span></td>
      <td>${rolBadge[c.rol] || ''}</td>
      <td>${status}</td>
      <td>
        <div class="table-actions">
          <button class="table-action-btn" title="Editar" onclick="openEditClient(${c.id})">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
          </button>
          <button class="table-action-btn table-action-btn--delete" title="Eliminar" onclick="confirmDeleteClient(${c.id})">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          </button>
        </div>
      </td>
    </tr>`;
    }).join('');
}

function filterClients() { clientPage = 1; renderClients(); }
function changeClientPage(dir) {
    const total = Math.ceil(getFilteredClients().length / ITEMS_PER_PAGE);
    clientPage = Math.max(1, Math.min(total, clientPage + dir));
    renderClients();
}

// ──────────────────────────────────────────────
// 9. MODAL CLIENTE
// ──────────────────────────────────────────────
function clearClientForm() {
    ['cName', 'cLastName', 'cEmail', 'cPhone', 'cCity', 'cRol', 'cStatus', 'cNotes'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = id === 'cRol' ? 'Nuevo' : id === 'cStatus' ? 'Activo' : '';
    });
}

function openAddClient() {
    editingClientId = null;
    document.getElementById('clientModalTitle').textContent = 'Agregar cliente';
    clearClientForm();
    document.getElementById('clientModal').classList.add('modal-overlay--visible');
}

function openEditClient(id) {
    const c = getClients().find(x => x.id === id);
    if (!c) return;
    editingClientId = id;
    document.getElementById('clientModalTitle').textContent = 'Editar cliente';
    document.getElementById('cName').value = c.name;
    document.getElementById('cLastName').value = c.lastName;
    document.getElementById('cEmail').value = c.email;
    document.getElementById('cPhone').value = c.phone || '';
    document.getElementById('cCity').value = c.city || '';
    document.getElementById('cRol').value = c.rol;
    document.getElementById('cStatus').value = c.status;
    document.getElementById('cNotes').value = c.notes || '';
    document.getElementById('clientModal').classList.add('modal-overlay--visible');
}

function closeClientModal() {
    document.getElementById('clientModal').classList.remove('modal-overlay--visible');
    editingClientId = null;
}

function saveClient() {
    const name = document.getElementById('cName').value.trim();
    const lastName = document.getElementById('cLastName').value.trim();
    const email = document.getElementById('cEmail').value.trim();
    const phone = document.getElementById('cPhone').value.trim();
    const city = document.getElementById('cCity').value.trim();
    const rol = document.getElementById('cRol').value;
    const status = document.getElementById('cStatus').value;
    const notes = document.getElementById('cNotes').value.trim();

    if (!name || !lastName || !email) {
        showToast('⚠️ Completa los campos obligatorios', 'error');
        return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showToast('⚠️ Ingresa un correo válido', 'error');
        return;
    }

    const clients = getClients();
    if (editingClientId) {
        const idx = clients.findIndex(c => c.id === editingClientId);
        if (idx >= 0) clients[idx] = { ...clients[idx], name, lastName, email, phone, city, rol, status, notes };
        showToast('✅ Cliente actualizado', 'success');
    } else {
        const newId = clients.length ? Math.max(...clients.map(c => c.id)) + 1 : 1;
        clients.push({ id: newId, name, lastName, email, phone, city, rol, status, notes, orders: 0, points: 0 });
        showToast('✅ Cliente agregado', 'success');
    }

    saveClients(clients);
    closeClientModal();
    renderClients();
    updateBadges();
}

function confirmDeleteClient(id) {
    const c = getClients().find(x => x.id === id);
    if (!c) return;
    document.getElementById('confirmTitle').textContent = `¿Eliminar a "${c.name} ${c.lastName}"?`;
    document.getElementById('confirmText').textContent = 'Este cliente se eliminará permanentemente del sistema.';
    confirmCallback = () => {
        const arr = getClients().filter(x => x.id !== id);
        saveClients(arr);
        renderClients();
        updateBadges();
        showToast('🗑️ Cliente eliminado', 'error');
    };
    document.getElementById('confirmModal').classList.add('modal-overlay--visible');
}

// ──────────────────────────────────────────────
// 10. CONFIRM MODAL
// ──────────────────────────────────────────────
function closeConfirm() {
    document.getElementById('confirmModal').classList.remove('modal-overlay--visible');
    confirmCallback = null;
}

document.getElementById('cancelConfirm').addEventListener('click', closeConfirm);
document.getElementById('doConfirm').addEventListener('click', () => {
    if (confirmCallback) confirmCallback();
    closeConfirm();
});

// ──────────────────────────────────────────────
// 11. MODAL EVENTS
// ──────────────────────────────────────────────
document.getElementById('openAddProduct').addEventListener('click', openAddProduct);
document.getElementById('closeProductModal').addEventListener('click', closeProductModal);
document.getElementById('cancelProductModal').addEventListener('click', closeProductModal);
document.getElementById('saveProduct').addEventListener('click', saveProduct);

document.getElementById('openAddClient').addEventListener('click', openAddClient);
document.getElementById('closeClientModal').addEventListener('click', closeClientModal);
document.getElementById('cancelClientModal').addEventListener('click', closeClientModal);
document.getElementById('saveClient').addEventListener('click', saveClient);

// Close modal on overlay click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
        if (e.target === overlay) {
            closeProductModal();
            closeClientModal();
            closeConfirm();
        }
    });
});

// ──────────────────────────────────────────────
// 12. TOAST
// ──────────────────────────────────────────────
function showToast(msg, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast toast--${type === 'success' ? 'success' : type === 'error' ? 'error' : ''}`;
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'toastOut .3s ease forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ──────────────────────────────────────────────
// 13. SIDEBAR MOBILE
// ──────────────────────────────────────────────
document.getElementById('sidebarToggle').addEventListener('click', () => {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    const isOpen = sidebar.classList.toggle('sidebar--open');
    overlay.style.display = isOpen ? 'block' : 'none';
});

function closeSidebar() {
    document.getElementById('sidebar').classList.remove('sidebar--open');
    document.getElementById('sidebarOverlay').style.display = 'none';
}

// ──────────────────────────────────────────────
// 14. LOGOUT
// ──────────────────────────────────────────────
function logout() {
    if (confirm('¿Seguro que deseas cerrar sesión?')) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = './auth.html';
    }
}

// ──────────────────────────────────────────────
// 15. INIT
// ──────────────────────────────────────────────
const user = JSON.parse(localStorage.getItem('user'));
if (!user || user.rol !== 'admin') {
    window.location.href = './auth.html';
} else {
    // Mostrar nombre del admin en el sidebar
    const sidebarName = document.querySelector('.sidebar__user-name');
    const sidebarRole = document.querySelector('.sidebar__user-role');
    const sidebarAvatar = document.querySelector('.sidebar__avatar');

    if (sidebarName) sidebarName.textContent = user.nombre;
    if (sidebarRole) sidebarRole.textContent = user.email;
    if (sidebarAvatar) {
        sidebarAvatar.textContent = user.nombre
            .split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    }
}

// Botón cerrar sesión del admin
document.getElementById('logoutBtn').addEventListener('click', logout);

seed();
renderDashboard();