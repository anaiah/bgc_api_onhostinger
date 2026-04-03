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

module.exports = (io) => {

//========login post
let dbconfig  ={
    host: 'srv2102.hstgr.io',
    user: 'U899193124_ccfbgc',    
    password: '6@32OEdQc',
    database: 'U899193124_ccfbgc',
    port:3306,
     waitForConnections: true, // default
    connectionLimit: 200,       // <-- Set your pool size here
    queueLimit: 0,      
    multipleStatements: true
}

//========login post
router.get('/loginpost/:uid/:pwd', async (req, res) => {
  const { uid, pwd } = req.params;
  console.log('firing login with Authenticate====== ', uid, pwd, ' ========');

  let conn; 

  try {
    conn = await mysqls.createConnection(dbconfig);

    const sql = `
      SELECT a.*, b.grp_description, c.id AS ministry_id,
             c.ministry_description, c.segment
      FROM bgc_users a 
      LEFT JOIN bgc_group b ON a.grp_id = b.grp_id
      LEFT JOIN bgc_ministry c ON a.ministry_id = c.id
      WHERE a.email = ?
    `;

    const [rows] = await conn.query(sql, [uid]);

    console.log('logindata', rows);

    if (rows.length > 0) {
      return res.json({ found: true, data: rows });
    } else {
      return res.json({ found: false, data: [] });
    }

  } catch (err) {
    console.log('Error in Login:', err);

    const xdata = [{
      message: "No Matching Record!",
      voice: "No Matching Record!",
      found: false
    }];

    console.error('Error:', err);
    return res.status(200).json(xdata);

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


    router.post('/newsitepost/:region', upload ,async(req,res)=>{
        console.log('===newsitepost() SAVING DATA=====')
                
        try {
            const { projectCode, 
                projectName, 
                projectOwner, 
                latField, 
                lonField,
                openingSelect,
                addressField,
                cityField, 
                elevationField,
                competitors } = req.body
            
            const fileBuffer = req.files[0].buffer;
            const originalFileName = req.files[0].originalname
            const renamedFileName = `${projectCode}.jpg`

            // console.log(fileBuffer )

            // console.log( projectCode, projectName, projectOwner,  latField, lonField, addressField, elevationField)

            // Insert into database
            const projectResult = await db.query(
                `INSERT INTO esndp_projects (project_code, name, owner, address, city, elevation, latitude, longitude, open_type, region)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                RETURNING id`,
                [
                    projectCode, 
                    projectName, 
                    projectOwner, 
                    addressField,  
                    cityField, 
                    elevationField, 
                    latField, 
                    lonField,
                    openingSelect,
                    req.params.region
                ]
            );

            let obj = {}, xdata=[]

            obj.pic = projectCode+".jpg"
            obj.lat = latField
            obj.lon = lonField
            obj.project = projectName
            obj.proj_owner = projectOwner
            obj.address =  addressField + ',' + cityField
            
            xdata.push(obj)

            //====== INSERT TO COMPETITORS TABLE
            const projectId = projectResult.rows[0].id; // ID of the new project

            const establishmentsDataJSON = JSON.stringify(competitors)

            // Insert competitors data into the esndp_competitors table
            const competitorResult = await db.query(
                `INSERT INTO esndp_competitors (project_id, establishments)
                VALUES ($1, $2)
                RETURNING id`,
                [projectId, establishmentsDataJSON]
            );

            //==== END INSERT TO COMPETITORS TABLE

            //====== START PROCESSING IMAGE FILE TO UPLOAD
            try{
                //process the image with Sharp
                // fileBuffer is the orig buffer file
                // then processedbuffer is from sharp which is 
                // already a resized Image

                const processedBuffer = await sharp(fileBuffer)
                    .resize({width:400})
                    .jpeg({quality:30})
                    .toBuffer();


                const ftp_client = new Client()

                try{

                     // basic-ftp account
                    await ftp_client.access({
                        host: "ftp.asianowapp.com",
                        user: "u899193124.ftpesndp",//ftpesndp
                        password: "Ftp@esndp0811", //Ftp@esndp0811

						// //path: 'public_html/app/assets/resized'			
                    })

                    // await ftp_client.ensureDir('public_html/app/esndp/') //ensure dir exists
                    // await ftp_client.cd("public_html/app/esndp/");
                    console.log('FTP Client connected==========')

                    //upload
                    await ftp_client.uploadFrom( Readable.from(processedBuffer), renamedFileName)

                }catch(err){
                    console.log('FTP ERROR',err)
                }finally{
                    console.log('TRANSFERRED')
                    ftp_client.close()  //close ftp

                }
            }catch(err){
                console.log('Error processing Image:' ,err)
            } finally{
                //CLEANUP MEMORYSTORAGE OF IMAGEFILE
                req.files[0].buffer = null;
                res.json({ info: xdata, success: true, voice: 'Data Saved!' });

            }
            
        } catch (err) {
            console.error('Error saving project:', err);
            res.status(500).json({ success: false, error: err.message });
        }

    })

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

	return router;
}
//module.exports = router