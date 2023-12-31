const express=require("express")
const { signupUser, loginUser, logoutUser, followUnfollowUser, updateUser, getUserProfile, getAllUsers } = require("../controllers/userController")
const { protectRoute } = require("../middlewares/protectRoute")
const userRouter=express.Router()

userRouter.get("/profile/:query",getUserProfile)
userRouter.get("/",getAllUsers)
userRouter.post("/signup",signupUser)
userRouter.post("/login",loginUser)
userRouter.post("/logout",logoutUser)
userRouter.post("/follow/:id",protectRoute,followUnfollowUser)
userRouter.put("/update/:id",protectRoute,updateUser)
module.exports={
    userRouter
}