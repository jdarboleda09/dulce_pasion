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

async function apiFetch(endpoint, options = {}) {
    const res = await fetch(API + endpoint, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + getToken(),
            ...(options.headers || {})
        }
    });
    if (res.status === 401 || res.status === 403) { logout(); return null; }
    return res.json();
}

// Cache local para renders rápidos
let _products = [];
let _clients = [];

function getProducts() { return _products; }
function getClients() { return _clients; }

// ──────────────────────────────────────────────
// 3. SEED — no necesaria, datos vienen de la BD
// ──────────────────────────────────────────────
function seed() { }

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
    const [prodData, clientData] = await Promise.all([
        apiFetch('/products'),
        apiFetch('/clients')
    ]);

    _products = prodData?.products || [];
    _clients = clientData?.clients || [];

    const activeProducts = _products.filter(p => p.estado === 'Activo').length;
    const activeClients = _clients.filter(c => c.estado === 'Activo').length;

    document.getElementById('dash-total-products').textContent = activeProducts;
    document.getElementById('dash-total-clients').textContent = activeClients;
    updateBadges();

    // Bar chart
    const salesData = [
        { label: 'Dic', val: 78, accent: false },
        { label: 'Ene', val: 95, accent: false },
        { label: 'Feb', val: 110, accent: false },
        { label: 'Mar', val: 88, accent: false },
        { label: 'Abr', val: 130, accent: true },
        { label: 'May', val: 142, accent: true },
    ];
    const maxVal = Math.max(...salesData.map(d => d.val));
    document.getElementById('salesChart').innerHTML = salesData.map(d => `
        <div class="bar-chart__bar-wrap">
            <div class="bar-chart__bar ${d.accent ? 'bar-chart__bar--accent' : ''}"
                 style="height:${Math.round((d.val / maxVal) * 100)}%"></div>
            <span class="bar-chart__label">${d.label}</span>
        </div>
    `).join('');

    // Top productos
    document.getElementById('topProductsList').innerHTML = _products.slice(0, 5).map((p, i) => `
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
    `).join('') || '<p style="color:var(--color-text-muted);font-size:.85rem;padding:12px 0;">Sin productos</p>';
}

function updateBadges() {
    document.getElementById('productCountBadge').textContent = _products.length;
    document.getElementById('clientCountBadge').textContent = _clients.length;
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

async function renderProducts() {
    // Cargar desde API si el cache está vacío
    if (!_products.length) {
        const data = await apiFetch('/products');
        _products = data?.products || [];
    }

    const all = getFilteredProducts();
    const start = (productPage - 1) * ITEMS_PER_PAGE;
    const paged = all.slice(start, start + ITEMS_PER_PAGE);
    const tbody = document.getElementById('productsTableBody');
    const empty = document.getElementById('productsEmpty');

    updateBadges();

    if (!all.length) {
        tbody.innerHTML = '';
        empty.style.display = 'block';
        document.getElementById('productsPagination').style.display = 'none';
        return;
    }

    empty.style.display = 'none';
    document.getElementById('productsPagination').style.display = 'flex';
    document.getElementById('productsPaginationInfo').textContent =
        `Mostrando ${start + 1}–${Math.min(start + ITEMS_PER_PAGE, all.length)} de ${all.length} productos`;
    document.getElementById('productPageNum').textContent = productPage;

    tbody.innerHTML = paged.map(p => {
        const stock = Number(p.stock);
        const stockBadge = stock === 0
            ? '<span class="badge badge--out">Sin stock</span>'
            : stock <= 10
                ? `<span class="badge badge--low">⚠ Bajo (${stock})</span>`
                : `<span style="font-size:.84rem;color:var(--color-text-muted);">${stock}</span>`;
        const statusBadge = p.estado === 'Activo'
            ? '<span class="badge badge--active">● Activo</span>'
            : '<span class="badge badge--inactive">● Inactivo</span>';

        return `<tr>
            <td>
                <div class="table-product-cell">
                    <div class="table-product-thumb">🍬</div>
                    <div class="table-product-info">
                        <span class="table-product-name">${p.nombre}</span>
                        <span class="table-product-sku">${p.categoria || '—'}</span>
                    </div>
                </div>
            </td>
            <td><span style="font-size:.8rem;color:var(--color-text-muted);">${p.categoria || '—'}</span></td>
            <td><span class="price-text">$${Number(p.precio).toLocaleString('es-CO')}</span></td>
            <td>${stockBadge}</td>
            <td>${statusBadge}</td>
            <td>
                <div class="table-actions">
                    <button class="table-action-btn" title="Editar" onclick="openEditProduct(${p.id_producto})">
                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round"
                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                        </svg>
                    </button>
                    <button class="table-action-btn table-action-btn--delete" title="Eliminar"
                        onclick="confirmDeleteProduct(${p.id_producto})">
                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round"
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                        </svg>
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

async function openAddProduct() {
    editingProductId = null;
    document.getElementById('productModalTitle').textContent = 'Agregar producto';
    clearProductForm();
    await loadCategoriasSelect();
    document.getElementById('productModal').classList.add('modal-overlay--visible');
}

async function openEditProduct(id) {
    const p = _products.find(x => x.id_producto === id);
    if (!p) return;
    editingProductId = id;
    document.getElementById('productModalTitle').textContent = 'Editar producto';
    await loadCategoriasSelect();
    document.getElementById('pName').value = p.nombre;
    document.getElementById('pCategory').value = p.id_categoria;
    document.getElementById('pPrice').value = p.precio;
    document.getElementById('pStock').value = p.stock;
    document.getElementById('pStatus').value = p.estado;
    document.getElementById('pDesc').value = p.descripcion || '';
    document.getElementById('productModal').classList.add('modal-overlay--visible');
}

async function loadCategoriasSelect() {
    const data = await apiFetch('/products/categorias');
    if (!data?.categorias) return;
    const select = document.getElementById('pCategory');
    select.innerHTML = '<option value="">Seleccionar...</option>' +
        data.categorias.map(c =>
            `<option value="${c.id_categoria}">${c.nombre}</option>`
        ).join('');
}

function closeProductModal() {
    document.getElementById('productModal').classList.remove('modal-overlay--visible');
    editingProductId = null;
}

async function saveProduct() {
    const nombre = document.getElementById('pName').value.trim();
    const id_categoria = document.getElementById('pCategory').value;
    const precio = parseFloat(document.getElementById('pPrice').value);
    const stock = parseInt(document.getElementById('pStock').value);
    const estado = document.getElementById('pStatus').value;
    const descripcion = document.getElementById('pDesc').value.trim();
    const costo = parseFloat(document.getElementById('pCost').value);

    if (!nombre || !id_categoria || isNaN(precio)) {
        showToast('⚠️ Completa los campos obligatorios', 'error');
        return;
    }

    const body = {
        nombre, id_categoria, precio, stock: isNaN(stock) ? 0 : stock,
        estado, descripcion, costo
    };

    let data;
    if (editingProductId) {
        data = await apiFetch(`/products/${editingProductId}`, { method: 'PUT', body: JSON.stringify(body) });
    } else {
        data = await apiFetch('/products', { method: 'POST', body: JSON.stringify(body) });
    }

    if (!data) return;
    if (!data.ok) { showToast('❌ ' + data.message, 'error'); return; }

    showToast(editingProductId ? '✅ Producto actualizado' : '✅ Producto creado', 'success');
    closeProductModal();

    // Recargar desde la API
    const fresh = await apiFetch('/products');
    _products = fresh?.products || [];
    renderProducts();
    updateBadges();
}

function confirmDeleteProduct(id) {
    const p = _products.find(x => x.id_producto === id);
    if (!p) return;
    document.getElementById('confirmTitle').textContent = `¿Eliminar "${p.nombre}"?`;
    document.getElementById('confirmText').textContent = 'Este producto se eliminará permanentemente.';
    confirmCallback = async () => {
        const data = await apiFetch(`/products/${id}`, { method: 'DELETE' });
        if (!data?.ok) { showToast('❌ ' + (data?.message || 'Error'), 'error'); return; }
        const fresh = await apiFetch('/products');
        _products = fresh?.products || [];
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

async function renderClients() {
    if (!_clients.length) {
        const data = await apiFetch('/clients');
        _clients = data?.clients || [];
    }

    const all = getFilteredClients();
    const start = (clientPage - 1) * ITEMS_PER_PAGE;
    const paged = all.slice(start, start + ITEMS_PER_PAGE);
    const tbody = document.getElementById('clientsTableBody');
    const empty = document.getElementById('clientsEmpty');

    updateBadges();

    if (!all.length) {
        tbody.innerHTML = '';
        empty.style.display = 'block';
        document.getElementById('clientsPagination').style.display = 'none';
        return;
    }

    empty.style.display = 'none';
    document.getElementById('clientsPagination').style.display = 'flex';
    document.getElementById('clientsPaginationInfo').textContent =
        `Mostrando ${start + 1}–${Math.min(start + ITEMS_PER_PAGE, all.length)} de ${all.length} clientes`;
    document.getElementById('clientPageNum').textContent = clientPage;

    const rolBadge = {
        Corporativo: '<span class="badge badge--vip">✨ Corp</span>',
        Mayorista: '<span class="badge badge--active">Mayorista</span>',
        Minorista: '<span class="badge badge--new">Minorista</span>',
    };

    tbody.innerHTML = paged.map(c => {
        const initials = (c.contacto || c.empresa || '?').split(' ')
            .map(n => n[0]).join('').substring(0, 2).toUpperCase();
        const statusBadge = c.estado === 'Activo'
            ? '<span class="badge badge--active">● Activo</span>'
            : '<span class="badge badge--inactive">● Inactivo</span>';

        return `<tr>
            <td>
                <div class="table-client-cell">
                    <div class="table-client-avatar">${initials}</div>
                    <div>
                        <div class="table-client-name">${c.contacto || '—'}</div>
                        <div class="table-client-email">${c.email}</div>
                    </div>
                </div>
            </td>
            <td><span style="font-size:.82rem;color:var(--color-text-muted);">${c.empresa || '—'}</span></td>
            <td><span style="font-size:.82rem;color:var(--color-text-muted);">${c.direccion || '—'}</span></td>
            <td>${rolBadge[c.tipo] || ''}</td>
            <td>${statusBadge}</td>
            <td>
                <div class="table-actions">
                    <button class="table-action-btn" title="Editar" onclick="openEditClient(${c.id_cliente})">
                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round"
                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                        </svg>
                    </button>
                    <button class="table-action-btn table-action-btn--delete" title="Eliminar"
                        onclick="confirmDeleteClient(${c.id_cliente})">
                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round"
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                        </svg>
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
    const c = _clients.find(x => x.id_cliente === id);
    if (!c) return;
    editingClientId = id;
    document.getElementById('clientModalTitle').textContent = 'Editar cliente';
    document.getElementById('cName').value = c.contacto || '';
    document.getElementById('cLastName').value = c.empresa || '';
    document.getElementById('cEmail').value = c.email;
    document.getElementById('cPhone').value = c.telefono || '';
    document.getElementById('cCity').value = c.direccion || '';
    document.getElementById('cRol').value = c.tipo || 'Minorista';
    document.getElementById('cStatus').value = c.estado || 'Activo';
    document.getElementById('clientModal').classList.add('modal-overlay--visible');
}

function closeClientModal() {
    document.getElementById('clientModal').classList.remove('modal-overlay--visible');
    editingClientId = null;
}

async function saveClient() {
    const contacto = document.getElementById('cName').value.trim();
    const empresa = document.getElementById('cLastName').value.trim();
    const email = document.getElementById('cEmail').value.trim();
    const telefono = document.getElementById('cPhone').value.trim();
    const direccion = document.getElementById('cCity').value.trim();
    const tipo = document.getElementById('cRol').value;
    const estado = document.getElementById('cStatus').value;

    if (!contacto || !email) {
        showToast('⚠️ Completa los campos obligatorios', 'error'); return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showToast('⚠️ Ingresa un correo válido', 'error'); return;
    }

    const body = { contacto, empresa, email, telefono, direccion, tipo, estado };

    let data;
    if (editingClientId) {
        data = await apiFetch(`/clients/${editingClientId}`, { method: 'PUT', body: JSON.stringify(body) });
    } else {
        data = await apiFetch('/clients', { method: 'POST', body: JSON.stringify(body) });
    }

    if (!data) return;
    if (!data.ok) { showToast('❌ ' + data.message, 'error'); return; }

    showToast(editingClientId ? '✅ Cliente actualizado' : '✅ Cliente creado', 'success');
    closeClientModal();

    const fresh = await apiFetch('/clients');
    _clients = fresh?.clients || [];
    renderClients();
    updateBadges();
}

function confirmDeleteClient(id) {
    const c = _clients.find(x => x.id_cliente === id);
    if (!c) return;
    document.getElementById('confirmTitle').textContent = `¿Eliminar a "${c.contacto || c.empresa}"?`;
    document.getElementById('confirmText').textContent = 'Este cliente se eliminará permanentemente.';
    confirmCallback = async () => {
        const data = await apiFetch(`/clients/${id}`, { method: 'DELETE' });
        if (!data?.ok) { showToast('❌ ' + (data?.message || 'Error'), 'error'); return; }
        const fresh = await apiFetch('/clients');
        _clients = fresh?.clients || [];
        renderClients();
        updateBadges();
        showToast('🗑️ Cliente eliminado', 'error');
    };
    document.getElementById('confirmModal').classList.add('modal-overlay--visible');
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