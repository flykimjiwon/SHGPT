import { MongoClient } from 'mongodb';

let client;   // 싱글톤 – 애플리케이션 전체에서 하나만 연결

/** 
 * 환경 변수 MONGODB_URI 로부터 클라이언트를 생성하고,
 * 이미 연결돼 있으면 재사용합니다.
 */
export async function getMongoClient() {
  if (!client) {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error('❌ MONGODB_URI 가 .env.local 에 정의되지 않았습니다.');
    }
    client = new MongoClient(uri, {
      // 최신 드라이버 옵션 (필요에 따라 조정)
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    await client.connect();
    console.log('✅ MongoDB 연결 성공');
  }
  return client;
}