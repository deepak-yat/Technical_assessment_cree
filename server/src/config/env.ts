import dotenv from 'dotenv';
import path from 'node:path';
import { z } from 'zod';

// Load .env file from the server directory root
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z
    .string()
    .default('5000')
    .transform((val) => parseInt(val, 10))
    .refine((val) => !isNaN(val) && val > 0 && val < 65536, {
      message: 'PORT must be a valid port number between 1 and 65535',
    }),
  API_PREFIX: z.string().default('/api/v1'),
  MONGODB_URI: z
    .string()
    .min(1, 'MONGODB_URI is required')
    .refine((val) => val.startsWith('mongodb://') || val.startsWith('mongodb+srv://'), {
      message: 'MONGODB_URI must be a valid MongoDB connection string',
    }),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  JWT_ACCESS_SECRET: z
    .string()
    .min(32, 'JWT_ACCESS_SECRET must be at least 32 characters long for security'),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32, 'JWT_REFRESH_SECRET must be at least 32 characters long for security'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  const formattedErrors = parsedEnv.error.issues
    .map((issue) => `  - [${issue.path.join('.')}] ${issue.message}`)
    .join('\n');

  console.error('\x1b[31m[FATAL] Invalid environment configuration:\x1b[0m\n' + formattedErrors);
  process.exit(1);
}

export type EnvConfig = z.infer<typeof envSchema>;
export const config: EnvConfig = parsedEnv.data;
