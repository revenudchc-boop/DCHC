const fs = require('fs');
const path = require('path');
const xml2js = require('xml2js');
const nodemailer = require('nodemailer');

// ============================================
// 🔑 إعدادات الرابط السري (من Google Apps Script)
// ============================================
const SECRET_KEY = atob('RENIQ19TRUNVUkVfMjAyNA==');
const USERS_SCRIPT_URL = `https://script.google.com/macros/s/AKfycbxNNFfi5IEWDZ4kgSEHmM_gbIJxjOx15r71BZ0dSliXLrW_itIpwvNwsGi_MiWevbmdZQ/exec?key=${SECRET_KEY}`;

// ============================================
// الإعدادات الأخرى
// ============================================
const DATA_DIR = path.join(__dirname, '../data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const STATE_FILE = path.join(__dirname, '../state.json');

// ============================================
// دوال GitHub
// ============================================

function getDataFiles() {
    const files = fs.readdirSync(DATA_DIR)
        .filter(f => f.startsWith('datatxt_Q') && f.endsWith('.txt'))
        .map(f => {
            const match = f.match(/datatxt_Q(\d+)\.txt/);
            return {
                name: f,
                number: match ? parseInt(match[1], 10) : 0,
                path: path.join(DATA_DIR, f)
            };
        });
    return files;
}

function getLastDataFile() {
    const files = getDataFiles();
    if (files.length === 0) return null;
    files.sort((a, b) => b.number - a.number);
    return files[0];
}

function getCreditFile() {
    const creditPath = path.join(DATA_DIR, 'creditdata.txt');
    if (!fs.existsSync(creditPath)) return null;
    return { name: 'creditdata.txt', path: creditPath };
}

async function extractInvoices(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const invoices = [];
    
    const invoiceRegex = /<invoice\s+([^>]*)>/g;
    let match;
    
    while ((match = invoiceRegex.exec(content)) !== null) {
        const attributes = match[1];
        const inv = {};
        
        const fields = ['final-number', 'draft-number', 'payee-customer-id', 'contract-customer-id', 
                       'total-total', 'currency', 'key-word1', 'key-word2', 'created'];
        
        for (const field of fields) {
            const attrRegex = new RegExp(`${field}="([^"]*)"`, 'i');
            const attrMatch = attributes.match(attrRegex);
            inv[field] = attrMatch ? attrMatch[1] : '';
        }
        
        if (inv['final-number']) {
            invoices.push(inv);
        }
    }
    
    console.log(`📄 تم استخراج ${invoices.length} فاتورة باستخدام Regex`);
    return invoices;
}

// ============================================
// 🔄 دالة تحميل المستخدمين (معدلة)
// ============================================
async function fetchUsersFromScript() {
    console.log('🚀 جاري جلب المستخدمين من Google Apps Script...');
    try {
        const response = await fetch(USERS_SCRIPT_URL);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        if (!Array.isArray(data)) {
            throw new Error('البيانات ليست مصفوفة');
        }
        console.log(`✅ تم جلب ${data.length} مستخدم من Apps Script.`);
        return data;
    } catch (error) {
        console.error('❌ فشل جلب المستخدمين من Apps Script:', error.message);
        return null;
    }
}

async function loadUsers() {
    // 1. محاولة قراءة من الملف المحلي أولاً
    if (fs.existsSync(USERS_FILE)) {
        try {
            const content = fs.readFileSync(USERS_FILE, 'utf8');
            const users = JSON.parse(content);
            if (users && users.length > 0) {
                console.log(`📂 تم تحميل ${users.length} مستخدم من ${USERS_FILE}`);
                const active = users.filter(u => u.status === 'active');
                // التأكد من وجود ccEmails
                active.forEach(u => { if (!u.ccEmails) u.ccEmails = []; });
                return active;
            }
        } catch (error) {
            console.error('❌ خطأ في قراءة users.json:', error.message);
        }
    } else {
        console.log('⚠️ users.json غير موجود');
    }

    // 2. إذا لم نجد الملف أو فشلت القراءة، نحاول جلب البيانات من Apps Script
    console.log('🔄 محاولة جلب المستخدمين من Google Apps Script...');
    const users = await fetchUsersFromScript();
    if (!users) {
        console.error('❌ تعذر الحصول على بيانات المستخدمين من أي مصدر.');
        return [];
    }

    // 3. تحويل البيانات إلى الهيكل المطلوب وتصفية النشطين
    const activeUsers = users.filter(u => u.status === 'active').map(u => ({
        id: u.id,
        username: u.username,
        email: u.email || '',
        additionalEmails: u.additionalEmails || [],
        taxNumber: u.taxNumber || '',
        contractCustomerId: u.contractCustomerId || '',
        customerIds: u.customerIds || [],
        status: u.status || 'inactive',
        userType: u.userType || 'accountant',
        language: u.language || 'ar',
        ccEmails: u.ccEmails || []  // قد لا يكون موجوداً في بيانات Apps Script
    }));

    console.log(`✅ تم تحميل ${activeUsers.length} مستخدم نشط من Apps Script.`);
    return activeUsers;
}

// ============================================
// دوال معالجة الفواتير (بدون تغيير)
// ============================================

function parseInvoiceNumber(finalNumber) {
    const match = (finalNumber || '').match(/^([CP])(\d+)-(\d+)$/i);
    if (match) {
        return { type: match[1].toUpperCase(), year: parseInt(match[2], 10), number: parseInt(match[3], 10) };
    }
    return null;
}

function getSortKey(finalNumber) {
    const p = parseInvoiceNumber(finalNumber);
    if (!p) return 0;
    return p.year * 1000000 + p.number;
}

function filterInvoicesForUser(allInvoices, user) {
    const allowedIds = [];
    if (user.taxNumber) allowedIds.push(user.taxNumber.toLowerCase());
    if (user.contractCustomerId) allowedIds.push(user.contractCustomerId.toLowerCase());
    if (user.customerIds && Array.isArray(user.customerIds)) {
        user.customerIds.forEach(id => allowedIds.push(id.toLowerCase()));
    }
    if (allowedIds.length === 0) return [];
    return allInvoices.filter(inv => {
        const payee = (inv['payee-customer-id'] || '').toLowerCase();
        const contract = (inv['contract-customer-id'] || '').toLowerCase();
        return allowedIds.some(id => payee === id || contract === id);
    });
}

function loadState() {
    if (!fs.existsSync(STATE_FILE)) {
        console.log('📂 state.json غير موجود، سيتم إنشاؤه');
        return { lastInvoice: {}, lastCredit: {} };
    }
    try {
        const content = fs.readFileSync(STATE_FILE, 'utf8');
        const state = JSON.parse(content);
        console.log('📂 تم تحميل state.json:', JSON.stringify(state, null, 2));
        return state;
    } catch (error) {
        console.error('❌ خطأ في قراءة state.json:', error.message);
        return { lastInvoice: {}, lastCredit: {} };
    }
}

function saveState(state) {
    try {
        fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
        console.log('💾 تم حفظ state.json:', JSON.stringify(state, null, 2));
        return true;
    } catch (error) {
        console.error('❌ فشل حفظ state.json:', error.message);
        return false;
    }
}

function filterNewInvoices(invoices, user, state) {
    const key = user.username;
    const byType = {};
    
    invoices.forEach(inv => {
        const parsed = parseInvoiceNumber(inv['final-number']);
        if (!parsed) return;
        if (!byType[parsed.type]) byType[parsed.type] = [];
        byType[parsed.type].push(inv);
    });
    
    const newInvoices = [];
    
    for (const typeKey in byType) {
        const list = byType[typeKey];
        list.sort((a, b) => getSortKey(a['final-number']) - getSortKey(b['final-number']));
        
        const lastStored = (state.lastInvoice[key] && state.lastInvoice[key][typeKey]) || 0;
        const lastFullKey = getSortKey(list[list.length - 1]['final-number']);
        
        console.log(`🔍 [${user.username}] نوع ${typeKey}: lastStored=${lastStored}, lastFullKey=${lastFullKey}`);
        
        const newOfType = list.filter(inv => getSortKey(inv['final-number']) > lastStored);
        
        if (newOfType.length > 0) {
            if (!state.lastInvoice[key]) state.lastInvoice[key] = {};
            state.lastInvoice[key][typeKey] = lastFullKey;
            newInvoices.push(...newOfType);
            console.log(`✅ [${user.username}] نوع ${typeKey}: ${newOfType.length} فواتير جديدة`);
        }
    }
    
    return newInvoices;
}

// ============================================
// دوال الإرسال (بدون تغيير)
// ============================================

function getEmailTransporter() {
    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS;
    if (!emailUser || !emailPass) {
        console.warn('⚠️ إعدادات الإيميل غير متوفرة، سيتم استخدام sendmail');
        return null;
    }
    return nodemailer.createTransport({
        service: 'gmail',
        auth: { user: emailUser, pass: emailPass }
    });
}

function sendEmail(toEmail, user, invoices) {
    const username = user.username;
    const lang = user.language || 'ar';
    const count = invoices.length;
    const isArabic = (lang === 'ar');
    
    const subject = isArabic ? '🆕 فواتير جديدة - شركة دمياط لتداول الحاويات' : '🆕 New Invoices - DCHC';
    
    let invoiceList = '';
    const maxShow = Math.min(count, 10);
    for (let i = 0; i < maxShow; i++) {
        const inv = invoices[i];
        invoiceList += `<tr>
            <td style="padding:8px;border-bottom:1px solid #ddd;">${inv['final-number'] || '-'}</td>
            <td style="padding:8px;border-bottom:1px solid #ddd;">${inv['key-word1'] || '-'}</td>
            <td style="padding:8px;border-bottom:1px solid #ddd;">${inv['key-word2'] || '-'}</td>
            <td style="padding:8px;border-bottom:1px solid #ddd;">${inv['total-total'] || '0'} ${inv['currency'] || 'EGP'}</td>
        </tr>`;
    }
    
    const more = count > 10 ? `<p style="color:#666;">... و ${count - 10} فاتورة أخرى</p>` : '';
    
    const htmlBody = `<div dir="rtl" style="font-family:Tahoma;max-width:600px;margin:0 auto;background:#f5f5f5;padding:20px;">
        <div style="background:#1e3c72;color:white;padding:20px;text-align:center;border-radius:10px 10px 0 0;">
            <h2 style="margin:0;">🆕 فواتير جديدة</h2>
            <p style="margin:10px 0 0;">شركة دمياط لتداول الحاويات و البضائع</p>
        </div>
        <div style="background:white;padding:20px;border-radius:0 0 10px 10px;">
            <p>مرحباً <strong>${username}</strong>،</p>
            <p style="color:#10b981;text-align:center;font-size:1.2em;">تم إضافة <strong>${count}</strong> فاتورة جديدة</p>
            <table style="width:100%;border-collapse:collapse;margin:20px 0;">
                <thead><tr style="background:#4361ee;color:white;"><th>رقم الفاتورة</th><th>السفينة</th><th>البوليصة</th><th>الإجمالي</th></tr></thead>
                <tbody>${invoiceList}</tbody>
            </table>
            ${more}
            <div style="text-align:center;margin:30px 0;">
                <a href="https://revenudchc-boop.github.io/DCHC-Inv/" style="background:#4361ee;color:white;text-decoration:none;padding:12px 30px;border-radius:50px;">🔗 فتح نظام الفواتير</a>
            </div>
            <hr><p style="color:#999;font-size:0.8em;text-align:center;">رسالة تلقائية من نظام الفواتير - شركة دمياط لتداول الحاويات</p>
        </div>
    </div>`;
    
    const transporter = getEmailTransporter();
    if (transporter) {
        transporter.sendMail({
            to: toEmail,
            cc: (user.ccEmails && user.ccEmails.length > 0) ? user.ccEmails.join(',') : '',
            subject: subject,
            html: htmlBody
        }, (error) => {
            if (error) console.error('❌ فشل إرسال الإيميل:', error.message);
            else console.log(`✅ تم إرسال الإيميل إلى ${username}`);
        });
    } else {
        const cmd = `echo -e "Subject: ${subject}\nTo: ${toEmail}\nContent-Type: text/html\n\n${htmlBody}" | sendmail -t`;
        const { execSync } = require('child_process');
        try {
            execSync(cmd, { stdio: 'pipe' });
            console.log(`✅ تم إرسال الإيميل إلى ${username} (sendmail)`);
        } catch(e) {
            console.error(`❌ فشل إرسال الإيميل إلى ${username}:`, e.message);
        }
    }
}

function sendTelegramMessage(chatId, message) {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
        console.log('⚠️ TELEGRAM_BOT_TOKEN غير موجود');
        return;
    }
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const payload = { chat_id: chatId, text: message, parse_mode: 'HTML' };
    try {
        const { execSync } = require('child_process');
        execSync(`curl -X POST "${url}" -H "Content-Type: application/json" -d '${JSON.stringify(payload)}'`, { stdio: 'pipe' });
        console.log(`✅ تم إرسال رسالة تيليجرام إلى ${chatId}`);
    } catch(e) {
        console.error('❌ فشل إرسال تيليجرام:', e.message);
    }
}

function sendTelegramAlert(summaryData) {
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!chatId) {
        console.log('⚠️ TELEGRAM_CHAT_ID غير موجود');
        return;
    }
    let message = '<b>📬 تقرير الفواتير الجديدة</b>\n';
    message += '━━━━━━━━━━━━━━━━\n';
    let totalInvoices = 0;
    summaryData.forEach(s => {
        message += `👤 <b>${s.username}</b>: ${s.count} فاتورة\n`;
        totalInvoices += s.count;
    });
    message += '━━━━━━━━━━━━━━━━\n';
    message += `📊 إجمالي الفواتير: <b>${totalInvoices}</b>\n`;
    message += `👥 عدد المستخدمين: <b>${summaryData.length}</b>\n`;
    message += `🕐 ${new Date().toLocaleString('ar-EG')}`;
    sendTelegramMessage(chatId, message);
}

// ============================================
// نظام إشعارات الخصم (Credit) - بدون تغيير
// ============================================

async function extractCredits(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const parser = new xml2js.Parser({ explicitArray: false });
    try {
        const result = await parser.parseStringPromise(content);
        let credits = [];
        if (result && result.root && result.root.credit) {
            credits = Array.isArray(result.root.credit) ? result.root.credit : [result.root.credit];
        } else {
            const matches = content.match(/<credit[^>]*>/g);
            if (matches) {
                credits = matches.map(tag => {
                    const attrs = {};
                    const attrRegex = /(\w+-\w+)="([^"]*)"/g;
                    let match;
                    while ((match = attrRegex.exec(tag)) !== null) {
                        attrs[match[1]] = match[2];
                    }
                    return attrs;
                });
            }
        }
        return credits;
    } catch (error) {
        console.error('❌ خطأ في تحليل Credit XML:', error.message);
        return [];
    }
}

function filterCreditsForUser(allCredits, user) {
    const allowedIds = [];
    if (user.contractCustomerId) allowedIds.push(user.contractCustomerId.toLowerCase());
    if (user.customerIds && Array.isArray(user.customerIds)) {
        user.customerIds.forEach(id => allowedIds.push(id.toLowerCase()));
    }
    if (allowedIds.length === 0) return [];
    return allCredits.filter(cr => {
        const customerId = (cr['customer-id'] || '').toLowerCase();
        return allowedIds.some(id => customerId === id);
    });
}

function sendCreditEmail(toEmail, user, credits) {
    const username = user.username;
    const lang = user.language || 'ar';
    const count = credits.length;
    const isArabic = (lang === 'ar');
    
    const subject = isArabic ? '🔴 إشعار خصم جديد - شركة دمياط لتداول الحاويات' : '🔴 New Debit Note - DCHC';
    
    let creditList = '';
    const maxShow = Math.min(count, 10);
    for (let i = 0; i < maxShow; i++) {
        const cr = credits[i];
        const total = (parseFloat(cr['total-credit']) || 0) + (parseFloat(cr['total-tax-credit']) || 0);
        creditList += `<tr>
            <td style="padding:8px;border-bottom:1px solid #ddd;">${cr['final-number'] || cr['draft-number'] || '-'}</td>
            <td style="padding:8px;border-bottom:1px solid #ddd;">${cr['date'] ? cr['date'].split('T')[0] : '-'}</td>
            <td style="padding:8px;border-bottom:1px solid #ddd;">${parseFloat(cr['total-credit'] || 0).toFixed(2)}</td>
            <td style="padding:8px;border-bottom:1px solid #ddd;">${parseFloat(cr['total-tax-credit'] || 0).toFixed(2)}</td>
            <td style="padding:8px;border-bottom:1px solid #ddd;"><strong>${total.toFixed(2)} ${cr['currency'] || 'EGP'}</strong></td>
        </tr>`;
    }
    
    const more = count > 10 ? `<p style="color:#666;">... و ${count - 10} إشعار آخر</p>` : '';
    
    const htmlBody = `<div dir="rtl" style="font-family:Tahoma;max-width:600px;margin:0 auto;background:#f5f5f5;padding:20px;">
        <div style="background:#c62828;color:white;padding:20px;text-align:center;border-radius:10px 10px 0 0;">
            <h2 style="margin:0;">🔴 إشعار خصم جديد</h2>
            <p style="margin:10px 0 0;">شركة دمياط لتداول الحاويات و البضائع</p>
        </div>
        <div style="background:white;padding:20px;border-radius:0 0 10px 10px;">
            <p>مرحباً <strong>${username}</strong>،</p>
            <p style="color:#c62828;text-align:center;font-size:1.2em;">تم إضافة <strong>${count}</strong> إشعار خصم جديد</p>
            <table style="width:100%;border-collapse:collapse;margin:20px 0;">
                <thead><tr style="background:#c62828;color:white;"><th>رقم الإشعار</th><th>التاريخ</th><th>المبلغ</th><th>الضريبة</th><th>الإجمالي</th></tr></thead>
                <tbody>${creditList}</tbody>
            </table>
            ${more}
            <div style="text-align:center;margin:30px 0;">
                <a href="https://revenudchc-boop.github.io/DCHC-Inv/" style="background:#c62828;color:white;text-decoration:none;padding:12px 30px;border-radius:50px;">🔗 فتح نظام الفواتير</a>
            </div>
            <hr><p style="color:#999;font-size:0.8em;text-align:center;">رسالة تلقائية من نظام الفواتير</p>
        </div>
    </div>`;
    
    const transporter = getEmailTransporter();
    if (transporter) {
        transporter.sendMail({
            to: toEmail,
            cc: (user.ccEmails && user.ccEmails.length > 0) ? user.ccEmails.join(',') : '',
            subject: subject,
            html: htmlBody
        }, (error) => {
            if (!error) console.log(`✅ تم إرسال إيميل credit إلى ${username}`);
        });
    }
}

// ============================================
// معالجة الـ Credit (بدون تغيير)
// ============================================

async function processCredits(users, state) {
    const creditFile = getCreditFile();
    if (!creditFile) {
        console.log('ℹ️ لا يوجد ملف creditdata.txt');
        return [];
    }
    
    console.log('📌 قراءة creditdata.txt');
    const allCredits = await extractCredits(creditFile.path);
    console.log(`📄 تم استخراج ${allCredits.length} إشعار خصم`);
    
    let creditSummaryData = [];
    
    for (const user of users) {
        if (user.userType === 'admin') continue;
        
        const emailsToSend = [];
        if (user.email) emailsToSend.push(user.email);
        if (user.additionalEmails) {
            user.additionalEmails.forEach(e => { if (e) emailsToSend.push(e); });
        }
        if (emailsToSend.length === 0) continue;
        
        const userCredits = filterCreditsForUser(allCredits, user);
        if (userCredits.length === 0) continue;
        
        const key = user.username;
        const lastStored = state.lastCredit[key] || 0;
        
        console.log(`🔍 [${user.username}] lastStored للـ Credit = ${lastStored}`);
        
        userCredits.sort((a, b) => (parseInt(a['draft-number']) || 0) - (parseInt(b['draft-number']) || 0));
        
        const newCredits = userCredits.filter(c => (parseInt(c['draft-number']) || 0) > lastStored);
        
        if (newCredits.length === 0) {
            console.log(`ℹ️ [${user.username}] لا توجد إشعارات خصم جديدة`);
            continue;
        }
        
        const lastCredit = userCredits[userCredits.length - 1];
        state.lastCredit[key] = parseInt(lastCredit['draft-number']) || 0;
        
        console.log(`✅ ${user.username}: ${newCredits.length} إشعار خصم جديد (lastStored=${lastStored}, newLast=${state.lastCredit[key]})`);
        
        sendCreditEmail(emailsToSend.join(','), user, newCredits);
        
        creditSummaryData.push({
            username: user.username,
            count: newCredits.length,
            email: user.email
        });
    }
    
    if (creditSummaryData.length > 0) {
        const chatId = process.env.TELEGRAM_CHAT_ID;
        if (chatId) {
            let message = '<b>🔴 تقرير إشعارات الخصم الجديدة</b>\n';
            message += '━━━━━━━━━━━━━━━━\n';
            let totalCredits = 0;
            creditSummaryData.forEach(s => {
                message += `👤 <b>${s.username}</b>: ${s.count} إشعار خصم\n`;
                totalCredits += s.count;
            });
            message += '━━━━━━━━━━━━━━━━\n';
            message += `📊 إجمالي الإشعارات: <b>${totalCredits}</b>\n`;
            message += `👥 عدد المستخدمين: <b>${creditSummaryData.length}</b>\n`;
            message += `🕐 ${new Date().toLocaleString('ar-EG')}`;
            sendTelegramMessage(chatId, message);
            console.log(`✅ تم إرسال تقرير تيليجرام لإشعارات الخصم (${creditSummaryData.length} مستخدم)`);
        }
    }
    
    return creditSummaryData;
}

// ============================================
// دوال التقارير للأدمن (بدون تغيير)
// ============================================

function sendAdminInvoiceReport(invoiceSummary, latestFile, allInvoices) {
    const adminEmails = process.env.EMAIL_RECIPIENT ? [process.env.EMAIL_RECIPIENT] : [];
    if (adminEmails.length === 0) return;
    
    const totalInvoices = invoiceSummary.reduce((sum, s) => sum + s.count, 0);
    
    let rows = '';
    invoiceSummary.forEach(s => {
        rows += `<tr><td style="padding:8px;border-bottom:1px solid #ddd;">${s.username}</td>
                <td style="padding:8px;border-bottom:1px solid #ddd;">${s.count}</td>
                <td style="padding:8px;border-bottom:1px solid #ddd;font-size:0.8em;">${s.email}</td></tr>`;
    });
    
    const htmlBody = `<div dir="rtl" style="font-family:Tahoma;max-width:600px;margin:0 auto;background:#f5f5f5;padding:20px;">
        <div style="background:#1e3c72;color:white;padding:20px;text-align:center;border-radius:10px 10px 0 0;">
            <h2 style="margin:0;">📊 تقرير الفواتير الجديدة</h2>
            <p style="margin:10px 0 0;">شركة دمياط لتداول الحاويات و البضائع</p>
        </div>
        <div style="background:white;padding:20px;border-radius:0 0 10px 10px;">
            <div style="text-align:center;padding:15px;background:#e8f4f8;border-radius:8px;margin-bottom:20px;">
                <div style="font-size:2em;font-weight:bold;color:#1e3c72;">${totalInvoices}</div>
                <div style="font-size:0.9em;color:#555;">إجمالي الفواتير الجديدة</div>
            </div>
            <table style="width:100%;border-collapse:collapse;margin:10px 0;">
                <thead><tr style="background:#4361ee;color:white;"><th>المستخدم</th><th>عدد الفواتير</th><th>البريد</th></tr></thead>
                <tbody>${rows}</tbody>
            </table>
            <hr>
            <p style="color:#999;font-size:0.8em;text-align:center;">
                📁 الملف: ${latestFile || 'غير معروف'} | 📄 إجمالي الفواتير: ${allInvoices || 0}<br>
                🕐 ${new Date().toLocaleString('ar-EG')}
            </p>
            <p style="color:#999;font-size:0.7em;text-align:center;">رسالة تلقائية من نظام الفواتير</p>
        </div>
    </div>`;
    
    const transporter = getEmailTransporter();
    const subject = `📊 تقرير الفواتير - ${new Date().toLocaleDateString('ar-EG')}`;
    
    if (transporter) {
        transporter.sendMail({
            to: adminEmails.join(','),
            subject: subject,
            html: htmlBody
        }, (error) => {
            if (!error) console.log('✅ تم إرسال تقرير الفواتير للأدمن');
            else console.error('❌ فشل إرسال تقرير الفواتير:', error.message);
        });
    }
}

function sendAdminCreditReport(creditSummary) {
    const adminEmails = process.env.EMAIL_RECIPIENT ? [process.env.EMAIL_RECIPIENT] : [];
    if (adminEmails.length === 0) return;
    
    const totalCredits = creditSummary.reduce((sum, s) => sum + s.count, 0);
    
    let rows = '';
    creditSummary.forEach(s => {
        rows += `<tr><td style="padding:8px;border-bottom:1px solid #ddd;">${s.username}</td>
                <td style="padding:8px;border-bottom:1px solid #ddd;">${s.count}</td>
                <td style="padding:8px;border-bottom:1px solid #ddd;font-size:0.8em;">${s.email}</td></tr>`;
    });
    
    const htmlBody = `<div dir="rtl" style="font-family:Tahoma;max-width:600px;margin:0 auto;background:#f5f5f5;padding:20px;">
        <div style="background:#c62828;color:white;padding:20px;text-align:center;border-radius:10px 10px 0 0;">
            <h2 style="margin:0;">🔴 تقرير إشعارات الخصم الجديدة</h2>
            <p style="margin:10px 0 0;">شركة دمياط لتداول الحاويات و البضائع</p>
        </div>
        <div style="background:white;padding:20px;border-radius:0 0 10px 10px;">
            <div style="text-align:center;padding:15px;background:#fce4ec;border-radius:8px;margin-bottom:20px;">
                <div style="font-size:2em;font-weight:bold;color:#c62828;">${totalCredits}</div>
                <div style="font-size:0.9em;color:#555;">إجمالي إشعارات الخصم الجديدة</div>
            </div>
            <table style="width:100%;border-collapse:collapse;margin:10px 0;">
                <thead><tr style="background:#c62828;color:white;"><th>المستخدم</th><th>عدد الإشعارات</th><th>البريد</th></tr></thead>
                <tbody>${rows}</tbody>
            </table>
            <hr>
            <p style="color:#999;font-size:0.8em;text-align:center;">🕐 ${new Date().toLocaleString('ar-EG')}</p>
            <p style="color:#999;font-size:0.7em;text-align:center;">رسالة تلقائية من نظام الفواتير</p>
        </div>
    </div>`;
    
    const transporter = getEmailTransporter();
    const subject = `🔴 تقرير إشعارات الخصم - ${new Date().toLocaleDateString('ar-EG')}`;
    
    if (transporter) {
        transporter.sendMail({
            to: adminEmails.join(','),
            subject: subject,
            html: htmlBody
        }, (error) => {
            if (!error) console.log('✅ تم إرسال تقرير إشعارات الخصم للأدمن');
            else console.error('❌ فشل إرسال تقرير إشعارات الخصم:', error.message);
        });
    }
}

// ============================================
// تعبئة lastInvoice (بدون تغيير)
// ============================================

function initializeLastInvoice(invoices, users) {
    const initialLastInvoice = {};
    
    console.log(`📊 إجمالي الفواتير في الملف: ${invoices.length}`);
    if (invoices.length > 0) {
        console.log('📊 عينة من الفواتير (أول 3):');
        for (let i = 0; i < Math.min(3, invoices.length); i++) {
            console.log(`  ${i+1}. payee-customer-id: "${invoices[i]['payee-customer-id']}", contract-customer-id: "${invoices[i]['contract-customer-id']}"`);
        }
    }
    
    for (const user of users) {
        if (user.userType === 'admin') continue;
        
        console.log(`🔍 [${user.username}] جاري البحث عن فواتير...`);
        console.log(`   customerIds: ${JSON.stringify(user.customerIds)}`);
        console.log(`   contractCustomerId: ${user.contractCustomerId}`);
        
        const userInvoices = filterInvoicesForUser(invoices, user);
        console.log(`📊 [${user.username}] عدد الفواتير: ${userInvoices.length}`);
        
        if (userInvoices.length === 0) {
            console.log(`⚠️ [${user.username}] لا توجد فواتير للمستخدم`);
            continue;
        }
        
        const byType = {};
        userInvoices.forEach(inv => {
            const parsed = parseInvoiceNumber(inv['final-number']);
            if (!parsed) return;
            if (!byType[parsed.type]) byType[parsed.type] = [];
            byType[parsed.type].push(inv);
        });
        
        for (const typeKey in byType) {
            const list = byType[typeKey];
            list.sort((a, b) => getSortKey(a['final-number']) - getSortKey(b['final-number']));
            const lastFullKey = getSortKey(list[list.length - 1]['final-number']);
            
            if (!initialLastInvoice[user.username]) {
                initialLastInvoice[user.username] = {};
            }
            initialLastInvoice[user.username][typeKey] = lastFullKey;
            console.log(`✅ [${user.username}] نوع ${typeKey}: آخر فاتورة = ${lastFullKey}`);
        }
    }
    
    console.log('📂 initialLastInvoice النهائي:', JSON.stringify(initialLastInvoice, null, 2));
    return initialLastInvoice;
}

// ============================================
// الدالة الرئيسية (معدلة)
// ============================================

async function main() {
    console.log('🚀 بدء فحص GitHub...');
    
    // تحميل state.json من المستودع قبل التشغيل
    console.log('📥 جاري تحميل state.json من المستودع...');
    try {
        const { execSync } = require('child_process');
        execSync('git pull origin main', { stdio: 'pipe' });
        console.log('✅ تم تحديث state.json من المستودع');
    } catch (error) {
        console.log('⚠️ فشل تحميل state.json:', error.message);
    }
    
    // 1. تحميل المستخدمين (باستخدام الدالة المعدلة)
    const users = await loadUsers();
    if (users.length === 0) {
        console.log('⚠️ لا يوجد مستخدمين نشطين');
        return;
    }
    
    // 2. قراءة أحدث ملف فواتير
    const latestFile = getLastDataFile();
    if (!latestFile) {
        console.log('❌ لا توجد ملفات بيانات');
        return;
    }
    
    console.log(`📌 أحدث ملف: ${latestFile.name}`);
    
    // 3. استخراج الفواتير
    const allInvoices = await extractInvoices(latestFile.path);
    console.log(`📄 تم استخراج ${allInvoices.length} فاتورة`);
    
    if (allInvoices.length > 0) {
        console.log('📊 عينة من الفواتير المستخرجة (أول 3):');
        for (let i = 0; i < Math.min(3, allInvoices.length); i++) {
            console.log(`  ${i+1}. payee-customer-id: "${allInvoices[i]['payee-customer-id']}", contract-customer-id: "${allInvoices[i]['contract-customer-id']}"`);
        }
    }
    
    // 4. تحميل الحالة السابقة
    const state = loadState();
    
    // إذا كان lastInvoice فارغاً، قم بتعبئته من الملف الحالي
    if (Object.keys(state.lastInvoice).length === 0) {
        console.log('📂 lastInvoice فارغ، جاري تعبئته من الملف الحالي...');
        state.lastInvoice = initializeLastInvoice(allInvoices, users);
        console.log('✅ تم تعبئة lastInvoice:', JSON.stringify(state.lastInvoice, null, 2));
    } else {
        console.log('📂 lastInvoice موجود بالفعل:', JSON.stringify(state.lastInvoice, null, 2));
    }
    
    // 5. معالجة كل مستخدم (الفواتير)
    const invoiceSummary = [];
    let sentCount = 0;
    
    for (const user of users) {
        if (user.userType === 'admin') continue;
        
        const emailsToSend = [];
        if (user.email) emailsToSend.push(user.email);
        if (user.additionalEmails) {
            user.additionalEmails.forEach(e => { if (e) emailsToSend.push(e); });
        }
        if (emailsToSend.length === 0) continue;
        
        const userInvoices = filterInvoicesForUser(allInvoices, user);
        if (userInvoices.length === 0) {
            console.log(`${user.username}: لا توجد فواتير للمستخدم`);
            continue;
        }
        
        const newInvoices = filterNewInvoices(userInvoices, user, state);
        if (newInvoices.length === 0) {
            console.log(`${user.username}: لا توجد فواتير جديدة`);
            continue;
        }
        
        console.log(`${user.username}: ${newInvoices.length} فاتورة جديدة`);
        
        sendEmail(emailsToSend.join(','), user, newInvoices);
        sentCount++;
        
        invoiceSummary.push({
            username: user.username,
            count: newInvoices.length,
            email: user.email
        });
    }
    
    // 6. معالجة Credit Data
    const creditSummary = await processCredits(users, state);
    
    // 7. إرسال تقرير إشعارات الخصم للأدمن
    if (creditSummary.length > 0) {
        sendAdminCreditReport(creditSummary);
    } else {
        console.log('ℹ️ لا توجد إشعارات خصم جديدة، لم يتم إرسال تقرير الإشعارات');
    }
    
    // 8. حفظ الحالة بعد تحديث lastCredit
    saveState(state);
    console.log('📂 محتوى state.json قبل الرفع:', JSON.stringify(state, null, 2));
    
    // 9. رفع state.json إلى المستودع بعد التحديث
    console.log('📤 جاري رفع state.json إلى المستودع...');
    try {
        const { execSync } = require('child_process');
        const token = process.env.GITHUB_TOKEN;
        const repoUrl = `https://x-access-token:${token}@github.com/${process.env.GITHUB_REPOSITORY}.git`;
        
        execSync('git config user.name "github-actions[bot]"');
        execSync('git config user.email "github-actions[bot]@users.noreply.github.com"');
        execSync('git add state.json');
        execSync(`git commit -m "تحديث حالة التتبع - $(date '+%Y-%m-%d %H:%M:%S')" || echo "لا توجد تغييرات"`, { shell: '/bin/bash' });
        execSync(`git push ${repoUrl} main`, { shell: '/bin/bash' });
        console.log('✅ تم رفع state.json إلى المستودع');
    } catch (error) {
        console.error('⚠️ فشل رفع state.json:', error.message);
    }
    
    // 10. إرسال تقرير الفواتير للأدمن (إذا وجدت فواتير جديدة)
    if (invoiceSummary.length > 0) {
        sendAdminInvoiceReport(invoiceSummary, latestFile.name, allInvoices.length);
        sendTelegramAlert(invoiceSummary);
    } else {
        console.log('ℹ️ لا توجد فواتير جديدة، لم يتم إرسال تقرير الفواتير');
    }
    
    console.log(`✅ اكتمل الفحص. تم إرسال ${sentCount} إيميلات للمستخدمين`);
}

// ============================================
// دوال الاختبار (بدون تغيير)
// ============================================

function sendTestEmail() {
    console.log('🧪 تشغيل اختبار الإيميل...');
    const testUser = {
        username: 'اختبار',
        email: process.env.EMAIL_RECIPIENT || 'kozomoozoo@gmail.com',
        language: 'ar'
    };
    const testInvoice = [{
        'final-number': 'C25-99999',
        'key-word1': 'سفينة اختبار',
        'key-word2': 'TEST123',
        'total-total': '5000.00',
        'currency': 'EGP'
    }];
    sendEmail(testUser.email, testUser, testInvoice);
    console.log('✅ تم إرسال إيميل تجريبي');
}

function sendTestTelegram() {
    console.log('🧪 تشغيل اختبار تيليجرام...');
    const testData = [{ username: 'اختبار', count: 5, email: 'test@example.com' }];
    sendTelegramAlert(testData);
    console.log('✅ تم إرسال اختبار تيليجرام');
}

function sendTestAll() {
    console.log('🧪 تشغيل اختبار النظام بالكامل...');
    sendTestEmail();
    sendTestTelegram();
    console.log('✅ اكتمل الاختبار');
}

// ============================================
// تشغيل النظام الفعلي
// ============================================

main().catch(error => {
    console.error('❌ خطأ:', error);
    process.exit(1);
});

// (للاختبار: قم بتعليق main() وفك تعليق إحدى دوال الاختبار)
