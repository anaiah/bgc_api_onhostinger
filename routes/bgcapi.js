/*

AUTHOR : CARLO DOMINGUEZ

multiple comment //// => IMPORTANT
*/
const express = require('express')
const router = express.Router()

const app = express()

//const Utils = require('./util')//== my func

//const QRPDF = require('./qrpdf')
//const asnpdf = require('./asnpdf')//=== my own module

const cookieParser = require('cookie-parser')

//===== for pdf
//const pdf = require('html-pdf')
const path = require('path')
const fs = require('fs');

const jwt = require('jsonwebtoken');

const axios = require('axios')

const formdata = require('form-data')

// const jsftp = require("jsftp");

const fetcher = require('node-fetch')

const IP = require('ip')

const iprequest = require('request-ip')

const querystring = require("querystring")

const nodemailer = require("nodemailer")

const { Readable } = require('stream') // need for uploading images

const hbar = require('handlebars'); //html template
const QRCode = require('qrcode')  // qrcode maker
const multer = require('multer') // for file manipulate
const sharp = require('sharp')   // for image manipulate

const ftpclient = require('scp2')

app.use( cookieParser() )


const db  = require('../db')// your pool module


const ExcelJS = require('exceljs');

const mysqls = require('mysql2/promise')

//=====CLAIMS UPLOAD
// Set up multer for file uploads

//const upload = multer({ storage: multer.memoryStorage() });

const xlsx = require('xlsx');

const Pusher = require("pusher");

const pusher = new Pusher({
  appId: "2136889",
  key: "e7e1396c6d903263f9a9",
  secret: "f74c1d97d6c62536d941",
  cluster: "ap1",
  useTLS: true
});


//========login post
router.get('/loginpost/:uid/:pwd', async (req, res) => {
  const { uid, pwd } = req.params;
  
  console.log('firing login with Authenticate====== ', uid, pwd, ' ========');

  try {
  
    const sql = `
      SELECT a.*, b.grp_description, c.id AS ministry_id,
             c.ministry_description, c.segment
      FROM bgc_users a 
      LEFT JOIN bgc_group b ON a.grp_id = b.grp_id
      LEFT JOIN bgc_ministry c ON a.ministry_id = c.id
      WHERE a.email = ?
    `;

    const [rows] = await db.query(sql, [uid]);

    console.log('logindata', rows);

    if (!rows.length > 0) return res.json({ found: false, data: [] });
    
    //token
    const token = jwt.sign(
    {   
        userId: rows[0].id, 
        email: rows[0].email, 
        fullName: rows[0].full_name
    },
        'bgcsecretkey', 
    {   
        expiresIn: '7d' 
    });
    
    //return success!
    return res.json({
        found: true,
        data: rows,
        token
    });

  } catch (err) {
    console.log('Error in Login:', err);

    const xdata = [{
      message: "No Matching Record!",
      voice: "No Matching Record!",
      found: false
    }];

    console.error('Error:', err);
    return res.status(500).json(xdata);

  }
});

//================THIS IS FOR "PUSHER" REALTIME NOTIFICATIONS
let loggedClients = [];

// YOUR UPDATE ROUTE after login
router.post('/update-entry', (req, res) => {
    const { id, user, ministry } = req.body;

    // 1. Add user to the array (only if they aren't already there)
    const exists = loggedClients.find(c => c.id === id);
    if (!exists) {
        loggedClients.push({ id, user, ministry, loginTime: new Date() });
    }

    // 2. Console log your "Who is online" list
    console.log("--- Active Users ---");
    console.table(loggedClients); // console.table looks beautiful in Node logs!
    console.log(`Total Logged In: ${loggedClients.length}`);

    // 3. Trigger Pusher so EVERYONE sees the new person
    pusher.trigger("bgc-channel", "entry-updated", {
        message: `${user} from ${ministry} just joined!`,
        activeCount: loggedClients.length
    });

    res.json({ success: true, count: loggedClients.length });

});

//route to give update to bossings
router.post('/send-update', (req, res) => {
   const { id, user, ministry } = req.body;

    // Trigger ONLY to that user's specific channel
    pusher.trigger(`users-owners`, "personal-alert", {
        message: `Hello! ${user} has update just for you from the BGC system!`,
        sender: "System"
    });

    res.json({ success: true });
});

//========PUSHER LOGOUT
router.post('/logout', (req, res) => {
    const { id } = req.body;
    loggedClients = loggedClients.filter(c => c.id !== id);
    console.log(`User ${id} logged out. Total: ${loggedClients.length}`);
    res.json({ success: true });
});

//========GRID.JS =================//
router.get('/get-target-grid/:segment', async (req, res) => {

    console.log('**** FIRED GET-TARGET-GRID() ', req.params.segment)

    let xsegment

    try {

        //the field is important in order, coz this is the order of columns in the grid.js, so if you change the order here, change it also in the grid.js column definition
        
        //orig -->  t.ministry_segment AS 'Ministry',    
        switch ( req.params.segment ){
            case 'kpi':
                xsegment = 'KPIs'
                break;
            case 'ministry':
                xsegment = 'MINISTRY EVENTS'
                break;
            case 'mission':
                xsegment = 'MISSIONAL'
                break;

        }


        const sql = `
            SELECT 
                r.rpt_grp,
                r.rpt_description AS 'Ministry',    
                COALESCE(t.target_value, 0) AS 'FY Target',
                COALESCE(SUM(CASE WHEN MONTH(h.date_added) = 1 THEN h.headcount ELSE 0 END), 0) AS 'Jan',
                COALESCE(SUM(CASE WHEN MONTH(h.date_added) = 2 THEN h.headcount ELSE 0 END), 0) AS 'Feb',
                COALESCE(SUM(CASE WHEN MONTH(h.date_added) = 3 THEN h.headcount ELSE 0 END), 0) AS 'Mar',
                COALESCE(SUM(CASE WHEN MONTH(h.date_added) = 4 THEN h.headcount ELSE 0 END), 0) AS 'Apr',
                COALESCE(SUM(CASE WHEN MONTH(h.date_added) = 5 THEN h.headcount ELSE 0 END), 0) AS 'May',
                COALESCE(SUM(CASE WHEN MONTH(h.date_added) = 6 THEN h.headcount ELSE 0 END), 0) AS 'Jun',
                COALESCE(SUM(CASE WHEN MONTH(h.date_added) = 7 THEN h.headcount ELSE 0 END), 0) AS 'Jul',
                COALESCE(SUM(CASE WHEN MONTH(h.date_added) = 8 THEN h.headcount ELSE 0 END), 0) AS 'Aug',
                COALESCE(SUM(CASE WHEN MONTH(h.date_added) = 9 THEN h.headcount ELSE 0 END), 0) AS 'Sep',
                COALESCE(SUM(CASE WHEN MONTH(h.date_added) = 10 THEN h.headcount ELSE 0 END), 0) AS 'Oct',
                COALESCE(SUM(CASE WHEN MONTH(h.date_added) = 11 THEN h.headcount ELSE 0 END), 0) AS 'Nov',
                COALESCE(SUM(CASE WHEN MONTH(h.date_added) = 12 THEN h.headcount ELSE 0 END), 0) AS 'Dec'
            FROM bgc_report r
            LEFT JOIN bgc_targets t 
                ON r.rpt_description COLLATE utf8mb4_unicode_ci = t.ministry_segment COLLATE utf8mb4_unicode_ci
                AND t.fiscal_year = YEAR(CURDATE())
            LEFT JOIN bgc_headcount h 
                ON r.rpt_description COLLATE utf8mb4_unicode_ci = h.ministry_segment COLLATE utf8mb4_unicode_ci
                AND YEAR(h.date_added) = YEAR(CURDATE())
            WHERE r.rpt_grp = ?
            GROUP BY 
                r.rpt_grp, 
                r.rpt_description, 
                t.target_value, 
                r.rpt_sequence
            ORDER BY r.rpt_sequence; `;
        const [rows] = await db.query(sql,[xsegment]);
        
        const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
        const data = rows.map(row => Object.values(row));
        
        res.json({ ok: true, columns, data });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

//===============SAVE FISCAL YEAR TARGET==============//
router.post('/save-target', async (req, res) => {
    const {  ministry_segment, target_value } = req.body;
    const fiscalYear = new Date().getFullYear(); 

    try {
        const sql = `
            INSERT INTO bgc_targets (fiscal_year, ministry_segment, target_value)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE target_value = VALUES(target_value)
        `;
        await db.query(sql, [fiscalYear, ministry_segment, target_value]);

        console.log(`Target saved for ${ministry_segment} (${fiscalYear}): ${target_value}`);

        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

//==============official download excel route with conditional formatting and all that good stuff, this is the one being called in the frontend when user clicks download excel button, the above one is just a sample for testing=================//
// =========================================================================
// PART 1: EXPRESS ROUTE HANDLER & DATA QUERIES
// =========================================================================

router.get('/downloadExcel', async (req, res) => {
    console.log('*** FIRING DOWNLOAD EXCEL (REFACTORED) ***')
    try {
        // --- QUERY 1: ORIGINAL SUMMARY DATA ---
        const summarySql = `
            SELECT 
                r.rpt_grp, r.rpt_description AS 'Ministry', COALESCE(t.target_value, 0) AS 'FY Target',
                COALESCE(SUM(CASE WHEN MONTH(h.date_added) = 1 THEN h.headcount ELSE 0 END), 0) AS 'Jan',
                COALESCE(SUM(CASE WHEN MONTH(h.date_added) = 2 THEN h.headcount ELSE 0 END), 0) AS 'Feb',
                COALESCE(SUM(CASE WHEN MONTH(h.date_added) = 3 THEN h.headcount ELSE 0 END), 0) AS 'Mar',
                COALESCE(SUM(CASE WHEN MONTH(h.date_added) = 4 THEN h.headcount ELSE 0 END), 0) AS 'Apr',
                COALESCE(SUM(CASE WHEN MONTH(h.date_added) = 5 THEN h.headcount ELSE 0 END), 0) AS 'May',
                COALESCE(SUM(CASE WHEN MONTH(h.date_added) = 6 THEN h.headcount ELSE 0 END), 0) AS 'Jun',
                COALESCE(SUM(CASE WHEN MONTH(h.date_added) = 7 THEN h.headcount ELSE 0 END), 0) AS 'Jul',
                COALESCE(SUM(CASE WHEN MONTH(h.date_added) = 8 THEN h.headcount ELSE 0 END), 0) AS 'Aug',
                COALESCE(SUM(CASE WHEN MONTH(h.date_added) = 9 THEN h.headcount ELSE 0 END), 0) AS 'Sep',
                COALESCE(SUM(CASE WHEN MONTH(h.date_added) = 10 THEN h.headcount ELSE 0 END), 0) AS 'Oct',
                COALESCE(SUM(CASE WHEN MONTH(h.date_added) = 11 THEN h.headcount ELSE 0 END), 0) AS 'Nov',
                COALESCE(SUM(CASE WHEN MONTH(h.date_added) = 12 THEN h.headcount ELSE 0 END), 0) AS 'Dec'
            FROM bgc_report r
            LEFT JOIN bgc_targets t ON r.rpt_description COLLATE utf8mb4_unicode_ci = t.ministry_segment COLLATE utf8mb4_unicode_ci AND t.fiscal_year = YEAR(CURDATE())
            LEFT JOIN bgc_headcount h ON r.rpt_description COLLATE utf8mb4_unicode_ci = h.ministry_segment COLLATE utf8mb4_unicode_ci AND YEAR(h.date_added) = YEAR(CURDATE())
            GROUP BY r.rpt_grp, r.rpt_description, t.target_value, r.rpt_sequence
            ORDER BY r.rpt_grp, r.rpt_sequence;`;

        // --- QUERY 2: REFACTORED DETAILED DATA (JAN-DEC SPLIT BY AM/PM) ---
        const detailedSql = `
            SELECT 
                r.rpt_grp,
                r.rpt_description AS 'Ministry',
                ${[...Array(12).keys()].map(i => {
                    const m = i + 1;
                    return `
                    COALESCE(SUM(CASE WHEN MONTH(h.date_added) = ${m} AND UPPER(h.service) = 'AM' THEN h.headcount ELSE 0 END), 0) AS 'Jan_AM_${m}',
                    COALESCE(SUM(CASE WHEN MONTH(h.date_added) = ${m} AND UPPER(h.service) = 'PM' THEN h.headcount ELSE 0 END), 0) AS 'Jan_PM_${m}'`;
                }).join(',')}
            FROM bgc_report r
            LEFT JOIN bgc_headcount h 
                ON r.rpt_description COLLATE utf8mb4_unicode_ci = h.ministry_segment COLLATE utf8mb4_unicode_ci
                AND YEAR(h.date_added) = YEAR(CURDATE())
            GROUP BY r.rpt_grp, r.rpt_description, r.rpt_sequence
            ORDER BY r.rpt_grp, r.rpt_sequence;`;

        // --- QUERY 3: PORTION FOR ADDING SHEET 3 YTD DATA ---
        // Pulls records sequentially filtered by the current calendar year
        const ytdDetailSql = `
            SELECT 
                DATE_FORMAT(date_added, '%Y-%m-%d') AS 'Date',
                ministry_segment AS 'Ministry',
                headcount AS 'Count',
                service AS 'Service'
            FROM bgc_headcount
            WHERE YEAR(date_added) = YEAR(CURDATE())
            ORDER BY date_added DESC, ministry_segment ASC;`;

        // Execute all three database threads in parallel 
        const [[summaryRows], [detailedRows], [ytdRows]] = await Promise.all([
            db.query(summarySql),
            db.query(detailedSql),
            db.query(ytdDetailSql)
        ]);

        const workbook = new ExcelJS.Workbook();
        const today = new Date();
        const formattedDate = today.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
// =========================================================================
// PART 2: EXCELJS WORKBOOK CONSTRUCTION LOOP & RESPONSES
// =========================================================================

        // ==========================================
        // SHEET 1: MINISTRY REPORT (Original Summary)
        // ==========================================
        const worksheet = workbook.addWorksheet('Ministry Report');
        // ... (Your Sheet 1 code remains exactly the same as before)
        worksheet.mergeCells('A1:O1'); worksheet.getCell('A1').value = 'CCF BGC'; worksheet.getCell('A1').font = { bold: true, size: 12 };
        worksheet.mergeCells('A2:O2'); worksheet.getCell('A2').value = '4th Flr, One Bonifactio High Street Mall'; worksheet.getCell('A2').font = { bold: true, size: 12 };
        worksheet.mergeCells('A3:O3'); worksheet.getCell('A3').value = '5th Ave, BGC, Taguig, Metro Manila'; worksheet.getCell('A3').font = { bold: true, size: 12 };
        worksheet.mergeCells('A4:O4'); worksheet.getCell('A4').value = 'Ministry Performance vs. FY Target'; worksheet.getCell('A4').font = { bold: true, size: 12 };
        worksheet.mergeCells('A5:O5'); worksheet.getCell('A5').value = `As of ${formattedDate}`;

        const headers = ["Ministry", "FY Target", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "AVG"];
        const headerRow = worksheet.getRow(7); headerRow.values = headers;
        headerRow.eachCell((cell, colNumber) => {
            cell.font = { bold: true }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } }; cell.border = { bottom: { style: 'thin' } };
            if (colNumber >= 2) cell.alignment = { horizontal: 'center' };
        });

        let currentRow = 8; let lastGrp = "";
        summaryRows.forEach((row) => {
            if (row.rpt_grp !== lastGrp) {
                worksheet.mergeCells(`A${currentRow}:O${currentRow}`);
                const groupCell = worksheet.getCell(`A${currentRow}`);
                groupCell.value = row.rpt_grp.toUpperCase();
                groupCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF333333' } };
                groupCell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                lastGrp = row.rpt_grp; currentRow++;
            }
            const months = [Number(row.Jan), Number(row.Feb), Number(row.Mar), Number(row.Apr), Number(row.May), Number(row.Jun), Number(row.Jul), Number(row.Aug), Number(row.Sep), Number(row.Oct), Number(row.Nov), Number(row.Dec)];
            const activeMonths = months.filter(val => val > 0);
            const avgValue = Math.round(activeMonths.length > 0 ? (activeMonths.reduce((a, b) => a + b, 0) / activeMonths.length) : 0);
            const target = Number(row['FY Target']) || 0;

            const dataRow = worksheet.getRow(currentRow);
            dataRow.values = [row.Ministry, target, ...months, parseFloat(avgValue.toFixed(2))];
            for (let i = 2; i <= 15; i++) dataRow.getCell(i).alignment = { horizontal: 'center' };
            dataRow.getCell(2).font = { color: { argb: 'ff180b78'}, bold : true };
            const avgCell = dataRow.getCell(15);
            if (target > 0) {
                if (avgValue >= target) avgCell.font = { color: { argb: 'FF008000' }, bold: true };
                else avgCell.font = { color: { argb: 'FFFF0000' }, bold: true };
            }
            currentRow++;
        });
        worksheet.getColumn(1).width = 35; worksheet.getColumn(2).width = 12;
        for (let i = 3; i <= 14; i++) { worksheet.getColumn(i).width = 8; } worksheet.getColumn(15).width = 12;

        // ==========================================
        // SHEET 2: REFACTORED DETAILED (JAN - DEC)
        // ==========================================
        const detailedSheet = workbook.addWorksheet('Detailed');

        detailedSheet.mergeCells('A1:Z1'); detailedSheet.getCell('A1').value = 'CCF BGC'; detailedSheet.getCell('A1').font = { bold: true, size: 12 };
        detailedSheet.mergeCells('A2:Z2'); detailedSheet.getCell('A2').value = '4th Flr, One Bonifactio High Street Mall'; detailedSheet.getCell('A2').font = { bold: true, size: 12 };
        detailedSheet.mergeCells('A3:Z3'); detailedSheet.getCell('A3').value = '5th Ave, BGC, Taguig, Metro Manila'; detailedSheet.getCell('A3').font = { bold: true, size: 12 };
        detailedSheet.mergeCells('A4:Z4'); detailedSheet.getCell('A4').value = 'Detailed Attendance Breakdown (Jan - Dec)'; detailedSheet.getCell('A4').font = { bold: true, size: 12 };
        detailedSheet.mergeCells('A5:Z5'); detailedSheet.getCell('A5').value = `As of ${formattedDate}`;

        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        
        monthNames.forEach((month, index) => {
            const startColIdx = 2 + (index * 2);
            detailedSheet.mergeCells(7, startColIdx, 7, startColIdx + 1);
            const cell = detailedSheet.getCell(7, startColIdx);
            cell.value = month;
            cell.font = { bold: true };
            cell.alignment = { horizontal: 'center' };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };
        });
        detailedSheet.getCell('Z7').value = "YTD Total";
        detailedSheet.getCell('Z7').font = { bold: true };
        detailedSheet.getCell('Z7').alignment = { horizontal: 'center' };

        const subHeaders = [""];
        for(let i=0; i<12; i++) { subHeaders.push("AM", "PM"); }
        subHeaders.push("Total");
        
        const row8 = detailedSheet.getRow(8);
        row8.values = subHeaders;
        row8.eachCell((cell, colNumber) => {
            cell.font = { bold: true, size: 10 };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
            cell.border = { bottom: { style: 'thin' } };
            if (colNumber >= 2) cell.alignment = { horizontal: 'center' };
        });

        let detailedCurrentRow = 9;
        let detailedLastGrp = "";

        detailedRows.forEach((row) => {
            if (row.rpt_grp !== detailedLastGrp) {
                detailedSheet.mergeCells(`A${detailedCurrentRow}:Z${detailedCurrentRow}`);
                const groupCell = detailedSheet.getCell(`A${detailedCurrentRow}`);
                groupCell.value = row.rpt_grp.toUpperCase();
                groupCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF333333' } };
                groupCell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                detailedLastGrp = row.rpt_grp;
                detailedCurrentRow++;
            }

            const rowValues = [row.Ministry];
            let rowYtdTotal = 0;

            for (let m = 1; m <= 12; m++) {
                const amVal = Number(row[`Jan_AM_${m}`]) || 0;
                const pmVal = Number(row[`Jan_PM_${m}`]) || 0;
                rowValues.push(amVal, pmVal);
                rowYtdTotal += (amVal + pmVal);
            }
            rowValues.push(rowYtdTotal);

            const dataRow = detailedSheet.getRow(detailedCurrentRow);
            dataRow.values = rowValues;

            for (let i = 2; i <= 26; i++) {
                dataRow.getCell(i).alignment = { horizontal: 'center' };
            }
            dataRow.getCell(26).font = { bold: true, color: { argb: 'FF180B78' } };
            detailedCurrentRow++;
        });

        detailedSheet.getColumn(1).width = 35;
        for (let i = 2; i <= 25; i++) { detailedSheet.getColumn(i).width = 6; }
        detailedSheet.getColumn(26).width = 14;

        // ==========================================================
        // PORTION FOR ADDING ANOTHER SHEET: YTD Detail (SHEET 3)
        // ==========================================================
        const ytdSheet = workbook.addWorksheet('YTD Detail');

        // Corporate Brand Identity headers matching previous sheets
        ytdSheet.mergeCells('A1:D1'); ytdSheet.getCell('A1').value = 'CCF BGC'; ytdSheet.getCell('A1').font = { bold: true, size: 12 };
        ytdSheet.mergeCells('A2:D2'); ytdSheet.getCell('A2').value = '4th Flr, One Bonifactio High Street Mall'; ytdSheet.getCell('A2').font = { bold: true, size: 12 };
        ytdSheet.mergeCells('A3:D3'); ytdSheet.getCell('A3').value = '5th Ave, BGC, Taguig, Metro Manila'; ytdSheet.getCell('A3').font = { bold: true, size: 12 };
        ytdSheet.mergeCells('A4:D4'); ytdSheet.getCell('A4').value = 'Granular YTD Headcount Transactions'; ytdSheet.getCell('A4').font = { bold: true, size: 12 };
        ytdSheet.mergeCells('A5:D5'); ytdSheet.getCell('A5').value = `As of ${formattedDate}`;

        // Definitive table column mappings
        ytdSheet.columns = [
            { header: 'Date', key: 'Date', width: 15 },
            { header: 'Ministry', key: 'Ministry', width: 35 },
            { header: 'Count', key: 'Count', width: 12 },
            { header: 'Service', key: 'Service', width: 15 }
        ];

        // Apply visual headers pattern design styling on row 7
        const ytdHeaderRow = ytdSheet.getRow(7);
        ytdHeaderRow.values = ['Date', 'Ministry', 'Count', 'Service'];
        ytdHeaderRow.eachCell((cell, colNumber) => {
            cell.font = { bold: true }; 
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } }; 
            cell.border = { bottom: { style: 'thin' } };
            if (colNumber !== 2) cell.alignment = { horizontal: 'center' };
        });

        // Populate database rows safely into sheet grid
        ytdRows.forEach((row) => {
            const addedRow = ytdSheet.addRow([row.Date, row.Ministry, Number(row.Count), row.Service]);
            addedRow.getCell(1).alignment = { horizontal: 'center' };
            addedRow.getCell(3).alignment = { horizontal: 'center' };
            addedRow.getCell(4).alignment = { horizontal: 'center' };
        });

    // ==========================================
    // STREAM DOWN FILE DOWNLOAD
    // ==========================================
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=MinistryReport.xlsx');

    const buffer = await workbook.xlsx.writeBuffer();
    res.send(buffer);

} catch (error) {
    console.error("Excel Export Error:", error);
    res.status(500).json({ error: "Failed to generate Excel file" });
}
});

//====HELPERS
function requireAuth(req, res, next) {
    const h = req.headers.authorization || '';
    const token = h.startsWith('Bearer ') ? h.slice(7) : null;
    if (!token) return res.status(401).json({ success: false });

    try { req.auth = jwt.verify(token, process.env.JWT_SECRET); next(); }
    catch { return res.status(401).json({ success: false }); }
}

//called from when user is logged in//
router.get('/events', requireAuth, async (req, res) => {
    const after = Number(req.query.after || 0);
    const { userId } = req.auth;

    const [rows] = await db.query(
    `SELECT id, type, payload, created_at
    FROM bgc_events
    WHERE id > ?
    AND (target_user_id = ? OR target_user_id IS NULL)
    ORDER BY id ASC
    LIMIT 100`,
    [after, userId]
    );

    res.json({ success: true, events: rows });
});

async function emitEvent({ target_user_id = null, type, payload = null }) {
    await db.query(
    `INSERT INTO bgc_events (target_user_id, type, payload) VALUES (?, ?, ?)`,
    [target_user_id, type, payload ? JSON.stringify(payload) : null]
    );
}

//==== SSE SERVER-SENT EVENTS

// // 1. Endpoint for clients to "subscribe" to notifications
// router.get('/notifications', (req, res) => {
//     // FORCE CORS headers specifically for this route
//     res.setHeader('Access-Control-Allow-Origin', 'https://ccfbgc.org');
//     res.setHeader('Access-Control-Allow-Credentials', 'false'); // Matches withCredentials: false

//     res.writeHead(200, {
//         'Content-Type': 'text/event-stream',
//         'Cache-Control': 'no-cache',
//         'Connection': 'keep-alive',
//         'X-Accel-Buffering': 'no' 
//     });

//     // Send initial padding/heartbeat
//     res.write(':\n\n'); 
//     const clientId = Date.now();
//     const newClient = { id: clientId, res };
//     clients.push(newClient);
//     console.log(`New client: ${clientId}. Total: ${clients.length}`);

//     req.on('close', () => {
//         clients = clients.filter(c => c.id !== clientId);
//         console.log(`Client ${clientId} left. Total: ${clients.length}`);
//     });
// });

// // 2. Logic to notify everyone when an entry is updated
// router.post('/update-entry', (req, res) => {
//     // ... your logic to update the database ...
    
//     const message = { type: 'UPDATE_DETECTED', data: req.body };
    
//     // Notify all connected clients
//     clients.forEach(client => 
//         client.res.write(`data: ${JSON.stringify(message)}\n\n`)
//     );
    
//     res.status(200).send("Updated and Notified!");
// });

//===============================================ENDING SSE's =========================
//=== SAVE PROJECT TO MAP pgsql DATABASE 
const upload = multer({ storage: multer.memoryStorage() }).any();
const os = require('os');

let tempFilePath = '';

//==== insert headcount in bgc =====//
router.post('/saveattendance/:id/:ministry/:ministryId', async (req, res) => {
    const { id, ministry, ministryId } = req.params;
    const { serviceSelect, segmentSelect, countInput } = req.body;

    if (!segmentSelect || !countInput) {
        return res.status(400).json({ ok: false, message: 'segmentSelect and countInput are required' });
    }

    try {
        // MySQL uses CURDATE() and ? for placeholders
        const checkSql = `
            SELECT id FROM bgc_headcount 
            WHERE ministry_segment = ? AND service = ? 
            AND DATE(date_added) = CURDATE()
            ORDER BY id DESC LIMIT 1
        `;
        const [checkResult] = await db.query(checkSql, [segmentSelect, serviceSelect]);
        

        console.log('Check Result:', checkResult);

        let finalId;
        let action;

        if (checkResult.length > 0) {
            finalId = checkResult[0].id;
            action = 'update';
            const updateSql = `
                UPDATE bgc_headcount SET 
                ministry_id = ?, headcount = ?, service = ?, 
                ministry_name = ?, added_by = ?, date_added = NOW()
                WHERE id = ?
            `;
            await db.query(updateSql, [
                parseInt(ministryId), parseInt(countInput), serviceSelect, ministry, parseInt(id), finalId
            ]);
        } else {
            action = 'record add';
            const insertSql = `
                INSERT INTO bgc_headcount 
                (ministry_id, headcount, service, ministry_segment, ministry_name, added_by, date_added)
                VALUES (?, ?, ?, ?, ?, ?, NOW())
            `;
            const [ins] = await db.query(insertSql, [
                parseInt(ministryId), parseInt(countInput), serviceSelect, segmentSelect, ministry, parseInt(id)
            ]);
            finalId = ins.insertId;
        }

        // Fetch the row to return it (since MySQL has no RETURNING clause)
        const [row] = await db.query("SELECT * FROM bgc_headcount WHERE id = ?", [finalId]);
        return res.json({ ok: true, action, row: row[0] });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ ok: false, error: err.message });
    }
});

//===========get chart attendance AM PM
// GET /chart/headcount-by-ministry
router.get('/headcount-by-ministry', async (req, res) => {
    try {
        const sql = `
            SELECT ministry_name, service, ministry_segment, SUM(headcount) as total
            FROM bgc_headcount
            WHERE DATE(date_added) = CURDATE()
            GROUP BY ministry_name, service, ministry_segment
            ORDER BY ministry_name, service;
        `;
        const [rows] = await db.query(sql);

        const categories = [...new Set(rows.map(r => r.ministry_name))];
        const norm = s => (s || '').toString().trim();
        const segments = [...new Set(rows.map(r => norm(r.ministry_segment)).filter(s => s))];

        const combos = [];
        segments.forEach(seg => {
            combos.push({ service: 'AM', segment: seg, name: `AM • ${seg}` });
            combos.push({ service: 'PM', segment: seg, name: `PM • ${seg}` });
        });

        const map = new Map();
        rows.forEach(r => {
            const key = `${r.ministry_name}||${norm(r.service)}||${norm(r.ministry_segment)}`;
            map.set(key, Number(r.total));
        });

        let series = combos.map(c => {
            const data = categories.map(cat => {
                const key = `${cat}||${c.service}||${c.segment}`;
                return map.has(key) ? map.get(key) : null;
            });
            return { name: c.name, data };
        });

        series = series.filter(s => s.data.some(v => v !== null));
        return res.json({ ok: true, categories, series });
    } catch (err) {
        return res.status(500).json({ ok: false, message: err.message });
    }
});


/**** ROOM RESERVATION, GET ROOMS AND SCHED */
router.get('/getrooms/:date', async (req, res) => {
    const { date } = req.params;
    try {
        const sql = `
            SELECT 
                r.id, 
                r.room_description,
                (
                    SELECT JSON_ARRAYAGG(
                        JSON_OBJECT(
                            'id', rr.id,
                            'date_from', rr.date_from,
                            'date_to', rr.date_to,
                            'added_by', rr.added_by,
                            'remarks', rr.remarks,
                            'added_by_name', u.full_name,
                            'ministry', m.ministry_description
                        )
                    )
                    FROM bgc_room_reserve rr
                    LEFT JOIN bgc_users u ON u.id = rr.added_by
                    LEFT JOIN bgc_ministry m ON m.id = u.ministry_id
                    WHERE rr.room_id = r.id AND DATE(rr.date_from) = ?
                ) AS reservations

            FROM bgc_rooms r
            ORDER BY r.room_description;
        `;
        const [rooms] = await db.query(sql, [date]);
        
        // MySQL returns the JSON as a string or object depending on your driver
        const formattedRooms = rooms.map(room => ({
            ...room,
            reservations: typeof room.reservations === 'string' ? JSON.parse(room.reservations) : (room.reservations || [])
        }));

        res.json({ success: true, date, rooms: formattedRooms });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});


//===========THE ACTUAL SAVE TO MYSQL RESERVATION PLUS GOOGLE OAUTH============//
const { google, dfareporting_v3_5 } = require('googleapis'); 
const oauth2Client = new google.auth.OAuth2( process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, process.env.GOOGLE_REDIRECT_URI ); 

// Step 1: admin clicks connect button 
router.get('/google/auth', (req, res) => { 
    const url = oauth2Client.generateAuthUrl({ 
        access_type: 'offline', 
        prompt: 'consent', 
        scope: ['https://www.googleapis.com/auth/calendar'] }); 
    res.redirect(url); 
}); 

// Step 2: Google sends code back here 
router.get('/google/callback', async (req, res) => { 
    try { 
        const { code } = req.query; 
        const { tokens } = await oauth2Client.getToken(code); 

        await db.query( `INSERT INTO google_oauth (id, access_token, refresh_token, expiry_date) VALUES (1, ?, ?, ?) 
            ON DUPLICATE KEY UPDATE access_token = VALUES(access_token), 
            refresh_token = VALUES(refresh_token), expiry_date = VALUES(expiry_date)`, 
            [tokens.access_token, tokens.refresh_token, tokens.expiry_date] );
            
        res.json({ success: true, message: 'Google Calendar connected' }); 
    
    } catch (err) { 
        res.status(500).json({ success: false, error: err.message }); 
    } 
});

//=============ACTUAL RESERVE save room save-room  room-res reserve====================//
//const { google } = require('googleapis');
router.post('/room-reserve', async (req, res) => {

    console.log('**** FIRED ROOM RESERVATION ENDPOINT() ****', req.body)
    const { room_id, date_from, date_to, added_by, room_name, remarks } = req.body;
    const connection = await db.getConnection();

    try {
        // === ACCESS CONTROL GATES ===
        const userId = Number(added_by);
        const targetRoomId = Number(room_id);
        const restrictedRooms = [1, 3, 4, 5];

        // RULE 1: User 89 has unlimited booking rights everywhere and skips all filters.
        // RULE 2: Standard users are restricted to a maximum of 2 bookings per room for rooms 1, 3, 4, and 5.
        if (userId !== 89 && restrictedRooms.includes(targetRoomId)) {
            
            // Extract Year and Month from date_from (e.g., '2026-05-23 14:00:00' becomes '2026-05')
            const bookingYearMonth = date_from.substring(0, 7);

            // Fetch the user's booking count for this individual room inside the current calendar month
            const [dbResultRows] = await connection.query(
                `SELECT COUNT(id) AS total_bookings FROM bgc_room_reserve
                WHERE added_by = ?
                AND room_id = ?
                AND DATE_FORMAT(date_from, '%Y-%m') = ?`,
                [userId, targetRoomId, bookingYearMonth]
            );

            // SAFE EXTRACTION: Grab row index 0 explicitly without confusing variable destructuring
            const existingBookingsForThisRoom = dbResultRows && dbResultRows[0] ? dbResultRows[0].total_bookings : 0;
            console.log(`User ${userId} has ${existingBookingsForThisRoom} active bookings for room ${targetRoomId}`);

            // Enforce Rule 2: If 2 bookings already exist, terminate the 3rd booking attempt immediately
            if (existingBookingsForThisRoom >= 2) {
                return res.status(200).json({
                    success: false,
                    limitExceeded: true,
                    message: `Reservation rejected. Non-admin users are restricted to 2 active bookings for ${room_name} per month. Your 3rd booking attempt has been blocked.`
                });
            }

        }
        // === END OF ACCESS CONTROL GATES ===

        await connection.beginTransaction();

        const [result] = await connection.query(
            `INSERT INTO bgc_room_reserve (room_id, date_from, date_to, added_by, remarks)
            VALUES (?, ?, ?, ?, ?)`,
            [room_id, date_from, date_to, added_by, remarks]
        );

        const [rows] = await connection.query(
            `SELECT refresh_token FROM google_oauth WHERE id = 1 LIMIT 1`
        );

        if (!rows.length || !rows[0].refresh_token) {
            await connection.commit();
         
            return res.json({
                success: true,
                id: result.insertId,
                warning: 'Reservation saved, but Google Calendar is not connected.'
            });
        }

        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT_URI
        );

        oauth2Client.setCredentials({ refresh_token: rows[0].refresh_token });
        
        const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
        
        const startISO = req.body.date_from.replace(" ", "T");
        const endISO = req.body.date_to.replace(" ", "T");

        const event = await calendar.events.insert({ 
            //calendarId: 'primary', //change to prdbarrion@gmail.com
            calendarId: 'ccfbgc@gmail.com', // Use your email, not 'primary'
            sendUpdates: 'none', 
            requestBody: {
                summary: `${req.body.remarks.toUpperCase()} - ${req.body.room_name},\n ${req.body.addedby_name} `,
                description: `Room/Table: ${ req.body.room_name}\nReserved by: ${req.body.addedby_name}, (${req.body.addedby_email})\nRemarks: ${req.body.remarks}`,
                start: { dateTime:  startISO, timeZone: 'Asia/Manila'},
                end: { dateTime: endISO, timeZone: 'Asia/Manila' },

                attendees: [
                    
                    { email: 'anaiahdaniel@gmail.com'},
                    { email: 'ccfbgc@gmail.com' },
                    { email: req.body.addedby_email }
                    // Add more attendees if needed
                ]
            }
        });

        await connection.query(
            `UPDATE bgc_room_reserve SET google_event_id = ? WHERE id = ?`,
            [event.data.id, result.insertId]
        );

        await connection.commit();

        res.json({
            success: true,
            id: result.insertId,
            google_event_id: event.data.id,
            message: 'Reservation and calendar event created'
        });
    } catch (err) {
        console.log('Error during reservation process:', err);

        // Safe transaction rollback block: Only run if a transaction was active
        try {
            // Check if connection has an active transaction state property
            if (connection && connection.beginTransaction && connection._transactionStarted) {
                await connection.rollback();
            }
        } catch (rollbackErr) {
            console.log('Rollback ignored or not needed:', rollbackErr.message);
        }
       
        res.status(500).json({ success: false, error: err.message });
    } finally {
        // This single block now handles freeing the connection stream for BOTH success, limit rejects, and errors safely.
        if (connection) connection.release();
    }

}); //===================END RESERVATION=========================//

//===================END RESERVATION=========================//

// THIS IS FOR DELETION OF BOOKING RECORD
//======================================== DELETE /bgc/booking/:id
router.delete('/deleteBooking/:id', async (req, res) => {
    
    console.log('**** FIRED DELETE BOOKING ENDPOINT() ****', req.params.id);
    const reservationId = req.params.id;
    const connection = await db.getConnection();

    try {   
        await connection.beginTransaction();

        // 1. Get the Google Event ID before deleting the record
        const [reservation] = await connection.query(
            `SELECT google_event_id FROM bgc_room_reserve WHERE id = ?`,
            [reservationId]
        );

        if (reservation.length === 0) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: 'Reservation not found.' });
        }

        const googleEventId = reservation[0].google_event_id;

        // 2. Get the OAuth credentials (matching your reserve logic)
        const [oauthRows] = await connection.query(
            `SELECT refresh_token FROM google_oauth WHERE id = 1 LIMIT 1`
        );

        // 3. If we have a Google Event ID and a Refresh Token, try to delete from Google
        if (googleEventId && oauthRows.length > 0 && oauthRows[0].refresh_token) {
            try {
                const oauth2Client = new google.auth.OAuth2(
                    process.env.GOOGLE_CLIENT_ID,
                    process.env.GOOGLE_CLIENT_SECRET,
                    process.env.GOOGLE_REDIRECT_URI
                );

                oauth2Client.setCredentials({ refresh_token: oauthRows[0].refresh_token });
                const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

                // Delete from the specific calendar
                await calendar.events.delete({
                    calendarId: 'ccfbgc@gmail.com', 
                    eventId: googleEventId
                });
                
                console.log('Successfully removed from Google Calendar');
            } catch (gErr) {
                // If the event was already deleted in Google, don't crash, just log it
                if (gErr.code === 404 || gErr.code === 410) {
                    console.log('Event already gone from Google Calendar.');
                } else {
                    throw gErr; // Re-throw other errors (auth, network, etc.)
                }
            }
        }

        // 4. Delete from MySQL
        await connection.query(`DELETE FROM bgc_room_reserve WHERE id = ?`, [reservationId]);

        await connection.commit();
        res.json({ success: true, message: 'Reservation deleted from DB and Google Calendar' });

    } catch (err) {
        console.log('Error during deletion process:', err);
        await connection.rollback();
        res.status(500).json({ success: false, error: err.message });
    } finally {
        connection.release();
    }


});

//=====D-GROUP ENDPOINTS=========//

//***** SAVE DGRP LEADER */
router.post('/register-leader', async (req, res) => {
    try {
        // 1. Destructure the values from your payload object model
        const { name, email, role, cp, upline, ministry, description, ageBracket, day, time, place } = req.body;
        const defaultMinistryId = ministry;
        const defaultGrpId = role; 
        let defaultRole = '';

        if(role !== '9' ) {
            defaultRole = 'Leader';
        }else{
            defaultRole = 'Member';
        }    
        console.log( req.body)
        //return false;

        // 2. ALWAYS RUN: Insert into bgc_dgroup regardless of role status
        const insertGroupSQL = `
            INSERT INTO bgc_dgroup 
            (full_name, email, account_role, cp_number, upline_name,  group_description, age_bracket, meeting_day, meeting_time, meeting_place) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        const [groupResult] = await db.query(insertGroupSQL, [
            name, email, defaultRole, cp, upline, description, ageBracket, day, time, place
        ]);

        // 3. EVALUATE ROLE: Only process user account creation if they are a Leader
       // if (role === 'Leader') {
            // Grab the generated AUTO_INCREMENT primary key generated by the first query
            const generatedGroupId = groupResult.insertId;

            const insertUserSQL = `
                INSERT INTO bgc_users (full_name, email, grp_id, ministry_id) 
                VALUES (?, ?, ?, ?)
            `;
            
            console.log(insertUserSQL, [name, email, defaultGrpId, defaultMinistryId]);
            
            await db.query(insertUserSQL, [
                name, email, defaultGrpId, defaultMinistryId
            ]);
            
            //console.log(`👑 Leader Registered: Created profile and user login linked to Group #${generatedGroupId}`);
       // } else {
            console.log(`👤 User Registered: Added to group registry only.`);
        //}

        return res.status(201).json({ 
            success: true, 
            message: role === 'Leader' 
                ? 'D-Group and Leader profile generated successfully!' 
                : 'User information added to the database successfully!' 
        });

    } catch (error) {
        // 3. CATCH AND EVALUATE DUPLICATE ERROR KEYS
        // errno 1062 or code 'ER_DUP_ENTRY' means the email unique index rule was breached
        if (error.errno === 1062 || error.code === 'ER_DUP_ENTRY') {
            console.warn(`⚠️ Blocked duplicate registration attempt for email: ${req.body.email}`);
            
            return res.status(400).json({ 
                success: false, 
                isDuplicate: true,
                message: 'This email address is already registered in our system.' 
            });
        }

        // Handle generic database connection failures
        console.error("Critical async/await database connection tracking failure:", error);
        return res.status(500).json({ 
            success: false, 
            error: 'Database transaction routing processing execution exception track.' 
        });

    }
});

//==== GET ALL DGRP LEADERS 
// Endpoint: GET /getdgrp
router.get('/getdgrp/:description/:ageBracket/:day/:time', async (req, res) => {
    try {
        // Read URL variables sent by the frontend fetch request
        const { description, ageBracket, day, time } = req.params;

        // Base query stringhow 
        let queryText = `
            SELECT 
                full_name, 
                email, 
                group_description, 
                age_bracket, 
                meeting_day, 
                meeting_time, 
                meeting_place 
            FROM bgc_dgroup
            WHERE account_role = 'Leader'
        `;
        const queryParams = [];

        // Check each variable and dynamically build secure query bindings
        if (description && description !== 'NA') {
            queryText += ` AND group_description = ?`;
            queryParams.push(description);
        }
        if (ageBracket && ageBracket !== 'NA') {
            queryText += ` AND age_bracket = ?`;
            queryParams.push(ageBracket);
        }
        if (day && day !== 'NA') {
            queryText += ` AND meeting_day = ?`;
            queryParams.push(day);
        }
        if (time && time !== 'NA') {
            queryText += ` AND meeting_time = ?`;
            queryParams.push(time);
        }

        // Add sorting sequence at the tail end
        queryText += `
            ORDER BY full_name,
                FIELD(meeting_day, 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'),
                STR_TO_DATE(meeting_time, '%l:%i %p')
        `;

        console.log( "Constructed SQL Query:", queryText, "With Parameters:", queryParams);

        // Destructure utilizing your style layout
        const [result] = await db.query(queryText, queryParams);
        
        // Respond with only matching records array
        res.status(200).json(result);

    } catch (error) {
        console.error('Database Query Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

//=========ENDPOINT FOR EMAIL TESTING
router.get('/emailer/:emailto/:nameto/:emailfrom/:namefrom/:cpno/:invitedvia', async(req,res)=>	{

//   let transporter = nodemailer.createTransport({
//     service: 'gmail',
//     auth: {
//       user: 'adminbesi@gmail.com',
//       pass: 'eumgsmqfjrebyxvn'
//     },
//      tls:{
//             rejectUnauthorized:false
//         }
//   });

    const transporter = nodemailer.createTransport({
        host: 'smtp.hostinger.com',
        port: 465,
        secure: true,
        auth: {
        user: 'admin@ccfbgc.org',
        pass: 'Wemby#1MVP',
        },
    });


  try {
      // Destructure parameters from the URL path pattern
      const { emailto, nameto, emailfrom, namefrom, cpno, invitedvia } = req.params;

      // Define the URL endpoint you want the user to trigger (e.g., to confirm or approve)
    // const actionUrl = `https://yourdomain.com{req.params.emailfrom}`;

    
    let htmltemp = `<html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta http-equiv="X-UA-Compatible" content="IE=edge">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>CCF BGC DGROUP INQUIRY</title>
        </head>
        <body style="font-family: Arial, sans-serif; color: #333333; line-height: 1.5;">
            
            Dear ${nameto},<br><br>
            This is an inquiry from <strong>${namefrom.toUpperCase()}</strong>, 
            regarding joining your DGroup in CCF BGC.<br><br>
            You can reach him/her @ <a href="mailto:${emailfrom}">${emailfrom}</a> <br>
            Or you can call/sms him/her @ <strong>${cpno}</strong><br><br>
            
            <span style="color: #DC3545; font-weight: bold;">PLS. DO NOT REPLY, THIS IS A SYSTEM GENERATED EMAIL.</span>
            <br><br>
             <!-- Styled Logo Header Container -->
            <div style="background-color: #0F2C59; padding: 15px; border-radius: 6px; text-align: left; margin-bottom: 20px; max-width: 250px;">
                <img src="https://ccfbgc.org/assets/img/bgclogo.png" alt="CCF BGC Logo" width="200" style="display: block; border: 0;">
            </div>
        </body>
        </html>`;
    
        const mailOptions = {
            from: `"ADMIN @ CCF BGC" <admin@ccfbgc.org>`,
            to: `"${nameto}" <${emailto}>`,
            bcc: `anaiahdaniel@gmail.com, ${emailfrom}`,
            subject: `CCF BGC DGROUP INQUIRY FROM ${namefrom.toUpperCase()} <${emailfrom}>`,
            html: htmltemp
        };
      
        // Modern async/await nodemailer handling wrapper
        await transporter.sendMail(mailOptions, async (err, info) => {
            if(err){
                console.log('nope',err)
                res.json({status:false})
            }else{
                //=== RETURN RESULT ===//
                console.log('**** MAIL SENT! *****')
                                                        
                res.json({
                    message: "Email sent successfully!",
                    voice:"Email sent successfully!"
                })
                
                // Save log entry to your MySQL database using 'db' object pool
                try {
                    const insertQuery = `
                        INSERT INTO bgc_dgrp_inquiry 
                        (dgrp_email, dgrp_leader, dgrp_seeker_email, dgrp_seeker_name, phone_seeker,invited_via) 
                        VALUES (?, ?, ?, ?, ?, ?)
                    `;
                    // Executing dynamic values against your table matching schema constraints
                    await db.query(insertQuery, [emailto, nameto, emailfrom, namefrom, cpno, invitedvia]);
                    console.log('**** DATA LOGGED IN BGC_DGRP_INQUIRY! ****');
                } catch (dbErr) {
                    console.error('Failed to log database inquiry history track:', dbErr);
                }

                //end Utils.deletepdf
            }//===eif
        })//=========end/ transport email
  } catch (err) {
    console.error('Error sending mail:', err);
  }
}) //===== end testmail =====

//==========FOR SMS ===========//
const smsPost = (msgbody) => {
	//number : '09175761186,09985524618,09611164983',
	console.log('***SENDING SMS*** ', msgbody)
	let smsdata = {
		apikey : '20dc879ad17ec2b41ec0dba928b28a69', //Your API KEY
		number : '09611164983',			
		message : msgbody,
		sendername : 'SEMAPHORE'
    }
	
	fetcher('https://semaphore.co/api/v4/messages', {
		method: 'POST',
		body: JSON.stringify(smsdata),
		headers: { 'Content-Type': 'application/json' }
	})    
	.then(res => res.json() )
    .then(json => console.log ('sms ->', json ))
	
}

//============ FOR QR CODE===========//

// ==========================================
// ENDPOINT 1: GENERATE SIGNED ATTENDANCE LINK
// ==========================================
// Helper function to get today's date string in YYYY-MM-DD format
function getTodayDateString() {
    return new Date().toISOString().split('T')[0];
}

// ⚠️ KEEP THIS SECRET. Never expose this to your vanilla JS frontend files!
const SECRET_KEY = "my_super_secret_attendance_key_2026";
const crypto = require('crypto');

router.post('/generate-qr', async (req, res) => {
    // In production, get these values from the logged-in user session

    const today = getTodayDateString();

    const { id, user, url } = req.body;

    // Create the hash using the exact same parameter structure
    const dataToHash = `${id}-${user}-${today}-${SECRET_KEY}`;
    const hash = crypto.createHash('sha256').update(dataToHash).digest('hex');

    // Return the clean URL back to the frontend generator
    res.json({
        qrUrl: `${url}/${id}/${encodeURIComponent(user)}/${today}/${hash}`
    });
});

//==========================================
// 2. THE GET ENDPOINT FOR THE PHONE CAMERA SCAN
// ==========================================
router.get('/mark-attendance/:id/:user/:date/:hash', async (req, res) => {
    const { id, user, date, hash } = req.params;

    // A. Expiration Check
    const today = getTodayDateString();
    if (date !== today) {
        return res.status(400).send("<h1>Error: This QR Code expired today!</h1>");
    }

    // B. Tamper/Security Check
    const expectedData = `${id}-${user}-${date}-${SECRET_KEY}`;
    const calculatedHash = crypto.createHash('sha256').update(expectedData).digest('hex');

    if (hash !== calculatedHash) {
        return res.status(403).send("<h1>Security Warning: QR code tampering detected!</h1>");
    }

    // C. Database Log
    try {
        const query = `INSERT INTO bgc_exalt_attendance (user_id, fname, date_added) VALUES (?,  ?, CONVERT_TZ(NOW(), 'SYSTEM', '+08:00'))`;
        await db.query(query, [id, user]);
        
        // Return a nice confirmation page to show on the phone screen
        //return res.send(`<h1>Success! Attendance logged for ${user}.</h1>`);
          // Success View
        return res.send(renderAttendanceStatus({
            title: "Attendance Logged!",
            message: `Welcome, ${user}. Your check-in has been successfully recorded for today.`,
            isSuccess: true,
            redirectUrl: "https://ccfbgc.org"
        }));

    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
             // Already Logged View
            return res.status(409).send(renderAttendanceStatus({
                title: "Already Checked In",
                message: `Hi ${user}, you have already recorded your attendance for today.`,
                isSuccess: false,
                redirectUrl: "https://ccfbgc.org"
            }));
        }
        console.error(error);
        // Server Error View
        return res.status(500).send(renderAttendanceStatus({
            title: "System Error",
            message: "Unable to save your record due to a database or Internet Issue. Please try scanning again.",
            isSuccess: false,
            redirectUrl: "https://ccfbgc.org"
        }));
    }
});

// HTML UI Template Generator
// HTML UI Template Generator (Pure CSS, No Framework Dependencies)
function renderAttendanceStatus({ title, message, isSuccess, redirectUrl }) {
    const themeColor = isSuccess ? "#198754" : "#dc3545"; 
    
    // Pure inline SVG Icons to guarantee immediate rendering
    const icon = isSuccess 
        ? `<svg width="64" height="64" fill="${themeColor}" viewBox="0 0 16 16"><path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.01-1.05z"/></svg>`
        : `<svg width="64" height="64" fill="${themeColor}" viewBox="0 0 16 16"><path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zM8 4a.905.905 0 0 0-.9.995l.35 3.507a.552.552 0 0 0 1.1 0l.35-3.507A.905.905 0 0 0 8 4zm.002 6a1 1 0 1 0 0 2 1 1 0 0 0 0-2z"/></svg>`;

    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        <style>
            /* Reset & Baseline styles */
            * { box-sizing: border-box; }
            body { 
                background-color: #121212; 
                color: #e0e0e0; 
                font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                margin: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
                padding: 15px;
            }
            /* Clean Dark-Theme UI Card */
            .status-card {
                background-color: #1e1e1e;
                border: 1px solid #2d2d2d;
                border-top: 5px solid ${themeColor};
                border-radius: 16px;
                padding: 30px 24px;
                text-align: center;
                max-width: 400px;
                width: 100%;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
            }
            .title {
                color: #ffffff;
                font-size: 22px;
                font-weight: 700;
                margin: 15px 0 10px 0;
            }
            .message {
                color: #aaaaaa;
                font-size: 14px;
                line-height: 1.5;
                margin: 0 0 24px 0;
            }
            .footer-divider {
                border-top: 1px solid #2d2d2d;
                padding-top: 15px;
                margin-top: 5px;
            }
            .countdown-text {
                font-size: 13px;
                color: #777777;
                margin: 0;
            }
            #countdown {
                font-weight: 700;
                color: #ffffff;
            }
        </style>
        <!-- Security redirect fallback -->
        <meta http-equiv="refresh" content="5;url=${redirectUrl}">
    </head>
    <body>

        <div class="status-card">
            ${icon}
            <div class="title">${title}</div>
            <p class="message">${message}</p>
            
            <div class="footer-divider">
                <p class="countdown-text">
                    Redirecting you in <span id="countdown">5</span> seconds...
                </p>
            </div>
        </div>

        <script>
            let timeLeft = 5;
            const timerElement = document.getElementById('countdown');
            const interval = setInterval(() => {
                timeLeft--;
                if (timerElement) timerElement.textContent = timeLeft;
                if (timeLeft <= 0) {
                    clearInterval(interval);
                }
            }, 1000);
        </script>
    </body>
    </html>
    `;
}


router.get('/testis', async (req,res) => {
        console.log('FRING TESTIS IN API.JS')
        res.status(200).send('ok')
})

//===test menu-submenu array->json--->
router.get('/menu/:grpid', async(req,res)=>{

    try {
        sql = `SELECT menu,
            menu_icon,
            grouplist, 
            JSON_ARRAYAGG( 
            JSON_OBJECT( 'sub', submenu, 'icon', submenu_icon, 'href', href )) AS list 
            FROM asn_menu 
            WHERE FIND_IN_SET('${req.params.grpid}', grouplist)> 0 
            GROUP BY menu 
            ORDER BY sequence;`
        
        const [results, fields] = await db.query(sql);
        
        res.status(200).json( results )

    } catch (err) {
        console.error('Error:', err);
        res.status(500).send('Error occurred');
    }

})



router.get('/handshake', async(req,res) => {

    res.json({status:true})
})

//   // --- PASTE THE HEARTBEAT HERE ---
// setInterval(() => {
//     if (clients && clients.length > 0) {
//         clients.forEach(client => {
//             try {
//                 // Send the keep-alive comment to every connected user
//                 client.res.write(': keep-alive\n\n');
//             } catch (err) {
//                 console.error("Error sending heartbeat to client", client.id);
//             }
//         });
//     }
// }, 20000); // 20 seconds is perfect for Hostinger
module.exports = router