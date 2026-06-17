const fs = require('fs');
const path = require('path');
const xml2js = require('xml2js');

// ============================================
// إعدادات
// ============================================
const DATA_DIR = path.join(__dirname, '../data');
const TEMP_FILE = '/tmp/invoice_data.env';

// ============================================
// الدوال الرئيسية
// ============================================

/**
 * الحصول على أحدث ملف (أعلى رقم Q)
 */
function getLatestFile() {
    const files = fs.readdirSync(DATA_DIR)
        .filter(f => f.startsWith('datatxt_Q') && f.endsWith('.txt'))
        .sort((a, b) => {
            const numA = parseInt(a.match(/Q(\d+)/)[1]);
            const numB = parseInt(b.match(/Q(\d+)/)[1]);
            return numB - numA;  // ترتيب تنازلي (الأحدث أولاً)
        });
    
    if (files.length === 0) {
        console.log('❌ لا توجد ملفات في المجلد');
        return null;
    }
    
    console.log(`📁 تم العثور على ${files.length} ملف`);
    return files[0];
}

/**
 * استخراج الفواتير من ملف XML
 */
async function extractInvoices(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const parser = new xml2js.Parser({ explicitArray: false });
    
    try {
        const result = await parser.parseStringPromise(content);
        let invoices = [];
        
        // محاولة استخراج الفواتير من XML
        if (result && result.root && result.root.invoice) {
            invoices = Array.isArray(result.root.invoice) ? result.root.invoice : [result.root.invoice];
        } else {
            // طريقة بديلة: استخدام Regex لاستخراج علامات invoice
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
 * حفظ البيانات للإيميل
 */
function saveReportData(fileName, invoiceCount) {
    const content = `FILE_NAME="${fileName}"\nINVOICE_COUNT="${invoiceCount}"`;
    fs.writeFileSync(TEMP_FILE, content);
    console.log(`✅ تم حفظ البيانات: ${fileName} (${invoiceCount} فاتورة)`);
}

// ============================================
// التنفيذ الرئيسي
// ============================================

(async function main() {
    console.log('🚀 بدء فحص GitHub...');
    
    // 1. الحصول على أحدث ملف
    const latestFile = getLatestFile();
    if (!latestFile) {
        console.log('❌ لا يوجد ملفات للفحص');
        process.exit(1);
    }
    
    console.log(`📌 أحدث ملف: ${latestFile}`);
    
    // 2. استخراج الفواتير
    const filePath = path.join(DATA_DIR, latestFile);
    const invoices = await extractInvoices(filePath);
    
    console.log(`📄 عدد الفواتير: ${invoices.length}`);
    
    // 3. حفظ البيانات للإيميل
    saveReportData(latestFile, invoices.length);
    
    console.log('✅ اكتمل الفحص بنجاح');
})();
