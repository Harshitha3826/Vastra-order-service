const db = require('../db');

const OrderModel = {
  async createOrder(userId, items, shippingAddress, totalAmount) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      const orderResult = await client.query(
        `INSERT INTO orders (user_id, status, total_amount, shipping_address) 
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [userId, 'pending', totalAmount, shippingAddress]
      );
      const order = orderResult.rows[0];

      for (const item of items) {
        await client.query(
          `INSERT INTO order_items (order_id, product_id, variant_id, product_name, size, color, quantity, unit_price) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [order.id, item.product_id, item.variant_id, item.product_name, item.size, item.color, item.quantity, item.unit_price]
        );
      }

      await client.query('COMMIT');
      
      // Fetch the items to return with the order
      const itemsResult = await db.query(
        'SELECT * FROM order_items WHERE order_id = $1',
        [order.id]
      );
      order.items = itemsResult.rows;

      return order;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  },

  async getOrdersByUser(userId) {
    const result = await db.query(
      `SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );
    const orders = result.rows;

    for (const order of orders) {
      const itemsResult = await db.query(
        'SELECT * FROM order_items WHERE order_id = $1',
        [order.id]
      );
      order.items = itemsResult.rows;
    }

    return orders;
  },

  async getOrderByIdAndUser(orderId, userId) {
    const result = await db.query(
      `SELECT * FROM orders WHERE id = $1 AND user_id = $2`,
      [orderId, userId]
    );
    if (result.rows.length === 0) return null;

    const order = result.rows[0];
    const itemsResult = await db.query(
      'SELECT * FROM order_items WHERE order_id = $1',
      [order.id]
    );
    order.items = itemsResult.rows;

    return order;
  },

  async updateOrderStatus(orderId, userId, status) {
    const result = await db.query(
      `UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3 RETURNING *`,
      [status, orderId, userId]
    );
    return result.rows[0];
  }
};

module.exports = OrderModel;
