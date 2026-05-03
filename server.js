const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());

// Güvenli kullanım: Railway'de DATABASE_URL ortam değişkeni olarak tanımla
const BULUT_URL = process.env.DATABASE_URL || "mysql://root:dlhciiWzVrNHqZnuJDjuSTADmoSTnPHp@trolley.proxy.rlwy.net:14538/railway";

const db = mysql.createConnection(BULUT_URL);

db.connect((err) => {
    if (err) {
        console.error('MySQL Bağlantı Hatası:', err);
        return;
    }

    console.log('✅ BULUT Veritabanına Bağlanıldı!');
});

app.get('/', (req, res) => {
    res.send('Terzi API Sunucusu Aktif!');
});

app.get('/customers', (req, res) => {
    const sql = "SELECT * FROM customers";

    db.query(sql, (err, results) => {
        if (err) {
            console.error("Listeleme hatası:", err);
            return res.status(500).json({ error: "Müşteriler listelenemedi" });
        }

        res.json(results);
    });
});

app.post('/add-customer', (req, res) => {
    const { full_name, phone, neck, chest, waist, shoulder, arm_length } = req.body;

    const sql = `
        INSERT INTO customers 
        (full_name, phone, neck, chest, waist, shoulder, arm_length) 
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(
        sql,
        [
            full_name,
            phone,
            neck || 0,
            chest || 0,
            waist || 0,
            shoulder || 0,
            arm_length || 0
        ],
        (err, result) => {
            if (err) {
                console.error("Ekleme hatası:", err);
                return res.status(500).json({ error: "Müşteri eklenemedi" });
            }

            res.status(200).json({
                message: "Müşteri kaydedildi!",
                id: result.insertId
            });
        }
    );
});

app.put('/update-measurements/:id', (req, res) => {
    const customerId = req.params.id;
    const { neck, chest, waist, shoulder, arm_length } = req.body;

    const sql = `
        UPDATE customers 
        SET neck = ?, chest = ?, waist = ?, shoulder = ?, arm_length = ? 
        WHERE id = ?
    `;

    db.query(
        sql,
        [neck || 0, chest || 0, waist || 0, shoulder || 0, arm_length || 0, customerId],
        (err, result) => {
            if (err) {
                console.error("Güncelleme hatası:", err);
                return res.status(500).json({ error: "Ölçüler güncellenemedi" });
            }

            res.json({ message: "Ölçüler başarıyla güncellendi!" });
        }
    );
});

app.delete('/delete-customer/:id', (req, res) => {
    const customerId = req.params.id;

    const sql = "DELETE FROM customers WHERE id = ?";

    db.query(sql, [customerId], (err, result) => {
        if (err) {
            console.error("Silme hatası:", err);
            return res.status(500).json({ error: "Müşteri silinemedi" });
        }

        res.json({ message: "Müşteri başarıyla silindi!" });
    });
});

const PORT = process.env.PORT || 3000;
app.listen(3000, '0.0.0.0', () => {
    console.log("Sunucu tüm ağ arabirimlerinde dinleniyor!");
});
