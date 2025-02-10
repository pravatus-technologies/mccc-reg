CREATE DATABASE mobile_reg;

CREATE TABLE registrations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    roll_number VARCHAR(50) UNIQUE NOT NULL,
    membership_type VARCHAR(50) NOT NULL,
    family_name VARCHAR(100) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100),
    gender VARCHAR(10) NOT NULL,
    mobile_phone VARCHAR(20) NOT NULL,
    email_address VARCHAR(100) NOT NULL,
    birthday DATE NOT NULL,
    address TEXT NOT NULL,
    municipality VARCHAR(100) NOT NULL,
    baranggay VARCHAR(100),
    province VARCHAR(100) NOT NULL,
    zip VARCHAR(10),
    id_type VARCHAR(50) NOT NULL,
    selfie VARCHAR(255),
    id_front VARCHAR(255),
    id_back VARCHAR(255),
    agree_to_terms ENUM('Yes', 'No') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP  -- Stores record creation time in UTC
);
