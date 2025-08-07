import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// 환경변수 로드
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Environment variables:', {
    SUPABASE_URL: process.env.SUPABASE_URL ? 'SET' : 'NOT_SET',
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ? 'SET' : 'NOT_SET'
  });
  throw new Error('Supabase URL과 Key가 환경변수에 설정되어 있지 않습니다');
}

export const supabase = createClient(supabaseUrl, supabaseKey);