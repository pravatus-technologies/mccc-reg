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

app.post('/preview', requireSession, upload.fields([
    { name: 'selfie' },
    { name: 'id_front' },
    { name: 'id_back' }
]), async (req, res) => {
    if (!req.files || !req.session.rollNumber) {
        return res.redirect('/register');
    }

    const rollNumber = req.session.rollNumber;

    // Function to rename files safely
    const renameFile = (file, suffix) => {
        if (file) {
            const newFilename = `${rollNumber}_${suffix}.png`;
            const newPath = path.join('uploads', newFilename);
            fs.renameSync(file.path, newPath);
            return newPath;
        }
        return null;
    };

    // Rename and store paths
    const selfiePath = renameFile(req.files.selfie ? req.files.selfie[0] : null, "SELFIE");
    const idFrontPath = renameFile(req.files.id_front ? req.files.id_front[0] : null, "IDFRONT");
    const idBackPath = renameFile(req.files.id_back ? req.files.id_back[0] : null, "IDBACK");

    req.session.formData = {
        ...req.body,
        roll_number: rollNumber,
        files: {
            selfie: selfiePath || '',
            id_front: idFrontPath || '',
            id_back: idBackPath || ''
        }
    };

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
                province, zip, id_type, selfie, id_front, id_back, agree_to_terms, prs_date, civil_status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                formData.roll_number || null,
                formData.membership_type || null,
                formData.family_name || null,
                formData.first_name || null,
                formData.middle_name || null,
                formData.gender || null,
                formData.mobile_phone || null,
                formData.email_address || null,
                formData.birthday || null,
                formData.address || null,
                formData.municipality || null,
                formData.baranggay || null,
                formData.province || null,
                formData.zip || null,
                formData.id_type || null,
                formData.files.selfie ? path.basename(formData.files.selfie) : null,
                formData.files.id_front ? path.basename(formData.files.id_front) : null,
                formData.files.id_back ? path.basename(formData.files.id_back) : null,
                formData.agree_to_terms || null,
                formData.prs_date || null,
                formData.civil_status || null
            ]
        );

        req.session.destroy();
        res.redirect(`/success?rollNumber=${encodeURIComponent(formData.roll_number)}&firstName=${encodeURIComponent(formData.first_name)}`);
    } catch (error) {
        console.error("Database Error:", error);
        res.status(500).send("Internal Server Error");
    }
});

app.get('/success', (req, res) => {

    if (!req.session.rollNumber || !req.session.firstName) {
        return res.redirect('/register');
    }
    
    const rollNumber = req.query.rollNumber || "N/A";  // Default to "N/A" if missing
    const firstName = req.query.firstName || "Applicant"; 

    res.render('success', { rollNumber, firstName });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
});
