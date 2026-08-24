const SECRET_KEY = atob('RENIQ19TRUNVUkVfMjAyNA==');
const USERS_SCRIPT_URL = `https://script.google.com/macros/s/AKfycbxNNFfi5IEWDZ4kgSEHmM_gbIJxjOx15r71BZ0dSliXLrW_itIpwvNwsGi_MiWevbmdZQ/exec?key=${SECRET_KEY}`;

async function fetchUsers() {
  console.log('🚀 جاري الاتصال بـ Apps Script...');
  try {
    const response = await fetch(USERS_SCRIPT_URL);
    if (!response.ok) throw new Error(`فشل الطلب: ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data)) throw new Error('البيانات ليست مصفوفة');
    console.log(`✅ تم جلب ${data.length} مستخدم`);
    return data;
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

main();
