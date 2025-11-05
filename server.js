// ==================== IMPORTS ====================
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');

// ==================== APP INITIALIZATION ====================
const app = express();
const PORT = process.env.PORT || 3000;

// ==================== MIDDLEWARE ====================
app.use(cors());
app.use(express.json());

// ==================== DATABASE CONNECTION ====================
const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    "postgresql://neondb_owner:npg_KpT4ija0ENZb@ep-little-star-adsqx0be-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require",
  ssl: { rejectUnauthorized: false },
});

// ==================== ROOT ROUTE ====================
// Fixes "Cannot GET /"
app.get('/', (req, res) => {
  res.send('✅ GD Farms backend is running successfully on Render.');
});

// ==================== HEALTH CHECK ====================
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ success: true, message: 'Database connection OK' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Database not reachable' });
  }
});

// ==================== USER INITIALIZATION ====================
app.post('/api/user/init', async (req, res) => {
  try {
    const { userId } = req.body;

    if (userId) {
      const settingsResult = await pool.query(
        'SELECT * FROM user_settings WHERE user_id = $1',
        [userId]
      );

      if (settingsResult.rows.length > 0) {
        return res.json({
          success: true,
          userId,
          message: 'User validated successfully',
        });
      }
    }

    const newUserId = uuidv4();
    await pool.query('INSERT INTO user_settings (user_id) VALUES ($1)', [
      newUserId,
    ]);

    res.json({
      success: true,
      userId: newUserId,
      message: 'New user created successfully',
    });
  } catch (error) {
    console.error('User init error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during user initialization',
    });
  }
});

// ==================== ITEM ROUTES ====================

// Get all items
app.get('/api/items/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await pool.query(
      'SELECT * FROM items WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    res.json({ success: true, items: result.rows });
  } catch (error) {
    console.error('Get items error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch items' });
  }
});

// Add new item
app.post('/api/items', async (req, res) => {
  try {
    const {
      userId,
      name,
      quantity_value,
      quantity_unit,
      buying_price,
      selling_price,
    } = req.body;
    const result = await pool.query(
      `INSERT INTO items (user_id, name, quantity_value, quantity_unit, buying_price, selling_price)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [userId, name, quantity_value, quantity_unit, buying_price, selling_price]
    );
    res.json({
      success: true,
      item: result.rows[0],
      message: 'Item added successfully',
    });
  } catch (error) {
    console.error('Add item error:', error);
    res.status(500).json({ success: false, message: 'Failed to add item' });
  }
});

// Update item
app.put('/api/items/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      quantity_value,
      quantity_unit,
      buying_price,
      selling_price,
      userId,
    } = req.body;

    const result = await pool.query(
      `UPDATE items SET name = $1, quantity_value = $2, quantity_unit = $3,
       buying_price = $4, selling_price = $5, updated_at = NOW()
       WHERE id = $6 AND user_id = $7 RETURNING *`,
      [
        name,
        quantity_value,
        quantity_unit,
        buying_price,
        selling_price,
        id,
        userId,
      ]
    );

    if (result.rows.length === 0)
      return res.status(404).json({ success: false, message: 'Item not found' });

    res.json({
      success: true,
      item: result.rows[0],
      message: 'Item updated successfully',
    });
  } catch (error) {
    console.error('Update item error:', error);
    res.status(500).json({ success: false, message: 'Failed to update item' });
  }
});

// Delete item
app.delete('/api/items/:id/:userId', async (req, res) => {
  try {
    const { id, userId } = req.params;
    const result = await pool.query(
      'DELETE FROM items WHERE id = $1 AND user_id = $2 RETURNING *',
      [id, userId]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ success: false, message: 'Item not found' });

    res.json({ success: true, message: 'Item deleted successfully' });
  } catch (error) {
    console.error('Delete item error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete item' });
  }
});

// ==================== ANALYTICS ====================
app.get('/api/analytics/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const itemsResult = await pool.query(
      'SELECT * FROM items WHERE user_id = $1',
      [userId]
    );
    const items = itemsResult.rows;

    const totalInvestment = items.reduce(
      (sum, item) => sum + item.buying_price * item.quantity_value,
      0
    );
    const totalRevenue = items.reduce(
      (sum, item) => sum + item.selling_price * item.quantity_value,
      0
    );
    const totalProfit = totalRevenue - totalInvestment;
    const profitMargin =
      totalInvestment > 0 ? (totalProfit / totalInvestment) * 100 : 0;

    const topItems = items
      .map((item) => ({
        ...item,
        profit: (item.selling_price - item.buying_price) * item.quantity_value,
      }))
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 5);

    res.json({
      success: true,
      analytics: {
        totalInvestment,
        totalRevenue,
        totalProfit,
        profitMargin: parseFloat(profitMargin.toFixed(2)),
        totalItems: items.length,
        topItems,
      },
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ success: false, message: 'Failed to calculate analytics' });
  }
});

// ==================== USER SETTINGS ====================
app.get('/api/settings/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await pool.query(
      'SELECT * FROM user_settings WHERE user_id = $1',
      [userId]
    );
    if (result.rows.length === 0)
      return res
        .status(404)
        .json({ success: false, message: 'User settings not found' });
    res.json({ success: true, settings: result.rows[0] });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch settings' });
  }
});

app.put('/api/settings/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { currency, app_name, unit_preferences } = req.body;
    const result = await pool.query(
      `UPDATE user_settings SET currency = $1, app_name = $2, unit_preferences = $3, updated_at = NOW()
       WHERE user_id = $4 RETURNING *`,
      [currency, app_name, unit_preferences, userId]
    );
    if (result.rows.length === 0)
      return res
        .status(404)
        .json({ success: false, message: 'User settings not found' });
    res.json({
      success: true,
      settings: result.rows[0],
      message: 'Settings updated successfully',
    });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ success: false, message: 'Failed to update settings' });
  }
});

// ==================== GOALS ====================
app.post('/api/goals', async (req, res) => {
  try {
    const { userId, target_revenue, target_profit, deadline } = req.body;
    const result = await pool.query(
      `INSERT INTO goals (user_id, target_revenue, target_profit, deadline)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [userId, target_revenue, target_profit, deadline]
    );
    res.json({
      success: true,
      goal: result.rows[0],
      message: 'Goal set successfully',
    });
  } catch (error) {
    console.error('Set goal error:', error);
    res.status(500).json({ success: false, message: 'Failed to set goal' });
  }
});

app.get('/api/goals/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await pool.query(
      'SELECT * FROM goals WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
      [userId]
    );
    res.json({ success: true, goal: result.rows[0] || null });
  } catch (error) {
    console.error('Get goal error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch goal' });
  }
});

// ==================== SERVER START ====================
app.listen(PORT, () => {
  console.log(`✅ GD Farms backend server running on port ${PORT}`);
});

