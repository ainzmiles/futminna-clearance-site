require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const db = require('./db'); // The new database connection file

const app = express();
const PORT = process.env.PORT || 3001;

// --- Middleware ---
app.use(cors());
app.use(express.json());
// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// In production, serve the static files from the React app build
if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, '../build')));
}


// --- File Upload Configuration (Multer) ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, 'uploads/'));
  },
  filename: (req, file, cb) => {
    // Create a unique filename to avoid conflicts
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|pdf/;
  const mimetype = allowedTypes.test(file.mimetype);
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  if (mimetype && extname) {
    return cb(null, true);
  }
  cb(new Error('Invalid file type. Only JPG, PNG, and PDF are allowed.'));
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: fileFilter,
}).single('file');


// --- API Routes ---

// 1. User Login
app.post('/api/login', async (req, res) => {
  const { matric, password } = req.body;
  try {
    const { rows } = await db.query('SELECT * FROM students WHERE matric = $1', [matric]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    // Don't send the password hash back to the client
    delete user.password_hash;
    res.json({ message: 'Login successful', user });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error during login' });
  }
});

// 2. Get Certificate Readiness Status for a student
app.get('/api/status/:matric', async (req, res) => {
    try {
        const { rows } = await db.query('SELECT 1 FROM certificates_ready WHERE matric = $1', [req.params.matric]);
        res.json({ isReady: rows.length > 0 });
    } catch (err) {
        console.error('Status check error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// 3. Get all clearance documents for a student
app.get('/api/clearance/:matric', async (req, res) => {
    try {
        // Check if records exist, if not, create them
        let { rows } = await db.query('SELECT * FROM clearance_data WHERE matric = $1', [req.params.matric]);
        
        if (rows.length === 0) {
            // First time this student is logging in, create their default records
            const docTypes = ['statement_of_result', 'school_fees_receipt', 'clearance_form', 'certificate_payment_receipt', 'id_card'];
            const client = await db.getClient();
            try {
                await client.query('BEGIN');
                for (const docType of docTypes) {
                    await client.query('INSERT INTO clearance_data (matric, doc_type) VALUES ($1, $2)', [req.params.matric, docType]);
                }
                await client.query('COMMIT');
            } catch (e) {
                await client.query('ROLLBACK');
                throw e;
            } finally {
                client.release();
            }
             // Fetch the newly created rows
            ({ rows } = await db.query('SELECT * FROM clearance_data WHERE matric = $1', [req.params.matric]));
        }
        res.json(rows);
    } catch (err) {
        console.error('Clearance data fetch error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// 4. File Upload
app.post('/api/upload/:matric/:docType', (req, res) => {
  upload(req, res, async (err) => {
    if (err) {
      // Handle Multer errors (e.g., file size, type)
      return res.status(400).json({ message: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded.' });
    }
    
    try {
        const { matric, docType } = req.params;
        const filename = req.file.filename;
        await db.query(
            'UPDATE clearance_data SET status = $1, filename = $2 WHERE matric = $3 AND doc_type = $4',
            ['uploaded', filename, matric, docType]
        );
        res.json({ message: 'File uploaded successfully', filename });
    } catch(dbErr) {
        console.error('File upload DB error:', dbErr);
        res.status(500).json({ message: 'Server error saving file info.' });
    }
  });
});

// 5. View a file (securely sends the file from the non-public folder)
app.get('/api/view/:filename', (req, res) => {
    const filePath = path.join(__dirname, 'uploads', req.params.filename);
    res.sendFile(filePath, (err) => {
        if (err) {
            res.status(404).send('File not found.');
        }
    });
});

// 6. Download a file
app.get('/api/download/:filename', (req, res) => {
    const filePath = path.join(__dirname, 'uploads', req.params.filename);
    res.download(filePath, (err) => {
        if (err) {
            res.status(404).send('File not found.');
        }
    });
});

// 7. Delete a file
app.delete('/api/delete/:matric/:docType', async (req, res) => {
    // In a real app, you would also delete the file from the filesystem `fs.unlinkSync(filePath)`
    try {
        await db.query(
            "UPDATE clearance_data SET status = 'pending', filename = NULL WHERE matric = $1 AND doc_type = $2",
            [req.params.matric, req.params.docType]
        );
        res.sendStatus(200);
    } catch(err) {
        res.status(500).json({ message: 'Server error deleting file.' });
    }
});

// 8. Notify admin about ID card submission
app.post('/api/notify-id-card/:matric', async (req, res) => {
    try {
        await db.query(
            "UPDATE clearance_data SET notified_admin = TRUE WHERE matric = $1 AND doc_type = 'id_card'",
            [req.params.matric]
        );
        res.sendStatus(200);
    } catch(err) {
        res.status(500).json({ message: 'Server error.' });
    }
});


// --- ADMIN ROUTES ---

// Get all student data for admin dashboards
app.get('/api/admin/students', async (req, res) => {
    try {
        const { rows: students } = await db.query('SELECT matric, email, paid FROM students');
        const { rows: clearance } = await db.query('SELECT * FROM clearance_data');
        
        // Combine the data
        const studentData = students.map(s => ({
            ...s,
            clearance: clearance.filter(c => c.matric === s.matric)
        }));
        
        res.json(studentData);
    } catch(err) {
        console.error('Admin student fetch error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Update the status of a document
app.post('/api/admin/update-status', async (req, res) => {
    const { matric, docType, newStatus } = req.body;
    try {
        await db.query(
            'UPDATE clearance_data SET status = $1 WHERE matric = $2 AND doc_type = $3',
            [newStatus, matric, docType]
        );
        res.sendStatus(200);
    } catch(err) {
         console.error('Admin status update error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// --- Fallback for React Router ---
// In production, serve the React app for any request that doesn't match an API route
if (process.env.NODE_ENV === 'production') {
    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, '../build/index.html'));
    });
}

const server = app.listen(PORT, () => {
    console.log(`Backend server listening at http://localhost:${PORT}`);
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Another server may be running.`);
        process.exit(1);
    }
    console.error('Server error:', err);
    process.exit(1);
});
