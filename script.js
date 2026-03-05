// ============================================
// نظام الفواتير المتقدم - النسخة النهائية مع تصحيح البحث المتقدم
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
    logo: '<i class="fas fa-ship"></i>'
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

// إعدادات Google Drive - المعرفات الصحيحة (سيتم تحديثها تلقائياً)
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
// دوال إصلاح JSON (للمساعدة في حال وجود أخطاء في الملف)
// ============================================
function repairJSON(jsonString) {
    // إزالة الفواصل الزائدة قبل إغلاق المصفوفة أو الكائن
    jsonString = jsonString.replace(/,(\s*[\]}])/g, '$1');
    return jsonString;
}

// ============================================
// دوال البحث التلقائي عن ملفات Drive
// ============================================
async function findDataFileIdAuto() {
    if (!driveConfig.apiKey || !driveConfig.folderId) {
        console.log('⚠️ إعدادات Drive غير مكتملة للبحث عن ملف البيانات');
        return false;
    }

    const fileName = driveConfig.fileName || 'datatxt.txt';

    try {
        console.log('🔄 جاري البحث التلقائي عن ملف البيانات...');
        const query = `'${driveConfig.folderId}' in parents and name='${fileName}' and trashed=false`;
        const encodedQuery = encodeURIComponent(query);
        const url = `https://www.googleapis.com/drive/v3/files?q=${encodedQuery}&key=${driveConfig.apiKey}&fields=files(id,name)`;
        
        const response = await fetch(url);
        
        if (!response.ok) {
            console.warn('⚠️ فشل البحث عن ملف البيانات:', response.status);
            return false;
        }
        
        const data = await response.json();
        const files = data.files || [];
        
        if (files.length > 0) {
            const fileId = files[0].id;
            driveConfig.fileId = fileId;
            console.log(`✅ تم العثور تلقائياً على ملف البيانات: ${fileName} (المعرف: ${fileId})`);
            return true;
        } else {
            console.warn(`⚠️ لم يتم العثور على ملف بيانات باسم "${fileName}" في المجلد`);
            return false;
        }
    } catch (error) {
        console.error('خطأ في البحث التلقائي عن ملف البيانات:', error);
        return false;
    }
}

async function findUsersFileIdAuto() {
    if (!driveConfig.apiKey || !driveConfig.folderId) {
        console.log('⚠️ إعدادات Drive غير مكتملة للبحث عن ملف المستخدمين');
        return false;
    }

    const fileName = driveConfig.usersFileName || 'users.json';

    try {
        console.log('🔄 جاري البحث التلقائي عن ملف المستخدمين...');
        const query = `'${driveConfig.folderId}' in parents and name='${fileName}' and trashed=false`;
        const encodedQuery = encodeURIComponent(query);
        const url = `https://www.googleapis.com/drive/v3/files?q=${encodedQuery}&key=${driveConfig.apiKey}&fields=files(id,name)`;
        
        const response = await fetch(url);
        
        if (!response.ok) {
            console.warn('⚠️ فشل البحث عن ملف المستخدمين:', response.status);
            return false;
        }
        
        const data = await response.json();
        const files = data.files || [];
        
        if (files.length > 0) {
            const fileId = files[0].id;
            driveConfig.usersFileId = fileId;
            console.log(`✅ تم العثور تلقائياً على ملف المستخدمين: ${fileName} (المعرف: ${fileId})`);
            return true;
        } else {
            console.warn(`⚠️ لم يتم العثور على ملف مستخدمين باسم "${fileName}" في المجلد`);
            return false;
        }
    } catch (error) {
        console.error('خطأ في البحث التلقائي عن ملف المستخدمين:', error);
        return false;
    }
}

// دالة لتحديث جميع إعدادات Drive تلقائياً
async function autoConfigureDrive() {
    console.log('🚀 بدء الإعداد التلقائي لـ Google Drive...');
    showProgress('جاري إعداد Google Drive تلقائياً...', 20);
    
    const dataFound = await findDataFileIdAuto();
    const usersFound = await findUsersFileIdAuto();
    
    if (dataFound || usersFound) {
        saveDriveSettingsToStorage();
        showProgress('تم إعداد Drive بنجاح', 100);
        console.log('✅ تم حفظ إعدادات Drive بعد الإعداد التلقائي');
    } else {
        showProgress('لم يتم العثور على الملفات، استخدم الإعدادات الافتراضية', 100);
        console.log('⚠️ لم يتم العثور على الملفات، سيتم استخدام المعرفات الافتراضية');
    }
    
    setTimeout(hideProgress, 1500);
}

// ============================================
// تحميل المستخدمين من Google Drive
// ============================================
async function loadUsersFromDrive(force = false) {
    if (!driveConfig.apiKey || !driveConfig.folderId) {
        console.log('⚠️ إعدادات Drive غير مكتملة');
        return false;
    }

    const fileId = driveConfig.usersFileId;
    if (!fileId) {
        console.log('⚠️ لا يوجد معرف لملف المستخدمين');
        return false;
    }

    try {
        showProgress('جاري تحميل المستخدمين من Drive...', 30);
        const downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${driveConfig.apiKey}`;
        const response = await fetch(downloadUrl);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ فشل التحميل من Drive:', response.status, errorText);
            showNotification(`خطأ ${response.status}: ${response.statusText}`, 'error');
            return false;
        }
        
        let fileContent = await response.text();
        // محاولة إصلاح JSON إذا كان هناك خطأ بسيط (فاصلة زائدة)
        try {
            JSON.parse(fileContent);
        } catch (e) {
            console.warn('⚠️ خطأ في JSON، محاولة الإصلاح...');
            fileContent = repairJSON(fileContent);
        }
        
        const parsed = JSON.parse(fileContent);
        if (Array.isArray(parsed)) {
            users = parsed;
            showProgress('تم تحميل المستخدمين', 100);
            localStorage.setItem('backupUsers', JSON.stringify(users));
            console.log(`✅ تم تحميل ${users.length} مستخدم من Drive وتحديث الذاكرة`);
            return true;
        } else {
            console.error('الملف لا يحتوي على مصفوفة مستخدمين');
            return false;
        }
    } catch (error) {
        console.error('خطأ في التحميل:', error);
        showNotification('فشل تحميل المستخدمين من Drive: ' + error.message, 'error');
        return false;
    } finally {
        setTimeout(hideProgress, 1500);
    }
}

// حفظ المستخدمين إلى Google Drive
async function saveUsersToDrive() {
    if (!driveConfig.apiKey || !driveConfig.folderId || !driveConfig.usersFileId) {
        showNotification('❌ إعدادات Drive للمستخدمين غير مكتملة', 'error');
        return false;
    }

    const fileContent = JSON.stringify(users, null, 2);
    showProgress('جاري حفظ المستخدمين في Drive...', 30);

    try {
        const metadata = {
            name: driveConfig.usersFileName,
            mimeType: 'application/json'
        };

        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', new Blob([fileContent], { type: 'application/json' }));

        const updateUrl = `https://www.googleapis.com/upload/drive/v3/files/${driveConfig.usersFileId}?uploadType=multipart&key=${driveConfig.apiKey}`;
        
        showProgress('جاري رفع الملف...', 60);
        
        const response = await fetch(updateUrl, {
            method: 'PATCH',
            body: form
        });

        if (!response.ok) throw new Error('فشل تحديث الملف');
        
        showProgress('تم الحفظ بنجاح!', 100);
        showNotification('✅ تم حفظ المستخدمين في Drive', 'success');
        return true;
    } catch (error) {
        console.error('خطأ في حفظ المستخدمين:', error);
        showProgress('خطأ في الحفظ!', 100);
        showNotification(`❌ خطأ: ${error.message}`, 'error');
        return false;
    } finally {
        setTimeout(hideProgress, 1500);
    }
}

// تحميل المستخدمين من النسخ الاحتياطي (localStorage)
function loadUsersFromBackup() {
    const backup = localStorage.getItem('backupUsers');
    if (backup) {
        try {
            const parsed = JSON.parse(backup);
            if (Array.isArray(parsed) && parsed.length > 0) {
                users = parsed;
                console.log(`✅ تم تحميل ${users.length} مستخدم من النسخ الاحتياطي`);
                showNotification('تم تحميل المستخدمين من النسخ الاحتياطي', 'info');
                return true;
            }
        } catch (e) {
            console.error('خطأ في تحميل النسخ الاحتياطي:', e);
        }
    }
    return false;
}

// تحميل المستخدمين الافتراضيين
function loadDefaultUsers() {
    users = [
        { 
            id: 'user_admin', 
            username: 'admin', 
            email: 'admin@dchc-egdam.com', 
            taxNumber: 'ADMIN001', 
            contractCustomerId: 'ADMIN001',
            userType: 'admin', 
            password: 'admin123', 
            status: 'active', 
            createdAt: new Date().toISOString(), 
            lastLogin: null 
        },
        { 
            id: 'user_accountant', 
            username: 'accountant', 
            email: 'accountant@dchc-egdam.com', 
            taxNumber: 'ACC001', 
            contractCustomerId: 'ACC001',
            userType: 'accountant', 
            password: 'acc123', 
            status: 'active', 
            createdAt: new Date().toISOString(), 
            lastLogin: null 
        },
        { 
            id: 'user_customer', 
            username: 'customer', 
            email: 'customer@example.com', 
            taxNumber: '202487288', 
            contractCustomerId: 'CUST001',
            userType: 'customer', 
            password: 'cust123', 
            status: 'active', 
            createdAt: new Date().toISOString(), 
            lastLogin: null 
        }
    ];
    showNotification('تم استخدام مستخدمين افتراضيين (تعذر الاتصال بـ Drive)', 'warning');
}

// تحميل المستخدمين مع fallback
async function loadUsers(forceRefresh = false) {
    if (forceRefresh) {
        const driveSuccess = await loadUsersFromDrive(true);
        if (driveSuccess) {
            showNotification('تم تحديث المستخدمين من Drive', 'success');
        } else {
            const backupLoaded = loadUsersFromBackup();
            if (!backupLoaded) {
                loadDefaultUsers();
            }
        }
        return;
    }
    
    const driveSuccess = await loadUsersFromDrive();
    
    if (!driveSuccess) {
        const backupLoaded = loadUsersFromBackup();
        if (!backupLoaded) {
            loadDefaultUsers();
        }
    }
}

// تحديث المستخدمين من Drive (للمدير فقط)
window.refreshUsersFromDrive = async function() {
    if (!currentUser || currentUser.userType !== 'admin') {
        showNotification('غير مصرح لك بتحديث المستخدمين', 'error');
        return;
    }
    
    const success = await loadUsersFromDrive(true);
    if (success) {
        renderUsersTable();
        showNotification('تم تحديث المستخدمين من Drive', 'success');
    } else {
        const backupLoaded = loadUsersFromBackup();
        if (backupLoaded) {
            renderUsersTable();
        } else {
            showNotification('فشل التحديث، تحقق من الإعدادات', 'error');
        }
    }
};

// ============================================
// دوال إدارة المستخدمين (CRUD كاملة) - للمدير فقط
// ============================================
function renderUsersTable() {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;
    let html = '';
    users.forEach(user => {
        const statusClass = user.status === 'active' ? 'active' : 'inactive';
        const statusText = user.status === 'active' ? 'نشط' : 'غير نشط';
        const typeText = { 'admin': 'مدير', 'accountant': 'محاسب', 'customer': 'عميل' }[user.userType] || user.userType;
        const lastLogin = user.lastLogin ? new Date(user.lastLogin).toLocaleString('ar-EG') : 'لم يسجل';
        html += `<tr>
            <td>${user.username}</td>
            <td>${user.email}</td>
            <td>${user.taxNumber || '-'}</td>
            <td>${user.contractCustomerId || '-'}</td>
            <td>${typeText}</td>
            <td><span class="status-badge ${statusClass}">${statusText}</span></td>
            <td>${lastLogin}</td>
            <td>
                <button class="action-btn edit" onclick="editUser('${user.id}')"><i class="fas fa-edit"></i></button>
                <button class="action-btn reset" onclick="resetUserPassword('${user.id}')"><i class="fas fa-key"></i></button>
                <button class="action-btn delete" onclick="deleteUser('${user.id}')"><i class="fas fa-trash"></i></button>
            </td>
        </tr>`;
    });
    tbody.innerHTML = html;
}

window.showUserManagement = async function() {
    if (!currentUser || currentUser.userType !== 'admin') {
        alert('هذه الصفحة مخصصة للمدير فقط');
        return;
    }
    
    await loadUsersFromDrive(true);
    renderUsersTable();
    document.getElementById('userManagementModal').style.display = 'block';
};

window.closeUserManagementModal = function() {
    document.getElementById('userManagementModal').style.display = 'none';
    cancelUserForm();
};

window.showAddUserForm = function() {
    if (!currentUser || currentUser.userType !== 'admin') {
        alert('غير مصرح لك بهذا الإجراء');
        return;
    }
    currentEditingUserId = null;
    document.getElementById('userFormTitle').textContent = 'إضافة مستخدم جديد';
    document.getElementById('editUsername').value = '';
    document.getElementById('editEmail').value = '';
    document.getElementById('editTaxNumber').value = '';
    document.getElementById('editContractCustomerId').value = '';
    document.getElementById('editUserType').value = 'customer';
    document.getElementById('editPassword').value = '';
    document.getElementById('editStatus').value = 'active';
    document.getElementById('userForm').style.display = 'block';
};

window.editUser = function(userId) {
    if (!currentUser || currentUser.userType !== 'admin') {
        alert('غير مصرح لك بهذا الإجراء');
        return;
    }
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

window.cancelUserForm = function() {
    document.getElementById('userForm').style.display = 'none';
    currentEditingUserId = null;
};

window.saveUserFromForm = async function() {
    if (!currentUser || currentUser.userType !== 'admin') {
        alert('غير مصرح لك بهذا الإجراء');
        return;
    }
    
    const username = document.getElementById('editUsername').value.trim();
    const email = document.getElementById('editEmail').value.trim();
    const taxNumber = document.getElementById('editTaxNumber').value.trim();
    const contractCustomerId = document.getElementById('editContractCustomerId').value.trim();
    const userType = document.getElementById('editUserType').value;
    const password = document.getElementById('editPassword').value;
    const status = document.getElementById('editStatus').value;

    if (!username || !email) {
        alert('الرجاء إدخال اسم المستخدم والبريد الإلكتروني');
        return;
    }

    if (!currentEditingUserId && !password) {
        alert('الرجاء إدخال كلمة مرور للمستخدم الجديد');
        return;
    }

    if (currentEditingUserId) {
        const user = users.find(u => u.id === currentEditingUserId);
        if (user) {
            user.username = username;
            user.email = email;
            user.taxNumber = taxNumber;
            user.contractCustomerId = contractCustomerId;
            user.userType = userType;
            if (password) user.password = password;
            user.status = status;
        }
    } else {
        const newId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        const newUser = {
            id: newId,
            username,
            email,
            taxNumber,
            contractCustomerId,
            userType,
            password: password,
            status,
            createdAt: new Date().toISOString(),
            lastLogin: null
        };
        users.push(newUser);
    }

    const driveSaved = await saveUsersToDrive();
    localStorage.setItem('backupUsers', JSON.stringify(users));
    
    if (driveSaved) {
        showNotification('تم حفظ المستخدم بنجاح في Drive', 'success');
    } else {
        showNotification('تم حفظ المستخدم محلياً (تعذر الاتصال بـ Drive)', 'warning');
    }
    
    renderUsersTable();
    cancelUserForm();
};

window.resetUserPassword = async function(userId) {
    if (!currentUser || currentUser.userType !== 'admin') {
        alert('غير مصرح لك بهذا الإجراء');
        return;
    }
    
    const newPassword = prompt('أدخل كلمة المرور الجديدة للمستخدم');
    if (!newPassword) return;
    const user = users.find(u => u.id === userId);
    if (user) {
        user.password = newPassword;
        
        const driveSaved = await saveUsersToDrive();
        localStorage.setItem('backupUsers', JSON.stringify(users));
        
        if (driveSaved) {
            showNotification('تم إعادة تعيين كلمة المرور وحفظها في Drive', 'success');
        } else {
            showNotification('تم إعادة تعيين كلمة المرور محلياً', 'warning');
        }
        
        renderUsersTable();
    }
};

window.deleteUser = async function(userId) {
    if (!currentUser || currentUser.userType !== 'admin') {
        alert('غير مصرح لك بهذا الإجراء');
        return;
    }
    
    if (userId === currentUser?.id) {
        alert('لا يمكنك حذف نفسك');
        return;
    }
    if (!confirm('هل أنت متأكد من حذف هذا المستخدم؟')) return;
    users = users.filter(u => u.id !== userId);
    
    const driveSaved = await saveUsersToDrive();
    localStorage.setItem('backupUsers', JSON.stringify(users));
    
    if (driveSaved) {
        showNotification('تم حذف المستخدم وحفظ التغييرات في Drive', 'success');
    } else {
        showNotification('تم حذف المستخدم محلياً', 'warning');
    }
    
    renderUsersTable();
};

window.saveUsersManually = async function() {
    if (!currentUser || currentUser.userType !== 'admin') {
        showNotification('غير مصرح لك بهذا الإجراء', 'error');
        return;
    }
    await saveUsersToDrive();
};

// ============================================
// دالة تحميل البيانات من Drive (لجميع المستخدمين المسجلين)
// ============================================
async function loadInvoicesFromDrive() {
    if (!driveConfig.apiKey || !driveConfig.folderId) {
        console.log('⚠️ إعدادات Drive غير مكتملة');
        return false;
    }

    let fileId = driveConfig.fileId;
    
    if (!fileId && driveConfig.fileName) {
        try {
            const query = `'${driveConfig.folderId}' in parents and name='${driveConfig.fileName}'`;
            const encodedQuery = encodeURIComponent(query);
            const url = `https://www.googleapis.com/drive/v3/files?q=${encodedQuery}&key=${driveConfig.apiKey}&fields=files(id,name)`;
            
            const response = await fetch(url);
            
            if (!response.ok) throw new Error('فشل البحث عن الملف');
            
            const data = await response.json();
            if (data.files && data.files.length > 0) {
                fileId = data.files[0].id;
                driveConfig.fileId = fileId;
                if (currentUser?.userType === 'admin') {
                    saveDriveSettingsToStorage();
                }
            } else {
                return false;
            }
        } catch (error) {
            console.error('خطأ في البحث عن الملف:', error);
            return false;
        }
    } else if (!fileId) {
        return false;
    }

    try {
        showProgress('جاري تحميل البيانات من Drive...', 30);
        
        const downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${driveConfig.apiKey}`;
        const fileResponse = await fetch(downloadUrl);
        
        if (!fileResponse.ok) throw new Error('فشل تحميل الملف');
        
        const fileContent = await fileResponse.text();
        
        showProgress('جاري تحليل البيانات...', 60);
        
        // تحليل XML
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(fileContent, "text/xml");
        const parseError = xmlDoc.querySelector('parsererror');
        
        let newInvoices = [];
        
        if (parseError) {
            const invoiceMatches = fileContent.match(/<invoice[\s\S]*?<\/invoice>/g);
            if (invoiceMatches && invoiceMatches.length > 0) {
                const wrappedXml = `<root>${invoiceMatches.join('')}</root>`;
                const wrappedDoc = parser.parseFromString(wrappedXml, "text/xml");
                const invoiceNodes = wrappedDoc.querySelectorAll('invoice');
                
                for (let i = 0; i < invoiceNodes.length; i++) {
                    const inv = parseInvoiceNode(invoiceNodes[i]);
                    if (inv) newInvoices.push(inv);
                }
            } else {
                throw new Error('لم يتم العثور على بيانات فواتير صالحة');
            }
        } else {
            const invoiceNodes = xmlDoc.getElementsByTagName('invoice');
            for (let i = 0; i < invoiceNodes.length; i++) {
                const inv = parseInvoiceNode(invoiceNodes[i]);
                if (inv) newInvoices.push(inv);
            }
        }

        if (newInvoices.length === 0) throw new Error('لا توجد فواتير');

        invoicesData = newInvoices;
        
        showProgress('تم تحميل البيانات بنجاح', 100);
        
        // تطبيق التصفية حسب المستخدم
        if (currentUser?.isGuest) {
            filterInvoicesByGuest(currentUser.taxNumber, currentUser.blNumber);
        } else {
            filterInvoicesByUser();
        }
        
        document.getElementById('fileStatus').innerHTML = `<i class="fas fa-check-circle"></i> ✅ تم تحميل ${invoicesData.length} فاتورة من Drive`;
        updateDataSource();
        
        return true;
        
    } catch (error) {
        console.error('خطأ في تحميل البيانات:', error);
        showNotification(`❌ خطأ في التحميل: ${error.message}`, 'error');
        return false;
    } finally {
        setTimeout(hideProgress, 1500);
    }
}

// ============================================
// نظام تسجيل الدخول
// ============================================
function checkSession() {
    const saved = sessionStorage.getItem('currentUser');
    if (saved) {
        try {
            currentUser = JSON.parse(saved);
            document.getElementById('loginScreen').style.display = 'none';
            document.getElementById('mainApp').style.display = 'block';
            updateUserInterface();
            addDatabaseControls();
            
            // تحميل البيانات من Drive تلقائياً بعد تسجيل الدخول
            setTimeout(() => {
                loadInvoicesFromDrive();
            }, 500);
            
            if (currentUser.userType === 'admin') {
                startPeriodicUserUpdate();
            }
        } catch (e) {
            sessionStorage.removeItem('currentUser');
        }
    }
}

window.switchLoginTab = function(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.login-form').forEach(form => form.classList.remove('active'));
    
    if (tab === 'login') {
        document.querySelectorAll('.tab-btn')[0].classList.add('active');
        document.getElementById('loginForm').classList.add('active');
    } else if (tab === 'guest') {
        document.querySelectorAll('.tab-btn')[1].classList.add('active');
        document.getElementById('guestForm').classList.add('active');
    }
    
    document.getElementById('loginMessage').style.display = 'none';
};

function showLoginMessage(msg, type) {
    const div = document.getElementById('loginMessage');
    div.textContent = msg;
    div.className = `login-message ${type}`;
    div.style.display = 'block';
}

window.handleLogin = async function() {
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    
    if (!username || !password) return showLoginMessage('الرجاء إدخال اسم المستخدم وكلمة المرور', 'error');
    
    try {
        await loadUsersFromDrive(true);
    } catch (e) {
        console.log('لا يمكن تحديث المستخدمين من Drive، استخدام المخزون محلياً');
    }
    
    const user = users.find(u => (u.username === username || u.email === username) && u.status === 'active' && u.password === password);
    if (!user) return showLoginMessage('اسم المستخدم أو كلمة المرور غير صحيحة', 'error');
    
    user.lastLogin = new Date().toISOString();
    currentUser = { ...user };
    sessionStorage.setItem('currentUser', JSON.stringify(currentUser));
    
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('mainApp').style.display = 'block';
    updateUserInterface();
    addDatabaseControls();
    
    // تحميل البيانات من Drive تلقائياً بعد تسجيل الدخول
    setTimeout(() => {
        loadInvoicesFromDrive();
    }, 500);
};

window.handleGuestLogin = async function() {
    const taxNumber = document.getElementById('guestTaxNumber').value.trim();
    const blNumber = document.getElementById('guestBlNumber').value.trim();
    
    if (!taxNumber && !blNumber) {
        showLoginMessage('الرجاء إدخال الرقم الضريبي أو رقم البوليصة على الأقل', 'error');
        return;
    }
    
    const guestUser = {
        id: 'guest_' + Date.now(),
        username: 'زائر',
        email: 'guest@temp.com',
        taxNumber: taxNumber || null,
        blNumber: blNumber || null,
        userType: 'customer',
        password: null,
        status: 'active',
        isGuest: true,
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString()
    };
    
    currentUser = guestUser;
    sessionStorage.setItem('currentUser', JSON.stringify(currentUser));
    
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('mainApp').style.display = 'block';
    
    updateUserInterface();
    addDatabaseControls();
    
    // تحميل البيانات من Drive للزائر
    setTimeout(() => {
        loadInvoicesFromDrive().then(() => {
            filterInvoicesByGuest(taxNumber, blNumber);
        });
    }, 500);
    
    let message = 'مرحباً بك! أنت الآن في وضع الزائر. ';
    if (taxNumber && blNumber) {
        message += `تبحث عن فواتير نقدية برقم ضريبي ${taxNumber} ورقم بوليصة ${blNumber}`;
    } else if (taxNumber) {
        message += `تبحث عن فواتير نقدية برقم ضريبي ${taxNumber}`;
    } else if (blNumber) {
        message += `تبحث عن فاتورة برقم بوليصة ${blNumber}`;
    }
    showNotification(message, 'info');
};

window.logout = function() {
    currentUser = null;
    sessionStorage.removeItem('currentUser');
    location.reload();
};

function updateUserInterface() {
    if (!currentUser) return;
    
    let displayName = currentUser.username;
    let taxDisplay = '';
    let badgeClass = '';
    let badgeText = '';
    
    if (currentUser.isGuest) {
        displayName = 'زائر';
        taxDisplay = currentUser.taxNumber ? `ضريبي: ${currentUser.taxNumber}` : '';
        if (currentUser.blNumber) taxDisplay += (taxDisplay ? ' | ' : '') + `بوليصة: ${currentUser.blNumber}`;
        badgeClass = 'guest';
        badgeText = 'زائر';
    } else {
        taxDisplay = `الرقم الضريبي: ${currentUser.taxNumber || 'غير محدد'}`;
        if (currentUser.contractCustomerId) {
            taxDisplay += ` | رقم العقد: ${currentUser.contractCustomerId}`;
        }
        badgeClass = currentUser.userType;
        badgeText = { admin: 'مدير', accountant: 'محاسب', customer: 'عميل' }[currentUser.userType] || currentUser.userType;
    }
    
    document.getElementById('currentUserDisplay').textContent = displayName;
    document.getElementById('userTaxDisplay').textContent = taxDisplay;
    
    const badge = document.getElementById('userTypeBadge');
    badge.textContent = badgeText;
    badge.className = `user-badge ${badgeClass}`;
    
    const driveSettingsBtn = document.getElementById('driveSettingsBtn');
    const changePasswordBtn = document.querySelector('[onclick="showChangePassword()"]');
    const adminPanelBtn = document.getElementById('adminPanelBtn');
    const fileInputLabel = document.querySelector('label[for="fileInput"]');
    const updateDriveBtn = document.querySelector('.btn-drive');
    const dbControls = document.getElementById('dbControls');
    
    if (currentUser.isGuest) {
        // إخفاء كل شيء للزائر
        if (driveSettingsBtn) driveSettingsBtn.style.display = 'none';
        if (changePasswordBtn) changePasswordBtn.style.display = 'none';
        if (adminPanelBtn) adminPanelBtn.style.display = 'none';
        if (fileInputLabel) fileInputLabel.style.display = 'none';
        if (updateDriveBtn) updateDriveBtn.style.display = 'none';
        if (dbControls) dbControls.style.display = 'none';
    } else if (currentUser.userType === 'customer') {
        // العميل: يرى فقط تغيير كلمة المرور
        if (driveSettingsBtn) driveSettingsBtn.style.display = 'none';
        if (changePasswordBtn) changePasswordBtn.style.display = 'flex';
        if (adminPanelBtn) adminPanelBtn.style.display = 'none';
        if (fileInputLabel) fileInputLabel.style.display = 'none';
        if (updateDriveBtn) updateDriveBtn.style.display = 'none';
        if (dbControls) dbControls.style.display = 'none';
    } else if (currentUser.userType === 'accountant') {
        // المحاسب: يرى تغيير كلمة المرور فقط (لا يرى إعدادات Drive ولا أزرار الحفظ)
        if (driveSettingsBtn) driveSettingsBtn.style.display = 'none';
        if (changePasswordBtn) changePasswordBtn.style.display = 'flex';
        if (adminPanelBtn) adminPanelBtn.style.display = 'none';
        if (fileInputLabel) fileInputLabel.style.display = 'none';
        if (updateDriveBtn) updateDriveBtn.style.display = 'none';
        if (dbControls) dbControls.style.display = 'none';
    } else if (currentUser.userType === 'admin') {
        // المدير: يرى كل شيء
        if (driveSettingsBtn) driveSettingsBtn.style.display = 'flex';
        if (changePasswordBtn) changePasswordBtn.style.display = 'flex';
        if (adminPanelBtn) adminPanelBtn.style.display = 'flex';
        if (fileInputLabel) fileInputLabel.style.display = 'inline-flex';
        if (updateDriveBtn) updateDriveBtn.style.display = 'inline-flex';
        if (dbControls) dbControls.style.display = 'flex';
    }
}

window.showChangePassword = async function() {
    document.getElementById('currentPassword').value = '';
    document.getElementById('newPassword').value = '';
    document.getElementById('confirmNewPassword').value = '';
    document.getElementById('changePasswordMessage').style.display = 'none';
    document.getElementById('changePasswordModal').style.display = 'block';
};

window.closeChangePasswordModal = function() {
    document.getElementById('changePasswordModal').style.display = 'none';
};

window.updatePassword = async function() {
    if (!currentUser || currentUser.isGuest) {
        alert('غير مسموح للزائر بتغيير كلمة المرور');
        closeChangePasswordModal();
        return;
    }
    const current = document.getElementById('currentPassword').value;
    const newPass = document.getElementById('newPassword').value;
    const confirm = document.getElementById('confirmNewPassword').value;

    if (!current || !newPass || !confirm) {
        document.getElementById('changePasswordMessage').textContent = 'الرجاء إدخال جميع الحقول';
        document.getElementById('changePasswordMessage').style.display = 'block';
        return;
    }

    if (newPass !== confirm) {
        document.getElementById('changePasswordMessage').textContent = 'كلمة المرور الجديدة غير متطابقة';
        document.getElementById('changePasswordMessage').style.display = 'block';
        return;
    }

    const user = users.find(u => u.id === currentUser.id);
    if (!user || current !== user.password) {
        document.getElementById('changePasswordMessage').textContent = 'كلمة المرور الحالية غير صحيحة';
        document.getElementById('changePasswordMessage').style.display = 'block';
        return;
    }

    user.password = newPass;
    await saveUsersToDrive();
    showNotification('تم تغيير كلمة المرور بنجاح', 'success');
    closeChangePasswordModal();
};

// ============================================
// دوال قاعدة البيانات IndexedDB (للمدير فقط)
// ============================================
function initDatabase() {
    return new Promise((resolve) => {
        try {
            const request = indexedDB.open('InvoiceDB', 2);
            request.onerror = () => {
                useLocalStorageFallback();
                resolve();
            };
            request.onsuccess = (event) => {
                db = event.target.result;
                console.log('✅ تم فتح قاعدة البيانات');
                resolve();
            };
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (db.objectStoreNames.contains('invoices')) db.deleteObjectStore('invoices');
                if (db.objectStoreNames.contains('settings')) db.deleteObjectStore('settings');
                const store = db.createObjectStore('invoices', { keyPath: 'id', autoIncrement: true });
                store.createIndex('final-number', 'final-number', { unique: false });
                store.createIndex('draft-number', 'draft-number', { unique: false });
                store.createIndex('payee-customer-id', 'payee-customer-id', { unique: false });
                store.createIndex('contract-customer-id', 'contract-customer-id', { unique: false });
                store.createIndex('created', 'created', { unique: false });
                db.createObjectStore('settings', { keyPath: 'key' });
                console.log('✅ تم إنشاء هيكل قاعدة البيانات');
            };
        } catch (error) {
            console.error('خطأ في IndexedDB:', error);
            useLocalStorageFallback();
            resolve();
        }
    });
}

function useLocalStorageFallback() {
    console.log('استخدام localStorage كبديل');
    try {
        const saved = localStorage.getItem('invoiceData');
        if (saved) {
            invoicesData = JSON.parse(saved);
            filterInvoicesByUser();
            document.getElementById('fileStatus').innerHTML = `<i class="fas fa-database"></i> ✅ تم تحميل ${invoicesData.length} فاتورة من التخزين المحلي`;
        }
    } catch (error) {
        console.error('خطأ في localStorage:', error);
    }
}

async function saveData(showMessage = false) {
    // فقط المدير يمكنه حفظ البيانات
    if (!currentUser || currentUser.userType !== 'admin') {
        showNotification('غير مصرح لك بحفظ البيانات', 'error');
        return;
    }
    
    try {
        if (db) {
            const tx = db.transaction(['invoices'], 'readwrite');
            const store = tx.objectStore('invoices');
            await store.clear();
            for (const inv of invoicesData) await store.add(inv);
            await saveSetting('lastUpdate', new Date().toISOString());
            await saveSetting('invoiceCount', invoicesData.length);
            console.log('✅ تم حفظ', invoicesData.length, 'فاتورة في IndexedDB');
        } else {
            localStorage.setItem('invoiceData', JSON.stringify(invoicesData));
            localStorage.setItem('lastUpdate', new Date().toISOString());
            console.log('✅ تم حفظ', invoicesData.length, 'فاتورة في localStorage');
        }
        
        updateDataSource();
        
        if (showMessage) showNotification('تم حفظ البيانات بنجاح', 'success');
    } catch (error) {
        console.error('خطأ في حفظ البيانات:', error);
        if (showMessage) showNotification('خطأ في حفظ البيانات', 'error');
    }
}

async function loadSavedData() {
    try {
        let loaded = false;
        
        if (db) {
            const tx = db.transaction(['invoices'], 'readonly');
            const store = tx.objectStore('invoices');
            const data = await store.getAll();
            if (data && data.length > 0) {
                invoicesData = data;
                loaded = true;
                const lastUpdate = await getSetting('lastUpdate');
                document.getElementById('fileStatus').innerHTML = `<i class="fas fa-database"></i> ✅ تم تحميل ${invoicesData.length} فاتورة من قاعدة البيانات ${lastUpdate ? '(آخر تحديث: ' + new Date(lastUpdate).toLocaleString('ar-EG') + ')' : ''}`;
                console.log('✅ تم استعادة البيانات من IndexedDB');
            }
        }
        
        if (!loaded) {
            const saved = localStorage.getItem('invoiceData');
            if (saved) {
                invoicesData = JSON.parse(saved);
                loaded = true;
                const lastUpdate = localStorage.getItem('lastUpdate');
                document.getElementById('fileStatus').innerHTML = `<i class="fas fa-database"></i> ✅ تم تحميل ${invoicesData.length} فاتورة من التخزين المحلي ${lastUpdate ? '(آخر تحديث: ' + new Date(lastUpdate).toLocaleString('ar-EG') + ')' : ''}`;
                console.log('✅ تم استعادة البيانات من localStorage');
            }
        }
        
        if (loaded) {
            filterInvoicesByUser();
        } else {
            console.log('ℹ️ لا توجد بيانات محفوظة');
        }
        
        updateDataSource();
    } catch (error) {
        console.error('خطأ في تحميل البيانات:', error);
    }
}

function saveSetting(key, value) {
    if (!db) return Promise.resolve();
    return new Promise((resolve) => {
        try {
            const tx = db.transaction(['settings'], 'readwrite');
            const store = tx.objectStore('settings');
            store.put({ key, value }).onsuccess = resolve;
        } catch (error) {
            console.error('خطأ في حفظ الإعداد:', error);
            resolve();
        }
    });
}

function getSetting(key) {
    if (!db) return Promise.resolve(null);
    return new Promise((resolve) => {
        try {
            const tx = db.transaction(['settings'], 'readonly');
            const store = tx.objectStore('settings');
            const req = store.get(key);
            req.onsuccess = () => resolve(req.result ? req.result.value : null);
        } catch (error) {
            console.error('خطأ في قراءة الإعداد:', error);
            resolve(null);
        }
    });
}

function showNotification(message, type) {
    const notif = document.createElement('div');
    notif.className = `notification ${type}`;
    notif.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : type === 'info' ? 'info-circle' : 'exclamation-circle'}"></i><span>${message}</span>`;
    notif.style.cssText = `
        position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
        background: ${type === 'success' ? '#10b981' : type === 'info' ? '#3b82f6' : '#ef4444'};
        color: white; padding: 12px 24px; border-radius: 50px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000; display: flex; align-items: center; gap: 10px; font-size: 0.95em;
        animation: slideDown 0.3s ease;
    `;
    document.body.appendChild(notif);
    setTimeout(() => {
        notif.style.animation = 'slideUp 0.3s ease';
        setTimeout(() => notif.remove(), 300);
    }, 3000);
}

function addDatabaseControls() {
    const toolbar = document.querySelector('.toolbar-section');
    if (!toolbar) return;
    
    const existingControls = document.querySelector('.db-controls');
    if (existingControls) existingControls.remove();
    
    const controls = document.createElement('div');
    controls.className = 'db-controls';
    
    // أزرار حفظ البيانات تظهر فقط للمدير
    if (currentUser && currentUser.userType === 'admin') {
        controls.innerHTML = `
            <button class="btn btn-secondary" onclick="toggleAutoSave()" title="الحفظ التلقائي">
                <i class="fas fa-${autoSaveEnabled ? 'toggle-on' : 'toggle-off'}"></i>
            </button>
            <button class="btn btn-save" onclick="saveData(true)" title="حفظ البيانات الآن">
                <i class="fas fa-save"></i> حفظ
            </button>
        `;
        toolbar.appendChild(controls);
    }
}

window.toggleAutoSave = function() {
    if (!currentUser || currentUser.userType !== 'admin') {
        showNotification('غير مصرح لك بهذا الإجراء', 'error');
        return;
    }
    autoSaveEnabled = !autoSaveEnabled;
    const btn = document.querySelector('.db-controls button:first-child i');
    if (btn) btn.className = `fas fa-${autoSaveEnabled ? 'toggle-on' : 'toggle-off'}`;
    showNotification(`الحفظ التلقائي: ${autoSaveEnabled ? 'مفعل' : 'معطل'}`, 'info');
};

function updateDataSource() {
    const sourceElement = document.getElementById('dataSource');
    if (!sourceElement) return;
    
    const count = invoicesData.length;
    const lastUpdate = localStorage.getItem('lastUpdate') || 'غير معروف';
    const formattedDate = lastUpdate !== 'غير معروف' ? new Date(lastUpdate).toLocaleString('ar-EG') : '';
    
    if (db) {
        sourceElement.innerHTML = `📦 ${count} فاتورة - قاعدة بيانات محلية ${formattedDate ? '(آخر تحديث: ' + formattedDate + ')' : ''}`;
    } else {
        sourceElement.innerHTML = `💾 ${count} فاتورة - تخزين مؤقت ${formattedDate ? '(آخر تحديث: ' + formattedDate + ')' : ''}`;
    }
}

// ============================================
// دوال التبديل بين أنواع الفواتير
// ============================================
window.switchInvoiceType = function(type) {
    currentInvoiceType = type;
    document.querySelectorAll('.type-tab').forEach((btn, index) => {
        if ((index === 0 && type === INVOICE_TYPES.CASH) || (index === 1 && type === INVOICE_TYPES.POSTPONED)) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    filterInvoicesByUser();
};

// ============================================
// دوال رفع الملفات وتحليل XML (للمدير فقط)
// ============================================
function handleFileUpload(event) {
    // منع غير المدير من رفع الملفات
    if (!currentUser || currentUser.userType !== 'admin') {
        showNotification('غير مصرح لك برفع الملفات', 'error');
        event.target.value = '';
        return;
    }
    
    const file = event.target.files[0];
    if (!file) return;
    document.getElementById('fileStatus').innerHTML = `<i class="fas fa-spinner fa-spin"></i> جاري تحميل الملف: ${file.name}...`;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            parseXMLContent(e.target.result, file.name);
        } catch (error) {
            document.getElementById('fileStatus').innerHTML = '<i class="fas fa-exclamation-circle"></i> ❌ خطأ في قراءة الملف';
        }
    };
    reader.onerror = () => document.getElementById('fileStatus').innerHTML = '<i class="fas fa-exclamation-circle"></i> ❌ خطأ في قراءة الملف';
    reader.readAsText(file);
}

window.parseXMLContent = async function(xmlString, source) {
    try {
        showProgress('جاري تحليل الملف...', 20);
        
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlString, "text/xml");
        const parseError = xmlDoc.querySelector('parsererror');
        
        let newInvoices = [];
        
        showProgress('جاري استخراج الفواتير...', 40);
        
        if (parseError) {
            console.warn('⚠️ الملف ليس XML صحيح، محاولة استخراج XML من النص...');
            const invoiceMatches = xmlString.match(/<invoice[\s\S]*?<\/invoice>/g);
            if (invoiceMatches && invoiceMatches.length > 0) {
                const wrappedXml = `<root>${invoiceMatches.join('')}</root>`;
                const wrappedDoc = parser.parseFromString(wrappedXml, "text/xml");
                const invoiceNodes = wrappedDoc.querySelectorAll('invoice');
                
                for (let i = 0; i < invoiceNodes.length; i++) {
                    const inv = parseInvoiceNode(invoiceNodes[i]);
                    if (inv) newInvoices.push(inv);
                }
            } else {
                throw new Error('لم يتم العثور على بيانات فواتير صالحة');
            }
        } else {
            const invoiceNodes = xmlDoc.getElementsByTagName('invoice');
            for (let i = 0; i < invoiceNodes.length; i++) {
                const inv = parseInvoiceNode(invoiceNodes[i]);
                if (inv) newInvoices.push(inv);
            }
        }

        if (newInvoices.length === 0) throw new Error('لا توجد فواتير');

        invoicesData = newInvoices;
        
        showProgress('تم تحديث البيانات بنجاح', 100);
        
        if (currentUser?.isGuest) {
            filterInvoicesByGuest(currentUser.taxNumber, currentUser.blNumber);
        } else {
            filterInvoicesByUser();
        }
        
        document.getElementById('fileStatus').innerHTML = `<i class="fas fa-check-circle"></i> ✅ تم تحديث البيانات من ${source} - تم تحميل ${invoicesData.length} فاتورة`;
        updateDataSource();
        
    } catch (error) {
        document.getElementById('fileStatus').innerHTML = `<i class="fas fa-exclamation-circle"></i> ❌ خطأ: ${error.message}`;
        if (!currentUser?.isGuest) {
            invoicesData = [];
            filteredInvoices = [];
            renderData();
        }
        hideProgress();
    }
};

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
            'charges': [],
            'containers': []
        };

        const charges = invoice.getElementsByTagName('charge');
        for (let j = 0; j < charges.length; j++) {
            const charge = charges[j];
            
            let storageDays = 1;
            const from = charge.getAttribute('event-performed-from');
            const to = charge.getAttribute('event-performed-to');
            
            if (from && to) {
                const d1 = new Date(from);
                const d2 = new Date(to);
                if (!isNaN(d1) && !isNaN(d2)) {
                    const diffTime = Math.abs(d2 - d1);
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    storageDays = diffDays + 1;
                }
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
                chargeObj.taxes.push({
                    'amount': parseFloat(tax.getAttribute('amount') || 0),
                    'created': tax.getAttribute('created') || ''
                });
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
// دوال البحث المتقدم (معدلة لتراعي صلاحيات المستخدم)
// ============================================
window.applyAdvancedSearch = function() {
    if (!invoicesData.length) {
        filteredInvoices = [];
        renderData();
        return;
    }
    
    // قراءة قيم البحث
    const final = document.getElementById('searchFinalNumber')?.value.toLowerCase().trim() || '';
    const draft = document.getElementById('searchDraftNumber')?.value.toLowerCase().trim() || '';
    const cust = document.getElementById('searchCustomer')?.value.toLowerCase().trim() || '';
    const vessel = document.getElementById('searchVessel')?.value.toLowerCase().trim() || '';
    const bl = document.getElementById('searchBlNumber')?.value.toLowerCase().trim() || '';
    const cont = document.getElementById('searchContainer')?.value.toLowerCase().trim() || '';
    const status = document.getElementById('searchStatus')?.value || '';
    const from = document.getElementById('searchDateFrom')?.value || '';
    const to = document.getElementById('searchDateTo')?.value || '';
    const invType = document.getElementById('searchInvoiceType')?.value || '';

    // نبدأ من جميع الفواتير
    let tempInvoices = [...invoicesData];

    // تطبيق صلاحيات المستخدم أولاً (نفس منطق filterInvoicesByUser و filterInvoicesByGuest)
    if (currentUser?.isGuest) {
        const taxNumber = currentUser.taxNumber;
        const blNumber = currentUser.blNumber;
        tempInvoices = tempInvoices.filter(inv => {
            let match = true;
            if (taxNumber) {
                const num = inv['final-number'] || '';
                const isPostponed = num.startsWith('P') || num.startsWith('p');
                if (isPostponed) {
                    return false; // الزائر لا يرى الآجلة
                } else {
                    const payeeMatch = (inv['payee-customer-id'] || '').toLowerCase().includes(taxNumber.toLowerCase());
                    const contractMatch = (inv['contract-customer-id'] || '').toLowerCase().includes(taxNumber.toLowerCase());
                    match = match && (payeeMatch || contractMatch);
                }
            }
            if (blNumber) {
                const blMatch = (inv['key-word2'] || '').toLowerCase().includes(blNumber.toLowerCase());
                match = match && blMatch;
            }
            return match;
        });
    } else if (currentUser && currentUser.userType !== 'admin' && !currentUser.isGuest) {
        // مستخدم عادي (عميل أو محاسب) له صلاحيات
        const tax = currentUser.taxNumber || '';
        const contractId = currentUser.contractCustomerId || '';
        
        tempInvoices = tempInvoices.filter(inv => {
            const num = inv['final-number'] || '';
            const isPostponed = num.startsWith('P') || num.startsWith('p');
            
            if (isPostponed) {
                if (!contractId) return false;
                const invContractId = inv['contract-customer-id'] || '';
                return invContractId.trim().toLowerCase() === contractId.trim().toLowerCase();
            } else {
                return (inv['payee-customer-id'] || '').toLowerCase().includes(tax.toLowerCase()) || 
                       (inv['contract-customer-id'] || '').toLowerCase().includes(tax.toLowerCase());
            }
        });
    }
    // المدير لا يحتاج تصفية (يرى الكل)

    // الآن تطبيق شروط البحث المتقدم على النتائج المصفاة حسب الصلاحيات
    let searched = tempInvoices.filter(inv => {
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
            const invDate = new Date(inv['created'] || inv['finalized-date']);
            if (isNaN(invDate)) return true;
            if (from && invDate < new Date(from)) return false;
            if (to && invDate > new Date(to + 'T23:59:59')) return false;
        }
        return true;
    });

    filteredInvoices = searched;
    currentPage = 1;
    renderData();
    showNotification(`تم العثور على ${filteredInvoices.length} فاتورة`, filteredInvoices.length ? 'success' : 'info');
};

window.resetAdvancedSearch = function() {
    document.getElementById('searchFinalNumber').value = '';
    document.getElementById('searchDraftNumber').value = '';
    document.getElementById('searchCustomer').value = '';
    document.getElementById('searchVessel').value = '';
    document.getElementById('searchBlNumber').value = '';
    document.getElementById('searchContainer').value = '';
    document.getElementById('searchStatus').value = '';
    document.getElementById('searchDateFrom').value = '';
    document.getElementById('searchDateTo').value = '';
    document.getElementById('searchInvoiceType').value = '';
    
    if (currentUser?.isGuest) {
        filterInvoicesByGuest(currentUser.taxNumber, currentUser.blNumber);
    } else {
        filterInvoicesByUser();
    }
    showNotification('تم إعادة ضبط البحث', 'info');
};

// ============================================
// دوال عرض البيانات (المعدلة لحل مشكلة الفواتير الآجلة)
// ============================================
function filterInvoicesByUser() {
    if (!invoicesData.length) {
        filteredInvoices = [];
        renderData();
        return;
    }

    let temp = [...invoicesData];

    if (currentUser?.isGuest) {
        return filterInvoicesByGuest(currentUser.taxNumber, currentUser.blNumber);
    }

    // تطبيق التصفية على المستخدمين الذين لديهم بيانات تعريف (رقم ضريبي أو رقم عقد) وليسوا مديرين
    if (currentUser && currentUser.userType !== 'admin' && !currentUser.isGuest) {
        const tax = currentUser.taxNumber || '';
        const contractId = currentUser.contractCustomerId || '';
        
        temp = temp.filter(inv => {
            const num = inv['final-number'] || '';
            const isPostponed = num.startsWith('P') || num.startsWith('p');
            
            if (isPostponed) {
                // الفواتير الآجلة: يجب أن يكون للمستخدم رقم عقد ويطابق contract-customer-id تماماً
                if (!contractId) return false;
                const invContractId = inv['contract-customer-id'] || '';
                return invContractId.trim().toLowerCase() === contractId.trim().toLowerCase();
            } else {
                // الفواتير النقدية: نبحث في كلا الحقلين عن الرقم الضريبي
                return (inv['payee-customer-id'] || '').toLowerCase().includes(tax.toLowerCase()) || 
                       (inv['contract-customer-id'] || '').toLowerCase().includes(tax.toLowerCase());
            }
        });
    }

    // تصفية حسب نوع الفاتورة (نقدي/آجل) المحدد في التبويب
    temp = temp.filter(inv => {
        const num = inv['final-number'] || '';
        if (currentInvoiceType === INVOICE_TYPES.CASH) {
            return num.startsWith('C') || num.startsWith('c');
        } else {
            return num.startsWith('P') || num.startsWith('p');
        }
    });

    filteredInvoices = temp;
    currentPage = 1;
    renderData();
}

function filterInvoicesByGuest(taxNumber, blNumber) {
    if (!invoicesData.length) {
        filteredInvoices = [];
        renderData();
        showNotification('لا توجد بيانات لعرضها. حاول تحديث من Drive أولاً', 'warning');
        return;
    }
    
    filteredInvoices = invoicesData.filter(inv => {
        let match = true;
        
        if (taxNumber) {
            const num = inv['final-number'] || '';
            const isPostponed = num.startsWith('P') || num.startsWith('p');
            
            if (isPostponed) {
                return false;
            } else {
                const payeeMatch = (inv['payee-customer-id'] || '').toLowerCase().includes(taxNumber.toLowerCase());
                const contractMatch = (inv['contract-customer-id'] || '').toLowerCase().includes(taxNumber.toLowerCase());
                match = match && (payeeMatch || contractMatch);
            }
        }
        
        if (blNumber) {
            const blMatch = (inv['key-word2'] || '').toLowerCase().includes(blNumber.toLowerCase());
            match = match && blMatch;
        }
        
        return match;
    });
    
    currentPage = 1;
    renderData();
    
    if (filteredInvoices.length === 0) {
        let message = 'لم يتم العثور على فواتير نقدية تطابق ';
        if (taxNumber && blNumber) message += `الرقم الضريبي ${taxNumber} ورقم البوليصة ${blNumber}`;
        else if (taxNumber) message += `الرقم الضريبي ${taxNumber}`;
        else if (blNumber) message += `رقم البوليصة ${blNumber}`;
        showNotification(message, 'warning');
    } else {
        showNotification(`تم العثور على ${filteredInvoices.length} فاتورة نقدية`, 'success');
    }
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

// ============================================
// دالة عرض الجدول (معدلة)
// ============================================
function renderTableView(data) {
    let html = '<div class="table-container"><table class="data-table"><thead><tr><th>الرقم النهائي</th><th>رقم المسودة</th><th>العميل</th><th>السفينة</th><th>رقم البوليصة</th><th>تاريخ الرحله</th><th>الإجمالي (EGP)</th><th>المبلغ بالعملة</th><th>المتبقي</th></tr></thead><tbody>';
    data.forEach(inv => {
        const idx = invoicesData.indexOf(inv);
        const finalNum = inv['final-number'] || '';
        const invoiceTypeDisplay = finalNum.startsWith('P') || finalNum.startsWith('p') ? 'أجل' : 'نقدي';
        
        // معلومات العملة وسعر الصرف
        const currency = inv['currency'] || 'EGP';
        const exRate = inv['flex-string-06'] || 48.0215;
        const totalOriginal = inv['total-total'] || 0;
        
        // حساب المبلغ المعروض حسب العملة
        let displayAmount, displayCurrency;
        if (currency === 'USAD') {
            displayAmount = (totalOriginal / exRate).toFixed(2);
            displayCurrency = 'USAD';
        } else {
            displayAmount = totalOriginal.toFixed(2);
            displayCurrency = 'EGP';
        }
        
        html += `<tr onclick="showInvoiceDetails(${idx})" style="cursor: pointer;">
            <td>${inv['final-number'] || '-'} (${invoiceTypeDisplay})</td>
            <td>${inv['draft-number'] || '-'}</td>
            <td>${(inv['payee-customer-id'] || '-').substring(0, 20)}</td>
            <td>${inv['key-word1'] || '-'}</td>
            <td>${inv['key-word2'] || '-'}</td>
            <td>${inv['flex-date-02'] ? new Date(inv['flex-date-02']).toLocaleDateString('ar-EG') : '-'}</td>
            <td>${totalOriginal.toFixed(2)}</td>
            <td>${displayAmount} ${displayCurrency}</td>
            <td>${(inv['total-owed'] || 0).toFixed(2)}</td>
        </tr>`;
    });
    html += '</tbody></table></div>';
    document.getElementById('dataViewContainer').innerHTML = html;
}


// ============================================
// دالة عرض البطاقات (معدلة)
// ============================================
function renderCardsView(data) {
    let html = '<div class="cards-container">';
    data.forEach(inv => {
        const idx = invoicesData.indexOf(inv);
        const voyageDate = inv['flex-date-02'] ? new Date(inv['flex-date-02']).toLocaleDateString('ar-EG') : 'غير محدد';
        const finalNum = inv['final-number'] || '';
        const invoiceTypeDisplay = finalNum.startsWith('P') || finalNum.startsWith('p') ? 'أجل' : 'نقدي';
        
        // معلومات العملة وسعر الصرف
        const currency = inv['currency'] || 'EGP';
        const exRate = inv['flex-string-06'] || 48.0215;
        const totalOriginal = inv['total-total'] || 0;
        
        // حساب المبلغ المعروض حسب العملة
        let displayAmount, displayCurrency;
        if (currency === 'USAD') {
            displayAmount = (totalOriginal / exRate).toFixed(2);
            displayCurrency = 'USAD';
        } else {
            displayAmount = totalOriginal.toFixed(2);
            displayCurrency = 'EGP';
        }
        
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
        va = String(va).toLowerCase();
        vb = String(vb).toLowerCase();
        return order === 'asc' ? va.localeCompare(vb, 'ar') : vb.localeCompare(va, 'ar');
    });
}

window.toggleSortOrder = function() {
    sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    const icon = document.querySelector('#sortToggle i');
    if (icon) icon.className = sortOrder === 'asc' ? 'fas fa-sort-amount-down-alt' : 'fas fa-sort-amount-up-alt';
    renderData();
};

window.changeItemsPerPage = function() {
    const select = document.getElementById('itemsPerPage');
    itemsPerPage = select.value === 'all' ? Infinity : parseInt(select.value);
    currentPage = 1;
    renderData();
};

window.setViewMode = function(mode) {
    viewMode = mode;
    const btns = document.querySelectorAll('.btn-view');
    btns[0].classList.toggle('active', mode === 'table');
    btns[1].classList.toggle('active', mode === 'cards');
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

// ============================================
// دالة تحديث بطاقات الملخص (معدلة لإضافة البطاقتين الجديدتين)
// ============================================
function updateSummary() {
    const count = filteredInvoices.length;
    
    // حساب المبالغ حسب العملة
    let totalEGP = 0;
    let taxEGP = 0;
    let totalUSD = 0;
    let totalEGPWithoutTax = 0;
    let totalMartyr = 0;
    
    filteredInvoices.forEach(inv => {
        const currency = inv['currency'] || 'EGP';
        const total = inv['total-total'] || 0;
        const taxes = inv['total-taxes'] || 0;
        const exRate = inv['flex-string-06'] || 48.0215;
        
        // تحديد ما إذا كانت الفاتورة تنطبق عليها طابع الشهيد (أي ليست آجلة بعملة USAD)
        const finalNum = inv['final-number'] || '';
        const isPostponed = finalNum.startsWith('P') || finalNum.startsWith('p');
        const applyMartyr = !(isPostponed && currency === 'USAD');
        if (applyMartyr) {
            totalMartyr += 5; // طابع الشهيد ثابت 5 جنيه لكل فاتورة تنطبق عليها الشروط
        }
        
        if (currency === 'USAD') {
            totalUSD += total / exRate;
        } else {
            totalEGP += total;
            taxEGP += taxes;
            totalEGPWithoutTax += (total - taxes); // إجمالي المبالغ بالجنيه بدون الضريبة
        }
    });
    
    document.getElementById('invoiceCount').textContent = count;
    document.getElementById('totalSum').textContent = totalEGP.toFixed(2);
    document.getElementById('taxSum').textContent = taxEGP.toFixed(2);
    document.getElementById('totalUSD').textContent = totalUSD.toFixed(2);
    document.getElementById('totalEGPWithoutTax').textContent = totalEGPWithoutTax.toFixed(2);
    document.getElementById('totalMartyr').textContent = totalMartyr.toFixed(2);
    
    // تحديث إحصائيات الرأس
    document.getElementById('totalInvoicesHeader').textContent = count;
    const customers = new Set(filteredInvoices.map(i => i['payee-customer-id'])).size;
    const vessels = new Set(filteredInvoices.map(i => i['key-word1']).filter(v => v)).size;
    document.getElementById('totalCustomers').textContent = customers;
    document.getElementById('totalVessels').textContent = vessels;
}

function renderPagination(totalPages) {
    if (itemsPerPage === Infinity || totalPages <= 1) {
        document.getElementById('pagination').innerHTML = '';
        return;
    }
    let html = `<button class="pagination-btn" onclick="changePage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}><i class="fas fa-chevron-right"></i></button>`;
    const maxPages = 5;
    let start = Math.max(1, currentPage - Math.floor(maxPages / 2));
    let end = Math.min(totalPages, start + maxPages - 1);
    if (end - start + 1 < maxPages) start = Math.max(1, end - maxPages + 1);
    if (start > 1) {
        html += `<button class="pagination-btn" onclick="changePage(1)">1</button>`;
        if (start > 2) html += `<span class="pagination-btn disabled">...</span>`;
    }
    for (let i = start; i <= end; i++) {
        html += `<button class="pagination-btn ${i === currentPage ? 'active' : ''}" onclick="changePage(${i})">${i}</button>`;
    }
    if (end < totalPages) {
        if (end < totalPages - 1) html += `<span class="pagination-btn disabled">...</span>`;
        html += `<button class="pagination-btn" onclick="changePage(${totalPages})">${totalPages}</button>`;
    }
    html += `<button class="pagination-btn" onclick="changePage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}><i class="fas fa-chevron-left"></i></button>`;
    document.getElementById('pagination').innerHTML = html;
}

window.changePage = function(page) {
    const totalPages = itemsPerPage === Infinity ? 1 : Math.ceil(filteredInvoices.length / itemsPerPage);
    if (page >= 1 && page <= totalPages) {
        currentPage = page;
        renderData();
    }
};

// ============================================
// دوال تجميع المصاريف المتشابهة
// ============================================
function groupSimilarCharges(charges) {
    const grouped = [];
    const map = new Map();
    
    charges.forEach(c => {
        const date = c['paid-thru-day'] ? new Date(c['paid-thru-day']).toLocaleDateString('ar-EG') : '';
        const storageKey = c['storage-days'] || 1;
        const key = `${c.description}-${date}-${storageKey}`;
        
        if (map.has(key)) {
            const ex = map.get(key);
            ex.amount += c.amount;
            ex.quantity += 1;
            
            if (!ex.dates) ex.dates = [];
            ex.dates.push({
                from: c['event-performed-from'] || '-',
                to: c['event-performed-to'] || '-',
                days: c['storage-days'] || 1
            });
            
            if (c.containerNumbers?.length) {
                c.containerNumbers.forEach(cont => {
                    if (!ex.containerNumbers.includes(cont)) ex.containerNumbers.push(cont);
                });
            }
        } else {
            const newC = { 
                ...c, 
                quantity: 1, 
                containerNumbers: [...(c.containerNumbers || [])],
                dates: [{
                    from: c['event-performed-from'] || '-',
                    to: c['event-performed-to'] || '-',
                    days: c['storage-days'] || 1
                }]
            };
            map.set(key, newC);
            grouped.push(newC);
        }
    });
    
    return grouped;
}

// ============================================
// دوال تصدير تفاصيل الحاويات بصيغة Excel حقيقية
// ============================================
window.exportContainerDetails = async function(groupIndex) {
    const inv = invoicesData[selectedInvoiceIndex];
    if (!inv) return;
    
    const grouped = groupSimilarCharges(inv.charges);
    const charge = grouped[groupIndex];
    
    if (!charge || !charge.containerNumbers?.length) return;
    
    showProgress('جاري تجهيز بيانات التصدير...', 30);
    
    const exRate = inv['flex-string-06'] || 48.0215;
    const finalNum = inv['final-number'] || '';
    const isPostponed = finalNum.startsWith('P') || finalNum.startsWith('p');
    const currency = inv['currency'] || 'EGP';
    
    const exportData = [];
    
    exportData.push(['تقرير تفاصيل الحاويات']);
    exportData.push(['الفاتورة: ' + (inv['final-number'] || 'غير محدد')]);
    exportData.push(['الوصف: ' + (charge.description || 'بند غير محدد')]);
    exportData.push(['تاريخ التقرير: ' + new Date().toLocaleDateString('ar-EG')]);
    exportData.push([]);
    
    exportData.push(['معلومات الفاتورة:']);
    exportData.push(['رقم الفاتورة:', inv['final-number'] || '-']);
    exportData.push(['العميل:', inv['payee-customer-id'] || '-']);
    exportData.push(['السفينة:', inv['key-word1'] || '-']);
    exportData.push(['رقم البوليصة:', inv['key-word2'] || '-']);
    exportData.push(['سعر الصرف:', exRate.toFixed(4)]);
    exportData.push([]);
    
    exportData.push([
        'م',
        'رقم الحاوية',
        'التاريخ من',
        'التاريخ إلى',
        'عدد الأيام',
        'سعر الوحدة',
        'المبلغ',
        'العملة'
    ]);
    
    let totalAmount = 0;
    charge.containerNumbers.forEach((container, idx) => {
        const dateInfo = charge.dates && charge.dates[idx] ? charge.dates[idx] : {
            from: charge['event-performed-from'] || '-',
            to: charge['event-performed-to'] || '-',
            days: charge['storage-days'] || 1
        };
        
        let amountPerContainer;
        if (isPostponed && currency === 'USAD') {
            amountPerContainer = (charge.amount / exRate / charge.containerNumbers.length).toFixed(2);
        } else {
            amountPerContainer = (charge.amount / charge.containerNumbers.length).toFixed(2);
        }
        
        totalAmount += parseFloat(amountPerContainer);
        
        exportData.push([
            (idx + 1).toString(),
            container,
            dateInfo.from,
            dateInfo.to,
            dateInfo.days.toString(),
            (charge['rate-billed'] || 0).toFixed(2),
            amountPerContainer,
            (isPostponed && currency === 'USAD') ? 'USAD' : 'EGP'
        ]);
    });
    
    exportData.push([]);
    exportData.push([
        'الإجمالي',
        '',
        '',
        '',
        '',
        '',
        totalAmount.toFixed(2),
        (isPostponed && currency === 'USAD') ? 'USAD' : 'EGP'
    ]);
    
    exportData.push([]);
    exportData.push(['ملخص البند:']);
    exportData.push(['الوصف:', charge.description || '-']);
    exportData.push(['النوع:', charge['event-type-id'] || '-']);
    exportData.push(['عدد الحاويات:', charge.containerNumbers.length.toString()]);
    exportData.push(['إجمالي المبلغ:', charge.amount.toFixed(2), 'جنيه']);
    if (isPostponed && currency === 'USAD') {
        exportData.push(['المبلغ بعد سعر الصرف:', (charge.amount / exRate).toFixed(2), 'USAD']);
    }
    
    showProgress('جاري إنشاء ملف Excel...', 70);
    
    try {
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(exportData);
        
        const colWidths = [
            { wch: 5 },   // م
            { wch: 20 },  // رقم الحاوية
            { wch: 15 },  // التاريخ من
            { wch: 15 },  // التاريخ إلى
            { wch: 12 },  // عدد الأيام
            { wch: 12 },  // سعر الوحدة
            { wch: 15 },  // المبلغ
            { wch: 8 }    // العملة
        ];
        ws['!cols'] = colWidths;
        
        XLSX.utils.book_append_sheet(wb, ws, 'تفاصيل الحاويات');
        
        const fileName = `حاويات-${charge.description?.substring(0, 30) || 'بند'}-${inv['final-number']}.xlsx`;
        XLSX.writeFile(wb, fileName);
        
        showProgress('تم التصدير بنجاح!', 100);
        showNotification('تم تصدير تفاصيل الحاويات بنجاح', 'success');
    } catch (error) {
        console.error('خطأ في تصدير Excel:', error);
        showNotification('حدث خطأ في تصدير الملف: ' + error.message, 'error');
    } finally {
        setTimeout(hideProgress, 1500);
    }
};

// ============================================
// دوال الفاتورة والنموذج الفرعي (مع إضافة invoice-type-id)
// ============================================
window.closeModal = function() {
    document.getElementById('invoiceModal').style.display = 'none';
};

window.showInvoiceDetails = function(index) {
    if (index < 0 || index >= invoicesData.length) return;
    selectedInvoiceIndex = index;
    const inv = invoicesData[index];
    const finalNum = inv['final-number'] || '';
    const isPostponed = finalNum.startsWith('P') || finalNum.startsWith('p');
    const currency = inv['currency'] || 'EGP';
    const exRate = inv['flex-string-06'] || 48.0215;

    document.getElementById('modalInvoiceNumber').textContent = inv['final-number'] || 'غير محدد';
    const voyageDate = inv['flex-date-02'] ? new Date(inv['flex-date-02']).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' }) : 'غير محدد';
    
    const grouped = groupSimilarCharges(inv.charges);
    
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

        if (isPostponed) {
            chargesRows += `<tr onclick="toggleContainers(${idx})" style="cursor: pointer;">
                <td>${charge.description || '-'}${qtyDisplay}</td>
                <td>${charge['event-type-id'] || '-'}</td>
                <td>${charge.quantity || 1}</td>
                <td>${charge['storage-days'] || 1}</td>
                <td>${(charge['rate-billed'] || 0).toFixed(2)}</td>
                <td><strong>${amountDisplay}</strong></td>
                <td>${containerCount > 0 ? `<i id="icon-${idx}" class="fas fa-chevron-down"></i> <span style="font-size:0.8em;">${containerCount}</span>` : ''}</td>
            </tr>`;
        } else {
            const chargeDate = charge['paid-thru-day'] || charge['created'] || '';
            const formattedDate = chargeDate ? new Date(chargeDate).toLocaleDateString('ar-EG') : '-';
            
            chargesRows += `<tr onclick="toggleContainers(${idx})" style="cursor: pointer;">
                <td>${charge.description || '-'}${qtyDisplay}</td>
                <td>${charge['event-type-id'] || '-'}</td>
                <td>${charge.quantity || 1}</td>
                <td>${charge['storage-days'] || 1}</td>
                <td>${(charge['rate-billed'] || 0).toFixed(2)}</td>
                <td><strong>${amountDisplay}</strong></td>
                <td>${formattedDate}</td>
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

    let html = `
        <div class="invoice-container" id="invoicePrint">
            <div class="invoice-company-header">
                <div class="invoice-company-logo"><i class="fas fa-ship"></i></div>
                <div class="invoice-company-details">
                    <h2>${COMPANY_INFO.name}</h2>
                    <p>${COMPANY_INFO.nameEn}</p>
                    <div class="invoice-company-meta">
                        <span><i class="fas fa-map-marker-alt"></i> ${COMPANY_INFO.address}</span>
                        <span><i class="fas fa-phone"></i> ${COMPANY_INFO.phone}</span>
                        <span><i class="fas fa-envelope"></i> ${COMPANY_INFO.email}</span>
                        <span><i class="fas fa-building"></i> الرقم الضريبي: ${COMPANY_INFO.taxNumber}</span>
                    </div>
                </div>
            </div>
            <div class="invoice-header">
                <h2><i class="fas fa-file-invoice"></i> فاتورة رسمية - ${invoiceTypeText}</h2>
                <p style="font-size: 1em; margin-top: 5px; color: #f0f0f0;"><i class="fas fa-tag"></i> ${inv['invoice-type-id'] || 'غير محدد'}</p>
                <p style="margin-top: 5px;">رقم: ${inv['final-number'] || 'غير محدد'} | تاريخ: ${inv['created'] ? new Date(inv['created']).toLocaleDateString('ar-EG') : '-'}</p>
            </div>
            <div class="invoice-info-grid">
                <div class="info-box">
                    <h4><i class="fas fa-building"></i> بيانات العميل</h4>
                    <div class="info-row"><span>الاسم:</span><span>${inv['payee-customer-id'] || '-'}</span></div>
                    <div class="info-row"><span>الدور:</span><span>${inv['payee-customer-role'] || '-'}</span></div>
                    <div class="info-row"><span>رقم العقد:</span><span>${inv['contract-customer-id'] || '-'}</span></div>
                </div>
                <div class="info-box">
                    <h4><i class="fas fa-ship"></i> بيانات الشحنة</h4>
                    <div class="info-row"><span>السفينة:</span><span>${inv['key-word1'] || '-'}</span></div>
                    <div class="info-row"><span>رقم البوليصة:</span><span>${inv['key-word2'] || '-'}</span></div>
                    <div class="info-row"><span>الخط الملاحي:</span><span>${inv['key-word3'] || '-'}</span></div>
                    <div class="info-row"><span>تاريخ الرحلة:</span><span><strong>${voyageDate}</strong></span></div>
                </div>
                <div class="info-box">
                    <h4><i class="fas fa-info-circle"></i> معلومات إضافية</h4>
                    <div class="info-row"><span>الحالة:</span><span>${inv['status'] || '-'}</span></div>
                    <div class="info-row"><span>العملة:</span><span>${inv['currency'] || '-'}</span></div>
                    <div class="info-row"><span>المنشأة:</span><span>${facilityDisplay}</span></div>
                    ${exchangeRateRow}
                </div>
            </div>
            <div class="charges-section">
                <h3><i class="fas fa-list"></i> تفاصيل المصاريف</h3>
                <table class="charges-table">
                    <thead>
                        ${tableHeaders}
                    </thead>
                    <tbody>
                        ${chargesRows}
                    </tbody>
                </table>
            </div>
            <div class="invoice-summary">
                ${summaryHtml}
            </div>
            <div class="signature-section">
                <div class="signature-box"><div class="signature-title">معد الفاتورة</div><div class="signature-name">${preparer}</div><div class="signature-line"></div><div class="signature-date">${new Date().toLocaleDateString('ar-EG')}</div></div>
                <div class="signature-box"><div class="signature-title">المراجع</div><div class="signature-name">${reviewer}</div><div class="signature-line"></div><div class="signature-date">${new Date().toLocaleDateString('ar-EG')}</div></div>
                <div class="signature-box"><div class="signature-title">الختم</div><div class="signature-stamp"><i class="fas fa-certificate"></i></div></div>
            </div>
            <div class="invoice-footer">
                <p>شكراً لتعاملكم مع ${COMPANY_INFO.name}</p>
                <p>تم إنشاء هذه الفاتورة إلكترونياً</p>
                <p>تاريخ الطباعة: ${new Date().toLocaleDateString('ar-EG')}</p>
            </div>
        </div>
    `;

    document.getElementById('modalBody').innerHTML = html;
    document.getElementById('invoiceModal').style.display = 'block';
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

window.navigateInvoice = function(direction) {
    if (selectedInvoiceIndex === -1) return;
    const newIndex = direction === 'prev' ? selectedInvoiceIndex - 1 : selectedInvoiceIndex + 1;
    if (newIndex >= 0 && newIndex < invoicesData.length) {
        showInvoiceDetails(newIndex);
    } else {
        alert(direction === 'prev' ? 'هذه أول فاتورة' : 'هذه آخر فاتورة');
    }
};

// ============================================
// دوال الطباعة والتصدير للفواتير
// ============================================
window.printInvoice = function() {
    const content = document.getElementById('invoicePrint');
    if (!content) return alert('لا توجد فاتورة للطباعة');
    
    const printWindow = window.open('', '_blank', 'width=1200,height=800');
    
    const printStyles = `
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
                padding: 20px; 
                background: white; 
                direction: rtl;
            }
            .invoice-container { 
                max-width: 1100px; 
                margin: 0 auto; 
                background: white; 
                padding: 25px;
                border-radius: 15px;
                box-shadow: 0 5px 20px rgba(0,0,0,0.1);
            }
            .invoice-company-header {
                display: flex;
                align-items: center;
                gap: 25px;
                background: linear-gradient(135deg, #1e3c72, #2a5298);
                color: white;
                padding: 25px;
                border-radius: 10px;
                margin-bottom: 25px;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }
            .invoice-company-logo {
                width: 80px;
                height: 80px;
                background: rgba(255,255,255,0.1);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 2.5em;
                border: 3px solid #ffd700;
            }
            .invoice-company-details h2 { 
                color: #ffd700; 
                margin: 0 0 5px; 
                font-size: 1.5em;
            }
            .invoice-company-details p {
                margin-bottom: 10px;
                opacity: 0.9;
                font-style: italic;
            }
            .invoice-company-meta {
                display: flex;
                flex-wrap: wrap;
                gap: 20px;
                font-size: 0.9em;
            }
            .invoice-company-meta i { color: #ffd700; margin-left: 5px; }
            .invoice-header {
                background: linear-gradient(135deg, #4361ee, #3f37c9);
                color: white;
                padding: 20px;
                text-align: center;
                border-radius: 10px;
                margin-bottom: 25px;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }
            .invoice-info-grid {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 20px;
                margin-bottom: 30px;
            }
            .info-box {
                background: #f8f9fa;
                padding: 20px;
                border-radius: 10px;
                border-right: 4px solid #4361ee;
            }
            .info-box h4 {
                color: #4361ee;
                margin-bottom: 15px;
                font-size: 1.1em;
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .info-row {
                display: flex;
                justify-content: space-between;
                padding: 8px 0;
                border-bottom: 1px dashed #dee2e6;
            }
            .info-row:last-child { border-bottom: none; }
            .charges-section { margin-bottom: 30px; }
            .charges-section h3 {
                color: #212529;
                margin-bottom: 20px;
                font-size: 1.3em;
                display: flex;
                align-items: center;
                gap: 10px;
            }
            .charges-table {
                width: 100%;
                border-collapse: collapse;
                background: white;
                border-radius: 10px;
                overflow: hidden;
                box-shadow: 0 2px 10px rgba(0,0,0,0.05);
                font-size: 0.9em;
            }
            .charges-table th {
                background: #4361ee;
                color: white;
                padding: 12px;
                font-weight: 600;
                text-align: center;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }
            .charges-table td {
                padding: 10px;
                border-bottom: 1px solid #e9ecef;
                text-align: center;
            }
            .charges-table tbody tr:last-child td { border-bottom: none; }
            .invoice-summary {
                display: flex;
                justify-content: flex-end;
                margin-top: 20px;
            }
            .summary-box {
                width: 350px;
                background: #f8f9fa;
                padding: 20px;
                border-radius: 10px;
            }
            .summary-row {
                display: flex;
                justify-content: space-between;
                padding: 10px 0;
                border-bottom: 1px solid #dee2e6;
            }
            .summary-row.total {
                border-bottom: none;
                font-size: 1.2em;
                font-weight: bold;
                color: #4361ee;
                padding-top: 15px;
            }
            .signature-section {
                display: flex;
                justify-content: space-around;
                margin: 40px 0 30px;
                padding: 20px 0;
                border-top: 2px dashed #dee2e6;
            }
            .signature-box { text-align: center; width: 180px; }
            .signature-title {
                color: #4361ee;
                font-weight: bold;
                margin-bottom: 10px;
                font-size: 1.1em;
            }
            .signature-name {
                font-size: 1.1em;
                margin-bottom: 5px;
                color: #212529;
                font-weight: 600;
            }
            .signature-line {
                height: 2px;
                background: #4361ee;
                width: 100%;
                margin: 8px 0;
            }
            .signature-date { font-size: 0.9em; color: #666; }
            .signature-stamp {
                font-size: 3em;
                color: #e63946;
                opacity: 0.5;
                transform: rotate(-15deg);
            }
            .invoice-footer {
                text-align: center;
                margin-top: 30px;
                padding-top: 20px;
                border-top: 2px solid #e9ecef;
                color: #6c757d;
                font-size: 0.9em;
            }
            @media print {
                body { padding: 0; }
                .invoice-container { box-shadow: none; }
            }
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
    printWindow.print();
};

window.exportInvoicePDF = function() {
    if (typeof window.jspdf === 'undefined' || typeof window.html2canvas === 'undefined') {
        alert('جاري تحميل مكتبات PDF...');
        return;
    }
    const element = document.getElementById('invoicePrint');
    if (!element) return alert('لا توجد فاتورة');
    const loading = document.createElement('div');
    loading.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#4361ee;color:white;padding:20px 40px;border-radius:10px;z-index:10000;';
    loading.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري إنشاء PDF...';
    document.body.appendChild(loading);
    html2canvas(element, { scale: 2 }).then(canvas => {
        document.body.removeChild(loading);
        const img = canvas.toDataURL('image/png');
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF();
        const w = pdf.internal.pageSize.getWidth();
        const h = (canvas.height * w) / canvas.width;
        pdf.addImage(img, 'PNG', 0, 0, w, h);
        pdf.save(`فاتورة-${document.getElementById('modalInvoiceNumber').textContent}.pdf`);
    }).catch(() => {
        document.body.removeChild(loading);
        alert('حدث خطأ في إنشاء PDF');
    });
};

window.exportInvoiceExcel = function() {
    const inv = invoicesData[selectedInvoiceIndex];
    if (!inv) return;
    const exRate = inv['flex-string-06'] || 48.0215;
    const martyr = 5;
    const isPostponed = (inv['final-number'] || '').startsWith('P') || (inv['final-number'] || '').startsWith('p');
    const currency = inv['currency'] || 'EGP';
    
    let csv = "الوصف,النوع,العدد,أيام التخزين,سعر الوحدة,المبلغ,العملة,تاريخ الصرف\n";
    inv.charges.forEach(c => {
        let amountDisplay;
        if (isPostponed && currency === 'USAD') {
            amountDisplay = (c.amount / exRate).toFixed(2);
        } else {
            amountDisplay = (c.amount).toFixed(2);
        }
        const displayCurrency = (isPostponed && currency === 'USAD') ? 'USAD' : 'EGP';
        const date = c['paid-thru-day'] || c['created'] || '';
        const fmtDate = date ? new Date(date).toLocaleDateString('ar-EG') : '-';
        csv += `"${c.description}","${c['event-type-id']}",${c.quantity},${c['storage-days']},${c['rate-billed']},${amountDisplay},"${displayCurrency}","${fmtDate}"\n`;
    });
    
    let totalCharges, totalTaxes, totalFinal;
    if (isPostponed && currency === 'USAD') {
        totalCharges = ((inv['total-charges'] || 0) / exRate).toFixed(2);
        totalTaxes = ((inv['total-taxes'] || 0) / exRate).toFixed(2);
        totalFinal = ((inv['total-total'] || 0) / exRate + martyr).toFixed(2);
    } else {
        totalCharges = (inv['total-charges'] || 0).toFixed(2);
        totalTaxes = (inv['total-taxes'] || 0).toFixed(2);
        totalFinal = ((inv['total-total'] || 0) + martyr).toFixed(2);
    }
    
    csv += `\nإجمالي المصاريف,${totalCharges},إجمالي الضرائب,${totalTaxes},طابع الشهيد,${martyr},الإجمالي النهائي,${totalFinal}`;
    
    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `فاتورة-${inv['final-number']}.csv`;
    link.click();
};

// ============================================
// دوال نظام التقارير المتكاملة
// ============================================
window.showReports = function(type) {
    currentReportType = type;
    
    document.querySelectorAll('.report-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    event.target.classList.add('active');
    
    document.getElementById('dataViewContainer').style.display = 'none';
    document.getElementById('reportsContainer').style.display = 'block';
    document.getElementById('pagination').style.display = 'none';
    
    switch(type) {
        case 'daily':
            generateDailyReport();
            break;
        case 'monthly':
            generateMonthlyReport();
            break;
        case 'customer':
            generateCustomerReport();
            break;
        case 'vessel':
            generateVesselReport();
            break;
    }
};

window.closeReports = function() {
    document.getElementById('reportsContainer').style.display = 'none';
    document.getElementById('dataViewContainer').style.display = 'block';
    document.getElementById('pagination').style.display = 'flex';
};

function generateDailyReport() {
    document.getElementById('reportTitle').textContent = 'التقارير اليومية';
    
    if (filteredInvoices.length === 0) {
        document.getElementById('reportContent').innerHTML = '<div class="no-data">لا توجد بيانات للعرض</div>';
        return;
    }
    
    const dailyData = new Map();
    
    filteredInvoices.forEach(inv => {
        const date = inv['created'] ? new Date(inv['created']).toLocaleDateString('ar-EG') : 'غير محدد';
        if (!dailyData.has(date)) {
            dailyData.set(date, {
                count: 0,
                total: 0,
                taxes: 0,
                invoices: []
            });
        }
        const dayData = dailyData.get(date);
        dayData.count++;
        dayData.total += inv['total-total'] || 0;
        dayData.taxes += inv['total-taxes'] || 0;
        dayData.invoices.push(inv);
    });
    
    const sortedDays = Array.from(dailyData.entries()).sort((a, b) => 
        new Date(b[0]) - new Date(a[0])
    );
    
    let html = '<div class="report-card">';
    html += '<h3><i class="fas fa-calendar-day"></i> إحصائيات يومية</h3>';
    
    const totalDays = sortedDays.length;
    const totalAmount = Array.from(dailyData.values()).reduce((sum, d) => sum + d.total, 0);
    const avgPerDay = totalDays > 0 ? (totalAmount / totalDays).toFixed(2) : 0;
    
    html += '<div class="report-stats">';
    html += `<div class="stat-item"><div class="stat-label">عدد الأيام</div><div class="stat-value">${totalDays}</div></div>`;
    html += `<div class="stat-item"><div class="stat-label">إجمالي الفواتير</div><div class="stat-value">${filteredInvoices.length}</div></div>`;
    html += `<div class="stat-item"><div class="stat-label">المتوسط اليومي</div><div class="stat-value">${avgPerDay} جنيه</div></div>`;
    html += `<div class="stat-item"><div class="stat-label">إجمالي المبالغ</div><div class="stat-value">${totalAmount.toFixed(2)} جنيه</div></div>`;
    html += '</div>';
    
    const last7Days = sortedDays.slice(0, 7);
    const maxAmount = Math.max(...last7Days.map(d => d[1].total));
    
    html += '<div class="chart-container">';
    html += '<h4>آخر 7 أيام</h4>';
    html += '<div class="chart-bars">';
    
    last7Days.forEach(([date, data]) => {
        const height = maxAmount > 0 ? (data.total / maxAmount) * 180 : 0;
        html += `<div class="chart-bar" style="height: ${height}px;" title="${data.total.toFixed(2)} جنيه">`;
        html += `<span class="bar-label">${date.split('/')[0]}</span>`;
        html += `<span class="bar-value">${data.total.toFixed(0)}</span>`;
        html += '</div>';
    });
    
    html += '</div></div>';
    
    html += '<h4>تفاصيل يومية</h4>';
    html += '<table class="report-table">';
    html += '<thead><tr><th>التاريخ</th><th>عدد الفواتير</th><th>إجمالي المبالغ</th><th>الضرائب</th><th>المتوسط</th></tr></thead>';
    html += '<tbody>';
    
    sortedDays.forEach(([date, data]) => {
        const avg = data.count > 0 ? (data.total / data.count).toFixed(2) : 0;
        html += `<tr>
            <td>${date}</td>
            <td>${data.count}</td>
            <td>${data.total.toFixed(2)} جنيه</td>
            <td>${data.taxes.toFixed(2)} جنيه</td>
            <td>${avg} جنيه</td>
        </tr>`;
    });
    
    html += '</tbody></table>';
    html += '</div>';
    
    document.getElementById('reportContent').innerHTML = html;
}

function generateMonthlyReport() {
    document.getElementById('reportTitle').textContent = 'التقارير الشهرية';
    
    if (filteredInvoices.length === 0) {
        document.getElementById('reportContent').innerHTML = '<div class="no-data">لا توجد بيانات للعرض</div>';
        return;
    }
    
    const monthlyData = new Map();
    
    filteredInvoices.forEach(inv => {
        const date = inv['created'] ? new Date(inv['created']) : new Date();
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const monthName = date.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long' });
        
        if (!monthlyData.has(monthKey)) {
            monthlyData.set(monthKey, {
                name: monthName,
                count: 0,
                total: 0,
                taxes: 0,
                invoices: []
            });
        }
        const monthData = monthlyData.get(monthKey);
        monthData.count++;
        monthData.total += inv['total-total'] || 0;
        monthData.taxes += inv['total-taxes'] || 0;
        monthData.invoices.push(inv);
    });
    
    const sortedMonths = Array.from(monthlyData.entries()).sort((a, b) => b[0].localeCompare(a[0]));
    
    let html = '<div class="report-card">';
    html += '<h3><i class="fas fa-calendar-alt"></i> إحصائيات شهرية</h3>';
    
    const totalMonths = sortedMonths.length;
    const totalAmount = Array.from(monthlyData.values()).reduce((sum, d) => sum + d.total, 0);
    const avgPerMonth = totalMonths > 0 ? (totalAmount / totalMonths).toFixed(2) : 0;
    
    html += '<div class="report-stats">';
    html += `<div class="stat-item"><div class="stat-label">عدد الأشهر</div><div class="stat-value">${totalMonths}</div></div>`;
    html += `<div class="stat-item"><div class="stat-label">إجمالي الفواتير</div><div class="stat-value">${filteredInvoices.length}</div></div>`;
    html += `<div class="stat-item"><div class="stat-label">المتوسط الشهري</div><div class="stat-value">${avgPerMonth} جنيه</div></div>`;
    html += `<div class="stat-item"><div class="stat-label">إجمالي المبالغ</div><div class="stat-value">${totalAmount.toFixed(2)} جنيه</div></div>`;
    html += '</div>';
    
    html += '<table class="report-table">';
    html += '<thead><tr><th>الشهر</th><th>عدد الفواتير</th><th>إجمالي المبالغ</th><th>الضرائب</th><th>المتوسط</th></tr></thead>';
    html += '<tbody>';
    
    sortedMonths.forEach(([key, data]) => {
        const avg = data.count > 0 ? (data.total / data.count).toFixed(2) : 0;
        html += `<tr>
            <td>${data.name}</td>
            <td>${data.count}</td>
            <td>${data.total.toFixed(2)} جنيه</td>
            <td>${data.taxes.toFixed(2)} جنيه</td>
            <td>${avg} جنيه</td>
        </tr>`;
    });
    
    html += '</tbody></table>';
    html += '</div>';
    
    document.getElementById('reportContent').innerHTML = html;
}

function generateCustomerReport() {
    document.getElementById('reportTitle').textContent = 'تقارير العملاء';
    
    if (filteredInvoices.length === 0) {
        document.getElementById('reportContent').innerHTML = '<div class="no-data">لا توجد بيانات للعرض</div>';
        return;
    }
    
    const customerData = new Map();
    
    filteredInvoices.forEach(inv => {
        const customerId = inv['payee-customer-id'] || 'غير معروف';
        
        if (!customerData.has(customerId)) {
            customerData.set(customerId, {
                count: 0,
                total: 0,
                taxes: 0,
                invoices: []
            });
        }
        const custData = customerData.get(customerId);
        custData.count++;
        custData.total += inv['total-total'] || 0;
        custData.taxes += inv['total-taxes'] || 0;
        custData.invoices.push(inv);
    });
    
    const sortedCustomers = Array.from(customerData.entries()).sort((a, b) => b[1].total - a[1].total);
    
    let html = '<div class="report-card">';
    html += '<h3><i class="fas fa-users"></i> إحصائيات العملاء</h3>';
    
    const totalCustomers = sortedCustomers.length;
    const totalAmount = sortedCustomers.reduce((sum, [_, data]) => sum + data.total, 0);
    const topCustomer = sortedCustomers.length > 0 ? sortedCustomers[0][0] : 'لا يوجد';
    
    html += '<div class="report-stats">';
    html += `<div class="stat-item"><div class="stat-label">عدد العملاء</div><div class="stat-value">${totalCustomers}</div></div>`;
    html += `<div class="stat-item"><div class="stat-label">إجمالي الفواتير</div><div class="stat-value">${filteredInvoices.length}</div></div>`;
    html += `<div class="stat-item"><div class="stat-label">أعلى عميل</div><div class="stat-value">${topCustomer.substring(0, 20)}</div></div>`;
    html += `<div class="stat-item"><div class="stat-label">إجمالي المبالغ</div><div class="stat-value">${totalAmount.toFixed(2)} جنيه</div></div>`;
    html += '</div>';
    
    html += '<table class="report-table">';
    html += '<thead><tr><th>العميل</th><th>عدد الفواتير</th><th>إجمالي المبالغ</th><th>الضرائب</th><th>المتوسط</th></tr></thead>';
    html += '<tbody>';
    
    sortedCustomers.forEach(([customer, data]) => {
        const avg = data.count > 0 ? (data.total / data.count).toFixed(2) : 0;
        html += `<tr>
            <td>${customer.substring(0, 30)}</td>
            <td>${data.count}</td>
            <td>${data.total.toFixed(2)} جنيه</td>
            <td>${data.taxes.toFixed(2)} جنيه</td>
            <td>${avg} جنيه</td>
        </tr>`;
    });
    
    html += '</tbody></table>';
    html += '</div>';
    
    document.getElementById('reportContent').innerHTML = html;
}

function generateVesselReport() {
    document.getElementById('reportTitle').textContent = 'تقارير السفن';
    
    if (filteredInvoices.length === 0) {
        document.getElementById('reportContent').innerHTML = '<div class="no-data">لا توجد بيانات للعرض</div>';
        return;
    }
    
    const vesselData = new Map();
    
    filteredInvoices.forEach(inv => {
        const vessel = inv['key-word1'] || 'غير معروف';
        
        if (!vesselData.has(vessel)) {
            vesselData.set(vessel, {
                count: 0,
                total: 0,
                taxes: 0,
                invoices: []
            });
        }
        const vesData = vesselData.get(vessel);
        vesData.count++;
        vesData.total += inv['total-total'] || 0;
        vesData.taxes += inv['total-taxes'] || 0;
        vesData.invoices.push(inv);
    });
    
    const sortedVessels = Array.from(vesselData.entries()).sort((a, b) => b[1].total - a[1].total);
    
    let html = '<div class="report-card">';
    html += '<h3><i class="fas fa-ship"></i> إحصائيات السفن</h3>';
    
    const totalVessels = sortedVessels.length;
    const totalAmount = sortedVessels.reduce((sum, [_, data]) => sum + data.total, 0);
    const topVessel = sortedVessels.length > 0 ? sortedVessels[0][0] : 'لا يوجد';
    
    html += '<div class="report-stats">';
    html += `<div class="stat-item"><div class="stat-label">عدد السفن</div><div class="stat-value">${totalVessels}</div></div>`;
    html += `<div class="stat-item"><div class="stat-label">إجمالي الفواتير</div><div class="stat-value">${filteredInvoices.length}</div></div>`;
    html += `<div class="stat-item"><div class="stat-label">أكثر سفينة</div><div class="stat-value">${topVessel}</div></div>`;
    html += `<div class="stat-item"><div class="stat-label">إجمالي المبالغ</div><div class="stat-value">${totalAmount.toFixed(2)} جنيه</div></div>`;
    html += '</div>';
    
    html += '<table class="report-table">';
    html += '<thead><tr><th>السفينة</th><th>عدد الفواتير</th><th>إجمالي المبالغ</th><th>الضرائب</th><th>المتوسط</th></tr></thead>';
    html += '<tbody>';
    
    sortedVessels.forEach(([vessel, data]) => {
        const avg = data.count > 0 ? (data.total / data.count).toFixed(2) : 0;
        html += `<tr>
            <td>${vessel}</td>
            <td>${data.count}</td>
            <td>${data.total.toFixed(2)} جنيه</td>
            <td>${data.taxes.toFixed(2)} جنيه</td>
            <td>${avg} جنيه</td>
        </tr>`;
    });
    
    html += '</tbody></table>';
    html += '</div>';
    
    document.getElementById('reportContent').innerHTML = html;
}

// ============================================
// دوال تصدير التقارير إلى PDF و Excel
// ============================================
window.exportReportPDF = function() {
    const reportContent = document.getElementById('reportContent');
    if (!reportContent || reportContent.innerHTML.trim() === '') {
        alert('لا يوجد تقرير لتصديره');
        return;
    }

    const loading = document.createElement('div');
    loading.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#4361ee;color:white;padding:20px 40px;border-radius:10px;z-index:10000;';
    loading.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري إنشاء PDF...';
    document.body.appendChild(loading);

    html2canvas(reportContent, { scale: 2, backgroundColor: '#ffffff' }).then(canvas => {
        document.body.removeChild(loading);
        const imgData = canvas.toDataURL('image/png');
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        const reportTitle = document.getElementById('reportTitle').textContent.replace(/\s/g, '_');
        pdf.save(`تقرير_${reportTitle}_${new Date().toLocaleDateString('ar-EG')}.pdf`);
    }).catch(error => {
        document.body.removeChild(loading);
        alert('حدث خطأ في إنشاء PDF: ' + error.message);
    });
};

window.exportReportExcel = function() {
    const reportContent = document.getElementById('reportContent');
    if (!reportContent) {
        alert('لا يوجد تقرير لتصديره');
        return;
    }

    const tables = reportContent.querySelectorAll('table');
    if (tables.length === 0) {
        alert('لا توجد جداول في التقرير لتصديرها');
        return;
    }

    let html = `
        <html>
        <head>
            <meta charset="UTF-8">
            <title>تقرير - ${document.getElementById('reportTitle').textContent}</title>
            <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; direction: rtl; }
                table { border-collapse: collapse; width: 100%; margin: 20px 0; }
                th { background: #4361ee; color: white; padding: 10px; text-align: center; }
                td { border: 1px solid #ddd; padding: 8px; text-align: center; }
                h2 { color: #4361ee; }
                .report-title { margin-bottom: 20px; }
            </style>
        </head>
        <body>
            <h2 class="report-title">${document.getElementById('reportTitle').textContent}</h2>
            ${reportContent.innerHTML}
        </body>
        </html>
    `;

    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `تقرير_${document.getElementById('reportTitle').textContent.replace(/\s/g, '_')}_${new Date().toLocaleDateString('ar-EG')}.xlsx`;
    link.click();
};

// ============================================
// دوال Google Drive المتطورة (للمدير فقط)
// ============================================
function loadDriveSettings() {
    const saved = localStorage.getItem('driveConfig');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            driveConfig = { ...driveConfig, ...parsed };
        } catch (e) {
            console.error('خطأ في تحميل إعدادات Drive:', e);
        }
    }
    
    updateDriveSettingsFields();
}

function updateDriveSettingsFields() {
    const apiKeyInput = document.getElementById('driveApiKey');
    const folderIdInput = document.getElementById('driveFolderId');
    const fileNameInput = document.getElementById('driveFileName');
    const fileIdInput = document.getElementById('driveFileId');
    const usersFileNameInput = document.getElementById('driveUsersFileName');
    const usersFileIdInput = document.getElementById('driveUsersFileId');
    
    if (apiKeyInput) apiKeyInput.value = driveConfig.apiKey || '';
    if (folderIdInput) folderIdInput.value = driveConfig.folderId || '';
    if (fileNameInput) fileNameInput.value = driveConfig.fileName || 'datatxt.txt';
    if (fileIdInput) fileIdInput.value = driveConfig.fileId || '';
    if (usersFileNameInput) usersFileNameInput.value = driveConfig.usersFileName || 'users.json';
    if (usersFileIdInput) usersFileIdInput.value = driveConfig.usersFileId || '';
}

function saveDriveSettingsToStorage() {
    localStorage.setItem('driveConfig', JSON.stringify(driveConfig));
}

window.openDriveSettings = function() {
    if (!currentUser || currentUser.userType !== 'admin') {
        showNotification('غير مصرح لك بتغيير إعدادات Drive', 'error');
        return;
    }
    
    loadDriveSettings();
    document.getElementById('driveSettingsModal').style.display = 'block';
    document.getElementById('driveMessage').style.display = 'none';
    document.getElementById('driveTestResult').style.display = 'none';
};

window.closeDriveSettings = function() {
    document.getElementById('driveSettingsModal').style.display = 'none';
};

window.saveDriveSettings = function() {
    if (!currentUser || currentUser.userType !== 'admin') {
        showNotification('غير مصرح لك بهذا الإجراء', 'error');
        return;
    }
    
    driveConfig.apiKey = document.getElementById('driveApiKey').value.trim();
    driveConfig.folderId = document.getElementById('driveFolderId').value.trim();
    driveConfig.fileName = document.getElementById('driveFileName').value.trim() || 'datatxt.txt';
    driveConfig.fileId = document.getElementById('driveFileId').value.trim();
    driveConfig.usersFileName = document.getElementById('driveUsersFileName').value.trim() || 'users.json';
    driveConfig.usersFileId = document.getElementById('driveUsersFileId').value.trim();
    
    saveDriveSettingsToStorage();
    showDriveMessage('✅ تم حفظ الإعدادات بنجاح', 'success');
};

function showDriveMessage(msg, type) {
    const msgDiv = document.getElementById('driveMessage');
    if (msgDiv) {
        msgDiv.textContent = msg;
        msgDiv.className = `login-message ${type}`;
        msgDiv.style.display = 'block';
    }
}

window.testDriveConnection = async function() {
    if (!currentUser || currentUser.userType !== 'admin') {
        showNotification('غير مصرح لك بهذا الإجراء', 'error');
        return;
    }
    
    const apiKey = document.getElementById('driveApiKey').value.trim();
    const folderId = document.getElementById('driveFolderId').value.trim();

    if (!apiKey || !folderId) {
        showDriveMessage('❌ الرجاء إدخال مفتاح API ومعرف المجلد', 'error');
        return;
    }

    showDriveMessage('🔄 جاري الاتصال...', 'info');

    try {
        const query = `'${folderId}' in parents`;
        const encodedQuery = encodeURIComponent(query);
        const url = `https://www.googleapis.com/drive/v3/files?q=${encodedQuery}&key=${apiKey}&fields=files(id,name,mimeType,size,createdTime)`;
        
        const response = await fetch(url);
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || `HTTP ${response.status}`);
        }
        
        const data = await response.json();
        const files = data.files || [];
        
        window.driveFilesList = files;
        
        let message = `✅ اتصال ناجح!\n📁 إجمالي الملفات في المجلد: ${files.length}\n\n`;
        
        let filesHtml = '<div style="margin-top: 10px; max-height: 300px; overflow-y: auto;">';
        
        if (files.length > 0) {
            message += `قائمة الملفات:\n${'-'.repeat(40)}\n`;
            
            files.forEach((f, i) => {
                const size = f.size ? `${(parseInt(f.size) / 1024).toFixed(1)} KB` : 'حجم غير معروف';
                const created = f.createdTime ? new Date(f.createdTime).toLocaleDateString('ar-EG') : '';
                
                filesHtml += `
                    <div style="padding: 10px; margin: 5px 0; background: #2d3748; border-radius: 5px; border-right: 3px solid #4cc9f0;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <strong style="color: #ffd700;">${f.name}</strong>
                                <div style="font-size: 0.85em; color: #a0aec0;">
                                    معرف: ${f.id}<br>
                                    حجم: ${size} | تاريخ: ${created}
                                </div>
                            </div>
                            <div style="display: flex; gap: 5px;">
                                <button onclick="selectDataFile('${f.id}', '${f.name}')" class="btn-small" style="background: #4361ee; color: white; border: none; border-radius: 3px; padding: 5px 10px; cursor: pointer;">
                                    <i class="fas fa-file"></i> كملف بيانات
                                </button>
                                <button onclick="selectUsersFile('${f.id}', '${f.name}')" class="btn-small" style="background: #0F9D58; color: white; border: none; border-radius: 3px; padding: 5px 10px; cursor: pointer;">
                                    <i class="fas fa-users"></i> كملف مستخدمين
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            });
        } else {
            filesHtml += '<p style="color: #a0aec0;">لا توجد ملفات في هذا المجلد</p>';
        }
        
        filesHtml += '</div>';
        
        const resultBox = document.getElementById('driveTestResult');
        if (resultBox) {
            resultBox.innerHTML = message.replace(/\n/g, '<br>') + filesHtml;
            resultBox.style.display = 'block';
        }
        
        showDriveMessage('✅ تم الاختبار بنجاح - انقر على الملف لاختياره', 'success');
        
    } catch (error) {
        showDriveMessage(`❌ فشل الاتصال: ${error.message}`, 'error');
        const resultBox = document.getElementById('driveTestResult');
        if (resultBox) {
            resultBox.innerHTML = `❌ فشل الاتصال: ${error.message}`;
            resultBox.style.display = 'block';
        }
    }
};

window.selectDataFile = function(fileId, fileName) {
    if (!currentUser || currentUser.userType !== 'admin') {
        showNotification('غير مصرح لك بهذا الإجراء', 'error');
        return;
    }
    
    document.getElementById('driveFileId').value = fileId;
    document.getElementById('driveFileName').value = fileName;
    driveConfig.fileId = fileId;
    driveConfig.fileName = fileName;
    showDriveMessage(`✅ تم اختيار "${fileName}" كملف بيانات`, 'success');
    
    const resultBox = document.getElementById('driveTestResult');
    if (resultBox) {
        resultBox.innerHTML = `✅ تم اختيار ملف البيانات: <strong>${fileName}</strong><br>المعرف: ${fileId}`;
    }
};

window.selectUsersFile = function(fileId, fileName) {
    if (!currentUser || currentUser.userType !== 'admin') {
        showNotification('غير مصرح لك بهذا الإجراء', 'error');
        return;
    }
    
    document.getElementById('driveUsersFileId').value = fileId;
    document.getElementById('driveUsersFileName').value = fileName;
    driveConfig.usersFileId = fileId;
    driveConfig.usersFileName = fileName;
    showDriveMessage(`✅ تم اختيار "${fileName}" كملف مستخدمين`, 'success');
    
    const resultBox = document.getElementById('driveTestResult');
    if (resultBox) {
        resultBox.innerHTML = `✅ تم اختيار ملف المستخدمين: <strong>${fileName}</strong><br>المعرف: ${fileId}`;
    }
};

window.findDataFileId = async function() {
    if (!currentUser || currentUser.userType !== 'admin') {
        showNotification('غير مصرح لك بهذا الإجراء', 'error');
        return;
    }
    
    const apiKey = document.getElementById('driveApiKey').value.trim();
    const folderId = document.getElementById('driveFolderId').value.trim();
    const fileName = document.getElementById('driveFileName').value.trim() || 'datatxt.txt';

    if (!apiKey || !folderId) {
        showDriveMessage('❌ الرجاء إدخال مفتاح API ومعرف المجلد أولاً', 'error');
        return;
    }

    showDriveMessage('🔄 جاري البحث عن ملف البيانات...', 'info');

    try {
        const query = `'${folderId}' in parents and name='${fileName}' and trashed=false`;
        const encodedQuery = encodeURIComponent(query);
        const url = `https://www.googleapis.com/drive/v3/files?q=${encodedQuery}&key=${apiKey}&fields=files(id,name)`;
        
        const response = await fetch(url);
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || `HTTP ${response.status}`);
        }
        
        const data = await response.json();
        const files = data.files || [];
        
        if (files.length > 0) {
            const fileId = files[0].id;
            document.getElementById('driveFileId').value = fileId;
            driveConfig.fileId = fileId;
            saveDriveSettingsToStorage();
            showDriveMessage(`✅ تم العثور على ملف البيانات: ${fileName}\nالمعرف: ${fileId}`, 'success');
            
            const resultBox = document.getElementById('driveTestResult');
            if (resultBox) {
                resultBox.innerHTML = `✅ تم العثور على ملف البيانات:<br>الاسم: ${fileName}<br>المعرف: ${fileId}`;
                resultBox.style.display = 'block';
            }
        } else {
            showDriveMessage(`❌ لم يتم العثور على ملف بيانات باسم "${fileName}" في المجلد`, 'error');
            const resultBox = document.getElementById('driveTestResult');
            if (resultBox) {
                resultBox.innerHTML = `❌ لم يتم العثور على ملف بيانات باسم "${fileName}" في المجلد`;
                resultBox.style.display = 'block';
            }
        }
    } catch (error) {
        console.error('خطأ في البحث:', error);
        showDriveMessage(`❌ خطأ في البحث: ${error.message}`, 'error');
        const resultBox = document.getElementById('driveTestResult');
        if (resultBox) {
            resultBox.innerHTML = `❌ خطأ: ${error.message}`;
            resultBox.style.display = 'block';
        }
    }
};

window.findUsersFileId = async function() {
    if (!currentUser || currentUser.userType !== 'admin') {
        showNotification('غير مصرح لك بهذا الإجراء', 'error');
        return;
    }
    
    const apiKey = document.getElementById('driveApiKey').value.trim();
    const folderId = document.getElementById('driveFolderId').value.trim();
    const fileName = document.getElementById('driveUsersFileName').value.trim() || 'users.json';

    if (!apiKey || !folderId) {
        showDriveMessage('❌ الرجاء إدخال مفتاح API ومعرف المجلد أولاً', 'error');
        return;
    }

    showDriveMessage('🔄 جاري البحث عن ملف المستخدمين...', 'info');

    try {
        const query = `'${folderId}' in parents and name='${fileName}' and trashed=false`;
        const encodedQuery = encodeURIComponent(query);
        const url = `https://www.googleapis.com/drive/v3/files?q=${encodedQuery}&key=${apiKey}&fields=files(id,name)`;
        
        const response = await fetch(url);
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || `HTTP ${response.status}`);
        }
        
        const data = await response.json();
        const files = data.files || [];
        
        if (files.length > 0) {
            const fileId = files[0].id;
            document.getElementById('driveUsersFileId').value = fileId;
            driveConfig.usersFileId = fileId;
            saveDriveSettingsToStorage();
            showDriveMessage(`✅ تم العثور على ملف المستخدمين: ${fileName}\nالمعرف: ${fileId}`, 'success');
            
            const resultBox = document.getElementById('driveTestResult');
            if (resultBox) {
                resultBox.innerHTML = `✅ تم العثور على ملف المستخدمين:<br>الاسم: ${fileName}<br>المعرف: ${fileId}`;
                resultBox.style.display = 'block';
            }
        } else {
            showDriveMessage(`❌ لم يتم العثور على ملف مستخدمين باسم "${fileName}" في المجلد`, 'error');
            const resultBox = document.getElementById('driveTestResult');
            if (resultBox) {
                resultBox.innerHTML = `❌ لم يتم العثور على ملف مستخدمين باسم "${fileName}" في المجلد`;
                resultBox.style.display = 'block';
            }
        }
    } catch (error) {
        console.error('خطأ في البحث:', error);
        showDriveMessage(`❌ خطأ في البحث: ${error.message}`, 'error');
        const resultBox = document.getElementById('driveTestResult');
        if (resultBox) {
            resultBox.innerHTML = `❌ خطأ: ${error.message}`;
            resultBox.style.display = 'block';
        }
    }
};

function startPeriodicUserUpdate() {
    setInterval(async () => {
        if (currentUser && currentUser.userType === 'admin') {
            console.log('🔄 تحديث دوري للمستخدمين من Drive...');
            await loadUsersFromDrive(true);
        }
    }, 5 * 60 * 1000);
}

// ============================================
// التهيئة الرئيسية مع الإعداد التلقائي
// ============================================
document.addEventListener('DOMContentLoaded', async function() {
    console.log('بدء تشغيل النظام...');
    
    // تحميل الإعدادات المحفوظة أولاً
    loadDriveSettings();
    
    // البحث التلقائي عن ملفات Drive وتحديث الإعدادات
    await autoConfigureDrive();
    
    // تحميل المستخدمين
    await loadUsers();
    
    // تهيئة قاعدة البيانات
    await initDatabase();
    
    // التحقق من الجلسة
    checkSession();
    
    // إعداد المستمعات
    setupEventListeners();
    setupModalListeners();
    
    // تحميل البيانات المحفوظة
    await loadSavedData();
    
    // تحديث مصدر البيانات
    updateDataSource();
});

function setupEventListeners() {
    const fileInput = document.getElementById('fileInput');
    if (fileInput) fileInput.addEventListener('change', handleFileUpload);

    const sortSelect = document.getElementById('sortSelect');
    if (sortSelect) {
        sortSelect.addEventListener('change', () => {
            currentSortField = sortSelect.value;
            renderData();
        });
    }

    const itemsPerPageSelect = document.getElementById('itemsPerPage');
    if (itemsPerPageSelect) itemsPerPageSelect.addEventListener('change', changeItemsPerPage);

    const searchInputs = document.querySelectorAll('#searchFinalNumber, #searchDraftNumber, #searchCustomer, #searchVessel, #searchBlNumber, #searchContainer, #searchStatus, #searchDateFrom, #searchDateTo, #searchInvoiceType');
    searchInputs.forEach(input => {
        if (input) input.addEventListener('input', debounce(applyAdvancedSearch, 500));
    });
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function setupModalListeners() {
    window.addEventListener('click', function(event) {
        const modal = document.getElementById('invoiceModal');
        if (event.target === modal) closeModal();
    });
}