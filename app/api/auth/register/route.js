import { getMongoClient } from '@/lib/mongo';
import bcrypt from 'bcrypt';

export async function POST(request) {
  const { email, password } = await request.json();

  // 비밀번호 해시
  const hash = await bcrypt.hash(password, 12);
  const client = await getMongoClient();

  try {
    await client.db('gpt')
      .collection('users')
      .insertOne({
        email,
        passwordHash: hash,
        createdAt: new Date(),
      });
    return new Response(JSON.stringify({ ok: true }), { status: 201 });
  } catch (e) {
    // 중복 이메일(Unique index) 오류
    return new Response(JSON.stringify({ error: 'Email already exists' }), {
      status: 409,
    });
  }
}