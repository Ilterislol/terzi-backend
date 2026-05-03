const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json());

const DATABASE_URL =
    process.env.DATABASE_URL ||
    'mysql://root:dlhciiWzVrNHqZnuJDjuSTADmoSTnPHp@trolley.proxy.rlwy.net:14538/railway';

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const db = mysql.createConnection(DATABASE_URL);

db.connect((err) => {
    if (err) {
        console.error('MySQL connection error:', err);
        return;
    }

    console.log('Connected to cloud database.');
});

function query(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.query(sql, params, (err, results) => {
            if (err) {
                reject(err);
                return;
            }

            resolve(results);
        });
    });
}

function uploadBufferToCloudinary(buffer, folder) {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            {
                folder,
                resource_type: 'image',
                transformation: [{ width: 1200, crop: 'limit' }]
            },
            (error, result) => {
                if (error) {
                    reject(error);
                    return;
                }

                resolve(result);
            }
        );

        stream.end(buffer);
    });
}

app.get('/', (req, res) => {
    res.send('Terzi API sunucusu aktif.');
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

app.get('/customers', async (req, res) => {
    const search = String(req.query.search || '').trim();

    try {
        if (search) {
            const like = `%${search}%`;
            const results = await query(
                `SELECT *
                 FROM customers
                 WHERE full_name LIKE ? OR phone LIKE ?
                 ORDER BY id DESC`,
                [like, like]
            );

            res.json(results);
            return;
        }

        const results = await query('SELECT * FROM customers ORDER BY id DESC');
        res.json(results);
    } catch (err) {
        console.error('List error:', err);
        res.status(500).json({ error: 'Customers could not be listed.' });
    }
});

app.get('/stats', async (req, res) => {
    try {
        const rows = await query(`
            SELECT
                COUNT(*) AS total_customers,
                SUM(CASE WHEN photo_url IS NULL OR photo_url = '' THEN 0 ELSE 1 END) AS customers_with_photo,
                SUM(CASE WHEN neck > 0 OR chest > 0 OR waist > 0 OR shoulder > 0 OR arm_length > 0 THEN 1 ELSE 0 END) AS customers_with_measurements
            FROM customers
        `);

        const stats = rows[0] || {};
        res.json({
            total_customers: Number(stats.total_customers || 0),
            customers_with_photo: Number(stats.customers_with_photo || 0),
            customers_with_measurements: Number(stats.customers_with_measurements || 0)
        });
    } catch (err) {
        console.error('Stats error:', err);
        res.status(500).json({ error: 'Stats could not be loaded.' });
    }
});

app.post('/add-customer', async (req, res) => {
    const { full_name, phone, neck, chest, waist, shoulder, arm_length, photo_url } = req.body;

    if (!full_name || !phone) {
        res.status(400).json({ error: 'Full name and phone are required.' });
        return;
    }

    try {
        const result = await query(
            `INSERT INTO customers
             (full_name, phone, neck, chest, waist, shoulder, arm_length, photo_url)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                full_name,
                phone,
                neck || 0,
                chest || 0,
                waist || 0,
                shoulder || 0,
                arm_length || 0,
                photo_url || null
            ]
        );

        res.status(201).json({
            message: 'Customer saved.',
            id: result.insertId
        });
    } catch (err) {
        console.error('Insert error:', err);
        res.status(500).json({ error: 'Customer could not be saved.' });
    }
});

app.put('/update-measurements/:id', async (req, res) => {
    const customerId = req.params.id;
    const { neck, chest, waist, shoulder, arm_length } = req.body;

    try {
        await query(
            `UPDATE customers
             SET neck = ?, chest = ?, waist = ?, shoulder = ?, arm_length = ?
             WHERE id = ?`,
            [neck || 0, chest || 0, waist || 0, shoulder || 0, arm_length || 0, customerId]
        );

        res.json({ message: 'Measurements updated.' });
    } catch (err) {
        console.error('Update error:', err);
        res.status(500).json({ error: 'Measurements could not be updated.' });
    }
});

app.post('/upload-photo/:id', upload.single('photo'), async (req, res) => {
    const customerId = req.params.id;

    if (!req.file) {
        res.status(400).json({ error: 'Photo file is required.' });
        return;
    }

    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
        res.status(500).json({ error: 'Cloudinary environment variables are missing.' });
        return;
    }

    try {
        const uploaded = await uploadBufferToCloudinary(req.file.buffer, `tailor-customers/${customerId}`);
        await query('UPDATE customers SET photo_url = ? WHERE id = ?', [uploaded.secure_url, customerId]);

        res.json({
            message: 'Photo uploaded.',
            photo_url: uploaded.secure_url
        });
    } catch (err) {
        console.error('Photo upload error:', err);
        res.status(500).json({ error: 'Photo could not be uploaded.' });
    }
});

app.put('/update-photo/:id', async (req, res) => {
    const customerId = req.params.id;
    const { photo_url } = req.body;

    if (!photo_url) {
        res.status(400).json({ error: 'photo_url is required.' });
        return;
    }

    try {
        await query('UPDATE customers SET photo_url = ? WHERE id = ?', [photo_url, customerId]);
        res.json({ message: 'Photo URL updated.', photo_url });
    } catch (err) {
        console.error('Photo URL update error:', err);
        res.status(500).json({ error: 'Photo URL could not be updated.' });
    }
});

app.delete('/delete-customer/:id', async (req, res) => {
    const customerId = req.params.id;

    try {
        await query('DELETE FROM customers WHERE id = ?', [customerId]);
        res.json({ message: 'Customer deleted.' });
    } catch (err) {
        console.error('Delete error:', err);
        res.status(500).json({ error: 'Customer could not be deleted.' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on port ${PORT}.`);
});
