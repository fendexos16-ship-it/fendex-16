
import express from 'express';
import fmRoutes from './fmRoutes';

const app = express();
app.use(express.json());

// Routes
app.use('/api/fm', fmRoutes);

// Error Handling Middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[SERVER_ERROR]', err);
  res.status(500).json({ success: false, message: "Internal Server Error" });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`FENDEX LOGISTICS BACKEND - FM MODULE ACTIVE ON PORT ${PORT}`);
});

export default app;
