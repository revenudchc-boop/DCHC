const { initializeApp, getApps, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

function getFirestoreDb() {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    throw new Error('متغير FIREBASE_SERVICE_ACCOUNT غير موجود في GitHub Secrets');
  }
  if (getApps().length === 0) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    initializeApp({
      credential: cert(serviceAccount)
    });
  }
  return getFirestore();
}

async function fetchUsers() {
  console.log('🚀 جاري الاتصال بـ Firestore...');
  try {
    const db = getFirestoreDb();
    const snapshot = await db.collection('users').where('status', '==', 'active').get();
    const users = snapshot.docs.map(doc => {
      const u = doc.data();
      return {
        id: doc.id,
        username: u.username,
        email: u.email || '',
        additionalEmails: Array.isArray(u.additionalEmails) ? u.additionalEmails.filter(Boolean) : [],
        ccEmails: Array.isArray(u.ccEmails) ? u.ccEmails.filter(Boolean) : [],
        taxNumber: u.taxNumber || '',
        contractCustomerId: u.contractCustomerId || '',
        customerIds: Array.isArray(u.customerIds) ? u.customerIds : [],
        status: u.status || 'inactive',
        userType: u.userType || 'accountant',
        language: u.language || 'ar',
        startDate: u.startDate || null
      };
    });
    console.log(`✅ تم جلب ${users.length} مستخدم نشط من Firestore`);
    return users;
  } catch (error) {
    console.error('❌ خطأ:', error.message);
    return null;
  }
}

async function main() {
  const users = await fetchUsers();
  if (users) {
    console.log(JSON.stringify(users, null, 2));
  } else {
    console.log('❌ لا توجد بيانات');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { fetchUsers };
