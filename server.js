const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const cors = require('cors');
const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());

const DB_FILE = './db.json';

function loadData() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ products: [], categories: [], customers: [], sales: [] }));
  }
  return JSON.parse(fs.readFileSync(DB_FILE));
}

function saveData(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// استرجاع كل البيانات
app.get('/api/data', (req, res) => {
  res.json(loadData());
});

// إضافة منتج جديد
app.post('/api/products', (req, res) => {
  const data = loadData();
  data.products.push(req.body);
  saveData(data);
  res.json({ success: true });
});

// إضافة فئة جديدة
app.post('/api/categories', (req, res) => {
  const data = loadData();
  data.categories.push(req.body);
  saveData(data);
  res.json({ success: true });
});

// إضافة عميل جديد
app.post('/api/customers', (req, res) => {
  const data = loadData();
  data.customers.push(req.body);
  saveData(data);
  res.json({ success: true });
});

// إضافة بيع
app.post('/api/sales', (req, res) => {
  const data = loadData();
  const sale = { ...req.body, date: new Date().toLocaleString() };
  data.sales.push(sale);
  saveData(data);
  res.json({ success: true });
});

// ملخص المبيعات اليومي
app.get('/api/sales/today', (req, res) => {
  const data = loadData();
  const today = new Date().toLocaleDateString();
  const todaySales = data.sales.filter(s => new Date(s.date).toLocaleDateString() === today);
  res.json(todaySales);
});

app.listen(PORT, () => {
  console.log(`POS Server running on http://localhost:${PORT}`);
});