require('dotenv').config();
const express = require('express');
const session = require('express-session');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const mysql = require('mysql2/promise'); // Use MySQL2 for MariaDB

const app = express();
const PORT = process.env.PORT || 3000;
const AGENT_ID = process.env.AGENT_ID || 'DEFAULT';

// MariaDB Connection Pool
const db = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'mobile_reg'
});

// Middleware
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
    secret: 'secureSecret',
    resave: false,
    saveUninitialized: false
}));

// Multer for file uploads
const storage = multer.diskStorage({
    destination: './uploads/',
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage });

// Views Setup
app.set('view engine', 'ejs');

// Function to check if a roll number already exists in the database
const rollNumberExists = async (rollNumber) => {
    const [rows] = await db.execute('SELECT roll_number FROM registrations WHERE roll_number = ?', [rollNumber]);
    return rows.length > 0;
};

// Function to generate a unique Roll Number
const generateUniqueRollNumber = async () => {
    const date = new Date();
    const dateString = date.toISOString().split('T')[0].replace(/-/g, '');

    let rollNumber;
    do {
        const sequenceNumber = Math.floor(1000 + Math.random() * 9000);
        rollNumber = `${dateString}${AGENT_ID}${sequenceNumber}`;
    } while (await rollNumberExists(rollNumber));

    return rollNumber;
};

// Middleware to check session
const requireSession = (req, res, next) => {
    if (!req.session.user) {
        return res.redirect('/');
    }
    next();
};

// Routes
app.get('/', (req, res) => {
    res.render('welcome');
});

app.post('/start', async (req, res) => {
    req.session.user = { started: true };
    req.session.rollNumber = await generateUniqueRollNumber();
    res.redirect('/register');
});

app.get('/register', requireSession, (req, res) => {
    res.render('form', { rollNumber: req.session.rollNumber, agentId: AGENT_ID });
});

app.post('/preview', requireSession, upload.fields([{ name: 'selfie' }, { name: 'id_front' }, { name: 'id_back' }]), (req, res) => {
    req.session.formData = { 
        ...req.body, 
        files: req.files, roll_number: req.session.rollNumber };
        res.render('preview', { formData: req.session.formData, path });
});

app.post('/submit', requireSession, async (req, res) => {
    if (!req.session.formData) return res.redirect('/register');

    const { formData } = req.session;

    try {
        await db.execute(
            `INSERT INTO registrations (
                roll_number, membership_type, family_name, first_name, middle_name, gender, 
                mobile_phone, email_address, birthday, address, municipality, baranggay, 
                province, zip, id_type, selfie, id_front, id_back, agree_to_terms
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                formData.roll_number, formData.membership_type, formData.family_name, formData.first_name,
                formData.middle_name || null, formData.gender, formData.mobile_phone, formData.email_address,
                formData.birthday, formData.address, formData.municipality, formData.baranggay || null,
                formData.province, formData.zip || null, formData.id_type,
                formData.files.selfie ? formData.files.selfie[0].filename : null,
                formData.files.id_front ? formData.files.id_front[0].filename : null,
                formData.files.id_back ? formData.files.id_back[0].filename : null,
                formData.agree_to_terms
            ]
        );

        req.session.destroy();
        res.render('success', { title: "Registration Successful" });
    } catch (error) {
        console.error("Database Error:", error);
        res.status(500).send("Internal Server Error");
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
});
