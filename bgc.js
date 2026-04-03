//get express js
const express = require('express')
const app = express()

const bodyParser = require('body-parser')

// in some file
const EventEmitter = require('events');
const bus = new EventEmitter();  // or perhaps your class
bus.setMaxListeners(20)

//======== for db connection
const db  = require('./db')

const http = require('http')

//===== for socket.io
const server_https = http.createServer( app);

//const { Server } = require('socket.io'); 

//===setting of socket.io
//const io = new Server(server_https);
const io = require("socket.io")( server_https, {
    transports:['websocket','polling'],
    cors: {
      origin: "*", //bring back to https://asianowapp.com
      methods: ["GET", "POST","PUT","DELETE"],
      //allowedHeaders: ["vantaztic-header"],
      //credentials: true
    }
})

//*********** connect to MySQL ***********//
const connectToMySql = async () => {
  try {
    const [rows] = await db.query('SELECT NOW() AS now');
    console.log('✅ BGCMySQL DB connected. Server time:', rows[0].now);
  } catch (err) {
    console.error('❌ BGC MySQL DB connection failed:', err.message);
    console.error(err);
    process.exit(1); // optional: stop app if DB is down
  }
};
connectToMySql();

//******************************* connect to postgres */
const connectToDB = async () =>{
try {
    const res = await db.query('SELECT NOW() AS now');
    console.log('✅ BGC DB connected. Server time:', res.rows[0].now);
  } catch (err) {
    console.error('❌ BGC DB connection failed:', err.message);
    console.error(err); // extra details
  }
}
// connectToDB();
//******************************* END connect to postgres */

const path = require('path')

//=======================
//important, tell express that the data returned is json
app.use(express.json({limit:'50mb'})) 
app.use(express.urlencoded({extended:true}))

// to support URL-encoded bodies
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({extended:false}))

//=== this is !important for CORS especially for different servers calling====//
//=== this is !important for CORS especially for different servers calling====//
//const allowedOrigins = ["https://app.vantaztic.com","https://app.vantaztic.com","https://osndp1.onrender.com","http://localhost:4001"]

const allowedOrigins = "*"
/*
app.use(function(req, res, next) {
    let origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) {
        res.header("Access-Control-Allow-Origin", origin); // restrict it to the required domain
    }
    res.header("Access-Control-Allow-Methods", "GET,HEAD,OPTIONS,POST,PUT");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    next();
});
*/

var allowCrossDomain = function(req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type,Origin, X-Requested-With, Content-Type, Accept, Authorization');
    next();
}


app.use(allowCrossDomain);


//======== END NODEJS CORS SETTING
const getRandomPin = (chars, len)=>[...Array(len)].map(
    (i)=>chars[Math.floor(Math.random()*chars.length)]
 ).join('');
 
//======== END NODEJS CORS SETTING
app.get('/test',(req, res)=>{
    const apitest = getRandomPin('0123456789',6)
    console.log(apitest, ' API Ready to Serve')
    res.status(200).send(`${apitest} API ready to serve!`)
    //res.sendFile(path.join(__dirname , 'index.html'))
})

//===local routing

app.get('/',(req, res)=>{
    res.status(200).send('API ready to serve via Vercela!')
    //res.sendFile(path.join(__dirname , 'index.html'))
})

/*
app.get('/test',(req, res)=>{
    res.send(`Enuff with the test it's working fine!`)
    //res.sendFile(path.join(__dirname , 'index.html'))
})
*/

//===============Main Routes
// const usersRouter = require('./routes/api')(io);
// app.use('/', usersRouter);

const bgcRouter= require('./routes/bgcapi')(io);
app.use('/bgc', bgcRouter);

const cookieParser = require('cookie-parser');
app.use(cookieParser())

//===== socket.io connect
let nLogged = 0
let xmsg
let userMode, userName

let connectedSockets = []

//listen socket.io
io.on('connection', (socket) => {

    if(socket.handshake.query.userName){
		const userNames = socket.handshake.query.userName
		const userNamex = JSON.parse(userNames)
		userName = userNamex.token
		
		userMode = userNamex.mode
		console.log('mode==', userMode)
				
		connectedSockets.push({
				socketId: socket.id,
				mode: userMode,
				userName
		})		
				
		nLogged++
				
		console.log('*** BGC SOCKET.IO SERVICES STARTED ***\n', connectedSockets)	
		
		console.log(`BGC USERS Connected ${nLogged}`)
		
		
	}//============eif


    socket.on('sendToOwner', (data) => {
        
        let xdata = data
        
        const finder = connectedSockets.findIndex( x => x.mode=='4') //find the boss
        
        //console.log(finder)

        if(finder >= 0){ //if found
            //give message to the intended client
            socket.to( connectedSockets[finder].socketId).emit('xinit', 'update chart!' )

            console.log('@@@initially found opmgr', connectedSockets[finder].socketId)
        }

        if(finder ==-1){
            //if intended client not connected, send back message to user sender
            socket.emit('noconnect', data)
        }

        /*
        //loop thru array socket
        connectedSockets.forEach(socketInfo => {
            if(parseInt(socketInfo.mode)===2){

               socket.to( socketInfo.socketId ).emit('updatechart', data )

               console.log(`Fired Event 'updatechart' to USER: ${socketInfo.userName}, ID: ${socketInfo.socketId }`)
            }//eif
        })
            */
        // const finder = connectedSockets.findIndex( x => x.mode===5)
        
        // //console.log(finder)

        // if(finder >= 0){ //if found
        //     //give message to the intended client
        //     socket.to( connectedSockets[finder].socketId).emit('loadchart', data )
        //     console.log('found opmgr', connectedSockets[finder].socketId)
        // }

        // if(finder ==-1){
        //     //if intended client not connected, send back message to user sender
        //     socket.emit('noconnect', data)
        // }
    })//end listener	

    socket.on('init', (data) => {
        let xdata = data
        
        const finder = connectedSockets.findIndex( x => x.mode==5)
        
        //console.log(finder)

        if(finder >= 0){ //if found
            //give message to the intended client
            socket.to( connectedSockets[finder].socketId).emit('xinit', data )
            console.log('@@@initially found opmgr', connectedSockets[finder].socketId)
        }

        if(finder ==-1){
            //if intended client not connected, send back message to user sender
            socket.emit('noconnect', data)
        }
    })//end listener	
	//console.log('*** SOCKET.IO SERVICES STARTED ***')

    //nLogged++

    //preliminary logged info
    io.emit('logged',`User connected: ${nLogged }`)
    
    console.log(`user connected ${nLogged}`)
    /*
    console.log('=====CONNECTING IO SOCKET.IO=====')

    listClient.push({"id":socket.id })
    nLogged++

    //console.log('NUMBER OF LOGGED USERS : ', nLogged)
    io.emit('logged',`NUMBER OF USERS: ${nLogged }`)

    Object.keys(  listClient ).forEach(key => {
        console.log(`**${listClient[key].id} connected` )
    })
    */
    //if user disconnect
    socket.on('disconnect', (id) => {
		console.log('disconnecting....')
				
			nLogged--
		
            if(nLogged <= 0){
                nLogged = 0
            }
		//const togo = connectedSockets.find(o=>o.socketId === socket.id)
        
        const togo = connectedSockets.findIndex( x => x.socketId === socket.id)
        
        connectedSockets.splice(togo, 1 )

        console.log( connectedSockets)

        console.log(`NEWLY CREATED ** BGC's User Connected ${nLogged}`)
        //io.emit('logged',`Zonked connected: ${nLogged }`)
    })

  
    
})//end io conn
//====== server listen to por

//orig ->const port = process.env.PORT||10000
const PORT = Number(process.env.PORT||3000 );
//const PORT = Number(process.env.PORT);
if (!PORT) throw new Error('PORT is not set');
//onst HOST = '0.0.0.0';

const HOST = '0.0.0.0';

server_https.listen( PORT , HOST ,()=>{
    console.log(`NEWLY CREATED *** BGC FINAL API -- listening to port ${PORT}`)
})
