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

const path = require('path')

//=======================
//important, tell express that the data returned is json
app.use(express.json()) 
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
/*
app.get('/',(req, res)=>{
    res.send('API ready to serve!')
    //res.sendFile(path.join(__dirname , 'index.html'))
})

app.get('/test',(req, res)=>{
    res.send(`Enuff with the test it's working fine!`)
    //res.sendFile(path.join(__dirname , 'index.html'))
})
*/

//===============Main Routes
const usersRouter = require('./routes/api')(io);
app.use('/', usersRouter);

const aedcRouter= require('./routes/aedc')(io);
app.use('/xxx', aedcRouter);

const bgcRouter= require('./routes/bgc')(io);
app.use('/bgc', bgcRouter);


/*
//===============coordinator/head routes=======
const coordRouter = require('./routes/coor');
app.use('/coor', coordRouter);

const headcoordRouter = require('./routes/headcoor');
app.use('/headcoor', headcoordRouter);

const opmgrRouter = require('./routes/opmgr');
app.use('/opmgr', opmgrRouter);
*/

const cookieParser = require('cookie-parser');
app.use(cookieParser())

//===== socket.io connect
let listClient = []
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
				
		console.log('*** NEW ASIANOW  SOCKET.IO SERVICES STARTED ***\n', connectedSockets)	
		
		console.log(`NEW ASIANOW 12142K24 Connected ${nLogged}`)
		
		
	}//============eif

    socket.on('sendtoOpMgr', (data) => {
        let xdata = data
        
        //loop thru array socket
        connectedSockets.forEach(socketInfo => {
            if(parseInt(socketInfo.mode)===5){
               socket.to( socketInfo.socketId ).emit('loadchart', data ) 
               console.log(`Fired Event 'loadchart' to USER: ${socketInfo.userName}, ID: ${socketInfo.socketId }`)
            }//eif
        })
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

        console.log(`AsiaNow User Connected ${nLogged}`)
        //io.emit('logged',`Zonked connected: ${nLogged }`)
    })


    
})//end io conn
//====== server listen to por

const port = process.env.PORT||10000

server_https.listen( port ,()=>{
    console.log(`BGC, AEDC, LESLIE's listening to port ${port}`)
})
