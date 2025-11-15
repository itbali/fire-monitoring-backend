const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Database setup
const dbPath = path.join(__dirname, 'fires.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Ошибка подключения к БД:', err);
  } else {
    console.log('Подключено к SQLite базе данных');
    initializeDatabase();
  }
});

// Initialize database schema
function initializeDatabase() {
  db.run(`
    CREATE TABLE IF NOT EXISTS fires (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      intensity TEXT CHECK(intensity IN ('low', 'medium', 'high')) DEFAULT 'medium',
      description TEXT,
      reported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT CHECK(status IN ('active', 'contained', 'extinguished')) DEFAULT 'active',
      reporter_name TEXT,
      reporter_contact TEXT
    )
  `, (err) => {
    if (err) {
      console.error('Ошибка создания таблицы:', err);
    } else {
      console.log('Таблица fires готова');
      seedInitialData();
    }
  });
}

// Seed initial data if table is empty
function seedInitialData() {
  db.get('SELECT COUNT(*) as count FROM fires', (err, row) => {
    if (err) {
      console.error('Ошибка проверки данных:', err);
      return;
    }

    if (row.count === 0) {
      console.log('Добавление тестовых данных...');
      const initialFires = [
        {
          latitude: 34.6857,
          longitude: 33.0437,
          intensity: 'high',
          description: 'Large forest fire near Troodos Mountains',
          status: 'active'
        },
        {
          latitude: 35.1264,
          longitude: 33.4299,
          intensity: 'medium',
          description: 'Fire in agricultural area near Nicosia',
          status: 'active'
        },
        {
          latitude: 34.7575,
          longitude: 32.4242,
          intensity: 'low',
          description: 'Small fire near Paphos, under control',
          status: 'contained'
        }
      ];

      const stmt = db.prepare(`
        INSERT INTO fires (latitude, longitude, intensity, description, status)
        VALUES (?, ?, ?, ?, ?)
      `);

      initialFires.forEach(fire => {
        stmt.run(fire.latitude, fire.longitude, fire.intensity, fire.description, fire.status);
      });

      stmt.finalize(() => {
        console.log('Тестовые данные добавлены');
      });
    }
  });
}

// Routes

// Health check
app.get('/', (req, res) => {
  res.json({
    message: 'Fire Monitoring API',
    version: '1.0.0',
    endpoints: {
      fires: {
        getAll: 'GET /api/fires',
        getActive: 'GET /api/fires?status=active',
        create: 'POST /api/fires'
      }
    }
  });
});

// GET all fires (with optional status filter)
app.get('/api/fires', (req, res) => {
  const { status } = req.query;

  let query = 'SELECT * FROM fires ORDER BY reported_at DESC';
  let params = [];

  if (status) {
    query = 'SELECT * FROM fires WHERE status = ? ORDER BY reported_at DESC';
    params = [status];
  }

  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('Ошибка получения данных:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    res.json({
      success: true,
      count: rows.length,
      data: rows
    });
  });
});

// GET single fire by ID
app.get('/api/fires/:id', (req, res) => {
  const { id } = req.params;

  db.get('SELECT * FROM fires WHERE id = ?', [id], (err, row) => {
    if (err) {
      console.error('Ошибка получения данных:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    if (!row) {
      return res.status(404).json({ error: 'Fire not found' });
    }

    res.json({
      success: true,
      data: row
    });
  });
});

// POST new fire report
app.post('/api/fires', (req, res) => {
  const {
    latitude,
    longitude,
    intensity = 'medium',
    description = '',
    reporter_name = '',
    reporter_contact = ''
  } = req.body;

  // Validation
  if (!latitude || !longitude) {
    return res.status(400).json({
      error: 'Latitude and longitude are required'
    });
  }

  if (latitude < -90 || latitude > 90) {
    return res.status(400).json({
      error: 'Invalid latitude (must be between -90 and 90)'
    });
  }

  if (longitude < -180 || longitude > 180) {
    return res.status(400).json({
      error: 'Invalid longitude (must be between -180 and 180)'
    });
  }

  if (!['low', 'medium', 'high'].includes(intensity)) {
    return res.status(400).json({
      error: 'Invalid intensity (must be low, medium, or high)'
    });
  }

  const query = `
    INSERT INTO fires (latitude, longitude, intensity, description, reporter_name, reporter_contact)
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  db.run(query, [latitude, longitude, intensity, description, reporter_name, reporter_contact], function(err) {
    if (err) {
      console.error('Ошибка создания репорта:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    // Return the created fire
    db.get('SELECT * FROM fires WHERE id = ?', [this.lastID], (err, row) => {
      if (err) {
        console.error('Ошибка получения созданного репорта:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      res.status(201).json({
        success: true,
        message: 'Fire report created successfully',
        data: row
      });
    });
  });
});

// UPDATE fire status
app.patch('/api/fires/:id', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status || !['active', 'contained', 'extinguished'].includes(status)) {
    return res.status(400).json({
      error: 'Invalid status (must be active, contained, or extinguished)'
    });
  }

  db.run('UPDATE fires SET status = ? WHERE id = ?', [status, id], function(err) {
    if (err) {
      console.error('Ошибка обновления статуса:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: 'Fire not found' });
    }

    db.get('SELECT * FROM fires WHERE id = ?', [id], (err, row) => {
      if (err) {
        console.error('Ошибка получения обновленного репорта:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      res.json({
        success: true,
        message: 'Fire status updated successfully',
        data: row
      });
    });
  });
});

// DELETE fire (soft delete by setting status to extinguished)
app.delete('/api/fires/:id', (req, res) => {
  const { id } = req.params;

  db.run('DELETE FROM fires WHERE id = ?', [id], function(err) {
    if (err) {
      console.error('Ошибка удаления:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: 'Fire not found' });
    }

    res.json({
      success: true,
      message: 'Fire deleted successfully'
    });
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🔥 Fire Monitoring API запущен на порту ${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) {
      console.error('Ошибка закрытия БД:', err);
    } else {
      console.log('БД закрыта');
    }
    process.exit(0);
  });
});
