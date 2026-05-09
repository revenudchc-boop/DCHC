// ============================================
// نظام الفواتير المتقدم - النسخة النهائية مع تحسين الترتيب وإضافة فواصل الألف
// جميع الحقوق محفوظة لشركة دمياط لتداول الحاويات و البضائع
// ============================================
window.onerror = function(msg, url, line, col, error) {
    console.error('❌ خطأ في السطر ' + line + ':', msg);
    return false;
};

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
    POSTPONED: 'postponed',
	CREDIT: 'credit'
};
let currentInvoiceType = INVOICE_TYPES.CASH;

// المتغيرات العامة
let invoicesData = [];
let filteredInvoices = [];
let sortOrder = 'desc';
let currentSortField = 'final-number';
let currentPage = 1;
let itemsPerPage = 25;
let viewMode = 'cards';
let selectedInvoiceIndex = -1;
let exchangeRate = 48.0215;
let expandedContainers = new Set();
let db = null;
let autoSaveEnabled = true;
// أضف هذه الأسطر مع باقي المتغيرات العامة
let currentDisplayType = 'invoice'; // 'invoice' أو 'credit'
let currentCreditData = null; // تخزين بيانات إشعار الخصم الحالي
// أضف هذا السطر مع المتغيرات العامة (قبل تعريف creditData)
let currentCreditSerial = null;
// بيانات إشعارات الخصم
let creditData = [];
let filteredCreditData = [];
let currentCreditPage = 1;
let itemsPerPageCredit = 25;
let currentCreditSortField = 'date';
let currentCreditSortOrder = 'desc';
let viewModeCredit = 'cards';
let selectedCreditNotes = new Set();
// متغير لتخزين الفواتير التي تمت معاينتها
let viewedInvoices = new Set();
const NEWS_VISIBLE_KEY = 'newsBarVisible';
let isQuickPayment = false;
let isSearching = false;  // منع تغيير وضع العرض أثناء البحث

// ============================================
// إعدادات التحديث التلقائي (Auto Refresh)
// ============================================
let autoRefreshEnabled = false;      // هل التحديث التلقائي مفعل؟
let autoRefreshInterval = 5;         // الفاصل الزمني بالدقائق (الافتراضي 5 دقائق)
let autoRefreshTimer = null;         // معرف المؤقت

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
    usersFileId: '1-ktLLXz1Febs44lB-aqfuNmTRs1GNB0w',
    logoFileId: '1DugYxs9a21e6J0ynTu6pE0yHXM2wRXSP',
    creditFileName: 'creditdata.txt',                // ← تم التغيير
    creditFileId: '1WU9R9Yby0_QoJeulIgYRuCQk9XV-N_e1' // ← تم الإضافة
};

// متغيرات التقارير
let currentReportType = 'daily';

// متغير لتخزين قائمة الملفات من Drive
window.driveFilesList = [];

// متغير لتخزين الفواتير المحددة
let selectedInvoices = new Set();

// ============================================
// إعدادات Web App للمزامنة
// ============================================
const SYNC_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbwhI-WpSqD2jmS0-dENEDACYFYV9JiS5r0snG0haJqtBJTSROXrtBHmHOY5-_5c_Pf9/exec';
// إعدادات التخزين السحابي لحالة المعاينة (Google Apps Script)
const VIEWED_CLOUD_URL = 'https://script.google.com/macros/s/AKfycbwXfSeRg3JAxsgCTDedaspLe9SVEAn5gpInrs-TLGkbgq9599UOhXRQX2DR3cjW7X0R1A/exec';
// إعدادات نظام السدادات (Google Apps Script)
const PAYMENTS_API_URL = 'https://script.google.com/macros/s/AKfycbzy9GqPotfkBmVcbBqQsqcyUEGSoTkGGxZDiEi8qjvX4yoxW6BgAGC83KI3xYDJMSDn/exec';
// متغيرات نظام السدادات
let paymentsData = [];
let filteredPayments = [];
let currentPaymentPage = 1;
let itemsPerPagePayments = 25;

async function loadViewedFromDrive() {
    console.log('🔍 بدء تحميل حالة المعاينة من Google Apps Script...');
    
    if (!currentUser) {
        console.error('❌ currentUser غير موجود!');
        return false;
    }
    
    // إعادة المحاولة حتى 3 مرات مع تأخير بين المحاولات
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            const response = await fetch(VIEWED_CLOUD_URL);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const data = await response.json();
            const userKey = currentUser.username;
            const invoiceViewed = data[userKey] || [];
			const creditViewed = data[userKey + '_credits'] || [];
			const userViewed = [...invoiceViewed, ...creditViewed];
            viewedInvoices = new Set(userViewed);
            saveViewedInvoices(); // نسخة احتياطية محلية
            
            console.log(`✅ تم تحميل ${viewedInvoices.size} فاتورة للمستخدم ${userKey}`);
            return true;
        } catch (error) {
            console.warn(`⚠️ المحاولة ${attempt} فشلت:`, error.message);
            if (attempt < 3) {
                // انتظر ثانية ثم أعد المحاولة
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    }
    
    console.error('❌ فشلت جميع محاولات تحميل حالة المعاينة');
    return false;
}

let isSavingToDrive = false;
let saveQueueTimer = null;
let lastSaveTime = 0;

async function saveViewedToDrive() {
    const now = Date.now();
    
    // ✅ إذا مر أقل من 3 ثواني على آخر حفظ، انتظر
    if (now - lastSaveTime < 3000) {
        clearTimeout(saveQueueTimer);
        saveQueueTimer = setTimeout(() => saveViewedToDrive(), 3000);
        return;
    }
    
    // ✅ إذا كان هناك حفظ جاري، انتظر
    if (isSavingToDrive) {
        clearTimeout(saveQueueTimer);
        saveQueueTimer = setTimeout(() => saveViewedToDrive(), 3000);
        return;
    }
    
    isSavingToDrive = true;
    lastSaveTime = now;
    console.log('💾 بدء حفظ حالة المعاينة...');
    
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            let allData = {};
            try {
                const readResponse = await fetch(VIEWED_CLOUD_URL);
                if (readResponse.ok) {
                    const text = await readResponse.text();
                    if (text && text.trim()) {
                        allData = JSON.parse(text);
                    }
                }
            } catch (e) {}

            const userKey = currentUser?.username || 'guest';
            allData[userKey] = [...viewedInvoices].filter(k => !k.startsWith('credit_'));
            allData[userKey + '_credits'] = [...viewedInvoices].filter(k => k.startsWith('credit_'));
            allData.lastUpdated = new Date().toISOString();

            const saveResponse = await fetch(VIEWED_CLOUD_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify(allData)
            });

            if (saveResponse.ok) {
                console.log(`✅ تم حفظ ${viewedInvoices.size} عنصر للمستخدم ${userKey}`);
                isSavingToDrive = false;
                return true;
            }
        } catch (error) {
            console.warn(`⚠️ محاولة ${attempt} فشلت`);
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
    
    isSavingToDrive = false;
    return false;
}

// متغير لتخزين الشعار
let companyLogoBase64 = null;


async function checkUnviewedInvoicesAndShowReport() {
    // انتظار قليلاً للتأكد من تحميل البيانات بالكامل
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // التأكد من وجود بيانات وفواتير
    if (!invoicesData.length || !currentUser) {
        console.log('⚠️ لا توجد بيانات أو مستخدم للمتابعة');
        return;
    }
    
    // الحصول على الفواتير التي تخص المستخدم الحالي
    const userInvoices = invoicesData.filter(inv => checkIfInvoiceBelongsToUser(inv));
    
    if (userInvoices.length === 0) {
        console.log('📭 لا توجد فواتير تخص هذا المستخدم');
        return;
    }
    
    // الفواتير التي لم تتم معاينتها (checkbox فارغ)
    const unviewedInvoices = userInvoices.filter(inv => {
        const viewKey = getInvoiceKey(inv);
        return !viewedInvoices.has(viewKey);
    });
    
    // ✅ التحقق من إشعارات الخصم غير المعاينة
    let unviewedCredits = [];
    if (typeof creditData !== 'undefined' && creditData.length > 0) {
        const userCredits = creditData.filter(c => {
            if (!c.customerId) return false;
            const custId = c.customerId.toLowerCase();
            return userInvoices.some(inv => 
                (inv['payee-customer-id'] || '').toLowerCase().includes(custId)
            );
        });
        unviewedCredits = userCredits.filter(c => {
            const viewKey = 'credit_' + (c.serial || c.draftNumber || c.finalNumber);
            return !viewedInvoices.has(viewKey);
        });
    }

    if (unviewedInvoices.length === 0 && unviewedCredits.length === 0) {
        console.log('✅ جميع الفواتير وإشعارات الخصم تمت معاينتها');
        return;
    }
    
    console.log(`📋 يوجد ${unviewedInvoices.length} فاتورة غير معاينة`);
    
    // تجهيز البيانات للتقرير
    const sortedInvoices = [...unviewedInvoices].sort((a, b) => {
        const numA = getInvoiceSerialNumber(a['final-number']);
        const numB = getInvoiceSerialNumber(b['final-number']);
        return numA - numB;
    });
    
    // حساب الإجماليات
    let totals = {
        usadCharges: 0, usadTaxes: 0, usadTotal: 0,
        egpCharges: 0, egpTaxes: 0, egpTotal: 0,
        grandTotal: 0
    };
    
    sortedInvoices.forEach(inv => {
        const currency = inv['currency'] || 'EGP';
        const exchangeRate = inv['flex-string-06'] || 48.0215;
        const martyr = (inv['final-number'] || '').startsWith('P') ? 0 : 5;
        const total = (inv['total-total'] || 0) + martyr;
        
        if (currency === 'USAD') {
            totals.usadCharges += (inv['total-charges'] || 0) / exchangeRate;
            totals.usadTaxes += (inv['total-taxes'] || 0) / exchangeRate;
            totals.usadTotal += total / exchangeRate;
        } else {
            totals.egpCharges += (inv['total-charges'] || 0);
            totals.egpTaxes += (inv['total-taxes'] || 0);
            totals.egpTotal += total;
        }
        totals.grandTotal += total;
    });
    
    // الحصول على الخطوط الملاحية الفريدة
    const lineOperators = [...new Set(sortedInvoices.map(inv => inv['contract-customer-id']).filter(op => op))];
    const lineOperatorsText = lineOperators.length ? lineOperators.join(', ') : 'الكل';
    
    // التأكد من تحميل الشعار
    if (!companyLogoBase64) {
        await loadLogoFromDrive();
    }
	
	    // ✅ تحميل بيانات إشعارات الخصم
    if (typeof creditData !== 'undefined' && creditData.length === 0) {
        await loadCreditDataFromDriveSilent();
    }
    
    // إنشاء HTML التقرير (مع بطاقات الإجماليات)
    // ✅ إضافة إشعارات الخصم
    let creditItems = [];
    if (typeof creditData !== 'undefined' && creditData.length > 0) {
        const customerIds = [...new Set(sortedInvoices.map(inv =>
            (inv['payee-customer-id'] || '').toLowerCase()
        ).filter(id => id))];
        creditItems = creditData.filter(c => {
            if (!c.customerId) return false;
            const matchCustomer = customerIds.some(cid => c.customerId.toLowerCase().includes(cid));
            if (!matchCustomer) return false;
            
            // ✅ إخفاء إشعارات الخصم التي تم تحديدها
            const viewKey = 'credit_' + (c.serial || c.draftNumber || c.finalNumber);
            const isViewed = viewedInvoices.has(viewKey);
            return !isViewed;
        });
    }
    totals.credits = creditItems;
	
	    // ✅ تحديث الإجماليات بعد خصم إشعارات الخصم
    creditItems.forEach(c => {
        const amount = c.displayAmount || 0;
        const tax = c.displayTax || 0;
        const total = amount + tax;
        
        if (c.currency === 'USAD') {
            totals.usadCharges -= amount;
            totals.usadTaxes -= tax;
            totals.usadTotal -= total;
        } else {
            totals.egpCharges -= amount;
            totals.egpTaxes -= tax;
            totals.egpTotal -= total;
        }
        totals.grandTotal -= total;
    });

    const reportHtmlWithSummary = generateReportHTML(sortedInvoices, {
        fromDate: '', toDate: '',
        lineOperatorsText,
        totals,
        count: sortedInvoices.length
    }, companyLogoBase64);
    
    // إنشاء HTML بدون بطاقات الإجماليات (لـ PDF)
    let reportHtmlWithoutSummary = reportHtmlWithSummary;
    reportHtmlWithoutSummary = reportHtmlWithoutSummary.replace(/<div class="summary-section">[\s\S]*?<\/div>\s*<\/div>\s*<div class="report-footer">/, '<div class="report-footer">');
    
    // عرض نافذة المعاينة
    showReportPreview(reportHtmlWithSummary, reportHtmlWithoutSummary);
    
    // إشعار للمستخدم
    showNotification(`يوجد ${unviewedInvoices.length} فاتورة جديدة لم تتم معاينتها`, 'info');
}

// ============================================
// ✅ أضف الدالة هنا 👇
// ============================================
// دالة موحدة لإنشاء مفتاح الفاتورة
function getInvoiceKey(invoice) {
    // استخدام الرقم النهائي إذا وجد، وإلا استخدام الرقم المبدئي
    const finalNumber = invoice['final-number'] || '';
    const draftNumber = invoice['draft-number'] || '';
    
    // تنسيق المفتاح: الرقم النهائي|الرقم المبدئي
    // مثال: "C25-25656|269044"
    return `${finalNumber}|${draftNumber}`;
}

// دالة مساعدة لإنشاء مفتاح من رقمين (للاستخدام المباشر)
function createInvoiceKey(finalNumber, draftNumber) {
    return `${finalNumber}|${draftNumber}`;
}
// ============================================
// 👆 نهاية إضافة الدالة
// ============================================

// ============================================
// دوال تنسيق الأرقام
// ============================================
function formatNumberWithCommas(number) {
    // ... الكود الموجود
}



// تحميل Refresh Token من ملف نصي على Drive
async function loadRefreshTokenFromDrive() {
    if (!driveConfig.apiKey || !driveConfig.folderId) return false;
    const fileName = 'refreshtoken.txt';
    try {
        // البحث عن الملف في المجلد
        const query = encodeURIComponent(`'${driveConfig.folderId}' in parents and name='${fileName}' and trashed=false`);
        const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&key=${driveConfig.apiKey}&fields=files(id,name)`);
        if (!res.ok) throw new Error('فشل البحث عن ملف التوكن');
        const data = await res.json();
        if (!data.files || data.files.length === 0) {
            console.error('❌ لم يتم العثور على ملف refreshtoken.txt في المجلد');
            return false;
        }
        const fileId = data.files[0].id;
        // تحميل محتوى الملف
        const contentRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${driveConfig.apiKey}`);
        if (!contentRes.ok) throw new Error('فشل تحميل محتوى ملف التوكن');
        const token = await contentRes.text();
        const cleanToken = token.trim();
        if (!cleanToken) {
            throw new Error('ملف التوكن فارغ');
        }
        // تحديث الثابت العام
        DRIVE_CONFIG.refreshToken = cleanToken;
        console.log('✅ تم تحميل Refresh Token من Drive بنجاح');
        return true;
    } catch (error) {
        console.error('❌ خطأ في تحميل Refresh Token:', error);
        return false;
    }
}


// ============================================
// دوال تنسيق الأرقام
// ============================================

/**
 * إضافة فواصل الألف للأرقام
 */
function formatNumberWithCommas(number) {
    if (number === null || number === undefined || isNaN(number)) return '0';
    
    // تحويل الرقم إلى نص وتقسيمه إلى أجزاء
    let parts = number.toString().split('.');
    
    // إضافة فواصل الألف للجزء الصحيح
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    
    // إرجاع الرقم مع الفواصل
    return parts.join('.');
}

/**
 * عرض المبلغ المنسق مع العملة
 */
function formatAmount(amount, currency = 'EGP', showCommas = true) {
    if (amount === null || amount === undefined || isNaN(amount)) amount = 0;
    
    let formattedAmount = amount.toFixed(2);
    if (showCommas) {
        formattedAmount = formatNumberWithCommas(formattedAmount);
    }
    
    return `${formattedAmount} ${currency}`;
}

// ============================================
// دوال تحليل الرقم النهائي للترتيب
// ============================================

function parseFinalNumber(finalNumber) {
    if (!finalNumber) return { type: '', year: 0, number: 0 };
    
    // تحليل النمط: C25-22491 أو P25-12345
    const match = finalNumber.match(/^([CP])(\d+)-(\d+)$/i);
    
    if (match) {
        return {
            type: match[1].toUpperCase(), // C أو P
            year: parseInt(match[2], 10),  // السنة كرقم
            number: parseInt(match[3], 10) // الرقم التسلسلي كرقم
        };
    }
    
    // إذا لم يطابق النمط، نعيد القيم الافتراضية
    return { type: '', year: 0, number: 0 };
}


// استخراج الرقم التسلسلي من رقم الفاتورة النهائي (بغض النظر عن البادئة مثل C25- أو P25- أو C26-...)
function getInvoiceSerialNumber(finalNumber) {
    if (!finalNumber) return 0;
    // البحث عن الرقم بعد آخر شرطة (مثلاً C25-12345 → 12345)
    const parts = finalNumber.split('-');
    if (parts.length > 1) {
        const numStr = parts[parts.length - 1];
        const num = parseInt(numStr, 10);
        return isNaN(num) ? 0 : num;
    }
    return 0;
}


// دالة لتقسيم التقرير الطويل إلى صفحات متعددة مع تكرار الرأس
function splitReportIntoPages(reportHtml, rowsPerPage = 15) {
    // استخراج الـ footer (رسالة الشكر) من HTML الأصلي
    const footerMatch = reportHtml.match(/<div class="report-footer">[\s\S]*?<\/div>/);
    let footerHtml = '';
    let htmlWithoutFooter = reportHtml;
    if (footerMatch) {
        footerHtml = footerMatch[0];
        htmlWithoutFooter = reportHtml.replace(footerMatch[0], '');
    }
    
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlWithoutFooter;
    const table = tempDiv.querySelector('.report-table');
    if (!table) return [{ html: reportHtml, pageTotal: null, pageNumber: 1, isLast: true }];
    
    const tbody = table.querySelector('tbody');
    const allRows = Array.from(tbody.querySelectorAll('tr'));
    
    // دالة لحساب إجمالي مجموعة من الصفوف
    function calculateRowsTotal(rows) {
        let usadCharges = 0, usadTaxes = 0, egpCharges = 0, egpTaxes = 0;
        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length >= 10) {
                usadCharges += parseFloat(cells[6]?.innerText.replace(/,/g, '')) || 0;
                usadTaxes   += parseFloat(cells[7]?.innerText.replace(/,/g, '')) || 0;
                egpCharges  += parseFloat(cells[8]?.innerText.replace(/,/g, '')) || 0;
                egpTaxes    += parseFloat(cells[9]?.innerText.replace(/,/g, '')) || 0;
            }
        });
        return { usadCharges, usadTaxes, egpCharges, egpTaxes };
    }
    
    const theadHtml = table.querySelector('thead').outerHTML;
    const beforeTableHtml = htmlWithoutFooter.split('<tbody>')[0] + '<tbody>';
    const afterTableHtml = '</tbody>' + htmlWithoutFooter.split('</tbody>')[1];
    
    // إذا كان عدد الصفوف أقل من أو يساوي الحد الأقصى (صفحة واحدة)
    if (allRows.length <= rowsPerPage) {
        // حساب الإجماليات للصفحة الواحدة
        const pageTotal = calculateRowsTotal(allRows);
        const pageBody = allRows.map(row => row.outerHTML).join('');
        
        // إضافة صف إجمالي الصفحة
        const totalRow = `<tr class="page-total-row" style="background-color: #e8f4f8; font-weight: bold;">
            <td colspan="6" style="text-align: left;">إجمالي الصفحة</td>
            <td>${pageTotal.usadCharges.toFixed(2)}</td>
            <td>${pageTotal.usadTaxes.toFixed(2)}</td>
            <td>${pageTotal.egpCharges.toFixed(2)}</td>
            <td>${pageTotal.egpTaxes.toFixed(2)}</td>
            <td>-</td>
        </tr>`;
        const pageBodyWithTotal = pageBody + totalRow;
        
        // إضافة صف الإجمالي الكلي (لأنها الصفحة الوحيدة والأخيرة)
        const grandTotalRow = `<tr class="grand-total-row" style="background-color: #d1ecf1; font-weight: bold;">
            <td colspan="6" style="text-align: left;">الإجمالي الكلي</td>
            <td>${pageTotal.usadCharges.toFixed(2)}</td>
            <td>${pageTotal.usadTaxes.toFixed(2)}</td>
            <td>${pageTotal.egpCharges.toFixed(2)}</td>
            <td>${pageTotal.egpTaxes.toFixed(2)}</td>
            <td>-</td>
        </tr>`;
        const finalBody = pageBodyWithTotal + grandTotalRow;
        
        let pageFullHtml = beforeTableHtml + finalBody + afterTableHtml;
        
        // إضافة رقم الصفحة (صفحة 1 من 1)
        const footerNote = `<div style="text-align: left; direction: ltr; font-size: 0.7em; margin-top: 15px; color: #666;">صفحة 1 من 1</div>`;
        pageFullHtml += footerNote;
        
        // إضافة رسالة الشكر (الـ footer) إذا وجدت
        if (footerHtml) pageFullHtml += footerHtml;
        
        return [{ html: pageFullHtml, pageTotal: pageTotal, pageNumber: 1, isLast: true }];
    }
    
    // ------------------------------------------------------------------
    // الحالة العادية: عدة صفحات (كما في الكود الأصلي)
    // ------------------------------------------------------------------
    const pages = [];
    let grandTotalUsadCharges = 0, grandTotalUsadTaxes = 0, grandTotalEgpCharges = 0, grandTotalEgpTaxes = 0;
    
    for (let i = 0; i < allRows.length; i += rowsPerPage) {
        const pageRows = allRows.slice(i, i + rowsPerPage);
        let pageBody = '';
        pageRows.forEach(row => pageBody += row.outerHTML);
        
        const pageTotal = calculateRowsTotal(pageRows);
        grandTotalUsadCharges += pageTotal.usadCharges;
        grandTotalUsadTaxes   += pageTotal.usadTaxes;
        grandTotalEgpCharges  += pageTotal.egpCharges;
        grandTotalEgpTaxes    += pageTotal.egpTaxes;
        
        // صف إجمالي الصفحة
        const totalRow = `<tr class="page-total-row" style="background-color: #e8f4f8; font-weight: bold;">
            <td colspan="6" style="text-align: left;">إجمالي الصفحة</td>
            <td>${pageTotal.usadCharges.toFixed(2)}</td>
            <td>${pageTotal.usadTaxes.toFixed(2)}</td>
            <td>${pageTotal.egpCharges.toFixed(2)}</td>
            <td>${pageTotal.egpTaxes.toFixed(2)}</td>
            <td>-</td>
        </tr>`;
        pageBody += totalRow;
        
        const pageNumber = Math.floor(i / rowsPerPage) + 1;
        const totalPages = Math.ceil(allRows.length / rowsPerPage);
        const isLast = (pageNumber === totalPages);
        
        // إضافة صف الإجمالي الكلي فقط للصفحة الأخيرة
        if (isLast) {
            const grandTotalRow = `<tr class="grand-total-row" style="background-color: #d1ecf1; font-weight: bold;">
                <td colspan="6" style="text-align: left;">الإجمالي الكلي</td>
                <td>${grandTotalUsadCharges.toFixed(2)}</td>
                <td>${grandTotalUsadTaxes.toFixed(2)}</td>
                <td>${grandTotalEgpCharges.toFixed(2)}</td>
                <td>${grandTotalEgpTaxes.toFixed(2)}</td>
                <td>-</td>
            </tr>`;
            pageBody += grandTotalRow;
        }
        
        let pageFullHtml = beforeTableHtml + pageBody + afterTableHtml;
        const footerNote = `<div style="text-align: left; direction: ltr; font-size: 0.7em; margin-top: 15px; color: #666;">صفحة ${pageNumber} من ${totalPages}</div>`;
        pageFullHtml += footerNote;
        if (isLast && footerHtml) pageFullHtml += footerHtml;
        
        pages.push({ html: pageFullHtml, pageTotal: pageTotal, pageNumber, isLast });
    }
    return pages;
}

// دالة إنشاء HTML للتقرير المفصل
function generateReportHTML(invoices, reportInfo, logoBase64) {
    const { fromDate, toDate, lineOperatorsText, totals, count } = reportInfo;
	    const credits = reportInfo.totals.credits || [];
    const currentDate = new Date().toISOString().slice(0,10).replace(/-/g, '/');
    
    const logoSrc = logoBase64 || '';
    const logoHtml = logoSrc 
        ? `<img src="${logoSrc}" style="width:100%; height:100%; object-fit: cover; border-radius: 50%;">`
        : '<i class="fas fa-ship" style="font-size: 2.5em; color: #1e3c72;"></i>';
    
    let rows = '';
    invoices.forEach((inv, idx) => {
        const finalNum = inv['final-number'] || '';
        const invoiceDate = (inv['finalized-date'] || inv['created'] || '').slice(0,10).replace(/-/g, '/');
        const vessel = inv['key-word1'] || '-';
        const voyageDate = (inv['flex-date-02'] || '').slice(0,10).replace(/-/g, '/');
        const currency = inv['currency'] || 'EGP';
        const exchangeRate = inv['flex-string-06'] || 48.0215;
        const martyr = finalNum.startsWith('P') ? 0 : 5;
        const total = (inv['total-total'] || 0) + martyr;
        
        let usadAmount = '-', usadTax = '-', egpAmount = '-', egpTax = '-', finalDisplay = '';
        if (currency === 'USAD') {
            usadAmount = ((inv['total-charges'] || 0) / exchangeRate).toFixed(2);
            usadTax = ((inv['total-taxes'] || 0) / exchangeRate).toFixed(2);
            finalDisplay = (total / exchangeRate).toFixed(2) + ' USAD';
        } else {
            egpAmount = (inv['total-charges'] || 0).toFixed(2);
            egpTax = (inv['total-taxes'] || 0).toFixed(2);
            finalDisplay = total.toFixed(2) + ' EGP';
        }
        
        rows += `<tr>
            <td>${idx+1}</td>
            <td>${finalNum}</td>
            <td>${invoiceDate}</td>
            <td>${vessel}</td>
            <td>${voyageDate}</td>
            <td>${currency}</td>
            <td>${usadAmount !== '-' ? usadAmount : '-'}</td>
            <td>${usadTax !== '-' ? usadTax : '-'}</td>
            <td>${egpAmount !== '-' ? egpAmount : '-'}</td>
            <td>${egpTax !== '-' ? egpTax : '-'}</td>
            <td>${finalDisplay}</td>
        </tr>`;
    });

    return `<!DOCTYPE html>
    <html dir="rtl">
    <head>
        <meta charset="UTF-8">
        <title>تقرير الفواتير المحددة</title>
		<style>
			body { font-family: 'Segoe UI', Tahoma, sans-serif; margin: 0; padding: 20px; direction: rtl; background: white; }
			.report-header { background: linear-gradient(135deg, #1e3c72, #2a5298) !important; color: white !important; padding: 20px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; }
			.report-header * { color: white !important; }
			.logo-area { display: flex; align-items: center; gap: 15px; }
			.logo-placeholder { width: 70px; height: 70px; background: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid #ffd700; overflow: hidden; }
			.company-title h1 { font-size: 1.3em; margin: 0; }
			.company-title p { margin: 5px 0 0; font-size: 0.8em; }
			.tax-info { font-size: 0.9em; background: rgba(255,255,255,0.2); padding: 8px 15px; border-radius: 8px; }
			.report-info { background: #f8f9fa; padding: 12px 20px; display: flex; flex-wrap: wrap; gap: 15px; border-bottom: 1px solid #ddd; }
			.report-table { width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 0.75em; }
			.report-table th, .report-table td { border: 1px solid #aaa; padding: 8px 4px; text-align: center; }
			.report-table th { background: #4361ee; color: white; }
			.total-row { background: #e8f4f8; }
			.page-total-row { background-color: #e8f4f8; }
			.grand-total-row { background-color: #d1ecf1; }
			.summary-section { display: flex; flex-wrap: wrap; gap: 20px; margin-top: 20px; }
			.summary-box { flex: 1; border-right: 4px solid #4361ee; background: #f8f9fa; padding: 12px; border-radius: 8px; }
			.summary-row { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px dashed #ccc; }
			.summary-row.total { color: #1e3c72; border-bottom: none; }
			.summary-row span:last-child { white-space: nowrap; direction: ltr; text-align: left; font-family: monospace; font-size: 0.85em; }
			.report-footer { text-align: center; margin-top: 20px; padding: 10px; background: #1e3c72; color: white; font-size: 0.7em; }
			@media print { body { padding: 0; } }
			
			/* ✅ جعل جميع الأرقام في الجدول عريضة */
			.report-table td {
				font-weight: bold;
			}
			
			/* ✅ جعل أرقام الملخص عريضة وأكبر قليلاً */
			.summary-box .summary-row span:last-child {
				font-weight: bold;
				font-size: 1.1em;
			}
		</style>
    </head>
    <body>
        <div class="report-header">
            <div class="logo-area">
                <div class="logo-placeholder">${logoHtml}</div>
                <div class="company-title">
                    <h1>شركة دمياط لتداول الحاويات و البضائع</h1>
                    <p>دمياط - المنطقة الحرة - ميناء دمياط | هاتف: 0572290103</p>
                </div>
            </div>
            <div class="tax-info"><i class="fas fa-building"></i> الرقم الضريبي: 100/221/823</div>
        </div>
        <div class="report-info">
            <span><strong>تقرير الفواتير المحددة</strong></span>
            <span><strong>الخط الملاحي:</strong> ${lineOperatorsText}</span>
            ${fromDate && toDate ? `<span><strong>الفترة:</strong> من ${fromDate} إلى ${toDate}</span>` : ''}
            <span><strong>تاريخ التقرير:</strong> ${currentDate}</span>
            <span><strong>عدد الفواتير:</strong> ${count}</span>
        </div>
        <table class="report-table">
            <thead><tr><th>م</th><th>رقم الفاتورة</th><th>تاريخ الفاتورة</th><th>اسم السفينة</th><th>تاريخ الرحلة</th><th>العملة</th><th>المبلغ (USAD)</th><th>الضريبة (USAD)</th><th>المبلغ (EGP)</th><th>الضريبة (EGP)</th><th>الإجمالي النهائي</th></tr></thead>
            <tbody>${rows}
            ${credits.map((c, i) => 
                '<tr style="background: rgba(247,37,133,0.05);">' +
                '<td>' + (invoices.length + i + 1) + '</td>' +
                '<td style="color:#f72585; font-weight:bold;">' + (c.finalNumber || c.draftNumber || c.serial || '-') + '</td>' +
                '<td>' + (c.date || '').replace(/-/g, '/') + '</td>' +
                '<td style="color:#f72585;">إشعار خصم</td>' +
                '<td>-</td>' +
                '<td>' + (c.currency || 'EGP') + '</td>' +
                '<td>' + (c.currency === 'USAD' ? (-c.displayAmount || 0).toFixed(2) : '-') + '</td>' +
                '<td>' + (c.currency === 'USAD' ? (-c.displayTax || 0).toFixed(2) : '-') + '</td>' +
                '<td>' + (c.currency !== 'USAD' ? (-c.displayAmount || 0).toFixed(2) : '-') + '</td>' +
                '<td>' + (c.currency !== 'USAD' ? (-c.displayTax || 0).toFixed(2) : '-') + '</td>' +
                '<td style="color:#f72585; font-weight:bold;">' + (-(c.displayAmount + c.displayTax) || 0).toFixed(2) + ' ' + (c.currency === 'USAD' ? 'USAD' : 'EGP') + '</td>' +
                '</tr>'
            ).join('')}
			</tbody>
        </table>
        
        <div class="summary-section">
            <div class="summary-box"><h4>📊 ملخص العملة USAD</h4>
				<div class="summary-row"><span>إجمالي المبلغ (USAD):</span><span style="font-weight: bold; font-size: 1.1em;">${totals.usadCharges.toFixed(2)} دولار</span></div>
				<div class="summary-row"><span>إجمالي الضريبة (USAD):</span><span style="font-weight: bold; font-size: 1.1em;">${totals.usadTaxes.toFixed(2)} دولار</span></div>
				<div class="summary-row total"><span>الإجمالي الكلي (USAD):</span><span style="font-weight: bold; font-size: 1.1em;">${totals.usadTotal.toFixed(2)} دولار</span></div>
            </div>
            <div class="summary-box"><h4>📊 ملخص العملة EGP</h4>
				<div class="summary-row"><span>إجمالي المبلغ (EGP):</span><span style="font-weight: bold; font-size: 1.1em;">${totals.egpCharges.toFixed(2)} جنيه</span></div>
				<div class="summary-row"><span>إجمالي الضريبة (EGP):</span><span style="font-weight: bold; font-size: 1.1em;">${totals.egpTaxes.toFixed(2)} جنيه</span></div>
				<div class="summary-row total"><span>الإجمالي الكلي (EGP):</span><span style="font-weight: bold; font-size: 1.1em;">${totals.egpTotal.toFixed(2)} جنيه</span></div>
            </div>
        </div>
        
        <div class="report-footer">
            <p>شكراً لتعاملكم مع شركة دمياط لتداول الحاويات و البضائع</p>
            <p>تم إنشاء هذا التقرير إلكترونياً - تاريخ الطباعة: ${currentDate}</p>
        </div>
    </body>
    </html>`;
}

// ============================================
// تصدير تقرير مفصل للفواتير المحددة
// ============================================
async function exportSelectedReport() {
    if (selectedInvoices.size === 0) {
        showNotification('لم يتم تحديد أي فواتير', 'warning');
        return;
    }

    const selectedInvoicesData = [];
    for (let idx of selectedInvoices) {
        if (idx >= 0 && idx < invoicesData.length) {
            selectedInvoicesData.push(invoicesData[idx]);
        }
    }

    if (selectedInvoicesData.length === 0) {
        showNotification('لا توجد بيانات للفواتير المحددة', 'error');
        return;
    }

    // ترتيب الفواتير حسب الرقم التسلسلي الفعلي
    selectedInvoicesData.sort((a, b) => {
        const numA = getInvoiceSerialNumber(a['final-number']);
        const numB = getInvoiceSerialNumber(b['final-number']);
        return numA - numB;
    });

    const dateFromElem = document.getElementById('searchDateFrom');
    const dateToElem = document.getElementById('searchDateTo');
    let fromDate = dateFromElem?.value || '';
    let toDate = dateToElem?.value || '';
    if (fromDate && toDate) {
        fromDate = fromDate.replace(/-/g, '/');
        toDate = toDate.replace(/-/g, '/');
    }

    const lineOperators = [...new Set(selectedInvoicesData.map(inv => inv['contract-customer-id']).filter(op => op))];
    const lineOperatorsText = lineOperators.length ? lineOperators.join(', ') : 'الكل';

    let totals = {
        usadCharges: 0, usadTaxes: 0, usadTotal: 0,
        egpCharges: 0, egpTaxes: 0, egpTotal: 0,
        grandTotal: 0
    };

    selectedInvoicesData.forEach(inv => {
        const currency = inv['currency'] || 'EGP';
        const exchangeRate = inv['flex-string-06'] || 48.0215;
        const martyr = (inv['final-number'] || '').startsWith('P') ? 0 : 5;
        const total = (inv['total-total'] || 0) + martyr;

        if (currency === 'USAD') {
            totals.usadCharges += (inv['total-charges'] || 0) / exchangeRate;
            totals.usadTaxes += (inv['total-taxes'] || 0) / exchangeRate;
            totals.usadTotal += total / exchangeRate;
        } else {
            totals.egpCharges += (inv['total-charges'] || 0);
            totals.egpTaxes += (inv['total-taxes'] || 0);
            totals.egpTotal += total;
        }
        totals.grandTotal += total;
    });

    // التأكد من تحميل الشعار
    if (!companyLogoBase64) {
        await loadLogoFromDrive();
    }
	
	    // ✅ تجميع إشعارات الخصم لنفس العملاء
    let creditItems = [];

    // ✅ ترتيب إشعارات الخصم حسب التاريخ (الأقدم أولاً)
    creditData.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

    if (typeof creditData !== 'undefined' && creditData.length === 0) {
        await loadCreditDataFromDrive();
    }

    if (typeof creditData !== 'undefined' && creditData.length > 0) {
        // جمع معرفات العملاء من الفواتير المحددة
        const customerIds = [...new Set(selectedInvoicesData.map(inv =>
            (inv['payee-customer-id'] || '').toLowerCase()
        ).filter(id => id))];

        // ✅ تحديد نطاق التاريخ من الفواتير المحددة
        const invDates = selectedInvoicesData.map(inv => 
            (inv['finalized-date'] || inv['created'] || '').slice(0, 10)
        ).filter(d => d);
        const minDate = invDates.length ? invDates.sort()[0] : '';
        const maxDate = invDates.length ? invDates.sort()[invDates.length - 1] : '';

        // فلترة إشعارات الخصم (حسب العميل + حسب التاريخ)
        creditItems = creditData.filter(c => {
            if (!c.customerId) return false;
            const matchCustomer = customerIds.some(cid => c.customerId.toLowerCase().includes(cid));
            if (!matchCustomer) return false;
            
            // فلترة حسب التاريخ إن وجد
            const creditDate = (c.date || '').slice(0, 10);
            if (!creditDate) return true; // إذا لم يكن له تاريخ، يظهر
            if (minDate && creditDate < minDate) return false;
            if (maxDate && creditDate > maxDate) return false;
            return true;
        });
    }

    // إنشاء HTML الكامل (مع بطاقات الإجماليات)
    // ✅ إضافة creditItems إلى كائن totals
    totals.credits = creditItems;
	
	    // ✅ تحديث الإجماليات بعد خصم إشعارات الخصم
    creditItems.forEach(c => {
        const amount = c.displayAmount || 0;
        const tax = c.displayTax || 0;
        const total = amount + tax;
        
        if (c.currency === 'USAD') {
            totals.usadCharges -= amount;
            totals.usadTaxes -= tax;
            totals.usadTotal -= total;
        } else {
            totals.egpCharges -= amount;
            totals.egpTaxes -= tax;
            totals.egpTotal -= total;
        }
        totals.grandTotal -= total;
    });

    const reportHtmlWithSummary = generateReportHTML(selectedInvoicesData, {
        fromDate, toDate,
        lineOperatorsText,
        totals,
        count: selectedInvoicesData.length
    }, companyLogoBase64);

    // إنشاء HTML بدون بطاقات الإجماليات (لـ PDF فقط)
    let reportHtmlWithoutSummary = reportHtmlWithSummary;
    reportHtmlWithoutSummary = reportHtmlWithoutSummary.replace(/<div class="summary-section">[\s\S]*?<\/div>\s*<\/div>\s*<div class="report-footer">/, '<div class="report-footer">');

    // عرض المعاينة مع النسخة الكاملة (لشاشة المعاينة والطباعة)
    showReportPreview(reportHtmlWithSummary, reportHtmlWithoutSummary);
}

// ============================================
// عرض التقرير في نافذة معاينة (Modal)
// ============================================
// ============================================
// عرض التقرير في نافذة معاينة (Modal)
// ============================================
function showReportPreview(reportHtmlWithSummary, reportHtmlWithoutSummary) {
    // إزالة أي نافذة معاينة سابقة
    const existingModal = document.getElementById('reportPreviewModal');
    if (existingModal) {
        existingModal.remove();
    }

    // إنشاء النافذة المنبثقة الرئيسية
    const modal = document.createElement('div');
    modal.id = 'reportPreviewModal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.7);
        z-index: 99999;
        display: flex;
        justify-content: center;
        align-items: center;
        direction: rtl;
    `;
    
    // إنشاء محتوى النافذة الداخلي
    const modalContent = document.createElement('div');
    modalContent.id = 'reportPreviewModalContent';
    modalContent.style.cssText = `
        background: white;
        width: 90%;
        max-width: 1200px;
        height: 90%;
        border-radius: 12px;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        position: relative;
    `;
    
    // إنشاء رأس النافذة
    const modalHeader = document.createElement('div');
    modalHeader.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 20px;
        background: #1e3c72;
        color: white;
        border-bottom: 1px solid #2a5298;
    `;
    modalHeader.innerHTML = `
        <h3 style="margin:0;"><i class="fas fa-file-pdf"></i> معاينة التقرير</h3>
        <div>
            <button id="printReportBtn" class="btn-preview" style="background:#10b981; margin-left:10px;"><i class="fas fa-print"></i> طباعة</button>
            <button id="downloadReportPdfBtn" class="btn-preview" style="background:#4361ee; margin-left:10px;"><i class="fas fa-download"></i> تحميل PDF</button>
            <button id="closePreviewBtn" class="btn-preview" style="background:#e63946;"><i class="fas fa-times"></i> إغلاق</button>
        </div>
    `;
    
    // إضافة الأنماط للأزرار
    const style = document.createElement('style');
    style.textContent = `
        .btn-preview {
            border: none;
            color: white;
            padding: 8px 16px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 0.85em;
            transition: all 0.2s;
        }
        .btn-preview:hover {
            transform: scale(1.02);
            opacity: 0.9;
        }
        .report-content {
            flex: 1;
            overflow: auto;
            padding: 20px;
            background: #f0f2f5;
        }
        .report-content > div {
            max-width: 1100px;
            margin: 0 auto;
            background: white;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
    `;
    modalContent.appendChild(style);
    
    // إنشاء منطقة عرض التقرير
    const contentArea = document.createElement('div');
    contentArea.className = 'report-content';
    contentArea.innerHTML = reportHtmlWithSummary;
    
    // تجميع النافذة
    modalContent.appendChild(modalHeader);
    modalContent.appendChild(contentArea);
    modal.appendChild(modalContent);
    document.body.appendChild(modal);
    
    // إضافة شريط تقدم مخصص داخل النافذة (وليس في body)
    let progressContainer = null;
    let progressMessage = null;
    
    function showProgressInsideModal(message, percentage) {
        if (!progressContainer) {
            progressContainer = document.createElement('div');
            progressContainer.id = 'modalProgressContainer';
            progressContainer.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 4px;
                background: #e0e0e0;
                z-index: 1000;
                display: none;
            `;
            
            const progressBar = document.createElement('div');
            progressBar.id = 'modalProgressBar';
            progressBar.style.cssText = `
                height: 100%;
                background: linear-gradient(90deg, #0F9D58, #0B7D44);
                width: 0%;
                transition: width 0.3s ease;
            `;
            progressContainer.appendChild(progressBar);
            
            progressMessage = document.createElement('div');
            progressMessage.id = 'modalProgressMessage';
            progressMessage.style.cssText = `
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: rgba(0,0,0,0.85);
                color: white;
                padding: 15px 30px;
                border-radius: 50px;
                z-index: 1001;
                display: none;
                font-size: 1em;
                white-space: nowrap;
                box-shadow: 0 5px 20px rgba(0,0,0,0.3);
            `;
            
            modalContent.appendChild(progressContainer);
            modalContent.appendChild(progressMessage);
        }
        
        progressContainer.style.display = 'block';
        progressMessage.style.display = 'block';
        progressContainer.querySelector('#modalProgressBar').style.width = percentage + '%';
        progressMessage.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${message}`;
        
        if (percentage >= 100) {
            setTimeout(() => {
                if (progressContainer) progressContainer.style.display = 'none';
                if (progressMessage) progressMessage.style.display = 'none';
            }, 1500);
        }
    }
    
    function hideProgressInsideModal() {
        if (progressContainer) progressContainer.style.display = 'none';
        if (progressMessage) progressMessage.style.display = 'none';
    }
    
    // إغلاق النافذة
    document.getElementById('closePreviewBtn').onclick = () => {
        modal.remove();
    };
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
    
    // طباعة
    document.getElementById('printReportBtn').onclick = () => {
        const printWindow = window.open('', '_blank', 'width=1100,height=800');
        printWindow.document.write(reportHtmlWithSummary);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => printWindow.print(), 500);
    };
    
    // تصدير PDF
    document.getElementById('downloadReportPdfBtn').onclick = async () => {
        if (typeof window.jspdf === 'undefined' || typeof window.html2canvas === 'undefined') {
            showNotification('مكتبات PDF غير متوفرة، يرجى تحديث الصفحة', 'error');
            return;
        }
        
        showProgressInsideModal('جاري إنشاء التقرير...', 10);
        
        try {
            const pages = splitReportIntoPages(reportHtmlWithoutSummary, 15);
            if (pages.length === 0) {
                showNotification('لا توجد بيانات للتقرير', 'error');
                return;
            }
            
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF({
                orientation: 'landscape',
                unit: 'mm',
                format: 'a4',
                compress: true
            });
            
            const margin = 10;
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const contentWidth = pdfWidth - (margin * 2);
            
            for (let idx = 0; idx < pages.length; idx++) {
                const pageHtml = pages[idx].html;
                
                const tempDiv = document.createElement('div');
                tempDiv.style.position = 'absolute';
                tempDiv.style.left = '-9999px';
                tempDiv.style.top = '-9999px';
                tempDiv.style.width = '1100px';
                tempDiv.style.background = 'white';
                tempDiv.style.padding = '20px';
                tempDiv.style.direction = 'rtl';
                tempDiv.innerHTML = pageHtml;
                document.body.appendChild(tempDiv);
                
                await new Promise(resolve => setTimeout(resolve, 150));
                
                const canvas = await html2canvas(tempDiv, {
                    scale: 2.2,
                    backgroundColor: '#ffffff',
                    logging: false,
                    useCORS: true,
                    windowWidth: tempDiv.scrollWidth,
                    windowHeight: tempDiv.scrollHeight
                });
                
                const imgData = canvas.toDataURL('image/jpeg', 0.9);
                const imgHeight = (canvas.height * contentWidth) / canvas.width;
                
                if (idx > 0) pdf.addPage();
                pdf.addImage(imgData, 'JPEG', margin, margin, contentWidth, imgHeight);
                
                document.body.removeChild(tempDiv);
                
                showProgressInsideModal(`جاري إنشاء الصفحة ${idx + 1} من ${pages.length}...`, Math.round(((idx + 1) / pages.length) * 100));
            }
            
            const fileName = `تقرير_فواتير_${new Date().toISOString().slice(0,19).replace(/:/g, '-')}.pdf`;
            pdf.save(fileName);
            showNotification(`تم تصدير التقرير (${pages.length} صفحات) بنجاح`, 'success');
            
        } catch (err) {
            console.error(err);
            showNotification('حدث خطأ في تصدير PDF', 'error');
        } finally {
            hideProgressInsideModal();
        }
    };
}

// ============================================
// دوال تحميل الشعار من Drive
// ============================================

/**
 * تحميل الشعار من Google Drive
 */
async function loadLogoFromDrive() {
    if (!driveConfig.apiKey || !driveConfig.logoFileId) return false;
    
    try {
        const url = `https://www.googleapis.com/drive/v3/files/${driveConfig.logoFileId}?alt=media&key=${driveConfig.apiKey}`;
        const response = await fetch(url);
        
        if (!response.ok) throw new Error('فشل تحميل الشعار');
        
        const blob = await response.blob();
        
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                companyLogoBase64 = reader.result;
                resolve(true);
            };
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.error('خطأ في تحميل الشعار:', error);
        return false;
    }
}

// ============================================
// دوال شريط التقدم
// ============================================
function showProgress(message, percentage, parentElement = null) {
    let container = document.getElementById('progressBarContainer');
    let bar = document.getElementById('progressBar');
    let msg = document.getElementById('progressMessage');

    if (!container) {
        container = document.createElement('div');
        container.id = 'progressBarContainer';
        container.className = 'progress-bar-container';
        container.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 4px; background: #e0e0e0; z-index: 100; display: none;';
        
        bar = document.createElement('div');
        bar.id = 'progressBar';
        bar.className = 'progress-bar';
        bar.style.cssText = 'height: 100%; background: linear-gradient(90deg, #0F9D58, #0B7D44); width: 0%; transition: width 0.3s ease;';
        container.appendChild(bar);

        msg = document.createElement('div');
        msg.id = 'progressMessage';
        msg.className = 'progress-message';
        msg.style.cssText = 'position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; padding: 15px 30px; border-radius: 50px; box-shadow: 0 5px 20px rgba(0,0,0,0.3); z-index: 101; display: none; font-size: 1em; white-space: nowrap;';
        
        // نضيف العناصر إلى parentElement المحدد
        if (parentElement) {
            parentElement.appendChild(container);
            parentElement.appendChild(msg);
        } else {
            document.body.appendChild(container);
            document.body.appendChild(msg);
        }
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
    if (container) {
        container.style.display = 'none';
        // اختيارياً: إزالة العناصر بالكامل بعد الإخفاء
        // container.remove();
        // msg.remove();
    }
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

async function findCreditFileIdAuto() {
    if (!driveConfig.apiKey || !driveConfig.folderId) return false;
    const fileName = driveConfig.creditFileName || 'creditdata.txt';  // القيمة الافتراضية الجديدة
    try {
        const query = encodeURIComponent(`'${driveConfig.folderId}' in parents and name='${fileName}' and trashed=false`);
        const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&key=${driveConfig.apiKey}&fields=files(id,name)`);
        if (!res.ok) return false;
        const data = await res.json();
        if (data.files?.length) {
            driveConfig.creditFileId = data.files[0].id;
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
    const creditFound = await findCreditFileIdAuto();   // إضافة هذا السطر
    if (dataFound || usersFound || creditFound) saveDriveSettingsToStorage();
    showProgress(dataFound || usersFound || creditFound ? 'تم إعداد Drive' : 'استخدم الإعدادات الافتراضية', 100);
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

// دالة مساعدة لفك تشفير Base64 (للاستخدام في حالة الطوارئ فقط)
function decodeBase64(encoded) {
    try {
        return atob(encoded);
    } catch(e) {
        return encoded;
    }
}

// تحميل النسخة الاحتياطية من localStorage
function loadUsersFromBackup() {
    const backup = localStorage.getItem('backupUsers');
    if (backup) {
        try { 
            users = JSON.parse(backup); 
            return true; 
        } catch { 
            return false; 
        }
    }
    return false;
}

// (ملغاة) لم نعد نستخدم مستخدمين افتراضيين متعددين
// function loadDefaultUsers() { ... }  // تم حذفها نهائياً

// تحميل المستخدمين (الاعتماد الأساسي على Drive)
async function loadUsers(forceRefresh = false) {
    // محاولة التحميل من Drive أولاً
    let loaded = false;
    if (forceRefresh) {
        loaded = await loadUsersFromDrive();
    } else {
        loaded = await loadUsersFromDrive();
    }
    
    if (loaded) {
        // نجح التحميل من Drive
        if (forceRefresh) showNotification('تم تحديث المستخدمين', 'success');
        return;
    }
    
    // فشل التحميل من Drive → نحاول من النسخة الاحتياطية المحلية
    if (loadUsersFromBackup()) {
        console.warn('⚠️ تم تحميل المستخدمين من النسخة الاحتياطية المحلية');
        showNotification('تم تحميل المستخدمين من النسخة الاحتياطية', 'warning');
        return;
    }
    
    // في حالة عدم وجود أي بيانات (لا Drive ولا نسخة احتياطية)، نضيف مديراً احتياطياً واحداً فقط
    console.error('❌ فشل تحميل المستخدمين من Drive والنسخة الاحتياطية. سيتم إنشاء مدير احتياطي.');
    users = [{
        id: 'user_admin_emergency',
        username: 'admin',
        email: 'admin@emergency.local',
        taxNumber: decodeBase64('QURNSU4wMDE='),      // ADMIN001
        contractCustomerId: decodeBase64('QURNSU4wMDE='),
        customerIds: [],
        userType: 'admin',
        password: decodeBase64('YWRtaW4xMjM='),       
        status: 'active',
        createdAt: new Date().toISOString(),
        lastLogin: null
    }];
    showNotification('تم إنشاء مدير احتياطي بسبب فشل تحميل المستخدمين', 'warning');
}

// تحديث المستخدمين يدوياً من Drive (للمدير فقط)
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
        // إذا فشل التحديث من Drive، نحاول جلب من النسخة الاحتياطية (إن وجدت)
        if (loadUsersFromBackup()) {
            renderUsersTable();
            showNotification('تم تحميل المستخدمين من النسخة الاحتياطية', 'warning');
        } else {
            showNotification('فشل تحديث المستخدمين ولا توجد نسخة احتياطية', 'error');
        }
    }
};

// ============================================
// دوال إدارة المستخدمين
// ============================================
function renderUsersTable() {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;
    tbody.innerHTML = users.map(u => `
        <tr>
            <td>${u.username}</td>
            <td>${u.email}</td>
            <td>${u.taxNumber || '-'}</td>
            <td>${u.contractCustomerId || '-'}</td>
            <td>${(u.customerIds || []).join(', ') || '-'}</td>
            <td>${{ admin: 'مدير', accountant: 'محاسب', customer: 'عميل' }[u.userType] || u.userType}</td>
            <td><span class="status-badge ${u.status}">${u.status === 'active' ? 'نشط' : 'غير نشط'}</span></td>
            <td>${u.lastLogin ? new Date(u.lastLogin).toLocaleString('ar-EG') : 'لم يسجل'}</td>
            <td>
                <button class="action-btn edit" onclick="editUser('${u.id}')"><i class="fas fa-edit"></i></button>
                <button class="action-btn reset" onclick="resetUserPassword('${u.id}')"><i class="fas fa-key"></i></button>
                <button class="action-btn delete" onclick="deleteUser('${u.id}')"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
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
    ['editUsername', 'editEmail', 'editTaxNumber', 'editContractCustomerId', 'editPassword', 'editCustomerIds'].forEach(id => document.getElementById(id).value = '');
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
    document.getElementById('editCustomerIds').value = (user.customerIds || []).join(', ');
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
    const customerIdsRaw = document.getElementById('editCustomerIds').value.trim();
    const userType = document.getElementById('editUserType').value;
    const password = document.getElementById('editPassword').value;
    const status = document.getElementById('editStatus').value;

    if (!username || !email) return alert('الرجاء إدخال اسم المستخدم والبريد الإلكتروني');
    if (!currentEditingUserId && !password) return alert('الرجاء إدخال كلمة مرور');

    // تحويل قائمة المعرفات إلى مصفوفة
    let customerIds = [];
    if (customerIdsRaw) {
        customerIds = customerIdsRaw.split(',').map(id => id.trim()).filter(id => id !== '');
    }
    // إضافة contractCustomerId إلى القائمة إذا لم يكن موجوداً (للحفاظ على التوافق)
    if (contractCustomerId && !customerIds.includes(contractCustomerId)) {
        customerIds.push(contractCustomerId);
    }

    if (currentEditingUserId) {
        const u = users.find(u => u.id === currentEditingUserId);
        if (u) { 
            u.username = username; 
            u.email = email; 
            u.taxNumber = taxNumber; 
            u.contractCustomerId = contractCustomerId; 
            u.customerIds = customerIds;
            u.userType = userType; 
            if (password) u.password = password; 
            u.status = status; 
        }
    } else {
        users.push({ 
            id: 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9), 
            username, email, taxNumber, contractCustomerId, customerIds, userType, password, status, 
            createdAt: new Date().toISOString(), lastLogin: null 
        });
    }

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
    if (saved) {
        try {
            currentUser = JSON.parse(saved);
            document.getElementById('loginScreen').style.display = 'none';
            document.getElementById('mainApp').style.display = 'block';
            updateUserInterface();
            
            // ✅ تحميل شريط الأخبار (ظاهر تلقائياً)
            if (currentUser) {
                setTimeout(() => {
                    if (typeof initNewsBar === 'function') {
                        initNewsBar();
                    }
                }, 1000);
            }
            
            addDatabaseControls();

            // ✅ تحميل البيانات فوراً
            console.log('🟢 بدء تحميل البيانات من Drive...');
            loadInvoicesFromDrive().then(async () => {
                console.log('✅ تم التحميل الأولي بنجاح');
                // ✅ تحميل السدادات لتحديث حالة الفواتير
                console.log('🔄 جاري تحميل السدادات...');
                await loadPaymentsFromCloud(currentUser.username);
                console.log('📋 السدادات بعد التحميل:', paymentsData.length);
                // إعادة عرض البيانات لتحديث الأيقونات
                if (currentUser?.isGuest) {
                    filterInvoicesByGuest(currentUser.taxNumber, currentUser.blNumber);
                } else {
                    filterInvoicesByUser();
                }
            }).catch(err => {
                console.error('❌ فشل التحميل الأولي:', err);
            });

            // ✅ بدء التحديث التلقائي
            if (typeof applyRefreshSetting === 'function') {
                applyRefreshSetting();
            }

            // ✅ تحديث المستخدمين كل 5 دقائق للمدير فقط
            if (currentUser.userType === 'admin') {
                setInterval(async () => {
                    if (currentUser?.userType === 'admin' && typeof loadUsersFromDrive === 'function') {
                        await loadUsersFromDrive();
                    }
                }, 5 * 60 * 1000);
            }
        } catch(e) {
            console.error('خطأ في استعادة الجلسة:', e);
            sessionStorage.removeItem('currentUser');
        }
    }
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

    // ✅ الخطوة 1: تحميل البيانات فوراً (بدون انتظار)
    showNotification('جاري تحميل البيانات...', 'info');
    await loadInvoicesFromDrive();  // ننتظر التحميل (اختياري)
    
    // ✅ الخطوة 2: بدء المؤقت (إذا كان مفعلاً)
    applyRefreshSetting();
};

window.handleGuestLogin = async function() {
    const taxNumber = document.getElementById('guestTaxNumber').value.trim();
    const blNumber = document.getElementById('guestBlNumber').value.trim();
    if (!taxNumber && !blNumber) return showLoginMessage('أدخل الرقم الضريبي أو البوليصة', 'error');
    
    // ✅ التحقق إذا كان الرقم الضريبي مسجلاً لمستخدم
    if (taxNumber) {
        await loadUsers(true);
        const registeredUser = users.find(u => 
            u.taxNumber === taxNumber || 
            u.contractCustomerId === taxNumber ||
            (u.customerIds && u.customerIds.includes(taxNumber))
        );
        
        if (registeredUser) {
            return showLoginMessage(
                `⚠️ هذا الرقم الضريبي مسجل للمستخدم "${registeredUser.username}". الرجاء تسجيل الدخول بدلاً من وضع الزائر.`,
                'error'
            );
        }
    }
    
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

window.logout = function() {
    // ✅ إيقاف التحديث التلقائي عند تسجيل الخروج
    stopRefreshTimer();
    currentUser = null;
    sessionStorage.removeItem('currentUser');
    location.reload();
};

function updateUserInterface() {
    if (!currentUser) return;
    
    // ✅ تحديث الشريط الجانبي
    const sidebarAvatar = document.getElementById('sidebarAvatar');
    const sidebarName = document.getElementById('sidebarName');
    const sidebarRole = document.getElementById('sidebarRole');
    const sidebarAdminLink = document.getElementById('sidebarAdminLink');
    
    if (sidebarAvatar) sidebarAvatar.textContent = (currentUser.username || 'م')[0];
    if (sidebarName) sidebarName.textContent = currentUser.username || 'مستخدم';
    
    const roleMap = { admin: 'مدير', accountant: 'محاسب', customer: 'عميل' };
    if (sidebarRole) sidebarRole.textContent = '● ' + (roleMap[currentUser.userType] || 'مستخدم');
    if (sidebarAdminLink) sidebarAdminLink.style.display = currentUser.userType === 'admin' ? '' : 'none';
    
    // ✅ تحديث العناصر العلوية (إن وجدت)
    let displayName = currentUser.username, taxDisplay = '', badgeClass = '', badgeText = '';
    if (currentUser.isGuest) {
        displayName = 'زائر';
        taxDisplay = [currentUser.taxNumber ? `ضريبي: ${currentUser.taxNumber}` : '', currentUser.blNumber ? `بوليصة: ${currentUser.blNumber}` : ''].filter(Boolean).join(' | ');
        badgeClass = 'guest'; badgeText = 'زائر';
    } else {
        taxDisplay = `الرقم الضريبي: ${currentUser.taxNumber || 'غير محدد'}`;
        if (currentUser.contractCustomerId) taxDisplay += ` | رقم العقد: ${currentUser.contractCustomerId}`;
        badgeClass = currentUser.userType;
        badgeText = roleMap[currentUser.userType] || currentUser.userType;
    }
    
    const currentUserDisplay = document.getElementById('currentUserDisplay');
    const userTaxDisplay = document.getElementById('userTaxDisplay');
    const userTypeBadge = document.getElementById('userTypeBadge');
    
    if (currentUserDisplay) currentUserDisplay.textContent = displayName;
    if (userTaxDisplay) userTaxDisplay.textContent = taxDisplay;
    if (userTypeBadge) {
        userTypeBadge.textContent = badgeText;
        userTypeBadge.className = `user-badge ${badgeClass}`;
    }

    const isAdmin = currentUser.userType === 'admin';
    const isGuest = currentUser.isGuest;

    const driveSettingsBtn = document.getElementById('driveSettingsBtn');
    const adminPanelBtn = document.getElementById('adminPanelBtn');
    const openingBalanceBtn = document.getElementById('openingBalanceBtn');
    const uploadXmlBtn = document.getElementById('uploadXmlBtn');
    const driveUpdateBtn = document.getElementById('driveUpdateBtn');    
    if (driveSettingsBtn) driveSettingsBtn.style.display = isAdmin ? 'flex' : 'none';
    if (adminPanelBtn) adminPanelBtn.style.display = isAdmin ? 'flex' : 'none';
    if (openingBalanceBtn) openingBalanceBtn.style.display = isAdmin ? 'flex' : 'none';
    if (uploadXmlBtn) uploadXmlBtn.style.display = isAdmin ? 'inline-flex' : 'none';
    if (driveUpdateBtn) driveUpdateBtn.style.display = isAdmin ? 'inline-flex' : 'none';

    const showChangePasswordBtn = document.querySelector('[onclick="showChangePassword()"]');
    if (showChangePasswordBtn) showChangePasswordBtn.style.display = isGuest ? 'none' : 'flex';

    // بناء واجهة البحث المتقدم
    if (typeof buildInvoiceSearchUI === 'function') {
        buildInvoiceSearchUI();
    }
    
    // تحميل شريط الأخبار
    if (currentUser) {
        setTimeout(function() {
            if (typeof initNewsBar === 'function') {
                initNewsBar();
            }
        }, 1000);
    }
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
            const req = indexedDB.open('InvoiceDB', 3);
            req.onerror = () => { useLocalStorageFallback(); resolve(); };
            req.onsuccess = e => { db = e.target.result; console.log('✅ تم فتح قاعدة البيانات'); resolve(); };
            req.onupgradeneeded = e => {
                const db = e.target.result;
                try {
                    if (db.objectStoreNames.contains('invoices')) db.deleteObjectStore('invoices');
                    if (db.objectStoreNames.contains('settings')) db.deleteObjectStore('settings');
                    const store = db.createObjectStore('invoices', { keyPath: 'id', autoIncrement: true });
                    try { store.createIndex('final-number', 'final-number', { unique: false }); } catch(e) {}
                    try { store.createIndex('draft-number', 'draft-number', { unique: false }); } catch(e) {}
                    try { store.createIndex('payee-customer-id', 'payee-customer-id', { unique: false }); } catch(e) {}
                    try { store.createIndex('contract-customer-id', 'contract-customer-id', { unique: false }); } catch(e) {}
                    db.createObjectStore('settings', { keyPath: 'key' });
                } catch(err) {
                    console.warn('خطأ في IndexedDB:', err);
                }
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
        zIndex: '100000000', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.95em'
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
    el.innerHTML = `${db ? '📦' : '💾'} ${formatNumberWithCommas(count)} فاتورة - ${db ? 'قاعدة بيانات محلية' : 'تخزين مؤقت'}${date}`;
}


// ============================================
// دوال التبديل بين أنواع الفواتير
// ============================================
window.switchInvoiceType = async function(type) {
    console.log('التبويب المحدد:', type);
    currentInvoiceType = type;
        updateSidebarActive(type);
		    if (type === 'cash') updatePageTitle('الفواتير النقدية', filteredInvoices.length, document.getElementById('totalSum')?.textContent);
    if (type === 'postponed') updatePageTitle('الفواتير الآجلة', filteredInvoices.length, document.getElementById('totalSum')?.textContent);
    if (type === 'credit') updatePageTitle('إشعارات الخصم', filteredCreditData.length, document.getElementById('totalSum')?.textContent);
	 // ✅ تحميل السدادات أولاً لتحديث حالة الفواتير
    if (paymentsData.length === 0) {
        await loadPaymentsFromCloud(currentUser.username);
    }
    // تحديث مظهر الأزرار
    document.querySelectorAll('.type-tab').forEach((btn, i) => {
        if (type === INVOICE_TYPES.CASH && i === 0) btn.classList.add('active');
        else if (type === INVOICE_TYPES.POSTPONED && i === 1) btn.classList.add('active');
        else if (type === INVOICE_TYPES.CREDIT && i === 2) btn.classList.add('active');
        else btn.classList.remove('active');
    });

    // ========== حالة إشعارات الخصم ==========
    if (type === INVOICE_TYPES.CREDIT) {
        // إخفاء عناصر الفواتير
        const advancedSearch = document.querySelector('.advanced-search');
        if (advancedSearch) advancedSearch.style.display = 'block'; // نجعله مرئياً لكن نغير محتواه
        const fileLabel = document.querySelector('label[for="fileInput"]');
        const driveBtn = document.querySelector('.btn-drive');
        if (fileLabel) fileLabel.style.display = 'none';
        if (driveBtn) driveBtn.style.display = 'none';
        
        // بناء واجهة البحث الخاصة بإشعارات الخصم
        buildCreditSearchUI();
        
        // مزامنة وضع العرض
        viewModeCredit = viewMode;
        
        // عرض رسالة تحميل
        document.getElementById('dataViewContainer').innerHTML = '<div class="no-data"><i class="fas fa-spinner fa-spin"></i><p>جاري تحميل إشعارات الخصم...</p></div>';
        document.getElementById('pagination').innerHTML = '';
        
        // تحميل البيانات إذا لزم الأمر
        if (creditData.length === 0) {
            const success = await loadCreditDataFromDrive();
            if (success) {
                filterCreditData();
            } else {
                document.getElementById('dataViewContainer').innerHTML = '<div class="no-data"><i class="fas fa-exclamation-triangle"></i><p>فشل تحميل إشعارات الخصم. تأكد من اتصال Drive ووجود الملف.</p></div>';
                updateCreditSummary();
            }
        } else {
            filterCreditData();
        }
    } 
    // ========== حالة الفواتير (نقدي/آجل) ==========
    else {
        // إظهار عناصر الفواتير
        const advancedSearch = document.querySelector('.advanced-search');
        if (advancedSearch) advancedSearch.style.display = 'block';
        
        // بناء واجهة البحث الخاصة بالفواتير
        buildInvoiceSearchUI();
        
        // إظهار أزرار رفع الملفات للمدير فقط
        if (currentUser?.userType === 'admin') {
            const fileLabel = document.querySelector('label[for="fileInput"]');
            const driveBtn = document.querySelector('.btn-drive');
            if (fileLabel) fileLabel.style.display = 'inline-flex';
            if (driveBtn) driveBtn.style.display = 'inline-flex';
        } else {
            const fileLabel = document.querySelector('label[for="fileInput"]');
            const driveBtn = document.querySelector('.btn-drive');
            if (fileLabel) fileLabel.style.display = 'none';
            if (driveBtn) driveBtn.style.display = 'none';
        }
        
        // إعادة تعيين الصفحة وعرض البيانات
        currentPage = 1;
        filterInvoicesByUser();
    }
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

		// ✅ إزالة الفواتير المكررة
		const uniqueInvoices = [];
		const seenKeys = new Set();

		newInvoices.forEach(inv => {
			const key = getInvoiceKey(inv);
			if (!seenKeys.has(key)) {
				seenKeys.add(key);
				uniqueInvoices.push(inv);
			}
		});

		const duplicateCount = newInvoices.length - uniqueInvoices.length;
			if (duplicateCount > 0 && currentUser?.userType === 'admin') {
				showNotification(`⚠️ تم إزالة ${duplicateCount} فاتورة مكررة`, 'warning');
				console.log(`⚠️ تم إزالة ${duplicateCount} فاتورة مكررة`);
			}

		invoicesData = uniqueInvoices;
        showProgress('تم التحديث', 100);
		        // ✅ تحميل السدادات لتحديث حالة السداد في الجدول
        await loadPaymentsFromCloud(currentUser?.username);
        currentUser?.isGuest ? filterInvoicesByGuest(currentUser.taxNumber, currentUser.blNumber) : filterInvoicesByUser();
        document.getElementById('fileStatus').innerHTML = `<i class="fas fa-check-circle"></i> ✅ تم تحديث ${formatNumberWithCommas(invoicesData.length)} فاتورة من ${source}`;
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
        // قراءة رقم الفاتورة النهائي لتحديد النوع
        const finalNum = invoice.getAttribute('final-number') || '';
        const isPostponed = finalNum.startsWith('P') || finalNum.startsWith('p');
        
        // قراءة قيمة سعر الصرف من flex-string-06
        const exRateAttr = invoice.getAttribute('flex-string-06') || '';
        const currency = invoice.getAttribute('currency') || 'EGP';
        
        let exRate;
        
        // تعديل معالجة سعر الصرف - للفواتير الآجلة فقط
        if (isPostponed) {
            // الفواتير الآجلة: نتحقق من وجود سعر صرف صالح
            if (exRateAttr && exRateAttr !== 'N/A' && !isNaN(parseFloat(exRateAttr))) {
                // يوجد سعر صرف صالح في الملف - نستخدمه كما هو
                exRate = parseFloat(exRateAttr);
                console.log(`فاتورة آجلة ${finalNum}: استخدام سعر الصرف الموجود = ${exRate}`);
            } else {
                // لا يوجد سعر صرف صالح في الملف
                if (currency === 'EGP') {
                    // عملة EGP ولا يوجد سعر صرف - نستخدم 1
                    exRate = 1;
                    console.log(`فاتورة آجلة ${finalNum}: لا يوجد سعر صرف، عملة EGP → استخدام 1`);
                } else {
                    // عملة USAD ولا يوجد سعر صرف - نستخدم القيمة الافتراضية
                    exRate = 48.0215;
                    console.log(`فاتورة آجلة ${finalNum}: لا يوجد سعر صرف، عملة USAD → استخدام الافتراضي 48.0215`);
                }
            }
        } else {
            // الفواتير النقدية: نستخدم القيمة الأصلية كما هي
            if (exRateAttr && exRateAttr !== 'N/A' && !isNaN(parseFloat(exRateAttr))) {
                exRate = parseFloat(exRateAttr);
            } else {
                exRate = 48.0215; // القيمة الافتراضية
            }
        }
        
        const obj = {
            'draft-number': invoice.getAttribute('draft-number') || '',
            'final-number': finalNum,
            'finalized-date': invoice.getAttribute('finalized-date') || '',
            'status': invoice.getAttribute('status') || '',
            'invoice-type-id': invoice.getAttribute('invoice-type-id') || '',
            'currency': currency,
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
                const d1 = new Date(from), d2 = new Date(to);
                if (!isNaN(d1) && !isNaN(d2)) {
                    const diffTime = Math.abs(d2 - d1);
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    storageDays = diffDays + 1;
                }
            }
            
            // قراءة الكمية من XML
            const quantityBilled = parseFloat(charge.getAttribute('quantity-billed') || 1);
            
            // تعديل سعر الصرف في بنود المصاريف - للفواتير الآجلة فقط
            let chargeExRate;
            
            if (isPostponed) {
                // للفواتير الآجلة
                const chargeExRateAttr = charge.getAttribute('exchange-rate');
                
                if (chargeExRateAttr && chargeExRateAttr !== 'N/A' && !isNaN(parseFloat(chargeExRateAttr))) {
                    // يوجد سعر صرف خاص بالبند - نستخدمه
                    chargeExRate = parseFloat(chargeExRateAttr);
                } else {
                    // لا يوجد سعر صرف خاص بالبند - نستخدم سعر صرف الفاتورة
                    chargeExRate = exRate;
                }
            } else {
                // للفواتير النقدية، نستخدم القيمة الأصلية
                const chargeExRateAttr = charge.getAttribute('exchange-rate');
                if (chargeExRateAttr && chargeExRateAttr !== 'N/A' && !isNaN(parseFloat(chargeExRateAttr))) {
                    chargeExRate = parseFloat(chargeExRateAttr);
                } else {
                    chargeExRate = exRate;
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
                'quantity-billed': quantityBilled,
                'amount': parseFloat(charge.getAttribute('amount') || 0),
                'is-flat-rate': charge.getAttribute('is-flat-rate') || '',
                'flat-rate-amount': parseFloat(charge.getAttribute('flat-rate-amount') || 0),
                'exchange-rate': chargeExRate,
                'created': charge.getAttribute('created') || '',
                'storage-days': storageDays,
                'quantity': quantityBilled,
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

function parseCreditNode(creditElement) {
    try {
        // قراءة السمات الأساسية
        const customer = creditElement.getAttribute('customer-name') || '';
        const customerId = creditElement.getAttribute('customer-id') || '';
        const draftNumber = creditElement.getAttribute('draft-number') || '';
        const finalNumber = creditElement.getAttribute('final-number') || '';
        
        // قراءة رقم الفاتورة الأصلية (قد يكون في credit أو في credit-item)
        let invoiceFinalNumber = creditElement.getAttribute('invoice-final-number') || '';
        if (!invoiceFinalNumber) {
            const firstItem = creditElement.querySelector('credit-item');
            if (firstItem) {
                invoiceFinalNumber = firstItem.getAttribute('invoice-final-number') || '';
            }
        }
        
        const date = creditElement.getAttribute('date') || '';
        const currency = creditElement.getAttribute('currency') || 'EGP';
        const totalCredit = parseFloat(creditElement.getAttribute('total-credit') || 0);
        const totalTaxCredit = parseFloat(creditElement.getAttribute('total-tax-credit') || 0);
        const status = creditElement.getAttribute('status') || '';
        const notes = creditElement.getAttribute('notes') || '';

        // قراءة سعر الصرف
        let exchangeRate = null;
        const creditExchangeRate = creditElement.getAttribute('exchange-rate');
        if (creditExchangeRate && creditExchangeRate !== 'N/A' && !isNaN(parseFloat(creditExchangeRate))) {
            exchangeRate = parseFloat(creditExchangeRate);
        } else {
            const firstCreditItem = creditElement.querySelector('credit-item');
            if (firstCreditItem) {
                const itemRate = firstCreditItem.getAttribute('exchange-rate');
                if (itemRate && itemRate !== 'N/A' && !isNaN(parseFloat(itemRate))) {
                    exchangeRate = parseFloat(itemRate);
                }
            }
        }
        if (exchangeRate === null) exchangeRate = 1;

        // حساب المبلغ والضريبة بعد سعر الصرف (للعرض فقط)
        let displayTotalCredit = totalCredit;
        let displayTotalTax = totalTaxCredit;
        if (currency === 'USAD' && exchangeRate !== 1 && exchangeRate !== 0) {
            displayTotalCredit = totalCredit / exchangeRate;
            displayTotalTax = totalTaxCredit / exchangeRate;
        }

        const serial = draftNumber || finalNumber || (Math.random().toString(36).substr(2, 8));

        // تجميع البنود
        const items = [];
        const creditItems = creditElement.getElementsByTagName('credit-item');
        for (let j = 0; j < creditItems.length; j++) {
            const item = creditItems[j];
            let amountCredited = parseFloat(item.getAttribute('amount-credited') || 0);
            let taxCredited = parseFloat(item.getAttribute('tax-credited') || 0);
            let displayAmount = amountCredited;
            let displayTax = taxCredited;
            if (currency === 'USAD' && exchangeRate !== 1 && exchangeRate !== 0) {
                displayAmount = amountCredited / exchangeRate;
                displayTax = taxCredited / exchangeRate;
            }
            items.push({
                amountCredited: amountCredited,
                quantity: parseFloat(item.getAttribute('quantity') || 0),
                rateCredited: parseFloat(item.getAttribute('rate-credited') || 0),
                exchangeRate: exchangeRate,
                invoiceDraftNumber: item.getAttribute('invoice-draft-number') || '',
                invoiceFinalNumber: item.getAttribute('invoice-final-number') || '',
                taxCredited: taxCredited,
                displayAmount: displayAmount,
                displayTax: displayTax
            });
        }

        return {
            serial: serial,
            customer: customer,
            customerId: customerId,
            draftNumber: draftNumber,
            finalNumber: finalNumber,
            invoiceFinalNumber: invoiceFinalNumber,
            date: date ? date.split('T')[0] : '',
            currency: currency,
            amount: totalCredit,
            displayAmount: displayTotalCredit,
            tax: totalTaxCredit,
            displayTax: displayTotalTax,
            exchangeRate: exchangeRate,
            status: status,
            notes: notes,
            items: items,
            preparedBy: 'النظام',
            reviewedBy: 'النظام'
        };
    } catch (error) {
        console.error('خطأ في تحليل عنصر credit:', error);
        return null;
    }
}

// ============================================
// دوال البحث المتقدم - معدلة لاستخدام finalized-date
// ============================================
window.applyAdvancedSearch = async function() {
	    isSearching = true;  // 👈 أضف هذا السطر هنا
    console.log('🔍 [بحث] بدء البحث');
    console.log('📊 عدد الفواتير الكلي:', invoicesData.length);
    
    if (!invoicesData.length) { filteredInvoices = []; renderData(); return; }
    
    const [final, draft, cust, vessel, bl, cont, status, from, to, invType, contractCustomerId, viewedStatus] = [
        'searchFinalNumber', 'searchDraftNumber', 'searchCustomer', 'searchVessel', 
        'searchBlNumber', 'searchContainer', 'searchStatus', 'searchDateFrom', 
        'searchDateTo', 'searchInvoiceType', 'searchContractCustomerId', 'searchViewedStatus'
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
    } 
    else if (currentUser && currentUser.userType !== 'admin' && !currentUser.isGuest) {
        let allowedIds = [];
        if (currentUser.contractCustomerId) allowedIds.push(currentUser.contractCustomerId);
        if (currentUser.customerIds && Array.isArray(currentUser.customerIds)) {
            allowedIds = allowedIds.concat(currentUser.customerIds);
        }
        allowedIds = [...new Set(allowedIds.map(id => id.toLowerCase()))];
        
        console.log('✅ allowedIds للمستخدم:', allowedIds);
        
        if (allowedIds.length === 0) {
            tempInvoices = [];
        } else {
            tempInvoices = tempInvoices.filter(inv => {
                const payeeId = (inv['payee-customer-id'] || '').toLowerCase();
                const contractId = (inv['contract-customer-id'] || '').toLowerCase();
                return allowedIds.some(id => payeeId === id || contractId === id);
            });
        }
    }

    console.log('📊 عدد الفواتير بعد تصفية المستخدم (tempInvoices):', tempInvoices.length);
    
    // ✅ تأكد من تحميل العلامات قبل البحث
    if (viewedStatus && viewedInvoices.size === 0 && currentUser) {
        console.log('🔄 viewedInvoices فارغة، جاري التحميل من Drive...');
        await loadViewedFromDrive();
    }
    
    const searched = tempInvoices.filter(inv => {
        // ✅ تصفية حسب صلاحيات المستخدم (طبقة أمان إضافية)
        const belongsToUser = checkIfInvoiceBelongsToUser(inv);
        if (!belongsToUser) {
            console.log('❌ فاتورة لا تخص المستخدم:', inv['final-number']);
            return false;
        }
        
        if (final && !(inv['final-number'] || '').toLowerCase().includes(final)) return false;
        if (draft && !(inv['draft-number'] || '').toLowerCase().includes(draft)) return false;
        if (cust) {
            const payeeMatch = (inv['payee-customer-id'] || '').toLowerCase().includes(cust);
            const contractMatch = (inv['contract-customer-id'] || '').toLowerCase().includes(cust);
            if (!payeeMatch && !contractMatch) return false;
        }
        if (vessel && !(inv['key-word1'] || '').toLowerCase().includes(vessel)) return false;
        if (bl && !(inv['key-word2'] || '').toLowerCase().includes(bl)) return false;
        if (cont) {
            const found = inv.charges.some(c => (c['entity-id'] || '').toLowerCase().includes(cont));
            if (!found) return false;
        }
        if (contractCustomerId && !(inv['contract-customer-id'] || '').toLowerCase().includes(contractCustomerId)) return false;
        // فلتر حالة المعاينة (بدلاً من فلتر FINAL/DRAFT)
		if (status) {
			const viewKey = getInvoiceKey(inv);
			const isViewed = viewedInvoices.has(viewKey);
			if (status === 'viewed' && !isViewed) return false;
			if (status === 'not_viewed' && isViewed) return false;
		}
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

    console.log('📊 عدد الفواتير بعد البحث (searched):', searched.length);
    
    filteredInvoices = searched;
    currentPage = 1;
    clearSelectedInvoices();
    renderData();
    
    console.log('📊 عدد الفواتير المعروضة (filteredInvoices):', filteredInvoices.length);
    showNotification(`تم العثور على ${formatNumberWithCommas(filteredInvoices.length)} فاتورة`, filteredInvoices.length ? 'success' : 'info');
	    // 👇 أضف هذا السطر في النهاية
    setTimeout(() => { isSearching = false; }, 500);

};

window.resetAdvancedSearch = function() {
	    isSearching = true;  // 👈 أضف هذا

    const searchFields = ['searchFinalNumber', 'searchDraftNumber', 'searchCustomer', 'searchVessel', 
                      'searchBlNumber', 'searchContainer', 'searchStatus', 'searchDateFrom', 
                      'searchDateTo', 'searchInvoiceType', 'searchContractCustomerId', 'searchViewedStatus'];
    searchFields.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            if (el.tagName === 'SELECT') {
                el.value = '';
            } else {
                el.value = '';
            }
        }
    });
    currentUser?.isGuest ? filterInvoicesByGuest(currentUser.taxNumber, currentUser.blNumber) : filterInvoicesByUser();
    clearSelectedInvoices();
    showNotification('تم إعادة ضبط البحث', 'info');
	setTimeout(() => { isSearching = false; }, 500);  // 👈 أضف هذا

};

// ============================================
// دوال عرض البيانات
// ============================================
function filterInvoicesByUser() {
    if (!invoicesData.length) { filteredInvoices = []; renderData(); return; }
    let temp = [...invoicesData];

    if (currentUser?.isGuest) return filterInvoicesByGuest(currentUser.taxNumber, currentUser.blNumber);

    if (currentUser && currentUser.userType !== 'admin' && !currentUser.isGuest) {
        // تجميع جميع المعرفات المرتبطة بالمستخدم
        let allowedIds = [];
        if (currentUser.contractCustomerId) allowedIds.push(currentUser.contractCustomerId);
        if (currentUser.customerIds && Array.isArray(currentUser.customerIds)) {
            allowedIds = allowedIds.concat(currentUser.customerIds);
        }
        // إزالة التكرار
        allowedIds = [...new Set(allowedIds)];

        if (allowedIds.length === 0) {
            // إذا لم توجد معرفات، لا نعرض شيئاً
            filteredInvoices = [];
            renderData();
            return;
        }

        temp = temp.filter(inv => {
            const payeeId = inv['payee-customer-id'] || '';
            const contractId = inv['contract-customer-id'] || '';
            // التحقق مما إذا كان أي من معرفات الفاتورة موجوداً في القائمة المسموحة
            return allowedIds.some(id => 
                payeeId.toLowerCase() === id.toLowerCase() || 
                contractId.toLowerCase() === id.toLowerCase()
            );
        });
    }

    // تصفية حسب نوع الفاتورة (نقدي/آجل)
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
    } else showNotification(`تم العثور على ${formatNumberWithCommas(filteredInvoices.length)} فاتورة`, 'success');
}

function renderData() {
    // تأكد من أن showInvoiceDetails معرفة
    if (typeof showInvoiceDetails !== 'function') {
        console.error('showInvoiceDetails is not defined!');
        return;
    }
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
// دوال عرض البطاقات
// ============================================
function renderCardsView(data) {
    let html = '<div class="cards-container">';
    data.forEach(inv => {
        const idx = invoicesData.indexOf(inv);
        if (idx === -1) {
            console.warn('فاتورة غير موجودة في invoicesData:', inv);
            return;
        }
        const voyageDate = inv['flex-date-02'] ? new Date(inv['flex-date-02']).toLocaleDateString('ar-EG') : 'غير محدد';
        const finalNum = inv['final-number'] || '';
        const invoiceTypeDisplay = finalNum.startsWith('P') || finalNum.startsWith('p') ? 'أجل' : 'نقدي';
        const currency = inv['currency'] || 'EGP';
        const exRate = inv['flex-string-06'] || 48.0215;
        const totalOriginal = inv['total-total'] || 0;
        let displayAmount, displayCurrency;
        if (currency === 'USAD') {
            displayAmount = (totalOriginal / exRate).toFixed(2);
            displayCurrency = 'USAD';
        } else {
            displayAmount = totalOriginal.toFixed(2);
            displayCurrency = 'EGP';
        }
        const formattedDisplayAmount = formatNumberWithCommas(displayAmount);
        html += `
            <div class="invoice-card" onclick="window.showInvoiceDetails(${idx})" style="cursor: pointer;">
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
                    <span class="card-total">${formattedDisplayAmount} ${displayCurrency}</span>
                </div>
            </div>`;
    });
    html += '</div>';
    document.getElementById('dataViewContainer').innerHTML = html;
}

function sortInvoices(invoices, field, order) {
    return [...invoices].sort((a, b) => {
        let va = a[field] || '';
        let vb = b[field] || '';
        
        // معالجة خاصة للرقم النهائي
        if (field === 'final-number') {
            const parsedA = parseFinalNumber(va);
            const parsedB = parseFinalNumber(vb);
            
            // مقارنة حسب:
            // 1. النوع (C أو P)
            // 2. السنة
            // 3. الرقم التسلسلي
            
            if (parsedA.type !== parsedB.type) {
                return order === 'asc' 
                    ? parsedA.type.localeCompare(parsedB.type)
                    : parsedB.type.localeCompare(parsedA.type);
            }
            
            if (parsedA.year !== parsedB.year) {
                return order === 'asc' 
                    ? parsedA.year - parsedB.year
                    : parsedB.year - parsedA.year;
            }
            
            return order === 'asc'
                ? parsedA.number - parsedB.number
                : parsedB.number - parsedA.number;
        }
        
        // للأنواع الرقمية الأخرى
        if (typeof va === 'number' && typeof vb === 'number') {
            return order === 'asc' ? va - vb : vb - va;
        }
        
        // للأنواع النصية الأخرى
        va = String(va).toLowerCase();
        vb = String(vb).toLowerCase();
        return order === 'asc' 
            ? va.localeCompare(vb, 'ar') 
            : vb.localeCompare(va, 'ar');
    });
}

window.toggleSortOrder = function() {
    sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    const icon = document.querySelector('#sortToggle i');
    if (icon) icon.className = sortOrder === 'asc' ? 'fas fa-sort-amount-down-alt' : 'fas fa-sort-amount-up-alt';
    clearSelectedInvoices();
    
    if (currentInvoiceType === INVOICE_TYPES.CREDIT) {
        currentCreditSortOrder = sortOrder;
        renderCreditData();
    } else {
        renderData();
    }
};

window.changeItemsPerPage = function() {
    const select = document.getElementById('itemsPerPage');
    const newValue = select.value === 'all' ? Infinity : parseInt(select.value);
    itemsPerPage = newValue;
    currentPage = 1;
    clearSelectedInvoices();
    
    if (currentInvoiceType === INVOICE_TYPES.CREDIT) {
        itemsPerPageCredit = newValue;
        currentCreditPage = 1;
        renderCreditData();
    } else {
        renderData();
    }
};

window.setViewMode = function(mode) {
    viewMode = mode;
    viewModeCredit = mode;
    
    clearSelectedInvoices();
    
    // ✅ تحديث الأزرار في شريط التحكم
    document.querySelectorAll('.card-header .tabs .tab').forEach((btn, i) => {
        if ((i === 0 && mode === 'table') || (i === 1 && mode === 'cards')) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    if (currentInvoiceType === INVOICE_TYPES.CREDIT) {
        renderCreditData();
    } else {
        renderData();
    }
};

window.toggleAdvancedSearch = function() {
    const body = document.getElementById('advancedSearchBody');
    const icon = document.getElementById('searchToggleIcon');
    if (body && icon) {
        if (body.classList.contains('show')) {
            body.classList.remove('show');
            body.style.display = 'none';
            icon.style.transform = 'rotate(0)';
        } else {
            body.classList.add('show');
            body.style.display = 'block';
            icon.style.transform = 'rotate(180deg)';
        }
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

    // ✅ استخدام optional chaining لتجنب الخطأ
    const invoiceCount = document.getElementById('invoiceCount');
    const totalSum = document.getElementById('totalSum');
    const taxSum = document.getElementById('taxSum');
    const totalUSDEl = document.getElementById('totalUSD');
    const totalEGPWithoutTaxEl = document.getElementById('totalEGPWithoutTax');
    const totalMartyrEl = document.getElementById('totalMartyr');
    const totalInvoicesHeader = document.getElementById('totalInvoicesHeader');
    const totalCustomers = document.getElementById('totalCustomers');
    const totalVessels = document.getElementById('totalVessels');
	
	 // ✅ أضف السطرين هنا 👇
    const totalCustomersTop = document.getElementById('totalCustomersTop');
    const totalVesselsTop = document.getElementById('totalVesselsTop');
    
    if (invoiceCount) invoiceCount.textContent = count;
    if (totalSum) totalSum.innerHTML = totalEGP.toFixed(2);
    if (taxSum) taxSum.innerHTML = taxEGP.toFixed(2);
    if (totalUSDEl) totalUSDEl.innerHTML = totalUSD.toFixed(2);
    if (totalEGPWithoutTaxEl) totalEGPWithoutTaxEl.innerHTML = totalEGPWithoutTax.toFixed(2);
    if (totalMartyrEl) totalMartyrEl.innerHTML = totalMartyr.toFixed(2);
    if (totalInvoicesHeader) totalInvoicesHeader.textContent = count;
    if (totalCustomers) totalCustomers.textContent = new Set(filteredInvoices.map(i => i['payee-customer-id'])).size;
    if (totalVessels) totalVessels.textContent = new Set(filteredInvoices.map(i => i['key-word1']).filter(v => v)).size;
	    // ✅ أضف السطرين هنا 👇
    if (totalCustomersTop) totalCustomersTop.textContent = new Set(filteredInvoices.map(i => i['payee-customer-id'])).size;
    if (totalVesselsTop) totalVesselsTop.textContent = new Set(filteredInvoices.map(i => i['key-word1']).filter(v => v)).size;
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
    console.log('handleRowClick called with index:', index);
    if (event.target.type === 'checkbox') return;
    window.showInvoiceDetails(index);
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

// ============================================
// دوال تجميع المصاريف للفواتير النقدية (العدد = عدد البنود)
// ============================================
function groupCashCharges(charges) {
    const sortedCharges = [...charges].sort((a, b) => (a['event-type-id'] || '').localeCompare(b['event-type-id'] || ''));
    const grouped = [], map = new Map();
    
    sortedCharges.forEach(c => {
        const key = `${c.description || ''}-${c['event-type-id'] || ''}-${c['storage-days'] || 1}`;
        const storageDays = c['storage-days'] || 1;
        
        if (map.has(key)) {
            const ex = map.get(key);
            // ✅ لخدمة EMER_STORAGE نجمع الكميات الأصلية، وإلا نضيف 1
            if (c['event-type-id'] === 'EMER_STORAGE') {
                ex.quantity += (c.quantity || 1);
            } else {
                ex.quantity += 1;
            }
            ex.amount += (c.amount || 0);
            if (c.containerNumbers?.length) {
                c.containerNumbers.forEach(cont => {
                    if (!ex.containerNumbers.includes(cont)) ex.containerNumbers.push(cont);
                });
            }
            if (c['event-performed-from'] || c['event-performed-to']) {
                ex.dates.push({
                    from: c['event-performed-from'] || '-',
                    to: c['event-performed-to'] || '-',
                    days: storageDays
                });
            }
        } else {
            // ✅ تحديد الكمية الابتدائية: للـ EMER_STORAGE نستخدم الكمية الأصلية، وإلا 1
            let initialQuantity = 1;
            if (c['event-type-id'] === 'EMER_STORAGE') {
                initialQuantity = c.quantity || 1;
            }
            
            const newC = {
                ...c,
                quantity: initialQuantity,
                containerNumbers: [...(c.containerNumbers || [])],
                totalStorageDays: storageDays,
                dates: []
            };
            if (c['event-performed-from'] || c['event-performed-to']) {
                newC.dates.push({
                    from: c['event-performed-from'] || '-',
                    to: c['event-performed-to'] || '-',
                    days: storageDays
                });
            }
            map.set(key, newC);
            grouped.push(newC);
        }
    });
    return grouped;
}

// ============================================
// دوال تجميع المصاريف للفواتير الآجلة (العدد = مجموع الكميات)
// ============================================
function groupPostponedCharges(charges) {
    const sortedCharges = [...charges].sort((a, b) => (a['event-type-id'] || '').localeCompare(b['event-type-id'] || ''));
    const grouped = [], map = new Map();
    sortedCharges.forEach(c => {
        const key = `${c.description || ''}-${c['event-type-id'] || ''}`;
        const storageDays = c['storage-days'] || 1;
        if (map.has(key)) {
            const ex = map.get(key);
            ex.quantity += c.quantity; // جمع الكميات الفعلية
            ex.totalStorageDays += storageDays;
            ex.amount += (c.amount || 0);
            if (c.containerNumbers?.length) c.containerNumbers.forEach(cont => { if (!ex.containerNumbers.includes(cont)) ex.containerNumbers.push(cont); });
            if (c['event-performed-from'] || c['event-performed-to']) ex.dates.push({ from: c['event-performed-from'] || '-', to: c['event-performed-to'] || '-', days: storageDays });
        } else {
            const newC = { ...c, containerNumbers: [...(c.containerNumbers || [])], totalStorageDays: storageDays, dates: [] };
            if (c['event-performed-from'] || c['event-performed-to']) newC.dates.push({ from: c['event-performed-from'] || '-', to: c['event-performed-to'] || '-', days: storageDays });
            map.set(key, newC);
            grouped.push(newC);
        }
    });
    return grouped;
}

// ============================================
// دوال تصدير الحاويات
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
        showNotification('لا توجد فاتورة للطباعة', 'error');
        return;
    }
    
    const inv = invoicesData[selectedInvoiceIndex];
    if (!inv) {
        showNotification('لا توجد بيانات للفاتورة', 'error');
        return;
    }
    const invoiceNumber = inv['final-number'] || 'فاتورة';
    
    const loading = document.createElement('div');
    loading.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#4361ee;color:white;padding:15px 30px;border-radius:8px;z-index:10000;';
    loading.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري إنشاء PDF...';
    document.body.appendChild(loading);
    
    try {
        // منع التفاف النص مؤقتاً
        element.classList.add('pdf-export-nowrap');
        await new Promise(r => setTimeout(r, 50));
        
        const fullCanvas = await html2canvas(element, {
            scale: 2.0,
            backgroundColor: '#ffffff',
            logging: false,
            useCORS: true,
            imageTimeout: 0,
            windowWidth: element.scrollWidth,
            windowHeight: element.scrollHeight
        });
        
        element.classList.remove('pdf-export-nowrap');
        
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
        const margin = 8;
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const contentWidth = pdfWidth - (margin * 2);
        const availableHeightMM = pdfHeight - (margin * 2);
        
        const imgWidth = fullCanvas.width;
        const imgHeight = fullCanvas.height;
        const scaleX = contentWidth / imgWidth;
        const pageHeightPx = availableHeightMM / scaleX;
        
        // عدد الصفحات المحسوب بدقة
        const totalPages = Math.ceil(imgHeight / pageHeightPx);
        
        showProgress(`تقسيم إلى ${totalPages} صفحات...`, 10);
        
        // تداخل 12 بكسل لتجنب قطع النص
        const overlapPx = 6;
        
        for (let i = 0; i < totalPages; i++) {
            if (i > 0) pdf.addPage();
            
            let startY = i * pageHeightPx;
            let endY = (i + 1) * pageHeightPx;
            
            // الصفحة الأخيرة تأخذ حتى نهاية الصورة
            if (i === totalPages - 1) {
                endY = imgHeight;
            }
            
            // نضيف تداخل في البداية (باستثناء الصفحة الأولى) لالتقاط الصف المقطوع
            if (i > 0) {
                startY = Math.max(0, startY - overlapPx);
            }
            // نضيف تداخل في النهاية (باستثناء الصفحة الأخيرة) لالتقاط الصف المقطوع في الأسفل
            if (i < totalPages - 1) {
                endY = Math.min(imgHeight, endY + overlapPx);
            }
            
            if (startY >= endY) continue;
            
            // قص الشريحة
            const sliceCanvas = document.createElement('canvas');
            sliceCanvas.width = imgWidth;
            sliceCanvas.height = endY - startY;
            const ctx = sliceCanvas.getContext('2d');
            ctx.drawImage(fullCanvas, 0, startY, imgWidth, sliceCanvas.height, 0, 0, sliceCanvas.width, sliceCanvas.height);
            
            const imgData = sliceCanvas.toDataURL('image/jpeg', 0.92);
            const sliceHeightMM = sliceCanvas.height * scaleX;
            pdf.addImage(imgData, 'JPEG', margin, margin, contentWidth, sliceHeightMM);
            
            showProgress(`صفحة ${i+1} من ${totalPages}`, Math.round(((i+1)/totalPages)*100));
        }
        
        pdf.save(`فاتورة-${invoiceNumber}.pdf`);
        showNotification(`تم التصدير (${totalPages} صفحات) بنجاح`, 'success');
        
    } catch (error) {
        console.error(error);
        showNotification('خطأ: ' + error.message, 'error');
    } finally {
        loading.remove();
        hideProgress();
    }
}

window.exportSingleInvoice = exportSingleInvoice;

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
	
	        // ✅ إغلاق نافذة الفاتورة بعد الانتهاء من التصدير
        closeModal();

}

window.exportInvoicePDF = function() {
    if (currentDisplayType === 'credit') {
        window.exportCreditNotePDF();
        return;
    }
    exportSingleInvoice();
};

// ============================================
// دوال الفاتورة والنموذج الفرعي - مع صورة الشعار المحسنة
// ============================================
window.showInvoiceDetails = function(index) {
    console.log('showInvoiceDetails called with index:', index);
    if (index < 0 || index >= invoicesData.length) {
        console.error('Index out of range!');
        return;
    }
    selectedInvoiceIndex = index;
	currentDisplayType = 'invoice';
    const inv = invoicesData[index];
    const finalNum = inv['final-number'] || '';
    const isPostponed = finalNum.startsWith('P') || finalNum.startsWith('p');
    const currency = inv['currency'] || 'EGP';
    
    // معالجة سعر الصرف - للفواتير الآجلة فقط
    let exRate = inv['flex-string-06'] || 48.0215;
    
    if (isPostponed) {
        // الفواتير الآجلة: نتحقق من صحة سعر الصرف
        const exRateAttr = inv['flex-string-06'];
        
        // إذا كان سعر الصرف غير صالح (N/A أو 0) والعملة EGP، نستخدم 1
        if ((exRateAttr === 'N/A' || exRateAttr === 0 || exRateAttr === '0' || !exRateAttr) && currency === 'EGP') {
            exRate = 1;
            console.log(`فاتورة آجلة ${finalNum}: لا يوجد سعر صرف صالح، عملة EGP → استخدام 1`);
        }
    }

// تعيين رقم الفاتورة مباشرة في عنوان النافذة (يتجنب مشكلة اختفاء span)
const modalTitle = document.getElementById('modalTitle');
if (modalTitle) {
    modalTitle.innerHTML = `فاتورة رقم: ${inv['final-number'] || 'غير محدد'}`;
} else {
    console.error('❌ العنصر modalTitle غير موجود في DOM');
    showNotification('خطأ في عرض الفاتورة', 'error');
    return;
}  
    // استخدام finalized-date بدلاً من created
    const invoiceDate = inv['finalized-date'] || inv['created'] || '';
    const formattedDate = invoiceDate ? new Date(invoiceDate).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' }) : 'غير محدد';
    
    const voyageDate = inv['flex-date-02'] ? new Date(inv['flex-date-02']).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' }) : 'غير محدد';
    
    // استخدام دوال التجميع حسب نوع الفاتورة
    const grouped = isPostponed ? groupPostponedCharges(inv.charges) : groupCashCharges(inv.charges);
    
    const invoiceTypeText = isPostponed ? 'آجل' : 'نقدي';
    
    // تعديل طابع الشهيد: يطبق فقط على الفواتير النقدية
    let martyr = 0;
    let showMartyr = false;
    
    if (!isPostponed) {
        // فقط للفواتير النقدية
        showMartyr = true;
        martyr = 5;
    }
    
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

        let displayStorageDays;
if (isPostponed) {
    if (charge['event-type-id'] === 'REEFER' || charge['event-type-id'] === 'STORAGE') {
        displayStorageDays = charge.totalStorageDays;
    } else {
        displayStorageDays = 1;
    }
} else {
    // ✅ للفواتير النقدية: نستخدم storageDays الأصلي (من أول عنصر في المجموعة)
    // لأن totalStorageDays قد يكون مجموع عدة بنود
    displayStorageDays = charge['storage-days'] || 1;
}

        if (isPostponed) {
            // التحقق مما إذا كانت الخدمة من نوع REEFER أو STORAGE
            const isReeferOrStorage = charge['event-type-id'] === 'REEFER' || charge['event-type-id'] === 'STORAGE';
            // إذا كانت REEFER/STORAGE، اعرض 1، وإلا اعرض الكمية المجمعة
            const displayQuantity = isReeferOrStorage ? 1 : (charge.quantity || 1);
            
            chargesRows += `<tr onclick="toggleContainers(${idx})" style="cursor: pointer;">
                <td>${charge.description || '-'}</td>
                <td>${charge['event-type-id'] || '-'}</td>
                <td><strong>${displayQuantity}</strong></td>
                <td>${displayStorageDays}</td>
                <td>${(charge['rate-billed'] || 0).toFixed(2)}</td>
                <td><strong>${formatNumberWithCommas(amountDisplay)}</strong></td>
                <td>${containerCount > 0 ? `<i id="icon-${idx}" class="fas fa-chevron-down"></i> <span style="font-size:0.8em;">${containerCount}</span>` : ''}</td>
            </tr>`;
                } else {
            // الفواتير النقدية
            const chargeDate = charge['paid-thru-day'] || charge['created'] || '';
            const formattedChargeDate = chargeDate ? new Date(chargeDate).toLocaleDateString('ar-EG') : '-';
            
            let quantityToShow = charge.quantity || 1;
            let storageDaysToShow = displayStorageDays;
            
            // ✅ فقط لخدمة EMER_STORAGE: نعرض الكمية الأصلية في أيام التخزين
            if (charge['event-type-id'] === 'EMER_STORAGE') {
                storageDaysToShow = charge.quantity || 1;  // الكمية الأصلية
                quantityToShow = 1;  // العدد يبقى 1
            }
            
            chargesRows += `<tr onclick="toggleContainers(${idx})" style="cursor: pointer;">
                <td>${charge.description || '-'}</td>
                <td>${charge['event-type-id'] || '-'}</td>
                <td>${quantityToShow}</td>
                <td>${storageDaysToShow}</td>
                <td>${(charge['rate-billed'] || 0).toFixed(2)}</td>
                <td><strong>${formatNumberWithCommas(amountDisplay)}</strong></td>
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

    // تعديل الملخص
    let summaryHtml = '';
    if (isPostponed) {
        // الفاتورة الآجلة: عرض بدون طابع الشهيد
        summaryHtml = `
            <div class="summary-box">
                <div class="summary-row"><span>إجمالي المصاريف:</span><span>${formatNumberWithCommas(totalChargesDisplay.toFixed(2))} ${displayCurrency}</span></div>
                <div class="summary-row"><span>إجمالي الضرائب:</span><span>${formatNumberWithCommas(totalTaxesDisplay.toFixed(2))} ${displayCurrency}</span></div>
                <div class="summary-row total"><span>الإجمالي النهائي:</span><span>${formatNumberWithCommas(displayTotal.toFixed(2))} ${displayCurrency}</span></div>
            </div>
        `;
    } else {
        // الفاتورة النقدية: عرض مع طابع الشهيد
        summaryHtml = `
            <div class="summary-box">
                <div class="summary-row"><span>إجمالي المصاريف:</span><span>${formatNumberWithCommas(totalChargesDisplay.toFixed(2))} ${displayCurrency}</span></div>
                <div class="summary-row"><span>إجمالي الضرائب:</span><span>${formatNumberWithCommas(totalTaxesDisplay.toFixed(2))} ${displayCurrency}</span></div>
                <div class="summary-row"><span>طابع الشهيد:</span><span>${formatNumberWithCommas(martyr.toFixed(2))} جنيه</span></div>
                <div class="summary-row total"><span>الإجمالي النهائي:</span><span>${formatNumberWithCommas(displayTotal.toFixed(2))} ${displayCurrency}</span></div>
            </div>
        `;
    }

    let exchangeRateRow = `<div class="info-row"><span>سعر الصرف:</span><span><strong>${exRate.toFixed(4)}</strong></span></div>`;

    // تحديث عناوين الجدول
    const tableHeaders = isPostponed ? 
        `<tr><th>الوصف</th><th>النوع</th><th>العدد / الكمية</th><th>أيام التخزين</th><th>سعر الوحدة</th><th>المبلغ/سعر الصرف</th><th></th></tr>` :
        `<tr><th>الوصف</th><th>النوع</th><th>العدد</th><th>أيام التخزين</th><th>سعر الوحدة</th><th>المبلغ/سعر الصرف</th><th>تاريخ الصرف</th><th></th></tr>`;

    // استايلات محسنة للطباعة مع تحسين الشعار
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
                    width: 80px !important;
                    height: 80px !important;
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
                font-size: 1.2em;
            }
            .company-logo-container {
                width: 80px;
                height: 80px;
                background: white;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                border: 3px solid #ffd700;
                overflow: hidden;
                padding: 0;
                box-shadow: 0 4px 10px rgba(0,0,0,0.2);
            }
            .company-logo-image {
                width: 100%;
                height: 100%;
                object-fit: cover;
                border-radius: 50%;
            }
        </style>
    `;

    // استخدام الشعار من Drive إذا تم تحميله، وإلا استخدام الأيقونة الافتراضية
    const logoSrc = companyLogoBase64 ? companyLogoBase64 : '';

    // تعديل عنوان الفاتورة مع الشعار المحسن
    let html = `
        <div class="invoice-container" id="invoicePrint" style="max-width: 1100px; margin: 0 auto; background: white; padding: 20px; border-radius: 12px; box-shadow: 0 5px 20px rgba(0,0,0,0.1);">
            ${printStyles}
            
            <div class="invoice-company-header" style="display: flex; align-items: center; justify-content: space-between; background: linear-gradient(135deg, #1e3c72, #2a5298); color: white; padding: 15px 20px; border-radius: 10px; margin-bottom: 15px;">
                <div style="display: flex; align-items: center; gap: 15px;">
                    <div class="company-logo-container" style="width: 80px; height: 80px; background: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid #ffd700; overflow: hidden; padding: 0; box-shadow: 0 4px 10px rgba(0,0,0,0.2);">
                        ${logoSrc ? 
                            `<img src="${logoSrc}" alt="DCHC Logo" class="company-logo-image" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">` : 
                            `<i class="fas fa-ship" style="font-size: 2.5em; color: #1e3c72;"></i>`
                        }
                    </div>
                    <div>
                        <h2 style="color: #ffd700; margin: 0 0 3px; font-size: 1.2em;">${COMPANY_INFO.name}</h2>
                        <p style="margin: 0 0 5px; opacity: 0.9; font-size: 0.8em;">${COMPANY_INFO.nameEn}</p>
                        <div style="display: flex; flex-wrap: wrap; gap: 10px; font-size: 0.7em;">
                            <span><i class="fas fa-map-marker-alt" style="color: #ffd700;"></i> ${COMPANY_INFO.address}</span>
                            <span><i class="fas fa-phone" style="color: #ffd700;"></i> ${COMPANY_INFO.phone}</span>
                            <span><i class="fas fa-building" style="color: #ffd700;"></i> ضريبي: ${COMPANY_INFO.taxNumber}</span>
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
    
    // إعادة تعيين أحداث الأزرار لضمان عملها بشكل صحيح
    setTimeout(() => {
        const closeBtn = document.querySelector('#invoiceModal .close-button');
        if (closeBtn) {
            closeBtn.onclick = function() { window.closeModal(); };
        }
        
        const prevBtn = document.querySelector('[onclick="navigateInvoice(\'prev\')"]');
        const nextBtn = document.querySelector('[onclick="navigateInvoice(\'next\')"]');
        
        if (prevBtn) {
            prevBtn.onclick = function() { 
                window.navigateInvoice('prev'); 
            };
        }
        if (nextBtn) {
            nextBtn.onclick = function() { 
                window.navigateInvoice('next'); 
            };
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
// دوال إضافية للتحكم في الأزرار - مع تعديل الطباعة
// ============================================
window.closeModal = function() {
    const modal = document.getElementById('invoiceModal');
    if (modal) modal.style.display = 'none';
};

window.navigateInvoice = function(direction) {
    if (selectedInvoiceIndex === -1) return;
    
    // الحصول على الفاتورة الحالية
    const currentInvoice = invoicesData[selectedInvoiceIndex];
    
    // ترتيب الفواتير المفلترة بنفس طريقة الترتيب في العرض
    const sortedFiltered = sortInvoices(filteredInvoices, currentSortField, sortOrder);
    
    // البحث عن الفهرس في القائمة المرتبة
    const currentSortedIndex = sortedFiltered.findIndex(inv => 
        inv['final-number'] === currentInvoice['final-number'] && 
        inv['draft-number'] === currentInvoice['draft-number']
    );
    
    if (currentSortedIndex === -1) return;
    
    // حساب الفهرس الجديد
    let newSortedIndex;
    if (direction === 'prev') {
        newSortedIndex = currentSortedIndex - 1;
    } else {
        newSortedIndex = currentSortedIndex + 1;
    }
    
    // التحقق من أن الفهرس الجديد ضمن الحدود
    if (newSortedIndex >= 0 && newSortedIndex < sortedFiltered.length) {
        // الحصول على الفاتورة المستهدفة من القائمة المرتبة
        const targetInvoice = sortedFiltered[newSortedIndex];
        
        // العثور على الفهرس الأصلي في invoicesData
        const newOriginalIndex = invoicesData.findIndex(inv => 
            inv['final-number'] === targetInvoice['final-number'] && 
            inv['draft-number'] === targetInvoice['draft-number']
        );
        
        if (newOriginalIndex !== -1) {
            showInvoiceDetails(newOriginalIndex);
        }
    } else {
        // إظهار رسالة مناسبة
        if (direction === 'prev') {
            showNotification('هذه أول فاتورة', 'info');
        } else {
            showNotification('هذه آخر فاتورة', 'info');
        }
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

// دالة الطباعة المعدلة
window.printInvoice = function() {
    if (currentDisplayType === 'credit') {
        printCreditNote();
        return;
    }
    // الكود الأصلي لطباعة الفاتورة
    const content = document.getElementById('invoicePrint');
    if (!content) return alert('لا توجد فاتورة للطباعة');
    
    const inv = invoicesData[selectedInvoiceIndex];
    const invoiceNumber = inv['final-number'] || '';
    const draftNumber = inv['draft-number'] || '';
    
    const printWindow = window.open('', '_blank', 'width=1200,height=800');
    const contentHTML = content.outerHTML;
    const qrContainerId = `qrcode-container-${invoiceNumber}`;
    
    // استايلات محسنة للطباعة
    const printStyles = `
        <style>
            @page { size: A4; margin: 0.5cm; }
            body { 
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
                padding: 0; 
                margin: 0; 
                background: white; 
                direction: rtl; 
                -webkit-print-color-adjust: exact; 
                print-color-adjust: exact; 
            }
            .invoice-container { 
                max-width: 100%; 
                margin: 0 auto; 
                background: white; 
                padding: 15px; 
            }
            .invoice-company-header { 
                display: flex; 
                align-items: center; 
                justify-content: space-between;
                background: linear-gradient(135deg, #1e3c72, #2a5298); 
                color: white; 
                padding: 15px 20px; 
                border-radius: 10px; 
                margin-bottom: 15px; 
            }
            .company-logo-container { 
                width: 80px; 
                height: 80px; 
                background: white; 
                border-radius: 50%; 
                display: flex; 
                align-items: center; 
                justify-content: center; 
                border: 3px solid #ffd700; 
                overflow: hidden; 
                padding: 0; 
                box-shadow: 0 4px 10px rgba(0,0,0,0.2);
            }
            .company-logo-image { 
                width: 100%; 
                height: 100%; 
                object-fit: cover; 
                border-radius: 50%; 
            }
            .invoice-header { 
                background: linear-gradient(135deg, #4361ee, #3f37c9); 
                color: white; 
                padding: 12px; 
                text-align: center; 
                border-radius: 8px; 
                margin-bottom: 15px; 
            }
            .invoice-info-grid { 
                display: grid; 
                grid-template-columns: repeat(3, 1fr); 
                gap: 12px; 
                margin-bottom: 15px; 
            }
            .info-box { 
                background: #f8f9fa; 
                padding: 12px; 
                border-radius: 8px; 
                border-right: 4px solid #4361ee; 
                font-size: 0.85em; 
            }
            .charges-table { 
                width: 100%; 
                border-collapse: collapse; 
                font-size: 0.8em; 
                background: white;
                border-radius: 8px;
                overflow: hidden;
                box-shadow: 0 2px 8px rgba(0,0,0,0.05);
            }
            .charges-table th { 
                background: #4361ee; 
                color: white; 
                padding: 8px 4px; 
                text-align: center;
            }
            .charges-table td { 
                padding: 6px 4px; 
                border-bottom: 1px solid #e9ecef; 
                text-align: center;
            }
            .summary-box { 
                width: 280px; 
                background: #f8f9fa; 
                padding: 12px; 
                border-radius: 8px; 
                font-size: 0.85em; 
            }
            .signature-section { 
                display: flex; 
                justify-content: space-around; 
                margin: 20px 0 15px; 
                padding: 10px 0; 
                border-top: 2px dashed #dee2e6; 
            }
            .invoice-footer { 
                text-align: center; 
                padding: 10px; 
                border-top: 2px solid #e9ecef; 
                color: #6c757d; 
                font-size: 0.75em; 
            }
            .invoice-number-bold, .invoice-date-bold { 
                font-weight: bold; 
                font-size: 1.1em; 
            }
            .containers-detail-table {
                width: 100%;
                border-collapse: collapse;
                background: white;
                border-radius: 8px;
                overflow: hidden;
                margin-top: 10px;
            }
            .containers-detail-table th {
                background: #4cc9f0;
                color: white;
                padding: 8px;
            }
            .containers-detail-table td {
                padding: 6px;
                border-bottom: 1px solid #e9ecef;
            }
        </style>
    `;
		

function printCreditNote() {
    if (!currentCreditSerial && !currentCreditData) {
        showNotification('لا توجد بيانات للطباعة', 'error');
        return;
    }
    
    const item = currentCreditData || creditData.find(d => d.serial == currentCreditSerial);
    if (!item) {
        showNotification('لا توجد بيانات للإشعار', 'error');
        return;
    }
    
    const printWindow = window.open('', '_blank', 'width=1100,height=800');
    const printHtml = generateCreditPrintHTML(item);
    
    printWindow.document.write(printHtml);
    printWindow.document.close();
    printWindow.focus();
    
    setTimeout(() => {
        printWindow.print();
    }, 500);
}


    // كتابة محتوى نافذة الطباعة مع تضمين مكتبة QR Code
    printWindow.document.write(`
        <html dir="rtl">
        <head>
            <title>طباعة الفاتورة - ${COMPANY_INFO.name}</title>
            <meta charset="UTF-8">
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
            <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.1/build/qrcode.min.js"></script>
            ${printStyles}
        </head>
        <body>
            ${contentHTML}
            <script>
                // انتظار تحميل الصفحة ثم إنشاء QR code
                setTimeout(function() {
                    try {
                        const container = document.getElementById('${qrContainerId}');
                        if (container) {
                            // مسح محتوى الحاوية
                            container.innerHTML = '';
                            
                            // إنشاء canvas جديد
                            const canvas = document.createElement('canvas');
                            canvas.id = 'qrcode-${invoiceNumber}';
                            canvas.style.width = '100%';
                            canvas.style.height = 'auto';
                            canvas.style.maxWidth = '100px';
                            container.appendChild(canvas);
                            
                            // إنشاء QR code
                            QRCode.toCanvas(canvas, '${COMPANY_INFO.baseUrl}?invoice=${encodeURIComponent(invoiceNumber)}${draftNumber ? '&draft=' + encodeURIComponent(draftNumber) : ''}', {
                                width: 100,
                                margin: 1,
                                color: { dark: '#000000', light: '#ffffff' },
                                errorCorrectionLevel: 'H'
                            }, function(error) {
                                if (error) {
                                    console.error('خطأ في إنشاء QR Code في الطباعة:', error);
                                    container.innerHTML = '<div style="color:red; font-size:0.8em;">خطأ</div>';
                                } else {
                                    console.log('✅ تم إنشاء QR Code في نافذة الطباعة');
                                    const caption = document.createElement('div');
                                    caption.style.fontSize = '0.6em';
                                    caption.style.marginTop = '2px';
                                    caption.style.color = '#666';
                                    caption.textContent = 'امسح للوصول';
                                    container.appendChild(caption);
                                }
                            });
                        }
                    } catch (e) {
                        console.error('خطأ في إنشاء QR code:', e);
                    }
                }, 500);
            <\/script>
        </body>
        </html>
    `);
    
    printWindow.document.close();
    printWindow.focus();
    
    // انتظار تحميل المحتوى ثم الطباعة
    setTimeout(() => {
        printWindow.print();
        // إغلاق النافذة بعد الطباعة (اختياري)
        // printWindow.close();
    }, 1000);
};

window.exportInvoiceExcel = function() {
     if (currentDisplayType === 'credit') {
        exportCreditNoteExcel();
        return;
    }
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
// دوال عرض الجدول مع Checkbox
// ============================================
function renderTableView(data) {
    if (!document.getElementById('table-style')) {
        const style = document.createElement('style');
        style.id = 'table-style';
        style.textContent = `
            .selected-row { background-color: #e3f2fd !important; border-left: 4px solid #2196f3; }
            .invoice-checkbox, #selectAllCheckbox { width: 18px; height: 18px; cursor: pointer; }
            .viewed-checkbox { width: 18px; height: 18px; cursor: pointer; }
            .viewed-cell { text-align: center; width: 50px; }
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
                    <button class="btn btn-secondary" onclick="exportSelectedReport()">
                        <i class="fas fa-file-invoice-dollar"></i> مطالبة تحصيل
                    </button>
                </div>
            </div>
            <table class="data-table">
                <thead>
                    <tr>
                        <th style="width:40px;"><input type="checkbox" onclick="toggleAllCheckboxes(this)" id="selectAllCheckbox"></th>
                        <th style="width:50px;">معاينة</th>
                        <th>الرقم النهائي</th>
                        <th>رقم المسودة</th>
                        <th>تاريخ الفاتورة</th>
                        <th>العميل</th>
                        <th>السفينة</th>
                        <th>${currentInvoiceType === INVOICE_TYPES.POSTPONED ? 'IB ID / OB ID' : 'رقم البوليصة'}</th>
                        <th>تاريخ الرحلة</th>
                        <th>الإجمالي (EGP)</th>
                        <th>المبلغ بالعملة</th>
                        <th>سداد</th>
                    </tr>
                </thead>
                <tbody>`;
    
    data.forEach(inv => {
        const idx = invoicesData.indexOf(inv);
        if (idx === -1) {
            console.warn('فاتورة غير موجودة في invoicesData:', inv);
            return;
        }
        const finalNum = inv['final-number'] || '';
        const draftNum = inv['draft-number'] || '';
        const invoiceTypeDisplay = finalNum.startsWith('P') || finalNum.startsWith('p') ? 'أجل' : 'نقدي';
        const currency = inv['currency'] || 'EGP';
        const exRate = inv['flex-string-06'] || 48.0215;
        const totalOriginal = inv['total-total'] || 0;
        let displayAmount, displayCurrency;
        if (currency === 'USAD') {
            displayAmount = (totalOriginal / exRate).toFixed(2);
            displayCurrency = 'USAD';
        } else {
            displayAmount = totalOriginal.toFixed(2);
            displayCurrency = 'EGP';
        }
        const isSelected = selectedInvoices.has(idx) ? 'checked' : '';
        const selectedClass = isSelected ? 'selected-row' : '';
        
        const viewKey = getInvoiceKey(inv);
        const isViewed = viewedInvoices.has(viewKey) ? 'checked' : '';
        
        const invoiceDateRaw = inv['finalized-date'] || inv['created'] || '';
        const invoiceDate = invoiceDateRaw ? new Date(invoiceDateRaw).toLocaleDateString('ar-EG') : '-';
        
        // ✅ تحضير حالة السداد
        const key = getInvoiceKey(inv);
        const customer = inv['payee-customer-id'] || inv['contract-customer-id'] || '';
        const paymentStatus = getInvoicePaymentStatus(key, customer);
        const remainingOriginal = Math.max(0, parseFloat(displayAmount) - paymentStatus.paid);
        const paymentCurrency = displayCurrency;
        
        let paymentCell = '';
			if (remainingOriginal <= 0.01 && !paymentStatus.hasRejected) {
				// ✅ تم السداد بالكامل
				paymentCell = `<span style="background:rgba(34,197,94,0.2); color:#22c55e; padding:6px 12px; border-radius:20px; font-size:0.75em; font-weight:700; white-space:nowrap;">
					<i class="fas fa-check-circle"></i> تم السداد
				</span>`;
			} else if (paymentStatus.hasRejected) {
				// ❌ سداد مرفوض - إعادة السداد
				const fullAmount = parseFloat(displayAmount);
				paymentCell = `<button class="pay-btn" style="background:rgba(239,68,68,0.2); color:#ef4444; border:1px solid rgba(239,68,68,0.3);" onclick="event.stopPropagation(); quickPayInvoice('${key}', '${customer}', ${fullAmount.toFixed(2)}, '${displayCurrency}')" title="سداد مرفوض - اضغط لإعادة السداد">
					<i class="fas fa-exclamation-triangle"></i> سداد مرفوض
				</button>`;
			} else if (paymentStatus.hasPending) {
				// ⏳ في انتظار الموافقة
				paymentCell = `<span style="background:rgba(245,158,11,0.2); color:#f59e0b; padding:6px 12px; border-radius:20px; font-size:0.75em; font-weight:700; white-space:nowrap;">
					<i class="fas fa-hourglass-half"></i> بالانتظار
				</span>`;
			} else if (paymentStatus.paid > 0) {
				// 🟡 سداد جزئي
				paymentCell = `<div style="text-align:center;">
					<button class="pay-btn" style="background:rgba(59,130,246,0.2); color:#3b82f6; border:1px solid rgba(59,130,246,0.3); margin-bottom:3px;" onclick="event.stopPropagation(); quickPayInvoice('${key}', '${customer}', ${remainingOriginal.toFixed(2)}, '${displayCurrency}')" title="سداد المتبقي">
						<i class="fas fa-money-bill-wave"></i> سداد جزئي
					</button>
					<div style="font-size:0.65em; color:var(--text-muted);">متبقي: ${formatNumberWithCommas(remainingOriginal.toFixed(2))} ${displayCurrency}</div>
				</div>`;
			} else {
				// 🔵 لم يسدد بعد
				paymentCell = `<button class="pay-btn" style="background:rgba(99,102,241,0.2); color:#818cf8; border:1px solid rgba(99,102,241,0.3);" onclick="event.stopPropagation(); quickPayInvoice('${key}', '${customer}', ${remainingOriginal.toFixed(2)}, '${displayCurrency}')" title="سداد">
					<i class="fas fa-money-bill-wave"></i> سداد
				</button>`;
			}
        
        html += `<tr onclick="window.handleRowClick(${idx}, event)" class="${selectedClass}" data-index="${idx}" data-key="${viewKey}">
            <td onclick="event.stopPropagation()"><input type="checkbox" class="invoice-checkbox" data-index="${idx}" ${isSelected} onchange="updateSelectedInvoices(${idx}, this.checked)"></td>
            <td class="viewed-cell" onclick="event.stopPropagation()">
                <input type="checkbox" class="viewed-checkbox" data-key="${viewKey}" ${isViewed} 
                       onchange="toggleInvoiceViewed('${viewKey}', this.checked, '${finalNum}', '${draftNum}')">
            </td>
            <td>${inv['final-number'] || '-'} (${invoiceTypeDisplay})</td>
            <td>${inv['draft-number'] || '-'}</td>
            <td>${invoiceDate}</td>
            <td>${(inv['payee-customer-id'] || '-').substring(0,20)}</td>
            <td>${inv['key-word1'] || '-'}</td>
            <td>${inv['key-word2'] || '-'}</td>
            <td>${inv['flex-date-02'] ? new Date(inv['flex-date-02']).toLocaleDateString('ar-EG') : '-'}</td>
            <td>${formatNumberWithCommas(totalOriginal.toFixed(2))}</td>
            <td>${formatNumberWithCommas(displayAmount)} ${displayCurrency}</td>
            <td>${paymentCell}</td>
        </tr>`;
    });
    
    html += '</tbody></table></div>';
    document.getElementById('dataViewContainer').innerHTML = html;
    updateSelectedCount();
}

// ============================================
// دوال نظام التقارير
// ============================================
window.showReports = function(type) {
    currentReportType = type;
	 updateSidebarActive('reports');
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
        <div class="report-stats">${[['عدد الأيام',sorted.length],['إجمالي الفواتير',filteredInvoices.length],['المتوسط اليومي',formatNumberWithCommas((totalAmount/(sorted.length||1)).toFixed(2))+' جنيه'],['إجمالي المبالغ',formatNumberWithCommas(totalAmount.toFixed(2))+' جنيه']].map(([l,v])=>`<div class="stat-item"><div class="stat-label">${l}</div><div class="stat-value">${v}</div></div>`).join('')}</div>`;
    html += '<h4>تفاصيل يومية</h4><table class="report-table"><thead><tr><th>التاريخ</th><th>عدد الفواتير</th><th>إجمالي المبالغ</th><th>الضرائب</th><th>المتوسط</th></tr></thead><tbody>';
    sorted.forEach(([date,data]) => html += `<tr><td>${date}</td><td>${data.count}</td><td>${formatNumberWithCommas(data.total.toFixed(2))}</td><td>${formatNumberWithCommas(data.taxes.toFixed(2))}</td><td>${formatNumberWithCommas((data.total/data.count).toFixed(2))}</td></tr>`);
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
        <div class="report-stats">${[['عدد الأشهر',sorted.length],['إجمالي الفواتير',filteredInvoices.length],['المتوسط الشهري',formatNumberWithCommas((totalAmount/(sorted.length||1)).toFixed(2))+' جنيه'],['إجمالي المبالغ',formatNumberWithCommas(totalAmount.toFixed(2))+' جنيه']].map(([l,v])=>`<div class="stat-item"><div class="stat-label">${l}</div><div class="stat-value">${v}</div></div>`).join('')}</div>`;
    html += '<table class="report-table"><thead><tr><th>الشهر</th><th>عدد الفواتير</th><th>إجمالي المبالغ</th><th>الضرائب</th><th>المتوسط</th></tr></thead><tbody>';
    sorted.forEach(([_,data]) => html += `<tr><td>${data.name}</td><td>${data.count}</td><td>${formatNumberWithCommas(data.total.toFixed(2))}</td><td>${formatNumberWithCommas(data.taxes.toFixed(2))}</td><td>${formatNumberWithCommas((data.total/data.count).toFixed(2))}</td></tr>`);
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
        <div class="report-stats">${[['عدد العملاء',sorted.length],['إجمالي الفواتير',filteredInvoices.length],['أعلى عميل',sorted.length?sorted[0][0].substring(0,20):'لا يوجد'],['إجمالي المبالغ',formatNumberWithCommas(totalAmount.toFixed(2))+' جنيه']].map(([l,v])=>`<div class="stat-item"><div class="stat-label">${l}</div><div class="stat-value">${v}</div></div>`).join('')}</div>`;
    html += '<table class="report-table"><thead><tr><th>العميل</th><th>عدد الفواتير</th><th>إجمالي المبالغ</th><th>الضرائب</th><th>المتوسط</th></tr></thead><tbody>';
    sorted.forEach(([customer,data]) => html += `<tr><td>${customer.substring(0,30)}</td><td>${data.count}</td><td>${formatNumberWithCommas(data.total.toFixed(2))}</td><td>${formatNumberWithCommas(data.taxes.toFixed(2))}</td><td>${formatNumberWithCommas((data.total/data.count).toFixed(2))}</td></tr>`);
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
        <div class="report-stats">${[['عدد السفن',sorted.length],['إجمالي الفواتير',filteredInvoices.length],['أكثر سفينة',sorted.length?sorted[0][0]:'لا يوجد'],['إجمالي المبالغ',formatNumberWithCommas(totalAmount.toFixed(2))+' جنيه']].map(([l,v])=>`<div class="stat-item"><div class="stat-label">${l}</div><div class="stat-value">${v}</div></div>`).join('')}</div>`;
    html += '<table class="report-table"><thead><tr><th>السفينة</th><th>عدد الفواتير</th><th>إجمالي المبالغ</th><th>الضرائب</th><th>المتوسط</th></tr></thead><tbody>';
    sorted.forEach(([vessel,data]) => html += `<tr><td>${vessel}</td><td>${data.count}</td><td>${formatNumberWithCommas(data.total.toFixed(2))}</td><td>${formatNumberWithCommas(data.taxes.toFixed(2))}</td><td>${formatNumberWithCommas((data.total/data.count).toFixed(2))}</td></tr>`);
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
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            
            // 🔧 تصحيح القيم القدئة لملف إشعارات الخصم
            if (parsed.creditFileName === 'credit_data.txt') {
                parsed.creditFileName = 'creditdata.txt';
                parsed.creditFileId = '1WU9R9Yby0_QoJeulIgYRuCQk9XV-N_e1';
                // حفظ التصحيح في localStorage
                localStorage.setItem('driveConfig', JSON.stringify(parsed));
            }
            // إذا كان المعرف فارغاً والاسم صحيحاً، ضع المعرف الافتراضي
            if (parsed.creditFileName === 'creditdata.txt' && !parsed.creditFileId) {
                parsed.creditFileId = '1WU9R9Yby0_QoJeulIgYRuCQk9XV-N_e1';
                localStorage.setItem('driveConfig', JSON.stringify(parsed));
            }
            
            driveConfig = { ...driveConfig, ...parsed };
        } catch(e) {
            console.error('خطأ في تحميل إعدادات Drive:', e);
        }
    }
    
    // تعبئة الحقول في نافذة الإعدادات إذا كانت مفتوحة (أو لأي استخدام لاحق)
    const fields = [
        'driveApiKey', 'driveFolderId', 'driveFileName', 'driveFileId',
        'driveUsersFileName', 'driveUsersFileId', 'logoFileId',
        'driveCreditFileName', 'driveCreditFileId'
    ];
    
    fields.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            // تحويل id مثل 'driveApiKey' إلى 'apiKey'
            let key = id.replace('drive', '');
            key = key.charAt(0).toLowerCase() + key.slice(1);
            let value = driveConfig[key] || '';
            el.value = value;
        }
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
        usersFileId: document.getElementById('driveUsersFileId').value.trim(),
        logoFileId: document.getElementById('logoFileId').value.trim() || '1DugYxs9a21e6J0ynTu6pE0yHXM2wRXSP',
        creditFileName: document.getElementById('driveCreditFileName').value.trim() || 'credit_data.txt',
        creditFileId: document.getElementById('driveCreditFileId').value.trim()
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
        let html = `<div style="margin-top:10px;max-height:300px;overflow-y:auto;">${files.length ? files.map(f => `<div style="padding:10px;margin:5px 0;background:#2d3748;border-radius:5px;border-right:3px solid #4cc9f0;"><div style="display:flex;justify-content:space-between"><div><strong style="color:#ffd700;">${f.name}</strong><div style="font-size:0.85em;color:#a0aec0;">معرف: ${f.id}<br>حجم: ${f.size ? (parseInt(f.size)/1024).toFixed(1) : '?'} KB | تاريخ: ${f.createdTime ? new Date(f.createdTime).toLocaleDateString('ar-EG') : ''}</div></div><div><button onclick="selectDataFile('${f.id}','${f.name}')" class="btn-small" style="background:#4361ee;">كملف بيانات</button><button onclick="selectUsersFile('${f.id}','${f.name}')" class="btn-small" style="background:#0F9D58;margin-right:5px;">كملف مستخدمين</button><button onclick="selectLogoFile('${f.id}','${f.name}')" class="btn-small" style="background:#ffd700; color: #333; margin-right:5px;">كشعار</button></div></div></div>`).join('') : '<p style="color:#a0aec0;">لا توجد ملفات</p>'}</div>`;
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

window.selectCreditFile = function(fileId, fileName) {
    if (!currentUser || currentUser.userType !== 'admin') return showNotification('غير مصرح', 'error');
    document.getElementById('driveCreditFileId').value = fileId;
    document.getElementById('driveCreditFileName').value = fileName;
    driveConfig.creditFileId = fileId;
    driveConfig.creditFileName = fileName;
    document.getElementById('driveTestResult').innerHTML = `✅ تم اختيار ملف إشعارات الخصم: <strong>${fileName}</strong><br>المعرف: ${fileId}`;
};

window.selectUsersFile = function(fileId, fileName) {
    if (!currentUser || currentUser.userType !== 'admin') return showNotification('غير مصرح', 'error');
    document.getElementById('driveUsersFileId').value = fileId;
    document.getElementById('driveUsersFileName').value = fileName;
    driveConfig.usersFileId = fileId; driveConfig.usersFileName = fileName;
    document.getElementById('driveTestResult').innerHTML = `✅ تم اختيار ملف المستخدمين: <strong>${fileName}</strong><br>المعرف: ${fileId}`;
};

window.selectLogoFile = function(fileId, fileName) {
    if (!currentUser || currentUser.userType !== 'admin') return showNotification('غير مصرح', 'error');
    document.getElementById('logoFileId').value = fileId;
    driveConfig.logoFileId = fileId;
    document.getElementById('driveTestResult').innerHTML = `✅ تم اختيار ملف الشعار: <strong>${fileName}</strong><br>المعرف: ${fileId}`;
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

async function loadCreditDataFromDrive() {
    if (!driveConfig.apiKey || !driveConfig.folderId) return false;
    let fileId = driveConfig.creditFileId;
    if (!fileId && driveConfig.creditFileName) {
        try {
            const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(`'${driveConfig.folderId}' in parents and name='${driveConfig.creditFileName}'`)}&key=${driveConfig.apiKey}&fields=files(id,name)`);
            if (!res.ok) throw new Error('فشل البحث عن ملف الخصم');
            const data = await res.json();
            if (!data.files?.length) return false;
            fileId = data.files[0].id;
            driveConfig.creditFileId = fileId;
            if (currentUser?.userType === 'admin') saveDriveSettingsToStorage();
        } catch { return false; }
    } else if (!fileId) return false;

    try {
        showProgress('جاري تحميل إشعارات الخصم...', 30);
        const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${driveConfig.apiKey}`);
        if (!res.ok) throw new Error('فشل تحميل ملف الخصم');
        const content = await res.text();
        showProgress('جاري تحليل البيانات...', 60);
        
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(content, "text/xml");
        const parseError = xmlDoc.querySelector('parsererror');
        let newCredits = [];

        if (parseError) {
            const matches = content.match(/<credit[\s\S]*?<\/credit>/g);
            if (!matches?.length) throw new Error('لا توجد إشعارات خصم');
            const wrapped = parser.parseFromString(`<root>${matches.join('')}</root>`, 'text/xml');
            const nodes = wrapped.querySelectorAll('credit');
            for (let i = 0; i < nodes.length; i++) {
                const credit = parseCreditNode(nodes[i]);
                if (credit) newCredits.push(credit);
            }
        } else {
            const nodes = xmlDoc.getElementsByTagName('credit');
            for (let i = 0; i < nodes.length; i++) {
                const credit = parseCreditNode(nodes[i]);
                if (credit) newCredits.push(credit);
            }
        }

        if (!newCredits.length) throw new Error('لا توجد إشعارات خصم صالحة');
        
        // ✅ حفظ البيانات وتطبيق التصفية
        creditData = newCredits;
        console.log('✅ loadCreditDataFromDrive: تم تحميل', creditData.length, 'إشعار خصم');
        showProgress('تم التحميل', 100);
        
        // تطبيق صلاحيات المستخدم على البيانات فوراً
        filterCreditData();
        
        return true;
        
    } catch (error) {
        console.error('❌ خطأ في loadCreditDataFromDrive:', error);
        showNotification(`❌ خطأ في تحميل إشعارات الخصم: ${error.message}`, 'error');
        return false;
    } finally {
        setTimeout(hideProgress, 1500);
    }
}

function parseCreditData(content) {
    console.log('بدء تحليل بيانات الخصم (XML)...');
    
    // أولاً: محاولة التحليل عبر DOMParser
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(content, "text/xml");
    const parseError = xmlDoc.querySelector('parsererror');
    let credits = [];
    
    if (!parseError) {
        // محاولة الحصول على credit بغض النظر عن النطاق
        // الطريقة: استخدام getElementsByTagName مع ignore namespace
        credits = xmlDoc.getElementsByTagName('credit');
        console.log('عدد credit عبر DOMParser:', credits.length);
        
        // إذا لم يجد، حاول البحث عن العناصر التي تنتهي بـ "credit" (لوجود نطاق)
        if (credits.length === 0) {
            const allElements = xmlDoc.getElementsByTagName('*');
            credits = Array.from(allElements).filter(el => el.tagName.endsWith('credit'));
            console.log('عدد credit عبر البحث عن *:', credits.length);
        }
    }
    
    // إذا لم يجد أي عنصر، استخدم regex
    if (credits.length === 0) {
        console.log('لم يتم العثور على credit عبر DOMParser، استخدام regex...');
        const matches = content.match(/<credit[\s\S]*?<\/credit>/g);
        if (!matches || matches.length === 0) {
            console.error('لا توجد عناصر credit في الملف');
            return [];
        }
        console.log('تم العثور على', matches.length, 'عنصر credit عبر regex');
        
        // إعادة تحليل كل عنصر على حدة
        const creditData = [];
        for (let i = 0; i < matches.length; i++) {
            const creditXml = matches[i];
            const creditDoc = parser.parseFromString(creditXml, "text/xml");
            const creditElement = creditDoc.documentElement;
            const parsed = parseCreditNode(creditElement);
            if (parsed) creditData.push(parsed);
        }
        return creditData;
    }
    
    // تحويل credits إلى مصفوفة وتطبيق parseCreditNode
    const creditData = [];
    for (let i = 0; i < credits.length; i++) {
        const creditElement = credits[i];
        const parsed = parseCreditNode(creditElement);
        if (parsed) creditData.push(parsed);
    }
    
    console.log('تم استخراج', creditData.length, 'إشعار خصم');
    return creditData;
}

function debugCreditData() {
    console.log('=== Debug Credit Data ===');
    console.log('creditData.length:', creditData.length);
    console.log('filteredCreditData.length:', filteredCreditData.length);
    console.log('currentCreditPage:', currentCreditPage);
    console.log('itemsPerPageCredit:', itemsPerPageCredit);
    console.log('viewModeCredit:', viewModeCredit);
    if (creditData.length > 0) {
        console.log('أول إشعار:', creditData[0]);
    }
}

function filterCreditData() {
    console.log('=== filterCreditData ===');
    if (!creditData.length) {
        filteredCreditData = [];
        renderCreditData();
        return;
    }
    
    // تطبيق تصفية حسب صلاحيات المستخدم
    let temp = filterCreditByUser(creditData);
    
    // تطبيق أي تصفية إضافية من البحث (إذا كانت هناك معايير بحث مخزنة)
    // سنقوم بتطبيقها داخل applyCreditSearch، لذا نكتفي بالتصفية الأساسية هنا
    filteredCreditData = temp;
    console.log('filteredCreditData.length بعد التصفية:', filteredCreditData.length);
    renderCreditData();
}

function renderCreditData() {
    console.log('=== renderCreditData ===');
    console.log('filteredCreditData.length:', filteredCreditData.length);
    if (filteredCreditData.length === 0) {
        document.getElementById('dataViewContainer').innerHTML = '<div class="no-data"><i class="fas fa-inbox fa-3x"></i><p>لا توجد إشعارات خصم</p></div>';
        updateCreditSummary();
        document.getElementById('pagination').innerHTML = '';
        return;
    }

    const sorted = sortCreditData(filteredCreditData, currentCreditSortField, currentCreditSortOrder);
    const totalPages = itemsPerPageCredit === Infinity ? 1 : Math.ceil(sorted.length / itemsPerPageCredit);
    const start = itemsPerPageCredit === Infinity ? 0 : (currentCreditPage - 1) * itemsPerPageCredit;
    const end = itemsPerPageCredit === Infinity ? sorted.length : Math.min(start + itemsPerPageCredit, sorted.length);
    const pageData = sorted.slice(start, end);

    console.log('عرض', pageData.length, 'إشعار من أصل', filteredCreditData.length);
    if (viewModeCredit === 'table') renderCreditTableView(pageData);
    else renderCreditCardsView(pageData);

    updateCreditSummary();
    renderCreditPagination(totalPages);
}

function sortCreditData(data, field, order) {
    return [...data].sort((a, b) => {
        let va = a[field] || '';
        let vb = b[field] || '';
        
        // إذا كان الحقل رقميًا
        if (typeof va === 'number' && typeof vb === 'number') {
            return order === 'asc' ? va - vb : vb - va;
        }
        
        // تحويل إلى نص للمقارنة النصية
        va = String(va).toLowerCase();
        vb = String(vb).toLowerCase();
        return order === 'asc' 
            ? va.localeCompare(vb, 'ar') 
            : vb.localeCompare(va, 'ar');
    });
}

function updateCreditSummary() {
    const count = filteredCreditData.length;
    let totalNet = 0;
    let totalTax = 0;
    let totalGross = 0;

    filteredCreditData.forEach(item => {
        totalNet += item.displayAmount;
        totalTax += item.displayTax;
        totalGross += (item.displayAmount + item.displayTax);
    });

    const invoiceCount = document.getElementById('invoiceCount');
    const totalSum = document.getElementById('totalSum');
    const taxSum = document.getElementById('taxSum');
    const totalUSDEl = document.getElementById('totalUSD');
    const totalEGPWithoutTaxEl = document.getElementById('totalEGPWithoutTax');
    const totalMartyrEl = document.getElementById('totalMartyr');
    const totalInvoicesHeader = document.getElementById('totalInvoicesHeader');
    const totalCustomers = document.getElementById('totalCustomers');
    const totalVessels = document.getElementById('totalVessels');

    if (invoiceCount) invoiceCount.textContent = count;
    if (totalSum) totalSum.innerHTML = totalNet.toFixed(2);
    if (taxSum) taxSum.innerHTML = totalTax.toFixed(2);
    if (totalUSDEl) totalUSDEl.innerHTML = totalGross.toFixed(2);
    if (totalEGPWithoutTaxEl) totalEGPWithoutTaxEl.innerHTML = '0.00';
    if (totalMartyrEl) totalMartyrEl.innerHTML = '0.00';
    if (totalInvoicesHeader) totalInvoicesHeader.textContent = count;
    if (totalCustomers) totalCustomers.textContent = new Set(filteredCreditData.map(i => i.customer)).size;
    if (totalVessels) totalVessels.textContent = '-';
}

function renderCreditCardsView(data) {
    let html = '<div class="cards-container">';
    data.forEach(item => {
        const net = item.displayAmount;                 // صافي إشعار الخصم
        const tax = item.displayTax;                    // إجمالي الضرائب
        const total = net + tax;                        // إجمالي الإشعار بعد الضريبة
        const currencySymbol = item.currency === 'USAD' ? 'USAD' : 'EGP';

        html += `
            <div class="invoice-card" onclick="showCreditDetails('${item.serial}')" style="cursor: pointer;">
                <div class="card-header">
                    <h3>إشعار خصم: ${item.finalNumber || item.draftNumber || '-'} 
                        ${item.draftNumber ? `<span style="font-size:0.7em;"> (مسودة: ${item.draftNumber})</span>` : ''}
                    </h3>
                    <span class="card-badge">خصم</span>
                </div>
                <div class="card-body">
                    <div class="card-row"><span class="card-label">العميل:</span><span class="card-value">${item.customer || '-'}</span></div>
                    <div class="card-row"><span class="card-label">رقم الفاتورة الأصلية:</span><span class="card-value">${item.invoiceFinalNumber || '-'}</span></div>
                    <div class="card-row"><span class="card-label">صافي إشعار الخصم:</span><span class="card-value">${formatNumberWithCommas(net.toFixed(2))} ${currencySymbol}</span></div>
                    <div class="card-row"><span class="card-label">إجمالي الضرائب:</span><span class="card-value">${formatNumberWithCommas(tax.toFixed(2))} ${currencySymbol}</span></div>
                    <div class="card-row"><span class="card-label">إجمالي الإشعار بعد الضريبة:</span><span class="card-value">${formatNumberWithCommas(total.toFixed(2))} ${currencySymbol}</span></div>
                    <div class="card-row"><span class="card-label">سعر الصرف:</span><span class="card-value">${item.exchangeRate.toFixed(4)}</span></div>
                    <div class="card-row"><span class="card-label">التاريخ:</span><span class="card-value">${item.date || '-'}</span></div>
                    ${item.notes ? `<div class="card-row"><span class="card-label">ملاحظات:</span><span class="card-value">${item.notes}</span></div>` : ''}
                </div>
            </div>`;
    });
    html += '</div>';
    document.getElementById('dataViewContainer').innerHTML = html;
}

function renderCreditTableView(data) {
    let html = `
        <div class="table-container">
            <div class="table-toolbar" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; padding:10px; background:#f8f9fa; border-radius:8px; flex-wrap: wrap; gap: 10px;">
                <div>
                    <button class="btn btn-secondary" onclick="selectAllCredit()" style="margin-left:10px;"><i class="fas fa-check-double"></i> تحديد الكل</button>
                    <button class="btn btn-secondary" onclick="deselectAllCredit()"><i class="fas fa-times"></i> إلغاء الكل</button>
                </div>
                <div class="export-buttons">
                    <span id="selectedCreditCount" style="margin-left:15px; font-weight:bold;">0</span> إشعار محدد
                    <button class="btn btn-primary" onclick="exportSelectedCreditPDF()" id="exportSelectedCreditPDFBtn" disabled><i class="fas fa-file-pdf"></i> PDF</button>
                    <button class="btn btn-success" onclick="exportSelectedCreditExcel()" id="exportSelectedCreditExcelBtn" disabled><i class="fas fa-file-excel"></i> Excel</button>
                </div>
            </div>
            <table class="data-table">
                <thead>
                    <tr>
                        <th style="width:40px;"><input type="checkbox" onclick="toggleAllCreditCheckboxes(this)" id="selectAllCreditCheckbox"></th>
                        <th style="width:50px;">معاينة</th>
                        <th>رقم الإشعار</th>
                        <th>رقم المسودة</th>
                        <th>رقم الفاتورة الأصلية</th>
                        <th>العميل</th>
                        <th>صافي إشعار الخصم</th>
                        <th>إجمالي الضرائب</th>
                        <th>إجمالي الإشعار بعد الضريبة</th>
                        <th>العملة</th>
                        <th>سعر الصرف</th>
                        <th>التاريخ</th>
                        <th>ملاحظات</th>
                    </tr>
                </thead>
                <tbody>`;

    data.forEach(item => {
        const net = item.displayAmount;
        const tax = item.displayTax;
        const total = net + tax;
        const currencySymbol = item.currency === 'USAD' ? 'USAD' : 'EGP';
        const isSelected = selectedCreditNotes.has(item.serial);
        const selectedClass = isSelected ? 'selected-row' : '';

        const viewKey = 'credit_' + (item.serial || item.draftNumber || item.finalNumber);
        const isViewed = viewedInvoices.has(viewKey) ? 'checked' : '';

        html += `<tr onclick="showCreditDetails('${item.serial}')" class="${selectedClass}" data-serial="${item.serial}" style="cursor: pointer;">
            <td onclick="event.stopPropagation()"><input type="checkbox" class="credit-checkbox" data-serial="${item.serial}" ${isSelected ? 'checked' : ''} onchange="updateSelectedCredit('${item.serial}', this.checked)"></td>
            <td class="viewed-cell" onclick="event.stopPropagation()">
                <input type="checkbox" class="viewed-checkbox" data-key="${viewKey}" ${isViewed} 
                       onchange="toggleInvoiceViewed('${viewKey}', this.checked)">
            </td>
            <td>${item.finalNumber || '-'}${item.draftNumber ? `<br><small>مسودة: ${item.draftNumber}</small>` : ''}</td>
            <td>${item.draftNumber || '-'}</td>
            <td>${item.invoiceFinalNumber || '-'}</td>
            <td>${item.customer || '-'}</td>
            <td>${formatNumberWithCommas(net.toFixed(2))}</td>
            <td>${formatNumberWithCommas(tax.toFixed(2))}</td>
            <td>${formatNumberWithCommas(total.toFixed(2))}</td>
            <td>${currencySymbol}</td>
            <td>${item.exchangeRate.toFixed(4)}</td>
            <td>${item.date || '-'}</td>
            <td>${item.notes || '-'}</td>
        </tr>`;
    });

    html += `</tbody></table></div>`;
    document.getElementById('dataViewContainer').innerHTML = html;
    updateSelectedCreditCount();
}

function updateSelectedCreditCount() {
    const count = selectedCreditNotes.size;
    const countSpan = document.getElementById('selectedCreditCount');
    const pdfBtn = document.getElementById('exportSelectedCreditPDFBtn');
    const excelBtn = document.getElementById('exportSelectedCreditExcelBtn');
    if (countSpan) countSpan.textContent = count;
    if (pdfBtn) pdfBtn.disabled = count === 0;
    if (excelBtn) excelBtn.disabled = count === 0;
}

function updateSelectedCredit(serial, isSelected) {
    if (isSelected) selectedCreditNotes.add(serial);
    else selectedCreditNotes.delete(serial);
    updateSelectedCreditCount();
    
    // تحديث حالة الصف
    const row = document.querySelector(`tr[data-serial="${serial}"]`);
    if (row) row.classList.toggle('selected-row', isSelected);
    
    // تحديث checkbox الرئيسي (تحديد الكل)
    const allCheckboxes = document.querySelectorAll('.credit-checkbox');
    const selectAll = document.getElementById('selectAllCreditCheckbox');
    if (selectAll) {
        const allChecked = Array.from(allCheckboxes).every(cb => cb.checked);
        selectAll.checked = allChecked;
        selectAll.indeterminate = !allChecked && Array.from(allCheckboxes).some(cb => cb.checked);
    }
}

function selectAllCredit() {
    document.querySelectorAll('.credit-checkbox').forEach(cb => {
        cb.checked = true;
        const serial = cb.dataset.serial;
        selectedCreditNotes.add(serial);
        const row = document.querySelector(`tr[data-serial="${serial}"]`);
        if (row) row.classList.add('selected-row');
    });
    updateSelectedCreditCount();
    const selectAll = document.getElementById('selectAllCreditCheckbox');
    if (selectAll) selectAll.checked = true;
}

function deselectAllCredit() {
    document.querySelectorAll('.credit-checkbox').forEach(cb => {
        cb.checked = false;
        const serial = cb.dataset.serial;
        selectedCreditNotes.delete(serial);
        const row = document.querySelector(`tr[data-serial="${serial}"]`);
        if (row) row.classList.remove('selected-row');
    });
    updateSelectedCreditCount();
    const selectAll = document.getElementById('selectAllCreditCheckbox');
    if (selectAll) selectAll.checked = false;
}


function changeCreditPage(page) {
    const totalPages = itemsPerPageCredit === Infinity ? 1 : Math.ceil(filteredCreditData.length / itemsPerPageCredit);
    if (page >= 1 && page <= totalPages) {
        currentCreditPage = page;
        renderCreditData();
    }
}

function showCreditDetails(serial) {
    const item = creditData.find(d => d.serial == serial);
    if (!item) return;
    
    // التحقق من صلاحية المستخدم
    const allowed = filterCreditByUser([item]);
    if (allowed.length === 0) {
        showNotification('غير مصرح لك بعرض هذا الإشعار', 'error');
        return;
    }
    
    currentDisplayType = 'credit';
    currentCreditData = item;
    currentCreditSerial = serial;
    // ... باقي الكود

		currentDisplayType = 'credit';
		currentCreditData = item;
		currentCreditSerial = serial;
    const net = item.displayAmount;
    const tax = item.displayTax;
    const total = net + tax;
    const currencySymbol = item.currency === 'USAD' ? 'USAD' : 'EGP';
    const logoSrc = companyLogoBase64 ? companyLogoBase64 : '';

    // جدول البنود بدون عمود "رقم الفاتورة الأصلية"
    let itemsHtml = '';
    if (item.items && item.items.length > 0) {
        itemsHtml = `
            <div style="margin: 15px 0;">
                <h4 style="color: #f72585;">تفاصيل البنود:</h4>
                <table class="charges-table" style="width:100%; font-size:0.85em;">
                    <thead>
                        <tr>
                            <th>الكمية</th>
                            <th>السعر</th>
                            <th>المبلغ بعد سعر الصرف</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${item.items.map(i => `
                            <tr>
                                <td>${i.quantity}</td>
                                <td>${i.rateCredited.toFixed(2)}</td>
                                <td>${formatNumberWithCommas(i.displayAmount.toFixed(2))} ${currencySymbol}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    // بقية الكود كما هو مع التأكد من وجود رقم الفاتورة الأصلية في بيانات الفاتورة
    const html = `
        <div class="invoice-container" id="creditPrint" style="max-width: 1100px; margin: 0 auto; background: white; padding: 20px; border-radius: 12px; box-shadow: 0 5px 20px rgba(0,0,0,0.1);">
            <style>
                /* نفس الاستايلات السابقة */
                .credit-detail-header { background: linear-gradient(135deg, #1e3c72, #2a5298); color: white; padding: 15px 20px; border-radius: 10px; margin-bottom: 15px; display: flex; align-items: center; justify-content: space-between; }
                .credit-detail-title { background: linear-gradient(135deg, #f72585, #b5179e); color: white; padding: 12px; text-align: center; border-radius: 8px; margin-bottom: 15px; }
                .credit-detail-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 15px; }
                .credit-info-box { background: #f8f9fa; padding: 12px; border-radius: 8px; border-right: 4px solid #f72585; }
                .credit-summary-box { width: 320px; background: #f8f9fa; padding: 12px; border-radius: 8px; margin-right: auto; }
                .credit-summary-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #dee2e6; }
                .credit-summary-row.total { border-bottom: none; font-weight: bold; color: #f72585; font-size: 1.1em; }
                .company-logo-container { width: 70px; height: 70px; background: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid #ffd700; overflow: hidden; }
                .company-logo-image { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
                .notes-box { margin: 15px 0; padding: 10px; background: #fff3cd; border-right: 4px solid #ffc107; border-radius: 5px; }
            </style>
            
            <div class="credit-detail-header">
                <div style="display: flex; align-items: center; gap: 15px;">
                    <div class="company-logo-container">
                        ${logoSrc ? `<img src="${logoSrc}" alt="DCHC Logo" class="company-logo-image">` : '<i class="fas fa-ship" style="font-size: 2em; color: #1e3c72;"></i>'}
                    </div>
                    <div>
                        <h2 style="color: #ffd700; margin: 0;">${COMPANY_INFO.name}</h2>
                        <p style="margin: 3px 0; font-size: 0.8em;">${COMPANY_INFO.nameEn}</p>
                    </div>
                </div>
            </div>
            
            <div class="credit-detail-title">
                <h2 style="font-size: 1.2em; margin: 0;">
                    إشعار خصم: ${item.finalNumber || item.draftNumber || '-'}
                    ${item.draftNumber ? `<span style="font-size:0.7em;"> (مسودة: ${item.draftNumber})</span>` : ''}
                </h2>
                <p style="margin: 5px 0 0; font-size: 0.9em;">التاريخ: ${item.date || 'غير محدد'}</p>
            </div>
            
            <div class="credit-detail-grid">
                <div class="credit-info-box">
                    <h4 style="color: #f72585; margin-bottom: 8px;"><i class="fas fa-user"></i> بيانات العميل</h4>
                    <div><strong>الاسم:</strong> ${item.customer || '-'}</div>
                    <div><strong>الرقم الضريبي:</strong> ${item.customerId || '-'}</div>
                </div>
                <div class="credit-info-box">
                    <h4 style="color: #f72585; margin-bottom: 8px;"><i class="fas fa-file-invoice"></i> بيانات الفاتورة</h4>
                    <div><strong>رقم الفاتورة الأصلية:</strong> ${item.invoiceFinalNumber || '-'}</div>
                    <div><strong>رقم المسودة:</strong> ${item.draftNumber || '-'}</div>
                    <div><strong>رقم الإشعار النهائي:</strong> ${item.finalNumber || '-'}</div>
                </div>
                <div class="credit-info-box">
                    <h4 style="color: #f72585; margin-bottom: 8px;"><i class="fas fa-coins"></i> المبالغ</h4>
                    <div><strong>العملة:</strong> ${currencySymbol}</div>
                    <div><strong>سعر الصرف:</strong> ${item.exchangeRate.toFixed(4)}</div>
                    <div><strong>الحالة:</strong> ${item.status || '-'}</div>
                </div>
            </div>
            
            ${itemsHtml}
            
            <div style="display: flex; justify-content: flex-end; margin: 20px 0;">
                <div class="credit-summary-box">
                    <div class="credit-summary-row">
                        <span>صافي إشعار الخصم:</span>
                        <span>${formatNumberWithCommas(net.toFixed(2))} ${currencySymbol}</span>
                    </div>
                    <div class="credit-summary-row">
                        <span>إجمالي الضرائب:</span>
                        <span>${formatNumberWithCommas(tax.toFixed(2))} ${currencySymbol}</span>
                    </div>
                    <div class="credit-summary-row total">
                        <span>إجمالي إشعار الخصم بعد الضريبة:</span>
                        <span>${formatNumberWithCommas(total.toFixed(2))} ${currencySymbol}</span>
                    </div>
                </div>
            </div>
            
            ${item.notes ? `<div class="notes-box"><strong>ملاحظات:</strong> ${item.notes}</div>` : ''}
            
            <div class="signature-section" style="display: flex; justify-content: space-around; margin: 20px 0 15px; padding: 10px 0; border-top: 2px dashed #dee2e6;">
                <div style="text-align: center;">
                    <div style="color: #f72585; font-weight: bold;">معد الإشعار</div>
                    <div>${item.preparedBy || 'النظام'}</div>
                    <div style="font-size: 0.7em;">${new Date().toLocaleDateString('ar-EG')}</div>
                </div>
                <div style="text-align: center;">
                    <div style="color: #f72585; font-weight: bold;">المراجع</div>
                    <div>${item.reviewedBy || 'النظام'}</div>
                </div>
                <div style="text-align: center;">
                    <div style="color: #f72585; font-weight: bold;">الختم</div>
                    <div style="font-size: 2em; opacity: 0.5;"><i class="fas fa-certificate"></i></div>
                </div>
            </div>
            
            <div class="invoice-footer" style="text-align: center; padding: 10px; border-top: 2px solid #e9ecef; color: #6c757d; font-size: 0.7em;">
                <p>شكراً لتعاملكم مع ${COMPANY_INFO.name}</p>
                <p>تم إنشاء هذا الإشعار إلكترونياً</p>
                <p>تاريخ الطباعة: ${new Date().toLocaleDateString('ar-EG')}</p>
            </div>
        </div>
    `;

    document.getElementById('modalBody').innerHTML = html;
    document.getElementById('modalTitle').innerHTML = `إشعار خصم: ${item.finalNumber || item.draftNumber || item.serial}`;
    document.getElementById('invoiceModal').style.display = 'block';
}

function exportSelectedCreditExcel() {
    if (selectedCreditNotes.size === 0) {
        showNotification('لم يتم تحديد أي إشعارات', 'warning');
        return;
    }
    
    const allSelected = creditData.filter(item => selectedCreditNotes.has(item.serial));
    const allowedItems = filterCreditByUser(allSelected);
    
    if (allowedItems.length === 0) {
        showNotification('لا توجد إشعارات مصرح بها للتصدير', 'error');
        return;
    }
    
    const excelData = [
        ['إشعارات الخصم المحددة'],
        ['تاريخ التقرير: ' + new Date().toLocaleDateString('ar-EG')],
        [],
        ['رقم الإشعار', 'رقم المسودة', 'رقم الفاتورة الأصلية', 'العميل', 'صافي إشعار الخصم', 'إجمالي الضرائب', 'إجمالي الإشعار بعد الضريبة', 'العملة', 'سعر الصرف', 'التاريخ', 'الحالة', 'ملاحظات']
    ];

    allowedItems.forEach(item => {
        const net = item.displayAmount;
        const tax = item.displayTax;
        const total = net + tax;
        const currencySymbol = item.currency === 'USAD' ? 'USAD' : 'EGP';

        excelData.push([
            item.finalNumber || '',
            item.draftNumber || '',
            item.invoiceFinalNumber || '',
            item.customer || '',
            net.toFixed(2),
            tax.toFixed(2),
            total.toFixed(2),
            currencySymbol,
            item.exchangeRate.toFixed(4),
            item.date || '',
            item.status || '',
            item.notes || ''
        ]);
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(excelData);
    ws['!cols'] = [{ wch: 18 }, { wch: 15 }, { wch: 18 }, { wch: 30 }, { wch: 18 }, { wch: 18 }, { wch: 22 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 25 }];
    XLSX.utils.book_append_sheet(wb, ws, 'إشعارات الخصم');

    const fileName = `إشعارات_خصم_${new Date().toLocaleDateString('ar-EG').replace(/\//g, '-')}.xlsx`;
    XLSX.writeFile(wb, fileName);
    showNotification(`تم تصدير ${allowedItems.length} إشعار بنجاح`, 'success');
}

async function exportSelectedCreditPDF() {
    if (selectedCreditNotes.size === 0) {
        showNotification('لم يتم تحديد أي إشعارات', 'warning');
        return;
    }

    const selectedItems = creditData.filter(item => selectedCreditNotes.has(item.serial));
    const allowedItems = filterCreditByUser(selectedItems);
    
    if (allowedItems.length === 0) {
        showNotification('لا توجد إشعارات مصرح بها للتصدير', 'error');
        return;
    }
    
    // التحقق من وجود المكتبات المطلوبة
    if (typeof window.jspdf === 'undefined' || typeof window.html2canvas === 'undefined') {
        showNotification('جاري تحميل مكتبات PDF...', 'info');
        return;
    }

    showProgress(`جاري تجهيز ${allowedItems.length} إشعار...`, 10);

    try {
        const { jsPDF } = window.jspdf;
        
        // إنشاء PDF جديد
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4',
            compress: true
        });

        let currentPage = 0;

        for (let i = 0; i < allowedItems.length; i++) {
            const item = allowedItems[i];
            
            showProgress(`جاري تجهيز الإشعار ${i + 1} من ${allowedItems.length}...`, Math.round((i / allowedItems.length) * 100));
            
            // ✅ إنشاء HTML كامل للإشعار (بدون استخدام iframe)
            const printHtml = generateCreditPrintHTML(item);
            
            // ✅ إنشاء عنصر مؤقت في الذاكرة (ليس في DOM المرئي)
            const tempContainer = document.createElement('div');
            tempContainer.style.position = 'absolute';
            tempContainer.style.left = '-9999px';
            tempContainer.style.top = '-9999px';
            tempContainer.style.width = '1100px';
            tempContainer.style.backgroundColor = '#ffffff';
            tempContainer.style.padding = '20px';
            tempContainer.style.direction = 'rtl';
            tempContainer.innerHTML = printHtml;
            
            // إضافة العنصر إلى DOM (مؤقتاً)
            document.body.appendChild(tempContainer);
            
            // ✅ انتظار تحميل العنصر بالكامل
            await new Promise(resolve => setTimeout(resolve, 300));
            
            try {
                // ✅ تحويل العنصر إلى Canvas
                const canvas = await html2canvas(tempContainer, {
                    scale: 1.5,
                    backgroundColor: '#ffffff',
                    logging: false,
                    useCORS: true,
                    allowTaint: false,
                    imageTimeout: 0,
                    windowWidth: tempContainer.scrollWidth,
                    windowHeight: tempContainer.scrollHeight
                });
                
                // إضافة صفحة جديدة إذا لم تكن الصفحة الأولى
                if (currentPage > 0) {
                    pdf.addPage();
                }
                
                // إضافة الصورة إلى PDF
                const imgData = canvas.toDataURL('image/jpeg', 0.85);
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
                
                pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
                currentPage++;
                
            } catch (err) {
                console.error('خطأ في تصدير الإشعار:', err);
                showNotification(`خطأ في تصدير الإشعار ${item.serial}: ${err.message}`, 'error');
            } finally {
                // ✅ إزالة العنصر المؤقت من DOM
                if (tempContainer && tempContainer.parentNode) {
                    document.body.removeChild(tempContainer);
                }
            }
        }
        
        showProgress('جاري حفظ الملف...', 100);
        
        // تحديد اسم الملف
        let fileName;
        if (allowedItems.length === 1) {
            fileName = `إشعار_خصم_${allowedItems[0].serial}.pdf`;
        } else {
            fileName = `إشعارات_خصم_${new Date().toLocaleDateString('ar-EG').replace(/\//g, '-')}.pdf`;
        }
        
        // حفظ PDF
        pdf.save(fileName);
        showNotification(`تم تصدير ${allowedItems.length} إشعار بنجاح`, 'success');
        
    } catch (error) {
        console.error('خطأ في تصدير PDF:', error);
        showNotification('حدث خطأ في تصدير PDF: ' + error.message, 'error');
    } finally {
        setTimeout(hideProgress, 1500);
    }
}

function toggleAllCreditCheckboxes(selectAllCheckbox) {
    document.querySelectorAll('.credit-checkbox').forEach(cb => {
        cb.checked = selectAllCheckbox.checked;
        const serial = cb.dataset.serial;
        if (selectAllCheckbox.checked) selectedCreditNotes.add(serial);
        else selectedCreditNotes.delete(serial);
        const row = document.querySelector(`tr[data-serial="${serial}"]`);
        if (row) row.classList.toggle('selected-row', selectAllCheckbox.checked);
    });
    updateSelectedCreditCount();
}

function renderCreditPagination(totalPages) {
    if (itemsPerPageCredit === Infinity || totalPages <= 1) {
        document.getElementById('pagination').innerHTML = '';
        return;
    }
    
    let html = `<button class="pagination-btn" onclick="changeCreditPage(${currentCreditPage - 1})" ${currentCreditPage === 1 ? 'disabled' : ''}>
                    <i class="fas fa-chevron-right"></i>
                </button>`;
    
    const maxPages = 5;
    let start = Math.max(1, currentCreditPage - Math.floor(maxPages / 2));
    let end = Math.min(totalPages, start + maxPages - 1);
    
    if (end - start + 1 < maxPages) start = Math.max(1, end - maxPages + 1);
    
    if (start > 1) {
        html += `<button class="pagination-btn" onclick="changeCreditPage(1)">1</button>`;
        if (start > 2) html += `<span class="pagination-btn disabled">...</span>`;
    }
    
    for (let i = start; i <= end; i++) {
        html += `<button class="pagination-btn ${i === currentCreditPage ? 'active' : ''}" onclick="changeCreditPage(${i})">${i}</button>`;
    }
    
    if (end < totalPages) {
        if (end < totalPages - 1) html += `<span class="pagination-btn disabled">...</span>`;
        html += `<button class="pagination-btn" onclick="changeCreditPage(${totalPages})">${totalPages}</button>`;
    }
    
    html += `<button class="pagination-btn" onclick="changeCreditPage(${currentCreditPage + 1})" ${currentCreditPage === totalPages ? 'disabled' : ''}>
                <i class="fas fa-chevron-left"></i>
            </button>`;
    
    document.getElementById('pagination').innerHTML = html;
}

function filterCreditByUser(creditArray) {
    if (!creditArray.length) return [];
    
    // المدير يرى كل الإشعارات
    if (currentUser && currentUser.userType === 'admin') {
        return [...creditArray];
    }
    
    // المحاسب الحقيقي (بدون معرفات عميل) يرى كل الإشعارات
    // ولكن إذا كان المحاسب لديه معرفات عميل، فيُعامل كعميل
    if (currentUser && currentUser.userType === 'accountant') {
        // التحقق مما إذا كان للمحاسب معرفات عميل (customerIds أو contractCustomerId)
        const hasCustomerIds = (currentUser.customerIds && currentUser.customerIds.length > 0) || currentUser.contractCustomerId;
        if (!hasCustomerIds) {
            return [...creditArray]; // محاسب بدون معرفات -> يرى كل شيء
        }
        // إذا كان لديه معرفات، نكمل إلى منطق العميل أدناه
    }
    
    // مستخدم ضيف
    if (currentUser?.isGuest) {
        const taxNumber = currentUser.taxNumber;
        if (!taxNumber) return [];
        return creditArray.filter(credit => 
            credit.customerId && credit.customerId.toLowerCase() === taxNumber.toLowerCase()
        );
    }
    
    // منطق العميل (سواء كان userType = 'customer' أو محاسب له معرفات)
    // تجميع جميع المعرفات المسموحة
    let allowedIds = [];
    if (currentUser.taxNumber) allowedIds.push(currentUser.taxNumber);
    if (currentUser.contractCustomerId) allowedIds.push(currentUser.contractCustomerId);
    if (currentUser.customerIds && Array.isArray(currentUser.customerIds)) {
        allowedIds = allowedIds.concat(currentUser.customerIds);
    }
    allowedIds = [...new Set(allowedIds.map(id => id.toLowerCase()))];
    
    if (allowedIds.length === 0) return [];
    
    return creditArray.filter(credit => {
        const creditCustomerId = (credit.customerId || '').toLowerCase();
        return allowedIds.some(id => creditCustomerId === id);
    });
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
        // ✅ إزالة الفواتير المكررة
			const uniqueInvoicesRemove = [];
			const seenKeysRemove = new Set();

			newInvoices.forEach(inv => {
				const key = getInvoiceKey(inv);
				if (!seenKeysRemove.has(key)) {
					seenKeysRemove.add(key);
					uniqueInvoicesRemove.push(inv);
				}
			});

			const duplicateCountRemove = newInvoices.length - uniqueInvoicesRemove.length;
				if (duplicateCountRemove > 0 && currentUser?.userType === 'admin') {
					showNotification(`⚠️ تم إزالة ${duplicateCountRemove} فاتورة مكررة`, 'warning');
				}

			invoicesData = uniqueInvoicesRemove;
        showProgress('تم التحميل', 100);
        
        // ✅ تطبيق تصفية المستخدم أولاً
        currentUser?.isGuest ? filterInvoicesByGuest(currentUser.taxNumber, currentUser.blNumber) : filterInvoicesByUser();
        
        // ✅ بعد تحميل الفواتير، قم بتحميل العلامات (checkbox)
        console.log('✅ تم تحميل الفواتير، جاري تحميل العلامات...');
        
        // انتظار اكتمال تحميل العلامات ثم تحديث الجدول
        await loadViewedFromDrive();
        
        // تحديث واجهة المستخدم مرة أخيرة
        renderData();
        
		// بعد تحميل العلامات وتحديث الجدول
		setTimeout(() => {
			checkUnviewedInvoicesAndShowReport();
		}, 500);
        document.getElementById('fileStatus').innerHTML = `<i class="fas fa-check-circle"></i> ✅ تم تحميل ${formatNumberWithCommas(invoicesData.length)} فاتورة من Drive`;
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
// نظام QR Code المستقل (مع تعديلات الشعار)
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
                <td>${formatNumberWithCommas(amountDisplay)}</td>
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
                <td>${formatNumberWithCommas(amountDisplay)}</td>
                <td>${formattedChargeDate}</td>
            </tr>`;
        }
    });

    const logoSrc = companyLogoBase64 ? companyLogoBase64 : '';

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
                .qr-logo-container {
                    width: 70px;
                    height: 70px;
                    background: white;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border: 3px solid #ffd700;
                    overflow: hidden;
                    padding: 0;
                }
                .qr-logo-image {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    border-radius: 50%;
                }
            </style>
            
            <div class="qr-invoice-header">
                <div style="display: flex; align-items: center; gap: 15px;">
                    <div class="qr-logo-container">
                        ${logoSrc ? 
                            `<img src="${logoSrc}" alt="DCHC Logo" class="qr-logo-image">` : 
                            `<i class="fas fa-ship" style="font-size: 2em; color: #1e3c72;"></i>`
                        }
                    </div>
                    <div>
                        <h2 style="color: #ffd700; margin: 0; font-size: 1.2em;">${COMPANY_INFO.name}</h2>
                        <p style="margin: 3px 0; opacity: 0.9; font-size: 0.8em;">${COMPANY_INFO.nameEn}</p>
                        <div style="display: flex; flex-wrap: wrap; gap: 8px; font-size: 0.7em;">
                            <span><i class="fas fa-phone" style="color: #ffd700;"></i> ${COMPANY_INFO.phone}</span>
                            <span><i class="fas fa-building" style="color: #ffd700;"></i> ضريبي: ${COMPANY_INFO.taxNumber}</span>
                        </div>
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
                <div style="display:flex; justify-content:space-between; padding:3px 0;"><span>إجمالي المصاريف:</span><span>${formatNumberWithCommas(totalChargesDisplay)} ${displayCurrency}</span></div>
                <div style="display:flex; justify-content:space-between; padding:3px 0;"><span>إجمالي الضرائب:</span><span>${formatNumberWithCommas(totalTaxesDisplay)} ${displayCurrency}</span></div>
                ${showMartyr ? `<div style="display:flex; justify-content:space-between; padding:3px 0;"><span>طابع الشهيد:</span><span>5 جنيه</span></div>` : ''}
                <div style="display:flex; justify-content:space-between; padding:5px 0; font-weight:bold; color:#4361ee;"><span>الإجمالي النهائي:</span><span>${formatNumberWithCommas(displayTotal)} ${displayCurrency}</span></div>
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

async function testCreditFileLoad() {
    console.log('=== اختبار تحميل ملف إشعارات الخصم ===');
    
    // التأكد من وجود إعدادات Drive
    if (!driveConfig.apiKey || !driveConfig.folderId) {
        showNotification('❌ إعدادات Drive غير مكتملة', 'error');
        return;
    }
    
    // تحديد معرف الملف (من الإعدادات)
    let fileId = driveConfig.creditFileId;
    const fileName = driveConfig.creditFileName || 'credit_data.txt';
    
    // إذا لم يكن هناك معرف، حاول البحث عنه
    if (!fileId) {
        showProgress('جاري البحث عن الملف...', 20);
        try {
            const query = encodeURIComponent(`'${driveConfig.folderId}' in parents and name='${fileName}' and trashed=false`);
            const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&key=${driveConfig.apiKey}&fields=files(id,name)`);
            if (!res.ok) throw new Error('فشل البحث');
            const data = await res.json();
            if (!data.files?.length) {
                showNotification(`❌ لم يتم العثور على ملف "${fileName}" في المجلد`, 'error');
                return;
            }
            fileId = data.files[0].id;
            driveConfig.creditFileId = fileId;
            saveDriveSettingsToStorage();
        } catch (err) {
            showNotification(`❌ خطأ في البحث: ${err.message}`, 'error');
            return;
        } finally {
            hideProgress();
        }
    }
    
    // تحميل الملف
    showProgress('جاري تحميل الملف...', 40);
    try {
        const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${driveConfig.apiKey}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const content = await response.text();
        
        showProgress('جاري تحليل البيانات...', 70);
        
        // تحليل المحتوى (نستخدم نفس دالة parseCreditData الموجودة)
        const parsedData = parseCreditData(content);
        
        // عرض البيانات في نافذة منبثقة
        showCreditTestWindow(parsedData, fileName);
        
        showProgress('اكتمل', 100);
        setTimeout(hideProgress, 1000);
        
    } catch (error) {
        console.error('خطأ في تحميل الملف:', error);
        showNotification(`❌ فشل تحميل الملف: ${error.message}`, 'error');
        hideProgress();
    }
}

function showCreditTestWindow(data, fileName) {
    // إنشاء نافذة منبثقة مؤقتة
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.7);
        z-index: 100000;
        display: flex;
        justify-content: center;
        align-items: center;
        direction: rtl;
    `;
    
    const contentDiv = document.createElement('div');
    contentDiv.style.cssText = `
        background: white;
        max-width: 90%;
        max-height: 90%;
        overflow: auto;
        padding: 20px;
        border-radius: 12px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        font-family: monospace;
        direction: ltr;
        text-align: left;
    `;
    
    // بناء HTML لعرض البيانات
    let html = `<h3 style="text-align:center;">نتائج تحميل ملف "${fileName}"</h3>`;
    html += `<p><strong>عدد الإشعارات المستخرجة:</strong> ${data.length}</p>`;
    
    if (data.length === 0) {
        html += `<p style="color:red;">لم يتم العثور على بيانات صالحة. تأكد من صيغة الملف.</p>`;
    } else {
        html += `<table border="1" cellpadding="5" cellspacing="0" style="border-collapse:collapse; width:100%;">`;
        html += `<thead><tr>
            <th>رقم الإشعار</th><th>العميل</th><th>رقم الفاتورة</th><th>المبلغ</th><th>الخصم %</th><th>قيمة الخصم</th><th>العملة</th><th>التاريخ</th>
        </tr></thead><tbody>`;
        
        data.forEach(item => {
            const discountValue = item.amount * item.discount / 100;
            html += `<tr>
                <td>${item.serial || '-'}</td>
                <td>${item.customer || '-'}</td>
                <td>${item.finalNumber || item.draftNumber || '-'}</td>
                <td>${item.amount.toFixed(2)}</td>
                <td>${item.discount.toFixed(2)}%</td>
                <td>${discountValue.toFixed(2)}</td>
                <td>${item.currency}</td>
                <td>${item.date || '-'}</td>
            </tr>`;
        });
        
        html += `</tbody></table>`;
        
        // عرض أول عنصر من البيانات للتأكد من البنية
        if (data[0]) {
            html += `<hr><h4>عينة من البيانات (أول عنصر):</h4>`;
            html += `<pre>${JSON.stringify(data[0], null, 2)}</pre>`;
        }
    }
    
    html += `<div style="text-align:center; margin-top:20px;">
        <button onclick="this.closest('div').parentElement.remove()" style="padding:8px 20px; background:#4361ee; color:white; border:none; border-radius:5px;">إغلاق</button>
    </div>`;
    
    contentDiv.innerHTML = html;
    modal.appendChild(contentDiv);
    document.body.appendChild(modal);
    
    // إغلاق النافذة عند النقر خارج المحتوى
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });
}

// ============================================
// دوال الطباعة لإشعارات الخصم
// ============================================

/**
 * إنشاء HTML لطباعة إشعار الخصم
 */
function generateCreditPrintHTML(item) {
    const net = item.displayAmount;
    const tax = item.displayTax;
    const total = net + tax;
    const currencySymbol = item.currency === 'USAD' ? 'USAD' : 'EGP';
    const logoSrc = companyLogoBase64 ? companyLogoBase64 : '';

    let itemsHtml = '';
    if (item.items && item.items.length > 0) {
        itemsHtml = `
            <table class="print-items-table" style="width:100%; border-collapse: collapse; margin: 15px 0;">
                <thead>
                    <tr>
                        <th style="border:1px solid #ddd; padding:8px; background:#f72585; color:white;">الكمية</th>
                        <th style="border:1px solid #ddd; padding:8px; background:#f72585; color:white;">السعر</th>
                        <th style="border:1px solid #ddd; padding:8px; background:#f72585; color:white;">المبلغ بعد سعر الصرف</th>
                    </tr>
                </thead>
                <tbody>
                    ${item.items.map(i => `
                        <tr>
                            <td style="border:1px solid #ddd; padding:8px; text-align:center;">${i.quantity}</td>
                            <td style="border:1px solid #ddd; padding:8px; text-align:center;">${i.rateCredited.toFixed(2)}</td>
                            <td style="border:1px solid #ddd; padding:8px; text-align:center;">${formatNumberWithCommas(i.displayAmount.toFixed(2))} ${currencySymbol}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    return `<!DOCTYPE html>
    <html dir="rtl">
    <head>
        <meta charset="UTF-8">
        <title>طباعة إشعار خصم - ${item.finalNumber || item.draftNumber}</title>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
        <style>
            @page { size: A4; margin: 1cm; }
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                direction: rtl;
                background: white;
                padding: 0;
                margin: 0;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }
            .print-container {
                max-width: 1000px;
                margin: 0 auto;
                background: white;
                padding: 20px;
            }
            .header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 20px;
                padding-bottom: 10px;
                border-bottom: 2px solid #e0e0e0;
            }
            .logo-area {
                display: flex;
                align-items: center;
                gap: 15px;
            }
            .logo {
                width: 70px;
                height: 70px;
                background: #f0f0f0;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                overflow: hidden;
                border: 2px solid #ffd700;
            }
            .logo img { width: 100%; height: 100%; object-fit: cover; }
            .company-info h2 { margin: 0; color: #1e3c72; }
            .company-info p { margin: 5px 0; font-size: 0.8em; color: #555; }
            .title {
                background: #f72585;
                color: white;
                padding: 10px;
                text-align: center;
                border-radius: 8px;
                margin-bottom: 20px;
            }
            .info-grid {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 15px;
                margin-bottom: 20px;
            }
            .info-box {
                background: #f8f9fa;
                padding: 12px;
                border-radius: 8px;
                border-right: 4px solid #f72585;
            }
            .info-box h4 { margin: 0 0 8px; color: #f72585; }
            .summary-box {
                width: 280px;
                background: #f8f9fa;
                padding: 12px;
                border-radius: 8px;
                margin-right: auto;
                margin-top: 20px;
            }
            .summary-row {
                display: flex;
                justify-content: space-between;
                padding: 5px 0;
                border-bottom: 1px solid #ddd;
            }
            .summary-row.total {
                font-weight: bold;
                color: #f72585;
                border-bottom: none;
            }
            .footer {
                text-align: center;
                margin-top: 30px;
                padding-top: 10px;
                border-top: 1px solid #ddd;
                font-size: 0.8em;
                color: #777;
            }
            .notes-box {
                background: #fff3cd;
                padding: 10px;
                border-right: 4px solid #ffc107;
                margin-top: 15px;
            }
        </style>
    </head>
    <body>
        <div class="print-container">
            <div class="header">
                <div class="logo-area">
                    <div class="logo">
                        ${logoSrc ? `<img src="${logoSrc}" alt="Logo">` : '<i class="fas fa-ship" style="font-size: 2em;"></i>'}
                    </div>
                    <div class="company-info">
                        <h2>${COMPANY_INFO.name}</h2>
                        <p>${COMPANY_INFO.nameEn}</p>
                        <p>${COMPANY_INFO.address} | هاتف: ${COMPANY_INFO.phone}</p>
                    </div>
                </div>
            </div>
            
            <div class="title">
                <h2>إشعار خصم: ${item.finalNumber || item.draftNumber || '-'} ${item.draftNumber ? `(مسودة: ${item.draftNumber})` : ''}</h2>
                <p>التاريخ: ${item.date || 'غير محدد'}</p>
            </div>
            
            <div class="info-grid">
                <div class="info-box">
                    <h4>بيانات العميل</h4>
                    <div><strong>الاسم:</strong> ${item.customer || '-'}</div>
                    <div><strong>الرقم الضريبي:</strong> ${item.customerId || '-'}</div>
                </div>
                <div class="info-box">
                    <h4>بيانات الفاتورة</h4>
                    <div><strong>رقم الفاتورة الأصلية:</strong> ${item.invoiceFinalNumber || '-'}</div>
                    <div><strong>رقم المسودة:</strong> ${item.draftNumber || '-'}</div>
                    <div><strong>رقم الإشعار النهائي:</strong> ${item.finalNumber || '-'}</div>
                </div>
                <div class="info-box">
                    <h4>المبالغ</h4>
                    <div><strong>العملة:</strong> ${currencySymbol}</div>
                    <div><strong>سعر الصرف:</strong> ${item.exchangeRate.toFixed(4)}</div>
                    <div><strong>الحالة:</strong> ${item.status || '-'}</div>
                </div>
            </div>
            
            ${itemsHtml}
            
            <div class="summary-box">
                <div class="summary-row"><span>صافي إشعار الخصم:</span><span>${formatNumberWithCommas(net.toFixed(2))} ${currencySymbol}</span></div>
                <div class="summary-row"><span>إجمالي الضرائب:</span><span>${formatNumberWithCommas(tax.toFixed(2))} ${currencySymbol}</span></div>
                <div class="summary-row total"><span>إجمالي الإشعار بعد الضريبة:</span><span>${formatNumberWithCommas(total.toFixed(2))} ${currencySymbol}</span></div>
            </div>
            
            ${item.notes ? `<div class="notes-box"><strong>ملاحظات:</strong> ${item.notes}</div>` : ''}
            
            <div class="footer">
                <p>شكراً لتعاملكم مع ${COMPANY_INFO.name}</p>
                <p>تم إنشاء هذا الإشعار إلكترونياً - تاريخ الطباعة: ${new Date().toLocaleDateString('ar-EG')}</p>
            </div>
        </div>
    </body>
    </html>`;
}

/**
 * طباعة إشعار الخصم
 */
window.printCreditNote = function() {
    console.log('تم استدعاء printCreditNote');
    
    let item = null;
    if (currentCreditData) {
        item = currentCreditData;
    } else if (currentCreditSerial) {
        item = creditData.find(d => d.serial == currentCreditSerial);
    }
    
    if (!item) {
        showNotification('لا توجد بيانات للإشعار', 'error');
        return;
    }
    
    const printWindow = window.open('', '_blank', 'width=1100,height=800');
    if (!printWindow) {
        showNotification('الرجاء السماح للنوافذ المنبثقة', 'error');
        return;
    }
    
    const printHtml = generateCreditPrintHTML(item);
    printWindow.document.write(printHtml);
    printWindow.document.close();
    printWindow.focus();
    
    setTimeout(() => {
        printWindow.print();
    }, 500);
};

window.exportCreditNotePDF = async function() {
    console.log('تم استدعاء exportCreditNotePDF');
    
    let item = null;
    if (currentCreditData) {
        item = currentCreditData;
    } else if (currentCreditSerial) {
        item = creditData.find(d => d.serial == currentCreditSerial);
    }
    
    if (!item) {
        showNotification('لا توجد بيانات للإشعار', 'error');
        return;
    }
    
    // محاولة العثور على عنصر الطباعة في النافذة الحالية
    let element = document.getElementById('creditPrint');
    let isTempElement = false;
    
    if (!element) {
        // إذا لم يكن موجوداً، نقوم بإنشاء نسخة مؤقتة
        const tempDiv = document.createElement('div');
        tempDiv.style.position = 'absolute';
        tempDiv.style.left = '-9999px';
        tempDiv.style.top = '-9999px';
        tempDiv.innerHTML = generateCreditPrintHTML(item);
        document.body.appendChild(tempDiv);
        element = tempDiv.firstChild;
        isTempElement = true;
    }
    
    if (typeof window.jspdf === 'undefined' || typeof window.html2canvas === 'undefined') {
        showNotification('جاري تحميل مكتبات PDF...', 'info');
        if (isTempElement && element && element.parentElement) element.parentElement.remove();
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
        pdf.save(`إشعار_خصم_${item.finalNumber || item.draftNumber || item.serial}.pdf`);
        
        showNotification('تم التصدير بنجاح', 'success');
        
    } catch (error) {
        console.error('خطأ في إنشاء PDF:', error);
        showNotification('حدث خطأ في إنشاء PDF: ' + error.message, 'error');
    } finally {
        loading.remove();
        // ✅ إزالة العنصر المؤقت فقط إذا تم إنشاؤه، وليس العنصر الأصلي
        if (isTempElement && element && element.parentElement) {
            element.parentElement.remove();
        }
        // ✅ لا نغلق النافذة المنبثقة
        // ✅ لا نعدل على modalBody أو أي شيء آخر
    }
};

window.exportCreditNoteExcel = function() {
    console.log('تم استدعاء exportCreditNoteExcel');
    
    let item = null;
    if (currentCreditData) {
        item = currentCreditData;
    } else if (currentCreditSerial) {
        item = creditData.find(d => d.serial == currentCreditSerial);
    }
    
    if (!item) {
        showNotification('لا توجد بيانات للإشعار', 'error');
        return;
    }
    
    const net = item.displayAmount;
    const tax = item.displayTax;
    const total = net + tax;
    const currencySymbol = item.currency === 'USAD' ? 'USAD' : 'EGP';
    
    const excelData = [
        ['إشعار خصم'],
        [`رقم الإشعار: ${item.finalNumber || item.draftNumber || '-'}`],
        [`رقم المسودة: ${item.draftNumber || '-'}`],
        [`رقم الفاتورة الأصلية: ${item.invoiceFinalNumber || '-'}`],
        [`العميل: ${item.customer || '-'}`],
        [`الرقم الضريبي: ${item.customerId || '-'}`],
        [`التاريخ: ${item.date || '-'}`],
        [`العملة: ${currencySymbol}`],
        [`سعر الصرف: ${item.exchangeRate.toFixed(4)}`],
        [`الحالة: ${item.status || '-'}`],
        [],
        ['الكمية', 'السعر', 'المبلغ بعد سعر الصرف']
    ];
    
    if (item.items && item.items.length > 0) {
        item.items.forEach(i => {
            excelData.push([
                i.quantity,
                i.rateCredited.toFixed(2),
                `${i.displayAmount.toFixed(2)} ${currencySymbol}`
            ]);
        });
    } else {
        excelData.push(['لا توجد بنود', '', '']);
    }
    
    excelData.push([], ['ملخص']);
    excelData.push(['صافي إشعار الخصم:', `${net.toFixed(2)} ${currencySymbol}`]);
    excelData.push(['إجمالي الضرائب:', `${tax.toFixed(2)} ${currencySymbol}`]);
    excelData.push(['إجمالي الإشعار بعد الضريبة:', `${total.toFixed(2)} ${currencySymbol}`]);
    
    if (item.notes) {
        excelData.push(['ملاحظات:', item.notes]);
    }
    
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(excelData);
    ws['!cols'] = [{ wch: 25 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, ws, 'إشعار خصم');
    
    XLSX.writeFile(wb, `إشعار_خصم_${item.finalNumber || item.draftNumber || item.serial}.xlsx`);
    showNotification('تم تصدير Excel بنجاح', 'success');
};

// بناء واجهة البحث للفواتير
function buildInvoiceSearchUI() {
    const advancedSearch = document.querySelector('.advanced-search');
    if (!advancedSearch) return;
    const searchBody = advancedSearch.querySelector('.search-body');
    if (!searchBody) return;
    
    // تحديد نوع حقل اسم العميل بناءً على نوع المستخدم
    let customerFieldHtml = '';
    const isAdmin = currentUser && currentUser.userType === 'admin';
    
    if (!isAdmin && currentUser) {
        let availableIds = [];
        if (currentUser.customerIds && Array.isArray(currentUser.customerIds)) {
            availableIds.push(...currentUser.customerIds);
        }
        if (currentUser.contractCustomerId && !availableIds.includes(currentUser.contractCustomerId)) {
            availableIds.push(currentUser.contractCustomerId);
        }
        availableIds = [...new Set(availableIds.filter(id => id && id.trim() !== ''))];
        
        if (availableIds.length > 0) {
            let options = '<option value="">الكل</option>';
            availableIds.forEach(id => {
                const escapedId = id.replace(/"/g, '&quot;');
                options += `<option value="${escapedId}">${escapedId}</option>`;
            });
            customerFieldHtml = `
                <div class="search-field">
                    <label><i class="fas fa-user-tie"></i> اسم العميل</label>
                    <select id="searchCustomer">
                        ${options}
                    </select>
                </div>
            `;
        }
    }
    
    if (!customerFieldHtml) {
        customerFieldHtml = `
            <div class="search-field">
                <label><i class="fas fa-user-tie"></i> اسم العميل</label>
                <input type="text" id="searchCustomer" placeholder="اسم العميل...">
            </div>
        `;
    }
    
    searchBody.innerHTML = `
        <div class="search-grid">
            <div class="search-field">
                <label><i class="fas fa-hashtag"></i> رقم الفاتورة النهائي</label>
                <input type="text" id="searchFinalNumber" placeholder="مثال: C25-22491">
            </div>
            <div class="search-field">
                <label><i class="fas fa-file-signature"></i> رقم المسودة</label>
                <input type="text" id="searchDraftNumber" placeholder="مثال: 263531">
            </div>
            ${customerFieldHtml}
            <div class="search-field">
                <label><i class="fas fa-ship"></i> اسم السفينة</label>
                <input type="text" id="searchVessel" placeholder="اسم السفينة...">
            </div>
            <div class="search-field">
                <label><i class="fas fa-barcode"></i> رقم البوليصة</label>
                <input type="text" id="searchBlNumber" placeholder="رقم البوليصة...">
            </div>
            <div class="search-field">
                <label><i class="fas fa-container-storage"></i> رقم الحاوية</label>
                <input type="text" id="searchContainer" placeholder="رقم الحاوية...">
            </div>
            <div class="search-field">
                <label><i class="fas fa-check-square"></i> حالة المعاينة</label>
                <select id="searchViewedStatus">
                    <option value="">الكل</option>
                    <option value="viewed">محددة ✓</option>
                    <option value="not_viewed">غير محددة ☐</option>
                </select>
            </div>
            <div class="search-field">
                <label><i class="fas fa-calendar"></i> من تاريخ</label>
                <input type="date" id="searchDateFrom">
            </div>
            <div class="search-field">
                <label><i class="fas fa-calendar"></i> إلى تاريخ</label>
                <input type="date" id="searchDateTo">
            </div>
            <div class="search-field">
                <label><i class="fas fa-tag"></i> نوع الفاتورة</label>
                <select id="searchInvoiceType">
                    <option value="">الكل</option>
                    <option value="cash">نقدي</option>
                    <option value="postponed">أجل</option>
                </select>
            </div>
            <div class="search-field">
                <label><i class="fas fa-id-card"></i> رقم عقد العميل</label>
                <input type="text" id="searchContractCustomerId" placeholder="رقم العقد...">
            </div>
        </div>
        <div class="search-actions">
            <button class="btn btn-primary" onclick="applyAdvancedSearch()"><i class="fas fa-filter"></i> تطبيق البحث</button>
            <button class="btn btn-secondary" onclick="resetAdvancedSearch()"><i class="fas fa-undo"></i> إعادة ضبط</button>
        </div>
    `;
}

// بناء واجهة البحث لإشعارات الخصم
function buildCreditSearchUI() {
    const advancedSearch = document.querySelector('.advanced-search');
    if (!advancedSearch) return;
    const searchBody = advancedSearch.querySelector('.search-body');
    if (!searchBody) return;
    searchBody.innerHTML = `
        <div class="search-grid">
            <div class="search-field">
                <label><i class="fas fa-hashtag"></i> رقم الإشعار</label>
                <input type="text" id="creditSearchSerial" placeholder="رقم الإشعار أو رقم المسودة">
            </div>
            <div class="search-field">
                <label><i class="fas fa-user"></i> اسم العميل</label>
                <input type="text" id="creditSearchCustomer" placeholder="اسم العميل...">
            </div>
            <div class="search-field">
                <label><i class="fas fa-file-invoice"></i> رقم الفاتورة الأصلية</label>
                <input type="text" id="creditSearchInvoiceNumber" placeholder="رقم الفاتورة الأصلية...">
            </div>
            <div class="search-field">
                <label><i class="fas fa-calendar"></i> من تاريخ الإشعار</label>
                <input type="date" id="creditSearchDateFrom">
            </div>
            <div class="search-field">
                <label><i class="fas fa-calendar"></i> إلى تاريخ الإشعار</label>
                <input type="date" id="creditSearchDateTo">
            </div>
            <div class="search-field">
                <label><i class="fas fa-tag"></i> الحالة</label>
                <select id="creditSearchStatus">
                    <option value="">الكل</option>
                    <option value="FINAL">نهائي</option>
                    <option value="DRAFT">مسودة</option>
                </select>
            </div>
        </div>
        <div class="search-actions">
            <button class="btn btn-primary" onclick="applyCreditSearch()"><i class="fas fa-filter"></i> تطبيق البحث</button>
            <button class="btn btn-secondary" onclick="resetCreditSearch()"><i class="fas fa-undo"></i> إعادة ضبط</button>
        </div>
    `;
    // فتح جسم البحث تلقائيًا
    if (!searchBody.classList.contains('show')) {
        searchBody.classList.add('show');
        const icon = advancedSearch.querySelector('#searchToggleIcon');
        if (icon) icon.style.transform = 'rotate(180deg)';
    }
}

// تطبيق البحث على إشعارات الخصم
window.applyCreditSearch = function() {
    const serial = document.getElementById('creditSearchSerial')?.value.trim().toLowerCase() || '';
    const customer = document.getElementById('creditSearchCustomer')?.value.trim().toLowerCase() || '';
    const invoiceNumber = document.getElementById('creditSearchInvoiceNumber')?.value.trim().toLowerCase() || '';
    const dateFrom = document.getElementById('creditSearchDateFrom')?.value;
    const dateTo = document.getElementById('creditSearchDateTo')?.value;
    const status = document.getElementById('creditSearchStatus')?.value;

    // الخطوة 1: تصفية حسب صلاحيات المستخدم (بدون البحث)
    let filtered = filterCreditByUser(creditData);
    
    // الخطوة 2: تطبيق معايير البحث الإضافية
    if (serial) {
        filtered = filtered.filter(c => 
            (c.serial && c.serial.toLowerCase().includes(serial)) || 
            (c.draftNumber && c.draftNumber.toLowerCase().includes(serial)) ||
            (c.finalNumber && c.finalNumber.toLowerCase().includes(serial))
        );
    }
    if (customer) {
        filtered = filtered.filter(c => (c.customer || '').toLowerCase().includes(customer));
    }
    if (invoiceNumber) {
        filtered = filtered.filter(c => (c.invoiceFinalNumber || '').toLowerCase().includes(invoiceNumber));
    }
    if (dateFrom) {
        const fromDate = new Date(dateFrom);
        fromDate.setHours(0,0,0,0);
        filtered = filtered.filter(c => {
            if (!c.date) return false;
            const d = new Date(c.date);
            return d >= fromDate;
        });
    }
    if (dateTo) {
        const toDate = new Date(dateTo);
        toDate.setHours(23,59,59,999);
        filtered = filtered.filter(c => {
            if (!c.date) return false;
            const d = new Date(c.date);
            return d <= toDate;
        });
    }
    if (status) {
        filtered = filtered.filter(c => c.status === status);
    }
    
    filteredCreditData = filtered;
    currentCreditPage = 1;
    renderCreditData();
    showNotification(`تم العثور على ${filtered.length} إشعار خصم`, filtered.length ? 'success' : 'info');
};

// إعادة ضبط البحث في إشعارات الخصم
window.resetCreditSearch = function() {
    document.getElementById('creditSearchSerial').value = '';
    document.getElementById('creditSearchCustomer').value = '';
    document.getElementById('creditSearchInvoiceNumber').value = '';
    document.getElementById('creditSearchDateFrom').value = '';
    document.getElementById('creditSearchDateTo').value = '';
    document.getElementById('creditSearchStatus').value = '';
    
    // إعادة تعيين إلى القائمة المصفاة حسب الصلاحيات (بدون بحث)
    filteredCreditData = filterCreditByUser(creditData);
    currentCreditPage = 1;
    renderCreditData();
    showNotification('تم إعادة ضبط البحث', 'info');
};

// دالة تبديل حالة معاينة الفاتورة
window.toggleInvoiceViewed = async function(key, isChecked, finalNumber, draftNumber) {
    console.log('🔄 تغيير حالة المعاينة:', key, isChecked ? 'محدد' : 'غير محدد');
    
    if (isChecked) {
        if (!viewedInvoices.has(key)) {
            viewedInvoices.add(key);
        }
    } else {
        viewedInvoices.delete(key);
    }
    
    // حفظ محلياً
    saveViewedInvoices();
    
    // حفظ على Drive
    await saveViewedToDrive();
    
    // تحديث واجهة المستخدم (اختياري)
    const row = document.querySelector(`tr[data-key="${key}"]`);
    if (row) {
        const checkbox = row.querySelector('.viewed-checkbox');
        if (checkbox) checkbox.checked = isChecked;
    }
    
    console.log('✅ تم حفظ الحالة، عدد الفواتير المعاينة:', viewedInvoices.size);
};


// حفظ حالة المعاينة محلياً
function saveViewedInvoices() {
    try {
        const viewedArray = [...viewedInvoices];
        localStorage.setItem('viewedInvoices', JSON.stringify(viewedArray));
        console.log('💾 تم حفظ محلياً:', viewedArray.length, 'فاتورة');
    } catch (error) {
        console.error('❌ خطأ في الحفظ المحلي:', error);
    }
}

// تحميل حالة المعاينة من localStorage
function loadViewedInvoices() {
    try {
        const saved = localStorage.getItem('viewedInvoices');
        if (saved) {
            const viewedArray = JSON.parse(saved);
            viewedInvoices = new Set(viewedArray);
            console.log('📂 تم تحميل محلياً:', viewedInvoices.size, 'فاتورة');
        }
    } catch (error) {
        console.error('❌ خطأ في تحميل الحالة المحلية:', error);
    }
}

// ============================================
// تحميل حالة المعاينة من localStorage
// ============================================
function loadViewedInvoices() {
    const saved = localStorage.getItem('viewedInvoices');
    if (saved) {
        try {
            const viewedArray = JSON.parse(saved);
            viewedInvoices = new Set(viewedArray);
            console.log('📂 تم تحميل محلياً:', viewedInvoices.size, 'فاتورة');
        } catch(e) {
            console.error('خطأ في تحميل الحالة المحلية:', e);
        }
    }
}

// ============================================
// دوال نظام السدادات
// ============================================

// تحميل السدادات من السحابة
async function loadPaymentsFromCloud(username) {
    console.log('🔄 جاري تحميل السدادات...');
    
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            // ✅ دائماً نحمل كل السدادات بدون فلتر
            const response = await fetch(PAYMENTS_API_URL);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const data = await response.json();
            if (data.success) {
                paymentsData = data.payments || [];
                console.log(`✅ تم تحميل ${paymentsData.length} سداد`);
                return true;
            }
            return false;
        } catch (error) {
            console.warn(`⚠️ محاولة ${attempt} فشلت:`, error.message);
            if (attempt < 3) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    }
    
    console.error('❌ فشلت جميع محاولات تحميل السدادات');
    return false;
}

// حفظ سداد جديد
async function savePaymentToCloud(paymentData) {
    console.log('💾 جاري حفظ السداد...');
    try {
        const response = await fetch(PAYMENTS_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({
                action: 'create',
                ...paymentData
            })
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        
        if (data.success) {
            console.log('✅ تم حفظ السداد بنجاح:', data.payment.id);
            return data;
        }
        throw new Error(data.error || 'فشل الحفظ');
    } catch (error) {
        console.error('❌ فشل حفظ السداد:', error);
        return null;
    }
}

// تأكيد سداد (للمدير فقط)
async function confirmPaymentInCloud(paymentId) {
    if (currentUser?.userType !== 'admin') {
        showNotification('غير مصرح لك بتأكيد السداد', 'error');
		// تحديث عرض السدادات مباشرة إذا كان التبويب مفتوحاً
	if (document.querySelector('.type-tab.active')?.textContent?.includes('السدادات')) {
		await openAllPaymentsView();
}
        return null;
    }
    
    try {
        const response = await fetch(PAYMENTS_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({
                action: 'confirm',
                paymentId: paymentId,
                confirmedBy: currentUser.username
            })
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        
        if (data.success) {
            showNotification('✅ تم تأكيد السداد بنجاح', 'success');
            return data;
        }
        throw new Error(data.error || 'فشل التأكيد');
    } catch (error) {
        console.error('❌ فشل تأكيد السداد:', error);
        showNotification('❌ فشل تأكيد السداد', 'error');
        return null;
    }
}

// رفض سداد (للمدير فقط)
async function rejectPaymentInCloud(paymentId, reason) {
    if (currentUser?.userType !== 'admin') {
        showNotification('غير مصرح لك برفض السداد', 'error');
		// تحديث عرض السدادات مباشرة إذا كان التبويب مفتوحاً
	if (document.querySelector('.type-tab.active')?.textContent?.includes('السدادات')) {
		await openAllPaymentsView();
}
        return null;
    }
    
    try {
        const response = await fetch(PAYMENTS_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({
                action: 'reject',
                paymentId: paymentId,
                rejectionReason: reason,
                confirmedBy: currentUser.username
            })
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        
        if (data.success) {
            showNotification('تم رفض السداد', 'info');
            return data;
        }
        throw new Error(data.error || 'فشل الرفض');
    } catch (error) {
        console.error('❌ فشل رفض السداد:', error);
        showNotification('❌ فشل رفض السداد', 'error');
        return null;
    }
}

// إلغاء سداد
async function cancelPaymentInCloud(paymentId) {
    try {
        const response = await fetch(PAYMENTS_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({
                action: 'cancel',
                paymentId: paymentId
            })
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        
        if (data.success) {
            showNotification('تم إلغاء السداد', 'info');
			// تحديث عرض السدادات مباشرة إذا كان التبويب مفتوحاً
		if (document.querySelector('.type-tab.active')?.textContent?.includes('السدادات')) {
			await openAllPaymentsView();
}
            return data;
        }
        throw new Error(data.error || 'فشل الإلغاء');
    } catch (error) {
        console.error('❌ فشل إلغاء السداد:', error);
        showNotification('❌ فشل إلغاء السداد', 'error');
        return null;
    }
}

// ============================================
// دوال واجهة السدادات
// ============================================

// فتح نافذة تسجيل سداد جديد
window.openPaymentModal = function() {
    if (!currentUser) {
        showNotification('يرجى تسجيل الدخول أولاً', 'warning');
        return;
    }
    
    // ✅ إعداد التاريخ الافتراضي (اليوم)
    document.getElementById('paymentDate').value = new Date().toISOString().slice(0, 10);
    
    // ✅ تفريغ جميع الحقول
    document.getElementById('paymentAmount').value = '';
    document.getElementById('paymentReference').value = '';
    document.getElementById('paymentNotes').value = '';
    document.getElementById('paymentBankName').value = '';
    document.getElementById('paymentChequeNumber').value = '';
    document.getElementById('paymentChequeDate').value = '';
    document.getElementById('paymentChequeBank').value = '';
    document.getElementById('paymentCardLast4').value = '';
    document.getElementById('paymentCurrency').value = 'EGP';
    document.getElementById('paymentMethod').value = 'bank_transfer';
    document.getElementById('paymentMessage').style.display = 'none';
    
    // ✅ إظهار/إخفاء الحقول حسب طريقة السداد
    onPaymentMethodChange();
    
    // ✅ تحميل قائمة العملاء في القائمة المنسدلة
    loadPaymentCustomers();
    
    // ✅ تحميل السدادات ثم الفواتير غير المسددة
    //    لكن فقط إذا لم يكن سداداً سريعاً
    if (!isQuickPayment) {
        loadPaymentsFromCloud(currentUser.username).then(() => {
            loadUnpaidInvoicesForPayment();
        });
    }
    
    // ✅ إظهار النافذة
openModal('paymentModal');
};

// إغلاق نافذة السداد
window.closePaymentModal = function() {
    const modal = document.getElementById('paymentModal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('show');
    }
};

// تغيير طريقة السداد - إظهار/إخفاء الحقول المناسبة
window.onPaymentMethodChange = function() {
    const method = document.getElementById('paymentMethod').value;
    
    document.getElementById('bankFields').style.display = (method === 'bank_transfer' || method === 'direct_deposit' || method === 'postal_order') ? 'block' : 'none';
    document.getElementById('chequeFields').style.display = (method === 'cheque') ? 'block' : 'none';
    document.getElementById('cardFields').style.display = (method === 'credit_card') ? 'block' : 'none';
};

// تغيير العميل - تحديث الفواتير المرتبطة
window.onPaymentCustomerChange = async function() {
    await loadPaymentsFromCloud(currentUser.username);
    loadUnpaidInvoicesForPayment();
};

// تحميل قائمة العملاء في نافذة السداد
function loadPaymentCustomers() {
    const select = document.getElementById('paymentCustomer');
    select.innerHTML = '<option value="">اختر العميل...</option>';
    
    if (currentUser?.userType === 'admin') {
        const customers = [...new Set(invoicesData.map(inv => {
            return inv['payee-customer-id'] || inv['contract-customer-id'] || '';
        }).filter(c => c))];
        customers.sort();
        customers.forEach(c => {
            select.innerHTML += `<option value="${c}">${c}</option>`;
        });
    } else {
        // ✅ استخدام customerIds الخاصة بالمستخدم
        if (currentUser.customerIds && currentUser.customerIds.length > 0) {
            currentUser.customerIds.forEach(id => {
                select.innerHTML += `<option value="${id}">${id}</option>`;
            });
            select.value = currentUser.customerIds[0];
        } else if (currentUser.contractCustomerId) {
            select.innerHTML += `<option value="${currentUser.contractCustomerId}">${currentUser.contractCustomerId}</option>`;
            select.value = currentUser.contractCustomerId;
        } else if (currentUser.taxNumber) {
            select.innerHTML += `<option value="${currentUser.taxNumber}">${currentUser.taxNumber}</option>`;
            select.value = currentUser.taxNumber;
        }
    }
}

// تحميل الفواتير غير المسددة للربط
function loadUnpaidInvoicesForPayment() {
    const container = document.getElementById('linkedInvoicesContainer');
    const customerId = document.getElementById('paymentCustomer').value;
    
    if (!customerId) {
        container.innerHTML = '<p style="color:var(--text-muted);">اختر العميل أولاً لعرض فواتيره</p>';
        return;
    }
    
    const customerInvoices = invoicesData.filter(inv => {
        const payee = inv['payee-customer-id'] || '';
        const contract = inv['contract-customer-id'] || '';
        return payee.includes(customerId) || contract.includes(customerId);
    });
    
    // ✅ تصفية حسب تاريخ الفاتورة (finalized-date)
    const dateFrom = document.getElementById('paymentDateFrom')?.value;
    const dateTo = document.getElementById('paymentDateTo')?.value;
    
    let filteredByDate = customerInvoices;
    if (dateFrom || dateTo) {
        filteredByDate = customerInvoices.filter(inv => {
            const invDate = (inv['finalized-date'] || inv['created'] || '').slice(0, 10);
            if (!invDate) return true;
            if (dateFrom && invDate < dateFrom) return false;
            if (dateTo && invDate > dateTo) return false;
            return true;
        });
    }
    
    if (filteredByDate.length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted);">لا توجد فواتير لهذا العميل في هذه الفترة</p>';
        return;
    }
    
    // ✅ جمع المبالغ المدفوعة والمعلقة لكل فاتورة
    const invoicePaidAmounts = {};
    const invoiceHasPending = {};
    
    paymentsData.forEach(p => {
        if (p.linkedInvoices && Array.isArray(p.linkedInvoices)) {
            p.linkedInvoices.forEach(key => {
                if (p.status === 'confirmed' || p.isOpeningBalance) {
                    const amountPerInvoice = p.linkedInvoices.length > 0 ? p.amount / p.linkedInvoices.length : p.amount;
                    if (!invoicePaidAmounts[key]) invoicePaidAmounts[key] = 0;
                    invoicePaidAmounts[key] += amountPerInvoice;
                }
                if (p.status === 'pending') {
                    invoiceHasPending[key] = true;
                }
            });
        }
    });
    
    // ✅ تصفية الفواتير
    const unpaidInvoices = [];
    filteredByDate.forEach(inv => {
        const key = getInvoiceKey(inv);
        
        // ✅ الفاتورة التي لها سداد معلق لا تظهر
        if (invoiceHasPending[key]) return;
        
        // ✅ حساب المبلغ بالعملة الأصلية
        const currency = inv['currency'] || 'EGP';
        const exRate = inv['flex-string-06'] || 48.0215;
        const originalTotal = inv['total-total'] || 0;
        const martyr = (inv['final-number'] || '').startsWith('P') ? 0 : 5;
        
        let invoiceTotal, displayCurrency;
        if (currency === 'USAD') {
            invoiceTotal = (originalTotal + martyr) / exRate;
            displayCurrency = 'USD';
        } else {
            invoiceTotal = originalTotal + martyr;
            displayCurrency = 'EGP';
        }
        
        const paid = invoicePaidAmounts[key] || 0;
        const remaining = invoiceTotal - paid;
        
        // ✅ الفاتورة المسددة كلياً لا تظهر
        if (remaining <= 0.01) return;
        
        unpaidInvoices.push({
            invoice: inv,
            key: key,
            total: invoiceTotal,
            currency: displayCurrency,
            paid: paid,
            remaining: remaining
        });
    });
    
    // ✅ ترتيب الفواتير تنازلياً حسب الرقم التسلسلي
    unpaidInvoices.sort((a, b) => {
        const getNum = (finalNumber) => {
            if (!finalNumber) return 0;
            const parts = finalNumber.split('-');
            if (parts.length > 1) {
                return parseInt(parts[parts.length - 1]) || 0;
            }
            return 0;
        };
        const numA = getNum(a.invoice['final-number']);
        const numB = getNum(b.invoice['final-number']);
        return numB - numA;
    });
    
    if (unpaidInvoices.length === 0) {
        container.innerHTML = '<p style="color:#4ade80;">✅ جميع فواتير هذا العميل تم سدادها أو لها سداد قيد الانتظار</p>';
        return;
    }
    
    let html = `<p style="font-size:0.8em; color:var(--text-muted); margin-bottom:8px;">
        ${unpaidInvoices.length} فاتورة متاحة للسداد من أصل ${filteredByDate.length}
    </p>`;
    html += '<table style="width:100%; font-size:0.8em;">';
    html += '<thead><tr><th>تحديد</th><th>رقم الفاتورة</th><th>التاريخ</th><th>السفينة</th><th>تاريخ الرحلة</th><th>الإجمالي</th><th>العملة</th><th>الحالة</th></tr></thead><tbody>';
    
    unpaidInvoices.forEach(item => {
        const invDate = (item.invoice['finalized-date'] || item.invoice['created'] || '').slice(0, 10);
        const voyageDate = item.invoice['flex-date-02'] ? item.invoice['flex-date-02'].slice(0, 10) : '-';
        
        html += `<tr>
            <td><input type="checkbox" class="link-invoice-check" value="${item.key}" onchange="updateLinkedTotal()" data-remaining="${item.remaining.toFixed(2)}"></td>
            <td>${item.invoice['final-number'] || item.invoice['draft-number'] || '-'}</td>
            <td>${invDate || '-'}</td>
            <td>${item.invoice['key-word1'] || '-'}</td>
            <td>${voyageDate}</td>
            <td>${formatNumberWithCommas(item.total.toFixed(2))}</td>
            <td>${item.currency}</td>
            <td>${item.paid > 0 ? '<span style="background:rgba(245,158,11,0.15); color:#fbbf24; padding:2px 8px; border-radius:4px; font-size:0.7em; font-weight:600;">مسدد جزئياً</span>' : '-'}</td>
        </tr>`;
    });
    
    html += '</tbody></table>';
    container.innerHTML = html;
}

// تحديث إجمالي الفواتير المرتبطة
function updateLinkedTotal() {
    const checks = document.querySelectorAll('.link-invoice-check:checked');
    let total = 0;
    let currency = null;
    
    checks.forEach(cb => {
        const row = cb.closest('tr');
        const cells = row?.querySelectorAll('td');
        const currencyCell = cells?.[cells.length - 1];
        const rowCurrency = currencyCell?.textContent?.trim();
        
        // ✅ تحديث العملة لكل فاتورة محددة (وليس فقط الأولى)
        if (rowCurrency && (rowCurrency === 'USD' || rowCurrency === 'EGP')) {
            currency = rowCurrency;
        }
        
        total += parseFloat(cb.dataset.remaining) || 0;
    });
    
    document.getElementById('paymentAmount').value = total > 0 ? total.toFixed(2) : '';
    if (currency) {
        document.getElementById('paymentCurrency').value = currency;
    }
}

// إرسال السداد للحفظ
window.submitPayment = async function() {
    const customerId = document.getElementById('paymentCustomer').value;
    const amount = parseFloat(document.getElementById('paymentAmount').value);
    const currency = document.getElementById('paymentCurrency').value;
    const date = document.getElementById('paymentDate').value;
    const method = document.getElementById('paymentMethod').value;
    const reference = document.getElementById('paymentReference').value;
    const notes = document.getElementById('paymentNotes').value;
    
    // التحقق من الحقول المطلوبة
    if (!customerId) {
        showPaymentMessage('الرجاء اختيار العميل', 'error');
        return;
    }
    if (!amount || amount <= 0) {
        showPaymentMessage('الرجاء إدخال مبلغ صحيح', 'error');
        return;
    }
    if (!date) {
        showPaymentMessage('الرجاء إدخال تاريخ السداد', 'error');
        return;
    }
    
    // جمع الفواتير المرتبطة
    const linkedChecks = document.querySelectorAll('.link-invoice-check:checked');
    const linkedInvoices = [];
    const invoiceAmounts = {};
    let totalRemaining = 0;
    
    linkedChecks.forEach(cb => {
        linkedInvoices.push(cb.value);
        const remaining = parseFloat(cb.dataset.remaining) || parseFloat(cb.dataset.total) || 0;
        invoiceAmounts[cb.value] = remaining;
        totalRemaining += remaining;
    });
    
    // تحديد هل هو سداد جزئي أم كلي
    const isPartial = linkedInvoices.length > 0 && amount < totalRemaining;
    
    // تجهيز بيانات السداد
    const paymentData = {
        customerId: customerId,
        username: currentUser.username,
        amount: amount,
        currency: currency,
        exchangeRate: currency === 'USD' ? (exchangeRate || 48.0215) : 1,
        date: date,
        method: method,
        reference: reference,
        bankName: document.getElementById('paymentBankName').value,
        chequeNumber: document.getElementById('paymentChequeNumber').value,
        chequeDate: document.getElementById('paymentChequeDate').value,
        chequeBank: document.getElementById('paymentChequeBank').value,
        cardType: document.getElementById('paymentCardType').value,
        cardLast4: document.getElementById('paymentCardLast4').value,
        notes: notes,
        linkedInvoices: linkedInvoices,
        partialPayment: isPartial,
        invoiceAmounts: invoiceAmounts,
        status: currentUser?.userType === 'admin' ? 'confirmed' : 'pending',
        createdBy: currentUser.username
    };
    
    showPaymentMessage('جاري حفظ السداد...', 'info');
    
    const result = await savePaymentToCloud(paymentData);
    
    if (result?.success) {
        const paymentId = result.payment.id;
        
        // ✅ رفع المرفقات إن وجدت
        const attachmentInput = document.getElementById('paymentAttachment');
        if (attachmentInput && attachmentInput.files.length > 0) {
            await uploadPaymentAttachments(paymentId, attachmentInput.files);
        }
        
        // ✅ تحديث فوري للسدادات
        await loadPaymentsFromCloud(currentUser.username);
        
        const statusText = isPartial ? 'سداد جزئي' : (linkedInvoices.length > 0 ? 'سداد كلي' : 'سداد بدون فواتير');
        showPaymentMessage(`✅ تم تسجيل ${statusText} بنجاح!`, 'success');
        setTimeout(() => closePaymentModal(), 1500);
        
        // ✅ تحديث عرض السدادات إذا كان التبويب مفتوحاً
        if (document.querySelector('.type-tab.active')?.textContent?.includes('السدادات')) {
            filteredPayments = [...paymentsData];
            renderPaymentsView();
        }
        
        // ✅ تحديث عرض الفواتير فوراً (حالة السداد)
        if (currentUser?.isGuest) {
            filterInvoicesByGuest(currentUser.taxNumber, currentUser.blNumber);
        } else {
            filterInvoicesByUser();
        }
    } else {
        showPaymentMessage('❌ فشل حفظ السداد', 'error');
    }
};

// ✅ دالة جديدة: رفع مرفقات السداد
async function uploadPaymentAttachments(paymentId, files) {
    const maxFiles = 3;
    const fileCount = Math.min(files.length, maxFiles);
    
    for (let i = 0; i < fileCount; i++) {
        const file = files[i];
        
        // التحقق من نوع الملف
        const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
        if (!allowedTypes.includes(file.type)) {
            console.warn(`⚠️ نوع ملف غير مدعوم: ${file.name}`);
            continue;
        }
        
        // التحقق من حجم الملف (أقصى 5MB)
        if (file.size > 5 * 1024 * 1024) {
            console.warn(`⚠️ حجم الملف كبير جداً: ${file.name}`);
            continue;
        }
        
        try {
            // تحويل الملف إلى Base64
            const base64 = await fileToBase64(file);
            
            showPaymentMessage(`جاري رفع المرفق ${i + 1} من ${fileCount}...`, 'info');
            
            // إرسال المرفق إلى Apps Script
            const response = await fetch(PAYMENTS_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({
                    action: 'upload_attachment',
                    paymentId: paymentId,
                    fileName: `${paymentId}_${file.name}`,
                    fileContent: base64.split(',')[1], // إزالة رأس data:image/...;base64,
                    mimeType: file.type
                })
            });
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            
            if (data.success) {
                console.log(`✅ تم رفع المرفق: ${file.name}`);
            } else {
                console.error(`❌ فشل رفع المرفق: ${data.error}`);
            }
        } catch (error) {
            console.error(`❌ خطأ في رفع المرفق ${file.name}:`, error);
        }
    }
}

// ✅ دالة مساعدة: تحويل File إلى Base64
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

// عرض رسالة في نافذة السداد
function showPaymentMessage(msg, type) {
    const div = document.getElementById('paymentMessage');
    div.textContent = msg;
    div.className = `login-message ${type}`;
    div.style.display = 'block';
}

// ============================================
// دوال كشف الحساب
// ============================================

// فتح كشف الحساب
window.openAccountStatement = async function(customerId) {
    // إذا لم يتم تحديد عميل، استخدم الافتراضي
    if (!customerId && currentUser) {
        customerId = currentUser.taxNumber || currentUser.contractCustomerId || 
                    (currentUser.customerIds && currentUser.customerIds.length > 0 ? currentUser.customerIds[0] : '');
    }
    
    if (!customerId) {
        showNotification('لا يمكن تحديد العميل', 'error');
        return;
    }
    
    document.getElementById('statementBody').innerHTML = '<div style="text-align:center; padding: 50px;"><i class="fas fa-spinner fa-spin"></i> جاري تحميل كشف الحساب...</div>';
    openModal('accountStatementModal');
	    updatePageTitle('كشف حساب', '', '');
	    updateSidebarActive('statement');

    
    // ✅ ملء قائمة الحسابات
    const select = document.getElementById('statementAccount');
    if (select && select.options.length <= 1) {
        select.innerHTML = '<option value="">اختر الحساب...</option>';
        
        if (currentUser?.userType === 'admin') {
            // ✅ المدير يرى كل العملاء
            const allCustomers = [...new Set(invoicesData.map(inv => 
                inv['payee-customer-id'] || inv['contract-customer-id'] || ''
            ).filter(c => c))];
            allCustomers.sort();
            allCustomers.forEach(id => {
                select.innerHTML += `<option value="${id}" ${id === customerId ? 'selected' : ''}>${id}</option>`;
            });
        } else if (currentUser.customerIds && currentUser.customerIds.length > 0) {
            currentUser.customerIds.forEach(id => {
                select.innerHTML += `<option value="${id}" ${id === customerId ? 'selected' : ''}>${id}</option>`;
            });
        } else if (currentUser.contractCustomerId) {
            select.innerHTML += `<option value="${currentUser.contractCustomerId}" selected>${currentUser.contractCustomerId}</option>`;
        } else {
            select.innerHTML += `<option value="${currentUser.taxNumber}" selected>${currentUser.taxNumber}</option>`;
        }
    }
    
    await loadPaymentsFromCloud(currentUser?.username);
    
    const customerInvoices = invoicesData.filter(inv => {
        const payee = inv['payee-customer-id'] || '';
        const contract = inv['contract-customer-id'] || '';
        return payee.includes(customerId) || contract.includes(customerId);
    });
    
    const customerPayments = paymentsData.filter(p => 
        p.customerId === customerId && (p.status === 'confirmed' || p.isOpeningBalance)
    );
    
    await buildAccountStatement(customerInvoices, customerPayments, customerId, '', '');
};

// إغلاق كشف الحساب
window.closeStatementModal = function() {
    const modal = document.getElementById('accountStatementModal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('show');
    }
};

// بناء كشف الحساب
async function buildAccountStatement(invoices, payments, accountId, dateFrom, dateTo) {
    let transactions = [];
	    // ✅ تأكد من تحميل بيانات إشعارات الخصم
    if (typeof creditData !== 'undefined' && creditData.length === 0) {
        await loadCreditDataFromDrive();
    }
    
    // إضافة الفواتير
    invoices.forEach(inv => {
        const currency = inv['currency'] || 'EGP';
        const exRate = inv['flex-string-06'] || 48.0215;
        const originalTotal = inv['total-total'] || 0;
        const martyr = (inv['final-number'] || '').startsWith('P') ? 0 : 5;
        const total = originalTotal + martyr;
        
        let amount, curr;
        if (currency === 'USAD') {
            amount = total / exRate;
            curr = 'USD';
        } else {
            amount = total;
            curr = 'EGP';
        }
        
        transactions.push({
            date: (inv['finalized-date'] || inv['created'] || '').slice(0, 10),
            desc: `فاتورة ${inv['final-number'] || inv['draft-number']}`,
            ref: getInvoiceKey(inv),
            debit: amount,
            credit: 0,
            currency: curr,
            isOpening: false
        });
    });
	
	    // ✅ إضافة إشعارات الخصم كحركات دائنة
    if (typeof creditData !== 'undefined' && creditData.length > 0) {
        const customerCredits = creditData.filter(c => {
            // التحقق من أن الإشعار يخص العميل
            if (!c.customerId) return false;
            const custId = c.customerId.toLowerCase();
            const acc = accountId.toLowerCase();
            return custId.includes(acc) || acc.includes(custId);
        });
        
        customerCredits.forEach(c => {
            const creditDate = c.date ? c.date.slice(0,10) : '';
            // فلترة حسب التاريخ إن وجد
            if (dateFrom && creditDate < dateFrom) return;
            if (dateTo && creditDate > dateTo) return;
            
            const amount = c.displayAmount + c.displayTax; // المبلغ + الضريبة
            const currency = c.currency === 'USAD' ? 'USD' : 'EGP';
            
            transactions.push({
                date: creditDate,
                desc: `إشعار خصم: ${c.finalNumber || c.draftNumber || c.serial || '-'}`,
                ref: c.serial,
                debit: 0,
                credit: amount,
                currency: currency,
                isOpening: false
            });
        });
    }
    
    // إضافة السدادات
    payments.forEach(p => {
        if (p.isOpeningBalance && !dateFrom) {
            const isCredit = p.balanceType !== 'debit';
            transactions.push({
                date: p.date,
                desc: 'رصيد افتتاحي',
                ref: 'OPEN',
                debit: isCredit ? 0 : p.amount,
                credit: isCredit ? p.amount : 0,
                currency: p.currency,
                isOpening: true
            });
        } else if (!p.isOpeningBalance) {
            transactions.push({
                date: p.date,
                desc: `سداد - ${getPaymentMethodName(p.method)}`,
                ref: p.id,
                debit: 0,
                credit: p.amount,
                currency: p.currency,
                isOpening: false
            });
        }
    });
    
    // ترتيب حسب التاريخ
    transactions.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    // ✅ حساب الرصيد المرحل (السابق للفترة)
    let openingBalance = 0;
    let openingCurrency = 'EGP';
    
    if (dateFrom) {
        // جمع كل الحركات قبل تاريخ البداية
        const allInvoices = invoicesData.filter(inv => {
            const payee = (inv['payee-customer-id'] || '').toLowerCase();
            const contract = (inv['contract-customer-id'] || '').toLowerCase();
            const acc = accountId.toLowerCase();
            return payee.includes(acc) || contract.includes(acc);
        });
        
        const allPayments = paymentsData.filter(p => 
            p.customerId === accountId && (p.status === 'confirmed' || p.isOpeningBalance)
        );
        
        allInvoices.forEach(inv => {
            const invDate = (inv['finalized-date'] || inv['created'] || '').slice(0, 10);
            if (invDate && invDate < dateFrom) {
                const currency = inv['currency'] || 'EGP';
                const exRate = inv['flex-string-06'] || 48.0215;
                const originalTotal = inv['total-total'] || 0;
                const martyr = (inv['final-number'] || '').startsWith('P') ? 0 : 5;
                const total = originalTotal + martyr;
                
                if (currency === 'USAD') {
                    openingBalance -= total / exRate;
                    openingCurrency = 'USD';
                } else {
                    openingBalance -= total;
                    openingCurrency = 'EGP';
                }
            }
        });
        
        allPayments.forEach(p => {
            if (p.isOpeningBalance) {
                const isCredit = p.balanceType !== 'debit';
                openingBalance += isCredit ? p.amount : -p.amount;
            } else {
                const payDate = p.date || '';
                if (payDate && payDate < dateFrom) {
                    openingBalance += p.amount;
                }
            }
        });
		
		        // ✅ أضف هنا 👇
        const allCredits = creditData.filter(c => {
            if (!c.customerId) return false;
            const custId = c.customerId.toLowerCase();
            const acc = accountId.toLowerCase();
            return custId.includes(acc) || acc.includes(custId);
        });
        
        allCredits.forEach(c => {
            const creditDate = (c.date || '').slice(0, 10);
            if (creditDate && creditDate < dateFrom) {
                const amount = c.displayAmount + c.displayTax;
                const currency = c.currency === 'USAD' ? 'USD' : 'EGP';
                openingBalance += amount;
                openingCurrency = currency;
            }
        });

    }
    
    // بناء HTML
    let balance = openingBalance;
    let html = `
        <h3>كشف حساب: ${accountId}</h3>
        <p>تاريخ التقرير: ${new Date().toLocaleDateString('ar-EG')}</p>
        ${dateFrom || dateTo ? `<p>الفترة: ${dateFrom || 'البداية'} إلى ${dateTo || 'النهاية'}</p>` : ''}
        <table class="data-table" style="width:100%; margin-top:15px;">
            <thead><tr>
                <th>التاريخ</th><th>البيان</th><th>مدين</th><th>دائن</th><th>الرصيد</th>
            </tr></thead><tbody>`;
    
    // ✅ إضافة صف الرصيد المرحل
    if (dateFrom && openingBalance !== 0) {
        html += `<tr style="background:var(--bg-hover); font-weight:700;">
            <td>${dateFrom}</td>
            <td>رصيد مرحل</td>
            <td>${openingBalance < 0 ? formatNumberWithCommas(Math.abs(openingBalance).toFixed(2)) + ' ' + openingCurrency : '-'}</td>
            <td>${openingBalance > 0 ? formatNumberWithCommas(openingBalance.toFixed(2)) + ' ' + openingCurrency : '-'}</td>
            <td>${formatNumberWithCommas(Math.abs(openingBalance).toFixed(2))} ${openingBalance >= 0 ? 'دائن' : 'مدين'}</td>
        </tr>`;
    }
    
    transactions.forEach(t => {
        balance = balance - t.debit + t.credit;
        
        // ✅ تحديد اللون حسب النوع
        let rowStyle = '';
        if (t.isOpening) {
            rowStyle = 'background: rgba(99,102,241,0.08); font-weight:600;'; // بنفسجي للرصيد الافتتاحي
        } else if (t.desc.startsWith('سداد')) {
            rowStyle = 'background: rgba(34,197,94,0.06);'; // أخضر فاتح للسداد
        } else if (t.desc.startsWith('فاتورة')) {
            rowStyle = ''; // عادي للفواتير
        }
        
        html += `<tr style="${rowStyle}">
            <td>${t.date}</td><td>${t.desc}</td>
            <td>${t.debit > 0 ? formatNumberWithCommas(t.debit.toFixed(2)) + ' ' + t.currency : '-'}</td>
            <td>${t.credit > 0 ? formatNumberWithCommas(t.credit.toFixed(2)) + ' ' + t.currency : '-'}</td>
            <td style="font-weight:700;">${formatNumberWithCommas(Math.abs(balance).toFixed(2))} ${t.currency}</td>
        </tr>`;
    });
    
    html += `</tbody></table>
        <div style="margin-top:15px; padding:12px; background:${balance >= 0 ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)'}; border-radius:8px; text-align:center;">
            <strong>الرصيد النهائي: ${formatNumberWithCommas(Math.abs(balance).toFixed(2))} ${balance >= 0 ? 'دائن (لصالحك)' : 'مدين (عليك)'}</strong>
        </div>`;
    
    document.getElementById('statementBody').innerHTML = html;
}

// الحصول على اسم طريقة السداد بالعربية
function getPaymentMethodName(method) {
    const names = {
        'bank_transfer': 'تحويل بنكي',
        'cash': 'نقدي',
        'cheque': 'شيك',
        'credit_card': 'بطاقة ائتمان',
        'direct_deposit': 'إيداع مباشر',
        'postal_order': 'حوالة بريدية',
        'other': 'أخرى',
        'opening_balance': 'رصيد افتتاحي'
    };
    return names[method] || method;
}

// تصدير كشف الحساب PDF
window.exportStatementPDF = function() {
    const content = document.getElementById('statementBody');
    if (!content || !content.innerHTML.trim()) return;
    
    showNotification('جاري تصدير كشف الحساب PDF...', 'info');
    // يمكن استخدام نفس تقنية html2canvas + jsPDF
    if (typeof html2canvas !== 'undefined' && typeof jspdf !== 'undefined') {
        html2canvas(content).then(canvas => {
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF('p', 'mm', 'a4');
            const imgData = canvas.toDataURL('image/png');
            const imgWidth = 190;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            pdf.addImage(imgData, 'PNG', 10, 10, imgWidth, imgHeight);
            pdf.save(`كشف_حساب_${new Date().toISOString().slice(0,10)}.pdf`);
            showNotification('✅ تم التصدير بنجاح', 'success');
        }).catch(() => {
            showNotification('❌ فشل التصدير', 'error');
        });
    } else {
        showNotification('مكتبات PDF غير متوفرة', 'error');
    }
};

// تصدير كشف الحساب Excel
window.exportStatementExcel = function() {
    const table = document.querySelector('#statementBody table');
    if (!table) return;
    
    const wb = XLSX.utils.table_to_book(table, { sheet: 'كشف حساب' });
    XLSX.writeFile(wb, `كشف_حساب_${new Date().toISOString().slice(0,10)}.xlsx`);
    showNotification('✅ تم التصدير بنجاح', 'success');
};


// ============================================
// عرض كل السدادات (للمدير فقط)
// ============================================

window.openAllPaymentsView = async function() {
    if (!currentUser) {
        showNotification('يرجى تسجيل الدخول', 'error');
        return;
    }
    
    // تحديث مظهر التبويب
    document.querySelectorAll('.type-tab').forEach(tab => tab.classList.remove('active'));
    const paymentsTab = document.querySelector('[onclick="openAllPaymentsView()"]');
    if (paymentsTab) paymentsTab.classList.add('active');
	    updateSidebarActive('payments');
    
    // إخفاء التقارير
    document.getElementById('reportsContainer').style.display = 'none';
    document.getElementById('dataViewContainer').style.display = 'block';
    document.getElementById('pagination').style.display = 'flex';
    
    // إظهار رسالة تحميل
    document.getElementById('dataViewContainer').innerHTML = '<div style="text-align:center; padding: 50px;"><i class="fas fa-spinner fa-spin"></i> جاري تحميل السدادات...</div>';
    document.getElementById('pagination').innerHTML = '';
    
    // تحميل السدادات
    await loadPaymentsFromCloud(currentUser.username);
	    updatePageTitle('السدادات', filteredPayments.length, document.getElementById('totalSum')?.textContent);
    
    // فلترة حسب صلاحيات المستخدم
    if (currentUser.userType !== 'admin') {
        // جمع معرفات المستخدم (رقم ضريبي، رقم عقد، customerIds)
        let userCustomerIds = [];
        if (currentUser.taxNumber) userCustomerIds.push(currentUser.taxNumber.toLowerCase());
        if (currentUser.contractCustomerId) userCustomerIds.push(currentUser.contractCustomerId.toLowerCase());
        if (currentUser.customerIds && Array.isArray(currentUser.customerIds)) {
            currentUser.customerIds.forEach(id => userCustomerIds.push(id.toLowerCase()));
        }
        userCustomerIds = [...new Set(userCustomerIds)]; // إزالة التكرار
        
        console.log('🔍 معرفات المستخدم:', userCustomerIds);
        console.log('📋 إجمالي السدادات قبل الفلترة:', paymentsData.length);
        
        filteredPayments = paymentsData.filter(p => {
            // السداد الذي سجله المستخدم بنفسه
            if (p.createdBy === currentUser.username) return true;
            
            // السداد المرتبط بأحد معرفات العميل (مطابقة كاملة أو جزئية)
            const paymentCustomer = (p.customerId || '').toLowerCase();
            for (const id of userCustomerIds) {
                if (paymentCustomer.includes(id) || id.includes(paymentCustomer)) {
                    return true;
                }
            }
            return false;
        });
        
        console.log('📋 السدادات بعد الفلترة:', filteredPayments.length);
    } else {
        // المدير يرى كل السدادات
        filteredPayments = [...paymentsData];
    }
    
    currentPaymentPage = 1;
    renderPaymentsView();
};

// عرض السدادات كجدول
function renderPaymentsView() {
    if (filteredPayments.length === 0) {
        document.getElementById('dataViewContainer').innerHTML = '<div class="no-data"><i class="fas fa-inbox"></i><p>لا توجد سدادات</p></div>';
        document.getElementById('pagination').innerHTML = '';
        updatePaymentsSummary();
        return;
    }
    
    // ترتيب حسب التاريخ (الأحدث أولاً)
    filteredPayments.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    // ترقيم الصفحات
    const totalPages = itemsPerPagePayments === Infinity ? 1 : Math.ceil(filteredPayments.length / itemsPerPagePayments);
    const start = itemsPerPagePayments === Infinity ? 0 : (currentPaymentPage - 1) * itemsPerPagePayments;
    const end = itemsPerPagePayments === Infinity ? filteredPayments.length : Math.min(start + itemsPerPagePayments, filteredPayments.length);
    const pageData = filteredPayments.slice(start, end);
    
    let html = `
        <div class="table-container">
            <div class="table-toolbar" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; padding:10px; background:#f8f9fa; border-radius:8px;">
                <div>
                    <button class="btn btn-primary" onclick="openPaymentModal()"><i class="fas fa-plus"></i> سداد جديد</button>
                    <button class="btn btn-info" onclick="openAllPaymentsView()" style="background:#4cc9f0;"><i class="fas fa-sync-alt"></i> تحديث</button>
                </div>
                <div>
                    <span>إجمالي السدادات: <strong>${filteredPayments.length}</strong></span>
                </div>
            </div>
            <table class="data-table">
                <thead>
                    <tr>
                        <th>رقم السداد</th>
                        <th>العميل</th>
                        <th>المبلغ</th>
                        <th>العملة</th>
                        <th>الطريقة</th>
                        <th>التاريخ</th>
                        <th>الحالة</th>
                        <th>مرفقات</th>
                        <th>إجراءات</th>
                    </tr>
                </thead>
                <tbody>`;
    
    pageData.forEach(p => {
        const statusLabels = { 'pending': '⏳ قيد الانتظار', 'confirmed': '✅ مؤكد', 'rejected': '❌ مرفوض', 'cancelled': '🚫 ملغي' };
        const statusColors = { 'pending': '#f39c12', 'confirmed': '#27ae60', 'rejected': '#e74c3c', 'cancelled': '#95a5a6' };
        const hasInvoices = p.linkedInvoices && p.linkedInvoices.length > 0;
        
        html += `<tr onclick="togglePaymentInvoices('${p.id}')" style="cursor:pointer;">
            <td style="cursor:pointer; color:#4361ee; font-weight:600;">
                ${p.id}
                ${hasInvoices ? ` <i class="fas fa-chevron-down" id="paymentIcon-${p.id}" style="font-size:0.7em; color:#999;"></i>` : ''}
            </td>
            <td>${p.customerId || '-'}</td>
            <td>${formatNumberWithCommas(p.amount.toFixed(2))}</td>
            <td>${p.currency}</td>
            <td>${getPaymentMethodName(p.method)}</td>
            <td>${p.date}</td>
            <td><span style="background:${statusColors[p.status]}; color:white; padding:3px 10px; border-radius:50px; font-size:0.85em;">${statusLabels[p.status] || p.status}</span></td>
            <td style="text-align:center;">
                ${p.attachments && p.attachments.length > 0 ? 
                    `<button class="action-btn" onclick="event.stopPropagation(); viewAttachments('${p.id}')" title="عرض المرفقات (${p.attachments.length})" style="background:#4cc9f0; color:white;">
                        <i class="fas fa-paperclip"></i> ${p.attachments.length}
                    </button>` : 
                    '<span style="font-size:0.8em; color:#999;">-</span>'}
            </td>
            <td>
                ${p.status === 'pending' && currentUser?.userType === 'admin' ? `
                    <button class="action-btn edit" onclick="event.stopPropagation(); confirmPaymentInCloud('${p.id}')" title="تأكيد"><i class="fas fa-check"></i></button>
                    <button class="action-btn delete" onclick="event.stopPropagation(); rejectPaymentPrompt('${p.id}')" title="رفض"><i class="fas fa-times"></i></button>
                ` : ''}
                ${p.status === 'pending' && currentUser?.userType !== 'admin' && p.createdBy === currentUser?.username ? `
                    <button class="action-btn delete" onclick="event.stopPropagation(); cancelPaymentInCloud('${p.id}')" title="حذف"><i class="fas fa-trash"></i></button>
                ` : ''}
                ${p.status === 'confirmed' || p.status === 'rejected' ? `
                    <button class="action-btn" onclick="event.stopPropagation(); viewAttachments('${p.id}')" title="عرض"><i class="fas fa-eye"></i></button>
                ` : ''}
            </td>
        </tr>`;
        
        // ✅ صف فرعي للفواتير المرتبطة (مخفي افتراضياً)
        if (hasInvoices) {
            html += `<tr id="paymentInvoices-${p.id}" style="display:none; background:var(--bg-hover);">
                <td colspan="10" style="padding:15px;">
                    <div style="background:var(--bg-card); border-radius:8px; padding:12px; border:1px solid var(--border);">
                        <h4 style="margin-bottom:10px; color:var(--primary);">الفواتير المرتبطة بالسداد</h4>
                        <table style="width:100%; font-size:0.8em;">
                            <thead><tr>
                                <th>رقم الفاتورة</th>
                                <th>التاريخ</th>
                                <th>السفينة</th>
                                <th>${currentInvoiceType === INVOICE_TYPES.POSTPONED ? 'IB/OB ID' : 'البوليصة'}</th>
                                <th>تاريخ الرحلة</th>
                                <th>الإجمالي</th>
                            </tr></thead>
                            <tbody>
                                ${p.linkedInvoices.map(key => {
                                    const inv = invoicesData.find(i => getInvoiceKey(i) === key);
                                    if (inv) {
                                        const currency = inv['currency'] || 'EGP';
                                        const exRate = inv['flex-string-06'] || 48.0215;
                                        const total = (inv['total-total'] || 0) + ((inv['final-number'] || '').startsWith('P') ? 0 : 5);
                                        const invDate = (inv['finalized-date'] || inv['created'] || '').slice(0, 10);
                                        const voyageDate = inv['flex-date-02'] ? inv['flex-date-02'].slice(0, 10) : '-';
                                        
                                        let displayTotal, displayCurrency;
                                        if (currency === 'USAD') {
                                            displayTotal = (total / exRate).toFixed(2);
                                            displayCurrency = 'USD';
                                        } else {
                                            displayTotal = total.toFixed(2);
                                            displayCurrency = 'EGP';
                                        }
                                        
                                        return `<tr>
                                            <td><strong>${inv['final-number'] || inv['draft-number'] || key}</strong></td>
                                            <td>${invDate}</td>
                                            <td>${inv['key-word1'] || '-'}</td>
                                            <td>${inv['key-word2'] || '-'}</td>
                                            <td>${voyageDate}</td>
                                            <td style="font-weight:600;">${formatNumberWithCommas(displayTotal)} ${displayCurrency}</td>
                                        </tr>`;
                                    }
                                    return `<tr><td>${key}</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td></tr>`;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </td>
            </tr>`;
        }
    });
    
    html += `</tbody></table></div>`;
    
    document.getElementById('dataViewContainer').innerHTML = html;
    
    // ترقيم الصفحات
    renderPaymentsPagination(totalPages);
    updatePaymentsSummary();
}

// ترقيم صفحات السدادات
function renderPaymentsPagination(totalPages) {
    if (itemsPerPagePayments === Infinity || totalPages <= 1) {
        document.getElementById('pagination').innerHTML = '';
        return;
    }
    
    let html = '';
    html += `<button class="pagination-btn" onclick="changePaymentPage(${currentPaymentPage - 1})" ${currentPaymentPage === 1 ? 'disabled' : ''}><i class="fas fa-chevron-right"></i></button>`;
    
    for (let i = 1; i <= totalPages; i++) {
        html += `<button class="pagination-btn ${i === currentPaymentPage ? 'active' : ''}" onclick="changePaymentPage(${i})">${i}</button>`;
    }
    
    html += `<button class="pagination-btn" onclick="changePaymentPage(${currentPaymentPage + 1})" ${currentPaymentPage === totalPages ? 'disabled' : ''}><i class="fas fa-chevron-left"></i></button>`;
    
    document.getElementById('pagination').innerHTML = html;
}

// تغيير صفحة السدادات
function changePaymentPage(page) {
    const totalPages = itemsPerPagePayments === Infinity ? 1 : Math.ceil(filteredPayments.length / itemsPerPagePayments);
    if (page >= 1 && page <= totalPages) {
        currentPaymentPage = page;
        renderPaymentsView();
    }
}

// تحديث ملخص السدادات
function updatePaymentsSummary() {
    let totalConfirmed = 0;
    let totalPending = 0;
    
    filteredPayments.forEach(p => {
        if (p.status === 'confirmed' || p.isOpeningBalance) {
            totalConfirmed += p.amount;
        } else if (p.status === 'pending') {
            totalPending += p.amount;
        }
    });
    
    document.getElementById('invoiceCount').textContent = filteredPayments.length;
    document.getElementById('totalSum').innerHTML = totalConfirmed.toFixed(2);
    document.getElementById('taxSum').innerHTML = totalPending.toFixed(2);
    document.getElementById('totalUSD').innerHTML = '0.00';
    document.getElementById('totalEGPWithoutTax').innerHTML = '0.00';
    document.getElementById('totalMartyr').innerHTML = '0.00';
}

// طلب سبب الرفض
window.rejectPaymentPrompt = function(paymentId) {
    const reason = prompt('أدخل سبب الرفض:');
    if (reason !== null && reason.trim() !== '') {
        rejectPaymentInCloud(paymentId, reason).then(result => {
            if (result?.success) {
                openAllPaymentsView(); // تحديث العرض
            }
        });
    }
};

// ============================================
// إضافة رصيد افتتاحي (للمدير فقط)
// ============================================
window.openOpeningBalanceModal = function() {
    if (currentUser?.userType !== 'admin') {
        showNotification('غير مصرح', 'error');
        return;
    }
    
    document.getElementById('openingDate').value = new Date().toISOString().slice(0, 10);
    document.getElementById('openingAmount').value = '';
    document.getElementById('openingNotes').value = '';
    document.getElementById('openingMessage').style.display = 'none';
    
    // ملء قائمة العملاء
    const select = document.getElementById('openingCustomer');
    select.innerHTML = '<option value="">اختر العميل...</option>';
    
    if (currentUser?.userType === 'admin') {
        const customers = [...new Set(invoicesData.map(inv => 
            inv['payee-customer-id'] || inv['contract-customer-id'] || ''
        ).filter(c => c))];
        customers.sort();
        customers.forEach(c => {
            select.innerHTML += `<option value="${c}">${c}</option>`;
        });
    }
    
    // ✅ عند تغيير العميل، تحميل رصيده الحالي
    select.onchange = async function() {
        const customerId = this.value;
        if (!customerId) return;
        
        await loadPaymentsFromCloud(currentUser.username);
        
        const existing = paymentsData.find(p => 
            p.isOpeningBalance === true && p.customerId === customerId
        );
        
        if (existing) {
            document.getElementById('openingAmount').value = existing.amount;
            document.getElementById('openingCurrency').value = existing.currency || 'EGP';
            document.getElementById('openingDate').value = existing.date || '';
            document.getElementById('openingNotes').value = existing.notes || '';
            document.getElementById('openingType').value = existing.balanceType || 'credit';
            showOpeningMessage('⚠️ يوجد رصيد افتتاحي سابق. سيتم تحديثه.', 'info');
        } else {
            document.getElementById('openingAmount').value = '';
            document.getElementById('openingNotes').value = '';
            document.getElementById('openingMessage').style.display = 'none';
        }
    };
    
    document.getElementById('openingBalanceModal').style.display = 'block';
};

window.closeOpeningBalanceModal = function() {
    document.getElementById('openingBalanceModal').style.display = 'none';
};

// عرض سداداته (للعميل والمحاسب)
window.openMyPayments = async function() {
    if (!currentUser) return;
    
    document.getElementById('dataViewContainer').innerHTML = '<div style="text-align:center; padding: 50px;"><i class="fas fa-spinner fa-spin"></i> جاري تحميل سدادتك...</div>';
    document.getElementById('pagination').innerHTML = '';
    
    await loadPaymentsFromCloud(currentUser.username);
    filteredPayments = [...paymentsData];
    currentPaymentPage = 1;
    renderPaymentsView();
};

// فتح تبويب السدادات (حسب الصلاحية)
window.openPaymentsTab = async function() {
    if (!currentUser) return;
    
    // تحديث مظهر التبويب
    document.querySelectorAll('.type-tab').forEach(tab => tab.classList.remove('active'));
    const paymentsTab = document.querySelector('[onclick="openPaymentsTab()"]');
    if (paymentsTab) paymentsTab.classList.add('active');
    
    // إخفاء تقارير الفواتير إن كانت ظاهرة
    document.getElementById('reportsContainer').style.display = 'none';
    document.getElementById('dataViewContainer').style.display = 'block';
    document.getElementById('pagination').style.display = 'flex';
    
    document.getElementById('dataViewContainer').innerHTML = '<div style="text-align:center; padding: 50px;"><i class="fas fa-spinner fa-spin"></i> جاري تحميل السدادات...</div>';
    document.getElementById('pagination').innerHTML = '';
    
    // تحميل السدادات
    await loadPaymentsFromCloud(currentUser.username);
    
    if (currentUser.userType === 'admin') {
        // المدير يرى كل السدادات
        filteredPayments = [...paymentsData];
    } else {
        // باقي المستخدمين يرون سدادتهم فقط
        // جمع معرفات المستخدم
        let userCustomerIds = [];
        if (currentUser.taxNumber) userCustomerIds.push(currentUser.taxNumber.toLowerCase());
        if (currentUser.contractCustomerId) userCustomerIds.push(currentUser.contractCustomerId.toLowerCase());
        if (currentUser.customerIds && Array.isArray(currentUser.customerIds)) {
            currentUser.customerIds.forEach(id => userCustomerIds.push(id.toLowerCase()));
        }
        userCustomerIds = [...new Set(userCustomerIds)]; // إزالة التكرار
        
        console.log('🔍 معرفات المستخدم:', userCustomerIds);
        console.log('📋 إجمالي السدادات قبل الفلترة:', paymentsData.length);
        
        filteredPayments = paymentsData.filter(p => {
            // السداد الذي سجله المستخدم بنفسه
            if (p.createdBy === currentUser.username) return true;
            
            // السداد المرتبط بأحد معرفات العميل
            const paymentCustomer = (p.customerId || '').toLowerCase();
            for (const id of userCustomerIds) {
                if (paymentCustomer.includes(id) || id.includes(paymentCustomer)) {
                    return true;
                }
            }
            return false;
        });
        
        console.log('📋 السدادات بعد الفلترة:', filteredPayments.length);
    }
    
    currentPaymentPage = 1;
    renderPaymentsView();
};

// ✅ تشخيص العناصر المفقودة
const originalSetInnerHTML = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
if (originalSetInnerHTML && originalSetInnerHTML.set) {
    Object.defineProperty(Element.prototype, 'innerHTML', {
        set: function(value) {
            try {
                originalSetInnerHTML.set.call(this, value);
            } catch(e) {
                console.log('❌ innerHTML خطأ:', e.message);
            }
        },
        get: function() {
            return originalSetInnerHTML.get.call(this);
        },
        configurable: true
    });
}
// ============================================
// التهيئة الرئيسية
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('بدء تشغيل النظام...');
	    // ✅ استعادة الوضع المحفوظ (داكن/فاتح)
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
        document.body.classList.remove('dark-mode');
        document.body.classList.add('light-mode');
        const icon = document.getElementById('themeIcon');
        if (icon) icon.className = 'fas fa-sun';
    }
    loadDriveSettings();
	
	
	// ✅ استدعاء تحميل التوكن
    //await loadRefreshTokenFromDrive();
    
    // تحميل الشعار من Drive
    await loadLogoFromDrive();
    
    const isQRCode = await handleQRCodeLink();
    
    if (!isQRCode) {
        await autoConfigureDrive();
        await loadUsers();
        await initDatabase();
        checkSession();
        
        document.getElementById('fileInput')?.addEventListener('change', handleFileUpload);
        document.getElementById('sortSelect')?.addEventListener('change', () => { 
    currentSortField = document.getElementById('sortSelect').value; 
    if (currentInvoiceType === INVOICE_TYPES.CREDIT) {
        currentCreditSortField = currentSortField;
        renderCreditData();
    } else {
        renderData();
    }
});
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


// دالة للتحقق مما إذا كانت الفاتورة تخص المستخدم الحالي
function checkIfInvoiceBelongsToUser(invoice) {
    if (!currentUser) return false;
    
    if (currentUser.userType === 'admin') return true;
    
    if (currentUser.isGuest) {
        const taxNumber = currentUser.taxNumber;
        if (!taxNumber) return false;
        const payeeMatch = (invoice['payee-customer-id'] || '').toLowerCase().includes(taxNumber.toLowerCase());
        const contractMatch = (invoice['contract-customer-id'] || '').toLowerCase().includes(taxNumber.toLowerCase());
        return payeeMatch || contractMatch;
    }
    
    // المستخدم العادي (محاسب أو عميل)
    let allowedIds = [];
    if (currentUser.contractCustomerId) allowedIds.push(currentUser.contractCustomerId.toLowerCase());
    if (currentUser.customerIds && Array.isArray(currentUser.customerIds)) {
        allowedIds = allowedIds.concat(currentUser.customerIds.map(id => id.toLowerCase()));
    }
    allowedIds = [...new Set(allowedIds)];
    
    if (allowedIds.length === 0) return false;
    
    const payeeId = (invoice['payee-customer-id'] || '').toLowerCase();
    const contractId = (invoice['contract-customer-id'] || '').toLowerCase();
    
    return allowedIds.some(id => payeeId === id || contractId === id);
}


async function exportReportAsProfessionalPDF(reportHtml, reportTitle) {
    const pages = splitReportIntoPages(reportHtml, 15);
    if (pages.length === 0) {
        showNotification('لا توجد بيانات للتقرير', 'error');
        return;
    }
    if (typeof window.jspdf === 'undefined' || typeof window.html2canvas === 'undefined') {
        showNotification('مكتبات PDF غير متوفرة', 'error');
        return;
    }
    showProgress('جاري إنشاء التقرير...', 10);
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
    const margin = 10;
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const contentWidth = pdfWidth - (margin * 2);
    
    try {
        for (let idx = 0; idx < pages.length; idx++) {
            const pageHtml = pages[idx].html;
            const tempDiv = document.createElement('div');
            tempDiv.style.position = 'absolute';
            tempDiv.style.left = '-9999px';
            tempDiv.style.top = '-9999px';
            tempDiv.style.width = '1100px';
            tempDiv.style.background = 'white';
            tempDiv.style.padding = '20px';
            tempDiv.style.direction = 'rtl';
            tempDiv.innerHTML = pageHtml;
            document.body.appendChild(tempDiv);
            
            await new Promise(resolve => setTimeout(resolve, 150));
            const canvas = await html2canvas(tempDiv, {
                scale: 2.2,
                backgroundColor: '#ffffff',
                logging: false,
                useCORS: true,
                windowWidth: tempDiv.scrollWidth,
                windowHeight: tempDiv.scrollHeight
            });
            
            const imgData = canvas.toDataURL('image/jpeg', 0.9);
            const imgHeight = (canvas.height * contentWidth) / canvas.width;
            if (idx > 0) pdf.addPage();
            pdf.addImage(imgData, 'JPEG', margin, margin, contentWidth, imgHeight);
            document.body.removeChild(tempDiv);
        }
        const fileName = `${reportTitle}_${new Date().toISOString().slice(0,19).replace(/:/g, '-')}.pdf`;
        pdf.save(fileName);
        showNotification(`تم تصدير التقرير (${pages.length} صفحات) بنجاح`, 'success');
    } catch (err) {
        console.error(err);
        showNotification('حدث خطأ في تصدير PDF', 'error');
    } finally {
        hideProgress();
    }
}


async function exportDirectPDF() {
    if (selectedInvoices.size === 0) {
        showNotification('لم يتم تحديد أي فواتير', 'warning');
        return;
    }
    // جمع الفواتير المحددة وبناء HTML (نفس الكود الموجود في exportSelectedReport)
    // ... (انسخ الكود من exportSelectedReport حتى إنشاء reportHtmlWithoutSummary)
    // ثم:
    await exportReportAsProfessionalPDF(reportHtmlWithoutSummary, 'تقرير_فواتير');
}

// ============================================
// نظام التحديث التلقائي (Auto Refresh)
// ============================================

// ========== دوال التحديث التلقائي (النسخة النهائية الموحدة) ==========
let refreshIntervalId = null;
let currentRefreshEnabled = false;
let currentRefreshMinutes = 30;

// تحديث واجهة الحالة داخل النافذة
function updateRefreshStatusDisplay() {
    const statusDiv = document.getElementById('refreshStatus');
    if (!statusDiv) return;
    if (currentRefreshEnabled && currentRefreshMinutes >= 30) {
        statusDiv.innerHTML = `<i class="fas fa-check-circle"></i> ✅ مفعل - التحديث كل ${currentRefreshMinutes} دقيقة`;
        statusDiv.style.background = '#d4edda';
        statusDiv.style.color = '#155724';
    } else {
        statusDiv.innerHTML = `<i class="fas fa-ban"></i> ❌ غير مفعل`;
        statusDiv.style.background = '#f8d7da';
        statusDiv.style.color = '#721c24';
    }
}

// إيقاف المؤقت
function stopRefreshTimer() {
    if (refreshIntervalId) {
        clearInterval(refreshIntervalId);
        refreshIntervalId = null;
    }
    currentRefreshEnabled = false;
    updateRefreshStatusDisplay();
    console.log('تم إيقاف التحديث التلقائي');
}

// بدء المؤقت
function startRefreshTimer(minutes) {
    if (refreshIntervalId) stopRefreshTimer(); // إيقاف القديم
    if (!minutes || minutes < 30) {
        currentRefreshEnabled = false;
        updateRefreshStatusDisplay();
        return;
    }
    currentRefreshEnabled = true;
    currentRefreshMinutes = minutes;
    refreshIntervalId = setInterval(async () => {
        console.log(`تحديث تلقائي بعد ${minutes} دقيقة`);
        if (currentUser) {
            await loadInvoicesFromDrive();
            if (currentUser.isGuest) {
                filterInvoicesByGuest(currentUser.taxNumber, currentUser.blNumber);
            } else {
                filterInvoicesByUser();
            }
            renderData();
            showNotification('تم تحديث البيانات تلقائياً', 'success');
        }
    }, minutes * 60 * 1000);
    updateRefreshStatusDisplay();
    console.log(`تم تفعيل التحديث التلقائي كل ${minutes} دقيقة`);
}

function applyRefreshSetting() {
    const enabled = localStorage.getItem('refresh_enabled') === 'true';
    const minutes = parseInt(localStorage.getItem('refresh_minutes') || '30');
    if (enabled && minutes >= 30) {
        startRefreshTimer(minutes);
    } else {
        stopRefreshTimer();
    }
}

// حفظ الإعدادات من النافذة
window.saveRefreshSettings = function() {
    const enabledSelect = document.getElementById('refreshEnabled');
    const intervalInput = document.getElementById('refreshInterval');
    if (!enabledSelect || !intervalInput) {
        showNotification('حدث خطأ في النافذة', 'error');
        return;
    }
    const enabled = enabledSelect.value === 'true';
    let minutes = parseInt(intervalInput.value);
    if (isNaN(minutes)) minutes = 30;
    if (enabled && minutes < 30) {
        showNotification('⚠️ الحد الأدنى 30 دقيقة', 'warning');
        return;
    }
    if (enabled && minutes > 1440) minutes = 1440;
    
    // حفظ في localStorage
    localStorage.setItem('refresh_enabled', enabled ? 'true' : 'false');
    if (enabled) {
        localStorage.setItem('refresh_minutes', minutes);
        startRefreshTimer(minutes);
    } else {
        localStorage.removeItem('refresh_minutes');
        stopRefreshTimer();
    }
    // تحديث واجهة النافذة
    updateRefreshSettingsForm();
    closeRefreshSettingsModal();
    showNotification(enabled ? `✅ تم تفعيل التحديث كل ${minutes} دقيقة` : '⏸️ تم إيقاف التحديث التلقائي', 'success');
};

// تحميل الإعدادات من localStorage وتطبيقها
function loadRefreshSettings() {
    const enabled = localStorage.getItem('refresh_enabled') === 'true';
    const minutes = parseInt(localStorage.getItem('refresh_minutes') || '30');
    if (enabled && minutes >= 30) {
        startRefreshTimer(minutes);
    } else {
        stopRefreshTimer();
    }
    updateRefreshSettingsForm();
}

// تحديث حقول النافذة بناءً على المتغيرات الحالية (وليس localStorage)
function updateRefreshSettingsForm() {
    const enabledSelect = document.getElementById('refreshEnabled');
    const intervalInput = document.getElementById('refreshInterval');
    if (!enabledSelect || !intervalInput) return;
    // استخدم currentRefreshEnabled و currentRefreshMinutes بدلاً من localStorage
    enabledSelect.value = currentRefreshEnabled ? 'true' : 'false';
    intervalInput.value = currentRefreshMinutes;
    updateRefreshStatusDisplay();
}

// فتح النافذة
window.openRefreshSettings = function() {
    if (!currentUser) {
        showNotification('يرجى تسجيل الدخول أولاً', 'warning');
        return;
    }
    updateRefreshSettingsForm(); // تعرض القيم الحالية
    const modal = document.getElementById('refreshSettingsModal');
    if (modal) modal.style.display = 'block';
};

// إغلاق النافذة
window.closeRefreshSettingsModal = function() {
    const modal = document.getElementById('refreshSettingsModal');
    if (modal) modal.style.display = 'none';
};

// تحديث يدوي فوري
window.manualRefresh = async function() {
    if (!currentUser) return;
    showNotification('🔄 جاري التحديث اليدوي...', 'info');
    await loadInvoicesFromDrive();
    if (currentUser.isGuest) {
        filterInvoicesByGuest(currentUser.taxNumber, currentUser.blNumber);
    } else {
        filterInvoicesByUser();
    }
    renderData();
    showNotification('✅ تم التحديث اليدوي بنجاح', 'success');
};

// عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
    loadRefreshSettings();
});


// ============================================
// شريط الأخبار المتحرك - نسخة بطيئة ومستقرة
// ============================================

async function loadNewsFromDrive() {
    const newsBar = document.getElementById('newsBar');
    const newsContent = document.getElementById('newsTickerContent');
    
    if (!newsBar || !newsContent) {
        console.error('❌ عناصر شريط الأخبار غير موجودة');
        return;
    }

    const newsUrl = 'https://raw.githubusercontent.com/revenudchc-boop/DCHC/main/news.txt';

    try {
        newsContent.innerHTML = '<div class="news-item"><i class="fas fa-spinner fa-spin"></i> جاري تحميل الأخبار...</div>';
        newsBar.style.display = 'flex';
        
        const response = await fetch(newsUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const content = await response.text();
        
        let newsItems = content.split(/\r?\n/).filter(line => line.trim() !== '');
        if (newsItems.length === 0) newsItems = ['مرحباً بك في نظام الفواتير المتقدم'];
        
        let html = '';
        for (let repeat = 0; repeat < 3; repeat++) {
            newsItems.forEach((item, idx) => {
                let icon = 'fas fa-star';
                if (item.includes('عاجل') || item.includes('هام')) icon = 'fas fa-bolt';
                else if (item.includes('تحديث')) icon = 'fas fa-sync-alt';
                else if (item.includes('جديد')) icon = 'fas fa-gift';
                else if (item.includes('🎉')) icon = 'fas fa-party-horn';
                
                html += `<div class="news-item"><i class="${icon} news-icon"></i><span>${escapeHtmlNews(item)}</span></div>`;
                if (idx < newsItems.length - 1) html += `<span class="news-separator">✦</span>`;
            });
            if (repeat < 2) html += `<span class="news-separator" style="margin:0 25px;">◆ ◆ ◆</span>`;
        }
        
        newsContent.innerHTML = html;
        
        const ticker = document.querySelector('.news-ticker');
        if (ticker) {
            // إزالة الأنيميشن القديمة
            ticker.style.animation = 'none';
            // إعادة تعيين
            ticker.offsetHeight;
            // حساب السرعة
            const contentWidth = newsContent.scrollWidth;
            const duration = Math.max(30, Math.min(80, contentWidth / 40));
            // تعيين الأنيميشن الجديدة
            ticker.style.animation = `tickerScroll ${duration}s linear infinite`;
            console.log(`✅ سرعة الشريط: ${duration} ثانية`);
        }
        
    } catch (error) {
        console.error('خطأ في تحميل الأخبار:', error);
        const newsContentElem = document.getElementById('newsTickerContent');
        if (newsContentElem) {
            newsContentElem.innerHTML = '<div class="news-item">⚠️ تعذر تحميل الأخبار</div>';
        }
        const newsBarElem = document.getElementById('newsBar');
        if (newsBarElem) newsBarElem.style.display = 'flex';
    }
}

// دالة تنظيف النص من الرموز الضارة
function escapeHtmlNews(str) {
    if (!str) return '';
    return str
        .replace(/[&<>]/g, function(m) {
            if (m === '&') return '&amp;';
            if (m === '<') return '&lt;';
            if (m === '>') return '&gt;';
            return m;
        })
        .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, function(c) {
            return c; // الحفاظ على الرموز التعبيرية (Emoji)
        });
}

// تهيئة شريط الأخبار (يتم استدعاؤها بعد تسجيل الدخول)
function initNewsBar() {
    const newsBar = document.getElementById('newsBar');
    const newsContent = document.getElementById('newsTickerContent');
    
    if (!newsBar && !newsContent) {
        console.warn('⚠️ عناصر شريط الأخبار غير موجودة، تجاهل التحميل');
        return;
    }

    const newsUrl = 'https://raw.githubusercontent.com/revenudchc-boop/DCHC/main/news.txt';

    try {
        if (newsContent) {
            newsContent.innerHTML = '<div class="news-item"><i class="fas fa-spinner fa-spin"></i> جاري تحميل الأخبار...</div>';
        }
        if (newsBar) {
            newsBar.style.display = 'flex';
        }
        
        fetch(newsUrl)
            .then(response => {
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return response.text();
            })
            .then(content => {
                let newsItems = content.split(/\r?\n/).filter(line => line.trim() !== '');
                if (newsItems.length === 0) newsItems = ['مرحباً بك في نظام الفواتير المتقدم'];
                
                let html = '';
                for (let repeat = 0; repeat < 3; repeat++) {
                    newsItems.forEach((item, idx) => {
                        let icon = 'fas fa-star';
                        if (item.includes('عاجل') || item.includes('هام')) icon = 'fas fa-bolt';
                        else if (item.includes('تحديث')) icon = 'fas fa-sync-alt';
                        else if (item.includes('جديد')) icon = 'fas fa-gift';
                        else if (item.includes('🎉')) icon = 'fas fa-party-horn';
                        
                        html += `<div class="news-item"><i class="${icon} news-icon"></i><span>${escapeHtmlNews(item)}</span></div>`;
                        if (idx < newsItems.length - 1) html += `<span class="news-separator">✦</span>`;
                    });
                    if (repeat < 2) html += `<span class="news-separator" style="margin:0 25px;">◆ ◆ ◆</span>`;
                }
                
                if (newsContent) {
                    newsContent.innerHTML = html;
                }
                
                const ticker = document.querySelector('.news-ticker');
                if (ticker) {
                    ticker.style.animation = 'none';
                    ticker.offsetHeight;
                    const contentWidth = newsContent ? newsContent.scrollWidth : 1000;
                    const duration = Math.max(30, Math.min(80, contentWidth / 40));
                    ticker.style.animation = `tickerScroll ${duration}s linear infinite`;
                }
            })
            .catch(error => {
                console.error('خطأ في تحميل الأخبار:', error);
                if (newsContent) {
                    newsContent.innerHTML = '<div class="news-item">⚠️ تعذر تحميل الأخبار</div>';
                }
            });
            
    } catch (error) {
        console.error('خطأ في تهيئة شريط الأخبار:', error);
    }
}

// دالة إعادة ضبط سرعة الشريط (اختيارية - يمكن استدعاؤها يدوياً)
function setNewsTickerSpeed(seconds) {
    const ticker = document.querySelector('.news-ticker');
    if (ticker) {
        ticker.style.animation = 'none';
        ticker.offsetHeight;
        ticker.style.animation = `scrollTicker ${seconds}s linear infinite`;
        console.log(`✅ تم تغيير سرعة الشريط إلى ${seconds} ثانية`);
    }
}

window.initNewsBar = initNewsBar;

function toggleNewsBar() {
    const newsBar = document.getElementById('newsBarContainer');
    if (newsBar) {
        if (newsBar.style.display === 'none') {
            newsBar.style.display = 'flex';
        } else {
            newsBar.style.display = 'none';
        }
    }
}

// عرض مرفقات السداد
window.viewAttachments = function(paymentId) {
    const payment = paymentsData.find(p => p.id === paymentId);
    if (!payment || !payment.attachments || payment.attachments.length === 0) {
        showNotification('لا توجد مرفقات لهذا السداد', 'info');
        return;
    }
    
    let html = '<div style="padding:10px;">';
    html += `<h4>مرفقات السداد: ${payment.id}</h4>`;
    html += '<div style="display:flex; flex-wrap:wrap; gap:10px; margin-top:10px;">';
    
    payment.attachments.forEach((att, i) => {
        const isImage = att.name.match(/\.(jpg|jpeg|png|gif)$/i);
        const isPDF = att.name.match(/\.pdf$/i);
        
        html += `<div style="border:1px solid #ddd; border-radius:8px; padding:10px; text-align:center; width:150px;">
            ${isImage ? 
                `<img src="https://drive.google.com/thumbnail?id=${att.id}" style="width:100%; height:100px; object-fit:cover; border-radius:4px;" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22><rect fill=%22%23ddd%22 width=%22100%22 height=%22100%22/><text x=%2250%22 y=%2255%22 text-anchor=%22middle%22 fill=%22%23999%22>📄</text></svg>'">` : 
                `<div style="width:100%; height:100px; background:#f0f0f0; border-radius:4px; display:flex; align-items:center; justify-content:center; font-size:2em;">📄</div>`}
            <div style="font-size:0.75em; margin-top:5px; word-break:break-all;">${att.name}</div>
            <a href="${att.url}" target="_blank" style="font-size:0.7em; color:#4361ee;">فتح</a>
        </div>`;
    });
    
    html += '</div></div>';
    
    document.getElementById('modalBody').innerHTML = html;
    document.getElementById('modalTitle').textContent = 'مرفقات السداد';
    document.getElementById('invoiceModal').style.display = 'block';
};

// سداد سريع من جدول الفواتير
window.quickPayInvoice = async function(invoiceKey, customerId, totalAmount, currency) {
    if (!currentUser) {
        showNotification('يرجى تسجيل الدخول', 'warning');
        return;
    }
    
    // ✅ تصحيح العملة - USAD تصبح USD
    let correctedCurrency = currency || 'EGP';
    if (correctedCurrency === 'USAD') correctedCurrency = 'USD';
    
    // ✅ تحميل السدادات من السحابة لحساب المبلغ المدفوع
    await loadPaymentsFromCloud(currentUser.username);
    
    // ✅ المبلغ المرسل هو المتبقي بالفعل، لا نحتاج لخصم المدفوع مرة أخرى
    const remaining = totalAmount;
    
    // ✅ لكن نحتاج حساب المدفوع للعرض فقط
    let totalPaid = 0;
    paymentsData.forEach(p => {
        if (p.status === 'confirmed' || p.isOpeningBalance) {
            if (p.linkedInvoices && Array.isArray(p.linkedInvoices) && p.linkedInvoices.includes(invoiceKey)) {
                const amountPerInvoice = p.linkedInvoices.length > 0 ? p.amount / p.linkedInvoices.length : p.amount;
                totalPaid += amountPerInvoice;
            }
        }
    });
    
    // ✅ إذا تم السداد كلياً، لا داعي لفتح النافذة
    if (remaining <= 0.01) {
        showNotification('✅ هذه الفاتورة مسددة بالكامل', 'success');
        return;
    }
    
    // ✅ تحديد العميل الصحيح
    let finalCustomerId = customerId;
    if (currentUser?.userType === 'admin') {
        finalCustomerId = customerId;
    } else if (currentUser && currentUser.customerIds && currentUser.customerIds.length > 0) {
        const customerLower = customerId.toLowerCase();
        const matched = currentUser.customerIds.find(id => 
            customerLower.includes(id.toLowerCase()) || 
            id.toLowerCase().includes(customerLower)
        );
        if (matched) {
            finalCustomerId = matched;
        } else {
            finalCustomerId = currentUser.customerIds[0];
        }
    } else if (currentUser && currentUser.contractCustomerId) {
        finalCustomerId = currentUser.contractCustomerId;
    }
    
    // ✅ تفعيل مؤشر السداد السريع - يمنع openPaymentModal من تحميل الفواتير
    isQuickPayment = true;
    
    // ✅ فتح النافذة (لن تحمل الفواتير بسبب isQuickPayment = true)
    openPaymentModal();
    
    // ✅ انتظار فتح النافذة بالكامل
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // ✅ تعبئة الحقول تلقائياً
    document.getElementById('paymentCustomer').value = finalCustomerId;
    document.getElementById('paymentAmount').value = remaining.toFixed(2);
    document.getElementById('paymentCurrency').value = correctedCurrency;
    document.getElementById('paymentDate').value = new Date().toISOString().slice(0, 10);
    
    // ✅ البحث عن بيانات الفاتورة للعرض
    const inv = invoicesData.find(i => getInvoiceKey(i) === invoiceKey);
    const invNum = inv ? (inv['final-number'] || inv['draft-number'] || invoiceKey) : invoiceKey;
    
    // ✅ عرض الفاتورة المحددة فقط (وليس كل الفواتير)
    const container = document.getElementById('linkedInvoicesContainer');
    container.innerHTML = `
        <table style="width:100%; font-size:0.85em;">
            <thead><tr><th>تحديد</th><th>رقم الفاتورة</th><th>الإجمالي</th><th>المدفوع</th><th>المتبقي</th></tr></thead>
            <tbody>
                <tr>
                    <td><input type="checkbox" class="link-invoice-check" value="${invoiceKey}" checked onchange="updateLinkedTotal()" data-remaining="${remaining.toFixed(2)}"></td>
                    <td><strong>${invNum}</strong></td>
					<td>${formatNumberWithCommas((totalAmount + totalPaid).toFixed(2))} ${correctedCurrency}</td>
                    <td style="color:var(--success);">${formatNumberWithCommas(totalPaid.toFixed(2))} ${correctedCurrency}</td>
                    <td style="color:var(--danger); font-weight:700;">${formatNumberWithCommas(remaining.toFixed(2))} ${correctedCurrency}</td>
                </tr>
            </tbody>
        </table>
    `;
    
    // ✅ تحديث إجمالي المبلغ
    updateLinkedTotal();
    
    // ✅ إعادة تعيين المؤشر بعد الانتهاء
    isQuickPayment = false;
};

// حساب حالة السداد لفاتورة
function getInvoicePaymentStatus(invoiceKey, customerId) {
    if (!paymentsData || paymentsData.length === 0) {
        return { status: 'unpaid', paid: 0, hasPending: false, hasRejected: false };
    }
    
    let totalPaid = 0;
    let hasPending = false;
    let hasRejected = false;
    
    paymentsData.forEach(p => {
        if (p.linkedInvoices && Array.isArray(p.linkedInvoices) && p.linkedInvoices.includes(invoiceKey)) {
            if (p.status === 'confirmed' || p.isOpeningBalance) {
                const amountPerInvoice = p.linkedInvoices.length > 0 ? p.amount / p.linkedInvoices.length : p.amount;
                totalPaid += amountPerInvoice;
            } else if (p.status === 'pending') {
                hasPending = true;
            } else if (p.status === 'rejected') {
                hasRejected = true;
            }
        }
    });
    
    return { paid: totalPaid, status: totalPaid <= 0 ? 'unpaid' : 'partial', hasPending: hasPending, hasRejected: hasRejected };
}

// عرض الفواتير المرتبطة بالسداد
window.showPaymentInvoices = function(paymentId) {
    const payment = paymentsData.find(p => p.id === paymentId);
    if (!payment) {
        showNotification('السداد غير موجود', 'error');
        return;
    }
    
    if (!payment.linkedInvoices || payment.linkedInvoices.length === 0) {
        showNotification('هذا السداد غير مرتبط بأي فواتير', 'info');
        return;
    }
    
    // بناء قائمة الفواتير المرتبطة
    let html = `
        <div style="padding:10px;">
            <h4>فواتير السداد: ${payment.id}</h4>
            <p style="color:var(--text-muted); font-size:0.85em;">العميل: ${payment.customerId} | المبلغ: ${formatNumberWithCommas(payment.amount.toFixed(2))} ${payment.currency} | الحالة: ${payment.status}</p>
            <table class="data-table" style="margin-top:10px;">
                <thead><tr><th>رقم الفاتورة</th><th>الإجمالي</th></tr></thead>
                <tbody>`;
    
    payment.linkedInvoices.forEach(key => {
        const inv = invoicesData.find(i => getInvoiceKey(i) === key);
        if (inv) {
            const total = (inv['total-total'] || 0) + ((inv['final-number'] || '').startsWith('P') ? 0 : 5);
            html += `<tr>
                <td>${inv['final-number'] || inv['draft-number'] || key}</td>
                <td>${formatNumberWithCommas(total.toFixed(2))}</td>
            </tr>`;
        } else {
            html += `<tr><td>${key}</td><td>-</td></tr>`;
        }
    });
    
    html += '</tbody></table></div>';
    
    document.getElementById('modalBody').innerHTML = html;
    document.getElementById('modalTitle').textContent = 'فواتير السداد';
    document.getElementById('invoiceModal').style.display = 'block';
};

// إظهار/إخفاء الفواتير المرتبطة بالسداد
window.togglePaymentInvoices = function(paymentId) {
    const row = document.getElementById('paymentInvoices-' + paymentId);
    const icon = document.getElementById('paymentIcon-' + paymentId);
    
    if (row) {
        if (row.style.display === 'none' || row.style.display === '') {
            row.style.display = 'table-row';
            if (icon) {
                icon.className = 'fas fa-chevron-up';
            }
        } else {
            row.style.display = 'none';
            if (icon) {
                icon.className = 'fas fa-chevron-down';
            }
        }
    }
};

window.updateStatement = async function() {
    const accountId = document.getElementById('statementAccount').value;
    if (!accountId) return;
    
    const dateFrom = document.getElementById('statementDateFrom').value;
    const dateTo = document.getElementById('statementDateTo').value;
    
    document.getElementById('statementBody').innerHTML = '<div style="text-align:center;padding:40px;"><i class="fas fa-spinner fa-spin"></i> جاري تحميل...</div>';
    
    await loadPaymentsFromCloud(currentUser.username);
    
    // تصفية فواتير هذا الحساب
    let accountInvoices = invoicesData.filter(inv => {
        const payee = (inv['payee-customer-id'] || '').toLowerCase();
        const contract = (inv['contract-customer-id'] || '').toLowerCase();
        const acc = accountId.toLowerCase();
        return payee.includes(acc) || contract.includes(acc);
    });
    
    // تصفية حسب التاريخ (finalized-date)
    if (dateFrom || dateTo) {
        accountInvoices = accountInvoices.filter(inv => {
            const invDate = (inv['finalized-date'] || inv['created'] || '').slice(0, 10);
            if (!invDate) return true;
            if (dateFrom && invDate < dateFrom) return false;
            if (dateTo && invDate > dateTo) return false;
            return true;
        });
    }
    
    // تصفية سدادات هذا الحساب
    let accountPayments = paymentsData.filter(p => 
        p.customerId === accountId && (p.status === 'confirmed' || p.isOpeningBalance)
    );
    
    if (dateFrom || dateTo) {
        accountPayments = accountPayments.filter(p => {
            if (p.isOpeningBalance && !dateFrom) return true; // الرصيد الافتتاحي يظهر دائماً
            if (p.isOpeningBalance && dateFrom) return false; // إلا إذا كان هناك تاريخ بداية
            const payDate = p.date || '';
            if (dateFrom && payDate < dateFrom) return false;
            if (dateTo && payDate > dateTo) return false;
            return true;
        });
    }
    
    await buildAccountStatement(accountInvoices, accountPayments, accountId, dateFrom, dateTo);
};

window.saveOpeningBalance = async function() {
    const customerId = document.getElementById('openingCustomer').value;
    const amount = parseFloat(document.getElementById('openingAmount').value);
    const currency = document.getElementById('openingCurrency').value;
    const date = document.getElementById('openingDate').value;
    const type = document.getElementById('openingType').value;
    const notes = document.getElementById('openingNotes').value;
    
    if (!customerId) return showOpeningMessage('اختر العميل', 'error');
    if (!amount || amount <= 0) return showOpeningMessage('أدخل مبلغ صحيح', 'error');
    if (!date) return showOpeningMessage('اختر التاريخ', 'error');
    
    showOpeningMessage('جاري الحفظ...', 'info');
    
    const body = {
        action: 'opening_balance',
        customerId: customerId,
        username: 'admin',
        amount: amount,
        currency: currency,
        exchangeRate: currency === 'USD' ? 48.0215 : 1,
        date: date,
        notes: notes || 'رصيد افتتاحي',
        createdBy: currentUser.username,
        balanceType: type
    };
    
    try {
        const response = await fetch(PAYMENTS_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify(body)
        });
        const data = await response.json();
        if (data.success) {
            showOpeningMessage('✅ تم إضافة الرصيد الافتتاحي', 'success');
            setTimeout(() => closeOpeningBalanceModal(), 1500);
        } else {
            showOpeningMessage('❌ فشل: ' + data.error, 'error');
        }
    } catch (e) {
        showOpeningMessage('❌ خطأ في الاتصال', 'error');
    }
};

function showOpeningMessage(msg, type) {
    const div = document.getElementById('openingMessage');
    div.textContent = msg;
    div.className = `login-message ${type}`;
    div.style.display = 'block';
}

window.printStatement = function() {
    const content = document.getElementById('statementBody');
    if (!content || !content.innerHTML.trim()) {
        showNotification('لا يوجد كشف حساب للطباعة', 'error');
        return;
    }
    
    const accountId = document.getElementById('statementAccount').value || '';
    const dateFrom = document.getElementById('statementDateFrom').value;
    const dateTo = document.getElementById('statementDateTo').value;
    
    const printWindow = window.open('', '_blank', 'width=1100,height=800');
    printWindow.document.write(`
        <html dir="rtl">
        <head>
            <meta charset="UTF-8">
            <title>كشف حساب - ${accountId}</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap');
                body { font-family: 'Cairo', sans-serif; padding: 20px; direction: rtl; }
                table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                th { background: #1e3c72; color: white; padding: 10px; text-align: right; }
                td { padding: 8px; border-bottom: 1px solid #ddd; }
                h3, h4 { color: #1e3c72; }
                .footer { margin-top: 20px; text-align: center; font-size: 0.8em; color: #666; }
                @media print { body { padding: 0; } }
            </style>
        </head>
        <body>
            <h3>شركة دمياط لتداول الحاويات و البضائع</h3>
            <h4>كشف حساب: ${accountId}</h4>
            <p>تاريخ التقرير: ${new Date().toLocaleDateString('ar-EG')}</p>
            ${dateFrom || dateTo ? `<p>الفترة: ${dateFrom || 'البداية'} إلى ${dateTo || 'النهاية'}</p>` : ''}
            ${content.innerHTML}
            <div class="footer">
                <p>شكراً لتعاملكم مع شركة دمياط لتداول الحاويات و البضائع</p>
            </div>
            <script>window.onload = function() { window.print(); }</script>
        </body>
        </html>
    `);
    printWindow.document.close();
};

function toggleTheme() {
    const body = document.body;
    const icon = document.getElementById('themeIcon');
    if (body.classList.contains('dark-mode')) {
        body.classList.remove('dark-mode');
        body.classList.add('light-mode');
        if (icon) icon.className = 'fas fa-sun';
        localStorage.setItem('theme', 'light');
    } else {
        body.classList.remove('light-mode');
        body.classList.add('dark-mode');
        if (icon) icon.className = 'fas fa-moon';
        localStorage.setItem('theme', 'dark');
    }
}

window.closeOpeningBalanceModal = function() {
    document.getElementById('openingBalanceModal').style.display = 'none';
};


// ✅ دالة مساعدة لفتح النوافذ المنبثقة
function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.style.display = 'flex';
        modal.classList.add('show');
    }
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('show');
    }
}

console.log('✅ script.js تم تحميله بالكامل');
console.log('العناصر الحرجة:');
['dataSource', 'fileStatus', 'totalEGPWithoutTax', 'totalMartyr', 'totalValueHeader', 'dataViewInfo', 'selectedCount', 'dbControls', 'exportSelectedBtn', 'exportSelectedExcelBtn', 'exportContainersBtn', 'selectAllCheckbox'].forEach(id => {
    console.log(id + ':', document.getElementById(id) ? '✅' : '❌ مفقود');
});

// ✅ تحديث الشريط الجانبي عند تغيير التبويب
function updateSidebarActive(tab) {
    document.querySelectorAll('.sidebar-nav a').forEach(a => a.classList.remove('active'));
    const links = {
        'cash': 0,
        'postponed': 1,
        'credit': 2,
        'payments': 3,
        'statement': 4,
        'reports': 5,
        'users': 6,
        'settings': 7
    };
    const index = links[tab];
    if (index !== undefined) {
        const allLinks = document.querySelectorAll('.sidebar-nav a');
        if (allLinks[index]) allLinks[index].classList.add('active');
    }
}

function updatePageTitle(title, count, value) {
    const pageTitle = document.getElementById('pageTitle');
    const totalInvoicesHeader = document.getElementById('totalInvoicesHeader');
    const totalValueHeader = document.getElementById('totalValueHeader');
    
    if (pageTitle) pageTitle.textContent = title;
    if (totalInvoicesHeader) totalInvoicesHeader.textContent = count || 0;
    if (totalValueHeader) totalValueHeader.textContent = (value || '0.00') + ' EGP';
}

// ========================================
// إصلاح مزامنة وضع العرض مع الأزرار عند تحميل الصفحة
// ========================================
function syncViewModeButtons() {
    // ✅ إذا كان البحث جارياً، لا تغير أي شيء
    if (isSearching) {
        console.log('⏸️ تم تخطي تغيير وضع العرض أثناء البحث');
        return;
    }
    
    // ✅ فقط تأكد من وجود قيمة افتراضية إذا كانت غير معرفة
    if (typeof viewMode === 'undefined') {
        viewMode = 'cards';
    }
    
    // العثور على أزرار التبديل بين جدول/بطاقات
    const tableBtn = document.querySelector('.card-header .tabs .tab:first-child');
    const cardsBtn = document.querySelector('.card-header .tabs .tab:last-child');
    
    if (tableBtn && cardsBtn) {
        if (viewMode === 'cards') {
            tableBtn.classList.remove('active');
            cardsBtn.classList.add('active');
        } else {
            tableBtn.classList.add('active');
            cardsBtn.classList.remove('active');
        }
    }
    
    console.log('✅ وضع العرض الحالي:', viewMode);
}

// استدعاء الدالة بعد تحميل الصفحة وبعد تسجيل الدخول
// نضيفها في دالة checkSession بعد تحميل البيانات
// ولكن لتجنب تعديل الكود الأصلي كثيراً، نضيف مستمع للحدث
document.addEventListener('DOMContentLoaded', function() {
    // ننتظر قليلاً حتى يتم تحميل كل شيء
    setTimeout(function() {
        syncViewModeButtons();
    }, 500);
});

// أيضاً نضيف استدعاء بعد renderData
const originalRenderData = window.renderData;
if (originalRenderData) {
    window.renderData = function() {
        originalRenderData.apply(this, arguments);
        syncViewModeButtons();
    };
}

// تحميل إشعارات الخصم بصمت (بدون تغيير واجهة المستخدم)
async function loadCreditDataFromDriveSilent() {
    if (!driveConfig.apiKey || !driveConfig.folderId) return false;
    let fileId = driveConfig.creditFileId;
    if (!fileId && driveConfig.creditFileName) {
        try {
            const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(`'${driveConfig.folderId}' in parents and name='${driveConfig.creditFileName}'`)}&key=${driveConfig.apiKey}&fields=files(id,name)`);
            if (!res.ok) return false;
            const data = await res.json();
            if (!data.files?.length) return false;
            fileId = data.files[0].id;
            driveConfig.creditFileId = fileId;
        } catch { return false; }
    } else if (!fileId) return false;

    try {
        const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${driveConfig.apiKey}`);
        if (!res.ok) return false;
        const content = await res.text();
        
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(content, "text/xml");
        const parseError = xmlDoc.querySelector('parsererror');
        let newCredits = [];

        if (parseError) {
            const matches = content.match(/<credit[\s\S]*?<\/credit>/g);
            if (!matches?.length) return false;
            const wrapped = parser.parseFromString(`<root>${matches.join('')}</root>`, 'text/xml');
            const nodes = wrapped.querySelectorAll('credit');
            for (let i = 0; i < nodes.length; i++) {
                const credit = parseCreditNode(nodes[i]);
                if (credit) newCredits.push(credit);
            }
        } else {
            const nodes = xmlDoc.getElementsByTagName('credit');
            for (let i = 0; i < nodes.length; i++) {
                const credit = parseCreditNode(nodes[i]);
                if (credit) newCredits.push(credit);
            }
        }

        if (newCredits.length) {
            creditData = newCredits;
        }
        return true;
    } catch {
        return false;
    }
}