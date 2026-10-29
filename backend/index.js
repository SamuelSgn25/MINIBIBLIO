import express from "express";
import cors from "cors";
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');
import dotenv from "dotenv";
import pool from "./config/db.js";
port = process.env.PORT || 3000;

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

// Routes will be added here
const db = pool;

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});