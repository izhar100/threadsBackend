const { User } = require("../models/userModel");
const bcrypt = require('bcryptjs');
const { generateTokenAndSetCookie } = require("../utils/helpers/generateTokenAndSetCookie");
const { default: mongoose } = require("mongoose");
const { Post } = require("../models/postModel");
const cloudinay = require('cloudinary').v2

const getUserProfile = async (req, res) => {
    const { query } = req.params
    //we will fetch user profile either with username of userId
    try {
        let user;
        if (mongoose.Types.ObjectId.isValid(query)) {
            user = await User.findOne({ _id: query }).select("-password").select("-updatedAt")
        } else {
            user = await User.findOne({ username: query }).select("-password").select("-updatedAt")
        }
        if (!user) return res.status(400).json({ error: "User not found" })
        res.status(200).json(user)

    } catch (error) {
        res.status(500).json({ error: error.message })
        console.log("Error in getUserProfile: ", error.message)
    }
}

const signupUser = async (req, res) => {
    try {
        const { name, email, username, password } = req.body;
        const user = await User.findOne({ $or: [{ email, username }] })
        if (user) {
            return res.status(400).json({ error: "Email or username already exists" });
        }
        const salt = await bcrypt.genSalt(10)
        const hashedPassword = await bcrypt.hash(password, salt)
        const newUser = new User({
            name,
            email,
            username:username.toLowerCase(),
            password: hashedPassword
        });
        await newUser.save();
        if (newUser) {
            const token=generateTokenAndSetCookie(newUser._id, res)
            res.status(201).json({
                _id: newUser._id,
                name: newUser.name,
                email: newUser.email,
                username: newUser.username,
                bio: newUser.bio,
                profilePic: newUser.profilePic,
                token:token
            })
        } else {
            res.status(400).json({ error: "Invalid user data" });
        }

    } catch (error) {
        res.status(500).json({ error: error.message })
        console.log("Error in signupUser: ", error.message)
    }
}

const loginUser = async (req, res) => {
    try {
        let { username, password } = req.body;
        username=username.toLowerCase()
        const user = await User.findOne({ username })
        const isPasswordCorrect = await bcrypt.compare(password, user?.password || "")
        if (!user || !isPasswordCorrect) {
            return res.status(400).json({ error: 'Invalid username or password' });
        }
        const token=generateTokenAndSetCookie(user._id, res)
        res.status(200).json({
            _id: user._id,
            name: user.name,
            email: user.email,
            username: user.username,
            bio: user.bio,
            profilePic: user.profilePic,
            token:token
        })
    } catch (error) {
        res.status(500).json({ error: error.message })
        console.log('Error in loginUser: ', error.message)
    }
}

const logoutUser = (req, res) => {
    try {
        res.cookie("jwt", "", { maxAge: 1 })
        res.status(200).json({ message: "User logged out successfully!" })
    } catch (error) {
        res.status(500).json({ error: error.message })
        console.log('Error in logoutUser: ', error.message)
    }
}

const followUnfollowUser = async (req, res) => {
    try {
        const { id } = req.params;
        const userToModify = await User.findById(id)
        const currentUser = await User.findById(req.user._id)
        if (id == req.user._id.toString()) {
            return res.status(400).json({ error: "You can not follow/unfollow yourself" })
        }
        if (!userToModify || !currentUser) {
            return res.status(400).json({ error: "User not found" })
        }
        const isFollowing = currentUser.following.includes(id);
        if (isFollowing) {
            // unfollow
            //modify following of currentUser and follower of userToModify
            await User.findByIdAndUpdate(id, { $pull: { followers: req.user._id } })
            await User.findByIdAndUpdate(req.user._id, { $pull: { following: id } })
            res.status(200).json({ message: 'User unfollowed successfully' })
        } else {
            //follow
            //modify following of currentUser and follower of userToModify
            await User.findByIdAndUpdate(id, { $push: { followers: req.user._id } })
            await User.findByIdAndUpdate(req.user._id, { $push: { following: id } })
            res.status(200).json({ message: 'User followed successfully' })
        }

    } catch (error) {
        res.status(500).json({ error: error.message })
        console.log('Error in followUnfollowUser: ', error.message)
    }
}

const updateUser = async (req, res) => {
    const { name, email, username, password, bio } = req.body;
    let { profilePic } = req.body
    const userId = req.user._id
    try {
        let user = await User.findById(userId)
        if (!user) {
            return res.status(400).json({ error: "User not found" });
        }
        if (req.params.id !== userId.toString()) {
            return res.status(400).json({ error: "Unauthorized to edit this profile" })
        }
        if (password) {
            const salt = await bcrypt.genSalt(10)
            const hashedPassword = await bcrypt.hash(password, salt)
            user.password = hashedPassword;
        }
        if (profilePic) {
            if (user.profilePic) {
                await cloudinay.uploader.destroy(user.profilePic.split("/").pop().split(".")[0])
            }
            const uploadedResponse = await cloudinay.uploader.upload(profilePic)
            profilePic = uploadedResponse.secure_url
        }
        user.name = name || user.name
        user.email = email || user.email
        user.username = username || user.username
        user.profilePic = profilePic || user.profilePic
        user.bio = bio || user.bio
        await user.save()

        // find all posts that this user replied and update username,name and userProfilePic fields
        await Post.updateMany(
            { "replies.userId": userId },
            {
                $set: {
                    "replies.$[reply].username": user.username,
                    "replies.$[reply].userProfilePic": user.profilePic,
                    "replies.$[reply].name": user.name
                }
            },
            { arrayFilters: [{ "reply.userId": userId }] }
        )

        user.password = null
        res.status(200).json(user)
    } catch (error) {
        res.status(500).json({ error: error.message })
        console.log('Error in updateUser: ', error.message)
    }
}

const getAllUsers = async (req, res) => {
    try {
        const query = req.query.search; // Get the 'name' query parameter from the request

        let users;
        if (query) {
            // If 'name' query parameter is provided, filter users based on 'name' and 'username'
            users = await User.find({
                $or: [
                    { name: { $regex: query, $options: 'i' } }, // Case-insensitive search for 'name'
                    { username: { $regex: query, $options: 'i' } }, // Case-insensitive search for 'username'
                ],
            });
        } else {
            // If no 'name' query parameter is provided, fetch all users
            users = await User.find().sort({createdAt:1}).limit(5);
        }

        res.status(200).json(users);
    } catch (error) {
        console.log("Error in getAllUsers: ",error.message);
        res.status(500).json({ error: 'An error occurred while fetching users.' });
    }
}


module.exports = {
    signupUser,
    loginUser,
    logoutUser,
    followUnfollowUser,
    updateUser,
    getUserProfile,
    getAllUsers
}