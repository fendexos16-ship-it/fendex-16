
import { QueueJob } from '../types';

const JOB_QUEUE: QueueJob[] = [];
let isWorkerRunning = false;

export const queueService = {
  
  enqueue: async (type: QueueJob['type'], payload: any): Promise<string> => {
     const id = `JOB-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
     const job: QueueJob = {
        id,
        type,
        payload,
        status: 'PENDING',
        createdAt: new Date().toISOString()
     };
     
     JOB_QUEUE.push(job);
     
     // Trigger worker if idle (Simulation)
     if (!isWorkerRunning) processQueue();
     
     return id;
  },

  getJobStatus: (id: string): QueueJob | undefined => {
     return JOB_QUEUE.find(j => j.id === id);
  },

  getPendingCount: (): number => {
     return JOB_QUEUE.filter(j => j.status === 'PENDING').length;
  },

  getAllJobs: (): QueueJob[] => {
     return [...JOB_QUEUE].reverse().slice(0, 50); // Last 50
  }
};

// Simulated Worker
const processQueue = async () => {
   if (JOB_QUEUE.filter(j => j.status === 'PENDING').length === 0) {
      isWorkerRunning = false;
      return;
   }

   isWorkerRunning = true;
   
   // FIFO
   const jobIndex = JOB_QUEUE.findIndex(j => j.status === 'PENDING');
   if (jobIndex === -1) return;

   const job = JOB_QUEUE[jobIndex];
   job.status = 'PROCESSING';
   
   console.log(`[QUEUE] Processing ${job.id} (${job.type})`);
   
   try {
      // Simulate Processing Time
      await new Promise(r => setTimeout(r, 2000));
      
      // Simulate Logic based on Type
      if (job.type === 'REPORT_GENERATION') {
         job.resultUrl = `https://fendex-reports.s3.aws.com/${job.id}.csv`;
      }
      
      job.status = 'COMPLETED';
      job.processedAt = new Date().toISOString();
   } catch (e: any) {
      job.status = 'FAILED';
      job.error = e.message;
      console.error(`[QUEUE] Job ${job.id} Failed`);
   }
   
   // Process Next
   setTimeout(processQueue, 500); 
};
