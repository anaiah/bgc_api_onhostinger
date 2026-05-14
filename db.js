const mysql = require('mysql2'); //use promise based mysql2
const {Client} = require('pg');

let client


// Option A: optional .env (only if present) 
try { require('dotenv').config(); 
} catch (e) {

} 
const config = { 
    host: process.env.DB_HOST || 'srv2102.hstgr.io', 
    user: process.env.DB_USER || 'u462718148_ccfbgc', 
    password: process.env.DB_PASSWORD || '6@32OEdQc', 
    database: process.env.DB_NAME || 'u462718148_ccfbgc', 
    port: Number(process.env.DB_PORT || 3306), 
    waitForConnections: true, 
    connectionLimit: 35, 
    queueLimit: 0, 
    multipleStatements: true, 
    connectTimeout: 10000, 
    enableKeepAlive: true, 
    charset: 'utf8mb4', 
    decimalNumbers: true

}; 

const pool = mysql.createPool(config).promise(); 

module.exports = {
     configMysql: config, 
     query: (sql, params) => pool.query(sql, params), 
     getConnection: () => pool.getConnection() 
};
