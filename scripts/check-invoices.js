const fs = require('fs');
const path = require('path');
const xml2js = require('xml2js');
const nodemailer = require('nodemailer');

// ============================================
// الإعدادات
// ============================================
const DATA_DIR = path.join(__dirname, '../data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const STATE_FILE = path.join(__dirname, '../state.json');

// ============================================
// دوال GitHub
// ============================================

/**
 * الحصول على قائمة الملفات من مجلد data
 */
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

/**
 * الحصول على أحدث ملف (أعلى رقم Q)
 */
function getLastDataFile() {
    const files = getDataFiles();
    if (files.length === 0) return null;
    
    files.sort((a, b) => b.number - a.number);
    return files[0];
}

/**
 * الحصول على معلومات ملف creditdata.txt
 */
function getCreditFile() {
    const creditPath = path.join(DATA_DIR, 'creditdata.txt');
    if (!fs.existsSync(creditPath)) return null;
    return {
        name: 'creditdata.txt',
        path: creditPath
    };
}

// ============================================
// قراءة وتحليل الملفات
// ============================================

/**
 * قراءة محتوى ملف XML واستخراج الفواتير
 */
async function extractInvoices(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const parser = new xml2js.Parser({ explicitArray: false });
    
    try {
        const result = await parser.parseStringPromise(content);
        let invoices = [];
        
        if (result && result.root && result.root.invoice) {
            invoices = Array.isArray(result.root.invoice) ? result.root.invoice : [result.root.invoice];
        } else {
            // طريقة بديلة باستخدام Regex
            const matches = content.match(/<invoice[^>]*>/g);
            if (matches) {
                invoices = matches.map(tag => {
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
        
        return invoices;
    } catch (error) {
        console.error('❌ خطأ في تحليل XML:', error.message);
        return [];
    }
}

/**
 * قراءة ملف users.json
 */
function loadUsers() {
    if (!fs.existsSync(USERS_FILE)) {
        console.log('⚠️ users.json غير موجود');
        return [];
    }
    
    try {
        const content = fs.readFileSync(USERS_FILE, 'utf8');
        const users = JSON.parse(content);
        return users.filter(u => u.status === 'active');
    } catch (error) {
        console.error('❌ خطأ في قراءة users.json:', error.message);
        return [];
    }
}

/**
 * استخراج رقم الفاتورة للترتيب
 */
function parseInvoiceNumber(finalNumber) {
    const match = (finalNumber || '').match(/^([CP])(\d+)-(\d+)$/i);
    if (match) {
        return {
            type: match[1].toUpperCase(),
            year: parseInt(match[2], 10),
            number: parseInt(match[3], 10)
        };
    }
    return null;
}

function getSortKey(finalNumber) {
    const p = parseInvoiceNumber(finalNumber);
    if (!p) return 0;
    return p.year * 1000000 + p.number;
}

/**
 * فلترة الفواتير حسب المستخدم
 */
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

// ============================================
// نظام تتبع الفواتير المرسلة
// ============================================

function loadState() {
    if (!fs.existsSync(STATE_FILE)) {
        return { lastInvoice: {}, lastCredit: {} };
    }
    try {
        return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    } catch {
        return { lastInvoice: {}, lastCredit: {} };
    }
}

function saveState(state) {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

/**
 * تصفية الفواتير الجديدة فقط
 */
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
        
        const lastKey = (state.lastInvoice[key] || {});
        const lastStored = lastKey[typeKey] || 0;
        const lastFullKey = getSortKey(list[list.length - 1]['final-number']);
        
        const newOfType = list.filter(inv => getSortKey(inv['final-number']) > lastStored);
        
        if (newOfType.length > 0) {
            if (!state.lastInvoice[key]) state.lastInvoice[key] = {};
            state.lastInvoice[key][typeKey] = lastFullKey;
            newInvoices.push(...newOfType);
        }
    }
    
    return newInvoices;
}

// ============================================
// إرسال الإيميلات
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
                <a href="https://revenudchc-boop.github.io/DCHC/" style="background:#4361ee;color:white;text-decoration:none;padding:12px 30px;border-radius:50px;">🔗 فتح نظام الفواتير</a>
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
        // استخدام sendmail كبديل
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

function sendAdminReport(summaryData) {
    const adminEmails = process.env.EMAIL_RECIPIENT ? [process.env.EMAIL_RECIPIENT] : [];
    
    if (adminEmails.length === 0) return;
    
    let rows = '';
    summaryData.forEach(s => {
        rows += `<tr><td style="padding:8px;border-bottom:1px solid #ddd;">${s.username}</td>
                <td style="padding:8px;border-bottom:1px solid #ddd;">${s.count}</td>
                <td style="padding:8px;border-bottom:1px solid #ddd;font-size:0.8em;">${s.email}</td></tr>`;
    });
    
    const htmlBody = `<div dir="rtl" style="font-family:Tahoma;max-width:600px;margin:0 auto;background:#f5f5f5;padding:20px;">
        <div style="background:#1e3c72;color:white;padding:20px;text-align:center;border-radius:10px 10px 0 0;">
            <h2 style="margin:0;">📊 تقرير إرسال الفواتير</h2>
            <p style="margin:10px 0 0;">شركة دمياط لتداول الحاويات و البضائع</p>
        </div>
        <div style="background:white;padding:20px;border-radius:0 0 10px 10px;">
            <p>تم إرسال <strong>${summaryData.length}</strong> إيميل اليوم</p>
            <table style="width:100%;border-collapse:collapse;margin:20px 0;">
                <thead><tr style="background:#4361ee;color:white;"><th>المستخدم</th><th>عدد الفواتير</th><th>البريد</th></tr></thead>
                <tbody>${rows}</tbody>
            </table>
            <hr><p style="color:#999;font-size:0.8em;text-align:center;">رسالة تلقائية من نظام الفواتير</p>
        </div>
    </div>`;
    
    const transporter = getEmailTransporter();
    const subject = `📊 تقرير إرسال الفواتير - ${new Date().toLocaleDateString('ar-EG')}`;
    
    if (transporter) {
        transporter.sendMail({
            to: adminEmails.join(','),
            subject: subject,
            html: htmlBody
        }, (error) => {
            if (!error) console.log('✅ تم إرسال تقرير الأدمن');
        });
    }
}

// ============================================
// نظام تيليجرام
// ============================================

function sendTelegramMessage(chatId, message) {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
        console.log('⚠️ TELEGRAM_BOT_TOKEN غير موجود');
        return;
    }
    
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const payload = {
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML'
    };
    
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
// نظام إشعارات الخصم (Credit)
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
                <a href="https://revenudchc-boop.github.io/DCHC/" style="background:#c62828;color:white;text-decoration:none;padding:12px 30px;border-radius:50px;">🔗 فتح نظام الفواتير</a>
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
// التنفيذ الرئيسي
// ============================================

async function processCredits(users, state) {
    const creditFile = getCreditFile();
    if (!creditFile) {
        console.log('ℹ️ لا يوجد ملف creditdata.txt');
        return;
    }
    
    console.log('📌 قراءة creditdata.txt');
    const allCredits = await extractCredits(creditFile.path);
    console.log(`📄 تم استخراج ${allCredits.length} إشعار خصم`);
    
    let summaryData = [];
    
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
        
        // تصفية الجديد
        const key = 'credit_' + user.username;
        const lastStored = state.lastCredit[key] || 0;
        
        userCredits.sort((a, b) => (parseInt(a['draft-number']) || 0) - (parseInt(b['draft-number']) || 0));
        
        const newCredits = userCredits.filter(c => (parseInt(c['draft-number']) || 0) > lastStored);
        
        if (newCredits.length === 0) continue;
        
        const lastCredit = userCredits[userCredits.length - 1];
        state.lastCredit[key] = parseInt(lastCredit['draft-number']) || 0;
        
        console.log(`${user.username}: ${newCredits.length} إشعار خصم جديد`);
        
        sendCreditEmail(emailsToSend.join(','), user, newCredits);
        
        summaryData.push({
            username: user.username,
            count: newCredits.length,
            email: user.email
        });
    }
    
    // ✅ ✅ ✅ إرسال تقرير تيليجرام لإشعارات الخصم ✅ ✅ ✅
    if (summaryData.length > 0) {
        const chatId = process.env.TELEGRAM_CHAT_ID;
        if (chatId) {
            let message = '<b>🔴 تقرير إشعارات الخصم الجديدة</b>\n';
            message += '━━━━━━━━━━━━━━━━\n';
            
            let totalCredits = 0;
            summaryData.forEach(s => {
                message += `👤 <b>${s.username}</b>: ${s.count} إشعار خصم\n`;
                totalCredits += s.count;
            });
            
            message += '━━━━━━━━━━━━━━━━\n';
            message += `📊 إجمالي الإشعارات: <b>${totalCredits}</b>\n`;
            message += `👥 عدد المستخدمين: <b>${summaryData.length}</b>\n`;
            message += `🕐 ${new Date().toLocaleString('ar-EG')}`;
            
            sendTelegramMessage(chatId, message);
            console.log(`✅ تم إرسال تقرير تيليجرام لإشعارات الخصم (${summaryData.length} مستخدم)`);
        } else {
            console.log('⚠️ TELEGRAM_CHAT_ID غير موجود، لم يتم إرسال تقرير تيليجرام');
        }
    }
}

async function main() {
    console.log('🚀 بدء فحص GitHub...');
    
    // 1. تحميل المستخدمين
    const users = loadUsers();
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
    
    // 4. تحميل الحالة السابقة
    const state = loadState();
    
    // 5. معالجة كل مستخدم
    const summaryData = [];
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
        if (userInvoices.length === 0) continue;
        
        const newInvoices = filterNewInvoices(userInvoices, user, state);
        if (newInvoices.length === 0) {
            console.log(`${user.username}: لا توجد فواتير جديدة`);
            continue;
        }
        
        console.log(`${user.username}: ${newInvoices.length} فاتورة جديدة`);
        
        // إرسال إيميل
        sendEmail(emailsToSend.join(','), user, newInvoices);
        sentCount++;
        
        summaryData.push({
            username: user.username,
            count: newInvoices.length,
            email: user.email
        });
    }
    
    // 6. حفظ الحالة
    saveState(state);
    
    // 7. إرسال تقرير للأدمن
    if (sentCount > 0) {
        sendAdminReport(summaryData);
        sendTelegramAlert(summaryData);
    }
    
    // 8. معالجة Credit Data
    await processCredits(users, state);
    
    console.log(`✅ اكتمل الفحص. تم إرسال ${sentCount} إيميلات`);
}

// ============================================
// 🧪 دوال الاختبار
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
    
    const testData = [{
        username: 'اختبار',
        count: 5,
        email: 'test@example.com'
    }];
    
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
// 💡 اختر ما تريد تشغيله:
// ============================================

// 🔹 الخيار 1: تشغيل النظام الفعلي (للمستخدمين الحقيقيين)
main().catch(error => {
    console.error('❌ خطأ:', error);
    process.exit(1);
});

// 🔹 الخيار 2: تشغيل اختبار الإيميل فقط (علّق الخيار 1 وافتح هذا)
// sendTestEmail();

// 🔹 الخيار 3: تشغيل اختبار تيليجرام فقط (علّق الخيار 1 وافتح هذا)
// sendTestTelegram();

// 🔹 الخيار 4: تشغيل جميع الاختبارات (علّق الخيار 1 وافتح هذا)
sendTestAll()
