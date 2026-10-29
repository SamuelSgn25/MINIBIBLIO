import pg from 'pg'
import dotenv from 'dotenv'

dotenv.config()

const {Pool } = pg;

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASS
});

pool.on('error', (err) => {
    console.error('Unexpected error on the idle client', err);
    process.exit(-1);
});

export default pool;
