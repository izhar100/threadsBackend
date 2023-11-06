const express=require('express')
const { protectRoute } = require('../middlewares/protectRoute')
const { sendMessage, getMessages, getConversations } = require('../controllers/messageController')
const messageRoute=express.Router()

messageRoute.get("/conversations",protectRoute,getConversations)
messageRoute.post("/",protectRoute,sendMessage)
messageRoute.get("/:otherUserId",protectRoute,getMessages)

module.exports=messageRoute