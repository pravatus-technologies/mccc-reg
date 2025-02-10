require('dotenv').config();
const express = require('express');
const session = require('express-session');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const csv = require('csv-parser'); // Added for reading CSV

const app = express();
const PORT = process.env.PORT || 3000;
const AGENT_ID = process.env.AGENT_ID || 'DEFAULT';

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

// Function to read existing roll numbers from CSV
const getExistingRollNumbers = (csvFilePath) => {
    return new Promise((resolve, reject) => {
        let rollNumbers = new Set();
        if (!fs.existsSync(csvFilePath)) {
            return resolve(rollNumbers); // Return empty set if no file exists
        }

        fs.createReadStream(csvFilePath)
            .pipe(csv())
            .on('data', (row) => {
                if (row["Roll Number"]) {
                    rollNumbers.add(row["Roll Number"]);
                }
            })
            .on('end', () => resolve(rollNumbers))
            .on('error', (error) => reject(error));
    });
};

// Function to generate a unique Roll Number
const generateUniqueRollNumber = async () => {
    const date = new Date();
    const dateString = date.toISOString().split('T')[0].replace(/-/g, '');
    const csvFilePath = `./${dateString}${AGENT_ID}.csv`;
    let existingRollNumbers = await getExistingRollNumbers(csvFilePath);

    let rollNumber;
    do {
        const sequenceNumber = Math.floor(1000 + Math.random() * 9000);
        rollNumber = `${dateString}${AGENT_ID}${sequenceNumber}`;
    } while (existingRollNumbers.has(rollNumber)); // Ensure uniqueness

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
    req.session.rollNumber = await generateUniqueRollNumber(); // Generate and store roll number
    res.redirect('/register');
});

app.get('/register', requireSession, (req, res) => {
    res.render('form', { rollNumber: req.session.rollNumber, agentId: AGENT_ID });
});

app.post('/preview', requireSession, upload.fields([{ name: 'selfie' }, { name: 'id_front' }, { name: 'id_back' }]), (req, res) => {
    if (!req.files || !req.body.family_name || !req.body.first_name) {
        return res.redirect('/register');
    }

    const lastName = req.body.family_name.replace(/\s+/g, '_');
    const firstName = req.body.first_name.replace(/\s+/g, '_');

    const renameFile = (file, suffix) => {
        if (file) {
            const newFilename = `${lastName}_${firstName}_${suffix}.png`;
            const newPath = `uploads/${newFilename}`;
            fs.renameSync(file.path, newPath);
            return newPath;
        }
        return null;
    };

    const selfiePath = renameFile(req.files.selfie ? req.files.selfie[0] : null, "Selfie");
    const idFrontPath = renameFile(req.files.id_front ? req.files.id_front[0] : null, "IDFront");
    const idBackPath = renameFile(req.files.id_back ? req.files.id_back[0] : null, "IDBack");

    req.session.formData = { 
        ...req.body, 
        files: req.files, roll_number: req.session.rollNumber 
    };
    res.render('preview', { formData: req.session.formData });
});

app.post('/submit', requireSession, (req, res) => {
    if (!req.session.formData) return res.redirect('/register');

    const { formData } = req.session;
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const filePath = `./${today}${AGENT_ID}.csv`;

    const headers = "Roll Number,Membership Type,Family Name,First Name,Middle Name,Gender,Mobile Phone,Email Address,Birthday,Address,Municipality,Baranggay,Province,Zip,ID Type,Selfie,ID Front,ID Back,Agree to Terms\n";
    const row = [
        formData.roll_number, formData.membership_type, formData.family_name, formData.first_name,
        formData.middle_name || '', formData.gender, formData.mobile_phone, formData.email_address,
        formData.birthday, formData.address, formData.municipality, formData.baranggay || '',
        formData.province, formData.zip || '', formData.id_type,
        formData.files.selfie ? formData.files.selfie[0].path : '',
        formData.files.id_front ? formData.files.id_front[0].path : '',
        formData.files.id_back ? formData.files.id_back[0].path : '',
        formData.agree_to_terms
    ].join(',');

    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, headers);
    }

    fs.appendFileSync(filePath, row + '\n');

    req.session.destroy();
    res.render('success', { title: "Registration Successful" });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
});
