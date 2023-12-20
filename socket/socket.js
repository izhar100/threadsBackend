const {Server}=require("socket.io")
const http=require("http")
const express=require("express")

const app=express();

const server=http.createServer(app)

const io = new Server(server,{
    cors:{
        origin:"https://threadsclone-kappa.vercel.app",
        // origin:"http://127.0.0.1:5173",
        method:["GET","POST"]
    }
})

const getRecipientSocketId=(recipientId)=>{
    return userSocketMap[recipientId];
}

const userSocketMap={} //userId in socket

io.on('connection',(socket)=>{
    const userId=socket.handshake.query.userId;
    if(userId!=="undefined"){
      userSocketMap[userId]=socket.id
    }
    io.emit("getOnlineUsers",Object.keys(userSocketMap))

    socket.on("disconnect",()=>{
        delete userSocketMap[userId];
        io.emit("getOnlineUsers",Object.keys(userSocketMap))
    })
})

module.exports={
    io,server,app,getRecipientSocketId
}