const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const sendTelegramNotification = require('./telegramService').sendTelegramNotification;

const app = express();
const PORT = process.env.PORT || 3001;

// Swagger configuration
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Fire Monitoring API',
      version: '2.0.0',
      description: 'Cyprus Fire Monitoring System - Real-time fire incident tracking and management API with GeoJSON support',
      contact: {
        name: 'API Support',
        email: 'support@firemonitoring.cy'
      }
    },
    servers: [
      {
        url: 'https://fire-monitoring-backend-txyh.onrender.com',
        description: 'Production server'
      },
      {
        url: 'http://localhost:3001',
        description: 'Development server'
      }
    ],
    tags: [
      {
        name: 'Fires',
        description: 'Fire incident management endpoints'
      }
    ]
  },
  apis: ['./server.js']
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Middleware
app.use(cors());
app.use(express.json());

// Swagger UI served under /docs to preserve JSON root endpoint
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Fire Monitoring API Documentation'
}));

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
            id: row.id,
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

// Root health/info endpoint (Swagger docs live at /docs)
app.get('/', (req, res) => {
    res.json({
        message: 'Fire Monitoring API',
        version: '2.0.0',
        format: 'GeoJSON',
        docs: '/docs',
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

/**
 * @swagger
 * /api/fires:
 *   get:
 *     summary: Get all fire incidents
 *     description: Retrieve all fire incidents in GeoJSON FeatureCollection format. Optionally filter by fire status.
 *     tags: [Fires]
 *     parameters:
 *       - in: query
 *         name: fire_status
 *         schema:
 *           type: string
 *           enum: [active, controlled, threat]
 *         description: Filter fires by status
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, controlled, threat]
 *         description: Alternative parameter for filtering by status
 *     responses:
 *       200:
 *         description: GeoJSON FeatureCollection of fire incidents
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 type:
 *                   type: string
 *                   example: FeatureCollection
 *                 features:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       type:
 *                         type: string
 *                         example: Feature
 *                       geometry:
 *                         type: object
 *                         properties:
 *                           type:
 *                             type: string
 *                             example: Point
 *                           coordinates:
 *                             type: array
 *                             items:
 *                               type: number
 *                             example: [33.0437, 34.6857]
 *                       properties:
 *                         type: object
 *                         properties:
 *                           fire_status:
 *                             type: string
 *                             enum: [active, controlled, threat]
 *                           fire_type:
 *                             type: string
 *                             example: forest
 *                           fire_intensity:
 *                             type: number
 *                             example: 450
 *                           fire_size:
 *                             type: number
 *                             description: Fire size in hectares
 *                             example: 12.5
 *                           confidence:
 *                             type: integer
 *                             example: 92
 *                           temperature:
 *                             type: number
 *                             example: 35
 *                           humidity:
 *                             type: integer
 *                             example: 18
 *                           wind_speed:
 *                             type: number
 *                             example: 25
 *                           nearest_village:
 *                             type: string
 *                             example: Troodos
 *                           risk_to_settlements:
 *                             type: string
 *                             enum: [low, medium, high]
 *       500:
 *         description: Database error
 */
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

/**
 * @swagger
 * /api/fires/{id}:
 *   get:
 *     summary: Get fire incident by ID
 *     description: Retrieve a single fire incident by its ID in GeoJSON Feature format
 *     tags: [Fires]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Fire incident ID
 *     responses:
 *       200:
 *         description: GeoJSON Feature representing the fire incident
 *       404:
 *         description: Fire not found
 *       500:
 *         description: Database error
 */
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

/**
 * @swagger
 * /api/fires:
 *   post:
 *     summary: Create new fire incident
 *     description: Report a new fire incident with location and optional detailed information
 *     tags: [Fires]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - latitude
 *               - longitude
 *             properties:
 *               latitude:
 *                 type: number
 *                 description: Latitude (-90 to 90)
 *                 example: 34.6857
 *               longitude:
 *                 type: number
 *                 description: Longitude (-180 to 180)
 *                 example: 33.0437
 *               fire_status:
 *                 type: string
 *                 enum: [active, controlled, threat]
 *                 default: active
 *               fire_type:
 *                 type: string
 *                 example: wildfire
 *               fire_intensity:
 *                 type: number
 *                 default: 100
 *               fire_size:
 *                 type: number
 *                 description: Fire size in hectares
 *                 default: 1.0
 *               confidence:
 *                 type: integer
 *                 default: 85
 *               temperature:
 *                 type: number
 *                 default: 30
 *               humidity:
 *                 type: integer
 *                 default: 25
 *               wind_speed:
 *                 type: number
 *                 default: 10
 *               wind_direction:
 *                 type: integer
 *                 default: 180
 *               district:
 *                 type: string
 *                 example: Limassol
 *               nearest_village:
 *                 type: string
 *                 example: Troodos
 *               risk_to_settlements:
 *                 type: string
 *                 enum: [low, medium, high]
 *                 default: medium
 *               reporter_name:
 *                 type: string
 *               reporter_contact:
 *                 type: string
 *     responses:
 *       201:
 *         description: Fire incident created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *       400:
 *         description: Validation error
 *       500:
 *         description: Database error
 */
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

/**
 * @swagger
 * /api/fires/{id}:
 *   patch:
 *     summary: Update fire incident
 *     description: Update any field of an existing fire incident. All fields are optional. The last_update timestamp is automatically updated.
 *     tags: [Fires]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Fire incident ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fire_status:
 *                 type: string
 *                 enum: [active, controlled, threat]
 *               fire_intensity:
 *                 type: number
 *               fire_size:
 *                 type: number
 *               temperature:
 *                 type: number
 *               wind_speed:
 *                 type: number
 *               evacuation_status:
 *                 type: string
 *               firefighters:
 *                 type: integer
 *               vehicles:
 *                 type: integer
 *               aircraft:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Fire incident updated successfully
 *       400:
 *         description: No valid fields to update
 *       404:
 *         description: Fire not found
 *       500:
 *         description: Database error
 */
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

/**
 * @swagger
 * /api/fires:
 *   delete:
 *     summary: Delete all fire incidents
 *     description: Permanently delete all fire incidents from the database. Used before generating a new set of fires.
 *     tags: [Fires]
 *     responses:
 *       200:
 *         description: All fire incidents deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 deletedCount:
 *                   type: integer
 *       500:
 *         description: Database error
 */
// DELETE all fires
app.delete('/api/fires', (req, res) => {
    db.run('DELETE FROM fires', [], function(err) {
        if (err) {
            console.error('Error deleting all fires:', err);
            return res.status(500).json({ error: 'Database error' });
        }

        res.json({
            success: true,
            message: `Deleted ${this.changes} fire(s) from database`,
            deletedCount: this.changes
        });
    });
});

/**
 * @swagger
 * /api/fires/{id}:
 *   delete:
 *     summary: Delete fire incident
 *     description: Permanently delete a fire incident from the database
 *     tags: [Fires]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Fire incident ID
 *     responses:
 *       200:
 *         description: Fire incident deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       404:
 *         description: Fire not found
 *       500:
 *         description: Database error
 */
// DELETE fire by id
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

// Notification endpoints
app.post('/api/notifications/send', async (req, res) => {
    try {
        const { message, evacuationPoints = [], location = null } = req.body;

        // Validation
        if (!message || typeof message !== 'string' || !message.trim()) {
            return res.status(400).json({
                error: 'Message is required and must be a non-empty string'
            });
        }

        // Validate evacuation points format if provided
        if (evacuationPoints && Array.isArray(evacuationPoints) && evacuationPoints.length > 0) {
            for (const point of evacuationPoints) {
                if (!Array.isArray(point) || point.length !== 2) {
                    return res.status(400).json({
                        error: 'Each evacuation point must be an array of [lat, lng]'
                    });
                }
                const [lat, lng] = point;
                if (typeof lat !== 'number' || typeof lng !== 'number' ||
                    lat < -90 || lat > 90 || lng < -180 || lng > 180) {
                    return res.status(400).json({
                        error: 'Invalid coordinates in evacuation points'
                    });
                }
            }
        }

        const results = {
            telegram: null,
            errors: []
        };

        // Send to Telegram if configured
        const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
        const telegramChatId = process.env.TELEGRAM_CHAT_ID || '@hotSpotFireAlarm';

        if (telegramBotToken) {
            try {
                const telegramResult = await sendTelegramNotification(
                    telegramBotToken,
                    telegramChatId,
                    message,
                    evacuationPoints,
                    location
                );
                results.telegram = telegramResult;
            } catch (error) {
                console.error('Telegram notification error:', error);
                results.errors.push({ service: 'telegram', error: error.message });
            }
        }

        // Return success if at least one service succeeded
        if (results.telegram) {
            res.json({
                success: true,
                message: 'Notification sent successfully',
                results
            });
        } else {
            res.status(500).json({
                success: false,
                error: 'Failed to send notification to any service',
                results
            });
        }
    } catch (error) {
        console.error('Notification send error:', error);
        res.status(500).json({
            error: error.message || 'Internal server error'
        });
    }
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
