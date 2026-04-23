const axios = require('axios');
const OrderModel = require('../models/orderModel');

const PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE_URL || 'http://product-service:3002';

const placeOrder = async (req, res) => {
  try {
    const { items, shipping_address } = req.body;
    const userId = req.user.id;

    if (!items || items.length === 0 || !shipping_address) {
      return res.status(400).json({ error: 'Items and shipping address are required' });
    }

    let totalAmount = 0;

    // 1. Validate items and 2. Decrement stock
    for (const item of items) {
      // Validate product exists
      try {
        const prodRes = await axios.get(`${PRODUCT_SERVICE_URL}/api/products/${item.product_id}`);
        if (!prodRes.data) {
          throw new Error('Product not found');
        }
      } catch (err) {
        return res.status(400).json({ error: `Product ${item.product_id} validation failed` });
      }

      // Decrement stock
      try {
        await axios.put(`${PRODUCT_SERVICE_URL}/api/products/variant/${item.variant_id}/stock`, {
          quantity: item.quantity
        });
      } catch (err) {
        return res.status(409).json({ error: `Insufficient stock for product ${item.product_name}` });
      }

      totalAmount += (item.unit_price * item.quantity);
    }

    // 3. Create order
    const order = await OrderModel.createOrder(userId, items, shipping_address, totalAmount);
    res.status(201).json(order);
  } catch (error) {
    console.error('placeOrder error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getUserOrders = async (req, res) => {
  try {
    const userId = req.user.id;
    const orders = await OrderModel.getOrdersByUser(userId);
    res.status(200).json(orders);
  } catch (error) {
    console.error('getUserOrders error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getOrderById = async (req, res) => {
  try {
    const userId = req.user.id;
    const order = await OrderModel.getOrderByIdAndUser(req.params.id, userId);
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    res.status(200).json(order);
  } catch (error) {
    console.error('getOrderById error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const cancelOrder = async (req, res) => {
  try {
    const userId = req.user.id;
    const orderId = req.params.id;

    const order = await OrderModel.getOrderByIdAndUser(orderId, userId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.status !== 'pending') {
      return res.status(400).json({ error: 'Only pending orders can be cancelled' });
    }

    const updatedOrder = await OrderModel.updateOrderStatus(orderId, userId, 'cancelled');
    
    // In a real app, we would also restore the stock in the product service here via async event or API call
    
    res.status(200).json(updatedOrder);
  } catch (error) {
    console.error('cancelOrder error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  placeOrder,
  getUserOrders,
  getOrderById,
  cancelOrder
};
