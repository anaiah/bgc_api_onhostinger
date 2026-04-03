const mysql = require('mysql2'); //use promise based mysql2
const {Client} = require('pg');

let client

const pool = mysql.createPool({
    host: 'srv2102.hstgr.io',
    user: 'U462718148_ccfbgc',    
    password: '6@32OEdQc',
    database: 'U462718148_ccfbgc',
    port:3306,
     waitForConnections: true, // default
    connectionLimit: 10,       // <-- Set your pool size here
    queueLimit: 0,      
    multipleStatements: true
});

const configMysql = {
    host: 'srv2102.hstgr.io',
    user: 'U462718148_ccfbgc',    
    password: '6@32OEdQc',
    database: 'U462718148_ccfbgc',
    port:3306,
     waitForConnections: true, // default
    connectionLimit: 10,       // <-- Set your pool size here
    queueLimit: 0,      
    multipleStatements: true
}

// Promisify for async/await
const poolPromise = pool.promise();

module.exports={

  configMysql,

    query: (sql, params) => poolPromise.query(sql, params),
  
    // optionally, add a method to get a connection if needed:
    getConnection: () => poolPromise.getConnection(),
    
    connectDb :async()=>{

        return new Promise((resolve,reject)=>{
            const con = mysql.createConnection( { 
                host: 'srv2102.hstgr.io',
                user: 'U462718148_ccfbgc',    
                password: '6@32OEdQc',
                database: 'U462718148_ccfbgc',
                port:3306,
                  waitForConnections: true, // default
                connectionLimit: 10,       // <-- Set your pool size here
                queueLimit: 0,      
                multipleStatements: true
            });
            con.connect((err) => {
                if(err){
                    reject(err);
                }
                    resolve(con);
            });
        
        })//END RETURN ,
        
    },
    closeDb : (con)=> {
        con.destroy();
    },

    // conn:{
    //         host: "ep-still-star-a5s7o7wh-pooler.us-east-2.aws.neon.tech",
    //         user:"neondb_owner",
    //         password:"npg_s7LehAjy9Ipv",
    //         database:"asianow",
    //         port:5432,
    //         ssl:{
    //             rejectUnauthorized:false,
    //         },
    //         min: 4,
    //         max: 10,
    //         idleTimeoutMillis: 1000,
    //         multipleStatements:true
    //     },
    // connectPg : async()=>{
        
    //     client = new Client({
    //         host: "ep-still-star-a5s7o7wh-pooler.us-east-2.aws.neon.tech",
    //         user:"neondb_owner",
    //         password:"npg_s7LehAjy9Ipv",
    //         database:"asianow",
    //         port:5432,
    //         ssl:{
    //             rejectUnauthorized:false,
    //         },
    //         min: 4,
    //         max: 10,
    //         idleTimeoutMillis: 1000,
    //         multipleStatements:true
    //     })

    //     await client.connect()

    //},
    /*
    query: async( sql, params )=>{
        if(client){
            return await client.query(sql,params)
        }else{
            throw new Error('not conek')
        }
    },
    */

    closePg: async()=> {
        if(client){
            await client.end();    
        }
        
    },
}//END EXPORT


