import express from "express";
import { fromNodeHandler } from "h3";
import { CLERK_PROXY_PATH, clerkProxyMiddleware } from "../../../middlewares/clerkProxyMiddleware";

// No body parser: the proxy must receive the untouched request stream.
const app = express();
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());
export default fromNodeHandler(app);
