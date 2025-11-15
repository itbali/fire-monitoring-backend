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
    console.error('Database connection error:', err);
  } else {
    console.log('Connected to SQLite database');
    initializeDatabase();
  }
});

// Initialize database schema with all required fields
function initializeDatabase() {
  db.run(`
    CREATE TABLE IF NOT EXISTS fires (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,

      -- Timestamps
      timestamp_detected DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_update DATETIME DEFAULT CURRENT_TIMESTAMP,

      -- Fire status and characteristics
      fire_status TEXT CHECK(fire_status IN ('active', 'controlled', 'threat')) DEFAULT 'active',
      fire_type TEXT DEFAULT 'wildfire',
      fire_intensity REAL DEFAULT 100,
      fire_size REAL DEFAULT 1.0,
      confidence INTEGER DEFAULT 85,

      -- Environmental conditions
      fuel_type TEXT DEFAULT 'mixed_forest',
      terrain_type TEXT DEFAULT 'mountain',
      slope REAL DEFAULT 15,

      -- Weather conditions
      temperature REAL DEFAULT 30,
      humidity INTEGER DEFAULT 25,
      wind_speed REAL DEFAULT 10,
      wind_direction INTEGER DEFAULT 180,
      wind_type TEXT DEFAULT 'meltemi',

      -- Response information
      agency_in_charge TEXT DEFAULT 'Cyprus Fire Service',
      response_level TEXT DEFAULT 'district',
      firefighters INTEGER DEFAULT 20,
      vehicles INTEGER DEFAULT 5,
      aircraft INTEGER DEFAULT 1,
      evacuation_status TEXT DEFAULT 'none',

      -- Location information
      district TEXT DEFAULT 'Limassol',
      nearest_village TEXT DEFAULT 'Unknown',
      distance_to_village REAL DEFAULT 1.5,
      risk_to_settlements TEXT CHECK(risk_to_settlements IN ('low', 'medium', 'high')) DEFAULT 'medium',

      -- Legacy fields for compatibility
      reporter_name TEXT,
      reporter_contact TEXT
    )
  `, (err) => {
    if (err) {
      console.error('Error creating table:', err);
    } else {
      console.log('Fires table ready');
      seedInitialData();
    }
  });
}

// Seed initial data with complete information
function seedInitialData() {
  db.get('SELECT COUNT(*) as count FROM fires', (err, row) => {
    if (err) {
      console.error('Error checking data:', err);
      return;
    }

    if (row.count === 0) {
      console.log('Seeding initial data...');
      const initialFires = [
        {
          latitude: 34.6857,
          longitude: 33.0437,
          fire_status: 'active',
          fire_type: 'forest',
          fire_intensity: 450,
          fire_size: 12.5,
          confidence: 92,
          fuel_type: 'pine_forest',
          terrain_type: 'mountain',
          slope: 28,
          temperature: 35,
          humidity: 18,
          wind_speed: 25,
          wind_direction: 270,
          wind_type: 'meltemi',
          agency_in_charge: 'Cyprus Fire Service',
          response_level: 'national',
          firefighters: 45,
          vehicles: 12,
          aircraft: 3,
          evacuation_status: 'partial',
          district: 'Limassol',
          nearest_village: 'Troodos',
          distance_to_village: 2.3,
          risk_to_settlements: 'high'
        },
        {
          latitude: 35.1264,
          longitude: 33.4299,
          fire_status: 'active',
          fire_type: 'agricultural',
          fire_intensity: 180,
          fire_size: 5.2,
          confidence: 85,
          fuel_type: 'crop_residue',
          terrain_type: 'plain',
          slope: 5,
          temperature: 32,
          humidity: 22,
          wind_speed: 12,
          wind_direction: 90,
          wind_type: 'levante',
          agency_in_charge: 'Cyprus Fire Service',
          response_level: 'district',
          firefighters: 25,
          vehicles: 6,
          aircraft: 1,
          evacuation_status: 'none',
          district: 'Nicosia',
          nearest_village: 'Nicosia',
          distance_to_village: 0.8,
          risk_to_settlements: 'medium'
        },
        {
          latitude: 34.7575,
          longitude: 32.4242,
          fire_status: 'controlled',
          fire_type: 'grassland',
          fire_intensity: 75,
          fire_size: 2.1,
          confidence: 78,
          fuel_type: 'dry_grass',
          terrain_type: 'coastal',
          slope: 8,
          temperature: 28,
          humidity: 35,
          wind_speed: 8,
          wind_direction: 180,
          wind_type: 'ostro',
          agency_in_charge: 'Cyprus Fire Service',
          response_level: 'local',
          firefighters: 12,
          vehicles: 3,
          aircraft: 0,
          evacuation_status: 'none',
          district: 'Paphos',
          nearest_village: 'Paphos',
          distance_to_village: 1.2,
          risk_to_settlements: 'low'
        }
      ];

      const stmt = db.prepare(`
        INSERT INTO fires (
          latitude, longitude, fire_status, fire_type, fire_intensity, fire_size, confidence,
          fuel_type, terrain_type, slope, temperature, humidity, wind_speed, wind_direction,
          wind_type, agency_in_charge, response_level, firefighters, vehicles, aircraft,
          evacuation_status, district, nearest_village, distance_to_village, risk_to_settlements
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      initialFires.forEach(fire => {
        stmt.run(
          fire.latitude, fire.longitude, fire.fire_status, fire.fire_type, fire.fire_intensity,
          fire.fire_size, fire.confidence, fire.fuel_type, fire.terrain_type, fire.slope,
          fire.temperature, fire.humidity, fire.wind_speed, fire.wind_direction, fire.wind_type,
          fire.agency_in_charge, fire.response_level, fire.firefighters, fire.vehicles,
          fire.aircraft, fire.evacuation_status, fire.district, fire.nearest_village,
          fire.distance_to_village, fire.risk_to_settlements
        );
      });

      stmt.finalize(() => {
        console.log('Initial data seeded successfully');
      });
    }
  });
}

// Convert database row to GeoJSON Feature
function rowToGeoJSON(row) {
  return {
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [row.longitude, row.latitude]
    },
    properties: {
      timestamp_detected: row.timestamp_detected,
      last_update: row.last_update,
      fire_status: row.fire_status,
      fire_type: row.fire_type,
      fire_intensity: row.fire_intensity,
      fire_size: row.fire_size,
      confidence: row.confidence,
      fuel_type: row.fuel_type,
      terrain_type: row.terrain_type,
      slope: row.slope,
      temperature: row.temperature,
      humidity: row.humidity,
      wind_speed: row.wind_speed,
      wind_direction: row.wind_direction,
      wind_type: row.wind_type,
      agency_in_charge: row.agency_in_charge,
      response_level: row.response_level,
      resources_on_site: {
        firefighters: row.firefighters,
        vehicles: row.vehicles,
        aircraft: row.aircraft
      },
      evacuation_status: row.evacuation_status,
      district: row.district,
      nearest_village: row.nearest_village,
      distance_to_village: row.distance_to_village,
      risk_to_settlements: row.risk_to_settlements
    }
  };
}

// Routes

// Health check
app.get('/', (req, res) => {
  res.json({
    message: 'Fire Monitoring API',
    version: '2.0.0',
    format: 'GeoJSON',
    endpoints: {
      fires: {
        getAll: 'GET /api/fires',
        getActive: 'GET /api/fires?fire_status=active',
        getById: 'GET /api/fires/:id',
        create: 'POST /api/fires',
        update: 'PATCH /api/fires/:id',
        delete: 'DELETE /api/fires/:id'
      }
    }
  });
});

// GET all fires in GeoJSON format (with optional status filter)
app.get('/api/fires', (req, res) => {
  const { fire_status, status } = req.query;
  const statusFilter = fire_status || status;

  let query = 'SELECT * FROM fires ORDER BY timestamp_detected DESC';
  let params = [];

  if (statusFilter) {
    query = 'SELECT * FROM fires WHERE fire_status = ? ORDER BY timestamp_detected DESC';
    params = [statusFilter];
  }

  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('Error fetching data:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    // Convert to GeoJSON FeatureCollection
    const geoJSON = {
      type: 'FeatureCollection',
      features: rows.map(rowToGeoJSON)
    };

    res.json(geoJSON);
  });
});

// GET single fire by ID in GeoJSON format
app.get('/api/fires/:id', (req, res) => {
  const { id } = req.params;

  db.get('SELECT * FROM fires WHERE id = ?', [id], (err, row) => {
    if (err) {
      console.error('Error fetching data:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    if (!row) {
      return res.status(404).json({ error: 'Fire not found' });
    }

    res.json(rowToGeoJSON(row));
  });
});

// POST new fire report
app.post('/api/fires', (req, res) => {
  const {
    latitude,
    longitude,
    fire_status = 'active',
    fire_type = 'wildfire',
    fire_intensity = 100,
    fire_size = 1.0,
    confidence = 85,
    fuel_type = 'mixed_forest',
    terrain_type = 'mountain',
    slope = 15,
    temperature = 30,
    humidity = 25,
    wind_speed = 10,
    wind_direction = 180,
    wind_type = 'meltemi',
    agency_in_charge = 'Cyprus Fire Service',
    response_level = 'district',
    firefighters = 20,
    vehicles = 5,
    aircraft = 1,
    evacuation_status = 'none',
    district = 'Unknown',
    nearest_village = 'Unknown',
    distance_to_village = 1.5,
    risk_to_settlements = 'medium',
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

  if (!['active', 'controlled', 'threat'].includes(fire_status)) {
    return res.status(400).json({
      error: 'Invalid fire_status (must be active, controlled, or threat)'
    });
  }

  if (!['low', 'medium', 'high'].includes(risk_to_settlements)) {
    return res.status(400).json({
      error: 'Invalid risk_to_settlements (must be low, medium, or high)'
    });
  }

  const query = `
    INSERT INTO fires (
      latitude, longitude, fire_status, fire_type, fire_intensity, fire_size, confidence,
      fuel_type, terrain_type, slope, temperature, humidity, wind_speed, wind_direction,
      wind_type, agency_in_charge, response_level, firefighters, vehicles, aircraft,
      evacuation_status, district, nearest_village, distance_to_village, risk_to_settlements,
      reporter_name, reporter_contact
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.run(query, [
    latitude, longitude, fire_status, fire_type, fire_intensity, fire_size, confidence,
    fuel_type, terrain_type, slope, temperature, humidity, wind_speed, wind_direction,
    wind_type, agency_in_charge, response_level, firefighters, vehicles, aircraft,
    evacuation_status, district, nearest_village, distance_to_village, risk_to_settlements,
    reporter_name, reporter_contact
  ], function(err) {
    if (err) {
      console.error('Error creating report:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    // Return the created fire in GeoJSON format
    db.get('SELECT * FROM fires WHERE id = ?', [this.lastID], (err, row) => {
      if (err) {
        console.error('Error fetching created report:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      res.status(201).json({
        success: true,
        message: 'Fire report created successfully',
        data: rowToGeoJSON(row)
      });
    });
  });
});

// UPDATE fire (any field)
app.patch('/api/fires/:id', (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  // Build dynamic update query
  const allowedFields = [
    'fire_status', 'fire_type', 'fire_intensity', 'fire_size', 'confidence',
    'fuel_type', 'terrain_type', 'slope', 'temperature', 'humidity',
    'wind_speed', 'wind_direction', 'wind_type', 'agency_in_charge',
    'response_level', 'firefighters', 'vehicles', 'aircraft',
    'evacuation_status', 'district', 'nearest_village',
    'distance_to_village', 'risk_to_settlements'
  ];

  const updateFields = [];
  const updateValues = [];

  Object.keys(updates).forEach(key => {
    if (allowedFields.includes(key)) {
      updateFields.push(`${key} = ?`);
      updateValues.push(updates[key]);
    }
  });

  if (updateFields.length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' });
  }

  // Always update last_update timestamp
  updateFields.push('last_update = CURRENT_TIMESTAMP');
  updateValues.push(id);

  const query = `UPDATE fires SET ${updateFields.join(', ')} WHERE id = ?`;

  db.run(query, updateValues, function(err) {
    if (err) {
      console.error('Error updating fire:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: 'Fire not found' });
    }

    db.get('SELECT * FROM fires WHERE id = ?', [id], (err, row) => {
      if (err) {
        console.error('Error fetching updated report:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      res.json({
        success: true,
        message: 'Fire updated successfully',
        data: rowToGeoJSON(row)
      });
    });
  });
});

// DELETE fire
app.delete('/api/fires/:id', (req, res) => {
  const { id } = req.params;

  db.run('DELETE FROM fires WHERE id = ?', [id], function(err) {
    if (err) {
      console.error('Error deleting fire:', err);
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
  console.log(`🔥 Fire Monitoring API v2.0 running on port ${PORT}`);
  console.log(`📍 GeoJSON format enabled`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err);
    } else {
      console.log('Database closed');
    }
    process.exit(0);
  });
});
