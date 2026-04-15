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

const upload = multer({ storage: multer.memoryStorage() });

const xlsx = require('xlsx');

const Pusher = require("pusher");

const pusher = new Pusher({
  appId: "2136889",
  key: "e7e1396c6d903263f9a9",
  secret: "f74c1d97d6c62536d941",
  cluster: "ap1",
  useTLS: true
});

module.exports = (io) => {

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
router.get('/get-target-grid', async (req, res) => {
    try {

        //the field is important in order, coz this is the order of columns in the grid.js, so if you change the order here, change it also in the grid.js column definition
        const sql = `
            SELECT 
                t.ministry_segment AS 'Ministry',    
                t.target_value AS 'FY Target',
                SUM(CASE WHEN MONTH(h.date_added) = 1 THEN h.headcount ELSE 0 END) AS 'Jan',
                SUM(CASE WHEN MONTH(h.date_added) = 2 THEN h.headcount ELSE 0 END) AS 'Feb',
                SUM(CASE WHEN MONTH(h.date_added) = 3 THEN h.headcount ELSE 0 END) AS 'Mar',
                SUM(CASE WHEN MONTH(h.date_added) = 4 THEN h.headcount ELSE 0 END) AS 'Apr',
                SUM(CASE WHEN MONTH(h.date_added) = 5 THEN h.headcount ELSE 0 END) AS 'May',
                SUM(CASE WHEN MONTH(h.date_added) = 6 THEN h.headcount ELSE 0 END) AS 'Jun',
                SUM(CASE WHEN MONTH(h.date_added) = 7 THEN h.headcount ELSE 0 END) AS 'Jul',
                SUM(CASE WHEN MONTH(h.date_added) = 8 THEN h.headcount ELSE 0 END) AS 'Aug',
                SUM(CASE WHEN MONTH(h.date_added) = 9 THEN h.headcount ELSE 0 END) AS 'Sep',
                SUM(CASE WHEN MONTH(h.date_added) = 10 THEN h.headcount ELSE 0 END) AS 'Oct',
                SUM(CASE WHEN MONTH(h.date_added) = 11 THEN h.headcount ELSE 0 END) AS 'Nov',
                SUM(CASE WHEN MONTH(h.date_added) = 12 THEN h.headcount ELSE 0 END) AS 'Dec'
            FROM bgc_targets t
                LEFT JOIN bgc_headcount h ON t.ministry_segment COLLATE utf8mb4_unicode_ci = h.ministry_segment COLLATE utf8mb4_unicode_ci
                AND YEAR(h.date_added) = t.fiscal_year
            WHERE t.fiscal_year = YEAR(CURDATE())
            GROUP BY t.ministry_segment, t.target_value;
        `;
        const [rows] = await db.query(sql);
        
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

///===== FOR GOOGLE CALENDAR API ==========//
const { google } = require('googleapis');
const path = require('path');

// Clean the Base64 string of any accidental whitespace/newlines from the dashboard
const rawBase64 = process.env.GOOGLE_JSON_KEY.trim().replace(/\s/g, '');

// Decode and sanitize the resulting JSON string
const decodedString = Buffer.from(rawBase64, 'base64').toString('utf-8');
const sanitizedJson = decodedString.replace(/\n/g, '\\n').replace(/\r/g, '');

const keys = JSON.parse(sanitizedJson);


const authClient = new google.auth.JWT({
        email: keys.client_email,
    key: keys.private_key.replace(/\\n/g, '\n'), // Crucial: convert string \n back to actual newlines for Google

    scopes: ['https://www.googleapis.com/auth/calendar'] 
});


const calendar = google.calendar({ version: 'v3', auth: authClient });
const CALENDAR_ID = 'anaiahdaniel@gmail.com'; 


// ************************** THIS IS THE ACTUAL ROOM *******************************//
router.post('/room-reserve', async (req, res) => {
    const { room_id, date_from, date_to, added_by } = req.body;

    try {
        // 1. MySQL Insert
        const sql = `INSERT INTO bgc_room_reserve (room_id, date_from, date_to, added_by) VALUES (?, ?, ?, ?)`;
        const [result] = await db.query(sql, [room_id, date_from, date_to, added_by]);
        const dbId = result.insertId;

        // 2. Google Calendar Sync
        let googleEventId = null;
        try {
            // Force authorization
            await authClient.authorize();

            const gEvent = await calendar.events.insert({
                calendarId: CALENDAR_ID,
                requestBody: {
                    summary: `Room Booking: ${room_id}`,
                    description: `Reserved by ${added_by}`,
                    start: { 
                        dateTime: new Date(date_from).toISOString(),
                        timeZone: 'Asia/Manila' 
                    },
                    end: { 
                        dateTime: new Date(date_to).toISOString(),
                        timeZone: 'Asia/Manila'
                    },
                },
            });
            
            googleEventId = gEvent.data.id;

            // 3. Save the Google ID back to your database
            await db.query(`UPDATE bgc_room_reserve SET google_event_id = ? WHERE id = ?`, [googleEventId, dbId]);
            
            console.log("Success! Google Event ID:", googleEventId);

        } catch (gErr) {
            // This will now show the REAL error (likely 404 if not shared correctly)
            console.error("Google sync error detail:", gErr.response ? gErr.response.data : gErr.message);
        }

        res.json({ success: true, id: dbId, syncedToGoogle: !!googleEventId });

    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});


// router.post('/room-reserve', async (req, res) => {
//     const { room_id, date_from, date_to, added_by } = req.body;
//     try {
//         const sql = `INSERT INTO bgc_room_reserve (room_id, date_from, date_to, added_by) VALUES (?, ?, ?, ?)`;
//         const [result] = await db.query(sql, [room_id, date_from, date_to, added_by]);
//         res.json({ success: true, id: result.insertId });
//     } catch (err) {
//         res.status(500).json({ success: false, error: err.message });
//     }
// });


// THIS IS FOR DELETION OF BOOKING RECORD
// DELETE /bgc/booking/:id
// DELETE /delete-room-reserve/:id
router.delete('/delete-room-reserve/:id', async (req, res) => {
    const { id } = req.params;

    if (!id) {
        return res.status(400).json({ success: false, error: 'ID is required' });
    }

    try {
        console.log(`==== Firing delete-room-reserve for ID: ${id} ====`);

        // MySQL uses ? placeholder
        const sql = `DELETE FROM bgc_room_reserve WHERE id = ?`;
        
        const [result] = await db.query(sql, [id]);

        // In MySQL, result.affectedRows tells you if the row existed and was deleted
        if (result.affectedRows === 0) {
            return res.status(404).json({ 
                success: false, 
                error: 'Booking not found or already deleted' 
            });
        }

        res.json({
            success: true,
            message: 'Reservation deleted successfully',
            deletedId: id
        });

    } catch (err) {
        console.error('Error deleting reservation:', err);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});



router.get('/testis', async (req,res) => {
        console.log('FRING TESTIS IN API.JS')
        res.status(200).send('ok')
})

//=========FUNCTION TO GET PAGES OF PDF

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

	return router;
}
//module.exports = router