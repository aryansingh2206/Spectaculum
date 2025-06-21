import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

const generateAccessAndRefreshTokens = async(userId) =>{
    try{ 
        const user = await User.findById(userId);
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        user.refreshToken = refreshToken;
        await user.save({validateBeforeSave: false});

        return { accessToken, refreshToken };

    } catch(error){
        throw new ApiError(500, "Failed to generate tokens");
    }
}

export const registerUser = asyncHandler(async (req, res) => {
  const { fullName, email, username, password } = req.body;

  console.log("BODY:", req.body);
  console.log("FILES:", req.files);

  // 1. Basic field check
  if ([fullName, email, username, password].some((field) => field?.trim() === "")) {
    throw new ApiError(400, "All fields are required");
  }

  // 2. Check if user already exists
  const existedUser = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (existedUser) {
    throw new ApiError(409, "Username or email already exists");
  }

  // 3. Multer paths
  const avatarLocalPath = req?.files?.avatar?.[0]?.path;
  const coverImageLocalPath = req?.files?.coverImage?.[0]?.path;

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is required");
  }

  // 4. Upload to Cloudinary
  let avatar, coverImage;
  try {
    avatar = await uploadOnCloudinary(avatarLocalPath);
  } catch (error) {
    console.error("Error uploading avatar:", error.message);
    throw new ApiError(500, "Failed to upload avatar to Cloudinary");
  }

  try {
    if (coverImageLocalPath) {
      coverImage = await uploadOnCloudinary(coverImageLocalPath);
    }
  } catch (error) {
    console.error("Error uploading cover image:", error.message);
    // Not throwing here because coverImage is optional
  }

  if (!avatar?.url) {
    throw new ApiError(500, "Cloudinary did not return avatar URL");
  }

  // 5. Create user
  const user = await User.create({
    fullName,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    email,
    password,
    username: username.toLowerCase(),
  });

  // 6. Fetch clean version without sensitive fields
  const createdUser = await User.findById(user._id).select("-password -refreshToken");

  if (!createdUser) {
    throw new ApiError(500, "User was not created");
  }

  // 7. Respond
  return res
    .status(201)
    .json(new ApiResponse(201, createdUser, "User created successfully"));
});

export const loginUser = asyncHandler(async (req, res) => {

    const{email,username,password}= req.body;
    if(!email && !username){
        throw new ApiError(400, "Email or username is required");
    }

    const user = await User.findOne({
        $or: [{username}, {email}]
    })

    if(!user){
        throw new ApiError(404, "User not found");
    }

    const isPasswordCorrect = await user.isPasswordCorrect(password);
    if(!isPasswordCorrect){
        throw new ApiError(401, "Invalid password");
    }

    const{accessToken,refreshToken} = await generateAccessAndRefreshTokens(user._id)
    
    const loggedInUser = await User.findById(user._id).select("-password -refreshToken");
     
    const options ={
        httpOnly:true,
        secure:true,
    }
    return res.status(200).cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(
            200,
            {
                user: loggedInUser,accessToken,refreshToken
            },
            "User logged in successfully"
        )
    )

})

export const logoutUser = asyncHandler(async (req, res) => {
   await User.findByIdAndUpdate(
        req.user._id,
        {
            $set:{
                refreshToken: undefined
            }
        },                       
        {
            new: true
        }
    )

    const options = {
        httpOnly: true,
        secure: true,
    }

    return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(new ApiResponse(200, null, "User logged out successfully"));  
})

export const refreshAccessToken = asyncHandler(async (req, res) => {

    const incomingRefreshToken = req.cookies.
    refreshToken ||req.body.refreshToken 

    if(!incomingRefreshToken){
        throw new ApiError(401, "Refresh token is required");
    }

    try {
        const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);
         
        const user = await User.findById(decodedToken?._id)
        
        if(!user){
            throw new ApiError(401, "Invalid refresh token");
        }
    
        if(incomingRefreshToken !== user?.refreshToken){
            throw new ApiError(401, "Invalid refresh token");
        }
    
        const options = {
            httpOnly: true,
            secure: true,
        };         
        
        const {accessToken, refreshToken} = await generateAccessAndRefreshTokens(user._id)
    
        return res
            .status(200)
            .cookie("accessToken",  accessToken, options)
            .cookie("refreshToken", refreshToken, options)
            .json(new ApiResponse(200, null, "Access token refreshed successfully"));
    
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token");
                  
    }

});                                         

export const changeCurrentPassword = asyncHandler(async (req, res) => {
  const{oldPassword,newPassword} = req.body;
  
  const user = await User.findById(req.user._id)
  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);
  if(!isPasswordCorrect){
    throw new ApiError(401, "Old password is incorrect");
  }
  user.password = newPassword;
  await user.save({validateBeforeSave: false});

  return res.status(200).
  json(new ApiResponse(200, {}, "Password changed successfully"));
});

export const getCurrentUser = asyncHandler(async (req, res) => {
  return res
  .status(200)
  .json(new ApiResponse(200, req.user, "Current user fetched successfully")
  );
})

const updateAccountDetails = (async (user, updateData) => {
  const{fullName,email} = req.body;
  if(!fullName || !email) {
    throw new ApiError(400, "Full name and email are required");
  }

  const user =  User.findByIdAndUpdate(
  req.user?._id,
  {
    $set: {
      fullName,
      email
    }

  },{new:true}
).select("-password")

return res
    .status(200)
    .json(new ApiResponse(200, user, "Account details updated successfully"));
});

const updateUserAvatar = (async (req, res) => {
  const avatarLocalPath = req.file?.path
  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is required");
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath);
  if (!avatar.url) {
    throw new ApiError(400, "Cloudinary did not return avatar URL");
  }

  await User.findByIdAndUpdate(
    req.user._id,
    { $set: { avatar: avatar.url } },
    { new: true }
  ).select("-password");

});
 
export const updateUserCoverImage = asyncHandler(async (req, res) => {
  const coverImageLocalPath = req.file?.path;
  if (!coverImageLocalPath) {
    throw new ApiError(400, "Cover image file is required");
  }

  const coverImage = await uploadOnCloudinary(coverImageLocalPath);
  if (!coverImage.url) {
    throw new ApiError(400, "Cloudinary did not return cover image URL");
  }

  await User.findByIdAndUpdate(
    req.user._id,
    { $set: { coverImage: coverImage.url } },
    { new: true }
  ).select("-password");

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Cover image updated successfully"));

});

export const getUserChannelProfile = asyncHandler(async (req, res) => {
  const { username } = req.params;
  if (!username || username.trim() === "") {
    throw new ApiError(400, "Username is required");
  }                  

  const channel = await User.aggregate([
    {
      $match: { username: username?.toLowerCase() }
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "channel",
        as: "subscribers"
      }
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "subscriber",
        as: "subscribersTo"
      }
    },
    {
      $addFields: {
        subscriberCount: { $size: "$subscribers" },
        channelsSubscribedToCount: { $size: "$subscribersTo" },
        isSubscribed: {
          $cond: {
            if: { $in: [req.user?._id, "$subscribers.subscriber"] },
            then: true,
            else: false
          }
          
        }
      }         
    },
    {
      $project: {
       fullName: 1,
       username: 1,
       subscriberCount: 1,
       channelsSubscribedToCount: 1,
       isSubscribed: 1,
        avatar: 1,
        coverImage: 1,
        email: 1,
      }
    }

  ])
  if (!channel || channel.length === 0) {
    throw new ApiError(404, "Channel not found");
  }
  return res
    .status(200)
    .json(new ApiResponse(200, channel[0], "Channel profile fetched successfully"));
})

const getWatchHistory = asyncHandler(async (req, res) => {
  const watchHistory = await User.aggregate([
    {
      $match: { _id: new mongoose.Types.ObjectId(req.user._id) }
    },
    {
      $lookup: {
        from: "videos",
        localField: "watchHistory",
        foreignField: "_id",
        as: "watchHistory",
        pipeline:[
          {
            $lookup: {
              from: "users",
              localField: "owner",
              foreignField: "_id",
              as: "owner",
              pipeline: [
                {
                  $project: {
                    _id: 1,
                    fullName: 1,
                    username: 1,
                    avatar: 1
                  }
                }
              ]
            }
          },
          {
            $addFields:{
            owner:{
              $first: "$owner"
            }
          }
          }
        ]
      }
    },
    
  ]);

  return res
    .status(200)
    .json(new ApiResponse(200, user[0].watchHistory, "Watch history fetched successfully"));
})
                