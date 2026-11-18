const fs = require('fs');
const path = require('path');
const xml2js = require('xml2js');
const nodemailer = require('nodemailer');
const { fetchUsers } = require('./fetch-users-firebase');

const DATA_DIR = path.join(__dirname, '../data');
const STATE_FILE = path.join(__dirname, '../state-firebase.json');
const LEGACY_STATE_FILE = path.join(__dirname, '../state.json');

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

function extractInvoices(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const invoices = [];

    const invoiceRegex = /<invoice\s+([^>]*)>/g;
    let match;

    while ((match = invoiceRegex.exec(content)) !== null) {
        const attributes = match[1];
        const inv = {};

        const fields = ['final-number', 'draft-number', 'payee-customer-id', 'contract-customer-id',
                       'total-total', 'currency', 'key-word1', 'key-word2', 'created', 'flex-string-06'];

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
// تحميل المستخدمين من Firestore
// ============================================

async function loadUsers() {
    const users = await fetchUsers();
    if (!users || users.length === 0) {
        console.error('❌ تعذر الحصول على بيانات المستخدمين من Firestore.');
        return [];
    }
    return users;
}

// ============================================
// دوال معالجة الفواتير
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
        if (fs.existsSync(LEGACY_STATE_FILE)) {
            try {
                const legacy = JSON.parse(fs.readFileSync(LEGACY_STATE_FILE, 'utf8'));
                console.log('📂 تم نسخ نقطة البداية من state.json إلى state-firebase.json');
                return {
                    lastInvoice: legacy.lastInvoice || {},
                    lastCredit: legacy.lastCredit || {}
                };
            } catch (e) {}
        }
        console.log('📂 state-firebase.json غير موجود، سيتم إنشاؤه');
        return { lastInvoice: {}, lastCredit: {} };
    }
    try {
        const content = fs.readFileSync(STATE_FILE, 'utf8');
        const state = JSON.parse(content);
        console.log('📂 تم تحميل state-firebase.json');
        return state;
    } catch (error) {
        console.error('❌ خطأ في قراءة state-firebase.json:', error.message);
        return { lastInvoice: {}, lastCredit: {} };
    }
}

function saveState(state) {
    try {
        fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
        console.log('💾 تم حفظ state-firebase.json');
        return true;
    } catch (error) {
        console.error('❌ فشل حفظ state-firebase.json:', error.message);
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
// دوال الإرسال
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
        let total = parseFloat(inv['total-total']) || 0;
        let currency = inv['currency'] || 'EGP';

        if (currency === 'USAD') {
            const exchangeRate = parseFloat(inv['flex-string-06']) || 48.0215;
            if (exchangeRate > 0) total = total / exchangeRate;
        } else {
            const finalNumber = inv['final-number'] || '';
            const isPostponed = finalNumber.startsWith('P') || finalNumber.startsWith('p');
            if (!isPostponed) total += 5;
        }

        const formattedTotal = total.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

        invoiceList += `<tr>
            <td style="padding:8px;border-bottom:1px solid #ddd;">${inv['final-number'] || '-'}</td>
            <td style="padding:8px;border-bottom:1px solid #ddd;">${inv['key-word1'] || '-'}</td>
            <td style="padding:8px;border-bottom:1px solid #ddd;">${inv['key-word2'] || '-'}</td>
            <td style="padding:8px;border-bottom:1px solid #ddd;font-weight:bold;">${formattedTotal} ${currency}</td>
        </tr>`;
    }

    const more = count > 10 ? `<p style="color:#666;">... و ${count - 10} فاتورة أخرى</p>` : '';

    let grandTotal = 0;
    let grandCurrency = 'EGP';
    invoices.forEach(inv => {
        let total = parseFloat(inv['total-total']) || 0;
        let currency = inv['currency'] || 'EGP';

        if (currency === 'USAD') {
            const exchangeRate = parseFloat(inv['flex-string-06']) || 48.0215;
            if (exchangeRate > 0) total = total / exchangeRate;
            grandCurrency = 'USAD';
        } else {
            const finalNumber = inv['final-number'] || '';
            const isPostponed = finalNumber.startsWith('P') || finalNumber.startsWith('p');
            if (!isPostponed) total += 5;
            grandCurrency = 'EGP';
        }
        grandTotal += total;
    });

    const formattedGrandTotal = grandTotal.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

    const htmlBody = `<div dir="rtl" style="font-family:Tahoma;max-width:600px;margin:0 auto;background:#f5f5f5;padding:20px;">
        <div style="background:#1e3c72;color:white;padding:20px;text-align:center;border-radius:10px 10px 0 0;">
            <h2 style="margin:0;">🆕 فواتير جديدة</h2>
            <p style="margin:10px 0 0;">شركة دمياط لتداول الحاويات و البضائع</p>
        </div>
        <div style="background:white;padding:20px;border-radius:0 0 10px 10px;">
            <p>مرحباً <strong>${username}</strong>،</p>
            <p style="color:#10b981;text-align:center;font-size:1.2em;">تم إضافة <strong>${count}</strong> فاتورة جديدة</p>
            <table style="width:100%;border-collapse:collapse;margin:20px 0;">
                <thead><tr style="background:#4361ee;color:white;">
                    <th style="padding:10px;">رقم الفاتورة</th>
                    <th style="padding:10px;">السفينة</th>
                    <th style="padding:10px;">البوليصة</th>
                    <th style="padding:10px;">الإجمالي</th>
                </tr></thead>
                <tbody>${invoiceList}</tbody>
            </table>
            ${more}
            <div style="background:#e8f4f8;padding:15px;border-radius:8px;text-align:center;margin-top:15px;">
                <strong style="font-size:1.1em;">الإجمالي الكلي: ${formattedGrandTotal} ${grandCurrency}</strong>
            </div>
            <div style="text-align:center;margin:30px 0;">
                <a href="https://revenudchc-boop.github.io/DCHC-Inv/" style="background:#4361ee;color:white;text-decoration:none;padding:12px 30px;border-radius:50px;display:inline-block;">🔗 فتح نظام الفواتير</a>
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
    } catch (e) {
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
        let totalCredit = parseFloat(cr['total-credit']) || 0;
        let totalTax = parseFloat(cr['total-tax-credit']) || 0;
        let total = totalCredit + totalTax;
        let currency = cr['currency'] || 'EGP';

        if (currency === 'USAD') {
            let exchangeRate = parseFloat(cr['exchange-rate']) || 0;
            if (exchangeRate <= 0) exchangeRate = parseFloat(cr['flex-string-06']) || 48.0215;
            if (exchangeRate > 0) {
                totalCredit = totalCredit / exchangeRate;
                totalTax = totalTax / exchangeRate;
                total = total / exchangeRate;
            }
        }

        creditList += `<tr>
            <td style="padding:8px;border-bottom:1px solid #ddd;">${cr['final-number'] || cr['draft-number'] || '-'}</td>
            <td style="padding:8px;border-bottom:1px solid #ddd;">${cr['date'] ? cr['date'].split('T')[0] : '-'}</td>
            <td style="padding:8px;border-bottom:1px solid #ddd;">${totalCredit.toFixed(2)}</td>
            <td style="padding:8px;border-bottom:1px solid #ddd;">${totalTax.toFixed(2)}</td>
            <td style="padding:8px;border-bottom:1px solid #ddd;"><strong>${total.toFixed(2)} ${currency}</strong></td>
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

        userCredits.sort((a, b) => (parseInt(a['draft-number']) || 0) - (parseInt(b['draft-number']) || 0));
        const newCredits = userCredits.filter(c => (parseInt(c['draft-number']) || 0) > lastStored);

        if (newCredits.length === 0) continue;

        const lastCredit = userCredits[userCredits.length - 1];
        state.lastCredit[key] = parseInt(lastCredit['draft-number']) || 0;

        console.log(`✅ ${user.username}: ${newCredits.length} إشعار خصم جديد`);
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
            let message = '<b>🔴 تقرير إشعارات الخصم الجديدة</b>\n━━━━━━━━━━━━━━━━\n';
            let totalCredits = 0;
            creditSummaryData.forEach(s => {
                message += `👤 <b>${s.username}</b>: ${s.count} إشعار خصم\n`;
                totalCredits += s.count;
            });
            message += `━━━━━━━━━━━━━━━━\n📊 إجمالي الإشعارات: <b>${totalCredits}</b>\n👥 عدد المستخدمين: <b>${creditSummaryData.length}</b>\n🕐 ${new Date().toLocaleString('ar-EG')}`;
            sendTelegramMessage(chatId, message);
        }
    }

    return creditSummaryData;
}

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
            <p style="color:#999;font-size:0.8em;text-align:center;">📁 الملف: ${latestFile || 'غير معروف'} | 📄 إجمالي الفواتير: ${allInvoices || 0}<br>🕐 ${new Date().toLocaleString('ar-EG')}</p>
        </div>
    </div>`;

    const transporter = getEmailTransporter();
    const subject = `📊 تقرير الفواتير - ${new Date().toLocaleDateString('ar-EG')}`;
    if (transporter) {
        transporter.sendMail({ to: adminEmails.join(','), subject, html: htmlBody }, (error) => {
            if (!error) console.log('✅ تم إرسال تقرير الفواتير للأدمن');
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
        </div>
    </div>`;

    const transporter = getEmailTransporter();
    const subject = `🔴 تقرير إشعارات الخصم - ${new Date().toLocaleDateString('ar-EG')}`;
    if (transporter) {
        transporter.sendMail({ to: adminEmails.join(','), subject, html: htmlBody }, (error) => {
            if (!error) console.log('✅ تم إرسال تقرير إشعارات الخصم للأدمن');
        });
    }
}

function initializeLastInvoice(invoices, users) {
    const initialLastInvoice = {};
    for (const user of users) {
        if (user.userType === 'admin') continue;
        const userInvoices = filterInvoicesForUser(invoices, user);
        if (userInvoices.length === 0) continue;

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
            if (!initialLastInvoice[user.username]) initialLastInvoice[user.username] = {};
            initialLastInvoice[user.username][typeKey] = lastFullKey;
        }
    }
    return initialLastInvoice;
}

async function main() {
    console.log('🚀 بدء فحص GitHub (Firestore)...');

    try {
        const { execSync } = require('child_process');
        execSync('git pull origin main', { stdio: 'pipe' });
    } catch (error) {
        console.log('⚠️ git pull:', error.message);
    }

    const users = await loadUsers();
    if (users.length === 0) {
        console.log('⚠️ لا يوجد مستخدمين نشطين');
        return;
    }

    const latestFile = getLastDataFile();
    if (!latestFile) {
        console.log('❌ لا توجد ملفات بيانات');
        return;
    }

    console.log(`📌 أحدث ملف: ${latestFile.name}`);
    const allInvoices = await extractInvoices(latestFile.path);

    const state = loadState();
    if (Object.keys(state.lastInvoice).length === 0) {
        console.log('📂 تعبئة lastInvoice الأولية...');
        state.lastInvoice = initializeLastInvoice(allInvoices, users);
    }

    const invoiceSummary = [];
    let sentCount = 0;

    for (const user of users) {
        if (user.userType === 'admin') continue;

        const emailsToSend = [];
        if (user.email) emailsToSend.push(user.email);
        if (user.additionalEmails) user.additionalEmails.forEach(e => { if (e) emailsToSend.push(e); });
        if (emailsToSend.length === 0) continue;

        const userInvoices = filterInvoicesForUser(allInvoices, user);
        if (userInvoices.length === 0) continue;

        const newInvoices = filterNewInvoices(userInvoices, user, state);
        if (newInvoices.length === 0) continue;

        console.log(`${user.username}: ${newInvoices.length} فاتورة جديدة`);
        sendEmail(emailsToSend.join(','), user, newInvoices);
        sentCount++;

        invoiceSummary.push({
            username: user.username,
            count: newInvoices.length,
            email: user.email
        });
    }

    const creditSummary = await processCredits(users, state);
    if (creditSummary.length > 0) sendAdminCreditReport(creditSummary);

    saveState(state);

    try {
        const { execSync } = require('child_process');
        const token = process.env.GITHUB_TOKEN;
        const repoUrl = `https://x-access-token:${token}@github.com/${process.env.GITHUB_REPOSITORY}.git`;

        execSync('git config user.name "github-actions[bot]"');
        execSync('git config user.email "github-actions[bot]@users.noreply.github.com"');
        execSync('git add state-firebase.json');
        execSync(`git commit -m "تحديث حالة التتبع (Firebase) - $(date '+%Y-%m-%d %H:%M:%S')" || echo "لا توجد تغييرات"`, { shell: '/bin/bash' });
        execSync(`git push ${repoUrl} main`, { shell: '/bin/bash' });
        console.log('✅ تم رفع state-firebase.json إلى المستودع');
    } catch (error) {
        console.error('⚠️ فشل رفع state-firebase.json:', error.message);
    }

    if (invoiceSummary.length > 0) {
        sendAdminInvoiceReport(invoiceSummary, latestFile.name, allInvoices.length);
        sendTelegramAlert(invoiceSummary);
    }

    console.log(`✅ اكتمل الفحص. تم إرسال ${sentCount} إيميلات للمستخدمين`);
}

main().catch(error => {
    console.error('❌ خطأ:', error);
    process.exit(1);
});
