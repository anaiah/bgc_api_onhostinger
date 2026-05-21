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


app.get('/api/export-ministry-report', async (req, res) => {
    try {
        const sql = `... your SQL query ...`; 
        const [rows] = await db.query(sql);

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Ministry Report');

        // 1. HEADERS (Rows 1-4)
        worksheet.mergeCells('A1:P1'); // Extended to P for the AVG column
        worksheet.getCell('A1').value = 'CCF BGC';
        worksheet.getCell('A1').font = { bold: true, size: 14 };

        worksheet.mergeCells('A2:P2');
        worksheet.getCell('A2').value = 'MINISTRY PERFORMANCE SUMMARY';
        worksheet.getCell('A2').font = { bold: true, size: 12 };

        worksheet.mergeCells('A3:P3');
        worksheet.getCell('A3').value = `As of: ${new Date().toLocaleDateString()}`;

        // 2. TABLE HEADERS (Row 5) - Added "AVG"
        const headers = ["Ministry", "FY Target", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "AVG"];
        const headerRow = worksheet.getRow(5);
        headerRow.values = headers;

        headerRow.eachCell((cell) => {
            cell.font = { bold: true };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
            cell.border = { bottom: { style: 'thin' } };
        });

        // 3. DATA ROWS
        let currentRow = 6;
        let lastGrp = "";

        rows.forEach((row) => {
            // Group Header Styling (Dark Background, White Text)
            if (row.rpt_grp !== lastGrp) {
                worksheet.mergeCells(`A${currentRow}:P${currentRow}`);
                const groupCell = worksheet.getCell(`A${currentRow}`);
                groupCell.value = row.rpt_grp.toUpperCase();
                groupCell.font = { bold: true, color: { argb: 'FFFFFFFF' } }; // White Text
                groupCell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FF444444' } // Dark Grey Background
                };
                lastGrp = row.rpt_grp;
                currentRow++;
            }

            // Calculate Average (Months with value > 0)
            const months = [row.Jan, row.Feb, row.Mar, row.Apr, row.May, row.Jun, row.Jul, row.Aug, row.Sep, row.Oct, row.Nov, row.Dec];
            const activeMonths = months.filter(val => val > 0);
            const avgValue = activeMonths.length > 0 
                ? (activeMonths.reduce((a, b) => a + b, 0) / activeMonths.length).toFixed(2) 
                : 0;

            const target = row['FY Target'] || 0;

            // Add the data row
            const dataRow = worksheet.getRow(currentRow);
            dataRow.values = [
                row.Ministry,
                target,
                ...months,
                parseFloat(avgValue)
            ];

            // Conditional Formatting for AVG column (Column P / Index 15)
            const avgCell = dataRow.getCell(15);
            if (parseFloat(avgValue) >= target && target > 0) {
                avgCell.font = { color: { argb: 'FF008000' }, bold: true }; // Green
            } else if (target > 0) {
                avgCell.font = { color: { argb: 'FFFF0000' }, bold: true }; // Red
            }

            currentRow++;
        });

        // Column Widths
        worksheet.getColumn(1).width = 30; // Ministry
        for (let i = 2; i <= 15; i++) {
            worksheet.getColumn(i).width = 12; // Targets, Months, and AVG
        }

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=MinistryReport.xlsx');

        const buffer = await workbook.xlsx.writeBuffer();
        res.send(buffer);

    } catch (error) {
        console.error("Export Error:", error);
        res.status(500).send("Internal Server Error");
    }
});


//==============FOR MAKING IT
router.get('/downloadExcel', async (req, res) => {
   console.log('***FIRING DOWNLOAD EXCEL() ****** ')
    try {
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
            GROUP BY 
                r.rpt_grp, 
                r.rpt_description, 
                t.target_value, 
                r.rpt_sequence
            ORDER BY r.rpt_grp, r.rpt_sequence;`;

        const [rows] = await db.query(sql);

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Ministry Report');

        // 1. TOP HEADERS (Rows 1-4)
        // We use 15 columns (A through O): Ministry(1) + Target(1) + Months(12) + AVG(1) = 15
        worksheet.mergeCells('A1:O1');
        worksheet.getCell('A1').value = 'CCF BGC';
        worksheet.getCell('A1').font = { bold: true, size: 12 };

        worksheet.mergeCells('A2:O2');
        worksheet.getCell('A2').value = '4th Flr, One Bonifactio High Street Mall';
        worksheet.getCell('A2').font = { bold: true, size: 12 };

        worksheet.mergeCells('A3:O3');
        worksheet.getCell('A3').value = '5th Ave, BGC, Taguig, Metro Manila';
        worksheet.getCell('A3').font = { bold: true, size: 12 };

        worksheet.mergeCells('A4:O4');
        worksheet.getCell('A4').value = 'Ministry Performance vs. FY Target';
        worksheet.getCell('A4').font = { bold: true, size: 12 };

        worksheet.mergeCells('A5:O5');
        const today = new Date(); // On 05/08/2026, this becomes May 8, 2026
        const formattedDate = today.toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric'
        });
        worksheet.getCell('A5').value = `As of ${formattedDate}`;

        // 2. TABLE HEADERS (Row 7)
        const headers = ["Ministry", "FY Target", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "AVG"];
        const headerRow = worksheet.getRow(7);
        headerRow.values = headers;

        headerRow.eachCell((cell, colNumber) => {
            cell.font = { bold: true }
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } }; // Light Grey
            cell.border = { bottom: { style: 'thin' } };

             // CENTER HEADERS: 
            // Apply centering to Column 3 (Jan) throcolugh Column 15 (AVG)
            if (colNumber >= 2 && colNumber <= 15) {
                cell.alignment = { horizontal: 'center' };
            }
        });

        // 3. DATA ROWS
        let currentRow = 8; //start row 8
        let lastGrp = "";

        rows.forEach((row) => {
            // --- GROUP HEADER ---
            if (row.rpt_grp !== lastGrp) {
                worksheet.mergeCells(`A${currentRow}:O${currentRow}`);
                const groupCell = worksheet.getCell(`A${currentRow}`);
                groupCell.value = row.rpt_grp.toUpperCase();
                
                // Styling: Dark Grey Background, White Bold Text
                groupCell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FF333333' } // Darker Grey
                };
                groupCell.font = {
                    bold: true,
                    color: { argb: 'FFFFFFFF' } // Pure White
                };
                
                lastGrp = row.rpt_grp;
                currentRow++;
            }

            // --- CALCULATE AVG ---
            const months = [
                Number(row.Jan), Number(row.Feb), Number(row.Mar), Number(row.Apr), 
                Number(row.May), Number(row.Jun), Number(row.Jul), Number(row.Aug), 
                Number(row.Sep), Number(row.Oct), Number(row.Nov), Number(row.Dec)
            ];
            
            // Filter months that actually have data (> 0) to get a real average
            const activeMonths = months.filter(val => val > 0);
            const avgValue = Math.round( activeMonths.length > 0 
                ? (activeMonths.reduce((a, b) => a + b, 0) / activeMonths.length)
                : 0);

            const target = Number(row['FY Target']) || 0;

            // --- ADD DATA ROW ---
            const dataRow = worksheet.getRow(currentRow);
            dataRow.values = [
                row.Ministry,
                target,
                ...months,
                parseFloat(avgValue.toFixed(2)) // This goes into the AVG column (15)
            ];

            //just in case u want to center month values
            // Center the monthly data values (Columns 2 to 15) (inc FY Targets)
            for (let i = 2; i <= 15; i++) {
                dataRow.getCell(i).alignment = { horizontal: 'center' };
            }

            //==== format color of FY Target data
            const fyCell = dataRow.getCell(2);
            fyCell.font = { color: { argb: 'ff180b78'}, bold : true };

            // --- CONDITIONAL COLORING FOR AVG (Column 15 / 'O') ---
            const avgCell = dataRow.getCell(15);
            if (target > 0) {
                if (avgValue >= target) {
                    avgCell.font = { color: { argb: 'FF008000' }, bold: true }; // Green
                } else {
                    avgCell.font = { color: { argb: 'FFFF0000' }, bold: true }; // Red
                }
            }

            currentRow++;
        });

        // 4. COLUMN WIDTHS
        worksheet.getColumn(1).width = 35; // Ministry
        worksheet.getColumn(2).width = 12; // Target
        for (let i = 3; i <= 14; i++) { worksheet.getColumn(i).width = 8; } // Months
        worksheet.getColumn(15).width = 12; // AVG

        // 5. SEND FILE
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=MinistryReport.xlsx');

        const buffer = await workbook.xlsx.writeBuffer();
        res.send(buffer);

    } catch (error) {
        console.error("Excel Export Error:", error);
        res.status(500).json({ error: "Failed to generate Excel file" });
    }
})


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

//=============ACTUAL RESERVE====================//
//const { google } = require('googleapis');

router.post('/room-reserve', async (req, res) => {

    console.log('**** FIRED ROOM RESERVATION ENDPOINT() ****', req.body)
    const { room_id, date_from, date_to, added_by, room_name, remarks } = req.body;
    const connection = await db.getConnection();

    try {
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
            calendarId: 'prdbarrion@gmail.com', // Use your email, not 'primary'

            requestBody: {
                summary: `${req.body.room_name},\n ${req.body.addedby_name}\nRemarks: ${req.body.remarks}`,
                description: `Room/Table: ${ req.body.room_name}\nReserved by: ${req.body.addedby_name}\nRemarks: ${req.body.remarks}`,
                start: { dateTime:  startISO, timeZone: 'Asia/Manila'},
                end: { dateTime: endISO, timeZone: 'Asia/Manila' },

                // attendees: [
                //     { email: 'anaiahdaniel@gmail.com' },
                //     { email: 'prdbarrion@gmail.com' },
                //     { email: req.body.addedby_email }
                //     // Add more attendees if needed
                // ]
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

        await connection.rollback();
        res.status(500).json({ success: false, error: err.message });
    } finally {
        connection.release();
    }

}); //===================END RESERVATION=========================//


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
                    calendarId: 'prdbarrion@gmail.com', 
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
        const { name, email, role, description, ageBracket, day, time, place } = req.body;
        const defaultMinistryId = 10;
        const defaultGrpId = 5;

        console.log( req.body)
        //return false;

        // 2. ALWAYS RUN: Insert into bgc_dgroup regardless of role status
        const insertGroupSQL = `
            INSERT INTO bgc_dgroup 
            (full_name, email, account_role, group_description, age_bracket, meeting_day, meeting_time, meeting_place) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        const [groupResult] = await db.query(insertGroupSQL, [
            name, email, role, description, ageBracket, day, time, place
        ]);

        // 3. EVALUATE ROLE: Only process user account creation if they are a Leader
        if (role === 'Leader') {
            // Grab the generated AUTO_INCREMENT primary key generated by the first query
            const generatedGroupId = groupResult.insertId;

            const insertUserSQL = `
                INSERT INTO bgc_users (full_name, email, grp_id, ministry_id) 
                VALUES (?, ?, ?, ?)
            `;
            
            await db.query(insertUserSQL, [
                name, email, defaultGrpId, defaultMinistryId
            ]);
            
            console.log(`👑 Leader Registered: Created profile and user login linked to Group #${generatedGroupId}`);
        } else {
            console.log(`👤 Member Registered: Added to group registry only.`);
        }

        return res.status(201).json({ 
            success: true, 
            message: role === 'Leader' 
                ? 'D-Group and Leader profile generated successfully!' 
                : 'Member information added to the database successfully!' 
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

router.get('/testmail', async(req,res)=>	{

  let transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'adminbesi@gmail.com',
      pass: 'eumgsmqfjrebyxvn'
    },
     tls:{
            rejectUnauthorized:false
        }
  });

  try {

    let htmltemp = `<html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta http-equiv="X-UA-Compatible" content="IE=edge">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Document</title>
        </head>
        <body>
            Dear User,<br><br>Thank you for your Data Entry.<br><br>
            <font color=red>PLS. DO NOT REPLY, THIS IS A SYSTEM GENERATED EMAIL.</font>
            <br><br><br><br>        </body>
        </html>	`

    
        const mailOptions = {
            from: '"ADMIN @ BESI" <noreply@asianowapp.com>',

            to: '"Caloy" <anaiahdaniel@gmail.com>',
            subject: `== APPROVED entry==`,
            html: htmltemp,
            
        }
        
        transporter.sendMail(mailOptions,(err,info)=>{
            if(err){
                console.log('nope',err)
                res.json({status:false})
            }else{
                //=== RETURN RESULT ===//
                console.log('**** MAIL SENT! *****')
                                                        
                res.json({
                    message: "UPDATED Successfully!",
                    voice:"Equipment Updated Successfully!"
                })
                
                //end Utils.deletepdf
            }//===eif
        })//=========end/ transport email
  } catch (err) {
    console.error('Error sending mail:', err);
  }
}) //===== end testmail =====


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