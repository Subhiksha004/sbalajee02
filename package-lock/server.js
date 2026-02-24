const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const path = require('path');
const cors = require('cors'); 
const bcrypt = require('bcryptjs'); 

const app = express();
const port = 5500;

// Middleware
app.use(cors()); 
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// --- DATABASE CONNECTION ---
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'root', 
    database: 'scholars_hub'
});

db.connect((err) => {
    if (err) {
        console.error('❌ Database Connection Failed:', err.message);
        return;
    }
    console.log('✅ Connected to MySQL database');
});

// --- SIGNUP ROUTE ---
app.post('/api/signup', async (req, res) => {
    const { fullName, email, phone, course, password } = req.body;
    
    db.query('SELECT email FROM users WHERE email = ?', [email], async (err, results) => {
        if (err) return res.status(500).json({ success: false, message: 'Database error' });
        if (results.length > 0) return res.json({ success: false, message: 'Email already exists' });

        const hashedPassword = await bcrypt.hash(password, 10);
        const sql = 'INSERT INTO users (full_name, email, phone_number, course, password, status, fee_status) VALUES (?, ?, ?, ?, ?, "Pending", "Unpaid")';
        
        db.query(sql, [fullName, email, phone, course, hashedPassword], (err) => {
            if (err) return res.status(500).json({ success: false, message: 'Error saving user' });
            res.json({ success: true, message: 'Registration successful' });
        });
    });
});

// --- LOGIN ROUTE ---
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;

    // 1. HARDCODED ADMIN CHECK (PRIORITY)
    // This stops the code before it ever looks in the database
    if (email === 'admin@gmail.com' && password === 'admin123') {
        return res.json({ 
            success: true, 
            user: { id: 0, name: 'Admin', role: 'admin', email: 'admin@gmail.com' } 
        });
    }

    // 2. STUDENT CHECK (In Database)
    db.query('SELECT * FROM users WHERE email = ?', [email], async (err, results) => {
        if (err) return res.status(500).json({ success: false, message: 'Database error' });
        
        if (results.length > 0) {
            const user = results[0];
            // Compare entered password with hashed password in DB
            const isMatch = await bcrypt.compare(password, user.password);
            
            if (isMatch) {
                res.json({ 
                    success: true, 
                    user: { 
                        id: user.id, 
                        name: user.full_name, 
                        status: user.status, 
                        course: user.course, 
                        role: 'student',
                        fee_status: user.fee_status
                    }
                });
            } else {
                res.json({ success: false, message: 'Incorrect password' });
            }
        } else {
            res.json({ success: false, message: 'User not found' });
        }
    });
});

// ==========================
//      ADMIN DASHBOARD ROUTES
// ==========================

// Get all students for Admin Table
app.get('/api/users', (req, res) => {
    db.query('SELECT id, full_name, email, course, status, fee_status FROM users', (err, results) => {
        if (err) return res.status(500).send(err);
        res.json(results.map(u => ({ 
            id: u.id, 
            fullName: u.full_name, 
            email: u.email, 
            course: u.course, 
            status: u.status, 
            fee_status: u.fee_status 
        })));
    });
});

// Accept a student
app.put('/api/users/:id/accept', (req, res) => {
    db.query('UPDATE users SET status = "Accepted" WHERE id = ?', [req.params.id], (err) => {
        if (err) return res.status(500).send(err);
        res.json({ success: true });
    });
});

// Delete a student
app.delete('/api/users/:id', (req, res) => {
    db.query('DELETE FROM users WHERE id = ?', [req.params.id], (err) => {
        if (err) return res.status(500).send(err);
        res.json({ success: true });
    });
});

// ==========================
//   CURRICULUM & EXAM ROUTES
// ==========================

app.get('/api/curriculum/:course', (req, res) => {
    const course = req.params.course;
    db.query('SELECT * FROM subjects WHERE course_name = ?', [course], (err, subjects) => {
        if (err) return res.status(500).send(err);
        db.query('SELECT * FROM timetables WHERE course_name = ? ORDER BY exam_date ASC', [course], (err, exams) => {
            if (err) return res.status(500).send(err);
            res.json({ 
                subjects: subjects.map(s => ({ id: s.id, name: s.subject_name, prof: s.professor, code: s.subject_code })),
                exams: exams.map(e => ({ id: e.id, date: e.exam_date, time: e.exam_time, subject: e.subject_name }))
            });
        });
    });
});

app.listen(port, () => {
    console.log(`🚀 Server running at http://localhost:${port}`);
});