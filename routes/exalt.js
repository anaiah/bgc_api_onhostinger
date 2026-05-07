const express = require('express')
const router = express.Router()

const db  = require('../db')// your pool module

const mysqls = require('mysql2/promise')

const moment = require('moment'); // npm install moment

//generate sched
router.get('/generate-schedule', async (req, res) => {
    console.log('generating sched... ')
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();


        // 1. Define the timeframe (e.g., the next 4 Sundays)
        let currentSunday = moment().add(1, 'weeks').startOf('week').add(7, 'days'); 
        const weeksToSchedule = 4;


        for (let i = 0; i < weeksToSchedule; i++) {
            const dateStr = currentSunday.format('YYYY-MM-DD');
            const occurrence = Math.ceil(currentSunday.date() / 7); // 1st, 2nd, 3rd Sunday?


            const rolesToFill = [
                { role: 'Worship Leader', dbField: 'wl_skill' },
                { role: 'Alto', dbField: 'alto_skill' },
                { role: 'Tenor', dbField: 'tenor_skill' },
                { role: 'Soprano', dbField: 'soprano_skill' }
            ];


            let assignedThisSunday = []; // To prevent double-booking the same person


            for (const item of rolesToFill) {
                // Find available singers for this role who aren't on vacation and aren't already picked today
                const [candidates] = await connection.execute(`
                    SELECT v.*, 
                    (SELECT preferred_value FROM exalt_volunteer_preferences WHERE volunteer_id = v.id) as pref_sunday,
                    (SELECT COUNT(*) FROM exalt_volunteer_blockouts WHERE volunteer_id = v.id AND blockout_date = ?) as is_blocked
                    FROM exalt_volunteers v 
                    WHERE v.${item.dbField} != '0-None' 
                    AND v.is_active = 1
                    ORDER BY v.last_served_date ASC`, [dateStr]);


                // Filter out blocked people and already assigned people
                let available = candidates.filter(c => c.is_blocked === 0 && !assignedThisSunday.includes(c.id));


                // PRIORITY 1: Check if someone has a "Recurring Sunday" preference (e.g., your friend)
                let selected = available.find(c => c.pref_sunday === occurrence);


                // PRIORITY 2: If no preference, pick the person who hasn't served in the longest time
                if (!selected && available.length > 0) {
                    selected = available[0]; 
                }


                if (selected) {
                    assignedThisSunday.push(selected.id);


                    // A. Update their Last Served Date
                    await connection.execute(
                        "UPDATE exalt_volunteers SET last_served_date = ? WHERE id = ?", 
                        [dateStr, selected.id]
                    );


                    // B. Save to the Schedule Table
                    await connection.execute(
                        "INSERT INTO exalt_sunday_schedules (event_date, volunteer_id, role_assigned) VALUES (?, ?, ?)",
                        [dateStr, selected.id, item.role]
                    );
                }
            }
            currentSunday.add(7, 'days'); // Move to next Sunday
        }


        await connection.commit();
        res.send("Schedule for the next month has been scattered!");
    } catch (error) {
        await connection.rollback();
        console.error(error);
        res.status(500).send("Scheduling failed: " + error.message);
    } finally {
        connection.release();
    }
});

//view sched 
router.get('/view-schedule', async (req, res) => {
    console.log('viewing sched.....')
    const connection = await db.getConnection();
    try {
        // Fetch the schedule joined with volunteer names from MySQL
        const [rows] = await connection.execute(`
            SELECT s.event_date, v.name, s.role_assigned, v.wl_skill, v.alto_skill
            FROM exalt_sunday_schedules s
            JOIN exalt_volunteers v ON s.volunteer_id = v.id
            ORDER BY s.event_date ASC
        `);

        // Group the data by date so it's readable
        const groupedSchedule = rows.reduce((acc, row) => {
            const date = row.event_date.toISOString().split('T')[0];
            if (!acc[date]) acc[date] = [];
            acc[date].push({
                name: row.name,
                role: row.role_assigned
            });
            return acc;
        }, {});

        // Send JSON directly to the browser
        res.json(groupedSchedule);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Could not fetch schedule" });
    } finally {
        connection.release();
    }
});



module.exports = router