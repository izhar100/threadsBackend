const Conversation = require("../models/conversationModel");
const Message = require("../models/messageModal");
const { getRecipientSocketId, io } = require("../socket/socket");

const sendMessage=async(req,res)=>{
   try {
    const {recipientId,message}=req.body;
    const senderId=req.user._id;
    let conversation=await Conversation.findOne({
        participants:{$all:[senderId,recipientId]}
    });
    if(!conversation){
        conversation=new Conversation({
            participants:[senderId,recipientId],
            lastMessage:{
                text:message,
                sender:senderId
            }
        })
        await conversation.save()
    }
    const newMessage=new Message({
        conversationId:conversation._id,
        sender:senderId,
        text:message
    })
    await Promise.all([
        newMessage.save(),
        conversation.updateOne({
            lastMessage:{
                text:message,
                sender:senderId
            }
        })
    ])

    const recipientSocketId=getRecipientSocketId(recipientId)
    if(recipientSocketId){
        io.to(recipientSocketId).emit("newMessage",newMessage)
    }
    res.status(201).json(newMessage)
   } catch (error) {
     console.log("error in sendMessage: ",error.message)
     res.status(500).json(error.message)
   }
}

const getMessages=async(req,res)=>{
    const {otherUserId}=req.params;
    const userId=req.user._id;
    try {
        const conversation=await Conversation.findOne({
            participants:{$all:[userId,otherUserId]}
        })
        if(!conversation){
            res.status(404).json({error:'Conversation not found'})
        }
        const messages=await Message.find({
            conversationId:conversation._id
        }).sort({createdAt:1})
        res.status(200).json(messages)
    } catch (error) {
     console.log("error in getMessage: ",error.message)
     res.status(500).json(error.message)
    }
}

const getConversations=async(req,res)=>{
    const userId=req.user._id
    try {
        const conversations=await Conversation.find({participants:userId}).populate({
            path:"participants",
            select:"name username profilePic"
        })
        conversations.forEach((conversation)=>{
            conversation.participants=conversation.participants.filter(
                participant=>participant._id.toString()!==userId.toString()
            );
        })
        res.status(200).json(conversations)
    } catch (error) {
     console.log("error in getConversations: ",error.message)
     res.status(500).json(error.message)
    }
}

module.exports={
    sendMessage,
    getMessages,
    getConversations
}