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

const cors = require('cors')

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
app.use( cors())

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

  } finally {
    if (conn) {
      try {
        await conn.end();
      } catch (endErr) {
        console.error('Error closing connection:', endErr);
      }
    }
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
    pusher.trigger(`user-${targetId}`, "personal-alert", {
        message: msg,
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
    router.post('/saveattendance/:id/:ministry/:ministryId', async(req,res)=>{
        const { id, ministry, ministryId } = req.params;
        const { serviceSelect, segmentSelect, countInput } = req.body;
        
        console.log('===firing saveattendance() with id====', id ,ministry, ministryId , req.body)
        console.log('saveattendance payload:', {
        ministryId,
        countInput,
        serviceSelect,
        segmentSelect,
        ministry,
        addedBy: id
        });
        
        if (!segmentSelect || !countInput) {
            return res.status(400).json({ ok: false, message: 'segmentSelect and countInput are required' });
        }

        try {
            // Check by segment + today
            const checkSql = `
            SELECT id
            FROM bgc_headcount
            WHERE ministry_segment = $1 and 
            service = $2
                AND date_added::date = CURRENT_DATE
            ORDER BY id DESC
            LIMIT 1
            `;
            const checkResult = await db.query(checkSql, [segmentSelect, serviceSelect]);

            if (checkResult.rows.length > 0) {
                const existingId = checkResult.rows[0].id;

                const updateSql = `
                    UPDATE bgc_headcount
                    SET
                    ministry_id    = $1,
                    headcount     = $2,
                    service       = $3,
                    ministry_name = $4,
                    added_by      = $5,
                    date_added    = NOW()
                    WHERE id = $6
                    RETURNING *;
                `;
                const upd = await db.query(updateSql, [
                    parseInt(ministryId, 10),
                    parseInt(countInput, 10),
                    serviceSelect || null,
                    ministry,
                    parseInt(id, 10),
                    existingId
                ]);

                return res.json({ ok: true, action: 'update', row: upd.rows[0] });
            } else {
                const insertSql = `
                INSERT INTO bgc_headcount
                    (ministry_id, headcount, service, ministry_segment, ministry_name, added_by, date_added)
                    VALUES( $1, $2, $3, $4, $5, $6, NOW())
                    RETURNING *;
                `;

                const ins = await db.query(insertSql, [
                    parseInt(ministryId, 10),
                    parseInt(countInput, 10),
                    serviceSelect || null,
                    segmentSelect,
                    ministry,
                    parseInt(id, 10)
                ]);

                return res.json({ ok: true, action: 'record add', row: ins.rows[0] });
            }
        } catch (err) {
            console.error('saveattendance error:', err);
            return res.status(500).json({ ok: false, message: 'Server error', error: err.message });
        }

    })

    //===========get chart attendance AM PM
    // GET /chart/headcount-by-ministry
    router.get('/headcount-by-ministry', async (req, res) => {
    try {
        const sql = `
        select
        ministry_name,
        service,
        ministry_segment,
        sum(headcount) as total
        from bgc_headcount
        where (date_added at time zone 'Asia/Manila')::date = (now() at time zone 'Asia/Manila')::date
        group by ministry_name, service, ministry_segment, date_added
        order by ministry_name, service;
        `;
        
        const result = await db.query(sql);
        const rows = result.rows || [];


        console.log( sql, rows)
        // categories = unique ministry names
        const categories = [...new Set(rows.map(r => r.ministry_name))];

        // collect unique segments (normalized)
        const norm = s => (s || '').toString().trim();

        // collect unique segments (normalized)
        const segments = [...new Set(rows.map(r => norm(r.ministry_segment)).filter(s => s))];

        // build combos = for each segment, AM and PM (keep deterministic order)
        const combos = [];
        segments.forEach(seg => {
        combos.push({ service: 'AM', segment: seg, name: `AM • ${seg}` });
        combos.push({ service: 'PM', segment: seg, name: `PM • ${seg}` });
        });

        // build a lookup map from ministry+service+segment to total
        const map = new Map();
        rows.forEach(r => {
            const key = `${r.ministry_name}||${(r.service||'').toString().trim()}||${norm(r.ministry_segment)}`;
            map.set(key, Number(r.total));
        });


        // build series: one series per combo, data aligned with categories
        // use null for missing values so ApexCharts treats them as gaps
        let series = combos.map(c => {
        const data = categories.map(cat => {
            const key = `${cat}||${c.service}||${c.segment}`;
            return map.has(key) ? map.get(key) : null;
        });
        return { name: c.name, data };
        });

        // remove series that are entirely null (no data at all)
        series = series.filter(s => s.data.some(v => v !== null));

        return res.json({ ok: true, categories, series });

    
    } catch (err) {
        console.error('chart/headcount-by-ministry error:', err);
        return res.status(500).json({ ok: false, message: err.message });
    }
    });


    /**** ROOM RESERVATION, GET ROOMS AND SCHED */
    router.get('/getrooms/:date', async (req, res) => {

        console.log('====Firing getrooms() from calendar.getrooms() ')
        const { date } = req.params; // expected 'YYYY-MM-DD'
        if (!date) {
            return res.status(400).json({ success: false, error: 'date is required' });
        }

        try {

            const sql = `
            SELECT
                rr.id AS booking_id,
                r.id,
                r.room_description,
                COALESCE(
                    json_agg(
                    json_build_object(
                        'id', rr.id,
                        'date_from', rr.date_from,
                        'date_to', rr.date_to,
                        'added_by', rr.added_by,
                        'added_by_name', u.full_name,
                        'ministry', m.ministry_description
                    )
                    ) FILTER (WHERE rr.id IS NOT NULL),
                    '[]'::json
                ) AS reservations
            FROM bgc_rooms r
            LEFT JOIN bgc_room_reserve rr
                ON rr.room_id = r.id
            AND rr.date_from::date = $1::date
            LEFT JOIN bgc_users u
                ON u.id = rr.added_by
            LEFT JOIN bgc_ministry m
                ON m.id = u.ministry_id
            GROUP BY
                r.id,
                r.room_description,
                rr.date_from,
                rr.id
            ORDER BY
                r.room_description,
                rr.date_from;
            `;

            const result = await db.query(sql, [date]);

            console.log(sql, result)
            res.json({
            success: true,
            date,
            rooms: result.rows, // [{ id, room_description, reservations: [...] }]
            });
        } catch (err) {
            console.error('Error fetching rooms:', err);
            res.status(500).json({ success: false, error: 'Server error' });
        }
    });


    // THIS IS THE ACTUAL ROOM RESERVATION
    router.post('/room-reserve', express.json(), async (req, res) => {
        
        console.log('firing room-reserve()----')

        const { room_id, date_from, date_to, added_by } = req.body;

        if (!room_id || !date_from || !date_to || !added_by) {
            return res.status(400).json({
            success: false,
            error: 'room_id, date_from, date_to, added_by are required'
            });
        }

        try {
            const query = `
            INSERT INTO bgc_room_reserve (room_id, date_from, date_to, added_by)
            VALUES ($1, $2, $3, $4)
            RETURNING id, room_id, date_from, date_to, date_added, added_by
            `;
            const params = [room_id, date_from, date_to, added_by];

            const result = await db.query(query, params);

            res.json({
            success: true,
            reservation: result.rows[0]
            });
        } catch (err) {
            console.error('Error inserting reservation:', err);
            res.status(500).json({
            success: false,
            error: 'Server error while saving reservation'
            });
        }
    });

    // THIS IS FOR DELETION OF BOOKING RECORD
    // DELETE /bgc/booking/:id
    router.delete('/deletebooking/:id', async (req, res) => {
        const { id } = req.params;

        try {
            const sql = 'DELETE FROM bgc_room_reserve WHERE id = $1';
            const result = await db.query(sql, [id]);

            if (result.rowCount === 0) {
            return res.status(404).json({ success: false, error: 'Not found' });
            }

            res.json({ success: true });
        } catch (err) {
            console.error('Error deleting booking:', err);
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

      // --- PASTE THE HEARTBEAT HERE ---
    setInterval(() => {
        if (clients && clients.length > 0) {
            clients.forEach(client => {
                try {
                    // Send the keep-alive comment to every connected user
                    client.res.write(': keep-alive\n\n');
                } catch (err) {
                    console.error("Error sending heartbeat to client", client.id);
                }
            });
        }
    }, 20000); // 20 seconds is perfect for Hostinger

	return router;
}
//module.exports = router