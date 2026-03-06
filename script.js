// ============================================
// نظام الفواتير المتقدم - نسخة QR Code المحسنة للأندرويد
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

// متغير لتتبع حالة تحميل البيانات
let dataLoadingPromise = null;

// ============================================
// دوال شريط التقدم المحسنة
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
    const dataFound = await findDataFileIdAuto();
    const usersFound = await findUsersFileIdAuto();
    if (dataFound || usersFound) saveDriveSettingsToStorage();
}

// ============================================
// دوال تحميل البيانات الأساسية (متاحة للجميع)
// ============================================

/**
 * تحميل بيانات الفواتير من Drive - دالة مبسطة وسريعة
 */
async function loadInvoicesFromDrive(showProgress_b = true) {
    if (showProgress_b) showProgress('جاري تحميل البيانات من Drive...', 20);
    
    try {
        const apiKey = driveConfig.apiKey || 'AIzaSyBy4WRI3zkUwlCvbrXpB8o9ZbFMuH4AdGA';
        const folderId = driveConfig.folderId || '1FlBXLupfXCICs6xt7xxEE02wr_cjAapC';
        const fileName = driveConfig.fileName || 'datatxt.txt';
        let fileId = driveConfig.fileId;
        
        // البحث عن الملف إذا لزم الأمر
        if (!fileId) {
            if (showProgress_b) showProgress('جاري البحث عن ملف البيانات...', 30);
            try {
                const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(`'${folderId}' in parents and name='${fileName}' and trashed=false`)}&key=${apiKey}&fields=files(id,name)`;
                const searchRes = await fetch(searchUrl);
                if (!searchRes.ok) throw new Error('فشل البحث عن الملف');
                const searchData = await searchRes.json();
                if (!searchData.files?.length) throw new Error('لم يتم العثور على ملف البيانات');
                fileId = searchData.files[0].id;
                driveConfig.fileId = fileId;
                localStorage.setItem('driveConfig', JSON.stringify(driveConfig));
            } catch (error) {
                console.error('خطأ في البحث عن ملف:', error);
                throw new Error('لم نتمكن من العثور على ملف البيانات');
            }
        }
        
        if (showProgress_b) showProgress('جاري تحميل المحتوى...', 50);
        const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${apiKey}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('فشل تحميل الملف');
        const content = await res.text();
        
        if (showProgress_b) showProgress('جاري تحليل البيانات...', 70);
        
        // تحليل XML بسرعة
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
        
        invoicesData = newInvoices;
        
        // حفظ نسخة محلية
        try {
            localStorage.setItem('invoiceData', JSON.stringify(invoicesData));
            localStorage.setItem('lastUpdate', new Date().toISOString());
        } catch (e) {}
        
        if (showProgress_b) {
            showProgress('تم التحميل بنجاح', 100);
            setTimeout(hideProgress, 1000);
        }
        
        return true;
        
    } catch (error) {
        console.error('خطأ في تحميل الفواتير:', error);
        if (showProgress_b) {
            hideProgress();
        }
        return false;
    }
}

/**
 * التأكد من وجود البيانات (مع localStorage)
 */
async function ensureDataLoaded() {
    if (invoicesData.length > 0) return true;
    
    // حاول من localStorage
    try {
        const saved = localStorage.getItem('invoiceData');
        if (saved) {
            invoicesData = JSON.parse(saved);
            return true;
        }
    } catch (e) {}
    
    // حمل من Drive
    return await loadInvoicesFromDrive(true);
}

// ============================================
// دوال QR Code والرابط المباشر (المحرك الرئيسي)
// ============================================

/**
 * إنشاء رابط الفاتورة
 */
function getInvoiceLink(invoiceNumber) {
    return `${COMPANY_INFO.baseUrl}?invoice=${encodeURIComponent(invoiceNumber)}`;
}

/**
 * إنشاء QR Code
 */
function generateQRCode(invoiceNumber, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = '';
    const canvas = document.createElement('canvas');
    canvas.id = `qrcode-${invoiceNumber}`;
    canvas.style.width = '100%';
    canvas.style.height = 'auto';
    canvas.style.maxWidth = '120px';
    container.appendChild(canvas);
    
    try {
        QRCode.toCanvas(canvas, getInvoiceLink(invoiceNumber), {
            width: 120,
            margin: 1,
            color: { dark: '#000000', light: '#ffffff' },
            errorCorrectionLevel: 'H'
        }, function(error) {
            if (!error) {
                const caption = document.createElement('div');
                caption.style.fontSize = '0.7em';
                caption.style.marginTop = '3px';
                caption.style.color = '#666';
                caption.textContent = 'امسح للوصول للفاتورة';
                container.appendChild(caption);
            }
        });
    } catch (error) {
        console.error('خطأ في QR Code:', error);
    }
}

// ============================================
// دوال إنشاء PDF (مبسطة ومحسنة)
// ============================================

/**
 * إنشاء PDF محسن
 */
async function generateOptimizedPDF(element, fileName) {
    if (!window.jspdf || !window.html2canvas) {
        throw new Error('مكتبات PDF غير متوفرة');
    }
    
    const canvas = await html2canvas(element, {
        scale: 1.5,
        backgroundColor: '#ffffff',
        logging: false,
        allowTaint: true,
        useCORS: true
    });
    
    const imgData = canvas.toDataURL('image/jpeg', 0.7);
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
}

/**
 * إنشاء HTML الفاتورة (نسخة PDF)
 */
function createPDFInvoiceHTML(inv) {
    const finalNum = inv['final-number'] || '';
    const isPostponed = finalNum.startsWith('P') || finalNum.startsWith('p');
    const currency = inv['currency'] || 'EGP';
    const exRate = inv['flex-string-06'] || 48.0215;
    const voyageDate = inv['flex-date-02'] ? new Date(inv['flex-date-02']).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' }) : 'غير محدد';
    
    const invoiceTypeText = isPostponed ? 'آجل' : 'نقدي';
    const martyr = (!isPostponed || currency !== 'USAD') ? 5 : 0;
    const baseTotal = inv['total-total'] || 0;
    
    let displayCurrency, totalChargesDisplay, totalTaxesDisplay, displayTotal;
    if (isPostponed && currency === 'USAD') {
        displayCurrency = 'USAD';
        totalChargesDisplay = ((inv['total-charges'] || 0) / exRate).toFixed(2);
        totalTaxesDisplay = ((inv['total-taxes'] || 0) / exRate).toFixed(2);
        displayTotal = ((baseTotal + martyr) / exRate).toFixed(2);
    } else {
        displayCurrency = 'EGP';
        totalChargesDisplay = (inv['total-charges'] || 0).toFixed(2);
        totalTaxesDisplay = (inv['total-taxes'] || 0).toFixed(2);
        displayTotal = (baseTotal + martyr).toFixed(2);
    }

    return `
        <div class="invoice-container" style="max-width: 1100px; margin: 0 auto; background: white; padding: 20px; font-family: 'Segoe UI', sans-serif; direction: rtl;">
            <style>
                @media print { @page { size: A4; margin: 0.5cm; } body { -webkit-print-color-adjust: exact; } }
                .invoice-header { background: linear-gradient(135deg, #1e3c72, #2a5298); color: white; padding: 15px; border-radius: 10px; margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center; }
                .invoice-title { background: #4361ee; color: white; padding: 10px; text-align: center; border-radius: 8px; margin-bottom: 15px; }
                .info-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 10px; margin-bottom: 15px; }
                .info-box { background: #f8f9fa; padding: 10px; border-radius: 8px; border-right: 4px solid #4361ee; }
                .info-row { display: flex; justify-content: space-between; padding: 3px 0; border-bottom: 1px dashed #dee2e6; font-size:0.85em; }
                .charges-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
                .charges-table th { background: #4361ee; color: white; padding: 8px; }
                .charges-table td { padding: 6px; border-bottom: 1px solid #dee2e6; text-align: center; }
                .summary { width: 280px; background: #f8f9fa; padding: 10px; border-radius: 8px; margin-right: auto; }
                .signature { display: flex; justify-content: space-around; margin: 15px 0; padding: 10px 0; border-top: 2px dashed #dee2e6; }
                .footer { text-align: center; padding: 8px; border-top: 2px solid #e9ecef; color: #6c757d; font-size:0.8em; }
            </style>
            
            <div class="invoice-header">
                <div style="display: flex; align-items: center; gap: 15px;">
                    <div style="width: 50px; height: 50px; background: rgba(255,255,255,0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.8em; border: 2px solid #ffd700;">
                        <i class="fas fa-ship"></i>
                    </div>
                    <div>
                        <h2 style="color: #ffd700; margin: 0; font-size: 1.2em;">${COMPANY_INFO.name}</h2>
                        <p style="margin: 3px 0; opacity: 0.9; font-size: 0.8em;">${COMPANY_INFO.nameEn}</p>
                    </div>
                </div>
                <div id="qr-pdf-container" style="background: white; padding: 5px; border-radius: 8px; width: 100px; height: 100px; text-align: center;">
                    <!-- سيتم إضافة QR Code هنا -->
                </div>
            </div>
            
            <div class="invoice-title">
                <h2 style="font-size: 1.1em; margin:0;">فاتورة رسمية - ${invoiceTypeText}</h2>
                <p style="margin:3px 0 0; font-size:0.8em;">رقم: ${inv['final-number'] || 'غير محدد'} | تاريخ: ${inv['created'] ? new Date(inv['created']).toLocaleDateString('ar-EG') : '-'}</p>
            </div>
            
            <div class="info-grid">
                <div class="info-box">
                    <h4 style="color:#4361ee; margin:0 0 8px; font-size:0.95em;">بيانات العميل</h4>
                    <div class="info-row"><span>الاسم:</span><span>${inv['payee-customer-id'] || '-'}</span></div>
                    <div class="info-row"><span>الدور:</span><span>${inv['payee-customer-role'] || '-'}</span></div>
                    <div class="info-row"><span>رقم العقد:</span><span>${inv['contract-customer-id'] || '-'}</span></div>
                </div>
                <div class="info-box">
                    <h4 style="color:#4361ee; margin:0 0 8px; font-size:0.95em;">بيانات الشحنة</h4>
                    <div class="info-row"><span>السفينة:</span><span>${inv['key-word1'] || '-'}</span></div>
                    <div class="info-row"><span>البوليصة:</span><span>${inv['key-word2'] || '-'}</span></div>
                    <div class="info-row"><span>الخط الملاحي:</span><span>${inv['key-word3'] || '-'}</span></div>
                    <div class="info-row"><span>تاريخ الرحلة:</span><span><strong>${voyageDate}</strong></span></div>
                </div>
                <div class="info-box">
                    <h4 style="color:#4361ee; margin:0 0 8px; font-size:0.95em;">معلومات إضافية</h4>
                    <div class="info-row"><span>الحالة:</span><span>${inv['status'] || '-'}</span></div>
                    <div class="info-row"><span>العملة:</span><span>${inv['currency'] || '-'}</span></div>
                    <div class="info-row"><span>سعر الصرف:</span><span><strong>${exRate.toFixed(4)}</strong></span></div>
                </div>
            </div>
            
            <table class="charges-table">
                <thead><tr><th>الوصف</th><th>النوع</th><th>العدد</th><th>أيام التخزين</th><th>سعر الوحدة</th><th>المبلغ</th></tr></thead>
                <tbody>
                    ${inv.charges.map(c => `<tr><td>${c.description || '-'}</td><td>${c['event-type-id'] || '-'}</td><td>${c.quantity || 1}</td><td>${c['storage-days'] || 1}</td><td>${(c['rate-billed'] || 0).toFixed(2)}</td><td>${((c.amount || 0) / exRate).toFixed(2)}</td></tr>`).join('')}
                </tbody>
            </table>
            
            <div class="summary">
                <div style="display:flex; justify-content:space-between; padding:3px 0;"><span>إجمالي المصاريف:</span><span>${totalChargesDisplay} ${displayCurrency}</span></div>
                <div style="display:flex; justify-content:space-between; padding:3px 0;"><span>إجمالي الضرائب:</span><span>${totalTaxesDisplay} ${displayCurrency}</span></div>
                ${martyr > 0 ? `<div style="display:flex; justify-content:space-between; padding:3px 0;"><span>طابع الشهيد:</span><span>${martyr} جنيه</span></div>` : ''}
                <div style="display:flex; justify-content:space-between; padding:5px 0; font-weight:bold; color:#4361ee;"><span>الإجمالي النهائي:</span><span>${displayTotal} ${displayCurrency}</span></div>
            </div>
            
            <div class="signature">
                <div style="text-align:center;"><div style="color:#4361ee; font-weight:bold;">معد الفاتورة</div><div>${inv['creator'] || 'غير محدد'}</div><div style="font-size:0.7em;">${new Date().toLocaleDateString('ar-EG')}</div></div>
                <div style="text-align:center;"><div style="color:#4361ee; font-weight:bold;">المراجع</div><div>${inv['changer'] || inv['creator'] || 'غير محدد'}</div><div style="font-size:0.7em;">${new Date().toLocaleDateString('ar-EG')}</div></div>
                <div style="text-align:center;"><div style="color:#4361ee; font-weight:bold;">الختم</div><div style="font-size:2em; opacity:0.5;"><i class="fas fa-certificate"></i></div></div>
            </div>
            
            <div class="footer">
                <p>شكراً لتعاملكم مع ${COMPANY_INFO.name}<br>تاريخ الطباعة: ${new Date().toLocaleDateString('ar-EG')}</p>
            </div>
        </div>
    `;
}

// ============================================
// الدالة الرئيسية لمعالجة رابط QR Code (مُعاد كتابتها بالكامل)
// ============================================

/**
 * معالجة رابط الفاتورة - تعمل فوراً وبشكل مستقل
 */
async function handleQRCodeLink() {
    const urlParams = new URLSearchParams(window.location.search);
    const invoiceNumber = urlParams.get('invoice');
    
    if (!invoiceNumber) return false;
    
    console.log('📱 QR Code detected for invoice:', invoiceNumber);
    
    // 1. إخفاء شاشة الدخول فوراً
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('mainApp').style.display = 'block';
    
    // 2. إنشاء عنصر HTML مؤقت لعرض محتوى الفاتورة
    const tempContainer = document.createElement('div');
    tempContainer.style.position = 'fixed';
    tempContainer.style.top = '0';
    tempContainer.style.left = '0';
    tempContainer.style.width = '100%';
    tempContainer.style.height = '100%';
    tempContainer.style.backgroundColor = 'white';
    tempContainer.style.zIndex = '10000';
    tempContainer.style.overflow = 'auto';
    tempContainer.style.padding = '20px';
    tempContainer.style.direction = 'rtl';
    tempContainer.innerHTML = `
        <div style="text-align: center; padding: 30px;">
            <i class="fas fa-spinner fa-spin" style="font-size: 3em; color: #4361ee;"></i>
            <h3 style="color: #4361ee; margin-top: 20px;">جاري تحميل الفاتورة...</h3>
            <p style="color: #666;">رقم الفاتورة: ${invoiceNumber}</p>
            <div id="qr-progress-messages" style="margin-top: 20px; color: #666;"></div>
        </div>
    `;
    document.body.appendChild(tempContainer);
    
    const progressMsg = document.getElementById('qr-progress-messages');
    
    try {
        // 3. تحميل إعدادات Drive
        progressMsg.innerHTML = '🔄 جاري تجهيز الاتصال...';
        loadDriveSettings();
        
        // 4. تحميل البيانات من Drive (بدون شريط تقدم إضافي)
        progressMsg.innerHTML = '📥 جاري تحميل البيانات من Drive...';
        const loaded = await loadInvoicesFromDrive(false);
        
        if (!loaded) {
            throw new Error('فشل تحميل البيانات من Drive');
        }
        
        // 5. البحث عن الفاتورة
        progressMsg.innerHTML = '🔍 جاري البحث عن الفاتورة...';
        const invoice = invoicesData.find(inv => inv['final-number'] === invoiceNumber);
        
        if (!invoice) {
            throw new Error('لم يتم العثور على الفاتورة');
        }
        
        // 6. إنشاء HTML الفاتورة
        progressMsg.innerHTML = '📄 جاري إنشاء الفاتورة...';
        const invoiceHTML = createPDFInvoiceHTML(invoice);
        tempContainer.innerHTML = invoiceHTML;
        
        // 7. إضافة QR Code للفاتورة المعروضة
        const qrContainer = tempContainer.querySelector('#qr-pdf-container');
        if (qrContainer) {
            await new Promise((resolve) => {
                const canvas = document.createElement('canvas');
                QRCode.toCanvas(canvas, getInvoiceLink(invoiceNumber), {
                    width: 90,
                    margin: 1,
                    color: { dark: '#000000', light: '#ffffff' }
                }, function(error) {
                    if (!error) {
                        qrContainer.innerHTML = '';
                        qrContainer.appendChild(canvas);
                    }
                    resolve();
                });
            });
        }
        
        // 8. إضافة أزرار التحكم
        const controlsDiv = document.createElement('div');
        controlsDiv.style.cssText = 'position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); display: flex; gap: 10px; z-index: 10001; direction: rtl;';
        controlsDiv.innerHTML = `
            <button onclick="window.location.href='${COMPANY_INFO.baseUrl}'" style="background: #6c757d; color: white; border: none; padding: 12px 25px; border-radius: 50px; cursor: pointer; font-size: 1em; display: flex; align-items: center; gap: 8px;">
                <i class="fas fa-home"></i> الرئيسية
            </button>
            <button onclick="downloadCurrentInvoicePDF()" style="background: #4361ee; color: white; border: none; padding: 12px 25px; border-radius: 50px; cursor: pointer; font-size: 1em; display: flex; align-items: center; gap: 8px;">
                <i class="fas fa-file-pdf"></i> تحميل PDF
            </button>
            <button onclick="this.parentElement.parentElement.remove()" style="background: #e63946; color: white; border: none; padding: 12px 25px; border-radius: 50px; cursor: pointer; font-size: 1em; display: flex; align-items: center; gap: 8px;">
                <i class="fas fa-times"></i> إغلاق
            </button>
        `;
        tempContainer.appendChild(controlsDiv);
        
        // 9. حفظ الفاتورة الحالية للتحميل
        window.currentInvoiceForPDF = invoice;
        window.currentInvoiceHTML = invoiceHTML;
        
        // 10. إخفاء شريط التقدم الأصلي
        hideProgress();
        
        return true;
        
    } catch (error) {
        console.error('خطأ:', error);
        
        // عرض رسالة الخطأ
        tempContainer.innerHTML = `
            <div style="text-align: center; padding: 50px 20px;">
                <i class="fas fa-exclamation-triangle" style="font-size: 4em; color: #e63946; margin-bottom: 20px;"></i>
                <h2 style="color: #e63946; margin-bottom: 15px;">عذراً، حدث خطأ</h2>
                <p style="color: #666; margin-bottom: 20px;">${error.message}</p>
                <p style="color: #666; margin-bottom: 30px;">رقم الفاتورة: ${invoiceNumber}</p>
                <button onclick="window.location.href='${COMPANY_INFO.baseUrl}'" style="background: #4361ee; color: white; border: none; padding: 12px 30px; border-radius: 50px; cursor: pointer; font-size: 1.1em;">
                    <i class="fas fa-home"></i> العودة للرئيسية
                </button>
            </div>
        `;
        return false;
    }
}

/**
 * دالة تحميل PDF للفاتورة الحالية
 */
window.downloadCurrentInvoicePDF = async function() {
    if (!window.currentInvoiceForPDF || !window.currentInvoiceHTML) {
        alert('لا توجد فاتورة للتحميل');
        return;
    }
    
    const loadingDiv = document.createElement('div');
    loadingDiv.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: #4361ee; color: white; padding: 15px 30px; border-radius: 50px; z-index: 20000;';
    loadingDiv.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري إنشاء PDF...';
    document.body.appendChild(loadingDiv);
    
    try {
        const tempContainer = document.createElement('div');
        tempContainer.style.position = 'absolute';
        tempContainer.style.left = '-9999px';
        tempContainer.style.top = '-9999px';
        tempContainer.innerHTML = window.currentInvoiceHTML;
        document.body.appendChild(tempContainer);
        
        const element = tempContainer.firstChild;
        const fileName = `فاتورة-${window.currentInvoiceForPDF['final-number']}.pdf`;
        
        await generateOptimizedPDF(element, fileName);
        
        document.body.removeChild(tempContainer);
        loadingDiv.remove();
        
    } catch (error) {
        console.error('خطأ في تحميل PDF:', error);
        loadingDiv.innerHTML = '❌ فشل التحميل';
        setTimeout(() => loadingDiv.remove(), 2000);
    }
};

// ============================================
// باقي دوال النظام الأساسية (مختصرة)
// ============================================

// دوال المستخدمين الأساسية
async function loadUsersFromDrive() {
    if (!driveConfig.apiKey || !driveConfig.folderId || !driveConfig.usersFileId) return false;
    try {
        const res = await fetch(`https://www.googleapis.com/drive/v3/files/${driveConfig.usersFileId}?alt=media&key=${driveConfig.apiKey}`);
        if (!res.ok) return false;
        let content = await res.text();
        try { JSON.parse(content); } catch { content = repairJSON(content); }
        users = JSON.parse(content);
        localStorage.setItem('backupUsers', JSON.stringify(users));
        return true;
    } catch { return false; }
}

function loadDefaultUsers() {
    users = [
        { id: 'user_admin', username: 'admin', email: 'admin@dchc-egdam.com', taxNumber: 'ADMIN001', userType: 'admin', password: 'admin123', status: 'active' },
        { id: 'user_accountant', username: 'accountant', email: 'accountant@dchc-egdam.com', taxNumber: 'ACC001', userType: 'accountant', password: 'acc123', status: 'active' }
    ];
}

// دوال تسجيل الدخول المبسطة
function checkSession() {
    const saved = sessionStorage.getItem('currentUser');
    if (saved) try {
        currentUser = JSON.parse(saved);
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('mainApp').style.display = 'block';
        updateUserInterface();
    } catch { sessionStorage.removeItem('currentUser'); }
}

window.handleLogin = async function() {
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    if (!username || !password) return alert('الرجاء إدخال البيانات');
    
    await loadUsersFromDrive();
    const user = users.find(u => (u.username === username || u.email === username) && u.status === 'active' && u.password === password);
    if (!user) return alert('بيانات غير صحيحة');
    
    currentUser = user;
    sessionStorage.setItem('currentUser', JSON.stringify(currentUser));
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('mainApp').style.display = 'block';
    updateUserInterface();
    loadInvoicesFromDrive(true).then(() => filterInvoicesByUser());
};

window.handleGuestLogin = function() {
    const taxNumber = document.getElementById('guestTaxNumber').value.trim();
    const blNumber = document.getElementById('guestBlNumber').value.trim();
    currentUser = { id: 'guest_' + Date.now(), username: 'زائر', isGuest: true, taxNumber, blNumber };
    sessionStorage.setItem('currentUser', JSON.stringify(currentUser));
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('mainApp').style.display = 'block';
    updateUserInterface();
    loadInvoicesFromDrive(true).then(() => filterInvoicesByGuest(taxNumber, blNumber));
};

function updateUserInterface() {
    if (!currentUser) return;
    const isAdmin = currentUser.userType === 'admin';
    document.getElementById('driveSettingsBtn').style.display = isAdmin ? 'flex' : 'none';
    document.getElementById('adminPanelBtn').style.display = isAdmin ? 'flex' : 'none';
    document.querySelector('label[for="fileInput"]').style.display = isAdmin ? 'inline-flex' : 'none';
    document.querySelector('.btn-drive').style.display = isAdmin ? 'inline-flex' : 'none';
}

// دوال عرض البيانات (مختصرة)
function filterInvoicesByUser() {
    if (!invoicesData.length) { filteredInvoices = []; renderData(); return; }
    filteredInvoices = invoicesData.filter(inv => {
        const num = inv['final-number'] || '';
        return currentInvoiceType === INVOICE_TYPES.CASH ? (num.startsWith('C') || num.startsWith('c')) : (num.startsWith('P') || num.startsWith('p'));
    });
    renderData();
}

function filterInvoicesByGuest(taxNumber, blNumber) {
    if (!invoicesData.length) { filteredInvoices = []; renderData(); return; }
    filteredInvoices = invoicesData.filter(inv => {
        let match = true;
        if (taxNumber) {
            const payeeMatch = (inv['payee-customer-id'] || '').toLowerCase().includes(taxNumber.toLowerCase());
            const contractMatch = (inv['contract-customer-id'] || '').toLowerCase().includes(taxNumber.toLowerCase());
            match = match && (payeeMatch || contractMatch);
        }
        if (blNumber) match = match && (inv['key-word2'] || '').toLowerCase().includes(blNumber.toLowerCase());
        return match;
    });
    renderData();
}

function renderData() {
    document.getElementById('dataViewContainer').innerHTML = '<div class="no-data"><i class="fas fa-inbox fa-3x"></i><p>تم تحميل ' + filteredInvoices.length + ' فاتورة</p></div>';
    updateSummary();
}

function updateSummary() {
    document.getElementById('invoiceCount').textContent = filteredInvoices.length;
    document.getElementById('totalInvoicesHeader').textContent = filteredInvoices.length;
}

// دوال إعدادات Drive
function loadDriveSettings() {
    const saved = localStorage.getItem('driveConfig');
    if (saved) try { driveConfig = { ...driveConfig, ...JSON.parse(saved) }; } catch { }
}

function saveDriveSettingsToStorage() { 
    localStorage.setItem('driveConfig', JSON.stringify(driveConfig)); 
}

// دالة parseInvoiceNode (مختصرة)
function parseInvoiceNode(invoice) {
    try {
        return {
            'final-number': invoice.getAttribute('final-number') || '',
            'draft-number': invoice.getAttribute('draft-number') || '',
            'currency': invoice.getAttribute('currency') || 'EGP',
            'payee-customer-id': invoice.getAttribute('payee-customer-id') || '',
            'payee-customer-role': invoice.getAttribute('payee-customer-role') || '',
            'contract-customer-id': invoice.getAttribute('contract-customer-id') || '',
            'key-word1': invoice.getAttribute('key-word1') || '',
            'key-word2': invoice.getAttribute('key-word2') || '',
            'key-word3': invoice.getAttribute('key-word3') || '',
            'total-charges': parseFloat(invoice.getAttribute('total-charges') || 0),
            'total-taxes': parseFloat(invoice.getAttribute('total-taxes') || 0),
            'total-total': parseFloat(invoice.getAttribute('total-total') || 0),
            'flex-string-06': parseFloat(invoice.getAttribute('flex-string-06') || 48.0215),
            'flex-date-02': invoice.getAttribute('flex-date-02') || '',
            'created': invoice.getAttribute('created') || '',
            'creator': invoice.getAttribute('creator') || '',
            'changer': invoice.getAttribute('changer') || '',
            'status': invoice.getAttribute('status') || '',
            'charges': Array.from(invoice.getElementsByTagName('charge')).map(c => ({
                'description': c.getAttribute('description') || '',
                'event-type-id': c.getAttribute('event-type-id') || '',
                'entity-id': c.getAttribute('entity-id') || '',
                'rate-billed': parseFloat(c.getAttribute('rate-billed') || 0),
                'amount': parseFloat(c.getAttribute('amount') || 0),
                'storage-days': (() => {
                    const from = c.getAttribute('event-performed-from');
                    const to = c.getAttribute('event-performed-to');
                    if (from && to) {
                        const d1 = new Date(from), d2 = new Date(to);
                        if (!isNaN(d1) && !isNaN(d2)) return Math.ceil(Math.abs(d2 - d1) / (1000*60*60*24)) + 1;
                    }
                    return 1;
                })(),
                'quantity': 1
            }))
        };
    } catch { return null; }
}

// دوال إضافية ضرورية
window.switchLoginTab = function(tab) {
    document.querySelectorAll('.tab-btn, .login-form').forEach(el => el.classList.remove('active'));
    if (tab === 'login') { 
        document.querySelectorAll('.tab-btn')[0].classList.add('active'); 
        document.getElementById('loginForm').classList.add('active'); 
    } else { 
        document.querySelectorAll('.tab-btn')[1].classList.add('active'); 
        document.getElementById('guestForm').classList.add('active'); 
    }
};

window.logout = function() { 
    currentUser = null; 
    sessionStorage.removeItem('currentUser'); 
    location.reload(); 
};

// ============================================
// التهيئة الرئيسية - نقطة البداية
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('بدء تشغيل النظام...');
    
    // 1. تحميل إعدادات Drive
    loadDriveSettings();
    
    // 2. التحقق من وجود رابط QR Code أولاً
    const hasQRCode = await handleQRCodeLink();
    
    // 3. إذا لم يكن هناك QR Code، نكمل التهيئة العادية
    if (!hasQRCode) {
        // إعداد Drive في الخلفية
        autoConfigureDrive();
        
        // تحميل المستخدمين
        if (!await loadUsersFromDrive()) {
            loadDefaultUsers();
        }
        
        // التحقق من الجلسة
        checkSession();
        
        // تحميل البيانات في الخلفية
        setTimeout(() => {
            if (invoicesData.length === 0) {
                loadInvoicesFromDrive(true);
            }
        }, 1000);
    }
    
    // ربط أحداث الفورم
    document.getElementById('fileInput')?.addEventListener('change', handleFileUpload);
});