const mysql = require('mysql2/promise');

const DATABASE_URL =
    process.env.DATABASE_URL ||
    'mysql://root:dlhciiWzVrNHqZnuJDjuSTADmoSTnPHp@trolley.proxy.rlwy.net:14538/railway';

async function main() {
    const db = await mysql.createConnection(DATABASE_URL);
    const [columns] = await db.query('SHOW COLUMNS FROM customers LIKE ?', ['photo_url']);

    if (columns.length === 0) {
        await db.query('ALTER TABLE customers ADD COLUMN photo_url VARCHAR(500) NULL');
        console.log('photo_url column added');
    } else {
        console.log('photo_url column already exists');
    }

    await db.end();
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
