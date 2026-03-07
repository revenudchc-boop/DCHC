// ============================================
// نظام الفواتير المتقدم - النسخة النهائية مع جميع التعديلات
// جميع الحقوق محفوظة لشركة دمياط لتداول الحاويات و البضائع
// ============================================

// بيانات الشركة
const COMPANY_INFO = {
    name: 'شركة دمياط لتداول الحاويات و البضائع',
    nameEn: 'Damietta Container & Cargo Handling Company',
    address: 'دمياط - المنطقة الحرة - ميناء دمياط',
    phone: '0572290103',
    email: 'revenue@dchc-egdam.com',
    taxNumber: '100/221/823',
    logo: '<i class="fas fa-ship"></i>',
    baseUrl: 'https://revenudchc-boop.github.io/DCHC/'
};

// أنواع الفواتير
const INVOICE_TYPES = {
    CASH: 'cash',
    POSTPONED: 'postponed'
};
let currentInvoiceType = INVOICE_TYPES.CASH;

// المتغيرات العامة
let invoicesData = [];
let filteredInvoices = [];
let sortOrder = 'asc';
let currentSortField = 'final-number';
let currentPage = 1;
let itemsPerPage = 25;
let viewMode = 'cards';
let selectedInvoiceIndex = -1;
let exchangeRate = 48.0215;
let expandedContainers = new Set();
let db = null;
let autoSaveEnabled = true;

// نظام المستخدمين
let users = [];
let currentUser = null;
let currentEditingUserId = null;

// إعدادات Google Drive
let driveConfig = {
    apiKey: 'AIzaSyBy4WRI3zkUwlCvbrXpB8o9ZbFMuH4AdGA',
    folderId: '1FlBXLupfXCICs6xt7xxEE02wr_cjAapC',
    fileName: 'datatxt.txt',
    fileId: '1xZSobMThbWKcZ53OmZEWlbn6mzz5Nsnr',
    usersFileName: 'users.json',
    usersFileId: '1-ktLLXz1Febs44lB-aqfuNmTRs1GNB0w'
};

// متغيرات التقارير
let currentReportType = 'daily';

// متغير لتخزين قائمة الملفات من Drive
window.driveFilesList = [];

// متغير لتخزين الفواتير المحددة
let selectedInvoices = new Set();

// ============================================
// دوال شريط التقدم
// ============================================
function showProgress(message, percentage) {
    let container = document.getElementById('progressBarContainer');
    let bar = document.getElementById('progressBar');
    let msg = document.getElementById('progressMessage');

    if (!container) {
        container = document.createElement('div');
        container.id = 'progressBarContainer';
        container.className = 'progress-bar-container';
        
        bar = document.createElement('div');
        bar.id = 'progressBar';
        bar.className = 'progress-bar';
        container.appendChild(bar);
        document.body.appendChild(container);

        msg = document.createElement('div');
        msg.id = 'progressMessage';
        msg.className = 'progress-message';
        document.body.appendChild(msg);
    }

    container.style.display = 'block';
    msg.style.display = 'block';
    bar.style.width = percentage + '%';
    msg.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${message}`;

    if (percentage >= 100) {
        setTimeout(() => {
            container.style.display = 'none';
            msg.style.display = 'none';
        }, 1500);
    }
}

function hideProgress() {
    const container = document.getElementById('progressBarContainer');
    const msg = document.getElementById('progressMessage');
    if (container) container.style.display = 'none';
    if (msg) msg.style.display = 'none';
}

// ============================================
// دوال إصلاح JSON
// ============================================
function repairJSON(jsonString) {
    return jsonString.replace(/,(\s*[\]}])/g, '$1');
}

// ============================================
// دوال البحث التلقائي عن ملفات Drive
// ============================================
async function findDataFileIdAuto() {
    if (!driveConfig.apiKey || !driveConfig.folderId) return false;
    const fileName = driveConfig.fileName || 'datatxt.txt';
    try {
        const query = encodeURIComponent(`'${driveConfig.folderId}' in parents and name='${fileName}' and trashed=false`);
        const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&key=${driveConfig.apiKey}&fields=files(id,name)`);
        if (!res.ok) return false;
        const data = await res.json();
        if (data.files?.length) {
            driveConfig.fileId = data.files[0].id;
            return true;
        }
        return false;
    } catch { return false; }
}

async function findUsersFileIdAuto() {
    if (!driveConfig.apiKey || !driveConfig.folderId) return false;
    const fileName = driveConfig.usersFileName || 'users.json';
    try {
        const query = encodeURIComponent(`'${driveConfig.folderId}' in parents and name='${fileName}' and trashed=false`);
        const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&key=${driveConfig.apiKey}&fields=files(id,name)`);
        if (!res.ok) return false;
        const data = await res.json();
        if (data.files?.length) {
            driveConfig.usersFileId = data.files[0].id;
            return true;
        }
        return false;
    } catch { return false; }
}

async function autoConfigureDrive() {
    console.log('بدء الإعداد التلقائي لـ Drive...');
    showProgress('جاري إعداد Google Drive...', 20);
    const dataFound = await findDataFileIdAuto();
    const usersFound = await findUsersFileIdAuto();
    if (dataFound || usersFound) saveDriveSettingsToStorage();
    showProgress(dataFound || usersFound ? 'تم إعداد Drive' : 'استخدم الإعدادات الافتراضية', 100);
    setTimeout(hideProgress, 1500);
}

// ============================================
// دوال المستخدمين
// ============================================
async function loadUsersFromDrive() {
    if (!driveConfig.apiKey || !driveConfig.folderId || !driveConfig.usersFileId) return false;
    try {
        showProgress('جاري تحميل المستخدمين...', 30);
        const res = await fetch(`https://www.googleapis.com/drive/v3/files/${driveConfig.usersFileId}?alt=media&key=${driveConfig.apiKey}`);
        if (!res.ok) throw new Error('فشل التحميل');
        let content = await res.text();
        try { JSON.parse(content); } catch { content = repairJSON(content); }
        users = JSON.parse(content);
        if (!Array.isArray(users)) throw new Error('ملف غير صالح');
        localStorage.setItem('backupUsers', JSON.stringify(users));
        return true;
    } catch (error) {
        console.error(error);
        showNotification('فشل تحميل المستخدمين', 'error');
        return false;
    } finally { setTimeout(hideProgress, 1500); }
}

async function saveUsersToDrive() {
    if (!driveConfig.apiKey || !driveConfig.folderId || !driveConfig.usersFileId) return false;
    try {
        showProgress('جاري حفظ المستخدمين...', 30);
        const metadata = { name: driveConfig.usersFileName, mimeType: 'application/json' };
        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', new Blob([JSON.stringify(users, null, 2)], { type: 'application/json' }));
        const res = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${driveConfig.usersFileId}?uploadType=multipart&key=${driveConfig.apiKey}`, { method: 'PATCH', body: form });
        if (!res.ok) throw new Error('فشل الحفظ');
        showNotification('✅ تم حفظ المستخدمين', 'success');
        return true;
    } catch (error) {
        showNotification(`❌ خطأ: ${error.message}`, 'error');
        return false;
    } finally { setTimeout(hideProgress, 1500); }
}

function loadUsersFromBackup() {
    const backup = localStorage.getItem('backupUsers');
    if (backup) try { users = JSON.parse(backup); return true; } catch { return false; }
    return false;
}

function loadDefaultUsers() {
    users = [
        { id: 'user_admin', username: 'admin', email: 'admin@dchc-egdam.com', taxNumber: 'ADMIN001', contractCustomerId: 'ADMIN001', userType: 'admin', password: 'admin123', status: 'active', createdAt: new Date().toISOString(), lastLogin: null },
        { id: 'user_accountant', username: 'accountant', email: 'accountant@dchc-egdam.com', taxNumber: 'ACC001', contractCustomerId: 'ACC001', userType: 'accountant', password: 'acc123', status: 'active', createdAt: new Date().toISOString(), lastLogin: null },
        { id: 'msc', username: 'msc', email: 'customer@example.com', taxNumber: '202487288', contractCustomerId: 'MSC', userType: 'customer', password: 'msc123', status: 'active', createdAt: new Date().toISOString(), lastLogin: null },
        { id: 'one', username: 'one', email: 'accountant@dchc-egdam.com', taxNumber: '374380139', contractCustomerId: 'ONE', userType: 'accountant', password: 'one123', status: 'active', createdAt: new Date().toISOString(), lastLogin: null },
        { id: 'zim', username: 'zim', email: 'zim@gmail.com', taxNumber: '123456789', contractCustomerId: 'zim', userType: 'customer', password: 'zim123', status: 'active', createdAt: new Date().toISOString(), lastLogin: null }
    ];
    showNotification('تم استخدام المستخدمين الافتراضيين', 'warning');
}

async function loadUsers(forceRefresh = false) {
    if (forceRefresh) {
        if (await loadUsersFromDrive()) showNotification('تم تحديث المستخدمين', 'success');
        else if (!loadUsersFromBackup()) loadDefaultUsers();
    } else {
        if (!await loadUsersFromDrive()) {
            if (!loadUsersFromBackup()) loadDefaultUsers();
        }
    }
}

window.refreshUsersFromDrive = async function() {
    if (!currentUser || currentUser.userType !== 'admin') {
        showNotification('غير مصرح لك بتحديث المستخدمين', 'error');
        return;
    }
    const success = await loadUsersFromDrive();
    if (success) {
        renderUsersTable();
        showNotification('تم تحديث المستخدمين', 'success');
    } else {
        if (loadUsersFromBackup()) renderUsersTable();
        else showNotification('فشل التحديث', 'error');
    }
};

// ============================================
// دوال إدارة المستخدمين
// ============================================
function renderUsersTable() {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;
    tbody.innerHTML = users.map(u => `<tr>
        <td>${u.username}</td><td>${u.email}</td><td>${u.taxNumber || '-'}</td><td>${u.contractCustomerId || '-'}</td>
        <td>${{ admin: 'مدير', accountant: 'محاسب', customer: 'عميل' }[u.userType] || u.userType}</td>
        <td><span class="status-badge ${u.status}">${u.status === 'active' ? 'نشط' : 'غير نشط'}</span></td>
        <td>${u.lastLogin ? new Date(u.lastLogin).toLocaleString('ar-EG') : 'لم يسجل'}</td>
        <td>
            <button class="action-btn edit" onclick="editUser('${u.id}')"><i class="fas fa-edit"></i></button>
            <button class="action-btn reset" onclick="resetUserPassword('${u.id}')"><i class="fas fa-key"></i></button>
            <button class="action-btn delete" onclick="deleteUser('${u.id}')"><i class="fas fa-trash"></i></button>
        </td>
    </tr>`).join('');
}

window.showUserManagement = async function() {
    if (!currentUser || currentUser.userType !== 'admin') return alert('غير مصرح');
    await loadUsersFromDrive();
    renderUsersTable();
    document.getElementById('userManagementModal').style.display = 'block';
};

window.closeUserManagementModal = function() {
    document.getElementById('userManagementModal').style.display = 'none';
    cancelUserForm();
};

window.showAddUserForm = function() {
    if (!currentUser || currentUser.userType !== 'admin') return alert('غير مصرح');
    currentEditingUserId = null;
    document.getElementById('userFormTitle').textContent = 'إضافة مستخدم جديد';
    ['editUsername', 'editEmail', 'editTaxNumber', 'editContractCustomerId', 'editPassword'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('editUserType').value = 'customer';
    document.getElementById('editStatus').value = 'active';
    document.getElementById('userForm').style.display = 'block';
};

window.editUser = function(userId) {
    if (!currentUser || currentUser.userType !== 'admin') return alert('غير مصرح');
    const user = users.find(u => u.id === userId);
    if (!user) return;
    currentEditingUserId = userId;
    document.getElementById('userFormTitle').textContent = 'تعديل المستخدم';
    document.getElementById('editUsername').value = user.username;
    document.getElementById('editEmail').value = user.email;
    document.getElementById('editTaxNumber').value = user.taxNumber || '';
    document.getElementById('editContractCustomerId').value = user.contractCustomerId || '';
    document.getElementById('editUserType').value = user.userType;
    document.getElementById('editPassword').value = '';
    document.getElementById('editStatus').value = user.status;
    document.getElementById('userForm').style.display = 'block';
};

function cancelUserForm() {
    document.getElementById('userForm').style.display = 'none';
    currentEditingUserId = null;
}

window.saveUserFromForm = async function() {
    if (!currentUser || currentUser.userType !== 'admin') return alert('غير مصرح');
    const username = document.getElementById('editUsername').value.trim();
    const email = document.getElementById('editEmail').value.trim();
    const taxNumber = document.getElementById('editTaxNumber').value.trim();
    const contractCustomerId = document.getElementById('editContractCustomerId').value.trim();
    const userType = document.getElementById('editUserType').value;
    const password = document.getElementById('editPassword').value;
    const status = document.getElementById('editStatus').value;

    if (!username || !email) return alert('الرجاء إدخال اسم المستخدم والبريد الإلكتروني');
    if (!currentEditingUserId && !password) return alert('الرجاء إدخال كلمة مرور');

    if (currentEditingUserId) {
        const u = users.find(u => u.id === currentEditingUserId);
        if (u) { u.username = username; u.email = email; u.taxNumber = taxNumber; u.contractCustomerId = contractCustomerId; u.userType = userType; if (password) u.password = password; u.status = status; }
    } else users.push({ id: 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9), username, email, taxNumber, contractCustomerId, userType, password, status, createdAt: new Date().toISOString(), lastLogin: null });

    const saved = await saveUsersToDrive();
    localStorage.setItem('backupUsers', JSON.stringify(users));
    showNotification(saved ? 'تم الحفظ في Drive' : 'تم الحفظ محلياً', saved ? 'success' : 'warning');
    renderUsersTable();
    cancelUserForm();
};

window.resetUserPassword = async function(userId) {
    if (!currentUser || currentUser.userType !== 'admin') return alert('غير مصرح');
    const newPass = prompt('أدخل كلمة المرور الجديدة');
    if (!newPass) return;
    const u = users.find(u => u.id === userId);
    if (u) { u.password = newPass; await saveUsersToDrive(); localStorage.setItem('backupUsers', JSON.stringify(users)); renderUsersTable(); showNotification('تم تغيير كلمة المرور', 'success'); }
};

window.deleteUser = async function(userId) {
    if (!currentUser || currentUser.userType !== 'admin') return alert('غير مصرح');
    if (userId === currentUser?.id) return alert('لا يمكنك حذف نفسك');
    if (!confirm('هل أنت متأكد؟')) return;
    users = users.filter(u => u.id !== userId);
    await saveUsersToDrive();
    localStorage.setItem('backupUsers', JSON.stringify(users));
    renderUsersTable();
    showNotification('تم الحذف', 'success');
};

window.saveUsersManually = async function() {
    if (!currentUser || currentUser.userType !== 'admin') return showNotification('غير مصرح', 'error');
    await saveUsersToDrive();
};

// ============================================
// دوال تسجيل الدخول
// ============================================
function checkSession() {
    const saved = sessionStorage.getItem('currentUser');
    if (saved) try {
        currentUser = JSON.parse(saved);
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('mainApp').style.display = 'block';
        updateUserInterface();
        addDatabaseControls();
        setTimeout(() => loadInvoicesFromDrive(), 500);
        if (currentUser.userType === 'admin') setInterval(async () => { if (currentUser?.userType === 'admin') await loadUsersFromDrive(); }, 5 * 60 * 1000);
    } catch { sessionStorage.removeItem('currentUser'); }
}

window.switchLoginTab = function(tab) {
    document.querySelectorAll('.tab-btn, .login-form').forEach(el => el.classList.remove('active'));
    if (tab === 'login') { document.querySelectorAll('.tab-btn')[0].classList.add('active'); document.getElementById('loginForm').classList.add('active'); }
    else { document.querySelectorAll('.tab-btn')[1].classList.add('active'); document.getElementById('guestForm').classList.add('active'); }
    document.getElementById('loginMessage').style.display = 'none';
};

function showLoginMessage(msg, type) {
    const d = document.getElementById('loginMessage');
    d.textContent = msg; d.className = `login-message ${type}`; d.style.display = 'block';
}

window.handleLogin = async function() {
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    if (!username || !password) return showLoginMessage('الرجاء إدخال البيانات', 'error');
    await loadUsers(true);
    const user = users.find(u => (u.username === username || u.email === username) && u.status === 'active' && u.password === password);
    if (!user) return showLoginMessage('بيانات غير صحيحة', 'error');
    user.lastLogin = new Date().toISOString();
    currentUser = { ...user };
    sessionStorage.setItem('currentUser', JSON.stringify(currentUser));
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('mainApp').style.display = 'block';
    updateUserInterface();
    addDatabaseControls();
    setTimeout(() => loadInvoicesFromDrive(), 500);
};

window.handleGuestLogin = async function() {
    const taxNumber = document.getElementById('guestTaxNumber').value.trim();
    const blNumber = document.getElementById('guestBlNumber').value.trim();
    if (!taxNumber && !blNumber) return showLoginMessage('أدخل الرقم الضريبي أو البوليصة', 'error');
    currentUser = { id: 'guest_' + Date.now(), username: 'زائر', email: 'guest@temp.com', taxNumber: taxNumber || null, blNumber: blNumber || null, userType: 'customer', isGuest: true, lastLogin: new Date().toISOString() };
    sessionStorage.setItem('currentUser', JSON.stringify(currentUser));
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('mainApp').style.display = 'block';
    updateUserInterface();
    addDatabaseControls();
    setTimeout(() => loadInvoicesFromDrive().then(() => filterInvoicesByGuest(taxNumber, blNumber)), 500);
    let msg = 'مرحباً بك في وضع الزائر';
    if (taxNumber && blNumber) msg += ` - بحث عن: ضريبي ${taxNumber} وبوليصة ${blNumber}`;
    else if (taxNumber) msg += ` - بحث عن: ضريبي ${taxNumber}`;
    else if (blNumber) msg += ` - بحث عن: بوليصة ${blNumber}`;
    showNotification(msg, 'info');
};

window.logout = function() { currentUser = null; sessionStorage.removeItem('currentUser'); location.reload(); };

function updateUserInterface() {
    if (!currentUser) return;
    let displayName = currentUser.username, taxDisplay = '', badgeClass = '', badgeText = '';
    if (currentUser.isGuest) {
        displayName = 'زائر';
        taxDisplay = [currentUser.taxNumber ? `ضريبي: ${currentUser.taxNumber}` : '', currentUser.blNumber ? `بوليصة: ${currentUser.blNumber}` : ''].filter(Boolean).join(' | ');
        badgeClass = 'guest'; badgeText = 'زائر';
    } else {
        taxDisplay = `الرقم الضريبي: ${currentUser.taxNumber || 'غير محدد'}`;
        if (currentUser.contractCustomerId) taxDisplay += ` | رقم العقد: ${currentUser.contractCustomerId}`;
        badgeClass = currentUser.userType;
        badgeText = { admin: 'مدير', accountant: 'محاسب', customer: 'عميل' }[currentUser.userType] || currentUser.userType;
    }
    document.getElementById('currentUserDisplay').textContent = displayName;
    document.getElementById('userTaxDisplay').textContent = taxDisplay;
    const badge = document.getElementById('userTypeBadge');
    badge.textContent = badgeText; badge.className = `user-badge ${badgeClass}`;

    const isAdmin = currentUser.userType === 'admin';
    const isGuest = currentUser.isGuest;

    document.getElementById('driveSettingsBtn').style.display = isAdmin ? 'flex' : 'none';
    document.querySelector('[onclick="showChangePassword()"]').style.display = isGuest ? 'none' : 'flex';
    document.getElementById('adminPanelBtn').style.display = isAdmin ? 'flex' : 'none';
    document.querySelector('label[for="fileInput"]').style.display = isAdmin ? 'inline-flex' : 'none';
    document.querySelector('.btn-drive').style.display = isAdmin ? 'inline-flex' : 'none';
    document.getElementById('dbControls').style.display = isAdmin ? 'flex' : 'none';
}

window.showChangePassword = function() {
    ['currentPassword', 'newPassword', 'confirmNewPassword'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('changePasswordMessage').style.display = 'none';
    document.getElementById('changePasswordModal').style.display = 'block';
};

window.closeChangePasswordModal = function() { document.getElementById('changePasswordModal').style.display = 'none'; };

window.updatePassword = async function() {
    if (!currentUser || currentUser.isGuest) { alert('غير مسموح'); closeChangePasswordModal(); return; }
    const [current, newPass, confirm] = ['currentPassword', 'newPassword', 'confirmNewPassword'].map(id => document.getElementById(id).value);
    if (!current || !newPass || !confirm) return document.getElementById('changePasswordMessage').textContent = 'أدخل جميع الحقول' + (document.getElementById('changePasswordMessage').style.display = 'block');
    if (newPass !== confirm) return document.getElementById('changePasswordMessage').textContent = 'كلمة المرور غير متطابقة' + (document.getElementById('changePasswordMessage').style.display = 'block');
    const user = users.find(u => u.id === currentUser.id);
    if (!user || current !== user.password) return document.getElementById('changePasswordMessage').textContent = 'كلمة المرور الحالية غير صحيحة' + (document.getElementById('changePasswordMessage').style.display = 'block');
    user.password = newPass;
    await saveUsersToDrive();
    showNotification('تم تغيير كلمة المرور', 'success');
    closeChangePasswordModal();
};

// ============================================
// دوال قاعدة البيانات
// ============================================
function initDatabase() {
    return new Promise(resolve => {
        try {
            const req = indexedDB.open('InvoiceDB', 2);
            req.onerror = () => { useLocalStorageFallback(); resolve(); };
            req.onsuccess = e => { db = e.target.result; console.log('✅ تم فتح قاعدة البيانات'); resolve(); };
            req.onupgradeneeded = e => {
                const db = e.target.result;
                if (db.objectStoreNames.contains('invoices')) db.deleteObjectStore('invoices');
                if (db.objectStoreNames.contains('settings')) db.deleteObjectStore('settings');
                const store = db.createObjectStore('invoices', { keyPath: 'id', autoIncrement: true });
                ['final-number', 'draft-number', 'payee-customer-id', 'contract-customer-id', 'created', 'finalized-date'].forEach(idx => store.createIndex(idx, idx, { unique: false }));
                db.createObjectStore('settings', { keyPath: 'key' });
            };
        } catch { useLocalStorageFallback(); resolve(); }
    });
}

function useLocalStorageFallback() {
    try {
        const saved = localStorage.getItem('invoiceData');
        if (saved) { invoicesData = JSON.parse(saved); filterInvoicesByUser(); }
    } catch { }
}

async function saveData(showMsg = false) {
    if (!currentUser || currentUser.userType !== 'admin') return showNotification('غير مصرح', 'error');
    try {
        if (db) {
            const tx = db.transaction(['invoices'], 'readwrite');
            const store = tx.objectStore('invoices');
            await store.clear();
            for (const inv of invoicesData) await store.add(inv);
            await saveSetting('lastUpdate', new Date().toISOString());
            await saveSetting('invoiceCount', invoicesData.length);
        } else {
            localStorage.setItem('invoiceData', JSON.stringify(invoicesData));
            localStorage.setItem('lastUpdate', new Date().toISOString());
        }
        updateDataSource();
        if (showMsg) showNotification('تم حفظ البيانات', 'success');
    } catch { if (showMsg) showNotification('خطأ في الحفظ', 'error'); }
}

async function loadSavedData() {
    try {
        let loaded = false;
        if (db) {
            const data = await db.transaction(['invoices'], 'readonly').objectStore('invoices').getAll();
            if (data?.length) { invoicesData = data; loaded = true; }
        }
        if (!loaded) {
            const saved = localStorage.getItem('invoiceData');
            if (saved) { invoicesData = JSON.parse(saved); loaded = true; }
        }
        if (loaded) filterInvoicesByUser();
        updateDataSource();
    } catch { }
}

function saveSetting(key, value) {
    return db?.transaction(['settings'], 'readwrite').objectStore('settings').put({ key, value });
}

async function getSetting(key) {
    if (!db) return null;
    return new Promise(resolve => {
        const req = db.transaction(['settings'], 'readonly').objectStore('settings').get(key);
        req.onsuccess = () => resolve(req.result?.value || null);
    });
}

function showNotification(message, type) {
    const notif = document.createElement('div');
    Object.assign(notif.style, {
        position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)',
        background: type === 'success' ? '#10b981' : type === 'info' ? '#3b82f6' : '#ef4444',
        color: 'white', padding: '12px 24px', borderRadius: '50px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        zIndex: '10000', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.95em'
    });
    notif.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : type === 'info' ? 'info-circle' : 'exclamation-circle'}"></i><span>${message}</span>`;
    document.body.appendChild(notif);
    setTimeout(() => { notif.style.animation = 'slideUp 0.3s ease'; setTimeout(() => notif.remove(), 300); }, 3000);
}

function addDatabaseControls() {
    const toolbar = document.querySelector('.toolbar-section');
    if (!toolbar) return;
    const existing = document.querySelector('.db-controls');
    if (existing) existing.remove();
    if (currentUser?.userType === 'admin') {
        const c = document.createElement('div');
        c.className = 'db-controls';
        c.innerHTML = `<button class="btn btn-secondary" onclick="toggleAutoSave()"><i class="fas fa-${autoSaveEnabled ? 'toggle-on' : 'toggle-off'}"></i></button><button class="btn btn-save" onclick="saveData(true)"><i class="fas fa-save"></i> حفظ</button>`;
        toolbar.appendChild(c);
    }
}

window.toggleAutoSave = function() {
    if (!currentUser || currentUser.userType !== 'admin') return showNotification('غير مصرح', 'error');
    autoSaveEnabled = !autoSaveEnabled;
    const btn = document.querySelector('.db-controls button:first-child i');
    if (btn) btn.className = `fas fa-${autoSaveEnabled ? 'toggle-on' : 'toggle-off'}`;
    showNotification(`الحفظ التلقائي: ${autoSaveEnabled ? 'مفعل' : 'معطل'}`, 'info');
};

function updateDataSource() {
    const el = document.getElementById('dataSource');
    if (!el) return;
    const count = invoicesData.length;
    const lastUpdate = localStorage.getItem('lastUpdate') || 'غير معروف';
    const date = lastUpdate !== 'غير معروف' ? ` (آخر تحديث: ${new Date(lastUpdate).toLocaleString('ar-EG')})` : '';
    el.innerHTML = `${db ? '📦' : '💾'} ${count} فاتورة - ${db ? 'قاعدة بيانات محلية' : 'تخزين مؤقت'}${date}`;
}

// ============================================
// دوال التبديل بين أنواع الفواتير
// ============================================
window.switchInvoiceType = function(type) {
    currentInvoiceType = type;
    document.querySelectorAll('.type-tab').forEach((btn, i) => btn.classList.toggle('active', (i === 0 && type === INVOICE_TYPES.CASH) || (i === 1 && type === INVOICE_TYPES.POSTPONED)));
    filterInvoicesByUser();
};

// ============================================
// دوال رفع الملفات وتحليل XML
// ============================================
function handleFileUpload(event) {
    if (!currentUser || currentUser.userType !== 'admin') { showNotification('غير مصرح', 'error'); event.target.value = ''; return; }
    const file = event.target.files[0];
    if (!file) return;
    document.getElementById('fileStatus').innerHTML = `<i class="fas fa-spinner fa-spin"></i> جاري تحميل: ${file.name}...`;
    const reader = new FileReader();
    reader.onload = e => { try { parseXMLContent(e.target.result, file.name); } catch { document.getElementById('fileStatus').innerHTML = '<i class="fas fa-exclamation-circle"></i> ❌ خطأ'; } };
    reader.onerror = () => document.getElementById('fileStatus').innerHTML = '<i class="fas fa-exclamation-circle"></i> ❌ خطأ';
    reader.readAsText(file);
}

window.parseXMLContent = async function(xmlString, source) {
    try {
        showProgress('جاري تحليل الملف...', 20);
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
        const parseError = xmlDoc.querySelector('parsererror');
        let newInvoices = [];

        if (parseError) {
            const matches = xmlString.match(/<invoice[\s\S]*?<\/invoice>/g);
            if (!matches?.length) throw new Error('لا توجد فواتير');
            const wrapped = parser.parseFromString(`<root>${matches.join('')}</root>`, 'text/xml');
            const nodes = wrapped.querySelectorAll('invoice');
            for (let i = 0; i < nodes.length; i++) { const inv = parseInvoiceNode(nodes[i]); if (inv) newInvoices.push(inv); }
        } else {
            const nodes = xmlDoc.getElementsByTagName('invoice');
            for (let i = 0; i < nodes.length; i++) { const inv = parseInvoiceNode(nodes[i]); if (inv) newInvoices.push(inv); }
        }

        if (!newInvoices.length) throw new Error('لا توجد فواتير');
        invoicesData = newInvoices;
        showProgress('تم التحديث', 100);
        currentUser?.isGuest ? filterInvoicesByGuest(currentUser.taxNumber, currentUser.blNumber) : filterInvoicesByUser();
        document.getElementById('fileStatus').innerHTML = `<i class="fas fa-check-circle"></i> ✅ تم تحديث ${invoicesData.length} فاتورة من ${source}`;
        updateDataSource();
    } catch (error) {
        document.getElementById('fileStatus').innerHTML = `<i class="fas fa-exclamation-circle"></i> ❌ خطأ: ${error.message}`;
        if (!currentUser?.isGuest) { invoicesData = []; filteredInvoices = []; renderData(); }
        hideProgress();
    }
};

// ============================================
// دوال تحليل عقدة الفاتورة
// ============================================
function parseInvoiceNode(invoice) {
    try {
        const exRate = parseFloat(invoice.getAttribute('flex-string-06') || 48.0215);
        const obj = {
            'draft-number': invoice.getAttribute('draft-number') || '',
            'final-number': invoice.getAttribute('final-number') || '',
            'finalized-date': invoice.getAttribute('finalized-date') || '',
            'status': invoice.getAttribute('status') || '',
            'invoice-type-id': invoice.getAttribute('invoice-type-id') || '',
            'currency': invoice.getAttribute('currency') || '',
            'payee-customer-id': invoice.getAttribute('payee-customer-id') || '',
            'payee-customer-role': invoice.getAttribute('payee-customer-role') || '',
            'contract-customer-id': invoice.getAttribute('contract-customer-id') || '',
            'contract-customer-role': invoice.getAttribute('contract-customer-role') || '',
            'total-charges': parseFloat(invoice.getAttribute('total-charges') || 0),
            'total-discounts': parseFloat(invoice.getAttribute('total-discounts') || 0),
            'total-taxes': parseFloat(invoice.getAttribute('total-taxes') || 0),
            'total-total': parseFloat(invoice.getAttribute('total-total') || 0),
            'total-credits': parseFloat(invoice.getAttribute('total-credits') || 0),
            'total-credit-taxes': parseFloat(invoice.getAttribute('total-credit-taxes') || 0),
            'total-paid': parseFloat(invoice.getAttribute('total-paid') || 0),
            'total-owed': parseFloat(invoice.getAttribute('total-owed') || 0),
            'key-word1': invoice.getAttribute('key-word1') || '',
            'key-word2': invoice.getAttribute('key-word2') || '',
            'key-word3': invoice.getAttribute('key-word3') || '',
            'facility-id': invoice.getAttribute('facility-id') || '',
            'facility-name': invoice.getAttribute('facility-name') || '',
            'flex-string-02': invoice.getAttribute('flex-string-02') || '',
            'flex-string-03': invoice.getAttribute('flex-string-03') || '',
            'flex-string-04': invoice.getAttribute('flex-string-04') || '',
            'flex-string-05': invoice.getAttribute('flex-string-05') || '',
            'flex-string-06': exRate,
            'flex-string-10': invoice.getAttribute('flex-string-10') || '',
            'flex-date-02': invoice.getAttribute('flex-date-02') || '',
            'flex-date-03': invoice.getAttribute('flex-date-03') || '',
            'created': invoice.getAttribute('created') || '',
            'creator': invoice.getAttribute('creator') || '',
            'changed': invoice.getAttribute('changed') || '',
            'changer': invoice.getAttribute('changer') || '',
            'charges': [], 'containers': []
        };

        const charges = invoice.getElementsByTagName('charge');
        for (let j = 0; j < charges.length; j++) {
            const charge = charges[j];
            let storageDays = 1;
            const from = charge.getAttribute('event-performed-from');
            const to = charge.getAttribute('event-performed-to');
            if (from && to) {
                const d1 = new Date(from), d2 = new Date(to);
                if (!isNaN(d1) && !isNaN(d2)) storageDays = Math.ceil(Math.abs(d2 - d1) / (1000 * 60 * 60 * 24)) + 1;
            }
            const chargeObj = {
                'event-type-id': charge.getAttribute('event-type-id') || '',
                'entity-id': charge.getAttribute('entity-id') || '',
                'tariff-id': charge.getAttribute('tariff-id') || '',
                'description': charge.getAttribute('description') || '',
                'event-performed-from': from || '',
                'event-performed-to': to || '',
                'paid-thru-day': charge.getAttribute('paid-thru-day') || '',
                'extract-class': charge.getAttribute('extract-class') || '',
                'rate-billed': parseFloat(charge.getAttribute('rate-billed') || 0),
                'quantity-billed': 1,
                'amount': parseFloat(charge.getAttribute('amount') || 0),
                'is-flat-rate': charge.getAttribute('is-flat-rate') || '',
                'flat-rate-amount': parseFloat(charge.getAttribute('flat-rate-amount') || 0),
                'exchange-rate': parseFloat(charge.getAttribute('exchange-rate') || exRate),
                'created': charge.getAttribute('created') || '',
                'storage-days': storageDays,
                'quantity': 1,
                'containerNumbers': [],
                'taxes': []
            };
            if (chargeObj['entity-id']) {
                chargeObj.containerNumbers.push(chargeObj['entity-id']);
                obj.containers.push(chargeObj['entity-id']);
            }
            const taxes = charge.getElementsByTagName('tax');
            for (let k = 0; k < taxes.length; k++) {
                const tax = taxes[k];
                chargeObj.taxes.push({ amount: parseFloat(tax.getAttribute('amount') || 0), created: tax.getAttribute('created') || '' });
            }
            obj.charges.push(chargeObj);
        }
        obj.containers = [...new Set(obj.containers)];
        return obj;
    } catch (error) {
        console.error('خطأ في تحليل الفاتورة:', error);
        return null;
    }
}

// ============================================
// دوال البحث المتقدم - معدلة لاستخدام finalized-date
// ============================================
window.applyAdvancedSearch = function() {
    if (!invoicesData.length) { filteredInvoices = []; renderData(); return; }
    
    const [final, draft, cust, vessel, bl, cont, status, from, to, invType] = [
        'searchFinalNumber', 'searchDraftNumber', 'searchCustomer', 'searchVessel', 'searchBlNumber', 'searchContainer', 'searchStatus', 'searchDateFrom', 'searchDateTo', 'searchInvoiceType'
    ].map(id => document.getElementById(id)?.value.toLowerCase().trim() || '');

    let tempInvoices = [...invoicesData];

    if (currentUser?.isGuest) {
        const { taxNumber, blNumber } = currentUser;
        tempInvoices = tempInvoices.filter(inv => {
            let match = true;
            if (taxNumber) {
                const num = inv['final-number'] || '';
                if (num.startsWith('P') || num.startsWith('p')) return false;
                const payeeMatch = (inv['payee-customer-id'] || '').toLowerCase().includes(taxNumber.toLowerCase());
                const contractMatch = (inv['contract-customer-id'] || '').toLowerCase().includes(taxNumber.toLowerCase());
                match = match && (payeeMatch || contractMatch);
            }
            if (blNumber) match = match && (inv['key-word2'] || '').toLowerCase().includes(blNumber.toLowerCase());
            return match;
        });
    } else if (currentUser && currentUser.userType !== 'admin' && !currentUser.isGuest) {
        const tax = currentUser.taxNumber || '';
        const contractId = currentUser.contractCustomerId || '';
        tempInvoices = tempInvoices.filter(inv => {
            const num = inv['final-number'] || '';
            const isPostponed = num.startsWith('P') || num.startsWith('p');
            if (isPostponed) return contractId && (inv['contract-customer-id'] || '').trim().toLowerCase() === contractId.trim().toLowerCase();
            else return (inv['payee-customer-id'] || '').toLowerCase().includes(tax.toLowerCase()) || (inv['contract-customer-id'] || '').toLowerCase().includes(tax.toLowerCase());
        });
    }

    const searched = tempInvoices.filter(inv => {
        if (final && !(inv['final-number'] || '').toLowerCase().includes(final)) return false;
        if (draft && !(inv['draft-number'] || '').toLowerCase().includes(draft)) return false;
        if (cust && !(inv['payee-customer-id'] || '').toLowerCase().includes(cust)) return false;
        if (vessel && !(inv['key-word1'] || '').toLowerCase().includes(vessel)) return false;
        if (bl && !(inv['key-word2'] || '').toLowerCase().includes(bl)) return false;
        if (cont) {
            const found = inv.charges.some(c => (c['entity-id'] || '').toLowerCase().includes(cont));
            if (!found) return false;
        }
        if (status && inv['status'] !== status) return false;
        if (invType) {
            const num = inv['final-number'] || '';
            if (invType === 'cash' && !(num.startsWith('C') || num.startsWith('c'))) return false;
            if (invType === 'postponed' && !(num.startsWith('P') || num.startsWith('p'))) return false;
        }
        if (from || to) {
            const invDateStr = inv['finalized-date'] || inv['created'] || '';
            const invDate = new Date(invDateStr);
            if (isNaN(invDate)) return true;
            
            if (from) {
                const fromDate = new Date(from);
                fromDate.setHours(0, 0, 0, 0);
                if (invDate < fromDate) return false;
            }
            if (to) {
                const toDate = new Date(to);
                toDate.setHours(23, 59, 59, 999);
                if (invDate > toDate) return false;
            }
        }
        return true;
    });

    filteredInvoices = searched;
    currentPage = 1;
    clearSelectedInvoices();
    renderData();
    showNotification(`تم العثور على ${filteredInvoices.length} فاتورة`, filteredInvoices.length ? 'success' : 'info');
};

window.resetAdvancedSearch = function() {
    ['searchFinalNumber', 'searchDraftNumber', 'searchCustomer', 'searchVessel', 'searchBlNumber', 'searchContainer', 'searchStatus', 'searchDateFrom', 'searchDateTo', 'searchInvoiceType']
        .forEach(id => document.getElementById(id).value = '');
    currentUser?.isGuest ? filterInvoicesByGuest(currentUser.taxNumber, currentUser.blNumber) : filterInvoicesByUser();
    clearSelectedInvoices();
    showNotification('تم إعادة ضبط البحث', 'info');
};

// ============================================
// دوال عرض البيانات
// ============================================
function filterInvoicesByUser() {
    if (!invoicesData.length) { filteredInvoices = []; renderData(); return; }
    let temp = [...invoicesData];

    if (currentUser?.isGuest) return filterInvoicesByGuest(currentUser.taxNumber, currentUser.blNumber);

    if (currentUser && currentUser.userType !== 'admin' && !currentUser.isGuest) {
        const tax = currentUser.taxNumber || '';
        const contractId = currentUser.contractCustomerId || '';
        temp = temp.filter(inv => {
            const num = inv['final-number'] || '';
            const isPostponed = num.startsWith('P') || num.startsWith('p');
            if (isPostponed) return contractId && (inv['contract-customer-id'] || '').trim().toLowerCase() === contractId.trim().toLowerCase();
            else return (inv['payee-customer-id'] || '').toLowerCase().includes(tax.toLowerCase()) || (inv['contract-customer-id'] || '').toLowerCase().includes(tax.toLowerCase());
        });
    }

    temp = temp.filter(inv => {
        const num = inv['final-number'] || '';
        return currentInvoiceType === INVOICE_TYPES.CASH ? (num.startsWith('C') || num.startsWith('c')) : (num.startsWith('P') || num.startsWith('p'));
    });

    filteredInvoices = temp;
    currentPage = 1;
    clearSelectedInvoices();
    renderData();
}

function filterInvoicesByGuest(taxNumber, blNumber) {
    if (!invoicesData.length) { filteredInvoices = []; renderData(); showNotification('لا توجد بيانات', 'warning'); return; }
    filteredInvoices = invoicesData.filter(inv => {
        let match = true;
        if (taxNumber) {
            const num = inv['final-number'] || '';
            if (num.startsWith('P') || num.startsWith('p')) return false;
            const payeeMatch = (inv['payee-customer-id'] || '').toLowerCase().includes(taxNumber.toLowerCase());
            const contractMatch = (inv['contract-customer-id'] || '').toLowerCase().includes(taxNumber.toLowerCase());
            match = match && (payeeMatch || contractMatch);
        }
        if (blNumber) match = match && (inv['key-word2'] || '').toLowerCase().includes(blNumber.toLowerCase());
        return match;
    });
    currentPage = 1;
    clearSelectedInvoices();
    renderData();
    if (!filteredInvoices.length) {
        let msg = 'لم يتم العثور على فواتير';
        if (taxNumber && blNumber) msg += ` للضريبي ${taxNumber} والبوليصة ${blNumber}`;
        else if (taxNumber) msg += ` للضريبي ${taxNumber}`;
        else if (blNumber) msg += ` للبوليصة ${blNumber}`;
        showNotification(msg, 'warning');
    } else showNotification(`تم العثور على ${filteredInvoices.length} فاتورة`, 'success');
}

function renderData() {
    if (filteredInvoices.length === 0) {
        document.getElementById('dataViewContainer').innerHTML = '<div class="no-data"><i class="fas fa-inbox fa-3x"></i><p>لا توجد بيانات للعرض</p></div>';
        updateSummary();
        document.getElementById('pagination').innerHTML = '';
        return;
    }
    const sorted = sortInvoices(filteredInvoices, currentSortField, sortOrder);
    const totalPages = itemsPerPage === Infinity ? 1 : Math.ceil(sorted.length / itemsPerPage);
    const start = itemsPerPage === Infinity ? 0 : (currentPage - 1) * itemsPerPage;
    const end = itemsPerPage === Infinity ? sorted.length : Math.min(start + itemsPerPage, sorted.length);
    const pageData = sorted.slice(start, end);
    
    if (viewMode === 'table') renderTableView(pageData);
    else renderCardsView(pageData);
    
    updateSummary();
    renderPagination(totalPages);
}

function renderCardsView(data) {
    let html = '<div class="cards-container">';
    data.forEach(inv => {
        const idx = invoicesData.indexOf(inv);
        const voyageDate = inv['flex-date-02'] ? new Date(inv['flex-date-02']).toLocaleDateString('ar-EG') : 'غير محدد';
        const finalNum = inv['final-number'] || '';
        const invoiceTypeDisplay = finalNum.startsWith('P') || finalNum.startsWith('p') ? 'أجل' : 'نقدي';
        const currency = inv['currency'] || 'EGP';
        const exRate = inv['flex-string-06'] || 48.0215;
        const totalOriginal = inv['total-total'] || 0;
        let displayAmount, displayCurrency;
        if (currency === 'USAD') { displayAmount = (totalOriginal / exRate).toFixed(2); displayCurrency = 'USAD'; }
        else { displayAmount = totalOriginal.toFixed(2); displayCurrency = 'EGP'; }
        html += `
            <div class="invoice-card" onclick="showInvoiceDetails(${idx})" style="cursor: pointer;">
                <div class="card-header">
                    <h3>${inv['final-number'] || '-'} <span style="font-size:0.7em; background:rgba(255,255,255,0.2); padding:2px 6px; border-radius:4px;">${currency}</span></h3>
                    <span class="card-badge">${invoiceTypeDisplay}</span>
                </div>
                <div class="card-body">
                    <div class="card-row"><span class="card-label">العميل:</span><span class="card-value">${(inv['payee-customer-id'] || '-').substring(0, 25)}</span></div>
                    <div class="vessel-info">
                        <div class="vessel-info-row"><span>السفينة:</span><span><strong>${inv['key-word1'] || '-'}</strong></span></div>
                        <div class="vessel-info-row"><span>البوليصة:</span><span>${inv['key-word2'] || '-'}</span></div>
                        <div class="vessel-info-row"><span>تاريخ الرحله:</span><span class="voyage-date">${voyageDate}</span></div>
                    </div>
                    <div class="card-row"><span class="card-label">المسودة:</span><span class="card-value">${inv['draft-number'] || '-'}</span></div>
                    <div class="card-row"><span class="card-label">العملة:</span><span class="card-value">${currency}</span></div>
                    <div class="card-row"><span class="card-label">سعر الصرف:</span><span class="card-value">${exRate.toFixed(4)}</span></div>
                </div>
                <div class="card-footer">
                    <span>الإجمالي:</span>
                    <span class="card-total">${displayAmount} ${displayCurrency}</span>
                </div>
            </div>`;
    });
    html += '</div>';
    document.getElementById('dataViewContainer').innerHTML = html;
}

function sortInvoices(invoices, field, order) {
    return [...invoices].sort((a, b) => {
        let va = a[field] || '', vb = b[field] || '';
        if (typeof va === 'number' && typeof vb === 'number') return order === 'asc' ? va - vb : vb - va;
        va = String(va).toLowerCase(); vb = String(vb).toLowerCase();
        return order === 'asc' ? va.localeCompare(vb, 'ar') : vb.localeCompare(va, 'ar');
    });
}

window.toggleSortOrder = function() {
    sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    const icon = document.querySelector('#sortToggle i');
    if (icon) icon.className = sortOrder === 'asc' ? 'fas fa-sort-amount-down-alt' : 'fas fa-sort-amount-up-alt';
    clearSelectedInvoices();
    renderData();
};

window.changeItemsPerPage = function() {
    const select = document.getElementById('itemsPerPage');
    itemsPerPage = select.value === 'all' ? Infinity : parseInt(select.value);
    currentPage = 1;
    clearSelectedInvoices();
    renderData();
};

window.setViewMode = function(mode) {
    viewMode = mode;
    clearSelectedInvoices();
    document.querySelectorAll('.btn-view').forEach((btn, i) => btn.classList.toggle('active', (i === 0 && mode === 'table') || (i === 1 && mode === 'cards')));
    renderData();
};

window.toggleAdvancedSearch = function() {
    const body = document.getElementById('advancedSearchBody');
    const icon = document.getElementById('searchToggleIcon');
    if (body && icon) {
        body.classList.toggle('show');
        icon.style.transform = body.classList.contains('show') ? 'rotate(180deg)' : 'rotate(0)';
    }
};

function updateSummary() {
    const count = filteredInvoices.length;
    let totalEGP = 0, taxEGP = 0, totalUSD = 0, totalEGPWithoutTax = 0, totalMartyr = 0;
    
    filteredInvoices.forEach(inv => {
        const currency = inv['currency'] || 'EGP';
        const total = inv['total-total'] || 0;
        const taxes = inv['total-taxes'] || 0;
        const exRate = inv['flex-string-06'] || 48.0215;
        const finalNum = inv['final-number'] || '';
        const isPostponed = finalNum.startsWith('P') || finalNum.startsWith('p');
        if (!(isPostponed && currency === 'USAD')) totalMartyr += 5;
        
        if (currency === 'USAD') totalUSD += total / exRate;
        else { totalEGP += total; taxEGP += taxes; totalEGPWithoutTax += (total - taxes); }
    });

    document.getElementById('invoiceCount').textContent = count;
    document.getElementById('totalSum').textContent = totalEGP.toFixed(2);
    document.getElementById('taxSum').textContent = taxEGP.toFixed(2);
    document.getElementById('totalUSD').textContent = totalUSD.toFixed(2);
    document.getElementById('totalEGPWithoutTax').textContent = totalEGPWithoutTax.toFixed(2);
    document.getElementById('totalMartyr').textContent = totalMartyr.toFixed(2);
    document.getElementById('totalInvoicesHeader').textContent = count;
    document.getElementById('totalCustomers').textContent = new Set(filteredInvoices.map(i => i['payee-customer-id'])).size;
    document.getElementById('totalVessels').textContent = new Set(filteredInvoices.map(i => i['key-word1']).filter(v => v)).size;
}

function renderPagination(totalPages) {
    if (itemsPerPage === Infinity || totalPages <= 1) { document.getElementById('pagination').innerHTML = ''; return; }
    let html = `<button class="pagination-btn" onclick="changePage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}><i class="fas fa-chevron-right"></i></button>`;
    const maxPages = 5;
    let start = Math.max(1, currentPage - Math.floor(maxPages / 2));
    let end = Math.min(totalPages, start + maxPages - 1);
    if (end - start + 1 < maxPages) start = Math.max(1, end - maxPages + 1);
    if (start > 1) {
        html += `<button class="pagination-btn" onclick="changePage(1)">1</button>`;
        if (start > 2) html += `<span class="pagination-btn disabled">...</span>`;
    }
    for (let i = start; i <= end; i++) html += `<button class="pagination-btn ${i === currentPage ? 'active' : ''}" onclick="changePage(${i})">${i}</button>`;
    if (end < totalPages) {
        if (end < totalPages - 1) html += `<span class="pagination-btn disabled">...</span>`;
        html += `<button class="pagination-btn" onclick="changePage(${totalPages})">${totalPages}</button>`;
    }
    html += `<button class="pagination-btn" onclick="changePage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}><i class="fas fa-chevron-left"></i></button>`;
    document.getElementById('pagination').innerHTML = html;
}

window.changePage = function(page) {
    const totalPages = itemsPerPage === Infinity ? 1 : Math.ceil(filteredInvoices.length / itemsPerPage);
    if (page >= 1 && page <= totalPages) { currentPage = page; clearSelectedInvoices(); renderData(); }
};

// ============================================
// دوال التحكم في التحديد
// ============================================
window.handleRowClick = function(index, event) {
    if (event.target.type === 'checkbox') return;
    showInvoiceDetails(index);
};

window.updateSelectedInvoices = function(index, isSelected) {
    if (isSelected) selectedInvoices.add(index);
    else selectedInvoices.delete(index);
    updateSelectedCount();
    updateSelectAllCheckbox();
    const row = document.querySelector(`tr:has(.invoice-checkbox[data-index="${index}"])`);
    if (row) row.classList.toggle('selected-row', isSelected);
};

window.selectAllInvoices = function() {
    document.querySelectorAll('.invoice-checkbox').forEach(cb => {
        cb.checked = true;
        const index = parseInt(cb.dataset.index);
        selectedInvoices.add(index);
        const row = document.querySelector(`tr:has(.invoice-checkbox[data-index="${index}"])`);
        if (row) row.classList.add('selected-row');
    });
    updateSelectedCount();
    const selectAll = document.getElementById('selectAllCheckbox');
    if (selectAll) selectAll.checked = true;
};

window.deselectAllInvoices = function() {
    document.querySelectorAll('.invoice-checkbox').forEach(cb => {
        cb.checked = false;
        const index = parseInt(cb.dataset.index);
        selectedInvoices.delete(index);
        const row = document.querySelector(`tr:has(.invoice-checkbox[data-index="${index}"])`);
        if (row) row.classList.remove('selected-row');
    });
    updateSelectedCount();
    const selectAll = document.getElementById('selectAllCheckbox');
    if (selectAll) selectAll.checked = false;
};

window.toggleAllCheckboxes = function(selectAllCheckbox) {
    document.querySelectorAll('.invoice-checkbox').forEach(cb => {
        cb.checked = selectAllCheckbox.checked;
        const index = parseInt(cb.dataset.index);
        if (selectAllCheckbox.checked) selectedInvoices.add(index);
        else selectedInvoices.delete(index);
        const row = document.querySelector(`tr:has(.invoice-checkbox[data-index="${index}"])`);
        if (row) row.classList.toggle('selected-row', selectAllCheckbox.checked);
    });
    updateSelectedCount();
};

function updateSelectedCount() {
    const count = selectedInvoices.size;
    const countSpan = document.getElementById('selectedCount');
    const pdfBtn = document.getElementById('exportSelectedBtn');
    const excelBtn = document.getElementById('exportSelectedExcelBtn');
    const containersBtn = document.getElementById('exportContainersBtn');
    if (countSpan) countSpan.textContent = count;
    if (pdfBtn) pdfBtn.disabled = count === 0;
    if (excelBtn) excelBtn.disabled = count === 0;
    if (containersBtn) containersBtn.disabled = count === 0;
}

function updateSelectAllCheckbox() {
    const checkboxes = document.querySelectorAll('.invoice-checkbox');
    const selectAll = document.getElementById('selectAllCheckbox');
    if (!selectAll || !checkboxes.length) return;
    const allChecked = Array.from(checkboxes).every(cb => cb.checked);
    selectAll.checked = allChecked;
    selectAll.indeterminate = !allChecked && Array.from(checkboxes).some(cb => cb.checked);
}

function clearSelectedInvoices() {
    selectedInvoices.clear();
    updateSelectedCount();
}

// ============================================
// دوال تجميع المصاريف
// ============================================

// دوال تجميع المصاريف للفواتير النقدية
function groupCashCharges(charges) {
    const sortedCharges = [...charges].sort((a, b) => (a['event-type-id'] || '').localeCompare(b['event-type-id'] || ''));
    const grouped = [], map = new Map();
    sortedCharges.forEach(c => {
        const key = `${c.description || ''}-${c['event-type-id'] || ''}-${c['storage-days'] || 1}`;
        const storageDays = c['storage-days'] || 1;
        if (map.has(key)) {
            const ex = map.get(key);
            ex.quantity += 1;
            ex.amount += (c.amount || 0);
            if (c.containerNumbers?.length) c.containerNumbers.forEach(cont => { if (!ex.containerNumbers.includes(cont)) ex.containerNumbers.push(cont); });
            if (c['event-performed-from'] || c['event-performed-to']) ex.dates.push({ from: c['event-performed-from'] || '-', to: c['event-performed-to'] || '-', days: storageDays });
        } else {
            const newC = { ...c, quantity: 1, containerNumbers: [...(c.containerNumbers || [])], totalStorageDays: storageDays, dates: [] };
            if (c['event-performed-from'] || c['event-performed-to']) newC.dates.push({ from: c['event-performed-from'] || '-', to: c['event-performed-to'] || '-', days: storageDays });
            map.set(key, newC);
            grouped.push(newC);
        }
    });
    return grouped;
}

// دوال تجميع المصاريف للفواتير الآجلة
function groupPostponedCharges(charges) {
    const sortedCharges = [...charges].sort((a, b) => (a['event-type-id'] || '').localeCompare(b['event-type-id'] || ''));
    const grouped = [], map = new Map();
    sortedCharges.forEach(c => {
        const key = `${c.description || ''}-${c['event-type-id'] || ''}`;
        const storageDays = c['storage-days'] || 1;
        if (map.has(key)) {
            const ex = map.get(key);
            ex.quantity += 1;
            ex.totalStorageDays += storageDays;
            ex.amount += (c.amount || 0);
            if (c.containerNumbers?.length) c.containerNumbers.forEach(cont => { if (!ex.containerNumbers.includes(cont)) ex.containerNumbers.push(cont); });
            if (c['event-performed-from'] || c['event-performed-to']) ex.dates.push({ from: c['event-performed-from'] || '-', to: c['event-performed-to'] || '-', days: storageDays });
        } else {
            const newC = { ...c, quantity: 1, containerNumbers: [...(c.containerNumbers || [])], totalStorageDays: storageDays, dates: [] };
            if (c['event-performed-from'] || c['event-performed-to']) newC.dates.push({ from: c['event-performed-from'] || '-', to: c['event-performed-to'] || '-', days: storageDays });
            map.set(key, newC);
            grouped.push(newC);
        }
    });
    return grouped;
}

// ============================================
// دوال تصدير الحاويات - إضافة جديدة
// ============================================

/**
 * تصدير تفاصيل الحاويات للفواتير المحددة
 */
window.exportSelectedContainers = async function() {
    if (selectedInvoices.size === 0) {
        showNotification('لم يتم تحديد أي فواتير', 'warning');
        return;
    }
    
    const selectedIndices = Array.from(selectedInvoices).sort((a, b) => a - b);
    showProgress(`جاري تجهيز بيانات الحاويات من ${selectedIndices.length} فاتورة...`, 30);
    
    try {
        // تجميع كل الحاويات من جميع الفواتير المحددة
        let allContainers = [];
        let containerCounter = 0;
        
        selectedIndices.forEach(index => {
            const inv = invoicesData[index];
            const finalNum = inv['final-number'] || '';
            const isPostponed = finalNum.startsWith('P') || finalNum.startsWith('p');
            const grouped = isPostponed ? groupPostponedCharges(inv.charges) : groupCashCharges(inv.charges);
            
            grouped.forEach(charge => {
                if (charge.containerNumbers?.length > 0) {
                    charge.containerNumbers.forEach((container, idx) => {
                        const dateInfo = charge.dates && charge.dates[idx] ? charge.dates[idx] : {
                            from: charge['event-performed-from'] || '-',
                            to: charge['event-performed-to'] || '-',
                            days: charge['storage-days'] || 1
                        };
                        
                        allContainers.push({
                            'رقم': ++containerCounter,
                            'رقم الفاتورة': inv['final-number'] || '-',
                            'رقم المسودة': inv['draft-number'] || '-',
                            'العميل': inv['payee-customer-id'] || '-',
                            'السفينة': inv['key-word1'] || '-',
                            'البوليصة': inv['key-word2'] || '-',
                            'الوصف': charge.description || '-',
                            'نوع المصروف': charge['event-type-id'] || '-',
                            'رقم الحاوية': container,
                            'التاريخ من': dateInfo.from,
                            'التاريخ إلى': dateInfo.to,
                            'عدد الأيام': dateInfo.days,
                            'سعر الوحدة': (charge['rate-billed'] || 0).toFixed(2),
                            'المبلغ': (charge.amount || 0).toFixed(2),
                            'العملة': (isPostponed && inv['currency'] === 'USAD') ? 'USAD' : 'EGP'
                        });
                    });
                }
            });
        });
        
        if (allContainers.length === 0) {
            showNotification('لا توجد حاويات في الفواتير المحددة', 'info');
            hideProgress();
            return;
        }
        
        showProgress('جاري إنشاء ملف Excel...', 70);
        
        // إنشاء بيانات Excel
        const excelData = [
            ['تقرير تفاصيل الحاويات'],
            ['تاريخ التقرير: ' + new Date().toLocaleDateString('ar-EG')],
            ['عدد الفواتير: ' + selectedIndices.length],
            ['عدد الحاويات: ' + allContainers.length],
            [],
            ['م', 'رقم الفاتورة', 'رقم المسودة', 'العميل', 'السفينة', 'البوليصة', 'الوصف', 'نوع المصروف', 'رقم الحاوية', 'التاريخ من', 'التاريخ إلى', 'عدد الأيام', 'سعر الوحدة', 'المبلغ', 'العملة']
        ];
        
        allContainers.forEach(c => {
            excelData.push([
                c['رقم'].toString(),
                c['رقم الفاتورة'],
                c['رقم المسودة'],
                c['العميل'],
                c['السفينة'],
                c['البوليصة'],
                c['الوصف'],
                c['نوع المصروف'],
                c['رقم الحاوية'],
                c['التاريخ من'],
                c['التاريخ إلى'],
                c['عدد الأيام'].toString(),
                c['سعر الوحدة'],
                c['المبلغ'],
                c['العملة']
            ]);
        });
        
        // إضافة ملخص
        excelData.push([]);
        excelData.push(['ملخص']);
        excelData.push(['إجمالي عدد الحاويات:', allContainers.length]);
        
        // حساب إجمالي المبالغ
        const totalAmount = allContainers.reduce((sum, c) => sum + parseFloat(c['المبلغ']), 0);
        excelData.push(['إجمالي المبالغ:', totalAmount.toFixed(2)]);
        
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(excelData);
        
        // ضبط عرض الأعمدة
        ws['!cols'] = [
            { wch: 5 },   // م
            { wch: 15 },  // رقم الفاتورة
            { wch: 15 },  // رقم المسودة
            { wch: 25 },  // العميل
            { wch: 20 },  // السفينة
            { wch: 15 },  // البوليصة
            { wch: 30 },  // الوصف
            { wch: 15 },  // نوع المصروف
            { wch: 20 },  // رقم الحاوية
            { wch: 15 },  // التاريخ من
            { wch: 15 },  // التاريخ إلى
            { wch: 10 },  // عدد الأيام
            { wch: 15 },  // سعر الوحدة
            { wch: 15 },  // المبلغ
            { wch: 8 }    // العملة
        ];
        
        XLSX.utils.book_append_sheet(wb, ws, 'تفاصيل الحاويات');
        
        // اسم الملف
        let fileName;
        if (selectedIndices.length === 1) {
            fileName = `حاويات-${invoicesData[selectedIndices[0]]['final-number'] || 'فاتورة'}.xlsx`;
        } else {
            const firstNum = invoicesData[selectedIndices[0]]['final-number'] || 'بدون';
            const lastNum = invoicesData[selectedIndices[selectedIndices.length - 1]]['final-number'] || 'بدون';
            fileName = `حاويات-${firstNum}-إلى-${lastNum}.xlsx`;
        }
        
        XLSX.writeFile(wb, fileName);
        showNotification(`تم تصدير ${allContainers.length} حاوية بنجاح`, 'success');
        
    } catch (error) {
        console.error('خطأ في تصدير الحاويات:', error);
        showNotification('حدث خطأ في التصدير: ' + error.message, 'error');
    } finally {
        setTimeout(hideProgress, 1500);
    }
};

// ============================================
// دوال تصدير تفاصيل الحاويات (للفاتورة الواحدة)
// ============================================
window.exportContainerDetails = async function(groupIndex) {
    const inv = invoicesData[selectedInvoiceIndex];
    if (!inv) return;
    const finalNum = inv['final-number'] || '';
    const isPostponed = finalNum.startsWith('P') || finalNum.startsWith('p');
    const grouped = isPostponed ? groupPostponedCharges(inv.charges) : groupCashCharges(inv.charges);
    const charge = grouped[groupIndex];
    if (!charge?.containerNumbers?.length) return;

    showProgress('جاري تجهيز بيانات التصدير...', 30);
    const exRate = inv['flex-string-06'] || 48.0215;
    const currency = inv['currency'] || 'EGP';
    const exportData = [
        ['تقرير تفاصيل الحاويات'],
        ['الفاتورة: ' + (inv['final-number'] || 'غير محدد')],
        ['الوصف: ' + (charge.description || 'بند غير محدد')],
        ['تاريخ التقرير: ' + new Date().toLocaleDateString('ar-EG')],
        [],
        ['معلومات الفاتورة:'],
        ['رقم الفاتورة:', inv['final-number'] || '-'],
        ['رقم المسودة:', inv['draft-number'] || '-'],
        ['العميل:', inv['payee-customer-id'] || '-'],
        ['السفينة:', inv['key-word1'] || '-'],
        ['رقم البوليصة:', inv['key-word2'] || '-'],
        ['سعر الصرف:', exRate.toFixed(4)],
        [],
        ['م', 'رقم الحاوية', 'التاريخ من', 'التاريخ إلى', 'عدد الأيام', 'سعر الوحدة', 'المبلغ', 'العملة']
    ];

    let totalAmount = 0;
    charge.containerNumbers.forEach((container, idx) => {
        const dateInfo = charge.dates?.[idx] || { from: charge['event-performed-from'] || '-', to: charge['event-performed-to'] || '-', days: charge['storage-days'] || 1 };
        let amountPerContainer;
        if (isPostponed && currency === 'USAD') amountPerContainer = (charge.amount / exRate / charge.containerNumbers.length).toFixed(2);
        else amountPerContainer = (charge.amount / charge.containerNumbers.length).toFixed(2);
        totalAmount += parseFloat(amountPerContainer);
        exportData.push([
            (idx + 1).toString(), container, dateInfo.from, dateInfo.to, dateInfo.days.toString(),
            (charge['rate-billed'] || 0).toFixed(2), amountPerContainer,
            (isPostponed && currency === 'USAD') ? 'USAD' : 'EGP'
        ]);
    });

    exportData.push([], ['الإجمالي', '', '', '', '', '', totalAmount.toFixed(2), (isPostponed && currency === 'USAD') ? 'USAD' : 'EGP']);
    exportData.push([], ['ملخص البند:'], ['الوصف:', charge.description || '-'], ['النوع:', charge['event-type-id'] || '-'], ['عدد الحاويات:', charge.containerNumbers.length.toString()], ['إجمالي المبلغ:', charge.amount.toFixed(2), 'جنيه']);
    if (isPostponed && currency === 'USAD') exportData.push(['المبلغ بعد سعر الصرف:', (charge.amount / exRate).toFixed(2), 'USAD']);

    showProgress('جاري إنشاء ملف Excel...', 70);
    try {
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(exportData);
        ws['!cols'] = [{ wch: 5 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 15 }, { wch: 8 }];
        XLSX.utils.book_append_sheet(wb, ws, 'تفاصيل الحاويات');
        XLSX.writeFile(wb, `حاويات-${charge.description?.substring(0, 30) || 'بند'}-${inv['final-number']}.xlsx`);
        showNotification('تم تصدير تفاصيل الحاويات', 'success');
    } catch (error) {
        showNotification('حدث خطأ في التصدير: ' + error.message, 'error');
    } finally { setTimeout(hideProgress, 1500); }
};

// ============================================
// دوال تصدير Excel للفواتير المحددة
// ============================================
window.exportSelectedInvoicesExcel = async function() {
    if (selectedInvoices.size === 0) {
        showNotification('لم يتم تحديد أي فواتير', 'warning');
        return;
    }
    
    const selectedIndices = Array.from(selectedInvoices).sort((a, b) => a - b);
    showProgress(`جاري تجهيز ${selectedIndices.length} فاتورة...`, 30);
    
    try {
        const excelData = [
            ['تقرير الفواتير المحددة'],
            ['تاريخ التقرير: ' + new Date().toLocaleDateString('ar-EG')],
            ['عدد الفواتير: ' + selectedIndices.length],
            [],
            ['Draft Nbr', 'Final Nbr', 'Finalized Date', 'Payee', 'Invoice Type', 'Currency', 'Total Charges', 'Taxes', 'Martyr (5 EGP)', 'Key Word 1', 'Key Word 2']
        ];
        
        selectedIndices.forEach(index => {
            const inv = invoicesData[index];
            const finalNum = inv['final-number'] || '';
            const isPostponed = finalNum.startsWith('P') || finalNum.startsWith('p');
            const currency = inv['currency'] || 'EGP';
            const applyMartyr = !(isPostponed && currency === 'USAD');
            
            excelData.push([
                inv['draft-number'] || '',
                inv['final-number'] || '',
                inv['finalized-date'] ? new Date(inv['finalized-date']).toLocaleDateString('ar-EG') : '',
                inv['payee-customer-id'] || '',
                inv['invoice-type-id'] || '',
                inv['currency'] || 'EGP',
                (inv['total-charges'] || 0).toFixed(2),
                (inv['total-taxes'] || 0).toFixed(2),
                applyMartyr ? '5.00' : '0.00',
                inv['key-word1'] || '',
                inv['key-word2'] || ''
            ]);
        });
        
        excelData.push([]);
        excelData.push(['ملخص']);
        excelData.push(['إجمالي الفواتير:', selectedIndices.length]);
        
        const totalCharges = selectedIndices.reduce((sum, idx) => sum + (invoicesData[idx]['total-charges'] || 0), 0);
        const totalTaxes = selectedIndices.reduce((sum, idx) => sum + (invoicesData[idx]['total-taxes'] || 0), 0);
        const totalMartyr = selectedIndices.reduce((sum, idx) => {
            const inv = invoicesData[idx];
            const finalNum = inv['final-number'] || '';
            const isPostponed = finalNum.startsWith('P') || finalNum.startsWith('p');
            const currency = inv['currency'] || 'EGP';
            return sum + (!(isPostponed && currency === 'USAD') ? 5 : 0);
        }, 0);
        
        excelData.push(['إجمالي المصاريف:', totalCharges.toFixed(2)]);
        excelData.push(['إجمالي الضرائب:', totalTaxes.toFixed(2)]);
        excelData.push(['إجمالي طابع الشهيد:', totalMartyr.toFixed(2)]);
        excelData.push(['الإجمالي النهائي:', (totalCharges + totalTaxes + totalMartyr).toFixed(2)]);
        
        showProgress('جاري إنشاء ملف Excel...', 70);
        
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(excelData);
        ws['!cols'] = [{ wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 30 }, { wch: 20 }, { wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 20 }];
        XLSX.utils.book_append_sheet(wb, ws, 'الفواتير المحددة');
        
        let fileName = selectedIndices.length === 1
            ? `فاتورة-${invoicesData[selectedIndices[0]]['final-number'] || 'غير معروف'}.xlsx`
            : `فواتير-${invoicesData[selectedIndices[0]]['final-number'] || 'بدون'}-إلى-${invoicesData[selectedIndices[selectedIndices.length - 1]]['final-number'] || 'بدون'}.xlsx`;
        
        XLSX.writeFile(wb, fileName);
        showNotification(`تم تصدير ${selectedIndices.length} فاتورة بنجاح`, 'success');
    } catch (error) {
        showNotification('حدث خطأ في التصدير: ' + error.message, 'error');
    } finally { setTimeout(hideProgress, 1500); }
};

// ============================================
// دوال تصدير PDF للفواتير المحددة
// ============================================
window.exportSelectedInvoices = async function() {
    if (selectedInvoices.size === 0) {
        showNotification('لم يتم تحديد أي فواتير', 'warning');
        return;
    }
    
    const selectedIndices = Array.from(selectedInvoices).sort((a, b) => a - b);
    
    if (selectedIndices.length === 1) {
        const index = selectedIndices[0];
        if (index >= 0 && index < invoicesData.length) {
            selectedInvoiceIndex = index;
            showInvoiceDetails(index);
            setTimeout(() => exportSingleInvoice(), 500);
        }
    } else {
        await exportMultipleInvoices(selectedIndices);
    }
};

async function exportSingleInvoice() {
    if (typeof window.jspdf === 'undefined' || typeof window.html2canvas === 'undefined') {
        showNotification('جاري تحميل مكتبات PDF...', 'info');
        return;
    }
    
    const element = document.getElementById('invoicePrint');
    if (!element) {
        showNotification('لا توجد فاتورة للتصدير', 'error');
        return;
    }
    
    const loading = document.createElement('div');
    loading.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#4361ee;color:white;padding:15px 30px;border-radius:8px;z-index:10000;';
    loading.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري إنشاء PDF...';
    document.body.appendChild(loading);
    
    try {
        const canvas = await html2canvas(element, {
            scale: 1.5,
            backgroundColor: '#ffffff',
            logging: false,
            allowTaint: true,
            useCORS: true,
            imageTimeout: 0
        });
        
        const imgData = canvas.toDataURL('image/jpeg', 0.85);
        
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4',
            compress: true
        });
        
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        
        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
        pdf.save(`فاتورة-${document.getElementById('modalInvoiceNumber').textContent}.pdf`);
        
        showNotification('تم التصدير بنجاح', 'success');
        
    } catch (error) {
        console.error('خطأ في إنشاء PDF:', error);
        showNotification('حدث خطأ في إنشاء PDF: ' + error.message, 'error');
    } finally {
        loading.remove();
    }
}

async function exportMultipleInvoices(indices) {
    if (typeof window.jspdf === 'undefined' || typeof window.html2canvas === 'undefined') {
        showNotification('جاري تحميل مكتبات PDF...', 'info');
        return;
    }
    
    showProgress(`جاري تجهيز ${indices.length} فاتورة...`, 10);
    
    try {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4',
            compress: true
        });
        
        let currentPage = 0;
        
        for (let i = 0; i < indices.length; i++) {
            const index = indices[i];
            
            showProgress(`جاري تجهيز الفاتورة ${i + 1} من ${indices.length}...`, Math.round((i / indices.length) * 100));
            
            const modalBody = document.getElementById('modalBody');
            const originalContent = modalBody.innerHTML;
            const originalSelectedIndex = selectedInvoiceIndex;
            
            selectedInvoiceIndex = index;
            showInvoiceDetails(index);
            
            await new Promise(resolve => setTimeout(resolve, 300));
            
            const invoiceElement = document.getElementById('invoicePrint');
            
            if (invoiceElement) {
                try {
                    const canvas = await html2canvas(invoiceElement, {
                        scale: 1.4,
                        backgroundColor: '#ffffff',
                        logging: false,
                        allowTaint: true,
                        useCORS: true,
                        imageTimeout: 0
                    });
                    
                    if (currentPage > 0) {
                        pdf.addPage();
                    }
                    
                    const imgData = canvas.toDataURL('image/jpeg', 0.7);
                    const pdfWidth = pdf.internal.pageSize.getWidth();
                    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
                    
                    pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
                    currentPage++;
                    
                } catch (error) {
                    console.error(`خطأ في تصدير الفاتورة ${i + 1}:`, error);
                }
            }
            
            modalBody.innerHTML = originalContent;
            selectedInvoiceIndex = originalSelectedIndex;
        }
        
        showProgress('جاري حفظ الملف...', 100);
        
        let fileName;
        if (indices.length === 1) {
            fileName = `فاتورة-${invoicesData[indices[0]]['final-number'] || 'غير معروف'}.pdf`;
        } else {
            const firstNum = invoicesData[indices[0]]['final-number'] || 'بدون';
            const lastNum = invoicesData[indices[indices.length - 1]]['final-number'] || 'بدون';
            fileName = `فواتير-${firstNum}-إلى-${lastNum}.pdf`;
        }
        
        pdf.save(fileName);
        showNotification(`تم تصدير ${indices.length} فاتورة بنجاح`, 'success');
        
    } catch (error) {
        console.error('خطأ في التصدير:', error);
        showNotification('حدث خطأ في تصدير الفواتير: ' + error.message, 'error');
    } finally {
        setTimeout(hideProgress, 1500);
    }
}

window.exportInvoicePDF = function() {
    exportSingleInvoice();
};

// ============================================
// دوال الفاتورة والنموذج الفرعي - مع جميع التعديلات
// ============================================
window.showInvoiceDetails = function(index) {
    if (index < 0 || index >= invoicesData.length) return;
    selectedInvoiceIndex = index;
    const inv = invoicesData[index];
    const finalNum = inv['final-number'] || '';
    const isPostponed = finalNum.startsWith('P') || finalNum.startsWith('p');
    const currency = inv['currency'] || 'EGP';
    const exRate = inv['flex-string-06'] || 48.0215;

    document.getElementById('modalInvoiceNumber').textContent = inv['final-number'] || 'غير محدد';
    
    // استخدام finalized-date بدلاً من created مع تكبير الخط وجعله bold
    const invoiceDate = inv['finalized-date'] || inv['created'] || '';
    const formattedDate = invoiceDate ? new Date(invoiceDate).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' }) : 'غير محدد';
    
    const voyageDate = inv['flex-date-02'] ? new Date(inv['flex-date-02']).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' }) : 'غير محدد';
    
    const grouped = isPostponed ? groupPostponedCharges(inv.charges) : groupCashCharges(inv.charges);
    
    const invoiceTypeText = isPostponed ? 'آجل' : 'نقدي';
    
    const showMartyr = !(isPostponed && currency === 'USAD');
    const martyr = showMartyr ? 5 : 0;
    
    const baseTotal = inv['total-total'] || 0;
    const adjustedTotal = baseTotal + martyr;
    
    let displayCurrency;
    let totalChargesDisplay, totalTaxesDisplay, displayTotal;
    
    if (isPostponed && currency === 'USAD') {
        displayCurrency = 'USAD';
        totalChargesDisplay = (inv['total-charges'] || 0) / exRate;
        totalTaxesDisplay = (inv['total-taxes'] || 0) / exRate;
        displayTotal = adjustedTotal / exRate;
    } else {
        displayCurrency = 'EGP';
        totalChargesDisplay = inv['total-charges'] || 0;
        totalTaxesDisplay = inv['total-taxes'] || 0;
        displayTotal = adjustedTotal;
    }
    
    const preparer = inv['creator'] || 'غير محدد';
    const reviewer = inv['changer'] || inv['creator'] || 'غير محدد';
    const facilityDisplay = 'DCHC';

    let chargesRows = '';
    
    grouped.forEach((charge, idx) => {
        const amount = charge.amount;
        let amountDisplay = (amount / exRate).toFixed(2);
        const containerCount = charge.containerNumbers?.length || 0;
        const qtyDisplay = charge.quantity > 1 ? ` (${charge.quantity})` : '';

        let displayStorageDays;
        if (isPostponed) {
            if (charge['event-type-id'] === 'REEFER' || charge['event-type-id'] === 'STORAGE') {
                displayStorageDays = charge.totalStorageDays;
            } else {
                displayStorageDays = 1;
            }
        } else {
            displayStorageDays = charge.totalStorageDays;
        }

        if (isPostponed) {
            chargesRows += `<tr onclick="toggleContainers(${idx})" style="cursor: pointer;">
                <td>${charge.description || '-'}${qtyDisplay}</td>
                <td>${charge['event-type-id'] || '-'}</td>
                <td>${charge.quantity || 1}</td>
                <td>${displayStorageDays}</td>
                <td>${(charge['rate-billed'] || 0).toFixed(2)}</td>
                <td><strong>${amountDisplay}</strong></td>
                <td>${containerCount > 0 ? `<i id="icon-${idx}" class="fas fa-chevron-down"></i> <span style="font-size:0.8em;">${containerCount}</span>` : ''}</td>
            </tr>`;
        } else {
            const chargeDate = charge['paid-thru-day'] || charge['created'] || '';
            const formattedChargeDate = chargeDate ? new Date(chargeDate).toLocaleDateString('ar-EG') : '-';
            
            chargesRows += `<tr onclick="toggleContainers(${idx})" style="cursor: pointer;">
                <td>${charge.description || '-'}${qtyDisplay}</td>
                <td>${charge['event-type-id'] || '-'}</td>
                <td>${charge.quantity || 1}</td>
                <td>${displayStorageDays}</td>
                <td>${(charge['rate-billed'] || 0).toFixed(2)}</td>
                <td><strong>${amountDisplay}</strong></td>
                <td>${formattedChargeDate}</td>
                <td>${containerCount > 0 ? `<i id="icon-${idx}" class="fas fa-chevron-down"></i> <span style="font-size:0.8em;">${containerCount}</span>` : ''}</td>
            </tr>`;
        }

        if (containerCount > 0) {
            const containerDetails = charge.containerNumbers.map((container, idx) => {
                const dateInfo = charge.dates && charge.dates[idx] ? charge.dates[idx] : {
                    from: charge['event-performed-from'] || '-',
                    to: charge['event-performed-to'] || '-',
                    days: charge['storage-days'] || 1
                };
                return {
                    containerNumber: container,
                    eventFrom: dateInfo.from,
                    eventTo: dateInfo.to,
                    days: dateInfo.days
                };
            });
            
            chargesRows += `<tr id="containers-${idx}" style="display:none; background:#f8f9fa;">
                <td colspan="${isPostponed ? '7' : '8'}" style="padding:15px;">
                    <div style="background:white; border-radius:8px; padding:15px; border-right:3px solid #4cc9f0;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                            <h4 style="color:#4cc9f0; margin:0;">
                                <i class="fas fa-container-storage"></i> تفاصيل الحاويات
                            </h4>
                            <button class="export-btn" onclick="exportContainerDetails(${idx})">
                                <i class="fas fa-file-excel"></i> تصدير Excel
                            </button>
                        </div>
                        <div style="overflow-x: auto;">
                            <table class="containers-detail-table">
                                <thead>
                                    <tr>
                                        <th>رقم الحاوية</th>
                                        <th>التاريخ من</th>
                                        <th>التاريخ إلى</th>
                                        <th>الأيام</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${containerDetails.map(detail => `
                                        <tr>
                                            <td class="container-number-cell">
                                                <i class="fas fa-box"></i> ${detail.containerNumber}
                                            </td>
                                            <td>${detail.eventFrom}</td>
                                            <td>${detail.eventTo}</td>
                                            <td>${detail.days}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </td>
            </tr>`;
        }
    });

    let summaryHtml = '';
    if (showMartyr) {
        summaryHtml = `
            <div class="summary-box">
                <div class="summary-row"><span>إجمالي المصاريف:</span><span>${totalChargesDisplay.toFixed(2)} ${displayCurrency}</span></div>
                <div class="summary-row"><span>إجمالي الضرائب:</span><span>${totalTaxesDisplay.toFixed(2)} ${displayCurrency}</span></div>
                <div class="summary-row"><span>طابع الشهيد:</span><span>${martyr.toFixed(2)} جنيه</span></div>
                <div class="summary-row total"><span>الإجمالي النهائي:</span><span>${displayTotal.toFixed(2)} ${displayCurrency}</span></div>
            </div>
        `;
    } else {
        summaryHtml = `
            <div class="summary-box">
                <div class="summary-row"><span>إجمالي المصاريف:</span><span>${totalChargesDisplay.toFixed(2)} ${displayCurrency}</span></div>
                <div class="summary-row"><span>إجمالي الضرائب:</span><span>${totalTaxesDisplay.toFixed(2)} ${displayCurrency}</span></div>
                <div class="summary-row total"><span>الإجمالي النهائي:</span><span>${displayTotal.toFixed(2)} ${displayCurrency}</span></div>
            </div>
        `;
    }

    let exchangeRateRow = `<div class="info-row"><span>سعر الصرف:</span><span><strong>${exRate.toFixed(4)}</strong></span></div>`;

    const tableHeaders = isPostponed ? 
        `<tr><th>الوصف</th><th>النوع</th><th>العدد</th><th>أيام التخزين</th><th>سعر الوحدة</th><th>المبلغ/سعر الصرف</th><th></th></tr>` :
        `<tr><th>الوصف</th><th>النوع</th><th>العدد</th><th>أيام التخزين</th><th>سعر الوحدة</th><th>المبلغ/سعر الصرف</th><th>تاريخ الصرف</th><th></th></tr>`;

    // إضافة كلاس للتاريخ
    const printStyles = `
        <style>
            @media print {
                @page {
                    size: A4;
                    margin: 0.5cm;
                }
                body {
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                }
                .invoice-container {
                    max-width: 100%;
                    padding: 10px !important;
                    font-size: 11pt;
                }
                .invoice-company-header {
                    padding: 12px !important;
                    margin-bottom: 10px !important;
                }
                .invoice-company-logo {
                    width: 50px !important;
                    height: 50px !important;
                    font-size: 1.8em !important;
                }
                .invoice-header {
                    padding: 10px !important;
                    margin-bottom: 10px !important;
                }
                .invoice-info-grid {
                    gap: 8px !important;
                    margin-bottom: 10px !important;
                }
                .info-box {
                    padding: 8px !important;
                }
                .info-box h4 {
                    margin-bottom: 5px !important;
                    font-size: 0.95em !important;
                }
                .info-row {
                    padding: 3px 0 !important;
                    font-size: 0.85em !important;
                }
                .charges-section h3 {
                    margin-bottom: 8px !important;
                    font-size: 1em !important;
                }
                .charges-table th {
                    padding: 5px 3px !important;
                    font-size: 0.8em !important;
                }
                .charges-table td {
                    padding: 4px 3px !important;
                    font-size: 0.75em !important;
                }
                .summary-box {
                    width: 250px !important;
                    padding: 8px !important;
                }
                .summary-row {
                    padding: 3px 0 !important;
                    font-size: 0.8em !important;
                }
                .summary-row.total {
                    padding: 5px 0 !important;
                    font-size: 0.9em !important;
                }
                .signature-section {
                    margin: 15px 0 10px !important;
                    padding: 8px 0 !important;
                }
                .signature-box {
                    width: 130px !important;
                }
                .signature-name {
                    font-size: 0.9em !important;
                }
                .signature-date {
                    font-size: 0.7em !important;
                }
                .invoice-footer {
                    padding: 5px !important;
                    font-size: 0.7em !important;
                }
            }
            .invoice-number-bold {
                font-weight: bold;
                font-size: 1.2em;
            }
            .invoice-date-bold {
                font-weight: bold;
                font-size: 1.1em;
            }
        </style>
    `;

    // تعديل عنوان الفاتورة ليشمل الرقم النهائي والمسودة بخط كبير وعريض
    let html = `
        <div class="invoice-container" id="invoicePrint" style="max-width: 1100px; margin: 0 auto; background: white; padding: 20px; border-radius: 12px; box-shadow: 0 5px 20px rgba(0,0,0,0.1);">
            ${printStyles}
            
            <div class="invoice-company-header" style="display: flex; align-items: center; justify-content: space-between; background: linear-gradient(135deg, #1e3c72, #2a5298); color: white; padding: 15px 20px; border-radius: 10px; margin-bottom: 15px;">
                <div style="display: flex; align-items: center; gap: 15px;">
                    <div class="invoice-company-logo" style="width: 60px; height: 60px; background: rgba(255,255,255,0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 2em; border: 2px solid #ffd700;">
                        <i class="fas fa-ship"></i>
                    </div>
                    <div>
                        <h2 style="color: #ffd700; margin: 0 0 3px; font-size: 1.2em;">${COMPANY_INFO.name}</h2>
                        <p style="margin: 0 0 5px; opacity: 0.9; font-size: 0.8em;">${COMPANY_INFO.nameEn}</p>
                        <div style="display: flex; flex-wrap: wrap; gap: 10px; font-size: 0.7em;">
                            <span><i class="fas fa-map-marker-alt" style="color: #ffd700;"></i> ${COMPANY_INFO.address}</span>
                            <span><i class="fas fa-phone" style="color: #ffd700;"></i> ${COMPANY_INFO.phone}</span>
                            <span><i class="fas fa-envelope" style="color: #ffd700;"></i> ${COMPANY_INFO.email}</span>
                        </div>
                    </div>
                </div>
                
                <div id="qrcode-container-${inv['final-number']}" style="background: white; padding: 5px; border-radius: 8px; min-width: 110px; text-align: center;"></div>
            </div>
            
            <div class="invoice-header" style="background: linear-gradient(135deg, #4361ee, #3f37c9); color: white; padding: 12px; text-align: center; border-radius: 8px; margin-bottom: 15px;">
                <h2 style="font-size: 1.1em; margin-bottom: 3px;"><i class="fas fa-file-invoice"></i> فاتورة رسمية - ${invoiceTypeText}</h2>
                <p style="font-size: 0.8em; margin-top: 3px; color: #f0f0f0;"><i class="fas fa-tag"></i> ${inv['invoice-type-id'] || 'غير محدد'}</p>
                <p style="margin-top: 3px; font-size: 0.8em;">
                    <span class="invoice-number-bold">${inv['final-number'] || 'غير محدد'}</span>
                    ${inv['draft-number'] ? `| <span class="invoice-number-bold">${inv['draft-number']}</span>` : ''} 
                    | تاريخ: <span class="invoice-date-bold">${formattedDate}</span>
                </p>
            </div>
            
            <div class="invoice-info-grid" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 15px;">
                <div class="info-box" style="background: #f8f9fa; padding: 12px; border-radius: 8px; border-right: 4px solid #4361ee;">
                    <h4 style="color: #4361ee; margin-bottom: 8px; font-size: 0.95em; display: flex; align-items: center; gap: 5px;"><i class="fas fa-building"></i> بيانات العميل</h4>
                    <div class="info-row" style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px dashed #dee2e6; font-size:0.85em;"><span>الاسم:</span><span>${inv['payee-customer-id'] || '-'}</span></div>
                    <div class="info-row" style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px dashed #dee2e6; font-size:0.85em;"><span>الدور:</span><span>${inv['payee-customer-role'] || '-'}</span></div>
                    <div class="info-row" style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px dashed #dee2e6; font-size:0.85em;"><span>رقم العقد:</span><span>${inv['contract-customer-id'] || '-'}</span></div>
                </div>
                <div class="info-box" style="background: #f8f9fa; padding: 12px; border-radius: 8px; border-right: 4px solid #4361ee;">
                    <h4 style="color: #4361ee; margin-bottom: 8px; font-size: 0.95em; display: flex; align-items: center; gap: 5px;"><i class="fas fa-ship"></i> بيانات الشحنة</h4>
                    <div class="info-row" style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px dashed #dee2e6; font-size:0.85em;"><span>السفينة:</span><span>${inv['key-word1'] || '-'}</span></div>
                    <div class="info-row" style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px dashed #dee2e6; font-size:0.85em;">
                        <span>${isPostponed ? 'IB ID / OB ID' : 'رقم البوليصة'}:</span>
                        <span>${inv['key-word2'] || '-'}</span>
                    </div>
                    <div class="info-row" style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px dashed #dee2e6; font-size:0.85em;"><span>الخط الملاحي:</span><span>${inv['key-word3'] || '-'}</span></div>
                    <div class="info-row" style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px dashed #dee2e6; font-size:0.85em;"><span>تاريخ الرحلة:</span><span><strong>${voyageDate}</strong></span></div>
                </div>
                <div class="info-box" style="background: #f8f9fa; padding: 12px; border-radius: 8px; border-right: 4px solid #4361ee;">
                    <h4 style="color: #4361ee; margin-bottom: 8px; font-size: 0.95em; display: flex; align-items: center; gap: 5px;"><i class="fas fa-info-circle"></i> معلومات إضافية</h4>
                    <div class="info-row" style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px dashed #dee2e6; font-size:0.85em;"><span>الحالة:</span><span>${inv['status'] || '-'}</span></div>
                    <div class="info-row" style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px dashed #dee2e6; font-size:0.85em;"><span>العملة:</span><span>${inv['currency'] || '-'}</span></div>
                    <div class="info-row" style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px dashed #dee2e6; font-size:0.85em;"><span>المنشأة:</span><span>${facilityDisplay}</span></div>
                    ${exchangeRateRow}
                </div>
            </div>
            
            <div class="charges-section" style="margin-bottom: 15px;">
                <h3 style="color: #212529; margin-bottom: 8px; font-size: 1em; display: flex; align-items: center; gap: 5px;"><i class="fas fa-list"></i> تفاصيل المصاريف</h3>
                <table class="charges-table" style="width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                    <thead style="background: #4361ee; color: white; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
                        ${tableHeaders}
                    </thead>
                    <tbody>
                        ${chargesRows}
                    </tbody>
                </table>
            </div>
            
            <div class="invoice-summary" style="display: flex; justify-content: flex-end; margin-top: 5px;">
                ${summaryHtml}
            </div>
            
            <div class="signature-section" style="display: flex; justify-content: space-around; margin: 15px 0 10px; padding: 8px 0; border-top: 2px dashed #dee2e6;">
                <div class="signature-box" style="text-align: center; width: 130px;">
                    <div class="signature-title" style="color: #4361ee; font-weight: bold; margin-bottom: 5px; font-size: 0.85em;">معد الفاتورة</div>
                    <div class="signature-name" style="font-size: 0.85em; margin-bottom: 3px; color: #212529; font-weight: 600;">${preparer}</div>
                    <div class="signature-line" style="height: 2px; background: #4361ee; width: 100%; margin: 3px 0;"></div>
                    <div class="signature-date" style="font-size: 0.7em; color: #666;">${new Date().toLocaleDateString('ar-EG')}</div>
                </div>
                <div class="signature-box" style="text-align: center; width: 130px;">
                    <div class="signature-title" style="color: #4361ee; font-weight: bold; margin-bottom: 5px; font-size: 0.85em;">المراجع</div>
                    <div class="signature-name" style="font-size: 0.85em; margin-bottom: 3px; color: #212529; font-weight: 600;">${reviewer}</div>
                    <div class="signature-line" style="height: 2px; background: #4361ee; width: 100%; margin: 3px 0;"></div>
                    <div class="signature-date" style="font-size: 0.7em; color: #666;">${new Date().toLocaleDateString('ar-EG')}</div>
                </div>
                <div class="signature-box" style="text-align: center; width: 130px;">
                    <div class="signature-title" style="color: #4361ee; font-weight: bold; margin-bottom: 5px; font-size: 0.85em;">الختم</div>
                    <div class="signature-stamp" style="font-size: 2em; color: #e63946; opacity: 0.5; transform: rotate(-15deg);"><i class="fas fa-certificate"></i></div>
                </div>
            </div>
            
            <div class="invoice-footer" style="text-align: center; padding: 8px; border-top: 2px solid #e9ecef; color: #6c757d; font-size: 0.7em;">
                <p style="margin: 2px 0;">شكراً لتعاملكم مع ${COMPANY_INFO.name}</p>
                <p style="margin: 2px 0;">تم إنشاء هذه الفاتورة إلكترونياً</p>
                <p style="margin: 2px 0;">تاريخ الطباعة: ${new Date().toLocaleDateString('ar-EG')}</p>
            </div>
        </div>
    `;

    document.getElementById('modalBody').innerHTML = html;
    document.getElementById('invoiceModal').style.display = 'block';
    
    setTimeout(() => {
        generateQRCode(inv['final-number'], inv['draft-number'], `qrcode-container-${inv['final-number']}`, 100);
    }, 100);
    
    setTimeout(() => {
        const closeBtn = document.querySelector('#invoiceModal .close-button');
        if (closeBtn) {
            closeBtn.onclick = function() { window.closeModal(); };
        }
        
        const prevBtn = document.querySelector('[onclick="navigateInvoice(\'prev\')"]');
        const nextBtn = document.querySelector('[onclick="navigateInvoice(\'next\')"]');
        
        if (prevBtn) {
            prevBtn.onclick = function() { window.navigateInvoice('prev'); };
        }
        if (nextBtn) {
            nextBtn.onclick = function() { window.navigateInvoice('next'); };
        }
        
        const printBtn = document.querySelector('[onclick="printInvoice()"]');
        if (printBtn) {
            printBtn.onclick = function() { window.printInvoice(); };
        }
        
        const pdfBtn = document.querySelector('[onclick="exportInvoicePDF()"]');
        if (pdfBtn) {
            pdfBtn.onclick = function() { window.exportInvoicePDF(); };
        }
        
        const excelBtn = document.querySelector('[onclick="exportInvoiceExcel()"]');
        if (excelBtn) {
            excelBtn.onclick = function() { window.exportInvoiceExcel(); };
        }
    }, 100);
};

// ============================================
// دوال إضافية للتحكم في الأزرار
// ============================================
window.closeModal = function() {
    const modal = document.getElementById('invoiceModal');
    if (modal) modal.style.display = 'none';
};

window.navigateInvoice = function(direction) {
    if (selectedInvoiceIndex === -1) return;
    const newIndex = direction === 'prev' ? selectedInvoiceIndex - 1 : selectedInvoiceIndex + 1;
    if (newIndex >= 0 && newIndex < invoicesData.length) {
        showInvoiceDetails(newIndex);
    } else {
        alert(direction === 'prev' ? 'هذه أول فاتورة' : 'هذه آخر فاتورة');
    }
};

window.toggleContainers = function(index) {
    const container = document.getElementById(`containers-${index}`);
    const icon = document.getElementById(`icon-${index}`);
    if (container && icon) {
        if (container.style.display === 'none' || container.style.display === '') {
            container.style.display = 'table-row';
            icon.className = 'fas fa-chevron-up';
        } else {
            container.style.display = 'none';
            icon.className = 'fas fa-chevron-down';
        }
    }
};

window.printInvoice = function() {
    const content = document.getElementById('invoicePrint');
    if (!content) return alert('لا توجد فاتورة للطباعة');
    
    const printWindow = window.open('', '_blank', 'width=1200,height=800');
    
    const printStyles = `
        <style>
            @page { size: A4; margin: 0.5cm; }
            body { font-family: 'Segoe UI', sans-serif; padding: 0; margin: 0; background: white; direction: rtl; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .invoice-container { max-width: 100%; margin: 0 auto; background: white; padding: 15px; }
            .invoice-company-header { display: flex; align-items: center; gap: 20px; background: linear-gradient(135deg, #1e3c72, #2a5298); color: white; padding: 15px; border-radius: 8px; margin-bottom: 15px; }
            .invoice-company-logo { width: 60px; height: 60px; background: rgba(255,255,255,0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 2em; border: 2px solid #ffd700; }
            .invoice-header { background: linear-gradient(135deg, #4361ee, #3f37c9); color: white; padding: 12px; text-align: center; border-radius: 8px; margin-bottom: 15px; }
            .invoice-info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 15px; }
            .info-box { background: #f8f9fa; padding: 10px; border-radius: 8px; border-right: 4px solid #4361ee; font-size: 0.85em; }
            .charges-table { width: 100%; border-collapse: collapse; font-size: 0.8em; }
            .charges-table th { background: #4361ee; color: white; padding: 6px 4px; }
            .charges-table td { padding: 5px 4px; border-bottom: 1px solid #e9ecef; }
            .summary-box { width: 280px; background: #f8f9fa; padding: 10px; border-radius: 8px; font-size: 0.85em; }
            .signature-section { display: flex; justify-content: space-around; margin: 15px 0 10px; padding: 8px 0; border-top: 2px dashed #dee2e6; }
            .invoice-footer { text-align: center; padding: 8px; border-top: 2px solid #e9ecef; color: #6c757d; font-size: 0.75em; }
            .invoice-number-bold { font-weight: bold; font-size: 1.2em; }
            .invoice-date-bold { font-weight: bold; font-size: 1.1em; }
        </style>
    `;
    
    printWindow.document.write(`
        <html dir="rtl">
        <head>
            <title>طباعة الفاتورة - ${COMPANY_INFO.name}</title>
            <meta charset="UTF-8">
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
            ${printStyles}
        </head>
        <body>
            ${content.outerHTML}
        </body>
        </html>
    `);
    
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 500);
};

window.exportInvoiceExcel = function() {
    const inv = invoicesData[selectedInvoiceIndex];
    if (!inv) return;
    const exRate = inv['flex-string-06'] || 48.0215;
    const martyr = 5;
    const isPostponed = (inv['final-number'] || '').startsWith('P') || (inv['final-number'] || '').startsWith('p');
    const currency = inv['currency'] || 'EGP';
    const applyMartyr = !(isPostponed && currency === 'USAD');
    
    let csv = "الوصف,النوع,العدد,أيام التخزين,سعر الوحدة,المبلغ,العملة,تاريخ الصرف\n";
    inv.charges.forEach(c => {
        let amountDisplay = (isPostponed && currency === 'USAD') ? (c.amount / exRate).toFixed(2) : (c.amount).toFixed(2);
        const displayCurrency = (isPostponed && currency === 'USAD') ? 'USAD' : 'EGP';
        const date = c['paid-thru-day'] || c['created'] || '';
        const fmtDate = date ? new Date(date).toLocaleDateString('ar-EG') : '-';
        csv += `"${c.description}","${c['event-type-id']}",${c.quantity},${c['storage-days']},${c['rate-billed']},${amountDisplay},"${displayCurrency}","${fmtDate}"\n`;
    });
    
    let totalCharges, totalTaxes, totalFinal;
    if (isPostponed && currency === 'USAD') {
        totalCharges = ((inv['total-charges'] || 0) / exRate).toFixed(2);
        totalTaxes = ((inv['total-taxes'] || 0) / exRate).toFixed(2);
        totalFinal = ((inv['total-total'] || 0) / exRate + (applyMartyr ? martyr : 0)).toFixed(2);
    } else {
        totalCharges = (inv['total-charges'] || 0).toFixed(2);
        totalTaxes = (inv['total-taxes'] || 0).toFixed(2);
        totalFinal = ((inv['total-total'] || 0) + (applyMartyr ? martyr : 0)).toFixed(2);
    }
    
    csv += `\nإجمالي المصاريف,${totalCharges},إجمالي الضرائب,${totalTaxes},طابع الشهيد,${applyMartyr ? martyr : 0},الإجمالي النهائي,${totalFinal}`;
    
    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `فاتورة-${inv['final-number']}.csv`;
    link.click();
};

// ============================================
// دوال عرض الجدول مع Checkbox وإضافة زر تصدير الحاويات
// ============================================
function renderTableView(data) {
    if (!document.getElementById('table-style')) {
        const style = document.createElement('style');
        style.id = 'table-style';
        style.textContent = `
            .selected-row { background-color: #e3f2fd !important; border-left: 4px solid #2196f3; }
            .invoice-checkbox, #selectAllCheckbox { width: 18px; height: 18px; cursor: pointer; }
            .table-toolbar button:disabled { opacity: 0.5; cursor: not-allowed; }
            .data-table tbody tr:hover { background-color: #f5f5f5; }
            .export-buttons { display: flex; gap: 10px; flex-wrap: wrap; }
        `;
        document.head.appendChild(style);
    }
    
    let html = `
        <div class="table-container">
            <div class="table-toolbar" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; padding:10px; background:#f8f9fa; border-radius:8px; flex-wrap: wrap; gap: 10px;">
                <div>
                    <button class="btn btn-secondary" onclick="selectAllInvoices()" style="margin-left:10px;"><i class="fas fa-check-double"></i> تحديد الكل</button>
                    <button class="btn btn-secondary" onclick="deselectAllInvoices()"><i class="fas fa-times"></i> إلغاء الكل</button>
                </div>
                <div class="export-buttons">
                    <span id="selectedCount" style="margin-left:15px; font-weight:bold;">0</span> فاتورة محددة
                    <button class="btn btn-primary" onclick="exportSelectedInvoices()" id="exportSelectedBtn" disabled><i class="fas fa-file-pdf"></i> PDF</button>
                    <button class="btn btn-success" onclick="exportSelectedInvoicesExcel()" id="exportSelectedExcelBtn" disabled><i class="fas fa-file-excel"></i> Excel</button>
                    <button class="btn btn-info" onclick="exportSelectedContainers()" id="exportContainersBtn" disabled style="background: #4cc9f0; color: white;">
                        <i class="fas fa-container-storage"></i> تصدير الحاويات
                    </button>
                </div>
            </div>
            <table class="data-table">
                <thead><tr>
                    <th style="width:40px;"><input type="checkbox" onclick="toggleAllCheckboxes(this)" id="selectAllCheckbox"></th>
                    <th>الرقم النهائي</th><th>رقم المسودة</th><th>العميل</th><th>السفينة</th><th>${currentInvoiceType === INVOICE_TYPES.POSTPONED ? 'IB ID / OB ID' : 'رقم البوليصة'}</th><th>تاريخ الرحله</th><th>الإجمالي (EGP)</th><th>المبلغ بالعملة</th>
                </tr></thead>
                <tbody>`;
    
    data.forEach(inv => {
        const idx = invoicesData.indexOf(inv);
        const finalNum = inv['final-number'] || '';
        const invoiceTypeDisplay = finalNum.startsWith('P') || finalNum.startsWith('p') ? 'أجل' : 'نقدي';
        const currency = inv['currency'] || 'EGP';
        const exRate = inv['flex-string-06'] || 48.0215;
        const totalOriginal = inv['total-total'] || 0;
        let displayAmount, displayCurrency;
        if (currency === 'USAD') { displayAmount = (totalOriginal / exRate).toFixed(2); displayCurrency = 'USAD'; }
        else { displayAmount = totalOriginal.toFixed(2); displayCurrency = 'EGP'; }
        const isSelected = selectedInvoices.has(idx) ? 'checked' : '';
        const selectedClass = isSelected ? 'selected-row' : '';
        
        html += `<tr onclick="handleRowClick(${idx}, event)" class="${selectedClass}" data-index="${idx}">
            <td onclick="event.stopPropagation()"><input type="checkbox" class="invoice-checkbox" data-index="${idx}" ${isSelected} onchange="updateSelectedInvoices(${idx}, this.checked)"></td>
            <td>${inv['final-number'] || '-'} (${invoiceTypeDisplay})</td>
            <td>${inv['draft-number'] || '-'}</td>
            <td>${(inv['payee-customer-id'] || '-').substring(0,20)}</td>
            <td>${inv['key-word1'] || '-'}</td>
            <td>${inv['key-word2'] || '-'}</td>
            <td>${inv['flex-date-02'] ? new Date(inv['flex-date-02']).toLocaleDateString('ar-EG') : '-'}</td>
            <td>${totalOriginal.toFixed(2)}</td>
            <td>${displayAmount} ${displayCurrency}</td>
        </tr>`;
    });
    
    html += '</tbody></table></div>';
    document.getElementById('dataViewContainer').innerHTML = html;
    updateSelectedCount();
}

// ============================================
// دوال نظام التقارير (معدلة لاستخدام finalized-date)
// ============================================
window.showReports = function(type) {
    currentReportType = type;
    document.querySelectorAll('.report-tab').forEach(t => t.classList.remove('active'));
    event.target.classList.add('active');
    document.getElementById('dataViewContainer').style.display = 'none';
    document.getElementById('reportsContainer').style.display = 'block';
    document.getElementById('pagination').style.display = 'none';
    if (type === 'daily') generateDailyReport();
    else if (type === 'monthly') generateMonthlyReport();
    else if (type === 'customer') generateCustomerReport();
    else generateVesselReport();
};

window.closeReports = function() {
    document.getElementById('reportsContainer').style.display = 'none';
    document.getElementById('dataViewContainer').style.display = 'block';
    document.getElementById('pagination').style.display = 'flex';
};

function generateDailyReport() {
    document.getElementById('reportTitle').textContent = 'التقارير اليومية';
    if (!filteredInvoices.length) { document.getElementById('reportContent').innerHTML = '<div class="no-data">لا توجد بيانات</div>'; return; }
    const daily = new Map();
    filteredInvoices.forEach(inv => {
        const date = inv['finalized-date'] || inv['created'] || '';
        const formattedDate = date ? new Date(date).toLocaleDateString('ar-EG') : 'غير محدد';
        if (!daily.has(formattedDate)) daily.set(formattedDate, { count:0, total:0, taxes:0 });
        const d = daily.get(formattedDate);
        d.count++; d.total += inv['total-total'] || 0; d.taxes += inv['total-taxes'] || 0;
    });
    const sorted = Array.from(daily.entries()).sort((a,b) => new Date(b[0]) - new Date(a[0]));
    const totalAmount = Array.from(daily.values()).reduce((s,d) => s + d.total, 0);
    let html = `<div class="report-card"><h3><i class="fas fa-calendar-day"></i> إحصائيات يومية</h3>
        <div class="report-stats">${[['عدد الأيام',sorted.length],['إجمالي الفواتير',filteredInvoices.length],['المتوسط اليومي',(totalAmount/(sorted.length||1)).toFixed(2)+' جنيه'],['إجمالي المبالغ',totalAmount.toFixed(2)+' جنيه']].map(([l,v])=>`<div class="stat-item"><div class="stat-label">${l}</div><div class="stat-value">${v}</div></div>`).join('')}</div>`;
    html += '<h4>تفاصيل يومية</h4><table class="report-table"><thead><tr><th>التاريخ</th><th>عدد الفواتير</th><th>إجمالي المبالغ</th><th>الضرائب</th><th>المتوسط</th></tr></thead><tbody>';
    sorted.forEach(([date,data]) => html += `<tr><td>${date}</td><td>${data.count}</td><td>${data.total.toFixed(2)}</td><td>${data.taxes.toFixed(2)}</td><td>${(data.total/data.count).toFixed(2)}</td></tr>`);
    html += '</tbody></table></div>';
    document.getElementById('reportContent').innerHTML = html;
}

function generateMonthlyReport() {
    document.getElementById('reportTitle').textContent = 'التقارير الشهرية';
    if (!filteredInvoices.length) { document.getElementById('reportContent').innerHTML = '<div class="no-data">لا توجد بيانات</div>'; return; }
    const monthly = new Map();
    filteredInvoices.forEach(inv => {
        const dateStr = inv['finalized-date'] || inv['created'] || '';
        const date = dateStr ? new Date(dateStr) : new Date();
        const key = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;
        const name = date.toLocaleDateString('ar-EG', { year:'numeric', month:'long' });
        if (!monthly.has(key)) monthly.set(key, { name, count:0, total:0, taxes:0 });
        const m = monthly.get(key);
        m.count++; m.total += inv['total-total'] || 0; m.taxes += inv['total-taxes'] || 0;
    });
    const sorted = Array.from(monthly.entries()).sort((a,b) => b[0].localeCompare(a[0]));
    const totalAmount = Array.from(monthly.values()).reduce((s,d) => s + d.total, 0);
    let html = `<div class="report-card"><h3><i class="fas fa-calendar-alt"></i> إحصائيات شهرية</h3>
        <div class="report-stats">${[['عدد الأشهر',sorted.length],['إجمالي الفواتير',filteredInvoices.length],['المتوسط الشهري',(totalAmount/(sorted.length||1)).toFixed(2)+' جنيه'],['إجمالي المبالغ',totalAmount.toFixed(2)+' جنيه']].map(([l,v])=>`<div class="stat-item"><div class="stat-label">${l}</div><div class="stat-value">${v}</div></div>`).join('')}</div>`;
    html += '<table class="report-table"><thead><tr><th>الشهر</th><th>عدد الفواتير</th><th>إجمالي المبالغ</th><th>الضرائب</th><th>المتوسط</th></tr></thead><tbody>';
    sorted.forEach(([_,data]) => html += `<tr><td>${data.name}</td><td>${data.count}</td><td>${data.total.toFixed(2)}</td><td>${data.taxes.toFixed(2)}</td><td>${(data.total/data.count).toFixed(2)}</td></tr>`);
    html += '</tbody></table></div>';
    document.getElementById('reportContent').innerHTML = html;
}

function generateCustomerReport() {
    document.getElementById('reportTitle').textContent = 'تقارير العملاء';
    if (!filteredInvoices.length) { document.getElementById('reportContent').innerHTML = '<div class="no-data">لا توجد بيانات</div>'; return; }
    const cust = new Map();
    filteredInvoices.forEach(inv => {
        const id = inv['payee-customer-id'] || 'غير معروف';
        if (!cust.has(id)) cust.set(id, { count:0, total:0, taxes:0 });
        const c = cust.get(id);
        c.count++; c.total += inv['total-total'] || 0; c.taxes += inv['total-taxes'] || 0;
    });
    const sorted = Array.from(cust.entries()).sort((a,b) => b[1].total - a[1].total);
    const totalAmount = sorted.reduce((s,[_,d]) => s + d.total, 0);
    let html = `<div class="report-card"><h3><i class="fas fa-users"></i> إحصائيات العملاء</h3>
        <div class="report-stats">${[['عدد العملاء',sorted.length],['إجمالي الفواتير',filteredInvoices.length],['أعلى عميل',sorted.length?sorted[0][0].substring(0,20):'لا يوجد'],['إجمالي المبالغ',totalAmount.toFixed(2)+' جنيه']].map(([l,v])=>`<div class="stat-item"><div class="stat-label">${l}</div><div class="stat-value">${v}</div></div>`).join('')}</div>`;
    html += '<table class="report-table"><thead><tr><th>العميل</th><th>عدد الفواتير</th><th>إجمالي المبالغ</th><th>الضرائب</th><th>المتوسط</th></tr></thead><tbody>';
    sorted.forEach(([customer,data]) => html += `<tr><td>${customer.substring(0,30)}</td><td>${data.count}</td><td>${data.total.toFixed(2)}</td><td>${data.taxes.toFixed(2)}</td><td>${(data.total/data.count).toFixed(2)}</td></tr>`);
    html += '</tbody></table></div>';
    document.getElementById('reportContent').innerHTML = html;
}

function generateVesselReport() {
    document.getElementById('reportTitle').textContent = 'تقارير السفن';
    if (!filteredInvoices.length) { document.getElementById('reportContent').innerHTML = '<div class="no-data">لا توجد بيانات</div>'; return; }
    const vessel = new Map();
    filteredInvoices.forEach(inv => {
        const v = inv['key-word1'] || 'غير معروف';
        if (!vessel.has(v)) vessel.set(v, { count:0, total:0, taxes:0 });
        const ves = vessel.get(v);
        ves.count++; ves.total += inv['total-total'] || 0; ves.taxes += inv['total-taxes'] || 0;
    });
    const sorted = Array.from(vessel.entries()).sort((a,b) => b[1].total - a[1].total);
    const totalAmount = sorted.reduce((s,[_,d]) => s + d.total, 0);
    let html = `<div class="report-card"><h3><i class="fas fa-ship"></i> إحصائيات السفن</h3>
        <div class="report-stats">${[['عدد السفن',sorted.length],['إجمالي الفواتير',filteredInvoices.length],['أكثر سفينة',sorted.length?sorted[0][0]:'لا يوجد'],['إجمالي المبالغ',totalAmount.toFixed(2)+' جنيه']].map(([l,v])=>`<div class="stat-item"><div class="stat-label">${l}</div><div class="stat-value">${v}</div></div>`).join('')}</div>`;
    html += '<table class="report-table"><thead><tr><th>السفينة</th><th>عدد الفواتير</th><th>إجمالي المبالغ</th><th>الضرائب</th><th>المتوسط</th></tr></thead><tbody>';
    sorted.forEach(([vessel,data]) => html += `<tr><td>${vessel}</td><td>${data.count}</td><td>${data.total.toFixed(2)}</td><td>${data.taxes.toFixed(2)}</td><td>${(data.total/data.count).toFixed(2)}</td></tr>`);
    html += '</tbody></table></div>';
    document.getElementById('reportContent').innerHTML = html;
}

// ============================================
// دوال تصدير التقارير
// ============================================
window.exportReportPDF = function() {
    const content = document.getElementById('reportContent');
    if (!content?.innerHTML.trim()) return alert('لا يوجد تقرير');
    const loading = document.body.appendChild(document.createElement('div'));
    Object.assign(loading.style, { position:'fixed', top:'50%', left:'50%', transform:'translate(-50%,-50%)', background:'#4361ee', color:'white', padding:'15px 30px', borderRadius:'8px', zIndex:10000 });
    loading.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري إنشاء PDF...';
    html2canvas(content, { scale:2 }).then(canvas => {
        loading.remove();
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' });
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, pdf.internal.pageSize.getWidth(), (canvas.height * pdf.internal.pageSize.getWidth()) / canvas.width);
        pdf.save(`تقرير_${document.getElementById('reportTitle').textContent.replace(/\s/g,'_')}_${new Date().toLocaleDateString('ar-EG')}.pdf`);
    }).catch(() => { loading.remove(); alert('حدث خطأ'); });
};

window.exportReportExcel = function() {
    const content = document.getElementById('reportContent');
    if (!content) return alert('لا يوجد تقرير');
    const tables = content.querySelectorAll('table');
    if (!tables.length) return alert('لا توجد جداول');
    const html = `<html><head><meta charset="UTF-8"><title>تقرير - ${document.getElementById('reportTitle').textContent}</title><style>body{font-family:"Segoe UI",sans-serif;direction:rtl}table{border-collapse:collapse;width:100%}th{background:#4361ee;color:white;padding:10px}td{border:1px solid #ddd;padding:8px}</style></head><body><h2>${document.getElementById('reportTitle').textContent}</h2>${content.innerHTML}</body></html>`;
    const blob = new Blob([html], { type:'application/vnd.ms-excel' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `تقرير_${document.getElementById('reportTitle').textContent.replace(/\s/g,'_')}_${new Date().toLocaleDateString('ar-EG')}.xlsx`;
    link.click();
};

// ============================================
// دوال Google Drive
// ============================================
function loadDriveSettings() {
    const saved = localStorage.getItem('driveConfig');
    if (saved) try { driveConfig = { ...driveConfig, ...JSON.parse(saved) }; } catch { }
    ['driveApiKey','driveFolderId','driveFileName','driveFileId','driveUsersFileName','driveUsersFileId'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = driveConfig[id.replace('drive','').charAt(0).toLowerCase() + id.replace('drive','').slice(1)] || '';
    });
}

function saveDriveSettingsToStorage() { localStorage.setItem('driveConfig', JSON.stringify(driveConfig)); }

window.openDriveSettings = function() {
    if (!currentUser || currentUser.userType !== 'admin') return showNotification('غير مصرح', 'error');
    loadDriveSettings();
    document.getElementById('driveSettingsModal').style.display = 'block';
    ['driveMessage','driveTestResult'].forEach(id => document.getElementById(id).style.display = 'none');
};

window.closeDriveSettings = function() { document.getElementById('driveSettingsModal').style.display = 'none'; };

window.saveDriveSettings = function() {
    if (!currentUser || currentUser.userType !== 'admin') return showNotification('غير مصرح', 'error');
    driveConfig = {
        apiKey: document.getElementById('driveApiKey').value.trim(),
        folderId: document.getElementById('driveFolderId').value.trim(),
        fileName: document.getElementById('driveFileName').value.trim() || 'datatxt.txt',
        fileId: document.getElementById('driveFileId').value.trim(),
        usersFileName: document.getElementById('driveUsersFileName').value.trim() || 'users.json',
        usersFileId: document.getElementById('driveUsersFileId').value.trim()
    };
    saveDriveSettingsToStorage();
    const d = document.getElementById('driveMessage');
    d.textContent = '✅ تم حفظ الإعدادات'; d.className = 'login-message success'; d.style.display = 'block';
};

window.testDriveConnection = async function() {
    if (!currentUser || currentUser.userType !== 'admin') return showNotification('غير مصرح', 'error');
    const apiKey = document.getElementById('driveApiKey').value.trim();
    const folderId = document.getElementById('driveFolderId').value.trim();
    if (!apiKey || !folderId) return document.getElementById('driveMessage').innerHTML = '❌ أدخل المفتاح والمجلد' + (document.getElementById('driveMessage').className = 'login-message error') + (document.getElementById('driveMessage').style.display = 'block');
    document.getElementById('driveMessage').innerHTML = '🔄 جاري الاتصال...';
    document.getElementById('driveMessage').className = 'login-message info';
    try {
        const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(`'${folderId}' in parents`)}&key=${apiKey}&fields=files(id,name,mimeType,size,createdTime)`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const files = data.files || [];
        window.driveFilesList = files;
        let html = `<div style="margin-top:10px;max-height:300px;overflow-y:auto;">${files.length ? files.map(f => `<div style="padding:10px;margin:5px 0;background:#2d3748;border-radius:5px;border-right:3px solid #4cc9f0;"><div style="display:flex;justify-content:space-between"><div><strong style="color:#ffd700;">${f.name}</strong><div style="font-size:0.85em;color:#a0aec0;">معرف: ${f.id}<br>حجم: ${f.size ? (parseInt(f.size)/1024).toFixed(1) : '?'} KB | تاريخ: ${f.createdTime ? new Date(f.createdTime).toLocaleDateString('ar-EG') : ''}</div></div><div><button onclick="selectDataFile('${f.id}','${f.name}')" class="btn-small" style="background:#4361ee;">كملف بيانات</button><button onclick="selectUsersFile('${f.id}','${f.name}')" class="btn-small" style="background:#0F9D58;margin-right:5px;">كملف مستخدمين</button></div></div></div>`).join('') : '<p style="color:#a0aec0;">لا توجد ملفات</p>'}</div>`;
        document.getElementById('driveTestResult').innerHTML = `✅ اتصال ناجح!<br>📁 عدد الملفات: ${files.length}<br><br>${html}`;
        document.getElementById('driveTestResult').style.display = 'block';
        document.getElementById('driveMessage').innerHTML = '✅ تم الاختبار - انقر على ملف لاختياره';
        document.getElementById('driveMessage').className = 'login-message success';
    } catch (error) {
        document.getElementById('driveMessage').innerHTML = `❌ فشل: ${error.message}`;
        document.getElementById('driveMessage').className = 'login-message error';
        document.getElementById('driveTestResult').innerHTML = `❌ خطأ: ${error.message}`;
        document.getElementById('driveTestResult').style.display = 'block';
    }
};

window.selectDataFile = function(fileId, fileName) {
    if (!currentUser || currentUser.userType !== 'admin') return showNotification('غير مصرح', 'error');
    document.getElementById('driveFileId').value = fileId;
    document.getElementById('driveFileName').value = fileName;
    driveConfig.fileId = fileId; driveConfig.fileName = fileName;
    document.getElementById('driveTestResult').innerHTML = `✅ تم اختيار ملف البيانات: <strong>${fileName}</strong><br>المعرف: ${fileId}`;
};

window.selectUsersFile = function(fileId, fileName) {
    if (!currentUser || currentUser.userType !== 'admin') return showNotification('غير مصرح', 'error');
    document.getElementById('driveUsersFileId').value = fileId;
    document.getElementById('driveUsersFileName').value = fileName;
    driveConfig.usersFileId = fileId; driveConfig.usersFileName = fileName;
    document.getElementById('driveTestResult').innerHTML = `✅ تم اختيار ملف المستخدمين: <strong>${fileName}</strong><br>المعرف: ${fileId}`;
};

window.findDataFileId = window.findUsersFileId = async function(isUsers = false) {
    if (!currentUser || currentUser.userType !== 'admin') return showNotification('غير مصرح', 'error');
    const apiKey = document.getElementById('driveApiKey').value.trim();
    const folderId = document.getElementById('driveFolderId').value.trim();
    const fileName = isUsers ? document.getElementById('driveUsersFileName').value.trim() : document.getElementById('driveFileName').value.trim();
    if (!apiKey || !folderId || !fileName) return document.getElementById('driveMessage').innerHTML = '❌ أكمل الحقول' + (document.getElementById('driveMessage').className = 'login-message error') + (document.getElementById('driveMessage').style.display = 'block');
    document.getElementById('driveMessage').innerHTML = `🔄 جاري البحث عن ${fileName}...`;
    document.getElementById('driveMessage').className = 'login-message info';
    try {
        const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(`'${folderId}' in parents and name='${fileName}' and trashed=false`)}&key=${apiKey}&fields=files(id,name)`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data.files?.length) {
            const fileId = data.files[0].id;
            if (isUsers) { document.getElementById('driveUsersFileId').value = fileId; driveConfig.usersFileId = fileId; }
            else { document.getElementById('driveFileId').value = fileId; driveConfig.fileId = fileId; }
            saveDriveSettingsToStorage();
            document.getElementById('driveMessage').innerHTML = `✅ تم العثور: ${fileName}<br>المعرف: ${fileId}`;
            document.getElementById('driveMessage').className = 'login-message success';
            document.getElementById('driveTestResult').innerHTML = `✅ تم العثور:<br>الاسم: ${fileName}<br>المعرف: ${fileId}`;
            document.getElementById('driveTestResult').style.display = 'block';
        } else {
            document.getElementById('driveMessage').innerHTML = `❌ لم يتم العثور على ${fileName}`;
            document.getElementById('driveMessage').className = 'login-message error';
        }
    } catch (error) {
        document.getElementById('driveMessage').innerHTML = `❌ خطأ: ${error.message}`;
        document.getElementById('driveMessage').className = 'login-message error';
    }
};

function startPeriodicUserUpdate() {
    setInterval(async () => {
        if (currentUser?.userType === 'admin') await loadUsersFromDrive();
    }, 5 * 60 * 1000);
}

async function loadInvoicesFromDrive() {
    if (!driveConfig.apiKey || !driveConfig.folderId) return false;
    let fileId = driveConfig.fileId;
    if (!fileId && driveConfig.fileName) {
        try {
            const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(`'${driveConfig.folderId}' in parents and name='${driveConfig.fileName}'`)}&key=${driveConfig.apiKey}&fields=files(id,name)`);
            if (!res.ok) throw new Error('فشل البحث');
            const data = await res.json();
            if (!data.files?.length) return false;
            fileId = data.files[0].id;
            driveConfig.fileId = fileId;
            if (currentUser?.userType === 'admin') saveDriveSettingsToStorage();
        } catch { return false; }
    } else if (!fileId) return false;

    try {
        showProgress('جاري تحميل البيانات...', 30);
        const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${driveConfig.apiKey}`);
        if (!res.ok) throw new Error('فشل التحميل');
        const content = await res.text();
        showProgress('جاري تحليل البيانات...', 60);
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(content, "text/xml");
        const parseError = xmlDoc.querySelector('parsererror');
        let newInvoices = [];

        if (parseError) {
            const matches = content.match(/<invoice[\s\S]*?<\/invoice>/g);
            if (!matches?.length) throw new Error('لا توجد فواتير');
            const wrapped = parser.parseFromString(`<root>${matches.join('')}</root>`, 'text/xml');
            const nodes = wrapped.querySelectorAll('invoice');
            for (let i = 0; i < nodes.length; i++) { const inv = parseInvoiceNode(nodes[i]); if (inv) newInvoices.push(inv); }
        } else {
            const nodes = xmlDoc.getElementsByTagName('invoice');
            for (let i = 0; i < nodes.length; i++) { const inv = parseInvoiceNode(nodes[i]); if (inv) newInvoices.push(inv); }
        }

        if (!newInvoices.length) throw new Error('لا توجد فواتير');
        invoicesData = newInvoices;
        showProgress('تم التحميل', 100);
        currentUser?.isGuest ? filterInvoicesByGuest(currentUser.taxNumber, currentUser.blNumber) : filterInvoicesByUser();
        document.getElementById('fileStatus').innerHTML = `<i class="fas fa-check-circle"></i> ✅ تم تحميل ${invoicesData.length} فاتورة من Drive`;
        updateDataSource();
        return true;
    } catch (error) {
        showNotification(`❌ خطأ: ${error.message}`, 'error');
        return false;
    } finally { setTimeout(hideProgress, 1500); }
}

window.updateFromDrive = async function() {
    if (!currentUser || currentUser.userType !== 'admin') return showNotification('غير مصرح', 'error');
    const success = await loadInvoicesFromDrive();
    showNotification(success ? 'تم التحديث' : 'فشل التحديث', success ? 'success' : 'error');
};

// ============================================
// نظام QR Code المستقل (مع تعديلات التاريخ ورقم البوليصة)
// ============================================

let qrContainer = null;
let isQRCodeMode = false;

/**
 * إنشاء رابط الفاتورة المباشر
 */
function getInvoiceLink(invoiceNumber, draftNumber = '') {
    let url = `${COMPANY_INFO.baseUrl}?invoice=${encodeURIComponent(invoiceNumber)}`;
    if (draftNumber) {
        url += `&draft=${encodeURIComponent(draftNumber)}`;
    }
    return url;
}

/**
 * إنشاء QR Code للفاتورة وعرضه
 */
function generateQRCode(invoiceNumber, draftNumber, containerId, size = 100) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = '';
    
    const canvas = document.createElement('canvas');
    canvas.id = `qrcode-${invoiceNumber}`;
    canvas.style.width = '100%';
    canvas.style.height = 'auto';
    canvas.style.maxWidth = size + 'px';
    container.appendChild(canvas);
    
    try {
        QRCode.toCanvas(canvas, getInvoiceLink(invoiceNumber, draftNumber), {
            width: size,
            margin: 1,
            color: {
                dark: '#000000',
                light: '#ffffff'
            },
            errorCorrectionLevel: 'H'
        }, function(error) {
            if (error) {
                console.error('❌ خطأ في إنشاء QR Code:', error);
                canvas.remove();
                container.innerHTML = `<div style="color:red; font-size:0.8em;">خطأ</div>`;
            } else {
                console.log(`✅ تم إنشاء QR Code للفاتورة: ${invoiceNumber}`);
                
                const caption = document.createElement('div');
                caption.style.fontSize = '0.6em';
                caption.style.marginTop = '2px';
                caption.style.color = '#666';
                caption.textContent = 'امسح للوصول';
                container.appendChild(caption);
            }
        });
    } catch (error) {
        console.error('❌ خطأ في إنشاء QR Code:', error);
        canvas.remove();
        container.innerHTML = `<div style="color:red; font-size:0.8em;">خطأ</div>`;
    }
}

/**
 * إنشاء HTML مبسط للفاتورة في نظام QR Code
 */
function createQRCodeInvoiceHTML(invoice) {
    const finalNum = invoice['final-number'] || '';
    const isPostponed = finalNum.startsWith('P') || finalNum.startsWith('p');
    const currency = invoice['currency'] || 'EGP';
    const exRate = invoice['flex-string-06'] || 48.0215;
    const voyageDate = invoice['flex-date-02'] ? new Date(invoice['flex-date-02']).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' }) : 'غير محدد';
    const invoiceDate = invoice['finalized-date'] || invoice['created'] || '';
    const formattedDate = invoiceDate ? new Date(invoiceDate).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' }) : 'غير محدد';
    
    const grouped = isPostponed ? groupPostponedCharges(invoice.charges) : groupCashCharges(invoice.charges);
    
    const invoiceTypeText = isPostponed ? 'آجل' : 'نقدي';
    const showMartyr = !(isPostponed && currency === 'USAD');
    const martyr = showMartyr ? 5 : 0;
    const baseTotal = invoice['total-total'] || 0;
    const adjustedTotal = baseTotal + martyr;
    
    let displayCurrency;
    let totalChargesDisplay, totalTaxesDisplay, displayTotal;
    
    if (isPostponed && currency === 'USAD') {
        displayCurrency = 'USAD';
        totalChargesDisplay = ((invoice['total-charges'] || 0) / exRate).toFixed(2);
        totalTaxesDisplay = ((invoice['total-taxes'] || 0) / exRate).toFixed(2);
        displayTotal = (adjustedTotal / exRate).toFixed(2);
    } else {
        displayCurrency = 'EGP';
        totalChargesDisplay = (invoice['total-charges'] || 0).toFixed(2);
        totalTaxesDisplay = (invoice['total-taxes'] || 0).toFixed(2);
        displayTotal = adjustedTotal.toFixed(2);
    }

    let chargesRows = '';
    
    grouped.forEach(charge => {
        const amount = charge.amount;
        let amountDisplay = (amount / exRate).toFixed(2);
        const qtyDisplay = charge.quantity > 1 ? ` (${charge.quantity})` : '';

        let displayStorageDays;
        if (isPostponed) {
            if (charge['event-type-id'] === 'REEFER' || charge['event-type-id'] === 'STORAGE') {
                displayStorageDays = charge.totalStorageDays;
            } else {
                displayStorageDays = 1;
            }
        } else {
            displayStorageDays = charge.totalStorageDays;
        }

        if (isPostponed) {
            chargesRows += `<tr>
                <td>${charge.description || '-'}${qtyDisplay}</td>
                <td>${charge['event-type-id'] || '-'}</td>
                <td>${charge.quantity || 1}</td>
                <td>${displayStorageDays}</td>
                <td>${(charge['rate-billed'] || 0).toFixed(2)}</td>
                <td>${amountDisplay}</td>
            </tr>`;
        } else {
            const chargeDate = charge['paid-thru-day'] || charge['created'] || '';
            const formattedChargeDate = chargeDate ? new Date(chargeDate).toLocaleDateString('ar-EG') : '-';
            
            chargesRows += `<tr>
                <td>${charge.description || '-'}${qtyDisplay}</td>
                <td>${charge['event-type-id'] || '-'}</td>
                <td>${charge.quantity || 1}</td>
                <td>${displayStorageDays}</td>
                <td>${(charge['rate-billed'] || 0).toFixed(2)}</td>
                <td>${amountDisplay}</td>
                <td>${formattedChargeDate}</td>
            </tr>`;
        }
    });

    return `
        <div class="qr-invoice-container" style="max-width: 1100px; margin: 0 auto; background: white; padding: 20px; font-family: 'Segoe UI', sans-serif; direction: rtl;">
            <style>
                .qr-invoice-header { background: linear-gradient(135deg, #1e3c72, #2a5298); color: white; padding: 15px; border-radius: 10px; margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center; }
                .qr-invoice-title { background: #4361ee; color: white; padding: 10px; text-align: center; border-radius: 8px; margin-bottom: 15px; }
                .qr-info-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 10px; margin-bottom: 15px; }
                .qr-info-box { background: #f8f9fa; padding: 10px; border-radius: 8px; border-right: 4px solid #4361ee; }
                .qr-info-row { display: flex; justify-content: space-between; padding: 3px 0; border-bottom: 1px dashed #dee2e6; font-size:0.85em; }
                .qr-charges-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
                .qr-charges-table th { background: #4361ee; color: white; padding: 8px; }
                .qr-charges-table td { padding: 6px; border-bottom: 1px solid #dee2e6; text-align: center; }
                .qr-summary { width: 280px; background: #f8f9fa; padding: 10px; border-radius: 8px; margin-right: auto; }
                .qr-signature { display: flex; justify-content: space-around; margin: 15px 0; padding: 10px 0; border-top: 2px dashed #dee2e6; }
                .qr-footer { text-align: center; padding: 8px; border-top: 2px solid #e9ecef; color: #6c757d; font-size:0.8em; }
                .qr-controls { position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); display: flex; gap: 15px; z-index: 10001; direction: rtl; background: rgba(255,255,255,0.95); padding: 15px 25px; border-radius: 60px; box-shadow: 0 5px 20px rgba(0,0,0,0.2); backdrop-filter: blur(5px); }
                .qr-btn { padding: 12px 25px; border: none; border-radius: 50px; cursor: pointer; font-size: 1em; display: flex; align-items: center; gap: 8px; transition: all 0.3s; color: white; }
                .qr-btn:hover { transform: translateY(-2px); box-shadow: 0 5px 15px rgba(0,0,0,0.2); }
                .qr-btn-primary { background: #4361ee; }
                .qr-btn-secondary { background: #6c757d; }
                .qr-btn-danger { background: #e63946; }
                .invoice-number-bold { font-weight: bold; font-size: 1.1em; }
                .invoice-date-bold { font-weight: bold; font-size: 1.1em; }
            </style>
            
            <div class="qr-invoice-header">
                <div style="display: flex; align-items: center; gap: 15px;">
                    <div style="width: 50px; height: 50px; background: rgba(255,255,255,0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.8em; border: 2px solid #ffd700;">
                        <i class="fas fa-ship"></i>
                    </div>
                    <div>
                        <h2 style="color: #ffd700; margin: 0; font-size: 1.2em;">${COMPANY_INFO.name}</h2>
                        <p style="margin: 3px 0; opacity: 0.9; font-size: 0.8em;">${COMPANY_INFO.nameEn}</p>
                    </div>
                </div>
                <div id="qr-pdf-container" style="background: white; padding: 5px; border-radius: 8px; width: 100px; height: 100px; text-align: center;"></div>
            </div>
            
            <div class="qr-invoice-title">
                <h2 style="font-size: 1.1em; margin:0;">فاتورة ${invoiceTypeText}</h2>
                <p style="margin:3px 0 0; font-size:0.8em;">
                    <span class="invoice-number-bold">${invoice['final-number'] || 'غير محدد'}</span>
                    ${invoice['draft-number'] ? `| <span class="invoice-number-bold">${invoice['draft-number']}</span>` : ''} 
                    | تاريخ: <span class="invoice-date-bold">${formattedDate}</span>
                </p>
            </div>
            
            <div class="qr-info-grid">
                <div class="qr-info-box">
                    <h4 style="color:#4361ee; margin:0 0 8px; font-size:0.95em;">بيانات العميل</h4>
                    <div class="qr-info-row"><span>الاسم:</span><span>${invoice['payee-customer-id'] || '-'}</span></div>
                    <div class="qr-info-row"><span>الدور:</span><span>${invoice['payee-customer-role'] || '-'}</span></div>
                    <div class="qr-info-row"><span>رقم العقد:</span><span>${invoice['contract-customer-id'] || '-'}</span></div>
                </div>
                <div class="qr-info-box">
                    <h4 style="color:#4361ee; margin:0 0 8px; font-size:0.95em;">بيانات الشحنة</h4>
                    <div class="qr-info-row"><span>السفينة:</span><span>${invoice['key-word1'] || '-'}</span></div>
                    <div class="qr-info-row">
                        <span>${isPostponed ? 'IB ID / OB ID' : 'رقم البوليصة'}:</span>
                        <span>${invoice['key-word2'] || '-'}</span>
                    </div>
                    <div class="qr-info-row"><span>الخط الملاحي:</span><span>${invoice['key-word3'] || '-'}</span></div>
                    <div class="qr-info-row"><span>تاريخ الرحلة:</span><span><strong>${voyageDate}</strong></span></div>
                </div>
                <div class="qr-info-box">
                    <h4 style="color:#4361ee; margin:0 0 8px; font-size:0.95em;">معلومات إضافية</h4>
                    <div class="qr-info-row"><span>الحالة:</span><span>${invoice['status'] || '-'}</span></div>
                    <div class="qr-info-row"><span>العملة:</span><span>${invoice['currency'] || '-'}</span></div>
                    <div class="qr-info-row"><span>سعر الصرف:</span><span><strong>${exRate.toFixed(4)}</strong></span></div>
                </div>
            </div>
            
            <table class="qr-charges-table">
                <thead>
                    <tr>
                        ${isPostponed ? 
                            '<th>الوصف</th><th>النوع</th><th>العدد</th><th>أيام التخزين</th><th>سعر الوحدة</th><th>المبلغ</th>' :
                            '<th>الوصف</th><th>النوع</th><th>العدد</th><th>أيام التخزين</th><th>سعر الوحدة</th><th>المبلغ</th><th>تاريخ الصرف</th>'
                        }
                    </tr>
                </thead>
                <tbody>
                    ${chargesRows}
                </tbody>
            </table>
            
            <div class="qr-summary">
                <div style="display:flex; justify-content:space-between; padding:3px 0;"><span>إجمالي المصاريف:</span><span>${totalChargesDisplay} ${displayCurrency}</span></div>
                <div style="display:flex; justify-content:space-between; padding:3px 0;"><span>إجمالي الضرائب:</span><span>${totalTaxesDisplay} ${displayCurrency}</span></div>
                ${showMartyr ? `<div style="display:flex; justify-content:space-between; padding:3px 0;"><span>طابع الشهيد:</span><span>5 جنيه</span></div>` : ''}
                <div style="display:flex; justify-content:space-between; padding:5px 0; font-weight:bold; color:#4361ee;"><span>الإجمالي النهائي:</span><span>${displayTotal} ${displayCurrency}</span></div>
            </div>
            
            <div class="qr-signature">
                <div style="text-align:center;">
                    <div style="color:#4361ee; font-weight:bold;">معد الفاتورة</div>
                    <div>${invoice['creator'] || 'غير محدد'}</div>
                    <div style="font-size:0.7em;">${new Date().toLocaleDateString('ar-EG')}</div>
                </div>
                <div style="text-align:center;">
                    <div style="color:#4361ee; font-weight:bold;">المراجع</div>
                    <div>${invoice['changer'] || invoice['creator'] || 'غير محدد'}</div>
                    <div style="font-size:0.7em;">${new Date().toLocaleDateString('ar-EG')}</div>
                </div>
                <div style="text-align:center;">
                    <div style="color:#4361ee; font-weight:bold;">الختم</div>
                    <div style="font-size:2em; opacity:0.5;"><i class="fas fa-certificate"></i></div>
                </div>
            </div>
            
            <div class="qr-footer">
                <p>شكراً لتعاملكم مع ${COMPANY_INFO.name}<br>تاريخ الطباعة: ${new Date().toLocaleDateString('ar-EG')}</p>
            </div>
        </div>
    `;
}

/**
 * إنشاء PDF محسن
 */
async function generateQRCodePDF(element, fileName) {
    return new Promise(async (resolve, reject) => {
        try {
            if (typeof window.jspdf === 'undefined' || typeof window.html2canvas === 'undefined') {
                throw new Error('مكتبات PDF غير متوفرة');
            }
            
            await new Promise(resolve => setTimeout(resolve, 500));
            
            const canvas = await html2canvas(element, {
                scale: 1.5,
                backgroundColor: '#ffffff',
                logging: false,
                allowTaint: true,
                useCORS: true,
                imageTimeout: 30000,
                windowWidth: element.scrollWidth,
                windowHeight: element.scrollHeight
            });
            
            const imgData = canvas.toDataURL('image/jpeg', 0.8);
            const { jsPDF } = window.jspdf;
            
            const pdf = new jsPDF({
                orientation: canvas.width > canvas.height ? 'l' : 'p',
                unit: 'mm',
                format: 'a4',
                compress: true
            });
            
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            
            pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
            pdf.save(fileName);
            
            resolve(true);
        } catch (error) {
            console.error('خطأ في إنشاء PDF:', error);
            reject(error);
        }
    });
}

/**
 * تحميل البيانات من Drive بشكل مستقل
 */
async function loadQRCodeData() {
    try {
        const apiKey = driveConfig.apiKey || 'AIzaSyBy4WRI3zkUwlCvbrXpB8o9ZbFMuH4AdGA';
        const folderId = driveConfig.folderId || '1FlBXLupfXCICs6xt7xxEE02wr_cjAapC';
        const fileName = driveConfig.fileName || 'datatxt.txt';
        let fileId = driveConfig.fileId;
        
        if (!fileId) {
            const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(`'${folderId}' in parents and name='${fileName}' and trashed=false`)}&key=${apiKey}&fields=files(id,name)`;
            const searchRes = await fetch(searchUrl);
            if (!searchRes.ok) throw new Error('فشل البحث عن الملف');
            const searchData = await searchRes.json();
            if (!searchData.files?.length) throw new Error('لم يتم العثور على ملف البيانات');
            fileId = searchData.files[0].id;
            driveConfig.fileId = fileId;
            localStorage.setItem('driveConfig', JSON.stringify(driveConfig));
        }
        
        const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${apiKey}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('فشل تحميل الملف');
        const content = await res.text();
        
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(content, "text/xml");
        const parseError = xmlDoc.querySelector('parsererror');
        let newInvoices = [];

        if (parseError) {
            const matches = content.match(/<invoice[\s\S]*?<\/invoice>/g);
            if (!matches?.length) throw new Error('لا توجد فواتير');
            const wrapped = parser.parseFromString(`<root>${matches.join('')}</root>`, 'text/xml');
            const nodes = wrapped.querySelectorAll('invoice');
            for (let i = 0; i < nodes.length; i++) { 
                const inv = parseInvoiceNode(nodes[i]); 
                if (inv) newInvoices.push(inv); 
            }
        } else {
            const nodes = xmlDoc.getElementsByTagName('invoice');
            for (let i = 0; i < nodes.length; i++) { 
                const inv = parseInvoiceNode(nodes[i]); 
                if (inv) newInvoices.push(inv); 
            }
        }

        if (!newInvoices.length) throw new Error('لا توجد فواتير');
        
        return newInvoices;
        
    } catch (error) {
        console.error('خطأ في تحميل بيانات QR Code:', error);
        throw error;
    }
}

/**
 * معالجة رابط QR Code
 */
async function handleQRCodeLink() {
    const urlParams = new URLSearchParams(window.location.search);
    const invoiceNumber = urlParams.get('invoice');
    const draftNumber = urlParams.get('draft');
    
    if (!invoiceNumber) return false;
    
    console.log('📱 نظام QR Code المستقل - فتح الفاتورة:', invoiceNumber, draftNumber ? `(مسودة: ${draftNumber})` : '');
    isQRCodeMode = true;
    
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('mainApp').style.display = 'none';
    
    qrContainer = document.createElement('div');
    qrContainer.id = 'qrCodeSystem';
    qrContainer.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: white;
        z-index: 1000000;
        overflow: auto;
        direction: rtl;
    `;
    
    qrContainer.innerHTML = `
        <div style="display: flex; justify-content: center; align-items: center; height: 100vh; flex-direction: column; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
            <div style="background: white; padding: 40px; border-radius: 20px; text-align: center; max-width: 400px; margin: 20px;">
                <i class="fas fa-spinner fa-spin" style="font-size: 4em; color: #4361ee; margin-bottom: 20px;"></i>
                <h2 style="color: #333; margin-bottom: 15px;">جاري تجهيز الفاتورة</h2>
                <p style="color: #666; margin-bottom: 10px;">رقم الفاتورة: <strong style="color: #4361ee;">${invoiceNumber}</strong></p>
                ${draftNumber ? `<p style="color: #666; margin-bottom: 10px;">رقم المسودة: <strong style="color: #4361ee;">${draftNumber}</strong></p>` : ''}
                <div id="qrStatus" style="margin-top: 20px; padding: 10px; border-radius: 10px; background: #f0f2f5; color: #666;"></div>
            </div>
        </div>
    `;
    
    document.body.appendChild(qrContainer);
    
    const statusDiv = document.getElementById('qrStatus');
    
    try {
        statusDiv.innerHTML = '🔄 جاري تحميل إعدادات النظام...';
        
        loadDriveSettings();
        
        statusDiv.innerHTML = '📥 جاري تحميل البيانات من Drive...';
        
        const data = await loadQRCodeData();
        
        if (!data || data.length === 0) {
            throw new Error('لا توجد بيانات متاحة');
        }
        
        statusDiv.innerHTML = '🔍 جاري البحث عن الفاتورة...';
        
        const invoice = data.find(inv => 
            inv['final-number'] === invoiceNumber || 
            (draftNumber && inv['draft-number'] === draftNumber)
        );
        
        if (!invoice) {
            throw new Error('لم يتم العثور على الفاتورة');
        }
        
        statusDiv.innerHTML = '📄 جاري إنشاء الفاتورة...';
        
        const invoiceHTML = createQRCodeInvoiceHTML(invoice);
        qrContainer.innerHTML = invoiceHTML;
        
        const qrPdfContainer = qrContainer.querySelector('#qr-pdf-container');
        if (qrPdfContainer) {
            await new Promise((resolve) => {
                const canvas = document.createElement('canvas');
                QRCode.toCanvas(canvas, getInvoiceLink(invoiceNumber, invoice['draft-number']), {
                    width: 90,
                    margin: 1,
                    color: { dark: '#000000', light: '#ffffff' }
                }, function(error) {
                    if (!error) {
                        qrPdfContainer.innerHTML = '';
                        qrPdfContainer.appendChild(canvas);
                    }
                    resolve();
                });
            });
        }
        
        const controlsDiv = document.createElement('div');
        controlsDiv.className = 'qr-controls';
        controlsDiv.innerHTML = `
            <button onclick="exitQRCodeSystem()" class="qr-btn qr-btn-secondary">
                <i class="fas fa-home"></i> الرئيسية
            </button>
            <button onclick="downloadQRCodePDF()" class="qr-btn qr-btn-primary">
                <i class="fas fa-file-pdf"></i> تحميل PDF
            </button>
            <button onclick="window.close()" class="qr-btn qr-btn-danger">
                <i class="fas fa-times"></i> إغلاق
            </button>
        `;
        qrContainer.appendChild(controlsDiv);
        
        window.currentQRCodeInvoice = invoice;
        window.currentQRCodeHTML = invoiceHTML;
        
        return true;
        
    } catch (error) {
        console.error('خطأ في نظام QR Code:', error);
        
        qrContainer.innerHTML = `
            <div style="display: flex; justify-content: center; align-items: center; height: 100vh; flex-direction: column; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
                <div style="background: white; padding: 40px; border-radius: 20px; text-align: center; max-width: 400px; margin: 20px;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 4em; color: #e63946; margin-bottom: 20px;"></i>
                    <h2 style="color: #e63946; margin-bottom: 15px;">عذراً، حدث خطأ</h2>
                    <p style="color: #666; margin-bottom: 20px;">${error.message}</p>
                    <p style="color: #666; margin-bottom: 30px;">رقم الفاتورة: <strong>${invoiceNumber}</strong></p>
                    ${draftNumber ? `<p style="color: #666; margin-bottom: 30px;">رقم المسودة: <strong>${draftNumber}</strong></p>` : ''}
                    <button onclick="exitQRCodeSystem()" style="background: #4361ee; color: white; border: none; padding: 15px 40px; border-radius: 50px; cursor: pointer; font-size: 1.1em;">
                        <i class="fas fa-home"></i> العودة للرئيسية
                    </button>
                </div>
            </div>
        `;
        return false;
    }
}

window.exitQRCodeSystem = function() {
    if (qrContainer) {
        qrContainer.remove();
        qrContainer = null;
    }
    isQRCodeMode = false;
    window.location.href = COMPANY_INFO.baseUrl;
};

window.downloadQRCodePDF = async function() {
    if (!window.currentQRCodeInvoice || !window.currentQRCodeHTML) {
        alert('لا توجد فاتورة للتحميل');
        return;
    }
    
    const loadingDiv = document.createElement('div');
    loadingDiv.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: #4361ee; color: white; padding: 15px 30px; border-radius: 50px; z-index: 2000000; box-shadow: 0 5px 20px rgba(0,0,0,0.3);';
    loadingDiv.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري إنشاء PDF...';
    document.body.appendChild(loadingDiv);
    
    try {
        const tempContainer = document.createElement('div');
        tempContainer.style.position = 'absolute';
        tempContainer.style.left = '-9999px';
        tempContainer.style.top = '-9999px';
        tempContainer.innerHTML = window.currentQRCodeHTML;
        document.body.appendChild(tempContainer);
        
        const element = tempContainer.firstChild;
        const fileName = `فاتورة-${window.currentQRCodeInvoice['final-number']}.pdf`;
        
        await generateQRCodePDF(element, fileName);
        
        document.body.removeChild(tempContainer);
        loadingDiv.remove();
        
    } catch (error) {
        console.error('خطأ في تحميل PDF:', error);
        loadingDiv.innerHTML = '❌ فشل التحميل';
        setTimeout(() => loadingDiv.remove(), 2000);
    }
};

// ============================================
// التهيئة الرئيسية
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('بدء تشغيل النظام...');
    loadDriveSettings();
    
    const isQRCode = await handleQRCodeLink();
    
    if (!isQRCode) {
        await autoConfigureDrive();
        await loadUsers();
        await initDatabase();
        checkSession();
        
        document.getElementById('fileInput')?.addEventListener('change', handleFileUpload);
        document.getElementById('sortSelect')?.addEventListener('change', () => { currentSortField = document.getElementById('sortSelect').value; renderData(); });
        document.getElementById('itemsPerPage')?.addEventListener('change', changeItemsPerPage);
        document.querySelectorAll('#searchFinalNumber, #searchDraftNumber, #searchCustomer, #searchVessel, #searchBlNumber, #searchContainer, #searchStatus, #searchDateFrom, #searchDateTo, #searchInvoiceType').forEach(input => input?.addEventListener('input', debounce(applyAdvancedSearch, 500)));
        window.addEventListener('click', e => { if (e.target === document.getElementById('invoiceModal')) window.closeModal(); });
        await loadSavedData();
        updateDataSource();
    }
});

function debounce(func, wait) {
    let timeout;
    return (...args) => { clearTimeout(timeout); timeout = setTimeout(() => func(...args), wait); };
}