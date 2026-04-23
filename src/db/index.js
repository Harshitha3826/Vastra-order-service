const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.ORDER_DB_HOST || 'localhost',
  port: process.env.ORDER_DB_PORT || 5432,
  database: process.env.ORDER_DB_NAME || 'orders_db',
  user: process.env.ORDER_DB_USER || 'vastraco_order',
  password: process.env.ORDER_DB_PASSWORD || 'orders_pass_123',
});

const initDb = async () => {
  const client = await pool.connect();
  try {
    console.log('Connected to Order DB, initializing tables...');
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        status VARCHAR(30) DEFAULT 'pending',
        total_amount NUMERIC(10, 2) NOT NULL,
        shipping_address JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS order_items (
        id SERIAL PRIMARY KEY,
        order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
        product_id UUID NOT NULL,
        variant_id INTEGER NOT NULL,
        product_name VARCHAR(200) NOT NULL,
        size VARCHAR(10),
        color VARCHAR(50),
        quantity INTEGER NOT NULL,
        unit_price NUMERIC(10, 2) NOT NULL
      );
    `);
    
    console.log('Order DB initialization complete.');
  } catch (err) {
    console.error('Error initializing Order DB', err);
    process.exit(1);
  } finally {
    client.release();
  }
};

module.exports = {
  query: (text, params) => pool.query(text, params),
  initDb,
  pool
};
