import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

const app = express();

app.use(cors({
  origin: process.env.CORS_ORIGIN,
  credentials: true
}));

// 👇 Serve static files before routes — that's fine
app.use(express.static('public'));
app.use(cookieParser());

// 👇 Routes that need file uploads come BEFORE body parsers
import userRouter from './routes/user.routes.js';
app.use("/api/v1/users", userRouter);

// 👇 Body parsers come AFTER file routes (so multer gets first dibs on multipart/form-data)
app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));

export { app };
