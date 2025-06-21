import {Router} from 'express';
import { getUserChannelProfile, registerUser } from '../controllers/user.controller.js';
import {upload} from "../middlewares/multer.middleware.js"
import { verify } from 'jsonwebtoken';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { refreshAccessToken } from '../controllers/user.controller.js';

const router = Router();

router.route("/register").post(
    upload.fields( [
        {
            name: "avatar",
            maxCount: 1

        },
        {
            name: "coverImage",
            maxCount: 1

        }

    ]),
    
    
    registerUser)

router.route("/login").post(loginUser) 

router.route("/logout").post(verifyJWT, logoutUser)
router.route("/refresh").post(refreshAccessToken)

router.route("/change-password").post(verifyJWT, changePassword)
router.route("/current-user").get(verifyJWT, getCurrentUser)
router.route("/update-account").put(verifyJWT, updateAccount)
router.route("/avatar").put(verifyJWT, upload.single("avatar"), updateAvatar)
router.route("/cover-image").put(verifyJWT, upload.single("coverImage"), updateCoverImage)
router.route("/c/:id").get(verifyJWT, getUserChannelProfile)
router.route("/history").get(verifyJWT, getUserHistory)



export default router;
             